import { describe, it, expect, vi } from 'vitest';
import '../../driver/InputResolver.js';
import { RequestController } from './RequestController.js';
import { NetHackWasmDriver } from '../../driver/NetHackWasmDriver.js';

describe('RequestController & NetHackWasmDriver TaskQueue Synchronization', () => {
    it('executeSequence 実行後、ドライバーのシーケンス完了 (sequenceFinished) で自動的に IDLE 状態へ安全復帰すること', async () => {
        const driver = new NetHackWasmDriver();
        const controller = new RequestController(driver);

        let stateChanges = [];
        controller.on('stateChanged', ({ newState }) => {
            stateChanges.push(newState);
        });

        // 1. executeSequence 投入
        const success = controller.executeSequence(['i']);
        expect(success).toBe(true);
        expect(controller.getState()).toBe(RequestController.State.EXECUTING);

        // 2. ドライバー側で 'i' を消費
        await driver.eventHook('shim_nhgetch', ['Inventory prompt']);

        // 次のプロンプト入力待ちが発生
        const poskeyPromise = driver.eventHook('shim_nh_poskey', 0, 0, 0);

        expect(driver.isExecutingSequence).toBe(false);
        expect(controller.getState()).toBe(RequestController.State.IDLE);
        expect(stateChanges).toEqual(['EXECUTING', 'IDLE']);

        // 後始末: ダミーの poskey 応答で Promise を解決
        if (driver.activeResolver) {
            driver.activeResolver.respond(' ');
        }
        await poskeyPromise;
    });

    it('cancelSequence 呼び出し時にも RequestController が安全に IDLE へ復帰しキューがクリアされること', () => {
        const driver = new NetHackWasmDriver();
        const controller = new RequestController(driver);

        controller.executeSequence(['kick']);
        expect(controller.getState()).toBe(RequestController.State.EXECUTING);

        controller.cancel();
        expect(driver.isExecutingSequence).toBe(false);
        expect(controller.getState()).toBe(RequestController.State.IDLE);
    });
});
