/**
 * MonsterWasmAdapter.js
 *
 * モンスター真値（HP、最大HP、平和・ペット属性）、動的状態フラグ
 * （睡眠、逃走、麻痺、混乱、店主等）、および周辺モンスターキャッシュ管理を担当。
 */

import { SHIM_CMD } from './BindingConstants.js';

export class MonsterWasmAdapter {
    constructor() {
        this._cachedMonsters = new Map();
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
            if (res <= 0) return null;

            const peaceful = Boolean(res & 0x01);
            const tame = Boolean((res >> 1) & 0x01);
            const hp = (res >> 8) & 0xFFF;
            const hpmax = (res >> 20) & 0xFFF;

            return {
                peaceful,
                tame,
                hp,
                hpmax
            };
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
                const sVal = (stateRes && typeof stateRes.result === 'number') ? stateRes.result : 0;

                const peaceful = Boolean(iVal & 0x01);
                const tame = Boolean((iVal >> 1) & 0x01);
                const hp = (iVal >> 8) & 0xFFF;
                const hpmax = (iVal >> 20) & 0xFFF;

                const mon = {
                    x,
                    y,
                    ptr: monPtr,
                    peaceful,
                    tame,
                    hp,
                    hpmax,
                    sleeping: Boolean(sVal & 0x01),
                    fleeing: Boolean((sVal >> 1) & 0x01),
                    paralyzed: Boolean((sVal >> 2) & 0x01),
                    confused: Boolean((sVal >> 3) & 0x01),
                    stunned: Boolean((sVal >> 4) & 0x01),
                    isShopkeeper: Boolean((sVal >> 5) & 0x01),
                    isPriest: Boolean((sVal >> 6) & 0x01),
                    isChameleon: Boolean((sVal >> 7) & 0x01)
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
     * フロア移動時のモンスターキャッシュクリア
     */
    clearFloorCaches() {
        if (this._cachedMonsters) {
            this._cachedMonsters.clear();
        }
    }
}
