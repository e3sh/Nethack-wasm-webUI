/**
 * PaperdollModal.test.js
 *
 * 装備ペーパードールUI ＆ リアルタイム差分プレビューモーダルの単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaperdollModal } from '../../examples/gkl-pure-js-client/modules/components/PaperdollModal.js';
import { EQUIP_SLOTS } from '../../src/core/knowledge/EquipmentRules.js';

// 軽量DOMモック
function createMockElement(id = '', tag = 'div') {
  const listeners = new Map();
  const classListSet = new Set(['hidden']);
  let innerHTML = '';

  const el = {
    id,
    tagName: tag.toUpperCase(),
    dataset: {},
    classList: {
      add: (cls) => classListSet.add(cls),
      remove: (cls) => classListSet.delete(cls),
      toggle: (cls) => classListSet.has(cls) ? classListSet.delete(cls) : classListSet.add(cls),
      contains: (cls) => classListSet.has(cls),
    },
    addEventListener: (event, fn) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    querySelector: (sel) => {
      // 簡易セレクターモック
      return {
        onclick: null,
        dataset: {},
        innerHTML: '',
        classList: { add: vi.fn(), remove: vi.fn(), contains: () => false }
      };
    },
    querySelectorAll: (sel) => [],
    appendChild: vi.fn(),
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => innerHTML,
    set: (val) => { innerHTML = val; }
  });

  return el;
}

describe('PaperdollModal - 装備ペーパードールUI', () => {
  let modalElement;
  let mockCore;
  let paperdoll;
  let mockSituation;

  beforeEach(() => {
    modalElement = createMockElement('paperdoll-modal');

    mockSituation = {
      inventory: {
        items: [
          { letter: 'a', name: 'long sword', isWielded: true, rawText: 'a - a long sword (wielded)' },
          { letter: 'b', name: 'cloak of protection', armorSlot: 'cloak', isWorn: true, acBonus: 1, rawText: 'b - a cloak of protection (being worn)' },
          { letter: 'c', name: 'plate mail', armorSlot: 'suit', isWorn: true, weight: 450, acBonus: 7, rawText: 'c - a plate mail (being worn)' },
          { letter: 'd', name: 'Hawaiian shirt', armorSlot: 'shirt', isWorn: false, acBonus: 0, rawText: 'd - a Hawaiian shirt' },
          { letter: 'e', name: 'helmet', armorSlot: 'helm', isWorn: false, acBonus: 1, rawText: 'e - a helmet' },
          { letter: 'f', name: 'leather gloves', armorSlot: 'gloves', isWorn: true, isCursed: true, rawText: 'f - a cursed pair of leather gloves (being worn)' },
          { letter: 'r', name: 'ring of regeneration', category: 'RING', isWorn: true, rawText: 'r - a ring of regeneration (on left hand)' }
        ]
      },
      status: { ac: 2 },
      encumbrance: { totalWeight: 600 }
    };

    mockCore = {
      executeSequence: vi.fn().mockResolvedValue(true),
      getSituation: () => mockSituation,
      gkl: {
        getSituation: () => mockSituation,
        getPerceivedMonstersSummary: () => []
      }
    };

    paperdoll = new PaperdollModal({
      elPaperdollModal: modalElement,
      getCore: () => mockCore
    });
  });

  it('初期状態では非表示であり、show / hide / toggle でクラスが切り替わること', () => {
    expect(paperdoll.isVisible).toBe(false);
    expect(modalElement.classList.contains('hidden')).toBe(true);

    paperdoll.show();
    expect(paperdoll.isVisible).toBe(true);
    expect(modalElement.classList.contains('hidden')).toBe(false);

    paperdoll.hide();
    expect(paperdoll.isVisible).toBe(false);
    expect(modalElement.classList.contains('hidden')).toBe(true);

    paperdoll.toggle();
    expect(paperdoll.isVisible).toBe(true);
  });

  it('render 時に 3層レイヤードカード（外套・鎧・シャツ）のHTMLが含まれること', () => {
    paperdoll.show();
    const htmlJa = modalElement.innerHTML;

    // 胴体3層レイヤーの要素が含まれていること
    expect(htmlJa).toContain('torso-layer-container');
    expect(htmlJa).toContain('layer-cloak');
    expect(htmlJa).toContain('layer-suit');
    expect(htmlJa).toContain('layer-shirt');
    expect(htmlJa).toContain('L3'); // 外套
    expect(htmlJa).toContain('L2'); // 鎧
    expect(htmlJa).toContain('L1'); // シャツ

    // 日本語モードではアイテム名が和名表示されること
    expect(htmlJa).toContain('保護のクローク');
    expect(htmlJa).toContain('プレートメイル');

    // 英語モードに切り替えた場合は英語名で表示されること
    paperdoll.setLanguage('en');
    const htmlEn = modalElement.innerHTML;
    expect(htmlEn).toContain('cloak of protection');
    expect(htmlEn).toContain('plate mail');
    paperdoll.setLanguage('ja');
  });

  it('呪われた装備（手袋）に呪い警告（is-cursed / ⚠️ 呪い）が付与されること', () => {
    paperdoll.show();
    const html = modalElement.innerHTML;

    expect(html).toContain('is-cursed');
  });

  it('スロット選択と適合アイテム絞り込み（クイックセレクター）が動作すること', () => {
    paperdoll.selectedSlot = EQUIP_SLOTS.HELM;
    paperdoll.show();
    const htmlJa = modalElement.innerHTML;

    // 兜スロットに適合する helmet (e) が和名「兜」でセレクターに表示されること
    expect(htmlJa).toContain('data-letter="e"');
    expect(htmlJa).toContain('兜');

    // 英語モードでは「helmet」と表示されること
    paperdoll.setLanguage('en');
    const htmlEn = modalElement.innerHTML;
    expect(htmlEn).toContain('data-letter="e"');
    expect(htmlEn).toContain('helmet');
    paperdoll.setLanguage('ja');
  });

  it('リアルタイム差分プレビューで AC 改善と所要ターン数が正しく計算されること', () => {
    paperdoll.selectedSlot = EQUIP_SLOTS.SHIRT;
    paperdoll.show();
    paperdoll.selectedCandidateItem = mockSituation.inventory.items[3]; // Hawaiian shirt (d)
    paperdoll.render();

    const htmlJa = modalElement.innerHTML;
    // 差分カードにシャツの換装情報が含まれること（日本語）
    expect(htmlJa).toContain('アロハシャツ');
    expect(htmlJa).toContain('所要時間');

    // 英語モード
    paperdoll.setLanguage('en');
    paperdoll.selectedCandidateItem = mockSituation.inventory.items[3];
    paperdoll.render();
    const htmlEn = modalElement.innerHTML;
    expect(htmlEn).toContain('Hawaiian shirt');
    expect(htmlEn).toContain('Est. Time:');
    paperdoll.setLanguage('ja');
  });

  it('executeEquip で自動換装キーストローク列が core.executeSequence に渡されること', async () => {
    paperdoll.show();
    const targetItem = mockSituation.inventory.items[4]; // helmet (e)

    await paperdoll.executeEquip(targetItem, EQUIP_SLOTS.HELM);

    expect(mockCore.executeSequence).toHaveBeenCalledWith(['W', 'e']);
  });

  it('executeTakeOff で脱衣キーストローク列が core.executeSequence に渡されること', async () => {
    paperdoll.show();
    // 主手 (long sword) を外す
    await paperdoll.executeTakeOff(EQUIP_SLOTS.MAIN_HAND);

    expect(mockCore.executeSequence).toHaveBeenCalledWith(['w', '-']);
  });

  it('呪われた装備の脱衣はセーフティガードで阻止され executeSequence が呼ばれないこと', async () => {
    paperdoll.show();
    const alertSpy = vi.spyOn(paperdoll, '_showAlert').mockImplementation(() => {});

    // 呪われた手袋 (f) を脱ごうとする
    await paperdoll.executeTakeOff(EQUIP_SLOTS.GLOVES);

    expect(mockCore.executeSequence).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });


  it('言語切替 (en / ja) でタイトルおよびラベルが切り替わること', () => {
    paperdoll.setLanguage('en');
    paperdoll.show();
    expect(modalElement.innerHTML).toContain('Equipment Paperdoll');

    paperdoll.setLanguage('ja');
    expect(modalElement.innerHTML).toContain('装備詳細 ＆ ペーパードール');
  });

  it('enモードでは換装の際の注意書き（BUC未確定や所要ターン）が英語で表示されること', () => {
    // 英語モード
    paperdoll.selectedSlot = EQUIP_SLOTS.HELM;
    paperdoll.setLanguage('en');
    paperdoll.show();
    paperdoll.selectedCandidateItem = mockSituation.inventory.items[4]; // helmet (e)
    paperdoll.render();
    const htmlEn = modalElement.innerHTML;
    expect(htmlEn).toContain('Item may be cursed (BUC status unconfirmed).');
    expect(htmlEn).not.toContain('呪われている可能性があります');

    // 日本語モード
    paperdoll.setLanguage('ja');
    paperdoll.selectedCandidateItem = mockSituation.inventory.items[4];
    paperdoll.render();
    const htmlJa = modalElement.innerHTML;
    expect(htmlJa).toContain('呪われている可能性があります（BUC未確定）。');
    expect(htmlJa).not.toContain('Item may be cursed');
  });
});
