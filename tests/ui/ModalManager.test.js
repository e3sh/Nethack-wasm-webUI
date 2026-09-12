/**
 * ModalManager.test.js
 *
 * ModalManager の promptCategory UI 演出（特に KEY カテゴリのバウンスアニメーション演出）の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModalManager } from '../../examples/gkl-pure-js-client/modules/components/ModalManager.js';
import { PROMPT_CATEGORY } from '../../src/core/types.js';

function createMockElement(id = '', tag = 'div') {
  const classListSet = new Set(['hidden']);
  let innerHTML = '';
  let textContent = '';

  const el = {
    id,
    tagName: tag.toUpperCase(),
    style: {},
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      contains: (cls) => classListSet.has(cls),
    },
    addEventListener: vi.fn(),
    appendChild: vi.fn(),
    querySelectorAll: () => [],
    querySelector: () => null,
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => innerHTML,
    set: (val) => { innerHTML = val; },
  });

  Object.defineProperty(el, 'textContent', {
    get: () => textContent,
    set: (val) => { textContent = val; },
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
      getElementById: (id) => mockElements[id] || createMockElement(id),
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
});
