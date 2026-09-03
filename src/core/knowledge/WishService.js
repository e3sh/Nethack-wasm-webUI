/**
 * WishService.js - NetHack 願い（Wishing）支援ナレッジサービス
 *
 * GKL (Game Knowledge Layer) の一部として、以下の機能を提供します：
 * 1. カテゴリ別アイテムカタログ・属性適用可能フラグの提供
 * 2. 定番プリセット（SDSM, 虐殺の巻物, 魔法耐性のマント等）の提供
 * 3. 日英・エイリアス対応のインクリメンタルサジェスト検索
 * 4. 構造化ウィッシュオブジェクトから NetHack 英語コマンド文字列へのシリアライズ
 */

import { OBJECT_KNOWLEDGE_MAP, buildStandardItemName } from './OBJECT_KNOWLEDGE_FULL.js';
import { OBJECT_KNOWLEDGE_BASE } from './OBJECT_KNOWLEDGE_BASE.js';

export const BLESSING_STATES = {
    BLESSED: 'blessed',
    UNCURSED: 'uncursed',
    CURSED: 'cursed'
};

export const PROOF_TYPES = {
    RUSTPROOF: 'rustproof',
    FIREPROOF: 'fireproof',
    CORRODEPROOF: 'corrodeproof',
    FIXED: 'fixed'
};

export const CATEGORY_LABELS = {
    WEAPON: { ja: '武器 (Weapon)', en: 'Weapon' },
    ARMOR: { ja: '防具・鎧 (Armor)', en: 'Armor' },
    RING: { ja: '指輪 (Ring)', en: 'Ring' },
    AMULET: { ja: '魔除け (Amulet)', en: 'Amulet' },
    TOOL: { ja: '道具 (Tool)', en: 'Tool' },
    FOOD: { ja: '食料 (Food)', en: 'Food' },
    POTION: { ja: '薬・ポーション (Potion)', en: 'Potion' },
    SCROLL: { ja: '巻物 (Scroll)', en: 'Scroll' },
    SPELLBOOK: { ja: '魔法書 (Spellbook)', en: 'Spellbook' },
    WAND: { ja: '杖 (Wand)', en: 'Wand' },
    GEM: { ja: '宝石 (Gem)', en: 'Gem' },
    GOLD: { ja: '金貨 (Gold)', en: 'Gold' },
    ARTIFACT: { ja: 'アーティファクト (Artifact)', en: 'Artifact' },
    OTHER: { ja: 'その他 (Other)', en: 'Other' }
};

export const WISH_PRESETS = [
    {
        id: 'sdsm',
        labelJa: '銀色ドラゴンの鱗鎧 (+2 祝福・防錆)',
        labelEn: '+2 blessed fixed silver dragon scale mail',
        spec: {
            itemId: 'silver_dragon_scale_mail',
            itemName: 'silver dragon scale mail',
            category: 'ARMOR',
            blessing: 'blessed',
            enchantment: 2,
            erosion: 'fixed',
            count: 1
        }
    },
    {
        id: 'gdsm',
        labelJa: '灰色ドラゴンの鱗鎧 (+2 祝福・防錆)',
        labelEn: '+2 blessed fixed gray dragon scale mail',
        spec: {
            itemId: 'gray_dragon_scale_mail',
            itemName: 'gray dragon scale mail',
            category: 'ARMOR',
            blessing: 'blessed',
            enchantment: 2,
            erosion: 'fixed',
            count: 1
        }
    },
    {
        id: 'scroll_genocide',
        labelJa: '虐殺の巻物 2枚 (祝福)',
        labelEn: '2 blessed scrolls of genocide',
        spec: {
            itemId: 'scroll_of_genocide',
            itemName: 'scroll of genocide',
            category: 'SCROLL',
            blessing: 'blessed',
            count: 2
        }
    },
    {
        id: 'scroll_charging',
        labelJa: '充填の巻物 2枚 (祝福)',
        labelEn: '2 blessed scrolls of charging',
        spec: {
            itemId: 'scroll_of_charging',
            itemName: 'scroll of charging',
            category: 'SCROLL',
            blessing: 'blessed',
            count: 2
        }
    },
    {
        id: 'wand_death',
        labelJa: '死の杖 (祝福)',
        labelEn: 'blessed wand of death',
        spec: {
            itemId: 'wand_of_death',
            itemName: 'wand of death',
            category: 'WAND',
            blessing: 'blessed',
            count: 1
        }
    },
    {
        id: 'speed_boots',
        labelJa: 'スピードの靴 (+2 祝福・防錆)',
        labelEn: '+2 blessed fixed speed boots',
        spec: {
            itemId: 'speed_boots',
            itemName: 'speed boots',
            category: 'ARMOR',
            blessing: 'blessed',
            enchantment: 2,
            erosion: 'fixed',
            count: 1
        }
    },
    {
        id: 'cloak_magic_resistance',
        labelJa: '魔法防御のマント (+2 祝福・防錆)',
        labelEn: '+2 blessed fixed cloak of magic resistance',
        spec: {
            itemId: 'cloak_of_magic_resistance',
            itemName: 'cloak of magic resistance',
            category: 'ARMOR',
            blessing: 'blessed',
            enchantment: 2,
            erosion: 'fixed',
            count: 1
        }
    },
    {
        id: 'bag_of_holding',
        labelJa: '魔法の利いた鞄 (祝福)',
        labelEn: 'blessed bag of holding',
        spec: {
            itemId: 'bag_of_holding',
            itemName: 'bag of holding',
            category: 'TOOL',
            blessing: 'blessed',
            count: 1
        }
    },
    {
        id: 'magic_lamp',
        labelJa: '魔法のランプ (祝福)',
        labelEn: 'blessed magic lamp',
        spec: {
            itemId: 'magic_lamp',
            itemName: 'magic lamp',
            category: 'TOOL',
            blessing: 'blessed',
            count: 1
        }
    }
];

export const FAMOUS_ARTIFACTS = [
    { name: 'Excalibur', ja: 'エクスカリバー', category: 'WEAPON', base: 'long sword' },
    { name: 'Stormbringer', ja: 'ストームブリンガー', category: 'WEAPON', base: 'runesword' },
    { name: 'Mjollnir', ja: 'ミョルニル', category: 'WEAPON', base: 'war hammer' },
    { name: 'Grayswandir', ja: 'グレイスワンダー', category: 'WEAPON', base: 'silver saber' },
    { name: 'Magicbane', ja: 'マジックベイン', category: 'WEAPON', base: 'athame' },
    { name: 'Vorpal Blade', ja: '首切りの剣 (ボーパルブレード)', category: 'WEAPON', base: 'long sword' },
    { name: 'Sunsword', ja: 'サンソード', category: 'WEAPON', base: 'long sword' },
    { name: 'Snickersnee', ja: 'スニッカースニー', category: 'WEAPON', base: 'knife' },
    { name: 'Frost Brand', ja: 'フロストブランド', category: 'WEAPON', base: 'long sword' },
    { name: 'Fire Brand', ja: 'ファイアブランド', category: 'WEAPON', base: 'long sword' },
    { name: 'The Eye of the Aethiopica', ja: 'アエシオーピカの目', category: 'AMULET', base: 'amulet of ESP' },
    { name: 'The Platinum Yendorian Express Card', ja: '白金のエンドール急行カード', category: 'TOOL', base: 'credit card' },
    { name: 'The Orb of Fate', ja: '運命の宝珠', category: 'TOOL', base: 'crystal ball' },
    { name: 'The Master Key of Thievery', ja: '盗賊の合鍵', category: 'TOOL', base: 'skeleton key' },
    { name: 'The Staff of Aesculapius', ja: 'アスクレピオスの杖', category: 'WEAPON', base: 'quarterstaff' }
];

export class WishService {
    constructor(options = {}) {
        this.translator = options.translator || null;
        this.language = options.language || 'ja';
        this._catalog = null;
        this._catalogByCategory = null;
        this._aliases = new Map();
        this._initAliases();
    }

    setLanguage(lang = 'ja') {
        this.language = (lang === 'en' || lang === 'english') ? 'en' : 'ja';
        this._catalog = null;
        this._catalogByCategory = null;
    }

    setTranslator(translator) {
        this.translator = translator;
        this._catalog = null; // リセットして再生成可能に
    }

    _initAliases() {
        const addAlias = (alias, target) => {
            this._aliases.set(alias.toLowerCase(), target.toLowerCase());
        };
        addAlias('sdsm', 'silver dragon scale mail');
        addAlias('gdsm', 'gray dragon scale mail');
        addAlias('rdsm', 'red dragon scale mail');
        addAlias('bdsm', 'blue dragon scale mail');
        addAlias('ydsm', 'yellow dragon scale mail');
        addAlias('odsm', 'orange dragon scale mail');
        addAlias('gdsm_green', 'green dragon scale mail');
        addAlias('wdsm', 'white dragon scale mail');
        addAlias('銀鱗', 'silver dragon scale mail');
        addAlias('灰鱗', 'gray dragon scale mail');
        addAlias('虐殺', 'scroll of genocide');
        addAlias('充填', 'scroll of charging');
        addAlias('死杖', 'wand of death');
        addAlias('願杖', 'wand of wishing');
        addAlias('目隠し', 'blindfold');
        addAlias('ホールド鞄', 'bag of holding');
        addAlias('魔防マント', 'cloak of magic resistance');
        addAlias('浮遊靴', 'levitation boots');
        addAlias('早足靴', 'speed boots');
    }

    /**
     * 全アイテムのウィッシュ用カタログを取得（遅延構築）
     */
    getCatalog() {
        if (this._catalog) return this._catalog;

        const catalog = [];
        const seenNames = new Set();

        for (let onum = 0; onum <= 480; onum++) {
            const item = OBJECT_KNOWLEDGE_MAP.get(onum);
            if (!item) continue;

            const category = item.category || 'OTHER';
            const fullName = buildStandardItemName(onum, category, item.name, item.tileName);
            const lowerName = fullName.toLowerCase();

            if (seenNames.has(lowerName)) continue;
            seenNames.add(lowerName);

            // 日本語名の解決 (TranslationEngine による SSOT 解決)
            let jaName = item.ja || item.nameJa || '';
            if (this.translator && typeof this.translator.translate === 'function') {
                const tr = this.translator.translate(fullName, 'ja') || this.translator.translate(item.name, 'ja');
                if (tr && tr !== fullName && tr !== item.name) {
                    jaName = tr;
                }
            }

            // カテゴリごとの許容属性フラグ判定
            const isArmor = category === 'ARMOR';
            const isWeapon = category === 'WEAPON';
            const isWand = category === 'WAND';
            const isStackable = ['SCROLL', 'POTION', 'GEM', 'FOOD'].includes(category) || (isWeapon && (item.itemInfo?.isAmmo || item.itemInfo?.isThrowing));
            const isErodible = isArmor || isWeapon || category === 'TOOL';

            catalog.push({
                onum,
                id: item.id || `obj_${onum}`,
                name: fullName,
                baseName: item.name,
                nameJa: jaName || fullName,
                category,
                options: {
                    allowEnchantment: isArmor || isWeapon,
                    allowBlessing: true,
                    allowErosionProof: isErodible,
                    allowCharges: isWand,
                    allowCount: isStackable,
                    maxEnchantment: isArmor ? 5 : (isWeapon ? 7 : 0),
                    defaultCount: isStackable ? 2 : 1
                }
            });
        }

        // アーティファクトもカタログにマージ
        for (const art of FAMOUS_ARTIFACTS) {
            catalog.push({
                onum: -1,
                id: `art_${art.name.toLowerCase().replace(/\s+/g, '_')}`,
                name: art.name,
                baseName: art.base,
                nameJa: art.ja,
                category: 'ARTIFACT',
                isArtifact: true,
                options: {
                    allowEnchantment: true,
                    allowBlessing: true,
                    allowErosionProof: true,
                    allowCharges: false,
                    allowCount: false,
                    maxEnchantment: 7,
                    defaultCount: 1
                }
            });
        }

        this._catalog = catalog;
        return this._catalog;
    }

    /**
     * カテゴリ別に整理されたカタログを取得
     */
    getCatalogByCategory() {
        if (this._catalogByCategory) return this._catalogByCategory;

        const catalog = this.getCatalog();
        const byCategory = {};

        for (const item of catalog) {
            const cat = item.category || 'OTHER';
            if (!byCategory[cat]) {
                byCategory[cat] = [];
            }
            byCategory[cat].push(item);
        }

        this._catalogByCategory = byCategory;
        return this._catalogByCategory;
    }

    /**
     * 定番プリセット一覧を取得
     */
    getPresets() {
        return WISH_PRESETS;
    }

    /**
     * アイテム名やエイリアスによるインクリメンタルサジェスト
     * @param {string} query 検索語
     * @param {Object} [options={}]
     * @param {string} [options.category] カテゴリ絞り込み
     * @param {number} [options.limit=15] 最大件数
     * @returns {Array} 候補アイテム配列
     */
    suggest(query = '', options = {}) {
        const q = String(query).trim().toLowerCase();
        const catalog = this.getCatalog();
        const limit = options.limit || 15;
        const category = options.category || null;

        if (!q) {
            const filtered = category ? catalog.filter(it => it.category === category) : catalog;
            return filtered.slice(0, limit);
        }

        // エイリアス解決
        const aliasTarget = this._aliases.get(q) || null;

        const results = [];
        for (const item of catalog) {
            if (category && item.category !== category) continue;

            const nameEn = item.name.toLowerCase();
            const nameJa = (item.nameJa || '').toLowerCase();

            let score = 0;
            if (aliasTarget && nameEn.includes(aliasTarget)) {
                score += 100;
            }
            if (nameEn === q || nameJa === q) {
                score += 80;
            } else if (nameEn.startsWith(q) || nameJa.startsWith(q)) {
                score += 50;
            } else if (nameEn.includes(q) || nameJa.includes(q)) {
                score += 20;
            }

            if (score > 0) {
                results.push({ item, score });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit).map(r => r.item);
    }

    /**
     * 構造化ウィッシュオブジェクトから NetHack 英語コマンド文字列を構築
     * @param {Object} spec
     * @param {string} spec.itemName アイテム英語名 / アーティファクト名
     * @param {number} [spec.count=1] 個数
     * @param {string} [spec.blessing] 'blessed' | 'uncursed' | 'cursed'
     * @param {number} [spec.enchantment] +2, -1 等
     * @param {string} [spec.erosion] 'rustproof' | 'fireproof' | 'fixed' | 'corrodeproof'
     * @param {boolean} [spec.isGreased]
     * @param {boolean} [spec.isPoisoned]
     * @param {number} [spec.charges]
     * @returns {string} シリアライズされた願い文字列 (例: "+2 blessed fixed silver dragon scale mail")
     */
    serializeWish(spec = {}) {
        if (!spec || (!spec.itemName && !spec.itemId && !spec.name)) {
            return '';
        }

        let itemName = spec.itemName || spec.name || '';
        if (!itemName && spec.itemId) {
            const found = this.getCatalog().find(it => it.id === spec.itemId);
            if (found) itemName = found.name;
        }

        const parts = [];

        // 1. 個数 (2個以上、または複数形の巻物など)
        const count = typeof spec.count === 'number' ? spec.count : parseInt(spec.count, 10);
        if (!isNaN(count) && count > 1) {
            parts.push(count.toString());
        }

        // 2. 祝福 / 呪い
        if (spec.blessing) {
            const b = spec.blessing.toLowerCase();
            if (['blessed', 'cursed', 'uncursed'].includes(b)) {
                parts.push(b);
            }
        }

        // 3. 油塗り (greased)
        if (spec.isGreased || spec.greased) {
            parts.push('greased');
        }

        // 4. 耐性・防錆 (rustproof / fixed 等)
        if (spec.erosion) {
            const e = spec.erosion.toLowerCase();
            if (['rustproof', 'fireproof', 'corrodeproof', 'fixed'].includes(e)) {
                parts.push(e);
            }
        }

        // 5. 毒 (poisoned)
        if (spec.isPoisoned || spec.poisoned) {
            parts.push('poisoned');
        }

        // 6. 強化値 (+2, -1 等)
        const ench = typeof spec.enchantment === 'number' ? spec.enchantment : parseInt(spec.enchantment, 10);
        if (!isNaN(ench) && ench !== 0) {
            parts.push(ench > 0 ? `+${ench}` : `${ench}`);
        }

        // 7. アイテム名本体（個数が複数の場合の英語複数形対応: scroll of X -> scrolls of X, potion of X -> potions of X）
        let formattedName = itemName;
        if (!isNaN(count) && count > 1) {
            if (formattedName.startsWith('scroll of ')) {
                formattedName = formattedName.replace('scroll of ', 'scrolls of ');
            } else if (formattedName.startsWith('potion of ')) {
                formattedName = formattedName.replace('potion of ', 'potions of ');
            } else if (formattedName.startsWith('spellbook of ')) {
                formattedName = formattedName.replace('spellbook of ', 'spellbooks of ');
            } else if (formattedName.startsWith('wand of ')) {
                formattedName = formattedName.replace('wand of ', 'wands of ');
            } else if (formattedName.startsWith('ring of ')) {
                formattedName = formattedName.replace('ring of ', 'rings of ');
            }
        }
        parts.push(formattedName);

        // 8. 充填回数 (charges)
        if (spec.charges !== undefined && spec.charges !== null) {
            const ch = parseInt(spec.charges, 10);
            if (!isNaN(ch)) {
                parts.push(`(0:${ch})`);
            }
        }

        return parts.join(' ').trim();
    }

    /**
     * 生のテキスト入力から構造化ウィッシュオブジェクトを逆解析 (簡易デシリアライザ)
     * @param {string} text 
     * @returns {Object}
     */
    parseWish(text = '') {
        const raw = String(text).trim();
        if (!raw) return null;

        const tokens = raw.split(/\s+/);
        const spec = {
            count: 1,
            blessing: null,
            enchantment: 0,
            erosion: null,
            isGreased: false,
            isPoisoned: false,
            charges: null,
            itemName: ''
        };

        const remainingTokens = [];

        for (const token of tokens) {
            const lower = token.toLowerCase();

            // 個数チェック (数字のみ)
            if (/^\d+$/.test(token) && remainingTokens.length === 0 && spec.count === 1) {
                spec.count = parseInt(token, 10);
                continue;
            }

            // 強化値 (+2, -1)
            if (/^[+-]\d+$/.test(token)) {
                spec.enchantment = parseInt(token, 10);
                continue;
            }

            // 充填回数 (0:3)
            if (/^\(?\d+:\d+\)?$/.test(token)) {
                const match = token.match(/\d+:(\d+)/);
                if (match) spec.charges = parseInt(match[1], 10);
                continue;
            }

            // 属性フラグ
            if (['blessed', 'cursed', 'uncursed'].includes(lower)) {
                spec.blessing = lower;
            } else if (['rustproof', 'fireproof', 'corrodeproof', 'fixed'].includes(lower)) {
                spec.erosion = lower;
            } else if (lower === 'greased') {
                spec.isGreased = true;
            } else if (lower === 'poisoned') {
                spec.isPoisoned = true;
            } else {
                remainingTokens.push(token);
            }
        }

        let name = remainingTokens.join(' ');
        // 複数形の正規化 (scrolls of -> scroll of)
        name = name.replace(/^scrolls of /, 'scroll of ')
                   .replace(/^potions of /, 'potion of ')
                   .replace(/^wands of /, 'wand of ')
                   .replace(/^rings of /, 'ring of ');

        spec.itemName = name;
        return spec;
    }
}
