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

// 識別の5段階レベル定数
export const IDENTIFICATION_LEVELS = {
    UNIDENTIFIED: 'UNIDENTIFIED',           // Lv.0: 完全未識別 (外見名のみ)
    BUC_KNOWN: 'BUC_KNOWN',                 // Lv.1: BUC状態のみ判明
    NAMED: 'NAMED',                         // Lv.2: プレイヤー仮名/呼称付き (called ...)
    TYPE_IDENTIFIED: 'TYPE_IDENTIFIED',     // Lv.3: タイプ・真名識別済み (Discovery)
    FULLY_IDENTIFIED: 'FULLY_IDENTIFIED'   // Lv.4: 個別完全識別済み (+強化値, チャージ数等)
};

// 外見エイリアス語彙リスト (appearances.ja.md 準拠)
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
        'etched helmet', 'crested helmet', 'visored helmet', 'faded pall', 'coarse mantelet',
        'hooded cloak', 'slippery cloak', 'apron', 'tattered cape', 'opera cloak',
        'ornamental cope', 'piece of cloth', 'blue and green shield', 'white-handed shield',
        'red-eyed shield', 'large round shield', 'polished silver shield', 'old gloves',
        'padded gloves', 'riding gloves', 'fencing gloves', 'walking shoes', 'hard shoes',
        'jackboots', 'combat boots', 'jungle boots', 'hiking boots', 'mud boots',
        'buckled boots', 'snow boots'
    ],
    // 7. 道具 (未識別時の一般名)
    TOOL: [
        'bag', 'key', 'candle', 'lamp', 'looking glass', 'glass orb',
        'whistle', 'flute', 'horn', 'harp', 'drum'
    ],
    // 8. 武器 (部族・形状別名)
    WEAPON: [
        'crude dagger', 'runed dagger', 'crude short sword', 'broad short sword',
        'runed short sword', 'crude broadsword', 'runed broadsword', 'double-headed axe',
        'curved sword', 'samurai sword', 'long samurai sword', 'crude spear', 'runed spear',
        'crude bow', 'runed bow', 'crude arrow', 'runed arrow', 'broad pick',
        'thonged club', 'vulgar polearm', 'hilted polearm', 'forked polearm',
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

// カテゴリ別鑑定ヒント (Identification Tips - 日本語)
export const IDENTIFICATION_TIPS = {
    POTION: [
        '流し台(#apply sink)や神壇でテストして安全に鑑定可能',
        'ユニコーンの角を浸す(#dip)と毒薬を中和しつつ安全判別可能',
        '識別の巻物を読むと確実に効果が判明'
    ],
    SCROLL: [
        '床にElberethなどの文字を刻んでから安全な部屋で試読(\'r\')',
        '道具屋の店主の提示価格から価格識別(Price ID)が可能'
    ],
    WAND: [
        '床に文字を刻むテスト(\'E\')を行うと充填数を消費せず効果を特定可能',
        '識別の巻物で残チャージ数と真名を完全解明可能'
    ],
    RING: [
        '流し台(#apply sink)に指輪を落とすといった固有の演出で真名が確定',
        '呪われた指輪は外せなくなるため神壇(Altar)で呪いチェック推奨'
    ],
    AMULET: [
        '絞殺のアミュレット等の危険があるため識別の巻物での鑑定を強く推奨',
        '神壇(Altar)で祝福/呪い状態を確認'
    ],
    ARMOR: [
        '装備着脱(\'W\'/\'T\')で AC の変化を確認すると強化値を推定可能',
        '神壇(Altar)の上に置くと祝福/通常/呪いが色で判別可能'
    ],
    WEAPON: [
        '神壇(Altar)に置いて呪いを確認してから装備推奨',
        '敵への攻撃命中率やダメージから強化値を推定可能'
    ],
    GEM_STONE: [
        '灰色の石はタッチストーン(Touchstone)でこすると幸運/試金石/負荷が判明',
        '本物の宝石と硝子玉はタッチストーンまたは硬度で判別可能'
    ],
    OTHER: [
        '識別の巻物または店主の価格判定で解明可能'
    ]
};

// カテゴリ別鑑定ヒント (Identification Tips - 英語)
export const IDENTIFICATION_TIPS_EN = {
    POTION: [
        'Safely identify by testing on sinks (#apply sink) or altars.',
        'Dip a unicorn horn (#dip) to neutralize poisons and test potion types safely.',
        'Reading a Scroll of Identify definitely reveals its true identity.'
    ],
    SCROLL: [
        'Engrave Elbereth on the floor and read-test (\'r\') in a secure room.',
        'Use shopkeeper buy/sell prices for Price Identification (Price ID).'
    ],
    WAND: [
        'Engrave-test on the floor (\'E\') to determine the wand type without spending charges.',
        'Scroll of Identify reveals full identity and remaining charges.'
    ],
    RING: [
        'Drop into a sink (#apply sink) to observe unique identification messages.',
        'Cursed rings weld to your fingers; altar-test BUC status before wearing.'
    ],
    AMULET: [
        'Beware of fatal hazards like Amulets of Strangulation; identify with scrolls before wearing.',
        'Check blessed/cursed status on an altar.'
    ],
    ARMOR: [
        'Wear/remove (\'W\'/\'T\') to monitor AC changes and calculate enchantment bonuses.',
        'Drop onto an altar to detect blessed/uncursed/cursed status.'
    ],
    WEAPON: [
        'Check for curses on an altar before wielding.',
        'Estimate enchantment from combat hit rate and damage.'
    ],
    GEM_STONE: [
        'Rub gray stones with a Touchstone to identify Luckstones, Touchstones, or Loadstones.',
        'Distinguish valuable gemstones from worthless glass pieces using a Touchstone.'
    ],
    OTHER: [
        'Identify via Scrolls of Identify or shop price testing.'
    ]
};

export class ItemIdentificationResolver {
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

        const cleanText = (rawText || '').trim();
        const { bucStatus, textWithoutBuc } = this.extractBuc(cleanText);
        const { calledName, textWithoutCalled } = this.extractCalledName(textWithoutBuc);
        const { namedInstance, textWithoutNamed } = this.extractNamedInstance(textWithoutCalled);
        const { enchantment, charges, textWithoutStats } = this.extractEnchantmentAndCharges(textWithoutNamed);
        const coreName = this.extractCoreItemName(textWithoutStats);

        // 未識別外見かどうかの判定
        const appearanceMatch = this.detectAppearance(coreName, textWithoutStats);
        const isUnidentified = Boolean(appearanceMatch.isAppearance);
        const category = appearanceMatch.category || this.inferCategory(coreName);

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
            bucStatus,
            calledName,
            namedInstance,
            enchantment,
            charges,
            isUnidentified,
            appearanceName: appearanceMatch.appearanceName
        });

        const lang = options.language || 'ja';
        const isEn = lang === 'en';
        const tipsJa = IDENTIFICATION_TIPS[category] || IDENTIFICATION_TIPS.OTHER;
        const tipsEn = IDENTIFICATION_TIPS_EN[category] || IDENTIFICATION_TIPS_EN.OTHER;
        const tips = isEn ? tipsEn : tipsJa;

        return {
            idLevel,
            isUnidentified,
            category,
            appearanceName: appearanceMatch.appearanceName || null,
            calledName: calledName || null,
            namedInstance: namedInstance || null,
            bucStatus,
            enchantment,
            charges,
            coreName,
            displayName,
            rawText: cleanText,
            identificationTips: tips,
            identificationTipsEn: tipsEn,
            identificationTipsJa: tipsJa,
            hasKnownEnchantment: enchantment !== null,
            hasKnownCharges: charges !== null,
            isMasked: isUnidentified
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
        if (/\bcursed\b/i.test(text)) {
            return { bucStatus: 'CURSED', textWithoutBuc: text.replace(/\bcursed\s+/i, '').trim() };
        }
        if (/\buncursed\b/i.test(text)) {
            return { bucStatus: 'UNCURSED', textWithoutBuc: text.replace(/\buncursed\s+/i, '').trim() };
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
        // 4. 装備中修飾子除去 ("(weapon in hand)", "(being worn)", "(on left hand)" 等)
        s = s.replace(/\([^\)]+\)/g, '');

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

        // 🎯 真名ガード: "ring of ...", "potion of ...", "scroll of ...", "wand of ...", "amulet of ..." 等は100%識別済み真名
        if (/\b(ring|potion|scroll|wand|amulet|spellbook|book)\s+of\b/i.test(lowerFull) || /\b(ring|potion|scroll|wand|amulet|spellbook|book)\s+of\b/i.test(lowerCore)) {
            return { isAppearance: false, category: this.inferCategory(lowerFull), appearanceName: null };
        }

        // 1. 薬 (Potion)
        if (lowerCore.includes('potion') || lowerFull.includes('potion')) {
            for (const app of APPEARANCE_PATTERNS.POTION) {
                if (lowerCore.includes(app) || lowerFull.includes(app)) {
                    return { isAppearance: true, category: 'POTION', appearanceName: `${app} potion` };
                }
            }
        }

        // 2. 巻物 (Scroll)
        if (lowerCore.includes('scroll') || lowerFull.includes('scroll') || lowerFull.includes('labeled') || lowerFull.includes('labelled')) {
            if (/\blabel+ed\b/i.test(lowerFull) || /\bscroll label+ed\b/i.test(lowerFull)) {
                const labelMatch = (fullText || '').match(/label+ed\s+([a-zA-Z\s]+)/i);
                return { isAppearance: true, category: 'SCROLL', appearanceName: labelMatch ? `scroll labeled ${labelMatch[1].trim()}` : 'labeled scroll' };
            }
        }

        // 3. 杖 (Wand)
        if (lowerCore.includes('wand') || lowerFull.includes('wand')) {
            for (const app of APPEARANCE_PATTERNS.WAND) {
                if (lowerCore.includes(app) || lowerFull.includes(app)) {
                    return { isAppearance: true, category: 'WAND', appearanceName: `${app} wand` };
                }
            }
        }

        // 4. 指輪 (Ring)
        if (lowerCore.includes('ring') || lowerFull.includes('ring')) {
            for (const app of APPEARANCE_PATTERNS.RING) {
                if (lowerCore.includes(app) || lowerFull.includes(app)) {
                    return { isAppearance: true, category: 'RING', appearanceName: `${app} ring` };
                }
            }
        }

        // 5. アミュレット (Amulet)
        if (lowerCore.includes('amulet') || lowerFull.includes('amulet')) {
            for (const app of APPEARANCE_PATTERNS.AMULET) {
                if (lowerCore.includes(app) || lowerFull.includes(app)) {
                    return { isAppearance: true, category: 'AMULET', appearanceName: `${app} amulet` };
                }
            }
        }

        // 6. 魔法書 (Spellbook)
        if (lowerCore.includes('spellbook') || lowerCore.includes('book') || lowerFull.includes('spellbook')) {
            for (const app of APPEARANCE_PATTERNS.SPELLBOOK) {
                if (lowerCore.includes(app) || lowerFull.includes(app)) {
                    if (!/\bspellbook of\b/i.test(lowerFull) && !/\bbook of\b/i.test(lowerFull)) {
                        return { isAppearance: true, category: 'SPELLBOOK', appearanceName: `${app} spellbook` };
                    }
                }
            }
        }

        // 7. 防具 (Armor 外見)
        for (const app of APPEARANCE_PATTERNS.ARMOR) {
            if (lowerCore === app || lowerFull.includes(app)) {
                return { isAppearance: true, category: 'ARMOR', appearanceName: app };
            }
        }

        // 8. 武器 (Weapon 外見)
        for (const app of APPEARANCE_PATTERNS.WEAPON) {
            if (lowerCore === app || lowerFull.includes(app)) {
                return { isAppearance: true, category: 'WEAPON', appearanceName: app };
            }
        }

        // 9. 宝石・石 (Gems/Stones 外見)
        for (const app of APPEARANCE_PATTERNS.GEM_STONE) {
            if (lowerCore === app || lowerFull.includes(app)) {
                return { isAppearance: true, category: 'GEM_STONE', appearanceName: app };
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
        if (lower.includes('scroll')) return 'SCROLL';
        if (lower.includes('wand')) return 'WAND';
        if (lower.includes('ring')) return 'RING';
        if (lower.includes('amulet')) return 'AMULET';
        if (lower.includes('spellbook') || lower.includes('book')) return 'SPELLBOOK';
        if (lower.includes('sword') || lower.includes('dagger') || lower.includes('axe') || lower.includes('spear') || lower.includes('bow') || lower.includes('arrow')) return 'WEAPON';
        if (lower.includes('mail') || lower.includes('armor') || lower.includes('helmet') || lower.includes('shield') || lower.includes('cloak') || lower.includes('boots') || lower.includes('gloves')) return 'ARMOR';
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
    static buildSafeDisplayName({ coreName, bucStatus, calledName, namedInstance, enchantment, charges, isUnidentified, appearanceName }) {
        const parts = [];

        // 1. BUC
        if (bucStatus === 'BLESSED') parts.push('blessed');
        else if (bucStatus === 'CURSED') parts.push('cursed');
        else if (bucStatus === 'UNCURSED') parts.push('uncursed');

        // 2. 強化値
        if (enchantment !== null) {
            parts.push(enchantment >= 0 ? `+${enchantment}` : `${enchantment}`);
        }

        // 3. コア名または外見名
        parts.push(appearanceName || coreName);

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
