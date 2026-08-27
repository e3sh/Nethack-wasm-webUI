/**
 * AreaStateManager.js
 * 80x21 マップの 3 階層 (Bottom: 地形, Middle: アイテム/設置物, Top: モンスター/プレイヤー)
 * セル状態キャッシュを自走管理し、自キャラ周辺の構造化 State を提供するクラス
 */

import { classifyGlyph, ENTITY_TYPES, isShopkeeperMonster } from './glyphClassifier.js';

export const DEFAULT_INFERRED_FLOOR_GLYPH = 3992;

/**
 * ダンジョンフロア識別子を正規化 (例: "Dlvl: 1" -> "Dlvl:1", 2 -> "Dlvl:2", "Minetown: 3" -> "Minetown:3")
 * @param {string|number} floorKey
 * @returns {string} 正規化されたフロア識別子
 */
export function normalizeFloorKey(floorKey) {
    if (floorKey === null || floorKey === undefined) return 'Dlvl:1';
    const str = String(floorKey).trim();
    if (!str) return 'Dlvl:1';

    const match = str.match(/^(.*?):?\s*(\d+)$/i);
    if (match) {
        const branch = match[1] ? match[1].trim() : 'Dlvl';
        const level = parseInt(match[2], 10) || 1;
        return `${branch || 'Dlvl'}:${level}`;
    }
    return str;
}

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

export class AreaStateManager {
    constructor(width = 80, height = 24, monsterTracker = null) {
        this.width = width;
        this.height = height;
        this.playerX = 0;
        this.playerY = 0;
        this.keyMode = 'numpad'; // キーモード ('vi' | 'numpad')
        this.monsterTracker = monsterTracker;
        this.currentFloor = normalizeFloorKey('Dlvl:1'); // 現在のフロア識別子 (例: "Dlvl:1", "Minetown:3")
        this.stairCache = new Map();     // フロア別階段キャッシュ ("floor:x,y" => terrainEntity) (後方互換性維持)
        this.landmarkCache = new Map();  // フロア別ランドマーク台帳キャッシュ ("floor:x,y:type" => LandmarkEntity)
        this.isFloorPending = false;     // clear_nhwindow 後のフロア確定待ちフラグ
        this.pendingStairs = [];         // フロア確定待ち中に受信した階段一覧
        this.pendingLandmarks = [];      // フロア確定待ち中に受信したランドマーク一覧
        this.grid = [];
        this.resetGrid();
    }

    /**
     * clear_nhwindow 受信時などにフロア遷移待機状態へ移行しグリッドを初期化
     */
    prepareFloorTransition() {
        this.isFloorPending = true;
        this.pendingStairs = [];
        this.pendingLandmarks = [];
        this.resetGrid();
    }

    /**
     * 指定フロア（省略時は currentFloor）の全階段キャッシュをグリッドに一括反映
     * @param {string} [floorKey]
     */
    applyStairCacheForFloor(floorKey = this.currentFloor) {
        const normalized = normalizeFloorKey(floorKey);
        if (!normalized || !this.stairCache || this.stairCache.size === 0) return;
        const prefix = `${normalized}:`;
        for (const [key, stairEntity] of this.stairCache.entries()) {
            if (key.startsWith(prefix)) {
                const coordStr = key.slice(prefix.length);
                const [xStr, yStr] = coordStr.split(',');
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    if (this.grid[y] && this.grid[y][x]) {
                        this.grid[y][x].bottom = { ...stairEntity };
                    }
                }
            }
        }
    }

    /**
     * 現在のダンジョン階層（フロア識別子）を設定し、該当フロアの階段キャッシュを反映
     * @param {string|number} floorKey 
     */
    setCurrentFloor(floorKey) {
        if (floorKey !== undefined && floorKey !== null) {
            const normalized = normalizeFloorKey(floorKey);
            const floorChanged = this.currentFloor !== normalized;
            const wasPending = this.isFloorPending;

            this.currentFloor = normalized;
            this.isFloorPending = false;

            // フロア遷移待ち中に受信した階段を正式登録
            if (this.pendingStairs.length > 0) {
                for (const item of this.pendingStairs) {
                    const key = `${this.currentFloor}:${item.x},${item.y}`;
                    this.stairCache.set(key, { ...item.entity });
                }
                this.pendingStairs = [];
            }

            // フロア遷移待ち中に受信したランドマークを正式登録
            if (this.pendingLandmarks.length > 0) {
                for (const item of this.pendingLandmarks) {
                    const key = `${this.currentFloor}:${item.x},${item.y}:${item.entity.type}`;
                    this.landmarkCache.set(key, { ...item.entity, floorKey: this.currentFloor });
                }
                this.pendingLandmarks = [];
            }

            // clear_nhwindow (isFloorPending) を経由せず直接 setCurrentFloor でフロアが変更された場合はグリッドを初期化
            if (floorChanged && !wasPending) {
                this.resetGrid();
            }

            this.applyStairCacheForFloor(this.currentFloor);
        }
    }

    /**
     * 階段キャッシュを初期化（ゲームリスタート時など）
     */
    clearStairCache() {
        this.stairCache.clear();
        this.pendingStairs = [];
    }

    /**
     * ランドマーク台帳キャッシュを初期化
     */
    clearLandmarkCache() {
        this.landmarkCache.clear();
        this.pendingLandmarks = [];
        this.clearStairCache();
    }

    /**
     * グリフ情報からランドマーク (LandmarkEntity) を抽出・判定
     * @param {number} x 
     * @param {number} y 
     * @param {number} glyphId 
     * @param {Object} [info] 
     * @returns {Object|null} LandmarkEntity
     */
    extractLandmarkEntity(x, y, glyphId, info = null) {
        const itemInfo = info || classifyGlyph(glyphId);
        if (!itemInfo) return null;

        const floorKey = normalizeFloorKey(this.currentFloor);
        const baseId = `${floorKey}:${x},${y}`;

        if (itemInfo.cmapFlags) {
            const cf = itemInfo.cmapFlags;
            if (cf.isStairUp) {
                return {
                    id: `${baseId}:STAIR_UP`,
                    type: 'STAIR_UP',
                    floorKey,
                    x,
                    y,
                    glyphId,
                    icon: '🪜',
                    name: 'stair up',
                    nameJa: '上り階段'
                };
            }
            if (cf.isStairDown) {
                return {
                    id: `${baseId}:STAIR_DOWN`,
                    type: 'STAIR_DOWN',
                    floorKey,
                    x,
                    y,
                    glyphId,
                    icon: '🪜',
                    name: 'stair down',
                    nameJa: '下り階段'
                };
            }
            if (cf.isAltar) {
                const alignMap = {
                    4006: { alignment: 'unaligned', alignmentJa: '無属性', nameJa: '祭壇 (無属性)' },
                    4007: { alignment: 'lawful', alignmentJa: '秩序', nameJa: '祭壇 (秩序)' },
                    4008: { alignment: 'neutral', alignmentJa: '中立', nameJa: '祭壇 (中立)' },
                    4009: { alignment: 'chaotic', alignmentJa: '混沌', nameJa: '祭壇 (混沌)' },
                    4010: { alignment: 'other', alignmentJa: '異教', nameJa: '祭壇 (異教)' }
                };
                const aInfo = alignMap[glyphId] || { alignment: 'neutral', alignmentJa: '中立', nameJa: '祭壇' };
                return {
                    id: `${baseId}:ALTAR`,
                    type: 'ALTAR',
                    floorKey,
                    x,
                    y,
                    glyphId,
                    icon: '⛪',
                    name: `altar (${aInfo.alignment})`,
                    nameJa: aInfo.nameJa,
                    details: {
                        alignment: aInfo.alignment,
                        alignmentJa: aInfo.alignmentJa
                    }
                };
            }
            if (cf.isSink) {
                return {
                    id: `${baseId}:SINK`,
                    type: 'SINK',
                    floorKey,
                    x,
                    y,
                    glyphId,
                    icon: '🚰',
                    name: 'sink',
                    nameJa: '流し台'
                };
            }
            if (cf.isFountain) {
                return {
                    id: `${baseId}:FOUNTAIN`,
                    type: 'FOUNTAIN',
                    floorKey,
                    x,
                    y,
                    glyphId,
                    icon: '⛲',
                    name: 'fountain',
                    nameJa: '噴水'
                };
            }
            if (cf.isThrone) {
                return {
                    id: `${baseId}:THRONE`,
                    type: 'THRONE',
                    floorKey,
                    x,
                    y,
                    glyphId,
                    icon: '👑',
                    name: 'throne',
                    nameJa: '王座'
                };
            }
        }

        if (itemInfo.type === ENTITY_TYPES.MONSTER && (itemInfo.isShopkeeper || isShopkeeperMonster(itemInfo.monOffset))) {
            return {
                id: `${baseId}:SHOP`,
                type: 'SHOP',
                floorKey,
                x,
                y,
                glyphId,
                icon: '🏪',
                name: 'shopkeeper',
                nameJa: '商店 (店主)',
                details: {
                    shopkeeperType: 'shopkeeper'
                }
            };
        }

        return null;
    }

    /**
     * 発見済みランドマーク配列から、HUD/バッジ用の集約サマリー配列を生成
     * @param {Array<Object>} allEntities 
     * @returns {Array<Object>} FloorLandmarkSummaryItem[]
     */
    static generateLandmarksSummary(allEntities = []) {
        if (!Array.isArray(allEntities) || allEntities.length === 0) return [];

        const groupMap = new Map();

        allEntities.forEach(item => {
            if (!item || !item.type) return;
            const alignment = item.details?.alignment;
            const groupKey = item.type === 'ALTAR' ? `ALTAR:${alignment || 'neutral'}` : item.type;

            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    id: groupKey,
                    type: item.type,
                    icon: item.icon || '📍',
                    nameJa: item.nameJa || item.name,
                    nameEn: item.name || item.nameJa,
                    count: 0,
                    coords: [],
                    details: item.details || {}
                });
            }

            const g = groupMap.get(groupKey);
            g.count++;
            g.coords.push({ x: item.x, y: item.y });
        });

        return Array.from(groupMap.values()).map(g => {
            const coordStrs = g.coords.map(c => `(${c.x},${c.y})`).join(', ');
            const locTextJa = g.count > 1 ? ` (${g.count}箇所)` : '';
            const locTextEn = g.count > 1 ? ` (${g.count} locations)` : '';
            return {
                id: g.id,
                type: g.type,
                icon: g.icon,
                nameJa: g.nameJa,
                nameEn: g.nameEn,
                count: g.count,
                coords: g.coords,
                tooltipJa: `${g.nameJa}${locTextJa}: ${coordStrs}`,
                tooltipEn: `${g.nameEn}${locTextEn}: ${coordStrs}`,
                details: g.details
            };
        });
    }

    /**
     * 指定フロア（省略時は currentFloor）に存在するランドマーク一覧の集計概要を取得
     * @param {string|number} [floorKey]
     * @returns {Object} FloorLandmarksData
     */
    getFloorLandmarks(floorKey = this.currentFloor) {
        const normalized = normalizeFloorKey(floorKey);
        const prefix = `${normalized}:`;

        const result = {
            floorKey: normalized,
            currentFloor: this.currentFloor,
            totalCount: 0,
            summary: [],
            stairsUp: [],
            stairsDown: [],
            altars: [],
            sinks: [],
            fountains: [],
            thrones: [],
            shops: [],
            all: []
        };

        if (!this.landmarkCache) return result;

        for (const [key, landmark] of this.landmarkCache.entries()) {
            if (key.startsWith(prefix) || landmark.floorKey === normalized) {
                result.all.push(landmark);
                switch (landmark.type) {
                    case 'STAIR_UP':
                        result.stairsUp.push(landmark);
                        break;
                    case 'STAIR_DOWN':
                        result.stairsDown.push(landmark);
                        break;
                    case 'ALTAR':
                        result.altars.push(landmark);
                        break;
                    case 'SINK':
                        result.sinks.push(landmark);
                        break;
                    case 'FOUNTAIN':
                        result.fountains.push(landmark);
                        break;
                    case 'THRONE':
                        result.thrones.push(landmark);
                        break;
                    case 'SHOP':
                        result.shops.push(landmark);
                        break;
                    default:
                        break;
                }
            }
        }

        result.totalCount = result.all.length;
        result.summary = AreaStateManager.generateLandmarksSummary(result.all);

        return result;
    }

    /**
     * 全フロアで発見されたランドマーク一覧を取得
     * @returns {Array<Object>} LandmarkEntity[]
     */
    getAllLandmarks() {
        if (!this.landmarkCache) return [];
        return Array.from(this.landmarkCache.values());
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
                    top: null,    // モンスター / プレイヤー
                    effect: null  // エフェクト（ビーム・稲妻・爆発等の過渡的表示）
                });
            }
            this.grid.push(row);
        }
    }

    /**
     * ランドマーク台帳・階段キャッシュを完全に初期化
     */
    clearLandmarks() {
        if (this.stairCache) this.stairCache.clear();
        if (this.landmarkCache) this.landmarkCache.clear();
        this.pendingStairs = [];
        this.pendingLandmarks = [];
        this.currentFloor = normalizeFloorKey('Dlvl:1');
    }

    /**
     * グリッドおよび全キャッシュを完全リセット
     */
    resetAll() {
        this.resetGrid();
        this.clearLandmarks();
    }

    /**
     * 描画グリフの更新を受信し、3 階層キャッシュ＋エフェクトを即座に適用
     * @param {number} x 
     * @param {number} y 
     * @param {number} glyphId 
     * @param {Object} [glyphInfo] 
     */
    updateGlyph(x, y, glyphId, glyphInfo = null) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        const info = classifyGlyph(glyphId);
        const cell = this.grid[y][x];

        // ランドマークの検出と台帳への記録
        const landmark = this.extractLandmarkEntity(x, y, glyphId, info);
        if (landmark) {
            if (this.isFloorPending) {
                this.pendingLandmarks.push({ x, y, entity: landmark });
            } else {
                const key = `${normalizeFloorKey(this.currentFloor)}:${x},${y}:${landmark.type}`;
                this.landmarkCache.set(key, landmark);
            }
        }

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
                cell.effect = null;

                // 階段・ハシゴであればフロア別キャッシュに記録 (後方互換性)
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
                // アイテム類が届いた場合、Middle に記録。以前モンスターが存在していた場合は MonsterTracker にロストを通知
                if (cell.top && this.monsterTracker && typeof this.monsterTracker.notifyCellLostMonster === 'function') {
                    this.monsterTracker.notifyCellLostMonster(x, y);
                }
                if (cell.bottom === null) {
                    cell.bottom = createInferredFloor();
                }
                cell.middle = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
                cell.top = null;
                cell.effect = null;
                break;

            case ENTITY_TYPES.MONSTER:
            case ENTITY_TYPES.PET:
                // モンスターが届いた場合、Top に記録 (同じモンスターなら確定動的状態 dynamicState も保持)
                const existingDynamic = (cell.top && (cell.top.monOffset === info.monOffset || cell.top.glyph === glyphId))
                    ? cell.top.dynamicState
                    : null;
                if (cell.bottom === null) {
                    cell.bottom = createInferredFloor();
                }
                cell.top = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId, dynamicState: existingDynamic };
                cell.effect = null;
                if (this.monsterTracker && typeof this.monsterTracker.updateVisibleMonster === 'function') {
                    this.monsterTracker.updateVisibleMonster(x, y, glyphId, glyphInfo);
                }
                break;

            case ENTITY_TYPES.EFFECT:
                // エフェクト（ビーム・稲妻・爆発等）を最前面エフェクトレイヤーとして保持
                cell.effect = { ...info, glyphInfo, glyph: glyphId, rawGlyph: glyphId };
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
            const cell = this.grid[y][x];
            if (cell && cell.bottom === null) {
                const key = `${normalizeFloorKey(this.currentFloor)}:${x},${y}`;
                const cachedStair = this.stairCache.get(key);
                if (cachedStair) {
                    cell.bottom = { ...cachedStair };
                } else {
                    cell.bottom = createInferredFloor();
                }
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

        const landmarks = this.getFloorLandmarks(this.currentFloor);

        return {
            center: { x: cx, y: cy },
            radius,
            playerX: this.playerX,
            playerY: this.playerY,
            playerLocation: { x: this.playerX, y: this.playerY },
            keyMode: this.keyMode,
            currentFloor: this.currentFloor,
            landmarks,
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

