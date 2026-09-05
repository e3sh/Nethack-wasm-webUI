import { test, beforeEach, describe } from 'vitest';
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

import '../../driver/InputResolver.js';
import { NetHackWasmDriver } from '../../driver/NetHackWasmDriver.js';

describe('RequestController & NetHackWasmDriver TaskQueue Synchronization', () => {
    test('executeSequence 実行後、ドライバーのシーケンス完了 (sequenceFinished) で自動的に IDLE 状態へ安全復帰すること', async () => {
        const driver = new NetHackWasmDriver();
        const controller = new RequestController(driver);

        let stateChanges = [];
        controller.on('stateChanged', ({ newState }) => {
            stateChanges.push(newState);
        });

        // 1. executeSequence 投入
        const success = controller.executeSequence(['i']);
        assert.strictEqual(success, true);
        assert.strictEqual(controller.getState(), RequestController.State.EXECUTING);

        // 2. ドライバー側で 'i' を消費
        await driver.eventHook('shim_nhgetch', ['Inventory prompt']);

        // 次のプロンプト入力待ちが発生
        const poskeyPromise = driver.eventHook('shim_nh_poskey', 0, 0, 0);

        assert.strictEqual(driver.isExecutingSequence, false);
        assert.strictEqual(controller.getState(), RequestController.State.IDLE);
        assert.deepStrictEqual(stateChanges, ['EXECUTING', 'IDLE']);

        // 後始末: ダミーの poskey 応答で Promise を解決
        if (driver.activeResolver) {
            driver.activeResolver.respond(' ');
        }
        await poskeyPromise;
    });

    test('cancelSequence 呼び出し時にも RequestController が安全に IDLE へ復帰しキューがクリアされること', () => {
        const driver = new NetHackWasmDriver();
        const controller = new RequestController(driver);

        controller.executeSequence(['kick']);
        assert.strictEqual(controller.getState(), RequestController.State.EXECUTING);

        controller.cancel();
        assert.strictEqual(driver.isExecutingSequence, false);
        assert.strictEqual(controller.getState(), RequestController.State.IDLE);
    });
});

