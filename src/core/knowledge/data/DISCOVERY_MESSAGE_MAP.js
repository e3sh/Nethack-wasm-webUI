/**
 * DISCOVERY_MESSAGE_MAP.js
 * Phase 5 - Stage 5.4C: 道具識別 (Discovery) 効果メッセージマスタ
 * 
 * 巻物の読解、杖の放射、ポーションの飲用などの効果メッセージ ID (messageId) と、
 * 判明するアイテムの真名 (True Name) の O(1) 確定対応表。
 */

export const DISCOVERY_MESSAGE_MAP = {
    // 📜 巻物 (read.c)
    'read.c:L105:pline:0': { itemType: 'scroll of identify' },
    'read.c:L220:pline:0': { itemType: 'scroll of blank paper' },
    'read.c:L310:pline:0': { itemType: 'scroll of teleportation' },
    'read.c:L415:You_feel:0': { itemType: 'scroll of remove curse' },
    'read.c:L1390:You_feel:50': { itemType: 'scroll of confuse monster' },
    'read.c:L1776:You_feel:71': { itemType: 'scroll of charging' },
    'read.c:L1777:You_feel:72': { itemType: 'scroll of charging' },

    // 🪄 杖 (zap.c)
    'zap.c:L150:pline:0': { itemType: 'wand of fire' },
    'zap.c:L180:pline:0': { itemType: 'wand of digging' },
    'zap.c:L210:pline:0': { itemType: 'wand of lightning' },
    'zap.c:L582:You_feel:16': { itemType: 'wand of striking' },
    'zap.c:L2495:You_feel:51': { itemType: 'wand of enlightenment' },
    'zap.c:L2727:You_feel:64': { itemType: 'wand of fire' },
    'zap.c:L2749:You_feel:66': { itemType: 'wand of cold' },

    // 🧪 薬品 (potion.c)
    'potion.c:L110:pline:0': { itemType: 'potion of water' },
    'potion.c:L150:You_see:0': { itemType: 'potion of see invisible' },
    'potion.c:L166:You_feel:6': { itemType: 'potion of extra healing' },
    'potion.c:L169:You_feel:7': { itemType: 'potion of healing' },
    'potion.c:L210:You_feel:1': { itemType: 'potion of fire resistance' },
    'potion.c:L315:You_feel:0': { itemType: 'potion of poison' },
    'potion.c:L1132:You_feel:71': { itemType: 'potion of full healing' }
};
