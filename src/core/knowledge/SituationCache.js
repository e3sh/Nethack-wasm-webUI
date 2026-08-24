/**
 * SituationCache.js
 * Game Knowledge Layer (GKL) の統合状況キャッシュ・高級アクセサ
 *
 * StatusAccessor (ステータス/状態異常/空腹等)、InventoryStateManager (所持品/ツール等)、
 * AreaStateManager (周辺マップ/グリフ/位置情報) を統一ファサードとして一括束ね、
 * UI クライアント（常時表示ボタン、独自ステータス UI 等）や AI Agent に
 * 「現在のゲーム統合状況 (Situation)」をワンストップで提供する。
 */

export class SituationCache {
    /**
     * @param {Object} [statusAccessor=null] - StatusAccessor インスタンス
     * @param {Object} [inventoryStateManager=null] - InventoryStateManager インスタンス
     * @param {Object} [areaStateManager=null] - AreaStateManager インスタンス
     * @param {Object} [actionEngineClass=null] - ContextActionEngine クラス
     * @param {Object} [spellStateManager=null] - SpellStateManager インスタンス
     * @param {Object} [attributeStateManager=null] - AttributeStateManager インスタンス
     * @param {Object} [skillStateManager=null] - SkillStateManager インスタンス
     * @param {Object} [tacticalAdvisorClass=null] - TacticalAdvisor クラス
     * @param {Object} [options={}] - オプション
     */
    constructor(statusAccessor = null, inventoryStateManager = null, areaStateManager = null, actionEngineClass = null, spellStateManager = null, attributeStateManager = null, skillStateManager = null, tacticalAdvisorClass = null, options = {}) {
        this.statusAccessor = statusAccessor;
        this.inventoryStateManager = inventoryStateManager;
        this.areaStateManager = areaStateManager;
        this.actionEngineClass = actionEngineClass;
        this.spellStateManager = spellStateManager;
        this.attributeStateManager = attributeStateManager;
        this.skillStateManager = skillStateManager;
        this.tacticalAdvisorClass = tacticalAdvisorClass;
        this.language = (options && options.language) || 'ja';
    }

    /**
     * 表示言語の設定
     * @param {'ja'|'en'} lang
     */
    setLanguage(lang = 'ja') {
        const isJa = (lang === 'ja' || lang === 'jp' || lang === true);
        this.language = isJa ? 'ja' : 'en';
    }

    /**
     * コンポーネントのアタッチ
     */
    attach({ statusAccessor, inventoryStateManager, areaStateManager, actionEngineClass, spellStateManager, attributeStateManager, skillStateManager, tacticalAdvisorClass, language }) {
        if (statusAccessor) this.statusAccessor = statusAccessor;
        if (inventoryStateManager) this.inventoryStateManager = inventoryStateManager;
        if (areaStateManager) this.areaStateManager = areaStateManager;
        if (actionEngineClass) this.actionEngineClass = actionEngineClass;
        if (spellStateManager) this.spellStateManager = spellStateManager;
        if (attributeStateManager) this.attributeStateManager = attributeStateManager;
        if (skillStateManager) this.skillStateManager = skillStateManager;
        if (tacticalAdvisorClass) this.tacticalAdvisorClass = tacticalAdvisorClass;
        if (language) this.setLanguage(language);
    }

    /**
     * 現在のゲーム統合状況 (Situation) を一括取得
     * @returns {Object} { status, inventory, equipment, area, tools, spells, skills, attributes, actions, advices }
     */
    getSituation() {
        const status = this.statusAccessor && typeof this.statusAccessor.getStatus === 'function' ?
            this.statusAccessor.getStatus() : {};

        const inventoryState = this.inventoryStateManager;
        const inventoryItems = inventoryState ? inventoryState.items || [] : [];
        const isInventorySynced = inventoryState ? Boolean(inventoryState.isSynced) : false;

        const areaState = this.areaStateManager && typeof this.areaStateManager.getAreaState === 'function' ?
            this.areaStateManager.getAreaState() : {};

        // ツール抽出
        const tools = {
            pickAxe: inventoryState && typeof inventoryState.getPickAxe === 'function' ? inventoryState.getPickAxe() : null,
            key: inventoryState && typeof inventoryState.getKeyOrLockPick === 'function' ? inventoryState.getKeyOrLockPick() : null,
            axe: inventoryState && typeof inventoryState.getAxe === 'function' ? inventoryState.getAxe() : null,
            frostWand: inventoryState && typeof inventoryState.getFrostWand === 'function' ? inventoryState.getFrostWand() : null
        };

        // 装備状態マップの抽出 (二刀流/武器/矢筒/防具)
        const equipment = inventoryState && typeof inventoryState.getEquipmentMap === 'function' ?
            inventoryState.getEquipmentMap() : { weapon: null, offhand: null, isTwoWeapon: false, quiver: null, wornList: [], equippedList: [] };

        // 習得魔法抽出
        const spellState = this.spellStateManager;
        const spellItems = spellState ? (typeof spellState.getSpells === 'function' ? spellState.getSpells() : (spellState.spells || [])) : [];
        const isSpellSynced = spellState ? Boolean(spellState.isSynced) : false;

        // スキル熟練度抽出
        const skillState = this.skillStateManager;
        const skillItems = skillState ? (typeof skillState.getSkills === 'function' ? skillState.getSkills() : (skillState.skills || [])) : [];
        const activeSkills = skillState && typeof skillState.getActiveSkills === 'function' ? skillState.getActiveSkills() : [];
        const isSkillSynced = skillState ? Boolean(skillState.isSynced) : false;

        // 属性・耐性抽出
        const attrState = this.attributeStateManager;
        const attributes = attrState && typeof attrState.getAttributes === 'function' ?
            attrState.getAttributes() : {
                effectiveResistances: {},
                intrinsics: {},
                extrinsics: {},
                isSynced: false
            };

        // 推奨アクションの自動計算 (ContextActionEngine が設定されている場合)
        let actions = [];
        if (this.actionEngineClass && typeof this.actionEngineClass.generateActions === 'function') {
            actions = this.actionEngineClass.generateActions(areaState, inventoryState, this.skillStateManager, { language: this.language });
        }

        // 戦術アドバイスの自動計算 (TacticalAdvisor が設定されている場合)
        let advices = [];
        if (this.tacticalAdvisorClass && typeof this.tacticalAdvisorClass.generateAdvices === 'function') {
            advices = this.tacticalAdvisorClass.generateAdvices({
                areaState,
                inventoryState,
                skillStateManager: this.skillStateManager,
                statusAccessor: this.statusAccessor,
                spellStateManager: this.spellStateManager,
                attributeStateManager: this.attributeStateManager
            }, { language: this.language });
        }

        const perceivedMonsters = (areaState && Array.isArray(areaState.perceivedMonsters))
            ? areaState.perceivedMonsters
            : [];

        return {
            status,
            inventory: {
                items: inventoryItems,
                isSynced: isInventorySynced
            },
            equipment,
            area: areaState,
            tools,
            spells: {
                items: spellItems,
                isSynced: isSpellSynced
            },
            skills: {
                items: skillItems,
                activeItems: activeSkills,
                isSynced: isSkillSynced
            },
            attributes,
            actions,
            advices,
            perceivedMonsters
        };
    }
}

