/**
 * SpatialWasmAdapter.js
 *
 * 空間・フロア全域地形（typ: 80x21）、セル構造体（flags, lit, door, altar）、
 * 部屋種別（roomno, rtype）、罠（trap）、および刻み文字（engraving）の
 * C構造体デコードとキャッシュ管理を担当。
 */

import {
    SHIM_CMD,
    LEVL_TYP,
    DOOR_STATE,
    parseAltarFlags,
    ROOM_TYPE,
    ROOM_NAMES,
    TRAP_NAMES,
    ENGRAVING_NAMES
} from './BindingConstants.js';

export class SpatialWasmAdapter {
    constructor() {
        this._cachedCellInfo = null;
        this._cachedCellX = -1;
        this._cachedCellY = -1;
        this._cachedRoom = null;
        this._cachedTrap = null;
        this._cachedEngraving = null;
        this._cachedLevelTerrain = null;
        this._cachedLevelGlyphs = null;
    }

    get cachedCellInfo() { return this._cachedCellInfo; }
    set cachedCellInfo(v) { this._cachedCellInfo = v; }

    get cachedCellX() { return this._cachedCellX; }
    set cachedCellX(v) { this._cachedCellX = v; }

    get cachedCellY() { return this._cachedCellY; }
    set cachedCellY(v) { this._cachedCellY = v; }

    get cachedRoom() { return this._cachedRoom; }
    set cachedRoom(v) { this._cachedRoom = v; }

    get cachedTrap() { return this._cachedTrap; }
    set cachedTrap(v) { this._cachedTrap = v; }

    get cachedEngraving() { return this._cachedEngraving; }
    set cachedEngraving(v) { this._cachedEngraving = v; }

    get cachedLevelTerrain() { return this._cachedLevelTerrain; }
    set cachedLevelTerrain(v) { this.setCachedLevelTerrain(v); }

    get cachedLevelGlyphs() { return this._cachedLevelGlyphs; }
    set cachedLevelGlyphs(v) { this.setCachedLevelGlyphs(v); }

    /**
     * 指定座標のセル詳細情報 (typ, flags, lit, roomno, door, altar) を取得
     * @param {number} x
     * @param {number} y
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getCellInfo(x, y, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (hasLiveMemory && memory) {
            const res = memory.bridgeCall(SHIM_CMD.GET_CELL_INFO, x, y, 0, 0);
            if (res < 0) return null;

            const typ = res & 0xFF;
            const flags = (res >> 8) & 0xFF;
            const lit = Boolean((res >> 16) & 0x01);
            const roomno = (res >> 17) & 0xFF;

            const isDoor = (typ === LEVL_TYP.DOOR || typ === LEVL_TYP.SDOOR);
            const isAltar = (typ === LEVL_TYP.ALTAR);
            const door = isDoor ? {
                isClosed: Boolean(flags & DOOR_STATE.D_CLOSED),
                isLocked: Boolean(flags & DOOR_STATE.D_LOCKED),
                isOpen: Boolean(flags & DOOR_STATE.D_ISOPEN),
                isBroken: Boolean(flags & DOOR_STATE.D_BROKEN),
                isTrapped: Boolean(flags & DOOR_STATE.D_TRAPPED),
                isSecret: (typ === LEVL_TYP.SDOOR),
                isNoDoor: (flags & 0x0F) === 0
            } : null;
            const altar = isAltar ? parseAltarFlags(flags) : null;

            return {
                x,
                y,
                typ,
                flags,
                lit,
                roomno,
                door,
                altar
            };
        }

        // Worker 隔離環境の場合：キャッシュされた足元情報を最優先返却
        if (this._cachedCellInfo && this._cachedCellX === x && this._cachedCellY === y) {
            return this._cachedCellInfo;
        }

        // 全フロア地形キャッシュ (_cachedLevelTerrain: 80x21) が存在する場合は該当セルの typ を返却
        if (this._cachedLevelTerrain && x >= 0 && x < 80 && y >= 0 && y < 21) {
            const idx = y * 80 + x;
            if (idx >= 0 && idx < this._cachedLevelTerrain.length) {
                const typ = this._cachedLevelTerrain[idx];
                const isDoor = (typ === LEVL_TYP.DOOR || typ === LEVL_TYP.SDOOR);
                const isAltar = (typ === LEVL_TYP.ALTAR);
                return {
                    x,
                    y,
                    typ,
                    flags: 0,
                    lit: false,
                    roomno: 0,
                    door: isDoor ? {
                        isClosed: false,
                        isLocked: false,
                        isOpen: false,
                        isBroken: false,
                        isTrapped: false,
                        isSecret: (typ === LEVL_TYP.SDOOR),
                        isNoDoor: true
                    } : null,
                    altar: isAltar ? parseAltarFlags(0) : null
                };
            }
        }

        return null;
    }

    /**
     * 現在のフロア全体 (80x21) の真の床・地形 (typ) を一括ダンプ
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Uint8Array|null}
     */
    dumpLevelTerrain(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory && memory) {
            const COLNO = 80;
            const ROWNO = 21;
            const size = COLNO * ROWNO;

            const bufPtr = memory.allocateBuffer(size);
            if (!bufPtr) return null;

            try {
                const res = memory.bridgeCall(SHIM_CMD.DUMP_LEVEL_TERRAIN, 0, 0, bufPtr, size);
                if (res !== 0) return null;

                const terrain = memory.readUint8Array(bufPtr, size);
                this._cachedLevelTerrain = terrain;
                return terrain;
            } finally {
                memory.freeBuffer(bufPtr);
            }
        }

        return this._cachedLevelTerrain || null;
    }

    /**
     * 現在のフロア全体 (80x21) の真の地形を一括非同期取得 (Worker 調停対応)
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Promise<Uint8Array|null>}
     */
    async fetchLevelTerrain(bridge, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory) {
            return this.dumpLevelTerrain(memory, isAvailable, hasLiveMemory);
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const COLNO = 80;
                const ROWNO = 21;
                const size = COLNO * ROWNO;
                const res = await bridge.callShim(SHIM_CMD.DUMP_LEVEL_TERRAIN, 0, 0, size, 'uint8');
                if (res && res.result === 0 && Array.isArray(res.buffer)) {
                    this._cachedLevelTerrain = new Uint8Array(res.buffer);
                    return this._cachedLevelTerrain;
                }
            } catch (err) {
                console.warn('[SpatialWasmAdapter] fetchLevelTerrain error:', err);
                return null;
            }
        }

        return this._cachedLevelTerrain || null;
    }

    /**
     * テスト用 / Worker 受信用 地形キャッシュ設定
     * @param {Uint8Array|Array<number>|null} terrain
     */
    setCachedLevelTerrain(terrain) {
        if (!terrain) {
            this._cachedLevelTerrain = null;
        } else if (terrain instanceof Uint8Array) {
            this._cachedLevelTerrain = terrain;
        } else if (Array.isArray(terrain)) {
            this._cachedLevelTerrain = new Uint8Array(terrain);
        }
    }

    /**
     * 現在のフロア全体 (80x21) の完成形グリフ (levl.glyph) を一括ダンプ
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Int32Array|null}
     */
    dumpLevelGlyphs(memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory && memory) {
            const COLNO = 80;
            const ROWNO = 21;
            const count = COLNO * ROWNO;
            const size = count * 4; // sizeof(int) = 4

            const bufPtr = memory.allocateBuffer(size);
            if (!bufPtr) return null;

            try {
                const res = memory.bridgeCall(SHIM_CMD.DUMP_LEVEL_GLYPHS, 0, 0, bufPtr, size);
                if (res !== 0) return null;

                const rawArr = memory.readInt32Array(bufPtr, count);
                this._cachedLevelGlyphs = new Int32Array(rawArr);
                return this._cachedLevelGlyphs;
            } finally {
                memory.freeBuffer(bufPtr);
            }
        }

        return this._cachedLevelGlyphs || null;
    }

    /**
     * 指定セルの純粋な真の地形グリフ (back_to_glyph) をリアルタイム取得
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {number} x
     * @param {number} y
     * @returns {number|null}
     */
    getCellGlyph(memory, isAvailable, hasLiveMemory, x, y) {
        if (!isAvailable || !hasLiveMemory || !memory) {
            if (this._cachedLevelGlyphs && x >= 0 && x < 80 && y >= 0 && y < 21) {
                const g = this._cachedLevelGlyphs[y * 80 + x];
                return (typeof g === 'number' && g > 0) ? g : null;
            }
            return null;
        }

        const res = memory.bridgeCall(SHIM_CMD.GET_CELL_GLYPH, x, y, 0, 0);
        if (typeof res === 'number' && res >= 0) {
            // キャッシュも同期更新
            if (this._cachedLevelGlyphs && x >= 0 && x < 80 && y >= 0 && y < 21) {
                this._cachedLevelGlyphs[y * 80 + x] = res;
            }
            return res;
        }
        return null;
    }

    /**
     * 現在のフロア全体 (80x21) の完成形グリフを一括非同期取得 (Worker 調停対応)
     * @param {Object} bridge
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Promise<Int32Array|null>}
     */
    async fetchLevelGlyphs(bridge, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;

        if (hasLiveMemory) {
            return this.dumpLevelGlyphs(memory, isAvailable, hasLiveMemory);
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const COLNO = 80;
                const ROWNO = 21;
                const count = COLNO * ROWNO;
                const size = count * 4;
                const res = await bridge.callShim(SHIM_CMD.DUMP_LEVEL_GLYPHS, 0, 0, size, 'int32');
                if (res && res.result === 0 && Array.isArray(res.buffer)) {
                    this._cachedLevelGlyphs = new Int32Array(res.buffer);
                    return this._cachedLevelGlyphs;
                }
            } catch (err) {
                console.warn('[SpatialWasmAdapter] fetchLevelGlyphs error:', err);
                return null;
            }
        }

        return this._cachedLevelGlyphs || null;
    }

    /**
     * テスト用 / Worker 受信用 グリフキャッシュ設定
     * @param {Int32Array|Array<number>|null} glyphs
     */
    setCachedLevelGlyphs(glyphs) {
        if (!glyphs) {
            this._cachedLevelGlyphs = null;
        } else if (glyphs instanceof Int32Array) {
            this._cachedLevelGlyphs = glyphs;
        } else if (Array.isArray(glyphs)) {
            this._cachedLevelGlyphs = new Int32Array(glyphs);
        }
    }

    /**
     * 指定座標の罠情報を取得 (存在しない場合は null)
     * @param {number} x
     * @param {number} y
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getTrapAt(x, y, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (hasLiveMemory && memory) {
            const res = memory.bridgeCall(SHIM_CMD.GET_TRAP_AT, x, y, 0, 0);
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
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getEngravingAt(x, y, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (typeof x !== 'number' || typeof y !== 'number') return null;

        if (hasLiveMemory && memory) {
            const bufSize = 256;
            const bufPtr = memory.allocateBuffer(bufSize);
            if (!bufPtr) return null;

            try {
                const engrType = memory.bridgeCall(SHIM_CMD.GET_ENGRAVING_AT, x, y, bufPtr, bufSize);
                if (engrType <= 0) return null;

                const text = memory.readString(bufPtr, bufSize) || '';
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
                memory.freeBuffer(bufPtr);
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
     * @param {Object} memory
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @returns {Object|null}
     */
    getRoomType(roomno, memory, isAvailable, hasLiveMemory) {
        if (!isAvailable) return null;
        if (typeof roomno !== 'number' || roomno <= 0) {
            return {
                roomno: 0,
                rtype: ROOM_TYPE.OROOM,
                isShop: false,
                name: ROOM_NAMES[0].name,
                nameJa: ROOM_NAMES[0].nameJa
            };
        }

        if (hasLiveMemory && memory) {
            const rtype = memory.bridgeCall(SHIM_CMD.GET_ROOM_TYPE, roomno, 0, 0, 0);
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
     * フロア移動時の空間キャッシュクリア
     */
    clearFloorCaches() {
        this._cachedLevelTerrain = null;
        this._cachedLevelGlyphs = null;
        this._cachedCellInfo = null;
        this._cachedCellX = -1;
        this._cachedCellY = -1;
        this._cachedRoom = null;
        this._cachedTrap = null;
        this._cachedEngraving = null;
    }
}
