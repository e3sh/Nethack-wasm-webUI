/**
 * NhBaseElement.test.js
 *
 * Web Components 基底クラス NhBaseElement の単体テスト。
 * - Shadow DOM の生成
 * - ライフサイクル（connected, disconnected）
 * - コントローラー自動購読および自動アンサブスクライブ
 * - イベントディスパッチ (emit)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhBaseElement } from '../../src/components/NhBaseElement.js';

describe('NhBaseElement (Web Components 基底クラス)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('インスタンス化時に Shadow DOM を初期化すること', () => {
    const el = new NhBaseElement();
    expect(el.shadowRoot).toBeDefined();
    expect(el.shadowRoot.mode).toBe('open');
  });

  it('connectedCallback 実行時に render が呼び出され、スタイルが適用されること', () => {
    const el = new NhBaseElement({ customCss: ':host { color: red; }' });
    const renderSpy = vi.spyOn(el, 'render');

    el.connectedCallback();
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // 2回目の呼び出しでは二重初期化されないこと
    el.connectedCallback();
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('subscribeController で登録した購読が disconnectedCallback 時に自動解除されること', () => {
    const el = new NhBaseElement();
    const unsubMock = vi.fn();
    const dummyController = {
      subscribe: vi.fn(() => unsubMock)
    };

    const cb = vi.fn();
    el.subscribeController(dummyController, cb);

    expect(dummyController.subscribe).toHaveBeenCalledWith(cb);
    expect(unsubMock).not.toHaveBeenCalled();

    // 切断時のクリーンアップ
    el.disconnectedCallback();
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('emit() で bubbles: true, composed: true のカスタムイベントを発行すること', () => {
    const el = new NhBaseElement();
    const dispatchSpy = vi.spyOn(el, 'dispatchEvent');

    el.emit('custom-test', { value: 123 });

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0];
    expect(event.type).toBe('custom-test');
    expect(event.detail).toEqual({ value: 123 });
    expect(event.bubbles).toBe(true);
    expect(event.composed).toBe(true);
  });
});
