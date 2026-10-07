/**
 * OnDemandLookupService.js
 *
 * WASM動的サイレントクエリによる NetHack 公式解説・文学引用取得サービス (Gap 3 対応)
 *
 * 【設計思想】
 * 1. 静的辞書の二重持ちを排し、NetHack Cコアの data.base から動的にテキストを抽出し、WebUI側の翻訳エンジンで日本語化。
 * 2. querySequenceSilent (suppressPrompts: true, isSilentSync: true) による画面ちらつきゼロの実行。
 * 3. 取得した公式解説・引用文をメモリキャッシュ (2回目以降 0ms) に格納。
 * 4. GKL / UIController から独立して利用可能な Headless サービス。
 */

import { OBJECT_KNOWLEDGE_MAP } from "../data/OBJECT_KNOWLEDGE_FULL.js";

export class OnDemandLookupService {
    /**
     * @param {Object} [options={}]
     * @param {Object} [options.core=null] - WebUICore インスタンス
     * @param {Object} [options.driver=null] - NetHackWasmDriver インスタンス
     * @param {Object} [options.translator=null] - TranslationEngine インスタンス
     * @param {string} [options.language='ja'] - 表示言語 ('ja' | 'en')
     * @param {number} [options.cacheLimit=500] - 最大キャッシュ件数
     */
    constructor(options = {}) {
        this.core = options.core || null;
        this.driver = options.driver || (this.core ? this.core.driver : null);
        this.translator = options.translator || (this.core ? this.core.translator : null);
        this.language = options.language || (this.core?.language) || 'ja';
        this.cacheLimit = options.cacheLimit || 500;

        /**
         * メモリキャッシュ: queryKey -> { query, rawText, translatedText, rawLines, translatedLines, rawSource, translatedSource, timestamp }
         * @type {Map<string, Object>}
         */
        this.cache = new Map();

        // 実行中クエリの重複発行防止 (In-flight promise cache)
        this._inFlightQueries = new Map();
    }

    /**
     * WebUICore インスタンスを設定
     * @param {Object} core 
     */
    setCore(core) {
        this.core = core;
        if (core) {
            if (core.driver) this.driver = core.driver;
            if (core.translator) this.translator = core.translator;
            if (core.language) this.language = core.language;
        }
    }

    /**
     * TranslationEngine インスタンスを設定
     * @param {Object} translator 
     */
    setTranslationEngine(translator) {
        this.translator = translator;
    }

    /**
     * 表示言語を設定 ('ja' | 'en')
     * @param {string} lang 
     */
    setLanguage(lang = 'ja') {
        this.language = (lang === 'ja' || lang === 'jp' || lang === true) ? 'ja' : 'en';
    }

    /**
     * NetHackWasmDriver インスタンスを設定
     * @param {Object} driver 
     */
    setDriver(driver) {
        this.driver = driver;
    }

    /**
     * メモリキャッシュをクリア
     */
    clearCache() {
        this.cache.clear();
        this._inFlightQueries.clear();
    }

    /**
     * 指定されたクエリキーのキャッシュを取得 (存在しない場合は null)
     * @param {string|Object} target 
     * @param {Object} [options={}]
     * @param {string} [options.language]
     * @returns {Object|null}
     */
    getCached(target, options = {}) {
        if (!target) return null;
        const letter = this.extractTargetLetter(target);
        const queryStr = typeof target === 'string' ? target.trim() : this.extractTargetQuery(target);
        const key = this._normalizeKey(queryStr || (letter ? `slot_${letter}` : ''));
        if (!key || !this.cache.has(key)) return null;
        return this._formatResult(this.cache.get(key), options.language || this.language, true);
    }

    /**
     * オブジェクトまたは文字列から NetHack Cコア照会用の一次原名・識別子を抽出
     * @param {string|Object} target 
     * @returns {string} サニタイズされた一次原名
     */
    extractTargetQuery(target) {
        if (!target) return '';
        let raw = '';
        if (typeof target === 'object') {
            // 1. target.knowledge (明示的な英名・原名指定)
            if (target.knowledge) {
                const k = target.knowledge;
                raw = k.nameEn || k.oc_name || k.english || k.trueName || k.rawName || '';
            }
            // 2. target.identification (真名識別情報)
            if (!raw && target.identification) {
                const iden = target.identification;
                raw = iden.trueName || iden.rawName || '';
            }
            // 3. onum による OBJECT_KNOWLEDGE_MAP 照合
            if (!raw) {
                const onum = target.onum ?? target.knowledge?.onum;
                if (onum !== null && onum !== undefined && OBJECT_KNOWLEDGE_MAP && OBJECT_KNOWLEDGE_MAP.has(onum)) {
                    const k = OBJECT_KNOWLEDGE_MAP.get(onum);
                    if (k && k.name) {
                        raw = k.name;
                    }
                }
            }
            // 4. target トップレベル
            if (!raw) {
                raw = target.nameEn || target.english || target.oc_name || target.trueName || target.rawName || target.id || target.name || '';
            }
            // 5. rawText フォールバック
            if (!raw && target.rawText) {
                raw = target.rawText;
            }
        } else {
            raw = String(target);
        }

        return this._sanitizeQuery(raw);
    }

    _sanitizeQuery(name) {
        if (!name || typeof name !== 'string') return '';
        return name
            .replace(/\([^\)]*\)/g, '')                         // 装備・スロット括弧 (weapon in hand) 等の除去
            .replace(/^([a-zA-Z])[\s\-\.\)]+\s*/, '')           // スロット文字 "a - " 等の除去
            .replace(/\b(an?|the)\s+/gi, '')                   // 冠詞除去
            .replace(/\b(uncursed|blessed|cursed)\s+/gi, '')   // BUC状態除去
            .replace(/[+-]\d+\s*/g, '')                         // 強化値除去 (+1, -2等)
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /**
     * オブジェクトからメニュースロット文字 (invlet: a-z, A-Z) を抽出
     * @param {string|Object} target 
     * @returns {string|null} スロット文字（存在しない場合は null）
     */
    extractTargetLetter(target) {
        if (!target || typeof target !== 'object') return null;
        const letter = target.letter || target.invlet || target.knowledge?.letter || target.item?.letter || null;
        if (typeof letter === 'string' && /^[a-zA-Z]$/.test(letter)) {
            return letter;
        }
        return null;
    }

    /**
     * 対象の検索トークンシーケンスを生成
     * NetHack Cコアの pager.c:dowhatis に対応:
     * - スロット文字 (letter) がある場合:
     *   ['/', 'i', letter, ' '] -> インベントリから直接指定 (Cコアが singular(invobj, xname) で checkfile 呼び出し)
     * - スロット文字がない場合 (床アイテム、モンスター、任意検索文字列等):
     *   ['/', '?', query, ' '] -> 名前/シンボル直接指定
     *
     * @param {string|Object} target 
     * @returns {Array<string>} トークン配列
     */
    buildLookupSequence(target) {
        const letter = this.extractTargetLetter(target);
        if (letter) {
            return ['/', 'i', letter, ' '];
        }

        const query = this.extractTargetQuery(target);
        if (!query) return [];

        return ['/', '?', query, ' '];
    }

    /**
     * 出力テキスト行の動的翻訳（TranslationEngine 連携）
     * @param {Array<string>} lines 
     * @returns {Array<string>}
     */
    translateLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return [];
        if (!this.translator || typeof this.translator.translate !== 'function') {
            return lines;
        }

        return lines.map(line => {
            if (!line || typeof line !== 'string' || !line.trim()) return line;

            // 1. そのまま完全一致で翻訳を試す（インデント等を含むキーに対応）
            let tr = this.translator.translate(line);
            if (tr && tr !== line) return tr;

            // 2. トリムして翻訳を試す
            const trimmed = line.trim();
            tr = this.translator.translate(trimmed);
            if (tr && tr !== trimmed) {
                const leading = line.match(/^\s*/)[0];
                return leading + tr;
            }

            return line;
        });
    }

    /**
     * 出典情報の翻訳
     * @param {string} source 
     * @returns {string}
     */
    translateSource(source) {
        if (!source || !this.translator || typeof this.translator.translate !== 'function') {
            return source;
        }
        let tr = this.translator.translate(source);
        if (tr && tr !== source) return tr;
        tr = this.translator.translate(`[ ${source} ]`);
        if (tr && tr !== `[ ${source} ]`) {
            return tr.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
        }
        return source;
    }

    /**
     * キャッシュエントリから指定言語に応じた結果オブジェクトをフォーマット
     * @private
     */
    _formatResult(entry, lang = this.language, fromCache = false) {
        if (!entry) {
            return { found: false, query: '', text: '', lines: [], fromCache };
        }
        const isJa = (lang === 'ja' || lang === 'jp' || lang === true);
        const text = (isJa && entry.translatedText) ? entry.translatedText : (entry.rawText || entry.text || '');
        const lines = (isJa && entry.translatedLines && entry.translatedLines.length > 0) ? entry.translatedLines : (entry.rawLines || entry.lines || []);
        const source = (isJa && entry.translatedSource) ? entry.translatedSource : (entry.rawSource || entry.source);

        return {
            found: Boolean(text),
            query: entry.query,
            text,
            rawText: entry.rawText || entry.text || '',
            translatedText: entry.translatedText || '',
            lines,
            rawLines: entry.rawLines || entry.lines || [],
            translatedLines: entry.translatedLines || [],
            source,
            rawSource: entry.rawSource || entry.source,
            translatedSource: entry.translatedSource,
            fromCache
        };
    }

    /**
     * 対象の解説・引用文を動的クエリ（キャッシュが存在する場合は 0ms で返却）
     * @param {string|Object} target - 検索対象（アイテムオブジェクト、モンスター名、文字列等）
     * @param {Object} [options={}]
     * @param {boolean} [options.bypassCache=false] - キャッシュを無視して強制取得
     * @param {string} [options.language] - 返却言語 ('ja' | 'en')
     * @returns {Promise<{ found: boolean, query: string, text: string, lines: string[], source?: string, fromCache: boolean }>}
     */
    async lookup(target, options = {}) {
        if (!target) {
            return { found: false, query: '', text: '', lines: [], fromCache: false };
        }

        const targetLang = options.language || this.language;
        const letter = this.extractTargetLetter(target);
        const queryStr = typeof target === 'string' ? target.trim() : this.extractTargetQuery(target);

        // キャッシュキーの決定:
        // 同一アイテムの再利用・スロット変動への耐性のため名前ベースを最優先し、
        // 名前が取れない場合のみスロットベースにする
        const cacheKey = this._normalizeKey(queryStr || (letter ? `slot_${letter}` : ''));
        if (!cacheKey) {
            return { found: false, query: (queryStr || letter || ''), text: '', lines: [], fromCache: false };
        }

        // 1. メモリキャッシュの評価 (2回目以降 0ms レスポンス)
        if (!options.bypassCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            return this._formatResult(cached, targetLang, true);
        }

        // 2. 同一クエリが現在実行中の場合はその Promise を再利用 (重複抑制)
        if (this._inFlightQueries.has(cacheKey)) {
            const inFlightRes = await this._inFlightQueries.get(cacheKey);
            return this._formatResult(this.cache.get(cacheKey) || inFlightRes, targetLang, false);
        }

        // 3. サイレントクエリ実行
        const queryPromise = this._executeSilentLookup(cacheKey, target, options);
        this._inFlightQueries.set(cacheKey, queryPromise);

        try {
            return await queryPromise;
        } finally {
            this._inFlightQueries.delete(cacheKey);
        }
    }

    /**
     * サイレントクエリの内部実行
     * @private
     */
    async _executeSilentLookup(key, rawTarget, options) {
        const targetLang = options.language || this.language;
        const tokens = this.buildLookupSequence(rawTarget);
        if (tokens.length === 0) {
            return { found: false, query: rawTarget, text: '', lines: [], fromCache: false };
        }

        let rawBuffer = null;

        try {
            if (this.core && typeof this.core.querySequenceSilent === 'function') {
                rawBuffer = await this.core.querySequenceSilent(tokens, {
                    suppressPrompts: true,
                    isSilentSync: true,
                    syncType: 'lookup'
                });
            } else if (this.driver && typeof this.driver.queueSequence === 'function') {
                rawBuffer = await this.driver.queueSequence(tokens, {
                    silent: true,
                    suppressPrompts: true,
                    isSilentSync: true
                });
            }
        } catch (e) {
            console.warn(`[OnDemandLookupService] Lookup failed for '${rawTarget}':`, e);
        }

        // バッファを解析してテキスト抽出
        const parsed = this.parseLookupResponse(rawBuffer, rawTarget);

        // 動的翻訳の適用
        const translatedLines = this.translateLines(parsed.lines);
        const translatedText = translatedLines.join('\n').trim();
        const translatedSource = this.translateSource(parsed.source);

        const cacheEntry = {
            query: rawTarget,
            text: parsed.text,
            lines: parsed.lines,
            source: parsed.source,
            rawText: parsed.text,
            translatedText,
            rawLines: parsed.lines,
            translatedLines,
            rawSource: parsed.source,
            translatedSource,
            timestamp: Date.now()
        };

        // キャッシュに格納 (空結果でも次回不要なWASM呼び出しを避けるためキャッシュ)
        this._storeCache(key, cacheEntry);

        return this._formatResult(cacheEntry, targetLang, false);
    }

    /**
     * 出力バッファからプロンプトノイズを除去し、純粋な公式解説・引用文をパース
     * @param {Array<Object|string>|string} rawBuffer 
     * @param {string} [queryHint='']
     * @returns {{ found: boolean, text: string, lines: string[], source?: string }}
     */
    parseLookupResponse(rawBuffer, queryHint = '') {
        if (!rawBuffer) {
            return { found: false, text: '', lines: [] };
        }

        let rawLines = [];
        if (typeof rawBuffer === 'string') {
            rawLines = rawBuffer.split(/\r?\n/);
        } else if (Array.isArray(rawBuffer)) {
            for (const item of rawBuffer) {
                if (typeof item === 'string') {
                    rawLines.push(item);
                } else if (item && typeof item === 'object') {
                    if (item.text) rawLines.push(item.text);
                    else if (item.str) rawLines.push(item.str);
                    else if (item.rawStr) rawLines.push(item.rawStr);
                    else if (item.line) rawLines.push(item.line);
                }
            }
        }

        // プロンプト行・ノイズ行の判定フィルター
        const isNoiseLine = (line) => {
            if (!line || typeof line !== 'string') return true;
            const l = line.toLowerCase().trim();
            if (!l) return false; // 空行は整形用に一時保持

            return (
                l.startsWith('what is this') ||
                l.startsWith('what do you want to look at') ||
                l.startsWith('specify what') ||
                l.startsWith('more info?') ||
                l.startsWith('i\'ve never heard') ||
                l.startsWith('unknown symbol') ||
                l.startsWith('unknown command') ||
                l.startsWith('you don\'t have any information') ||
                l.startsWith('cannot find') ||
                l === '--more--' ||
                l === '(end)' ||
                l === '[y/n]' ||
                l.startsWith('pick a')
            );
        };

        const cleanLines = [];
        let sourceInfo = null;

        for (const raw of rawLines) {
            const trimmed = raw.trim();
            if (isNoiseLine(trimmed)) continue;

            // 出典表記の検出 (例: "[ NetHack 3.6 data.base ]", "--- Tolkien, LotR ---")
            const srcMatch = trimmed.match(/^\[\s*([^\*\]]+)\s*\]$/) || trimmed.match(/^---\s*([^-\*]+)\s*---$/);
            if (srcMatch && !sourceInfo) {
                sourceInfo = srcMatch[1].trim();
            }

            cleanLines.push(raw);
        }

        // 前後の連続する空行を除去
        while (cleanLines.length > 0 && !cleanLines[0].trim()) {
            cleanLines.shift();
        }
        while (cleanLines.length > 0 && !cleanLines[cleanLines.length - 1].trim()) {
            cleanLines.pop();
        }

        const fullText = cleanLines.join('\n').trim();
        const found = fullText.length > 0;

        return {
            found,
            text: fullText,
            lines: cleanLines,
            source: sourceInfo || (found ? 'NetHack data.base' : undefined)
        };
    }

    /**
     * キャッシュへの安全な保存（サイズ超過時のLRU的除去）
     * @private
     */
    _storeCache(key, entry) {
        if (this.cache.size >= this.cacheLimit) {
            // 最も古いエントリを1件削除
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
        this.cache.set(key, entry);
    }

    /**
     * クエリ文字列のキー正規化
     * @private
     */
    _normalizeKey(target) {
        return (target || '').toLowerCase().trim().replace(/^(a|an|the)\s+/i, '');
    }
}
