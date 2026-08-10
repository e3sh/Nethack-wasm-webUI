/**
 * GlyphHelper.js - WebUICore グリフ/タイル描画ヘルパー (HTMLエスケープ安全版)
 *
 * Glyph ID から タイル画像座標 (background-position) や
 * CSS スタイル、HTML タグ文字列、Canvas 描画手続きを生成する。
 */

export class GlyphHelper {
    /**
     * Glyph ID または glyphInfo から CSS スタイルオブジェクトを生成
     * @param {number|Object} glyph - Glyph ID または { glyph, glyphInfo } オブジェクト
     * @param {Object} [options]
     * @param {string} [options.tileImage='pict/nethack_default_32.png'] - タイル画像パス
     * @param {number} [options.tileSize=32] - タイル原寸サイズ (px)
     * @param {number} [options.displaySize=16] - UI表示用サイズ (px)
     * @param {number} [options.tilesPerRow=40] - 1行あたりのタイル数
     * @returns {Object} CSSスタイルオブジェクト
     */
    static getGlyphStyle(glyph, options = {}) {
        const tileImage = options.tileImage || '../pict/nethack_default_32.png';
        const tileSize = options.tileSize || 32;
        const displaySize = options.displaySize || 16;
        const tilesPerRow = options.tilesPerRow || 40;

        let glyphId = -1;
        if (typeof glyph === 'number') {
            glyphId = glyph;
        } else if (glyph && typeof glyph === 'object') {
            glyphId = glyph.glyph !== undefined ? glyph.glyph : (glyph.glyphInfo ? glyph.glyphInfo.glyph : -1);
        }

        if (glyphId < 0) return null;

        let tileIdx = -1;
        if (glyphId >= 0 && typeof window !== 'undefined' && typeof window.tileMapping === 'function') {
            try {
                const map = window.tileMapping();
                if (map && map[glyphId] !== undefined) {
                    tileIdx = map[glyphId];
                }
            } catch (e) { }
        }

        if (tileIdx >= 0) {
            const scale = displaySize / tileSize;
            const tx = (tileIdx % tilesPerRow) * tileSize * scale;
            const ty = Math.floor(tileIdx / tilesPerRow) * tileSize * scale;
            const totalWidth = tilesPerRow * tileSize * scale;

            return {
                display: 'inline-block',
                verticalAlign: 'middle',
                width: `${displaySize}px`,
                height: `${displaySize}px`,
                backgroundImage: `url(${tileImage})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${totalWidth}px auto`,
                backgroundPosition: `-${tx}px -${ty}px`,
                flexShrink: 0
            };
        }

        return null;
    }

    /**
     * Glyph ID または glyphInfo から UI 埋め込み用 HTML <span> タグ文字列を生成
     * @param {number|Object} glyph 
     * @param {Object} [options] 
     * @returns {string} HTML <span> タグ文字列
     */
    static getGlyphHtml(glyph, options = {}) {
        let glyphId = typeof glyph === 'number' ? glyph : (glyph ? glyph.glyph : -1);
        if (glyphId < 0) return '';

        const style = this.getGlyphStyle(glyph, options);
        if (!style) return '';

        const styleStr = Object.entries(style)
            .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
            .join(';');

        return `<span class="nh-glyph-icon glyph-${glyphId}" style="${styleStr}"></span>`;
    }

    /**
     * HTML5 Canvas context に対して指定のセル位置 (dx, dy) へタイル画像または文字を描画
     */
    static drawGlyphToCanvas(ctx, dx, dy, glyph, tileImgObj, options = {}) {
        if (!ctx) return;
        const tileSize = options.tileSize || 32;

        let glyphId = -1;
        let ch = ' ';
        let color = 7;

        if (typeof glyph === 'number') {
            glyphId = glyph;
        } else if (glyph) {
            const gi = glyph.glyphInfo || glyph;
            glyphId = gi.glyph !== undefined ? gi.glyph : (glyph.glyph !== undefined ? glyph.glyph : -1);
            ch = gi.ch || glyph.ch || ' ';
            color = gi.color !== undefined ? gi.color : (glyph.color !== undefined ? glyph.color : 7);
        }

        let tileIdx = -1;
        if (glyphId >= 0 && typeof window !== 'undefined' && typeof window.tileMapping === 'function') {
            try {
                const map = window.tileMapping();
                if (map && map[glyphId] !== undefined) tileIdx = map[glyphId];
            } catch (e) { }
        }

        if (tileImgObj && tileImgObj.complete && tileIdx >= 0) {
            const tilesPerRow = Math.floor(tileImgObj.width / tileSize) || 40;
            const sx = (tileIdx % tilesPerRow) * tileSize;
            const sy = Math.floor(tileIdx / tilesPerRow) * tileSize;

            ctx.fillStyle = '#000000';
            ctx.fillRect(dx, dy, tileSize, tileSize);
            ctx.drawImage(tileImgObj, sx, sy, tileSize, tileSize, dx, dy, tileSize, tileSize);
            return;
        }

        // アスキーフォールバック
        ctx.fillStyle = '#000000';
        ctx.fillRect(dx, dy, tileSize, tileSize);
        ctx.fillStyle = this._colorToCss(color);
        ctx.font = `${tileSize - 4}px monospace`;
        ctx.textBaseline = 'top';
        ctx.fillText(ch, dx, dy);
    }

    static _colorToCss(colorIdx) {
        const colors = [
            '#000000', '#ff0000', '#00ff00', '#ffff00',
            '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
            '#888888', '#ff8800', '#00ff88', '#ffff88',
            '#8888ff', '#ff88ff', '#88ffff', '#ffffff'
        ];
        return colors[colorIdx] || '#ffffff';
    }
}
