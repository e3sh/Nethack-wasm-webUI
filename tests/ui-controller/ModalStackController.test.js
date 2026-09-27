import { describe, it, expect, vi } from 'vitest';
import { ModalStackController } from '../../src/ui-controller/index.js';

describe('ModalStackController (Headless Modal Stack)', () => {
  it('モーダルの登録と最前面判定が正しく行われること', () => {
    const stack = new ModalStackController();

    let isHistoryOpen = false;
    let isPaperdollOpen = false;

    stack.registerModal('historyDrawer', {
      isOpen: () => isHistoryOpen,
      close: vi.fn(() => { isHistoryOpen = false; }),
      priority: 10
    });

    stack.registerModal('paperdoll', {
      isOpen: () => isPaperdollOpen,
      close: vi.fn(() => { isPaperdollOpen = false; }),
      priority: 20
    });

    expect(stack.hasOpenModal()).toBe(false);
    expect(stack.getTopModal()).toBeNull();

    // 過去ログドロワーが開く
    isHistoryOpen = true;
    expect(stack.hasOpenModal()).toBe(true);
    expect(stack.getTopModal()?.id).toBe('historyDrawer');

    // ペーパードール（高優先度）が開く
    isPaperdollOpen = true;
    expect(stack.getTopModal()?.id).toBe('paperdoll');

    // 最前面（ペーパードール）を閉じる
    expect(stack.closeTopModal()).toBe(true);
    expect(isPaperdollOpen).toBe(false);

    // 再度最前面を取得すると過去ログドロワーになる
    expect(stack.getTopModal()?.id).toBe('historyDrawer');

    // 過去ログドロワーも閉じる
    expect(stack.closeTopModal()).toBe(true);
    expect(isHistoryOpen).toBe(false);
    expect(stack.hasOpenModal()).toBe(false);
  });

  it('モーダル内の入力フォーカス状態が正しく検知されること', () => {
    const stack = new ModalStackController();
    let isCodexOpen = true;
    let isSearchFocused = false;

    stack.registerModal('codex', {
      isOpen: () => isCodexOpen,
      close: vi.fn(),
      isInputFocused: () => isSearchFocused
    });

    expect(stack.isAnyInputFocused()).toBe(false);

    isSearchFocused = true;
    expect(stack.isAnyInputFocused()).toBe(true);

    isCodexOpen = false;
    expect(stack.isAnyInputFocused()).toBe(false);
  });
});
