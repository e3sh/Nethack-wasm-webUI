/**
 * PsgBeepDriver.js - 8-bit レトロ PSG 効果音再生ドライバ
 *
 * Beepcore (sys/coremin.js) による PSG 音源エミュレーション、
 * または Web Audio API の矩形波オシレーターによる Beep 音合成を担当する。
 */

import { BaseAudioDriver } from './BaseAudioDriver.js';

export class PsgBeepDriver extends BaseAudioDriver {
    /**
     * @param {Object} [options]
     * @param {number} [options.volume=80] - 0〜100
     */
    constructor(options = {}) {
        super(options);
        this.beepCore = null;
        this.audioCtx = null;
    }

    /**
     * オーディオコンテキストのロック解除
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
    }

    /**
     * Beep定義に従って発音する
     *
     * @param {Object} beepDef - Beep 定義オブジェクト
     * @param {string[]|number[]} [beepDef.notes] - 音階配列 (例: ["C4", "E4"])
     * @param {string} [beepDef.wave='square'] - 波形タイプ
     * @param {number} [beepDef.duration=80] - 1音あたりの発音ミリ秒
     * @param {Object} [beepDef.lfo] - LFO設定 ({ freq, wave, depth })
     * @param {number|null} [volumeOverride=null] - 一時的な音量上書き (0〜100)
     */
    play(beepDef, volumeOverride = null) {
        if (typeof window === 'undefined' || !beepDef) return;

        const effectiveVolume = volumeOverride !== null && volumeOverride !== undefined
            ? Math.max(0, Math.min(100, volumeOverride))
            : this.volume;
        const normalizedVol = effectiveVolume / 100;

        // 1. Beepcore (sys/coremin.js) が利用可能な場合は 8bit PSG 音源を優先使用
        if (typeof window.Beepcore !== 'undefined') {
            try {
                if (!this.beepCore) {
                    this.beepCore = new window.Beepcore();
                }
                const waveTypes = ["sine", "square", "sawtooth", "triangle"];
                const waveStr = beepDef.wave || "square";
                const waveIdx = waveTypes.indexOf(waveStr) >= 0 ? waveTypes.indexOf(waveStr) : 1;

                this.beepCore.masterVolume(normalizedVol * 0.3);
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
                note.on(normalizedVol * 0.3, 0);
                note.play(scoreForBeep, performance.now());

                const stepLoop = () => {
                    if (this.beepCore) {
                        this.beepCore.step((typeof performance !== 'undefined' ? performance : Date).now());
                    }
                };
                if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(stepLoop);
                } else if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(stepLoop);
                }
                return;
            } catch (e) {
                console.warn("[PsgBeepDriver] Beepcore play failed, fallback to WebAudio:", e);
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
            gain.gain.setValueAtTime(normalizedVol * 0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    /**
     * ノート文字列表記（例: 'C4', 'A#3'）または数値を周波数 (Hz) に変換する
     *
     * @param {string|number} noteStr
     * @returns {number}
     */
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
