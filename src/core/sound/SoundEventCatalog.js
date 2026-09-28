/**
 * SoundEventCatalog.js
 * Phase 5 - Stage 5.4A: 効果音エンジン イベントカタログ
 * 
 * Cソース由来の messageId や metadata.soundId に基づく決定論的 SE マッピング (O(1)) と、
 * 動的音程シンセシス (きしむ床・咆哮・楽器演奏) のハンドラを定義する。
 */

/**
 * 決定論的 SE 発火マッピング (O(1))
 * キー: messageId または metadata.soundId
 * 値: { seId, sound, priority, beep }
 * 
 * 優先度ガイドライン (priority):
 * - 100: 死亡・ゲームオーバー (se_die)
 * - 80: 罠作動・崩落・大音響 (se_trap, se_rumble)
 * - 70: プレイヤー被弾 (se_player_damaged)
 * - 60: 魔法詠唱・杖放射・ポーション効果・ドア開閉 (se_cast_spell, se_wand_zap, se_drink_good, se_door)
 * - 50: 攻撃ヒット・呪文失敗 (se_attack_hit, se_cast_fail, se_hear_monster)
 * - 40: 攻撃ミス・空腹・所持品操作 (se_attack_miss, se_hunger, se_pickup)
 * - 30: 飲食・通常動作 (se_eat_food, se_drink_neutral)
 */
export const SOUND_EVENT_MAP = {
    // --- 1. soundId による直接マッピング (MessageContextCatalog の metadata.soundId) ---
    'se_rumble': {
        seId: 'se_rumble',
        sound: 'trap.mp3',
        priority: 80,
        beep: { notes: ["C3", "G2"], wave: "sawtooth", duration: 120 }
    },
    'se_door': {
        seId: 'se_door',
        sound: 'door_lock.mp3',
        priority: 60,
        beep: { notes: ["G3", "C3"], wave: "square", duration: 80 }
    },
    'se_coins': {
        seId: 'se_pickup',
        sound: 'pickup.mp3',
        priority: 45,
        beep: { notes: ["B5", "E6"], wave: "sine", duration: 50 }
    },
    'se_kill_monster': {
        seId: 'se_kill_monster',
        sound: 'kill.mp3',
        priority: 65,
        cooldownMs: 80,
        beep: { notes: ["G4", "C5", "E5", "G5"], wave: "triangle", duration: 80 }
    },
    'se_destroy_monster': {
        seId: 'se_destroy_monster',
        sound: 'destroy.mp3',
        priority: 65,
        cooldownMs: 80,
        beep: { notes: ["E4", "B3", "G3", "C3"], wave: "sawtooth", duration: 70 }
    },

    // --- 2. 代表的 messageId マッピング ---
    // 死亡・ゲームオーバー
    'end.c:L120:killer': { seId: 'se_die', sound: 'die.mp3', priority: 100 },
    'end.c:L195:You:0': { seId: 'se_die', sound: 'die.mp3', priority: 100 },
    
    // 空腹・衰弱
    'eat.c:L210:You_feel': { seId: 'se_hunger', sound: 'hungry.mp3', priority: 40 },
    'eat.c:L249:You_feel:0': { seId: 'se_eat_food', sound: 'eat.mp3', priority: 30 },
    'eat.c:L450:You': { seId: 'se_eat_food', sound: 'eat.mp3', priority: 30 },

    // 罠・崩落
    'trap.c:L1184:You_hear:31': { seId: 'se_trap', sound: 'trap.mp3', priority: 80 },
    'trap.c:L1248:You_hear:34': { seId: 'se_trap', sound: 'trap.mp3', priority: 70 },
    'explode.c:L440:You_hear:6': { seId: 'se_rumble', sound: 'trap.mp3', priority: 85 },
    'explode.c:L773:You_hear:18': { seId: 'se_rumble', sound: 'trap.mp3', priority: 80 },
    'explode.c:L789:You_hear:20': { seId: 'se_rumble', sound: 'trap.mp3', priority: 80 },

    // ポーション・回復
    'pray.c:L418:You_feel:7': { seId: 'se_drink_good', sound: 'drink_good.mp3', priority: 60 },
    'potion.c:feel_better': { seId: 'se_drink_good', sound: 'drink_good.mp3', priority: 60 },
    'potion.c:feel_sick': { seId: 'se_drink_bad', sound: 'drink_bad.mp3', priority: 60 },
    'potion.c:L152:You_feel:4': { seId: 'se_drink_bad', sound: 'drink_bad.mp3', priority: 60 },
    'potion.c:L166:You_feel:6': { seId: 'se_drink_good', sound: 'drink_good.mp3', priority: 60 },
    'potion.c:L169:You_feel:7': { seId: 'se_drink_good', sound: 'drink_good.mp3', priority: 60 },
    'potion.c:L1132:You_feel:71': { seId: 'se_drink_good', sound: 'drink_good.mp3', priority: 60 },
    'potion.c:quaff': { seId: 'se_drink_neutral', sound: 'chug.mp3', priority: 30 },

    // 戦闘・被弾
    'uhitm.c:hit': { seId: 'se_attack_hit', sound: 'hit.mp3', priority: 50 },
    'uhitm.c:miss': { seId: 'se_attack_miss', sound: 'swing.mp3', priority: 40 },
    'mhitu.c:damaged': { seId: 'se_player_damaged', sound: 'damaged.mp3', priority: 70 },

    // 呪文・杖
    'spell.c:cast_ok': { seId: 'se_cast_spell', sound: 'cast.mp3', priority: 60 },
    'spell.c:cast_fail': { seId: 'se_cast_fail', sound: 'cast_fail.mp3', priority: 50 },
    'zap.c:beam': { seId: 'se_wand_zap', sound: 'zap.mp3', priority: 60 },

    // 扉
    'lock.c:door': { seId: 'se_door', sound: 'door_lock.mp3', priority: 60 },
    'lock.c:L890:pline_The:51': { seId: 'se_door', sound: 'door_lock.mp3', priority: 60 },
    'lock.c:L1035:pline_The:67': { seId: 'se_door', sound: 'door_lock.mp3', priority: 60 },
    'monmove.c:L1556:You_hear:27': { seId: 'se_door', sound: 'door_lock.mp3', priority: 60 },
    'monmove.c:L1572:You_hear:30': { seId: 'se_door', sound: 'door_lock.mp3', priority: 60 }
};

/**
 * 🎵 動的音程シンセシスハンドラ (DYNAMIC_SYNTH_HANDLERS)
 * 将来の動的音程シンセシス (docs/4_sound/dynamic_musical_synthesis_concept.ja.md) の拡張スロット
 */
export const DYNAMIC_SYNTH_HANDLERS = {
    // きしむ床 (Squeaky Board) の 12 音階シンセシス
    'trap.c:squeak_board': (placeholders, context) => {
        const noteStr = placeholders[0] || 'C';
        const distStr = placeholders[1] || '';
        const freqMap = {
            'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23,
            'G': 392.00, 'A': 440.00, 'B': 493.88
        };
        const baseKey = noteStr.charAt(0).toUpperCase();
        let freq = freqMap[baseKey] || 440.0;
        if (noteStr.includes('sharp') || noteStr.includes('#')) freq *= 1.059463;
        else if (noteStr.includes('flat') || noteStr.includes('b')) freq /= 1.059463;

        const gain = distStr.includes('distance') ? 0.3 : 1.0;
        return {
            type: 'oscillator',
            wave: 'triangle',
            freq,
            gain,
            duration: 120,
            decay: 'exponential'
        };
    }
};
