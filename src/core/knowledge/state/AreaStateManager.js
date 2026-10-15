/**
 * AreaStateManager.js
 * 80x24 マップの多層セル状態キャッシュ (bottom/middle/top/effect/engraving) の保持、
 * dirtyCells 差分追跡、WasmDirectBindingService 同期、および
 * 各サブモジュール (TerrainInferenceEngine, DungeonLandmarkRegistry, ViewportTileProjector) への統括窓口 (Core & Facade)
 */

import { classifyGlyph, ENTITY_TYPES, GLYPH_OFFSETS } from "../engines/glyphClassifier.js";
import {
    TerrainInferenceEngine,
    DEFAULT_INFERRED_FLOOR_GLYPH,
    DEFAULT_TOMBSTONE_GLYPH,
    createInferredFloor
} from "./area/TerrainInferenceEngine.js";
import {
    DungeonLandmarkRegistry,
    normalizeFloorKey,
    parseFloorLevel
} from "./area/DungeonLandmarkRegistry.js";
import { ViewportTileProjector } from "./area/ViewportTileProjector.js";

export {
    DEFAULT_INFERRED_FLOOR_GLYPH,
    DEFAULT_TOMBSTONE_GLYPH,
    createInferredFloor,
    normalizeFloorKey,
    parseFloorLevel,
    TerrainInferenceEngine,
    DungeonLandmarkRegistry,
    ViewportTileProjector
};

export class AreaStateManager {
    constructor(width = 80, height = 24, monsterTracker = null, directBindingService = null) {
        this.width = width;
        this.height = height;
        this.playerX = 0;
        this.playerY = 0;
        this.prevPlayerX = 0;
        this.prevPlayerY = 0;
        this.lastMoveDx = 0;
        this.lastMoveDy = 0;
        this.keyMode = 'numpad'; // キーモード ('vi' | 'numpad')
        this.monsterTracker = monsterTracker;
        this.directBindingService = directBindingService;

        // サブモジュールの初期化 (Phase 8 先行着手 3: 4モジュール責務分離)
        this.landmarkRegistry = new DungeonLandmarkRegistry(this);
        this.terrainInference = new TerrainInferenceEngine(this);
        this.viewportProjector = new ViewportTileProjector(this);

        this.engravingCache = new Map(); // 現在フロアの床文字同定キャッシュ ("x,y" => EngravingData)
        this.dirtyCells = new Set();     // 変更があったセルの座標キャッシュ ("x,y")
        this.grid = [];
        this.resetGrid();

        // 動作モード ('auto' | 'strict' | 'fallback') (Stage 8.2-B)
        this.directBindingMode = 'auto';
        this._warnedStrictCoords = new Set();

        // 同期テレメトリ (Stage 8.2-B)
        this.lastFloorMethod = 'NONE'; // 'NONE' | 'SHIM_DIRECT' | 'INFERRED_FALLBACK'
        this.inferredFloorCount = 0;
        this.genuineFloorCount = 0;
        this.lastFloorSync = { source: 'NONE', glyph: -1, typ: -1, isGenuine: false };

        // Turn Lifecycle / Sync Barrier 状態管理 (Stage 8.3-B)
        this.isTurnTransitioning = false;
        this.isFloorTransitioning = false;
        this._needsFullTerrainDump = true;
        this.committedTurnCount = 0;

        // ブランチ同定・追跡 (Stage 8.4)
        this.currentBranchId = 'dungeon';
        this.currentDnum = 0;
        this.currentDlevel = 1;
        this.playerSummary = null;
    }

    /**
     * Phase 1 (ACTION): ユーザーアクション送出時のターン遷移開始マーク
     */
    beginTurnTransition() {
        this.isTurnTransitioning = true;
    }

    /**
     * Phase 4 (COMMIT): Shim 同期完了後の状態確定コミット
     */
    commitTurnState() {
        this.isTurnTransitioning = false;
        this.isFloorTransitioning = false;
        this.committedTurnCount += 1;
    }

    // --- 後方互換性のための状態プロキシ (DungeonLandmarkRegistry への透過アクセサ) ---
    get currentFloor() { return this.landmarkRegistry.currentFloor; }
    set currentFloor(val) { this.landmarkRegistry.currentFloor = val; }
    get prevFloor() { return this.landmarkRegistry.prevFloor; }
    set prevFloor(val) { this.landmarkRegistry.prevFloor = val; }
    get justTransitionedFloor() { return this.landmarkRegistry.justTransitionedFloor; }
    set justTransitionedFloor(val) { this.landmarkRegistry.justTransitionedFloor = val; }
    get stairCache() { return this.landmarkRegistry.stairCache; }
    set stairCache(val) { this.landmarkRegistry.stairCache = val; }
    get landmarkCache() { return this.landmarkRegistry.landmarkCache; }
    set landmarkCache(val) { this.landmarkRegistry.landmarkCache = val; }
    get _hasSeededInitialStair() { return this.landmarkRegistry._hasSeededInitialStair; }
    set _hasSeededInitialStair(val) { this.landmarkRegistry._hasSeededInitialStair = val; }
    get isFloorPending() { return this.landmarkRegistry.isFloorPending; }
    set isFloorPending(val) { this.landmarkRegistry.isFloorPending = val; }
    get pendingStairs() { return this.landmarkRegistry.pendingStairs; }
    set pendingStairs(val) { this.landmarkRegistry.pendingStairs = val; }
    get pendingLandmarks() { return this.landmarkRegistry.pendingLandmarks; }
    set pendingLandmarks(val) { this.landmarkRegistry.pendingLandmarks = val; }

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
        if (this._warnedStrictCoords) {
            this._warnedStrictCoords.clear();
        }
        if (this.directBindingService && typeof this.directBindingService.setMode === 'function') {
            this.directBindingService.setMode(this.directBindingMode);
        }
    }

    /**
     * WasmDirectBindingService インスタンスを設定
     * @param {Object} service 
     */
    setDirectBindingService(service) {
        this.directBindingService = service;
        if (this.directBindingService && typeof this.directBindingService.setMode === 'function') {
            this.directBindingService.setMode(this.directBindingMode);
        }
    }

    /**
     * MonsterTracker インスタンスを設定
     * @param {Object} tracker 
     */
    setMonsterTracker(tracker) {
        this.monsterTracker = tracker;
    }

    /**
     * キーモードの指定 ('vi' または 'numpad')
     * @param {'vi'|'numpad'} mode 
     */
    setKeyMode(mode) {
        if (mode === 'numpad' || mode === 'vi') {
            this.keyMode = mode;
        }
    }

    // --- 差分更新追跡 (Dirty Cells) & グリッド管理 ---

    /**
     * 指定セルの差分更新フラグを付与
     * @param {number} x
     * @param {number} y
     */
    markDirty(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.dirtyCells.add(`${x},${y}`);
        }
    }

    /**
     * 全セルの差分更新フラグを一括付与
     */
    markAllDirty() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.dirtyCells.add(`${x},${y}`);
            }
        }
    }

    /**
     * 差分セル一覧を取得
     * @returns {Set<string>}
     */
    getDirtyCells() {
        return this.dirtyCells;
    }

    /**
     * 差分セル一覧をクリア
     */
    clearDirtyCells() {
        this.dirtyCells.clear();
    }

    /**
     * グリッドキャッシュを初期化
     */
    resetGrid() {
        if (this.monsterTracker && typeof this.monsterTracker.reset === 'function') {
            this.monsterTracker.reset();
        }
        this.lastMoveDx = 0;
        this.lastMoveDy = 0;
        this._needsFullTerrainDump = true;
        if (this.engravingCache) {
            this.engravingCache.clear();
        }
        this.grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push({
                    x,
                    y,
                    bottom: null, // 地形 / トラップ
                    middle: null, // アイテム / 死体 / 像
                    top: null,    // モンスター / プレイヤー
                    effect: null  // エフェクト（ビーム・稲妻・爆発等の過渡的表示）
                });
            }
            this.grid.push(row);
        }
        this.markAllDirty();
    }

    /**
     * グリッドおよび全キャッシュを完全リセット
     */
    resetAll() {
        this.isTurnTransitioning = false;
        this.isFloorTransitioning = false;
        this._needsFullTerrainDump = true;
        if (this.directBindingService && typeof this.directBindingService.clearFloorCaches === 'function') {
            this.directBindingService.clearFloorCaches();
        }
        this.resetGrid();
        this.clearLandmarks();
    }

    // --- 床文字 (Engraving) キャッシュ管理 ---

    getEngravingAt(x, y) {
        if (!this.engravingCache) return null;
        return this.engravingCache.get(`${x},${y}`) || null;
    }

    setEngravingAt(x, y, data) {
        if (!this.engravingCache || !data) return;
        this.engravingCache.set(`${x},${y}`, data);
    }

    clearEngravingAt(x, y) {
        if (!this.engravingCache) return;
        this.engravingCache.delete(`${x},${y}`);
    }

    // --- TerrainInferenceEngine 委譲メソッド ---

    getGlyphForTerrainType(typ, x = 0, y = 0, doorState = null) {
        return this.terrainInference.getGlyphForTerrainType(typ, x, y, doorState);
    }

    getGenuineFloor(x, y) {
        return this.terrainInference.getGenuineFloor(x, y);
    }

    // --- DungeonLandmarkRegistry 委譲メソッド ---

    prepareFloorTransition() {
        this.isFloorTransitioning = true;
        this._needsFullTerrainDump = true;
        if (this.directBindingService && typeof this.directBindingService.clearFloorCaches === 'function') {
            this.directBindingService.clearFloorCaches();
        }
        this.landmarkRegistry.prepareFloorTransition();
        this.resetGrid();
    }

    applyStairCacheForFloor(floorKey = this.currentFloor) {
        return this.landmarkRegistry.applyStairCacheForFloor(floorKey);
    }

    setCurrentFloor(floorKey, options = {}) {
        const prev = this.currentFloor;
        const res = this.landmarkRegistry.setCurrentFloor(floorKey, options);
        if (this.currentFloor !== prev) {
            this._needsFullTerrainDump = true;
        }
        return res;
    }

    /**
     * Wasm Cコア Direct Binding から取得したプレイヤーサマリーを同期 (Stage 8.4)
     * dnum からブランチ (main, mines, gehennom等) を 100% 確定同定し、
     * branch:dlvl 形式でフロアキャッシュを分離。
     * @param {Object} [summary] - 省略時は directBindingService.getPlayerSummary() を参照
     * @returns {{ isNewFloor: boolean, isNewBranch: boolean, floorKey: string, branchId: string, branchName: string, branchNameJa: string, theme: string, dlevel: number }|null}
     */
    syncPlayerSummary(summary = null) {
        const s = summary || (this.directBindingService && typeof this.directBindingService.getPlayerSummary === 'function'
            ? this.directBindingService.getPlayerSummary()
            : null);
        if (!s) return null;

        this.playerSummary = s;
        const prevBranch = this.currentBranchId;

        this.currentDnum = s.dnum ?? 0;
        this.currentDlevel = s.dlevel ?? 1;
        this.currentBranchId = s.branchId || 'dungeon';

        const targetFloorKey = s.floorKey || (this.currentDnum === 0 ? `Dlvl:${this.currentDlevel}` : `${this.currentBranchId}:${this.currentDlevel}`);
        const normalizedCurrent = normalizeFloorKey(this.currentFloor);
        const normalizedTarget = normalizeFloorKey(targetFloorKey);

        let isNewFloor = false;
        if (normalizedCurrent !== normalizedTarget) {
            // Direct Binding による階層同定（ブランチ名の確定や実階層の補正）は
            // プレイヤーが実際に階段を移動したのではなく、同一マップに対する識別名の確定である。
            // そのため、すでに描画されたマップグリッドを初期化(resetGrid)せず、フロアキーのみ同期・承継する。
            this.setCurrentFloor(normalizedTarget, { preserveGrid: true });
            isNewFloor = true;
        }

        const isNewBranch = Boolean(prevBranch && prevBranch !== this.currentBranchId);

        return {
            isNewFloor,
            isNewBranch,
            floorKey: normalizedTarget,
            branchId: this.currentBranchId,
            branchName: s.branchName,
            branchNameJa: s.branchNameJa,
            theme: s.theme,
            dlevel: this.currentDlevel
        };
    }

    clearStairCache() {
        return this.landmarkRegistry.clearStairCache();
    }

    clearLandmarkCache() {
        return this.landmarkRegistry.clearLandmarkCache();
    }

    clearLandmarks() {
        return this.landmarkRegistry.clearLandmarks();
    }

    _registerStairAt(x, y, stairGlyph, floorKey) {
        return this.landmarkRegistry.registerStairAt(x, y, stairGlyph, floorKey);
    }

    seedArrivalStair(x, y) {
        return this.landmarkRegistry.seedArrivalStair(x, y);
    }

    seedInitialStair(x, y) {
        return this.landmarkRegistry.seedInitialStair(x, y);
    }

    extractLandmarkEntity(x, y, glyphId, info = null) {
        return this.landmarkRegistry.extractLandmarkEntity(x, y, glyphId, info);
    }

    _saveLandmarkToCache(landmark, x, y, floorKey = null) {
        return this.landmarkRegistry.saveLandmarkToCache(landmark, x, y, floorKey);
    }

    static generateLandmarksSummary(allEntities = []) {
        return DungeonLandmarkRegistry.generateLandmarksSummary(allEntities);
    }

    getFloorLandmarks(floorKey = this.currentFloor) {
        return this.landmarkRegistry.getFloorLandmarks(floorKey);
    }

    getAllLandmarks() {
        return this.landmarkRegistry.getAllLandmarks();
    }

    // --- ViewportTileProjector 委譲メソッド ---

    getAreaState(cx = this.playerX, cy = this.playerY, radius = 1) {
        return this.viewportProjector.getAreaState(cx, cy, radius);
    }

    getFocusCameraTiles(radiusX = 10, radiusY = 4, options = {}) {
        return this.viewportProjector.getFocusCameraTiles(radiusX, radiusY, options);
    }

    // --- グリフ更新・プレイヤー位置同期・Wasm Direct Binding 同期 ---

    /**
     * 描画グリフの更新を受信し、3 階層キャッシュ＋エフェクトを即座に適用
     * @param {number} x 
     * @param {number} y 
     * @param {number} glyphId 
     * @param {Object} [glyphInfo] 
     * @param {Object} [bkglyphInfo]
     */
    updateGlyph(x, y, glyphId, glyphInfo = null, bkglyphInfo = null) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        let info = classifyGlyph(glyphId);
        if (glyphInfo && glyphInfo.ch === ' ') {
            info = { ...info, type: ENTITY_TYPES.UNEXPLORED };
        }
        const cell = this.grid[y][x];

        // ランドマークの検出と台帳への記録 (未踏領域は登録しない)
        if (info.type !== ENTITY_TYPES.UNEXPLORED) {
            const landmark = this.extractLandmarkEntity(x, y, glyphId, info);
            if (landmark) {
                if (this.isFloorPending) {
                    this.pendingLandmarks.push({ x, y, entity: landmark });
                } else {
                    this._saveLandmarkToCache(landmark, x, y);
                }
            }
        }

        switch (info.type) {
            case ENTITY_TYPES.UNEXPLORED:
                if (cell.top && this.monsterTracker && typeof this.monsterTracker.notifyCellLostMonster === 'function') {
                    this.monsterTracker.notifyCellLostMonster(x, y);
                }
                cell.bottom = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                cell.middle = null;
                cell.top = null;
                cell.effect = null;
                this.markDirty(x, y);
                break;

            case ENTITY_TYPES.TERRAIN:
                if (cell.top && this.monsterTracker && typeof this.monsterTracker.notifyCellLostMonster === 'function') {
                    this.monsterTracker.notifyCellLostMonster(x, y);
                }
                cell.bottom = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                cell.middle = null;
                cell.top = null;
                cell.effect = null;
                this.markDirty(x, y);

                if (info.cmapFlags && (info.cmapFlags.isStairUp || info.cmapFlags.isStairDown)) {
                    if (this.isFloorPending) {
                        this.pendingStairs.push({ x, y, entity: { ...cell.bottom } });
                    } else {
                        const key = `${normalizeFloorKey(this.currentFloor)}:${x},${y}`;
                        this.stairCache.set(key, { ...cell.bottom });
                    }
                }
                break;

            case ENTITY_TYPES.ITEM:
            case ENTITY_TYPES.BODY:
            case ENTITY_TYPES.STATUE:
                if (cell.top && this.monsterTracker && typeof this.monsterTracker.notifyCellLostMonster === 'function') {
                    this.monsterTracker.notifyCellLostMonster(x, y);
                }
                this.terrainInference.ensureBottomTerrain(cell, x, y, bkglyphInfo);
                cell.middle = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                cell.top = null;
                cell.effect = null;
                this.markDirty(x, y);

                // 押し出し先への大岩出現検知 (Case B)
                this.terrainInference.handleBoulderPushOnGlyphUpdate(x, y, glyphId);
                break;

            case ENTITY_TYPES.MONSTER:
            case ENTITY_TYPES.PET: {
                const existingDynamic = (cell.top && (cell.top.monOffset === info.monOffset || cell.top.glyph === glyphId))
                    ? cell.top.dynamicState
                    : null;

                // bkglyph がアイテム類なら cell.middle を更新し、TERRAIN なら古い cell.middle をクリアした上で cell.bottom を補完
                if (bkglyphInfo && typeof bkglyphInfo.glyph === 'number' &&
                    bkglyphInfo.glyph >= 0 && bkglyphInfo.glyph < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF &&
                    bkglyphInfo.ch !== ' ') {
                    const bgInfo = classifyGlyph(bkglyphInfo.glyph);
                    if (bgInfo.type === ENTITY_TYPES.ITEM || bgInfo.type === ENTITY_TYPES.BODY || bgInfo.type === ENTITY_TYPES.STATUE) {
                        cell.middle = {
                            ...bgInfo,
                            glyphInfo: bkglyphInfo,
                            glyph: bkglyphInfo.glyph,
                            rawGlyph: bkglyphInfo.glyph
                        };
                        this.terrainInference.ensureBottomTerrain(cell, x, y, null);
                    } else if (bgInfo.type === ENTITY_TYPES.TERRAIN) {
                        cell.middle = null;
                        this.terrainInference.ensureBottomTerrain(cell, x, y, bkglyphInfo);
                    } else {
                        this.terrainInference.ensureBottomTerrain(cell, x, y, bkglyphInfo);
                    }
                } else {
                    this.terrainInference.ensureBottomTerrain(cell, x, y, bkglyphInfo);
                }

                let directMon = null;
                if (this.directBindingService && typeof this.directBindingService.getFullMonsterAt === 'function') {
                    directMon = this.directBindingService.getFullMonsterAt(x, y);
                }

                cell.top = {
                    ...info,
                    glyphInfo,
                    glyph: glyphId,
                    rawGlyph: glyphId,
                    dynamicState: existingDynamic,
                    ...(directMon ? {
                        isPeaceful: directMon.peaceful,
                        isTame: directMon.tame,
                        isShopkeeper: directMon.isShopkeeper || info.isShopkeeper,
                        isPriest: directMon.isPriest,
                        hp: directMon.hp,
                        hpmax: directMon.hpmax,
                        directState: directMon,
                        dynamicState: {
                            ...(existingDynamic || {}),
                            hp: directMon.hp,
                            hpmax: directMon.hpmax,
                            isPeaceful: directMon.peaceful,
                            sleeping: directMon.sleeping,
                            fleeing: directMon.fleeing,
                            paralyzed: directMon.paralyzed
                        }
                    } : {})
                };
                cell.effect = null;
                this.markDirty(x, y);
                if (this.monsterTracker && typeof this.monsterTracker.updateVisibleMonster === 'function') {
                    this.monsterTracker.updateVisibleMonster(x, y, glyphId, glyphInfo, { x: this.playerX, y: this.playerY });
                }
                break;
            }

            case ENTITY_TYPES.EFFECT:
                cell.effect = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                this.markDirty(x, y);
                break;

            default:
                break;
        }
    }

    /**
     * 指定座標 (デフォルト: プレイヤー足元) の床落ちアイテム (cell.middle) を Shim から照合・確定更新 (Stage 8.3-B)
     * - 0個になった場合: cell.middle !== null なら cell.middle = null に消去し markDirty(x, y)
     * - 1個以上ある場合: 先頭アイテム + 山積みフラグ (isPile: length > 1) からグリフ・属性を導出して cell.middle を更新し markDirty(x, y)
     * @param {number} [x=this.playerX]
     * @param {number} [y=this.playerY]
     * @returns {boolean} cell.middle に変更があったかどうか
     */
    syncPlayerFeetObjects(x = this.playerX, y = this.playerY) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        if (!this.directBindingService ||
            this.directBindingMode === 'fallback' ||
            typeof this.directBindingService.isAvailable !== 'function' ||
            !this.directBindingService.isAvailable() ||
            typeof this.directBindingService.getObjectsAt !== 'function') {
            return false;
        }

        if (typeof this.directBindingService.hasFloorObjectsCacheAt === 'function' &&
            !this.directBindingService.hasFloorObjectsCacheAt(x, y)) {
            return false;
        }

        const floorObjs = this.directBindingService.getObjectsAt(x, y);
        if (!Array.isArray(floorObjs)) return false;

        const cell = this.grid[y] && this.grid[y][x];
        if (!cell) return false;

        if (floorObjs.length === 0) {
            if (cell.middle !== null) {
                cell.middle = null;
                this.markDirty(x, y);
                return true;
            }
            return false;
        }

        const topObj = floorObjs[0];
        const isPile = floorObjs.length > 1;
        const otyp = typeof topObj.otyp === 'number'
            ? topObj.otyp
            : (typeof topObj.onum === 'number' ? topObj.onum : (cell.middle?.subType ?? 0));

        let glyphId;
        if (typeof topObj.glyph === 'number' && topObj.glyph >= 0 && Boolean(topObj.isPile) === isPile) {
            glyphId = topObj.glyph;
        } else if (otyp === 265 && ((typeof topObj.corpsenm === 'number' && topObj.corpsenm >= 0) || (cell.middle && cell.middle.type === ENTITY_TYPES.BODY))) {
            const monOffset = (typeof topObj.corpsenm === 'number' && topObj.corpsenm >= 0) ? topObj.corpsenm : (cell.middle?.subType ?? 0);
            glyphId = (isPile ? GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF : GLYPH_OFFSETS.GLYPH_BODY_OFF) + monOffset;
        } else if (otyp === 476 && ((typeof topObj.corpsenm === 'number' && topObj.corpsenm >= 0) || (cell.middle && cell.middle.type === ENTITY_TYPES.STATUE))) {
            const monOffset = (typeof topObj.corpsenm === 'number' && topObj.corpsenm >= 0) ? topObj.corpsenm : (cell.middle?.subType ?? 0);
            glyphId = (isPile ? GLYPH_OFFSETS.GLYPH_STATUE_PILETOP_OFF : GLYPH_OFFSETS.GLYPH_STATUE_OFF) + monOffset;
        } else {
            glyphId = (isPile ? GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF : GLYPH_OFFSETS.GLYPH_OBJ_OFF) + otyp;
        }

        const classified = classifyGlyph(glyphId);
        const prevMiddle = cell.middle;
        const nextMiddle = {
            ...(prevMiddle && prevMiddle.subType === classified.subType ? prevMiddle : {}),
            ...classified,
            glyph: glyphId,
            rawGlyph: glyphId,
            isPile,
            quan: topObj.quan ?? 1,
            directObject: topObj,
            floorObjects: floorObjs
        };

        const hasChanged = !prevMiddle ||
            prevMiddle.rawGlyph !== nextMiddle.rawGlyph ||
            prevMiddle.glyph !== nextMiddle.glyph ||
            Boolean(prevMiddle.isPile) !== isPile ||
            prevMiddle.subType !== nextMiddle.subType ||
            prevMiddle.quan !== nextMiddle.quan ||
            (prevMiddle.floorObjects?.length ?? 0) !== floorObjs.length;

        cell.middle = nextMiddle;
        if (hasChanged) {
            this.markDirty(x, y);
        }
        return hasChanged;
    }

    /**
     * プレイヤー現在地の更新
     * @param {number} x 
     * @param {number} y 
     */
    updatePlayerPosition(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.seedArrivalStair(x, y);
            this.justTransitionedFloor = false;

            if (this.monsterTracker && typeof this.monsterTracker.handlePlayerPosition === 'function') {
                this.monsterTracker.handlePlayerPosition(x, y);
            }
            const cell = this.grid[y][x];
            if (cell) {
                const genuine = this.getGenuineFloor(x, y);
                if (genuine && genuine.isGenuine) {
                    const isBottomTerrainConfirmed = cell.bottom &&
                        cell.bottom.type === ENTITY_TYPES.TERRAIN &&
                        !cell.bottom.inferred;

                    if (isBottomTerrainConfirmed) {
                        // 確定地形グリフ完全保護: print_glyph で確定した地形のグリフ・形状・属性を 100% 尊重し上書きしない
                        if (genuine.door) cell.bottom.door = genuine.door;
                        if (genuine.altar) cell.bottom.altar = genuine.altar;
                        if (genuine.room) cell.bottom.room = genuine.room;
                        if (genuine.trap) cell.bottom.trap = genuine.trap;
                        if (genuine.engraving) cell.bottom.engraving = genuine.engraving;
                        cell.bottom.isGenuine = true;
                    } else {
                        cell.bottom = genuine;
                        if (genuine.cmapFlags && (genuine.cmapFlags.isStairUp || genuine.cmapFlags.isStairDown)) {
                            this._registerStairAt(x, y, genuine.glyph, normalizeFloorKey(this.currentFloor));
                        }
                    }
                    this.markDirty(x, y);
                } else {
                    const key = `${normalizeFloorKey(this.currentFloor)}:${x},${y}`;
                    const cachedStair = this.stairCache ? this.stairCache.get(key) : null;
                    if (cachedStair) {
                        cell.bottom = { ...cachedStair };
                        this.markDirty(x, y);
                    } else if (cell.bottom && cell.bottom.isCachedPreload) {
                        delete cell.bottom.isCachedPreload;
                        this.markDirty(x, y);
                    }
                }

                if (this.directBindingService && typeof this.directBindingService.isAvailable === 'function' && this.directBindingService.isAvailable()) {
                    const engr = this.directBindingService.getEngravingAt(x, y);
                    if (engr) {
                        this.setEngravingAt(x, y, engr);
                    }
                }

                // 足元の床アイテム (cell.middle) を照合・更新 (移動時・その場操作時の両方)
                this.syncPlayerFeetObjects(x, y);
            }
            if (this.playerX === x && this.playerY === y) return false;

            const prevX = this.playerX;
            const prevY = this.playerY;
            const dx = x - prevX;
            const dy = y - prevY;

            this.prevPlayerX = prevX;
            this.prevPlayerY = prevY;
            this.lastMoveDx = dx;
            this.lastMoveDy = dy;
            this.playerX = x;
            this.playerY = y;

            // 押し出し先への大岩出現検知 (Case A)
            this.terrainInference.handleBoulderPushOnPlayerMove(x, y, dx, dy);

            return true;
        }
        return false;
    }

    /**
     * WasmDirectBindingService から同期された最新の足元セル情報 (地形 cell.bottom ＆ 床アイテム cell.middle) を
     * プレイヤー現在地に即時反映 (Stage 8.2-B / Stage 8.3-B)
     * @returns {boolean}
     */
    syncPlayerFeetFloor() {
        const x = this.playerX;
        const y = this.playerY;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

        const cell = this.grid[y] && this.grid[y][x];
        if (!cell) return false;

        let updated = false;
        const genuineFloor = this.getGenuineFloor(x, y);
        if (genuineFloor) {
            const isBottomTerrainConfirmed = cell.bottom &&
                cell.bottom.type === ENTITY_TYPES.TERRAIN &&
                !cell.bottom.inferred;

            if (isBottomTerrainConfirmed) {
                // 確定地形グリフ完全保護: print_glyph で確定した地形のグリフ・形状・属性を 100% 尊重し上書きしない
                if (genuineFloor.door) cell.bottom.door = genuineFloor.door;
                if (genuineFloor.altar) cell.bottom.altar = genuineFloor.altar;
                if (genuineFloor.room) cell.bottom.room = genuineFloor.room;
                if (genuineFloor.trap) cell.bottom.trap = genuineFloor.trap;
                if (genuineFloor.engraving) cell.bottom.engraving = genuineFloor.engraving;
                cell.bottom.isGenuine = true;
            } else {
                cell.bottom = genuineFloor;
                if (genuineFloor.cmapFlags && (genuineFloor.cmapFlags.isStairUp || genuineFloor.cmapFlags.isStairDown)) {
                    this._registerStairAt(x, y, genuineFloor.glyph, normalizeFloorKey(this.currentFloor));
                }
            }
            this.markDirty(x, y);
            updated = true;
        }

        const middleChanged = this.syncPlayerFeetObjects(x, y);
        return updated || middleChanged;
    }

    /**
     * Wasm メモリから直接、プレイヤー周辺またはフロア全体の観測済みセルの真の床・罠・部屋・モンスター情報を一括同期
     * ※未観測セル (cell.bottom === null/UNEXPLORED && cell.middle === null && cell.top === null かつ非プレイヤー座標) には書き込まない (Stage 8.3-B)
     * @param {number} [radius=0] 同期半径 (0 の場合は全フロア 80x21)
     */
    syncFromDirectBinding(radius = 0) {
        if (!this.directBindingService || typeof this.directBindingService.isAvailable !== 'function' || !this.directBindingService.isAvailable()) {
            return;
        }

        // Stage 8.4: ブランチ・フロアサマリー同期
        this.syncPlayerSummary();

        const minX = radius > 0 ? Math.max(0, this.playerX - radius) : 0;
        const maxX = radius > 0 ? Math.min(this.width - 1, this.playerX + radius) : this.width - 1;
        const minY = radius > 0 ? Math.max(0, this.playerY - radius) : 0;
        const maxY = radius > 0 ? Math.min(this.height - 1, this.playerY + radius) : this.height - 1;

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const cell = this.grid[y] && this.grid[y][x];
                if (!cell) continue;

                const isPlayerCell = (x === this.playerX && y === this.playerY);
                const isUnobserved = (cell.bottom === null || cell.bottom.type === ENTITY_TYPES.UNEXPLORED) &&
                    cell.middle === null &&
                    cell.top === null &&
                    !isPlayerCell;
                if (isUnobserved) continue;

                if (cell.bottom === null || cell.bottom.type === ENTITY_TYPES.UNEXPLORED || cell.bottom.inferred) {
                    const genuine = this.getGenuineFloor(x, y);
                    if (genuine) {
                        cell.bottom = genuine;
                        this.markDirty(x, y);
                    }
                }

                if (cell.top && typeof this.directBindingService.getFullMonsterAt === 'function') {
                    const mon = this.directBindingService.getFullMonsterAt(x, y);
                    if (mon) {
                        cell.top.isPeaceful = mon.peaceful;
                        cell.top.isTame = mon.tame;
                        cell.top.isShopkeeper = mon.isShopkeeper || cell.top.isShopkeeper;
                        cell.top.isPriest = mon.isPriest;
                        cell.top.hp = mon.hp;
                        cell.top.hpmax = mon.hpmax;
                        cell.top.directState = mon;
                        cell.top.dynamicState = {
                            ...(cell.top.dynamicState || {}),
                            hp: mon.hp,
                            hpmax: mon.hpmax,
                            isPeaceful: mon.peaceful,
                            sleeping: mon.sleeping,
                            fleeing: mon.fleeing,
                            paralyzed: mon.paralyzed
                        };
                        this.markDirty(x, y);
                    }
                }
            }
        }
    }

    /**
     * Wasm メモリ直結からフロア全域 (80x21) の参照用地形ルックアップテーブル (typ) を保持 (Stage 8.3-B)
     * - 未踏セル (print_glyph 未受信) には cell.bottom を直接書き込まず、Dirty 登録も行わない
     * - 未発見の階段もここでは台帳登録しない
     * - 既に print_glyph でアイテム (middle) やモンスター/自キャラ (top) が観測済みのセルで下層地形が未確定の場合のみ補完する
     * @returns {boolean} 成功したか否か
     */
    dumpLevelTerrain() {
        if (!this.directBindingService || typeof this.directBindingService.isAvailable !== 'function' || !this.directBindingService.isAvailable()) {
            return false;
        }

        const terrain = this.directBindingService.dumpLevelTerrain();
        if (!terrain || terrain.length < 80 * 21) {
            return false;
        }

        if (typeof this.directBindingService.setCachedLevelTerrain === 'function' && !this.directBindingService._cachedLevelTerrain) {
            this.directBindingService.setCachedLevelTerrain(terrain);
        }

        const COLNO = 80;
        const ROWNO = 21;

        for (let y = 0; y < ROWNO && y < this.height; y++) {
            for (let x = 0; x < COLNO && x < this.width; x++) {
                const cell = this.grid[y] && this.grid[y][x];
                if (!cell) continue;

                // print_glyph でアイテム・モンスター・自キャラが既に観測されているが、下層地形が隠れて未確定のマスのみ補完
                const hasObservedOverlay = (cell.middle !== null || cell.top !== null);
                if (hasObservedOverlay && (cell.bottom === null || cell.bottom.type === ENTITY_TYPES.UNEXPLORED || cell.bottom.inferred)) {
                    const genuine = this.getGenuineFloor(x, y);
                    if (genuine) {
                        cell.bottom = genuine;
                        this.markDirty(x, y);
                    }
                }
            }
        }

        this._needsFullTerrainDump = false;
        return true;
    }
}
