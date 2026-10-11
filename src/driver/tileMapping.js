/**
 * tileMapping.js
 * NetHack 5.0 Tile / Glyph マッピングへの標準アクセスモジュール
 */

export function getTileMappingFunction() {
    if (typeof window !== 'undefined' && typeof window.tileMapping === 'function') {
        return window.tileMapping;
    }
    if (typeof globalThis !== 'undefined' && typeof globalThis.tileMapping === 'function') {
        return globalThis.tileMapping;
    }
    if (typeof global !== 'undefined' && typeof global.tileMapping === 'function') {
        return global.tileMapping;
    }
    return null;
}

let rawTileMappingFn = null;
let baseTable = null;
let cachedTable = null;
let activeDescrIndexes = null;

const GLYPH_OBJ_OFF = 3448;
const GLYPH_CMAP_OFF = 3929;
const GLYPH_OBJ_PILETOP_OFF = 7992;
const GLYPH_BODY_PILETOP_OFF = 8473;
const NUM_OBJECTS = 481;

function applyDescrIndexesToCachedTable() {
    if (!baseTable || !cachedTable) return;
    for (let onum = 0; onum < NUM_OBJECTS; onum++) {
        const appOnum = (activeDescrIndexes && typeof activeDescrIndexes[onum] === 'number' && activeDescrIndexes[onum] >= 0 && activeDescrIndexes[onum] < NUM_OBJECTS)
            ? activeDescrIndexes[onum]
            : onum;

        const objGlyph = GLYPH_OBJ_OFF + onum;
        const targetObjGlyph = GLYPH_OBJ_OFF + appOnum;
        if (baseTable[targetObjGlyph] !== undefined) {
            cachedTable[objGlyph] = baseTable[targetObjGlyph];
        }

        const pileGlyph = GLYPH_OBJ_PILETOP_OFF + onum;
        const targetPileGlyph = GLYPH_OBJ_PILETOP_OFF + appOnum;
        if (baseTable[targetPileGlyph] !== undefined) {
            cachedTable[pileGlyph] = baseTable[targetPileGlyph];
        }
    }
}

function ensureShuffledTable(offsets) {
    const currentGlobalFn =
        (typeof window !== 'undefined' && typeof window.tileMapping === 'function' && window.tileMapping) ||
        (typeof globalThis !== 'undefined' && typeof globalThis.tileMapping === 'function' && globalThis.tileMapping) ||
        (typeof global !== 'undefined' && typeof global.tileMapping === 'function' && global.tileMapping) ||
        null;

    if (currentGlobalFn && !currentGlobalFn.__isShuffledWrapper) {
        rawTileMappingFn = currentGlobalFn;
        baseTable = rawTileMappingFn(offsets);
        cachedTable = Object.assign({}, baseTable);
        applyDescrIndexesToCachedTable();

        const wrappedFn = function shuffledTileMapping(off) {
            if (!cachedTable && rawTileMappingFn) {
                baseTable = rawTileMappingFn(off);
                cachedTable = Object.assign({}, baseTable);
                applyDescrIndexesToCachedTable();
            }
            return cachedTable;
        };
        wrappedFn.__isShuffledWrapper = true;

        if (typeof window !== 'undefined' && typeof window.tileMapping === 'function') {
            window.tileMapping = wrappedFn;
        }
        if (typeof globalThis !== 'undefined' && typeof globalThis.tileMapping === 'function') {
            globalThis.tileMapping = wrappedFn;
        }
        if (typeof global !== 'undefined' && typeof global.tileMapping === 'function') {
            global.tileMapping = wrappedFn;
        }
    } else if (!cachedTable && rawTileMappingFn) {
        baseTable = rawTileMappingFn(offsets);
        cachedTable = Object.assign({}, baseTable);
        applyDescrIndexesToCachedTable();
    }

    return cachedTable;
}

/**
 * NetHack Cコアの shuffle_tiles() (o_init.c) と同等に、
 * シャッフルされた外見インデックス (oc_descr_idx) をタイルマッピングへ反映する
 * @param {Int32Array|Array<number>|null} descrIndexes
 */
export function setDescrIndexesForTileMapping(descrIndexes) {
    activeDescrIndexes = descrIndexes || null;
    ensureShuffledTable();
    applyDescrIndexesToCachedTable();
}

export function getTileMapping(glyphId, offsets) {
    const table = ensureShuffledTable(offsets);

    if (table && table[glyphId] !== undefined) {
        return table[glyphId];
    }

    let targetGlyphId = glyphId;
    if (activeDescrIndexes && typeof glyphId === 'number') {
        if (glyphId >= GLYPH_OBJ_OFF && glyphId < GLYPH_CMAP_OFF) {
            const onum = glyphId - GLYPH_OBJ_OFF;
            const appOnum = activeDescrIndexes[onum];
            if (typeof appOnum === 'number' && appOnum >= 0 && appOnum < NUM_OBJECTS) {
                targetGlyphId = GLYPH_OBJ_OFF + appOnum;
            }
        } else if (glyphId >= GLYPH_OBJ_PILETOP_OFF && glyphId < GLYPH_BODY_PILETOP_OFF) {
            const onum = glyphId - GLYPH_OBJ_PILETOP_OFF;
            const appOnum = activeDescrIndexes[onum];
            if (typeof appOnum === 'number' && appOnum >= 0 && appOnum < NUM_OBJECTS) {
                targetGlyphId = GLYPH_OBJ_PILETOP_OFF + appOnum;
            }
        }
    }

    return targetGlyphId;
}

const tileMappingModule = {
    getTileMappingFunction,
    getTileMapping,
    setDescrIndexesForTileMapping
};

if (typeof globalThis !== 'undefined') {
    globalThis.NetHackTileMapping = tileMappingModule;
}
if (typeof window !== 'undefined') {
    window.NetHackTileMapping = tileMappingModule;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = tileMappingModule;
    module.exports.getTileMappingFunction = getTileMappingFunction;
    module.exports.getTileMapping = getTileMapping;
    module.exports.setDescrIndexesForTileMapping = setDescrIndexesForTileMapping;
    module.exports.default = tileMappingModule;
}

export default tileMappingModule;
