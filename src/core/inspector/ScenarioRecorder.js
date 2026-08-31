/**
 * ScenarioRecorder.js - シナリオ記録＆リアルタイムメッセージデバッガー UI
 *
 * ブラウザ実機上で NetHack をプレイしながら、実機のイベントストリームと盤面状態を
 * ピンポイントでキャプチャし、統合テスト用シナリオ JSON (*.scenario.json) として
 * エクスポートする開発支援ツール。
 */

export class ScenarioRecorder {
    /**
     * @param {Object} core - WebUICore インスタンス
     * @param {Object} [options={}] 
     * @param {boolean} [options.autoMount=true] - ブラウザ環境で自動的にUIをマウントするか
     * @param {'bottom-right'|'bottom-left'|'top-right'} [options.position='bottom-right']
     */
    constructor(core, options = {}) {
        if (!core) {
            throw new Error('[ScenarioRecorder] WebUICore instance is required.');
        }
        this.core = core;
        this.options = {
            autoMount: false,
            position: 'bottom-right',
            ...options
        };

        this.isRecording = false;
        this.recordedEvents = [];
        this.initialState = null;
        this.meta = {
            title: 'キャプチャシナリオ',
            description: '',
            createdAt: null,
            turn: 1
        };

        this.recentPreviewLogs = [];
        this.uiContainer = null;
        this._coreListeners = [];

        if (this.options.autoMount && typeof document !== 'undefined') {
            this.mountUI();
        }
    }

    /**
     * 録画開始
     * @param {string} [title] - シナリオ名
     */
    start(title = '') {
        if (this.isRecording) return;
        this.isRecording = true;
        this.recordedEvents = [];
        this.recentPreviewLogs = [];

        if (title) {
            this.meta.title = title;
        }
        this.meta.createdAt = new Date().toISOString();

        // 1. 開始時点のスナップショット (initialState) を構築
        this.initialState = this._captureInitialState();

        // 2. コア経由でドライバーの記録を開始
        if (typeof this.core.startRecording === 'function') {
            this.core.startRecording();
        }

        // 3. リアルタイムプレビュー用リスナーを登録
        this._bindPreviewListeners();

        this._updateUI();
    }

    /**
     * 録画停止
     * @returns {Array<Object>} 収集されたイベント列
     */
    stop() {
        if (!this.isRecording) return this.recordedEvents;
        this.isRecording = false;

        // ドライバーからイベントを回収
        let driverEvents = [];
        if (typeof this.core.stopRecording === 'function') {
            driverEvents = this.core.stopRecording();
        }

        // ドライバー側で記録されたイベントがあれば優先採用し、なければ自前蓄積イベントを採用
        if (Array.isArray(driverEvents) && driverEvents.length > 0) {
            this.recordedEvents = driverEvents;
        }

        this._unbindPreviewListeners();
        this._updateUI();

        return this.recordedEvents;
    }

    /**
     * 収集したデータから完全なシナリオ JSON オブジェクトを構築
     * @returns {Object}
     */
    exportData() {
        const turn = this.core.gkl?.monsterTracker?.getCurrentTurn?.() ||
                     this.core.getStatus?.()?.turns || 1;

        return {
            version: '1.0',
            meta: {
                title: this.meta.title || 'シナリオキャプチャ',
                description: this.meta.description || '',
                createdAt: this.meta.createdAt || new Date().toISOString(),
                turn
            },
            initialState: this.initialState || { status: {}, initialEvents: [], silentBuffers: {} },
            events: this.recordedEvents || []
        };
    }

    /**
     * ブラウザ上でシナリオ JSON をファイルとしてダウンロード
     * @param {string} [filename]
     */
    downloadJson(filename = '') {
        if (typeof document === 'undefined') return;

        const data = this.exportData();
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const defaultName = `scenario_${Date.now()}.json`;
        const actualName = filename || defaultName;

        const a = document.createElement('a');
        a.href = url;
        a.download = actualName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 開始時点のスナップショットを抽出
     * @private
     */
    _captureInitialState() {
        const status = this.core.getStatus ? this.core.getStatus() : {};
        const playerX = this.core.gkl?.areaStateManager?.playerX ?? 0;
        const playerY = this.core.gkl?.areaStateManager?.playerY ?? 0;

        // 所持品の rawText 配列を抽出 (i コマンド用)
        const inventoryItems = this.core.gkl?.inventoryStateManager?.items || [];
        const silentBuffers = {
            'i': inventoryItems.map(item => {
                const text = item.rawText || item.name || 'item';
                if (/^[a-zA-Z]\s*[-–]/.test(text)) return text;
                return `${item.letter || item.invlet || 'a'} - ${text}`;
            })
        };

        const initialEvents = [
            { type: 'curs', data: { x: playerX, y: playerY } }
        ];

        return {
            status: {
                hp: status.hp?.current || 15,
                maxHp: status.hp?.max || 15,
                dlevel: status.dlevel?.text || 'dungeon:1',
                x: playerX,
                y: playerY
            },
            initialEvents,
            silentBuffers
        };
    }

    /**
     * リアルタイムプレビュー用リスナーの登録
     * @private
     */
    _bindPreviewListeners() {
        this._unbindPreviewListeners();

        const previewEvents = ['messageText', 'print_glyph', 'curs', 'status_update', 'inputRequired'];
        for (const evt of previewEvents) {
            const handler = (data) => {
                if (!this.isRecording) return;
                let summary = evt;
                if (evt === 'messageText' && data?.text) {
                    summary = `💬 "${data.text.slice(0, 30)}${data.text.length > 30 ? '...' : ''}"`;
                } else if (evt === 'print_glyph') {
                    summary = `🗺️ glyph(${data.glyph || '?'}) at (${data.x}, ${data.y})`;
                } else if (evt === 'curs') {
                    summary = `📍 curs (${data.x}, ${data.y})`;
                } else if (evt === 'inputRequired') {
                    summary = `⌨️ input (${data.category || '?'})`;
                }

                this.recentPreviewLogs.push(summary);
                if (this.recentPreviewLogs.length > 6) {
                    this.recentPreviewLogs.shift();
                }

                // 直接イベント配列にも安全に蓄積 (ドライバー側と二重化・フェイルセーフ)
                if (this.recordedEvents.length < 10000) {
                    try {
                        const cloned = data !== undefined ? JSON.parse(JSON.stringify(data)) : {};
                        this.recordedEvents.push({
                            type: evt,
                            data: cloned,
                            timestamp: Date.now()
                        });
                    } catch (e) {
                        this.recordedEvents.push({
                            type: evt,
                            data,
                            timestamp: Date.now()
                        });
                    }
                }

                this._updateUI();
            };

            this.core.on(evt, handler);
            this._coreListeners.push({ evt, handler });
        }
    }

    /**
     * プレビューリスナーの解除
     * @private
     */
    _unbindPreviewListeners() {
        if (Array.isArray(this._coreListeners)) {
            for (const { evt, handler } of this._coreListeners) {
                if (typeof this.core.off === 'function') {
                    this.core.off(evt, handler);
                }
            }
        }
        this._coreListeners = [];
    }

    /**
     * フローティングバー UI のマウント
     */
    mountUI() {
        if (typeof document === 'undefined') return;
        if (this.uiContainer) return;

        const el = document.createElement('div');
        el.id = 'scenario-recorder-toolbar';
        el.style.cssText = `
            position: fixed;
            ${this.options.position.includes('bottom') ? 'bottom: 16px;' : 'top: 16px;'}
            ${this.options.position.includes('left') ? 'left: 16px;' : 'right: 16px;'}
            z-index: 99999;
            background: rgba(18, 22, 30, 0.88);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 8px 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
            font-size: 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-width: 320px;
            user-select: none;
        `;

        el.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="font-weight: bold; color: #58a6ff;">🎬 Scenario Recorder</span>
                <span id="rec-status-indicator" style="font-size: 11px; color: #8b949e;">IDLE</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
                <input id="rec-title-input" type="text" placeholder="シナリオ名 (例: 目玉遭遇)" 
                    style="background: rgba(0,0,0,0.4); border: 1px solid #444; border-radius: 4px; padding: 4px 6px; color: #fff; font-size: 11px; flex: 1;" />
                <button id="rec-btn-start" style="background: #e5534b; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">● REC</button>
                <button id="rec-btn-stop" style="background: #444; color: #aaa; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;" disabled>■ Stop</button>
                <button id="rec-btn-export" style="background: #238636; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;" disabled>💾 DL</button>
            </div>
            <div id="rec-preview-box" style="display: none; background: rgba(0,0,0,0.5); border-radius: 4px; padding: 4px; font-family: monospace; font-size: 10px; color: #7ee787; max-height: 80px; overflow-y: auto;">
            </div>
        `;

        document.body.appendChild(el);
        this.uiContainer = el;

        // イベントバインド
        const btnStart = el.querySelector('#rec-btn-start');
        const btnStop = el.querySelector('#rec-btn-stop');
        const btnExport = el.querySelector('#rec-btn-export');
        const inputTitle = el.querySelector('#rec-title-input');

        btnStart.addEventListener('click', () => {
            this.start(inputTitle.value.trim());
        });

        btnStop.addEventListener('click', () => {
            this.stop();
        });

        btnExport.addEventListener('click', () => {
            const rawTitle = inputTitle.value.trim() || 'scenario';
            const safeTitle = rawTitle.replace(/[^a-zA-Z0-9_\u3040-\u30ff\u4e00-\u9fa5]/g, '_');
            this.downloadJson(`${safeTitle}_${Date.now()}.json`);
        });

        this._updateUI();
    }

    /**
     * UI表示の更新
     * @private
     */
    _updateUI() {
        if (!this.uiContainer) return;

        const indicator = this.uiContainer.querySelector('#rec-status-indicator');
        const btnStart = this.uiContainer.querySelector('#rec-btn-start');
        const btnStop = this.uiContainer.querySelector('#rec-btn-stop');
        const btnExport = this.uiContainer.querySelector('#rec-btn-export');
        const previewBox = this.uiContainer.querySelector('#rec-preview-box');

        if (this.isRecording) {
            const count = this.core.driver?.recordedEvents?.length || 0;
            indicator.textContent = `REC ● (${count} evts)`;
            indicator.style.color = '#f85149';
            btnStart.disabled = true;
            btnStart.style.opacity = '0.5';
            btnStop.disabled = false;
            btnStop.style.opacity = '1.0';
            btnStop.style.background = '#e5534b';
            btnStop.style.color = '#fff';
            btnExport.disabled = true;
            btnExport.style.opacity = '0.5';

            previewBox.style.display = 'block';
            previewBox.innerHTML = this.recentPreviewLogs.map(log => `<div>${log}</div>`).join('') || '<div>待機中...</div>';
            previewBox.scrollTop = previewBox.scrollHeight;
        } else {
            const count = this.recordedEvents ? this.recordedEvents.length : 0;
            indicator.textContent = count > 0 ? `STOPPED (${count} evts)` : 'IDLE';
            indicator.style.color = count > 0 ? '#58a6ff' : '#8b949e';
            btnStart.disabled = false;
            btnStart.style.opacity = '1.0';
            btnStop.disabled = true;
            btnStop.style.opacity = '0.5';
            btnStop.style.background = '#444';
            btnStop.style.color = '#aaa';

            btnExport.disabled = count === 0;
            btnExport.style.opacity = count > 0 ? '1.0' : '0.5';

            if (count > 0 && this.recentPreviewLogs.length > 0) {
                previewBox.style.display = 'block';
                previewBox.innerHTML = this.recentPreviewLogs.map(log => `<div>${log}</div>`).join('');
            } else {
                previewBox.style.display = 'none';
            }
        }
    }

    /**
     * UIの破棄
     */
    destroy() {
        this.stop();
        if (this.uiContainer && this.uiContainer.parentNode) {
            this.uiContainer.parentNode.removeChild(this.uiContainer);
        }
        this.uiContainer = null;
    }
}
