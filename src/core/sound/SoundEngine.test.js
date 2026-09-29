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

    it('should support dynamic synth handlers (e.g. squeaky board) with precise 12-pitch mapping', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        // 1. Context 経由（冠詞 "a " 付き C sharp）
        const context1 = {
            messageId: 'trap.c:squeak_board',
            placeholders: ['a C sharp', 'loudly'],
            rawText: 'You hear a C sharp loudly.'
        };
        const result1 = engine.processMessageContext(context1);
        expect(result1).not.toBeNull();
        expect(result1.id).toBe('synth_trap.c:squeak_board');
        expect(result1.synth.noteName).toBe('C#');
        expect(result1.synth.freqEnd).toBe(277.18);
        expect(result1.synth.gain).toBe(1.0);

        // 2. Context 経由（冠詞 "an " 付き E flat）
        engine.cooldownMap.clear();
        const context2 = {
            messageId: 'trap.c:squeak_board',
            placeholders: ['an E flat', 'loudly'],
            rawText: 'You hear an E flat loudly.'
        };
        const result2 = engine.processMessageContext(context2);
        expect(result2.synth.noteName).toBe('EB');
        expect(result2.synth.freqEnd).toBe(311.13);

        // 3. 生テキスト正規表現経由: 文頭 "A board..." の "A" に誤爆せず "C" を抽出すること！
        engine.cooldownMap.clear();
        const result3 = engine.processLogMessage('A board beneath you squeaks a C note loudly.');
        expect(result3).not.toBeNull();
        expect(result3.synth.noteName).toBe('C');
        expect(result3.synth.freqEnd).toBe(261.63);

        // 4. 生テキスト正規表現経由: "G sharp" の正確な抽出
        engine.cooldownMap.clear();
        const result4 = engine.processLogMessage('A board beneath you squeaks a G sharp loudly.');
        expect(result4.synth.noteName).toBe('G#');
        expect(result4.synth.freqEnd).toBe(415.30);

        // 5. 遠距離生テキスト経由: "You hear..." の "hear" の "e" に誤爆せず "D" を抽出し、距離減衰が効くこと
        engine.cooldownMap.clear();
        const result5 = engine.processLogMessage('You hear a D note squeak in the distance.');
        expect(result5).not.toBeNull();
        expect(result5.synth.noteName).toBe('D');
        expect(result5.synth.freqEnd).toBe(293.66);
        expect(result5.synth.gain).toBe(0.3);
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

describe('ROADMAP 2.3: Dynamic Musical & Pitch Synthesis Tests', () => {
    it('should correctly process monster vocalization synth handlers via messageId', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        // 1. shriek (急激な下降ノコギリ波ピッチベンド)
        const shriekRes = engine.processMessageContext({ messageId: 'sounds.c:shriek' });
        expect(shriekRes).not.toBeNull();
        expect(shriekRes.id).toBe('synth_sounds.c:shriek');
        expect(shriekRes.synth.type).toBe('oscillator');
        expect(shriekRes.synth.wave).toBe('sawtooth');
        expect(shriekRes.synth.freq).toBe(2000);
        expect(shriekRes.synth.freqEnd).toBe(800);

        // 2. trumpet (3音和音: C4 + G4 + C5)
        const trumpetRes = engine.processMessageContext({ messageId: 'sounds.c:trumpet' });
        expect(trumpetRes).not.toBeNull();
        expect(trumpetRes.id).toBe('synth_sounds.c:trumpet');
        expect(trumpetRes.synth.type).toBe('chord');
        expect(trumpetRes.synth.freqs).toEqual([261.63, 392.00, 523.25]);

        // 3. buzz & drone (低周波 AM 羽音)
        const buzzRes = engine.processMessageContext({ messageId: 'sounds.c:buzz' });
        expect(buzzRes).not.toBeNull();
        expect(buzzRes.id).toBe('synth_sounds.c:buzz');
        expect(buzzRes.synth.type).toBe('am');
        expect(buzzRes.synth.lfoFreq).toBe(12);

        const droneRes = engine.processMessageContext({ messageId: 'sounds.c:drone' });
        expect(droneRes).not.toBeNull();
        expect(droneRes.id).toBe('synth_sounds.c:drone');
        expect(droneRes.synth.type).toBe('am');
        expect(droneRes.synth.lfoFreq).toBe(10);

        // 4. rattle (骨のカタカタ音: 短パルス連続)
        const rattleRes = engine.processMessageContext({ messageId: 'sounds.c:rattle' });
        expect(rattleRes).not.toBeNull();
        expect(rattleRes.id).toBe('synth_sounds.c:rattle');
        expect(rattleRes.synth.type).toBe('pulses');
        expect(rattleRes.synth.count).toBe(4);
        expect(rattleRes.synth.wave).toBe('square');

        // 5. gurgle (バブリング音: 高速FM合成)
        const gurgleRes = engine.processMessageContext({ messageId: 'sounds.c:gurgle' });
        expect(gurgleRes).not.toBeNull();
        expect(gurgleRes.id).toBe('synth_sounds.c:gurgle');
        expect(gurgleRes.synth.type).toBe('fm');
        expect(gurgleRes.synth.modFreq).toBe(24);
        expect(gurgleRes.synth.modDepth).toBe(160);
    });

    it('should correctly process instruments & drawbridge synth handlers via messageId', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        // 1. flute (アルペジオ)
        const fluteRes = engine.processMessageContext({ messageId: 'music.c:flute' });
        expect(fluteRes).not.toBeNull();
        expect(fluteRes.id).toBe('synth_music.c:flute');
        expect(fluteRes.synth.type).toBe('sequence');
        expect(fluteRes.synth.notes).toEqual(["C5", "E5", "G5", "C6"]);

        // 2. bugle (ファンファーレ)
        const bugleRes = engine.processMessageContext({ messageId: 'music.c:bugle' });
        expect(bugleRes).not.toBeNull();
        expect(bugleRes.id).toBe('synth_music.c:bugle');
        expect(bugleRes.synth.type).toBe('sequence');
        expect(bugleRes.synth.notes.length).toBe(4);
        expect(bugleRes.synth.notes[0].note).toBe("C4");

        // 3. drum (打楽器ピッチ急降下)
        const drumRes = engine.processMessageContext({ messageId: 'music.c:drum' });
        expect(drumRes).not.toBeNull();
        expect(drumRes.id).toBe('synth_music.c:drum');
        expect(drumRes.synth.type).toBe('oscillator');
        expect(drumRes.synth.freq).toBe(160);
        expect(drumRes.synth.freqEnd).toBe(45);

        // 4. drawbridge_tune (プレイヤー入力 A-G パース)
        const tuneCustomRes = engine.processMessageContext({
            messageId: 'music.c:drawbridge_tune',
            placeholders: ['c d e f g']
        });
        expect(tuneCustomRes).not.toBeNull();
        expect(tuneCustomRes.synth.type).toBe('sequence');
        expect(tuneCustomRes.synth.notes).toEqual(['C4', 'D4', 'E4', 'F4', 'G4']);

        // death tune (d, e, a が A-G 音階としてパースされる)
        const deathTuneRes = engine.processMessageContext({
            messageId: 'music.c:drawbridge_tune',
            placeholders: ['death']
        });
        expect(deathTuneRes).not.toBeNull();
        expect(deathTuneRes.synth.notes).toEqual(['D4', 'E4', 'A4']);
    });

    it('should fallback and trigger dynamic synthesis from raw text regex rules', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        // 金切り声
        const shriekLog = engine.processLogMessage('The yellow mold shrieks.');
        expect(shriekLog).not.toBeNull();
        expect(shriekLog.id).toBe('synth_shriek');
        expect(shriekLog.synth.freqEnd).toBe(800);

        // 突撃ラッパ
        engine.cooldownMap.clear();
        const trumpetLog = engine.processLogMessage('The elephant trumpets!');
        expect(trumpetLog).not.toBeNull();
        expect(trumpetLog.id).toBe('synth_trumpet');
        expect(trumpetLog.synth.type).toBe('chord');

        // 羽音
        engine.cooldownMap.clear();
        const buzzLog = engine.processLogMessage('A killer bee buzzes angrily.');
        expect(buzzLog).not.toBeNull();
        expect(buzzLog.id).toBe('synth_buzz');
        expect(buzzLog.synth.type).toBe('am');

        // ドローン
        engine.cooldownMap.clear();
        const droneLog = engine.processLogMessage('You hear an angry drone.');
        expect(droneLog).not.toBeNull();
        expect(droneLog.id).toBe('synth_buzz');
        expect(droneLog.synth.lfoFreq).toBe(10);

        // 骨カタカタ
        engine.cooldownMap.clear();
        const rattleLog = engine.processLogMessage('The skeleton rattles noisily.');
        expect(rattleLog).not.toBeNull();
        expect(rattleLog.id).toBe('synth_rattle');
        expect(rattleLog.synth.type).toBe('pulses');

        // バブリング
        engine.cooldownMap.clear();
        const gurgleLog = engine.processLogMessage('The water demon gurgles.');
        expect(gurgleLog).not.toBeNull();
        expect(gurgleLog.id).toBe('synth_gurgle');
        expect(gurgleLog.synth.type).toBe('fm');

        // 笛
        engine.cooldownMap.clear();
        const fluteLog = engine.processLogMessage('The wooden flute trills.');
        expect(fluteLog).not.toBeNull();
        expect(fluteLog.id).toBe('synth_flute');
        expect(fluteLog.synth.type).toBe('sequence');

        // 角笛
        engine.cooldownMap.clear();
        const bugleLog = engine.processLogMessage('You extract a loud noise from your bugle.');
        expect(bugleLog).not.toBeNull();
        expect(bugleLog.id).toBe('synth_bugle');
        expect(bugleLog.synth.type).toBe('sequence');

        // ドラム
        engine.cooldownMap.clear();
        const drumLog = engine.processLogMessage('You produce a heavy, thunderous rolling!');
        expect(drumLog).not.toBeNull();
        expect(drumLog.id).toBe('synth_drum');
        expect(drumLog.synth.type).toBe('oscillator');

        // 跳ね橋
        engine.cooldownMap.clear();
        const tuneLog = engine.processLogMessage('What tune are you playing? [5 notes, A-G]');
        expect(tuneLog).not.toBeNull();
        expect(tuneLog.id).toBe('synth_drawbridge_tune');
        expect(tuneLog.synth.type).toBe('sequence');
    });

    it('should execute playSynth for all synthesis modes without crashing in AudioContext environment', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        // Web Audio API の精密モック環境を構築
        const mockAudioParam = () => ({
            value: 0,
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
            linearRampToValueAtTime: () => {}
        });

        const createdNodes = [];
        const MockAudioContext = class {
            constructor() {
                this.state = 'running';
                this.currentTime = 0;
                this.destination = {};
            }
            resume() {}
            createOscillator() {
                const osc = {
                    type: 'sine',
                    frequency: mockAudioParam(),
                    connect: () => {},
                    start: () => {},
                    stop: () => {}
                };
                createdNodes.push(osc);
                return osc;
            }
            createGain() {
                const gain = {
                    gain: mockAudioParam(),
                    connect: () => {}
                };
                createdNodes.push(gain);
                return gain;
            }
        };

        global.window = {
            AudioContext: MockAudioContext
        };

        // 1. oscillator with pitch bend (shriek)
        expect(() => engine.playSynth({
            type: 'oscillator',
            wave: 'sawtooth',
            freq: 2000,
            freqEnd: 800,
            duration: 200
        })).not.toThrow();

        // 2. chord (trumpet)
        expect(() => engine.playSynth({
            type: 'chord',
            wave: 'sawtooth',
            freqs: [261.63, 392, 523.25],
            duration: 300
        })).not.toThrow();

        // 3. am (buzz)
        expect(() => engine.playSynth({
            type: 'am',
            wave: 'sawtooth',
            freq: 130,
            lfoFreq: 12,
            duration: 250
        })).not.toThrow();

        // 4. fm (gurgle)
        expect(() => engine.playSynth({
            type: 'fm',
            wave: 'sine',
            freq: 350,
            modFreq: 24,
            modDepth: 160,
            duration: 240
        })).not.toThrow();

        // 5. sequence (flute / bugle / drawbridge)
        expect(() => engine.playSynth({
            type: 'sequence',
            wave: 'triangle',
            notes: ["C4", "E4", "G4", "C5"],
            noteDuration: 80
        })).not.toThrow();

        // 6. pulses (rattle)
        expect(() => engine.playSynth({
            type: 'pulses',
            wave: 'square',
            count: 4,
            pulseDuration: 35,
            pulseInterval: 45
        })).not.toThrow();

        delete global.window;
    });

    it('should correctly resolve synth definition in _resolveRuleFromEventDef for catalog preview', () => {
        const engine = new SoundEngine({ soundMode: 'auto' });

        // 1. DYNAMIC_SYNTH_HANDLERS にあるイベント（shriek）
        const shriekDef = { seId: 'synth_shriek', priority: 70 };
        const resolvedShriek = engine._resolveRuleFromEventDef(shriekDef, 'sounds.c:shriek');
        expect(resolvedShriek).toBeDefined();
        expect(resolvedShriek.id).toBe('synth_shriek');
        expect(resolvedShriek.synth).toBeDefined();
        expect(resolvedShriek.synth.freq).toBe(2000);
        expect(resolvedShriek.synth.freqEnd).toBe(800);

        // 2. seId からの逆引き解決（trumpet）
        const trumpetDef = { seId: 'synth_trumpet', priority: 70 };
        const resolvedTrumpet = engine._resolveRuleFromEventDef(trumpetDef);
        expect(resolvedTrumpet).toBeDefined();
        expect(resolvedTrumpet.synth).toBeDefined();
        expect(resolvedTrumpet.synth.type).toBe('chord');

        // 3. 通常のSE（se_rumble）
        const rumbleDef = { seId: 'se_rumble', sound: 'trap.mp3', priority: 80, beep: { notes: ["C3"] } };
        const resolvedRumble = engine._resolveRuleFromEventDef(rumbleDef);
        expect(resolvedRumble.id).toBe('se_rumble');
        expect(resolvedRumble.sound).toBe('trap.mp3');
        expect(resolvedRumble.beep).toBeDefined();
    });

    it('should respect sound modes strictly during queue processing and rule playback', async () => {
        let synthPlayed = false;
        let beepPlayed = false;
        let wavePlayed = false;

        const engine = new SoundEngine({ soundMode: 'beep' });
        engine.playSynth = () => { synthPlayed = true; };
        engine.playBeep = () => { beepPlayed = true; };
        engine.playAudioFile = async () => { wavePlayed = true; return true; };

        // 1. Beep モード: 通常SEはBeep、シンセはSynthで再生
        await engine.playSoundByRule({ id: 'test_se', sound: 'test.mp3', beep: { notes: ['C4'] } });
        expect(beepPlayed).toBe(true);
        expect(wavePlayed).toBe(false);

        await engine.playSoundByRule({ id: 'test_synth', synth: { freq: 440 } });
        expect(synthPlayed).toBe(true);

        // 2. Wave モード: 通常SEはWaveのみ試行、シンセはSynth再生
        synthPlayed = false;
        beepPlayed = false;
        wavePlayed = false;
        engine.setSoundMode('wave');

        await engine.playSoundByRule({ id: 'test_se', sound: 'test.mp3', beep: { notes: ['C4'] } });
        expect(wavePlayed).toBe(true);
        expect(beepPlayed).toBe(false);

        await engine.playSoundByRule({ id: 'test_synth', synth: { freq: 440 } });
        expect(synthPlayed).toBe(true);

        // 3. Mute モード: 一切再生しない
        synthPlayed = false;
        beepPlayed = false;
        wavePlayed = false;
        engine.setSoundMode('mute');

        await engine.playSoundByRule({ id: 'test_se', sound: 'test.mp3', beep: { notes: ['C4'] } });
        await engine.playSoundByRule({ id: 'test_synth', synth: { freq: 440 } });
        expect(synthPlayed).toBe(false);
        expect(beepPlayed).toBe(false);
        expect(wavePlayed).toBe(false);

        const enqueued = engine.enqueueSound({ id: 'test_enq', synth: { freq: 440 } });
        expect(enqueued).toBeNull();
    });
});



