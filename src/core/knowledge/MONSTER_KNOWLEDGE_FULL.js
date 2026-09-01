/**
 * MONSTER_KNOWLEDGE_FULL.js
 * NetHack 5.0 (3.7) 全 384 モンスター (monOffset 0〜382) 構造化ナレッジ完全マスターデータ
 *
 * Single Source of Truth: docs/5_gamedata/tilemappings.lst & tilemappings_data.js
 */

import { MONSTER_TILEMAP_NAMES } from './tilemappings_data.js';
import { MONSTER_BASE_STATS } from './MONSTER_BASE_STATS.js';

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
    },
    // 1: killer bee
    "1": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 1, ac: -1, speed: 18, mr: 0 },
        attacks: [{ type: 'sting', damage: '1d3', effect: 'poison' }],
        traits: {},
        resistances: ['poison'],
        weaknesses: ['poison'],
        threat: {
            delivery: 'STING',
            effect: 'POISON',
            severity: 'WARNING',
            basePriority: 70,
            targetMaterial: null,
            type: 'POISON',
            description: 'Very fast flying bee dealing lethal poison attacks.',
            counters: [
                {
                    id: 'COUNTER_POISON_RES',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 75,
                    wikiTopic: 'Killer_bee'
                }
            ]
        },
        corpse: { edible: true, poisonous: true, nutrition: 15, grantsIntrinsics: ['poison'] },
    },
    // 2: soldier ant
    "2": {
        dangerLevel: 'HIGH',
        stats: { hd: 3, ac: 3, speed: 18, mr: 0 },
        attacks: [{ type: 'bite', damage: '2d4', effect: 'poison' }],
        traits: {},
        resistances: ['poison'],
        weaknesses: [],
        threat: {
            delivery: 'MELEE',
            effect: 'POISON',
            severity: 'CRITICAL',
            basePriority: 80,
            targetMaterial: null,
            type: 'POISON',
            description: 'Extremely fast and deals lethal poison bite in early dungeon.',
            counters: [
                {
                    id: 'COUNTER_ELBERETH',
                    type: 'WAIT',
                    stance: 'WAIT_SAFE',
                    priority: 80,
                    wikiTopic: 'Soldier_ant'
                }
            ]
        },
        corpse: { edible: true, poisonous: true, nutrition: 20, grantsIntrinsics: ['poison'] },
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
    },
    // 6: acid blob
    "6": {
        dangerLevel: 'LOW',
        stats: { hd: 1, ac: 8, speed: 3, mr: 0 },
        attacks: [{ type: 'passive', effect: 'acid' }],
        traits: {},
        resistances: ['acid', 'sleep', 'poison', 'stoning'],
        weaknesses: ['ranged'],
        corpse: { 
            edible: false, 
            poisonous: false, 
            causesAcidDamage: true, 
            nutrition: 10, 
            grantsIntrinsics: [], 
        },
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
    },
    // 9: chickatrice
    "9": {
        dangerLevel: 'HIGH',
        stats: { hd: 4, ac: 8, speed: 4, mr: 30 },
        attacks: [{ type: 'touch', effect: 'petrify' }],
        traits: { petrifiesOnTouch: true },
        resistances: ['stoning', 'poison'],
        weaknesses: ['ranged'],
        threat: {
            delivery: 'TOUCH',
            effect: 'STONING',
            severity: 'CRITICAL',
            basePriority: 90,
            targetMaterial: null,
            type: 'PETRIFICATION',
            description: 'Young cockatrice. Melee contact petrifies player into stone instantly.',
            counters: [
                {
                    id: 'COUNTER_GLOVES',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 90,
                    matchItemId: 'gloves',
                    actionVerb: 'W',
                    wikiTopic: 'Chickatrice'
                },
                {
                    id: 'COUNTER_RANGED',
                    type: 'RANGED_ATTACK',
                    stance: 'RANGED',
                    priority: 88,
                    wikiTopic: 'Chickatrice'
                }
            ]
        },
        corpse: { 
            edible: false, 
            poisonous: true, 
            causesPetrification: true, 
            nutrition: 10, 
            grantsIntrinsics: [], 
        },
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
        threat: {
            delivery: 'TOUCH',
            effect: 'STONING',
            severity: 'CRITICAL',
            basePriority: 90,
            targetMaterial: null,
            type: 'PETRIFICATION',
            description: 'Melee touch or bare contact petrifies player into stone instantly.',
            counters: [
                {
                    id: 'COUNTER_GLOVES',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 90,
                    matchItemId: 'gloves',
                    actionVerb: 'W',
                    wikiTopic: 'Cockatrice'
                },
                {
                    id: 'COUNTER_RANGED',
                    type: 'RANGED_ATTACK',
                    stance: 'RANGED',
                    priority: 88,
                    wikiTopic: 'Cockatrice'
                }
            ]
        },
        corpse: {
            edible: false,
            poisonous: true,
            causesPetrification: true,
            nutrition: 30,
            grantsIntrinsics: [],
        },
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
    },
    "21": {
        dangerLevel: 'HIGH',
        stats: { hd: 5, ac: 4, speed: 12, mr: 10 },
        attacks: [{ type: 'bite', damage: '2d6', effect: 'lycanthropy' }],
        traits: { causesLycanthropy: true, revives: true },
        resistances: [],
        weaknesses: ['silver'],
        corpse: { edible: true, poisonous: false, nutrition: 120, grantsIntrinsics: [] },
    },
    "91": {
        dangerLevel: 'MEDIUM',
        stats: { hd: 2, ac: 6, speed: 12, mr: 10 },
        attacks: [{ type: 'bite', damage: '1d4', effect: 'lycanthropy' }],
        traits: { causesLycanthropy: true },
        resistances: [],
        weaknesses: ['silver'],
        corpse: { edible: true, poisonous: false, nutrition: 50, grantsIntrinsics: [] },
    },
    // 27: gas spore
    "27": {
        dangerLevel: 'HIGH',
        stats: { hd: 1, ac: 10, speed: 3, mr: 0 },
        attacks: [{ type: 'explode', damage: '4d6', effect: 'explosion' }],
        traits: { explodesOnMelee: true },
        resistances: [],
        weaknesses: ['ranged'],
        threat: {
            delivery: 'EXPLOSION',
            effect: 'PHYSICAL_BURST',
            severity: 'CRITICAL',
            basePriority: 85,
            targetMaterial: null,
            type: 'EXPLOSION',
            description: 'Explodes violently upon melee attack, dealing fatal area damage.',
            counters: [
                {
                    id: 'COUNTER_RANGED',
                    type: 'RANGED_ATTACK',
                    stance: 'RANGED',
                    priority: 85,
                    wikiTopic: 'Gas_spore'
                }
            ]
        },
        corpse: { edible: false, poisonous: false, nutrition: 0, grantsIntrinsics: [] },
    },
    // 28: floating eye
    "28": {
        dangerLevel: 'HIGH',
        stats: { hd: 2, ac: 9, speed: 1, mr: 10 },
        attacks: [{ type: 'gaze', effect: 'paralysis' }],
        traits: { paralysisGaze: true },
        resistances: [],
        weaknesses: ['ranged'],
        threat: {
            delivery: 'GAZE',
            effect: 'PARALYSIS',
            severity: 'CRITICAL',
            basePriority: 85,
            targetMaterial: null,
            type: 'GAZE_PARALYSIS',
            description: 'Paralysis gaze immobilizes player for dozens of turns on melee contact.',
            counters: [
                {
                    id: 'COUNTER_BLINDFOLD',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 85,
                    matchItemId: 'blindfold',
                    actionVerb: 'W',
                    wikiTopic: 'Floating_eye'
                },
                {
                    id: 'COUNTER_RANGED',
                    type: 'RANGED_ATTACK',
                    stance: 'RANGED',
                    priority: 80,
                    wikiTopic: 'Floating_eye'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 10, grantsIntrinsics: ['telepathy'] },
    },
    // 48: mind flayer, 49: master mind flayer
    "48": {
        dangerLevel: 'LETHAL',
        stats: { hd: 9, ac: 5, speed: 12, mr: 90 },
        attacks: [{ type: 'tentacle', damage: '2d1', effect: 'brain_eat' }],
        traits: { eatsBrain: true, stealsItems: false },
        resistances: [],
        weaknesses: ['ranged'],
        threat: {
            delivery: 'MELEE',
            effect: 'BRAIN_EAT',
            severity: 'CRITICAL',
            basePriority: 88,
            targetMaterial: null,
            type: 'BRAIN_EAT',
            description: 'Tentacles permanently drain player intelligence on melee hit.',
            counters: [
                {
                    id: 'COUNTER_HELMET',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 85,
                    matchItemId: 'helmet',
                    actionVerb: 'W',
                    wikiTopic: 'Mind_flayer'
                },
                {
                    id: 'COUNTER_RANGED',
                    type: 'RANGED_ATTACK',
                    stance: 'RANGED',
                    priority: 85,
                    wikiTopic: 'Mind_flayer'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 400, grantsIntrinsics: ['telepathy'] },
    },
    "49": {
        dangerLevel: 'LETHAL',
        stats: { hd: 13, ac: 3, speed: 12, mr: 90 },
        attacks: [{ type: 'tentacle', damage: '2d1', effect: 'brain_eat' }, { type: 'psychic', damage: '3d6' }],
        traits: { eatsBrain: true, castsSpells: true },
        resistances: [],
        weaknesses: ['ranged'],
        threat: {
            delivery: 'MELEE',
            effect: 'BRAIN_EAT',
            severity: 'CRITICAL',
            basePriority: 90,
            targetMaterial: null,
            type: 'BRAIN_EAT',
            description: 'Master mind flayer. Fast brain-eating attacks and dangerous psychic blasts.',
            counters: [
                {
                    id: 'COUNTER_HELMET',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 88,
                    matchItemId: 'helmet',
                    actionVerb: 'W',
                    wikiTopic: 'Mind_flayer'
                },
                {
                    id: 'COUNTER_RANGED',
                    type: 'RANGED_ATTACK',
                    stance: 'RANGED',
                    priority: 88,
                    wikiTopic: 'Mind_flayer'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 500, grantsIntrinsics: ['telepathy'] },
    },
    // 64: small mimic, 65: large mimic, 66: giant mimic
    "64": { dangerLevel: 'MEDIUM', stats: { hd: 7, ac: 3, speed: 3, mr: 0 }, attacks: [{ type: 'bite', damage: '3d4', effect: 'stick' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 200, grantsIntrinsics: [] }, },
    "65": { dangerLevel: 'HIGH', stats: { hd: 8, ac: 3, speed: 3, mr: 10 }, attacks: [{ type: 'bite', damage: '3d6', effect: 'stick' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: [] }, },
    "66": { dangerLevel: 'HIGH', stats: { hd: 9, ac: 3, speed: 3, mr: 20 }, attacks: [{ type: 'bite', damage: '3d8', effect: 'stick' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 400, grantsIntrinsics: [] }, },
    // 67: wood nymph, 68: water nymph, 69: mountain nymph
    "67": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], traits: { stealsItems: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: ['telepathy'] }, },
    "68": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], traits: { stealsItems: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: ['telepathy'] }, },
    "69": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 9, speed: 12, mr: 20 }, attacks: [{ type: 'touch', effect: 'steal_item' }], traits: { stealsItems: true }, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: ['telepathy'] }, },
    // 70: goblin, 72: orc, 75: Uruk-hai
    "70": { dangerLevel: 'LOW', stats: { hd: 1, ac: 10, speed: 6, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d4' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 100, grantsIntrinsics: [] }, },
    "72": { dangerLevel: 'LOW', stats: { hd: 1, ac: 6, speed: 9, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d6' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 150, grantsIntrinsics: ['poison'] }, },
    "75": { dangerLevel: 'MEDIUM', stats: { hd: 3, ac: 10, speed: 7, mr: 0 }, attacks: [{ type: 'weapon', damage: '1d8' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 200, grantsIntrinsics: ['poison'] }, },
    // 115: purple worm
    "115": {
        dangerLevel: 'LETHAL',
        stats: { hd: 15, ac: 6, speed: 9, mr: 20 },
        attacks: [{ type: 'bite', damage: '2d8', effect: 'swallow' }],
        traits: { swallowsPlayer: true },
        resistances: [],
        weaknesses: [],
        corpse: { edible: true, poisonous: false, nutrition: 700, grantsIntrinsics: [] },
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
    },
    // 143~152: dragons
    "143": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'magic_missile' }], traits: {}, resistances: ['magic'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['antimagic'] }, },
    "145": { 
        dangerLevel: 'LETHAL', 
        stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, 
        attacks: [{ type: 'breath', effect: 'cold' }], 
        traits: {}, 
        resistances: ['cold'], 
        weaknesses: ['fire'], 
        threat: {
            delivery: 'PASSIVE',
            effect: 'REFLECT',
            severity: 'WARNING',
            basePriority: 75,
            targetMaterial: null,
            type: 'REFLECT',
            description: 'Reflects magical beams and rays back at the attacker.',
            counters: [
                {
                    id: 'COUNTER_NO_BEAM',
                    type: 'WAIT',
                    stance: 'CAUTION',
                    priority: 75,
                    wikiTopic: 'Silver_dragon'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['reflect'] }, 
    },
    "146": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'fire' }], traits: {}, resistances: ['fire'], weaknesses: ['cold'], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['fire'] }, },
    "147": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'cold' }], traits: {}, resistances: ['cold'], weaknesses: ['fire'], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['cold'] }, },
    "148": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'sleep' }], traits: {}, resistances: ['sleep'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['sleep'] }, },
    "149": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'disintegration' }], traits: {}, resistances: ['disint'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['disint'] }, },
    "150": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', damage: '6d6', effect: 'shock' }], traits: {}, resistances: ['shock'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['shock'] }, },
    "151": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'poison' }], traits: {}, resistances: ['poison'], weaknesses: [], corpse: { edible: true, poisonous: true, nutrition: 1500, grantsIntrinsics: ['poison'] }, },
    "152": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: -1, speed: 9, mr: 20 }, attacks: [{ type: 'breath', effect: 'acid' }], traits: {}, resistances: ['acid'], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 1500, grantsIntrinsics: ['acid'] }, },
    // 177: minotaur
    "177": { dangerLevel: 'LETHAL', stats: { hd: 15, ac: 6, speed: 15, mr: 0 }, attacks: [{ type: 'butt', damage: '3d10' }, { type: 'gash', damage: '2d8' }], traits: {}, resistances: [], weaknesses: ['ranged'], corpse: { edible: true, poisonous: false, nutrition: 700, grantsIntrinsics: [] }, },
    // 183~186: liches
    "183": { dangerLevel: 'LETHAL', stats: { hd: 11, ac: 0, speed: 6, mr: 85 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], traits: { isUndead: true, castsSpells: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['fire', 'silver'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    "185": { dangerLevel: 'LETHAL', stats: { hd: 17, ac: -4, speed: 9, mr: 90 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], traits: { isUndead: true, castsSpells: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['fire', 'silver'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    "186": { dangerLevel: 'LETHAL', stats: { hd: 25, ac: -6, speed: 9, mr: 90 }, attacks: [{ type: 'touch', damage: '1d10', effect: 'cold' }, { type: 'spell', effect: 'summon' }], traits: { isUndead: true, castsSpells: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['fire', 'silver'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    // 208: green slime
    "208": { 
        dangerLevel: 'LETHAL', 
        stats: { hd: 6, ac: 6, speed: 6, mr: 0 }, 
        attacks: [{ type: 'touch', effect: 'slime' }], 
        traits: { causesSlime: true }, 
        resistances: ['acid', 'poison'], 
        weaknesses: ['fire', 'ranged'], 
        threat: {
            delivery: 'TOUCH',
            effect: 'SLIME',
            severity: 'CRITICAL',
            basePriority: 92,
            targetMaterial: null,
            type: 'SLIME',
            description: 'Contact turns player into green slime instantly. Fire attacks or cure sickness required.',
            counters: [
                {
                    id: 'COUNTER_FIRE',
                    type: 'USE_ITEM',
                    stance: 'RANGED',
                    priority: 92,
                    wikiTopic: 'Green_slime'
                }
            ]
        },
        corpse: { 
            edible: false, 
            poisonous: true, 
            causesSlime: true, 
            nutrition: 0, 
            grantsIntrinsics: [],
        }, 
    },
    // 212: rust monster
    "212": { 
        dangerLevel: 'HIGH', 
        stats: { hd: 5, ac: 2, speed: 18, mr: 0 }, 
        attacks: [{ type: 'touch', effect: 'rust' }], 
        traits: { rustsEquipment: true }, 
        resistances: [], 
        weaknesses: ['ranged', 'wooden'], 
        threat: {
            delivery: 'TOUCH',
            effect: 'RUST',
            severity: 'WARNING',
            basePriority: 70,
            targetMaterial: 'iron',
            type: 'EQUIPMENT_DAMAGE',
            description: 'Rusts and corrodes iron/metallic weapons and armor on contact.',
            counters: [
                {
                    id: 'COUNTER_NON_IRON',
                    type: 'EQUIP_ITEM',
                    stance: 'CAUTION',
                    priority: 70,
                    wikiTopic: 'Rust_monster'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 250, grantsIntrinsics: [] }, 
    },
    // 213: disenchanter
    "213": { 
        dangerLevel: 'HIGH', 
        stats: { hd: 12, ac: -10, speed: 12, mr: 60 }, 
        attacks: [{ type: 'touch', effect: 'disenchant' }], 
        traits: { disenchantsEquipment: true }, 
        resistances: [], 
        weaknesses: ['ranged'], 
        threat: {
            delivery: 'TOUCH',
            effect: 'DISENCHANT',
            severity: 'WARNING',
            basePriority: 75,
            targetMaterial: null,
            type: 'EQUIPMENT_DAMAGE',
            description: 'Drains enchantment (+N) from wielded weapons and armor on touch.',
            counters: [
                {
                    id: 'COUNTER_UNARMED',
                    type: 'RANGED_ATTACK',
                    stance: 'CAUTION',
                    priority: 75,
                    wikiTopic: 'Disenchanter'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 200, grantsIntrinsics: [] }, 
    },
    // 220: troll, 221: ice troll
    "220": { dangerLevel: 'HIGH', stats: { hd: 7, ac: 4, speed: 12, mr: 0 }, attacks: [{ type: 'claw', damage: '1d8' }, { type: 'bite', damage: '1d8' }], traits: { revives: true }, resistances: [], weaknesses: ['fire'], corpse: { edible: true, poisonous: false, nutrition: 300, grantsIntrinsics: [], revivesFromCorpse: true }, },
    // 225: umber hulk
    "225": { 
        dangerLevel: 'HIGH', 
        stats: { hd: 9, ac: 2, speed: 6, mr: 25 }, 
        attacks: [{ type: 'gaze', effect: 'confusion' }, { type: 'claw', damage: '3d4' }], 
        traits: { gazeConfusion: true }, 
        resistances: [], 
        weaknesses: ['ranged'], 
        threat: {
            delivery: 'GAZE',
            effect: 'CONFUSION',
            severity: 'WARNING',
            basePriority: 68,
            targetMaterial: null,
            type: 'CONFUSION_GAZE',
            description: 'Gaze causes severe confusion. Wear blindfold or towel to block eyesight.',
            counters: [
                {
                    id: 'COUNTER_BLINDFOLD',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 68,
                    matchItemId: 'blindfold',
                    actionVerb: 'W',
                    wikiTopic: 'Umber_hulk'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 500, grantsIntrinsics: [] }, 
    },
    // 226~228: vampires
    "226": { 
        dangerLevel: 'HIGH', 
        stats: { hd: 10, ac: 1, speed: 12, mr: 25 }, 
        attacks: [{ type: 'bite', damage: '1d6', effect: 'drain_level' }], 
        traits: { isUndead: true, drainsLevel: true }, 
        resistances: ['cold', 'poison', 'sleep'], 
        weaknesses: ['silver', 'fire'], 
        threat: {
            delivery: 'MELEE',
            effect: 'LEVEL_DRAIN',
            severity: 'WARNING',
            basePriority: 78,
            targetMaterial: null,
            type: 'LEVEL_DRAIN',
            description: 'Drains player experience level on melee attack.',
            counters: [
                {
                    id: 'COUNTER_SILVER',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 78,
                    wikiTopic: 'Level_drain'
                }
            ]
        },
        corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, 
    },
    "228": { dangerLevel: 'LETHAL', stats: { hd: 28, ac: -6, speed: 26, mr: 80 }, attacks: [{ type: 'bite', damage: '1d10', effect: 'drain_level' }], traits: { isUndead: true, drainsLevel: true }, resistances: ['cold', 'poison', 'sleep'], weaknesses: ['silver', 'fire'], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    // 230: wraith
    "230": { 
        dangerLevel: 'HIGH', 
        stats: { hd: 6, ac: 4, speed: 12, mr: 15 }, 
        attacks: [{ type: 'touch', damage: '1d6', effect: 'drain_level' }], 
        traits: { isUndead: true, drainsLevel: true }, 
        resistances: ['cold', 'poison', 'sleep'], 
        weaknesses: ['silver', 'fire'], 
        threat: {
            delivery: 'TOUCH',
            effect: 'LEVEL_DRAIN',
            severity: 'WARNING',
            basePriority: 78,
            targetMaterial: null,
            type: 'LEVEL_DRAIN',
            description: 'Drains player experience level on touch.',
            counters: [
                {
                    id: 'COUNTER_SILVER',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 78,
                    wikiTopic: 'Level_drain'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 0, grantsIntrinsics: ['gain_level'] }, 
    },
    // 233: monkey, 234: ape
    "233": { dangerLevel: 'MEDIUM', stats: { hd: 2, ac: 6, speed: 12, mr: 0 }, attacks: [{ type: 'claw', damage: '1d3' }, { type: 'bite', damage: '1d3' }], traits: { stealsItems: true }, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 50, grantsIntrinsics: [] }, },
    "234": { dangerLevel: 'MEDIUM', stats: { hd: 4, ac: 6, speed: 12, mr: 0 }, attacks: [{ type: 'claw', damage: '1d3' }, { type: 'claw', damage: '1d3' }, { type: 'bite', damage: '1d6' }], traits: { stealsItems: true }, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 250, grantsIntrinsics: [] }, },
    // 271: shopkeeper
    "271": { dangerLevel: 'SAFE', hostileDangerLevel: 'LETHAL', defaultPeaceful: true, stats: { hd: 12, ac: 0, speed: 16, mr: 50 }, attacks: [{ type: 'weapon', damage: '4d6' }], traits: {}, resistances: [], weaknesses: [], corpse: { edible: true, poisonous: false, nutrition: 400, grantsIntrinsics: [] }, },
    // 284: Medusa
    "284": { 
        dangerLevel: 'LETHAL', 
        stats: { hd: 20, ac: 2, speed: 12, mr: 50 }, 
        attacks: [{ type: 'gaze', effect: 'petrify' }], 
        traits: { petrifiesOnTouch: true, paralysisGaze: false }, 
        resistances: ['stoning', 'poison'], 
        weaknesses: ['ranged'], 
        threat: {
            delivery: 'GAZE',
            effect: 'STONING',
            severity: 'CRITICAL',
            basePriority: 90,
            targetMaterial: null,
            type: 'PETRIFICATION',
            description: 'Gaze petrifies player into stone immediately.',
            counters: [
                {
                    id: 'COUNTER_MIRROR',
                    type: 'USE_ITEM',
                    stance: 'CAUTION',
                    priority: 90,
                    wikiTopic: 'Medusa'
                },
                {
                    id: 'COUNTER_BLINDFOLD',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 88,
                    matchItemId: 'blindfold',
                    actionVerb: 'W',
                    wikiTopic: 'Medusa'
                }
            ]
        },
        corpse: { edible: false, poisonous: true, causesPetrification: true, nutrition: 0, grantsIntrinsics: [] }, 
    },
    // 285: Wizard of Yendor
    "285": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -8, speed: 12, mr: 100 }, attacks: [{ type: 'spell', effect: 'curse_items' }, { type: 'touch', effect: 'steal_amulet' }], traits: { castsSpells: true, revives: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    // 311: Death, 312: Pestilence, 313: Famine
    "311": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'instant_death' }], traits: { isUndead: true, castsSpells: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    "312": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'sickness' }], traits: { castsSpells: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    "313": { dangerLevel: 'LETHAL', stats: { hd: 30, ac: -5, speed: 12, mr: 100 }, attacks: [{ type: 'touch', effect: 'starvation' }], traits: { castsSpells: true }, resistances: ['fire', 'cold', 'shock', 'poison', 'sleep'], weaknesses: [], corpse: { edible: false, poisonous: true, nutrition: 0, grantsIntrinsics: [] }, },
    // 319: giant eel, 321: kraken
    "319": { 
        dangerLevel: 'HIGH', 
        stats: { hd: 5, ac: -1, speed: 9, mr: 0 }, 
        attacks: [{ type: 'wrap', damage: '3d6', effect: 'drown' }], 
        traits: { drownsPlayer: true }, 
        resistances: [], 
        weaknesses: ['ranged', 'shock'], 
        threat: {
            delivery: 'MELEE',
            effect: 'DROWNING',
            severity: 'CRITICAL',
            basePriority: 96,
            targetMaterial: null,
            type: 'DROWNING',
            description: 'Giant eel grabs player into water for instant drowning. Levitation or water walking required.',
            counters: [
                {
                    id: 'COUNTER_LEVITATION',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 96,
                    matchItemId: 'levitation',
                    actionVerb: 'P',
                    wikiTopic: 'Giant_eel'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 250, grantsIntrinsics: [] }, 
    },
    "321": { 
        dangerLevel: 'LETHAL', 
        stats: { hd: 20, ac: 6, speed: 3, mr: 0 }, 
        attacks: [{ type: 'wrap', damage: '2d6', effect: 'drown' }], 
        traits: { drownsPlayer: true }, 
        resistances: [], 
        weaknesses: ['ranged', 'shock'], 
        threat: {
            delivery: 'MELEE',
            effect: 'DROWNING',
            severity: 'CRITICAL',
            basePriority: 96,
            targetMaterial: null,
            type: 'DROWNING',
            description: 'Kraken grabs player into water for instant drowning. Levitation or water walking required.',
            counters: [
                {
                    id: 'COUNTER_LEVITATION',
                    type: 'EQUIP_ITEM',
                    stance: 'EQUIP',
                    priority: 96,
                    matchItemId: 'levitation',
                    actionVerb: 'P',
                    wikiTopic: 'Kraken'
                }
            ]
        },
        corpse: { edible: true, poisonous: false, nutrition: 600, grantsIntrinsics: [] }, 
    }
};

function hasWord(text, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

/**
 * 名前・HD・特性から適切な危険度階級を推定 (単語境界で厳密判定)
 */
function inferDangerLevel(name, hd, traits = {}) {
    const lower = name.toLowerCase();

    // 1. 即死・壊滅的特性または超高レベル (LETHAL)
    if (hd >= 12 || traits.petrifiesOnTouch || traits.eatsBrain || traits.causesSlime || 
        hasWord(lower, 'dragon') || hasWord(lower, 'lich') || hasWord(lower, 'demilich') || 
        hasWord(lower, 'arch-lich') || hasWord(lower, 'master-lich') ||
        lower.includes('mind flayer') || hasWord(lower, 'demon') || hasWord(lower, 'devil') || 
        hasWord(lower, 'titan') || hasWord(lower, 'wizard') || hasWord(lower, 'medusa') || 
        hasWord(lower, 'juiblex') || hasWord(lower, 'baalzebub') || hasWord(lower, 'orcus') || 
        hasWord(lower, 'asmodeus') || hasWord(lower, 'demogorgon') || hasWord(lower, 'yeenoghu') || 
        hasWord(lower, 'geryon') || hasWord(lower, 'dispater') || hasWord(lower, 'death') || 
        hasWord(lower, 'pestilence') || hasWord(lower, 'famine') || hasWord(lower, 'kraken')) {
        return 'LETHAL';
    }

    // 2. 高脅威・麻痺・ドレイン・特殊害悪 (HIGH)
    if (hd >= 6 || traits.paralysisGaze || traits.gazeConfusion || traits.explodesOnMelee || 
        traits.drainsLevel || traits.rustsEquipment || traits.disenchantsEquipment || traits.drownsPlayer ||
        hasWord(lower, 'soldier ant') || hasWord(lower, 'fire ant') ||
        hasWord(lower, 'troll') || hasWord(lower, 'vampire') || hasWord(lower, 'wraith') ||
        hasWord(lower, 'naga') || hasWord(lower, 'mummy') || hasWord(lower, 'golem') ||
        (hasWord(lower, 'giant') && !lower.includes('giant rat') && !lower.includes('giant bat') && !lower.includes('giant ant'))) {
        return 'HIGH';
    }

    // 3. 中程度 (MEDIUM)
    if (hd >= 3 || hasWord(lower, 'orc') || hasWord(lower, 'nymph') || hasWord(lower, 'snake') ||
        hasWord(lower, 'giant ant') || hasWord(lower, 'killer bee') || hasWord(lower, 'wolf') ||
        hasWord(lower, 'panther') || hasWord(lower, 'jaguar') || hasWord(lower, 'ape')) {
        return 'MEDIUM';
    }

    // 4. 最弱・無害級 (LOW) (lichen, newt, kobold, grid bug, sewer rat 等)
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
    const baseStat = MONSTER_BASE_STATS[offsetKey] || { hd: 1, ac: 8, speed: 12, mr: 0 };
    const stats = specific.stats || {
        hd: baseStat.hd ?? 1,
        ac: baseStat.ac ?? 8,
        speed: baseStat.speed ?? 12,
        mr: baseStat.mr ?? 0
    };

    const attacks = specific.attacks || [{ type: 'weapon/hit', damage: `${Math.max(1, Math.floor(stats.hd / 2))}d6` }];
    const resistances = specific.resistances ? [...specific.resistances] : [];
    const weaknesses = specific.weaknesses ? [...specific.weaknesses] : [];
    const vulnerabilities = specific.vulnerabilities ? [...specific.vulnerabilities] : [];
    const lowerName = rawName.toLowerCase();

    // 🎯 脅威フラグ群 (新スキーマ traits) の合成
    const specTraits = specific.traits || {};
    const petrifiesOnTouch = !!specTraits.petrifiesOnTouch || attacks.some(a => a.effect === 'petrify' || (a.type === 'touch' && a.effect === 'petrify')) || lowerName.includes('cockatrice') || lowerName.includes('chickatrice') || lowerName.includes('medusa');
    const paralysisGaze = !!specTraits.paralysisGaze || attacks.some(a => a.effect === 'paralysis' && a.type === 'gaze') || lowerName.includes('floating eye');
    const gazeConfusion = !!specTraits.gazeConfusion || attacks.some(a => a.effect === 'confusion' && a.type === 'gaze') || lowerName.includes('umber hulk');
    const explodesOnMelee = !!specTraits.explodesOnMelee || attacks.some(a => a.type === 'explode' || a.effect === 'explosion') || lowerName.includes('gas spore') || hasWord(lowerName, 'sphere');
    const drainsLevel = !!specTraits.drainsLevel || attacks.some(a => a.effect === 'drain_level') || hasWord(lowerName, 'vampire') || hasWord(lowerName, 'wraith') || hasWord(lowerName, 'wight');
    const rustsEquipment = !!specTraits.rustsEquipment || attacks.some(a => a.effect === 'rust') || lowerName.includes('rust monster');
    const disenchantsEquipment = !!specTraits.disenchantsEquipment || attacks.some(a => a.effect === 'disenchant') || lowerName.includes('disenchanter');
    const eatsBrain = !!specTraits.eatsBrain || attacks.some(a => a.effect === 'brain_eat') || lowerName.includes('mind flayer');
    const causesSlime = !!specTraits.causesSlime || attacks.some(a => a.effect === 'slime') || lowerName.includes('green slime');
    const drownsPlayer = !!specTraits.drownsPlayer || attacks.some(a => a.effect === 'drown') || hasWord(lowerName, 'eel') || hasWord(lowerName, 'kraken');
    const swallowsPlayer = !!specTraits.swallowsPlayer || attacks.some(a => a.effect === 'swallow') || lowerName.includes('purple worm');
    const stealsItems = !!specTraits.stealsItems || attacks.some(a => a.effect === 'steal_item' || a.effect === 'steal_amulet') || hasWord(lowerName, 'nymph') || hasWord(lowerName, 'leprechaun') || hasWord(lowerName, 'monkey') || hasWord(lowerName, 'ape');
    const revives = !!specTraits.revives || hasWord(lowerName, 'troll');
    const castsSpells = !!specTraits.castsSpells || attacks.some(a => a.type === 'spell') || hasWord(lowerName, 'lich') || hasWord(lowerName, 'demilich') || hasWord(lowerName, 'master-lich') || hasWord(lowerName, 'arch-lich') || hasWord(lowerName, 'shaman') || hasWord(lowerName, 'wizard');
    const causesLycanthropy = !!specTraits.causesLycanthropy || attacks.some(a => a.effect === 'lycanthropy') || lowerName.startsWith('were') || lowerName.includes('were');
    const isUndead = !!specTraits.isUndead || hasWord(lowerName, 'zombie') || hasWord(lowerName, 'mummy') || hasWord(lowerName, 'vampire') || hasWord(lowerName, 'wraith') || hasWord(lowerName, 'skeleton') || hasWord(lowerName, 'lich') || hasWord(lowerName, 'demilich') || hasWord(lowerName, 'master-lich') || hasWord(lowerName, 'arch-lich') || hasWord(lowerName, 'ghost') || hasWord(lowerName, 'ghoul');
    const isDemon = !!specTraits.isDemon || hasWord(lowerName, 'demon') || hasWord(lowerName, 'devil') || hasWord(lowerName, 'balrog') || hasWord(lowerName, 'succubus') || hasWord(lowerName, 'incubus') || hasWord(lowerName, 'baalzebub') || hasWord(lowerName, 'orcus') || hasWord(lowerName, 'juiblex');

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

    // 🎯 銀弱点・悪魔・人狼・アンデッド (Silver Vulnerability / Weakness) の自動導出
    if (isUndead || isDemon || causesLycanthropy || lowerName.includes('were') || lowerName.includes('vampire') || lowerName.includes('demon') || lowerName.includes('devil') || lowerName.includes('shade')) {
        if (!vulnerabilities.includes('SILVER')) vulnerabilities.push('SILVER');
        if (!weaknesses.includes('silver')) weaknesses.push('silver');
    }
    if (weaknesses.includes('silver') && !vulnerabilities.includes('SILVER')) {
        vulnerabilities.push('SILVER');
    }

    const defaultPeaceful = specific.defaultPeaceful ?? isDefaultPeaceful(rawName, i);
    const calculatedDanger = inferDangerLevel(rawName, stats.hd, traits);
    const dangerLevel = specific.dangerLevel || (defaultPeaceful ? 'SAFE' : calculatedDanger);
    const hostileDangerLevel = specific.hostileDangerLevel || calculatedDanger || 'LETHAL';

    // 🎯 死体情報 (新スキーマ corpse) の合成
    const specCorpse = specific.corpse || specific.corpseInfo || {};

    const corpse = {
        edible: specCorpse.edible ?? (petrifiesOnTouch || causesSlime ? false : true),
        poisonous: specCorpse.poisonous ?? (petrifiesOnTouch || causesSlime ? true : false),
        causesPetrification: specCorpse.causesPetrification ?? petrifiesOnTouch,
        causesSlime: specCorpse.causesSlime ?? causesSlime,
        causesAcidDamage: specCorpse.causesAcidDamage ?? false,
        nutrition: specCorpse.nutrition ?? 100,
        grantsIntrinsics: specCorpse.grantsIntrinsics || (specCorpse.grantResist ? [specCorpse.grantResist] : []),
        revivesFromCorpse: specCorpse.revivesFromCorpse ?? revives
    };

    // 🎯 脅威定義 (threat) の正規化と自動導出 (Single Source of Truth)
    let threat = specific.threat ? { ...specific.threat } : null;
    if (!threat) {
        if (petrifiesOnTouch) {
            threat = { delivery: 'TOUCH', effect: 'STONING', severity: 'CRITICAL', basePriority: 90, targetMaterial: null, type: 'PETRIFICATION' };
        } else if (paralysisGaze) {
            threat = { delivery: 'GAZE', effect: 'PARALYSIS', severity: 'CRITICAL', basePriority: 85, targetMaterial: null, type: 'GAZE_PARALYSIS' };
        } else if (gazeConfusion) {
            threat = { delivery: 'GAZE', effect: 'CONFUSION', severity: 'WARNING', basePriority: 68, targetMaterial: null, type: 'CONFUSION_GAZE' };
        } else if (eatsBrain) {
            threat = { delivery: 'MELEE', effect: 'BRAIN_EAT', severity: 'CRITICAL', basePriority: 88, targetMaterial: null, type: 'BRAIN_EAT' };
        } else if (drownsPlayer) {
            threat = { delivery: 'MELEE', effect: 'DROWNING', severity: 'CRITICAL', basePriority: 96, targetMaterial: null, type: 'DROWNING' };
        } else if (causesSlime) {
            threat = { delivery: 'TOUCH', effect: 'SLIME', severity: 'CRITICAL', basePriority: 92, targetMaterial: null, type: 'SLIME' };
        } else if (rustsEquipment) {
            threat = { delivery: 'TOUCH', effect: 'RUST', severity: 'WARNING', basePriority: 70, targetMaterial: 'iron', type: 'EQUIPMENT_DAMAGE' };
        } else if (disenchantsEquipment) {
            threat = { delivery: 'TOUCH', effect: 'DISENCHANT', severity: 'WARNING', basePriority: 75, targetMaterial: null, type: 'EQUIPMENT_DAMAGE' };
        } else if (drainsLevel) {
            threat = { delivery: 'MELEE', effect: 'LEVEL_DRAIN', severity: 'WARNING', basePriority: 78, targetMaterial: null, type: 'LEVEL_DRAIN' };
        } else if (explodesOnMelee) {
            threat = { delivery: 'EXPLOSION', effect: 'PHYSICAL_BURST', severity: 'CRITICAL', basePriority: 85, targetMaterial: null, type: 'EXPLOSION' };
        } else if (attacks.some(a => a.effect === 'poison')) {
            threat = { delivery: 'STING', effect: 'POISON', severity: 'WARNING', basePriority: 70, targetMaterial: null, type: 'POISON' };
        }
    }

    const monsterEntry = {
        id: cleanId || `mon_${i}`,
        monOffset: i,
        name: rawName,
        nameJa: null, // TranslationEngine 連携時に補完
        dangerLevel: dangerLevel,
        hostileDangerLevel: hostileDangerLevel,
        defaultPeaceful: defaultPeaceful,
        stats: stats,
        attacks: attacks,
        traits: traits,
        resistances: resistances,
        weaknesses: weaknesses,
        vulnerabilities: vulnerabilities,
        corpse: corpse,
        threat: threat,

        // 🎯 後方互換性フィールド (フラグおよび動的スペック)
        petrifiesOnTouch: petrifiesOnTouch,
        paralysisGaze: paralysisGaze,
        explodesOnMelee: explodesOnMelee,
        isUndead: isUndead,
        isDemon: isDemon,
        corpseInfo: corpse,
        tacticalAdvice: []
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
