/**
 * SkillStateManager.js
 * 
 * プレイヤーのスキル熟練度（Skills / #enhance）状態を管理・キャッシュし、
 * 武術・格闘・武器・魔法の全スキル熟練度および向上可能（*）状態を提供するマネージャー。
 * コンテキストアクションエンジンやUIクライアントと連携する。
 */

export const SKILL_RANKS = {
    UNSKILLED: { key: 'unskilled', label: '未熟', en: 'Unskilled', score: 0 },
    BASIC: { key: 'basic', label: '入門', en: 'Basic', score: 10 },
    SKILLED: { key: 'skilled', label: '熟練', en: 'Skilled', score: 25 },
    EXPERT: { key: 'expert', label: '達人', en: 'Expert', score: 40 },
    MASTER: { key: 'master', label: '名人', en: 'Master', score: 60 },
    GRAND_MASTER: { key: 'grandmaster', label: '師範', en: 'Grand Master', score: 80 },
    RESTRICTED: { key: 'restricted', label: '不可', en: 'Restricted', score: -10 }
};

export class SkillStateManager {
    constructor(options = {}) {
        // スキルリスト
        // item: { name: 'long sword', nameRaw: 'long sword', rank: { key, label, en, score }, canEnhance: false, rawText: '...' }
        this.skills = [];
        this.isSynced = false;
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.skills = [];
        this.isSynced = false;
    }

    /**
     * キャッシュの無効化（次回入力待ち等でのサイレント再同期を要求）
     */
    invalidate() {
        this.isSynced = false;
    }

    /**
     * 全スキルリストを取得
     * @returns {Array<Object>}
     */
    getSkills() {
        return this.skills;
    }

    /**
     * 有効スキル（Basic / 入門以上、または向上可能 * 状態）のみを抽出して取得
     * @returns {Array<Object>}
     */
    getActiveSkills() {
        return this.skills.filter(s => {
            if (!s || !s.rank) return false;
            if (s.canEnhance) return true;
            return s.rank.key !== 'unskilled' && s.rank.key !== 'restricted';
        });
    }

    /**
     * スキルランクの正規化
     * ⚠️ 重要: 文字列競合を防ぐため必ず 'unskilled' を 'skilled' より先に判定すること
     * @param {string} rankStr 
     * @returns {{ key: string, label: string, en: string, score: number }}
     */
    normalizeRank(rankStr) {
        if (!rankStr) return { ...SKILL_RANKS.UNSKILLED };
        const lower = rankStr.toLowerCase();

        // ⚠️ 必ず unskilled を skilled より先にチェックすること！
        if (lower.includes('unskilled') || lower.includes('未熟')) {
            return { ...SKILL_RANKS.UNSKILLED };
        }
        if (lower.includes('grand') || lower.includes('師範')) {
            return { ...SKILL_RANKS.GRAND_MASTER };
        }
        if (lower.includes('master') || lower.includes('名人')) {
            return { ...SKILL_RANKS.MASTER };
        }
        if (lower.includes('expert') || lower.includes('達人')) {
            return { ...SKILL_RANKS.EXPERT };
        }
        if (lower.includes('skilled') || lower.includes('熟練')) {
            return { ...SKILL_RANKS.SKILLED };
        }
        if (lower.includes('basic') || lower.includes('入門') || lower.includes('基本')) {
            return { ...SKILL_RANKS.BASIC };
        }
        if (lower.includes('restricted') || lower.includes('制限') || lower.includes('不可')) {
            return { ...SKILL_RANKS.RESTRICTED };
        }

        return { key: 'unskilled', label: rankStr, en: rankStr, score: 0 };
    }

    /**
     * 指定されたスキル名または武器名に対するランク情報を取得
     * @param {string} skillOrWeaponName 
     * @returns {{ key: string, label: string, en: string, score: number }}
     */
    getSkillRank(skillOrWeaponName) {
        if (!skillOrWeaponName) return { ...SKILL_RANKS.UNSKILLED };
        const target = skillOrWeaponName.toLowerCase().trim();

        // 完全一致または前方一致・部分一致でスキルを検索
        const found = this.skills.find(s => {
            const sName = (s.name || '').toLowerCase();
            const sRaw = (s.nameRaw || '').toLowerCase();
            return sName === target || sRaw === target ||
                   target.includes(sName) || sName.includes(target) ||
                   target.includes(sRaw) || sRaw.includes(target);
        });

        if (found && found.rank) {
            return found.rank;
        }

        return { ...SKILL_RANKS.UNSKILLED };
    }

    /**
     * 単一行テキストからスキル情報をパース
     * @param {string} rawText 
     * @returns {Object|null}
     */
    parseSkillLine(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;

        const trimmed = rawText.trim();
        if (!trimmed) return null;

        // 除外ヘッダー行・フッター行・区切り行などの判定
        const lower = trimmed.toLowerCase();
        if (lower.includes('skills') && (lower.includes('current') || lower.includes('enhance') || lower.includes('slots'))) {
            if (!lower.includes('[') && !lower.includes('(')) return null;
        }
        if (lower.startsWith('(end)') || lower.startsWith('(1 of') || lower.startsWith('(2 of')) return null;

        // 向上可能フラグ (先頭またはセレクタ直後の *)
        let canEnhance = false;
        let workText = trimmed;
        if (workText.startsWith('*')) {
            canEnhance = true;
            workText = workText.substring(1).trim();
        }

        // メニューセレクタ ('a - ', 'a) ') の除去
        const selectorMatch = workText.match(/^[a-zA-Z0-9]\s*[\-\.\)]\s*(.*)$/);
        if (selectorMatch) {
            workText = selectorMatch[1].trim();
        }

        if (workText.startsWith('*')) {
            canEnhance = true;
            workText = workText.substring(1).trim();
        }

        // ランク文字列の抽出: [Basic], [Skilled], (入門), [熟練] 等
        let name = '';
        let rankStr = '';

        const bracketMatch = workText.match(/^(.*?)[\[\(]([a-zA-Z\u3000-\u9fff\s]+)[\]\)](.*)$/);
        if (bracketMatch) {
            name = bracketMatch[1].trim();
            rankStr = bracketMatch[2].trim();
        } else {
            // ブラケットがない場合、末尾にランク名がある形式: "long sword   Basic" 等
            const endRankMatch = workText.match(/^(.*?)\s{2,}([a-zA-Z\u3000-\u9fff]+)$/);
            if (endRankMatch) {
                name = endRankMatch[1].trim();
                rankStr = endRankMatch[2].trim();
            }
        }

        if (!name || !rankStr) return null;

        const rank = this.normalizeRank(rankStr);

        return {
            name,
            nameRaw: name,
            rank,
            canEnhance,
            rawText: trimmed
        };
    }

    /**
     * メニュー項目からスキル一覧を更新
     * @param {Array<Object>} menuItems 
     */
    updateFromMenuItems(menuItems) {
        if (!Array.isArray(menuItems)) return;

        const parsedSkills = [];

        menuItems.forEach(mi => {
            if (!mi) return;
            const rawText = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
            if (!rawText) return;

            const skillInfo = this.parseSkillLine(rawText);
            if (skillInfo) {
                // 重複排除または上書き
                const idx = parsedSkills.findIndex(s => s.name === skillInfo.name);
                if (idx >= 0) {
                    parsedSkills[idx] = skillInfo;
                } else {
                    parsedSkills.push(skillInfo);
                }
            }
        });

        this.skills = parsedSkills;
        this.isSynced = true;
    }

    /**
     * テキスト行の配列からスキル一覧を更新
     * @param {Array<string>} lines 
     */
    updateFromLines(lines) {
        if (!Array.isArray(lines) || lines.length === 0) return;

        const parsedSkills = [];
        for (const line of lines) {
            if (typeof line !== 'string') continue;
            const skillInfo = this.parseSkillLine(line);
            if (skillInfo) {
                const idx = parsedSkills.findIndex(s => s.name === skillInfo.name);
                if (idx >= 0) {
                    parsedSkills[idx] = skillInfo;
                } else {
                    parsedSkills.push(skillInfo);
                }
            }
        }

        if (parsedSkills.length > 0) {
            this.skills = parsedSkills;
            this.isSynced = true;
        }
    }

    /**
     * バッファがスキル一覧 (#enhance) のものであるか判定
     * @param {Array<Object>} sequenceBuffer 
     * @returns {boolean}
     */
    isSkillBuffer(sequenceBuffer) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) return false;

        for (const item of sequenceBuffer) {
            if (!item) continue;
            const title = (item.title || item.prompt || '').toLowerCase();
            if (title.includes('skill') || title.includes('enhance') || title.includes('スキル') || title.includes('熟練')) {
                return true;
            }

            const items = item.menuItems || item.items || [];
            if (items.length > 0) {
                let validCount = 0;
                for (const mi of items) {
                    const str = mi.rawStr || mi.str || mi.text || (typeof mi === 'string' ? mi : '');
                    if (str && this.parseSkillLine(str)) {
                        validCount++;
                    }
                }
                if (validCount > 0 && validCount >= Math.min(items.length, 2)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * シーケンスバッファからスキルリストを抽出して一括更新
     * @param {Array<Object>} sequenceBuffer 
     * @param {boolean} [force=false] 
     */
    updateFromSequenceBuffer(sequenceBuffer, force = false) {
        if (!Array.isArray(sequenceBuffer) || sequenceBuffer.length === 0) {
            if (force) {
                this.isSynced = true;
            }
            return;
        }
        if (!force && !this.isSkillBuffer(sequenceBuffer)) return;

        let parsed = false;
        for (const item of sequenceBuffer) {
            if (!item) continue;

            if (item.menuItems || item.items) {
                const menuItems = item.menuItems || item.items;
                if (Array.isArray(menuItems) && menuItems.length > 0) {
                    this.updateFromMenuItems(menuItems);
                    parsed = true;
                    return;
                }
            }

            if (item.lines || item.text) {
                const lines = item.lines || (typeof item.text === 'string' ? item.text.split('\n') : []);
                if (Array.isArray(lines) && lines.length > 0) {
                    this.updateFromLines(lines);
                    parsed = true;
                    return;
                }
            }
        }

        if (force && !parsed) {
            this.isSynced = true;
        }
    }

    /**
     * メッセージテキストからのスキル向上・熟練度変化検知
     * @param {string} text 
     * @returns {boolean} キャッシュが無効化されたか
     */
    updateFromMessage(text) {
        if (!text || typeof text !== 'string') return false;

        const lower = text.toLowerCase();

        // 1. 日本語版のスキル向上・向上可能メッセージ:
        const isJpSkillMsg = /(?:スキル|熟練度)が(?:入門|熟練|達人|名人|師範|向上|上がった)/.test(text) ||
                             /(?:スキル|熟練度)を上げることができる/.test(text) ||
                             /スキルを向上/.test(text);

        if (isJpSkillMsg) {
            this.invalidate();
            return true;
        }

        // 2. 英語版のスキル向上・向上可能メッセージ:
        const isEnSkillMsg = /You are now (?:basic|skilled|expert|master|grand master) in /i.test(text) ||
                             /You feel more confident in your .* skills/i.test(text) ||
                             /You feel you could be more (?:dangerous|skilled) with /i.test(text) ||
                             /could be enhanced/i.test(text);

        if (isEnSkillMsg) {
            this.invalidate();
            return true;
        }

        return false;
    }
}
