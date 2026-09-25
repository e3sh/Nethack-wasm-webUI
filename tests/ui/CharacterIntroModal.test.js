/**
 * CharacterIntroModal.test.js
 * 
 * Roadmap 2.1 Phase C: ゲーム開始導入フロー最適化
 * CharacterIntroModal (ASKNAME 名前入力カード ＆ ynaq キャラクタ作成モード選択カード) の単体・統合テスト
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CharacterIntroModal } from '../../examples/gkl-pure-js-client/modules/components/CharacterIntroModal.js';
import { ModalManager } from '../../examples/gkl-pure-js-client/modules/components/ModalManager.js';

// 軽量DOMモック
function createMockElement(tagName = 'div', id = '', mockElements = {}) {
  const classListSet = new Set();
  const attributes = {};
  const children = [];
  const listeners = {};
  const style = {};
  let _innerHTML = '';

  const el = {
    tagName: tagName.toUpperCase(),
    id,
    className: '',
    value: '',
    textContent: '',
    style,
    dataset: {},
    classList: {
      add: (...classes) => classes.forEach(cls => classListSet.add(cls)),
      remove: (...classes) => classes.forEach(cls => classListSet.delete(cls)),
      toggle: (cls, force) => {
        if (force === undefined) {
          if (classListSet.has(cls)) classListSet.delete(cls);
          else classListSet.add(cls);
        } else if (force) classListSet.add(cls);
        else classListSet.delete(cls);
      },
      contains: (cls) => classListSet.has(cls)
    },
    setAttribute: (k, v) => { attributes[k] = v; },
    getAttribute: (k) => attributes[k] || null,
    appendChild: (child) => {
      children.push(child);
      child.parentElement = el;
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentElement = null;
      return child;
    },
    addEventListener: (type, fn) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener: (type, fn) => {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter(f => f !== fn);
    },
    focus: vi.fn(),
    select: vi.fn(),
    click: () => {
      if (el.onclick) el.onclick();
      if (listeners['click']) listeners['click'].forEach(f => f({ type: 'click', target: el }));
    },
    querySelector: (sel) => {
      if (sel === '.char-intro-card') {
        if (!el._mockCard) {
          el._mockCard = createMockElement('div', '', mockElements);
          el._mockCard.classList.add('char-intro-card');
        }
        return el._mockCard;
      }
      return el._mockChildren?.[sel] || null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.char-mode-card') {
        const matches = [];
        const regex = /class="[^"]*char-mode-card[^"]*".*?data-key="([^"]+)"/gs;
        let m;
        while ((m = regex.exec(_innerHTML)) !== null) {
          const cardEl = createMockElement('button', '', mockElements);
          cardEl.dataset.key = m[1];
          matches.push(cardEl);
        }
        return matches;
      }
      return el._mockList?.[sel] || [];
    }
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => _innerHTML,
    set: (html) => {
      _innerHTML = html;
      // HTML文字列から id="..." を検出してモック登録
      const idMatches = html.matchAll(/id="([^"]+)"/g);
      for (const match of idMatches) {
        const elemId = match[1];
        if (!mockElements[elemId]) {
          const newEl = createMockElement('div', elemId, mockElements);
          mockElements[elemId] = newEl;
        }
      }
    }
  });

  return el;
}

describe('CharacterIntroModal - Phase C 導入フロー最適化テスト', () => {
  let mockDoc;
  let mockWindow;
  let mockElements;
  let windowListeners;

  beforeEach(() => {
    mockElements = {};
    windowListeners = {};

    mockDoc = {
      createElement: (tag) => createMockElement(tag, '', mockElements),
      getElementById: (id) => {
        if (!mockElements[id]) {
          mockElements[id] = createMockElement('div', id, mockElements);
        }
        return mockElements[id];
      },
      body: {
        appendChild: (el) => {
          if (el.id) mockElements[el.id] = el;
          return el;
        }
      }
    };

    mockWindow = {
      addEventListener: (type, fn) => {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(fn);
      },
      removeEventListener: (type, fn) => {
        if (!windowListeners[type]) return;
        windowListeners[type] = windowListeners[type].filter(f => f !== fn);
      }
    };

    global.document = mockDoc;
    global.window = mockWindow;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('1. isYnaqPrompt クラスメソッド判定', () => {
    it('公式の ynaq 質問（英語・大文字小文字問わず）を正しく ynaq プロンプトと判定すること', () => {
      const data = {
        promptCategory: 'YN',
        context: 'yn_function',
        query: "Shall I pick character's race, role, gender and alignment for you? [ynaq]"
      };
      expect(CharacterIntroModal.isYnaqPrompt(data)).toBe(true);
    });

    it('日本語翻訳された ynaq 質問を正しく ynaq プロンプトと判定すること', () => {
      const data = {
        category: 'YN',
        type: 'yn',
        prompt: 'キャラクターの種族、役割、性別、属性を選んであげましょうか？ [ynaq]'
      };
      expect(CharacterIntroModal.isYnaqPrompt(data)).toBe(true);
    });

    it('通常のアイテム拾いや質問プロンプトは ynaq プロンプトと判定しないこと', () => {
      const goldPrompt = {
        promptCategory: 'YN',
        prompt: 'Shall I pick up the gold? [y/n]'
      };
      expect(CharacterIntroModal.isYnaqPrompt(goldPrompt)).toBe(false);

      const savePrompt = {
        promptCategory: 'YN',
        prompt: 'Do you really want to quit? [y/n]'
      };
      expect(CharacterIntroModal.isYnaqPrompt(savePrompt)).toBe(false);
    });
  });

  describe('2. showAskName（名前入力カード）の動作', () => {
    it('ASKNAME プロンプト時にデフォルト名が表示され、確定時に core.respond と名前同期が行われること', () => {
      const mockCore = {
        playerName: 'Hero',
        setPlayerName: vi.fn(),
        respond: vi.fn()
      };
      const mockCcm = { characterName: '' };

      const intro = new CharacterIntroModal({
        getCore: () => mockCore,
        characterCreationModal: mockCcm,
        currentLanguage: 'ja'
      });

      const askData = {
        promptCategory: 'ASKNAME',
        context: 'askname',
        detectedName: 'Explorer'
      };

      intro.showAskName(askData);

      expect(intro.isVisible).toBe(true);
      expect(intro.activeType).toBe('ASKNAME');
      expect(intro.elModal.classList.contains('hidden')).toBe(false);

      // DOM内の入力要素を取得
      const inputEl = mockDoc.getElementById('intro-name-input');
      expect(inputEl).toBeDefined();
      expect(inputEl.value).toBe('Explorer');

      // 決定ボタンをクリック
      const btnConfirm = mockDoc.getElementById('btn-intro-confirm-name');
      btnConfirm.click();

      expect(mockCcm.characterName).toBe('Explorer');
      expect(mockCore.setPlayerName).toHaveBeenCalledWith('Explorer');
      expect(mockCore.respond).toHaveBeenCalledWith('Explorer');
      expect(intro.isVisible).toBe(false);

      // スライドアウトアニメーション後のDOM非表示化確認
      vi.advanceTimersByTime(250);
      expect(intro.elModal.classList.contains('hidden')).toBe(true);
    });

    it('ランダムネーム生成ボタン（🎲）を押すと名前が変更されること', () => {
      const mockCore = { respond: vi.fn(), setPlayerName: vi.fn() };
      const intro = new CharacterIntroModal({
        getCore: () => mockCore,
        currentLanguage: 'ja'
      });

      intro.showAskName({ promptCategory: 'ASKNAME', defaultName: 'Hero' });
      const inputEl = mockDoc.getElementById('intro-name-input');
      const btnRoll = mockDoc.getElementById('btn-intro-roll-name');

      expect(inputEl.value).toBe('Hero');
      btnRoll.click();

      // ランダムプールから選ばれて非空であること
      expect(inputEl.value.length).toBeGreaterThan(0);
      expect(inputEl.select).toHaveBeenCalled();
    });

    it('Enterキーで名前が送信され、Escapeキーでキャンセルされること', () => {
      const mockCore = {
        respond: vi.fn(),
        cancelPrompt: vi.fn(),
        setPlayerName: vi.fn()
      };
      const intro = new CharacterIntroModal({
        getCore: () => mockCore,
        currentLanguage: 'ja'
      });

      intro.showAskName({ promptCategory: 'ASKNAME', defaultName: 'Hero' });
      const inputEl = mockDoc.getElementById('intro-name-input');
      inputEl.value = 'Valkyrie';

      // Enter キーイベント
      const enterEvent = {
        key: 'Enter',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };
      intro.handleKeyDown(enterEvent);

      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(mockCore.respond).toHaveBeenCalledWith('Valkyrie');
      expect(intro.isVisible).toBe(false);

      // 再度表示して Escape キーイベント
      intro.showAskName({ promptCategory: 'ASKNAME' });
      const escEvent = {
        key: 'Escape',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      };
      intro.handleKeyDown(escEvent);

      expect(escEvent.preventDefault).toHaveBeenCalled();
      expect(mockCore.cancelPrompt).toHaveBeenCalled();
      expect(intro.isVisible).toBe(false);
    });
  });

  describe('3. showModeSelect（ynaq モード選択カード）の動作', () => {
    it('ynaq プロンプト時に3大カード選択肢が表示され、キー入力およびクリックで正しく応答すること', () => {
      const mockCore = { respond: vi.fn() };
      const intro = new CharacterIntroModal({
        getCore: () => mockCore,
        currentLanguage: 'ja'
      });

      const ynaqData = {
        promptCategory: 'YN',
        context: 'yn_function',
        query: "Shall I pick character's race, role, gender and alignment for you? [ynaq]"
      };

      intro.showModeSelect(ynaqData);

      expect(intro.isVisible).toBe(true);
      expect(intro.activeType).toBe('MODE_SELECT');
      expect(intro.elModal.innerHTML).toContain('おまかせ作成');
      expect(intro.elModal.innerHTML).toContain('自分で詳細に選ぶ');
      expect(intro.elModal.innerHTML).toContain('クイックスタート');

      // 'y' キーを押下 ➔ 'y' を送信
      const yEvent = { key: 'y', preventDefault: vi.fn(), stopPropagation: vi.fn() };
      intro.handleKeyDown(yEvent);
      expect(mockCore.respond).toHaveBeenCalledWith('y');
      expect(intro.isVisible).toBe(false);

      // 'n' キーを押下 ➔ 'n' を送信
      intro.showModeSelect(ynaqData);
      const nEvent = { key: 'n', preventDefault: vi.fn(), stopPropagation: vi.fn() };
      intro.handleKeyDown(nEvent);
      expect(mockCore.respond).toHaveBeenCalledWith('n');
      expect(intro.isVisible).toBe(false);

      // 'q' キーを押下 ➔ 'q' を送信
      intro.showModeSelect(ynaqData);
      const qEvent = { key: 'q', preventDefault: vi.fn(), stopPropagation: vi.fn() };
      intro.handleKeyDown(qEvent);
      expect(mockCore.respond).toHaveBeenCalledWith('q');
      expect(intro.isVisible).toBe(false);
    });

    it('多言語切り替え（setLanguage）でタイトルやカード文言が英語/日本語に更新されること', () => {
      const intro = new CharacterIntroModal({
        getCore: () => ({}),
        currentLanguage: 'ja'
      });

      intro.showModeSelect({ promptCategory: 'YN', query: 'Shall I pick... [ynaq]' });
      expect(intro.elModal.innerHTML).toContain('キャラクター作成方法の選択');

      intro.setLanguage('en');
      expect(intro.elModal.innerHTML).toContain('Character Creation Mode');
      expect(intro.elModal.innerHTML).toContain('Detailed Creation (Manual)');
    });

    it('Step 1（名前入力）と Step 2（モード選択）でステップインジケーターとスライドクラスが正しく切り替わること', () => {
      const mockCore = { respond: vi.fn(), setPlayerName: vi.fn() };
      const intro = new CharacterIntroModal({
        getCore: () => mockCore,
        currentLanguage: 'ja'
      });

      // Step 1: 名前入力表示
      intro.showAskName({ promptCategory: 'ASKNAME', defaultName: 'Hero' });
      expect(intro.elModal.innerHTML).toContain('char-step-indicator');
      expect(intro.elModal.innerHTML).toContain('char-step-node active');
      expect(intro.elModal.innerHTML).toContain('名前決定');

      // 決定実行 ➔ 左スライドアウト
      intro.confirmName('Roland');
      const card = intro.elModal.querySelector('.char-intro-card');
      expect(card.classList.contains('animate-slide-out-left')).toBe(true);

      // Step 2: ynaq プロンプト到達で右からスライドイン
      intro.showModeSelect({
        promptCategory: 'YN',
        context: 'yn_function',
        query: "Shall I pick character's race, role... [ynaq]"
      });
      expect(intro.elModal.innerHTML).toContain('animate-slide-in-right');
      expect(intro.elModal.innerHTML).toContain('char-step-node completed');
      expect(intro.elModal.innerHTML).toContain('char-step-line active');
    });
  });

  describe('4. ModalManager との統合動作', () => {
    it('ModalManager.handleInputRequired が ASKNAME プロンプトを受け取ったとき、CharacterIntroModal.showAskName を起動すること', () => {
      const mockCore = { respond: vi.fn() };
      const intro = new CharacterIntroModal({ getCore: () => mockCore });
      vi.spyOn(intro, 'showAskName');

      const modalManager = new ModalManager({
        getCore: () => mockCore,
        characterIntroModal: intro
      });

      const askData = {
        category: 'ASKNAME',
        context: 'askname',
        prompt: 'What is your name?'
      };

      modalManager.handleInputRequired(askData);

      expect(intro.showAskName).toHaveBeenCalledWith(askData);
      expect(modalManager.isAnyModalOpen()).toBe(true);
    });

    it('ModalManager.handleInputRequired が ynaq プロンプトを受け取ったとき、CharacterIntroModal.showModeSelect を起動すること', () => {
      const mockCore = { respond: vi.fn() };
      const intro = new CharacterIntroModal({ getCore: () => mockCore });
      vi.spyOn(intro, 'showModeSelect');

      const modalManager = new ModalManager({
        getCore: () => mockCore,
        characterIntroModal: intro
      });

      const ynaqData = {
        promptCategory: 'YN',
        context: 'yn_function',
        query: "Shall I pick character's race, role, gender and alignment for you? [ynaq]"
      };

      modalManager.handleInputRequired(ynaqData);

      expect(intro.showModeSelect).toHaveBeenCalledWith(ynaqData);
      expect(modalManager.isAnyModalOpen()).toBe(true);
    });
  });
});
