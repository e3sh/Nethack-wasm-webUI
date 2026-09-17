/**
 * PaperdollModal.test.js
 *
 * 装備ペーパードールUI ＆ リアルタイム差分プレビューモーダルの単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaperdollModal } from '../../examples/gkl-pure-js-client/modules/components/PaperdollModal.js';
import { EQUIP_SLOTS } from "../../src/core/knowledge/equipment/EquipmentRules.js";

// 軽量DOMモック
function createMockElement(id = '', tag = 'div') {
  const listeners = new Map();
  const classListSet = new Set(['hidden']);
  const elementCache = new Map();
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
      if (!elementCache.has(sel)) {
        elementCache.set(sel, {
          id: sel.replace(/^[#.]/, ''),
          onclick: null,
          disabled: false,
          dataset: {},
          innerHTML: '',
          classList: { add: vi.fn(), remove: vi.fn(), contains: () => false }
        });
      }
      return elementCache.get(sel);
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
      currentPromptCategory: 'POSKEY',
      executeSequence: vi.fn().mockResolvedValue(true),
      getSituation: () => mockSituation,
      gkl: {
        getSituation: () => mockSituation,
        getPerceivedMonstersSummary: () => [],
        syncInventorySilent: vi.fn().mockResolvedValue(true)
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

  it('正副武器切替ボタン (#btn-paperdoll-swap) のクリックで core.executeSequence([\'x\']) が実行されること', async () => {
    paperdoll.show();
    const swapBtn = modalElement.querySelector('#btn-paperdoll-swap');
    expect(swapBtn).toBeDefined();
    expect(typeof swapBtn.onclick).toBe('function');

    await swapBtn.onclick();

    expect(mockCore.executeSequence).toHaveBeenCalledWith(['x']);
  });

  it('二刀流トグルボタン (#btn-paperdoll-two-weapon) のクリックで core.executeSequence([\'X\']) が実行されること', async () => {
    paperdoll.show();
    const twoWeaponBtn = modalElement.querySelector('#btn-paperdoll-two-weapon');
    expect(twoWeaponBtn).toBeDefined();
    expect(typeof twoWeaponBtn.onclick).toBe('function');

    await twoWeaponBtn.onclick();

    expect(mockCore.executeSequence).toHaveBeenCalledWith(['X']);
  });

  it('二刀流中（isOffhand なアイテムが存在する時）に二刀流ボタンに is-active クラスが付与されること', () => {
    // 1. 通常状態（二刀流なし）
    paperdoll.show();
    let html = modalElement.innerHTML;
    expect(html).toContain('btn-two-weapon');
    expect(html).not.toMatch(/btn-two-weapon\s+is-active/);

    // 2. 二刀流状態（isOffhand アイテムを追加）
    mockSituation.inventory.items.push({
      letter: 'g',
      name: 'silver dagger',
      isOffhand: true,
      rawText: 'g - a silver dagger (in off hand)'
    });
    paperdoll.render();

    html = modalElement.innerHTML;
    expect(html).toMatch(/btn-two-weapon\s+is-active/);
  });

  it('言語設定（ja / en）に応じて武器切替・二刀流ボタンのラベルおよびツールチップが切り替わること', () => {
    // 日本語モード
    paperdoll.setLanguage('ja');
    paperdoll.show();
    const htmlJa = modalElement.innerHTML;
    expect(htmlJa).toContain('武器切替 (x)');
    expect(htmlJa).toContain('二刀流 (#twoweapon / X)');

    // 英語モード
    paperdoll.setLanguage('en');
    const htmlEn = modalElement.innerHTML;
    expect(htmlEn).toContain('Swap Weapons (x)');
    expect(htmlEn).toContain('Two-Weapon (#twoweapon / X)');
  });

  it('二刀流適性判定: Samurai等の適性職で活性化され、制限職やスキルRestrictedで非活性（disabled）になること', () => {
    // 1. Samurai（適性職）: 活性化
    mockSituation.attributes = {
      characterInfo: { role: 'samurai' }
    };
    paperdoll.show();
    expect(modalElement.innerHTML).not.toContain('id="btn-paperdoll-two-weapon"\n                          disabled');
    expect(modalElement.innerHTML).not.toContain('is-disabled');

    // 2. Valkyrie（非適性職）: 非活性
    mockSituation.attributes = {
      characterInfo: { role: 'valkyrie' }
    };
    paperdoll.render();
    expect(modalElement.innerHTML).toContain('is-disabled');
    expect(modalElement.innerHTML).toContain('disabled');

    // 3. スキル情報で two-weapon combat が Basic（向上済み）の場合: 職に関わらず活性化
    mockSituation.skills = {
      items: [
        { name: 'two-weapon combat', rank: { key: 'basic' } }
      ]
    };
    paperdoll.render();
    expect(modalElement.innerHTML).not.toContain('is-disabled');

    // 4. スキル情報で two-weapon combat が restricted の場合: 非活性
    mockSituation.skills = {
      items: [
        { name: 'two-weapon combat', rank: { key: 'restricted' } }
      ]
    };
    paperdoll.render();
    expect(modalElement.innerHTML).toContain('is-disabled');
    expect(modalElement.innerHTML).toContain('disabled');
  });

  it('盾（Shield）装備時は控え武器があっても二刀流ボタンが点灯せず非活性（disabled）になること', () => {
    // 侍（適性職）
    mockSituation.attributes = {
      characterInfo: { role: 'samurai' }
    };
    // 控え武器 (g) を所持
    mockSituation.inventory.items.push({
      letter: 'g',
      name: 'silver dagger',
      isOffhand: true,
      rawText: 'g - a silver dagger (in off hand)'
    });
    // 盾 (s) を装備
    mockSituation.inventory.items.push({
      letter: 's',
      name: 'small shield',
      armorSlot: 'shield',
      isWorn: true,
      rawText: 's - a small shield (being worn)'
    });

    paperdoll.show();
    const html = modalElement.innerHTML;

    // 盾を装備しているため、二刀流中（is-active）になってはならない
    expect(html).not.toMatch(/btn-two-weapon\s+is-active/);
    // ボタンは非活性（disabled）になり、ツールチップに警告が表示されること
    expect(html).toContain('disabled');
    expect(html).toContain('盾装備中は二刀流不可');
  });

  it('両手武器装備時は二刀流ボタンが点灯せず非活性（disabled）になること', () => {
    // 侍（適性職）
    mockSituation.attributes = {
      characterInfo: { role: 'samurai' }
    };
    // 主手を両手武器（tsurugi / two-handed）に変更
    mockSituation.inventory.items[0] = {
      letter: 'a',
      name: 'tsurugi',
      isWielded: true,
      rawText: 'a - a tsurugi (weapon in hands)'
    };
    // 控え武器 (g)
    mockSituation.inventory.items.push({
      letter: 'g',
      name: 'silver dagger',
      isOffhand: true,
      rawText: 'g - a silver dagger (in off hand)'
    });

    paperdoll.show();
    const html = modalElement.innerHTML;

    // 両手武器のため点灯せず、非活性となること
    expect(html).not.toMatch(/btn-two-weapon\s+is-active/);
    expect(html).toContain('disabled');
    expect(html).toContain('両手武器装備中は二刀流不可');
  });

  it('単なる控え武器 (alternate weapon; not wielded) では二刀流ボタンは点灯しないこと', () => {
    mockSituation.attributes = {
      characterInfo: { role: 'samurai' }
    };
    // 単なるスワップ用控え武器
    mockSituation.inventory.items.push({
      letter: 'g',
      name: 'silver dagger',
      isOffhand: true,
      rawText: 'g - a silver dagger (alternate weapon; not wielded)'
    });

    paperdoll.show();
    const html = modalElement.innerHTML;

    // 二刀流戦闘態勢（in off-hand / 二刀流中）ではないため点灯しない
    expect(html).not.toMatch(/btn-two-weapon\s+is-active/);
  });

  it('アミュレットを装備している場合、首スロット（AMULET）に反映され表示されること', () => {
    // アミュレット (being worn) をインベントリに追加
    mockSituation.inventory.items.push({
      letter: 'p',
      name: 'amulet of ESP',
      category: 'AMULET',
      isWorn: true,
      rawText: 'p - an amulet of ESP (being worn)'
    });

    paperdoll.show();
    const html = modalElement.innerHTML;

    // 首スロット (data-slot="amulet") にアイテムレター p が表示されていること
    expect(html).toMatch(/data-slot="amulet"[\s\S]*?<span class="slot-letter-tag">p<\/span>/);
    // アミュレット名が表示されていること（日本語モードなら「ESPのアミュレット」または「超感覚のアミュレット」）
    expect(html).toContain('ESP');
  });

  it('首スロット（AMULET）選択時に、インベントリ内のアミュレットがクイックセレクターに表示されること', () => {
    // アミュレットアイテムをインベントリに追加
    mockSituation.inventory.items.push(
      { letter: 'p', name: 'amulet of ESP', rawText: 'p - an amulet of ESP' },
      { letter: 'q', name: '超感覚の魔よけ', rawText: 'q - 超感覚の魔よけ' },
      { letter: 'u', name: 'circular amulet', rawText: 'u - a circular amulet' }
    );

    // 首スロットを選択
    paperdoll.selectedSlot = EQUIP_SLOTS.AMULET;
    paperdoll.show();

    const html = modalElement.innerHTML;

    // クイックセレクターにアミュレットが含まれること
    expect(html).toContain('data-letter="p"');
    expect(html).toContain('data-letter="q"');
    expect(html).toContain('data-letter="u"');
    expect(html).not.toContain('このスロットに装備可能なアイテムがありません');
  });

  it('脱衣後にゲーム内プロンプト（テレポート先確認等）が発生した場合、自動的にモーダルを閉じること（Auto-Yield）', async () => {
    paperdoll.show();
    expect(paperdoll.isVisible).toBe(true);

    // executeSequence 呼び出しの副作用としてプロンプト待機状態をシミュレート
    mockCore.executeSequence.mockImplementation(async () => {
      mockCore.currentPromptCategory = 'DIRECTION';
      return true;
    });

    const hideSpy = vi.spyOn(paperdoll, 'hide');

    await paperdoll.executeTakeOff(EQUIP_SLOTS.MAIN_HAND);

    // プロンプト発生により hide() が呼ばれ、モーダルが閉じていること
    expect(hideSpy).toHaveBeenCalled();
    expect(paperdoll.isVisible).toBe(false);

    hideSpy.mockRestore();
  });

  it('換装後にプロンプトが発生しない通常時は、syncInventorySilent を待機して render すること', async () => {
    paperdoll.show();
    const renderSpy = vi.spyOn(paperdoll, 'render');
    const targetItem = mockSituation.inventory.items[4]; // helmet (e)

    await paperdoll.executeEquip(targetItem, EQUIP_SLOTS.HELM);

    expect(mockCore.gkl.syncInventorySilent).toHaveBeenCalled();
    expect(renderSpy).toHaveBeenCalled();
    expect(paperdoll.isVisible).toBe(true);

    renderSpy.mockRestore();
  });

  it('武器スワップ (x) 実行時にプロンプトが発生した場合はモーダルが閉じること', async () => {
    paperdoll.show();
    const swapBtn = modalElement.querySelector('#btn-paperdoll-swap');

    mockCore.executeSequence.mockImplementation(async () => {
      mockCore.currentPromptCategory = 'COORDINATE';
      return true;
    });

    const hideSpy = vi.spyOn(paperdoll, 'hide');

    await swapBtn.onclick();

    expect(hideSpy).toHaveBeenCalled();
    expect(paperdoll.isVisible).toBe(false);

    hideSpy.mockRestore();
  });

  it('通常ターン待機時（POSKEY / NONE）の装備操作ではモーダルが閉じず維持されること', async () => {
    // POSKEY 状態
    mockCore.currentPromptCategory = 'POSKEY';
    paperdoll.show();
    expect(paperdoll.isVisible).toBe(true);

    const targetItem = mockSituation.inventory.items[4]; // helmet (e)
    await paperdoll.executeEquip(targetItem, EQUIP_SLOTS.HELM);
    expect(paperdoll.isVisible).toBe(true);

    // NONE 状態での脱衣
    mockCore.currentPromptCategory = 'NONE';
    await paperdoll.executeTakeOff(EQUIP_SLOTS.MAIN_HAND);
    expect(paperdoll.isVisible).toBe(true);

    // 武器スワップでも維持されること
    const swapBtn = modalElement.querySelector('#btn-paperdoll-swap');
    await swapBtn.onclick();
    expect(paperdoll.isVisible).toBe(true);
  });

  it('アミュレット脱衣後にPOSKEY状態でもテレポート先問い合わせ（Where do you want to...）があればモーダルを閉じ同期を実行しないこと', async () => {
    // アミュレットを装備中としてインベントリに追加
    mockSituation.inventory.items.push({
      letter: 'p',
      name: 'amulet of teleportation',
      category: 'AMULET',
      isWorn: true,
      rawText: 'p - an amulet of teleportation (being worn)'
    });

    paperdoll.show();
    expect(paperdoll.isVisible).toBe(true);

    mockCore.currentPromptCategory = 'POSKEY';
    mockCore.executeSequence.mockImplementation(async () => {
      // NetHack Cコアが pline("Where do you want to be teleported?") を出力して getpos(POSKEY) に入った状態をシミュレート
      mockCore.lastRawMessageText = 'Where do you want to be teleported?';
      return true;
    });

    const hideSpy = vi.spyOn(paperdoll, 'hide');

    await paperdoll.executeTakeOff(EQUIP_SLOTS.AMULET);

    // プロンプトが検知されてモーダルが閉じること
    expect(hideSpy).toHaveBeenCalled();
    expect(paperdoll.isVisible).toBe(false);

    // プロンプトをESCで潰さないため、syncInventorySilent が呼ばれていないこと
    expect(mockCore.gkl.syncInventorySilent).not.toHaveBeenCalled();

    hideSpy.mockRestore();
  });

  it('副武器（OFF_HAND / 控え）スロットが表示専用（is-readonly）であり、選択されても主手へフォールバックされること', () => {
    // 控え武器を持たせる
    mockSituation.inventory.items.push({
      letter: 'g',
      name: 'silver dagger',
      isOffhand: true,
      rawText: 'g - a silver dagger (alternate weapon; not wielded)'
    });

    paperdoll.show();
    const html = modalElement.innerHTML;

    // data-slot="off_hand" に is-readonly クラスが付与されていること
    expect(html).toMatch(/class="paperdoll-slot[^"]*is-readonly[^"]*"[\s\S]*?data-slot="off_hand"/);
    expect(html).toContain('控え武器 / 正副切替(x)ボタンで切替');

    // 誤って selectedSlot に off_hand が指定されても、render() で main_hand にフォールバックすること
    paperdoll.selectedSlot = EQUIP_SLOTS.OFF_HAND;
    paperdoll.render();
    expect(paperdoll.selectedSlot).toBe(EQUIP_SLOTS.MAIN_HAND);
  });
});
