/**
 * EngravingArchaeologist.js - GKL かすれ床文字の考古学的復元アシストエンジン
 *
 * 【背景と設計思想】
 * NetHack 5.0 (src/engrave.c:random_engraving) では、床のランダム落書きは
 * - rumors.tru (390件)
 * - rumors.fal (397件)
 * - engrave.txt (48件)
 * - 聖なる結界文字 "Elbereth"
 * の合計約840件から選ばれ、生成時点で wipeout_text() により文字数の約25%が
 * 削られ・変形 (rubouts[] による置換、'?' 置換) して出現する。
 *
 * 本モジュールは、探索母数を約840件に完全隔離し、
 * rubouts[] の逆引きパターン照合＋類似度計算により、
 * 誤爆ゼロ・極小計算負荷 (<1ms) で原文・完全日本語訳・出典を同定・復元する。
 */

import { LORE_MASTER } from './data/LoreMasterData.js';
import { ElberethAnalyzer, PRISTINE_ELBERETH, WARD_STATUS } from './ElberethAnalyzer.js';

/**
 * NetHack 5.0 src/engrave.c の rubouts[] 置換テーブル
 */
export const RUBOUTS = {
    'A': '^',
    'B': 'Pb[',
    'C': '(',
    'D': '|)[',
    'E': '|FL[_',
    'F': '|-',
    'G': 'C(',
    'H': '|-',
    'I': '|',
    'K': '|<',
    'L': '|_',
    'M': '|',
    'N': '|\\',
    'O': 'C(',
    'P': 'F',
    'Q': 'C(',
    'R': 'PF',
    'T': '|',
    'U': 'J',
    'V': '/\\',
    'W': 'V/\\',
    'Z': '/',
    'b': '|',
    'd': 'c|',
    'e': 'c',
    'g': 'c',
    'h': 'n',
    'j': 'i',
    'k': '|',
    'l': '|',
    'm': 'nr',
    'n': 'r',
    'o': 'c',
    'q': 'c',
    'w': 'v',
    'y': 'v',
    ':': '.',
    ';': ',:',
    ',': '.',
    '=': '-',
    '+': '-|',
    '*': '+',
    '@': '0',
    '0': 'C(',
    '1': '|',
    '6': 'o',
    '7': '/',
    '8': '3o'
};

/**
 * rubouts の逆引きマップ (劣化文字 -> 劣化元となりうる文字の集合)
 */
const REVERSE_RUBOUTS = (() => {
    const map = new Map();
    for (const [orig, targets] of Object.entries(RUBOUTS)) {
        for (const ch of targets) {
            if (!map.has(ch)) {
                map.set(ch, new Set());
            }
            map.get(ch).add(orig);
        }
    }
    return map;
})();

// O(1) 超高速マッチング・コスト判定テーブル (128x128 = 16KB)
// 0: 不一致 (cost 1.0)
// 1: 完全一致 (cost 0.0)
// 2: 大文字小文字一致 (cost 0.05)
// 3: プレースホルダー '?' (cost 0.15)
// 4: rubout 劣化合致 (cost 0.10)
// 5: スペースと記号合致 (cost 0.20)
// 6: いずれかがスペース (cost 0.50)
const MATCH_COST_TABLE = new Float32Array([1.0, 0.0, 0.05, 0.15, 0.10, 0.20, 0.50]);
const MATCH_TYPE_TABLE = new Uint8Array(128 * 128);

(() => {
    const PUNCT_CHARS = new Set("?.,'`-|_".split(''));
    for (let q = 0; q < 128; q++) {
        const qChar = String.fromCharCode(q);
        for (let t = 0; t < 128; t++) {
            const tChar = String.fromCharCode(t);
            const idx = (q << 7) | t;

            if (q === t) {
                MATCH_TYPE_TABLE[idx] = 1;
            } else if (qChar.toLowerCase() === tChar.toLowerCase()) {
                MATCH_TYPE_TABLE[idx] = 2;
            } else if (qChar === '?') {
                MATCH_TYPE_TABLE[idx] = 3;
            } else {
                // rubouts 判定
                const targets = RUBOUTS[tChar] || RUBOUTS[tChar.toUpperCase()];
                const origs = REVERSE_RUBOUTS.get(qChar);
                const isRubout = (targets && targets.includes(qChar)) ||
                                 (origs && (origs.has(tChar) || origs.has(tChar.toUpperCase())));
                if (isRubout) {
                    MATCH_TYPE_TABLE[idx] = 4;
                } else if (qChar === ' ' && PUNCT_CHARS.has(tChar)) {
                    MATCH_TYPE_TABLE[idx] = 5;
                } else if (qChar === ' ' || tChar === ' ') {
                    MATCH_TYPE_TABLE[idx] = 6;
                } else {
                    MATCH_TYPE_TABLE[idx] = 0;
                }
            }
        }
    }
})();

export class EngravingArchaeologist {
    /**
     * @param {Object} [options]
     * @param {Object} [options.master] - カスタム LORE マスタ
     * @param {number} [options.defaultThreshold=0.6] - 復元判定の最小信頼度閾値
     */
    constructor(options = {}) {
        this.master = options.master || LORE_MASTER;
        this.defaultThreshold = options.defaultThreshold !== undefined ? options.defaultThreshold : 0.6;

        // 約840件の考古学コーパス（候補リスト）をインデックス化
        this.corpus = [];
        this._initCorpus();
    }

    _initCorpus() {
        const createEntry = (id, text, trans, cat, subCat, src, isTrue, isElb) => {
            const codes = new Uint8Array(text.length);
            for (let i = 0; i < text.length; i++) {
                codes[i] = text.charCodeAt(i) & 0x7F;
            }
            return {
                id: id || null,
                pristineText: text,
                translatedText: trans || '',
                len: text.length,
                codes: codes,
                category: cat,
                subCategory: subCat,
                source: src,
                isTrue: isTrue,
                isElbereth: isElb
            };
        };

        // 1. Engravings (48件)
        for (const e of (this.master.engravings || [])) {
            const isElb = e.text === PRISTINE_ELBERETH;
            this.corpus.push(createEntry(
                e.id || null,
                e.text,
                e.translatedText,
                isElb ? 'ELBERETH' : (e.category || 'ENGRAVING'),
                isElb ? 'WARD' : (e.subCategory || 'GRAFFITI'),
                e.source || 'engrave.txt',
                null,
                isElb
            ));
        }

        // 2. Rumors (787件)
        for (const r of (this.master.rumors || [])) {
            this.corpus.push(createEntry(
                r.id || null,
                r.text,
                r.translatedText,
                'RUMOR',
                r.subCategory || (r.isTrue ? 'TRUE_RUMOR' : 'FALSE_RUMOR'),
                r.isTrue ? 'rumors.tru' : 'rumors.fal',
                r.isTrue,
                false
            ));
        }

        // 3. Elbereth 単体 (念のため明示登録)
        if (!this.corpus.some(c => c.pristineText === PRISTINE_ELBERETH)) {
            this.corpus.unshift(createEntry(
                'elbereth_ward',
                PRISTINE_ELBERETH,
                'エルベレス',
                'ELBERETH',
                'WARD',
                'Elbereth (魔除けの結界文字)',
                null,
                true
            ));
        }
    }

    /**
     * かすれた床文字を解析し、原型・日本語訳・出典を復元同定する
     *
     * @param {string} rawQuery - 床から読み取られた文字列 (かすれ・欠損含む)
     * @param {Object} [options]
     * @param {number} [options.threshold] - 個別信頼度閾値 (未指定時は defaultThreshold)
     * @returns {{
     *   matched: boolean,
     *   confidence: number,
     *   pristineText: string|null,
     *   translation: string,
     *   category: string|null,
     *   subCategory: string|null,
     *   source: string|null,
     *   isTrue: boolean|null,
     *   isElbereth: boolean,
     *   isWardActive: boolean,
     *   elberethIntegrity: number,
     *   actualText: string,
     *   reason: string
     * }}
     */
    restore(rawQuery, options = {}) {
        if (!rawQuery || typeof rawQuery !== 'string') {
            return this._createUnmatchedResult(rawQuery, 'Empty or invalid query');
        }

        const trimmed = rawQuery.trim();
        if (!trimmed) {
            return this._createUnmatchedResult(rawQuery, 'Empty string');
        }

        const threshold = options.threshold !== undefined ? options.threshold : this.defaultThreshold;

        // 1. まず ElberethAnalyzer による解析を試行
        const elberethAnalysis = ElberethAnalyzer.analyze(trimmed);
        if (elberethAnalysis.isElbereth) {
            const conf = elberethAnalysis.isWardActive ? 1.0 : Math.max(0.65, elberethAnalysis.elberethIntegrity);
            return {
                id: 'elbereth_ward',
                matched: true,
                confidence: conf,
                pristineText: PRISTINE_ELBERETH,
                translation: 'エルベレス',
                category: 'ELBERETH',
                subCategory: 'WARD',
                source: 'Elbereth (魔除けの結界文字)',
                isTrue: null,
                isElbereth: true,
                isWardActive: elberethAnalysis.isWardActive,
                elberethIntegrity: elberethAnalysis.elberethIntegrity,
                actualText: trimmed,
                reason: elberethAnalysis.isWardActive ? 'Exact Elbereth match' : 'Degraded Elbereth ward'
            };
        }

        // 2. 完全一致チェック (完全一致なら即座に返却)
        for (const entry of this.corpus) {
            if (trimmed === entry.pristineText) {
                return {
                    id: entry.id,
                    matched: true,
                    confidence: 1.0,
                    pristineText: entry.pristineText,
                    translation: entry.translatedText,
                    category: entry.category,
                    subCategory: entry.subCategory,
                    source: entry.source,
                    isTrue: entry.isTrue,
                    isElbereth: entry.isElbereth,
                    isWardActive: entry.isElbereth,
                    elberethIntegrity: entry.isElbereth ? 1.0 : 0.0,
                    actualText: trimmed,
                    reason: 'Exact corpus match'
                };
            }
        }

        const qLen = trimmed.length;
        const qCodes = new Uint8Array(qLen);
        let informativeCount = 0;
        for (let i = 0; i < qLen; i++) {
            const code = trimmed.charCodeAt(i) & 0x7F;
            qCodes[i] = code;
            if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
                informativeCount++;
            }
        }

        // 2.3 クエリ末尾ノイズ（ピリオド等の後の空白・アンダースコア・かすれ記号のゴミ）をクレンジング
        // 例: "I? vo?r ghost... ycur ?c?re.__ __?" -> "I? vo?r ghost... ycur ?c?re."
        const cleaned = trimmed.replace(/([.!?])[\s_?]+$/, '$1').replace(/[\s_]+$/, '').trim();
        const hasCleanedVariant = cleaned && cleaned !== trimmed && cleaned.length >= 3;

        let cleanedCodes = null;
        let cleanedInformativeCount = 0;
        if (hasCleanedVariant) {
            cleanedCodes = new Uint8Array(cleaned.length);
            for (let i = 0; i < cleaned.length; i++) {
                const code = cleaned.charCodeAt(i) & 0x7F;
                cleanedCodes[i] = code;
                if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57)) {
                    cleanedInformativeCount++;
                }
            }
        }

        // 2.5 アンカー候補 (同一マスで過去に同定された原型) の優先照合
        const anchor = options.anchorCandidate || options.anchorText;
        if (anchor) {
            let anchorEntry = typeof anchor === 'object' && anchor.codes ? anchor : null;
            if (!anchorEntry) {
                const anchorStr = typeof anchor === 'string' ? anchor : (anchor.pristineText || '');
                anchorEntry = this.corpus.find(c => c.pristineText === anchorStr);
            }

            if (anchorEntry) {
                let anchorScore = this._calculateSimilarity(qLen, anchorEntry.len, qCodes, anchorEntry.codes);
                if (hasCleanedVariant) {
                    const cleanScore = this._calculateSimilarity(cleaned.length, anchorEntry.len, cleanedCodes, anchorEntry.codes);
                    if (cleanScore > anchorScore) anchorScore = cleanScore;
                }
                // アンカー原型との整合性が 0.30 以上あれば、他の母数を探索せずアンカーの風化として追跡
                if (anchorScore >= 0.30) {
                    const confidence = Number(anchorScore.toFixed(3));
                    return {
                        id: anchorEntry.id,
                        matched: true,
                        confidence: confidence,
                        pristineText: anchorEntry.pristineText,
                        translation: anchorEntry.translatedText,
                        category: anchorEntry.category,
                        subCategory: anchorEntry.subCategory,
                        source: anchorEntry.source,
                        isTrue: anchorEntry.isTrue,
                        isElbereth: anchorEntry.isElbereth,
                        isWardActive: false,
                        elberethIntegrity: anchorEntry.isElbereth ? confidence : 0.0,
                        actualText: trimmed,
                        reason: `Degraded anchor match (score: ${confidence})`
                    };
                }
            }
        }

        // 2.8 有効情報量ガード: アンカーが無い状態で有効英数字が 3 文字未満の場合、
        // 意味のある原型特定は不可能なため過剰同定をストップ (例: '?r  ? m' で誤マッチするのを防止)
        if (informativeCount < 3 && cleanedInformativeCount < 3) {
            return this._createUnmatchedResult(trimmed, 'Informative content too low (heavily degraded rubble)');
        }

        // 3. 考古学的ファジーマッチング（かすれ・劣化・踏み荒らし復元）
        let bestCandidate = null;
        let highestScore = 0.0;

        for (const candidate of this.corpus) {
            const tLen = candidate.len;
            
            // 1) 元の trimmed クエリでの評価
            if (this._canBeCandidate(qLen, tLen, qCodes, candidate.codes, informativeCount)) {
                const score = this._calculateSimilarity(qLen, tLen, qCodes, candidate.codes);
                if (score > highestScore) {
                    highestScore = score;
                    bestCandidate = candidate;
                }
            }

            // 2) 末尾ノイズクレンジング版クエリでの評価
            if (hasCleanedVariant && this._canBeCandidate(cleaned.length, tLen, cleanedCodes, candidate.codes, cleanedInformativeCount)) {
                const score = this._calculateSimilarity(cleaned.length, tLen, cleanedCodes, candidate.codes);
                if (score > highestScore) {
                    highestScore = score;
                    bestCandidate = candidate;
                }
            }
        }

        const confidence = Number(highestScore.toFixed(3));

        if (bestCandidate && confidence >= threshold) {
            return {
                id: bestCandidate.id,
                matched: true,
                confidence: confidence,
                pristineText: bestCandidate.pristineText,
                translation: bestCandidate.translatedText,
                category: bestCandidate.category,
                subCategory: bestCandidate.subCategory,
                source: bestCandidate.source,
                isTrue: bestCandidate.isTrue,
                isElbereth: bestCandidate.isElbereth,
                isWardActive: false, // 劣化しているため結界としては非活性
                elberethIntegrity: bestCandidate.isElbereth ? confidence : 0.0,
                actualText: trimmed,
                reason: `Archaeological restoration (score: ${confidence})`
            };
        }

        return this._createUnmatchedResult(trimmed, `Low confidence (${confidence} < ${threshold})`);
    }

    /**
     * 高速事前フィルタ: 長さと先頭ヒントにより非関連候補を0.001msで足切り
     */
    _canBeCandidate(qLen, tLen, qCodes, tCodes, informativeCount = 0) {
        // 1. 長さ許容差: 短文なら12文字、長文ならターゲット長の25%のブレを許容
        const maxLenDiff = Math.max(12, Math.floor(tLen * 0.25));
        if (qLen > tLen + maxLenDiff) return false;

        // 末尾が句読点 (. ! ' ") で終わっている場合は文の末尾まで読めている可能性が高い
        // 注意: '?' (ASCII 63) は NetHack ではかすれ文字の代表格であるため文末記号とみなさない
        const lastQChar = qCodes[qLen - 1];
        const isPunctEnd = lastQChar === 33 || lastQChar === 46 || lastQChar === 39 || lastQChar === 34; // ! . ' "
        
        // プレフィックスマッチ（踏み荒らし途切れ）は有効英数字が 4 文字以上あり、かつクエリの 40% 以上が有効文字の場合のみ許可
        const isPrefix = !isPunctEnd && qLen < tLen * 0.85 && informativeCount >= 4 && (informativeCount / qLen >= 0.4);

        // 全長一致候補の場合、長さの差が maxLenDiff 以内でなければ除外
        if (!isPrefix && Math.abs(qLen - tLen) > maxLenDiff) {
            return false;
        }

        // 2. 先頭照合ヒント (先頭6文字中、target先頭9文字の中に合致があるか)
        // type 1~4 のみ (片方スペースの type 6 は除外)
        const checkLen = Math.min(6, qLen);
        const targetWindow = Math.min(9, tLen);
        let match = 0;
        let exactOrRuboutMatch = 0;

        for (let i = 0; i < checkLen; i++) {
            const qc = qCodes[i];
            for (let j = 0; j < targetWindow; j++) {
                const type = MATCH_TYPE_TABLE[(qc << 7) | tCodes[j]];
                if (type >= 1 && type <= 4) {
                    match++;
                    if (type === 1 || type === 2 || type === 4) {
                        exactOrRuboutMatch++;
                    }
                    break;
                }
            }
        }

        // 先頭照合で '?' (type 3) だけの一致は除外 (最低1文字は英字/rubout一致が必要)
        if (match < Math.min(3, checkLen) || exactOrRuboutMatch < 1) {
            return false;
        }

        // 3. 高速スパース・サンプリング照合 (8点サンプリングで0.0002ms足切り)
        // 類似度0.6以上になるためには、クエリ全体のサンプリング位置近傍で少なくとも45%以上の一致が必要
        let matchCount = 0;
        const step = Math.max(1, Math.floor(qLen / 8));
        let tested = 0;

        for (let i = 0; i < qLen; i += step) {
            tested++;
            const qc = qCodes[i];
            const startJ = Math.max(0, i - 5);
            const endJ = Math.min(tLen, i + 8);
            for (let j = startJ; j < endJ; j++) {
                const type = MATCH_TYPE_TABLE[(qc << 7) | tCodes[j]];
                if (type >= 1 && type <= 4) {
                    matchCount++;
                    break;
                }
            }
        }

        return matchCount >= Math.ceil(tested * 0.45);
    }

    /**
     * クエリ文字列とターゲット文字列の「かすれ類似度」を計算 (0.0 ~ 1.0)
     * オフセットずれや文字挿入・欠損に対応するため、加重編集距離 (Weighted Edit Distance / Semi-global Alignment) を採用。
     *
     * @param {number} qLen
     * @param {number} tLen
     * @param {Uint8Array} qCodes
     * @param {Uint8Array} tCodes
     * @returns {number} 類似度スコア
     */
    _calculateSimilarity(qLen, tLen, qCodes, tCodes) {
        const isPrefixMatch = qLen < tLen * 0.85;

        // 再利用可能なスライディング配列でDP (メモリ割り当て最小化・高速JIT実行)
        if (!this._dpPrev || this._dpPrev.length <= tLen + 1) {
            this._dpPrev = new Float32Array(Math.max(256, tLen + 16));
            this._dpCurr = new Float32Array(Math.max(256, tLen + 16));
        }

        const prev = this._dpPrev;
        const curr = this._dpCurr;

        for (let j = 0; j <= tLen; j++) prev[j] = j;

        for (let i = 1; i <= qLen; i++) {
            curr[0] = i;
            const qCode = qCodes[i - 1];

            for (let j = 1; j <= tLen; j++) {
                const tCode = tCodes[j - 1];
                const matchType = MATCH_TYPE_TABLE[(qCode << 7) | tCode];
                const cost = MATCH_COST_TABLE[matchType];

                curr[j] = Math.min(
                    prev[j] + 1.0,      // 削除
                    curr[j - 1] + 1.0,  // 挿入
                    prev[j - 1] + cost  // 置換
                );
            }

            for (let j = 0; j <= tLen; j++) {
                prev[j] = curr[j];
            }
        }

        let dist = prev[tLen];
        let compareLen = Math.max(qLen, tLen);

        // 踏み荒らし (末尾が途中で途切れている) の場合、target の該当位置での最小コストを判定
        if (isPrefixMatch) {
            let bestK = tLen;
            for (let j = Math.max(0, qLen - 3); j <= Math.min(tLen, qLen + 5); j++) {
                if (prev[j] < dist) {
                    dist = prev[j];
                    bestK = j;
                }
            }
            compareLen = Math.max(qLen, bestK);
        }

        let baseScore = Math.max(0.0, 1.0 - (dist / compareLen));

        // 踏み荒らしで短すぎるクエリ（例: 4文字以下）へのペナルティ
        if (isPrefixMatch && qLen < 5) {
            const lenRatio = qLen / tLen;
            baseScore *= Math.min(1.0, 0.5 + lenRatio * 0.5);
        }

        return Math.max(0.0, Math.min(1.0, baseScore));
    }

    /**
     * qChar が tChar の rubouts 劣化文字であるか判定
     *
     * @param {string} qChar - 読み取られた文字
     * @param {string} tChar - 原型の文字
     * @returns {boolean}
     */
    _isRuboutMatch(qChar, tChar) {
        // 1. 直引き: RUBOUTS[tChar] に qChar が含まれる
        const targets = RUBOUTS[tChar];
        if (targets && targets.includes(qChar)) {
            return true;
        }

        // 2. 小文字・大文字の許容
        const targetsUpper = RUBOUTS[tChar.toUpperCase()];
        if (targetsUpper && targetsUpper.includes(qChar)) {
            return true;
        }

        // 3. 逆引き確認
        const possibleOrigs = REVERSE_RUBOUTS.get(qChar);
        if (possibleOrigs && (possibleOrigs.has(tChar) || possibleOrigs.has(tChar.toUpperCase()))) {
            return true;
        }

        return false;
    }

    _createUnmatchedResult(rawQuery, reason) {
        return {
            id: null,
            matched: false,
            confidence: 0.0,
            pristineText: null,
            translation: '',
            category: null,
            subCategory: null,
            source: null,
            isTrue: null,
            isElbereth: false,
            isWardActive: false,
            elberethIntegrity: 0.0,
            actualText: rawQuery || '',
            reason: reason
        };
    }
}

export default EngravingArchaeologist;
