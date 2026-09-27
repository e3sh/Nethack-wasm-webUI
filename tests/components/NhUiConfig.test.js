/**
 * NhUiConfig.test.js
 *
 * <nh-ui-config> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhUiConfig } from '../../src/components/NhUiConfig.js';
import { PRESETS } from '../../src/ui-controller/UIConfigStore.js';

describe('NhUiConfig (<nh-ui-config>)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('connectedCallback 時にプリセットボタンや設定トグルが初期化されること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    const presetBtns = el.shadowRoot.querySelectorAll('.preset-btn');
    expect(presetBtns.length).toBe(3);

    const toggles = el.shadowRoot.querySelectorAll('input[type="checkbox"]');
    expect(toggles.length).toBeGreaterThan(0);
  });

  it('プリセットボタンをクリックするとプリセットが適用され、イベントが発火すること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    const presetSpy = vi.fn();
    el.addEventListener('preset-change', presetSpy);

    const classicBtn = el.shadowRoot.querySelector(`[data-preset="${PRESETS.CLASSIC}"]`);
    expect(classicBtn).toBeDefined();
    classicBtn.click();

    expect(presetSpy).toHaveBeenCalledTimes(1);
    expect(el.getConfig().preset).toBe(PRESETS.CLASSIC);
    expect(classicBtn.classList.contains('active')).toBe(true);
  });

  it('トグルスイッチを変更すると UIConfigStore が更新され、config-change イベントが発火すること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    const changeSpy = vi.fn();
    el.addEventListener('config-change', changeSpy);

    const checkbox = el.shadowRoot.querySelector('[data-config-key="panelInventory"]');
    expect(checkbox).toBeDefined();

    // トグル操作
    checkbox.checked = false;
    checkbox.dispatchEvent({ type: 'change' });

    expect(changeSpy).toHaveBeenCalled();
    expect(el.getConfig().panelInventory).toBe(false);
  });

  it('resetDefaults() でデフォルト設定にリセットされること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    el.setConfig('panelInventory', false);
    expect(el.getConfig().panelInventory).toBe(false);

    el.resetDefaults();
    expect(el.getConfig().panelInventory).toBe(true);
  });
});
