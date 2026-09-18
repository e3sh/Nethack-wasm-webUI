/**
 * LoreDetector.js - メッセージストリーム LORE シグナル検知器
 *
 * NetHack C コアから出力されるメッセージストリーム (pline, putstr, messageText) や
 * ウィンドウテキストをリアルタイム監視し、Layer 4 の LORE シグナルを高精度に同定する。
 *
 * 【検知対象シグナル】
 * 1. SIGNAL_LORE_RUMOR   : フォーチュンクッキーや紙片、小預言から得られる噂話 (真偽判定付き)
 * 2. SIGNAL_LORE_ENGRAVE : 床の刻み文字・Elbereth結界状態・文字消え
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
     */
    constructor(options = {}) {
        this.master = options.master || LORE_MASTER;
        this.archaeologist = options.archaeologist || new EngravingArchaeologist({ master: this.master });
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

    _normalizeText(str) {
        if (!str) return '';
        return str.replace(/\s+/g, ' ').trim().toLowerCase();
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

        const trimmed = rawMessage.trim();
        if (!trimmed) return null;

        // ----------------------------------------------------
        // 1. 床の刻み文字 (SIGNAL_LORE_ENGRAVE) の検知
        //    NetHack 5.0 の C コア (pline / shim_putstr) から届くメッセージに対応。
        //    - 複数行分割: 1行目 "There's some graffiti...", 2行目 "Read: \"...\"" または "You read: \"...\""
        //    - 同一行連結: "There's some graffiti...  You read: \"...\""
        //    - --More-- プロンプトおよび改行・キャリッジリターン (\r, \n) の混入を完全にサニタイズ
        //
        //    対応パターン:
        //    - You read: "..." / Read: "..." / read: "..."
        //    - You feel the words: "..." / Feel the words: "..."
        //    - あなたは読んだ: "..." / 読んだ: "..." / 文字を触って感じた: "..."
        // ----------------------------------------------------
        const clean = trimmed.replace(/[\r\n]/g, '').replace(/--More--/g, '').trim();
        const readMatch = clean.match(/(?:(?:You\s+|It\s+)?(?:read|feel the words)|(?:あなたは)?(?:読んだ|文字を触って感じた)|Read):\s*["「](.*?)["」]?[\.]?\s*$/i);
        if (readMatch) {
            const actualText = readMatch[1];

            // 同一行内のプレフィックスまたは先行行プレフィックスから刻み種別を判定
            let engraveType = this.pendingEngraveType;
            if (clean.includes('headstone') || /\bgrave\b/i.test(clean) || clean.includes('墓石')) {
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
            this.pendingEngraveType = null; // リセット

            const isHeadstone = engraveType === 'HEADSTONE';

            // 墓石 (HEADSTONE) は NetHack 仕様で劣化しない (indelible) ため、Elbereth結界やかすれ復元対象外とする
            const analysis = isHeadstone ? {
                actualText: actualText,
                pristineText: actualText,
                isElbereth: false,
                isWardActive: false,
                elberethIntegrity: 0.0,
                status: 'NONE',
                warning: null
            } : ElberethAnalyzer.analyze(actualText);

            // 墓石の場合は考古学復元ではなく、墓碑銘マスタや原文をそのまま尊重
            const restoration = (isHeadstone || !this.archaeologist) ? null : this.archaeologist.restore(actualText, context);

            const isElb = !isHeadstone && (restoration?.isElbereth || analysis.isElbereth);
            const pristine = restoration?.matched ? restoration.pristineText : analysis.pristineText;

            const result = {
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

            if (typeof console !== 'undefined' && console.debug) {
                console.debug('[LoreDetector] SIGNAL_LORE_ENGRAVE detected:', result);
            }

            return result;
        }

        // ----------------------------------------------------
        // 2. 直前コンテキスト・先行シグナルフラグの更新
        // ----------------------------------------------------
        if (trimmed.includes('This cookie has a scrap of paper inside.') || trimmed.includes('このクッキーには紙片が入っている.')) {
            this.pendingRumorSource = 'cookie';
            return null;
        }
        if (trimmed === 'It reads:' || trimmed === 'こう書かれている:') {
            if (!this.pendingRumorSource) {
                this.pendingRumorSource = 'paper';
            }
            return null;
        }
        if ((trimmed.includes('True to her word, the Oracle') && trimmed.includes('says:')) ||
            (trimmed.includes('約束どおり、オラクルは') && trimmed.includes('告げた:'))) {
            this.pendingRumorSource = 'oracle';
            return null;
        }

        // 床の刻み文字プレフィックスの検知（先行行として単独で届いた場合）
        if (trimmed.includes('headstone') || /\bgrave\b/i.test(trimmed) || trimmed.includes('墓石')) {
            this.pendingEngraveType = 'HEADSTONE';
            return null;
        }
        if (trimmed.includes('is written here in the dust') || trimmed.includes('is written here in the frost') || trimmed.includes('が書かれている')) {
            this.pendingEngraveType = 'DUST';
            return null;
        }
        if (trimmed.includes('is engraved here on the') || trimmed.includes('が刻まれている')) {
            this.pendingEngraveType = 'ENGRAVE';
            return null;
        }
        if (trimmed.includes('has been burned into the floor') || trimmed.includes('has been melted into') || trimmed.includes('焼き付いて') || trimmed.includes('溶け込んで')) {
            this.pendingEngraveType = 'BURN';
            return null;
        }
        if (trimmed.includes('graffiti') || trimmed.includes('落書きがある')) {
            this.pendingEngraveType = 'MARK';
            return null;
        }
        if (trimmed.includes('scrawled in blood here') || trimmed.includes('血で殴り書き')) {
            this.pendingEngraveType = 'BLOOD';
            return null;
        }

        // 神託所プレフィックスの検知
        if (trimmed.includes('The Oracle meditates for a moment and then intones:') ||
            trimmed.includes('The Oracle scornfully takes all your gold and says:')) {
            this.pendingOracleType = trimmed.includes('scornfully') ? 'special' : 'normal';
            return null;
        }

        // ----------------------------------------------------
        // 3. 噂話 (SIGNAL_LORE_RUMOR) の検知
        // ----------------------------------------------------
        const norm = this._normalizeText(trimmed);
        const rumor = this.rumorsByText.get(trimmed) || this.rumorsByNormText.get(norm);

        if (rumor) {
            const source = this.pendingRumorSource || 'cookie';
            this.pendingRumorSource = null; // リセット

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

        // ----------------------------------------------------
        // 4. 神託 (SIGNAL_LORE_ORACLE) の検知
        // ----------------------------------------------------
        const oracle = this.oraclesByText.get(trimmed) ||
                       this.oraclesByNormText.get(norm) ||
                       this.oraclesFirstLineMap.get(norm);

        if (oracle) {
            const isSpecial = this.pendingOracleType === 'special' || oracle.isSpecial;
            this.pendingOracleType = null;

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

        // 何も該当しない場合はコンテキストフラグの自然減衰
        // (関係ないメッセージが複数回続いた場合に pending をクリア)
        if (this.pendingRumorSource && !trimmed.startsWith('--More--') && trimmed !== 'It reads:') {
            this.pendingRumorSource = null;
        }

        return null;
    }
}

export default LoreDetector;
