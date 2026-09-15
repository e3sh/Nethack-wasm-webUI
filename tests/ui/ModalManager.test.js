/**
 * ModalManager.test.js
 *
 * ModalManager の promptCategory UI 演出（特に KEY カテゴリのバウンスアニメーション演出）の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModalManager } from '../../examples/gkl-pure-js-client/modules/components/ModalManager.js';
import { PROMPT_CATEGORY } from '../../src/core/types.js';
import { WriteService } from '../../src/core/knowledge/WriteService.js';

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

