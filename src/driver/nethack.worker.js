// src/driver/nethack.worker.js
// 共通のドライバスクリプトをロード
importScripts(
    './InputResolver.js',
    './NetHackMemory.js',
    './NetHackFSManager.js',
    './NetHackWasmDriver.js'
);

let driver = null;
const savedResolvers = new Map();
let resolverIdCounter = 0;

self.onmessage = async function(e) {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT': {
            const { wasmJsUrl, options } = payload;

            // Module の初期設定
            self.Module = self.Module || {};
            if (options && options.arguments) {
                self.Module.arguments = options.arguments;
            }
            
            // locateFile をカスタマイズし、.wasm ファイルが正しい位置からロードされるようにする
            self.Module.locateFile = function(path, prefix) {
                if (wasmJsUrl) {
                    const parts = wasmJsUrl.split('/');
                    parts.pop(); // ファイル名を除去
                    const dir = parts.join('/');
                    return dir ? (dir + '/' + path) : path;
                }
                return '../../' + path;
            };

            // Wasm 起動前に環境変数 (ENV) を preRun で確実に仕込む
            self.Module.preRun = self.Module.preRun || [];
            self.Module.preRun.push(() => {
                const env = (typeof globalThis !== 'undefined' && globalThis.ENV) ? globalThis.ENV : (typeof ENV !== 'undefined' ? ENV : null);
                if (env) {
                    env.USER = undefined;
                    env.LOGNAME = undefined;
                    env.HOME = "/";
                    env.HACKDIR = "/";
                    env.SCOREDIR = "/save/";
                    env.LEVELDIR = "/";
                    env.SAVEDIR = "/save/";
                    
                    let initialOpts = [];
                    if (options && options.gameOptions) {
                        for (const [k, v] of Object.entries(options.gameOptions)) {
                            if (typeof v === 'boolean') {
                                initialOpts.push(v ? k : `!${k}`);
                            } else if (v !== undefined && v !== null) {
                                initialOpts.push(`${k}:${v}`);
                            }
                        }
                    }
                    if (initialOpts.length > 0) {
                        env.NETHACKOPTIONS = initialOpts.join(",");
                    } else {
                        env.NETHACKOPTIONS = "number_pad:1";
                    }
                    console.log("[nethack.worker] ENV.NETHACKOPTIONS initialized in preRun:", env.NETHACKOPTIONS);
                }
            });

            // Driver インスタンス作成
            driver = new NetHackWasmDriver(options);

            // Driver のイベントをメインスレッドへフォワードする設定
            const driverEvents = [
                'started', 'exited', 'stateChange', 'init_nhwindows', 
                'exit_nhwindows', 'create_nhwindow', 'clear_nhwindow', 
                'display_nhwindow', 'destroy_nhwindow', 'curs', 'putstr', 
                'display_file', 'status_update', 'bell', 'cliparound', 
                'inputRequired', 'raw_print', 'raw_print_bold', 'putmixed',
                'print_glyph'
            ];

            driverEvents.forEach(evtName => {
                driver.on(evtName, (data) => {
                    let cleanData = data ? { ...data } : {};
                    
                    // resolver (関数を含む) はスレッド境界を越えられないため、IDでマッピング管理する
                    if (data && data.resolver) {
                        const resolverId = ++resolverIdCounter;
                        savedResolvers.set(resolverId, data.resolver);
                        cleanData.resolverId = resolverId;
                        cleanData.hasResolver = true;
                        delete cleanData.resolver; // 関数プロパティを除去
                    }

                    self.postMessage({ type: 'EVENT', event: evtName, data: cleanData });
                });
            });

            const performDriverInit = () => {
                driver.init(self.Module);
                self.postMessage({ type: 'INIT_DONE' });
            };

            // 指定された Wasm JSファイルを動的にロード
            if (wasmJsUrl) {
                // すでに初期化済みの場合は直接初期化を実行
                if (self.Module.calledRun || self.Module.runtimeInitialized) {
                    performDriverInit();
                } else {
                    self.Module.onRuntimeInitialized = function() {
                        performDriverInit();
                    };
                    try {
                        importScripts(wasmJsUrl);
                    } catch (err) {
                        console.error("[nethack.worker] Failed to load Wasm JS script:", wasmJsUrl, err);
                        self.postMessage({ type: 'ERROR', message: `Failed to load Wasm script: ${err.message}` });
                        return;
                    }
                }
            } else {
                performDriverInit();
            }
            break;
        }

        case 'START': {
            if (!driver) {
                self.postMessage({ type: 'ERROR', message: 'Driver not initialized' });
                return;
            }
            try {
                const exitCode = await driver.start(payload ? payload.options : {});
                self.postMessage({ type: 'EXIT', exitCode });
            } catch (err) {
                console.error("[nethack.worker] Driver execution error:", err);
                self.postMessage({ type: 'ERROR', message: err.message });
            }
            break;
        }

        case 'RESPOND_INPUT': {
            const { resolverId, value, isCancel } = payload;
            const resolver = savedResolvers.get(resolverId);
            if (resolver) {
                savedResolvers.delete(resolverId);
                if (isCancel) {
                    resolver.cancel();
                } else {
                    resolver.respond(value);
                }
            } else {
                console.warn("[nethack.worker] Resolver not found or already resolved:", resolverId);
            }
            break;
        }

        case 'DELETE_SAVE': {
            if (driver) {
                const success = await driver.deleteSaveFile(payload.filename);
                self.postMessage({ type: 'DELETE_SAVE_RESULT', success, filename: payload.filename });
            }
            break;
        }

        case 'DETECT_SAVE_NAME': {
            if (driver && driver.fsManager) {
                const saveName = driver.fsManager.autoDetectSavePlayerName();
                self.postMessage({ type: 'DETECT_SAVE_NAME_RESULT', saveName });
            } else {
                self.postMessage({ type: 'DETECT_SAVE_NAME_RESULT', saveName: "" });
            }
            break;
        }

        case 'LIST_SAVE_FILES': {
            if (driver && driver.fsManager) {
                const saveFiles = driver.fsManager.listSaveFiles();
                self.postMessage({ type: 'LIST_SAVE_FILES_RESULT', saveFiles });
            } else {
                self.postMessage({ type: 'LIST_SAVE_FILES_RESULT', saveFiles: [] });
            }
            break;
        }
    }
};
