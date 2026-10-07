import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundArbiter } from '../../../src/core/sound/SoundArbiter.js';
import { SoundModeManager } from '../../../src/core/sound/SoundModeManager.js';

describe('SoundArbiter Headless Tests', () => {
    let mockDrivers;
    let modeManager;
    let arbiter;

    beforeEach(() => {
        vi.useFakeTimers();
        mockDrivers = {
            wave: { play: vi.fn().mockResolvedValue(true) },
            beep: { play: vi.fn() },
            synth: { play: vi.fn() }
        };
        modeManager = new SoundModeManager({ soundMode: 'auto' });
        arbiter = new SoundArbiter({
            modeManager,
            drivers: mockDrivers,
            staggerIntervalMs: 60
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should drop enqueued sound immediately when mode is mute', () => {
        modeManager.setSoundMode('mute');
        const res = arbiter.enqueue({ id: 'se_test', sound: 'test.mp3' });
        expect(res).toBeNull();
        expect(arbiter.audioQueue.length).toBe(0);
    });

    it('should respect cooldownMs and skip repeated sounds within cooldown window', () => {
        const rule = { id: 'se_damage', sound: 'damage.mp3', cooldownMs: 100 };

        const first = arbiter.enqueue(rule);
        expect(first).not.toBeNull();

        // 50ms later (within cooldown)
        vi.advanceTimersByTime(50);
        const second = arbiter.enqueue(rule);
        expect(second).toBeNull();

        // 60ms later (total 110ms, cooldown expired)
        vi.advanceTimersByTime(60);
        const third = arbiter.enqueue(rule);
        expect(third).not.toBeNull();
    });

    it('should sort audio queue by priority descending', async () => {
        // 一時的にキュー処理ループを保留させるためにフラグを立てる
        arbiter.isProcessingQueue = true;

        arbiter.enqueue({ id: 'low_prio', priority: 30, sound: 'low.mp3' });
        arbiter.enqueue({ id: 'high_prio', priority: 90, sound: 'high.mp3' });
        arbiter.enqueue({ id: 'mid_prio', priority: 60, sound: 'mid.mp3' });

        expect(arbiter.audioQueue.length).toBe(3);
        expect(arbiter.audioQueue[0].rule.id).toBe('high_prio');
        expect(arbiter.audioQueue[1].rule.id).toBe('mid_prio');
        expect(arbiter.audioQueue[2].rule.id).toBe('low_prio');
    });

    it('should process queue items with staggerIntervalMs delay', async () => {
        arbiter.enqueue({ id: 's1', sound: 's1.mp3' });
        arbiter.enqueue({ id: 's2', sound: 's2.mp3' });

        // s1 is processed immediately
        await vi.advanceTimersByTimeAsync(0);
        expect(mockDrivers.wave.play).toHaveBeenCalledWith('s1.mp3');
        expect(mockDrivers.wave.play).not.toHaveBeenCalledWith('s2.mp3');

        // After 60ms stagger interval, s2 is processed
        await vi.advanceTimersByTimeAsync(60);
        expect(mockDrivers.wave.play).toHaveBeenCalledWith('s2.mp3');
    });

    it('should dispatch to WaveDriver in wave mode, or SynthDriver if no sound asset', async () => {
        modeManager.setSoundMode('wave');

        await arbiter.playSoundByRule({ sound: 'hit.mp3', beep: { notes: ['C4'] } });
        expect(mockDrivers.wave.play).toHaveBeenCalledWith('hit.mp3');
        expect(mockDrivers.beep.play).not.toHaveBeenCalled();

        await arbiter.playSoundByRule({ synth: { freq: 440 } });
        expect(mockDrivers.synth.play).toHaveBeenCalledWith({ freq: 440 });
    });

    it('should dispatch to BeepDriver in beep mode, or SynthDriver if synth is specified', async () => {
        modeManager.setSoundMode('beep');

        await arbiter.playSoundByRule({ sound: 'hit.mp3', beep: { notes: ['E4'] } });
        expect(mockDrivers.beep.play).toHaveBeenCalledWith({ notes: ['E4'] });
        expect(mockDrivers.wave.play).not.toHaveBeenCalled();

        await arbiter.playSoundByRule({ synth: { freq: 880 } });
        expect(mockDrivers.synth.play).toHaveBeenCalledWith({ freq: 880 });
    });

    it('should fallback to Synth/Beep in auto mode when wave asset fails to play', async () => {
        modeManager.setSoundMode('auto');
        mockDrivers.wave.play.mockResolvedValueOnce(false); // Wave fails (e.g. 404)

        await arbiter.playSoundByRule({ sound: 'missing.mp3', synth: { freq: 500 } });
        expect(mockDrivers.wave.play).toHaveBeenCalledWith('missing.mp3');
        expect(mockDrivers.synth.play).toHaveBeenCalledWith({ freq: 500 });
    });

    it('should guarantee priority order dispatch when multiple sounds are enqueued synchronously (burst test)', async () => {
        const playedOrder = [];
        const logs = [];
        const testArbiter = new SoundArbiter({
            modeManager,
            drivers: {
                wave: {
                    play: vi.fn().mockImplementation(async (file) => {
                        playedOrder.push(file);
                        return true;
                    })
                },
                beep: { play: vi.fn() },
                synth: { play: vi.fn() }
            },
            staggerIntervalMs: 60,
            onLogCallback: (type, msg, meta) => {
                logs.push({ type, msg, meta });
            }
        });

        // 低優先度 (damage: 70) ➔ 中優先度 (trap: 80) ➔ 高優先度 (die: 100) ➔ 最低優先度 (coins: 40) を同期連続投入
        testArbiter.enqueue({ id: 'se_damage', sound: 'damage.mp3', priority: 70 });
        testArbiter.enqueue({ id: 'se_trap', sound: 'trap.mp3', priority: 80 });
        testArbiter.enqueue({ id: 'se_die', sound: 'die.mp3', priority: 100 });
        testArbiter.enqueue({ id: 'se_coins', sound: 'coins.mp3', priority: 40 });

        // キュー内は同期投入時点で優先度順にソートされている (die -> trap -> damage -> coins)
        expect(testArbiter.audioQueue.map(item => item.rule.id)).toEqual([
            'se_die',
            'se_trap',
            'se_damage',
            'se_coins'
        ]);

        // ENQUEUE_SE ログが発行されていること
        const enqueueLogs = logs.filter(l => l.type === 'ENQUEUE_SE');
        expect(enqueueLogs.length).toBe(4);
        expect(enqueueLogs[0].msg).toContain('se_damage');
        expect(enqueueLogs[3].msg).toContain('[Queue: 4]');

        // 1件目 (se_die: 100) の再生確認 (microtask 実行直後)
        await vi.advanceTimersByTimeAsync(0);
        expect(playedOrder).toEqual(['die.mp3']);

        // PLAY_QUEUE_ITEM ログが発行されていること
        const playLogs = logs.filter(l => l.type === 'PLAY_QUEUE_ITEM');
        expect(playLogs.length).toBe(1);
        expect(playLogs[0].msg).toContain('Playing queue item: se_die (priority: 100');
        expect(playLogs[0].msg).toContain('[Remaining: 3]');

        // 2件目 (se_trap: 80)
        await vi.advanceTimersByTimeAsync(60);
        expect(playedOrder).toEqual(['die.mp3', 'trap.mp3']);

        // 3件目 (se_damage: 70)
        await vi.advanceTimersByTimeAsync(60);
        expect(playedOrder).toEqual(['die.mp3', 'trap.mp3', 'damage.mp3']);

        // 4件目 (se_coins: 40)
        await vi.advanceTimersByTimeAsync(60);
        expect(playedOrder).toEqual(['die.mp3', 'trap.mp3', 'damage.mp3', 'coins.mp3']);
    });
});
