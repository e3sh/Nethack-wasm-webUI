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

    it('should fallback merge beep and default rules in resolveRuleFromEventDef', () => {
        const coordinator = new SoundCoordinator({ soundMode: 'auto' });

        // end.c:L120:killer は SOUND_EVENT_MAP 上で beep を持たないが、DEFAULT_SOUND_RULES の se_die から beep が補完される
        const dieDef = { seId: 'se_die', sound: 'die.mp3', priority: 100 };
        const resolvedDie = coordinator._resolveRuleFromEventDef(dieDef, 'end.c:L120:killer');

        expect(resolvedDie.id).toBe('se_die');
        expect(resolvedDie.sound).toBe('die.mp3');
        expect(resolvedDie.beep).toBeDefined();
        expect(resolvedDie.beep.notes).toEqual(["C4", "B3", "A3", "G3", "F3", "E3", "D3", "C3"]);
        expect(resolvedDie.priority).toBe(100);

        // mhitu.c:damaged (se_player_damaged)
        const hitDef = { seId: 'se_player_damaged', sound: 'damaged.mp3', priority: 70 };
        const resolvedHit = coordinator._resolveRuleFromEventDef(hitDef, 'mhitu.c:damaged');
        expect(resolvedHit.beep).toBeDefined();
        expect(resolvedHit.beep.notes).toEqual(["F3", "C#3"]);
        expect(resolvedHit.cooldownMs).toBe(100);
    });

    it('should dispatch simulated combat burst in correct priority order (die -> trap -> damaged -> coins)', async () => {
        const playedList = [];
        const mockWave = {
            play: vi.fn().mockImplementation(async (f) => {
                playedList.push(f);
                return true;
            }),
            setVolume: vi.fn(),
            unlockAudio: vi.fn()
        };

        const coordinator = new SoundCoordinator({
            soundMode: 'wave',
            staggerIntervalMs: 60,
            drivers: { wave: mockWave }
        });

        // 実戦バースト: 4つの MessageContext を同一同期コンテキストで連続受信
        coordinator.processMessageContext({ messageId: 'mhitu.c:damaged', rawText: 'The dragon hits you!' }); // prio: 70
        coordinator.processMessageContext({ messageId: 'trap.c:L1184:You_hear:31', rawText: 'You hear a loud click!' }); // prio: 80
        coordinator.processMessageContext({ messageId: 'end.c:L120:killer', rawText: 'You die...' }); // prio: 100
        coordinator.processMessageContext({ metadata: { soundId: 'se_coins' }, rawText: 'You hear someone counting gold coins.' }); // prio: 45

        // 同期時点ではまだ shift されず、優先度順にソートされてキューに待機
        expect(coordinator.audioQueue.map(item => item.rule.id)).toEqual([
            'se_die',
            'se_trap',
            'se_player_damaged',
            'se_pickup'
        ]);

        // microtask 発火後、最優先 (se_die: 100) がディスパッチ
        await vi.waitFor(() => {
            expect(playedList).toContain('die.mp3');
        });
        expect(playedList[0]).toBe('die.mp3');
    });
});
