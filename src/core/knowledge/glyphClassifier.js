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
    // glyph 3985: doorway (cmap 12)
    // glyph 3986, 3987: open door (cmap 13, 14)
    // glyph 3988, 3989: closed door (cmap 15, 16)
    // glyph 3998: staircase up (cmap 25)
    // glyph 3999: staircase down (cmap 26)
    // glyph 4006..4010: altar (cmap 33)
    // glyph 4013: sink (cmap 36)
    // glyph 4014: fountain (cmap 37)

    const isOpenDoor = (glyphId === 3986 || glyphId === 3987);
    const isClosedDoor = (glyphId === 3988 || glyphId === 3989);
    const isStairUp = (glyphId === 3998 || glyphId === 4000 || glyphId === 4002);
    const isStairDown = (glyphId === 3999 || glyphId === 4001 || glyphId === 4003);
    const isAltar = (glyphId >= 4006 && glyphId <= 4010);
    const isSink = (glyphId === 4013);
    const isFountain = (glyphId === 4014);

    return {
        isOpenDoor,
        isClosedDoor,
        isDoor: isOpenDoor || isClosedDoor,
        isStairUp,
        isStairDown,
        isAltar,
        isSink,
        isFountain
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
        return { type: ENTITY_TYPES.ITEM, isPile: true, rawGlyph: glyphId };
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
        return {
            type: ENTITY_TYPES.ITEM,
            subType: objOffset,
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
        return { type: ENTITY_TYPES.MONSTER, isPile: false, rawGlyph: glyphId };
    }

    return { type: ENTITY_TYPES.UNKNOWN, isPile: false, rawGlyph: glyphId };
}
