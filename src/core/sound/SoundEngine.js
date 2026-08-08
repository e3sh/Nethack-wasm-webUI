/**
 * SoundEngine.js - WebUICore サウンド統合モジュール
 *
 * Web Audio API / Howler.js による効果音(SE/WAV/MP3)およびオシレーターBeep音の再生を行う。
 * また、Wasmから届くテキストメッセージに対して正規表現パターンマッチングを行い、
 * 文脈に応じた効果音を自動再生するトリガー機能を備える。
 */

export class SoundEngine {
    /**
     * @param {Object} [options]
     * @param {string} [options.soundMode='mute'] - 'mute' | 'se' | 'beep'
     * @param {number} [options.volume=80] - 0 ~ 100
     * @param {string} [options.soundDir='assets/sounds/'] - 音声アセットパス
     */
    constructor(options = {}) {
        let activeMode = null;

        // 1. localStorage ユーザー設定を最優先で取得
        if (typeof localStorage !== 'undefined') {
            try {
                const directMode = localStorage.getItem("nethack_sound_mode");
                if (directMode) {
                    activeMode = directMode;
                } else {
                    const savedConfigStr = localStorage.getItem("nh.config");
                    if (savedConfigStr) {
                        const savedConfig = JSON.parse(savedConfigStr);
                        if (savedConfig && savedConfig.sound_mode) {
                            activeMode = savedConfig.sound_mode;
                        }
                    }
                }
            } catch (e) {}
        }

        // 2. localStorage に無ければ options.soundMode、それも無ければ 'auto'
        if (!activeMode) {
            activeMode = options.soundMode || 'auto';
        }

        this.soundMode = activeMode;
        this.volume = options.volume !== undefined ? options.volume : 80;
        this.soundDir = options.soundDir || 'assets/sounds/';
        this.cooldownMap = new Map();
        this.failedAssetCache = new Set(); // 存在しない音声アセットのブラックリスト
        this.audioCtx = null;

        // sound_mapping.json と完全同調した全16種類のデフォルトルール集
        this.rules = [
            {
                id: "se_welcome",
                pattern: "Welcome to NetHack|NetHackへようこそ|ようこそ",
                sound: "welcome.mp3",
                beep: { notes: ["C4", "E4", "G4", "C5"], wave: "square", duration: 90, lfo: { freq: 6, wave: "sine", depth: 15 } }
            },
            {
                id: "se_die",
                pattern: "^You die\\.\\.\\.|あなたは死んだ|死亡した",
                sound: "die.mp3",
                beep: { notes: ["C4", "B3", "A3", "G3", "F3", "E3", "D3", "C3"], wave: "sawtooth", duration: 150 }
            },
            {
                id: "se_hunger",
                pattern: "^You feel (hungry|weak)\\.|空腹|お腹が空いた|衰弱",
                sound: "hungry.mp3",
                beep: { notes: ["E3", "C3"], wave: "sine", duration: 150 }
            },
            {
                id: "se_trap",
                pattern: "shoots out at you|fall into a pit|bear trap|罠にかかった|落とし穴|矢が飛んできた",
                sound: "trap.mp3",
                beep: { notes: ["C6", "C3"], wave: "square", duration: 100 }
            },
            {
                id: "se_cast_fail",
                pattern: "^You fail to cast|呪文の詠唱に失敗",
                sound: "cast_fail.mp3",
                beep: { notes: ["F4", "C4"], wave: "sawtooth", duration: 100 }
            },
            {
                id: "se_cast_spell",
                pattern: "^You cast|呪文を唱えた",
                sound: "cast.mp3",
                beep: { notes: ["C4", "E4", "G4", "B4", "C5"], wave: "sine", duration: 80 }
            },
            {
                id: "se_wand_zap",
                pattern: "\\bzaps\\b|ビーム|光線|杖を振った",
                sound: "zap.mp3",
                beep: { notes: ["C6", "G5", "E5", "C5"], wave: "sawtooth", duration: 60 }
            },
            {
                id: "se_shoot_throw",
                pattern: "^You (shoot|throw)|投げた|射った|放った",
                sound: "shoot.mp3",
                beep: { notes: ["G4", "D5"], wave: "triangle", duration: 50 }
            },
            {
                id: "se_equip",
                pattern: "^You (are now wearing|put on|wield|take off|remove)|装備した|外した|身につけた|脱いだ|構えた",
                sound: "equip.mp3",
                beep: { notes: ["D4", "A4"], wave: "square", duration: 60 }
            },
            {
                id: "se_find_secret",
                pattern: "^You find a secret|隠し扉|隠し通路|を発見",
                sound: "secret.mp3",
                beep: { notes: ["C5", "E5", "G5", "C6"], wave: "sine", duration: 90 }
            },
            {
                id: "se_player_damaged",
                pattern: "(bites|hits|scratches|kicks) you|^The .* bites!|に噛みつかれた|にひっかかれた|に殴られた|攻撃を受けた|ダメージを受けた",
                sound: "damaged.mp3",
                beep: { notes: ["F3", "C#3"], wave: "square", duration: 80 },
                cooldownMs: 100
            },
            {
                id: "se_attack_hit",
                pattern: "You hit|\\bhits\\b|に攻撃|攻撃した|ヒット|命中|ダメージ|^You kill",
                sound: "hit.mp3",
                beep: { notes: ["E5", "G5"], wave: "square", duration: 50 },
                cooldownMs: 100
            },
            {
                id: "se_attack_miss",
                pattern: "You miss|\\bmisses\\b|外した|当たらない|空を切っ|かわし|かわさ",
                sound: "swing.mp3",
                beep: { notes: ["B4", "F4"], wave: "triangle", duration: 50 },
                cooldownMs: 100
            },
            {
                id: "se_drink_good",
                pattern: "feel better|feel much better|feel full of energy|see much clearer|feel warm|気分が良|体調が良|元気がみなぎる|はっきり見え|温かく",
                sound: "drink_good.mp3",
                beep: { notes: ["C4", "E4", "G4", "C5"], wave: "sine", duration: 70 }
            },
            {
                id: "se_drink_bad",
                pattern: "feel sick|feel a little dull|feel cold|poisoned|unhealthy|hallucinating|blind|confused|paralyzed|気分が悪|体調が悪|毒|病気|幻覚|盲目|混乱|麻痺|しびれ",
                sound: "drink_bad.mp3",
                beep: { notes: ["G3", "C#3", "C3"], wave: "sawtooth", duration: 120 }
            },
            {
                id: "se_drink_neutral",
                pattern: "\\bdrink\\b|\\bquaff\\b|\\bchug\\b|potion|tastes|ポーション|飲み|飲んだ|味わっ|呑み|味がした|味がする",
                sound: "chug.mp3",
                beep: { notes: ["C4", "G4"], wave: "sine", duration: 80 }
            },
            {
                id: "se_eat_food",
                pattern: "\\beat\\b|\\beating\\b|delicious|tasty|blecch|食べた|食した|美味しい|まずい",
                sound: "eat.mp3",
                beep: { notes: ["G4", "E4", "C4"], wave: "sine", duration: 70 }
            },
            {
                id: "se_pickup",
                pattern: "pick up|拾っ|手に入れた|拾う|取得",
                sound: "pickup.mp3",
                beep: { notes: ["C5", "E5"], wave: "sine", duration: 60 }
            },
            {
                id: "se_door",
                pattern: "\\bdoor\\b|\\bdoors\\b|\\blocked\\b|ドア|扉|鍵|開け|閉め|壊れた",
                sound: "door_lock.mp3",
                beep: { notes: ["G3", "C3"], wave: "square", duration: 80 }
            },
            {
                id: "se_read_scroll",
                pattern: "\\bread\\b|\\bscroll\\b|turns to dust|fades|巻物|読ん|唱え|灰になった|消えた",
                sound: "scroll.mp3",
                beep: { notes: ["F4", "A4", "C5"], wave: "triangle", duration: 80 }
            },
            {
                id: "se_stair",
                pattern: "\\bstair\\b|\\bstairs\\b|\\bladder\\b|階段|降り|登",
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
