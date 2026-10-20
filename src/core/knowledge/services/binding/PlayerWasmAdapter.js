/**
 * PlayerWasmAdapter.js
 *
 * プレイヤー耐性・能力値（uprops）、スキル熟練度（skills）、
 * および習得呪文（spellbook）の C構造体デコードとキャッシュ管理を担当。
 */

import {
    SHIM_CMD,
    MAPSEEN_ENTRY_BYTES,
    MAPSEEN_ENTRY_WORDS,
    MAPSEEN_MAX_ENTRIES,
    parseSkillsBuffer,
    parseSpellBookBuffer,
    parsePlayerProfileBuffer,
    parsePlayerSummaryBuffer,
    parseMapseenOverviewBuffer
} from './BindingConstants.js';

export class PlayerWasmAdapter {
    constructor() {
        this._cachedPlayerProps = null;
        this._cachedSkills = null;
        this._cachedWeaponSlots = 0;
        this._cachedSpells = null;
        this._cachedPlayerSummary = null;
        this._cachedPlayerProfile = null;
        this._cachedMapseen = null;
    }

    /**
     * フロア移動時に前フロアのサマリーキャッシュ（dnum / dlevel / floorKey）を破棄
     */
    clearFloorCaches() {
        this._cachedPlayerSummary = null;
    }

    /**
     * プレイヤーに関する全キャッシュを破棄・リセット (新ゲーム開始 / リスタート時)
     */
    clearPlayerCaches() {
        this._cachedPlayerProps = null;
        this._cachedSkills = null;
        this._cachedWeaponSlots = 0;
        this._cachedSpells = null;
        this._cachedPlayerSummary = null;
        this._cachedPlayerProfile = null;
        this._cachedMapseen = null;
    }

    resetCache() {
        this.clearPlayerCaches();
    }

    get cachedMapseen() {
        return this._cachedMapseen;
    }

    set cachedMapseen(val) {
        this._cachedMapseen = val;
    }

    get cachedPlayerProfile() {
        return this._cachedPlayerProfile;
    }

    set cachedPlayerProfile(val) {
        this._cachedPlayerProfile = val;
    }

    get cachedPlayerProps() {
        return this._cachedPlayerProps;
    }

    set cachedPlayerProps(val) {
        this._cachedPlayerProps = val;
    }

    get cachedSkills() {
        return this._cachedSkills;
    }

    set cachedSkills(val) {
        this._cachedSkills = val;
    }

    get cachedWeaponSlots() {
        return this._cachedWeaponSlots;
    }

    set cachedWeaponSlots(val) {
        this._cachedWeaponSlots = val;
    }

    get cachedSpells() {
        return this._cachedSpells;
    }

    set cachedSpells(val) {
        this._cachedSpells = val;
    }

    get cachedPlayerSummary() {
        return this._cachedPlayerSummary;
    }

    set cachedPlayerSummary(val) {
        this._cachedPlayerSummary = val;
    }

    /**
     * 全スキル熟練度の一括ダンプ同期 (DUMP_SKILLS)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Array<Object>}
     */
    dumpSkills(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedSkills || [];
        if (hasLiveMemory && memory) {
            const bufSize = 38 * 2 * 4; // 304 bytes
            const bufPtr = memory.allocateBuffer(bufSize);
            if (bufPtr) {
                try {
                    const slots = memory.bridgeCall(SHIM_CMD.DUMP_SKILLS, 0, 0, bufPtr, bufSize);
                    if (slots >= 0) {
                        const raw = memory.readInt32Array(bufPtr, 38 * 2);
                        const skills = parseSkillsBuffer(raw, slots);
                        this._cachedSkills = skills;
                        this._cachedWeaponSlots = slots;
                        return skills;
                    }
                } finally {
                    memory.freeBuffer(bufPtr);
                }
            }
        }
        return this._cachedSkills || [];
    }

    /**
     * 最新の全スキルリストを取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Array<Object>}
     */
    getSkills(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return [];
        if (hasLiveMemory) {
            return this.dumpSkills(memory, isAvailable, hasLiveMemory);
        }
        return this._cachedSkills || [];
    }

    /**
     * 全呪文リストの一括ダンプ同期 (DUMP_SPELL_BOOK)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Array<Object>}
     */
    dumpSpellBook(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedSpells || [];
        if (hasLiveMemory && memory) {
            const bufSize = 1024;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (bufPtr) {
                try {
                    const res = memory.bridgeCall(SHIM_CMD.DUMP_SPELL_BOOK, 0, 0, bufPtr, bufSize);
                    if (res >= 0) {
                        const raw = memory.readInt32Array(bufPtr, 256);
                        const spells = parseSpellBookBuffer(raw, res);
                        this._cachedSpells = spells;
                        return spells;
                    }
                } finally {
                    memory.freeBuffer(bufPtr);
                }
            }
        }
        return this._cachedSpells || [];
    }

    /**
     * 最新の全呪文リストを取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Array<Object>}
     */
    getSpellBook(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return [];
        if (hasLiveMemory) {
            return this.dumpSpellBook(memory, isAvailable, hasLiveMemory);
        }
        return this._cachedSpells || [];
    }

    /**
     * プレイヤーの真の属性・耐性配列 (u.uprops: 69要素) を取得
     * 各要素: (intrinsic & 0xFFFF) | ((extrinsic & 0xFFFF) << 16)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Array<number>|null}
     */
    getPlayerProps(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedPlayerProps || null;

        if (hasLiveMemory && memory) {
            const LAST_PROP = 68;
            const count = LAST_PROP + 1;
            const bufSize = count * 4;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (!bufPtr) return this._cachedPlayerProps || null;

            try {
                const res = memory.bridgeCall(SHIM_CMD.GET_PLAYER_PROPS, 0, 0, bufPtr, bufSize);
                if (res > 0) {
                    const raw = memory.readInt32Array(bufPtr, res);
                    this._cachedPlayerProps = Array.from(raw);
                    return this._cachedPlayerProps;
                }
            } finally {
                memory.freeBuffer(bufPtr);
            }
        }

        return this._cachedPlayerProps || null;
    }

    /**
     * プレイヤーの属性・耐性配列を非同期取得 (Worker 調停対応)
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Promise<Array<number>|null>}
     */
    async fetchPlayerProps(bridge, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory) {
            return this.getPlayerProps(memory, isAvailable, hasLiveMemory);
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const LAST_PROP = 68;
                const count = LAST_PROP + 1;
                const bufSize = count * 4;
                const res = await bridge.callShim(SHIM_CMD.GET_PLAYER_PROPS, 0, 0, bufSize, 'int32');
                if (res && Array.isArray(res.buffer)) {
                    this._cachedPlayerProps = res.buffer;
                    return this._cachedPlayerProps;
                }
            } catch (e) {
                console.warn('[PlayerWasmAdapter] fetchPlayerProps error:', e);
            }
        }

        return this._cachedPlayerProps || null;
    }

    /**
     * プレイヤーの真値プロファイル (種族・職業・属性・性別等) を一括ダンプ同期 (SHIM_CMD_GET_PLAYER_PROFILE)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    dumpPlayerProfile(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedPlayerProfile || null;
        if (hasLiveMemory && memory) {
            const bufSize = 256;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (bufPtr) {
                try {
                    const res = memory.bridgeCall(SHIM_CMD.GET_PLAYER_PROFILE, 0, 0, bufPtr, bufSize);
                    if (res >= 0) {
                        const raw = memory.readInt32Array(bufPtr, 16);
                        const roleName = memory.readString(bufPtr + 64, 64);
                        const raceName = memory.readString(bufPtr + 128, 64);
                        const plname = memory.readString(bufPtr + 192, 64);
                        const profile = parsePlayerProfileBuffer(raw, roleName, raceName, plname);
                        if (profile) {
                            this._cachedPlayerProfile = profile;
                            return profile;
                        }
                    }
                } finally {
                    memory.freeBuffer(bufPtr);
                }
            }
        }
        return this._cachedPlayerProfile || null;
    }

    /**
     * 最新のプレイヤー真値プロファイルを取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getPlayerProfile(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedPlayerProfile || null;
        if (hasLiveMemory) {
            return this.dumpPlayerProfile(memory, isAvailable, hasLiveMemory);
        }
        return this._cachedPlayerProfile || null;
    }

    /**
     * プレイヤーの真値プロファイルを非同期取得 (Worker 調停対応)
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Promise<Object|null>}
     */
    async fetchPlayerProfile(bridge, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory) {
            return this.getPlayerProfile(memory, isAvailable, hasLiveMemory);
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const bufSize = 256;
                const res = await bridge.callShim(SHIM_CMD.GET_PLAYER_PROFILE, 0, 0, bufSize, 'int32');
                if (res && res.result >= 0 && Array.isArray(res.buffer)) {
                    const profile = parsePlayerProfileBuffer(res.buffer);
                    if (profile) {
                        this._cachedPlayerProfile = profile;
                        return profile;
                    }
                }
            } catch (e) {
                console.warn('[PlayerWasmAdapter] fetchPlayerProfile error:', e);
            }
        }

        return this._cachedPlayerProfile || null;
    }

    /**
     * プレイヤーのサマリー情報 (dnum, dlevel, ublesscnt, ugangr等) を一括ダンプ同期 (SHIM_CMD_GET_PLAYER_SUMMARY)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    dumpPlayerSummary(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedPlayerSummary || null;
        if (hasLiveMemory && memory) {
            const bufSize = 32; // sizeof(long) * 8
            const bufPtr = memory.allocateBuffer(bufSize);
            if (bufPtr) {
                try {
                    const res = memory.bridgeCall(SHIM_CMD.GET_PLAYER_SUMMARY, 0, 0, bufPtr, bufSize);
                    if (res === 0) {
                        const raw = memory.readInt32Array(bufPtr, 8);
                        const summary = parsePlayerSummaryBuffer(raw);
                        if (summary) {
                            this._cachedPlayerSummary = summary;
                            return summary;
                        }
                    }
                } finally {
                    memory.freeBuffer(bufPtr);
                }
            }
        }
        return this._cachedPlayerSummary || null;
    }

    /**
     * 最新のプレイヤーサマリー情報を取得 (Stage 8.4)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getPlayerSummary(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedPlayerSummary || null;
        if (hasLiveMemory) {
            return this.dumpPlayerSummary(memory, isAvailable, hasLiveMemory);
        }
        return this._cachedPlayerSummary || null;
    }

    /**
     * プレイヤーサマリー情報を非同期取得 (Worker 調停対応) (Stage 8.4)
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Promise<Object|null>}
     */
    async fetchPlayerSummary(bridge, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory) {
            return this.getPlayerSummary(memory, isAvailable, hasLiveMemory);
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const bufSize = 32;
                const res = await bridge.callShim(SHIM_CMD.GET_PLAYER_SUMMARY, 0, 0, bufSize, 'int32');
                if (res && res.result === 0 && Array.isArray(res.buffer)) {
                    const summary = parsePlayerSummaryBuffer(res.buffer);
                    if (summary) {
                        this._cachedPlayerSummary = summary;
                        return summary;
                    }
                }
            } catch (e) {
                console.warn('[PlayerWasmAdapter] fetchPlayerSummary error:', e);
            }
        }

        return this._cachedPlayerSummary || null;
    }

    /**
     * 全踏破階層・施設・メモ一覧 (svm.mapseenchn) を一括ダンプ同期 (SHIM_CMD_DUMP_MAPSEEN)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {number} [maxEntries=MAPSEEN_MAX_ENTRIES]
     * @returns {Array<Object>} MapseenFloorInfo[]
     */
    dumpMapseen(memory, isAvailable, hasLiveMemory, maxEntries = MAPSEEN_MAX_ENTRIES) {
        if (!isAvailable) return this._cachedMapseen || [];
        if (hasLiveMemory && memory) {
            const bufSize = maxEntries * MAPSEEN_ENTRY_BYTES;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (bufPtr) {
                try {
                    const count = memory.bridgeCall(SHIM_CMD.DUMP_MAPSEEN, 0, 0, bufPtr, bufSize);
                    if (count >= 0) {
                        if (count === 0) {
                            this._cachedMapseen = [];
                            return [];
                        }
                        const raw = memory.readInt32Array(bufPtr, count * MAPSEEN_ENTRY_WORDS);
                        const list = parseMapseenOverviewBuffer(raw, count);
                        this._cachedMapseen = list;
                        return list;
                    }
                } finally {
                    memory.freeBuffer(bufPtr);
                }
            }
        }
        return this._cachedMapseen || [];
    }

    /**
     * 最新のダンジョン踏破履歴・施設・メモ一覧を取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Array<Object>} MapseenFloorInfo[]
     */
    getDungeonOverview(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return this._cachedMapseen || [];
        if (hasLiveMemory) {
            return this.dumpMapseen(memory, isAvailable, hasLiveMemory);
        }
        return this._cachedMapseen || [];
    }

    /**
     * ダンジョン踏破履歴・施設・メモ一覧を非同期取得 (Worker 調停対応)
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {number} [maxEntries=MAPSEEN_MAX_ENTRIES]
     * @returns {Promise<Array<Object>>} MapseenFloorInfo[]
     */
    async fetchDungeonOverview(bridge, memory, isAvailable, hasLiveMemory, maxEntries = MAPSEEN_MAX_ENTRIES) {
        if (!isAvailable) return [];

        if (hasLiveMemory) {
            return this.getDungeonOverview(memory, isAvailable, hasLiveMemory);
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const bufSize = maxEntries * MAPSEEN_ENTRY_BYTES;
                const res = await bridge.callShim(SHIM_CMD.DUMP_MAPSEEN, 0, 0, bufSize, 'int32');
                if (res && typeof res.result === 'number' && res.result >= 0 && Array.isArray(res.buffer)) {
                    const list = parseMapseenOverviewBuffer(res.buffer, res.result);
                    this._cachedMapseen = list;
                    return list;
                }
            } catch (e) {
                console.warn('[PlayerWasmAdapter] fetchDungeonOverview error:', e);
            }
        }

        return this._cachedMapseen || [];
    }
}
