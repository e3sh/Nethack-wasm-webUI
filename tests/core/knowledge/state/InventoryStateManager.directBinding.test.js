import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryStateManager } from '../../../../src/core/knowledge/state/InventoryStateManager.js';

describe('InventoryStateManager - Wasm Direct Binding (Stage 8.2)', () => {
    let mockService;
    let manager;

    beforeEach(() => {
        mockService = {
            isAvailable: vi.fn(() => true),
            getInventory: vi.fn(),
            getEquipmentPtrs: vi.fn(),
            getInventoryWeight: vi.fn(() => 450)
        };

        manager = new InventoryStateManager({
            wasmDirectBindingService: mockService,
            language: 'en'
        });
    });

    it('syncFromDirectBinding populates inventory items with 100% accurate equipment slots', () => {
        const item1Ptr = 0x1000;
        const item2Ptr = 0x2000;
        const item3Ptr = 0x3000;
        const item4Ptr = 0x4000;

        mockService.getInventory.mockReturnValue([
            {
                ptr: item1Ptr,
                rawObjPtr: item1Ptr,
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
            },
            {
                ptr: item2Ptr,
                rawObjPtr: item2Ptr,
                otyp: 150,
                onum: 150,
                owt: 300,
                quan: 1,
                spe: 0,
                oclass: 2,
                invlet: 'b',
                flags: { blessed: false, cursed: false, bknown: true, dknown: true },
                weight: 300,
                cobjPtr: 0,
                o_id: 102
            },
            {
                ptr: item3Ptr,
                rawObjPtr: item3Ptr,
                otyp: 219, // bag of holding
                onum: 219,
                owt: 15,
                quan: 1,
                spe: 0,
                oclass: 7,
                invlet: 'c',
                flags: { blessed: true, cursed: false, bknown: true, dknown: true },
                weight: 120,
                cobjPtr: 0x9999,
                o_id: 103
            },
            {
                ptr: item4Ptr,
                rawObjPtr: item4Ptr,
                otyp: 180, // ring
                onum: 180,
                owt: 3,
                quan: 1,
                spe: 2,
                oclass: 5,
                invlet: 'd',
                flags: { blessed: false, cursed: false, bknown: true, dknown: true },
                weight: 3,
                cobjPtr: 0,
                o_id: 104
            }
        ]);

        const slotByPtr = new Map();
        slotByPtr.set(item1Ptr, 'weapon');
        slotByPtr.set(item2Ptr, 'suit');
        slotByPtr.set(item4Ptr, 'ring_left');

        mockService.getEquipmentPtrs.mockReturnValue({
            rawPtrs: { uwep: item1Ptr, uarm: item2Ptr, uleft: item4Ptr },
            slotByPtr,
            ptrBySlot: new Map([['weapon', item1Ptr], ['suit', item2Ptr], ['ring_left', item4Ptr]])
        });

        const changed = manager.syncFromDirectBinding();

        expect(changed).toBe(true);
        expect(manager.isSynced).toBe(true);

        const items = manager.getItems();
        expect(items).toHaveLength(4);

        // 1. メイン武器
        const item1 = items.find(i => i.letter === 'a');
        expect(item1).toBeDefined();
        expect(item1.onum).toBe(25);
        expect(item1.rawObjPtr).toBe(item1Ptr);
        expect(item1.isWielded).toBe(true);
        expect(item1.isOffhand).toBe(false);
        expect(item1.equipSlot).toBe('weapon');
        expect(item1.weight).toBe(40);

        // 2. 鎧
        const item2 = items.find(i => i.letter === 'b');
        expect(item2).toBeDefined();
        expect(item2.onum).toBe(150);
        expect(item2.isWorn).toBe(true);
        expect(item2.isWielded).toBe(false);
        expect(item2.equipSlot).toBe('suit');

        // 3. コンテナ (Bag of Holding)
        const item3 = items.find(i => i.letter === 'c');
        expect(item3).toBeDefined();
        expect(item3.onum).toBe(219);
        expect(item3.cobjPtr).toBe(0x9999);
        expect(item3.isBag).toBe(true);
        expect(item3.weight).toBe(120);

        // 4. 左手指輪
        const item4 = items.find(i => i.letter === 'd');
        expect(item4).toBeDefined();
        expect(item4.onum).toBe(180);
        expect(item4.isWorn).toBe(true);
        expect(item4.equipSlot).toBe('ring_left');

        // 再度同期実行 -> 差分なしのため false が返ること
        const changedAgain = manager.syncFromDirectBinding();
        expect(changedAgain).toBe(false);
    });

    it('sync() delegates to syncFromDirectBinding when direct binding is available', () => {
        vi.spyOn(manager, 'syncFromDirectBinding').mockReturnValue(true);

        expect(manager.isDirectBindingAvailable).toBe(true);
        const res = manager.sync();
        expect(res).toBe(true);
        expect(manager.syncFromDirectBinding).toHaveBeenCalled();
    });

    it('syncFromDirectBinding returns false when service is not available', () => {
        mockService.isAvailable.mockReturnValue(false);
        const res = manager.syncFromDirectBinding();
        expect(res).toBe(false);
    });
});
