/**
 * RequestController.js
 * Game Knowledge Layer (GKL / csRC) のコア状態マシンクラス
 * IDLE, EXECUTING, ABORTING_ESC, SUSPENDED の4状態を管理し、
 * NetHackWasmDriver のシーケンスキューへの投入・割り込みキャンセルを安全に制御する。
 */
(function (global) {
    if (global.RequestController) return;

    class RequestController {
        static get State() {
            return {
                IDLE: 'IDLE',                   // パッシブ / 通常手動操作
                EXECUTING: 'EXECUTING',         // シーケンス自動消化中
                ABORTING_ESC: 'ABORTING_ESC',   // モーダルキャンセル・ESC送出復帰中
                SUSPENDED: 'SUSPENDED'          // 手動優先 / サスペンド状態
            };
        }

        /**
         * @param {Object} [driver=null] - NetHackWasmDriver インスタンス
         * @param {Object} [options={}]
         */
        constructor(driver = null, options = {}) {
            this.driver = driver;
            this.state = RequestController.State.IDLE;
            this.options = {
                autoResumeDelayMs: 400,
                ...options
            };

            this.autoResumeTimer = null;
            this.listeners = new Map();
        }

        /**
         * NetHackWasmDriver インスタンスのセット
         */
        setDriver(driver) {
            this.driver = driver;
        }

        /**
         * イベントリスナーの登録
         */
        on(event, fn) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }
            this.listeners.get(event).push(fn);
        }

        /**
         * イベントの発行
         */
        emit(event, data) {
            if (this.listeners.has(event)) {
                for (const fn of this.listeners.get(event)) {
                    try {
                        fn(data);
                    } catch (e) {
                        console.error(`[RequestController] Listener error on event '${event}':`, e);
                    }
                }
            }
        }

        /**
         * 現在の状態を取得
         */
        getState() {
            return this.state;
        }

        /**
         * 状態の変更とイベント発行
         */
        setState(newState) {
            if (this.state === newState) return;
            const oldState = this.state;
            this.state = newState;
            this.emit('stateChanged', { newState, oldState });
        }

        /**
         * トークン配列を受け取り、Driver へ投入して EXECUTING 状態へ移行
         * @param {Array<string|number>} tokens - 入力トークン配列
         * @param {Object} [options={}] - { suppressPrompts: boolean }
         */
        executeSequence(tokens, options = {}) {
            if (this.state === RequestController.State.SUSPENDED) {
                console.warn("[RequestController] Cannot execute sequence in SUSPENDED state.");
                return false;
            }

            if (!this.driver) {
                console.error("[RequestController] Driver is not attached.");
                return false;
            }

            if (!Array.isArray(tokens) || tokens.length === 0) {
                return false;
            }

            this.setState(RequestController.State.EXECUTING);
            this.driver.queueSequence(tokens, options);
            return true;
        }

        /**
         * モーダル状態でエラー・想定外応答が発生した際、ESCを1回送出して安全に通常状態へ復帰
         */
        abortWithESC() {
            if (!this.driver) {
                this.setState(RequestController.State.IDLE);
                return;
            }

            this.setState(RequestController.State.ABORTING_ESC);
            if (typeof this.driver.cancelSequence === 'function') {
                this.driver.cancelSequence();
            }

            // ESC (\033) 送出
            if (this.driver.activeResolver) {
                this.driver.activeResolver.respond('\033');
            } else if (typeof this.driver.sendKey === 'function') {
                this.driver.sendKey('\033', false, false, false, '\033', true);
            }

            this.setState(RequestController.State.IDLE);
        }

        /**
         * ユーザーの物理入力や手動キー操作時、即座にキューを破棄して手動優先にする
         */
        cancel() {
            if (this.driver && typeof this.driver.cancelSequence === 'function') {
                this.driver.cancelSequence();
            }
            this.setState(RequestController.State.IDLE);
        }

        /**
         * 一時的に自動処理をサスペンド
         */
        suspend() {
            this.cancel();
            this.setState(RequestController.State.SUSPENDED);

            if (this.autoResumeTimer) {
                clearTimeout(this.autoResumeTimer);
            }

            if (this.options.autoResumeDelayMs > 0) {
                this.autoResumeTimer = setTimeout(() => {
                    this.resume();
                }, this.options.autoResumeDelayMs);
            }
        }

        /**
         * サスペンド解除
         */
        resume() {
            if (this.autoResumeTimer) {
                clearTimeout(this.autoResumeTimer);
                this.autoResumeTimer = null;
            }
            if (this.state === RequestController.State.SUSPENDED) {
                this.setState(RequestController.State.IDLE);
            }
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = RequestController;
    } else {
        global.RequestController = RequestController;
    }
})(typeof window !== 'undefined' ? window : globalThis);
