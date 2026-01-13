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

        console.log("NH Event:", type, args);
        switch (type) {
            case "shim_init_nhwindows":
                return 0;
            case "shim_putstr":
                this.UI.nhPutStr(args[0], args[1], args[2]);
                break;
            case "shim_curs":
                this.UI.nhCurs(args[0], args[1], args[2]);
                break;
            case "shim_clear_nhwindow":
                this.UI.nhClear(args[0]);
                break;
            case "shim_print_glyph":
                {
                    const helpers = window.nethackGlobal.helpers;
                    const gInfo = helpers.parseGlyphInfo(args[3]);
                    const bkInfo = helpers.parseGlyphInfo(args[4]);
                    this.UI.nhPrintGlyph(args[0], args[1], args[2], gInfo, bkInfo);
                }
                break;
            case "shim_nhgetch":
                return new Promise(resolve => {
                    this.pendingInputResolve = resolve;
                });
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
            case "shim_player_selection_or_tty":
                console.log("shim_player_selection_or_tty called. Returning true.");
                return true; // Use boolean true instead of number 1
            case "shim_wait_synch":
            case "shim_mark_synch":
                return 0;
            case "shim_yn_function":
                r.UI.msg(`${args[0]}`);
                return new Promise(resolve => {
                    this.pendingInputResolve = resolve;
                });
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
            default:
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