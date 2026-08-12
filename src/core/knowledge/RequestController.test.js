/**
 * RequestController.test.js
 * RequestController & NetHackWasmDriver シーケンスキュー連動の動作検証テスト
 */

const RequestController = require('./RequestController.js');

describe('RequestController & Sequence Queue Tests', () => {
    let mockDriver;
    let controller;

    beforeEach(() => {
        mockDriver = {
            queueSequence: jest.fn(),
            cancelSequence: jest.fn(),
            activeResolver: null,
            sendKey: jest.fn()
        };
        controller = new RequestController(mockDriver);
    });

    test('初期状態は IDLE であること', () => {
        expect(controller.getState()).toBe('IDLE');
    });

    test('executeSequence 呼び出しで Driver の queueSequence が呼ばれ EXECUTING 状態へ移行すること', () => {
        const tokens = ['#', 'open', '\r', 'DIR_E'];
        const result = controller.executeSequence(tokens, { suppressPrompts: true });

        expect(result).toBe(true);
        expect(controller.getState()).toBe('EXECUTING');
        expect(mockDriver.queueSequence).toHaveBeenCalledWith(tokens, { suppressPrompts: true });
    });

    test('cancel 呼び出しで Driver の cancelSequence が呼ばれ IDLE 状態に復帰すること', () => {
        controller.executeSequence(['o', 'DIR_E']);
        expect(controller.getState()).toBe('EXECUTING');

        controller.cancel();
        expect(controller.getState()).toBe('IDLE');
        expect(mockDriver.cancelSequence).toHaveBeenCalled();
    });

    test('abortWithESC 呼び出しで ABORTING_ESC 状態を経て IDLE に復帰し ESC が送出されること', () => {
        mockDriver.activeResolver = { respond: jest.fn() };
        controller.executeSequence(['o', 'DIR_E']);

        controller.abortWithESC();
        expect(mockDriver.activeResolver.respond).toHaveBeenCalledWith('\033');
        expect(controller.getState()).toBe('IDLE');
    });

    test('suspend 呼び出しで SUSPENDED 状態へ移行し、一定時間後に自動で IDLE に復帰すること', (done) => {
        const fastController = new RequestController(mockDriver, { autoResumeDelayMs: 50 });
        fastController.suspend();
        expect(fastController.getState()).toBe('SUSPENDED');

        setTimeout(() => {
            expect(fastController.getState()).toBe('IDLE');
            done();
        }, 100);
    });
});
