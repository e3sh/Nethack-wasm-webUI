function GameManager(g) {

    const d = rogueDefines();
    const f = rogueFuncs();
    const t = rogueTypes();
    const v = {};//globalValiableInit();

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
    if (g.nhMessageExtData) {
        this.UI.trancelate.add_ext_data(g.nhMessageExtData);
    }

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
    this.inputContext = "NORMAL";
    this.inputChoices = "";

    // --- NetHackWasmDriver / WorkerBridge Driver Binding ---
    this.bridge = null;
    this.activeResolver = null;
    this.waitingForInput = false;

    this.setBridge = function (bridge) {
        this.bridge = bridge;
        this.bindDriverEvents(bridge);
    };

    this.bindDriverEvents = function (bridge) {
        if (!bridge) return;

        bridge.on('init_nhwindows', () => {
            if (window.SoundManager) {
                window.SoundManager.init();
            }
        });

        bridge.on('exit_nhwindows', ({ str }) => {
            this.playing = false;
            this.UI.msg(str || "Exiting game.");
            this.UI.nhClear(3); // NHW_MAP
            this.UI.clear(d.DSP_MAIN);
            this.UI.nhCurs(3, 0, 0);
        });

        bridge.on('exited', async ({ exitCode }) => {
            this.playing = false;
            console.log(`[GameManager] Engine exited with code ${exitCode}. Checking save state for game over...`);

            let hasSave = false;
            if (this.bridge && typeof this.bridge.autoDetectSavePlayerName === 'function') {
                try {
                    const saveName = await this.bridge.autoDetectSavePlayerName();
                    if (saveName) hasSave = true;
                } catch (e) { }
            }

            if (hasSave) {
                console.log("[GameManager] Game was saved cleanly.");
                this.UI.msg("Game saved.");
            } else {
                console.log("[GameManager] No save detected. Triggering game over (waitForReplay)...");
                if (typeof this.waitForReplay === 'function') {
                    await this.waitForReplay();
                } else {
                    location.reload();
                }
            }
        });

        bridge.on('create_nhwindow', ({ windowId, type }) => {
            const winId = windowId !== undefined ? windowId : type;
            this.UI.nhPutbufClear();
            this.UI.nhClear(winId);
            this.UI.set_display_window(winId);
            if (type === 1 || winId === 1) {
                this.messageWindowId = winId;
            }
        });

        bridge.on('clear_nhwindow', ({ windowId }) => {
            this.UI.overlapview(false);
            this.UI.nhPutbufClear();
            this.UI.nhClear(windowId);
            this.UI.set_display_window(windowId);
        });

        bridge.on('display_nhwindow', async ({ windowId, blocking, resolver }) => {
            if (windowId === 3) this.playing = true; // NHW_MAP
            this.UI.set_display_window(windowId);
            if (this.UI.nhPutbufReady(windowId)) {
                this.UI.nhClear(windowId);
                const handledPaged = await this.UI.nhPutbufDraw(windowId);
                if (windowId > 3) this.UI.overlapview(true);
                if (!handledPaged && resolver) {
                    this.activeResolver = resolver;
                    this.waitingForInput = true;
                } else if (resolver) {
                    resolver.respond(0);
                }
            } else {
                await this.UI.nhPutbufDraw(windowId);
                if (blocking && resolver) {
                    this.activeResolver = resolver;
                    this.waitingForInput = true;
                } else if (resolver) {
                    resolver.respond(0);
                }
            }
        });

        bridge.on('destroy_nhwindow', ({ windowId }) => {
            this.UI.overlapview(false);
            this.UI.nhPutbufClear();
            this.UI.wclear(d.DSP_WINDOW);
            this.UI.set_display_window(windowId);
        });

        bridge.on('curs', ({ windowId, x, y }) => {
            this.UI.nhCurs(windowId, x, y);
            if (windowId === 3 || windowId === 0) {
                this.UI.nhCliparound(x, y);
            }
        });

        bridge.on('putstr', ({ windowId, attr, text }) => {
            const winId = windowId;
            const isMessageWin = (winId === 1 || (this.messageWindowId !== undefined && winId === this.messageWindowId));

            let translatedMsg = text;
            if (this.UI && this.UI.trancelate && text) {
                try {
                    translatedMsg = this.UI.trancelate.message(text);
                } catch (e) { }
            }

            if (text && typeof text === 'string' && text.trim().length > 0) {
                const rawMsg = text.trim();
                if (isMessageWin && rawMsg.length < 150) {
                    this.messageHistory.push(rawMsg);
                    if (this.messageHistory.length > 200) {
                        this.messageHistory.shift();
                    }
                    if (window.SoundManager) {
                        window.SoundManager.processMessage(rawMsg, translatedMsg);
                    }
                }
            }
            this.UI.nhPutbufAdd(windowId, translatedMsg, "", true);
        });

        bridge.on('print_glyph', ({ windowId, x, y, glyphInfo, bkglyphInfo }) => {
            this.UI.nhPrintGlyph(null, x, y, glyphInfo, bkglyphInfo);
        });

        bridge.on('raw_print', ({ text }) => {
            let translatedMsg = text;
            if (this.UI && this.UI.trancelate && text) {
                try {
                    translatedMsg = this.UI.trancelate.message(text);
                } catch (e) { }
            }
            if (text && typeof text === 'string' && text.trim().length > 0) {
                const rawMsg = text.trim();
                this.messageHistory.push(rawMsg);
                if (this.messageHistory.length > 200) this.messageHistory.shift();

                const lowerMsg = rawMsg.toLowerCase();
                if (lowerMsg.includes("killed by") || lowerMsg.includes("choked on") || lowerMsg.includes("starved") || lowerMsg.includes("died") || lowerMsg.includes("escaped") || lowerMsg.includes("ascended") || lowerMsg.includes("squished") || lowerMsg.includes("poisoned") || lowerMsg.includes("zapped") || lowerMsg.includes("drowned")) {
                    this.lastDeathMsg = rawMsg;
                }

                if (window.SoundManager) {
                    window.SoundManager.processMessage(rawMsg, translatedMsg);
                }
            }
            if (this.playing) {
                this.UI.nhPutStr(translatedMsg, true);
            } else {
                this.UI.nhPutMsg(translatedMsg, true);
            }
        });

        bridge.on('raw_print_bold', ({ text }) => {
            let translatedMsg = text;
            if (this.UI && this.UI.trancelate && text) {
                try {
                    translatedMsg = this.UI.trancelate.message(text);
                } catch (e) { }
            }
            if (text && typeof text === 'string' && text.trim().length > 0) {
                const rawMsg = text.trim();
                this.messageHistory.push(rawMsg);
                if (this.messageHistory.length > 200) this.messageHistory.shift();
                if (window.SoundManager) {
                    window.SoundManager.processMessage(rawMsg, translatedMsg);
                }
            }
            if (this.playing) {
                this.UI.nhPutStr(translatedMsg, true);
            } else {
                this.UI.nhPutMsg(translatedMsg, true);
            }
        });

        bridge.on('display_file', async ({ filename, content }) => {
            this.UI.overlapview(true);
            await this.UI.showText(filename, content);
        });

        bridge.on('bell', () => {
            this.UI.nhBell();
        });

        bridge.on('cliparound', ({ x, y }) => {
            this.UI.nhCliparound(x, y);
        });

        bridge.on('soundTrigger', ({ text }) => {
            if (window.SoundManager && window.SoundManager.playByMessage) {
                window.SoundManager.playByMessage(text);
            }
        });

        bridge.on('start_menu', ({ windowId, behavior }) => {
            this.menuBuffer[windowId] = { behavior, items: [], prompt: "" };
        });

        bridge.on('add_menu', ({ windowId, glyph, glyphInfo, identifier, accelerator, groupacc, attr, color, str, itemflags }) => {
            if (!this.menuBuffer[windowId]) {
                this.menuBuffer[windowId] = { behavior: 0, items: [], prompt: "" };
            }
            const gObj = glyphInfo || (glyph && typeof glyph === 'object' ? glyph : (typeof glyph === 'number' && glyph >= 0 ? { glyph } : null));
            this.menuBuffer[windowId].items.push({
                glyph: gObj,
                glyphInfo: gObj,
                identifier,
                ch: accelerator,
                gch: groupacc,
                attr,
                clr: color,
                str,
                itemflags
            });
        });

        bridge.on('end_menu', ({ windowId, prompt }) => {
            if (this.menuBuffer[windowId]) {
                this.menuBuffer[windowId].prompt = prompt;
            }
            this.inputContext = "MENU";
        });

        bridge.on('display_file', async ({ filename, complain, fileText, resolver }) => {
            let content = fileText || "";
            let targetFilename = filename || "Help";

            if (filename) {
                try {
                    let jpFilename = filename.includes('.') ? filename.replace('.', '_jp.') : `${filename}_jp`;
                    let jpPath = `./dat/${jpFilename}`;
                    let stdPath = `./dat/${filename}`;

                    const isLangJp = (this.define && this.define.LANG_JP) || (window.g && window.g.define && window.g.define.LANG_JP) || window.location.pathname.includes('_jp') || document.title.includes('日本語') || document.title.includes('JP');

                    let loadedJpContent = null;

                    if (isLangJp) {
                        // 1. VFS (仮想ファイルシステム) チェック (_jp)
                        if (typeof FS !== 'undefined' && FS.analyzePath) {
                            if (FS.analyzePath(jpPath).exists) {
                                loadedJpContent = FS.readFile(jpPath, { encoding: 'utf8' });
                            } else if (FS.analyzePath(`/${jpFilename}`).exists) {
                                loadedJpContent = FS.readFile(`/${jpFilename}`, { encoding: 'utf8' });
                            }
                        }

                        // 2. サーバーからの fetch フォールバック (_jp)
                        if (!loadedJpContent) {
                            try {
                                const response = await fetch(jpPath);
                                if (response.ok) {
                                    loadedJpContent = await response.text();
                                }
                            } catch (e) { }
                        }
                    }

                    if (loadedJpContent) {
                        content = loadedJpContent;
                    } else if (!content) {
                        // 英語標準ファイルのフォールバック読み込み
                        if (typeof FS !== 'undefined' && FS.analyzePath && FS.analyzePath(stdPath).exists) {
                            content = FS.readFile(stdPath, { encoding: 'utf8' });
                        } else {
                            const response = await fetch(stdPath);
                            if (response.ok) {
                                content = await response.text();
                            }
                        }
                    }
                } catch (e) {
                    console.warn("[GameManager] display_file fetch fallback failed:", filename, e);
                }
            }

            if (!content && complain) {
                content = `File not found: ${filename}`;
            }

            this.UI.overlapview(true);
            await this.UI.showText(targetFilename, content || `[File: ${filename}]`);
            this.UI.overlapview(false);
            if (resolver) {
                resolver.respond(0);
            }
        });

        bridge.on('inputRequired', (payload) => {
            this.activeResolver = payload.resolver;
            this.waitingForInput = true;
            this.inputContext = payload.type || payload.context || "NORMAL";

            if (payload.type === 'yn' || payload.context === 'yn') {
                this.handleYnInput(payload);
            } else if (payload.type === 'text' || payload.type === 'getlin' || payload.context === 'getlin') {
                this.handleTextInput(payload);
            } else if (payload.type === 'ext_cmd' || payload.context === 'get_ext_cmd') {
                this.handleExtCmdInput(payload);
            } else if (payload.type === 'askname' || payload.context === 'askname') {
                this.handleAskNameInput(payload);
            } else if (payload.type === 'menu' || payload.context === 'select_menu') {
                this.handleMenuInput(payload);
            } else if (payload.type === 'char' || payload.context === 'getch') {
                if (this.UI && this.UI.comment) {
                    this.UI.comment("Press Space or Enter to continue...");
                }
            }
        });

        bridge.on('status_update', ({ field, value, change, color }) => {
            if (this.UI && this.UI.updateStatus) {
                this.UI.updateStatus(field, value, change, color);
            }
        });

        bridge.on('stateChange', ({ state }) => {
            if (state !== 'WAITING_INPUT') {
                this.waitingForInput = false;
            }
        });
    };

    this.handleYnInput = async function (payload) {
        const query = payload.query || payload.question || payload.prompt || "";
        const choices = payload.choices || "";
        const def = payload.def || payload.defaultChoice || "";

        this.inputChoices = choices;
        const c_disp = choices ? `[${choices}]` : "";
        const d_disp = (def && def !== "\u0000") ? `(${def})` : "";

        let translatedQuery = query;
        if (this.UI && this.UI.trancelate && query) {
            try {
                translatedQuery = this.UI.trancelate.message(query);
            } catch (e) { }
        }

        if (this.UI.nhPutbufAdd) {
            this.UI.nhPutbufAdd(1, translatedQuery, `${c_disp}${d_disp}`, true);
        }
    };

    this.handleTextInput = async function (payload) {
        const { prompt } = payload;
        try {
            const input = await this.UI.io.showInput(prompt || "Input:");
            if (this.activeResolver) {
                const resolver = this.activeResolver;
                this.activeResolver = null;
                this.waitingForInput = false;
                resolver.respond(input !== null ? input : "");
            }
        } catch (e) {
            console.error("GameManager text input error:", e);
            if (this.activeResolver) {
                const resolver = this.activeResolver;
                this.activeResolver = null;
                this.waitingForInput = false;
                resolver.cancel();
            }
        }
    };

    this.handleAskNameInput = async function (payload) {
        try {
            let name = "";
            if (this.bridge && this.bridge.autoDetectSavePlayerName) {
                name = await this.bridge.autoDetectSavePlayerName();
            }
            if (!name) {
                name = await this.UI.io.showInput("What is your name?");
            }
            if (!name || name.trim() === "") {
                name = "player";
            }
            if (this.activeResolver) {
                const resolver = this.activeResolver;
                this.activeResolver = null;
                this.waitingForInput = false;
                resolver.respond(name);
            }
        } catch (e) {
            console.error("GameManager askname error:", e);
            if (this.activeResolver) {
                const resolver = this.activeResolver;
                this.activeResolver = null;
                this.waitingForInput = false;
                resolver.respond("player");
            }
        }
    };

    this.handleExtCmdInput = async function (payload) {
        try {
            const prompt = payload.prompt || "# (Extended Command):";
            const input = await this.UI.io.showInput(prompt);
            if (this.activeResolver) {
                const resolver = this.activeResolver;
                this.activeResolver = null;
                this.waitingForInput = false;
                resolver.respond(input !== null ? input : "");
            }
        } catch (e) {
            console.error("GameManager ext_cmd error:", e);
            if (this.activeResolver) {
                const resolver = this.activeResolver;
                this.activeResolver = null;
                this.waitingForInput = false;
                resolver.respond("");
            }
        }
    };

    this.handleMenuInput = async function (payload) {
        const windowId = payload.windowId;
        const menuData = (windowId !== undefined && this.menuBuffer[windowId]) ? this.menuBuffer[windowId] : payload;
        let rawItems = menuData.items || payload.items || payload.menuItems || [];
        const prompt = menuData.prompt || payload.prompt || "";
        const how = payload.how || 1;

        if (!rawItems || rawItems.length === 0) {
            this.UI.overlapview(false);
            if (this.activeResolver) {
                const resolver = this.activeResolver;
                this.activeResolver = null;
                this.waitingForInput = false;
                resolver.respond([]);
            }
            return;
        }

        const items = rawItems.map(item => {
            const gObj = item.glyphInfo || (item.glyph && typeof item.glyph === 'object' ? item.glyph : (typeof item.glyph === 'number' && item.glyph >= 0 ? { glyph: item.glyph } : null));
            return {
                ...item,
                glyph: gObj,
                glyphInfo: gObj
            };
        });

        this.inputChoices = payload.choices || "";
        this.UI.overlapview(true);

        if (this.UI.showMenu) {
            try {
                const selected = await this.UI.showMenu(items, how, prompt);
                this.UI.overlapview(false);
                if (this.activeResolver) {
                    const resolver = this.activeResolver;
                    this.activeResolver = null;
                    this.waitingForInput = false;
                    resolver.respond(selected);
                }
            } catch (e) {
                console.error("handleMenuInput error:", e);
                this.UI.overlapview(false);
                if (this.activeResolver) {
                    const resolver = this.activeResolver;
                    this.activeResolver = null;
                    this.waitingForInput = false;
                    resolver.cancel();
                }
            }
        }
    };

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
        //console.log("GameManager: nethackGlobal.helpers sticky-patched.");
    };

    this.eventHook = async function (type, ...args) {
        // Ensure helpers are not overwritten by Wasm's internal js_helpers_init
        if (!window.nethackGlobal.helpers.isPatched) {
            this.setupNethackGlobal();
            window.nethackGlobal.helpers.isPatched = true;
        }
        const helpers = window.nethackGlobal.helpers;

        let NotImplemented = false;

        if (d.DEBUG_MSG) console.log("NH Event:", type, args);
        this.UI.comment(`NH Event: ${type.slice(5)} `);

        switch (type) {
            //VDECLCB(shim_init_nhwindows,(int *argcp, char **argv), "vpp", P2V argcp, P2V argv)
            case "shim_init_nhwindows":
                if (window.SoundManager) {
                    window.SoundManager.init();
                }
                return 0;
            //DECLCB(boolean, shim_player_selection_or_tty,(void), "b")
            case "shim_player_selection_or_tty":
                //console.log("shim_player_selection_or_tty called. Returning true.");
                return true;
            //VDECLCB(shim_askname,(void), "v")
            case "shim_askname":
                return new Promise(async (resolve) => {
                    //console.log("shim_askname called.");
                    try {
                        let name = "";
                        // Detect save data
                        if (typeof FS !== 'undefined') {
                            try {
                                const saveDir = '/save';
                                if (FS.analyzePath(saveDir).exists) {
                                    const files = FS.readdir(saveDir);
                                    //console.log("Detecting save files in /save:", files);
                                    // NetHack save files are typically 1000Name (UID + Name)
                                    // We exclude system files
                                    const systemFiles = ['.', '..', 'perm', 'record', 'sysconf', 'logfile', 'xlogfile', 'paniclog', 'bonuses', 'bones'];
                                    const saveFile = files.find(f => !systemFiles.includes(f) && !f.startsWith('.'));

                                    if (saveFile) {
                                        // Handle 1000Name pattern
                                        const match = saveFile.match(/^\d+(.+)$/);
                                        if (match) {
                                            name = match[1];
                                            //console.log(`Auto-detected player name from save file: ${name}`);
                                        } else {
                                            name = saveFile;
                                            //console.log(`Using save file name as player name: ${name}`);
                                        }
                                    }
                                }
                            } catch (fsErr) {
                                console.warn("Error while scanning /save for auto-resume:", fsErr);
                            }
                        }

                        if (!name) {
                            name = await this.UI.io.showInput("What is your name?");
                        }

                        if (!name || name.trim() === "") {
                            name = "player";
                        }
                        const plnamePtr = Module._get_plname();
                        if (plnamePtr) {
                            // PL_NSIZ is 32, so max 31 chars + null terminator
                            const safeName = name.substring(0, 31);
                            Module.stringToUTF8(safeName, plnamePtr, 32);
                            //console.log(`Registered player name: ${safeName}`);
                        } else {
                            console.warn("Could not get plname pointer from _get_plname().");
                        }
                    } catch (e) {
                        console.error("plname setup error:", e);
                    }
                    resolve(0);
                });
            //VDECLCB(shim_get_nh_event,(void), "v")
            case "shim_get_nh_event":
                // Handle exposure events or system-level updates. 
                // Mostly a no-op for TTY/X-style ports.
                return 0;
            //VDECLCB(shim_exit_nhwindows,(const char *str), "vs", P2V str)
            case "shim_exit_nhwindows":
                this.playing = false;
                //console.log("Exiting nhwindows...");
                this.UI.msg(args[0] || "Exiting game.");
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
                if (args[0] === 1) { // NHW_MESSAGE
                    this.messageWindowId = args[0];
                }
                return args[0];
            //VDECLCB(shim_clear_nhwindow,(winid window), "vi", A2P window)
            case "shim_clear_nhwindow":
                this.UI.overlapview(false);
                this.UI.nhPutbufClear();
                this.UI.nhClear(args[0]);
                this.UI.set_display_window(args[0]);
                return 0;
            //VDECLCB(shim_display_nhwindow,(winid window, boolean blocking), "vib", A2P window, A2P blocking)
            case "shim_display_nhwindow":
                if (args[0] === 3) this.playing = true; // NHW_MAP
                this.UI.set_display_window(args[0]);
                if (this.UI.nhPutbufReady(args[0])) {
                    this.UI.nhClear(args[0]);
                    const handledPaged = await this.UI.nhPutbufDraw(args[0]);
                    if (args[0] > 3) this.UI.overlapview(true);
                    if (!handledPaged) {
                        await new Promise(
                            resolve => {
                                this.pendingInputResolve = resolve;
                            });
                    }
                } else {
                    await this.UI.nhPutbufDraw(args[0]);
                    if (args[1]) {
                        await new Promise(
                            resolve => {
                                this.pendingInputResolve = resolve;
                            });
                    }
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
                const winId = args[0];
                // 厳密に NHW_MESSAGE (タイプ1) のメッセージウィンドウのみを対象とする
                const isMessageWin = (winId === 1 || (this.messageWindowId !== undefined && winId === this.messageWindowId));

                let translatedMsg = args[2];
                if (this.UI && this.UI.trancelate && args[2]) {
                    try {
                        translatedMsg = this.UI.trancelate.message(args[2]);
                    } catch(e) {}
                }

                if (args[2] && typeof args[2] === 'string' && args[2].trim().length > 0) {
                    const rawMsg = args[2].trim();

                    if (d.DEBUG_MSG) {
                        console.log(`[shim_putstr] winId: ${winId} (isMsgWin: ${isMessageWin}), str: "${rawMsg.slice(0, 40)}"`);
                    }

                    // メッセージウィンドウかつ長文ダイアログ(150文字以上)でない場合のみ発声対象とする
                    if (isMessageWin && rawMsg.length < 150) {
                        this.messageHistory.push(rawMsg);
                        if (this.messageHistory.length > 200) { // Keep last 200 messages
                            this.messageHistory.shift();
                        }
                        if (window.SoundManager) {
                            window.SoundManager.processMessage(rawMsg, translatedMsg);
                        }
                    }
                }
                this.UI.nhPutbufAdd(args[0], translatedMsg, "", true);
                break;
            //VDECLCB(shim_display_file,(const char *name, boolean complain), "vsb", P2V name, A2P complain)
            case "shim_display_file":
                {
                    const filename = args[0];
                    const complain = args[1];

                    // 日本語版ファイル (_jp / _jp.base) の優先チェック
                    let targetFilename = filename;
                    let jpFilename = filename.includes('.') ? filename.replace('.', '_jp.') : `${filename}_jp`;
                    let jpPath = `./dat/${jpFilename}`;
                    let stdPath = `./dat/${filename}`;
                    let path = stdPath;

                    return new Promise(async (resolve) => {
                        try {
                            // 日本語モード (LANG_JP) が有効な場合のみ日本語版ファイルが存在するかチェック
                            const isLangJp = (this.define && this.define.LANG_JP) || (window.g && window.g.define && window.g.define.LANG_JP);
                            if (isLangJp) {
                                try {
                                    const headRes = await fetch(jpPath, { method: 'HEAD' });
                                    if (headRes.ok) path = jpPath;
                                } catch (e) { }
                            }

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
                this.inputContext = "MENU";
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
                    this.inputContext = "MENU";

                    return new Promise(async (resolve) => {
                        // UI 側にメニュー表示を依頼
                        const selectedItems = await r.UI.showMenu(menuData.items, how, menuData.prompt);
                        this.inputContext = "NORMAL";

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
                //this.UI.msg("Press any key");
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
                    this.UI.nhPrintGlyph(null, args[1], args[2], gInfo, bkInfo);
                }
                break;
            //VDECLCB(shim_raw_print,(const char *str), "vs", P2V str)
            case "shim_raw_print":
                {
                    let translatedMsg = args[0];
                    if (this.UI && this.UI.trancelate && args[0]) {
                        try {
                            translatedMsg = this.UI.trancelate.message(args[0]);
                        } catch(e) {}
                    }
                    if (args[0] && typeof args[0] === 'string' && args[0].trim().length > 0) {
                        const rawMsg = args[0].trim();
                        this.messageHistory.push(rawMsg);
                        if (this.messageHistory.length > 200) this.messageHistory.shift();

                        if (window.SoundManager) {
                            window.SoundManager.processMessage(rawMsg, translatedMsg);
                        }
                    }
                    if (this.playing) {
                        this.UI.nhPutStr(translatedMsg, true);
                    } else {
                        this.UI.nhPutMsg(translatedMsg, true);
                    }
                    return 0;
                }
            //VDECLCB(shim_raw_print_bold,(const char *str), "vs", P2V str)
            case "shim_raw_print_bold":
                {
                    let translatedMsg = args[0];
                    if (this.UI && this.UI.trancelate && args[0]) {
                        try {
                            translatedMsg = this.UI.trancelate.message(args[0]);
                        } catch(e) {}
                    }
                    if (args[0] && typeof args[0] === 'string' && args[0].trim().length > 0) {
                        const rawMsg = args[0].trim();
                        this.messageHistory.push(rawMsg);
                        if (this.messageHistory.length > 200) this.messageHistory.shift();

                        if (window.SoundManager) {
                            window.SoundManager.processMessage(rawMsg, translatedMsg);
                        }
                    }
                    if (this.playing) {
                        this.UI.nhPutStr(translatedMsg, true);
                    } else {
                        this.UI.nhPutMsg(translatedMsg, true);
                    }
                    return 0;
                }
            //DECLCB(int, shim_nhgetch,(void), "i")
            case "shim_nhgetch":
                if (window.SoundManager) window.SoundManager.unlockAudio();
                this.inputContext = "NORMAL";
                return new Promise(resolve => {
                    this.pendingInputResolve = resolve;
                });
            //DECLCB(int, shim_nh_poskey,(coordxy *x, coordxy *y, int *mod), "ippp", P2V x, P2V y, P2V mod)
            case "shim_nh_poskey":
                if (window.SoundManager) window.SoundManager.unlockAudio();
                //this.inputContext = "POS";　//通常の操作でも呼ばれるので注釈にする
                return new Promise((resolve) => {
                    r.pendingInputResolve = (charCode, x, y, mod) => {
                        this.inputContext = "NORMAL";
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
                const query = args[0];
                const choices = args[1];
                const def = args[2];
                let key;
                this.inputContext = "YN";
                this.inputChoices = choices;
                this.UI.set_display_window(0);
                const anyKey = !choices || choices.length === 0;

                const c_disp = (Boolean(args[1])) ? `[${choices}]` : "";
                const d_disp = (args[2] !== "\u0000") ? `(${def})` : "";

                while (true) {
                    this.UI.nhPutbufAdd(1, query, `${c_disp}${d_disp}`);
                    key = await new Promise(resolve => {
                        this.pendingInputResolve = resolve;
                    });

                    // 1. ENTER (13) または SPACE (32) が押された場合、デフォルト値を返す
                    if ((key === 13 || key === 32) && def !== "\u0000") {
                        this.UI.msg(def);
                        return def.charCodeAt(0);
                    }

                    // 2. ESC (27) が押された場合、'q' または 'n' があればそれを優先して返す
                    if (key === 27) {
                        this.UI.msg("Cancel");
                        if (choices.includes('q')) return 'q'.charCodeAt(0);
                        if (choices.includes('n')) return 'n'.charCodeAt(0);
                    }

                    // 3. 入力されたキーが有効な選択肢に含まれているか、または何でもOKな場合
                    const char = String.fromCharCode(key);
                    if (anyKey || choices.includes(char)) {
                        this.UI.msg(char);
                        this.inputContext = "NORMAL";
                        this.inputChoices = "";
                        return key;
                    }

                    // 無効な入力の場合はループを継続（再表示）
                }
            }
            //VDECLCB(shim_getlin,(const char *query, char *bufp), "vsp", P2V query, P2V bufp)
            case "shim_getlin":
                {
                    const query = args[0];
                    const bufp = args[1];
                    this.inputContext = "LIN";
                    return new Promise(async (resolve) => {
                        const input = await r.UI.io.showInput(query);
                        this.inputContext = "NORMAL";
                        if (input !== null) {
                            Module.stringToUTF8(input, bufp, 256); // BUFSZ is 256
                        }
                        resolve(0);
                    });
                }
            //DECLCB(int,shim_get_ext_cmd,(void),"iv")
            case "shim_get_ext_cmd": return new Promise(async (resolve) => {
                const input = await r.UI.io.showInput("#");
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
                console.log("shim_number_pad");
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
                    this.UI.nhPutStr(`${args[0]}`);
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

    this.isModalActive = function () {
        const mobileInput = document.getElementById("mobile-input-container");
        if (mobileInput && mobileInput.style.display !== 'none' && mobileInput.style.display !== '') return true;

        const overlay = document.getElementById("modal-input-overlay") || document.getElementById("input-overlay");
        if (overlay && overlay.style.display !== 'none' && overlay.style.display !== '') return true;

        if (this.UI && (this.UI.inputOverlayActive || this.UI.modalActive)) return true;

        return false;
    };

    this.isWaitingForInput = function () {
        if (this.bridge) {
            return this.waitingForInput || (this.bridge.state === 'WAITING_INPUT');
        }
        return this.pendingInputResolve !== null;
    };

    this.sendKey = function (keyName, shift, ctrl, alt) {
        if (this.isModalActive() && !this.pendingInputResolve) {
            if (d && d.DEBUG_MSG) {
                console.log("[sendKey] Ignored because modal input is active.");
            }
            return false;
        }

        const charCode = this.convertKeyCode(keyName, shift, ctrl, alt);
        if (d && d.DEBUG_MSG) {
            console.log(`[sendKey] keyName=${keyName}, shift=${shift}, ctrl=${ctrl}, alt=${alt} => charCode=${charCode} ('${String.fromCharCode(charCode)}')`);
        }

        // 1. UIManager (showMenu / showInput 等) がキーフックしている場合は最優先で呼び出し
        if (this.pendingInputResolve) {
            const resolve = this.pendingInputResolve;
            this.pendingInputResolve = null;
            resolve(charCode);
            return true;
        }

        // 2. pendingInputResolve がない場合に Worker の activeResolver へ送る
        if (this.activeResolver) {
            const resolver = this.activeResolver;
            this.activeResolver = null;
            this.waitingForInput = false;
            resolver.respond(charCode);
            return true;
        }

        if (this.bridge && charCode > 0) {
            this.bridge.sendInput(charCode);
            return true;
        }
        return false;
    };

    this.convertKeyCode = function (keyName, shift, ctrl, alt) {
        // 1. IntlRo (JIS '#' キー), Shift + Digit3, Hash/# の明示的ガード
        if (keyName === 'IntlRo' || (keyName === 'Digit3' && shift) || keyName === 'Hash' || keyName === '#') {
            return '#'.charCodeAt(0); // 35 ('#')
        }

        // 2. keyName 自体が 1 文字の記号・文字そのもの（例: '#', '?', 'i' 等）である場合は ASCII コードを優先返却
        if (typeof keyName === 'string' && keyName.length === 1 && !ctrl && !alt) {
            return keyName.charCodeAt(0);
        }

        const map = d.KEYMAP;
        let code = 0;

        if (map[keyName]) {
            if (ctrl) {
                code = map[keyName][2] || 0;
            } else if (shift) {
                code = map[keyName][1] || 0;
            } else {
                code = map[keyName][0] || 0;
            }
        } else if (typeof keyName === 'string' && keyName.length > 0) {
            code = keyName.charCodeAt(0);
        }

        if (alt && code > 0) {
            code |= 0x80;
        }

        return code;
    };

    // --- Main Entry ---

    this.main = function (wasmJsUrl) {
        this.UI.mvwaddstr(d.DSP_STATUS, 1, 0, "Nethack-wasm-WebUI");

        console.log(`Use Glyph:${d.USE_GLYPH}`);
        if (d.USE_GLYPH) {
            g.console[d.DSP_MAIN].setMapMode(true);
            g.console[d.DSP_MAIN].setPrompt(["＿", "＿"]);
        }

        this.UI.updateTileMapping(null);

        // WorkerBridge 経由の起動モデル (標準)
        if (this.bridge) {
            console.log("[GameManager] Initializing NetHack via NetHackWasmWorkerBridge...");
            const targetWasmJs = wasmJsUrl || (window.location.pathname.includes('_jp') ? "nethack_jp.js" : "nethack.js");

            this.bridge.once('initialized', () => {
                console.log("[GameManager] Worker initialized. Starting NetHack Wasm engine...");
                this.bridge.start();
            });

            this.bridge.on('error', (err) => {
                console.error("[GameManager] WorkerBridge Error:", err);
            });

            this.bridge.init(targetWasmJs, {
                args: ['nethack', '-otime,showexp,showvers,number_pad']
            });
            return;
        }

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

            // --- Fetch NetHack Constants for Dynamic Tile Mapping ---
            // C側の追加コード最小化のため、定数はJavaScript側で完結させます。
            console.log("Applying default NetHack 5.0.0 constants for tile mapping...");
            this.UI.updateTileMapping(null);

            setTimeout(() => {
                try {
                    const startEngine = () => {
                        const syncToPersistent = () => {
                            const persistentFiles = ['record', 'logfile', 'xlogfile', 'paniclog'];
                            persistentFiles.forEach(f => {
                                try {
                                    const rootPath = '/' + f;
                                    const savePath = '/save/' + f;
                                    
                                    if (typeof FS === 'undefined') return;

                                    const rootExists = FS.analyzePath(rootPath).exists;
                                    const saveExists = FS.analyzePath(savePath).exists;

                                    if (rootExists && saveExists) {
                                        const rootTime = FS.stat(rootPath).mtime.getTime();
                                        const saveTime = FS.stat(savePath).mtime.getTime();

                                        if (saveTime > rootTime) {
                                            const data = FS.readFile(savePath);
                                            FS.writeFile(rootPath, data);
                                            console.log(`NH Exit: Synced save ${savePath} -> root ${rootPath} (save is newer)`);
                                        } else if (rootTime > saveTime) {
                                            const data = FS.readFile(rootPath);
                                            FS.writeFile(savePath, data);
                                            console.log(`NH Exit: Synced root ${rootPath} -> save ${savePath} (root is newer)`);
                                        }
                                    } else if (rootExists && !saveExists) {
                                        const data = FS.readFile(rootPath);
                                        FS.writeFile(savePath, data);
                                        console.log(`NH Exit: Synced root ${rootPath} -> save ${savePath} (save did not exist)`);
                                    } else if (!rootExists && saveExists) {
                                        const data = FS.readFile(savePath);
                                        FS.writeFile(rootPath, data);
                                        console.log(`NH Exit: Synced save ${savePath} -> root ${rootPath} (root did not exist)`);
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
                        let extraOptions = "";
                        try {
                            const savedConfig = JSON.parse(localStorage.getItem("nh.config"));
                            if (savedConfig && savedConfig.extra_options) {
                                extraOptions = savedConfig.extra_options; // 多行・カンマなし
                            }
                        } catch (e) { }


                        // Definitive arguments list (Ignoring hardcoded Module.arguments)
                        const coreOptions = "number_pad:1,tombstone";

                        const args = (Module.arguments && Module.arguments.length > 0)
                            ? [...Module.arguments]
                            : ['nethack', `-o${coreOptions}`, `--nethackrc:/.nethackrc`];

                        // Ensure --nethackrc is present
                        if (!args.some(arg => arg.startsWith('--nethackrc'))) {
                            args.push("--nethackrc:/.nethackrc");
                        }

                        // extraOptionsの各行をサニタイズして適用
                        if (extraOptions) {
                            const lines = extraOptions.split('\n');
                            // 単一行で代入式でない場合は -o に追加を試みる
                            if (lines.length === 1 && !lines[0].includes('=')) {
                                let clean = lines[0].replace(/^[, \t]+/, '').replace(/[, \t]+$/, '').trim();
                                if (clean) {
                                    let optIdx = args.findIndex(a => a.startsWith('-o'));
                                    if (optIdx !== -1) {
                                        // 既存の末尾がカンマでないことを確認して結合
                                        if (!args[optIdx].endsWith(',')) args[optIdx] += ",";
                                        args[optIdx] += clean;
                                    } else {
                                        args.push("-o" + clean);
                                    }
                                }
                            }
                        }






                        if (typeof ENV !== 'undefined') {
                            const optArg = args.find(a => a.startsWith('-o'));
                            ENV.NETHACKOPTIONS = optArg ? optArg.slice(2) : "";
                        }


                        const argc = args.length;
                        const argv = Module._malloc((argc + 1) * 4);
                        for (let i = 0; i < argc; i++) {
                            const str = args[i];
                            const strPtr = Module._malloc(str.length + 1);
                            Module.stringToUTF8(str, strPtr, str.length + 1);
                            Module.setValue(argv + i * 4, strPtr, '*');
                        }
                        Module.setValue(argv + argc * 4, 0, '*');




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
                            result.then(async (r) => {
                                console.log("NetHack Engine Exited with:", r);
                                this.playing = false;
                                syncToPersistent();
                                await this.waitForReplay();
                            })
                                .catch(async (err) => {
                                    if (err.name === 'ExitStatus') {
                                        console.log("NetHack Engine Exited Successfully with status:", err.status);
                                        this.playing = false;
                                        this.UI.msg(`NetHack ${this.get_nhVersion()}(wasm) Exit`);
                                        syncToPersistent();
                                        await this.waitForReplay();
                                        return;
                                    }
                                    console.error("NetHack Engine Runtime Error:", err);
                                    syncToPersistent();
                                    await this.waitForReplay();
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
                                    let extraOptions = "";
                                    try {
                                        const savedConfig = JSON.parse(localStorage.getItem("nh.config"));
                                        if (savedConfig && savedConfig.extra_options) {
                                            extraOptions = savedConfig.extra_options;
                                        }
                                    } catch (e) { }

                                    let configContent = `SCOREDIR=/save/\nSAVEDIR=/save/\nLEVELDIR=/\nOPTIONS=time,showexp,showvers,number_pad,tombstone\n`;
                                    if (extraOptions) {
                                        extraOptions.split('\n').forEach(line => {
                                            // 先頭・末尾のカンマと空白を除去
                                            let trimmed = line.trim().replace(/^[, \t]+/, '').replace(/[, \t]+$/, '').trim();
                                            if (trimmed) {
                                                if (trimmed.includes('=') || trimmed.startsWith('#')) {
                                                    configContent += trimmed + "\n";
                                                } else {
                                                    configContent += `OPTIONS=${trimmed}\n`;
                                                }
                                            }
                                        });
                                    }


                                    configFiles.forEach(cf => {
                                        const path = '/' + cf;
                                        // 常に最新の設定を書き込む
                                        FS.writeFile(path, configContent);
                                        console.log(`NH Bootstrap: Updated config file ${path}`);
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

    this.findVfsFile = function (filenames) {
        if (typeof FS === 'undefined' || !FS.analyzePath) return null;
        for (let name of filenames) {
            const paths = [name, `/${name}`, `./${name}`, `/save/${name}`, `./dat/${name}`];
            for (let path of paths) {
                try {
                    if (FS.analyzePath(path).exists) {
                        const data = FS.readFile(path, { encoding: 'utf8' });
                        if (data && data.trim() !== "") {
                            return data;
                        }
                    }
                } catch (e) { }
            }
        }
        return null;
    };

    this.parseLastRecord = function () {
        try {
            const recordData = this.findVfsFile(['record']);
            if (!recordData) return null;

            const lines = recordData.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            if (!lastLine) return null;

            const parts = lastLine.split(' ');
            if (parts.length < 15) return null;

            const version = parts[0];
            const points = parseInt(parts[1]) || 0;
            const deathDnum = parseInt(parts[2]) || 0;
            const deathLev = parseInt(parts[3]) || 0;
            const maxLvl = parseInt(parts[4]) || 0;
            const hp = parseInt(parts[5]) || 0;
            const maxHp = parseInt(parts[6]) || 0;
            const deaths = parseInt(parts[7]) || 0;
            const deathDate = parts[8];
            const birthDate = parts[9];
            const uid = parts[10];
            const role = parts[11];
            const race = parts[12];
            const gender = parts[13];
            const align = parts[14];

            const rest = parts.slice(15).join(' ');
            const commaIdx = rest.indexOf(',');
            let name = "player";
            let death = "unknown";
            if (commaIdx !== -1) {
                name = rest.substring(0, commaIdx);
                death = rest.substring(commaIdx + 1);
            } else {
                name = rest;
            }

            return {
                version, points, deathDnum, deathLev, maxLvl, hp, maxHp,
                deaths, deathDate, birthDate, uid, role, race, gender, align,
                name, death
            };
        } catch (e) {
            console.error("Failed to parse record file:", e);
            return null;
        }
    };

    this.parseLastLog = function () {
        try {
            const logData = this.findVfsFile(['logfile']);
            if (!logData) return null;

            const lines = logData.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            if (!lastLine) return null;

            const parts = lastLine.split(' ');
            if (parts.length < 15) return null;

            const version = parts[0];
            const points = parseInt(parts[1]) || 0;
            const deathDnum = parseInt(parts[2]) || 0;
            const deathLev = parseInt(parts[3]) || 0;
            const maxLvl = parseInt(parts[4]) || 0;
            const hp = parseInt(parts[5]) || 0;
            const maxHp = parseInt(parts[6]) || 0;
            const deaths = parseInt(parts[7]) || 0;
            const deathDate = parts[8];
            const birthDate = parts[9];
            const uid = parts[10];
            const role = parts[11];
            const race = parts[12];
            const gender = parts[13];
            const align = parts[14];

            const rest = parts.slice(15).join(' ');
            const commaIdx = rest.indexOf(',');
            let name = "player";
            let death = "unknown";
            if (commaIdx !== -1) {
                name = rest.substring(0, commaIdx);
                death = rest.substring(commaIdx + 1);
            } else {
                name = rest;
            }

            return {
                version, points, deathDnum, deathLev, maxLvl, hp, maxHp,
                deaths, deathDate, birthDate, uid, role, race, gender, align,
                name, death
            };
        } catch (e) {
            console.error("Failed to parse logfile:", e);
            return null;
        }
    };

    this.parseLastXlog = function () {
        try {
            const xlogData = this.findVfsFile(['xlogfile']);
            if (!xlogData) return null;

            const lines = xlogData.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            if (!lastLine) return null;

            const parts = lastLine.split('\t');
            const entry = {};
            parts.forEach(p => {
                const idx = p.indexOf('=');
                if (idx !== -1) {
                    const k = p.substring(0, idx);
                    const v = p.substring(idx + 1);
                    entry[k] = v;
                }
            });

            if (!entry.name) return null;

            return {
                version: entry.version || "1.0",
                points: parseInt(entry.points) || 0,
                deathDnum: parseInt(entry.deathdnum) || 0,
                deathLev: parseInt(entry.deathlev) || 0,
                maxLvl: parseInt(entry.maxlvl) || 0,
                hp: parseInt(entry.hp) || 0,
                maxHp: parseInt(entry.maxhp) || 0,
                deaths: parseInt(entry.deaths) || 0,
                deathDate: entry.deathdate,
                birthDate: entry.birthdate,
                uid: entry.uid,
                role: entry.role || "???",
                race: entry.race || "???",
                gender: entry.gender || "???",
                align: entry.align || "???",
                name: entry.name,
                death: entry.death || "unknown"
            };
        } catch (e) {
            console.error("Failed to parse xlogfile:", e);
            return null;
        }
    };

    this.parseRecordList = function () {
        const list = [];

        // 1. localStorage から過去ランキングの読み込み
        try {
            const localScores = localStorage.getItem("nethack_webui_topten");
            if (localScores) {
                const parsed = JSON.parse(localScores);
                if (Array.isArray(parsed)) {
                    list.push(...parsed);
                }
            }
        } catch (e) { }

        // 2. VFS 上の各種スコアファイル探索 (record, logfile, xlogfile など)
        if (typeof FS !== 'undefined') {
            const possiblePaths = ['record', '/record', './record', '/save/record', './dat/record', 'logfile', 'xlogfile'];
            for (let path of possiblePaths) {
                try {
                    if (FS.analyzePath && FS.analyzePath(path).exists) {
                        const recordData = FS.readFile(path, { encoding: 'utf8' });
                        if (recordData && recordData.trim() !== "") {
                            const lines = recordData.trim().split('\n');
                            for (let line of lines) {
                                if (!line.trim()) continue;
                                const parts = line.split(' ');
                                if (parts.length >= 15) {
                                    const points = parseInt(parts[1]) || 0;
                                    const deathLev = parseInt(parts[3]) || 0;
                                    const maxLvl = parseInt(parts[4]) || 0;
                                    const hp = parseInt(parts[5]) || 0;
                                    const maxHp = parseInt(parts[6]) || 0;
                                    const role = parts[11];
                                    const race = parts[12];
                                    const gender = parts[13];
                                    const align = parts[14];

                                    const rest = parts.slice(15).join(' ');
                                    const commaIdx = rest.indexOf(',');
                                    let name = "player";
                                    let death = "unknown";
                                    if (commaIdx !== -1) {
                                        name = rest.substring(0, commaIdx);
                                        death = rest.substring(commaIdx + 1);
                                    } else {
                                        name = rest;
                                    }

                                    list.push({
                                        points, deathLev, maxLvl, hp, maxHp, role, race, gender, align, name, death
                                    });
                                }
                            }
                        }
                    }
                } catch (e) { }
            }
        }

        // 重複除去 (points, name, deathLev が同一の項目)
        const uniqueList = [];
        const seen = new Set();
        for (let item of list) {
            const key = `${item.name}-${item.points}-${item.deathLev}-${item.death}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueList.push(item);
            }
        }

        uniqueList.sort((a, b) => (b.points || 0) - (a.points || 0));
        return uniqueList.slice(0, 10);
    };

    this.waitForReplay = async function () {
        console.log("[DEBUG] waitForReplay started. this.UI:", this.UI);
        console.log("[DEBUG] this.UI.showGameOverModal type:", typeof this.UI.showGameOverModal);
        
        this.UI.msg("--- Game Over ---");
        
        let currentPlayerName = "player";
        if (typeof Module !== 'undefined' && typeof Module._get_plname === 'function') {
            try {
                const ptr = Module._get_plname();
                if (ptr) {
                    currentPlayerName = Module.UTF8ToString(ptr) || "player";
                }
            } catch (e) {
                console.warn("[DEBUG] Failed to get plname from Module:", e);
                if (globalThis.svp && globalThis.svp.plname) {
                    currentPlayerName = globalThis.svp.plname;
                }
            }
        } else if (globalThis.svp && globalThis.svp.plname) {
            currentPlayerName = globalThis.svp.plname;
        }
        
        let record = this.parseLastXlog() || this.parseLastLog() || this.parseLastRecord();
        let topTen = this.parseRecordList();
        
        // Extract current in-game status for verification and fallback
        let inGameDeathLev = 1;
        let inGameHp = 0;
        let inGameMaxHp = 1;
        let inGameScore = 0;
        let inGameRole = "Hero", inGameRace = "Hum", inGameGender = "Mal", inGameAlign = "Neu";

        if (this.UI && this.UI.io && typeof this.UI.io.getStatusFields === 'function') {
            const currentStatus = this.UI.io.getStatusFields();
            if (currentStatus) {
                // Dlevel (field 20)
                if (currentStatus[20] && currentStatus[20].value !== undefined) {
                    const dval = String(currentStatus[20].value);
                    const match = dval.match(/\d+/);
                    if (match) inGameDeathLev = parseInt(match[0]);
                }

                // HP / MaxHP (fields 18, 19)
                if (currentStatus[18] && currentStatus[18].value !== undefined) {
                    inGameHp = parseInt(currentStatus[18].value) || 0;
                }
                if (currentStatus[19] && currentStatus[19].value !== undefined) {
                    inGameMaxHp = parseInt(currentStatus[19].value) || 1;
                }

                // Score / Gold (fields 22, 21, 2)
                if (currentStatus[22] && currentStatus[22].value !== undefined) {
                    const sval = String(currentStatus[22].value);
                    const smatch = sval.match(/\d+/);
                    if (smatch) inGameScore = parseInt(smatch[0]);
                }
                if (!inGameScore && currentStatus[21] && currentStatus[21].value !== undefined) {
                    const gval = String(currentStatus[21].value);
                    const gmatch = gval.match(/\d+/);
                    if (gmatch) inGameScore = parseInt(gmatch[0]);
                }
                if (!inGameScore && currentStatus[2] && currentStatus[2].value !== undefined) {
                    const gval2 = String(currentStatus[2].value);
                    const gmatch2 = gval2.match(/\d+/);
                    if (gmatch2) inGameScore = parseInt(gmatch2[0]);
                }

                // Role / Title (field 0)
                if (currentStatus[0] && currentStatus[0].value) {
                    const titleStr = String(currentStatus[0].value);
                    if (titleStr.includes(" the ")) {
                        const rankTitle = titleStr.split(" the ")[1];
                        if (rankTitle) inGameRole = rankTitle.trim();
                    } else {
                        inGameRole = titleStr.trim();
                    }
                }
            }
        }

        // 死因 (this.lastDeathMsg / messageHistory)
        let deathReason = this.lastDeathMsg || "";
        if (!deathReason && this.messageHistory && this.messageHistory.length > 0) {
            for (let i = this.messageHistory.length - 1; i >= 0; i--) {
                const msg = this.messageHistory[i];
                const lmsg = msg.toLowerCase();
                if (lmsg.includes("killed by") || lmsg.includes("choked on") || lmsg.includes("starved") || lmsg.includes("died") || lmsg.includes("escaped") || lmsg.includes("ascended") || lmsg.includes("squished") || lmsg.includes("poisoned") || lmsg.includes("zapped") || lmsg.includes("drowned")) {
                    deathReason = msg;
                    break;
                }
            }
        }
        if (!deathReason) {
            deathReason = "died in the dungeon";
        }

        record = {
            name: currentPlayerName,
            points: (record && record.points) ? record.points : inGameScore,
            deathLev: (record && record.deathLev) ? record.deathLev : inGameDeathLev,
            maxLvl: Math.max(inGameDeathLev, 1),
            hp: inGameHp,
            maxHp: inGameMaxHp,
            role: (record && record.role && record.role !== "???") ? record.role : inGameRole,
            race: (record && record.race && record.race !== "???") ? record.race : inGameRace,
            gender: (record && record.gender && record.gender !== "???") ? record.gender : inGameGender,
            align: (record && record.align && record.align !== "???") ? record.align : inGameAlign,
            death: (record && record.death && record.death !== "unknown" && record.death !== "died") ? record.death : deathReason
        };
        console.log("[DEBUG] Final record built for game over:", record);

        // 今回の record が topTen に存在しなければ追加し、最新ランキングを更新・永続化
        if (record) {
            const existsInTopTen = topTen.some(t => t.name === record.name && t.points === record.points && t.deathLev === record.deathLev);
            if (!existsInTopTen) {
                topTen.push(record);
                topTen.sort((a, b) => (b.points || 0) - (a.points || 0));
                topTen = topTen.slice(0, 10);
            }
        }
        try {
            localStorage.setItem("nethack_webui_topten", JSON.stringify(topTen));
        } catch(e) {}

        if (typeof this.UI.showGameOverCanvas === 'function') {
            console.log("[DEBUG] Calling showGameOverCanvas...");
            try {
                await this.UI.showGameOverCanvas(record, topTen);
            } catch (err) {
                console.error("[DEBUG] Error inside showGameOverCanvas:", err);
                this.UI.msg("[DEBUG] showGameOverCanvas failed: " + err.message);
            }
        } else {
            console.warn("[DEBUG] showGameOverCanvas is not a function!");
            this.UI.msg("[DEBUG] showGameOverCanvas is undefined");
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.UI.msg("Press Space or Tap to Replay");
            this.inputContext = "NORMAL";
            await new Promise(resolve => {
                this.pendingInputResolve = resolve;
            });
        }
        
        location.reload();
    };

    /**
     * paniclog の内容を読み込んでコンソールに出力・テキスト返却するデバッグ・診断ヘルパー
     */
    this.readPanicLog = function () {
        const filenames = ['paniclog', 'paniclog.txt'];
        const content = this.findVfsFile(filenames);
        if (content) {
            console.warn("[PanicLog Detected]\n" + content);
            return content;
        } else {
            console.log("[PanicLog] No paniclog entries found in VFS.");
            return null;
        }
    };

    /**
     * 現行の WebWorker / FS 状態に対応したセーブファイル確認および一覧取得
     */
    this.getSaveStatus = async function () {
        let saveName = "";
        let saveFiles = [];
        if (this.bridge) {
            try {
                if (typeof this.bridge.autoDetectSavePlayerName === 'function') {
                    saveName = await this.bridge.autoDetectSavePlayerName();
                }
                if (typeof this.bridge.listSaveFiles === 'function') {
                    saveFiles = await this.bridge.listSaveFiles();
                }
            } catch (e) {
                console.warn("[GameManager] getSaveStatus error:", e);
            }
        }
        return {
            hasSave: Boolean(saveName || saveFiles.length > 0),
            saveName: saveName || (saveFiles[0] ? saveFiles[0].playerName : ""),
            saveFiles: saveFiles
        };
    };

    this.listSaveFiles = async function () {
        if (this.bridge && typeof this.bridge.listSaveFiles === 'function') {
            return await this.bridge.listSaveFiles();
        }
        return [];
    };

    this.deleteSaveFile = async function (filename) {
        if (this.bridge && typeof this.bridge.deleteSaveFile === 'function') {
            return await this.bridge.deleteSaveFile(filename);
        }
        return false;
    };
}