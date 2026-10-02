import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundCoordinator } from '../../../src/core/sound/SoundCoordinator.js';

describe('SoundCoordinator Facade & Integration Tests', () => {
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        global.localStorage = {
            getItem: (key) => mockStorage[key] || null,
            setItem: (key, val) => { mockStorage[key] = String(val); },
            removeItem: (key) => { delete mockStorage[key]; },
            clear: () => { mockStorage = {}; }
        };
    });

    afterEach(() => {
        delete global.localStorage;
        vi.restoreAllMocks();
    });

    it('should initialize with default components and custom options', () => {
        const coordinator = new SoundCoordinator({
            soundMode: 'wave',
            volume: 75,
            soundDir: 'custom/sounds/',
            staggerIntervalMs: 50
        });

        expect(coordinator.soundMode).toBe('wave');
        expect(coordinator.volume).toBe(75);
        expect(coordinator.soundDir).toBe('custom/sounds/');
        expect(coordinator.staggerIntervalMs).toBe(50);
        expect(coordinator.drivers.wave).toBeDefined();
        expect(coordinator.drivers.beep).toBeDefined();
        expect(coordinator.drivers.synth).toBeDefined();
    });

    it('should support pluggable mock drivers injection', async () => {
        const mockWave = { play: vi.fn().mockResolvedValue(true), setVolume: vi.fn(), unlockAudio: vi.fn() };
        const mockBeep = { play: vi.fn(), setVolume: vi.fn(), unlockAudio: vi.fn() };
        const mockSynth = { play: vi.fn(), setVolume: vi.fn(), unlockAudio: vi.fn() };

        const coordinator = new SoundCoordinator({
            soundMode: 'auto',
            drivers: {
                wave: mockWave,
                beep: mockBeep,
                synth: mockSynth
            }
        });

        // 1. MessageContext による効果音照合と再生ディスパッチ
        const result = coordinator.processMessageContext({
            messageId: 'trap.c:L1184:You_hear:31',
            rawText: 'You hear a loud click!'
        });
        expect(result).not.toBeNull();
        expect(result.id).toBe('se_trap');

        await vi.waitFor(() => {
            expect(mockWave.play).toHaveBeenCalledWith('trap.mp3');
        });

        // 2. unlockAudio のドライバ伝播
        coordinator.unlockAudio();
        expect(mockWave.unlockAudio).toHaveBeenCalled();
        expect(mockBeep.unlockAudio).toHaveBeenCalled();
        expect(mockSynth.unlockAudio).toHaveBeenCalled();

        // 3. setVolume のドライバ伝播
        coordinator.setVolume(40);
        expect(coordinator.volume).toBe(40);
        expect(mockWave.setVolume).toHaveBeenCalledWith(40);
        expect(mockBeep.setVolume).toHaveBeenCalledWith(40);
        expect(mockSynth.setVolume).toHaveBeenCalledWith(40);
    });

    it('should handle core.attachCore and process fx_trigger events', () => {
        const coordinator = new SoundCoordinator({ soundMode: 'auto' });
        let eventListeners = {};
        const mockCore = {
            on: (event, handler) => { eventListeners[event] = handler; },
            off: (event, handler) => { delete eventListeners[event]; }
        };

        coordinator.attachCore(mockCore);
        expect(eventListeners['fx_trigger']).toBeDefined();

        // KILL_CONFIRMED
        const killResult = coordinator.handleFxTrigger({ type: 'KILL_CONFIRMED', shattered: false });
        expect(killResult).not.toBeNull();
        expect(killResult.id).toBe('se_kill_monster');

        // ATTACK_HIT
        const hitResult = coordinator.handleFxTrigger({ type: 'ATTACK_HIT' });
        expect(hitResult).not.toBeNull();
        expect(hitResult.id).toBe('se_attack_hit');

        // DAMAGE_TAKEN
        const dmgResult = coordinator.handleFxTrigger({ type: 'DAMAGE_TAKEN' });
        expect(dmgResult).not.toBeNull();
        expect(dmgResult.id).toBe('se_player_damaged');
    });

    it('should process raw text log message with dynamic synthesis and fallback', () => {
        const coordinator = new SoundCoordinator({ soundMode: 'auto' });

        // Shriek (Dynamic synth)
        const shriek = coordinator.processLogMessage('The yellow mold shrieks.');
        expect(shriek).not.toBeNull();
        expect(shriek.id).toBe('synth_shriek');
        expect(shriek.synth).toBeDefined();

        // Fallback standard SE
        const welcome = coordinator.processLogMessage('Welcome to NetHack!');
        expect(welcome).not.toBeNull();
        expect(welcome.id).toBe('se_welcome');
    });

    it('should suppress all triggers when soundMode is mute', () => {
        const coordinator = new SoundCoordinator({ soundMode: 'mute' });

        expect(coordinator.processMessageContext({ messageId: 'trap.c:L1184:You_hear:31' })).toBeNull();
        expect(coordinator.handleFxTrigger({ type: 'ATTACK_HIT' })).toBeNull();
        expect(coordinator.processLogMessage('Welcome to NetHack!')).toBeNull();
        expect(coordinator.enqueueSound({ id: 'se_test', sound: 'test.mp3' })).toBeNull();
    });
});
