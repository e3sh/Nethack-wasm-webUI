/**
 * PostMortemKnowledgeResolver.js
 * 
 * 【事後ナレッジ連携＆死因解析エンジン (Core層)】
 *
 * 役割 (SSOT: Single Source of Truth):
 * NetHackコアが出力する死因テキスト（英文）を多段パイプライン方式で解析し、
 * 1. 自然で読みやすい日本語死因への翻訳 (Syntax Decomposition & Factor Extraction)
 * 2. 根本原因調停 (Root Cause Arbitration: RCA) による真の敗因・教訓選出
 * 3. 既存の戦術アドバイスマスター（ADVICE_DEFINITIONS.js）との自動バインディング
 * 4. モンスター図鑑・アイテム図鑑（MONSTER_JP_MAP, OBJECT_JP_MAP, MONSTER_KNOWLEDGE_MAP 等）との相互参照
 * 5. 冒険手帳（adventure_log.html）へのリンクおよびサバイバル対策ヒントの抽出
 * を一元的に行い、Nehwwクライアント（GameOver画面）およびスコアボード（scoreboard.html）双方に提供する。
 */

import { ADVICE_DEFINITIONS } from '../data/ADVICE_DEFINITIONS.js';
import { MONSTER_JP_MAP } from '../data/MONSTER_JP_MAP.js';
import { OBJECT_JP_MAP } from '../data/OBJECT_JP_MAP.js';
import { MONSTER_KNOWLEDGE_MAP } from '../data/MONSTER_KNOWLEDGE_FULL.js';

// 主要な神の日本語名マップ
const GODS_JP = {
    'anhur': 'アンフール',
    'tyr': 'ティール',
    'moloch': 'モロク',
    'athena': 'アテナ',
    'thor': 'トール',
    'odin': 'オーディン',
    'ares': 'アレス',
    'hermes': 'ヘルメス',
    'poseidon': 'ポセイドン',
    'zeus': 'ゼウス',
    'shiva': 'シヴァ',
    'vishnu': 'ヴィシュヌ',
    'ganesha': 'ガネーシャ',
    'chih sung-tzu': '赤松子',
    'huan ti': '黄帝',
    'kuan ti': '関帝',
    'ishtar': 'イシュタル',
    'marduk': 'マルドゥク',
    'nergal': 'ネルガル',
    'thoth': 'トート',
    'ptah': 'プタハ',
    'ra': 'ラー',
    'quetzalcoatl': 'ケツァルコアトル',
    'camaxtli': 'カマシュトリ',
    'huhetotl': 'ウエウエテオトル',
    'loki': 'ロキ',
    'seth': 'セト',
    'the lady': 'レディ',
    'blind io': 'ブラインド・アイオ',
    'offler': 'オフラー'
};

// 代表的な店主名の日本語マップ
const SHOPKEEPER_NAMES_JP = {
    'morgan': 'モーガン',
    'smith': 'スミス',
    'jones': 'ジョーンズ',
    'murray': 'マレー',
    'asgard': 'アスガルド'
};

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class PostMortemKnowledgeResolver {
    /**
     * 死因文字列（英文）を日本語に翻訳した文字列を返却する
     *
     * @param {string} deathStr - 死因英文
     * @returns {string} 日本語翻訳された死因文字列
     */
    static translateDeathReason(deathStr) {
        if (!deathStr || typeof deathStr !== 'string' || deathStr.trim() === '') {
            return '';
        }
        const report = this.resolve(deathStr);
        return (report && (report.translatedDeathJa || report.translatedDeath)) || deathStr || '';
    }

    /**
     * 死因文字列（英文）を多段パイプラインで解析し、構造化された事後ナレッジレポートを生成する
     *
     * @param {string} deathStr - 死因英文 (例: "killed by a newt, while fainted from lack of food")
     * @param {Object} [options] - オプション { lang: 'ja' | 'en' }
     * @returns {Object} PostMortemReport
     */
    static resolve(deathStr, options = {}) {
        if (!deathStr || typeof deathStr !== 'string' || deathStr.trim() === '') {
            return {
                death: '',
                translatedDeath: '',
                translatedDeathJa: '',
                category: 'UNKNOWN',
                isVictory: false,
                entity: null,
                advice: null,
                countermeasureJa: '',
                countermeasureEn: '',
                loreLink: null
            };
        }

        const rawDeath = deathStr.trim();

        // =========================================================================
        // 【Stage 1: 構文分解 (Syntax Decomposition)】
        // =========================================================================
        let baseDeath = rawDeath;
        let whileConditionRaw = null;

        // 1. 末尾の while (付帯状況・無力化理由) を先行分離
        const whileMatch = baseDeath.match(/(?:,\s*)?\bwhile\s+(.+)$/i);
        if (whileMatch) {
            whileConditionRaw = whileMatch[1].trim();
            baseDeath = baseDeath.substring(0, whileMatch.index).trim();
        }

        const lowerBase = baseDeath.toLowerCase();

        // =========================================================================
        // 【Stage 2: 要因抽出 (Factor Extraction)】
        // =========================================================================

        let report = null;

        // 1. 昇天 (Ascension)
        if (lowerBase.includes('ascended')) {
            report = {
                death: rawDeath,
                translatedDeath: '世界の主として昇天した！',
                translatedDeathJa: '世界の主として昇天した！',
                category: 'ASCENDED',
                isVictory: true,
                entity: null,
                advice: null,
                countermeasureJa: 'おめでとうございます！神々の試練を乗り越え、不死の神格を獲得しました。',
                countermeasureEn: 'Congratulations! You have ascended to immortal demigodhood in glory.',
                loreLink: null
            };
        }

        // 2. 冒険の断念 (Quit)
        else if (lowerBase.startsWith('quit')) {
            report = {
                death: rawDeath,
                translatedDeath: '冒険を途中で断念した',
                translatedDeathJa: '冒険を途中で断念した',
                category: 'QUIT',
                isVictory: false,
                entity: null,
                advice: null,
                countermeasureJa: 'ダンジョンを安全に脱出するか、準備を整えて次の階層に挑みましょう。',
                countermeasureEn: 'Prepare your equipment carefully before delving deeper into the dungeon.',
                loreLink: null
            };
        }

        // 3. ダンジョンからの生還・脱出 (Escaped)
        else if (lowerBase.includes('escaped the dungeon')) {
            const hasAmulet = lowerBase.includes('with the amulet');
            const escapeJa = hasAmulet ? '魔除けを手にダンジョンから生還した' : 'ダンジョンから脱出・生還した';
            report = {
                death: rawDeath,
                translatedDeath: escapeJa,
                translatedDeathJa: escapeJa,
                category: 'ESCAPED',
                isVictory: hasAmulet,
                entity: null,
                advice: null,
                countermeasureJa: hasAmulet ? '魔除けを持って地上へ脱出しました！' : '魔除けを手に入れる前に脱出しました。',
                countermeasureEn: hasAmulet ? 'Escaped with the Amulet of Yendor!' : 'Escaped the dungeon without the Amulet.',
                loreLink: null
            };
        }

        // 4. 腐敗死体・食中毒 (Food Poisoning / Tainted Corpse) - 先行判定
        else if (
            lowerBase.includes('corpse') && (
                lowerBase.includes('rotted') ||
                lowerBase.includes('tainted') ||
                lowerBase.includes('poisonous corpse') ||
                lowerBase.includes('eating') ||
                lowerBase.startsWith('poisoned by a rotted') ||
                lowerBase.startsWith('poisoned by a tainted')
            )
        ) {
            // 例: "poisoned by a rotted rothe corpse", "poisoned by eating a kobold corpse", "died of eating a rotted corpse"
            let monsterEn = '';
            const corpseMatch = baseDeath.match(/(?:rotted|tainted|eating\s+(?:an?\s+|the\s+)?(?:rotted|tainted)?)\s+([a-zA-Z\s-]+?)\s+corpse/i);
            if (corpseMatch) {
                monsterEn = corpseMatch[1].trim();
            } else {
                const genericMatch = baseDeath.match(/(?:by|eating)\s+(?:an?\s+|the\s+)?([a-zA-Z\s-]+?)\s+corpse/i);
                if (genericMatch) {
                    monsterEn = genericMatch[1].trim();
                }
            }
            monsterEn = monsterEn.replace(/^(?:rotted|tainted)\s+/i, '').trim();
            if (monsterEn.toLowerCase() === 'rotted' || monsterEn.toLowerCase() === 'tainted' || monsterEn.toLowerCase() === 'poisonous') {
                monsterEn = '';
            }

            const monsterResolve = monsterEn ? this._resolveMonsterInfo(monsterEn) : null;
            const monsterNameJa = monsterResolve ? monsterResolve.nameJa : '';

            let deathJa = monsterNameJa 
                ? `腐った${monsterNameJa}の死骸の毒で命を落とした`
                : '腐敗した死体の毒で命を落とした';
            if (lowerBase.includes('eating') && !lowerBase.includes('rotted') && !lowerBase.includes('tainted')) {
                deathJa = monsterNameJa ? `毒のある${monsterNameJa}の死骸を食べて毒死した` : '有毒な死骸を食べて毒死した';
            }

            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_FOOD_POISONING'] || ADVICE_DEFINITIONS['ADVICE_HAZARD_ROTTEN_CORPSE'];
            report = {
                death: rawDeath,
                translatedDeath: deathJa,
                translatedDeathJa: deathJa,
                category: 'FOOD_POISONING',
                isVictory: false,
                entity: {
                    type: 'corpse',
                    nameEn: monsterEn ? `${monsterEn} corpse` : 'corpse',
                    nameJa: monsterNameJa ? `${monsterNameJa}の死体` : '腐敗した死体',
                    monsterId: monsterResolve ? monsterResolve.id : null,
                    dangerLevel: 'CRITICAL'
                },
                advice: adviceDef || null,
                countermeasureJa: '死後ターンが経過した死体は腐敗し、食べると食中毒で即死します。新鮮な死体のみ摂取するか、保存食・缶詰を活用してください。',
                countermeasureEn: 'Corpses rot after several turns. Eating tainted corpses causes fatal food poisoning. Eat fresh corpses or rations.',
                loreLink: { target: 'adventure_log.html', query: 'food' }
            };
        }

        // 5. 爆発・自爆モンスター・環境爆発 (Explosion Hazard)
        else if (
            lowerBase.includes('explosion') ||
            lowerBase.includes('caught in an explosion') ||
            lowerBase.includes('blasted by an explosion')
        ) {
            let deathJa = '爆発に巻き込まれて爆死した';
            let adviceDef = ADVICE_DEFINITIONS['ADVICE_HAZARD_EXPLOSION'];
            let entity = { type: 'hazard', id: 'explosion', nameJa: '爆発', nameEn: 'Explosion' };
            let counterJa = 'ガス胞子等の誘爆や杖・魔法の爆風には火炎耐性や安全距離の確保が不可欠です。';
            let counterEn = 'Ensure fire resistance and keep safe distance against exploding gas spores or wands.';

            if (lowerBase.includes('gas spore')) {
                deathJa = 'ガス胞子の爆発に巻き込まれて爆死した';
                adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_GAS_SPORE'] || adviceDef;
                entity = { type: 'monster', nameJa: 'ガス胞子', nameEn: 'gas spore', dangerLevel: 'HIGH' };
                counterJa = 'ガス胞子は近接攻撃すると自爆します。後退するか飛び道具で安全に遠隔撃破してください。';
                counterEn = 'Melee attacking gas spores triggers fatal explosion. Step back or shoot from range.';
            } else if (lowerBase.includes('flaming sphere')) {
                deathJa = '炎の球体の爆発に巻き込まれて爆死した';
                entity = { type: 'monster', nameJa: '炎の球体', nameEn: 'flaming sphere', dangerLevel: 'HIGH' };
            } else if (lowerBase.includes('freezing sphere')) {
                deathJa = '氷の球体の爆発に巻き込まれて爆死した';
                entity = { type: 'monster', nameJa: '氷の球体', nameEn: 'freezing sphere', dangerLevel: 'HIGH' };
            } else if (lowerBase.includes('shocking sphere')) {
                deathJa = '電撃の球体の爆発に巻き込まれて爆死した';
                entity = { type: 'monster', nameJa: '電撃の球体', nameEn: 'shocking sphere', dangerLevel: 'HIGH' };
            }

            report = {
                death: rawDeath,
                translatedDeath: deathJa,
                translatedDeathJa: deathJa,
                category: 'EXPLOSION',
                isVictory: false,
                entity: entity,
                advice: adviceDef || null,
                countermeasureJa: counterJa,
                countermeasureEn: counterEn,
                loreLink: null
            };
        }

        // 6. コンテナ爆弾・アイテム爆破・暴発 (Container Traps & Item Mishaps)
        else if (lowerBase.includes('exploding')) {
            // (a) コンテナ爆弾: "killed by an exploding large box", "killed by an exploding chest"
            const containerMatch = baseDeath.match(/exploding\s+(?:an?\s+|the\s+)?(large\s+box|chest|box|iron\s+safe)/i);
            if (containerMatch) {
                const itemRaw = containerMatch[1].trim();
                const itemJa = this._resolveObjectNameJp(itemRaw);
                const adviceDef = ADVICE_DEFINITIONS['ADVICE_HAZARD_EXPLODING_CONTAINER'];
                report = {
                    death: rawDeath,
                    translatedDeath: `${itemJa}の爆発（罠）に巻き込まれて死亡した`,
                    translatedDeathJa: `${itemJa}の爆発（罠）に巻き込まれて死亡した`,
                    category: 'TRAP_CONTAINER',
                    isVictory: false,
                    entity: { type: 'trap', id: 'exploding_container', nameJa: `${itemJa}の爆弾罠`, nameEn: `Exploding ${itemRaw}` },
                    advice: adviceDef || null,
                    countermeasureJa: '鍵のかかった箱には爆弾トラップが仕掛けられている場合があります。遠隔飛び道具で破壊するか、鍵や開錠スキル、ノックの呪文で解除してください。',
                    countermeasureEn: 'Locked containers may be booby-trapped. Disarm with keys, unlock skills/spells, or trigger from range.',
                    loreLink: null
                };
            }
            // (b) 杖の過充填暴発: "killed by exploding a wand of striking"
            else if (lowerBase.includes('exploding a wand of')) {
                const wandMatch = baseDeath.match(/exploding\s+(?:an?\s+|the\s+)?(wand\s+of\s+[a-zA-Z\s-]+)/i);
                const wandRaw = wandMatch ? wandMatch[1].trim() : 'wand';
                const wandJa = this._resolveObjectNameJp(wandRaw);
                report = {
                    death: rawDeath,
                    translatedDeath: `${wandJa}の過充填暴発で死亡した`,
                    translatedDeathJa: `${wandJa}の過充填暴発で死亡した`,
                    category: 'ITEM_MISHAP',
                    isVictory: false,
                    entity: { type: 'item', nameJa: wandJa, nameEn: wandRaw },
                    advice: null,
                    countermeasureJa: '杖への過度の充填(Recharging)は暴発を引き起こします。充填回数には細心の注意を払いましょう。',
                    countermeasureEn: 'Overcharging wands causes catastrophic explosion. Mind your recharge counts.',
                    loreLink: null
                };
            }
            // (c) 手品袋爆発: "killed by a wand of striking exploding in a bag of holding"
            else if (lowerBase.includes('exploding in a bag of holding')) {
                const wandMatch = baseDeath.match(/(?:by\s+(?:an?\s+|the\s+)?)(.+?)\s+exploding in a bag of holding/i);
                const wandRaw = wandMatch ? wandMatch[1].trim() : 'wand';
                const wandJa = this._resolveObjectNameJp(wandRaw);
                const adviceDef = ADVICE_DEFINITIONS['ADVICE_HAZARD_BAG_OF_HOLDING_EXPLOSION'];
                report = {
                    death: rawDeath,
                    translatedDeath: `手品袋の中で${wandJa}が爆発して死亡した`,
                    translatedDeathJa: `手品袋の中で${wandJa}が爆発して死亡した`,
                    category: 'ITEM_MISHAP',
                    isVictory: false,
                    entity: { type: 'item', nameJa: wandJa, nameEn: wandRaw },
                    advice: adviceDef || null,
                    countermeasureJa: '手品袋(Bag of Holding)に魔法の鞄や打ち消しの杖を入れると大爆発を引き起こします！絶対に一緒に入れないでください。',
                    countermeasureEn: 'Putting magical bags or wands of cancellation into a Bag of Holding causes catastrophic explosion!',
                    loreLink: null
                };
            }
            // (d) その他アイテム爆発: "killed by an exploding wand"
            else {
                const itemMatch = baseDeath.match(/exploding\s+(?:an?\s+|the\s+)?(.+)/i);
                const itemRaw = itemMatch ? itemMatch[1].trim() : 'item';
                const itemJa = this._resolveObjectNameJp(itemRaw);
                report = {
                    death: rawDeath,
                    translatedDeath: `爆発した${itemJa}によって死亡した`,
                    translatedDeathJa: `爆発した${itemJa}によって死亡した`,
                    category: 'ITEM_MISHAP',
                    isVictory: false,
                    entity: { type: 'item', nameJa: itemJa, nameEn: itemRaw },
                    advice: ADVICE_DEFINITIONS['ADVICE_HAZARD_EXPLOSION'] || null,
                    countermeasureJa: '不安定なアイテムの爆発に巻き込まれないよう、安全な取り扱いを心がけましょう。',
                    countermeasureEn: 'Handle volatile items carefully to avoid accidental explosions.',
                    loreLink: null
                };
            }
        }

        // 7. 反射光線自爆 (Bounced Ray)
        else if (lowerBase.includes('bounced off a wall')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_BOUNCED_RAY'];
            let rayJa = '稲妻';
            if (lowerBase.includes('death')) rayJa = '死の光線';
            else if (lowerBase.includes('fire')) rayJa = '火炎';
            else if (lowerBase.includes('cold')) rayJa = '冷気';

            report = {
                death: rawDeath,
                translatedDeath: `壁で跳ね返った${rayJa}に打たれて自滅した`,
                translatedDeathJa: `壁で跳ね返った${rayJa}に打たれて自滅した`,
                category: 'BOUNCED_RAY',
                isVictory: false,
                entity: { type: 'hazard', id: 'bounced_ray', nameJa: `反射${rayJa}`, nameEn: 'Bounced ray' },
                advice: adviceDef || null,
                countermeasureJa: '壁に反射した電撃や死の光線に当たると自滅します。反射の盾を装備するか、直角以外の角度での照射を避けてください。',
                countermeasureEn: 'Lightning or death rays bouncing off walls can strike you. Wear Shield of Reflection or mind your firing angle.',
                loreLink: null
            };
        }

        // 8. スライム化 (Turned to Slime)
        else if (lowerBase.includes('turned to slime')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_SLIME'] || ADVICE_DEFINITIONS['ADVICE_THREAT_GREEN_SLIME'];
            report = {
                death: rawDeath,
                translatedDeath: 'グリーンスライムによりスライム化して死亡した',
                translatedDeathJa: 'グリーンスライムによりスライム化して死亡した',
                category: 'TURNED_SLIME',
                isVictory: false,
                entity: { type: 'monster', id: 'green_slime', nameJa: 'グリーンスライム', nameEn: 'green slime', dangerLevel: 'CRITICAL' },
                advice: adviceDef || null,
                countermeasureJa: 'グリーンスライムに接触されるとスライム化即死します！火炎の杖や火の呪文、遠隔攻撃で速やかに焼き払ってください。',
                countermeasureEn: 'Green slime contact turns player into slime! Burn it away with fire or attack from range.',
                loreLink: { target: 'adventure_log.html', type: 'monster', query: 'green slime' }
            };
        }

        // 9. 石化死 (Petrification)
        else if (lowerBase.includes('petrif') || lowerBase.includes('turning to stone') || lowerBase.includes('turned to stone')) {
            let causeNameJa = '石化';
            let adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_PETRIFICATION'];
            let deathJa = '石化により死亡した';
            let counterJa = '手袋を着用して死骸への接触を防ぐか、トカゲの死骸(lizard corpse)を食べて石化の進行を即座に治療してください。';

            if (lowerBase.includes('without gloves')) {
                adviceDef = ADVICE_DEFINITIONS['ADVICE_HAZARD_PETRIFY_CORPSE'] || adviceDef;
                if (lowerBase.includes('chickatrice')) {
                    causeNameJa = 'ヒナコカトリス';
                    deathJa = '素手でヒナコカトリスの死骸に触れて石化した';
                } else {
                    causeNameJa = 'コカトリス';
                    deathJa = '素手でコカトリスの死骸に触れて石化した';
                }
                counterJa = '足元のコカトリスの死骸を手袋なしで拾う・触ると即死します。必ず手袋を着用してください。';
            } else {
                if (lowerBase.includes('chickatrice')) {
                    causeNameJa = 'ヒナコカトリス';
                    deathJa = 'ヒナコカトリスにより石化した';
                } else if (lowerBase.includes('cockatrice')) {
                    causeNameJa = 'コカトリス';
                    deathJa = 'コカトリスにより石化した';
                } else if (lowerBase.includes('medusa')) {
                    causeNameJa = 'メデューサ';
                    deathJa = 'メデューサの視線により石化した';
                } else {
                    deathJa = `${causeNameJa}により石化した`;
                }
            }

            report = {
                death: rawDeath,
                translatedDeath: deathJa,
                translatedDeathJa: deathJa,
                category: 'PETRIFICATION',
                isVictory: false,
                entity: { type: 'hazard', id: 'petrification', nameJa: causeNameJa, nameEn: 'Petrification' },
                advice: adviceDef || null,
                countermeasureJa: counterJa,
                countermeasureEn: 'Wear gloves to safely handle corpses, or eat a lizard corpse to instantly cure petrification.',
                loreLink: { target: 'adventure_log.html', type: 'monster', query: 'cockatrice' }
            };
        }

        // 10. 首絞め (Strangulation)
        else if (lowerBase.includes('strangled by an amulet of strangulation')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_CHOKING'];
            report = {
                death: rawDeath,
                translatedDeath: '首絞めの魔除けにより絞殺された',
                translatedDeathJa: '首絞めの魔除けにより絞殺された',
                category: 'STRANGULATION',
                isVictory: false,
                entity: { type: 'item', nameJa: '首絞めの魔除け', nameEn: 'amulet of strangulation' },
                advice: adviceDef || null,
                countermeasureJa: '未識別の魔除けを首にかける際は、呪われていないか確認するか解呪手段を用意しておきましょう。',
                countermeasureEn: 'Check BUC or prepare uncursing methods before putting on unidentified amulets.',
                loreLink: null
            };
        }

        // 11. 窒息死 (Choking)
        else if (lowerBase.includes('choked on')) {
            const itemMatch = baseDeath.match(/choked on\s+(?:an?\s+|the\s+)?(.+)/i);
            const itemRaw = itemMatch ? itemMatch[1].trim() : 'food';
            const itemJa = this._resolveObjectNameJp(itemRaw);
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_CHOKING'];
            report = {
                death: rawDeath,
                translatedDeath: `${itemJa}を喉に詰まらせて窒息死した`,
                translatedDeathJa: `${itemJa}を喉に詰まらせて窒息死した`,
                category: 'CHOKING',
                isVictory: false,
                entity: { type: 'item', nameJa: itemJa, nameEn: itemRaw },
                advice: adviceDef || null,
                countermeasureJa: '満腹状態(Satiated)でさらに食料を食べると窒息死します。満腹度が下がるまで食事を控えましょう。',
                countermeasureEn: 'Eating while Satiated can cause fatal choking. Wait until digestion completes before eating more.',
                loreLink: { target: 'adventure_log.html', query: 'food' }
            };
        }

        // 12. 溺死 (Drowning)
        else if (lowerBase.includes('drown')) {
            const isMoat = lowerBase.includes('moat');
            const deathJa = isMoat ? '堀に沈んで溺死した' : '水底に沈んで溺死した';
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_DROWNING'] || ADVICE_DEFINITIONS['ADVICE_THREAT_DROWNING'];
            report = {
                death: rawDeath,
                translatedDeath: deathJa,
                translatedDeathJa: deathJa,
                category: 'DROWNING',
                isVictory: false,
                entity: { type: 'hazard', id: 'water', nameJa: isMoat ? '堀' : '水流・堀', nameEn: 'Water' },
                advice: adviceDef || null,
                countermeasureJa: '重い荷物を背負った状態で水に入らないでください。浮遊の指輪(Ring of Levitation)や水上歩行の靴で水面を安全に渡れます。',
                countermeasureEn: 'Avoid deep water while burdened. Use a Ring of Levitation or Water Walking Boots to cross safely.',
                loreLink: null
            };
        }

        // 13. 溶岩死 (Lava Hazard)
        else if (lowerBase.includes('lava')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_HAZARD_LAVA'];
            report = {
                death: rawDeath,
                translatedDeath: '溶岩に落ちて焼け死んだ',
                translatedDeathJa: '溶岩に落ちて焼け死んだ',
                category: 'HAZARD_ENVIRONMENT',
                isVictory: false,
                entity: { type: 'hazard', id: 'lava', nameJa: '溶岩', nameEn: 'Lava' },
                advice: adviceDef || null,
                countermeasureJa: '溶岩は浮遊手段なしで侵入すると即死し全装備が焼失します。浮遊の指輪や杖を準備してください。',
                countermeasureEn: 'Lava causes instant death and burns all items without Levitation.',
                loreLink: null
            };
        }

        // 14. 跳ね橋即死 (Drawbridge Hazard)
        else if (lowerBase.includes('drawbridge')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_HAZARD_DRAWBRIDGE'];
            report = {
                death: rawDeath,
                translatedDeath: '跳ね橋に押し潰されて死亡した',
                translatedDeathJa: '跳ね橋に押し潰されて死亡した',
                category: 'HAZARD_ENVIRONMENT',
                isVictory: false,
                entity: { type: 'hazard', id: 'drawbridge', nameJa: '跳ね橋', nameEn: 'Drawbridge' },
                advice: adviceDef || null,
                countermeasureJa: '跳ね橋(Drawbridge)の真下にいるときに開閉されると押し潰されて即死します。跳ね橋の昇降スイッチには細心の注意を払いましょう。',
                countermeasureEn: 'Standing under a closing/opening drawbridge causes instant crushing death. Operate bridges with extreme care.',
                loreLink: null
            };
        }

        // 15. 罠死 (Trap Hazards)
        else if (
            lowerBase.includes('poisoned dart') ||
            lowerBase.includes('fell into a pit') ||
            lowerBase.includes('spiked pit') ||
            lowerBase.includes('pit of iron spikes')
        ) {
            let deathJa = '罠にかかって命を落とした';
            if (lowerBase.includes('poisoned dart')) {
                deathJa = '毒矢の罠に当たって毒死した';
            } else if (lowerBase.includes('spikes')) {
                deathJa = '鉄のトゲの落とし穴に落ちて死亡した';
            } else if (lowerBase.includes('pit')) {
                deathJa = '落とし穴に落ちて死亡した';
            }

            const adviceDef = ADVICE_DEFINITIONS['ADVICE_HAZARD_TRAP'];
            report = {
                death: rawDeath,
                translatedDeath: deathJa,
                translatedDeathJa: deathJa,
                category: 'TRAP',
                isVictory: false,
                entity: { type: 'trap', id: 'trap', nameJa: '罠', nameEn: 'Trap' },
                advice: adviceDef || null,
                countermeasureJa: '露出した罠を迂回するか、探索スキルを活用して未発見の落とし穴や毒矢罠を警戒してください。',
                countermeasureEn: 'Search for hidden traps and avoid stepping on dangerous spiked pits or poisoned darts.',
                loreLink: null
            };
        }

        // 16. 神罰 (Divine Wrath)
        else if (lowerBase.includes('the wrath of') || lowerBase.includes('the anger of')) {
            const godMatch = baseDeath.match(/(?:wrath|anger)\s+of\s+([A-Za-z\s-]+)/i);
            const godRaw = godMatch ? godMatch[1].trim() : 'God';
            const godClean = godRaw.toLowerCase();
            const godJa = GODS_JP[godClean] || godRaw;

            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_DIVINE_WRATH'];
            report = {
                death: rawDeath,
                translatedDeath: `${godJa}の神罰により死亡した`,
                translatedDeathJa: `${godJa}の神罰により死亡した`,
                category: 'DIVINE_WRATH',
                isVictory: false,
                entity: { type: 'god', nameJa: godJa, nameEn: godRaw },
                advice: adviceDef || null,
                countermeasureJa: '祈りの間隔が早すぎる、不敬な行動を行うなどで神の怒りに触れると即死・致命的打撃を受けます。祈りは十分にターンを空けて行いましょう。',
                countermeasureEn: 'Praying too frequently incurs divine wrath. Wait sufficient turns before praying again.',
                loreLink: null
            };
        }

        // 17. プレイヤーの事故・自滅 (Player Mishap)
        else if (lowerBase.includes('zapped himself') || lowerBase.includes('zapped herself')) {
            const wandMatch = baseDeath.match(/with\s+(?:an?\s+|the\s+)?(wand\s+of\s+[a-zA-Z\s-]+)/i);
            const wandRaw = wandMatch ? wandMatch[1].trim() : 'wand';
            const wandJa = this._resolveObjectNameJp(wandRaw);
            report = {
                death: rawDeath,
                translatedDeath: `自らの${wandJa}の誤射で命を落とした`,
                translatedDeathJa: `自らの${wandJa}の誤射で命を落とした`,
                category: 'ITEM_MISHAP',
                isVictory: false,
                entity: { type: 'item', nameJa: wandJa, nameEn: wandRaw },
                advice: null,
                countermeasureJa: '杖の照射方向には細心の注意を払い、反射や自爆のリスクを確認してください。',
                countermeasureEn: 'Double-check zapping directions to avoid self-inflicted ray attacks.',
                loreLink: null
            };
        } else if (lowerBase.includes('kicking a')) {
            const objMatch = baseDeath.match(/kicking\s+(?:an?\s+|the\s+)?(.+)/i);
            const objRaw = objMatch ? objMatch[1].trim() : 'object';
            const objJa = this._resolveObjectNameJp(objRaw);
            report = {
                death: rawDeath,
                translatedDeath: `${objJa}を蹴った反動で死亡した`,
                translatedDeathJa: `${objJa}を蹴った反動で死亡した`,
                category: 'MISHAP',
                isVictory: false,
                entity: { type: 'object', nameJa: objJa, nameEn: objRaw },
                advice: null,
                countermeasureJa: '硬い壁やシンクを蹴ると大ダメージを受けたり即死することがあります。無用なキックは控えましょう。',
                countermeasureEn: 'Kicking solid walls or heavy sinks causes severe damage or death.',
                loreLink: null
            };
        } else if (lowerBase.includes('genocidal confusion')) {
            report = {
                death: rawDeath,
                translatedDeath: '絶滅の巻物の混乱により自滅した',
                translatedDeathJa: '絶滅の巻物の混乱により自滅した',
                category: 'MISHAP',
                isVictory: false,
                entity: null,
                advice: null,
                countermeasureJa: '混乱状態で絶滅の巻物を読むと自分の種族・職業を指定して自滅します。混乱を治療してから読みましょう。',
                countermeasureEn: 'Reading genocide while confused genocides your own species/role.',
                loreLink: null
            };
        }

        // 18. 飢餓死 (Starvation)
        else if (lowerBase.includes('starv') || lowerBase.includes('died of starvation')) {
            const adviceDef = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_STARVATION'];
            report = {
                death: rawDeath,
                translatedDeath: '飢えにより力尽きた',
                translatedDeathJa: '飢えにより力尽きた',
                category: 'STARVATION',
                isVictory: false,
                entity: { type: 'condition', id: 'starvation', nameJa: '飢餓', nameEn: 'Starvation' },
                advice: adviceDef || null,
                countermeasureJa: '食料（保存食・レーション）を常に携帯し、飢餓で倒れる前に神に祈る(#pray)ことで満腹度を全回復できます。',
                countermeasureEn: 'Always carry rations and pray (#pray) when fainting from hunger to restore nutrition.',
                loreLink: { target: 'adventure_log.html', query: 'food' }
            };
        }

        // 19. モンスターによる殺害 (Killed by / Slain by)
        else {
            const killMatch = baseDeath.match(/(?:killed|slain|crushed|blasted|poisoned)\s+by\s+(?:an?\s+|the\s+)?(.+)/i);
            if (killMatch) {
                let killerRaw = killMatch[1].trim();
                const monsterResolve = this._resolveMonsterInfo(killerRaw);
                const monsterNameJa = monsterResolve.nameJa || killerRaw;
                const cleanKiller = killerRaw.toLowerCase();

                let adviceDef = null;
                let countermeasureJa = `強力なモンスターとの近接戦闘を避け、エルベレスの刻印(Elbereth)や遠隔攻撃、状態異常魔法・杖を活用しましょう。`;
                let countermeasureEn = `Avoid melee with deadly foes. Utilize Elbereth, ranged attacks, or escape wands.`;

                // 黙示録の三騎士 (Death, Famine, Pestilence)
                if (cleanKiller.includes('death') || cleanKiller.includes('famine') || cleanKiller.includes('pestilence')) {
                    adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_RIDER'] || ADVICE_DEFINITIONS['ADVICE_THREAT_RIDER_LETHAL'];
                    countermeasureJa = '死・飢饉・疫病の三騎士は直接攻撃が極めて致命的です。近接を避け、遠距離から杖や飛び道具で撃破してください。';
                    countermeasureEn = 'Riders of the Apocalypse possess lethal attacks. Avoid melee and strike from distance.';
                }
                // マインドフレア (Mind Flayer)
                else if (cleanKiller.includes('mind flayer')) {
                    adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_MIND_FLAYER'];
                    countermeasureJa = '触手攻撃で知性を吸い尽くされると即死します。エルベレスの刻印や遠隔攻撃で接近を許さずに倒しましょう。';
                    countermeasureEn = 'Tentacle attacks permanently eat Int until instant death. Use Elbereth or ranged attacks.';
                }
                // 浮遊する目玉 (Floating Eye)
                else if (cleanKiller.includes('floating eye')) {
                    adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_FLOATING_EYE'];
                    countermeasureJa = '浮遊する目玉を直接攻撃すると麻痺します。目隠し(Blindfold)を着用して戦うか、飛び道具で離れて倒しましょう。';
                    countermeasureEn = 'Melee attacking a Floating Eye paralyzes you. Use a blindfold or attack with ranged weapons.';
                }
                // コカトリス・チカトリス
                else if (cleanKiller.includes('cockatrice') || cleanKiller.includes('chickatrice')) {
                    adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_PETRIFICATION'];
                    countermeasureJa = '直接接触や死骸への素手接触で即座に石化します。手袋を常時着用し、トカゲの死骸を携帯してください。';
                    countermeasureEn = 'Instant petrification on contact. Always wear gloves and carry a lizard corpse.';
                }
                // ドラゴン
                else if (cleanKiller.includes('dragon')) {
                    countermeasureJa = 'ドラゴンの強力なブレス攻撃には反射の盾(Shield of Reflection)や対応する属性耐性（火炎・冷気等）が不可欠です。';
                    countermeasureEn = 'Dragon breaths are lethal without Reflection or matching elemental resistances.';
                }
                // 店主
                else if (monsterResolve.id === 'shopkeeper') {
                    adviceDef = ADVICE_DEFINITIONS['ADVICE_THREAT_PEACEFUL_SHOPKEEPER'];
                    countermeasureJa = '店主は平和的NPCです。攻撃や泥棒を行うと俊足と強力な杖攻撃で即死級の脅威となります。';
                    countermeasureEn = 'Shopkeepers are peaceful merchants. Attacking them provokes lethal retaliation.';
                }

                report = {
                    death: rawDeath,
                    translatedDeath: `${monsterNameJa}に倒された`,
                    translatedDeathJa: `${monsterNameJa}に倒された`,
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
        }

        // 20. 未知の死因フォールバック
        if (!report) {
            report = {
                death: rawDeath,
                translatedDeath: rawDeath,
                translatedDeathJa: rawDeath,
                category: 'UNKNOWN',
                isVictory: false,
                entity: null,
                advice: null,
                countermeasureJa: '探索時はHPの残量に常に注意を払い、回復の薬や脱出アイテムを準備しておきましょう。',
                countermeasureEn: 'Keep a close eye on your HP and always carry healing potions and teleportation items.',
                loreLink: null
            };
        }

        // =========================================================================
        // 【Stage 3: 根本原因調停 (Root Cause Arbitration: RCA)】
        // =========================================================================
        if (whileConditionRaw) {
            report.subCondition = whileConditionRaw;
            report.directKiller = report.entity ? (report.entity.nameEn || report.entity.nameJa) : baseDeath;

            const lowerWhile = whileConditionRaw.toLowerCase();

            // 直接死因側の危険度スコア（基本値）
            let directScore = 200;
            if (report.entity && report.entity.dangerLevel) {
                switch (report.entity.dangerLevel) {
                    case 'CRITICAL': directScore = 900; break;
                    case 'HIGH': directScore = 600; break;
                    case 'MEDIUM': directScore = 300; break;
                    case 'LOW': directScore = 100; break;
                    default: directScore = 150; break;
                }
            }

            // 付帯状況の解析
            let conditionScore = 0;
            let conditionJa = '';
            let conditionAdvice = null;
            let conditionCounterJa = null;
            let conditionCounterEn = null;
            let rcaCategory = null;

            // (a) 飢餓・空腹による気絶 (fainted from lack of food)
            if (lowerWhile.includes('faint') || lowerWhile.includes('lack of food') || lowerWhile.includes('starv')) {
                conditionScore = 1000;
                conditionJa = '飢餓で気絶中に';
                conditionAdvice = ADVICE_DEFINITIONS['ADVICE_SURVIVAL_STARVATION'];
                conditionCounterJa = '食料（保存食・レーション）を常に携帯し、飢餓で倒れる前に神に祈る(#pray)ことで満腹度を全回復できます。';
                conditionCounterEn = 'Always carry rations and pray (#pray) when fainting from hunger to restore nutrition.';
                rcaCategory = 'STARVATION';
            }
            // (b) モンスターの視線麻痺・凍結 (frozen by a monster's gaze / floating eye)
            else if (lowerWhile.includes('frozen') || lowerWhile.includes('gaze')) {
                conditionScore = 950;
                conditionJa = lowerWhile.includes('floating eye')
                    ? '浮遊する目玉に麻痺させられている間に'
                    : 'モンスターの視線で凍りついている間に';
                conditionAdvice = ADVICE_DEFINITIONS['ADVICE_THREAT_FLOATING_EYE'];
                conditionCounterJa = '浮遊する目玉を直接攻撃すると麻痺します。目隠し(Blindfold)を着用して戦うか、飛び道具で離れて倒しましょう。';
                conditionCounterEn = 'Melee attacking a Floating Eye paralyzes you. Use a blindfold or attack with ranged weapons.';
            }
            // (c) 麻痺 (paralyzed)
            else if (lowerWhile.includes('paralyz')) {
                conditionScore = 850;
                conditionJa = '麻痺している間に';
                conditionAdvice = ADVICE_DEFINITIONS['ADVICE_THREAT_FLOATING_EYE'];
                conditionCounterJa = '麻痺状態になると反撃や逃走が不可能になります。麻痺攻撃を持つ敵には目隠しや遠隔攻撃で対処しましょう。';
                conditionCounterEn = 'Paralysis prevents any action or escape. Counter paralyzing foes with blindfolds or ranged attacks.';
            }
            // (d) 睡眠中 (sleeping)
            else if (lowerWhile.includes('sleeping') || lowerWhile.includes('asleep')) {
                conditionScore = 800;
                conditionJa = '眠っている間に';
                conditionCounterJa = '安全が確保されていない場所での睡眠は危険です。周囲の安全を確認するかエルベレスを刻んでから休息しましょう。';
                conditionCounterEn = 'Never sleep in unsafe areas. Secure the area or engrave Elbereth before resting.';
            }
            // (e) 祈祷中 (praying)
            else if (lowerWhile.includes('praying')) {
                conditionScore = 600;
                conditionJa = '神に祈りを捧げている間に';
            }
            // (f) 装備着脱中 (taking off / dressing up)
            else if (lowerWhile.includes('taking off') || lowerWhile.includes('dressing')) {
                conditionScore = 600;
                conditionJa = '装備を着脱している間に';
            }
            // (g) 無力化 (helpless)
            else if (lowerWhile.includes('helpless')) {
                conditionScore = 700;
                conditionJa = '身動きが取れない間に';
            }
            // (h) その他一般付帯
            else {
                conditionScore = 400;
                conditionJa = `${whileConditionRaw}の最中に`;
            }

            // 日本語死因文に付帯状況を前置合成
            if (report.translatedDeathJa && conditionJa) {
                report.translatedDeathJa = `${conditionJa}${report.translatedDeathJa}`;
                report.translatedDeath = report.translatedDeathJa;
            }

            // 根本原因調停 (RCA): 付帯状況の教訓スコアが直接打撃を上回る場合は主因として選定
            if (conditionScore > directScore) {
                report.rootCause = {
                    condition: whileConditionRaw,
                    conditionJa: conditionJa,
                    score: conditionScore,
                    isHelpless: true
                };
                if (conditionAdvice) report.advice = conditionAdvice;
                if (conditionCounterJa) report.countermeasureJa = conditionCounterJa;
                if (conditionCounterEn) report.countermeasureEn = conditionCounterEn;
                if (rcaCategory) report.category = rcaCategory;
            }
        }

        // 翻訳キー整合性保証
        report.translatedDeath = report.translatedDeathJa;

        return report;
    }

    /**
     * モンスター英文名から日本語名・ID・危険度を逆引き解決する
     */
    static _resolveMonsterInfo(nameEn) {
        if (!nameEn) return { id: null, nameJa: null, dangerLevel: 'UNKNOWN' };

        let clean = nameEn.trim();
        // 冠詞除去
        clean = clean.replace(/^(?:an?|the)\s+/i, '');
        // called の除去
        clean = clean.replace(/\s+called\s+["']?[^"']+["']?/i, '');

        // 状態修飾子の抽出
        let prefixJa = '';
        if (/\binvisible\b/i.test(clean)) {
            prefixJa += '姿の見えない';
            clean = clean.replace(/\binvisible\b/i, '').trim();
        }
        if (/\bpeaceful\b/i.test(clean)) {
            prefixJa += '平和的な';
            clean = clean.replace(/\bpeaceful\b/i, '').trim();
        }

        // 店主の判定 (例: "Mr. Morgan, the shopkeeper", "the shopkeeper")
        const shopMatch = clean.match(/^(?:Mr\.|Ms\.)?\s*([A-Za-z]+),\s*the\s+shopkeeper/i);
        if (shopMatch) {
            const rawName = shopMatch[1].toLowerCase();
            const shopNameJa = SHOPKEEPER_NAMES_JP[rawName] || shopMatch[1];
            return {
                id: 'shopkeeper',
                nameJa: `店主${shopNameJa}`,
                dangerLevel: 'HIGH'
            };
        }
        if (/the\s+shopkeeper/i.test(clean) || clean === 'shopkeeper') {
            return {
                id: 'shopkeeper',
                nameJa: '店主',
                dangerLevel: 'HIGH'
            };
        }

        // 僧侶の判定 (例: "priest of Moloch", "priestess of Moloch")
        const priestMatch = clean.match(/priest(?:ess)?\s+of\s+([A-Za-z\s-]+)/i);
        if (priestMatch) {
            const godRaw = priestMatch[1].trim().toLowerCase();
            const godJa = GODS_JP[godRaw] || priestMatch[1].trim();
            return {
                id: 'priest',
                nameJa: `${godJa}の僧侶`,
                dangerLevel: 'HIGH'
            };
        }

        clean = clean.replace(/\s+/g, ' ').trim().toLowerCase();

        // 1. MONSTER_JP_MAP から検索
        let nameJa = null;
        if (MONSTER_JP_MAP && MONSTER_JP_MAP.monsters) {
            // (1) 完全一致（大文字小文字無視）
            for (const [k, v] of Object.entries(MONSTER_JP_MAP.monsters)) {
                if (k.toLowerCase() === clean) {
                    nameJa = v;
                    break;
                }
            }
            // (2) 単語境界＋最長一致（キー長降順）
            if (!nameJa) {
                const sortedKeys = Object.keys(MONSTER_JP_MAP.monsters).sort((a, b) => b.length - a.length);
                for (const enKey of sortedKeys) {
                    if (enKey.length < 3) continue; // 2文字以下は誤爆防止
                    const reg = new RegExp(`\\b${escapeRegExp(enKey)}\\b`, 'i');
                    if (reg.test(clean)) {
                        nameJa = MONSTER_JP_MAP.monsters[enKey];
                        break;
                    }
                }
            }
        }

        if (!nameJa) {
            const genericAnimals = {
                'rat': 'ネズミ',
                'bat': 'コウモリ',
                'snake': 'ヘビ',
                'spider': 'クモ',
                'bee': '蜂',
                'ant': '蟻',
                'worm': 'イモムシ'
            };
            if (genericAnimals[clean]) {
                nameJa = genericAnimals[clean];
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

        // 特別な強敵の補正
        if (clean === 'death' || clean === 'pestilence' || clean === 'famine') {
            dangerLevel = 'CRITICAL';
        }

        const finalNameJa = (prefixJa ? prefixJa : '') + (nameJa || clean);

        return {
            id: monsterId,
            nameJa: finalNameJa,
            dangerLevel: dangerLevel
        };
    }

    /**
     * アイテム英文名から日本語名を逆引き解決する
     */
    static _resolveObjectNameJp(nameEn) {
        if (!nameEn) return 'アイテム';
        let clean = nameEn.trim().replace(/^(?:an?|the)\s+/i, '').toLowerCase();

        if (clean === 'food' || clean === 'rations' || clean === 'food ration') return '食料';
        if (clean === 'wall') return '壁';
        if (clean === 'sink') return 'シンク';
        if (clean === 'door') return '扉';
        if (clean === 'tree') return '木';
        if (clean === 'boulder') return '巨石';

        if (OBJECT_JP_MAP && OBJECT_JP_MAP.objects) {
            // 完全一致
            for (const [k, v] of Object.entries(OBJECT_JP_MAP.objects)) {
                if (k.toLowerCase() === clean) {
                    return v;
                }
            }
            // 単語境界＋最長一致
            const sortedKeys = Object.keys(OBJECT_JP_MAP.objects).sort((a, b) => b.length - a.length);
            for (const enKey of sortedKeys) {
                if (enKey.length < 3) continue;
                const reg = new RegExp(`\\b${escapeRegExp(enKey)}\\b`, 'i');
                if (reg.test(clean)) {
                    return OBJECT_JP_MAP.objects[enKey];
                }
            }
        }
        return nameEn;
    }
}
