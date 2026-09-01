/**
 * CHEMISTRY_KNOWLEDGE_BASE.js
 * NetHack 5.0 (3.7) アイテム・環境ケミストリー構造化ナレッジマスター (SSOT)
 *
 * 単体アイテム・単体地形の枠を超えた「相互作用・レシピ・事故防止ルール」の単一真実源。
 * 各種エンジン（TacticalAdvisor, AssistSignalSynthesizer, ContextActionEngine, ITEM_INTERACTION_RULES）が
 * 本マスターデータを共通消費し、ハードコードや仕様乖離を根絶する。
 */

export const CHEMISTRY_INTERACTIONS = [
    // =========================================================================
    // 1. 地形 × アイテム相互作用 (Terrain × Item Interactions)
    // =========================================================================

    // 1-1. 流し台での指輪落とし識別 (Sink Ring Drop Test)
    {
        id: 'CHEMISTRY_SINK_DROP_RING',
        category: 'TERRAIN_ITEM',
        terrain: 'sink',
        trigger: {
            terrainType: 'sink',
            itemCategory: 'RING',
            requiresUnidentified: true
        },
        action: {
            verb: 'd',
            keySequence: ['d', '${ringLetter}'],
            charStr: 'd',
            labelEn: 'Drop ring in sink (d)',
            labelJa: '指輪を流し台に落として識別 (d)',
            extCmd: 'drop',
            target: 'feet',
            risk: 'CRITICAL',
            consumesItem: true
        },
        effect: {
            type: 'TYPE_IDENTIFY',
            topic: 'IDENTIFICATION',
            consumesItem: true,
            noteEn: 'The ring falls down the drain and is lost forever. Type-identifies the ring based on sound/effect.',
            noteJa: '落とした指輪は排水管に流れて完全に消滅します。効果音・反応から指輪の種類を判別（タイプ識別）します。'
        },
        messages: {
            adviceEn: '💍 Sink Ring Test: Drop unidentified ring [${ringLetter}] down the sink (\'d\') to identify it. WARNING: The dropped ring is lost forever down the drain!',
            adviceJa: '💍 流し台鑑定: 未識別の指輪 [${ringLetter}] を流し台に落とす(\'d\')と種類を識別できます。※落とした現物は消滅するため、ダブりや不要な指輪で試してください。',
            descriptionEn: 'Drop an unidentified ring down the sink drain to type-identify it. The ring is lost forever.',
            descriptionJa: '未識別の指輪を流し台の排水口に落とし、固有の反応から種類を識別します（現物は失われます）。'
        }
    },

    // 1-2. 神壇での呪い・祝福判定 (Altar BUC Drop Test)
    {
        id: 'CHEMISTRY_ALTAR_BUC_DROP',
        category: 'TERRAIN_ITEM',
        terrain: 'altar',
        trigger: {
            terrainType: 'altar',
            requiresUncheckedBuc: true
        },
        action: {
            verb: 'd',
            keySequence: ['d', '${itemLetter}'],
            charStr: 'd',
            labelEn: 'Drop on altar for BUC test (d)',
            labelJa: '神壇に置いて呪い判定 (d)',
            extCmd: 'drop',
            target: 'feet',
            risk: null,
            consumesItem: false
        },
        effect: {
            type: 'BUC_IDENTIFY',
            topic: 'IDENTIFICATION',
            consumesItem: false,
            noteEn: 'Items dropped on altar flash (amber/gold for blessed, black/unholy for cursed) without cost.',
            noteJa: '神壇に置いたアイテムは光の色（琥珀=祝福/黒=呪い）でBUC状態を安全に判別できます。'
        },
        messages: {
            adviceEn: '✨ Altar BUC Test: Drop items on the altar (\'d\') to identify Blessed/Uncursed/Cursed status safely via flash colors.',
            adviceJa: '✨ 神壇検知: 神壇の上にアイテムを置く(\'d\')と、光の色(琥珀=祝福/黒=呪い)でBUC状態を安全に判別できます。',
            descriptionEn: 'Drop an item onto the altar to test its Blessed / Uncursed / Cursed (BUC) status.',
            descriptionJa: '手持ちの未判定アイテムを神壇の上に落とし、光の演出から祝福・呪いを判別します。'
        }
    },

    // 1-3. 神壇への死体捧げ物 (Altar Corpse Sacrifice)
    {
        id: 'CHEMISTRY_ALTAR_OFFER_CORPSE',
        category: 'TERRAIN_ITEM',
        terrain: 'altar',
        trigger: {
            terrainType: 'altar',
            hasCorpse: true
        },
        action: {
            verb: '#offer',
            keySequence: ['#', 'offer'],
            charStr: '#offer',
            labelEn: 'Offer sacrifice (#offer)',
            labelJa: '神壇に死体を捧げる (#offer)',
            extCmd: 'offer',
            target: 'feet',
            risk: null,
            consumesItem: true
        },
        effect: {
            type: 'DIVINE_FAVOR',
            topic: 'TACTICS',
            consumesItem: true,
            noteEn: 'Sacrificing fresh corpses at an aligned altar grants divine favor and gifts.',
            noteJa: '属性の合致する神壇で新鮮な死体を捧げると、神の好感度上昇やアーティファクト下賜の恩恵が得られます。'
        },
        messages: {
            adviceEn: '⛪ Altar Sacrifice: Offer fresh corpses at an aligned altar (#offer) to gain divine favor.',
            adviceJa: '⛪ 神壇への生贄: 属性の合致する神壇に新鮮な死体を捧げると(#offer)、神の好感度上昇や神宝下賜の恩恵が得られます。',
            descriptionEn: 'Sacrifice a fresh corpse on an aligned altar for divine favor and gifts.',
            descriptionJa: '神壇の上に新鮮な死体を捧げ、神の恩恵やアーティファクトの獲得を試みます。'
        }
    },

    // 1-4. 泉でのポーション水化 (Fountain Dip Potion)
    {
        id: 'CHEMISTRY_FOUNTAIN_DIP_POTION',
        category: 'TERRAIN_ITEM',
        terrain: 'fountain',
        trigger: {
            terrainType: 'fountain',
            hasPotion: true
        },
        action: {
            verb: '#dip',
            keySequence: ['#', 'dip', '${potionLetter}'],
            charStr: '#dip',
            labelEn: 'Dip potion in fountain (#dip)',
            labelJa: 'ポーションを泉に浸して水化 (#dip)',
            extCmd: 'dip',
            target: 'feet',
            risk: null,
            consumesItem: false
        },
        effect: {
            type: 'CREATE_WATER',
            topic: 'TACTICS',
            consumesItem: false,
            noteEn: 'Dipping potions into a fountain washes labels and turns them into unholy/pure water.',
            noteJa: 'ポーションを泉に浸すとラベルが剥がれ、ただの水（呪われ/無呪）に変化します。'
        },
        messages: {
            adviceEn: '💧 Fountain Dip: Dip useless potions into the fountain (#dip) to turn them into clear water.',
            adviceJa: '💧 泉の利用: 不要なポーションを泉に浸す(#dip)と、ラベルが剥がれてただの水に変化します。',
            descriptionEn: 'Dip potions in fountain water to turn them into blank water.',
            descriptionJa: '手持ちの不要なポーションを泉に浸して水に変化させます。'
        }
    },

    // 1-5. 泉での長剣浸し・聖剣化 (Fountain Dip Long Sword / Excalibur)
    {
        id: 'CHEMISTRY_FOUNTAIN_DIP_LONG_SWORD',
        category: 'TERRAIN_ITEM',
        terrain: 'fountain',
        trigger: {
            terrainType: 'fountain',
            hasLongSword: true,
            isLawfulPlayer: true
        },
        action: {
            verb: '#dip',
            keySequence: ['#', 'dip', '${swordLetter}'],
            charStr: '#dip',
            labelEn: 'Dip long sword in fountain (#dip)',
            labelJa: '長剣を泉に浸して聖剣化 (#dip)',
            extCmd: 'dip',
            target: 'feet',
            risk: null,
            consumesItem: false
        },
        effect: {
            type: 'EXCALIBUR_CHANCE',
            topic: 'TACTICS',
            consumesItem: false,
            noteEn: 'Lawful characters dipping a long sword in a fountain have a chance to forge Excalibur.',
            noteJa: '秩序のキャラクターが長剣を泉に浸すと、名剣エクスカリバーに変化する可能性があります。'
        },
        messages: {
            adviceEn: '⚔️ Excalibur Dip: Lawful characters dipping a Long Sword in a fountain (#dip) have a chance to forge Excalibur!',
            adviceJa: '⚔️ 聖剣鍛造: 秩序のキャラクターが長剣を泉に浸す(#dip)と、名剣エクスカリバーに変化する可能性があります！',
            descriptionEn: 'Dip a long sword into the fountain for a chance to receive Excalibur.',
            descriptionJa: '長剣を泉に浸し、名剣エクスカリバーの獲得を試みます。'
        }
    },

    // =========================================================================
    // 2. アイテム × アイテム相互作用 (Item × Item Interactions)
    // =========================================================================

    // 2-1. ユニコーンの角での薬中和・鑑定 (Unicorn Horn Dip Potion)
    {
        id: 'CHEMISTRY_UNICORN_HORN_DIP_POTION',
        category: 'ITEM_ITEM',
        sourceItem: 'unicorn horn',
        trigger: {
            sourceItemName: 'unicorn horn',
            hasUnidentifiedOrPoisonPotion: true
        },
        action: {
            verb: '#dip',
            keySequence: ['#', 'dip', '${hornLetter}'],
            charStr: '#dip',
            labelEn: 'Dip unicorn horn in potion',
            labelJa: 'ユニコーンの角を薬に浸す (#dip)',
            extCmd: 'dip',
            target: 'inventory',
            risk: null,
            consumesItem: false
        },
        effect: {
            type: 'NEUTRALIZE_POISON',
            topic: 'IDENTIFICATION',
            consumesItem: false,
            noteEn: 'Dipping a unicorn horn into harmful potions neutralizes them into safe fruit juice or water.',
            noteJa: 'ユニコーンの角を危険な薬や未識別薬に浸すと、毒を中和して安全な果汁や水に変化させます。'
        },
        messages: {
            adviceEn: '🦄 Neutralize & Identify: Dip unicorn horn [${hornLetter}] into potion [${potionLetter}] (#dip) to neutralize toxins safely.',
            adviceJa: '🦄 薬の中和・鑑定: ユニコーンの角 [${hornLetter}] を薬 [${potionLetter}] に浸す(#dip)と、毒や幻覚を安全に中和・判別できます。',
            descriptionEn: 'Dip unicorn horn into unidentified or dangerous potions to neutralize them into safe liquid.',
            descriptionJa: 'ユニコーンの角を未識別薬や毒薬に浸し、毒を解毒して安全な水や果汁に変化させます。'
        }
    },

    // 2-2. 恐怖の巻物の誤読防止・床置き結界 (Scare Monster Floor Ward)
    {
        id: 'CHEMISTRY_SCARE_MONSTER_FLOOR_WARD',
        category: 'ITEM_ITEM',
        sourceItem: 'scroll of scare monster',
        trigger: {
            sourceItemName: 'scroll of scare monster'
        },
        action: {
            verb: 'd',
            keySequence: ['d', '${scrollLetter}'],
            charStr: 'd',
            labelEn: 'Drop Scare Monster on floor (d)',
            labelJa: '恐怖の巻物を足元に置く (d)',
            extCmd: 'drop',
            target: 'feet',
            risk: 'CRITICAL',
            consumesItem: false
        },
        effect: {
            type: 'WARDING',
            topic: 'SURVIVAL',
            consumesItem: false,
            noteEn: 'Reading scroll in hand turns it to dust! Dropping it on the floor creates a safe ward against monsters.',
            noteJa: '手持ちで読むと灰になって消滅します！床に置いてその上に乗るとモンスターが侵入できなくなります。'
        },
        messages: {
            adviceEn: '⚠️ MISUSE WARNING: Reading Scroll of Scare Monster in hand turns it to dust! Drop it (\'d\') and stand on it instead.',
            adviceJa: '⚠️ 誤読注意: 恐怖の巻物(Scare Monster)を手持ちで読むと消滅します！床に置いて(\'d\')その上に乗ると敵が侵入できなくなります。',
            descriptionEn: 'Drop Scroll of Scare Monster on the floor and stand on it to repel non-humanoid enemies.',
            descriptionJa: '恐怖の巻物を床に置いてそのマスに留まり、敵を接近不能にして身を守ります。'
        }
    },

    // 2-3. 手品袋の爆発防止ガード (Bag of Holding Explosion Hazard)
    {
        id: 'CHEMISTRY_BAG_OF_HOLDING_EXPLOSION',
        category: 'HAZARD',
        sourceItem: 'bag of holding',
        trigger: {
            sourceItemName: 'bag of holding',
            hasHazardousContainerOrWand: true
        },
        action: null,
        effect: {
            type: 'MAGICAL_EXPLOSION',
            topic: 'SURVIVAL',
            consumesItem: true,
            risk: 'LETHAL',
            noteEn: 'Inserting a magic bag or Wand of Cancellation into a Bag of Holding causes total annihilation of gear and potential instant death.',
            noteJa: '手品袋の中に別の魔法の袋や打ち消しの杖を入れると大爆発し、全アイテム消滅や即死を引き起こします。'
        },
        messages: {
            adviceEn: '💥 LETHAL EXPLOSION HAZARD: Putting a magic bag or Wand of Cancellation into a Bag of Holding causes a massive explosion destroying all gear!',
            adviceJa: '💥 爆発即死警告: 手品袋(Bag of Holding)に別の魔法の袋や打ち消しの杖(Wand of Cancellation)を入れると大爆発し全アイテムが消滅・即死します！',
            descriptionEn: 'Fatal hazard: Never insert magic bags or Wand of Cancellation into a Bag of Holding.',
            descriptionJa: '致命的警告: 手品袋に別の魔法の袋や打ち消しの杖を入れてはなりません。'
        }
    },

    // 2-4. 試金石での宝石鑑定 (Touchstone Gem Test)
    {
        id: 'CHEMISTRY_TOUCHSTONE_GEM_TEST',
        category: 'ITEM_ITEM',
        sourceItem: 'touchstone',
        trigger: {
            sourceItemName: 'touchstone',
            hasUnidentifiedGemsOrStones: true
        },
        action: {
            verb: 'a',
            keySequence: ['a', '${stoneLetter}'],
            charStr: 'a',
            labelEn: 'Rub gem on touchstone (a)',
            labelJa: '宝石を試金石に擦る (a)',
            extCmd: 'apply',
            target: 'inventory',
            risk: null,
            consumesItem: false
        },
        effect: {
            type: 'IDENTIFY_GEM',
            topic: 'IDENTIFICATION',
            consumesItem: false,
            noteEn: 'Rubbing gems against a touchstone distinguishes glass pieces from valuable gems.',
            noteJa: '宝石を試金石に擦り付けると、ガラス玉か本物の高価な宝石かを安全に鑑定できます。'
        },
        messages: {
            adviceEn: '💎 Touchstone Test: Rub unidentified gems [${gemLetter}] against touchstone [${stoneLetter}] (\'a\') to distinguish real gems from worthless glass.',
            adviceJa: '💎 試金石鑑定: 未識別の石 [${gemLetter}] を試金石 [${stoneLetter}] に擦り付ける(\'a\')と、ガラス玉か本物の宝石かを判別できます。',
            descriptionEn: 'Rub gems on touchstone to differentiate valuable gemstones from worthless colored glass.',
            descriptionJa: '宝石を試金石に擦り付けて硬度と条痕を調べ、高価な宝石かガラス玉かを判別します。'
        }
    }
];

/**
 * 地形キーから関連するケミストリー相互作用一覧を取得
 * @param {string} terrainKey - 'sink', 'altar', 'fountain' 等
 * @returns {Array<Object>}
 */
export function getInteractionsByTerrain(terrainKey) {
    if (!terrainKey) return [];
    const t = terrainKey.toLowerCase();
    return CHEMISTRY_INTERACTIONS.filter(chem => chem.terrain === t || chem.trigger?.terrainType === t);
}

/**
 * アイテム名またはIDから関連するケミストリー相互作用一覧を取得
 * @param {string} itemName
 * @returns {Array<Object>}
 */
export function getInteractionsByItem(itemName) {
    if (!itemName) return [];
    const name = itemName.toLowerCase();
    return CHEMISTRY_INTERACTIONS.filter(chem => 
        chem.sourceItem === name || 
        chem.trigger?.sourceItemName === name ||
        (Array.isArray(chem.trigger?.hazardousItems) && chem.trigger.hazardousItems.includes(name))
    );
}
