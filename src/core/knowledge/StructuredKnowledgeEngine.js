/**
 * StructuredKnowledgeEngine.js
 * NetHack 構造化ナレッジ＆ヘルプ基盤エンジン
 *
 * 【設計指針】
 * - マスターデータは「言語非依存 (英語原名 / Standard Key & English Text)」で保持。
 * - UIやコンポーネントがデータを取得する際、WebUICore の TranslationEngine を介して
 *   オンデマンドで動的に翻訳処理を行って返却する。
 */

import { classifyGlyph, getCmapInfo, getOnumFromGlyph, getCategoryFromOnum, ENTITY_TYPES } from './glyphClassifier.js';
import { MONSTER_TILEMAP_NAMES, OBJECT_TILEMAP_NAMES } from './tilemappings_data.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';

export const OBJECT_CATEGORY_ADVICE = {
    POTION: {
        category: 'POTION',
        effectSummary: 'Quaff with \'q\' to apply magical effect, or dip items with \'#dip\'. Unidentified potions can be identified via Scroll of Identify, Altar testing, or Dip testing.',
        unidentifiedTips: [
            '識別の巻物を読んだり、流し台(#apply sink)や神壇でテストして鑑定するのが安全です',
            '未鑑定の薬の飲み試しは麻痺・失明・毒・変身などのリスクを伴います'
        ]
    },
    SCROLL: {
        category: 'SCROLL',
        effectSummary: 'Read with \'r\' to trigger magical spell effects. Blank scrolls can be written on with Magic Marker.',
        unidentifiedTips: [
            '安全な部屋で試読(\'r\')するか、店主の価格鑑定や識別の巻物で解明してください',
            '呪われた巻物は逆効果を発揮するためお祓い(Remove Curse)推奨'
        ]
    },
    WAND: {
        category: 'WAND',
        effectSummary: 'Zap with \'z\' in a direction. Engrave test on floor (\'E\') to check beam type without wasting charges.',
        unidentifiedTips: [
            '床に文字を刻むテスト(\'E\')を行うと、充填数を消費せずに効果タイプを判別できます',
            '識別の巻物で残り充填回数と効果を解明可能です'
        ]
    },
    RING: {
        category: 'RING',
        effectSummary: 'Put on with \'P\' or remove with \'R\'. Grants passive intrinsic abilities, but increases hunger rate.',
        unidentifiedTips: [
            '流し台(#apply sink)に指輪を落とすと、特有の現象や音で正体が確定します',
            '呪われた指輪は外せなくなる(\'R\'不可)ため、解呪の手段を用意して装着してください'
        ]
    },
    AMULET: {
        category: 'AMULET',
        effectSummary: 'Wear with \'W\' or take off with \'T\'. Grants vital protections such as Reflection or Life Saving.',
        unidentifiedTips: [
            '首にかける(\'W\')と強力な耐性を得られますが、絞殺のアミュレット等に注意',
            '識別の巻物で鑑定してから装着するのが最も安全です'
        ]
    },
    WEAPON: {
        category: 'WEAPON',
        effectSummary: 'Wield with \'w\' or throw with \'t\'. Skill proficiency and enchantment level directly affect damage and hit rate.',
        unidentifiedTips: [
            '装備(\'w\')して攻撃命中率やダメージの変化を確認できます',
            '呪われた武器は手に貼り付くため、神壇(Altar)で呪いチェック推奨'
        ]
    },
    ARMOR: {
        category: 'ARMOR',
        effectSummary: 'Wear with \'W\' or take off with \'T\'. Lower AC (Armor Class) numbers provide better protection.',
        unidentifiedTips: [
            '着脱(\'W\'/\'T\')して AC の変化を確認することで強化値を推定可能',
            '神壇(Altar)の上に置くと、呪い・祝福・通常が色で判別できます'
        ]
    },
    FOOD: {
        category: 'FOOD',
        effectSummary: 'Eat with \'e\' to restore nutrition and prevent fainting or starvation.',
        unidentifiedTips: [
            '食べる(\'e\')ことで空腹を回復します。死体は腐敗(Poison/Taint)に注意'
        ]
    },
    TOOL: {
        category: 'TOOL',
        effectSummary: 'Apply with \'#apply\' or specific hotkeys. Essential utility items for dungeon survival.',
        unidentifiedTips: [
            '\'#apply\' キーで使用し、専用の機能や探索効果を発揮します'
        ]
    },
    CONTAINER: {
        category: 'CONTAINER',
        effectSummary: 'Apply with \'#apply\' to store, retrieve, or lock/unlock items. Prevents potion breakage from landmines.',
        unidentifiedTips: [
            '\'#apply\' で開閉・鍵開け・収納。貴重な薬や巻物を保護できます'
        ]
    },
    SPELLBOOK: {
        category: 'SPELLBOOK',
        effectSummary: 'Read with \'r\' to memorize spell. Requires sufficient Intelligence and energy (PW) to cast.',
        unidentifiedTips: [
            '読む(\'r\')ことで呪文を記憶します。高難度魔法書は解読に失敗すると失明等'
        ]
    },
    GEM: {
        category: 'GEM',
        effectSummary: 'Throw at monsters or sell for gold. Touchstone can distinguish real gems from worthless glass.',
        unidentifiedTips: [
            'タッチストーン(Touchstone)で引っ掻くテストをすると本物の宝石と硝子を判別可能',
            'モンスターに投げつけるか売却して高額な金貨を獲得できます'
        ]
    }
};

export function inferObjectCategory(itemName) {
    if (!itemName) return OBJECT_CATEGORY_ADVICE.TOOL;
    const lower = itemName.toLowerCase();

    if (lower.includes('potion') || lower.includes('vial') || lower.includes('flask') || lower.includes('smoky') || lower.includes('cloudy') || lower.includes('clear') || lower.includes('murky') || lower.includes('fizzy') || lower.includes('bubbly') || lower.includes('viscous') || lower.includes('milky')) {
        return OBJECT_CATEGORY_ADVICE.POTION;
    }
    if (lower.includes('scroll') || lower.includes('paper') || lower.includes('parchment') || lower.includes('labeled') || lower.includes('stamped') || lower.includes('vellum')) {
        return OBJECT_CATEGORY_ADVICE.SCROLL;
    }
    if (lower.includes('wand') || lower.includes('staff') || lower.includes('rod') || lower.includes('balsa') || lower.includes('marble wand') || lower.includes('ebony') || lower.includes('oak') || lower.includes('pine') || lower.includes('copper wand') || lower.includes('iron wand') || lower.includes('brass wand') || lower.includes('silver wand') || lower.includes('glass wand') || lower.includes('short wand') || lower.includes('long wand') || lower.includes('runed wand') || lower.includes('curved wand')) {
        return OBJECT_CATEGORY_ADVICE.WAND;
    }
    if (lower.includes('ring') || lower.includes('band') || lower.includes('ruby') || lower.includes('sapphire') || lower.includes('emerald ring') || lower.includes('pearl ring') || lower.includes('diamond ring') || lower.includes('topaz') || lower.includes('opal') || lower.includes('granite') || lower.includes('wire ring') || lower.includes('engagement') || lower.includes('shiny ring') || lower.includes('wooden ring') || lower.includes('iron ring') || lower.includes('brass ring') || lower.includes('silver ring') || lower.includes('gold ring')) {
        return OBJECT_CATEGORY_ADVICE.RING;
    }
    if (lower.includes('amulet') || lower.includes('pendant') || lower.includes('talisman') || lower.includes('necklace') || lower.includes('medallion')) {
        return OBJECT_CATEGORY_ADVICE.AMULET;
    }
    if (lower.includes('sword') || lower.includes('dagger') || lower.includes('spear') || lower.includes('arrow') || lower.includes('bow') || lower.includes('axe') || lower.includes('mace') || lower.includes('dart') || lower.includes('javelin') || lower.includes('flail') || lower.includes('scimitar') || lower.includes('halberd') || lower.includes('trident') || lower.includes('lance') || lower.includes('crossbow') || lower.includes('sling') || lower.includes('club') || lower.includes('staff') || lower.includes('hammer')) {
        return OBJECT_CATEGORY_ADVICE.WEAPON;
    }
    if (lower.includes('armor') || lower.includes('mail') || lower.includes('helmet') || lower.includes('shield') || lower.includes('cloak') || lower.includes('boots') || lower.includes('gloves') || lower.includes('gauntlets') || lower.includes('helm') || lower.includes('cap') || lower.includes('suit') || lower.includes('dragon scale') || lower.includes('shirt') || lower.includes('robe')) {
        return OBJECT_CATEGORY_ADVICE.ARMOR;
    }
    if (lower.includes('food') || lower.includes('ration') || lower.includes('apple') || lower.includes('pear') || lower.includes('candy') || lower.includes('lembas') || lower.includes('cram') || lower.includes('meat') || lower.includes('tripe') || lower.includes('orange') || lower.includes('banana') || lower.includes('cookie') || lower.includes('pancake') || lower.includes('melon')) {
        return OBJECT_CATEGORY_ADVICE.FOOD;
    }
    if (lower.includes('box') || lower.includes('chest') || lower.includes('bag') || lower.includes('sack') || lower.includes('coffer') || lower.includes('large box') || lower.includes('trunk')) {
        return OBJECT_CATEGORY_ADVICE.CONTAINER;
    }
    if (lower.includes('spellbook') || lower.includes('book') || lower.includes('tome') || lower.includes('grimoire') || lower.includes('papyrus')) {
        return OBJECT_CATEGORY_ADVICE.SPELLBOOK;
    }
    if (lower.includes('gem') || lower.includes('glass') || lower.includes('stone') || lower.includes('agate') || lower.includes('fluorite') || lower.includes('turquoise') || lower.includes('aquamarine') || lower.includes('garnet') || lower.includes('amethyst') || lower.includes('citrine') || lower.includes('obsidian') || lower.includes('amber') || lower.includes('jade')) {
        return OBJECT_CATEGORY_ADVICE.GEM;
    }

    return OBJECT_CATEGORY_ADVICE.TOOL;
}

// ============================================================================
// 全 384 モンスター構造化マスターデータ (MONSTER_KNOWLEDGE_FULL.js よりインポート)
// ============================================================================
export const MONSTER_KNOWLEDGE_BASE = ALL_MONSTER_KNOWLEDGE_BASE;

// ============================================================================
// 先行開発アイテム構造化マスターデータ (純英語定義)
// ============================================================================
export const ITEM_KNOWLEDGE_BASE = [
    // ⚔️ 武器 (WEAPON)
    {
        id: 'long_sword',
        onum: 54,
        name: 'long sword',
        category: 'WEAPON',
        stats: { sdam: '1d8', ldam: '1d12', skill: 'Long Sword', hands: 1, material: 'iron', weight: 30 },
        effectSummary: '1-handed sword. Damage: 1d8 (Small/Med) / 1d12 (Large).',
        flavorNote: 'The classic adventurer sidearm. Reliable and versatile in single-handed combat.',
        usageAdvice: [
            'Can be dual-wielded (Two-Weapon Combat) with short sword or dagger',
            'Can be dipped in holy water to bless for bonus damage against undead'
        ]
    },
    {
        id: 'katana',
        onum: 56,
        name: 'samurai sword',
        category: 'WEAPON',
        stats: { sdam: '1d10', ldam: '1d12', skill: 'Long Sword', hands: 1, material: 'iron', weight: 40 },
        effectSummary: '1-handed Samurai blade. Damage: 1d10 (Small/Med) / 1d12 (Large).',
        flavorNote: 'A masterwork folded steel blade. Deals highest single-handed sword base damage.',
        usageAdvice: [
            'Best non-artifact single-handed longsword in the game'
        ]
    },
    {
        id: 'silver_saber',
        onum: 51,
        name: 'silver saber',
        category: 'WEAPON',
        stats: { sdam: '1d8 (+1d20 vs Silver-hate)', ldam: '1d8 (+1d20 vs Silver-hate)', skill: 'Saber', hands: 1, material: 'silver', weight: 40 },
        effectSummary: '1-handed silver sword. Deals massive +1d20 extra damage to Undead, Demons, and Were-creatures.',
        flavorNote: 'Silver burns evil entities on touch, making it one of the deadliest weapons in Gehennom.',
        usageAdvice: [
            'Dual-wielding silver sabers obliterates late-game demonic & undead boss packs'
        ]
    },
    {
        id: 'quarterstaff',
        onum: 79,
        name: 'staff',
        category: 'WEAPON',
        stats: { sdam: '1d6', ldam: '1d6', skill: 'Quarterstaff', hands: 2, material: 'wood', weight: 40 },
        effectSummary: '2-handed wooden staff. Damage: 1d6 / 1d6.',
        flavorNote: 'Simple wooden pole loved by spellcasters and monks.',
        usageAdvice: ['Safe against rust monsters and disenchanters']
    },
    // 🛡️ 防具 (ARMOR)
    {
        id: 'gray_dragon_scale_mail',
        onum: 101,
        name: 'gray dragon scale mail',
        category: 'ARMOR',
        stats: { ac: 9, mc: 0, material: 'dragon scale', weight: 40, magicResistance: true },
        effectSummary: 'Lightweight body armor. Base AC: 9. Grants Magic Resistance.',
        flavorNote: 'Forged from gray dragon scales. Essential endgame protection against lethal magic spells.',
        usageAdvice: ['Combines top defense with magic resistance without spellcasting penalty']
    },
    {
        id: 'silver_dragon_scale_mail',
        onum: 103,
        name: 'silver dragon scale mail',
        category: 'ARMOR',
        stats: { ac: 9, mc: 0, material: 'dragon scale', weight: 40, reflection: true },
        effectSummary: 'Lightweight body armor. Base AC: 9. Grants Reflection.',
        flavorNote: 'Reflects death rays, zaps, and petrifying gazes back at attackers.',
        usageAdvice: ['Frees up shield or amulet slot by providing built-in Reflection']
    },
    {
        id: 'plate_mail',
        onum: 121,
        name: 'plate mail',
        category: 'ARMOR',
        stats: { ac: 7, mc: 1, material: 'iron', weight: 450, spellPenalty: true },
        effectSummary: 'Heavy iron armor. Base AC: 7. High weight, hinders spellcasting.',
        flavorNote: 'Maximum early physical protection for heavy melee knights.',
        usageAdvice: ['Rusts in water; protect with oilskin cloak or grease']
    },
    {
        id: 'leather_gloves',
        onum: 159,
        name: 'leather gloves',
        category: 'ARMOR',
        stats: { ac: 1, material: 'leather', weight: 10 },
        effectSummary: 'Hand protection. Base AC: 1. Allows safe handling of cockatrice corpses.',
        flavorNote: 'Essential gear for handling petrifying corpses without turning to stone.',
        usageAdvice: ['Always wear before picking up or wielding a cockatrice corpse']
    },
    {
        id: 'speed_boots',
        onum: 166,
        name: 'speed boots',
        category: 'ARMOR',
        stats: { ac: 1, material: 'leather', weight: 20, speedBoost: true },
        effectSummary: 'Footwear. Base AC: 1. Grants Very Fast movement speed.',
        flavorNote: 'Enables swift movement to outrun almost any monster in the dungeon.',
        usageAdvice: ['Essential for tactical kiting and escaping lethal enemies']
    },
    // 💍 指輪 (RING)
    {
        id: 'ring_of_conflict',
        onum: 186,
        name: 'ring of conflict',
        category: 'RING',
        stats: { hungerRate: 2 },
        effectSummary: 'Causes nearby monsters to attack each other instead of you.',
        flavorNote: 'Sows chaos in monster packs, turning enemy numbers against themselves.',
        usageAdvice: [
            'Increases hunger rate (2x)',
            'Pets will also become hostile while conflict is active; wear only in battle'
        ]
    },
    {
        id: 'ring_of_teleport_control',
        onum: 195,
        name: 'ring of teleport control',
        category: 'RING',
        stats: { hungerRate: 1 },
        effectSummary: 'Allows precise destination choice when teleporting.',
        flavorNote: 'Grants full mastery over space when combined with teleportation.',
        usageAdvice: ['Essential for fast navigation and quick dungeon escapes']
    },
    // 📿 アミュレット (AMULET)
    {
        id: 'amulet_of_life_saving',
        onum: 202,
        name: 'amulet of life saving',
        category: 'AMULET',
        effectSummary: 'Prevents fatal death once by restoring health and destroying itself.',
        flavorNote: 'A divine safety net against sudden mistakes or lethal traps.',
        usageAdvice: ['Always wear when entering high-risk areas or fighting Medusa']
    },
    // 🎒 容器・道具 (CONTAINER / TOOL)
    {
        id: 'bag_of_holding',
        onum: 219,
        name: 'bag of holding',
        category: 'CONTAINER',
        effectSummary: 'Magical bag that reduces effective weight of stored items by 50%.',
        flavorNote: 'Essential container for hoarders and heavy loot transportation.',
        usageAdvice: [
            'Do NOT insert Bag of Tricks or Magic Lamp (causes catastrophic explosion!)',
            'Protect from fire and sharp objects'
        ]
    },
    {
        id: 'unicorn_horn',
        onum: 261,
        name: 'unicorn horn',
        category: 'TOOL',
        effectSummary: 'Tool (`#apply`). Cures poison, illness, blindness, confusion, and stat loss.',
        flavorNote: 'The Swiss Army knife of NetHack survival. Apply regularly to restore depleted stats.',
        usageAdvice: [
            'Apply (`#apply`) immediately after stat drain or poison hit',
            'Blessing increases success rate to 100%'
        ]
    },
    // 🪄 杖 & 📜 巻物 & 🧪 ポーション
    {
        id: 'wand_of_digging',
        onum: 428,
        name: 'wand of digging',
        category: 'WAND',
        effectSummary: 'Digs holes or tunnels in walls and floor.',
        bucEffects: {
            blessed: 'Digs longer tunnel through multiple walls',
            uncursed: 'Digs standard tunnel through wall or hole in floor',
            cursed: 'May misfire or break'
        },
        unidentifiedTips: [
            'Engrave test: Digs a trench / hole in floor and identifies the wand'
        ],
        usageAdvice: [
            'Escape from dangerous enemies into floor below',
            'Carve Elbereth quickly on floor',
            'Escape pit traps or rock traps'
        ]
    },
    {
        id: 'wand_of_death',
        onum: 410,
        name: 'wand of death',
        category: 'WAND',
        effectSummary: 'Fires a ray of death that instantly kills non-resistant targets.',
        bucEffects: {
            blessed: 'Fires standard death ray',
            uncursed: 'Fires standard death ray',
            cursed: 'May explode or misfire'
        },
        unidentifiedTips: [
            'Engrave test: Displays a fatal ray warning message'
        ],
        usageAdvice: [
            'Save charges for lethal threats (Arch-Lich, Medusa, Rodney)',
            'Avoid shooting enemies with Reflection'
        ]
    },
    {
        id: 'scroll_of_remove_curse',
        onum: 323,
        name: 'scroll of remove curse',
        category: 'SCROLL',
        effectSummary: 'Removes curse from items in inventory.',
        bucEffects: {
            blessed: 'Uncurses all items in your entire inventory',
            uncursed: 'Uncurses worn armor, wielded weapons, and selected items',
            cursed: 'Curses items in inventory instead!'
        },
        unidentifiedTips: [
            'Read when holding or wearing cursed equipment'
        ],
        usageAdvice: [
            'Bless this scroll before reading for maximum benefit'
        ]
    },
    {
        id: 'scroll_of_identify',
        onum: 324,
        name: 'scroll of identify',
        category: 'SCROLL',
        effectSummary: 'Identifies unknown items in inventory.',
        bucEffects: {
            blessed: 'Identifies all items in your entire inventory',
            uncursed: 'Identifies 1 item (20% chance to identify multiple items)'
        },
        unidentifiedTips: [
            'Most common scroll in dungeon (Price ID: 20zm)'
        ],
        usageAdvice: [
            'Always bless scroll of identify before reading'
        ]
    },
    {
        id: 'potion_of_healing',
        onum: 297,
        name: 'potion of healing',
        category: 'POTION',
        effectSummary: 'Restores HP and cures blindness.',
        bucEffects: {
            blessed: 'Restores 3d8 HP and cures blindness/illness',
            uncursed: 'Restores 2d8 HP',
            cursed: 'Restores 1d8 HP'
        },
        unidentifiedTips: [
            'Quaffing when injured restores health',
            'Dip in potion to cure poison on weapons'
        ]
    },
    {
        id: 'potion_of_extra_healing',
        onum: 298,
        name: 'potion of extra healing',
        category: 'POTION',
        effectSummary: 'Restores large amount of HP and increases maximum HP.',
        bucEffects: {
            blessed: 'Restores 5d8 HP, increases max HP by 5',
            uncursed: 'Restores 3d8 HP, increases max HP by 2'
        }
    },
    {
        id: 'potion_of_full_healing',
        onum: 299,
        name: 'potion of full healing',
        category: 'POTION',
        effectSummary: 'Fully restores HP and increases maximum HP by 4-8.',
        bucEffects: {
            blessed: 'Fully restores HP, increases max HP by 8, cures deafness/blindness/illness'
        }
    },
    {
        id: 'potion_of_gain_level',
        onum: 300,
        name: 'potion of gain level',
        category: 'POTION',
        effectSummary: 'Increases experience level by 1.',
        bucEffects: {
            blessed: 'Increases level by 1 without resetting experience points',
            uncursed: 'Increases level by 1',
            cursed: 'Teleports player up 1 dungeon floor'
        }
    },
    {
        id: 'bag_of_holding',
        onum: 219,
        name: 'bag of holding',
        category: 'TOOL',
        effectSummary: 'Container that drastically reduces the weight of stored items.',
        bucEffects: {
            blessed: 'Reduces weight of contents to 25%',
            uncursed: 'Reduces weight of contents to 50%',
            cursed: 'Increases weight of contents to 200%'
        },
        unidentifiedTips: [
            'Apply bag to insert or remove items'
        ],
        usageAdvice: [
            'CRITICAL: Never put Wand of Cancellation or Bag of Tricks inside (causes magical explosion and destroys inventory!)'
        ]
    },
    {
        id: 'elven_dagger',
        onum: 19,
        name: 'elven dagger',
        category: 'WEAPON',
        stats: { damageSmall: '1d5', damageLarge: '1d3' },
        usageAdvice: [
            'Best weapon for engraving Elbereth in dust/floor without dulling fast'
        ]
    },
    {
        id: 'pick_axe',
        onum: 259,
        name: 'pick-axe',
        category: 'TOOL',
        effectSummary: 'Digs through walls and rock.',
        usageAdvice: [
            'Essential mining tool when low on Wand of Digging charges'
        ]
    },
    {
        id: 'skeleton_key',
        onum: 221,
        name: 'skeleton key',
        category: 'TOOL',
        effectSummary: 'Unlocks doors and locked chests.'
    },
    {
        id: 'blindfold',
        onum: 224,
        name: 'blindfold',
        category: 'TOOL',
        effectSummary: 'Blinds player when worn to activate Telepathy (ESP) or avoid gaze attacks.',
        usageAdvice: [
            'Wear to safely fight Floating Eye or Medusa'
        ]
    },
    {
        id: 'towel',
        onum: 225,
        name: 'towel',
        category: 'TOOL',
        effectSummary: 'Cleans face/hands, acts as blindfold when wrapped around eyes.'
    },
    {
        id: 'ring_of_conflict',
        onum: 177,
        name: 'ring of conflict',
        category: 'RING',
        effectSummary: 'Causes nearby monsters to attack each other instead of player.',
        usageAdvice: [
            'Very useful when swarmed by groups of monsters'
        ]
    },
    {
        id: 'ring_of_teleport_control',
        onum: 178,
        name: 'ring of teleport control',
        category: 'RING',
        effectSummary: 'Allows choosing exact destination when teleporting.'
    },
    {
        id: 'amulet_of_life_saving',
        onum: 201,
        name: 'amulet of life saving',
        category: 'AMULET',
        effectSummary: 'Resurrects player upon fatal damage, destroying the amulet.'
    },
    {
        id: 'amulet_of_reflection',
        onum: 202,
        name: 'amulet of reflection',
        category: 'AMULET',
        effectSummary: 'Reflects death rays, zaps, and dragon breath back at attacker.'
    },
    {
        id: 'scroll_of_teleportation',
        onum: 325,
        name: 'scroll of teleportation',
        category: 'SCROLL',
        effectSummary: 'Teleports reader to random spot on current dungeon floor.'
    },
    {
        id: 'scroll_of_earth',
        onum: 326,
        name: 'scroll of earth',
        category: 'SCROLL',
        effectSummary: 'Summons boulders around reader. Useful for blocking corridors or Sokoban.'
    }
];

export class StructuredKnowledgeEngine {
    /**
     * @param {Object} options 
     * @param {Object} [options.translationEngine] - WebUICore.TranslationEngine インスタンス
     */
    constructor(options = {}) {
        this.translationEngine = options.translationEngine || null;

        this.monsters = new Map();
        this.items = new Map();
        this.monOffsetMap = new Map();
        this.onumMap = new Map();

        // マスターデータの初期化インデックス構築
        this._initDatabase();
    }

    /**
     * TranslationEngine インスタンスの設定/更新
     * @param {Object} translationEngine 
     */
    setTranslationEngine(translationEngine) {
        this.translationEngine = translationEngine;
    }

    /**
     * マスターデータのインデックス構築
     * @private
     */
    _initDatabase() {
        for (const mon of MONSTER_KNOWLEDGE_BASE) {
            this.monsters.set(mon.id, mon);
            this.monsters.set(mon.name.toLowerCase(), mon);

            // 単体設定値がある場合
            if (typeof mon.monOffset === 'number') {
                this.monOffsetMap.set(mon.monOffset, mon);
            }

            // MONSTER_TILEMAP_NAMES (Single Source of Truth) から mnum (monOffset) を全自動逆引きバインド！
            for (const [mnumStr, name] of Object.entries(MONSTER_TILEMAP_NAMES)) {
                if (name.toLowerCase() === mon.name.toLowerCase()) {
                    const mnum = parseInt(mnumStr, 10);
                    this.monOffsetMap.set(mnum, mon);
                }
            }
        }

        // 1. OBJECT_KNOWLEDGE_MAP (全 481 アイテムの完全マスター) を最初に 100% 登録
        if (OBJECT_KNOWLEDGE_MAP && OBJECT_KNOWLEDGE_MAP.size > 0) {
            for (const [onum, entry] of OBJECT_KNOWLEDGE_MAP.entries()) {
                this.onumMap.set(onum, entry);
                this.items.set(entry.id, entry);
                if (entry.name) {
                    this.items.set(entry.name.toLowerCase(), entry);
                }
            }
        }

        // 2. ITEM_KNOWLEDGE_BASE (手動詳細定義) を上書きマージ統合
        for (const item of ITEM_KNOWLEDGE_BASE) {
            this.items.set(item.id, item);
            this.items.set(item.name.toLowerCase(), item);

            let targetOnum = (typeof item.onum === 'number') ? item.onum : -1;
            if (targetOnum < 0) {
                const entry = Object.entries(OBJECT_TILEMAP_NAMES).find(([onumStr, name]) => name && name.toLowerCase() === item.name.toLowerCase());
                if (entry) targetOnum = parseInt(entry[0], 10);
            }

            if (targetOnum >= 0) {
                const existing = this.onumMap.get(targetOnum) || {};
                // item の effectSummary がダミーの場合は existing の豊かな定義を優先
                const itemEffect = (item.effectSummary && !item.effectSummary.includes('item (#')) ? item.effectSummary : existing.effectSummary;
                const merged = { ...existing, ...item, effectSummary: itemEffect || existing.effectSummary };
                this.onumMap.set(targetOnum, merged);
                this.items.set(merged.id || item.id, merged);
            }
        }
    }

    /**
     * 構造化オブジェクト内の各種テキストプロパティを TranslationEngine で動的ローカライズ
     * @param {Object} obj 
     * @returns {Object} ローカライズ済みディープコピー
     */
    localizeKnowledge(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (!this.translationEngine || typeof this.translationEngine.translate !== 'function') {
            return obj; // 翻訳エンジン未設定時は英語標準のまま返却
        }

        const tr = (str) => {
            if (!str || typeof str !== 'string') return str;
            return this.translationEngine.translate(str);
        };

        const cloned = JSON.parse(JSON.stringify(obj));

        // 1. 名前の翻訳
        if (cloned.name) {
            cloned.name = tr(cloned.name);
        }

        // 2. モンスター死体・警告の翻訳
        if (cloned.corpseInfo) {
            if (cloned.corpseInfo.warningNote) {
                cloned.corpseInfo.warningNote = tr(cloned.corpseInfo.warningNote);
            }
            if (cloned.corpseInfo.grantResist) {
                cloned.corpseInfo.grantResist = tr(cloned.corpseInfo.grantResist);
            }
        }

        // 3. 戦術アドバイスの配列翻訳
        if (Array.isArray(cloned.tacticalAdvice)) {
            cloned.tacticalAdvice = cloned.tacticalAdvice.map(adv => tr(adv));
        }

        // 4. アイテム基本効果の翻訳
        if (cloned.effectSummary) {
            cloned.effectSummary = tr(cloned.effectSummary);
        }

        // 5. BUC効果の翻訳
        if (cloned.bucEffects) {
            for (const key of Object.keys(cloned.bucEffects)) {
                cloned.bucEffects[key] = tr(cloned.bucEffects[key]);
            }
        }

        // 6. 未識別ヒント & 用途アドバイスの翻訳
        if (Array.isArray(cloned.unidentifiedTips)) {
            cloned.unidentifiedTips = cloned.unidentifiedTips.map(tip => tr(tip));
        }
        if (Array.isArray(cloned.usageAdvice)) {
            cloned.usageAdvice = cloned.usageAdvice.map(adv => tr(adv));
        }

        // 7. 構造化ステータス (stats) の素材・属性の自動ローカライズ
        if (cloned.stats && cloned.stats.material) {
            cloned.stats.material = tr(cloned.stats.material);
        }

        return cloned;
    }

    /**
     * モンスター構造化ナレッジの取得
     * @param {number|string} identifier - monOffset, glyphId, または Monster Name/ID
     * @param {Object} [options] 
     * @param {boolean} [options.translate=true] - 翻訳処理を行うか
     * @returns {Object|null} モンスターナレッジ
     */
    getMonsterKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const shouldTranslate = options.translate !== false;
        let found = null;
        let monOffset = null;

        // A. 数値指定 (monOffset または glyphId)
        if (typeof identifier === 'number') {
            if (this.monOffsetMap.has(identifier)) {
                found = this.monOffsetMap.get(identifier);
            } else {
                const info = classifyGlyph(identifier);
                if (info && (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET)) {
                    monOffset = typeof info.subType === 'number' ? info.subType : identifier;
                    found = this.monOffsetMap.get(monOffset) || null;

                    // ナレッジベース未登録の通常モンスターでも tilemappings.lst (mnum) から名前を完全解決
                    if (!found && typeof monOffset === 'number' && monOffset >= 0) {
                        const monName = MONSTER_TILEMAP_NAMES[monOffset] || 'monster';
                        found = {
                            id: `mon_${monOffset}`,
                            monOffset,
                            name: monName,
                            dangerLevel: 'MEDIUM',
                            stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                            effectSummary: 'Standard dungeon monster.'
                        };
                    }
                }
            }
        }

        // B. 文字列指定 (id または Name)
        if (!found && typeof identifier === 'string') {
            const cleanKey = identifier.trim().toLowerCase().replace(/\s+/g, '_');
            found = this.monsters.get(cleanKey) || this.monsters.get(identifier.trim().toLowerCase()) || null;
        }

        if (!found) return null;

        return shouldTranslate ? this.localizeKnowledge(found) : found;
    }

    /**
     * 文字列が未識別アイテムの外見表現か判定
     * @param {string} str 
     * @returns {boolean}
     */
    isUnidentifiedAppearance(str) {
        if (!str || typeof str !== 'string') return false;
        const lower = str.toLowerCase();
        const isKind = /\b(potion|scroll|ring|wand|amulet|spellbook)\b/i.test(lower);
        const isApp = /\b(ruby|pink|smoky|clear|milky|cloudy|green|blue|red|yellow|purple|dark|bright|sparkling|effervescent|swirly|labeled|labelled|engraved|runed|wooden|copper|iron|glass|granite|marble)\b/i.test(lower);
        const isReal = /\b(healing|extra healing|full healing|gain level|digging|death|remove curse|identify|teleportation|conflict|reflection)\b/i.test(lower);
        return isKind && (isApp || !isReal);
    }

    /**
     * 未識別アイテム用の構造化ナレッジを自動生成
     * @param {string} rawName 
     * @param {Object} [options] 
     * @returns {Object} 未識別アイテムナレッジ
     */
    getUnidentifiedItemKnowledge(rawName, options = {}) {
        const lower = String(rawName).toLowerCase();
        let category = 'OTHER';
        let tips = [];

        if (lower.includes('potion')) {
            category = 'POTION';
            tips = [
                'Price ID: 50zm -> healing or poison',
                'Price ID: 100zm -> extra healing or gain level',
                'Safe test: Dip unicorn horn to neutralize poison',
                'Read Scroll of Identify for 100% safe identification'
            ];
        } else if (lower.includes('scroll')) {
            category = 'SCROLL';
            tips = [
                'Engrave test: Write Elbereth on floor then read scroll over it to identify safely',
                'Price ID: 20zm -> Scroll of Identify (Most common)',
                'Price ID: 50zm -> Scroll of Remove Curse'
            ];
        } else if (lower.includes('wand')) {
            category = 'WAND';
            tips = [
                'Engrave test: Zap or engrave on floor to identify 100% safely by message'
            ];
        } else {
            category = 'OTHER';
            tips = [
                'Unidentified item. Price ID or Scroll of Identify recommended.'
            ];
        }

        const rawObj = {
            id: 'unidentified_item',
            name: rawName,
            category,
            isUnidentified: true,
            unidentifiedTips: tips
        };

        const shouldTranslate = options.translate !== false;
        return shouldTranslate ? this.localizeKnowledge(rawObj) : rawObj;
    }

    /**
     * NetHack インベントリ表示テキストから純粋なアイテム名を自動抽出
     * 例: "a - 2 uncursed rations of cram" -> "ration of cram"
     * 例: "b - an uncursed dagger" -> "dagger"
     * @param {string} str 
     * @returns {string} クリーニングされた英語アイテム名
     */
    cleanItemName(str) {
        if (!str || typeof str !== 'string') return '';
        let s = str.trim();

        // 1. レター＆記号接頭辞除去 "a - ", "b) ", "c - "
        s = s.replace(/^[a-zA-Z]\s*[\-\)\.]\s*/, '');

        // 2. 数量除去 "2 ", "10 "
        s = s.replace(/^\d+\s+/, '');

        // 3. 祝福/呪い修飾子除去 "blessed ", "uncursed ", "cursed "
        s = s.replace(/\b(blessed|uncursed|cursed)\s+/g, '');

        // 4. 冠詞除去 "a ", "an ", "the "
        s = s.replace(/\b(a|an|the)\s+/g, '');

        // 5. 複数形 's' の除去 (例: daggers -> dagger, rations of cram -> ration of cram)
        s = s.replace(/(\w{3,})s\b/g, '$1');

        return s.trim();
    }

    /**
     * アイテム構造化ナレッジの取得 (onum を一次識別軸とし、数値/オブジェクト/文字列に対応)
     * @param {number|string|Object} identifier - onum, glyphId, Item Object, または Item Text
     * @param {Object} [options] 
     * @returns {Object|null} アイテムナレッジ
     */
    getItemKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        const shouldTranslate = options.translate !== false;
        let found = null;
        let targetOnum = -1;
        let originalDisplayName = '';

        if (typeof identifier === 'object') {
            originalDisplayName = identifier.rawText || identifier.str || identifier.label || identifier.name || '';
        } else if (typeof identifier === 'string') {
            originalDisplayName = identifier;
        }

        // 1. オブジェクト指定 ({ onum, glyph, rawGlyph, str, rawText, name, label })
        if (typeof identifier === 'object') {
            if (typeof identifier.onum === 'number' && identifier.onum >= 0) {
                targetOnum = identifier.onum;
            } else if (typeof identifier.glyph === 'number' && identifier.glyph >= 0) {
                targetOnum = getOnumFromGlyph(identifier.glyph);
            } else if (typeof identifier.rawGlyph === 'number' && identifier.rawGlyph >= 0) {
                targetOnum = getOnumFromGlyph(identifier.rawGlyph);
            }
            if (targetOnum < 0) {
                const rawName = identifier.label || identifier.rawText || identifier.str || identifier.name || '';
                return this.getItemKnowledge(rawName, options);
            }
        }
        // 2. 数値指定 (onum または glyphId)
        else if (typeof identifier === 'number') {
            if (options.isOnum === true) {
                targetOnum = identifier;
            } else {
                // 統一 Glyph 検索: glyphId (例: 3448〜3928, 7992等) から onum 抽出
                targetOnum = getOnumFromGlyph(identifier);
                if (targetOnum < 0 && identifier >= 0 && identifier < 500) {
                    targetOnum = identifier; // 直接 onum フォールバック
                }
            }
        }
        // 3. 文字列指定 ("wand_of_digging" または インベントリ文章 "a - 2 uncursed rations of cram")
        else if (typeof identifier === 'string') {
            if (this.isUnidentifiedAppearance(identifier)) {
                return this.getUnidentifiedItemKnowledge(identifier, options);
            }

            const cleaned = this.cleanItemName(identifier);
            const cleanKey = cleaned.toLowerCase().replace(/\s+/g, '_');
            
            // 手動登録辞書から検索
            found = this.items.get(cleanKey) || 
                    this.items.get(cleaned.toLowerCase()) || 
                    this.items.get(identifier.trim().toLowerCase()) || null;

            // onum 逆引きテーブル (OBJECT_TILEMAP_NAMES) からのスラッシュ分割スマート逆引き検索！
            if (!found && OBJECT_TILEMAP_NAMES) {
                const cleanLower = cleaned.toLowerCase();
                const entry = Object.entries(OBJECT_TILEMAP_NAMES).find(([onumStr, fullName]) => {
                    if (!fullName) return false;
                    const parts = fullName.toLowerCase().split('/').map(p => p.trim());
                    return parts.some(part => part === cleanLower || fullName.toLowerCase() === cleanLower);
                });
                if (entry) {
                    targetOnum = parseInt(entry[0], 10);
                }
            }

            if (!found && targetOnum < 0 && cleaned.length > 0) {
                const categoryData = inferObjectCategory(cleaned);
                found = {
                    id: `item_${cleanKey}`,
                    name: cleaned,
                    category: categoryData.category,
                    effectSummary: categoryData.effectSummary
                };
            }
        }

        // onum が定まっている場合は onumMap からナレッジを取得
        if (!found && targetOnum >= 0) {
            found = this.onumMap.get(targetOnum) || null;

            // onumMap に手動エントリーが未登録でも公式名前 & onum 範囲カテゴリから100%正確に生成！
            if (!found && OBJECT_TILEMAP_NAMES[targetOnum]) {
                const itemName = OBJECT_TILEMAP_NAMES[targetOnum];
                const catStr = getCategoryFromOnum(targetOnum);
                const adviceObj = OBJECT_CATEGORY_ADVICE[catStr] || OBJECT_CATEGORY_ADVICE.TOOL;
                found = {
                    id: `item_onum_${targetOnum}`,
                    onum: targetOnum,
                    name: itemName,
                    category: catStr,
                    effectSummary: adviceObj.effectSummary,
                    unidentifiedTips: adviceObj.unidentifiedTips
                };
            }
        }

        if (!found) return null;

        if (originalDisplayName && originalDisplayName.trim().length > 0) {
            found = {
                ...found,
                inventoryLabel: originalDisplayName
            };
        }

        return shouldTranslate ? this.localizeKnowledge(found) : found;
    }

    /**
     * 地形・仕掛けの構造化ナレッジ取得
     * @param {number|string} identifier - glyphId または 地形名/記号
     * @param {Object} [options] 
     * @returns {Object|null} 地形ナレッジ
     */
    getTerrainKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        let rawObj = null;

        if (typeof identifier === 'number') {
            const cmapInfo = getCmapInfo(identifier);
            if (cmapInfo.isStairDown) {
                rawObj = { id: 'stairs_down', name: 'Stairs Down', category: 'STAIRS', effectSummary: 'Use \'>\' or \'>\' key to descend to deeper dungeon floor.' };
            } else if (cmapInfo.isStairUp) {
                rawObj = { id: 'stairs_up', name: 'Stairs Up', category: 'STAIRS', effectSummary: 'Use \'<\' key to ascend.' };
            } else if (cmapInfo.isClosedDoor) {
                rawObj = { id: 'closed_door', name: 'Closed Door', category: 'DOOR', effectSummary: 'Use \'o\' to open, or kick with \'ctrl+d\' or \'k\'.' };
            } else if (cmapInfo.isOpenDoor) {
                rawObj = { id: 'open_door', name: 'Open Door', category: 'DOOR', effectSummary: 'Walk through or close with \'c\'.' };
            } else if (cmapInfo.isFountain) {
                rawObj = { id: 'fountain', name: 'Fountain', category: 'FOUNTAIN', effectSummary: 'Quaff with \'q\' or dip items with \'#dip\'. May grant luck, spawn a djinn, or cause poison.' };
            } else if (cmapInfo.isSink) {
                rawObj = { id: 'sink', name: 'Sink', category: 'SINK', effectSummary: 'Kick with \'ctrl+d\' or \'k\'. May drop ring, spawn pudding or water demon.' };
            } else if (cmapInfo.isAltar) {
                rawObj = { id: 'altar', name: 'Altar', category: 'ALTAR', effectSummary: 'Offer corpses with \'altar\' / offer action. Beware of non-aligned god wrath.' };
            } else if (cmapInfo.isGrave) {
                rawObj = { id: 'grave', name: 'Grave', category: 'GRAVE', effectSummary: 'Gravesite. Dig with Pick-axe for loot, but beware of Ghoul/Zombie spawn and alignment penalty.' };
            } else if (cmapInfo.isTree) {
                rawObj = { id: 'tree', name: 'Tree', category: 'TREE', effectSummary: 'Wood obstacle. Kick with \'k\' to drop fruit or chop down with Axe.' };
            } else if (cmapInfo.isLava) {
                rawObj = { id: 'lava', name: 'Lava', category: 'LAVA', effectSummary: 'Lethal fire terrain. Instantly burns player and items unless levitating.' };
            } else if (cmapInfo.isWater) {
                rawObj = { id: 'pool_of_water', name: 'Pool of Water', category: 'WATER', effectSummary: 'Water obstacle. Items get wet when walking through without levitation/water walking.' };
            } else if (cmapInfo.isIronBars) {
                rawObj = { id: 'iron_bars', name: 'Iron Bars', category: 'BARS', effectSummary: 'Impassable bars. Can pass through when polymorphed into small creature or using Wand of Opening.' };
            } else if (cmapInfo.isTrap) {
                rawObj = { id: 'trap', name: 'Trap', category: 'TRAP', effectSummary: 'Disarm or avoid. Can be covered with Elbereth or boulders.' };
            } else if (cmapInfo.isWall) {
                rawObj = { id: 'dungeon_wall', name: 'Dungeon Wall', category: 'WALL', effectSummary: 'Solid rock wall. Dig with Wand of Digging or Pick-axe.' };
            } else if (cmapInfo.isFloor) {
                rawObj = { id: 'dungeon_floor', name: 'Dungeon Floor', category: 'FLOOR', effectSummary: 'Normal floor. Can engrave Elbereth with \'E\' or \'e\'.' };
            }
        }

        if (!rawObj && typeof identifier === 'string') {
            const lower = identifier.toLowerCase();
            if (lower.includes('fountain')) {
                rawObj = { id: 'fountain', name: 'Fountain', category: 'FOUNTAIN', effectSummary: 'Quaff with \'q\' or dip items with \'#dip\'. May grant luck, spawn a djinn, or cause poison.' };
            } else if (lower.includes('sink')) {
                rawObj = { id: 'sink', name: 'Sink', category: 'SINK', effectSummary: 'Kick with \'ctrl+d\' or \'k\'. May drop ring, spawn pudding or water demon.' };
            } else if (lower.includes('stair') && lower.includes('down')) {
                rawObj = { id: 'stairs_down', name: 'Stairs Down', category: 'STAIRS', effectSummary: 'Use \'>\' key to descend to deeper dungeon floor.' };
            } else if (lower.includes('stair') && lower.includes('up')) {
                rawObj = { id: 'stairs_up', name: 'Stairs Up', category: 'STAIRS', effectSummary: 'Use \'<\' key to ascend.' };
            } else if (lower.includes('door')) {
                rawObj = { id: 'closed_door', name: 'Closed Door', category: 'DOOR', effectSummary: 'Use \'o\' to open, or kick with \'ctrl+d\' or \'k\'.' };
            } else if (lower.includes('altar')) {
                rawObj = { id: 'altar', name: 'Altar', category: 'ALTAR', effectSummary: 'Offer corpses with \'altar\' / offer action. Beware of non-aligned god wrath.' };
            } else if (lower.includes('tree')) {
                rawObj = { id: 'tree', name: 'Tree', category: 'TREE', effectSummary: 'Wood obstacle. Kick with \'k\' to drop fruit or chop down with Axe.' };
            } else if (lower.includes('lava')) {
                rawObj = { id: 'lava', name: 'Lava', category: 'LAVA', effectSummary: 'Lethal fire terrain. Instantly burns player and items unless levitating.' };
            } else if (lower.includes('wall')) {
                rawObj = { id: 'dungeon_wall', name: 'Dungeon Wall', category: 'WALL', effectSummary: 'Solid rock wall. Dig with Wand of Digging or Pick-axe.' };
            } else {
                rawObj = { id: 'dungeon_floor', name: 'Dungeon Floor', category: 'FLOOR', effectSummary: 'Normal floor. Can engrave Elbereth with \'E\' or \'e\'.' };
            }
        }

        if (!rawObj) return null;

        const shouldTranslate = options.translate !== false;
        return shouldTranslate ? this.localizeKnowledge(rawObj) : rawObj;
    }

    /**
     * 万能統合ナレッジアクセサ (アイテム -> モンスター -> 地形 -> 汎用フォールバックの自動判定取得)
     * @param {number|string|Object} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 構造化ナレッジ
     */
    getKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        // 0. 数値 glyphId の場合、まず classifyGlyph でエンティティ種別を正確に物理統一検索！
        if (typeof identifier === 'number') {
            const info = classifyGlyph(identifier);
            if (info) {
                if (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET) {
                    return this.getMonsterKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.ITEM || info.type === ENTITY_TYPES.BODY || info.type === ENTITY_TYPES.STATUE) {
                    return this.getItemKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.TERRAIN || info.type === ENTITY_TYPES.TRAP || info.type === ENTITY_TYPES.CMAP || info.type === ENTITY_TYPES.UNEXPLORED) {
                    return this.getTerrainKnowledge(identifier, options);
                }
            }
        }

        // 1. アイテムナレッジを検索
        let data = this.getItemKnowledge(identifier, options);
        if (data) return data;

        // 2. モンスターナレッジを検索
        data = this.getMonsterKnowledge(identifier, options);
        if (data) return data;

        // 3. 地形・仕掛けナレッジを検索
        data = this.getTerrainKnowledge(identifier, options);
        if (data) return data;

        // 4. 未登録エンティティに対するスマートフォールバック (プレイヤー・一般モブ・容器等)
        if (typeof identifier === 'number') {
            const info = classifyGlyph(identifier);
            if (info) {
                if (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET) {
                    const rawObj = {
                        id: 'generic_monster',
                        name: 'Standard Dungeon Monster',
                        dangerLevel: 'MEDIUM',
                        stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                        effectSummary: 'Standard dungeon creature.'
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                } else if (info.type === ENTITY_TYPES.BODY) {
                    const rawObj = {
                        id: 'corpse',
                        name: 'Corpse',
                        category: 'BODY',
                        effectSummary: 'Monster corpse. Can be eaten with \'e\' for nutrition or resistances, but beware of taint/poison.'
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                } else if (info.type === ENTITY_TYPES.STATUE) {
                    const rawObj = {
                        id: 'statue',
                        name: 'Statue',
                        category: 'STATUE',
                        effectSummary: 'Stone statue. Pick up or break with Pick-axe / Wand of Striking.'
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                } else if (info.type === ENTITY_TYPES.ITEM) {
                    const onum = getOnumFromGlyph(identifier);
                    const itemName = (typeof onum === 'number' && onum >= 0 && OBJECT_TILEMAP_NAMES[onum]) ? OBJECT_TILEMAP_NAMES[onum] : 'Dungeon Item';
                    const categoryData = inferObjectCategory(itemName);

                    const rawObj = {
                        id: `item_${onum}`,
                        name: itemName,
                        category: categoryData.category,
                        effectSummary: categoryData.effectSummary
                    };
                    return options.translate !== false ? this.localizeKnowledge(rawObj) : rawObj;
                }
            }
        }

        return null;
    }
}


