/**
 * tileMapping.js
 * NetHack 5.0 Tile / Glyph マッピングへの標準アクセスモジュール
 */
(function (global) {
    function getTileMappingFunction() {
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

    function getTileMapping(glyphId, offsets) {
        const fn = getTileMappingFunction();
        if (fn) {
            const table = fn(offsets);
            if (table && table[glyphId] !== undefined) {
                return table[glyphId];
            }
        }
        return glyphId;
    }

    const tileMappingModule = {
        getTileMappingFunction,
        getTileMapping
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
        module.exports.default = tileMappingModule;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
