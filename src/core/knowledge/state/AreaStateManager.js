/**
 * AreaStateManager.js
 * 80x24 マップの多層セル状態キャッシュ (bottom/middle/top/effect/engraving) の保持、
 * dirtyCells 差分追跡、WasmDirectBindingService 同期、および
 * 各サブモジュール (TerrainInferenceEngine, DungeonLandmarkRegistry, ViewportTileProjector) への統括窓口 (Core & Facade)
 */

import { classifyGlyph, ENTITY_TYPES } from "../engines/glyphClassifier.js";
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
        this.landmarkRegistry.prepareFloorTransition();
        this.resetGrid();
    }

    applyStairCacheForFloor(floorKey = this.currentFloor) {
        return this.landmarkRegistry.applyStairCacheForFloor(floorKey);
    }

    setCurrentFloor(floorKey) {
        return this.landmarkRegistry.setCurrentFloor(floorKey);
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

        const info = classifyGlyph(glyphId);
        const cell = this.grid[y][x];

        // ランドマークの検出と台帳への記録
        const landmark = this.extractLandmarkEntity(x, y, glyphId, info);
        if (landmark) {
            if (this.isFloorPending) {
                this.pendingLandmarks.push({ x, y, entity: landmark });
            } else {
                this._saveLandmarkToCache(landmark, x, y);
            }
        }

        switch (info.type) {
            case ENTITY_TYPES.TERRAIN:
            case ENTITY_TYPES.UNEXPLORED:
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
                this.terrainInference.ensureBottomTerrain(cell, x, y, bkglyphInfo);

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
                if (this.monsterTracker && typeof this.monsterTracker.updateVisibleMonster === 'function') {
                    this.monsterTracker.updateVisibleMonster(x, y, glyphId, glyphInfo, { x: this.playerX, y: this.playerY });
                }
                break;
            }

            case ENTITY_TYPES.EFFECT:
                cell.effect = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                break;

            default:
                break;
        }
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
                    cell.bottom = genuine;
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
     * WasmDirectBindingService から同期された最新の足元セル情報をプレイヤー現在地の cell.bottom に即時反映 (Stage 8.2-B)
     * @returns {boolean}
     */
    syncPlayerFeetFloor() {
        const x = this.playerX;
        const y = this.playerY;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;

        const cell = this.grid[y] && this.grid[y][x];
        if (!cell) return false;

        const genuineFloor = this.getGenuineFloor(x, y);
        if (genuineFloor) {
            cell.bottom = genuineFloor;
            this.markDirty(x, y);
            return true;
        }
        return false;
    }

    /**
     * Wasm メモリから直接、プレイヤー周辺またはフロア全体の真の床・罠・部屋・モンスター情報を一括同期
     * @param {number} [radius=0] 同期半径 (0 の場合は全フロア 80x21)
     */
    syncFromDirectBinding(radius = 0) {
        if (!this.directBindingService || typeof this.directBindingService.isAvailable !== 'function' || !this.directBindingService.isAvailable()) {
            return;
        }

        const minX = radius > 0 ? Math.max(0, this.playerX - radius) : 0;
        const maxX = radius > 0 ? Math.min(this.width - 1, this.playerX + radius) : this.width - 1;
        const minY = radius > 0 ? Math.max(0, this.playerY - radius) : 0;
        const maxY = radius > 0 ? Math.min(this.height - 1, this.playerY + radius) : this.height - 1;

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const cell = this.grid[y] && this.grid[y][x];
                if (!cell) continue;

                if (cell.bottom === null || cell.bottom.inferred) {
                    cell.bottom = this.getGenuineFloor(x, y);
                    this.markDirty(x, y);
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
     * Wasm メモリ直結からフロア全域 (80x21) の真の地形 (typ) を一括ダンプしグリッドへ反映 (Stage 8.3-A)
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

        const COLNO = 80;
        const ROWNO = 21;
        const currentNormalized = normalizeFloorKey(this.currentFloor);

        for (let y = 0; y < ROWNO && y < this.height; y++) {
            for (let x = 0; x < COLNO && x < this.width; x++) {
                const typ = terrain[y * COLNO + x];
                if (typ === undefined || typ === null) continue;

                const cell = this.grid[y] && this.grid[y][x];
                if (!cell) continue;

                const glyphId = this.getGlyphForTerrainType(typ, x, y);
                const classified = classifyGlyph(glyphId);

                if (typ === 26 || typ === 27) {
                    this._registerStairAt(x, y, glyphId, currentNormalized);
                }

                cell.bottom = {
                    ...classified,
                    glyph: glyphId,
                    rawGlyph: glyphId,
                    inferred: false,
                    isGenuine: true,
                    typ
                };

                this.markDirty(x, y);
            }
        }

        return true;
    }
}
