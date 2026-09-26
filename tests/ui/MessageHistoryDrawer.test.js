/**
 * MessageHistoryDrawer.test.js
 *
 * 過去ログドロワーコンポーネント (MessageHistoryDrawer) の単体テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageHistoryDrawer } from '../../examples/gkl-pure-js-client/modules/components/MessageHistoryDrawer.js';

function createMockElement(tagName = 'div') {
  const classListSet = new Set();
  const children = [];
  let _className = '';
  const el = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    children,
    dataset: {},
    onclick: null,
    classList: {
      add: (...classes) => classes.forEach(c => classListSet.add(c)),
      remove: (...classes) => classes.forEach(c => classListSet.delete(c)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classListSet.has(c)) classListSet.delete(c);
          else classListSet.add(c);
        } else if (force) classListSet.add(c);
        else classListSet.delete(c);
      },
      contains: (c) => classListSet.has(c)
    },
    appendChild: (child) => {
      children.push(child);
      child.parentNode = el;
      el.scrollHeight = children.length * 30;
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
      el.scrollHeight = children.length * 30;
      return child;
    },
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 200,
    scrollTo: vi.fn(({ top }) => {
      el.scrollTop = top;
    })
  };

  Object.defineProperty(el, 'className', {
    get: () => _className,
    set: (val) => {
      _className = val;
      classListSet.clear();
      if (val) {
        val.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
      }
    }
  });

  Object.defineProperty(el, 'innerHTML', {
    get: () => '',
    set: () => {
      children.length = 0;
    }
  });

  return el;
}

describe('MessageHistoryDrawer - 過去ログドロワー', () => {
  let mockDoc;
  let drawerElement;
  let listElement;
  let backdropElement;
  let btnClose;
  let btnPin;
  let btnModeBilingual;
  let btnModeJa;
  let btnModeRaw;
  let mockCore;
  let drawer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDoc = {
      createElement: vi.fn((tagName) => createMockElement(tagName))
    };
    drawerElement = createMockElement('div');
    drawerElement.classList.add('hidden');
    listElement = createMockElement('div');
    backdropElement = createMockElement('div');
    backdropElement.classList.add('hidden');
    btnClose = createMockElement('button');
    btnPin = createMockElement('button');
    btnModeBilingual = createMockElement('button');
    btnModeJa = createMockElement('button');
    btnModeRaw = createMockElement('button');

    mockCore = {
      getMessageItems: vi.fn().mockReturnValue([
        { id: 1, rawText: 'Hello world', text: 'こんにちは世界', isBold: false, isLatest: false },
        { id: 2, rawText: 'You die.', text: 'あなたは死んだ。', isBold: true, isLatest: true }
      ])
    };

    drawer = new MessageHistoryDrawer({
      drawerElement,
      listElement,
      backdropElement,
      btnClose,
      btnPin,
      btnModeBilingual,
      btnModeJa,
      btnModeRaw,
      getCore: () => mockCore,
      document: mockDoc
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('1. open: ドロワーが開き、openクラスが付与されリストが描画されること', () => {
    drawer.open();

    expect(drawer.isOpen()).toBe(true);
    expect(drawerElement.classList.contains('open')).toBe(true);
    expect(drawerElement.classList.contains('hidden')).toBe(false);
    expect(backdropElement.classList.contains('open')).toBe(true);
    expect(backdropElement.classList.contains('hidden')).toBe(false);

    // リストに 2 件のメッセージ行がレンダリングされていること
    expect(listElement.children.length).toBe(2);
  });

  it('2. close: ドロワーが閉じ、タイマー後にhiddenが付与されること', () => {
    drawer.open();
    expect(drawer.isOpen()).toBe(true);

    drawer.close();
    expect(drawer.isOpen()).toBe(false);
    expect(drawerElement.classList.contains('open')).toBe(false);

    // 250ms のトランジション完了
    vi.advanceTimersByTime(250);
    expect(drawerElement.classList.contains('hidden')).toBe(true);
  });

  it('3. toggle: 開閉が交互に切り替わること', () => {
    expect(drawer.isOpen()).toBe(false);
    drawer.toggle();
    expect(drawer.isOpen()).toBe(true);
    drawer.toggle();
    expect(drawer.isOpen()).toBe(false);
  });

  it('4. renderList (bilingual): 日本語と英語原文の両方が配置されること', () => {
    drawer.open();

    const latestRow = listElement.children[1];
    expect(latestRow.classList.contains('age-latest')).toBe(true);
    expect(latestRow.classList.contains('is-bold')).toBe(true);

    const contentBox = latestRow.children[0];
    // 日本語要素と原文要素の2つが含まれていること
    expect(contentBox.children.length).toBe(2);
    expect(contentBox.children[0].textContent).toBe('あなたは死んだ。');
    expect(contentBox.children[1].textContent).toBe('You die.');
  });

  it('5. setDisplayMode (ja): 日本語のみモードに切り替わること', () => {
    drawer.open();
    drawer.setDisplayMode('ja');

    expect(drawer.displayMode).toBe('ja');
    const latestRow = listElement.children[1];
    const contentBox = latestRow.children[0];
    // 日本語要素のみ1つ
    expect(contentBox.children.length).toBe(1);
    expect(contentBox.children[0].textContent).toBe('あなたは死んだ。');
  });

  it('6. setDisplayMode (raw): 原文のみモードに切り替わること', () => {
    drawer.open();
    drawer.setDisplayMode('raw');

    expect(drawer.displayMode).toBe('raw');
    const latestRow = listElement.children[1];
    const contentBox = latestRow.children[0];
    // 原文要素のみ1つ
    expect(contentBox.children.length).toBe(1);
    expect(contentBox.children[0].textContent).toBe('You die.');
  });

  it('7. copyRawText: クリップボードAPIが呼び出されること', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    try {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true
      });
    } catch {
      vi.stubGlobal('navigator', { clipboard: { writeText: writeTextMock } });
    }

    const triggerBtn = createMockElement('button');
    triggerBtn.textContent = '📋';

    await drawer.copyRawText('Test copy text', triggerBtn);
    expect(writeTextMock).toHaveBeenCalledWith('Test copy text');
    expect(triggerBtn.textContent).toBe('✅');

    vi.advanceTimersByTime(1200);
    expect(triggerBtn.textContent).toBe('📋');
  });

  it('8. togglePin: 画面左側ピン留め (docked-left) が切り替わり、暗幕が隠れること', () => {
    expect(drawer.isPinned).toBe(false);

    drawer.togglePin();
    expect(drawer.isPinned).toBe(true);
    expect(drawer.isOpen()).toBe(true);
    expect(drawerElement.classList.contains('docked-left')).toBe(true);
    expect(btnPin.classList.contains('active')).toBe(true);
    // ピン留め中はゲーム操作を可能にするため暗幕が非表示であること
    expect(backdropElement.classList.contains('hidden')).toBe(true);

    drawer.togglePin();
    expect(drawer.isPinned).toBe(false);
    expect(drawerElement.classList.contains('docked-left')).toBe(false);
    expect(btnPin.classList.contains('active')).toBe(false);
  });

  it('9. close: ピン留め中にcloseが呼ばれた場合、ピン留めがOFFに解除されること', () => {
    drawer.setPinned(true);
    expect(drawer.isPinned).toBe(true);

    drawer.close();
    expect(drawer.isPinned).toBe(false);
    expect(drawerElement.classList.contains('docked-left')).toBe(false);
    expect(btnPin.classList.contains('active')).toBe(false);
  });

  it('10. onPinStateChanged: ピン留め状態変更コールバックが呼ばれること', () => {
    const callback = vi.fn();
    drawer.onPinStateChanged = callback;

    drawer.setPinned(true);
    expect(callback).toHaveBeenCalledWith(true);

    drawer.setPinned(false);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it('11. renderList: 新着メッセージが届いた際、最下部へ自動スクロールされること', () => {
    drawer.open();
    expect(listElement.children.length).toBe(2);

    // 新着メッセージが1件追加された状況をシミュレート
    mockCore.getMessageItems.mockReturnValue([
      { id: 1, rawText: 'Hello world', text: 'こんにちは世界', isBold: false, isLatest: false },
      { id: 2, rawText: 'You die.', text: 'あなたは死んだ。', isBold: false, isLatest: false },
      { id: 3, rawText: 'Do you want your possessions identified?', text: '持ち物を鑑定しますか？', isBold: true, isLatest: true }
    ]);

    drawer.renderList();
    expect(listElement.children.length).toBe(3);
    // 最下部 (scrollHeight = 3 * 30 = 90) へスクロールされたこと
    expect(listElement.scrollTop).toBe(90);
  });

  it('12. setLanguage (en): 英語モード時は自動的にraw表示になり、モード切替トグルが非表示になること', () => {
    const modeToggleEl = createMockElement('div');
    const titleEl = createMockElement('span');
    titleEl.textContent = '初期タイトル';

    const enDrawer = new MessageHistoryDrawer({
      drawerElement,
      listElement,
      backdropElement,
      btnClose,
      btnPin,
      btnModeBilingual,
      btnModeJa,
      btnModeRaw,
      modeToggleElement: modeToggleEl,
      titleElement: titleEl,
      language: 'en',
      getCore: () => mockCore,
      document: mockDoc
    });

    // 初期化時点で英語モード
    expect(enDrawer.currentLanguage).toBe('en');
    expect(enDrawer.displayMode).toBe('raw');
    expect(modeToggleEl.classList.contains('hidden')).toBe(true);
    expect(titleEl.textContent).toBe('Message History');
    expect(btnClose.title).toBe('Close [ESC]');
    expect(btnPin.title).toBe('Dock to left (Keep open)');

    // 日本語に戻したとき
    enDrawer.setLanguage('ja');
    expect(enDrawer.currentLanguage).toBe('ja');
    expect(modeToggleEl.classList.contains('hidden')).toBe(false);
    expect(enDrawer.displayMode).toBe('bilingual');
    expect(titleEl.textContent).toBe('メッセージ過去ログ (Message History)');
    expect(btnClose.title).toBe('閉じる [ESC]');
  });
});

