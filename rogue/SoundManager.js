//============================================
// SoundManager.js - NetHack WebUI Sound System
//============================================

class SoundManagerClass {
    constructor() {
        this.initialized = false;
        this.soundMode = "mute"; // 初回起動時のデフォルトは OFF (消音)
        this.volume = 80; // 0 - 100
        this.waveGain = 1.0; // WAV/MP3の音量ゲイン補正 (1.0 = 100%)
        this.beepGain = 0.3; // Beep合成音の音量ゲイン補正 (0.3 = 30%)
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
                beep: { notes: ["C4", "G4", "C5", "E5"], wave: "square", duration: 90, lfo: { freq: 6, wave: "sine", depth: 15 } },
                volume: 90
            },
            {
                id: "se_drink_bad",
                pattern: "feel sick|feel a little dull|feel cold|poisoned|unhealthy|hallucinating|blind|confused|paralyzed|気分が悪|体調が悪|毒|病気|幻覚|盲目|混乱|麻痺|しびれ",
                sound: "drink_bad.mp3",
                beep: { notes: ["G3", "C#3", "C3"], wave: "sawtooth", duration: 120, lfo: { freq: 12, wave: "sawtooth", depth: 30 } },
                volume: 90
            },
            {
                id: "se_drink_good",
                pattern: "feel better|feel much better|feel full of energy|see much clearer|feel warm|気分が良|体調が良|元気がみなぎる|はっきり見え|温かく",
                sound: "drink_good.mp3",
                beep: { notes: ["C4", "E4", "G4", "C5"], wave: "sine", duration: 70, lfo: { freq: 5, wave: "sine", depth: 10 } },
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
                beep: { notes: ["F4", "A4", "C5"], wave: "triangle", duration: 80, lfo: { freq: 8, wave: "triangle", depth: 15 } },
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
        const isDebug = (typeof d !== 'undefined' && d.DEBUG_MSG) || (typeof g !== 'undefined' && g.define && g.define.DEBUG) || localStorage.getItem("nethack_debug_log") === "true";
        if (isDebug) {
            console.log(entry);
        }
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

        const waveGainStr = localStorage.getItem("nethack_wave_gain");
        if (waveGainStr) this.waveGain = parseFloat(waveGainStr);

        const beepGainStr = localStorage.getItem("nethack_beep_gain");
        if (beepGainStr) this.beepGain = parseFloat(beepGainStr);
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
                if (data.waveGain !== undefined && !localStorage.getItem("nethack_wave_gain")) {
                    this.waveGain = data.waveGain;
                }
                if (data.beepGain !== undefined && !localStorage.getItem("nethack_beep_gain")) {
                    this.beepGain = data.beepGain;
                }
                if (data.rules && Array.isArray(data.rules)) {
                    this.rules = data.rules.map(r => ({
                        ...r,
                        regex: new RegExp(r.pattern, "i")
                    }));
                }
            }
            this.initialized = true;
            this.log("INFO", `Initialized. Mode: ${this.soundMode}, Volume: ${this.volume}%, WaveGain: ${Math.round(this.waveGain * 100)}%, BeepGain: ${Math.round(this.beepGain * 100)}%`);
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
        this.log("CONFIG", `Master Volume set to: ${this.volume}%`);
    }

    setWaveGain(gain) {
        this.waveGain = Math.max(0, Math.min(2.0, gain));
        localStorage.setItem("nethack_wave_gain", this.waveGain);
        this.log("CONFIG", `WAV Balance Gain set to: ${Math.round(this.waveGain * 100)}%`);
    }

    setBeepGain(gain) {
        this.beepGain = Math.max(0, Math.min(2.0, gain));
        localStorage.setItem("nethack_beep_gain", this.beepGain);
        this.log("CONFIG", `Beep Balance Gain set to: ${Math.round(this.beepGain * 100)}%`);
    }

    getNormVolume(volPercent) {
        return Math.max(0, Math.min(100, volPercent)) / 100;
    }

    processMessage(rawMsg, translatedMsg) {
        if ((!rawMsg && !translatedMsg) || this.soundMode === "mute") return;

        this.unlockAudio(); // メッセージ受信時に即座に AudioContext のアクティブ状態を確保
        this.loadSettings();

        const targets = [];
        if (rawMsg) {
            const cleanRaw = String(rawMsg).trim();
            if (cleanRaw) targets.push(cleanRaw);
        }
        if (translatedMsg && translatedMsg !== rawMsg) {
            const cleanTr = String(translatedMsg).trim();
            if (cleanTr) targets.push(cleanTr);
        }
        if (targets.length === 0) return;

        const now = Date.now();
        let matched = false;

        for (const targetMsg of targets) {
            for (const rule of this.rules) {
                if (rule.regex.test(targetMsg)) {
                    matched = true;
                    if (rule.cooldownMs) {
                        const lastTime = this.cooldownMap.get(rule.id) || 0;
                        if (now - lastTime < rule.cooldownMs) {
                            this.log("MATCH", `Matched [${rule.id}] but skipped due to cooldown (${rule.cooldownMs}ms)`);
                            continue;
                        }
                    }
                    this.cooldownMap.set(rule.id, now);
                    this.log("MATCH", `Matched rule [${rule.id}] for msg: "${targetMsg}"`);
                    this.playSoundRule(rule);
                    break;
                }
            }
            if (matched) break;
        }

        if (!matched) {
            this.log("NO_MATCH", `No rule matched for msg: "${targets.join(' | ')}"`);
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
        const normVol = this.getNormVolume(volPercent) * this.waveGain;
        this.log("PLAY_WAVE", `Playing Audio: ${path} (Vol: ${Math.round(volPercent)}%, WaveGain: ${Math.round(this.waveGain * 100)}%)`);

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

    /**
     * MML風文字列/配列/指定形式を解析し、BeepcoreおよびWebAudio互換のスコア構造配列に変換
     * @param {string|Array|number} input - MML文字列 ("O4 C4 E4 G4"), 配列 (["C4", "E4"]), カンマ区切り文字列等
     * @param {number} defaultInterval - デフォルト音長 (ms)
     * @returns {Array} score data
     */
    parseMML(input, defaultInterval = 80) {
        if (!input) return [{ name: "C5", Freq: 0, Vol: 1.0, time: defaultInterval, use: false }];

        // 配列が渡された場合
        if (Array.isArray(input)) {
            return input.map(item => {
                if (typeof item === 'object' && item.name) {
                    return { name: item.name, Freq: item.Freq || 0, Vol: item.Vol !== undefined ? item.Vol : 1.0, time: item.time || defaultInterval, use: false };
                }
                const num = Number(item);
                if (!isNaN(num) && typeof item === 'number') {
                    return { name: "", Freq: num, Vol: 1.0, time: defaultInterval, use: false };
                }
                return { name: String(item), Freq: 0, Vol: 1.0, time: defaultInterval, use: false };
            });
        }

        // 数値単体が渡された場合（例: 440）
        if (typeof input === 'number') {
            return [{ name: "", Freq: input, Vol: 1.0, time: defaultInterval, use: false }];
        }

        const str = String(input).trim();
        // MMLコマンド (O, L, V, R, T) が含まれているかチェック
        const hasMmlCmd = /[OLVRT]/i.test(str);

        if (!hasMmlCmd) {
            // カンマまたはスペース区切りの音名リスト（例: "C4 E4 G4" または "C4, E4, G4"）
            const names = str.split(/[\s,]+/).filter(Boolean);
            return names.map(name => {
                const num = Number(name);
                if (!isNaN(num) && name !== "") {
                    return { name: "", Freq: num, Vol: 1.0, time: defaultInterval, use: false };
                }
                return { name, Freq: 0, Vol: 1.0, time: defaultInterval, use: false };
            });
        }

        // MML文字列パース (Beepcore.js 準拠 + テンポBPM動的計算機能)
        let score = [];
        let octave = 4;
        let defaultLength = 4; // L4デフォルト
        let volume = 1.0;
        let currentTempo = null; // Tコマンド未指定時は null
        let p = 0;
        const mmlStr = str.toUpperCase().replace(/\s+/g, '');

        while (p < mmlStr.length) {
            let char = mmlStr[p];
            p++;

            if (char === 'O') {
                let numStr = "";
                while (p < mmlStr.length && mmlStr[p] >= '0' && mmlStr[p] <= '9') {
                    numStr += mmlStr[p];
                    p++;
                }
                if (numStr !== "") octave = parseInt(numStr, 10);
            } else if (char === 'L') {
                let numStr = "";
                while (p < mmlStr.length && mmlStr[p] >= '0' && mmlStr[p] <= '9') {
                    numStr += mmlStr[p];
                    p++;
                }
                if (numStr !== "") defaultLength = parseInt(numStr, 10);
            } else if (char === 'V') {
                let numStr = "";
                while (p < mmlStr.length && mmlStr[p] >= '0' && mmlStr[p] <= '9') {
                    numStr += mmlStr[p];
                    p++;
                }
                if (numStr !== "") volume = parseInt(numStr, 10) / 15.0;
            } else if (char === 'T') {
                let numStr = "";
                while (p < mmlStr.length && mmlStr[p] >= '0' && mmlStr[p] <= '9') {
                    numStr += mmlStr[p];
                    p++;
                }
                if (numStr !== "") {
                    const parsedBpm = parseInt(numStr, 10);
                    // 10 ~ 600 BPM の安全範囲内のみ採用
                    if (parsedBpm >= 10 && parsedBpm <= 600) {
                        currentTempo = parsedBpm;
                    }
                }
            } else if (char >= 'A' && char <= 'G') {
                let noteName = char;
                if (p < mmlStr.length && (mmlStr[p] === '#' || mmlStr[p] === '+' || mmlStr[p] === '-')) {
                    if (mmlStr[p] === '#' || mmlStr[p] === '+') noteName += '#';
                    p++;
                }
                noteName += octave;

                let noteLength = defaultLength;
                let numStr = "";
                while (p < mmlStr.length && mmlStr[p] >= '0' && mmlStr[p] <= '9') {
                    numStr += mmlStr[p];
                    p++;
                }
                if (numStr !== "") noteLength = parseInt(numStr, 10);

                let dot = 1.0;
                if (p < mmlStr.length && mmlStr[p] === '.') {
                    dot = 1.5;
                    p++;
                }

                // T指定時は 60000ms / BPM で L4基準時間を計算、未指定時は defaultInterval
                const baseInterval = (currentTempo && currentTempo > 0) ? (60000 / currentTempo) : defaultInterval;
                const playTime = (baseInterval * (4.0 / noteLength)) * dot;

                score.push({
                    name: noteName,
                    Freq: 0,
                    Vol: volume,
                    time: playTime,
                    use: false
                });
            } else if (char === 'R') {
                let noteLength = defaultLength;
                let numStr = "";
                while (p < mmlStr.length && mmlStr[p] >= '0' && mmlStr[p] <= '9') {
                    numStr += mmlStr[p];
                    p++;
                }
                if (numStr !== "") noteLength = parseInt(numStr, 10);

                let dot = 1.0;
                if (p < mmlStr.length && mmlStr[p] === '.') {
                    dot = 1.5;
                    p++;
                }

                const baseInterval = (currentTempo && currentTempo > 0) ? (60000 / currentTempo) : defaultInterval;
                const playTime = (baseInterval * (4.0 / noteLength)) * dot;

                score.push({
                    name: '',
                    Freq: 0,
                    Vol: 0,
                    time: playTime,
                    use: false
                });
            }
        }
        return score.length > 0 ? score : [{ name: "C5", Freq: 0, Vol: 1.0, time: defaultInterval, use: false }];
    }

    playBeep(beepConfig, volPercent) {
        this.unlockAudio();
        const targetVol = volPercent !== undefined ? volPercent : this.volume;
        const normVol = this.getNormVolume(targetVol) * this.beepGain; // 0.0 ~ 1.0 (beepGain 適用)

        if (normVol <= 0) return;

        const rawNotes = beepConfig.mml || beepConfig.notes || ["C5"];
        const duration = beepConfig.duration || 80;
        const wave = beepConfig.wave || "square";

        const parsedScore = this.parseMML(rawNotes, duration);

        const notesSummary = parsedScore.map(s => s.name || (s.Freq ? `${s.Freq}Hz` : "R")).join(", ");
        let lfoLogStr = "";
        if (beepConfig.lfo) {
            lfoLogStr = `, LFO=[freq:${beepConfig.lfo.freq || 6}Hz, wave:${beepConfig.lfo.wave || "sine"}, depth:${beepConfig.lfo.depth || 20}]`;
        }

        this.log("PLAY_BEEP", `Playing Beep: notes=[${notesSummary}], wave=${wave}, duration=${duration}ms${lfoLogStr}, vol=${Math.round(targetVol)}%, BeepGain=${Math.round(this.beepGain * 100)}%`);

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

                if (beepConfig.lfo) {
                    const lfoFreq = beepConfig.lfo.freq !== undefined ? beepConfig.lfo.freq : 6;
                    const lfoWaveStr = beepConfig.lfo.wave || "sine";
                    const lfoWaveIdx = waveTypes.indexOf(lfoWaveStr) >= 0 ? waveTypes.indexOf(lfoWaveStr) : 0;
                    const lfoDepth = beepConfig.lfo.depth !== undefined ? beepConfig.lfo.depth : 20;
                    this.beepCore.lfoSetup(lfoFreq, lfoWaveIdx, lfoDepth);
                } else {
                    this.beepCore.lfoReset();
                }

                // parsedScore を Beepcore の note.play 用データ構造に変換
                const scoreForBeep = parsedScore.map(item => ({
                    name: item.name,
                    Freq: item.Freq || 0,
                    Vol: item.Vol,
                    time: item.time,
                    use: false
                }));
                scoreForBeep.push({ Freq: 0, Vol: 0, time: 100, use: false });

                const note = this.beepCore.createNote(440);
                note.on(normVol, 0);
                note.play(scoreForBeep, performance.now());

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

                parsedScore.forEach((item) => {
                    const noteDurSec = (item.time || duration) / 1000;
                    let freq = item.Freq || 0;
                    if (!freq && item.name) {
                        if (this.noteFreqs[item.name]) {
                            freq = this.noteFreqs[item.name];
                        }
                    }

                    if (freq > 0 && item.Vol > 0) {
                        const osc = this.audioCtx.createOscillator();
                        const gainNode = this.audioCtx.createGain();

                        osc.type = wave;
                        osc.frequency.setValueAtTime(freq, currentTime);

                        if (beepConfig.lfo) {
                            const lfoOsc = this.audioCtx.createOscillator();
                            const lfoGain = this.audioCtx.createGain();
                            lfoOsc.type = beepConfig.lfo.wave || "sine";
                            lfoOsc.frequency.setValueAtTime(beepConfig.lfo.freq || 6, currentTime);
                            lfoGain.gain.setValueAtTime(beepConfig.lfo.depth || 20, currentTime);
                            lfoOsc.connect(lfoGain);
                            lfoGain.connect(osc.frequency);
                            lfoOsc.start(currentTime);
                            lfoOsc.stop(currentTime + noteDurSec);
                        }

                        const noteGain = masterGain * item.Vol;
                        gainNode.gain.setValueAtTime(0.0001, currentTime);
                        gainNode.gain.linearRampToValueAtTime(noteGain, currentTime + 0.005);
                        gainNode.gain.exponentialRampToValueAtTime(0.0001, currentTime + noteDurSec);

                        osc.connect(gainNode);
                        gainNode.connect(this.audioCtx.destination);

                        osc.start(currentTime);
                        osc.stop(currentTime + noteDurSec);
                    }

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
