/**
 * headlessDriverSimulation.test.js
 * 
 * 【第3防壁: Headless Driver Simulation (実機等価・結合検証)】
 * 
 * 本物の NetHackWasmDriver インスタンスを用い、C コア Shim イベント発行と
 * queueSequence() によるトークン消費・Promise 解決・バッファ回収の完走性を検証するテストスイート。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import '../../src/driver/InputResolver.js';
import { NetHackWasmDriver } from '../../src/driver/NetHackWasmDriver.js';

describe('Headless Driver Simulation Suite (第3防壁: 実機等価エミュレーション)', () => {
    let driver;

    beforeEach(() => {
        driver = new NetHackWasmDriver();
        driver.initSubModules();
    });

    /**
     * シーケンス終了後の次ターン（手動入力待ち）を安全にトリガーして完了させるヘルパー
     */
    async function triggerNextTurnAndResolve(driverInstance) {
        const nextPromise = driverInstance.eventHook('shim_nh_poskey');
        driverInstance.sendInput(32); // Space で応答
        await nextPromise;
    }

    it('1. 単一キー行動 (,) の即時消費と Promise 解決', async () => {
        let completed = false;
        const promise = driver.queueSequence([',']).then(() => {
            completed = true;
        });

        // 1. Cコアから poskey 入力待ち Shim が呼ばれ、',' (44) が自動消費される
        const res = await driver.eventHook('shim_nh_poskey');
        expect(res).toBe(','.charCodeAt(0));

        // 2. 次のターン到達でシーケンス完了を確定
        await triggerNextTurnAndResolve(driver);

        await promise;
        expect(completed).toBe(true);
        expect(driver.isExecutingSequence).toBe(false);
    });

    it('2. 方向指定行動 (o -> DIR_E) の2ステップ消費とキーモード変換 (numpad: 6)', async () => {
        driver.keyMode = 'numpad';
        let completed = false;
        const promise = driver.queueSequence(['o', 'DIR_E']).then(() => {
            completed = true;
        });

        // 1. poskey: 'o'
        const poskeyRes = await driver.eventHook('shim_nh_poskey');
        expect(poskeyRes).toBe('o'.charCodeAt(0));

        // 2. getch: 'DIR_E' -> numpad '6'
        const dirRes = await driver.eventHook('shim_nhgetch');
        expect(dirRes).toBe('6');

        await triggerNextTurnAndResolve(driver);

        await promise;
        expect(completed).toBe(true);
    });

    it('3. 方向指定行動 (c -> DIR_W) の vi キーモード変換 (vi: h)', async () => {
        driver.keyMode = 'vi';
        let completed = false;
        const promise = driver.queueSequence(['c', 'DIR_W']).then(() => {
            completed = true;
        });

        const poskeyRes = await driver.eventHook('shim_nh_poskey');
        expect(poskeyRes).toBe('c'.charCodeAt(0));

        const dirRes = await driver.eventHook('shim_nhgetch');
        expect(dirRes).toBe('h');

        await triggerNextTurnAndResolve(driver);

        await promise;
        expect(completed).toBe(true);
    });

    it('4. 拡張コマンド・確認プロンプト複合行動 (#pray y) の3ステップ完全完走', async () => {
        let completed = false;
        const promise = driver.queueSequence(['#', 'pray', 'y']).then(() => {
            completed = true;
        });

        // 1. poskey -> '#'
        const poskeyRes = await driver.eventHook('shim_nh_poskey');
        expect(poskeyRes).toBe('#'.charCodeAt(0));

        // 2. get_ext_cmd -> 'pray' のインデックス
        const extCmdRes = await driver.eventHook('shim_get_ext_cmd');
        const prayIdx = NetHackWasmDriver.DEFAULT_EXTCMDS.indexOf('pray');
        expect(extCmdRes).toBe(prayIdx);

        // 3. yn_function -> 'y' (121)
        const ynRes = await driver.eventHook('shim_yn_function', 'Are you sure you want to pray?', 'yn', 'y');
        expect(ynRes).toBe('y'.charCodeAt(0));

        await triggerNextTurnAndResolve(driver);

        await promise;
        expect(completed).toBe(true);
    });

    it('5. メニュー選択行動 (d -> a) の完走', async () => {
        driver.menuBuffer[1] = {
            items: [
                { isHeader: false, identifier: 1, accelerator: 'a', str: 'iron ring' }
            ],
            prompt: 'What do you want to drop?'
        };

        let completed = false;
        const promise = driver.queueSequence(['d', 'a']).then(() => {
            completed = true;
        });

        const poskeyRes = await driver.eventHook('shim_nh_poskey');
        expect(poskeyRes).toBe('d'.charCodeAt(0));

        const menuHookRes = await driver.eventHook('shim_select_menu', 1, 1, 0);
        expect(menuHookRes).toBe(0);

        await triggerNextTurnAndResolve(driver);

        await promise;
        expect(completed).toBe(true);
    });

    it('6. 自由文字列入力行動 (E -> - -> Elbereth) の完走', async () => {
        let completed = false;
        const promise = driver.queueSequence(['E', '-', 'Elbereth']).then(() => {
            completed = true;
        });

        // 1. poskey: 'E' (Engrave)
        const poskeyRes = await driver.eventHook('shim_nh_poskey');
        expect(poskeyRes).toBe('E'.charCodeAt(0));

        // 2. getch: '-' (Write with fingers)
        const getchRes = await driver.eventHook('shim_nhgetch');
        expect(getchRes).toBe('-');

        // 3. getlin: 'Elbereth'
        let capturedString = null;
        driver.getModule = () => ({
            stringToUTF8: (str, bufp, max) => {
                capturedString = str;
            }
        });

        const getlinRes = await driver.eventHook('shim_getlin', 'What do you want to write on the floor?', 0x1234);
        expect(getlinRes).toBe(0);
        expect(capturedString).toBe('Elbereth');

        await triggerNextTurnAndResolve(driver);

        await promise;
        expect(completed).toBe(true);
    });

    it('7. FIFO タスクキューによる連続シーケンス投入の順次実行', async () => {
        const order = [];
        const promise1 = driver.queueSequence(['s']).then(() => order.push('seq1'));
        const promise2 = driver.queueSequence(['o']).then(() => order.push('seq2'));

        // seq1: 's' 消費
        const pos1 = await driver.eventHook('shim_nh_poskey');
        expect(pos1).toBe('s'.charCodeAt(0));

        // 次の poskey で seq1 が完了し、seq2 の 'o' が自動消費される
        const pos2 = await driver.eventHook('shim_nh_poskey');
        expect(pos2).toBe('o'.charCodeAt(0));
        await promise1;
        expect(order).toEqual(['seq1']);

        // seq2 の完了
        await triggerNextTurnAndResolve(driver);
        await promise2;
        expect(order).toEqual(['seq1', 'seq2']);
    });
});
