/**
 * ConditionStateManager.js
 *
 * 【GKL 状態異常マネージャー】
 *
 * NetHack コアから渡される BL_CONDITION、BL_HUNGER、BL_CAP 等の
 * 生のフラグ文字列・ビットマスク展開文字列を解析・正規化し、
 * 深刻度 (FATAL, CRITICAL, WARNING, INFO) に基づいて優先度ソートされた
 * 構造化バッジデータ (ConditionBadge[]) を提供します。
 */

import {
    CONDITION_DEFINITIONS,
    CONDITION_ALIASES,
    CONDITION_SEVERITY,
    SEVERITY_COLORS
} from "../data/CONDITION_DEFINITIONS.js";

export class ConditionStateManager {
    constructor() {
        this.definitions = CONDITION_DEFINITIONS;
        this.aliases = CONDITION_ALIASES;
    }

    /**
     * 生の状態異常識別子からマスター定義を取得 (エイリアス・大文字小文字対応)
     * @param {string} raw
     * @returns {Object|null}
     */
    resolveCondition(raw) {
        if (!raw || typeof raw !== 'string') return null;

        const normalized = raw.trim().toLowerCase().replace(/[\s\-_]+/g, '');
        if (!normalized) return null;

        // 1. エイリアス解決
        let targetKey = normalized;
        if (this.aliases[normalized] !== undefined) {
            targetKey = this.aliases[normalized];
            if (targetKey === null) return null; // 除外対象 (Unencumbered等)
        }

        // 2. マスター定義参照
        if (this.definitions[targetKey]) {
            return this.definitions[targetKey];
        }

        // 3. 部分一致検索フォールバック
        for (const [key, def] of Object.entries(this.definitions)) {
            if (key.includes(targetKey) || targetKey.includes(key)) {
                return def;
            }
        }

        // 4. 未知の異常に対する安全な動的フォールバック
        return {
            key: normalized,
            id: `COND_${normalized.toUpperCase()}`,
            nameJa: raw,
            nameEn: raw,
            labelJa: `⚠️${raw}`,
            labelEn: `⚠️${raw}`,
            icon: '⚠️',
            severity: CONDITION_SEVERITY.WARNING,
            descriptionJa: `状態異常: ${raw}`,
            descriptionEn: `Condition: ${raw}`
        };
    }

    /**
     * NetHackのステータスオブジェクトから構造化バッジ配列を生成
     * @param {Object} status
     * @param {string} [lang='ja'] 'ja' または 'en'
     * @returns {Array<Object>} 深刻度順にソートされた状態異常バッジリスト
     */
    resolveStatusConditions(status, lang = 'ja') {
        if (!status) return [];

        const isJa = lang === 'ja' || lang === 'jp';
        const rawItems = [];

        // 1. conditions 配列または文字列
        if (Array.isArray(status.conditions)) {
            for (const c of status.conditions) {
                if (c && typeof c === 'string') rawItems.push(c);
            }
        } else if (typeof status.conditions === 'string' && status.conditions.trim()) {
            rawItems.push(...status.conditions.split(/\s+/).filter(Boolean));
        }

        // 2. hunger (空腹度)
        if (status.hunger && typeof status.hunger === 'string') {
            const h = status.hunger.trim();
            // Not Hungry / Normal / Satisfied 等は除外
            if (h && !/^(not hungry|normal|satisfied)$/i.test(h)) {
                rawItems.push(h);
            }
        }

        // 3. encumbrance / cap (負荷)
        const capNames = ["Unencumbered", "Burdened", "Stressed", "Strained", "Overtaxed", "Overloaded"];
        let encText = null;
        const encCap = typeof status.cap === 'number' ? status.cap : 0;
        if (status.encumbrance && typeof status.encumbrance === 'string' && status.encumbrance.toLowerCase() !== 'unencumbered') {
            encText = status.encumbrance;
        } else if (encCap > 0 && encCap < capNames.length) {
            encText = capNames[encCap];
        }
        if (encText && encText.toLowerCase() !== 'unencumbered') {
            rawItems.push(encText);
        }

        // 4. 重複排除とマスター定義解決
        const seenKeys = new Set();
        const badges = [];

        for (const raw of rawItems) {
            const def = this.resolveCondition(raw);
            if (!def) continue;

            if (seenKeys.has(def.key)) continue;
            seenKeys.add(def.key);

            const colors = SEVERITY_COLORS[def.severity] || SEVERITY_COLORS[CONDITION_SEVERITY.INFO];

            badges.push({
                key: def.key,
                raw: raw,
                name: isJa ? def.nameJa : def.nameEn,
                label: isJa ? def.labelJa : def.labelEn,
                icon: def.icon,
                severity: def.severity,
                description: isJa ? def.descriptionJa : def.descriptionEn,
                colors: colors
            });
        }

        // 5. 深刻度順にソート (FATAL > CRITICAL > WARNING > INFO)
        const severityRank = {
            [CONDITION_SEVERITY.FATAL]: 4,
            [CONDITION_SEVERITY.CRITICAL]: 3,
            [CONDITION_SEVERITY.WARNING]: 2,
            [CONDITION_SEVERITY.INFO]: 1
        };

        badges.sort((a, b) => {
            const rankA = severityRank[a.severity] || 0;
            const rankB = severityRank[b.severity] || 0;
            return rankB - rankA;
        });

        return badges;
    }
}
