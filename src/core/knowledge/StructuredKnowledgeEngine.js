/**
 * StructuredKnowledgeEngine.js
 * NetHack 構造化ナレッジ＆ヘルプ基盤エンジン
 *
 * 【設計指針】
 * - マスターデータは「言語非依存 (英語原名 / Standard Key & English Text)」で保持。
 * - UIやコンポーネントがデータを取得する際、WebUICore の TranslationEngine を介して
 *   オンデマンドで動的に翻訳処理を行って返却する。
 */

import { classifyGlyph, getCmapInfo, getOnumFromGlyph, getCategoryFromOnum, ENTITY_TYPES, GLYPH_OFFSETS } from './glyphClassifier.js';
import { MONSTER_TILEMAP_NAMES, OBJECT_TILEMAP_NAMES } from './tilemappings_data.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';
import { ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';
import { ItemIdentificationResolver, IDENTIFICATION_LEVELS } from './ItemIdentificationResolver.js';

export const OBJECT_CATEGORY_ADVICE = {
    POTION: {
        category: 'POTION',
        effectSummary: 'Quaff with \'q\' to apply magical effect, or dip items with \'#dip\'. Unidentified potions can be identified via Scroll of Identify, Altar testing, or Dip testing.',
        unidentifiedTips: [
            '識別の巻物を読んだり、流し台(#apply sink)や神壇でテストして鑑定するのが安全です',
            '未鑑定の薬の飲み試しは麻痺・失明・毒・変身などのリスクを伴います'
        ],
        usageAdvice: [
            '戦闘中の緊急回復や、余剰ポーションの#dip調合、投擲による敵への状態異常付与に活用します'
        ]
    },
    SCROLL: {
        category: 'SCROLL',
        effectSummary: 'Read with \'r\' to trigger magical spell effects. Blank scrolls can be written on with Magic Marker.',
        unidentifiedTips: [
            '安全な部屋で試読(\'r\')するか、店主の価格鑑定や識別の巻物で解明してください',
            '呪われた巻物は逆効果を発揮するためお祓い(Remove Curse)推奨'
        ],
        usageAdvice: [
            '緊急脱出(テレポート)、装備強化、呪縛解除など、戦況を一変させる切り札として保持・使用します'
        ]
    },
    WAND: {
        category: 'WAND',
        effectSummary: 'Zap with \'z\' in a direction. Engrave test on floor (\'E\') to check beam type without wasting charges.',
        unidentifiedTips: [
            '床に文字を刻むテスト(\'E\')を行うと、充填数を消費せずに効果タイプを判別できます',
            '識別の巻物で残り充填回数と効果を解明可能です'
        ],
        usageAdvice: [
            '壁の掘削によるショートカット作成、遠距離からの必殺攻撃や状態異常の付与に有効です'
        ]
    },
    RING: {
        category: 'RING',
        effectSummary: 'Put on with \'P\' or remove with \'R\'. Grants passive intrinsic abilities, but increases hunger rate.',
        unidentifiedTips: [
            '流し台(#apply sink)に指輪を落すと、特有の現象や音で正体が確定します',
            '呪われた指輪は外せなくなる(\'R\'不可)ため、解呪の手段を用意して装着してください'
        ],
        usageAdvice: [
            '探索中や戦闘時など必要な場面に応じて付け替え(\'P\'/\'R\')し、空腹度の増加を抑えます'
        ]
    },
    AMULET: {
        category: 'AMULET',
        effectSummary: 'Wear with \'W\' or take off with \'T\'. Grants vital protections such as Reflection or Life Saving.',
        unidentifiedTips: [
            '首にかける(\'W\')と強力な耐性を得られますが、絞殺のアミュレット等に注意',
            '識別の巻物で鑑定してから装着するのが最も安全です'
        ],
        usageAdvice: [
            '反射(Reflection)や命の魔除け(Life Saving)など、致命的な死を防ぐ中盤以降の最重要防具です'
        ]
    },
    WEAPON: {
        category: 'WEAPON',
        effectSummary: 'Wield with \'w\' or throw with \'t\'. Skill proficiency and enchantment level directly affect damage and hit rate.',
        unidentifiedTips: [
            '装備(\'w\')して攻撃命中率やダメージの変化を確認できます',
            '呪われた武器は手に貼り付くため、神壇(Altar)で呪いチェック推奨'
        ],
        usageAdvice: [
            '武器スキル熟練度を上げ、敵のサイズ(中型/大型)や耐性に応じた武器を選択します'
        ]
    },
    ARMOR: {
        category: 'ARMOR',
        effectSummary: 'Wear with \'W\' or take off with \'T\'. Lower AC (Armor Class) numbers provide better protection.',
        unidentifiedTips: [
            '着脱(\'W\'/\'T\')して AC の変化を確認することで強化値を推定可能',
            '神壇(Altar)の上に置くと、呪い・祝福・通常が色で判別できます'
        ],
        usageAdvice: [
            'ACと魔法防御(MC)を高め、詠唱ペナルティ(Metallic Armor)に注意して防具を選定します'
        ]
    },
    FOOD: {
        category: 'FOOD',
        effectSummary: 'Eat with \'e\' to restore nutrition and prevent fainting or starvation.',
        unidentifiedTips: [
            '食べる(\'e\')ことで空腹を回復します。死体は腐敗(Poison/Taint)に注意'
        ],
        usageAdvice: [
            '空腹(Hungry)状態になってから食べ、貴重な携行食料(Ration)は温存します'
        ]
    },
    TOOL: {
        category: 'TOOL',
        effectSummary: 'Apply with \'#apply\' or specific hotkeys. Essential utility items for dungeon survival.',
        unidentifiedTips: [
            '\'#apply\' キーで使用し、専用の機能や探索効果を発揮します'
        ],
        usageAdvice: [
            '鍵開け、解毒(ユニコーンの角)、照明など状況に応じたツールをショートカットで活用します'
        ]
    },
    CONTAINER: {
        category: 'CONTAINER',
        effectSummary: 'Apply with \'#apply\' to store, retrieve, or lock/unlock items. Prevents potion breakage from landmines.',
        unidentifiedTips: [
            '\'#apply\' で開閉・鍵開け・収納。貴重な薬や巻物を保護できます'
        ],
        usageAdvice: [
            '爆発トラップによるポーション破損や水濡れからアイテムを守るため袋に収納します'
        ]
    },
    SPELLBOOK: {
        category: 'SPELLBOOK',
        effectSummary: 'Read with \'r\' to memorize spell. Requires sufficient Intelligence and energy (PW) to cast.',
        unidentifiedTips: [
            '読む(\'r\')ことで呪文を記憶します。高難度魔法書は解読に失敗すると失明等の反動があります'
        ],
        usageAdvice: [
            '呪文詠唱の失敗率(Armor制限やInt依存)を確認し、安全な部屋で勉強(\'r\')して記憶します'
        ]
    },
    GEM: {
        category: 'GEM',
        effectSummary: 'Throw at monsters or sell for gold. Touchstone can distinguish real gems from worthless glass.',
        unidentifiedTips: [
            'タッチストーン(Touchstone)で引っ掻くテストをすると本物の宝石と硝子を判別可能'
        ],
        usageAdvice: [
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
        this.discoveryStateManager = options.discoveryStateManager || null;

        // マスターデータの初期化インデックス構築
        this._initDatabase();
    }

    /**
     * DiscoveryStateManager インスタンスの設定/更新
     * @param {Object} discoveryStateManager 
     */
    setDiscoveryStateManager(discoveryStateManager) {
        this.discoveryStateManager = discoveryStateManager;
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
        // 0. MONSTER_TILEMAP_NAMES (全 384 モンスター: monOffset 0〜382) をあらかじめ 100% monOffsetMap にデフォルトインデックス登録！
        if (MONSTER_TILEMAP_NAMES) {
            for (const [mnumStr, fullName] of Object.entries(MONSTER_TILEMAP_NAMES)) {
                const mnum = parseInt(mnumStr, 10);
                if (!isNaN(mnum)) {
                    const monName = fullName ? fullName.split('/')[0].trim() : `Monster ${mnum}`;
                    this.monOffsetMap.set(mnum, {
                        id: `mon_${mnum}`,
                        monOffset: mnum,
                        name: monName,
                        dangerLevel: 'MEDIUM',
                        stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                        effectSummary: 'Standard dungeon monster.'
                    });
                }
            }
        }

        // 1. MONSTER_KNOWLEDGE_BASE (詳細設定辞書) で詳細データを上書きインデックス登録
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
            if (options.isMonOffset === true || (identifier >= 0 && identifier < 383)) {
                monOffset = identifier;
            } else {
                const info = classifyGlyph(identifier);
                if (info && (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET)) {
                    monOffset = typeof info.subType === 'number' ? info.subType : identifier;
                }
            }

            if (typeof monOffset === 'number' && monOffset >= 0) {
                found = this.monOffsetMap.get(monOffset) || null;
                if (!found && MONSTER_TILEMAP_NAMES[monOffset]) {
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

        // B. 文字列指定 (id または Name)
        if (!found && typeof identifier === 'string') {
            let clean = identifier.trim().toLowerCase();
            // "human samurai called Hero" -> "samurai" や "a peaceful Lord Carnarvon" -> "lord carnarvon" のクリーニング
            clean = clean.replace(/\bcalled\s+[^\s\(\)]+/gi, '')
                         .replace(/\bnamed\s+[^\s\(\)]+/gi, '')
                         .replace(/\b(an?|the|human|elf|dwarf|gnome|orc|peaceful|tamed|friendly|hostile)\b/gi, '')
                         .replace(/[\(\)]/g, '')
                         .trim();

            const cleanKey = clean.replace(/\s+/g, '_');
            found = this.monsters.get(cleanKey) || this.monsters.get(clean) || this.monsters.get(identifier.trim().toLowerCase()) || null;

            if (!found && MONSTER_TILEMAP_NAMES) {
                const entry = Object.entries(MONSTER_TILEMAP_NAMES).find(([mOffset, fullName]) => {
                    if (!fullName) return false;
                    const parts = fullName.toLowerCase().split('/').map(p => p.trim());
                    return parts.some(part => part === clean || (clean.length >= 3 && part.includes(clean)) || (clean.length >= 3 && clean.includes(part)));
                });
                if (entry) {
                    monOffset = parseInt(entry[0], 10);
                    found = this.monOffsetMap.get(monOffset) || {
                        id: `mon_${monOffset}`,
                        monOffset,
                        name: entry[1].split('/')[0].trim(),
                        dangerLevel: 'MEDIUM',
                        stats: { hd: 1, ac: 10, speed: 12, mr: 0 },
                        effectSummary: 'Standard dungeon monster.'
                    };
                }
            }

            // 未知の個人名表記（店主等）の場合、options.isShopkeeper や glyph 判定から shopkeeper (monOffset 271) へフォールバック
            if (!found) {
                const isSk = options.isShopkeeper || (typeof options.glyph === 'number' && classifyGlyph(options.glyph)?.isShopkeeper);
                if (isSk) {
                    found = this.monOffsetMap.get(271) || null;
                }
            }
        }

        if (!found) return null;

        // 動的状態 (dynamicState / cell / isPet / isPlayer) による脅威度の補正計算
        const result = { type: 'MONSTER', category: 'MONSTER', ...found };

        // 🏪 店主 (Shopkeeper: 271) で Look 応答の個人名テキストが存在する場合、表示名を統合解決 ("Lord Carnarvon (Shopkeeper)")
        if (found.monOffset === 271 || found.id === 'shopkeeper' || found.name === 'shopkeeper') {
            const rawText = options.dynamicState?.rawText || (typeof identifier === 'string' ? identifier : '');
            if (rawText) {
                const personName = rawText
                    .replace(/\b(floor of a room|dark part of a room|corridor|open door|closed door|staircase|solid rock|wall)\b/gi, '')
                    .replace(/\b(an?|the|peaceful|tamed|friendly|hostile)\b/gi, '')
                    .replace(/[\(\)]/g, '')
                    .trim();
                if (personName && personName.toLowerCase() !== 'shopkeeper' && personName.toLowerCase() !== '店主') {
                    result.personalName = personName;
                    result.name = `${personName} (Shopkeeper)`;
                }
            }
        }
        const isPet = options.isPet || (typeof identifier === 'number' && classifyGlyph(identifier)?.type === ENTITY_TYPES.PET);
        const isPlayer = options.isPlayer || false;
        const dynamicState = options.dynamicState || null;

        if (isPlayer) {
            result.dangerLevel = 'NONE';
            result.dispositionStatus = 'PLAYER';
        } else if (isPet) {
            result.dangerLevel = 'SAFE';
            result.dispositionStatus = 'TAMED';
        } else if (dynamicState && dynamicState.hasResult !== false && (dynamicState.isPeaceful || dynamicState.isTamed || dynamicState.isHostile)) {
            if (dynamicState.isPeaceful) {
                result.dangerLevel = 'SAFE';
                result.dispositionStatus = 'PEACEFUL';
            } else if (dynamicState.isTamed) {
                result.dangerLevel = 'SAFE';
                result.dispositionStatus = 'TAMED';
            } else if (dynamicState.isHostile) {
                result.dangerLevel = found.dangerLevel || 'LETHAL';
                result.dispositionStatus = 'HOSTILE';
            } else if (found.defaultPeaceful) {
                result.dangerLevel = 'SAFE';
                result.dispositionStatus = 'DEFAULT_PEACEFUL';
            } else {
                result.dispositionStatus = 'HOSTILE';
            }
        } else if (found.defaultPeaceful) {
            result.dangerLevel = 'SAFE';
            result.dispositionStatus = 'DEFAULT_PEACEFUL';
        } else {
            // 🎯 一般のダンジョンモンスターはデフォルト敵対的 (HOSTILE)
            result.dispositionStatus = 'HOSTILE';
        }

        result.canBeUnidentified = false;

        return shouldTranslate ? this.localizeKnowledge(result) : result;
    }

    /**
     * 文字列が未識別アイテムの外見表現か判定
     * @param {string} str 
     * @returns {boolean}
     */
    isUnidentifiedAppearance(str) {
        if (!str || typeof str !== 'string') return false;
        const res = ItemIdentificationResolver.resolve(str);
        return Boolean(res.isUnidentified);
    }

    /**
     * 未識別アイテム用の構造化ナレッジを自動生成
     * @param {string|Object} rawInput 
     * @param {Object} [options] 
     * @returns {Object} 未識別アイテムナレッジ
     */
    getUnidentifiedItemKnowledge(rawInput, options = {}) {
        const idRes = (rawInput && typeof rawInput === 'object' && rawInput.idLevel)
            ? rawInput
            : ItemIdentificationResolver.resolve(rawInput);

        const category = idRes.category || 'OTHER';
        const adviceObj = OBJECT_CATEGORY_ADVICE[category] || OBJECT_CATEGORY_ADVICE.TOOL;
        const tips = (idRes.identificationTips && idRes.identificationTips.length > 0)
            ? idRes.identificationTips
            : (adviceObj.unidentifiedTips || []);

        const rawObj = {
            id: `unidentified_${category.toLowerCase()}`,
            name: idRes.displayName || idRes.appearanceName || (typeof rawInput === 'string' ? rawInput : (rawInput.name || rawInput.str || 'Unidentified item')),
            category,
            isUnidentified: true,
            appearanceName: idRes.appearanceName,
            calledName: idRes.calledName,
            bucStatus: idRes.bucStatus,
            effectSummary: adviceObj.effectSummary || 'Unidentified item. Price ID or Scroll of Identify recommended.',
            unidentifiedTips: tips,
            usageAdvice: [],
            canBeUnidentified: true,
            identification: idRes
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

        // 1. オブジェクト指定 ({ onum, subType, glyph, rawGlyph, str, rawText, name, label })
        if (typeof identifier === 'object' && identifier !== null) {
            const rawName = identifier.label || identifier.rawText || identifier.str || identifier.name || '';
            if (rawName && this.isUnidentifiedAppearance(rawName)) {
                return this.getUnidentifiedItemKnowledge(rawName, options);
            }
            if (identifier.onum === 476 || identifier.subType === 476 || (identifier.name && identifier.name.toLowerCase() === 'statue')) {
                return this.getStatueKnowledge(identifier, options);
            }
            if (typeof identifier.onum === 'number' && identifier.onum >= 0) {
                targetOnum = identifier.onum;
            } else if (typeof identifier.subType === 'number' && identifier.subType >= 0 && identifier.subType < 500) {
                targetOnum = identifier.subType;
            } else if (typeof identifier.glyph === 'number' && identifier.glyph >= 0) {
                targetOnum = getOnumFromGlyph(identifier.glyph);
                if (targetOnum < 0 && identifier.glyph < 500) targetOnum = identifier.glyph;
            } else if (typeof identifier.rawGlyph === 'number' && identifier.rawGlyph >= 0) {
                targetOnum = getOnumFromGlyph(identifier.rawGlyph);
                if (targetOnum < 0 && identifier.rawGlyph < 500) targetOnum = identifier.rawGlyph;
            }
            if (targetOnum < 0) {
                const rawName = identifier.label || identifier.rawText || identifier.str || identifier.name || '';
                if (rawName) return this.getItemKnowledge(rawName, options);
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
                if (categoryData && (categoryData.category !== 'TOOL' || options.allowFallback === true)) {
                    found = {
                        id: `item_${cleanKey}`,
                        name: cleaned,
                        category: categoryData.category,
                        effectSummary: categoryData.effectSummary
                    };
                }
            }
        }

        // onum が定まっている場合は onumMap からナレッジを取得
        if (!found && targetOnum >= 0) {
            // 🕵️ DiscoveryStateManager による未識別床アイテムのネタバレ防止ガード
            if (this.discoveryStateManager && options.forceFullKnowledge !== true) {
                if (!this.discoveryStateManager.isIdentified(targetOnum)) {
                    const catStr = getCategoryFromOnum(targetOnum);
                    const randomizableCats = ['POTION', 'SCROLL', 'WAND', 'RING', 'AMULET', 'SPELLBOOK'];
                    if (randomizableCats.includes(catStr)) {
                        return this.getUnidentifiedItemKnowledge({ category: catStr, onum: targetOnum, name: originalDisplayName || `Unidentified ${catStr}` }, options);
                    }
                }
            }

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
                    unidentifiedTips: adviceObj.unidentifiedTips,
                    usageAdvice: adviceObj.usageAdvice || []
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

        if (typeof identifier === 'object') {
            const glyphId = (typeof identifier.glyph === 'number') ? identifier.glyph : (identifier.rawGlyph ?? -1);
            return this.getTerrainKnowledge(glyphId >= 0 ? glyphId : (identifier.name || identifier.id || ''), options);
        }

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
            if (lower.includes('fountain') || lower.includes('噴水')) {
                rawObj = { id: 'fountain', name: 'Fountain', category: 'FOUNTAIN', effectSummary: 'Quaff with \'q\' or dip items with \'#dip\'. May grant luck, spawn a djinn, or cause poison.' };
            } else if (lower.includes('sink') || lower.includes('流し')) {
                rawObj = { id: 'sink', name: 'Sink', category: 'SINK', effectSummary: 'Kick with \'ctrl+d\' or \'k\'. May drop ring, spawn pudding or water demon.' };
            } else if ((lower.includes('stair') || lower.includes('階段')) && (lower.includes('down') || lower.includes('下'))) {
                rawObj = { id: 'stairs_down', name: 'Stairs Down', category: 'STAIRS', effectSummary: 'Use \'>\' key to descend to deeper dungeon floor.' };
            } else if ((lower.includes('stair') || lower.includes('階段')) && (lower.includes('up') || lower.includes('上'))) {
                rawObj = { id: 'stairs_up', name: 'Stairs Up', category: 'STAIRS', effectSummary: 'Use \'<\' key to ascend.' };
            } else if (lower.includes('door') || lower.includes('扉') || lower.includes('ドア')) {
                rawObj = { id: 'closed_door', name: 'Closed Door', category: 'DOOR', effectSummary: 'Use \'o\' to open, or kick with \'ctrl+d\' or \'k\'.' };
            } else if (lower.includes('altar') || lower.includes('祭壇')) {
                rawObj = { id: 'altar', name: 'Altar', category: 'ALTAR', effectSummary: 'Offer corpses with \'altar\' / offer action. Beware of non-aligned god wrath.' };
            } else if (lower.includes('grave') || lower.includes('墓')) {
                rawObj = { id: 'grave', name: 'Grave', category: 'GRAVE', effectSummary: 'Gravesite. Dig with Pick-axe for loot, but beware of Ghoul/Zombie spawn and alignment penalty.' };
            } else if (lower.includes('tree') || lower.includes('木')) {
                rawObj = { id: 'tree', name: 'Tree', category: 'TREE', effectSummary: 'Wood obstacle. Kick with \'k\' to drop fruit or chop down with Axe.' };
            } else if (lower.includes('lava') || lower.includes('溶岩')) {
                rawObj = { id: 'lava', name: 'Lava', category: 'LAVA', effectSummary: 'Lethal fire terrain. Instantly burns player and items unless levitating.' };
            } else if (lower.includes('water') || lower.includes('pool') || lower.includes('水')) {
                rawObj = { id: 'pool_of_water', name: 'Pool of Water', category: 'WATER', effectSummary: 'Water obstacle. Items get wet when walking through without levitation/water walking.' };
            } else if (lower.includes('bars') || lower.includes('鉄格子')) {
                rawObj = { id: 'iron_bars', name: 'Iron Bars', category: 'BARS', effectSummary: 'Impassable bars. Can pass through when polymorphed into small creature or using Wand of Opening.' };
            } else if (lower.includes('trap') || lower.includes('罠')) {
                rawObj = { id: 'trap', name: 'Trap', category: 'TRAP', effectSummary: 'Disarm or avoid. Can be covered with Elbereth or boulders.' };
            } else if (lower.includes('wall') || lower.includes('壁')) {
                rawObj = { id: 'dungeon_wall', name: 'Dungeon Wall', category: 'WALL', effectSummary: 'Solid rock wall. Dig with Wand of Digging or Pick-axe.' };
            } else if (lower.includes('floor') || lower.includes('床') || lower.includes('room') || lower.includes('corridor') || lower.includes('dark part')) {
                rawObj = { id: 'dungeon_floor', name: 'Dungeon Floor', category: 'FLOOR', effectSummary: 'Normal floor. Can engrave Elbereth with \'E\' or \'e\'.' };
            }
        }

        if (!rawObj) return null;
        rawObj.canBeUnidentified = false;

        const shouldTranslate = options.translate !== false;
        return shouldTranslate ? this.localizeKnowledge(rawObj) : rawObj;
    }

    /**
     * 死体 (Corpse) の構造化ナレッジ取得
     * @param {number|Object|string} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 死体ナレッジ
     */
    getCorpseKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        let glyphId = -1;
        let monOffset = -1;
        let rawName = '';

        if (typeof identifier === 'object') {
            glyphId = typeof identifier.glyph === 'number' ? identifier.glyph : (identifier.rawGlyph ?? -1);
            rawName = identifier.name || identifier.str || identifier.rawText || '';
        } else if (typeof identifier === 'number') {
            glyphId = identifier;
        } else if (typeof identifier === 'string') {
            rawName = identifier;
        }

        if (typeof identifier === 'object' && identifier !== null) {
            if (typeof identifier.subType === 'number' && identifier.subType >= 0) {
                monOffset = identifier.subType % 383;
            }
        }

        if (monOffset < 0) {
            if (glyphId >= GLYPH_OFFSETS.GLYPH_BODY_OFF && glyphId < GLYPH_OFFSETS.GLYPH_RIDDEN_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_BODY_OFF) % 383;
            } else if (glyphId >= GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF && glyphId < GLYPH_OFFSETS.GLYPH_STATUE_MALE_PILETOP_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_BODY_PILETOP_OFF) % 383;
            }
        }

        let monKnowledge = null;
        if (monOffset >= 0) {
            monKnowledge = this.getMonsterKnowledge(monOffset, { ...options, isMonOffset: true });
        } else if (rawName) {
            const cleanMonName = rawName.replace(/corpse/i, '').replace(/dead/i, '').replace(/死体/g, '').trim();
            if (cleanMonName.length > 0) {
                monKnowledge = this.getMonsterKnowledge(cleanMonName, options);
            }
        }

        const baseName = monKnowledge ? monKnowledge.name : (monOffset >= 0 ? `Monster ${monOffset}` : '');
        const corpseName = baseName ? `${baseName} の死体 (corpse)` : '死体 (corpse)';

        const corpseObj = {
            id: `corpse_${monOffset >= 0 ? monOffset : 'unknown'}`,
            name: corpseName,
            category: 'CORPSE',
            canBeUnidentified: false,
            corpseInfo: monKnowledge?.corpseInfo || null,
            effectSummary: monKnowledge?.corpseInfo?.warningNote ? 
                `食中毒・呪い警告: ${monKnowledge.corpseInfo.warningNote}` : 
                (baseName ? `モンスター (${baseName}) の死体です。食料として食べるか、祭壇で捧げることができます。` : 'モンスターの死体です。食料として食べるか、祭壇で捧げることができます。')
        };

        const shouldTranslate = options.translate !== false;
        return shouldTranslate ? this.localizeKnowledge(corpseObj) : corpseObj;
    }

    /**
     * 石像 (Statue) の構造化ナレッジ取得
     * @param {number|string|Object} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 石像ナレッジ
     */
    getStatueKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        let glyphId = -1;
        let monOffset = -1;
        let rawName = '';

        if (typeof identifier === 'object') {
            glyphId = typeof identifier.glyph === 'number' ? identifier.glyph : 
                      (typeof identifier.rawGlyph === 'number' ? identifier.rawGlyph :
                      (typeof identifier.glyphInfo?.glyph === 'number' ? identifier.glyphInfo.glyph : -1));
            rawName = identifier.name || identifier.str || identifier.rawText || identifier.label || '';

            // subType が 476 (アイテム番号) 以外の 0〜382 (モンスター番号) の場合のみ monOffset とする
            if (typeof identifier.subType === 'number' && identifier.subType >= 0 && identifier.subType < 383) {
                monOffset = identifier.subType;
            }
        } else if (typeof identifier === 'number') {
            glyphId = identifier;
        } else if (typeof identifier === 'string') {
            rawName = identifier;
        }

        if (monOffset < 0 && glyphId >= 0) {
            if (glyphId >= GLYPH_OFFSETS.GLYPH_STATUE_PILETOP_OFF && glyphId < GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_STATUE_PILETOP_OFF) % 383;
            } else if (glyphId >= GLYPH_OFFSETS.GLYPH_STATUE_OFF && glyphId < GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF) {
                monOffset = (glyphId - GLYPH_OFFSETS.GLYPH_STATUE_OFF) % 383;
            }
        }

        let monKnowledge = null;
        if (monOffset >= 0) {
            monKnowledge = this.getMonsterKnowledge(monOffset, { ...options, isMonOffset: true });
        } else if (rawName) {
            const cleanMonName = rawName.replace(/statue\s*(of)?/i, '').replace(/像/g, '').trim();
            if (cleanMonName.length > 0) {
                monKnowledge = this.getMonsterKnowledge(cleanMonName, options);
            }
        }

        const baseName = monKnowledge ? monKnowledge.name : (monOffset >= 0 ? `Monster ${monOffset}` : '');
        const statueName = baseName ? `${baseName} の像 (statue)` : '石像 (statue)';

        const statueObj = {
            id: `statue_${monOffset >= 0 ? monOffset : 'unknown'}`,
            name: statueName,
            category: 'STATUE',
            canBeUnidentified: false,
            effectSummary: baseName ? 
                `モンスター (${baseName}) の石像です。ツルハシ(#apply pick-axe)や打撃の杖(Wand of Striking)で破壊するか、持ち運ぶことができます。` :
                `石像です。ツルハシ(#apply pick-axe)や打撃の杖(Wand of Striking)で破壊するか、持ち運ぶことができます。`
        };

        const shouldTranslate = options.translate !== false;
        return shouldTranslate ? this.localizeKnowledge(statueObj) : statueObj;
    }

    /**
     * 万能統合ナレッジアクセサ (アイテム -> モンスター -> 地形 -> 汎用フォールバックの自動判定取得)
     * @param {number|string|Object} identifier 
     * @param {Object} [options] 
     * @returns {Object|null} 構造化ナレッジ
     */
    getKnowledge(identifier, options = {}) {
        if (identifier === null || identifier === undefined) return null;

        // 🎯 -1. すでに完成した構造化ナレッジオブジェクト (category 及び effectSummary を保持) の場合、二重検索で破壊せずにそのまま返却！
        if (typeof identifier === 'object' && identifier !== null && identifier.category && identifier.effectSummary) {
            return identifier;
        }

        // 🎯 0. オブジェクト型指定の場合、type プロパティ (BODY, STATUE, TERRAIN, MONSTER, ITEM) に基づき最優先で直撃分岐！
        if (typeof identifier === 'object' && identifier !== null) {
            if (identifier.type === 'BODY') {
                return this.getCorpseKnowledge(identifier, options);
            }
            if (identifier.type === 'STATUE' || identifier.subType === 476 || identifier.onum === 476 || (identifier.name && identifier.name.toLowerCase() === 'statue')) {
                return this.getStatueKnowledge(identifier, options);
            }
            if (identifier.type === 'TERRAIN' || identifier.type === 'UNEXPLORED') {
                return this.getTerrainKnowledge(identifier, options);
            }
            if (identifier.type === 'MONSTER' || identifier.type === 'PET') {
                return this.getMonsterKnowledge(identifier, options);
            }
            if (identifier.type === 'ITEM') {
                return this.getItemKnowledge(identifier, options);
            }
        }

        // 1. 数値 glyphId の場合、まず classifyGlyph でエンティティ種別を正確に物理統一検索！
        if (typeof identifier === 'number') {
            const info = classifyGlyph(identifier);
            if (info) {
                if (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET) {
                    return this.getMonsterKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.BODY) {
                    return this.getCorpseKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.STATUE) {
                    return this.getStatueKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.ITEM) {
                    return this.getItemKnowledge(identifier, options);
                } else if (info.type === ENTITY_TYPES.TERRAIN || info.type === ENTITY_TYPES.TRAP || info.type === ENTITY_TYPES.CMAP || info.type === ENTITY_TYPES.UNEXPLORED) {
                    return this.getTerrainKnowledge(identifier, options);
                }
            }
        }

        // 1.5. 文字列または型指定のないオブジェクトの場合のキー抽出とキーワード優先分岐
        let searchKey = '';
        if (typeof identifier === 'string') {
            searchKey = identifier;
        } else if (typeof identifier === 'object' && identifier !== null) {
            searchKey = identifier.name || identifier.label || identifier.str || identifier.rawText || identifier.id || '';
        }

        if (typeof searchKey === 'string' && searchKey.trim().length > 0) {
            const lowerKey = searchKey.toLowerCase();

            // 石像 (Statue) の優先判定
            if (lowerKey.includes('statue') || lowerKey.includes('石像') || lowerKey.includes('像')) {
                const statueData = this.getStatueKnowledge(identifier, options);
                if (statueData) return statueData;
            }

            // 死体 (Corpse/Body) の優先判定
            if (lowerKey.includes('corpse') || lowerKey.includes('死体')) {
                const corpseData = this.getCorpseKnowledge(identifier, options);
                if (corpseData) return corpseData;
            }

            // 地形 (Terrain/Cmap) の優先判定
            if (lowerKey.includes('fountain') || lowerKey.includes('噴水') ||
                lowerKey.includes('sink') || lowerKey.includes('流し') ||
                lowerKey.includes('wall') || lowerKey.includes('壁') ||
                lowerKey.includes('floor') || lowerKey.includes('床') ||
                lowerKey.includes('stair') || lowerKey.includes('階段') ||
                lowerKey.includes('door') || lowerKey.includes('扉') || lowerKey.includes('ドア') ||
                lowerKey.includes('altar') || lowerKey.includes('祭壇') ||
                lowerKey.includes('grave') || lowerKey.includes('墓') ||
                lowerKey.includes('tree') || lowerKey.includes('木') ||
                lowerKey.includes('lava') || lowerKey.includes('溶岩') ||
                lowerKey.includes('water') || lowerKey.includes('pool') || lowerKey.includes('水') ||
                lowerKey.includes('bars') || lowerKey.includes('鉄格子') ||
                lowerKey.includes('trap') || lowerKey.includes('罠')) {
                const terrainData = this.getTerrainKnowledge(searchKey, options);
                if (terrainData) return terrainData;
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


