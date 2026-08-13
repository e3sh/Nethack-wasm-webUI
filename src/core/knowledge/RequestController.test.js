import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert';
import RequestController from './RequestController.js';

describe('RequestController & Sequence Queue Tests', () => {
    let mockDriver;
    let controller;

    beforeEach(() => {
        mockDriver = {
            queueSequenceCallCount: 0,
            queueSequenceArgs: null,
            cancelSequenceCallCount: 0,
            activeResolver: null,
            sendKeyCallCount: 0,
            queueSequence(tokens, opts) {
                this.queueSequenceCallCount++;
                this.queueSequenceArgs = { tokens, opts };
            },
            cancelSequence() {
                this.cancelSequenceCallCount++;
            },
            sendKey() {
                this.sendKeyCallCount++;
            }
        };
        controller = new RequestController(mockDriver);
    });

    test('初期状態は IDLE であること', () => {
        assert.strictEqual(controller.getState(), 'IDLE');
    });

    test('executeSequence 呼び出しで Driver の queueSequence が呼ばれ EXECUTING 状態へ移行すること', () => {
        const tokens = ['#', 'open', '\r', 'DIR_E'];
        const result = controller.executeSequence(tokens, { suppressPrompts: true });

        assert.strictEqual(result, true);
        assert.strictEqual(controller.getState(), 'EXECUTING');
        assert.strictEqual(mockDriver.queueSequenceCallCount, 1);
        assert.deepStrictEqual(mockDriver.queueSequenceArgs.tokens, tokens);
    });

    test('cancel 呼び出しで Driver の cancelSequence が呼ばれ IDLE 状態に復帰すること', () => {
        controller.executeSequence(['o', 'DIR_E']);
        assert.strictEqual(controller.getState(), 'EXECUTING');

        controller.cancel();
        assert.strictEqual(controller.getState(), 'IDLE');
        assert.strictEqual(mockDriver.cancelSequenceCallCount, 1);
    });

    test('abortWithESC 呼び出しで ABORTING_ESC 状態を経て IDLE に復帰し ESC が送出されること', () => {
        let respondedVal = null;
        mockDriver.activeResolver = {
            respond: (val) => { respondedVal = val; }
        };
        controller.executeSequence(['o', 'DIR_E']);

        controller.abortWithESC();
        assert.strictEqual(respondedVal, '\u001b');
        assert.strictEqual(controller.getState(), 'IDLE');
    });

    test('suspend 呼び出しで SUSPENDED 状態へ移行し、一定時間後に自動で IDLE に復帰すること', async () => {
        const fastController = new RequestController(mockDriver, { autoResumeDelayMs: 50 });
        fastController.suspend();
        assert.strictEqual(fastController.getState(), 'SUSPENDED');

        await new Promise(resolve => setTimeout(resolve, 100));
        assert.strictEqual(fastController.getState(), 'IDLE');
    });
});
