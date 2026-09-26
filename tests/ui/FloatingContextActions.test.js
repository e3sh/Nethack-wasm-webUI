/**
 * FloatingContextActions.test.js
 *
 * GKL スマート ContextActions ＆ ナレッジ連携フローティングメニューの単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FloatingContextActions, getDirCodeFromOffset } from '../../examples/gkl-pure-js-client/modules/components/FloatingContextActions.js';

// 軽量 DOM 要素モック
function createMockElement(tagName = 'div') {
  const classListSet = new Set();
  const attributes = {};
  const children = [];
  const style = {};

  const el = {
    tagName: tagName.toUpperCase(),
    textContent: '',
    innerHTML: '',
    style,
    offsetWidth: 200,
    offsetHeight: 120,
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
      // 簡易セレクタモック
      if (selector === '.gkl-floating-actions') {
        return children.find(c => c.classList?.contains('gkl-floating-actions')) || null;
      }
      return null;
    },
    querySelectorAll: (selector) => [],
    ownerDocument: {
      createElement: (tag) => createMockElement(tag)
    },
    getBoundingClientRect: () => ({
      left: 100,
      top: 100,
      width: 720,
      height: 288,
      right: 820,
      bottom: 388
    }),
    parentElement: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onclick: null
  };

  return el;
}

describe('getDirCodeFromOffset - 方向オフセット計算', () => {
  it('自キャラおよび8方向のオフセットを正しくコードに変換できること', () => {
    expect(getDirCodeFromOffset(0, 0)).toBe('SELF');
    expect(getDirCodeFromOffset(0, -1)).toBe('N');
    expect(getDirCodeFromOffset(1, -1)).toBe('NE');
    expect(getDirCodeFromOffset(1, 0)).toBe('E');
    expect(getDirCodeFromOffset(1, 1)).toBe('SE');
    expect(getDirCodeFromOffset(0, 1)).toBe('S');
    expect(getDirCodeFromOffset(-1, 1)).toBe('SW');
    expect(getDirCodeFromOffset(-1, 0)).toBe('W');
    expect(getDirCodeFromOffset(-1, -1)).toBe('NW');
    expect(getDirCodeFromOffset(2, 0)).toBeNull(); // 遠隔
  });
});

describe('FloatingContextActions - フローティング推奨アクション UI', () => {
  let container;
  let floatingActions;
  let mockCore;
  let mockOnNavigateKnowledge;

  beforeEach(() => {
    container = createMockElement('div');
    container.classList.add('game-viewport');

    mockCore = {
      executeAction: vi.fn().mockResolvedValue(true),
      getDefaultAction: vi.fn((dir) => ({
        id: `ACTION_DEFAULT_MOVE_${dir}`,
        dirCode: dir,
        label: `${dir}へ移動`,
        charStr: dir
      })),
      gkl: {
        travelTo: vi.fn().mockResolvedValue(true)
      }
    };

    mockOnNavigateKnowledge = vi.fn();

    floatingActions = new FloatingContextActions({
      container,
      getCore: () => mockCore,
      onNavigateKnowledge: mockOnNavigateKnowledge,
      language: 'ja'
    });
  });

  it('1. コンテナ内に .gkl-floating-actions 要素を生成・バインドすること', () => {
    expect(floatingActions.elPopup).toBeDefined();
    expect(floatingActions.elPopup.classList.contains('hidden')).toBe(true);
  });

  it('2. 自キャラ足元マス (dx=0, dy=0) のとき GKL 足元アクションを抽出すること', () => {
    const allActions = [
      { id: 'ACTION_PICKUP_FEET', dirCode: 'SELF', labelJa: '拾う', charStr: ',' },
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '東の敵を攻撃', charStr: 'l' }
    ];

    const actions = floatingActions.resolveApplicableActions({
      targetGx: 10,
      targetGy: 10,
      playerX: 10,
      playerY: 10,
      cardData: { category: 'FLOOR' },
      allActions
    });

    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions.some(a => a.id === 'ACTION_PICKUP_FEET')).toBe(true);
  });

  it('3. 足元アクションがない場合は GKL のデフォルト待機アクションを返すこと', () => {
    const actions = floatingActions.resolveApplicableActions({
      targetGx: 10,
      targetGy: 10,
      playerX: 10,
      playerY: 10,
      cardData: { category: 'FLOOR' },
      allActions: []
    });

    expect(actions.length).toBe(1);
    expect(mockCore.getDefaultAction).toHaveBeenCalledWith('SELF', expect.anything());
    expect(actions[0].id).toContain('SELF');
  });

  it('4. 隣接モンスターのマス (dx=1, dy=0) のとき GKL から対応方向のアクションを抽出すること', () => {
    const allActions = [
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: 'オークを攻撃', charStr: 'l' },
      { id: 'ACTION_PICKUP_FEET', dirCode: 'SELF', labelJa: '拾う', charStr: ',' }
    ];

    const actions = floatingActions.resolveApplicableActions({
      targetGx: 11,
      targetGy: 10,
      playerX: 10,
      playerY: 10,
      cardData: { category: 'MONSTER', name: 'オーク', hasMonster: true },
      allActions
    });

    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions.some(a => a.id === 'ACTION_ATTACK_E')).toBe(true);
  });

  it('5. アクション未登録の隣接マスに対して GKL の getDefaultAction(dirCode) を取得して提示すること', () => {
    const actions = floatingActions.resolveApplicableActions({
      targetGx: 10,
      targetGy: 9, // 北 (N)
      playerX: 10,
      playerY: 10,
      cardData: { category: 'FLOOR' },
      allActions: []
    });

    expect(actions.length).toBe(1);
    expect(mockCore.getDefaultAction).toHaveBeenCalledWith('N', expect.anything());
    expect(actions[0].dirCode).toBe('N');
  });

  it('6. 遠隔マス (dx=3, dy=0) のとき遠隔アクションがあれば抽出すること', () => {
    const allActions = [
      { id: 'ACTION_FIRE_BOW', isRanged: true, labelJa: '弓で射撃', charStr: 'f' },
      { id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '近接攻撃' }
    ];

    const actions = floatingActions.resolveApplicableActions({
      targetGx: 13,
      targetGy: 10,
      playerX: 10,
      playerY: 10,
      cardData: { category: 'MONSTER', name: 'アーチャー' },
      allActions
    });

    expect(actions.length).toBe(1);
    expect(actions[0].id).toBe('ACTION_FIRE_BOW');
  });

  it('7. show() を呼ぶと isVisible が true になり hidden クラスが外れること', () => {
    floatingActions.show({
      gx: 11,
      gy: 10,
      playerX: 10,
      playerY: 10,
      screenX: 200,
      screenY: 150,
      cardData: { category: 'MONSTER', name: 'コボルド' },
      actions: [{ id: 'ACTION_ATTACK_E', dirCode: 'E', labelJa: '攻撃' }]
    });

    expect(floatingActions.isVisible).toBe(true);
    expect(floatingActions.elPopup.classList.contains('hidden')).toBe(false);
  });

  it('8. hide() を呼ぶと isVisible が false になり hidden クラスが付与されること', () => {
    floatingActions.show({
      gx: 10,
      gy: 10,
      playerX: 10,
      playerY: 10,
      cardData: { category: 'FLOOR' }
    });
    expect(floatingActions.isVisible).toBe(true);

    floatingActions.hide();
    expect(floatingActions.isVisible).toBe(false);
    expect(floatingActions.elPopup.classList.contains('hidden')).toBe(true);
  });

  it('9. onPlayerMoved で自動的に hide() が行われること', () => {
    floatingActions.show({
      gx: 10,
      gy: 10,
      playerX: 10,
      playerY: 10,
      cardData: { category: 'FLOOR' }
    });
    expect(floatingActions.isVisible).toBe(true);

    floatingActions.onPlayerMoved(11, 10);
    expect(floatingActions.isVisible).toBe(false);
  });

  it('10. executeContextAction() が呼ばれると core.executeAction が実行されること', async () => {
    const act = { id: 'ACTION_ATTACK_E', labelJa: '攻撃', dirCode: 'E' };
    await floatingActions.executeContextAction(act);

    expect(mockCore.executeAction).toHaveBeenCalledWith(act);
    expect(floatingActions.isVisible).toBe(false);
  });

  it('11. setLanguage で多言語切り替えができること', () => {
    floatingActions.setLanguage('en');
    expect(floatingActions.currentLanguage).toBe('en');

    floatingActions.setLanguage('ja');
    expect(floatingActions.currentLanguage).toBe('ja');
  });

  it('12. 閉じたドアや祭壇などのギミックで正しくヘッダーアイコンとナレッジ要約が描画されること', () => {
    floatingActions.show({
      gx: 11,
      gy: 10,
      playerX: 10,
      playerY: 10,
      cardData: {
        category: 'DOOR',
        name: '閉じたドア',
        effectSummary: 'oキーで開けるか、蹴ることができます。'
      }
    });

    expect(floatingActions.elPopup.innerHTML).toContain('🚪');
    expect(floatingActions.elPopup.innerHTML).toContain('閉じたドア');
    expect(floatingActions.elPopup.innerHTML).toContain('kn-feature');
  });

  it('13. category: \'PLAYER\' のときに自キャラ足元として正しく判定・描画されること', () => {
    floatingActions.show({
      gx: 10,
      gy: 10,
      playerX: 10,
      playerY: 10,
      cardData: {
        category: 'PLAYER',
        name: '自分 (Player)',
        isPlayer: true
      }
    });

    expect(floatingActions.elPopup.innerHTML).toContain('👣');
    expect(floatingActions.elPopup.innerHTML).toContain('自キャラ足元');
  });

  it('14. サブアクション列に詳細 (Inspect) ボタンが表示されること', () => {
    const mockInspect = vi.fn();
    floatingActions.onInspectDetail = mockInspect;

    floatingActions.show({
      gx: 11,
      gy: 10,
      playerX: 10,
      playerY: 10,
      cardData: {
        category: 'MONSTER',
        name: 'オーク',
        hasMonster: true
      }
    });

    expect(floatingActions.elPopup.innerHTML).toContain('btn-floating-inspect');
    expect(floatingActions.elPopup.innerHTML).toContain('詳細');

    // 英語切り替え時のラベル検証
    floatingActions.setLanguage('en');
    expect(floatingActions.elPopup.innerHTML).toContain('Inspect');
  });

  it('15. 平和的モンスター (PEACEFUL) の場合に平和的ピルとアイコンが正しく描画されること', () => {
    floatingActions.setLanguage('ja');
    floatingActions.show({
      gx: 12,
      gy: 10,
      playerX: 10,
      playerY: 10,
      cardData: {
        category: 'MONSTER',
        name: '店主',
        hasMonster: true,
        dispositionStatus: 'PEACEFUL',
        isPeaceful: true,
        dangerLevel: 'SAFE',
        stats: { hd: 12, ac: 0, speed: 18 }
      }
    });

    const html = floatingActions.elPopup.innerHTML;
    expect(html).toContain('kn-status-peaceful');
    expect(html).toContain('☮️ 平和的');
    expect(html).toContain('☮️'); // headerIcon

    // 英語切り替え検証
    floatingActions.setLanguage('en');
    const htmlEn = floatingActions.elPopup.innerHTML;
    expect(htmlEn).toContain('kn-status-peaceful');
    expect(htmlEn).toContain('☮️ Peaceful');
  });

  it('16. 通常平和モンスター (DEFAULT_PEACEFUL) の場合に通常平和ピルが描画されること', () => {
    floatingActions.setLanguage('ja');
    floatingActions.show({
      gx: 12,
      gy: 10,
      playerX: 10,
      playerY: 10,
      cardData: {
        category: 'MONSTER',
        name: '番兵',
        hasMonster: true,
        dispositionStatus: 'DEFAULT_PEACEFUL',
        isPeaceful: true,
        dangerLevel: 'SAFE',
        stats: { hd: 6, ac: 5, speed: 12 }
      }
    });

    const html = floatingActions.elPopup.innerHTML;
    expect(html).toContain('kn-status-peaceful');
    expect(html).toContain('☮️ 通常平和');

    // 英語切り替え検証
    floatingActions.setLanguage('en');
    expect(floatingActions.elPopup.innerHTML).toContain('☮️ Normally Peaceful');
  });
});
