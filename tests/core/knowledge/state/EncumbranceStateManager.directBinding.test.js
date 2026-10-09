import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EncumbranceStateManager, EncumbranceLevel } from '../../../../src/core/knowledge/state/EncumbranceStateManager.js';

describe('EncumbranceStateManager - Wasm Direct Weight Binding (Stage 8.2)', () => {
    let mockService;
    let mockStatusAccessor;
    let mockInventoryManager;
    let manager;

    beforeEach(() => {
        mockService = {
            isAvailable: vi.fn(() => true),
            getInventoryWeight: vi.fn(() => 450),
            getObjectWeight: vi.fn((ptr) => ptr === 0x1000 ? 50 : 20),
            getContainerWeight: vi.fn(() => 100)
        };

        mockStatusAccessor = {
            getStatus: vi.fn(() => ({
                stats: { str: 18, con: 18 },
                cap: 0,
                gold: { amount: 500 }
            }))
        };

        mockInventoryManager = {
            getItems: vi.fn(() => [
                { letter: 'a', name: 'long sword', onum: 25, weight: 40, rawObjPtr: 0x1000 },
                { letter: 'b', name: 'bag of holding', onum: 219, isBag: true, weight: 120, rawObjPtr: 0x2000 }
            ])
        };

        manager = new EncumbranceStateManager({
            wasmDirectBindingService: mockService,
            statusAccessor: mockStatusAccessor,
            inventoryStateManager: mockInventoryManager
        });
    });

    it('getEncumbranceState uses true inv_weight() directly when available', () => {
        // STR 18, CON 18: capacity = 25 * (18 + 18) + 50 = 950
        // mockService.getInventoryWeight() = 450
        // 450 / 950 = ~47% -> NORMAL
        const state = manager.getEncumbranceState();

        expect(mockService.getInventoryWeight).toHaveBeenCalled();
        expect(state.totalWeight).toBe(450);
        expect(state.capacity).toBe(950);
        expect(state.percentage).toBe(47);
        expect(state.level).toBe(EncumbranceLevel.NORMAL);
    });

    it('getItemWeight respects item.weight from struct obj weight(o)', () => {
        const itemWithTrueWeight = {
            letter: 'c',
            name: 'heavy stone',
            weight: 350
        };

        const wt = manager.getItemWeight(itemWithTrueWeight);
        expect(wt).toBe(350);
    });

    it('getItemWeight delegates to service getObjectWeight when item has rawObjPtr', () => {
        const itemWithPtr = {
            letter: 'a',
            name: 'unknown item',
            rawObjPtr: 0x1000
        };

        const wt = manager.getItemWeight(itemWithPtr);
        expect(mockService.getObjectWeight).toHaveBeenCalledWith(0x1000);
        expect(wt).toBe(50);
    });

    it('falls back to manual estimation when direct binding weight returns -1', () => {
        mockService.getInventoryWeight.mockReturnValue(-1);

        // 手動合算:
        // item 'a': weight 40
        // item 'b': bag of holding 未確認袋 baseWeight 15
        // gold 500: 5
        // 合計: 40 + 15 + 5 = 60
        const state = manager.getEncumbranceState();

        expect(state.totalWeight).toBe(60);
    });
});
