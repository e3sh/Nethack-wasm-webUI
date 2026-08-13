import { describe, it, expect } from 'vitest';
import { InventoryStateManager } from './InventoryStateManager.js';

describe('InventoryStateManager', () => {
    it('インベントリテキスト行から所持品アイテムが更新・抽出できること', () => {
        const manager = new InventoryStateManager();
        const lines = [
            "Weapons",
            "a - a blessed +1 dagger (weapon in hand)",
            "Armor",
            "b - an uncursed +0 leather armor (being worn)"
        ];

        manager.updateFromLines(lines);
        const items = manager.items;

        expect(items).toBeDefined();
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);
    });
});
