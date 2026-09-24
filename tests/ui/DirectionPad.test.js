/**
 * DirectionPad.test.js
 * 
 * DirectionPad (8方向D-Pad & 推奨アクション一覧マネージャー) の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DirectionPad } from '../../examples/gkl-pure-js-client/modules/components/DirectionPad.js';

// 軽量 DOM 要素モック
function createMockElement(tagName = 'div') {
  const classListSet = new Set();
  const attributes = {};
  const children = [];
  const style = {};
  const listeners = {};

  const el = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    innerHTML: '',
    style,
    dataset: {},
    classList: {
      add: (...classes) => classes.forEach(cls => classListSet.add(cls)),
      remove: (...classes) => classes.forEach(cls => classListSet.delete(cls)),
      toggle: (cls, force) => {
        if (force === undefined) {
          if (classListSet.has(cls)) classListSet.delete(cls);
          else classListSet.add(cls);
        } else if (force) {
          classListSet.add(cls);
        } else {
          classListSet.delete(cls);
        }
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
    querySelector: (selector) => {
      if (selector.startsWith('[data-act-id="')) {
        const id = selector.match(/data-act-id="([^"]+)"/)?.[1];
        if (!el._mockBtns) el._mockBtns = {};
        if (!el._mockBtns[id]) {
          const btn = createMockElement('button');
          btn.dataset.actId = id;
          el._mockBtns[id] = btn;
        }
        return el._mockBtns[id];
      }
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === '.gkl-dir-btn') {
        return children.filter(c => c.classList?.contains('gkl-dir-btn'));
      }
      return [];
    },
    addEventListener: (event, handler) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    },
    removeEventListener: (event, handler) => {
      if (!listeners[event]) return;
      const idx = listeners[event].indexOf(handler);
      if (idx !== -1) listeners[event].splice(idx, 1);
    },
    dispatchEvent: (event) => {
      const type = event.type;
      if (listeners[type]) {
        listeners[type].forEach(fn => fn(event));
      }
    },
    closest: (selector) => {
      if (selector === '.gkl-dir-btn' && classListSet.has('gkl-dir-btn')) return el;
      return null;
    },
    parentElement: null,
    onclick: null
  };

  return el;
}

describe('DirectionPad - 方向未選択時ボタン非表示標準化', () => {
  let elGklDirectionPad;
  let elGklFilterLabel;
  let elBtnDirReset;
  let elGklActionList;
  let elGklActionCount;
  let dpad;
  let mockCore;

  beforeEach(() => {
    elGklDirectionPad = createMockElement('div');
    // 3x3 D-Pad ボタン群を配置
    const dirs = ['NW', 'N', 'NE', 'W', 'SELF', 'E', 'SW', 'S', 'SE'];
    dirs.forEach(d => {
      const btn = createMockElement('button');
      btn.classList.add('gkl-dir-btn');
      btn.dataset.dir = d;
      btn.textContent = d;
      const badge = createMockElement('span');
      badge.classList.add('gkl-dir-badge');
      btn.appendChild(badge);
      elGklDirectionPad.appendChild(btn);
    });

    elGklFilterLabel = createMockElement('span');
    elBtnDirReset = createMockElement('button');
    elGklActionList = createMockElement('div');
    elGklActionCount = createMockElement('span');

    mockCore = {
      executeAction: vi.fn().mockResolvedValue(true),
      getDefaultAction: vi.fn((dir) => ({
        id: `ACTION_DEFAULT_MOVE_${dir}`,
        dirCode: dir,
        label: `${dir}へ移動`,
        charStr: dir,
        isDefault: true
      }))
    };

    dpad = new DirectionPad({
      elGklDirectionPad,
      elGklFilterLabel,
      elBtnDirReset,
      elGklActionList,
      elGklActionCount,
      getCore: () => mockCore,
      language: 'ja'
    });
  });

  it('1. 初期状態では selectedDir が NONE であり、アクションボタンは描画されずガイダンスが表示されること', () => {
    expect(dpad.selectedDir).toBe('NONE');

    const actions = [
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '東の敵を攻撃', charStr: 'l' },
      { id: 'ACTION_PICKUP_FEET', dirCode: 'SELF', labelJa: '足元のアイテムを拾う', charStr: ',' }
    ];

    dpad.renderGklActions(actions);

    // アクションボタンは表示されず、案内メッセージが表示されること
    expect(elGklActionList.innerHTML).toContain('gkl-hint-unselected');
    expect(elGklActionList.innerHTML).not.toContain('gkl-action-btn');
    expect(elGklFilterLabel.textContent).toContain('未選択');
    expect(elBtnDirReset.textContent).toBe('全表示');
    // 件数バッジには総アクション数が表示されること
    expect(elGklActionCount.textContent).toBe('2');
  });

  it('2. 方向ボタンをクリックすると該当方向が選択され、アクションボタンが表示されること', () => {
    const actions = [
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '東の敵を攻撃', charStr: 'l' },
      { id: 'ACTION_PICKUP_FEET', dirCode: 'SELF', labelJa: '足元のアイテムを拾う', charStr: ',' }
    ];

    // 東 (E) ボタンのクリックイベントをシミュレート
    const eastBtn = elGklDirectionPad.querySelectorAll('.gkl-dir-btn').find(b => b.dataset.dir === 'E');
    elGklDirectionPad.dispatchEvent({
      type: 'pointerup',
      target: eastBtn,
      clientX: 0,
      clientY: 0
    });

    expect(dpad.selectedDir).toBe('E');

    dpad.renderGklActions(actions);

    expect(elGklActionList.innerHTML).toContain('gkl-action-btn');
    expect(elGklActionList.innerHTML).toContain('東の敵を攻撃');
    expect(elGklFilterLabel.textContent).toContain('東 (E)');
    expect(elBtnDirReset.textContent).toBe('クリア');
  });

  it('3. 選択中の方向ボタンを再クリックすると NONE に戻りボタンが非表示になること', () => {
    const actions = [
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '東の敵を攻撃' }
    ];

    const eastBtn = elGklDirectionPad.querySelectorAll('.gkl-dir-btn').find(b => b.dataset.dir === 'E');
    // 1回目クリック: E 選択
    elGklDirectionPad.dispatchEvent({ type: 'pointerup', target: eastBtn });
    expect(dpad.selectedDir).toBe('E');

    // 2回目クリック: NONE にトグル
    elGklDirectionPad.dispatchEvent({ type: 'pointerup', target: eastBtn });
    expect(dpad.selectedDir).toBe('NONE');

    dpad.renderGklActions(actions);
    expect(elGklActionList.innerHTML).toContain('gkl-hint-unselected');
    expect(elGklActionList.innerHTML).not.toContain('gkl-action-btn');
  });

  it('4. リセットボタンで NONE ➔ ALL ➔ NONE のトグルができること', () => {
    const actions = [
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '攻撃' }
    ];

    expect(dpad.selectedDir).toBe('NONE');

    // NONE 時にリセットボタン押下 ➔ ALL (全表示)
    elBtnDirReset.dispatchEvent({ type: 'click' });
    expect(dpad.selectedDir).toBe('ALL');

    dpad.renderGklActions(actions);
    expect(elGklActionList.innerHTML).toContain('gkl-action-btn');
    expect(elBtnDirReset.textContent).toBe('クリア');

    // ALL 時にリセットボタン押下 ➔ NONE (非表示)
    elBtnDirReset.dispatchEvent({ type: 'click' });
    expect(dpad.selectedDir).toBe('NONE');

    dpad.renderGklActions(actions);
    expect(elGklActionList.innerHTML).toContain('gkl-hint-unselected');
    expect(elBtnDirReset.textContent).toBe('全表示');
  });

  it('5. アクションボタン実行後に自動的に selectedDir が NONE に復帰すること', async () => {
    const actions = [
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '東の敵を攻撃' }
    ];

    dpad.selectedDir = 'E';
    dpad.renderGklActions(actions);

    const btn = elGklActionList.querySelector('[data-act-id="ACTION_ATTACK_E"]');
    expect(btn).toBeDefined();

    // ボタンクリックをシミュレート
    btn.onclick();

    expect(mockCore.executeAction).toHaveBeenCalledWith(actions[0]);
    // 実行後に NONE にリセットされていること
    expect(dpad.selectedDir).toBe('NONE');
  });
});
