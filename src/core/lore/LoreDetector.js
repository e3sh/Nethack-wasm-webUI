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

export class LoreDetector {
    /**
     * @param {Object} [options]
     * @param {Object} [options.master] - カスタム LORE マスタ
     */
    constructor(options = {}) {
        this.master = options.master || LORE_MASTER;
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
        // 1. 直前コンテキスト・先行シグナルフラグの更新
        // ----------------------------------------------------
        if (trimmed.includes('This cookie has a scrap of paper inside.')) {
            this.pendingRumorSource = 'cookie';
            return null;
        }
        if (trimmed === 'It reads:') {
            if (!this.pendingRumorSource) {
                this.pendingRumorSource = 'paper';
            }
            return null;
        }
        if (trimmed.includes('True to her word, the Oracle') && trimmed.includes('says:')) {
            this.pendingRumorSource = 'oracle';
            return null;
        }

        // 床の刻み文字プレフィックスの検知
        if (trimmed.includes('is written here in the dust') || trimmed.includes('is written here in the frost')) {
            this.pendingEngraveType = 'DUST';
            return null;
        }
        if (trimmed.includes('is engraved here on the')) {
            this.pendingEngraveType = 'ENGRAVE';
            return null;
        }
        if (trimmed.includes('has been burned into the floor') || trimmed.includes('has been melted into')) {
            this.pendingEngraveType = 'BURN';
            return null;
        }
        if (trimmed.includes('graffiti on the floor')) {
            this.pendingEngraveType = 'MARK';
            return null;
        }
        if (trimmed.includes('scrawled in blood here')) {
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
        // 2. 床の刻み文字 (SIGNAL_LORE_ENGRAVE) の検知
        //    NetHack 出力:
        //    - You read: "..."
        //    - You feel the words: "..."
        // ----------------------------------------------------
        const readMatch = trimmed.match(/^You (?:read|feel the words):\s*"(.*)"[\.]?$/);
        if (readMatch) {
            const actualText = readMatch[1];
            const engraveType = this.pendingEngraveType || 'UNKNOWN';
            this.pendingEngraveType = null; // リセット

            const analysis = ElberethAnalyzer.analyze(actualText);

            return {
                signalId: 'SIGNAL_LORE_ENGRAVE',
                subCategory: 'ENGRAVE',
                matched: true,
                actualText: analysis.actualText,
                pristineText: analysis.pristineText,
                engraveType: engraveType,
                isElbereth: analysis.isElbereth,
                isWardActive: analysis.isWardActive,
                elberethIntegrity: analysis.elberethIntegrity,
                status: analysis.status,
                warning: analysis.warning,
                confidence: 1.0,
                rawPrompt: rawMessage
            };
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
