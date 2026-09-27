import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UIConfigStore,
  PRESETS,
  DEFAULT_LAYOUT_CONFIG,
  STORAGE_KEY_DEFAULT
} from '../../examples/gkl-pure-js-client/modules/controller/UIConfigStore.js';

describe('UIConfigStore (Headless UI Layout Config)', () => {
  let mockStorage;

  beforeEach(() => {
    const store = new Map();
    mockStorage = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => store.set(key, String(value))),
      removeItem: vi.fn((key) => store.delete(key)),
      clear: vi.fn(() => store.clear())
    };
  });

  it('デフォルト設定を正常にロードすること', () => {
    const configStore = new UIConfigStore({ storage: mockStorage });
    const config = configStore.get();

    expect(config.preset).toBe(PRESETS.MODERN);
    expect(config.panelInventory).toBe(true);
    expect(config.panelActions).toBe(true);
    expect(config.panelKnowledge).toBe(true);
    expect(config.panelHistoryDock).toBe(false);
    expect(config.panelCollapsed).toBe(false);
    expect(config.statusClassic2Line).toBe(false);
    expect(config.statusGauges).toBe(true);
    expect(config.statusGklExtra).toBe(true);
  });

  it('ストレージに保存済みの設定をマージしてロードすること', () => {
    mockStorage.setItem(STORAGE_KEY_DEFAULT, JSON.stringify({
      preset: PRESETS.CUSTOM,
      panelInventory: false,
      panelCollapsed: true
    }));

    const configStore = new UIConfigStore({ storage: mockStorage });
    const config = configStore.get();

    expect(config.preset).toBe(PRESETS.CUSTOM);
    expect(config.panelInventory).toBe(false);
    expect(config.panelCollapsed).toBe(true);
    // デフォルトから引き継がれる値
    expect(config.panelActions).toBe(true);
    expect(config.statusGauges).toBe(true);
  });

  it('不正なJSONデータがストレージにある場合はデフォルト値へフォールバックすること', () => {
    mockStorage.setItem(STORAGE_KEY_DEFAULT, 'invalid-json{{{');
    const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const configStore = new UIConfigStore({ storage: mockStorage });
    const config = configStore.get();

    expect(config.preset).toBe(PRESETS.MODERN);
    expect(config.panelInventory).toBe(true);
    spyWarn.mockRestore();
  });

  it('setProperty でプロパティを更新するとプリセットが custom になり永続化されること', () => {
    const configStore = new UIConfigStore({ storage: mockStorage });
    configStore.setProperty('panelInventory', false);

    const config = configStore.get();
    expect(config.panelInventory).toBe(false);
    expect(config.preset).toBe(PRESETS.CUSTOM);
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY_DEFAULT,
      expect.stringContaining('"panelInventory":false')
    );
  });

  it('toggleSidePanel で折りたたみ状態が反転・指定値へ更新されること', () => {
    const configStore = new UIConfigStore({ storage: mockStorage });
    expect(configStore.get().panelCollapsed).toBe(false);

    // トグル (false -> true)
    configStore.toggleSidePanel();
    expect(configStore.get().panelCollapsed).toBe(true);

    // 強制指定 (true -> true)
    configStore.toggleSidePanel(true);
    expect(configStore.get().panelCollapsed).toBe(true);

    // 強制指定 (true -> false)
    configStore.toggleSidePanel(false);
    expect(configStore.get().panelCollapsed).toBe(false);
  });

  it('applyPreset(classic) でクラシックスタイルへ設定が一括変更されること', () => {
    const configStore = new UIConfigStore({ storage: mockStorage });
    configStore.applyPreset(PRESETS.CLASSIC);

    const config = configStore.get();
    expect(config.preset).toBe(PRESETS.CLASSIC);
    expect(config.panelInventory).toBe(false);
    expect(config.panelActions).toBe(false);
    expect(config.panelKnowledge).toBe(false);
    expect(config.statusClassic2Line).toBe(true);
    expect(config.statusGklExtra).toBe(false);
  });

  it('applyPreset(modern) でモダンスタイルへ設定が一括変更されること', () => {
    const configStore = new UIConfigStore({ storage: mockStorage });
    configStore.applyPreset(PRESETS.CLASSIC);
    configStore.applyPreset(PRESETS.MODERN);

    const config = configStore.get();
    expect(config.preset).toBe(PRESETS.MODERN);
    expect(config.panelInventory).toBe(true);
    expect(config.panelActions).toBe(true);
    expect(config.panelKnowledge).toBe(true);
    expect(config.statusClassic2Line).toBe(false);
    expect(config.statusGklExtra).toBe(true);
  });

  it('subscribe で登録したリスナーに変更が通知されること', () => {
    const configStore = new UIConfigStore({ storage: mockStorage });
    const listener = vi.fn();
    const unsubscribe = configStore.subscribe(listener);

    configStore.setProperty('panelHistoryDock', true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ panelHistoryDock: true }));

    unsubscribe();
    configStore.setProperty('panelHistoryDock', false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
