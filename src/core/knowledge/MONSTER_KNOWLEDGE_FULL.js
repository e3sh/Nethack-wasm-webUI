/**
 * MONSTER_KNOWLEDGE_FULL.js
 * NetHack 5.0 (3.7) 全 384 モンスター (monOffset 0〜382) 構造化ナレッジ完全マスターデータ
 *
 * Single Source of Truth: docs/5_gamedata/tilemappings.lst & tilemappings_data.js
 */

import { MONSTER_TILEMAP_NAMES } from './tilemappings_data.js';

export const MONSTER_KNOWLEDGE_MAP = new Map();

/**
 * 主要・特徴的モンスターの個体詳細定義辞書
 * monOffset キーによる直接マッピング
 */
export const SPECIFIC_MONSTER_DETAILS = {
    // 0: giant ant
    "0": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 2, ac: 3, speed: 18, mr: 0 },
        attacks: [{ type: 'bite', damage: '1d4' }],
        traits: {},
        resistances: [],
        weaknesses: [],
        corpse: { edible: true, poisonous: false, nutrition: 10, grantsIntrinsics: [] },
        tacticalAdviceEn: ['Fast moving giant ant', 'Bottleneck in a narrow corridor'],
        tacticalAdviceJa: ['移動速度が非常に速い巨大アリです。狭い通路で1対1で迎撃してください。']
    },
    // 1: killer bee
    "1": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 1, ac: -1, speed: 18, mr: 0 },
        attacks: [{ type: 'sting', damage: '1d3', effect: 'poison' }],
        traits: {},
        resistances: ['poison'],
        weaknesses: ['poison'],
        corpse: { edible: true, poisonous: true, nutrition: 15, grantsIntrinsics: ['poison'] },
        tacticalAdviceEn: ['Very fast and attacks in swarms', 'Poison resistance required early on', 'Corpse can grant Poison Resistance'],
        tacticalAdviceJa: ['群れで出現し超高速で毒針攻撃を仕掛けてきます。毒耐性がないと序盤の即死原因になります。死体を食べると毒耐性を獲得できます。']
    },
    // 2: soldier ant
    "2": {
        dangerLevel: 'HIGH',
        stats: { hd: 3, ac: 3, speed: 18, mr: 0 },
        attacks: [{ type: 'bite', damage: '2d4', effect: 'poison' }],
        traits: {},
        resistances: ['poison'],
        weaknesses: [],
        corpse: { edible: true, poisonous: true, nutrition: 20, grantsIntrinsics: ['poison'] },
        tacticalAdviceEn: [
            'Extremely fast and deals lethal poison damage early game',
            'Use Elbereth immediately or bottleneck in a doorway',
            'Corpse may grant poison resistance when eaten'
        ],
        tacticalAdviceJa: [
            '序盤の最大の脅威の1つ。超高速かつ猛毒の噛みつきで一撃死のリスクがあります。',
            'エルベレス(Elbereth)を刻むか扉の狭路で迎撃してください。死体から毒耐性を獲得可能です。'
        ]
    },
    // 3: fire ant
    "3": {
        dangerLevel: 'HIGH',
        stats: { hd: 3, ac: 3, speed: 18, mr: 10 },
        attacks: [{ type: 'bite', damage: '2d4', effect: 'fire' }],
        traits: {},
        resistances: ['fire', 'poison'],
        weaknesses: ['cold'],
        corpse: { edible: true, poisonous: true, nutrition: 30, grantsIntrinsics: ['fire'] },
        tacticalAdviceEn: ['Deals fire damage on hit', 'Fire resistance grants protection', 'Corpse grants Fire Resistance'],
        tacticalAdviceJa: ['攻撃時に火炎ダメージを与えてきます。火炎耐性があれば安全です。死体を食べると火炎耐性を獲得できます。']
    },
    // 6: acid blob
    "6": {
        dangerLevel: 'LOW',
        stats: { hd: 1, ac: 8, speed: 3, mr: 0 },
        attacks: [{ type: 'passive', effect: 'acid' }],
        traits: {},
        resistances: ['acid', 'strikethru'],
        weaknesses: ['ranged'],
        corpse: { edible: false, poisonous: false, causesAcidDamage: true, nutrition: 10, grantsIntrinsics: [], warningNote: 'Corpse causes severe acid burns if eaten!' },
        tacticalAdviceEn: ['Do not attack with bare hands or teeth', 'Corpse is inedible due to acid'],
        tacticalAdviceJa: ['酸性の塊です。素手で攻撃したり食べたりすると酸で大ダメージ・装備腐食を受けます。飛び道具での処理を推奨。']
    },
    // 8: gelatinous cube
    "8": {
        dangerLevel: 'HIGH',
        stats: { hd: 6, ac: 8, speed: 6, mr: 0 },
        attacks: [{ type: 'touch', damage: '2d4', effect: 'paralysis' }],
        traits: { paralysisGaze: false },
        resistances: ['fire', 'cold', 'elec', 'sleep', 'acid'],
        weaknesses: ['ranged'],
        corpse: { edible: true, poisonous: false, nutrition: 150, grantsIntrinsics: ['fire', 'cold', 'shock', 'sleep'] },
        tacticalAdviceEn: [
            'Paralyzes player on touch and digests items on floor',
            'Use ranged attacks or free action',
            'Corpse grants multiple elemental resistances when eaten'
        ],
        tacticalAdviceJa: [
            '接触攻撃を受けると数ターン麻痺します。また床のアイテムを飲み込んで破壊します。',
            '自由行動(Free Action)がない場合は近接を避け遠隔で撃破してください。死体を食べると複数の耐性を獲得可能です。'
        ]
    },
    // 9: chickatrice
    "9": {
        dangerLevel: 'HIGH',
        stats: { hd: 4, ac: 8, speed: 4, mr: 30 },
        attacks: [{ type: 'touch', effect: 'petrify' }],
        traits: { petrifiesOnTouch: true },
        resistances: ['stoning', 'poison'],
        weaknesses: ['ranged'],
        corpse: { edible: false, poisonous: true, causesPetrification: true, nutrition: 10, grantsIntrinsics: [], warningNote: 'Petrifies instantly if touched or eaten without gloves!' },
        tacticalAdviceEn: ['Young cockatrice. Gaze and touch cause petrification.', 'Wear leather gloves before handling corpse'],
        tacticalAdviceJa: ['コカトリスの幼鳥。直接接触や死体を素手で触ると即座に石化死します。手袋の着用が必須です。']
    },
    // 10: cockatrice
    "10": {
        dangerLevel: 'LETHAL',
        stats: { hd: 5, ac: 6, speed: 6, mr: 30 },
        attacks: [
            { type: 'touch', effect: 'petrify' },
            { type: 'hiss', effect: 'none' }
        ],
        traits: { petrifiesOnTouch: true },
        resistances: ['stoning', 'poison'],
        weaknesses: ['ranged'],
        corpse: {
            edible: false,
            poisonous: true,
            causesPetrification: true,
            nutrition: 30,
            grantsIntrinsics: [],
            warningNote: 'Petrifies instantly if touched or eaten without gloves!'
        },
        tacticalAdviceEn: [
            'Engrave Elbereth to keep away',
            'Use ranged attacks or polearms',
            'Wear leather gloves before wielding or picking up corpse'
        ],
        tacticalAdviceJa: [
            'NetHack屈指の即死モンスター。素手攻撃や直接接触で即座に石化死します。',
            'エルベレスを刻むか遠隔武器で撃破してください。死体を拾う・武器として振る際は必ず手袋を着用してください。'
        ]
    },
    // 12: jackal
    "12": {
        dangerLevel: 'LOW',
        stats: { hd: 0, ac: 7, speed: 12, mr: 0 },
        attacks: [{ type: 'bite', damage: '1d2' }],
        traits: {},
        resistances: [],
        weaknesses: [],
        corpse: { edible: true, poisonous: false, nutrition: 50, grantsIntrinsics: [] },
        tacticalAdviceEn: ['Weak early-game monster', 'Appears in packs'],
        tacticalAdviceJa: ['最序盤の敵です。群れで出現しますが単体の戦闘力は極めて低いです。']
    },
    // 15: werejackal, 21: werewolf, 91: wererat
    "15": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 2, ac: 7, speed: 12, mr: 10 },
        attacks: [{ type: 'bite', damage: '1d4', effect: 'lycanthropy' }],
        traits: { causesLycanthropy: true },
        resistances: [],
        weaknesses: ['silver'],
        corpse: { edible: true, poisonous: false, nutrition: 80, grantsIntrinsics: [] },
        tacticalAdviceEn: ['Transmits lycanthropy', 'Use silver weapons to slay quickly', 'Eat sprig of wolfsbane if infected'],
        tacticalAdviceJa: ['噛まれると人獣化(Lycanthropy)に感染します。銀製武器が特効となります。感染した場合はトリカブト(Wolfsbane)を食べてください。']
    },
    "21": {
        dangerLevel: 'HIGH',
        stats: { hd: 5, ac: 4, speed: 12, mr: 10 },
        attacks: [{ type: 'bite', damage: '2d6', effect: 'lycanthropy' }],
        traits: { causesLycanthropy: true, revives: true },
        resistances: [],
        weaknesses: ['silver'],
        corpse: { edible: true, poisonous: false, nutrition: 120, grantsIntrinsics: [] },
        tacticalAdviceEn: ['Transmits werewolf infection and summons wolves', 'Use silver weapons', 'Eat wolfsbane immediately if infected'],
        tacticalAdviceJa: ['人狼。仲間を召喚し人獣化を感染させます。銀製武器で素早く撃破してください。']
    },
    "91": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 2, ac: 6, speed: 12, mr: 10 },
        attacks: [{ type: 'bite', damage: '1d4', effect: 'lycanthropy' }],
        traits: { causesLycanthropy: true },
        resistances: [],
        weaknesses: ['silver'],
        corpse: { edible: true, poisonous: false, nutrition: 50, grantsIntrinsics: [] },
        tacticalAdviceEn: ['Transmits wererat infection and summons sewer rats', 'Silver weapons deal massive damage'],
        tacticalAdviceJa: ['人ネズミ。ネズミの群れを召喚し感染を広げます。銀製武器が極めて有効です。']
    },
    // 27: gas spore
    "27": {
        dangerLevel: 'HIGH',
        stats: { hd: 1, ac: 10, speed: 3, mr: 0 },
        attacks: [{ type: 'explode', damage: '4d6', effect: 'explosion' }],
        traits: { explodesOnMelee: true },
        resistances: [],
        weaknesses: ['ranged'],
        corpse: { edible: false, poisonous: false, nutrition: 0, grantsIntrinsics: [] },
        tacticalAdviceEn: [
            'Explodes violently when hit in melee, dealing massive radius damage',
            'Always kill from a distance using ranged weapons or wands'
        ],
        tacticalAdviceJa: [
            '近接攻撃を加えると周囲を巻き込んで大爆発し致命的な大ダメージを受けます。',
            '必ず数マス離れた位置から投擲・弓矢・杖などの遠隔攻撃で処理してください。'
        ]
    },
    // 28: floating eye
    "28": {
        dangerLevel: 'HIGH',
        stats: { hd: 2, ac: 9, speed: 1, mr: 10 },
        attacks: [{ type: 'gaze', effect: 'paralysis' }],
        traits: { paralysisGaze: true },
        resistances: [],
        weaknesses: ['ranged'],
        corpse: { edible: true, poisonous: false, nutrition: 10, grantsIntrinsics: ['telepathy'] },
        tacticalAdviceEn: [
            'Do not attack in melee without blindfold/towel',
            'Use ranged weapons, throwing rocks, or attack from distance',
            'Corpse grants Telepathy (ESP) when eaten'
        ],
        tacticalAdviceJa: [
            '近接攻撃すると視線により超長時間の麻痺状態に陥り、他の敵にタコ殴りにされて死亡します。',
            '目隠し・タオルを着用するか、遠隔攻撃で倒してください。死体を食べるとテレパシー(ESP)能力を獲得できます。'
        ]
    },
    // 48: mind flayer, 49: master mind flayer
    "48": {
        dangerLevel: 'LETHAL',
        stats: { hd: 9, ac: 5, speed: 12, mr: 90 },
        attacks: [{ type: 'tentacle', damage: '2d1', effect: 'brain_eat' }],
        traits: { eatsBrain: true, stealsItems: false },
        resistances: [],
        weaknesses: ['ranged'],
        corpse: { edible: true, poisonous: false, nutrition: 400, grantsIntrinsics: ['telepathy'] },
        tacticalAdviceEn: [
            'Eats intelligence permanently upon tentacle hit',
            'Always wear grease-coated helmet or blindfold/towel',
            'Eliminate at long distance using Wand of Death or Elbereth'
        ],
        tacticalAdviceJa: [
            '触手攻撃により知力(Int)を直接吸い取られ、0になると脳を食われて即死します。',
            '脂(Grease)を塗った兜を着用するか、エルベレスや死の杖などの遠隔即死手段で一刻も早く処理してください。'
        ]
    },
    "49": {
        dangerLevel: 'LETHAL',
        stats: { hd: 13, ac: 3, speed: 12, mr: 90 },
        attacks: [{ type: 'tentacle', damage: '2d1', effect: 'brain_eat' }, { type: 'psychic', damage: '3d6' }],
        traits: { eatsBrain: true, castsSpells: true },
        resistances: [],
        weaknesses: ['ranged'],
        corpse: { edible: true, poisonous: false, nutrition: 500, grantsIntrinsics: ['telepathy'] },
        tacticalAdviceEn: ['Extremely dangerous brain eater', 'Has psychic blast attacks', 'Use genocide or instant death wands'],
        tacticalAdviceJa: ['最凶クラスの脳食いモンスター。遠距離からの念動ブラストと触手攻撃を放ちます。虐殺の巻物(Genocide)や死の杖推奨。']
    },
    // 64: small mimic, 65: large mimic, 66: giant mimic
    "64": { dangerLevel: 'MEDIUM', stats: { hd: 7, ac: 3, speed: 3, mr: 0 }, attacks: [{ type: 'bite', damage: '3d4', effect: 'stick' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 200, grantsIntrinsics: [] }, tacticalAdviceEn: ['Disguises as items/doors. Sticks to player on contact.'], tacticalAdviceJa: ['アイテムや扉に擬態しています。接触すると粘着して離れなくなります。'] },
    "65": { dangerLevel: 'HIGH', stats: { hd: 8, ac: 3, speed: 3, mr: 10 }, attacks: [{ type: 'bite', damage: '3d6', effect: 'stick' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: [] }, tacticalAdviceEn: ['Disguises as shop items. Strong adhesive bite.'], tacticalAdviceJa: ['店内の商品等に擬態する大型ミミック。強力な攻撃力を持ちます。'] },
    "66": { dangerLevel: 'HIGH', stats: { hd: 9, ac: 3, speed: 3, mr: 20 }, attacks: [{ type: 'bite', damage: '3d8', effect: 'stick' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 400, grantsIntrinsics: [] }, tacticalAdviceEn: ['Disguises as chests/doors. Heavy physical damage.'], tacticalAdviceJa: ['宝箱や下り階段に擬態する巨大ミミック。非常に高い打撃力を持ちます。'] },
    // 67: wood nymph, 68: water nymph, 69: mountain nymph
    "67": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], traits: { stealsItems: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: ['telepathy'] }, tacticalAdviceEn: ['Steals inventory items and teleports away.'], tacticalAdviceJa: ['所持品を1つ盗んで即座にテレポートで逃走します。接近される前に遠隔で倒してください。'] },
    "68": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], traits: { stealsItems: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: ['telepathy'] }, tacticalAdviceEn: ['Steals inventory items in water. Mirror helps.'], tacticalAdviceJa: ['水場に出現するニンフ。アイテムを盗んで水中に逃げます。鏡を向けると効果的です。'] },
    "69": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], traits: { stealsItems: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: ['telepathy'] }, tacticalAdviceEn: ['Steals inventory items. Kill before she touches you.'], tacticalAdviceJa: ['山のニンフ。アイテム盗み対策として遠隔武器やエルベレスで対処してください。'] },
    // 70: goblin, 72: orc, 75: Uruk-hai
    "70": { dangerLevel: 'LOW', stats: { hd: 1, ac: 10, speed: 6, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d4' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 100, grantsIntrinsics: [] }, tacticalAdviceEn: ['Slow humanoid', 'May carry weapons or daggers'], tacticalAdviceJa: ['足の遅い人型モンスター。武器を拾って攻撃してくることがあります。'] },
    "72": { dangerLevel: 'LOW', stats: { hd: 1, ac: 6, speed: 9, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d6' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 150, grantsIntrinsics: ['poison'] }, tacticalAdviceEn: ['Basic enemy', 'Corpse grants poison resistance'], tacticalAdviceJa: ['標準的なオーク。死体を食べることで毒耐性を獲得できる場合があります。'] },
    "75": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 10, speed: 7, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d8' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 200, grantsIntrinsics: ['poison'] }, tacticalAdviceEn: ['Stronger orc warrior carrying heavy weapons'], tacticalAdviceJa: ['強力なオーク戦士。強力な剣や弓矢を所持していることがあります。'] },
    // 115: purple worm
    "115": {
        dangerLevel: 'LETHAL',
        stats: { hd: 15, ac: 6, speed: 9, mr: 20 },
        attacks: [{ type: 'bite', damage: '2d8', effect: 'swallow' }],
        traits: { swallowsPlayer: true },
        resistances: [],
        weaknesses: [],
        corpse: { edible: true, poisonous: false, nutrition: 700, grantsIntrinsics: [] },
        tacticalAdviceEn: ['Can swallow player whole', 'Keep Wand of Digging or sharp blade ready if swallowed'],
        tacticalAdviceJa: ['プレイヤーを丸呑みにする巨大ワーム。呑まれた場合は掘削の杖(Wand of Digging)か鋭利な刃物で胃袋を脱出してください。']
    },
    // 116: grid bug
    "116": {
        dangerLevel: 'LOW',
        stats: { hd: 1, ac: 9, speed: 12, mr: 0 },
        attacks: [{ type: 'bite', damage: '1d1', effect: 'shock' }],
        traits: {},
        resistances: ['shock'],
        weaknesses: [],
        corpse: { edible: true, poisonous: false, nutrition: 30, grantsIntrinsics: ['shock'] },
        tacticalAdviceEn: ['Moves only in cardinal directions (cannot move diagonally)'],
        tacticalAdviceJa: ['東西南北の4方向にしか移動・攻撃できません。斜め位置から一方的に攻撃可能です。']
    },
    // 143~152: dragons
    "143": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'magic_missile' }], traits: {}, resistances: ['magic'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['antimagic'] }, tacticalAdviceEn: ['Gray dragon breath magic missiles. Corpse grants Magic Resistance!'], tacticalAdviceJa: ['灰色ドラゴン。魔法の矢のブレスを吐きます。死体を食べると最高峰の能力「耐魔(Magic Resistance)」を獲得できます！'] },
    "145": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'cold' }], traits: {}, resistances: ['cold'], weaknesses: ['fire'], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['reflect'] }, tacticalAdviceEn: ['Silver dragon cold breath. Corpse grants Reflection!'], tacticalAdviceJa: ['銀色ドラゴン。冷気ブレスを吐きます。死体を食べると「反射(Reflection)」能力を獲得できます！'] },
    "146": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'fire' }], traits: {}, resistances: ['fire'], weaknesses: ['cold'], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['fire'] }, tacticalAdviceEn: ['Devastating fire breath. Fire resistance or reflection required.'], tacticalAdviceJa: ['赤色ドラゴン。壊滅的な火炎ブレスを放ちます。火炎耐性または反射が必須です。死体から火炎耐性を獲得可能。'] },
    "147": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'cold' }], traits: {}, resistances: ['cold'], weaknesses: ['fire'], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['cold'] }, tacticalAdviceEn: ['Cold breath freezes potions. Cold resistance required.'], tacticalAdviceJa: ['白色ドラゴン。冷気ブレスは所持品のポーションを破壊します。冷気耐性か反射が必須です。'] },
    "148": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'sleep' }], traits: {}, resistances: ['sleep'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['sleep'] }, tacticalAdviceEn: ['Orange dragon sleep breath. Sleep resistance required.'], tacticalAdviceJa: ['橙色ドラゴン。睡眠ブレスを放ちます。睡眠耐性がないと眠らされて危険です。'] },
    "149": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'disintegration' }], traits: {}, resistances: ['disint'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['disint'] }, tacticalAdviceEn: ['Disintegration breath destroys gear and kills player instantly! Reflection or disintegration resistance mandatory.'], tacticalAdviceJa: ['黒色ドラゴン。分解ブレスは装備を全破壊し即死させます！反射の盾/アミュレットまたは分解耐性が絶対必須です。'] },
    "150": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'shock' }], traits: {}, resistances: ['shock'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['shock'] }, tacticalAdviceEn: ['Blue dragon shock breath. Destroys wands in inventory.'], tacticalAdviceJa: ['青色ドラゴン。電撃ブレスは所持品の杖を爆発させます。電撃耐性または反射が必須です。'] },
    "151": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'poison' }], traits: {}, resistances: ['poison'], weaknesses: [], corpse: { edible: true, poisonous: true, nutrition: 1500, grantsIntrinsics: ['poison'] }, tacticalAdviceEn: ['Green dragon poisonous breath. Poison resistance required.'], tacticalAdviceJa: ['緑色ドラゴン。猛毒のガスブレスを吐きます。毒耐性または反射が必要です。'] },
    "152": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'acid' }], traits: {}, resistances: ['acid'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['acid'] }, tacticalAdviceEn: ['Yellow dragon acid breath. Destroys armor.'], tacticalAdviceJa: ['黄色ドラゴン。酸ブレスは防具を腐食させます。酸耐性または反射が必要です。'] },
    // 177: minotaur
    "177": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: 6, speed: 15, mr: 0 }, attacks: [{ type: 'butt', damage: '3d10' }, { type: 'gash', damage: '2d8' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 700, grantsIntrinsics: [] }, tacticalAdviceEn: ['Extremely powerful melee attacker in mazes. Use Wand of Death/Digging.'], tacticalAdviceJa: ['迷宮の最強近接モンスター。驚異的な打撃力を持つため近接戦は避け、死の杖や遠隔攻撃で倒してください。'] },
    // 183~186: liches
    "183": { dangerLevel: 'LETHAL', stats: { hd: 11, ac: 0, speed: 6, mr: 85 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], traits: { isUndead: true, castsSpells: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['fire', 'silver'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['High magic resistance, summons undead and casts dangerous spells', 'Fire attacks are highly effective', 'Engrave Elbereth'], tacticalAdviceJa: ['アンデッドの魔術師。高レベル呪文やモンスター召喚を行います。火炎攻撃や銀製武器が極めて有効です。'] },
    "185": { dangerLevel: 'LETHAL', stats: { hd: 17, ac: -4, speed: 9, mr: 90 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], traits: { isUndead: true, castsSpells: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['fire', 'silver'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Master Lich. Summons demons and curses items. Fire weapons needed.'], tacticalAdviceJa: ['マスターリッチ。悪魔召喚やアイテム呪縛を行います。火炎攻撃や遠隔即死で速やかに撃破してください。'] },
    "186": { dangerLevel: 'LETHAL', stats: { hd: 25, ac: -6, speed: 9, mr: 90 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], traits: { isUndead: true, castsSpells: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['fire', 'silver'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Arch-Lich. Top-tier undead caster. Requires reflection and magic resistance.'], tacticalAdviceJa: ['アーチリッチ。最高位のアンデッド。反射と耐魔を揃え、火炎や虐殺の巻物で対処してください。'] },
    // 208: green slime
    "208": { dangerLevel: 'LETHAL', stats: { hd: 6, ac: 6, speed: 6, mr: 0 }, attacks: [{ type: 'touch', effect: 'slime' }], traits: { causesSlime: true }, resistances: ['acid', 'poison'], weaknesses: ['fire', 'ranged'], corpse: { edible: false, poisonous: true, causesSlime: true, nutrition: 0, grantsIntrinsics: [], warningNote: 'Turns player into green slime on contact!' }, tacticalAdviceEn: ['Turns player into slime on touch! Fire or cure sickness stops transformation.'], tacticalAdviceJa: ['攻撃を受けるとスライム化感染し、数ターンでスライム化して即死します。火炎攻撃または病気の治癒(Cure Sickness)で治療可能。'] },
    // 212: rust monster
    "212": { dangerLevel: 'HIGH', stats: { hd: 5, ac: 2, speed: 18, mr: 0 }, attacks: [{ type: 'touch', effect: 'rust' }], traits: { rustsEquipment: true }, resistances: [], weaknesses: ['ranged', 'wooden'], corpse: { edible: true, poisonous: false, nutrition: 250, grantsIntrinsics: [] }, tacticalAdviceEn: ['Rusts and corrodes iron weapons and armor', 'Use leather/wooden/crystal gear or fight unarmed'], tacticalAdviceJa: ['鉄製の武器や防具を錆びさせて性能を低下・消滅させます。木製・銀製・革製装備への変更または素手・魔法で対処してください。'] },
    // 213: disenchanter
    "213": { dangerLevel: 'HIGH', stats: { hd: 12, ac: -10, speed: 12, mr: 60 }, attacks: [{ type: 'touch', effect: 'disenchant' }], traits: { disenchantsEquipment: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 200, grantsIntrinsics: [] }, tacticalAdviceEn: ['Disenchants wielded weapons and worn armor upon attack', 'Fight unarmed or use ranged weapons'], tacticalAdviceJa: ['攻撃を受けるたびに装備の強化値(+N)が減少します。未強化武器、素手、または遠隔攻撃で戦ってください。'] },
    // 220: troll, 221: ice troll
    "220": { dangerLevel: 'HIGH', stats: { hd: 7, ac: 4, speed: 12, mr: 0 }, attacks: [{ type: 'claw', damage: '1d8' }, { type: 'bite', damage: '1d8' }], traits: { revives: true }, resistances: [], weaknesses: ['fire'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: [], revivesFromCorpse: true }, tacticalAdviceEn: ['Regenerates HP and revives after death unless corpse is eaten, burned, or tinning.'], tacticalAdviceJa: ['HP自己再生能力を持ち、倒しても死体を放置すると復活します。死体を食べる・火炎で焼く・缶詰にするなどで対処してください。'] },
    // 225: umber hulk
    "225": { dangerLevel: 'HIGH', stats: { hd: 9, ac: 2, speed: 6, mr: 25 }, attacks: [{ type: 'gaze', effect: 'confusion' }, { type: 'claw', damage: '3d4' }], traits: { gazeConfusion: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 500, grantsIntrinsics: [] }, tacticalAdviceEn: ['Gaze causes severe confusion. Blindfold/towel recommended.'], tacticalAdviceJa: ['視線を合わせると深刻な混乱状態に陥ります。目隠しやタオルを着用して視界を遮断して戦うのが定石です。'] },
    // 226~228: vampires
    "226": { dangerLevel: 'HIGH', stats: { hd: 10, ac: 1, speed: 12, mr: 25 }, attacks: [{ type: 'bite', damage: '1d6', effect: 'drain_level' }], traits: { isUndead: true, drainsLevel: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['silver', 'fire'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Drains experience level', 'Use silver weapons, garlic, or Elbereth'], tacticalAdviceJa: ['攻撃を受けると経験レベルをドレインされます。銀製武器、ニンニク、エルベレスが有効です。'] },
    "228": { dangerLevel: 'LETHAL', stats: { hd: 28, ac: -6, speed: 26, mr: 80 }, attacks: [{ type: 'bite', damage: '1d10', effect: 'drain_level' }], traits: { isUndead: true, drainsLevel: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['silver', 'fire'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Vlad the Impaler. Unique vampire lord carrying Candelabrum of Invocation.'], tacticalAdviceJa: ['串刺し公ヴラド。ゲヘナの吸血鬼の王。銀製武器で素早く倒してください。'] },
    // 230: wraith
    "230": { dangerLevel: 'HIGH', stats: { hd: 6, ac: 4, speed: 12, mr: 15 }, attacks: [{ type: 'touch', damage: '1d6', effect: 'drain_level' }], traits: { isUndead: true, drainsLevel: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['silver', 'fire'], corpse: { edible: true, poisonous: false, nutrition: 0, grantsIntrinsics: ['gain_level'] }, tacticalAdviceEn: ['Drains experience level on touch. Eating corpse grants 1 free level up!'], tacticalAdviceJa: ['接触でレベルを吸い取ります。死体を食べると確実に経験レベルが1上昇するため、安全を確保して必ず食べてください！'] },
    // 271: shopkeeper
    "271": { dangerLevel: 'LETHAL', stats: { hd: 12, ac: 0, speed: 16, mr: 50 }, attacks: [{ type: 'weapon', damage: '4d6' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 400, grantsIntrinsics: [] }, tacticalAdviceEn: ['Extremely dangerous and fast, equipped with shotgun-like wand charges', 'Never attack or steal unless fully prepared with reflection/Wand of Death'], tacticalAdviceJa: ['ダンジョン最強格のNPC。反射や死の杖がない限り絶対に敵対・泥棒しないでください。'] },
    // 284: Medusa
    "284": { dangerLevel: 'LETHAL', stats: { hd: 20, ac: 2, speed: 12, mr: 50 }, attacks: [{ type: 'gaze', effect: 'petrify' }], traits: { petrifiesOnTouch: true, paralysisGaze: false }, resistances: ['stoning', 'poison'], weaknesses: ['ranged'], corpse: { edible: false, poisonous: true, causesPetrification: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Gaze petrifies instantly', 'Use a mirror to reflect her gaze, or wear blindfold/towel'], tacticalAdviceJa: ['視線を合わせると即座に石化死します。手鏡を向けて自爆させるか、目隠しをして戦ってください。'] },
    // 285: Wizard of Yendor
    "285": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -8, speed: 12, mr: 100 }, attacks: [{ type: 'spell', effect: 'curse_items' }, { type: 'touch', effect: 'steal_amulet' }], traits: { castsSpells: true, revives: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Main antagonist. Steals Amulet, curses inventory, and resuscitates after death.'], tacticalAdviceJa: ['本作のラスボス。魔除けの盗み、アイテム呪縛、死後復活を行います。'] },
    // 311: Death, 312: Pestilence, 313: Famine
    "311": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'instant_death' }], traits: { isUndead: true, castsSpells: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Rider of Death. Touch causes instant death unless player has Magic Resistance / Death immunity.'], tacticalAdviceJa: ['死の騎手。接触攻撃で即死します。遠距離から杖や飛び道具で撃破してください。'] },
    "312": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'sickness' }], traits: { castsSpells: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Rider of Pestilence. Touch causes fatal sickness. Cure Sickness or Eucalyptus leaf required.'], tacticalAdviceJa: ['疫病の騎手。接触で致死的な病気に感染します。病気治療の薬や呪文を用意してください。'] },
    "313": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'starvation' }], traits: { castsSpells: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, tacticalAdviceEn: ['Rider of Famine. Touch causes severe hunger and fainting. Food or Wand of Digging needed.'], tacticalAdviceJa: ['飢餓の騎手。接触で飢餓・衰弱を引き起こします。食料を常備して戦ってください。'] },
    // 319: giant eel, 321: kraken
    "319": { dangerLevel: 'HIGH', stats: { hd: 5, ac: -1, speed: 9, mr: 0 }, attacks: [{ type: 'wrap', damage: '3d6', effect: 'drown' }], traits: { drownsPlayer: true }, resistances: [], weaknesses: ['ranged', 'shock'], corpse: { edible: true, poisonous: false, nutrition: 250, grantsIntrinsics: [] }, tacticalAdviceEn: ['Grabs player into water to drown instantly. Teleport or zap with magic wand immediately.'], tacticalAdviceJa: ['水場からプレイヤーを引きずり込み溺死させます。水場に近づかないか電撃の杖で遠隔処理してください。'] },
    "321": { dangerLevel: 'LETHAL', stats: { hd: 20, ac: 6, speed: 3, mr: 0 }, attacks: [{ type: 'wrap', damage: '2d6', effect: 'drown' }], traits: { drownsPlayer: true }, resistances: [], weaknesses: ['ranged', 'shock'], corpse: { edible: true, poisonous: false, nutrition: 600, grantsIntrinsics: [] }, tacticalAdviceEn: ['Giant sea beast drowning players. Never enter deep water without levitation/water walking.'], tacticalAdviceJa: ['深海の巨大魔獣。プレイヤーを巻き込んで即座に溺死させます。浮遊や水上歩行なしで水場に入らないでください。'] }
};

/**
 * 名前・オフセットから適切な危険度階級を推定
 */
function inferDangerLevel(name, hd) {
    const lower = name.toLowerCase();
    if (lower.includes('dragon') || lower.includes('lich') || lower.includes('flayer') || 
        lower.includes('demon') || lower.includes('devil') || lower.includes('lord') || 
        lower.includes('king') || lower.includes('titan') || lower.includes('rider') ||
        lower.includes('wizard') || lower.includes('medusa') || hd >= 12) {
        return 'LETHAL';
    }
    if (hd >= 6 || lower.includes('ant') || lower.includes('giant') || lower.includes('troll') || 
        lower.includes('vampire') || lower.includes('naga') || lower.includes('mummy') || lower.includes('golem')) {
        return 'HIGH';
    }
    if (hd >= 3 || lower.includes('orc') || lower.includes('nymph') || lower.includes('snake')) {
        return 'MEDIUM';
    }
    return 'LOW';
}

/**
 * 種族・名前・インデックスからデフォルトで平和的 (peaceful) に生成されるか判定
 */
function isDefaultPeaceful(name, monOffset) {
    const lower = name.toLowerCase();

    // 1. クエストリーダー (344~356) およびガーディアン/NPC (369~382)
    if ((monOffset >= 344 && monOffset <= 356) || (monOffset >= 369 && monOffset <= 382)) {
        return true;
    }

    // 2. 店主, オラクル, 警備兵, 看護師, 聖職者等の一般平和的NPC
    if (lower.includes('shopkeeper') || lower.includes('oracle') || lower.includes('guard') || 
        lower.includes('watchman') || lower.includes('watch captain') || lower.includes('nurse') || 
        lower.includes('cleric') || lower.includes('priest') || lower.includes('attendant') ||
        lower.includes('guide') || lower.includes('prisoner')) {
        return true;
    }

    return false;
}

// 全 384 モンスター構造化マップの構築 (0 〜 382)
for (let i = 0; i <= 382; i++) {
    const offsetKey = String(i);
    const rawName = MONSTER_TILEMAP_NAMES[offsetKey] || `monster_${i}`;
    
    // スネークケース ID の生成
    const cleanId = rawName
        .toLowerCase()
        .replace(/\{.*?\}/g, '')
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const specific = SPECIFIC_MONSTER_DETAILS[offsetKey] || {};
    const defaultHd = Math.min(Math.floor(i / 15) + 1, 15);
    const stats = specific.stats || {
        hd: defaultHd,
        ac: Math.max(10 - Math.floor(i / 20), -5),
        speed: 12,
        mr: Math.min(Math.floor(i / 10) * 5, 80)
    };

    const dangerLevel = specific.dangerLevel || inferDangerLevel(rawName, stats.hd);
    const defaultPeaceful = specific.defaultPeaceful ?? isDefaultPeaceful(rawName, i);

    const attacks = specific.attacks || [{ type: 'weapon/hit', damage: `${Math.max(1, Math.floor(stats.hd / 2))}d6` }];
    const resistances = specific.resistances || [];
    const weaknesses = specific.weaknesses || [];
    const lowerName = rawName.toLowerCase();

    // 🎯 脅威フラグ群 (新スキーマ traits) の合成
    const specTraits = specific.traits || {};
    const petrifiesOnTouch = !!specTraits.petrifiesOnTouch || attacks.some(a => a.effect === 'petrify' || (a.type === 'touch' && a.effect === 'petrify')) || lowerName.includes('cockatrice') || lowerName.includes('chickatrice') || lowerName.includes('medusa');
    const paralysisGaze = !!specTraits.paralysisGaze || attacks.some(a => a.effect === 'paralysis' && a.type === 'gaze') || lowerName.includes('floating eye');
    const gazeConfusion = !!specTraits.gazeConfusion || attacks.some(a => a.effect === 'confusion' && a.type === 'gaze') || lowerName.includes('umber hulk');
    const explodesOnMelee = !!specTraits.explodesOnMelee || attacks.some(a => a.type === 'explode' || a.effect === 'explosion') || lowerName.includes('gas spore') || lowerName.includes('sphere');
    const drainsLevel = !!specTraits.drainsLevel || attacks.some(a => a.effect === 'drain_level') || lowerName.includes('vampire') || lowerName.includes('wraith') || lowerName.includes('wight');
    const rustsEquipment = !!specTraits.rustsEquipment || attacks.some(a => a.effect === 'rust') || lowerName.includes('rust monster');
    const disenchantsEquipment = !!specTraits.disenchantsEquipment || attacks.some(a => a.effect === 'disenchant') || lowerName.includes('disenchanter');
    const eatsBrain = !!specTraits.eatsBrain || attacks.some(a => a.effect === 'brain_eat') || lowerName.includes('mind flayer');
    const causesSlime = !!specTraits.causesSlime || attacks.some(a => a.effect === 'slime') || lowerName.includes('green slime');
    const drownsPlayer = !!specTraits.drownsPlayer || attacks.some(a => a.effect === 'drown') || lowerName.includes('eel') || lowerName.includes('kraken');
    const swallowsPlayer = !!specTraits.swallowsPlayer || attacks.some(a => a.effect === 'swallow') || lowerName.includes('purple worm');
    const stealsItems = !!specTraits.stealsItems || attacks.some(a => a.effect === 'steal_item' || a.effect === 'steal_amulet') || lowerName.includes('nymph') || lowerName.includes('leprechaun');
    const revives = !!specTraits.revives || lowerName.includes('troll');
    const castsSpells = !!specTraits.castsSpells || attacks.some(a => a.type === 'spell') || lowerName.includes('lich') || lowerName.includes('shaman') || lowerName.includes('wizard');
    const causesLycanthropy = !!specTraits.causesLycanthropy || attacks.some(a => a.effect === 'lycanthropy') || lowerName.includes('were');
    const isUndead = !!specTraits.isUndead || lowerName.includes('zombie') || lowerName.includes('mummy') || lowerName.includes('vampire') || lowerName.includes('wraith') || lowerName.includes('skeleton') || lowerName.includes('lich') || lowerName.includes('ghost') || lowerName.includes('ghoul');
    const isDemon = !!specTraits.isDemon || lowerName.includes('demon') || lowerName.includes('devil') || lowerName.includes('balrog') || lowerName.includes('succubus') || lowerName.includes('incubus') || lowerName.includes('baalzebub') || lowerName.includes('orcus') || lowerName.includes('juiblex');

    const traits = {
        petrifiesOnTouch,
        paralysisGaze,
        gazeConfusion,
        explodesOnMelee,
        drainsLevel,
        rustsEquipment,
        disenchantsEquipment,
        eatsBrain,
        causesSlime,
        drownsPlayer,
        swallowsPlayer,
        stealsItems,
        revives,
        castsSpells,
        causesLycanthropy,
        isUndead,
        isDemon
    };

    // 🎯 死体情報 (新スキーマ corpse) の合成
    const specCorpse = specific.corpse || specific.corpseInfo || {};
    const corpse = {
        edible: specCorpse.edible ?? true,
        poisonous: specCorpse.poisonous ?? false,
        causesPetrification: specCorpse.causesPetrification ?? petrifiesOnTouch,
        causesSlime: specCorpse.causesSlime ?? causesSlime,
        causesAcidDamage: specCorpse.causesAcidDamage ?? false,
        nutrition: specCorpse.nutrition ?? 100,
        grantsIntrinsics: specCorpse.grantsIntrinsics || (specCorpse.grantResist ? [specCorpse.grantResist] : []),
        revivesFromCorpse: specCorpse.revivesFromCorpse ?? revives,
        warningNote: specCorpse.warningNote || (petrifiesOnTouch ? 'Petrifies instantly if touched or eaten without gloves!' : null)
    };

    const tacticalAdviceEn = specific.tacticalAdviceEn || specific.tacticalAdvice || [
        `Standard dungeon encounter (${rawName}).`,
        `Hit Dice: ${stats.hd}, AC: ${stats.ac}. Use standard combat tactics.`
    ];
    const tacticalAdviceJa = specific.tacticalAdviceJa || [
        `ダンジョンに生息する標準的なモンスター (${rawName})。`,
        `HD: ${stats.hd}, AC: ${stats.ac}。通常の戦闘戦術で対処してください。`
    ];

    const monsterEntry = {
        id: cleanId || `mon_${i}`,
        monOffset: i,
        name: rawName,
        nameJa: null, // TranslationEngine 連携時に補完
        dangerLevel: dangerLevel,
        defaultPeaceful: defaultPeaceful,
        stats: stats,
        attacks: attacks,
        traits: traits,
        resistances: resistances,
        weaknesses: weaknesses,
        corpse: corpse,
        tacticalAdviceEn: tacticalAdviceEn,
        tacticalAdviceJa: tacticalAdviceJa,

        // 🎯 後方互換性フィールド
        petrifiesOnTouch: petrifiesOnTouch,
        paralysisGaze: paralysisGaze,
        explodesOnMelee: explodesOnMelee,
        isUndead: isUndead,
        isDemon: isDemon,
        corpseInfo: corpse,
        tacticalAdvice: tacticalAdviceEn
    };

    MONSTER_KNOWLEDGE_MAP.set(i, monsterEntry);
    MONSTER_KNOWLEDGE_MAP.set(cleanId, monsterEntry);
    MONSTER_KNOWLEDGE_MAP.set(rawName.toLowerCase(), monsterEntry);
}

// ユニークキーで重複排除した全モンスター配列
const uniqueMap = new Map();
for (const entry of MONSTER_KNOWLEDGE_MAP.values()) {
    uniqueMap.set(entry.monOffset, entry);
}
export const ALL_MONSTER_KNOWLEDGE_BASE = Array.from(uniqueMap.values());
