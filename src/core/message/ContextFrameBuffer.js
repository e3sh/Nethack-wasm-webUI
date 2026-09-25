/**
 * ContextFrameBuffer.js
 * Phase 5 - Stage 5.2: 状況シグナル基盤 メッセージ履歴ウィンドウバッファ
 * 
 * 直近のユーザーアクション（poskey やプロンプト回答）以降に受信した
 * メッセージ（rawText）および解決されたコンテキスト（MessageContext）を、
 * リングバッファ（デフォルト最大10件）として保持する。
 */

export class ContextFrameBuffer {
    /**
     * @param {number} [maxSize=10] 保持する最大履歴件数
     */
    constructor(maxSize = 10) {
        this._maxSize = Math.max(1, maxSize);
        this._buffer = [];
    }

    /**
     * 新しいメッセージフレームを記録
     * @param {Object} frame
     * @param {string} frame.rawText 生テキスト
     * @param {Object|null} [frame.context=null] 解決された MessageContext
     * @param {number} [frame.timestamp] 記録タイムスタンプ
     * @returns {Object} 追加されたフレーム
     */
    push(frame) {
        if (!frame || typeof frame.rawText !== 'string') {
            return null;
        }

        const entry = {
            rawText: frame.rawText,
            context: frame.context || null,
            timestamp: frame.timestamp !== undefined ? frame.timestamp : Date.now()
        };

        this._buffer.push(entry);
        if (this._buffer.length > this._maxSize) {
            this._buffer.shift();
        }

        return entry;
    }

    /**
     * 直近のメッセージ履歴を指定件数取得 (新しい順)
     * @param {number} [count=this._maxSize] 取得件数
     * @returns {Array<Object>} 直近フレーム (新しい順)
     */
    getRecent(count = this._maxSize) {
        const n = Math.min(count, this._buffer.length);
        const result = [];
        for (let i = this._buffer.length - 1; i >= this._buffer.length - n; i--) {
            result.push(this._buffer[i]);
        }
        return result;
    }

    /**
     * バッファ内の全履歴を時系列 (古い順) で取得
     * @returns {Array<Object>}
     */
    getSnapshot() {
        return [...this._buffer];
    }

    /**
     * 直近の1件を取得
     * @returns {Object|null}
     */
    peek() {
        return this._buffer.length > 0 ? this._buffer[this._buffer.length - 1] : null;
    }

    /**
     * バッファをクリア
     */
    clear() {
        this._buffer = [];
    }

    /**
     * 現在の蓄積件数
     * @type {number}
     */
    get size() {
        return this._buffer.length;
    }

    /**
     * 最大保持件数
     * @type {number}
     */
    get maxSize() {
        return this._maxSize;
    }
}

export default ContextFrameBuffer;
