/**
 * ViewportTileProjector.js
 * 戦術視野 (getAreaState: 周囲セル抽出・方向キー付与・隣接モンスター/エンティティ整理) および
 * カメラ投影 (getFocusCameraTiles: レイヤー別グリフ解決・墓石置換・構造化知識結合) を担うプロジェクタークラス
 */

import { ENTITY_TYPES } from "../../engines/glyphClassifier.js";
import { DEFAULT_INFERRED_FLOOR_GLYPH, DEFAULT_TOMBSTONE_GLYPH } from "./TerrainInferenceEngine.js";

export class ViewportTileProjector {
    /**
     * @param {import('../AreaStateManager.js').AreaStateManager} areaStateManager
     */
    constructor(areaStateManager) {
        this.areaStateManager = areaStateManager;
    }

    /**
     * 相対座標 (dx, dy) とキーモードから方角・キー情報を取得
     * @param {number} dx
     * @param {number} dy
     * @param {'vi'|'numpad'} [keyMode='numpad']
     * @returns {{ code: string, name: string, key: string }}
     */
    getDirectionInfo(dx, dy, keyMode = 'numpad') {
        const isNumpad = (keyMode === 'numpad');
        if (dx === 0 && dy === -1) return { code: 'N', name: '北', key: isNumpad ? '8' : 'k' };
        if (dx === 1 && dy === -1) return { code: 'NE', name: '北東', key: isNumpad ? '9' : 'u' };
        if (dx === 1 && dy === 0) return { code: 'E', name: '東', key: isNumpad ? '6' : 'l' };
        if (dx === 1 && dy === 1) return { code: 'SE', name: '南東', key: isNumpad ? '3' : 'n' };
        if (dx === 0 && dy === 1) return { code: 'S', name: '南', key: isNumpad ? '2' : 'j' };
        if (dx === -1 && dy === 1) return { code: 'SW', name: '南西', key: isNumpad ? '1' : 'b' };
        if (dx === -1 && dy === 0) return { code: 'W', name: '西', key: isNumpad ? '4' : 'h' };
        if (dx === -1 && dy === -1) return { code: 'NW', name: '北西', key: isNumpad ? '7' : 'y' };
        return { code: 'SELF', name: '足元', key: isNumpad ? '5' : '.' };
    }

    /**
     * 指定セル (デフォルト: プレイヤー現在地) の周辺 N マスの構造化エリア状態を取得
     * @param {number} [cx] 中心 X (省略時は playerX)
     * @param {number} [cy] 中心 Y (省略時は playerY)
     * @param {number} [radius=1] 半径 (1 で 3x3)
     * @returns {Object} 構造化 AreaState
     */
    getAreaState(cx, cy, radius = 1) {
        const asm = this.areaStateManager;
        const centerX = (cx !== undefined) ? cx : asm.playerX;
        const centerY = (cy !== undefined) ? cy : asm.playerY;

        const cells = [];
        const adjacentMonsters = [];
        const adjacentEntities = [];

        let feetState = null;

        for (let dy = -radius; dy <= radius; dy++) {
            const row = [];
            for (let dx = -radius; dx <= radius; dx++) {
                const targetX = centerX + dx;
                const targetY = centerY + dy;

                let cellData = null;
                if (targetX >= 0 && targetX < asm.width && targetY >= 0 && targetY < asm.height) {
                    cellData = { ...asm.grid[targetY][targetX] };
                } else {
                    cellData = { x: targetX, y: targetY, bottom: null, middle: null, top: null };
                }

                const dir = this.getDirectionInfo(dx, dy, asm.keyMode);
                const enrichedCell = {
                    ...cellData,
                    relX: dx,
                    relY: dy,
                    dir
                };

                row.push(enrichedCell);

                if (dx === 0 && dy === 0) {
                    if (enrichedCell.bottom === null || enrichedCell.bottom.inferred) {
                        enrichedCell.bottom = asm.getGenuineFloor(targetX, targetY);
                    }
                    feetState = enrichedCell;
                } else {
                    // 隣接するモンスター検出
                    if (enrichedCell.top && (enrichedCell.top.type === ENTITY_TYPES.MONSTER || enrichedCell.top.type === ENTITY_TYPES.PET)) {
                        adjacentMonsters.push({
                            dir,
                            cell: enrichedCell,
                            entity: enrichedCell.top
                        });
                    }
                    adjacentEntities.push({
                        dir,
                        cell: enrichedCell
                    });
                }
            }
            cells.push(row);
        }

        const trackedMonsters = (asm.monsterTracker && typeof asm.monsterTracker.getTrackedMonsters === 'function')
            ? asm.monsterTracker.getTrackedMonsters()
            : [];

        const perceivedMonsters = (asm.monsterTracker && typeof asm.monsterTracker.getPerceivedMonstersSummary === 'function')
            ? asm.monsterTracker.getPerceivedMonstersSummary({ playerX: asm.playerX, playerY: asm.playerY, grid: asm.grid })
            : [];

        const landmarks = asm.getFloorLandmarks(asm.currentFloor);

        return {
            center: { x: centerX, y: centerY },
            radius,
            playerX: asm.playerX,
            playerY: asm.playerY,
            playerLocation: { x: asm.playerX, y: asm.playerY },
            keyMode: asm.keyMode,
            currentFloor: asm.currentFloor,
            landmarks,
            width: asm.width,
            height: asm.height,
            grid: asm.grid,
            feet: feetState,
            cells,
            adjacentMonsters,
            adjacentEntities,
            trackedMonsters,
            perceivedMonsters
        };
    }

    /**
     * フォーカスカメラ・ズームビュー用の整形済みタイル一覧を取得
     * @param {number} [radiusX=10] - 横方向半径 (デフォルト: 10 => 21列)
     * @param {number} [radiusY=4] - 縦方向半径 (デフォルト: 4 => 9行)
     * @param {Object} [options={}] - オプション
     * @param {number} [options.centerX] - 中心X座標 (省略時はプレイヤーX)
     * @param {number} [options.centerY] - 中心Y座標 (省略時はプレイヤーY)
     * @param {Array<Array<Object>>} [options.glyphGridBuffer] - ドライバーの GlyphBuffer
     * @param {Object} [options.structuredKnowledge] - StructuredKnowledgeEngine
     * @param {'ja'|'en'} [options.language='ja'] - 表示言語
     * @returns {Array<Object>} 整形済みタイル配列
     */
    getFocusCameraTiles(radiusX = 10, radiusY = 4, options = {}) {
        const asm = this.areaStateManager;
        const cx = (typeof options.centerX === 'number') ? options.centerX : asm.playerX;
        const cy = (typeof options.centerY === 'number') ? options.centerY : asm.playerY;
        const glyphGridBuffer = options.glyphGridBuffer || null;
        const sk = options.structuredKnowledge || null;
        const language = options.language || 'ja';
        const isEn = (language === 'en');

        const isDead = Boolean(options.isDead);
        const tiles = [];

        for (let dy = -radiusY; dy <= radiusY; dy++) {
            for (let dx = -radiusX; dx <= radiusX; dx++) {
                const tx = cx + dx;
                const ty = cy + dy;
                const isPlayer = (dx === 0 && dy === 0);
                const inBounds = (tx >= 0 && tx < asm.width && ty >= 0 && ty < asm.height);

                let cell = inBounds && asm.grid[ty] ? asm.grid[ty][tx] : null;
                let gData = inBounds && glyphGridBuffer && glyphGridBuffer[ty] ? glyphGridBuffer[ty][tx] : null;

                const isPreloadOnly = cell && cell.bottom && cell.bottom.isCachedPreload && !cell.middle && !cell.top;
                const hasNetHackGlyph = gData && gData.glyph >= 0 && gData.ch !== ' ';
                const hasExploredMemory = cell && ((cell.bottom && !cell.bottom.isCachedPreload) || cell.middle || cell.top);
                const hasMemory = hasExploredMemory || hasNetHackGlyph || (isPreloadOnly && isPlayer);
                const isUnexplored = !inBounds || (!hasMemory && !hasNetHackGlyph);

                let glyphId = -1;
                let symbol = ' ';
                let color = 7;
                let knowledge = null;
                let name = isEn ? 'Out of Sight' : '視界外';
                let nameJa = '視界外';

                // レイヤー別グリフの完全解決
                let bottomGlyph = -1;
                let middleGlyph = -1;
                let topGlyph = -1;
                let effectGlyph = -1;
                const renderGlyphs = [];

                if (!isUnexplored) {
                    if (cell && (cell.bottom || cell.middle || cell.top || cell.effect)) {
                        // Bottom (地形)
                        if (cell.bottom && cell.bottom.rawGlyph >= 0 && (!cell.bottom.isCachedPreload || isPlayer)) {
                            bottomGlyph = cell.bottom.rawGlyph;
                        } else if (isPlayer) {
                            // プレイヤー足元は最優先で真の床を取得・反映
                            const genuine = asm.getGenuineFloor(tx, ty);
                            if (genuine && genuine.rawGlyph >= 0) {
                                bottomGlyph = genuine.rawGlyph;
                            } else if (asm.directBindingMode === 'strict') {
                                bottomGlyph = -1;
                            } else {
                                asm.inferredFloorCount++;
                                bottomGlyph = DEFAULT_INFERRED_FLOOR_GLYPH;
                            }
                        } else if (cell.middle || cell.top) {
                            if (asm.directBindingMode === 'strict') {
                                bottomGlyph = -1;
                            } else {
                                asm.inferredFloorCount++;
                                bottomGlyph = DEFAULT_INFERRED_FLOOR_GLYPH; // 3992
                            }
                        } else if (gData && gData.glyph >= 0) {
                            bottomGlyph = gData.glyph;
                        }

                        // Middle (アイテム)
                        if (cell.middle && cell.middle.rawGlyph >= 0) {
                            middleGlyph = cell.middle.rawGlyph;
                        }

                        // Top (モンスター/プレイヤー または 死亡時の墓石)
                        if (isDead && isPlayer) {
                            topGlyph = DEFAULT_TOMBSTONE_GLYPH; // 4011
                        } else if (cell.top && cell.top.rawGlyph >= 0) {
                            topGlyph = cell.top.rawGlyph;
                        }

                        // Effect (エフェクト)
                        if (cell.effect && cell.effect.rawGlyph >= 0) {
                            effectGlyph = cell.effect.rawGlyph;
                        }
                    } else if (gData && gData.glyph >= 0) {
                        if (isDead && isPlayer) {
                            topGlyph = DEFAULT_TOMBSTONE_GLYPH;
                        } else {
                            bottomGlyph = gData.glyph;
                        }
                    }

                    if (bottomGlyph >= 0) renderGlyphs.push(bottomGlyph);
                    if (middleGlyph >= 0) renderGlyphs.push(middleGlyph);
                    if (topGlyph >= 0) renderGlyphs.push(topGlyph);
                    if (effectGlyph >= 0) renderGlyphs.push(effectGlyph);

                    // 代表グリフの特定 (top > middle > bottom > gData)
                    if (topGlyph >= 0) {
                        glyphId = topGlyph;
                        if (cell && cell.top && !isDead) {
                            symbol = cell.top.symbol || cell.top.ch || '@';
                            color = cell.top.color ?? 7;
                            nameJa = cell.top.nameJa || cell.top.name || 'モンスター';
                        } else if (isDead && isPlayer) {
                            symbol = '|';
                            color = 15;
                            nameJa = '墓石';
                        }
                    } else if (middleGlyph >= 0) {
                        glyphId = middleGlyph;
                        if (cell && cell.middle) {
                            symbol = cell.middle.symbol || cell.middle.ch || ')';
                            color = cell.middle.color ?? 7;
                            nameJa = cell.middle.nameJa || cell.middle.name || 'アイテム';
                        }
                    } else if (bottomGlyph >= 0) {
                        glyphId = bottomGlyph;
                        if (cell && cell.bottom) {
                            symbol = cell.bottom.symbol || cell.bottom.ch || '.';
                            color = cell.bottom.color ?? 7;
                            nameJa = cell.bottom.nameJa || cell.bottom.name || '地形';
                        } else if (gData) {
                            symbol = gData.ch || '.';
                            color = gData.color ?? 7;
                        }
                    }

                    if (glyphId >= 0 && sk && typeof sk.getKnowledgeByGlyph === 'function') {
                        knowledge = sk.getKnowledgeByGlyph(glyphId);
                        if (knowledge) {
                            nameJa = knowledge.nameJa || knowledge.name || nameJa;
                            name = isEn ? (knowledge.name || knowledge.nameJa) : (knowledge.nameJa || knowledge.name);
                        }
                    } else {
                        name = isEn ? (nameJa || 'Unknown') : nameJa;
                    }
                }

                tiles.push({
                    x: tx,
                    y: ty,
                    dx,
                    dy,
                    relX: dx,
                    relY: dy,
                    isPlayer,
                    inBounds,
                    isUnexplored,
                    hasMemory,
                    cell,
                    glyphId,
                    symbol,
                    color,
                    name,
                    nameJa,
                    knowledge,
                    bottomGlyph,
                    middleGlyph,
                    topGlyph,
                    effectGlyph,
                    renderGlyphs
                });
            }
        }

        return tiles;
    }
}
