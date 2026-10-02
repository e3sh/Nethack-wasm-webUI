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
});
