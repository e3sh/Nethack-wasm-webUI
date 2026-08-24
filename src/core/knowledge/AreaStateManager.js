/**
 * AreaStateManager.js
 * 80x21 マップの 3 階層 (Bottom: 地形, Middle: アイテム/設置物, Top: モンスター/プレイヤー)
 * セル状態キャッシュを自走管理し、自キャラ周辺の構造化 State を提供するクラス
 */

import { classifyGlyph, ENTITY_TYPES } from './glyphClassifier.js';

export class AreaStateManager {
    constructor(width = 80, height = 24, monsterTracker = null) {
        this.width = width;
        this.height = height;
        this.playerX = 0;
        this.playerY = 0;
        this.keyMode = 'numpad'; // キーモード ('vi' | 'numpad')
        this.monsterTracker = monsterTracker;
        this.grid = [];
        this.resetGrid();
    }

    /**
     * MonsterTracker インスタンスを設定
     * @param {Object} tracker 
     */
    setMonsterTracker(tracker) {
        this.monsterTracker = tracker;
    }

    /**
     * グリッドキャッシュを初期化
     */
    resetGrid() {
        if (this.monsterTracker && typeof this.monsterTracker.reset === 'function') {
            this.monsterTracker.reset();
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
                    top: null     // モンスター / ペット
                });
            }
            this.grid.push(row);
        }
    }

    /**
     * 描画グリフの更新を受信し、3 階層キャッシュを即座に適用
     * @param {number} x 
     * @param {number} y 
     * @param {number} glyphId 
     * @param {Object} [glyphInfo] 
     */
    updateGlyph(x, y, glyphId, glyphInfo = null) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        const info = classifyGlyph(glyphId);
        const cell = this.grid[y][x];

        switch (info.type) {
            case ENTITY_TYPES.TERRAIN:
            case ENTITY_TYPES.UNEXPLORED:
                // 地形が届いた場合、Bottom に上書き。以前モンスターが存在していた場合は MonsterTracker にロストを通知
                if (cell.top && this.monsterTracker && typeof this.monsterTracker.notifyCellLostMonster === 'function') {
                    this.monsterTracker.notifyCellLostMonster(x, y);
                }
                cell.bottom = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                cell.middle = null;
                cell.top = null;
                break;

            case ENTITY_TYPES.ITEM:
            case ENTITY_TYPES.BODY:
            case ENTITY_TYPES.STATUE:
                // アイテム類が届いた場合、Middle に記録。以前モンスターが存在していた場合は MonsterTracker にロストを通知
                if (cell.top && this.monsterTracker && typeof this.monsterTracker.notifyCellLostMonster === 'function') {
                    this.monsterTracker.notifyCellLostMonster(x, y);
                }
                cell.middle = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                cell.top = null;
                break;

            case ENTITY_TYPES.MONSTER:
            case ENTITY_TYPES.PET:
                // モンスターが届いた場合、Top に記録 (同じモンスターなら確定動的状態 dynamicState も保持)
                const existingDynamic = (cell.top && (cell.top.monOffset === info.monOffset || cell.top.glyph === glyphId))
                    ? cell.top.dynamicState
                    : null;
                cell.top = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId, dynamicState: existingDynamic };
                if (this.monsterTracker && typeof this.monsterTracker.updateVisibleMonster === 'function') {
                    this.monsterTracker.updateVisibleMonster(x, y, glyphId, glyphInfo);
                }
                break;

            case ENTITY_TYPES.EFFECT:
                // エフェクト（爆発等）は一時的な表示
                break;

            default:
                break;
        }
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

    /**
     * プレイヤー現在地の更新
     * @param {number} x 
     * @param {number} y 
     */
    updatePlayerPosition(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            if (this.monsterTracker && typeof this.monsterTracker.handlePlayerPosition === 'function') {
                this.monsterTracker.handlePlayerPosition(x, y);
            }
            if (this.playerX === x && this.playerY === y) return false;
            this.playerX = x;
            this.playerY = y;
            return true;
        }
        return false;
    }

    /**
     * 指定セル (デフォルト: プレイヤー現在地) の周辺 N マスの構造化エリア状態を取得
     * @param {number} [cx] 中心 X (省略時は playerX)
     * @param {number} [cy] 中心 Y (省略時は playerY)
     * @param {number} [radius=1] 半径 (1 で 3x3)
     * @returns {Object} 構造化 AreaState
     */
    getAreaState(cx = this.playerX, cy = this.playerY, radius = 1) {
        const cells = [];
        const adjacentMonsters = [];
        const adjacentEntities = [];

        // 方角マップ (keyMode に応じて Vi-keys / NumPad キーを動的切替)
        const getDirectionName = (dx, dy) => {
            const isNumpad = (this.keyMode === 'numpad');
            if (dx === 0 && dy === -1) return { code: 'N', name: '北', key: isNumpad ? '8' : 'k' };
            if (dx === 1 && dy === -1) return { code: 'NE', name: '北東', key: isNumpad ? '9' : 'u' };
            if (dx === 1 && dy === 0) return { code: 'E', name: '東', key: isNumpad ? '6' : 'l' };
            if (dx === 1 && dy === 1) return { code: 'SE', name: '南東', key: isNumpad ? '3' : 'n' };
            if (dx === 0 && dy === 1) return { code: 'S', name: '南', key: isNumpad ? '2' : 'j' };
            if (dx === -1 && dy === 1) return { code: 'SW', name: '南西', key: isNumpad ? '1' : 'b' };
            if (dx === -1 && dy === 0) return { code: 'W', name: '西', key: isNumpad ? '4' : 'h' };
            if (dx === -1 && dy === -1) return { code: 'NW', name: '北西', key: isNumpad ? '7' : 'y' };
            return { code: 'SELF', name: '足元', key: isNumpad ? '5' : '.' };
        };

        let feetState = null;

        for (let dy = -radius; dy <= radius; dy++) {
            const row = [];
            for (let dx = -radius; dx <= radius; dx++) {
                const targetX = cx + dx;
                const targetY = cy + dy;

                let cellData = null;
                if (targetX >= 0 && targetX < this.width && targetY >= 0 && targetY < this.height) {
                    cellData = { ...this.grid[targetY][targetX] };
                } else {
                    cellData = { x: targetX, y: targetY, bottom: null, middle: null, top: null };
                }

                const dir = getDirectionName(dx, dy);
                const enrichedCell = {
                    ...cellData,
                    relX: dx,
                    relY: dy,
                    dir
                };

                row.push(enrichedCell);

                if (dx === 0 && dy === 0) {
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

        const trackedMonsters = (this.monsterTracker && typeof this.monsterTracker.getTrackedMonsters === 'function')
            ? this.monsterTracker.getTrackedMonsters()
            : [];

        const perceivedMonsters = (this.monsterTracker && typeof this.monsterTracker.getPerceivedMonstersSummary === 'function')
            ? this.monsterTracker.getPerceivedMonstersSummary({ playerX: this.playerX, playerY: this.playerY, grid: this.grid })
            : [];

        return {
            center: { x: cx, y: cy },
            radius,
            playerX: this.playerX,
            playerY: this.playerY,
            playerLocation: { x: this.playerX, y: this.playerY },
            keyMode: this.keyMode,
            width: this.width,
            height: this.height,
            grid: this.grid,
            feet: feetState,
            cells,
            adjacentMonsters,
            adjacentEntities,
            trackedMonsters,
            perceivedMonsters
        };
    }
}

