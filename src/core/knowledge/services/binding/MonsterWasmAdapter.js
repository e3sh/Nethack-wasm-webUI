/**
 * MonsterWasmAdapter.js
 *
 * モンスター真値（HP、最大HP、平和・ペット属性）、動的状態フラグ
 * （睡眠、逃走、麻痺、混乱、店主等）、および周辺モンスターキャッシュ管理を担当。
 */

import { SHIM_CMD } from './BindingConstants.js';

export const VIS_MON_FIELDS = 8;
export const VIS_MON_MAX = 256;

/**
 * C コア 0x22 GET_MONSTER_INFO の 32bit パック整数をアンパック
 * レイアウト: bit0=peaceful, bit1=tame, bit2..7=0(予約), bit8..19=hp(12bit), bit20..31=hpmax(12bit)
 * ※ wasm32 では long が signed 32-bit として返るため、hpmax >= 2048 (0x800) で負数になる。
 *    不在 (0) と範囲外エラー (-1 または予約ビット 0xFC 非ゼロ) のみを除外し、>>> 0 で符号なし解釈する。
 * @param {number} res
 * @returns {{ peaceful: boolean, tame: boolean, hp: number, hpmax: number }|null}
 */
export function unpackMonsterInfo(res) {
    if (typeof res !== 'number' || res === 0 || res === -1 || (res & 0xFC) !== 0) {
        return null;
    }
    const u = res >>> 0;
    return {
        peaceful: Boolean(u & 0x01),
        tame: Boolean((u >>> 1) & 0x01),
        hp: (u >>> 8) & 0xFFF,
        hpmax: (u >>> 20) & 0xFFF
    };
}

/**
 * C コア 0x24 DUMP_VISIBLE_MONSTERS の int32 配列をアンパック
 * @param {Int32Array|number[]} raw
 * @param {number} count
 * @returns {import('../../../index').VisibleMonsterSnapshot[]}
 */
export function unpackVisibleMonsters(raw, count) {
    const list = [];
    for (let i = 0; i < count; i++) {
        const b = i * VIS_MON_FIELDS;
        const flags = raw[b + 6] | 0;
        list.push({
            monsterId: raw[b] >>> 0,
            x: raw[b + 1],
            y: raw[b + 2],
            hp: raw[b + 3],
            maxHp: raw[b + 4],
            monOffset: raw[b + 5],
            peaceful: Boolean(flags & 0x01),
            tame: Boolean(flags & 0x02),
            directlySeen: Boolean(flags & 0x04),
            isShopkeeper: Boolean(flags & 0x08),
            isPriest: Boolean(flags & 0x10)
        });
    }
    return list;
}

export class MonsterWasmAdapter {
    constructor() {
        this._cachedMonsters = new Map();
        /** @type {import('../../../index').VisibleMonsterSnapshot[]|null} */
        this._visibleSnapshot = null;
        /** @type {Map<number, number>} mnum -> died */
        this._diedCache = new Map();
    }

    get cachedMonsters() {
        return this._cachedMonsters;
    }

    set cachedMonsters(map) {
        this._cachedMonsters = map instanceof Map ? map : new Map(map ? Object.entries(map) : []);
    }

    /**
     * 指定座標のモンスターポインタを取得 (存在しない場合は 0)
     * @param {number} x
     * @param {number} y
     * @param {Object} memory
     * @param {boolean} hasLiveMemory
     * @returns {number} struct monst*
     */
    getMonsterAt(x, y, memory, hasLiveMemory) {
        if (!hasLiveMemory || !memory) return 0;
        if (typeof x !== 'number' || typeof y !== 'number') return 0;

        const ptr = memory.bridgeCall(SHIM_CMD.GET_MONSTER_AT, x, y, 0, 0);
        return (ptr && ptr > 0) ? ptr : 0;
    }

    /**
     * 指定座標のモンスター情報 (平和/ペット/HP/最大HP) を取得
     * @param {number} x
     * @param {number} y
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getMonsterInfo(x, y, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (hasLiveMemory && memory) {
            const res = memory.bridgeCall(SHIM_CMD.GET_MONSTER_INFO, x, y, 0, 0);
            return unpackMonsterInfo(res);
        }

        const cached = this._cachedMonsters ? this._cachedMonsters.get(`${x},${y}`) : null;
        if (cached) {
            return {
                peaceful: Boolean(cached.peaceful),
                tame: Boolean(cached.tame),
                hp: cached.hp || 0,
                hpmax: cached.hpmax || 0
            };
        }

        return null;
    }

    /**
     * 指定座標のモンスター動的状態 (睡眠/逃走/麻痺/混乱/店主/僧侶等) を取得
     * @param {number} x
     * @param {number} y
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getMonsterState(x, y, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (hasLiveMemory && memory) {
            const monPtr = this.getMonsterAt(x, y, memory, hasLiveMemory);
            if (!monPtr) return null;

            const res = memory.bridgeCall(SHIM_CMD.GET_MONSTER_STATE, x, y, 0, 0);
            if (res < 0) return null;

            return {
                ptr: monPtr,
                sleeping: Boolean(res & 0x01),
                fleeing: Boolean((res >> 1) & 0x01),
                paralyzed: Boolean((res >> 2) & 0x01),
                confused: Boolean((res >> 3) & 0x01),
                stunned: Boolean((res >> 4) & 0x01),
                isShopkeeper: Boolean((res >> 5) & 0x01),
                isPriest: Boolean((res >> 6) & 0x01),
                isChameleon: Boolean((res >> 7) & 0x01)
            };
        }

        const cached = this._cachedMonsters ? this._cachedMonsters.get(`${x},${y}`) : null;
        if (cached) {
            return {
                ptr: cached.ptr || 0,
                sleeping: Boolean(cached.sleeping),
                fleeing: Boolean(cached.fleeing),
                paralyzed: Boolean(cached.paralyzed),
                confused: Boolean(cached.confused),
                stunned: Boolean(cached.stunned),
                isShopkeeper: Boolean(cached.isShopkeeper),
                isPriest: Boolean(cached.isPriest),
                isChameleon: Boolean(cached.isChameleon)
            };
        }

        return null;
    }

    /**
     * 指定座標のモンスター完全詳細 (HP・属性・状態異常・フラグ) を取得
     * @param {number} x
     * @param {number} y
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getFullMonsterAt(x, y, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory && memory) {
            const monPtr = this.getMonsterAt(x, y, memory, hasLiveMemory);
            if (!monPtr) return null;

            const info = this.getMonsterInfo(x, y, memory, isAvailable, hasLiveMemory);
            const state = this.getMonsterState(x, y, memory, isAvailable, hasLiveMemory) || {};

            return {
                x,
                y,
                ptr: monPtr,
                peaceful: info ? info.peaceful : false,
                tame: info ? info.tame : false,
                hp: info ? info.hp : 0,
                hpmax: info ? info.hpmax : 0,
                sleeping: Boolean(state.sleeping),
                fleeing: Boolean(state.fleeing),
                paralyzed: Boolean(state.paralyzed),
                confused: Boolean(state.confused),
                stunned: Boolean(state.stunned),
                isShopkeeper: Boolean(state.isShopkeeper),
                isPriest: Boolean(state.isPriest),
                isChameleon: Boolean(state.isChameleon)
            };
        }

        return (this._cachedMonsters && this._cachedMonsters.get(`${x},${y}`)) || null;
    }

    /**
     * 指定座標のモンスター完全詳細を非同期で取得 (Worker 調停対応)
     * @param {number} x
     * @param {number} y
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Promise<Object|null>}
     */
    async fetchFullMonsterAt(x, y, bridge, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory) {
            return this.getFullMonsterAt(x, y, memory, isAvailable, hasLiveMemory);
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const ptrRes = await bridge.callShim(SHIM_CMD.GET_MONSTER_AT, x, y);
                const monPtr = (ptrRes && typeof ptrRes.result === 'number') ? ptrRes.result : 0;
                if (!monPtr || monPtr <= 0) return null;

                const [infoRes, stateRes] = await Promise.all([
                    bridge.callShim(SHIM_CMD.GET_MONSTER_INFO, x, y),
                    bridge.callShim(SHIM_CMD.GET_MONSTER_STATE, x, y)
                ]);

                const iVal = (infoRes && typeof infoRes.result === 'number') ? infoRes.result : 0;
                const sVal = (stateRes && typeof stateRes.result === 'number' && stateRes.result >= 0) ? (stateRes.result >>> 0) : 0;
                const info = unpackMonsterInfo(iVal);

                const peaceful = info ? info.peaceful : false;
                const tame = info ? info.tame : false;
                const hp = info ? info.hp : 0;
                const hpmax = info ? info.hpmax : 0;

                const mon = {
                    x,
                    y,
                    ptr: monPtr,
                    peaceful,
                    tame,
                    hp,
                    hpmax,
                    sleeping: Boolean(sVal & 0x01),
                    fleeing: Boolean((sVal >>> 1) & 0x01),
                    paralyzed: Boolean((sVal >>> 2) & 0x01),
                    confused: Boolean((sVal >>> 3) & 0x01),
                    stunned: Boolean((sVal >>> 4) & 0x01),
                    isShopkeeper: Boolean((sVal >>> 5) & 0x01),
                    isPriest: Boolean((sVal >>> 6) & 0x01),
                    isChameleon: Boolean((sVal >>> 7) & 0x01)
                };

                if (!this._cachedMonsters) this._cachedMonsters = new Map();
                this._cachedMonsters.set(`${x},${y}`, mon);
                return mon;
            } catch (err) {
                console.warn(`[MonsterWasmAdapter] fetchFullMonsterAt(${x},${y}) error:`, err);
                return null;
            }
        }

        return null;
    }

    /**
     * テスト用 / Worker 受信用 モンスターキャッシュ設定
     * @param {number} x
     * @param {number} y
     * @param {Object} monster
     */
    setCachedMonster(x, y, monster) {
        if (!this._cachedMonsters) this._cachedMonsters = new Map();
        if (monster) {
            this._cachedMonsters.set(`${x},${y}`, { x, y, ...monster });
        } else {
            this._cachedMonsters.delete(`${x},${y}`);
        }
    }

    /**
     * 視認可能モンスターの一括スナップショットを取得 (LiveMemory: 同期 / Worker: キャッシュ参照)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {import('../../../index').VisibleMonsterSnapshot[]|null}
     */
    dumpVisibleMonsters(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (hasLiveMemory && memory) {
            const bufSize = VIS_MON_MAX * VIS_MON_FIELDS * 4;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (!bufPtr) return null;
            try {
                const count = memory.bridgeCall(SHIM_CMD.DUMP_VISIBLE_MONSTERS, 0, 0, bufPtr, bufSize);
                if (count < 0) return null;
                const raw = memory.readInt32Array(bufPtr, count * VIS_MON_FIELDS);
                this._visibleSnapshot = unpackVisibleMonsters(raw, count);
                return this._visibleSnapshot;
            } finally {
                memory.freeBuffer(bufPtr);
            }
        }
        return this._visibleSnapshot ?? null;
    }

    /**
     * Worker モード用: 非同期に視認可能モンスターを一括取得して内部キャッシュに格納
     * @param {Object} bridge
     * @returns {Promise<import('../../../index').VisibleMonsterSnapshot[]|null>}
     */
    async fetchVisibleMonsters(bridge) {
        if (!bridge || typeof bridge.callShim !== 'function') return null;
        try {
            const bufSize = VIS_MON_MAX * VIS_MON_FIELDS * 4;
            const res = await bridge.callShim(SHIM_CMD.DUMP_VISIBLE_MONSTERS, 0, 0, bufSize, 'int32');
            const count = (res && typeof res.result === 'number') ? res.result : -1;
            if (count >= 0 && Array.isArray(res.buffer)) {
                this._visibleSnapshot = unpackVisibleMonsters(res.buffer, count);
                return this._visibleSnapshot;
            }
            this._visibleSnapshot = null;
            return null;
        } catch (err) {
            console.warn('[MonsterWasmAdapter] fetchVisibleMonsters error:', err);
            return null;
        }
    }

    /**
     * 指定種族の死亡数 (svm.mvitals[mnum].died) を取得
     * @param {number} mnum
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {number|null}
     */
    getMvitalsDied(mnum, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (typeof mnum !== 'number' || mnum < 0) return null;

        if (hasLiveMemory && memory) {
            const val = memory.bridgeCall(SHIM_CMD.GET_MVITALS_DIED, mnum, 0, 0, 0);
            return (val >= 0) ? val : null;
        }

        return this._diedCache?.get(mnum) ?? null;
    }

    /**
     * Worker モード / テスト用: 種族別死亡数キャッシュを設定
     * @param {number} mnum
     * @param {number} val
     */
    setDiedCache(mnum, val) {
        if (!this._diedCache) this._diedCache = new Map();
        this._diedCache.set(mnum, val);
    }

    /**
     * フロア移動時のモンスターキャッシュクリア
     */
    clearFloorCaches() {
        if (this._cachedMonsters) {
            this._cachedMonsters.clear();
        }
        this._visibleSnapshot = null;
        if (this._diedCache) {
            this._diedCache.clear();
        }
    }
}
