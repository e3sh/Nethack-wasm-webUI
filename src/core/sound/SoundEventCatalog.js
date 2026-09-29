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
    'monmove.c:L1572:You_hear:30': { seId: 'se_door', sound: 'door_lock.mp3', priority: 60 },

    // 動的音程シンセシス (ROADMAP 2.3)
    'trap.c:squeak_board': { seId: 'synth_trap_squeak', priority: 70 },
    'sounds.c:shriek': { seId: 'synth_shriek', priority: 70 },
    'sounds.c:trumpet': { seId: 'synth_trumpet', priority: 70 },
    'sounds.c:buzz': { seId: 'synth_buzz', priority: 65 },
    'sounds.c:drone': { seId: 'synth_buzz', priority: 65 },
    'sounds.c:rattle': { seId: 'synth_rattle', priority: 70 },
    'sounds.c:gurgle': { seId: 'synth_gurgle', priority: 65 },
    'music.c:flute': { seId: 'synth_flute', priority: 70 },
    'music.c:bugle': { seId: 'synth_bugle', priority: 70 },
    'music.c:drum': { seId: 'synth_drum', priority: 70 },
    'music.c:drawbridge_tune': { seId: 'synth_drawbridge_tune', priority: 75 }
};

/**
 * 🎵 動的音程シンセシスハンドラ (DYNAMIC_SYNTH_HANDLERS)
 * ROADMAP 2.3「動的音程シンセシス構想 (Dynamic Musical Synthesis)」Living Spec 実装
 * 
 * 外部音源ファイルゼロ・Web Audio API の数式オシレーター計算のみで
 * きしむ床・モンスター咆哮・楽器演奏・跳ね橋メロディをリアルタイム合成する。
 */
export const DYNAMIC_SYNTH_HANDLERS = {
    // --- 1. 罠の音: きしむ床 (Squeaky Board) の 12 音階シンセシス (trap.c) ---
    'trap.c:squeak_board': (placeholders, context) => {
        const rawNote = (placeholders[0] || '').trim();
        const distStr = (placeholders[1] || '') + ' ' + (context?.rawText || '');

        // 1. 冠詞 "a " や "an " を除去し、音名 (A-G) と変調 (sharp/flat/#/b) を厳密抽出
        let noteKey = 'C';
        const match = rawNote.match(/(?:an?\s+)?([A-G])(?:\s*(sharp|flat|#|b))?/i);
        if (match) {
            const letter = match[1].toUpperCase();
            const mod = (match[2] || '').toLowerCase();
            if (mod === 'sharp' || mod === '#') {
                noteKey = `${letter}#`;
            } else if (mod === 'flat' || mod === 'b') {
                noteKey = `${letter}B`;
            } else {
                noteKey = letter;
            }
        }

        // 2. 12平均律 周波数テーブル (Hz)
        const PITCH_MAP = {
            'C': 261.63,
            'C#': 277.18, 'DB': 277.18,
            'D': 293.66,
            'D#': 311.13, 'EB': 311.13,
            'E': 329.63,
            'F': 349.23,
            'F#': 369.99, 'GB': 369.99,
            'G': 392.00,
            'G#': 415.30, 'AB': 415.30,
            'A': 440.00,
            'A#': 466.16, 'BB': 466.16,
            'B': 493.88
        };

        const targetFreq = PITCH_MAP[noteKey] || 261.63;
        const isDistance = /distance/i.test(distStr);
        const gain = isDistance ? 0.3 : 1.0;

        // 3. 木材摩擦・きしみ（Squeak）の音響設計:
        // 踏み込んだ瞬間の軋み摩擦（微細なピッチ降下: +35Hz -> targetFreq）を持たせ、
        // 単なる平坦な電子音と明確に差別化された「きしむ床板」の音色を実現
        return {
            type: 'oscillator',
            wave: 'triangle',
            freq: Math.round((targetFreq + 35) * 100) / 100, // 踏み込み瞬間の摩擦立ち上がりピッチ
            freqEnd: targetFreq,                             // 安定音階周波数
            bendCurve: 'exponential',
            gain,
            duration: 140,
            decay: 'exponential',
            noteName: noteKey
        };
    },

    // --- 2. モンスターの声・咆哮 (Monster Vocalizations / sounds.c) ---
    // 金切り声 (シュリーカー/黄色いカビ): 高周波から下降する急激なノコギリ波ピッチベンド
    'sounds.c:shriek': (placeholders, context) => ({
        type: 'oscillator',
        wave: 'sawtooth',
        freq: 2000,
        freqEnd: 800,
        duration: 220,
        gain: 1.0,
        decay: 'exponential'
    }),

    // 突撃ラッパ (象/マンモス): ノコギリ波による倍音豊かな 3音和音 (C4 + G4 + C5)
    'sounds.c:trumpet': (placeholders, context) => ({
        type: 'chord',
        wave: 'sawtooth',
        freqs: [261.63, 392.00, 523.25], // C4, G4, C5
        duration: 320,
        gain: 1.0,
        decay: 'exponential'
    }),

    // 羽音・ブザー (蜂/昆虫): 低周波ノコギリ波 ＋ 12Hz LFO 振幅変調
    'sounds.c:buzz': (placeholders, context) => ({
        type: 'am',
        wave: 'sawtooth',
        freq: 130,
        lfoFreq: 12,
        lfoWave: 'sine',
        lfoDepth: 0.85,
        duration: 250,
        gain: 0.9,
        decay: 'linear'
    }),

    // ドローン音 (蜂/昆虫の羽音): 低周波 ＋ 10Hz LFO
    'sounds.c:drone': (placeholders, context) => ({
        type: 'am',
        wave: 'sawtooth',
        freq: 110,
        lfoFreq: 10,
        lfoWave: 'sine',
        lfoDepth: 0.75,
        duration: 280,
        gain: 0.85,
        decay: 'linear'
    }),

    // 骨のカタカタ音 (スケルトン): 40ms 短パルスの連続トリガー
    'sounds.c:rattle': (placeholders, context) => ({
        type: 'pulses',
        wave: 'square',
        freq: 220,
        count: 4,
        pulseDuration: 35,
        pulseInterval: 45,
        duration: 200,
        gain: 0.95
    }),

    // バブリング音 (水の悪魔/水棲生物): サイン波 ＋ 高速周波数変調 (FM)
    'sounds.c:gurgle': (placeholders, context) => ({
        type: 'fm',
        wave: 'sine',
        freq: 350,
        modFreq: 24,
        modDepth: 160,
        modWave: 'sine',
        duration: 240,
        gain: 0.9,
        decay: 'exponential'
    }),

    // --- 3. 楽器の演奏と城の跳ね橋 (Instruments & Castle Drawbridge / music.c) ---
    // 笛 (木の笛/魔法の笛): 柔らかな三角波アルペジオ
    'music.c:flute': (placeholders, context) => ({
        type: 'sequence',
        wave: 'triangle',
        notes: ["C5", "E5", "G5", "C6"],
        noteDuration: 85,
        duration: 340,
        gain: 0.9,
        decay: 'exponential'
    }),

    // 角笛 (bugle): 軍隊突撃ファンファーレ (C4-E4-G4-C5)
    'music.c:bugle': (placeholders, context) => ({
        type: 'sequence',
        wave: 'sawtooth',
        notes: [
            { note: "C4", duration: 75 },
            { note: "E4", duration: 75 },
            { note: "G4", duration: 75 },
            { note: "C5", duration: 180 }
        ],
        duration: 405,
        gain: 1.0,
        decay: 'exponential'
    }),

    // ドラム (革のドラム / 地震のドラム): 低周波サイン波のピッチ降下による打楽器音 (バスドラム)
    'music.c:drum': (placeholders, context) => ({
        type: 'oscillator',
        wave: 'sine',
        freq: 160,
        freqEnd: 45,
        duration: 160,
        gain: 1.0,
        decay: 'exponential'
    }),

    // 城の跳ね橋 (Castle Drawbridge 5音メロディ合成): プレイヤー入力 (A-G) を順次オシレーター演奏
    'music.c:drawbridge_tune': (placeholders, context) => {
        const raw = (placeholders[0] || (context && context.rawText) || '').toUpperCase();
        // A-G のアルファベットのみを抽出 (最大5音)
        const matched = raw.match(/[A-G]/g);
        const noteLetters = (matched && matched.length > 0) ? matched.slice(0, 5) : ['C', 'D', 'E', 'F', 'G'];
        const notes = noteLetters.map(ch => `${ch}4`);
        return {
            type: 'sequence',
            wave: 'triangle',
            notes,
            noteDuration: 90,
            duration: notes.length * 90,
            gain: 0.95,
            decay: 'exponential'
        };
    }
};

