/**
 * InputResolver.js
 * Wasm 側の同期入力待ち（Asyncify）に対する Promise 管理とセーフティレスポンダー
 */
(function (global) {
    if (global.InputResolver) return;

    class InputResolver {
        constructor(options = {}) {
            this.pendingResolver = null;
            this.pendingContext = null;
            this.timeoutMs = options.timeoutMs || 0; // 0 はタイムアウト無効
            this.timerId = null;
            this.onTimeout = options.onTimeout || null;
        }

        /**
         * 新しい入力待機を登録します。
         * @param {string} context - 'key', 'poskey', 'yn', 'menu', 'getlin', 'name', 'ext_cmd' 等
         * @param {object} extra - choices, prompt など
         * @returns {Promise}
         */
        createPending(context, extra = {}) {
            this.cancel(); // 既存の待機があればキャンセル

            this.pendingContext = { context, ...extra };

            return new Promise((resolve) => {
                this.pendingResolver = resolve;

                if (this.timeoutMs > 0) {
                    this.timerId = setTimeout(() => {
                        console.warn(`[InputResolver] Safety timeout fired for context '${context}'. Auto-cancelling.`);
                        if (this.onTimeout) this.onTimeout(context);
                        this.cancel();
                    }, this.timeoutMs);
                }
            });
        }

        /**
         * クライアントからの正規な回答を渡し、Promise を resolve します。
         */
        respond(value) {
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
            }

            if (this.pendingResolver) {
                const resolve = this.pendingResolver;
                this.pendingResolver = null;
                this.pendingContext = null;
                resolve(value);
                return true;
            }
            return false;
        }

        /**
         * 入力をキャンセルし、Wasm フリーズを防ぐため標準的なキャンセル値 (ESC: 27 または null) を返します。
         */
        cancel() {
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
            }

            if (this.pendingResolver) {
                const resolve = this.pendingResolver;
                const ctx = this.pendingContext ? this.pendingContext.context : 'unknown';
                this.pendingResolver = null;
                this.pendingContext = null;

                console.log(`[InputResolver] Input cancelled for context '${ctx}'. Resolving with fallback.`);

                // コンテキストに合わせたフォールバック値
                if (ctx === 'yn' || ctx === 'yn_function') {
                    const choices = this.pendingContext?.choices || "";
                    if (choices.includes('q')) resolve('q'.charCodeAt(0));
                    else if (choices.includes('n')) resolve('n'.charCodeAt(0));
                    else resolve(27); // ESC
                } else if (ctx === 'menu' || ctx === 'select_menu') {
                    resolve(0); // 0 or []
                } else if (ctx === 'getlin' || ctx === 'name') {
                    resolve(null);
                } else if (ctx === 'ext_cmd' || ctx === 'get_ext_cmd') {
                    resolve(-1);
                } else {
                    resolve(27); // ASCII ESC
                }
                return true;
            }
            return false;
        }

        isWaiting() {
            return this.pendingResolver !== null;
        }

        getContext() {
            return this.pendingContext;
        }
    }

    global.InputResolver = InputResolver;
    if (typeof window !== 'undefined') {
        window.InputResolver = InputResolver;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.InputResolver = InputResolver;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = InputResolver;
        module.exports.InputResolver = InputResolver;
        module.exports.default = InputResolver;
    }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));


