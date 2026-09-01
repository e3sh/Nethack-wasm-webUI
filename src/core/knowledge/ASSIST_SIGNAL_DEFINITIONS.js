/**
 * ASSIST_SIGNAL_DEFINITIONS.js
 *
 * 【GKL アシストシグナル・マスター定義テーブル (SSOT)】
 *
 * AssistSignalSynthesizer からシグナルの文言、Wikiリンク、優先度、アイコン等の直書きを完全排除し、
 * すべてのシグナル定義を一元管理するマスターデータ。
 * 
 * 拡張性:
 * 新しいシグナルや多言語対応、Wikiリンク変更、優先度チューニングは本ファイルを編集するだけで反映される。
 */

export const ASSIST_SIGNAL_DEFINITIONS = {
    // 1. 石化進行
    'SIGNAL_PETRIFY_CURE': {
        id: 'SIGNAL_PETRIFY_CURE',
        priority: 100,
        category: 'SURVIVAL',
        stance: 'CURE',
        icon: '🦎',
        shortMessageJa: '石化中: 直ちにトカゲの死体を摂取！',
        shortMessageEn: 'Petrifying: Eat lizard corpse immediately!',
        detailWhyJa: '石化が完了すると即死します。トカゲの死体を食べることで進行を解除できます。',
        detailWhyEn: 'Petrification is fatal upon completion. Eating a lizard corpse cures it.',
        wikiTopic: 'Petrification',
        defaultKeySequence: ['e', '{invlet}'],
        actionLabelJa: 'トカゲの死体を食べる (e -> {invlet})',
        actionLabelEn: 'Eat lizard corpse (e -> {invlet})'
    },
    'SIGNAL_PETRIFY_PRAY': {
        id: 'SIGNAL_PETRIFY_PRAY',
        priority: 100,
        category: 'SURVIVAL',
        stance: 'PRAY',
        icon: '🙏',
        shortMessageJa: '石化中: 直ちに神に祈る！',
        shortMessageEn: 'Petrifying: Pray to your deity immediately!',
        detailWhyJa: '特効薬がないため、神に祈って石化を解除してもらいます。',
        detailWhyEn: 'Without remedies, pray to deity to cure petrification.',
        wikiTopic: 'Pray',
        defaultKeySequence: ['#', 'pray', 'y'],
        actionLabelJa: '神に祈る (#pray)',
        actionLabelEn: 'Pray to god (#pray)'
    },

    // 2. スライム化
    'SIGNAL_SLIMING_FIRE': {
        id: 'SIGNAL_SLIMING_FIRE',
        priority: 98,
        category: 'SURVIVAL',
        stance: 'CURE',
        icon: '🔥',
        shortMessageJa: 'スライム化: 自分に火を放ち治療！',
        shortMessageEn: 'Sliming: Apply fire to self to cure!',
        detailWhyJa: '緑色スライムに変身する前に、火の杖や巻物で自分を焼いて治療します。',
        detailWhyEn: 'Burn yourself with fire to stop turning into a green slime.',
        wikiTopic: 'Sliming',
        defaultKeySequence: ['z', '{invlet}', '.'],
        actionLabelJa: '火の杖を自分に振る (z -> {invlet} -> .)',
        actionLabelEn: 'Zap fire wand at self (z -> {invlet} -> .)'
    },
    'SIGNAL_SLIMING_PRAY': {
        id: 'SIGNAL_SLIMING_PRAY',
        priority: 98,
        category: 'SURVIVAL',
        stance: 'PRAY',
        icon: '🙏',
        shortMessageJa: 'スライム化: 神に祈って救済を乞う',
        shortMessageEn: 'Sliming: Pray to your deity for salvation',
        detailWhyJa: '火炎手段がないため、祈願によってスライム化の解除を試みます。',
        detailWhyEn: 'Without fire, pray to your god to dispel sliming.',
        wikiTopic: 'Pray',
        defaultKeySequence: ['#', 'pray', 'y'],
        actionLabelJa: '神に祈る (#pray)',
        actionLabelEn: 'Pray to god (#pray)'
    },

    // 3. 病気・食中毒
    'SIGNAL_SICK_HORN': {
        id: 'SIGNAL_SICK_HORN',
        priority: 88,
        category: 'STATUS_REMEDY',
        stance: 'CURE',
        icon: '🤢',
        shortMessageJa: '病気中: ユニコーンの角で治癒',
        shortMessageEn: 'Sick: Apply unicorn horn to cure',
        detailWhyJa: '病気・食中毒は放置すると死に至ります。角を使って治療してください。',
        detailWhyEn: 'Sickness is fatal if untreated. Apply unicorn horn.',
        wikiTopic: 'Sickness',
        defaultKeySequence: ['a', '{invlet}'],
        actionLabelJa: 'ユニコーンの角を使う (a -> {invlet})',
        actionLabelEn: 'Apply unicorn horn (a -> {invlet})'
    },
    'SIGNAL_SICK_POTION': {
        id: 'SIGNAL_SICK_POTION',
        priority: 88,
        category: 'STATUS_REMEDY',
        stance: 'CURE',
        icon: '🤢',
        shortMessageJa: '病気中: 強力回復薬で治癒',
        shortMessageEn: 'Sick: Quaff extra healing to cure',
        detailWhyJa: '病気は放置すると死に至ります。強力な回復薬を服用して治療します。',
        detailWhyEn: 'Sickness is fatal. Drink extra healing potion to cure.',
        wikiTopic: 'Sickness',
        defaultKeySequence: ['q', '{invlet}'],
        actionLabelJa: '回復薬を飲む (q -> {invlet})',
        actionLabelEn: 'Quaff potion (q -> {invlet})'
    },
    'SIGNAL_SICK_PRAY': {
        id: 'SIGNAL_SICK_PRAY',
        priority: 88,
        category: 'STATUS_REMEDY',
        stance: 'PRAY',
        icon: '🙏',
        shortMessageJa: '病気中: 神に祈って治療を乞う',
        shortMessageEn: 'Sick: Pray to deity for healing',
        detailWhyJa: '治療手段がないため、祈願で病気の治癒を乞います。',
        detailWhyEn: 'Without remedies, pray to god to cure illness.',
        wikiTopic: 'Pray',
        defaultKeySequence: ['#', 'pray', 'y'],
        actionLabelJa: '神に祈る (#pray)',
        actionLabelEn: 'Pray to god (#pray)'
    },

    // 4. 瀕死 (HP < 30%)
    'SIGNAL_HP_CRITICAL_HEAL': {
        id: 'SIGNAL_HP_CRITICAL_HEAL',
        priority: 85,
        category: 'SURVIVAL',
        stance: 'CURE',
        icon: '🚨',
        shortMessageJa: '瀕死(HP低): 直ちに回復薬で治癒',
        shortMessageEn: 'Critical HP: Quaff healing potion immediately',
        detailWhyJa: 'HPが30%未満の致命的状況です。即座に回復を行ってください。',
        detailWhyEn: 'HP is critically below 30%. Heal immediately.',
        wikiTopic: 'Hit_points',
        defaultKeySequence: ['q', '{invlet}'],
        actionLabelJa: '回復薬を飲む (q -> {invlet})',
        actionLabelEn: 'Quaff healing potion (q -> {invlet})'
    },
    'SIGNAL_HP_CRITICAL_SPELL': {
        id: 'SIGNAL_HP_CRITICAL_SPELL',
        priority: 85,
        category: 'SURVIVAL',
        stance: 'CURE',
        icon: '🚨',
        shortMessageJa: '瀕死(HP低): 治癒魔法で回復',
        shortMessageEn: 'Critical HP: Cast healing spell',
        detailWhyJa: '安全に詠唱可能な治癒魔法でHPを回復します。',
        detailWhyEn: 'Cast safe healing spell to restore HP.',
        wikiTopic: 'Spellbook_of_healing',
        defaultKeySequence: ['Z', '{spellKey}', '.'],
        actionLabelJa: '治癒魔法を唱える (Z -> {spellKey} -> .)',
        actionLabelEn: 'Cast healing spell (Z -> {spellKey} -> .)'
    },
    'SIGNAL_HP_CRITICAL_PRAY': {
        id: 'SIGNAL_HP_CRITICAL_PRAY',
        priority: 85,
        category: 'SURVIVAL',
        stance: 'PRAY',
        icon: '🙏',
        shortMessageJa: '瀕死(HP低): 神に祈って全快を乞う',
        shortMessageEn: 'Critical HP: Pray to deity for full heal',
        detailWhyJa: '回復アイテムがないため、祈願によって神の恩恵（全回復）を乞います。',
        detailWhyEn: 'Without healing items, pray for divine full recovery.',
        wikiTopic: 'Pray',
        defaultKeySequence: ['#', 'pray', 'y'],
        actionLabelJa: '神に祈る (#pray)',
        actionLabelEn: 'Pray to god (#pray)'
    },

    // 5. HP 低下 (30% <= HP <= 50%)
    'SIGNAL_HP_LOW_HEAL': {
        id: 'SIGNAL_HP_LOW_HEAL',
        priority: 65,
        category: 'SURVIVAL',
        stance: 'CURE',
        icon: '💖',
        shortMessageJa: 'HP低下: 回復薬(q)の服用または退避',
        shortMessageEn: 'Low HP: Quaff healing potion (q) or retreat',
        detailWhyJa: 'HPが半分を切っています。安全を確保して回復してください。',
        detailWhyEn: 'HP is below 50%. Quaff potion or retreat to safety.',
        wikiTopic: 'Hit_points',
        defaultKeySequence: ['q', '{invlet}'],
        actionLabelJa: '回復薬を飲む (q -> {invlet})',
        actionLabelEn: 'Quaff potion (q -> {invlet})'
    },

    // 6. 混乱
    'SIGNAL_CONF_HORN': {
        id: 'SIGNAL_CONF_HORN',
        priority: 75,
        category: 'STATUS_REMEDY',
        stance: 'CURE',
        icon: '✨',
        shortMessageJa: '混乱中: ユニコーンの角で治療',
        shortMessageEn: 'Confused: Apply unicorn horn to cure',
        detailWhyJa: 'ユニコーンの角を使って即時に混乱を解除します。',
        detailWhyEn: 'Apply unicorn horn to immediately cure confusion.',
        wikiTopic: 'Confusion',
        defaultKeySequence: ['a', '{invlet}'],
        actionLabelJa: '角を使う (a -> {invlet})',
        actionLabelEn: 'Apply horn (a -> {invlet})'
    },
    'SIGNAL_CONF_WAIT': {
        id: 'SIGNAL_CONF_WAIT',
        priority: 75,
        category: 'STATUS_REMEDY',
        stance: 'WAIT_SAFE',
        icon: '🛡️',
        shortMessageJa: '混乱中: 移動せず足踏み(.)推奨',
        shortMessageEn: 'Confused: Wait in place (.) recommended',
        detailWhyJa: '混乱中に移動するとランダムな方向へ進み、罠や溶岩に突っ込む危険があります。治まるまで足踏み待機してください。',
        detailWhyEn: 'Moving while confused causes random steps into traps/lava. Wait in place until it passes.',
        wikiTopic: 'Confusion',
        defaultKeySequence: ['.'],
        actionLabelJa: '足踏み待機 (.)',
        actionLabelEn: 'Wait in place (.)',
        isSafe: true
    },

    // 7. 盲目
    'SIGNAL_BLIND_HORN': {
        id: 'SIGNAL_BLIND_HORN',
        priority: 70,
        category: 'STATUS_REMEDY',
        stance: 'CURE',
        icon: '✨',
        shortMessageJa: '盲目中: 角で治療',
        shortMessageEn: 'Blind: Apply horn to cure',
        detailWhyJa: 'ユニコーンの角を使って盲目を治療します。',
        detailWhyEn: 'Apply unicorn horn to restore eyesight.',
        wikiTopic: 'Blindness',
        defaultKeySequence: ['a', '{invlet}'],
        actionLabelJa: '角を使う (a -> {invlet})',
        actionLabelEn: 'Apply horn (a -> {invlet})'
    },
    'SIGNAL_BLIND_WAIT': {
        id: 'SIGNAL_BLIND_WAIT',
        priority: 70,
        category: 'STATUS_REMEDY',
        stance: 'WAIT_SAFE',
        icon: '🛡️',
        shortMessageJa: '盲目中: 壁際で安全確保・待機',
        shortMessageEn: 'Blind: Stay near wall and search/wait',
        detailWhyJa: '視界が失われています。不用意に歩き回らず、捜索待機(s)で自然回復を待ちます。',
        detailWhyEn: 'Eyesight lost. Wait/search (s) safely rather than wandering blindly.',
        wikiTopic: 'Blindness',
        defaultKeySequence: ['s'],
        actionLabelJa: '捜索待機 (s)',
        actionLabelEn: 'Search & Wait (s)',
        isSafe: true
    },

    // 8. スタン
    'SIGNAL_STUN_WAIT': {
        id: 'SIGNAL_STUN_WAIT',
        priority: 60,
        category: 'STATUS_REMEDY',
        stance: 'WAIT_SAFE',
        icon: '⏳',
        shortMessageJa: 'スタン中: 攻撃を控えその場で待機',
        shortMessageEn: 'Stunned: Hold attacks and wait in place',
        detailWhyJa: 'スタン中は命中率が激減し行動が乱れます。足踏み待機で回復を待ちます。',
        detailWhyEn: 'Stun reduces hit accuracy drastically. Wait in place until recovered.',
        wikiTopic: 'Stunned',
        defaultKeySequence: ['.'],
        actionLabelJa: '足踏み待機 (.)',
        actionLabelEn: 'Wait in place (.)',
        isSafe: true
    },

    // 9. 幻覚
    'SIGNAL_HALLU_CAUTION': {
        id: 'SIGNAL_HALLU_CAUTION',
        priority: 55,
        category: 'STATUS_REMEDY',
        stance: 'CAUTION',
        icon: '🔍',
        shortMessageJa: '幻覚中: 見た目に惑わされず待機',
        shortMessageEn: 'Hallucinating: Do not trust appearances',
        detailWhyJa: 'モンスターやアイテムの表示が偽装されています。危険な敵の誤認に注意してください。',
        detailWhyEn: 'Monsters and items are disguised randomly. Be cautious of true identities.',
        wikiTopic: 'Hallucination',
        defaultKeySequence: ['.'],
        actionLabelJa: '足踏み待機 (.)',
        actionLabelEn: 'Wait in place (.)',
        isSafe: true
    },

    // 10. 呪縛
    'SIGNAL_CURSED_SCROLL': {
        id: 'SIGNAL_CURSED_SCROLL',
        priority: 50,
        category: 'STATUS_REMEDY',
        stance: 'CURE',
        icon: '📜',
        shortMessageJa: '呪縛: 解呪の巻物(r)で装備解除可能',
        shortMessageEn: 'Cursed: Read remove curse (r) to unequip',
        detailWhyJa: '呪われた装備を外すには解呪の巻物(r)または解呪魔法が必要です。',
        detailWhyEn: 'Read remove curse scroll (r) to unequip cursed items.',
        wikiTopic: 'Curse',
        defaultKeySequence: ['r', '{invlet}'],
        actionLabelJa: '解呪の巻物を読む (r -> {invlet})',
        actionLabelEn: 'Read remove curse scroll (r -> {invlet})'
    },

    // 11. 戦闘・浮遊する目玉
    'SIGNAL_FLOATING_EYE_BLINDFOLD': {
        id: 'SIGNAL_FLOATING_EYE_BLINDFOLD',
        priority: 76,
        category: 'TACTICAL_COMBAT',
        stance: 'EQUIP',
        icon: '🙈',
        shortMessageJa: '浮遊する目玉: 目隠し着用で安全接近',
        shortMessageEn: 'Floating Eye: Wear blindfold to approach safely',
        detailWhyJa: '目隠しやタオルを着用して盲目状態になると、目玉の麻痺凝視を受けずに近接攻撃できます。',
        detailWhyEn: 'Wearing a blindfold prevents paralysis gaze, allowing safe melee attacks.',
        wikiTopic: 'Floating_eye',
        defaultKeySequence: ['P', '{invlet}'],
        actionLabelJa: '目隠しを着用する (P -> {invlet})',
        actionLabelEn: 'Wear blindfold (P -> {invlet})'
    },
    'SIGNAL_FLOATING_EYE_RANGED': {
        id: 'SIGNAL_FLOATING_EYE_RANGED',
        priority: 78,
        category: 'TACTICAL_COMBAT',
        stance: 'RANGED',
        icon: '⚠️',
        shortMessageJa: '浮遊する目玉: 近接禁止！遠隔攻撃推奨',
        shortMessageEn: 'Floating Eye: Do NOT melee! Use ranged attacks',
        detailWhyJa: '素手や通常武器で直接攻撃すると、麻痺して一方的にタコ殴りにされ死に至ります。投擲や魔法で倒してください。',
        detailWhyEn: 'Melee attack causes long paralysis and death. Use ranged projectiles or spells.',
        wikiTopic: 'Floating_eye',
        defaultKeySequence: ['f'],
        actionLabelJa: '矢筒から発射 (f)',
        actionLabelEn: 'Fire from quiver (f)'
    },

    // 12. 銀弱点モンスター
    'SIGNAL_SILVER_WEAPON_EQUIP': {
        id: 'SIGNAL_SILVER_WEAPON_EQUIP',
        priority: 68,
        category: 'TACTICAL_COMBAT',
        stance: 'EQUIP',
        icon: '⚔️',
        shortMessageJa: '銀弱点敵: 銀の武器への持替推奨',
        shortMessageEn: 'Silver Vulnerable: Wield silver weapon',
        detailWhyJa: '悪魔や人狼系モンスターには銀製武器による特効追加ダメージ(1d20)が有効です。',
        detailWhyEn: 'Silver weapons deal massive bonus damage (1d20) against demons and lycanthropes.',
        wikiTopic: 'Silver',
        defaultKeySequence: ['w', '{invlet}'],
        actionLabelJa: '銀の武器を装備 (w -> {invlet})',
        actionLabelEn: 'Wield silver weapon (w -> {invlet})'
    },

    // 13. 反射持ちモンスター
    'SIGNAL_MONSTER_REFLECTING': {
        id: 'SIGNAL_MONSTER_REFLECTING',
        priority: 72,
        category: 'TACTICAL_COMBAT',
        stance: 'CAUTION',
        icon: '🛡️',
        shortMessageJa: '反射敵: ビーム跳ね返り自爆に注意',
        shortMessageEn: 'Reflecting Monster: Beware beam rebound!',
        detailWhyJa: '銀竜などの反射持ち敵に直線光線（火・冷気・死の杖等）を撃つと、跳ね返って自分が直撃を受けます。',
        detailWhyEn: 'Beams bounce off silver dragons and can kill you. Use physical attacks instead.',
        wikiTopic: 'Reflection',
        defaultKeySequence: ['f'],
        actionLabelJa: '物理投擲攻撃 (f)',
        actionLabelEn: 'Ranged physical attack (f)'
    },

    // 14. 魔法防具干渉
    'SIGNAL_ARMOR_MAGIC_PENALTY': {
        id: 'SIGNAL_ARMOR_MAGIC_PENALTY',
        priority: 45,
        category: 'EQUIPMENT_MAGIC',
        stance: 'CAUTION',
        icon: '🪄',
        shortMessageJa: '防具干渉: 魔法失敗率高（杖を推奨）',
        shortMessageEn: 'Armor Penalty: High spell failure (use wands)',
        detailWhyJa: '金属製の鎧や兜を装備していると魔法失敗率が跳ね上がります。金属防具を脱ぐか、同じ効果の杖を使用してください。',
        detailWhyEn: 'Metallic armor causes massive spellcasting penalty. Remove metal gear or use wands.',
        wikiTopic: 'Spell_casting_penalty',
        defaultKeySequence: ['z'],
        actionLabelJa: '杖を振る (z)',
        actionLabelEn: 'Zap wand (z)'
    },

    // 15. ランドマーク (流し台・祭壇・階段)
    'SIGNAL_LANDMARK_SINK_RING': {
        id: 'SIGNAL_LANDMARK_SINK_RING',
        priority: 35,
        category: 'UTILITY',
        stance: 'CAUTION',
        icon: '🚰',
        shortMessageJa: '未識別指輪: 流し台に落として識別(d) ※現物は消滅',
        shortMessageEn: 'Unidentified ring: Drop in sink (d) *Ring is lost*',
        detailWhyJa: '流し台(Sink)の上で指輪を落とすと固有の効果音から種類を識別できます。※落とした指輪は排水口に流れて消滅するため不要な指輪を推奨します。',
        detailWhyEn: 'Dropping a ring down a sink identifies its type. WARNING: The dropped ring is lost forever down the drain!',
        wikiTopic: 'Sink',
        defaultKeySequence: ['d'],
        actionLabelJa: 'アイテムを落とす (d)',
        actionLabelEn: 'Drop item (d)'
    },
    'SIGNAL_LANDMARK_ALTAR_SACRIFICE': {
        id: 'SIGNAL_LANDMARK_ALTAR_SACRIFICE',
        priority: 32,
        category: 'UTILITY',
        stance: 'CAUTION',
        icon: '⛪',
        shortMessageJa: '捧げ物可能: この階の祭壇に死体を捧げて神の恩恵を獲得 (#offer)',
        shortMessageEn: 'Sacrifice available: Offer corpse at altar (#offer)',
        detailWhyJa: '属性の一致する祭壇で新鮮な死体を捧げると、神の好感度上昇やアーティファクト下賜の恩恵が得られます。',
        detailWhyEn: 'Sacrificing fresh corpses at an aligned altar grants divine favor and gifts.',
        wikiTopic: 'Altar',
        defaultKeySequence: ['#', 'offer'],
        actionLabelJa: '捧げ物をする (#offer)',
        actionLabelEn: 'Offer sacrifice (#offer)'
    },
    'SIGNAL_LANDMARK_STAIR_ESCAPE': {
        id: 'SIGNAL_LANDMARK_STAIR_ESCAPE',
        priority: 82,
        category: 'SURVIVAL',
        stance: 'WAIT_SAFE',
        icon: '🪜',
        shortMessageJa: '退避推奨: 上り階段へ移動して体制を立て直す',
        shortMessageEn: 'Retreat recommended: Move to stairs up to recover',
        detailWhyJa: '瀕死かつ回復手段がない場合、上の階層へ退避して安全な場所で足踏み回復を図るのが有効です。',
        detailWhyEn: 'Retreating upstairs allows safe resting in previously cleared rooms.',
        wikiTopic: 'Stairs',
        defaultKeySequence: ['<'],
        actionLabelJa: '階段を上る (<)',
        actionLabelEn: 'Go up stairs (<)'
    }
};

/**
 * シグナルマスター定義からパラメータをバインドして完成したシグナルオブジェクトを生成するファクトリ関数
 * @param {string} signalId 
 * @param {Object} [params={}] 
 * @returns {Object|null}
 */
export function createAssistSignal(signalId, params = {}) {
    const def = ASSIST_SIGNAL_DEFINITIONS[signalId];
    if (!def) {
        console.warn(`[AssistSignalSynthesizer] Unknown signal definition ID: ${signalId}`);
        return null;
    }

    const {
        invlet = 'a',
        spellKey = 'a',
        detailWhyJa = null,
        detailWhyEn = null,
        actionKeySequence = null,
        actionLabelJa = null,
        actionLabelEn = null,
        isSafe = def.isSafe || false
    } = params;

    // キーシーケンスの動的置換
    let finalKeySequence = actionKeySequence;
    if (!finalKeySequence && def.defaultKeySequence) {
        finalKeySequence = def.defaultKeySequence.map(k => {
            if (k === '{invlet}') return invlet;
            if (k === '{spellKey}') return spellKey;
            return k;
        });
    }

    // アクションラベルの動的置換
    const replacePlaceholders = (text) => {
        if (!text) return text;
        return text.replace(/\{invlet\}/g, invlet).replace(/\{spellKey\}/g, spellKey);
    };

    const finalActionLabelJa = actionLabelJa || replacePlaceholders(def.actionLabelJa);
    const finalActionLabelEn = actionLabelEn || replacePlaceholders(def.actionLabelEn);
    const finalDetailWhyJa = detailWhyJa || def.detailWhyJa;
    const finalDetailWhyEn = detailWhyEn || def.detailWhyEn;

    const signal = {
        id: def.id,
        priority: def.priority,
        category: def.category,
        stance: def.stance,
        icon: def.icon,
        shortMessageJa: def.shortMessageJa,
        shortMessageEn: def.shortMessageEn,
        detailWhyJa: finalDetailWhyJa,
        detailWhyEn: finalDetailWhyEn,
        wikiTopic: def.wikiTopic,
        actionKeySequence: finalKeySequence,
        actionLabelJa: finalActionLabelJa,
        actionLabelEn: finalActionLabelEn
    };

    if (isSafe) {
        signal.isSafe = true;
    }

    return signal;
}
