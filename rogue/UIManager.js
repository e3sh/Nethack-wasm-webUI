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
    this.trancelate = new trancelate(r);

    const cw = d.DSP_MAIN_FG;
    const mw = d.DSP_MAIN_BG;
    const hw = d.DSP_WINDOW;

    //debug
    const glyphCheckTable = [];

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

    this.cursorDown = function () {
        const cursor = g.console[dspmode].cursor;
        g.console[dspmode].move(cursor.x, cursor.y + 1);
    }

    //rogue bridge
    this.msg = (text) => {
        if (!Boolean(text)) {
            //console.trace(); //undefinedのメッセージが表示される場合の呼び出し元調査用
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
    let display_window = 0;
    let bcurpos = { x: 0, y: 0 };

    this.set_display_window = (windowId) => {
        display_window = windowId;
    }

    this.nhWindowMap = {
        1: d.DSP_MESSAGE, // NHW_MESSAGE
        2: d.DSP_STATUS,  // NHW_STATUS
        3: d.DSP_MAIN_FG,  // NHW_USEITEM
        4: d.DSP_WINDOW,  // NHW_MENU
        5: d.DSP_WINDOW,  // NHW_TEXT
        6: d.DSP_MAIN,  // NHW_BBMAP
    };

    this.nhCurs = function (windowId, x, y) {
        const dsp = this.nhWindowMap[windowId] || d.DSP_WINDOW;
        this.wmove(dsp, y, x);
    };

    this.nhPutStr = function (text) {
        this.trancelate.message(text);
        this.setDsp(d.DSP_MESSAGE);
        this.msg(text);
    };

    this.nhPutMsg = function (text) {
        const dsp = d.DSP_MAIN_FG;
        this.setDsp(dsp);
        this.printw(text);
        this.cursorDown();
    }

    let txtbuf = [];
    this.nhPutbufReady = () => {
        return (txtbuf.length > 0) ? true : false;
    }
    this.nhPutbufClear = () => {
        txtbuf = [];
    }
    this.nhPutbufAdd = (text, prompt) => {
        const result = this.trancelate.message(text);
        if (!Boolean(prompt)) prompt = "";

        if (display_window == 0 || display_window == 1)
            this.msg(`${result} ${prompt}`);
        else {
            const result = this.trancelate.message(text);
            txtbuf.push(`${result} ${prompt}`);
        }
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
        glyphCheckTable[glyphInfo.glyph] = `${ch} ${String.fromCharCode(glyphInfo.symbol)}`;
        // console.log("NH Glyph:", glyphInfo.glyph, ch);
        if (!d.USE_GLYPH) { //ASCII CH MODE
            this.mvwaddch(dsp, y, x, ch);
            this.mvwaddch(d.DSP_MAIN_FG, y, x, ch);
        } else {
            this.mvwaddch(d.DSP_MAIN, y, x, String.fromCharCode(glyphInfo.glyph + d.GLYPH_BASE));
            //this.mvwaddch(d.DSP_MAIN_FG, y, x, String.fromCharCode(glyphInfo.glyph + d.GLYPH_BASE));
        }
    };
    this.nhClear = function (windowId) {
        const dsp = this.nhWindowMap[windowId] || d.DSP_MAIN_FG; //console.log("nlclear:"+dsp);
        if (dsp == d.DSP_MAIN) { this.wclear(d.DSP_MAIN_FG); return };
        if (dsp == d.DSP_MESSAGE) { this.wclear(d.DSP_MAIN_FG); return };
        if (Boolean(dsp)) this.wclear(dsp);
    };
    this.nhCliparound = function (x, y) {
        if (d.USE_GLYPH) {//glyph use 
            let buff = g.console[d.DSP_MAIN].buffer;
            for (let i in buff) {
                let replacedString = buff[i].replace(/\s/g, '　');//全角Space
                buff[i] = replacedString;
            }
            return;
        }
        let ch = this.mvinch(y, x);
        this.mvwaddch(d.DSP_MAIN_FG, y, x, ch);
        bcurpos.x = x;
        bcurpos.y = y;
    }

    this.nhBell = function () {
        this.setEffect(`bell`, { x: bcurpos.x, y: bcurpos.y }, { x: bcurpos.x, y: bcurpos.y - 1 }, 120);
        this.setDsp(d.DSP_COMMENT);
        this.clear();
        this.move(0, 0);
        glyphCheckTable.forEach((value, index) => {
            this.printw(`${index}:${value}`);
            this.cursorDown();
        });
    }

    this.showMenu = function (items, how, promptText) {
        const menuDsp = d.DSP_WINDOW;
        const numLines = d.LINES || 24;
        const pageSize = numLines - 2;

        if (how == 0) {  //view only menu (nocursor)
            return new Promise((resolve) => {
                let currentPage = 0;
                const totalPages = Math.ceil(items.length / pageSize);

                const render = () => {
                    this.wclear(menuDsp);
                    const pageInfo = totalPages > 1 ? ` (Page ${currentPage + 1}/${totalPages})` : "";
                    this.mvwaddch(menuDsp, 0, 0, promptText + pageInfo);

                    const start = currentPage * pageSize;
                    const end = Math.min(start + pageSize, items.length);
                    for (let i = start; i < end; i++) {
                        this.mvwaddch(menuDsp, (i - start) + 1, 0, ` ${items[i].str}`);
                    }

                    if (totalPages > 1) {
                        this.mvwaddch(menuDsp, Math.min(pageSize + 1, items.length + 1), 0, "-- More -- (Space/j for next, b/k for prev)");
                    }
                };

                render();

                const originalHandler = r.pendingInputResolve;
                const handler = (charCode) => {
                    const key = String.fromCharCode(charCode).toLowerCase();

                    if (key === ' ' || key === 'j' || charCode === 13) { // Space, j, Enter: 次へ
                        if (currentPage < totalPages - 1) {
                            currentPage++;
                            render();
                            r.pendingInputResolve = handler;
                        } else {
                            this.overlapview(false);
                            resolve([]);
                            r.pendingInputResolve = originalHandler;
                        }
                    } else if (key === 'b' || key === 'k') { // b, k: 前へ
                        if (currentPage > 0) {
                            currentPage--;
                            render();
                            r.pendingInputResolve = handler;
                        } else {
                            r.pendingInputResolve = handler;
                        }
                    } else if (charCode === 27) { // ESC: キャンセル
                        this.overlapview(false);
                        resolve([]);
                        r.pendingInputResolve = originalHandler;
                    } else {
                        r.pendingInputResolve = handler;
                    }
                };
                r.pendingInputResolve = handler;
            });
        } else { //select menu
            return new Promise((resolve) => {
                let cf = false; //full cursor mode '?'menu 
                items.forEach((item) => { if (item.ch != "\u0000" && item.ch != 0) cf = true; }); //inventory
                items.forEach((item) => { if (item.ch == "?" || item.ch == 63) cf = false; }); //Option menu

                const cancelitem = (cf) ? "\u0000" : false;

                let selectedIndex = 0;
                if (items[selectedIndex] && (items[selectedIndex].ch == cancelitem || items[selectedIndex].ch == 0)) {
                    do {
                        selectedIndex = (selectedIndex + 1) % items.length;
                    } while (selectedIndex < items.length && (items[selectedIndex].ch == cancelitem || items[selectedIndex].str == ""));
                }

                const totalPages = Math.ceil(items.length / pageSize);

                const render = () => {
                    const currentPage = Math.floor(selectedIndex / pageSize);
                    this.wclear(menuDsp);
                    const pageInfo = totalPages > 1 ? ` (Page ${currentPage + 1}/${totalPages})` : "";
                    this.mvwaddch(menuDsp, 0, 0, promptText + pageInfo);

                    const start = currentPage * pageSize;
                    const end = Math.min(start + pageSize, items.length);
                    for (let i = start; i < end; i++) {
                        const item = items[i];
                        const prefix = (i === selectedIndex) ? "> " : "  ";
                        const charStr = (item.identifier !== 0) ? (typeof item.ch === 'string' ? item.ch : String.fromCharCode(item.ch)) + ")": " ";
                        const glyph = (item.glyph) ? (((item.glyph.glyph > 255) && (item.glyph.glyph < 4000)) ? String.fromCharCode(item.glyph.glyph + d.GLYPH_BASE) : " "):" ";

                        this.mvwaddch(menuDsp, (i - start) + 1, 0, `${prefix}${charStr}${glyph}${item.str}`);
                    }


                    if (totalPages > 1) {
                        this.mvwaddch(menuDsp, Math.min(pageSize + 1, (end - start) + 1), 0, "-- More -- (Space/> for next, b/< for prev)");
                    }
                };

                render();

                const originalHandler = r.pendingInputResolve;
                const handler = (charCode) => {
                    const key = String.fromCharCode(charCode).toLowerCase();
                    const totalItems = items.length;

                    // 移動: j, k
                    if (key === 'j') {
                        do {
                            selectedIndex = (selectedIndex + 1) % totalItems;
                        } while (items[selectedIndex].identifier == 0);
                        render();
                        r.pendingInputResolve = handler;
                    } else if (key === 'k') {
                        do {
                            selectedIndex = (selectedIndex - 1 + totalItems) % totalItems;
                        } while (items[selectedIndex].identifier == 0);
                        render();
                        r.pendingInputResolve = handler;
                    } else if (key === ' ' || key === '>') { // Space, >: 次のページ
                        selectedIndex = Math.min(selectedIndex + pageSize, totalItems - 1);
                        render();
                        r.pendingInputResolve = handler;
                    } else if (key === 'b' || key === '<') { // b, <: 前のページ
                        selectedIndex = Math.max(selectedIndex - pageSize, 0);
                        render();
                        r.pendingInputResolve = handler;
                    } else if (charCode === 13) { // Enter: 決定
                        this.overlapview(false);
                        resolve([items[selectedIndex]]);
                        r.pendingInputResolve = originalHandler;
                    } else if (charCode === 27) { // ESC: キャンセル
                        this.overlapview(false);
                        resolve([]);
                        r.pendingInputResolve = originalHandler;
                    } else {
                        // ショートカットキーによる直接選択
                        const hit = items.find(it => it.ch === String.fromCharCode(charCode));
                        if (hit) {
                            resolve([hit]);
                            r.pendingInputResolve = originalHandler;
                        } else {
                            r.pendingInputResolve = handler;
                        }
                    }
                };
                r.pendingInputResolve = handler;
            });
        }
    };

    this.showInput = function (query) {
        return new Promise((resolve) => {
            console.log("Showing input prompt:", query);
            // 簡易的な入力実装（ブラウザのプロンプトを使用）
            const input = prompt(query);
            this.msg(`${query} ${input}`);
            resolve(input);
        });
    };

    /**
     * テキストデータを全画面（DSP_WINDOW）に表示する（ページ送り対応）
     * @param {string} title 
     * @param {string} content 
     */
    this.showText = function (title, content) {
        const lines = content.split('\n');
        const numLines = d.LINES || 24;
        const pageSize = numLines - 2;
        const pages = [];

        if (pageSize <= 0) {
            pages.push(lines);
        } else {
            for (let i = 0; i < lines.length; i += pageSize) {
                pages.push(lines.slice(i, i + pageSize));
            }
        }

        return new Promise(async (resolve) => {
            let currentPage = 0;
            const menuDsp = d.DSP_WINDOW;

            const renderPage = (pageIdx) => {
                const pageLines = pages[pageIdx] || [];
                this.wclear(menuDsp);
                const pageInfo = ` (Page ${pageIdx + 1}/${pages.length})`;
                this.mvwaddch(menuDsp, 0, 0, title + pageInfo);

                pageLines.forEach((line, i) => {
                    this.mvwaddch(menuDsp, i + 1, 0, line);
                });

                if (pages.length > 1) {
                    this.mvwaddch(menuDsp, pageSize + 1, 0, "-- More -- (Space/j for next, b/k for prev)");
                }
            };

            const originalHandler = r.pendingInputResolve;
            const handler = (charCode) => {
                const key = String.fromCharCode(charCode).toLowerCase();

                if (key === ' ' || key === 'j' || charCode === 13) { // Space, j, Enter: 次へ
                    if (currentPage < pages.length - 1) {
                        currentPage++;
                        renderPage(currentPage);
                        r.pendingInputResolve = handler;
                    } else {
                        this.overlapview(false);
                        resolve();
                        r.pendingInputResolve = originalHandler;
                    }
                } else if (key === 'b' || key === 'k') { // b, k: 前へ
                    if (currentPage > 0) {
                        currentPage--;
                        renderPage(currentPage);
                        r.pendingInputResolve = handler;
                    } else {
                        r.pendingInputResolve = handler;
                    }
                } else if (charCode === 27) { // ESC: 閉じる
                    this.overlapview(false);
                    resolve();
                    r.pendingInputResolve = originalHandler;
                } else {
                    r.pendingInputResolve = handler;
                }
            };

            this.overlapview(true);
            renderPage(currentPage);
            r.pendingInputResolve = handler;
        });
    };



    let statusFields = [];
    for (let i = 0; i < 24; i++) {
        statusFields.push({ value: 0 });
    }
    this.updateStatus = function (fld, value, chg, clr) {

        if (fld <= d.BL_FLASH) {
            this.renderStatus();
            this.debugStatus();
            return;
        }

        if (fld == d.BL_DLEVEL) {
            //`BL_LEVELDESC` | 現在の階層 (Dlevel) が変更されるタイミング
            if (statusFields[d.BL_DLEVEL].value != value) {
                this.wclear(d.DSP_MAIN);
                if (d.USE_GLYPH){
                    for (let i = 0; i < 25; i++) {
                        this.waddstr(d.DSP_MAIN, "　".repeat(80));
                    }
                }
            }
        }
        if (fld == d.BL_VERS) {
            //`BL_VERS` | バージョン情報が変更されるタイミング
            r.set_nhVersion(value);
            console.log("Nethack ver:", value);
        }
        statusFields[fld] = { value: value, chg: chg, clr: clr };
    };

    this.renderStatus = function () {
        const statusDsp = d.DSP_STATUS;
        const s = d.STAT_FLD;
        const sf = [];

        this.wclear(statusDsp);
        statusFields.forEach((field, index) => {
            if (field) {
                sf[Number(index)] = field.value;
            }
        });

        let splitwork = sf[s.GOLD].split(":");
        const goldGlyphId = parseInt(splitwork[0].slice(7), 16) || 3883; // Default to gold piece if parsing fails
        const glyphId = String.fromCharCode(goldGlyphId + d.GLYPH_BASE);
        const GOLD = `${glyphId}${splitwork[1]}`;

        this.mvwaddstr(statusDsp, 0, 0,
            `${sf[s.TITLE]} St:${sf[s.STR]} Dx:${sf[s.DEX]} Co:${sf[s.CON]} In:${sf[s.INT]} Wi:${sf[s.WIS]} Ch:${sf[s.CHA]}`
        );
        this.mvwaddstr(statusDsp, 1, 0,
            `${sf[s.ALIGN]} $:${GOLD} HP:${sf[s.HP]}(${sf[s.HPMAX]}) Pw:${sf[s.ENE]}(${sf[s.ENEMAX]}) AC:${sf[s.AC]} Exp:${sf[s.XP]}/${sf[s.EXP]} ${sf[s.HUNGER]}`
        );
        this.mvwaddstr(statusDsp, 2, 0,
            `${sf[s.DLEVEL]} T:${sf[s.TIME]} ${sf[s.CAP]} ${conditionString(sf[s.CONDITION])}`
        );
    };

    this.debugStatus = function () {
        const statusDsp = d.DSP_MODE;
        this.wclear(statusDsp);
        let line = [];
        statusFields.forEach((field, index) => {
            if (field) {
                line.push(`${index}:${field.value} `);
            }
        });
        for (let i in line) {
            this.mvwaddstr(statusDsp, i, 0, line[i]);
        }

        if (Boolean(statusFields[22])) {
            const list = conditionCheck(statusFields[22].value);
            for (let i in list) {
                this.mvwaddstr(statusDsp, Number(i) + 10, 20, list[i]);
            }
        }
    }

    function conditionString(condvalue) {
        const CDT = d.CONDITION;
        let str = "";

        for (let i in CDT) {
            str += `${(condvalue & CDT[i]) ? `${i} ` : ""}`;
        }
        return str;
    }

    function conditionCheck(condvalue) {
        const CDT = d.CONDITION;
        let list = [];

        for (let i in CDT) {
            list.push(`${(condvalue & CDT[i]) ? "o" : "-"}:${i}`);
        }
        return list;
    }
    /**
     * NetHack の C側定数に基づいてタイルマッピングを更新します。
     * @param {object} offsets 
     */
    this.updateTileMapping = function (offsets) {
        console.log("UIManager: Updating tile mapping with offsets", offsets);
        const newMapping = tileMapping(offsets);
        if (g.kanji && typeof g.kanji.setMappingTable === 'function') {
            g.kanji.setMappingTable(newMapping);
            console.log("UIManager: Tile mapping updated in rendering engine.");
        } else {
            console.warn("UIManager: Rendering engine (g.kanji) not ready for mapping update.");
        }
    };

}