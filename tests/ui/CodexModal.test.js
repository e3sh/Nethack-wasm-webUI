/**
 * CodexModal.test.js
 *
 * GKL 冒険手帳・伝承図鑑モーダルコンポーネントの単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodexModal } from '../../examples/gkl-pure-js-client/modules/components/CodexModal.js';
import { LoreCodex } from '../../src/core/lore/LoreCodex.js';

function createMockElement(id = '', tagName = 'div') {
  const classListSet = new Set(id === 'codex-modal' ? ['hidden'] : []);
  const eventListeners = {};
  const children = [];

  const el = {
    id,
    tagName: tagName.toUpperCase(),
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    placeholder: '',
    title: '',
    style: {},
    dataset: {},
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      contains: (cls) => classListSet.has(cls),
      toggle: (cls, force) => {
        if (force === true) classListSet.add(cls);
        else if (force === false) classListSet.delete(cls);
        else if (classListSet.has(cls)) classListSet.delete(cls);
        else classListSet.add(cls);
      }
    },
    addEventListener: (type, handler) => {
      eventListeners[type] = eventListeners[type] || [];
      eventListeners[type].push(handler);
    },
    dispatchEvent: (event) => {
      const handlers = eventListeners[event.type] || [];
      for (const h of handlers) h(event);
    },
    appendChild: (child) => {
      children.push(child);
      el.children = children;
      el.innerHTML += (child.outerHTML || child.innerHTML || child.textContent || '<div></div>');
      return child;
    },
    querySelectorAll: (selector) => {
      return [];
    },
    querySelector: (selector) => {
      return null;
    },
    closest: (selector) => null,
    children
  };
  return el;
}

describe('CodexModal - 冒険手帳・伝承図鑑コンポーネント', () => {
  let modal;
  let mockCore;
  let elementsMap;

  const sampleRumors = [
    { id: 'rumor_001', isTrue: true, text: 'The Oracle is very wise.', translation: '神託の巫女は大変賢明である。', isCollected: true },
    { id: 'rumor_002', isTrue: false, text: 'Elbereth does not work on trolls.', translation: 'エルベレスはトロールには効かない。', isCollected: false }
  ];

  const sampleOracles = [
    { id: 'ora_001', isMajor: true, text: 'Seek the Amulet of Yendor.', translation: 'イェンダーの魔除けを探し求めよ。', isCollected: true }
  ];

  const sampleEngravings = [
    { id: 'eng_001', text: 'Elbereth', translation: 'エルベレス', source: '魔除けの結界文字', isCollected: true }
  ];

  beforeEach(() => {
    elementsMap = {
      'codex-modal': createMockElement('codex-modal'),
      'btn-codex-close': createMockElement('btn-codex-close', 'button'),
      'btn-codex-mark-all-read': createMockElement('btn-codex-mark-all-read', 'button'),
      'codex-mark-read-label': createMockElement('codex-mark-read-label'),
      'codex-search-input': createMockElement('codex-search-input', 'input'),
      'codex-tab-rumors': createMockElement('codex-tab-rumors', 'button'),
      'codex-tab-oracles': createMockElement('codex-tab-oracles', 'button'),
      'codex-tab-engravings': createMockElement('codex-tab-engravings', 'button'),
      'codex-unread-tab-rumors': createMockElement('codex-unread-tab-rumors'),
      'codex-unread-tab-oracles': createMockElement('codex-unread-tab-oracles'),
      'codex-unread-tab-engravings': createMockElement('codex-unread-tab-engravings'),
      'codex-filter-all': createMockElement('codex-filter-all', 'button'),
      'codex-filter-true': createMockElement('codex-filter-true', 'button'),
      'codex-filter-false': createMockElement('codex-filter-false', 'button'),
      'codex-sum-rumor-ratio': createMockElement('codex-sum-rumor-ratio'),
      'codex-sum-rumor-pct': createMockElement('codex-sum-rumor-pct'),
      'codex-sum-rumor-bar': createMockElement('codex-sum-rumor-bar'),
      'codex-sum-true-ratio': createMockElement('codex-sum-true-ratio'),
      'codex-sum-false-ratio': createMockElement('codex-sum-false-ratio'),
      'codex-sum-oracle-ratio': createMockElement('codex-sum-oracle-ratio'),
      'codex-sum-engraving-ratio': createMockElement('codex-sum-engraving-ratio'),
      'codex-master-list': createMockElement('codex-master-list'),
      'codex-list-count': createMockElement('codex-list-count'),
      'codex-detail-pane': createMockElement('codex-detail-pane'),
      'codex-detail-empty': createMockElement('codex-detail-empty'),
      'codex-detail-card': createMockElement('codex-detail-card'),
      'codex-brand-title': createMockElement('codex-brand-title'),
      'codex-brand-subtitle': createMockElement('codex-brand-subtitle'),
      'codex-lbl-sum-rumor': createMockElement('codex-lbl-sum-rumor'),
      'codex-lbl-sum-true': createMockElement('codex-lbl-sum-true'),
      'codex-lbl-sum-false': createMockElement('codex-lbl-sum-false'),
      'codex-lbl-sum-oracle': createMockElement('codex-lbl-sum-oracle'),
      'codex-lbl-sum-engraving': createMockElement('codex-lbl-sum-engraving'),
      'codex-filters-rumor': createMockElement('codex-filters-rumor'),
      'codex-filters-engraving': createMockElement('codex-filters-engraving')
    };

    elementsMap['codex-modal'].querySelector = (sel) => {
      const id = sel.replace('#', '');
      return elementsMap[id] || null;
    };

    globalThis.document = {
      getElementById: (id) => elementsMap[id] || null,
      createElement: (tag) => createMockElement('', tag),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const codexInstance = new LoreCodex({ autoLoad: false });
    // サンプルデータを記録
    codexInstance.addRumor({
      id: 'rumor_001',
      text: 'The Oracle is very wise.',
      translatedText: '神託の巫女は大変賢明である。',
      isTrue: true,
      source: 'cookie'
    });
    codexInstance.addOracle({
      id: 'oracle_001',
      text: 'Seek the Amulet of Yendor.',
      translatedText: 'イェンダーの魔除けを探し求めよ。',
      isSpecial: true
    });
    codexInstance.addEngraving({
      id: 'engr_001',
      text: 'Elbereth',
      translatedText: 'エルベレス',
      category: 'ELBERETH'
    });

    mockCore = {
      getLoreCodex: () => codexInstance
    };

    modal = new CodexModal({
      elCodexModal: elementsMap['codex-modal'],
      getCore: () => mockCore
    });
  });

  it('初期状態では非表示で、open() を呼ぶと表示状態になること', () => {
    expect(modal.isOpen()).toBe(false);
    expect(elementsMap['codex-modal'].classList.contains('hidden')).toBe(true);

    modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(elementsMap['codex-modal'].classList.contains('hidden')).toBe(false);
  });

  it('サマリーバーに総合収集率が表示されること', () => {
    modal.open();
    const pct = elementsMap['codex-sum-rumor-pct'];
    const ratio = elementsMap['codex-sum-rumor-ratio'];
    expect(pct.textContent).toBe('(0.1%)');
    expect(ratio.textContent).toBe('1 / 787');
  });

  it('デフォルトでRumorsタブが選択され、獲得済みのアイテムのみが描画され未獲得のものは表示されないこと', () => {
    modal.open();
    const list = elementsMap['codex-master-list'];
    // 獲得済み噂話は表示される
    expect(list.innerHTML).toContain('The Oracle is very wise.');
    // 未獲得の噂話（マスターデータ）は一覧に含まれない（ネタバレ防止）
    expect(list.innerHTML).not.toContain('Elbereth does not work on trolls');
  });

  it('タブを切り替えると該当カテゴリの項目が表示されること', () => {
    modal.open();
    modal.switchTab('oracles');
    const list = elementsMap['codex-master-list'];
    expect(list.innerHTML).toContain('Seek the Amulet of Yendor.');
  });

  it('setLanguage("en") で言語が英語に切り替わること', () => {
    modal.open();
    modal.setLanguage('en');

    const searchInput = elementsMap['codex-search-input'];
    expect(searchInput.placeholder).toContain('Search by keyword');

    const brandSubtitle = elementsMap['codex-brand-subtitle'];
    expect(brandSubtitle.textContent).toBe('Adventure Codex & Lore Archive');
  });

  it('close() を呼ぶとモーダルが非表示になること', () => {
    modal.open();
    expect(modal.isOpen()).toBe(true);

    modal.close();
    expect(modal.isOpen()).toBe(false);
    expect(elementsMap['codex-modal'].classList.contains('hidden')).toBe(true);
  });

  it('新着アイテムの未読カウント集計と個別既読化が機能すること', () => {
    // 初期状態: 噂話1件、神託1件、床文字1件の計3件
    let counts = modal.getUnreadCounts();
    expect(counts.total).toBe(3);
    expect(counts.rumors).toBe(1);
    expect(counts.oracles).toBe(1);
    expect(counts.engravings).toBe(1);

    // 単一アイテムを既読化
    modal.markAsRead('rumor_001');
    counts = modal.getUnreadCounts();
    expect(counts.total).toBe(2);
    expect(counts.rumors).toBe(0);

    // すべて既読化
    modal.markAllAsRead();
    counts = modal.getUnreadCounts();
    expect(counts.total).toBe(0);
    expect(counts.rumors).toBe(0);
    expect(counts.oracles).toBe(0);
    expect(counts.engravings).toBe(0);
  });

  it('onUnreadCountChanged コールバックが未読件数変更時に呼ばれること', () => {
    let notifiedCount = -1;
    modal.onUnreadCountChanged = (count) => {
      notifiedCount = count;
    };

    modal.markAllAsRead();
    expect(notifiedCount).toBe(0);
  });

  it('モーダルを開く前(open前)でも、init後にLoreCodexにアイテムが追加された際に未読通知が届くこと', () => {
    let notifiedCount = -1;
    modal.onUnreadCountChanged = (count) => {
      notifiedCount = count;
    };

    // 初期化 (未オープン状態)
    modal.init();

    // 新しい噂話を追加
    const codex = mockCore.getLoreCodex();
    codex.addRumor({
      id: 'rumor_test_auto_notify',
      text: 'Auto notify test rumor',
      isTrue: true
    });

    expect(notifiedCount).toBeGreaterThan(0);
  });

  it('relatedEntities を持つ噂話の詳細カード描画時に関連エンティティバッジが含まれること', () => {
    modal.selectedItem = {
      id: 'rumor_medusa_test',
      text: 'Medusa is ugly enough to turn herself to stone.',
      translatedText: 'メデューサは自らの醜さによって自身を石化させてしまうほどだ。',
      isTrue: true,
      category: 'RUMOR',
      relatedEntities: [
        { type: 'MONSTER', id: 'medusa', name: 'medusa', nameJa: 'メデューサ' },
        { type: 'ITEM', id: 'mirror', name: 'mirror', nameJa: '鏡' }
      ]
    };

    modal.renderDetail();
    const cardEl = elementsMap['codex-detail-card'];
    expect(cardEl.innerHTML).toContain('codex-related-section');
    expect(cardEl.innerHTML).toContain('メデューサ');
    expect(cardEl.innerHTML).toContain('鏡');
  });

  it('buildEntitySpecHtml がモンスターとアイテムのスペック情報を正しく生成すること', () => {
    const monEntity = { type: 'MONSTER', id: 'medusa', name: 'medusa', nameJa: 'メデューサ', dangerLevel: 'HIGH' };
    const itemEntity = { type: 'ITEM', id: 'mirror', name: 'mirror', nameJa: '鏡', category: 'TOOL' };

    const monHtmlJa = modal.buildEntitySpecHtml(monEntity, false);
    expect(monHtmlJa).toContain('メデューサ');
    expect(monHtmlJa).toContain('MONSTER');
    expect(monHtmlJa).toContain('HIGH');

    const itemHtmlEn = modal.buildEntitySpecHtml(itemEntity, true);
    expect(itemHtmlEn).toContain('mirror');
    expect(itemHtmlEn).toContain('ITEM');
    expect(itemHtmlEn).toContain('TOOL');
  });
});


