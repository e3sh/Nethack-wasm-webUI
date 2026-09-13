/**
 * ContainerModal.test.js
 *
 * ビジュアル・コンテナUI（二面パネルGUI＆ドラッグ＆ドロップ操作）の単体テスト
 * (IRC & Signal-Driven / ゼロベース回帰版)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContainerModal } from '../../examples/gkl-pure-js-client/modules/components/ContainerModal.js';

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
  const safetyGuard = {
    assessItems: vi.fn((items) => {
      const critical = [];
      const suspicious = [];
      const safe = [];
      items.forEach(item => {
        if (item.onum === 263 || (item.rawText && item.rawText.includes('cancellation'))) {
          critical.push({ item, level: 'CRITICAL', dangerLevel: 'CRITICAL' });
        } else if (item.isSuspicious || (item.rawText && item.rawText.includes('wand'))) {
          suspicious.push({ item, level: 'SUSPICIOUS', dangerLevel: 'SUSPICIOUS' });
        } else {
          safe.push({ item, level: 'SAFE', dangerLevel: 'SAFE' });
        }
      });
      return { critical, suspicious, safe, criticalItems: critical, suspiciousItems: suspicious, hasDanger: critical.length > 0 || suspicious.length > 0 };
    }),
    assessItem: vi.fn((item) => {
      if (item.onum === 263 || (item.rawText && item.rawText.includes('cancellation'))) {
        return { item, level: 'CRITICAL', dangerLevel: 'CRITICAL' };
      } else if (item.isSuspicious || (item.rawText && item.rawText.includes('wand'))) {
        return { item, level: 'SUSPICIOUS', dangerLevel: 'SUSPICIOUS' };
      }
      return { item, level: 'SAFE', dangerLevel: 'SAFE' };
    }),
  };

  const contentsManager = {
    getItems: vi.fn(() => []),
  };

  const containerController = {
    isActive: vi.fn(() => true),
    closeSession: vi.fn(),
    transferItem: vi.fn().mockResolvedValue({ success: true }),
    checkSafety: vi.fn((items) => safetyGuard.assessItems(items)),
    validatePutIn: vi.fn((item) => {
      if (item.letter === 's' || (item.name && item.name.includes('sack')) || (item.rawText && item.rawText.includes('the sack') && !item.rawText.includes('short sword'))) {
        return { allowed: false, valid: false, reason: 'SELF_CONTAINER' };
      }
      if (item.isWielded || item.isWorn || item.worn || item.isQuivered) {
        return { allowed: false, valid: false, reason: 'EQUIPPED' };
      }
      if (item.onum === 263 || (item.rawText && item.rawText.includes('cancellation'))) {
        return { allowed: false, valid: false, reason: 'BOH_CRITICAL' };
      }
      if (item.isSuspicious || (item.rawText && item.rawText.includes('wand'))) {
        return { allowed: false, valid: true, warning: 'BOH_SUSPICIOUS', reason: 'BOH_SUSPICIOUS' };
      }
      return { allowed: true, valid: true };
    }),
    contentsManager,
    safetyGuard,
  };

  const inventoryStateManager = {
    getItems: vi.fn(() => [
      { letter: 'a', rawText: 'a +0 short sword (weapon in right hand)', isWielded: true },
      { letter: 'f', rawText: 'a food ration' },
      { letter: 'g', rawText: 'a wand of cancellation', onum: 263, spe: 1 },
      { letter: 'h', rawText: 'a wooden wand', isSuspicious: true },
    ]),
  };

  const core = {
    containerController,
    executeContainerTransfer: vi.fn().mockImplementation(async (opts) => {
      return await containerController.transferItem(opts);
    }),
    closeContainerSession: vi.fn(() => {
      containerController.closeSession();
    }),
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
    getStatus: vi.fn(() => ({
      gold: { amount: 150, glyphId: 3886 }
    })),
  };

  return core;
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
        contents: [
          { charStr: 'a', str: 'a potion of healing', identifier: 1001 },
        ],
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

    it('close() で closeSession が呼ばれ、モーダルが非表示になること', () => {
      modal.show({ containerName: 'the sack' });
      modal.close();

      expect(mockCore.containerController.closeSession).toHaveBeenCalled();
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
        contents: [],
      });

      // 打ち消しの杖 (wand of cancellation) に CRITICAL ハイライトが付くこと
      expect(modalEl.innerHTML).toContain('boh-danger-critical');
      expect(modalEl.innerHTML).toContain('危険(爆発)');
    });

    it('BoH に CRITICAL 危険アイテムを投入しようとするとハードブロックされアラートが出ること', () => {
      modal.show({
        containerName: 'the bag of holding',
        isBagOfHolding: true,
        contents: [],
      });

      const cancelWand = { letter: 'g', rawText: 'a wand of cancellation', onum: 263 };
      modal.executePutIn(cancelWand);

      expect(globalThis.alert).toHaveBeenCalled();
      expect(mockCore.containerController.transferItem).not.toHaveBeenCalled();
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
        contents: [],
      });

      const susItem = { letter: 'h', rawText: 'a wooden wand', isSuspicious: true };
      modal.executePutIn(susItem);

      // 警告モーダルが表示され、即座には投入されないこと
      expect(warnModalEl.classList.contains('hidden')).toBe(false);
      expect(warnModalEl.innerHTML).toContain('爆発の危険性');
      expect(mockCore.containerController.transferItem).not.toHaveBeenCalled();
    });

    it('通常コンテナ (sack) の場合はセーフティチェックを行わず自由に投入できること', () => {
      modal.show({
        containerName: 'the sack',
        isBagOfHolding: false,
        contents: [],
      });

      // サック自身ではない杖
      mockCore.containerController.validatePutIn = vi.fn(() => ({ allowed: true, valid: true }));

      const wand = { letter: 'g', rawText: 'a wand of cancellation', onum: 263 };
      modal.executePutIn(wand);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith(expect.objectContaining({
        direction: 'in',
        item: wand,
      }));
    });
  });

  // ========================================================================
  // アイテム移動 API 連携 (transferItem)
  // ========================================================================

  describe('item transfer execution', () => {
    it('通常アイテム投入時に指定数量で transferItem(direction: in) が正しく呼ばれること', () => {
      modal.show({ containerName: 'the sack' });

      const food = { letter: 'f', rawText: 'a food ration', identifier: 2001 };
      modal.executePutIn(food, 1);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith({
        direction: 'in',
        item: food,
        count: 1,
        allowSuspicious: false,
      });
    });

    it('アイテム投入時に未指定時は count: -1 (全量) で transferItem が呼ばれること', () => {
      modal.show({ containerName: 'the sack' });

      const food = { letter: 'f', rawText: '50 arrows', identifier: 2002 };
      modal.executePutIn(food);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith({
        direction: 'in',
        item: food,
        count: -1,
        allowSuspicious: false,
      });
    });

    it('アイテム取り出し時に未指定時は count: -1 (全量) で transferItem が正しく呼ばれること', async () => {
      modal.show({
        containerName: 'the sack',
        contents: [{ identifier: 3001, charStr: 'a', str: 'a potion of healing' }],
      });

      const potion = { identifier: 3001, charStr: 'a', str: 'a potion of healing' };
      await modal.executeTakeOut(potion);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith({
        direction: 'out',
        item: potion,
        count: -1,
      });
    });

    it('数量指定時 (count > 0) はその数量で transferItem が呼ばれること', async () => {
      modal.show({
        containerName: 'the sack',
        contents: [{ identifier: 3001, charStr: 'a', str: '50 arrows' }],
      });

      const arrows = { identifier: 3001, charStr: 'a', str: '50 arrows' };
      await modal.executeTakeOut(arrows, 10);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith({
        direction: 'out',
        item: arrows,
        count: 10,
      });
    });

    it('executeTakeAll でコンテナ全アイテムが順次全量 (count: -1) で取り出されること', async () => {
      const items = [
        { identifier: 101, charStr: 'a', str: 'apple' },
        { identifier: 102, charStr: 'b', str: 'bread' },
      ];
      modal.show({ containerName: 'the sack', contents: items });

      await modal.executeTakeAll(items);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledTimes(2);
      expect(mockCore.containerController.transferItem).toHaveBeenNthCalledWith(1, {
        direction: 'out',
        item: items[0],
        count: -1,
      });
      expect(mockCore.containerController.transferItem).toHaveBeenNthCalledWith(2, {
        direction: 'out',
        item: items[1],
        count: -1,
      });
    });

    it('executePutAll で装備中アイテムやコンテナ自身が除外されて安全に全量 (count: -1) で投入されること', async () => {
      modal.show({ containerName: 'the large box' });

      const items = [
        { identifier: 1, rawText: 'a long sword (weapon in hand)', isWielded: true },
        { identifier: 2, rawText: 'a chain mail (being worn)', isWorn: true },
        { identifier: 3, rawText: 'the large box', name: 'the large box' },
        { identifier: 4, rawText: 'a food ration' },
      ];
      const safetyMap = new Map();
      items.forEach(it => safetyMap.set(it, 'SAFE'));

      await modal.executePutAll(items, safetyMap);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledTimes(1);
      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith({
        direction: 'in',
        item: items[3],
        count: -1,
        allowSuspicious: false,
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
      expect(modalEl.innerHTML).toContain('Inventory (Put In)');
      expect(modalEl.innerHTML).toContain('Inside Container');
      expect(modalEl.innerHTML).toContain('Put');
      expect(modalEl.innerHTML).toContain('Take');
    });
  });

  // ========================================================================
  // SSOT 準拠 & 増殖防止 (Duplication Prevention & Validation)
  // ========================================================================

  describe('SSOT compliance and duplication prevention', () => {
    it('開いているコンテナ自身や装備中アイテムが非活性化され、バッジが表示されること', () => {
      mockCore.containerController.validatePutIn = vi.fn((item) => {
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
      mockCore.containerController.validatePutIn = vi.fn((item) => {
        if (item.letter === 's') return { valid: false, reason: 'SELF_CONTAINER' };
        return { valid: true, reason: null };
      });

      modal.show({ containerName: 'a sack', contents: [] });

      const sackItem = { letter: 's', rawText: 'a sack' };
      modal.executePutIn(sackItem);

      // アラートが表示され、executeContainerTransfer は呼ばれない
      expect(globalThis.alert).toHaveBeenCalled();
      expect(mockCore.executeContainerTransfer).not.toHaveBeenCalled();
      // 右ペインのコンテナ中身には追加されず、0件のまま維持される（増殖防止）
      expect(modal.containerItems).toHaveLength(0);
    });

    it('アイテム移動完了後、contentsManager の確定 SSOT 状態から中身が再同期されること', async () => {
      const fsmContents = [{ identifier: 999, letter: 'f', rawText: 'a food ration' }];
      mockCore.containerController.contentsManager = {
        getItems: vi.fn(() => fsmContents),
      };

      modal.show({ containerName: 'a sack', contents: [] });

      const food = { letter: 'f', rawText: 'a food ration' };
      await modal.executePutIn(food);

      // 完了後に contentsManager から取得された最新中身が反映されていること
      expect(mockCore.containerController.contentsManager.getItems).toHaveBeenCalled();
      expect(modal.containerItems).toEqual(fsmContents);
      expect(modalEl.innerHTML).toContain('保存食');
    });

    it('アイコン（タイルHTMLまたは絵文字シンボル）がアイテム行に描画されること', () => {
      modal.show({
        containerName: 'the sack',
        contents: [
          { identifier: 10, letter: 'a', name: 'dagger', glyphId: 105 },
          { identifier: 11, letter: 'b', name: 'potion of healing', glyphId: -1 },
        ],
      });

      expect(mockCore.getGlyphHtml).toHaveBeenCalledWith(105, expect.any(Object));
      expect(modalEl.innerHTML).toContain('glyph-105');
      // 絵文字シンボルフォールバック (potion -> 🧪)
      expect(modalEl.innerHTML).toContain('🧪');
    });

    it('プレイヤー所持金が存在する場合、左パネルに金貨アイテムが表示され投入できること', async () => {
      modal.show({
        containerName: 'the sack',
        contents: [],
      });

      // 左パネルに金貨が表示されること
      expect(modalEl.innerHTML).toContain('150枚の金貨');
      expect(modalEl.innerHTML).toContain('$)');

      // 金貨アイテムの投入実行
      const goldItem = {
        letter: '$',
        invlet: '$',
        isGold: true,
        rawText: '150枚の金貨',
        count: 150
      };

      await modal.executePutIn(goldItem, 50);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith(expect.objectContaining({
        direction: 'in',
        item: expect.objectContaining({ isGold: true, letter: '$' }),
        count: 50
      }));
    });

    it('コンテナ内に金貨が存在する場合、右パネルに金貨が表示され取り出せること', async () => {
      modal.show({
        containerName: 'the chest',
        contents: [
          { identifier: 3333, letter: '$', name: '200 gold pieces', rawText: '200 gold pieces', count: 200, isGold: true }
        ],
      });

      // 右パネルに金貨が表示されること
      expect(modalEl.innerHTML).toContain('200 gold pieces');

      const goldItem = modal.containerItems[0];
      await modal.executeTakeOut(goldItem, -1);

      expect(mockCore.containerController.transferItem).toHaveBeenCalledWith(expect.objectContaining({
        direction: 'out',
        item: expect.objectContaining({ identifier: 3333, isGold: true }),
        count: -1
      }));
    });
  });
});
