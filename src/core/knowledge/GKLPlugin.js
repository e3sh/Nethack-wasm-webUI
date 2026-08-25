import { StatusAccessor } from '../StatusAccessor.js';
import { AreaStateManager } from './AreaStateManager.js';
import { InventoryStateManager } from './InventoryStateManager.js';
import { SpellStateManager } from './SpellStateManager.js';
import { SkillStateManager } from './SkillStateManager.js';
import { AttributeStateManager } from './AttributeStateManager.js';
import { SituationCache } from './SituationCache.js';
import { ContextActionEngine } from './ContextActionEngine.js';
import { TacticalAdvisor } from './TacticalAdvisor.js';
import { RequestController } from './RequestController.js';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';
import { OnDemandLookService } from './OnDemandLookService.js';
import { DiscoveryStateManager } from './DiscoveryStateManager.js';
import { MonsterTracker } from './MonsterTracker.js';
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
     * @param {MonsterTracker} [options.monsterTracker]
     * @param {'vi'|'numpad'} [options.keyMode]
     * @param {'ja'|'en'} [options.language]
     */
    constructor(options = {}) {
        this.statusAccessor = new StatusAccessor();
        this.monsterTracker = options.monsterTracker || new MonsterTracker();
        this.areaStateManager = new AreaStateManager(80, 24, this.monsterTracker);
        this.inventoryStateManager = options.inventoryStateManager || new InventoryStateManager();
        this.spellStateManager = options.spellStateManager || new SpellStateManager();
        this.skillStateManager = options.skillStateManager || new SkillStateManager();
        this.attributeStateManager = options.attributeStateManager || new AttributeStateManager();

        this.language = options.language || 'ja';

        this.situationCache = new SituationCache(
            this.statusAccessor,
            this.inventoryStateManager,
            this.areaStateManager,
            ContextActionEngine,
            this.spellStateManager,
            this.attributeStateManager,
            this.skillStateManager,
            TacticalAdvisor,
            { language: this.language }
        );

        if (options.keyMode || options.numpad) {
            const mode = options.keyMode || (options.numpad ? 'numpad' : 'vi');
            this.areaStateManager.setKeyMode(mode);
        }

        this.discoveryStateManager = options.discoveryStateManager || new DiscoveryStateManager();

        this.structuredKnowledge = options.structuredKnowledgeEngine || new StructuredKnowledgeEngine({
            translationEngine: options.translationEngine || null,
            discoveryStateManager: this.discoveryStateManager,
            language: this.language
        });

        if (this.structuredKnowledge && typeof this.structuredKnowledge.setDiscoveryStateManager === 'function') {
            this.structuredKnowledge.setDiscoveryStateManager(this.discoveryStateManager);
        }

        if (this.inventoryStateManager && typeof this.inventoryStateManager.setStructuredKnowledgeEngine === 'function') {
            this.inventoryStateManager.setStructuredKnowledgeEngine(this.structuredKnowledge);
        }
        if (this.inventoryStateManager && typeof this.inventoryStateManager.setSkillStateManager === 'function') {
            this.inventoryStateManager.setSkillStateManager(this.skillStateManager);
        }

        this.core = null;
        this.requestController = null;
        this.lookService = new OnDemandLookService();
        this._coreListeners = [];
    }

    /**
     * 所持品・魔法・スキル・耐性など全マネージャーのキャッシュを一括無効化
     */
    invalidateAllCaches() {
        if (this.inventoryStateManager && typeof this.inventoryStateManager.invalidate === 'function') {
            this.inventoryStateManager.invalidate();
        }
        if (this.spellStateManager && typeof this.spellStateManager.invalidate === 'function') {
            this.spellStateManager.invalidate();
        }
        if (this.skillStateManager && typeof this.skillStateManager.invalidate === 'function') {
            this.skillStateManager.invalidate();
        }
    }

    /**
     * 表示言語の動的切り替え ('ja' | 'en')
     * @param {'ja'|'en'} lang 
     */
    setLanguage(lang = 'ja') {
        const isJa = (lang === 'ja' || lang === 'jp' || lang === true);
        const resolvedLang = isJa ? 'ja' : 'en';
        this.language = resolvedLang;
        if (this.situationCache && typeof this.situationCache.setLanguage === 'function') {
            this.situationCache.setLanguage(resolvedLang);
        }
        if (this.structuredKnowledge && typeof this.structuredKnowledge.setLanguage === 'function') {
            this.structuredKnowledge.setLanguage(resolvedLang);
        }
        if (this.inventoryStateManager && typeof this.inventoryStateManager.setLanguage === 'function') {
            this.inventoryStateManager.setLanguage(resolvedLang);
        }
        if (this.inventoryStateManager && typeof this.inventoryStateManager.invalidate === 'function') {
            this.inventoryStateManager.invalidate();
        }
    }

    /**
     * ゲームリスタート時などに全マネージャーのキャッシュ・状態を初期化
     */
    reset() {
        if (this.monsterTracker && typeof this.monsterTracker.reset === 'function') {
            this.monsterTracker.reset();
        }
        if (this.areaStateManager) {
            if (typeof this.areaStateManager.resetGrid === 'function') {
                this.areaStateManager.resetGrid();
            }
            if (typeof this.areaStateManager.clearStairCache === 'function') {
                this.areaStateManager.clearStairCache();
            }
        }
        if (this.inventoryStateManager) {
            this.inventoryStateManager.items = [];
            if (typeof this.inventoryStateManager.invalidate === 'function') {
                this.inventoryStateManager.invalidate();
            }
        }
        if (this.spellStateManager) {
            this.spellStateManager.spells = [];
            if (typeof this.spellStateManager.invalidate === 'function') {
                this.spellStateManager.invalidate();
            }
        }
        if (this.skillStateManager) {
            this.skillStateManager.skills = [];
            if (typeof this.skillStateManager.invalidate === 'function') {
                this.skillStateManager.invalidate();
            }
        }
        if (this.statusAccessor && typeof this.statusAccessor.reset === 'function') {
            this.statusAccessor.reset();
        }
        if (this.attributeStateManager) {
            if (typeof this.attributeStateManager.reset === 'function') {
                this.attributeStateManager.reset();
            } else {
                this.attributeStateManager.intrinsics = {};
                this.attributeStateManager.extrinsics = {};
            }
        }
    }

    /**
     * WebUICore インスタンスへプラグインをアタッチし、イベントリスナーを接続
     * @param {Object} core - WebUICore インスタンス
     */
    attach(core) {
        if (!core) return;
        if (this.core && this.core !== core) {
            this.detach();
        }
        this.core = core;
        if (!core.gkl) {
            core.gkl = this;
        }
        if (Array.isArray(core.plugins) && !core.plugins.includes(this)) {
            core.plugins.push(this);
        }

        if (core.language) {
            this.setLanguage(core.language);
        }

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
     * WebUICore からプラグインをデタッチし、リスナーを安全に解除
     */
    detach() {
        if (!this.core) return;
        if (Array.isArray(this._coreListeners) && typeof this.core.off === 'function') {
            for (const { event, handler } of this._coreListeners) {
                this.core.off(event, handler);
            }
        }
        this._coreListeners = [];
        if (this.core.gkl === this) {
            this.core.gkl = null;
        }
        this.core = null;
    }

    /**
     * WebUICore のイベントバインディング
     * @private
     */
    _bindCoreEvents(core) {
        this._coreListeners = [];
        const addCoreListener = (event, handler) => {
            core.on(event, handler);
            this._coreListeners.push({ event, handler });
        };

        // 言語変更イベントのリスン
        addCoreListener('languageChanged', ({ language }) => {
            this.setLanguage(language);
        });

        // 1. ユーザーアクション送出時のインベントリ・魔法 dirty 化判定 ＆ ハイブリッド内部ターン進行
        addCoreListener('userActionSent', ({ sequence }) => {
            if (sequence) {
                if (!this.isNonItemSequence(sequence)) {
                    if (typeof this.inventoryStateManager.invalidate === 'function') {
                        this.inventoryStateManager.invalidate();
                    } else {
                        this.inventoryStateManager.isSynced = false;
                    }
                    if (this.spellStateManager && typeof this.spellStateManager.invalidate === 'function') {
                        this.spellStateManager.invalidate();
                    }
                }

                // BL_TIME 非送信時用の自律ターン進行
                if (this.monsterTracker && this.isTurnConsumingSequence(sequence)) {
                    this.monsterTracker.advanceTurn();
                }
            }
        });

        // 2. テキストメッセージ受信時の更新 (撃破メッセージ処理含む)
        addCoreListener('messageText', ({ text }) => {
            if (text) {
                if (this.monsterTracker && typeof this.monsterTracker.handleMessage === 'function') {
                    this.monsterTracker.handleMessage(text);
                }
                if (typeof this.inventoryStateManager.updateFromMessage === 'function') {
                    const updated = this.inventoryStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('inventoryStateUpdated', this.inventoryStateManager);
                    }
                }
                if (this.spellStateManager && typeof this.spellStateManager.updateFromMessage === 'function') {
                    const updated = this.spellStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('spellsStateUpdated', this.spellStateManager);
                    }
                }
                if (this.skillStateManager && typeof this.skillStateManager.updateFromMessage === 'function') {
                    const updated = this.skillStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('skillsStateUpdated', this.skillStateManager);
                    }
                }
                if (this.attributeStateManager && typeof this.attributeStateManager.updateFromMessage === 'function') {
                    const updated = this.attributeStateManager.updateFromMessage(text);
                    if (updated) {
                        core.emit('attributesStateUpdated', this.attributeStateManager);
                    }
                }
            }
        });

        // 3.1. インベントリ更新時の外因性耐性 (Extrinsics) 自動再計算 ＆ 鑑定済みアイテムの DiscoveryCache 学習
        addCoreListener('inventoryStateUpdated', (invMgr) => {
            const items = invMgr ? (invMgr.items || []) : (this.inventoryStateManager ? this.inventoryStateManager.items : []);
            if (this.attributeStateManager && typeof this.attributeStateManager.updateExtrinsicsFromInventory === 'function') {
                this.attributeStateManager.updateExtrinsicsFromInventory(items);
            }
            let newlyDiscovered = false;
            if (this.discoveryStateManager && Array.isArray(items)) {
                for (const item of items) {
                    if (item && item.onum >= 0 && item.identification && !item.identification.isUnidentified) {
                        const prevDiscovered = this.discoveryStateManager.discoveredOnums.has(item.onum);
                        this.discoveryStateManager.registerKnownItem(item.onum, item.rawText);
                        if (!prevDiscovered && this.discoveryStateManager.discoveredOnums.has(item.onum)) {
                            newlyDiscovered = true;
                        }
                    }
                }
            }
            if (newlyDiscovered) {
                core.emit('discoveriesStateUpdated', this.discoveryStateManager);
            }
        });

        // 3.2. ゲーム開始・再開（Restore）時の Discovery バックグラウンド同期
        const triggerDiscoverySync = () => {
            this.syncDiscoveriesSilent();
        };
        addCoreListener('game_ready', triggerDiscoverySync);
        addCoreListener('game_started', triggerDiscoverySync);
        addCoreListener('restore', triggerDiscoverySync);
        addCoreListener('game_restored', triggerDiscoverySync);

        // 4. カーソル位置・プレイヤー移動の同期
        const handlePlayerPosUpdate = (data) => {
            if (data && data.x !== undefined && data.y !== undefined) {
                if (data.x >= 0 && data.x < 80 && data.y >= 0 && data.y < 21) {
                    this.areaStateManager.updatePlayerPosition(data.x, data.y);
                }
            }
        };
        addCoreListener('curs', handlePlayerPosUpdate);
        addCoreListener('cursor', handlePlayerPosUpdate);

        // 5. ウィンドウ消去・マップリセットの同期
        addCoreListener('clear_nhwindow', (data) => {
            if (data && (data.windowId === 2 || data.windowId === 0)) {
                this.areaStateManager.resetGrid();
                if (typeof this.areaStateManager.applyStairCacheForFloor === 'function') {
                    this.areaStateManager.applyStairCacheForFloor();
                }
                if (this.situationCache && typeof this.situationCache.invalidate === 'function') {
                    this.situationCache.invalidate();
                }
            }
        });

        addCoreListener('map_cleared', () => {
            this.areaStateManager.resetGrid();
            if (typeof this.areaStateManager.applyStairCacheForFloor === 'function') {
                this.areaStateManager.applyStairCacheForFloor();
            }
            if (this.situationCache && typeof this.situationCache.invalidate === 'function') {
                this.situationCache.invalidate();
            }
        });

        // 6. マップグリフ更新の同期
        addCoreListener('print_glyph', (data) => {
            if (data) {
                const gi = data.glyphInfo || data;
                const glyphId = data.glyph !== undefined ? data.glyph : -1;
                this.areaStateManager.updateGlyph(data.x, data.y, glyphId, gi);
            }
        });

        // 7. ステータスフィールド更新の同期
        addCoreListener('status_update', (data) => {
            if (data && data.field !== undefined && this.statusAccessor) {
                this.statusAccessor.updateField(data.field, data.value);

                // ターン数 (BL_TIME = 16) の同期
                if (data.field === 16 || data.field === 'time' || data.field === 'turns') {
                    const parsedTurn = typeof data.value === 'number' ? data.value : parseInt(data.value, 10);
                    if (!isNaN(parsedTurn) && this.monsterTracker) {
                        this.monsterTracker.advanceTurn(parsedTurn);
                    }
                }

                // 階層 (BL_DLEVEL = 20) の同期
                if (data.field === 20 || data.field === 'dlevel') {
                    if (this.areaStateManager && typeof this.areaStateManager.setCurrentFloor === 'function') {
                        this.areaStateManager.setCurrentFloor(data.value);
                    }
                    if (this.monsterTracker) {
                        this.monsterTracker.handleDlevelChange(data.value);
                    }
                }

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
        if (this.core.isPendingPrefix) return false;
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
        if (this.core.isPendingPrefix) return false;

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
        if (this.core.isPendingPrefix) return false;

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
            this.core.emit('spellsStateUpdated', this.spellStateManager);
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
        if (this.core.isPendingPrefix) return false;

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
            this.core.emit('attributesStateUpdated', this.attributeStateManager);
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
        if (this.core.isPendingPrefix) return false;

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
            this.core.emit('skillsStateUpdated', this.skillStateManager);
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

    getMonsterTracker() {
        return this.monsterTracker;
    }

    /**
     * プレイヤー視点での認知モンスター要約リスト（気配レーダー）を取得
     * @param {Object} [options={}]
     * @returns {Array<Object>}
     */
    getPerceivedMonstersSummary(options = {}) {
        if (!this.monsterTracker) return [];
        const px = this.areaStateManager ? this.areaStateManager.playerX : 0;
        const py = this.areaStateManager ? this.areaStateManager.playerY : 0;
        return this.monsterTracker.getPerceivedMonstersSummary({
            playerX: px,
            playerY: py,
            language: this.language,
            ...options
        });
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
        return ContextActionEngine.generateActions(areaState, this.inventoryStateManager, this.skillStateManager, { language: this.language, statusAccessor: this.statusAccessor }, this.statusAccessor);
    }

    /**
     * 現在のゲーム状態における戦術・危険・装備アドバイス一覧を取得
     * @param {Object} [options={}]
     * @returns {Array<Object>}
     */
    getTacticalAdvices(options = {}) {
        const areaState = this.areaStateManager ? this.areaStateManager.getAreaState() : {};
        return TacticalAdvisor.generateAdvices({
            areaState,
            inventoryState: this.inventoryStateManager,
            skillStateManager: this.skillStateManager,
            statusAccessor: this.statusAccessor,
            spellStateManager: this.spellStateManager,
            attributeStateManager: this.attributeStateManager
        }, { language: this.language, ...options });
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
     * 発見済みアイテムリスト (Discoveries `\`) のバックグラウンド自動同期・リハイドレーション
     * @returns {Promise<boolean>}
     */
    async syncDiscoveriesSilent() {
        if (!this.core || this._isSyncingDiscoveries) return false;
        this._isSyncingDiscoveries = true;

        try {
            if (typeof this.core.silentQuery === 'function') {
                const buffer = await this.core.silentQuery(['\\', ' ']);
                if (buffer && this.discoveryStateManager) {
                    this.discoveryStateManager.updateFromDiscoveriesText(buffer);
                    this.core.emit('discoveriesStateUpdated', this.discoveryStateManager);
                    return true;
                }
            } else if (this.core.driver && typeof this.core.driver.queueSequence === 'function') {
                this.core.driver.queueSequence(['\\', ' '], { silent: true });
                const buffer = this.core.driver.getLastSequenceBuffer ? this.core.driver.getLastSequenceBuffer() : null;
                if (buffer && this.discoveryStateManager) {
                    this.discoveryStateManager.updateFromDiscoveriesText(buffer);
                    this.core.emit('discoveriesStateUpdated', this.discoveryStateManager);
                    return true;
                }
            }
        } catch (e) {
            console.warn('[GKLPlugin] syncDiscoveriesSilent error:', e);
        } finally {
            this._isSyncingDiscoveries = false;
        }
        return false;
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

        if (this.core && typeof this.core.emit === 'function') {
            this.core.emit('userActionSent', { sequence });
        }
        return success;
    }

    /**
     * 指定された習得魔法スロット文字 (letter) で呪文詠唱 (#cast / Z) を開始する
     * @param {string} letter - 呪文スロット文字 (例: 'a', 'b')
     * @param {Object} [options={}]
     * @returns {Promise<boolean>}
     */
    async castSpell(letter, options = {}) {
        if (!letter || !this.core) return false;
        const spellKey = typeof letter === 'string' ? letter.charAt(0) : String.fromCharCode(letter);
        if (this.core.driver && typeof this.core.driver.queueSequence === 'function') {
            this.core.driver.queueSequence(['Z', spellKey], options);
            if (this.core && typeof this.core.emit === 'function') {
                this.core.emit('userActionSent', { sequence: ['Z', spellKey] });
            }
            return true;
        }
        return this.executeSequence(['Z', spellKey], options);
    }

    /**
     * スキル向上 (#enhance) を開始する
     * @param {Object|string} [skill] - スキルオブジェクトまたはスロット文字
     * @param {Object} [options={}]
     * @returns {Promise<boolean>}
     */
    async enhanceSkill(skill, options = {}) {
        if (!this.core) return false;
        if (skill) {
            const letter = typeof skill === 'string' ? skill : (skill.letter || skill.ch || skill.accelerator);
            if (letter) {
                return this.executeSequence(['#', 'enhance', '\r', String(letter)], options);
            }
        }
        return this.executeSequence(['#', 'enhance', '\r'], options);
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
            const knowledge = this.structuredKnowledge.getKnowledge(targetEntity, { language: this.language });
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
            language: this.language
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
