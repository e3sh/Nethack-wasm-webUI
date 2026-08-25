/**
 * OBJECT_CATEGORY_ADVICE.js
 * NetHack アイテムカテゴリ別多言語アドバイス＆Tipsデータおよびカテゴリ推定ユーティリティ
 */

export const OBJECT_CATEGORY_ADVICE = {
    POTION: {
        category: 'POTION',
        effectSummary: 'Quaff with \'q\' to apply magical effect, or dip items with \'#dip\'. Unidentified potions can be identified via Scroll of Identify, Altar testing, or Dip testing.',
        unidentifiedTips: [
            '識別の巻物を読んだり、流し台(#apply sink)や神壇でテストして鑑定するのが安全です',
            '未鑑定の薬の飲み試しは麻痺・失明・毒・変身などのリスクを伴います'
        ],
        unidentifiedTipsEn: [
            'Identify safely using a Scroll of Identify, price identification at shops, or altar BUC testing.',
            'Quaff-testing unknown potions carries risks like paralysis, blindness, poison, or polymorph.'
        ],
        usageAdvice: [
            '戦闘中の緊急回復や、余剰ポーションの#dip調合、投擲による敵への状態異常付与に活用します'
        ],
        usageAdviceEn: [
            'Use for emergency healing in combat, #dip alchemy mixing, or throwing at enemies for status effects.'
        ]
    },
    SCROLL: {
        category: 'SCROLL',
        effectSummary: 'Read with \'r\' to trigger magical spell effects. Blank scrolls can be written on with Magic Marker.',
        unidentifiedTips: [
            '安全な部屋で試読(\'r\')するか、店主の価格鑑定や識別の巻物で解明してください',
            '呪われた巻物は逆効果を発揮するためお祓い(Remove Curse)推奨'
        ],
        unidentifiedTipsEn: [
            'Read-test in a secure room, or identify via shop price identification or Scrolls of Identify.',
            'Cursed scrolls often produce harmful opposite effects; uncurse before reading.'
        ],
        usageAdvice: [
            '緊急脱出(テレポート)、装備強化、呪縛解除など、戦況を一変させる切り札として保持・使用します'
        ],
        usageAdviceEn: [
            'Keep as trump cards for emergency escapes (teleportation), equipment enchanting, or curse removal.'
        ]
    },
    WAND: {
        category: 'WAND',
        effectSummary: 'Zap with \'z\' in a direction. Engrave test on floor (\'E\') to check beam type without wasting charges.',
        unidentifiedTips: [
            '床に文字を刻むテスト(\'E\')を行うと、充填数を消費せずに効果タイプを判別できます',
            '識別の巻物で残り充填回数と効果を解明可能です'
        ],
        unidentifiedTipsEn: [
            'Engrave-test on the floor (\'E\') to identify wand type without expending any charges.',
            'Scrolls of Identify reveal both the exact magical effect and remaining charges.'
        ],
        usageAdvice: [
            '壁の掘削によるショートカット作成、遠距離からの必殺攻撃や状態異常の付与に有効です'
        ],
        usageAdviceEn: [
            'Use for digging shortcuts through walls, ranged offensive attacks, or applying lethal crowd control.'
        ]
    },
    RING: {
        category: 'RING',
        effectSummary: 'Put on with \'P\' or remove with \'R\'. Grants passive intrinsic abilities, but increases hunger rate.',
        unidentifiedTips: [
            '流し台(#apply sink)に指輪を落すと、特有の現象や音で正体が確定します',
            '呪われた指輪は外せなくなる(\'R\'不可)ため、解呪の手段を用意して装着してください'
        ],
        unidentifiedTipsEn: [
            'Drop into a sink (#apply sink) to observe unique messages and identify the ring.',
            'Cursed rings cannot be removed (\'R\'); ensure you have curse removal ready before wearing.'
        ],
        usageAdvice: [
            '探索中や戦闘時など必要な場面に応じて付け替え(\'P\'/\'R\')し、空腹度の増加を抑えます'
        ],
        usageAdviceEn: [
            'Wear (\'P\') and remove (\'R\') situationally to conserve nutrition and prevent excessive hunger.'
        ]
    },
    AMULET: {
        category: 'AMULET',
        effectSummary: 'Wear with \'W\' or take off with \'T\'. Grants vital protections such as Reflection or Life Saving.',
        unidentifiedTips: [
            '首にかける(\'W\')と強力な耐性を得られますが、絞殺のアミュレット等に注意',
            '識別の巻物で鑑定してから装着するのが最も安全です'
        ],
        unidentifiedTipsEn: [
            'Wearing (\'W\') grants powerful protections, but beware of hazardous items like Amulets of Strangulation.',
            'Identifying with a scroll before wearing is the safest approach.'
        ],
        usageAdvice: [
            '反射(Reflection)や命の魔除け(Life Saving)など、致命的な死を防ぐ中盤以降の最重要防具です'
        ],
        usageAdviceEn: [
            'Crucial mid-to-late game gear providing game-saving protection like Reflection or Life Saving.'
        ]
    },
    WEAPON: {
        category: 'WEAPON',
        effectSummary: 'Wield with \'w\' or throw with \'t\'. Skill proficiency and enchantment level directly affect damage and hit rate.',
        unidentifiedTips: [
            '装備(\'w\')して攻撃命中率やダメージの変化を確認できます',
            '呪われた武器は手に貼り付くため、神壇(Altar)で呪いチェック推奨'
        ],
        unidentifiedTipsEn: [
            'Wield (\'w\') to observe changes in hit rate and damage output.',
            'Cursed weapons weld to your hand; test BUC status on an altar before wielding.'
        ],
        usageAdvice: [
            '武器スキル熟練度を上げ、敵のサイズ(中型/大型)や耐性に応じた武器を選択します'
        ],
        usageAdviceEn: [
            'Enhance weapon skill proficiency and switch weapons based on monster size and intrinsic resistances.'
        ]
    },
    ARMOR: {
        category: 'ARMOR',
        effectSummary: 'Wear with \'W\' or take off with \'T\'. Lower AC (Armor Class) numbers provide better protection.',
        unidentifiedTips: [
            '着脱(\'W\'/\'T\')して AC の変化を確認することで強化値を推定可能',
            '神壇(Altar)の上に置くと、呪い・祝福・通常が色で判別できます'
        ],
        unidentifiedTipsEn: [
            'Wear/take off (\'W\'/\'T\') to monitor AC changes and estimate enchantment bonuses.',
            'Drop onto an altar to safely detect blessed, uncursed, or cursed status.'
        ],
        usageAdvice: [
            'ACと魔法防御(MC)を高め、詠唱ペナルティ(Metallic Armor)に注意して防具を選定します'
        ],
        usageAdviceEn: [
            'Maximize AC and Magic Cancellation (MC), keeping spellcasting penalties from metallic armor in mind.'
        ]
    },
    FOOD: {
        category: 'FOOD',
        effectSummary: 'Eat with \'e\' to restore nutrition and prevent fainting or starvation.',
        unidentifiedTips: [
            '食べる(\'e\')ことで空腹を回復します。死体は腐敗(Poison/Taint)に注意'
        ],
        unidentifiedTipsEn: [
            'Eat with \'e\' to recover nutrition. Beware of spoiled or poisonous corpses.'
        ],
        usageAdvice: [
            '空腹(Hungry)状態になってから食べ、貴重な携行食料(Ration)は温存します'
        ],
        usageAdviceEn: [
            'Wait until hungry to eat perishable corpses, saving long-lasting food rations for later.'
        ]
    },
    TOOL: {
        category: 'TOOL',
        effectSummary: 'Apply with \'#apply\' or specific hotkeys. Essential utility items for dungeon survival.',
        unidentifiedTips: [
            '\'#apply\' キーで使用し、専用の機能や探索効果を発揮します'
        ],
        unidentifiedTipsEn: [
            'Use via \'#apply\' or dedicated hotkeys to activate specialized exploration and utility features.'
        ],
        usageAdvice: [
            '鍵開け、解毒(ユニコーンの角)、照明など状況に応じたツールをショートカットで活用します'
        ],
        usageAdviceEn: [
            'Use lockpicks, unicorn horns (poison cure), and light sources dynamically for survival.'
        ]
    },
    CONTAINER: {
        category: 'CONTAINER',
        effectSummary: 'Apply with \'#apply\' to store, retrieve, or lock/unlock items. Prevents potion breakage from landmines.',
        unidentifiedTips: [
            '\'#apply\' で開閉・鍵開け・収納。貴重な薬や巻物を保護できます'
        ],
        unidentifiedTipsEn: [
            'Use \'#apply\' to open, lock/unlock, and store gear. Protects delicate potions and scrolls from damage.'
        ],
        usageAdvice: [
            '爆発トラップによるポーション破損や水濡れからアイテムを守るため袋に収納します'
        ],
        usageAdviceEn: [
            'Store vulnerable potions and scrolls in bags to shield them from explosion traps and water hazards.'
        ]
    },
    SPELLBOOK: {
        category: 'SPELLBOOK',
        effectSummary: 'Read with \'r\' to memorize spell. Requires sufficient Intelligence and energy (PW) to cast.',
        unidentifiedTips: [
            '読む(\'r\')ことで呪文を記憶します。高難度魔法書は解読に失敗すると失明等の反動があります'
        ],
        unidentifiedTipsEn: [
            'Read with \'r\' to memorize spells. Harder spellbooks carry backlash risks like blindness on failure.'
        ],
        usageAdvice: [
            '呪文詠唱の失敗率(Armor制限やInt依存)を確認し、安全な部屋で勉強(\'r\')して記憶します'
        ],
        usageAdviceEn: [
            'Check failure rate (armor penalties / Int) and study in a safe room to memorize spells.'
        ]
    },
    GEM: {
        category: 'GEM',
        effectSummary: 'Throw at monsters or sell for gold. Touchstone can distinguish real gems from worthless glass.',
        unidentifiedTips: [
            'タッチストーン(Touchstone)で引っ掻くテストをすると本物の宝石と硝子を判別可能'
        ],
        unidentifiedTipsEn: [
            'Test with a Touchstone (#apply) to distinguish genuine gems from worthless glass pieces.'
        ],
        usageAdvice: [
            'モンスターに投げつけるか売却して高額な金貨を獲得できます'
        ],
        usageAdviceEn: [
            'Throw gems at certain monsters (like unicorns) or sell them to shopkeepers for high gold payouts.'
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
