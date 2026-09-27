/**
 * FloatingMessageHud.test.js
 *
 * フローティング最新行 HUD コンポーネント (FloatingMessageHud) の単体テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FloatingMessageHud } from '../../examples/gkl-pure-js-client/modules/components/FloatingMessageHud.js';

function createMockElement(tagName = 'div') {
  const classListSet = new Set();
  const children = [];
  let _className = '';
  const el = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    children,
    dataset: {},
    classList: {
      add: (...classes) => classes.forEach(c => classListSet.add(c)),
      remove: (...classes) => classes.forEach(c => classListSet.delete(c)),
      contains: (c) => classListSet.has(c)
    },
    appendChild: (child) => {
      children.push(child);
      child.parentNode = el;
      return child;
    },
    removeChild: (child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      child.parentNode = null;
      return child;
    }
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

  return el;
}

describe('FloatingMessageHud - フローティング最新行 HUD', () => {
  let mockDoc;
  let container;
  let hud;

  beforeEach(() => {
    vi.useFakeTimers();
    mockDoc = {
      createElement: vi.fn((tagName) => createMockElement(tagName))
    };
    container = createMockElement('div');
    hud = new FloatingMessageHud({
      container,
      maxLines: 3,
      fadeTimeoutMs: 3000,
      document: mockDoc
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('1. pushMessage: 最新行がコンテナに追加され、クラスと文面が設定されること', () => {
    hud.pushMessage({ id: 1, text: 'You see a stairway here.', isBold: false });

    expect(container.children.length).toBe(1);
    const line = container.children[0];
    expect(line.textContent).toBe('You see a stairway here.');
    expect(line.classList.contains('floating-message-line')).toBe(true);
    expect(line.classList.contains('bold')).toBe(false);
  });

  it('2. isBold: true の場合、bold クラスが付与されること', () => {
    hud.pushMessage({ id: 2, text: 'You hit the goblin!', isBold: true });

    expect(container.children.length).toBe(1);
    const line = container.children[0];
    expect(line.classList.contains('bold')).toBe(true);
  });

  it('3. maxLines (3行) を超えた場合、最古の行が自動で破棄されること', () => {
    hud.pushMessage({ id: 1, text: 'Line 1' });
    hud.pushMessage({ id: 2, text: 'Line 2' });
    hud.pushMessage({ id: 3, text: 'Line 3' });
    expect(container.children.length).toBe(3);

    hud.pushMessage({ id: 4, text: 'Line 4' });
    expect(container.children.length).toBe(3);
    expect(container.children[0].textContent).toBe('Line 2');
    expect(container.children[2].textContent).toBe('Line 4');
  });

  it('4. updateMessage: 同一IDのメッセージを太字に昇格できること', () => {
    hud.pushMessage({ id: 10, text: 'A chill runs down your spine.', isBold: false });
    expect(container.children[0].classList.contains('bold')).toBe(false);

    hud.updateMessage({ id: 10, isBold: true });
    expect(container.children[0].classList.contains('bold')).toBe(true);
  });

  it('5. タイマー経過後に _fadeLine が走り要素が削除されること', () => {
    hud.pushMessage({ id: 5, text: 'Expiring message' });
    expect(container.children.length).toBe(1);

    // fadeTimeoutMs (3000ms) 経過
    vi.advanceTimersByTime(3000);
    expect(container.children[0].classList.contains('fading')).toBe(true);

    // CSS アニメーション待ち (400ms) 経過
    vi.advanceTimersByTime(400);
    expect(container.children.length).toBe(0);
  });

  it('6. onTurnPassed: 表示中のメッセージに fading-fast クラスを付与すること', () => {
    hud.pushMessage({ id: 1, text: 'Line 1' });
    hud.pushMessage({ id: 2, text: 'Line 2' });

    hud.onTurnPassed();
    expect(container.children[0].classList.contains('fading-fast')).toBe(true);
    expect(container.children[1].classList.contains('fading-fast')).toBe(true);
  });

  it('7. clear: すべてのメッセージを即時消去できること', () => {
    hud.pushMessage({ id: 1, text: 'Line 1' });
    hud.pushMessage({ id: 2, text: 'Line 2' });
    expect(container.children.length).toBe(2);

    hud.clear();
    expect(container.children.length).toBe(0);
    expect(hud.lines.length).toBe(0);
  });

  it('8. 新旧世代クラス (line-age-0 ~ line-age-4) が正しく付与されること', () => {
    hud.setMaxLines(5);
    hud.pushMessage({ id: 1, text: 'Line 1' });
    hud.pushMessage({ id: 2, text: 'Line 2' });
    hud.pushMessage({ id: 3, text: 'Line 3' });

    // 最新行 (Line 3): line-age-0
    expect(container.children[2].classList.contains('line-age-0')).toBe(true);
    // 1つ前 (Line 2): line-age-1
    expect(container.children[1].classList.contains('line-age-1')).toBe(true);
    // 2つ前 (Line 1): line-age-2
    expect(container.children[0].classList.contains('line-age-2')).toBe(true);
  });

  it('9. setMaxLines: 動的に最大行数を変更し、超過行を安全にトリムすること', () => {
    hud.setMaxLines(5);
    for (let i = 1; i <= 5; i++) {
      hud.pushMessage({ id: i, text: `Line ${i}` });
    }
    expect(container.children.length).toBe(5);

    hud.setMaxLines(3);
    expect(container.children.length).toBe(3);
    expect(container.children[0].textContent).toBe('Line 3');
    expect(container.children[2].textContent).toBe('Line 5');
    expect(container.children[2].classList.contains('line-age-0')).toBe(true);
  });

  describe('操作起点ライフサイクル制御 (ターン制UX)', () => {
    let actionHud;
    let actionContainer;

    beforeEach(() => {
      actionContainer = createMockElement('div');
      actionHud = new FloatingMessageHud({
        container: actionContainer,
        maxLines: 5,
        fadeTimeoutMs: 0, // 時間による自動消滅は無効
        fadeDelayAfterActionMs: 2000,
        document: mockDoc
      });
    });

    it('10. ユーザー操作がない場合（長考中）、何分経過してもメッセージが自動消滅しないこと', () => {
      actionHud.pushMessage({ id: 101, text: 'A mind flayer draws near!' });
      expect(actionContainer.children.length).toBe(1);

      // 60秒（1分）長考しても消えない
      vi.advanceTimersByTime(60000);
      expect(actionContainer.children.length).toBe(1);
      expect(actionContainer.children[0].classList.contains('fading')).toBe(false);
      expect(actionContainer.children[0].classList.contains('fading-fast')).toBe(false);
    });

    it('11. notifyUserAction: 操作が行われるとタイマーが起動し、指定時間後にフェードアウトすること', () => {
      actionHud.pushMessage({ id: 102, text: 'You hit the goblin.' });
      expect(actionContainer.children.length).toBe(1);

      // プレイヤーが次の操作（移動など）を実行
      actionHud.notifyUserAction();

      // fading-fast が付与される
      expect(actionContainer.children[0].classList.contains('fading-fast')).toBe(true);
      expect(actionContainer.children[0].classList.contains('fading')).toBe(false);

      // fadeDelayAfterActionMs (2000ms) 経過で fading が付く
      vi.advanceTimersByTime(2000);
      expect(actionContainer.children[0].classList.contains('fading')).toBe(true);

      // CSS 演出待ち (400ms) 経過で要素が削除される
      vi.advanceTimersByTime(400);
      expect(actionContainer.children.length).toBe(0);
    });

    it('12. 連続操作時: 前回の操作でフェード待ちのメッセージは、次の操作ですみやかにフェードアウトへ移行すること', () => {
      actionHud.pushMessage({ id: 103, text: 'Message 1' });

      // 1回目の操作: Message 1 がフェード待機に入る
      actionHud.notifyUserAction();
      expect(actionContainer.children[0].classList.contains('fading-fast')).toBe(true);
      expect(actionContainer.children[0].classList.contains('fading')).toBe(false);

      // わずか 300ms 後に 2回目の操作（連打移動など）
      vi.advanceTimersByTime(300);
      actionHud.notifyUserAction();

      // Message 1 はタイマー満了を待たず即座に fading 状態へ移行
      expect(actionContainer.children[0].classList.contains('fading')).toBe(true);

      // 400ms で完全に除去される
      vi.advanceTimersByTime(400);
      expect(actionContainer.children.length).toBe(0);
    });

    it('13. updateMessage: 太字昇格等の更新時はアクティブ状態へ復帰し、フェードクラスが除去されること', () => {
      actionHud.pushMessage({ id: 104, text: 'Warning!', isBold: false });
      actionHud.notifyUserAction();
      expect(actionContainer.children[0].classList.contains('fading-fast')).toBe(true);

      // 更新が発生（危険警告などで太字化）
      actionHud.updateMessage({ id: 104, text: 'Warning!', isBold: true });
      expect(actionContainer.children[0].classList.contains('fading-fast')).toBe(false);
      expect(actionContainer.children[0].classList.contains('bold')).toBe(true);
    });
  });
});
