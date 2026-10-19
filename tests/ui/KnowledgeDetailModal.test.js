import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from '../components/testElementHelper.js';
import { KnowledgeDetailModal } from '../../examples/gkl-pure-js-client/modules/components/KnowledgeDetailModal.js';

describe('KnowledgeDetailModal - Called Name in Header Title & Badges', () => {
  let restoreDom;
  let modal;
  let mockCore;
  let modalElement;

  beforeEach(() => {
    restoreDom = setupMockDom();
    modalElement = document.createElement('div');
    modalElement.id = 'knowledge-detail-modal';
    document.body.appendChild(modalElement);

    mockCore = {
      gkl: {
        discoveryStateManager: {
          getCalledName: vi.fn((key) => {
            if (key === 300 || key === 'ruby potion') return 'healing?';
            return null;
          })
        }
      }
    };

    modal = new KnowledgeDetailModal({
      getCore: () => mockCore
    });
    modal.elModal = modalElement;
  });

  afterEach(() => {
    if (restoreDom) restoreDom();
  });

  it('reflects calledName in headerTitle and badges in Japanese mode', () => {
    modal.setLanguage('ja');

    const targetData = {
      name: 'ruby potion',
      appearanceName: 'ルビー色の薬',
      onum: 300,
      letter: 'a',
      identification: {
        isUnidentified: true,
        calledName: 'healing?'
      }
    };

    modal.open(targetData);

    const titleEl = modalElement.querySelector('.knowledge-header-title');
    expect(titleEl).toBeDefined();
    expect(titleEl.textContent).toContain('ルビー色の薬 [仮名: healing?]');

    const badges = modalElement.querySelectorAll('.kn-status-badge');
    const badgeTexts = Array.from(badges).map(b => b.textContent);
    expect(badgeTexts.some(txt => txt.includes('🏷️ 仮名: healing?'))).toBe(true);
  });

  it('reflects calledName in headerTitle and badges in English mode', () => {
    modal.setLanguage('en');

    const targetData = {
      name: 'ruby potion',
      appearanceName: 'ruby potion',
      onum: 300,
      letter: 'a',
      identification: {
        isUnidentified: true,
        calledName: 'healing?'
      }
    };

    modal.open(targetData);

    const titleEl = modalElement.querySelector('.knowledge-header-title');
    expect(titleEl).toBeDefined();
    expect(titleEl.textContent).toContain('ruby potion called healing?');

    const badges = modalElement.querySelectorAll('.kn-status-badge');
    const badgeTexts = Array.from(badges).map(b => b.textContent);
    expect(badgeTexts.some(txt => txt.includes('🏷️ Called: healing?'))).toBe(true);
  });

  it('falls back to discoveryStateManager.getCalledName when target has no explicit calledName property', () => {
    modal.setLanguage('ja');

    const targetData = {
      name: 'ruby potion',
      appearanceName: 'ルビー色の薬',
      onum: 300,
      letter: 'a',
      identification: {
        isUnidentified: true
      }
    };

    modal.open(targetData);

    const titleEl = modalElement.querySelector('.knowledge-header-title');
    expect(titleEl.textContent).toContain('ルビー色の薬 [仮名: healing?]');
    expect(targetData.calledName).toBe('healing?');
  });

  it('インベントリから開いた未鑑定アイテム（InventoryStateManager パース構造）で [仮名] ボタンが確実に表示されること', () => {
    modal.setLanguage('ja');

    // InventoryStateManager のパースアイテム構造（直下に category はなく categoryFlags、identification 内に isUnidentified）
    const inventoryItem = {
      letter: 'b',
      rawText: 'a smoky potion',
      onum: 300,
      glyphId: 3748,
      identification: {
        idLevel: 'UNIDENTIFIED',
        isUnidentified: true,
        appearanceName: 'smoky potion',
        calledName: null
      },
      category: 'POTION'
    };

    modal.open(inventoryItem);

    const callBtn = modalElement.querySelector('#btn-modal-call-item');
    expect(callBtn).not.toBeNull();
    expect(callBtn.textContent).toContain('仮名');
  });

  it('地面に置かれた複数枚の金貨 (quan: 250) の詳細を開いた際、正確な枚数 (250枚の金貨) が表示されること', () => {
    modal.setLanguage('ja');

    // 床オブジェクト（InspectionService / AreaStateManager 構造）
    const floorGold = {
      onum: 438,
      category: 'GOLD',
      isGold: true,
      quan: 250,
      count: 250,
      directObject: {
        otyp: 438,
        quan: 250,
        oclass: 5
      }
    };

    modal.open(floorGold);

    const titleEl = modalElement.querySelector('.knowledge-header-title');
    expect(titleEl).toBeDefined();
    expect(titleEl.textContent).toContain('250枚の金貨');
    expect(titleEl.textContent).not.toContain('1枚の金貨');
  });

  it('地面に置かれた複数枚の金貨 (quan: 250) を英語モードで開いた際、"250 gold pieces" と表示されること', () => {
    modal.setLanguage('en');

    const floorGold = {
      onum: 438,
      category: 'GOLD',
      isGold: true,
      quan: 250,
      count: 250,
      directObject: {
        otyp: 438,
        quan: 250,
        oclass: 5
      }
    };

    modal.open(floorGold);

    const titleEl = modalElement.querySelector('.knowledge-header-title');
    expect(titleEl).toBeDefined();
    expect(titleEl.textContent).toContain('250 gold pieces');
    expect(titleEl.textContent).not.toContain('1 gold piece');
  });

  it('地面に置かれた1枚の金貨 (quan: 1) の場合は "1枚の金貨" と表示されること', () => {
    modal.setLanguage('ja');

    const floorGold = {
      onum: 438,
      category: 'GOLD',
      isGold: true,
      quan: 1,
      directObject: {
        otyp: 438,
        quan: 1,
        oclass: 5
      }
    };

    modal.open(floorGold);

    const titleEl = modalElement.querySelector('.knowledge-header-title');
    expect(titleEl).toBeDefined();
    expect(titleEl.textContent).toContain('1枚の金貨');
  });
});


