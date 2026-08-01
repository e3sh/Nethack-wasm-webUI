/**
 * NetHackWasmDriver.js
 * NetHack 5.0 Wasm コアと Client UI レイヤーを疎結合に接続する汎用 Driver クラス
 */
(function (global) {
    if (global.NetHackWasmDriver) return;

    class NetHackWasmDriver {
        static get DriverState() {
            return {
                IDLE: 'IDLE',
                RUNNING: 'RUNNING',
                WAITING_INPUT: 'WAITING_INPUT',
                STOPPED: 'STOPPED'
            };
        }

        static get DEFAULT_EXTCMDS() {
            return [
                "#","?","adjust", "annotate", "apply", "attributes", "autopickup",
                "call", "cast", "chat", "chronicle", "close", "conduct", "debugfuzzer",
                "dip", "down", "drop", "droptype", "eat", "engrave", "enhance",
                "exploremode", "fight", "fire", "force", "genocided", "glance",
                "help", "herecmdmenu", "history", "inventory", "inventtype",
                "invoke", "jump", "kick", "known", "knownclass", "levelchange",
                "lightsources", "look", "lookaround", "loot", "migratemons",
                "monster", "name", "offer", "open", "options", "optionsfull",
                "overview", "panic", "pay", "perminv", "pickup", "polyself",
                "pray", "prevmsg", "puton", "quaff", "quit", "quiver", "read",
                "redraw", "remove", "repeat", "reqmenu", "retravel", "ride",
                "rub", "run", "rush", "save", "saveoptions", "search", "seeall",
                "seeamulet", "seearmor", "seerings", "seetools", "seeweapon",
                "shell", "showgold", "showspells", "showtrap", "sit", "stats",
                "suspend", "swap", "takeoff", "takeoffall", "teleport", "terrain",
                "therecmdmenu", "throw", "timeout", "tip", "toggle", "travel",
                "turn", "twoweapon", "untrap", "up", "vanquished", "version",
                "versionshort", "vision", "wait", "wear", "whatdoes", "whatis",
                "wield", "wipe"
            ];
        }

        constructor(options = {}) {
            this.listeners = new Map();
            this.options = options;

            this.initSubModules(options);

            this.state = NetHackWasmDriver.DriverState.IDLE;
            this.menuBuffer = {};
            this.messageHistory = [];
            this.messageWindowId = 1;
            this.version = "";

            // Bind global dispatcher safely
            this.eventHook = this.eventHook.bind(this);
            this.setupGlobalDispatcher();
        }

        getModule() {
            const winM = (typeof window !== 'undefined') ? window.Module : null;
            const globM = (typeof globalThis !== 'undefined') ? globalThis.Module : null;
            if (winM && (winM.ccall || winM.setValue)) return winM;
            if (globM && (globM.ccall || globM.setValue)) return globM;
            if (this.memory && this.memory.Module) return this.memory.Module;
            return winM || globM || (this.options ? this.options.module : null);
        }

        log(...args) {
            if (this.debug) {
                console.log("[NetHackWasmDriver]", ...args);
            }
        }

        initSubModules(options = {}) {
            const getGlobalClass = (className) => {
                if (typeof window !== 'undefined' && window[className]) return window[className];
                if (typeof globalThis !== 'undefined' && globalThis[className]) return globalThis[className];
                try {
                    return eval(className);
                } catch (e) {
                    return null;
                }
            };

            const MemoryClass = getGlobalClass('NetHackMemory');
            const FSManagerClass = getGlobalClass('NetHackFSManager');
            const ResolverClass = getGlobalClass('InputResolver');

            const moduleRef = options.module || this.getModule();

            if (MemoryClass && (!this.memory || options.module)) {
                this.memory = new MemoryClass(moduleRef);
            }
            if (FSManagerClass && !this.fsManager) {
                this.fsManager = new FSManagerClass({ debug: this.debug });
                this.log("Successfully instantiated NetHackFSManager.");
            }
            if (ResolverClass && !this.inputResolver) {
                this.inputResolver = new ResolverClass({ timeoutMs: options.inputTimeoutMs || 0 });
            }
            this.messageHistory = [];
            this.historyIndex = 0;
        }

        init(moduleRef) {
            if (moduleRef) this.wasmModule = moduleRef;
            this.initSubModules(this.options);
            if (this.memory) {
                this.memory.setModule(moduleRef);
            }
            const M = this.getModule();
            if (M) {
                M.preRun = M.preRun || [];
                M.preRun.push(() => {
                    if (typeof globalThis !== 'undefined' && globalThis.ENV) {
                        globalThis.ENV.USER = undefined;
                        globalThis.ENV.LOGNAME = undefined;
                        globalThis.ENV.HOME = "/";
                        globalThis.ENV.HACKDIR = "/";
                        globalThis.ENV.SCOREDIR = "/save/";
                        globalThis.ENV.LEVELDIR = "/";
                        globalThis.ENV.SAVEDIR = "/save/";
                        globalThis.ENV.NETHACKOPTIONS = "number_pad:1";
                    }
                });
            }
            this.setupGlobalDispatcher();
        }

        get activeResolver() {
            return (this.inputResolver && this.inputResolver.isWaiting()) ? this.inputResolver : null;
        }

        /**
         * EventEmitter API: イベントリスナー登録
         */
        on(event, fn) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(fn);
            return this;
        }

        once(event, fn) {
            const wrapper = (payload) => {
                this.off(event, wrapper);
                fn(payload);
            };
            return this.on(event, wrapper);
        }

        off(event, fn) {
            if (!this.listeners.has(event)) return this;
            const list = this.listeners.get(event).filter(l => l !== fn);
            this.listeners.set(event, list);
            return this;
        }

        emit(event, payload) {
            if (!this.listeners.has(event)) return false;
            const list = this.listeners.get(event);
            list.forEach(fn => {
                try {
                    fn(payload);
                } catch (e) {
                    console.error(`[NetHackWasmDriver] Error in event listener for '${event}':`, e);
                }
            });
            return true;
        }

        setState(newState) {
            if (this.state !== newState) {
                this.state = newState;
                this.emit('stateChange', { state: newState });
            }
        }

        /**
         * globalThis に C側からの呼び出しレシーバ (nhDispatcher) をセットし、helpers を sticky パッチします。
         */
        setupGlobalDispatcher() {
            const target = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : global);
            target.nhDispatcher = this.eventHook;
            target.nethackGlobal = target.nethackGlobal || {};
            target.nethackGlobal.helpers = target.nethackGlobal.helpers || {};

            const helpers = target.nethackGlobal.helpers;

            const makeSticky = (name, fn) => {
                Object.defineProperty(helpers, name, {
                    get: function () { return fn; },
                    set: function (val) {
                        // console.log(`[NetHackWasmDriver] Blocking attempt to overwrite helper ${name}`);
                    },
                    configurable: true,
                    enumerable: true
                });
            };

            makeSticky('getPointerValue', (name, ptr, type) => this.memory ? this.memory.getPointerValue(ptr, type) : null);
            makeSticky('setPointerValue', (name, ret_ptr, type, value) => this.memory ? this.memory.setPointerValue(ret_ptr, type, value) : null);
            makeSticky('parseGlyphInfo', (ptr) => this.memory ? this.memory.parseGlyphInfo(ptr) : null);
            helpers.isPatched = true;
        }

        /**
         * NetHack Wasm コアエンジンを起動します。
         */
        async start(options = {}) {
            this.initSubModules(options);

            if (this.state === NetHackWasmDriver.DriverState.RUNNING) {
                console.warn("[NetHackWasmDriver] Engine is already running.");
                return 0;
            }

            const M = this.getModule();
            if (!M) {
                throw new Error("[NetHackWasmDriver] Emscripten Module not found!");
            }

            if (!this.fsManager) {
                const FSClass = (typeof window !== 'undefined' && window.NetHackFSManager) ? window.NetHackFSManager : ((typeof globalThis !== 'undefined' && globalThis.NetHackFSManager) ? globalThis.NetHackFSManager : null);
                if (FSClass) {
                    this.fsManager = new FSClass({ debug: this.debug });
                    this.log("Dynamically created NetHackFSManager instance in start().");
                }
            }

            const mergedOptions = Object.assign({}, this.options, options);
            let extraOptsStr = mergedOptions.extraOptions || "";

            if (mergedOptions.gameOptions) {
                const optsList = [];
                for (const [k, v] of Object.entries(mergedOptions.gameOptions)) {
                    if (typeof v === 'boolean') {
                        optsList.push(v ? k : `!${k}`);
                    } else if (v !== undefined && v !== null) {
                        optsList.push(`${k}:${v}`);
                    }
                }
                if (optsList.length > 0) {
                    extraOptsStr += "\n" + optsList.map(o => `OPTIONS=${o}`).join("\n");
                }
            }

            if (this.fsManager) {
                this.log("Initializing FileSystem via fsManager...");
                await this.fsManager.initFileSystem(extraOptsStr);
            } else {
                console.error("[NetHackWasmDriver] CRITICAL: NetHackFSManager is missing! Executing robust raw FS fallback.");
                const FS = typeof globalThis !== 'undefined' && globalThis.FS ? globalThis.FS : (typeof FS !== 'undefined' ? FS : null);
                if (FS) {
                    try {
                        if (!FS.analyzePath('/save').exists) FS.mkdir('/save');
                        if (!FS.analyzePath('/tmp').exists) FS.mkdir('/tmp');
                        
                        const sysconfContent = "WIZARDS=*\nEXPLORERS=*\n";
                        ['/sysconf', '/save/sysconf', 'sysconf'].forEach(p => { try { FS.writeFile(p, sysconfContent); } catch(e){} });
                        
                        const permContent = "*\n";
                        ['/perm', '/save/perm', 'perm'].forEach(p => { try { FS.writeFile(p, permContent); } catch(e){} });

                        FS.writeFile('/.nethackrc', "SCOREDIR=/save/\nSAVEDIR=/save/\nLEVELDIR=/\n" + (extraOptsStr ? `OPTIONS=${extraOptsStr}\n` : ""));
                        this.log("Raw VFS fallback (sysconf + perm) written successfully.");
                    } catch(e) { console.error("Raw VFS fallback error:", e); }
                }
            }

            // C 側のグラフィックコールバック登録
            const cwrapFn = M.cwrap || (typeof cwrap !== 'undefined' ? cwrap : null);
            if (typeof cwrapFn === 'function') {
                try {
                    this.log("Registering graphics callback 'nhDispatcher'...");
                    const setCB = cwrapFn('shim_graphics_set_callback', null, ['string']);
                    setCB("nhDispatcher");
                } catch (e) {
                    console.warn("[NetHackWasmDriver] Failed to set graphics callback via cwrap:", e);
                }
            }

            // コアメインの起動引数構築
            const coreOptions = "number_pad:1,tombstone";
            const args = (M.arguments && M.arguments.length > 0)
                ? [...M.arguments]
                : ['nethack', `-o${coreOptions}`, `--nethackrc:/.nethackrc`];

            if (!args.some(arg => arg.startsWith('--nethackrc'))) {
                args.push("--nethackrc:/.nethackrc");
            }

            const optArg = args.find(a => a.startsWith('-o'));
            const envTarget = typeof globalThis !== 'undefined' && globalThis.ENV ? globalThis.ENV : (typeof ENV !== 'undefined' ? ENV : null);
            if (envTarget) {
                envTarget.NETHACKOPTIONS = optArg ? optArg.slice(2) : "";
            }

            const mallocFn = M._malloc || (typeof _malloc !== 'undefined' ? _malloc : null);
            const setVal = (M && M.setValue) ? M.setValue.bind(M) : (typeof setValue !== 'undefined' ? setValue : null);
            const strToUTF8 = (M && M.stringToUTF8) ? M.stringToUTF8.bind(M) : (typeof stringToUTF8 !== 'undefined' ? stringToUTF8 : (s, ptr) => M.writeAsciiToMemory(s, ptr));
            const ccallFn = (M && M.ccall) ? M.ccall.bind(M) : (typeof ccall !== 'undefined' ? ccall : null);

            const argc = args.length;
            const argv = mallocFn ? mallocFn((argc + 1) * 4) : 0;
            
            for (let i = 0; i < argc; i++) {
                const str = args[i];
                const strPtr = mallocFn ? mallocFn(str.length + 1) : 0;
                if (strPtr) strToUTF8(str, strPtr, str.length + 1);
                if (setVal && argv) setVal(argv + i * 4, strPtr, '*');
            }
            if (setVal && argv) setVal(argv + argc * 4, 0, '*');

            this.setState(NetHackWasmDriver.DriverState.RUNNING);
            this.emit('started', { args });

            this.log("Invoking NetHack main via ccall with args:", args, "argc:", argc);
            return new Promise((resolve) => {
                try {
                    if (!ccallFn) {
                        throw new Error("Emscripten ccall function not found!");
                    }
                    const result = ccallFn('main', 'number', ['number', 'number'], [argc, argv], { async: true });
                    if (result instanceof Promise) {
                        result.then(async code => resolve(await this.handleEngineExit(code)))
                            .catch(async err => {
                                if (err && err.name === 'ExitStatus') {
                                    resolve(await this.handleEngineExit(err.status));
                                } else {
                                    console.error("[NetHackWasmDriver] Engine error in Promise:", err);
                                    resolve(await this.handleEngineExit(-1));
                                }
                            });
                    } else {
                        resolve(this.handleEngineExit(result));
                    }
                } catch (err) {
                    console.error("[NetHackWasmDriver] Exception while starting main:", err);
                    resolve(this.handleEngineExit(-1));
                }
            });
        }

        async handleEngineExit(exitCode) {
            this.log(`NetHack Engine Exited with code: ${exitCode}`);
            this.setState(NetHackWasmDriver.DriverState.STOPPED);
            if (this.fsManager) {
                await this.fsManager.syncToPersistent();
            }
            this.emit('exited', { exitCode });
            this.emit('exit_nhwindows', { message: `Engine Exited (${exitCode})` });
            return exitCode;
        }

        /**
         * C言語の winshim.c から呼び出されるイベントフック
         */
        async eventHook(type, ...args) {
            this.initSubModules();

            switch (type) {
                case "shim_init_nhwindows":
                    this.emit("init_nhwindows", {});
                    return 0;

                case "shim_player_selection_or_tty":
                    return true;

                case "shim_askname": {
                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    let detectedName = this.fsManager ? this.fsManager.autoDetectSavePlayerName() : "";
                    const defaultName = detectedName || (this.options.gameOptions ? this.options.gameOptions.name : "") || "Web_user";

                    const promise = this.inputResolver ? this.inputResolver.createPending('askname', { detectedName }) : Promise.resolve(defaultName);
                    const resolverObj = {
                        respond: (val) => this.inputResolver ? this.inputResolver.respond(val) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("inputRequired", {
                        context: "askname",
                        type: "string",
                        prompt: "What is your name?",
                        detectedName,
                        defaultName,
                        resolver: resolverObj
                    });

                    let name = await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);

                    if (!name || typeof name !== 'string' || name.trim() === "") {
                        name = defaultName;
                    }

                    const M = this.getModule();
                    const getPlnameFn = (M && typeof M._get_plname === 'function') ? M._get_plname : (typeof _get_plname === 'function' ? _get_plname : null);
                    const strToUTF8 = (M && M.stringToUTF8) ? M.stringToUTF8.bind(M) : (typeof stringToUTF8 !== 'undefined' ? stringToUTF8 : null);

                    if (getPlnameFn && strToUTF8) {
                        const plnamePtr = getPlnameFn();
                        if (plnamePtr) {
                            const safeName = name.substring(0, 31);
                            strToUTF8(safeName, plnamePtr, 32);
                        }
                    }
                    return 0;
                }

                case "shim_exit_nhwindows":
                    this.setState(NetHackWasmDriver.DriverState.STOPPED);
                    this.emit("exit_nhwindows", { message: args[0] || "" });
                    return 0;

                case "shim_create_nhwindow":
                    if (args[0] === 1) this.messageWindowId = args[0];
                    this.emit("create_nhwindow", { windowId: args[0] });
                    return args[0];

                case "shim_clear_nhwindow":
                    this.emit("clear_nhwindow", { windowId: args[0] });
                    return 0;

                case "shim_display_nhwindow": {
                    const windowId = args[0];
                    const blocking = !!args[1];

                    const promise = this.inputResolver ? this.inputResolver.createPending('display', { windowId }) : Promise.resolve(0);
                    const resolverObj = {
                        respond: (val) => this.inputResolver ? this.inputResolver.respond(val) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("display_nhwindow", { windowId, blocking, resolver: resolverObj });

                    if (this.inputResolver) {
                        this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                        await promise;
                        this.setState(NetHackWasmDriver.DriverState.RUNNING);
                    }
                    return 0;
                }

                case "shim_destroy_nhwindow":
                    this.emit("destroy_nhwindow", { windowId: args[0] });
                    return 0;

                case "shim_curs":
                    this.emit("curs", { windowId: args[0], x: args[1], y: args[2] });
                    break;

                case "shim_putstr": {
                    const winId = args[0];
                    const attr = args[1];
                    const text = args[2] || "";

                    if (text.trim().length > 0 && winId === this.messageWindowId) {
                        this.messageHistory.push(text.trim());
                        if (this.messageHistory.length > 200) this.messageHistory.shift();
                    }

                    this.emit("putstr", { windowId: winId, attr, text });
                    break;
                }

                case "shim_putmsghistory": {
                    const text = args[0] || "";
                    const restoring = !!args[1];

                    if (text.trim().length > 0) {
                        this.messageHistory.push(text.trim());
                        if (this.messageHistory.length > 200) {
                            this.messageHistory.shift();
                        }
                    }

                    if (!restoring) {
                        this.emit("putstr", { windowId: 1, attr: 0, text });
                    }
                    return 0;
                }

                case "shim_getmsghistory": {
                    const init = !!args[0];
                    if (init) {
                        this.historyIndex = 0;
                    }
                    if (this.historyIndex < this.messageHistory.length) {
                        const msg = this.messageHistory[this.historyIndex];
                        this.historyIndex++;
                        return msg;
                    }
                    return null;
                }

                case "shim_display_file": {
                    const filename = args[0];
                    const complain = args[1];

                    let fileText = "";
                    try {
                        const M = this.getModule();
                        const FS = M ? M.FS : (typeof FS !== 'undefined' ? FS : null);
                        if (FS && FS.analyzePath(filename).exists) {
                            fileText = FS.readFile(filename, { encoding: 'utf8' });
                        }
                    } catch (e) {
                        console.warn("[NetHackWasmDriver] Failed to read display file:", filename, e);
                    }

                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    const promise = this.inputResolver ? this.inputResolver.createPending('display_file', { filename }) : Promise.resolve(0);
                    const resolverObj = {
                        respond: (val) => this.inputResolver ? this.inputResolver.respond(val) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("display_file", { filename, complain, fileText, resolver: resolverObj });
                    await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);
                    return 0;
                }

                case "shim_start_menu":
                    this.menuBuffer[args[0]] = { behavior: args[1], items: [], prompt: "" };
                    return 0;

                case "shim_add_menu": {
                    const windowId = args[0];
                    if (!this.menuBuffer[windowId]) return 0;

                    const glyphInfo = (args[1] && this.memory) ? this.memory.parseGlyphInfo(args[1]) : null;
                    const numericGlyph = glyphInfo ? glyphInfo.glyph : (typeof args[1] === 'number' ? args[1] : -1);
                    const item = {
                        windowId,
                        glyphInfo,
                        glyph: numericGlyph,
                        identifier: args[2],
                        accelerator: args[3],
                        ch: args[3],
                        gch: args[4],
                        attr: args[5],
                        clr: args[6],
                        str: args[7],
                        itemflags: args[8]
                    };
                    this.menuBuffer[windowId].items.push(item);
                    return 0;
                }

                case "shim_end_menu":
                    if (this.menuBuffer[args[0]]) {
                        this.menuBuffer[args[0]].prompt = args[1] || "";
                    }
                    return 0;

                case "shim_select_menu": {
                    const windowId = args[0];
                    const how = args[1];
                    const menuListPtrPtr = args[2];
                    const menuData = this.menuBuffer[windowId];

                    if (!menuData) return 0;

                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    const promise = this.inputResolver ? this.inputResolver.createPending('select_menu', { windowId, how, items: menuData.items, prompt: menuData.prompt }) : Promise.resolve(0);

                    const resolverObj = {
                        respond: (selected) => this.inputResolver ? this.inputResolver.respond(selected) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("inputRequired", {
                        context: "select_menu",
                        type: "menu",
                        windowId,
                        how,
                        menuItems: menuData.items,
                        items: menuData.items,
                        prompt: menuData.prompt,
                        resolver: resolverObj
                    });

                    const selectedItems = await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);

                    if (!selectedItems || selectedItems === 0 || selectedItems.length === 0) {
                        return 0;
                    }

                    if (Array.isArray(selectedItems) && this.memory) {
                        const ptr = this.memory.buildMenuItemBuffer(selectedItems);
                        const M = this.getModule();
                        const setVal = (M && M.setValue) ? M.setValue.bind(M) : (typeof setValue !== 'undefined' ? setValue : null);
                        if (setVal) setVal(menuListPtrPtr, ptr, 'i32');
                        return selectedItems.length;
                    }
                    return 0;
                }

                case "shim_print_glyph": {
                    const glyphInfo = this.memory ? this.memory.parseGlyphInfo(args[3]) : null;
                    const bkglyphInfo = this.memory ? this.memory.parseGlyphInfo(args[4]) : null;
                    this.emit("print_glyph", { windowId: args[0], x: args[1], y: args[2], glyphInfo, bkglyphInfo });
                    break;
                }

                case "shim_raw_print": {
                    const text = args[0] || "";
                    this.emit("raw_print", { text });
                    return 0;
                }

                case "shim_raw_print_bold": {
                    const text = args[0] || "";
                    this.emit("raw_print_bold", { text });
                    this.emit("raw_print", { text });
                    return 0;
                }

                case "shim_nhgetch": {
                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    const promise = this.inputResolver ? this.inputResolver.createPending('getch') : Promise.resolve(32);

                    const resolverObj = {
                        respond: (key) => this.inputResolver ? this.inputResolver.respond(key) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("inputRequired", {
                        context: "getch",
                        type: "char",
                        resolver: resolverObj
                    });

                    const key = await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);
                    return key;
                }

                case "shim_nh_poskey": {
                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    const promise = this.inputResolver ? this.inputResolver.createPending('poskey') : Promise.resolve(32);

                    const resolverObj = {
                        respond: (res) => this.inputResolver ? this.inputResolver.respond(res) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("inputRequired", {
                        context: "poskey",
                        type: "poskey",
                        resolver: resolverObj
                    });

                    const res = await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);

                    if (typeof res === 'object' && res.x !== undefined && res.y !== undefined) {
                        const M = this.getModule();
                        const setVal = (M && M.setValue) ? M.setValue.bind(M) : (typeof setValue !== 'undefined' ? setValue : null);
                        if (setVal) {
                            setVal(args[0], res.x, 'i16');
                            setVal(args[1], res.y, 'i16');
                            setVal(args[2], res.mod || 0, 'i32');
                        }
                        return 0;
                    }
                    if (typeof res === 'number') return res;
                    if (typeof res === 'string' && res.length > 0) return res.charCodeAt(0);
                    if (Array.isArray(res) && res.length > 0) {
                        const first = res[0];
                        if (typeof first === 'number') return first;
                        if (typeof first === 'string' && first.length > 0) return first.charCodeAt(0);
                    }
                    return 0;
                }

                case "shim_yn_function": {
                    const query = args[0];
                    const choices = args[1] || "";
                    const def = args[2] || "";

                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    const promise = this.inputResolver ? this.inputResolver.createPending('yn_function', { query, choices, def }) : Promise.resolve(def ? def.charCodeAt(0) : 27);

                    const resolverObj = {
                        respond: (ans) => this.inputResolver ? this.inputResolver.respond(ans) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("inputRequired", {
                        context: "yn_function",
                        type: "yn",
                        query,
                        question: query,
                        choices,
                        defaultChoice: def,
                        def,
                        resolver: resolverObj
                    });

                    const rawAns = await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);

                    const getSafeFallbackChar = () => {
                        if (def && typeof def === 'string' && def.length > 0 && choices && typeof choices === 'string' && choices.includes(def)) {
                            return def;
                        }
                        if (choices && typeof choices === 'string' && choices.length > 0) {
                            if (choices.includes('y')) return 'y';
                            if (choices.includes('n')) return 'n';
                            if (choices.includes('q')) return 'q';
                            return choices.charAt(0);
                        }
                        return 'y';
                    };

                    let ansCode = 27;
                    if (typeof rawAns === 'number' && !isNaN(rawAns)) {
                        ansCode = rawAns;
                    } else if (typeof rawAns === 'string' && rawAns.length > 0) {
                        ansCode = rawAns.charCodeAt(0);
                    } else if (def && typeof def === 'string' && def.length > 0) {
                        ansCode = def.charCodeAt(0);
                    }

                    const ansChar = (ansCode > 0 && !isNaN(ansCode)) ? String.fromCharCode(ansCode) : '';

                    // yn_function 安全ガード: Enter(\r/13), LineFeed(\n/10), Space(32), 空回答/NaN/未入力等や未許可文字が返された場合、デフォルト選択肢文字へ安全正規化
                    if (isNaN(ansCode) || ansCode === 13 || ansCode === 10 || ansCode === 32 || ansChar === '\r' || ansChar === '\n' || ansCode <= 0) {
                        const fallbackChar = getSafeFallbackChar();
                        ansCode = fallbackChar ? fallbackChar.charCodeAt(0) : 27;
                    } else if (choices && typeof choices === 'string' && choices.length > 0) {
                        if (!choices.includes(ansChar) && ansCode !== 27) {
                            console.warn(`[NetHackWasmDriver] Invalid char '${ansChar}' (${ansCode}) for yn_function ('${choices}'). Falling back to default.`);
                            const fallbackChar = getSafeFallbackChar();
                            ansCode = fallbackChar ? fallbackChar.charCodeAt(0) : 27;
                        }
                    }

                    return ansCode;
                }

                case "shim_getlin": {
                    const query = args[0];
                    const bufp = args[1];

                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    const promise = this.inputResolver ? this.inputResolver.createPending('getlin', { query }) : Promise.resolve(null);

                    const resolverObj = {
                        respond: (input) => this.inputResolver ? this.inputResolver.respond(input) : null,
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("inputRequired", {
                        context: "getlin",
                        type: "string",
                        query,
                        prompt: query,
                        resolver: resolverObj
                    });

                    const input = await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);

                    const M = this.getModule();
                    const strToUTF8 = (M && M.stringToUTF8) ? M.stringToUTF8.bind(M) : (typeof stringToUTF8 !== 'undefined' ? stringToUTF8 : null);

                    if (input && typeof input === 'string' && strToUTF8) {
                        strToUTF8(input, bufp, 256);
                    }
                    return 0;
                }

                case "shim_get_ext_cmd": {
                    this.setState(NetHackWasmDriver.DriverState.WAITING_INPUT);
                    const promise = this.inputResolver ? this.inputResolver.createPending('get_ext_cmd') : Promise.resolve(-1);

                    const resolverObj = {
                        respond: (val) => {
                            if (!this.inputResolver) return null;
                            if (typeof val === 'string') {
                                let cleanVal = val.trim().toLowerCase();
                                if (cleanVal.startsWith('#')) {
                                    cleanVal = cleanVal.slice(1).trim();
                                }
                                const extcmds = NetHackWasmDriver.DEFAULT_EXTCMDS;
                                const idx = extcmds.indexOf(cleanVal);
                                return this.inputResolver.respond(idx >= 0 ? idx : -1);
                            }
                            return this.inputResolver.respond(typeof val === 'number' ? val : -1);
                        },
                        cancel: () => this.inputResolver ? this.inputResolver.cancel() : null
                    };

                    this.emit("inputRequired", {
                        context: "get_ext_cmd",
                        type: "ext_cmd",
                        resolver: resolverObj
                    });

                    const idx = await promise;
                    this.setState(NetHackWasmDriver.DriverState.RUNNING);
                    return typeof idx === 'number' ? idx : -1;
                }

                case "shim_status_update": {
                    const decoded = this.memory ? this.memory.parseStatusUpdate(args[0], args[1], args[2], args[4]) : { field: args[0], value: args[1] };
                    if (decoded.fld === 35) { // BL_VERS
                        this.version = decoded.rawVal || "";
                    }
                    this.emit("status_update", decoded);
                    return 0;
                }

                case "shim_nhbell":
                    this.emit("bell", {});
                    return 0;

                case "shim_cliparound":
                    this.emit("cliparound", { x: args[0], y: args[1] });
                    return 0;

                case "shim_delay_output":
                    await new Promise(resolve => setTimeout(resolve, 50));
                    return 0;

                default:
                    return 0;
            }
        }

        sendInput(value) {
            return this.inputResolver ? this.inputResolver.respond(value) : false;
        }

        /**
         * 仮想 FS 上のセーブファイル一覧を取得
         */
        listSaveFiles() {
            const FS = (this.fsManager && this.fsManager.FS) ? this.fsManager.FS : (typeof globalThis !== 'undefined' && globalThis.FS ? globalThis.FS : null);
            if (!FS) return [];
            try {
                const saveDir = '/save';
                if (!FS.analyzePath(saveDir).exists) return [];
                const files = FS.readdir(saveDir);
                const systemFiles = ['.', '..', 'perm', 'record', 'sysconf', 'logfile', 'xlogfile', 'paniclog', 'bonuses', 'bones'];
                return files
                    .filter(f => !systemFiles.includes(f) && !f.startsWith('.'))
                    .map(filename => {
                        const path = `${saveDir}/${filename}`;
                        const stat = FS.stat(path);
                        return {
                            filename,
                            path,
                            size: stat.size,
                            timestamp: new Date(stat.mtime)
                        };
                    });
            } catch (e) {
                console.warn("[NetHackWasmDriver] Error listing save files:", e);
                return [];
            }
        }

        /**
         * 指定されたセーブファイルを VFS および IndexedDB から完全に削除
         */
        async deleteSaveFile(targetFilename) {
            if (this.fsManager) {
                return await this.fsManager.deleteSaveFile(targetFilename);
            }
            const FS = (typeof globalThis !== 'undefined' && globalThis.FS ? globalThis.FS : null);
            if (!FS) return false;
            try {
                const cleanName = targetFilename.replace(/^\/save\//, '');
                const paths = [`/save/${cleanName}`, cleanName];
                let deleted = false;
                paths.forEach(p => {
                    try {
                        if (FS.analyzePath(p).exists) {
                            FS.unlink(p);
                            deleted = true;
                        }
                    } catch(e) {}
                });
                return deleted;
            } catch (e) {
                console.error("[NetHackWasmDriver] Error deleting save file:", e);
                return false;
            }
        }
    }

    global.NetHackWasmDriver = NetHackWasmDriver;
    if (typeof window !== 'undefined') {
        window.NetHackWasmDriver = NetHackWasmDriver;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.NetHackWasmDriver = NetHackWasmDriver;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NetHackWasmDriver;
        module.exports.NetHackWasmDriver = NetHackWasmDriver;
        module.exports.default = NetHackWasmDriver;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));


