/**
 * @class DisplayDevice
 * @description
 * すべてのレンダリングエンジン（Canvas, DOM等）の基底クラスです。
 * NetHack WASM WebUI における表示デバイスの共通インターフェースを定義します。
 */
class DisplayDevice {
    /**
     * @constructor
     * @param {number} width バッファの幅（文字数）
     * @param {number} height バッファの高さ（行数）
     */
    constructor(width, height) {
        this.bufW = width;
        this.bufH = height;
        this.buffer = [];
        this.cursor = { x: 0, y: 0 };

        // 初期化
        for (let i = 0; i < height; i++) {
            this.buffer[i] = " ".repeat(width);
        }
    }

    /**
     * カーソルを移動します。
     * @param {number} x 
     * @param {number} y 
     */
    move(x, y) {
        if (x >= 0 && x < this.bufW) this.cursor.x = x;
        if (y >= 0 && y < this.bufH) this.cursor.y = y;
    }

    /**
     * 現在のカーソル位置から文字列を表示します。
     * @param {string} text 
     */
    printw(text) {
        // サブクラスで実装
    }

    /**
     * 座標を指定して文字列を表示します。
     */
    mvprintw(text, x, y) {
        this.move(x, y);
        this.printw(text);
    }

    /**
     * 画面を消去します。
     */
    clear() {
        for (let i = 0; i < this.bufH; i++) {
            this.buffer[i] = " ".repeat(this.bufW);
        }
    }

    /**
     * 行を挿入します。
     */
    insertln() { }

    /**
     * 行を削除します。
     */
    deleteln() { }

    /**
     * 文字を挿入します。
     */
    insch(char) { }

    /**
     * 文字を削除します。
     */
    delch() { }

    /**
     * スクロールします。
     */
    wscrl(n) { }

    /**
     * 描画を実行します。
     * @param {object} g gameCore インスタンス 
     * @param {number} x 表示先X座標
     * @param {number} y 表示先Y座標
     */
    draw(g, x, y) { }

    // --- 設定用メソッド (jncurses 互換) ---
    setFontId(id) { }
    setPrompt(p) { }
    setLinewidth(n) { }
    setCharwidth(n) { }
    setUseUTF(b) { }
    setMapMode(b) { }
    scrolllock(b) { }
    rewritecheck() { return 0; }
}
