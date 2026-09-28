import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SoundEngine } from './SoundEngine.js';

describe('SoundEngine Configuration & LocalStorage Tests', () => {
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
    });

    it('should initialize with default values when localStorage is empty and no options provided', () => {
        const engine = new SoundEngine();
        expect(engine.soundMode).toBe('auto');
        expect(engine.volume).toBe(80);
    });

    it('should load sound_mode and sound_volume directly from nh.config in localStorage', () => {
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'mute',
            sound_volume: 45
        }));

        const engine = new SoundEngine();
        expect(engine.soundMode).toBe('mute');
        expect(engine.volume).toBe(45);
    });

    it('should allow options to override localStorage sound_volume when explicitly specified', () => {
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'se',
            sound_volume: 30
        }));

        const engine = new SoundEngine({ volume: 90 });
        expect(engine.soundMode).toBe('se');
        expect(engine.volume).toBe(90);
    });

    it('should ignore obsolete nethack_sound_mode key and rely solely on nh.config', () => {
        global.localStorage.setItem('nethack_sound_mode', 'all');
        global.localStorage.setItem('nh.config', JSON.stringify({
            sound_mode: 'mute'
        }));

        const engine = new SoundEngine();
        expect(engine.soundMode).toBe('mute');
    });
});

describe('Stage 5.4A: SoundEngine MessageContext & Audio Queue Tests', () => {
    it('should deterministically trigger SE from messageId (O(1))', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });
        const context = {
            messageId: 'trap.c:L1184:You_hear:31',
            rawText: 'You hear a loud click!'
        };

        const result = engine.processMessageContext(context);
        expect(result).not.toBeNull();
        expect(result.id).toBe('se_trap');
        expect(result.priority).toBe(80);
    });

    it('should trigger SE from metadata.soundId when present in context', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });
        const context = {
            messageId: 'some.c:unknown_id',
            metadata: { soundId: 'se_door' },
            rawText: 'A door opens.'
        };

        const result = engine.processMessageContext(context);
        expect(result).not.toBeNull();
        expect(result.id).toBe('se_door');
        expect(result.priority).toBe(60);
    });

    it('should fallback to regex log message matching when messageId is not mapped', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });
        const context = {
            messageId: 'custom.c:unmapped',
            rawText: 'You feel hungry.'
        };

        const result = engine.processMessageContext(context, 'You feel hungry.');
        expect(result).not.toBeNull();
        expect(result.id).toBe('se_hunger');
    });

    it('should fallback to regex matching when context is null', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });
        const result = engine.processMessageContext(null, 'Welcome to NetHack');
        expect(result).not.toBeNull();
        expect(result.id).toBe('se_welcome');
    });

    it('should prioritize and sort queued sounds by priority descending', () => {
        const engine = new SoundEngine({ soundMode: 'auto', staggerIntervalMs: 1000 });
        // キュー自動処理を止めて並び順のみ検証できるようにする
        engine.isProcessingQueue = true;

        const hungerRule = { id: 'se_hunger', sound: 'hungry.mp3', priority: 40 };
        const dieRule = { id: 'se_die', sound: 'die.mp3', priority: 100 };
        const hitRule = { id: 'se_attack_hit', sound: 'hit.mp3', priority: 50 };

        engine.enqueueSound(hungerRule);
        engine.enqueueSound(dieRule);
        engine.enqueueSound(hitRule);

        expect(engine.audioQueue.length).toBe(3);
        expect(engine.audioQueue[0].rule.id).toBe('se_die');
        expect(engine.audioQueue[0].priority).toBe(100);
        expect(engine.audioQueue[1].rule.id).toBe('se_attack_hit');
        expect(engine.audioQueue[1].priority).toBe(50);
        expect(engine.audioQueue[2].rule.id).toBe('se_hunger');
        expect(engine.audioQueue[2].priority).toBe(40);
    });

    it('should support dynamic synth handlers (e.g. squeaky board)', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });
        const context = {
            messageId: 'trap.c:squeak_board',
            placeholders: ['a C sharp', 'loudly'],
            rawText: 'You hear a C sharp loudly.'
        };

        const result = engine.processMessageContext(context);
        expect(result).not.toBeNull();
        expect(result.id).toBe('synth_trap.c:squeak_board');
    });
});

describe('Combat Sound & EffectFX Integration Tests', () => {
    it('should correctly identify monster kill messages as se_kill_monster', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });
        
        const killEn = engine.processLogMessage('You kill the goblin!');
        expect(killEn).not.toBeNull();
        expect(killEn.id).toBe('se_kill_monster');

        engine.cooldownMap.clear();
        const diesEn = engine.processLogMessage('The bat dies!');
        expect(diesEn).not.toBeNull();
        expect(diesEn.id).toBe('se_kill_monster');

        engine.cooldownMap.clear();
        const killContext = engine.processMessageContext({ messageId: 'fight.c:L123:kill:0', rawText: 'You kill the goblin!' });
        expect(killContext).not.toBeNull();
        expect(killContext.id).toBe('se_kill_monster');
    });

    it('should correctly identify monster destruction messages as se_destroy_monster', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        const destroyEn = engine.processLogMessage('The skeleton is destroyed!');
        expect(destroyEn).not.toBeNull();
        expect(destroyEn.id).toBe('se_destroy_monster');

        engine.cooldownMap.clear();
        const shatterEn = engine.processLogMessage('The clay golem shatters!');
        expect(shatterEn).not.toBeNull();
        expect(shatterEn.id).toBe('se_destroy_monster');

        engine.cooldownMap.clear();
        const destroyContext = engine.processMessageContext({ messageId: 'fight.c:L456:destroy:0', rawText: 'The skeleton is destroyed!' });
        expect(destroyContext).not.toBeNull();
        expect(destroyContext.id).toBe('se_destroy_monster');
    });

    it('should correctly identify attack hit and miss separately', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        const hit = engine.processLogMessage('You hit the goblin.');
        expect(hit).not.toBeNull();
        expect(hit.id).toBe('se_attack_hit');

        const miss = engine.processLogMessage('You miss the goblin.');
        expect(miss).not.toBeNull();
        expect(miss.id).toBe('se_attack_miss');
    });

    it('should trigger corresponding SE via handleFxTrigger', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        const killFx = engine.handleFxTrigger({ type: 'KILL_CONFIRMED', targetX: 5, targetY: 5 });
        expect(killFx).not.toBeNull();
        expect(killFx.id).toBe('se_kill_monster');

        const hitFx = engine.handleFxTrigger({ type: 'ATTACK_HIT', targetX: 5, targetY: 5 });
        expect(hitFx).not.toBeNull();
        expect(hitFx.id).toBe('se_attack_hit');

        const dmgFx = engine.handleFxTrigger({ type: 'DAMAGE_TAKEN', targetX: 5, targetY: 5 });
        expect(dmgFx).not.toBeNull();
        expect(dmgFx.id).toBe('se_player_damaged');
    });

    it('should subscribe to core fx_trigger via attachCore', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });
        const listeners = {};
        const mockCore = {
            on: (event, handler) => { listeners[event] = handler; },
            off: (event, handler) => { delete listeners[event]; }
        };

        engine.attachCore(mockCore);
        expect(listeners['fx_trigger']).toBeDefined();

        let triggeredSE = null;
        engine.enqueueSound = (rule) => { triggeredSE = rule; };
        listeners['fx_trigger']({ type: 'KILL_CONFIRMED' });
        expect(triggeredSE).not.toBeNull();
        expect(triggeredSE.id).toBe('se_kill_monster');
    });

    it('should correctly trigger sounds for actual in-game messages via O(1) or rawText fallback', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        // 1. O(1) マッピングメッセージ
        const dieSe = engine.processMessageContext({ messageId: 'end.c:L195:You:0', rawText: 'You die...' });
        expect(dieSe).not.toBeNull();
        expect(dieSe.id).toBe('se_die');

        engine.cooldownMap.clear();
        const doorSe = engine.processMessageContext({ messageId: 'lock.c:L890:pline_The:51', rawText: 'The door opens.' });
        expect(doorSe).not.toBeNull();
        expect(doorSe.id).toBe('se_door');

        engine.cooldownMap.clear();
        const feelBetterSe = engine.processMessageContext({ messageId: 'pray.c:L418:You_feel:7', rawText: 'You feel much better.' });
        expect(feelBetterSe).not.toBeNull();
        expect(feelBetterSe.id).toBe('se_drink_good');

        // 2. rawText フォールバックメッセージ
        engine.cooldownMap.clear();
        const welcomeSe = engine.processMessageContext(null, 'Welcome to NetHack! You are a neutral human Male Caveman.');
        expect(welcomeSe).not.toBeNull();
        expect(welcomeSe.id).toBe('se_welcome');

        engine.cooldownMap.clear();
        const hungerSe = engine.processMessageContext(null, 'You feel hungry.');
        expect(hungerSe).not.toBeNull();
        expect(hungerSe.id).toBe('se_hunger');

        engine.cooldownMap.clear();
        const pickupSe = engine.processMessageContext(null, 'You pick up a rock.');
        expect(pickupSe).not.toBeNull();
        expect(pickupSe.id).toBe('se_pickup');

        engine.cooldownMap.clear();
        const stairSe = engine.processMessageContext(null, 'You go down the stairs.');
        expect(stairSe).not.toBeNull();
        expect(stairSe.id).toBe('se_stair');

        engine.cooldownMap.clear();
        const equipSe = engine.processMessageContext(null, 'You are now wearing a leather armor.');
        expect(equipSe).not.toBeNull();
        expect(equipSe.id).toBe('se_equip');

        engine.cooldownMap.clear();
        const trapSe = engine.processMessageContext(null, 'You fall into a pit!');
        expect(trapSe).not.toBeNull();
        expect(trapSe.id).toBe('se_trap');
    });
});


