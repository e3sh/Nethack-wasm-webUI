/**
 * WasmDirectBindingService.js
 *
 * GKL (Gameplay Knowledge Layer) と NetHack Wasm Cコア（shim_bridge.c / エクスポート関数）を
 * 直接結ぶ構造化バインディングサービスクラス。
 *
 * 責務:
 * 1. NetHackMemory の bridgeCall (SHIM_CMD_*) を抽象化し、安全かつ型付けされたドメインオブジェクトを提供。
 * 2. 所持品リンクリスト (gi.invent -> nobj) の直接走査とアイテム構造体 (struct obj) の一括デコード。
 * 3. 14 種類の装備スロットポインタ (uwep, uarm, uleft 等) の取得とスロット同定マップの提供。
 * 4. 公式 C コア計算 (DUMP_ALL_INVENT / DUMP_OBJECT_INFO) による補正後真の重量の同期取得。
 */

// NetHackMemory.js は UMD / Worker (importScripts) との互換性維持のため副作用インポート
import '../../../driver/NetHackMemory.js';
export * from './binding/BindingConstants.js';
import { getGlobalMemoryClass } from './binding/BindingConstants.js';
import { DiscoveryWasmAdapter } from './binding/DiscoveryWasmAdapter.js';
import { PlayerWasmAdapter } from './binding/PlayerWasmAdapter.js';
import { MonsterWasmAdapter } from './binding/MonsterWasmAdapter.js';
import { SpatialWasmAdapter } from './binding/SpatialWasmAdapter.js';
import { InventoryWasmAdapter } from './binding/InventoryWasmAdapter.js';
import { WasmSyncCoordinator } from './binding/WasmSyncCoordinator.js';

export class WasmDirectBindingService {
    /**
     * @param {Object} [options={}]
     * @param {Object} [options.bridge] - NetHackWasmWorkerBridge インスタンス
     * @param {Object} [options.driver] - Driver または WorkerBridge
     * @param {NetHackMemory} [options.memory] - NetHackMemory インスタンス
     * @param {Object} [options.module] - Emscripten Module インスタンス
     */
    constructor(options = {}) {
        this.bridge = options.bridge || (options.driver && options.driver.callShim ? options.driver : null);
        const MemClass = getGlobalMemoryClass();
        if (options.memory) {
            this.memory = options.memory;
        } else if (options.module && MemClass) {
            this.memory = new MemClass(options.module);
        } else {
            this.memory = null;
        }

        // 動作モード: DirectBinding Native (フォールバック撤廃・純化)
        this._mode = 'native';

        // サブモジュール・アダプタ群の初期化
        this.discoveryAdapter = new DiscoveryWasmAdapter();
        this.playerAdapter = new PlayerWasmAdapter();
        this.monsterAdapter = new MonsterWasmAdapter();
        this.spatialAdapter = new SpatialWasmAdapter();
        this.inventoryAdapter = new InventoryWasmAdapter();
        this.syncCoordinator = new WasmSyncCoordinator();
    }

    // --- キャッシュプロパティの後方互換プロキシ ---
    get _cachedDiscoveries() { return this.discoveryAdapter.cachedDiscoveries; }
    set _cachedDiscoveries(v) { this.discoveryAdapter.cachedDiscoveries = v; }
    get _cachedDescrIndexes() { return this.discoveryAdapter.cachedDescrIndexes; }
    set _cachedDescrIndexes(v) { this.discoveryAdapter.cachedDescrIndexes = v; }

    get _cachedSkills() { return this.playerAdapter.cachedSkills; }
    set _cachedSkills(v) { this.playerAdapter.cachedSkills = v; }
    get _cachedWeaponSlots() { return this.playerAdapter.cachedWeaponSlots; }
    set _cachedWeaponSlots(v) { this.playerAdapter.cachedWeaponSlots = v; }
    get _cachedSpells() { return this.playerAdapter.cachedSpells; }
    set _cachedSpells(v) { this.playerAdapter.cachedSpells = v; }
    get _cachedPlayerProps() { return this.playerAdapter.cachedPlayerProps; }
    set _cachedPlayerProps(v) { this.playerAdapter.cachedPlayerProps = v; }
    get _cachedPlayerSummary() { return this.playerAdapter.cachedPlayerSummary; }
    set _cachedPlayerSummary(v) { this.playerAdapter.cachedPlayerSummary = v; }
    get _cachedPlayerProfile() { return this.playerAdapter.cachedPlayerProfile; }
    set _cachedPlayerProfile(v) { this.playerAdapter.cachedPlayerProfile = v; }

    get _cachedMonsters() { return this.monsterAdapter.cachedMonsters; }
    set _cachedMonsters(v) { this.monsterAdapter.cachedMonsters = v; }

    get _cachedCellInfo() { return this.spatialAdapter.cachedCellInfo; }
    set _cachedCellInfo(v) { this.spatialAdapter.cachedCellInfo = v; }
    get _cachedCellX() { return this.spatialAdapter.cachedCellX; }
    set _cachedCellX(v) { this.spatialAdapter.cachedCellX = v; }
    get _cachedCellY() { return this.spatialAdapter.cachedCellY; }
    set _cachedCellY(v) { this.spatialAdapter.cachedCellY = v; }
    get _cachedRoom() { return this.spatialAdapter.cachedRoom; }
    set _cachedRoom(v) { this.spatialAdapter.cachedRoom = v; }
    get _cachedTrap() { return this.spatialAdapter.cachedTrap; }
    set _cachedTrap(v) { this.spatialAdapter.cachedTrap = v; }
    get _cachedEngraving() { return this.spatialAdapter.cachedEngraving; }
    set _cachedEngraving(v) { this.spatialAdapter.cachedEngraving = v; }
    get _cachedLevelTerrain() { return this.spatialAdapter.cachedLevelTerrain; }
    set _cachedLevelTerrain(v) { this.spatialAdapter.cachedLevelTerrain = v; }
    get _cachedLevelGlyphs() { return this.spatialAdapter.cachedLevelGlyphs; }
    set _cachedLevelGlyphs(v) { this.spatialAdapter.cachedLevelGlyphs = v; }

    get _cachedInventory() { return this.inventoryAdapter.cachedInventory; }
    set _cachedInventory(v) { this.inventoryAdapter.cachedInventory = v; }
    get _cachedInventoryWeight() { return this.inventoryAdapter.cachedInventoryWeight; }
    set _cachedInventoryWeight(v) { this.inventoryAdapter.cachedInventoryWeight = v; }
    get _cachedPlayerFloorObjects() { return this.inventoryAdapter.cachedPlayerFloorObjects; }
    set _cachedPlayerFloorObjects(v) { this.inventoryAdapter.cachedPlayerFloorObjects = v; }
    get _cachedFloorObjectsX() { return this.inventoryAdapter.cachedFloorObjectsX; }
    set _cachedFloorObjectsX(v) { this.inventoryAdapter.cachedFloorObjectsX = v; }
    get _cachedFloorObjectsY() { return this.inventoryAdapter.cachedFloorObjectsY; }
    set _cachedFloorObjectsY(v) { this.inventoryAdapter.cachedFloorObjectsY = v; }
    get _hasFloorObjectsCache() { return this.inventoryAdapter.hasFloorObjectsCache; }
    set _hasFloorObjectsCache(v) { this.inventoryAdapter.hasFloorObjectsCache = v; }
    get _cachedEquipmentPtrs() { return this.inventoryAdapter.cachedEquipmentPtrs; }
    set _cachedEquipmentPtrs(v) { this.inventoryAdapter.cachedEquipmentPtrs = v; }

    get _syncGeneration() { return this.syncCoordinator.syncGeneration; }
    set _syncGeneration(v) { this.syncCoordinator.syncGeneration = v; }
    get _isSyncing() { return this.syncCoordinator.isSyncing; }
    set _isSyncing(v) { this.syncCoordinator.isSyncing = v; }
    get isSyncing() { return this.syncCoordinator.isSyncing; }
    get _currentSyncPromise() { return this.syncCoordinator.currentSyncPromise; }
    set _currentSyncPromise(v) { this.syncCoordinator.currentSyncPromise = v; }
    get currentSyncPromise() { return this.syncCoordinator.currentSyncPromise; }
    get _lastCompletedSyncGeneration() { return this.syncCoordinator.lastCompletedSyncGeneration; }
    set _lastCompletedSyncGeneration(v) { this.syncCoordinator.lastCompletedSyncGeneration = v; }

    /**
     * Phase 1 (ACTION): ユーザー操作送出時に呼び出し、Sync Barrier 世代を進めて
     * 実行中の古い非同期 Shim 同期レスポンスを破棄（Stale Cancel）させる
     * @returns {number} 更新後の世代ID
     */
    notifyActionSent() {
        return this.syncCoordinator.notifyActionSent(this.inventoryAdapter);
    }

    /**
     * フロア移動時 (clear_nhwindow / prepareFloorTransition) に前フロアのキャッシュを無効化
     */
    clearFloorCaches() {
        this.spatialAdapter.clearFloorCaches();
        this.monsterAdapter.clearFloorCaches();
        this.inventoryAdapter.clearFloorCaches();
    }

    /**
     * プレイヤーに関する全キャッシュ（プロファイル・耐性・スキル・魔法等）を無効化
     */
    clearPlayerCaches() {
        this.playerAdapter.clearPlayerCaches();
    }

    /**
     * 全てのアダプタのキャッシュおよび同期状態を一括破棄・リセット (新ゲーム開始 / リスタート時)
     */
    resetAllCaches() {
        this.clearPlayerCaches();
        this.clearFloorCaches();
        this.discoveryAdapter.resetCache?.();
        this.inventoryAdapter.resetCache?.();
        this.syncCoordinator.reset?.();
    }

    /**
     * 現在の Sync Barrier 世代IDを取得
     * @returns {number}
     */
    get syncGeneration() {
        return this._syncGeneration;
    }

    /**
     * 動作モード ('native') の取得
     * @returns {'native'}
     */
    get mode() {
        return 'native';
    }

    /**
     * 動作モードの設定 (DirectBinding Native 化に伴い no-op 後方互換プロキシ)
     * @param {string} val
     */
    set mode(val) {
        this._mode = 'native';
    }

    /**
     * 動作モードのエイリアス
     */
    get directBindingMode() {
        return 'native';
    }

    set directBindingMode(val) {
        this._mode = 'native';
    }

    /**
     * 動作モードの設定 (APIメソッド: 後方互換 no-op)
     * @param {string} val
     */
    setMode(val) {
        this._mode = 'native';
    }

    /**
     * NetHackWasmWorkerBridge インスタンスの設定
     * @param {Object} bridge
     */
    setBridge(bridge) {
        this.bridge = bridge;
    }

    /**
     * NetHackMemory インスタンスの設定
     * @param {Object} mem 
     */
    setMemory(mem) {
        this.memory = mem;
    }

    /**
     * Wasm モジュールの参照取得
     * @returns {Object|null}
     */
    get Module() {
        return this.memory ? this.memory.Module : (typeof globalThis !== 'undefined' ? globalThis.Module : null);
    }

    /**
     * 生メモリ (_shim_bridge_call) への直接参照が存在し利用可能か判定
     * @returns {boolean}
     */
    get hasLiveMemory() {
        if (!this.memory) return false;
        if (typeof this.memory.isBridgeAvailable === 'function') {
            return this.memory.isBridgeAvailable();
        }
        const M = this.Module;
        return Boolean(M && (typeof M._shim_bridge_call === 'function' || M._shim_bridge_call));
    }

    /**
     * 直接メモリバインディング（_shim_bridge_call または WorkerBridge.callShim）が利用可能かどうかを判定 (DirectBinding Native)
     * @returns {boolean}
     */
    isAvailable() {
        if (this.bridge && typeof this.bridge.callShim === 'function') return true;
        if (this.hasLiveMemory) return true;
        if (this._cachedCellInfo || this._cachedLevelTerrain || (this._cachedInventory && this._cachedInventory.length > 0) || (this._cachedMonsters && this._cachedMonsters.size > 0)) {
            return true;
        }
        return false;
    }

    /**
     * DUMP_OBJECT_INFO (32バイト, 8個のint32) バッファからアイテム構造化データをデコード (ドメイン集約)
     * @param {Array<number>|Int32Array} rawValues 
     * @param {number} [ptr=0] 
     * @param {number} [cobjPtr=0] 
     * @param {number} [o_id=0] 
     * @param {number} [corpsenm=-1]
     * @returns {Object|null}
     */
    unpackObjectBuffer(rawValues, ptr = 0, cobjPtr = 0, o_id = 0, corpsenm = -1) {
        return this.inventoryAdapter.unpackObjectBuffer(rawValues, ptr, cobjPtr, o_id, corpsenm);
    }

    /**
     * 所持品リンクリスト (gi.invent) を直接走査し、全アイテムの構造化データを取得
     * @returns {Array<Object>} アイテム構造化情報配列
     */
    getInventory() {
        return this.inventoryAdapter.getInventory(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 14 種類の装備スロットポインタ配列と対応マップを取得
     * @returns {{ rawPtrs: Object, slotByPtr: Map<number, string>, ptrBySlot: Map<string, number> }}
     */
    getEquipmentPtrs() {
        return this.inventoryAdapter.getEquipmentPtrs(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 全アイテムの識別状態 (objects[i].oc_name_known) 配列を取得
     * @returns {Uint8Array|null} 各 onum の識別フラグ (1: 既知, 0: 未知)
     */
    getDiscoveries() {
        return this.discoveryAdapter.getDiscoveries(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 特定 onum のプレイヤー仮名 (objects[otyp].oc_uname) を取得
     * @param {number} onum 
     * @returns {string|null}
     */
    getObjectUname(onum) {
        return this.discoveryAdapter.getObjectUname(onum, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * テスト用 / Worker 受信用 プレイヤー仮名キャッシュ設定
     * @param {number} onum
     * @param {string|null} uname
     */
    setCachedObjectUname(onum, uname) {
        this.discoveryAdapter.setCachedObjectUname(onum, uname);
    }

    /**
     * 全アイテムの現在の外見インデックス (objects[i].oc_descr_idx) 配列を取得
     * @returns {Int32Array|null} 各 onum の現在の外見インデックス (appearanceOnum)
     */
    getDescrIndexes() {
        return this.discoveryAdapter.getDescrIndexes(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * テスト用 / Worker 受信用 外見インデックス配列キャッシュ設定
     * @param {Int32Array|Array<number>|null} arr
     */
    setCachedDescrIndexes(arr) {
        this.discoveryAdapter.setCachedDescrIndexes(arr);
    }

    /**
     * 所持品リンクリストから真の総所持重量を取得 (Stage 8.2-C)
     * (手持ち品・金貨・Bag of Holding の補正を含む完全な公式計算値)
     * @returns {number} 総所持重量 (利用不可時: -1)
     */
    getInventoryWeight() {
        return this.inventoryAdapter.getInventoryWeight(this.memory, this.isAvailable(), this.hasLiveMemory, () => this.getInventory());
    }

    /**
     * 単一アイテムの真の重量を取得 (Bag of Holding 等の補正含む) (Stage 8.2-C)
     * @param {number} objPtr 
     * @returns {number} アイテム重量 (利用不可時: -1)
     */
    getObjectWeight(objPtr) {
        return this.inventoryAdapter.getObjectWeight(objPtr, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * コンテナの内包物含む真の重量を取得 (Stage 8.2-C)
     * @param {number} objPtr 
     * @returns {number} コンテナ重量 (利用不可時: -1)
     */
    getContainerWeight(objPtr) {
        return this.inventoryAdapter.getContainerWeight(objPtr, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * Web Worker 隔離環境用：ターン確定時に足元セル情報やインベントリを非同期で一括同期 (Stage 8.2-A / Stage 8.3-B Sync Barrier)
     * @param {Object} [options={}]
     * @param {number} [options.playerX]
     * @param {number} [options.playerY]
     * @returns {Promise<boolean>}
     */
    async syncFromWorkerBridge(options = {}) {
        const adapters = {
            discovery: this.discoveryAdapter,
            player: this.playerAdapter,
            monster: this.monsterAdapter,
            spatial: this.spatialAdapter,
            inventory: this.inventoryAdapter
        };
        const fallbackCoords = {
            x: this.spatialAdapter.cachedCellX,
            y: this.spatialAdapter.cachedCellY
        };
        return await this.syncCoordinator.syncFromWorkerBridge(
            options,
            this.bridge,
            this._mode,
            adapters,
            fallbackCoords,
            this
        );
    }

    /**
     * 属性・耐性詳細 (GET_PLAYER_PROPS) のオンデマンド同期 (開くときトリガー)
     * @returns {Promise<boolean>}
     */
    async syncAttributesOnDemand() {
        return await this.syncCoordinator.syncAttributesOnDemand(
            this.bridge,
            this.isAvailable(),
            this.hasLiveMemory,
            this.playerAdapter
        );
    }

    /**
     * スキル熟練度 (DUMP_SKILLS) のオンデマンド同期 (開くときトリガー)
     * @returns {Promise<boolean>}
     */
    async syncSkillsOnDemand() {
        return await this.syncCoordinator.syncSkillsOnDemand(
            this.bridge,
            this.isAvailable(),
            this.hasLiveMemory,
            this.playerAdapter,
            this.memory
        );
    }

    /**
     * 呪文リスト (DUMP_SPELL_BOOK) のオンデマンド同期 (開くときトリガー)
     * @returns {Promise<boolean>}
     */
    async syncSpellBookOnDemand() {
        return await this.syncCoordinator.syncSpellBookOnDemand(
            this.bridge,
            this.isAvailable(),
            this.hasLiveMemory,
            this.playerAdapter,
            this.memory
        );
    }

    /**
     * 発見状態 (DUMP_DISCOVERIES / DUMP_DESCR_INDEXES) のオンデマンド同期 (開くときトリガー)
     * @param {Array<number>} [extraOnums=[]]
     * @returns {Promise<boolean>}
     */
    async syncDiscoveriesOnDemand(extraOnums = []) {
        const onums = new Set(Array.isArray(extraOnums) ? extraOnums : []);
        if (this._cachedInventory && Array.isArray(this._cachedInventory)) {
            for (const it of this._cachedInventory) {
                if (typeof it.onum === 'number' && it.onum >= 0) {
                    onums.add(it.onum);
                }
            }
        }
        return await this.syncCoordinator.syncDiscoveriesOnDemand(
            this.bridge,
            this.isAvailable(),
            this.hasLiveMemory,
            this.discoveryAdapter,
            this.memory,
            [...onums]
        );
    }

    /**
     * 全スキル熟練度の一括ダンプ同期 (DUMP_SKILLS)
     * @returns {Array<Object>}
     */
    dumpSkills() {
        return this.playerAdapter.dumpSkills(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 最新の全スキルリストを取得
     * @returns {Array<Object>}
     */
    getSkills() {
        return this.playerAdapter.getSkills(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 全呪文リストの一括ダンプ同期 (DUMP_SPELL_BOOK)
     * @returns {Array<Object>}
     */
    dumpSpellBook() {
        return this.playerAdapter.dumpSpellBook(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 最新の全呪文リストを取得
     * @returns {Array<Object>}
     */
    getSpellBook() {
        return this.playerAdapter.getSpellBook(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 指定座標群のモンスター情報を一括非同期取得 (Worker 調停対応)
     * @param {Array<{x: number, y: number}>} coords
     * @returns {Promise<Array<Object>>}
     */
    async syncSurroundingMonsters(coords = []) {
        return await this.syncCoordinator.syncSurroundingMonsters(coords, (x, y) => this.fetchFullMonsterAt(x, y));
    }

    /**
     * 指定座標の真のセル情報（typ, flags, lit, roomno）を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getCellInfo(x, y) {
        return this.spatialAdapter.getCellInfo(x, y, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 現在のフロア全体 (80x21) の真の床・地形 (typ) を一括ダンプ
     * @returns {Uint8Array|null}
     */
    dumpLevelTerrain() {
        return this.spatialAdapter.dumpLevelTerrain(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 現在のフロア全体 (80x21) の真の地形を一括非同期取得 (Worker 調停対応)
     * @returns {Promise<Uint8Array|null>}
     */
    async fetchLevelTerrain() {
        return this.spatialAdapter.fetchLevelTerrain(this.bridge, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * テスト用 / Worker 受信用 地形キャッシュ設定
     * @param {Uint8Array|Array<number>} terrain
     */
    setCachedLevelTerrain(terrain) {
        this.spatialAdapter.setCachedLevelTerrain(terrain);
    }

    /**
     * 現在のフロア全体 (80x21) の完成形グリフ (levl.glyph) を一括ダンプ
     * @returns {Int32Array|null}
     */
    dumpLevelGlyphs() {
        return this.spatialAdapter.dumpLevelGlyphs(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 指定セルの純粋な真の地形グリフ (back_to_glyph) をリアルタイム取得
     * @param {number} x
     * @param {number} y
     * @returns {number|null}
     */
    getCellGlyph(x, y) {
        return this.spatialAdapter.getCellGlyph(this.memory, this.isAvailable(), this.hasLiveMemory, x, y);
    }

    /**
     * 現在のフロア全体 (80x21) の完成形グリフを一括非同期取得 (Worker 調停対応)
     * @returns {Promise<Int32Array|null>}
     */
    async fetchLevelGlyphs() {
        return this.spatialAdapter.fetchLevelGlyphs(this.bridge, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * テスト用 / Worker 受信用 グリフキャッシュ設定
     * @param {Int32Array|Array<number>} glyphs
     */
    setCachedLevelGlyphs(glyphs) {
        this.spatialAdapter.setCachedLevelGlyphs(glyphs);
    }

    /**
     * 指定座標の罠情報を取得 (存在しない場合は null)
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getTrapAt(x, y) {
        return this.spatialAdapter.getTrapAt(x, y, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 指定座標の刻み文字（彫り・Elbereth等）を取得 (存在しない場合は null)
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getEngravingAt(x, y) {
        return this.spatialAdapter.getEngravingAt(x, y, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 部屋番号 (roomno) から部屋種別（通常・店舗・寺院・動物園等）を取得
     * @param {number} roomno
     * @returns {Object|null}
     */
    getRoomType(roomno) {
        return this.spatialAdapter.getRoomType(roomno, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 指定座標のモンスターポインタを取得 (存在しない場合は 0)
     * @param {number} x
     * @param {number} y
     * @returns {number} struct monst*
     */
    getMonsterAt(x, y) {
        return this.monsterAdapter.getMonsterAt(x, y, this.memory, this.hasLiveMemory);
    }

    /**
     * 指定座標のモンスター情報 (平和/ペット/HP/最大HP) を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getMonsterInfo(x, y) {
        return this.monsterAdapter.getMonsterInfo(x, y, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 指定座標のモンスター動的状態 (睡眠/逃走/麻痺/混乱/店主/僧侶等) を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getMonsterState(x, y) {
        return this.monsterAdapter.getMonsterState(x, y, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 指定座標のモンスター完全詳細 (HP・属性・状態異常・フラグ) を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getFullMonsterAt(x, y) {
        return this.monsterAdapter.getFullMonsterAt(x, y, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * 指定座標のモンスター完全詳細を非同期で取得 (Worker 調停対応)
     * @param {number} x
     * @param {number} y
     * @returns {Promise<Object|null>}
     */
    async fetchFullMonsterAt(x, y) {
        return this.monsterAdapter.fetchFullMonsterAt(x, y, this.bridge, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * テスト用 / Worker 受信用 モンスターキャッシュ設定
     * @param {number} x
     * @param {number} y
     * @param {Object} monster
     */
    setCachedMonster(x, y, monster) {
        this.monsterAdapter.setCachedMonster(x, y, monster);
    }

    /**
     * 指定座標 (x, y) の床アイテム情報が同期・参照可能かどうかを判定 (Stage 8.3-B)
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    hasFloorObjectsCacheAt(x, y) {
        return this.inventoryAdapter.hasFloorObjectsCacheAt(x, y, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * テスト用 / Worker 受信用 床落ちアイテムキャッシュ設定
     * @param {number} x
     * @param {number} y
     * @param {Array<Object>|null} items
     */
    setCachedFloorObjects(x, y, items) {
        this.inventoryAdapter.setCachedFloorObjects(x, y, items, (cx, cy) => {
            this._cachedCellX = cx;
            this._cachedCellY = cy;
        });
    }

    /**
     * 指定座標 (x, y) の床に落ちているアイテム一覧を取得 (Stage 8.2-C)
     * @param {number} x
     * @param {number} y
     * @returns {Array<Object>}
     */
    getObjectsAt(x, y) {
        return this.inventoryAdapter.getObjectsAt(x, y, this.memory, this.isAvailable(), this.hasLiveMemory, this._cachedCellX, this._cachedCellY);
    }

    /**
     * 指定座標 (x, y) の床アイテム一覧を非同期で問い合わせ取得 (Worker調停対応・汎用callShim利用) (Stage 8.2-C / 8.3-B)
     * @param {number} x
     * @param {number} y
     * @returns {Promise<Array<Object>>}
     */
    async fetchObjectsAt(x, y) {
        return this.inventoryAdapter.fetchObjectsAt(x, y, this.bridge, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * プレイヤーの真の属性・耐性配列 (u.uprops: 69要素) を取得
     * 各要素: (intrinsic & 0xFFFF) | ((extrinsic & 0xFFFF) << 16)
     * @returns {Array<number>|null}
     */
    getPlayerProps() {
        return this.playerAdapter.getPlayerProps(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * プレイヤーの属性・耐性配列を非同期取得 (Worker 調停対応)
     * @returns {Promise<Array<number>|null>}
     */
    async fetchPlayerProps() {
        return this.playerAdapter.fetchPlayerProps(this.bridge, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * プレイヤーの真値プロファイル (種族・職業・属性・性別等) を取得 (Stage 8.5)
     * @returns {Object|null}
     */
    getPlayerProfile() {
        return this.playerAdapter.getPlayerProfile(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * プレイヤーの真値プロファイルを非同期取得 (Worker 調停対応) (Stage 8.5)
     * @returns {Promise<Object|null>}
     */
    async fetchPlayerProfile() {
        return this.playerAdapter.fetchPlayerProfile(this.bridge, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * プレイヤープロファイル (SHIM_CMD_GET_PLAYER_PROFILE) のオンデマンド同期 (Stage 8.5)
     * @returns {Promise<boolean>}
     */
    async syncPlayerProfileOnDemand() {
        return await this.syncCoordinator.syncPlayerProfileOnDemand(
            this.bridge,
            this.isAvailable(),
            this.hasLiveMemory,
            this.playerAdapter,
            this.memory
        );
    }

    /**
     * プレイヤーのサマリー情報 (dnum, dlevel, ublesscnt, ugangr等) を取得 (Stage 8.4)
     * @returns {Object|null}
     */
    getPlayerSummary() {
        return this.playerAdapter.getPlayerSummary(this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * プレイヤーのサマリー情報を非同期取得 (Worker 調停対応) (Stage 8.4)
     * @returns {Promise<Object|null>}
     */
    async fetchPlayerSummary() {
        return this.playerAdapter.fetchPlayerSummary(this.bridge, this.memory, this.isAvailable(), this.hasLiveMemory);
    }

    /**
     * プレイヤーサマリー (SHIM_CMD_GET_PLAYER_SUMMARY) のオンデマンド同期 (Stage 8.4)
     * @returns {Promise<boolean>}
     */
    async syncPlayerSummaryOnDemand() {
        return await this.syncCoordinator.syncPlayerSummaryOnDemand(
            this.bridge,
            this.isAvailable(),
            this.hasLiveMemory,
            this.playerAdapter,
            this.memory
        );
    }
}

export default WasmDirectBindingService;
