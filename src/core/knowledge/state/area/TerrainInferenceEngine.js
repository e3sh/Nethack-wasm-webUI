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
     * Direct Binding (Shim) が現在利用可能な環境であるかを判定 (DirectBinding Native)
     * @returns {boolean}
     */
    isDirectBindingActive() {
        const asm = this.areaStateManager;
        return Boolean(
            asm &&
            asm.directBindingService &&
            typeof asm.directBindingService.isAvailable === 'function' &&
            asm.directBindingService.isAvailable()
        );
    }

    /**
     * Wasm メモリ直結による真の床（地形・部屋・罠・刻み文字）エンティティを生成 (DirectBinding Native)
     * @param {number} x 
     * @param {number} y 
     * @returns {Object|null}
     */
    getGenuineFloor(x, y) {
        const asm = this.areaStateManager;
        if (asm && asm.directBindingService &&
            typeof asm.directBindingService.isAvailable === 'function' &&
            asm.directBindingService.isAvailable()) {
            const cellInfo = asm.directBindingService.getCellInfo(x, y);
            if (cellInfo) {
                // STONE (0) や未発見の隠し通路 SCORR (15) の場合は床エンティティを生成しない
                if (cellInfo.typ === 0 || cellInfo.typ === 15) {
                    return null;
                }
                const isSecretDoor = (cellInfo.typ === 14);
                const effectiveDoor = isSecretDoor ? null : cellInfo.door;

                // 🎯 Cコア直接結合（SSOT）＆ 確定地形保護:
                let glyphId = null;
                let isDirectGlyph = false;

                const existingBottom = asm.grid?.[y]?.[x]?.bottom;

                // 物理的変化の判定:
                // 1) typ の物理変化 (掘削・凍結など)
                const isTypPhysicalChanged = Boolean(
                    existingBottom &&
                    existingBottom.typ !== undefined &&
                    cellInfo.typ !== undefined &&
                    existingBottom.typ !== cellInfo.typ
                );

                // 2) ドア状態の物理変化 (開閉・破壊など)
                const isExistingOpen = Boolean(
                    existingBottom?.door?.isOpen ||
                    (existingBottom?.glyph === 3986 || existingBottom?.glyph === 3987)
                );
                const isExistingClosed = Boolean(
                    existingBottom?.door?.isClosed ||
                    (existingBottom?.glyph === 3988 || existingBottom?.glyph === 3989)
                );
                const isExistingBroken = Boolean(
                    existingBottom?.door?.isBroken ||
                    existingBottom?.door?.isNoDoor ||
                    existingBottom?.glyph === 3985
                );

                const isNewOpen = Boolean(cellInfo?.door?.isOpen);
                const isNewClosed = Boolean(cellInfo?.door?.isClosed);
                const isNewBroken = Boolean(cellInfo?.door?.isBroken || cellInfo?.door?.isNoDoor);

                const isDoorStateChanged = Boolean(
                    cellInfo.typ === 23 &&
                    cellInfo?.door &&
                    existingBottom &&
                    (
                        isExistingOpen !== isNewOpen ||
                        isExistingClosed !== isNewClosed ||
                        isExistingBroken !== isNewBroken
                    )
                );

                const hasPhysicalChanged = isTypPhysicalChanged || isDoorStateChanged;

                // 1. 🎯 受信確定地形の絶対優先・保護 (direct_binding_ssot_rules.md 第2条):
                // 物理的な変化 (typ変化 または ドア物理変化) がない場合は、
                // 画面描画の絶対真値である既存グリフ (向きを持つ開閉扉・角壁等) を最優先で100%維持保護！
                if (existingBottom && existingBottom.type === ENTITY_TYPES.TERRAIN && !existingBottom.inferred && typeof existingBottom.glyph === 'number' && !hasPhysicalChanged) {
                    glyphId = existingBottom.glyph;
                    isDirectGlyph = Boolean(existingBottom.isDirectGlyph);
                }

                // 2. 物理変化があった場合、またはセルが未確定の場合に C コア直接グリフを取得
                if (glyphId === null && typeof asm.directBindingService.getCellGlyph === 'function') {
                    const realTimeGlyph = asm.directBindingService.getCellGlyph(x, y);
                    if (typeof realTimeGlyph === 'number' && realTimeGlyph > 0) {
                        const directClassified = classifyGlyph(realTimeGlyph);
                        if (directClassified.type === ENTITY_TYPES.TERRAIN) {
                            // 視認済みの壁 (3975-3984) を未視認の石 (3973) で上書きしない
                            const isExistingWall = existingBottom && typeof existingBottom.glyph === 'number' && existingBottom.glyph >= 3975 && existingBottom.glyph <= 3984;
                            if (!(isExistingWall && realTimeGlyph === 3973)) {
                                glyphId = realTimeGlyph;
                                isDirectGlyph = true;
                                if (asm.directBindingService._cachedLevelGlyphs && x >= 0 && x < 80 && y >= 0 && y < 21) {
                                    asm.directBindingService._cachedLevelGlyphs[y * 80 + x] = realTimeGlyph;
                                }
                            }
                        }
                    }
                }

                // 3. 物理変化があった場合、またはセルが未確定の場合、Cコア直接グリフ (_cachedLevelGlyphs) を採用
                const cachedGlyphs = asm.directBindingService._cachedLevelGlyphs;
                if (glyphId === null && cachedGlyphs && x >= 0 && x < 80 && y >= 0 && y < 21) {
                    const directGlyph = cachedGlyphs[y * 80 + x];
                    if (typeof directGlyph === 'number' && directGlyph > 0) {
                        const directClassified = classifyGlyph(directGlyph);
                        if (directClassified.type === ENTITY_TYPES.TERRAIN) {
                            glyphId = directGlyph;
                            isDirectGlyph = true;
                        }
                    }
                }

                // 4. それでも決まらなければ既存グリフを保護
                if (glyphId === null && existingBottom && existingBottom.type === ENTITY_TYPES.TERRAIN && !existingBottom.inferred && typeof existingBottom.glyph === 'number') {
                    glyphId = existingBottom.glyph;
                    isDirectGlyph = Boolean(existingBottom.isDirectGlyph);
                }

                // 新規床生成時: 暗い部屋 (typ === 1 かつ lit === false) の場合、NetHack 公式仕様 (display.c / DARKROOMSYM) に従い
                // 明るい部屋の床 (3992: S_room) ではなく暗い部屋の床 (3993: S_darkroom) を採用
                if (glyphId === 3992 && !cellInfo.lit && (!existingBottom || !existingBottom.fromPrintGlyph)) {
                    glyphId = 3993;
                }

                // Cコア直接グリフおよび既存確定グリフのいずれも存在しない場合は推論捏造せず null を返却
                if (glyphId === null || glyphId < 0) {
                    return null;
                }
                const classified = classifyGlyph(glyphId);
                const genuineEntity = {
                    ...classified,
                    glyph: glyphId,
                    rawGlyph: glyphId,
                    glyphInfo: { glyph: glyphId, rawGlyph: glyphId, ch: classified.ch || '.' },
                    inferred: false,
                    isGenuine: true,
                    isDirectGlyph,
                    typ: cellInfo.typ,
                    lit: Boolean(cellInfo.lit),
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
        const existingCell = asm?.grid?.[y]?.[x];
        if (existingCell?.bottom?.isGenuine) {
            return existingCell.bottom;
        }

        const currentNormalized = normalizeFloorKey(asm?.currentFloor);
        const stairKey = `${currentNormalized}:${x},${y}`;
        if (asm?.stairCache && asm.stairCache.has(stairKey)) {
            return { ...asm.stairCache.get(stairKey) };
        }

        // DirectBinding Native: 未確定マスや未接続マスに対して投機的な仮床 (3992) を捏造せず null を返却
        return null;
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

        // ② 既存の有効な cell.bottom (確定済み TERRAIN) が存在する場合は照明状態を最新化
        if (cell.bottom !== null && cell.bottom.type !== ENTITY_TYPES.UNEXPLORED && !cell.bottom.inferred) {
            const asm = this.areaStateManager;
            if (asm && asm.directBindingService && typeof asm.directBindingService.getCellInfo === 'function') {
                const cInfo = asm.directBindingService.getCellInfo(x, y);
                if (cInfo && typeof cInfo.lit !== 'undefined') {
                    const newLit = Boolean(cInfo.lit);
                    if (cell.bottom.lit !== newLit) {
                        cell.bottom.lit = newLit;
                        if (!cell.bottom.fromPrintGlyph && (cell.bottom.typ === 1 || cell.bottom.glyph === 3992 || cell.bottom.glyph === 3993)) {
                            const newGlyph = newLit ? 3992 : 3993;
                            cell.bottom.glyph = newGlyph;
                            cell.bottom.rawGlyph = newGlyph;
                        }
                        asm.markDirty(x, y);
                    }
                }
            }
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
