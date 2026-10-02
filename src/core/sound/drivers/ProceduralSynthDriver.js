/**
 * ProceduralSynthDriver.js - Web Audio API プロシージャル数式合成ドライバ
 *
 * 外部音源ファイル（MP3/WAV）を一切使わず、Web Audio API の多段オシレーターにより
 * 和音・AM変調・FM変調・アルペジオ・パルス・急激ピッチベンドをリアルタイム合成する。
 */

import { BaseAudioDriver } from './BaseAudioDriver.js';

export class ProceduralSynthDriver extends BaseAudioDriver {
    /**
     * @param {Object} [options]
     * @param {number} [options.volume=80] - 0〜100
     * @param {Function} [options.onLogCallback] - ログコールバック
     */
    constructor(options = {}) {
        super(options);
        this.audioCtx = null;
        this.onLogCallback = options.onLogCallback || null;
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
     * プロシージャルシンセ定義に従って合成発音する
     *
     * @param {Object} synthDef - シンセ定義
     * @param {number|null} [volumeOverride=null] - 一時的な音量上書き (0〜100)
     */
    play(synthDef, volumeOverride = null) {
        if (typeof window === 'undefined' || !synthDef) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!this.audioCtx) {
            this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;
        const effectiveVolume = volumeOverride !== null && volumeOverride !== undefined
            ? Math.max(0, Math.min(100, volumeOverride))
            : this.volume;
        const userVol = effectiveVolume / 100;
        const synthType = synthDef.type || 'oscillator';
        const dur = (synthDef.duration || 100) / 1000;
        const baseGain = userVol * (synthDef.gain !== undefined ? synthDef.gain : 1.0) * 0.25;

        if (typeof this.onLogCallback === 'function') {
            this.onLogCallback('PLAY_SYNTH', `Synthesizing ${synthType} (${dur * 1000}ms, gain: ${synthDef.gain !== undefined ? synthDef.gain : 1.0})`, { synthDef });
        }

        // 1. 和音合成 (Chord Synthesis: 複数オシレーター同時発振)
        if (synthType === 'chord') {
            const freqs = synthDef.freqs || [440, 554.37, 659.25];
            const wave = synthDef.wave || 'sawtooth';
            const chordGain = baseGain / Math.max(1, freqs.length);

            freqs.forEach(f => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = wave;
                osc.frequency.setValueAtTime(typeof f === 'number' ? f : this._noteToFreq(f), now);

                gain.gain.setValueAtTime(chordGain, now);
                if (synthDef.decay === 'exponential') {
                    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
                } else {
                    gain.gain.linearRampToValueAtTime(0, now + dur);
                }

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + dur);
            });
            return;
        }

        // 2. 振幅変調 (AM: LFO によるトレモロ・羽音合成)
        if (synthType === 'am') {
            const osc = this.audioCtx.createOscillator();
            const carrierGain = this.audioCtx.createGain();
            const lfo = this.audioCtx.createOscillator();
            const lfoGain = this.audioCtx.createGain();

            osc.type = synthDef.wave || 'sawtooth';
            osc.frequency.setValueAtTime(synthDef.freq || 130, now);

            lfo.type = synthDef.lfoWave || 'sine';
            lfo.frequency.setValueAtTime(synthDef.lfoFreq || 12, now);

            // AM変調: キャリアの gain を LFO で揺らす
            const lfoDepth = synthDef.lfoDepth !== undefined ? synthDef.lfoDepth : 0.8;
            carrierGain.gain.setValueAtTime(baseGain * 0.5, now);
            lfoGain.gain.setValueAtTime(baseGain * 0.5 * lfoDepth, now);

            if (synthDef.decay === 'exponential') {
                carrierGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            } else {
                carrierGain.gain.linearRampToValueAtTime(0, now + dur);
            }

            lfo.connect(lfoGain);
            try {
                lfoGain.connect(carrierGain.gain);
            } catch (e) {
                // AudioParam 接続をサポートしていないモック環境用フォールバック
                lfoGain.connect(this.audioCtx.destination);
            }

            osc.connect(carrierGain);
            carrierGain.connect(this.audioCtx.destination);

            lfo.start(now);
            lfo.stop(now + dur);
            osc.start(now);
            osc.stop(now + dur);
            return;
        }

        // 3. 周波数変調 (FM: 高速ピッチモジュレーション・バブリング音)
        if (synthType === 'fm') {
            const carrier = this.audioCtx.createOscillator();
            const modulator = this.audioCtx.createOscillator();
            const modGain = this.audioCtx.createGain();
            const masterGain = this.audioCtx.createGain();

            carrier.type = synthDef.wave || 'sine';
            carrier.frequency.setValueAtTime(synthDef.freq || 350, now);

            modulator.type = synthDef.modWave || 'sine';
            modulator.frequency.setValueAtTime(synthDef.modFreq || 24, now);
            modGain.gain.setValueAtTime(synthDef.modDepth || 150, now);

            masterGain.gain.setValueAtTime(baseGain, now);
            if (synthDef.decay === 'exponential') {
                masterGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            } else {
                masterGain.gain.linearRampToValueAtTime(0, now + dur);
            }

            modulator.connect(modGain);
            try {
                modGain.connect(carrier.frequency);
            } catch (e) {
                // AudioParam 接続未対応モック環境用フォールバック
                modGain.connect(masterGain);
            }
            carrier.connect(masterGain);
            masterGain.connect(this.audioCtx.destination);

            modulator.start(now);
            modulator.stop(now + dur);
            carrier.start(now);
            carrier.stop(now + dur);
            return;
        }

        // 4. 時系列シーケンス / アルペジオ / ファンファーレ (Sequence Synthesis)
        if (synthType === 'sequence') {
            const notes = synthDef.notes || ["C4", "E4", "G4", "C5"];
            const wave = synthDef.wave || 'triangle';
            let currentOffset = 0;

            notes.forEach((item) => {
                const noteFreq = typeof item === 'object' ? (item.freq || this._noteToFreq(item.note)) : (typeof item === 'number' ? item : this._noteToFreq(item));
                const noteDur = (typeof item === 'object' && item.duration ? item.duration : (synthDef.noteDuration || 80)) / 1000;
                const noteWave = (typeof item === 'object' && item.wave) || wave;
                const startTime = now + currentOffset;

                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = noteWave;
                osc.frequency.setValueAtTime(noteFreq, startTime);

                gain.gain.setValueAtTime(baseGain, startTime);
                if (synthDef.decay === 'exponential') {
                    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDur);
                } else {
                    gain.gain.linearRampToValueAtTime(0, startTime + noteDur);
                }

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + noteDur);

                currentOffset += noteDur;
            });
            return;
        }

        // 5. 連続短パルス (Pulses: 骨のカタカタ音)
        if (synthType === 'pulses') {
            const count = synthDef.count || 4;
            const pulseDur = (synthDef.pulseDuration || 35) / 1000;
            const pulseInterval = (synthDef.pulseInterval || 45) / 1000;
            const wave = synthDef.wave || 'square';
            const freq = synthDef.freq || 220;

            for (let i = 0; i < count; i++) {
                const startTime = now + (i * pulseInterval);
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = wave;
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(baseGain, startTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, startTime + pulseDur);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + pulseDur);
            }
            return;
        }

        // 6. 単一波形・ピッチベンド合成 (Standard Oscillator / Pitch Bend)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = synthDef.wave || 'triangle';

        const startFreq = synthDef.freq || 440;
        osc.frequency.setValueAtTime(startFreq, now);

        // 急激なピッチベンド
        if (synthDef.freqEnd && synthDef.freqEnd !== startFreq) {
            const endFreq = Math.max(1, synthDef.freqEnd);
            if (synthDef.bendCurve === 'linear') {
                osc.frequency.linearRampToValueAtTime(endFreq, now + dur);
            } else {
                osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
            }
        }

        gain.gain.setValueAtTime(baseGain, now);
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
     * ノート文字列表記または数値を周波数 (Hz) に変換する
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
