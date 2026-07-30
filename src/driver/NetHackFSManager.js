/**
 * NetHackFSManager.js
 * Emscripten 仮想ファイルシステム (FS) や IndexedDB (IDBFS) のカプセル化・スコアログ解析モジュール
 */
(function (global) {
    if (global.NetHackFSManager) return;

    class NetHackFSManager {
        constructor() {
        }

        get FS() {
            if (typeof globalThis !== 'undefined' && globalThis.FS) {
                return globalThis.FS;
            }
            return null;
        }

        get IDBFS() {
            if (typeof globalThis !== 'undefined' && globalThis.IDBFS) {
                return globalThis.IDBFS;
            }
            return null;
        }

        /**
         * NetHack 用のファイルシステム初期化 (/save, /tmp の作成と IDBFS マウント)
         */
        async initFileSystem(extraOptions = "") {
            const FS = this.FS;
            const IDBFS = this.IDBFS;

            console.log("[NetHackFSManager DEBUG] Starting initFileSystem...");

            if (!FS) {
                console.warn("[NetHackFSManager DEBUG] Emscripten FS is NOT defined!");
                return false;
            }

            const dirs = ['/save', '/tmp'];
            dirs.forEach(dir => {
                try {
                    const res = FS.analyzePath(dir);
                    if (!res.exists) {
                        FS.mkdir(dir);
                        console.log(`[NetHackFSManager DEBUG] Created directory: ${dir}`);
                    }
                    if (dir === '/save' && IDBFS) {
                        FS.mount(IDBFS, {}, dir);
                        console.log(`[NetHackFSManager DEBUG] Mounted IDBFS at ${dir}`);
                    }
                } catch (e) {
                    console.error(`[NetHackFSManager DEBUG] Failed to init dir ${dir}:`, e);
                }
            });

            const setupAll = () => {
                console.log("[NetHackFSManager DEBUG] Executing setupAll() for system files...");
                // 1. Write Config Files (NetHack.cnf, .nethackrc)
                let configContent = `SCOREDIR=/save/\nSAVEDIR=/save/\nLEVELDIR=/\n`;
                if (extraOptions) {
                    extraOptions.split('\n').forEach(line => {
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

                ['NetHack.cnf', '.nethackrc'].forEach(cf => {
                    try {
                        FS.writeFile('/' + cf, configContent);
                        console.log(`[NetHackFSManager DEBUG] Created config file /${cf}`);
                    } catch (e) {
                        console.error(`[NetHackFSManager DEBUG] Failed to write /${cf}:`, e);
                    }
                });

                // 2. Write sysconf to all candidate locations
                const sysconfContent = "WIZARDS=*\nEXPLORERS=*\n";
                ['/sysconf', '/save/sysconf', 'sysconf'].forEach(p => {
                    try {
                        FS.writeFile(p, sysconfContent);
                        console.log(`[NetHackFSManager DEBUG] Written sysconf file at '${p}'`);
                    } catch (e) {}
                });

                // 3. Write perm file to root and /save/
                const permContent = "*\n";
                ['/perm', '/save/perm', 'perm'].forEach(p => {
                    try {
                        FS.writeFile(p, permContent);
                        console.log(`[NetHackFSManager DEBUG] Written perm file at '${p}'`);
                    } catch (e) {}
                });

                // 4. Write System Log Files
                ['record', 'logfile', 'xlogfile', 'paniclog'].forEach(f => {
                    try {
                        const rootPath = '/' + f;
                        const savePath = '/save/' + f;

                        if (FS.analyzePath(savePath).exists) {
                            const data = FS.readFile(savePath);
                            if (data && data.length > 0) {
                                FS.writeFile(rootPath, data);
                            } else {
                                FS.writeFile(rootPath, "");
                            }
                        } else {
                            FS.writeFile(rootPath, "");
                            FS.writeFile(savePath, "");
                        }
                    } catch (e) {}
                });

                console.log("[NetHackFSManager DEBUG] All files initialized successfully.");
            };

            if (IDBFS) {
                return new Promise((resolve) => {
                    console.log("[NetHackFSManager DEBUG] Calling FS.syncfs(true)...");
                    FS.syncfs(true, (err) => {
                        if (err) console.error("[NetHackFSManager DEBUG] IDBFS sync error (Initial):", err);
                        else console.log("[NetHackFSManager DEBUG] IDBFS sync(true) complete.");
                        
                        setupAll();

                        console.log("[NetHackFSManager DEBUG] Calling FS.syncfs(false)...");
                        FS.syncfs(false, (err2) => {
                            if (err2) console.error("[NetHackFSManager DEBUG] IDBFS sync error (Final):", err2);
                            else console.log("[NetHackFSManager DEBUG] All FS preparation & sync(false) complete.");
                            resolve(!err && !err2);
                        });
                    });
                });
            } else {
                setupAll();
                return true;
            }
        }

        prepareSystemFiles() {}
        setupNethackRC(extraOptions = "") {}

        /**
         * 変更された永続データを /save ディレクトリおよび IDBFS と同期
         */
        syncToPersistent() {
            const FS = this.FS;
            const IDBFS = this.IDBFS;
            if (!FS) return Promise.resolve(false);

            const persistentFiles = ['record', 'logfile', 'xlogfile', 'paniclog', 'perm'];
            persistentFiles.forEach(f => {
                try {
                    const rootPath = '/' + f;
                    const savePath = '/save/' + f;

                    const rootExists = FS.analyzePath(rootPath).exists;
                    const saveExists = FS.analyzePath(savePath).exists;

                    if (rootExists && saveExists) {
                        const rootTime = FS.stat(rootPath).mtime.getTime();
                        const saveTime = FS.stat(savePath).mtime.getTime();

                        if (saveTime > rootTime) {
                            const data = FS.readFile(savePath);
                            FS.writeFile(rootPath, data);
                        } else if (rootTime > saveTime) {
                            const data = FS.readFile(rootPath);
                            FS.writeFile(savePath, data);
                        }
                    } else if (rootExists && !saveExists) {
                        const data = FS.readFile(rootPath);
                        FS.writeFile(savePath, data);
                    } else if (!rootExists && saveExists) {
                        const data = FS.readFile(savePath);
                        FS.writeFile(rootPath, data);
                    }
                } catch (e) {
                    console.error(`[NetHackFSManager] Failed to sync file ${f}:`, e);
                }
            });

            if (IDBFS) {
                return new Promise((resolve) => {
                    FS.syncfs(false, (err) => {
                        if (err) {
                            console.error("[NetHackFSManager] IDBFS sync error:", err);
                            resolve(false);
                        } else {
                            console.log("[NetHackFSManager] IDBFS sync complete.");
                            resolve(true);
                        }
                    });
                });
            } else {
                return Promise.resolve(true);
            }
        }

        /**
         * 自動セーブファイル検出
         */
        autoDetectSavePlayerName() {
            const FS = this.FS;
            if (!FS) return "";

            try {
                const saveDir = '/save';
                if (FS.analyzePath(saveDir).exists) {
                    const files = FS.readdir(saveDir);
                    const systemFiles = ['.', '..', 'perm', 'record', 'sysconf', 'logfile', 'xlogfile', 'paniclog', 'bonuses', 'bones'];
                    const saveFile = files.find(f => !systemFiles.includes(f) && !f.startsWith('.'));

                    if (saveFile) {
                        const match = saveFile.match(/^\d+(.+)$/);
                        let name = match ? match[1] : saveFile;
                        name = name.replace(/#.*$/, '').replace(/[^a-zA-Z0-9_\-]/g, '').trim();
                        return name || "Web_user";
                    }
                }
            } catch (e) {
                console.warn("[NetHackFSManager] Error auto-detecting save file:", e);
            }
            return "";
        }

        /**
         * /save/xlogfile のパース
         */
        parseLastXlog() {
            const FS = this.FS;
            if (!FS || !FS.analyzePath('/save/xlogfile').exists) return null;

            try {
                const xlogData = FS.readFile('/save/xlogfile', { encoding: 'utf8' });
                if (!xlogData || xlogData.trim() === "") return null;

                const lines = xlogData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                if (!lastLine) return null;

                const entry = {};
                lastLine.split('\t').forEach(p => {
                    const idx = p.indexOf('=');
                    if (idx !== -1) {
                        entry[p.substring(0, idx)] = p.substring(idx + 1);
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
                console.error("[NetHackFSManager] Failed to parse xlogfile:", e);
                return null;
            }
        }

        /**
         * /save/record スコアリストのパース (Top 10)
         */
        parseRecordList() {
            const FS = this.FS;
            if (!FS || !FS.analyzePath('/save/record').exists) return [];

            try {
                const recordData = FS.readFile('/save/record', { encoding: 'utf8' });
                if (!recordData || recordData.trim() === "") return [];

                const lines = recordData.trim().split('\n');
                const list = [];

                for (const line of lines) {
                    if (!line.trim()) continue;
                    const parts = line.split(' ');
                    if (parts.length < 15) continue;

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

                    list.push({ points, deathLev, maxLvl, hp, maxHp, role, race, gender, align, name, death });
                }

                list.sort((a, b) => b.points - a.points);
                return list.slice(0, 10);
            } catch (e) {
                console.error("[NetHackFSManager] Failed to parse record list:", e);
                return [];
            }
        }

        /**
         * セーブファイルを VFS および IndexedDB から完全に削除
         */
        async deleteSaveFile(targetFilename) {
            const FS = this.FS || (typeof globalThis !== 'undefined' && globalThis.FS ? globalThis.FS : null);
            const cleanName = targetFilename ? targetFilename.replace(/^\/save\//, '').replace(/#.*$/, '').trim() : "";
            console.log(`[NetHackFSManager] Executing robust save file deletion. Target: '${targetFilename}', cleanName: '${cleanName}'`);

            let deleted = false;

            // 1. VFS (FS) から /save 配下の非システムファイルを全削除
            if (FS) {
                try {
                    const saveDir = '/save';
                    if (FS.analyzePath(saveDir).exists) {
                        const files = FS.readdir(saveDir);
                        const systemFiles = ['.', '..', 'perm', 'record', 'sysconf', 'logfile', 'xlogfile', 'paniclog', 'bonuses', 'bones'];
                        files.forEach(f => {
                            if (!systemFiles.includes(f) && !f.startsWith('.')) {
                                try {
                                    FS.unlink(`${saveDir}/${f}`);
                                    deleted = true;
                                    console.log(`[NetHackFSManager] Unlinked VFS save file: /save/${f}`);
                                } catch(e) {
                                    console.warn(`[NetHackFSManager] Failed to unlink VFS file /save/${f}:`, e);
                                }
                            }
                        });
                    }
                } catch(e) {}
            }

            // 2. IndexedDB (/save -> FILE_DATA) の全キーを走査してセーブデータを物理削除
            try {
                if (typeof indexedDB !== 'undefined') {
                    await new Promise((resolve) => {
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
                                        console.log(`[NetHackFSManager] Deleted key from IndexedDB: '${keyStr}'`);
                                    }
                                });
                            };

                            tx.oncomplete = () => {
                                db.close();
                                resolve(true);
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
                console.warn("[NetHackFSManager] Error in IndexedDB key deletion:", e);
            }

            // 3. IDBFS FS.syncfs 同期
            if (FS && this.IDBFS) {
                try {
                    FS.syncfs(false, () => {});
                } catch(e) {}
            }

            return deleted;
        }
    }

    global.NetHackFSManager = NetHackFSManager;
    if (typeof window !== 'undefined') {
        window.NetHackFSManager = NetHackFSManager;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.NetHackFSManager = NetHackFSManager;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { NetHackFSManager };
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
