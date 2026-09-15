import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// DOM環境のセットアップ（happy-dom / jsdom / Nodeモック）
if (typeof document === 'undefined') {
  const elements = {};
  global.document = {
    createElement: (tag) => {
      const elem = {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        innerHTML: '',
        textContent: '',
        children: [],
        style: {},
        classList: {
          contains: vi.fn().mockReturnValue(false),
          add: vi.fn(),
          remove: vi.fn(),
          toggle: vi.fn()
        },
        appendChild: vi.fn((c) => {
          elem.children.push(c);
          elem.innerHTML += (c.innerHTML || '');
        }),
        querySelectorAll: vi.fn().mockReturnValue([]),
        querySelector: vi.fn().mockReturnValue(null),
        focus: vi.fn()
      };
      return elem;
    },
    getElementById: (id) => {
      if (!elements[id]) {
        const elem = {
          id,
          textContent: '',
          innerHTML: '',
          children: [],
          style: {},
          classList: {
            contains: vi.fn().mockReturnValue(false),
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn()
          },
          focus: vi.fn(),
          appendChild: vi.fn((c) => {
            elem.children.push(c);
            elem.innerHTML += (c.innerHTML || '');
          }),
          querySelectorAll: vi.fn().mockReturnValue([])
        };
        elements[id] = elem;
      }
      return elements[id];
    },
    body: {
      appendChild: vi.fn()
    }
  };
  global.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
}

import { CharacterCreationModal } from '../../examples/gkl-pure-js-client/modules/components/CharacterCreationModal.js';

describe('CharacterCreationModal - シナリオ連動テスト', () => {
  let modal;
  let mockCore;
  let scenario;

  beforeEach(() => {
    mockCore = {
      respond: vi.fn(),
      translator: {
        translate: (text) => text
      }
    };
    modal = new CharacterCreationModal({
      getCore: () => mockCore
    });

    const scenarioPath = path.resolve(__dirname, '../fixtures/scenarios/char_generate_1789427360539.json');
    scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  });

  it('シナリオ内のキャラクター作成メニューイベントを100%検出できること', () => {
    const inputEvents = scenario.events.filter(e => e.type === 'inputRequired');
    
    // Step 1: askname (string) -> false
    expect(modal.isCharacterCreationMenu(inputEvents[0].data)).toBe(false);

    // Step 2: yn_function (yn) -> false
    expect(modal.isCharacterCreationMenu(inputEvents[1].data)).toBe(false);

    // Step 3: Pick a role or profession (menu) -> true
    expect(modal.isCharacterCreationMenu(inputEvents[2].data)).toBe(true);

    // Step 4: Pick a race or species (menu) -> true
    expect(modal.isCharacterCreationMenu(inputEvents[3].data)).toBe(true);

    // Step 7: Pick an alignment or creed (menu) -> true
    expect(modal.isCharacterCreationMenu(inputEvents[6].data)).toBe(true);

    // Step 13: Is this ok? [ynq] (menu) -> true
    expect(modal.isCharacterCreationMenu(inputEvents[10].data)).toBe(true);
  });

  it('Step 3 (Role選択) のメニューをパースして正しく表示できること', () => {
    const step3 = scenario.events.find(e => e.type === 'inputRequired' && e.data.prompt === 'Pick a role or profession');
    modal.show(step3.data, 'ja');

    expect(modal.isVisible).toBe(true);
    expect(modal.activeTab).toBe('role');
    expect(modal.currentItems.length).toBeGreaterThan(0);
  });

  it('Step 10 (Lawful選択後) の絞り込み状態を正しく解析できること', () => {
    // Step 10: <role> <race> <gender> lawful
    const inputEvents = scenario.events.filter(e => e.type === 'inputRequired');
    const step10 = inputEvents.find(e => e.data.menuItems && e.data.menuItems.some(m => m.str && m.str.includes('<role> <race> <gender> lawful')));
    expect(step10).toBeDefined();
    modal.show(step10.data, 'ja');

    expect(modal.activeTab).toBe('role');
    expect(modal.selectedConfig.align).toBe('lawful');
  });

  it('Step 11 (Archeologist選択後) の種族絞り込み状態を正しく解析できること', () => {
    // Step 11: Archeologist <race> <gender> lawful
    const inputEvents = scenario.events.filter(e => e.type === 'inputRequired');
    const step11 = inputEvents.find(e => e.data.menuItems && e.data.menuItems.some(m => m.str && m.str.includes('Archeologist <race> <gender> lawful')));
    expect(step11).toBeDefined();
    modal.show(step11.data, 'ja');

    expect(modal.activeTab).toBe('race');
    expect(modal.selectedConfig.role).toBe('Archeologist');
    expect(modal.selectedConfig.align).toBe('lawful');
  });

  it('Step 13 (最終確認) のキャラクター名と構成を正しく解析し、y/nに応答できること', () => {
    const inputEvents = scenario.events.filter(e => e.type === 'inputRequired');
    const step13 = inputEvents.find(e => (e.data.prompt || e.data.query || '').includes('Is this ok? [ynq]'));
    expect(step13).toBeDefined();
    modal.show(step13.data, 'ja');

    expect(modal.activeTab).toBe('confirm');
    expect(modal.characterName).toBe('home');
    expect(modal.selectedConfig.role).toBe('Archeologist');
    expect(modal.selectedConfig.race).toBe('human');
    expect(modal.selectedConfig.gender).toBe('male');
    expect(modal.selectedConfig.align).toBe('lawful');

    // 「ゲーム開始」で y が送信されること
    modal.onConfirmStart();
    expect(mockCore.respond).toHaveBeenCalledWith('y');

    // 「やり直す」で n が送信されること
    modal.onChooseAgain();
    expect(mockCore.respond).toHaveBeenCalledWith('n');
  });

  it('core.playerName が設定されている場合、選択中 (Step 3) でも右上にその名前が反映されること', () => {
    mockCore.playerName = 'ValiantHero';
    const step3 = scenario.events.find(e => e.type === 'inputRequired' && e.data.prompt === 'Pick a role or profession');
    modal.show(step3.data, 'ja');

    expect(modal.characterName).toBe('ValiantHero');
    const elName = document.getElementById('cc-val-name');
    expect(elName.textContent).toBe('ValiantHero');
  });

  it('Step 11 (Race選択画面) でカード一覧に Quit やジャンプ項目が混ざらず、純粋な種族カードのみ生成されること', () => {
    const inputEvents = scenario.events.filter(e => e.type === 'inputRequired');
    const step11 = inputEvents.find(e => e.data.menuItems && e.data.menuItems.some(m => m.str && m.str.includes('Archeologist <race> <gender> lawful')));
    modal.show(step11.data, 'ja');

    const cardsGrid = document.getElementById('cc-cards-grid');
    const cardHtmls = cardsGrid.innerHTML;
    expect(cardHtmls).not.toContain('Quit');
    expect(cardHtmls).not.toContain('Random');
    expect(cardHtmls).not.toContain('Pick another role first');
    expect(cardHtmls).not.toContain('Set role/race/&c filtering');
    expect(cardHtmls).toContain('human');
    expect(cardHtmls).toContain('dwarf');
  });

  it('Step 11 (Race選択画面) で Role タブをクリックすると、メニュー内のジャンプ項目 (id: -4) が解決されて送信されること', () => {
    const inputEvents = scenario.events.filter(e => e.type === 'inputRequired');
    const step11 = inputEvents.find(e => e.data.menuItems && e.data.menuItems.some(m => m.str && m.str.includes('Archeologist <race> <gender> lawful')));
    modal.show(step11.data, 'ja');

    // 現在は race 画面。role タブをクリックすると Pick another role first (id: -4) が呼ばれること
    modal.onTabClick('role');
    expect(mockCore.respond).toHaveBeenCalledWith([{ identifier: -4, count: -1 }]);

    // 現在開いている race タブをクリックしても何も送信されないこと (no-op)
    mockCore.respond.mockClear();
    modal.onTabClick('race');
    expect(mockCore.respond).not.toHaveBeenCalled();
  });

  it('制約行 (forces) がメニューに含まれる場合、自動的にその項目が確定設定されること', () => {
    const customData = {
      prompt: 'Pick an alignment or creed',
      menuItems: [
        { identifier: 0, str: '<role> <race> <gender> <alignment>' },
        { identifier: 0, str: '    role forces female' },
        { identifier: 1, accelerator: 'l', str: 'lawful' },
        { identifier: 2, accelerator: 'n', str: 'neutral' },
        { identifier: -1, accelerator: 'q', str: 'Quit' }
      ]
    };

    modal.show(customData, 'ja');
    expect(modal.selectedConfig.gender).toBe('female');

    const cardsGrid = document.getElementById('cc-cards-grid');
    expect(cardsGrid.innerHTML).not.toContain('forces');
    expect(cardsGrid.innerHTML).not.toContain('Quit');
  });

  it('日本語翻訳された Step 13 (最終確認) のメニューでもキャラ作成画面として検出され、確認画面が表示されること', () => {
    const jaConfirmData = {
      prompt: 'これでよろしいですか？ [ynq]',
      rawPrompt: 'Is this ok? [ynq]',
      menuItems: [
        { identifier: 0, str: 'home the lawful male human Archeologist', rawStr: 'home the lawful male human Archeologist' },
        { identifier: 1, accelerator: 'y', str: 'はい；ゲームを開始', rawStr: 'Yes; start game' },
        { identifier: 2, accelerator: 'n', str: 'いいえ；役割をもう一度選ぶ', rawStr: 'No; choose role again' },
        { identifier: -1, accelerator: 'q', str: '終了', rawStr: 'Quit' }
      ]
    };

    // 1. isCharacterCreationMenu が日本語でも true を返すこと
    expect(modal.isCharacterCreationMenu(jaConfirmData)).toBe(true);

    // 2. show() 時に activeTab が 'confirm' となり、名前や構成が解析されること
    modal.show(jaConfirmData, 'ja');
    expect(modal.activeTab).toBe('confirm');
    expect(modal.characterName).toBe('home');
    expect(modal.selectedConfig.role).toBe('Archeologist');
    expect(modal.selectedConfig.align).toBe('lawful');
    expect(modal.selectedConfig.race).toBe('human');
    expect(modal.selectedConfig.gender).toBe('male');

    // 3. 画面上に確認ビューが表示されていること
    const confirmView = document.getElementById('cc-confirm-view');
    expect(confirmView.style.display).not.toBe('none');
  });

  it('Step 3 (Role選択) で各カードに制約バッジ・特徴バッジ・説明文が生成されること', () => {
    const step3 = scenario.events.find(e => e.type === 'inputRequired' && e.data.prompt === 'Pick a role or profession');
    modal.show(step3.data, 'ja');

    const cardsGrid = document.getElementById('cc-cards-grid');
    const html = cardsGrid.innerHTML;

    // バッジコンテナとバッジが存在すること
    expect(html).toContain('char-card-badges');
    expect(html).toContain('char-badge');

    // Valkyrie の女性限定バッジと冷気耐性バッジ
    expect(html).toContain('女性限定');
    expect(html).toContain('冷気耐性');

    // Knight の人間限定バッジと秩序固定バッジ
    expect(html).toContain('人間限定');
    expect(html).toContain('秩序固定');

    // 説明文が存在すること
    expect(html).toContain('char-card-desc');
  });

  it('英語モード (en) ではバッジやツールチップが英語で表示されること', () => {
    const step3 = scenario.events.find(e => e.type === 'inputRequired' && e.data.prompt === 'Pick a role or profession');
    modal.show(step3.data, 'en');

    const cardsGrid = document.getElementById('cc-cards-grid');
    const html = cardsGrid.innerHTML;

    // 英語のバッジラベル
    expect(html).toContain('Female only');
    expect(html).toContain('Cold res');
    expect(html).toContain('Human only');
    expect(html).toContain('Lawful only');

    // 日本語のラベルは含まれないこと
    expect(html).not.toContain('女性限定');
    expect(html).not.toContain('人間限定');
  });

  it('Step 11 (Race選択) でドワーフやオークの制約バッジと特徴バッジが生成されること', () => {
    const inputEvents = scenario.events.filter(e => e.type === 'inputRequired');
    const step11 = inputEvents.find(e => e.data.menuItems && e.data.menuItems.some(m => m.str && m.str.includes('Archeologist <race> <gender> lawful')));
    modal.show(step11.data, 'ja');

    const cardsGrid = document.getElementById('cc-cards-grid');
    const html = cardsGrid.innerHTML;

    // ドワーフ: 秩序固定, 暗視
    expect(html).toContain('秩序固定');
    expect(html).toContain('暗視');
  });

  it('性別選択画面で female 選択時に male カードが誤って selected にならないこと (部分一致バグ防止)', () => {
    const femaleMenuData = {
      prompt: 'Pick a gender or sex',
      menuItems: [
        { identifier: 0, str: 'Archeologist human female lawful' },
        { identifier: 1, accelerator: 'm', str: 'male' },
        { identifier: 2, accelerator: 'f', str: 'female' },
        { identifier: -1, accelerator: 'q', str: 'Quit' }
      ]
    };

    // 1. female が確定している場合
    modal.show(femaleMenuData, 'ja');

    const cardsGrid = document.getElementById('cc-cards-grid');
    // male カードは selected になっておらず、female カードのみ selected であること
    const cards = cardsGrid.children;
    const maleCard = cards.find(c => c.innerHTML.includes('male') && !c.innerHTML.includes('female'));
    const femaleCard = cards.find(c => c.innerHTML.includes('female'));

    expect(maleCard.classList.add).not.toHaveBeenCalledWith('selected');
    expect(femaleCard.classList.add).toHaveBeenCalledWith('selected');

    // 2. male が確定している場合
    cardsGrid.children = [];
    const maleMenuData = {
      prompt: 'Pick a gender or sex',
      menuItems: [
        { identifier: 0, str: 'Archeologist human male lawful' },
        { identifier: 1, accelerator: 'm', str: 'male' },
        { identifier: 2, accelerator: 'f', str: 'female' },
        { identifier: -1, accelerator: 'q', str: 'Quit' }
      ]
    };
    modal.show(maleMenuData, 'ja');

    const newCards = cardsGrid.children;
    const newMaleCard = newCards.find(c => c.innerHTML.includes('male') && !c.innerHTML.includes('female'));
    const newFemaleCard = newCards.find(c => c.innerHTML.includes('female'));

    expect(newMaleCard.classList.add).toHaveBeenCalledWith('selected');
    expect(newFemaleCard.classList.add).not.toHaveBeenCalledWith('selected');
  });

  it('アイテム使用・選択メニュー（"the ..." を含む項目）が誤ってキャラ作成メニューと判定されないこと', () => {
    // ユーザーが遭遇したバグの再現データ: アイテムメニューに "the blessed +1 ..." が含まれる
    const itemApplyMenuData = {
      prompt: 'What do you want to use or apply?',
      rawPrompt: 'What do you want to use or apply?',
      category: 'MENU',
      menuItems: [
        { identifier: 0, str: 'Coins' },
        { identifier: 1, accelerator: 'a', str: 'a key' },
        { identifier: 2, accelerator: 'b', str: 'the blessed +1 silver dragon scale mail' },
        { identifier: 3, accelerator: 'c', str: 'the +0 Hawaiian shirt' },
        { identifier: -1, accelerator: 'q', str: 'Quit' }
      ]
    };

    expect(modal.isCharacterCreationMenu(itemApplyMenuData)).toBe(false);

    const ynGeneralPromptData = {
      prompt: '本当にこのアイテムを破壊しますか？よろしいですか？ [yn]',
      rawPrompt: 'Really destroy this item? [yn]',
      menuItems: [
        { identifier: 1, accelerator: 'y', str: 'yes' },
        { identifier: 2, accelerator: 'n', str: 'no' }
      ]
    };

    expect(modal.isCharacterCreationMenu(ynGeneralPromptData)).toBe(false);
  });

  it('キャラクタ作成完了後 (isCompleted = true) はキャラ作成メニューとして検出されないこと', () => {
    const step3 = scenario.events.find(e => e.type === 'inputRequired' && e.data.prompt === 'Pick a role or profession');
    
    // 未完了時は true
    modal.isCompleted = false;
    expect(modal.isCharacterCreationMenu(step3.data)).toBe(true);

    // 完了時は false (ゲーム中ガード)
    modal.isCompleted = true;
    expect(modal.isCharacterCreationMenu(step3.data)).toBe(false);

    // reset() で再び false に戻り検出可能になること
    modal.reset();
    expect(modal.isCompleted).toBe(false);
    expect(modal.isCharacterCreationMenu(step3.data)).toBe(true);
  });

  it('専用シグナル SIGNAL_CHARACTER_CREATION / subCategory: CHARACTER_CREATION を最優先で検出できること', () => {
    // 1. subCategory 指定
    const signalData1 = {
      subCategory: 'CHARACTER_CREATION',
      menuItems: [{ identifier: 1, accelerator: 'a', str: 'Archeologist' }]
    };
    modal.isCompleted = false;
    expect(modal.isCharacterCreationMenu(signalData1)).toBe(true);

    // 2. signal.id 指定
    const signalData2 = {
      signal: { id: 'SIGNAL_CHARACTER_CREATION' },
      menuItems: [{ identifier: 1, accelerator: 'a', str: 'Archeologist' }]
    };
    expect(modal.isCharacterCreationMenu(signalData2)).toBe(true);

    // 3. isCompleted = true の場合はシグナルがあっても false
    modal.isCompleted = true;
    expect(modal.isCharacterCreationMenu(signalData1)).toBe(false);
    expect(modal.isCharacterCreationMenu(signalData2)).toBe(false);
  });

  it('カード未選択の状態でRoleメニューに戻った際、CURRENT CONFIGURATION および対象タグが pending (選択待ち色) になり、選択済みの項目は filled (Blue) を維持すること', () => {
    // 属性 lawful だけ確定し、Roleメニューに戻された状態 (<role> <race> <gender> lawful)
    const roleMenuData = {
      prompt: 'Pick a role or profession',
      menuItems: [
        { identifier: 0, str: '<role> <race> <gender> lawful' },
        { identifier: 1, accelerator: 'a', str: 'an Archeologist' },
        { identifier: 2, accelerator: 'b', str: 'a Barbarian' },
        { identifier: -1, accelerator: 'q', str: 'Quit' }
      ]
    };

    modal.show(roleMenuData, 'ja');

    const elTagRole = document.getElementById('cc-tag-role');
    const elTagAlign = document.getElementById('cc-tag-align');
    const elTagRace = document.getElementById('cc-tag-race');
    const elPreviewLabel = document.getElementById('cc-preview-label');

    // 1. Role は未選択なので pending (選択待ち) スタイルになる
    expect(elTagRole.className).toContain('pending');
    expect(elTagRole.textContent).toContain('選択待ち');

    // 2. 確定済みの Align (lawful) は filled (従来の Blue) のまま
    expect(elTagAlign.className).toContain('filled');
    expect(elTagAlign.textContent).toContain('秩序');

    // 3. まだ到達していない未選択の Race は通常の unset (グレー)
    expect(elTagRace.className).toContain('unset');
    expect(elTagRace.textContent).toContain('未選択');

    // 4. CURRENT CONFIGURATION ラベルも pending スタイルになる
    expect(elPreviewLabel.classList.add).toHaveBeenCalledWith('pending');
    expect(elPreviewLabel.textContent).toContain('選択待ち');

    // 5. Role カードを選択して確定した場合
    modal.selectedConfig.role = 'Archeologist';
    modal.render();

    expect(elTagRole.className).toContain('filled');
    expect(elTagRole.textContent).toContain('考古学者');
  });
});
