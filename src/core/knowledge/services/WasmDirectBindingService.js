/**
 * WasmDirectBindingService.js
 *
 * GKL (Gameplay Knowledge Layer) と NetHack Wasm Cコア（shim_bridge.c / エクスポート関数）を
 * 直接結ぶ構造化バインディングサービスクラス。
 *
 * 責務:
 * 1. NetHackMemory の bridgeCall (SHIM_CMD_*) を抽象化し、安全かつ型付けされたドメインオブジェクトを提供。
 * 2. 所持品リンクリスト (gi.invent -> nobj) の直接走査とアイテム構造体 (struct obj) の一括デコード。
 * 3. 14 種類の装備スロットポインタ (uwep, uarm, uleft 等) の取得とスロット同定マップの提供。
 * 4. 公式 C 関数 (_inv_weight, _weight, _container_weight) による真の重量の同期取得。
 */

// NetHackMemory.js は UMD / Worker (importScripts) との互換性維持のため副作用インポート
import '../../../driver/NetHackMemory.js';

const getGlobalMemoryClass = () => {
    if (typeof globalThis !== 'undefined' && globalThis.NetHackMemory) return globalThis.NetHackMemory;
    if (typeof window !== 'undefined' && window.NetHackMemory) return window.NetHackMemory;
    if (typeof global !== 'undefined' && global.NetHackMemory) return global.NetHackMemory;
    return null;
};

export const SHIM_CMD = {
    GET_CELL_INFO: 0x10,
    DUMP_LEVEL_TERRAIN: 0x11,
    GET_TRAP_AT: 0x12,
    GET_ENGRAVING_AT: 0x13,
    GET_ROOM_TYPE: 0x14,

    GET_OBJECT_AT: 0x20,
    GET_MONSTER_AT: 0x21,
    GET_MONSTER_INFO: 0x22,
    GET_MONSTER_STATE: 0x23,

    GET_PLAYER_SUMMARY: 0x30,
    GET_PLAYER_PTR: 0x31,
    GET_PLAYER_PROPS: 0x32,

    GET_INVENT_PTR: 0x40,
    GET_EQUIPMENT_PTRS: 0x41,
    DUMP_OBJECT_INFO: 0x42,

    DUMP_SPELL_BOOK: 0x50,
    DUMP_SKILLS: 0x51,

    DUMP_DISCOVERIES: 0x60,
    GET_OBJECT_UNAME: 0x61,

    GET_SYMBOL_PTR: 0x70,
};

export const LEVL_TYP = {
    STONE: 0,
    VWALL: 1,
    HWALL: 2,
    TLCORNER: 3,
    TRCORNER: 4,
    BLCORNER: 5,
    BRCORNER: 6,
    CROSSWALL: 7,
    TUWALL: 8,
    TDWALL: 9,
    TLWALL: 10,
    TRWALL: 11,
    DBWALL: 12,
    TREE: 13,
    SDOOR: 14,
    SCORR: 15,
    POOL: 16,
    MOAT: 17,
    WATER: 18,
    DRAWBRIDGE_UP: 19,
    LAVAPOOL: 20,
    LAVAWALL: 21,
    IRONBARS: 22,
    DOOR: 23,
    CORR: 24,
    ROOM: 25,
    STAIRS: 26,
    LADDER: 27,
    FOUNTAIN: 28,
    THRONE: 29,
    SINK: 30,
    GRAVE: 31,
    ALTAR: 32,
    ICE: 33,
    DRAWBRIDGE_DOWN: 34,
    AIR: 35,
    CLOUD: 36
};

export const DOOR_STATE = {
    D_NODOOR: 0x00,
    D_BROKEN: 0x01,
    D_ISOPEN: 0x02,
    D_CLOSED: 0x04,
    D_LOCKED: 0x08,
    D_TRAPPED: 0x10
};

export const ROOM_TYPE = {
    OROOM: 0,
    THEMEROOM: 1,
    COURT: 2,
    SWAMP: 3,
    VAULT: 4,
    BEEHIVE: 5,
    MORGUE: 6,
    BARRACKS: 7,
    ZOO: 8,
    DELPHI: 9,
    TEMPLE: 10,
    LEPREHALL: 11,
    COCKNEST: 12,
    ANTHOLE: 13,
    SHOPBASE: 14,
    ARMORSHOP: 15,
    SCROLLSHOP: 16,
    POTIONSHOP: 17,
    WEAPONSHOP: 18,
    FOODSHOP: 19,
    RINGSHOP: 20,
    WANDSHOP: 21,
    TOOLSHOP: 22,
    BOOKSHOP: 23,
    FODDERSHOP: 24,
    CANDLESHOP: 25
};

export const ROOM_NAMES = {
    0: { name: 'Ordinary Room', nameJa: '普通の部屋' },
    1: { name: 'Theme Room', nameJa: 'テーマ部屋' },
    2: { name: 'Throne Room', nameJa: '玉座の間' },
    3: { name: 'Swamp', nameJa: '沼地' },
    4: { name: 'Vault', nameJa: '宝物庫' },
    5: { name: 'Beehive', nameJa: '蜂の巣' },
    6: { name: 'Morgue', nameJa: '死体安置所' },
    7: { name: 'Barracks', nameJa: '兵舎' },
    8: { name: 'Zoo', nameJa: '動物園' },
    9: { name: 'Delphi', nameJa: '神託所' },
    10: { name: 'Temple', nameJa: '寺院' },
    11: { name: 'Leprechaun Hall', nameJa: 'レプラホーンの広間' },
    12: { name: 'Cockatrice Nest', nameJa: 'コカトリスの巣' },
    13: { name: 'Anthole', nameJa: '蟻の巣' },
    14: { name: 'General Store', nameJa: '雑貨屋' },
    15: { name: 'Armor Shop', nameJa: '防具屋' },
    16: { name: 'Scroll Shop', nameJa: '巻物屋' },
    17: { name: 'Potion Shop', nameJa: '薬屋' },
    18: { name: 'Weapon Shop', nameJa: '武器屋' },
    19: { name: 'Delicatessen', nameJa: '食料品店' },
    20: { name: 'Jewelry Shop', nameJa: '宝石店' },
    21: { name: 'Wand Shop', nameJa: '杖屋' },
    22: { name: 'Tool Shop', nameJa: '道具屋' },
    23: { name: 'Bookstore', nameJa: '書店' },
    24: { name: 'Health Food Store', nameJa: '自然食品店' },
    25: { name: 'Candle Shop', nameJa: '蝋燭屋' }
};

export const TRAP_TYPE = {
    NO_TRAP: 0,
    ARROW_TRAP: 1,
    DART_TRAP: 2,
    ROCKTRAP: 3,
    SQKY_BOARD: 4,
    BEAR_TRAP: 5,
    LANDMINE: 6,
    ROLLING_BOULDER_TRAP: 7,
    SLP_GAS_TRAP: 8,
    RUST_TRAP: 9,
    FIRE_TRAP: 10,
    PIT: 11,
    SPIKED_PIT: 12,
    HOLE: 13,
    TRAPDOOR: 14,
    TELEP_TRAP: 15,
    LEVEL_TELEP: 16,
    MAGIC_PORTAL: 17,
    WEB: 18,
    STATUE_TRAP: 19,
    MAGIC_TRAP: 20,
    ANTI_MAGIC: 21,
    POLY_TRAP: 22,
    VIBRATING_SQUARE: 23
};

export const TRAP_NAMES = {
    1: { name: 'arrow trap', nameJa: '矢の罠' },
    2: { name: 'dart trap', nameJa: 'ダーツの罠' },
    3: { name: 'rock trap', nameJa: '落石の罠' },
    4: { name: 'squeaky board', nameJa: '鳴る床板' },
    5: { name: 'bear trap', nameJa: 'トラバサミ' },
    6: { name: 'land mine', nameJa: '地雷' },
    7: { name: 'rolling boulder trap', nameJa: '大岩の罠' },
    8: { name: 'sleeping gas trap', nameJa: '睡眠ガスの罠' },
    9: { name: 'rust trap', nameJa: 'サビの罠' },
    10: { name: 'fire trap', nameJa: '火炎の罠' },
    11: { name: 'pit', nameJa: '落とし穴 (ピット)' },
    12: { name: 'spiked pit', nameJa: 'トゲ付きピット' },
    13: { name: 'hole', nameJa: '大穴' },
    14: { name: 'trap door', nameJa: '落とし扉' },
    15: { name: 'teleportation trap', nameJa: 'テレポートの罠' },
    16: { name: 'level teleporter', nameJa: '階層テレポートの罠' },
    17: { name: 'magic portal', nameJa: '魔法のポータル' },
    18: { name: 'web', nameJa: 'クモの巣' },
    19: { name: 'statue trap', nameJa: '像の罠' },
    20: { name: 'magic trap', nameJa: '魔法の罠' },
    21: { name: 'anti-magic field', nameJa: '反魔法の場' },
    22: { name: 'polymorph trap', nameJa: '変化の罠' },
    23: { name: 'vibrating square', nameJa: '振動する床' }
};

export const ENGRAVING_TYPE = {
    DUST: 1,
    ENGRAVE: 2,
    BURN: 3,
    MARK: 4,
    ENGR_BLOOD: 5,
    HEADSTONE: 6
};

export const ENGRAVING_NAMES = {
    1: { name: 'dust', nameJa: '砂/埃' },
    2: { name: 'engraved', nameJa: '彫り' },
    3: { name: 'burned', nameJa: '焼き' },
    4: { name: 'mark', nameJa: '印' },
    5: { name: 'blood', nameJa: '血' },
    6: { name: 'headstone', nameJa: '墓石' }
};

export const EQUIPMENT_SLOT_NAMES = [
    'weapon',      // 0: uwep
    'offhand',     // 1: uswapwep
    'quiver',      // 2: uquiver
    'suit',        // 3: uarm (鎧/胴防具)
    'cloak',       // 4: uarmc (マント)
    'helmet',      // 5: uarmh (兜/帽子)
    'shield',      // 6: uarms (盾)
    'gloves',      // 7: uarmg (手袋)
    'boots',       // 8: uarmf (靴)
    'shirt',       // 9: uarmu (シャツ/下着)
    'amulet',      // 10: uamul (魔除け)
    'ring_left',   // 11: uleft (左手指輪)
    'ring_right',  // 12: uright (右手指輪)
    'blindfold'    // 13: ublindf (目隠し/眼鏡)
];

export const EQUIPMENT_FIELD_KEYS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmc', 'uarmh',
    'uarms', 'uarmg', 'uarmf', 'uarmu', 'uamul', 'uleft', 'uright', 'ublindf'
];

export class WasmDirectBindingService {
    /**
     * @param {Object} [options={}]
     * @param {Object} [options.bridge] - NetHackWasmWorkerBridge インスタンス
     * @param {Object} [options.driver] - Driver または WorkerBridge
     * @param {NetHackMemory} [options.memory] - NetHackMemory インスタンス
     * @param {Object} [options.module] - Emscripten Module インスタンス
     */
    constructor(options = {}) {
        this.bridge = options.bridge || (options.driver && options.driver.callShim ? options.driver : null);
        const MemClass = getGlobalMemoryClass();
        if (options.memory) {
            this.memory = options.memory;
        } else if (options.module && MemClass) {
            this.memory = new MemClass(options.module);
        } else {
            this.memory = null;
        }

        // Web Worker 隔離調停用キャッシュ
        this._cachedCellInfo = null;
        this._cachedCellX = -1;
        this._cachedCellY = -1;
        this._cachedRoom = null;
        this._cachedTrap = null;
        this._cachedEngraving = null;
        this._cachedInventory = [];
        this._cachedEquipmentPtrs = { rawPtrs: {}, slotByPtr: new Map(), ptrBySlot: new Map() };
        this._cachedPlayerSummary = null;
    }

    /**
     * NetHackWasmWorkerBridge インスタンスの設定
     * @param {Object} bridge
     */
    setBridge(bridge) {
        this.bridge = bridge;
    }

    /**
     * NetHackMemory インスタンスの設定
     * @param {Object} mem 
     */
    setMemory(mem) {
        this.memory = mem;
    }

    /**
     * Wasm モジュールの参照取得
     * @returns {Object|null}
     */
    get Module() {
        return this.memory ? this.memory.Module : (typeof globalThis !== 'undefined' ? globalThis.Module : null);
    }

    /**
     * 生メモリ (_shim_bridge_call) への直接参照が存在し利用可能か判定
     * @returns {boolean}
     */
    get hasLiveMemory() {
        if (!this.memory) return false;
        if (typeof this.memory.isBridgeAvailable === 'function') {
            return this.memory.isBridgeAvailable();
        }
        const M = this.Module;
        return Boolean(M && (typeof M._shim_bridge_call === 'function' || M._shim_bridge_call));
    }

    /**
     * 直接メモリバインディング（_shim_bridge_call または WorkerBridge.callShim）が利用可能かどうかを判定
     * @returns {boolean}
     */
    isAvailable() {
        if (this.bridge && typeof this.bridge.callShim === 'function') return true;
        if (!this.memory) return false;
        return this.hasLiveMemory;
    }

    /**
     * 所持品リンクリスト (gi.invent) を直接走査し、全アイテムの構造化データを取得
     * @returns {Array<Object>} アイテム構造化情報配列
     */
    getInventory() {
        if (!this.isAvailable()) return [];

        if (this.hasLiveMemory) {
            const headPtr = this.memory.bridgeCall(SHIM_CMD.GET_INVENT_PTR, 0, 0, 0, 0);
            if (!headPtr || headPtr <= 0) return [];

            const items = [];
            const visited = new Set();
            const MAX_ITEMS = 100; // 安全上限（52文字+予備）

            // struct obj デコード用バッファ確保: long[8] = 32 bytes
            const bufSize = 32;
            const bufPtr = this.memory.allocateBuffer(bufSize);
            if (!bufPtr) return [];

            try {
                let currPtr = headPtr;
                while (currPtr > 0 && !visited.has(currPtr) && items.length < MAX_ITEMS) {
                    visited.add(currPtr);

                    const res = this.memory.bridgeCall(SHIM_CMD.DUMP_OBJECT_INFO, currPtr, 0, bufPtr, bufSize);
                    if (res === 0) {
                        const rawValues = this.memory.readInt32Array(bufPtr, 8);
                        const otyp = rawValues[0];
                        const owt = rawValues[1];
                        const quan = rawValues[2];
                        // spe は schar (符号付き8bit整数)
                        const spe = (rawValues[3] << 24) >> 24;
                        const oclass = rawValues[4];
                        const invletCode = rawValues[5];
                        const invlet = (invletCode > 0 && invletCode < 128) ? String.fromCharCode(invletCode) : '';
                        const flagsRaw = rawValues[6];
                        const weight = rawValues[7];

                        // flags のビットフィールド展開
                        const flags = {
                            blessed: Boolean(flagsRaw & 0x01),
                            cursed: Boolean(flagsRaw & 0x02),
                            bknown: Boolean(flagsRaw & 0x04),
                            dknown: Boolean(flagsRaw & 0x08),
                            rknown: Boolean(flagsRaw & 0x10),
                            oeroded: (flagsRaw >> 5) & 0x03,
                            oeroded2: (flagsRaw >> 7) & 0x03,
                        };

                        // struct obj 内の追加情報 (+0x08: cobj, +0x0C: o_id)
                        const cobjPtr = this.memory.getValue(currPtr + 8, 'i32');
                        const o_id = this.memory.getValue(currPtr + 12, 'i32');

                        items.push({
                            ptr: currPtr,
                            rawObjPtr: currPtr,
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
                            o_id
                        });
                    }

                    // 次のアイテムへのポインタ (offset +0x00: struct obj *nobj)
                    currPtr = this.memory.getValue(currPtr, 'i32');
                }
            } finally {
                this.memory.freeBuffer(bufPtr);
            }

            return items;
        }

        return this._cachedInventory || [];
    }

    /**
     * 14 種類の装備スロットポインタ配列と対応マップを取得
     * @returns {{ rawPtrs: Object, slotByPtr: Map<number, string>, ptrBySlot: Map<string, number> }}
     */
    getEquipmentPtrs() {
        const defaultResult = {
            rawPtrs: {},
            slotByPtr: new Map(),
            ptrBySlot: new Map()
        };

        if (!this.isAvailable()) return defaultResult;

        if (this.hasLiveMemory) {
            // long[14] = 56 bytes
            const bufSize = 56;
            const bufPtr = this.memory.allocateBuffer(bufSize);
            if (!bufPtr) return defaultResult;

            try {
                const res = this.memory.bridgeCall(SHIM_CMD.GET_EQUIPMENT_PTRS, 0, 0, bufPtr, bufSize);
                if (res !== 0) return defaultResult;

                const ptrArray = this.memory.readInt32Array(bufPtr, 14);
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
                this.memory.freeBuffer(bufPtr);
            }
        }

        return this._cachedEquipmentPtrs || defaultResult;
    }

    /**
     * NetHack コアの inv_weight() による真の総所持重量を取得
     * (手持ち品・金貨・Bag of Holding の補正を含む完全な公式計算値)
     * @returns {number} 総所持重量 (利用不可時: -1)
     */
    getInventoryWeight() {
        const M = this.Module;
        if (M && typeof M._inv_weight === 'function') {
            return M._inv_weight();
        }
        return -1;
    }

    /**
     * 単一アイテムの真の重量を取得 (Bag of Holding 等の補正含む)
     * @param {number} objPtr 
     * @returns {number} アイテム重量 (利用不可時: -1)
     */
    getObjectWeight(objPtr) {
        if (!objPtr || objPtr <= 0) return 0;
        const M = this.Module;
        if (M && typeof M._weight === 'function') {
            return M._weight(objPtr);
        }
        return -1;
    }

    /**
     * コンテナの内包物総重量を取得
     * @param {number} objPtr 
     * @returns {number} コンテナ内重量 (利用不可時: -1)
     */
    getContainerWeight(objPtr) {
        if (!objPtr || objPtr <= 0) return 0;
        const M = this.Module;
        if (M && typeof M._container_weight === 'function') {
            return M._container_weight(objPtr);
        }
        return -1;
    }

    /**
     * Web Worker 隔離環境用：ターン確定時に足元セル情報やインベントリを非同期で一括同期 (Stage 8.2-A)
     * @param {Object} [options={}]
     * @param {number} [options.playerX]
     * @param {number} [options.playerY]
     * @returns {Promise<boolean>}
     */
    async syncFromWorkerBridge(options = {}) {
        if (!this.bridge || typeof this.bridge.callShim !== 'function') return false;

        const x = options.playerX ?? this._cachedCellX;
        const y = options.playerY ?? this._cachedCellY;

        try {
            if (x >= 0 && y >= 0) {
                // 1. 足元セル情報
                const cellRes = await this.bridge.callShim(SHIM_CMD.GET_CELL_INFO, x, y);
                if (cellRes && typeof cellRes.result === 'number' && cellRes.result >= 0) {
                    const res = cellRes.result;
                    const typ = res & 0xFF;
                    const flags = (res >> 8) & 0xFF;
                    const lit = Boolean((res >> 16) & 0x01);
                    const roomno = (res >> 17) & 0x7F;

                    const isDoor = (typ === LEVL_TYP.DOOR || typ === LEVL_TYP.SDOOR);
                    const door = isDoor ? {
                        isClosed: Boolean(flags & DOOR_STATE.D_CLOSED),
                        isLocked: Boolean(flags & DOOR_STATE.D_LOCKED),
                        isOpen: Boolean(flags & DOOR_STATE.D_ISOPEN),
                        isBroken: Boolean(flags & DOOR_STATE.D_BROKEN),
                        isTrapped: Boolean(flags & DOOR_STATE.D_TRAPPED),
                        isSecret: (typ === LEVL_TYP.SDOOR)
                    } : null;

                    this._cachedCellX = x;
                    this._cachedCellY = y;
                    this._cachedCellInfo = { x, y, typ, flags, lit, roomno, door };

                    // 2. 部屋種別
                    if (roomno > 0) {
                        const roomRes = await this.bridge.callShim(SHIM_CMD.GET_ROOM_TYPE, roomno);
                        if (roomRes && typeof roomRes.result === 'number') {
                            const rtype = roomRes.result;
                            const info = ROOM_NAMES[rtype] || { name: 'Room', nameJa: '部屋' };
                            this._cachedRoom = {
                                roomno,
                                rtype,
                                isShop: (rtype >= ROOM_TYPE.SHOPBASE),
                                name: info.name,
                                nameJa: info.nameJa
                            };
                        }
                    } else {
                        this._cachedRoom = null;
                    }

                    // 3. 罠
                    const trapRes = await this.bridge.callShim(SHIM_CMD.GET_TRAP_AT, x, y);
                    if (trapRes && typeof trapRes.result === 'number' && trapRes.result > 0) {
                        const tRes = trapRes.result;
                        const ttyp = tRes & 0xFF;
                        const tseen = Boolean((tRes >> 8) & 0x01);
                        const once = Boolean((tRes >> 9) & 0x01);
                        const info = TRAP_NAMES[ttyp] || { name: 'trap', nameJa: '罠' };
                        this._cachedTrap = {
                            x,
                            y,
                            ttyp,
                            tseen,
                            once,
                            name: info.name,
                            nameJa: info.nameJa
                        };
                    } else {
                        this._cachedTrap = null;
                    }

                    // 4. 刻み文字
                    const engrRes = await this.bridge.callShim(SHIM_CMD.GET_ENGRAVING_AT, x, y, 256, 'string');
                    if (engrRes && typeof engrRes.result === 'number' && engrRes.result > 0) {
                        const engrType = engrRes.result;
                        const text = engrRes.buffer || '';
                        const info = ENGRAVING_NAMES[engrType] || { name: 'engraving', nameJa: '刻み文字' };
                        this._cachedEngraving = {
                            x,
                            y,
                            text,
                            engrType,
                            typeName: info.name,
                            typeNameJa: info.nameJa,
                            isElbereth: text.includes('Elbereth')
                        };
                    } else {
                        this._cachedEngraving = null;
                    }
                }
            }

            // 5. 所持品リンクリスト ＆ 装備スロットの一括同期 (Stage 8.2)
            if (options.syncInventory || options.syncInventory !== false) {
                if (typeof this.bridge.getInventorySnapshot === 'function') {
                    const invSnapshot = await this.bridge.getInventorySnapshot();
                    if (invSnapshot) {
                        this._cachedInventory = invSnapshot.items || [];
                        const ptrArray = (invSnapshot.equipment && invSnapshot.equipment.ptrArray) || [];
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

                        this._cachedEquipmentPtrs = {
                            rawPtrs,
                            slotByPtr,
                            ptrBySlot
                        };
                    }
                }
            }

            return true;
        } catch (err) {
            console.warn('[WasmDirectBindingService] syncFromWorkerBridge error:', err);
            return false;
        }
    }

    /**
     * 指定座標の真のセル情報（typ, flags, lit, roomno）を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getCellInfo(x, y) {
        if (!this.isAvailable()) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (this.hasLiveMemory) {
            const res = this.memory.bridgeCall(SHIM_CMD.GET_CELL_INFO, x, y, 0, 0);
            if (res < 0) return null;

            const typ = res & 0xFF;
            const flags = (res >> 8) & 0xFF;
            const lit = Boolean((res >> 16) & 0x01);
            const roomno = (res >> 17) & 0xFF;

            const isDoor = (typ === LEVL_TYP.DOOR || typ === LEVL_TYP.SDOOR);
            const door = isDoor ? {
                isClosed: Boolean(flags & DOOR_STATE.D_CLOSED),
                isLocked: Boolean(flags & DOOR_STATE.D_LOCKED),
                isOpen: Boolean(flags & DOOR_STATE.D_ISOPEN),
                isBroken: Boolean(flags & DOOR_STATE.D_BROKEN),
                isTrapped: Boolean(flags & DOOR_STATE.D_TRAPPED),
                isSecret: (typ === LEVL_TYP.SDOOR)
            } : null;

            return {
                x,
                y,
                typ,
                flags,
                lit,
                roomno,
                door
            };
        }

        // Worker 隔離環境の場合：キャッシュされた足元情報を返却
        if (this._cachedCellInfo && this._cachedCellX === x && this._cachedCellY === y) {
            return this._cachedCellInfo;
        }

        return null;
    }

    /**
     * 現在のフロア全体 (80x21) の真の床・地形 (typ) を一括ダンプ
     * @returns {Uint8Array|null}
     */
    dumpLevelTerrain() {
        if (!this.hasLiveMemory) return null;

        const COLNO = 80;
        const ROWNO = 21;
        const size = COLNO * ROWNO;

        const bufPtr = this.memory.allocateBuffer(size);
        if (!bufPtr) return null;

        try {
            const res = this.memory.bridgeCall(SHIM_CMD.DUMP_LEVEL_TERRAIN, 0, 0, bufPtr, size);
            if (res !== 0) return null;

            return this.memory.readUint8Array(bufPtr, size);
        } finally {
            this.memory.freeBuffer(bufPtr);
        }
    }

    /**
     * 指定座標の罠情報を取得 (存在しない場合は null)
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getTrapAt(x, y) {
        if (!this.isAvailable()) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (this.hasLiveMemory) {
            const res = this.memory.bridgeCall(SHIM_CMD.GET_TRAP_AT, x, y, 0, 0);
            if (!res || res <= 0) return null;

            const ttyp = res & 0xFF;
            const tseen = Boolean((res >> 8) & 0x01);
            const once = Boolean((res >> 9) & 0x01);
            const info = TRAP_NAMES[ttyp] || { name: 'trap', nameJa: '罠' };

            return {
                x,
                y,
                ttyp,
                tseen,
                once,
                name: info.name,
                nameJa: info.nameJa
            };
        }

        if (this._cachedTrap && this._cachedCellX === x && this._cachedCellY === y) {
            return this._cachedTrap;
        }

        return null;
    }

    /**
     * 指定座標の刻み文字（彫り・Elbereth等）を取得 (存在しない場合は null)
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getEngravingAt(x, y) {
        if (!this.isAvailable()) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (this.hasLiveMemory) {
            const bufSize = 256;
            const bufPtr = this.memory.allocateBuffer(bufSize);
            if (!bufPtr) return null;

            try {
                const engrType = this.memory.bridgeCall(SHIM_CMD.GET_ENGRAVING_AT, x, y, bufPtr, bufSize);
                if (engrType <= 0) return null;

                const text = this.memory.readString(bufPtr, bufSize) || '';
                const info = ENGRAVING_NAMES[engrType] || { name: 'engraving', nameJa: '刻み文字' };
                const isElbereth = text.includes('Elbereth');

                return {
                    x,
                    y,
                    text,
                    engrType,
                    typeName: info.name,
                    typeNameJa: info.nameJa,
                    isElbereth
                };
            } finally {
                this.memory.freeBuffer(bufPtr);
            }
        }

        if (this._cachedEngraving && this._cachedCellX === x && this._cachedCellY === y) {
            return this._cachedEngraving;
        }

        return null;
    }

    /**
     * 部屋番号 (roomno) から部屋種別（通常・店舗・寺院・動物園等）を取得
     * @param {number} roomno
     * @returns {Object|null}
     */
    getRoomType(roomno) {
        if (!this.isAvailable()) return null;
        if (typeof roomno !== 'number' || roomno <= 0) {
            return {
                roomno: 0,
                rtype: ROOM_TYPE.OROOM,
                isShop: false,
                name: ROOM_NAMES[0].name,
                nameJa: ROOM_NAMES[0].nameJa
            };
        }

        if (this.hasLiveMemory) {
            const rtype = this.memory.bridgeCall(SHIM_CMD.GET_ROOM_TYPE, roomno, 0, 0, 0);
            const info = ROOM_NAMES[rtype] || { name: 'Room', nameJa: '部屋' };
            const isShop = (rtype >= ROOM_TYPE.SHOPBASE);

            return {
                roomno,
                rtype,
                isShop,
                name: info.name,
                nameJa: info.nameJa
            };
        }

        if (this._cachedRoom && this._cachedRoom.roomno === roomno) {
            return this._cachedRoom;
        }

        return null;
    }

    /**
     * 指定座標のモンスターポインタを取得 (存在しない場合は 0)
     * @param {number} x
     * @param {number} y
     * @returns {number} struct monst*
     */
    getMonsterAt(x, y) {
        if (!this.hasLiveMemory) return 0;
        if (typeof x !== 'number' || typeof y !== 'number') return 0;

        const ptr = this.memory.bridgeCall(SHIM_CMD.GET_MONSTER_AT, x, y, 0, 0);
        return (ptr && ptr > 0) ? ptr : 0;
    }

    /**
     * 指定座標のモンスター情報 (平和/ペット/HP/最大HP) を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getMonsterInfo(x, y) {
        if (!this.hasLiveMemory) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        const res = this.memory.bridgeCall(SHIM_CMD.GET_MONSTER_INFO, x, y, 0, 0);
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

    /**
     * 指定座標のモンスター動的状態 (睡眠/逃走/麻痺/混乱/店主/僧侶等) を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getMonsterState(x, y) {
        if (!this.hasLiveMemory) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        const monPtr = this.getMonsterAt(x, y);
        if (!monPtr) return null;

        const res = this.memory.bridgeCall(SHIM_CMD.GET_MONSTER_STATE, x, y, 0, 0);
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

    /**
     * 指定座標のモンスター完全詳細 (HP・属性・状態異常・フラグ) を取得
     * @param {number} x
     * @param {number} y
     * @returns {Object|null}
     */
    getFullMonsterAt(x, y) {
        if (!this.hasLiveMemory) return null;
        const monPtr = this.getMonsterAt(x, y);
        if (!monPtr) return null;

        const info = this.getMonsterInfo(x, y);
        const state = this.getMonsterState(x, y) || {};

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
}

export default WasmDirectBindingService;
