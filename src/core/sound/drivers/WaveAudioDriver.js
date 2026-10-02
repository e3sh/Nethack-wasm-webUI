/**
 * WaveAudioDriver.js - 音声ファイル再生ドライバ (Howler.js / HTML5 Audio)
 *
 * MP3 / OGG / WAV 等の音声アセット再生を担当する。
 * Howler.js が存在する場合は優先的に使用し、無ければ HTML5 Audio にフォールバックする。
 * HEAD リクエストによる事前探査と 404 キャッシュにより、コンソールエラーの頻出を防止する。
 */

import { BaseAudioDriver } from './BaseAudioDriver.js';

export class WaveAudioDriver extends BaseAudioDriver {
    /**
     * @param {Object} [options]
     * @param {number} [options.volume=80] - 0〜100
     * @param {string} [options.soundDir='assets/sounds/'] - 音声アセットディレクトリ
     */
    constructor(options = {}) {
        super(options);
        this.soundDir = options.soundDir || 'assets/sounds/';
        this.failedAssetCache = new Set();
        this.activeSounds = new Set();
    }

    /**
     * 音声ファイル (MP3/OGG/WAV等) を再生する
     *
     * @param {string} filename - 再生対象ファイル名 (例: 'kill.mp3')
     * @param {number|null} [volumeOverride=null] - 一時的な音量上書き (0〜100)
     * @returns {Promise<boolean>} 再生に成功した場合 true、失敗・アセット不在時は false
     */
    async play(filename, volumeOverride = null) {
        if (!filename || this.failedAssetCache.has(filename)) return false;

        const effectiveVolume = volumeOverride !== null && volumeOverride !== undefined
            ? Math.max(0, Math.min(100, volumeOverride))
            : this.volume;
        const normalizedVol = effectiveVolume / 100;

        const candidatePaths = [
            this.soundDir + filename,
            '../' + this.soundDir + filename,
            '../../' + this.soundDir + filename,
            '/' + this.soundDir + filename,
            'assets/sounds/' + filename,
            '../assets/sounds/' + filename
        ];
        const uniquePaths = Array.from(new Set(candidatePaths));

        // 1. Howler.js がグローバルに存在する場合は優先使用
        if (typeof window !== 'undefined' && window.Howl) {
            return new Promise((resolve) => {
                let soundInstance = null;
                try {
                    soundInstance = new window.Howl({
                        src: uniquePaths,
                        volume: normalizedVol,
                        onloaderror: () => {
                            this.failedAssetCache.add(filename);
                            if (soundInstance) this.activeSounds.delete(soundInstance);
                            resolve(false);
                        },
                        onplay: () => {
                            resolve(true);
                        },
                        onend: () => {
                            if (soundInstance) this.activeSounds.delete(soundInstance);
                        }
                    });
                    this.activeSounds.add(soundInstance);
                    soundInstance.play();
                } catch (e) {
                    if (soundInstance) this.activeSounds.delete(soundInstance);
                    this.failedAssetCache.add(filename);
                    resolve(false);
                }
            });
        }

        // 2. 標準 HTML5 Audio (HEAD 探査で 404 ログを完全防止)
        if (typeof fetch !== 'undefined') {
            for (const path of uniquePaths) {
                try {
                    const res = await fetch(path, { method: 'HEAD' });
                    if (res.ok) {
                        const audio = new Audio(path);
                        audio.volume = normalizedVol;
                        this.activeSounds.add(audio);
                        audio.onended = () => {
                            this.activeSounds.delete(audio);
                        };
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

    /**
     * 発音中の全音声を停止する
     */
    stopAll() {
        for (const item of this.activeSounds) {
            try {
                if (typeof item.stop === 'function') {
                    item.stop();
                } else if (typeof item.pause === 'function') {
                    item.pause();
                    item.currentTime = 0;
                }
            } catch (e) {}
        }
        this.activeSounds.clear();
    }

    /**
     * 存在しない音声アセットのブラックリストキャッシュを消去する
     */
    clearCache() {
        this.failedAssetCache.clear();
    }
}
