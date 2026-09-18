/**
 * ElberethAnalyzer.js - 床の刻み文字 & Elbereth 結界解析器
 *
 * NetHack 5.0 (src/engrave.c) の仕様に基づく。
 * - 床に刻まれた文字と聖なる結界文字 "Elbereth" の原型照合
 * - 文字消え (wipeout_text / 風化 / 踏み荒らし) による残存率 (0.0 ~ 1.0) の算出
 * - 結界の有効性判定 (Vanilla NetHack では完全一致のみ有効)
 */

export const PRISTINE_ELBERETH = 'Elbereth';

export const WARD_STATUS = {
    ACTIVE: 'ACTIVE',       // 結界有効 (100% 完全一致)
    DEGRADED: 'DEGRADED',   // 結界劣化 (文字消えにより結界機能喪失・要再刻み)
    NONE: 'NONE'            // Elbereth 以外の通常の落書き・墓碑銘
};

/**
 * NetHack 5.0 wipeout_text で劣化しうる文字の対応マップ
 */
const DEGRADED_CHAR_MAP = {
    'E': ['|', 'F', 'L', '[', '_', '?'],
    'l': ['|', '1', '!', '?'],
    'b': ['|', 'o', '?'],
    'e': ['c', 'o', '?'],
    'r': ['P', 'F', 'v', '?'],
    't': ['|', '+', '?'],
    'h': ['|', '-', '?']
};

export class ElberethAnalyzer {
    /**
     * 床に刻まれたテキストを解析し、Elbereth 結界の状態を判定
     *
     * @param {string} text - 床に刻まれた文字列
     * @returns {{
     *   actualText: string,
     *   pristineText: string|null,
     *   isElbereth: boolean,
     *   isWardActive: boolean,
     *   elberethIntegrity: number,
     *   status: 'ACTIVE'|'DEGRADED'|'NONE',
     *   warning: string|null,
     *   matchedChars: number,
     *   totalChars: number
     * }}
     */
    static analyze(text) {
        if (!text || typeof text !== 'string') {
            return {
                actualText: '',
                pristineText: null,
                isElbereth: false,
                isWardActive: false,
                elberethIntegrity: 0.0,
                status: WARD_STATUS.NONE,
                warning: null,
                matchedChars: 0,
                totalChars: PRISTINE_ELBERETH.length
            };
        }

        const trimmed = text.trim();
        const target = PRISTINE_ELBERETH;
        const totalChars = target.length; // 8

        // 1. 完全一致 (100% 結界有効)
        if (trimmed === target) {
            return {
                actualText: trimmed,
                pristineText: target,
                isElbereth: true,
                isWardActive: true,
                elberethIntegrity: 1.0,
                status: WARD_STATUS.ACTIVE,
                warning: '結界有効: モンスターは近寄れません',
                matchedChars: 8,
                totalChars: 8
            };
        }

        // 2. 文字列一致度・残存率の計算 (位置ベースの一致 + 劣化文字の重み付き評価)
        let matchedScore = 0;
        const minLen = Math.min(trimmed.length, totalChars);

        for (let i = 0; i < minLen; i++) {
            const actualChar = trimmed[i];
            const pristineChar = target[i];

            if (actualChar === pristineChar) {
                // 完全一致
                matchedScore += 1.0;
            } else if (actualChar.toLowerCase() === pristineChar.toLowerCase()) {
                // 大文字小文字のズレ
                matchedScore += 0.8;
            } else if (DEGRADED_CHAR_MAP[pristineChar]?.includes(actualChar) || actualChar === '?' || actualChar === '.') {
                // wipeout_text による劣化文字または削れプレースホルダー
                matchedScore += 0.6;
            }
        }

        // 長さ超過・不足ペナルティ
        const lengthDiff = Math.abs(trimmed.length - totalChars);
        const integrity = Math.max(0.0, Math.min(1.0, Number((matchedScore / totalChars).toFixed(3))));

        // Elbereth 判定のしきい値:
        // - 先頭が "Elb" で始まる
        // - または整合率が 35% 以上 (かつ最低限 'E' または 'e' を含む)
        // - または "elbereth" の大文字小文字違い
        const isCaseInsensitiveElbereth = trimmed.toLowerCase() === target.toLowerCase();
        const startsWithElb = trimmed.toLowerCase().startsWith('elb');
        const hasHighIntegrity = integrity >= 0.35 && (trimmed.includes('Elb') || trimmed.includes('elb') || trimmed.includes('bereth') || trimmed.includes('ber?th'));

        const isElbereth = isCaseInsensitiveElbereth || startsWithElb || hasHighIntegrity;

        if (!isElbereth) {
            return {
                actualText: trimmed,
                pristineText: null,
                isElbereth: false,
                isWardActive: false,
                elberethIntegrity: 0.0,
                status: WARD_STATUS.NONE,
                warning: null,
                matchedChars: 0,
                totalChars: totalChars
            };
        }

        // 劣化状態 (NetHack では完全一致以外は結界効果なし)
        return {
            actualText: trimmed,
            pristineText: target,
            isElbereth: true,
            isWardActive: false,
            elberethIntegrity: integrity,
            status: WARD_STATUS.DEGRADED,
            warning: '結界無効: 文字が風化しています（再刻みが必要です）',
            matchedChars: Math.round(matchedScore),
            totalChars: totalChars
        };
    }
}

export default ElberethAnalyzer;
