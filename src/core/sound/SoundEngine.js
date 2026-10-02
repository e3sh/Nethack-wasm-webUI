/**
 * SoundEngine.js - WebUICore サウンド統合モジュール (完全後方互換ラッパー)
 *
 * ROADMAP 1.1 Phase 6 に基づき、アーキテクチャ本体は統合サウンドコーディネーター
 * (SoundCoordinator) およびマルチドライバ層へ分離・昇華されました。
 *
 * 本クラスは既存の WebUICore、クライアント UI、テストベンチに対する
 * 100% 互換ファサードとして機能します。
 */

import { SoundCoordinator } from './SoundCoordinator.js';
import { SOUND_EVENT_MAP, DYNAMIC_SYNTH_HANDLERS } from './SoundEventCatalog.js';

export { SOUND_EVENT_MAP, DYNAMIC_SYNTH_HANDLERS };

export class SoundEngine extends SoundCoordinator {
    /**
     * @param {Object} [options]
     * @param {string} [options.soundMode='auto'] - 'auto' | 'wave' | 'se' | 'beep' | 'mute'
     * @param {number} [options.volume=80] - 0 ~ 100
     * @param {string} [options.soundDir='assets/sounds/'] - 音声アセットパス
     * @param {number} [options.staggerIntervalMs=60] - Audio Queue スタガード再生間隔(ms)
     * @param {Array} [options.rules] - ルール定義配列
     * @param {Function} [options.onLogCallback] - ログコールバック
     * @param {Object} [options.drivers] - カスタムドライバ
     */
    constructor(options = {}) {
        super(options);
    }

    /**
     * ノート文字列表記または数値を周波数 (Hz) に変換する互換ヘルパー
     *
     * @param {string|number} noteStr
     * @returns {number}
     */
    _noteToFreq(noteStr) {
        if (this.drivers?.beep && typeof this.drivers.beep._noteToFreq === 'function') {
            return this.drivers.beep._noteToFreq(noteStr);
        }
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
