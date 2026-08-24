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
});
