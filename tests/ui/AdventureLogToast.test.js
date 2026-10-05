/**
 * AdventureLogToast.test.js
 *
 * 冒険手帳のリアルタイム発見HUDトースト通知コンポーネントの単体テスト
 * 特に大量アンロック発生時の無限ループ防止・DOM要素上限管理・メモリ安全性を検証する。
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AdventureLogToast } from '../../examples/gkl-pure-js-client/modules/components/AdventureLogToast.js';

function createMockContainer() {
  const children = [];
  const container = {
    id: 'mock-body',
    style: {},
    children,
    appendChild: vi.fn((child) => {
      child.parentNode = container;
      children.push(child);
      return child;
    }),
    removeChild: vi.fn((child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    })
  };
  return container;
}

describe('AdventureLogToast', () => {
  let mockContainer;
  let toastManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mockContainer = createMockContainer();

    // グローバル document のモック補完
    if (typeof globalThis.document === 'undefined') {
      globalThis.document = {
        body: mockContainer,
        getElementById: vi.fn(() => null),
        createElement: (tag) => {
          const children = [];
          const el = {
            tagName: tag.toUpperCase(),
            style: {},
            dataset: {},
            children,
            innerHTML: '',
            className: '',
            parentNode: null,
            appendChild: vi.fn((c) => {
              c.parentNode = el;
              children.push(c);
              return c;
            }),
            removeChild: vi.fn((c) => {
              const idx = children.indexOf(c);
              if (idx !== -1) {
                children.splice(idx, 1);
                c.parentNode = null;
              }
              return c;
            }),
            addEventListener: vi.fn(),
            remove: vi.fn(() => {
              if (el.parentNode) el.parentNode.removeChild(el);
            })
          };
          return el;
        }
      };
    }

    toastManager = new AdventureLogToast({
      container: mockContainer,
      tileImage: 'pict/test.png'
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期化時にトースト用ラッパーDOM要素が生成されること', () => {
    expect(toastManager.toastWrapper).toBeDefined();
    expect(toastManager.toastWrapper.id).toBe('adventure-log-toast-wrapper');
  });

  it('モンスター新規遭遇時に正しいアイコンと文言でトーストが生成されること', () => {
    toastManager.notifyUnlock({
      category: 'monster',
      monOffset: 10,
      name: 'jackal',
      nameJa: 'ジャッカル'
    });

    expect(toastManager.toastWrapper.children.length).toBe(1);
    const toast = toastManager.toastWrapper.children[0];
    expect(toast.innerHTML).toContain('新種モンスター遭遇');
    expect(toast.innerHTML).toContain('ジャッカル');
  });

  it('アイテム新規登録時に正しい文言でトーストが生成されること', () => {
    toastManager.notifyUnlock({
      category: 'object',
      onum: 5,
      name: 'dagger',
      nameJa: '短剣'
    });

    expect(toastManager.toastWrapper.children.length).toBe(1);
    const toast = toastManager.toastWrapper.children[0];
    expect(toast.innerHTML).toContain('新アイテム入手');
    expect(toast.innerHTML).toContain('短剣');
  });

  it('英語モードで英語テキストが出力されること', () => {
    toastManager.setLanguage('en');
    toastManager.notifyUnlock({
      category: 'monster',
      monOffset: 15,
      name: 'goblin',
      nameJa: 'ゴブリン'
    });

    expect(toastManager.toastWrapper.children.length).toBe(1);
    const toast = toastManager.toastWrapper.children[0];
    expect(toast.innerHTML).toContain('New Monster Encountered');
    expect(toast.innerHTML).toContain('goblin');
  });

  it('【重要・DoD要件】100件連続で新規アンロックが発生しても無限ループにならず、表示上限 (maxVisible = 3) が維持されること', () => {
    const startTime = Date.now();

    // 100件の通知を瞬時に連続投入
    for (let i = 0; i < 100; i++) {
      toastManager.notifyUnlock({
        category: 'object',
        onum: i,
        name: `Item #${i}`,
        nameJa: `アイテム #${i}`
      });
    }

    const elapsed = Date.now() - startTime;
    // 無限ループが発生していた場合はここでタイムアウトまたはOOMになる
    expect(elapsed).toBeLessThan(1000);

    // 最大表示数 (maxVisible = 3) 以下に抑えられていること
    expect(toastManager.toastWrapper.children.length).toBeLessThanOrEqual(toastManager.maxVisible);
  });

  it('トーストをクリックした際にコールバックが安全に呼ばれること', () => {
    const clickSpy = vi.fn();
    const customToastManager = new AdventureLogToast({
      container: mockContainer,
      onToastClick: clickSpy
    });

    customToastManager.notifyUnlock({
      category: 'oracle',
      id: 'oracle_1',
      title: 'Delphi Oracle'
    });

    const toast = customToastManager.toastWrapper.children[0];
    expect(toast).toBeDefined();

    // click イベントリスナーの実行
    const clickHandler = toast.addEventListener.mock.calls.find(c => c[0] === 'click')?.[1];
    expect(clickHandler).toBeDefined();
    clickHandler();

    expect(clickSpy).toHaveBeenCalledWith(expect.objectContaining({
      category: 'oracle',
      id: 'oracle_1'
    }));
  });

  it('自動フェードアウトタイマー経過後に要素が破棄されること', () => {
    toastManager.notifyUnlock({
      category: 'rumor',
      text: 'Rumor text',
      isTrue: true
    });

    expect(toastManager.toastWrapper.children.length).toBe(1);
    const toast = toastManager.toastWrapper.children[0];

    // displayDurationMs (4000ms) 経過
    vi.advanceTimersByTime(toastManager.displayDurationMs);
    // フェードアニメーション 250ms 経過
    vi.advanceTimersByTime(300);

    expect(toastManager.toastWrapper.children.length).toBe(0);
  });
});
