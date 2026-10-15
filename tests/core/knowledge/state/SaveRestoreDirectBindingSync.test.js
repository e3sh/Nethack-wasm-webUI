import { describe, it, expect, vi } from 'vitest';
import { GKLEventRouter } from '../../../../src/core/knowledge/coordinators/GKLEventRouter.js';
import { StartupFlowController } from '../../../../examples/gkl-pure-js-client/modules/startup/StartupFlowController.js';

describe('Save Restore Direct Binding Sync & Lifecycle', () => {
    it('GKLEventRouter: セーブデータ復元時 (turns > 1, core.isResumingSave=true) でも protected: true で初期同期が保護されること', async () => {
        const listeners = {};
        const mockCore = {
            on: vi.fn((evt, cb) => { listeners[evt] = cb; }),
            emit: vi.fn(),
            isResumingSave: true,
            isMorePromptActive: false,
            isTextWindowOpen: false,
            isMenuOpen: false
        };

        const mockDbs = {
            isAvailable: vi.fn(() => true),
            bridge: { callShim: vi.fn() },
            hasLiveMemory: false,
            syncFromWorkerBridge: vi.fn(async (options) => {
                expect(options.protected).toBe(true);
                expect(options.syncInventory).toBe(true);
                expect(options.syncSpells).toBe(true);
                return true;
            })
        };

        const mockPlugin = {
            setLanguage: vi.fn(),
            directBindingMode: 'auto',
            wasmDirectBindingService: mockDbs,
            inventoryStateManager: { isSynced: false, isDirectBindingAvailable: true, syncFromDirectBinding: vi.fn(() => true) },
            spellStateManager: { isSynced: false, syncFromDirectBinding: vi.fn(() => true) },
            attributeStateManager: { syncFromDirectBinding: vi.fn(() => false) },
            skillStateManager: { syncFromDirectBinding: vi.fn(() => false) },
            areaStateManager: { playerX: 10, playerY: 10, commitTurnState: vi.fn(), getAreaState: vi.fn(() => ({ grid: [] })), syncFromDirectBinding: vi.fn() },
            statusAccessor: { turns: 150 } // 50ターン以上のセーブデータ
        };

        const router = new GKLEventRouter(mockPlugin);
        router.attach(mockCore);

        expect(listeners['inputRequired']).toBeDefined();

        // 最初の POSKEY 入力要求（セーブ復帰直後）
        await listeners['inputRequired']({
            context: 'poskey',
            isTopLevelTurn: true,
            category: 'POSKEY'
        });

        expect(mockDbs.syncFromWorkerBridge).toHaveBeenCalled();
        const callArgs = mockDbs.syncFromWorkerBridge.mock.calls[0][0];
        expect(callArgs.protected).toBe(true);
        expect(callArgs.syncSpells).toBe(true);
    });

    it('StartupFlowController.completeStartup: sendKey("r") [Ctrl-R] を送信せず、flushCommittedArea を呼び出し isSaveResuming をリセットすること', () => {
        const mockCore = {
            sendKey: vi.fn(),
            isResumingSave: true,
            statusAccessor: { getStatus: vi.fn(() => ({ hp: 16, turns: 100 })) }
        };
        const mockRenderer = {
            flushCommittedArea: vi.fn()
        };
        const mockStatusView = {
            updateStatus: vi.fn()
        };
        const mockClient = {
            core: mockCore,
            isStartingUp: true,
            isSaveResuming: true,
            startupStep: 'READY',
            statusView: mockStatusView,
            mainViewportRenderer: mockRenderer,
            renderGklUi: vi.fn()
        };

        const controller = new StartupFlowController(mockClient);
        controller.isStartingUp = true;
        controller.isSaveResuming = true;
        controller.startupStep = 'READY';

        // completeStartup 呼び出し
        vi.useFakeTimers();
        controller.completeStartup(' ');
        vi.advanceTimersByTime(100);

        // 1. sendKey('r') [Ctrl-R] は送信されていないこと
        expect(mockCore.sendKey).not.toHaveBeenCalledWith('r', expect.anything(), true, expect.anything(), expect.anything(), expect.anything());
        expect(mockCore.sendKey).not.toHaveBeenCalledWith('r');

        // 2. レンダラーの直接フラッシュが呼ばれていること
        expect(mockRenderer.flushCommittedArea).toHaveBeenCalled();

        // 3. isSaveResuming が解除されていること
        expect(controller.isSaveResuming).toBe(false);
        expect(mockClient.isSaveResuming).toBe(false);
        expect(mockCore.isResumingSave).toBe(false);

        vi.useRealTimers();
    });

    it('AreaStateManager & DungeonLandmarkRegistry: セーブ復帰時に別階層・別ブランチで地形描画後にフロアキーが確定してもグリッドが破棄されないこと', () => {
        const { AreaStateManager } = require('../../../../src/core/knowledge/state/AreaStateManager.js');
        const asm = new AreaStateManager();

        // 1. セーブ復帰開始: clear_nhwindow 受信
        asm.prepareFloorTransition();

        // 2. docrt() による記憶マップ描画 (print_glyph)
        asm.grid[5][10] = { bottom: { type: 'floor', symbol: '.' } };
        expect(asm.grid[5][10]).not.toBeNull();

        // 3. ステータス行から仮フロアキー "Dlvl:3" を受信
        asm.setCurrentFloor('Dlvl:3');
        expect(asm.currentFloor).toBe('Dlvl:3');
        // グリッドは消えていないこと
        expect(asm.grid[5][10]).not.toBeNull();

        // 4. Direct Binding (Sync Barrier) で真のブランチ "mines:3" が確定
        const summaryResult = asm.syncPlayerSummary({
            dnum: 1,
            dlevel: 3,
            branchId: 'mines',
            branchName: 'The Gnomish Mines',
            branchNameJa: 'ノームの鉱山',
            floorKey: 'mines:3'
        });

        expect(summaryResult.floorKey).toBe('mines:3');
        expect(asm.currentFloor).toBe('mines:3');
        // 【最重要】DirectBinding確定時でもグリッドが破棄されず保持されていること！
        expect(asm.grid[5][10]).not.toBeNull();
        expect(asm.grid[5][10].bottom.symbol).toBe('.');
    });
});

