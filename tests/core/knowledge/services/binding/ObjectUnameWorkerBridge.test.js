import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscoveryWasmAdapter } from '../../../../../src/core/knowledge/services/binding/DiscoveryWasmAdapter.js';
import { WasmSyncCoordinator } from '../../../../../src/core/knowledge/services/binding/WasmSyncCoordinator.js';
import { WasmDirectBindingService } from '../../../../../src/core/knowledge/services/WasmDirectBindingService.js';
import { InventoryStateManager } from '../../../../../src/core/knowledge/state/InventoryStateManager.js';
import { DiscoveryStateManager } from '../../../../../src/core/knowledge/state/DiscoveryStateManager.js';
import { SHIM_CMD } from '../../../../../src/core/knowledge/services/binding/BindingConstants.js';

describe('ObjectUname WorkerBridge Direct Binding & Inventory Integration', () => {
    describe('DiscoveryWasmAdapter - Cached Uname Management', () => {
        let adapter;

        beforeEach(() => {
            adapter = new DiscoveryWasmAdapter();
        });

        it('returns cached uname when hasLiveMemory is false in WorkerBridge mode', () => {
            expect(adapter.getObjectUname(280, null, true, false)).toBeNull();

            adapter.setCachedObjectUname(280, 'speed?');
            expect(adapter.getObjectUname(280, null, true, false)).toBe('speed?');

            // 空文字または null の場合は削除される
            adapter.setCachedObjectUname(280, '');
            expect(adapter.getObjectUname(280, null, true, false)).toBeNull();

            adapter.setCachedObjectUname(280, 'healing?');
            adapter.setCachedObjectUname(280, null);
            expect(adapter.getObjectUname(280, null, true, false)).toBeNull();
        });

        it('clears cached unames on clearDiscoveryCaches or resetCache', () => {
            adapter.setCachedObjectUname(280, 'speed?');
            adapter.setCachedObjectUname(281, 'extra_healing?');
            expect(adapter.getObjectUname(280, null, true, false)).toBe('speed?');
            expect(adapter.getObjectUname(281, null, true, false)).toBe('extra_healing?');

            adapter.clearDiscoveryCaches();
            expect(adapter.getObjectUname(280, null, true, false)).toBeNull();
            expect(adapter.getObjectUname(281, null, true, false)).toBeNull();
        });
    });

    describe('WasmSyncCoordinator - syncFromWorkerBridge with GET_OBJECT_UNAME', () => {
        let coordinator;
        let bridge;
        let adapters;

        beforeEach(() => {
            coordinator = new WasmSyncCoordinator();
            bridge = {
                callShim: vi.fn()
            };
            adapters = {
                discovery: new DiscoveryWasmAdapter(),
                inventory: {
                    cachedInventory: [
                        { onum: 280, ptr: 0x1000, quan: 1, invlet: 'a' },
                        { onum: 281, ptr: 0x2000, quan: 2, invlet: 'b' }
                    ]
                },
                player: {},
                monster: {},
                spatial: { cachedCellX: 10, cachedCellY: 10 }
            };
        });

        it('queries GET_OBJECT_UNAME for inventory items and caches results in discoveryAdapter', async () => {
            bridge.callShim.mockImplementation(async (cmd, arg1) => {
                if (cmd === SHIM_CMD.GET_CELL_INFO) return { result: 0 };
                if (cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) return { result: 0, buffer: [] };
                if (cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                    return {
                        result: 2,
                        buffer: [
                            // item 0: onum 280, ptr 0x1000, quan 1, invlet 'a'
                            1, 280, 0, 0, 0, 0, 0, 0, 0x1000, 101, 0, -1,
                            // item 1: onum 281, ptr 0x2000, quan 2, invlet 'b'
                            2, 281, 0, 0, 0, 0, 0, 0, 0x2000, 102, 0, -1
                        ]
                    };
                }
                if (cmd === SHIM_CMD.DUMP_DISCOVERIES) return { result: 0, buffer: new Array(600).fill(0) };
                if (cmd === SHIM_CMD.DUMP_DESCR_INDEXES) return { result: 600, buffer: new Array(600).fill(0) };
                if (cmd === SHIM_CMD.GET_OBJECT_UNAME) {
                    if (arg1 === 280) return { result: 1, buffer: 'speed?' };
                    if (arg1 === 281) return { result: 0, buffer: '' };
                }
                return { result: 0 };
            });

            const facade = {
                unpackObjectBuffer: vi.fn((raw8, ptr, cobjPtr, o_id, corpsenm) => {
                    return {
                        onum: raw8[1],
                        quan: raw8[0],
                        ptr,
                        rawObjPtr: ptr,
                        weight: 10,
                        invlet: raw8[1] === 280 ? 'a' : 'b',
                        flags: { bknown: true, dknown: true }
                    };
                })
            };

            const success = await coordinator.syncFromWorkerBridge(
                { syncInventory: true, syncDiscoveries: true },
                bridge,
                'native',
                adapters,
                { x: 10, y: 10 },
                facade
            );

            expect(success).toBe(true);
            expect(adapters.discovery.getObjectUname(280, null, true, false)).toBe('speed?');
            expect(adapters.discovery.getObjectUname(281, null, true, false)).toBeNull();
        });
    });

    describe('Full Flow: DirectBindingService + DiscoveryStateManager + InventoryStateManager', () => {
        let bindingService;
        let discoveryStateManager;
        let inventoryStateManager;
        let bridge;

        beforeEach(() => {
            bridge = {
                callShim: vi.fn()
            };
            bindingService = new WasmDirectBindingService({ bridge });
            discoveryStateManager = new DiscoveryStateManager({
                wasmDirectBindingService: bindingService
            });
            inventoryStateManager = new InventoryStateManager({
                wasmDirectBindingService: bindingService,
                discoveryStateManager,
                language: 'en'
            });
            discoveryStateManager.setInventoryStateManager(inventoryStateManager);
        });

        it('reflects calledName in inventory items, rawText, and identification in WorkerBridge mode', async () => {
            const itemPtr = 0x1234;
            // 300 is potion of healing (random appearance)
            const onum = 300;
            const invletCode = 'a'.charCodeAt(0);

            bridge.callShim.mockImplementation(async (cmd, arg1) => {
                if (cmd === SHIM_CMD.GET_CELL_INFO) return { result: 0 };
                if (cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) return { result: 0, buffer: [] };
                if (cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                    return {
                        result: 1,
                        buffer: [
                            onum, 20, 1, 0, 4, invletCode, 0x04, 20, itemPtr, 101, 0, -1
                        ]
                    };
                }
                if (cmd === SHIM_CMD.DUMP_DISCOVERIES) {
                    // 全て未識別 (0)
                    return { result: 0, buffer: new Array(600).fill(0) };
                }
                if (cmd === SHIM_CMD.DUMP_DESCR_INDEXES) {
                    return { result: 600, buffer: new Array(600).fill(0) };
                }
                if (cmd === SHIM_CMD.GET_OBJECT_UNAME) {
                    if (arg1 === onum) return { result: 1, buffer: 'fast' };
                }
                return { result: 0 };
            });

            // 1. WorkerBridge から同期
            await bindingService.syncFromWorkerBridge({ syncInventory: true, syncDiscoveries: true });
            discoveryStateManager.syncWithLiveMemory(bindingService);

            // 2. InventoryStateManager に同期
            const changed = inventoryStateManager.syncFromDirectBinding();
            expect(changed).toBe(true);

            const items = inventoryStateManager.getItems();
            expect(items).toHaveLength(1);

            const potion = items[0];
            expect(potion.onum).toBe(onum);
            expect(potion.identification).toBeDefined();
            expect(potion.identification.calledName).toBe('fast');
            expect(potion.rawText).toContain('called fast');

            // 3. 命名リセット時 (スペース送信等で C コア側がクリアされた場合)
            bridge.callShim.mockImplementation(async (cmd, arg1) => {
                if (cmd === SHIM_CMD.GET_OBJECT_UNAME && arg1 === onum) {
                    return { result: 0, buffer: '' };
                }
                if (cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                    return {
                        result: 1,
                        buffer: [onum, 20, 1, 0, 4, invletCode, 0x04, 20, itemPtr, 101, 0, -1]
                    };
                }
                if (cmd === SHIM_CMD.DUMP_DISCOVERIES) {
                    return { result: 0, buffer: new Array(600).fill(0) };
                }
                return { result: 0, buffer: [] };
            });

            await bindingService.syncFromWorkerBridge({ syncInventory: true, syncDiscoveries: true });
            discoveryStateManager.syncWithLiveMemory(bindingService);
            inventoryStateManager.syncFromDirectBinding();

            const updatedItems = inventoryStateManager.getItems();
            const resetPotion = updatedItems[0];
            expect(resetPotion.identification.calledName).toBeFalsy();
            expect(resetPotion.rawText).not.toContain('called');
        });
    });
});
