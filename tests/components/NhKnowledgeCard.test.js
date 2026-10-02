/**
 * NhKnowledgeCard.test.js
 *
 * <nh-knowledge-card> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhKnowledgeCard } from '../../src/components/NhKnowledgeCard.js';

describe('NhKnowledgeCard (<nh-knowledge-card>)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('初期状態（ターゲット未設定時）はクラッシュせず No Target Data を表示すること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    expect(card.shadowRoot.innerHTML).toContain('No Target Data');
  });

  it('モンスターターゲット設定時に Layer 1 実用スペックが正しく描画されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'jackal',
      japaneseName: 'ジャッカル',
      category: 'MONSTER',
      dangerLevel: 'LOW',
      stats: { hd: 0, ac: 7, speed: 12, mr: 0 },
      attacks: ['bite: 1d2'],
      tacticalAdvice: 'パックで群れる犬系モンスターです。'
    });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('jackal');
    expect(html).toContain('ジャッカル');
    expect(html).toContain('MONSTER');
    expect(html).toContain('AC (守備力)');
    expect(html).toContain('1d2');
    expect(html).toContain('パックで群れる犬系モンスターです。');
  });

  it('アイテムターゲット設定時に Layer 1 実用スペック（重量・材質・BUC）が描画されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'blindfold',
      japaneseName: '目隠し',
      category: 'TOOL',
      weight: 2,
      material: 'cloth',
      bucStatus: 'uncursed',
      appearance: 'a piece of cloth',
      description: '目を覆って視覚を遮断します。'
    });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('blindfold');
    expect(html).toContain('目隠し');
    expect(html).toContain('重量');
    expect(html).toContain('cloth');
    expect(html).toContain('a piece of cloth');
    expect(html).toContain('目を覆って視覚を遮断します。');
  });

  it('タブ切り替え（1, 2, 3 または setActiveTab）で表示内容が切り替わること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'blindfold',
      category: 'TOOL'
    });

    expect(card.activeTab).toBe('spec');
    expect(card.shadowRoot.innerHTML).toContain('重量');

    // タブ 2: 公式解説へ切り替え
    card.setActiveTab('official');
    expect(card.activeTab).toBe('official');
    expect(card.shadowRoot.innerHTML).toContain('NetHack 公式 data.base に該当する文学解説はありません。');

    // キーボード '1' でスペックへ復帰
    card._handleKeyDown({ key: '1', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(card.activeTab).toBe('spec');

    // キーボード '3' で噂タブへ
    card._handleKeyDown({ key: '3', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(card.activeTab).toBe('lore');
  });

  it('Layer 2: OnDemandLookupService と連携して公式解説を動的取得・描画すること', async () => {
    const mockLookupService = {
      getCached: vi.fn().mockReturnValue(null),
      lookup: vi.fn().mockResolvedValue({
        found: true,
        text: 'A piece of cloth used to cover the eyes.',
        source: 'NetHack 3.6 data.base'
      })
    };

    const card = new NhKnowledgeCard();
    card.connectedCallback();

    let lookupEventData = null;
    card.addEventListener('nh-lookup-loaded', (e) => {
      lookupEventData = e.detail.data;
    });

    card.setTarget({
      name: 'blindfold',
      category: 'TOOL'
    }, {
      lookupService: mockLookupService,
      activeTab: 'official'
    });

    // 非同期フェッチ完了を待つ
    await vi.waitFor(() => {
      expect(mockLookupService.lookup).toHaveBeenCalledWith({
        name: 'blindfold',
        category: 'TOOL'
      }, {
        language: 'ja'
      });
      expect(card.officialData).not.toBeNull();
    });

    expect(lookupEventData).not.toBeNull();
    expect(lookupEventData.found).toBe(true);

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('A piece of cloth used to cover the eyes.');
    expect(html).toContain('NetHack 3.6 data.base');
  });

  it('Layer 2: スロット文字 (letter) を持つインベントリアイテムもそのまま lookupService へ渡されること', async () => {
    const mockLookupService = {
      getCached: vi.fn().mockReturnValue(null),
      lookup: vi.fn().mockResolvedValue({
        found: true,
        text: 'A trusty weapon.',
        source: 'NetHack 3.6 data.base'
      })
    };

    const card = new NhKnowledgeCard();
    card.connectedCallback();

    const invItem = {
      letter: 'a',
      name: 'dagger',
      category: 'WEAPON'
    };

    card.setTarget(invItem, {
      lookupService: mockLookupService,
      activeTab: 'official'
    });

    await vi.waitFor(() => {
      expect(mockLookupService.lookup).toHaveBeenCalledWith(invItem, {
        language: 'ja'
      });
    });
  });

  it('Layer 3: 関連する噂 (Rumors) が存在する場合に真偽バッジ付きで描画されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'blindfold',
      category: 'TOOL',
      relatedLore: [
        { id: 1, text: 'テレパシー能力があるなら、目隠しはとても役に立つ。', isTrue: true },
        { id: 2, text: '目隠しをつけるとドラゴンのブレスを防げる。', isFalse: true }
      ]
    }, {
      activeTab: 'lore'
    });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('✓ 真の噂');
    expect(html).toContain('テレパシー能力があるなら、目隠しはとても役に立つ。');
    expect(html).toContain('✗ 偽りの噂');
    expect(html).toContain('目隠しをつけるとドラゴンのブレスを防げる。');
  });

  it('Esc または q キー押下時、あるいは閉じるボタン押下時に nh-close イベントを発行すること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    let closeCount = 0;
    card.addEventListener('nh-close', () => {
      closeCount++;
    });

    card.setTarget({ name: 'potion of healing' });

    // Esc
    card._handleKeyDown({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(closeCount).toBe(1);

    // q
    card._handleKeyDown({ key: 'q', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(closeCount).toBe(2);

    // close() メソッド直接呼び出し
    card.close();
    expect(closeCount).toBe(3);
  });
});
