/**
 * tools/extract_object_data.js
 * NetHack 5.0 (3.7) 公式ヘッダー (objects.h, objclass.h, skills.h, prop.h) から
 * 全 481 アイテム (onum 0〜480) の完全確定パラメータを抽出し OBJECT_KNOWLEDGE_BASE.js を生成する。
 */

import fs from 'fs';

// ヘッダーファイルのパス探索
const headerPaths = [
    'C:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/include/objects.h',
    'C:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0/NetHack-NetHack-5.0/include/objects.h'
];

let objectsHPath = null;
for (const p of headerPaths) {
    if (fs.existsSync(p)) {
        objectsHPath = p;
        break;
    }
}

if (!objectsHPath) {
    console.error('Error: objects.h not found!');
    process.exit(1);
}

const objectsHContent = fs.readFileSync(objectsHPath, 'utf8');

// 材質マップ
const MATERIAL_MAP = {
    '0': 'none',
    'NO_MATERIAL': 'none',
    'LIQUID': 'liquid',
    'WAX': 'wax',
    'VEGGY': 'veggy',
    'FLESH': 'flesh',
    'PAPER': 'paper',
    'CLOTH': 'cloth',
    'LEATHER': 'leather',
    'WOOD': 'wood',
    'BONE': 'bone',
    'DRAGON_HIDE': 'dragon_hide',
    'IRON': 'iron',
    'METAL': 'metal',
    'COPPER': 'copper',
    'SILVER': 'silver',
    'GOLD': 'gold',
    'PLATINUM': 'platinum',
    'MITHRIL': 'mithril',
    'PLASTIC': 'plastic',
    'GLASS': 'glass',
    'GEMSTONE': 'gemstone',
    'MINERAL': 'mineral'
};

// スキルマップ
const SKILL_MAP = {
    '0': 'none',
    'P_NONE': 'none',
    'P_DAGGER': 'dagger',
    'P_KNIFE': 'knife',
    'P_AXE': 'axe',
    'P_PICK_AXE': 'pick-axe',
    'P_SHORT_SWORD': 'short sword',
    'P_BROAD_SWORD': 'broadsword',
    'P_LONG_SWORD': 'long sword',
    'P_TWO_HANDED_SWORD': 'two-handed sword',
    'P_SABER': 'saber',
    'P_CLUB': 'club',
    'P_MACE': 'mace',
    'P_MORNING_STAR': 'morning star',
    'P_FLAIL': 'flail',
    'P_HAMMER': 'hammer',
    'P_QUARTERSTAFF': 'quarterstaff',
    'P_POLEARMS': 'polearms',
    'P_SPEAR': 'spear',
    'P_TRIDENT': 'trident',
    'P_LANCE': 'lance',
    'P_BOW': 'bow',
    'P_SLING': 'sling',
    'P_CROSSBOW': 'crossbow',
    'P_DART': 'dart',
    'P_SHURIKEN': 'shuriken',
    'P_BOOMERANG': 'boomerang',
    'P_WHIP': 'whip',
    'P_UNICORN_HORN': 'unicorn horn',
    'P_ATTACK_SPELL': 'attack spell',
    'P_HEALING_SPELL': 'healing spell',
    'P_DIVINATION_SPELL': 'divination spell',
    'P_ENCHANTMENT_SPELL': 'enchantment spell',
    'P_CLERIC_SPELL': 'clerical spell',
    'P_ESCAPE_SPELL': 'escape spell',
    'P_MATTER_SPELL': 'matter spell',
    'P_BARE_HANDED_COMBAT': 'bare-handed combat',
    'P_TWO_WEAPON_COMBAT': 'two-weapon combat',
    'P_RIDING': 'riding'
};

// 防具スロットマップ
const ARMOR_SLOT_MAP = {
    'ARM_SUIT': 'suit',
    'ARM_SHIELD': 'shield',
    'ARM_HELM': 'helm',
    'ARM_GLOVES': 'gloves',
    'ARM_BOOTS': 'boots',
    'ARM_CLOAK': 'cloak',
    'ARM_SHIRT': 'shirt'
};

// プロパティ（耐性/能力）マップ
const PROP_MAP = {
    '0': null,
    'FIRE_RES': 'FIRE_RES',
    'COLD_RES': 'COLD_RES',
    'SLEEP_RES': 'SLEEP_RES',
    'DISINT_RES': 'DISINT_RES',
    'SHOCK_RES': 'SHOCK_RES',
    'POISON_RES': 'POISON_RES',
    'ACID_RES': 'ACID_RES',
    'STONE_RES': 'STONE_RES',
    'DRAIN_RES': 'DRAIN_RES',
    'SICK_RES': 'SICK_RES',
    'INVULNERABLE': 'INVULNERABLE',
    'ANTIMAGIC': 'ANTIMAGIC',
    'SEE_INVIS': 'SEE_INVIS',
    'TELEPAT': 'TELEPAT',
    'WARNING': 'WARNING',
    'WARN_OF_MON': 'WARN_OF_MON',
    'WARN_UNDEAD': 'WARN_UNDEAD',
    'SEARCHING': 'SEARCHING',
    'CLAIRVOYANT': 'CLAIRVOYANT',
    'INFRAVISION': 'INFRAVISION',
    'DETECT_MONSTERS': 'DETECT_MONSTERS',
    'BLND_RES': 'BLND_RES',
    'ADORNED': 'ADORNED',
    'INVIS': 'INVIS',
    'DISPLACED': 'DISPLACED',
    'STEALTH': 'STEALTH',
    'REGENERATION': 'REGENERATION',
    'TELEPORT': 'TELEPORT',
    'TELEPORT_CNTRL': 'TELEPORT_CNTRL',
    'POLYMORPH': 'POLYMORPH',
    'POLYMORPH_CTRL': 'POLYMORPH_CTRL',
    'LEVITATION': 'LEVITATION',
    'FAST': 'FAST',
    'REFLECTING': 'REFLECTING',
    'FREE_ACTION': 'FREE_ACTION',
    'SLOW_DIGESTION': 'SLOW_DIGESTION',
    'UNCHANGING': 'UNCHANGING'
};

function cleanArg(arg) {
    if (!arg) return '';
    let res = arg.trim();
    res = res.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    return res;
}

function parseString(val) {
    if (!val) return null;
    const cleaned = cleanArg(val);
    if (cleaned === 'NoDes' || cleaned === '0' || cleaned === '(char *) 0' || cleaned === '(char *)0' || cleaned === 'NULL') {
        return null;
    }
    const m = cleaned.match(/^"([\s\S]*)"$/);
    if (m) return m[1];
    return cleaned;
}

function parseNum(val, defaultVal = 0) {
    if (!val) return defaultVal;
    const cleaned = cleanArg(val);
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? defaultVal : num;
}

function parseMaterial(val) {
    const cleaned = cleanArg(val);
    return MATERIAL_MAP[cleaned] || cleaned.toLowerCase();
}

function parseSkill(val) {
    let cleaned = cleanArg(val);
    if (cleaned.startsWith('-')) cleaned = cleaned.substring(1);
    return SKILL_MAP[cleaned] || cleaned.replace(/^P_/, '').toLowerCase().replace(/_/g, ' ');
}

function parseSkillEnum(val) {
    let cleaned = cleanArg(val);
    if (cleaned.startsWith('-')) cleaned = cleaned.substring(1);
    return cleaned;
}

function parseProp(val) {
    const cleaned = cleanArg(val);
    return PROP_MAP[cleaned] || (cleaned === '0' ? null : cleaned);
}

function parseStrikeType(val) {
    const cleaned = cleanArg(val);
    const types = [];
    if (cleaned.includes('P') || cleaned.includes('PIERCE')) types.push('pierce');
    if (cleaned.includes('S') || cleaned.includes('SLASH')) types.push('slash');
    if (cleaned.includes('B') || cleaned.includes('WHACK')) types.push('whack');
    return types.length > 0 ? types : ['none'];
}

function parseDamageDice(sdam, ldam, name) {
    const diceMap = {
        "two-handed sword": { sdam: "1d12", ldam: "3d6" },
        "broadsword": { sdam: "2d4", ldam: "1d6+1" },
        "elven broadsword": { sdam: "1d6+1", ldam: "1d6+1" },
        "tsurugi": { sdam: "1d16", ldam: "1d8+2d6" },
        "morning star": { sdam: "2d4", ldam: "1d6+1" },
        "flail": { sdam: "1d6+1", ldam: "2d4" },
        "trident": { sdam: "1d6+1", ldam: "3d4" },
        "lance": { sdam: "1d6", ldam: "1d8" },
        "halberd": { sdam: "1d10", ldam: "2d6" },
        "bardiche": { sdam: "2d4", ldam: "3d4" },
        "spetum": { sdam: "1d6+1", ldam: "2d6" },
        "glaive": { sdam: "1d6", ldam: "1d10" },
        "guisarme": { sdam: "2d4", ldam: "1d8" },
        "bill-guisarme": { sdam: "2d4", ldam: "1d10" },
        "voulge": { sdam: "2d4", ldam: "2d4" },
        "ranseur": { sdam: "2d4", ldam: "2d4" },
        "lucern hammer": { sdam: "2d4", ldam: "1d6" },
        "bec-de-corbin": { sdam: "1d8", ldam: "1d6" }
    };

    if (name && diceMap[name]) {
        return diceMap[name];
    }

    const sdamStr = sdam > 0 ? `1d${sdam}` : '0';
    const ldamStr = ldam > 0 ? `1d${ldam}` : '0';
    return { sdam: sdamStr, ldam: ldamStr };
}

export function extractAllObjectData() {
    let content = objectsHContent;

    // 1. #if 0 ... #endif ブロックを除去
    content = content.replace(/#if\s+0[\s\S]*?#endif/g, '');

    // 2. コメントを除去
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    content = content.replace(/\/\/.*$/gm, '');

    // 3. マクロ定義 (#define ... 複数行) およびプリプロセッサディレクティブを除去
    content = content.replace(/^#define\s+(?:.*\\\r?\n)*.*$/gm, '');
    content = content.replace(/^#undef.*$/gm, '');
    content = content.replace(/^#include.*$/gm, '');
    content = content.replace(/^#ifndef.*$/gm, '');
    content = content.replace(/^#ifdef.*$/gm, '');
    content = content.replace(/^#if.*$/gm, '');
    content = content.replace(/^#elif.*$/gm, '');
    content = content.replace(/^#else.*$/gm, '');
    content = content.replace(/^#endif.*$/gm, '');
    content = content.replace(/^#error.*$/gm, '');

    // 4. マクロ呼び出し走査
    const macroRegex = /\b(GENERIC|WEAPON|PROJECTILE|BOW|ARMOR|HELM|CLOAK|SHIELD|GLOVES|BOOTS|DRGN_ARMR|RING|AMULET|TOOL|CONTAINER|EYEWEAR|WEPTOOL|WAND|COIN|FOOD|POTION|SCROLL|XTRA_SCROLL_LABEL|SPELL|GEM|ROCK|OBJECT)\s*\(/g;
    
    function extractCall(startIndex) {
        let depth = 1;
        let inQuote = false;
        let pos = startIndex;
        while (pos < content.length && depth > 0) {
            const ch = content[pos];
            if (ch === '"' && (pos === 0 || content[pos - 1] !== '\\')) {
                inQuote = !inQuote;
            } else if (!inQuote && ch === '(') {
                depth++;
            } else if (!inQuote && ch === ')') {
                depth--;
            }
            pos++;
        }
        return content.substring(startIndex, pos - 1);
    }

    function splitArgs(str) {
        const args = [];
        let cur = '';
        let depth = 0;
        let inQuote = false;
        
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (ch === '"' && (i === 0 || str[i-1] !== '\\')) {
                inQuote = !inQuote;
                cur += ch;
            } else if (!inQuote && ch === '(') {
                depth++;
                cur += ch;
            } else if (!inQuote && ch === ')') {
                depth--;
                cur += ch;
            } else if (!inQuote && depth === 0 && ch === ',') {
                args.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) args.push(cur.trim());
        return args;
    }

    let match;
    const matches = [];
    while ((match = macroRegex.exec(content)) !== null) {
        const macroName = match[1];
        const argStr = extractCall(macroRegex.lastIndex);
        const args = splitArgs(argStr);
        matches.push({ macroName, args, raw: match[0] + argStr + ')' });
    }

    console.log(`Found ${matches.length} macro invocations in objects.h`);

    let onum = 0;
    const items = [];

    for (const m of matches) {
        const { macroName, args } = m;

        // fencepost (terminator) は除外
        if (macroName === 'OBJECT' && args[0] && args[0].includes('NoDes') && args[1] && args[1].includes('BITS(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, P_NONE, 0)')) {
            continue;
        }

        // XTRA_SCROLL_LABEL は NetHack 内部で extra scroll description として使用されるが onum アイテムではない場合はスキップ
        // SCROLL(NoDes, ...)
        if (macroName === 'XTRA_SCROLL_LABEL') {
            // NetHack 5.0 では objects[] に含まれるか？
            // SC01〜SC20
        }

        let item = {
            onum: onum,
            id: `item_onum_${onum}`,
            name: '',
            descr: null,
            category: 'OTHER',
            material: 'none',
            weight: 0,
            cost: 0,
            prob: 0,
            delay: 0,
            color: 'CLR_WHITE',
            sn: '',
            // 武器
            skill: 'none',
            skillEnum: 'P_NONE',
            hands: 1,
            sdam: '0',
            ldam: '0',
            sdamMax: 0,
            ldamMax: 0,
            hitBonus: 0,
            strikeType: ['none'],
            isAmmo: false,
            isLauncher: false,
            // 防具
            ac: null,
            acBonus: 0,
            mc: 0,
            armorSlot: null,
            // 特殊
            propConveyed: null,
            nutrition: 0,
            spellLevel: null,
            spellSkill: null,
            zapType: null,
            isMagical: false,
            isCharged: false,
            isStackable: false,
            isUnique: false,
            isContainer: false
        };

        if (macroName === 'OBJECT') {
            const objMatch = args[0].match(/OBJ\s*\(\s*(.*?)\s*,\s*(.*?)\s*\)/);
            if (objMatch) {
                item.name = parseString(objMatch[1]);
                item.descr = parseString(objMatch[2]);
            }
            if (args[3]) {
                const catStr = cleanArg(args[3]);
                item.category = catStr.replace(/_CLASS$/, '');
            }
            if (args[14]) {
                item.sn = cleanArg(args[14]);
            }
            if (item.name === 'strange object') {
                item.category = 'ILLOBJ';
                item.sn = 'STRANGE_OBJECT';
            } else if (item.name === 'boulder') {
                item.material = 'mineral';
                item.weight = 6000;
                item.cost = 0;
                item.sdam = '1d20';
                item.ldam = '1d20';
                item.sdamMax = 20;
                item.ldamMax = 20;
                item.category = 'ROCK';
            } else if (item.name === 'statue') {
                item.material = 'mineral';
                item.weight = 2500;
                item.cost = 0;
                item.sdam = '1d20';
                item.ldam = '1d20';
                item.category = 'ROCK';
                item.isContainer = true;
            } else if (item.name === 'heavy iron ball') {
                item.material = 'iron';
                item.weight = 480;
                item.cost = 10;
                item.sdam = '1d25';
                item.ldam = '1d25';
                item.category = 'BALL';
            } else if (item.name === 'iron chain') {
                item.material = 'iron';
                item.weight = 120;
                item.cost = 0;
                item.sdam = '1d4';
                item.ldam = '1d4';
                item.category = 'CHAIN';
            } else if (item.name && item.name.includes('venom')) {
                item.material = 'liquid';
                item.weight = 1;
                item.cost = 0;
                item.category = 'VENOM';
                if (item.name.includes('acid')) {
                    item.sdam = '1d6';
                    item.ldam = '1d6';
                }
            } else if (item.name === 'novel' || item.name === 'Book of the Dead') {
                item.material = 'paper';
                item.category = 'SPELLBOOK';
                item.weight = item.name === 'novel' ? 10 : 50;
                item.cost = item.name === 'novel' ? 20 : 10000;
                if (item.name === 'Book of the Dead') {
                    item.spellLevel = 7;
                }
            }
        } else if (macroName === 'GENERIC') {
            const desc = parseString(args[0]);
            item.name = `generic ${desc}`;
            item.descr = desc;
            const catRaw = cleanArg(args[1]).replace(/_CLASS$/, '');
            item.category = catRaw === 'SPBOOK' ? 'SPELLBOOK' : catRaw;
            item.sn = cleanArg(args[2]);
            item.isStackable = false;
        } else if (macroName === 'WEAPON') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isStackable = parseNum(args[3]) === 1;
            item.hands = parseNum(args[4]) === 1 ? 2 : 1;
            item.prob = parseNum(args[5]);
            item.weight = parseNum(args[6]);
            item.cost = parseNum(args[7]);
            item.sdamMax = parseNum(args[8]);
            item.ldamMax = parseNum(args[9]);
            const dice = parseDamageDice(item.sdamMax, item.ldamMax, item.name);
            item.sdam = dice.sdam;
            item.ldam = dice.ldam;
            item.hitBonus = parseNum(args[10]);
            item.strikeType = parseStrikeType(args[11]);
            item.skill = parseSkill(args[12]);
            item.skillEnum = parseSkillEnum(args[12]);
            item.material = parseMaterial(args[13]);
            item.color = cleanArg(args[14]);
            item.sn = cleanArg(args[15]);
            item.category = 'WEAPON';
            if (cleanArg(args[12]).startsWith('-')) {
                item.isAmmo = true;
            }
        } else if (macroName === 'PROJECTILE') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isStackable = true;
            item.hands = 1;
            item.prob = parseNum(args[3]);
            item.weight = parseNum(args[4]);
            item.cost = parseNum(args[5]);
            item.sdamMax = parseNum(args[6]);
            item.ldamMax = parseNum(args[7]);
            const dice = parseDamageDice(item.sdamMax, item.ldamMax, item.name);
            item.sdam = dice.sdam;
            item.ldam = dice.ldam;
            item.hitBonus = parseNum(args[8]);
            item.strikeType = ['pierce'];
            item.material = parseMaterial(args[9]);
            item.skill = parseSkill(args[10]);
            item.skillEnum = parseSkillEnum(args[10]);
            item.color = cleanArg(args[11]);
            item.sn = cleanArg(args[12]);
            item.category = 'WEAPON';
            item.isAmmo = true;
        } else if (macroName === 'BOW') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isStackable = false;
            item.hands = (parseString(args[0]) === 'crossbow' || parseString(args[0]) === 'bow') ? 2 : 1;
            item.prob = parseNum(args[3]);
            item.weight = parseNum(args[4]);
            item.cost = parseNum(args[5]);
            item.sdamMax = 2;
            item.ldamMax = 2;
            item.sdam = '1d2';
            item.ldam = '1d2';
            item.hitBonus = parseNum(args[6]);
            item.material = parseMaterial(args[7]);
            item.skill = parseSkill(args[8]);
            item.skillEnum = parseSkillEnum(args[8]);
            item.color = cleanArg(args[9]);
            item.sn = cleanArg(args[10]);
            item.category = 'WEAPON';
            item.isLauncher = true;
        } else if (macroName === 'ARMOR') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.propConveyed = parseProp(args[5]);
            item.prob = parseNum(args[6]);
            item.delay = parseNum(args[7]);
            item.weight = parseNum(args[8]);
            item.cost = parseNum(args[9]);
            item.ac = parseNum(args[10]);
            item.acBonus = 10 - item.ac;
            item.mc = parseNum(args[11]);
            item.armorSlot = ARMOR_SLOT_MAP[cleanArg(args[12])] || 'suit';
            item.material = parseMaterial(args[13]);
            item.color = cleanArg(args[14]);
            item.sn = cleanArg(args[15]);
            item.category = 'ARMOR';
        } else if (macroName === 'HELM') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.propConveyed = parseProp(args[4]);
            item.prob = parseNum(args[5]);
            item.delay = parseNum(args[6]);
            item.weight = parseNum(args[7]);
            item.cost = parseNum(args[8]);
            item.ac = parseNum(args[9]);
            item.acBonus = 10 - item.ac;
            item.mc = parseNum(args[10]);
            item.armorSlot = 'helm';
            item.material = parseMaterial(args[11]);
            item.color = cleanArg(args[12]);
            item.sn = cleanArg(args[13]);
            item.category = 'ARMOR';
        } else if (macroName === 'CLOAK') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.propConveyed = parseProp(args[4]);
            item.prob = parseNum(args[5]);
            item.delay = parseNum(args[6]);
            item.weight = parseNum(args[7]);
            item.cost = parseNum(args[8]);
            item.ac = parseNum(args[9]);
            item.acBonus = 10 - item.ac;
            item.mc = parseNum(args[10]);
            item.armorSlot = 'cloak';
            item.material = parseMaterial(args[11]);
            item.color = cleanArg(args[12]);
            item.sn = cleanArg(args[13]);
            item.category = 'ARMOR';
        } else if (macroName === 'SHIELD') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.propConveyed = parseProp(args[5]);
            item.prob = parseNum(args[6]);
            item.delay = parseNum(args[7]);
            item.weight = parseNum(args[8]);
            item.cost = parseNum(args[9]);
            item.ac = parseNum(args[10]);
            item.acBonus = 10 - item.ac;
            item.mc = parseNum(args[11]);
            item.armorSlot = 'shield';
            item.material = parseMaterial(args[12]);
            item.color = cleanArg(args[13]);
            item.sn = cleanArg(args[14]);
            item.category = 'ARMOR';
        } else if (macroName === 'GLOVES') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.propConveyed = parseProp(args[4]);
            item.prob = parseNum(args[5]);
            item.delay = parseNum(args[6]);
            item.weight = parseNum(args[7]);
            item.cost = parseNum(args[8]);
            item.ac = parseNum(args[9]);
            item.acBonus = 10 - item.ac;
            item.mc = parseNum(args[10]);
            item.armorSlot = 'gloves';
            item.material = parseMaterial(args[11]);
            item.color = cleanArg(args[12]);
            item.sn = cleanArg(args[13]);
            item.category = 'ARMOR';
        } else if (macroName === 'BOOTS') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.propConveyed = parseProp(args[4]);
            item.prob = parseNum(args[5]);
            item.delay = parseNum(args[6]);
            item.weight = parseNum(args[7]);
            item.cost = parseNum(args[8]);
            item.ac = parseNum(args[9]);
            item.acBonus = 10 - item.ac;
            item.mc = parseNum(args[10]);
            item.armorSlot = 'boots';
            item.material = parseMaterial(args[11]);
            item.color = cleanArg(args[12]);
            item.sn = cleanArg(args[13]);
            item.category = 'ARMOR';
        } else if (macroName === 'DRGN_ARMR') {
            item.name = parseString(args[0]);
            item.isMagical = parseNum(args[1]) === 1;
            item.propConveyed = parseProp(args[2]);
            item.prob = 0;
            item.delay = 5;
            item.weight = 40;
            item.cost = parseNum(args[3]);
            item.ac = parseNum(args[4]);
            item.acBonus = 10 - item.ac;
            item.mc = 0;
            item.armorSlot = 'suit';
            item.material = 'dragon_hide';
            item.color = cleanArg(args[5]);
            item.sn = cleanArg(args[6]);
            item.category = 'ARMOR';
        } else if (macroName === 'RING') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.propConveyed = parseProp(args[2]);
            item.cost = parseNum(args[3]);
            item.isMagical = parseNum(args[4]) === 1;
            item.material = parseMaterial(args[7]);
            item.color = cleanArg(args[8]);
            item.sn = cleanArg(args[9]);
            item.category = 'RING';
            item.weight = 3;
        } else if (macroName === 'AMULET') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.propConveyed = parseProp(args[2]);
            item.prob = parseNum(args[3]);
            item.cost = parseNum(args[4]);
            item.material = 'iron';
            item.color = cleanArg(args[5]);
            item.sn = cleanArg(args[6]);
            item.category = 'AMULET';
            item.weight = 20;
        } else if (macroName === 'TOOL') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isStackable = parseNum(args[3]) === 1;
            item.isMagical = parseNum(args[4]) === 1;
            item.isCharged = parseNum(args[5]) === 1;
            item.prob = parseNum(args[6]);
            item.weight = parseNum(args[7]);
            item.cost = parseNum(args[8]);
            item.material = parseMaterial(args[9]);
            item.color = cleanArg(args[10]);
            item.sn = cleanArg(args[11]);
            item.category = 'TOOL';
        } else if (macroName === 'CONTAINER') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.isCharged = parseNum(args[4]) === 1;
            item.prob = parseNum(args[5]);
            item.weight = parseNum(args[6]);
            item.cost = parseNum(args[7]);
            item.material = parseMaterial(args[8]);
            item.color = cleanArg(args[9]);
            item.sn = cleanArg(args[10]);
            item.category = 'TOOL';
            item.isContainer = true;
        } else if (macroName === 'EYEWEAR') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.propConveyed = parseProp(args[3]);
            item.prob = parseNum(args[4]);
            item.weight = parseNum(args[5]);
            item.cost = parseNum(args[6]);
            item.material = parseMaterial(args[7]);
            item.color = cleanArg(args[8]);
            item.sn = cleanArg(args[9]);
            item.category = 'TOOL';
        } else if (macroName === 'WEPTOOL') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[3]) === 1;
            item.hands = parseNum(args[4]) === 1 ? 2 : 1;
            item.prob = parseNum(args[5]);
            item.weight = parseNum(args[6]);
            item.cost = parseNum(args[7]);
            item.sdamMax = parseNum(args[8]);
            item.ldamMax = parseNum(args[9]);
            const dice = parseDamageDice(item.sdamMax, item.ldamMax, item.name);
            item.sdam = dice.sdam;
            item.ldam = dice.ldam;
            item.hitBonus = parseNum(args[10]);
            item.skill = parseSkill(args[11]);
            item.skillEnum = parseSkillEnum(args[11]);
            item.material = parseMaterial(args[12]);
            item.color = cleanArg(args[13]);
            item.sn = cleanArg(args[14]);
            item.category = 'TOOL';
        } else if (macroName === 'WAND') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.prob = parseNum(args[2]);
            item.cost = parseNum(args[3]);
            item.isMagical = parseNum(args[4]) === 1;
            const dir = cleanArg(args[5]);
            item.zapType = dir === 'RAY' ? 'ray' : (dir === 'IMMEDIATE' ? 'beam' : 'nodir');
            item.color = cleanArg(args[6]);
            item.sn = cleanArg(args[7]);
            item.category = 'WAND';
            item.material = 'wood';
            item.weight = 7;
            item.isCharged = true;
        } else if (macroName === 'COIN') {
            item.name = parseString(args[0]);
            item.category = 'COIN';
            item.prob = parseNum(args[1]);
            item.material = parseMaterial(args[2]);
            item.cost = parseNum(args[3]);
            item.sn = cleanArg(args[4]);
            item.weight = 1;
            item.isStackable = true;
        } else if (macroName === 'FOOD') {
            item.name = parseString(args[0]);
            item.prob = parseNum(args[1]);
            item.delay = parseNum(args[2]);
            item.weight = parseNum(args[3]);
            // args[4] は unk (未識別時の外見フラグ)
            item.material = parseMaterial(args[5]);
            item.nutrition = parseNum(args[6]);
            item.color = cleanArg(args[7]);
            item.sn = cleanArg(args[8]);
            item.category = 'FOOD';
            item.isStackable = true;
        } else if (macroName === 'POTION') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[2]) === 1;
            item.propConveyed = parseProp(args[3]);
            item.prob = parseNum(args[4]);
            item.cost = parseNum(args[5]);
            item.color = cleanArg(args[6]);
            item.sn = cleanArg(args[7]);
            item.category = 'POTION';
            item.material = 'glass';
            item.weight = 20;
            item.isStackable = true;
        } else if (macroName === 'SCROLL') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.isMagical = parseNum(args[2]) === 1;
            item.prob = parseNum(args[3]);
            item.cost = parseNum(args[4]);
            item.sn = cleanArg(args[5]);
            item.category = 'SCROLL';
            item.material = 'paper';
            item.weight = 5;
            item.isStackable = true;
        } else if (macroName === 'XTRA_SCROLL_LABEL') {
            item.name = null;
            item.descr = parseString(args[0]);
            item.sn = cleanArg(args[1]);
            item.category = 'SCROLL';
            item.material = 'paper';
            item.weight = 5;
            item.isMagical = true;
            item.isStackable = true;
        } else if (macroName === 'SPELL' || macroName === 'SPBOOK') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.spellSkill = parseSkill(args[2]);
            item.prob = parseNum(args[3]);
            item.delay = parseNum(args[4]);
            item.spellLevel = parseNum(args[5]);
            item.isMagical = parseNum(args[6]) === 1;
            const dir = cleanArg(args[7]);
            item.zapType = dir === 'RAY' ? 'ray' : (dir === 'IMMEDIATE' ? 'beam' : 'nodir');
            item.color = cleanArg(args[8]);
            item.sn = cleanArg(args[9]);
            item.cost = item.spellLevel ? item.spellLevel * 100 : 100;
            item.category = 'SPELLBOOK';
            item.material = 'paper';
            item.weight = 50;
        } else if (macroName === 'GEM') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.prob = parseNum(args[2]);
            item.weight = parseNum(args[3]);
            item.cost = parseNum(args[4]);
            item.nutrition = parseNum(args[5]);
            item.material = parseMaterial(args[7]);
            item.color = cleanArg(args[8]);
            item.sn = cleanArg(args[9]);
            item.category = 'GEM';
            item.isStackable = true;
        } else if (macroName === 'ROCK') {
            item.name = parseString(args[0]);
            item.descr = parseString(args[1]);
            item.prob = parseNum(args[3]);
            item.weight = parseNum(args[4]);
            item.cost = parseNum(args[5]);
            item.sdamMax = parseNum(args[6]);
            item.ldamMax = parseNum(args[7]);
            item.nutrition = parseNum(args[9]);
            item.material = parseMaterial(args[11]);
            item.color = cleanArg(args[12]);
            item.sn = cleanArg(args[13]);
            item.category = 'GEM';
            item.isStackable = true;
        } else {
            item.name = parseString(args[0]) || `object_${onum}`;
            item.sn = cleanArg(args[args.length - 1]);
        }

        items.push(item);
        onum++;
    }

    return items;
}

const items = extractAllObjectData();
console.log(`Successfully extracted ${items.length} items (expected 481).`);

const outputPath = 'C:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/OBJECT_KNOWLEDGE_BASE.js';
const fileContent = `/**
 * OBJECT_KNOWLEDGE_BASE.js
 * NetHack 5.0 (3.7) 全 481 アイテム (onum 0〜480) 公式確定パラメータマスターデータ
 * Auto-generated by tools/extract_object_data.js from include/objects.h
 */

export const OBJECT_KNOWLEDGE_BASE = ${JSON.stringify(items, null, 4)};
`;

fs.writeFileSync(outputPath, fileContent, 'utf8');
console.log(`Saved base object knowledge to ${outputPath}`);
