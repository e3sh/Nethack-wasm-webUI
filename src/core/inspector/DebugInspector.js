/**
 * DebugInspector.js - WebUICore 開発者支援 ＆ 別ウィンドウ監視デバッグ基盤
 *
 * WebUI クライアントの画面描画やスタイルに 100% 影響を与えず、
 * BroadcastChannel 通信を利用して別タブ/別ウィンドウの独立コンソールへ
 * Wasm 通信ログ・状態遷移・GKL キャッシュの配信およびダイレクト応答注入を行う。
 */

import { OBJECT_KNOWLEDGE_MAP } from '../knowledge/OBJECT_KNOWLEDGE_FULL.js';

export class DebugInspector {
    constructor(core, options = {}) {
        if (!core) {
            throw new Error("DebugInspector: core instance is required.");
        }
        this.core = core;
        this.channelName = options.channelName || 'webuicore_inspector_channel';
        this.isBroadcasting = false;
        this.channel = null;
        this.consoleWindow = null;
        this.logs = [];
        this.maxLogCount = options.maxLogCount || 500;
        this.stateThrottleDelay = options.stateThrottleDelay !== undefined ? options.stateThrottleDelay : 100;
        this._stateThrottleTimer = null;

        if (options.autoStart !== false) {
            this.startBroadcast();
        }
    }

    /**
     * BroadcastChannel への配信を開始
     */
    startBroadcast() {
        if (this.isBroadcasting) return;

        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.channel = new BroadcastChannel(this.channelName);
                this.channel.onmessage = (event) => this._handleConsoleMessage(event);
            } catch (e) {}
        }

        this.isBroadcasting = true;
        this._bindCoreEvents();
    }

    /**
     * GKL 内部構造を含む現在の全体状態のスナップショット送信をスロットリング（間引き）予約
     */
    scheduleBroadcastState() {
        if (!this.isBroadcasting) return;
        if (this._stateThrottleTimer !== null) return;

        if (this.stateThrottleDelay <= 0) {
            this.broadcastState();
            return;
        }

        this._stateThrottleTimer = setTimeout(() => {
            this._stateThrottleTimer = null;
            if (this.isBroadcasting) {
                this.broadcastState();
            }
        }, this.stateThrottleDelay);
    }

    /**
     * 別ウィンドウで監視コンソールを開く
     */
    openConsoleWindow(consoleUrl) {
        const targetUrl = consoleUrl || './inspector_console.html';
        if (typeof window !== 'undefined' && typeof window.open === 'function') {
            this.consoleWindow = window.open(
                targetUrl,
                'WebUICoreInspectorConsole',
                'width=960,height=760,resizable=yes,scrollbars=yes'
            );
        }
        return this.consoleWindow;
    }

    /**
     * ログおよび状態の送信
     */
    broadcastLog(category, data) {
        const entry = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toLocaleTimeString(),
            category: category,
            data: data
        };

        this.logs.push(entry);
        if (this.logs.length > this.maxLogCount) {
            this.logs.shift();
        }

        if (this.channel && this.isBroadcasting) {
            try {
                this.channel.postMessage({
                    type: 'INSPECTOR_LOG',
                    entry: entry
                });
            } catch (e) {}
        }
        return entry;
    }

    /**
     * 翻訳ログの配信
     */
    broadcastTranslationLog(data) {
        const entry = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toLocaleTimeString(),
            category: 'TRANSLATION',
            data: data
        };

        this.logs.push(entry);
        if (this.logs.length > this.maxLogCount) {
            this.logs.shift();
        }

        if (this.channel && this.isBroadcasting) {
            try {
                this.channel.postMessage({
                    type: 'TRANSLATION_LOG',
                    data: data,
                    entry: entry
                });
            } catch (e) {}
        }
        return entry;
    }

    /**
     * GKL 内部構造を含む現在の全体状態のスナップショット送信
     */
    broadcastState() {
        const situation = (this.core.gkl && typeof this.core.gkl.getSituation === 'function')
            ? this.core.gkl.getSituation()
            : (this.core.situationCache && typeof this.core.situationCache.getSituation === 'function'
                ? this.core.situationCache.getSituation()
                : null);

        const rawDriverStatus = (typeof this.core.getDriverDebugStatus === 'function') 
            ? this.core.getDriverDebugStatus() 
            : (this.core.driver && typeof this.core.driver.getDebugStatus === 'function' ? this.core.driver.getDebugStatus() : null);

        // イベントログの視認性を損なわないスリム要約表現
        const driverSummary = rawDriverStatus ? {
            state: rawDriverStatus.state,
            topLevel: Boolean(rawDriverStatus.isTopLevelTurn),
            canInterrupt: Boolean(rawDriverStatus.canAcceptSequenceInterruption),
            queueLen: rawDriverStatus.sequenceQueueLength || 0
        } : null;

        const dsm = (this.core.gkl && this.core.gkl.discoveryStateManager) || this.core.discoveryStateManager || null;
        const discoveriesData = dsm ? {
            discoveredCount: dsm.discoveredOnums ? dsm.discoveredOnums.size : 0,
            appearancesCount: dsm.appearanceMap ? dsm.appearanceMap.size : 0,
            isSynced: Boolean(dsm.isSynced)
        } : null;

        const silentSyncTracker = (this.core.gkl && this.core.gkl.silentSyncTracker) ? {
            totalCount: this.core.gkl.silentSyncTracker.totalCount,
            syncCounts: { ...this.core.gkl.silentSyncTracker.syncCounts },
            recentHistory: [...this.core.gkl.silentSyncTracker.recentHistory]
        } : null;

        const stateSnapshot = {
            state: this.core.state,
            promptCategory: this.core.currentPromptCategory,
            promptChoices: this.core.currentPromptChoices,
            hasActiveResolver: !!this.core.activeResolver,
            driverStatus: driverSummary,
            silentSyncStatus: silentSyncTracker,
            discoveries: discoveriesData,
            situation: situation || {}
        };

        if (this.channel && this.isBroadcasting) {
            try {
                this.channel.postMessage({
                    type: 'INSPECTOR_STATE_SNAPSHOT',
                    snapshot: stateSnapshot
                });
            } catch (e) {}
        }

        return stateSnapshot;
    }

    /**
     * 外部コンソールからのダイレクト注入メッセージを処理
     */
    _handleConsoleMessage(event) {
        if (!event || !event.data) return;
        const msg = event.data;

        if (msg.type === 'INJECT_RESPONSE') {
            if (typeof this.core.respond === 'function') {
                this.core.respond(msg.value);
            }
            this.broadcastLog('INJECT', `Responded with: ${JSON.stringify(msg.value)}`);
        } else if (msg.type === 'INJECT_ACTION') {
            if (typeof this.core.sendAction === 'function') {
                this.core.sendAction(msg.actionName);
            }
            this.broadcastLog('INJECT', `Action sent: ${msg.actionName}`);
        } else if (msg.type === 'REQUEST_SNAPSHOT') {
            this.broadcastState();
        } else if (msg.type === 'QUERY_KNOWLEDGE') {
            const ske = (this.core && this.core.gkl && this.core.gkl.structuredKnowledge) || (this.core && this.core.structuredKnowledge);
            let result = null;
            if (ske) {
                result = msg.entityType === 'ITEM'
                    ? ske.getItemKnowledge(msg.identifier, { translate: msg.translate !== false })
                    : ske.getMonsterKnowledge(msg.identifier, { translate: msg.translate !== false });
            }

            // ske で未検出の場合の静的ナレッジ (onum 検索等) フォールバック
            if (!result && (msg.entityType === 'ITEM' || !msg.entityType)) {
                let targetOnum = -1;
                if (typeof msg.identifier === 'number') {
                    targetOnum = msg.identifier;
                } else if (typeof msg.identifier === 'string' && /^\d+$/.test(msg.identifier.trim())) {
                    targetOnum = parseInt(msg.identifier.trim(), 10);
                }
                if (targetOnum >= 0 && OBJECT_KNOWLEDGE_MAP.has(targetOnum)) {
                    result = OBJECT_KNOWLEDGE_MAP.get(targetOnum);
                }
            }

            if (this.channel && this.isBroadcasting) {
                try {
                    this.channel.postMessage({
                        type: 'KNOWLEDGE_QUERY_RESULT',
                        query: msg,
                        result: result
                    });
                } catch (e) {}
            }
        }
    }

    _bindCoreEvents() {
        if (!this.core || typeof this.core.on !== 'function') return;

        // --- ライフサイクル / 状態遷移イベント ---
        this.core.on('stateChange', (payload) => {
            this.broadcastLog('EVENT:stateChange', {
                state: payload ? payload.state : this.core.state,
                oldState: payload ? payload.oldState : undefined
            });
            this.scheduleBroadcastState();
        });

        this.core.on('restarted', () => {
            this.broadcastLog('EVENT:restarted', {
                timestamp: Date.now()
            });
            this.scheduleBroadcastState();
        });

        this.core.on('map_cleared', () => {
            this.broadcastLog('EVENT:map_cleared', {});
        });

        this.core.on('inputResolved', () => {
            this.broadcastLog('EVENT:inputResolved', {});
        });

        // --- Core 高レベルイベントのバインド ---
        this.core.on('inputRequired', (payload) => {
            this.broadcastLog('EVENT:inputRequired', {
                inputType: payload ? payload.inputType : undefined,
                prompt: payload ? (payload.prompt || payload.rawPrompt) : undefined,
                title: payload ? payload.title : undefined,
                choicesHint: payload ? payload.choicesHint : undefined,
                optionsCount: payload && payload.options ? payload.options.length : 0
            });
            this.scheduleBroadcastState();
        });

        this.core.on('textWindowModal', (payload) => {
            this.broadcastLog('EVENT:textWindowModal', {
                windowId: payload ? payload.windowId : undefined,
                title: payload ? payload.title : undefined,
                linesCount: payload && payload.lines ? payload.lines.length : 0
            });
        });

        this.core.on('message', (msg) => {
            this.broadcastLog('EVENT:message', msg);
        });

        this.core.on('statusUpdate', (statusData) => {
            this.broadcastLog('EVENT:statusUpdate', {
                field: statusData ? statusData.field : undefined,
                value: statusData ? statusData.value : undefined
            });
            this.scheduleBroadcastState();
        });

        this.core.on('inventoryStateUpdated', () => {
            this.broadcastLog('EVENT:inventoryStateUpdated', {
                itemCount: (this.core.gkl && this.core.gkl.inventoryStateManager) ? this.core.gkl.inventoryStateManager.items.length : 0
            });
            this.scheduleBroadcastState();
        });

        this.core.on('skillsStateUpdated', () => {
            const skills = (this.core.gkl && this.core.gkl.skillStateManager) ? this.core.gkl.skillStateManager.getSkills() : [];
            const activeSkills = (this.core.gkl && this.core.gkl.skillStateManager) ? this.core.gkl.skillStateManager.getActiveSkills() : [];
            const enhanceable = skills.filter(s => s && s.canEnhance);
            this.broadcastLog('EVENT:skillsStateUpdated', {
                totalSkills: skills.length,
                activeSkills: activeSkills.length,
                enhanceableCount: enhanceable.length,
                enhanceableList: enhanceable.map(s => s.name)
            });
            this.scheduleBroadcastState();
        });

        this.core.on('spellsStateUpdated', () => {
            const spells = (this.core.gkl && this.core.gkl.spellStateManager) ? this.core.gkl.spellStateManager.getSpells() : [];
            this.broadcastLog('EVENT:spellsStateUpdated', {
                spellCount: spells.length,
                spells: spells.map(s => `${s.letter || '-'} - ${s.name} (Lv.${s.level ?? '?'}, 失敗率:${s.failRate ?? '?'})`)
            });
            this.scheduleBroadcastState();
        });

        const handleDiscoveriesUpdated = () => {
            const dsm = (this.core.gkl && this.core.gkl.discoveryStateManager) || this.core.discoveryStateManager;
            this.broadcastLog('EVENT:discoveriesStateUpdated', {
                discoveredCount: dsm && dsm.discoveredOnums ? dsm.discoveredOnums.size : 0,
                appearancesCount: dsm && dsm.appearanceMap ? dsm.appearanceMap.size : 0
            });
            this.scheduleBroadcastState();
        };
        this.core.on('discoveriesStateUpdated', handleDiscoveriesUpdated);

        this.core.on('attributesStateUpdated', () => {
            const attr = (this.core.gkl && this.core.gkl.attributeStateManager) ? this.core.gkl.attributeStateManager.getAttributes() : null;
            this.broadcastLog('EVENT:attributesStateUpdated', {
                resistances: attr ? attr.effectiveResistances : {}
            });
            this.scheduleBroadcastState();
        });

        this.core.on('clear_nhwindow', (data) => {
            this.broadcastLog('EVENT:clear_nhwindow', data);
        });

        this.core.on('cursor', (data) => {
            this.broadcastLog('EVENT:cursor', data);
        });

        this.core.on('soundEffect', (effect) => {
            this.broadcastLog('EVENT:soundEffect', effect);
        });

        this.core.on('translationLog', (data) => {
            this.broadcastTranslationLog(data);
        });

        this.core.on('messageUntranslated', (data) => {
            const entry = {
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                timestamp: new Date().toLocaleTimeString(),
                category: 'UNTRANSLATED',
                data: data
            };

            this.logs.push(entry);
            if (this.logs.length > this.maxLogCount) {
                this.logs.shift();
            }

            if (this.channel && this.isBroadcasting) {
                try {
                    this.channel.postMessage({
                        type: 'MESSAGE_UNTRANSLATED',
                        data: data,
                        entry: entry
                    });
                } catch (e) {}
            }
        });

        // --- Driver 低レベル Wasm イベントのバインド ---
        if (this.core.driver && typeof this.core.driver.on === 'function') {
            const driverEvents = ['display_nhwindow', 'display_file', 'yn_function', 'getpos', 'getch'];
            driverEvents.forEach(evt => {
                this.core.driver.on(evt, (data) => {
                    this.broadcastLog(`DRIVER:${evt}`, data ? { windowId: data.windowId, filename: data.filename, prompt: data.prompt } : {});
                });
            });
        }
    }

    stopBroadcast() {
        this.isBroadcasting = false;
        if (this._stateThrottleTimer !== null) {
            clearTimeout(this._stateThrottleTimer);
            this._stateThrottleTimer = null;
        }
        if (this.channel) {
            try {
                this.channel.close();
            } catch (e) {}
            this.channel = null;
        }
    }
}
