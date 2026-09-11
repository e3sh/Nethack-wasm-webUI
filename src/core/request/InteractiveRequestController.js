/**
 * InteractiveRequestController.js
 * WebUICore 汎用連続リクエストコントローラ (Interactive Sequence Controller)
 *
 * 【アーキテクチャ上の責務】
 * 1. モードA (従来配列渡し互換):
 *    - トークン配列 (例: ['i', ' ', '\x1b']) を受け取り、ドライバの queueSequence を実行。
 *    - 既存呼び出し元が期待する出力バッファ配列 (Array<Object>) をそのまま返却 (後方互換 100% 担保)。
 * 2. モードB (スクリプト・レシピ型):
 *    - レシピオブジェクト ({ start, handlers, until, timeoutMs, defaultAction }) を受け取り、
 *      C コアからの inputRequired を監視。
 *    - SignalDetector.detect(payload) によるシグナル同定 (signalId, subCategory) とプロンプト属性を用いて
 *      handlers ルールを動的に評価・応答。
 *    - コンテキスト ctx 経由でのデータ抽出 (ctx.data) および終了条件 (until) による完了判定をサポート。
 * 3. セーフティガード (SafetyGuard):
 *    - タイムアウト発生時や異常時に ESC 連打 (['\x1b', '\x1b', '\x1b']) を投入し、
 *      安全に通常ターン (poskey) へ復帰させる。
 *
 * ※ブラウザネイティブ ESM (GKLpureJSclient) 互換のため、import には必ず .js 拡張子を使用すること。
 */

import { SignalDetector } from '../prompt/SignalDetector.js';

export class InteractiveRequestController {
    static get State() {
        return {
            IDLE: 'IDLE',
            EXECUTING: 'EXECUTING',
            ABORTING_ESC: 'ABORTING_ESC'
        };
    }

    /**
     * @param {Object} [options={}]
     * @param {Object} [options.driver=null] - NetHackWasmDriver インスタンス
     * @param {SignalDetector} [options.signalDetector=null] - SignalDetector インスタンス
     */
    constructor(options = {}) {
        this.driver = options.driver || null;
        this.signalDetector = options.signalDetector || null;
        this.state = InteractiveRequestController.State.IDLE;
        this.listeners = new Map();
        this._inputRequiredHandler = null;

        if (!this.signalDetector) {
            try {
                this.signalDetector = SignalDetector.createDefault();
            } catch (e) {
                this.signalDetector = null;
            }
        }
    }

    /**
     * Driver インスタンスのセット
     * @param {Object} driver
     */
    setDriver(driver) {
        this.driver = driver;
    }

    /**
     * SignalDetector インスタンスのセット
     * @param {SignalDetector} signalDetector
     */
    setSignalDetector(signalDetector) {
        this.signalDetector = signalDetector;
    }

    /**
     * 現在の状態を取得
     * @returns {string}
     */
    getState() {
        return this.state;
    }

    /**
     * 状態を変更しイベントを発火
     * @param {string} newState
     */
    setState(newState) {
        if (this.state === newState) return;
        const oldState = this.state;
        this.state = newState;
        this.emit('stateChanged', { newState, oldState });
    }

    /**
     * 実行中かどうか
     * @returns {boolean}
     */
    isExecuting() {
        return this.state === InteractiveRequestController.State.EXECUTING;
    }

    /**
     * イベントリスナーの登録
     */
    on(event, fn) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(fn);
        return this;
    }

    /**
     * イベントリスナーの解除
     */
    off(event, fn) {
        if (!this.listeners.has(event)) return this;
        const list = this.listeners.get(event);
        const idx = list.indexOf(fn);
        if (idx >= 0) {
            list.splice(idx, 1);
        }
        return this;
    }

    /**
     * イベントの発行
     */
    emit(event, data) {
        const fns = this.listeners.get(event);
        if (fns) {
            for (const fn of fns) {
                try {
                    fn(data);
                } catch (e) {
                    console.error(`[InteractiveRequestController] Listener error on '${event}':`, e);
                }
            }
        }
    }

    /**
     * 汎用サイレント・シーケンスクエリ (querySequenceSilent)
     * - モードA (配列渡し): 出力バッファ配列 (Array<Object>) をそのまま返却 (後方互換性 100%)
     * - モードB (レシピ型): { success, data, buffer } を返却
     *
     * @param {Array<string|number>|Object} sequenceOrRecipe
     * @param {Object} [options={}]
     * @returns {Promise<Array<Object>|{success: boolean, data: any, buffer: Array<Object>}>}
     */
    async querySequenceSilent(sequenceOrRecipe, options = {}) {
        const opts = { suppressPrompts: true, isSilentSync: true, ...options };

        if (Array.isArray(sequenceOrRecipe)) {
            // モードA: 配列渡し (従来互換)
            return await this._executeArrayMode(sequenceOrRecipe, opts);
        } else if (sequenceOrRecipe && typeof sequenceOrRecipe === 'object') {
            // モードB: スクリプト・レシピ型
            return await this._executeRecipeMode(sequenceOrRecipe, opts);
        }

        return [];
    }

    /**
     * キーシーケンスの実行 (executeSequence)
     * - モードA (配列渡し): Promise<boolean> (成功時 true)
     * - モードB (レシピ型): Promise<boolean|Object>
     *
     * @param {Array<string|number>|Object} sequenceOrRecipe
     * @param {Object} [options={}]
     * @returns {Promise<boolean|Object>}
     */
    async executeSequence(sequenceOrRecipe, options = {}) {
        if (Array.isArray(sequenceOrRecipe)) {
            // モードA: 配列渡し (従来互換)
            const buffer = await this._executeArrayMode(sequenceOrRecipe, options);
            return buffer !== null;
        } else if (sequenceOrRecipe && typeof sequenceOrRecipe === 'object') {
            // モードB: レシピ型
            const result = await this._executeRecipeMode(sequenceOrRecipe, options);
            return result.success;
        }
        return false;
    }

    /**
     * モードA: トークン配列の実行 (従来互換)
     * @private
     * @param {Array<string|number>} tokens
     * @param {Object} options
     * @returns {Promise<Array<Object>>}
     */
    async _executeArrayMode(tokens, options = {}) {
        if (!Array.isArray(tokens) || tokens.length === 0) {
            return [];
        }

        if (!this.driver) {
            return [];
        }

        this.setState(InteractiveRequestController.State.EXECUTING);
        try {
            if (typeof this.driver.queueSequence === 'function') {
                const buffer = await this.driver.queueSequence(tokens, options);
                const bufArray = Array.isArray(buffer) ? buffer : [];
                this.emit('sequenceFinished', { buffer: bufArray, ...options });
                return bufArray;
            } else if (typeof this.driver.sendKey === 'function') {
                tokens.forEach(ch => this.driver.sendKey(ch, false, false, false, ch, true));
                return [];
            }
        } catch (e) {
            console.error('[InteractiveRequestController] Error executing array sequence:', e);
            return [];
        } finally {
            this.setState(InteractiveRequestController.State.IDLE);
        }
        return [];
    }

    /**
     * モードB: スクリプト・レシピ型の実行
     * @private
     * @param {Object} recipe
     * @param {Object} options
     * @returns {Promise<{success: boolean, data: any, buffer: Array<Object>, error?: any}>}
     */
    async _executeRecipeMode(recipe, options = {}) {
        if (!this.driver) {
            return { success: false, data: null, buffer: [], error: new Error('Driver is not attached.') };
        }

        this.setState(InteractiveRequestController.State.EXECUTING);

        const timeoutMs = recipe.timeoutMs || options.timeoutMs || 3000;
        const startQueue = Array.isArray(recipe.start) ?
            [...recipe.start] :
            (recipe.start !== undefined && recipe.start !== null ? [recipe.start] : []);

        const buffer = [];
        let isFinished = false;
        let timeoutTimer = null;
        let cleanup = () => {};

        return new Promise(async (resolve) => {
            // 完了ハンドラ
            const finish = (resultData, isSuccess = true, error = null) => {
                if (isFinished) return;
                isFinished = true;
                cleanup();
                this.setState(InteractiveRequestController.State.IDLE);
                resolve({
                    success: isSuccess,
                    data: resultData !== undefined ? resultData : ctx.data,
                    buffer: [...buffer],
                    error: error || null
                });
            };

            // コンテキスト ctx の構築
            const ctx = {
                data: null,
                state: 'INITIAL',
                payload: null,
                signal: null,
                buffer: buffer,
                menuItems: [],
                hasMenuItem: (target) => {
                    return ctx.findMenuItem(target) !== null;
                },
                findMenuItem: (target) => {
                    const items = ctx.menuItems || [];
                    for (const item of items) {
                        if (!item) continue;
                        if (typeof target === 'string') {
                            if (item.charStr === target ||
                                item.selector === target ||
                                (item.accelerator && String.fromCharCode(item.accelerator) === target) ||
                                (item.ch && String.fromCharCode(item.ch) === target)) {
                                return item;
                            }
                            const str = item.str || item.text || item.rawStr || '';
                            if (str.toLowerCase().includes(target.toLowerCase())) {
                                return item;
                            }
                        } else if (target instanceof RegExp) {
                            const str = item.str || item.text || item.rawStr || '';
                            if (target.test(str)) {
                                return item;
                            }
                        } else if (typeof target === 'function') {
                            if (target(item)) {
                                return item;
                            }
                        }
                    }
                    return null;
                },
                finish: (data) => {
                    finish(data, true);
                }
            };

            // バッファ記録用リスナー
            const onPutstr = (data) => {
                if (data && data.text) buffer.push({ type: 'putstr', text: data.text });
            };
            const onMessageText = (data) => {
                if (data && data.text) buffer.push({ type: 'messageText', text: data.text });
            };

            if (typeof this.driver.on === 'function') {
                this.driver.on('putstr', onPutstr);
                this.driver.on('messageText', onMessageText);
            }

            // inputRequired リスナー
            const onInputRequired = (payload) => {
                if (isFinished) return;

                buffer.push({ type: 'inputRequired', payload });

                // シグナル同定
                const signal = this.signalDetector ?
                    this.signalDetector.detect(payload) :
                    { matched: false, signalId: null, subCategory: null, inputType: null, params: {} };

                ctx.payload = payload;
                ctx.signal = signal;
                ctx.menuItems = payload.items || payload.menuItems || [];

                // 終了判定 (until) のチェック
                // startQueue が空（初動キーが消費済み）の場合に終了条件を評価
                if (this._isUntilSatisfied(recipe.until, payload, ctx, startQueue.length)) {
                    finish(ctx.data, true);
                    return;
                }

                const resolver = payload.safeResolver || payload.resolver || (this.driver ? this.driver.activeResolver : null);

                // 1. 初動キーが残っている場合は最優先で投入
                if (startQueue.length > 0) {
                    const token = startQueue.shift();
                    this._respond(resolver, token);
                    return;
                }

                // 2. ハンドラルールの優先順評価
                const handlers = recipe.handlers || [];
                for (const handler of handlers) {
                    if (this._matchesRule(handler.match, payload, ctx)) {
                        const action = typeof handler.action === 'function' ? handler.action(ctx) : handler.action;
                        if (action !== undefined && action !== null) {
                            this._respond(resolver, action);
                        }
                        if (isFinished) return;
                        if (action !== undefined && action !== null) {
                            return;
                        }
                    }
                }

                // 3. デフォルトアクション
                if (recipe.defaultAction !== undefined) {
                    const defAction = typeof recipe.defaultAction === 'function' ? recipe.defaultAction(ctx) : recipe.defaultAction;
                    if (defAction !== undefined && defAction !== null) {
                        this._respond(resolver, defAction);
                    }
                    if (isFinished) return;
                    if (defAction !== undefined && defAction !== null) {
                        return;
                    }
                }
            };

            // クリーンアップ関数
            cleanup = () => {
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }
                if (this.driver && typeof this.driver.off === 'function') {
                    this.driver.off('inputRequired', onInputRequired);
                    this.driver.off('putstr', onPutstr);
                    this.driver.off('messageText', onMessageText);
                }
            };

            // タイムアウト設定
            timeoutTimer = setTimeout(async () => {
                if (isFinished) return;
                console.warn(`[InteractiveRequestController] Recipe timed out after ${timeoutMs}ms. Aborting with ESC.`);
                await this.abortWithESC();
                finish(ctx.data, false, new Error(`Interactive request timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            // Driver イベント購読
            if (this.driver && typeof this.driver.on === 'function') {
                this.driver.on('inputRequired', onInputRequired);
            }

            // 開始時点で既に driver.activeResolver が存在している場合、直ちに最初の初動キーで応答
            if (this.driver && this.driver.activeResolver && startQueue.length > 0) {
                const initialToken = startQueue.shift();
                const activeRes = this.driver.activeResolver;
                this._respond(activeRes, initialToken);
            }
        });
    }

    /**
     * 終了条件 (until) の判定
     * @private
     */
    _isUntilSatisfied(until, payload, ctx, remainingStartTokens) {
        if (remainingStartTokens > 0) {
            return false;
        }

        const defaultUntil = { type: 'turn_ready' };
        const condition = until || defaultUntil;

        if (typeof condition === 'function') {
            return Boolean(condition(payload, ctx));
        }

        // turn_ready 判定 (poskey 復帰)
        if (condition.type === 'turn_ready') {
            const isPoskey = (payload.type && String(payload.type).toLowerCase() === 'poskey') ||
                             (payload.context && String(payload.context).toLowerCase() === 'poskey') ||
                             (payload.category && String(payload.category).toLowerCase() === 'poskey') ||
                             (payload.promptCategory && String(payload.promptCategory).toLowerCase() === 'poskey');
            return Boolean(isPoskey);
        }

        // signalId 判定
        if (condition.signalId) {
            return ctx.signal && ctx.signal.signalId === condition.signalId;
        }

        // subCategory 判定
        if (condition.subCategory) {
            return ctx.signal && ctx.signal.subCategory === condition.subCategory;
        }

        // filter 関数
        if (typeof condition.filter === 'function') {
            return Boolean(condition.filter(payload, ctx));
        }

        return false;
    }

    /**
     * ハンドラルール (match) の判定
     * @private
     */
    _matchesRule(match, payload, ctx) {
        if (!match) return true;

        // ifState 判定
        if (match.ifState && ctx.state !== match.ifState) {
            return false;
        }

        // signalId 判定
        if (match.signalId) {
            if (!ctx.signal || !ctx.signal.matched || ctx.signal.signalId !== match.signalId) {
                return false;
            }
        }

        // subCategory 判定
        if (match.subCategory) {
            if (!ctx.signal || ctx.signal.subCategory !== match.subCategory) {
                return false;
            }
        }

        // type / category / promptCategory 判定
        if (match.type) {
            const actualType = (payload.type || payload.category || payload.promptCategory || '').toLowerCase();
            const expectedType = String(match.type).toLowerCase();
            if (actualType !== expectedType) {
                return false;
            }
        }

        // prompt / rawPrompt 判定
        if (match.prompt) {
            const promptText = payload.rawPrompt || payload.prompt || payload.question || payload.message || '';
            if (match.prompt instanceof RegExp) {
                if (!match.prompt.test(promptText)) return false;
            } else if (typeof match.prompt === 'string') {
                if (!promptText.toLowerCase().includes(match.prompt.toLowerCase())) return false;
            }
        }

        // filter 独自関数
        if (typeof match.filter === 'function') {
            if (!match.filter(payload, ctx)) return false;
        }

        return true;
    }

    /**
     * 安全に応答を送信
     * @private
     */
    _respond(resolver, action) {
        if (!resolver) return;
        try {
            if (typeof resolver.respond === 'function') {
                resolver.respond(action);
            } else if (typeof resolver === 'function') {
                resolver(action);
            }
        } catch (e) {
            console.error('[InteractiveRequestController] Error responding to resolver:', e);
        }
    }

    /**
     * セーフティガード: ESC連打 (['\x1b', '\x1b', '\x1b']) を投入し安全に通常状態へ復帰
     */
    async abortWithESC() {
        this.setState(InteractiveRequestController.State.ABORTING_ESC);
        try {
            if (this.driver) {
                // 1. 実行中のドライバシーケンスがあればキャンセル
                if (typeof this.driver.cancelSequence === 'function') {
                    this.driver.cancelSequence();
                }

                // 2. 現在アクティブな resolver があれば ESC で解放
                const activeResolver = this.driver.activeResolver;
                if (activeResolver) {
                    if (typeof activeResolver.respond === 'function') {
                        activeResolver.respond('\x1b');
                    } else if (typeof activeResolver === 'function') {
                        activeResolver('\x1b');
                    }
                }

                // 3. ESC 連打を投入して通常ターン (poskey) 復帰を確実に果たす
                const escTokens = ['\x1b', '\x1b', '\x1b'];
                if (typeof this.driver.queueSequence === 'function') {
                    const escPromise = this.driver.queueSequence(escTokens, { suppressPrompts: true, isSilentSync: true });
                    if (escPromise && typeof escPromise.catch === 'function') {
                        escPromise.catch(() => {});
                    }
                } else if (typeof this.driver.sendKey === 'function') {
                    escTokens.forEach(ch => this.driver.sendKey(ch, false, false, false, ch, true));
                }
            }
        } catch (err) {
            console.error('[InteractiveRequestController] Error during abortWithESC:', err);
        } finally {
            this.setState(InteractiveRequestController.State.IDLE);
        }
    }
}
