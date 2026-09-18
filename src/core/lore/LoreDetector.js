/**
 * LoreDetector.js - メッセージストリーム LORE シグナル検知器 (モード遷移・文脈駆動型)
 *
 * NetHack C コアから出力されるメッセージストリーム (pline, putstr, messageText) や
 * ウィンドウテキストをリアルタイム監視し、直近メッセージ履歴と状態遷移（State Machine）
 * に基づいて Layer 4 の LORE シグナルを高精度に同定する。
 *
 * 【検知対象シグナル】
 * 1. SIGNAL_LORE_RUMOR   : フォーチュンクッキーや紙片、小預言から得られる噂話 (真偽判定付き)
 * 2. SIGNAL_LORE_ENGRAVE : 床の刻み文字・Elbereth結界状態・文字消え・墓碑銘
 * 3. SIGNAL_LORE_ORACLE  : 神託所の大預言
 */

import { LORE_MASTER } from './data/LoreMasterData.js';
import { ElberethAnalyzer } from './ElberethAnalyzer.js';
import { EngravingArchaeologist } from './EngravingArchaeologist.js';

export class LoreDetector {
    /**
     * @param {Object} [options]
     * @param {Object} [options.master] - カスタム LORE マスタ
     * @param {EngravingArchaeologist} [options.archaeologist] - カスタム復元エンジン
     * @param {number} [options.maxHistory=5] - 保持する直近メッセージ履歴数
     */
    constructor(options = {}) {
        this.master = options.master || LORE_MASTER;
        this.archaeologist = options.archaeologist || new EngravingArchaeologist({ master: this.master });
        this.maxHistory = options.maxHistory || 5;

        // メッセージ履歴バッファ（スライディングウィンドウ）
        this.history = [];

        // 状態マシン (State Machine)
        // 'IDLE' | 'COOKIE_OPENED' | 'COOKIE_READING' | 'ORACLE_RUMOR' | 'ORACLE_MAJOR' | 'ENGRAVE_WAITING_TEXT'
        this.currentMode = 'IDLE';
        this.modeStepsRemaining = 0;
        this.pendingRumorSource = null;
        this.pendingEngraveType = null;
        this.pendingOracleType = null;

        // 高速照合用マップの構築
        this.rumorsByText = new Map();
        this.rumorsByNormText = new Map();
        for (const r of (this.master.rumors || [])) {
            this.rumorsByText.set(r.text, r);
            this.rumorsByNormText.set(this._normalizeText(r.text), r);
        }

        this.oraclesByText = new Map();
        this.oraclesByNormText = new Map();
        this.oraclesFirstLineMap = new Map();
        for (const o of (this.master.oracles || [])) {
            this.oraclesByText.set(o.text, o);
            const norm = this._normalizeText(o.text);
            this.oraclesByNormText.set(norm, o);
            const firstLine = o.text.split('\n')[0].trim();
            if (firstLine) {
                this.oraclesFirstLineMap.set(this._normalizeText(firstLine), o);
            }
        }
    }

    /**
     * テキストの空白・記号正規化
     * @param {string} str
     * @returns {string}
     */
    _normalizeText(str) {
        if (!str) return '';
        return str.replace(/\s+/g, ' ')
                  .replace(/^["'「]/, '')
                  .replace(/["'」][\.]?$/, '')
                  .trim()
                  .toLowerCase();
    }

    /**
     * 噂話マスタとの照合（完全一致、クォート除去一致、正規化一致）
     * @param {string} text
     * @returns {Object|null}
     * @private
     */
    _findRumor(text) {
        if (!text) return null;
        const trimmed = text.trim();
        const unquoted = trimmed.replace(/^["'「]/, '').replace(/["'」][\.]?$/, '').trim();
        const norm = this._normalizeText(trimmed);

        return this.rumorsByText.get(trimmed) ||
               this.rumorsByText.get(unquoted) ||
               this.rumorsByNormText.get(norm) ||
               null;
    }

    /**
     * 神託マスタとの照合
     * @param {string} text
     * @returns {Object|null}
     * @private
     */
    _findOracle(text) {
        if (!text) return null;
        const trimmed = text.trim();
        const norm = this._normalizeText(trimmed);

        return this.oraclesByText.get(trimmed) ||
               this.oraclesByNormText.get(norm) ||
               this.oraclesFirstLineMap.get(norm) ||
               null;
    }

    /**
     * メッセージ文字列を処理し、検知された LORE シグナルを返却
     *
     * @param {string} rawMessage - C コアからの生メッセージ文字列
     * @param {Object} [context={}] - 補足コンテキスト
     * @returns {Object|null} 検知されたシグナルオブジェクト (なければ null)
     */
    processMessage(rawMessage, context = {}) {
        if (!rawMessage || typeof rawMessage !== 'string') {
            return null;
        }

        // サニタイズ: 改行コードを半角スペースへ置換（複数行に渡る大預言の単語結合を防ぐ）、--More-- の除去
        const clean = rawMessage.replace(/[\r\n]+/g, ' ').replace(/--More--/g, '').trim();
        if (!clean) return null;

        // 履歴バッファへの記録
        this.history.push({ raw: rawMessage, clean: clean, time: Date.now() });
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        // ====================================================
        // PHASE 1: 先行文脈・モード開始トリガーの判定
        // ====================================================

        // 1-1. フォーチュンクッキー開封トリガー
        if (clean.includes('This cookie has a scrap of paper inside.') ||
            clean.includes('You break up the cookie and throw away the pieces.') ||
            clean.includes('中に紙切れが入ってい') ||
            clean.includes('クッキーの中に紙切れ') || clean.includes('クッキーには紙片') || clean.includes('紙片が入っている') ||
            clean.includes('あなたはクッキーを割って')) {
            this.currentMode = 'COOKIE_OPENED';
            this.modeStepsRemaining = 3;
            this.pendingRumorSource = 'cookie';
            return null;
        }

        // 1-2. クッキー／紙片 読取トリガー ("It reads:")
        //      - 単独の "It reads:" -> モード遷移して次行待機
        //      - "It reads: <本文>" (結合行) -> そのまま本文判定へ流す
        const readPrefixMatch = clean.match(/^(?:It reads:|そこにはこう書いてある[：:]|こう書かれている[：:]|こう書いてある[：:])\s*(.*)$/i);
        if (readPrefixMatch) {
            const isFromCookie = (this.currentMode === 'COOKIE_OPENED');
            const trailingContent = readPrefixMatch[1].trim();

            this.currentMode = 'COOKIE_READING';
            this.modeStepsRemaining = 2;
            this.pendingRumorSource = isFromCookie ? 'cookie' : (this.pendingRumorSource || 'paper');

            if (!trailingContent) {
                return null;
            }
        }

        // 1-3. 神託所トリガー (Oracle)
        if ((clean.includes('True to her word, the Oracle') && clean.includes('says:')) ||
            (clean.includes('約束どおり、オラクルは') && clean.includes('告げた:'))) {
            this.currentMode = 'ORACLE_RUMOR';
            this.modeStepsRemaining = 2;
            this.pendingRumorSource = 'oracle';
            return null;
        }

        if (clean.includes('The Oracle meditates for a moment and then intones:') ||
            clean.includes('The Oracle scornfully takes all your gold and says:') ||
            clean.includes('オラクルはしばらく瞑想したのち、厳かに口を開いた') ||
            clean.includes('オラクルは軽蔑するようにあなたの全財産を取り上げ')) {
            this.currentMode = 'ORACLE_MAJOR';
            this.modeStepsRemaining = 3;
            this.pendingOracleType = clean.includes('scornfully') ? 'special' : 'normal';
            return null;
        }

        // 1-4. 床の刻み文字・墓碑銘先行トリガー
        //      ※ クッキーモード中ではなく、かつ「同一行に You read: 等の読取部が含まれていない」場合のみ待機モードへ
        const hasInlineRead = /(?:(?:You\s+)?(?:read|feel the words)|(?:あなたは)?(?:読んだ|文字を触って感じた)|Read):\s*["「]/i.test(clean);
        if (this.currentMode !== 'COOKIE_OPENED' && this.currentMode !== 'COOKIE_READING' && !hasInlineRead) {
            if (clean.includes('headstone') || clean.includes('墓石') || /^There is a headstone here/i.test(clean)) {
                this.pendingEngraveType = 'HEADSTONE';
                this.currentMode = 'ENGRAVE_WAITING_TEXT';
                this.modeStepsRemaining = 3;
                return null;
            }
            if (clean.includes('is written here in the dust') || clean.includes('is written here in the frost') || clean.includes('が書かれている')) {
                this.pendingEngraveType = 'DUST';
                this.currentMode = 'ENGRAVE_WAITING_TEXT';
                this.modeStepsRemaining = 3;
                return null;
            }
            if (clean.includes('is engraved here on the') || clean.includes('が刻まれている')) {
                this.pendingEngraveType = 'ENGRAVE';
                this.currentMode = 'ENGRAVE_WAITING_TEXT';
                this.modeStepsRemaining = 3;
                return null;
            }
            if (clean.includes('has been burned into the floor') || clean.includes('has been melted into') || clean.includes('焼き付いて') || clean.includes('溶け込んで')) {
                this.pendingEngraveType = 'BURN';
                this.currentMode = 'ENGRAVE_WAITING_TEXT';
                this.modeStepsRemaining = 3;
                return null;
            }
            if (clean.includes('graffiti') || clean.includes('落書きがある')) {
                this.pendingEngraveType = 'MARK';
                this.currentMode = 'ENGRAVE_WAITING_TEXT';
                this.modeStepsRemaining = 3;
                return null;
            }
            if (clean.includes('scrawled in blood here') || clean.includes('血で殴り書き')) {
                this.pendingEngraveType = 'BLOOD';
                this.currentMode = 'ENGRAVE_WAITING_TEXT';
                this.modeStepsRemaining = 3;
                return null;
            }
        }

        // ====================================================
        // PHASE 2: 現在のモードに基づく本文同定・シグナル発行
        // ====================================================

        // 2-1. クッキーまたは神託所の噂話読取モード (COOKIE_READING / ORACLE_RUMOR)
        if (this.currentMode === 'COOKIE_READING' || this.currentMode === 'ORACLE_RUMOR') {
            let candidate = clean;
            const prefixMatch = clean.match(/^(?:It reads:|そこにはこう書いてある[：:]|こう書かれている[：:])\s*(.*)$/i);
            if (prefixMatch && prefixMatch[1]) {
                candidate = prefixMatch[1].trim();
            }

            const rumor = this._findRumor(candidate);
            if (rumor) {
                const source = (this.currentMode === 'ORACLE_RUMOR') ? 'oracle' : (this.pendingRumorSource || 'cookie');
                this._resetMode();

                return {
                    signalId: 'SIGNAL_LORE_RUMOR',
                    subCategory: 'RUMOR',
                    matched: true,
                    rumorId: rumor.id,
                    text: rumor.text,
                    translatedText: rumor.translatedText,
                    isTrue: rumor.isTrue,
                    source: source,
                    confidence: 1.0,
                    rawPrompt: rawMessage
                };
            }
        }

        // 2-2. 神託所の大預言読取モード (ORACLE_MAJOR)
        if (this.currentMode === 'ORACLE_MAJOR') {
            const oracle = this._findOracle(clean);
            if (oracle) {
                const isSpecial = this.pendingOracleType === 'special' || oracle.isSpecial;
                this._resetMode();

                return {
                    signalId: 'SIGNAL_LORE_ORACLE',
                    subCategory: 'ORACLE',
                    matched: true,
                    oracleId: oracle.id,
                    title: oracle.title,
                    text: oracle.text,
                    translatedText: oracle.translatedText,
                    isSpecial: isSpecial,
                    confidence: 1.0,
                    rawPrompt: rawMessage
                };
            }
        }

        // 2-3. 床の刻み文字・墓碑銘の検知 (SIGNAL_LORE_ENGRAVE)
        //      ※ クッキーモード中ではないこと
        if (this.currentMode !== 'COOKIE_OPENED' && this.currentMode !== 'COOKIE_READING') {
            const readMatch = clean.match(/(?:(?:You\s+)?(?:read|feel the words)|(?:あなたは)?(?:読んだ|文字を触って感じた)|Read):\s*["「](.*?)["」]?[\.]?\s*$/i);
            if (readMatch) {
                const actualText = readMatch[1];

                let engraveType = this.pendingEngraveType;
                if (clean.includes('headstone') || clean.includes('墓石')) {
                    engraveType = 'HEADSTONE';
                } else if (clean.includes('dust') || clean.includes('frost') || clean.includes('が書かれている')) {
                    engraveType = 'DUST';
                } else if (clean.includes('engraved') || clean.includes('刻まれている')) {
                    engraveType = 'ENGRAVE';
                } else if (clean.includes('burned') || clean.includes('melted') || clean.includes('焼き付いて') || clean.includes('溶け込んで')) {
                    engraveType = 'BURN';
                } else if (clean.includes('graffiti') || clean.includes('落書きがある')) {
                    engraveType = 'MARK';
                } else if (clean.includes('blood') || clean.includes('血で殴り書き')) {
                    engraveType = 'BLOOD';
                }
                engraveType = engraveType || 'UNKNOWN';

                const isHeadstone = engraveType === 'HEADSTONE';

                const analysis = isHeadstone ? {
                    actualText: actualText,
                    pristineText: actualText,
                    isElbereth: false,
                    isWardActive: false,
                    elberethIntegrity: 0.0,
                    status: 'NONE',
                    warning: null
                } : ElberethAnalyzer.analyze(actualText);

                const restoration = (isHeadstone || !this.archaeologist) ? null : this.archaeologist.restore(actualText, context);
                const isElb = !isHeadstone && (restoration?.isElbereth || analysis.isElbereth);
                const pristine = restoration?.matched ? restoration.pristineText : analysis.pristineText;

                this._resetMode();

                return {
                    signalId: 'SIGNAL_LORE_ENGRAVE',
                    subCategory: 'ENGRAVE',
                    matched: true,
                    actualText: analysis.actualText,
                    pristineText: pristine,
                    engraveType: engraveType,
                    isHeadstone: isHeadstone,
                    isElbereth: isElb,
                    isWardActive: analysis.isWardActive,
                    elberethIntegrity: analysis.elberethIntegrity,
                    status: analysis.status,
                    warning: analysis.warning,
                    restored: restoration?.matched ? {
                        id: restoration.id,
                        pristineText: restoration.pristineText,
                        translation: restoration.translation,
                        confidence: restoration.confidence,
                        source: restoration.source,
                        category: restoration.category,
                        subCategory: restoration.subCategory,
                        isTrue: restoration.isTrue
                    } : null,
                    confidence: isHeadstone ? 1.0 : (restoration?.matched ? restoration.confidence : 1.0),
                    rawPrompt: rawMessage
                };
            }
        }

        // ====================================================
        // PHASE 3: フォールバック救済照合 (先行行なしでの直接マッチ)
        // ====================================================

        // 3-1. 噂話フォールバック
        const directRumor = this._findRumor(clean);
        if (directRumor) {
            const source = this.pendingRumorSource || (this.currentMode === 'COOKIE_OPENED' ? 'cookie' : 'cookie');
            this._resetMode();

            return {
                signalId: 'SIGNAL_LORE_RUMOR',
                subCategory: 'RUMOR',
                matched: true,
                rumorId: directRumor.id,
                text: directRumor.text,
                translatedText: directRumor.translatedText,
                isTrue: directRumor.isTrue,
                source: source,
                confidence: 1.0,
                rawPrompt: rawMessage
            };
        }

        // 3-2. 神託フォールバック
        const directOracle = this._findOracle(clean);
        if (directOracle) {
            const isSpecial = this.pendingOracleType === 'special' || directOracle.isSpecial;
            this._resetMode();

            return {
                signalId: 'SIGNAL_LORE_ORACLE',
                subCategory: 'ORACLE',
                matched: true,
                oracleId: directOracle.id,
                title: directOracle.title,
                text: directOracle.text,
                translatedText: directOracle.translatedText,
                isSpecial: isSpecial,
                confidence: 1.0,
                rawPrompt: rawMessage
            };
        }

        // ====================================================
        // PHASE 4: モードの自然減衰（ステップ消費）
        // ====================================================
        if (this.currentMode !== 'IDLE') {
            this.modeStepsRemaining--;
            if (this.modeStepsRemaining <= 0) {
                this._resetMode();
            }
        }

        return null;
    }

    /**
     * モードおよび一時フラグのリセット
     * @private
     */
    _resetMode() {
        this.currentMode = 'IDLE';
        this.modeStepsRemaining = 0;
        this.pendingRumorSource = null;
        this.pendingEngraveType = null;
        this.pendingOracleType = null;
    }
}

export default LoreDetector;
