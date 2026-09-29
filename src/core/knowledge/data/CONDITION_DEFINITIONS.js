/**
 * CONDITION_DEFINITIONS.js
 *
 * 【GKL 状態異常マスター定義テーブル (SSOT)】
 *
 * NetHack 3.7 / 5.0 における BL_CONDITION (CDT フラグ全30種)、
 * 空腹度 (BL_HUNGER)、負荷 (BL_CAP) の全状態を一元定義するマスターデータ。
 * 
 * 深刻度 (Severity):
 * - FATAL: 即死級（石化、スライム化、窒息、餓死寸前、溶岩中等）
 * - CRITICAL: 深刻・行動不能（麻痺、睡眠、気絶、食中毒、致死病、失神等）
 * - WARNING: 危険・行動制限（混乱、盲目、朦朧、幻覚、衰弱、拘束等）
 * - INFO: 状況・軽微（浮遊、飛行、騎乗、空腹、満腹、初期負荷等）
 */

export const CONDITION_SEVERITY = {
    FATAL: 'fatal',
    CRITICAL: 'critical',
    WARNING: 'warning',
    INFO: 'info'
};

export const CONDITION_DEFINITIONS = {
    // ==========================================
    // 1. BL_CONDITION (CDT フラグ全30種 & 短縮形)
    // ==========================================

    // 致命的即死級 (FATAL)
    'stoned': {
        key: 'stoned',
        id: 'COND_STONED',
        nameJa: '石化進行中',
        nameEn: 'Petrifying',
        labelJa: '🗿石化',
        labelEn: '🗿Stone',
        icon: '🗿',
        severity: CONDITION_SEVERITY.FATAL,
        descriptionJa: '体が徐々に石化しています！完了すると即死します。トカゲの死体や祈願で解除してください。',
        descriptionEn: 'You are slowing turning to stone! Cure immediately with a lizard corpse or prayer.'
    },
    'slimed': {
        key: 'slimed',
        id: 'COND_SLIMED',
        nameJa: 'スライム化',
        nameEn: 'Sliming',
        labelJa: '🟢スライム化',
        labelEn: '🟢Slimed',
        icon: '🟢',
        severity: CONDITION_SEVERITY.FATAL,
        descriptionJa: '緑色スライムに変身しつつあります！火の杖や巻物で自分を焼くか、祈って解除してください。',
        descriptionEn: 'You are turning into green slime! Burn yourself with fire or pray.'
    },
    'strangled': {
        key: 'strangled',
        id: 'COND_STRANGLED',
        nameJa: '首絞め/窒息',
        nameEn: 'Strangled',
        labelJa: '🪢絞殺窒息',
        labelEn: '🪢Strangled',
        icon: '🪢',
        severity: CONDITION_SEVERITY.FATAL,
        descriptionJa: '首を絞められて呼吸ができません！数ターン放置すると窒息死します。',
        descriptionEn: 'You are being strangled and choking! Fatal if not dispelled within turns.'
    },
    'inlava': {
        key: 'inlava',
        id: 'COND_IN_LAVA',
        nameJa: '溶岩落下中',
        nameEn: 'In Lava',
        labelJa: '🌋溶岩中',
        labelEn: '🌋In Lava',
        icon: '🌋',
        severity: CONDITION_SEVERITY.FATAL,
        descriptionJa: '煮えたぎる溶岩に浸かっています！速やかに脱出しないと燃え尽きます。',
        descriptionEn: 'You are in boiling lava! Escape immediately.'
    },

    // 深刻・行動不能・重篤病気 (CRITICAL)
    'foodpoisoning': {
        key: 'foodpoisoning',
        id: 'COND_FOOD_POISONING',
        nameJa: '食中毒',
        nameEn: 'Food Poisoning',
        labelJa: '🤢食中毒',
        labelEn: '🤢Food Pois',
        icon: '🤢',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '古い死体を食べて食中毒を起こしています。ユニコーンの角や完全回復の薬で治療してください。',
        descriptionEn: 'You have food poisoning from tainted food. Cure with unicorn horn or extra healing.'
    },
    'termill': {
        key: 'termill',
        id: 'COND_TERMILL',
        nameJa: '致死病/末期病',
        nameEn: 'Terminally Ill',
        labelJa: '☠️末期病',
        labelEn: '☠️Ill',
        icon: '☠️',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '致死的な病気に冒されています！放置すると死亡します。ユーコーンの角等で即座に治療を。',
        descriptionEn: 'You are afflicted with a deadly illness! Fatal without cure.'
    },
    'paralyzed': {
        key: 'paralyzed',
        id: 'COND_PARALYZED',
        nameJa: '麻痺',
        nameEn: 'Paralyzed',
        labelJa: '⚡麻痺',
        labelEn: '⚡Paralyzed',
        icon: '⚡',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '全身が麻痺して一切の行動が取れません！',
        descriptionEn: 'You are stiffened and completely immobilized!'
    },
    'sleeping': {
        key: 'sleeping',
        id: 'COND_SLEEPING',
        nameJa: '睡眠',
        nameEn: 'Asleep',
        labelJa: '💤睡眠',
        labelEn: '💤Asleep',
        icon: '💤',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '深い眠りに落ちています。敵から無防備な攻撃を受けます。',
        descriptionEn: 'You are fast asleep and vulnerable to attacks.'
    },
    'unconscious': {
        key: 'unconscious',
        id: 'COND_UNCONSCIOUS',
        nameJa: '気絶',
        nameEn: 'Unconscious',
        labelJa: '😵気絶',
        labelEn: '😵Unconscious',
        icon: '😵',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '意識を失って倒れています。',
        descriptionEn: 'You have passed out unconscious.'
    },

    // 危険・行動制限 (WARNING)
    'blind': {
        key: 'blind',
        id: 'COND_BLIND',
        nameJa: '盲目',
        nameEn: 'Blind',
        labelJa: '👁️盲目',
        labelEn: '👁️Blind',
        icon: '👁️',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '視界が遮られ周囲が見えません。テレパシーや手探りでの確認が必要です。',
        descriptionEn: 'You cannot see your surroundings. Rely on telepathy or feeling.'
    },
    'confused': {
        key: 'confused',
        id: 'COND_CONFUSED',
        nameJa: '混乱',
        nameEn: 'Confused',
        labelJa: '💫混乱',
        labelEn: '💫Conf',
        icon: '💫',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '足元がおぼつかず、意図した方向と違う方向へ移動したり巻物の効果が狂います。',
        descriptionEn: 'You stumble in random directions and misread scrolls.'
    },
    'stunned': {
        key: 'stunned',
        id: 'COND_STUNNED',
        nameJa: '朦朧',
        nameEn: 'Stunned',
        labelJa: '🌀朦朧',
        labelEn: '🌀Stun',
        icon: '🌀',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '頭を激しく殴られて朦朧としています。命中率が下がり歩行も乱れます。',
        descriptionEn: 'You reel with dizziness, reducing accuracy and staggering.'
    },
    'hallucinating': {
        key: 'hallucinating',
        id: 'COND_HALLUCINATING',
        nameJa: '幻覚',
        nameEn: 'Hallucinating',
        labelJa: '🍄幻覚',
        labelEn: '🍄Hallu',
        icon: '🍄',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '極彩色の幻覚が見え、周囲の敵やアイテムの正体が分からなくなっています。',
        descriptionEn: 'Psychedelic visions alter monster and item appearances.'
    },
    'deaf': {
        key: 'deaf',
        id: 'COND_DEAF',
        nameJa: '難聴/聾',
        nameEn: 'Deaf',
        labelJa: '🔇難聴',
        labelEn: '🔇Deaf',
        icon: '🔇',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '耳が聞こえなくなっています。音による情報が得られません。',
        descriptionEn: 'You are unable to hear sounds in the dungeon.'
    },
    'elfiron': {
        key: 'elfiron',
        id: 'COND_ELF_IRON',
        nameJa: '鉄接触アレルギー',
        nameEn: 'Iron Allergy',
        labelJa: '⛓️鉄不快',
        labelEn: '⛓️Iron Allergy',
        icon: '⛓️',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: 'エルフの体が鉄製品に触れて不快感やダメージを受けています。',
        descriptionEn: 'Iron contact causes severe discomfort to elf physiology.'
    },
    'grabbing': {
        key: 'grabbing',
        id: 'COND_GRABBING',
        nameJa: '掴みかかり中',
        nameEn: 'Grabbing',
        labelJa: '🦀拘束中',
        labelEn: '🦀Grabbing',
        icon: '🦀',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '敵を掴んで拘束しています。',
        descriptionEn: 'You are currently grabbing a creature.'
    },
    'held': {
        key: 'held',
        id: 'COND_HELD',
        nameJa: '捕縛/絡まれ',
        nameEn: 'Held',
        labelJa: '🕸️捕縛',
        labelEn: '🕸️Held',
        icon: '🕸️',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: 'モンスターや蜘蛛の巣に捕まり身動きが取れません！',
        descriptionEn: 'You are trapped or held by a monster or web!'
    },
    'icy': {
        key: 'icy',
        id: 'COND_ICY',
        nameJa: '凍結',
        nameEn: 'Icy',
        labelJa: '🧊凍結',
        labelEn: '🧊Icy',
        icon: '🧊',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '足元が凍りついて滑りやすくなっています。',
        descriptionEn: 'You are sliding on icy footing.'
    },
    'slippery': {
        key: 'slippery',
        id: 'COND_SLIPPERY',
        nameJa: '滑り手',
        nameEn: 'Slippery Hands',
        labelJa: '🧼手が滑る',
        labelEn: '🧼Slippery',
        icon: '🧼',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '手がぬるぬるして武器やアイテムを取り落としやすくなっています。',
        descriptionEn: 'Your hands are slippery and prone to dropping gear.'
    },
    'tethered': {
        key: 'tethered',
        id: 'COND_TETHERED',
        nameJa: '繋留/ロープ拘束',
        nameEn: 'Tethered',
        labelJa: '🪢繋留',
        labelEn: '🪢Tethered',
        icon: '🪢',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: 'ロープや鎖で繋ぎ止められて行動範囲が制限されています。',
        descriptionEn: 'You are physically tethered to an anchor.'
    },
    'trapped': {
        key: 'trapped',
        id: 'COND_TRAPPED',
        nameJa: '罠にかかり中',
        nameEn: 'Trapped',
        labelJa: '🪤罠拘束',
        labelEn: '🪤Trapped',
        icon: '🪤',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: 'トラバサミや落とし穴等の罠に囚われています。',
        descriptionEn: 'You are caught in a trap.'
    },
    'woundedleg': {
        key: 'woundedleg',
        id: 'COND_WOUNDED_LEG',
        nameJa: '足負傷',
        nameEn: 'Wounded Leg',
        labelJa: '🦵足負傷',
        labelEn: '🦵Wounded Leg',
        icon: '🦵',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '脚を怪我しており移動速度が低下しています。',
        descriptionEn: 'Your leg is injured, significantly slowing your movement.'
    },

    // 状況・軽微・有益・状態 (INFO)
    'barehanded': {
        key: 'barehanded',
        id: 'COND_BARE_HANDED',
        nameJa: '素手',
        nameEn: 'Bare Handed',
        labelJa: '👊素手',
        labelEn: '👊Bare Handed',
        icon: '👊',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '武器を装備せず素手で戦っています。',
        descriptionEn: 'You are fighting without any wielded weapon.'
    },
    'busy': {
        key: 'busy',
        id: 'COND_BUSY',
        nameJa: '行動中',
        nameEn: 'Busy',
        labelJa: '⏳行動中',
        labelEn: '⏳Busy',
        icon: '⏳',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '食事や掘削などの連続行動を実行中です。',
        descriptionEn: 'You are busy performing a multi-turn action.'
    },
    'flying': {
        key: 'flying',
        id: 'COND_FLYING',
        nameJa: '飛行',
        nameEn: 'Flying',
        labelJa: '🦅飛行',
        labelEn: '🦅Flying',
        icon: '🦅',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '翼や魔法で空を飛んでいます。水や落とし穴を飛び越えます。',
        descriptionEn: 'You are flying above terrain, avoiding floor hazards.'
    },
    'glowhands': {
        key: 'glowhands',
        id: 'COND_GLOW_HANDS',
        nameJa: '手が光る',
        nameEn: 'Glowing Hands',
        labelJa: '✨手が光る',
        labelEn: '✨Glow Hands',
        icon: '✨',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '手が淡く発光しており素手攻撃に魔法効果が付与されます。',
        descriptionEn: 'Your hands emit magical light.'
    },
    'holding': {
        key: 'holding',
        id: 'COND_HOLDING',
        nameJa: '掴み中',
        nameEn: 'Holding',
        labelJa: '🖐️掴み中',
        labelEn: '🖐️Holding',
        icon: '🖐️',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '相手を捕らえています。',
        descriptionEn: 'You are holding a creature.'
    },
    'levitating': {
        key: 'levitating',
        id: 'COND_LEVITATING',
        nameJa: '浮遊',
        nameEn: 'Levitating',
        labelJa: '🪶浮遊',
        labelEn: '🪶Levitating',
        icon: '🪶',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '宙に浮いています。床の罠を踏みませんがアイテムを拾えません。',
        descriptionEn: 'You are floating in air, unable to reach the floor items.'
    },
    'riding': {
        key: 'riding',
        id: 'COND_RIDING',
        nameJa: '騎乗',
        nameEn: 'Riding',
        labelJa: '🐎騎乗',
        labelEn: '🐎Riding',
        icon: '🐎',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '乗用モンスターに騎乗して移動しています。',
        descriptionEn: 'You are mounted and riding a steed.'
    },
    'submerged': {
        key: 'submerged',
        id: 'COND_SUBMERGED',
        nameJa: '潜水/水中',
        nameEn: 'Submerged',
        labelJa: '🫧潜水',
        labelEn: '🫧Submerged',
        icon: '🫧',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: '水面下に潜っています。',
        descriptionEn: 'You are diving beneath the liquid surface.'
    },

    // ==========================================
    // 2. 空腹度 (BL_HUNGER)
    // ==========================================
    'satiated': {
        key: 'satiated',
        id: 'HUNGER_SATIATED',
        nameJa: '満腹',
        nameEn: 'Satiated',
        labelJa: '🍖満腹',
        labelEn: '🍖Satiated',
        icon: '🍖',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: 'お腹がいっぱいです。無理に食べると窒息死します。',
        descriptionEn: 'You are completely full. Eating more can cause choking.'
    },
    'hungry': {
        key: 'hungry',
        id: 'HUNGER_HUNGRY',
        nameJa: '空腹',
        nameEn: 'Hungry',
        labelJa: '🍽️空腹',
        labelEn: '🍽️Hungry',
        icon: '🍽️',
        severity: CONDITION_SEVERITY.INFO,
        descriptionJa: 'お腹が減ってきています。食料を確保してください。',
        descriptionEn: 'Your stomach is rumbling. Look for food rations.'
    },
    'weak': {
        key: 'weak',
        id: 'HUNGER_WEAK',
        nameJa: '衰弱',
        nameEn: 'Weak',
        labelJa: '🦴衰弱',
        labelEn: '🦴Weak',
        icon: '🦴',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '飢えのため体力が落ちています！すぐに何か食べてください。',
        descriptionEn: 'Hunger has weakened you! Eat food immediately.'
    },
    'fainting': {
        key: 'fainting',
        id: 'HUNGER_FAINTING',
        nameJa: '失神寸前',
        nameEn: 'Fainting',
        labelJa: '⚠️失神寸前',
        labelEn: '⚠️Fainting',
        icon: '⚠️',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '空腹が極限に達し、いつ失神してもおかしくありません！',
        descriptionEn: 'Extreme hunger! You may pass out at any moment.'
    },
    'fainted': {
        key: 'fainted',
        id: 'HUNGER_FAINTED',
        nameJa: '飢餓失神',
        nameEn: 'Fainted',
        labelJa: '💫飢餓失神',
        labelEn: '💫Fainted',
        icon: '💫',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '極度の飢餓で失神しています！無防備です。',
        descriptionEn: 'You have collapsed from extreme starvation!'
    },
    'starved': {
        key: 'starved',
        id: 'HUNGER_STARVED',
        nameJa: '餓死寸前',
        nameEn: 'Starved',
        labelJa: '💀餓死寸前',
        labelEn: '💀Starved',
        icon: '💀',
        severity: CONDITION_SEVERITY.FATAL,
        descriptionJa: '餓死寸前です！食料の摂取または神への祈りで命をつないでください。',
        descriptionEn: 'Starvation is imminent! Consume rations or pray for food.'
    },

    // ==========================================
    // 3. 負荷 (BL_CAP / Encumbrance)
    // ==========================================
    'burdened': {
        key: 'burdened',
        id: 'ENC_BURDENED',
        nameJa: '負荷',
        nameEn: 'Burdened',
        labelJa: '📦負荷',
        labelEn: '📦Burdened',
        icon: '📦',
        severity: CONDITION_SEVERITY.WARNING,
        descriptionJa: '所持品がやや重く、移動速度がわずかに低下します。',
        descriptionEn: 'Carrying a slight excess weight, reducing speed slightly.'
    },
    'stressed': {
        key: 'stressed',
        id: 'ENC_STRESSED',
        nameJa: '重荷',
        nameEn: 'Stressed',
        labelJa: '📦重荷',
        labelEn: '📦Stressed',
        icon: '📦',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '荷物が重く、移動速度が低下しお腹も減りやすくなります。',
        descriptionEn: 'Heavy inventory load, slowing movement and burning nutrition.'
    },
    'strained': {
        key: 'strained',
        id: 'ENC_STRAINED',
        nameJa: '酷使',
        nameEn: 'Strained',
        labelJa: '🏋️酷使',
        labelEn: '🏋️Strained',
        icon: '🏋️',
        severity: CONDITION_SEVERITY.CRITICAL,
        descriptionJa: '過重な荷物で体が酷使されています。階段昇降や戦闘にペナルティ。',
        descriptionEn: 'Severely encumbered, penalizing movement and combat.'
    },
    'overtaxed': {
        key: 'overtaxed',
        id: 'ENC_OVERTAXED',
        nameJa: '過負荷',
        nameEn: 'Overtaxed',
        labelJa: '🚨過負荷',
        labelEn: '🚨Overtaxed',
        icon: '🚨',
        severity: CONDITION_SEVERITY.FATAL,
        descriptionJa: '持てる限界を超えています！移動速度が激減し非常に危険です。不要品を床に置きましょう。',
        descriptionEn: 'Massive overload! Speed crawls, making encounters lethal.'
    },
    'overloaded': {
        key: 'overloaded',
        id: 'ENC_OVERLOADED',
        nameJa: '限界負荷',
        nameEn: 'Overloaded',
        labelJa: '💥限界負荷',
        labelEn: '💥Overloaded',
        icon: '💥',
        severity: CONDITION_SEVERITY.FATAL,
        descriptionJa: '完全に限界です！ほぼ動くことができません。直ちに荷物を捨ててください。',
        descriptionEn: 'Completely immobilized by crushing weight! Drop items immediately.'
    }
};

/**
 * NetHack コアや古いバージョンからの短縮名・別名マッピングテーブル
 */
export const CONDITION_ALIASES = {
    'stone': 'stoned',
    'conf': 'confused',
    'stun': 'stunned',
    'hallu': 'hallucinating',
    'ill': 'termill',
    'sterm': 'termill',
    'foodpois': 'foodpoisoning',
    'pois': 'foodpoisoning',
    'sleep': 'sleeping',
    'paralyze': 'paralyzed',
    'strangle': 'strangled',
    'slime': 'slimed',
    'held_by': 'held',
    'grab': 'grabbing',
    'unencumbered': null // 正常状態はバッジ不要
};

/**
 * 深刻度に応じたテーマカラー定義 (モダンHUD & CSS用)
 */
export const SEVERITY_COLORS = {
    [CONDITION_SEVERITY.FATAL]: {
        bg: '#dc2626',      // 危険赤
        border: '#f87171',
        text: '#ffffff',
        pulse: true
    },
    [CONDITION_SEVERITY.CRITICAL]: {
        bg: '#ea580c',      // 警告オレンジ
        border: '#fb923c',
        text: '#ffffff',
        pulse: false
    },
    [CONDITION_SEVERITY.WARNING]: {
        bg: '#d97706',      // 注意アンバー
        border: '#fbbf24',
        text: '#ffffff',
        pulse: false
    },
    [CONDITION_SEVERITY.INFO]: {
        bg: '#334155',      // 状況スレートグレー
        border: '#64748b',
        text: '#e2e8f0',
        pulse: false
    }
};
