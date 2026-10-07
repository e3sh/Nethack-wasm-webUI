/**
 * NhModal.test.js
 *
 * <nh-modal> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhModal } from '../../src/components/NhModal.js';
import { ModalStackController } from '../../src/ui-controller/ModalStackController.js';

describe('NhModal (<nh-modal>)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('初期状態では open 属性がなく、showModal() / close() で開閉状態がトグルすること', () => {
    const modal = new NhModal();
    modal.connectedCallback();

    expect(modal.open).toBe(false);
    expect(modal.hasAttribute('open')).toBe(false);

    modal.showModal();
    expect(modal.open).toBe(true);
    expect(modal.hasAttribute('open')).toBe(true);

    modal.close();
    expect(modal.open).toBe(false);
    expect(modal.hasAttribute('open')).toBe(false);
  });

  it('ModalStackController と連携し、closeTopModal() で正しく閉じること', () => {
    const stack = new ModalStackController();
    const modal = new NhModal();
    modal.setAttribute('modal-id', 'testModal');
    modal.priority = 10;
    modal.setModalStack(stack);
    modal.connectedCallback();

    modal.showModal();
    expect(modal.open).toBe(true);
    expect(stack.hasOpenModal()).toBe(true);
    expect(stack.getTopModal().id).toBe('testModal');

    // 最前面モーダルを閉じる
    const closed = stack.closeTopModal();
    expect(closed).toBe(true);
    expect(modal.open).toBe(false);
    expect(stack.hasOpenModal()).toBe(false);
  });

  it('閉じるボタンのクリックでモーダルが閉じること', () => {
    const modal = new NhModal();
    modal.connectedCallback();
    modal.showModal();
    expect(modal.open).toBe(true);

    const closeBtn = modal.shadowRoot.querySelector('.modal-close-btn');
    expect(closeBtn).toBeDefined();
    closeBtn.click();

    expect(modal.open).toBe(false);
  });

  it('disconnectedCallback 時に ModalStackController から登録解除されること', () => {
    const stack = new ModalStackController();
    const modal = new NhModal();
    modal.setAttribute('modal-id', 'cleanupModal');
    modal.setModalStack(stack);
    modal.connectedCallback();

    modal.showModal();
    expect(stack.hasOpenModal()).toBe(true);

    modal.disconnectedCallback();
    expect(stack.hasOpenModal()).toBe(false);
  });

  it('navigateFocus() で要素間を循環フォーカス移動できること', () => {
    const modal = new NhModal();
    modal.connectedCallback();
    modal.showModal();

    const btn1 = { focus: vi.fn() };
    const btn2 = { focus: vi.fn() };
    vi.spyOn(modal, '_getFocusableElements').mockReturnValue([btn1, btn2]);

    // 初期未フォーカスから next で先頭 (btn1) へ
    expect(modal.navigateFocus('next')).toBe(true);
    expect(btn1.focus).toHaveBeenCalled();

    // 次へ (btn2)
    modal.shadowRoot.activeElement = btn1;
    expect(modal.navigateFocus('next')).toBe(true);
    expect(btn2.focus).toHaveBeenCalled();

    // prev で末尾 (btn2) へ
    modal.shadowRoot.activeElement = null;
    expect(modal.navigateFocus('prev')).toBe(true);
    expect(btn2.focus).toHaveBeenCalled();
  });

  it('submitFocused() で現在フォーカス中の要素または主要ボタンを実行できること', () => {
    const modal = new NhModal();
    modal.connectedCallback();
    modal.showModal();

    const clickSpy = vi.fn();
    const btn = { click: clickSpy };
    vi.spyOn(modal, '_getFocusableElements').mockReturnValue([btn]);
    modal.shadowRoot.activeElement = btn;

    const executed = modal.submitFocused();
    expect(executed).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('矢印キー (ArrowDown / ArrowUp) で navigateFocus が呼び出されること', () => {
    const modal = new NhModal();
    modal.connectedCallback();
    modal.showModal();

    const navSpy = vi.spyOn(modal, 'navigateFocus');

    modal._handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() });
    expect(navSpy).toHaveBeenCalledWith('next');

    modal._handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() });
    expect(navSpy).toHaveBeenCalledWith('prev');
  });
});
