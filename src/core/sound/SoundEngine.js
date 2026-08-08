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
        this.soundMode = options.soundMode || 'mute';
        this.volume = options.volume !== undefined ? options.volume : 80;
        this.soundDir = options.soundDir || 'assets/sounds/';
        this.cooldownMap = new Map();
        this.audioCtx = null;

        // メッセージ正規表現検知用デフォルトSEルール集
        this.rules = [
            {
                id: "se_welcome",
                pattern: "Welcome to NetHack|NetHackへようこそ|ようこそ",
                sound: "welcome.mp3",
                beep: { notes: ["C4", "G4", "C5", "E5"], wave: "square", duration: 90 }
            },
            {
                id: "se_drink_bad",
                pattern: "feel sick|feel a little dull|feel cold|poisoned|unhealthy|hallucinating|blind|confused|paralyzed|気分が悪|体調が悪|毒|病気|幻覚|盲目|混乱|麻痺|しびれ",
                sound: "drink_bad.mp3",
                beep: { notes: ["G3", "C#3", "C3"], wave: "sawtooth", duration: 120 }
            },
            {
                id: "se_drink_good",
                pattern: "feel better|feel much better|feel full of energy|see much clearer|feel warm|気分が良|体調が良|元気がみなぎる|はっきり見え|温かく",
                sound: "drink_good.mp3",
                beep: { notes: ["C4", "E4", "G4", "C5"], wave: "sine", duration: 70 }
            },
            {
                id: "se_eat_food",
                pattern: "eat|delicious|tasty|blecch|eating|食べた|食した|美味しい|まずい",
                sound: "eat.mp3",
                beep: { notes: ["G4", "E4", "C4"], wave: "sine", duration: 70 }
            },
            {
                id: "se_attack_hit",
                pattern: "You hit|hits|に攻撃|攻撃した|ヒット|命中|ダメージ",
                sound: "hit.mp3",
                beep: { notes: ["E5", "G5"], wave: "square", duration: 50 },
                cooldownMs: 100
            },
            {
                id: "se_attack_miss",
                pattern: "You miss|misses|外した|当たらない|空を切っ|かわし|かわさ",
                sound: "swing.mp3",
                beep: { notes: ["B4", "F4"], wave: "triangle", duration: 50 },
                cooldownMs: 100
            },
            {
                id: "se_pickup",
                pattern: "pick up|拾っ|手に入れた|拾う|取得",
                sound: "pickup.mp3",
                beep: { notes: ["C5", "E5"], wave: "sine", duration: 60 }
            },
            {
                id: "se_door",
                pattern: "door|ドア|扉|locked|鍵|開け|閉め|壊れた",
                sound: "door_lock.mp3",
                beep: { notes: ["G3", "C3"], wave: "square", duration: 80 }
            },
            {
                id: "se_read_scroll",
                pattern: "read|scroll|turns to dust|fades|巻物|読ん|唱え|灰になった|消えた",
                sound: "scroll.mp3",
                beep: { notes: ["F4", "A4", "C5"], wave: "triangle", duration: 80 }
            },
            {
                id: "se_stair",
                pattern: "stair|ladder|階段|降り|登",
                sound: "stair.mp3",
                beep: { notes: ["C4", "E4", "G4"], wave: "triangle", duration: 70 }
            }
        ];
    }

    setSoundMode(mode) {
        this.soundMode = mode;
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

        const now = Date.now();

        for (const rule of this.rules) {
            if (rule.cooldownMs) {
                const lastTime = this.cooldownMap.get(rule.id) || 0;
                if (now - lastTime < rule.cooldownMs) continue;
            }

            const regex = new RegExp(rule.pattern, 'i');
            if (regex.test(text)) {
                if (rule.cooldownMs) this.cooldownMap.set(rule.id, now);
                if (this.soundMode !== 'mute') {
                    this.playSoundByRule(rule);
                }
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
     * ルールに従って効果音を再生 (SEモードなら音声ファイル、BEEPモードならオシレーター合成音)
     */
    playSoundByRule(rule) {
        if (this.soundMode === 'se' && rule.sound) {
            this.playAudioFile(rule.sound);
        } else if (this.soundMode === 'beep' && rule.beep) {
            this.playBeep(rule.beep);
        }
    }

    playAudioFile(filename) {
        const fullPath = this.soundDir + filename;

        // Howler.js が存在する場合は Howler を優先
        if (typeof window !== 'undefined' && window.Howl) {
            const sound = new window.Howl({
                src: [fullPath],
                volume: (this.volume / 100)
            });
            sound.play();
        } else {
            // 標準 HTML5 Audio フォールバック
            if (typeof Audio !== 'undefined') {
                const audio = new Audio(fullPath);
                audio.volume = (this.volume / 100);
                audio.play().catch(() => {});
            }
        }
    }

    playBeep(beepDef) {
        if (typeof window === 'undefined') return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        if (!this.audioCtx) {
            this.audioCtx = new AudioContext();
        }

        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const notes = beepDef.notes || ["C4"];
        const duration = (beepDef.duration || 80) / 1000;
        const wave = beepDef.wave || 'sine';

        notes.forEach((note, idx) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = wave;
            osc.frequency.value = this._noteToFreq(note);

            const startTime = this.audioCtx.currentTime + (idx * duration);
            gain.gain.setValueAtTime((this.volume / 100) * 0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    _noteToFreq(noteStr) {
        const notesMap = {
            "C3": 130.81, "C#3": 138.59, "D3": 146.83, "E3": 164.81, "F3": 174.61, "G3": 196.00, "A3": 220.00, "B3": 246.94,
            "C4": 261.63, "C#4": 277.18, "D4": 293.66, "E4": 329.63, "F4": 349.23, "G4": 392.00, "A4": 440.00, "B4": 493.88,
            "C5": 523.25, "E5": 659.25, "G5": 783.99
        };
        return notesMap[noteStr] || 440.0;
    }
}
