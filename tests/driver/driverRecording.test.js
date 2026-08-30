/**
 * driverRecording.test.js
 * NetHackWasmDriver のイベントキャプチャ・記録機能 (startRecording/stopRecording) テスト
 */
import { describe, it, expect } from 'vitest';
import { NetHackWasmDriver } from '../../src/driver/NetHackWasmDriver.js';

describe('NetHackWasmDriver - イベント記録エンジン (Downlink Recording)', () => {

    it('通常時 (isRecording = false) はイベントを蓄積せずオーバーヘッドがゼロであること', () => {
        const driver = new NetHackWasmDriver();
        expect(driver.isRecording).toBe(false);

        driver.emit('curs', { x: 10, y: 10 });
        driver.emit('putmsg', { text: 'Hello NetHack' });

        const recorded = driver.stopRecording();
        expect(recorded).toEqual([]);
    });

    it('startRecording 実行中は全イベントを時系列に蓄積し、stopRecording で回収できること', () => {
        const driver = new NetHackWasmDriver();

        driver.startRecording();
        expect(driver.isRecording).toBe(true);

        driver.emit('status_update', { hp: 15, maxHp: 15 });
        driver.emit('curs', { x: 5, y: 5 });
        driver.emit('messageText', { text: 'You see a kitten.' });

        const events = driver.stopRecording();
        expect(driver.isRecording).toBe(false);

        expect(events).toHaveLength(3);
        expect(events[0].type).toBe('status_update');
        expect(events[0].data).toEqual({ hp: 15, maxHp: 15 });
        expect(events[1].type).toBe('curs');
        expect(events[2].type).toBe('messageText');
        expect(events[2].data).toEqual({ text: 'You see a kitten.' });

        // stop 後の emit は蓄積されないこと
        driver.emit('curs', { x: 6, y: 5 });
        expect(driver.stopRecording()).toEqual([]);
    });

    it('MAX_RECORDED_EVENTS (10,000件) に達した際に自動停止し、それ以上蓄積されないこと', () => {
        const driver = new NetHackWasmDriver();
        driver.startRecording();

        // 疑似的に MAX_RECORDED_EVENTS - 1 件までバッファを埋める
        const limit = NetHackWasmDriver.MAX_RECORDED_EVENTS;
        driver.recordedEvents = new Array(limit - 1).fill({ type: 'curs', data: {} });

        // 1件追加 -> ちょうど 10,000 件に到達
        driver.emit('curs', { x: 1, y: 1 });
        expect(driver.recordedEvents.length).toBe(limit);
        expect(driver.isRecording).toBe(true);

        // さらに 1 件追加 -> 上限超過を検知して isRecording が false になり、追加されない
        driver.emit('curs', { x: 2, y: 2 });
        expect(driver.isRecording).toBe(false);
        expect(driver.recordedEvents.length).toBe(limit);
    });

    it('restart() 実行時に記録状態とバッファが自動リセットされること', async () => {
        const driver = new NetHackWasmDriver();
        driver.startRecording();
        driver.emit('curs', { x: 5, y: 5 });

        expect(driver.isRecording).toBe(true);
        expect(driver.recordedEvents.length).toBe(1);

        // 再起動呼び出し
        await driver.restart();

        // 記録フラグ・バッファが確実にリセットされていること
        expect(driver.isRecording).toBe(false);
        expect(driver.recordedEvents.length).toBe(0);
    });

    it('exit_nhwindows (ゲーム終了) 時に記録が自動停止されること', () => {
        const driver = new NetHackWasmDriver();
        driver.startRecording();
        driver.emit('curs', { x: 3, y: 3 });

        expect(driver.isRecording).toBe(true);

        // Cコア終了フック
        driver.eventHook('shim_exit_nhwindows', ['Game Over']);

        expect(driver.isRecording).toBe(false);
        expect(driver.recordedEvents.length).toBe(0);
    });
});
