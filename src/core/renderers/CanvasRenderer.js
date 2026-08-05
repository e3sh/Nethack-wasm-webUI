/**
 * CanvasRenderer.js - WebUICore HTML5 Canvas 描画アダプター
 *
 * 単一 HTML5 Canvas 要素に対して高速スプライト/文字描画を行う IRenderer 実装。
 */

export class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement|string} canvas - Canvas要素または要素ID
     * @param {Object} [options]
     * @param {string} [options.tileImage='pict/nethack_default_32.png']
     * @param {number} [options.tileSize=32]
     */
    constructor(canvas, options = {}) {
        this.canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
        this.options = Object.assign({
            tileImage: 'pict/nethack_default_32.png',
            tileSize: 32,
            cols: 80,
            rows: 24
        }, options);

        this.ctx = null;
        this.tileImgObj = null;
        this.tileMap = null;
        this.glyphCache = new Map();
    }

    init() {
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        if (typeof Image !== 'undefined') {
            this.tileImgObj = new Image();
            this.tileImgObj.onload = () => {
                this.redrawCache();
            };
            this.tileImgObj.src = this.options.tileImage;
        }
    }

    clearMap() {
        if (!this.ctx) return;
        this.glyphCache.clear();
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGlyph(x, y, glyphData) {
        if (!this.ctx) return;

        let glyphId = -1;
        let ch = ' ';
        let color = 7;

        if (typeof glyphData === 'number') {
            glyphId = glyphData;
        } else if (glyphData) {
            const gi = glyphData.glyphInfo || glyphData;
            glyphId = gi.glyph !== undefined ? gi.glyph : (glyphData.glyph !== undefined ? glyphData.glyph : -1);
            ch = gi.ch || glyphData.ch || ' ';
            color = gi.color !== undefined ? gi.color : (glyphData.color !== undefined ? glyphData.color : 7);
        }

        const info = { glyph: glyphId, ch, color };
        const cacheKey = `${x},${y}`;
        this.glyphCache.set(cacheKey, { x, y, info });

        this._renderSingleGlyph(x, y, info);
    }

    _renderSingleGlyph(x, y, info) {
        const ts = this.options.tileSize;
        const dx = x * ts;
        const dy = y * ts;

        // tileMapping 関数の動的呼び出し
        if (!this.tileMap && typeof window !== 'undefined' && typeof window.tileMapping === 'function') {
            try {
                this.tileMap = window.tileMapping();
            } catch (e) {}
        }

        // タイル画像描画
        if (this.tileImgObj && this.tileImgObj.complete && info.glyph >= 0 && this.tileMap) {
            const tileIdx = this.tileMap[info.glyph];
            if (tileIdx !== undefined && tileIdx >= 0) {
                const colsInImg = Math.floor(this.tileImgObj.width / ts) || 40;
                const sx = (tileIdx % colsInImg) * ts;
                const sy = Math.floor(tileIdx / colsInImg) * ts;

                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(dx, dy, ts, ts);
                this.ctx.drawImage(this.tileImgObj, sx, sy, ts, ts, dx, dy, ts, ts);
                return;
            }
        }

        // アスキーテキスト描画フォールバック
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(dx, dy, ts, ts);
        this.ctx.fillStyle = this._colorToCss(info.color);
        this.ctx.font = `${ts - 4}px monospace`;
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(info.ch || ' ', dx, dy);
    }

    redrawCache() {
        if (!this.ctx || !this.glyphCache.size) return;
        for (const item of this.glyphCache.values()) {
            this._renderSingleGlyph(item.x, item.y, item.info);
        }
    }

    updateStatus(statusFields) {}
    appendMessage(text) {}
    showPrompt(promptInfo) {}
    hidePrompt() {}
    showMenu(items) {}
    showTextModal(text) {}

    _colorToCss(colorIdx) {
        const colors = [
            '#000000', '#ff0000', '#00ff00', '#ffff00',
            '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
            '#888888', '#ff8800', '#00ff88', '#ffff88',
            '#8888ff', '#ff88ff', '#88ffff', '#ffffff'
        ];
        return colors[colorIdx] || '#ffffff';
    }
}
