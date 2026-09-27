import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalStackController, InputCoordinator, ROUTE_ACTIONS } from '../../src/ui-controller/index.js';

describe('InputCoordinator (Headless Input Routing)', () => {
  let modalStack;
  let coordinator;

  beforeEach(() => {
    modalStack = new ModalStackController();
    coordinator = new InputCoordinator({ modalStack });
  });

  it('グローバルショートカット (Alt+S, Ctrl+P) が正しくルーティングされること', () => {
    // Alt+S -> サイドパネルトグル
    const resPanel = coordinator.evaluateKeyDown({ key: 's', code: 'KeyS', altKey: true });
    expect(resPanel.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_PANEL);

    // Ctrl+P -> 過去ログドロワートグル
    const resHistory = coordinator.evaluateKeyDown({ key: 'p', code: 'KeyP', ctrlKey: true });
    expect(resHistory.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_HISTORY);
  });

  it('モーダルが開いている場合は ESC で CLOSE_TOP_MODAL が導出されること', () => {
    modalStack.registerModal('paperdoll', {
      isOpen: () => true,
      close: vi.fn(),
      priority: 10
    });

    const res = coordinator.evaluateKeyDown({ key: 'Escape', code: 'Escape' });
    expect(res.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);
    expect(res.payload?.modalId).toBe('paperdoll');

    // q キーでもペーパードールが閉じられる
    const resQ = coordinator.evaluateKeyDown({ key: 'q', code: 'KeyQ' });
    expect(resQ.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);

    // 通常キーはブロックされる
    const resChar = coordinator.evaluateKeyDown({ key: 'j', code: 'KeyJ' });
    expect(resChar.action).toBe(ROUTE_ACTIONS.BLOCK_INPUT);
  });

  it('モーダル内の入力欄にフォーカスがある場合は passToNative で通すこと', () => {
    modalStack.registerModal('codex', {
      isOpen: () => true,
      close: vi.fn(),
      priority: 10,
      isInputFocused: () => true
    });

    const res = coordinator.evaluateKeyDown({ key: 'a', code: 'KeyA' });
    expect(res.action).toBe(ROUTE_ACTIONS.BLOCK_INPUT);
    expect(res.payload?.passToNative).toBe(true);
  });

  it('メニューモーダル表示中の操作が正しくルーティングされること', () => {
    // 矢印下 -> SCROLL_DOWN
    const resDown = coordinator.evaluateKeyDown(
      { key: 'ArrowDown', code: 'ArrowDown' },
      { isMenuOpen: true, isTextWindowMode: false }
    );
    expect(resDown.action).toBe(ROUTE_ACTIONS.MENU_SCROLL_DOWN);

    // Enter -> SELECT
    const resEnter = coordinator.evaluateKeyDown(
      { key: 'Enter', code: 'Enter' },
      { isMenuOpen: true, isTextWindowMode: false }
    );
    expect(resEnter.action).toBe(ROUTE_ACTIONS.MENU_SELECT);

    // Escape / 0 -> CANCEL
    const resEsc = coordinator.evaluateKeyDown(
      { key: 'Escape', code: 'Escape' },
      { isMenuOpen: true, isTextWindowMode: false }
    );
    expect(resEsc.action).toBe(ROUTE_ACTIONS.MENU_CANCEL);

    // テキストウィンドウモード中の Space -> DISMISS
    const resTextSpace = coordinator.evaluateKeyDown(
      { key: ' ', code: 'Space' },
      { isMenuOpen: true, isTextWindowMode: true }
    );
    expect(resTextSpace.action).toBe(ROUTE_ACTIONS.TEXT_WINDOW_DISMISS);
  });

  it('マップ探索中の通常キーは PASSTHROUGH_GAME_KEY として渡されること', () => {
    const res = coordinator.evaluateKeyDown({
      key: 'k',
      code: 'KeyK',
      shiftKey: false,
      ctrlKey: false,
      altKey: false
    });

    expect(res.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
    expect(res.payload?.code).toBe('KeyK');
  });

  it('Tab キーでミニマップ最大化トグルが導出されること', () => {
    const res = coordinator.evaluateKeyDown({ key: 'Tab', code: 'Tab' });
    expect(res.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_MINIMAP);
  });
});
