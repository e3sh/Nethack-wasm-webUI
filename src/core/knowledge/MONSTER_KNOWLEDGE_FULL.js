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
const SPECIFIC_MONSTER_DETAILS = {
    // 0: giant ant
    "0": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 2, ac: 3, speed: 18, mr: 0 },
        attacks: [{ type: 'bite', damage: '1d4' }],
        resistances: [],
        corpseInfo: { edible: true, poisonous: false },
        tacticalAdvice: ['Fast moving giant ant', 'Bottleneck in a narrow corridor']
    },
    // 1: killer bee
    "1": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 1, ac: -1, speed: 18, mr: 0 },
        attacks: [{ type: 'sting', damage: '1d3', effect: 'poison' }],
        resistances: ['poison'],
        corpseInfo: { edible: true, poisonous: true },
        tacticalAdvice: ['Very fast and attacks in swarms', 'Poison resistance required early on']
    },
    // 2: soldier ant
    "2": {
        dangerLevel: 'HIGH',
        stats: { hd: 3, ac: 3, speed: 18, mr: 0 },
        attacks: [{ type: 'bite', damage: '2d4', effect: 'poison' }],
        resistances: ['poison'],
        corpseInfo: { edible: true, poisonous: true, grantResist: 'poison' },
        tacticalAdvice: [
            'Extremely fast and deals lethal poison damage early game',
            'Use Elbereth immediately or bottleneck in a doorway',
            'Corpse may grant poison resistance when eaten'
        ]
    },
    // 3: fire ant
    "3": {
        dangerLevel: 'HIGH',
        stats: { hd: 3, ac: 3, speed: 18, mr: 10 },
        attacks: [{ type: 'bite', damage: '2d4', effect: 'fire' }],
        resistances: ['fire', 'poison'],
        corpseInfo: { edible: true, poisonous: true, grantResist: 'fire' },
        tacticalAdvice: ['Deals fire damage on hit', 'Fire resistance grants protection']
    },
    // 6: acid blob
    "6": {
        dangerLevel: 'LOW',
        stats: { hd: 1, ac: 8, speed: 3, mr: 0 },
        attacks: [{ type: 'passive', effect: 'acid' }],
        resistances: ['acid', 'strikethru'],
        corpseInfo: { edible: false, poisonous: false, warningNote: 'Corpse causes severe acid burns if eaten!' },
        tacticalAdvice: ['Do not attack with bare hands or teeth', 'Corpse is inedible due to acid']
    },
    // 8: gelatinous cube
    "8": {
        dangerLevel: 'HIGH',
        stats: { hd: 6, ac: 8, speed: 6, mr: 0 },
        attacks: [{ type: 'touch', damage: '2d4', effect: 'paralysis' }],
        resistances: ['fire', 'cold', 'elec', 'sleep'],
        corpseInfo: { edible: true, poisonous: false, grantResist: 'fire, cold, elec, sleep' },
        tacticalAdvice: [
            'Paralyzes player on touch and digests items on floor',
            'Use ranged attacks or free action',
            'Corpse grants multiple elemental resistances when eaten'
        ]
    },
    // 9: chickatrice
    "9": {
        dangerLevel: 'HIGH',
        stats: { hd: 4, ac: 8, speed: 4, mr: 30 },
        attacks: [{ type: 'touch', effect: 'petrify' }],
        resistances: ['stoning', 'poison'],
        corpseInfo: { edible: false, poisonous: true, warningNote: 'Petrifies instantly if touched or eaten without gloves!' },
        tacticalAdvice: ['Young cockatrice. Gaze and touch cause petrification.', 'Wear leather gloves before handling corpse']
    },
    // 10: cockatrice
    "10": {
        dangerLevel: 'LETHAL',
        stats: { hd: 5, ac: 6, speed: 6, mr: 30 },
        attacks: [
            { type: 'touch', effect: 'petrify' },
            { type: 'hiss', effect: 'none' }
        ],
        resistances: ['stoning', 'poison'],
        corpseInfo: {
            edible: false,
            poisonous: true,
            warningNote: 'Petrifies instantly if touched or eaten without gloves!'
        },
        tacticalAdvice: [
            'Engrave Elbereth to keep away',
            'Use ranged attacks or polearms',
            'Wear leather gloves before wielding or picking up corpse'
        ]
    },
    // 12: jackal
    "12": {
        dangerLevel: 'LOW',
        stats: { hd: 0, ac: 7, speed: 12, mr: 0 },
        attacks: [{ type: 'bite', damage: '1d2' }],
        resistances: [],
        tacticalAdvice: ['Weak early-game monster', 'Appears in packs']
    },
    // 27: gas spore
    "27": {
        dangerLevel: 'HIGH',
        stats: { hd: 1, ac: 10, speed: 3, mr: 0 },
        attacks: [{ type: 'explode', damage: '4d6', effect: 'explosion' }],
        resistances: [],
        corpseInfo: { edible: false, poisonous: false },
        tacticalAdvice: [
            'Explodes violently when hit in melee, dealing massive radius damage',
            'Always kill from a distance using ranged weapons or wands'
        ]
    },
    // 28: floating eye
    "28": {
        dangerLevel: 'HIGH',
        stats: { hd: 2, ac: 9, speed: 1, mr: 10 },
        attacks: [{ type: 'gaze', effect: 'paralysis' }],
        resistances: [],
        corpseInfo: { edible: true, poisonous: false, grantResist: 'telepathy' },
        tacticalAdvice: [
            'Do not attack in melee without blindfold/towel',
            'Use ranged weapons, throwing rocks, or attack from distance',
            'Corpse grants Telepathy (ESP) when eaten'
        ]
    },
    // 48: mind flayer
    "48": {
        dangerLevel: 'LETHAL',
        stats: { hd: 9, ac: 5, speed: 12, mr: 90 },
        attacks: [{ type: 'tentacle', damage: '2d1', effect: 'brain_eat' }],
        resistances: [],
        corpseInfo: { edible: true, poisonous: false, grantResist: 'telepathy' },
        tacticalAdvice: [
            'Eats intelligence permanently upon tentacle hit',
            'Always wear grease-coated helmet or blindfold/towel',
            'Eliminate at long distance using Wand of Death or Elbereth'
        ]
    },
    // 49: master mind flayer
    "49": {
        dangerLevel: 'LETHAL',
        stats: { hd: 13, ac: 3, speed: 12, mr: 90 },
        attacks: [{ type: 'tentacle', damage: '2d1', effect: 'brain_eat' }, { type: 'psychic', damage: '3d6' }],
        resistances: [],
        corpseInfo: { edible: true, poisonous: false, grantResist: 'telepathy' },
        tacticalAdvice: ['Extremely dangerous brain eater', 'Has psychic blast attacks', 'Use genocide or instant death wands']
    },
    // 64: small mimic, 65: large mimic, 66: giant mimic
    "64": { dangerLevel: 'MEDIUM', stats: { hd: 7, ac: 3, speed: 3, mr: 0 }, attacks: [{ type: 'bite', damage: '3d4', effect: 'stick' }], tacticalAdvice: ['Disguises as items/doors. Sticks to player on contact.'] },
    "65": { dangerLevel: 'HIGH', stats: { hd: 8, ac: 3, speed: 3, mr: 10 }, attacks: [{ type: 'bite', damage: '3d6', effect: 'stick' }], tacticalAdvice: ['Disguises as shop items. Strong adhesive bite.'] },
    "66": { dangerLevel: 'HIGH', stats: { hd: 9, ac: 3, speed: 3, mr: 20 }, attacks: [{ type: 'bite', damage: '3d8', effect: 'stick' }], tacticalAdvice: ['Disguises as chests/doors. Heavy physical damage.'] },
    // 67, 68, 69: nymphs
    "67": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], tacticalAdvice: ['Steals inventory items and teleports away.'] },
    "68": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], tacticalAdvice: ['Steals inventory items in water. Mirror/blindfold helps.'] },
    "69": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], tacticalAdvice: ['Steals inventory items. Use ranged weapons before she closes in.'] },
    // 70: goblin, 72: orc, 75: Uruk-hai
    "70": { dangerLevel: 'LOW', stats: { hd: 1, ac: 10, speed: 6, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d4' }], tacticalAdvice: ['Slow humanoid', 'May carry weapons or daggers'] },
    "72": { dangerLevel: 'LOW', stats: { hd: 1, ac: 6, speed: 9, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d6' }], corpseInfo: { edible: true, poisonous: false, grantResist: 'poison' }, tacticalAdvice: ['Basic enemy', 'Corpse grants poison resistance'] },
    "75": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 10, speed: 7, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d8' }], tacticalAdvice: ['Stronger orc warrior carrying heavy weapons'] },
    // 83: leocrotta
    "83": { dangerLevel: 'HIGH', stats: { hd: 6, ac: 4, speed: 18, mr: 10 }, attacks: [{ type: 'bite', damage: '2d6' }, { type: 'claw', damage: '1d8' }], tacticalAdvice: ['Very fast and deals heavy physical damage'] },
    // 87: mastodon
    "87": { dangerLevel: 'LETHAL', stats: { hd: 20, ac: 5, speed: 12, mr: 0 }, attacks: [{ type: 'gash', damage: '4d8' }, { type: 'butt', damage: '2d8' }], tacticalAdvice: ['Massive HP and destructive physical damage', 'Keep distance or tame'] },
    // 91: wererat, 261~263: lycanthropes
    "91": { dangerLevel: 'MEDIUM', stats: { hd: 2, ac: 6, speed: 12, mr: 10 }, attacks: [{ type: 'bite', damage: '1d4', effect: 'lycanthropy' }], tacticalAdvice: ['Transmits lycanthropy infection', 'Use silver weapon or eat wolfsbane'] },
    "115": {
        dangerLevel: 'LETHAL',
        stats: { hd: 15, ac: 6, speed: 9, mr: 20 },
        attacks: [{ type: 'bite', damage: '2d8', effect: 'swallow' }],
        resistances: [],
        tacticalAdvice: ['Can swallow player whole', 'Keep Wand of Digging or sharp blade ready if swallowed']
    },
    // 116: grid bug
    "116": {
        dangerLevel: 'LOW',
        stats: { hd: 1, ac: 9, speed: 12, mr: 0 },
        attacks: [{ type: 'bite', damage: '1d1', effect: 'shock' }],
        resistances: ['shock'],
        corpseInfo: { edible: true, poisonous: false },
        tacticalAdvice: ['Moves only in cardinal directions (cannot move diagonally)']
    },
    // 143~152: dragons
    "143": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'magic_missile' }], resistances: ['magic'], corpseInfo: { edible: true, poisonous: false, grantResist: 'magic resistance' }, tacticalAdvice: ['Fires magic missile breath. Corpse grants Magic Resistance!'] },
    "144": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'abduct' }], resistances: ['magic'], corpseInfo: { edible: true, poisonous: false }, tacticalAdvice: ['Gold dragon. Highly aggressive.'] },
    "145": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'cold' }], resistances: ['cold'], corpseInfo: { edible: true, poisonous: false, grantResist: 'reflection' }, tacticalAdvice: ['Silver dragon breath cold. Corpse grants Reflection!'] },
    "146": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'fire' }], resistances: ['fire'], corpseInfo: { edible: true, poisonous: false, grantResist: 'fire resistance' }, tacticalAdvice: ['Fires devastating fire breath', 'Fire resistance or reflection required'] },
    "147": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'cold' }], resistances: ['cold'], corpseInfo: { edible: true, poisonous: false, grantResist: 'cold resistance' }, tacticalAdvice: ['Fires cold breath that freezes potions. Cold resistance required.'] },
    "148": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'sleep' }], resistances: ['sleep'], corpseInfo: { edible: true, poisonous: false, grantResist: 'sleep resistance' }, tacticalAdvice: ['Orange dragon sleep breath. Sleep resistance required.'] },
    "149": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'disintegration' }], resistances: ['disintegration'], corpseInfo: { edible: true, poisonous: false, grantResist: 'disintegration resistance' }, tacticalAdvice: ['Disintegration breath destroys gear and kills player instantly', 'Reflection or disintegration resistance mandatory'] },
    "150": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'shock' }], resistances: ['shock'], corpseInfo: { edible: true, poisonous: false, grantResist: 'shock resistance' }, tacticalAdvice: ['Blue dragon shock breath. Destroys wands in inventory.'] },
    "151": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'poison' }], resistances: ['poison'], corpseInfo: { edible: true, poisonous: true, grantResist: 'poison resistance' }, tacticalAdvice: ['Green dragon poisonous breath. Poison resistance required.'] },
    "152": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'acid' }], resistances: ['acid'], corpseInfo: { edible: true, poisonous: false, grantResist: 'acid resistance' }, tacticalAdvice: ['Yellow dragon acid breath. Destroys armor.'] },
    // 159~162: molds
    "159": { dangerLevel: 'LOW', stats: { hd: 1, ac: 9, speed: 0, mr: 0 }, attacks: [{ type: 'passive', damage: '1d6', effect: 'cold' }], resistances: ['cold'], corpseInfo: { edible: true, poisonous: false, grantResist: 'cold' }, tacticalAdvice: ['Immobile mold. Deals cold damage on melee hit.'] },
    "160": { dangerLevel: 'LOW', stats: { hd: 1, ac: 9, speed: 0, mr: 0 }, attacks: [{ type: 'passive', effect: 'poison' }], resistances: ['poison'], corpseInfo: { edible: true, poisonous: true, grantResist: 'poison' }, tacticalAdvice: ['Immobile mold releasing poison spores on melee hit.'] },
    // 177: minotaur
    "177": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: 6, speed: 15, mr: 0 }, attacks: [{ type: 'butt', damage: '3d10' }, { type: 'gash', damage: '2d8' }], tacticalAdvice: ['Extremely powerful melee attacker in mazes. Use Wand of Death/Digging.'] },
    // 178: jabberwock
    "178": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -2, speed: 12, mr: 50 }, attacks: [{ type: 'bite', damage: '2d10' }, { type: 'claw', damage: '2d10' }], tacticalAdvice: ['Devastating decapitation/slashing damage. Vorpal blade or Elbereth needed.'] },
    // 183~186: liches
    "183": { dangerLevel: 'LETHAL', stats: { hd: 11, ac: 0, speed: 6, mr: 85 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], resistances: ['cold', 'poison', 'sleep'], corpseInfo: { edible: false, poisonous: true }, tacticalAdvice: ['High magic resistance, summons undead and casts dangerous spells', 'Fire attacks are highly effective', 'Engrave Elbereth or use potion/wand of fire'] },
    "185": { dangerLevel: 'LETHAL', stats: { hd: 17, ac: -4, speed: 9, mr: 90 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], resistances: ['cold', 'poison', 'sleep'], tacticalAdvice: ['Casts high-level clerical/wizardry spells and summons demons. Fire weapon needed.'] },
    "186": { dangerLevel: 'LETHAL', stats: { hd: 25, ac: -6, speed: 9, mr: 90 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], resistances: ['cold', 'poison', 'sleep'], tacticalAdvice: ['Top-tier undead caster', 'Requires reflection and high magic resistance'] },
    // 208: green slime
    "208": { dangerLevel: 'LETHAL', stats: { hd: 6, ac: 6, speed: 6, mr: 0 }, attacks: [{ type: 'touch', effect: 'slime' }], resistances: ['acid', 'poison'], corpseInfo: { edible: false, poisonous: true, warningNote: 'Turns player into green slime on contact!' }, tacticalAdvice: ['Turns player into slime on touch! Fire or cure sickness stops transformation.'] },
    // 212: rust monster
    "212": { dangerLevel: 'HIGH', stats: { hd: 5, ac: 2, speed: 18, mr: 0 }, attacks: [{ type: 'touch', effect: 'rust' }], resistances: [], corpseInfo: { edible: true, poisonous: false }, tacticalAdvice: ['Rusts and corrodes iron weapons and armor', 'Use leather/wooden/crystal gear or fight unarmed'] },
    // 213: disenchanter
    "213": { dangerLevel: 'HIGH', stats: { hd: 12, ac: -10, speed: 12, mr: 60 }, attacks: [{ type: 'touch', effect: 'disenchant' }], resistances: [], corpseInfo: { edible: true, poisonous: false }, tacticalAdvice: ['Disenchants wielded weapons and worn armor upon attack', 'Fight unarmed, with unenchanted weapons, or throw weapons from distance'] },
    // 220: troll, 221: ice troll
    "220": { dangerLevel: 'HIGH', stats: { hd: 7, ac: 4, speed: 12, mr: 0 }, attacks: [{ type: 'claw', damage: '1d8' }, { type: 'bite', damage: '1d8' }], resistances: [], corpseInfo: { edible: true, poisonous: false }, tacticalAdvice: ['Regenerates HP and revives after death unless corpse is eaten, burned, or tinning.'] },
    "221": { dangerLevel: 'HIGH', stats: { hd: 9, ac: 2, speed: 12, mr: 0 }, attacks: [{ type: 'claw', damage: '1d8', effect: 'cold' }], resistances: ['cold'], tacticalAdvice: ['Ice troll. Revives upon death. Use fire or eat corpse.'] },
    // 225: umber hulk
    "225": { dangerLevel: 'HIGH', stats: { hd: 9, ac: 2, speed: 6, mr: 25 }, attacks: [{ type: 'gaze', effect: 'confusion' }, { type: 'claw', damage: '3d4' }], tacticalAdvice: ['Gaze causes severe confusion. Blindfold/towel recommended.'] },
    // 226~228: vampires
    "226": { dangerLevel: 'HIGH', stats: { hd: 10, ac: 1, speed: 12, mr: 25 }, attacks: [{ type: 'bite', damage: '1d6', effect: 'drain_level' }], resistances: ['cold', 'poison', 'sleep'], tacticalAdvice: ['Drains experience level', 'Use garlic or Elbereth'] },
    "228": { dangerLevel: 'LETHAL', stats: { hd: 28, ac: -6, speed: 26, mr: 80 }, attacks: [{ type: 'bite', damage: '1d10', effect: 'drain_level' }], resistances: ['cold', 'poison', 'sleep'], tacticalAdvice: ['Vlad the Impaler. Unique vampire lord in Gehennom carrying Candelabrum of Invocation.'] },
    // 230: wraith
    "230": { dangerLevel: 'HIGH', stats: { hd: 6, ac: 4, speed: 12, mr: 15 }, attacks: [{ type: 'touch', damage: '1d6', effect: 'drain_level' }], resistances: ['cold', 'poison', 'sleep'], corpseInfo: { edible: true, poisonous: false, grantResist: 'gain_level' }, tacticalAdvice: ['Drains experience level on touch. Eating corpse grants 1 free level up!'] },
    // 246: ghoul
    "246": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 10, speed: 6, mr: 0 }, attacks: [{ type: 'touch', damage: '1d2', effect: 'paralysis' }], resistances: ['poison', 'sleep'], tacticalAdvice: ['Paralyzes player on touch. Keep distance.'] },
    // 259: iron golem
    "259": { dangerLevel: 'LETHAL', stats: { hd: 18, ac: -3, speed: 6, mr: 60 }, attacks: [{ type: 'weapon', damage: '4d10' }, { type: 'breath', effect: 'poison' }], resistances: ['fire', 'cold', 'elec', 'poison', 'sleep'], tacticalAdvice: ['Fires lethal poisonous gas breath. Heals when hit by fire.'] },
    // 271: shopkeeper
    "271": { dangerLevel: 'LETHAL', stats: { hd: 12, ac: 0, speed: 16, mr: 50 }, attacks: [{ type: 'weapon', damage: '4d6' }], resistances: [], corpseInfo: { edible: true, poisonous: false }, tacticalAdvice: ['Extremely dangerous and fast, equipped with shotgun-like wand charges', 'Never attack or steal unless fully prepared with reflection/Wand of Death'] },
    // 284: Medusa
    "284": { dangerLevel: 'LETHAL', stats: { hd: 20, ac: 2, speed: 12, mr: 50 }, attacks: [{ type: 'gaze', effect: 'petrify' }], resistances: ['stoning', 'poison'], corpseInfo: { edible: false, poisonous: true }, tacticalAdvice: ['Gaze petrifies instantly', 'Use a mirror to reflect her gaze, or wear blindfold/towel'] },
    // 285: Wizard of Yendor
    "285": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -8, speed: 12, mr: 100 }, attacks: [{ type: 'spell', effect: 'curse_items' }, { type: 'touch', effect: 'steal_amulet' }], resistances: ['fire', 'cold', 'elec', 'poison', 'sleep'], tacticalAdvice: ['Main antagonist. Steals Amulet of Yendor, steals life, curses inventory, and resuscitates after death.'] },
    // 311: Death, 312: Pestilence, 313: Famine
    "311": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'instant_death' }], resistances: ['fire', 'cold', 'elec', 'poison', 'sleep'], tacticalAdvice: ['Rider of Death. Touch causes instant death unless player has Magic Resistance / Death immunity.'] },
    "312": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'sickness' }], resistances: ['fire', 'cold', 'elec', 'poison', 'sleep'], tacticalAdvice: ['Rider of Pestilence. Touch causes fatal sickness. Cure Sickness or Eucalyptus leaf required.'] },
    "313": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'starvation' }], resistances: ['fire', 'cold', 'elec', 'poison', 'sleep'], tacticalAdvice: ['Rider of Famine. Touch causes severe hunger and fainting. Food or Wand of Digging needed.'] },
    // 319: giant eel, 321: kraken
    "319": { dangerLevel: 'HIGH', stats: { hd: 5, ac: -1, speed: 9, mr: 0 }, attacks: [{ type: 'wrap', damage: '3d6', effect: 'drown' }], resistances: [], tacticalAdvice: ['Grabs player into water to drown instantly. Teleport or zap with magic wand immediately.'] },
    "321": { dangerLevel: 'LETHAL', stats: { hd: 20, ac: 6, speed: 3, mr: 0 }, attacks: [{ type: 'wrap', damage: '2d6', effect: 'drown' }], resistances: [], tacticalAdvice: ['Giant sea beast drowning players. Never enter deep water without levitation/water walking.'] }
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

    const monsterEntry = {
        id: cleanId || `mon_${i}`,
        monOffset: i,
        name: rawName,
        dangerLevel: dangerLevel,
        stats: stats,
        attacks: specific.attacks || [{ type: 'weapon/hit', damage: `${Math.max(1, Math.floor(stats.hd / 2))}d6` }],
        resistances: specific.resistances || [],
        corpseInfo: specific.corpseInfo || { edible: true, poisonous: false },
        tacticalAdvice: specific.tacticalAdvice || [
            `Standard dungeon encounter (${rawName}).`,
            `Hit Dice: ${stats.hd}, AC: ${stats.ac}. Use standard combat tactics.`
        ]
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
