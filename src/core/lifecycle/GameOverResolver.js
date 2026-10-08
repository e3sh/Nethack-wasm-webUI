/**
 * GameOverResolver.js - WebUICore ゲームオーバー・勝敗判定 & ランキング解析モジュール (Core 層)
 *
 * 役割 (Clean Architecture):
 * Driver層 (NetHackFSManager) から取得した Raw データ (xlogfile / record / セーブファイル存在)
 * を解釈・パースし、勝敗理由 (reason) / 死因メッセージ (deathMessage) / スコアボード (scoreboard)
 * などのドメイン層構造化データを決定して WebUI クライアント側へ渡す責任を担う。
 */

import { PostMortemKnowledgeResolver } from '../knowledge/services/PostMortemKnowledgeResolver.js';

export class GameOverResolver {
    /**
     * Wasm終了イベント (exited) 発生時に、ゲームオーバーか正常セーブかを非同期判定
     *
     * @param {NetHackWasmDriver|Object} driver - Wasm Driver または Worker Bridge または fsManager 参照
     * @param {Object} [sessionInfo] - 自セッション情報 { playerName, startTime, birthdate, version }
     * @returns {Promise<Object>} ゲーム終了結果オブジェクト
     */
    static async resolveGameOver(driver, sessionInfo = null, options = {}) {
        if (!driver) return { isGameOver: false, reason: 'unknown', scoreboard: [] };

        const fsManager = driver.fsManager || (typeof driver.hasSaveData === 'function' ? driver : null);

        try {
            // 1. IDBFS 永続化の最終同期待機 (Storage I/O)
            if (fsManager && typeof fsManager.syncToPersistent === 'function') {
                try {
                    await fsManager.syncToPersistent();
                } catch (e) {
                    console.warn("[GameOverResolver] syncToPersistent warning:", e);
                }
            }

            // 2. Raw ログテキストの取得 & スコアボード解析
            let rawXlog = "";
            let rawRecord = "";

            const targetSource = (driver && driver.fsManager) ? driver.fsManager : driver;

            if (targetSource) {
                if (typeof targetSource.readXlogTextAsync === 'function') {
                    rawXlog = await targetSource.readXlogTextAsync();
                } else if (typeof targetSource.readXlogText === 'function') {
                    rawXlog = targetSource.readXlogText();
                }

                if (typeof targetSource.readRecordTextAsync === 'function') {
                    rawRecord = await targetSource.readRecordTextAsync();
                } else if (typeof targetSource.readRecordText === 'function') {
                    rawRecord = targetSource.readRecordText();
                }
            }

            const FSM = this._getFSManager();
            if ((!rawXlog || !rawXlog.trim()) && FSM && FSM.readTextFromIndexedDB) {
                rawXlog = await FSM.readTextFromIndexedDB('xlogfile');
            }
            if ((!rawRecord || !rawRecord.trim()) && FSM && FSM.readTextFromIndexedDB) {
                rawRecord = await FSM.readTextFromIndexedDB('record');
            }

            const filterCurrentVer = (options && options.currentVerOnly !== undefined) ? options.currentVerOnly : true;
            const scoreboard = this.parseRecordText(rawRecord, rawXlog, sessionInfo, { currentVerOnly: filterCurrentVer });

            // 3. セーブファイルの有無をチェック (VFS / IndexedDB に実体ファイルが存在するか)
            let hasSave = false;
            let saveName = null;

            if (targetSource && typeof targetSource.hasSaveDataAsync === 'function') {
                hasSave = await targetSource.hasSaveDataAsync();
            } else if (targetSource && typeof targetSource.hasSaveData === 'function') {
                hasSave = targetSource.hasSaveData();
            } else if (typeof driver.hasSaveData === 'function') {
                hasSave = driver.hasSaveData();
            }

            if (hasSave) {
                if (targetSource && typeof targetSource.autoDetectSavePlayerNameAsync === 'function') {
                    saveName = await targetSource.autoDetectSavePlayerNameAsync();
                } else if (targetSource && typeof targetSource.autoDetectSavePlayerName === 'function') {
                    const res = targetSource.autoDetectSavePlayerName();
                    saveName = (res && typeof res.then === 'function') ? await res : res;
                } else if (fsManager && typeof fsManager.autoDetectSavePlayerName === 'function') {
                    const res = fsManager.autoDetectSavePlayerName();
                    saveName = (res && typeof res.then === 'function') ? await res : res;
                }

                if ((!saveName || saveName === '[object Promise]') && sessionInfo && sessionInfo.playerName) {
                    saveName = sessionInfo.playerName;
                }
                if (!saveName || saveName === '[object Promise]') {
                    saveName = 'player';
                }

                return {
                    isGameOver: false,
                    reason: 'save_and_exit',
                    savePlayerName: saveName,
                    deathMessage: 'Game saved successfully.',
                    scoreboard: scoreboard
                };
            }

            // 4. セーブファイルなし ➔ xlogfile の最末尾エントリを解釈してゲームオーバー判定
            const lastRecord = this.parseXlogText(rawXlog, sessionInfo);
            const effectiveRecord = lastRecord || (scoreboard.length > 0 ? scoreboard[0] : null);

            if (!effectiveRecord) {
                return {
                    isGameOver: true,
                    reason: 'died',
                    death: 'Died in dungeon',
                    deathMessage: 'Game Over',
                    playerName: (sessionInfo && sessionInfo.playerName) || (fsManager && fsManager.autoDetectSavePlayerName ? fsManager.autoDetectSavePlayerName() : 'player'),
                    role: 'Explorer',
                    finalScore: 0,
                    lastRecord: null,
                    scoreboard: scoreboard
                };
            }

            const deathReasonStr = effectiveRecord.death || effectiveRecord.deathReason || 'Died in dungeon';
            const reason = this._parseReason(deathReasonStr);

            // PostMortemKnowledgeResolver (SSOT) による高精度死因解析 & アドバイス自動バインド
            const postMortem = PostMortemKnowledgeResolver.resolve(deathReasonStr);

            const translator = (options && options.translator) || (driver && driver.translator);
            let translatedDeath = (postMortem && postMortem.translatedDeath) ? postMortem.translatedDeath : deathReasonStr;
            if (translator && typeof translator.translate === 'function' && translatedDeath === deathReasonStr) {
                translatedDeath = translator.translate(deathReasonStr);
            }

            const isExploreMode = !!(effectiveRecord.isDiscover || (sessionInfo && sessionInfo.isExploreMode));
            const isWizardMode = !!(effectiveRecord.isWizard || (sessionInfo && sessionInfo.isWizardMode));

            return {
                isGameOver: true,
                reason: reason,
                death: deathReasonStr,
                translatedDeath: translatedDeath,
                deathMessage: `${effectiveRecord.name || 'Hero'} (${effectiveRecord.role || 'Explorer'}) - ${deathReasonStr}`,
                translatedDeathMessage: `${effectiveRecord.name || 'Hero'} (${effectiveRecord.role || 'Explorer'}) - ${translatedDeath}`,
                playerName: effectiveRecord.name || 'Hero',
                role: effectiveRecord.role || 'Explorer',
                finalScore: effectiveRecord.points || effectiveRecord.score || 0,
                isExploreMode: isExploreMode,
                isWizardMode: isWizardMode,
                lastRecord: effectiveRecord,
                postMortem: postMortem,
                scoreboard: scoreboard
            };
        } catch (e) {
            console.warn("GameOverResolver error:", e);
            return { isGameOver: false, reason: 'error', scoreboard: [] };
        }
    }

    /**
     * 職業文字列のクレンジング (数字 '0' や属性誤入力を 'Explorer' 等に正規化)
     */
    static _sanitizeRole(roleStr) {
        if (!roleStr || typeof roleStr !== 'string') return 'Explorer';
        const trimmed = roleStr.trim();
        if (trimmed === '0' || /^\d+$/.test(trimmed) || trimmed.length < 2) {
            return 'Explorer';
        }
        if (['Law', 'Neu', 'Cha', 'Hum', 'Elf', 'Dwa', 'Gno', 'Orc', 'Fem', 'Mal'].includes(trimmed)) {
            return 'Explorer';
        }
        return trimmed;
    }

    /**
     * プレイヤー名のクレンジング (属性名 'Law Hero' などの付着を除去)
     */
    static _sanitizeName(nameStr) {
        if (!nameStr || typeof nameStr !== 'string') return 'Hero';
        let clean = nameStr.trim();
        clean = clean.replace(/^(Law|Neu|Cha|Hum|Elf|Dwa|Gno|Orc|Fem|Mal)\s+/i, '');
        if (!clean || clean === '_') return 'Hero';
        return clean;
    }

    /**
     * NetHack C言語コア (topten.c) 規格の record および xlogfile テキストをパースし、
     * ハイスコア上位10件の構造化オブジェクト配列を返却する。
     */
    static parseRecordText(recordText, xlogText = "", sessionInfo = null, options = {}) {
        const list = [];
        const currentVersion = (options && options.targetVersion) || (sessionInfo && sessionInfo.version) || "5.0.0";
        const filterCurrentVer = options.currentVerOnly !== false;

        // A. record / logfile (バイナリ/固定フォーマット) のパース
        if (recordText && recordText.trim()) {
            const lines = recordText.split('\n');
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;

                const parts = line.split(/\s+/);
                if (parts.length >= 10) {
                    let ver = parts[0];
                    let ptsIdx = 1;
                    if (!ver.includes('.')) {
                        ptsIdx = 0;
                        ver = "5.0.0";
                    }

                    const pts = parseInt(parts[ptsIdx + 0], 10) || 0;
                    let dnum = 0;
                    let dlev = 1;
                    let mlev = 1;
                    let hp = 0;
                    let maxhp = 0;
                    let deaths = 0;
                    let deathdate = "";
                    let birthdate = "";
                    let uid = "0";

                    let role = "Explorer", race = "Human", gender = "Male", align = "Neutral";
                    let name = "Hero", death = "Died in dungeon";

                    if (parts.length >= ptsIdx + 15) {
                        // NetHack 3.3+ / 5.0 形式:
                        // version points deathdnum deathlev maxlvl hp maxhp deaths deathdate birthdate uid role race gndr algn name,death
                        dnum = parseInt(parts[ptsIdx + 1], 10) || 0;
                        dlev = parseInt(parts[ptsIdx + 2], 10) || 1;
                        mlev = parseInt(parts[ptsIdx + 3], 10) || dlev;
                        hp = parseInt(parts[ptsIdx + 4], 10) || 0;
                        maxhp = parseInt(parts[ptsIdx + 5], 10) || 0;
                        deaths = parseInt(parts[ptsIdx + 6], 10) || 0;
                        deathdate = parts[ptsIdx + 7] || "";
                        birthdate = parts[ptsIdx + 8] || "";
                        uid = parts[ptsIdx + 9] || "0";

                        role = this._sanitizeRole(parts[ptsIdx + 10]);
                        race = parts[ptsIdx + 11] || race;
                        gender = parts[ptsIdx + 12] || gender;
                        align = parts[ptsIdx + 13] || align;

                        const nameAndDeathStr = parts.slice(ptsIdx + 14).join(' ');
                        const commaIdx = nameAndDeathStr.indexOf(',');
                        if (commaIdx !== -1) {
                            name = this._sanitizeName(nameAndDeathStr.substring(0, commaIdx));
                            death = nameAndDeathStr.substring(commaIdx + 1).trim();
                        } else {
                            name = this._sanitizeName(nameAndDeathStr);
                        }
                    } else {
                        // 旧フォーマットフォールバック (NetHack 3.2 以前など deathdnum なし形式)
                        dlev = parseInt(parts[ptsIdx + 1], 10) || 1;
                        mlev = parseInt(parts[ptsIdx + 2], 10) || dlev;
                        hp = parseInt(parts[ptsIdx + 3], 10) || 0;
                        maxhp = parseInt(parts[ptsIdx + 4], 10) || 0;
                        deaths = parseInt(parts[ptsIdx + 5], 10) || 0;
                        deathdate = parts[ptsIdx + 6] || "";
                        birthdate = parts[ptsIdx + 7] || "";
                        uid = parts[ptsIdx + 8] || "0";

                        if (parts.length >= ptsIdx + 14) {
                            role = this._sanitizeRole(parts[ptsIdx + 9]);
                            race = parts[ptsIdx + 10] || race;
                            gender = parts[ptsIdx + 11] || gender;
                            align = parts[ptsIdx + 12] || align;

                            const nameAndDeathStr = parts.slice(ptsIdx + 13).join(' ');
                            const commaIdx = nameAndDeathStr.indexOf(',');
                            if (commaIdx !== -1) {
                                name = this._sanitizeName(nameAndDeathStr.substring(0, commaIdx));
                                death = nameAndDeathStr.substring(commaIdx + 1).trim();
                            } else {
                                name = this._sanitizeName(nameAndDeathStr);
                            }
                        }
                    }

                    name = this._sanitizeName(name);
                    role = this._sanitizeRole(role);
                    if (!death) death = "Died in dungeon";

                    const mainVerPrefix = currentVersion ? currentVersion.split('.')[0] + '.' : '';
                    const isVerMatch = !filterCurrentVer || ver === currentVersion || (mainVerPrefix && ver.startsWith(mainVerPrefix));

                    if (isVerMatch) {
                        list.push({
                            version: ver,
                            points: pts,
                            deathLev: dlev,
                            maxLev: mlev,
                            hp: hp,
                            maxHp: maxhp,
                            deaths: deaths,
                            deathDate: deathdate,
                            birthDate: birthdate,
                            role: role,
                            race: race,
                            gender: gender,
                            align: align,
                            name: name,
                            death: death,
                            score: pts
                        });
                    }
                }
            }
        }

        // B. xlogfile (拡張キーバリュー形式) のパース & 既存 record エントリとのスマートマージ
        if (xlogText && xlogText.trim()) {
            const xlogList = this.parseXlogList(xlogText, sessionInfo, filterCurrentVer ? currentVersion : null);

            // 1. 公式スコアボード (Top 10) から explore (discover) / wizard モードのエントリを除外
            //    もし recordText 側に過去の explore/wizard モードのスコアが混入していても、
            //    xlogList のモードフラグ (isDiscover / isWizard) と照合して確実に除外する
            const nonOfficialXlogs = xlogList.filter(x => x.isDiscover || x.isWizard);
            if (nonOfficialXlogs.length > 0) {
                for (let i = list.length - 1; i >= 0; i--) {
                    const rec = list[i];
                    const isNonOfficial = nonOfficialXlogs.some(xlog => {
                        const xPts = parseInt(xlog.points, 10) || 0;
                        const xName = this._sanitizeName(xlog.name);
                        const xDlev = parseInt(xlog.maxlvl || xlog.deathlev, 10) || 0;
                        const matchPts = rec.points === xPts;
                        const matchName = rec.name === xName || rec.name === 'Hero' || xName === 'Hero';
                        const matchDlev = rec.deathLev === xDlev || Math.abs(rec.deathLev - xDlev) <= 1;
                        const matchDate = !rec.deathDate || !xlog.deathdate || rec.deathDate === xlog.deathdate;
                        return matchPts && matchName && matchDlev && matchDate;
                    });
                    if (isNonOfficial) {
                        list.splice(i, 1);
                    }
                }
            }

            // 2. 通常モードの xlog エントリを既存 record リストとマージ
            for (let xlog of xlogList) {
                // 公式スコアボード (Top 10) からは explore (discover) / wizard モードのエントリを除外
                if (xlog.isDiscover || xlog.isWizard) {
                    continue;
                }

                const xPts = parseInt(xlog.points, 10) || 0;
                const xName = this._sanitizeName(xlog.name);
                const xDlev = parseInt(xlog.maxlvl || xlog.deathlev, 10) || 0;
                const xRole = this._sanitizeRole(xlog.role);

                // 同一ゲームセッションの既存 record エントリを検索
                const matchedEntry = list.find(e => 
                    e.points === xPts && 
                    (e.name === xName || e.name === 'Hero' || xName === 'Hero') &&
                    (e.deathLev === xDlev || Math.abs(e.deathLev - xDlev) <= 1)
                );

                if (matchedEntry) {
                    // 既存エントリを xlog の詳細データで上書き補強
                    if (xRole && xRole !== 'Explorer') matchedEntry.role = xRole;
                    if (xName && xName !== 'Hero') matchedEntry.name = xName;
                    if (xlog.death) matchedEntry.death = xlog.death;
                    if (xlog.race) matchedEntry.race = xlog.race;
                    if (xlog.gender) matchedEntry.gender = xlog.gender;
                    if (xlog.align) matchedEntry.align = xlog.align;
                } else {
                    list.push({
                        version: xlog.version || "5.0.0",
                        points: xPts,
                        deathLev: xDlev,
                        maxLev: parseInt(xlog.maxlvl, 10) || xDlev,
                        hp: parseInt(xlog.hp, 10) || 0,
                        maxHp: parseInt(xlog.maxhp, 10) || 0,
                        deaths: parseInt(xlog.deaths, 10) || 1,
                        deathDate: xlog.deathdate || "",
                        birthDate: xlog.birthdate || "",
                        role: xRole,
                        race: xlog.race || "Human",
                        gender: xlog.gender || "Male",
                        align: xlog.align || "Neutral",
                        name: xName,
                        death: xlog.death || "Died in dungeon",
                        score: xPts
                    });
                }
            }
        }

        // C. 重複除去 & スコア降順ソート
        const uniqueList = [];
        const seen = new Set();
        for (let item of list) {
            const key = `${item.name}_${item.points}_${item.deathLev}_${item.death}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueList.push(item);
            }
        }

        uniqueList.sort((a, b) => (b.points || 0) - (a.points || 0));
        return uniqueList.slice(0, 10);
    }

    /**
     * xlogfile テキストからキーバリューオブジェクト配列を生成
     */
    static parseXlogList(xlogText, sessionInfo = null, targetVer = null) {
        if (!xlogText || !xlogText.trim()) return [];
        const lines = xlogText.split('\n');
        const results = [];

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            const entry = {};
            const matches = [...line.matchAll(/([a-zA-Z0-9_]+)=/g)];
            if (matches.length > 0) {
                for (let i = 0; i < matches.length; i++) {
                    const key = matches[i][1];
                    const startValIdx = matches[i].index + matches[i][0].length;
                    const endValIdx = (i + 1 < matches.length) ? matches[i + 1].index : line.length;
                    const val = line.substring(startValIdx, endValIdx).trim();
                    entry[key] = val;
                }
            }

            if (entry.name || entry.points || entry.death) {
                // flags から explore (discover) / wizard モードを判定
                // NetHack 5.0 topten.c: bit 0 (0x1) = wizard, bit 1 (0x2) = discover
                let flagsNum = 0;
                if (entry.flags !== undefined) {
                    if (typeof entry.flags === 'string' && entry.flags.startsWith('0x')) {
                        flagsNum = parseInt(entry.flags, 16) || 0;
                    } else {
                        flagsNum = parseInt(entry.flags, 10) || 0;
                    }
                }
                entry.isWizard = (flagsNum & 0x1) !== 0 || entry.mode === 'wizard';
                entry.isDiscover = (flagsNum & 0x2) !== 0 || entry.mode === 'explore';

                if (targetVer) {
                    const ver = entry.version || "5.0.0";
                    const mainVerPrefix = targetVer ? targetVer.split('.')[0] + '.' : '';
                    const isVerMatch = ver === targetVer || (mainVerPrefix && ver.startsWith(mainVerPrefix));
                    if (isVerMatch) {
                        results.push(entry);
                    }
                } else {
                    results.push(entry);
                }
            }
        }
        return results;
    }

    /**
     * xlogfile から特定セッションまたは最末尾エントリを取得
     */
    static parseXlogText(xlogText, sessionInfo = null) {
        const list = this.parseXlogList(xlogText, sessionInfo, null);
        if (list.length === 0) return null;

        if (sessionInfo && sessionInfo.playerName) {
            const reqStart = sessionInfo.startTime ? (sessionInfo.startTime > 1e11 ? Math.floor(sessionInfo.startTime / 1000) : Math.floor(sessionInfo.startTime)) : null;

            // 末尾（最新）から安全に走査 (破壊的 reverse は不使用)
            for (let i = list.length - 1; i >= 0; i--) {
                const e = list[i];
                if (e.name === sessionInfo.playerName) {
                    if (reqStart && e.starttime) {
                        const entryStart = parseInt(e.starttime, 10) || 0;
                        // 60秒以内の誤差を許容してセッション合致判定
                        if (Math.abs(entryStart - reqStart) <= 60) {
                            return e;
                        }
                    } else if (!reqStart) {
                        return e;
                    }
                }
            }
        }

        // マッチしなかった場合、または sessionInfo がない場合は最新（末尾）エントリを返却
        return list[list.length - 1];
    }

    /**
     * ハイスコア配列を非同期取得
     */
    static async getScoreboardAsync(driver, sessionInfo = null, options = {}) {
        try {
            const targetSource = (driver && driver.fsManager) ? driver.fsManager : driver;
            let rawRecord = "";
            let rawXlog = "";

            if (targetSource) {
                if (typeof targetSource.readRecordTextAsync === 'function') {
                    rawRecord = await targetSource.readRecordTextAsync();
                } else if (typeof targetSource.readRecordText === 'function') {
                    rawRecord = targetSource.readRecordText();
                }

                if (typeof targetSource.readXlogTextAsync === 'function') {
                    rawXlog = await targetSource.readXlogTextAsync();
                } else if (typeof targetSource.readXlogText === 'function') {
                    rawXlog = targetSource.readXlogText();
                }
            }

            const FSM = this._getFSManager();
            if ((!rawRecord || !rawRecord.trim()) && FSM && FSM.readTextFromIndexedDB) {
                rawRecord = await FSM.readTextFromIndexedDB('record');
            }
            if ((!rawXlog || !rawXlog.trim()) && FSM && FSM.readTextFromIndexedDB) {
                rawXlog = await FSM.readTextFromIndexedDB('xlogfile');
            }

            return this.parseRecordText(rawRecord, rawXlog, sessionInfo, options);
        } catch (e) {}
        return [];
    }

    static _getFSManager() {
        if (typeof NetHackFSManager !== 'undefined') return NetHackFSManager;
        if (typeof globalThis !== 'undefined' && globalThis.NetHackFSManager) return globalThis.NetHackFSManager;
        if (typeof window !== 'undefined' && window.NetHackFSManager) return window.NetHackFSManager;
        return null;
    }

    /**
     * ハイスコア配列を同期取得
     */
    static getScoreboard(driver, sessionInfo = null, options = {}) {
        try {
            const fsManager = (driver && driver.fsManager) ? driver.fsManager : driver;
            if (fsManager && typeof fsManager.readRecordText === 'function') {
                const rawRecord = fsManager.readRecordText();
                const rawXlog = fsManager.readXlogText ? fsManager.readXlogText() : "";
                if (rawRecord || rawXlog) {
                    return this.parseRecordText(rawRecord, rawXlog, sessionInfo, options);
                }
            }
        } catch (e) {}
        return [];
    }

    /**
     * 死因テキストから理由種別を解析
     */
    static _parseReason(deathStr) {
        if (!deathStr) return 'died';
        const str = deathStr.toLowerCase();
        if (str.includes('ascended')) return 'ascended';
        if (str.includes('escaped')) return 'escaped';
        if (str.includes('quit')) return 'quit';
        if (str.includes('starv')) return 'starved';
        if (str.includes('petrif')) return 'petrified';
        if (str.includes('drown')) return 'drowned';
        if (str.includes('killed by') || str.includes('slain by')) return 'killed';
        return 'died';
    }
}
