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
     * 地形 typ から適切な地形グリフIDを算出 (Stage 8.3-A)
     * @param {number} typ 
     * @param {number} [x=0] 
     * @param {number} [y=0] 
     * @param {Object} [doorState=null] 
     * @returns {number} glyphId
     */
    getGlyphForTerrainType(typ, x = 0, y = 0, doorState = null) {
        const asm = this.areaStateManager;
        switch (typ) {
            case 16: // POOL
            case 17: // MOAT
            case 18: // WATER
                return 4015;
            case 20: // LAVAPOOL
            case 21: // LAVAWALL
                return 4017;
            case 22: // IRONBARS
                return 3990;
            case 23: // DOOR
                return (doorState && doorState.isOpen) ? 3986 : 3988;
            case 14: // SDOOR
                return 3988;
            case 24: // CORR
            case 15: // SCORR
                return 3995;
            case 25: // ROOM
                return 3992;
            case 26: { // STAIRS
                const stairKey = `${normalizeFloorKey(asm.currentFloor)}:${x},${y}`;
                if (asm.stairCache && asm.stairCache.has(stairKey)) {
                    return asm.stairCache.get(stairKey).glyph;
                } else if (asm.prevFloor && parseFloorLevel(asm.prevFloor) > parseFloorLevel(asm.currentFloor)) {
                    return 4001; // 浅い階に上がってきた場合: 下り階段
                } else {
                    return 4000; // 深い階に降りてきた場合: 上り階段
                }
            }
            case 27: { // LADDER
                const ladderKey = `${normalizeFloorKey(asm.currentFloor)}:${x},${y}`;
                if (asm.stairCache && asm.stairCache.has(ladderKey)) {
                    return asm.stairCache.get(ladderKey).glyph;
                } else if (asm.prevFloor && parseFloorLevel(asm.prevFloor) > parseFloorLevel(asm.currentFloor)) {
                    return 4005; // 下りハシゴ
                } else {
                    return 4004; // 上りハシゴ
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
            case 32: // ALTAR
                return 4008;
            case 33: // ICE
                return 4016;
            case 35: // AIR
                return 4023;
            case 36: // CLOUD
                return 4024;
            default:
                return (typ >= 1 && typ <= 12) ? 3930 : DEFAULT_INFERRED_FLOOR_GLYPH;
        }
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
                const glyphId = this.getGlyphForTerrainType(cellInfo.typ, x, y, cellInfo.door);
                const classified = classifyGlyph(glyphId);
                const genuineEntity = {
                    ...classified,
                    glyph: glyphId,
                    rawGlyph: glyphId,
                    inferred: false,
                    isGenuine: true,
                    typ: cellInfo.typ,
                    door: cellInfo.door,
                    cellInfo
                };

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

        const currentNormalized = normalizeFloorKey(asm.currentFloor);
        const stairKey = `${currentNormalized}:${x},${y}`;
        if (asm.stairCache && asm.stairCache.has(stairKey)) {
            return { ...asm.stairCache.get(stairKey) };
        }

        // strict モード時は推測仮床の生成を完全遮断 (Stage 8.2-B)
        if (asm.directBindingMode === 'strict') {
            const coordKey = `${asm.currentFloor}:${x},${y}`;
            if (!asm._warnedStrictCoords || !asm._warnedStrictCoords.has(coordKey)) {
                if (!asm._warnedStrictCoords) asm._warnedStrictCoords = new Set();
                asm._warnedStrictCoords.add(coordKey);
                console.warn(`[AreaStateManager] getGenuineFloor: Inferred floor generation blocked under strict mode at (${x},${y}).`);
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
        if (bkglyphInfo && bkglyphInfo.glyph >= 0 && bkglyphInfo.glyph < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF) {
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
     * アイテムやモンスターが出現したセルに下層地形が未設定・未探索・推測床の場合、背景地形を補完
     * @param {Object} cell
     * @param {number} x
     * @param {number} y
     * @param {Object} [bkglyphInfo=null]
     */
    ensureBottomTerrain(cell, x, y, bkglyphInfo = null) {
        if (!cell) return;
        if (cell.bottom === null || cell.bottom.type === ENTITY_TYPES.UNEXPLORED || cell.bottom.inferred) {
            const resolvedFloor = this.resolveBackgroundTerrain(x, y, bkglyphInfo);
            if (resolvedFloor) {
                cell.bottom = resolvedFloor;
                this.areaStateManager.markDirty(x, y);
            }
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
