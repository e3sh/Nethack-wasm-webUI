import { StatusAccessor } from '../StatusAccessor.js';
import { AreaStateManager } from './AreaStateManager.js';
import { InventoryStateManager } from './InventoryStateManager.js';
import { SituationCache } from './SituationCache.js';
import { ContextActionEngine } from './ContextActionEngine.js';
import { RequestController } from './RequestController.js';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';
import { OnDemandLookService } from './OnDemandLookService.js';
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
        this.lookService = new OnDemandLookService();
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
            if (this.lookService) {
                this.lookService.setCore(core);
            }
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

    /**
     * 指定されたマップセル (x, y) に対し、自キャラ判別、Look不要判定、オンデマンドLook実行、および動的状態キャッシュ適用を
     * 全自動でカプセル処理した統一構造化ナレッジデータを返す
     * @param {{x: number, y: number}} targetPos 
     * @param {Object} [options={}]
     * @returns {Promise<Object|null>} 構造化ナレッジカードデータ
     */
    async inspectCellOnDemand(targetPos, options = {}) {
        if (!targetPos || typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number') {
            return null;
        }

        const asm = this.areaStateManager;
        const playerX = (asm && typeof asm.playerX === 'number') ? asm.playerX : 0;
        const playerY = (asm && typeof asm.playerY === 'number') ? asm.playerY : 0;

        // 👤 1. プレイヤー自身 (px === tx && py === ty) の場合: リアルタイム最新ステータスを含む構造化カードを即座に生成
        if (targetPos.x === playerX && targetPos.y === playerY) {
            const st = this.statusAccessor ? this.statusAccessor.getStatus() : {};
            const invManager = this.inventoryStateManager;
            const invItems = invManager ? (typeof invManager.getItems === 'function' ? invManager.getItems() : (invManager.items || [])) : [];
            const hpCur = (typeof st.hp === 'object' && st.hp !== null) ? (st.hp.current ?? st.hp.val ?? 0) : (st.hp ?? 0);
            const hpMax = (typeof st.hp === 'object' && st.hp !== null) ? (st.hp.max ?? st.hpmax ?? 0) : (st.hpmax ?? st.maxhp ?? 0);
            const hpStr = `${hpCur}/${hpMax}`;

            const pwCur = (typeof st.pw === 'object' && st.pw !== null) ? (st.pw.current ?? st.pw.val ?? 0) : (st.pw ?? 0);
            const pwMax = (typeof st.pw === 'object' && st.pw !== null) ? (st.pw.max ?? st.pwmax ?? 0) : (st.pwmax ?? st.maxpw ?? 0);
            const pwStr = `${pwCur}/${pwMax}`;

            const goldVal = (typeof st.gold === 'object' && st.gold !== null) ? (st.gold.amount ?? st.gold.current ?? st.gold.val ?? st.gold.gold ?? 0) : (st.gold ?? 0);

            const playerKnowledge = {
                name: st.name ? `${st.name} (${st.role || 'Hero'})` : '自分 (Player)',
                category: 'PLAYER',
                isPlayer: true,
                dangerLevel: 'NONE',
                dispositionStatus: 'PLAYER',
                stats: {
                    hd: `Lv.${st.level || 1}`,
                    ac: st.ac !== undefined ? `AC ${st.ac}` : 'AC 10',
                    speed: 'Self',
                    mr: 0,
                    hp: hpStr,
                    pw: pwStr,
                    gold: `${goldVal}zm`,
                    dlvl: `Dlvl:${st.dlvl || 1}`
                },
                statusConditions: st.conditions || [],
                inventoryCount: invItems.length,
                effectSummary: `操作中のプレイヤー自身です。HP: ${hpStr}, AC: ${st.ac ?? 10}, 所持金: ${goldVal}zm.`
            };
            return playerKnowledge;
        }

        // 🎯 2. プレイヤー以外のマス: AreaStateManager の 3レイヤーセルを参照
        const cell = asm?.grid?.[targetPos.y]?.[targetPos.x];
        const hasMonster = cell?.top && (cell.top.type === 'MONSTER' || cell.top.type === 'PET');

        // モンスターが存在せず、地形やアイテムのみの場合: ホバー・クリック問わず即座にナレッジを返却
        if (!hasMonster) {
            const targetEntity = cell?.middle || cell?.bottom;
            if (!targetEntity) return null;
            const knowledge = this.structuredKnowledge.getKnowledge(targetEntity, { translate: true });
            return knowledge ? { ...knowledge, isClickConfirmed: !options.isHover } : null;
        }

        // 🐉 モンスターが存在する場合: オンデマンド Look (;) を非同期実行して動的状態を確定獲得！
        let dynamicState = cell.top.dynamicState || null;
        // ホバー中 (isHover: true) は不要な Look 送信を行わず既存の確定キャッシュのみを適用
        if (!dynamicState && !options.isHover && this.lookService) {
            dynamicState = await this.lookService.executeLook({ x: playerX, y: playerY }, targetPos);
            cell.top.dynamicState = dynamicState;
        }

        const identifier = (typeof cell.top.glyph === 'number') ? cell.top.glyph : (cell.top.monOffset ?? cell.top);
        const data = this.structuredKnowledge.getMonsterKnowledge(identifier, {
            dynamicState,
            isPet: cell.top.type === 'PET',
            translate: true
        });

        return {
            ...data,
            isClickConfirmed: !!dynamicState
        };
    }
}
