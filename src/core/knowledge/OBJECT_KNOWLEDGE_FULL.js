/**
 * OBJECT_KNOWLEDGE_FULL.js
 * NetHack 5.0 (3.7) 全 481 アイテム (onum 0〜480) 構造化ナレッジ完全マスターデータ
 *
 * Single Source of Truth: docs/5_gamedata/tilemappings.lst
 */

import { getCategoryFromOnum, getItemInfoFromOnum } from './glyphClassifier.js';
import { OBJECT_TILEMAP_NAMES } from './tilemappings_data.js';

export const OBJECT_KNOWLEDGE_MAP = new Map();

/**
 * onum および category, itemInfo, detail からデフォルト推奨操作動詞情報を判定する
 * @param {number} onum 
 * @param {string} category 
 * @param {Object} itemInfo 
 * @param {Object} [detail={}] 
 * @returns {Object} { defaultVerb, verbKey, actionLabelJa, defaultActionLabel }
 */
export function getDefaultVerbForObject(onum, category, itemInfo = {}, detail = {}) {
    // 🎯 個別アイテム辞書 (SPECIFIC_ITEM_DETAILS) でのオーバーライド指定を最優先
    if (detail && detail.defaultVerb) {
        return {
            defaultVerb: detail.defaultVerb,
            verbKey: detail.verbKey || 'a',
            actionLabelJa: detail.actionLabelJa || `使う (${detail.verbKey || 'a'})`,
            defaultActionLabel: detail.defaultActionLabel || 'Apply'
        };
    }

    // 特殊アイテム個別判定
    if (itemInfo.isAmmo) {
        return { defaultVerb: 'quiver', verbKey: 'Q', actionLabelJa: '装填/矢筒 (Q)', defaultActionLabel: 'Quiver ammo' };
    }
    if (itemInfo.isCanOpener) {
        return { defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '使う (a)', defaultActionLabel: 'Apply can opener' };
    }
    if (itemInfo.isBox) {
        return { defaultVerb: 'drop', verbKey: 'd', actionLabelJa: '置く/落とす (d)', defaultActionLabel: 'Drop container' };
    }
    if (itemInfo.isBag) {
        return { defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '中を見る/使う (a)', defaultActionLabel: 'Look inside bag' };
    }
    if (itemInfo.isTouchstone) {
        return { defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '使う/鑑定する (a)', defaultActionLabel: 'Apply touchstone' };
    }
    if (itemInfo.isGem || itemInfo.isRock) {
        return { defaultVerb: 'throw', verbKey: 't', actionLabelJa: '投げる (t)', defaultActionLabel: 'Throw gem/rock' };
    }
    if (itemInfo.isTin) {
        return { defaultVerb: 'eat', verbKey: 'e', actionLabelJa: '開けて食べる (e)', defaultActionLabel: 'Eat tin' };
    }
    if (itemInfo.isDigWand) {
        return { defaultVerb: 'zap', verbKey: 'z', actionLabelJa: '振る (z)', defaultActionLabel: 'Zap wand' };
    }

    // カテゴリ別標準判定
    switch (category) {
        case 'WEAPON':
            return { defaultVerb: 'wield', verbKey: 'w', actionLabelJa: '手に持つ (w)', defaultActionLabel: 'Wield weapon' };
        case 'ARMOR':
            return { defaultVerb: 'wear', verbKey: 'W', actionLabelJa: '着用する (W)', defaultActionLabel: 'Wear armor' };
        case 'POTION':
            return { defaultVerb: 'quaff', verbKey: 'q', actionLabelJa: '飲む (q)', defaultActionLabel: 'Quaff potion' };
        case 'SCROLL':
            return { defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)', defaultActionLabel: 'Read scroll' };
        case 'SPELLBOOK':
            return { defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)', defaultActionLabel: 'Read spellbook' };
        case 'WAND':
            return { defaultVerb: 'zap', verbKey: 'z', actionLabelJa: '振る (z)', defaultActionLabel: 'Zap wand' };
        case 'RING':
            return { defaultVerb: 'put_on', verbKey: 'P', actionLabelJa: 'はめる (P)', defaultActionLabel: 'Put on ring' };
        case 'AMULET':
            return { defaultVerb: 'put_on', verbKey: 'P', actionLabelJa: '首にかける (P)', defaultActionLabel: 'Put on amulet' };
        case 'FOOD':
            return { defaultVerb: 'eat', verbKey: 'e', actionLabelJa: '食べる (e)', defaultActionLabel: 'Eat food' };
        case 'TOOL':
        case 'CONTAINER':
            return { defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '使う (a)', defaultActionLabel: 'Apply tool' };
        default:
            return { defaultVerb: 'inventory', verbKey: 'i', actionLabelJa: '一覧から選択 (i)', defaultActionLabel: 'Inventory item' };
    }
}

const goldDetail = { 
    id: 'gold_piece',
    name: 'gold piece',
    category: 'GOLD',
    flavorNote: 'Gold coins used for dungeon commerce, donating at temples for divine protection (+AC), and purchasing items from shopkeepers.',
    effectSummary: 'Universal dungeon currency. Donate to temple priests for permanent AC protection, or buy gear from shopkeepers.',
    defaultVerb: 'drop', verbKey: 'd', actionLabelJa: '置く/落とす (d)',
    usageAdvice: [
        '店主からの装備品・消耗品の購入に使用します',
        '寺院の僧侶(Priest)に十分な金貨を寄付すると、永久的なACボーナス(加護/Protection)を獲得できます',
        '重量が増加するため、大金を持ち歩く際は袋(Bag)に入れるかダンジョン内に一時保管推奨'
    ]
};

// 特徴的・重要アイテムの特定定義辞書 (onum 主軸による100%完全網羅)
const SPECIFIC_ITEM_DETAILS = {
    // 🪙 特殊・クエスト・通貨 (onum 0〜17, 436〜438)
    "1": { 
        flavorNote: 'The ultimate prize of the dungeon. Carrying it grants immense power but attracts severe divine wrath.',
        effectSummary: 'NetHack\'s ultimate goal item. Carry to the Astral Plane to offer to your deity and ascend.',
        defaultVerb: 'inventory', verbKey: 'i', actionLabelJa: '一覧から選択 (i)',
        usageAdvice: ['Do not drop or lose track of the Amulet', 'Increases monster difficulty and magic energy drain while carried']
    },
    "2": { 
        flavorNote: 'Essential ritual bell for opening the way to Vlad\'s Tower and the Invocation Ritual.',
        effectSummary: 'Apply with \'a\' to ring during the Invocation Ritual.',
        defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '鳴らす/使う (a)'
    },
    "3": { 
        flavorNote: 'Seven-pinnacled candelabrum used for the sacred Invocation Ritual.',
        effectSummary: 'Attach 7 candles and apply with \'a\' to light during Invocation.',
        defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '灯す/使う (a)'
    },
    "4": { 
        flavorNote: 'The ancient papyrus spellbook required to perform the Invocation Ritual.',
        effectSummary: 'Read with \'r\' at the vibrating square during the Invocation Ritual.',
        defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)'
    },
    "12": goldDetail,
    "436": goldDetail,
    "437": goldDetail,
    "438": goldDetail,

    // ⚔️ 武器 (WEAPON: onum 18〜88)
    "18": { stats: { sdam: '1d6', ldam: '1d6', hands: 1, material: 'wood', weight: 1 }, flavorNote: 'Standard ammo fired from bows.' },
    "19": { stats: { sdam: '1d7', ldam: '1d5', hands: 1, material: 'wood', weight: 1 }, flavorNote: 'Finely crafted elven arrow with higher accuracy.' },
    "20": { stats: { sdam: '1d5', ldam: '1d6', hands: 1, material: 'iron', weight: 1 }, flavorNote: 'Crude iron arrow used by orcs.' },
    "21": { stats: { sdam: '1d6 (+1d20 vs Silver-hate)', ldam: '1d6 (+1d20)', hands: 1, material: 'silver', weight: 1 }, flavorNote: 'Silver burns evil entities on touch, dealing lethal extra damage.' },
    "22": { stats: { sdam: '1d7', ldam: '1d7', hands: 1, material: 'bamboo', weight: 1 }, flavorNote: 'Heavy bamboo arrow fired from Yumi bows.' },
    "23": { stats: { sdam: '1d4+1', ldam: '1d6+1', hands: 1, material: 'iron', weight: 1 }, flavorNote: 'Heavy bolt fired from crossbows.' },
    "24": { stats: { sdam: '1d3', ldam: '1d2', hands: 1, material: 'iron', weight: 1 }, flavorNote: 'Small missile weapon easy to coat with poison.' },
    "25": { stats: { sdam: '1d8', ldam: '1d6', hands: 1, material: 'iron', weight: 1 }, flavorNote: 'Ninja throwing star suited for fast ranged attacks.' },
    "26": { stats: { sdam: '1d9', ldam: '1d9', hands: 1, material: 'wood', weight: 5 }, flavorNote: 'Curved wooden missile that can return to hand.' },
    "27": { stats: { sdam: '1d6', ldam: '1d8', hands: 1, material: 'iron', weight: 30 }, flavorNote: 'Basic single-handed pole weapon.' },
    "28": { stats: { sdam: '1d7', ldam: '1d8', hands: 1, material: 'wood', weight: 30 }, flavorNote: 'Elven spear with superior balance.' },
    "29": { stats: { sdam: '1d5', ldam: '1d8', hands: 1, material: 'iron', weight: 30 }, flavorNote: 'Crude spear forged by orcs.' },
    "30": { stats: { sdam: '1d8', ldam: '1d8', hands: 1, material: 'iron', weight: 35 }, flavorNote: 'Heavy dwarvish spear.' },
    "31": { stats: { sdam: '1d6 (+1d20)', ldam: '1d8 (+1d20)', hands: 1, material: 'silver', weight: 30 }, flavorNote: 'Silver spear capable of skewering demonic & undead foes.' },
    "32": { stats: { sdam: '1d6', ldam: '1d6', hands: 1, material: 'iron', weight: 20 }, flavorNote: 'Light throwing spear.' },
    "33": { stats: { sdam: '1d6+1', ldam: '3d4', hands: 1, material: 'iron', weight: 25 }, flavorNote: 'Three-pronged spear dealing 3d4 damage against large aquatic beasts.' },
    "34": { stats: { sdam: '1d4', ldam: '1d3', hands: 1, material: 'iron', weight: 10 }, flavorNote: 'Versatile knife excellent for throwing or dual-wielding.' },
    "35": { stats: { sdam: '1d5', ldam: '1d3', hands: 1, material: 'wood', weight: 10 }, flavorNote: 'Light elven dagger.' },
    "36": { stats: { sdam: '1d3', ldam: '1d5', hands: 1, material: 'iron', weight: 10 }, flavorNote: 'Orcish dagger.' },
    "37": { stats: { sdam: '1d4 (+1d20)', ldam: '1d3 (+1d20)', hands: 1, material: 'silver', weight: 10 }, flavorNote: 'Lightweight silver weapon indispensable in Gehennom.' },
    "38": { stats: { sdam: '1d4', ldam: '1d3', hands: 1, material: 'iron', weight: 10 }, flavorNote: 'Ritual dagger that engraves Elbereth on the floor instantly with 100% safety.', usageAdvice: ['Always keep for emergency Elbereth engraving'] },
    "39": { stats: { sdam: '1d3', ldam: '1d3', hands: 1, material: 'metal', weight: 5 }, flavorNote: 'Precision surgical knife.' },
    "40": { stats: { sdam: '1d3', ldam: '1d2', hands: 1, material: 'iron', weight: 10 }, flavorNote: 'Utility knife.' },
    "41": { stats: { sdam: '1d3', ldam: '1d2', hands: 1, material: 'iron', weight: 10 }, flavorNote: 'Slender stabbing blade designed to penetrate armor joints.' },
    "42": { stats: { sdam: '1d2', ldam: '1d2', hands: 1, material: 'organ', weight: 5 }, flavorNote: 'Raw worm tooth. Can be transformed into crysknife with scroll of enchant weapon.' },
    "43": { stats: { sdam: '1d10', ldam: '1d10', hands: 1, material: 'crystal', weight: 10 }, flavorNote: 'Razor-sharp crystal blade created from worm tooth.', usageAdvice: ['Do not drop on floor as it shatters'] },
    "44": { stats: { sdam: '1d6', ldam: '1d4', hands: 1, material: 'iron', weight: 60 }, flavorNote: 'Woodcutting tool that doubles as a deadly hand axe.' },
    "45": { stats: { sdam: '1d8+1d4', ldam: '1d6+2d4', hands: 2, material: 'iron', weight: 120 }, flavorNote: 'Devastating 2-handed battle axe.' },
    "46": { stats: { sdam: '1d6', ldam: '1d8', hands: 1, material: 'iron', weight: 30 }, flavorNote: 'Standard one-handed short sword.' },
    "47": { stats: { sdam: '1d8', ldam: '1d8', hands: 1, material: 'wood', weight: 30 }, flavorNote: 'Elven short sword.' },
    "48": { stats: { sdam: '1d5', ldam: '1d8', hands: 1, material: 'iron', weight: 30 }, flavorNote: 'Orcish short sword.' },
    "49": { stats: { sdam: '1d7', ldam: '1d8', hands: 1, material: 'iron', weight: 35 }, flavorNote: 'Dwarvish short sword.' },
    "50": { stats: { sdam: '1d8', ldam: '1d8', hands: 1, material: 'iron', weight: 40 }, flavorNote: 'Curved sword favored by desert warriors.' },
    "51": { stats: { sdam: '1d8 (+1d20)', ldam: '1d8 (+1d20)', hands: 1, material: 'silver', weight: 40 }, flavorNote: 'Silver burns evil entities on touch, making it one of the deadliest weapons in Gehennom.', usageAdvice: ['Dual-wield silver sabers to obliterate demon lords'] },
    "52": { stats: { sdam: '2d4', ldam: '1d6+1', hands: 1, material: 'iron', weight: 70 }, flavorNote: 'Heavy broad-bladed sword.' },
    "53": { stats: { sdam: '1d6+1', ldam: '2d4', hands: 1, material: 'wood', weight: 50 }, flavorNote: 'Elven broadsword.' },
    "54": { stats: { sdam: '1d8', ldam: '1d12', hands: 1, material: 'iron', weight: 30 }, flavorNote: 'The classic adventurer sidearm. Reliable and versatile in single-handed combat.' },
    "55": { stats: { sdam: '1d10', ldam: '3d6', hands: 2, material: 'iron', weight: 150 }, flavorNote: 'Massive 2-handed sword dealing 3d6 damage to large beasts.' },
    "56": { stats: { sdam: '1d10', ldam: '1d12', hands: 1, material: 'iron', weight: 40 }, flavorNote: 'Masterwork folded steel blade with highest single-handed longsword base damage.' },
    "57": { stats: { sdam: '1d16', ldam: '1d8+2d6', hands: 2, material: 'iron', weight: 180 }, flavorNote: 'Giant 2-handed Samurai blade capable of severe slicing.' },
    "58": { stats: { sdam: '2d4', ldam: '1d6+1', hands: 1, material: 'iron', weight: 70 }, flavorNote: 'Runed sword infused with dark magic.' },
    "59": { stats: { sdam: '1d6+1', ldam: '2d4', hands: 2, material: 'iron', weight: 80 }, flavorNote: '2-handed polearm with partisan head.' },
    "60": { stats: { sdam: '2d4', ldam: '2d4', hands: 2, material: 'iron', weight: 70 }, flavorNote: '2-handed ranseur polearm.' },
    "61": { stats: { sdam: '1d6+1', ldam: '2d6', hands: 2, material: 'iron', weight: 50 }, flavorNote: '2-handed spetum polearm.' },
    "62": { stats: { sdam: '1d10', ldam: '1d10', hands: 2, material: 'iron', weight: 75 }, flavorNote: 'Single-edged glaive polearm.' },
    "63": { stats: { sdam: '1d10', ldam: '2d6', hands: 2, material: 'iron', weight: 150 }, flavorNote: 'Heavy halberd poleaxe.' },
    "64": { stats: { sdam: '2d4', ldam: '3d4', hands: 2, material: 'iron', weight: 120 }, flavorNote: 'Long poleaxe bardiche.' },
    "65": { stats: { sdam: '2d4', ldam: '5d4', hands: 2, material: 'iron', weight: 125 }, flavorNote: 'Heavy voulge pole cleaver.' },
    "66": { stats: { sdam: '1d6', ldam: '1d8', hands: 2, material: 'iron', weight: 60 }, flavorNote: 'Fauchard pole sickle.' },
    "67": { stats: { sdam: '2d4', ldam: '1d8', hands: 2, material: 'iron', weight: 80 }, flavorNote: 'Guisarme pruning hook polearm.' },
    "68": { stats: { sdam: '2d4', ldam: '1d10', hands: 2, material: 'iron', weight: 120 }, flavorNote: 'Bill-guisarme hooked polearm.' },
    "69": { stats: { sdam: '2d4', ldam: '1d6', hands: 2, material: 'iron', weight: 150 }, flavorNote: 'Lucern hammer pronged polearm.' },
    "70": { stats: { sdam: '1d8+1', ldam: '1d6', hands: 2, material: 'iron', weight: 100 }, flavorNote: 'Bec-de-corbin beaked polearm.' },
    "71": { stats: { sdam: '1d12', ldam: '1d8+2d6', hands: 2, material: 'iron', weight: 200 }, flavorNote: 'Heavy dwarvish digging tool that acts as a lethal 2-handed weapon.' },
    "72": { stats: { sdam: '1d10', ldam: '1d10', hands: 1, material: 'iron', weight: 180 }, flavorNote: 'Heavy lance dealing devastating damage during horseback charging.' },
    "73": { stats: { sdam: '1d6+1', ldam: '1d6', hands: 1, material: 'iron', weight: 30 }, flavorNote: 'Heavy blunt mace.' },
    "74": { stats: { sdam: '1d6+1 (+1d20)', ldam: '1d6 (+1d20)', hands: 1, material: 'silver', weight: 30 }, flavorNote: 'Silver mace delivering bludgeoning silver damage.' },
    "75": { stats: { sdam: '2d4', ldam: '1d6+1', hands: 1, material: 'iron', weight: 100 }, flavorNote: 'Spiked ball morning star.' },
    "76": { stats: { sdam: '1d4+1', ldam: '1d4', hands: 1, material: 'iron', weight: 50 }, flavorNote: 'Heavy war hammer.' },
    "77": { stats: { sdam: '1d6', ldam: '1d3', hands: 1, material: 'wood', weight: 30 }, flavorNote: 'Basic wooden club.' },
    "78": { stats: { sdam: '1d4', ldam: '1d3', hands: 1, material: 'rubber', weight: 20 }, flavorNote: 'Flexible weapon that disarms opponents and insulates against electricity.' },
    "79": { stats: { sdam: '1d6', ldam: '1d6', hands: 2, material: 'wood', weight: 40 }, flavorNote: 'Simple wooden pole loved by spellcasters and monks.' },
    "80": { stats: { sdam: '1d6', ldam: '1d3', hands: 1, material: 'iron', weight: 15 }, flavorNote: 'Thonged club that automatically returns to hand when thrown.' },
    "81": { stats: { sdam: '1d6+1', ldam: '2d4', hands: 1, material: 'iron', weight: 15 }, flavorNote: 'Chained flail.' },
    "82": { stats: { sdam: '1d2', ldam: '1d1', hands: 1, material: 'leather', weight: 20 }, flavorNote: 'Leather whip capable of disarming enemies and taming beasts.' },
    "83": { stats: { sdam: '1d6', ldam: '1d6', hands: 2, material: 'wood', weight: 30 }, flavorNote: 'Wooden bow for firing arrows.' },
    "84": { stats: { sdam: '1d7', ldam: '1d6', hands: 2, material: 'wood', weight: 30 }, flavorNote: 'Elven bow with higher fire velocity.' },
    "85": { stats: { sdam: '1d5', ldam: '1d5', hands: 2, material: 'wood', weight: 30 }, flavorNote: 'Orcish bow.' },
    "86": { stats: { sdam: '1d7', ldam: '1d7', hands: 2, material: 'wood', weight: 30 }, flavorNote: 'Japanese long bow (Yumi).' },
    "87": { stats: { sdam: '1d6', ldam: '1d6', hands: 1, material: 'leather', weight: 3 }, flavorNote: 'Leather sling for launching rocks and flint stones.' },
    "88": { stats: { sdam: '1d6', ldam: '1d6', hands: 2, material: 'wood', weight: 50 }, flavorNote: 'Crossbow for shooting bolts.' },

    // 🛡️ 防具 (ARMOR: onum 89〜172 全84種全件フルカバー)
    "89": { stats: { ac: 1, material: 'leather', weight: 6 }, flavorNote: 'Light elven leather helm.' },
    "90": { stats: { ac: 1, material: 'iron', weight: 30 }, flavorNote: 'Orcish iron skull cap.' },
    "91": { stats: { ac: 2, material: 'iron', weight: 40 }, flavorNote: 'Dwarvish hard iron hat.' },
    "92": { stats: { ac: 1, material: 'cloth', weight: 6 }, flavorNote: 'Stylish fedora hat.' },
    "93": { stats: { ac: 1, material: 'cloth', weight: 4 }, flavorNote: 'Conical wizard hat boosting spellcasting success for Wizards.' },
    "94": { stats: { ac: 1, material: 'cloth', weight: 4 }, flavorNote: 'Dunce cap reducing Intelligence when worn.' },
    "95": { stats: { ac: 1, material: 'iron', weight: 10 }, flavorNote: 'Dented iron pot worn as emergency helm.' },
    "96": { stats: { ac: 1, material: 'crystal', weight: 50 }, flavorNote: 'Enchanted helmet that boosts Intelligence and Wisdom.' },
    "97": { stats: { ac: 1, material: 'iron', weight: 30 }, flavorNote: 'Standard plumed iron helmet.' },
    "98": { stats: { ac: 1, material: 'iron', weight: 30 }, flavorNote: 'Helm of caution preventing surprise attacks.' },
    "99": { stats: { ac: 1, material: 'iron', weight: 30 }, flavorNote: 'Cursed helmet inverting alignment (Lawful <-> Chaotic).' },
    "100": { stats: { ac: 1, material: 'iron', weight: 40 }, flavorNote: 'Visored helm that grants Telepathy (ESP) to see mind-bearing monsters.' },
    "101": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Forged from gray dragon scales. Grants essential Magic Resistance.' },
    "102": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Gold dragon scale mail granting Disintegration Resistance.' },
    "103": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Forged from silver dragon scales. Reflects rays and death zaps.' },
    "104": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Red dragon scale mail granting Fire Resistance.' },
    "105": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'White dragon scale mail granting Cold Resistance.' },
    "106": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Orange dragon scale mail granting Sleep Resistance.' },
    "107": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Black dragon scale mail granting Disintegration Resistance.' },
    "108": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Blue dragon scale mail granting Shock Resistance.' },
    "109": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Green dragon scale mail granting Poison Resistance.' },
    "110": { stats: { ac: 9, material: 'dragon scale', weight: 40 }, flavorNote: 'Yellow dragon scale mail granting Acid Resistance.' },
    "111": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Gray dragon scale armor for Magic Resistance.' },
    "112": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Silver dragon scale armor for Reflection.' },
    "113": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Red dragon scale armor for Fire Resistance.' },
    "114": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'White dragon scale armor for Cold Resistance.' },
    "115": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Orange dragon scale armor for Sleep Resistance.' },
    "116": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Black dragon scale armor for Disintegration Resistance.' },
    "117": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Blue dragon scale armor for Shock Resistance.' },
    "118": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Green dragon scale armor for Poison Resistance.' },
    "119": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Yellow dragon scale armor for Acid Resistance.' },
    "120": { stats: { ac: 10, material: 'dragon scale', weight: 40 }, flavorNote: 'Gold dragon scale armor.' },
    "121": { stats: { ac: 7, material: 'iron', weight: 450 }, flavorNote: 'Maximum early physical protection for heavy melee knights.' },
    "122": { stats: { ac: 7, material: 'crystal', weight: 450 }, flavorNote: 'Heavy crystalline plate mail.' },
    "123": { stats: { ac: 6, material: 'iron', weight: 400 }, flavorNote: 'Splint mail composed of interlocked metal strips.' },
    "124": { stats: { ac: 6, material: 'iron', weight: 250 }, flavorNote: 'Heavy banded mail armor.' },
    "125": { stats: { ac: 5, material: 'iron', weight: 300 }, flavorNote: 'Interlocked iron ring chain mail.' },
    "126": { stats: { ac: 6, material: 'mithril', weight: 150 }, flavorNote: 'Dwarvish mithril coat providing high AC with light weight.' },
    "127": { stats: { ac: 5, material: 'mithril', weight: 150 }, flavorNote: 'Lightweight elven mithril coat that never hinders spellcasting.' },
    "128": { stats: { ac: 4, material: 'iron', weight: 250 }, flavorNote: 'Scale mail armor.' },
    "129": { stats: { ac: 3, material: 'iron', weight: 250 }, flavorNote: 'Ring mail armor.' },
    "130": { stats: { ac: 3, material: 'iron', weight: 250 }, flavorNote: 'Orcish ring mail.' },
    "131": { stats: { ac: 2, material: 'leather', weight: 200 }, flavorNote: 'Studded leather armor reinforced with metal studs.' },
    "132": { stats: { ac: 2, material: 'leather', weight: 200 }, flavorNote: 'Reinforced elven ring mail.' },
    "133": { stats: { ac: 2, material: 'leather', weight: 150 }, flavorNote: 'Basic cured leather jacket.' },
    "134": { stats: { ac: 1, material: 'leather', weight: 50 }, flavorNote: 'Lightweight leather jacket worn by archeologists and rogues.' },
    "135": { stats: { ac: 0, material: 'cloth', weight: 30 }, flavorNote: 'Basic cloth apron protecting against corrosion.' },
    "136": { stats: { ac: 0, material: 'cloth', weight: 5 }, flavorNote: 'Tropical shirt worn under body armor for extra enchantment slots.' },
    "137": { stats: { ac: 0, material: 'cloth', weight: 5 }, flavorNote: 'Casual T-shirt worn under armor for extra enchantment AC.' },
    "138": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Basic travel cloak.' },
    "139": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Elven cloak enhancing stealth.' },
    "140": { stats: { ac: 2, material: 'leather', weight: 10 }, flavorNote: 'Coarse orcish cloak.' },
    "141": { stats: { ac: 2, material: 'cloth', weight: 10 }, flavorNote: 'Heavy dwarvish cloak.' },
    "142": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Waterproof cloak protecting wearer and inventory from water damage.' },
    "143": { stats: { ac: 2, material: 'cloth', weight: 15 }, flavorNote: 'Spellcaster robe that dramatically increases spellcasting success.' },
    "144": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Alchemy smock granting resistance to acid and poison.' },
    "145": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Cloak granting stealth.' },
    "146": { stats: { ac: 3, material: 'cloth', weight: 10 }, flavorNote: 'Protective cloak granting high AC and Magic Cancellation (MC3).' },
    "147": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Cloak that renders wearer completely invisible.' },
    "148": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Rare cloak granting Magic Resistance to body.' },
    "149": { stats: { ac: 1, material: 'cloth', weight: 10 }, flavorNote: 'Cloak projecting false images to confuse enemy melee attacks.' },
    "150": { stats: { ac: 1, material: 'wood', weight: 30 }, flavorNote: 'Small wooden buckler shield.' },
    "151": { stats: { ac: 2, material: 'wood', weight: 40 }, flavorNote: 'Elven wooden shield.' },
    "152": { stats: { ac: 1, material: 'iron', weight: 50 }, flavorNote: 'Orcish iron shield.' },
    "153": { stats: { ac: 2, material: 'iron', weight: 50 }, flavorNote: 'Dwarvish round shield.' },
    "154": { stats: { ac: 2, material: 'iron', weight: 100 }, flavorNote: 'Large iron shield.' },
    "155": { stats: { ac: 0, material: 'iron', weight: 30 }, flavorNote: 'Shield granting extra physical AC enchantment.' },
    "156": { stats: { ac: 2, material: 'iron', weight: 50 }, flavorNote: 'Shield granting Reflection to reflect zaps.' },
    "157": { stats: { ac: 1, material: 'leather', weight: 10 }, flavorNote: 'Basic leather gloves.' },
    "158": { stats: { ac: 2, material: 'silver', weight: 50 }, flavorNote: 'Polished silver shield reflecting death zaps and petrifying gazes.' },
    "159": { stats: { ac: 1, material: 'leather', weight: 10 }, flavorNote: 'Essential gloves for handling petrifying cockatrice corpses safely.' },
    "160": { stats: { ac: 1, material: 'iron', weight: 40 }, flavorNote: 'Heavy iron gauntlets.' },
    "161": { stats: { ac: 1, material: 'iron', weight: 40 }, flavorNote: 'Heavy gauntlets boosting Strength to 18/100 instantly.' },
    "162": { stats: { ac: 1, material: 'leather', weight: 10 }, flavorNote: 'Gloves boosting Dexterity and dual-wielding accuracy.' },
    "163": { stats: { ac: 1, material: 'leather', weight: 10 }, flavorNote: 'Gloves of power.' },
    "164": { stats: { ac: 1, material: 'leather', weight: 10 }, flavorNote: 'Low boots.' },
    "165": { stats: { ac: 2, material: 'iron', weight: 50 }, flavorNote: 'Iron shoes.' },
    "166": { stats: { ac: 1, material: 'leather', weight: 20 }, flavorNote: 'Boots granting Very Fast movement speed to outrun lethal threats.' },
    "167": { stats: { ac: 1, material: 'leather', weight: 15 }, flavorNote: 'Boots allowing wearer to walk across deep water.' },
    "168": { stats: { ac: 1, material: 'leather', weight: 15 }, flavorNote: 'Boots granting jumping ability.' },
    "169": { stats: { ac: 1, material: 'leather', weight: 15 }, flavorNote: 'Boots granting stealth.' },
    "170": { stats: { ac: 1, material: 'leather', weight: 15 }, flavorNote: 'Cursed boots causing slippage.' },
    "171": { stats: { ac: 1, material: 'leather', weight: 15 }, flavorNote: 'Boots of kicking damage.' },
    "172": { stats: { ac: 1, material: 'leather', weight: 15 }, flavorNote: 'Boots enabling continuous levitation over pits and lava.' },

    // 💍 指輪 (RING: onum 173〜200)
    "173": { flavorNote: 'Decorative ring with no combat properties.' },
    "174": { flavorNote: 'Increases Strength score.' },
    "175": { flavorNote: 'Increases Constitution score.' },
    "176": { flavorNote: 'Increases physical hit accuracy.' },
    "177": { flavorNote: 'Increases physical damage per hit.' },
    "178": { flavorNote: 'Improves AC (defense).' },
    "179": { flavorNote: 'Dramatically speeds up HP regeneration.' },
    "180": { flavorNote: 'Automatically detects secret doors and hidden traps.' },
    "181": { flavorNote: 'Silences footsteps to sneak past sleeping monsters.' },
    "182": { flavorNote: 'Protects ability scores from reduction or drain.' },
    "183": { flavorNote: 'Enables continuous levitation to bypass pits, land mines, water, and lava.' },
    "184": { flavorNote: 'Cursed ring that accelerates hunger rate.' },
    "185": { flavorNote: 'Cursed ring that awakens and aggravates all monsters on floor.' },
    "186": { flavorNote: 'Sows chaos in monster packs, causing enemy numbers to attack each other.' },
    "187": { flavorNote: 'Warns of nearby monsters and hostile threats.' },
    "188": { flavorNote: 'Grants total immunity to poisonous attacks and tainted food.' },
    "189": { flavorNote: 'Grants resistance against fire breath and heat traps.' },
    "190": { flavorNote: 'Grants resistance against ice breath and cold damage.' },
    "191": { flavorNote: 'Grants resistance against shock and lightning bolts.' },
    "192": { flavorNote: 'Renders wearer completely immune to paralysis and freeze effects.' },
    "193": { flavorNote: 'Halves hunger rate, solving food shortages.' },
    "194": { flavorNote: 'Randomly teleports wearer across current level.' },
    "195": { flavorNote: 'Grants full mastery over teleportation destinations.' },
    "196": { flavorNote: 'Polymorphs wearer or items.' },
    "197": { flavorNote: 'Allows choosing target form when polymorphing.' },
    "198": { flavorNote: 'Renders wearer invisible to monsters without see-invisible.' },
    "199": { flavorNote: 'Reveals invisible monsters.' },
    "200": { flavorNote: 'Exposes shapeshifters, chameleons, and mimics in disguise.' },

    // 📿 アミュレット (AMULET: onum 201〜213)
    "201": { flavorNote: 'Reveals location of all mind-bearing monsters on screen.' },
    "202": { flavorNote: 'A divine safety net that restores life once upon fatal death.' },
    "203": { flavorNote: 'Cursed amulet that strangles wearer to death.' },
    "204": { flavorNote: 'Cursed amulet causing sudden deep sleep in combat.' },
    "205": { flavorNote: 'Grants total immunity to poison.' },
    "206": { flavorNote: 'Changes wearer\'s gender.' },
    "207": { flavorNote: 'Prevents unwanted polymorphing or slime transformation.' },
    "208": { flavorNote: 'Reflects rays, zaps, and petrifying gazes back at attackers.' },
    "209": { flavorNote: 'Allows breathing underwater and in poison gas.' },

    // 🎒 容器 & 道具 (CONTAINER / TOOL: onum 214〜263)
    "214": { flavorNote: 'Large wooden storage box.' },
    "215": { flavorNote: 'Sturdy lockable chest for item storage.' },
    "216": { flavorNote: 'Refrigerated box preserving corpses from decay indefinitely.' },
    "217": { flavorNote: 'Basic cloth sack.' },
    "218": { flavorNote: 'Waterproof bag protecting internal contents even when submerged.' },
    "219": { flavorNote: 'Magical bag reducing weight of internal contents by 50%. Do NOT insert Bag of Tricks or Magic Lamp!' },
    "221": { flavorNote: 'Skeleton key for opening locked doors and chests.' },
    "222": { flavorNote: 'Lock pick for picking locks.' },
    "223": { flavorNote: 'Credit card used to pick door locks.' },
    "226": { flavorNote: 'Brass lantern for lighting dark rooms.' },
    "228": { flavorNote: 'Rubbing this lamp brings forth a Djinn to grant a wish.' },
    "230": { flavorNote: 'Essential mirror used to reflect Medusa\'s petrifying gaze back at her.' },
    "233": { flavorNote: 'Blocks vision to protect against gaze attacks and paralyzing eyes.' },
    "234": { flavorNote: 'Multipurpose towel for wiping face or wrapping around eyes as blindfold.' },
    "237": { flavorNote: 'Stethoscope for measuring monster HP and detecting behind walls.' },
    "242": { flavorNote: 'Magical marker used to write scrolls and spellbooks.' },
    "245": { flavorNote: 'Whistle to attract pets.' },
    "246": { flavorNote: 'Instantly teleports your pets to your side from anywhere on floor.' },
    "260": { flavorNote: 'Iron grappling hook attached to a long rope.', effectSummary: 'Apply with \'a\' to climb across pits, scale walls, or pull distant items closer.', defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '使う (a)' },
    "261": { flavorNote: 'Sacred horn of a unicorn. Ultimate status restore tool.', effectSummary: 'Tool (`#apply`). Cures poison, illness, blindness, confusion, and stat loss.', defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '使う (a)', usageAdvice: ['Apply (`#apply`) immediately after stat drain or poison hit', 'Blessing increases success rate to 100%'] },
    "262": { flavorNote: 'Seven-pinnacled candelabrum used for the sacred Invocation Ritual.', effectSummary: 'Attach 7 candles and apply with \'a\' to light during the Invocation Ritual.', defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '灯す/使う (a)' },
    "263": { flavorNote: 'Essential ritual bell for opening the way to Vlad\'s Tower and the Invocation Ritual.', effectSummary: 'Apply with \'a\' to ring during the Invocation Ritual.', defaultVerb: 'apply', verbKey: 'a', actionLabelJa: '鳴らす/使う (a)' },

    // 🍖 食料 (FOOD: onum 264〜296)
    "264": { flavorNote: 'Raw monster meat corpse.', effectSummary: 'Eating monster corpses can grant intrinsics (Poison, Fire resistance), but rots quickly causing food poisoning.', usageAdvice: ['Eat fresh corpses immediately to gain intrinsic resistances', 'Do not eat old/tainted corpses unless immune to poison'] },
    "274": { flavorNote: 'Lizard corpse.', effectSummary: 'Cures petrification (stoning) and confusion when eaten! Never rots.', usageAdvice: ['CRITICAL: Always keep a lizard corpse in inventory to cure cockatrice stoning'] },
    "286": { flavorNote: 'Standard dungeon rations. High nutrition value.', effectSummary: 'Basic food ration providing 800 nutrition points.' },
    "287": { flavorNote: 'Military grade emergency food ration with high nutrition.', effectSummary: 'Provides 900 nutrition points.' },
    "288": { flavorNote: 'Elven bread ration.', effectSummary: 'Provides 800 nutrition points.' },
    "296": { flavorNote: 'Hard metal tin containing preserved meat.', effectSummary: 'Requires a can opener or axe to open. Tins never rot.' },

    // 🧪 ポーション (POTION: onum 297〜322)
    "322": { flavorNote: 'Clear pure water. Can be converted to Holy Water or Unholy Water on altars.', effectSummary: 'Dip items into Holy Water to bless them, or pray on altars with uncursed water.', defaultVerb: 'quaff', verbKey: 'q', actionLabelJa: '飲む (q)', usageAdvice: ['Drop on coaligned altar to convert to Holy Water (blessed potion of water)'] },
    "315": { flavorNote: 'Restores HP and cures blindness.', effectSummary: 'Restores 10-30 HP. Blessed restores more HP.', defaultVerb: 'quaff', verbKey: 'q', actionLabelJa: '飲む (q)' },
    "298": { flavorNote: 'Potion of paralysis.', effectSummary: 'Paralyzes drinker for 20-40 turns. Dangerous when drunk!', defaultVerb: 'quaff', verbKey: 'q', actionLabelJa: '飲む (q)', usageAdvice: ['Do not drink! Throw at tough monsters to freeze them'] },
    "297": { flavorNote: 'Potion of confusion.', effectSummary: 'Causes confusion.', defaultVerb: 'quaff', verbKey: 'q', actionLabelJa: '飲む (q)' },
    "309": { flavorNote: 'Potion of speed / gain level.', effectSummary: 'Quaffing blessed advances player level by 1.', defaultVerb: 'quaff', verbKey: 'q', actionLabelJa: '飲む (q)' },

    // 📜 巻物 (SCROLL: onum 323〜365)
    "336": { flavorNote: 'Scroll of Identify.', effectSummary: 'Identifies unknown items in inventory. Blessed identifies multiple items.', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)', usageAdvice: ['Bless before reading to identify entire inventory at once'] },
    "327": { flavorNote: 'Scroll of Remove Curse.', effectSummary: 'Uncurses cursed items in inventory or equipped gear.', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)', usageAdvice: ['Blessed uncurses all carried items; uncursed removes curse from equipped items only'] },
    "328": { flavorNote: 'Scroll of Enchant Weapon.', effectSummary: 'Increases weapon attack/damage bonus by +1 (+2 to +3 if blessed).', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)' },
    "323": { flavorNote: 'Scroll of Enchant Armor.', effectSummary: 'Increases armor defense AC by +1 (+2 to +3 if blessed).', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)' },
    "342": { flavorNote: 'Scroll of Charging.', effectSummary: 'Recharges magic wands or magic markers.', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)', usageAdvice: ['Bless before reading to recharge wands to maximum charges'] },
    "331": { flavorNote: 'Scroll of Genocide.', effectSummary: 'Wipes out an entire species of monsters from the dungeon!', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)', usageAdvice: ['Genocide lethal species like cockatrices, mind flayers, or liches'] },
    "337": { flavorNote: 'Scroll of Magic Mapping.', effectSummary: 'Reveals the entire floor layout including secret corridors.', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '読む (r)' },

    // 📖 魔導書 (SPELLBOOK: onum 357〜398)
    "357": { flavorNote: 'Blank spellbook with no spell.', effectSummary: 'Can be written on using magic marker.', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)' },
    "358": { flavorNote: 'Spellbook of Force Bolt.', effectSummary: 'Teaches Force Bolt spell (Level 1 Attack).', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)' },
    "359": { flavorNote: 'Spellbook of Healing.', effectSummary: 'Teaches Healing spell (Level 1 Healing).', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)' },
    "360": { flavorNote: 'Spellbook of Magic Missile.', effectSummary: 'Teaches Magic Missile spell (Level 2 Attack).', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)' },
    "361": { flavorNote: 'Spellbook of Cure Sickness.', effectSummary: 'Teaches Cure Sickness spell (Level 3 Healing).', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)' },
    "362": { flavorNote: 'Spellbook of Identify.', effectSummary: 'Teaches Identify spell (Level 3 Divination).', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)' },
    "363": { flavorNote: 'Spellbook of Finger of Death.', effectSummary: 'Teaches Finger of Death spell (Level 7 Attack). Lethal instantaneous ray!', defaultVerb: 'read', verbKey: 'r', actionLabelJa: '勉強する (r)' },

    // 💎 宝石・ガラス (GEM: onum 439〜469)
    "439": { flavorNote: 'Valuable red ruby gem.', effectSummary: 'Hardness 9. High trade value in shops.', defaultVerb: 'throw', verbKey: 't', actionLabelJa: '投げる (t)' },
    "440": { flavorNote: 'Precious diamond gem.', effectSummary: 'Hardness 10. Highest value gem in dungeon. Can engrave glass/mirrors.', defaultVerb: 'throw', verbKey: 't', actionLabelJa: '投げる (t)' },
    "441": { flavorNote: 'Precious green emerald gem.', effectSummary: 'Hardness 9. High trade value.', defaultVerb: 'throw', verbKey: 't', actionLabelJa: '投げる (t)' },
    "442": { flavorNote: 'Precious blue sapphire gem.', effectSummary: 'Hardness 9. High trade value.', defaultVerb: 'throw', verbKey: 't', actionLabelJa: '投げる (t)' },
    "443": { flavorNote: 'Cheap worthless piece of colored glass.', effectSummary: 'Hardness 6. Low value. Can be identified using a touchstone.', defaultVerb: 'throw', verbKey: 't', actionLabelJa: '投げる (t)' },
    "250": { flavorNote: 'Horn emitting freezing ice breath.' },
    "251": { flavorNote: 'Horn emitting fierce fire breath.' },
    "252": { flavorNote: 'Magic horn producing food or potions.' },
    "259": { flavorNote: 'Mining pick-axe for digging wall tunnels.' },
    "261": { flavorNote: 'The Swiss Army knife of survival (`#apply`). Instantly cures poison, illness, blindness, and stat drain.' },

    // 🧪 薬 & 📜 巻物 & 🪄 杖 (POTION / SCROLL / WAND)
    "297": { flavorNote: 'Permanently increases all ability scores by 1.' },
    "298": { flavorNote: 'Fully restores drained ability scores.' },
    "309": { flavorNote: 'Instantly advances experience level by 1.' },
    "315": { flavorNote: 'Fully restores HP to maximum and increases max HP.' },
    "322": { flavorNote: 'Dip in altar to create Holy Water, essential for blessing gear.' },
    "323": { flavorNote: 'Enchants armor AC rating.' },
    "327": { flavorNote: 'Removes curse from inventory items.' },
    "328": { flavorNote: 'Enchants weapon hit and damage bonus.' },
    "331": { flavorNote: 'Permanently wipes out entire monster species from dungeon.' },
    "336": { flavorNote: 'Unveils names, properties, and enchantment of inventory items.' },
    "337": { flavorNote: 'Reveals entire layout, secret doors, and corridors of current level.' },
    "342": { flavorNote: 'Recharges magic wands or magical markers.' },
    "414": { flavorNote: 'NetHack\'s ultimate wand. Grants wishes for any item.' },
    "428": { flavorNote: 'Carves tunnels through walls or digs holes in floor for quick escapes.' },
    "433": { flavorNote: 'Fires a ray of death that instantly kills non-resistant targets.' }
};

// 全 481 アイテムのデータ初期構築
export function initFullObjectKnowledge() {
    OBJECT_KNOWLEDGE_MAP.clear();

    for (let i = 0; i <= 480; i++) {
        const onumStr = String(i);
        const name = OBJECT_TILEMAP_NAMES[onumStr] || `object #${i}`;
        const category = getCategoryFromOnum(i);
        
        const detail = SPECIFIC_ITEM_DETAILS[onumStr] || {};
        
        let stats = detail.stats || null;
        if (!stats) {
            if (category === 'WEAPON') {
                stats = { sdam: '1d6', ldam: '1d6', hands: 1, material: 'iron', weight: 30 };
            } else if (category === 'ARMOR') {
                stats = { ac: 1, material: 'leather', weight: 20 };
            }
        }

        let flavorNote = detail.flavorNote || null;
        if (!flavorNote) {
            switch (category) {
                case 'POTION': flavorNote = 'Alchemical liquid contained in a glass bottle. Drink or dip items.'; break;
                case 'SCROLL': flavorNote = 'Parchment inscribed with magical runes. Read to cast one-time magic.'; break;
                case 'SPELLBOOK': flavorNote = 'Tome containing arcane knowledge. Read to memorize spells.'; break;
                case 'FOOD': flavorNote = 'Edible item providing nutrition to stave off starvation.'; break;
                case 'GEM': flavorNote = 'Precious gemstone or colored glass. Can be traded or thrown.'; break;
                case 'RING': flavorNote = 'Magical ring granting passive intrinsic powers when worn.'; break;
                case 'AMULET': flavorNote = 'Sacred amulet worn around the neck granting divine protections.'; break;
                case 'WAND': flavorNote = 'Magical rod emitting magical rays when zapped.'; break;
                case 'TOOL': flavorNote = 'Dungeon utility tool essential for survival.'; break;
                default: flavorNote = `${category} item useful for dungeon exploration.`; break;
            }
        }

        const effectSummary = detail.effectSummary || detail.flavorNote || flavorNote;

        const itemInfo = getItemInfoFromOnum(i);
        const verbInfo = getDefaultVerbForObject(i, category, itemInfo, detail);

        const entry = {
            id: `item_onum_${i}`,
            onum: i,
            name: name,
            category: category,
            stats: stats,
            // 🎯 機能フラグの完全データ化 (Single Source of Truth)
            isPickAxe: !!itemInfo.isPickAxe,
            isKey: !!itemInfo.isKey,
            isAxe: !!itemInfo.isAxe,
            isDigWand: !!itemInfo.isDigWand,
            isFrostWand: !!itemInfo.isFrostWand,
            isContainer: !!itemInfo.isContainer,
            isBox: !!itemInfo.isBox,
            isBag: !!itemInfo.isBag,
            isTouchstone: !!itemInfo.isTouchstone,
            isCanOpener: !!itemInfo.isCanOpener,
            isTin: !!itemInfo.isTin,
            isGem: !!itemInfo.isGem,
            isRock: !!itemInfo.isRock,
            isAmmo: !!itemInfo.isAmmo,
            isLauncher: !!itemInfo.isLauncher,
            effectSummary: effectSummary,
            flavorNote: flavorNote,
            defaultVerb: verbInfo.defaultVerb,
            verbKey: verbInfo.verbKey,
            actionLabelJa: verbInfo.actionLabelJa,
            defaultActionLabel: verbInfo.defaultActionLabel,
            unidentifiedTips: detail.unidentifiedTips || [],
            usageAdvice: detail.usageAdvice || []
        };

        OBJECT_KNOWLEDGE_MAP.set(i, entry);
    }
}

initFullObjectKnowledge();
