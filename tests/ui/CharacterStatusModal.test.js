import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMockDom } from '../components/testElementHelper.js';
import { CharacterStatusModal } from '../../examples/gkl-pure-js-client/modules/components/CharacterStatusModal.js';

describe('CharacterStatusModal (On-Demand Direct Binding Sheet)', () => {
  let restoreDom;
  let mockCore;
  let mockGkl;
  let mockAttrManager;
  let mockSpellManager;
  let mockSkillManager;
  let elModal;
  let modal;

  beforeEach(() => {
    restoreDom = setupMockDom();

    // DOM Mock
    elModal = document.createElement('div');
    elModal.id = 'character-status-modal';
    elModal.className = 'modal-backdrop hidden';
    document.body.appendChild(elModal);

    mockAttrManager = {
      getCharacterSummary: vi.fn((lang) => ({
        playerName: 'Val-Valkyrie',
        role: 'valkyrie',
        roleName: lang === 'en' ? 'Valkyrie' : 'ワルキューレ',
        race: 'human',
        raceName: lang === 'en' ? 'Human' : '人間',
        gender: 'female',
        alignment: 'neutral',
        alignName: lang === 'en' ? 'Neutral' : '中立',
        level: 3,
        displayTag: '👤 [人間 / ワルキューレ Lv.3]'
      })),
      getActiveResistances: vi.fn((lang) => [
        { key: 'cold', label: '❄️冷気', en: 'Cold Resistance', name: '❄️冷気', source: 'intrinsic', isIntrinsic: true, isExtrinsic: false },
        { key: 'fire', label: '🔥火炎', en: 'Fire Resistance', name: '🔥火炎', source: 'extrinsic', isIntrinsic: false, isExtrinsic: true }
      ])
    };

    mockSpellManager = {
      getSpells: vi.fn(() => [
        { letter: 'a', name: 'healing', nameJa: '治療', level: 1, category: 'healing', failRate: '0%', retention: 18000 }
      ])
    };

    mockSkillManager = {
      getSkills: vi.fn(() => [
        { name: 'long sword', nameJa: '長剣', rank: { key: 'skilled', label: '熟練', en: 'Skilled' }, canEnhance: false, skillLevel: 2, isRestricted: false },
        { name: 'dagger', nameJa: '短剣', rank: { key: 'basic', label: '入門', en: 'Basic' }, canEnhance: true, letter: 'b', skillLevel: 1, isRestricted: false }
      ])
    };

    mockGkl = {
      syncAttributesOnDemand: vi.fn().mockResolvedValue(true),
      syncPlayerProfileOnDemand: vi.fn().mockResolvedValue(true),
      syncPlayerSummaryOnDemand: vi.fn().mockResolvedValue(true),
      syncSkillsOnDemand: vi.fn().mockResolvedValue(true),
      syncSpellsOnDemand: vi.fn().mockResolvedValue(true),
      getAttributeStateManager: () => mockAttrManager,
      getSpellStateManager: () => mockSpellManager,
      getSkillStateManager: () => mockSkillManager,
      castSpell: vi.fn(),
      enhanceSkill: vi.fn(),
      getStatus: () => ({
        title: 'Val-Valkyrie',
        dlevel: { text: 'Dlvl:2' },
        hp: { current: 28, max: 28 },
        pw: { current: 7, max: 7 },
        ac: 4,
        gold: { amount: 150 },
        level: 3,
        turns: 120,
        score: 450,
        stats: { str: '18/02', dex: 15, con: 16, int: 10, wis: 12, cha: 11 },
        align: 'Neutral'
      })
    };

    const listeners = {};
    mockCore = {
      gkl: mockGkl,
      getStatus: () => mockGkl.getStatus(),
      on: vi.fn((event, cb) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      emit: vi.fn((event, data) => {
        if (listeners[event]) listeners[event].forEach(cb => cb(data));
      })
    };

    modal = new CharacterStatusModal({
      elModal,
      getCore: () => mockCore,
      language: 'ja'
    });
  });

  afterEach(() => {
    if (restoreDom) restoreDom();
  });

  it('初期状態では非表示（isVisible: false）であること', () => {
    expect(modal.isOpen()).toBe(false);
    expect(elModal.classList.contains('hidden')).toBe(true);
  });

  it('open() 時に On-Demand 同期（0x33, 0x32, 0x70, 0x71）が並列実行され、モーダルが表示されること', async () => {
    await modal.open();

    expect(mockGkl.syncAttributesOnDemand).toHaveBeenCalledTimes(1);
    expect(mockGkl.syncSkillsOnDemand).toHaveBeenCalledTimes(1);
    expect(mockGkl.syncSpellsOnDemand).toHaveBeenCalledTimes(1);

    expect(modal.isOpen()).toBe(true);
    expect(elModal.classList.contains('hidden')).toBe(false);

    // プロフィール情報が描画されていること
    const text = elModal.textContent;
    expect(text).toContain('Val-Valkyrie');
    expect(text).toContain('ワルキューレ');
    expect(text).toContain('人間');
    expect(text).toContain('Lv.3');
    expect(text).toContain('28 / 28'); // HP
    expect(text).toContain('7 / 7');   // Pw
    expect(text).toContain('$150');    // Gold
    expect(text).toContain('Dlvl:2');  // Location

    // 6大能力値が描画されていること
    expect(text).toContain('18/02'); // St
    expect(text).toContain('15');    // Dex
    expect(text).toContain('16');    // Con

    // 耐性バッジ（冷気・火炎）が描画されていること
    expect(text).toContain('❄️冷気');
    expect(text).toContain('🔥火炎');

    // 呪文（治療）が描画されていること
    expect(text).toContain('治療');
    expect(text).toContain('[a]');

    // スキル（長剣・短剣）が描画されていること
    expect(text).toContain('長剣');
    expect(text).toContain('熟練');
    expect(text).toContain('短剣');
  });

  it('close() および ✕ ボタンクリックでモーダルが非表示になること', async () => {
    await modal.open();
    expect(modal.isOpen()).toBe(true);

    const btnClose = elModal.querySelector('#btn-char-status-close');
    expect(btnClose).toBeTruthy();
    btnClose.click();

    expect(modal.isOpen()).toBe(false);
    expect(elModal.classList.contains('hidden')).toBe(true);
  });

  it('呪文詠唱ボタンクリックでモーダルが閉じ、onCastSpell または core.gkl.castSpell が呼ばれること', async () => {
    const onCastSpellSpy = vi.fn();
    modal.onCastSpell = onCastSpellSpy;

    await modal.open();
    const castBtn = elModal.querySelector('button[data-letter="a"]');
    expect(castBtn).toBeTruthy();

    castBtn.click();
    expect(modal.isOpen()).toBe(false);
    expect(onCastSpellSpy).toHaveBeenCalledWith('a');
  });

  it('スキル向上ボタンクリックでモーダルが閉じ、onEnhanceSkill または core.gkl.enhanceSkill が呼ばれること', async () => {
    const onEnhanceSkillSpy = vi.fn();
    modal.onEnhanceSkill = onEnhanceSkillSpy;

    await modal.open();
    const enhanceBtn = elModal.querySelector('button[data-letter="b"]');
    expect(enhanceBtn).toBeTruthy();

    enhanceBtn.click();
    expect(modal.isOpen()).toBe(false);
    expect(onEnhanceSkillSpy).toHaveBeenCalledWith('b');
  });

  it('setLanguage("en") で英語表示に切り替わること', async () => {
    await modal.open();
    modal.setLanguage('en');

    const text = elModal.textContent;
    expect(text).toContain('Character Profile & Status');
    expect(text).toContain('Valkyrie');
    expect(text).toContain('Human');
    expect(text).toContain('Adventurer Identity');
    expect(text).toContain('Learned Spells');
    expect(text).toContain('Weapon & Martial Skills');
  });

  it('summary.level が古くても最新の status.level が優先して描画され、updateFromStatus が呼ばれること', async () => {
    mockAttrManager.updateFromStatus = vi.fn();
    mockAttrManager.getCharacterSummary = vi.fn(() => ({
      playerName: 'Val-Valkyrie',
      role: 'valkyrie',
      roleName: 'ワルキューレ',
      race: 'human',
      raceName: '人間',
      gender: 'female',
      alignment: 'neutral',
      alignName: '中立',
      level: 1, // 古いまま
      displayTag: '👤 [人間 / ワルキューレ Lv.1]'
    }));
    mockGkl.getStatus = () => ({
      title: 'Val-Valkyrie',
      dlevel: { text: 'Dlvl:1' },
      hp: { current: 30, max: 30 },
      pw: { current: 10, max: 10 },
      ac: 2,
      level: 5, // レベルアップ後
      exp: 1500,
      hasExp: true
    });

    await modal.open();
    expect(mockAttrManager.updateFromStatus).toHaveBeenCalled();
    const text = elModal.textContent;
    expect(text).toContain('Lv.5 / 1500');
    expect(text).toContain('👤 人間 / ワルキューレ Lv.5');
  });

  it('モーダル表示中に status_update が発火された場合、自動的に最新ステータスに再描画されること', async () => {
    let currentHp = 20;
    mockGkl.getStatus = () => ({
      title: 'Val-Valkyrie',
      dlevel: { text: 'Dlvl:1' },
      hp: { current: currentHp, max: 30 },
      pw: { current: 10, max: 10 },
      level: 2
    });

    await modal.open();
    expect(elModal.textContent).toContain('20 / 30');

    // HP変動イベント発生
    currentHp = 15;
    mockCore.emit('status_update', { field: 18, value: 15 });

    expect(elModal.textContent).toContain('15 / 30');
  });
});
