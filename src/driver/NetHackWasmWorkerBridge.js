/**
 * NetHackWasmWorkerBridge.js
 * Web Worker 内で動作する NetHackWasmDriver と UI レイヤーを仲介するブリッジクラス。
 * UI側からは従来の NetHackWasmDriver とほぼ同一のインターフェースとして扱えます。
 */
(function (global) {
    if (global.NetHackWasmWorkerBridge) return;

    class NetHackWasmWorkerBridge {
        static get DriverState() {
            return {
                IDLE: 'IDLE',
                RUNNING: 'RUNNING',
                WAITING_INPUT: 'WAITING_INPUT',
                STOPPED: 'STOPPED'
            };
        }

        constructor(workerUrl, options = {}) {
            this.listeners = new Map();
            this.options = options;
            this.state = NetHackWasmWorkerBridge.DriverState.IDLE;
            this.workerUrl = workerUrl || 'src/driver/nethack.worker.js';
            this._activeResolver = null;

            this.worker = new Worker(this.workerUrl);
            this.setupWorkerListener();
        }

        get activeResolver() {
            return this._activeResolver;
        }

        // EventEmitter 独自簡易実装 (NetHackWasmDriver と同一の API)
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
                    console.error(`[NetHackWasmWorkerBridge] Error in event listener for '${event}':`, e);
                }
            });
            return true;
        }

        setupWorkerListener() {
            this.worker.onmessage = (e) => {
                const { type, event, data, exitCode, message, success, filename, saveName } = e.data;

                switch (type) {
                    case 'INIT_DONE':
                        this.emit('initialized', {});
                        break;

                    case 'EVENT':
                        if (event === 'stateChange' && data && data.state) {
                            this.state = data.state;
                        }

                        // inputRequired イベントなどの透過的 resolver 再構築
                        if (data && data.hasResolver) {
                            const resolverId = data.resolverId;
                            const bridge = this;
                            data.resolver = {
                                respond: (val) => {
                                    if (bridge._activeResolver === data.resolver) {
                                        bridge._activeResolver = null;
                                    }
                                    this.worker.postMessage({
                                        type: 'RESPOND_INPUT',
                                        payload: { resolverId, value: val, isCancel: false }
                                    });
                                },
                                cancel: () => {
                                    if (bridge._activeResolver === data.resolver) {
                                        bridge._activeResolver = null;
                                    }
                                    this.worker.postMessage({
                                        type: 'RESPOND_INPUT',
                                        payload: { resolverId, isCancel: true }
                                    });
                                }
                            };
                            this._activeResolver = data.resolver;
                        }

                        // メインスレッド側のリスナーへイベントを転送
                        this.emit(event, data);
                        break;

                    case 'EXIT':
                        this.state = NetHackWasmWorkerBridge.DriverState.STOPPED;
                        this.emit('exited', { exitCode });
                        break;

                    case 'ERROR':
                        console.error("[NetHackWasmWorkerBridge] Error from Worker:", message);
                        this.emit('error', { message });
                        break;

                    case 'DELETE_SAVE_RESULT':
                        this.emit('deleteSaveResult', { success, filename });
                        break;

                    case 'DETECT_SAVE_NAME_RESULT':
                        this.emit('detectSaveNameResult', { saveName });
                        break;

                    case 'LIST_SAVE_FILES_RESULT':
                        this.emit('listSaveFilesResult', { saveFiles: data.saveFiles });
                        break;
                }
            };

            this.worker.onerror = (err) => {
                console.error("[NetHackWasmWorkerBridge] Worker system error:", err);
                this.emit('error', { message: err.message || 'Worker syntax or runtime error' });
            };
        }

        init(wasmJsUrl, options = {}) {
            let resolvedWasmJsUrl = wasmJsUrl;
            if (typeof wasmJsUrl === 'string' && !wasmJsUrl.startsWith('/') && !wasmJsUrl.startsWith('http')) {
                // 単純な相対パスの場合、Workerの位置(src/driver/)からルートへ戻るために '../../' を補完する
                if (!wasmJsUrl.startsWith('.') && !wasmJsUrl.includes('/')) {
                    resolvedWasmJsUrl = '../../' + wasmJsUrl;
                }
            }

            const mergedOptions = Object.assign({}, this.options, options);
            this.worker.postMessage({
                type: 'INIT',
                payload: {
                    wasmJsUrl: resolvedWasmJsUrl,
                    options: mergedOptions
                }
            });
        }

        async start(options = {}) {
            this.state = NetHackWasmWorkerBridge.DriverState.RUNNING;
            this.worker.postMessage({
                type: 'START',
                payload: { options }
            });
            
            return new Promise((resolve) => {
                const onExited = (payload) => {
                    this.off('exited', onExited);
                    resolve(payload.exitCode);
                };
                this.on('exited', onExited);
            });
        }

        sendInput(value) {
            this.worker.postMessage({
                type: 'SEND_INPUT',
                payload: { value }
            });
        }

        async deleteSaveFile(filename) {
            let deleted = false;
            const cleanName = filename ? filename.replace(/^\/save\//, '').replace(/#.*$/, '').trim() : "";

            // 1. メインスレッドから IndexedDB を直接物理削除
            try {
                if (typeof indexedDB !== 'undefined') {
                    deleted = await new Promise((resolve) => {
                        const req = indexedDB.open('/save');
                        req.onsuccess = (e) => {
                            const db = e.target.result;
                            if (!db.objectStoreNames.contains('FILE_DATA')) {
                                db.close();
                                resolve(false);
                                return;
                            }
                            const tx = db.transaction('FILE_DATA', 'readwrite');
                            const store = tx.objectStore('FILE_DATA');
                            const keyReq = store.getAllKeys();

                            keyReq.onsuccess = () => {
                                const keys = keyReq.result || [];
                                const systemNames = ['record', 'logfile', 'xlogfile', 'paniclog', 'perm', 'sysconf'];
                                keys.forEach(key => {
                                    const keyStr = String(key);
                                    const isSystem = systemNames.some(sys => keyStr.endsWith(sys));
                                    const isSaveKey = (keyStr.includes('/save/') || keyStr.includes('save/')) && !isSystem;

                                    if (isSaveKey || (cleanName && keyStr.includes(cleanName))) {
                                        store.delete(key);
                                        deleted = true;
                                        console.log(`[NetHackWasmWorkerBridge] Directly deleted key from IndexedDB: '${keyStr}'`);
                                    }
                                });
                            };

                            tx.oncomplete = () => {
                                db.close();
                                resolve(deleted);
                            };
                            tx.onerror = () => {
                                db.close();
                                resolve(false);
                            };
                        };
                        req.onerror = () => resolve(false);
                    });
                }
            } catch (e) {
                console.warn("[NetHackWasmWorkerBridge] Error directly deleting from IndexedDB:", e);
            }

            // 2. Worker 側へもメッセージを送信（VFSキャッシュのクリアなど）
            this.worker.postMessage({
                type: 'DELETE_SAVE',
                payload: { filename }
            });

            return new Promise((resolve) => {
                const onResult = (payload) => {
                    if (payload.filename === filename) {
                        this.off('deleteSaveResult', onResult);
                        resolve(deleted || payload.success);
                    }
                };
                // Workerからの応答タイムアウト制限 (1秒)
                setTimeout(() => {
                    this.off('deleteSaveResult', onResult);
                    resolve(deleted);
                }, 1000);
                this.on('deleteSaveResult', onResult);
            });
        }

        async autoDetectSavePlayerName() {
            try {
                if (typeof indexedDB === 'undefined') return "";
                const db = await new Promise((resolve, reject) => {
                    const req = indexedDB.open('/save');
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                if (!db.objectStoreNames.contains('FILE_DATA')) {
                    db.close();
                    return "";
                }
                const tx = db.transaction('FILE_DATA', 'readonly');
                const store = tx.objectStore('FILE_DATA');
                const keys = await new Promise((resolve) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                });
                db.close();

                const systemNames = ['record', 'logfile', 'xlogfile', 'paniclog', 'perm', 'sysconf'];
                const saveKey = keys.find(key => {
                    const keyStr = String(key);
                    const isSystem = systemNames.some(sys => keyStr.endsWith(sys));
                    return (keyStr.includes('/save/') || keyStr.includes('save/')) && !isSystem;
                });

                if (saveKey) {
                    const cleanName = String(saveKey).replace(/^\/save\//, '').replace(/#.*$/, '');
                    const match = cleanName.match(/^\d+(.+)$/);
                    let name = match ? match[1] : cleanName;
                    name = name.replace(/[^a-zA-Z0-9_\-]/g, '').trim();
                    return name || "Web_user";
                }
            } catch (e) {
                console.warn("[NetHackWasmWorkerBridge] Failed to auto-detect save name from IndexedDB:", e);
            }
            return "";
        }

        async listSaveFiles() {
            return new Promise((resolve) => {
                if (!this.worker) return resolve([]);
                const onResult = ({ saveFiles }) => {
                    this.off('listSaveFilesResult', onResult);
                    resolve(saveFiles || []);
                };
                setTimeout(() => {
                    this.off('listSaveFilesResult', onResult);
                    resolve([]);
                }, 1000);
                this.on('listSaveFilesResult', onResult);
                this.worker.postMessage({ type: 'LIST_SAVE_FILES' });
            });
        }

        terminate() {
            if (this.worker) {
                this.worker.terminate();
                this.state = NetHackWasmWorkerBridge.DriverState.STOPPED;
            }
        }
    }

    global.NetHackWasmWorkerBridge = NetHackWasmWorkerBridge;
    if (typeof window !== 'undefined') {
        window.NetHackWasmWorkerBridge = NetHackWasmWorkerBridge;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.NetHackWasmWorkerBridge = NetHackWasmWorkerBridge;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NetHackWasmWorkerBridge;
        module.exports.NetHackWasmWorkerBridge = NetHackWasmWorkerBridge;
        module.exports.default = NetHackWasmWorkerBridge;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));


