import { describe, it, expect } from 'vitest';
import { PromptPayloadBuilder } from './PromptPayloadBuilder.js';
import { PROMPT_CATEGORY } from '../types.js';

describe('PromptPayloadBuilder', () => {
    it('YN プロンプトを CHOICE_BUTTONS ペイロードにパースできること', () => {
        const builder = new PromptPayloadBuilder();
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "Shall I pick up the gold?",
            choices: "y/n"
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('CHOICE_BUTTONS');
        expect(res.promptText).toBe('Shall I pick up the gold?');
        expect(res.options).toHaveLength(2);
        expect(res.options[0]).toEqual({ key: 'y', label: 'Yes (y)', btnClass: 'btn-primary' });
        expect(res.options[1]).toEqual({ key: 'n', label: 'No (n)', btnClass: 'btn-secondary' });
    });

    it('ynaq や特殊選択肢を含む YN プロンプトを正しく CHOICE_BUTTONS にパースできること', () => {
        const builder = new PromptPayloadBuilder();
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "Do you want to drop items? [ynaq]",
            choices: "ynaq"
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('CHOICE_BUTTONS');
        expect(res.options).toHaveLength(4);
        expect(res.options.map(o => o.key)).toEqual(['y', 'n', 'a', 'q']);
        expect(res.options[2]).toEqual({ key: 'a', label: 'All (a)', btnClass: 'btn-default' });
    });

    it('choices が空でも質問文に [y/n/q] 等が含まれていれば CHOICE_BUTTONS にパースできること', () => {
        const builder = new PromptPayloadBuilder();
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "Really attack peaceful monster? [y/n/q]",
            choices: ""
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('CHOICE_BUTTONS');
        expect(res.options).toHaveLength(3);
        expect(res.options.map(o => o.key)).toEqual(['y', 'n', 'q']);
    });

    it('[efgh or ?*] のようなアイテムレター群と特殊選択肢を含むプロンプトをすべてのキーに個別展開してボタン化できること', () => {
        const mockGkl = {
            inventoryStateManager: {
                items: [
                    { letter: 'e', name: 'food ration' },
                    { letter: 'f', name: 'apple' }
                ]
            }
        };
        const builder = new PromptPayloadBuilder({ gkl: mockGkl });
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "何を食べたいですか？ [efgh or ?*]",
            choices: ""
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('CHOICE_BUTTONS');
        expect(res.options).toHaveLength(6);
        expect(res.options.map(o => o.key)).toEqual(['e', 'f', 'g', 'h', '?', '*']);
        expect(res.options[0]).toEqual({ key: 'e', label: 'food ration (e)', btnClass: 'btn-default' });
        expect(res.options[1]).toEqual({ key: 'f', label: 'apple (f)', btnClass: 'btn-default' });
        expect(res.options[2]).toEqual({ key: 'g', label: 'g', btnClass: 'btn-default' });
        expect(res.options[4]).toEqual({ key: '?', label: 'List (?)', btnClass: 'btn-default' });
        expect(res.options[5]).toEqual({ key: '*', label: 'All (*)', btnClass: 'btn-default' });
    });

    it('アイテム選択プロンプトで l や n や a や q などの文字が含まれていても Left/No/All/Quit に誤変換されずインベントリまたは文字単体になること', () => {
        const mockGkl = {
            inventoryStateManager: {
                items: [
                    { letter: 'c', name: 'wand of light (0:15)' },
                    { letter: 'm', name: 'spellbook of slow monster' },
                    { letter: 'n', name: 'scroll of teleportation' },
                    { letter: 'p', name: 'wand of striking' }
                ]
            }
        };
        const builder = new PromptPayloadBuilder({ gkl: mockGkl });
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "何を使用または適用しますか?[clmnp or ?*]",
            choices: ""
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('CHOICE_BUTTONS');
        expect(res.options).toHaveLength(7);
        expect(res.options.map(o => o.key)).toEqual(['c', 'l', 'm', 'n', 'p', '?', '*']);
        
        // c: wand of light
        expect(res.options[0]).toEqual({ key: 'c', label: 'wand of light (0:15) (c)', btnClass: 'btn-default' });
        // l: インベントリにないがアイテムプロンプトなので Left (l) ではなく 'l'
        expect(res.options[1]).toEqual({ key: 'l', label: 'l', btnClass: 'btn-default' });
        // m: spellbook
        expect(res.options[2]).toEqual({ key: 'm', label: 'spellbook of slow monster (m)', btnClass: 'btn-default' });
        // n: インベントリにあるので No (n) ではなく scroll of teleportation (n)
        expect(res.options[3]).toEqual({ key: 'n', label: 'scroll of teleportation (n)', btnClass: 'btn-default' });
        // p: wand of striking
        expect(res.options[4]).toEqual({ key: 'p', label: 'wand of striking (p)', btnClass: 'btn-default' });
        // ? and *
        expect(res.options[5]).toEqual({ key: '?', label: 'List (?)', btnClass: 'btn-default' });
        expect(res.options[6]).toEqual({ key: '*', label: 'All (*)', btnClass: 'btn-default' });
    });

    it('左右選択プロンプト (Which ring? [lr]) では Left (l) と Right (r) に正しくパースされること', () => {
        const builder = new PromptPayloadBuilder();
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "Which ring? [lr]",
            choices: "lr"
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('CHOICE_BUTTONS');
        expect(res.options).toHaveLength(2);
        expect(res.options[0]).toEqual({ key: 'l', label: 'Left (l)', btnClass: 'btn-default' });
        expect(res.options[1]).toEqual({ key: 'r', label: 'Right (r)', btnClass: 'btn-default' });
    });

    it('インベントリに n や y のアイテムを持っていても、YN質問 (本当に保存しますか?) では No(n) / Yes(y) としてパースされること', () => {
        const mockGkl = {
            inventoryStateManager: {
                items: [
                    { letter: 'n', name: 'magic marker (0:20)' },
                    { letter: 'y', name: 'yendorian amulet' }
                ]
            }
        };
        const builder = new PromptPayloadBuilder({ gkl: mockGkl });
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "本当に保存しますか?",
            choices: "yn"
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('CHOICE_BUTTONS');
        expect(res.options).toHaveLength(2);
        expect(res.options[0]).toEqual({ key: 'y', label: 'Yes (y)', btnClass: 'btn-primary' });
        expect(res.options[1]).toEqual({ key: 'n', label: 'No (n)', btnClass: 'btn-secondary' });
    });

    it('choices が空でアイテム指定等の質問の場合に LINE_TEXT ではなく SINGLE_KEY にパースされること', () => {
        const builder = new PromptPayloadBuilder();
        const payload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "What do you want to eat?",
            choices: ""
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('SINGLE_KEY');
        expect(res.options).toHaveLength(0);
    });

    it('MENU プロンプトを MENU ペイロードにパースできること', () => {
        const builder = new PromptPayloadBuilder();
        const payload = {
            category: PROMPT_CATEGORY.MENU,
            prompt: "Select an item:",
            items: [
                { ch: 'a', str: 'a blessed +1 dagger', identifier: 101 }
            ]
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('MENU');
        expect(res.promptText).toBe('Select an item:');
        expect(res.options).toHaveLength(1);
        expect(res.options[0].charStr).toBe('a');
        expect(res.options[0].key).toBe('a');
    });

    it('DIRECTION プロンプトを DIRECTION ペイロードにパースできること', () => {
        const builder = new PromptPayloadBuilder();
        const payload = {
            category: PROMPT_CATEGORY.DIRECTION,
            promptCategory: PROMPT_CATEGORY.DIRECTION,
            prompt: "In what direction?"
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('DIRECTION');
        expect(res.options.length).toBe(0);

        // yn_function 経由の方向問い合わせ (choices が空で prompt が方向)
        const payloadYnDir = {
            category: PROMPT_CATEGORY.YN,
            promptCategory: PROMPT_CATEGORY.YN,
            choices: "",
            prompt: "In what direction?"
        };
        const resYnDir = builder.build(payloadYnDir);
        expect(resYnDir.inputType).toBe('DIRECTION');
        expect(resYnDir.options.length).toBe(0);
    });


    it('EXTCMD および LINE_TEXT プロンプトを LINE_TEXT ペイロードにパースできること', () => {
        const builder = new PromptPayloadBuilder();
        const payloadExt = {
            category: PROMPT_CATEGORY.EXTCMD,
            prompt: "#Which extended command?"
        };

        const resExt = builder.build(payloadExt);
        expect(resExt.inputType).toBe('LINE_TEXT');
        expect(resExt.title).toBe('Which extended command?');
        expect(resExt.promptText).toBe('#Which extended command?');

        const payloadGetlin = {
            context: 'getlin',
            prompt: "Call a monster:"
        };
        const resGetlin = builder.build(payloadGetlin);
        expect(resGetlin.inputType).toBe('LINE_TEXT');
        expect(resGetlin.promptText).toBe('Call a monster:');
    });

    it('タイトルがすでに日本語または指定済みの場合に二重翻訳を回避すること', () => {
        const mockTranslator = {
            translate: vi.fn(t => `TR:${t}`)
        };
        const builder = new PromptPayloadBuilder({ translator: mockTranslator });

        const payload = {
            category: PROMPT_CATEGORY.MENU,
            title: 'インベントリ (所持品)',
            rawTitle: 'Inventory',
            prompt: '所持品一覧',
            rawPrompt: 'Inventory items',
            items: []
        };

        const res = builder.build(payload);
        expect(res.title).toBe('インベントリ (所持品)');
        // 既に title が指定されているため、translator.translate は呼ばれない
        expect(mockTranslator.translate).not.toHaveBeenCalled();
    });

    it('タイトル未指定時にフォールバック定数マップから直接言語に応じたタイトルが設定され translator.translate を呼ばないこと', () => {
        const mockTranslator = {
            enabled: true,
            translate: vi.fn(t => `TR:${t}`)
        };
        const builder = new PromptPayloadBuilder({ translator: mockTranslator });

        // 1. 日本語モードでの MENU フォールバック
        const resMenu = builder.build({ category: PROMPT_CATEGORY.MENU, items: [] });
        expect(resMenu.title).toBe('メニュー');
        expect(resMenu.rawTitle).toBe('Menu');
        expect(mockTranslator.translate).not.toHaveBeenCalled();

        // 2. 英語モードでの YN フォールバック
        mockTranslator.enabled = false;
        const resYn = builder.build({ category: PROMPT_CATEGORY.YN, choices: 'y/n' });
        expect(resYn.title).toBe('Choice');
        expect(resYn.rawTitle).toBe('Choice');
        expect(mockTranslator.translate).not.toHaveBeenCalled();
    });

    it('For what do you wish? の願いプロンプトで subCategory: WISH と assistant が付与されること', () => {
        const mockWishService = {
            getPresets: () => [{ id: 'sdsm', labelJa: '銀色ドラゴンの鱗鎧' }],
            getCatalogByCategory: () => ({ ARMOR: [], WEAPON: [] })
        };
        const mockGkl = {
            getWishService: () => mockWishService
        };
        const builder = new PromptPayloadBuilder({ gkl: mockGkl });

        const payload = {
            category: PROMPT_CATEGORY.TEXT,
            prompt: "For what do you wish?",
            rawPrompt: "For what do you wish?"
        };

        const res = builder.build(payload);
        expect(res.inputType).toBe('LINE_TEXT');
        expect(res.subCategory).toBe('WISH');
        expect(res.assistant).toBeDefined();
        expect(res.assistant.type).toBe('WISH');
        expect(res.assistant.presets).toHaveLength(1);
        expect(res.assistant.categories).toEqual(['ARMOR', 'WEAPON']);
        expect(res.assistant.wishService).toBe(mockWishService);
    });

    it('wand of wishing を含むアイテム選択やメニュープロンプトで誤って WISH と判定されないこと', () => {
        const mockWishService = {
            getPresets: () => [],
            getCatalogByCategory: () => ({})
        };
        const mockGkl = {
            getWishService: () => mockWishService,
            inventoryStateManager: {
                items: [{ letter: 'x', text: 'a wand of wishing (0:3)' }]
            }
        };
        const builder = new PromptPayloadBuilder({ gkl: mockGkl });

        // 1. zap what? プロンプト
        const zapPayload = {
            category: PROMPT_CATEGORY.YN,
            prompt: "What do you want to zap? [x or ?*]",
            rawPrompt: "What do you want to zap? [x or ?*]",
            choices: "x?*"
        };
        const zapRes = builder.build(zapPayload);
        expect(zapRes.subCategory).toBeNull();
        expect(zapRes.assistant).toBeNull();

        // 2. メニュープロンプト（wand of wishing がメニュー項目に含まれる場合）
        const menuPayload = {
            category: PROMPT_CATEGORY.MENU,
            prompt: "Select item to use:",
            rawPrompt: "Select item to use:",
            items: [
                { str: "x - a wand of wishing (0:3)", ch: 120 }
            ]
        };
        const menuRes = builder.build(menuPayload);
        expect(menuRes.inputType).toBe('MENU');
        expect(menuRes.subCategory).toBeNull();
        expect(menuRes.assistant).toBeNull();
    });

    it('虐殺（Genocide）プロンプト（クラス虐殺 / 単体虐殺、日英）を正しく検出し GENOCIDE アシスタントを生成できること', () => {
        const mockGenocideService = {
            getPresets: (mode) => [{ id: 'p1', target: 'L', mode }],
            getMonsterClasses: () => [{ symbol: 'L', nameEn: 'lich' }]
        };
        const mockGkl = {
            getGenocideService: () => mockGenocideService,
            getCharacterInfo: () => ({ race: 'dwarf', role: 'valkyrie' })
        };
        const builder = new PromptPayloadBuilder({ gkl: mockGkl });

        // 1. 英語 クラス虐殺
        const resEnClass = builder.build({
            category: PROMPT_CATEGORY.TEXT,
            prompt: "What class of monsters do you wish to genocide?",
            rawPrompt: "What class of monsters do you wish to genocide?"
        });
        expect(resEnClass.inputType).toBe('LINE_TEXT');
        expect(resEnClass.subCategory).toBe('GENOCIDE');
        expect(resEnClass.assistant).toBeDefined();
        expect(resEnClass.assistant.type).toBe('GENOCIDE');
        expect(resEnClass.assistant.mode).toBe('CLASS');
        expect(resEnClass.assistant.playerRace).toBe('dwarf');
        expect(resEnClass.assistant.playerRole).toBe('valkyrie');

        // 2. 日本語 クラス虐殺
        const resJaClass = builder.build({
            context: 'getlin',
            prompt: "どのクラスのモンスターを虐殺しますか？",
            rawPrompt: "どのクラスのモンスターを虐殺しますか？"
        });
        expect(resJaClass.subCategory).toBe('GENOCIDE');
        expect(resJaClass.assistant.mode).toBe('CLASS');

        // 3. 英語 単体虐殺 (旧構文: "What monster do you want to genocide?")
        const resEnSingle = builder.build({
            category: PROMPT_CATEGORY.TEXT,
            prompt: "What monster do you want to genocide?",
            rawPrompt: "What monster do you want to genocide?"
        });
        expect(resEnSingle.subCategory).toBe('GENOCIDE');
        expect(resEnSingle.assistant.mode).toBe('SINGLE');

        // 4. 日本語 単体虐殺
        const resJaSingle = builder.build({
            context: 'getlin',
            prompt: "どの種類のモンスターを虐殺しますか？",
            rawPrompt: "どの種類のモンスターを虐殺しますか？"
        });
        expect(resJaSingle.subCategory).toBe('GENOCIDE');
        expect(resJaSingle.assistant.mode).toBe('SINGLE');

        // 5. NetHack 3.7 / 5.0 最新英語 クラス虐殺 ("What class of monsters do you want to genocide?")
        const resEnClassLatest = builder.build({
            context: 'getlin',
            prompt: "どのクラスのモンスターを虐殺しますか？",
            rawPrompt: "What class of monsters do you want to genocide?"
        });
        expect(resEnClassLatest.subCategory).toBe('GENOCIDE');
        expect(resEnClassLatest.assistant.mode).toBe('CLASS');

        // 6. NetHack 3.7 / 5.0 最新英語 単体虐殺 ("What type of monster do you want to genocide?")
        const resEnSingleLatest = builder.build({
            context: 'getlin',
            prompt: "どの種類のモンスターを虐殺しますか？",
            rawPrompt: "What type of monster do you want to genocide?"
        });
        expect(resEnSingleLatest.subCategory).toBe('GENOCIDE');
        expect(resEnSingleLatest.assistant.mode).toBe('SINGLE');

        // 7. ヒント付きプロンプト（再試行時）
        const resClassWithHint = builder.build({
            context: 'getlin',
            prompt: "どのクラスのモンスターを虐殺しますか？ [記号かクラスを表す名前、または'?'を入力してください]",
            rawPrompt: "どのクラスのモンスターを虐殺しますか？ [記号かクラスを表す名前、または'?'を入力してください]"
        });
        expect(resClassWithHint.subCategory).toBe('GENOCIDE');
        expect(resClassWithHint.assistant.mode).toBe('CLASS');

        const resSingleWithHint = builder.build({
            context: 'getlin',
            prompt: "What type of monster do you want to genocide? [enter the name of a type of monster, or '?']",
            rawPrompt: "What type of monster do you want to genocide? [enter the name of a type of monster, or '?']"
        });
        expect(resSingleWithHint.subCategory).toBe('GENOCIDE');
        expect(resSingleWithHint.assistant.mode).toBe('SINGLE');
    });

    it('変化制御（Polymorph Control）プロンプトを自動検知して POLYMORPH アシスタントペイロードを生成できること', () => {
        const mockGkl = {
            getPolymorphService: vi.fn(() => ({
                getPresets: vi.fn(() => [{ categoryKey: 'combat', label: 'Combat' }])
            }))
        };
        const builder = new PromptPayloadBuilder({ gkl: mockGkl });

        // 1. 英語プロンプト: "Become what kind of monster? [type the name]"
        const resEn = builder.build({
            context: 'getlin',
            prompt: "Become what kind of monster? [type the name]",
            rawPrompt: "Become what kind of monster? [type the name]"
        });
        expect(resEn.subCategory).toBe('POLYMORPH');
        expect(resEn.assistant).toBeDefined();
        expect(resEn.assistant.type).toBe('POLYMORPH');
        expect(resEn.assistant.presets.length).toBe(1);

        // 2. 日本語プロンプト: "どの種類のモンスターになりますか? [名前を入力してください]"
        const resJa = builder.build({
            context: 'getlin',
            prompt: "どの種類のモンスターになりますか? [名前を入力してください]",
            rawPrompt: "どの種類のモンスターになりますか? [名前を入力してください]"
        });
        expect(resJa.subCategory).toBe('POLYMORPH');
        expect(resJa.assistant).toBeDefined();
        expect(resJa.assistant.type).toBe('POLYMORPH');
    });
});
