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

    const mockLookup = { lookup: vi.fn(), getCached: vi.fn().mockReturnValue({ found: false }) };
    card.setTarget({
      name: 'blindfold',
      category: 'TOOL'
    }, { lookupService: mockLookup });

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

  it('lookupService 未設定時（オフライン時）は公式解説タブが非表示になり2タブ構成になること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'jackal',
      japaneseName: 'ジャッカル',
      category: 'MONSTER'
    });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('1. 実用スペック');
    expect(html).not.toContain('2. 公式解説 (WASM)');
    expect(html).toContain('2. 冒険の噂');
    expect(html).toContain('<span class="kbd">1</span><span class="kbd">2</span> タブ切替'); // 2タブ用のフッターヒント

    // official タブへの切り替えが無効化されること
    card.setActiveTab('official');
    expect(card.activeTab).not.toBe('official');
  });

  it('lookupService 設定時でも hide-official-tab 属性があれば公式解説タブが非表示になること', () => {
    const card = new NhKnowledgeCard();
    card.setAttribute('hide-official-tab', '');
    card.connectedCallback();

    const mockLookup = { lookup: vi.fn(), getCached: vi.fn() };
    card.setTarget({
      name: 'jackal',
      category: 'MONSTER'
    }, { lookupService: mockLookup });

    const html = card.shadowRoot.innerHTML;
    expect(html).not.toContain('2. 公式解説 (WASM)');
  });

  it('lookupService 設定時は3大タブすべてが表示されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    const mockLookup = { lookup: vi.fn(), getCached: vi.fn() };
    card.setTarget({
      name: 'jackal',
      category: 'MONSTER'
    }, { lookupService: mockLookup });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('1. 実用スペック');
    expect(html).toContain('2. 公式解説 (WASM)');
    expect(html).toContain('3. 冒険の噂');
    expect(html).toContain('<span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> タブ切替');
  });

  it('Layer 3: targetData から関連する噂が自動解決され、タブに件数が表示されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    // blindfold (onum 233)
    card.setTarget({
      onum: 233,
      name: 'blindfold',
      category: 'TOOL'
    });

    const html = card.shadowRoot.innerHTML;
    expect(card.loreEntries.length).toBeGreaterThan(0);
    // 件数バッジが表示されていること
    expect(html).toContain(`2. 冒険の噂 (${card.loreEntries.length})`);
  });

  it('Layer 3: adventureLogManager 連携時に未解禁の噂はサマリー表示され、解禁時は日本語訳が表示されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    const mockManager = {
      getRelatedLore: vi.fn().mockReturnValue([
        {
          id: 'rumor_tru_1',
          text: 'A blindfold can be very useful...',
          translatedText: '目隠しはとても役に立つ。',
          isTrue: true,
          isUnlocked: false
        }
      ])
    };

    card.setTarget({
      onum: 233,
      name: 'blindfold',
      category: 'TOOL'
    }, {
      adventureLogManager: mockManager,
      activeTab: 'lore',
      currentLanguage: 'ja'
    });

    let html = card.shadowRoot.innerHTML;
    expect(html).toContain('未解禁: 1件');

    // 解禁済みと未解禁が混在
    mockManager.getRelatedLore.mockReturnValue([
      {
        id: 'rumor_tru_1',
        text: 'A blindfold can be very useful...',
        translatedText: '目隠しはとても役に立つ。',
        isTrue: true,
        isUnlocked: true
      },
      {
        id: 'rumor_fal_2',
        text: 'Another rumor',
        isTrue: false,
        isUnlocked: false
      }
    ]);

    card.setTarget({
      onum: 233,
      name: 'blindfold',
      category: 'TOOL'
    }, {
      adventureLogManager: mockManager,
      activeTab: 'lore',
      currentLanguage: 'ja'
    });

    html = card.shadowRoot.innerHTML;
    expect(html).toContain('✓ 真の噂');
    expect(html).toContain('目隠しはとても役に立つ。');
    expect(html).toContain('未解禁の噂: 1件');
  });

  it('Layer 3: 神託（Oracle）の場合は専用の 🏛️ 神託 バッジが表示されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    const mockManager = {
      getRelatedLore: vi.fn().mockReturnValue([
        {
          id: 'oracle_1',
          category: 'ORACLE',
          text: 'If thy wand hath run out of charges...',
          translatedText: '杖の魔力が尽きたとしても、なお振り続けるがよい。',
          isUnlocked: true
        }
      ])
    };

    card.setTarget({
      onum: 233,
      name: 'wand',
      category: 'WAND'
    }, {
      adventureLogManager: mockManager,
      activeTab: 'lore',
      currentLanguage: 'ja'
    });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('lore-badge-oracle');
    expect(html).toContain('🏛️ 神託');
    expect(html).toContain('杖の魔力が尽きたとしても');
  });

  it('Layer 3: 噂カードをクリックした際に nh-rumor-selected イベントを発行すること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      onum: 233,
      name: 'blindfold',
      category: 'TOOL'
    }, {
      activeTab: 'lore'
    });

    let selectedEventDetail = null;
    card.addEventListener('nh-rumor-selected', (e) => {
      selectedEventDetail = e.detail;
    });

    const rumorCard = card.shadowRoot.querySelector('.lore-card.clickable');
    expect(rumorCard).not.toBeNull();
    rumorCard.click();

    expect(selectedEventDetail).not.toBeNull();
    expect(selectedEventDetail.rumorId).toBeDefined();
  });

  it('モンスターおよびアイテム設定時にヘッダーに header-glyph-icon が描画されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    // モンスター (monOffset: 1 = killer bee)
    card.setTarget({
      monOffset: 1,
      name: 'killer bee',
      category: 'MONSTER'
    });

    let html = card.shadowRoot.innerHTML;
    expect(html).toContain('header-glyph-icon');

    // アイテム (onum: 233 = blindfold)
    card.setTarget({
      onum: 233,
      name: 'blindfold',
      category: 'TOOL'
    });

    html = card.shadowRoot.innerHTML;
    expect(html).toContain('header-glyph-icon');
  });

  it('攻撃手段がオブジェクト配列の場合に [object Object] にならずフォーマットされること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'killer bee',
      japaneseName: 'キラービー',
      category: 'MONSTER',
      dangerLevel: 'LOW',
      stats: { hd: 1, ac: 4, speed: 18, mr: 0 },
      attacks: [
        { type: 'bite', damage: '1d3' },
        { type: 'sting', damage: '1d3', effect: 'poison' }
      ],
      resistances: ['poison', 'fire']
    }, { currentLanguage: 'ja' });

    const html = card.shadowRoot.innerHTML;
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('噛みつき [1d3]');
    expect(html).toContain('刺突: 毒 [1d3]');
    expect(html).toContain('耐毒');
    expect(html).toContain('耐火');
  });

  it('英語モードで攻撃手段と耐性が英語表記でフォーマットされること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'killer bee',
      category: 'MONSTER',
      dangerLevel: 'LOW',
      attacks: [
        { type: 'bite', damage: '1d3' },
        { type: 'sting', damage: '1d3', effect: 'poison' }
      ],
      resistances: ['poison']
    }, { currentLanguage: 'en' });

    const html = card.shadowRoot.innerHTML;
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('Bite [1d3]');
    expect(html).toContain('Sting: Poison [1d3]');
    expect(html).toContain('Poison');
  });

  it('危険度 SAFE の場合に badge-danger-safe クラスが付与されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'archeologist',
      japaneseName: '考古学者',
      category: 'MONSTER',
      dangerLevel: 'SAFE'
    });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('badge-danger-safe');
    expect(html).toContain('SAFE');
  });

  it('通常モード時、未鑑定アイテム（isUnidentified: true）では外見名が表示され、スペックがマスクされること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'ruby potion',
      appearanceName: 'ルビー色の薬',
      category: 'POTION',
      isUnidentified: true,
      hintSummary: '正体不明の薬。飲むか投げるまで効果はわからない。',
      summary: '正体不明の薬。飲むか投げるまで効果はわからない。'
    }, { currentLanguage: 'ja' });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('ルビー色の薬');
    expect(html).toContain('未鑑定の薬');
    expect(html).toContain('未識別');
    expect(html).toContain('正体不明の薬');
    expect(html).not.toContain('badge-wisdom');
    expect(html).not.toContain('公式解説 (WASM)');
  });

  it('透視状態時（isWisdomRevealed）、賢者の知恵バッジが表示され真名と詳細スペックが開放されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'ruby potion',
      appearanceName: 'ルビー色の薬',
      wisdomTrueName: 'potion of healing',
      wisdomTrueNameJa: '回復の薬',
      category: 'POTION',
      isUnidentified: true,
      isWisdomRevealed: true,
      summary: '飲むとHPを回復する薬。',
      weight: 20,
      cost: 100
    }, { currentLanguage: 'ja' });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('ルビー色の薬 [回復の薬]');
    expect(html).toContain('badge-wisdom');
    expect(html).toContain('🧙 賢者の知恵');
    expect(html).toContain('飲むとHPを回復する薬。');
    expect(html).toContain('重量');
    expect(html).toContain('20');
  });

  it('未鑑定アイテム表示中にオンデマンド透視ボタン（peekWisdomBtn / wキー）で一時的に正体を透視・再マスクできること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'ruby potion',
      appearanceName: 'ルビー色の薬',
      wisdomTrueName: 'potion of healing',
      wisdomTrueNameJa: '回復の薬',
      category: 'POTION',
      isUnidentified: true,
      wisdomEffectSummaryJa: '飲むとHPを回復する。',
      wisdomWeight: 20,
      effectSummary: '正体不明の薬。飲むか投げるまで効果はわからない。'
    }, { currentLanguage: 'ja' });

    // 1. 初期状態: 未透視
    let peekBtn = card.shadowRoot.querySelector('#peekWisdomBtn');
    expect(peekBtn).not.toBeNull();
    expect(peekBtn.textContent).toContain('知恵透視');
    expect(card.shadowRoot.innerHTML).toContain('未鑑定の薬/ポーション');
    expect(card.shadowRoot.innerHTML).not.toContain('badge-wisdom');
    expect(card.shadowRoot.innerHTML).toContain('正体不明の薬');

    // 2. ボタンクリックで透視
    peekBtn.click();
    expect(card.isPeekRevealed).toBe(true);

    peekBtn = card.shadowRoot.querySelector('#peekWisdomBtn');
    expect(peekBtn.classList.contains('active')).toBe(true);
    expect(card.shadowRoot.innerHTML).toContain('ルビー色の薬 [回復の薬]');
    expect(card.shadowRoot.innerHTML).toContain('badge-wisdom');
    expect(card.shadowRoot.innerHTML).toContain('正式名 (真名):');
    expect(card.shadowRoot.innerHTML).toContain('回復の薬');

    // 3. 再度クリックで未鑑定表示に戻る
    peekBtn.click();
    expect(card.isPeekRevealed).toBe(false);
    expect(card.shadowRoot.innerHTML).not.toContain('badge-wisdom');
    expect(card.shadowRoot.innerHTML).toContain('正体不明の薬');

    // 4. wキー押下でも透視トグルできること
    card._handleKeyDown({ key: 'w', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(card.isPeekRevealed).toBe(true);
    expect(card.shadowRoot.innerHTML).toContain('ルビー色の薬 [回復の薬]');
  });

  it('未識別アイテムに仮名 (calledName) が設定されている場合、タイトルおよびスペック欄に仮名が表示されること', () => {
    const card = new NhKnowledgeCard();
    card.connectedCallback();

    card.setTarget({
      name: 'red potion',
      appearanceName: 'red potion',
      category: 'POTION',
      isUnidentified: true,
      calledName: 'healing?'
    });

    const html = card.shadowRoot.innerHTML;
    expect(html).toContain('called "healing?"');
    expect(html).toContain('プレイヤー命名 (仮名)');
  });

  describe('命名アシスト＆個別命名ボタン連携 (ROADMAP §2.1)', () => {
    it('未鑑定アイテムの場合に [仮名] ボタンが表示され、クリックで nh-knowledge-call-item を発火すること', () => {
      const card = new NhKnowledgeCard();
      card.connectedCallback();

      const callSpy = vi.fn();
      card.addEventListener('nh-knowledge-call-item', callSpy);

      card.setTarget({
        name: 'scroll labeled ZELGO MER',
        appearanceName: 'scroll labeled ZELGO MER',
        category: 'SCROLL',
        letter: 'a',
        isUnidentified: true
      });

      const callBtn = card.shadowRoot.querySelector('#callItemBtn');
      expect(callBtn).toBeTruthy();
      expect(callBtn.textContent).toContain('仮名');

      callBtn.click();
      expect(callSpy).toHaveBeenCalledTimes(1);
      expect(callSpy.mock.calls[0][0].detail.mode).toBe('call');
      expect(callSpy.mock.calls[0][0].detail.targetData.name).toBe('scroll labeled ZELGO MER');
    });

    it('未鑑定アイテムで c キーを押下したときに nh-knowledge-call-item が発火すること', () => {
      const card = new NhKnowledgeCard();
      card.connectedCallback();

      const callSpy = vi.fn();
      card.addEventListener('nh-knowledge-call-item', callSpy);

      card.setTarget({
        name: 'smoky potion',
        category: 'POTION',
        letter: 'b',
        isUnidentified: true
      });

      card._handleKeyDown({ key: 'c', preventDefault: vi.fn(), stopPropagation: vi.fn() });
      expect(callSpy).toHaveBeenCalledTimes(1);
      expect(callSpy.mock.calls[0][0].detail.mode).toBe('call');
    });

    it('アーティファクト元アイテム（識別済み long sword）の場合に [銘をつける] ボタンが表示され、クリックで nh-knowledge-name-item を発火すること', () => {
      const card = new NhKnowledgeCard();
      card.connectedCallback();

      const nameSpy = vi.fn();
      card.addEventListener('nh-knowledge-name-item', nameSpy);

      card.setTarget({
        name: 'long sword',
        onum: 54,
        category: 'WEAPON',
        letter: 'c',
        isUnidentified: false
      });

      const nameBtn = card.shadowRoot.querySelector('#nameItemBtn');
      expect(nameBtn).toBeTruthy();
      expect(nameBtn.textContent).toContain('銘');

      // 仮名ボタンは表示されない
      expect(card.shadowRoot.querySelector('#callItemBtn')).toBeNull();

      nameBtn.click();
      expect(nameSpy).toHaveBeenCalledTimes(1);
      expect(nameSpy.mock.calls[0][0].detail.mode).toBe('artifact_name');
      expect(nameSpy.mock.calls[0][0].detail.targetData.name).toBe('long sword');
    });

    it('アーティファクト元アイテムで n キーを押下したときに nh-knowledge-name-item が発火すること', () => {
      const card = new NhKnowledgeCard();
      card.connectedCallback();

      const nameSpy = vi.fn();
      card.addEventListener('nh-knowledge-name-item', nameSpy);

      card.setTarget({
        name: 'athame',
        category: 'WEAPON',
        letter: 'd',
        isUnidentified: false
      });

      card._handleKeyDown({ key: 'n', preventDefault: vi.fn(), stopPropagation: vi.fn() });
      expect(nameSpy).toHaveBeenCalledTimes(1);
      expect(nameSpy.mock.calls[0][0].detail.mode).toBe('artifact_name');
    });

    it('アーティファクト候補が存在しない通常アイテムやモンスターでは命名ボタンが表示されないこと', () => {
      const card = new NhKnowledgeCard();
      card.connectedCallback();

      // 通常アイテム（food ration）
      card.setTarget({
        name: 'food ration',
        category: 'FOOD',
        letter: 'e',
        isUnidentified: false
      });
      expect(card.shadowRoot.querySelector('#callItemBtn')).toBeNull();
      expect(card.shadowRoot.querySelector('#nameItemBtn')).toBeNull();

      // モンスター
      card.setTarget({
        name: 'jackal',
        category: 'MONSTER',
        dangerLevel: 'LOW'
      });
      expect(card.shadowRoot.querySelector('#callItemBtn')).toBeNull();
      expect(card.shadowRoot.querySelector('#nameItemBtn')).toBeNull();
    });
  });
});



