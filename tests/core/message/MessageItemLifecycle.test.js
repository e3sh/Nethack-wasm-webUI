import { describe, it, expect, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { WebUICore } from '../../../src/core/WebUICore.js';

class MockDriver extends EventEmitter {
    constructor() {
        super();
        this.variant = 'vanilla';
        this.memory = null;
    }
    getPromptCategory(ctx) {
        return 'POSKEY';
    }
}

describe('WebUICore - MessageItem & Bold / Bubble Lifecycle', () => {
    let core;
    let driver;

    beforeEach(() => {
        driver = new MockDriver();
        core = new WebUICore({
            driver,
            enableKnowledge: false,
            enableTranslate: false
        });
    });

    it('1. raw_print emits message, messageItem, and bubbleMessage with isBold: false', () => {
        const messages = [];
        const items = [];
        const bubbles = [];

        core.on('message', (msg) => messages.push(msg));
        core.on('messageItem', (item) => items.push(item));
        core.on('bubbleMessage', (bubble) => bubbles.push(bubble));

        driver.emit('raw_print', { text: 'You see a stair here.' });

        expect(messages).toEqual(['You see a stair here.']);
        expect(items.length).toBe(1);
        expect(items[0]).toMatchObject({
            rawText: 'You see a stair here.',
            text: 'You see a stair here.',
            isBold: false,
            isLatest: true
        });
        expect(bubbles.length).toBe(1);
        expect(bubbles[0]).toMatchObject({
            text: 'You see a stair here.',
            isBold: false
        });

        expect(core.getLatestMessage()).toMatchObject({
            text: 'You see a stair here.',
            isBold: false
        });
    });

    it('2. raw_print_bold emits with isBold: true', () => {
        const items = [];
        const bubbles = [];

        core.on('messageItem', (item) => items.push(item));
        core.on('bubbleMessage', (bubble) => bubbles.push(bubble));

        driver.emit('raw_print_bold', { text: 'Warning: Low HP!' });

        expect(items.length).toBe(1);
        expect(items[0].isBold).toBe(true);
        expect(bubbles[0].isBold).toBe(true);
        expect(core.getLatestMessage().isBold).toBe(true);
    });

    it('3. Sequential identical message promotion from normal to bold', () => {
        const items = [];
        const updates = [];
        const bubbles = [];

        core.on('messageItem', (item) => items.push(item));
        core.on('messageUpdate', (item) => updates.push(item));
        core.on('bubbleMessage', (bubble) => bubbles.push(bubble));

        // 1回目: 通常メッセージ
        driver.emit('raw_print', { text: 'You feel a chill run down your spine.' });
        expect(items.length).toBe(1);
        expect(items[0].isBold).toBe(false);

        // 2回目: 直後に同一文面の太字メッセージが到着
        driver.emit('raw_print_bold', { text: 'You feel a chill run down your spine.' });

        // 新規アイテムとして重複追加されず、1行のまま太字昇格する
        expect(core.getMessageItems().length).toBe(1);
        expect(updates.length).toBe(1);
        expect(updates[0].isBold).toBe(true);

        // 吹き出しイベントも昇格版（isBold: true）で再度発火する
        expect(bubbles.length).toBe(2);
        expect(bubbles[1].isBold).toBe(true);

        // 3回目: 太字のまま同一文面が連続した場合は完全重複として抑止される
        driver.emit('raw_print_bold', { text: 'You feel a chill run down your spine.' });
        expect(core.getMessageItems().length).toBe(1);
        expect(bubbles.length).toBe(2);
    });

    it('4. putstr with attr & 1 (ATR_BOLD) reflects isBold: true', () => {
        const items = [];
        core.on('messageItem', (item) => items.push(item));

        driver.emit('putstr', { windowId: 1, attr: 1, text: 'Bold system announcement.' });

        expect(items.length).toBe(1);
        expect(items[0].isBold).toBe(true);
        expect(items[0].attr).toBe(1);
    });

    it('5. getLatestMessage and getMessageItems accessor integrity', () => {
        driver.emit('raw_print', { text: 'Line 1' });
        driver.emit('raw_print', { text: 'Line 2' });
        driver.emit('raw_print', { text: 'Line 3' });

        expect(core.getMessageItems().length).toBe(3);
        expect(core.getMessageItems(2).map(m => m.text)).toEqual(['Line 2', 'Line 3']);
        expect(core.getLatestMessage().text).toBe('Line 3');
        expect(core.getLatestMessage().isLatest).toBe(true);
        expect(core.getMessageItems()[0].isLatest).toBe(false);
    });

    it('6. Rapid key press / successive actions: emits separate messageItem and bubbleMessage on each action', () => {
        const bubbles = [];
        core.on('bubbleMessage', (bubble) => bubbles.push(bubble));

        // 1回目の攻撃（ターン1）
        driver.emit('raw_print', { text: 'You hit the goblin.' });
        expect(core.getMessageItems().length).toBe(1);
        expect(bubbles.length).toBe(1);

        // ターン終了（次の入力待ちへ遷移）
        driver.emit('inputRequired', { context: 'poskey' });

        // 2回目の攻撃連打（ターン2: 同一テキスト）
        driver.emit('raw_print', { text: 'You hit the goblin.' });
        // 新しいターンなので、抑止されずに2件目のメッセージと吹き出しが発火する！
        expect(core.getMessageItems().length).toBe(2);
        expect(bubbles.length).toBe(2);
        expect(bubbles[1].text).toBe('You hit the goblin.');

        // ターン終了（次の入力待ちへ遷移）
        driver.emit('inputRequired', { context: 'poskey' });

        // 3回目の攻撃連打（ターン3: 同一テキスト）
        driver.emit('raw_print', { text: 'You hit the goblin.' });
        expect(core.getMessageItems().length).toBe(3);
        expect(bubbles.length).toBe(3);
    });

    it('7. doprev_message event relay from driver to core', () => {
        let prevMsgFired = false;
        core.on('doprev_message', () => { prevMsgFired = true; });

        driver.emit('doprev_message', {});
        expect(prevMsgFired).toBe(true);
    });
});
