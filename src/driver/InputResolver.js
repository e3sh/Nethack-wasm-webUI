/**
 * InputResolver.js
 * 
 * Wasm Asyncify 用の安全な Promise レスポンダー
 * 入力待ちのハングアップ防止・デッドロック救出・セーフティタイムアウトを提供
 */

class InputResolver {
    /**
     * @param {Object} [options]
     * @param {number} [options.timeoutMs=30000] - ハングアップ救出用のセーフティタイムアウト（ミリ秒）。0 で無効化。
     * @param {any} [options.cancelValue=27] - タイムアウト・キャンセル時に返却する安全な初期フォールバック値
     * @param {function} [options.onTimeout] - タイムアウト発生時のレスキューコールバック関数
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
                    console.warn(`[InputResolver] Safety timeout reached (${this.timeoutMs}ms). Rescuing blocked Asyncify input.`);
                    if (typeof this.onTimeout === 'function') {
                        try {
                            this.onTimeout();
                        } catch (e) {
                            console.error("[InputResolver] Error in onTimeout callback:", e);
                        }
                    } else {
                        this.cancel();
                    }
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
     * 指定された安全なキャンセル値を返却して Promise をレスキュー解決する
     * 
     * @param {any} [overrideValue]
     * @returns {boolean}
     */
    cancel(overrideValue) {
        const val = overrideValue !== undefined ? overrideValue : this.cancelValue;
        return this.respond(val);
    }

    /**
     * タイマーのクリア
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
