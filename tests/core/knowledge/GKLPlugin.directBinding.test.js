import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GKLPlugin } from '../../../src/core/knowledge/GKLPlugin.js';

describe('GKLPlugin - Wasm Direct Binding Integration (Stage 8.2)', () => {
    let mockCore;
    let mockMemory;
    let plugin;

    beforeEach(() => {
        mockMemory = {
            bridgeCall: vi.fn(),
            allocateBuffer: vi.fn(() => 0x9000),
            freeBuffer: vi.fn(),
            readInt32Array: vi.fn(() => []),
            getValue: vi.fn(() => 0),
            Module: {
                _shim_bridge_call: vi.fn(),
                _inv_weight: vi.fn(() => 350)
            }
        };

        mockCore = {
            driver: {
                memory: mockMemory,
                getModule: () => mockMemory.Module
            },
            querySequenceSilent: vi.fn(),
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            plugins: []
        };

        plugin = new GKLPlugin();
    });

    it('attaches wasmDirectBindingService when core has driver.memory (単一スレッド環境)', () => {
        plugin.attach(mockCore);

        expect(plugin.wasmDirectBindingService).toBeDefined();
        expect(plugin.inventoryStateManager.isDirectBindingAvailable).toBe(true);
        expect(plugin.attributeStateManager.wasmDirectBindingService).toBe(plugin.wasmDirectBindingService);
        expect(plugin.encumbranceStateManager.wasmDirectBindingService).toBe(plugin.wasmDirectBindingService);
        expect(plugin.areaStateManager.directBindingService).toBe(plugin.wasmDirectBindingService);
    });

    it('attaches wasmDirectBindingService when core has WorkerBridge (Web Worker 隔離環境: driver.memory は undefined)', () => {
        const mockWorkerBridgeCore = {
            driver: {
                callShim: vi.fn(),
                // memory は undefined
            },
            querySequenceSilent: vi.fn(),
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            plugins: []
        };

        plugin.attach(mockWorkerBridgeCore);

        expect(plugin.wasmDirectBindingService).toBeDefined();
        expect(plugin.wasmDirectBindingService.bridge).toBe(mockWorkerBridgeCore.driver);
        expect(plugin.wasmDirectBindingService.isAvailable()).toBe(true);
        expect(plugin.attributeStateManager.wasmDirectBindingService).toBe(plugin.wasmDirectBindingService);
        expect(plugin.areaStateManager.directBindingService).toBe(plugin.wasmDirectBindingService);
    });

    it('syncInventorySilent completely bypasses querySequenceSilent when direct binding is available', async () => {
        plugin.attach(mockCore);

        const syncSpy = vi.spyOn(plugin.inventoryStateManager, 'syncFromDirectBinding').mockReturnValue(true);

        const res = await plugin.syncInventorySilent();

        expect(res).toBe(true);
        expect(syncSpy).toHaveBeenCalled();
        // querySequenceSilent ('i', ' ', '\x1b') が一切呼ばれていないこと (完全バイパス)
        expect(mockCore.querySequenceSilent).not.toHaveBeenCalled();
        expect(mockCore.emit).toHaveBeenCalledWith('inventoryStateUpdated', plugin.inventoryStateManager);
    });

    it('syncPendingStateSilent completely suppresses key macro transmissions when isWorkerDirect is active', async () => {
        const mockWorkerBridgeCore = {
            driver: {
                callShim: vi.fn(),
            },
            querySequenceSilent: vi.fn(),
            emit: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            plugins: []
        };

        plugin.attach(mockWorkerBridgeCore);

        // 未同期状態を作る
        plugin.inventoryStateManager.isSynced = false;
        plugin.attributeStateManager.isSynced = false;

        // isWorkerDirect の場合、hasPendingSync() は false を返し、マクロ送信を要求しないこと
        expect(plugin.hasPendingSync()).toBe(false);

        // syncPendingStateSilent() を呼び出しても、querySequenceSilent などのマクロキー送信が走らないこと
        const result = await plugin.syncPendingStateSilent();
        expect(result).toBe(false);
        expect(mockWorkerBridgeCore.querySequenceSilent).not.toHaveBeenCalled();
    });

    it('syncAttributesSilent completely bypasses querySequenceSilent when direct binding is available', async () => {
        plugin.attach(mockCore);
        const attrSpy = vi.spyOn(plugin.attributeStateManager, 'syncFromDirectBinding').mockReturnValue(true);

        const res = await plugin.syncAttributesSilent();

        expect(res).toBe(true);
        expect(attrSpy).toHaveBeenCalled();
        // querySequenceSilent ('\x18', ' ', '\x1b') が一切呼ばれていないこと (完全バイパス)
        expect(mockCore.querySequenceSilent).not.toHaveBeenCalled();
        expect(mockCore.emit).toHaveBeenCalledWith('attributesStateUpdated', plugin.attributeStateManager);
    });

    it('syncSkillsSilent completely bypasses querySequenceSilent when direct binding is available', async () => {
        plugin.attach(mockCore);
        const skillSpy = vi.spyOn(plugin.skillStateManager, 'syncFromDirectBinding').mockReturnValue(true);

        const res = await plugin.syncSkillsSilent();

        expect(res).toBe(true);
        expect(skillSpy).toHaveBeenCalled();
        // querySequenceSilent ('#', 'enhance', ' ', '\x1b') が一切呼ばれていないこと (完全バイパス)
        expect(mockCore.querySequenceSilent).not.toHaveBeenCalled();
        expect(mockCore.emit).toHaveBeenCalledWith('skillsStateUpdated', plugin.skillStateManager);
    });

    it('on-demand sync methods (syncAttributesOnDemand, syncSkillsOnDemand, syncDiscoveriesOnDemand) work correctly', async () => {
        plugin.attach(mockCore);
        vi.spyOn(plugin.attributeStateManager, 'syncFromDirectBinding').mockReturnValue(true);
        vi.spyOn(plugin.skillStateManager, 'syncFromDirectBinding').mockReturnValue(true);
        vi.spyOn(plugin.discoveryStateManager, 'syncWithLiveMemory').mockReturnValue(true);

        const attrOk = await plugin.syncAttributesOnDemand();
        expect(attrOk).toBe(true);
        expect(mockCore.emit).toHaveBeenCalledWith('attributesStateUpdated', plugin.attributeStateManager);

        const skillOk = await plugin.syncSkillsOnDemand();
        expect(skillOk).toBe(true);
        expect(mockCore.emit).toHaveBeenCalledWith('skillsStateUpdated', plugin.skillStateManager);

        const discOk = await plugin.syncDiscoveriesOnDemand();
        expect(discOk).toBe(true);
        expect(mockCore.emit).toHaveBeenCalledWith('discoveriesStateUpdated', plugin.discoveryStateManager);
    });
});

