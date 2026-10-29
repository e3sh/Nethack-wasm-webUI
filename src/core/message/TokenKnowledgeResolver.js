/**
 * TokenKnowledgeResolver.js
 * Phase 3: クリック時遅延解決 (Lazy Resolution) ＆ GKLナレッジ・翻訳統合
 *
 * 【重要: ネタバレ防止原則】
 * メッセージ内の未識別外見名（例: "ruby potion"）をクリックした際、
 * 静的辞書で真名 onum を直接引いてネタバレさせてはならない。
 * 必ず GKL (StructuredKnowledgeEngine) を経由させ、
 * 未識別時は「未鑑定アイテム図鑑」、識別済み時は「真名アイテム図鑑」のデータを返す。
 *
 * 仕様書: docs/9_translation/semantic_message_tokenization_and_interactive_rendering_specification.ja.md
 */

import { OBJECT_KNOWLEDGE_MAP } from '../knowledge/data/OBJECT_KNOWLEDGE_FULL.js';
import { MONSTER_KNOWLEDGE_MAP } from '../knowledge/data/MONSTER_KNOWLEDGE_FULL.js';

// 環境・地形・身体部位・抽象名詞ストップワード (V2: 誤爆完全遮断用)
// ※ statue は正規オブジェクト (onum: 476) のため除外
export const TERRAIN_AND_ENV_STOP_NOUNS = new Set([
    'door', 'doorway', 'wall', 'rock', 'stone', 'corridor', 'stairs', 'staircase',
    'ladder', 'altar', 'sink', 'fountain', 'throne', 'tree', 'bars', 'iron bars',
    'drawbridge', 'water', 'lava', 'pool', 'moat', 'ice', 'air', 'floor', 'ground',
    'ceiling', 'pit', 'web', 'trap', 'boulder', 'grave', 'headstone',
    'hand', 'hands', 'foot', 'feet', 'head', 'body', 'leg', 'arm', 'finger', 'neck',
    'mind', 'stomach', 'purse', 'knapsack', 'bag', 'nothing', 'something', 'someone',
    'it', 'yourself'
]);

// 冠詞・指示詞・所有格の除去
const STRIP_DETERMINER_REGEX = /^(?:the|an?|your|this|that|these|those|my)\s+/i;
const QUANTITY_PREFIX_REGEX = /^(?:some|several|many|a\s+few|a\s+pair\s+of|\d+|two|three|four|five|six|seven|eight|nine|ten)\s+/i;
const BUC_PREFIX_REGEX = /^(?:blessed|uncursed|cursed|holy|unholy)\s+/i;
const CONDITION_PREFIX_REGEX = /^(?:partly\s+used|partly\s+eaten|diluted)\s+/i;
const EROSION_PREFIX_REGEX = /^(?:(?:very|thoroughly|extremely)\s+)?(?:rusty|corroded|burnt|rotted|damaged|rustproof|corrodeproof|fireproof|fixed|greased|poisoned|wet|lit|unlit|empty|unlocked|locked|broken)\s+/i;
const ENCHANTMENT_PREFIX_REGEX = /^[+-]\d+\s+/;

export class TokenKnowledgeResolver {
    /**
     * @param {Object} [options]
     * @param {Map} [options.objectMap]
     * @param {Map} [options.monsterMap]
     */
    constructor(options = {}) {
        this.objectMap = options.objectMap || OBJECT_KNOWLEDGE_MAP;
        this.monsterMap = options.monsterMap || MONSTER_KNOWLEDGE_MAP;
    }

    /**
     * 環境・地形・部位・抽象名詞および数値単体であるか判定する (V2 遮断ゲート)
     * @param {string} text
     * @returns {boolean}
     */
    isIgnoredEntity(text) {
        if (!text || typeof text !== 'string') return true;
        const trimmed = text.trim();
        if (!trimmed) return true;
        if (/^\d+$/.test(trimmed)) return true;

        let clean = trimmed.toLowerCase()
            .replace(/^(?:the|this|that|these|those|an?|your|my)\s+/i, '')
            .trim();

        if (/^\d+$/.test(clean)) return true;
        if (TERRAIN_AND_ENV_STOP_NOUNS.has(clean)) return true;

        return false;
    }

    /**
     * トークンが有効なエンティティとして解決可能かを軽量判定 (事後検証ゲート用・副作用なし)
     * @param {Object} token
     * @param {Object} [gkl]
     * @returns {boolean}
     */
    canResolve(token, gkl) {
        if (!token || !token.text) return false;
        const rawText = token.text.trim();
        if (this.isIgnoredEntity(rawText)) return false;

        const cleanText = this.cleanEntityName(rawText);
        if (!cleanText || this.isIgnoredEntity(cleanText)) return false;

        const candidates = this._getCandidates(cleanText);

        if (token.type === 'monster') {
            for (const cand of candidates) {
                const lower = cand.toLowerCase();
                if (this.monsterMap && this.monsterMap.has(lower)) {
                    return true;
                }
            }
            if (gkl) {
                const mt = gkl.monsterTracker;
                if (mt && typeof mt.getTrackedMonsters === 'function') {
                    const tracked = mt.getTrackedMonsters();
                    if (tracked && tracked.some(m => candidates.includes(m.name?.toLowerCase()))) {
                        return true;
                    }
                }
            }
            return false;
        }

        if (token.type === 'item') {
            for (const cand of candidates) {
                const lower = cand.toLowerCase();
                if (lower === 'gold piece') return true;

                if (this.objectMap) {
                    for (const item of this.objectMap.values()) {
                        if (item.name && item.name.toLowerCase() === lower) {
                            return true;
                        }
                        if (item.unidentifiedNameEn && item.unidentifiedNameEn.toLowerCase() === lower) {
                            return true;
                        }
                    }
                }
            }
            if (gkl) {
                const inv = gkl.inventoryStateManager;
                if (inv && typeof inv.getItems === 'function') {
                    const items = inv.getItems();
                    if (items && items.some(it => candidates.includes(it.name?.toLowerCase()))) {
                        return true;
                    }
                }
            }
            return false;
        }

        return false;
    }

    /**
     * トークンをクリックした際の遅延解決
     * @param {Object} token MessageToken ({ type, text, meta, ... })
     * @param {Object} [gkl] GKLPlugin または WebUICore.gkl インスタンス
     * @param {Object} [options]
     * @returns {Object|null} 解決された構造化ナレッジデータ (または null)
     */
    resolveTokenKnowledge(token, gkl, options = {}) {
        if (!token || !token.text) {
            return null;
        }

        const rawText = token.text.trim();
        if (this.isIgnoredEntity(rawText)) {
            return null;
        }

        const cleanText = this.cleanEntityName(rawText);
        if (!cleanText || this.isIgnoredEntity(cleanText)) {
            return null;
        }

        const ske = gkl?.structuredKnowledge || (typeof gkl?.getKnowledge === 'function' ? gkl : null);

        // 🗡️ アイテムトークンの遅延解決 (ネタバレ防止パイプライン)
        if (token.type === 'item') {
            return this._resolveItemKnowledge(cleanText, rawText, ske, options);
        }

        // 🐉 モンスタートークンの遅延解決
        if (token.type === 'monster') {
            return this._resolveMonsterKnowledge(cleanText, rawText, ske, options);
        }

        return null;
    }

    /**
     * 単数形・基底名候補リストを生成 (英語の複数形対応 & A of B 形式対応)
     */
    _getCandidates(name) {
        const clean = name.trim();
        const lower = clean.toLowerCase();
        const list = [clean, lower];

        // "A of B" 形式の複数形還元
        // 例: "potions of healing" -> "potion of healing"
        // 例: "scrolls of identify" -> "scroll of identify"
        // 例: "wands of striking" -> "wand of striking"
        // 例: "pairs of leather gloves" -> "pair of leather gloves", "leather gloves"
        const ofMatch = lower.match(/^(.+?)\s+of\s+(.+)$/);
        if (ofMatch) {
            const head = ofMatch[1];
            const tail = ofMatch[2];
            const headCandidates = this._getPluralReductions(head);
            for (const h of headCandidates) {
                list.push(`${h} of ${tail}`);
            }
            if (head === 'pairs' || head === 'pair') {
                list.push(tail);
            }
        }

        // 🍖 死体 (corpse: onum 265) 形式の還元
        // 例: "goblin corpse" -> "corpse"
        // 例: "lichen corpses" -> "corpse"
        // 例: "corpse of a kobold" -> "corpse"
        const corpseSuffixMatch = lower.match(/^(.+?)\s+corpses?$/);
        if (corpseSuffixMatch) {
            list.push('corpse');
            const monPart = corpseSuffixMatch[1].trim();
            list.push(monPart);
            for (const r of this._getPluralReductions(monPart)) {
                list.push(r);
            }
        }
        const corpseOfMatch = lower.match(/^corpses?\s+of\s+(?:an?\s+|the\s+)?(.+)$/);
        if (corpseOfMatch) {
            list.push('corpse');
            const monPart = corpseOfMatch[1].trim();
            list.push(monPart);
            for (const r of this._getPluralReductions(monPart)) {
                list.push(r);
            }
        }

        // 🗿 石像 (statue: onum 476) 形式の還元
        // 例: "statue of a kobold" -> "statue"
        // 例: "historic statue of a goblin" -> "statue"
        // 例: "kobold statue" -> "statue"
        const statueOfMatch = lower.match(/^(?:historic\s+)?statues?\s+of\s+(?:an?\s+|the\s+)?(.+)$/);
        if (statueOfMatch) {
            list.push('statue');
            const monPart = statueOfMatch[1].trim();
            list.push(monPart);
            for (const r of this._getPluralReductions(monPart)) {
                list.push(r);
            }
        }
        const statueSuffixMatch = lower.match(/^(?:historic\s+)?(.+?)\s+statues?$/);
        if (statueSuffixMatch) {
            list.push('statue');
            const monPart = statueSuffixMatch[1].trim();
            list.push(monPart);
            for (const r of this._getPluralReductions(monPart)) {
                list.push(r);
            }
        }

        // 通常の複数形還元
        const baseReductions = this._getPluralReductions(lower);
        list.push(...baseReductions);

        // 重複除外
        return Array.from(new Set(list));
    }

    /**
     * 英語の複数形語尾を単数形へ還元
     */
    _getPluralReductions(word) {
        const res = [];
        if (word.endsWith('ies') && word.length > 3) {
            res.push(word.slice(0, -3) + 'y');
        } else if (word.endsWith('es') && word.length > 2) {
            res.push(word.slice(0, -2));
            res.push(word.slice(0, -1));
        } else if (word.endsWith('s') && word.length > 1) {
            res.push(word.slice(0, -1));
        }
        return res;
    }

    /**
     * アイテム解決: 未識別時は未鑑定図鑑、識別済み時は真名図鑑を返却
     */
    _resolveItemKnowledge(cleanName, rawName, ske, options) {
        const candidates = this._getCandidates(cleanName);

        for (const cand of candidates) {
            // 未識別外見名（例: "ruby potion"）かどうかの判定
            let isAppearanceName = false;
            let matchedAppearanceItem = null;

            if (this.objectMap) {
                for (const item of this.objectMap.values()) {
                    if (item.unidentifiedNameEn && item.unidentifiedNameEn.toLowerCase() === cand.toLowerCase()) {
                        isAppearanceName = true;
                        matchedAppearanceItem = item;
                        break;
                    }
                }
            }

            const query = {
                name: cand,
                rawText: rawName,
                ...(isAppearanceName ? {
                    identification: {
                        isUnidentified: true,
                        appearanceName: cand
                    }
                } : {})
            };

            let result = null;
            if (ske && typeof ske.getKnowledge === 'function') {
                result = ske.getKnowledge(query, options);
            }
            if (!result && ske && typeof ske.getItemKnowledge === 'function') {
                result = ske.getItemKnowledge(query, options) || ske.getItemKnowledge(cand, options);
            }

            // GKL がない、または未解決時の静的辞書フォールバック (SSOT)
            if (!result && this.objectMap) {
                if (isAppearanceName && matchedAppearanceItem) {
                    result = {
                        id: `appearance_${matchedAppearanceItem.category || 'item'}_${cand.toLowerCase().replace(/\s+/g, '_')}`,
                        name: cand,
                        nameJa: matchedAppearanceItem.unidentifiedNameJa || cand,
                        category: matchedAppearanceItem.category || 'ITEM',
                        type: 'ITEM',
                        isUnidentified: true,
                        appearanceName: cand,
                        unidentifiedNameJa: matchedAppearanceItem.unidentifiedNameJa,
                        effectSummary: 'Unidentified item.',
                        effectSummaryJa: '未識別のアイテム。'
                    };
                } else {
                    for (const item of this.objectMap.values()) {
                        if (item.name && item.name.toLowerCase() === cand.toLowerCase()) {
                            result = {
                                id: item.id || `item_${item.onum}`,
                                onum: item.onum,
                                name: item.name,
                                nameJa: item.nameJa,
                                category: item.category || 'ITEM',
                                stats: item.stats,
                                effectSummary: item.effectSummaryJa || item.effectSummary || item.flavorNote,
                                type: 'ITEM'
                            };
                            break;
                        }
                    }
                }
            }

            if (result) {
                if (isAppearanceName) {
                    result.isUnidentified = true;
                    result.appearanceName = cand;
                    if (matchedAppearanceItem && matchedAppearanceItem.unidentifiedNameJa) {
                        result.unidentifiedNameJa = matchedAppearanceItem.unidentifiedNameJa;
                    }
                }

                // 🍖 死体 (corpse: onum 265) のモンスター情報補強
                if (result.onum === 265) {
                    const lowerClean = cleanName.toLowerCase();
                    const corpseMatch = lowerClean.match(/^(.+?)\s+corpses?$/) || lowerClean.match(/^corpses?\s+of\s+(?:an?\s+|the\s+)?(.+)$/);
                    if (corpseMatch) {
                        const monCandidate = corpseMatch[1].trim();
                        const mon = this.monsterMap?.get(monCandidate) || this.monsterMap?.get(this._getPluralReductions(monCandidate)[0]);
                        if (mon) {
                            result.corpseMonster = mon;
                            result.name = `${mon.name} corpse`;
                            if (mon.nameJa) {
                                result.nameJa = `${mon.nameJa}の死体`;
                            }
                        }
                    }
                }

                // 🗿 石像 (statue: onum 476) のモンスター情報補強
                if (result.onum === 476) {
                    const lowerClean = cleanName.toLowerCase();
                    const statueMatch = lowerClean.match(/^(?:historic\s+)?statues?\s+of\s+(?:an?\s+|the\s+)?(.+)$/) || lowerClean.match(/^(?:historic\s+)?(.+?)\s+statues?$/);
                    if (statueMatch) {
                        const monCandidate = statueMatch[1].trim();
                        const mon = this.monsterMap?.get(monCandidate) || this.monsterMap?.get(this._getPluralReductions(monCandidate)[0]);
                        if (mon) {
                            result.statueMonster = mon;
                            result.name = `statue of ${mon.name}`;
                            if (mon.nameJa) {
                                result.nameJa = `${mon.nameJa}の彫像`;
                            }
                        }
                    }
                }

                return result;
            }
        }

        return null;
    }

    /**
     * モンスター解決
     */
    _resolveMonsterKnowledge(cleanName, rawName, ske, options) {
        const candidates = this._getCandidates(cleanName);

        for (const cand of candidates) {
            let result = null;
            if (ske && typeof ske.getMonsterKnowledge === 'function') {
                result = ske.getMonsterKnowledge(cand, options) || ske.getMonsterKnowledge(rawName, options);
            }

            if (!result && ske && typeof ske.getKnowledge === 'function') {
                const query = {
                    type: 'MONSTER',
                    name: cand,
                    rawText: rawName
                };
                result = ske.getKnowledge(query, options);
            }

            // GKL がない、または未解決時の静的辞書フォールバック (SSOT)
            if (!result && this.monsterMap && this.monsterMap.has(cand.toLowerCase())) {
                const mon = this.monsterMap.get(cand.toLowerCase());
                result = {
                    id: mon.id || `mon_${mon.monOffset}`,
                    monOffset: mon.monOffset,
                    name: mon.name,
                    nameJa: mon.nameJa,
                    symbol: mon.symbol,
                    dangerLevel: mon.dangerLevel || 'MEDIUM',
                    stats: mon.stats,
                    attacks: mon.attacks,
                    traits: mon.traits,
                    resistances: mon.resistances,
                    weaknesses: mon.weaknesses,
                    type: 'MONSTER'
                };
            }

            if (result) {
                return result;
            }
        }

        return null;
    }

    /**
     * トークンに対応する公式和名 (nameJa) を取得 (UIハイライト・翻訳連動用)
     * @param {Object} token
     * @returns {string|null}
     */
    getJapaneseName(token) {
        if (!token || !token.text) return null;
        const candidates = this._getCandidates(this.cleanEntityName(token.text));

        for (const cand of candidates) {
            const lower = cand.toLowerCase();
            if (token.type === 'monster') {
                const mon = this.monsterMap.get(lower);
                if (mon && mon.nameJa) return mon.nameJa;
            }

            if (token.type === 'item') {
                const lowerClean = this.cleanEntityName(token.text).toLowerCase();

                // 🍖 死体の合成和名 (例: "ゴブリンの死体")
                const corpseMatch = lowerClean.match(/^(.+?)\s+corpses?$/) || lowerClean.match(/^corpses?\s+of\s+(?:an?\s+|the\s+)?(.+)$/);
                if (corpseMatch) {
                    const monCandidate = corpseMatch[1].trim();
                    const mon = this.monsterMap?.get(monCandidate) || this.monsterMap?.get(this._getPluralReductions(monCandidate)[0]);
                    if (mon && mon.nameJa) {
                        return `${mon.nameJa}の死体`;
                    }
                    return '死体';
                }

                // 🗿 石像の合成和名 (例: "コボルドの彫像")
                const statueMatch = lowerClean.match(/^(?:historic\s+)?statues?\s+of\s+(?:an?\s+|the\s+)?(.+)$/) || lowerClean.match(/^(?:historic\s+)?(.+?)\s+statues?$/);
                if (statueMatch) {
                    const monCandidate = statueMatch[1].trim();
                    const mon = this.monsterMap?.get(monCandidate) || this.monsterMap?.get(this._getPluralReductions(monCandidate)[0]);
                    if (mon && mon.nameJa) {
                        return `${mon.nameJa}の彫像`;
                    }
                    return '彫像';
                }

                for (const item of this.objectMap.values()) {
                    if (item.name && item.name.toLowerCase() === lower) {
                        return item.nameJa || item.name;
                    }
                    if (item.unidentifiedNameEn && item.unidentifiedNameEn.toLowerCase() === lower) {
                        return item.unidentifiedNameJa || item.unidentifiedNameEn;
                    }
                }
            }
        }

        return null;
    }

    /**
     * 冠詞や修飾語を除去した基底エンティティ名を抽出 (V2 多段正規化パイプライン)
     * @param {string} text
     * @returns {string}
     */
    cleanEntityName(text) {
        if (!text || typeof text !== 'string') return '';
        let s = text.trim();
        if (!s) return '';

        // 金貨の早期判定 (単独・数量付き)
        if (/^\d*\s*gold\s+pieces?$/i.test(s) || /^a\s+gold\s+piece$/i.test(s)) {
            return 'gold piece';
        }

        // 1. インベントリスロット接頭辞の除去 ("f - ", "$ - ")
        s = s.replace(/^[a-zA-Z\$]\s+-\s+/, '');

        // 2. 末尾の括弧付き状態注記・価格の除去
        // 例: "(being worn)", "(weapon in hand)", "(0:5)", "(unpaid, 50 zorkmids)", "(f)"
        s = s.replace(/(?:\s*\([^)]*\))+$/g, '');
        s = s.replace(/,\s+\d+\s+zorkmids?.*$/i, '');

        // 7. 個別命名 (" named ...", " called ...")
        s = s.replace(/\s+(?:named|called)\s+.+$/i, '');

        // 3〜6 の修飾子を剥離する多段ループ (複数連続・複合に対応)
        let changed = true;
        while (changed) {
            const before = s;

            // 3. 冠詞・指示詞・所有格
            s = s.replace(STRIP_DETERMINER_REGEX, '');

            // 3b. 数量表現
            s = s.replace(QUANTITY_PREFIX_REGEX, '');

            // 4. B/U/C (祝福・呪い) および既知フラグ
            s = s.replace(BUC_PREFIX_REGEX, '');
            s = s.replace(CONDITION_PREFIX_REGEX, '');

            // 5. 浸食度・耐性・状態修飾子
            s = s.replace(EROSION_PREFIX_REGEX, '');
            s = s.replace(/^(?:historic)\s+/i, '');

            // 6. 強化値 (+0, +1, -2 等)
            s = s.replace(ENCHANTMENT_PREFIX_REGEX, '');

            s = s.trim();
            if (s === before) {
                changed = false;
            }
        }

        // 金貨再チェック (数量が剥がれた "gold pieces" 等)
        if (/^gold\s+pieces?$/i.test(s)) {
            return 'gold piece';
        }

        return s.trim();
    }
}

export const tokenKnowledgeResolver = new TokenKnowledgeResolver();
export default TokenKnowledgeResolver;
