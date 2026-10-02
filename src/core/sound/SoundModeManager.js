/**
 * SoundModeManager.js - サウンドモード＆音量管理モジュール
 *
 * サウンド再生モード (auto / wave / se / beep / mute) および音量 (0〜100) を統括する。
 * localStorage の 'nh.config' 設定との双方向永続化を自動管理する。
 */

export class SoundModeManager {
    /**
     * @param {Object} [options]
     * @param {string} [options.soundMode] - 'auto' | 'wave' | 'se' | 'beep' | 'mute'
     * @param {number} [options.volume] - 0〜100
     * @param {Function} [options.onModeChange] - モード変更時コールバック
     * @param {Function} [options.onVolumeChange] - 音量変更時コールバック
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
        this.onModeChange = options.onModeChange || null;
        this.onVolumeChange = options.onVolumeChange || null;
    }

    /**
     * サウンドモードを設定し、localStorage (nh.config) に永続化する
     *
     * @param {string} mode - 'auto' | 'wave' | 'se' | 'beep' | 'mute'
     */
    setSoundMode(mode) {
        this.soundMode = mode;
        if (typeof localStorage !== 'undefined') {
            try {
                let config = {};
                const saved = localStorage.getItem("nh.config");
                if (saved) config = JSON.parse(saved) || {};
                config.sound_mode = mode;
                localStorage.setItem("nh.config", JSON.stringify(config));
            } catch (e) {}
        }
        if (typeof this.onModeChange === 'function') {
            this.onModeChange(this.soundMode, this.getNormalizedSoundMode());
        }
    }

    /**
     * 設定値を標準化されたモード ('auto' | 'wave' | 'beep' | 'mute') に正規化
     *
     * @returns {string}
     */
    getNormalizedSoundMode() {
        const mode = (this.soundMode || '').toLowerCase();
        if (mode === 'auto') return 'auto';
        if (mode === 'wave' || mode === 'se') return 'wave';
        if (mode === 'beep') return 'beep';
        return 'mute';
    }

    /**
     * 音量を設定し、localStorage (nh.config) に永続化する
     *
     * @param {number} vol - 0〜100
     */
    setVolume(vol) {
        let v = parseInt(vol, 10);
        if (isNaN(v)) v = 80;
        this.volume = Math.max(0, Math.min(100, v));

        if (typeof localStorage !== 'undefined') {
            try {
                let config = {};
                const saved = localStorage.getItem("nh.config");
                if (saved) config = JSON.parse(saved) || {};
                config.sound_volume = this.volume;
                localStorage.setItem("nh.config", JSON.stringify(config));
            } catch (e) {}
        }
        if (typeof this.onVolumeChange === 'function') {
            this.onVolumeChange(this.volume);
        }
    }

    /**
     * 現在の音量 (0〜100) を取得
     * @returns {number}
     */
    getVolume() {
        return this.volume;
    }

    /**
     * 現在のモード文字列を取得
     * @returns {string}
     */
    getMode() {
        return this.soundMode;
    }
}
