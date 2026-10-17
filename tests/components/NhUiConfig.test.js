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
    expect(el.getConfig().hudFadeDelay).toBe(2500);
  });

  it('setLanguage() で英語 ⇔ 日本語のラベルおよびボタンが切り替わること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    // 初期状態 (ja)
    const modernBtn = el.shadowRoot.querySelector(`[data-preset="${PRESETS.MODERN}"]`);
    expect(modernBtn.textContent).toContain('モダン');

    // 英語切り替え
    el.setLanguage('en');
    expect(el.currentLanguage).toBe('en');
    const modernBtnEn = el.shadowRoot.querySelector(`[data-preset="${PRESETS.MODERN}"]`);
    expect(modernBtnEn.textContent).toContain('Modern');

    const resetBtnEn = el.shadowRoot.querySelector('.btn-reset-defaults');
    expect(resetBtnEn.textContent).toBe('Reset to Defaults');

    // 日本語復帰
    el.setLanguage('ja');
    expect(el.currentLanguage).toBe('ja');
    const modernBtnJa = el.shadowRoot.querySelector(`[data-preset="${PRESETS.MODERN}"]`);
    expect(modernBtnJa.textContent).toContain('モダン');
  });

  it('hudFadeDelay セレクトボックスを変更すると UIConfigStore が更新されること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    const changeSpy = vi.fn();
    el.addEventListener('config-change', changeSpy);

    const select = el.shadowRoot.querySelector('select[data-config-key="hudFadeDelay"]');
    expect(select).toBeDefined();

    select.value = '1200';
    select.dispatchEvent({ type: 'change' });

    expect(changeSpy).toHaveBeenCalled();
    expect(el.getConfig().hudFadeDelay).toBe(1200);
  });

  it('guideAssistanceMode セレクトボックスを変更すると 3段階モードが更新され、解説文が切り替わること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    const changeSpy = vi.fn();
    el.addEventListener('config-change', changeSpy);

    const select = el.shadowRoot.querySelector('select[data-config-key="guideAssistanceMode"]');
    const descEl = el.shadowRoot.querySelector('#guide-mode-desc');
    expect(select).not.toBeNull();
    expect(descEl).not.toBeNull();

    // 初期状態: VETERAN (標準)
    expect(select.value).toBe('VETERAN');
    expect(descEl.textContent).toContain('手帳登録されたアイテムのみ');

    // 1. SAGE_GUIDE (賢者の知恵) へ変更
    select.value = 'SAGE_GUIDE';
    select.dispatchEvent({ type: 'change' });

    expect(el.getConfig().guideAssistanceMode).toBe('SAGE_GUIDE');
    expect(el.getConfig().oracleGuideAlwaysUnlocked).toBe(true);
    expect(descEl.textContent).toContain('初見の未知アイテムであっても真名や効果を自由に透視可能');

    // 2. STOIC (ストイック) へ変更
    select.value = 'STOIC';
    select.dispatchEvent({ type: 'change' });

    expect(el.getConfig().guideAssistanceMode).toBe('STOIC');
    expect(el.getConfig().oracleGuideAlwaysUnlocked).toBe(false);
    expect(descEl.textContent).toContain('透視機能 (Peek) を完全に無効化');
  });

  it('mapActionIndicator, stoneRenderingMode, panelDirectionPad がUI操作で正しく更新されること', () => {
    const el = new NhUiConfig();
    el.connectedCallback();

    const changeSpy = vi.fn();
    el.addEventListener('config-change', changeSpy);

    const cbDpad = el.shadowRoot.querySelector('input[data-config-key="panelDirectionPad"]');
    const cbMap = el.shadowRoot.querySelector('input[data-config-key="mapActionIndicator"]');
    const selStone = el.shadowRoot.querySelector('select[data-config-key="stoneRenderingMode"]');

    expect(cbDpad).not.toBeNull();
    expect(cbMap).not.toBeNull();
    expect(selStone).not.toBeNull();

    expect(cbDpad.checked).toBe(true);
    expect(cbMap.checked).toBe(true);
    expect(selStone.value).toBe('smart');

    // トグル操作
    cbDpad.checked = false;
    cbDpad.dispatchEvent({ type: 'change' });
    expect(el.getConfig().panelDirectionPad).toBe(false);

    cbMap.checked = false;
    cbMap.dispatchEvent({ type: 'change' });
    expect(el.getConfig().mapActionIndicator).toBe(false);

    selStone.value = 'minimal';
    selStone.dispatchEvent({ type: 'change' });
    expect(el.getConfig().stoneRenderingMode).toBe('minimal');
  });
});
