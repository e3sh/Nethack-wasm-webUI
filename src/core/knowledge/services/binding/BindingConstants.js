/**
 * BindingConstants.js
 *
 * NetHack Wasm Cコア（shim_bridge.c）との Direct Binding で使用される
 * コマンド定数、ビットマスク、型定義、および純粋デコード関数群。
 */

import '../../../../driver/NetHackMemory.js';
import { SKILL_RANKS } from '../../state/SkillStateManager.js';

export const getGlobalMemoryClass = () => {
    if (typeof globalThis !== 'undefined' && globalThis.NetHackMemory) return globalThis.NetHackMemory;
    if (typeof window !== 'undefined' && window.NetHackMemory) return window.NetHackMemory;
    if (typeof global !== 'undefined' && global.NetHackMemory) return global.NetHackMemory;
    return null;
};

export const SHIM_CMD = {
    GET_CELL_INFO: 0x10,
    DUMP_LEVEL_TERRAIN: 0x11,
    GET_TRAP_AT: 0x12,
    GET_ENGRAVING_AT: 0x13,
    GET_ROOM_TYPE: 0x14,

    GET_OBJECT_AT: 0x20,
    GET_MONSTER_AT: 0x21,
    GET_MONSTER_INFO: 0x22,
    GET_MONSTER_STATE: 0x23,

    GET_PLAYER_SUMMARY: 0x30,
    GET_PLAYER_PTR: 0x31,
    GET_PLAYER_PROPS: 0x32,
    GET_PLAYER_PROFILE: 0x33,

    GET_INVENT_PTR: 0x40,
    GET_EQUIPMENT_PTRS: 0x41,
    DUMP_OBJECT_INFO: 0x42,
    DUMP_ALL_INVENT: 0x43,

    DUMP_SPELL_BOOK: 0x50,
    DUMP_SKILLS: 0x51,

    DUMP_DISCOVERIES: 0x60,
    GET_OBJECT_UNAME: 0x61,
    DUMP_DESCR_INDEXES: 0x62,

    GET_SYMBOL_PTR: 0x70,
};

export const LEVL_TYP = {
    STONE: 0,
    VWALL: 1,
    HWALL: 2,
    TLCORNER: 3,
    TRCORNER: 4,
    BLCORNER: 5,
    BRCORNER: 6,
    CROSSWALL: 7,
    TUWALL: 8,
    TDWALL: 9,
    TLWALL: 10,
    TRWALL: 11,
    DBWALL: 12,
    TREE: 13,
    SDOOR: 14,
    SCORR: 15,
    POOL: 16,
    MOAT: 17,
    WATER: 18,
    DRAWBRIDGE_UP: 19,
    LAVAPOOL: 20,
    LAVAWALL: 21,
    IRONBARS: 22,
    DOOR: 23,
    CORR: 24,
    ROOM: 25,
    STAIRS: 26,
    LADDER: 27,
    FOUNTAIN: 28,
    THRONE: 29,
    SINK: 30,
    GRAVE: 31,
    ALTAR: 32,
    ICE: 33,
    DRAWBRIDGE_DOWN: 34,
    AIR: 35,
    CLOUD: 36
};

export const DOOR_STATE = {
    D_NODOOR: 0x00,
    D_BROKEN: 0x01,
    D_ISOPEN: 0x02,
    D_CLOSED: 0x04,
    D_LOCKED: 0x08,
    D_TRAPPED: 0x10
};

export const ALTAR_MASK = {
    AM_NONE: 0x00,
    AM_CHAOTIC: 0x01,
    AM_NEUTRAL: 0x02,
    AM_LAWFUL: 0x04,
    AM_MASK: 0x07,
    AM_SHRINE: 0x08,
    AM_SANCTUM: 0x10
};

/**
 * struct rm の flags (altarmask) から祭壇の属性・グリフを解析
 * @param {number} flags 
 * @returns {Object}
 */
export function parseAltarFlags(flags) {
    const isSanctum = Boolean(flags & ALTAR_MASK.AM_SANCTUM);
    const isShrine = Boolean(flags & ALTAR_MASK.AM_SHRINE);
    const alignBits = flags & ALTAR_MASK.AM_MASK;

    let alignment = 'neutral';
    let alignmentJa = '中立';
    let glyph = 4008;

    if (isSanctum) {
        alignment = 'other';
        alignmentJa = '聖域';
        glyph = 4010;
    } else if (alignBits === ALTAR_MASK.AM_LAWFUL) {
        alignment = 'lawful';
        alignmentJa = '秩序';
        glyph = 4009;
    } else if (alignBits === ALTAR_MASK.AM_CHAOTIC) {
        alignment = 'chaotic';
        alignmentJa = '混沌';
        glyph = 4007;
    } else if (alignBits === ALTAR_MASK.AM_NEUTRAL) {
        alignment = 'neutral';
        alignmentJa = '中立';
        glyph = 4008;
    } else if (alignBits === ALTAR_MASK.AM_NONE) {
        alignment = 'unaligned';
        alignmentJa = '無属性';
        glyph = 4006;
    }

    return {
        alignment,
        alignmentJa,
        isSanctum,
        isShrine,
        glyph
    };
}

export const ROOM_TYPE = {
    OROOM: 0,
    THEMEROOM: 1,
    COURT: 2,
    SWAMP: 3,
    VAULT: 4,
    BEEHIVE: 5,
    MORGUE: 6,
    BARRACKS: 7,
    ZOO: 8,
    DELPHI: 9,
    TEMPLE: 10,
    LEPREHALL: 11,
    COCKNEST: 12,
    ANTHOLE: 13,
    SHOPBASE: 14,
    ARMORSHOP: 15,
    SCROLLSHOP: 16,
    POTIONSHOP: 17,
    WEAPONSHOP: 18,
    FOODSHOP: 19,
    RINGSHOP: 20,
    WANDSHOP: 21,
    TOOLSHOP: 22,
    BOOKSHOP: 23,
    FODDERSHOP: 24,
    CANDLESHOP: 25
};

export const ROOM_NAMES = {
    0: { name: 'Ordinary Room', nameJa: '普通の部屋' },
    1: { name: 'Theme Room', nameJa: 'テーマ部屋' },
    2: { name: 'Throne Room', nameJa: '玉座の間' },
    3: { name: 'Swamp', nameJa: '沼地' },
    4: { name: 'Vault', nameJa: '宝物庫' },
    5: { name: 'Beehive', nameJa: '蜂の巣' },
    6: { name: 'Morgue', nameJa: '死体安置所' },
    7: { name: 'Barracks', nameJa: '兵舎' },
    8: { name: 'Zoo', nameJa: '動物園' },
    9: { name: 'Delphi', nameJa: '神託所' },
    10: { name: 'Temple', nameJa: '寺院' },
    11: { name: 'Leprechaun Hall', nameJa: 'レプラホーンの広間' },
    12: { name: 'Cockatrice Nest', nameJa: 'コカトリスの巣' },
    13: { name: 'Anthole', nameJa: '蟻の巣' },
    14: { name: 'General Store', nameJa: '雑貨屋' },
    15: { name: 'Armor Shop', nameJa: '防具屋' },
    16: { name: 'Scroll Shop', nameJa: '巻物屋' },
    17: { name: 'Potion Shop', nameJa: '薬屋' },
    18: { name: 'Weapon Shop', nameJa: '武器屋' },
    19: { name: 'Delicatessen', nameJa: '食料品店' },
    20: { name: 'Jewelry Shop', nameJa: '宝石店' },
    21: { name: 'Wand Shop', nameJa: '杖屋' },
    22: { name: 'Tool Shop', nameJa: '道具屋' },
    23: { name: 'Bookstore', nameJa: '書店' },
    24: { name: 'Health Food Store', nameJa: '自然食品店' },
    25: { name: 'Candle Shop', nameJa: '蝋燭屋' }
};

export const TRAP_TYPE = {
    NO_TRAP: 0,
    ARROW_TRAP: 1,
    DART_TRAP: 2,
    ROCKTRAP: 3,
    SQKY_BOARD: 4,
    BEAR_TRAP: 5,
    LANDMINE: 6,
    ROLLING_BOULDER_TRAP: 7,
    SLP_GAS_TRAP: 8,
    RUST_TRAP: 9,
    FIRE_TRAP: 10,
    PIT: 11,
    SPIKED_PIT: 12,
    HOLE: 13,
    TRAPDOOR: 14,
    TELEP_TRAP: 15,
    LEVEL_TELEP: 16,
    MAGIC_PORTAL: 17,
    WEB: 18,
    STATUE_TRAP: 19,
    MAGIC_TRAP: 20,
    ANTI_MAGIC: 21,
    POLY_TRAP: 22,
    VIBRATING_SQUARE: 23
};

export const TRAP_NAMES = {
    1: { name: 'arrow trap', nameJa: '矢の罠' },
    2: { name: 'dart trap', nameJa: 'ダーツの罠' },
    3: { name: 'rock trap', nameJa: '落石の罠' },
    4: { name: 'squeaky board', nameJa: '鳴る床板' },
    5: { name: 'bear trap', nameJa: 'トラバサミ' },
    6: { name: 'land mine', nameJa: '地雷' },
    7: { name: 'rolling boulder trap', nameJa: '大岩の罠' },
    8: { name: 'sleeping gas trap', nameJa: '睡眠ガスの罠' },
    9: { name: 'rust trap', nameJa: 'サビの罠' },
    10: { name: 'fire trap', nameJa: '火炎の罠' },
    11: { name: 'pit', nameJa: '落とし穴 (ピット)' },
    12: { name: 'spiked pit', nameJa: 'トゲ付きピット' },
    13: { name: 'hole', nameJa: '大穴' },
    14: { name: 'trap door', nameJa: '落とし扉' },
    15: { name: 'teleportation trap', nameJa: 'テレポートの罠' },
    16: { name: 'level teleporter', nameJa: '階層テレポートの罠' },
    17: { name: 'magic portal', nameJa: '魔法のポータル' },
    18: { name: 'web', nameJa: 'クモの巣' },
    19: { name: 'statue trap', nameJa: '像の罠' },
    20: { name: 'magic trap', nameJa: '魔法の罠' },
    21: { name: 'anti-magic field', nameJa: '反魔法の場' },
    22: { name: 'polymorph trap', nameJa: '変化の罠' },
    23: { name: 'vibrating square', nameJa: '振動する床' }
};

export const ENGRAVING_TYPE = {
    DUST: 1,
    ENGRAVE: 2,
    BURN: 3,
    MARK: 4,
    ENGR_BLOOD: 5,
    HEADSTONE: 6
};

export const ENGRAVING_NAMES = {
    1: { name: 'dust', nameJa: '砂/埃' },
    2: { name: 'engraved', nameJa: '彫り' },
    3: { name: 'burned', nameJa: '焼き' },
    4: { name: 'mark', nameJa: '印' },
    5: { name: 'blood', nameJa: '血' },
    6: { name: 'headstone', nameJa: '墓石' }
};

export const EQUIPMENT_SLOT_NAMES = [
    'weapon',      // 0: uwep
    'offhand',     // 1: uswapwep
    'quiver',      // 2: uquiver
    'suit',        // 3: uarm (鎧/胴防具)
    'cloak',       // 4: uarmc (マント)
    'helmet',      // 5: uarmh (兜/帽子)
    'shield',      // 6: uarms (盾)
    'gloves',      // 7: uarmg (手袋)
    'boots',       // 8: uarmf (靴)
    'shirt',       // 9: uarmu (シャツ/下着)
    'amulet',      // 10: uamul (魔除け)
    'ring_left',   // 11: uleft (左手指輪)
    'ring_right',  // 12: uright (右手指輪)
    'blindfold'    // 13: ublindf (目隠し/眼鏡)
];

export const EQUIPMENT_FIELD_KEYS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmc', 'uarmh',
    'uarms', 'uarmg', 'uarmf', 'uarmu', 'uamul', 'uleft', 'uright', 'ublindf'
];

export const SKILL_DEFINITIONS = [
    null, // 0: P_NONE
    { id: 1, name: 'dagger', nameJa: '短剣' },
    { id: 2, name: 'knife', nameJa: 'ナイフ' },
    { id: 3, name: 'axe', nameJa: '斧' },
    { id: 4, name: 'pick-axe', nameJa: 'つるはし' },
    { id: 5, name: 'short sword', nameJa: 'ショートソード' },
    { id: 6, name: 'broadsword', nameJa: 'ブロードソード' },
    { id: 7, name: 'long sword', nameJa: 'ロングソード' },
    { id: 8, name: 'two-handed sword', nameJa: '両手剣' },
    { id: 9, name: 'scimitar', nameJa: '三日月刀' },
    { id: 10, name: 'club', nameJa: 'こん棒' },
    { id: 11, name: 'mace', nameJa: 'メイス' },
    { id: 12, name: 'morning star', nameJa: 'モーニングスター' },
    { id: 13, name: 'flail', nameJa: 'フレイル' },
    { id: 14, name: 'hammer', nameJa: 'ハンマー' },
    { id: 15, name: 'quarterstaff', nameJa: '六尺棒' },
    { id: 16, name: 'polearms', nameJa: '長柄武器' },
    { id: 17, name: 'spear', nameJa: '槍' },
    { id: 18, name: 'trident', nameJa: '三叉槍' },
    { id: 19, name: 'lance', nameJa: 'ランス' },
    { id: 20, name: 'bow', nameJa: '弓' },
    { id: 21, name: 'sling', nameJa: 'スリング' },
    { id: 22, name: 'crossbow', nameJa: 'クロスボウ' },
    { id: 23, name: 'dart', nameJa: 'ダーツ' },
    { id: 24, name: 'shuriken', nameJa: '手裏剣' },
    { id: 25, name: 'boomerang', nameJa: 'ブーメラン' },
    { id: 26, name: 'whip', nameJa: '鞭' },
    { id: 27, name: 'unicorn horn', nameJa: 'ユニコーンの角' },
    { id: 28, name: 'attack spell', nameJa: '攻撃魔法' },
    { id: 29, name: 'healing spell', nameJa: '回復魔法' },
    { id: 30, name: 'divination spell', nameJa: '予見魔法' },
    { id: 31, name: 'enchantment spell', nameJa: '付与魔法' },
    { id: 32, name: 'cleric spell', nameJa: '僧侶魔法' },
    { id: 33, name: 'escape spell', nameJa: '脱出魔法' },
    { id: 34, name: 'matter spell', nameJa: '物質魔法' },
    { id: 35, name: 'bare-handed combat', nameJa: '素手格闘' },
    { id: 36, name: 'two-weapon combat', nameJa: '二刀流' },
    { id: 37, name: 'riding', nameJa: '乗馬' }
];

export const SKILL_LEVEL_RANKS = [
    SKILL_RANKS.RESTRICTED,   // 0: P_ISRESTRICTED
    SKILL_RANKS.UNSKILLED,    // 1: P_UNSKILLED
    SKILL_RANKS.BASIC,        // 2: P_BASIC
    SKILL_RANKS.SKILLED,      // 3: P_SKILLED
    SKILL_RANKS.EXPERT,       // 4: P_EXPERT
    SKILL_RANKS.MASTER,       // 5: P_MASTER
    SKILL_RANKS.GRAND_MASTER  // 6: P_GRAND_MASTER
];

export function parseSkillsBuffer(raw, weaponSlots = 0) {
    if (!raw || raw.length < 38 * 2) return [];
    const skills = [];
    for (let i = 1; i < 38; i++) {
        const def = SKILL_DEFINITIONS[i];
        if (!def) continue;
        const skillLev = raw[i * 2 + 0];
        const maxSkillLev = raw[i * 2 + 1];

        const rank = SKILL_LEVEL_RANKS[skillLev] || SKILL_RANKS.RESTRICTED;
        const maxRank = SKILL_LEVEL_RANKS[maxSkillLev] || SKILL_RANKS.RESTRICTED;
        const isRestricted = (skillLev === 0 && maxSkillLev === 0);
        // Direct Binding では練習経験値 (P_ADVANCE) が未取得のため、未練習スキルを誤って向上可能とみなさないよう安全に false とする
        const canEnhance = false;

        skills.push({
            id: i,
            name: def.name,
            nameJa: def.nameJa,
            nameRaw: def.name,
            skillLevel: skillLev,
            maxSkillLevel: maxSkillLev,
            rank,
            maxRank,
            isRestricted,
            canEnhance,
            weaponSlots
        });
    }
    return skills;
}

export function parseSpellBookBuffer(raw, countLimit = null) {
    if (!raw || (!Array.isArray(raw) && !(raw instanceof Int32Array))) return [];
    const spells = [];
    // NetHack 5.0 の MAXSPELL は最大 52 エントリ。それ以上のインデックスはバッファの未初期化領域または範囲外
    const MAX_SPELL_ENTRIES = 52;
    // countLimit が正の数の場合のみ件数上限として扱い、0 や null（Cコアの戻り値 0: 成功）の場合は MAX_SPELL_ENTRIES まで走査
    const maxEntries = (typeof countLimit === 'number' && countLimit > 0)
        ? Math.min(countLimit, MAX_SPELL_ENTRIES)
        : MAX_SPELL_ENTRIES;

    for (let i = 0; i < maxEntries; i++) {
        const base = i * 3;
        const sp_id = raw[base + 0];
        const sp_lev = raw[base + 1];
        const sp_know = raw[base + 2];
        // NetHack 仕様: spl_book[] は先頭から連続して格納され、最初の NO_SPELL (0) で配列が終端する
        if (!sp_id || sp_id <= 0) break;

        const letter = (i < 26) ? String.fromCharCode(97 + i) : String.fromCharCode(65 + i - 26);
        spells.push({
            index: i,
            letter,
            id: sp_id,
            onum: sp_id,
            level: sp_lev,
            retention: sp_know,
            isForgotten: sp_know <= 0
        });
    }
    return spells;
}

/**
 * NetHack 5.0 公式ロール一覧 (roles[] のインデックス 0〜12)
 */
export const PLAYER_ROLES = [
    'archeologist',
    'barbarian',
    'caveman',
    'healer',
    'knight',
    'monk',
    'priest',
    'rogue',
    'ranger',
    'samurai',
    'tourist',
    'valkyrie',
    'wizard'
];

/**
 * NetHack 5.0 公式種族一覧 (races[] のインデックス 0〜4)
 */
export const PLAYER_RACES = [
    'human',
    'elf',
    'dwarf',
    'gnome',
    'orc'
];

/**
 * NetHack 属性 (u.ualign.type) マッピング
 */
export const ALIGNMENT_TYPES = {
    [-1]: 'chaotic',
    [0]: 'neutral',
    [1]: 'lawful'
};

export const ALIGNMENT_NAMES_JA = {
    chaotic: '混沌',
    neutral: '中立',
    lawful: '秩序'
};

export const ALIGNMENT_NAMES_EN = {
    chaotic: 'Chaotic',
    neutral: 'Neutral',
    lawful: 'Lawful'
};

/**
 * NetHack 性別 (flags.female) マッピング
 */
export const GENDER_TYPES = {
    [0]: 'male',
    [1]: 'female'
};

/**
 * Int32Array バッファ中の単語列から NULL 終端 ASCII 文字列を復元する
 * @param {Array<number>|Int32Array} raw 
 * @param {number} startWordIndex 
 * @param {number} [maxWords=16] 
 * @returns {string}
 */
export function decodeStringFromInt32Array(raw, startWordIndex, maxWords = 16) {
    if (!raw || raw.length <= startWordIndex) return '';
    const bytes = [];
    for (let i = 0; i < maxWords; i++) {
        const wIdx = startWordIndex + i;
        if (wIdx >= raw.length) break;
        const word = raw[wIdx];
        const b0 = word & 0xFF;
        const b1 = (word >> 8) & 0xFF;
        const b2 = (word >> 16) & 0xFF;
        const b3 = (word >> 24) & 0xFF;
        if (b0 === 0) break;
        bytes.push(b0);
        if (b1 === 0) break;
        bytes.push(b1);
        if (b2 === 0) break;
        bytes.push(b2);
        if (b3 === 0) break;
        bytes.push(b3);
    }
    if (bytes.length === 0) return '';
    try {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(new Uint8Array(bytes)).trim();
        }
    } catch (_) {}
    return String.fromCharCode(...bytes).trim();
}

/**
 * SHIM_CMD_GET_PLAYER_PROFILE (0x33) バッファからプレイヤー真値プロファイルをデコード (純粋関数)
 * @param {Array<number>|Int32Array} raw - 最低 8 要素の int32 配列
 * @param {string|null} [roleNameStr=null] - Live Memory 等から直接読んだロール文字列 (任意)
 * @param {string|null} [raceNameStr=null] - Live Memory 等から直接読んだ種族文字列 (任意)
 * @param {string|null} [playerNameStr=null] - Live Memory 等から直接読んだ名前文字列 (任意)
 * @returns {Object|null}
 */
export function parsePlayerProfileBuffer(raw, roleNameStr = null, raceNameStr = null, playerNameStr = null) {
    if (!raw || (!Array.isArray(raw) && !(raw instanceof Int32Array)) || raw.length < 8) {
        return null;
    }

    const roleIndex = raw[0];
    const raceIndex = raw[1];
    const genderIndex = raw[2];
    const alignType = raw[3];
    const roleMnum = raw[4];
    const raceMnum = raw[5];
    const level = raw[6] > 0 ? raw[6] : 1;
    const initGend = raw[7];
    const alignRecord = raw.length > 8 ? raw[8] : 0;

    // バッファ後半 (offset 64=word 16, offset 128=word 32, offset 192=word 48) から文字列を抽出 (引数未指定時)
    const roleName = (roleNameStr && roleNameStr.length > 0)
        ? roleNameStr
        : (raw.length >= 32 ? decodeStringFromInt32Array(raw, 16, 16) : '');
    const raceName = (raceNameStr && raceNameStr.length > 0)
        ? raceNameStr
        : (raw.length >= 48 ? decodeStringFromInt32Array(raw, 32, 16) : '');
    const playerName = (playerNameStr && playerNameStr.length > 0)
        ? playerNameStr
        : (raw.length >= 64 ? decodeStringFromInt32Array(raw, 48, 16) : '');

    const roleKey = (roleIndex >= 0 && roleIndex < PLAYER_ROLES.length)
        ? PLAYER_ROLES[roleIndex]
        : (roleName ? roleName.toLowerCase() : 'unknown');

    const raceKey = (raceIndex >= 0 && raceIndex < PLAYER_RACES.length)
        ? PLAYER_RACES[raceIndex]
        : (raceName ? raceName.toLowerCase() : 'unknown');

    const gender = GENDER_TYPES[genderIndex] || (genderIndex === 1 ? 'female' : 'male');
    const alignment = ALIGNMENT_TYPES[alignType] || (alignType === 1 ? 'lawful' : (alignType === -1 ? 'chaotic' : 'neutral'));

    return {
        roleIndex,
        raceIndex,
        genderIndex,
        alignType,
        roleMnum,
        raceMnum,
        level,
        initGend,
        alignRecord,
        role: roleKey,
        race: raceKey,
        gender,
        alignment,
        roleName: roleName || roleKey,
        raceName: raceName || raceKey,
        playerName: playerName || ''
    };
}
