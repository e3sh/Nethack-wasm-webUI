/**
 * INTRINSIC_MESSAGE_MAP.js
 * Phase 5 - Stage 5.4B: 耐性・固有能力メッセージマッピング
 * 
 * NetHack Cソース (eat.c, potion.c, sit.c, zap.c 等) のメッセージ ID と
 * AttributeStateManager で管理される耐性キー (ATTRIBUTE_KEYS) の O(1) 確定対応表。
 */

/**
 * messageId 直接マッピング (O(1))
 * キー: messageId (例: "eat.c:L351:You_feel:0")
 * 値: { key: string, value: boolean }
 */
export const INTRINSIC_MESSAGE_MAP = {
    // 🔥 火炎耐性 (fire)
    'eat.c:L351:You_feel:0': { key: 'fire', value: true },
    'eat.c:L1014:You_feel:29': { key: 'fire', value: true },
    'potion.c:L210:You_feel:1': { key: 'fire', value: true },
    'sit.c:L641:You_feel:83': { key: 'fire', value: true },
    'uhitm.c:L6028:You_feel:260': { key: 'fire', value: true },
    'zap.c:L2727:You_feel:64': { key: 'fire', value: true },

    // ❄️ 冷気耐性 (cold)
    'eat.c:L355:You_feel:0': { key: 'cold', value: true },
    'fountain.c:L492:You_feel:46': { key: 'cold', value: true },
    'uhitm.c:L6001:You_feel:258': { key: 'cold', value: true },
    'zap.c:L2749:You_feel:66': { key: 'cold', value: true },

    // ⚡ 電撃耐性 (shock)
    'eat.c:L359:You_feel:0': { key: 'shock', value: true },

    // 💤 睡眠耐性 (sleep)
    'eat.c:L363:You_feel:0': { key: 'sleep', value: true },
    'eat.c:L2343:You_feel:99': { key: 'sleep', value: true },

    // 🧪 毒耐性 (poison)
    'eat.c:L367:You_feel:0': { key: 'poison', value: true },
    'eat.c:L1039:You_feel:33': { key: 'poison', value: true },
    'potion.c:L315:You_feel:0': { key: 'poison', value: true },
    'uhitm.c:L1496:You_feel:33': { key: 'poison', value: true },

    // 🎯 テレポート制御 (teleportControl)
    'eat.c:L379:You_feel:0': { key: 'teleportControl', value: true },
    'eat.c:L1052:You_feel:35': { key: 'teleportControl', value: true },

    // 🧠 テレパシー (telepat)
    'eat.c:L387:You_feel:0': { key: 'telepat', value: true },
    'eat.c:L1060:You_feel:36': { key: 'telepat', value: true },

    // 👟 隠密 (stealth)
    'eat.c:L1153:You_feel:40': { key: 'stealth', value: true },

    // 🔍 探索 (searching)
    'eat.c:L1098:You_feel:39': { key: 'searching', value: true },

    // ⚡ 倍速・高速行動 (fast)
    'eat.c:L1045:You_feel:34': { key: 'fast', value: true },

    // ⚠️ 警告・危険察知 (warning)
    'eat.c:L1021:You_feel:30': { key: 'warning', value: true }
};

/**
 * MessageContextCatalog の metadata.intrinsic 文字列を ATTRIBUTE_KEYS の識別子へ正規化
 */
export const METADATA_INTRINSIC_NORMALIZE = {
    'fire_resistance': 'fire',
    'cold_resistance': 'cold',
    'shock_resistance': 'shock',
    'poison_resistance': 'poison',
    'sleep_resistance': 'sleep',
    'disintegration_resistance': 'disint',
    'invisibility': 'invis',
    'levitation': 'levitation',
    'teleport_control': 'teleportControl',
    'telepathy': 'telepat',
    'warning': 'warning',
    'stealth': 'stealth',
    'fast': 'fast',
    'searching': 'searching'
};
