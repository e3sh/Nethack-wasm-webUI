/**
 * SoundEventRouter.js - イベントルーティング＆照合モジュール
 *
 * Wasm メッセージ (MessageContext) の O(1) 照合、Visual FX / Combat FX トリガー照合、
 * 英語生テキスト正規表現フォールバック、動的シンセシス解決を担当する。
 */

import { SOUND_EVENT_MAP, DYNAMIC_SYNTH_HANDLERS } from './SoundEventCatalog.js';

/**
 * sound_mapping.json と完全同調したデフォルトルール集 (英語生メッセージフォールバック)
 */
export const DEFAULT_SOUND_RULES = [
    {
        id: "se_welcome",
        pattern: "Welcome to NetHack",
        sound: "welcome.mp3",
        beep: { notes: ["C4", "E4", "G4", "C5"], wave: "square", duration: 90, lfo: { freq: 6, wave: "sine", depth: 15 } }
    },
    {
        id: "se_die",
        pattern: "^You die\\.\\.\\.",
        sound: "die.mp3",
        beep: { notes: ["C4", "B3", "A3", "G3", "F3", "E3", "D3", "C3"], wave: "sawtooth", duration: 150 }
    },
    {
        id: "se_hunger",
        pattern: "^You feel (hungry|weak)\\.",
        sound: "hungry.mp3",
        beep: { notes: ["E3", "C3"], wave: "sine", duration: 150 }
    },
    {
        id: "se_trap",
        pattern: "shoots out at you|fall into a pit|bear trap",
        sound: "trap.mp3",
        beep: { notes: ["C6", "C3"], wave: "square", duration: 100 }
    },
    {
        id: "se_cast_fail",
        pattern: "^You fail to cast",
        sound: "cast_fail.mp3",
        beep: { notes: ["F4", "C4"], wave: "sawtooth", duration: 100 }
    },
    {
        id: "se_cast_spell",
        pattern: "^You cast",
        sound: "cast.mp3",
        beep: { notes: ["C4", "E4", "G4", "B4", "C5"], wave: "sine", duration: 80 }
    },
    {
        id: "se_wand_zap",
        pattern: "\\bzaps\\b",
        sound: "zap.mp3",
        beep: { notes: ["C6", "G5", "E5", "C5"], wave: "sawtooth", duration: 60 }
    },
    {
        id: "se_shoot_throw",
        pattern: "^You (shoot|throw)",
        sound: "shoot.mp3",
        beep: { notes: ["G4", "D5"], wave: "triangle", duration: 50 }
    },
    {
        id: "se_equip",
        pattern: "^You (are now wearing|put on|wield|take off|remove)",
        sound: "equip.mp3",
        beep: { notes: ["D4", "A4"], wave: "square", duration: 60 }
    },
    {
        id: "se_find_secret",
        pattern: "^You find a secret",
        sound: "secret.mp3",
        beep: { notes: ["C5", "E5", "G5", "C6"], wave: "sine", duration: 90 }
    },
    {
        id: "se_player_damaged",
        pattern: "(bites|hits|scratches|kicks) you|^The .* bites!",
        sound: "damaged.mp3",
        beep: { notes: ["F3", "C#3"], wave: "square", duration: 80 },
        cooldownMs: 100
    },
    {
        id: "se_kill_monster",
        pattern: "\\b(kill|kills|killed|dies|defeated|death cry)\\b",
        sound: "kill.mp3",
        beep: { notes: ["G4", "C5", "E5", "G5"], wave: "triangle", duration: 80 },
        priority: 65,
        cooldownMs: 80
    },
    {
        id: "se_destroy_monster",
        pattern: "\\b(destroy|destroys|destroyed|shatters|shattered)\\b",
        sound: "destroy.mp3",
        beep: { notes: ["E4", "B3", "G3", "C3"], wave: "sawtooth", duration: 70 },
        priority: 65,
        cooldownMs: 80
    },
    {
        id: "se_attack_hit",
        pattern: "You hit|\\bhits\\b",
        sound: "hit.mp3",
        beep: { notes: ["E5", "G5"], wave: "square", duration: 50 },
        cooldownMs: 100
    },
    {
        id: "se_attack_miss",
        pattern: "You miss|\\bmisses\\b",
        sound: "swing.mp3",
        beep: { notes: ["B4", "F4"], wave: "triangle", duration: 50 },
        cooldownMs: 100
    },
    {
        id: "se_drink_good",
        pattern: "feel better|feel much better|feel full of energy|see much clearer|feel warm",
        sound: "drink_good.mp3",
        beep: { notes: ["C4", "E4", "G4", "C5"], wave: "sine", duration: 70 }
    },
    {
        id: "se_drink_bad",
        pattern: "feel sick|feel a little dull|feel cold|poisoned|unhealthy|hallucinating|blind|confused|paralyzed",
        sound: "drink_bad.mp3",
        beep: { notes: ["G3", "C#3", "C3"], wave: "sawtooth", duration: 120 }
    },
    {
        id: "se_drink_neutral",
        pattern: "\\bdrink\\b|\\bquaff\\b|\\bchug\\b|potion|tastes",
        sound: "chug.mp3",
        beep: { notes: ["C4", "G4"], wave: "sine", duration: 80 }
    },
    {
        id: "se_eat_food",
        pattern: "\\beat\\b|\\beating\\b|delicious|tasty|blecch",
        sound: "eat.mp3",
        beep: { notes: ["G4", "E4", "C4"], wave: "sine", duration: 70 }
    },
    {
        id: "se_pickup",
        pattern: "pick up",
        sound: "pickup.mp3",
        beep: { notes: ["C5", "E5"], wave: "sine", duration: 60 }
    },
    {
        id: "se_door",
        pattern: "\\bdoor\\b|\\bdoors\\b|\\blocked\\b",
        sound: "door_lock.mp3",
        beep: { notes: ["G3", "C3"], wave: "square", duration: 80 }
    },
    {
        id: "se_read_scroll",
        pattern: "\\bread\\b|\\bscroll\\b|turns to dust|fades",
        sound: "scroll.mp3",
        beep: { notes: ["F4", "A4", "C5"], wave: "triangle", duration: 80 }
    },
    {
        id: "se_stair",
        pattern: "\\bstair\\b|\\bstairs\\b|\\bladder\\b",
        sound: "stair.mp3",
        beep: { notes: ["C4", "E4", "G4"], wave: "triangle", duration: 70 }
    },

    // --- 動的音程シンセシス (Dynamic Musical Synthesis / ROADMAP 2.3) ルール ---
    {
        id: "synth_trap_squeak",
        pattern: "squeaks?\\s+(?:an?\\s+)?(?:[A-G](?:\\s+(?:sharp|flat))?(?:\\s+note)?)|(?:an?\\s+)?(?:[A-G](?:\\s+(?:sharp|flat))?(?:\\s+note)?)\\s+squeaks?|squeak in the distance|squeak nearby",
        dynamicSynth: (match, text) => {
            const noteMatch = text.match(/squeaks?\s+(?:an?\s+)?([A-G](?:\s+(?:sharp|flat))?)|(?:an?\s+)?([A-G](?:\s+(?:sharp|flat))?)\s+(?:note\s+)?squeak/i);
            const note = noteMatch ? (noteMatch[1] || noteMatch[2]) : 'C';
            const isDistance = /distance/i.test(text);
            return DYNAMIC_SYNTH_HANDLERS['trap.c:squeak_board']([note, isDistance ? 'distance' : ''], { rawText: text });
        },
        priority: 70
    },
    {
        id: "synth_shriek",
        pattern: "\\bshrieks?\\b|\\bshrieked\\b|\\bThey shriek\\b",
        dynamicSynth: () => DYNAMIC_SYNTH_HANDLERS['sounds.c:shriek']([], null),
        priority: 70
    },
    {
        id: "synth_trumpet",
        pattern: "\\btrumpets?\\b",
        dynamicSynth: () => DYNAMIC_SYNTH_HANDLERS['sounds.c:trumpet']([], null),
        priority: 70
    },
    {
        id: "synth_buzz",
        pattern: "\\bbuzz(?:es|ing)?\\b|\\bdrones?\\b",
        dynamicSynth: (match, text) => {
            if (/drone/i.test(text)) {
                return DYNAMIC_SYNTH_HANDLERS['sounds.c:drone']([], null);
            }
            return DYNAMIC_SYNTH_HANDLERS['sounds.c:buzz']([], null);
        },
        priority: 65
    },
    {
        id: "synth_rattle",
        pattern: "rattles noisily|bone.*rattle",
        dynamicSynth: () => DYNAMIC_SYNTH_HANDLERS['sounds.c:rattle']([], null),
        priority: 70
    },
    {
        id: "synth_gurgle",
        pattern: "\\bgurgles?\\b",
        dynamicSynth: () => DYNAMIC_SYNTH_HANDLERS['sounds.c:gurgle']([], null),
        priority: 65
    },
    {
        id: "synth_flute",
        pattern: "flute (?:trills|toots)|produce.*(?:soft|piped) music",
        dynamicSynth: () => DYNAMIC_SYNTH_HANDLERS['music.c:flute']([], null),
        priority: 70
    },
    {
        id: "synth_bugle",
        pattern: "loud(?:, familiar)? noise from (?:your )?bugle|blow into the bugle",
        dynamicSynth: () => DYNAMIC_SYNTH_HANDLERS['music.c:bugle']([], null),
        priority: 70
    },
    {
        id: "synth_drum",
        pattern: "heavy, thunderous rolling|beat a (?:familiar )?deafening row|drum of earthquake|leather drum",
        dynamicSynth: () => DYNAMIC_SYNTH_HANDLERS['music.c:drum']([], null),
        priority: 70
    },
    {
        id: "synth_drawbridge_tune",
        pattern: "What tune are you playing|playing tune (?:[A-Ga-g ]+)|tumbler.*click.*gear.*turn",
        dynamicSynth: (match, text) => DYNAMIC_SYNTH_HANDLERS['music.c:drawbridge_tune']([], { rawText: text }),
        priority: 75
    }
];

export class SoundEventRouter {
    /**
     * @param {Object} [options]
     * @param {Array} [options.rules] - ルール定義配列
     * @param {Function} [options.onLogCallback] - ログコールバック
     */
    constructor(options = {}) {
        this.rules = options.rules || DEFAULT_SOUND_RULES;
        this.onLogCallback = options.onLogCallback || null;
    }

    _log(type, msg, meta = {}) {
        if (typeof this.onLogCallback === 'function') {
            this.onLogCallback(type, msg, meta);
        }
    }

    /**
     * Wasm メッセージコンテキストから効果音ルールを照合・解決する
     *
     * @param {Object|null} context - MessageContext
     * @param {string} [fallbackText=''] - フォールバック照合用テキスト
     * @returns {Object|null} マッチしたルール
     */
    resolveMessageContext(context, fallbackText = '') {
        if (context) {
            // 1. 動的音程シンセシス (Stage 5.6) ハンドラ照合
            let synthHandler = DYNAMIC_SYNTH_HANDLERS[context.messageId];
            if (!synthHandler && context.metadata?.synthId) {
                synthHandler = DYNAMIC_SYNTH_HANDLERS[context.metadata.synthId];
            }

            if (typeof synthHandler === 'function') {
                const synthDef = synthHandler(context.placeholders || [], context);
                if (synthDef) {
                    const rule = {
                        id: `synth_${context.messageId || 'dynamic'}`,
                        synth: synthDef,
                        priority: synthDef.priority !== undefined ? synthDef.priority : 70
                    };
                    this._log('CONTEXT_MATCH_SYNTH', `MessageContext dynamic synth matched: ${context.messageId}`, { context, rule });
                    return rule;
                }
            }

            // 2. 静的カタログ照合 (O(1))
            let eventDef = SOUND_EVENT_MAP[context.messageId];
            if (!eventDef && context.metadata?.soundId) {
                eventDef = SOUND_EVENT_MAP[context.metadata.soundId];
            }

            if (eventDef) {
                const rule = this.resolveRuleFromEventDef(eventDef, context.messageId);
                this._log('CONTEXT_MATCH_SOUND', `MessageContext sound matched: ${context.messageId} -> ${rule.id}`, { context, rule });
                return rule;
            }
        }

        // 3. フォールバック生テキスト正規表現マッチング
        const rawText = fallbackText || (context ? context.rawText : '');
        if (rawText) {
            return this.resolveLogMessage(rawText);
        }

        return null;
    }

    /**
     * カタログ定義 (SoundEventCatalog.js) から再生用ルールオブジェクトを構築
     *
     * @param {Object} eventDef - SOUND_EVENT_MAP の定義
     * @param {string|null} [eventKey=null] - カタログキー (例: 'trap.c:squeak_board')
     * @returns {Object}
     */
    resolveRuleFromEventDef(eventDef, eventKey = null) {
        let synthDef = null;

        if (!synthDef) {
            let handler = null;
            if (eventKey && DYNAMIC_SYNTH_HANDLERS[eventKey]) {
                handler = DYNAMIC_SYNTH_HANDLERS[eventKey];
            }

            if (!handler && eventDef.seId) {
                for (const [k, v] of Object.entries(SOUND_EVENT_MAP)) {
                    if (v.seId === eventDef.seId && DYNAMIC_SYNTH_HANDLERS[k]) {
                        handler = DYNAMIC_SYNTH_HANDLERS[k];
                        break;
                    }
                }
            }

            if (typeof handler === 'function') {
                const dummyPlaceholders = ['C', ''];
                synthDef = handler(dummyPlaceholders, { rawText: 'Preview' });
            }
        }

        return {
            id: eventDef.seId || 'preview_sound',
            sound: eventDef.sound || null,
            beep: eventDef.beep || null,
            synth: synthDef,
            priority: eventDef.priority !== undefined ? eventDef.priority : 50,
            cooldownMs: eventDef.cooldownMs || 0
        };
    }

    /**
     * Visual / Combat FX トリガーから効果音ルールを照合・解決する
     *
     * @param {Object} fx
     * @returns {Object|null}
     */
    resolveFxTrigger(fx) {
        if (!fx || !fx.type) return null;

        let soundEvent = null;
        switch (fx.type) {
            case 'KILL_CONFIRMED':
                soundEvent = fx.shattered ? {
                    id: 'se_destroy_monster',
                    sound: 'destroy.mp3',
                    beep: { notes: ["E4", "B3", "G3", "C3"], wave: "sawtooth", duration: 70 },
                    priority: 65,
                    cooldownMs: 80
                } : {
                    id: 'se_kill_monster',
                    sound: 'kill.mp3',
                    beep: { notes: ["G4", "C5", "E5", "G5"], wave: "triangle", duration: 80 },
                    priority: 65,
                    cooldownMs: 80
                };
                break;

            case 'ATTACK_HIT':
                soundEvent = {
                    id: 'se_attack_hit',
                    sound: 'hit.mp3',
                    beep: { notes: ["E5", "G5"], wave: "square", duration: 50 },
                    cooldownMs: 100
                };
                break;

            case 'DAMAGE_TAKEN':
                soundEvent = {
                    id: 'se_player_damaged',
                    sound: 'damaged.mp3',
                    beep: { notes: ["F3", "C#3"], wave: "square", duration: 80 },
                    cooldownMs: 100
                };
                break;

            case 'RULE_MATCH':
                soundEvent = fx.rule;
                break;

            default:
                break;
        }

        return soundEvent;
    }

    /**
     * メッセージログの正規表現マッチングにより効果音ルールを照合・解決する
     *
     * @param {string} text
     * @returns {Object|null}
     */
    resolveLogMessage(text) {
        if (!text) return null;

        for (const rule of this.rules) {
            let matched = false;
            let matchResult = null;

            if (rule.pattern instanceof RegExp) {
                matchResult = text.match(rule.pattern);
                matched = !!matchResult;
            } else if (typeof rule.pattern === 'string') {
                const regex = new RegExp(rule.pattern, 'i');
                if (regex.test(text)) {
                    matched = true;
                    matchResult = text.match(regex);
                }
            }

            if (matched) {
                let ruleToEnqueue = rule;
                if (typeof rule.dynamicSynth === 'function') {
                    const synthDef = rule.dynamicSynth(matchResult, text);
                    if (synthDef) {
                        ruleToEnqueue = {
                            id: rule.id,
                            synth: synthDef,
                            priority: rule.priority !== undefined ? rule.priority : (synthDef.priority !== undefined ? synthDef.priority : 70),
                            cooldownMs: rule.cooldownMs
                        };
                    }
                }
                return ruleToEnqueue;
            }
        }

        return null;
    }
}
