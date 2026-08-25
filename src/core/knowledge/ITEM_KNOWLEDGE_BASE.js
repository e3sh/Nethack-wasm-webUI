/**
 * ITEM_KNOWLEDGE_BASE.js
 * NetHack 先行開発アイテム構造化マスターデータ (純英語定義)
 */

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
        effectSummary: 'Magical container that drastically reduces the weight of stored items.',
        bucEffects: {
            blessed: 'Reduces weight of contents to 25%',
            uncursed: 'Reduces weight of contents to 50%',
            cursed: 'Increases weight of contents to 200%'
        },
        flavorNote: 'Essential container for hoarders and heavy loot transportation.',
        unidentifiedTips: [
            'Apply bag to insert or remove items'
        ],
        usageAdvice: [
            'CRITICAL: Never put Wand of Cancellation, Bag of Holding, or Bag of Tricks inside (causes magical explosion and destroys inventory!)',
            'Protect from fire and sharp objects'
        ]
    },
    {
        id: 'unicorn_horn',
        onum: 261,
        name: 'unicorn horn',
        category: 'TOOL',
        effectSummary: 'Tool (#apply). Cures poison, illness, blindness, confusion, and stat loss.',
        flavorNote: 'The Swiss Army knife of NetHack survival. Apply regularly to restore depleted stats.',
        usageAdvice: [
            'Apply (#apply) immediately after stat drain or poison hit',
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
