import { ActionRecipeFactory } from '../../request/ActionRecipeFactory.js';
import { PROMPT_CATEGORY } from '../../types.js';

/**
 * SilentSyncCoordinator
 * バックグラウンドでのキー問い合わせ (querySequenceSilent) の排他・直列制御、
 * Direct Binding モードに応じたバイパス処理、および同期統計 (silentSyncTracker) を管理する。
 */
export class SilentSyncCoordinator {
    /**
     * @param {import('../GKLPlugin.js').GKLPlugin} plugin
     * @param {Object} [options={}]
     */
    constructor(plugin, options = {}) {
        this.plugin = plugin;
        this.directBindingMode = options.directBindingMode || 'auto';
        this._isSyncing = false;
        this._isSyncingDiscoveries = false;

        this.tracker = {
            totalCount: 0,
            shimCount: 0,
            macroCount: 0,
            syncCounts: {
                inventory: 0,
                spells: 0,
                skills: 0,
                attributes: 0,
                discoveries: 0
            },
            recentHistory: []
        };
    }

    /**
     * 動作モード ('auto' | 'strict' | 'fallback') の設定
     * @param {'auto'|'strict'|'fallback'} mode
     */
    setDirectBindingMode(mode) {
        if (mode === 'strict' || mode === 'fallback' || mode === 'auto') {
            this.directBindingMode = mode;
        } else {
            this.directBindingMode = 'auto';
        }
    }

    /**
     * サイレント同期の実行結果を統計・直近履歴に記録
     * @param {string} type - 同期種別 ('inventory' | 'spells' | 'skills' | 'attributes' | 'discoveries')
     * @param {boolean} changed - 状態変更があったかどうか
     * @param {number} durationMs - 処理時間 (ms)
     * @param {string} [method='MACRO'] - 同期方式 ('SHIM_DIRECT' | 'MACRO')
     */
    recordSilentSync(type, changed = false, durationMs = 0, method = 'MACRO') {
        if (!this.tracker) return;
        this.tracker.totalCount++;
        if (method === 'SHIM_DIRECT') {
            this.tracker.shimCount = (this.tracker.shimCount || 0) + 1;
        } else {
            this.tracker.macroCount = (this.tracker.macroCount || 0) + 1;
        }
        if (this.tracker.syncCounts[type] !== undefined) {
            this.tracker.syncCounts[type]++;
        }
        const entry = {
            timestamp: Date.now(),
            type,
            method,
            changed: Boolean(changed),
            durationMs
        };
        this.tracker.recentHistory.unshift(entry);
        if (this.tracker.recentHistory.length > 10) {
            this.tracker.recentHistory.pop();
        }
    }

    /**
     * 統計・状態の初期化
     */
    reset() {
        this._isSyncing = false;
        this._isSyncingDiscoveries = false;
        if (this.tracker) {
            this.tracker.totalCount = 0;
            this.tracker.syncCounts = {
                inventory: 0,
                spells: 0,
                skills: 0,
                attributes: 0,
                discoveries: 0
            };
            this.tracker.recentHistory = [];
        }
    }

    /**
     * 指定されたキーシーケンスが NetHack 上でゲームターンを消費するアクションか判定
     * @param {Array<string|number>} sequence
     * @returns {boolean}
     */
    isTurnConsumingSequence(sequence) {
        if (!Array.isArray(sequence) || sequence.length === 0) return false;

        // メニュー確定選択
        if (sequence.includes('MENU_SELECT')) return true;

        // プレフィックスキー単体（走る/回数指定など）はターンを消費しない
        const prefixKeys = new Set(['5', 'g', 'G', 'm', 'M', 'F', '_', 'n']);
        if (sequence.length === 1 && prefixKeys.has(String(sequence[0]))) {
            return false;
        }

        // 非ターン消費キー（ESC, 調査, ヘルプ, インベントリ一覧表示等）
        const nonTurnKeys = new Set([
            '27', '\x1b', 'ESC', 'Escape',
            ';', ':', '?', '/', '\\', '+', '^x', '^X', 'i', 'I', ')'
        ]);

        const first = String(sequence[0]).trim();
        if (nonTurnKeys.has(first)) return false;

        // 移動・待機・アイテム使用・攻撃等
        const turnKeys = new Set([
            'h', 'j', 'k', 'l', 'y', 'u', 'b', 'n',
            'H', 'J', 'K', 'L', 'Y', 'U', 'B', 'N',
            '1', '2', '3', '4', '6', '7', '8', '9',
            '.', 's', '<', '>',
            'a', 'e', 'q', 'r', 'w', 'W', 'T', 'z', 'Z', 'P', 'R', 'd', 'D', ',', 't', 'f', 'C'
        ]);

        if (turnKeys.has(first) || first.startsWith('DIR_')) {
            return true;
        }

        return true;
    }

    /**
     * 指定されたキーシーケンスが純粋な移動・方向指定・カウント入力等の「所持品に影響しない操作」か判定
     * @param {Array<string|number>} sequence
     * @returns {boolean}
     */
    isNonItemSequence(sequence) {
        if (!Array.isArray(sequence) || sequence.length === 0) return false;

        const nonItemKeys = new Set([
            'k', 'j', 'h', 'l', 'y', 'u', 'b', 'n',
            'K', 'J', 'H', 'L', 'Y', 'U', 'B', 'N',
            '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '_', '<', '>',
            '/', ';', ':', '^', '\\', '?', 'm', 'M',
            's', '\x10', '\x12', 'v', 'V', 'O', '\x0f',
            'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
            'Up', 'Down', 'Left', 'Right'
        ]);

        return sequence.every(token => {
            if (typeof token !== 'string' && typeof token !== 'number') return false;
            const strToken = String(token).trim();
            if (!strToken) return false;

            if (nonItemKeys.has(strToken)) return true;
            if (strToken.startsWith('DIR_')) return true;
            if (/^\d+$/.test(strToken)) return true;

            return false;
        });
    }

    /**
     * 指定されたキーシーケンスが習得魔法状態（詠唱失敗率、忘却ターン、新規習得等）に影響を及ぼしうるか判定
     * @param {Array<string|number>} sequence
     * @returns {boolean}
     */
    isSpellAffectingSequence(sequence) {
        if (!Array.isArray(sequence) || sequence.length === 0) return false;
        const spellKeys = new Set(['Z', 'r', '+', '#cast', 'cast']);
        return sequence.some(token => {
            if (typeof token === 'string') {
                return spellKeys.has(token) || token.startsWith('Z') || token.startsWith('#cast') || token.startsWith('cast');
            }
            return false;
        });
    }

    /**
     * 未同期ステート（所持品・ステータス属性・魔法・スキル等）が存在するか判定する
     * @returns {boolean}
     */
    hasPendingSync() {
        const p = this.plugin;
        return Boolean(
            (p.inventoryStateManager && !p.inventoryStateManager.isSynced) ||
            (p.attributeStateManager && !p.attributeStateManager.isSynced) ||
            (p.spellStateManager && !p.spellStateManager.isSynced) ||
            (p.skillStateManager && !p.skillStateManager.isSynced)
        );
    }

    /**
     * 未同期状態のステート（所持品・魔法・スキル等）を検知し、直列かつ安全にサイレント同期を実行する。
     * @param {Object} [options={}]
     * @returns {Promise<boolean>}
     */
    async syncPendingStateSilent(options = {}) {
        const p = this.plugin;
        if (this._isSyncing || !p.core) return false;
        if (p.core.isPendingPrefix) return false;
        this._isSyncing = true;
        try {
            if (p.inventoryStateManager && !p.inventoryStateManager.isSynced) {
                await p.syncInventorySilent(options);
            }
            if (p.attributeStateManager && !p.attributeStateManager.isSynced) {
                await p.syncAttributesSilent({ force: true, ...options });
            }
            if (p.spellStateManager && !p.spellStateManager.isSynced) {
                await p.syncSpellsSilent(options);
            }
            if (p.skillStateManager && !p.skillStateManager.isSynced) {
                await p.syncSkillsSilent(options);
            }
            return true;
        } catch (e) {
            return false;
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * 対話プロンプト・テレポート先指定・ターゲティング待機中かどうかを判定
     * @param {boolean} [force=false]
     * @returns {boolean}
     */
    isPromptOrTargetingActive(force = false) {
        const core = this.plugin?.core;
        if (force || !core) return false;

        if (core.currentPromptCategory) {
            const cat = core.currentPromptCategory;
            if (cat === PROMPT_CATEGORY.MENU ||
                cat === PROMPT_CATEGORY.DIRECTION ||
                cat === PROMPT_CATEGORY.YN ||
                cat === PROMPT_CATEGORY.TEXT ||
                cat === PROMPT_CATEGORY.ASKNAME ||
                cat === PROMPT_CATEGORY.FILE ||
                cat === PROMPT_CATEGORY.EXTCMD) {
                return true;
            }
        }

        const recentMessages = [
            core.lastPutstrText || '',
            core.lastRawMessageText || '',
            (core.driver && core.driver.lastEmittedMessage) || ''
        ].join(' ').toLowerCase();

        if (recentMessages.includes('プレフィックス') ||
            recentMessages.includes('prefix') ||
            (recentMessages.includes('count') && recentMessages.includes('command'))) {
            return true;
        }

        if (recentMessages.includes('where do you want to') ||
            recentMessages.includes('desired position') ||
            recentMessages.includes('in what direction') ||
            recentMessages.includes('which way') ||
            recentMessages.includes('どこにテレポート') ||
            recentMessages.includes('どこにジャンプ') ||
            recentMessages.includes('テレポート') ||
            recentMessages.includes('どの方向')) {
            return true;
        }

        return false;
    }

    /**
     * バックグラウンドで画面を一切汚さずに `i ` (インベントリ一覧) キーシーケンスをサイレント実行し、
     * 最新の所持品データを非同期で同期獲得する。
     * @param {Object} [options={}]
     * @returns {Promise<boolean>} 同期成功の有無
     */
    async syncInventorySilent(options = {}) {
        const p = this.plugin;
        if (!p.core) return false;
        if (p.core.isPendingPrefix) return false;

        const { force = false } = options;

        if (p._isPromptOrTargetingActive(force)) {
            return false;
        }

        const startTime = Date.now();
        const mode = p.directBindingMode || this.directBindingMode || 'auto';

        // 🎯 Direct Memory Binding: Wasm メモリ直結が利用可能な場合はキー送信マクロをバイパス (Stage 8.2)
        if (mode !== 'fallback' && p.inventoryStateManager && p.inventoryStateManager.isDirectBindingAvailable) {
            if (p.wasmDirectBindingService && p.wasmDirectBindingService.bridge && !p.wasmDirectBindingService.hasLiveMemory) {
                await p.wasmDirectBindingService.syncFromWorkerBridge({ syncInventory: true, syncDiscoveries: true });
            }
            if (p.discoveryStateManager && typeof p.discoveryStateManager.syncWithLiveMemory === 'function' && p.wasmDirectBindingService) {
                const discChanged = p.discoveryStateManager.syncWithLiveMemory(p.wasmDirectBindingService);
                if (discChanged) {
                    p.core.emit('discoveriesStateUpdated', p.discoveryStateManager);
                }
            }
            const changed = p.inventoryStateManager.syncFromDirectBinding();
            const durationMs = Date.now() - startTime;
            p._recordSilentSync('inventory', changed, durationMs, 'SHIM_DIRECT');
            if (changed || force) {
                p.core.emit('inventoryStateUpdated', p.inventoryStateManager);
            }
            return true;
        }

        // strict モード時はフォールバック（キー送信マクロ）を完全遮断！ (Stage 8.2-B)
        if (mode === 'strict') {
            console.warn('[GKLPlugin] syncInventorySilent: Shim binding unavailable under strict mode. Fallback macro blocked.');
            return false;
        }

        // マクロ同期前にも可能な限りメモリの最新識別状態を同期
        if (p.discoveryStateManager && typeof p.discoveryStateManager.syncWithLiveMemory === 'function' && p.wasmDirectBindingService) {
            const discChanged = p.discoveryStateManager.syncWithLiveMemory(p.wasmDirectBindingService);
            if (discChanged) {
                p.core.emit('discoveriesStateUpdated', p.discoveryStateManager);
            }
        }

        const buffer = await p.core.querySequenceSilent(['i', ' ', '\x1b'], { syncType: 'inventory', ...options });
        if (p.inventoryStateManager && typeof p.inventoryStateManager.updateFromSequenceBuffer === 'function') {
            const changed = p.inventoryStateManager.updateFromSequenceBuffer(buffer);
            const durationMs = Date.now() - startTime;
            p._recordSilentSync('inventory', changed, durationMs, 'MACRO');
            if (changed || force) {
                p.core.emit('inventoryStateUpdated', p.inventoryStateManager);
            }
            return true;
        }
        return false;
    }

    /**
     * バックグラウンドで画面を一切汚さずに `+` (習得魔法一覧) キーシーケンスをサイレント実行し、
     * 最新の魔法データを非同期で同期獲得する。
     * @param {Object} [options={}]
     * @returns {Promise<boolean>} 同期成功の有無
     */
    async syncSpellsSilent(options = {}) {
        const p = this.plugin;
        if (!p.core) return false;
        if (p.core.isPendingPrefix) return false;

        const { force = false } = options;

        if (p._isPromptOrTargetingActive(force)) {
            return false;
        }

        const startTime = Date.now();
        const buffer = await p.core.querySequenceSilent(['+', ' ', '\x1b'], { syncType: 'spells', ...options });
        if (p.spellStateManager && typeof p.spellStateManager.updateFromSequenceBuffer === 'function') {
            const changed = p.spellStateManager.updateFromSequenceBuffer(buffer, true);
            const durationMs = Date.now() - startTime;
            p._recordSilentSync('spells', changed !== false, durationMs);
            p.core.emit('spellsStateUpdated', p.spellStateManager);
            return true;
        }
        return false;
    }

    /**
     * バックグラウンドで画面を一切汚さずに `^X` (#attributes 属性・耐性一覧) キーシーケンスをサイレント実行し、
     * 最新の内因性耐性および装備品耐性を非同期で同期獲得する。
     * @param {Object} [options={}]
     * @returns {Promise<boolean>} 同期成功の有無
     */
    async syncAttributesSilent(options = {}) {
        const p = this.plugin;
        if (!p.core) return false;
        if (p.core.isPendingPrefix) return false;

        const { force = false } = options;

        if (p._isPromptOrTargetingActive(force)) {
            return false;
        }

        // '\x18' is Ctrl+X (^X)
        const startTime = Date.now();
        const buffer = await p.core.querySequenceSilent(['\x18', ' ', '\x1b'], { syncType: 'attributes', ...options });
        if (p.attributeStateManager) {
            if (typeof p.attributeStateManager.updateFromSequenceBuffer === 'function') {
                p.attributeStateManager.updateFromSequenceBuffer(buffer, true);
            }
            if (p.inventoryStateManager && typeof p.attributeStateManager.updateExtrinsicsFromInventory === 'function') {
                p.attributeStateManager.updateExtrinsicsFromInventory(p.inventoryStateManager.items);
            }
            const durationMs = Date.now() - startTime;
            p._recordSilentSync('attributes', true, durationMs);
            p.core.emit('attributesStateUpdated', p.attributeStateManager);
            return true;
        }
        return false;
    }

    /**
     * バックグラウンドで安全に `#enhance` シーケンスを実行し、スキル熟練度データを同期獲得
     * @param {Object} [options={}]
     * @returns {Promise<boolean>} 同期成功の有無
     */
    async syncSkillsSilent(options = {}) {
        const p = this.plugin;
        if (!p.core) return false;
        if (p.core.isPendingPrefix) return false;

        const { force = false } = options;

        if (p._isPromptOrTargetingActive(force)) {
            return false;
        }

        const startTime = Date.now();
        const buffer = await p.core.querySequenceSilent(['#', 'enhance', ' ', '\x1b'], { syncType: 'skills', ...options });
        if (p.skillStateManager && typeof p.skillStateManager.updateFromSequenceBuffer === 'function') {
            const changed = p.skillStateManager.updateFromSequenceBuffer(buffer, true);
            const durationMs = Date.now() - startTime;
            p._recordSilentSync('skills', changed !== false, durationMs);
            p.core.emit('skillsStateUpdated', p.skillStateManager);
            return true;
        }
        return false;
    }

    /**
     * ゲーム初期化時や同期ボタン押下時の一括直列同期
     * @param {Object} [options={}]
     */
    async syncAllSilent(options = {}) {
        const p = this.plugin;
        await p.syncInventorySilent(options);

        if (p.attributeStateManager && !p.attributeStateManager.isSynced) {
            await p.syncAttributesSilent({ force: true, ...options });
        }

        if (p.spellStateManager && !p.spellStateManager.isSynced) {
            await p.syncSpellsSilent(options);
        }

        if (p.skillStateManager && !p.skillStateManager.isSynced) {
            await p.syncSkillsSilent(options);
        }
    }

    /**
     * 発見済みアイテムリスト (Discoveries `\`) のバックグラウンド自動同期・リハイドレーション
     * @returns {Promise<boolean>}
     */
    async syncDiscoveriesSilent() {
        const p = this.plugin;
        if (!p.core || this._isSyncingDiscoveries) return false;
        this._isSyncingDiscoveries = true;

        const startTime = Date.now();
        try {
            let buffer = null;
            if (typeof p.core.querySequenceSilent === 'function') {
                const recipe = ActionRecipeFactory.createDiscoveriesSyncRecipe();
                const res = await p.core.querySequenceSilent(recipe, {
                    syncType: 'discoveries',
                    suppressPrompts: true,
                    isSilentSync: true
                });
                buffer = Array.isArray(res) ? res : (res && res.buffer ? res.buffer : null);
            } else if (typeof p.core.silentQuery === 'function') {
                buffer = await p.core.silentQuery(['\\', ' ', ' ', ' ', ' ', ' ', '\x1b']);
            } else if (p.core.driver && typeof p.core.driver.queueSequence === 'function') {
                buffer = await p.core.driver.queueSequence(['\\', ' ', ' ', ' ', ' ', ' ', '\x1b'], {
                    silent: true,
                    suppressPrompts: true,
                    isSilentSync: true
                });
            }

            if (buffer && p.discoveryStateManager) {
                p.discoveryStateManager.updateFromDiscoveriesText(buffer);
                p._recordSilentSync('discoveries', true, Date.now() - startTime);
                p.core.emit('discoveriesStateUpdated', p.discoveryStateManager);
                return true;
            }
        } catch (e) {
            console.warn('[GKLPlugin] syncDiscoveriesSilent error:', e);
        } finally {
            this._isSyncingDiscoveries = false;
        }
        return false;
    }
}
