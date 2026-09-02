/**
 * ADVICE_DEFINITIONS.js
 *
 * 【戦術・危険・装備アドバイス マスター定義テーブル (SSOT)】
 * 
 * TacticalAdvisor.js からメッセージ直書きや個別設定値を完全排除し、
 * すべてのアドバイス定義（ID、重要度、スコア、コマンド、多言語テンプレート）を一元管理する。
 */

export const ADVICE_DEFINITIONS = {
    // 1. 石化関連
    'ADVICE_THREAT_PETRIFICATION': {
        id: 'ADVICE_THREAT_PETRIFICATION',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 1000,
        defaultCommand: 'W',
        fallbackCommand: 'f',
        templateJa: '⚠️ 危険: {monster}が接近！手袋未着用のため素手・直接接触で即死(石化)します。手袋着用または遠隔攻撃を推奨。',
        templateEn: '⚠️ DANGER: {monster} approaching! Touching without gloves causes instant petrification. Wear gloves or use ranged attacks.'
    },
    'ADVICE_THREAT_PETRIFICATION_UNSEEN': {
        id: 'ADVICE_THREAT_PETRIFICATION_UNSEEN',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 800,
        defaultCommand: 'W',
        fallbackCommand: 'f',
        templateJa: '⚠️ 警戒: 付近に{monster}が潜伏中！再接敵に備えて手袋の事前着用を強く推奨。',
        templateEn: '⚠️ CAUTION: {monster} lurking nearby! Wear gloves in advance before engaging.'
    },
    'ADVICE_THREAT_PETRIFICATION_DECAY': {
        id: 'ADVICE_THREAT_PETRIFICATION_DECAY',
        severity: 'INFO',
        topic: 'THREAT',
        baseScore: 400,
        defaultCommand: 'W',
        fallbackCommand: 'f',
        templateJa: '⚠️ 周辺警戒: {monster}の気配あり。手袋未着用の場合は事前着用を推奨。',
        templateEn: '⚠️ NOTICE: Trace of {monster} detected nearby. Consider wearing gloves.'
    },
    'ADVICE_THREAT_PETRIFICATION_SAFE': {
        id: 'ADVICE_THREAT_PETRIFICATION_SAFE',
        severity: 'INFO',
        topic: 'THREAT',
        baseScore: 300,
        templateJa: '🛡️ 防護済み: {monster}が接近中ですが、手袋着用/石化耐性により直接接触時の即死は防止されています。',
        templateEn: '🛡️ PROTECTED: {monster} nearby, but gloves/stoning resistance protect against instant petrification.'
    },

    // 2. 視線麻痺関連 (浮遊目玉等)
    'ADVICE_THREAT_FLOATING_EYE': {
        id: 'ADVICE_THREAT_FLOATING_EYE',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 700,
        defaultCommand: 'W',
        fallbackCommand: 'f',
        templateJa: '⚠️ 警告: 浮遊する目玉(Floating Eye)を直視・近接攻撃すると麻痺します。目隠し着用または飛び道具で攻撃してください。',
        templateEn: '⚠️ WARNING: Attacking Floating Eye in melee causes severe paralysis. Wear a blindfold or attack from range.'
    },
    'ADVICE_THREAT_FLOATING_EYE_UNSEEN': {
        id: 'ADVICE_THREAT_FLOATING_EYE_UNSEEN',
        severity: 'INFO',
        topic: 'THREAT',
        baseScore: 560,
        defaultCommand: 'W',
        fallbackCommand: 'f',
        templateJa: '⚠️ 警戒: 付近に浮遊する目玉(Floating Eye)が潜伏中。目隠し着用または飛び道具の準備を推奨。',
        templateEn: '⚠️ CAUTION: Floating Eye lurking nearby. Prepare blindfold or ranged attacks.'
    },
    'ADVICE_THREAT_FLOATING_EYE_SAFE': {
        id: 'ADVICE_THREAT_FLOATING_EYE_SAFE',
        severity: 'INFO',
        topic: 'THREAT',
        baseScore: 300,
        templateJa: '🛡️ 麻痺無効: {monster}の麻痺視線は{reason}により無効化されています。',
        templateEn: '🛡️ PARALYSIS IMMUNE: {monster} gaze is negated by {reason}.'
    },

    // 3. 毒警告 (キラービー・ソルジャーアント等)
    'ADVICE_THREAT_POISON': {
        id: 'ADVICE_THREAT_POISON',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 700,
        templateJa: '⚠️ 毒警戒: {monster}が接近！毒耐性がないため致命的な毒ダメージを受けます。遠距離武器やエルベレスで迎撃してください。',
        templateEn: '⚠️ POISON HAZARD: {monster} approaching! Lethal poison damage without poison resistance. Fight from range or use Elbereth.'
    },
    'ADVICE_THREAT_POISON_SAFE': {
        id: 'ADVICE_THREAT_POISON_SAFE',
        severity: 'INFO',
        topic: 'THREAT',
        baseScore: 300,
        templateJa: '🛡️ 毒耐性あり: {monster}が接近中ですが、毒耐性があるため毒による即死・追加ダメージは無効化されます。',
        templateEn: '🛡️ POISON IMMUNE: {monster} approaching, but poison resistance protects from lethal damage.'
    },

    // 4. 近接自爆警告 (ガス胞子・フレイミングスフィア等)
    'ADVICE_THREAT_GAS_SPORE': {
        id: 'ADVICE_THREAT_GAS_SPORE',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 850,
        defaultCommand: 'f',
        templateJa: '⚠️ 警告: {monster}が隣接しています！近接攻撃すると大爆発します。後退するか飛び道具で撃破してください。',
        templateEn: '⚠️ WARNING: {monster} adjacent! Melee attack triggers massive explosion. Step back or shoot from range.'
    },

    // 5. レベルドレイン警告 (吸血鬼・レイス等)
    'ADVICE_THREAT_LEVEL_DRAIN': {
        id: 'ADVICE_THREAT_LEVEL_DRAIN',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 820,
        defaultCommand: 'f',
        templateJa: '🩸 ドレイン警戒: {monster}が接近！ドレイン耐性がないため経験レベルが吸い取られます。遠隔やエルベレスで迎撃してください。',
        templateEn: '🩸 LEVEL DRAIN WARNING: {monster} nearby! Attacks drain experience level without drain resistance. Fight from range.'
    },
    'ADVICE_THREAT_LEVEL_DRAIN_SAFE': {
        id: 'ADVICE_THREAT_LEVEL_DRAIN_SAFE',
        severity: 'INFO',
        topic: 'THREAT',
        baseScore: 300,
        templateJa: '🛡️ ドレイン耐性あり: {monster}が接近中ですが、ドレイン耐性により経験レベルの低下は防止されています。',
        templateEn: '🛡️ DRAIN RESISTANT: {monster} nearby, but drain resistance prevents level loss.'
    },

    // 6. 装備腐食・錆び警告 (ラストモンスター等)
    'ADVICE_THREAT_RUST_MONSTER': {
        id: 'ADVICE_THREAT_RUST_MONSTER',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 750,
        defaultCommand: 'w',
        templateJa: '🛡️ 腐食警告: {monster}が接近！鉄製装備が錆びて劣化・破壊されます。木製/銀製装備への持ち替えや素手・遠隔攻撃を推奨。',
        templateEn: '🛡️ RUST HAZARD: {monster} approaching! It rusts and destroys iron gear. Switch to wooden/silver weapons or fight from range.'
    },

    // 7. 知性吸い・脳食い警告 (マインドフレア等)
    'ADVICE_THREAT_MIND_FLAYER': {
        id: 'ADVICE_THREAT_MIND_FLAYER',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 950,
        defaultCommand: 'f',
        templateJa: '🧠 脳食い危険: マインドフレア(Mind Flayer)接近！触手攻撃で知力を吸い尽くされると即死します。エルベレスや遠隔即死で処理してください。',
        templateEn: '🧠 BRAIN EATER DANGER: Mind Flayer nearby! Tentacle attacks permanently eat Int until instant death. Use Elbereth or ranged attacks.'
    },

    // 8. スライム化警告 (グリーンスライム)
    'ADVICE_THREAT_GREEN_SLIME': {
        id: 'ADVICE_THREAT_GREEN_SLIME',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 920,
        defaultCommand: 'f',
        templateJa: '🧪 スライム化警告: グリーンスライム(Green Slime)接近！接触でスライム化即死します。火炎攻撃または遠隔で速やかに撃破してください。',
        templateEn: '🧪 SLIME THREAT: Green Slime nearby! Contact turns player into slime. Use fire attacks or ranged weapons.'
    },

    // 9. 水中引き込み・溺死警告 (クラーケン・ウナギ等)
    'ADVICE_THREAT_DROWNING': {
        id: 'ADVICE_THREAT_DROWNING',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 960,
        templateJa: '🌊 溺死警告: 水生魔獣が潜伏！浮遊・水上歩行なしで水辺に近づくと引きずり込まれ即座に溺死します。',
        templateEn: '🌊 DROWNING HAZARD: Aquatic monster nearby! Approaching water without levitation/water-walking causes instant drowning.'
    },

    // 10. 視線混乱警告 (アンバーハルク等)
    'ADVICE_THREAT_CONFUSION_GAZE': {
        id: 'ADVICE_THREAT_CONFUSION_GAZE',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 680,
        defaultCommand: 'W',
        templateJa: '💫 混乱視線警告: アンバーハルク(Umber Hulk)の視線で混乱します。目隠し(Blindfold)やタオルを着用して視界を遮断してください。',
        templateEn: '💫 CONFUSION GAZE: Umber Hulk gaze causes severe confusion. Wear a blindfold/towel to block sight.'
    },

    // 11. 足元死体警告
    'ADVICE_HAZARD_PETRIFY_CORPSE': {
        id: 'ADVICE_HAZARD_PETRIFY_CORPSE',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 990,
        defaultCommand: 'W',
        templateJa: '⚠️ 致命的危険: 足元にコカトリスの死体があります！手袋未着用で拾う/触ると即座に石化死します。手袋を着用してください。',
        templateEn: '⚠️ LETHAL HAZARD: Cockatrice corpse at feet! Picking up without gloves causes instant petrification. Wear gloves first.'
    },
    'ADVICE_TACTICS_EAT_WRAITH_CORPSE': {
        id: 'ADVICE_TACTICS_EAT_WRAITH_CORPSE',
        severity: 'TIP',
        topic: 'SURVIVAL',
        baseScore: 800,
        defaultCommand: 'e',
        templateJa: "✨ レベルアップ: 足元のレイスの死体を食べる('e')と経験レベルが1上昇します！腐る前に摂取してください。",
        templateEn: "✨ LEVEL UP: Eating wraith corpse ('e') grants +1 level! Eat before it rots."
    },

    // 12. 周辺認知レーダー
    'ADVICE_THREAT_PERCEIVED_RADAR': {
        id: 'ADVICE_THREAT_PERCEIVED_RADAR',
        severity: 'INFO',
        topic: 'THREAT',
        baseScore: 250,
        templateJa: '🧭 周辺の気配: モンスターを認知中 [{summaryJa}]',
        templateEn: '🧭 Perceived Radar: Monsters detected [{summaryEn}]'
    },

    // 13. 地形ハザード (溶岩・水場・罠)
    'ADVICE_HAZARD_LAVA': {
        id: 'ADVICE_HAZARD_LAVA',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 980,
        templateJa: '🌋 溶岩警告: 周辺に溶岩(Lava)があります！浮遊手段なしで侵入すると即死・全アイテムが焼失します。',
        templateEn: '🌋 LAVA HAZARD: Lava nearby! Stepping without levitation causes instant death & destroys all items.'
    },
    'ADVICE_HAZARD_WATER': {
        id: 'ADVICE_HAZARD_WATER',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 650,
        defaultCommand: 'P',
        requireLettersForCommand: true,
        templateJa: '🌊 水場警告: 周辺に水場(Pool/Water)があります。浮遊・水上歩行なしで侵入すると装備の錆びや巻物・薬の水没劣化・溺死リスクがあります。',
        templateEn: '🌊 WATER HAZARD: Water nearby! Entering without levitation/water-walking rusts armor, drowns or ruins potions/scrolls.'
    },
    'ADVICE_HAZARD_TRAP': {
        id: 'ADVICE_HAZARD_TRAP',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 550,
        templateJa: '⚠️ 罠検知: 周辺に露出した罠(Trap)があります。踏まないよう迂回するか慎重に解除してください。',
        templateEn: '⚠️ TRAP HAZARD: Revealed trap nearby. Avoid stepping on it or disarm carefully.'
    },

    // 14. アイテムハザード (手品袋爆発)
    'ADVICE_HAZARD_BAG_OF_HOLDING_EXPLOSION': {
        id: 'ADVICE_HAZARD_BAG_OF_HOLDING_EXPLOSION',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 1050,
        templateJa: '💥 爆発危険: 手品袋 [{bagLetter}] に魔法の袋 [{hazardLetters}] や打ち消しの杖を入れると大爆発し全アイテムが消滅・即死します！',
        templateEn: '💥 EXPLOSION HAZARD: Putting magical bag [{hazardLetters}] into Bag of Holding [{bagLetter}] causes catastrophic explosion & destroys all items!'
    },

    // 15. 熟練装備
    'ADVICE_EQUIP_SKILLED_WEAPON': {
        id: 'ADVICE_EQUIP_SKILLED_WEAPON',
        severity: 'TIP',
        topic: 'EQUIPMENT',
        baseScore: 300,
        defaultCommand: 'w',
        templateJa: '💡 熟練武器: [{letter}] {itemName} (熟練度: {rankJa}) の方が高い戦闘効果を発揮します。',
        templateEn: '💡 Skilled Weapon: [{letter}] {itemName} (Skill: {rankEn}) is more effective.'
    },

    // 16. 魔法阻害
    'ADVICE_MAGIC_METALLIC_ARMOR': {
        id: 'ADVICE_MAGIC_METALLIC_ARMOR',
        severity: 'WARNING',
        topic: 'MAGIC',
        baseScore: 500,
        defaultCommand: 'T',
        templateJa: '⚠️ 魔法阻害: 金属製防具 [{letters}] により魔法詠唱失敗率が上昇しています。ローブ等の非金属防具への着替えを推奨。',
        templateEn: '⚠️ Spellcasting Penalty: Metallic armor [{letters}] increases spell failure rate. Switch to non-metallic armor.'
    },

    // 17. サバイバル
    'ADVICE_SURVIVAL_LOW_HP': {
        id: 'ADVICE_SURVIVAL_LOW_HP',
        severity: 'CRITICAL',
        topic: 'SURVIVAL',
        baseScore: 950,
        defaultCommand: 'q',
        templateJa: '🚨 瀕死警告: HPが残り{hp}/{maxHp} ({percent}%) です！回復薬や脱出手段を検討してください。',
        templateEn: '🚨 CRITICAL HP: Health is at {hp}/{maxHp} ({percent}%)! Quaff healing potions or escape immediately.'
    },
    'ADVICE_SURVIVAL_STARVATION': {
        id: 'ADVICE_SURVIVAL_STARVATION',
        severity: 'CRITICAL',
        topic: 'SURVIVAL',
        baseScore: 900,
        defaultCommand: 'e',
        templateJa: '🍖 飢餓警告: 空腹度が「{hunger}」です！餓死する前に直ちに食料を摂取してください。',
        templateEn: '🍖 STARVATION WARNING: Hunger state is "{hunger}"! Eat food immediately before fainting/starving.'
    },

    // 18. サルベージ追加アドバイス (モンスター特殊戦術)
    'ADVICE_THREAT_MEDUSA_MIRROR': {
        id: 'ADVICE_THREAT_MEDUSA_MIRROR',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 1020,
        defaultCommand: 'a',
        templateJa: '🪞 メデューサ対策: 視線を合わせると即座に石化死します！手鏡(Mirror)を適用(\'a\')して視線を反射自爆させるか、目隠しを着用してください。',
        templateEn: '🪞 MEDUSA COUNTER: Petrifying gaze! Apply mirror (\'a\') to reflect gaze back, or wear a blindfold.'
    },
    'ADVICE_THREAT_LYCANTHROPY': {
        id: 'ADVICE_THREAT_LYCANTHROPY',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 680,
        defaultCommand: 'e',
        templateJa: '🐺 人獣化警告: {monster}に噛まれると人獣化に感染します！銀製武器で速やかに撃破し、感染時はトリカブト(Wolfsbane)を摂取(\'e\')してください。',
        templateEn: '🐺 LYCANTHROPY: {monster} bite transmits infection! Slay with silver weapons; eat wolfsbane (\'e\') if infected.'
    },
    'ADVICE_THREAT_SWALLOW_ESCAPE': {
        id: 'ADVICE_THREAT_SWALLOW_ESCAPE',
        severity: 'CRITICAL',
        topic: 'SURVIVAL',
        baseScore: 1000,
        defaultCommand: 'z',
        templateJa: '🐋 丸呑み脱出: 胃袋に丸呑みされています！消化される前に掘削の杖(Wand of Digging)や鋭利な刃物で脱出してください。',
        templateEn: '🐋 SWALLOWED: Trapped in stomach! Zap Wand of Digging or attack with sharp blade to cut your way out.'
    },
    'ADVICE_TACTICS_TROLL_REVIVE': {
        id: 'ADVICE_TACTICS_TROLL_REVIVE',
        severity: 'WARNING',
        topic: 'TACTICS',
        baseScore: 620,
        defaultCommand: 'e',
        templateJa: '🧟 トロール復活注意: トロールの死体は放置すると自然復活します！食べる(\'e\')、火炎で焼く、または缶詰にして復活を阻止してください。',
        templateEn: '🧟 TROLL REVIVAL: Troll corpse will revive unless eaten (\'e\'), burned with fire, or tinned.'
    },
    'ADVICE_THREAT_PEACEFUL_SHOPKEEPER': {
        id: 'ADVICE_THREAT_PEACEFUL_SHOPKEEPER',
        severity: 'WARNING',
        topic: 'THREAT',
        baseScore: 700,
        templateJa: '🏪 店主NPC注意: 店主は平和的です。攻撃や泥棒を行うと激怒し、俊足と強力な杖攻撃で即死級の脅威となります！',
        templateEn: '🏪 SHOPKEEPER: Peaceful merchant. Attacking or stealing angers them into an extremely lethal threat!'
    },
    'ADVICE_THREAT_RIDER_LETHAL': {
        id: 'ADVICE_THREAT_RIDER_LETHAL',
        severity: 'CRITICAL',
        topic: 'THREAT',
        baseScore: 1100,
        templateJa: '💀 黙示録の騎手: {monster}が接近！直接接触は極めて致命的です。遠距離から杖や飛び道具で撃破してください。',
        templateEn: '💀 APOCALYPTIC RIDER: {monster} approaching! Melee touch is lethal. Attack from distance with wands or missiles.'
    },

    // 19. サルベージ追加アドバイス (アイテム特殊Tips)
    'ADVICE_ITEM_ATHAME_ELBERETH': {
        id: 'ADVICE_ITEM_ATHAME_ELBERETH',
        severity: 'TIP',
        topic: 'TACTICS',
        baseScore: 500,
        defaultCommand: 'E',
        templateJa: '✍️ エルベレス刻み: アサメ(Athame)は刃を傷めることなく床に100%安全にElberethを刻む(\'E\')ことができます。',
        templateEn: '✍️ SAFE ELBERETH: Athame engraves Elbereth (\'E\') safely without dulling the blade.'
    },
    'ADVICE_ITEM_LIZARD_CORPSE_CURE': {
        id: 'ADVICE_ITEM_LIZARD_CORPSE_CURE',
        severity: 'TIP',
        topic: 'SURVIVAL',
        baseScore: 750,
        defaultCommand: 'e',
        templateJa: '🦎 石化治療備蓄: トカゲの死体(Lizard corpse)は腐敗せず、食べるとコカトリスの石化進行を即座に治療できます。',
        templateEn: '🦎 STONING CURE: Lizard corpse never rots and instantly cures cockatrice stoning when eaten (\'e\').'
    },
    'ADVICE_ITEM_TRIPE_RATION_TAME': {
        id: 'ADVICE_ITEM_TRIPE_RATION_TAME',
        severity: 'TIP',
        topic: 'TACTICS',
        baseScore: 400,
        defaultCommand: 't',
        templateJa: '🥩 ペット調教: トリップ肉(Tripe ration)を野良の犬・猫・狼に投擲(\'t\')すると飼い慣らして仲間にできます。',
        templateEn: '🥩 TAMING: Throwing (\'t\') tripe ration at wild dogs, cats, or wolves tames them into pets.'
    },
    'ADVICE_ITEM_GOLD_TEMPLE_DONATION': {
        id: 'ADVICE_ITEM_GOLD_TEMPLE_DONATION',
        severity: 'TIP',
        topic: 'TACTICS',
        baseScore: 450,
        defaultCommand: 'd',
        templateJa: '🪙 寺院加護: 寺院の僧侶に十分な金貨を寄付すると、永久的なACボーナス(神の加護/Protection)を獲得できます。',
        templateEn: '🪙 TEMPLE PROTECTION: Donating gold to temple priests grants permanent AC bonus (divine protection).'
    },
    'ADVICE_ITEM_CRYSKNIFE_BRITTLE': {
        id: 'ADVICE_ITEM_CRYSKNIFE_BRITTLE',
        severity: 'CAUTION',
        topic: 'EQUIPMENT',
        baseScore: 350,
        templateJa: '⚠️ クリスナイフ注意: クリスナイフは床に落とすと壊れて消滅する恐れがあります。所持したまま管理してください。',
        templateEn: '⚠️ BRITTLE BLADE: Crysknife may shatter if dropped on the floor. Keep it in inventory.'
    }
};

/**
 * マスター定義から動的アドバイスオブジェクトを生成するヘルパー関数
 * @param {string} id - ADVICE_DEFINITIONS のキー
 * @param {Object} [params={}] - テンプレート埋め込みパラメータ ({ monster, monsterJa, ... })
 * @param {Object} [overrides={}] - スコア、重要度、ヒントレター等の上書きプロパティ
 * @returns {Object} Advice オブジェクト
 */
export function createAdvice(id, params = {}, overrides = {}) {
    const def = ADVICE_DEFINITIONS[id];
    if (!def) {
        console.warn(`[TacticalAdvisor] Unknown advice definition ID: ${id}`);
        return null;
    }

    let messageJa = overrides.templateJa || overrides.messageJa || def.templateJa;
    let messageEn = overrides.templateEn || overrides.messageEn || def.templateEn;

    // パラメータ置換 (言語別パラメータ monsterJa/monsterEn や共通パラメータに対応)
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        const reg = new RegExp(`\\{${k}\\}`, 'g');
        messageJa = messageJa.replace(reg, v);
        messageEn = messageEn.replace(reg, v);
    }

    // monsterJa / monsterEn の個別置換対応
    if (params.monsterJa) {
        messageJa = messageJa.replace(/\{monster\}/g, params.monsterJa);
    }
    if (params.monsterEn) {
        messageEn = messageEn.replace(/\{monster\}/g, params.monsterEn);
    }
    if (params.reasonJa) {
        messageJa = messageJa.replace(/\{reason\}/g, params.reasonJa);
    }
    if (params.reasonEn) {
        messageEn = messageEn.replace(/\{reason\}/g, params.reasonEn);
    }

    const hintLetters = overrides.hintLetters !== undefined ? overrides.hintLetters : (params.hintLetters || []);
    
    // hintCommand の解決: overrides > (hintLetters がある場合は defaultCommand、なければ fallbackCommand または defaultCommand)
    let hintCommand = overrides.hintCommand;
    if (hintCommand === undefined) {
        if (hintLetters.length > 0) {
            hintCommand = def.defaultCommand || undefined;
        } else if (def.fallbackCommand) {
            hintCommand = def.fallbackCommand;
        } else if (def.defaultCommand && !def.requireLettersForCommand) {
            hintCommand = def.defaultCommand;
        }
    }

    return {
        id: def.id,
        severity: overrides.severity || def.severity,
        topic: overrides.topic || def.topic,
        messageJa,
        messageEn,
        hintLetters,
        hintCommand,
        score: overrides.score !== undefined ? overrides.score : def.baseScore
    };
}
