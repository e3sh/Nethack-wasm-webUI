/**
 * ItemNamingCrossUiRendering.test.js
 *
 * ROADMAP §2.2 是正 Phase 3：メインUI基準での名づけ・銘・強化値表示の統合検証と最終完了監査
 *
 * 【検証対象】
 * 1. メイン5大UI（examples/gkl-pure-js-client/modules/components/）:
 *    - InventoryView (メインインベントリ＆ツールチップ)
 *    - ContainerModal (コンテナ・袋の二面パネル)
 *    - PaperdollModal (装備ペーパードール＆クイックセレクター)
 *    - KnowledgeDetailModal (ナレッジ詳細モーダル)
 *    - CodexModal (冒険手帳・ディスカバリー図鑑)
 * 2. 拡張Web Components（src/components/）:
 *    - NhContainerFiler
 *    - NhPaperdoll
 *    - NhKnowledgeCard
 *    - NhDiscoveryCodex
 *    - NhShirenInventoryDrawer
 *
 * 【検証要件】
 * - 単なる部分一致 (toContain) ではなく、完全一致 (toBe) による厳密アサーション
 * - NetHack 公式 (src/objnam.c) 規則通りのフォーマット（種別仮名、個別銘、強化値、チャージ数、BUC）
 * - 二重表示（"+1 +1", "[銘] [銘]", "祝福された 祝福された", "(+)" 等）や崩れの完全ゼロ証明
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupMockDom, createMockNode } from '../components/testElementHelper.js';
import { ItemNormalizer } from '../../src/core/knowledge/models/ItemNormalizer.js';
import { ItemDisplayPresenter } from '../../src/core/knowledge/presenters/ItemDisplayPresenter.js';
import { createTestItem } from '../helpers/testItemFactory.js';
import { EQUIP_SLOTS } from '../../src/core/knowledge/equipment/EquipmentRules.js';

// 5大UI
import { InventoryView } from '../../examples/gkl-pure-js-client/modules/components/InventoryView.js';
import { ContainerModal } from '../../examples/gkl-pure-js-client/modules/components/ContainerModal.js';
import { PaperdollModal } from '../../examples/gkl-pure-js-client/modules/components/PaperdollModal.js';
import { KnowledgeDetailModal } from '../../examples/gkl-pure-js-client/modules/components/KnowledgeDetailModal.js';
import { CodexModal } from '../../examples/gkl-pure-js-client/modules/components/CodexModal.js';

// Web Components
import { NhContainerFiler } from '../../src/components/NhContainerFiler.js';
import { NhPaperdoll } from '../../src/components/NhPaperdoll.js';
import { NhKnowledgeCard } from '../../src/components/NhKnowledgeCard.js';
import { NhDiscoveryCodex } from '../../src/components/NhDiscoveryCodex.js';
import { NhShirenInventoryDrawer } from '../../src/components/gamepad/NhShirenInventoryDrawer.js';

describe('ItemNamingCrossUiRendering - メインUI横断でのアイテム命名・銘・強化値レンダリング厳密監査', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  // =========================================================================
  // テスト用標準フィクスチャ
  // =========================================================================

  // シナリオ 1: 祝福された +5 ロングソード [銘: Excalibur] (識別済み武器)
  const createExcaliburItem = (overrides = {}) => {
    const raw = createTestItem('long sword', 'a', {
      spe: 5,
      bucStatus: 'BLESSED',
      flags: { known: true, bknown: true, blessed: true, dknown: true },
      namedInstance: 'Excalibur',
      isWielded: true,
      equipSlot: 'weapon',
      ...overrides
    });
    return ItemNormalizer.normalize(raw);
  };

  // シナリオ 2: 煙った薬 [仮名: かいふく?] (未識別薬)
  const createSmokyPotionItem = () => {
    return ItemNormalizer.normalize({
      category: 'POTION',
      name: 'smoky potion',
      appearance: 'smoky',
      appearanceName: 'smoky potion',
      appearanceNameJa: '煙った薬',
      isUnidentified: true,
      calledName: 'かいふく?',
      letter: 'b',
      flags: { dknown: true, known: false }
    });
  };

  // シナリオ 3: 3個の呪われた 矢 (スタックアイテム)
  const createCursedArrowsItem = () => {
    const raw = createTestItem('arrow', 'c', {
      quan: 3,
      count: 3,
      bucStatus: 'CURSED',
      flags: { known: true, bknown: true, cursed: true, dknown: true }
    });
    return ItemNormalizer.normalize(raw);
  };

  // シナリオ 4: 変身の杖 (0:5) (チャージ数アイテム)
  const createPolymorphWandItem = () => {
    const raw = createTestItem('wand of polymorph', 'd', {
      spe: 5,
      recharged: 0,
      flags: { known: true, dknown: true }
    });
    return ItemNormalizer.normalize(raw);
  };

  // =========================================================================
  // 1. メイン5大UI（examples/gkl-pure-js-client/modules/components/）
  // =========================================================================

  describe('1. InventoryView（メインインベントリ＆ツールチップ）', () => {
    let iv;
    let gridEl;
    let ttNameEl;
    let ttTagsEl;
    let tooltipEl;

    beforeEach(() => {
      gridEl = createMockNode('div');
      ttNameEl = createMockNode('div');
      ttTagsEl = createMockNode('div');
      tooltipEl = createMockNode('div');

      iv = new InventoryView({
        elGklInventoryGrid: gridEl,
        elGklInvCount: createMockNode('span'),
        elGklTooltip: tooltipEl,
        elGklTtName: ttNameEl,
        elGklTtTags: ttTagsEl,
        getCore: () => null
      });
    });

    it('日本語モード: ツールチップタイトルが「祝福された +5 ロングソード [銘: Excalibur] (手)」と完全一致し、二重表示がないこと', () => {
      const item = createExcaliburItem();
      iv.setLanguage('ja');
      iv.renderGklInventory({ items: [item] });

      const slot = gridEl.querySelector('[data-letter="a"]');
      expect(slot).toBeTruthy();
      slot.onmouseenter();

      const title = ttNameEl.textContent;
      expect(title).toBe('祝福された +5 ロングソード [銘: Excalibur] (手)');

      // 二重表示の完全否定
      expect(title).not.toMatch(/\+5\s+\+5/);
      expect(title).not.toMatch(/\[銘:[^\]]+\]\s*\[銘:/);
      expect(title).not.toMatch(/祝福された\s+祝福された/);
      expect(title).not.toContain('(+)');
    });

    it('英語モード: ツールチップタイトルが「blessed +5 long sword named Excalibur (weapon in hand)」と完全一致すること', () => {
      const item = createExcaliburItem();
      iv.setLanguage('en');
      iv.renderGklInventory({ items: [item] });

      const slot = gridEl.querySelector('[data-letter="a"]');
      slot.onmouseenter();

      expect(ttNameEl.textContent).toBe('blessed +5 long sword named Excalibur (weapon in hand)');
      expect(ttNameEl.textContent).not.toMatch(/\+5\s+\+5/);
      expect(ttNameEl.textContent).not.toMatch(/named\s+named/);
    });

    it('日本語モード: 未識別薬のツールチップタイトルが「煙った薬 [仮名: かいふく?]」と完全一致すること', () => {
      const item = createSmokyPotionItem();
      iv.setLanguage('ja');
      iv.renderGklInventory({ items: [item] });

      const slot = gridEl.querySelector('[data-letter="b"]');
      slot.onmouseenter();

      expect(ttNameEl.textContent).toBe('煙った薬 [仮名: かいふく?]');
      expect(ttNameEl.textContent).not.toMatch(/\[仮名:[^\]]+\]\s*\[仮名:/);
    });

    it('日本語モード: スタックアイテムが「3個の呪われた 矢」と完全一致すること', () => {
      const item = createCursedArrowsItem();
      iv.setLanguage('ja');
      iv.renderGklInventory({ items: [item] });

      const slot = gridEl.querySelector('[data-letter="c"]');
      slot.onmouseenter();

      expect(ttNameEl.textContent).toBe('3個の呪われた 矢');
      expect(ttNameEl.textContent).not.toMatch(/\(3\)\s*3個の/);
    });

    it('日本語モード: 杖チャージ数が「変身の杖 (0:5)」と完全一致し、多重強化値が付かないこと', () => {
      const item = createPolymorphWandItem();
      iv.setLanguage('ja');
      iv.renderGklInventory({ items: [item] });

      const slot = gridEl.querySelector('[data-letter="d"]');
      slot.onmouseenter();

      expect(ttNameEl.textContent).toBe('変身の杖 (0:5)');
      expect(ttNameEl.textContent).not.toMatch(/\(0:5\)\s*\(0:5\)/);
      expect(ttNameEl.textContent).not.toContain('+0');
    });
  });

  describe('2. ContainerModal（コンテナ・袋の二面パネル）', () => {
    let cm;
    const mockCore = {
      gkl: { inventoryStateManager: { sagesWisdomMode: false } },
      translate: (t) => t
    };

    beforeEach(() => {
      cm = new ContainerModal({
        getCore: () => mockCore
      });
    });

    it('左右パネルのリスト行において、祝福・強化・銘が正しく完全レンダリングされること', () => {
      const item = createExcaliburItem();
      const rowsHtmlJa = cm._renderPlayerItemsHtml([item], false);

      expect(rowsHtmlJa).toContain('title="祝福された +5 ロングソード [銘: Excalibur] (手)"');
      expect(rowsHtmlJa).toContain('>祝福された +5 ロングソード [銘: Excalibur] (手)<');

      // 数量スタックアイテム
      const arrow = createCursedArrowsItem();
      const containerRowsJa = cm._renderContainerItemsHtml([arrow], false);
      expect(containerRowsJa).toContain('title="3個の呪われた 矢"');
      expect(containerRowsJa).toContain('>3個の呪われた 矢<');

      // 二重表示の否定
      expect(rowsHtmlJa).not.toContain('+5 +5');
      expect(rowsHtmlJa).not.toContain('[銘: Excalibur] [銘: Excalibur]');
      expect(containerRowsJa).not.toContain('(3) 3個の');
    });

    it('グリッド表示（IconInventory風）の title 属性に完全なタイトルが出力されること', () => {
      const item = createExcaliburItem();
      const gridHtmlJa = cm._renderPlayerItemsGridHtml([item], new Map(), new Map(), false);

      expect(gridHtmlJa).toContain('title="祝福された +5 ロングソード [銘: Excalibur] (手)"');
      expect(gridHtmlJa).not.toContain('+5 +5');
    });
  });

  describe('3. PaperdollModal（装備ペーパードール＆クイックセレクター）', () => {
    let pm;
    const mockCore = {
      gkl: { inventoryStateManager: { sagesWisdomMode: false } }
    };

    beforeEach(() => {
      pm = new PaperdollModal({
        getCore: () => mockCore
      });
    });

    it('_getItemDisplayName で装備サフィックスが付かず、純粋な完全タイトルが返ること', () => {
      const item = createExcaliburItem();
      pm.currentLanguage = 'ja';

      const name = pm._getItemDisplayName(item);
      expect(name).toBe('祝福された +5 ロングソード [銘: Excalibur]');
      // スロット自身が装備枠のため、末尾に (手) や (装備中) がつかないこと
      expect(name).not.toContain('(手)');
      expect(name).not.toContain('(装備中)');
    });

    it('クイックセレクターで BUC マークの二重付与 (+) がなく、完全なタイトルのみが表示されること', () => {
      const item = createExcaliburItem();
      pm.currentLanguage = 'ja';
      pm.selectedSlot = EQUIP_SLOTS.MAIN_HAND; // 'main_hand'

      const html = pm._renderQuickSelectorHtml({ items: [item] }, {});

      // 修正前バグ: "祝福された +5 ロングソード [銘: Excalibur] (+)"
      // 修正後: "祝福された +5 ロングソード [銘: Excalibur]"
      expect(html).toContain('<span class="selector-item-name">祝福された +5 ロングソード [銘: Excalibur]</span>');
      expect(html).not.toContain('Excalibur] (+)');
      expect(html).not.toContain('Excalibur] (-)');
    });
  });

  describe('4. KnowledgeDetailModal（ナレッジ詳細モーダル）', () => {
    let km;
    let modalElement;

    beforeEach(() => {
      modalElement = document.createElement('div');
      modalElement.id = 'knowledge-detail-modal';
      document.body.appendChild(modalElement);

      km = new KnowledgeDetailModal({
        getCore: () => ({ gkl: {} }),
        elModal: modalElement
      });
      km.elModal = modalElement;
    });

    it('ヘッダータイトルに祝福・強化値・銘が完全一致でレンダリングされること', () => {
      const item = createExcaliburItem();
      km.currentLanguage = 'ja';

      km.open(item);
      const titleEl = modalElement.querySelector('.knowledge-header-title');
      expect(titleEl).toBeTruthy();
      expect(titleEl.textContent).toBe('祝福された +5 ロングソード [銘: Excalibur]');

      // 二重表示の否定
      expect(titleEl.textContent).not.toContain('+5 +5');
      expect(titleEl.textContent).not.toContain('[銘: Excalibur] [銘: Excalibur]');
    });

    it('未識別・仮名アイテムのヘッダータイトルが「煙った薬 [仮名: かいふく?]」と完全一致すること', () => {
      const item = createSmokyPotionItem();
      km.currentLanguage = 'ja';

      km.open(item);
      const titleEl = modalElement.querySelector('.knowledge-header-title');
      expect(titleEl).toBeTruthy();
      expect(titleEl.textContent).toBe('煙った薬 [仮名: かいふく?]');
      expect(titleEl.textContent).not.toContain('[仮名: かいふく?] [仮名: かいふく?]');
    });
  });

  describe('5. CodexModal（冒険手帳・ディスカバリー図鑑）', () => {
    let codex;

    beforeEach(() => {
      codex = new CodexModal({
        getCore: () => ({ gkl: {} })
      });
    });

    it('図鑑グリッドカードで未識別仮名アイテムが「煙った薬 [仮名: かいふく?]」と完全一致すること', () => {
      const item = createSmokyPotionItem();
      codex.currentLanguage = 'ja';

      // 図鑑用フォーマットタイトル検証 (ItemDisplayPresenter 経由)
      const title = ItemDisplayPresenter.getFormattedTitle(item, {
        language: 'ja',
        includeLetter: false,
        includeBilingualSubname: false
      });

      expect(title).toBe('煙った薬 [仮名: かいふく?]');
      expect(title).not.toContain('[仮名: かいふく?] [仮名: かいふく?]');
    });
  });

  // =========================================================================
  // 2. 拡張Web Components（src/components/）
  // =========================================================================

  describe('6. NhContainerFiler (<nh-container-filer>)', () => {
    it('数量の二重表示 ((3) 3個の...) が完全に解消され、正しいタイトルが出力されること', () => {
      const filer = new NhContainerFiler();
      filer.connectedCallback();
      filer.language = 'ja';

      const arrows = createCursedArrowsItem();
      filer.setPlayerInventory([arrows]);

      const itemNameEl = filer.shadowRoot.querySelector('.item-name');
      expect(itemNameEl).toBeTruthy();
      expect(itemNameEl.textContent).toBe('3個の呪われた 矢');

      // 修正前バグ: "(3) 3個の..."
      expect(itemNameEl.textContent).not.toContain('(3)');
    });
  });

  describe('7. NhPaperdoll (<nh-paperdoll>)', () => {
    it('装備中アイテムの強化値・銘・BUCが脱落せず完全レンダリングされること', () => {
      const pd = new NhPaperdoll();
      pd.connectedCallback();
      pd.language = 'ja';

      // 装備中メイン武器
      const excalibur = {
        id: 1,
        name: 'long sword',
        spe: 5,
        bucStatus: 'BLESSED',
        flags: { known: true, bknown: true, blessed: true, dknown: true },
        namedInstance: 'Excalibur',
        equipped: true,
        category: 'WEAPON'
      };

      pd.setSituation({
        inventory: {
          items: [excalibur]
        }
      });

      const weaponSlot = pd.shadowRoot.querySelector(`[data-slot-id="${EQUIP_SLOTS.MAIN_HAND}"]`);
      expect(weaponSlot).toBeTruthy();

      const nameEl = weaponSlot.querySelector('.slot-item-name');
      expect(nameEl.textContent).toBe('祝福された +5 ロングソード [銘: Excalibur]');

      // 素の名前 "ロングソード" だけになっていないことの検証
      expect(nameEl.textContent).not.toBe('ロングソード');
      expect(nameEl.textContent).not.toContain('+5 +5');
    });
  });

  describe('8. NhKnowledgeCard (<nh-knowledge-card>)', () => {
    it('独自フォーマットではなく、ItemDisplayPresenter 統一タイトルが完全レンダリングされること', () => {
      const card = new NhKnowledgeCard();
      card.connectedCallback();
      card.language = 'ja';

      const excalibur = createExcaliburItem({ isWielded: false });
      card.setTarget(excalibur);

      const titleEl = card.shadowRoot.querySelector('.card-title');
      expect(titleEl).toBeTruthy();
      expect(titleEl.textContent).toBe('祝福された +5 ロングソード [銘: Excalibur] (long sword)');

      // クォートや重複の否定
      expect(titleEl.textContent).not.toContain('"Excalibur"');
      expect(titleEl.textContent).not.toContain('+5 +5');
    });

    it('未識別アイテムで仮名が「煙った薬 [仮名: かいふく?]」と正確にレンダリングされること', () => {
      const card = new NhKnowledgeCard();
      card.connectedCallback();
      card.language = 'ja';

      const potion = createSmokyPotionItem();
      card.setTarget(potion);

      const titleEl = card.shadowRoot.querySelector('.card-title');
      expect(titleEl.textContent).toBe('煙った薬 [仮名: かいふく?]');
      expect(titleEl.textContent).not.toContain('"かいふく?"');
    });
  });

  describe('9. NhDiscoveryCodex (<nh-discovery-codex>)', () => {
    it('図鑑カタログアイテムの表示が崩れず正確であること', () => {
      const codex = new NhDiscoveryCodex();
      codex.connectedCallback();
      codex.setItems([
        {
          onum: 300,
          trueName: 'potion of extra healing',
          nameJa: '超回復の薬',
          appearance: 'smoky potion',
          appearanceJa: '煙った薬',
          calledName: 'かいふく?',
          isDiscovered: false
        }
      ]);

      const calledEl = codex.shadowRoot.querySelector('.item-called');
      expect(calledEl).toBeTruthy();
      expect(calledEl.textContent).toContain('かいふく?');
    });
  });

  describe('10. NhShirenInventoryDrawer (<nh-shiren-inventory-drawer>)', () => {
    it('アイテムタイトルが ItemDisplayPresenter 準拠で完全一致すること', () => {
      const drawer = new NhShirenInventoryDrawer();
      drawer.connectedCallback();

      const item = createExcaliburItem({ isWielded: false });
      const title = ItemDisplayPresenter.getFormattedTitle(item, { language: 'ja', includeLetter: false, includeEquip: false });
      expect(title).toBe('祝福された +5 ロングソード [銘: Excalibur]');
    });
  });
});
