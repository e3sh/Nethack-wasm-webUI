/**
 * PsgBeepDriver.js - 8-bit レトロ PSG 効果音再生ドライバ
 *
 * Web Audio API のオシレーターによる Beep 音合成を担当する。
 * LFO によるビブラート(周波数変調)にも対応する。
 */

import { BaseAudioDriver } from './BaseAudioDriver.js';

export class PsgBeepDriver extends BaseAudioDriver {
    /**
     * @param {Object} [options]
     * @param {number} [options.volume=80] - 0〜100
     */
    constructor(options = {}) {
        super(options);
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
     * @param {Object} [beepDef.lfo] - LFO設定 ({ freq: Hz, wave, depth: 周波数の揺れ幅 Hz })
     * @param {number|null} [volumeOverride=null] - 一時的な音量上書き (0〜100)
     */
    play(beepDef, volumeOverride = null) {
        if (typeof window === 'undefined' || !beepDef) return;

        const effectiveVolume = volumeOverride !== null && volumeOverride !== undefined
            ? Math.max(0, Math.min(100, volumeOverride))
            : this.volume;
        const normalizedVol = effectiveVolume / 100;

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
        const lfoDef = beepDef.lfo;

        notes.forEach((note, idx) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = wave;
            osc.frequency.value = typeof note === 'number' ? note : this._noteToFreq(note);

            const startTime = this.audioCtx.currentTime + (idx * duration);
            gain.gain.setValueAtTime(normalizedVol * 0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

            // LFO: オシレーター周波数を揺らす(ビブラート)
            if (lfoDef) {
                const lfo = this.audioCtx.createOscillator();
                const lfoGain = this.audioCtx.createGain();
                lfo.type = lfoDef.wave || 'sine';
                lfo.frequency.value = lfoDef.freq !== undefined ? lfoDef.freq : 6;
                lfoGain.gain.value = lfoDef.depth !== undefined ? lfoDef.depth : 20;
                lfo.connect(lfoGain);
                try {
                    lfoGain.connect(osc.frequency);
                } catch (e) {
                    // AudioParam 接続非対応環境では LFO を無効化
                }
                lfo.start(startTime);
                lfo.stop(startTime + duration);
            }

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
