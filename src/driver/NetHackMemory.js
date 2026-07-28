/**
 * NetHackMemory.js
 * 
 * Emscripten メモリとの低レイヤー相互変換・型解釈・C構造体 (glyph_info) デコーダ
 */

class NetHackMemory {
    /**
     * @param {Object} [wasmModule] - Emscripten の Module オブジェクト（省略時は window.Module）
     */
    constructor(wasmModule = null) {
        this._module = wasmModule;
    }

    /**
     * 現在有効な Module オブジェクトを取得
     * @returns {Object|null}
     */
    get module() {
        if (this._module) return this._module;
        if (typeof window !== 'undefined' && window.Module) return window.Module;
        if (typeof globalThis !== 'undefined' && globalThis.Module) return globalThis.Module;
        return null;
    }

    /**
     * Module オブジェクトをセット
     * @param {Object} mod
     */
    set module(mod) {
        this._module = mod;
    }

    /**
     * C/Wasm メモリから指定型の値を取得
     * 
     * @param {string} name - デバッグ・ログ用識別名
     * @param {number} ptr - メモリアドレス
     * @param {string} type - 型指定子 ('v', 'i', 's', 'b', 'c', '0', '1', 'p' など)
     * @returns {any}
     */
    getPointerValue(name, ptr, type) {
        const mod = this.module;
        if (!mod) throw new Error("NetHackMemory: Module is not initialized");

        if (type === 'v') return null;
        if (type === 'i') return mod.getValue(ptr, 'i32');
        if (type === 's') return mod.UTF8ToString(ptr);
        if (type === 'b') return !!mod.getValue(ptr, 'i8');
        if (type === 'c' || type === '0') return String.fromCharCode(mod.getValue(ptr, 'i8'));
        if (type === '1') return mod.getValue(ptr, 'i16'); // coordxy
        if (type === 'p') return ptr;
        return ptr;
    }

    /**
     * C/Wasm メモリへ指定型の値を書き込み
     * 
     * @param {string} name - デバッグ・ログ用識別名
     * @param {number} ret_ptr - 書き込み先ポインタ
     * @param {string} type - 型指定子 ('i', 'b', 'c', '1', '2', 's', 'p')
     * @param {any} value - 書き込む値
     */
    setPointerValue(name, ret_ptr, type, value) {
        const mod = this.module;
        if (!mod) throw new Error("NetHackMemory: Module is not initialized");
        if (!ret_ptr) return;

        if (type === 'i') {
            mod.setValue(ret_ptr, value, 'i32');
        } else if (type === 'b') {
            mod.setValue(ret_ptr, value ? 1 : 0, 'i8');
        } else if (type === 'c') {
            mod.setValue(ret_ptr, typeof value === 'string' ? value.charCodeAt(0) : value, 'i8');
        } else if (type === '1' || type === '2') {
            mod.setValue(ret_ptr, value, 'i16');
        } else if (type === 's') {
            if (value === null || value === undefined) {
                mod.setValue(ret_ptr, 0, 'i32');
            } else if (typeof value === 'string') {
                let ptr = mod._malloc(value.length + 1);
                mod.stringToUTF8(value, ptr, value.length + 1);
                mod.setValue(ret_ptr, ptr, 'i32');
            } else {
                throw new TypeError("expected " + name + " return type to be string, got " + (typeof value));
            }
        } else if (type === 'p') {
            mod.setValue(ret_ptr, value, 'i32');
        }
    }

    /**
     * C言語側の glyph_info 構造体メモリから属性情報をデコード
     * 
     * @param {number} ptr - glyph_info 構造体へのポインタ
     * @returns {Object|null} { glyph, symbol, framecolor, flags, color, symidx, ch }
     */
    parseGlyphInfo(ptr) {
        const mod = this.module;
        if (!mod || !ptr) return null;

        // NetHack 3.7 glyph_info structure offsets
        const GLYPH_OFFSET = 0;
        const TTYCHAR_OFFSET = 4;
        const FRAMECOLOR_OFFSET = 8;
        const GM_OFFSET = 12; // glyph_map starts here

        const GM_FLAGS_OFFSET = GM_OFFSET + 0;
        const GM_COLOR_OFFSET = GM_OFFSET + 4;
        const GM_SYMIDX_OFFSET = GM_OFFSET + 8;
        const GM_U_OFFSET = GM_OFFSET + 20; // pointer to unicode_representation

        let glyph = mod.getValue(ptr + GLYPH_OFFSET, 'i32');
        let symbol = mod.getValue(ptr + TTYCHAR_OFFSET, 'i32');
        let framecolor = mod.getValue(ptr + FRAMECOLOR_OFFSET, 'i32');

        let flags = mod.getValue(ptr + GM_FLAGS_OFFSET, 'i32');
        let color = mod.getValue(ptr + GM_COLOR_OFFSET, 'i32');
        let symidx = mod.getValue(ptr + GM_SYMIDX_OFFSET, 'i32');

        let ch = String.fromCharCode(symbol);
        let uPtr = mod.getValue(ptr + GM_U_OFFSET, 'i32');
        if (uPtr) {
            let utf8strPtr = mod.getValue(uPtr + 4, 'i32'); // offset of utf8str in unicode_representation
            if (utf8strPtr) {
                ch = mod.UTF8ToString(utf8strPtr);
            }
        }

        return { glyph, symbol, framecolor, flags, color, symidx, ch };
    }

    /**
     * window.nethackGlobal.helpers に対する Sticky Getter パッチを適用し、
     * C/Wasm 側の内部 js_helpers_init による上書きを防御・バインドする
     * 
     * @param {Object} [targetWindow] - 適用対象グローバルオブジェクト
     */
    patchNethackHelpers(targetWindow = null) {
        const globalTarget = targetWindow || (typeof window !== 'undefined' ? window : globalThis);
        if (!globalTarget) return;

        globalTarget.nethackGlobal = globalTarget.nethackGlobal || {};
        globalTarget.nethackGlobal.helpers = globalTarget.nethackGlobal.helpers || {};

        const helpers = globalTarget.nethackGlobal.helpers;
        const self = this;

        const makeSticky = (name, fn) => {
            Object.defineProperty(helpers, name, {
                get: function () { return fn; },
                set: function (val) {
                    // Block overwrite attempts
                },
                configurable: true,
                enumerable: true
            });
        };

        makeSticky('getPointerValue', function (name, ptr, type) {
            return self.getPointerValue(name, ptr, type);
        });

        makeSticky('setPointerValue', function (name, ret_ptr, type, value) {
            return self.setPointerValue(name, ret_ptr, type, value);
        });

        makeSticky('parseGlyphInfo', function (ptr) {
            return self.parseGlyphInfo(ptr);
        });

        helpers.isPatched = true;
    }
}

// Module export / Universal support
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetHackMemory;
}
if (typeof window !== 'undefined') {
    window.NetHackMemory = NetHackMemory;
}
