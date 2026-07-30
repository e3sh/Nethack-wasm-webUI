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
            if (this.UI && typeof this.UI.comment === 'function') {
                this.UI.comment(state);
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

            // config.html 等で保存された nh.config (extra_options) の読み込み
            let extraOptions = "";
            if (typeof localStorage !== 'undefined') {
                try {
                    const savedConfig = JSON.parse(localStorage.getItem("nh.config"));
                    if (savedConfig && savedConfig.extra_options) {
                        extraOptions = savedConfig.extra_options;
                    }
                } catch (e) { }
            }

            this.bridge.once('initialized', () => {
                console.log("[GameManager] Worker initialized. Starting NetHack Wasm engine...");
                this.bridge.start();
            });

            this.bridge.on('error', (err) => {
                console.error("[GameManager] WorkerBridge Error:", err);
            });

            this.bridge.init(targetWasmJs, {
                args: ['nethack', '-otime,showexp,showvers,number_pad'],
                extraOptions: extraOptions
            });
            return;
        }

        console.warn("[GameManager] WorkerBridge is not attached. Please attach WorkerBridge using setBridge(bridge) before calling main().");
    };

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