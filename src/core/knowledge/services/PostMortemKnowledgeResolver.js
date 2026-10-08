/**
 * PostMortemKnowledgeResolver.js
 * 
 * 【事後ナレッジ連携＆死因解析エンジン (Core層)】
 *
 * 役割 (SSOT: Single Source of Truth):
 * NetHackコアが出力する死因テキスト（英文）を解析し、
 * 1. 自然で読みやすい日本語死因への翻訳
 * 2. 既存の戦術アドバイスマスター（ADVICE_DEFINITIONS.js）との自動バインディング
 * 3. モンスター図鑑・アイテム図鑑（MONSTER_JP_MAP, MONSTER_KNOWLEDGE_MAP 等）との相互参照
 * 4. 冒険手帳（adventure_log.html）へのリンクおよびサバイバル対策ヒントの抽出
 * を一元的に行い、Nehwwクライアント（GameOver画面）およびスコアボード（scoreboard.html）双方に提供する。
 */

import { ADVICE_DEFINITIONS } from '../data/ADVICE_DEFINITIONS.js';
import { MONSTER_JP_MAP } from '../data/MONSTER_JP_MAP.js';
import { OBJECT_JP_MAP } from '../data/OBJECT_JP_MAP.js';
import { MONSTER_KNOWLEDGE_MAP } from '../data/MONSTER_KNOWLEDGE_FULL.js';

export class PostMortemKnowledgeResolver {
    /**
     * 死因文字列（英文）を解析し、構造化された事後ナレッジレポートを生成する
     *
     * @param {string} deathStr - 死因英文 (例: "killed by a cockatrice", "died of starvation")
     * @param {Object} [options] - オプション { lang: 'ja' | 'en' }
     * @returns {Object} PostMortemReport
     */
    static resolve(deathStr, options = {}) {
        const rawDeath = (deathStr || '').trim();
        const lower = rawDeath.toLowerCase();

        // 1. 昇天 (Ascension)
        if (lower.includes('ascended')) {
            return {
                death: rawDeath,
                translatedDeath: '世界の主として昇天した！',
                category: 'ASCENDED',
                isVictory: true,
                entity: null,
                advice: null,
                countermeasureJa: 'おめでとうございます！神々の試練を乗り越え、不死の神格を獲得しました。',
                countermeasureEn: 'Congratulations! You have ascended to immortal demigodhood in glory.',
                loreLink: null
            };
        }

        // 2. 冒険の断念・生還 (Quit / Escaped)
        if (lower.startsWith('quit')) {
            return {
                death: rawDeath,
                translatedDeath: '冒険を途中で断念した',
                category: 'QUIT',
                isVictory: false,
                entity: null,
                advice: null,
                countermeasureJa: 'ダンジョンを安全に脱出するか、準備を整えて次の階層に挑みましょう。',
                countermeasureEn: 'Prepare your equipment carefully before delving deeper into the dungeon.',
                loreLink: null
            };
        }

        if (lower.includes('escaped the dungeon')) {
            const hasAmulet = lower.includes('with the amulet');
            return {
                death: rawDeath,
                translatedDeath: hasAmulet ? '魔除けを手にダンジョンから生還した' : 'ダンジョンから脱出・生還した',
                category: 'ESCAPED',
                isVictory: hasAmulet,
                entity: null,
                advice: null,
                countermeasureJa: hasAmulet ? '魔除けを持って地上へ脱出しました！' : '魔除けを手に入れる前に脱出しました。',
                countermeasureEn: hasAmulet ? 'Escaped with the Amulet of Yendor!' : 'Escaped the dungeon without the Amulet.',
                loreLink: null
            };
        }

        // 3. 飢餓死 (Starvation)
        if (lower.includes('starv') || lower.includes('died of starvation')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_STARVATION'];
            return {
                death: rawDeath,
                translatedDeath: '飢えにより力尽きた',
                category: 'STARVATION',
                isVictory: false,
                entity: { type: 'condition', id: 'starvation', nameJa: '飢餓', nameEn: 'Starvation' },
                advice: adviceDef || null,
                countermeasureJa: '食料（保存食・レーション）を常に携帯し、飢餓で倒れる前に神に祈る(#pray)ことで満腹度を全回復できます。',
                countermeasureEn: 'Always carry rations and pray (#pray) when fainting from hunger to restore nutrition.',
                loreLink: { target: 'adventure_log.html', query: 'food' }
            };
        }

        // 4. 石化死 (Petrification)
        if (lower.includes('petrif') || lower.includes('turning to stone')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_PETRIFICATION'];
            let causeNameJa = '石化';
            if (lower.includes('chickatrice')) causeNameJa = 'ヒナコカトリス';
            else if (lower.includes('cockatrice')) causeNameJa = 'コカトリス';
            else if (lower.includes('medusa')) causeNameJa = 'メデューサ';

            return {
                death: rawDeath,
                translatedDeath: `${causeNameJa}により石化した`,
                category: 'PETRIFICATION',
                isVictory: false,
                entity: { type: 'hazard', id: 'petrification', nameJa: causeNameJa, nameEn: 'Petrification' },
                advice: adviceDef || null,
                countermeasureJa: '手袋を着用して死骸への接触を防ぐか、トカゲの死骸(lizard corpse)を食べて石化の進行を即座に治療してください。',
                countermeasureEn: 'Wear gloves to safely handle corpses, or eat a lizard corpse to instantly cure petrification.',
                loreLink: { target: 'adventure_log.html', type: 'monster', query: 'cockatrice' }
            };
        }

        // 5. 窒息死 (Choking)
        if (lower.includes('choked on')) {
            const itemMatch = rawDeath.match(/choked on\s+(?:an?\s+|the\s+)?(.+)/i);
            const itemRaw = itemMatch ? itemMatch[1].trim() : 'food';
            const itemJa = this._resolveObjectNameJp(itemRaw);
            return {
                death: rawDeath,
                translatedDeath: `${itemJa}を喉に詰まらせて窒息死した`,
                category: 'CHOKING',
                isVictory: false,
                entity: { type: 'item', nameJa: itemJa, nameEn: itemRaw },
                advice: null,
                countermeasureJa: '満腹状態(Satiated)でさらに食料を食べると窒息死します。満腹度が下がるまで食事を控えましょう。',
                countermeasureEn: 'Eating while Satiated can cause fatal choking. Wait until digestion completes before eating more.',
                loreLink: { target: 'adventure_log.html', query: 'food' }
            };
        }

        // 6. 溺死 (Drowning)
        if (lower.includes('drown')) {
            return {
                death: rawDeath,
                translatedDeath: '水底に沈んで溺死した',
                category: 'DROWNING',
                isVictory: false,
                entity: { type: 'hazard', id: 'water', nameJa: '水流・堀', nameEn: 'Water' },
                advice: null,
                countermeasureJa: '重い荷物を背負った状態で水に入らないでください。浮遊の指輪(Ring of Levitation)や水上歩行の靴で水面を安全に渡れます。',
                countermeasureEn: 'Avoid deep water while burdened. Use a Ring of Levitation or Water Walking Boots to cross safely.',
                loreLink: null
            };
        }

        // 7. モンスターによる殺害 (Killed by / Slain by)
        const killMatch = rawDeath.match(/(?:killed|slain|crushed|blasted|poisoned)\s+by\s+(?:an?\s+|the\s+)?(.+)/i);
        if (killMatch) {
            let killerRaw = killMatch[1].trim();
            // 付帯情報のクレンジング (例: "an orc called Bob", "a floating eye while frozen")
            let subCondition = "";
            if (killerRaw.includes(' while ')) {
                const parts = killerRaw.split(' while ');
                killerRaw = parts[0].trim();
                subCondition = parts[1].trim();
            }
            if (killerRaw.includes(' called ')) {
                killerRaw = killerRaw.split(' called ')[0].trim();
            }

            const monsterResolve = this._resolveMonsterInfo(killerRaw);
            const monsterNameJa = monsterResolve.nameJa || killerRaw;

            // 特殊アドバイスバインディング
            let adviceDef = null;
            let countermeasureJa = `強力なモンスターとの近接戦闘を避け、エルベレスの刻印(Elbereth)や遠隔攻撃、状態異常魔法・杖を活用しましょう。`;
            let countermeasureEn = `Avoid melee with deadly foes. Utilize Elbereth, ranged attacks, or escape wands.`;

            if (killerRaw.toLowerCase().includes('floating eye') || subCondition.includes('frozen') || subCondition.includes('paralyz')) {
                adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_FLOATING_EYE'];
                countermeasureJa = '浮遊する目玉を直接攻撃すると麻痺します。目隠し(Blindfold)を着用して戦うか、飛び道具で離れて倒しましょう。';
                countermeasureEn = 'Melee attacking a Floating Eye paralyzes you. Use a blindfold or attack with ranged weapons.';
            } else if (killerRaw.toLowerCase().includes('cockatrice') || killerRaw.toLowerCase().includes('chickatrice')) {
                adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_PETRIFICATION'];
                countermeasureJa = '直接接触や死骸への素手接触で即座に石化します。手袋を常時着用し、トカゲの死骸を携帯してください。';
                countermeasureEn = 'Instant petrification on contact. Always wear gloves and carry a lizard corpse.';
            } else if (killerRaw.toLowerCase().includes('dragon')) {
                countermeasureJa = 'ドラゴンの強力なブレス攻撃には反射の盾(Shield of Reflection)や対応する属性耐性（火炎・冷気等）が不可欠です。';
                countermeasureEn = 'Dragon breaths are lethal without Reflection or matching elemental resistances.';
            }

            return {
                death: rawDeath,
                translatedDeath: `${monsterNameJa}に倒された`,
                category: 'THREAT_MONSTER',
                isVictory: false,
                entity: {
                    type: 'monster',
                    nameEn: killerRaw,
                    nameJa: monsterNameJa,
                    monsterId: monsterResolve.id,
                    dangerLevel: monsterResolve.dangerLevel
                },
                advice: adviceDef || null,
                countermeasureJa: countermeasureJa,
                countermeasureEn: countermeasureEn,
                loreLink: {
                    target: 'adventure_log.html',
                    type: 'monster',
                    query: killerRaw
                }
            };
        }

        // 8. フォールバック (一般の死因)
        return {
            death: rawDeath,
            translatedDeath: rawDeath,
            category: 'UNKNOWN',
            isVictory: false,
            entity: null,
            advice: null,
            countermeasureJa: '探索時はHPの残量に常に注意を払い、回復の薬や脱出アイテムを準備しておきましょう。',
            countermeasureEn: 'Keep a close eye on your HP and always carry healing potions and teleportation items.',
            loreLink: null
        };
    }

    /**
     * モンスター英文名から日本語名・ID・危険度を逆引き解決する
     */
    static _resolveMonsterInfo(nameEn) {
        if (!nameEn) return { id: null, nameJa: null, dangerLevel: 'UNKNOWN' };
        const clean = nameEn.toLowerCase().replace(/^(an?|the)\s+/, '').trim();

        // 1. MONSTER_JP_MAP から日本語名を検索
        let nameJa = MONSTER_JP_MAP.monsters ? MONSTER_JP_MAP.monsters[clean] : null;
        if (!nameJa && MONSTER_JP_MAP.monsters) {
            // 前方一致・部分一致フォールバック
            for (const [enKey, jpVal] of Object.entries(MONSTER_JP_MAP.monsters)) {
                if (clean.includes(enKey) || enKey.includes(clean)) {
                    nameJa = jpVal;
                    break;
                }
            }
        }

        // 2. MONSTER_KNOWLEDGE_MAP から危険度・スペックを逆引き
        let monsterId = null;
        let dangerLevel = 'MEDIUM';

        if (MONSTER_KNOWLEDGE_MAP && MONSTER_KNOWLEDGE_MAP.size > 0) {
            for (const [id, spec] of MONSTER_KNOWLEDGE_MAP.entries()) {
                if (spec && spec.name && spec.name.toLowerCase() === clean) {
                    monsterId = id;
                    dangerLevel = spec.dangerLevel || 'MEDIUM';
                    if (!nameJa && spec.nameJa) nameJa = spec.nameJa;
                    break;
                }
            }
        }

        return {
            id: monsterId,
            nameJa: nameJa || clean,
            dangerLevel: dangerLevel
        };
    }

    /**
     * アイテム英文名から日本語名を逆引き解決する
     */
    static _resolveObjectNameJp(nameEn) {
        if (!nameEn) return 'アイテム';
        const clean = nameEn.toLowerCase().replace(/^(an?|the)\s+/, '').trim();

        if (OBJECT_JP_MAP && OBJECT_JP_MAP.objects) {
            if (OBJECT_JP_MAP.objects[clean]) return OBJECT_JP_MAP.objects[clean];
            for (const [enKey, jpVal] of Object.entries(OBJECT_JP_MAP.objects)) {
                if (clean.includes(enKey)) return jpVal;
            }
        }
        return nameEn;
    }
}
