import { StatusAccessor } from '../StatusAccessor.js';
import { AreaStateManager } from './AreaStateManager.js';
import { InventoryStateManager } from './InventoryStateManager.js';
import { SpellStateManager } from './SpellStateManager.js';
import { SkillStateManager } from './SkillStateManager.js';
import { AttributeStateManager } from './AttributeStateManager.js';
import { SituationCache } from './SituationCache.js';
import { ContextActionEngine } from './ContextActionEngine.js';
import { RequestController } from './RequestController.js';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';
import { OnDemandLookService } from './OnDemandLookService.js';
import { PROMPT_CATEGORY } from '../types.js';

/**
 * Game Knowledge Layer (GKL) 独立拡張プラグイン
 * WebUICore のパブリックイベント・サイレントクエリ基盤と連携し、
 * ゲーム状態追跡 (Inventory/Area/Status/Spells/Skills/Attributes) およびコンテキストアクション推薦を一元管理する。
 */
export class GKLPlugin {
    /**
     * @param {Object} [options={}]
     * @param {InventoryStateManager} [options.inventoryStateManager]
     * @param {SpellStateManager} [options.spellStateManager]
     * @param {SkillStateManager} [options.skillStateManager]
     * @param {AttributeStateManager} [options.attributeStateManager]
     * @param {'vi'|'numpad'} [options.keyMode]
     */
    constructor(options = {}) {
        this.statusAccessor = new StatusAccessor();
        this.areaStateManager = new AreaStateManager();
        this.inventoryStateManager = options.inventoryStateManager || new InventoryStateManager();
        this.spellStateManager = options.spellStateManager || new SpellStateManager();
        this.skillStateManager = options.skillStateManager || new SkillStateManager();
        this.attributeStateManager = options.attributeStateManager || new AttributeStateManager();

        this.situationCache = new SituationCache(
            this.statusAccessor,
            this.inventoryStateManager,
            this.areaStateManager,
            ContextActionEngine,
            this.spellStateManager,
            this.attributeStateManager,
            this.skillStateManager
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
        if (this.inventoryStateManager && typeof this.inventoryStateManager.setSkillStateManager === 'function') {
            this.inventoryStateManager.setSkillStateManager(this.skillStateManager);
        }

        this.core = null;
        this.requestController = null;
        this.lookService = new OnDemandLookService();
        this._isSyncing = false;
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
        // 1. ユーザーアクション送出時のインベントリ・魔法 dirty 化判定
        core.on('userActionSent', ({ sequence }) => {
            if (sequence && !this.isNonItemSequence(sequence)) {
                if (typeof this.inventoryStateManager.invalidate === 'function') {
                    this.inventoryStateManager.invalidate();
                } else {
                    this.inventoryStateManager.isSynced = false;
                }
                if (this.spellStateManager && typeof this.spellStateManager.invalidate === 'function') {
                    this.spellStateManager.invalidate();
                }
            }
        });

        // 2. テキストメッセージ受信時の更新
        core.on('messageText', ({ text }) => {
            if (text) {
                if (typeof this.inventoryStateManager.updateFromMessage === 'function') {
                    const updated = this.inventoryStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('inventoryStateUpdated', this.inventoryStateManager);
                    }
                }
                if (this.spellStateManager && typeof this.spellStateManager.updateFromMessage === 'function') {
                    this.spellStateManager.updateFromMessage(text);
                }
                if (this.skillStateManager && typeof this.skillStateManager.updateFromMessage === 'function') {
                    this.skillStateManager.updateFromMessage(text);
                }
                if (this.attributeStateManager && typeof this.attributeStateManager.updateFromMessage === 'function') {
                    this.attributeStateManager.updateFromMessage(text);
                }
            }
        });

        // 3.1. インベントリ更新時の外因性耐性 (Extrinsics) 自動再計算
        core.on('inventoryStateUpdated', (invMgr) => {
            if (this.attributeStateManager && typeof this.attributeStateManager.updateExtrinsicsFromInventory === 'function') {
                const items = invMgr ? (invMgr.items || []) : (this.inventoryStateManager ? this.inventoryStateManager.items : []);
                this.attributeStateManager.updateExtrinsicsFromInventory(items);
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
                // 経験レベル (level / exp) の変動時にも魔法失敗率やスキル向上可能状態が変化するため再同期
                if (data.field === 'level' || data.field === 'exp_level') {
                    if (this.spellStateManager && typeof this.spellStateManager.invalidate === 'function') {
                        this.spellStateManager.invalidate();
                    }
                    if (this.skillStateManager && typeof this.skillStateManager.invalidate === 'function') {
                        this.skillStateManager.invalidate();
                    }
                }
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
     * 未同期状態のステート（所持品・魔法・スキル等）を検知し、直列かつ安全にサイレント同期を実行する。
     * @param {Object} [options={}]
     * @returns {Promise<boolean>}
     */
    async syncPendingStateSilent(options = {}) {
        if (this._isSyncing || !this.core) return false;
        this._isSyncing = true;
        try {
            if (this.inventoryStateManager && !this.inventoryStateManager.isSynced) {
                await this.syncInventorySilent(options);
            }
            if (this.spellStateManager && !this.spellStateManager.isSynced) {
                await this.syncSpellsSilent(options);
            }
            if (this.skillStateManager && !this.skillStateManager.isSynced) {
                await this.syncSkillsSilent(options);
            }
            return true;
        } catch (e) {
            return false;
        } finally {
            this._isSyncing = false;
        }
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

        const buffer = await this.core.querySequenceSilent(['i', ' ', '\x1b'], { syncType: 'inventory', ...options });
        if (this.inventoryStateManager && typeof this.inventoryStateManager.updateFromSequenceBuffer === 'function') {
            this.inventoryStateManager.updateFromSequenceBuffer(buffer);
            this.core.emit('inventoryStateUpdated', this.inventoryStateManager);
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
        if (!this.core) return false;

        const { force = false } = options;

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

        const lastMsg = (this.core.lastPutstrText || '').toLowerCase();
        if (!force && (lastMsg.includes('プレフィックス') || lastMsg.includes('prefix') || (lastMsg.includes('count') && lastMsg.includes('command')))) {
            return false;
        }

        const buffer = await this.core.querySequenceSilent(['+', ' ', '\x1b'], { syncType: 'spells', ...options });
        if (this.spellStateManager && typeof this.spellStateManager.updateFromSequenceBuffer === 'function') {
            this.spellStateManager.updateFromSequenceBuffer(buffer, true);
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
        if (!this.core) return false;

        const { force = false } = options;

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

        const lastMsg = (this.core.lastPutstrText || '').toLowerCase();
        if (!force && (lastMsg.includes('プレフィックス') || lastMsg.includes('prefix') || (lastMsg.includes('count') && lastMsg.includes('command')))) {
            return false;
        }

        // '\x18' is Ctrl+X (^X)
        const buffer = await this.core.querySequenceSilent(['\x18', ' ', '\x1b'], { syncType: 'attributes', ...options });
        if (this.attributeStateManager) {
            if (typeof this.attributeStateManager.updateFromSequenceBuffer === 'function') {
                this.attributeStateManager.updateFromSequenceBuffer(buffer, true);
            }
            if (this.inventoryStateManager && typeof this.attributeStateManager.updateExtrinsicsFromInventory === 'function') {
                this.attributeStateManager.updateExtrinsicsFromInventory(this.inventoryStateManager.items);
            }
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
        if (!this.core) return false;

        const { force = false } = options;

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

        const lastMsg = (this.core.lastPutstrText || '').toLowerCase();
        if (!force && (lastMsg.includes('プレフィックス') || lastMsg.includes('prefix') || (lastMsg.includes('count') && lastMsg.includes('command')))) {
            return false;
        }

        const buffer = await this.core.querySequenceSilent(['#', 'enhance', ' ', '\x1b'], { syncType: 'skills', ...options });
        if (this.skillStateManager && typeof this.skillStateManager.updateFromSequenceBuffer === 'function') {
            this.skillStateManager.updateFromSequenceBuffer(buffer, true);
            return true;
        }
        return false;
    }

    /**
     * ゲーム初期化時や同期ボタン押下時の一括直列同期
     * 先行タスクキャンセルを防止するため直列に await 実行
     * @param {Object} [options={}]
     */
    async syncAllSilent(options = {}) {
        // 1. インベントリ取得 (完了するまで await)
        await this.syncInventorySilent(options);
        
        // 2. 続けて魔法一覧取得 (直列実行)
        if (this.spellStateManager && !this.spellStateManager.isSynced) {
            await this.syncSpellsSilent(options);
        }

        // 3. 続けてスキル一覧取得 (直列実行)
        if (this.skillStateManager && !this.skillStateManager.isSynced) {
            await this.syncSkillsSilent(options);
        }
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
            spells: { items: this.spellStateManager ? this.spellStateManager.spells : [], isSynced: Boolean(this.spellStateManager && this.spellStateManager.isSynced) },
            skills: {
                items: this.skillStateManager ? this.skillStateManager.getSkills() : [],
                activeItems: this.skillStateManager ? this.skillStateManager.getActiveSkills() : [],
                isSynced: Boolean(this.skillStateManager && this.skillStateManager.isSynced)
            },
            attributes: this.attributeStateManager ? this.attributeStateManager.getAttributes() : {},
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

    getSpellStateManager() {
        return this.spellStateManager;
    }

    getSkillStateManager() {
        return this.skillStateManager;
    }

    getAttributeStateManager() {
        return this.attributeStateManager;
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
        return ContextActionEngine.generateActions(areaState, this.inventoryStateManager, this.skillStateManager);
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

    /**
     * 指定されたマップセル (x, y) への安全な自動移動 (Click-to-Move / Auto-Travel) を実行する
     * @param {{x: number, y: number}} targetPos - 目的地座標
     * @param {Object} [options={}] - { avoidMonsters: true }
     * @returns {Promise<boolean>} 移動シーケンス実行の成功の有無
     */
    async travelTo(targetPos, options = {}) {
        if (!targetPos || typeof targetPos.x !== 'number' || typeof targetPos.y !== 'number' || !this.core) {
            return false;
        }

        const gx = targetPos.x;
        const gy = targetPos.y;
        if (gx < 0 || gx >= 80 || gy < 0 || gy >= 24) return false;

        const asm = this.areaStateManager;
        const px = (asm && typeof asm.playerX === 'number') ? asm.playerX : 0;
        const py = (asm && typeof asm.playerY === 'number') ? asm.playerY : 0;

        const dx = gx - px;
        const dy = gy - py;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));

        if (dist === 0) return false; // 自キャラマスは移動しない

        // 1. セル情報・ナレッジ情報の確認
        const cardData = await this.inspectCellOnDemand({ x: gx, y: gy }, { isHover: true });

        // 2. モンスター安全保護 (avoidMonsters が true の場合はモンスターマスへの移動を防止)
        const avoidMonsters = options.avoidMonsters !== undefined ? options.avoidMonsters : true;
        const isMonster = cardData && (cardData.dangerLevel || cardData.category === 'MONSTER' || cardData.dispositionStatus);
        if (avoidMonsters && isMonster) {
            return false;
        }

        // 3. 通行可能性・アイテム判定
        const areaState = asm ? asm.getAreaState() : null;
        const grid = areaState ? areaState.grid : null;
        const cell = (grid && grid[gy]) ? grid[gy][gx] : null;

        const isItemOrCorpse = cardData && (
            cardData.category === 'WEAPON' || cardData.category === 'ARMOR' ||
            cardData.category === 'RING' || cardData.category === 'AMULET' ||
            cardData.category === 'CONTAINER' || cardData.category === 'TOOL' ||
            cardData.category === 'FOOD' || cardData.category === 'POTION' ||
            cardData.category === 'SCROLL' || cardData.category === 'SPELLBOOK' ||
            cardData.category === 'WAND' || cardData.category === 'COIN' ||
            cardData.category === 'GEM' || cardData.category === 'GOLD' ||
            cardData.category === 'FOOD' || cardData.category === 'CORPSE' ||
            cardData.category === 'BODY' || cardData.category === 'ITEM' ||
            cardData.category === 'OTHER' || (cell && cell.middle)
        );

        const isWallOrVoid = cell && cell.bottom && (
            cell.bottom.isWall || cell.bottom.rawGlyph >= 9622
        );

        if (isWallOrVoid && !isItemOrCorpse) return false;

        // 方向トークンマップ
        const dirTokenMap = {
            '-1,-1': 'DIR_NW', '0,-1': 'DIR_N', '1,-1': 'DIR_NE',
            '-1,0':  'DIR_W',                   '1,0':  'DIR_E',
            '-1,1':  'DIR_SW', '0,1':  'DIR_S', '1,1':  'DIR_SE'
        };

        // 4. 移動実行
        const travelOptions = {
            isSilentSync: true,
            suppressPrompts: true,
            ...options
        };

        if (dist === 1) {
            // 隣接8マス移動
            const token = dirTokenMap[`${dx},${dy}`];
            if (token) {
                return this.executeSequence([token], travelOptions);
            }
        } else if (dist > 1) {
            // 遠隔 Auto-Travel シーケンス一括投入
            // '_': トラベル開始 ➔ '@': 自キャラ位置へリセット ➔ DIR_*: 相対移動 ➔ '.': 確定
            const seqTokens = ['_', '@'];
            let curX = px;
            let curY = py;
            while (curX !== gx || curY !== gy) {
                const stepX = Math.sign(gx - curX);
                const stepY = Math.sign(gy - curY);

                const token = dirTokenMap[`${stepX},${stepY}`];
                if (token) {
                    seqTokens.push(token);
                    curX += stepX;
                    curY += stepY;
                } else {
                    break;
                }
            }
            seqTokens.push('.');

            return this.executeSequence(seqTokens, travelOptions);
        }

        return false;
    }
}
