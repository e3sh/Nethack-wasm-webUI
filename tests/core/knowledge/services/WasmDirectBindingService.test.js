import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WasmDirectBindingService, EQUIPMENT_SLOT_NAMES, EQUIPMENT_FIELD_KEYS } from '../../../../src/core/knowledge/services/WasmDirectBindingService.js';
import NetHackMemory from '../../../../src/driver/NetHackMemory.js';

describe('WasmDirectBindingService', () => {
    let mockModule;
    let memory;
    let service;

    beforeEach(() => {
        mockModule = {
            _shim_bridge_call: vi.fn(),
            _inv_weight: vi.fn(() => 450),
            _weight: vi.fn((ptr) => ptr === 0x1000 ? 50 : 20),
            _container_weight: vi.fn((ptr) => ptr === 0x2000 ? 120 : 0),
            _malloc: vi.fn((size) => 0x8000),
            _free: vi.fn(),
            getValue: vi.fn(),
            setValue: vi.fn()
        };

        memory = new NetHackMemory(mockModule);
        service = new WasmDirectBindingService({ memory });
    });

    it('isAvailable returns true when _shim_bridge_call exists', () => {
        expect(service.isAvailable()).toBe(true);

        const emptyService = new WasmDirectBindingService({ memory: new NetHackMemory({}) });
        expect(emptyService.isAvailable()).toBe(false);
    });

    it('getEquipmentPtrs correctly retrieves and maps all 14 equipment slots', () => {
        // Mock buffer allocation and readInt32Array
        let allocatedPtr = 0x9000;
        vi.spyOn(memory, 'allocateBuffer').mockReturnValue(allocatedPtr);
        vi.spyOn(memory, 'freeBuffer');

        // Mock 14 slot pointers: uwep=0x1000, uarm=0x1010, uleft=0x1020, others=0
        const mockSlotPointers = [
            0x1000, // 0: uwep (weapon)
            0,      // 1: uswapwep (offhand)
            0,      // 2: uquiver (quiver)
            0x1010, // 3: uarm (suit)
            0,      // 4: uarmc (cloak)
            0,      // 5: uarmh (helmet)
            0,      // 6: uarms (shield)
            0,      // 7: uarmg (gloves)
            0,      // 8: uarmf (boots)
            0,      // 9: uarmu (shirt)
            0,      // 10: uamul (amulet)
            0x1020, // 11: uleft (ring_left)
            0,      // 12: uright (ring_right)
            0       // 13: ublindf (blindfold)
        ];

        vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2, buf, len) => {
            if (cmd === NetHackMemory.SHIM_CMD.GET_EQUIPMENT_PTRS) {
                return 0;
            }
            return -1;
        });
        vi.spyOn(memory, 'readInt32Array').mockReturnValue(mockSlotPointers);

        const result = service.getEquipmentPtrs();

        expect(memory.allocateBuffer).toHaveBeenCalledWith(56);
        expect(memory.freeBuffer).toHaveBeenCalledWith(allocatedPtr);
        expect(result.rawPtrs.uwep).toBe(0x1000);
        expect(result.rawPtrs.uarm).toBe(0x1010);
        expect(result.rawPtrs.uleft).toBe(0x1020);

        expect(result.slotByPtr.get(0x1000)).toBe('weapon');
        expect(result.slotByPtr.get(0x1010)).toBe('suit');
        expect(result.slotByPtr.get(0x1020)).toBe('ring_left');

        expect(result.ptrBySlot.get('weapon')).toBe(0x1000);
        expect(result.ptrBySlot.get('suit')).toBe(0x1010);
        expect(result.ptrBySlot.get('ring_left')).toBe(0x1020);
    });

    it('getInventory traverses linked list and decodes object structures', () => {
        const item1Ptr = 0x1000;
        const item2Ptr = 0x2000;
        const bufPtr = 0x8800;

        vi.spyOn(memory, 'allocateBuffer').mockReturnValue(bufPtr);
        vi.spyOn(memory, 'freeBuffer');

        // リンクリスト: gi.invent -> item1 -> item2 -> 0
        vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2, buf, len) => {
            if (cmd === NetHackMemory.SHIM_CMD.GET_INVENT_PTR) {
                return item1Ptr;
            }
            if (cmd === NetHackMemory.SHIM_CMD.DUMP_OBJECT_INFO) {
                return 0; // success
            }
            return -1;
        });

        // memory.getValue:
        // offset 0: next item ptr (nobj)
        // offset 8: cobjPtr
        // offset 12: o_id
        vi.spyOn(memory, 'getValue').mockImplementation((ptr, type) => {
            if (ptr === item1Ptr + 0) return item2Ptr; // next
            if (ptr === item1Ptr + 8) return 0;        // cobj
            if (ptr === item1Ptr + 12) return 101;     // o_id

            if (ptr === item2Ptr + 0) return 0;        // end of list
            if (ptr === item2Ptr + 8) return 0x3000;   // cobj (container inside)
            if (ptr === item2Ptr + 12) return 102;     // o_id
            return 0;
        });

        // readInt32Array: item1 (+1 long sword), item2 (bag of holding)
        vi.spyOn(memory, 'readInt32Array').mockImplementation((buf, count) => {
            // bridgeCall で渡された arg1 のアイテムに応じて値を返す
            const lastCall = memory.bridgeCall.mock.calls[memory.bridgeCall.mock.calls.length - 1];
            const currentItemPtr = lastCall ? lastCall[1] : 0;

            if (currentItemPtr === item1Ptr) {
                // [otyp, owt, quan, spe, oclass, invlet, flags, weight]
                // spe = 1, invlet = 'a' (97), flags = 5 (blessed: 1 | bknown: 4)
                return [25, 40, 1, 1, 1, 97, 5, 40];
            } else if (currentItemPtr === item2Ptr) {
                // bag of holding: otyp = 219, owt = 15, quan = 1, spe = 0, oclass = 2, invlet = 'b' (98), flags = 1 (blessed), weight = 135
                return [219, 15, 1, 0, 2, 98, 1, 135];
            }
            return [0, 0, 0, 0, 0, 0, 0, 0];
        });

        const items = service.getInventory();

        expect(items).toHaveLength(2);

        // item 1
        expect(items[0].ptr).toBe(item1Ptr);
        expect(items[0].onum).toBe(25);
        expect(items[0].quan).toBe(1);
        expect(items[0].spe).toBe(1);
        expect(items[0].invlet).toBe('a');
        expect(items[0].flags.blessed).toBe(true);
        expect(items[0].flags.cursed).toBe(false);
        expect(items[0].flags.bknown).toBe(true);
        expect(items[0].weight).toBe(40);
        expect(items[0].o_id).toBe(101);

        // item 2
        expect(items[1].ptr).toBe(item2Ptr);
        expect(items[1].onum).toBe(219);
        expect(items[1].invlet).toBe('b');
        expect(items[1].cobjPtr).toBe(0x3000);
        expect(items[1].weight).toBe(135);
        expect(items[1].o_id).toBe(102);

        expect(memory.freeBuffer).toHaveBeenCalledWith(bufPtr);
    });

    it('returns empty inventory when gi.invent is 0', () => {
        vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd) => {
            if (cmd === NetHackMemory.SHIM_CMD.GET_INVENT_PTR) return 0;
            return -1;
        });

        const items = service.getInventory();
        expect(items).toEqual([]);
    });

    it('getInventoryWeight, getObjectWeight, getContainerWeight compute true weights via Direct Binding / SHIM', () => {
        // getInventory() が返すアイテム群から総重量を計算
        vi.spyOn(service, 'getInventory').mockReturnValue([
            { oclass: 1, quan: 300, weight: 0 }, // 金貨 300枚 = 3
            { oclass: 2, quan: 1, weight: 447 }  // 武器 = 447
        ]);
        expect(service.getInventoryWeight()).toBe(450);

        // getObjectWeight: DUMP_OBJECT_INFO を通じて取得
        let bufPtr = 0x9000;
        vi.spyOn(memory, 'allocateBuffer').mockReturnValue(bufPtr);
        vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1) => {
            if (cmd === NetHackMemory.SHIM_CMD.DUMP_OBJECT_INFO && a1 === 0x1000) return 0;
            return -1;
        });
        vi.spyOn(memory, 'readInt32Array').mockReturnValue([25, 40, 1, 0, 1, 97, 0, 50]); // weight = 50

        expect(service.getObjectWeight(0x1000)).toBe(50);
        expect(service.getContainerWeight(0x1000)).toBe(50);
    });

    describe('Stage 8.3 - Terrain, Trap, Engraving, Room, and Monster bindings', () => {
        it('getCellInfo decodes typ, flags, lit, roomno and door state correctly', () => {
            // (1) 施錠・罠付きドア (typ: DOOR=23, flags: D_LOCKED(0x08) | D_TRAPPED(0x10) = 0x18, lit: 1, roomno: 5)
            // res = 23 | (0x18 << 8) | (1 << 16) | (5 << 17)
            const rawVal1 = 23 | (0x18 << 8) | (1 << 16) | (5 << 17);
            vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2) => {
                if (cmd === NetHackMemory.SHIM_CMD.GET_CELL_INFO && a1 === 10 && a2 === 5) {
                    return rawVal1;
                }
                return -1;
            });

            const cell1 = service.getCellInfo(10, 5);
            expect(cell1).not.toBeNull();
            expect(cell1.typ).toBe(23); // DOOR
            expect(cell1.flags).toBe(0x18);
            expect(cell1.lit).toBe(true);
            expect(cell1.roomno).toBe(5);
            expect(cell1.door).not.toBeNull();
            expect(cell1.door.isLocked).toBe(true);
            expect(cell1.door.isTrapped).toBe(true);
            expect(cell1.door.isOpen).toBe(false);

            // (2) 部屋床 (typ: ROOM=25, flags: 0, lit: 0, roomno: 3)
            const rawVal2 = 25 | (0 << 8) | (0 << 16) | (3 << 17);
            memory.bridgeCall.mockImplementation((cmd, a1, a2) => {
                if (cmd === NetHackMemory.SHIM_CMD.GET_CELL_INFO && a1 === 15 && a2 === 8) {
                    return rawVal2;
                }
                return -1;
            });

            const cell2 = service.getCellInfo(15, 8);
            expect(cell2.typ).toBe(25);
            expect(cell2.lit).toBe(false);
            expect(cell2.roomno).toBe(3);
            expect(cell2.door).toBeNull();
        });

        it('dumpLevelTerrain returns Uint8Array of size 1680 (80x21)', () => {
            const bufPtr = 0x7500;
            vi.spyOn(memory, 'allocateBuffer').mockReturnValue(bufPtr);
            vi.spyOn(memory, 'freeBuffer');
            vi.spyOn(memory, 'bridgeCall').mockReturnValue(0);

            const mockTerrain = new Uint8Array(1680);
            mockTerrain[0] = 0; // STONE
            mockTerrain[10] = 25; // ROOM
            vi.spyOn(memory, 'readUint8Array').mockReturnValue(mockTerrain);

            const result = service.dumpLevelTerrain();
            expect(memory.allocateBuffer).toHaveBeenCalledWith(1680);
            expect(memory.bridgeCall).toHaveBeenCalledWith(NetHackMemory.SHIM_CMD.DUMP_LEVEL_TERRAIN, 0, 0, bufPtr, 1680);
            expect(result).toBe(mockTerrain);
            expect(memory.freeBuffer).toHaveBeenCalledWith(bufPtr);
        });

        it('getTrapAt correctly decodes trap type, seen, and once flags', () => {
            // トゲ付きピット (ttyp: 12, tseen: 1, once: 0)
            // res = 12 | (1 << 8) | (0 << 9) = 12 | 256 = 268
            vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, x, y) => {
                if (cmd === NetHackMemory.SHIM_CMD.GET_TRAP_AT && x === 12 && y === 10) {
                    return 268;
                }
                return 0; // 罠なし
            });

            const trap = service.getTrapAt(12, 10);
            expect(trap).not.toBeNull();
            expect(trap.ttyp).toBe(12);
            expect(trap.tseen).toBe(true);
            expect(trap.once).toBe(false);
            expect(trap.nameJa).toContain('ピット');

            expect(service.getTrapAt(1, 1)).toBeNull();
        });

        it('getEngravingAt retrieves text and engraving type', () => {
            const bufPtr = 0x6500;
            vi.spyOn(memory, 'allocateBuffer').mockReturnValue(bufPtr);
            vi.spyOn(memory, 'freeBuffer');

            vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, x, y, buf, len) => {
                if (cmd === NetHackMemory.SHIM_CMD.GET_ENGRAVING_AT && x === 20 && y === 12) {
                    return 3; // BURN (焼き文字)
                }
                return 0;
            });
            vi.spyOn(memory, 'readString').mockReturnValue('Elbereth');

            const engr = service.getEngravingAt(20, 12);
            expect(engr).not.toBeNull();
            expect(engr.engrType).toBe(3);
            expect(engr.typeNameJa).toBe('焼き');
            expect(engr.text).toBe('Elbereth');
            expect(engr.isElbereth).toBe(true);
            expect(memory.freeBuffer).toHaveBeenCalledWith(bufPtr);

            expect(service.getEngravingAt(0, 0)).toBeNull();
        });

        it('getRoomType returns proper room information including shops', () => {
            vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, roomno) => {
                if (cmd === NetHackMemory.SHIM_CMD.GET_ROOM_TYPE) {
                    if (roomno === 2) return 18; // WEAPONSHOP
                    if (roomno === 3) return 10; // TEMPLE
                    if (roomno === 4) return 8;  // ZOO
                    return 0; // OROOM
                }
                return 0;
            });

            const shop = service.getRoomType(2);
            expect(shop.rtype).toBe(18);
            expect(shop.isShop).toBe(true);
            expect(shop.nameJa).toBe('武器屋');

            const temple = service.getRoomType(3);
            expect(temple.rtype).toBe(10);
            expect(temple.isShop).toBe(false);
            expect(temple.nameJa).toBe('寺院');

            const zoo = service.getRoomType(4);
            expect(zoo.rtype).toBe(8);
            expect(zoo.isShop).toBe(false);
            expect(zoo.nameJa).toBe('動物園');
        });

        it('getMonsterInfo and getMonsterState decode flags and stats', () => {
            const monPtr = 0x4400;

            vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, x, y) => {
                if (x === 10 && y === 10) {
                    if (cmd === NetHackMemory.SHIM_CMD.GET_MONSTER_AT) return monPtr;
                    if (cmd === NetHackMemory.SHIM_CMD.GET_MONSTER_INFO) {
                        // peaceful: 1, tame: 0, hp: 45, hpmax: 50
                        // res = 1 | (0 << 1) | (45 << 8) | (50 << 20)
                        return 1 | (45 << 8) | (50 << 20);
                    }
                    if (cmd === NetHackMemory.SHIM_CMD.GET_MONSTER_STATE) {
                        // sleeping: 1, isshk: 1 (bit 0 and bit 5)
                        // 1 | (1 << 5) = 1 | 32 = 33
                        return 33;
                    }
                }
                return 0;
            });

            const info = service.getMonsterInfo(10, 10);
            expect(info.peaceful).toBe(true);
            expect(info.tame).toBe(false);
            expect(info.hp).toBe(45);
            expect(info.hpmax).toBe(50);

            const state = service.getMonsterState(10, 10);
            expect(state.ptr).toBe(monPtr);
            expect(state.sleeping).toBe(true);
            expect(state.isShopkeeper).toBe(true);
            expect(state.fleeing).toBe(false);

            const full = service.getFullMonsterAt(10, 10);
            expect(full.peaceful).toBe(true);
            expect(full.hp).toBe(45);
            expect(full.hpmax).toBe(50);
            expect(full.isShopkeeper).toBe(true);
            expect(full.sleeping).toBe(true);
        });
    });

    describe('Web Worker 隔離調停モード (WorkerBridge / Stage 8.2-A)', () => {
        let mockBridge;
        let bridgeService;

        beforeEach(() => {
            mockBridge = {
                callShim: vi.fn(async (cmd, arg1, arg2) => {
                    if (cmd === 0x10) {
                        // typ: 25, flags: 0, lit: 1, roomno: 2
                        return { result: 25 | (0 << 8) | (1 << 16) | (2 << 17), buffer: null };
                    }
                    if (cmd === 0x14) {
                        // rtype: 18 (WEAPONSHOP)
                        return { result: 18, buffer: null };
                    }
                    if (cmd === 0x12) {
                        // ttyp: 1 (arrow trap), tseen: 1
                        return { result: 1 | (1 << 8), buffer: null };
                    }
                    if (cmd === 0x13) {
                        // engrType: 2, text: "Elbereth"
                        return { result: 2, buffer: "Elbereth" };
                    }
                    return { result: 0, buffer: null };
                })
            };

            bridgeService = new WasmDirectBindingService({ bridge: mockBridge });
        });

        it('isAvailable returns true when bridge has callShim', () => {
            expect(bridgeService.isAvailable()).toBe(true);
        });

        it('syncFromWorkerBridge fetches cell, room, trap, and engraving and makes them synchronously available', async () => {
            const success = await bridgeService.syncFromWorkerBridge({ playerX: 15, playerY: 7 });
            expect(success).toBe(true);

            expect(mockBridge.callShim).toHaveBeenCalledWith(0x10, 15, 7);
            expect(mockBridge.callShim).toHaveBeenCalledWith(0x14, 2);
            expect(mockBridge.callShim).toHaveBeenCalledWith(0x12, 15, 7);

            // 同期アクセサからキャッシュデータが正しく取得できること
            const cell = bridgeService.getCellInfo(15, 7);
            expect(cell).toBeDefined();
            expect(cell.typ).toBe(25);
            expect(cell.roomno).toBe(2);

            const room = bridgeService.getRoomType(2);
            expect(room).toBeDefined();
            expect(room.isShop).toBe(true);
            expect(room.nameJa).toBe('武器屋');

            const trap = bridgeService.getTrapAt(15, 7);
            expect(trap).toBeDefined();
            expect(trap.ttyp).toBe(1);
            expect(trap.nameJa).toBe('矢の罠');

            const engr = bridgeService.getEngravingAt(15, 7);
            expect(engr).toBeDefined();
            expect(engr.isElbereth).toBe(true);
        });

        it('syncFromWorkerBridge fetches equipment pointers via generic callShim and makes getEquipmentPtrs synchronously available', async () => {
            const dummyEquipment = [0x2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0: weapon (uwep)

            mockBridge.callShim.mockImplementation(async (cmd) => {
                if (cmd === 0x41) { // SHIM_CMD.GET_EQUIPMENT_PTRS
                    return { result: 0, buffer: dummyEquipment };
                }
                return { result: 0, buffer: null };
            });

            const success = await bridgeService.syncFromWorkerBridge({ syncInventory: true });
            expect(success).toBe(true);
            expect(mockBridge.callShim).toHaveBeenCalledWith(0x41, 0, 0, 56, 'int32');

            // getEquipmentPtrs がキャッシュから同期的に返ること
            const eq = bridgeService.getEquipmentPtrs();
            expect(eq.rawPtrs.uwep).toBe(0x2000);
            expect(eq.slotByPtr.get(0x2000)).toBe('weapon');
            expect(eq.ptrBySlot.get('weapon')).toBe(0x2000);
        });

        it('syncFromWorkerBridge fetches discoveries via generic callShim (DUMP_DISCOVERIES) and makes getDiscoveries synchronously available', async () => {
            const dummyDiscoveries = new Array(600).fill(0);
            dummyDiscoveries[307] = 1; // potion of healing

            mockBridge.callShim.mockImplementation(async (cmd) => {
                if (cmd === 0x60) { // SHIM_CMD.DUMP_DISCOVERIES
                    return { result: 0, buffer: dummyDiscoveries };
                }
                return { result: 0, buffer: null };
            });

            const success = await bridgeService.syncFromWorkerBridge({ syncDiscoveries: true });
            expect(success).toBe(true);
            expect(mockBridge.callShim).toHaveBeenCalledWith(0x60, 0, 0, 600, 'uint8');

            // getDiscoveries がキャッシュから同期的に返ること
            const disc = bridgeService.getDiscoveries();
            expect(disc).not.toBeNull();
            expect(disc[307]).toBe(1);
            expect(disc[300]).toBe(0);
        });

        describe('Stage 8.2-C - Floor Objects BUC Identification & Weight Synchronization', () => {
            it('getObjectsAt traverses floor item linked list (nexthere) and decodes BUC flags correctly in live memory mode', () => {
                const item1Ptr = 0x5000;
                const item2Ptr = 0x6000;
                const bufPtr = 0x9000;

                memory.allocateBuffer = vi.fn(() => bufPtr);
                memory.freeBuffer = vi.fn();

                // (1) GET_OBJECT_AT (x=10, y=5) -> item1Ptr
                // (2) DUMP_OBJECT_INFO (item1Ptr) -> [otyp: 24, owt: 50, quan: 1, spe: +1, oclass: 2, invlet: 0, flags: blessed(1)|bknown(4)=5, weight: 50]
                // (3) getValue(item1Ptr + 4, 'i32') -> nexthere = item2Ptr
                // (4) DUMP_OBJECT_INFO (item2Ptr) -> [otyp: 30, owt: 10, quan: 1, spe: 0, oclass: 2, invlet: 0, flags: cursed(2)|bknown(4)=6, weight: 10]
                // (5) getValue(item2Ptr + 4, 'i32') -> nexthere = 0
                vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2) => {
                    if (cmd === NetHackMemory.SHIM_CMD.GET_OBJECT_AT && a1 === 10 && a2 === 5) {
                        return item1Ptr;
                    }
                    if (cmd === NetHackMemory.SHIM_CMD.DUMP_OBJECT_INFO && a1 === item1Ptr) {
                        return 0;
                    }
                    if (cmd === NetHackMemory.SHIM_CMD.DUMP_OBJECT_INFO && a1 === item2Ptr) {
                        return 0;
                    }
                    return -1;
                });

                vi.spyOn(memory, 'readInt32Array').mockImplementation((ptr) => {
                    if (ptr === bufPtr) {
                        // 呼び出し毎に切り替え (12要素: [otyp, owt, quan, spe, oclass, invlet, flags, weight, corpsenm, age, cobj, nexthere])
                        if (memory.bridgeCall.mock.calls.filter(c => c[0] === NetHackMemory.SHIM_CMD.DUMP_OBJECT_INFO).length === 1) {
                            return new Int32Array([24, 50, 1, 1, 2, 0, 5, 50, -1, 0, 0, item2Ptr]); // blessed, bknown, next: item2Ptr
                        } else {
                            return new Int32Array([30, 10, 1, 0, 2, 0, 6, 10, -1, 0, 0, 0]); // cursed, bknown, next: 0
                        }
                    }
                    return new Int32Array(12);
                });

                vi.spyOn(memory, 'getValue').mockImplementation((ptr) => {
                    if (ptr === item1Ptr + 4) return item2Ptr; // nexthere
                    if (ptr === item1Ptr + 8) return 0;       // cobjPtr
                    if (ptr === item1Ptr + 12) return 501;    // o_id
                    if (ptr === item2Ptr + 4) return 0;       // end of list
                    if (ptr === item2Ptr + 8) return 0;
                    if (ptr === item2Ptr + 12) return 502;
                    return 0;
                });

                const floorItems = service.getObjectsAt(10, 5);

                expect(floorItems.length).toBe(2);
                expect(floorItems[0].otyp).toBe(24);
                expect(floorItems[0].flags.blessed).toBe(true);
                expect(floorItems[0].flags.cursed).toBe(false);
                expect(floorItems[0].flags.bknown).toBe(true);

                expect(floorItems[1].otyp).toBe(30);
                expect(floorItems[1].flags.blessed).toBe(false);
                expect(floorItems[1].flags.cursed).toBe(true);
                expect(floorItems[1].flags.bknown).toBe(true);

                expect(memory.freeBuffer).toHaveBeenCalledWith(bufPtr);
            });

            it('correctly handles a single floor object with age >= 1024 without mistaking age for nextPtr', () => {
                const itemPtr = 0x3000;
                const bufPtr = 0x9000;

                memory.allocateBuffer = vi.fn(() => bufPtr);
                memory.freeBuffer = vi.fn();

                vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2) => {
                    if (cmd === NetHackMemory.SHIM_CMD.GET_OBJECT_AT && a1 === 5 && a2 === 5) {
                        return itemPtr;
                    }
                    if (cmd === NetHackMemory.SHIM_CMD.DUMP_OBJECT_INFO && a1 === itemPtr) {
                        return 0;
                    }
                    return -1;
                });

                // 12要素: [otyp, owt, quan, spe, oclass, invlet, flags, weight, corpsenm, age, cobj, nexthere]
                // age = 1500, nexthere = 0
                vi.spyOn(memory, 'readInt32Array').mockImplementation((ptr) => {
                    if (ptr === bufPtr) {
                        return new Int32Array([24, 50, 1, 1, 2, 0, 5, 50, -1, 1500, 0, 0]);
                    }
                    return new Int32Array(12);
                });

                vi.spyOn(memory, 'getValue').mockImplementation(() => 0);

                const floorItems = service.getObjectsAt(5, 5);

                expect(floorItems.length).toBe(1);
                expect(floorItems[0].otyp).toBe(24);
                expect(floorItems[0].age).toBe(1500);
                expect(floorItems[0].nextherePtr).toBe(0);
                expect(floorItems[0].isPile).toBe(false);
                expect(memory.bridgeCall).toHaveBeenCalledTimes(2); // GET_OBJECT_AT + 1x DUMP_OBJECT_INFO
            });

            it('returns empty array when no objects are on the floor', () => {
                vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd) => {
                    if (cmd === NetHackMemory.SHIM_CMD.GET_OBJECT_AT) return 0;
                    return -1;
                });

                const floorItems = service.getObjectsAt(10, 5);
                expect(floorItems).toEqual([]);
            });

            it('syncFromWorkerBridge synchronizes player feet floor objects with BUC info via generic callShim', async () => {
                mockBridge.callShim.mockImplementation(async (cmd, a1, a2) => {
                    if (cmd === 0x41) { // GET_EQUIPMENT_PTRS
                        return { result: 0, buffer: new Array(14).fill(0) };
                    }
                    if (cmd === 0x20 && a1 === 12 && a2 === 8) { // GET_OBJECT_AT
                        return { result: 0x5000, buffer: null };
                    }
                    if (cmd === 0x42 && a1 === 0x5000) { // DUMP_OBJECT_INFO
                        // 12要素: [otyp, owt, quan, spe, oclass, invlet, flags, weight, corpsenm, age, cobj, nexthere]
                        return { result: 0, buffer: [24, 50, 1, 0, 2, 0, 5, 50, -1, 0, 0, 0] };
                    }
                    return { result: 0, buffer: null };
                });

                const success = await bridgeService.syncFromWorkerBridge({
                    playerX: 12,
                    playerY: 8,
                    syncInventory: true,
                    syncFloorObjects: true
                });

                expect(success).toBe(true);

                // 足元 (12, 8) の床アイテムがキャッシュから同期的に返ること
                const feetItems = bridgeService.getObjectsAt(12, 8);
                expect(feetItems.length).toBe(1);
                expect(feetItems[0].otyp).toBe(24);
                expect(feetItems[0].weight).toBe(50);
                expect(feetItems[0].flags.bknown).toBe(true);
                expect(feetItems[0].flags.blessed).toBe(true);
                expect(feetItems[0].flags.cursed).toBe(false);

                // 異なる座標の場合は空
                expect(bridgeService.getObjectsAt(10, 10)).toEqual([]);
            });

            it('syncFromWorkerBridge synchronizes all inventory items in one roundtrip via SHIM_CMD.DUMP_ALL_INVENT (0x43)', async () => {
                mockBridge.callShim.mockImplementation(async (cmd, a1, a2, bufSize, bufType) => {
                    if (cmd === 0x41) { // GET_EQUIPMENT_PTRS
                        const eq = new Array(14).fill(0);
                        eq[0] = 0x1000; // uwep = 0x1000
                        return { result: 0, buffer: eq };
                    }
                    if (cmd === 0x43) { // DUMP_ALL_INVENT
                        // 2 items: 12 ints each
                        // Item 1: long sword (+1, quan 1, invlet 'a' (97), blessed|bknown (5), weight 40, ptr 0x1000, o_id 101, cobj 0)
                        const item1 = [25, 40, 1, 1, 1, 97, 5, 40, 0x1000, 101, 0, 0];
                        // Item 2: apple (quan 3, invlet 'b' (98), uncursed|bknown (4), weight 30, ptr 0x2000, o_id 102, cobj 0)
                        const item2 = [280, 10, 3, 0, 7, 98, 4, 30, 0x2000, 102, 0, 0];
                        return {
                            result: 2,
                            buffer: [...item1, ...item2]
                        };
                    }
                    return { result: 0, buffer: null };
                });

                const success = await bridgeService.syncFromWorkerBridge({ syncInventory: true });
                expect(success).toBe(true);

                const items = bridgeService.getInventory();
                expect(items).toHaveLength(2);

                expect(items[0].ptr).toBe(0x1000);
                expect(items[0].onum).toBe(25);
                expect(items[0].quan).toBe(1);
                expect(items[0].spe).toBe(1);
                expect(items[0].invlet).toBe('a');
                expect(items[0].flags.blessed).toBe(true);
                expect(items[0].weight).toBe(40);
                expect(items[0].o_id).toBe(101);

                expect(items[1].ptr).toBe(0x2000);
                expect(items[1].onum).toBe(280);
                expect(items[1].quan).toBe(3);
                expect(items[1].invlet).toBe('b');
                expect(items[1].flags.cursed).toBe(false);
                expect(items[1].weight).toBe(30);
                expect(items[1].o_id).toBe(102);

                expect(bridgeService.getInventoryWeight()).toBe(70);
            });
        });

        describe('Level Glyphs Dump & Fetch (Hybrid Architecture)', () => {
            it('dumpLevelGlyphs allocates buffer, calls bridge with SHIM_CMD_DUMP_LEVEL_GLYPHS and reads Int32Array', () => {
                const allocatedPtr = 0xA000;
                vi.spyOn(memory, 'allocateBuffer').mockReturnValue(allocatedPtr);
                vi.spyOn(memory, 'freeBuffer');

                const mockGlyphs = new Array(80 * 21).fill(3992);
                mockGlyphs[0] = 3986; // door
                vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2, buf, len) => {
                    if (cmd === NetHackMemory.SHIM_CMD.DUMP_LEVEL_GLYPHS) {
                        expect(len).toBe(80 * 21 * 4);
                        return 0;
                    }
                    return -1;
                });
                vi.spyOn(memory, 'readInt32Array').mockReturnValue(mockGlyphs);

                const glyphs = service.dumpLevelGlyphs();
                expect(glyphs).toBeInstanceOf(Int32Array);
                expect(glyphs.length).toBe(80 * 21);
                expect(glyphs[0]).toBe(3986);
                expect(memory.freeBuffer).toHaveBeenCalledWith(allocatedPtr);
                expect(service._cachedLevelGlyphs).toBe(glyphs);
            });

            it('getCellGlyph calls bridge with SHIM_CMD_GET_CELL_GLYPH and returns glyph number', () => {
                vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2) => {
                    if (cmd === NetHackMemory.SHIM_CMD.GET_CELL_GLYPH && a1 === 10 && a2 === 5) {
                        return 3989; // open door
                    }
                    return -1;
                });

                const glyph = service.getCellGlyph(10, 5);
                expect(glyph).toBe(3989);
            });

            it('fetchLevelGlyphs requests glyph buffer via bridge.callShim', async () => {
                const mockBridge = {
                    callShim: vi.fn(async (cmd, a1, a2, size, type) => {
                        if (cmd === NetHackMemory.SHIM_CMD.DUMP_LEVEL_GLYPHS) {
                            expect(size).toBe(80 * 21 * 4);
                            expect(type).toBe('int32');
                            const buf = new Array(80 * 21).fill(3992);
                            buf[10] = 3988;
                            return { result: 0, buffer: buf };
                        }
                        return { result: -1, buffer: null };
                    })
                };

                const bridgeService = new WasmDirectBindingService({ bridge: mockBridge, memory: null });
                const glyphs = await bridgeService.fetchLevelGlyphs();

                expect(glyphs).toBeInstanceOf(Int32Array);
                expect(glyphs[10]).toBe(3988);
                expect(bridgeService._cachedLevelGlyphs).toBe(glyphs);
            });
        });

        describe('SHIM_CMD_DUMP_MAPSEEN (0x34) - Dungeon Overview & Floor Annotations', () => {
            function createMockMapseenBuffer(entriesData) {
                const buf = new ArrayBuffer(entriesData.length * 96);
                const dv = new DataView(buf);
                const u8 = new Uint8Array(buf);

                entriesData.forEach((e, idx) => {
                    const base = idx * 96;
                    dv.setInt32(base + 0, e.dnum ?? 0, true);
                    dv.setInt32(base + 4, e.dlevel ?? 1, true);
                    dv.setUint16(base + 8, e.nfount ?? 0, true);
                    dv.setUint16(base + 10, e.nsink ?? 0, true);
                    dv.setUint16(base + 12, e.naltar ?? 0, true);
                    dv.setUint16(base + 14, e.msalign ?? 0, true);
                    dv.setUint16(base + 16, e.nshop ?? 0, true);
                    dv.setUint16(base + 18, e.shoptype ?? 0, true);
                    dv.setUint16(base + 20, e.nthrone ?? 0, true);
                    dv.setUint16(base + 22, e.ntemple ?? 0, true);
                    dv.setUint8(base + 24, e.water ?? 0);
                    dv.setUint8(base + 25, e.lava ?? 0);
                    dv.setUint8(base + 26, e.ice ?? 0);
                    dv.setUint8(base + 27, ((e.ngrave ?? 0) & 0x0F) | (((e.ntree ?? 0) & 0x0F) << 4));
                    dv.setUint32(base + 28, e.flags ?? 0, true);
                    if (e.custom) {
                        const encoded = new TextEncoder().encode(e.custom);
                        u8.set(encoded.subarray(0, 63), base + 32);
                    }
                });

                return Array.from(new Int32Array(buf));
            }

            it('getDungeonOverview / getMapseenList decodes MapseenFloorInfo in live memory mode', () => {
                const allocatedPtr = 0xB000;
                vi.spyOn(memory, 'allocateBuffer').mockReturnValue(allocatedPtr);
                vi.spyOn(memory, 'freeBuffer');

                const mockWords = createMockMapseenBuffer([
                    {
                        dnum: 0,
                        dlevel: 5,
                        nfount: 1,
                        nsink: 2,
                        naltar: 1,
                        msalign: 3, // 3: Lawful (include/align.h Amask2msa)
                        nshop: 1,
                        shoptype: 19, // Delicatessen (食料品店)
                        nthrone: 1,
                        ntemple: 1,
                        water: 1,
                        lava: 0,
                        ice: 0,
                        ngrave: 0,
                        ntree: 1,
                        flags: 0x04 | 0x10, // oracle | bigroom
                        custom: '🚩拠点・聖水作成'
                    },
                    {
                        dnum: 2, // Mines
                        dlevel: 4,
                        naltar: 1,
                        msalign: 1, // 1: Chaotic
                        nshop: 2,
                        shoptype: 14, // General Store
                        ntemple: 1,
                        flags: 0,
                        custom: 'Minetown'
                    }
                ]);

                vi.spyOn(memory, 'bridgeCall').mockImplementation((cmd, a1, a2, buf, len) => {
                    if (cmd === NetHackMemory.SHIM_CMD.DUMP_MAPSEEN) {
                        expect(len).toBe(64 * 96);
                        return 2;
                    }
                    return -1;
                });
                vi.spyOn(memory, 'readInt32Array').mockReturnValue(mockWords);

                const overview = service.getDungeonOverview();
                expect(overview).toHaveLength(2);
                expect(service.getMapseenList()).toEqual(overview);

                // Floor 1: Main Dungeon Dlvl:5
                expect(overview[0]).toMatchObject({
                    dnum: 0,
                    dlevel: 5,
                    branchId: 'dungeon',
                    branchNameJa: 'メインダンジョン',
                    floorKey: 'Dlvl:5',
                    features: {
                        fountains: 1,
                        sinks: 2,
                        altars: 1,
                        altarAlign: 'lawful',
                        altarAlignJa: '秩序',
                        shops: 1,
                        shopType: 19,
                        shopNameJa: '食料品店',
                        thrones: 1,
                        temples: 1,
                        water: 1,
                        lava: 0,
                        ice: 0,
                        graves: 0,
                        trees: 1
                    },
                    flags: {
                        sokoSolved: false,
                        castle: false,
                        oracle: true,
                        vibratingSquare: false,
                        bigRoom: true
                    },
                    annotation: '🚩拠点・聖水作成'
                });

                // Floor 2: Mines 4
                expect(overview[1]).toMatchObject({
                    dnum: 2,
                    dlevel: 4,
                    branchId: 'mines',
                    branchNameJa: 'ノームの鉱山',
                    floorKey: 'mines:4',
                    features: {
                        altars: 1,
                        altarAlign: 'chaotic',
                        altarAlignJa: '混沌',
                        shops: 2,
                        shopType: 14,
                        temples: 1
                    },
                    annotation: 'Minetown'
                });

                expect(memory.freeBuffer).toHaveBeenCalledWith(allocatedPtr);
            });

            it('fetchDungeonOverview / syncDungeonOverviewOnDemand works via WorkerBridge.callShim', async () => {
                const mockWords = createMockMapseenBuffer([
                    {
                        dnum: 4, // Sokoban
                        dlevel: 2,
                        flags: 0x01, // sokosolved
                        custom: 'Solved level'
                    },
                    {
                        dnum: 1, // Gehennom
                        dlevel: 20,
                        flags: 0x02 | 0x08, // castle | vibrating_square
                        custom: 'Vibrating square here'
                    }
                ]);

                mockBridge.callShim.mockImplementation(async (cmd, a1, a2, size, type) => {
                    if (cmd === NetHackMemory.SHIM_CMD.DUMP_MAPSEEN) {
                        expect(size).toBe(64 * 96);
                        expect(type).toBe('int32');
                        return { result: 2, buffer: mockWords };
                    }
                    return { result: 0, buffer: null };
                });

                const list = await bridgeService.fetchDungeonOverview();
                expect(list).toHaveLength(2);
                expect(list[0].branchId).toBe('sokoban');
                expect(list[0].branchNameJa).toBe('倉庫番');
                expect(list[0].flags.sokoSolved).toBe(true);
                expect(list[0].annotation).toBe('Solved level');

                expect(list[1].branchId).toBe('gehennom');
                expect(list[1].flags.castle).toBe(true);
                expect(list[1].flags.vibratingSquare).toBe(true);
                expect(list[1].annotation).toBe('Vibrating square here');

                // キャッシュから同期取得できること
                expect(bridgeService.getDungeonOverview()).toEqual(list);
            });
        });
    });
});
