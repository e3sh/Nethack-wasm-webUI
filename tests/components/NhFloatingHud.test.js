/**
 * NhFloatingHud.test.js
 *
 * <nh-floating-hud> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhFloatingHud } from '../../src/components/NhFloatingHud.js';

describe('NhFloatingHud (<nh-floating-hud>)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('connectedCallback 時にコンテナ要素が初期化されること', () => {
    const el = new NhFloatingHud();
    el.connectedCallback();

    const container = el.shadowRoot.querySelector('.hud-container');
    expect(container).toBeDefined();
  });

  it('pushMessage でメッセージ行が Shadow DOM 内に追加され、世代クラスが付与されること', () => {
    const el = new NhFloatingHud();
    el.connectedCallback();

    el.pushMessage({ id: 1, text: 'Hello NetHack!' });
    let lines = el.shadowRoot.querySelectorAll('.floating-message-line');
    expect(lines.length).toBe(1);
    expect(lines[0].textContent).toBe('Hello NetHack!');
    expect(lines[0].classList.contains('line-age-0')).toBe(true);

    el.pushMessage({ id: 2, text: 'You hear a distant rumble.', isBold: true });
    lines = el.shadowRoot.querySelectorAll('.floating-message-line');
    expect(lines.length).toBe(2);
    // 最新行 (id: 2) は age 0、前の行 (id: 1) は age 1
    expect(lines[1].textContent).toBe('You hear a distant rumble.');
    expect(lines[1].classList.contains('line-age-0')).toBe(true);
    expect(lines[1].classList.contains('bold')).toBe(true);
    expect(lines[0].classList.contains('line-age-1')).toBe(true);
  });

  it('notifyUserAction で行がフェードアウト状態へ移行すること', () => {
    const el = new NhFloatingHud();
    el.connectedCallback();

    el.pushMessage({ id: 10, text: 'Welcome to dungeon' });
    el.notifyUserAction();

    // 次のアクション通知で fading に移行
    el.notifyUserAction();
    const line = el.shadowRoot.querySelector('.floating-message-line');
    expect(line.classList.contains('fading')).toBe(true);
  });

  it('clear() で全行が Shadow DOM から削除されること', () => {
    const el = new NhFloatingHud();
    el.connectedCallback();

    el.pushMessage({ id: 101, text: 'Message 1' });
    el.pushMessage({ id: 102, text: 'Message 2' });
    expect(el.shadowRoot.querySelectorAll('.floating-message-line').length).toBe(2);

    el.clear();
    expect(el.shadowRoot.querySelectorAll('.floating-message-line').length).toBe(0);
  });
});
