/**
 * NhPaperdoll.test.js
 *
 * <nh-paperdoll> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhPaperdoll } from '../../src/components/NhPaperdoll.js';
import { EQUIP_SLOTS } from '../../src/core/knowledge/equipment/EquipmentRules.js';

describe('NhPaperdoll (<nh-paperdoll>)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('connectedCallback 時に 14 部位のスロットカードが描画されること', () => {
    const el = new NhPaperdoll();
    el.connectedCallback();

    const slots = el.shadowRoot.querySelectorAll('.slot-card');
    expect(slots.length).toBe(14);
  });

  it('candidateItem を設定すると適合スロットに eligible クラスが付与されること', () => {
    const el = new NhPaperdoll();
    el.connectedCallback();

    // 兜 (HELM)
    const helmetItem = {
      id: 10,
      name: 'iron helmet',
      category: 'ARMOR',
      armorSlot: 'helm'
    };

    el.setCandidateItem(helmetItem);

    const helmCard = el.shadowRoot.querySelector(`[data-slot-id="${EQUIP_SLOTS.HELM}"]`);
    expect(helmCard).toBeDefined();
    expect(helmCard.classList.contains('eligible')).toBe(true);

    const bootsCard = el.shadowRoot.querySelector(`[data-slot-id="${EQUIP_SLOTS.BOOTS}"]`);
    expect(bootsCard.classList.contains('eligible')).toBe(false);
  });

  it('スロットクリック時に slot-select イベントが発火すること', () => {
    const el = new NhPaperdoll();
    el.connectedCallback();

    const selectSpy = vi.fn();
    el.addEventListener('slot-select', selectSpy);

    const helmCard = el.shadowRoot.querySelector(`[data-slot-id="${EQUIP_SLOTS.HELM}"]`);
    helmCard.click();

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy.mock.calls[0][0].detail.slotId).toBe(EQUIP_SLOTS.HELM);
  });

  it('setSituation で装備中のアイテム名が表示されること', () => {
    const el = new NhPaperdoll();
    el.connectedCallback();

    const dummySituation = {
      inventory: {
        items: [
          {
            id: 1,
            name: '+1 orcish helm',
            equipped: true,
            category: 'ARMOR',
            armorSlot: 'helm'
          }
        ]
      }
    };

    el.setSituation(dummySituation);

    const helmCard = el.shadowRoot.querySelector(`[data-slot-id="${EQUIP_SLOTS.HELM}"]`);
    expect(helmCard.textContent).toContain('+1 orcish helm');
  });
});
