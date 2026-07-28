/**
 * NetHackWasmDriver.js
 * 
 * NetHack 5.0 Wasm コア (C / winshim.c) と Client UI を繋ぐ汎用ドライバークラス。
 * Wasm Shim イベントのデコード、状態管理、Asyncify 安全レスポンダーの制御を行う。
 */

// Dependency checks (Universal mode support)
let NetHackMemoryRef = typeof NetHackMemory !== 'undefined' ? NetHackMemory : null;
let InputResolverRef = typeof InputResolver !== 'undefined' ? InputResolver : null;

if (typeof require !== 'undefined') {
    if (!NetHackMemoryRef) try { NetHackMemoryRef = require('./NetHackMemory'); } catch (e) {}
    if (!InputResolverRef) try { InputResolverRef = require('./InputResolver'); } catch (e) {}
}

/**
 * ドライバの動作状態列挙体
 */
const DriverState = Object.freeze({
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    WAITING_INPUT: 'WAITING_INPUT',
    WAITING_MENU: 'WAITING_MENU',
    STOPPED: 'STOPPED'
});

const DEFAULT_EXTCMDS = [
    "?", "adjust", "annotate", "apply", "attributes", "autopickup",
    "bugreport", "call", "cast", "chat", "chronicle", "close", "conduct",
    "debugfuzzer", "dip", "down", "drop", "droptype", "eat", "engrave",
    "enhance", "exploremode", "fight", "fire", "force", "genocided",
    "glance", "help", "herecmdmenu", "history", "inventory", "inventtype",
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
    "therecmdmenu", "throw", "timeout", "tip", "travel", "turn",
    "twoweapon", "untrap", "up", "vanquished", "version", "versionshort",
    "vision", "wait", "wear", "whatdoes", "whatis", "wield", "wipe"
];

class NetHackWasmDriver {
    /**
     * @param {Object} [options]
     * @param {Object} [options.wasmModule] - Emscripten Module
     * @param {number} [options.inputTimeoutMs=30000] - 入力安全タイムアウト (ms)
     * @param {boolean} [options.debug=false] - デバッグログの出力有無
     * @param {string[]} [options.extCmds] - 拡張コマンドリスト
     */
    constructor(options = {}) {
        this.options = Object.assign({
            wasmModule: null,
            inputTimeoutMs: 30000,
            debug: false,
            extCmds: DEFAULT_EXTCMDS
        }, options);

        const MemoryClass = NetHackMemoryRef || window.NetHackMemory;
        if (!MemoryClass) {
            throw new Error("NetHackWasmDriver: NetHackMemory is not loaded.");
        }

        this.memory = new MemoryClass(this.options.wasmModule);
        this._state = DriverState.IDLE;
        this.listeners = new Map();
        this.activeResolver = null;

        // Menu buffer (windowId -> { behavior, items: [], prompt: "" })
        this.menuBuffer = {};
        this.messageHistory = [];
        this.historyIndex = 0;

        // Bind eventHook
        this.eventHook = this.eventHook.bind(this);
    }

    /**
     * 現在のドライバ動作状態を取得
     * @returns {string}
     */
    get state() {
        return this._state;
    }

    /**
     * ドライバ動作状態を設定し、変更通知を発行
     * @param {string} newState
     */
    set state(newState) {
        if (this._state !== newState) {
            const oldState = this._state;
            this._state = newState;
            this.emit('stateChange', { state: newState, oldState });
        }
    }

    /**
     * NetHack Wasm Driver の初期化およびグローバルパッチの適応
     * @param {Object} [wasmModule] 
     */
    init(wasmModule = null) {
        if (wasmModule) {
            this.memory.module = wasmModule;
        }

        // Apply sticky getter patch for Wasm memory helpers
        this.memory.patchNethackHelpers();

        // Register window.nhDispatcher & window.eventHook for C shim callback
        const globalTarget = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
        if (globalTarget) {
            globalTarget.nhDispatcher = this.eventHook;
            globalTarget.eventHook = this.eventHook;
        }

        this.state = DriverState.IDLE;
        if (this.options.debug) {
            console.log("[NetHackWasmDriver] Initialized, helpers patched & nhDispatcher registered.");
        }
    }

    /**
     * FS (仮想ファイルシステム) のフォルダ・設定・システムファイルのフルセットアップ
     * @private
     */
    _prepareFS() {
        if (typeof FS === 'undefined') return;

        try {
            const dirs = ['/save', '/tmp'];
            dirs.forEach(d => {
                try {
                    if (!FS.analyzePath(d).exists) {
                        FS.mkdir(d);
                    }
                } catch (e) {}
            });

            // Config files (.nethackrc, NetHack.cnf)
            const configContent = `SCOREDIR=/save/\nSAVEDIR=/save/\nLEVELDIR=/\nOPTIONS=time,showexp,showvers,number_pad,tombstone\n`;
            ['NetHack.cnf', '.nethackrc'].forEach(cf => {
                try {
                    FS.writeFile('/' + cf, configContent);
                } catch (e) {}
            });

            // System data files
            const files = ['perm', 'record', 'sysconf', 'logfile', 'xlogfile', 'paniclog'];
            files.forEach(f => {
                try {
                    const rootPath = '/' + f;
                    const savePath = '/save/' + f;
                    const isPersistent = ['record', 'logfile', 'xlogfile', 'paniclog'].includes(f);

                    if (isPersistent) {
                        if (FS.analyzePath(savePath).exists) {
                            const data = FS.readFile(savePath);
                            FS.writeFile(rootPath, data);
                        } else {
                            FS.writeFile(rootPath, "");
                            FS.writeFile(savePath, "");
                        }
                    } else {
                        if (!FS.analyzePath(rootPath).exists) {
                            const content = (f === 'sysconf') ? "WIZARDS=*\nEXPLORERS=*\n" : "";
                            FS.writeFile(rootPath, content);
                        }
                    }
                } catch (e) {}
            });

            if (this.options.debug) {
                console.log("[NetHackWasmDriver] Emscripten FS environment prepared.");
            }
        } catch (err) {
            console.warn("[NetHackWasmDriver] FS preparation warning:", err);
        }
    }

    // --- Save Data Management Helpers ---

    /**
     * 仮想 FS 上の全セーブファイル一覧とサイズ情報を取得
     * @returns {Array<{ filename: string, size: number, timestamp: Date }>}
     */
    listSaveFiles() {
        if (typeof FS === 'undefined') return [];
        try {
            if (!FS.analyzePath('/save').exists) return [];
            const files = FS.readdir('/save').filter(f => f !== '.' && f !== '..');
            return files.map(filename => {
                const stat = FS.stat('/save/' + filename);
                return {
                    filename,
                    size: stat.size,
                    timestamp: new Date(stat.mtime)
                };
            });
        } catch (e) {
            return [];
        }
    }

    /**
     * 仮想 FS から指定セーブファイル（または全セーブファイル）のバイナリを取得
     * @param {string} [targetFilename] 特定のファイル名（省略時は全ファイル）
     * @returns {Array<{ filename: string, data: Uint8Array }>}
     */
    exportSaveData(targetFilename = null) {
        if (typeof FS === 'undefined') return [];
        try {
            if (!FS.analyzePath('/save').exists) return [];
            const files = FS.readdir('/save').filter(f => f !== '.' && f !== '..');
            const targets = targetFilename ? files.filter(f => f === targetFilename) : files;

            return targets.map(filename => ({
                filename,
                data: FS.readFile('/save/' + filename)
            }));
        } catch (e) {
            return [];
        }
    }

    /**
     * 仮想 FS の /save/ へバイナリセーブデータを注入・保存
     * @param {string} filename 
     * @param {Uint8Array|ArrayBuffer} data 
     * @returns {boolean} 成功時 true
     */
    importSaveData(filename, data) {
        if (typeof FS === 'undefined' || !filename || !data) return false;
        try {
            if (!FS.analyzePath('/save').exists) {
                FS.mkdir('/save');
            }
            const uint8Data = (data instanceof ArrayBuffer) ? new Uint8Array(data) : data;
            FS.writeFile('/save/' + filename, uint8Data);
            if (this.options.debug) {
                console.log(`[NetHackWasmDriver] Imported save file: ${filename} (${uint8Data.length} bytes)`);
            }
            return true;
        } catch (e) {
            console.error(`[NetHackWasmDriver] Failed to import save file: ${filename}`, e);
            return false;
        }
    }

    /**
     * 仮想 FS から指定セーブファイルを削除
     * @param {string} filename 
     * @returns {boolean} 成功時 true
     */
    deleteSaveFile(filename) {
        if (typeof FS === 'undefined' || !filename) return false;
        try {
            const path = '/save/' + filename;
            if (FS.analyzePath(path).exists) {
                FS.unlink(path);
                if (this.options.debug) {
                    console.log(`[NetHackWasmDriver] Deleted save file: ${path}`);
                }
                return true;
            }
            return false;
        } catch (e) {
            console.error(`[NetHackWasmDriver] Failed to delete save file: ${filename}`, e);
            return false;
        }
    }

    /**
     * NetHack Wasm C コアエンジンの main エントリポイントを起動する
     * 
     * @param {string[]} [customArgs] - 起動引数（省略時は Module.arguments またはデフォルト引数）
     * @returns {Promise<number>} Wasm main の終了コード
     */
    async start(customArgs = null) {
        const mod = this.memory.module;
        if (!mod) {
            throw new Error("NetHackWasmDriver: Module is not initialized.");
        }

        // Ensure FS directories and files exist
        this._prepareFS();

        // Register C shim graphics callback name
        if (mod.cwrap) {
            try {
                const setCB = mod.cwrap('shim_graphics_set_callback', null, ['string']);
                setCB("nhDispatcher");
                if (this.options.debug) {
                    console.log("[NetHackWasmDriver] Registered 'nhDispatcher' via shim_graphics_set_callback.");
                }
            } catch (e) {
                console.warn("[NetHackWasmDriver] Could not set shim_graphics_set_callback:", e);
            }
        }

        const coreOptions = "time,showexp,showvers,number_pad,tombstone";
        const args = customArgs || (mod.arguments && mod.arguments.length > 0
            ? [...mod.arguments]
            : ['nethack', `-o${coreOptions}`, `--nethackrc:/.nethackrc`]);

        if (!args.some(arg => arg.startsWith('--nethackrc'))) {
            args.push("--nethackrc:/.nethackrc");
        }

        if (typeof ENV !== 'undefined') {
            const optArg = args.find(a => a.startsWith('-o'));
            ENV.NETHACKOPTIONS = optArg ? optArg.slice(2) : "";
        }

        const argc = args.length;
        const argv = mod._malloc((argc + 1) * 4);
        for (let i = 0; i < argc; i++) {
            const str = args[i];
            const strPtr = mod._malloc(str.length + 1);
            mod.stringToUTF8(str, strPtr, str.length + 1);
            mod.setValue(argv + i * 4, strPtr, '*');
        }
        mod.setValue(argv + argc * 4, 0, '*');

        if (this.options.debug) {
            console.log("[NetHackWasmDriver] Starting NetHack C main via ccall:", args);
        }

        this.state = DriverState.RUNNING;

        const cleanupOnExit = (code) => {
            this.cancelPendingInput();
            this.state = DriverState.STOPPED;
            if (this.options.debug) {
                console.log(`[NetHackWasmDriver] NetHack Engine stopped with code: ${code}`);
            }
            return code;
        };

        try {
            const result = mod.ccall('main', 'number', ['number', 'number'], [argc, argv], { async: true });

            if (result instanceof Promise) {
                return await result.then(
                    (res) => cleanupOnExit(res || 0),
                    (err) => {
                        if (err && err.name === 'ExitStatus') {
                            return cleanupOnExit(err.status);
                        }
                        cleanupOnExit(1);
                        throw err;
                    }
                );
            }
            return cleanupOnExit(result || 0);
        } catch (err) {
            if (err && err.name === 'ExitStatus') {
                return cleanupOnExit(err.status);
            }
            cleanupOnExit(1);
            throw err;
        }
    }

    // --- Event Emitter Implementations ---

    /**
     * イベントリスナーの登録
     * @param {string} event 
     * @param {function} listener 
     */
    on(event, listener) {
        if (typeof listener !== 'function') return this;
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
        return this;
    }

    /**
     * イベントリスナーの解除
     * @param {string} event 
     * @param {function} listener 
     */
    off(event, listener) {
        if (!this.listeners.has(event)) return this;
        this.listeners.get(event).delete(listener);
        return this;
    }

    /**
     * 一度だけのイベントリスナー登録
     * @param {string} event 
     * @param {function} listener 
     */
    once(event, listener) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            listener.apply(this, args);
        };
        return this.on(event, wrapper);
    }

    /**
     * イベントの発行
     * @param {string} event 
     * @param {any} data 
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return false;
        const set = this.listeners.get(event);
        for (const listener of Array.from(set)) {
            try {
                listener(data);
            } catch (err) {
                console.error(`[NetHackWasmDriver] Error in event listener for '${event}':`, err);
            }
        }
        return true;
    }

    /**
     * InputResolver を生成して安全に追跡するヘルパー
     * @private
     */
    _createResolver(customTimeoutMs) {
        const ResolverClass = InputResolverRef || window.InputResolver;
        if (!ResolverClass) {
            throw new Error("NetHackWasmDriver: InputResolver is not loaded.");
        }

        const timeoutMs = customTimeoutMs !== undefined ? customTimeoutMs : this.options.inputTimeoutMs;
        const resolver = new ResolverClass({
            timeoutMs: timeoutMs,
            cancelValue: 27, // ASCII ESC
            onTimeout: () => {
                this.emit('inputTimeout', { state: this.state });
            }
        });

        this.activeResolver = resolver;
        resolver.promise.finally(() => {
            if (this.activeResolver === resolver) {
                this.activeResolver = null;
            }
        });

        return resolver;
    }

    /**
     * 現在進行中の入力待ちがあればキャンセレーションを実施
     */
    cancelPendingInput() {
        if (this.activeResolver && !this.activeResolver.isResolved) {
            this.activeResolver.cancel();
            this.activeResolver = null;
        }
    }

    /**
     * C / Wasm winshim.c 側から呼び出される統合イベントフック
     * 
     * @param {string} type - 'shim_*' イベント名
     * @param  {...any} args - イベント引数
     * @returns {any} Wasm 側へ返す同期戻り値または Promise
     */
    async eventHook(type, ...args) {
        if (this.options.debug) {
            console.log("[NetHackWasmDriver] EventHook:", type, args);
        }

        switch (type) {
            case "shim_init_nhwindows":
                this.state = DriverState.RUNNING;
                this.emit('init_nhwindows', {});
                return 0;

            case "shim_player_selection_or_tty":
                this.emit('player_selection_or_tty', {});
                return true;

            case "shim_askname": {
                const resolver = this._createResolver();
                this.emit('askname', { resolver });
                const name = await resolver.promise;
                
                // plname 構造体へ名前を保存
                const mod = this.memory.module;
                if (mod && mod._get_plname) {
                    const plnamePtr = mod._get_plname();
                    if (plnamePtr) {
                        const safeName = (typeof name === 'string' ? name : "player").substring(0, 31);
                        mod.stringToUTF8(safeName, plnamePtr, 32);
                    }
                }
                return 0;
            }

            case "shim_get_nh_event":
                this.emit('get_nh_event', {});
                return 0;

            case "shim_exit_nhwindows":
                this.cancelPendingInput();
                this.state = DriverState.STOPPED;
                this.emit('exit_nhwindows', { message: args[0] });
                return 0;

            case "shim_suspend_nhwindows":
                this.emit('suspend_nhwindows', { str: args[0] });
                return 0;

            case "shim_resume_nhwindows":
                this.emit('resume_nhwindows', {});
                return 0;

            case "shim_create_nhwindow":
                this.emit('create_nhwindow', { type: args[0] });
                return args[0]; // Returns windowId

            case "shim_clear_nhwindow":
                this.emit('clear_nhwindow', { windowId: args[0] });
                return 0;

            case "shim_display_nhwindow": {
                const windowId = args[0];
                const blocking = args[1];
                if (windowId === 3) this.state = DriverState.RUNNING; // NHW_MAP

                let resolver = null;
                if (blocking) {
                    this.state = DriverState.WAITING_INPUT;
                    resolver = this._createResolver();
                }

                this.emit('display_nhwindow', { windowId, blocking, resolver });

                if (resolver) {
                    await resolver.promise;
                    this.state = DriverState.RUNNING;
                }
                return 0;
            }

            case "shim_display_file": {
                const filename = args[0];
                const complain = args[1];
                let fileText = null;

                if (typeof FS !== 'undefined') {
                    try {
                        const path = `./dat/${filename}`;
                        if (FS.analyzePath(path).exists) {
                            fileText = FS.readFile(path, { encoding: 'utf8' });
                        }
                    } catch (e) {}
                }

                const resolver = this._createResolver();
                this.emit('display_file', { filename, complain, fileText, resolver });
                await resolver.promise;
                return 0;
            }

            case "shim_destroy_nhwindow":
                this.emit('destroy_nhwindow', { windowId: args[0] });
                return 0;

            case "shim_curs":
                this.emit('curs', { windowId: args[0], x: args[1], y: args[2] });
                return 0;

            case "shim_putstr":
                if (args[2]) {
                    this.messageHistory.push(args[2]);
                    if (this.messageHistory.length > 200) this.messageHistory.shift();
                }
                this.emit('putstr', { windowId: args[0], attr: args[1], text: args[2] });
                return 0;

            case "shim_putmixed":
                this.emit('putmixed', { windowId: args[0], attr: args[1], text: args[2] });
                return 0;

            case "shim_print_glyph": {
                const windowId = args[0];
                const x = args[1];
                const y = args[2];
                const glyphPtr = args[3];
                const glyphInfo = this.memory.parseGlyphInfo(glyphPtr);
                this.emit('print_glyph', { windowId, x, y, glyphInfo });
                return 0;
            }

            case "shim_raw_print":
                this.emit('raw_print', { text: args[0] });
                return 0;

            case "shim_raw_print_bold":
                this.emit('raw_print_bold', { text: args[0] });
                return 0;

            case "shim_nhgetch": {
                this.state = DriverState.WAITING_INPUT;
                const resolver = this._createResolver();
                this.emit('inputRequired', {
                    context: 'getch',
                    resolver
                });
                const key = await resolver.promise;
                this.state = DriverState.RUNNING;
                return key;
            }

            case "shim_nh_poskey": {
                this.state = DriverState.WAITING_INPUT;
                const resolver = this._createResolver();
                this.emit('inputRequired', {
                    context: 'poskey',
                    xPtr: args[0],
                    yPtr: args[1],
                    modPtr: args[2],
                    resolver
                });
                const response = await resolver.promise;
                this.state = DriverState.RUNNING;

                if (typeof response === 'object' && response !== null) {
                    if (response.x !== undefined && response.y !== undefined) {
                        const mod = this.memory.module;
                        if (mod) {
                            mod.setValue(args[0], response.x, 'i16');
                            mod.setValue(args[1], response.y, 'i16');
                            mod.setValue(args[2], response.mod || 0, 'i32');
                        }
                        return 0; // 0 for mouse
                    }
                    return response.charCode || 0;
                }

                if (typeof response === 'number') return response;
                if (typeof response === 'string' && response.length > 0) return response.charCodeAt(0);
                return 27; // ESC default
            }

            case "shim_yn_function": {
                this.state = DriverState.WAITING_INPUT;
                const resolver = this._createResolver();
                this.emit('inputRequired', {
                    context: 'yn_function',
                    question: args[0],
                    choices: args[1],
                    defaultChoice: args[2],
                    resolver
                });
                const ans = await resolver.promise;
                this.state = DriverState.RUNNING;

                if (typeof ans === 'number') return ans;
                if (typeof ans === 'string' && ans.length > 0) return ans.charCodeAt(0);
                return 27;
            }

            case "shim_getlin": {
                this.state = DriverState.WAITING_INPUT;
                const resolver = this._createResolver();
                this.emit('inputRequired', {
                    context: 'getlin',
                    prompt: args[0],
                    bufPtr: args[1],
                    resolver
                });
                const input = await resolver.promise;
                this.state = DriverState.RUNNING;

                if (typeof input === 'string') {
                    const mod = this.memory.module;
                    if (mod && args[1]) {
                        mod.stringToUTF8(input, args[1], 256);
                    }
                }
                return 0;
            }

            case "shim_get_ext_cmd": {
                this.state = DriverState.WAITING_INPUT;
                const resolver = this._createResolver();
                const extcmds = this.options.extCmds || DEFAULT_EXTCMDS;

                this.emit('inputRequired', {
                    context: 'get_ext_cmd',
                    extcmds: extcmds,
                    resolver
                });

                const response = await resolver.promise;
                this.state = DriverState.RUNNING;

                if (typeof response === 'number') {
                    return response;
                }

                if (typeof response === 'string') {
                    const cleanStr = response.trim().toLowerCase().replace(/^#/, '');
                    const idx = extcmds.indexOf(cleanStr);
                    return idx >= 0 ? idx : -1;
                }

                return -1;
            }

            // Menu Handlers
            case "shim_start_menu": {
                const windowId = args[0];
                const behavior = args[1];
                this.menuBuffer[windowId] = { behavior, items: [], prompt: "" };
                this.emit('start_menu', { windowId, behavior });
                return 0;
            }

            case "shim_add_menu": {
                const windowId = args[0];
                const glyphInfo = args[1] ? this.memory.parseGlyphInfo(args[1]) : null;
                const identifier = args[2];
                const menuItem = {
                    glyphInfo,
                    identifier: identifier,
                    isHeader: (!identifier || identifier === 0),
                    accelerator: args[3],
                    groupAcc: args[4],
                    attr: args[5],
                    color: args[6],
                    str: args[7],
                    itemflags: args[8]
                };

                if (this.menuBuffer[windowId]) {
                    this.menuBuffer[windowId].items.push(menuItem);
                }

                this.emit('add_menu', { windowId, menuItem });
                return 0;
            }

            case "shim_end_menu": {
                const windowId = args[0];
                const prompt = args[1];
                if (this.menuBuffer[windowId]) {
                    this.menuBuffer[windowId].prompt = prompt;
                }
                this.emit('end_menu', { windowId, prompt });
                return 0;
            }

            case "shim_select_menu": {
                const windowId = args[0];
                const how = args[1];
                const menuListPtrPtr = args[2];
                const menuData = this.menuBuffer[windowId] || { items: [], prompt: "" };

                this.state = DriverState.WAITING_MENU;
                const resolver = this._createResolver();

                this.emit('inputRequired', {
                    context: 'select_menu',
                    windowId,
                    how,
                    items: menuData.items,
                    prompt: menuData.prompt,
                    resolver
                });

                const response = await resolver.promise;
                this.state = DriverState.RUNNING;

                // Direct status/count returned (e.g. 0 or -1 for cancel)
                if (typeof response === 'number') {
                    return response;
                }

                // If non-array or empty array returned
                if (!response || !Array.isArray(response) || response.length === 0) {
                    return 0;
                }

                const selectedItems = response;

                // Allocate menu_item struct array (16 bytes per entry in Wasm memory)
                const mod = this.memory.module;
                if (mod && mod._malloc && menuListPtrPtr) {
                    const ITEM_SIZE = 16;
                    const ptr = mod._malloc(ITEM_SIZE * selectedItems.length);

                    selectedItems.forEach((item, index) => {
                        const offset = ptr + (index * ITEM_SIZE);
                        const id = (typeof item === 'object' && item.identifier !== undefined) ? item.identifier : (typeof item === 'number' ? item : 0);
                        const flags = (typeof item === 'object' && item.itemflags !== undefined) ? item.itemflags : 0;
                        mod.setValue(offset, id, 'i32');
                        mod.setValue(offset + 8, -1, 'i32'); // count (long)
                        mod.setValue(offset + 12, flags | 1, 'i32'); // SELECTED flag = 1
                    });

                    mod.setValue(menuListPtrPtr, ptr, 'i32');
                }

                return selectedItems.length;
            }

            case "shim_message_menu": {
                const resolver = this._createResolver();
                this.emit('message_menu', {
                    let: args[0],
                    how: args[1],
                    mesg: args[2],
                    history: this.messageHistory,
                    resolver
                });
                await resolver.promise;
                return 0;
            }

            case "shim_cliparound":
                this.emit('cliparound', { x: args[0], y: args[1] });
                return 0;

            case "shim_status_update": {
                const fld = args[0];
                const ptr = args[1];
                const chg = args[2];
                const percent = args[3];
                const clr = args[4];
                let val = null;

                const mod = this.memory.module;
                if (fld === 22) { // BL_CONDITION
                    val = mod ? mod.getValue(ptr, 'i32') : 0;
                } else if (ptr && mod) {
                    try {
                        val = mod.UTF8ToString(ptr);
                    } catch (e) {
                        val = mod.getValue(ptr, 'i32');
                    }
                }

                this.emit('status_update', {
                    field: fld,
                    value: val,
                    change: chg,
                    percent,
                    color: clr
                });
                return 0;
            }

            case "shim_sound":
                this.emit('soundTrigger', { soundText: args[0] });
                return 0;

            case "shim_nhbell":
                this.emit('bell', {});
                return 0;

            case "shim_delay_output":
                this.emit('delay_output', {});
                await new Promise(r => setTimeout(r, 50));
                return 0;

            case "shim_getmsghistory": {
                if (args[0]) this.historyIndex = 0;
                if (this.historyIndex < this.messageHistory.length) {
                    const msg = this.messageHistory[this.historyIndex];
                    this.historyIndex++;
                    return msg;
                }
                return null;
            }

            case "shim_putmsghistory": {
                if (args[0]) {
                    this.messageHistory.push(args[0]);
                    if (this.messageHistory.length > 200) this.messageHistory.shift();
                }
                return 0;
            }

            case "shim_outrip":
                this.emit('outrip', { windowId: args[0], text: args[1] });
                return 0;

            default:
                if (this.options.debug) {
                    console.warn(`[NetHackWasmDriver] Unhandled event type: ${type}`, args);
                }
                return 0;
        }
    }
}

// Attach static state enum
NetHackWasmDriver.DriverState = DriverState;
NetHackWasmDriver.DEFAULT_EXTCMDS = DEFAULT_EXTCMDS;

// Module export / Universal support
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetHackWasmDriver;
}
if (typeof window !== 'undefined') {
    window.NetHackWasmDriver = NetHackWasmDriver;
}
