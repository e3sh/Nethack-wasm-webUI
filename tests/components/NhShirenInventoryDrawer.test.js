import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NhShirenInventoryDrawer } from '../../src/components/gamepad/NhShirenInventoryDrawer.js';

describe('NhShirenInventoryDrawer ユニットテスト', () => {
    let drawer;

    beforeEach(() => {
        drawer = new NhShirenInventoryDrawer();
    });

    it('初期状態では非表示 (isOpen = false) であること', () => {
        expect(drawer.isOpen).toBe(false);
        expect(drawer.items).toEqual([]);
    });

    it('open() で open 属性が付与され、isOpen が true になること', () => {
        const mockModalStack = {
            registerModal: vi.fn(),
            unregisterModal: vi.fn()
        };
        drawer.init({ modalStack: mockModalStack });

        drawer.open();
        expect(drawer.isOpen).toBe(true);
        expect(mockModalStack.registerModal).toHaveBeenCalledWith('shirenDrawer', expect.any(Object));

        drawer.close();
        expect(drawer.isOpen).toBe(false);
        expect(mockModalStack.unregisterModal).toHaveBeenCalledWith('shirenDrawer');
    });

    it('handleGamepadNav で十字キーによる選択移動ができること', () => {
        const mockItems = [
            { id: 1, name: 'short sword', category: 'WEAPON', letter: 'a' },
            { id: 2, name: 'leather armor', category: 'ARMOR', letter: 'b' },
            { id: 3, name: 'potion of healing', category: 'POTION', letter: 'c' }
        ];
        drawer.setItems(mockItems);
        drawer.open();

        expect(drawer.selectedIndex).toBe(0);

        drawer.handleGamepadNav({ type: 'next' });
        expect(drawer.selectedIndex).toBe(1);

        drawer.handleGamepadNav({ type: 'next' });
        expect(drawer.selectedIndex).toBe(2);

        // 端で止まる
        drawer.handleGamepadNav({ type: 'next' });
        expect(drawer.selectedIndex).toBe(2);

        drawer.handleGamepadNav({ type: 'prev' });
        expect(drawer.selectedIndex).toBe(1);
    });

    it('handleGamepadNav でタブ切り替え (tabNext, tabPrev) ができること', () => {
        const mockItems = [
            { id: 1, name: 'short sword', category: 'WEAPON', letter: 'a' },
            { id: 2, name: 'potion of healing', category: 'POTION', letter: 'b' }
        ];
        drawer.setItems(mockItems);
        drawer.open();

        expect(drawer.currentTabIndex).toBe(0); // ALL

        drawer.handleGamepadNav({ type: 'tabNext' });
        expect(drawer.currentTabIndex).toBe(1); // EQUIPMENT
        expect(drawer._getFilteredItems().length).toBe(1);
        expect(drawer._getFilteredItems()[0].name).toBe('short sword');

        drawer.handleGamepadNav({ type: 'tabPrev' });
        expect(drawer.currentTabIndex).toBe(0); // ALL
    });

    it('Aボタンでサブメニューが開き、再度Aボタンでアクションが発火すること', () => {
        const mockCore = {
            sendKey: vi.fn()
        };
        drawer.init({ core: mockCore });
        drawer.setItems([
            { id: 1, name: 'potion of healing', category: 'POTION', letter: 'c' }
        ]);
        drawer.open();

        // 1回目 select: サブメニュー開く
        drawer.handleGamepadNav({ type: 'select' });
        expect(drawer.isSubmenuOpen).toBe(true);
        expect(drawer.activeActions.length).toBeGreaterThan(0);
        expect(drawer.activeActions[0].id).toBe('QUAFF');

        // 2回目 select: アクション実行＆ドロワー閉じる
        drawer.handleGamepadNav({ type: 'select' });
        expect(drawer.isOpen).toBe(false);
        expect(mockCore.sendKey).toHaveBeenCalledWith('q');
    });
});
