/**
 * OBJECT_APPEARANCE_DICT.js
 * NetHack 5.0 未識別アイテム外見名（oc_descr）の日英辞書およびシャッフル区分定義 (SSOT)
 *
 * 参照仕様:
 * - NetHack 5.0 src/o_init.c (obj_shuffle_range, shuffle_all, randomize_gem_colors)
 * - docs/5_gamedata/appearances.ja.md
 * - docs/5_gamedata/glyph_tile_mapping.ja.md
 */

// 外見の形容詞（色・素材・状態）に対する日本語辞書
export const APPEARANCE_DESCR_JA = {
    // 薬 (Potions)
    'ruby': 'ルビー色の',
    'pink': 'ピンク色の',
    'orange': 'オレンジ色の',
    'yellow': '黄色の',
    'emerald': 'エメラルド色の',
    'dark green': '濃い緑色の',
    'cyan': 'シアン色の',
    'sky blue': '空色の',
    'brilliant blue': '鮮やかな青色の',
    'magenta': 'マゼンタ色の',
    'purple-red': '赤紫色の',
    'puce': '暗褐色の',
    'milky': '乳白色の',
    'swirly': '渦巻いた',
    'bubbly': '泡立つ',
    'smoky': '煙った',
    'cloudy': '濁った',
    'effervescent': '弾ける',
    'black': '黒色の',
    'golden': '金色の',
    'brown': '茶色の',
    'fizzy': 'シュワシュワする',
    'dark': '暗い色の',
    'white': '白色の',
    'murky': '濁った',
    'clear': '透明な',
    // 杖 (Wands)
    'glass': 'ガラスの',
    'balsa': 'バルサ材の',
    'crystal': '水晶の',
    'maple': 'カエデの',
    'pine': '松の',
    'oak': '樫の',
    'ebony': '黒檀の',
    'marble': '大理石の',
    'tin': '錫の',
    'brass': '真鍮の',
    'copper': '銅の',
    'silver': '銀の',
    'platinum': '白金の',
    'iridium': 'イリジウムの',
    'zinc': '亜鉛の',
    'aluminum': 'アルミニウムの',
    'uranium': 'ウランの',
    'iron': '鉄の',
    'steel': '鋼鉄の',
    'hexagonal': '六角形の',
    'short': '短い',
    'runed': 'ルーンの刻まれた',
    'long': '長い',
    'curved': '曲がった',
    'forked': '二股の',
    'spiked': 'スパイク付きの',
    'jeweled': '宝石付きの',
    'redwood': 'セコイア材の',
    // 指輪 (Rings)
    'wooden': '木製の',
    'granite': '花崗岩の',
    'opal': 'オパールの',
    'clay': '粘土の',
    'coral': '珊瑚の',
    'black onyx': 'ブラックオニキスの',
    'moonstone': 'ムーンストーンの',
    'tiger eye': 'タイガーアイの',
    'jade': '翡翠の',
    'bronze': '青銅の',
    'agate': '瑪瑙の',
    'topaz': 'トパーズの',
    'sapphire': 'サファイアの',
    'diamond': 'ダイヤモンドの',
    'pearl': '真珠の',
    'twisted': 'ねじれた',
    'gold': '金の',
    'ivory': '象牙の',
    'wire': '針金の',
    'engagement': '婚約の',
    'shiny': '輝く',
    // アミュレット (Amulets)
    'circular': '円形の',
    'spherical': '球体の',
    'oval': '楕円形の',
    'triangular': '三角形の',
    'pyramidal': 'ピラミッド型の',
    'square': '四角形の',
    'concave': '凹型の',
    'octagonal': '八角形の',
    'perforated': '穴の空いた',
    'cubical': '立方体の',
    // 魔法書 (Spellbooks)
    'parchment': '羊皮紙の',
    'vellum': '上質皮紙の',
    'ragged': 'ボロボロの',
    'dog eared': '耳折れの',
    'mottled': 'まだらな',
    'stained': '汚れた',
    'cloth': '布の',
    'leathery': '革の',
    'red': '赤の',
    'velvet': 'ベルベットの',
    'light green': '明るい緑の',
    'turquoise': 'ターコイズの',
    'light blue': '明るい青の',
    'dark blue': '濃い青の',
    'indigo': '藍色の',
    'purple': '紫の',
    'violet': 'スミレ色の',
    'tan': '黄褐色の',
    'plaid': '格子縞の',
    'light brown': '明るい茶色の',
    'dark brown': '濃い茶色の',
    'gray': '灰色の',
    'wrinkled': 'しわくちゃの',
    'dusty': '埃っぽい',
    'glittering': 'きらめく',
    'shining': '光り輝く',
    'dull': '鈍い色の',
    'thin': '薄い',
    'thick': '厚い',
    'checkered': '市松模様の',
    'paperback': 'ペーパーバックの',
    'papyrus': 'パピルスの',
    'plain': '無地の',
    // 巻物 (Scrolls: 特殊固定外見)
    'stamped': '切手の貼られた',
    'unlabeled': '白紙の',
    // 宝石・石 (Gems/Stones)
    'blue': '青色の',
    'green': '緑色の',
    'yellowish brown': '黄褐色の'
};

// 防具・武器・道具・宝石の完全外見名に対する日本語辞書
export const APPEARANCE_NOUN_JA = {
    // 防具: 兜 (Helmets)
    'leather hat': '革の帽子',
    'iron skull cap': '鉄のどてら帽',
    'hard hat': '安全ヘルメット',
    'conical hat': '円錐形の帽子',
    'plumed helmet': '羽飾りの兜',
    'etched helmet': 'エッチングされた兜',
    'crested helmet': '前立てのある兜',
    'visored helmet': '面頬付きの兜',
    'crystal helmet': '水晶の兜',
    'dented pot': 'へこんだ鍋',
    // 防具: 外套 (Cloaks)
    'faded pall': '色あせた覆い',
    'coarse mantelet': '粗い外衣',
    'hooded cloak': 'フード付き外套',
    'slippery cloak': '滑りやすい外套',
    'apron': 'エプロン',
    'tattered cape': 'ぼろぼろのケープ',
    'opera cloak': 'オペラマント',
    'ornamental cope': '装飾的な典礼用マント',
    'piece of cloth': '布切れ',
    // 防具: 鎧・盾 (Mail & Shields)
    'crude chain mail': '粗末なチェインメイル',
    'crude ring mail': '粗末なリングメイル',
    'wooden shield': '木製の盾',
    'blue and green shield': '青と緑の盾',
    'white-handed shield': '白い手のついた盾',
    'red-eyed shield': '赤い目のついた盾',
    'large round shield': '大きな円形の盾',
    'polished silver shield': '磨かれた銀の盾',
    // 防具: 手袋 (Gloves)
    'old gloves': '古い手袋',
    'padded gloves': 'パッド入りの手袋',
    'riding gloves': '乗馬用の手袋',
    'fencing gloves': 'フェンシング用の手袋',
    // 防具: 靴 (Boots)
    'walking shoes': 'ウォーキングシューズ',
    'hard shoes': '固い靴',
    'jackboots': '長靴',
    'combat boots': 'コンバットブーツ',
    'jungle boots': 'ジャングルブーツ',
    'hiking boots': 'ハイキングブーツ',
    'mud boots': '泥靴',
    'buckled boots': 'バックル付きの靴',
    'riding boots': '乗馬靴',
    'snow boots': 'スノーブーツ',
    // 魔除け (Amulets: 固定外見)
    'amulet of yendor': 'イェンダーの魔除け',
    // 道具 (Tools)
    'bag': '袋',
    'key': '鍵',
    'candle': '蝋燭',
    'lamp': 'ランプ',
    'oil lamp': '油灯',
    'brass lantern': '真鍮のランタン',
    'looking glass': '手鏡',
    'glass orb': 'ガラスの球',
    'whistle': '笛',
    'tin whistle': 'ブリキの笛',
    'flute': 'フルート',
    'wooden flute': '木製のフルート',
    'horn': '角笛',
    'tooled horn': '細工された角笛',
    'harp': '竪琴',
    'wooden harp': '木製の竪琴',
    'drum': '太鼓',
    'leather drum': '革の太鼓',
    'bell': '鈴',
    'silver bell': '銀の鈴',
    'candelabrum': '燭台',
    // 武器 (Weapons)
    'crude arrow': '粗末な矢',
    'runed arrow': 'ルーンの刻まれた矢',
    'bamboo arrow': '竹製の矢',
    'crude dagger': '粗末な短剣',
    'runed dagger': 'ルーンの刻まれた短剣',
    'crude short sword': '粗末なショートソード',
    'broad short sword': '幅広のショートソード',
    'runed short sword': 'ルーンの刻まれたショートソード',
    'crude broadsword': '粗末なブロードソード',
    'runed broadsword': 'ルーンの刻まれたブロードソード',
    'curved sword': '曲刀',
    'samurai sword': '侍の刀',
    'long samurai sword': '侍の長刀',
    'double-headed axe': '両刃の斧',
    'crude spear': '粗末な槍',
    'runed spear': 'ルーンの刻まれた槍',
    'stout spear': '頑丈な槍',
    'throwing spear': '投げ槍',
    'crude bow': '粗末な弓',
    'runed bow': 'ルーンの刻まれた弓',
    'long bow': '長弓',
    'broad pick': '幅広のつるはし',
    'thonged club': '紐付きの棍棒',
    'staff': '杖',
    'throwing star': '星形の投げナイフ',
    'vulgar polearm': '低俗な長柄武器',
    'hilted polearm': '柄のある長柄武器',
    'forked polearm': '二股の長柄武器',
    'single-edged polearm': '片刃の長柄武器',
    'angled poleaxe': '角度のついた戦斧',
    'long poleaxe': '長い戦斧',
    'pole cleaver': '長柄の包丁',
    'pole sickle': '長柄の鎌',
    'pruning hook': '剪定用の鉤',
    'hooked polearm': '鉤のある長柄武器',
    'pronged polearm': '先の分かれた長柄武器',
    'beaked polearm': '嘴状の長柄武器',
    // 宝石・石 (Gems/Stones)
    'gray stone': '灰色の石',
    'white gem': '白色の宝石',
    'red gem': '赤色の宝石',
    'orange gem': 'オレンジ色の宝石',
    'blue gem': '青色の宝石',
    'black gem': '黒色の宝石',
    'green gem': '緑色の宝石',
    'yellow gem': '黄色の宝石',
    'yellowish brown gem': '黄褐色の宝石',
    'violet gem': 'スミレ色の宝石',
    // 毒液 (Venom)
    'splash of venom': '毒液の飛沫'
};

/**
 * 外見形容詞（色・素材・ラベル）とカテゴリから完全なアイテム外見名を合成
 * @param {string} descr
 * @param {string} category
 * @param {string} [lang='ja']
 * @returns {string}
 */
export function formatAppearanceNameStatic(descr, category, lang = 'ja') {
    const cat = (category || '').toUpperCase();
    const isEn = lang === 'en';

    if (!descr || descr.trim().length === 0 || descr.trim().toLowerCase() === 'unidentified') {
        if (cat === 'POTION') return isEn ? 'unidentified potion' : '未鑑定の薬';
        if (cat === 'WAND') return isEn ? 'unidentified wand' : '未鑑定の杖';
        if (cat === 'RING') return isEn ? 'unidentified ring' : '未鑑定の指輪';
        if (cat === 'SCROLL') return isEn ? 'unidentified scroll' : '未鑑定の巻物';
        if (cat === 'AMULET') return isEn ? 'unidentified amulet' : '未鑑定の魔除け';
        if (cat === 'SPELLBOOK') return isEn ? 'unidentified spellbook' : '未鑑定の魔法書';
        if (cat === 'ARMOR') return isEn ? 'unidentified armor' : '未鑑定の防具';
        if (cat === 'WEAPON') return isEn ? 'unidentified weapon' : '未鑑定の武器';
        if (cat === 'TOOL') return isEn ? 'unidentified tool' : '未鑑定の道具';
        if (cat === 'GEM' || cat === 'GEM_STONE') return isEn ? 'unidentified gem' : '未鑑定の宝石';
        return isEn ? `unidentified ${cat ? cat.toLowerCase() : 'item'}` : '未鑑定のアイテム';
    }

    const clean = descr.trim();
    const lower = clean.toLowerCase();

    const hasNoun = (
        /\bpotions?\b/i.test(lower) || lower.includes('薬') ||
        /\bwands?\b/i.test(lower) || lower.includes('杖') ||
        /\brings?\b/i.test(lower) || lower.includes('指輪') ||
        /\bscrolls?\b/i.test(lower) || lower.includes('巻物') ||
        /\bamulets?\b/i.test(lower) || lower.includes('魔除け') ||
        /\b(spellbooks?|books?)\b/i.test(lower) || lower.includes('魔法書')
    );
    if (hasNoun) {
        if (!isEn && APPEARANCE_NOUN_JA[lower]) {
            return APPEARANCE_NOUN_JA[lower];
        }
        return clean;
    }

    if (!isEn) {
        if (APPEARANCE_NOUN_JA[lower]) {
            return APPEARANCE_NOUN_JA[lower];
        }
        if ((cat === 'GEM' || cat === 'GEM_STONE') && lower === 'gray') {
            return '灰色の石';
        }
        if (cat === 'ARMOR' || cat === 'WEAPON' || cat === 'TOOL' || cat === 'CONTAINER') {
            return clean;
        }
        let jaAdj = APPEARANCE_DESCR_JA[lower];
        if (!jaAdj) {
            if (clean.endsWith('の') || clean.endsWith('色の')) {
                jaAdj = clean;
            } else {
                jaAdj = `${clean}の`;
            }
        }
        if (cat === 'POTION') return `${jaAdj}薬`;
        if (cat === 'WAND') return `${jaAdj}杖`;
        if (cat === 'RING') return `${jaAdj}指輪`;
        if (cat === 'SCROLL') {
            if (lower === 'stamped' || lower === 'unlabeled') {
                return `${jaAdj}巻物`;
            }
            return `「${clean}」と書かれた巻物`;
        }
        if (cat === 'AMULET') return `${jaAdj}魔除け`;
        if (cat === 'SPELLBOOK') return `${jaAdj}魔法書`;
        if (cat === 'GEM' || cat === 'GEM_STONE') return `${jaAdj}宝石`;
        return `${jaAdj}${cat.toLowerCase()}`;
    }

    if (cat === 'POTION') return `${clean} potion`;
    if (cat === 'WAND') return `${clean} wand`;
    if (cat === 'RING') return `${clean} ring`;
    if (cat === 'SCROLL') {
        if (lower === 'stamped' || lower === 'unlabeled') {
            return `${clean} scroll`;
        }
        return `scroll labeled ${clean}`;
    }
    if (cat === 'AMULET') return `${clean} amulet`;
    if (cat === 'SPELLBOOK') return `${clean} spellbook`;
    if (cat === 'ARMOR' || cat === 'WEAPON' || cat === 'TOOL' || cat === 'CONTAINER' || cat === 'VENOM') {
        return clean;
    }
    if (cat === 'GEM' || cat === 'GEM_STONE') {
        if (lower === 'gray' || lower === 'gray stone') return 'gray stone';
        if (lower.endsWith(' gem') || lower.endsWith(' stone') || lower.includes('glass')) return clean;
        return `${clean} gem`;
    }

    return clean;
}


/**
 * NetHack 5.0 Cコア (src/o_init.c: obj_shuffle_range / shuffle_all / randomize_gem_colors) に準拠する
 * シャッフルグループ定義テーブル
 */
export const OBJECT_SHUFFLE_RANGES = [
    {
        id: 'HELMET_4',
        lo: 97,
        hi: 100,
        itemLo: 97,
        itemHi: 100,
        labelJa: '鉄製兜 4種シャッフル (onum 97〜100)',
        labelEn: 'Shuffled Iron Helmets (4 types, onum 97-100)'
    },
    {
        id: 'CLOAK_4',
        lo: 146,
        hi: 149,
        itemLo: 146,
        itemHi: 149,
        labelJa: '魔法の外套 4種シャッフル (onum 146〜149)',
        labelEn: 'Shuffled Magical Cloaks (4 types, onum 146-149)'
    },
    {
        id: 'GLOVES_4',
        lo: 159,
        hi: 162,
        itemLo: 159,
        itemHi: 162,
        labelJa: '手袋 4種シャッフル (onum 159〜162)',
        labelEn: 'Shuffled Gloves (4 types, onum 159-162)'
    },
    {
        id: 'BOOTS_7',
        lo: 166,
        hi: 172,
        itemLo: 166,
        itemHi: 172,
        labelJa: '魔法の靴 7種シャッフル (onum 166〜172)',
        labelEn: 'Shuffled Magical Boots (7 types, onum 166-172)'
    },
    {
        id: 'RING_28',
        lo: 173,
        hi: 200,
        itemLo: 173,
        itemHi: 200,
        labelJa: '指輪 28種シャッフル (onum 173〜200)',
        labelEn: 'Shuffled Rings (28 types, onum 173-200)'
    },
    {
        id: 'AMULET_11',
        lo: 201,
        hi: 211,
        itemLo: 201,
        itemHi: 211,
        labelJa: '魔除け 11種シャッフル (onum 201〜211 ※イェンダー除く)',
        labelEn: 'Shuffled Amulets (11 types, onum 201-211, excl. Yendor)'
    },
    {
        id: 'POTION_25',
        lo: 297,
        hi: 321,
        itemLo: 297,
        itemHi: 321,
        labelJa: '薬 25種シャッフル (onum 297〜321 ※水は透明固定)',
        labelEn: 'Shuffled Potions (25 types, onum 297-321, excl. water)'
    },
    {
        id: 'SCROLL_41',
        lo: 323,
        hi: 363,
        itemLo: 323,
        itemHi: 343,
        labelJa: '巻物 21種 / ラベル候補 41種シャッフル (onum 323〜363)',
        labelEn: 'Shuffled Scrolls (21 scrolls across 41 labels, onum 323-363)'
    },
    {
        id: 'SPELLBOOK_41',
        lo: 366,
        hi: 406,
        itemLo: 366,
        itemHi: 406,
        labelJa: '魔法書 41種シャッフル (onum 366〜406 ※白紙・小説・死者の書除く)',
        labelEn: 'Shuffled Spellbooks (41 types, onum 366-406)'
    },
    {
        id: 'WAND_28',
        lo: 410,
        hi: 437,
        itemLo: 410,
        itemHi: 434,
        labelJa: '杖 25種 / 外見候補 28種シャッフル (onum 410〜437)',
        labelEn: 'Shuffled Wands (25 wands across 28 appearances, onum 410-437)'
    }
];

export const RANDOM_GEM_COLOR_RULES = {
    446: {
        id: 'GEM_TURQUOISE',
        colors: ['green', 'blue'],
        labelJa: '宝石色ランダム変動 (randomize_gem_colors): 緑色 (green) 50% / 青色 (blue) 50%',
        labelEn: 'Randomized Gem Color: green gem (50%) / blue gem (50%)'
    },
    448: {
        id: 'GEM_AQUAMARINE',
        colors: ['green', 'blue'],
        labelJa: '宝石色ランダム変動 (randomize_gem_colors): 緑色 (green) 50% / 青色 (blue) 50%',
        labelEn: 'Randomized Gem Color: green gem (50%) / blue gem (50%)'
    },
    457: {
        id: 'GEM_FLUORITE',
        colors: ['violet', 'blue', 'white', 'green'],
        labelJa: '宝石色ランダム変動 (randomize_gem_colors): スミレ色 (violet) / 青色 (blue) / 白色 (white) / 緑色 (green) 各25%',
        labelEn: 'Randomized Gem Color: violet / blue / white / green gem (25% each)'
    }
};
