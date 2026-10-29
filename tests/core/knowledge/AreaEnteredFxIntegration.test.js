import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GKLPlugin } from '../../../src/core/knowledge/GKLPlugin.js';
import { GKLFxCoordinator } from '../../../src/core/knowledge/coordinators/GKLFxCoordinator.js';
import {
    computeAreaBannerAlpha,
    AREA_BANNER_THEMES,
    drawAreaBanner
} from '../../../examples/gkl-pure-js-client/modules/renderers/fx/drawAreaBanner.js';

function createMockCore() {
    const listeners = new Map();
    return {
        driver: {
            memory: {
                bridgeCall: vi.fn(),
                allocateBuffer: vi.fn(() => 0x9000),
                freeBuffer: vi.fn(),
                readUint8Array: vi.fn(() => new Uint8Array(80 * 21)),
                readInt32Array: vi.fn(() => new Int32Array(80 * 21)),
                Module: { _shim_bridge_call: vi.fn() }
            }
        },
        on: (event, fn) => {
            if (!listeners.has(event)) listeners.set(event, []);
            listeners.get(event).push(fn);
        },
        off: (event, fn) => {
            if (listeners.has(event)) {
                listeners.set(event, listeners.get(event).filter(cb => cb !== fn));
            }
        },
        emit: (event, payload) => {
            if (listeners.has(event)) {
                listeners.get(event).forEach(fn => fn(payload));
            }
        },
        querySequenceSilent: vi.fn().mockResolvedValue([])
    };
}

describe('AREA_ENTERED & areaEntered Integration Tests', () => {
    let plugin;
    let mockCore;

    beforeEach(() => {
        plugin = new GKLPlugin();
        mockCore = createMockCore();
        plugin.attach(mockCore);
    });

    describe('GKLEventRouter & GKLFxCoordinator Area Trigger Pipeline', () => {
        it('emits areaEntered and fx_trigger (AREA_ENTERED) when entering a new branch', () => {
            const areaEnteredListener = vi.fn();
            const fxTriggerListener = vi.fn();
            mockCore.on('areaEntered', areaEnteredListener);
            mockCore.on('fx_trigger', fxTriggerListener);

            // Mock player entering The Gnomish Mines (dnum: 2, dlevel: 2)
            plugin.wasmDirectBindingService = {
                isAvailable: () => true,
                getPlayerSummary: () => ({
                    dnum: 2,
                    dlevel: 2,
                    branchId: 'mines',
                    branchName: 'The Gnomish Mines',
                    branchNameJa: 'ノームの鉱山',
                    theme: 'mines',
                    floorKey: 'mines:2',
                    moves: 100
                })
            };

            // Trigger settled inputRequired
            mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

            expect(areaEnteredListener).toHaveBeenCalledTimes(1);
            const areaInfo = areaEnteredListener.mock.calls[0][0];
            expect(areaInfo.branchId).toBe('mines');
            expect(areaInfo.isNewBranch).toBe(true);

            expect(fxTriggerListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'AREA_ENTERED',
                    branchId: 'mines',
                    floorKey: 'mines:2',
                    dlevel: 2,
                    title: 'The Gnomish Mines',
                    titleJa: 'ノームの鉱山',
                    theme: 'mines',
                    bannerDurationMs: 4000
                })
            );
        });

        it('does NOT emit AREA_ENTERED when moving floors within the same branch', () => {
            const areaEnteredListener = vi.fn();
            const fxTriggerListener = vi.fn();

            // Set current state to mines:2
            plugin.areaStateManager.currentBranchId = 'mines';
            plugin.areaStateManager.currentDnum = 2;
            plugin.areaStateManager.currentDlevel = 2;

            mockCore.on('areaEntered', areaEnteredListener);
            mockCore.on('fx_trigger', fxTriggerListener);

            // Move deeper into mines (dnum: 2, dlevel: 3)
            plugin.wasmDirectBindingService = {
                isAvailable: () => true,
                getPlayerSummary: () => ({
                    dnum: 2,
                    dlevel: 3,
                    branchId: 'mines',
                    branchName: 'The Gnomish Mines',
                    branchNameJa: 'ノームの鉱山',
                    theme: 'mines',
                    floorKey: 'mines:3',
                    moves: 150
                })
            };

            mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

            expect(areaEnteredListener).not.toHaveBeenCalled();
            expect(fxTriggerListener).not.toHaveBeenCalled();
        });

        it('emits AREA_ENTERED when returning to main dungeon from a branch', () => {
            const areaEnteredListener = vi.fn();
            const fxTriggerListener = vi.fn();

            // Set current state to mines:3
            plugin.areaStateManager.currentBranchId = 'mines';
            plugin.areaStateManager.currentDnum = 2;
            plugin.areaStateManager.currentDlevel = 3;

            mockCore.on('areaEntered', areaEnteredListener);
            mockCore.on('fx_trigger', fxTriggerListener);

            // Move back to main dungeon (dnum: 0, dlevel: 4)
            plugin.wasmDirectBindingService = {
                isAvailable: () => true,
                getPlayerSummary: () => ({
                    dnum: 0,
                    dlevel: 4,
                    branchId: 'dungeon',
                    branchName: 'Dungeon',
                    branchNameJa: 'ダンジョン',
                    theme: 'dungeon',
                    floorKey: 'Dlvl:4',
                    moves: 200
                })
            };

            mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

            expect(areaEnteredListener).toHaveBeenCalledTimes(1);
            expect(areaEnteredListener.mock.calls[0][0].branchId).toBe('dungeon');
            expect(fxTriggerListener).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'AREA_ENTERED',
                    branchId: 'dungeon',
                    titleJa: 'ダンジョン'
                })
            );
        });

        it('plugin.reset() resets area state so initial Dlvl:1 game start does not falsely emit AREA_ENTERED', () => {
            // Suppose previous game ended in mines
            plugin.areaStateManager.currentBranchId = 'mines';
            plugin.areaStateManager.currentDnum = 2;
            plugin.areaStateManager.currentDlevel = 4;

            // Call reset
            plugin.reset();

            expect(plugin.areaStateManager.currentBranchId).toBe('dungeon');
            expect(plugin.areaStateManager.currentDnum).toBe(0);
            expect(plugin.areaStateManager.currentDlevel).toBe(1);

            const areaEnteredListener = vi.fn();
            const fxTriggerListener = vi.fn();
            mockCore.on('areaEntered', areaEnteredListener);
            mockCore.on('fx_trigger', fxTriggerListener);

            // New game start on Dlvl:1
            plugin.wasmDirectBindingService = {
                isAvailable: () => true,
                getPlayerSummary: () => ({
                    dnum: 0,
                    dlevel: 1,
                    branchId: 'dungeon',
                    branchName: 'Dungeon',
                    branchNameJa: 'ダンジョン',
                    theme: 'dungeon',
                    floorKey: 'Dlvl:1',
                    moves: 1
                })
            };

            mockCore.emit('inputRequired', { category: 'POSKEY', isTopLevelTurn: true });

            // No false banner on Dlvl:1 game start
            expect(areaEnteredListener).not.toHaveBeenCalled();
            expect(fxTriggerListener).not.toHaveBeenCalled();
        });
    });

    describe('GKLFxCoordinator onAreaEntered method', () => {
        it('constructs correct AREA_ENTERED payload and invokes core.emit', () => {
            const emitSpy = vi.fn();
            const mockPlugin = {
                core: { emit: emitSpy }
            };
            const fxCoordinator = new GKLFxCoordinator(mockPlugin);

            fxCoordinator.onAreaEntered({
                branchId: 'sokoban',
                floorKey: 'sokoban:1',
                dlevel: 1,
                branchName: 'Sokoban',
                branchNameJa: '倉庫番',
                theme: 'sokoban'
            });

            expect(emitSpy).toHaveBeenCalledWith('fx_trigger', expect.objectContaining({
                type: 'AREA_ENTERED',
                branchId: 'sokoban',
                floorKey: 'sokoban:1',
                dlevel: 1,
                title: 'Sokoban',
                titleJa: '倉庫番',
                subtitle: 'Level 1',
                subtitleJa: '地下 1 階',
                theme: 'sokoban',
                bannerDurationMs: 4000
            }));
        });
    });

    describe('drawAreaBanner Renderer Module', () => {
        it('computeAreaBannerAlpha calculates correct fade-in, hold, and fade-out alpha', () => {
            // progress < 0 or > 1
            expect(computeAreaBannerAlpha(-0.1)).toBe(0);
            expect(computeAreaBannerAlpha(1.1)).toBe(0);

            // fade-in (0.0 .. 0.15)
            const alphaAtStart = computeAreaBannerAlpha(0.0);
            const alphaAtHalfFadeIn = computeAreaBannerAlpha(0.075);
            expect(alphaAtStart).toBe(0);
            expect(alphaAtHalfFadeIn).toBeGreaterThan(0);
            expect(alphaAtHalfFadeIn).toBeLessThan(1);

            // hold (0.15 .. 0.80)
            expect(computeAreaBannerAlpha(0.15)).toBe(1.0);
            expect(computeAreaBannerAlpha(0.50)).toBe(1.0);
            expect(computeAreaBannerAlpha(0.80)).toBe(1.0);

            // fade-out (0.80 .. 1.0)
            const alphaAtHalfFadeOut = computeAreaBannerAlpha(0.90);
            expect(alphaAtHalfFadeOut).toBeGreaterThan(0);
            expect(alphaAtHalfFadeOut).toBeLessThan(1);
            expect(computeAreaBannerAlpha(1.0)).toBe(0);
        });

        it('drawAreaBanner executes canvas draw operations safely without errors', () => {
            const mockCtx = {
                save: vi.fn(),
                restore: vi.fn(),
                fillRect: vi.fn(),
                strokeRect: vi.fn(),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                fillText: vi.fn(),
                createLinearGradient: vi.fn(() => ({
                    addColorStop: vi.fn()
                }))
            };

            const fx = {
                type: 'AREA_ENTERED',
                branchId: 'mines',
                title: 'The Gnomish Mines',
                titleJa: 'ノームの鉱山',
                subtitle: 'Level 2',
                subtitleJa: '地下 2 階',
                theme: 'mines'
            };

            // Call during active hold phase
            drawAreaBanner(mockCtx, fx, 800, 600, 0.5, 'ja');
            expect(mockCtx.save).toHaveBeenCalled();
            expect(mockCtx.restore).toHaveBeenCalled();
            expect(mockCtx.fillText).toHaveBeenCalledWith('ノームの鉱山', 400, expect.any(Number));

            // Call in English mode
            mockCtx.fillText.mockClear();
            drawAreaBanner(mockCtx, fx, 800, 600, 0.5, 'en');
            expect(mockCtx.fillText).toHaveBeenCalledWith('The Gnomish Mines', 400, expect.any(Number));
        });
    });
});
