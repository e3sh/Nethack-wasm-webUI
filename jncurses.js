/**
 * @class jncurses
 * @description
 * TEXT CONSOLE DISPLAY EMU LIB 
 * javascript ncurses (Canvas implementation)
 */
class jncurses extends DisplayDevice {
    /**
     * @constructor
     * @param {number} width textBufferWidthSize
     * @param {number} column textBufferLineSize
     */
    constructor(width, column) {
        super(width, column);

        this.rewritecount = new Array(column).fill(0);
        this.enableScroll = false;
        this.scrollCount = 0;

        this.fontId = null;
        this.prompt = null;
        this.charw = 8;
        this.linew = 16;
        this.useutf = false;

        this.shift = { ready: false, pos: 15, v: 0 };
    }

    setFontId(fId) { this.fontId = fId; }
    setPrompt(p) { this.prompt = p; }
    setLinewidth(num) { this.linew = num; }
    setCharwidth(num) { this.charw = num; }
    setUseUTF(sw) { this.useutf = sw; }

    move(new_x, new_y) {
        if ((new_x >= 0) && (new_x < this.bufW)) this.cursor.x = new_x;
        if ((new_y >= 0) && (new_y < this.bufH)) this.cursor.y = new_y;
    }

    addch(chr_to_add) {
        this.printw(chr_to_add);
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
        this.rewritecount[this.cursor.y]++;
    }

    mvprintw(text, x, y) {
        this.move(x, y);
        this.printw(text);
    }

    insch(str) {
        let s = this.buffer[this.cursor.y];
        let d = s.slice(0, this.cursor.x);
        d = d + str + s.slice(this.cursor.x, this.bufW - str.length);
        this.buffer[this.cursor.y] = d;
        this.rewritecount[this.cursor.y]++;
    }

    insertln() {
        for (let i = this.bufH - 1; i > this.cursor.y; i--) {
            this.buffer[i] = this.buffer[i - 1];
            this.rewritecount[i]++;
        }
        this.buffer[this.cursor.y] = " ".repeat(this.bufW);
        this.rewritecount[this.cursor.y]++;
        this.shift = { ready: true, pos: this.linew, v: 1 };
    }

    delch() {
        let s = this.buffer[this.cursor.y];
        let d;
        if (this.cursor.x > 0) {
            d = s.slice(0, this.cursor.x) + s.slice(this.cursor.x + 1, this.bufW) + " ";
        } else {
            d = s.slice(1, this.bufW) + " ";
        }
        this.buffer[this.cursor.y] = d;
        this.rewritecount[this.cursor.y]++;
    }

    deleteln() {
        this.scrollUp(this.cursor.y);
        this.shift = { ready: true, pos: this.linew, v: -1 };
    }

    clear() {
        super.clear();
        for (let i = 0; i < this.bufH; i++) {
            this.rewritecount[i] = 0;
        }
    }

    scrolllock(mode) {
        this.enableScroll = !mode;
    }

    wscrl(linenum) {
        if (this.enableScroll && (this.scrollCount < 1)) {
            this.scrollCount = linenum;
        }
    }

    scrollUp(startLn) {
        for (let i = startLn; i < this.bufH - 1; i++) {
            this.buffer[i] = this.buffer[i + 1];
            this.rewritecount[i]++;
        }
        this.buffer[this.bufH - 1] = " ".repeat(this.bufW);
        this.rewritecount[this.bufH - 1]++;
    }

    rewritecheck() {
        let c = 0;
        for (let i = 0; i < this.bufH; i++) {
            c = c + this.rewritecount[i];
        }
        c = c + this.scrollCount;
        c = c + ((this.shift.ready) ? 1 : 0);
        return c;
    }

    draw(g, x = 0, y = 0) {
        let pos = 0;
        if (this.shift.ready) {
            this.shift.pos--;
            if (this.shift.v > 0) {
                pos = (-this.shift.pos + this.linew) - this.linew;
            } else {
                pos = this.shift.pos;
            }
            if (this.shift.pos < 1) this.shift.ready = false;
        }
        if (this.scrollCount > 0) {
            this.scrollUp(0);
            this.scrollCount--;
        }
        if (Boolean(this.fontId)) {
            for (let i in this.buffer) {
                let w = 0;
                if (i >= this.cursor.y) w = pos;

                if (!this.useutf) {
                    g.font[this.fontId].putchr(this.buffer[i], x, y + i * this.linew + w);
                } else {
                    g.kanji.putchr(this.buffer[i], x, y + i * this.linew + w, 0.5);
                }
            }
            if (Boolean(this.prompt)) {
                let d = (g.blink()) ? this.prompt[1] : this.prompt[0];

                if (!this.useutf) {
                    g.font[this.fontId].putchr(d, x + this.cursor.x * this.charw, y + this.cursor.y * this.linew);
                } else {
                    let cl = 0;
                    if (Boolean(this.buffer[this.cursor.y])) {
                        const line = this.buffer[this.cursor.y];
                        for (let i = 0; i < this.cursor.x; i++) {
                            cl += (line.charCodeAt(i) < 128) ? this.charw : this.charw * 2;
                        }
                    }
                    let ix = (this.cursor.x * this.charw > cl) ? this.cursor.x * this.charw : cl;
                    g.kanji.putchr(d, x + ix, y + this.cursor.y * this.linew, 0.5);
                }
            }
        }

        for (let i = 0; i < this.bufH; i++) {
            this.rewritecount[i] = 0;
        }
    }
}
