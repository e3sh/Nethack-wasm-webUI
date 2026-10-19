/**
 * ModalManager.test.js
 *
 * ModalManager の promptCategory UI 演出（特に KEY カテゴリのバウンスアニメーション演出）の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModalManager } from '../../examples/gkl-pure-js-client/modules/components/ModalManager.js';
import { PROMPT_CATEGORY } from '../../src/core/types.js';
import { WriteService } from "../../src/core/knowledge/services/WriteService.js";
import { PostMortemKnowledgeResolver } from '../../src/core/knowledge/services/PostMortemKnowledgeResolver.js';

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
    value: '',
    disabled: false,
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      contains: (cls) => classListSet.has(cls),
    },
    addEventListener: vi.fn(),
    appendChild: vi.fn((child) => {
      children.push(child);
      return child;
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    scrollIntoView: vi.fn(),
    focus: vi.fn(),
    click: function() {
      if (typeof this.onclick === 'function') {
        this.onclick();
      }
    },
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => innerHTML,
    set: (val) => {
      innerHTML = val;
      children.length = 0;
    },
  });

  Object.defineProperty(el, 'textContent', {
    get: () => textContent,
    set: (val) => { textContent = val; },
  });

  Object.defineProperty(el, 'className', {
    get: () => Array.from(classListSet).join(' '),
    set: (val) => {
      classListSet.clear();
      if (val && typeof val === 'string') {
        val.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
      }
    },
  });

  return el;
}

describe('ModalManager - promptCategory UI 分岐 & KEY 演出テスト', () => {
  let modalManager;
  let mockElements;
  let mockCore;

  beforeEach(() => {
    mockElements = {
      elPromptBar: createMockElement('prompt-bar'),
      elPromptText: createMockElement('prompt-text'),
      elInputControls: createMockElement('input-controls'),
      elMenuModal: createMockElement('menu-modal'),
      elMenuTitle: createMockElement('menu-title'),
      elMenuItemsContainer: createMockElement('menu-items-container'),
      elBtnCancelMenu: createMockElement('btn-cancel-menu'),
      elGameOverModal: createMockElement('gameover-modal'),
      elGameOverSummary: createMockElement('gameover-summary'),
      elScoreboardContainer: createMockElement('gameover-scoreboard'),
      elLoading: createMockElement('loading-overlay'),
      elSpinnerBox: createMockElement('loading-spinner-box'),
      elSelectorCard: createMockElement('start-selector-card'),
      elSaveName: createMockElement('start-save-name'),
      elWishModal: createMockElement('wish-modal'),
    };

    globalThis.document = {
      getElementById: (id) => {
        if (!mockElements[id]) {
          mockElements[id] = createMockElement(id);
        }
        return mockElements[id];
      },
      createElement: (tag) => createMockElement('', tag),
    };

    mockCore = {
      respond: vi.fn(),
      sendKey: vi.fn(),
    };

    modalManager = new ModalManager({
      ...mockElements,
      getCore: () => mockCore,
      getLoadedTileImagePath: () => '',
      onRestartGame: vi.fn(),
    });
  });

  it('category === "KEY"（空バッファ display_nhwindow 等）のとき、press-any-key-icon のバウンスアイコンが表示されること', () => {
    const data = {
      category: PROMPT_CATEGORY.KEY,
      promptCategory: PROMPT_CATEGORY.KEY,
      prompt: '',
      lines: [],
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elPromptBar.classList.contains('hidden')).toBe(false);
    expect(mockElements.elPromptText.textContent).toBe('');
    expect(mockElements.elInputControls.innerHTML).toContain('press-any-key-hint');
    expect(mockElements.elInputControls.innerHTML).toContain('press-any-key-icon');
    expect(mockElements.elInputControls.innerHTML).toContain('▼');
    expect(mockElements.elInputControls.innerHTML).toContain('btn-key-continue');
    expect(mockElements.elInputControls.innerHTML).toContain('▶ 続ける (Space)');
    expect(mockElements.elPromptBar.classList.contains('is-key-waiting')).toBe(true);
  });

  it('category === "KEY" のとき、「▶ 続ける (Space)」ボタンクリックで Space が送信されること', () => {
    const mockBtn = createMockElement('btn-key-continue', 'button');
    mockElements['btn-key-continue'] = mockBtn;

    const data = {
      category: PROMPT_CATEGORY.KEY,
      promptCategory: PROMPT_CATEGORY.KEY,
    };

    modalManager.handleInputRequired(data);

    expect(mockBtn.onclick).toBeDefined();
    mockBtn.onclick({ stopPropagation: vi.fn() });

    expect(mockCore.sendKey).toHaveBeenCalledWith('Space');
  });

  it('英語環境の場合、ボタン文言が「▶ Continue (Space)」になること', () => {
    modalManager.setLanguage('en');
    const data = {
      category: PROMPT_CATEGORY.KEY,
      promptCategory: PROMPT_CATEGORY.KEY,
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elInputControls.innerHTML).toContain('▶ Continue (Space)');
  });

  it('category === "KEY" のとき、プロンプトバー自体のクリックで Space が送信されること', () => {
    const data = {
      category: PROMPT_CATEGORY.KEY,
      promptCategory: PROMPT_CATEGORY.KEY,
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elPromptBar.onclick).toBeDefined();
    mockElements.elPromptBar.onclick();

    expect(mockCore.sendKey).toHaveBeenCalledWith('Space');
  });

  it('lines が存在する KEY / FILE の場合はテキストウィンドウとして処理されること', () => {
    const data = {
      category: PROMPT_CATEGORY.KEY,
      promptCategory: PROMPT_CATEGORY.KEY,
      lines: ['First line', 'Second line'],
    };

    modalManager.handleInputRequired(data);

    expect(modalManager.isTextWindowMode).toBe(true);
    expect(mockElements.elMenuModal.classList.contains('hidden')).toBe(false);
  });

  it('POSKEY（通常ターン待ち）の場合はプロンプトバーが非表示になり、is-key-waiting や onclick が解除されること', () => {
    // 最初に KEY でプロンプトバーを待機状態にする
    modalManager.handleInputRequired({
      category: PROMPT_CATEGORY.KEY,
      promptCategory: PROMPT_CATEGORY.KEY,
    });
    expect(mockElements.elPromptBar.classList.contains('is-key-waiting')).toBe(true);
    expect(mockElements.elPromptBar.onclick).toBeDefined();

    // 次に POSKEY が届いたとき
    const data = {
      category: PROMPT_CATEGORY.POSKEY,
      promptCategory: PROMPT_CATEGORY.POSKEY,
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elPromptBar.classList.contains('hidden')).toBe(true);
    expect(mockElements.elPromptBar.classList.contains('is-key-waiting')).toBe(false);
    expect(mockElements.elPromptBar.onclick).toBeNull();
  });

  it('subCategory: "CHARACTER_CREATION" の場合、characterCreationModal.show が呼ばれること', () => {
    const mockCharModal = {
      isCompleted: false,
      isVisible: false,
      show: vi.fn(),
      hide: vi.fn(),
      isCharacterCreationMenu: vi.fn().mockReturnValue(false),
    };
    modalManager.characterCreationModal = mockCharModal;

    const data = {
      subCategory: 'CHARACTER_CREATION',
      signal: { id: 'SIGNAL_CHARACTER_CREATION' },
      menuItems: [{ identifier: 1, accelerator: 'a', str: 'an Archeologist' }]
    };

    modalManager.handleInputRequired(data);

    expect(mockCharModal.show).toHaveBeenCalledWith(data, 'ja');
  });

  it('characterCreationModal.isCompleted === true の場合、CHARACTER_CREATION シグナルがあってもモーダルが開かないこと', () => {
    const mockCharModal = {
      isCompleted: true,
      isVisible: false,
      show: vi.fn(),
      hide: vi.fn(),
      isCharacterCreationMenu: vi.fn().mockReturnValue(false),
    };
    modalManager.characterCreationModal = mockCharModal;

    const data = {
      subCategory: 'CHARACTER_CREATION',
      signal: { id: 'SIGNAL_CHARACTER_CREATION' },
      menuItems: [{ identifier: 1, accelerator: 'a', str: 'an Archeologist' }]
    };

    modalManager.handleInputRequired(data);

    expect(mockCharModal.show).not.toHaveBeenCalled();
  });
});

describe('ModalManager - 魔法のマーカー（Write）支援モーダルテスト', () => {
  let modalManager;
  let mockElements;
  let mockCore;
  let writeService;

  beforeEach(() => {
    mockElements = {};
    globalThis.document = {
      getElementById: (id) => {
        if (!mockElements[id]) {
          mockElements[id] = createMockElement(id);
        }
        return mockElements[id];
      },
      createElement: (tag) => createMockElement('', tag),
    };

    mockCore = {
      respond: vi.fn(),
      sendKey: vi.fn(),
    };

    modalManager = new ModalManager({
      getCore: () => mockCore,
      getLoadedTileImagePath: () => '',
      onRestartGame: vi.fn(),
    });

    writeService = new WriteService({ language: 'ja' });
  });

  it('subCategory: "WRITE"（targetType: "SCROLL"）のとき、Write モーダルが表示され、巻物用のタイトルとバッジが設定されること', () => {
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SCROLL',
        writeService: writeService,
      },
    };

    modalManager.handleInputRequired(data);

    const elWriteModal = mockElements['write-modal'];
    expect(elWriteModal.classList.contains('hidden')).toBe(false);

    const titleEl = mockElements['write-modal-title'];
    expect(titleEl.textContent).toContain('巻物');

    const badgeEl = mockElements['write-type-badge'];
    expect(badgeEl.textContent).toBe('SCROLL');

    const presetsContainer = mockElements['write-presets'];
    expect(presetsContainer.children.length).toBeGreaterThan(0);
  });

  it('subCategory: "WRITE"（targetType: "SPELLBOOK"）のとき、呪文書用タイトルとバッジが設定されること', () => {
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SPELLBOOK',
        writeService: writeService,
      },
    };

    modalManager.handleInputRequired(data);

    const titleEl = mockElements['write-modal-title'];
    expect(titleEl.textContent).toContain('呪文書');

    const badgeEl = mockElements['write-type-badge'];
    expect(badgeEl.textContent).toBe('SPELLBOOK');
  });

  it('プリセットボタンをクリックしたときに選択アイテムが更新され、プレビューコマンドが反映されること', () => {
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SCROLL',
        writeService: writeService,
      },
    };

    modalManager.handleInputRequired(data);

    const presetsContainer = mockElements['write-presets'];
    const chargingBtn = presetsContainer.children.find(btn => btn.innerHTML.includes('充填') || btn.innerHTML.includes('charging'));
    expect(chargingBtn).toBeDefined();

    chargingBtn.click();

    const previewCmdEl = mockElements['write-preview-cmd'];
    expect(previewCmdEl.textContent).toBe('charging');
  });

  it('インクリメンタル検索入力でアイテムが絞り込まれ、選択アイテムとプレビューが更新されること', () => {
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SCROLL',
        writeService: writeService,
      },
    };

    modalManager.handleInputRequired(data);

    const searchInput = mockElements['write-search-input'];
    searchInput.value = 'identify';
    searchInput.oninput();

    const previewCmdEl = mockElements['write-preview-cmd'];
    expect(previewCmdEl.textContent).toBe('identify');
  });

  it('確定ボタンクリックで、core.respond で正規コマンド文字列が送信されモーダルが閉じること', () => {
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SCROLL',
        writeService: writeService,
      },
    };

    modalManager.handleInputRequired(data);

    const btnSubmit = mockElements['btn-write-submit'];
    btnSubmit.click();

    expect(mockCore.respond).toHaveBeenCalledWith('genocide');
    expect(mockElements['write-modal'].classList.contains('hidden')).toBe(true);
  });

  it('確定ボタンクリックで、core.respond がなく data.resolver がある場合に resolver で送信されること', () => {
    const resolver = vi.fn();
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SCROLL',
        writeService: writeService,
      },
      resolver,
    };

    // core.respond なしの状態をシミュレート
    const mgrWithoutCore = new ModalManager({
      getCore: () => null,
      getLoadedTileImagePath: () => '',
      onRestartGame: vi.fn(),
    });

    mgrWithoutCore.handleInputRequired(data);

    const btnSubmit = mockElements['btn-write-submit'];
    btnSubmit.click();

    expect(resolver).toHaveBeenCalledWith('genocide');
    expect(mockElements['write-modal'].classList.contains('hidden')).toBe(true);
  });

  it('キャンセルボタンクリックで、core.respond(\'\') が送信されモーダルが閉じること', () => {
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SCROLL',
        writeService: writeService,
      },
    };

    modalManager.handleInputRequired(data);

    const btnCancel = mockElements['btn-write-cancel'];
    btnCancel.click();

    expect(mockCore.respond).toHaveBeenCalledWith('');
    expect(mockElements['write-modal'].classList.contains('hidden')).toBe(true);
  });

  it('未識別アイテム選択時に安全性警告（未識別警告）が表示されること', () => {
    const data = {
      subCategory: 'WRITE',
      assistant: {
        type: 'WRITE',
        targetType: 'SCROLL',
        writeService: writeService,
      },
    };

    modalManager.handleInputRequired(data);

    const searchInput = mockElements['write-search-input'];
    searchInput.value = 'amnesia';
    searchInput.oninput();

    const safetyBox = mockElements['write-safety-box'];
    expect(safetyBox.classList.contains('danger')).toBe(true);

    const safetyText = mockElements['write-safety-text'];
    expect(safetyText.textContent).toContain('未識別');
  });
});

describe('ModalManager - ゲームオーバー＆スコアボードレンダリングテスト', () => {
  let modalManager;
  let mockElements;
  let mockCore;

  const sampleScores = [
    { points: 5000, name: 'Val', role: 'Valkyrie', death: 'killed by a cockatrice' },
    { points: 3000, name: 'Wiz', role: 'Wizard', death: 'died of starvation' },
    { points: 1500, name: 'Rog', role: 'Rogue', death: 'petrified by touching a chickatrice corpse' },
    { points: 800, name: 'Bar', role: 'Barbarian', death: 'drowned in a pool of water' },
    { points: 100, name: 'Tou', role: 'Tourist', death: '' },
  ];

  beforeEach(() => {
    mockElements = {
      elGameOverModal: createMockElement('gameover-modal'),
      elGameOverSummary: createMockElement('gameover-summary'),
      elScoreboardContainer: createMockElement('gameover-scoreboard'),
    };

    globalThis.document = {
      getElementById: (id) => {
        if (!mockElements[id]) {
          mockElements[id] = createMockElement(id);
        }
        return mockElements[id];
      },
      createElement: (tag) => createMockElement('', tag),
    };

    mockCore = {
      respond: vi.fn(),
      sendKey: vi.fn(),
    };

    modalManager = new ModalManager({
      ...mockElements,
      getCore: () => mockCore,
      getLoadedTileImagePath: () => '',
      onRestartGame: vi.fn(),
    });
  });

  it('renderScoreboard: 複数件のスコアレコード（英語死因混在）を与えて例外なくテーブルが生成されること (日本語モード)', () => {
    modalManager.currentLanguage = 'ja';
    expect(() => {
      modalManager.renderScoreboard(sampleScores);
    }).not.toThrow();

    expect(mockElements.elScoreboardContainer.children.length).toBe(1);
    const table = mockElements.elScoreboardContainer.children[0];
    expect(table.innerHTML).toContain('コカトリスに倒された');
    expect(table.innerHTML).toContain('飢えにより力尽きた');
    expect(table.innerHTML).toContain('石化した');
    expect(table.innerHTML).toContain('水底に沈んで溺死した');
    expect(table.innerHTML).toContain('5000');
  });

  it('renderScoreboard: 英語モード時には英語死因がそのまま表示されること', () => {
    modalManager.currentLanguage = 'en';
    modalManager.renderScoreboard(sampleScores);

    const table = mockElements.elScoreboardContainer.children[0];
    expect(table.innerHTML).toContain('killed by a cockatrice');
    expect(table.innerHTML).toContain('died of starvation');
  });

  it('renderScoreboard: translateDeathReason が未定義の場合でもフォールバックで例外なく描画されること (防御的呼び出し保証)', () => {
    modalManager.currentLanguage = 'ja';
    const originalMethod = PostMortemKnowledgeResolver.translateDeathReason;
    try {
      // メソッドを一時的に削除・未定義化して検証
      PostMortemKnowledgeResolver.translateDeathReason = undefined;

      expect(() => {
        modalManager.renderScoreboard(sampleScores);
      }).not.toThrow();

      const table = mockElements.elScoreboardContainer.children[0];
      // resolve フォールバックにより日本語化されているか確認
      expect(table.innerHTML).toContain('コカトリスに倒された');
    } finally {
      PostMortemKnowledgeResolver.translateDeathReason = originalMethod;
    }
  });

  it('handleExited: ゲームオーバー時にスコアボードとサバイバルアドバイスが正常に描画されること', () => {
    modalManager.currentLanguage = 'ja';
    const exitResult = {
      reason: 'death',
      death: 'killed by a cockatrice',
      finalScore: 4200,
      playerName: 'Heroine',
      scoreboard: sampleScores,
    };

    expect(() => {
      modalManager.handleExited(exitResult);
    }).not.toThrow();

    // モーダルが表示状態になっていること
    expect(mockElements.elGameOverModal.classList.contains('hidden')).toBe(false);

    // サマリー表示に日本語死因が含まれること
    expect(mockElements.elGameOverSummary.innerHTML).toContain('コカトリスに倒された');
    expect(mockElements.elGameOverSummary.innerHTML).toContain('Heroine');
    expect(mockElements.elGameOverSummary.innerHTML).toContain('4200');

    // スコアボードテーブルが生成されていること
    expect(mockElements.elScoreboardContainer.children.length).toBe(1);
  });
});

describe('ModalManager - メニュー描画 (category === "MENU") & インベントリ/サブメニュー分離テスト', () => {
  let modalManager;
  let mockElements;
  let mockCore;
  let mockInvManager;

  beforeEach(() => {
    mockElements = {
      elMenuModal: createMockElement('menu-modal'),
      elMenuTitle: createMockElement('menu-title'),
      elMenuItemsContainer: createMockElement('menu-items-container'),
      elBtnCancelMenu: createMockElement('btn-cancel-menu'),
    };

    globalThis.document = {
      getElementById: (id) => mockElements[id] || (mockElements[id] = createMockElement(id)),
      createElement: (tag) => createMockElement('', tag),
    };

    const swordItem = {
      _canonical: true,
      letter: 'a',
      name: 'short sword',
      cleanName: 'short sword',
      nameJa: 'ショートソード',
      displayNameJa: 'ショートソード',
      rawText: 'an uncursed +1 short sword (weapon in right hand)',
      isWielded: true,
      bucStatus: 'UNCURSED',
      spe: 1,
      glyphId: 100,
    };

    const foodItem = {
      _canonical: true,
      letter: 'i',
      name: 'food ration',
      cleanName: 'food ration',
      nameJa: '食料の配給',
      displayNameJa: '食料の配給',
      rawText: 'an uncursed food ration',
      bucStatus: 'UNCURSED',
      glyphId: 101,
    };

    mockInvManager = {
      getItemByLetter: vi.fn((letter) => {
        if (letter === 'a') return swordItem;
        if (letter === 'i') return foodItem;
        return null;
      }),
    };

    mockCore = {
      respond: vi.fn(),
      sendKey: vi.fn(),
      translate: vi.fn((text) => {
        if (text === 'put something in') return '何かを入れる';
        if (text === 'take something out') return '何かを取り出す';
        if (text === 'Look inside the sack') return '中身を見る';
        if (text === 'wield it') return '装備する';
        if (text === 'drop it') return '落とす';
        return text;
      }),
      getGlyphHtml: vi.fn((glyphId) => `<img src="tile_${glyphId}.png" />`),
      gkl: {
        inventoryStateManager: mockInvManager,
      },
    };

    modalManager = new ModalManager({
      ...mockElements,
      getCore: () => mockCore,
      getLoadedTileImagePath: () => 'tiles.png',
    });
  });

  it('標準インベントリメニュー（i）では、一致するアイテム行が CanonicalItem プレゼンタ経由でリッチに描画されること', () => {
    modalManager.currentLanguage = 'ja';
    const data = {
      category: 'MENU',
      rawPrompt: 'Inventory',
      menuItems: [
        { str: 'a - an uncursed +1 short sword (weapon in right hand)', ch: 97, charStr: 'a' }
      ]
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elMenuItemsContainer.children.length).toBe(1);
    const btn = mockElements.elMenuItemsContainer.children[0];
    // 和名ショートソードとレターバッジ、装備状態が含まれること
    expect(btn.innerHTML).toContain('ショートソード');
    expect(btn.innerHTML).toContain('a)');
    expect(btn.innerHTML).toContain('badge-wielded');
  });

  it('アクション選択サブメニュー（What do you want to do with...）では、手持ちアイテム名が紛れ込まずアクション名として描画されること', () => {
    modalManager.currentLanguage = 'ja';
    const data = {
      category: 'MENU',
      rawPrompt: 'What do you want to do with the +1 short sword?',
      menuItems: [
        { str: 'wield it', ch: 97, charStr: 'a' },
        { str: 'drop it', ch: 98, charStr: 'b' }
      ]
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elMenuItemsContainer.children.length).toBe(2);
    const btn1 = mockElements.elMenuItemsContainer.children[0];
    const btn2 = mockElements.elMenuItemsContainer.children[1];

    // a) ボタンにインベントリのショートソードが化けて紛れ込まず、アクション（装備する / wield it）が表示されること
    expect(btn1.innerHTML).not.toContain('ショートソード');
    expect(btn1.innerHTML).toContain('装備する');
    expect(btn1.innerHTML).toContain('a)');

    // b) ボタンもドロップアクションが表示されること
    expect(btn2.innerHTML).toContain('落とす');
    expect(btn2.innerHTML).toContain('b)');
  });

  it('サック（袋）のサブメニューで accelerator が "i" であっても、インベントリの食料に化けず「何かを入れる」と描画されること', () => {
    modalManager.currentLanguage = 'ja';
    const data = {
      category: 'MENU',
      rawPrompt: 'What do you want to do with the sack?',
      menuItems: [
        { str: 'Look inside the sack', ch: 58, charStr: ':' },
        { str: 'put something in', ch: 105, charStr: 'i' }
      ]
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elMenuItemsContainer.children.length).toBe(2);
    const btn1 = mockElements.elMenuItemsContainer.children[0];
    const btn2 = mockElements.elMenuItemsContainer.children[1];

    expect(btn1.innerHTML).toContain('中身を見る');
    expect(btn1.innerHTML).toContain(':)');

    // i) ボタンに食料の配給が化けて紛れ込まず、「何かを入れる」が表示されること
    expect(btn2.innerHTML).not.toContain('食料の配給');
    expect(btn2.innerHTML).toContain('何かを入れる');
    expect(btn2.innerHTML).toContain('i)');
  });

  it('キャラ作成やカテゴリ選択など非アイテムメニューで accelerator が "a" であっても、インベントリアイテムに化けないこと', () => {
    modalManager.currentLanguage = 'ja';
    const data = {
      category: 'MENU',
      rawPrompt: 'Choose a role',
      menuItems: [
        { str: 'Archeologist', ch: 97, charStr: 'a' }
      ]
    };

    modalManager.handleInputRequired(data);

    expect(mockElements.elMenuItemsContainer.children.length).toBe(1);
    const btn = mockElements.elMenuItemsContainer.children[0];
    expect(btn.innerHTML).not.toContain('ショートソード');
    expect(btn.innerHTML).toContain('Archeologist');
    expect(btn.innerHTML).toContain('a)');
  });
});


