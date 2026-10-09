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

    it('getInventoryWeight, getObjectWeight, getContainerWeight call native functions directly', () => {
        expect(service.getInventoryWeight()).toBe(450);
        expect(service.getObjectWeight(0x1000)).toBe(50);
        expect(service.getContainerWeight(0x2000)).toBe(120);

        expect(mockModule._inv_weight).toHaveBeenCalled();
        expect(mockModule._weight).toHaveBeenCalledWith(0x1000);
        expect(mockModule._container_weight).toHaveBeenCalledWith(0x2000);
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

        it('syncFromWorkerBridge fetches inventory snapshot and makes getInventory and getEquipmentPtrs synchronously available', async () => {
            const dummyItems = [
                { ptr: 0x2000, invlet: 'a', otyp: 24, quan: 1, flags: { blessed: true, bknown: true } },
                { ptr: 0x3000, invlet: 'b', otyp: 10, quan: 5, flags: { uncursed: true, bknown: true } }
            ];
            const dummyEquipment = {
                ptrArray: [0x2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // 0: weapon (uwep)
            };

            mockBridge.getInventorySnapshot = vi.fn().mockResolvedValue({
                items: dummyItems,
                equipment: dummyEquipment
            });

            const success = await bridgeService.syncFromWorkerBridge({ syncInventory: true });
            expect(success).toBe(true);
            expect(mockBridge.getInventorySnapshot).toHaveBeenCalledTimes(1);

            // getInventory がキャッシュから同期的に返ること
            const items = bridgeService.getInventory();
            expect(items).toEqual(dummyItems);

            // getEquipmentPtrs がキャッシュから同期的に返ること
            const eq = bridgeService.getEquipmentPtrs();
            expect(eq.rawPtrs.uwep).toBe(0x2000);
            expect(eq.slotByPtr.get(0x2000)).toBe('weapon');
            expect(eq.ptrBySlot.get('weapon')).toBe(0x2000);
        });
    });
});
