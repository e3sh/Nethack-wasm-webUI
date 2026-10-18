/**
 * ItemCandidateResolver.js
 *
 * 未識別アイテムの候補逆引き＆命名アシストエンジン (ROADMAP §2.1 / Gap 2 対応)
 *
 * 【役割と責務】
 * 1. 未識別アイテムのカテゴリ（巻物・薬・杖・指輪・魔除け等）、基礎価格帯（または店の買値・売値）、
 *    および外見・直前効果から候補となる真名リストを抽出。
 * 2. DiscoveryStateManager と連携し、セッション内で既に識別済みのアイテム（discoveredOnums）を
 *    候補から安全に除外・区別。
 * 3. 価格帯グルーピングおよび即座に Call できるショートハンド命名候補（例: "100G?", "identify?", "healing?"）を生成。
 */

import { OBJECT_KNOWLEDGE_MAP } from "../data/OBJECT_KNOWLEDGE_FULL.js";
import { DISCOVERY_MESSAGE_MAP } from "../data/DISCOVERY_MESSAGE_MAP.js";
import { ARTIFACT_KNOWLEDGE_BASE } from "../data/ARTIFACT_KNOWLEDGE_BASE.js";

// カテゴリ名の正規化マッピング
const CATEGORY_MAP = {
    scroll: 'SCROLL',
    scrolls: 'SCROLL',
    potion: 'POTION',
    potions: 'POTION',
    wand: 'WAND',
    wands: 'WAND',
    ring: 'RING',
    rings: 'RING',
    amulet: 'AMULET',
    amulets: 'AMULET',
    spellbook: 'SPELLBOOK',
    spellbooks: 'SPELLBOOK',
    book: 'SPELLBOOK',
    books: 'SPELLBOOK',
    armor: 'ARMOR',
    armors: 'ARMOR',
    weapon: 'WEAPON',
    weapons: 'WEAPON',
    tool: 'TOOL',
    tools: 'TOOL',
    gem: 'GEM',
    gems: 'GEM'
};

// 接頭辞除去用パターン
const PREFIX_REGEX = /^(scroll\s+of|potion\s+of|wand\s+of|ring\s+of|amulet\s+of|spellbook\s+of)\s+/i;

// NetHack 既知の主要基礎価格リスト（代表的なカテゴリ別基礎コスト）
const STANDARD_BASE_COSTS = [
    5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100, 150, 175, 200, 250, 300, 400, 500, 600, 700
];

export class ItemCandidateResolver {
    /**
     * カテゴリ文字列を正規化 ('scrolls' -> 'SCROLL')
     * @param {string} category 
     * @returns {string}
     */
    static normalizeCategory(category) {
        if (!category || typeof category !== 'string') return '';
        const clean = category.trim().toLowerCase();
        return CATEGORY_MAP[clean] || clean.toUpperCase();
    }

    /**
     * 多様なアイテムオブジェクト構造からカテゴリを決定論的に解決
     * @param {Object|string} target 
     * @returns {string} 'SCROLL' | 'POTION' | 'WAND' | 'RING' | 'AMULET' | 'SPELLBOOK' | 'ARMOR' | 'WEAPON' | 'TOOL' | 'GEM' | ''
     */
    static resolveCategory(target) {
        if (!target) return '';
        if (typeof target === 'string') {
            return this.resolveCategoryFromName(target);
        }

        // 1. 直接指定された具象カテゴリ
        const directCat = target.category || target.onumCategory || target.itemCategory;
        if (directCat && directCat !== 'OBJECT' && directCat !== 'OTHER') {
            const norm = this.normalizeCategory(directCat);
            if (norm && norm !== 'OBJECT' && norm !== 'OTHER') return norm;
        }

        // 2. knowledge / identification 内のカテゴリ
        if (target.knowledge?.category) {
            const norm = this.normalizeCategory(target.knowledge.category);
            if (norm && norm !== 'OBJECT' && norm !== 'OTHER') return norm;
        }
        if (target.identification?.category) {
            const norm = this.normalizeCategory(target.identification.category);
            if (norm && norm !== 'OBJECT' && norm !== 'OTHER') return norm;
        }

        // 3. onum による OBJECT_KNOWLEDGE_MAP 逆引き
        const onum = (typeof target.onum === 'number' && target.onum >= 0) ? target.onum :
            (target.identification && typeof target.identification.onum === 'number') ? target.identification.onum :
            (target.knowledge && typeof target.knowledge.onum === 'number') ? target.knowledge.onum : -1;
        if (onum >= 0 && OBJECT_KNOWLEDGE_MAP.has(onum)) {
            const item = OBJECT_KNOWLEDGE_MAP.get(onum);
            if (item && item.category) {
                return this.normalizeCategory(item.category);
            }
        }

        // 4. oclass (NetHackシンボル・ID)
        const oclass = target.oclass !== undefined ? target.oclass : target.directObject?.oclass;
        if (oclass !== undefined && oclass !== null) {
            if (oclass === '?' || oclass === 9 || oclass === 'scroll') return 'SCROLL';
            if (oclass === '!' || oclass === 8 || oclass === 'potion') return 'POTION';
            if (oclass === '/' || oclass === 11 || oclass === 'wand') return 'WAND';
            if (oclass === '=' || oclass === 4 || oclass === 'ring') return 'RING';
            if (oclass === '"' || oclass === 5 || oclass === 'amulet') return 'AMULET';
            if (oclass === '+' || oclass === 10 || oclass === 'spellbook') return 'SPELLBOOK';
            if (oclass === ')' || oclass === 2 || oclass === 'weapon') return 'WEAPON';
            if (oclass === '[' || oclass === 3 || oclass === 'armor') return 'ARMOR';
            if (oclass === '(' || oclass === 6 || oclass === 'tool') return 'TOOL';
            if (oclass === '*' || oclass === 13 || oclass === 'gem') return 'GEM';
        }

        // 5. アイテム名・外見名からの推測
        const nameCandidate = target.rawText || target.name || target.appearanceName || target.appearance || '';
        return this.resolveCategoryFromName(nameCandidate);
    }

    /**
     * 文字列（アイテム名または外見名）からカテゴリを推測
     * @param {string} text 
     * @returns {string}
     */
    static resolveCategoryFromName(text) {
        if (!text || typeof text !== 'string') return '';
        const clean = text.toLowerCase();
        if (/\bscroll\b/i.test(clean) || /\bscrolls\b/i.test(clean) || /\b巻物\b/.test(clean)) return 'SCROLL';
        if (/\bpotion\b/i.test(clean) || /\bpotions\b/i.test(clean) || /\b薬\b/.test(clean) || /\bポーション\b/.test(clean)) return 'POTION';
        if (/\bwand\b/i.test(clean) || /\bwands\b/i.test(clean) || /\b杖\b/.test(clean)) return 'WAND';
        if (/\bring\b/i.test(clean) || /\brings\b/i.test(clean) || /\b指輪\b/.test(clean)) return 'RING';
        if (/\bamulet\b/i.test(clean) || /\bamulets\b/i.test(clean) || /\b魔除け\b/.test(clean)) return 'AMULET';
        if (/\bspellbook\b/i.test(clean) || /\bspellbooks\b/i.test(clean) || /\bbook\b/i.test(clean) || /\b魔法書\b/.test(clean)) return 'SPELLBOOK';
        if (/\barmor\b/i.test(clean) || /\bshield\b/i.test(clean) || /\bhelmet\b/i.test(clean) || /\bboots\b/i.test(clean) || /\bgloves\b/i.test(clean) || /\bcloak\b/i.test(clean) || /\b鎧\b/.test(clean) || /\b盾\b/.test(clean) || /\b兜\b/.test(clean) || /\b靴\b/.test(clean)) return 'ARMOR';
        if (/\bsword\b/i.test(clean) || /\bdagger\b/i.test(clean) || /\baxe\b/i.test(clean) || /\bmace\b/i.test(clean) || /\bbow\b/i.test(clean) || /\barrow\b/i.test(clean) || /\b刀\b/.test(clean) || /\b剣\b/.test(clean)) return 'WEAPON';
        return '';
    }

    /**
     * アイテム名からプレフィックス（"scroll of ", "potion of " 等）を除去したコア名を取得
     * @param {string} name 
     * @returns {string}
     */
    static getCoreItemName(name) {
        if (!name || typeof name !== 'string') return '';
        return name.replace(PREFIX_REGEX, '').trim();
    }

    /**
     * ショートハンド仮名（例: "identify?", "healing?"）を生成
     * @param {string} name 
     * @param {boolean} [addQuestionMark=true] 
     * @returns {string}
     */
    static generateShorthand(name, addQuestionMark = true) {
        const core = this.getCoreItemName(name);
        if (!core) return '';
        // 短縮ルールの適用
        let short = core
            .replace(/\bteleportation\b/i, 'teleport')
            .replace(/\bslow digestion\b/i, 'slow digest')
            .replace(/\benlightenment\b/i, 'enlighten')
            .replace(/\binvisibility\b/i, 'invis')
            .replace(/\bhallucination\b/i, 'hallu')
            .replace(/\bpolymorph\b/i, 'poly')
            .replace(/\bconfuse monster\b/i, 'confuse')
            .replace(/\bremove curse\b/i, 'rem curse');

        return addQuestionMark ? `${short}?` : short;
    }

    /**
     * 店の売買価格から基礎価格（base cost）の候補リストを逆算
     * 
     * NetHack の価格計算（shk.c）:
     * - 店から購入時（buy）:
     *   標準倍率: baseCost * 4 / 3 (約 1.333倍)
     *   ChaやSucker補正: 3/2 (1.5倍), 2/1 (2倍), 4/3 (1.333倍) 等
     * - 店へ売却時（sell）:
     *   標準買値: baseCost / 3 (約 0.333倍) または baseCost / 2 (約 0.5倍)
     * 
     * @param {number} price 店頭価格
     * @param {'buy'|'sell'} [mode='buy'] 取引種別
     * @returns {Array<number>} 可能性のある基礎価格（昇順）
     */
    static estimateBaseCostsFromShopPrice(price, mode = 'buy') {
        if (!price || typeof price !== 'number' || price <= 0) return [];

        const candidates = new Set();

        if (mode === 'buy') {
            // 代表的な購入時倍率
            const ratios = [
                4 / 3, // 標準 (1.333)
                3 / 2, // カリスマ低 (1.5)
                2 / 1, // ぼったくり / カモ (2.0)
                1 / 1, // 等倍 (一部特殊)
                4 / 4  // 1.0
            ];

            for (const r of ratios) {
                const est = Math.round(price / r);
                if (est > 0) candidates.add(est);
            }
        } else {
            // 代表的な売却時倍率
            const ratios = [
                1 / 3, // 標準 (0.333)
                1 / 2, // 高値買取 (0.5)
                1 / 4  // 低値買取 (0.25)
            ];

            for (const r of ratios) {
                const est = Math.round(price / r);
                if (est > 0) candidates.add(est);
            }
        }

        // 標準価格リストと最も合致・近いものを抽出
        const result = Array.from(candidates).filter(c => {
            return STANDARD_BASE_COSTS.some(std => Math.abs(std - c) <= 2 || std === c);
        });

        // もし標準リストに合致するものがなければ逆算候補をそのまま利用
        if (result.length === 0) {
            return Array.from(candidates).sort((a, b) => a - b);
        }

        return Array.from(new Set(result)).sort((a, b) => a - b);
    }

    /**
     * アイテムオブジェクトまたは文字列（calledName, rawText, name 等）から価格情報を抽出
     * @param {Object|string} targetOrText 
     * @returns {{ baseCost?: number, shopPrice?: number, priceType?: 'buy'|'sell', rawMatch?: string } | null}
     */
    static extractPriceInfo(targetOrText) {
        if (!targetOrText) return null;

        const stringsToTest = [];
        if (typeof targetOrText === 'string') {
            stringsToTest.push(targetOrText);
        } else if (typeof targetOrText === 'object') {
            if (targetOrText.calledName) stringsToTest.push(targetOrText.calledName);
            if (targetOrText.call) stringsToTest.push(targetOrText.call);
            if (targetOrText.rawText) stringsToTest.push(targetOrText.rawText);
            if (targetOrText.name) stringsToTest.push(targetOrText.name);
            if (targetOrText.str) stringsToTest.push(targetOrText.str);
        }

        for (const str of stringsToTest) {
            if (!str || typeof str !== 'string') continue;

            // 1. 店主見積もり・未払い・販売中パターン (例: "unpaid, 133 zorkmids", "for sale, 100 a piece")
            const shopMatch = str.match(/(?:unpaid,\s*|for sale,\s*)(\d+)\s*(?:zorkmids?|zm|a piece|each|gold)?/i);
            if (shopMatch) {
                const price = parseInt(shopMatch[1], 10);
                if (!isNaN(price) && price > 0) {
                    return {
                        shopPrice: price,
                        priceType: 'buy',
                        rawMatch: shopMatch[0]
                    };
                }
            }

            // 2. 金額単位付きの表記 (例: "100 zm", "133G", "200gp", "50 gold")
            const unitMatch = str.match(/\b(\d+)\s*(?:zm|zorkmids?|g|gp|gold)\b/i);
            if (unitMatch) {
                const price = parseInt(unitMatch[1], 10);
                if (!isNaN(price) && price > 0) {
                    if (STANDARD_BASE_COSTS.includes(price)) {
                        return {
                            baseCost: price,
                            shopPrice: price,
                            priceType: 'buy',
                            rawMatch: unitMatch[0]
                        };
                    } else {
                        return {
                            shopPrice: price,
                            priceType: 'buy',
                            rawMatch: unitMatch[0]
                        };
                    }
                }
            }

            // 3. 純粋な数値仮名または末尾クエスチョン (例: "100", "133", "100?", "67?")
            const numMatch = str.trim().match(/^(\d+)\??$/);
            if (numMatch) {
                const price = parseInt(numMatch[1], 10);
                if (!isNaN(price) && price > 0) {
                    if (STANDARD_BASE_COSTS.includes(price)) {
                        return {
                            baseCost: price,
                            shopPrice: price,
                            priceType: 'buy',
                            rawMatch: numMatch[0]
                        };
                    } else {
                        return {
                            shopPrice: price,
                            priceType: 'buy',
                            rawMatch: numMatch[0]
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * カテゴリ内のアイテムを価格帯（baseCost）ごとにグルーピングして取得
     * @param {string} category 
     * @param {Object} [options={}]
     * @param {Object} [options.discoveryStateManager]
     * @param {boolean} [options.excludeDiscovered=false]
     * @returns {Map<number, Array<Object>>}
     */
    static getPriceGroups(category, options = {}) {
        const normCat = this.normalizeCategory(category);
        const { discoveryStateManager, excludeDiscovered = false } = options;

        const groups = new Map();

        for (const [onum, item] of OBJECT_KNOWLEDGE_MAP.entries()) {
            if (onum < 18 || !item) continue;
            if (item.category !== normCat) continue;
            // 外見プール枠やコスト0を除外
            if (item.appearanceMode === 'SHUFFLE_POOL' || item.appearanceMode === 'GENERIC' || item.cost === 0) {
                continue;
            }

            // 既知アイテムの除外判定
            const isDiscovered = discoveryStateManager ? discoveryStateManager.isIdentified(onum) : false;
            if (excludeDiscovered && isDiscovered) {
                continue;
            }

            const cost = typeof item.cost === 'number' ? item.cost : 0;
            if (!groups.has(cost)) {
                groups.set(cost, []);
            }
            groups.get(cost).push({
                ...item,
                isDiscovered,
                shorthand: this.generateShorthand(item.name)
            });
        }

        return groups;
    }

    /**
     * 未識別アイテムの候補真名リストを総合解決
     * 
     * @param {Object} options
     * @param {string} [options.category] - アイテムカテゴリ ('SCROLL', 'POTION', 'WAND', 'RING' 等)
     * @param {number} [options.baseCost] - 基礎価格（既知または推定値）
     * @param {number} [options.shopPrice] - 店頭価格
     * @param {'buy'|'sell'} [options.shopPriceType='buy'] - 店頭価格の種別
     * @param {number} [options.onum] - アイテムの onum（判明している場合）
     * @param {string} [options.appearance] - 外見名（例: 'ruby', 'silver'）
     * @param {Object} [options.discoveryStateManager] - DiscoveryStateManager インスタンス
     * @param {boolean} [options.excludeDiscovered=true] - 識別済みアイテムを除外するか
     * @param {string} [options.lastEffectText] - 直前に発生した効果メッセージ（ヒント用）
     * @param {string} [options.calledName] - 仮名メモ
     * @param {string} [options.rawText] - アイテム原文
     * @param {Object} [options.targetData] - 対象アイテムオブジェクト
     * @returns {Object} { candidates, priceGroups, shorthands, recommendedCandidate, matchedCosts }
     */
    static resolveCandidates(options = {}) {
        const {
            category,
            baseCost,
            shopPrice,
            shopPriceType = 'buy',
            onum,
            appearance,
            discoveryStateManager = null,
            excludeDiscovered = true,
            lastEffectText = '',
            calledName = '',
            rawText = '',
            targetData = null
        } = options;

        const rawCategory = category || (targetData ? this.resolveCategory(targetData) : '');
        const normCat = this.normalizeCategory(rawCategory);
        if (!normCat) {
            return {
                candidates: [],
                priceGroups: [],
                shorthands: [],
                recommendedCandidate: null,
                matchedCosts: []
            };
        }

        // 1. 基礎価格の特定または推定
        let effectiveBaseCost = baseCost;
        let effectiveShopPrice = shopPrice;
        let effectiveShopPriceType = shopPriceType;

        if (effectiveBaseCost === undefined && effectiveShopPrice === undefined) {
            const priceInfo = this.extractPriceInfo(targetData || calledName || rawText || options);
            if (priceInfo) {
                effectiveBaseCost = priceInfo.baseCost;
                effectiveShopPrice = priceInfo.shopPrice;
                if (priceInfo.priceType) effectiveShopPriceType = priceInfo.priceType;
            }
        }

        let targetCosts = [];
        if (typeof effectiveBaseCost === 'number' && effectiveBaseCost > 0) {
            targetCosts = [effectiveBaseCost];
        } else if (typeof effectiveShopPrice === 'number' && effectiveShopPrice > 0) {
            targetCosts = this.estimateBaseCostsFromShopPrice(effectiveShopPrice, effectiveShopPriceType);
        }

        // 2. 効果メッセージによる特定ヒントのチェック
        let effectHintItemType = null;
        if (lastEffectText) {
            for (const [msgKey, def] of Object.entries(DISCOVERY_MESSAGE_MAP)) {
                if (lastEffectText.toLowerCase().includes(def.itemType.toLowerCase())) {
                    effectHintItemType = def.itemType.toLowerCase();
                    break;
                }
            }
        }

        // 3. OBJECT_KNOWLEDGE_MAP から候補を抽出
        const allMatchingCategory = [];
        for (const [o, item] of OBJECT_KNOWLEDGE_MAP.entries()) {
            if (o < 18 || !item) continue;
            if (item.category !== normCat) continue;
            // 外見プール枠やジェネリック枠（実体アイテムでないもの）、コスト0のラベルダミーを除外
            if (item.appearanceMode === 'SHUFFLE_POOL' || item.appearanceMode === 'GENERIC' || item.cost === 0) {
                continue;
            }

            const isDiscovered = discoveryStateManager ? discoveryStateManager.isIdentified(o) : false;

            allMatchingCategory.push({
                onum: o,
                name: item.name,
                nameJa: item.nameJa || item.japaneseName || '',
                descr: item.descr || '',
                cost: typeof item.cost === 'number' ? item.cost : 0,
                category: normCat,
                isDiscovered,
                shorthand: this.generateShorthand(item.name),
                shorthandJa: item.nameJa ? `${item.nameJa.replace(/の(巻物|ポーション|杖|指輪|魔除け|魔法書)$/, '')}？` : ''
            });
        }

        // 4. 価格帯フィルタリング
        let filtered = allMatchingCategory;
        if (targetCosts.length > 0) {
            filtered = filtered.filter(item => targetCosts.includes(item.cost));
        }

        // 5. 識別済みアイテムの除外（オプション）
        let candidates = filtered;
        if (excludeDiscovered) {
            candidates = filtered.filter(item => !item.isDiscovered);
            // もし全候補が除外されてしまった場合は、フォールバックとして全候補を保持しつつ識別済みフラグでソート
            if (candidates.length === 0 && filtered.length > 0) {
                candidates = [...filtered];
            }
        }

        // 6. 効果ヒントまたは外見一致による並び替え（レコメンド最優先）
        candidates.sort((a, b) => {
            // A. 効果メッセージヒント一致
            if (effectHintItemType) {
                const aMatch = a.name.toLowerCase() === effectHintItemType;
                const bMatch = b.name.toLowerCase() === effectHintItemType;
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
            }

            // B. 未識別アイテムを優先
            if (a.isDiscovered !== b.isDiscovered) {
                return a.isDiscovered ? 1 : -1;
            }

            // C. 価格順
            if (a.cost !== b.cost) {
                return a.cost - b.cost;
            }

            return a.name.localeCompare(b.name);
        });

        // 7. 価格帯グルーピングの構築（UI表示用）
        const priceGroupMap = new Map();
        for (const item of allMatchingCategory) {
            if (!priceGroupMap.has(item.cost)) {
                priceGroupMap.set(item.cost, []);
            }
            priceGroupMap.get(item.cost).push(item);
        }

        const priceGroups = Array.from(priceGroupMap.entries())
            .map(([cost, items]) => ({
                cost,
                label: `${cost} ZM`,
                items: excludeDiscovered ? items.filter(it => !it.isDiscovered) : items,
                totalCount: items.length
            }))
            .sort((a, b) => a.cost - b.cost);

        // 8. ショートハンド候補リストの生成
        const shorthands = [];

        // A. 価格ショートハンド (例: "100G?", "200G?")
        if (targetCosts.length > 0) {
            for (const c of targetCosts) {
                shorthands.push(`${c}G?`);
            }
        }

        // B. 候補アイテム名ショートハンド (上位 10 件)
        for (const cand of candidates.slice(0, 10)) {
            if (cand.shorthand && !shorthands.includes(cand.shorthand)) {
                shorthands.push(cand.shorthand);
            }
        }

        const recommendedCandidate = candidates.length > 0 ? candidates[0] : null;

        return {
            candidates,
            priceGroups,
            shorthands,
            recommendedCandidate,
            matchedCosts: targetCosts
        };
    }

    /**
     * ベースアイテム名から余分な接頭辞（修飾語、冠詞、強化値等）を除去して正規化
     * @param {string} rawName 
     * @returns {string}
     */
    static cleanBaseItemName(rawName) {
        if (!rawName || typeof rawName !== 'string') return '';
        return rawName
            .toLowerCase()
            .replace(/^(?:a|an|the)\s+/i, '')
            .replace(/^(?:blessed|cursed|uncursed)\s+/i, '')
            .replace(/^[+-]\d+\s+/, '')
            .replace(/^(?:poisoned|corroded|rusty|rustproof|burnt|rotted|very\s+rusty|thoroughly\s+rusty)\s+/i, '')
            .trim();
    }

    /**
     * 対象アイテムの onum または baseName から、該当する固有アーティファクト命名候補を抽出
     * (ROADMAP §2.1 個別命名・アーティファクトサジェスト対応)
     *
     * @param {Object} params
     * @param {number} [params.onum] 対象アイテムの onum
     * @param {string} [params.baseName] 対象アイテム名 (例: "long sword", "+1 long sword")
     * @param {string} [params.role] プレイヤーの職業 (例: "knight", "valkyrie")
     * @param {string} [params.alignment] プレイヤーのアライメント (例: "LAWFUL", "CHAOTIC", "NEUTRAL")
     * @returns {Array<Object>} 候補アーティファクトのリスト
     */
    static resolveArtifactCandidates({ onum, baseName, role, alignment } = {}) {
        const cleanName = this.cleanBaseItemName(baseName);
        const targetOnum = (onum !== undefined && onum !== null && !isNaN(Number(onum))) ? Number(onum) : null;

        if (targetOnum === null && !cleanName) {
            return [];
        }

        const normRole = (role && typeof role === 'string') ? role.trim().toLowerCase() : null;
        const normAlign = (alignment && typeof alignment === 'string') ? alignment.trim().toUpperCase() : null;

        const matched = ARTIFACT_KNOWLEDGE_BASE.filter(art => {
            if (targetOnum !== null && art.baseOnum === targetOnum) {
                return true;
            }
            if (cleanName) {
                const artBase = (art.baseName || '').toLowerCase().trim();
                if (artBase === cleanName) {
                    return true;
                }
                // "+1 long sword" 等で完全一致しなかった場合の包含判定
                if (artBase && (cleanName.includes(artBase) || artBase.includes(cleanName))) {
                    return true;
                }
            }
            return false;
        });

        // 候補オブジェクトへの変換
        const candidates = matched.map(art => {
            const isQuest = Boolean(art.isQuestArtifact);
            const roleMatch = normRole && art.role && art.role.toLowerCase() === normRole;
            const alignMatch = normAlign && art.alignment && art.alignment.toUpperCase() === normAlign;
            const isRecommended = Boolean(!isQuest && (roleMatch || alignMatch));

            return {
                id: art.id,
                name: art.name,
                nameJa: art.nameJa,
                baseName: art.baseName,
                baseOnum: art.baseOnum,
                category: art.category,
                alignment: art.alignment,
                role: art.role,
                race: art.race,
                isQuestArtifact: isQuest,
                canNameDirectly: !isQuest, // 通常の#name命名で作成可能か
                intrinsics: art.intrinsics || [],
                attackEffect: art.attackEffect || null,
                defenseEffect: art.defenseEffect || null,
                invoke: art.invoke || null,
                descJa: art.descJa || '',
                descEn: art.descEn || '',
                shorthand: art.name,
                isRecommended
            };
        });

        // ソート順:
        // 1. 通常生成可能 (canNameDirectly: true) を優先 (クエストアーティファクトは後退)
        // 2. 推奨 (isRecommended: true) を優先
        // 3. アライメント一致を優先
        // 4. 定義順 (または名前順)
        candidates.sort((a, b) => {
            if (a.canNameDirectly !== b.canNameDirectly) {
                return a.canNameDirectly ? -1 : 1;
            }
            if (a.isRecommended !== b.isRecommended) {
                return a.isRecommended ? -1 : 1;
            }
            return 0;
        });

        return candidates;
    }

    /**
     * ベースアイテムが固有アーティファクトの元になり得るかを判定
     * @param {Object} params
     * @param {number} [params.onum]
     * @param {string} [params.baseName]
     * @returns {boolean}
     */
    static hasArtifactCandidates({ onum, baseName } = {}) {
        const list = this.resolveArtifactCandidates({ onum, baseName });
        return list.length > 0;
    }
}


