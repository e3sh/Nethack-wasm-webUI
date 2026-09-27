import { describe, it, expect } from 'vitest';
import { PaperdollPresenter, SLOT_DEFINITIONS } from '../../examples/gkl-pure-js-client/modules/controller/PaperdollPresenter.js';
import { EQUIP_SLOTS } from '../../src/core/knowledge/equipment/EquipmentRules.js';

describe('PaperdollPresenter (Headless Paperdoll UI Presenter)', () => {
  const presenter = new PaperdollPresenter();

  it('スロット定義が完全であること', () => {
    expect(SLOT_DEFINITIONS[EQUIP_SLOTS.HELM].labelJa).toBe('頭 (兜)');
    expect(SLOT_DEFINITIONS[EQUIP_SLOTS.SUIT].layer).toBe(2);
    expect(SLOT_DEFINITIONS[EQUIP_SLOTS.CLOAK].layer).toBe(3);
    expect(SLOT_DEFINITIONS[EQUIP_SLOTS.SHIRT].layer).toBe(1);
  });

  it('指定スロットに適合する候補アイテムを正しく抽出すること', () => {
    const items = [
      { name: 'iron helm', category: 'ARMOR', armorSlot: 'helm', glyphId: 100 }, // 兜
      { name: 'leather armor', category: 'ARMOR', armorSlot: 'suit', glyphId: 101 }, // 鎧
      { name: 'dagger', category: 'WEAPON', glyphId: 102 } // 武器
    ];

    const helms = presenter.getEligibleItemsForSlot(items, EQUIP_SLOTS.HELM);
    expect(helms.map(h => h.name)).toContain('iron helm');
    expect(helms.map(h => h.name)).not.toContain('dagger');

    const suits = presenter.getEligibleItemsForSlot(items, EQUIP_SLOTS.SUIT);
    expect(suits.map(s => s.name)).toContain('leather armor');
  });

  it('二刀流適性判定が職業やスキルに応じて動作すること', () => {
    expect(presenter.checkTwoWeaponEligibility({ player: { role: 'Samurai' } })).toBe(true);
    expect(presenter.checkTwoWeaponEligibility({ player: { role: 'Wizard' } })).toBe(false);
  });
});
