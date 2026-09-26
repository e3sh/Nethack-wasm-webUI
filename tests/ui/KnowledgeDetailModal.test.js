/**
 * KnowledgeDetailModal.test.js
 * 
 * 構造化ナレッジ詳細モーダル (KnowledgeDetailModal) の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeDetailModal } from '../../examples/gkl-pure-js-client/modules/components/KnowledgeDetailModal.js';

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
      if (selector === '#btn-knowledge-modal-close') {
        const btn = createMockElement('button');
        btn.id = 'btn-knowledge-modal-close';
        return btn;
      }
      return null;
    },
    querySelectorAll: () => [],
    ownerDocument: {
      createElement: (tag) => createMockElement(tag)
    },
    parentElement: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onclick: null
  };

  return el;
}

describe('KnowledgeDetailModal - 構造化ナレッジ詳細モーダル', () => {
  let elModal;
  let modal;
  let mockCore;

  beforeEach(() => {
    elModal = createMockElement('div');
    elModal.id = 'knowledge-detail-modal';
    elModal.classList.add('knowledge-modal-backdrop', 'hidden');

    mockCore = {
      gkl: {
        skillStateManager: null,
        structuredKnowledge: {
          getKnowledge: vi.fn((target) => target)
        }
      }
    };

    modal = new KnowledgeDetailModal({
      elModal,
      getCore: () => mockCore,
      language: 'ja'
    });
  });

  it('1. 初期状態で isVisible が false で hidden クラスを持つこと', () => {
    expect(modal.isVisible).toBe(false);
    expect(elModal.classList.contains('hidden')).toBe(true);
  });

  it('2. open() を呼ぶと isVisible が true になり hidden クラスが外れること', () => {
    const targetData = {
      name: 'オーク',
      category: 'MONSTER',
      dangerLevel: 'MEDIUM',
      stats: { hd: 3, ac: 6, speed: 9, mr: 0 }
    };

    modal.open(targetData);
    expect(modal.isVisible).toBe(true);
    expect(elModal.classList.contains('hidden')).toBe(false);
    expect(elModal.innerHTML).toContain('オーク');
  });

  it('3. close() を呼ぶと isVisible が false になり hidden クラスが付与されること', () => {
    modal.open({ name: 'オーク', category: 'MONSTER' });
    expect(modal.isVisible).toBe(true);

    modal.close();
    expect(modal.isVisible).toBe(false);
    expect(elModal.classList.contains('hidden')).toBe(true);
    expect(modal.currentTarget).toBeNull();
  });

  it('4. モンスターの詳細データ（耐性・弱点・ステータス・戦術アドバイス）が正しくHTML化されること', () => {
    const monsterData = {
      name: 'レッドドラゴン',
      category: 'MONSTER',
      dangerLevel: 'LETHAL',
      isHostile: true,
      stats: { hd: 15, ac: -1, speed: 9, mr: 20 },
      resistances: ['FIRE', 'SLEEP'],
      weaknesses: ['COLD'],
      attacks: ['fire breath (3d6)', 'claw (2d6)'],
      corpseSafety: { isSafe: true, nutrition: 400 },
      tacticalAdvice: ['冷気属性の魔法や杖で大ダメージを与えられます', '火炎耐性の獲得に最適です']
    };

    modal.open(monsterData);

    const html = elModal.innerHTML;
    expect(html).toContain('レッドドラゴン');
    expect(html).toContain('LETHAL DANGER');
    expect(html).toContain('HD/Lv');
    expect(html).toContain('15');
    expect(html).toContain('耐性:');
    expect(html).toContain('FIRE, SLEEP');
    expect(html).toContain('弱点:');
    expect(html).toContain('COLD');
    expect(html).toContain('fire breath (3d6)');
    expect(html).toContain('冷気属性の魔法や杖で大ダメージを与えられます');
  });

  it('5. アイテムの詳細データ（BUC効果・識別テクニック・用途アドバイス）が正しくHTML化されること', () => {
    const itemData = {
      name: '浮遊の指輪',
      category: 'ITEM',
      rawText: 'a blessed ring of levitation',
      bucStatus: 'BLESSED',
      isUnidentified: false,
      effectSummary: '足元が床から浮き上がり、落とし穴や水場の上を安全に渡ることができます。',
      bucEffects: {
        blessed: '意図したタイミングで着脱可能で制御できます',
        cursed: '呪われて外せなくなり、下の階層へ降りられなくなります'
      },
      unidentifiedTips: ['シンクの上に落とすと「シンクの底から指輪が浮かび上がった」と表示されます'],
      usageAdvice: ['メデューサの階層や城の跳ね橋を渡る際に必須級のアイテムです']
    };

    modal.open(itemData);

    const html = elModal.innerHTML;
    expect(html).toContain('浮遊の指輪');
    expect(html).toContain('BLESSED');
    expect(html).toContain('BUC効果');
    expect(html).toContain('意図したタイミングで着脱可能');
    expect(html).toContain('識別戦術テクニック');
    expect(html).toContain('シンクの上に落とすと');
    expect(html).toContain('用途・活用アドバイス');
    expect(html).toContain('メデューサの階層');
  });

  it('6. ギミック・地形データ（ドア、祭壇など）が正しくHTML化されること', () => {
    const altarData = {
      name: '混沌の祭壇',
      category: 'ALTAR',
      effectSummary: 'カオス属性の神を祀る祭壇。新鮮な死体を捧げて神の好感度を得られます。',
      usageAdvice: '呪われたアイテムを置くと黒い光、祝福なら琥珀色の光で判別できます。'
    };

    modal.open(altarData);

    const html = elModal.innerHTML;
    expect(html).toContain('混沌の祭壇');
    expect(html).toContain('ダンジョンギミック/地形');
    expect(html).toContain('カオス属性の神を祀る祭壇');
    expect(html).toContain('ヒント・アドバイス');
  });

  it('7. setLanguage で英語に切り替えた際に英語ラベルで再描画されること', () => {
    modal.open({
      name: 'Goblin',
      category: 'MONSTER',
      dangerLevel: 'LOW',
      stats: { hd: 1, ac: 10, speed: 6, mr: 0 },
      tacticalAdvice: ['Easy to defeat with any weapon.']
    });

    expect(elModal.innerHTML).toContain('実戦戦術アドバイス');

    modal.setLanguage('en');
    expect(elModal.innerHTML).toContain('Tactical Advice');
    expect(modal.currentLanguage).toBe('en');
  });

  it('8. モーダル背景（elModal 自体）がクリックされたときに close() されること', () => {
    modal.open({ name: 'Chest', category: 'CONTAINER' });
    expect(modal.isVisible).toBe(true);

    // 背景クリックイベントをシミュレート
    elModal.onclick({ target: elModal });
    expect(modal.isVisible).toBe(false);
  });

  it('9. 床の死体アイテム（category: CORPSE）がダンジョンギミックではなくアイテム（死体・食用特性）として正しく描画されること', () => {
    const corpseData = {
      id: 'corpse_12',
      name: 'ジャッカル の死体 (corpse)',
      nameEn: 'jackal corpse',
      category: 'CORPSE',
      canBeUnidentified: false,
      corpseInfo: {
        edible: true,
        poisonous: false,
        causesPetrification: false,
        nutrition: 50,
        grantsIntrinsics: []
      },
      effectSummary: 'モンスター (ジャッカル) の死体です。食料として食べるか、祭壇で捧げることができます。'
    };

    modal.open(corpseData);

    const html = elModal.innerHTML;
    // タイトルとカテゴリ
    expect(html).toContain('ジャッカル の死体 (corpse)');
    expect(html).toContain('CORPSE');
    // ダンジョンギミックになっていないこと
    expect(html).not.toContain('ダンジョンギミック/地形');
    // アイコンが肉・死体系であること
    expect(html).toContain('🥩');
    // 死体・食用特性セクションが表示されていること
    expect(html).toContain('死体・食用特性');
    expect(html).toContain('食用安全');
    expect(html).toContain('栄養価: 50');
    expect(html).toContain('効果要約');
    expect(html).toContain('モンスター (ジャッカル) の死体です');
  });

  it('10. モンスターの attacks がオブジェクト形式（type, damage, effect）の場合に JSON 文字列ではなく人間可読な形式で描画されること', () => {
    // lichen のような通常攻撃オブジェクト
    const lichenData = {
      name: '地衣類 (lichen)',
      nameEn: 'lichen',
      category: 'MONSTER',
      dangerLevel: 'LOW',
      stats: { hd: 0, ac: 9, speed: 1, mr: 0 },
      attacks: [{ type: 'weapon/hit', damage: '1d6' }]
    };

    // 英語モードで表示
    modal.setLanguage('en');
    modal.open(lichenData);
    let html = elModal.innerHTML;

    // JSON 文字列のままでないこと
    expect(html).not.toContain('{"type"');
    expect(html).not.toContain('"weapon/hit"');
    // 英語フォーマットの攻撃名とダメージが含まれること
    expect(html).toContain('Weapon/Hit');
    expect(html).toContain('(1d6)');

    // 日本語モードで表示
    modal.setLanguage('ja');
    modal.open(lichenData);
    html = elModal.innerHTML;

    expect(html).not.toContain('{"type"');
    expect(html).toContain('武器/打撃');
    expect(html).toContain('(1d6)');

    // 特殊効果付き攻撃（毒針、石化接触）のテスト
    const dangerousMonster = {
      name: 'コカトリス (cockatrice)',
      nameEn: 'cockatrice',
      category: 'MONSTER',
      dangerLevel: 'LETHAL',
      stats: { hd: 5, ac: 6, speed: 12, mr: 30 },
      attacks: [
        { type: 'sting', damage: '1d3', effect: 'poison' },
        { type: 'touch', effect: 'petrify' }
      ]
    };

    modal.setLanguage('ja');
    modal.open(dangerousMonster);
    html = elModal.innerHTML;

    expect(html).not.toContain('{"type"');
    expect(html).toContain('刺突');
    expect(html).toContain('(1d3)');
    expect(html).toContain('毒');
    expect(html).toContain('接触');
    expect(html).toContain('石化');
    expect(html).toContain('石化即死危険');
  });

  it('11. 平和的モンスター (PEACEFUL) の場合に☮️ 平和的 (SAFE) バッジが表示されること', () => {
    const peacefulMonster = {
      name: '平和な店主',
      category: 'MONSTER',
      dangerLevel: 'SAFE',
      dispositionStatus: 'PEACEFUL',
      isPeaceful: true,
      stats: { hd: 12, ac: 0, speed: 18 }
    };

    modal.setLanguage('ja');
    modal.open(peacefulMonster);
    expect(elModal.innerHTML).toContain('kn-status-peaceful');
    expect(elModal.innerHTML).toContain('☮️ 平和的 (SAFE)');

    modal.setLanguage('en');
    expect(elModal.innerHTML).toContain('☮️ Peaceful (SAFE)');
  });

  it('12. 通常平和モンスター (DEFAULT_PEACEFUL) の場合に☮️ 通常平和 バッジと注釈が表示されること', () => {
    const defaultPeaceful = {
      name: '番兵',
      category: 'MONSTER',
      dangerLevel: 'SAFE',
      dispositionStatus: 'DEFAULT_PEACEFUL',
      defaultPeaceful: true,
      stats: { hd: 6, ac: 5, speed: 12 }
    };

    modal.setLanguage('ja');
    modal.open(defaultPeaceful);
    expect(elModal.innerHTML).toContain('kn-status-peaceful');
    expect(elModal.innerHTML).toContain('☮️ 通常平和 (SAFE)');
    expect(elModal.innerHTML).toContain('通常は平和的ですが、攻撃や泥棒を行うと敵対化します');

    modal.setLanguage('en');
    expect(elModal.innerHTML).toContain('☮️ Normally Peaceful');
    expect(elModal.innerHTML).toContain('Normally peaceful; becomes hostile if attacked or stolen from');
  });
});


