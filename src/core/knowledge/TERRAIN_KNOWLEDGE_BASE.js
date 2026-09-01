/**
 * TERRAIN_KNOWLEDGE_BASE.js
 * NetHack 5.0 (3.7) 地形・設備 (Terrain / Landmarks / Facilities) 構造化ナレッジマスター (SSOT)
 *
 * Single Source of Truth: CMAP (3929〜4050) & NetHack 地形仕様
 */

export const TERRAIN_KNOWLEDGE_MAP = {
    stairs_down: {
        id: 'stairs_down',
        name: 'Stairs Down',
        category: 'STAIRS',
        icon: '🪜',
        defaultVerb: '>',
        actionLabel: 'Descend stairs (>)',
        effectSummary: 'Use \'>\' key to descend to deeper dungeon floor.'
    },
    stairs_up: {
        id: 'stairs_up',
        name: 'Stairs Up',
        category: 'STAIRS',
        icon: '🪜',
        defaultVerb: '<',
        actionLabel: 'Ascend stairs (<)',
        effectSummary: 'Use \'<\' key to ascend to shallower floor.'
    },
    closed_door: {
        id: 'closed_door',
        name: 'Closed Door',
        category: 'DOOR',
        icon: '🚪',
        defaultVerb: 'o',
        actionLabel: 'Open door (o)',
        effectSummary: 'Use \'o\' to open, or kick with \'ctrl+d\' or \'k\'.'
    },
    open_door: {
        id: 'open_door',
        name: 'Open Door',
        category: 'DOOR',
        icon: '🚪',
        defaultVerb: 'c',
        actionLabel: 'Close door (c)',
        effectSummary: 'Walk through or close with \'c\'.'
    },
    fountain: {
        id: 'fountain',
        name: 'Fountain',
        category: 'FOUNTAIN',
        icon: '⛲',
        defaultVerb: 'q',
        actionLabel: 'Drink from fountain (q)',
        effectSummary: 'Quaff with \'q\' or dip items with \'#dip\'. May grant luck, spawn a djinn, or cause poison.',
        interactions: ['CHEMISTRY_FOUNTAIN_DIP_POTION', 'CHEMISTRY_FOUNTAIN_DIP_LONG_SWORD']
    },
    sink: {
        id: 'sink',
        name: 'Sink',
        category: 'SINK',
        icon: '🚰',
        defaultVerb: 'q',
        actionLabel: 'Drink from sink (q)',
        effectSummary: 'Quaff with \'q\', kick with \'C-d\'/\'k\', or dip with \'#dip\'. Drop unidentified ring (\'d\') to identify type (WARNING: ring is lost down drain). May spawn puddings or water demon.',
        interactions: ['CHEMISTRY_SINK_DROP_RING']
    },
    altar: {
        id: 'altar',
        name: 'Altar',
        category: 'ALTAR',
        icon: '⛪',
        defaultVerb: '#offer',
        actionLabel: 'Offer sacrifice (#offer)',
        effectSummary: 'Offer corpses with \'#offer\'. Check B/U/C status of items dropped on altar. Beware of non-aligned god wrath.',
        interactions: ['CHEMISTRY_ALTAR_BUC_DROP', 'CHEMISTRY_ALTAR_OFFER_CORPSE']
    },
    grave: {
        id: 'grave',
        name: 'Grave',
        category: 'GRAVE',
        icon: '🪦',
        defaultVerb: 'a',
        actionLabel: 'Dig grave (#dig/pick-axe)',
        effectSummary: 'Gravesite. Dig with Pick-axe for loot, but beware of Ghoul/Zombie spawn and alignment penalty.'
    },
    throne: {
        id: 'throne',
        name: 'Throne',
        category: 'THRONE',
        icon: '👑',
        defaultVerb: '#sit',
        actionLabel: 'Sit on throne (#sit)',
        effectSummary: 'Royal throne. Sit with \'#sit\'. May grant wish, gold, or cause paralysis/curse.'
    },
    tree: {
        id: 'tree',
        name: 'Tree',
        category: 'TREE',
        icon: '🌳',
        defaultVerb: 'k',
        actionLabel: 'Kick tree (k)',
        effectSummary: 'Wood obstacle. Kick with \'k\' to drop fruit or chop down with Axe.'
    },
    lava: {
        id: 'lava',
        name: 'Lava',
        category: 'LAVA',
        icon: '🔥',
        effectSummary: 'Lethal fire terrain. Instantly burns player and items unless levitating.'
    },
    pool_of_water: {
        id: 'pool_of_water',
        name: 'Pool of Water',
        category: 'WATER',
        icon: '💧',
        effectSummary: 'Water obstacle. Items get wet when walking through without levitation/water walking.'
    },
    iron_bars: {
        id: 'iron_bars',
        name: 'Iron Bars',
        category: 'BARS',
        icon: '⛓️',
        effectSummary: 'Impassable bars. Can pass through when polymorphed into small creature or using Wand of Opening.'
    },
    trap: {
        id: 'trap',
        name: 'Trap',
        category: 'TRAP',
        icon: '⚠️',
        defaultVerb: '#untrap',
        actionLabel: 'Disarm trap (#untrap)',
        effectSummary: 'Disarm or avoid. Can be covered with Elbereth or boulders.'
    },
    dungeon_wall: {
        id: 'dungeon_wall',
        name: 'Dungeon Wall',
        category: 'WALL',
        icon: '🧱',
        effectSummary: 'Solid rock wall. Dig with Wand of Digging or Pick-axe.'
    },
    dungeon_floor: {
        id: 'dungeon_floor',
        name: 'Dungeon Floor',
        category: 'FLOOR',
        icon: '⬛',
        defaultVerb: 'E',
        actionLabel: 'Engrave on floor (E)',
        effectSummary: 'Normal floor. Can engrave Elbereth with \'E\' or \'e\'.'
    },
    ice: {
        id: 'ice',
        name: 'Ice',
        category: 'ICE',
        icon: '🧊',
        effectSummary: 'Slippery frozen floor. Walking or fighting on ice may cause slipping and stumbling.'
    },
    drawbridge: {
        id: 'drawbridge',
        name: 'Drawbridge',
        category: 'DOOR',
        icon: '🌉',
        effectSummary: 'Castle drawbridge. Can be opened or closed with Wand of Opening/Locking, or crushing anything underneath.'
    },
    air: {
        id: 'air',
        name: 'Air',
        category: 'AIR',
        icon: '💨',
        effectSummary: 'Open sky or void on the Plane of Air.'
    },
    cloud: {
        id: 'cloud',
        name: 'Cloud',
        category: 'AIR',
        icon: '☁️',
        effectSummary: 'Vaporous cloud or mist. Floating obstacle on air planes.'
    }
};

/**
 * cmapInfo フラグ群から対応する地形ナレッジエントリを取得
 * @param {Object} cmapInfo 
 * @returns {Object|null}
 */
export function getTerrainEntryByCmap(cmapInfo) {
    if (!cmapInfo || typeof cmapInfo !== 'object') return null;

    if (cmapInfo.isStairDown) return TERRAIN_KNOWLEDGE_MAP.stairs_down;
    if (cmapInfo.isStairUp) return TERRAIN_KNOWLEDGE_MAP.stairs_up;
    if (cmapInfo.isClosedDoor || cmapInfo.isTrappedDoor) return TERRAIN_KNOWLEDGE_MAP.closed_door;
    if (cmapInfo.isOpenDoor) return TERRAIN_KNOWLEDGE_MAP.open_door;
    if (cmapInfo.isFountain) return TERRAIN_KNOWLEDGE_MAP.fountain;
    if (cmapInfo.isSink) return TERRAIN_KNOWLEDGE_MAP.sink;
    if (cmapInfo.isAltar) return TERRAIN_KNOWLEDGE_MAP.altar;
    if (cmapInfo.isThrone) return TERRAIN_KNOWLEDGE_MAP.throne;
    if (cmapInfo.isGrave) return TERRAIN_KNOWLEDGE_MAP.grave;
    if (cmapInfo.isTree) return TERRAIN_KNOWLEDGE_MAP.tree;
    if (cmapInfo.isLava) return TERRAIN_KNOWLEDGE_MAP.lava;
    if (cmapInfo.isWater) return TERRAIN_KNOWLEDGE_MAP.pool_of_water;
    if (cmapInfo.isIce) return TERRAIN_KNOWLEDGE_MAP.ice;
    if (cmapInfo.isDrawbridge) return TERRAIN_KNOWLEDGE_MAP.drawbridge;
    if (cmapInfo.isAir) return TERRAIN_KNOWLEDGE_MAP.air;
    if (cmapInfo.isCloud) return TERRAIN_KNOWLEDGE_MAP.cloud;
    if (cmapInfo.isIronBars) return TERRAIN_KNOWLEDGE_MAP.iron_bars;
    if (cmapInfo.isTrap || cmapInfo.isTrappedChest) return TERRAIN_KNOWLEDGE_MAP.trap;
    if (cmapInfo.isWall) return TERRAIN_KNOWLEDGE_MAP.dungeon_wall;
    if (cmapInfo.isFloor || cmapInfo.isDoorway || cmapInfo.isEngraving) return TERRAIN_KNOWLEDGE_MAP.dungeon_floor;

    return null;
}

/**
 * 文字列キーまたは自然言語名から地形ナレッジエントリを取得
 * @param {string} key 
 * @returns {Object|null}
 */
export function getTerrainEntryByKey(key) {
    if (!key || typeof key !== 'string') return null;
    const lower = key.toLowerCase().trim();

    if (TERRAIN_KNOWLEDGE_MAP[lower]) return TERRAIN_KNOWLEDGE_MAP[lower];

    if (lower.includes('fountain') || lower.includes('噴水')) return TERRAIN_KNOWLEDGE_MAP.fountain;
    if (lower.includes('sink') || lower.includes('流し')) return TERRAIN_KNOWLEDGE_MAP.sink;
    if ((lower.includes('stair') || lower.includes('階段')) && (lower.includes('down') || lower.includes('下'))) return TERRAIN_KNOWLEDGE_MAP.stairs_down;
    if ((lower.includes('stair') || lower.includes('階段')) && (lower.includes('up') || lower.includes('上'))) return TERRAIN_KNOWLEDGE_MAP.stairs_up;
    if (lower.includes('throne') || lower.includes('玉座')) return TERRAIN_KNOWLEDGE_MAP.throne;
    if (lower.includes('doorway') || lower.includes('出入口') || lower.includes('出入り口')) return TERRAIN_KNOWLEDGE_MAP.dungeon_floor;
    if (lower.includes('drawbridge') || lower.includes('跳ね橋')) return TERRAIN_KNOWLEDGE_MAP.drawbridge;
    if (lower.includes('door') || lower.includes('扉') || lower.includes('ドア')) return TERRAIN_KNOWLEDGE_MAP.closed_door;
    if (lower.includes('altar') || lower.includes('祭壇')) return TERRAIN_KNOWLEDGE_MAP.altar;
    if (lower.includes('grave') || lower.includes('墓')) return TERRAIN_KNOWLEDGE_MAP.grave;
    if (lower.includes('tree') || lower.includes('木')) return TERRAIN_KNOWLEDGE_MAP.tree;
    if (lower.includes('ice') || lower.includes('氷')) return TERRAIN_KNOWLEDGE_MAP.ice;
    if (lower.includes('lava') || lower.includes('溶岩')) return TERRAIN_KNOWLEDGE_MAP.lava;
    if (lower.includes('water') || lower.includes('pool') || lower.includes('水')) return TERRAIN_KNOWLEDGE_MAP.pool_of_water;
    if (lower.includes('bars') || lower.includes('鉄格子')) return TERRAIN_KNOWLEDGE_MAP.iron_bars;
    if (lower.includes('cloud') || lower.includes('雲')) return TERRAIN_KNOWLEDGE_MAP.cloud;
    if (lower.includes('air') || lower.includes('大気')) return TERRAIN_KNOWLEDGE_MAP.air;
    if (lower.includes('trap') || lower.includes('罠')) return TERRAIN_KNOWLEDGE_MAP.trap;
    if (lower.includes('wall') || lower.includes('壁')) return TERRAIN_KNOWLEDGE_MAP.dungeon_wall;
    if (lower.includes('floor') || lower.includes('床') || lower.includes('room') || lower.includes('corridor') || lower.includes('dark part') || lower.includes('engrav')) return TERRAIN_KNOWLEDGE_MAP.dungeon_floor;

    return null;
}
