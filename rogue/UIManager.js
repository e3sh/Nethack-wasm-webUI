function UIManager(r, g) {

    const d = r.define;
    const f = r.func;
    const t = r.types;
    const v = r.globalValiable;
    //const ms = r.messages;

    //const m = document.getElementById("memo");
    let dspmode = 0;
    this.texwork = "";

    this.io = new io(r, g);
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
    this.setBarEffect = function (hp, max) {
        sceneC.barEffect.set(hp, max);
    };

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
    this.setCameraAdjY = function (num) {
        sceneC.setCameraAdjY(num);
    }
    this.setVScroll = (b) => { d.V_SCROLL = b; }

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

    /**
     * 入力中のテキストをメッセージエリアの最上行に表示する
     * @param {string} text 
     */
    this.updateInputLine = (text) => {
        const msgConsole = g.console[d.DSP_MESSAGE];
        if (msgConsole) {
            msgConsole.move(0, 0);
            // 行をクリア（空白で上書き）
            msgConsole.printw(" ".repeat(d.COLS || 80));
            msgConsole.move(0, 0);
            msgConsole.printw(text);

            // カーソル位置を入力の末尾に移動
            let cl = 0;
            for (let i = 0; i < text.length; i++) {
                cl += (text.charCodeAt(i) < 128) ? 1 : 2;
            }
            msgConsole.move(cl, 0);
        }
    }

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
        const result = this.trancelate.message(text);
        this.setDsp(d.DSP_MESSAGE);
        this.msg(result);
    };

    this.nhPutMsg = function (text) {
        const ioState = g.task.read("io");
        const dsp = (ioState && ioState.overlapview) ? d.DSP_WINDOW : d.DSP_MAIN_FG;
        const result = this.trancelate.message(text);
        this.setDsp(dsp);
        this.printw(result);
        this.cursorDown();
    }

    let txtbufs = {};
    this.nhPutbufReady = (windowId) => {
        if (windowId === undefined) {
            return Object.values(txtbufs).some(buf => buf && buf.length > 0);
        }
        return (txtbufs[windowId] && txtbufs[windowId].length > 0) ? true : false;
    }
    this.nhPutbufClear = (windowId) => {
        if (windowId === undefined) {
            txtbufs = {};
        } else {
            txtbufs[windowId] = [];
        }
    }
    this.nhPutbufAdd = (windowId, text, prompt) => {
        const result = this.trancelate.message(text);
        if (!Boolean(prompt)) prompt = "";

        if (windowId <= 3)
            this.msg(`${result} ${prompt}`);
        else {
            if (!txtbufs[windowId]) {
                txtbufs[windowId] = [];
            }
            txtbufs[windowId].push(`${result} ${prompt}`);
        }
    };
    this.nhPutbufDraw = (windowId) => {
        const dsp = this.nhWindowMap[windowId] || d.DSP_WINDOW;
        const buf = txtbufs[windowId] || [];

        for (let line = 0; line < buf.length; line++) {
            this.mvwaddch(dsp, line, 0, buf[line]);
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
            //minimap
            this.mvwaddch(d.DSP_MODE, y, x, ch);
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
            this.setCameraEnable(true);
            let sx = x;
            let sy = d.LINES / 2;
            if (d.V_SCROLL) {
                sy = y;
            }
            this.setCameraPos({ x: sx, y: sy });
            this.wmove(d.DSP_MAIN, y, x);
            return;
        }
        this.setCameraEnable(false);
        this.setCameraCenter();
        let ch = this.mvinch(y, x);
        this.mvwaddch(d.DSP_MAIN_FG, y, x, ch);
        bcurpos.x = x;
        bcurpos.y = y;
    }

    this.nhBell = function () {
        this.setEffect(`bell`, { x: bcurpos.x, y: bcurpos.y }, { x: bcurpos.x, y: bcurpos.y - 1 }, 120);
        //this.setDsp(d.DSP_COMMENT);
        //this.clear();
        //this.move(0, 0);
        //gyphCheckTable.forEach((value, index) => {
        //   this.printw(`${index}:${value}`);
        //    this.cursorDown();
        //});
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
                    const pText = this.trancelate.message(promptText);
                    this.mvwaddch(menuDsp, 0, 0, pText + pageInfo);

                    const start = currentPage * pageSize;
                    const end = Math.min(start + pageSize, items.length);
                    for (let i = start; i < end; i++) {
                        const textStr = this.trancelate.message(items[i].str);
                        this.mvwaddch(menuDsp, (i - start) + 1, 0, ` ${textStr}`);
                    }

                    if (totalPages > 1) {
                        this.mvwaddch(menuDsp, Math.min(pageSize + 1, items.length + 1), 0, "-- More -- (Space/2 for next, 8 for prev)");

                    }
                };
                render();

                const originalHandler = r.pendingInputResolve;
                const handler = (charCode) => {
                    const key = String.fromCharCode(charCode).toLowerCase();

                    if (key === ' ' || key === '2' || charCode === 13) { // Space, j, Enter: 次へ
                        if (currentPage < totalPages - 1) {
                            currentPage++;
                            render();
                            r.pendingInputResolve = handler;
                        } else {
                            this.overlapview(false);
                            resolve([]);
                            r.pendingInputResolve = originalHandler;
                        }
                    } else if (key === '8' || key === '8') { // b, k: 前へ
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
                    const pText = this.trancelate.message(promptText);
                    this.mvwaddch(menuDsp, 0, 0, pText + pageInfo);

                    const start = currentPage * pageSize;
                    const end = Math.min(start + pageSize, items.length);
                    for (let i = start; i < end; i++) {
                        const item = items[i];
                        const prefix = (i === selectedIndex) ? "> " : "  ";
                        const charStr = (item.identifier !== 0 && item.ch != String.fromCharCode(0)) ? (typeof item.ch === 'string' ? item.ch : String.fromCharCode(item.ch)) + ")" : " ";
                        const glyph = (item.glyph) ? (((item.glyph.glyph > 255) && (item.glyph.glyph < 4000)) ? String.fromCharCode(item.glyph.glyph + d.GLYPH_BASE) : " ") : " ";
                        const textStr = this.trancelate.message(item.str);
                        const guide = (item.identifier == 0 && item.str != "" ? "#":"");
                        this.mvwaddch(menuDsp, (i - start) + 1, 0, `${prefix}${charStr}${glyph}${guide}${textStr}`);
                    }


                    if (totalPages > 1) {
                        this.mvwaddch(menuDsp, Math.min(pageSize + 1, (end - start) + 1), 0, "-- More -- (Space/> for next, 4/< for prev)");
                    }
                };

                render();

                const originalHandler = r.pendingInputResolve;
                const handler = (charCode) => {
                    const key = String.fromCharCode(charCode).toLowerCase();
                    const totalItems = items.length;

                    // 移動: j, k
                    if (key === '2') { //
                        do {
                            selectedIndex = (selectedIndex + 1) % totalItems;
                        } while (items[selectedIndex].identifier == 0);
                        render();
                        r.pendingInputResolve = handler;
                    } else if (key === '8') { //
                        do {
                            selectedIndex = (selectedIndex - 1 + totalItems) % totalItems;
                        } while (items[selectedIndex].identifier == 0);
                        render();
                        r.pendingInputResolve = handler;
                    } else if (key === ' ' || key === '>') { // Space, >: 次のページ
                        selectedIndex = Math.min(selectedIndex + pageSize, totalItems - 1);
                        render();
                        r.pendingInputResolve = handler;
                    } else if (key === '4' || key === '<') { // b, <: 前のページ
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
            //console.log("Showing input prompt:", query);
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
                    this.mvwaddch(menuDsp, pageSize + 1, 0, "-- More -- (Space/2 for next, 8 for prev)");
                }
            };

            const originalHandler = r.pendingInputResolve;
            const handler = (charCode) => {
                const key = String.fromCharCode(charCode).toLowerCase();

                if (key === ' ' || key === '2' || charCode === 13) { // Space, j, Enter: 次へ
                    if (currentPage < pages.length - 1) {
                        currentPage++;
                        renderPage(currentPage);
                        r.pendingInputResolve = handler;
                    } else {
                        this.overlapview(false);
                        resolve();
                        r.pendingInputResolve = originalHandler;
                    }
                } else if (key === '8') { // b, k: 前へ
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

    this.updateStatus = this.io.updateStatus;

    /**
     * NetHack の C側定数に基づいてタイルマッピングを更新します。
     * @param {object} offsets 
     */
    this.updateTileMapping = function (offsets) {
        //console.log("UIManager: Updating tile mapping with offsets", offsets);
        const newMapping = tileMapping(offsets);
        if (g.kanji && typeof g.kanji.setMappingTable === 'function') {
            g.kanji.setMappingTable(newMapping);
            //console.log("UIManager: Tile mapping updated in rendering engine.");
        } else {
            //console.warn("UIManager: Rendering engine (g.kanji) not ready for mapping update.");
        }
    }

    /**
     * ゲームオーバー時に墓石とスコアを半透明ガラスモーフィズムでポップアップ表示します。
     * @param {object} data 
     * @param {array} topTen 
     * @returns {Promise} 閉じられるとresolveされます。
     */
    this.showGameOverModal = function (data, topTen) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.id = 'gameover-overlay';
            overlay.style = `
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.4s ease;
                font-family: 'Courier New', Courier, monospace;
                color: #e0e0e0;
            `;

            const card = document.createElement('div');
            card.style = `
                background: rgba(25, 25, 25, 0.7);
                border: 2px solid;
                border-image: linear-gradient(135deg, #d4af37, #85581A, #d4af37) 1;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8), 0 0 15px rgba(212, 175, 55, 0.2);
                border-radius: 4px;
                padding: 30px;
                width: 90%;
                max-width: 500px;
                text-align: center;
                transform: scale(0.9);
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            `;

            const ripHeader = document.createElement('pre');
            ripHeader.style = `
                font-size: 10px;
                line-height: 1.2;
                color: #a0a0a0;
                margin-bottom: 15px;
                user-select: none;
            `;
            ripHeader.textContent = [
                "       .-----------------.",
                "      /   R. I. P.        \\",
                "     /                     \\",
                "    |   Here lies a hero   |",
                "    |                      |",
                "     \\                    /",
                "      '------------------'"
            ].join('\n');

            const title = document.createElement('h2');
            title.textContent = "GAME OVER";
            title.style = `
                color: #ff4d4d;
                font-size: 24px;
                letter-spacing: 3px;
                margin-bottom: 20px;
                font-weight: bold;
                text-shadow: 0 0 8px rgba(255, 77, 77, 0.5);
            `;

            const stats = document.createElement('div');
            stats.style = `
                text-align: left;
                background: rgba(0, 0, 0, 0.4);
                padding: 15px;
                border-radius: 4px;
                margin-bottom: 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 14px;
                line-height: 1.6;
            `;

            const formatVal = (val) => val !== undefined && val !== null ? val : "???";
            const roleStr = `${formatVal(data.role)}-${formatVal(data.race)}-${formatVal(data.gender)}-${formatVal(data.align)}`;

            stats.innerHTML = `
                <div style="margin-bottom: 8px;"><span style="color: #888;">Name  :</span> <span style="color: #fff; font-weight: bold;">${formatVal(data.name)}</span></div>
                <div style="margin-bottom: 8px;"><span style="color: #888;">Class :</span> <span style="color: #fff;">${roleStr}</span></div>
                <div style="border-top: 1px dashed rgba(255,255,255,0.1); margin: 8px 0;"></div>
                <div style="margin-bottom: 8px;"><span style="color: #888;">Score :</span> <span style="color: #ffd700; font-weight: bold; font-size: 16px;">${typeof data.points === 'number' ? data.points.toLocaleString() : formatVal(data.points)} points</span></div>
                <div style="margin-bottom: 8px;"><span style="color: #888;">Depth :</span> <span style="color: #e0e0e0;">Dlevel ${formatVal(data.deathLev)} (Max: ${formatVal(data.maxLvl)})</span></div>
                <div style="margin-bottom: 8px;"><span style="color: #888;">HP    :</span> <span style="color: #ff6b6b;">${formatVal(data.hp)} / ${formatVal(data.maxHp)}</span></div>
                <div style="border-top: 1px dashed rgba(255,255,255,0.1); margin: 8px 0;"></div>
                <div style="margin-top: 8px; line-height: 1.4;"><span style="color: #888;">Fate  :</span> <span style="color: #ff4d4d; font-weight: bold; font-style: italic;">${formatVal(data.death)}</span></div>
            `;

            card.appendChild(ripHeader);
            card.appendChild(title);
            card.appendChild(stats);

            // スコアランキング表示部
            if (topTen && topTen.length > 0) {
                const rankingTitle = document.createElement('h3');
                rankingTitle.textContent = "TOP 10 HIGH SCORES";
                rankingTitle.style = `
                    color: #ffd700;
                    font-size: 13px;
                    letter-spacing: 2px;
                    margin-top: 20px;
                    margin-bottom: 8px;
                    text-align: left;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                    padding-bottom: 5px;
                    font-weight: bold;
                `;
                card.appendChild(rankingTitle);

                const table = document.createElement('table');
                table.style = `
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                    color: #a0a0a0;
                    margin-bottom: 20px;
                    text-align: left;
                `;

                table.innerHTML = `
                    <thead>
                        <tr style="color: #ffd700; border-bottom: 1px solid rgba(255,255,255,0.15);">
                            <th style="padding: 4px; width: 10%;">Rank</th>
                            <th style="padding: 4px; width: 25%;">Name</th>
                            <th style="padding: 4px; width: 25%; text-align: right;">Score</th>
                            <th style="padding: 4px; width: 40%;">Fate</th>
                        </tr>
                    </thead>
                    <tbody>
                    </tbody>
                `;

                const tbody = table.querySelector('tbody');
                topTen.forEach((item, index) => {
                    const tr = document.createElement('tr');
                    tr.style = `
                        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                        background: ${index === 0 ? 'rgba(212, 175, 55, 0.05)' : 'none'};
                    `;
                    
                    const rankColor = index === 0 ? '#ffd700' : (index === 1 ? '#c0c0c0' : (index === 2 ? '#cd7f32' : '#a0a0a0'));
                    
                    tr.innerHTML = `
                        <td style="padding: 4px; font-weight: bold; color: ${rankColor};">${index + 1}</td>
                        <td style="padding: 4px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">${formatVal(item.name)}</td>
                        <td style="padding: 4px; text-align: right; color: #ffd700; font-weight: bold;">${item.points.toLocaleString()}</td>
                        <td style="padding: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;" title="${formatVal(item.death)}">${formatVal(item.death)}</td>
                    `;
                    tbody.appendChild(tr);
                });
                
                card.appendChild(table);
            }

            const button = document.createElement('button');
            button.textContent = "TAP TO REPLAY";
            button.style = `
                background: linear-gradient(135deg, #d4af37, #85581A);
                border: none;
                color: white;
                padding: 12px 30px;
                font-size: 14px;
                font-family: inherit;
                font-weight: bold;
                letter-spacing: 2px;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
                transition: transform 0.1s, box-shadow 0.2s;
                outline: none;
                border-radius: 4px;
            `;

            button.onmouseover = () => {
                button.style.transform = "scale(1.03)";
                button.style.boxShadow = "0 6px 20px rgba(212, 175, 55, 0.6)";
            };
            button.onmouseout = () => {
                button.style.transform = "scale(1)";
                button.style.boxShadow = "0 4px 15px rgba(212, 175, 55, 0.4)";
            };
            button.onmousedown = () => {
                button.style.transform = "scale(0.97)";
            };

            const cleanup = () => {
                overlay.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 400);
            };

            button.onclick = cleanup;
            overlay.onclick = (e) => {
                if (e.target === overlay) cleanup();
            };

            card.appendChild(button);
            overlay.appendChild(card);
            document.body.appendChild(overlay);

            setTimeout(() => {
                overlay.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }, 50);
        });
    };
}