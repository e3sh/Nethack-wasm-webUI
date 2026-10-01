import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsoleClient } from '../../examples/console-client/main.js';

function createMockElement(id = '', tag = 'div') {
  const classListSet = new Set(['hidden']);
  let innerHTML = '';
  let textContent = '';
  const children = [];

  const el = {
    id,
    tagName: tag.toUpperCase(),
    style: {},
    children,
    parentElement: { clientWidth: 800, clientHeight: 600 },
    dataset: {},
    setAttribute: vi.fn(function(k, v) { this[k] = v; if (k.startsWith('data-')) this.dataset[k.slice(5)] = v; }),
    getAttribute: vi.fn(function(k) { return this[k] || (k.startsWith('data-') ? this.dataset[k.slice(5)] : null); }),
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      contains: (cls) => classListSet.has(cls),
      toggle: (cls, force) => {
        if (force === undefined) {
          if (classListSet.has(cls)) classListSet.delete(cls);
          else classListSet.add(cls);
        } else if (force) classListSet.add(cls);
        else classListSet.delete(cls);
      }
    },
    addEventListener: vi.fn(function(type, fn) {
      if (!this._listeners) this._listeners = {};
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    }),
    removeEventListener: vi.fn(),
    appendChild: vi.fn((child) => {
      children.push(child);
      return child;
    }),
    querySelector: vi.fn((sel) => null),
    querySelectorAll: vi.fn((sel) => []),
    scrollIntoView: vi.fn(),
    click: vi.fn(function() {
      if (typeof this.onclick === 'function') {
        this.onclick({ preventDefault: () => {}, stopPropagation: () => {} });
      }
      if (this._listeners && this._listeners['click']) {
        this._listeners['click'].forEach(fn => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
      }
    }),
    focus: vi.fn(),
    getContext: () => ({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn()
    })
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => innerHTML,
    set: (val) => {
      innerHTML = val;
      children.length = 0;
      el._cards = null;
    }
  });

  Object.defineProperty(el, 'textContent', {
    get: () => textContent,
    set: (val) => {
      textContent = val;
    }
  });

  return el;
}

describe('ConsoleClient (シレン風 GamePad 専用クライアント) 統合テスト', () => {
  let client;
  let mockElements;

  beforeEach(() => {
    // Worker のモック
    global.Worker = class MockWorker {
      constructor() {
        this.onmessage = null;
      }
      postMessage() {}
      addEventListener() {}
      removeEventListener() {}
      terminate() {}
    };

    mockElements = {
      'game-canvas': createMockElement('game-canvas', 'canvas'),
      'guide-bar': {
        setContext: vi.fn(),
        getContext: () => 'NORMAL'
      },
      'context-pill': {
        update: vi.fn()
      },
      'radial-hud': {
        update: vi.fn()
      },
      'shiren-drawer': {
        init: vi.fn(),
        setItems: vi.fn(),
        open: function() { this.isOpen = true; },
        close: function() { this.isOpen = false; },
        isOpen: false,
        addEventListener: vi.fn(),
        handleGamepadNav: vi.fn()
      },
      'prompt-bar': createMockElement('prompt-bar'),
      'prompt-text': createMockElement('prompt-text'),
      'input-controls': createMockElement('input-controls'),
      'menu-modal': createMockElement('menu-modal'),
      'menu-title': createMockElement('menu-title'),
      'menu-items-container': createMockElement('menu-items-container'),
      'btn-cancel-menu': createMockElement('btn-cancel-menu', 'button'),
      'console-message-overlay': createMockElement('console-message-overlay'),
      'st-dlevel': createMockElement('st-dlevel'),
      'st-hp': createMockElement('st-hp'),
      'st-hp-fill': createMockElement('st-hp-fill'),
      'st-hunger': createMockElement('st-hunger'),
      'st-gold': createMockElement('st-gold'),
      'st-exp': createMockElement('st-exp'),
      'st-turn': createMockElement('st-turn')
    };

    // DOM 空間のモック化
    global.document = {
      getElementById: (id) => {
        const el = mockElements[id] || (mockElements[id] = createMockElement(id));
        if (id === 'char-intro-modal') {
          el.querySelectorAll = (sel) => global.document.querySelectorAll(sel);
          el.querySelector = (sel) => global.document.querySelector(sel);
        }
        return el;
      },
      createElement: (tag) => createMockElement('', tag),
      querySelectorAll: (sel) => {
        if (sel.includes('.char-mode-card')) {
          const introModal = mockElements['char-intro-modal'];
          if (introModal && introModal.innerHTML) {
            if (!introModal._cards) {
              const regex = /class="[^"]*char-mode-card[^"]*".*?data-key="([^"]+)"/gs;
              const cards = [];
              let m;
              while ((m = regex.exec(introModal.innerHTML)) !== null) {
                const card = createMockElement('', 'button');
                card.classList.add('char-mode-card');
                card.dataset.key = m[1];
                card.setAttribute('data-key', m[1]);
                cards.push(card);
              }
              introModal._cards = cards;
            }
            return introModal._cards;
          }
        }
        return [];
      },
      querySelector: (sel) => {
        if (sel.includes('.char-mode-card.selected')) {
          const cards = global.document.querySelectorAll('.char-mode-card');
          return cards.find(c => c.classList.contains('selected')) || null;
        }
        if (sel.includes('.char-mode-card')) {
          const cards = global.document.querySelectorAll('.char-mode-card');
          return cards[0] || null;
        }
        return null;
      },
      body: createMockElement('body')
    };

    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: (cb) => setTimeout(cb, 16)
    };

    client = new ConsoleClient();
    client.initRenderers();
    client.initCore();
    client.initModals();
    client.initGamepad();
    client.bindCoreEvents();
    client.bindGamepadEvents();
  });

  it('初期化時に正規モジュール（ModalManager, CharacterCreationModal, CharacterIntroModal）が正常に接続されていること', () => {
    expect(client.canvas).not.toBeNull();
    expect(client.virtualScreen).not.toBeNull();
    expect(client.viewportRenderer).not.toBeNull();
    expect(client.core).not.toBeNull();
    expect(client.inputController).not.toBeNull();
    expect(client.modalManager).not.toBeNull();
    expect(client.characterCreationModal).not.toBeNull();
    expect(client.characterIntroModal).not.toBeNull();
    expect(client.guideBar).not.toBeNull();
    expect(client.shirenDrawer).not.toBeNull();
  });

  it('ASKNAME プロンプト受信時に CharacterIntroModal に委譲され、名前確定できること', () => {
    const introSpy = vi.spyOn(client.characterIntroModal, 'showAskName').mockImplementation(() => {});

    client.handleInputRequired({
      category: 'ASKNAME',
      prompt: 'Who are you?'
    });

    expect(introSpy).toHaveBeenCalled();
  });

  it('MENU プロンプト受信時に ModalManager のメニューが表示され、行選択決定時に [{ identifier, count: -1 }] が core.respond に渡されること', () => {
    const respondSpy = vi.spyOn(client.core, 'respond').mockImplementation(() => {});

    client.handleInputRequired({
      category: 'MENU',
      prompt: 'Select your role',
      menuItems: [
        { identifier: 101, letter: 'a', text: 'Archeologist', isSelectable: true },
        { identifier: 102, letter: 'b', text: 'Barbarian', isSelectable: true },
        { identifier: 103, letter: 'c', text: 'Caveman', isSelectable: true }
      ]
    });

    // ModalManager のメニューモーダルが開いていること
    expect(client.modalManager.elMenuModal.classList.contains('hidden')).toBe(false);
    expect(client.modalManager.selectableMenuButtons.length).toBe(3);
    expect(client.modalManager.activeMenuFocusIndex).toBe(0);

    // 十字キー下で Barbarian (index 1) にフォーカス移動
    client.handleModalNav({ type: 'next' });
    expect(client.modalManager.activeMenuFocusIndex).toBe(1);

    // Aボタンで決定
    client.handleModalSubmit();

    // WebUICore 正規仕様: [{ identifier: 102, count: -1 }] が respond に渡されていること
    expect(respondSpy).toHaveBeenCalledWith([{ identifier: 102, count: -1 }]);
  });

  it('POSKEY 受信時にモーダルがすべてクリアされ、通常探索モードへ復帰すること', () => {
    const clearSpy = vi.spyOn(client.modalManager, 'clearAllModals');

    // POSKEY 受信
    client.handleInputRequired({ category: 'POSKEY' });

    expect(clearSpy).toHaveBeenCalled();
    expect(client.isStartingUp).toBe(false);
  });

  it('StatusAccessor / WebUICore の構造化ステータスモデルからステータスバーが正しく更新され、[object Object] にならないこと', () => {
    client.updateStatusBar({
      hp: { current: 14, max: 16, percent: 0.875 },
      dlevel: { branch: 'Dlvl', level: 3, raw: 'Dlvl:3' },
      hunger: 'hungry',
      gold: 250,
      exp: { level: 2, points: 30 },
      turns: 155
    });

    expect(client.stHp.textContent).toBe('14/16');
    expect(client.stDlevel.textContent).toBe('🗺️ B3F');
    expect(client.stDlevel.textContent).not.toContain('[object Object]');
    expect(client.stHunger.textContent).toBe('🍖 空腹');
    expect(client.stGold.textContent).toBe('🪙 250');
    expect(client.stExp.textContent).toBe('Lv: 2');
    expect(client.stTurn.textContent).toBe('T: 155');
  });

  it('道具袋の開閉（Yボタン）とコンテキスト連動が正常に行われること', () => {
    expect(client.inputController.isInventoryOpen).toBe(false);

    // Yボタンシグナル相当
    client.inputController.executeSignal('SIGNAL:TOGGLE_INVENTORY');
    expect(client.inputController.isInventoryOpen).toBe(true);
    expect(client.shirenDrawer.isOpen).toBe(true);

    // もう一度押すと閉じる
    client.inputController.executeSignal('SIGNAL:TOGGLE_INVENTORY');
    expect(client.inputController.isInventoryOpen).toBe(false);
    expect(client.shirenDrawer.isOpen).toBe(false);
  });

  it('キーボードの上下キーとEnterでメニュー選択が連動すること', () => {
    const respondSpy = vi.spyOn(client.core, 'respond').mockImplementation(() => {});

    client.handleInputRequired({
      category: 'MENU',
      prompt: 'Select your role',
      menuItems: [
        { identifier: 201, text: 'Valkyrie', isSelectable: true },
        { identifier: 202, text: 'Wizard', isSelectable: true }
      ]
    });

    // キーボードの ArrowDown 相当
    client.handleModalNav({ type: 'next' });
    expect(client.modalManager.activeMenuFocusIndex).toBe(1);

    // キーボードの Enter 相当
    client.handleModalSubmit();
    expect(respondSpy).toHaveBeenCalledWith([{ identifier: 202, count: -1 }]);
  });

  it('引数なしで updateStatusBar() を呼び出した場合、core.getStatus() から安全に取得されること', () => {
    vi.spyOn(client.core, 'getStatus').mockReturnValue({
      hp: { current: 16, max: 16, percent: 1.0 },
      dlevel: { branch: 'Dlvl', level: 1, raw: 'Dlvl:1' },
      hunger: '',
      gold: 0,
      exp: { level: 1, points: 0 },
      turns: 1
    });

    client.updateStatusBar();

    expect(client.stHp.textContent).toBe('16/16');
    expect(client.stDlevel.textContent).toBe('🗺️ B1F');
    expect(client.stHunger.textContent).toBe(''); // 平常時は非表示
    expect(client.stGold.textContent).toBe('🪙 0');
    expect(client.stExp.textContent).toBe('Lv: 1');
    expect(client.stTurn.textContent).toBe('T: 1');
  });

  it('ACTION:CONTEXT_PRIMARY 受信時に足元の最優先アクションが core.executeAction で実行されること', async () => {
    const executeActionSpy = vi.fn().mockResolvedValue(true);
    client.core.executeAction = executeActionSpy;
    client.core.getSituation = vi.fn().mockReturnValue({
      actions: [
        { id: 'ACTION_STAIRS_DOWN', labelJa: '階段を降りる', key: '>' }
      ]
    });

    await client.inputController.executeSemanticAction('ACTION:CONTEXT_PRIMARY');
    expect(executeActionSpy).toHaveBeenCalledWith({
      id: 'ACTION_STAIRS_DOWN',
      labelJa: '階段を降りる',
      key: '>'
    });
  });

  it('ACTION:DASH_* 受信時に core.getDashAction と core.executeAction で連続移動が実行されること', async () => {
    const executeActionSpy = vi.fn().mockResolvedValue(true);
    client.core.executeAction = executeActionSpy;
    client.core.getDashAction = vi.fn().mockReturnValue({
      id: 'ACTION_DASH_MOVE_E',
      keySequence: ['G', 'DIR_E']
    });

    await client.inputController.executeSemanticAction('ACTION:DASH_E');
    expect(client.core.getDashAction).toHaveBeenCalledWith('E');
    expect(executeActionSpy).toHaveBeenCalledWith({
      id: 'ACTION_DASH_MOVE_E',
      keySequence: ['G', 'DIR_E']
    });
  });

  it('CharacterIntroModal（モード選択）表示中にゲームパッドのナビゲーションと決定が機能すること', () => {
    const respondSpy = vi.spyOn(client.core, 'respond').mockImplementation(() => {});

    client.handleInputRequired({
      category: 'YN',
      prompt: "Shall I pick a character's race, role, gender and alignment for you? [ynaq]"
    });

    expect(client.characterIntroModal.isVisible).toBe(true);
    expect(client.characterIntroModal.activeType).toBe('MODE_SELECT');

    // 十字キー下/右でカード選択移動
    client.inputController.executeSignal('SIGNAL:DIALOG_NEXT');
    const cards = document.querySelectorAll('.char-mode-card');
    expect(cards.length).toBe(3);
    expect(cards[1].classList.contains('selected')).toBe(true);

    // Aボタンで決定
    client.inputController.executeSignal('SIGNAL:DIALOG_SUBMIT');
    expect(respondSpy).toHaveBeenCalledWith('n');
  });

  it('周囲に扉やコンテキスト対象が存在する場合、動的ラジアルパレットに対象アクションが配置されフリック実行できること', async () => {
    const executeActionSpy = vi.fn().mockResolvedValue(true);
    client.core.executeAction = executeActionSpy;

    // 東に扉（開ける・解錠・蹴破る）が存在する状況をモック
    client.core.getSituation = vi.fn().mockReturnValue({
      actions: [
        {
          id: 'ACTION_OPEN_DOOR_E',
          dirCode: 'E',
          labelJa: '扉を開ける [東]',
          keySequence: ['o', 'DIR_E']
        },
        {
          id: 'ACTION_UNLOCK_DOOR_E',
          dirCode: 'E',
          labelJa: '扉を解錠/施錠 [東]',
          keySequence: ['a', 'b', 'DIR_E', 'y']
        },
        {
          id: 'ACTION_KICK_DOOR_E',
          dirCode: 'E',
          labelJa: '扉を蹴破る (Kick)',
          keySequence: ['#', 'kick', 'DIR_E']
        }
      ]
    });

    const mockHud = {
      setPalette: vi.fn()
    };

    // 動的パレット更新
    const palette = client.inputController.updateDynamicPalette(mockHud);

    // 東スロット (E) に扉を開けるアクションが配置されていること
    expect(palette.E).toBeDefined();
    expect(palette.E.id).toBe('ACTION_OPEN_DOOR_E');
    expect(palette.E.label).toBe('扉を開ける');
    expect(palette.E.icon).toBe('🚪');
    expect(palette.E.isContextAction).toBe(true);

    // 同一方向の第2・第3アクション（解錠、蹴る）が隣接スロット (NE / SE) に展開されていること
    expect(palette.SE?.id === 'ACTION_UNLOCK_DOOR_E' || palette.NE?.id === 'ACTION_UNLOCK_DOOR_E').toBe(true);
    expect(palette.SE?.id === 'ACTION_KICK_DOOR_E' || palette.NE?.id === 'ACTION_KICK_DOOR_E').toBe(true);

    // HUD の setPalette に渡されていること
    expect(mockHud.setPalette).toHaveBeenCalledWith(palette);

    // 東（E）のスロットがフリック実行された場合、core.executeAction で直接実行されること
    await client.inputController.executeSemanticAction(palette.E.action);
    expect(executeActionSpy).toHaveBeenCalledWith(palette.E.action);
  });
});


