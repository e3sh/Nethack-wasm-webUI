/**
 * NhDiscoveryCodex.test.js
 *
 * <nh-discovery-codex> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhDiscoveryCodex } from '../../src/components/NhDiscoveryCodex.js';

describe('NhDiscoveryCodex (<nh-discovery-codex>) (Gap 1)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('初期状態（データなし）でクラッシュせず空状態メッセージを表示すること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();

    expect(codex.shadowRoot.innerHTML).toContain('該当する発見済みアイテムはありません。');
  });

  it('DiscoveryStateManager から真名・外見・仮名データを正しくロード・描画すること', () => {
    const mockDiscoveryManager = {
      appearanceMap: new Map([
        ['ruby', 'potion of healing'],
        ['silver', 'wand of digging']
      ]),
      calledNamesMap: new Map([
        ['silver', 'dig?']
      ])
    };

    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setDiscoveryManager(mockDiscoveryManager);

    const html = codex.shadowRoot.innerHTML;
    expect(html).toContain('potion of healing');
    expect(html).toContain('ruby');
    expect(html).toContain('wand of digging');
    expect(html).toContain('silver');
    expect(html).toContain('dig?');
  });

  it('カテゴリタブの選択でアイテムがフィルタリングされること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setItems([
      { trueName: 'potion of healing', appearance: 'ruby', category: 'potion', isDiscovered: true },
      { trueName: 'scroll of identify', appearance: 'labeled ZELGO MER', category: 'scroll', isDiscovered: true },
      { trueName: 'wand of digging', appearance: 'silver', category: 'wand', isDiscovered: true }
    ]);

    // 初期状態 (all)
    expect(codex.shadowRoot.innerHTML).toContain('potion of healing');
    expect(codex.shadowRoot.innerHTML).toContain('scroll of identify');
    expect(codex.shadowRoot.innerHTML).toContain('wand of digging');

    // 薬のみにフィルタ
    codex.setCategory('potion');
    expect(codex.shadowRoot.innerHTML).toContain('potion of healing');
    expect(codex.shadowRoot.innerHTML).not.toContain('scroll of identify');
    expect(codex.shadowRoot.innerHTML).not.toContain('wand of digging');
  });

  it('検索キーワードで真名・外見・仮名がインクリメンタルに絞り込めること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setItems([
      { trueName: 'potion of healing', appearance: 'ruby', calledName: null, category: 'potion', isDiscovered: true },
      { trueName: 'wand of digging', appearance: 'silver', calledName: 'digger', category: 'wand', isDiscovered: true }
    ]);

    // 外見名 "ruby" で検索
    codex.setSearchQuery('ruby');
    expect(codex.shadowRoot.innerHTML).toContain('potion of healing');
    expect(codex.shadowRoot.innerHTML).not.toContain('wand of digging');

    // 仮名 "digger" で検索
    codex.setSearchQuery('digger');
    expect(codex.shadowRoot.innerHTML).not.toContain('potion of healing');
    expect(codex.shadowRoot.innerHTML).toContain('wand of digging');
  });

  it('アイテムクリック時に nh-item-select イベントを発行すること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setItems([
      { trueName: 'potion of healing', appearance: 'ruby', category: 'potion', isDiscovered: true }
    ]);

    let selectedItem = null;
    codex.addEventListener('nh-item-select', (e) => {
      selectedItem = e.detail.item;
    });

    const itemEl = codex.shadowRoot.querySelector('.catalog-item');
    expect(itemEl).not.toBeNull();
    itemEl.click();

    expect(selectedItem).not.toBeNull();
    expect(selectedItem.trueName).toBe('potion of healing');
    expect(selectedItem.appearance).toBe('ruby');
  });

  it('Esc または q キー押下時に nh-close イベントを発行すること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();

    let closeCount = 0;
    codex.addEventListener('nh-close', () => {
      closeCount++;
    });

    // Esc
    codex._handleKeyDown({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(closeCount).toBe(1);

    // q
    codex._handleKeyDown({ key: 'q', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(closeCount).toBe(2);
  });

  it('日本語モード時に nameJa が優先表示され、日本語名でインクリメンタル検索できること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setLanguage('ja');
    codex.setItems([
      { trueName: 'ring mail', nameJa: '輪鎖帷子', category: 'armor', isDiscovered: true },
      { trueName: 'potion of healing', nameJa: '回復の薬', category: 'potion', isDiscovered: true }
    ]);

    const html = codex.shadowRoot.innerHTML;
    expect(html).toContain('輪鎖帷子');
    expect(html).toContain('ring mail');
    expect(html).toContain('回復の薬');

    // 日本語名 "輪鎖" で検索
    codex.setSearchQuery('輪鎖');
    expect(codex.shadowRoot.innerHTML).toContain('輪鎖帷子');
    expect(codex.shadowRoot.innerHTML).not.toContain('回復の薬');
  });

  it('ring mail が防具 (armor) カテゴリに分類され、指輪 (ring) タブ選択時には表示されないこと', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setItems([
      { trueName: 'ring mail', nameJa: '輪鎖帷子', category: 'armor', isDiscovered: true },
      { trueName: 'ring of protection', nameJa: '守りの指輪', category: 'ring', isDiscovered: true }
    ]);

    // 指輪タブ
    codex.setCategory('ring');
    expect(codex.shadowRoot.innerHTML).toContain('守りの指輪');
    expect(codex.shadowRoot.innerHTML).not.toContain('輪鎖帷子');

    // 防具タブ
    codex.setCategory('armor');
    expect(codex.shadowRoot.innerHTML).toContain('輪鎖帷子');
    expect(codex.shadowRoot.innerHTML).not.toContain('守りの指輪');
  });

  it('外見名日本語訳 (appearanceJa) および仮名アイテム (isDiscovered: false) のバッジが正しく表示されること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setLanguage('ja');
    codex.setItems([
      {
        trueName: 'potion of healing',
        nameJa: '回復のポーション',
        appearance: 'ruby',
        appearanceJa: 'ルビー',
        isDiscovered: true
      },
      {
        trueName: 'crude dagger',
        nameJa: '粗末な短剣',
        appearance: 'crude dagger',
        appearanceJa: '粗末な短剣',
        calledName: 'mydagger',
        isDiscovered: false
      }
    ]);

    const html = codex.shadowRoot.innerHTML;
    // 識別済みアイテム: 識別済みバッジと外見名日本語「ルビー (ruby)」
    expect(html).toContain('識別済み');
    expect(html).toContain('ルビー (ruby)');

    // 仮名アイテム: 仮名バッジと粗末な短剣
    expect(html).toContain('仮名');
    expect(html).toContain('粗末な短剣');
    expect(html).toContain('called "mydagger"');
  });

  it('識別済みアイテムに本来の実用スペックバッジ (⚔️ 1d7/1d6, 🛡️ AC +3 等) が表示されること', () => {
    const codex = new NhDiscoveryCodex();
    codex.connectedCallback();
    codex.setLanguage('ja');
    codex.setItems([
      {
        trueName: 'elven arrow',
        nameJa: 'エルフの矢',
        appearance: 'runed arrow',
        appearanceJa: 'ルーンの矢',
        category: 'weapon',
        isDiscovered: true,
        knowledge: {
          category: 'WEAPON',
          sdam: '1d7',
          ldam: '1d6'
        }
      },
      {
        trueName: 'elven cloak',
        nameJa: 'エルフのマント',
        appearance: 'faded pall',
        appearanceJa: '色あせた覆い',
        category: 'armor',
        isDiscovered: true,
        knowledge: {
          category: 'ARMOR',
          ac: 3
        }
      }
    ]);

    const html = codex.shadowRoot.innerHTML;
    // 武器の実用スペックバッジ
    expect(html).toContain('⚔️ 1d7/1d6');
    // 防具の実用スペックバッジ
    expect(html).toContain('🛡️ AC +3');
  });
});
