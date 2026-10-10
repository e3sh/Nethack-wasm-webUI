import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WasmDirectBindingService } from '../../../src/core/knowledge/services/WasmDirectBindingService.js';
import { InventoryStateManager } from '../../../src/core/knowledge/state/InventoryStateManager.js';
import { AreaStateManager } from '../../../src/core/knowledge/state/AreaStateManager.js';
import { GKLPlugin } from '../../../src/core/knowledge/GKLPlugin.js';
import { DebugInspector } from '../../../src/core/inspector/DebugInspector.js';

describe('Stage 8.2-B: Direct Binding Verification Environment & Fallback Guard', () => {
    let mockService;
    let invManager;
    let areaManager;
    let mockCore;
    let gkl;

    beforeEach(() => {
        mockService = {
            _mode: 'auto',
            mode: 'auto',
            setMode: vi.fn(function(m) { this.mode = m; }),
            isAvailable: vi.fn(function() { return this.mode !== 'fallback'; }),
            getInventory: vi.fn(() => [
                {
                    ptr: 0x1000,
                    rawObjPtr: 0x1000,
                    otyp: 25,
                    onum: 25,
                    owt: 40,
                    quan: 1,
                    spe: 1,
                    oclass: 1,
                    invlet: 'a',
                    flags: { blessed: true, cursed: false, bknown: true, dknown: true },
                    weight: 40,
                    cobjPtr: 0,
                    o_id: 101
                }
            ]),
            getEquipmentPtrs: vi.fn(() => ({
                rawPtrs: { uwep: 0x1000 },
                slotByPtr: new Map([[0x1000, 'weapon']]),
                ptrBySlot: new Map([['weapon', 0x1000]])
            })),
            getCellInfo: vi.fn((x, y) => ({
                x,
                y,
                typ: 25, // ROOM
                flags: 0,
                lit: true,
                roomno: 1,
                door: null
            })),
            getRoomType: vi.fn((r) => ({
                roomno: r,
                rtype: 10,
                isShop: false,
                name: 'Temple',
                nameJa: '寺院'
            })),
            getTrapAt: vi.fn(() => null),
            getEngravingAt: vi.fn(() => null)
        };

        invManager = new InventoryStateManager({
            wasmDirectBindingService: mockService,
            language: 'ja'
        });

        areaManager = new AreaStateManager(80, 24, null, mockService);

        mockCore = {
            state: 'WAITING_INPUT',
            currentPromptCategory: null,
            currentPromptChoices: null,
            activeResolver: null,
            isPendingPrefix: false,
            driver: {
                state: 'WAITING_INPUT',
                isTopLevelTurn: true,
                canAcceptSequenceInterruption: true,
                sequenceQueueLength: 0
            },
            emit: vi.fn(),
            on: vi.fn(),
            querySequenceSilent: vi.fn(() => Promise.resolve([])),
            respond: vi.fn(),
            sendAction: vi.fn(),
            config: {}
        };

        gkl = new GKLPlugin();
        gkl.core = mockCore;
        gkl.wasmDirectBindingService = mockService;
        gkl.inventoryStateManager = invManager;
        gkl.areaStateManager = areaManager;
        mockCore.gkl = gkl;
    });

    describe('Mode Propagation across Components', () => {
        it('propagates mode change to all state managers via gkl.setDirectBindingMode', () => {
            expect(gkl.directBindingMode).toBe('auto');
            expect(invManager.directBindingMode).toBe('auto');
            expect(areaManager.directBindingMode).toBe('auto');

            gkl.setDirectBindingMode('strict');
            expect(gkl.directBindingMode).toBe('strict');
            expect(invManager.directBindingMode).toBe('strict');
            expect(areaManager.directBindingMode).toBe('strict');
            expect(mockService.setMode).toHaveBeenCalledWith('strict');

            gkl.setDirectBindingMode('fallback');
            expect(gkl.directBindingMode).toBe('fallback');
            expect(invManager.directBindingMode).toBe('fallback');
            expect(areaManager.directBindingMode).toBe('fallback');
            expect(mockService.setMode).toHaveBeenCalledWith('fallback');
        });

        it('normalizes invalid mode strings to auto', () => {
            gkl.setDirectBindingMode('invalid_mode');
            expect(gkl.directBindingMode).toBe('auto');
            expect(invManager.directBindingMode).toBe('auto');
            expect(areaManager.directBindingMode).toBe('auto');
        });
    });

    describe('Strict Mode Verification (Zero Fallback Guarantee)', () => {
        beforeEach(() => {
            gkl.setDirectBindingMode('strict');
        });

        it('InventoryStateManager completely blocks macro parsing in strict mode', () => {
            const menuItems = [
                { letter: 'b', rawStr: 'b - a blessed +1 dagger', glyph: 100 }
            ];

            const result = invManager.updateFromMenuItems(menuItems);
            expect(result).toBe(false);
            expect(invManager.macroSyncCount).toBe(0);
            expect(invManager.items.length).toBe(0);

            const seqResult = invManager.updateFromSequenceBuffer([{ menuItems }]);
            expect(seqResult).toBe(false);
            expect(invManager.macroSyncCount).toBe(0);
        });

        it('InventoryStateManager accurately records SHIM sync telemetry when direct binding succeeds', () => {
            const result = invManager.syncFromDirectBinding();
            expect(result).toBe(true);
            expect(invManager.lastSyncMethod).toBe('SHIM');
            expect(invManager.shimSyncCount).toBe(1);
            expect(invManager.items.length).toBe(1);
            expect(invManager.items[0].letter).toBe('a');
        });

        it('GKLPlugin.syncInventorySilent completely blocks macro querySequenceSilent when direct binding is unavailable in strict mode', async () => {
            mockService.isAvailable.mockReturnValue(false);

            const result = await gkl.syncInventorySilent();
            expect(result).toBe(false);
            expect(mockCore.querySequenceSilent).not.toHaveBeenCalled();
            expect(gkl.silentSyncTracker.macroCount).toBe(0);
        });

        it('AreaStateManager completely blocks inferred floor (3992) generation when direct binding is unavailable in strict mode', () => {
            mockService.isAvailable.mockReturnValue(false);

            const floor = areaManager.getGenuineFloor(10, 10);
            expect(floor).toBeNull();
            expect(areaManager.inferredFloorCount).toBe(0);
        });

        it('AreaStateManager records genuine floor telemetry in strict mode when direct binding succeeds', () => {
            const floor = areaManager.getGenuineFloor(10, 10);
            expect(floor).not.toBeNull();
            expect(floor.isGenuine).toBe(true);
            expect(areaManager.lastFloorMethod).toBe('SHIM_DIRECT');
            expect(areaManager.genuineFloorCount).toBe(1);
            expect(areaManager.inferredFloorCount).toBe(0);
            expect(areaManager.lastFloorSync.typ).toBe(25);
        });

        it('syncPlayerFeetFloor populates cell.bottom with genuine floor and getFocusCameraTiles renders it in strict mode', () => {
            areaManager.updatePlayerPosition(10, 10);
            areaManager.syncPlayerFeetFloor();

            const cell = areaManager.grid[10][10];
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.isGenuine).toBe(true);
            expect(cell.bottom.rawGlyph).toBe(3992);

            const tiles = areaManager.getFocusCameraTiles(0, 0);
            expect(tiles.length).toBe(1);
            expect(tiles[0].bottomGlyph).toBe(3992);
            expect(tiles[0].renderGlyphs).toContain(3992);
        });
    });

    describe('Fallback Mode Verification (Shim Bypass)', () => {
        beforeEach(() => {
            gkl.setDirectBindingMode('fallback');
        });

        it('WasmDirectBindingService.isAvailable returns false in fallback mode', () => {
            const realService = new WasmDirectBindingService({ mode: 'fallback' });
            expect(realService.isAvailable()).toBe(false);
        });

        it('AreaStateManager generates inferred floor (3992) in fallback mode and records telemetry', () => {
            const floor = areaManager.getGenuineFloor(10, 10);
            expect(floor).not.toBeNull();
            expect(floor.inferred).toBe(true);
            expect(floor.glyph).toBe(3992);
            expect(areaManager.lastFloorMethod).toBe('INFERRED_FALLBACK');
            expect(areaManager.inferredFloorCount).toBe(1);
            expect(areaManager.genuineFloorCount).toBe(0);
        });

        it('GKLPlugin.syncInventorySilent falls back to querySequenceSilent in fallback mode', async () => {
            mockCore.querySequenceSilent.mockResolvedValueOnce([
                {
                    menuItems: [{ letter: 'z', rawStr: 'z - a potion of healing', glyph: 300 }]
                }
            ]);

            const result = await gkl.syncInventorySilent();
            expect(result).toBe(true);
            expect(mockCore.querySequenceSilent).toHaveBeenCalled();
            expect(gkl.silentSyncTracker.macroCount).toBe(1);
            expect(gkl.silentSyncTracker.recentHistory[0].method).toBe('MACRO');
        });
    });

    describe('DebugInspector Broadcast & Mode Command Handling', () => {
        let inspector;
        let postedMessages;

        beforeEach(() => {
            postedMessages = [];
            globalThis.BroadcastChannel = class {
                constructor(name) {
                    this.name = name;
                    this.onmessage = null;
                }
                postMessage(msg) {
                    postedMessages.push(msg);
                }
            };

            inspector = new DebugInspector(mockCore, { autoStart: true });
        });

        it('broadcastState includes directBindingStatus with current mode and counters', () => {
            invManager.syncFromDirectBinding();
            areaManager.getGenuineFloor(10, 10);

            const snapshot = inspector.broadcastState();

            expect(snapshot.directBindingStatus).toBeDefined();
            expect(snapshot.directBindingStatus.mode).toBe('auto');
            expect(snapshot.directBindingStatus.inventoryLastSync.method).toBe('SHIM');
            expect(snapshot.directBindingStatus.floorStatus.method).toBe('SHIM_DIRECT');
            expect(snapshot.directBindingStatus.stats.shimInvCount).toBe(1);
            expect(snapshot.directBindingStatus.stats.genuineFloorCount).toBe(1);

            const lastPost = postedMessages[postedMessages.length - 1];
            expect(lastPost.type).toBe('INSPECTOR_STATE_SNAPSHOT');
            expect(lastPost.snapshot.directBindingStatus.mode).toBe('auto');
        });

        it('handles SET_DIRECT_BINDING_MODE console command and updates GKL mode in real time', () => {
            inspector._handleConsoleMessage({
                data: { type: 'SET_DIRECT_BINDING_MODE', mode: 'strict' }
            });

            expect(gkl.directBindingMode).toBe('strict');
            expect(mockCore.config.directBindingMode).toBe('strict');

            const lastPost = postedMessages[postedMessages.length - 1];
            expect(lastPost.type).toBe('INSPECTOR_STATE_SNAPSHOT');
            expect(lastPost.snapshot.directBindingStatus.mode).toBe('strict');
        });
    });
});
