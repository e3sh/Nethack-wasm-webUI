/**
 * InputResolver.js
 * 
 * Wasm Asyncify 用の安全な Promise レスポンダー
 * 入力待ちのハングアップ防止・安全なキャンセレーション・セーフティタイムアウトを提供
 */

class InputResolver {
    /**
     * @param {Object} [options]
     * @param {number} [options.timeoutMs=30000] - 自動キャンセルのタイムアウト（ミリ秒）。0 で無効化。
     * @param {any} [options.cancelValue=27] - キャンセル時に返却するデフォルト値（ASCII ESC = 27）
     * @param {function} [options.onTimeout] - タイムアウト発生時のコールバック関数
     */
    constructor(options = {}) {
        this.timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 30000;
        this.cancelValue = options.cancelValue !== undefined ? options.cancelValue : 27; // ESC
        this.onTimeout = options.onTimeout || null;

        this._resolved = false;
        this._timer = null;

        this.promise = new Promise((resolve) => {
            this._resolveFn = resolve;
        });

        if (this.timeoutMs > 0) {
            this._timer = setTimeout(() => {
                if (!this._resolved) {
                    console.warn(`[InputResolver] Safety timeout reached (${this.timeoutMs}ms). Resolving with cancel value (${this.cancelValue}).`);
                    if (typeof this.onTimeout === 'function') {
                        try {
                            this.onTimeout();
                        } catch (e) {
                            console.error("[InputResolver] Error in onTimeout callback:", e);
                        }
                    }
                    this.cancel();
                }
            }, this.timeoutMs);
        }
    }

    /**
     * すでに解決済みかどうかを取得
     * @returns {boolean}
     */
    get isResolved() {
        return this._resolved;
    }

    /**
     * 入力応答値を返却して Promise を解決する
     * 
     * @param {any} value
     * @returns {boolean} 正常に解決された場合は true
     */
    respond(value) {
        if (this._resolved) return false;
        this._resolved = true;
        this._clearTimer();
        this._resolveFn(value);
        return true;
    }

    /**
     * キャンセル処理（ESC等を返却して Wasm のフリーズを回避する）
     * 
     * @param {any} [overrideCancelValue] - キャンセル値を一時的に上書きする場合
     * @returns {boolean}
     */
    cancel(overrideCancelValue) {
        if (this._resolved) return false;
        const val = overrideCancelValue !== undefined ? overrideCancelValue : this.cancelValue;
        return this.respond(val);
    }

    /**
     * 内部タイマーのクリア
     * @private
     */
    _clearTimer() {
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }
}

// Module export / Universal support
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputResolver;
}
if (typeof window !== 'undefined') {
    window.InputResolver = InputResolver;
}
