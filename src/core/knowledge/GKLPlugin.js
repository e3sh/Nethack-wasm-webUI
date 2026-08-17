import { StatusAccessor } from '../StatusAccessor.js';
import { AreaStateManager } from './AreaStateManager.js';
import { InventoryStateManager } from './InventoryStateManager.js';
import { SituationCache } from './SituationCache.js';
import { ContextActionEngine } from './ContextActionEngine.js';
import { RequestController } from './RequestController.js';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';
import { PROMPT_CATEGORY } from '../types.js';

/**
 * Game Knowledge Layer (GKL) 独立拡張プラグイン
 * WebUICore のパブリックイベント・サイレントクエリ基盤と連携し、
 * ゲーム状態追跡 (Inventory/Area/Status) およびコンテキストアクション推薦を一元管理する。
 */
export class GKLPlugin {
    /**
     * @param {Object} [options={}]
     * @param {InventoryStateManager} [options.inventoryStateManager]
     * @param {'vi'|'numpad'} [options.keyMode]
     */
    constructor(options = {}) {
        this.statusAccessor = new StatusAccessor();
        this.areaStateManager = new AreaStateManager();
        this.inventoryStateManager = options.inventoryStateManager || new InventoryStateManager();

        this.situationCache = new SituationCache(
            this.statusAccessor,
            this.inventoryStateManager,
            this.areaStateManager,
            ContextActionEngine
        );

        if (options.keyMode || options.numpad) {
            const mode = options.keyMode || (options.numpad ? 'numpad' : 'vi');
            this.areaStateManager.setKeyMode(mode);
        }

        this.structuredKnowledge = options.structuredKnowledgeEngine || new StructuredKnowledgeEngine({
            translationEngine: options.translationEngine || null
        });

        if (this.inventoryStateManager && typeof this.inventoryStateManager.setStructuredKnowledgeEngine === 'function') {
            this.inventoryStateManager.setStructuredKnowledgeEngine(this.structuredKnowledge);
        }

        this.core = null;
        this.requestController = null;
    }

    /**
     * WebUICore インスタンスへプラグインをアタッチし、イベントリスナーを接続
     * @param {Object} core - WebUICore インスタンス
     */
    attach(core) {
        if (!core) return;
        this.core = core;

        if (this.inventoryStateManager && typeof this.inventoryStateManager.setStructuredKnowledgeEngine === 'function') {
            this.inventoryStateManager.setStructuredKnowledgeEngine(this.structuredKnowledge);
        }

        if (core.translator && typeof this.structuredKnowledge.setTranslationEngine === 'function') {
            this.structuredKnowledge.setTranslationEngine(core.translator);
        }

        if (core.driver) {
            this.requestController = new RequestController(core.driver);
        }

        // WebUICore からのパブリックイベントにバインド
        this._bindCoreEvents(core);
    }

    /**
     * WebUICore のイベントバインディング
     * @private
     */
    _bindCoreEvents(core) {
        // 1. ユーザーアクション送出時のインベントリ dirty 化判定
        core.on('userActionSent', ({ sequence }) => {
            if (sequence && !this.isNonItemSequence(sequence)) {
                if (typeof this.inventoryStateManager.invalidate === 'function') {
                    this.inventoryStateManager.invalidate();
                } else {
                    this.inventoryStateManager.isSynced = false;
                }
            }
        });

        // 2. シーケンス実行完了・直近バッファ確定時のインベントリ自動更新
        core.on('sequenceFinished', ({ buffer }) => {
            if (buffer && typeof this.inventoryStateManager.updateFromSequenceBuffer === 'function') {
                this.inventoryStateManager.updateFromSequenceBuffer(buffer);
                core.emit('inventoryStateUpdated', this.inventoryStateManager);
            }
        });

        // 3. テキストメッセージ受信時の更新
        core.on('messageText', ({ text }) => {
            if (text && typeof this.inventoryStateManager.updateFromMessage === 'function') {
                const updated = this.inventoryStateManager.updateFromMessage(text);
                if (updated) {
                    core.emit('inventoryStateUpdated', this.inventoryStateManager);
                }
            }
        });

        // 4. カーソル位置・プレイヤー移動の同期
        const handlePlayerPosUpdate = (data) => {
            if (data && data.x !== undefined && data.y !== undefined) {
                if (data.x >= 0 && data.x < 80 && data.y >= 0 && data.y < 21) {
                    this.areaStateManager.updatePlayerPosition(data.x, data.y);
                }
            }
        };
        core.on('curs', handlePlayerPosUpdate);
        core.on('cursor', handlePlayerPosUpdate);

        // 5. ウィンドウ消去・マップリセットの同期
        core.on('clear_nhwindow', (data) => {
            if (data && (data.windowId === 2 || data.windowId === 0)) {
                this.areaStateManager.resetGrid();
            }
        });

        // 6. マップグリフ更新の同期
        core.on('print_glyph', (data) => {
            if (data) {
                const gi = data.glyphInfo || data;
                const glyphId = data.glyph !== undefined ? data.glyph : -1;
                this.areaStateManager.updateGlyph(data.x, data.y, glyphId, gi);
            }
        });

        // 7. ステータスフィールド更新の同期
        core.on('status_update', (data) => {
            if (data && data.field !== undefined && this.statusAccessor) {
                this.statusAccessor.updateField(data.field, data.value);
            }
        });
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
     * バックグラウンドで画面を一切汚さずに `i ` (インベントリ一覧) キーシーケンスをサイレント実行し、
     * 最新の所持品データを非同期で同期獲得する。
     * @param {Object} [options={}]
     * @returns {Promise<boolean>} 同期成功の有無
     */
    async syncInventorySilent(options = {}) {
        if (!this.core) return false;

        const { force = false } = options;

        // モーダルプロンプト表示中などのガード
        if (!force && this.core.currentPromptCategory) {
            const cat = this.core.currentPromptCategory;
            if (cat === PROMPT_CATEGORY.MENU ||
                cat === PROMPT_CATEGORY.DIRECTION || 
                cat === PROMPT_CATEGORY.YN || 
                cat === PROMPT_CATEGORY.TEXT || 
                cat === PROMPT_CATEGORY.ASKNAME || 
                cat === PROMPT_CATEGORY.FILE || 
                cat === PROMPT_CATEGORY.EXTCMD) {
                return false;
            }
        }

        // カウントプレフィックス待機中（「5」キー入力直後の移動キー待ち等）のガード
        const lastMsg = (this.core.lastPutstrText || '').toLowerCase();
        if (!force && (lastMsg.includes('プレフィックス') || lastMsg.includes('prefix') || (lastMsg.includes('count') && lastMsg.includes('command')))) {
            return false;
        }

        const buffer = await this.core.querySequenceSilent(['i', ' ', '\x1b'], options);
        if (this.inventoryStateManager && typeof this.inventoryStateManager.updateFromSequenceBuffer === 'function') {
            this.inventoryStateManager.updateFromSequenceBuffer(buffer);
            this.core.emit('inventoryStateUpdated', this.inventoryStateManager);
            return true;
        }
        return false;
    }

    /**
     * GKL の統合状況 (Situation: ステータス, 所持品, マップ, アクション等) を一括取得
     * @returns {Object}
     */
    getSituation() {
        if (this.situationCache) {
            return this.situationCache.getSituation();
        }
        return {
            status: this.getStatus(),
            inventory: { items: this.inventoryStateManager ? this.inventoryStateManager.items : [], isSynced: Boolean(this.inventoryStateManager && this.inventoryStateManager.isSynced) },
            area: this.areaStateManager ? this.areaStateManager.getAreaState() : {},
            tools: {},
            actions: []
        };
    }

    /**
     * 統一ステータスモデルの取得
     */
    getStatus() {
        return this.core ? this.core.getStatus() : this.statusAccessor.getStatus();
    }

    getSituationCache() {
        return this.situationCache;
    }

    getInventoryStateManager() {
        return this.inventoryStateManager;
    }

    getAreaStateManager() {
        return this.areaStateManager;
    }

    getStatusAccessor() {
        return this.statusAccessor;
    }

    /**
     * 現在のコンテキストにおける推奨アクション一覧を取得
     * @param {number} [radius=1]
     * @returns {Array<Object>}
     */
    getRecommendedActions(radius = 1) {
        const areaState = this.areaStateManager ? this.areaStateManager.getAreaState(undefined, undefined, radius) : {};
        return ContextActionEngine.generateActions(areaState, this.inventoryStateManager);
    }

    /**
     * ContextActionEngine が生成した推奨アクション (ContextAction) を安全に実行する。
     * @param {Object} action - recommended action オブジェクト
     * @param {Object} [options={}] - オプション
     */
    executeAction(action, options = {}) {
        if (!action || !this.core) return false;

        // 【1】明示的なキーシーケンス (keySequence) が指定されている場合は最優先でシーケンス実行
        if (Array.isArray(action.keySequence) && action.keySequence.length > 0) {
            return this.executeSequence([...action.keySequence], options);
        }

        // 【2】拡張コマンド (#chat, #loot, #untrap 等)
        if (action.extCmd) {
            if (this.inventoryStateManager) {
                this.inventoryStateManager.invalidate();
            }
            this.core.sendExtCommand(action.extCmd, action.directionKey, options);
            return true;
        }

        // 【3】方向キー付きコマンド
        const mainKey = action.charStr || action.key;
        const hasDirection = !!action.directionKey;
        const seq = (hasDirection && action.directionKey !== mainKey) ? [mainKey, action.directionKey] : null;

        if (seq && seq.length > 0) {
            return this.executeSequence(seq, options);
        }

        // 【4】単一コマンド (拾う ',', アイテム使用等を含む)
        if (this.inventoryStateManager && !this.isNonItemSequence([mainKey])) {
            this.inventoryStateManager.invalidate();
        }
        this.core.sendActionKey(mainKey);
        return true;
    }

    /**
     * キーシーケンスの実行
     * @param {Array<string>} sequence 
     * @param {Object} [options={}] 
     * @returns {Promise<boolean>}
     */
    async executeSequence(sequence, options = {}) {
        if (!Array.isArray(sequence) || sequence.length === 0 || !this.core) return false;

        let success = false;
        if (this.requestController && typeof this.requestController.executeSequence === 'function') {
            success = await this.requestController.executeSequence(sequence, options);
        } else if (this.core.driver && typeof this.core.driver.queueSequence === 'function') {
            this.core.driver.queueSequence(sequence, options);
            success = true;
        } else {
            sequence.forEach(ch => this.core.sendKey(ch, false, false, false, ch, true));
            success = true;
        }

        this.core.emit('userActionSent', { sequence });
        return success;
    }
}
