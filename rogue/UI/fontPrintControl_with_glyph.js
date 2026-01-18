/**
 * fontPrintControl_with_glyph
 * Mixed Font and Glyph Rendering Control
 * 
 * @description
 * 既存の fontPrintControl を拡張し、特定の文字コード範囲をグリフ（タイル）として描画する機能を追加したクラスです。
 * - code < 256: ASCII (Font)
 * - 256 <= code < 12000: Glyphs (Tile)
 * - FF60 <= code <= FF9F: Half-width Katakana (Font)
 * - code >= 12352: Kanji (Font)
 */
class fontPrintControl_with_glyph {
    /**
     * @param {GameCore} g GameCore instance
     * @param {Img} asciiPtn ASCII Font Image
     * @param {number} aw ASCII Font width
     * @param {number} ah ASCII Font height
     * @param {Img} KanjiPtn KANJI Font Image
     * @param {number} kw KANJI Font width
     * @param {number} kh KANJI Font height
     * @param {Img} tilePtn Tile Set Image
     * @param {number} tw Tile width
     * @param {number} th Tile height
     * @param {object} mappingTable glyphId to tileIndex mapping
     */
    constructor(g, asciiPtn, aw, ah, KanjiPtn, kw, kh, tilePtn, tw, th, mappingTable) {

        let buffer_ = g.screen[0].buffer;
        const tilesPerRow = 40;

        this.useScreen = function (num) {
            buffer_ = g.screen[num].buffer;
        };

        let UTFconv = [];
        // Global utfmap function provided by utfmap.js
        if (typeof utfmap === 'function') {
            const map = utfmap();
            for (let i in map) {
                for (let j in map[i]) {
                    if (map[i][j] != 0) {
                        UTFconv[map[i][j]] = { x: j, y: i };
                    }
                }
            }
        }

        /**
         * 文字コードに対応する位置情報を計算します。
         * @param {number} code Character or Glyph Code
         */
        function charCodeToLoc(code) {
            let res = { img: asciiPtn, x: 0, y: 0, w: aw, h: ah, type: 0 }; // Default ASCII

            // 1. ASCII (0-255)
            if (code < 256) {
                res.x = Math.floor(code % 16) * aw;
                res.y = Math.floor(code / 16) * ah;
                res.w = aw;
                res.h = ah;
                res.img = asciiPtn;
                res.type = 0;
                return res;
            }

            // 2. Glyphs (256-11999)
            if (code >= 256 && code < 12000) {
                const glyphId = code;
                const tileIndex = mappingTable ? (mappingTable[glyphId] || 0) : 0;
                res.x = (tileIndex % tilesPerRow) * tw;
                res.y = Math.floor(tileIndex / tilesPerRow) * th;
                res.w = tw;
                res.h = th;
                res.img = tilePtn;
                res.type = 3;
                return res;
            }

            // 3. Half-width Katakana (FF60-FF9F)
            if (code >= 0xFF60 && code <= 0xFF9F) {
                let wn = code - 0xFF60;
                res.x = Math.floor(wn % 16) * aw;
                res.y = Math.floor(wn / 16) * ah + (ah * 10);
                res.w = aw;
                res.h = ah;
                res.img = asciiPtn;
                res.type = 1;
                return res;
            }

            // 4. Kanji (UTFconv mapping exists)
            if (UTFconv[code] !== undefined) {
                res.x = UTFconv[code].x * kw;
                res.y = UTFconv[code].y * kh;
                res.w = kw;
                res.h = kh;
                res.img = KanjiPtn;
                res.type = 2;
                return res;
            }

            return res;
        }

        this.print = function (str, x, y) {
            for (let i = 0, loopend = str.length; i < loopend; i++) {
                let n = str.charCodeAt(i);
                let d = charCodeToLoc(n);

                // Glyphs might have different height than fonts
                // Adjusting to baseline if necessary
                let drawY = y;
                if (d.type === 3) {
                    // Example: if glyph is 32px and font is 12px, adjust Y to align bottom
                    // drawY = y - (d.h - ah); 
                }

                buffer_.drawImgXYWHXYWH(
                    d.img,
                    d.x, d.y, d.w, d.h,
                    Math.floor(x), Math.floor(drawY), d.w, d.h
                );
                x = x + d.w;
            }
        };

        this.putchr = function (str, x, y, z) {
            const scale = z || 1.0;
            for (let i = 0, loopend = str.length; i < loopend; i++) {
                let n = str.charCodeAt(i);
                let d = charCodeToLoc(n);

                // フォント（type 0, 1, 2）の場合は、オリジナルの fontPrintControl に合わせ
                // ソース範囲を 1px 削ることで境界のぼやけを防ぐ
                let sw = d.w;
                let sh = d.h;
                if (d.type < 3) {
                    sw = sw - 1;
                    sh = sh - 1;
                }

                buffer_.drawImgXYWHXYWH(
                    d.img,
                    d.x, d.y, sw, sh,
                    Math.floor(x), Math.floor(y),
                    Math.floor(d.w * scale), Math.floor(d.h * scale)
                );
                x = x + (d.w * scale);
            }
        };
    }
}
