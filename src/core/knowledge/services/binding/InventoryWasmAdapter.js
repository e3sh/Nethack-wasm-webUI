/**
 * InventoryWasmAdapter.js
 *
 * 所持品リンクリスト (gi.invent -> nobj)、インベントリ一括ダンプ (DUMP_ALL_INVENT)、
 * 14スロット装備ポインタ (GET_EQUIPMENT_PTRS)、アイテム構造体デコード (unpackObjectBuffer)、
 * アイテム・コンテナ・総所持重量計算、および空間床落ちアイテムの C構造体デコードとキャッシュ管理を担当。
 */

import {
    SHIM_CMD,
    EQUIPMENT_FIELD_KEYS,
    EQUIPMENT_SLOT_NAMES
} from './BindingConstants.js';

export class InventoryWasmAdapter {
    constructor() {
        this._cachedInventory = [];
        this._cachedInventoryWeight = -1;
        this._cachedEquipmentPtrs = { rawPtrs: {}, slotByPtr: new Map(), ptrBySlot: new Map() };
        this._cachedPlayerFloorObjects = [];
        this._cachedFloorObjectsX = -1;
        this._cachedFloorObjectsY = -1;
        this._hasFloorObjectsCache = false;
    }

    get cachedInventory() { return this._cachedInventory; }
    set cachedInventory(v) { this._cachedInventory = Array.isArray(v) ? v : []; }

    get cachedInventoryWeight() { return this._cachedInventoryWeight; }
    set cachedInventoryWeight(v) { this._cachedInventoryWeight = v; }

    get cachedEquipmentPtrs() { return this._cachedEquipmentPtrs; }
    set cachedEquipmentPtrs(v) { this._cachedEquipmentPtrs = v || { rawPtrs: {}, slotByPtr: new Map(), ptrBySlot: new Map() }; }

    get cachedPlayerFloorObjects() { return this._cachedPlayerFloorObjects; }
    set cachedPlayerFloorObjects(v) { this._cachedPlayerFloorObjects = Array.isArray(v) ? v : []; }

    get cachedFloorObjectsX() { return this._cachedFloorObjectsX; }
    set cachedFloorObjectsX(v) { this._cachedFloorObjectsX = v; }

    get cachedFloorObjectsY() { return this._cachedFloorObjectsY; }
    set cachedFloorObjectsY(v) { this._cachedFloorObjectsY = v; }

    get hasFloorObjectsCache() { return this._hasFloorObjectsCache; }
    set hasFloorObjectsCache(v) { this._hasFloorObjectsCache = Boolean(v); }

    /**
     * C構造体 struct obj の生バイナリバッファ (int32配列) を展開して構造化オブジェクトを生成
     * @param {Int32Array|Array<number>} rawValues - objInfo または dump_all_invent の 8〜12 words
     * @param {number} [ptr=0] - Cコア上の struct obj* アドレス
     * @param {number} [cobjPtr=0] - コンテナ内アイテムポインタ (struct obj* cobj)
     * @param {number} [o_id=0] 
     * @param {number} [corpsenm=-1]
     * @returns {Object|null}
     */
    unpackObjectBuffer(rawValues, ptr = 0, cobjPtr = 0, o_id = 0, corpsenm = -1) {
        if (!rawValues || rawValues.length < 8) return null;
        const otyp = rawValues[0];
        const owt = rawValues[1];
        const quan = rawValues[2];
        const spe = (rawValues[3] << 24) >> 24;
        const oclass = rawValues[4];
        const invletCode = rawValues[5];
        const invlet = (invletCode > 0 && invletCode < 128) ? String.fromCharCode(invletCode) : '';
        const flagsRaw = rawValues[6];
        const weight = rawValues[7];
        const resolvedCorpsenm = (typeof corpsenm === 'number' && corpsenm >= 0)
            ? corpsenm
            : (rawValues.length >= 9 && rawValues[8] >= 0 && rawValues[8] < 400 ? rawValues[8] : -1);

        const flags = {
            blessed: Boolean(flagsRaw & 0x01),
            cursed: Boolean(flagsRaw & 0x02),
            bknown: Boolean(flagsRaw & 0x04),
            dknown: Boolean(flagsRaw & 0x08),
            rknown: Boolean(flagsRaw & 0x10),
            oeroded: (flagsRaw >> 5) & 0x03,
            oeroded2: (flagsRaw >> 7) & 0x03,
            known: Boolean(flagsRaw & 0x200),
        };

        return {
            ptr,
            rawObjPtr: ptr,
            otyp,
            onum: otyp, // onum は otyp と 1:1 に一致
            owt,
            quan,
            spe,
            oclass,
            invlet,
            flags,
            weight,
            cobjPtr,
            o_id,
            corpsenm: resolvedCorpsenm
        };
    }

    /**
     * 所持品リンクリスト (gi.invent) を直接走査し、全アイテムの構造化データを取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Array<Object>}
     */
    getInventory(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return [];

        if (hasLiveMemory && memory) {
            // SHIM_CMD_DUMP_ALL_INVENT による一括取得を最優先 (Stage 8.2)
            const bufSize = 4800; // 100 items * 48 bytes
            const bufPtr = memory.allocateBuffer(bufSize);
            if (bufPtr) {
                try {
                    const count = memory.bridgeCall(SHIM_CMD.DUMP_ALL_INVENT, 0, 0, bufPtr, bufSize);
                    if (count >= 0) {
                        const raw = memory.readInt32Array(bufPtr, count * 12);
                        const items = [];
                        const ITEM_FIELDS = 12;
                        for (let i = 0; i < count; i++) {
                            const base = i * ITEM_FIELDS;
                            const raw8 = raw.slice(base, base + 8);
                            const ptr = raw[base + 8] || 0;
                            const o_id = raw[base + 9] || 0;
                            const cobjPtr = raw[base + 10] || 0;
                            const corpsenm = raw[base + 11] ?? -1;
                            const item = this.unpackObjectBuffer(raw8, ptr, cobjPtr, o_id, corpsenm);
                            if (item) items.push(item);
                        }
                        this._cachedInventory = items;
                        return items;
                    }
                } finally {
                    memory.freeBuffer(bufPtr);
                }
            }

            // 万一のフォールバック (個別走査)
            const headPtr = memory.bridgeCall(SHIM_CMD.GET_INVENT_PTR, 0, 0, 0, 0);
            if (!headPtr || headPtr <= 0) return [];

            const items = [];
            const visited = new Set();
            const MAX_ITEMS = 100; // 安全上限（52文字+予備）
            const singleBufSize = 36;
            const singleBufPtr = memory.allocateBuffer(singleBufSize);
            if (!singleBufPtr) return [];

            try {
                let currPtr = headPtr;
                while (currPtr > 0 && !visited.has(currPtr) && items.length < MAX_ITEMS) {
                    visited.add(currPtr);

                    const res = memory.bridgeCall(SHIM_CMD.DUMP_OBJECT_INFO, currPtr, 0, singleBufPtr, singleBufSize);
                    if (res === 0) {
                        const rawValues = memory.readInt32Array(singleBufPtr, 9);
                        const cobjPtr = memory.getValue(currPtr + 8, 'i32');
                        const o_id = memory.getValue(currPtr + 12, 'i32');
                        const item = this.unpackObjectBuffer(rawValues, currPtr, cobjPtr, o_id);
                        if (item) {
                            items.push(item);
                        }
                    }

                    // 次のアイテムへのポインタ (offset +0x00: struct obj *nobj)
                    currPtr = memory.getValue(currPtr, 'i32');
                }
            } finally {
                memory.freeBuffer(singleBufPtr);
            }

            this._cachedInventory = items;
            return items;
        }

        return this._cachedInventory || [];
    }

    /**
     * 14 種類の装備スロットポインタ配列と対応マップを取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {{ rawPtrs: Object, slotByPtr: Map<number, string>, ptrBySlot: Map<string, number> }}
     */
    getEquipmentPtrs(memory, isAvailable, hasLiveMemory) {
        const defaultResult = {
            rawPtrs: {},
            slotByPtr: new Map(),
            ptrBySlot: new Map()
        };

        if (!isAvailable) return defaultResult;

        if (hasLiveMemory && memory) {
            // long[14] = 56 bytes
            const bufSize = 56;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (!bufPtr) return defaultResult;

            try {
                const res = memory.bridgeCall(SHIM_CMD.GET_EQUIPMENT_PTRS, 0, 0, bufPtr, bufSize);
                if (res !== 0) return defaultResult;

                const ptrArray = memory.readInt32Array(bufPtr, 14);
                const rawPtrs = {};
                const slotByPtr = new Map();
                const ptrBySlot = new Map();

                for (let i = 0; i < 14; i++) {
                    const ptr = ptrArray[i] || 0;
                    const fieldKey = EQUIPMENT_FIELD_KEYS[i];
                    const slotName = EQUIPMENT_SLOT_NAMES[i];

                    rawPtrs[fieldKey] = ptr;
                    if (ptr > 0) {
                        slotByPtr.set(ptr, slotName);
                        ptrBySlot.set(slotName, ptr);
                    }
                }

                return {
                    rawPtrs,
                    slotByPtr,
                    ptrBySlot
                };
            } finally {
                memory.freeBuffer(bufPtr);
            }
        }

        return this._cachedEquipmentPtrs || defaultResult;
    }

    /**
     * 所持品リンクリストから真の総所持重量を取得 (Stage 8.2-C)
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {Function} [getInventoryFn=null]
     * @returns {number} 総所持重量 (利用不可時: -1)
     */
    getInventoryWeight(memory, isAvailable, hasLiveMemory, getInventoryFn = null) {
        if (!isAvailable) return -1;

        if (hasLiveMemory) {
            const items = typeof getInventoryFn === 'function'
                ? getInventoryFn()
                : this.getInventory(memory, isAvailable, hasLiveMemory);
            let totalWeight = 0;
            items.forEach(it => {
                if (it.oclass === 1) { // 金貨
                    totalWeight += Math.floor((it.quan || 0) / 100);
                } else {
                    totalWeight += (it.weight || 0);
                }
            });
            return totalWeight;
        }

        return this._cachedInventoryWeight >= 0 ? this._cachedInventoryWeight : -1;
    }

    /**
     * 単一アイテムの真の重量を取得 (Bag of Holding 等の補正含む) (Stage 8.2-C)
     * @param {number} objPtr 
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {number} アイテム重量 (利用不可時: -1)
     */
    getObjectWeight(objPtr, memory, isAvailable, hasLiveMemory) {
        if (!objPtr || objPtr <= 0) return 0;
        if (!isAvailable) return -1;

        if (hasLiveMemory && memory) {
            const bufSize = 32;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (!bufPtr) return -1;
            try {
                const res = memory.bridgeCall(SHIM_CMD.DUMP_OBJECT_INFO, objPtr, 0, bufPtr, bufSize);
                if (res === 0) {
                    const rawValues = memory.readInt32Array(bufPtr, 8);
                    return rawValues[7]; // weight(o)
                }
            } finally {
                memory.freeBuffer(bufPtr);
            }
            return -1;
        }

        // Worker 隔離環境: キャッシュから探索
        const found = this._cachedInventory.find(it => it.ptr === objPtr || it.rawObjPtr === objPtr);
        if (found && typeof found.weight === 'number') {
            return found.weight;
        }
        return -1;
    }

    /**
     * コンテナの内包物含む真の重量を取得 (Stage 8.2-C)
     * @param {number} objPtr 
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {number} コンテナ重量 (利用不可時: -1)
     */
    getContainerWeight(objPtr, memory, isAvailable, hasLiveMemory) {
        return this.getObjectWeight(objPtr, memory, isAvailable, hasLiveMemory);
    }

    /**
     * 指定座標 (x, y) の床アイテム情報が同期・参照可能かどうかを判定 (Stage 8.3-B)
     * @param {number} x
     * @param {number} y
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {boolean}
     */
    hasFloorObjectsCacheAt(x, y, isAvailable, hasLiveMemory) {
        if (!isAvailable) return false;
        if (typeof x !== 'number' || typeof y !== 'number') return false;
        if (hasLiveMemory) return true;
        return Boolean(
            this._hasFloorObjectsCache &&
            this._cachedFloorObjectsX === x &&
            this._cachedFloorObjectsY === y &&
            Array.isArray(this._cachedPlayerFloorObjects)
        );
    }

    /**
     * テスト用 / Worker 受信用 床落ちアイテムキャッシュ設定
     * @param {number} x
     * @param {number} y
     * @param {Array<Object>|null} items
     * @param {Function} [onSetCoordinates]
     */
    setCachedFloorObjects(x, y, items, onSetCoordinates = null) {
        if (items === null || items === undefined) {
            this._cachedPlayerFloorObjects = [];
            this._cachedFloorObjectsX = -1;
            this._cachedFloorObjectsY = -1;
            this._hasFloorObjectsCache = false;
        } else {
            this._cachedPlayerFloorObjects = Array.isArray(items) ? items : [];
            this._cachedFloorObjectsX = x;
            this._cachedFloorObjectsY = y;
            this._hasFloorObjectsCache = true;
            if (typeof onSetCoordinates === 'function') {
                onSetCoordinates(x, y);
            }
        }
    }

    /**
     * 指定座標 (x, y) の床に落ちているアイテム一覧を取得 (Stage 8.2-C)
     * @param {number} x
     * @param {number} y
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {number} [fallbackCellX=-1]
     * @param {number} [fallbackCellY=-1]
     * @returns {Array<Object>}
     */
    getObjectsAt(x, y, memory, isAvailable, hasLiveMemory, fallbackCellX = -1, fallbackCellY = -1) {
        if (!isAvailable) return [];
        if (typeof x !== 'number' || typeof y !== 'number') return [];

        if (hasLiveMemory && memory) {
            const headPtr = memory.bridgeCall(SHIM_CMD.GET_OBJECT_AT, x, y, 0, 0);
            if (!headPtr || headPtr <= 0) return [];

            const items = [];
            const visited = new Set();
            const MAX_FLOOR_ITEMS = 50;
            const bufSize = 36;
            const bufPtr = memory.allocateBuffer(bufSize);

            if (bufPtr) {
                try {
                    let currPtr = headPtr;
                    while (currPtr > 0 && !visited.has(currPtr) && items.length < MAX_FLOOR_ITEMS) {
                        visited.add(currPtr);
                        const res = memory.bridgeCall(SHIM_CMD.DUMP_OBJECT_INFO, currPtr, 0, bufPtr, bufSize);
                        if (res === 0) {
                            const rawValues = memory.readInt32Array(bufPtr, 9);
                            const cobjPtr = memory.getValue(currPtr + 8, 'i32');
                            const o_id = memory.getValue(currPtr + 12, 'i32');
                            const item = this.unpackObjectBuffer(rawValues, currPtr, cobjPtr, o_id);
                            if (item) {
                                items.push(item);
                            }
                        }
                        currPtr = memory.getValue(currPtr + 4, 'i32');
                    }
                } finally {
                    memory.freeBuffer(bufPtr);
                }
            }
            return items;
        }

        // Worker 隔離環境: 足元座標と一致する場合はキャッシュを返却
        if (((this._cachedFloorObjectsX === x && this._cachedFloorObjectsY === y) ||
             (fallbackCellX === x && fallbackCellY === y)) &&
            this._cachedPlayerFloorObjects) {
            return this._cachedPlayerFloorObjects;
        }

        return [];
    }

    /**
     * 指定座標 (x, y) の床アイテム一覧を非同期で問い合わせ取得 (Worker調停対応)
     * @param {number} x
     * @param {number} y
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Promise<Array<Object>>}
     */
    async fetchObjectsAt(x, y, bridge, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return [];
        if (hasLiveMemory) {
            return this.getObjectsAt(x, y, memory, isAvailable, hasLiveMemory);
        }
        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const headRes = await bridge.callShim(SHIM_CMD.GET_OBJECT_AT, x, y);
                const headPtr = (headRes && typeof headRes.result === 'number') ? headRes.result : 0;
                const items = [];
                if (headPtr > 0) {
                    const visited = new Set();
                    const MAX_FLOOR_ITEMS = 50;
                    let currPtr = headPtr;
                    while (currPtr > 0 && !visited.has(currPtr) && items.length < MAX_FLOOR_ITEMS) {
                        visited.add(currPtr);
                        const objRes = await bridge.callShim(SHIM_CMD.DUMP_OBJECT_INFO, currPtr, 0, 36, 'int32');
                        if (objRes && Array.isArray(objRes.buffer)) {
                            let nextPtr = 0;
                            let cobjPtr = 0;
                            let o_id = 0;
                            let corpsenm = -1;

                            if (objRes.buffer.length >= 12) {
                                corpsenm = objRes.buffer[8] ?? -1;
                                nextPtr = objRes.buffer[9] || 0;
                                cobjPtr = objRes.buffer[10] || 0;
                                o_id = objRes.buffer[11] || 0;
                            } else if (objRes.buffer.length === 11) {
                                nextPtr = objRes.buffer[8] || 0;
                                cobjPtr = objRes.buffer[9] || 0;
                                o_id = objRes.buffer[10] || 0;
                            } else if (objRes.buffer.length === 9) {
                                corpsenm = objRes.buffer[8] ?? -1;
                                nextPtr = 0;
                            } else if (objRes.buffer.length >= 8) {
                                nextPtr = 0;
                            } else {
                                break;
                            }

                            const item = this.unpackObjectBuffer(objRes.buffer, currPtr, cobjPtr, o_id, corpsenm);
                            if (item) items.push(item);

                            currPtr = (nextPtr >= 1024) ? nextPtr : 0;
                        } else {
                            break;
                        }
                    }
                }
                this._cachedPlayerFloorObjects = items;
                this._cachedFloorObjectsX = x;
                this._cachedFloorObjectsY = y;
                this._hasFloorObjectsCache = true;
                return items;
            } catch (err) {
                console.warn(`[InventoryWasmAdapter] fetchObjectsAt(${x},${y}) error:`, err);
                return [];
            }
        }
        return [];
    }

    /**
     * フロア移動時の足元アイテムキャッシュクリア
     */
    clearFloorCaches() {
        this._cachedPlayerFloorObjects = [];
        this._cachedFloorObjectsX = -1;
        this._cachedFloorObjectsY = -1;
        this._hasFloorObjectsCache = false;
    }
}
