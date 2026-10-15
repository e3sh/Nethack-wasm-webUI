/**
 * DiscoveryWasmAdapter.js
 *
 * 識別図鑑（oc_name_known）、シャッフル外見インデックス（oc_descr_idx）、
 * およびプレイヤー個別仮名（oc_uname）の C構造体デコードおよびキャッシュ管理を担当。
 */

import { SHIM_CMD } from './BindingConstants.js';

export class DiscoveryWasmAdapter {
    constructor() {
        this._cachedDiscoveries = null;
        this._cachedDescrIndexes = null;
    }

    get cachedDiscoveries() {
        return this._cachedDiscoveries;
    }

    set cachedDiscoveries(val) {
        this._cachedDiscoveries = val;
    }

    get cachedDescrIndexes() {
        return this._cachedDescrIndexes;
    }

    set cachedDescrIndexes(val) {
        this.setCachedDescrIndexes(val);
    }

    /**
     * 全アイテムの識別状態 (objects[i].oc_name_known) 配列を取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Uint8Array|null}
     */
    getDiscoveries(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory && memory) {
            const bufSize = 1024;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (!bufPtr) return null;

            try {
                const res = memory.bridgeCall(SHIM_CMD.DUMP_DISCOVERIES, 0, 0, bufPtr, bufSize);
                if (res === 0) {
                    const raw = memory.readUint8Array(bufPtr, 600);
                    return new Uint8Array(raw);
                }
            } finally {
                memory.freeBuffer(bufPtr);
            }
            return null;
        }

        return this._cachedDiscoveries || null;
    }

    /**
     * 特定 onum のプレイヤー仮名 (objects[otyp].oc_uname) を取得
     * @param {number} onum 
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {string|null}
     */
    getObjectUname(onum, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable || !hasLiveMemory || !memory || typeof onum !== 'number' || onum < 0) return null;

        const bufSize = 128;
        const bufPtr = memory.allocateBuffer(bufSize);
        if (!bufPtr) return null;

        try {
            const res = memory.bridgeCall(SHIM_CMD.GET_OBJECT_UNAME, onum, 0, bufPtr, bufSize);
            if (res === 1) {
                const str = memory.readString(bufPtr, bufSize);
                return str ? str.trim() : null;
            }
        } finally {
            memory.freeBuffer(bufPtr);
        }
        return null;
    }

    /**
     * 全アイテムの現在の外見インデックス (objects[i].oc_descr_idx) 配列を取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Int32Array|null}
     */
    getDescrIndexes(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory && memory) {
            const bufSize = 2400; // 600 ints = 2400 bytes
            const bufPtr = memory.allocateBuffer(bufSize);
            if (!bufPtr) return null;

            try {
                const res = memory.bridgeCall(SHIM_CMD.DUMP_DESCR_INDEXES, 0, 0, bufPtr, bufSize);
                if (res > 0) {
                    const count = Math.min(600, res + 1);
                    const raw = memory.readInt32Array(bufPtr, count);
                    const arr = new Int32Array(raw);
                    this._cachedDescrIndexes = arr;
                    return arr;
                }
            } finally {
                memory.freeBuffer(bufPtr);
            }
            return null;
        }

        return this._cachedDescrIndexes || null;
    }

    /**
     * テスト用 / Worker 受信用 外見インデックス配列キャッシュ設定
     * @param {Int32Array|Array<number>|null} arr
     */
    setCachedDescrIndexes(arr) {
        if (!arr) {
            this._cachedDescrIndexes = null;
        } else {
            this._cachedDescrIndexes = arr instanceof Int32Array ? arr : new Int32Array(arr);
        }
    }
}
