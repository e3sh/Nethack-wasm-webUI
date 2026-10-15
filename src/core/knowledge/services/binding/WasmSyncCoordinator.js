/**
 * WasmSyncCoordinator.js
 *
 * Web Worker 隔離環境との非同期調停、Sync Barrier（世代管理、Stale Cancel、重複抑制）、
 * およびターン確定時の一括同期・オンデマンド同期オーケストレーションを担当。
 */

import {
    SHIM_CMD,
    LEVL_TYP,
    DOOR_STATE,
    ROOM_TYPE,
    ROOM_NAMES,
    TRAP_NAMES,
    ENGRAVING_NAMES,
    EQUIPMENT_FIELD_KEYS,
    EQUIPMENT_SLOT_NAMES,
    parseSkillsBuffer,
    parseSpellBookBuffer,
    parsePlayerProfileBuffer,
    parsePlayerSummaryBuffer
} from './BindingConstants.js';

export class WasmSyncCoordinator {
    constructor() {
        this._syncGeneration = 0;
        this._isSyncing = false;
        this._currentSyncPromise = null;
        this._lastCompletedSyncGeneration = -1;
    }

    /**
     * 同期状態をリセットし、進行中の非同期同期をキャンセル
     */
    reset() {
        this._syncGeneration++;
        this._isSyncing = false;
        this._currentSyncPromise = null;
        this._lastCompletedSyncGeneration = -1;
    }

    get syncGeneration() {
        return this._syncGeneration;
    }

    set syncGeneration(v) {
        this._syncGeneration = v;
    }

    get isSyncing() {
        return this._isSyncing;
    }

    set isSyncing(v) {
        this._isSyncing = Boolean(v);
    }

    get currentSyncPromise() {
        return this._currentSyncPromise;
    }

    set currentSyncPromise(v) {
        this._currentSyncPromise = v;
    }

    get lastCompletedSyncGeneration() {
        return this._lastCompletedSyncGeneration;
    }

    set lastCompletedSyncGeneration(v) {
        this._lastCompletedSyncGeneration = v;
    }

    /**
     * Phase 1 (ACTION): ユーザー操作送出時に呼び出し、Sync Barrier 世代を進めて
     * 実行中の古い非同期 Shim 同期レスポンスを破棄（Stale Cancel）させる
     * @param {Object} [inventoryAdapter]
     * @returns {number} 更新後の世代ID
     */
    notifyActionSent(inventoryAdapter = null) {
        this._syncGeneration += 1;
        this._isSyncing = false;
        this._currentSyncPromise = null;
        if (inventoryAdapter) {
            inventoryAdapter.hasFloorObjectsCache = false;
        }
        return this._syncGeneration;
    }

    /**
     * Web Worker 隔離環境用：ターン確定時に足元セル情報やインベントリを非同期で一括同期 (Stage 8.2-A / Stage 8.3-B Sync Barrier)
     * @param {Object} [options={}]
     * @param {Object} bridge - NetHackWasmWorkerBridge
     * @param {string} mode - 'auto' | 'strict' | 'fallback'
     * @param {Object} adapters - { discovery, player, monster, spatial, inventory }
     * @param {Object} [fallbackCoords] - { x: number, y: number }
     * @param {Object} [facade] - WasmDirectBindingService facade instance
     * @returns {Promise<boolean>}
     */
    async syncFromWorkerBridge(options = {}, bridge, mode, adapters, fallbackCoords = {}, facade = null) {
        if (mode === 'fallback') return false;
        if (!bridge || typeof bridge.callShim !== 'function') return false;

        // 同一世代で同期処理が進行中の場合、重複呼び出しによる相互キャンセルを防止して既存Promiseを再利用
        if (this._isSyncing && this._currentSyncPromise) {
            return await this._currentSyncPromise;
        }

        const syncGen = ++this._syncGeneration;
        this._isSyncing = true;
        const isStale = () => {
            if (options.protected) return false;
            return syncGen !== this._syncGeneration;
        };

        const spatial = adapters.spatial;
        const inventory = adapters.inventory;
        const discovery = adapters.discovery;
        const player = adapters.player;

        const x = options.playerX ?? (spatial ? spatial.cachedCellX : fallbackCoords.x);
        const y = options.playerY ?? (spatial ? spatial.cachedCellY : fallbackCoords.y);

        const runSync = async () => {
            try {
                if (x >= 0 && y >= 0) {
                    // 1. 足元セル情報
                    const cellRes = await bridge.callShim(SHIM_CMD.GET_CELL_INFO, x, y);
                    if (isStale()) return false;

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
                            isSecret: (typ === LEVL_TYP.SDOOR),
                            isNoDoor: (flags & 0x0F) === 0
                        } : null;

                        let nextRoom = null;
                        // 2. 部屋種別
                        if (roomno > 0) {
                            const roomRes = await bridge.callShim(SHIM_CMD.GET_ROOM_TYPE, roomno);
                            if (isStale()) return false;
                            if (roomRes && typeof roomRes.result === 'number') {
                                const rtype = roomRes.result;
                                const info = ROOM_NAMES[rtype] || { name: 'Room', nameJa: '部屋' };
                                nextRoom = {
                                    roomno,
                                    rtype,
                                    isShop: (rtype >= ROOM_TYPE.SHOPBASE),
                                    name: info.name,
                                    nameJa: info.nameJa
                                };
                            }
                        }

                        // 3. 罠
                        let nextTrap = null;
                        const trapRes = await bridge.callShim(SHIM_CMD.GET_TRAP_AT, x, y);
                        if (isStale()) return false;
                        if (trapRes && typeof trapRes.result === 'number' && trapRes.result > 0) {
                            const tRes = trapRes.result;
                            const ttyp = tRes & 0xFF;
                            const tseen = Boolean((tRes >> 8) & 0x01);
                            const once = Boolean((tRes >> 9) & 0x01);
                            const info = TRAP_NAMES[ttyp] || { name: 'trap', nameJa: '罠' };
                            nextTrap = {
                                x,
                                y,
                                ttyp,
                                tseen,
                                once,
                                name: info.name,
                                nameJa: info.nameJa
                            };
                        }

                        // 4. 刻み文字
                        let nextEngraving = null;
                        const engrRes = await bridge.callShim(SHIM_CMD.GET_ENGRAVING_AT, x, y, 256, 'string');
                        if (isStale()) return false;
                        if (engrRes && typeof engrRes.result === 'number' && engrRes.result > 0) {
                            const engrType = engrRes.result;
                            const text = engrRes.buffer || '';
                            const info = ENGRAVING_NAMES[engrType] || { name: 'engraving', nameJa: '刻み文字' };
                            nextEngraving = {
                                x,
                                y,
                                text,
                                engrType,
                                typeName: info.name,
                                typeNameJa: info.nameJa,
                                isElbereth: text.includes('Elbereth')
                            };
                        }

                        if (spatial) {
                            spatial.cachedCellX = x;
                            spatial.cachedCellY = y;
                            spatial.cachedCellInfo = { x, y, typ, flags, lit, roomno, door };
                            spatial.cachedRoom = nextRoom;
                            spatial.cachedTrap = nextTrap;
                            spatial.cachedEngraving = nextEngraving;
                        }
                    }
                }

                // 5. 装備スロットポインタおよび所持品一括ダンプ同期 (Stage 8.2 / DUMP_ALL_INVENT)
                if (options.syncInventory || options.syncInventory !== false) {
                    const eqRes = await bridge.callShim(SHIM_CMD.GET_EQUIPMENT_PTRS, 0, 0, 56, 'int32');
                    if (isStale()) return false;
                    if (eqRes && Array.isArray(eqRes.buffer) && inventory) {
                        const ptrArray = eqRes.buffer;
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

                        inventory.cachedEquipmentPtrs = {
                            rawPtrs,
                            slotByPtr,
                            ptrBySlot
                        };
                    }

                    // 5-b. 全所持品の一括同期 (SHIM_CMD_DUMP_ALL_INVENT: 最大100個 = 4800 bytes)
                    const invRes = await bridge.callShim(SHIM_CMD.DUMP_ALL_INVENT, 0, 0, 4800, 'int32');
                    if (isStale()) return false;
                    if (invRes && Array.isArray(invRes.buffer) && inventory) {
                        const count = typeof invRes.result === 'number' ? Math.max(0, invRes.result) : 0;
                        const raw = invRes.buffer;
                        const items = [];
                        const ITEM_FIELDS = 12;

                        for (let i = 0; i < count; i++) {
                            const base = i * ITEM_FIELDS;
                            if (base + ITEM_FIELDS <= raw.length) {
                                const raw8 = raw.slice(base, base + 8);
                                const ptr = raw[base + 8] || 0;
                                const o_id = raw[base + 9] || 0;
                                const cobjPtr = raw[base + 10] || 0;
                                const corpsenm = raw[base + 11] ?? -1;
                                const item = (facade && typeof facade.unpackObjectBuffer === 'function')
                                    ? facade.unpackObjectBuffer(raw8, ptr, cobjPtr, o_id, corpsenm)
                                    : inventory.unpackObjectBuffer(raw8, ptr, cobjPtr, o_id, corpsenm);
                                if (item) {
                                    items.push(item);
                                }
                            }
                        }
                        inventory.cachedInventory = items;
                        inventory.cachedInventoryWeight = items.reduce((sum, it) => sum + (it.weight || 0), 0);
                    }

                    // 5-c. 全アイテム識別状態および外見インデックスの一括同期
                    if (options.syncDiscoveries !== false && discovery) {
                        try {
                            const discRes = await bridge.callShim(SHIM_CMD.DUMP_DISCOVERIES, 0, 0, 600, 'uint8');
                            if (isStale()) return false;
                            if (discRes && Array.isArray(discRes.buffer)) {
                                discovery.cachedDiscoveries = new Uint8Array(discRes.buffer);
                            }
                        } catch (e) {
                            // ignore shim call errors in fallback/unsupported scenarios
                        }
                        try {
                            const descrRes = await bridge.callShim(SHIM_CMD.DUMP_DESCR_INDEXES, 0, 0, 2400, 'int32');
                            if (isStale()) return false;
                            if (descrRes && typeof descrRes.result === 'number' && descrRes.result > 0 && Array.isArray(descrRes.buffer)) {
                                const count = Math.min(descrRes.buffer.length, descrRes.result + 1);
                                discovery.cachedDescrIndexes = new Int32Array(descrRes.buffer.slice(0, count));
                            }
                        } catch (e) {
                            // ignore shim call errors in fallback/unsupported scenarios
                        }
                    }
                }

                // 6. 足元 (x, y) の床アイテム一覧同期 (Stage 8.2-C / Stage 8.3-B)
                if (options.syncFloorObjects === true && x >= 0 && y >= 0 && inventory) {
                    try {
                        const floorItems = (facade && typeof facade.fetchObjectsAt === 'function')
                            ? await facade.fetchObjectsAt(x, y)
                            : await inventory.fetchObjectsAt(x, y, bridge, null, true, false);
                        if (isStale()) return false;
                        inventory.cachedPlayerFloorObjects = floorItems || [];
                        inventory.cachedFloorObjectsX = x;
                        inventory.cachedFloorObjectsY = y;
                        inventory.hasFloorObjectsCache = true;
                    } catch (e) {
                        inventory.cachedPlayerFloorObjects = [];
                        inventory.cachedFloorObjectsX = x;
                        inventory.cachedFloorObjectsY = y;
                        inventory.hasFloorObjectsCache = true;
                    }
                }

                // 7. フロア全域の地形一括同期 (Stage 8.3-A / 8.3-B)
                if (options.syncLevelTerrain === true && spatial) {
                    try {
                        if (facade && typeof facade.fetchLevelTerrain === 'function') {
                            await facade.fetchLevelTerrain();
                        } else {
                            await spatial.fetchLevelTerrain(bridge, null, true, false);
                        }
                        if (isStale()) return false;
                    } catch (e) {
                        // silent fallback
                    }
                }

                // 8. 周辺モンスターの真値同期 (Stage 8.3-A)
                if (Array.isArray(options.surroundingMonsters) && options.surroundingMonsters.length > 0) {
                    try {
                        if (facade && typeof facade.syncSurroundingMonsters === 'function') {
                            await facade.syncSurroundingMonsters(options.surroundingMonsters);
                        } else {
                            await this.syncSurroundingMonsters(options.surroundingMonsters, (mx, my) => {
                                return adapters.monster ? adapters.monster.fetchFullMonsterAt(mx, my, bridge, null, true, false) : null;
                            });
                        }
                        if (isStale()) return false;
                    } catch (e) {
                        // silent fallback
                    }
                }

                // 9. プレイヤー属性・耐性 (SHIM_CMD_GET_PLAYER_PROPS: 69 * 4 = 276 bytes)
                if (options.syncPlayerProps !== false && player) {
                    try {
                        const propsRes = await bridge.callShim(SHIM_CMD.GET_PLAYER_PROPS, 0, 0, 276, 'int32');
                        if (isStale()) return false;
                        if (propsRes && Array.isArray(propsRes.buffer)) {
                            player.cachedPlayerProps = propsRes.buffer;
                        }
                    } catch (e) {
                        // silent fallback
                    }
                }

                // 10. プレイヤー武器・魔法スキル熟練度 (SHIM_CMD_DUMP_SKILLS: 38 * 2 * 4 = 304 bytes)
                if (options.syncSkills !== false && player) {
                    try {
                        const skillsRes = await bridge.callShim(SHIM_CMD.DUMP_SKILLS, 0, 0, 304, 'int32');
                        if (isStale()) return false;
                        if (skillsRes && Array.isArray(skillsRes.buffer)) {
                            const slots = typeof skillsRes.result === 'number' ? skillsRes.result : 0;
                            player.cachedSkills = parseSkillsBuffer(skillsRes.buffer, slots);
                            player.cachedWeaponSlots = slots;
                        }
                    } catch (e) {
                        // silent fallback
                    }
                }

                // 11. プレイヤー修得魔法 (SHIM_CMD_DUMP_SPELL_BOOK: 1024 bytes)
                if (options.syncSpells !== false && player) {
                    try {
                        const spellRes = await bridge.callShim(SHIM_CMD.DUMP_SPELL_BOOK, 0, 0, 1024, 'int32');
                        if (isStale()) return false;
                        if (spellRes && Array.isArray(spellRes.buffer)) {
                            const count = typeof spellRes.result === 'number' ? spellRes.result : null;
                            player.cachedSpells = parseSpellBookBuffer(spellRes.buffer, count);
                        }
                    } catch (e) {
                        // silent fallback
                    }
                }

                // 12. プレイヤー真値プロファイル (SHIM_CMD_GET_PLAYER_PROFILE: 256 bytes) (Stage 8.5)
                if (options.syncProfile !== false && player && (!player.cachedPlayerProfile || options.forceProfileSync)) {
                    try {
                        const profileRes = await bridge.callShim(SHIM_CMD.GET_PLAYER_PROFILE, 0, 0, 256, 'int32');
                        if (isStale()) return false;
                        if (profileRes && profileRes.result >= 0 && Array.isArray(profileRes.buffer)) {
                            player.cachedPlayerProfile = parsePlayerProfileBuffer(profileRes.buffer);
                        }
                    } catch (e) {
                        // silent fallback
                    }
                }

                // 13. プレイヤーサマリー (SHIM_CMD_GET_PLAYER_SUMMARY: 32 bytes) (Stage 8.4)
                if (options.syncSummary !== false && player) {
                    try {
                        const summaryRes = await bridge.callShim(SHIM_CMD.GET_PLAYER_SUMMARY, 0, 0, 32, 'int32');
                        if (isStale()) return false;
                        if (summaryRes && summaryRes.result === 0 && Array.isArray(summaryRes.buffer)) {
                            player.cachedPlayerSummary = parsePlayerSummaryBuffer(summaryRes.buffer);
                        }
                    } catch (e) {
                        // silent fallback
                    }
                }

                this._lastCompletedSyncGeneration = syncGen;
                return true;
            } catch (err) {
                console.warn('[WasmSyncCoordinator] syncFromWorkerBridge error:', err);
                return false;
            } finally {
                if (syncGen === this._syncGeneration) {
                    this._isSyncing = false;
                    this._currentSyncPromise = null;
                }
            }
        };

        this._currentSyncPromise = runSync();
        return await this._currentSyncPromise;
    }

    /**
     * 属性・耐性詳細 (GET_PLAYER_PROPS) のオンデマンド同期 (開くときトリガー)
     * @param {Object} bridge
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {Object} playerAdapter
     * @returns {Promise<boolean>}
     */
    async syncAttributesOnDemand(bridge, isAvailable, hasLiveMemory, playerAdapter) {
        if (!isAvailable) return false;
        if (hasLiveMemory) return true;
        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const propsRes = await bridge.callShim(SHIM_CMD.GET_PLAYER_PROPS, 0, 0, 276, 'int32');
                if (propsRes && Array.isArray(propsRes.buffer) && playerAdapter) {
                    playerAdapter.cachedPlayerProps = propsRes.buffer;
                    return true;
                }
            } catch (e) {
                console.warn('[WasmSyncCoordinator] syncAttributesOnDemand error:', e);
            }
        }
        return false;
    }

    /**
     * スキル熟練度 (DUMP_SKILLS) のオンデマンド同期 (開くときトリガー)
     * @param {Object} bridge
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {Object} playerAdapter
     * @param {Object} memory
     * @returns {Promise<boolean>}
     */
    async syncSkillsOnDemand(bridge, isAvailable, hasLiveMemory, playerAdapter, memory) {
        if (!isAvailable) return false;
        if (hasLiveMemory && playerAdapter) {
            playerAdapter.dumpSkills(memory, isAvailable, hasLiveMemory);
            return true;
        }
        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const skillsRes = await bridge.callShim(SHIM_CMD.DUMP_SKILLS, 0, 0, 304, 'int32');
                if (skillsRes && Array.isArray(skillsRes.buffer) && playerAdapter) {
                    const slots = typeof skillsRes.result === 'number' ? skillsRes.result : 0;
                    playerAdapter.cachedSkills = parseSkillsBuffer(skillsRes.buffer, slots);
                    playerAdapter.cachedWeaponSlots = slots;
                    return true;
                }
            } catch (e) {
                console.warn('[WasmSyncCoordinator] syncSkillsOnDemand error:', e);
            }
        }
        return false;
    }

    /**
     * 呪文リスト (DUMP_SPELL_BOOK) のオンデマンド同期 (開くときトリガー)
     * @param {Object} bridge
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {Object} playerAdapter
     * @param {Object} memory
     * @returns {Promise<boolean>}
     */
    async syncSpellBookOnDemand(bridge, isAvailable, hasLiveMemory, playerAdapter, memory) {
        if (!isAvailable) return false;
        if (hasLiveMemory && playerAdapter) {
            playerAdapter.dumpSpellBook(memory, isAvailable, hasLiveMemory);
            return true;
        }
        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const spellRes = await bridge.callShim(SHIM_CMD.DUMP_SPELL_BOOK, 0, 0, 1024, 'int32');
                if (spellRes && Array.isArray(spellRes.buffer) && playerAdapter) {
                    const count = typeof spellRes.result === 'number' ? spellRes.result : null;
                    playerAdapter.cachedSpells = parseSpellBookBuffer(spellRes.buffer, count);
                    return true;
                }
            } catch (e) {
                console.warn('[WasmSyncCoordinator] syncSpellBookOnDemand error:', e);
            }
        }
        return false;
    }

    /**
     * 発見状態 (DUMP_DISCOVERIES / DUMP_DESCR_INDEXES) のオンデマンド同期 (開くときトリガー)
     * @param {Object} bridge
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {Object} discoveryAdapter
     * @param {Object} memory
     * @returns {Promise<boolean>}
     */
    async syncDiscoveriesOnDemand(bridge, isAvailable, hasLiveMemory, discoveryAdapter, memory) {
        if (!isAvailable) return false;
        if (hasLiveMemory && discoveryAdapter) {
            discoveryAdapter.getDiscoveries(memory, isAvailable, hasLiveMemory);
            discoveryAdapter.getDescrIndexes(memory, isAvailable, hasLiveMemory);
            return true;
        }
        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const discRes = await bridge.callShim(SHIM_CMD.DUMP_DISCOVERIES, 0, 0, 600, 'uint8');
                if (discRes && Array.isArray(discRes.buffer) && discoveryAdapter) {
                    discoveryAdapter.cachedDiscoveries = new Uint8Array(discRes.buffer);
                }
                const descrRes = await bridge.callShim(SHIM_CMD.DUMP_DESCR_INDEXES, 0, 0, 2400, 'int32');
                if (descrRes && typeof descrRes.result === 'number' && descrRes.result > 0 && Array.isArray(descrRes.buffer) && discoveryAdapter) {
                    const count = Math.min(descrRes.buffer.length, descrRes.result + 1);
                    discoveryAdapter.cachedDescrIndexes = new Int32Array(descrRes.buffer.slice(0, count));
                }
                return true;
            } catch (e) {
                console.warn('[WasmSyncCoordinator] syncDiscoveriesOnDemand error:', e);
            }
        }
        return false;
    }

    /**
     * プレイヤープロファイル (GET_PLAYER_PROFILE) のオンデマンド同期 (Stage 8.5)
     * @param {Object} bridge
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {Object} playerAdapter
     * @param {Object} memory
     * @returns {Promise<boolean>}
     */
    async syncPlayerProfileOnDemand(bridge, isAvailable, hasLiveMemory, playerAdapter, memory = null) {
        if (!isAvailable || !playerAdapter) return false;

        if (hasLiveMemory) {
            playerAdapter.dumpPlayerProfile(memory, isAvailable, hasLiveMemory);
            return true;
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const res = await bridge.callShim(SHIM_CMD.GET_PLAYER_PROFILE, 0, 0, 256, 'int32');
                if (res && res.result >= 0 && Array.isArray(res.buffer)) {
                    playerAdapter.cachedPlayerProfile = parsePlayerProfileBuffer(res.buffer);
                    return true;
                }
            } catch (e) {
                console.warn('[WasmSyncCoordinator] syncPlayerProfileOnDemand error:', e);
            }
        }
        return false;
    }

    /**
     * プレイヤーサマリー (GET_PLAYER_SUMMARY) のオンデマンド同期 (Stage 8.4)
     * @param {Object} bridge
     * @param {boolean} isAvailable
     * @param {boolean} hasLiveMemory
     * @param {Object} playerAdapter
     * @param {Object} memory
     * @returns {Promise<boolean>}
     */
    async syncPlayerSummaryOnDemand(bridge, isAvailable, hasLiveMemory, playerAdapter, memory = null) {
        if (!isAvailable || !playerAdapter) return false;

        if (hasLiveMemory) {
            playerAdapter.dumpPlayerSummary(memory, isAvailable, hasLiveMemory);
            return true;
        }

        if (bridge && typeof bridge.callShim === 'function') {
            try {
                const res = await bridge.callShim(SHIM_CMD.GET_PLAYER_SUMMARY, 0, 0, 32, 'int32');
                if (res && res.result === 0 && Array.isArray(res.buffer)) {
                    playerAdapter.cachedPlayerSummary = parsePlayerSummaryBuffer(res.buffer);
                    return true;
                }
            } catch (e) {
                console.warn('[WasmSyncCoordinator] syncPlayerSummaryOnDemand error:', e);
            }
        }
        return false;
    }

    /**
     * 指定座標群のモンスター情報を一括非同期取得 (Worker 調停対応)
     * @param {Array<{x: number, y: number}>} coords
     * @param {Function} fetchFullMonsterAtFn
     * @returns {Promise<Array<Object>>}
     */
    async syncSurroundingMonsters(coords = [], fetchFullMonsterAtFn = null) {
        if (!Array.isArray(coords) || coords.length === 0) return [];
        const results = [];
        for (const c of coords) {
            if (typeof c.x === 'number' && typeof c.y === 'number' && typeof fetchFullMonsterAtFn === 'function') {
                const mon = await fetchFullMonsterAtFn(c.x, c.y);
                if (mon) results.push(mon);
            }
        }
        return results;
    }
}
