/**
 * CHARACTER_KNOWLEDGE_BASE.js
 * NetHack 5.0 (3.7) 種族・職業別 確定内在能力・耐性マスターデータ (SSOT)
 *
 * Single Source of Truth: NetHackJP/src/attrib.c (arc_abil, bar_abil, ..., dwa_abil, elf_abil, etc.)
 */

/**
 * 種族別 確定内在能力・耐性定義
 * key: 種族小文字キー
 * abilities: 各レベルで獲得する能力リスト { level, ability }
 */
export const RACE_KNOWLEDGE_MAP = {
    human: {
        id: 'human',
        name: 'Human',
        nameJa: '人間',
        allowedAlignments: ['lawful', 'neutral', 'chaotic'],
        tags: {
            ja: ['万能', '全属性可'],
            en: ['Versatile', 'All Alignments']
        },
        description: {
            ja: 'すべての職業・属性に適応可能な標準的な種族。',
            en: 'Adaptable to all roles and alignments.'
        },
        abilities: []
    },
    dwarf: {
        id: 'dwarf',
        name: 'Dwarf',
        nameJa: 'ドワーフ',
        allowedAlignments: ['lawful'],
        tags: {
            ja: ['暗視', '秩序固定'],
            en: ['Infravision', 'Lawful only']
        },
        description: {
            ja: '地下生活に適した強靭な種族。暗視能力を持ち、秩序のみ。',
            en: 'Tough subterranean race with infravision. Lawful only.'
        },
        abilities: [
            { level: 1, ability: 'infravision' } // 暗視
        ]
    },
    elf: {
        id: 'elf',
        name: 'Elf',
        nameJa: 'エルフ',
        allowedAlignments: ['chaotic'],
        tags: {
            ja: ['暗視', '睡眠耐性', '混沌固定'],
            en: ['Infravision', 'Sleep res', 'Chaotic only']
        },
        description: {
            ja: '魔法と自然に通じた種族。暗視を持ち、成長すると睡眠耐性を得る。混沌のみ。',
            en: 'Attuned to magic and nature with infravision and sleep res. Chaotic only.'
        },
        abilities: [
            { level: 1, ability: 'infravision' }, // 暗視
            { level: 4, ability: 'sleep' }        // 睡眠耐性
        ]
    },
    gnome: {
        id: 'gnome',
        name: 'Gnome',
        nameJa: 'ノーム',
        allowedAlignments: ['neutral'],
        tags: {
            ja: ['暗視', '中立固定'],
            en: ['Infravision', 'Neutral only']
        },
        description: {
            ja: '機知に富んだ小型の種族。暗視能力を持ち、中立のみ。',
            en: 'Clever small race with infravision. Neutral only.'
        },
        abilities: [
            { level: 1, ability: 'infravision' } // 暗視
        ]
    },
    orc: {
        id: 'orc',
        name: 'Orc',
        nameJa: 'オーク',
        allowedAlignments: ['chaotic'],
        tags: {
            ja: ['暗視', '毒耐性', '混沌固定'],
            en: ['Infravision', 'Poison res', 'Chaotic only']
        },
        description: {
            ja: '過酷な環境を生き抜く種族。最初から暗視と毒耐性を持つ。混沌のみ。',
            en: 'Hardy survivors with innate infravision and poison resistance. Chaotic only.'
        },
        abilities: [
            { level: 1, ability: 'infravision' }, // 暗視
            { level: 1, ability: 'poison' }       // 毒耐性
        ]
    }
};

/**
 * 職業別 確定内在能力・耐性定義
 * key: 職業小文字キー
 * abilities: 各レベルで獲得する能力リスト { level, ability }
 */
export const ROLE_KNOWLEDGE_MAP = {
    archeologist: {
        id: 'archeologist',
        code: 'Arc',
        name: 'Archeologist',
        nameJa: '考古学者',
        allowedRaces: ['human', 'dwarf', 'gnome'],
        allowedAlignments: ['lawful', 'neutral'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['探索', '隠密', '鞭/ツルハシ'],
            en: ['Searching', 'Stealth', 'Bullwhip/Pickaxe']
        },
        description: {
            ja: '遺跡探索の専門家。罠や秘密の扉を見つけやすい。',
            en: 'Specialist in ancient ruins, skilled at detecting traps and secret doors.'
        },
        abilities: [
            { level: 1, ability: 'searching' }, // 探索
            { level: 5, ability: 'stealth' },   // 隠密
            { level: 10, ability: 'fast' }      // 倍速
        ]
    },
    barbarian: {
        id: 'barbarian',
        code: 'Bar',
        name: 'Barbarian',
        nameJa: '野蛮人',
        allowedRaces: ['human', 'orc'],
        allowedAlignments: ['neutral', 'chaotic'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['毒耐性', '怪力', '二刀流可'],
            en: ['Poison res', 'High Strength', 'Two-weapon combat']
        },
        description: {
            ja: '強靭な肉体と毒耐性を持つ戦士。',
            en: 'Fierce warrior with innate poison resistance and brute strength.'
        },
        abilities: [
            { level: 1, ability: 'poison' },   // 毒耐性
            { level: 7, ability: 'fast' },     // 倍速
            { level: 15, ability: 'stealth' }  // 隠密
        ]
    },
    caveman: {
        id: 'caveman',
        code: 'Cav',
        name: 'Caveman',
        nameFemale: 'Cavewoman',
        nameJa: '洞窟人',
        nameFemaleJa: '洞窟の女',
        allowedRaces: ['human', 'dwarf', 'gnome'],
        allowedAlignments: ['lawful', 'neutral'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['棍棒/スリング', '倍速(Lv7)'],
            en: ['Club/Sling', 'Fast (Lv7)']
        },
        description: {
            ja: '原始の生存者。棍棒とスリングの扱いに長ける。',
            en: 'Primitive survivor proficient with clubs and slings.'
        },
        abilities: [
            { level: 7, ability: 'fast' },     // 倍速
            { level: 15, ability: 'warning' }  // 警戒
        ]
    },
    healer: {
        id: 'healer',
        code: 'Hea',
        name: 'Healer',
        nameJa: '治療師',
        allowedRaces: ['human', 'gnome'],
        allowedAlignments: ['neutral'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['中立固定', '毒耐性', '回復魔法'],
            en: ['Neutral only', 'Poison res', 'Healing magic']
        },
        description: {
            ja: '傷を癒やす専門家。初期から毒耐性と回復道具・魔法を所持。中立固定。',
            en: 'Medical specialist starting with poison resistance and healing supplies. Neutral only.'
        },
        abilities: [
            { level: 1, ability: 'poison' },   // 毒耐性
            { level: 15, ability: 'warning' }  // 警戒
        ]
    },
    knight: {
        id: 'knight',
        code: 'Kni',
        name: 'Knight',
        nameJa: '騎士',
        allowedRaces: ['human'],
        allowedAlignments: ['lawful'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['人間限定', '秩序固定', '騎乗/跳躍'],
            en: ['Human only', 'Lawful only', 'Riding/Jumping']
        },
        description: {
            ja: '高潔なる騎士。馬に乗って戦い、生来の跳躍能力を持つ。人間・秩序限定。',
            en: 'Chivalrous knight starting with a steed and innate jumping. Human & Lawful only.'
        },
        abilities: [
            { level: 1, ability: 'jumping' }, // 跳躍 (天性)
            { level: 7, ability: 'fast' }     // 倍速
        ]
    },
    monk: {
        id: 'monk',
        code: 'Mon',
        name: 'Monk',
        nameJa: '修道士',
        allowedRaces: ['human'],
        allowedAlignments: ['lawful', 'neutral', 'chaotic'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['人間限定', '素手格闘', '倍速/睡眠耐性'],
            en: ['Human only', 'Martial arts', 'Fast/Sleep res']
        },
        description: {
            ja: '素手格闘と精神修行の達人。最初から倍速・睡眠耐性・透明視認を習得。人間限定。',
            en: 'Master of martial arts starting with speed, sleep res, and see invisible. Human only.'
        },
        abilities: [
            { level: 1, ability: 'fast' },            // 倍速
            { level: 1, ability: 'sleep' },           // 睡眠耐性
            { level: 1, ability: 'seeInvis' },        // 不可視視認
            { level: 3, ability: 'poison' },          // 毒耐性
            { level: 5, ability: 'stealth' },         // 隠密
            { level: 7, ability: 'warning' },         // 警戒
            { level: 9, ability: 'searching' },       // 探索
            { level: 11, ability: 'fire' },           // 火炎耐性
            { level: 13, ability: 'cold' },           // 冷気耐性
            { level: 15, ability: 'shock' },          // 電撃耐性
            { level: 17, ability: 'teleportControl' } // テレポート制御
        ]
    },
    priest: {
        id: 'priest',
        code: 'Pri',
        name: 'Priest',
        nameFemale: 'Priestess',
        nameJa: '僧侶',
        nameFemaleJa: '女司祭',
        allowedRaces: ['human', 'elf'],
        allowedAlignments: ['lawful', 'neutral', 'chaotic'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['呪詛看破', '神聖魔法'],
            en: ['Curse detection', 'Clerical magic']
        },
        description: {
            ja: '神に仕える聖職者。アイテムの祝福・呪いを見抜く能力を持つ。',
            en: 'Holy servant with the innate ability to sense blessed and cursed items.'
        },
        abilities: [
            { level: 15, ability: 'warning' }, // 警戒
            { level: 20, ability: 'fire' }     // 火炎耐性
        ]
    },
    ranger: {
        id: 'ranger',
        code: 'Ran',
        name: 'Ranger',
        nameJa: 'レンジャー',
        allowedRaces: ['human', 'elf', 'gnome', 'orc'],
        allowedAlignments: ['neutral', 'chaotic'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['探索', '弓矢/射撃名手'],
            en: ['Searching', 'Archery master']
        },
        description: {
            ja: '野外活動と遠隔射撃のスペシャリスト。探索能力を持つ。',
            en: 'Wilderness expert and master of bows and projectile weapons.'
        },
        abilities: [
            { level: 1, ability: 'searching' }, // 探索
            { level: 7, ability: 'stealth' },   // 隠密
            { level: 15, ability: 'seeInvis' }  // 不可視視認
        ]
    },
    rogue: {
        id: 'rogue',
        code: 'Rog',
        name: 'Rogue',
        nameJa: '盗賊',
        allowedRaces: ['human', 'orc'],
        allowedAlignments: ['chaotic'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['混沌固定', '隠密', 'バックスタブ'],
            en: ['Chaotic only', 'Stealth', 'Backstab']
        },
        description: {
            ja: '影に潜む暗殺・窃盗のプロ。最初から隠密能力を持ち、背後奇襲が得意。混沌固定。',
            en: 'Master of shadows with innate stealth and deadly backstab damage. Chaotic only.'
        },
        abilities: [
            { level: 1, ability: 'stealth' },   // 隠密
            { level: 10, ability: 'searching' } // 探索
        ]
    },
    samurai: {
        id: 'samurai',
        code: 'Sam',
        name: 'Samurai',
        nameJa: '侍',
        allowedRaces: ['human'],
        allowedAlignments: ['lawful'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['人間限定', '秩序固定', '倍速', '二刀流可'],
            en: ['Human only', 'Lawful only', 'Fast', 'Two-weapon combat']
        },
        description: {
            ja: '武士道の誇り高き戦士。刀と弓を扱い、最初から倍速で行動可能。人間・秩序限定。',
            en: 'Disciplined warrior starting with katana, bow, and innate speed. Human & Lawful only.'
        },
        abilities: [
            { level: 1, ability: 'fast' },    // 倍速
            { level: 15, ability: 'stealth' } // 隠密
        ]
    },
    tourist: {
        id: 'tourist',
        code: 'Tou',
        name: 'Tourist',
        nameJa: '観光客',
        allowedRaces: ['human'],
        allowedAlignments: ['neutral'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['人間限定', '中立固定', '写真機/潤沢な資金'],
            en: ['Human only', 'Neutral only', 'Camera/Rich funds']
        },
        description: {
            ja: 'ダンジョン観光に訪れた一般人。初期装備や資金は豊富だが最弱の序盤。人間・中立限定。',
            en: 'Tourist exploring the dungeon. Starts with luxury items and wealth, but fragile early on.'
        },
        abilities: [
            { level: 10, ability: 'searching' }, // 探索
            { level: 20, ability: 'poison' }     // 毒耐性
        ]
    },
    valkyrie: {
        id: 'valkyrie',
        code: 'Val',
        name: 'Valkyrie',
        nameJa: 'ワルキューレ',
        allowedRaces: ['human', 'dwarf'],
        allowedAlignments: ['lawful', 'neutral'],
        allowedGenders: ['female'], // 女性限定
        tags: {
            ja: ['女性限定', '冷気耐性', '戦闘特化'],
            en: ['Female only', 'Cold res', 'Combat specialist']
        },
        description: {
            ja: '北欧神話の戦乙女。屈強な戦闘力と生来の冷気耐性を持つ。女性限定。',
            en: 'Fierce warrior-maiden of Norse myth with innate cold resistance. Female only.'
        },
        abilities: [
            { level: 1, ability: 'cold' },    // 冷気耐性
            { level: 3, ability: 'stealth' }, // 隠密
            { level: 7, ability: 'fast' }     // 倍速
        ]
    },
    wizard: {
        id: 'wizard',
        code: 'Wiz',
        name: 'Wizard',
        nameJa: '魔法使い',
        allowedRaces: ['human', 'elf', 'gnome', 'orc'],
        allowedAlignments: ['neutral', 'chaotic'],
        allowedGenders: ['male', 'female'],
        tags: {
            ja: ['魔法詠唱', '魔力回復', '万能呪文'],
            en: ['Spellcasting', 'Mana regen', 'Versatile spells']
        },
        description: {
            ja: '神秘の魔力を操る術士。強力な攻撃・補助魔法を使いこなす。',
            en: 'Practitioner of the arcane arts with superior spellcasting abilities.'
        },
        abilities: [
            { level: 15, ability: 'warning' },        // 警戒
            { level: 17, ability: 'teleportControl' } // テレポート制御
        ]
    }
};

/**
 * 任意の種族名・文字列から正規化された種族キー ('human'|'dwarf'|'elf'|'gnome'|'orc') を解決
 * @param {string} raceStr 
 * @param {string} [defaultVal='human']
 * @returns {string} 正規化種族キー
 */
export function resolveRaceKey(raceStr, defaultVal = 'human') {
    if (!raceStr || typeof raceStr !== 'string') return defaultVal;
    const lower = raceStr.toLowerCase().trim();

    if (lower.includes('elf') || lower.includes('elv') || lower.includes('elven') || lower.includes('エルフ')) return 'elf';
    if (lower.includes('dwarf') || lower.includes('dwarv') || lower.includes('dwarven') || lower.includes('ドワーフ')) return 'dwarf';
    if (lower.includes('gnome') || lower.includes('gnom') || lower.includes('gnomish') || lower.includes('ノーム') || lower.includes('ノーグ')) return 'gnome';
    if (lower.includes('orc') || lower.includes('orcish') || lower.includes('オーク')) return 'orc';
    if (lower.includes('hum') || lower.includes('human') || lower.includes('人間')) return 'human';

    return defaultVal;
}

/**
 * 任意の職業名・短縮コード・称号文字列から正規化された職業キーを解決
 * @param {string} roleStr 
 * @param {string} [defaultVal='archeologist']
 * @returns {string} 正規化職業キー
 */
export function resolveRoleKey(roleStr, defaultVal = 'archeologist') {
    if (!roleStr || typeof roleStr !== 'string') return defaultVal;
    const lower = roleStr.toLowerCase().trim();

    if (lower.startsWith('arc') || lower.includes('archeologist') || lower.includes('archaeologist') || lower.includes('考古学')) return 'archeologist';
    if (lower.startsWith('bar') || lower.includes('barbarian') || lower.includes('野蛮人')) return 'barbarian';
    if (lower.startsWith('cav') || lower.includes('caveman') || lower.includes('cavewoman') || lower.includes('洞窟人') || lower.includes('洞窟の女')) return 'caveman';
    if (lower.startsWith('hea') || lower.includes('healer') || lower.includes('治療師') || lower.includes('治癒師')) return 'healer';
    if (lower.startsWith('kni') || lower.includes('knight') || lower.includes('騎士')) return 'knight';
    if (lower.startsWith('mon') || lower.includes('monk') || lower.includes('修道士')) return 'monk';
    if (lower.startsWith('pri') || lower.includes('priest') || lower.includes('priestess') || lower.includes('僧侶') || lower.includes('女司祭') || lower.includes('司祭') || lower.includes('尼僧')) return 'priest';
    if (lower.startsWith('ran') || lower.includes('ranger') || lower.includes('レンジャー')) return 'ranger';
    if (lower.startsWith('rog') || lower.includes('rogue') || lower.includes('盗賊')) return 'rogue';
    if (lower.startsWith('sam') || lower.includes('samurai') || lower.includes('侍')) return 'samurai';
    if (lower.startsWith('tou') || lower.includes('tourist') || lower.includes('観光客')) return 'tourist';
    if (lower.startsWith('val') || lower.includes('valkyrie') || lower.includes('ワルキューレ')) return 'valkyrie';
    if (lower.startsWith('wiz') || lower.includes('wizard') || lower.includes('魔法使い')) return 'wizard';

    return defaultVal;
}

/**
 * NetHackの ^X (#attributes) 出力行からキャラクター情報（種族・職業・性別・レベル）を抽出
 * Cコアから出力される英語原文（Raw English）から直接決定論的に判定
 * @param {string} line 
 * @returns {{ race?: string, role?: string, gender?: string, level?: number }|null}
 */
export function parseAttributesLine(line) {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();

    // 1. タイトル行: "<Name> the <Role>'s attributes:"
    const titleMatch = trimmed.match(/^(?:.*?\s+the\s+)?([a-zA-Z]+)'s\s+attributes:?$/i);
    if (titleMatch) {
        const role = resolveRoleKey(titleMatch[1], null);
        if (role) return { role };
    }

    // 2. 経歴行（単語4つ: 性別あり / 男女共通名職）
    // 例: "You are a Digger, a level 1 female human archeologist."
    // 例: "You are a Candidate, a level 1 male elven monk."
    const m4 = trimmed.match(/^You\s+(?:are|were)\s+(?:a|an)\s+(.+?),\s+a\s+level\s+(\d+)\s+([a-zA-Z]+)\s+([a-zA-Z]+)\s+([a-zA-Z]+)\.?/i);
    if (m4) {
        const level = parseInt(m4[2], 10);
        const genderWord = m4[3].toLowerCase();
        const raceWord = m4[4];
        const roleWord = m4[5];

        const race = resolveRaceKey(raceWord, null);
        const role = resolveRoleKey(roleWord, null);
        const gender = genderWord === 'female' ? 'female' : (genderWord === 'male' ? 'male' : undefined);

        if (race || role) {
            return {
                ...(race ? { race } : {}),
                ...(role ? { role } : {}),
                ...(gender ? { gender } : {}),
                ...(level ? { level } : {})
            };
        }
    }

    // 3. 経歴行（単語3つ: 性別なし / 男女別名職・性別限定職）
    // 例: "You are a Stripling, a level 1 human valkyrie."
    // 例: "You are an Aspirant, a level 1 elven priestess."
    const m3 = trimmed.match(/^You\s+(?:are|were)\s+(?:a|an)\s+(.+?),\s+a\s+level\s+(\d+)\s+([a-zA-Z]+)\s+([a-zA-Z]+)\.?/i);
    if (m3) {
        const level = parseInt(m3[2], 10);
        const raceWord = m3[3];
        const roleWord = m3[4];

        const race = resolveRaceKey(raceWord, null);
        const role = resolveRoleKey(roleWord, null);

        if (race || role) {
            return {
                ...(race ? { race } : {}),
                ...(role ? { role } : {}),
                ...(level ? { level } : {})
            };
        }
    }

    return null;
}

/**
 * 種族・職業・レベルから確定内在能力・耐性のマップを計算
 * オブジェクト形式 { race, role, level } または 引数 (race, role, level) の両方に対応
 * @param {Object|string} arg1 
 * @param {string} [arg2] 
 * @param {number} [arg3] 
 * @returns {Record<string, boolean>} 確定内在耐性マップ
 */
export function calculateInnateResistances(arg1 = {}, arg2, arg3) {
    let race = 'human';
    let role = 'archeologist';
    let level = 1;

    if (typeof arg1 === 'object' && arg1 !== null) {
        race = arg1.race ?? 'human';
        role = arg1.role ?? 'archeologist';
        level = arg1.level ?? 1;
    } else {
        race = arg1 ?? 'human';
        role = arg2 ?? 'archeologist';
        level = arg3 ?? 1;
    }

    const raceKey = resolveRaceKey(race, null);
    const roleKey = resolveRoleKey(role, null);
    const ulevel = Math.max(1, parseInt(level, 10) || 1);

    const result = {};

    // 1. 種族による獲得能力
    const raceDef = RACE_KNOWLEDGE_MAP[raceKey];
    if (raceDef && Array.isArray(raceDef.abilities)) {
        for (const item of raceDef.abilities) {
            if (ulevel >= item.level) {
                result[item.ability] = true;
            }
        }
    }

    // 2. 職業による獲得能力
    const roleDef = ROLE_KNOWLEDGE_MAP[roleKey];
    if (roleDef && Array.isArray(roleDef.abilities)) {
        for (const item of roleDef.abilities) {
            if (ulevel >= item.level) {
                result[item.ability] = true;
            }
        }
    }

    return result;
}

/**
 * 属性 (Alignment) マスターデータ (SSOT)
 */
export const ALIGNMENT_KNOWLEDGE_MAP = {
    lawful: {
        id: 'lawful',
        name: 'Lawful',
        nameJa: '秩序',
        tags: {
            ja: ['法と名誉', '神聖'],
            en: ['Honor & Law', 'Holy']
        },
        description: {
            ja: '法と正義、名誉を重んじる陣営。多くの正統な騎士や僧侶が属する。',
            en: 'Values order, honor, and righteousness. Favored by knights and clerics.'
        }
    },
    neutral: {
        id: 'neutral',
        name: 'Neutral',
        nameJa: '中立',
        tags: {
            ja: ['調和と自然', 'バランス'],
            en: ['Balance & Nature', 'Equilibrium']
        },
        description: {
            ja: '善悪や法の偏りを排し、自然と宇宙の調和を保つ陣営。',
            en: 'Maintains universal balance and natural harmony without bias.'
        }
    },
    chaotic: {
        id: 'chaotic',
        name: 'Chaotic',
        nameJa: '混沌',
        tags: {
            ja: ['自由と衝動', '変革'],
            en: ['Freedom & Impulse', 'Chaos']
        },
        description: {
            ja: '掟に縛られず、個人の自由と本能、変革を追求する陣営。',
            en: 'Follows individual liberty, unpredictability, and personal impulse.'
        }
    }
};

/**
 * 性別 (Gender) マスターデータ (SSOT)
 */
export const GENDER_KNOWLEDGE_MAP = {
    male: {
        id: 'male',
        name: 'Male',
        nameJa: '男性',
        tags: {
            ja: ['男'],
            en: ['Male']
        },
        description: {
            ja: '男性キャラクター。',
            en: 'Male character.'
        }
    },
    female: {
        id: 'female',
        name: 'Female',
        nameJa: '女性',
        tags: {
            ja: ['女'],
            en: ['Female']
        },
        description: {
            ja: '女性キャラクター。ワルキューレの必須条件。',
            en: 'Female character. Required for Valkyrie.'
        }
    }
};

/**
 * 任意の属性文字列から正規化された属性キー ('lawful'|'neutral'|'chaotic') を解決
 * @param {string} alignStr 
 * @param {string} [defaultVal='neutral']
 * @returns {string}
 */
export function resolveAlignmentKey(alignStr, defaultVal = 'neutral') {
    if (!alignStr || typeof alignStr !== 'string') return defaultVal;
    const lower = alignStr.toLowerCase().trim();
    if (lower.startsWith('law') || lower.includes('秩序')) return 'lawful';
    if (lower.startsWith('neu') || lower.includes('中立')) return 'neutral';
    if (lower.startsWith('cha') || lower.includes('混沌')) return 'chaotic';
    return defaultVal;
}

/**
 * 任意の性別文字列から正規化された性別キー ('male'|'female') を解決
 * @param {string} genderStr 
 * @param {string} [defaultVal='male']
 * @returns {string}
 */
export function resolveGenderKey(genderStr, defaultVal = 'male') {
    if (!genderStr || typeof genderStr !== 'string') return defaultVal;
    const lower = genderStr.toLowerCase().trim();
    if (lower.startsWith('fem') || lower.includes('女')) return 'female';
    if (lower.startsWith('mal') || lower.includes('男')) return 'male';
    return defaultVal;
}

/**
 * 職業ナレッジの取得
 * @param {string} roleStr 
 * @returns {Object|null}
 */
export function getRoleKnowledge(roleStr) {
    const key = resolveRoleKey(roleStr, null);
    return key ? ROLE_KNOWLEDGE_MAP[key] : null;
}

/**
 * 種族ナレッジの取得
 * @param {string} raceStr 
 * @returns {Object|null}
 */
export function getRaceKnowledge(raceStr) {
    const key = resolveRaceKey(raceStr, null);
    return key ? RACE_KNOWLEDGE_MAP[key] : null;
}

/**
 * 属性ナレッジの取得
 * @param {string} alignStr 
 * @returns {Object|null}
 */
export function getAlignmentKnowledge(alignStr) {
    const key = resolveAlignmentKey(alignStr, null);
    return key ? ALIGNMENT_KNOWLEDGE_MAP[key] : null;
}

/**
 * 性別ナレッジの取得
 * @param {string} genderStr 
 * @returns {Object|null}
 */
export function getGenderKnowledge(genderStr) {
    const key = resolveGenderKey(genderStr, null);
    return key ? GENDER_KNOWLEDGE_MAP[key] : null;
}

/**
 * キャラクタ選択カード表示用バッジリストを取得
 * @param {'role'|'race'|'gender'|'align'|'alignment'} category 
 * @param {string} keyStr 
 * @param {'ja'|'en'} [lang='ja']
 * @returns {Array<{ label: string, type: 'constraint'|'trait' }>}
 */
export function getCharacterBadges(category, keyStr, lang = 'ja') {
    const badges = [];
    const isJa = lang === 'ja';

    if (category === 'role') {
        const role = getRoleKnowledge(keyStr);
        if (!role) return [];

        // 1. 制約バッジ (constraints)
        if (role.allowedGenders && role.allowedGenders.length === 1) {
            const g = role.allowedGenders[0];
            badges.push({
                type: 'constraint',
                label: isJa ? (g === 'female' ? '女性限定' : '男性限定') : (g === 'female' ? 'Female only' : 'Male only')
            });
        }
        if (role.allowedRaces && role.allowedRaces.length === 1) {
            const r = role.allowedRaces[0];
            const rName = isJa ? (RACE_KNOWLEDGE_MAP[r]?.nameJa || r) : (RACE_KNOWLEDGE_MAP[r]?.name || r);
            badges.push({
                type: 'constraint',
                label: isJa ? `${rName}限定` : `${rName} only`
            });
        }
        if (role.allowedAlignments && role.allowedAlignments.length === 1) {
            const a = role.allowedAlignments[0];
            const aName = isJa ? (ALIGNMENT_KNOWLEDGE_MAP[a]?.nameJa || a) : (ALIGNMENT_KNOWLEDGE_MAP[a]?.name || a);
            badges.push({
                type: 'constraint',
                label: isJa ? `${aName}固定` : `${aName} only`
            });
        }

        // 2. 特徴バッジ (traits / tags)
        if (role.tags) {
            const tagList = isJa ? (role.tags.ja || []) : (role.tags.en || []);
            tagList.forEach(t => {
                if (!badges.some(b => b.label === t)) {
                    badges.push({
                        type: 'trait',
                        label: t
                    });
                }
            });
        }
    } else if (category === 'race') {
        const race = getRaceKnowledge(keyStr);
        if (!race) return [];

        // 1. 制約バッジ
        if (race.allowedAlignments && race.allowedAlignments.length === 1) {
            const a = race.allowedAlignments[0];
            const aName = isJa ? (ALIGNMENT_KNOWLEDGE_MAP[a]?.nameJa || a) : (ALIGNMENT_KNOWLEDGE_MAP[a]?.name || a);
            badges.push({
                type: 'constraint',
                label: isJa ? `${aName}固定` : `${aName} only`
            });
        }

        // 2. 特徴バッジ (tags)
        if (race.tags) {
            const tagList = isJa ? (race.tags.ja || []) : (race.tags.en || []);
            tagList.forEach(t => {
                if (!badges.some(b => b.label === t)) {
                    badges.push({
                        type: 'trait',
                        label: t
                    });
                }
            });
        }
    } else if (category === 'align' || category === 'alignment') {
        const align = getAlignmentKnowledge(keyStr);
        if (align && align.tags) {
            const tagList = isJa ? (align.tags.ja || []) : (align.tags.en || []);
            tagList.forEach(t => {
                badges.push({ type: 'trait', label: t });
            });
        }
    } else if (category === 'gender') {
        const gender = getGenderKnowledge(keyStr);
        if (gender && gender.tags) {
            const tagList = isJa ? (gender.tags.ja || []) : (gender.tags.en || []);
            tagList.forEach(t => {
                badges.push({ type: 'trait', label: t });
            });
        }
    }

    return badges;
}
