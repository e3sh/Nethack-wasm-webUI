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

    //itemData(this);
    //monsterData(this);

    //global(this);

    for (let i in this.globalValiable) {
        //    this.UI.msg(`${i}: ${this.globalValiable[i].length}`);
    }
    for (let i in this.define) {
        //    this.UI.msg(`${i}: ${this.define[i]}`);
    }

    this.UI = new UIManager(this, g);
    //this.daemon = new DaemonScheduler(this);
    //this.item = new ItemManager(this);
    //this.player = new PlayerCharacter(this);
    //this.dungeon = new DungeonMap(this);
    //this.monster = new MonsterManager(this);

    this.playing = false;

    const r = this;

    //this.qs = new quick_storage(r);

    this.UI.comment("game");

    // --- NetHack Wasm Integration ---

    this.pendingInputResolve = null;

    this.setupNethackGlobal = function () {
        window.nethackGlobal = {
            helpers: {
                getPointerValue: function (name, ptr, type) {
                    if (type === 'v') return null;
                    if (type === 'i') return Module.getValue(ptr, 'i32');
                    if (type === 's') return Module.UTF8ToString(ptr);
                    if (type === 'b') return !!Module.getValue(ptr, 'i8');
                    if (type === 'c' || type === '0') return String.fromCharCode(Module.getValue(ptr, 'i8'));
                    if (type === '1') return Module.getValue(ptr, 'i16'); // coordxy
                    if (type === 'p') return ptr;
                    return ptr;
                },
                setPointerValue: function (name, ret_ptr, type, value) {
                    if (!ret_ptr) return;
                    if (type === 'i') Module.setValue(ret_ptr, value, 'i32');
                    if (type === 'b') Module.setValue(ret_ptr, value ? 1 : 0, 'i8');
                    if (type === 'c') Module.setValue(ret_ptr, typeof value === 'string' ? value.charCodeAt(0) : value, 'i8');
                },
                parseGlyphInfo: function (ptr) {
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

                    return {
                        glyph: glyph,
                        symbol: symbol,
                        framecolor: framecolor,
                        flags: flags,
                        color: color,
                        symidx: symidx,
                        ch: ch
                    };
                }
            }
        };
    };

    this.eventHook = async function (type, ...args) {
        const helpers = window.nethackGlobal.helpers;

        console.log("NH Event:", type, args);
        switch (type) {
            //VDECLCB(shim_init_nhwindows,(int *argcp, char **argv), "vpp", P2V argcp, P2V argv)
            case "shim_init_nhwindows":
                return 0;
            //DECLCB(boolean, shim_player_selection_or_tty,(void), "b")
            case "shim_player_selection_or_tty":
                console.log("shim_player_selection_or_tty called. Returning true.");
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
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_exit_nhwindows,(const char *str), "vs", P2V str)
            case "shim_exit_nhwindows":
                this.playing = false;
                if (typeof FS !== 'undefined' && typeof IDBFS !== 'undefined') {
                    console.log("Saving game to IndexedDB...");
                    FS.syncfs(false, (err) => {
                        if (err) console.error("IDBFS Sync Error (Save):", err);
                        else console.log("IDBFS Synced to IndexedDB (Save Complete)");
                    });
                }
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
                this.UI.nhClear(args[0]);
                return 0;
            //VDECLCB(shim_clear_nhwindow,(winid window), "vi", A2P window)
            case "shim_clear_nhwindow":
                this.UI.nhPutbufClear();
                this.UI.nhClear(args[0]);
                break;
            //VDECLCB(shim_display_nhwindow,(winid window, boolean blocking), "vib", A2P window, A2P blocking)
            case "shim_display_nhwindow":
                this.UI.nhPutbufDraw(args[0]);
                this.UI.overlapview(args[1]? true : false);
                return 0;
            //VDECLCB(shim_destroy_nhwindow,(winid window), "vi", A2P window)
            case "shim_destroy_nhwindow":
                this.UI.nhPutbufClear();
                return 0;
            //VDECLCB(shim_curs,(winid a, int x, int y), "viii", A2P a, A2P x, A2P y)
            case "shim_curs":
                this.UI.nhCurs(args[0], args[1], args[2]);
                break;
            //VDECLCB(shim_putstr,(winid w, int attr, const char *str), "viis", A2P w, A2P attr, P2V str)
            case "shim_putstr":
                //this.UI.nhPutStr(args[0], args[1], args[2]);
                this.UI.nhPutbufAdd(args[2]);
                break;
            //VDECLCB(shim_display_file,(const char *name, boolean complain), "vsb", P2V name, A2P complain)
            case "shim_display_file":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_start_menu,(winid window, unsigned long mbehavior), "vii", A2P window, A2P mbehavior)
            case "shim_start_menu":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_add_menu,
            //    (winid window, const glyph_info *glyphinfo, const ANY_P *identifier, char ch, char gch, int attr, int clr, const char *str, unsigned int itemflags),
            //    "vipi00iisi",
            //    A2P window, P2V glyphinfo, P2V identifier, A2P ch, A2P gch, A2P attr, A2P clr, P2V str, A2P itemflags)
            case "shim_add_menu":
                console.log("Not implemented",helpers.parseGlyphInfo(args[1]));
                return 0;
            //VDECLCB(shim_end_menu,(winid window, const char *prompt), "vis", A2P window, P2V prompt)
            case "shim_end_menu":
                console.log("Not implemented");
                return 0;
            /* XXX: shim_select_menu menu_list is an output */
            //DECLCB(int, shim_select_menu,(winid window, int how, MENU_ITEM_P **menu_list), "iiip", A2P window, A2P how, P2V menu_list)
            case "shim_select_menu":
                console.log("Not implemented",helpers.getPointerValue("",args[2],"s"));
                return 0;
            //DECLCB(char, shim_message_menu,(char let, int how, const char *mesg), "ciis", A2P let, A2P how, P2V mesg)
            case "shim_message_menu":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_mark_synch,(void), "v")
            case "shim_mark_synch":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_wait_synch,(void), "v")
            case "shim_wait_synch":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_cliparound,(int x, int y), "vii", A2P x, A2P y)
            case "shim_cliparound":
                console.log("Not implemented");
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
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_raw_print_bold,(const char *str), "vs", P2V str)
            case "shim_raw_print_bold":
                console.log("Not implemented");
                return 0;
            //DECLCB(int, shim_nhgetch,(void), "i")
            case "shim_nhgetch":
                return new Promise(resolve => {
                    this.pendingInputResolve = resolve;
                });
            //DECLCB(int, shim_nh_poskey,(coordxy *x, coordxy *y, int *mod), "ippp", P2V x, P2V y, P2V mod)
            case "shim_nh_poskey":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_nhbell,(void), "v")
            case "shim_nhbell":
                console.log("Not implemented");
                return 0;
            //DECLCB(int, shim_doprev_message,(void),"iv")
            case "shim_doprev_message":
                console.log("Not implemented");
                return 0; 
            //DECLCB(char, shim_yn_function,(const char *query, const char *resp, char def), "css0", P2V query, P2V resp, A2P def)
            case "shim_yn_function":
                this.UI.msg(`${args[0]}`);
                return new Promise(resolve => {
                    this.pendingInputResolve = resolve;
                });
            //VDECLCB(shim_getlin,(const char *query, char *bufp), "vsp", P2V query, P2V bufp)
            case "shim_getlin":
                console.log("Not implemented");
                return 0;
            //DECLCB(int,shim_get_ext_cmd,(void),"iv")
            case "shim_get_ext_cmd":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_number_pad,(int state), "vi", A2P state)
            case "shim_number_pad":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_delay_output,(void), "v")
            case "shim_delay_output":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_change_color,(int color, long rgb, int reverse), "viii", A2P color, A2P rgb, A2P reverse)
            case "shim_change_color":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_change_background,(int white_or_black), "vi", A2P white_or_black)
            case "shim_change_background":
                console.log("Not implemented");
                return 0;
            //DECLCB(short, set_shim_font_name,(winid window_type, char *font_name),"2is", A2P window_type, P2V font_name)
            case "set_shim_font_name":
                console.log("Not implemented");
                return 0;
            //DECLCB(char *,shim_get_color_string,(void),"sv")
            case "shim_get_color_string":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_preference_update, (const char *pref), "vp", P2V pref)
            case "shim_preference_update":
                console.log("Not implemented");
                return 0;
            //DECLCB(char *,shim_getmsghistory, (boolean init), "sb", A2P init)
            case "shim_getmsghistory":
                return 0;
            //VDECLCB(shim_putmsghistory, (const char *msg, boolean restoring_msghist), "vsb", P2V msg, A2P restoring_msghist)
            case "shim_putmsghistory":
                this.UI.msg(`${args[0]}`);
                return 0;
            //VDECLCB(shim_status_init, (void), "v")
            case "shim_status_init":
                console.log("Not implemented");
                return 0;
            //VDECLCB(shim_status_enablefield,
            //    (int fieldidx, const char *nm, const char *fmt, boolean enable),
            //    "vippb",
            //    A2P fieldidx, P2V nm, P2V fmt, A2P enable)
            case "shim_status_enablefield":
                console.log("Not implemented");
                return 0;
            /* XXX: the second argument to shim_status_update is sometimes an integer and sometimes a pointer */
            //VDECLCB(shim_status_update,
            //    (int fldidx, genericptr_t ptr, int chg, int percent, int color, unsigned long *colormasks),
            //    "vipiiip",
            //    A2P fldidx, P2V ptr, A2P chg, A2P percent, A2P color, P2V colormasks)
            case "shim_status_update":
                console.log("Not implemented",
                    helpers.getPointerValue("",args[1],"s"),
                    helpers.getPointerValue("",args[5],"s"),
                    );
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

    this.sendKey = function (keyName) {
        if (this.pendingInputResolve) {
            const charCode = this.convertKeyCode(keyName);
            const resolve = this.pendingInputResolve;
            this.pendingInputResolve = null;
            resolve(charCode);
        }
    };

    this.convertKeyCode = function (keyName) {
        // 基本的なキーマッピング
        const map = {
            'ArrowUp': 'k'.charCodeAt(0),
            'ArrowDown': 'j'.charCodeAt(0),
            'ArrowLeft': 'h'.charCodeAt(0),
            'ArrowRight': 'l'.charCodeAt(0),
            'Enter': 13,
            'Escape': 27,
            'Space': 32,
            'KeyY': "y".charCodeAt(0),
            'KeyN': "n".charCodeAt(0),
            'KeyA': "a".charCodeAt(0),
            'KeyQ': "q".charCodeAt(0),
        };
        // 1文字の場合はそのまま
        if (keyName.length === 1) return keyName.charCodeAt(0);
        return map[keyName] || 0;
    };

    // --- Main Entry ---

    this.main = function () {
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
                    // Safe FileSystem Initialization
                    if (typeof FS !== 'undefined') {
                        const initializeFS = () => {
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

                            const files = ['perm', 'record', 'sysconf', 'logfile'];
                            files.forEach(f => {
                                try {
                                    const path = '/' + f;
                                    const res = FS.analyzePath(path);
                                    if (!res.exists) {
                                        const content = (f === 'sysconf') ? "WIZARDS=*\nEXPLORERS=*\n" : "";
                                        FS.writeFile(path, content);
                                        console.log(`NH Bootstrap: Created file ${path}`);
                                    } else if (res.object.isFolder) {
                                        console.warn(`NH Bootstrap: Conflict! /${f} is already a directory.`);
                                    }
                                } catch (e) { console.error(`Failed to create file ${f}`, e); }
                            });
                        };
                        initializeFS();
                    }

                    console.log("Setting up Graphics Callback...");
                    const setCB = Module.cwrap('shim_graphics_set_callback', null, ['string']);
                    setCB("nhDispatcher");

                    const startEngine = () => {
                        console.log("Invoking NetHack main via ccall...");
                        this.playing = true;

                        // 引数 (argv) を手動で構築して Wasm メモリ空間に配置
                        // スペースなしの -uplayer を試す
                        const args = Module.arguments || ['nethack', '-uplayer'];
                        const argc = args.length;
                        const argv = Module._malloc(argc * 4); // ポインタ (32bit) の配列
                        for (let i = 0; i < argc; i++) {
                            const str = args[i];
                            const strPtr = Module._malloc(str.length + 1);
                            Module.stringToUTF8(str, strPtr, str.length + 1);
                            Module.setValue(argv + i * 4, strPtr, '*');
                        }

                        console.log("Passing arguments to main:", args, "argc:", argc, "argv_ptr:", argv);

                        // 定期的な同期（オートセーブ）
                        setInterval(() => {
                            if (this.playing && typeof FS !== 'undefined' && typeof IDBFS !== 'undefined') {
                                FS.syncfs(false, (err) => {
                                    if (err) console.error("IDBFS periodic sync error:", err);
                                });
                            }
                        }, 5 * 60 * 1000);

                        // Asyncify対応のため {async: true} を指定
                        // 第3引数の型指定を ['number', 'number'] に変更 (argc, argv)
                        const result = Module.ccall('main', 'number', ['number', 'number'], [argc, argv], { async: true });

                        if (result instanceof Promise) {
                            result.then((r) => console.log("NetHack Engine Exited with:", r))
                                .catch((err) => console.error("NetHack Engine Runtime Error:", err));
                            console.log("NetHack Engine is now running asynchronously.");
                        } else {
                            console.log("NetHack Engine started synchronously (Warning: Asyncify might not be active).");
                        }
                    };

                    if (typeof FS !== 'undefined' && typeof IDBFS !== 'undefined') {
                        console.log("Syncing from IndexedDB...");
                        FS.syncfs(true, (err) => {
                            if (err) console.error("IDBFS initial sync error:", err);
                            else console.log("IDBFS Sync Complete.");
                            startEngine();
                        });
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