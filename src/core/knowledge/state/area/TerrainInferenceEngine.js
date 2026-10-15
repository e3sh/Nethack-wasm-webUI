/**
 * TerrainInferenceEngine.js
 * 地形typ変換、Wasm Direct Binding真床解決、背景グリフ(bkglyphInfo)判定、
 * 仮床(3992)生成ガード、自己修復、大岩(Boulder)押し出し推論、墓石置換を担う推論エンジン
 */

import { classifyGlyph, ENTITY_TYPES, GLYPH_OFFSETS, isBoulderGlyph, isBoulderEntity } from "../../engines/glyphClassifier.js";
import { normalizeFloorKey, parseFloorLevel } from "./DungeonLandmarkRegistry.js";

export const DEFAULT_INFERRED_FLOOR_GLYPH = 3992;
export const DEFAULT_TOMBSTONE_GLYPH = 4011;

/**
 * 足元またはエンティティ出現マス用の仮床オブジェクトを生成
 * @returns {Object}
 */
export function createInferredFloor() {
    const info = classifyGlyph(DEFAULT_INFERRED_FLOOR_GLYPH);
    return {
        ...info,
        glyph: DEFAULT_INFERRED_FLOOR_GLYPH,
        rawGlyph: DEFAULT_INFERRED_FLOOR_GLYPH,
        inferred: true
    };
}

export class TerrainInferenceEngine {
    /**
     * @param {import('../AreaStateManager.js').AreaStateManager} areaStateManager
     */
    constructor(areaStateManager) {
        this.areaStateManager = areaStateManager;
    }

    /**
     * 地形 typ から適切な地形グリフIDを算出 (Stage 8.3-A / 8.3-B)
     * - typ === 0 (STONE: 無地の岩盤) や typ === 15 (SCORR: 未発見の隠し通路) は描画対象外として null を返却
     * - typ === 14 (SDOOR: 未発見の隠し扉) はネタバレ防止のため壁グリフ (3930) を返却
     * @param {number} typ 
     * @param {number} [x=0] 
     * @param {number} [y=0] 
     * @param {Object} [doorState=null] 
     * @returns {number|null} glyphId
     */
    /**
     * 地形 typ から適切な地形グリフIDを算出 (Stage 8.3-A / 8.3-B)
     * - typ === 0 (STONE: 無地の岩盤) や typ === 15 (SCORR: 未発見の隠し通路) は描画対象外として null を返却
     * - typ === 14 (SDOOR: 未発見の隠し扉) はネタバレ防止のため壁グリフ (3930) を返却
     * @param {number} typ 
     * @param {number} [x=0] 
     * @param {number} [y=0] 
     * @param {Object} [doorState=null] 
     * @param {Object} [cellInfo=null]
     * @returns {number|null} glyphId
     */
    getGlyphForTerrainType(typ, x = 0, y = 0, doorState = null, cellInfo = null) {
        const asm = this.areaStateManager;
        switch (typ) {
            case 0: // STONE (無地の岩盤)
            case 15: // SCORR (未発見の隠し通路: ネタバレ防止)
                return null;
            case 14: // SDOOR (未発見の隠し扉: 壁として扱いネタバレ防止)
            case 19: // DRAWBRIDGE_UP
                return 3930;
            case 16: // POOL
            case 17: // MOAT
            case 18: // WATER
                return 4015;
            case 20: // LAVAPOOL
            case 21: // LAVAWALL
                return 4017;
            case 22: // IRONBARS
                return 3990;
            case 23: { // DOOR
                // 扉の幾何学的向き (縦/横) は struct rm に存在しないため、
                // print_glyph で確定した既存セルグリフが存在する場合はそれを最優先でそのまま返却する。
                const existing = asm.grid?.[y]?.[x]?.bottom;
                if (existing && typeof existing.glyph === 'number' && existing.glyph >= 3985 && existing.glyph <= 3989) {
                    return existing.glyph;
                }
                if (!doorState || doorState.isNoDoor || doorState.isBroken) {
                    return 3985; // S_ndoor (扉のないドア枠 / 壊れたドア)
                }
                return doorState.isOpen ? 3986 : 3988;
            }
            case 24: // CORR
                return 3995;
            case 25: // ROOM
                return 3992;
            case 26: { // STAIRS
                const stairKey = `${normalizeFloorKey(asm.currentFloor)}:${x},${y}`;
                if (asm.stairCache && asm.stairCache.has(stairKey)) {
                    return asm.stairCache.get(stairKey).glyph;
                } else if (asm.prevFloor && parseFloorLevel(asm.prevFloor) > parseFloorLevel(asm.currentFloor)) {
                    return 3999; // 浅い階に上がってきた場合: 下り階段
                } else {
                    return 3998; // 深い階に降りてきた場合: 上り階段
                }
            }
            case 27: { // LADDER
                const ladderKey = `${normalizeFloorKey(asm.currentFloor)}:${x},${y}`;
                if (asm.stairCache && asm.stairCache.has(ladderKey)) {
                    return asm.stairCache.get(ladderKey).glyph;
                } else if (asm.prevFloor && parseFloorLevel(asm.prevFloor) > parseFloorLevel(asm.currentFloor)) {
                    return 4001; // 下りハシゴ
                } else {
                    return 4000; // 上りハシゴ
                }
            }
            case 28: // FOUNTAIN
                return 4014;
            case 29: // THRONE
                return 4012;
            case 30: // SINK
                return 4013;
            case 31: // GRAVE
                return 4011;
            case 32: { // ALTAR
                // print_glyph で確定した既存の祭壇グリフ (4006〜4010) が存在する場合は最優先で維持
                const existing = asm.grid?.[y]?.[x]?.bottom;
                if (existing && typeof existing.glyph === 'number' && existing.glyph >= 4006 && existing.glyph <= 4010) {
                    return existing.glyph;
                }
                // cellInfo.altar からアライメント対応グリフを逆算
                if (cellInfo && cellInfo.altar && typeof cellInfo.altar.glyph === 'number') {
                    return cellInfo.altar.glyph;
                }
                return 4008; // デフォルト: 中立
            }
            case 33: // ICE
                return 4016;
            case 35: // AIR
                return 4023;
            case 36: // CLOUD
                return 4024;
            default:
                if (typ === undefined || typ === null || typ < 0) return null;
                return (typ >= 1 && typ <= 12) ? 3930 : DEFAULT_INFERRED_FLOOR_GLYPH;
        }
    }

    /**
     * Direct Binding (Shim) が現在有効な環境・モードであるかを判定 (Stage 8.3-B)
     * - 'strict' モード時、または 'auto' モードで directBindingService が利用可能な場合は true
     * - 'fallback' モード時、または directBindingService が未接続・非対応の場合は false
     * @returns {boolean}
     */
    isDirectBindingActive() {
        const asm = this.areaStateManager;
        if (!asm) return false;
        if (asm.directBindingMode === 'strict') return true;
        if (asm.directBindingMode === 'fallback') return false;
        return Boolean(
            asm.directBindingService &&
            typeof asm.directBindingService.isAvailable === 'function' &&
            asm.directBindingService.isAvailable()
        );
    }

    /**
     * Wasm メモリ直結による真の床（地形・部屋・罠・刻み文字）エンティティを生成
     * @param {number} x 
     * @param {number} y 
     * @returns {Object|null}
     */
    getGenuineFloor(x, y) {
        const asm = this.areaStateManager;
        if (asm.directBindingMode !== 'fallback' &&
            asm.directBindingService &&
            typeof asm.directBindingService.isAvailable === 'function' &&
            asm.directBindingService.isAvailable()) {
            const cellInfo = asm.directBindingService.getCellInfo(x, y);
            if (cellInfo) {
                // STONE (0) や未発見の隠し通路 SCORR (15) の場合は床エンティティを生成しない (Stage 8.3-B)
                if (cellInfo.typ === 0 || cellInfo.typ === 15) {
                    return null;
                }
                const isSecretDoor = (cellInfo.typ === 14);
                const effectiveDoor = isSecretDoor ? null : cellInfo.door;
                const glyphId = this.getGlyphForTerrainType(cellInfo.typ, x, y, effectiveDoor, cellInfo);
                if (glyphId === null || glyphId < 0) {
                    return null;
                }
                const classified = classifyGlyph(glyphId);
                const genuineEntity = {
                    ...classified,
                    glyph: glyphId,
                    rawGlyph: glyphId,
                    inferred: false,
                    isGenuine: true,
                    typ: cellInfo.typ,
                    door: effectiveDoor,
                    cellInfo: isSecretDoor ? { ...cellInfo, door: null } : cellInfo
                };

                // 祭壇属性付与
                if (cellInfo.altar) {
                    genuineEntity.altar = cellInfo.altar;
                }

                // 部屋番号・店舗情報付与
                if (cellInfo.roomno > 0 && typeof asm.directBindingService.getRoomType === 'function') {
                    const roomData = asm.directBindingService.getRoomType(cellInfo.roomno);
                    if (roomData) {
                        genuineEntity.room = roomData;
                    }
                }

                // 床の罠情報
                if (typeof asm.directBindingService.getTrapAt === 'function') {
                    const trapData = asm.directBindingService.getTrapAt(x, y);
                    if (trapData) {
                        genuineEntity.trap = trapData;
                    }
                }

                // 刻み文字情報
                if (typeof asm.directBindingService.getEngravingAt === 'function') {
                    const engrData = asm.directBindingService.getEngravingAt(x, y);
                    if (engrData) {
                        genuineEntity.engraving = engrData;
                        asm.setEngravingAt(x, y, engrData);
                    }
                }

                asm.genuineFloorCount++;
                asm.lastFloorMethod = 'SHIM_DIRECT';
                asm.lastFloorSync = { source: 'SHIM_DIRECT', glyph: glyphId, typ: cellInfo.typ, isGenuine: true };

                return genuineEntity;
            }
        }

        // 既に真の床がセルに設定されている場合はそれを維持
        const existingCell = asm.grid?.[y]?.[x];
        if (existingCell?.bottom?.isGenuine) {
            return existingCell.bottom;
        }

        const currentNormalized = normalizeFloorKey(asm.currentFloor);
        const stairKey = `${currentNormalized}:${x},${y}`;
        if (asm.stairCache && asm.stairCache.has(stairKey)) {
            return { ...asm.stairCache.get(stairKey) };
        }

        // Direct Binding 有効時 ('strict' または 'auto' で Shim 利用可能時) は、
        // Worker 同期完了前の未確定セルに対して投機的な仮床 (3992) を生成しない (Stage 8.3-B)
        if (this.isDirectBindingActive()) {
            if (asm.directBindingMode === 'strict') {
                const coordKey = `${asm.currentFloor}:${x},${y}`;
                if (!asm._warnedStrictCoords || !asm._warnedStrictCoords.has(coordKey)) {
                    if (!asm._warnedStrictCoords) asm._warnedStrictCoords = new Set();
                    asm._warnedStrictCoords.add(coordKey);
                    console.warn(`[AreaStateManager] getGenuineFloor: Inferred floor generation blocked under strict mode at (${x},${y}).`);
                }
            }
            return null;
        }

        asm.inferredFloorCount++;
        asm.lastFloorMethod = 'INFERRED_FALLBACK';
        asm.lastFloorSync = { source: 'INFERRED_FALLBACK', glyph: DEFAULT_INFERRED_FLOOR_GLYPH, typ: -1, isGenuine: false };

        return createInferredFloor();
    }

    /**
     * 背景グリフ情報 (bkglyphInfo) または真の床から下層地形を解決
     * @param {number} x
     * @param {number} y
     * @param {Object} [bkglyphInfo=null]
     * @returns {Object|null}
     */
    resolveBackgroundTerrain(x, y, bkglyphInfo = null) {
        if (bkglyphInfo && bkglyphInfo.glyph >= 0 && bkglyphInfo.glyph < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF && bkglyphInfo.ch !== ' ') {
            const bgClassified = classifyGlyph(bkglyphInfo.glyph);
            if (bgClassified.type === ENTITY_TYPES.TERRAIN) {
                return {
                    ...bgClassified,
                    glyphInfo: bkglyphInfo,
                    glyph: bkglyphInfo.glyph,
                    rawGlyph: bkglyphInfo.glyph
                };
            }
        }
        return this.getGenuineFloor(x, y);
    }

    /**
     * アイテムやモンスターが出現したセルの下層地形を補完 (Stage 8.3-B)
     * 優先順位: ① bkglyph (TERRAIN) ➔ ② 既存の確定済み cell.bottom ➔ ③ Shim 地形テーブル (getGenuineFloor)
     * @param {Object} cell
     * @param {number} x
     * @param {number} y
     * @param {Object} [bkglyphInfo=null]
     */
    ensureBottomTerrain(cell, x, y, bkglyphInfo = null) {
        if (!cell) return;

        // ① bkglyphInfo が有効な TERRAIN の場合は最優先で採用
        if (bkglyphInfo && typeof bkglyphInfo.glyph === 'number' &&
            bkglyphInfo.glyph >= 0 && bkglyphInfo.glyph < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF &&
            bkglyphInfo.ch !== ' ') {
            const bgClassified = classifyGlyph(bkglyphInfo.glyph);
            if (bgClassified.type === ENTITY_TYPES.TERRAIN) {
                cell.bottom = {
                    ...(cell.bottom && cell.bottom.isGenuine ? cell.bottom : {}),
                    ...bgClassified,
                    glyphInfo: bkglyphInfo,
                    glyph: bkglyphInfo.glyph,
                    rawGlyph: bkglyphInfo.glyph
                };
                if (cell.bottom.inferred !== undefined && !cell.bottom.isGenuine) {
                    delete cell.bottom.inferred;
                }
                this.areaStateManager.markDirty(x, y);
                return;
            }
        }

        // ② 既存の有効な cell.bottom (確定済み TERRAIN) が存在する場合はそのまま維持
        if (cell.bottom !== null && cell.bottom.type !== ENTITY_TYPES.UNEXPLORED && !cell.bottom.inferred) {
            return;
        }

        // ③ Shim 地形テーブル (getGenuineFloor) で補完
        const resolvedFloor = this.getGenuineFloor(x, y);
        if (resolvedFloor) {
            cell.bottom = resolvedFloor;
            this.areaStateManager.markDirty(x, y);
        }
    }

    /**
     * 押し出し先への大岩出現検知 (Case B: プレイヤー移動後に押し出し先マスへ岩グリフが届いた場合)
     * @param {number} x
     * @param {number} y
     * @param {number} glyphId
     */
    handleBoulderPushOnGlyphUpdate(x, y, glyphId) {
        const asm = this.areaStateManager;
        if (isBoulderGlyph(glyphId) && (asm.lastMoveDx !== 0 || asm.lastMoveDy !== 0)) {
            const expectedPushedX = asm.playerX + asm.lastMoveDx;
            const expectedPushedY = asm.playerY + asm.lastMoveDy;
            if (x === expectedPushedX && y === expectedPushedY) {
                const feetCell = asm.grid[asm.playerY] && asm.grid[asm.playerY][asm.playerX];
                if (feetCell && feetCell.middle && isBoulderEntity(feetCell.middle)) {
                    // 押し出し先に岩が届いたため、足元の岩をクリア
                    feetCell.middle = null;
                    asm.markDirty(asm.playerX, asm.playerY);
                }
            }
        }
    }

    /**
     * 押し出し先への大岩出現検知 (Case A: 押し出し先マスに既に岩が届いている状態でプレイヤーが移動した場合)
     * @param {number} x
     * @param {number} y
     * @param {number} dx
     * @param {number} dy
     */
    handleBoulderPushOnPlayerMove(x, y, dx, dy) {
        const asm = this.areaStateManager;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
            const cell = asm.grid[y] && asm.grid[y][x];
            if (cell && cell.middle && isBoulderEntity(cell.middle)) {
                const pushedX = x + dx;
                const pushedY = y + dy;
                if (pushedX >= 0 && pushedX < asm.width && pushedY >= 0 && pushedY < asm.height) {
                    const pushedCell = asm.grid[pushedY] && asm.grid[pushedY][pushedX];
                    if (pushedCell && pushedCell.middle && isBoulderEntity(pushedCell.middle)) {
                        // 押し出し先に既に岩が存在するため、足元の岩をクリア
                        cell.middle = null;
                        asm.markDirty(x, y);
                        asm.markDirty(pushedX, pushedY);
                    }
                }
            }
        }
    }
}
