import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryView } from '../../examples/gkl-pure-js-client/modules/components/InventoryView.js';
import { InventoryStateManager } from "../../src/core/knowledge/state/InventoryStateManager.js";

describe('InventoryView - スタック武器（複数個の短剣）のメイン装備枠とバッジ表示', () => {
  let inventoryView;
  let gridElement;
  let invCountElement;

  beforeEach(() => {
    gridElement = {
      innerHTML: '',
      querySelector: () => null
    };
    invCountElement = { textContent: '' };

    inventoryView = new InventoryView({
      elGklInventoryGrid: gridElement,
      elGklInvCount: invCountElement,
      getCore: () => null
    });
  });

  it('複数個の短剣をメイン装備にした際、is-wielded クラスとメイン武器バッジ (badge-wielded) が正しくHTMLに含まれること', () => {
    const ism = new InventoryStateManager();
    ism.updateFromLines([
      "a - 3 daggers (wielded)",
      "b - a helmet (being worn)"
    ]);

    inventoryView.renderGklInventory({ items: ism.items });

    const html = gridElement.innerHTML;
    expect(html).toContain('is-wielded');
    expect(html).toContain('badge-wielded');
    expect(html).toContain('title="メイン武器"');
  });

  it('日本語モードで複数個の短剣をメイン装備にした際、is-wielded クラスと「手」バッジが表示されること', () => {
    const ism = new InventoryStateManager();
    ism.updateFromLines([
      "a - 3本の短剣 (装備中)"
    ]);

    inventoryView.setLanguage('ja');
    inventoryView.renderGklInventory({ items: ism.items });

    const html = gridElement.innerHTML;
    expect(html).toContain('is-wielded');
    expect(html).toContain('badge-wielded');
    expect(html).toContain('>手</span>');
  });
});

describe('InventoryView - アイテム操作・サブメニュー・ナレッジ閲覧（左右クリック＆長押し）イベント', () => {
  let inventoryView;
  let gridElement;
  let invCountElement;
  let inspectedItems;
  let queuedSequences;
  let mockSlots;
  let mockCore;

  beforeEach(() => {
    inspectedItems = [];
    queuedSequences = [];
    mockSlots = {};

    mockCore = {
      sendKey: vi.fn(),
      driver: {
        queueSequence: async (seq, opts) => {
          queuedSequences.push({ seq, opts });
        }
      }
    };

    gridElement = {
      innerHTML: '',
      querySelector: (selector) => {
        // [data-letter="X"]
        const letterMatch = selector.match(/\[data-letter="([^"]+)"\]/);
        if (letterMatch) {
          const letter = letterMatch[1];
          if (!mockSlots[letter]) {
            mockSlots[letter] = {
              letter,
              classList: {
                classes: new Set(),
                add: (c) => mockSlots[letter].classList.classes.add(c),
                remove: (c) => mockSlots[letter].classList.classes.delete(c)
              },
              oncontextmenu: null,
              onpointerdown: null,
              onpointerup: null,
              onpointerleave: null,
              onpointercancel: null,
              onmouseenter: null,
              onmouseleave: null
            };
          }
          return mockSlots[letter];
        }
        return null;
      }
    };

    invCountElement = { textContent: '' };

    inventoryView = new InventoryView({
      elGklInventoryGrid: gridElement,
      elGklInvCount: invCountElement,
      getCore: () => mockCore,
      onInspectItem: (item) => {
        inspectedItems.push(item);
      }
    });
  });

  it('スロットを右クリック短押し (contextmenu) するとサブメニュー (i <letter>) が呼び出され、ナレッジモーダルは開かないこと', () => {
    const ism = new InventoryStateManager();
    ism.updateFromLines(["a - a potion of healing"]);
    inventoryView.renderGklInventory({ items: ism.items });

    const slotA = mockSlots['a'];
    expect(slotA).toBeDefined();

    // 右クリック押下 ➔ 離す ➔ contextmenu
    slotA.onpointerdown({ button: 2 });
    slotA.onpointerup({ button: 2 });

    let prevented = false;
    slotA.oncontextmenu({
      preventDefault: () => { prevented = true; }
    });

    expect(prevented).toBe(true);
    // サブメニューがキューイングされる
    expect(queuedSequences.length).toBe(1);
    expect(queuedSequences[0].seq).toEqual(['i', 'a']);
    // ナレッジモーダルは呼ばれない
    expect(inspectedItems.length).toBe(0);
  });

  it('スロットを左長押し (pointerdown 400ms, button:0) するとサブメニュー (i <letter>) が呼び出されること', () => {
    vi.useFakeTimers();
    try {
      const ism = new InventoryStateManager();
      ism.updateFromLines(["b - a wand of digging (0:5)"]);
      inventoryView.renderGklInventory({ items: ism.items });

      const slotB = mockSlots['b'];
      slotB.onpointerdown({ button: 0 });
      expect(slotB.classList.classes.has('pressing')).toBe(true);

      // 400ms 進める
      vi.advanceTimersByTime(400);

      // サブメニューがキューイングされる
      expect(queuedSequences.length).toBe(1);
      expect(queuedSequences[0].seq).toEqual(['i', 'b']);
      // ナレッジは呼ばれない
      expect(inspectedItems.length).toBe(0);
      expect(slotB.classList.classes.has('pressing')).toBe(false);

      // 離したときに通常タップ処理が誤爆しないこと
      slotB.onpointerup({ button: 0 });
      expect(queuedSequences.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('スロットを右長押し (pointerdown 400ms, button:2) するとナレッジ詳細モーダルが呼び出され、サブメニューは出ないこと', () => {
    vi.useFakeTimers();
    try {
      const ism = new InventoryStateManager();
      ism.updateFromLines(["c - a spellbook of identify"]);
      inventoryView.renderGklInventory({ items: ism.items });

      const slotC = mockSlots['c'];
      slotC.onpointerdown({ button: 2 });
      expect(slotC.classList.classes.has('pressing')).toBe(true);

      // 400ms 進める
      vi.advanceTimersByTime(400);

      // ナレッジ詳細モーダルが呼ばれる
      expect(inspectedItems.length).toBe(1);
      expect(inspectedItems[0].letter).toBe('c');
      // サブメニューは呼ばれない
      expect(queuedSequences.length).toBe(0);

      // 指・マウスを離した後の contextmenu イベントでもサブメニューは呼ばれないこと
      slotC.onpointerup({ button: 2 });
      let prevented = false;
      slotC.oncontextmenu({ preventDefault: () => { prevented = true; } });
      expect(prevented).toBe(true);
      expect(queuedSequences.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('短時間の左クリック通常タップではサブメニューもナレッジも呼ばれないこと', () => {
    vi.useFakeTimers();
    try {
      const ism = new InventoryStateManager();
      ism.updateFromLines(["d - a dagger"]);
      inventoryView.renderGklInventory({ items: ism.items });

      const slotD = mockSlots['d'];
      slotD.onpointerdown({ button: 0 });

      // 200ms で離す
      vi.advanceTimersByTime(200);
      slotD.onpointerup({ button: 0 });

      // さらに時間が経過しても長押し処理は発火しない
      vi.advanceTimersByTime(300);
      expect(queuedSequences.length).toBe(0);
      expect(inspectedItems.length).toBe(0);
      // 通常クリックとしてのキー送信が行われること
      expect(mockCore.sendKey).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('マウスホバー時にツールチップに右クリック/左長押しと右長押しのガイダンスが含まれ、モーダルは開かないこと', () => {
    const ism = new InventoryStateManager();
    ism.updateFromLines(["e - an uncursed scroll of identify"]);
    const tooltipTags = { innerHTML: '' };
    inventoryView.elGklTtTags = tooltipTags;
    inventoryView.renderGklInventory({ items: ism.items });

    const slotE = mockSlots['e'];
    slotE.onmouseenter();

    expect(tooltipTags.innerHTML).toContain('右クリック / 左長押し: サブメニュー');
    expect(tooltipTags.innerHTML).toContain('🔍 右長押し: ナレッジ詳細');
    expect(inspectedItems.length).toBe(0);
  });
});


