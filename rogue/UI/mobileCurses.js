/**
 * @class mobileCurses
 * @description
 * Lightweight DOM-based Curses Emulation for Mobile/Low-spec Environments
 */
class mobileCurses extends DisplayDevice {
    /**
     * @constructor
     * @param {number} width textBufferWidthSize
     * @param {number} column textBufferLineSize
     * @param {string} rootId 描画先コンテナのID
     */
    constructor(width, column, rootId) {
        super(width, column);

        this.root = document.getElementById(rootId);
        this.lines = []; // 行ごとの div 要素

        // タイルマッピングの初期化
        this.tileMap = (typeof tileMapping === 'function') ? tileMapping() : {};
        // 1行あたりのタイル数 (tileset画像の幅 / タイル幅 = 1280 / 32 = 40)
        this.tilesPerRow = 40;
        this.tileSize = 32; // 元画像サイズ

        this.lastX = null;
        this.lastY = null;

        // 初期化: 指定された範囲のバッファとDOM要素を作成
        if (this.root) {
            this.root.innerHTML = '';
            this.root.style.position = 'absolute';
            for (let y = 0; y < this.bufH; y++) {
                const lineDiv = document.createElement('div');
                lineDiv.className = 'jn-line';
                lineDiv.style.whiteSpace = 'pre';
                lineDiv.style.fontFamily = 'monospace';
                lineDiv.style.fontSize = '16px';
                lineDiv.style.height = '16px';
                this.root.appendChild(lineDiv);
                this.lines[y] = lineDiv;
            }
        }
    }

    /**
     * 1行分の内容をパースして DOM を更新します。
     */
    refreshLine(y) {
        const line = this.lines[y];
        if (!line) return;

        const text = this.buffer[y];

        // NetHack Wasm版におけるグリフの判定:
        const isGlyph = (code) => {
            // 日本語(0x3000〜)を除外した領域をグリフとみなす
            return (code >= 0x100 && code < 0x3000);
        };

        let hasGlyph = false;
        for (let i = 0; i < text.length; i++) {
            if (isGlyph(text.charCodeAt(i))) {
                hasGlyph = true;
                break;
            }
        }

        if (!hasGlyph) {
            // 通常のテキスト（日本語含む）
            if (line.textContent !== text) {
                line.textContent = text;
            }
        } else {
            // グリフ混在の場合: <span> 要素のシーケンスとして再構築
            line.innerHTML = '';
            let currentText = "";
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if (!isGlyph(code)) {
                    currentText += text[i];
                } else {
                    if (currentText) {
                        line.appendChild(document.createTextNode(currentText));
                        currentText = "";
                    }
                    const glyphSpan = document.createElement('span');
                    const glyphId = code - 0x100; // GLYPH_BASE を引く
                    const tileIdx = this.tileMap[glyphId] !== undefined ? this.tileMap[glyphId] : -1;

                    glyphSpan.className = `jn-glyph glyph-${glyphId}`;
                    glyphSpan.style.display = 'inline-block';
                    glyphSpan.style.verticalAlign = 'middle';
                    glyphSpan.style.width = '16px';
                    glyphSpan.style.height = '16px';

                    if (tileIdx >= 0) {
                        const tx = (tileIdx % this.tilesPerRow) * this.tileSize;
                        const ty = Math.floor(tileIdx / this.tilesPerRow) * this.tileSize;
                        glyphSpan.style.backgroundImage = 'url("pict/NethackModern32x-360.png")';
                        glyphSpan.style.backgroundRepeat = 'no-repeat';
                        glyphSpan.style.backgroundSize = `${this.tilesPerRow * 16}px auto`; // 16pxに縮小
                        glyphSpan.style.backgroundPosition = `-${tx / 2}px -${ty / 2}px`;
                    } else {
                        glyphSpan.style.backgroundColor = '#333';
                    }
                    line.appendChild(glyphSpan);
                }
            }
            if (currentText) {
                line.appendChild(document.createTextNode(currentText));
            }
        }
    }

    printw(text) {
        let s = this.buffer[this.cursor.y];
        let d = s.slice(0, this.cursor.x);
        let n = this.cursor.x + text.length;
        if (n < this.bufW) {
            d = d + text + s.slice(n, this.bufW);
        } else {
            d = (d + text).slice(0, this.bufW);
        }
        this.buffer[this.cursor.y] = d;
        this.refreshLine(this.cursor.y);
    }

    clear() {
        super.clear();
        for (let i = 0; i < this.bufH; i++) {
            this.refreshLine(i);
        }
    }

    insertln() {
        this.buffer.splice(this.cursor.y, 0, " ".repeat(this.bufW));
        this.buffer.pop();
        for (let y = this.cursor.y; y < this.bufH; y++) this.refreshLine(y);
    }

    deleteln() {
        this.buffer.splice(this.cursor.y, 1);
        this.buffer.push(" ".repeat(this.bufW));
        for (let y = this.cursor.y; y < this.bufH; y++) this.refreshLine(y);
    }

    insch(str) {
        let s = this.buffer[this.cursor.y];
        let d = s.slice(0, this.cursor.x) + str + s.slice(this.cursor.x, this.bufW - str.length);
        this.buffer[this.cursor.y] = d;
        this.refreshLine(this.cursor.y);
    }

    delch() {
        let s = this.buffer[this.cursor.y];
        let d = s.slice(0, this.cursor.x) + s.slice(this.cursor.x + 1, this.bufW) + " ";
        this.buffer[this.cursor.y] = d;
        this.refreshLine(this.cursor.y);
    }

    wscrl(linenum) {
        if (linenum > 0) {
            for (let i = 0; i < linenum; i++) {
                this.buffer.shift();
                this.buffer.push(" ".repeat(this.bufW));
            }
        } else {
            for (let i = 0; i < -linenum; i++) {
                this.buffer.pop();
                this.buffer.unshift(" ".repeat(this.bufW));
            }
        }
        for (let y = 0; y < this.bufH; y++) this.refreshLine(y);
    }

    draw(g, x = 0, y = 0) {
        if (this.root) {
            if (this.lastX !== x || this.lastY !== y) {
                this.root.style.left = `${x}px`;
                this.root.style.top = `${y}px`;
                this.lastX = x;
                this.lastY = y;
            }
        }
    }
}
