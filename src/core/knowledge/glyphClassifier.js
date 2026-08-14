/**
 * glyphClassifier.js
 * NetHack 5.0 (3.7) Glyph ID をセマンティックカテゴリに分類する純粋ユーティリティ
 */

export const GLYPH_OFFSETS = {
    GLYPH_MON_OFF: 0,
    GLYPH_MON_FEM_OFF: 383,
    GLYPH_PET_OFF: 766,
    GLYPH_PET_FEM_OFF: 1149,
    GLYPH_INVIS_OFF: 1532,
    GLYPH_DETECT_OFF: 1533,
    GLYPH_DETECT_FEM_OFF: 1916,
    GLYPH_BODY_OFF: 2299,
    GLYPH_RIDDEN_OFF: 2682,
    GLYPH_RIDDEN_FEM_OFF: 3065,
    GLYPH_OBJ_OFF: 3448,
    GLYPH_CMAP_OFF: 3929,
    GLYPH_ZAP_OFF: 4051,
    GLYPH_SWALLOW_OFF: 4093,
    GLYPH_EXPLODE_OFF: 7157,
    GLYPH_WARNING_OFF: 7220,
    GLYPH_STATUE_OFF: 7226,
    GLYPH_OBJ_PILETOP_OFF: 7992,
    GLYPH_BODY_PILETOP_OFF: 8473,
    GLYPH_STATUE_PILETOP_OFF: 8856,
    GLYPH_UNEXPLORED_OFF: 9622
};

export const ENTITY_TYPES = {
    MONSTER: 'MONSTER',
    PET: 'PET',
    BODY: 'BODY',
    ITEM: 'ITEM',
    TERRAIN: 'TERRAIN',
    STATUE: 'STATUE',
    EFFECT: 'EFFECT',
    UNEXPLORED: 'UNEXPLORED',
    UNKNOWN: 'UNKNOWN'
};

/**
 * CMAP (地形) のサブタイプ・セマンティック判定
 * @param {number} glyphId 
 * @returns {Object} CMAP 特性フラグ
 */
export function getCmapInfo(glyphId) {
    const isWall = (glyphId >= 3929 && glyphId <= 3984);
    const isDoorway = (glyphId === 3985);
    const isOpenDoor = (glyphId === 3986 || glyphId === 3987);
    const isClosedDoor = (glyphId === 3988 || glyphId === 3989);
    const isIronBars = (glyphId === 3990);
    const isTree = (glyphId === 3991);
    const isFloor = (glyphId === 3992 || glyphId === 3993 || glyphId === 3995 || glyphId === 3996);
    const isEngraving = (glyphId === 3994 || glyphId === 3997);
    const isStairUp = (glyphId === 3998 || glyphId === 4000 || glyphId === 4002 || glyphId === 4004);
    const isStairDown = (glyphId === 3999 || glyphId === 4001 || glyphId === 4003 || glyphId === 4005);
    const isAltar = (glyphId >= 4006 && glyphId <= 4010);
    const isGrave = (glyphId === 4011);
    const isThrone = (glyphId === 4012);
    const isSink = (glyphId === 4013);
    const isFountain = (glyphId === 4014);
    const isWater = (glyphId === 4015 || glyphId === 4025);
    const isIce = (glyphId === 4016);
    const isLava = (glyphId === 4017 || glyphId === 4018);
    const isDrawbridge = (glyphId >= 4019 && glyphId <= 4022);
    const isTrap = (glyphId >= 4026 && glyphId <= 4048);
    const isTrappedDoor = (glyphId === 4049);
    const isTrappedChest = (glyphId === 4050);

    return {
        isWall,
        isDoorway,
        isOpenDoor,
        isClosedDoor,
        isDoor: isOpenDoor || isClosedDoor,
        isIronBars,
        isTree,
        isFloor,
        isEngraving,
        isStairUp,
        isStairDown,
        isAltar,
        isGrave,
        isThrone,
        isSink,
        isFountain,
        isWater,
        isIce,
        isLava,
        isDrawbridge,
        isTrap,
        isTrappedDoor,
        isTrappedChest
    };
}

/**
 * Glyph ID の数値からエンティティの型および詳細情報を判定
 * @param {number} glyphId - NetHack glyph ID
 * @returns {Object} 分類結果オブジェクト
 */
export function classifyGlyph(glyphId) {
    if (glyphId === undefined || glyphId === null || glyphId < 0) {
        return { type: ENTITY_TYPES.UNKNOWN, isPile: false, rawGlyph: glyphId };
    }

    // 9622: 未探索
    if (glyphId >= GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF) {
        return { type: ENTITY_TYPES.UNEXPLORED, isPile: false, rawGlyph: glyphId };
    }

    // 7992〜9621: Piletop (山積みアイテム / 山積み死体 / 山積み像)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF) {
        if (glyphId >= GLYPH_OFFSETS.GLYPH_STATUE_PILETOP_OFF) {
            return { type: ENTITY_TYPES.STATUE, isPile: true, rawGlyph: glyphId };
        }
        if (glyphId >= GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF) {
            return { type: ENTITY_TYPES.BODY, isPile: true, rawGlyph: glyphId };
        }
        const objOffset = glyphId - GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF;
        const isContainer = (objOffset >= 214 && objOffset <= 220);
        return { type: ENTITY_TYPES.ITEM, subType: objOffset, isContainer, isPile: true, rawGlyph: glyphId };
    }

    // 7226〜7991: Statue (像)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_STATUE_OFF) {
        return { type: ENTITY_TYPES.STATUE, isPile: false, rawGlyph: glyphId };
    }

    // 4051〜7225: Effects (ビーム、爆発、警告など)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_ZAP_OFF) {
        return { type: ENTITY_TYPES.EFFECT, isPile: false, rawGlyph: glyphId };
    }

    // 3929〜4050: CMAP (ダンジョン地形: 壁、床、扉、階段、罠、噴水、祭壇等)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_CMAP_OFF) {
        const cmapOffset = glyphId - GLYPH_OFFSETS.GLYPH_CMAP_OFF;
        const cmapFlags = getCmapInfo(glyphId);
        return {
            type: ENTITY_TYPES.TERRAIN,
            subType: cmapOffset,
            cmapFlags,
            isPile: false,
            rawGlyph: glyphId
        };
    }

    // 3448〜3928: Objects (アイテム)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_OBJ_OFF) {
        const objOffset = glyphId - GLYPH_OFFSETS.GLYPH_OBJ_OFF;
        const isContainer = (objOffset >= 214 && objOffset <= 220);
        return {
            type: ENTITY_TYPES.ITEM,
            subType: objOffset,
            isContainer,
            isPile: false,
            rawGlyph: glyphId
        };
    }

    // 2299〜3447: Body / Corpse (死体)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_BODY_OFF) {
        return { type: ENTITY_TYPES.BODY, isPile: false, rawGlyph: glyphId };
    }

    // 766〜1531: Pet (ペット・友好モンスター)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_PET_OFF && glyphId < GLYPH_OFFSETS.GLYPH_INVIS_OFF) {
        return { type: ENTITY_TYPES.PET, isPile: false, rawGlyph: glyphId };
    }

    // 0〜2298: Monster (一般モンスター・透明モンスター・検出モンスター等)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_MON_OFF) {
        const monOffset = glyphId % 383;
        const isShopkeeper = (monOffset === 267 || monOffset === 268); // NetHack 3.7 shopkeeper glyph offset
        return { type: ENTITY_TYPES.MONSTER, subType: monOffset, isShopkeeper, isPile: false, rawGlyph: glyphId };
    }

    return { type: ENTITY_TYPES.UNKNOWN, isPile: false, rawGlyph: glyphId };
}

/**
 * モンスター/NPC が店主 (Shopkeeper) かどうかを判定
 * @param {Object} entity 
 * @returns {boolean}
 */
export function isShopkeeperMonster(entity) {
    if (!entity) return false;
    if (entity.isShopkeeper) return true;
    const glyphId = typeof entity.glyph === 'number' ? entity.glyph : (entity.glyphInfo ? entity.glyphInfo.glyph : -1);
    if (glyphId >= 0) {
        const info = classifyGlyph(glyphId);
        if (info.isShopkeeper) return true;
    }
    const name = entity.name || entity.str || '';
    return /\b(shopkeeper|店主)\b/i.test(name);
}

/**
 * Glyph ID から NetHack オブジェクト番号 (onum: 0〜480) を算出
 * @param {number} glyphId 
 * @returns {number} onum (該当しない場合は -1)
 */
export function getOnumFromGlyph(glyphId) {
    if (typeof glyphId !== 'number' || glyphId < 0) return -1;

    // 3448〜3928: 通常アイテム (GLYPH_OBJ_OFF = 3448)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_OBJ_OFF && glyphId < GLYPH_OFFSETS.GLYPH_CMAP_OFF) {
        return glyphId - GLYPH_OFFSETS.GLYPH_OBJ_OFF;
    }

    // 7992〜8472: 山積みアイテム (GLYPH_OBJ_PILETOP_OFF = 7992)
    if (glyphId >= GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF && glyphId < GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF) {
        return glyphId - GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF;
    }

    return -1;
}

/**
 * NetHack オブジェクト番号 (onum: 0〜480) からカテゴリおよび個別特性を判定
 * @param {number} onum 
 * @returns {Object} { category, isPickAxe, isKey, isAxe, isDigWand, isFrostWand, isContainer }
 */
export function getItemInfoFromOnum(onum) {
    if (typeof onum !== 'number' || onum < 0) {
        return { category: 'OTHER', isPickAxe: false, isKey: false, isAxe: false, isDigWand: false, isFrostWand: false, isContainer: false, isBox: false, isBag: false, isTouchstone: false, isCanOpener: false, isTin: false, isGem: false, isRock: false, isAmmo: false, isLauncher: false };
    }

    let category = 'OTHER';
    if (onum === 2 || (onum >= 18 && onum <= 99)) {
        category = 'WEAPON';
    } else if (onum === 3 || (onum >= 100 && onum <= 176)) {
        category = 'ARMOR';
    } else if (onum === 4 || (onum >= 177 && onum <= 200)) {
        category = 'RING';
    } else if (onum === 5 || (onum >= 201 && onum <= 213)) {
        category = 'AMULET';
    } else if (onum === 6 || (onum >= 214 && onum <= 263)) {
        category = 'TOOL';
    } else if (onum === 7 || (onum >= 264 && onum <= 296)) {
        category = 'FOOD';
    } else if (onum === 8 || (onum >= 297 && onum <= 322)) {
        category = 'POTION';
    } else if (onum === 9 || (onum >= 323 && onum <= 365)) {
        category = 'SCROLL';
    } else if (onum === 10 || (onum >= 366 && onum <= 409)) {
        category = 'SPELLBOOK';
    } else if (onum === 11 || (onum >= 410 && onum <= 437)) {
        category = 'WAND';
    } else if (onum === 12 || onum === 438) {
        category = 'COIN';
    } else if (onum === 13 || (onum >= 439 && onum <= 469)) {
        category = 'GEM';
    }

    const isPickAxe = (onum === 259 || onum === 33); // pick-axe (259), dwarvish mattock (33)
    const isKey = (onum >= 221 && onum <= 223) || onum === 263; // skeleton key (221), lock pick (222), credit card (223), Bell of Opening (263)
    const isAxe = (onum === 44 || onum === 45); // axe (44), battle-axe (45)
    const isDigWand = (onum === 428); // wand of digging (428)
    const isFrostWand = (onum === 431); // wand of cold / frost (431)
    const isContainer = (onum >= 214 && onum <= 220); // large box, chest, ice box, sack, oilskin sack, bag of holding, bag of tricks (214-220)

    // docs/5_gamedata/tilemappings.lst 準拠の正確な onum マッピング
    const isBox = (onum >= 214 && onum <= 216); // large box (214), chest (215), ice box (216)
    const isBag = (onum >= 217 && onum <= 220); // sack (217), oilskin sack (218), bag of holding (219), bag of tricks (220)
    const isCanOpener = (onum === 239); // tin opener (239) [tilemappings.lst line 3763]
    const isTouchstone = (onum === 472); // touchstone (472) [tilemappings.lst line 3996]
    const isTin = (onum === 296); // tin (296) [tilemappings.lst line 3820]
    const isGem = (onum >= 439 && onum <= 469); // gems & glasses (439-469)
    const isRock = (onum === 473 || onum === 474); // flint (473), rock (474)

    // 弾薬・投擲物 (Ammunition / Missile): arrow (18-22), bolt (23), dart (24), shuriken (25), boomerang (26), javelin (32), flint (473), rock (474)
    const isAmmo = (onum >= 18 && onum <= 26) || onum === 32 || onum === 473 || onum === 474;

    // 射撃武器本体 (Launcher): bows (83-86), sling (87), crossbow (88)
    const isLauncher = (onum >= 83 && onum <= 88);

    return {
        category,
        isPickAxe,
        isKey,
        isAxe,
        isDigWand,
        isFrostWand,
        isContainer,
        isBox,
        isBag,
        isTouchstone,
        isCanOpener,
        isTin,
        isGem,
        isRock,
        isAmmo,
        isLauncher
    };
}




