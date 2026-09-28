/**
 * SoundEngine.js - WebUICore サウンド統合モジュール
 *
 * Web Audio API / Howler.js による効果音(SE/WAV/MP3)およびオシレーターBeep音の再生を行う。
 * また、Wasmから届くテキストメッセージに対して正規表現パターンマッチングを行い、
 * 文脈に応じた効果音を自動再生するトリガー機能を備える。
 */

import { SOUND_EVENT_MAP, DYNAMIC_SYNTH_HANDLERS } from './SoundEventCatalog.js';

export class SoundEngine {
    /**
     * @param {Object} [options]
     * @param {string} [options.soundMode='mute'] - 'mute' | 'se' | 'beep'
     * @param {number} [options.volume=80] - 0 ~ 100
     * @param {string} [options.soundDir='assets/sounds/'] - 音声アセットパス
     * @param {number} [options.staggerIntervalMs=60] - Audio Queue スタガード再生間隔(ms)
     */
    constructor(options = {}) {
        let activeMode = null;
        let activeVolume = options.volume !== undefined ? options.volume : null;

        // 1. localStorage (nh.config) ユーザー設定を取得
        if (typeof localStorage !== 'undefined') {
            try {
                const savedConfigStr = localStorage.getItem("nh.config");
                if (savedConfigStr) {
                    const savedConfig = JSON.parse(savedConfigStr);
                    if (savedConfig) {
                        if (savedConfig.sound_mode) {
                            activeMode = savedConfig.sound_mode;
                        }
                        if (activeVolume === null && savedConfig.sound_volume !== undefined) {
                            activeVolume = parseInt(savedConfig.sound_volume, 10);
                        }
                    }
                }
            } catch (e) {}
        }

        // 2. 設定が無ければ options、それも無ければデフォルト ('auto' / 80)
        if (!activeMode) {
            activeMode = options.soundMode || 'auto';
        }
        if (activeVolume === null || isNaN(activeVolume)) {
            activeVolume = 80;
        }

        this.soundMode = activeMode;
        this.volume = activeVolume;
        this.soundDir = options.soundDir || 'assets/sounds/';
        this.staggerIntervalMs = options.staggerIntervalMs !== undefined ? options.staggerIntervalMs : 60;
        this.audioQueue = [];
        this.isProcessingQueue = false;
        this.cooldownMap = new Map();
        this.failedAssetCache = new Set(); // 存在しない音声アセットのブラックリスト
        this.audioCtx = null;
        this.onLogCallback = options.onLogCallback || null;

        // sound_mapping.json と完全同調したデフォルトルール集 (英語生メッセージフォールバック)
        this.rules = [
            {
                id: "se_welcome",
                pattern: "Welcome to NetHack",
                sound: "welcome.mp3",
                beep: { notes: ["C4", "E4", "G4", "C5"], wave: "square", duration: 90, lfo: { freq: 6, wave: "sine", depth: 15 } }
            },
            {
                id: "se_die",
                pattern: "^You die\\.\\.\\.",
                sound: "die.mp3",
                beep: { notes: ["C4", "B3", "A3", "G3", "F3", "E3", "D3", "C3"], wave: "sawtooth", duration: 150 }
            },
            {
                id: "se_hunger",
                pattern: "^You feel (hungry|weak)\\.",
                sound: "hungry.mp3",
                beep: { notes: ["E3", "C3"], wave: "sine", duration: 150 }
            },
            {
                id: "se_trap",
                pattern: "shoots out at you|fall into a pit|bear trap",
                sound: "trap.mp3",
                beep: { notes: ["C6", "C3"], wave: "square", duration: 100 }
            },
            {
                id: "se_cast_fail",
                pattern: "^You fail to cast",
                sound: "cast_fail.mp3",
                beep: { notes: ["F4", "C4"], wave: "sawtooth", duration: 100 }
            },
            {
                id: "se_cast_spell",
                pattern: "^You cast",
                sound: "cast.mp3",
                beep: { notes: ["C4", "E4", "G4", "B4", "C5"], wave: "sine", duration: 80 }
            },
            {
                id: "se_wand_zap",
                pattern: "\\bzaps\\b",
                sound: "zap.mp3",
                beep: { notes: ["C6", "G5", "E5", "C5"], wave: "sawtooth", duration: 60 }
            },
            {
                id: "se_shoot_throw",
                pattern: "^You (shoot|throw)",
                sound: "shoot.mp3",
                beep: { notes: ["G4", "D5"], wave: "triangle", duration: 50 }
            },
            {
                id: "se_equip",
                pattern: "^You (are now wearing|put on|wield|take off|remove)",
                sound: "equip.mp3",
                beep: { notes: ["D4", "A4"], wave: "square", duration: 60 }
            },
            {
                id: "se_find_secret",
                pattern: "^You find a secret",
                sound: "secret.mp3",
                beep: { notes: ["C5", "E5", "G5", "C6"], wave: "sine", duration: 90 }
            },
            {
                id: "se_player_damaged",
                pattern: "(bites|hits|scratches|kicks) you|^The .* bites!",
                sound: "damaged.mp3",
                beep: { notes: ["F3", "C#3"], wave: "square", duration: 80 },
                cooldownMs: 100
            },
            {
                id: "se_kill_monster",
                pattern: "\\b(kill|kills|killed|dies|defeated|death cry)\\b",
                sound: "kill.mp3",
                beep: { notes: ["G4", "C5", "E5", "G5"], wave: "triangle", duration: 80 },
                priority: 65,
                cooldownMs: 80
            },
            {
                id: "se_destroy_monster",
                pattern: "\\b(destroy|destroys|destroyed|shatters|shattered)\\b",
                sound: "destroy.mp3",
                beep: { notes: ["E4", "B3", "G3", "C3"], wave: "sawtooth", duration: 70 },
                priority: 65,
                cooldownMs: 80
            },
            {
                id: "se_attack_hit",
                pattern: "You hit|\\bhits\\b",
                sound: "hit.mp3",
                beep: { notes: ["E5", "G5"], wave: "square", duration: 50 },
                cooldownMs: 100
            },
            {
                id: "se_attack_miss",
                pattern: "You miss|\\bmisses\\b",
                sound: "swing.mp3",
                beep: { notes: ["B4", "F4"], wave: "triangle", duration: 50 },
                cooldownMs: 100
            },
            {
                id: "se_drink_good",
                pattern: "feel better|feel much better|feel full of energy|see much clearer|feel warm",
                sound: "drink_good.mp3",
                beep: { notes: ["C4", "E4", "G4", "C5"], wave: "sine", duration: 70 }
            },
            {
                id: "se_drink_bad",
                pattern: "feel sick|feel a little dull|feel cold|poisoned|unhealthy|hallucinating|blind|confused|paralyzed",
                sound: "drink_bad.mp3",
                beep: { notes: ["G3", "C#3", "C3"], wave: "sawtooth", duration: 120 }
            },
            {
                id: "se_drink_neutral",
                pattern: "\\bdrink\\b|\\bquaff\\b|\\bchug\\b|potion|tastes",
                sound: "chug.mp3",
                beep: { notes: ["C4", "G4"], wave: "sine", duration: 80 }
            },
            {
                id: "se_eat_food",
                pattern: "\\beat\\b|\\beating\\b|delicious|tasty|blecch",
                sound: "eat.mp3",
                beep: { notes: ["G4", "E4", "C4"], wave: "sine", duration: 70 }
            },
            {
                id: "se_pickup",
                pattern: "pick up",
                sound: "pickup.mp3",
                beep: { notes: ["C5", "E5"], wave: "sine", duration: 60 }
            },
            {
                id: "se_door",
                pattern: "\\bdoor\\b|\\bdoors\\b|\\blocked\\b",
                sound: "door_lock.mp3",
                beep: { notes: ["G3", "C3"], wave: "square", duration: 80 }
            },
            {
                id: "se_read_scroll",
                pattern: "\\bread\\b|\\bscroll\\b|turns to dust|fades",
                sound: "scroll.mp3",
                beep: { notes: ["F4", "A4", "C5"], wave: "triangle", duration: 80 }
            },
            {
                id: "se_stair",
                pattern: "\\bstair\\b|\\bstairs\\b|\\bladder\\b",
                sound: "stair.mp3",
                beep: { notes: ["C4", "E4", "G4"], wave: "triangle", duration: 70 }
            }
        ];
    }

    setSoundMode(mode) {
        this.soundMode = mode;
    }

    /**
     * サウンドモードの正規化
     * 'auto' ➔ 'auto' (Wave優先、無ければBeepフォールバック)
     * 'se', 'wave' ➔ 'wave' (音声ファイル専用)
     * 'beep' ➔ 'beep' (Beep合成音専用)
     * 'mute', 'off' ➔ 'mute' (消音)
     */
    getNormalizedSoundMode() {
        const mode = String(this.soundMode || '').toLowerCase();
        if (mode === 'auto') return 'auto';
        if (mode === 'wave' || mode === 'se') return 'wave';
        if (mode === 'beep') return 'beep';
        return 'mute';
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(100, vol));
    }

    /**
     * ブラウザのユーザー操作による AudioContext のブロック解除
     */
    unlockAudio() {
        if (typeof window === 'undefined') return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !this.audioCtx) {
            this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this._log('AUDIO_UNLOCKED', `AudioContext state: ${this.audioCtx ? this.audioCtx.state : 'unavailable'}`);
    }

    /**
     * 動作ログの内部ディスパッチ
     * @private
     */
    _log(type, msg, meta = {}) {
        if (typeof this.onLogCallback === 'function') {
            this.onLogCallback(type, msg, meta);
        }
    }

    /**
     * WebUICore インスタンスへ接続し、fx_trigger (Visual FX / Combat FX) を購読
     * @param {Object} core 
     */
    attachCore(core) {
        if (!core || typeof core.on !== 'function') return;
        this.core = core;
        if (this._fxTriggerHandler && typeof core.off === 'function') {
            core.off('fx_trigger', this._fxTriggerHandler);
        }
        this._fxTriggerHandler = (fx) => this.handleFxTrigger(fx);
        core.on('fx_trigger', this._fxTriggerHandler);
        this._log('CORE_ATTACHED', 'SoundEngine attached to WebUICore fx_trigger');
    }

    /**
     * Visual FX (fx_trigger) 連動の効果音発火
     * メッセージ由来と同一フレームや直近での多重発火は enqueueSound の cooldownMs により防止
     * @param {Object} fx 
     * @returns {Object|null}
     */
    handleFxTrigger(fx) {
        if (!fx || !fx.type) return null;
        const mode = this.getNormalizedSoundMode();
        if (mode === 'mute') return null;

        let soundEvent = null;
        switch (fx.type) {
            case 'KILL_CONFIRMED':
                soundEvent = {
                    id: 'se_kill_monster',
                    sound: 'kill.mp3',
                    priority: 65,
                    cooldownMs: 80,
                    beep: { notes: ["G4", "C5", "E5", "G5"], wave: "triangle", duration: 80 }
                };
                break;
            case 'ATTACK_HIT':
                soundEvent = {
                    id: 'se_attack_hit',
                    sound: 'hit.mp3',
                    priority: 50,
                    cooldownMs: 100,
                    beep: { notes: ["E5", "G5"], wave: "square", duration: 50 }
                };
                break;
            case 'DAMAGE_TAKEN':
                soundEvent = {
                    id: 'se_player_damaged',
                    sound: 'damaged.mp3',
                    priority: 70,
                    cooldownMs: 100,
                    beep: { notes: ["F3", "C#3"], wave: "square", duration: 80 }
                };
                break;
            default:
                break;
        }

        if (soundEvent) {
            this._log('FX_TRIGGER_SE', `FX Trigger: ${fx.type} -> ${soundEvent.id}`, { fx, soundEvent });
            this.enqueueSound(soundEvent);
            return soundEvent;
        }
        return null;
    }

    /**
     * MessageContext に基づく決定論的 SE 発火 (O(1)) と Audio Queue によるスタガード再生
     * 
     * @param {Object} [context] - Wasm/Core が同定した MessageContext
     * @param {string} [fallbackText=''] - 未マッピング時のフォールバック用テキスト (翻訳文または rawText)
     * @returns {Object|null} 発火した効果音情報オブジェクト、または null
     */
    processMessageContext(context, fallbackText = '') {
        const mode = this.getNormalizedSoundMode();
        if (mode === 'mute') return null;

        if (context) {
            // 1. 動的音程シンセシス (DYNAMIC_SYNTH_HANDLERS)
            const synthHandler = DYNAMIC_SYNTH_HANDLERS[context.messageId];
            if (typeof synthHandler === 'function') {
                const synthDef = synthHandler(context.placeholders || [], context);
                if (synthDef) {
                    this._log('MATCH_SYNTH', `Dynamic synth matched: ${context.messageId}`, { synthDef, context });
                    return this.enqueueSound({
                        id: `synth_${context.messageId}`,
                        synth: synthDef,
                        priority: 70
                    }, context);
                }
            }

            // 2. 決定論的 SE マップ (SOUND_EVENT_MAP) O(1) 照合
            let eventDef = SOUND_EVENT_MAP[context.messageId];
            if (!eventDef && context.metadata?.soundId) {
                eventDef = SOUND_EVENT_MAP[context.metadata.soundId];
            }

            if (eventDef) {
                const rule = this._resolveRuleFromEventDef(eventDef);
                this._log('MATCH_CONTEXT', `O(1) Matched: ${context.messageId} -> ${rule.id} (priority: ${rule.priority})`, { rule, context });
                return this.enqueueSound(rule, context);
            }
        }

        // 3. 未マッピングまたは context 無し時の安全ネット（英語生テキストフォールバック）
        const textToMatch = (context ? context.rawText : '') || fallbackText;
        this._log('FALLBACK_TEXT', `No O(1) mapping found. Falling back to regex test: "${textToMatch}"`);
        return this.processLogMessage(textToMatch);
    }

    /**
     * SOUND_EVENT_MAP のイベント定義から rules 互換の rule オブジェクトを導出
     * @private
     */
    _resolveRuleFromEventDef(eventDef) {
        const existing = this.rules.find(r => r.id === eventDef.seId);
        return {
            id: eventDef.seId,
            sound: eventDef.sound || existing?.sound,
            beep: eventDef.beep || existing?.beep,
            priority: eventDef.priority !== undefined ? eventDef.priority : 50,
            cooldownMs: eventDef.cooldownMs || existing?.cooldownMs
        };
    }

    /**
     * SE を Audio Queue に投入し、優先度順ソート＆スタガード遅延再生を開始
     * @param {Object} rule - SE ルール定義
     * @param {Object} [context=null] - 発火元 MessageContext
     * @returns {Object|null}
     */
    enqueueSound(ruleOrDef, context = null) {
        if (!ruleOrDef) return null;

        const mode = this.getNormalizedSoundMode();
        if (mode === 'mute') return null;

        // 文字列 (id) または オブジェクト の両方を受け入れ
        const ruleObj = typeof ruleOrDef === 'string' ? { id: ruleOrDef } : { ...ruleOrDef };
        const ruleId = ruleObj.id || ruleObj.seId;

        // 1. 既存 rules および SOUND_EVENT_MAP から定義を補完
        const existingRule = this.rules.find(r => r.id === ruleId);
        const catalogDef = SOUND_EVENT_MAP[ruleId] || (context?.messageId ? SOUND_EVENT_MAP[context.messageId] : null);

        const rule = {
            id: ruleId,
            sound: ruleObj.sound || catalogDef?.sound || existingRule?.sound,
            beep: ruleObj.beep || catalogDef?.beep || existingRule?.beep,
            synth: ruleObj.synth || catalogDef?.synth || existingRule?.synth,
            priority: ruleObj.priority !== undefined ? ruleObj.priority : (catalogDef?.priority !== undefined ? catalogDef.priority : (existingRule?.priority !== undefined ? existingRule.priority : 50)),
            cooldownMs: ruleObj.cooldownMs || catalogDef?.cooldownMs || existingRule?.cooldownMs
        };

        const now = Date.now();
        if (rule.cooldownMs) {
            const lastTime = this.cooldownMap.get(rule.id) || 0;
            if (now - lastTime < rule.cooldownMs) return null;
            this.cooldownMap.set(rule.id, now);
        }

        const priority = rule.priority;
        const queueItem = {
            rule,
            context,
            priority,
            timestamp: now
        };

        this.audioQueue.push(queueItem);
        // 優先度降順ソート（同じ優先度なら先着順）
        this.audioQueue.sort((a, b) => b.priority - a.priority);

        this._log('ENQUEUE_SE', `Enqueued: ${rule.id} (priority: ${priority}) [Queue size: ${this.audioQueue.length}]`, { queueItem, queueSize: this.audioQueue.length });

        // キュー処理ループの起動
        if (!this.isProcessingQueue) {
            this._processAudioQueue();
        }

        return {
            id: rule.id,
            sound: rule.sound,
            priority,
            context
        };
    }

    /**
     * Audio Queue をスタガード遅延 (50〜80ms) を挟みながら順次再生
     * @private
     */
    async _processAudioQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.audioQueue.length > 0) {
            const item = this.audioQueue.shift();
            if (item && item.rule) {
                this._log('PLAY_QUEUE_ITEM', `Playing queue item: ${item.rule.id} (priority: ${item.priority}) [Remaining: ${this.audioQueue.length}]`, { item });
                if (item.rule.synth) {
                    this.playSynth(item.rule.synth);
                } else {
                    await this.playSoundByRule(item.rule);
                }
            }

            if (this.audioQueue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.staggerIntervalMs));
            }
        }

        this.isProcessingQueue = false;
    }

    /**
     * 動的音程シンセシスのオシレーター発音
     * @param {Object} synthDef
     */
    playSynth(synthDef) {
        if (typeof window === 'undefined' || !synthDef) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!this.audioCtx) {
            this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = synthDef.wave || 'triangle';
        osc.frequency.value = synthDef.freq || 440;

        const now = this.audioCtx.currentTime;
        const dur = (synthDef.duration || 100) / 1000;
        const userVol = (this.volume / 100);
        const maxGain = userVol * (synthDef.gain !== undefined ? synthDef.gain : 1.0) * 0.25;

        gain.gain.setValueAtTime(maxGain, now);
        if (synthDef.decay === 'exponential') {
            gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        } else {
            gain.gain.linearRampToValueAtTime(0, now + dur);
        }

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + dur);
    }

    /**
     * Wasmからのメッセージログを受け取り、正規表現マッチした効果音を自動トリガー
     *
     * @param {string} text - メッセージテキスト
     * @returns {Object|null} マッチしたルールオブジェクトまたは null
     */
    processLogMessage(text) {
        if (!text) return null;

        const mode = this.getNormalizedSoundMode();
        if (mode === 'mute') return null;

        const now = Date.now();

        for (const rule of this.rules) {
            if (rule.cooldownMs) {
                const lastTime = this.cooldownMap.get(rule.id) || 0;
                if (now - lastTime < rule.cooldownMs) continue;
            }

            const regex = new RegExp(rule.pattern, 'i');
            if (regex.test(text)) {
                if (rule.cooldownMs) this.cooldownMap.set(rule.id, now);
                this.playSoundByRule(rule);
                return {
                    id: rule.id,
                    sound: rule.sound,
                    pattern: rule.pattern,
                    matchedText: text
                };
            }
        }
        return null;
    }

    /**
     * ルールに従って効果音を再生 (Auto, Wave, Beep, Mute の各モード別の厳格な動作)
     */
    async playSoundByRule(rule) {
        const mode = this.getNormalizedSoundMode();
        if (mode === 'mute') return;

        if (mode === 'beep') {
            // Beep専用モード: 音声ファイルは完全に無視し、Beep音のみ再生
            if (rule.beep) this.playBeep(rule.beep);
            return;
        }

        if (mode === 'wave') {
            // Wave専用モード: 音声ファイルのみ再生。無ければ再生しない
            if (rule.sound) this.playAudioFile(rule.sound);
            return;
        }

        if (mode === 'auto') {
            // Auto (ハイブリッド) モード:
            // 音声ファイルが存在すれば Wave を再生、存在しない(または探査失敗)場合は Beep でフォールバック再生
            if (rule.sound && !this.failedAssetCache.has(rule.sound)) {
                const played = await this.playAudioFile(rule.sound);
                if (!played && rule.beep) {
                    this.playBeep(rule.beep);
                }
            } else if (rule.beep) {
                this.playBeep(rule.beep);
            }
        }
    }

    async playAudioFile(filename) {
        if (!filename || this.failedAssetCache.has(filename)) return false;

        const candidatePaths = [
            this.soundDir + filename,
            '../' + this.soundDir + filename,
            '../../' + this.soundDir + filename,
            '/' + this.soundDir + filename,
            'assets/sounds/' + filename,
            '../assets/sounds/' + filename
        ];
        const uniquePaths = Array.from(new Set(candidatePaths));

        // 1. Howler.js が存在する場合は Howler を優先
        if (typeof window !== 'undefined' && window.Howl) {
            return new Promise((resolve) => {
                const sound = new window.Howl({
                    src: uniquePaths,
                    volume: (this.volume / 100),
                    onloaderror: () => {
                        this.failedAssetCache.add(filename);
                        resolve(false);
                    },
                    onplay: () => {
                        resolve(true);
                    }
                });
                sound.play();
            });
        }

        // 2. 標準 HTML5 Audio (HEAD 探査で 404 ログを完全防止)
        if (typeof fetch !== 'undefined') {
            for (const path of uniquePaths) {
                try {
                    const res = await fetch(path, { method: 'HEAD' });
                    if (res.ok) {
                        const audio = new Audio(path);
                        audio.volume = (this.volume / 100);
                        await audio.play();
                        return true;
                    }
                } catch (e) {}
            }
            // どの候補パスでも存在しない場合はブラックリストに登録
            this.failedAssetCache.add(filename);
        }
        return false;
    }

    playBeep(beepDef) {
        if (typeof window === 'undefined') return;

        // 1. Beepcore (sys/coremin.js) が利用可能な場合は、8bit PSG 音源を優先使用
        if (typeof window.Beepcore !== 'undefined') {
            try {
                if (!this.beepCore) {
                    this.beepCore = new window.Beepcore();
                }
                const waveTypes = ["sine", "square", "sawtooth", "triangle"];
                const waveStr = beepDef.wave || "square";
                const waveIdx = waveTypes.indexOf(waveStr) >= 0 ? waveTypes.indexOf(waveStr) : 1;

                this.beepCore.masterVolume((this.volume / 100) * 0.3);
                this.beepCore.oscSetup(waveIdx);

                if (beepDef.lfo) {
                    const lfoFreq = beepDef.lfo.freq !== undefined ? beepDef.lfo.freq : 6;
                    const lfoWaveStr = beepDef.lfo.wave || "sine";
                    const lfoWaveIdx = waveTypes.indexOf(lfoWaveStr) >= 0 ? waveTypes.indexOf(lfoWaveStr) : 0;
                    const lfoDepth = beepDef.lfo.depth !== undefined ? beepDef.lfo.depth : 20;
                    this.beepCore.lfoSetup(lfoFreq, lfoWaveIdx, lfoDepth);
                } else {
                    this.beepCore.lfoReset();
                }

                const rawNotes = beepDef.notes || ["C4"];
                const duration = beepDef.duration || 80;
                const scoreForBeep = rawNotes.map(n => ({
                    name: n,
                    Freq: typeof n === 'number' ? n : 0,
                    Vol: 1.0,
                    time: duration,
                    use: false
                }));
                scoreForBeep.push({ Freq: 0, Vol: 0, time: 100, use: false });

                const note = this.beepCore.createNote(440);
                note.on((this.volume / 100) * 0.3, 0);
                note.play(scoreForBeep, performance.now());

                const stepLoop = () => {
                    if (this.beepCore) {
                        this.beepCore.step(performance.now());
                    }
                };
                requestAnimationFrame(stepLoop);
                return;
            } catch (e) {
                console.warn("[SoundEngine] Beepcore play failed, fallback to WebAudio:", e);
            }
        }

        // 2. 標準 Web Audio API 精密 PSG / Beep 音フォールバック
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!this.audioCtx) {
            this.audioCtx = new AudioContextClass();
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const notes = beepDef.notes || ["C4"];
        const duration = (beepDef.duration || 80) / 1000;
        const wave = beepDef.wave || 'square';

        notes.forEach((note, idx) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = wave;
            osc.frequency.value = typeof note === 'number' ? note : this._noteToFreq(note);

            const startTime = this.audioCtx.currentTime + (idx * duration);
            gain.gain.setValueAtTime((this.volume / 100) * 0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    _noteToFreq(noteStr) {
        if (typeof noteStr === 'number') return noteStr;
        if (!noteStr || typeof noteStr !== 'string') return 440.0;

        const noteNames = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
        const m = noteStr.trim().match(/^([A-G][#b]?)(-?\d+)?$/i);
        if (!m) return 440.0;

        let name = m[1].toUpperCase();
        let octave = m[2] !== undefined ? parseInt(m[2], 10) : 4;

        const semitone = noteNames.indexOf(name);
        if (semitone < 0) return 440.0;

        const a0 = 27.5;
        const noteIndex = semitone + (semitone < 3 ? octave * 12 : (octave - 1) * 12);
        return a0 * Math.pow(2, noteIndex / 12);
    }
}
