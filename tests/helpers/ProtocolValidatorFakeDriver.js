/**
 * ProtocolValidatorFakeDriver.js
 * 
 * 【第2防壁: 契約検査フェイクドライバー (Protocol Validator Fake Driver)】
 * 
 * テスト環境において NetHackWasmDriver のキー入力ステートマシンインターフェースをシミュレートし、
 * 動的プレースホルダー（${invlet} 等）解決後のキーストローク列が、C コアの入力規約および各 Shim コンテキストに
 * 適合して過不足なく最後まで完走できるかを厳密に契約検査（Design by Contract）するヘルパー。
 */

import { NetHackWasmDriver } from '../../src/driver/NetHackWasmDriver.js';
import { VALID_DIR_CODES } from '../../src/testing/SequenceProtocolValidator.js';

export class ProtocolValidatorFakeDriver {
    constructor(options = {}) {
        this.options = options;
        this.tokens = [];
        this.history = [];
        this.currentSequenceId = null;
        this.isCompleted = false;
    }

    /**
     * キーシーケンスをキューに投入
     * @param {Array<string|number>} tokens 
     * @param {Object} [options={}] 
     * @returns {ProtocolValidatorFakeDriver}
     */
    queueSequence(tokens, options = {}) {
        if (!Array.isArray(tokens)) {
            throw new Error(`[ProtocolValidatorFakeDriver] tokens must be an array, got ${typeof tokens}`);
        }
        if (tokens.length === 0) {
            throw new Error('[ProtocolValidatorFakeDriver] tokens array cannot be empty');
        }

        this.tokens = [...tokens];
        this.currentSequenceId = options.sequenceId || `seq_${Date.now()}`;
        this.isCompleted = false;
        this.history = [];
        return this;
    }

    /**
     * 残存トークン配列を取得（イミュータブル）
     * @returns {Array<string|number>}
     */
    get remainingTokens() {
        return [...this.tokens];
    }

    /**
     * 次のトークンを安全に取り出し、共通規約（プレースホルダー、改行文字）を検証
     * @private
     * @param {string} contextName 
     * @returns {string}
     */
    _consumeToken(contextName) {
        if (this.tokens.length === 0) {
            throw new Error(
                `[ProtocolValidatorFakeDriver] Unexpected end of sequence in context "${contextName}". ` +
                `The sequence terminated prematurely while the core still expected input. ` +
                `History: [${this.history.map(h => JSON.stringify(h.token)).join(', ')}]`
            );
        }

        const rawToken = this.tokens.shift();
        const strToken = String(rawToken);

        // 1. 未解決プレースホルダー検査
        if (/\$\{[^}]+\}/.test(strToken)) {
            throw new Error(
                `[ProtocolValidatorFakeDriver] Unresolved placeholder "${strToken}" consumed in context "${contextName}". ` +
                `All dynamic placeholders (e.g. \${invlet}, \${targetDir}) must be resolved before queuing.`
            );
        }

        // 2. 禁止改行文字検査
        if (strToken.includes('\n') || strToken.includes('\r')) {
            throw new Error(
                `[ProtocolValidatorFakeDriver] Token "${strToken}" in context "${contextName}" contains forbidden newline characters (\\n or \\r).`
            );
        }

        this.history.push({ context: contextName, token: rawToken });
        return strToken;
    }

    /**
     * poskey (自由ターン行動入力) のステップ消費と規約検査
     * 規約: 長さ 1 の ASCII 文字、または抽象方向コード ('DIR_*')、または '#'
     * @returns {string}
     */
    stepPoskey() {
        const token = this._consumeToken('poskey');

        const isDir = token.startsWith('DIR_');
        if (isDir) {
            if (!VALID_DIR_CODES.has(token)) {
                throw new Error(`[ProtocolValidatorFakeDriver] Invalid direction code "${token}" in poskey.`);
            }
            return token;
        }

        if (token.length !== 1) {
            throw new Error(
                `[ProtocolValidatorFakeDriver] poskey requires a single character or valid direction code, but got "${token}" (length: ${token.length}).`
            );
        }

        return token;
    }

    /**
     * get_ext_cmd (拡張コマンド入力) のステップ消費と規約検査
     * 規約: DEFAULT_EXTCMDS に存在する有効なコマンド名（'#' 接頭辞は任意許容）
     * @returns {string}
     */
    stepExtCmd() {
        const token = this._consumeToken('get_ext_cmd');
        const cleanCmd = token.trim().toLowerCase().replace(/^#/, '');

        const validExtCmds = NetHackWasmDriver.DEFAULT_EXTCMDS;
        if (!validExtCmds.includes(cleanCmd)) {
            throw new Error(
                `[ProtocolValidatorFakeDriver] Unknown extended command "${token}" in get_ext_cmd. ` +
                `Must be one of DEFAULT_EXTCMDS (e.g. "pray", "engrave", "chat", etc.).`
            );
        }

        return cleanCmd;
    }

    /**
     * yn_function ([yn] / 選択肢付き確認プロンプト) のステップ消費と規約検査
     * 規約: 選択肢 (choices) に含まれる単一文字、または ESC (\x1b)
     * @param {string} [choices=""] 許容文字一覧 (例: "yn", "y/n/q")
     * @param {string} [def=""] デフォルト選択肢
     * @returns {string}
     */
    stepYn(choices = "", def = "") {
        const token = this._consumeToken('yn_function');

        if (token.length !== 1 && token !== '\x1b') {
            throw new Error(
                `[ProtocolValidatorFakeDriver] yn_function expects a single character answer, but got "${token}".`
            );
        }

        if (choices && typeof choices === 'string' && choices.length > 0) {
            const cleanChoices = choices.replace(/[^a-zA-Z0-9?*]/g, '');
            if (token !== '\x1b' && cleanChoices.length > 0 && !cleanChoices.includes(token)) {
                throw new Error(
                    `[ProtocolValidatorFakeDriver] Choice "${token}" not in allowed choices "${choices}" for yn_function.`
                );
            }
        }

        return token;
    }

    /**
     * getlin (自由文字列入力: 名前・刻み文字等) のステップ消費と規約検査
     * 規約: 任意の文字列（ただし改行は不可）
     * @returns {string}
     */
    stepGetlin() {
        return this._consumeToken('getlin');
    }

    /**
     * getch (Moreプロンプト、方向確認等) のステップ消費と規約検査
     * 規約: 単一キー、または抽象方向コード
     * @returns {string}
     */
    stepGetch() {
        const token = this._consumeToken('getch');
        if (token.startsWith('DIR_')) {
            if (!VALID_DIR_CODES.has(token)) {
                throw new Error(`[ProtocolValidatorFakeDriver] Invalid direction code "${token}" in getch.`);
            }
            return token;
        }
        if (token.length !== 1 && token !== '\x1b') {
            throw new Error(`[ProtocolValidatorFakeDriver] getch expects a single character, got "${token}".`);
        }
        return token;
    }

    /**
     * select_menu (インベントリ選択・メニュー等) のステップ消費と規約検査
     * @param {string|Array<string>} [choices] 選択肢
     * @returns {string}
     */
    stepSelectMenu(choices = null) {
        const token = this._consumeToken('select_menu');
        if (choices && Array.isArray(choices) && choices.length > 0) {
            if (!choices.includes(token) && token !== ' ' && token !== '0' && token !== '\x1b') {
                throw new Error(
                    `[ProtocolValidatorFakeDriver] Menu selection "${token}" not in allowed menu choices [${choices.join(', ')}].`
                );
            }
        }
        return token;
    }

    /**
     * シーケンスが過不足なく完全に消費されたことをアサート
     */
    assertCompleted() {
        if (this.tokens.length > 0) {
            throw new Error(
                `[ProtocolValidatorFakeDriver] Sequence has ${this.tokens.length} remaining unconsumed tokens: ` +
                `[${this.tokens.map(t => JSON.stringify(t)).join(', ')}]. ` +
                `History of consumed tokens: [${this.history.map(h => JSON.stringify(h.token)).join(', ')}]`
            );
        }
        this.isCompleted = true;
    }
}
