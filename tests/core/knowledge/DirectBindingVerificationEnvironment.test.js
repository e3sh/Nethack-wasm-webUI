import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WasmDirectBindingService } from '../../../src/core/knowledge/services/WasmDirectBindingService.js';
import { InventoryStateManager } from '../../../src/core/knowledge/state/InventoryStateManager.js';
import { AreaStateManager } from '../../../src/core/knowledge/state/AreaStateManager.js';
import { GKLPlugin } from '../../../src/core/knowledge/GKLPlugin.js';
import { DebugInspector } from '../../../src/core/inspector/DebugInspector.js';

describe('DirectBinding Native Architecture & Sync Barrier Verification', () => {
    let mockService;
    let invManager;
    let areaManager;
    let mockCore;
    let gkl;

    beforeEach(() => {
        mockService = {
            _mode: 'native',
            mode: 'native',
            setMode: vi.fn(),
            isAvailable: vi.fn(() => true),
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
            getEngravingAt: vi.fn(() => null),
            _cachedLevelGlyphs: new Int32Array(80 * 24).fill(3992)
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

    describe('DirectBinding Native Guarantee (Zero Fallback Mode)', () => {
        it('ensures all components remain in native mode regardless of setDirectBindingMode calls', () => {
            expect(gkl.directBindingMode).toBe('native');
            expect(invManager.directBindingMode).toBe('native');
            expect(areaManager.directBindingMode).toBe('native');

            // どのモード文字列を渡しても Native を維持 (フォールバック機能の完全撤廃)
            gkl.setDirectBindingMode('strict');
            expect(gkl.directBindingMode).toBe('native');
            expect(invManager.directBindingMode).toBe('native');
            expect(areaManager.directBindingMode).toBe('native');

            gkl.setDirectBindingMode('fallback');
            expect(gkl.directBindingMode).toBe('native');
            expect(invManager.directBindingMode).toBe('native');
            expect(areaManager.directBindingMode).toBe('native');

            gkl.setDirectBindingMode('auto');
            expect(gkl.directBindingMode).toBe('native');
        });
    });

    describe('Sync Barrier Rendering Gating (pendingDirtyCells)', () => {
        it('suppresses rendering during turn transition and flushes atomically on commit', () => {
            areaManager.clearDirtyCells();
            expect(areaManager.getDirtyCells().size).toBe(0);

            // Phase 1 (ACTION): ターン遷移開始
            areaManager.beginTurnTransition();
            expect(areaManager.isTurnTransitioning).toBe(true);

            // Cコアからストリーミングで print_glyph 受信
            areaManager.updateGlyph(5, 5, 3992);
            areaManager.updateGlyph(6, 5, 381);
            areaManager.markDirty(7, 5);

            // 🎯 レンダリング非遮断: isTurnTransitioning のブロックを撤廃し、ターン進行中も即時差分セルを取得可能
            expect(areaManager.getDirtyCells().size).toBe(3);
            expect(areaManager.getDirtyCells().has('5,5')).toBe(true);
            expect(areaManager.getDirtyCells().has('6,5')).toBe(true);
            expect(areaManager.getDirtyCells().has('7,5')).toBe(true);
            expect(areaManager.pendingDirtyCells.size).toBe(3);

            // Phase 4 (COMMIT): 全DirectBinding同期完了後の状態確定コミット
            areaManager.commitTurnState();
            expect(areaManager.isTurnTransitioning).toBe(false);

            // コミット後も全差分セルが dirtyCells に保持されている
            const dirty = areaManager.getDirtyCells();
            expect(dirty.size).toBe(3);
            expect(dirty.has('5,5')).toBe(true);
            expect(dirty.has('6,5')).toBe(true);
            expect(dirty.has('7,5')).toBe(true);
            expect(areaManager.pendingDirtyCells.size).toBe(0);
        });
    });

    describe('DirectBinding Native Floor Resolution & Telemetry', () => {
        it('resolves genuine floor from DirectBinding with SHIM_DIRECT telemetry', () => {
            const floor = areaManager.getGenuineFloor(10, 10);
            expect(floor).not.toBeNull();
            expect(floor.isGenuine).toBe(true);
            expect(areaManager.lastFloorMethod).toBe('SHIM_DIRECT');
            expect(areaManager.genuineFloorCount).toBe(1);
            expect(areaManager.inferredFloorCount).toBe(0);
            expect(areaManager.lastFloorSync.typ).toBe(25);
        });

        it('does NOT invent speculative floor (3992) when DirectBinding is unavailable', () => {
            mockService.isAvailable.mockReturnValue(false);

            const floor = areaManager.getGenuineFloor(10, 10);
            expect(floor).toBeNull();
            expect(areaManager.inferredFloorCount).toBe(0);
        });

        it('syncPlayerFeetFloor populates cell.bottom with genuine floor and camera renders it', () => {
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

        it('syncInventorySilent executes SHIM_DIRECT and blocks macro fallbacks', async () => {
            const result = await gkl.syncInventorySilent();
            expect(result).toBe(true);
            expect(invManager.lastSyncMethod).toBe('SHIM');
            expect(invManager.shimSyncCount).toBe(1);
            expect(mockCore.querySequenceSilent).not.toHaveBeenCalled();
            expect(gkl.silentSyncTracker.macroCount).toBe(0);
        });
    });

    describe('DebugInspector Broadcast & Native Status', () => {
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

        it('broadcastState includes directBindingStatus with native mode and counters', () => {
            invManager.syncFromDirectBinding();
            areaManager.getGenuineFloor(10, 10);

            const snapshot = inspector.broadcastState();

            expect(snapshot.directBindingStatus).toBeDefined();
            expect(snapshot.directBindingStatus.mode).toBe('native');
            expect(snapshot.directBindingStatus.inventoryLastSync.method).toBe('SHIM');
            expect(snapshot.directBindingStatus.floorStatus.method).toBe('SHIM_DIRECT');
            expect(snapshot.directBindingStatus.stats.shimInvCount).toBe(1);
            expect(snapshot.directBindingStatus.stats.genuineFloorCount).toBe(1);

            const lastPost = postedMessages[postedMessages.length - 1];
            expect(lastPost.type).toBe('INSPECTOR_STATE_SNAPSHOT');
            expect(lastPost.snapshot.directBindingStatus.mode).toBe('native');
        });

        it('ignores SET_DIRECT_BINDING_MODE console command and stays in native mode', () => {
            inspector._handleConsoleMessage({
                data: { type: 'SET_DIRECT_BINDING_MODE', mode: 'strict' }
            });

            expect(gkl.directBindingMode).toBe('native');
            const lastPost = postedMessages[postedMessages.length - 1];
            expect(lastPost.type).toBe('INSPECTOR_STATE_SNAPSHOT');
            expect(lastPost.snapshot.directBindingStatus.mode).toBe('native');
        });
    });
});
