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
        expect(res.options.length).toBeGreaterThanOrEqual(8);
        expect(res.options[0]).toEqual({ key: 'k', label: 'North (k)', direction: 'N' });
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
});
