import { StatusAccessor } from '../StatusAccessor.js';
import { AreaStateManager } from "./state/AreaStateManager.js";
import { InventoryStateManager } from "./state/InventoryStateManager.js";
import { SpellStateManager } from "./state/SpellStateManager.js";
import { SkillStateManager } from "./state/SkillStateManager.js";
import { AttributeStateManager } from "./state/AttributeStateManager.js";
import { ConditionStateManager } from "./state/ConditionStateManager.js";
import { SituationCache } from "./state/SituationCache.js";
import { ContextActionEngine } from "./engines/ContextActionEngine.js";
import { TacticalAdvisor } from "./engines/TacticalAdvisor.js";
import { AssistSignalSynthesizer } from "./engines/AssistSignalSynthesizer.js";
import { StructuredKnowledgeEngine } from "./engines/StructuredKnowledgeEngine.js";
import { OnDemandLookService } from "./services/OnDemandLookService.js";
import { OnDemandLookupService } from "./services/OnDemandLookupService.js";
import { DiscoveryStateManager } from "./state/DiscoveryStateManager.js";
import { MonsterTracker } from "./state/MonsterTracker.js";
import { WishService } from "./services/WishService.js";
import { GenocideService } from "./services/GenocideService.js";
import { PolymorphService } from "./services/PolymorphService.js";
import { WriteService } from "./services/WriteService.js";
import { EncumbranceStateManager } from "./state/EncumbranceStateManager.js";
import { WasmDirectBindingService } from "./services/WasmDirectBindingService.js";
import { LoreCodex } from "./lore/LoreCodex.js";
import { LoreDetector } from "./lore/LoreDetector.js";
import { InteractionContext } from "./context/InteractionContext.js";
import { ActionSignalResolver } from "./engines/ActionSignalResolver.js";
import { AdventureLogManager } from "./lore/AdventureLogManager.js";
import { SilentSyncCoordinator } from "./coordinators/SilentSyncCoordinator.js";
import { GKLFxCoordinator } from "./coordinators/GKLFxCoordinator.js";
import { GKLEventRouter } from "./coordinators/GKLEventRouter.js";
import { InspectionService } from "./services/InspectionService.js";
import { AutoTravelService } from "./services/AutoTravelService.js";

/**
 * Game Knowledge Layer (GKL) 独立拡張プラグイン (Facade / Orchestrator)
 * WebUICore のパブリックイベント・サイレントクエリ基盤と連携し、
 * ゲーム状態追跡 (Inventory/Area/Status/Spells/Skills/Attributes) およびコンテキストアクション推薦を一元管理する。
 */
export class GKLPlugin {
    /**
     * @param {Object} [options={}]
     */
    constructor(options = {}) {
        this.statusAccessor = new StatusAccessor();
        this.monsterTracker = options.monsterTracker || new MonsterTracker();
        this.areaStateManager = new AreaStateManager(80, 24, this.monsterTracker);
        this.inventoryStateManager = options.inventoryStateManager || new InventoryStateManager();
        this.spellStateManager = options.spellStateManager || new SpellStateManager();
        this.skillStateManager = options.skillStateManager || new SkillStateManager();
        this.attributeStateManager = options.attributeStateManager || new AttributeStateManager();
        this.conditionStateManager = options.conditionStateManager || new ConditionStateManager();
        this.wasmDirectBindingService = options.wasmDirectBindingService || null;
        this.encumbranceStateManager = options.encumbranceStateManager || new EncumbranceStateManager({
            statusAccessor: this.statusAccessor,
            inventoryStateManager: this.inventoryStateManager,
            wasmDirectBindingService: this.wasmDirectBindingService,
        });

        if (this.wasmDirectBindingService) {
            this.inventoryStateManager?.setWasmDirectBindingService?.(this.wasmDirectBindingService);
            this.encumbranceStateManager?.setWasmDirectBindingService?.(this.wasmDirectBindingService);
            this.areaStateManager?.setDirectBindingService?.(this.wasmDirectBindingService);
        }

        this.language = options.language || 'ja';

        this.interactionContext = options.interactionContext || new InteractionContext(this, {
            defaultTtl: options.defaultInteractionTtl !== undefined ? options.defaultInteractionTtl : 3
        });

        this.actionSignalResolver = options.actionSignalResolver || new ActionSignalResolver(this, {
            language: this.language
        });

        this.situationCache = new SituationCache(
            this.statusAccessor,
            this.inventoryStateManager,
            this.areaStateManager,
            ContextActionEngine,
            this.spellStateManager,
            this.attributeStateManager,
            this.skillStateManager,
            TacticalAdvisor,
            {
                language: this.language,
                encumbranceStateManager: this.encumbranceStateManager,
                interactionContext: this.interactionContext
            }
        );

        if (options.keyMode || options.numpad) {
            const mode = options.keyMode || (options.numpad ? 'numpad' : 'vi');
            this.areaStateManager.setKeyMode(mode);
        }

        this.adventureLogManager = options.adventureLogManager || AdventureLogManager.getInstance();

        this.discoveryStateManager = options.discoveryStateManager || new DiscoveryStateManager({
            translationEngine: options.translationEngine || null,
            adventureLogManager: this.adventureLogManager
        });

        if (this.discoveryStateManager?.setAdventureLogManager) {
            this.discoveryStateManager.setAdventureLogManager(this.adventureLogManager);
            this.discoveryStateManager.onAdventureLogUnlocked = (info) => this._emitAdventureLogUnlocked(info);
        }

        this.sagesWisdomMode = Boolean(options.sagesWisdomMode);

        this.structuredKnowledge = options.structuredKnowledgeEngine || new StructuredKnowledgeEngine({
            translationEngine: options.translationEngine || null,
            discoveryStateManager: this.discoveryStateManager,
            sagesWisdomMode: this.sagesWisdomMode,
            language: this.language
        });

        this.structuredKnowledge?.setDiscoveryStateManager?.(this.discoveryStateManager);
        this.inventoryStateManager?.setStructuredKnowledgeEngine?.(this.structuredKnowledge);
        this.inventoryStateManager?.setSkillStateManager?.(this.skillStateManager);
        this.inventoryStateManager?.setDiscoveryStateManager?.(this.discoveryStateManager);

        if (this.inventoryStateManager?.setAdventureLogManager) {
            this.inventoryStateManager.setAdventureLogManager(this.adventureLogManager);
            this.inventoryStateManager.onAdventureLogUnlocked = (info) => this._emitAdventureLogUnlocked(info);
        }
        this.discoveryStateManager?.setInventoryStateManager?.(this.inventoryStateManager);

        this.wishService = options.wishService || new WishService({ translator: options.translationEngine || null });
        this.genocideService = options.genocideService || new GenocideService({ translator: options.translationEngine || null });
        this.polymorphService = options.polymorphService || new PolymorphService({
            translationEngine: options.translationEngine || null,
            language: this.language
        });
        this.writeService = options.writeService || new WriteService({
            translator: options.translationEngine || null,
            language: this.language,
            discoveryStateManager: this.discoveryStateManager,
            spellStateManager: this.spellStateManager
        });

        this.loreCodex = options.loreCodex || new LoreCodex({ translationEngine: options.translationEngine || null });
        if (options.translationEngine) {
            this.loreCodex?.setTranslationEngine?.(options.translationEngine);
        }
        this.loreDetector = options.loreDetector || new LoreDetector();

        this._setupMonsterTrackerHooks();

        this.core = null;
        this.requestController = null;
        this.lookService = new OnDemandLookService();
        this.lookupService = options.lookupService || new OnDemandLookupService();

        // 動作モード: DirectBinding Native (フォールバック撤廃・純化)
        this.directBindingMode = 'native';

        // コーディネーター & 新設サービスの初期化 (ROADMAP 2.2)
        this.silentSyncCoordinator = new SilentSyncCoordinator(this, { directBindingMode: 'native' });
        this.fxCoordinator = new GKLFxCoordinator(this);
        this.eventRouter = new GKLEventRouter(this);
        this.inspectionService = new InspectionService(this);
        this.autoTravelService = new AutoTravelService(this);

        // 後方互換参照
        this.silentSyncTracker = this.silentSyncCoordinator.tracker;
    }

    // --- 後方互換性のための内部状態プロキシ (テストおよびインスペクタ向け) ---
    get _coreListeners() { return this.eventRouter._listeners; }
    set _coreListeners(val) { this.eventRouter._listeners = val; }
    get _prevHp() { return this.fxCoordinator.prevHp; }
    set _prevHp(val) { this.fxCoordinator.prevHp = val; }
    get _prevAc() { return this.fxCoordinator.prevAc; }
    set _prevAc(val) { this.fxCoordinator.prevAc = val; }
    get _lastAttackTarget() { return this.fxCoordinator.lastAttackTarget; }
    set _lastAttackTarget(val) { this.fxCoordinator.lastAttackTarget = val; }
    get _isPlayerDead() { return this.fxCoordinator.isPlayerDead; }
    set _isPlayerDead(val) { this.fxCoordinator.isPlayerDead = val; }
    get _emittedFxList() { return this.fxCoordinator.emittedFxList; }
    set _emittedFxList(val) { this.fxCoordinator.emittedFxList = val; }
    get _lastReceivedMessage() { return this.eventRouter.lastReceivedMessage; }
    set _lastReceivedMessage(val) { this.eventRouter.lastReceivedMessage = val; }

    /**
     * 動作モードの設定 (DirectBinding Native 化に伴い no-op 後方互換プロキシ)
     * @param {string} mode
     */
    setDirectBindingMode(mode) {
        this.directBindingMode = 'native';
        this.silentSyncCoordinator?.setDirectBindingMode?.('native');
        this.wasmDirectBindingService?.setMode?.('native');
        this.inventoryStateManager?.setDirectBindingMode?.('native');
        this.areaStateManager?.setDirectBindingMode?.('native');
    }

    _recordSilentSync(type, changed = false, durationMs = 0, method = 'MACRO') {
        this.silentSyncCoordinator.recordSilentSync(type, changed, durationMs, method);
    }

    emitFxTrigger(payload) {
        this.fxCoordinator.emitFxTrigger(payload);
    }

    _emitAdventureLogUnlocked(info) {
        if (!this.core || typeof this.core.emit !== 'function') return;
        this.core.emit('adventureLogUnlocked', { timestamp: Date.now(), ...info });
    }

    getAdventureLogManager() { return this.adventureLogManager; }

    setAdventureLogManager(alm) {
        this.adventureLogManager = alm;
        this.discoveryStateManager?.setAdventureLogManager?.(alm);
        this.inventoryStateManager?.setAdventureLogManager?.(alm);
    }

    _setupMonsterTrackerHooks() {
        if (!this.monsterTracker) return;
        this.monsterTracker.onInventoryInvalidateRequired = () => {
            this.inventoryStateManager?.invalidate?.();
        };
    }

    setMonsterTracker(tracker) {
        this.monsterTracker = tracker;
        this.areaStateManager?.setMonsterTracker?.(tracker);
        this._setupMonsterTrackerHooks();
    }

    _getDirOffset(dirKey) {
        return this.fxCoordinator.getDirOffset(dirKey);
    }

    invalidateAllCaches() {
        this.inventoryStateManager?.invalidate?.();
        this.spellStateManager?.invalidate?.();
        this.skillStateManager?.invalidate?.();
        this.encumbranceStateManager?.reset?.();
        this.loreDetector?.reset?.();
    }

    getEncumbranceStateManager() { return this.encumbranceStateManager; }
    getEncumbranceState() { return this.encumbranceStateManager ? this.encumbranceStateManager.getEncumbranceState() : null; }

    setLanguage(lang = 'ja') {
        const resolvedLang = (lang === 'ja' || lang === 'jp' || lang === true) ? 'ja' : 'en';
        this.language = resolvedLang;
        this.situationCache?.setLanguage?.(resolvedLang);
        this.structuredKnowledge?.setLanguage?.(resolvedLang);
        this.wishService?.setLanguage?.(resolvedLang);
        this.genocideService?.setLanguage?.(resolvedLang);
        this.polymorphService?.setLanguage?.(resolvedLang);
        this.inventoryStateManager?.setLanguage?.(resolvedLang);
        this.inventoryStateManager?.invalidate?.();
        this.loreCodex?.refreshTranslations?.();
        this.actionSignalResolver?.setLanguage?.(resolvedLang);
        this.lookupService?.setLanguage?.(resolvedLang);
    }

    setSagesWisdomMode(enabled = false) {
        this.sagesWisdomMode = Boolean(enabled);
        this.structuredKnowledge?.setSagesWisdomMode?.(this.sagesWisdomMode);
        this.inventoryStateManager?.setSagesWisdomMode?.(this.sagesWisdomMode);
    }

    getCodex() { return this.loreCodex; }
    getLoreCodex() { return this.loreCodex; }
    getLoreDetector() { return this.loreDetector; }
    getWishService() { return this.wishService; }
    getGenocideService() { return this.genocideService; }
    getPolymorphService() { return this.polymorphService; }
    getWriteService() { return this.writeService; }

    getCharacterInfo() {
        return this.attributeStateManager?.characterInfo || { race: 'human', role: 'valkyrie', level: 1 };
    }

    reset() {
        this.fxCoordinator.reset();
        this.monsterTracker?.reset?.();
        if (this.areaStateManager) {
            if (typeof this.areaStateManager.resetAll === 'function') {
                this.areaStateManager.resetAll();
            } else {
                this.areaStateManager.resetGrid?.();
                this.areaStateManager.clearLandmarks?.();
            }
        }
        if (this.inventoryStateManager) {
            this.inventoryStateManager.items = [];
            this.inventoryStateManager.invalidate?.();
        }
        if (this.spellStateManager) {
            this.spellStateManager.spells = [];
            this.spellStateManager.invalidate?.();
        }
        if (this.skillStateManager) {
            this.skillStateManager.skills = [];
            this.skillStateManager.invalidate?.();
        }
        this.statusAccessor?.reset?.();
        if (this.attributeStateManager) {
            if (typeof this.attributeStateManager.reset === 'function') {
                this.attributeStateManager.reset();
            } else {
                this.attributeStateManager.intrinsics = {};
                this.attributeStateManager.extrinsics = {};
            }
        }
        this.wasmDirectBindingService?.resetAllCaches?.();
        this.situationCache?.invalidate?.();
        this.interactionContext?.reset?.();
        this.silentSyncCoordinator.reset();
    }

    attach(core) {
        if (!core) return;
        if (this.core && this.core !== core) {
            this.detach();
        }
        this.core = core;
        if (!core.gkl) core.gkl = this;
        if (Array.isArray(core.plugins) && !core.plugins.includes(this)) {
            core.plugins.push(this);
        }

        if (core.language) this.setLanguage(core.language);
        this.inventoryStateManager?.setStructuredKnowledgeEngine?.(this.structuredKnowledge);

        if (core.translator) {
            this.structuredKnowledge?.setTranslationEngine?.(core.translator);
            this.wishService?.setTranslator?.(core.translator);
            this.genocideService?.setTranslator?.(core.translator);
            this.polymorphService?.setTranslationEngine?.(core.translator);
            this.loreCodex?.setTranslationEngine?.(core.translator);
            this.lookupService?.setTranslationEngine?.(core.translator);
            this.discoveryStateManager?.setTranslationEngine?.(core.translator);
        }

        const driverOrBridge = core.driver;
        if (driverOrBridge && (driverOrBridge.callShim || driverOrBridge.memory)) {
            if (!this.wasmDirectBindingService) {
                this.wasmDirectBindingService = new WasmDirectBindingService({
                    bridge: driverOrBridge.callShim ? driverOrBridge : null,
                    memory: driverOrBridge.memory || null,
                    module: (typeof driverOrBridge.getModule === 'function') ? driverOrBridge.getModule() : null
                });
            } else {
                if (driverOrBridge.callShim) this.wasmDirectBindingService.setBridge(driverOrBridge);
                if (driverOrBridge.memory) this.wasmDirectBindingService.setMemory(driverOrBridge.memory);
            }
            this.inventoryStateManager?.setWasmDirectBindingService?.(this.wasmDirectBindingService);
            this.attributeStateManager?.setWasmDirectBindingService?.(this.wasmDirectBindingService);
            this.encumbranceStateManager?.setWasmDirectBindingService?.(this.wasmDirectBindingService);
            this.areaStateManager?.setDirectBindingService?.(this.wasmDirectBindingService);
        }

        if (core.interactiveController || core.requestController) {
            this.requestController = core.interactiveController || core.requestController;
        }
        this.lookService?.setCore?.(core);
        this.lookupService?.setCore?.(core);

        this._bindCoreEvents(core);
    }

    detach() {
        if (!this.core) return;
        this.eventRouter.detach(this.core);
        if (this.core.gkl === this) {
            this.core.gkl = null;
        }
        this.core = null;
    }

    _bindCoreEvents(core) {
        this.eventRouter.attach(core);
    }

    _handleOracleUnlock(loreSignal) {
        this.eventRouter.handleOracleUnlock(loreSignal);
    }

    _handleEngraveSignal(loreSignal) {
        this.eventRouter.handleEngraveSignal(loreSignal);
    }

    // --- SilentSyncCoordinator への委譲メソッド群 ---
    isTurnConsumingSequence(sequence) { return this.silentSyncCoordinator.isTurnConsumingSequence(sequence); }
    isNonItemSequence(sequence) { return this.silentSyncCoordinator.isNonItemSequence(sequence); }
    isSpellAffectingSequence(sequence) { return this.silentSyncCoordinator.isSpellAffectingSequence(sequence); }
    hasPendingSync() { return this.silentSyncCoordinator.hasPendingSync(); }
    async syncPendingStateSilent(options = {}) { return await this.silentSyncCoordinator.syncPendingStateSilent(options); }
    _isPromptOrTargetingActive(force = false) { return this.silentSyncCoordinator.isPromptOrTargetingActive(force); }
    async syncInventorySilent(options = {}) { return await this.silentSyncCoordinator.syncInventorySilent(options); }
    async syncSpellsSilent(options = {}) { return await this.silentSyncCoordinator.syncSpellsSilent(options); }
    async syncAttributesSilent(options = {}) { return await this.silentSyncCoordinator.syncAttributesSilent(options); }
    async syncSkillsSilent(options = {}) { return await this.silentSyncCoordinator.syncSkillsSilent(options); }
    async syncAllSilent(options = {}) { return await this.silentSyncCoordinator.syncAllSilent(options); }
    async syncDiscoveriesSilent() { return await this.silentSyncCoordinator.syncDiscoveriesSilent(); }

    // --- オンデマンド同期 (モーダル・詳細画面を開くときトリガー) ---
    async syncAttributesOnDemand() {
        if (this.wasmDirectBindingService) {
            const tasks = [];
            if (typeof this.wasmDirectBindingService.syncAttributesOnDemand === 'function') {
                tasks.push(this.wasmDirectBindingService.syncAttributesOnDemand());
            }
            if (typeof this.wasmDirectBindingService.syncPlayerProfileOnDemand === 'function') {
                tasks.push(this.wasmDirectBindingService.syncPlayerProfileOnDemand());
            }
            if (typeof this.wasmDirectBindingService.syncPlayerSummaryOnDemand === 'function') {
                tasks.push(this.wasmDirectBindingService.syncPlayerSummaryOnDemand());
            }
            await Promise.allSettled(tasks);
        }
        if (this.attributeStateManager && typeof this.attributeStateManager.syncFromDirectBinding === 'function') {
            const changed = this.attributeStateManager.syncFromDirectBinding(this.wasmDirectBindingService);
            if (this.inventoryStateManager && typeof this.attributeStateManager.updateExtrinsicsFromInventory === 'function') {
                this.attributeStateManager.updateExtrinsicsFromInventory(this.inventoryStateManager.items);
            }
            if (this.core) this.core.emit('attributesStateUpdated', this.attributeStateManager);
            return changed;
        }
        return false;
    }

    async syncPlayerProfileOnDemand() {
        if (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.syncPlayerProfileOnDemand === 'function') {
            const res = await this.wasmDirectBindingService.syncPlayerProfileOnDemand();
            if (this.attributeStateManager && typeof this.attributeStateManager.syncFromDirectBinding === 'function') {
                const changed = this.attributeStateManager.syncFromDirectBinding(this.wasmDirectBindingService);
                if (this.core) this.core.emit('attributesStateUpdated', this.attributeStateManager);
            }
            return res;
        }
        return false;
    }

    async syncPlayerSummaryOnDemand() {
        if (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.syncPlayerSummaryOnDemand === 'function') {
            const res = await this.wasmDirectBindingService.syncPlayerSummaryOnDemand();
            if (this.attributeStateManager && typeof this.attributeStateManager.syncFromDirectBinding === 'function') {
                const changed = this.attributeStateManager.syncFromDirectBinding(this.wasmDirectBindingService);
                if (this.core) this.core.emit('attributesStateUpdated', this.attributeStateManager);
            }
            return res;
        }
        return false;
    }

    async syncSkillsOnDemand() {
        if (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.syncSkillsOnDemand === 'function') {
            await this.wasmDirectBindingService.syncSkillsOnDemand();
        }
        if (this.skillStateManager && typeof this.skillStateManager.syncFromDirectBinding === 'function') {
            const changed = this.skillStateManager.syncFromDirectBinding(this.wasmDirectBindingService);
            if (this.core) this.core.emit('skillsStateUpdated', this.skillStateManager);
            return changed;
        }
        return false;
    }

    async syncSpellsOnDemand() {
        if (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.syncSpellBookOnDemand === 'function') {
            await this.wasmDirectBindingService.syncSpellBookOnDemand();
        }
        if (this.spellStateManager && typeof this.spellStateManager.syncFromDirectBinding === 'function') {
            const changed = this.spellStateManager.syncFromDirectBinding(this.wasmDirectBindingService);
            if (this.core) this.core.emit('spellsStateUpdated', this.spellStateManager);
            return changed;
        }
        return false;
    }

    async syncDiscoveriesOnDemand() {
        if (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.syncDiscoveriesOnDemand === 'function') {
            await this.wasmDirectBindingService.syncDiscoveriesOnDemand();
        }
        if (this.discoveryStateManager && typeof this.discoveryStateManager.syncWithLiveMemory === 'function') {
            const changed = this.discoveryStateManager.syncWithLiveMemory(this.wasmDirectBindingService);
            if (this.core) this.core.emit('discoveriesStateUpdated', this.discoveryStateManager);
            return changed;
        }
        return false;
    }

    // --- 状況要約・ゲッター・アドバイザー ---
    getSituation() {
        if (this.situationCache) return this.situationCache.getSituation();
        return {
            status: this.getStatus(),
            inventory: { items: this.inventoryStateManager?.items || [], isSynced: Boolean(this.inventoryStateManager?.isSynced) },
            area: this.areaStateManager ? this.areaStateManager.getAreaState() : {},
            spells: { items: this.spellStateManager?.spells || [], isSynced: Boolean(this.spellStateManager?.isSynced) },
            skills: {
                items: this.skillStateManager ? this.skillStateManager.getSkills() : [],
                activeItems: this.skillStateManager ? this.skillStateManager.getActiveSkills() : [],
                isSynced: Boolean(this.skillStateManager?.isSynced)
            },
            attributes: this.attributeStateManager ? this.attributeStateManager.getAttributes() : {},
            tools: {},
            actions: [],
            assistState: null,
            landmarks: null
        };
    }

    getDefaultAction(dirCode, options = {}) {
        const areaState = this.areaStateManager ? this.areaStateManager.getAreaState() : null;
        return ContextActionEngine.getDefaultActionForDirection(dirCode, areaState, { language: options.language || this.language || 'ja', ...options });
    }

    getDashAction(dirCode, options = {}) {
        const areaState = this.areaStateManager ? this.areaStateManager.getAreaState() : null;
        return ContextActionEngine.getDashActionForDirection(dirCode, areaState, { language: options.language || this.language || 'ja', ...options });
    }

    getDiagnosticSummary() {
        const situation = this.getSituation();
        const turn = this.monsterTracker ? this.monsterTracker.getCurrentTurn() : (this.statusAccessor?.turns || 1);
        const playerX = this.areaStateManager ? this.areaStateManager.playerX : 0;
        const playerY = this.areaStateManager ? this.areaStateManager.playerY : 0;

        const trackedMonsters = (this.monsterTracker?.getTrackedMonsters?.() || []).map(m => {
            const mx = m.lastKnownPos?.x ?? m.x ?? 0;
            const my = m.lastKnownPos?.y ?? m.y ?? 0;
            return {
                name: m.name || m.nameJa || 'unknown',
                confidence: m.weight !== undefined ? Math.round(m.weight * 100) / 100 : 1.0,
                isAdjacent: Math.abs(mx - playerX) <= 1 && Math.abs(my - playerY) <= 1
            };
        });

        const warnings = [];
        if (Array.isArray(situation?.tacticalAdvice?.warnings)) {
            situation.tacticalAdvice.warnings.forEach(w => {
                if (w.id) warnings.push(w.id);
                else if (w.topic) warnings.push(w.topic);
            });
        }

        let assistAction = null;
        if (situation?.assistSignal) {
            const sig = situation.assistSignal;
            assistAction = sig.recommendedAction?.id || sig.primaryAction?.id ||
                (Array.isArray(sig.primaryAction?.keySequence) ? sig.primaryAction.keySequence.join('') : sig.stance) || null;
        }

        return {
            turn,
            playerPosition: { x: playerX, y: playerY },
            lastMessage: this._lastReceivedMessage || '',
            syncCounts: {
                inventory: this.silentSyncTracker?.syncCounts?.inventory || 0,
                skills: this.silentSyncTracker?.syncCounts?.skills || 0,
                spells: this.silentSyncTracker?.syncCounts?.spells || 0
            },
            trackedMonsters,
            warnings,
            assistAction,
            emittedFx: this._emittedFxList ? this._emittedFxList.map(fx => fx.type) : []
        };
    }

    getAssistState() {
        if (this.situationCache?.getAssistState) return this.situationCache.getAssistState();
        return AssistSignalSynthesizer.synthesize({
            statusAccessor: this.statusAccessor,
            inventoryStateManager: this.inventoryStateManager,
            spellStateManager: this.spellStateManager,
            areaStateManager: this.areaStateManager,
            attributeStateManager: this.attributeStateManager
        }, { language: this.language });
    }

    getFloorLandmarks(floorKey) { return this.areaStateManager?.getFloorLandmarks?.(floorKey) || null; }
    getAllLandmarks() { return this.areaStateManager?.getAllLandmarks?.() || []; }
    getStatus() { return this.core ? this.core.getStatus() : this.statusAccessor.getStatus(); }
    getSituationCache() { return this.situationCache; }
    getInventoryStateManager() { return this.inventoryStateManager; }
    getSpellStateManager() { return this.spellStateManager; }
    getSkillStateManager() { return this.skillStateManager; }
    getAttributeStateManager() { return this.attributeStateManager; }
    getConditionStateManager() { return this.conditionStateManager; }
    getAreaStateManager() { return this.areaStateManager; }
    getMonsterTracker() { return this.monsterTracker; }
    getStatusAccessor() { return this.statusAccessor; }
    getDiscoveryStateManager() { return this.discoveryStateManager; }
    getInteractionContext() { return this.interactionContext; }
    getActionSignalResolver() { return this.actionSignalResolver; }

    updateCharacterInfo(charInfo = {}) {
        if (this.attributeStateManager?.updateCharacter) {
            this.attributeStateManager.updateCharacter(charInfo);
            this.core?.emit?.('attributesStateUpdated', this.attributeStateManager);
        }
    }

    getPerceivedMonstersSummary(options = {}) {
        if (!this.monsterTracker) return [];
        return this.monsterTracker.getPerceivedMonstersSummary({
            playerX: this.areaStateManager ? this.areaStateManager.playerX : 0,
            playerY: this.areaStateManager ? this.areaStateManager.playerY : 0,
            language: this.language,
            ...options
        });
    }

    getRecommendedActions(radius = 1) {
        const areaState = this.areaStateManager ? this.areaStateManager.getAreaState(undefined, undefined, radius) : {};
        return ContextActionEngine.generateActions(areaState, this.inventoryStateManager, this.skillStateManager, { language: this.language, statusAccessor: this.statusAccessor }, this.statusAccessor);
    }

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

    executeAction(action, options = {}) {
        if (!action || !this.core || this._isPlayerDead) return false;

        this.fxCoordinator.checkMeleeAttackFromAction(action);

        if (action.actionRecipe || action.recipe) {
            return this.executeSequence(action.actionRecipe || action.recipe, options);
        }
        if (Array.isArray(action.keySequence) && action.keySequence.length > 0) {
            return this.executeSequence([...action.keySequence], options);
        }
        if (action.extCmd) {
            this.inventoryStateManager?.invalidate?.();
            this.core.sendExtCommand(action.extCmd, action.directionKey, options);
            return true;
        }

        const mainKey = action.charStr || action.key;
        const seq = (action.directionKey && action.directionKey !== mainKey) ? [mainKey, action.directionKey] : null;
        if (seq && seq.length > 0) {
            return this.executeSequence(seq, options);
        }

        if (this.inventoryStateManager && !this.isNonItemSequence([mainKey])) {
            this.inventoryStateManager.invalidate();
        }
        this.core.sendActionKey(mainKey);
        return true;
    }

    async lookupOfficialInformation(target, options = {}) {
        if (!this.lookupService) return { found: false, query: target, text: '', lines: [], fromCache: false };
        return await this.lookupService.lookup(target, options);
    }

    async executeSequence(sequence, options = {}) {
        if (!sequence || !this.core) return false;
        const isArray = Array.isArray(sequence);
        if (isArray && sequence.length === 0) return false;

        let success = false;
        if (this.core.interactiveController?.executeSequence) {
            success = await this.core.interactiveController.executeSequence(sequence, options);
        } else if (typeof this.core.executeSequence === 'function') {
            success = await this.core.executeSequence(sequence, options);
        } else if (this.requestController?.executeSequence) {
            success = await this.requestController.executeSequence(sequence, options);
        } else if (this.core.driver?.queueSequence) {
            this.core.driver.queueSequence(sequence, options);
            success = true;
        } else if (isArray) {
            sequence.forEach(ch => this.core.sendKey(ch, false, false, false, ch, true));
            success = true;
        }

        this.core?.emit?.('userActionSent', { sequence });

        if (!options.isSilentSync && this.hasPendingSync()) {
            this.syncPendingStateSilent();
        }
        return success;
    }

    async castSpell(letter, options = {}) {
        if (!letter || !this.core) return false;
        const spellKey = typeof letter === 'string' ? letter.charAt(0) : String.fromCharCode(letter);
        if (this.core.driver?.queueSequence) {
            this.core.driver.queueSequence(['Z', spellKey], options);
            this.core?.emit?.('userActionSent', { sequence: ['Z', spellKey] });
            return true;
        }
        return this.executeSequence(['Z', spellKey], options);
    }

    async enhanceSkill(skill, options = {}) {
        if (!this.core) return false;
        if (skill) {
            const letter = typeof skill === 'string' ? skill : (skill.letter || skill.ch || skill.accelerator);
            if (letter) return this.executeSequence(['#', 'enhance', '\r', String(letter)], options);
        }
        return this.executeSequence(['#', 'enhance', '\r'], options);
    }

    // --- InspectionService / AutoTravelService への委譲メソッド群 ---
    async inspectCellOnDemand(targetPos, options = {}) {
        return await this.inspectionService.inspectCellOnDemand(targetPos, options);
    }

    async travelTo(targetPos, options = {}) {
        return await this.autoTravelService.travelTo(targetPos, options);
    }

    getFocusCameraTiles(radiusX = 10, radiusY = 4, options = {}) {
        return this.inspectionService.getFocusCameraTiles(radiusX, radiusY, options);
    }

    getActionSignal() {
        if (!this.actionSignalResolver || !this.interactionContext) return null;
        return this.actionSignalResolver.resolve(this.interactionContext);
    }

    async executeActionRecipe(recipe, options = {}) {
        if (!recipe) return false;
        const controller = this.requestController || this.core?.interactiveController || this.core?.requestController;
        if (!controller || typeof controller.executeSequence !== 'function') {
            console.warn('[GKLPlugin] executeActionRecipe failed: requestController is not available.');
            return false;
        }
        return await controller.executeSequence(recipe, options);
    }
}
