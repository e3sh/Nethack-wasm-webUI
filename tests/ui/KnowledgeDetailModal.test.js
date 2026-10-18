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
});
