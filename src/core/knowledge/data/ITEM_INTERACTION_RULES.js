/**
 * ITEM_INTERACTION_RULES.js
 * NetHack 5.0 (3.7) アイテム・相互作用ナレッジ辞書
 *
 * 【構造】
 * 1. Category Rules (ジャンル別共通ルール: 杖の刻みテスト, 神壇BUC判定, シンク指輪落とし, 泉dip等)
 * 2. Specific Rules (特殊アイテム・事故防止ルール: ユニコーンの角中和, 恐怖の巻物床置き, 手品袋爆発防止等)
 */

import { MONSTER_KNOWLEDGE_MAP } from './MONSTER_KNOWLEDGE_FULL.js';

export const ITEM_INTERACTION_RULES = [
    // =========================================================================
    // 【分類 1】アイテムジャンル共通ルール (Category Rules)
    // =========================================================================

    // 1-1. 緊急魔除け刻み (Elbereth)
    {
        id: 'INTERACTION_EMERGENCY_ELBERETH',
        category: 'SAFETY',
        outputChannels: ['ACTION', 'ADVISOR'],
        trigger: {
            hasNearbyThreat: true,
            isFloorOrCorridor: true
        },
        advice: {
            score: 950,
            severity: 'CRITICAL',
            topic: 'SURVIVAL',
            messageJa: '⚠️ 緊急避難: 危険な敵が接近しています！床にエルベレス(Elbereth)を刻む(\'E\')と多くの敵を追い払えます。',
            messageEn: '⚠️ EMERGENCY WARD: Threat nearby! Engrave "Elbereth" on the floor (\'E\') to scare away non-humanoid enemies.',
            hintCommand: 'E'
        },
        action: {
            id: 'ACTION_ENGRAVE_ELBERETH',
            category: 'SURVIVAL',
            label: 'Engrave Elbereth',
            labelJa: 'エルベレスを刻む (Elbereth)',
            key: 'E${writeTool}Elbereth',
            keySequence: ['E', '${writeTool}', 'Elbereth'],
            charStr: 'E',
            target: 'feet',
            risk: null,
            priority: 92,
            description: 'Instantly engrave the protective word Elbereth on the floor to scare off attackers',
            descriptionJa: '足元の床に魔除けの文字「Elbereth」を即座に自動刻印し、接近するモンスターを撃退・敗走させます'
        }
    },

    // 1-2. 杖の安全テスト刻み (Wand Engrave Test)
    {
        id: 'INTERACTION_WAND_ENGRAVE_TEST',
        category: 'WAND',
        outputChannels: ['ACTION', 'ADVISOR'],
        trigger: {
            isSafeRoom: true,
            isFloorOrCorridor: true,
            hasUnidentifiedItemCategory: 'WAND'
        },
        advice: {
            score: 450,
            severity: 'TIP',
            topic: 'IDENTIFICATION',
            messageJa: '💡 杖の安全鑑定: 未識別の杖 [${wandLetter}] を床に刻む(\'E\')ことで、充填数を消費せずに効果を特定・絞り込めます。',
            messageEn: '💡 Wand Engrave Test: Engrave-test wand [${wandLetter}] on the floor (\'E\') to safely identify effects without wasting charges.',
            hintCommand: 'E'
        },
        action: {
            id: 'ACTION_ENGRAVE_TEST_WAND',
            category: 'INTERACT',
            label: 'Engrave-test wand',
            labelJa: '杖を床に刻んで鑑定テスト (E)',
            key: 'E',
            charStr: 'E',
            target: 'feet',
            risk: null,
            priority: 68,
            description: 'Engrave on the floor with an unidentified wand to observe the message without charge loss',
            descriptionJa: '未識別の杖を使って床に文字を刻み、発生する効果メッセージから杖の種類を安全に特定します'
        }
    },

    // 1-3. 神壇での呪い・祝福判定 (Altar BUC Drop)
    {
        id: 'INTERACTION_ALTAR_BUC_DROP',
        category: 'ALTAR',
        outputChannels: ['ACTION', 'ADVISOR'],
        trigger: {
            isOnAltar: true,
            hasUncheckedBucItems: true
        },
        advice: {
            score: 550,
            severity: 'TIP',
            topic: 'IDENTIFICATION',
            messageJa: '✨ 神壇検知: 神壇の上にアイテムを置く(\'d\')と、光の色(琥珀=祝福/黒=呪い)でBUC状態を安全に判別できます。',
            messageEn: '✨ Altar BUC Test: Drop items on the altar (\'d\') to identify Blessed/Uncursed/Cursed status safely via flash colors.',
            hintCommand: 'd'
        },
        action: {
            id: 'ACTION_DROP_ON_ALTAR',
            category: 'INTERACT',
            label: 'Drop item on altar (BUC test)',
            labelJa: '神壇に置いて呪い判定 (d)',
            key: 'd',
            charStr: 'd',
            target: 'feet',
            risk: null,
            priority: 88,
            description: 'Drop an item onto the altar to test its Blessed / Uncursed / Cursed (BUC) status',
            descriptionJa: '手持ちの未判定アイテムを神壇の上に落とし、光の演出から祝福・呪いを判別します'
        }
    },

    // 1-4. 流し台での指輪落とし識別 (Sink Ring Test)
    {
        id: 'INTERACTION_SINK_RING_TEST',
        category: 'SINK',
        outputChannels: ['ACTION', 'ADVISOR'],
        trigger: {
            isOnSink: true,
            hasUnidentifiedItemCategory: 'RING'
        },
        advice: {
            score: 500,
            severity: 'TIP',
            topic: 'IDENTIFICATION',
            messageJa: '💍 流し台鑑定: 未識別の指輪 [${ringLetter}] を流し台に落とすと(\'d\')種類を識別できます。※落とした現物は消滅するため不要な指輪で試してください。',
            messageEn: '💍 Sink Ring Test: Drop unidentified ring [${ringLetter}] down the sink (\'d\') to identify it. WARNING: The dropped ring will be lost down the drain!',
            hintCommand: 'd'
        },
        action: {
            id: 'ACTION_SINK_TEST_RING',
            category: 'INTERACT',
            label: 'Drop ring in sink (d)',
            labelJa: '指輪を流し台に落として識別 (d)',
            key: 'd${ringLetter}',
            keySequence: ['d', '${ringLetter}'],
            charStr: 'd',
            extCmd: 'drop',
            target: 'feet',
            risk: 'CRITICAL',
            consumesItem: true,
            priority: 78,
            description: 'Drop an unidentified ring down the sink drain to type-identify it. WARNING: The dropped ring is lost forever down the pipe!',
            descriptionJa: '未識別の指輪を流し台の排水口に落とし、効果音から種類を判別します。※落とした指輪は消滅します（重複所持時推奨）'
        }
    },

    // 1-5. 泉でのポーション水化・長剣浸し (Fountain Dip)
    {
        id: 'INTERACTION_FOUNTAIN_DIP',
        category: 'FOUNTAIN',
        outputChannels: ['ACTION', 'ADVISOR'],
        trigger: {
            isOnFountain: true,
            hasDippablePotionOrLongSword: true
        },
        advice: {
            score: 400,
            severity: 'INFO',
            topic: 'TACTICS',
            messageJa: '💧 泉の利用: 不要なポーションを泉に浸す(#dip)とただの水に変化し、長剣(Long Sword)を浸すとエクスカリバーに変化する可能性があります。',
            messageEn: '💧 Fountain Dip: Dip useless potions into the fountain (#dip) to turn them into water, or dip Long Sword for Excalibur.',
            hintCommand: '#dip'
        },
        action: {
            id: 'ACTION_DIP_FOUNTAIN_SPECIAL',
            category: 'INTERACT',
            label: 'Dip in fountain (#dip)',
            labelJa: '泉に浸して水化/変化 (#dip)',
            key: '#dip',
            charStr: '#dip',
            extCmd: 'dip',
            target: 'feet',
            risk: null,
            priority: 72,
            description: 'Dip potions to create water or dip long swords for artifact creation',
            descriptionJa: '手持ちのポーションを泉に浸して水に変化させるか、長剣を浸して名剣作成を試みます'
        }
    },

    // =========================================================================
    // 【分類 2】固有・特殊アイテムの特殊ルール (Specific Artifact & Tool Rules)
    // =========================================================================

    // 2-1. ユニコーンの角での薬中和・鑑定 (Unicorn Horn Dip)
    {
        id: 'INTERACTION_UNICORN_HORN_DIP',
        category: 'SPECIAL_TOOL',
        outputChannels: ['ACTION', 'ADVISOR'],
        trigger: {
            hasItemNamed: ['unicorn horn', 'ユニコーンの角'],
            hasUnidentifiedOrPoisonPotion: true
        },
        advice: {
            score: 520,
            severity: 'TIP',
            topic: 'IDENTIFICATION',
            messageJa: '🦄 薬の中和・鑑定: ユニコーンの角 [${hornLetter}] を薬 [${potionLetter}] に浸す(#dip)と、毒や幻覚を安全に中和・判別できます。',
            messageEn: '🦄 Neutralize & Identify: Dip unicorn horn [${hornLetter}] into potion [${potionLetter}] (#dip) to neutralize toxins safely.',
            hintCommand: '#dip'
        },
        action: {
            id: 'ACTION_DIP_UNICORN_HORN',
            category: 'INTERACT',
            label: 'Dip unicorn horn in potion',
            labelJa: 'ユニコーンの角を薬に浸す (#dip)',
            key: '#dip',
            charStr: '#dip',
            extCmd: 'dip',
            target: 'inventory',
            risk: null,
            priority: 76,
            description: 'Dip unicorn horn into unidentified or dangerous potions to neutralize them into safe water/fruit juice',
            descriptionJa: 'ユニコーンの角を未識別薬や毒薬に浸し、毒を解毒して安全な水や果汁に変化させます'
        }
    },

    // 2-2. 恐怖の巻物の誤読防止 (Scare Monster Misuse Guard)
    {
        id: 'INTERACTION_SCARE_MONSTER_MISUSE',
        category: 'SAFETY',
        outputChannels: ['ADVISOR'],
        trigger: {
            hasItemNamed: ['scroll of scare monster', '恐怖の巻物']
        },
        advice: {
            score: 900,
            severity: 'CRITICAL',
            topic: 'SURVIVAL',
            messageJa: '⚠️ 誤読注意: 恐怖の巻物(Scare Monster)を手持ちで読むと消滅します！床に置いて(\'d\')その上に乗ると敵が侵入できなくなります。',
            messageEn: '⚠️ MISUSE WARNING: Reading Scroll of Scare Monster in hand turns it to dust! Drop it (\'d\') and stand on it instead.',
            hintCommand: 'd'
        }
    },

    // 2-3. 手品袋の爆発防止ガード (Bag of Holding Explosion Guard)
    {
        id: 'INTERACTION_BAG_OF_HOLDING_EXPLOSION',
        category: 'SAFETY',
        outputChannels: ['ADVISOR'],
        trigger: {
            hasItemNamed: ['bag of holding', '手品袋'],
            hasHazardousContainerOrWand: true
        },
        advice: {
            score: 990,
            severity: 'CRITICAL',
            topic: 'SURVIVAL',
            messageJa: '💥 爆発即死警告: 手品袋(Bag of Holding)に別の魔法の袋や打ち消しの杖(Wand of Cancellation)を入れると大爆発し全アイテムが消滅・即死します！',
            messageEn: '💥 LETHAL EXPLOSION HAZARD: Putting a magic bag or Wand of Cancellation into a Bag of Holding causes a massive explosion destroying all gear!',
            hintCommand: null
        }
    },

    // 2-4. タッチストーンでの宝石・鉱石識別 (Touchstone Rub)
    {
        id: 'INTERACTION_TOUCHSTONE_RUB',
        category: 'SPECIAL_TOOL',
        outputChannels: ['ACTION', 'ADVISOR'],
        trigger: {
            hasItemNamed: ['touchstone', 'タッチストーン'],
            hasUnidentifiedGemsOrStones: true
        },
        advice: {
            score: 480,
            severity: 'TIP',
            topic: 'IDENTIFICATION',
            messageJa: '💎 宝石鑑定: タッチストーン [${stoneLetter}] を使って(#apply)未識別の宝石や灰色の石をこすると、硬度から真偽を判定できます。',
            messageEn: '💎 Touchstone Test: Apply touchstone [${stoneLetter}] (\'a\') to rub against unidentified gems or gray stones to test hardness.',
            hintCommand: 'a'
        },
        action: {
            id: 'ACTION_RUB_TOUCHSTONE',
            category: 'INTERACT',
            label: 'Apply touchstone on gems',
            labelJa: 'タッチストーンで石を鑑定 (a)',
            key: 'a',
            charStr: 'a',
            target: 'inventory',
            risk: null,
            priority: 74,
            description: 'Rub gems or gray stones against touchstone to identify glass vs valuable gems',
            descriptionJa: 'タッチストーンに宝石や灰色の石をこすりつけ、ガラス玉か本物の貴石・魔力石かを判定します'
        }
    },

    // 2-5. 缶切りでの缶詰開封 (Tin Opener)
    {
        id: 'INTERACTION_TIN_OPENER',
        category: 'SPECIAL_TOOL',
        outputChannels: ['ACTION'],
        trigger: {
            hasItemNamed: ['tin opener', '缶切り'],
            hasTinsInInventory: true
        },
        advice: {
            score: 420,
            severity: 'TIP',
            topic: 'SURVIVAL',
            messageJa: '🥫 缶詰の開封: 缶切り [${openerLetter}] を使う(#apply)と、1ターンで安全に缶詰を開けて食べられます。',
            messageEn: '🥫 Tin Opener: Apply tin opener [${openerLetter}] (\'a\') to open tins instantly in 1 turn safely.',
            hintCommand: 'a'
        },
        action: {
            id: 'ACTION_APPLY_TIN_OPENER',
            category: 'INTERACT',
            label: 'Open tin with tin opener',
            labelJa: '缶切りで缶詰を開ける (a)',
            key: 'a',
            charStr: 'a',
            target: 'inventory',
            risk: null,
            priority: 70,
            description: 'Apply tin opener to open and eat canned food safely',
            descriptionJa: '缶切りを使用して手持ちの缶詰を素早く開けて栄養を摂取します'
        }
    },

    // 2-6. 魔法のマーカーでの巻物・魔法書執筆 (Magic Marker Write)
    {
        id: 'INTERACTION_MAGIC_MARKER_WRITE',
        category: 'SPECIAL_TOOL',
        outputChannels: ['ACTION'],
        trigger: {
            hasItemNamed: ['magic marker', '魔法のマーカー'],
            hasBlankScrollOrSpellbook: true
        },
        advice: {
            score: 460,
            severity: 'TIP',
            topic: 'TACTICS',
            messageJa: '📜 巻物執筆: 魔法のマーカー [${markerLetter}] を使って(#apply)白紙の巻物に好きな巻物の名前を書き込めます。',
            messageEn: '📜 Write Scrolls: Apply magic marker [${markerLetter}] (\'a\') to write powerful spell names onto blank scrolls.',
            hintCommand: 'a'
        },
        action: {
            id: 'ACTION_WRITE_MAGIC_MARKER',
            category: 'INTERACT',
            label: 'Write on scroll / book with marker',
            labelJa: 'マーカーで巻物に執筆 (a)',
            key: 'a',
            charStr: 'a',
            target: 'inventory',
            risk: null,
            priority: 66,
            description: 'Apply magic marker to write on blank scrolls or spellbooks',
            descriptionJa: '魔法のマーカーを使って白紙の巻物や魔法書に希望の呪文・効果を書き込みます'
        }
    }
];

/**
 * ヘルパー: コンテキストから各ルールが発動可能か評価
 */
export function evaluateInteractionRule(rule, context) {
    const {
        areaState = null,
        inventoryState = null,
        statusAccessor = null
    } = context;

    const trigger = rule.trigger || {};
    const items = inventoryState ? (inventoryState.items || []) : [];

    // モンスターの危険度・致死性を評価（ペットや友好的NPCを除外）
    const getMonsterDanger = (m) => {
        if (!m) return null;
        const ent = m.entity || m;
        if (!ent) return null;
        if (ent.type === 'PET' || ent.isPet || ent.isTame || ent.isPeaceful || ent.attitude === 'PEACEFUL' || ent.flags?.isPet || ent.glyphInfo?.isPet) {
            return null;
        }
        const monOffset = ent.monOffset !== undefined ? ent.monOffset : (ent.subType !== undefined ? ent.subType : ent.glyphInfo?.monOffset);
        const knowledge = (monOffset !== undefined ? MONSTER_KNOWLEDGE_MAP.get(monOffset) : null) || {};
        const dangerLevel = ent.dangerLevel || knowledge.dangerLevel || 'LOW';
        const traits = knowledge.traits || {};
        const isDangerous = (dangerLevel === 'HIGH' || dangerLevel === 'LETHAL' || 
            traits.petrifiesOnTouch || traits.eatsBrain || traits.causesSlime || 
            traits.drainsLevel || traits.paralysisGaze || traits.gazeConfusion);
        return { isEnemy: true, dangerLevel, isDangerous };
    };

    // プレイヤーのHPピンチ度 (50%以下)
    let isHpPinch = false;
    if (statusAccessor) {
        let hp = null, maxHp = null;
        if (typeof statusAccessor.getStatus === 'function') {
            const s = statusAccessor.getStatus();
            if (s && s.hp) { hp = s.hp.current; maxHp = s.hp.max; }
        } else {
            hp = typeof statusAccessor.getHp === 'function' ? statusAccessor.getHp() : null;
            maxHp = typeof statusAccessor.getMaxHp === 'function' ? statusAccessor.getMaxHp() : null;
        }
        if (hp !== null && maxHp !== null && maxHp > 0) {
            isHpPinch = (hp / maxHp) <= 0.5;
        }
    }

    const adjEnemies = (areaState && Array.isArray(areaState.adjacentMonsters))
        ? areaState.adjacentMonsters.map(m => getMonsterDanger(m)).filter(d => d && d.isEnemy)
        : [];
    const perceivedEnemies = (areaState && Array.isArray(areaState.perceivedMonsters))
        ? areaState.perceivedMonsters.filter(m => m.decayStatus === 'VISIBLE' || m.inLoS).map(m => getMonsterDanger(m)).filter(d => d && d.isEnemy)
        : [];

    // 1. 周辺脅威チェック (エルベレス等の緊急避難判定)
    // 条件A: HIGHまたはLETHAL級の危険敵が接近している
    // 条件B: 敵2体以上に包囲されている
    // 条件C: HPが50%以下で敵が隣接している
    if (trigger.hasNearbyThreat !== undefined) {
        const hasDangerousEnemy = adjEnemies.some(d => d.isDangerous) || perceivedEnemies.some(d => d.isDangerous);
        const isSurrounded = adjEnemies.length >= 2;
        const isPinchAdjacent = isHpPinch && adjEnemies.length >= 1;

        const isEmergencyThreat = hasDangerousEnemy || isSurrounded || isPinchAdjacent;
        if (trigger.hasNearbyThreat !== !!isEmergencyThreat) return null;
    }

    // 2. 安全な部屋チェック (視界内に敵対的な敵が1体もいない)
    if (trigger.isSafeRoom !== undefined) {
        const hasVisibleEnemy = (adjEnemies.length > 0) || (perceivedEnemies.length > 0);
        const isSafe = !hasVisibleEnemy;
        if (trigger.isSafeRoom !== isSafe) return null;
    }

    // 3. 地形チェック (Floor, Corridor, Altar, Sink, Fountain)
    const feetFlags = (areaState && areaState.feet && areaState.feet.bottom && areaState.feet.bottom.cmapFlags) || {};
    if (trigger.isFloorOrCorridor !== undefined) {
        // 壁、水場、溶岩、閉じた扉でない限り彫れる（床、通路、暗い部屋、祭壇、流し台等も可）
        const isCarvable = !feetFlags.isWall && !feetFlags.isPool && !feetFlags.isLava && !feetFlags.isClosedDoor && !feetFlags.isIronBars;
        if (trigger.isFloorOrCorridor !== isCarvable) return null;
    }
    if (trigger.isOnAltar !== undefined) {
        const isAltar = !!feetFlags.isAltar;
        if (trigger.isOnAltar !== isAltar) return null;
    }
    if (trigger.isOnSink !== undefined) {
        const isSink = !!feetFlags.isSink;
        if (trigger.isOnSink !== isSink) return null;
    }
    if (trigger.isOnFountain !== undefined) {
        const isFountain = !!feetFlags.isFountain;
        if (trigger.isOnFountain !== isFountain) return null;
    }

    // 4. 特定名称アイテムの所持チェック
    let matchedSourceItem = null;
    if (trigger.hasItemNamed) {
        const names = Array.isArray(trigger.hasItemNamed) ? trigger.hasItemNamed : [trigger.hasItemNamed];
        matchedSourceItem = items.find(i => {
            const raw = (i.rawText || i.name || '').toLowerCase();
            const id = (i.id || i.knowledge?.id || i.knowledge?.name || '').toLowerCase();
            return names.some(n => {
                const nl = n.toLowerCase();
                return raw.includes(nl) || id.includes(nl);
            });
        });
        if (!matchedSourceItem) return null;
    }

/**
 * アイテムが未識別状態であるかを厳密に判定
 * @param {Object} item 
 * @returns {boolean}
 */
function isItemUnidentified(item) {
    if (!item) return false;
    if (typeof item.isUnidentified === 'boolean') {
        return item.isUnidentified;
    }
    if (item.identification) {
        if (typeof item.identification.isUnidentified === 'boolean') {
            return item.identification.isUnidentified;
        }
        if (typeof item.identification.isKnown === 'boolean') {
            return !item.identification.isKnown;
        }
    }
    if (item.knowledge && item.knowledge.identification) {
        if (typeof item.knowledge.identification.isUnidentified === 'boolean') {
            return item.knowledge.identification.isUnidentified;
        }
        if (typeof item.knowledge.identification.isKnown === 'boolean') {
            return !item.knowledge.identification.isKnown;
        }
    }
    const raw = (item.rawText || item.name || '').toLowerCase();
    // 'wand of ...' や '...の杖' 等は本名判明（識別済み）
    if (raw.includes(' of ') || raw.includes('の杖') || raw.includes('の指輪') || raw.includes('の巻物') || raw.includes('の薬') || raw.includes('の魔除け')) {
        return false;
    }
    // 'called' または 'named' または外見名（glass wand, brass ring 等）は未識別
    if (raw.includes('called') || raw.includes('named') || raw.includes('wand') || raw.includes('ring') || raw.includes('scroll') || raw.includes('potion')) {
        return true;
    }
    return false;
}

    // 5. 未識別カテゴリの所持チェック (WAND, RING 等)
    let matchedUnidentifiedItem = null;
    if (trigger.hasUnidentifiedItemCategory) {
        const cat = trigger.hasUnidentifiedItemCategory.toUpperCase();
        matchedUnidentifiedItem = items.find(i => {
            const raw = (i.rawText || i.name || '').toLowerCase();
            const isCat = (cat === 'WAND' && (i.isWand || raw.includes('wand') || raw.includes('杖'))) ||
                          (cat === 'RING' && (i.isRing || raw.includes('ring') || raw.includes('指輪'))) ||
                          (cat === 'POTION' && (i.isPotion || raw.includes('potion') || raw.includes('薬'))) ||
                          (cat === 'SCROLL' && (i.isScroll || raw.includes('scroll') || raw.includes('巻物')));
            return isCat && isItemUnidentified(i);
        });
        if (!matchedUnidentifiedItem) return null;
    }

    // 6. BUC未判定アイテム所持チェック
    if (trigger.hasUncheckedBucItems) {
        const hasUnchecked = items.some(i => !i.buc || i.buc === 'unknown');
        if (!hasUnchecked) return null;
    }

    // 7. 特殊アイテム組み合わせ条件
    if (trigger.hasUnidentifiedOrPoisonPotion) {
        const potion = items.find(i => i.isPotion || (i.rawText || '').toLowerCase().includes('potion'));
        if (!potion) return null;
    }

    if (trigger.hasHazardousContainerOrWand) {
        const hasWandOfCancel = items.some(i => (i.rawText || '').toLowerCase().includes('cancellation'));
        const hasOtherMagicBag = items.some(i => (i.rawText || '').toLowerCase().includes('bag of tricks') || (i.rawText || '').toLowerCase().includes('bag of holding') && i.letter !== matchedSourceItem?.letter);
        if (!hasWandOfCancel && !hasOtherMagicBag) return null;
    }

    if (trigger.hasUnidentifiedGemsOrStones) {
        const gem = items.find(i => (i.rawText || '').toLowerCase().includes('gem') || (i.rawText || '').toLowerCase().includes('stone'));
        if (!gem) return null;
    }

    if (trigger.hasTinsInInventory) {
        const tin = items.find(i => (i.rawText || '').toLowerCase().includes('tin'));
        if (!tin) return null;
    }

    if (trigger.hasBlankScrollOrSpellbook) {
        const blank = items.find(i => (i.rawText || '').toLowerCase().includes('blank') || (i.rawText || '').toLowerCase().includes('unlabeled'));
        if (!blank) return null;
    }

    if (trigger.hasDippablePotionOrLongSword) {
        const dippable = items.find(i => i.isPotion || (i.rawText || '').toLowerCase().includes('long sword'));
        if (!dippable) return null;
    }

    // 彫刻ツール（アサメがあれば優先、なければ手/指 -）
    const athame = items.find(i => (i.rawText || i.name || '').toLowerCase().includes('athame') && i.letter);
    const writeTool = athame ? athame.letter : '-';

    // パラメータ置換マップの生成
    const params = {
        writeTool,
        wandLetter: matchedUnidentifiedItem?.letter || 'a',
        ringLetter: matchedUnidentifiedItem?.letter || 'a',
        hornLetter: matchedSourceItem?.letter || 'a',
        potionLetter: items.find(i => i.isPotion)?.letter || 'b',
        stoneLetter: matchedSourceItem?.letter || 'a',
        openerLetter: matchedSourceItem?.letter || 'a',
        markerLetter: matchedSourceItem?.letter || 'a'
    };

    return { rule, params };
}
