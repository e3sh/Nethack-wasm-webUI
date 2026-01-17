function GameManager(g) {

    const d = rogueDefines();
    const f = rogueFuncs();
    const t = rogueTypes();
    const v = {};//globalValiableInit();

    //let lang;
    //if (Boolean(localStorage.getItem("rogue.lang"))) {
    //    lang = localStorage.getItem("rogue.lang");
    //}

    //const ms = (lang == "jp") ? rogueMessage_jp(this) : rogueMessage(this);

    //props

    this.define = d;
    this.func = f;
    this.types = t;
    this.globalValiable = {};//v;
    //this.messages = ms;



    for (let i in this.globalValiable) {
        //    this.UI.msg(`${i}: ${this.globalValiable[i].length}`);
    }
    for (let i in this.define) {
        //    this.UI.msg(`${i}: ${this.define[i]}`);
    }

    this.UI = new UIManager(this, g);

    this.playing = false;
    const r = this;

    //this.qs = new quick_storage(r);

    this.UI.comment("game");

    // --- NetHack Wasm Integration ---
    let nhVersion = "";
    this.set_nhVersion = (v) => { nhVersion = v; }
    this.get_nhVersion = () => { return nhVersion; }
    this.pendingInputResolve = null;
    this.menuBuffer = {}; // windowId -> items[]
    this.messageHistory = [];
    this.historyIndex = 0;

    this.setupNethackGlobal = function () {
        if (typeof window === 'undefined') return;
        window.nethackGlobal = window.nethackGlobal || {};
        window.nethackGlobal.helpers = window.nethackGlobal.helpers || {};

        const helpers = window.nethackGlobal.helpers;

        const makeSticky = (name, fn) => {
            Object.defineProperty(helpers, name, {
                get: function () { return fn; },
                set: function (val) {
                    // console.log(`GameManager: blocking attempt to overwrite helper ${name}`);
                },
                configurable: true,
                enumerable: true
            });
        };

        // Patching getPointerValue
        makeSticky('getPointerValue', function (name, ptr, type) {
            if (type === 'v') return null;
            if (type === 'i') return Module.getValue(ptr, 'i32');
            if (type === 's') return Module.UTF8ToString(ptr);
            if (type === 'b') return !!Module.getValue(ptr, 'i8');
            if (type === 'c' || type === '0') return String.fromCharCode(Module.getValue(ptr, 'i8'));
            if (type === '1') return Module.getValue(ptr, 'i16'); // coordxy
            if (type === 'p') return ptr;
            return ptr;
        });

        // Patching setPointerValue (The most critical fix)
        makeSticky('setPointerValue', function (name, ret_ptr, type, value) {
            if (!ret_ptr) return;
            if (type === 'i') {
                Module.setValue(ret_ptr, value, 'i32');
            } else if (type === 'b') {
                Module.setValue(ret_ptr, value ? 1 : 0, 'i8');
            } else if (type === 'c') {
                Module.setValue(ret_ptr, typeof value === 'string' ? value.charCodeAt(0) : value, 'i8');
            } else if (type === '1' || type === '2') {
                Module.setValue(ret_ptr, value, 'i16');
            } else if (type === 's') {
                if (value === null || value === undefined) {
                    Module.setValue(ret_ptr, 0, 'i32');
                } else if (typeof value === 'string') {
                    let ptr = Module._malloc(value.length + 1);
                    Module.stringToUTF8(value, ptr, value.length + 1);
                    Module.setValue(ret_ptr, ptr, 'i32');
                } else {
                    throw new TypeError("expected " + name + " return type to be string, got " + (typeof value));
                }
            } else if (type === 'p') {
                Module.setValue(ret_ptr, value, 'i32');
            }
        });

        makeSticky('parseGlyphInfo', function (ptr) {
            if (!ptr) return null;
            // NetHack 3.7 glyph_info structure offsets
            const GLYPH_OFFSET = 0;
            const TTYCHAR_OFFSET = 4;
            const FRAMECOLOR_OFFSET = 8;
            const GM_OFFSET = 12; // glyph_map starts here

            const GM_FLAGS_OFFSET = GM_OFFSET + 0;
            const GM_COLOR_OFFSET = GM_OFFSET + 4;
            const GM_SYMIDX_OFFSET = GM_OFFSET + 8;
            const GM_U_OFFSET = GM_OFFSET + 20; // pointer to unicode_representation (if ENHANCED_SYMBOLS)

            let glyph = Module.getValue(ptr + GLYPH_OFFSET, 'i32');
            let symbol = Module.getValue(ptr + TTYCHAR_OFFSET, 'i32');
            let framecolor = Module.getValue(ptr + FRAMECOLOR_OFFSET, 'i32');

            let flags = Module.getValue(ptr + GM_FLAGS_OFFSET, 'i32');
            let color = Module.getValue(ptr + GM_COLOR_OFFSET, 'i32');
            let symidx = Module.getValue(ptr + GM_SYMIDX_OFFSET, 'i32');

            // Check for Unicode string
            let ch = String.fromCharCode(symbol);
            let uPtr = Module.getValue(ptr + GM_U_OFFSET, 'i32');
            if (uPtr) {
                let utf8strPtr = Module.getValue(uPtr + 4, 'i32'); // offset of utf8str in unicode_representation
                if (utf8strPtr) {
                    ch = Module.UTF8ToString(utf8strPtr);
                }
            }

            return { glyph, symbol, framecolor, flags, color, symidx, ch };
        });

        window.nethackGlobal.helpers.isPatched = true;
        console.log("GameManager: nethackGlobal.helpers sticky-patched.");
    };

    this.eventHook = async function (type, ...args) {
        // Ensure helpers are not overwritten by Wasm's internal js_helpers_init
        if (!window.nethackGlobal.helpers.isPatched) {
            this.setupNethackGlobal();
            window.nethackGlobal.helpers.isPatched = true;
        }
        const helpers = window.nethackGlobal.helpers;

        let NotImplemented = false;

        //console.log("NH Event:", type, args);
        this.UI.comment(`NH Event: ${type.slice(5)} `);

        switch (type) {
            //VDECLCB(shim_init_nhwindows,(int *argcp, char **argv), "vpp", P2V argcp, P2V argv)
            case "shim_init_nhwindows":
                return 0;
            //DECLCB(boolean, shim_player_selection_or_tty,(void), "b")
            case "shim_player_selection_or_tty":
                //console.log("shim_player_selection_or_tty called. Returning true.");
                return true;
            //VDECLCB(shim_askname,(void), "v")
            case "shim_askname":
                console.log("shim_askname called. Setting plname manually...");
                try {
                    // Wasm の get_plname 関数を呼び出してポインタを取得
                    const plnamePtr = Module._get_plname();
                    if (plnamePtr) {
                        Module.stringToUTF8("player", plnamePtr, 32);
                        console.log("Directly wrote 'player' to plname at:", plnamePtr);
                    } else {
                        console.warn("Could not get plname pointer from _get_plname().");
                    }
                } catch (e) {
                    console.error("plname setup error:", e);
                }
                return 0;
            //VDECLCB(shim_get_nh_event,(void), "v")
            case "shim_get_nh_event":
                // Handle exposure events or system-level updates. 
                // Mostly a no-op for TTY/X-style ports.
                return 0;
            //VDECLCB(shim_exit_nhwindows,(const char *str), "vs", P2V str)
            case "shim_exit_nhwindows":
                //this.playing = false;
                console.log("Exiting nhwindows...");
                this.UI.nhClear(3); // NHW_MAP
                this.UI.clear(d.DSP_MAIN); // NHW_BGMAP
                this.UI.nhCurs(3, 0, 0);
                return 0;
            //VDECLCB(shim_suspend_nhwindows,(const char *str), "vs", P2V str)
            case "shim_suspend_nhwindows":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_resume_nhwindows,(void), "v")
            case "shim_resume_nhwindows":
                console.log("Not implemented");
                return 0;
            //DECLCB(winid, shim_create_nhwindow, (int type), "ii", A2P type)
            case "shim_create_nhwindow":
                this.UI.nhPutbufClear();
                this.UI.nhClear(args[0]);
                this.UI.set_display_window(args[0]);
                return 0;
            //VDECLCB(shim_clear_nhwindow,(winid window), "vi", A2P window)
            case "shim_clear_nhwindow":
                this.UI.overlapview(false);
                this.UI.nhPutbufClear();
                this.UI.nhClear(args[0]);
                this.UI.set_display_window(args[0]);
                return 0;
            //VDECLCB(shim_display_nhwindow,(winid window, boolean blocking), "vib", A2P window, A2P blocking)
            case "shim_display_nhwindow":
                this.UI.nhPutbufDraw(args[0]);
                if (this.UI.nhPutbufReady()) {
                    this.UI.nhClear(args[0]);
                    this.UI.nhPutbufDraw(args[0]);
                    this.UI.overlapview(true);
                    await new Promise(
                        resolve => {
                            this.pendingInputResolve = resolve;
                        });
                } else {
                    if (args[1])
                        await new Promise(
                            resolve => {
                                this.pendingInputResolve = resolve;
                            });
                }
                return 0;
            //VDECLCB(shim_destroy_nhwindow,(winid window), "vi", A2P window)
            case "shim_destroy_nhwindow":
                this.UI.overlapview(false);
                this.UI.nhPutbufClear();
                this.UI.wclear(d.DSP_WINDOW);
                this.UI.set_display_window(args[0]);
                return 0;
            //VDECLCB(shim_curs,(winid a, int x, int y), "viii", A2P a, A2P x, A2P y)
            case "shim_curs":
                this.UI.nhCurs(args[0], args[1], args[2]);
                break;
            //VDECLCB(shim_putstr,(winid w, int attr, const char *str), "viis", A2P w, A2P attr, P2V str)
            case "shim_putstr":
                //this.UI.nhPutStr(args[0], args[1], args[2]);
                if (args[0] === 1) { // NHW_MESSAGE
                    this.messageHistory.push(args[2]);
                    if (this.messageHistory.length > 200) { // Keep last 200 messages
                        this.messageHistory.shift();
                    }
                }
                this.UI.nhPutbufAdd(args[2]);
                break;
            //VDECLCB(shim_display_file,(const char *name, boolean complain), "vsb", P2V name, A2P complain)
            case "shim_display_file":
                {
                    const filename = args[0];
                    const complain = args[1];
                    const path = `./dat/${filename}`;
                    console.log(`shim_display_file: path=${path}, complain=${complain}`);

                    return new Promise(async (resolve) => {
                        try {
                            // 1. まずは仮想ファイルシステム (VFS) を試す
                            if (typeof FS !== 'undefined' && FS.analyzePath(path).exists) {
                                const data = FS.readFile(path, { encoding: 'utf8' });
                                this.UI.overlapview(true);
                                await this.UI.showText(filename, data);
                                resolve(0);
                                return;
                            }

                            // 2. VFS にない場合はサーバーから fetch して FileReader で読み込む
                            const response = await fetch(path);
                            if (response.ok) {
                                const blob = await response.blob();
                                const reader = new FileReader();
                                reader.onload = async (e) => {
                                    const text = e.target.result;
                                    this.UI.overlapview(true);
                                    await this.UI.showText(filename, text);
                                    resolve(0);
                                };
                                reader.onerror = () => {
                                    if (complain) this.UI.msg(`FileReader error: ${path}`);
                                    resolve(0);
                                };
                                reader.readAsText(blob);
                            } else {
                                if (complain) this.UI.msg(`File not found on server: ${path}`);
                                console.warn(`File not found: ${path}`);
                                resolve(0);
                            }
                        } catch (e) {
                            console.error("shim_display_file error:", e);
                            if (complain) this.UI.msg(`Error loading file: ${filename}`);
                            resolve(0);
                        }
                    });
                }
            //VDECLCB(shim_start_menu,(winid window, unsigned long mbehavior), "vii", A2P window, A2P mbehavior)
            case "shim_start_menu":
                this.menuBuffer[args[0]] = { behavior: args[1], items: [], prompt: "" };
                return 0;
            //VDECLCB(shim_add_menu,
            //    (winid window, const glyph_info *glyphinfo, const ANY_P *identifier, char ch, char gch, int attr, int clr, const char *str, unsigned int itemflags),
            //    "vipi00iisi",
            //    A2P window, P2V glyphinfo, P2V identifier, A2P ch, A2P gch, A2P attr, A2P clr, P2V str, A2P itemflags)
            case "shim_add_menu":
                {
                    const windowId = args[0];
                    if (!this.menuBuffer[windowId]) return 0;
                    const gInfo = args[1] ? helpers.parseGlyphInfo(args[1]) : null;
                    const identifier = args[2];
                    const ch = args[3];
                    const gch = args[4];
                    const attr = args[5];
                    const clr = args[6];
                    const str = args[7];
                    const itemflags = args[8];
                    this.menuBuffer[windowId].items.push({
                        glyph: gInfo,
                        identifier: identifier,
                        ch: ch,
                        gch: gch,
                        attr: attr,
                        clr: clr,
                        str: str,
                        itemflags: itemflags
                    });
                }
                return 0;
            //VDECLCB(shim_end_menu,(winid window, const char *prompt), "vis", A2P window, P2V prompt)
            case "shim_end_menu":
                if (this.menuBuffer[args[0]]) {
                    this.menuBuffer[args[0]].prompt = args[1];
                }
                return 0;
            /* XXX: shim_select_menu menu_list is an output */
            //DECLCB(int, shim_select_menu,(winid window, int how, MENU_ITEM_P **menu_list), "iiip", A2P window, A2P how, P2V menu_list)
            case "shim_select_menu":
                {
                    const windowId = args[0];
                    const how = args[1];
                    const menuListPtrPtr = args[2];
                    const menuData = this.menuBuffer[windowId];

                    if (!menuData) return 0;
                    this.UI.overlapview(true);

                    return new Promise(async (resolve) => {
                        // UI 側にメニュー表示を依頼
                        const selectedItems = await r.UI.showMenu(menuData.items, how, menuData.prompt);

                        if (!selectedItems || selectedItems.length === 0) {
                            resolve(0);
                            return;
                        }

                        // menu_item 構造体のメモリ確保 (mi 構造体は 16バイト)
                        // typedef struct mi { anything item; long count; unsigned itemflags; } menu_item;
                        const ITEM_SIZE = 16;
                        const ptr = Module._malloc(ITEM_SIZE * selectedItems.length);

                        selectedItems.forEach((item, index) => {
                            const offset = ptr + (index * ITEM_SIZE);
                            // anything item (long/pointer) - assuming 4 or 8 bytes depending on Wasm
                            Module.setValue(offset, item.identifier, 'i32');
                            Module.setValue(offset + 8, -1, 'i32'); // count (long)
                            Module.setValue(offset + 12, item.itemflags | 1, 'i32'); // itemflags (SELECTED flag = 1)
                        });

                        // menu_list ポインタ引数の指す先に確保したポインタをセット
                        Module.setValue(menuListPtrPtr, ptr, 'i32');
                        resolve(selectedItems.length);
                    });
                }
            //DECLCB(char, shim_message_menu,(char let, int how, const char *mesg), "ciis", A2P let, A2P how, P2V mesg)
            case "shim_message_menu":
                {
                    const msgLet = args[0];
                    const how = args[1];
                    const mesg = args[2];

                    if (this.messageHistory.length === 0) return 0;

                    this.UI.overlapview(true);
                    return new Promise(async (resolve) => {
                        const historyString = [...this.messageHistory].reverse().join('\n');
                        await this.UI.showText(mesg || "Message History", historyString);
                        this.UI.overlapview(false);
                        resolve(0);
                    });
                }
                return 0;
            //VDECLCB(shim_mark_synch,(void), "v")
            case "shim_mark_synch":
                // Synchronization marker. Empty call is valid for most ports.
                this.UI.msg("Press any key");
                return 0;
            //VDECLCB(shim_wait_synch,(void), "v")
            case "shim_wait_synch":
                // Wait for all pending output to finish.
                // Could be used to flush buffers if necessary.
                return 0;
            //VDECLCB(shim_cliparound,(int x, int y), "vii", A2P x, A2P y)
            case "shim_cliparound":
                // Center map on player if dungeon is larger than window.
                // No-op if map fits or UI handles it independently.
                this.UI.nhCliparound(args[0], args[1]);
                return 0;
            //VDECLCB(shim_update_positionbar,(char *posbar), "vs", P2V posbar)
            case "shim_update_positionbar":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_print_glyph,(winid w, coordxy x, coordxy y, const glyph_info *glyphinfo, const glyph_info *bkglyphinfo), "vi11pp", A2P w, A2P x, A2P y, P2V glyphinfo, P2V bkglyphinfo)
            case "shim_print_glyph":
                {
                    const helpers = window.nethackGlobal.helpers;
                    const gInfo = helpers.parseGlyphInfo(args[3]);
                    const bkInfo = helpers.parseGlyphInfo(args[4]);
                    this.UI.nhPrintGlyph(args[0], args[1], args[2], gInfo, bkInfo);
                }
                break;
            //VDECLCB(shim_raw_print,(const char *str), "vs", P2V str)
            case "shim_raw_print":
                if (args[0]) {
                    this.messageHistory.push(args[0]);
                    if (this.messageHistory.length > 200) this.messageHistory.shift();
                }
                this.UI.nhPutMsg(`${args[0]}`);
                return 0;
            //VDECLCB(shim_raw_print_bold,(const char *str), "vs", P2V str)
            case "shim_raw_print_bold":
                if (args[0]) {
                    this.messageHistory.push(args[0]);
                    if (this.messageHistory.length > 200) this.messageHistory.shift();
                }
                this.UI.nhPutMsg(`${args[0]}`);
                return 0;
            //DECLCB(int, shim_nhgetch,(void), "i")
            case "shim_nhgetch":
                return new Promise(resolve => {
                    this.pendingInputResolve = resolve;
                });
            //DECLCB(int, shim_nh_poskey,(coordxy *x, coordxy *y, int *mod), "ippp", P2V x, P2V y, P2V mod)
            case "shim_nh_poskey":
                return new Promise((resolve) => {
                    r.pendingInputResolve = (charCode, x, y, mod) => {
                        if (x !== undefined && y !== undefined) {
                            Module.setValue(args[0], x, 'i16');
                            Module.setValue(args[1], y, 'i16');
                            Module.setValue(args[2], mod || 0, 'i32');
                            resolve(0); // char 0 for mouse
                        } else {
                            resolve(charCode);
                        }
                    };
                });
            //VDECLCB(shim_nhbell,(void), "v")
            case "shim_nhbell":
                this.UI.nhBell();
                return 0;
            //DECLCB(int, shim_doprev_message,(void),"iv")
            case "shim_doprev_message":
                {
                    if (this.messageHistory.length === 0) return 0;

                    this.UI.overlapview(true);
                    return new Promise(async (resolve) => {
                        const historyString = [...this.messageHistory].reverse().join('\n');
                        await this.UI.showText("Message History", historyString);
                        this.UI.overlapview(false);
                        resolve(0);
                    });
                }
                return 0;
            //DECLCB(char, shim_yn_function,(const char *query, const char *resp, char def), "css0", P2V query, P2V resp, A2P def)
            case "shim_yn_function": {
                let key;
                this.UI.set_display_window(0);
                do {
                    this.UI.nhPutbufAdd(`${args[0]} ${args[1]}`);
                    key = await new Promise(resolve => {
                        this.pendingInputResolve = resolve;
                    });
                }
                while (args[1].includes(String.fromCharCode(key)) === false && args[2] !== "\u0000");

                return key;
            }
            //VDECLCB(shim_getlin,(const char *query, char *bufp), "vsp", P2V query, P2V bufp)
            case "shim_getlin":
                {
                    const query = args[0];
                    const bufp = args[1];
                    return new Promise(async (resolve) => {
                        const input = await r.UI.showInput(query);
                        if (input !== null) {
                            Module.stringToUTF8(input, bufp, 256); // BUFSZ is 256
                        }
                        resolve(0);
                    });
                }
            //DECLCB(int,shim_get_ext_cmd,(void),"iv")
            case "shim_get_ext_cmd": return new Promise(async (resolve) => {
                const input = await r.UI.showInput("#");
                if (!input) {
                    resolve(-1);
                    return;
                }
                const extcmds = d.EXTCMDS;

                const idx = extcmds.indexOf(input.toLowerCase());
                this.UI.msg(`${input.toLowerCase()}->${extcmds[idx]}`);
                resolve(idx >= 0 ? idx : -1);
            });
            //VDECLCB(shim_number_pad,(int state), "vi", A2P state)
            case "shim_number_pad":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_delay_output,(void), "v")
            case "shim_delay_output":
                return new Promise(resolve => setTimeout(resolve, 50));
            //VDECLCB(shim_change_color,(int color, long rgb, int reverse), "viii", A2P color, A2P rgb, A2P reverse)
            case "shim_change_color":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_change_background,(int white_or_black), "vi", A2P white_or_black)
            case "shim_change_background":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_status_update,
            //    (int fldidx, genericptr_t ptr, int chg, int percent, int color, unsigned long *colormasks),
            //    "vipiiip",
            //    A2P fldidx, P2V ptr, A2P chg, A2P percent, A2P color, P2V colormasks)
            case "shim_status_update":
                {
                    const fld = args[0];
                    const ptr = args[1];
                    const chg = args[2];
                    const clr = args[4];
                    let val = null;

                    // fld 22 (BL_CONDITION) はマスク、それ以外は文字列の可能性
                    if (fld === 22) {
                        val = Module.getValue(ptr, 'i32'); // long
                    } else if (ptr) {
                        try {
                            val = Module.UTF8ToString(ptr);
                        } catch (e) {
                            val = Module.getValue(ptr, 'i32');
                        }
                    }
                    this.UI.updateStatus(fld, val, chg, clr);
                }
                return 0;
            //DECLCB(short, set_shim_font_name,(winid window_type, char *font_name),"2is", A2P window_type, P2V font_name)
            case "set_shim_font_name":
                console.log("Not implemented");
                return 0;
            //DECLCB(char *,shim_get_color_string,(void),"sv")
            case "shim_get_color_string":
                console.log("Not implemented");
                return null;
            //VDECLCB(shim_preference_update, (const char *pref), "vp", P2V pref)
            case "shim_preference_update":
                console.log("Not implemented");
                return 0;
            //DECLCB(char *,shim_getmsghistory, (boolean init), "sb", A2P init)
            case "shim_getmsghistory":
                //console.log("shim_getmsghistory called, return null");
                if (args[0]) { // init
                    this.historyIndex = 0;
                }
                if (this.historyIndex < this.messageHistory.length) {
                    const msg = this.messageHistory[this.historyIndex];
                    this.historyIndex++;
                    return msg;
                }
                return null;
            //VDECLCB(shim_putmsghistory, (const char *msg, boolean restoring_msghist), "vsb", P2V msg, A2P restoring_msghist)
            case "shim_putmsghistory":
                if (args[0]) {
                    this.messageHistory.push(args[0]);
                    if (this.messageHistory.length > 200) {
                        this.messageHistory.shift();
                    }
                }
                if (!args[1]) //restoring_msghist
                    this.UI.msg(`${args[0]}`);
                return 0;
            //VDECLCB(shim_status_init, (void), "v")
            case "shim_status_init":
                //console.log("Not implemented");
                return 0;
            //VDECLCB(shim_status_enablefield,
            //    (int fieldidx, const char *nm, const char *fmt, boolean enable),
            //    "vippb",
            //    A2P fieldidx, P2V nm, P2V fmt, A2P enable)
            case "shim_status_enablefield":
                //console.log("Not implemented");
                return 0;
            //VDECLCB(shim_player_selection, (void), "v")
            case "shim_player_selection":
                console.log("Not implemented");
                return 0;

            //VDECLCB(shim_update_inventory,(int a1 UNUSED), "vi", A2P a1)
            case "shim_update_inventory":
                console.log("Not implemented");
                return 0;

            //DECLCB(win_request_info *, shim_ctrl_nhwindow,
            //    (winid window, int request, win_request_info *wri),
            //    "viip",
            //    A2P window, A2P request, P2V wri)
            case "shim_ctrl_nhwindow":
                console.log("Not implemented");
                return 0;

            case "genl_putmixed":
            case "genl_outrip":
            case "genl_status_finish":
            case "genl_status_enablefield":
            case "genl_status_update":
            case "genl_can_suspend_yes":
                console.log("Not implemented");
                return 0;
            default:
                console.log("Unknown event:", type);
                return 0;
        }
    };

    this.isWaitingForInput = function () {
        return this.pendingInputResolve !== null;
    };

    this.sendKey = function (keyName, shift, ctrl) {
        if (this.pendingInputResolve) {
            const charCode = this.convertKeyCode(keyName, shift, ctrl);
            const resolve = this.pendingInputResolve;
            this.pendingInputResolve = null;
            resolve(charCode);
        }
    };

    this.convertKeyCode = function (keyName, shift, ctrl) {
        // 基本的なキーマッピング
        const map = d.KEYMAP;

        let code = 0;
        if (!Boolean(map[keyName])) return code;

        if (ctrl) {
            // Ctrl + Key: A=1, B=2, ...
            code = map[keyName][2] || 0;//char.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
        } else if (shift) {
            // Shift + Key: 'A', 'B', ...
            code = map[keyName][1] || 0;//char.charCodeAt(0);
        } else {
            // Normal: 'a', 'b', ...
            code = map[keyName][0] || 0;//char.toLowerCase().charCodeAt(0);
        }
        return code;
    };

    // --- Main Entry ---

    this.main = function () {
        this.UI.mvwaddstr(d.DSP_STATUS, 1, 0, "Nethack-wasm-WebUI");
        this.setupNethackGlobal();

        window.nhDispatcher = this.eventHook.bind(this);
        // Do not overwrite window.nethackGlobal entirely to keep helpers from setupNethackGlobal
        if (!window.nethackGlobal) {
            this.setupNethackGlobal();
        }
        window.nethackGlobal.shimFunctionRunning = null;

        if (typeof Module === 'undefined') {
            console.error("Wasm Module not found!");
            return;
        }

        const boot = () => {
            console.log("NetHack Wasm Boot Sequence Started...");

            setTimeout(() => {
                try {
                    const startEngine = () => {
                        const syncToPersistent = () => {
                            const persistentFiles = ['record', 'logfile', 'xlogfile', 'paniclog'];
                            persistentFiles.forEach(f => {
                                try {
                                    const src = '/' + f;
                                    const dst = '/save/' + f;
                                    if (typeof FS !== 'undefined' && FS.analyzePath(src).exists) {
                                        const data = FS.readFile(src);
                                        FS.writeFile(dst, data);
                                        console.log(`NH Exit: Synced ${src} to ${dst}`);
                                    }
                                } catch (e) {
                                    console.error(`NH Exit: Failed to sync ${f}`, e);
                                }
                            });
                            if (typeof FS !== 'undefined' && typeof IDBFS !== 'undefined') {
                                FS.syncfs(false, (err) => {
                                    if (err) console.error("NH Exit: Final IDBFS sync error:", err);
                                    else console.log("NH Exit: Final IDBFS sync complete.");
                                });
                            }
                        };

                        console.log("Invoking NetHack main via ccall...");
                        this.playing = true;

                        const args = Module.arguments || ['nethack', '-uplayer', '-otime,showexp,showvers'];
                        const argc = args.length;
                        const argv = Module._malloc(argc * 4);
                        for (let i = 0; i < argc; i++) {
                            const str = args[i];
                            const strPtr = Module._malloc(str.length + 1);
                            Module.stringToUTF8(str, strPtr, str.length + 1);
                            Module.setValue(argv + i * 4, strPtr, '*');
                        }

                        console.log("Passing arguments to main:", args, "argc:", argc, "argv_ptr:", argv);

                        setInterval(() => {
                            if (this.playing && typeof FS !== 'undefined' && typeof IDBFS !== 'undefined') {
                                FS.syncfs(false, (err) => {
                                    if (err) console.error("IDBFS periodic sync error:", err);
                                });
                            }
                        }, 5 * 60 * 1000);

                        const result = Module.ccall('main', 'number', ['number', 'number'], [argc, argv], { async: true });

                        if (result instanceof Promise) {
                            result.then((r) => {
                                console.log("NetHack Engine Exited with:", r);
                                this.playing = false;
                                syncToPersistent();
                            })
                                .catch((err) => {
                                    if (err.name === 'ExitStatus') {
                                        console.log("NetHack Engine Exited Successfully with status:", err.status);
                                        this.playing = false;
                                        this.UI.msg(`NetHack ${this.get_nhVersion()}(wasm) Exit`);
                                        syncToPersistent();
                                        return;
                                    }
                                    console.error("NetHack Engine Runtime Error:", err);
                                    syncToPersistent();
                                });
                            console.log("NetHack Engine is now running asynchronously.");
                        } else {
                            console.log("NetHack Engine started synchronously.");
                        }
                    };

                    // Safe FileSystem Initialization flow
                    if (typeof FS !== 'undefined') {
                        const dirs = ['/save', '/tmp'];
                        dirs.forEach(d => {
                            try {
                                const res = FS.analyzePath(d);
                                if (!res.exists) {
                                    FS.mkdir(d);
                                    console.log(`NH Bootstrap: Created directory ${d}`);
                                }
                                if (d === '/save' && typeof IDBFS !== 'undefined') {
                                    FS.mount(IDBFS, {}, d);
                                    console.log(`NH Bootstrap: Mounted IDBFS at ${d}`);
                                }
                            } catch (e) { console.error(`Failed to initialize dir ${d}`, e); }
                        });

                        if (typeof IDBFS !== 'undefined') {
                            console.log("NH Bootstrap: Syncing from IndexedDB...");
                            FS.syncfs(true, (err) => {
                                if (err) {
                                    console.error("NH Bootstrap: IDBFS Sync Error (Initial):", err);
                                } else {
                                    console.log("NH Bootstrap: IDBFS Synced (Initial Complete)");

                                    const configFiles = ['NetHack.cnf', '.nethackrc'];
                                    const configContent = "SCOREDIR=/save/\nSAVEDIR=/save/\nLEVELDIR=/\nOPTIONS=time,showexp,showvers\n";
                                    configFiles.forEach(cf => {
                                        const path = '/' + cf;
                                        if (!FS.analyzePath(path).exists) {
                                            FS.writeFile(path, configContent);
                                            console.log(`NH Bootstrap: Created config file ${path}`);
                                        }
                                    });

                                    const files = ['perm', 'record', 'sysconf', 'logfile', 'xlogfile', 'paniclog'];
                                    files.forEach(f => {
                                        try {
                                            const isPersistent = ['record', 'logfile', 'xlogfile', 'paniclog'].includes(f);
                                            const rootPath = '/' + f;
                                            const savePath = '/save/' + f;

                                            if (isPersistent) {
                                                // コピー方式: /save/ にあれば / へコピー、なければ新規作成
                                                if (FS.analyzePath(savePath).exists) {
                                                    const data = FS.readFile(savePath);
                                                    FS.writeFile(rootPath, data);
                                                    console.log(`NH Bootstrap: Restored ${rootPath} from ${savePath}`);
                                                } else {
                                                    FS.writeFile(rootPath, "");
                                                    FS.writeFile(savePath, "");
                                                    console.log(`NH Bootstrap: Initialized empty ${rootPath} and ${savePath}`);
                                                }
                                            } else {
                                                // 非永続（または別の管理ファイル）
                                                if (!FS.analyzePath(rootPath).exists) {
                                                    const content = (f === 'sysconf') ? "WIZARDS=*\nEXPLORERS=*\n" : "";
                                                    FS.writeFile(rootPath, content);
                                                    console.log(`NH Bootstrap: Created ${rootPath}`);
                                                }
                                            }
                                        } catch (e) { console.error(`Failed to handle file ${f}`, e); }
                                    });

                                    FS.syncfs(false, (err) => {
                                        if (err) console.error("NH Bootstrap: Final Sync Error:", err);
                                        else console.log("NH Bootstrap: All FS preparation complete.");

                                        console.log("Setting up Graphics Callback...");
                                        const setCB = Module.cwrap('shim_graphics_set_callback', null, ['string']);
                                        setCB("nhDispatcher");
                                        startEngine();
                                    });
                                }
                            });
                        } else {
                            startEngine();
                        }
                    } else {
                        startEngine();
                    }
                } catch (e) {
                    console.error("NetHack Wasm Boot Error:", e);
                }
            }, 100);
        };

        // すでに準備が完了しているか、これから完了するかで処理を分ける
        if (Module.runtimeInitialized || Module.calledRun) {
            boot();
        } else {
            const oldOnRuntimeInitialized = Module.onRuntimeInitialized;
            Module.onRuntimeInitialized = () => {
                if (oldOnRuntimeInitialized) oldOnRuntimeInitialized();
                this.setupNethackGlobal(); // Patch again once runtime is ready
                boot();
            };
        }
    }

    this.scenestep = function () {
        // Wasm版では sceneControl が sendKey を呼ぶため、ここは空でも良い
    }

    this.playit = function () {
        // Wasm版では main 内で開始される
    }

}