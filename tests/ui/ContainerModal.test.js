/**
 * ContainerModal.test.js
 *
 * ビジュアル・コンテナUI（二面パネルGUI＆ドラッグ＆ドロップ操作）の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContainerModal } from '../../examples/gkl-pure-js-client/modules/components/ContainerModal.js';
import { ContainerAction } from '../../src/core/container/ContainerPromptDetector.js';

// 軽量 DOM モック
function createMockElement(id = '', tag = 'div') {
  const listeners = new Map();
  const classListSet = new Set(['hidden']);
  const dataset = {};
  let innerHTML = '';

  const el = {
    id,
    tagName: tag.toUpperCase(),
    dataset,
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      toggle: (cls, force) => {
        if (force === undefined) {
          classListSet.has(cls) ? classListSet.delete(cls) : classListSet.add(cls);
        } else if (force) {
          classListSet.add(cls);
        } else {
          classListSet.delete(cls);
        }
      },
      contains: (cls) => classListSet.has(cls),
    },
    addEventListener: (event, fn) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    querySelector: (sel) => null,
    querySelectorAll: (sel) => [],
    appendChild: vi.fn(),
    disabled: false,
    value: '',
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => innerHTML,
    set: (val) => {
      innerHTML = val;
    },
  });

  return el;
}

function createMockCore() {
  const fsm = {
    isActive: vi.fn(() => true),
    selectAction: vi.fn(() => true),
    transferItems: vi.fn(() => true),
    checkSafety: vi.fn((items) => {
      const critical = [];
      const suspicious = [];
      const safe = [];
      items.forEach(item => {
        if (item.onum === 263 || (item.rawText && item.rawText.includes('cancellation'))) {
          critical.push({ item, dangerLevel: 'CRITICAL' });
        } else if (item.isSuspicious || (item.rawText && item.rawText.includes('wand'))) {
          suspicious.push({ item, dangerLevel: 'SUSPICIOUS' });
        } else {
          safe.push({ item, dangerLevel: 'SAFE' });
        }
      });
      return { critical, suspicious, safe, hasDanger: critical.length > 0 || suspicious.length > 0 };
    }),
  };

  const inventoryStateManager = {
    getItems: vi.fn(() => [
      { letter: 'a', rawText: 'a +0 short sword (weapon in right hand)', isWielded: true },
      { letter: 'f', rawText: 'a food ration' },
      { letter: 'g', rawText: 'a wand of cancellation', onum: 263, spe: 1 },
      { letter: 'h', rawText: 'a wooden wand', isSuspicious: true },
    ]),
  };

  return {
    containerFSM: fsm,
    gkl: { inventoryStateManager },
    inventoryStateManager,
    translate: vi.fn((text) => {
      if (text === 'a food ration') return '保存食';
      if (text === 'the sack' || text === 'a sack') return '袋';
      if (text === 'dagger' || text === 'a dagger') return 'ダガー';
      return text;
    }),
    getGlyphHtml: vi.fn((glyphId) => {
      if (glyphId >= 0) {
        return `<span class="nh-glyph-icon glyph-${glyphId}"></span>`;
      }
      return '';
    }),
  };
}

describe('ContainerModal (Visual Container UI Two-Pane Component)', () => {
  let modal;
  let mockCore;
  let modalEl;

  beforeEach(() => {
    modalEl = createMockElement('container-modal');
    globalThis.alert = vi.fn();

    // グローバル document モック
    globalThis.document = {
      getElementById: vi.fn((id) => {
        if (id === 'container-modal') return modalEl;
        return createMockElement(id);
      }),
      createElement: vi.fn((tag) => createMockElement('', tag)),
      body: { appendChild: vi.fn() },
    };

    mockCore = createMockCore();
    modal = new ContainerModal({
      elContainerModal: modalEl,
      getCore: () => mockCore,
    });
  });

  // ========================================================================
  // 初期化と表示
  // ========================================================================

  describe('show & hide & close', () => {
    it('show() でモーダルが表示状態になり、タイトルと中身がレンダリングされること', () => {
      modal.show({
        containerName: 'the bag of holding',
        containerType: 'BAG_OF_HOLDING',
        isBagOfHolding: true,
        contents: {
          items: [
            { charStr: 'a', str: 'a potion of healing', identifier: 1001 },
          ],
        },
      });

      expect(modal.isVisible).toBe(true);
      expect(modalEl.classList.contains('hidden')).toBe(false);
      expect(modalEl.innerHTML).toContain('the bag of holding');
      expect(modalEl.innerHTML).toContain('防爆セーフティ稼働中');
      expect(modalEl.innerHTML).toContain('a potion of healing');
    });

    it('hide() でモーダルが非表示になること', () => {
      modal.show({ containerName: 'the sack' });
      expect(modal.isVisible).toBe(true);

      modal.hide();
      expect(modal.isVisible).toBe(false);
      expect(modalEl.classList.contains('hidden')).toBe(true);
    });

    it('close() で FSM に QUIT アクション (q) が送られ、モーダルが非表示になること', () => {
      modal.show({ containerName: 'the sack' });
      modal.close();

      expect(mockCore.containerFSM.selectAction).toHaveBeenCalledWith(ContainerAction.QUIT);
      expect(modal.isVisible).toBe(false);
      expect(modalEl.classList.contains('hidden')).toBe(true);
    });
  });

  // ========================================================================
  // BoH セーフティガード統合
  // ========================================================================

  describe('Bag of Holding Safety Guard integration', () => {
    it('BoH の場合、確定爆発アイテム (CRITICAL) に赤色警告と投入禁止が付与されること', () => {
      modal.show({
        containerName: 'the bag of holding',
        containerType: 'BAG_OF_HOLDING',
        isBagOfHolding: true,
        contents: { items: [] },
      });

      // 打ち消しの杖 (wand of cancellation) に CRITICAL ハイライトが付くこと
      expect(modalEl.innerHTML).toContain('boh-danger-critical');
      expect(modalEl.innerHTML).toContain('危険(爆発)');
    });

    it('BoH に CRITICAL 危険アイテムを投入しようとするとハードブロックされアラートが出ること', () => {
      modal.show({
        containerName: 'the bag of holding',
        isBagOfHolding: true,
        contents: { items: [] },
      });

      const cancelWand = { letter: 'g', rawText: 'a wand of cancellation', onum: 263 };
      modal.executePutIn(cancelWand);

      expect(globalThis.alert).toHaveBeenCalled();
      expect(mockCore.containerFSM.transferItems).not.toHaveBeenCalled();
    });

    it('BoH に SUSPICIOUS (未識別) アイテムを投入しようとすると警告モーダルが表示されること', () => {
      const warnModalEl = createMockElement('container-warning-modal');
      globalThis.document.getElementById = vi.fn((id) => {
        if (id === 'container-warning-modal') return warnModalEl;
        if (id === 'container-modal') return modalEl;
        return createMockElement(id);
      });

      modal.show({
        containerName: 'the bag of holding',
        isBagOfHolding: true,
        contents: { items: [] },
      });

      const susItem = { letter: 'h', rawText: 'a wooden wand', isSuspicious: true };
      modal.executePutIn(susItem);

      // 警告モーダルが表示され、即座には投入されないこと
      expect(warnModalEl.classList.contains('hidden')).toBe(false);
      expect(warnModalEl.innerHTML).toContain('爆発の危険性');
      expect(mockCore.containerFSM.transferItems).not.toHaveBeenCalled();
    });

    it('通常コンテナ (sack) の場合はセーフティチェックを行わず自由に投入できること', () => {
      modal.show({
        containerName: 'the sack',
        isBagOfHolding: false,
        contents: { items: [] },
      });

      const wand = { letter: 'g', rawText: 'a wand of cancellation', onum: 263 };
      modal.executePutIn(wand);

      expect(mockCore.containerFSM.transferItems).toHaveBeenCalledWith({
        direction: 'in',
        items: [expect.objectContaining({ letter: 'g', rawText: 'a wand of cancellation' })],
      });
    });
  });

  // ========================================================================
  // アイテム移動 API 連携 (transferItems)
  // ========================================================================

  describe('item transfer execution', () => {
    it('通常アイテム投入時に transferItems(direction: in) が正しく呼ばれること', () => {
      modal.show({ containerName: 'the sack' });

      const food = { letter: 'f', rawText: 'a food ration', identifier: 2001 };
      modal.executePutIn(food, 1);

      expect(mockCore.containerFSM.transferItems).toHaveBeenCalledWith({
        direction: 'in',
        items: [{
          letter: 'f',
          identifier: 2001,
          count: 1,
          rawText: 'a food ration',
          name: undefined,
        }],
      });
    });

    it('アイテム取り出し時に transferItems(direction: out) が正しく呼ばれること', () => {
      modal.show({
        containerName: 'the sack',
        contents: {
          items: [{ identifier: 3001, charStr: 'a', str: 'a potion of healing' }],
        },
      });

      const potion = { identifier: 3001, charStr: 'a', str: 'a potion of healing' };
      modal.executeTakeOut(potion);

      expect(mockCore.containerFSM.transferItems).toHaveBeenCalledWith({
        direction: 'out',
        items: [{
          identifier: 3001,
          accelerator: 'a',
          letter: 'a',
          count: -1,
          rawText: 'a potion of healing',
        }],
      });
    });

    it('executeTakeAll でコンテナ全アイテムの一括取り出しが呼ばれること', () => {
      const items = [
        { identifier: 101, charStr: 'a', str: 'apple' },
        { identifier: 102, charStr: 'b', str: 'bread' },
      ];
      modal.show({ containerName: 'the sack', contents: { items } });

      modal.executeTakeAll(items);

      expect(mockCore.containerFSM.transferItems).toHaveBeenCalledWith({
        direction: 'out',
        items: [
          { identifier: 101, letter: 'a', count: -1, rawText: 'apple' },
          { identifier: 102, letter: 'b', count: -1, rawText: 'bread' },
        ],
      });
    });

    it('executePutAll で装備中アイテムやコンテナ自身が除外されて安全に投入されること', () => {
      modal.show({ containerName: 'the large box' });

      const items = [
        { identifier: 1, rawText: 'a long sword (weapon in hand)', isWielded: true },
        { identifier: 2, rawText: 'a chain mail (being worn)', isWorn: true },
        { identifier: 3, rawText: 'the large box', name: 'the large box' },
        { identifier: 4, rawText: 'a food ration' },
      ];
      const safetyMap = new Map();
      items.forEach(it => safetyMap.set(it, 'SAFE'));

      modal.executePutAll(items, safetyMap);

      expect(mockCore.containerFSM.transferItems).toHaveBeenCalledWith({
        direction: 'in',
        items: [
          expect.objectContaining({ identifier: 4, rawText: 'a food ration' }),
        ],
      });
    });
  });

  // ========================================================================
  // 言語切り替え
  // ========================================================================

  describe('language switching', () => {
    it('英語に切り替えた際にUI文言が英語で再描画されること', () => {
      modal.show({ containerName: 'the sack' });
      modal.setLanguage('en');

      expect(modal.currentLanguage).toBe('en');
      expect(modalEl.innerHTML).toContain('Player Inventory');
      expect(modalEl.innerHTML).toContain('Container Contents');
      expect(modalEl.innerHTML).toContain('Put In');
      expect(modalEl.innerHTML).toContain('Take Out');
    });
  });

  // ========================================================================
  // SSOT 準拠 & 増殖防止 (Duplication Prevention & Validation)
  // ========================================================================

  describe('SSOT compliance and duplication prevention', () => {
    it('開いているコンテナ自身や装備中アイテムが非活性化され、バッジが表示されること', () => {
      mockCore.containerFSM.validatePutIn = vi.fn((item) => {
        if (item.letter === 's') return { valid: false, reason: 'SELF_CONTAINER' };
        if (item.isWielded) return { valid: false, reason: 'EQUIPPED' };
        return { valid: true, reason: null };
      });

      mockCore.inventoryStateManager.getItems = vi.fn(() => [
        { letter: 's', rawText: 'a sack', name: 'sack' },
        { letter: 'a', rawText: 'a short sword (weapon in hand)', isWielded: true },
        { letter: 'f', rawText: 'a food ration' },
      ]);

      modal.show({ containerName: 'a sack' });

      // 自分自身に self-container と 開いている鞄 バッジが付与されていること
      expect(modalEl.innerHTML).toContain('self-container');
      expect(modalEl.innerHTML).toContain('開いている鞄');
      // 装備中アイテムに 武器 / 装備 バッジが付与されていること
      expect(modalEl.innerHTML).toContain('badge-wielded');
    });

    it('開いているコンテナ自身を executePutIn しようとしても拒絶され、増殖しないこと', () => {
      mockCore.containerFSM.validatePutIn = vi.fn((item) => {
        if (item.letter === 's') return { valid: false, reason: 'SELF_CONTAINER' };
        return { valid: true, reason: null };
      });

      modal.show({ containerName: 'a sack', contents: { items: [] } });

      const sackItem = { letter: 's', rawText: 'a sack' };
      modal.executePutIn(sackItem);

      // アラートが表示され、FSM の transferItems は呼ばれない
      expect(globalThis.alert).toHaveBeenCalled();
      expect(mockCore.containerFSM.transferItems).not.toHaveBeenCalled();
      // 右ペインのコンテナ中身には追加されず、0件のまま維持される（増殖防止）
      expect(modal.containerItems).toHaveLength(0);
    });

    it('アイテム移動完了後、FSM contentsManager の確定 SSOT 状態から中身が再同期されること', async () => {
      const fsmContents = [{ identifier: 999, letter: 'f', rawText: 'a food ration' }];
      mockCore.containerFSM.contentsManager = {
        getItems: vi.fn(() => fsmContents),
      };
      mockCore.containerFSM.transferItems = vi.fn().mockResolvedValue(true);

      modal.show({ containerName: 'a sack', contents: { items: [] } });

      const food = { letter: 'f', rawText: 'a food ration' };
      await modal.executePutIn(food);

      // FSM 完了後に contentsManager から取得された最新中身が反映されていること
      expect(mockCore.containerFSM.contentsManager.getItems).toHaveBeenCalled();
      expect(modal.containerItems).toEqual(fsmContents);
      expect(modalEl.innerHTML).toContain('保存食');
    });

    it('【課題④】アイコン（タイルHTMLまたは絵文字シンボル）がアイテム行に描画されること', () => {
      modal.show({
        containerName: 'the sack',
        contents: {
          items: [
            { identifier: 10, letter: 'a', name: 'dagger', glyphId: 105 },
            { identifier: 11, letter: 'b', name: 'potion of healing', glyphId: -1 },
          ]
        }
      });

      // glyphId >= 0 のアイテムには nh-glyph-icon が含まれること
      expect(modalEl.innerHTML).toContain('nh-glyph-icon glyph-105');
      // glyphId < 0 のアイテムには絵文字フォールバック (🧪) が含まれること
      expect(modalEl.innerHTML).toContain('🧪');
    });

    it('【課題④】日本語設定時にアイテム名およびヘッダータイトルが translateText により翻訳されること', () => {
      modal.show({
        containerName: 'a sack',
        contents: {
          items: [
            { identifier: 1, letter: 'a', rawText: 'a food ration', str: 'a food ration' },
          ]
        }
      });

      // 日本語モード (デフォルト)
      expect(modal.currentLanguage).toBe('ja');
      // タイトル「a sack」→「袋」
      expect(mockCore.translate).toHaveBeenCalledWith('a sack');
      expect(modalEl.innerHTML).toContain('袋');
      // アイテム「a food ration」→「保存食」
      expect(mockCore.translate).toHaveBeenCalledWith('a food ration');
      expect(modalEl.innerHTML).toContain('保存食');
    });

    it('【課題②】数量指定がある場合その数量、未指定 (All) の場合アイテムの全量が transferItems に渡されること', () => {
      modal.show({ containerName: 'the chest' });

      // 1. 数量未指定 (All: -1) の場合、アイテムの count (6) が渡されること
      const stackItem = { letter: 'd', name: 'daggers', count: 6, rawText: '6 daggers' };
      modal.specifiedQuantity = -1;
      modal.executePutIn(stackItem);

      expect(mockCore.containerFSM.transferItems).toHaveBeenCalledWith(expect.objectContaining({
        direction: 'in',
        items: [expect.objectContaining({ count: 6 })],
      }));

      // 2. 数量指定 (例: 3個) の場合、指定数量が優先して渡されること
      modal.isProcessing = false;
      modal.specifiedQuantity = 3;
      modal.executePutIn(stackItem);

      expect(mockCore.containerFSM.transferItems).toHaveBeenCalledWith(expect.objectContaining({
        direction: 'in',
        items: [expect.objectContaining({ count: 3 })],
      }));
    });

    it('【課題③】各アイテム行に data-id が設定され、主キー照合が可能であること', () => {
      modal.show({
        containerName: 'the sack',
        contents: {
          items: [
            { identifier: 501, letter: 'a', name: 'dagger' },
          ]
        }
      });

      // 左右パネルの行に data-id が付与されていること
      expect(modalEl.innerHTML).toContain('data-id="501"');
      expect(modalEl.innerHTML).toContain('data-side="right"');
    });
  });
});
