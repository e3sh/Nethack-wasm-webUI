/**
 * WebUICore.js - NetHack WebUI Core ファサードクラス (start 引数型修正版)
 *
 * Wasm Driver, Key Normalizer, StatusAccessor, レンダラー連携を統合。
 * driver.init() への引数不一致 (TypeError: Cannot create property 'preRun' on string) を修復。
 */

import { StatusAccessor } from './StatusAccessor.js';
import { GamepadManager, TouchCalculator, KeyMapper, KEYMAP } from './input/index.js';
import { SoundEngine } from './sound/SoundEngine.js';
import { TranslationEngine } from './translation/TranslationEngine.js';
import { GameOverResolver } from './lifecycle/GameOverResolver.js';
import { NullRenderer } from './renderers/NullRenderer.js';
import { GlyphHelper } from './renderers/GlyphHelper.js';
import { PROMPT_CATEGORY } from './types.js';
import { GKLPlugin } from './knowledge/GKLPlugin.js';
import { PromptPayloadBuilder } from './prompt/PromptPayloadBuilder.js';
import { TextWindowManager } from './window/TextWindowManager.js';
import { DebugInspector } from './inspector/DebugInspector.js';

export const KEYS = {
    ESC: 27,
    ENTER: 13,
    SPACE: 32,
    BACKSPACE: 8,
    TAB: 9
};

export const CoreState = {
    UNINITIALIZED: 'UNINITIALIZED',
    INITIALIZING: 'INITIALIZING',
    READY: 'READY',
    RUNNING: 'RUNNING',
    WAITING_INPUT: 'WAITING_INPUT',
    GAME_OVER: 'GAME_OVER',
    EXITED: 'EXITED',
    DESTROYED: 'DESTROYED'
};

/**
 * WebUICore - NetHack WebUI Core ファサードクラス (インフラ層)
 *
 * Wasm Driver との低レイヤー受動通信、入力正規化、描画、ウィンドウ管理、翻訳等の純粋基盤。
 * GKL (Game Knowledge Layer) 等のドメイン知識は外部プラグイン (GKLPlugin) として use() アタッチされる。
 */
export class WebUICore {
    constructor(options = {}) {
        this.options = options;
        this.driver = options.driver;
        if (!this.driver) {
            throw new Error("WebUICore: options.driver is required.");
        }

        this.renderer = options.renderer || new NullRenderer();
        this.listeners = new Map();
        this.plugins = [];
        this.gkl = null;
        this.statusAccessor = new StatusAccessor();

        this.gamepad = new GamepadManager(options.gamepadOptions);
        this.touch = new TouchCalculator(options.touchOptions);
        this.keyMapper = new KeyMapper(options.keyMapperOptions);
        this.sound = new SoundEngine({ soundMode: options.soundMode || 'mute' });

        let isTranslateActive = options.translateEnabled;
        let isInspectorActive = options.enableInspector;

        if (typeof localStorage !== 'undefined') {
            try {
                const savedConfigStr = localStorage.getItem("nh.config");
                if (savedConfigStr) {
                    const savedConfig = JSON.parse(savedConfigStr);
                    if (savedConfig) {
                        if (isTranslateActive === undefined) {
                            if (savedConfig.lang !== undefined) {
                                isTranslateActive = !!savedConfig.lang;
                            } else if (savedConfig.translate_enabled !== undefined) {
                                isTranslateActive = !!savedConfig.translate_enabled;
                            }
                        }
                        if (isInspectorActive === undefined && savedConfig.debug !== undefined) {
                            isInspectorActive = !!savedConfig.debug;
                        }
                    }
                }
            } catch (e) {}
        }
        if (isTranslateActive === undefined) {
            isTranslateActive = true;
        }
        if (isInspectorActive === undefined) {
            isInspectorActive = true;
        }

        let isKnowledgeActive = options.enableKnowledge !== false;

        this.translator = new TranslationEngine({ enabled: isTranslateActive });
        this.translator.onTranslate = (logData) => {
            this.emit('translationLog', logData);
            if (!logData.success && !this.translator.isNoiseMessage(logData.raw)) {
                this.emit('messageUntranslated', logData);
            }
        };
        this.promptPayloadBuilder = new PromptPayloadBuilder({ translator: this.translator, enableKnowledge: isKnowledgeActive });
        this.textWindowManager = new TextWindowManager({ translator: this.translator });

        // GKL プラグインのアタッチ (指定がなければデフォルト GKLPlugin をアタッチして透明互換性を保証)
        const gklPlugin = options.gkl || new GKLPlugin({
            inventoryStateManager: options.inventoryStateManager,
            keyMode: options.keyMode || (options.numpad || options.number_pad || options.numberPad ? 'numpad' : undefined)
        });
        this.use(gklPlugin);

        if (this.promptPayloadBuilder && this.gkl) {
            this.promptPayloadBuilder.setGkl(this.gkl);
        }

        this.state = CoreState.UNINITIALIZED;
        this.currentPromptCategory = PROMPT_CATEGORY.NONE;
        this.currentPromptChoices = '';
        this.activeResolver = null;
        this.activeMenuItems = [];
        
        this.inspector = isInspectorActive ? new DebugInspector(this, options.inspectorOptions) : null;
        
        this.lastDlevel = undefined;
        this.gamepadLoopId = null;
        this.lastInputTime = 0;
        this.isPendingPrefix = false;

        this._initRenderer();
        this._bindDriverEvents();
        this._startGamepadPolling();
    }

    /**
     * プラグインの登録・アタッチ
     * @param {Object} plugin 
     * @returns {WebUICore}
     */
    use(plugin) {
        if (!plugin) return this;
        this.plugins.push(plugin);
        if (typeof plugin.attach === 'function') {
            plugin.attach(this);
        }
        if (plugin instanceof GKLPlugin || plugin.constructor?.name === 'GKLPlugin' || typeof plugin.getSituation === 'function') {
            this.gkl = plugin;
            if (this.promptPayloadBuilder) {
                this.promptPayloadBuilder.setGkl(plugin);
            }
        }
        return this;
    }



    _setState(newState) {
        if (this.state === newState) return;
        const oldState = this.state;
        this.state = newState;
        this.emit('stateChange', { state: newState, oldState: oldState });
    }

    getState() {
        return this.state;
    }

    async detectSavedGameInfo() {
        const fsManager = this.driver ? (this.driver.fsManager || this.driver) : null;
        let saveName = "";
        if (fsManager && typeof fsManager.autoDetectSavePlayerNameAsync === 'function') {
            try {
                saveName = await fsManager.autoDetectSavePlayerNameAsync();
            } catch (e) {}
        }
        const hasSave = !!(saveName && saveName.trim().length > 0);
        return {
            hasSave: hasSave,
            savePlayerName: hasSave ? saveName.trim() : ""
        };
    }

    async start(wasmJsUrl = 'nethack.js', startOptions = {}) {
        this._setState(CoreState.INITIALIZING);

        // startOptions からの numpad / number_pad 自動連動反映
        const isNumpadOpt = !!(startOptions.numpad || startOptions.number_pad || startOptions.numberPad || startOptions.keyMode === 'numpad');
        if (isNumpadOpt) {
            this.setKeyMode('numpad');
        }

        if (startOptions.forceNewGame) {
            await this.deleteSaveData();
        }

        const fsManager = this.driver ? (this.driver.fsManager || this.driver) : null;
        let detectedSaveName = "";

        if (!startOptions.forceNewGame) {
            if (fsManager && typeof fsManager.autoDetectSavePlayerNameAsync === 'function') {
                try {
                    detectedSaveName = await fsManager.autoDetectSavePlayerNameAsync();
                } catch (e) {}
            } else if (fsManager && typeof fsManager.autoDetectSavePlayerName === 'function') {
                try {
                    const res = fsManager.autoDetectSavePlayerName();
                    detectedSaveName = (typeof res === 'object' && res.then) ? await res : res;
                } catch (e) {}
            }
        }

        const hasSave = !startOptions.forceNewGame && (!!(detectedSaveName && detectedSaveName.trim().length > 0) || this.hasSaveData());
        this.isResumingSave = hasSave;
        this.resumeSavePlayerName = hasSave ? detectedSaveName.trim() : "";

        return new Promise((resolve, reject) => {
            const onInitDone = async () => {
                try {
                    this._setState(CoreState.READY);
                    const code = await this.driver.start();
                    this._setState(CoreState.RUNNING);
                    resolve(code);
                } catch (e) {
                    this._setState(CoreState.EXITED);
                    reject(e);
                }
            };

            if (this.driver.state && this.driver.state !== 'IDLE') {
                onInitDone();
            } else {
                this.driver.once('initialized', onInitDone);

                let extraOptions = "";
                if (typeof localStorage !== 'undefined') {
                    try {
                        const savedConfig = JSON.parse(localStorage.getItem("nh.config"));
                        if (savedConfig && savedConfig.extra_options) {
                            extraOptions = savedConfig.extra_options;
                        }
                    } catch (e) { }
                }

                const targetInitParam = (typeof wasmJsUrl === 'string') ? wasmJsUrl : 
                                        ((typeof window !== 'undefined' && window.Module) ? window.Module : null);

                const initArgs = ['nethack', '-otime,showexp,showvers,number_pad'];

                if (hasSave) {
                    if (detectedSaveName && detectedSaveName.trim().length > 0) {
                        initArgs.push(`-u${detectedSaveName.trim()}`);
                    }
                } else {
                    initArgs.push('askname');
                }

                this.driver.init(targetInitParam, {
                    args: initArgs,
                    extraOptions: extraOptions
                });
            }
        });
    }

    /**
     * 保存されている旧セーブデータを完全に削除 (1スロット制限に沿ったクリーンアップ)
     */
    async deleteSaveData() {
        if (this.driver) {
            if (typeof this.driver.deleteAllSaveFiles === 'function') {
                await this.driver.deleteAllSaveFiles();
            } else if (this.driver.fsManager && typeof this.driver.fsManager.deleteAllSaveFiles === 'function') {
                await this.driver.fsManager.deleteAllSaveFiles();
            }
        }
    }


    /**
     * リソース・イベントリスナーの一括安全破棄
     */
    destroy() {
        this._setState(CoreState.DESTROYED);

        if (this.gamepadLoopId) {
            cancelAnimationFrame(this.gamepadLoopId);
            this.gamepadLoopId = null;
        }

        if (this.driver && typeof this.driver.destroy === 'function') {
            this.driver.destroy();
        }

        this.listeners.clear();
    }

    /**
     * ブラウザにセーブデータが保存されているか点検
     */
    hasSaveData() {
        if (this.driver) {
            if (this.driver.fsManager && typeof this.driver.fsManager.hasSaveData === 'function') {
                return this.driver.fsManager.hasSaveData();
            }
            if (typeof this.driver.hasSaveData === 'function') {
                return this.driver.hasSaveData();
            }
        }
        return false;
    }

    async hasSaveDataAsync() {
        if (this.driver) {
            if (typeof this.driver.hasSaveDataAsync === 'function') {
                return await this.driver.hasSaveDataAsync();
            }
            if (this.driver.fsManager && typeof this.driver.fsManager.hasSaveDataAsync === 'function') {
                return await this.driver.fsManager.hasSaveDataAsync();
            }
        }
        return this.hasSaveData();
    }

    /**
     * ハイスコア・ランキング（Scoreboard）構造化データ配列の取得
     * クライアント UI 側が直接 VFS を触る必要なく、一発で構造化ランキング情報を取得可能
     * @returns {Array<{rank: number, score: number, death: string, name: string, role: string}>}
     */
    getHighScores() {
        return GameOverResolver.getScoreboard(this.driver);
    }

    /**
     * ハイスコア・ランキング（Scoreboard）構造化データ配列の非同期取得
     */
    async getHighScoresAsync() {
        return await GameOverResolver.getScoreboardAsync(this.driver);
    }

    /**
     * 汎用サイレント・シーケンスクエリ (Generic Silent Sequence Query)
     * 任意のトークン配列（['i', ' '], ['+', ' '] 等）を画面表示なし（suppressPrompts: true）で自走実行し、
     * シーケンス完了後に driver.getLastSequenceBuffer() のクリーンな実行結果バッファを返却します。
     * @param {Array<string|number>} tokens - 実行するトークン配列
     * @param {Object} [options={}] - オプション
     * @returns {Promise<Array<Object>>} シーケンス実行結果バッファの配列
     */
    async querySequenceSilent(tokens, options = {}) {
        if (!Array.isArray(tokens) || tokens.length === 0) {
            return [];
        }

        const opts = { suppressPrompts: true, isSilentSync: true, ...options };

        if (this.driver && typeof this.driver.queueSequence === 'function') {
            try {
                const buffer = await this.driver.queueSequence(tokens, opts);
                const bufArray = Array.isArray(buffer) ? buffer : [];
                this.emit('sequenceFinished', { buffer: bufArray, isSilentSync: true, syncType: opts.syncType });
                return bufArray;
            } catch (e) {
                return [];
            }
        } else if (this.gkl && this.gkl.requestController) {
            this.gkl.requestController.executeSequence(tokens, opts);
        }

        return new Promise((resolve) => {
            const checkCompletion = () => {
                if (this.driver && !this.driver.isExecutingSequence) {
                    const buffer = typeof this.driver.getLastSequenceBuffer === 'function' ? 
                                   this.driver.getLastSequenceBuffer() : [];
                    this.emit('sequenceFinished', { buffer, isSilentSync: true, syncType: opts.syncType });
                    resolve(buffer);
                } else {
                    setTimeout(checkCompletion, 10);
                }
            };
            setTimeout(checkCompletion, 10);
        });
    }

    /**
     * 直近のシーケンス実行結果バッファのクリーンなコピーを取得
     * @returns {Array<Object>}
     */
    getLastSequenceBuffer() {
        if (this.driver && typeof this.driver.getLastSequenceBuffer === 'function') {
            return this.driver.getLastSequenceBuffer();
        }
        return [];
    }

    /**
     * 現在の構造化ステータスモデルを取得
     * @returns {Object}
     */
    getStatus() {
        return this.statusAccessor ? this.statusAccessor.getStatus() : {};
    }

    /**
     * ドライバー層および自動同期キューのデバッグステータスを取得
     * @returns {Object}
     */
    getDriverDebugStatus() {
        if (this.driver && typeof this.driver.getDebugStatus === 'function') {
            return this.driver.getDebugStatus();
        }
        return {
            state: 'UNKNOWN',
            isTopLevelTurn: false,
            canAcceptSequenceInterruption: false,
            isExecutingSequence: false,
            sequenceQueueLength: 0
        };
    }

    /**
     * クライアント UI 層から個別に直接呼び出し可能な動的翻訳 API
     */
    translate(text) {
        return this.translator.translate(text);
    }

    /**
     * クライアント UI 層から個別に直接呼び出し可能な品詞対応単語辞書引き API
     */
    lookupWord(word, pos = 'noun') {
        return this.translator.lookupWord(word, pos);
    }

    getGlyphStyle(glyph, options = {}) {
        return GlyphHelper.getGlyphStyle(glyph, options);
    }

    getGlyphHtml(glyph, options = {}) {
        return GlyphHelper.getGlyphHtml(glyph, options);
    }

    on(event, fn) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(fn);
    }

    emit(event, data) {
        const fns = this.listeners.get(event);
        if (fns) {
            fns.forEach(fn => fn(data));
        }
    }

    setRenderer(newRenderer) {
        this.renderer = newRenderer || new NullRenderer();
        this._initRenderer();
    }

    /**
     * アクティブなプロンプトを ESC (27) キーで安全にキャンセルする
     * @returns {boolean} キャンセルが実行されたかどうか
     */
    cancelPrompt() {
        if (!this.activeResolver) return false;
        this.respond(KEYS.ESC);
        return true;
    }

    respond(inputVal) {
        if (!this.activeResolver) return;

        if (this.lastInputTime && (Date.now() - this.lastInputTime < 120) && 
           (this.currentPromptCategory === PROMPT_CATEGORY.YN || this.currentPromptCategory === PROMPT_CATEGORY.ASKNAME)) {
            return;
        }

        const resolver = this.activeResolver;
        this.activeResolver = null;

        let finalResponse = inputVal;

        if (this.currentPromptCategory === PROMPT_CATEGORY.MENU) {
            if (inputVal === 0 || inputVal === null || inputVal === undefined || inputVal === 27 || inputVal === '\x1b') {
                finalResponse = 0;
            } else if (typeof inputVal === 'number' || typeof inputVal === 'string') {
                const charCode = typeof inputVal === 'number' ? inputVal : inputVal.charCodeAt(0);
                const matchedItem = this.activeMenuItems.find(it => {
                    if (it.isSelectable === false) return false;
                    return it.ch === charCode || it.accelerator === charCode || 
                           (it.charStr && it.charStr.charCodeAt(0) === charCode);
                });

                if (matchedItem) {
                    if (matchedItem.identifier !== undefined && matchedItem.identifier !== 0 && matchedItem.identifier !== -1) {
                        finalResponse = [{ identifier: matchedItem.identifier, count: -1 }];
                    } else {
                        finalResponse = typeof inputVal === 'number' ? inputVal : inputVal.charCodeAt(0);
                    }
                } else {
                    finalResponse = typeof inputVal === 'number' ? inputVal : inputVal.charCodeAt(0);
                }
            } else if (typeof inputVal === 'object') {
                if (Array.isArray(inputVal)) {
                    finalResponse = inputVal;
                } else if (inputVal.identifier !== undefined && inputVal.identifier !== 0 && inputVal.identifier !== -1) {
                    finalResponse = [{ identifier: inputVal.identifier, count: inputVal.count !== undefined ? inputVal.count : -1 }];
                } else {
                    const rawCh = inputVal.ch || inputVal.accelerator || inputVal.selector || inputVal.letter || 0;
                    finalResponse = typeof rawCh === 'number' ? rawCh : (typeof rawCh === 'string' && rawCh.length > 0 ? rawCh.charCodeAt(0) : 0);
                }
            }
        } else if (this.currentPromptCategory === PROMPT_CATEGORY.YN) {
            if (typeof inputVal === 'number') {
                finalResponse = inputVal;
            } else if (typeof inputVal === 'string' && inputVal.length > 0) {
                finalResponse = inputVal.charCodeAt(0);
            } else if (Array.isArray(inputVal) && inputVal.length > 0) {
                finalResponse = typeof inputVal[0] === 'number' ? inputVal[0] : String(inputVal[0]).charCodeAt(0);
            }
        } else if (this.currentPromptCategory === PROMPT_CATEGORY.TEXT || 
                 this.currentPromptCategory === PROMPT_CATEGORY.ASKNAME || 
                 this.currentPromptCategory === PROMPT_CATEGORY.FILE ||
                 this.currentPromptCategory === PROMPT_CATEGORY.EXTCMD) {
            if (typeof inputVal === 'string') {
                finalResponse = inputVal;
            }
        } else if (this.currentPromptCategory === PROMPT_CATEGORY.DIRECTION ||
                 this.currentPromptCategory === PROMPT_CATEGORY.POSKEY ||
                 this.currentPromptCategory === PROMPT_CATEGORY.KEY) {
            if (typeof inputVal === 'string' && inputVal.length > 0) {
                finalResponse = inputVal.charCodeAt(0);
            } else if (typeof inputVal === 'number') {
                finalResponse = inputVal;
            }
        }

        const inputStr = typeof inputVal === 'string' ? inputVal.trim() : (typeof inputVal === 'number' && inputVal > 0 ? String.fromCharCode(inputVal) : '');
        if (inputStr) {
            this.emit('userActionSent', { sequence: [inputStr] });

            // プレフィックスキー（5, g, G, m, M, F, _, n）の追跡
            const prefixKeys = new Set(['5', 'g', 'G', 'm', 'M', 'F', '_', 'n']);
            if (prefixKeys.has(inputStr)) {
                this.isPendingPrefix = true;
            } else {
                this.isPendingPrefix = false;
            }
        }

        // ユーザーの手動入力時、実行中のサイレント同期タスクがあれば手動入力を優先して安全にキャンセル
        if (this.driver && typeof this.driver.cancelSequence === 'function') {
            if (this.driver.currentTask && this.driver.currentTask.options && this.driver.currentTask.options.isSilentSync) {
                this.driver.cancelSequence();
            }
        }

        try {
            if (typeof resolver.respond === 'function') {
                resolver.respond(finalResponse);
            } else if (typeof resolver === 'function') {
                resolver(finalResponse);
            }
        } catch (e) {
            console.error('[WebUICore] Error resolving prompt:', e);
        }
    }

    sendKey(inputVal, shift = false, ctrl = false, alt = false, rawKey = '', bypassDebounce = false) {
        if (!this.activeResolver) return;

        const shouldBypassDebounce = bypassDebounce || this.isPendingPrefix;
        if (!shouldBypassDebounce && this.lastInputTime && (Date.now() - this.lastInputTime < 120)) {
            return;
        }

        const modifierKeys = [
            'Shift', 'ShiftLeft', 'ShiftRight',
            'Control', 'ControlLeft', 'ControlRight',
            'Alt', 'AltLeft', 'AltRight',
            'Meta', 'MetaLeft', 'MetaRight',
            'CapsLock', 'Tab'
        ];
        if (typeof inputVal === 'string' && modifierKeys.includes(inputVal)) {
            return;
        }

        const convertToAscii = () => {
            if (rawKey && rawKey.length === 1 && !ctrl && !alt) {
                return rawKey.charCodeAt(0);
            }
            if (typeof inputVal === 'string' && inputVal.length === 1 && !ctrl && !alt) {
                return inputVal.charCodeAt(0);
            }

            const codeStr = typeof inputVal === 'string' ? inputVal : '';

            const specialKeyMap = {
                'Space': 32,
                'Enter': 13,
                'Escape': 27,
                'Backspace': 8,
                'Tab': 9,
                'ArrowUp': 56,    // '8' (ASCII 56)
                'ArrowDown': 50,  // '2' (ASCII 50)
                'ArrowLeft': 52,  // '4' (ASCII 52)
                'ArrowRight': 54, // '6' (ASCII 54)
                'Numpad8': 56,
                'Numpad2': 50,
                'Numpad4': 52,
                'Numpad6': 54,
                'Numpad7': 55,    // '7'
                'Numpad9': 57,    // '9'
                'Numpad1': 49,    // '1'
                'Numpad3': 51,    // '3'
                'Numpad5': 53,    // '5' (ASCII 53)
                'Period': shift ? 62 : 46,     // '.' or '>'
                'Comma': shift ? 60 : 44,      // ',' or '<'
                'Slash': shift ? 63 : 47,      // '/' or '?'
                'Minus': shift ? 95 : 45,      // '-' or '_' (Travel key ASCII 95)
                'Equal': shift ? 43 : 61,      // '=' or '+'
                'BracketLeft': shift ? 123 : 91,// '[' or '{'
                'BracketRight': shift ? 125 : 93,// ']' or '}'
                'Backslash': shift ? 124 : 92, // '\' or '|'
                'Semicolon': shift ? 58 : 59,  // ';' or ':'
                'Quote': shift ? 34 : 39,      // "'" or '"'
                'Backquote': shift ? 126 : 96, // '`' or '~'
                'IntlRo': shift ? 95 : 92,     // '_' (JIS Travel Key ASCII 95)
                'IntlYen': shift ? 124 : 92,
                'Hash': 35
            };

            if (codeStr && specialKeyMap[codeStr] !== undefined) {
                return specialKeyMap[codeStr];
            }

            if (KEYMAP && KEYMAP[codeStr]) {
                const map = KEYMAP[codeStr];
                if (ctrl && map[2] !== undefined && map[2] !== null) return map[2];
                if (shift && map[1] !== undefined && map[1] !== null) return map[1];
                if (map[0] !== undefined && map[0] !== null) return map[0];
            }

            if (codeStr.startsWith('Key') && codeStr.length === 4) {
                const ch = codeStr.charAt(3);
                if (ctrl) return (ch.toUpperCase().charCodeAt(0)) & 0x1f;
                if (alt) return (ch.toLowerCase().charCodeAt(0)) | 0x80;
                return (shift ? ch.toUpperCase() : ch.toLowerCase()).charCodeAt(0);
            }

            if (codeStr.startsWith('Digit') && codeStr.length === 6) {
                const dStr = codeStr.charAt(5);
                if (shift && dStr === '3') return 35; // '#'
                return dStr.charCodeAt(0);
            }

            if (typeof inputVal === 'number') return inputVal;

            if (codeStr.length === 1) {
                if (ctrl) return (codeStr.toUpperCase().charCodeAt(0)) & 0x1f;
                return codeStr.charCodeAt(0);
            }

            return 32;
        };

        const asciiCode = convertToAscii();
        this.respond(asciiCode);
    }

    /**
     * 多段階プロンプト操作用のキーシーケンス（例: ['a', 'f', 'l']）を安全なディレイ間隔で非同期連続送信
     * @param {Array<string>} keys - 送信キーの配列
     * @param {number} [delayMs=200] - キー間の待機ミリ秒
     */
    async sendKeySequence(keys, delayMs = 200) {
        if (!Array.isArray(keys) || keys.length === 0) return;

        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            this.sendKey(k, false, false, false, k, true);
            if (i < keys.length - 1) {
                await new Promise(res => setTimeout(res, delayMs));
            }
        }
    }

    /**
     * EXTCMD 拡張コマンド（#loot, #chat, #untrap, #pray 等）を安全に非同期連続実行
     * @param {string} extCmdName - 拡張コマンド名 ('loot', 'chat', 'untrap', 'pray', etc.)
     * @param {string} [directionKey=null] - オプションの方向キー ('l', 'k', etc.)
     * @param {Object} [options={}] - オプション
     */
    async sendExtCommand(extCmdName, directionKey = null, options = {}) {
        if (!extCmdName) return;
        const cleanCmd = typeof extCmdName === 'string' ? extCmdName.replace(/^#+/, '').trim() : '';
        if (!cleanCmd) return;

        const tokens = ['#', cleanCmd];
        if (directionKey) {
            tokens.push(directionKey);
        }

        if (this.gkl && this.gkl.requestController) {
            this.gkl.requestController.executeSequence(tokens, options);
        } else if (this.driver && typeof this.driver.queueSequence === 'function') {
            this.driver.queueSequence(tokens, options);
        }
    }

    /**
     * キー表現 (例: 'o', 'C-d', 'a') を判別し、制御キーおよび NumPad / Vi-keys キーモードに応じて正しく送信する内部ヘルパー
     * @param {string} k 
     */
    sendActionKey(k) {
        if (!k) return;
        const isNumpad = (this.gkl && this.gkl.areaStateManager && this.gkl.areaStateManager.keyMode === 'numpad');

        // 【1】Kick (蹴る) のキー表現の自動切替 (NumPad モードでは 'k', Vi-keys モードでは Ctrl+D)
        if (k === 'C-d' || k === 'Ctrl-d' || k === 'C-D' || k === 'ctrl-d') {
            if (isNumpad) {
                if (this.activeResolver) {
                    this.respond('k');
                } else {
                    this.sendKey('k', false, false, false, 'k', true);
                }
            } else {
                if (this.activeResolver) {
                    this.respond(4); // Ctrl+D (ASCII 4)
                } else {
                    this.sendKey('d', false, true, false, 'd', true);
                }
            }
            return;
        }

        // 【2】方向キーの Vi-keys ➔ NumPad 自動変換 (numpad モード時)
        let finalKey = k;
        if (isNumpad && typeof k === 'string') {
            const viToNumpadMap = {
                'k': '8', 'u': '9', 'l': '6', 'n': '3',
                'j': '2', 'b': '1', 'h': '4', 'y': '7', '.': '5'
            };
            if (viToNumpadMap[k]) {
                finalKey = viToNumpadMap[k];
            }
        }

        if (this.activeResolver) {
            this.respond(finalKey);
        } else {
            this.sendKey(finalKey, false, false, false, finalKey, true);
        }
    }

    /**
     * 指定されたキーシーケンスが純粋な移動・方向指定・カウント入力等の「所持品に影響しない操作」か判定
     * @param {Array<string|number>} sequence 
     * @returns {boolean}
     */
    isNonItemSequence(sequence) {
        if (this.gkl) {
            return this.gkl.isNonItemSequence(sequence);
        }
        return false;
    }

    /**
     * キーシーケンスを安全に実行し、必要に応じて非同期でサイレント・インベントリ同期を起動する
     * @param {Array<string>} sequence 
     * @param {Object} [options={}] 
     * @returns {Promise<boolean>}
     */
    async executeSequence(sequence, options = {}) {
        if (!Array.isArray(sequence) || sequence.length === 0) return false;

        let success = false;
        if (this.requestController && typeof this.requestController.executeSequence === 'function') {
            success = await this.requestController.executeSequence(sequence, options);
        } else if (this.driver && typeof this.driver.queueSequence === 'function') {
            this.driver.queueSequence(sequence, options);
            success = true;
        } else {
            sequence.forEach(ch => this.sendKey(ch, false, false, false, ch, true));
            success = true;
        }

        this.emit('userActionSent', { sequence });
        return success;
    }

    /**
     * ContextActionEngine が生成した推奨アクション (ContextAction) を安全に実行する。
     * @param {Object} action - recommended action オブジェクト
     * @param {Object} [options={}] - オプション
     */
    executeAction(action, options = {}) {
        if (this.gkl) {
            return this.gkl.executeAction(action, options);
        }
        return false;
    }

    /**
     * キーモード ('vi' または 'numpad') の指定
     * C コアの number_pad オプション変更時やクライアント環境設定時に呼出
     * @param {'vi'|'numpad'} mode 
     */
    setKeyMode(mode) {
        if (this.areaState && typeof this.areaState.setKeyMode === 'function') {
            this.areaState.setKeyMode(mode);
        }
    }

    handleTouchPoint(pageX, pageY, targetRect, scrollX, scrollY) {
        const gridId = this.touch.pointToGridId(pageX, pageY, targetRect, scrollX, scrollY);
        if (gridId >= 0) {
            const keys = this.touch.gridIdToKey(gridId);
            if (keys) {
                this.sendKey(keys);
            }
        }
    }

    /**
     * ターゲットナレッジ機能の動的 ON / OFF トグル
     * @param {boolean} enabled 
     */
    setKnowledgeEnabled(enabled) {
        const active = !!enabled;
        if (this.promptPayloadBuilder) {
            this.promptPayloadBuilder.setKnowledgeEnabled(active);
        }
    }

    /**
     * 生の KeyboardEvent を自動変換して NetHack コアへ送信する
     *
     * @param {KeyboardEvent} event - ブラウザの KeyboardEvent
     * @returns {boolean} 送信成功の有無
     */
    sendKeyEvent(event) {
        if (!event) return false;
        const mappedInput = this.keyMapper.mapKeyEvent(event);
        if (mappedInput !== null) {
            if (typeof event.preventDefault === 'function') {
                event.preventDefault();
            }
            this.sendKey(mappedInput, !!event.shiftKey, !!event.ctrlKey, !!event.altKey, event.key);
            return true;
        }
        return false;
    }

    /**
     * 汎用アクション名 ('MOVE_UP', 'CONFIRM', 'CANCEL' 等) からコマンドキーを送信する
     *
     * @param {string} actionName - アクション名
     * @returns {boolean} 送信成功の有無
     */
    sendAction(actionName) {
        const mappedKey = this.keyMapper.mapAction(actionName);
        if (mappedKey !== null) {
            this.sendKey(mappedKey);
            return true;
        }
        return false;
    }

    /**
     * セーブデータの完全削除 Safe API
     *
     * @param {string} [targetFilename] - 削除対象ファイル名 (未指定時は自プレイヤーセーブ)
     * @returns {Promise<boolean>}
     */
    async deleteSaveFile(targetFilename) {
        if (this.driver) {
            if (typeof this.driver.deleteSaveFile === 'function') {
                return await this.driver.deleteSaveFile(targetFilename);
            } else if (this.driver.fsManager && typeof this.driver.fsManager.deleteSaveFile === 'function') {
                return await this.driver.fsManager.deleteSaveFile(targetFilename);
            }
        }
        return false;
    }

    /**
     * ストレージ全削除のエイリアス互換 API
     */
    async clearAllStorage() {
        return await this.deleteSaveFile();
    }

    /**
     * Worker / WASM のクリーン再起動 API
     *
     * @param {Object} [options] - 再起動オプション
     * @param {boolean} [options.clearStorage=false] - true の場合のみ VFS セーブファイルおよびストレージを消去
     * @param {boolean} [options.autoStart=true] - true の場合、自動的に Wasm の再起動 (start) を実行する
     * @param {string} [options.wasmJsUrl='nethack.js'] - Wasm JS の URL パス
     * @param {Object} [options.startOptions={}] - start メソッドに渡す起動オプション
     * @returns {Promise<boolean>}
     */
    async restart(options = {}) {
        this.activeResolver = null;
        this.activeMenuItems = [];
        this.currentPromptCategory = PROMPT_CATEGORY.NONE;
        this.currentPromptChoices = '';
        this.isPendingPrefix = false;
        if (this.textWindowManager) {
            this.textWindowManager.resetAll();
        }
        this.lastDlevel = undefined;
        this.lastDlevelText = undefined;
        this.statusAccessor = new StatusAccessor();

        // clearStorage: true が明示された場合のみセーブデータ・ストレージを破棄
        if (options.clearStorage === true) {
            await this.deleteSaveData();
        }

        if (this.renderer && typeof this.renderer.clearMap === 'function') {
            this.renderer.clearMap();
        }

        this.emit('map_cleared');
        this.emit('inputResolved');

        if (this.driver && typeof this.driver.restart === 'function') {
            await this.driver.restart(options);
        }

        this._setState(CoreState.INITIALIZING);
        this.emit('restarted');

        // autoStart が false でない場合は自動で start() を呼び出してメインループを再開
        if (options.autoStart !== false) {
            const wasmJsUrl = options.wasmJsUrl || 'nethack.js';
            const startOpts = Object.assign({}, options.startOptions, {
                forceNewGame: options.clearStorage === true
            });
            // バックグラウンドでゲーム起動プロミスを開始
            this.start(wasmJsUrl, startOpts).catch(err => {
                console.error("[WebUICore] Error starting game after restart:", err);
            });
        }

        return true;
    }

    /**
     * inputRequired イベント用の GUI 構造化データ (guiData) を構築する
     *
     * @param {Object} payload - 生の inputRequired イベントデータ
     * @returns {Object} 構造化データオブジェクト
     */
    _buildGUIInputPayload(payload) {
        return this.promptPayloadBuilder ? this.promptPayloadBuilder.build(payload) : payload;
    }

    async resolveGameOver() {
        const status = typeof this.getStatus === 'function' ? this.getStatus() : null;
        let detectedName = status && status.title ? status.title : null;
        if (!detectedName && this.driver && this.driver.fsManager && typeof this.driver.fsManager.autoDetectSavePlayerName === 'function') {
            detectedName = this.driver.fsManager.autoDetectSavePlayerName();
        }
        if (!detectedName && this.driver && this.driver.options && this.driver.options.gameOptions) {
            detectedName = this.driver.options.gameOptions.name;
        }

        const sessionInfo = {
            playerName: detectedName || 'Hero',
            startTime: this.startTime,
            version: '5.0.0'
        };
        const result = await GameOverResolver.resolveGameOver(this.driver, sessionInfo, { translator: this.translator });
        if (result && result.isGameOver && result.death) {
            const translatedDeath = this.translator.translate(result.death);
            result.translatedDeath = translatedDeath;
            result.translatedDeathMessage = `${result.playerName || 'Hero'} は ${translatedDeath}`;
        }
        this.emit('gameOver', result);
        return result;
    }

    destroy() {
        if (this.gamepadLoopId) {
            cancelAnimationFrame(this.gamepadLoopId);
            this.gamepadLoopId = null;
        }
        this.listeners.clear();
    }

    _initRenderer() {
        if (this.renderer && typeof this.renderer.init === 'function') {
            this.renderer.init();
        }
    }

    _bindDriverEvents() {
        // curs / curs_nhwindow (ターゲットカーソル移動イベント)
        const handleCursorMove = (data) => {
            if (data && data.x !== undefined && data.y !== undefined) {
                const prevX = this.cursorX;
                const prevY = this.cursorY;
                const posChanged = (prevX !== data.x || prevY !== data.y);

                this.cursorX = data.x;
                this.cursorY = data.y;

                if (posChanged) {
                    this.emit('cursor', { x: data.x, y: data.y, windowId: data.windowId });
                }
                this.emit('curs', data);
            }
        };
        this.driver.on('curs', handleCursorMove);
        this.driver.on('curs_nhwindow', handleCursorMove);

        // clear_nhwindow (マップウィンドウ等の消去責務を Core/Renderer 側で自動解決)
        this.driver.on('clear_nhwindow', (data) => {
            if (data.windowId >= 4 && this.textWindowManager) {
                this.textWindowManager.clearWindow(data.windowId);
            }
            if (data.windowId === 2 || data.windowId === 0) {
                if (this.renderer && typeof this.renderer.clearMap === 'function') {
                    this.renderer.clearMap();
                }
            }
            this.emit('clear_nhwindow', data);
        });

        // print_glyph
        this.driver.on('print_glyph', (data) => {
            if (!data) return;
            const x = data.x;
            const y = data.y;
            const gi = data.glyphInfo || data;
            const glyphId = gi.glyph !== undefined ? gi.glyph : (data.glyph !== undefined ? data.glyph : -1);
            const ch = gi.ch || data.ch || ' ';
            const color = gi.color !== undefined ? gi.color : (data.color !== undefined ? data.color : 7);

            const parsedData = { windowId: data.windowId, x, y, glyph: glyphId, ch, color, glyphInfo: gi };
            this.renderer.drawGlyph(x, y, parsedData);
            this.emit('print_glyph', parsedData);
        });

        // putstr メッセージ・テキストログ分離処理
        const handleMessageText = (rawText) => {
            if (!rawText) return;
            this.emit('messageText', { windowId: 1, text: rawText });
            const translated = this.translator.translate(rawText);

            const seEffect = this.sound.processLogMessage(translated);
            if (seEffect) {
                this.emit('soundEffect', seEffect);
            }
            this.renderer.appendMessage(translated);
            this.emit('message', translated);
        };

        this.driver.on('putstr', (data) => {
            const windowId = data.windowId !== undefined ? data.windowId : 1;
            const rawText = data.text || '';

            if (rawText.trim()) {
                this.lastPutstrText = rawText.trim();
            }

            if (windowId === 1 || windowId === 0) {
                handleMessageText(rawText);
            }

            if (windowId >= 4 && this.textWindowManager) {
                this.textWindowManager.appendLine(windowId, rawText);
            }
        });

        this.driver.on('raw_print', (data) => {
            if (data && data.text) handleMessageText(data.text);
        });
        this.driver.on('raw_print_bold', (data) => {
            if (data && data.text) handleMessageText(data.text);
        });

        this.driver.on('putmsghistory', (data) => {
            if (data && data.text && !data.restoring) {
                handleMessageText(data.text);
            }
        });

        // status_update (ダンジョン分岐文字列 Dlvl:1 <-> Tutorial:1 の変化を検知して自動マップクリア)
        this.driver.on('status_update', (data) => {
            if (data && data.field !== undefined) {
                const valChanged = this.statusAccessor ? this.statusAccessor.updateField(data.field, data.value) : false;
                this.renderer.updateStatus(data);
                
                const structuredStatus = this.getStatus();
                const currentDlevelText = structuredStatus.dlevel ? structuredStatus.dlevel.text : '';

                if (this.lastDlevelText !== undefined && currentDlevelText && this.lastDlevelText !== currentDlevelText) {
                    if (this.renderer && typeof this.renderer.clearMap === 'function') {
                        this.renderer.clearMap();
                    }
                    this.emit('map_cleared');
                }
                if (currentDlevelText) {
                    this.lastDlevelText = currentDlevelText;
                }

                this.emit('status_update', data);
                if (valChanged) {
                    this.emit('statusUpdate', {
                        field: data.field,
                        value: data.value,
                        change: data.change,
                        color: data.color,
                        allFields: structuredStatus.allFields,
                        status: structuredStatus
                    });
                }
            }
        });

        // display_file (VFS 探査 ➔ HTTP fetch オンデマンド取得による完璧なローカライズ表示)
        this.driver.on('display_file', async ({ filename, complain, fileText, resolver }) => {
            if (!resolver) return;

            this.activeResolver = resolver;
            this.currentPromptCategory = PROMPT_CATEGORY.FILE;
            this.lastInputTime = Date.now();

            const FS = (typeof globalThis !== 'undefined' && globalThis.FS) ? globalThis.FS :
                       (this.driver && this.driver.fsManager ? this.driver.fsManager.FS :
                       (this.driver && typeof this.driver.getModule === 'function' && this.driver.getModule() ? this.driver.getModule().FS : null));

            // VFS チェックおよび HTTP fetch オンデマンド取得を非同期実行
            const targetText = await this.translator.resolveFileText(filename, fileText, FS);

            const fileLines = targetText ? targetText.split('\n') : [];
            const promptTitle = `${filename} (${fileLines.length} lines)`;

            const payload = {
                category: PROMPT_CATEGORY.FILE,
                promptCategory: PROMPT_CATEGORY.FILE,
                choices: ' ',
                filename: filename,
                prompt: promptTitle,
                rawPrompt: filename,
                lines: fileLines,
                text: targetText,
                safeResolver: resolver,
                resolver: resolver,
                buttonOverlay: this.gamepad.getButtonOverlay(PROMPT_CATEGORY.FILE, ' ')
            };

            this.renderer.showPrompt(payload);
            this.emit('textWindowModal', { lines: fileLines, resolver, payload });
            this.emit('inputRequired', payload);
        });

        // display_nhwindow ブロッキング解凍判別 ＆ テキストウィンドウモータル発火
        this.driver.on('display_nhwindow', ({ windowId, blocking, resolver }) => {
            if (!resolver) return;

            if (!blocking && windowId <= 3) {
                resolver.respond(0);
                return;
            }

            this.activeResolver = resolver;
            this.currentPromptCategory = PROMPT_CATEGORY.KEY;
            this.lastInputTime = Date.now();

            let bufferLines = [];
            if (this.textWindowManager && this.textWindowManager.hasBuffer(windowId)) {
                const flushed = this.textWindowManager.flushBuffer(windowId);
                if (flushed && flushed.lines) {
                    const rawBufferLines = flushed.lines;
                    bufferLines = rawBufferLines.map(l => this.translator.translate(l));
                }
            }


            const rawPrompt = bufferLines.length > 0 ? bufferLines[0] : 'Press Space or Enter to continue...';
            const translatedPrompt = this.translator.translate(rawPrompt);

            const payload = {
                category: PROMPT_CATEGORY.KEY,
                promptCategory: PROMPT_CATEGORY.KEY,
                choices: ' ',
                prompt: translatedPrompt,
                rawPrompt: rawPrompt,
                lines: bufferLines,
                windowId: windowId,
                safeResolver: resolver,
                resolver: resolver,
                buttonOverlay: this.gamepad.getButtonOverlay(PROMPT_CATEGORY.KEY, ' ')
            };

            this.renderer.showPrompt(payload);
            this.emit('textWindowModal', { lines: bufferLines, resolver, payload });
            this.emit('inputRequired', payload);
        });

        // inputRequired
        this.driver.on('inputRequired', (payload) => {
            const resolver = payload.safeResolver || payload.resolver;
            this.activeResolver = resolver;

            const category = payload.promptCategory || this.driver.getPromptCategory(payload.context || payload.type) || PROMPT_CATEGORY.OTHER;
            this.currentPromptCategory = category;
            this.currentPromptChoices = payload.choices || '';

            // カウントプレフィックス待機中（「5」キー入力直後の移動キー待ち等）の検出
            const lastText = (this.lastPutstrText || '').toLowerCase();
            const isPrefixWaiting = Boolean(this.isPendingPrefix) || 
                                    lastText.includes('プレフィックス') || 
                                    lastText.includes('prefix') || 
                                    (lastText.includes('count') && lastText.includes('command'));

            // 未同期ステート（所持品・魔法等）があれば裏で自動サイレント同期を一元依頼（直列・排他制御で安全に実行）
            if (this.gkl && typeof this.gkl.syncPendingStateSilent === 'function' && !isPrefixWaiting) {
                this.gkl.syncPendingStateSilent();
            } else if (this.gkl && this.gkl.inventoryStateManager && !this.gkl.inventoryStateManager.isSynced && !isPrefixWaiting) {
                this.gkl.syncInventorySilent();
            }

            this.lastInputTime = Date.now();

            let rawPrompt = payload.prompt || payload.question || payload.message || '';
            if ((!rawPrompt || rawPrompt === 'Press Space or Enter to continue...') && (category === PROMPT_CATEGORY.EXTCMD || payload.context === 'extcmd')) {
                rawPrompt = '#Which extended command?';
            }
            const translatedPrompt = this.translator.translate(rawPrompt);

            // ASKNAME ("Who are you?") プロンプト検出時:
            // 「続きから再開」時またはセーブデータが存在する場合は自動応答してスキップし、新規開始時（セーブなし）のみユーザーに名前を入力させる
            if (category === PROMPT_CATEGORY.ASKNAME || rawPrompt.includes('Who are you') || rawPrompt.includes('your name') || payload.context === 'askname') {
                if (this.isResumingSave || this.resumeSavePlayerName) {
                    const finalName = this.resumeSavePlayerName || payload.detectedName || 'Hero';
                    if (this.gkl && this.gkl.inventoryStateManager) {
                        this.gkl.inventoryStateManager.invalidate();
                    }
                    if (this.gkl && this.gkl.spellStateManager) {
                        this.gkl.spellStateManager.invalidate();
                    }
                    this.respond(finalName.trim());
                    return;
                }
            }

            const rawItems = payload.items || payload.menuItems || [];
            const translatedItems = rawItems.map((item, index) => {
                let itemStr = '';
                if (typeof item === 'string') itemStr = item;
                else if (item) {
                    itemStr = item.str || item.text || item.title || '';
                    if (typeof itemStr === 'object') {
                        itemStr = itemStr.jp || itemStr.en || itemStr.text || itemStr.str || '';
                    }
                }

                //const rawCh = item ? (item.ch !== undefined && item.ch !== 0 && item.ch !== '\0' ? item.ch : (item.accelerator || item.selector || item.letter || (typeof itemStr === 'string' ? itemStr.match(/^([a-zA-Z])[\s\-\.\)]/)?.[1] : 0))) : 0;
                const rawCh = item ? (item.ch !== undefined && item.ch !== 0 ? item.ch : item.accelerator) : 0;
                let charCode = 0;
                let charStr = '';
                let isSelectable = false;

                if (rawCh !== undefined && rawCh !== 0 && rawCh !== '\0') {
                    isSelectable = true;
                    if (typeof rawCh === 'number') {
                        charCode = rawCh;
                        charStr = String.fromCharCode(rawCh);
                    } else if (typeof rawCh === 'string' && rawCh.length > 0) {
                        charCode = rawCh.charCodeAt(0);
                        charStr = rawCh;
                    }
                } else if (item && item.identifier !== undefined && item.identifier !== 0 && item.identifier !== -1) {
                    isSelectable = true;
                    charCode = 97 + index;
                    charStr = String.fromCharCode(charCode);
                } //else if (item && (item.text || item.str)) {
                  //何かしらの項目テキストが存在する場合は選択可能アイテムとして補償
                  //  isSelectable = true;
                //}

                return {
                    ...item,
                    isSelectable: isSelectable,
                    ch: charCode,
                    charStr: charStr,
                    accelerator: charCode,
                    str: this.translator.translate(itemStr),
                    rawStr: itemStr
                };
            });

            // UIのアクティブメニュー項目としてのみ保持 (GKL インベントリの更新は自発同期 syncInventorySilent のみに一元化)
            this.activeMenuItems = translatedItems;




            const basePayload = {
                ...payload,
                category: category,
                promptCategory: category,
                prompt: translatedPrompt,
                rawPrompt: rawPrompt,
                items: translatedItems,
                menuItems: translatedItems,
                safeResolver: resolver,
                resolver: resolver,
                buttonOverlay: this.gamepad.getButtonOverlay(category, this.currentPromptChoices)
            };

            const guiData = this._buildGUIInputPayload(basePayload);
            const passThroughPayload = {
                ...basePayload,
                ...guiData,
                guiData: guiData,
                guiInput: guiData
            };

            this.renderer.showPrompt(passThroughPayload);
            this.emit('inputRequired', passThroughPayload);
        });

        // inputResolved
        this.driver.on('inputResolved', () => {
            this.activeResolver = null;
            this.activeMenuItems = [];
            this.currentPromptCategory = PROMPT_CATEGORY.NONE;
            this.currentPromptChoices = '';
            this.renderer.hidePrompt();
            this.emit('inputResolved');
        });

        // exited
        this.driver.on('exited', async (data) => {
            this.activeResolver = null;
            this.activeMenuItems = [];
            this.isPendingPrefix = false;
            this.currentPromptCategory = PROMPT_CATEGORY.NONE;
            this.currentPromptChoices = '';
            this.lastPutstrText = '';
            this.renderer.hidePrompt();

            const result = await this.resolveGameOver();
            if (result && result.isGameOver) {
                this.renderer.appendMessage(`[GAME EXITED] ${result.deathMessage}`);
                this._setState(CoreState.GAME_OVER);
            } else {
                this._setState(CoreState.EXITED);
            }

            this.emit('inputResolved');
            this.emit('exited', Object.assign({}, data, { gameOverResult: result }));
        });
    }

    _startGamepadPolling() {
        if (typeof requestAnimationFrame === 'undefined') return;

        const poll = () => {
            if (this.activeResolver) {
                const keys = this.gamepad.pollInput(this.currentPromptCategory, this.currentPromptChoices);
                if (keys && keys.length > 0) {
                    keys.forEach(k => this.sendKey(k));
                }
            }
            this.gamepadLoopId = requestAnimationFrame(poll);
        };

        this.gamepadLoopId = requestAnimationFrame(poll);
    }
}
