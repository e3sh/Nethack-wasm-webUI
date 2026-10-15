/**
 * DungeonLandmarkRegistry.js
 * 階段キャッシュ (stairCache)、ランドマーク台帳 (landmarkCache)、
 * 初手ブランチ階段シード (4002)、到着階段シード、店舗 (Shopkeeper) 同定・グループ化、
 * フロア遷移・再訪時の階段復元を担う台帳クラス
 */

import { classifyGlyph, ENTITY_TYPES, isShopkeeperMonster } from "../../engines/glyphClassifier.js";

/**
 * ダンジョンフロア識別子を正規化 (例: "Dlvl: 1" -> "Dlvl:1", 2 -> "Dlvl:2", "Minetown: 3" -> "Minetown:3")
 * @param {string|number} floorKey
 * @returns {string} 正規化されたフロア識別子
 */
export function normalizeFloorKey(floorKey) {
    if (floorKey === null || floorKey === undefined) return 'Dlvl:1';
    const str = String(floorKey).trim();
    if (!str) return 'Dlvl:1';

    // "Minetown:3", "Mines: 2", "Dlvl: 1", "Sokoban: 1" 等のコロン区切り形式
    if (str.includes(':')) {
        const parts = str.split(':');
        const branch = parts[0].trim() || 'Dlvl';
        const level = parseInt(parts[1], 10) || 1;
        return `${branch}:${level}`;
    }

    const match = str.match(/^([a-zA-Z\s]+)?\s*(\d+)$/i);
    if (match) {
        const branch = match[1] ? match[1].trim() : 'Dlvl';
        const level = parseInt(match[2], 10) || 1;
        return `${branch || 'Dlvl'}:${level}`;
    }
    return str;
}

/**
 * ダンジョンフロア識別子から階層番号を取得 (例: "Dlvl:3" -> 3, "Minetown:2" -> 2)
 * @param {string|number} floorKey
 * @returns {number}
 */
export function parseFloorLevel(floorKey) {
    const normalized = normalizeFloorKey(floorKey);
    const match = normalized.match(/:(\d+)$/);
    return match ? parseInt(match[1], 10) : 1;
}

export class DungeonLandmarkRegistry {
    /**
     * @param {import('../AreaStateManager.js').AreaStateManager} areaStateManager
     */
    constructor(areaStateManager) {
        this.areaStateManager = areaStateManager;
        this.currentFloor = normalizeFloorKey('Dlvl:1'); // 現在のフロア識別子 (例: "Dlvl:1", "Minetown:3")
        this.prevFloor = null;           // 直前のフロア識別子 (フロア遷移時の階層方向判定用)
        this.justTransitionedFloor = false; // 直前にフロア遷移が発生したフラグ
        this.stairCache = new Map();     // フロア別階段キャッシュ ("floor:x,y" => terrainEntity)
        this.landmarkCache = new Map();  // フロア別ランドマーク台帳キャッシュ ("floor:x,y:type" => LandmarkEntity)
        this._hasSeededInitialStair = false; // ゲーム開始時 (Dlvl:1) 初手足元上り階段の先行シード済みフラグ
        this.isFloorPending = false;     // clear_nhwindow 後のフロア確定待ちフラグ
        this.pendingStairs = [];         // フロア確定待ち中に受信した階段一覧
        this.pendingLandmarks = [];      // フロア確定待ち中に受信したランドマーク一覧
    }

    /**
     * clear_nhwindow 受信時などにフロア遷移待機状態へ移行
     */
    prepareFloorTransition() {
        this.isFloorPending = true;
        this.pendingStairs = [];
        this.pendingLandmarks = [];
    }

    /**
     * 指定フロア（省略時は currentFloor）の全階段キャッシュをグリッドに一括反映
     * ※ 未探索マスへの先行描画を防ぐため isCachedPreload: true を付与
     * @param {string} [floorKey]
     */
    applyStairCacheForFloor(floorKey = this.currentFloor) {
        const asm = this.areaStateManager;
        const normalized = normalizeFloorKey(floorKey);
        if (!normalized || !this.stairCache || this.stairCache.size === 0) return;
        const prefix = `${normalized}:`;
        for (const [key, stairEntity] of this.stairCache.entries()) {
            if (key.startsWith(prefix)) {
                const coordStr = key.slice(prefix.length);
                const [xStr, yStr] = coordStr.split(',');
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);
                if (x >= 0 && x < asm.width && y >= 0 && y < asm.height) {
                    if (asm.grid[y] && asm.grid[y][x]) {
                        asm.grid[y][x].bottom = { ...stairEntity, isCachedPreload: true };
                        asm.markDirty(x, y);
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
            const asm = this.areaStateManager;
            const normalized = normalizeFloorKey(floorKey);
            const floorChanged = this.currentFloor !== normalized;
            const wasPending = this.isFloorPending;

            if (floorChanged) {
                this.prevFloor = this.currentFloor;
                this.justTransitionedFloor = true;
            }

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
                    this.saveLandmarkToCache(item.entity, item.x, item.y, this.currentFloor);
                }
                this.pendingLandmarks = [];
            }

            // clear_nhwindow (isFloorPending) を経由せず直接 setCurrentFloor でフロアが変更された場合はグリッドを初期化
            if (floorChanged && !wasPending) {
                asm.resetGrid();
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
        this._hasSeededInitialStair = false;
        this.prevFloor = null;
        this.justTransitionedFloor = false;
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
     * 指定座標に階段エンティティを生成し、キャッシュ・台帳・グリッドへ登録
     * @param {number} x
     * @param {number} y
     * @param {number} stairGlyph
     * @param {string} floorKey
     * @returns {boolean}
     */
    registerStairAt(x, y, stairGlyph, floorKey) {
        const asm = this.areaStateManager;
        const stairInfo = classifyGlyph(stairGlyph);
        const stairEntity = {
            ...stairInfo,
            glyph: stairGlyph,
            rawGlyph: stairGlyph,
            inferred: false,
            isGenuine: true
        };

        const key = `${floorKey}:${x},${y}`;
        this.stairCache.set(key, stairEntity);

        const landmark = this.extractLandmarkEntity(x, y, stairGlyph, stairInfo);
        if (landmark) {
            this.saveLandmarkToCache(landmark, x, y, floorKey);
        }

        const cell = asm.grid[y] && asm.grid[y][x];
        if (cell && (cell.bottom === null || cell.bottom.type === ENTITY_TYPES.UNEXPLORED || cell.bottom.inferred)) {
            cell.bottom = { ...stairEntity };
            asm.markDirty(x, y);
        }

        return true;
    }

    /**
     * フロア移動時や初期開始時に、足元にある階段を判定・先行キャッシュ登録
     * NetHack 5.0 では新フロア到着時にプレイヤー直下の階段グリフが送信されないため、
     * メモリ直結情報および階層遷移の方向性（Dlvl 増減）から 100% 確実に上り/下り階段を同定して即時登録する
     * ※ 落下やテレポートによるフロア移動時は typ !== 26/27 となるため階段は絶対にシードされない
     * @param {number} x 
     * @param {number} y 
     * @returns {boolean} シード登録されたか否か
     */
    seedArrivalStair(x, y) {
        const asm = this.areaStateManager;
        if (x <= 0 || y <= 0 || x >= asm.width || y >= asm.height) return false;

        const currentNormalized = normalizeFloorKey(this.currentFloor);
        const key = `${currentNormalized}:${x},${y}`;

        // すでにキャッシュ済みであれば再登録不要
        if (this.stairCache && this.stairCache.has(key)) return false;

        // セル情報の取得 (WasmDirectBindingService による直接取得)
        let cellInfo = null;
        if (asm.directBindingService && typeof asm.directBindingService.isAvailable === 'function' && asm.directBindingService.isAvailable()) {
            cellInfo = asm.directBindingService.getCellInfo(x, y);
        }

        // 階段 (26) または ハシゴ (27) であることが真に確定している場合のみシード
        if (cellInfo && (cellInfo.typ === 26 || cellInfo.typ === 27)) {
            const isLadder = cellInfo.typ === 27;
            const prevLvl = this.prevFloor ? parseFloorLevel(this.prevFloor) : 1;
            const currLvl = parseFloorLevel(currentNormalized);

            // Dlvl:1 かつ prevFloor なしの初期開始位置階段であれば脱出階段 (4002)
            if (currentNormalized === 'Dlvl:1' && !this.prevFloor && !isLadder) {
                this._hasSeededInitialStair = true;
                return this.registerStairAt(x, y, 4002, currentNormalized);
            }

            // 浅い階に上がってきた場合 -> 足元は前の階に戻る下り階段
            // 深い階に降りてきた場合 (または同等) -> 足元は前の階に戻る上り階段
            const isUp = !(this.prevFloor && prevLvl > currLvl);

            let stairGlyph;
            if (isLadder) {
                stairGlyph = isUp ? 4004 : 4005;
            } else {
                stairGlyph = isUp ? 4000 : 4001;
            }

            return this.registerStairAt(x, y, stairGlyph, currentNormalized);
        }

        return false;
    }

    /**
     * ゲーム開始時 (Dlvl:1) の初期位置に上り階段を先行キャッシュ登録 (後方互換性)
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    seedInitialStair(x, y) {
        const asm = this.areaStateManager;
        if (this._hasSeededInitialStair) return false;
        if (normalizeFloorKey(this.currentFloor) !== 'Dlvl:1') return false;
        if (x <= 0 || y <= 0 || x >= asm.width || y >= asm.height) return false;

        this._hasSeededInitialStair = true;
        const stairGlyph = 4002;
        return this.registerStairAt(x, y, stairGlyph, 'Dlvl:1');
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
                    4007: { alignment: 'chaotic', alignmentJa: '混沌', nameJa: '祭壇 (混沌)' },
                    4008: { alignment: 'neutral', alignmentJa: '中立', nameJa: '祭壇 (中立)' },
                    4009: { alignment: 'lawful', alignmentJa: '秩序', nameJa: '祭壇 (秩序)' },
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
     * ランドマークを台帳（landmarkCache）に登録・更新
     * @param {Object} landmark 
     * @param {number} x 
     * @param {number} y 
     * @param {string} [floorKey] 
     */
    saveLandmarkToCache(landmark, x, y, floorKey = null) {
        if (!landmark || !landmark.type) return;
        const floor = normalizeFloorKey(floorKey || this.currentFloor);

        if (landmark.type === 'SHOP') {
            // 店主 (SHOP) はフロア内を歩き回るため、同一フロア内の既存 SHOP ランドマークがあれば古い座標を削除して更新
            for (const [k, v] of this.landmarkCache.entries()) {
                if (k.startsWith(`${floor}:`) && (k.endsWith(':SHOP') || v.type === 'SHOP')) {
                    this.landmarkCache.delete(k);
                }
            }
            const key = `${floor}:${x},${y}:SHOP`;
            this.landmarkCache.set(key, { ...landmark, floorKey: floor, x, y });
        } else {
            const key = `${floor}:${x},${y}:${landmark.type}`;
            this.landmarkCache.set(key, { ...landmark, floorKey: floor, x, y });
        }
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
        result.summary = DungeonLandmarkRegistry.generateLandmarksSummary(result.all);

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
}
