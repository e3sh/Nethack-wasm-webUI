function UIManager(r, g) {

    const d = r.define;
    const f = r.func;
    const t = r.types;
    const v = r.globalValiable;
    //const ms = r.messages;

    //const m = document.getElementById("memo");
    let dspmode = 0;
    this.texwork = "";

    //this.io = new io(r);
    //this.command = new command(r);
    //this.scene = new scene(r);
    //this.wizard = new wizard(r);

    const cw = d.DSP_MAIN_FG;
    const mw = d.DSP_MAIN_BG;
    const hw = d.DSP_WINDOW;

    //effect
    const sceneC = g.task.read("scene")
    const moveEffect = sceneC.moveEffect;
    this.setEffect = moveEffect.setEffect;

    //
    const monsHpView = sceneC.monsHpView;
    this.setMonsHp = monsHpView.setEffect;
    this.resetMonsHp = monsHpView.resetEffects;

    let battledmg = 0;
    this.set_battledmg = function (num) { battledmg = num }
    this.battleEffect = function (asch, x, y) {
        for (let i = 0; i < (2 * Math.PI); i += 0.3) {
            this.setEffect(asch, { x: x, y: y }, { x: x + Math.cos(i) * 2.5, y: y + Math.sin(i) * 2.5 });
        }
        this.setEffect(`${battledmg}`, { x: x, y: y }, { x: x, y: y - 1 }, 120);

    }
    this.damageEffect = function (asch, x, y) {
        for (let i = 0; i < (2 * Math.PI); i += 0.3) {
            this.setEffect(asch, { x: x + Math.cos(i) * 2, y: y + Math.sin(i) * 2 }, { x: x, y: y });
        }
        this.setEffect(`${battledmg}`, { x: x, y: y }, { x: x, y: y + 1 }, 120);
    }
    this.hitEffect = function (asch, x, y) {
        for (let i = 0; i < (2 * Math.PI); i += 0.3) {
            this.setEffect(asch, { x: x, y: y }, { x: x + Math.cos(i) * 1.5, y: y + Math.sin(i) * 1.5 });
        }
        this.setEffect(`${battledmg}`, { x: x, y: y }, { x: x, y: y - 1 }, 120);
    }

    this.setCameraCenter = function () {
        sceneC.setCameraPos(0, 0);
    }

    this.setCameraPos = function (pos) {

        let x = -pos.x + Math.floor(d.COLS / 2);
        let y = -pos.y + Math.floor(d.LINES / 2);

        sceneC.setCameraPos(x, y);
    }
    this.setCameraEnable = function (flg) {
        sceneC.setCameraEnable(flg);
    }
    //sceneRunstep status 
    this.get_runstep = function () { return sceneC.runstep; }
    this.check_hastestep = () => { return (sceneC.runstep % 2 == 0) ? true : false; }

    //dispaly functions
    //cursus bridge    
    this.setDsp = (num) => { dspmode = num; }

    this.move = function (y, x) { g.console[dspmode].move(x, y); }
    this.printw = function (text) { g.console[dspmode].printw(text); }
    this.mvaddch = function (y, x, ch) {
        g.console[dspmode].mvprintw(ch, x, y);
    }
    this.mvaddstr = this.mvaddch;
    this.addch = function (ch) { g.console[dspmode].printw(ch); }
    this.insertLine = () => { g.console[dspmode].insertln(); }
    this.clear = function () { g.console[dspmode].clear(); }

    //rogue bridge
    this.msg = (text) => {
        if (!Boolean(text)) {
            console.trace(); //undefinedのメッセージが表示される場合の呼び出し元調査用
        }
        text = `${this.texwork + text}`;
        if (!Boolean(text)) return;
        if (text.length > 0) {
            g.console[d.DSP_MESSAGE].move(0, 0);
            g.console[d.DSP_MESSAGE].insertln(); g.console[d.DSP_MESSAGE].printw(text);

            let cl = 1;
            for (let i = 0; i < text.length; i++) {
                cl += (text.charCodeAt(i) < 128) ? 1 : 2;
            }
            g.console[d.DSP_MESSAGE].move(cl, 0);
        }
        this.texwork = "";
    }

    this.addmsg = (text) => {
        this.texwork += text;
    }
    this.endmsg = this.msg;

    this.doadd = () => { };//?

    /*
    * doadd:
    *	Perform a printf into a buffer
    */
    /*
    doadd(char *fmt, va_list ap)
    {
        vsprintf(&msgbuf[newpos], fmt, ap);
        newpos = strlen(msgbuf);
    }
    */
    this.comment = (text) => {
        g.console[d.DSP_COMMENT].insertln();
        g.console[d.DSP_COMMENT].printw(text);
    }

    /*
    * readchar:
    */
    this.overlapview = (flg) => {
        const io = g.task.read("io");
        io.overlapview = flg;
    }

    /*
    * readchar:
    *	flushes stdout so that screen is up to date and then returns
    *	getchar.
    */
    this.readchar = () => {
        let ki = g.task.read("io").input.keylist;
        //if (ki.includes("KeyQ")) r.mapcheckTest();
        //keylistを返す
        return ki;

        let c;
        fflush(stdout);
        return (wgetch(cw));
    }

    this.wait_for = (ch) => {
        let ki = g.task.read("io").input.keylist;
        return (ki.includes(ch)) ? true : false;
    }

    //buffer read
    const read_buff = (surf, x, y) => {
        let buff = g.console[surf].buffer;

        let res = ' ';
        if (buff.length >= y) {
            if (buff[y].length >= x) {
                res = buff[y].substring(x, x + 1);
            }
        }
        return res;
    }

    this.inch = function () {
        return read_buff(
            d.DSP_MAIN,
            g.console[d.DSP_MAIN].cursor.x,
            g.console[d.DSP_MAIN].cursor.y,
        );
    }

    this.mvinch = (y, x) => {
        //let nowpos = this.getyx();
        g.console[d.DSP_MAIN].move(x, y);
        let res = this.inch();
        //g.console[ d.DSP_MAIN].move(nowpos.x, nowpos.y); 
        return res;
    }

    this.mvgetch = this.mvinch;//		mvwgetch(stdscr,y,x,ch)
    this.mvgetstr = this.mvinch;//	mvwgetstr(stdscr,y,x,str)
    //this.mvinch =(y,x)=>{};//		mvwinch(stdscr,y,x)

    /*
    * mv w functions
    */
    this.wclear = (win) => { g.console[win].clear() };
    this.wmove = (win, y, x) => { g.console[win].move(x, y); }
    this.waddch = (win, ch) => { g.console[win].printw(ch); };//	VOID(wmove(win,y,x)==ERR?ERR:waddch(win,ch))
    this.waddstr = this.waddch;
    this.mvwaddch = (win, y, x, ch) => { g.console[win].mvprintw(ch, x, y); };//	VOID(wmove(win,y,x)==ERR?ERR:waddch(win,ch))

    //this.mvwgetch =(win)=>{ 
    //    let cx = g.console[win].cursor.x;
    //    let cy = g.console[win].cursor.y;
    //    return {x:cx, y:cy};
    // };//	VOID(wmove(win,y,x)==ERR?ERR:wgetch(win,ch))
    this.mvwaddstr = this.mvwaddch;//	VOID(wmove(win,y,x)==ERR?ERR:waddstr(win,str))
    //this.mvwgetstr = this.mvwgetch;//	VOID(wmove(win,y,x)==ERR?ERR:wgetstr(win,str))
    this.mvwinch = (win, y, x) => {
        let buff = g.console[win].buffer;

        let res = ' ';
        if (buff.length >= y) {
            if (typeof buff[y] !== 'undefined') {
                if (buff[y].length >= x) {
                    res = buff[y].substring(x, x + 1);
                }
            }
        }
        return res;
    };//	VOID(wmove(win,y,x) == ERR ? ERR : winch(win))

    /*
    * psuedo functions
    */
    this.clearok = (win, bf) => { };//	 (win._clear = bf)
    this.leaveok = (win, bf) => { };//	 (win._leave = bf)
    this.scrollok = (win, bf) => { };// (win._scroll = bf)
    this.getyx = (win, y, x) => {
        let cx = g.console[d.DSP_MAIN].cursor.x;
        let cy = g.console[d.DSP_MAIN].cursor.y;
        return { x: cx, y: cy };
    };//	 y = win._cury, x = win._curx

    //this.winch =(win)=>{};//	 (win._y[win._cury][win._curx])

    this.initscr = () => { };
    this.newwin = () => { };

    this.comment("UI");

    /* --- NetHack 3.7 Bridge Methods --- */

    this.nhWindowMap = {
        1: d.DSP_MESSAGE, // NHW_MESSAGE
        2: d.DSP_STATUS,  // NHW_STATUS
        3: d.DSP_MAIN,    // NHW_MAP
        4: d.DSP_WINDOW,  // NHW_MENU
        5: d.DSP_COMMENT  // NHW_TEXT
    };

    this.nhCurs = function (windowId, x, y) {
        const dsp = this.nhWindowMap[windowId] || d.DSP_WINDOW;
        this.wmove(dsp, y, x);
    };

    this.nhPutStr = function (windowId, attr, text) {
        const dsp = this.nhWindowMap[windowId] || d.DSP_WINDOW;
        if (windowId === 1) { // NHW_MESSAGE
            this.setDsp(dsp);
            this.msg(text);
        } else {
            this.waddstr(dsp, text);
        }
    };

    let txtbuf = [];
    this.nhPutbufClear = () => {
        txtbuf = [];
    }
    this.nhPutbufAdd = (text) => {
        txtbuf.push(text);
    };
    this.nhPutbufDraw = (windowId) => {
        const dsp = this.nhWindowMap[windowId] || d.DSP_WINDOW;

        for (let line in txtbuf) {
            this.mvwaddch(dsp, Number(line), 0, txtbuf[line]);
        }
    };

    this.nhPrintGlyph = function (windowId, x, y, glyphInfo) {
        const dsp = this.nhWindowMap[windowId] || d.DSP_MAIN;
        const ch = glyphInfo.ch || (glyphInfo.symbol ? String.fromCharCode(glyphInfo.symbol) : '?');
        this.mvwaddch(dsp, y, x, ch);
    };
    this.nhClear = function (windowId) {
        const dsp = this.nhWindowMap[windowId] || d.DSP_MAIN;
        this.wclear(dsp);
    };

    this.showMenu = function (items, how, promptText) {
        return new Promise((resolve) => {
            let selectedIndex = 0;
            const menuDsp = d.DSP_WINDOW;

            const render = () => {
                this.wclear(menuDsp);
                this.wmove(menuDsp, 0, 0);
                this.printw(promptText + "\n");
                items.forEach((item, i) => {
                    const prefix = (i === selectedIndex) ? "> " : "  ";
                    const char = (item.ch && item.ch !== -1) ? String.fromCharCode(item.ch) : "-";
                    this.printw(`${prefix}${char}) ${item.str}\n`);
                });
            };

            render();

            const originalHandler = r.pendingInputResolve;
            const handler = (charCode) => {
                const key = String.fromCharCode(charCode).toLowerCase();

                // 移動: j, k, または矢印キー相当
                if (key === 'j' || charCode === 'j'.charCodeAt(0)) {
                    selectedIndex = (selectedIndex + 1) % items.length;
                    render();
                    r.pendingInputResolve = handler; // 次の入力を待つ
                } else if (key === 'k' || charCode === 'k'.charCodeAt(0)) {
                    selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                    render();
                    r.pendingInputResolve = handler; // 次の入力を待つ
                } else if (charCode === 13) { // Enter: 決定
                    resolve([items[selectedIndex]]);
                    r.pendingInputResolve = originalHandler;
                } else if (charCode === 27) { // ESC: キャンセル
                    resolve([]);
                    r.pendingInputResolve = originalHandler;
                } else {
                    // ショートカットキーによる直接選択
                    const hit = items.find(it => it.ch === charCode);
                    if (hit) {
                        resolve([hit]);
                        r.pendingInputResolve = originalHandler;
                    } else {
                        // 無関係なキーの場合はもう一度待機
                        r.pendingInputResolve = handler;
                    }
                }
            };
            r.pendingInputResolve = handler;
        });
    };

    this.showInput = function (query) {
        return new Promise((resolve) => {
            console.log("Showing input prompt:", query);
            this.msg(query);
            // 簡易的な入力実装（ブラウザのプロンプトを使用）
            const input = prompt(query);
            resolve(input);
        });
    };

    this.updateStatus = function (fld, value, chg, clr) {
        // ステータス表示の更新ロジック（将来的に固定レイアウトへ出力するように拡張）
        console.log(`Status update: fld=${fld} val=${value} chg=${chg}`);
    };
}