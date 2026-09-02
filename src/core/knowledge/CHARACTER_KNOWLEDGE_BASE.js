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
        abilities: []
    },
    dwarf: {
        id: 'dwarf',
        name: 'Dwarf',
        nameJa: 'ドワーフ',
        abilities: [
            { level: 1, ability: 'infravision' } // 暗視
        ]
    },
    elf: {
        id: 'elf',
        name: 'Elf',
        nameJa: 'エルフ',
        abilities: [
            { level: 1, ability: 'infravision' }, // 暗視
            { level: 4, ability: 'sleep' }        // 睡眠耐性
        ]
    },
    gnome: {
        id: 'gnome',
        name: 'Gnome',
        nameJa: 'ノーグ/ノーム',
        abilities: [
            { level: 1, ability: 'infravision' } // 暗視
        ]
    },
    orc: {
        id: 'orc',
        name: 'Orc',
        nameJa: 'オーク',
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['male', 'female'],
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
        allowedGenders: ['female'], // 女性限定
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
        allowedGenders: ['male', 'female'],
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
