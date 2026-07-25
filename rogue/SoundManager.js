//============================================
// SoundManager.js - NetHack WebUI Sound System
//============================================

class SoundManagerClass {
    constructor() {
        this.initialized = false;
        this.soundMode = "mute"; // 初回起動時のデフォルトは OFF (消音)
        this.volume = 80; // 0 - 100
        this.soundDir = "assets/sounds/";
        this.cooldownMap = new Map(); // rule.id -> timestamp
        this.audioCtx = null;
        this.beepCore = null;
        this.isBeepRunning = false;
        this.onLogCallback = null;

        // デフォルトの基本ルール (JSON読み込み前/遅延時にも0秒で動作可能)
        this.defaultRuleData = [
            {
                id: "se_welcome",
                pattern: "Welcome to NetHack|NetHackへようこそ|ようこそ",
                sound: "welcome.mp3",
                beep: { notes: ["C4", "G4", "C5", "E5"], wave: "square", duration: 90 },
                volume: 90
            },
            {
                id: "se_drink_bad",
                pattern: "feel sick|feel a little dull|feel cold|poisoned|unhealthy|hallucinating|blind|confused|paralyzed|気分が悪|体調が悪|毒|病気|幻覚|盲目|混乱|麻痺|しびれ",
                sound: "drink_bad.mp3",
                beep: { notes: ["G3", "C#3", "C3"], wave: "sawtooth", duration: 120 },
                volume: 90
            },
            {
                id: "se_drink_good",
                pattern: "feel better|feel much better|feel full of energy|see much clearer|feel warm|気分が良|体調が良|元気がみなぎる|はっきり見え|温かく",
                sound: "drink_good.mp3",
                beep: { notes: ["C4", "E4", "G4", "C5"], wave: "sine", duration: 70 },
                volume: 85
            },
            {
                id: "se_drink_neutral",
                pattern: "drink|quaff|chug|potion|tastes|ポーション|飲み|飲んだ|味わっ|呑み|味がした|味がする",
                sound: "chug.mp3",
                beep: { notes: ["C4", "G4"], wave: "sine", duration: 80 },
                volume: 80
            },
            {
                id: "se_eat_food",
                pattern: "eat|delicious|tasty|blecch|eating|食べた|食した|美味しい|まずい",
                sound: "eat.mp3",
                beep: { notes: ["G4", "E4", "C4"], wave: "sine", duration: 70 },
                volume: 80
            },
            {
                id: "se_attack_hit",
                pattern: "You hit|hits|に攻撃|攻撃した|ヒット|命中|ダメージ",
                sound: "hit.mp3",
                beep: { notes: ["E5", "G5"], wave: "square", duration: 50 },
                volume: 80,
                cooldownMs: 100
            },
            {
                id: "se_attack_miss",
                pattern: "You miss|misses|外した|当たらない|空を切っ|かわし|かわさ",
                sound: "swing.mp3",
                beep: { notes: ["B4", "F4"], wave: "triangle", duration: 50 },
                volume: 75,
                cooldownMs: 100
            },
            {
                id: "se_pickup",
                pattern: "pick up|拾っ|手に入れた|拾う|取得",
                sound: "pickup.mp3",
                beep: { notes: ["C5", "E5"], wave: "sine", duration: 60 },
                volume: 80
            },
            {
                id: "se_door",
                pattern: "door|ドア|扉|locked|鍵|開け|閉め|壊れた|resists|crashes",
                sound: "door_lock.mp3",
                beep: { notes: ["G3", "C3"], wave: "square", duration: 80 },
                volume: 90
            },
            {
                id: "se_read_scroll",
                pattern: "read|scroll|turns to dust|fades|disappears|巻物|読ん|唱え|灰になった|消えた",
                sound: "scroll.mp3",
                beep: { notes: ["F4", "A4", "C5"], wave: "triangle", duration: 80 },
                volume: 80
            },
            {
                id: "se_stair",
                pattern: "stair|ladder|階段|降り|登",
                sound: "stair.mp3",
                beep: { notes: ["C4", "E4", "G4"], wave: "triangle", duration: 70 },
                volume: 80
            }
        ];

        // 初期ルールセットを生成
        this.rules = this.defaultRuleData.map(r => ({
            ...r,
            regex: new RegExp(r.pattern, "i")
        }));

        // 音階(音名 -> 周波数Hz) マッピング
        this.noteFreqs = {
            "C2": 65.41, "C#2": 69.30, "D2": 73.42, "D#2": 77.78, "E2": 82.41, "F2": 87.31, "F#2": 92.50, "G2": 98.00, "G#2": 103.83, "A2": 110.00, "A#2": 116.54, "B2": 123.47,
            "C3": 130.81, "C#3": 138.59, "D3": 146.83, "D#3": 155.56, "E3": 164.81, "F3": 174.61, "F#3": 185.00, "G3": 196.00, "G#3": 207.65, "A3": 220.00, "A#3": 233.08, "B3": 246.94,
            "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88,
            "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99, "G#5": 830.61, "A5": 880.00, "A#5": 932.33, "B5": 987.77,
            "C6": 1046.50, "D6": 1174.66, "E6": 1318.51, "G6": 1567.98, "C7": 2093.00
        };

        // 即座にフェッチ開始
        this.init();
    }

    log(type, msg) {
        const entry = `[${new Date().toLocaleTimeString()}] [${type}] ${msg}`;
        console.log(entry);
        if (typeof this.onLogCallback === 'function') {
            this.onLogCallback(type, msg, entry);
        }
    }

    loadSettings() {
        if (!localStorage.getItem("nethack_sound_mode") && !localStorage.getItem("nh.config")) {
            this.soundMode = "mute";
        }
        try {
            const nhConfigStr = localStorage.getItem("nh.config");
            if (nhConfigStr) {
                const nhConfig = JSON.parse(nhConfigStr);
                if (nhConfig.sound_mode !== undefined) this.soundMode = nhConfig.sound_mode;
                if (nhConfig.sound_volume !== undefined) this.volume = parseInt(nhConfig.sound_volume, 10);
            }
        } catch (e) {}

        const directMode = localStorage.getItem("nethack_sound_mode");
        if (directMode) this.soundMode = directMode;

        const directVol = localStorage.getItem("nethack_sound_volume");
        if (directVol) this.volume = parseInt(directVol, 10);
    }

    async init() {
        this.loadSettings();

        try {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass && !this.audioCtx) {
                this.audioCtx = new AudioCtxClass();
            }

            if (typeof Beepcore !== 'undefined' && !this.beepCore) {
                this.beepCore = new Beepcore();
            }

            const res = await fetch("sound_mapping.json");
            if (res.ok) {
                const data = await res.json();
                this.soundDir = data.soundDir || "assets/sounds/";
                if (data.rules && Array.isArray(data.rules)) {
                    this.rules = data.rules.map(r => ({
                        ...r,
                        regex: new RegExp(r.pattern, "i")
                    }));
                }
            }
            this.initialized = true;
            this.log("INFO", `Initialized. Mode: ${this.soundMode}, Volume: ${this.volume}%, Active Rules: ${this.rules.length}`);
        } catch (e) {
            this.log("ERROR", `Init fetch error: ${e.message || e}`);
        }
    }

    unlockAudio() {
        if (!this.audioCtx) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => {
                this.log("AUDIO", "AudioContext resumed successfully.");
            }).catch(e => this.log("ERROR", `AudioContext resume failed: ${e}`));
        }
    }

    setMode(mode) {
        this.soundMode = mode;
        localStorage.setItem("nethack_sound_mode", mode);
        try {
            const nhConfig = JSON.parse(localStorage.getItem("nh.config") || "{}");
            nhConfig.sound_mode = mode;
            localStorage.setItem("nh.config", JSON.stringify(nhConfig));
        } catch(e) {}
        this.log("CONFIG", `Sound mode set to: ${mode}`);
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(100, vol));
        localStorage.setItem("nethack_sound_volume", this.volume);
        try {
            const nhConfig = JSON.parse(localStorage.getItem("nh.config") || "{}");
            nhConfig.sound_volume = this.volume;
            localStorage.setItem("nh.config", JSON.stringify(nhConfig));
        } catch(e) {}
        this.log("CONFIG", `Volume set to: ${this.volume}%`);
    }

    getNormVolume(volPercent) {
        return Math.max(0, Math.min(100, volPercent)) / 100;
    }

    processMessage(msg) {
        if (!msg || this.soundMode === "mute") return;

        this.unlockAudio(); // メッセージ受信時に即座に AudioContext のアクティブ状態を確保
        this.loadSettings();

        const cleanMsg = String(msg).trim();
        if (!cleanMsg) return;

        const now = Date.now();
        let matched = false;

        for (const rule of this.rules) {
            if (rule.regex.test(cleanMsg)) {
                matched = true;
                if (rule.cooldownMs) {
                    const lastTime = this.cooldownMap.get(rule.id) || 0;
                    if (now - lastTime < rule.cooldownMs) {
                        this.log("MATCH", `Matched [${rule.id}] but skipped due to cooldown (${rule.cooldownMs}ms)`);
                        continue;
                    }
                }
                this.cooldownMap.set(rule.id, now);
                this.log("MATCH", `Matched rule [${rule.id}] for msg: "${cleanMsg}"`);
                this.playSoundRule(rule);
                break;
            }
        }

        if (!matched) {
            this.log("NO_MATCH", `No rule matched for msg: "${cleanMsg}"`);
        }
    }

    playSoundRule(rule) {
        const baseRuleVol = rule.volume !== undefined ? rule.volume : 80;
        const effectiveVolume = (baseRuleVol / 100) * this.volume; // 0 - 100
        if (effectiveVolume <= 0) return;

        let targetType = this.soundMode; // "auto", "wave", "beep"
        if (targetType === "auto") {
            const pref = rule.preferredType || "auto";
            if (pref === "beep") {
                targetType = "beep";
            } else if (pref === "wave") {
                targetType = "wave";
            } else {
                targetType = rule.sound ? "wave" : "beep";
            }
        }

        if (targetType === "wave" && rule.sound) {
            this.playWave(rule.sound, effectiveVolume, () => {
                this.log("WARN", `Wave load/playback failed for [${rule.sound}], falling back to Beep`);
                if (rule.beep) {
                    this.playBeep(rule.beep, effectiveVolume);
                }
            });
        } else if (targetType === "beep" || (targetType === "wave" && !rule.sound)) {
            if (rule.beep) {
                this.playBeep(rule.beep, effectiveVolume);
            }
        }
    }

    async playWave(soundFile, volPercent, onFail) {
        this.unlockAudio();
        const path = soundFile.includes("/") ? soundFile : `${this.soundDir}${soundFile}`;
        const normVol = this.getNormVolume(volPercent);
        this.log("PLAY_WAVE", `Playing Audio: ${path} (Vol: ${Math.round(volPercent)}%)`);

        try {
            const audio = new Audio();
            audio.src = path;
            audio.volume = Math.max(0, Math.min(1, normVol));

            let hasFailed = false;

            audio.onerror = () => {
                if (!hasFailed) {
                    hasFailed = true;
                    this.log("ERROR", `Audio element error (File not found or invalid format) for ${path}`);
                    if (onFail) onFail();
                }
            };

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.log("PLAY_WAVE", `Successfully started playing ${path}`);
                }).catch(err => {
                    this.log("WARN", `Audio play promise rejected for ${path}: ${err.message || err}`);
                    if (!hasFailed && (err.name === 'NotSupportedError' || (audio.error && audio.error.code === 4))) {
                        hasFailed = true;
                        if (onFail) onFail();
                    }
                });
            }
        } catch (e) {
            this.log("ERROR", `Exception playing wave ${path}: ${e.message || e}`);
            if (onFail) onFail();
        }
    }

    playBeep(beepConfig, volPercent) {
        this.unlockAudio();
        const targetVol = volPercent !== undefined ? volPercent : this.volume;
        const normVol = this.getNormVolume(targetVol); // 0.0 ~ 1.0

        if (normVol <= 0) return;

        const notes = beepConfig.notes || ["C5"];
        const duration = beepConfig.duration || 80;
        const wave = beepConfig.wave || "square";

        this.log("PLAY_BEEP", `Playing Beep: notes=[${notes.join(", ")}], wave=${wave}, duration=${duration}ms, vol=${Math.round(targetVol)}%`);

        // 1. Beepcore class from sys/coremin.js
        if (typeof Beepcore !== 'undefined') {
            try {
                if (!this.beepCore) {
                    this.beepCore = new Beepcore();
                }
                const waveTypes = ["sine", "square", "sawtooth", "triangle"];
                const waveIdx = waveTypes.indexOf(wave) >= 0 ? waveTypes.indexOf(wave) : 1;
                
                this.beepCore.masterVolume(normVol);
                this.beepCore.oscSetup(waveIdx);

                const score = this.beepCore.makeScore(notes, duration, 1.0);
                const note = this.beepCore.createNote(440);
                note.on(normVol, 0);
                note.play(score, performance.now());

                this.startBeepLoop();
                return;
            } catch (e) {
                this.log("WARN", `Beepcore playback error: ${e.message || e}`);
            }
        }

        // 2. Direct Web Audio API Fallback
        if (!this.audioCtx) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) this.audioCtx = new AudioCtxClass();
        }

        if (this.audioCtx) {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            try {
                const masterGain = normVol * 0.2;
                let currentTime = this.audioCtx.currentTime;
                const noteDurSec = duration / 1000;

                notes.forEach((noteName) => {
                    let freq = 440;
                    if (typeof noteName === 'number') {
                        freq = noteName;
                    } else if (this.noteFreqs[noteName]) {
                        freq = this.noteFreqs[noteName];
                    }

                    const osc = this.audioCtx.createOscillator();
                    const gainNode = this.audioCtx.createGain();

                    osc.type = wave;
                    osc.frequency.setValueAtTime(freq, currentTime);

                    gainNode.gain.setValueAtTime(0.0001, currentTime);
                    gainNode.gain.linearRampToValueAtTime(masterGain, currentTime + 0.005);
                    gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + noteDurSec);

                    osc.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);

                    osc.start(currentTime);
                    osc.stop(currentTime + noteDurSec);

                    currentTime += noteDurSec;
                });
            } catch (e) {
                this.log("ERROR", `Direct WebAudio playBeep error: ${e.message || e}`);
            }
        }
    }

    startBeepLoop() {
        if (this.isBeepRunning) return;
        this.isBeepRunning = true;
        const loop = (now) => {
            if (this.beepCore) {
                this.beepCore.step(now);
            }
            if (this.isBeepRunning) {
                requestAnimationFrame(loop);
            }
        };
        requestAnimationFrame(loop);
    }
}

window.SoundManager = new SoundManagerClass();
