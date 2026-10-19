/**
 * ItemIdentificationResolver.js
 * 
 * NetHack アイテム識別状態解析エンジン
 * 
 * 【役割と責務】
 * 1. アイテム文字列（インベントリ表記やLookメッセージ等）から、識別の5段階レベル
 *    (UNIDENTIFIED, BUC_KNOWN, NAMED, TYPE_IDENTIFIED, FULLY_IDENTIFIED) を高精度に判定。
 * 2. ゲーム毎にランダム化される外見名（薬の色、指輪の材質、杖の素材、防具/武器の仮名、灰色の石等）を照合。
 * 3. 祝福/呪い状態 (BUC)、プレイヤー命名 (called / named)、強化値/チャージ数の有無を構造化抽出。
 * 4. 未識別アイテムに対する安全な表示名（ネタバレ防止）とカテゴリ別鑑定ヒント（床彫り、流し台、価格等）を生成。
 */

import { OBJECT_KNOWLEDGE_MAP } from '../data/OBJECT_KNOWLEDGE_FULL.js';
import { APPEARANCE_DESCR_JA, APPEARANCE_NOUN_JA, formatAppearanceNameStatic } from '../data/OBJECT_APPEARANCE_DICT.js';
export { APPEARANCE_DESCR_JA, APPEARANCE_NOUN_JA };


// 識別の5段階レベル定数
export const IDENTIFICATION_LEVELS = {
    UNIDENTIFIED: 'UNIDENTIFIED',           // Lv.0: 完全未識別 (外見名のみ)
    BUC_KNOWN: 'BUC_KNOWN',                 // Lv.1: BUC状態のみ判明
    NAMED: 'NAMED',                         // Lv.2: プレイヤー仮名/呼称付き (called ...)
    TYPE_IDENTIFIED: 'TYPE_IDENTIFIED',     // Lv.3: タイプ・真名識別済み (Discovery)
    FULLY_IDENTIFIED: 'FULLY_IDENTIFIED'   // Lv.4: 個別完全識別済み (+強化値, チャージ数等)
};

// 外見エイリアス語彙リスト (tilemappings_data.js および appearances.ja.md 準拠)
export const APPEARANCE_PATTERNS = {
    // 1. 薬 (液体の色や状態)
    POTION: [
        'ruby', 'pink', 'orange', 'yellow', 'emerald', 'dark green', 'cyan', 'sky blue',
        'brilliant blue', 'magenta', 'purple-red', 'puce', 'milky', 'swirly', 'bubbly',
        'smoky', 'cloudy', 'effervescent', 'black', 'golden', 'brown', 'fizzy', 'dark',
        'white', 'murky', 'clear'
    ],
    // 2. 指輪 (素材・形状)
    RING: [
        'wooden', 'granite', 'opal', 'clay', 'coral', 'black onyx', 'moonstone',
        'tiger eye', 'jade', 'bronze', 'agate', 'topaz', 'sapphire', 'diamond',
        'pearl', 'iron', 'brass', 'copper', 'twisted', 'steel', 'silver', 'gold',
        'ivory', 'wire', 'engagement', 'shiny'
    ],
    // 3. 魔法書 (表紙・装丁)
    SPELLBOOK: [
        'parchment', 'vellum', 'ragged', 'dog eared', 'mottled', 'stained', 'cloth',
        'leathery', 'velvet', 'light green', 'dark green', 'turquoise', 'light blue',
        'dark blue', 'indigo', 'violet', 'tan', 'plaid', 'light brown', 'dark brown',
        'gray', 'wrinkled', 'dusty', 'glittering', 'shining', 'dull', 'thin', 'thick',
        'checkered', 'paperback', 'papyrus'
    ],
    // 4. 杖 (素材・形状)
    WAND: [
        'glass', 'balsa', 'crystal', 'maple', 'pine', 'oak', 'ebony', 'marble',
        'tin', 'brass', 'copper', 'silver', 'platinum', 'iridium', 'zinc',
        'aluminum', 'uranium', 'iron', 'steel', 'hexagonal', 'short', 'runed',
        'long', 'curved', 'forked', 'spiked', 'jeweled'
    ],
    // 5. アミュレット (幾何学形状)
    AMULET: [
        'circular', 'spherical', 'oval', 'triangular', 'pyramidal', 'square',
        'concave', 'hexagonal', 'octagonal', 'perforated', 'cubical'
    ],
    // 6. 防具 (一般的な外見別名)
    ARMOR: [
        'leather hat', 'iron skull cap', 'hard hat', 'conical hat', 'plumed helmet',
        'etched helmet', 'crested helmet', 'visored helmet', 'crystal helmet', 'dented pot',
        'faded pall', 'coarse mantelet', 'hooded cloak', 'slippery cloak', 'apron',
        'tattered cape', 'opera cloak', 'ornamental cope', 'piece of cloth',
        'crude chain mail', 'crude ring mail',
        'wooden shield', 'blue and green shield', 'white-handed shield',
        'red-eyed shield', 'large round shield', 'polished silver shield',
        'old gloves', 'padded gloves', 'riding gloves', 'fencing gloves',
        'walking shoes', 'hard shoes', 'jackboots', 'combat boots', 'jungle boots',
        'hiking boots', 'mud boots', 'buckled boots', 'snow boots'
    ],
    // 7. 道具 (未識別時の一般名)
    TOOL: [
        'bag', 'key', 'candle', 'lamp', 'looking glass', 'glass orb',
        'whistle', 'flute', 'horn', 'harp', 'drum'
    ],
    // 8. 武器 (部族・形状別名)
    WEAPON: [
        'crude arrow', 'runed arrow', 'bamboo arrow',
        'crude dagger', 'runed dagger',
        'crude short sword', 'broad short sword', 'runed short sword',
        'crude broadsword', 'runed broadsword',
        'curved sword', 'samurai sword', 'long samurai sword',
        'double-headed axe',
        'crude spear', 'runed spear', 'stout spear', 'throwing spear',
        'crude bow', 'runed bow', 'long bow',
        'broad pick', 'thonged club', 'staff',
        'throwing star',
        'vulgar polearm', 'hilted polearm', 'forked polearm',
        'single-edged polearm', 'angled poleaxe', 'long poleaxe', 'pole cleaver',
        'pole sickle', 'pruning hook', 'hooked polearm', 'pronged polearm',
        'beaked polearm'
    ],
    // 9. 宝石・石
    GEM_STONE: [
        'gray stone', 'white gem', 'red gem', 'orange gem', 'blue gem',
        'black gem', 'green gem', 'yellow gem', 'yellowish brown gem', 'violet gem',
        'worthless piece of white glass', 'worthless piece of blue glass',
        'worthless piece of red glass', 'worthless piece of green glass'
    ]
};

// カテゴリ別鑑定ヒント (非推奨・廃止: ItemSpecPresenter および ITEM_INTERACTION_RULES へ移行完了)
export const IDENTIFICATION_TIPS = {};
export const IDENTIFICATION_TIPS_EN = {};

export class ItemIdentificationResolver {
    /**
     * 外見形容詞（色・素材・ラベル）とカテゴリから完全なアイテム名を合成
     * 例: ("ruby", "POTION", "ja") -> "ルビー色の薬"
     * 例: ("ruby", "POTION", "en") -> "ruby potion"
     * 例: ("iron", "WAND", "ja") -> "鉄の杖"
     * 例: ("ZELGO MER", "SCROLL", "ja") -> "「ZELGO MER」と書かれた巻物"
     * @param {string} descr - 外見（色・素材・ラベルなど）
     * @param {string} category - アイテムカテゴリ (POTION, WAND, RING, SCROLL, etc.)
     * @param {string} [lang='ja'] - 言語 ('ja' | 'en')
     * @returns {string} 完全なアイテム外見名
     */
    static formatAppearanceName(descr, category, lang = 'ja') {
        return formatAppearanceNameStatic(descr, category, lang);
    }


    /**
     * アイテム文字列またはオブジェクトから識別状態を包括的に解析・解決
     * @param {string|Object} itemInput - インベントリテキスト、またはアイテムオブジェクト
     * @param {Object} [options={}] - オプション
     * @returns {Object} 構造化識別状態 (ItemIdentificationState)
     */
    static resolve(itemInput, options = {}) {
        let rawText = '';
        let onum = -1;
        let glyphId = -1;

        if (typeof itemInput === 'string') {
            rawText = itemInput;
        } else if (itemInput && typeof itemInput === 'object') {
            rawText = itemInput.rawText || itemInput.str || itemInput.text || itemInput.name || itemInput.label || '';
            onum = typeof itemInput.onum === 'number' ? itemInput.onum : -1;
            glyphId = typeof itemInput.glyphId === 'number' ? itemInput.glyphId : (typeof itemInput.glyph === 'number' ? itemInput.glyph : -1);
        }

        let directObj = (itemInput && typeof itemInput === 'object') ? (itemInput.directObject || (itemInput.flags ? itemInput : null)) : null;
        const flags = directObj?.flags || (itemInput && typeof itemInput === 'object' ? itemInput.flags : null);

        const cleanText = (rawText || '').trim();
        let bucStatus = 'UNKNOWN';
        let textWithoutBuc = cleanText;

        if (flags && typeof flags.bknown === 'boolean') {
            if (flags.bknown || options.sagesWisdomMode) {
                bucStatus = flags.blessed ? 'BLESSED' : (flags.cursed ? 'CURSED' : 'UNCURSED');
            } else {
                bucStatus = 'UNKNOWN';
            }
            textWithoutBuc = cleanText.replace(/\b(blessed|uncursed|cursed)\s+/i, '').trim();
        } else {
            const extracted = this.extractBuc(cleanText);
            bucStatus = extracted.bucStatus;
            textWithoutBuc = extracted.textWithoutBuc;
        }

        const { calledName, textWithoutCalled } = this.extractCalledName(textWithoutBuc);
        const { namedInstance, textWithoutNamed } = this.extractNamedInstance(textWithoutCalled);

        let enchantment = 0;
        let charges = null;
        let textWithoutStats = textWithoutNamed;

        if (directObj && typeof directObj.spe === 'number' && (flags?.known || options.sagesWisdomMode)) {
            // C コアの真値 spe を採用
            const oclass = directObj.oclass;
            if (oclass === 9) { // WAND_CLASS = 9
                charges = directObj.spe;
            } else {
                enchantment = directObj.spe;
            }
            textWithoutStats = textWithoutNamed.replace(/[+-]\d+\s+/, '').replace(/\(\d+\s+charges?\)/i, '').trim();
        } else {
            const extractedStats = this.extractEnchantmentAndCharges(textWithoutNamed);
            enchantment = extractedStats.enchantment;
            charges = extractedStats.charges;
            textWithoutStats = extractedStats.textWithoutStats;
        }

        const coreName = this.extractCoreItemName(textWithoutStats);

        const master = (onum >= 0 && OBJECT_KNOWLEDGE_MAP) ? OBJECT_KNOWLEDGE_MAP.get(onum) : null;
        const canBeUnidentified = master ? (master.canBeUnidentified !== false) : true;
        const isRandomCategory = master ? ['POTION', 'SCROLL', 'WAND', 'RING', 'AMULET', 'SPELLBOOK'].includes(master.category) : false;

        // 未識別外見かどうかの判定 (master があり canBeUnidentified === false の場合は外見マッチをスキップ)
        const appearanceMatch = (master && !canBeUnidentified)
            ? { isAppearance: false, category: master.category, appearanceName: null }
            : this.detectAppearance(coreName, textWithoutStats);
        let isUnidentified = (master && !canBeUnidentified) ? false : Boolean(appearanceMatch.isAppearance);
        let category = (master && master.category) ? master.category : (appearanceMatch.category || this.inferCategory(coreName));
        let appearanceName = (master && !canBeUnidentified) ? null : (appearanceMatch.appearanceName || null);

        // 真名がテキストに含まれているかの包括的検査
        let isTrueNamePresent = false;
        if (master) {
            const trueNameLower = (master.name || '').toLowerCase();
            const nameJa = (master.nameJa || '').toLowerCase();
            const baseName = (master.baseName || '').toLowerCase();
            const cleanLower = cleanText.toLowerCase();

            // 1. 英語完全一致または複数形一致 (例: "potion of extra healing" or "potions of extra healing")
            if (trueNameLower) {
                if (cleanLower.includes(trueNameLower)) {
                    isTrueNamePresent = true;
                } else {
                    const pluralPattern = trueNameLower.replace(/\b(potion|scroll|wand|ring|amulet|spellbook|book|arrow|dagger|spear|sword|axe|bow|helm|shield|boots|gloves)\b/i, '$1s?');
                    const reg = new RegExp(`\\b${pluralPattern}\\b`, 'i');
                    if (reg.test(cleanLower)) {
                        isTrueNamePresent = true;
                    }
                }
            }

            // 2. baseName + "of" の一致 (例: "extra healing" + "potions of")
            if (!isTrueNamePresent && baseName) {
                if (cleanLower.includes(baseName) && /\b(potions?|scrolls?|wands?|rings?|amulets?|spellbooks?|books?)\s+of\b/i.test(cleanLower)) {
                    isTrueNamePresent = true;
                }
            }

            // 3. 日本語公式真名の一致 (例: "回復のポーション", "刀", "エルフの矢")
            if (!isTrueNamePresent && nameJa && cleanLower.includes(nameJa)) {
                isTrueNamePresent = true;
            }
        }

        // options.discoveryStateManager または onum と OBJECT_KNOWLEDGE_MAP による二重防御
        if (options.discoveryStateManager && typeof options.discoveryStateManager.isIdentified === 'function') {
            if (onum >= 0) {
                if (options.discoveryStateManager.isIdentified(onum)) {
                    isUnidentified = false;
                } else if (isTrueNamePresent && !appearanceMatch.isAppearance && !isRandomCategory) {
                    // ⚔️ 武器・防具等の固定アイテムで、NetHack が公式に真名（katana, elven arrow 等）を出力している場合：
                    // ディスカバリー画面の未閲覧に関わらず確実に識別済みと判定し、自動登録！
                    isUnidentified = false;
                    if (options.discoveryStateManager.discoveredOnums && typeof options.discoveryStateManager.discoveredOnums.add === 'function') {
                        options.discoveryStateManager.discoveredOnums.add(onum);
                    }
                } else if (canBeUnidentified) {
                    // ランダム外見カテゴリ等で、ディスカバリー上で未判明の場合は未識別と判定（ネタバレ保護）
                    isUnidentified = true;
                    if (!appearanceName && typeof options.discoveryStateManager.getAppearance === 'function') {
                        const dynApp = options.discoveryStateManager.getAppearance(onum);
                        if (dynApp) {
                            appearanceName = this.formatAppearanceName(dynApp, category || master?.category, 'en');
                        }
                    }
                }
            } else if (appearanceName && options.discoveryStateManager.isIdentified(appearanceName)) {
                isUnidentified = false;
            }
        } else if (!isUnidentified && onum >= 0 && master && master.canBeUnidentified) {
            if (!isTrueNamePresent) {
                isUnidentified = true;
                if (!category && master.category) {
                    category = master.category;
                }
            }
        }

        // 🧙 賢者の知恵モード (Sage's Wisdom Mode)
        const isWisdomRevealed = Boolean(options.sagesWisdomMode && isUnidentified);
        const trueName = master?.name || null;
        const trueNameJa = master?.nameJa || master?.japaneseName || null;
        const lang = options.language || 'ja';

        // 識別レベル (Lv.0〜Lv.4) の判定
        const idLevel = this.determineIdentificationLevel({
            isUnidentified,
            bucStatus,
            calledName,
            namedInstance,
            enchantment,
            charges
        });

        // 安全な表示名（ネタバレ防止）とマスク処理
        const displayName = this.buildSafeDisplayName({
            coreName,
            category,
            bucStatus,
            calledName,
            namedInstance,
            enchantment,
            charges,
            isUnidentified,
            appearanceName: appearanceName,
            isWisdomRevealed,
            wisdomTrueName: trueName,
            wisdomTrueNameJa: trueNameJa,
            language: lang
        });

        return {
            idLevel,
            isUnidentified,
            isWisdomRevealed,
            wisdomTrueName: isWisdomRevealed ? trueName : null,
            wisdomTrueNameJa: isWisdomRevealed ? trueNameJa : null,
            category,
            appearanceName: appearanceName || null,
            calledName: calledName || null,
            namedInstance: namedInstance || null,
            bucStatus,
            enchantment,
            charges,
            coreName,
            displayName,
            rawText: cleanText,
            identificationTips: [],
            identificationTipsEn: [],
            identificationTipsJa: [],
            hasKnownEnchantment: enchantment !== null,
            hasKnownCharges: charges !== null,
            isMasked: isUnidentified && !isWisdomRevealed
        };
    }

    /**
     * BUC状態（祝福/通常/呪い）の抽出
     * @param {string} text 
     * @returns {{ bucStatus: string, textWithoutBuc: string }}
     */
    static extractBuc(text) {
        if (!text) return { bucStatus: 'UNKNOWN', textWithoutBuc: '' };

        if (/\bblessed\b/i.test(text)) {
            return { bucStatus: 'BLESSED', textWithoutBuc: text.replace(/\bblessed\s+/i, '').trim() };
        }
        if (/\buncursed\b/i.test(text)) {
            return { bucStatus: 'UNCURSED', textWithoutBuc: text.replace(/\buncursed\s+/i, '').trim() };
        }
        if (/\bcursed\b/i.test(text)) {
            return { bucStatus: 'CURSED', textWithoutBuc: text.replace(/\bcursed\s+/i, '').trim() };
        }

        return { bucStatus: 'UNKNOWN', textWithoutBuc: text };
    }

    /**
     * プレイヤーの仮名 (called ...) の抽出
     * @param {string} text 
     * @returns {{ calledName: string|null, textWithoutCalled: string }}
     */
    static extractCalledName(text) {
        if (!text) return { calledName: null, textWithoutCalled: '' };

        const match = text.match(/\bcalled\s+([^\(\)\,\.\-]+)/i);
        if (match) {
            const calledName = match[1].trim();
            const textWithoutCalled = text.replace(/\bcalled\s+[^\(\)\,\.\-]+/i, '').trim();
            return { calledName, textWithoutCalled };
        }

        return { calledName: null, textWithoutCalled: text };
    }

    /**
     * 個別名 (named ...) の抽出
     * @param {string} text 
     * @returns {{ namedInstance: string|null, textWithoutNamed: string }}
     */
    static extractNamedInstance(text) {
        if (!text) return { namedInstance: null, textWithoutNamed: '' };

        const match = text.match(/\bnamed\s+([^\(\)\,\.\-]+)/i);
        if (match) {
            const namedInstance = match[1].trim();
            const textWithoutNamed = text.replace(/\bnamed\s+[^\(\)\,\.\-]+/i, '').trim();
            return { namedInstance, textWithoutNamed };
        }

        return { namedInstance: null, textWithoutNamed: text };
    }

    /**
     * 強化値 (+1, -2 等) および 杖チャージ数 (0:4 等) の抽出
     * @param {string} text 
     * @returns {{ enchantment: number|null, charges: string|null, textWithoutStats: string }}
     */
    static extractEnchantmentAndCharges(text) {
        if (!text) return { enchantment: null, charges: null, textWithoutStats: '' };

        let s = text;
        let enchantment = null;
        let charges = null;

        // 強化値 (+1, +0, -3 等)
        const enchMatch = s.match(/([+\-]\d+)\s+/);
        if (enchMatch) {
            enchantment = parseInt(enchMatch[1], 10);
            s = s.replace(/([+\-]\d+)\s+/, '');
        }

        // 杖チャージ数 (0:4 等)
        const chargeMatch = s.match(/\((\d+:\d+|\d+\s+charges?)\)/i);
        if (chargeMatch) {
            charges = chargeMatch[1];
            s = s.replace(/\((\d+:\d+|\d+\s+charges?)\)/i, '');
        }

        return { enchantment, charges, textWithoutStats: s.trim() };
    }

    /**
     * 冠詞・記号・数量を取り除いた純粋なコア名称を抽出
     * @param {string} text 
     * @returns {string}
     */
    static extractCoreItemName(text) {
        if (!text) return '';
        let s = text.trim();

        // 1. スロット接頭辞除去 ("[n] ", "(a) ", "a - ", "b) ")
        s = s.replace(/^\[[a-zA-Z]\]\s*/, '');
        s = s.replace(/^\([a-zA-Z]\)\s*/, '');
        s = s.replace(/^[a-zA-Z]\s*[\-\)\.]\s*/, '');
        // 2. 数量除去 ("2 ", "10 ")
        s = s.replace(/^\d+\s+/, '');
        // 3. 冠詞除去 ("a ", "an ", "the ")
        s = s.replace(/\b(a|an|the)\s+/i, '');
        // 4. 装備中修飾子除去 ("(weapon in hand)", "(being worn)", "(on left hand)", "(in quiver)" 等)
        s = s.replace(/\([^\)]+\)/g, '');
        // 5. 特殊ステータス修飾子除去 ("poisoned ", "welded to hand")
        s = s.replace(/\bpoisoned\s+/i, '');
        s = s.replace(/\bwelded to hand\b/i, '');
        // 6. 複数形プレフィックス正規化 ("potions of" -> "potion of" 等)
        s = s.replace(/\bpotions\s+of\b/i, 'potion of');
        s = s.replace(/\bscrolls\s+of\b/i, 'scroll of');
        s = s.replace(/\brings\s+of\b/i, 'ring of');
        s = s.replace(/\bwands\s+of\b/i, 'wand of');
        s = s.replace(/\bamulets\s+of\b/i, 'amulet of');
        s = s.replace(/\bspellbooks\s+of\b/i, 'spellbook of');
        s = s.replace(/\bbooks\s+of\b/i, 'book of');

        return s.trim();
    }

    /**
     * 外見名パターンとの照合判定
     * @param {string} coreName 
     * @param {string} fullText 
     * @returns {{ isAppearance: boolean, category: string|null, appearanceName: string|null }}
     */
    static detectAppearance(coreName, fullText = '') {
        const lowerCore = (coreName || '').toLowerCase();
        const lowerFull = (fullText || '').toLowerCase();

        // 🎯 真名ガード: "ring of ...", "potion of ...", "scroll of ...", "wand of ...", "amulet of ...", "spellbook of ...", "book of ..."
        // または固定真名アイテム ("meat ring", "blank paper", "book of the dead", "amulet of yendor", "cheap plastic imitation" 等)
        const hasOfPattern = /\b(rings?|potions?|scrolls?|wands?|amulets?|spellbooks?|books?)\s+of\b/i.test(lowerFull) || /\b(rings?|potions?|scrolls?|wands?|amulets?|spellbooks?|books?)\s+of\b/i.test(lowerCore);
        const isFixedName = /\b(meat ring|blank paper|book of the dead|amulet of yendor|cheap plastic imitation)\b/i.test(lowerFull);

        if (hasOfPattern || isFixedName) {
            return { isAppearance: false, category: this.inferCategory(lowerFull), appearanceName: null };
        }

        // 1. 薬 (Potion)
        if (/\bpotions?\b/i.test(lowerCore) || /\bpotions?\b/i.test(lowerFull)) {
            for (const app of APPEARANCE_PATTERNS.POTION) {
                const reg = new RegExp(`\\b${app}\\b`, 'i');
                if (reg.test(lowerCore) || reg.test(lowerFull)) {
                    return { isAppearance: true, category: 'POTION', appearanceName: `${app} potion` };
                }
            }
            return { isAppearance: true, category: 'POTION', appearanceName: lowerCore || 'potion' };
        }

        // 2. 巻物 (Scroll)
        if (/\bscrolls?\b/i.test(lowerCore) || /\bscrolls?\b/i.test(lowerFull) || /\blabel+ed\b/i.test(lowerFull)) {
            if (/\blabel+ed\b/i.test(lowerFull)) {
                const labelMatch = (fullText || '').match(/label+ed\s+([a-zA-Z\s]+)/i);
                return { isAppearance: true, category: 'SCROLL', appearanceName: labelMatch ? `scroll labeled ${labelMatch[1].trim()}` : 'labeled scroll' };
            }
            return { isAppearance: true, category: 'SCROLL', appearanceName: lowerCore || 'scroll' };
        }

        // 3. 杖 (Wand)
        if (/\bwands?\b/i.test(lowerCore) || /\bwands?\b/i.test(lowerFull)) {
            for (const app of APPEARANCE_PATTERNS.WAND) {
                const reg = new RegExp(`\\b${app}\\b`, 'i');
                if (reg.test(lowerCore) || reg.test(lowerFull)) {
                    return { isAppearance: true, category: 'WAND', appearanceName: `${app} wand` };
                }
            }
            return { isAppearance: true, category: 'WAND', appearanceName: lowerCore || 'wand' };
        }

        // 4. 指輪 (Ring)
        if ((/\brings?\b/i.test(lowerCore) || /\brings?\b/i.test(lowerFull)) && !lowerFull.includes('ring mail') && !lowerFull.includes('ringmail')) {
            for (const app of APPEARANCE_PATTERNS.RING) {
                const reg = new RegExp(`\\b${app}\\b`, 'i');
                if (reg.test(lowerCore) || reg.test(lowerFull)) {
                    return { isAppearance: true, category: 'RING', appearanceName: `${app} ring` };
                }
            }
            return { isAppearance: true, category: 'RING', appearanceName: lowerCore || 'ring' };
        }

        // 5. アミュレット (Amulet)
        if (/\bamulets?\b/i.test(lowerCore) || /\bamulets?\b/i.test(lowerFull)) {
            for (const app of APPEARANCE_PATTERNS.AMULET) {
                const reg = new RegExp(`\\b${app}\\b`, 'i');
                if (reg.test(lowerCore) || reg.test(lowerFull)) {
                    return { isAppearance: true, category: 'AMULET', appearanceName: `${app} amulet` };
                }
            }
            return { isAppearance: true, category: 'AMULET', appearanceName: lowerCore || 'amulet' };
        }

        // 6. 魔法書 (Spellbook)
        if (/\b(spellbooks?|books?)\b/i.test(lowerCore) || /\b(spellbooks?|books?)\b/i.test(lowerFull)) {
            for (const app of APPEARANCE_PATTERNS.SPELLBOOK) {
                const reg = new RegExp(`\\b${app}\\b`, 'i');
                if (reg.test(lowerCore) || reg.test(lowerFull)) {
                    return { isAppearance: true, category: 'SPELLBOOK', appearanceName: `${app} spellbook` };
                }
            }
            return { isAppearance: true, category: 'SPELLBOOK', appearanceName: lowerCore || 'spellbook' };
        }

        // 7. 防具 (Armor 外見)
        for (const app of APPEARANCE_PATTERNS.ARMOR) {
            const reg = new RegExp(`\\b${app}s?\\b`, 'i');
            if (reg.test(lowerCore) || reg.test(lowerFull)) {
                return { isAppearance: true, category: 'ARMOR', appearanceName: app };
            }
        }

        // 8. 武器 (Weapon 外見)
        for (const app of APPEARANCE_PATTERNS.WEAPON) {
            const reg = new RegExp(`\\b${app}s?\\b`, 'i');
            if (reg.test(lowerCore) || reg.test(lowerFull)) {
                return { isAppearance: true, category: 'WEAPON', appearanceName: app };
            }
        }

        // 9. 宝石・石 (Gems/Stones 外見)
        for (const app of APPEARANCE_PATTERNS.GEM_STONE) {
            const escaped = app.replace(/\s+/g, '\\s+');
            const reg = new RegExp(`\\b${escaped}s?\\b`, 'i');
            if (reg.test(lowerCore) || reg.test(lowerFull)) {
                return { isAppearance: true, category: 'GEM_STONE', appearanceName: app };
            }
        }

        // 10. 単独形容詞（素材・色・ラベル単体）のマッチング
        // 例: "ruby" のみ -> POTION ("ruby potion")
        // 例: "iron" のみ -> WAND ("iron wand")
        // 例: "wooden" のみ -> RING ("wooden ring")
        for (const app of APPEARANCE_PATTERNS.POTION) {
            if (lowerCore === app || lowerFull === app) {
                return { isAppearance: true, category: 'POTION', appearanceName: `${app} potion` };
            }
        }
        for (const app of APPEARANCE_PATTERNS.WAND) {
            if (lowerCore === app || lowerFull === app) {
                return { isAppearance: true, category: 'WAND', appearanceName: `${app} wand` };
            }
        }
        for (const app of APPEARANCE_PATTERNS.RING) {
            if (lowerCore === app || lowerFull === app) {
                return { isAppearance: true, category: 'RING', appearanceName: `${app} ring` };
            }
        }
        for (const app of APPEARANCE_PATTERNS.AMULET) {
            if (lowerCore === app || lowerFull === app) {
                return { isAppearance: true, category: 'AMULET', appearanceName: `${app} amulet` };
            }
        }
        for (const app of APPEARANCE_PATTERNS.SPELLBOOK) {
            if (lowerCore === app || lowerFull === app) {
                return { isAppearance: true, category: 'SPELLBOOK', appearanceName: `${app} spellbook` };
            }
        }

        return { isAppearance: false, category: null, appearanceName: null };
    }

    /**
     * カテゴリの推論
     * @param {string} name 
     * @returns {string}
     */
    static inferCategory(name) {
        const lower = (name || '').toLowerCase();
        if (lower.includes('potion')) return 'POTION';
        if (lower.includes('scroll') || lower.includes('blank paper')) return 'SCROLL';
        if (lower.includes('wand')) return 'WAND';
        if (lower.includes('mail') || lower.includes('armor') || lower.includes('helmet') || lower.includes('shield') || lower.includes('cloak') || lower.includes('boots') || lower.includes('gloves')) return 'ARMOR';
        if (/\brings?\b/i.test(lower) && !lower.includes('ring mail') && !lower.includes('ringmail')) return 'RING';
        if (lower.includes('amulet')) return 'AMULET';
        if (lower.includes('spellbook') || lower.includes('book')) return 'SPELLBOOK';
        if (lower.includes('sword') || lower.includes('dagger') || lower.includes('axe') || lower.includes('spear') || lower.includes('bow') || lower.includes('arrow')) return 'WEAPON';
        if (lower.includes('food') || lower.includes('ration') || lower.includes('apple') || lower.includes('corpse')) return 'FOOD';
        if (lower.includes('gem') || lower.includes('stone') || lower.includes('glass')) return 'GEM_STONE';
        return 'TOOL';
    }

    /**
     * 識別レベル (Lv.0〜Lv.4) の決定
     */
    static determineIdentificationLevel({ isUnidentified, bucStatus, calledName, namedInstance, enchantment, charges }) {
        if (isUnidentified) {
            if (calledName) return IDENTIFICATION_LEVELS.NAMED;
            if (bucStatus !== 'UNKNOWN') return IDENTIFICATION_LEVELS.BUC_KNOWN;
            return IDENTIFICATION_LEVELS.UNIDENTIFIED;
        }

        // 識別済み (Type Identified または Fully Identified)
        if (enchantment !== null || charges !== null) {
            return IDENTIFICATION_LEVELS.FULLY_IDENTIFIED;
        }

        if (calledName || namedInstance) {
            return IDENTIFICATION_LEVELS.NAMED;
        }

        return IDENTIFICATION_LEVELS.TYPE_IDENTIFIED;
    }

    /**
     * 安全な表示名（ネタバレ防止・フォーマット統一）の構築
     */
    static buildSafeDisplayName({ coreName, category, bucStatus, calledName, namedInstance, enchantment, charges, isUnidentified, appearanceName, isWisdomRevealed, wisdomTrueName, wisdomTrueNameJa, language }) {
        const parts = [];

        // 1. BUC
        if (bucStatus === 'BLESSED') parts.push(language === 'ja' ? '祝福された' : 'blessed');
        else if (bucStatus === 'CURSED') parts.push(language === 'ja' ? '呪われた' : 'cursed');
        else if (bucStatus === 'UNCURSED' && !isUnidentified) parts.push(language === 'ja' ? '普通の' : 'uncursed');

        // 2. 強化値
        if (enchantment !== null) {
            parts.push(enchantment >= 0 ? `+${enchantment}` : `${enchantment}`);
        }

        // 3. コア名または外見名
        let basePart = appearanceName || coreName;
        if (isUnidentified && language === 'ja' && (appearanceName || coreName)) {
            basePart = this.formatAppearanceName(appearanceName || coreName, category, 'ja');
        } else if (isUnidentified && language === 'en' && (appearanceName || coreName)) {
            basePart = this.formatAppearanceName(appearanceName || coreName, category, 'en');
        }

        if (isWisdomRevealed && wisdomTrueName) {
            const revealed = (language === 'ja' && wisdomTrueNameJa) ? wisdomTrueNameJa : wisdomTrueName;
            basePart = `${basePart} [${revealed}]`;
        }
        parts.push(basePart);

        // 4. チャージ数
        if (charges !== null) {
            parts.push(`(${charges})`);
        }

        // 5. プレイヤー命名
        if (calledName) {
            parts.push(`called ${calledName}`);
        }
        if (namedInstance) {
            parts.push(`named ${namedInstance}`);
        }

        return parts.join(' ').trim();
    }
}
