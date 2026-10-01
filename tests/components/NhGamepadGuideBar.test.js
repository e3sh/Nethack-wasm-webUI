import { describe, it, expect, beforeEach } from 'vitest';
import { NhGamepadGuideBar, GUIDE_PRESETS } from '../../src/components/gamepad/NhGamepadGuideBar.js';

describe('NhGamepadGuideBar ユニットテスト', () => {
  let guideBar;

  beforeEach(() => {
    guideBar = new NhGamepadGuideBar();
  });

  it('初期コンテキストが NORMAL でありプリセットアイテムが描画されること', () => {
    expect(guideBar.getContext()).toBe('NORMAL');
    const html = guideBar.shadowRoot.innerHTML;
    expect(html).toContain('NORMAL');
    expect(html).toContain('移動');
    expect(html).toContain('足元アクション');
  });

  it('setContext でコンテキストを切り替えると描画内容が更新されること', () => {
    guideBar.setContext('MODAL_INVENTORY');
    expect(guideBar.getContext()).toBe('MODAL_INVENTORY');
    let html = guideBar.shadowRoot.innerHTML;
    expect(html).toContain('MODAL_INVENTORY');
    expect(html).toContain('タブ切替');
    expect(html).toContain('とじる');

    guideBar.setContext('DIRECTION');
    html = guideBar.shadowRoot.innerHTML;
    expect(html).toContain('8方向照準');

    guideBar.setContext('YN');
    html = guideBar.shadowRoot.innerHTML;
    expect(html).toContain('はい (y)');
    expect(html).toContain('いいえ (n)');

    guideBar.setContext('DIALOG');
    html = guideBar.shadowRoot.innerHTML;
    expect(html).toContain('DIALOG');
    expect(html).toContain('選択');
    expect(html).toContain('戻る / 閉じる');
  });

  it('カスタムアイテムを渡して setContext できること', () => {
    guideBar.setContext('CUSTOM', [
      { key: 'X', label: '特技' }
    ]);
    expect(guideBar.getContext()).toBe('CUSTOM');
    const html = guideBar.shadowRoot.innerHTML;
    expect(html).toContain('特技');
    expect(html).toContain('CUSTOM');
  });
});
