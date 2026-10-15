/**
 * PlayerWasmAdapter.js
 *
 * プレイヤー耐性・能力値（uprops）、スキル熟練度（skills）、
 * および習得呪文（spellbook）の C構造体デコードとキャッシュ管理を担当。
 */

import { SHIM_CMD, parseSkillsBuffer, parseSpellBookBuffer } from './BindingConstants.js';

export class PlayerWasmAdapter {
    constructor() {
        this._cachedPlayerProps = null;
        this._cachedSkills = null;
        this._cachedWeaponSlots = 0;
        this._cachedSpells = null;
        this._cachedPlayerSummary = null;
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
}
