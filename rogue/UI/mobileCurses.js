/**
 * mobileCurses
 * Lightweight DOM-based Curses Emulation for Mobile/Low-spec Environments
 * 
 * @description
 * jncurses.js をベースに、Canvas描画やアニメーションを排除し、
 * 直接 HTML要素 (div/span) を操作するように最適化したクラスです。
 */
class mobileCurses {
    /**
     * @constructor
     * @param {number} width textBufferWidthSize
     * @param {number} column textBufferLineSize
     * @param {string} rootId 描画先コンテナのID
     */
    constructor(width, column, rootId) {
        const BUFW = width;
        const BUFH = column;
        const textbuffer = [];
        const cursor = { x: 0, y: 0 };

        this.root = document.getElementById(rootId);
        this.lines = []; // 行ごとの div 要素

        // タイルマッピングの初期化
        this.tileMap = (typeof tileMapping === 'function') ? tileMapping() : {};
        // 1行あたりのタイル数 (tileset画像の幅 / タイル幅 = 1280 / 32 = 40)
        this.tilesPerRow = 40;
        this.tileSize = 32; // 元画像サイズ

        // UIManagerなどから参照されるプロパティ
        this.cursor = cursor;
        this.buffer = textbuffer;

        // 初期化: 指定された範囲のバッファとDOM要素を作成
        if (this.root) {
            this.root.innerHTML = '';
            this.root.style.position = 'absolute';
            for (let y = 0; y < BUFH; y++) {
                textbuffer[y] = " ".repeat(BUFW);
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

        /**
         * 1行分の内容をパースして DOM を更新します。
         */
        const refreshLine = (y) => {
            const line = this.lines[y];
            if (!line) return;

            const text = textbuffer[y];

            // NetHack Wasm版におけるグリフの判定:
            const isGlyph = (code) => {
                // ユーザー指定の範囲: 日本語(0x3000〜)を除外した領域をグリフとみなす
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
                        // 溜まっていたテキストを出力
                        if (currentText) {
                            line.appendChild(document.createTextNode(currentText));
                            currentText = "";
                        }
                        // グリフ用 span を作成
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
                            glyphSpan.style.backgroundSize = `${this.tilesPerRow * 16}px auto`; // 32pxを16pxに縮小表示
                            glyphSpan.style.backgroundPosition = `-${tx / 2}px -${ty / 2}px`;
                        } else {
                            glyphSpan.style.backgroundColor = '#333'; // プレースホルダー
                        }
                        line.appendChild(glyphSpan);
                    }
                }
                if (currentText) {
                    line.appendChild(document.createTextNode(currentText));
                }
            }
        };

        // --- jncurses 互換 API ---

        this.move = (new_x, new_y) => {
            if (new_x >= 0 && new_x < BUFW) cursor.x = new_x;
            if (new_y >= 0 && new_y < BUFH) cursor.y = new_y;
        };

        this.printw = (text) => {
            let s = textbuffer[cursor.y];
            let d = s.slice(0, cursor.x);
            let n = cursor.x + text.length;
            if (n < BUFW) {
                d = d + text + s.slice(n, BUFW);
            } else {
                d = (d + text).slice(0, BUFW);
            }
            textbuffer[cursor.y] = d;
            refreshLine(cursor.y);
        };

        this.mvprintw = (text, x, y) => {
            this.move(x, y);
            this.printw(text);
        };

        this.clear = () => {
            for (let i = 0; i < BUFH; i++) {
                textbuffer[i] = " ".repeat(BUFW);
                refreshLine(i);
            }
        };

        this.insertln = () => {
            textbuffer.splice(cursor.y, 0, " ".repeat(BUFW));
            textbuffer.pop();
            for (let y = cursor.y; y < BUFH; y++) refreshLine(y);
        };

        this.deleteln = () => {
            textbuffer.splice(cursor.y, 1);
            textbuffer.push(" ".repeat(BUFW));
            for (let y = cursor.y; y < BUFH; y++) refreshLine(y);
        };

        this.insch = (str) => {
            let s = textbuffer[cursor.y];
            let d = s.slice(0, cursor.x) + str + s.slice(cursor.x, BUFW - str.length);
            textbuffer[cursor.y] = d;
            refreshLine(cursor.y);
        };

        this.delch = () => {
            let s = textbuffer[cursor.y];
            let d = s.slice(0, cursor.x) + s.slice(cursor.x + 1, BUFW) + " ";
            textbuffer[cursor.y] = d;
            refreshLine(cursor.y);
        };

        this.wscrl = (linenum) => {
            if (linenum > 0) {
                for (let i = 0; i < linenum; i++) {
                    textbuffer.shift();
                    textbuffer.push(" ".repeat(BUFW));
                }
            } else {
                for (let i = 0; i < -linenum; i++) {
                    textbuffer.pop();
                    textbuffer.unshift(" ".repeat(BUFW));
                }
            }
            for (let y = 0; y < BUFH; y++) refreshLine(y);
        };

        this.scrolllock = (mode) => { };
        this.rewritecheck = () => { };

        // 互換用設定メソッド
        this.setFontId = (fId) => { };
        this.setPrompt = (p) => { };
        this.setLinewidth = (num) => { };
        this.setCharwidth = (num) => { };
        this.setUseUTF = (sw) => { };
        this.lastX = null;
        this.lastY = null;
        this.draw = (g, x = 0, y = 0) => {
            if (this.root) {
                // 座標が変化した時のみ DOM を更新
                if (this.lastX !== x || this.lastY !== y) {
                    this.root.style.left = `${x}px`;
                    this.root.style.top = `${y}px`;
                    this.lastX = x;
                    this.lastY = y;
                }
            }
        };
    }
}
