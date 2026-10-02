/**
 * BaseAudioDriver.js - 音響駆動ドライバ基底クラス
 *
 * すべての音響駆動ドライバ (Wave, PsgBeep, ProceduralSynth など) の共通インターフェース。
 * ゲームロジックやメッセージIDなどのドメイン知識を一切持たず、音響再生に専念する。
 */

export class BaseAudioDriver {
    /**
     * @param {Object} [options]
     * @param {number} [options.volume=80] - 0〜100
     */
    constructor(options = {}) {
        this.volume = options.volume !== undefined ? options.volume : 80;
    }

    /**
     * 音量を設定する (0〜100)
     * @param {number} volume
     */
    setVolume(volume) {
        if (typeof volume === 'number' && !isNaN(volume)) {
            this.volume = Math.max(0, Math.min(100, volume));
        }
    }

    /**
     * ユーザージェスチャーによるオーディオコンテキストロック解除
     */
    unlockAudio() {
        // サブクラスで必要に応じてオーバーライド
    }

    /**
     * 現在再生中の音声をすべて停止する
     */
    stopAll() {
        // サブクラスで必要に応じてオーバーライド
    }
}
