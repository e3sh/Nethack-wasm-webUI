/**
 * MONSTER_CLASS_KNOWLEDGE.js
 * NetHack 5.0 (3.7) 全モンスタークラス (シンボル分類) 構造化ナレッジ Single Source of Truth
 * 
 * NetHack の defsym.h / monst.c に基づくクラスシンボルごとの
 * 名称（日英）、危険度、代表モンスター、自己虐殺（Self-Genocide）即死危険種族を定義します。
 */

export const MONSTER_CLASS_DEFINITIONS = [
    { symbol: 'a', nameEn: 'ant or other insect', nameJa: 'アリ・昆虫一族', danger: 'NORMAL' },
    { symbol: 'b', nameEn: 'blob', nameJa: 'ブロッブ・スライム一族', danger: 'NORMAL' },
    { symbol: 'c', nameEn: 'cockatrice', nameJa: 'コカトリス一族 (石化)', danger: 'CRITICAL', descJa: '触れると石化即死。チカトリス・パイロリスク等', descEn: 'Chickatrice, Cockatrice, Pyrolisk' },
    { symbol: 'd', nameEn: 'dog or other canine', nameJa: '犬・ジャッカル・イヌ科', danger: 'NORMAL' },
    { symbol: 'e', nameEn: 'eye or sphere', nameJa: '目玉・球体一族 (麻痺眼)', danger: 'HIGH', descJa: '近接攻撃で長ターン麻痺。フローティングアイ等', descEn: 'Floating eye, Freezing sphere' },
    { symbol: 'f', nameEn: 'cat or other feline', nameJa: 'ネコ・ネコ科', danger: 'NORMAL' },
    { symbol: 'g', nameEn: 'gremlin', nameJa: 'グレムリン・ガーゴイル', danger: 'NORMAL' },
    { symbol: 'h', nameEn: 'humanoid', nameJa: '人型生物 (マインドフレイヤ含む)', danger: 'CRITICAL', raceTrap: 'dwarf', descJa: 'マインドフレイヤによる脳みそ吸引即死。※ドワーフ即死危険！', descEn: 'Mind flayer, Dwarf (⚠️ LETHAL for Dwarf!)' },
    { symbol: 'i', nameEn: 'imp or minor demon', nameJa: 'インプ・小悪魔一族', danger: 'NORMAL' },
    { symbol: 'j', nameEn: 'jelly', nameJa: 'ゼリー一族', danger: 'NORMAL' },
    { symbol: 'k', nameEn: 'kobold', nameJa: 'コボルド一族 (毒矢)', danger: 'NORMAL' },
    { symbol: 'l', nameEn: 'leprechaun', nameJa: 'レプラコーン (金貨盗み)', danger: 'NORMAL' },
    { symbol: 'm', nameEn: 'mimic', nameJa: 'ミミック (擬態)', danger: 'NORMAL' },
    { symbol: 'n', nameEn: 'nymph', nameJa: 'ニンフ (アイテム盗み・脱がし)', danger: 'HIGH' },
    { symbol: 'o', nameEn: 'orc', nameJa: 'オーク一族', danger: 'NORMAL', raceTrap: 'orc', descJa: 'オークの大群。※オーク即死危険！', descEn: 'Orcs (⚠️ LETHAL for Orc!)' },
    { symbol: 'p', nameEn: 'piercer', nameJa: 'ピアサー (落下岩天井)', danger: 'NORMAL' },
    { symbol: 'q', nameEn: 'quadruped', nameJa: '四足獣・大型草食獣 (ムーマク等)', danger: 'NORMAL' },
    { symbol: 'r', nameEn: 'rodent', nameJa: 'げっ歯類 (ネズミ一族)', danger: 'NORMAL' },
    { symbol: 's', nameEn: 'arachnid or centipede', nameJa: 'クモ・ムカデ・節足動物', danger: 'NORMAL' },
    { symbol: 't', nameEn: 'trapper or lurker above', nameJa: 'トラッパー・ラーカー (床天井擬態)', danger: 'NORMAL' },
    { symbol: 'u', nameEn: 'unicorn or horse', nameJa: 'ユニコーン・ウマ', danger: 'NORMAL' },
    { symbol: 'v', nameEn: 'vortex', nameJa: 'ボルテックス (渦・元素の嵐)', danger: 'NORMAL' },
    { symbol: 'w', nameEn: 'worm', nameJa: 'ワーム (イモムシ・長虫・紫ワーム呑み込み)', danger: 'HIGH' },
    { symbol: 'x', nameEn: 'xan or other mythical insect', nameJa: 'ザン・架空昆虫 (傷口感染)', danger: 'NORMAL' },
    { symbol: 'y', nameEn: 'light', nameJa: '光・ライト一族 (目眩まし)', danger: 'NORMAL' },
    { symbol: 'z', nameEn: 'zruty', nameJa: 'ズルティ', danger: 'NORMAL' },
    { symbol: 'A', nameEn: 'angelic being', nameJa: '天使・神聖生物', danger: 'HIGH' },
    { symbol: 'B', nameEn: 'bat or bird', nameJa: 'コウモリ・鳥類 (カラス)', danger: 'NORMAL' },
    { symbol: 'C', nameEn: 'centaur', nameJa: 'ケンタウロス一族 (遠距離射手)', danger: 'HIGH' },
    { symbol: 'D', nameEn: 'dragon', nameJa: 'ドラゴン一族 (各種ブレス・巨躯)', danger: 'HIGH', descJa: '各種ブレス・強力な打撃。ドラゴンの大群', descEn: 'Adult dragons of all colors' },
    { symbol: 'E', nameEn: 'elemental', nameJa: 'エレメンタル・元素精霊 (ストーカー含む)', danger: 'NORMAL' },
    { symbol: 'F', nameEn: 'fungus or mold', nameJa: '菌類・モールド・カビ', danger: 'NORMAL' },
    { symbol: 'G', nameEn: 'gnome', nameJa: 'ノーム一族', danger: 'NORMAL', raceTrap: 'gnome', descJa: 'ノームの鉱山住民。※ノーム即死危険！', descEn: 'Gnomes (⚠️ LETHAL for Gnome!)' },
    { symbol: 'H', nameEn: 'giant humanoid', nameJa: '巨人・大型人型生物 (タイタン等)', danger: 'HIGH' },
    { symbol: 'J', nameEn: 'jabberwock', nameJa: 'ジャバウォック (高打撃力)', danger: 'HIGH' },
    { symbol: 'K', nameEn: 'Keystone Kop', nameJa: 'キーストン・コップ (万引き警官)', danger: 'NORMAL' },
    { symbol: 'L', nameEn: 'lich', nameJa: 'リッチ一族 (最凶詠唱者)', danger: 'CRITICAL', descJa: '最凶の魔法詠唱者。マスターリッチ・アーチリッチ等。召喚・破壊魔法', descEn: 'Lich, Demilich, Master Lich, Arch-Lich' },
    { symbol: 'M', nameEn: 'mummy', nameJa: 'マミー・ミイラ一族', danger: 'NORMAL' },
    { symbol: 'N', nameEn: 'naga', nameJa: 'ナガ一族', danger: 'NORMAL' },
    { symbol: 'O', nameEn: 'ogre', nameJa: 'オーガ一族', danger: 'NORMAL' },
    { symbol: 'P', nameEn: 'pudding or ooze', nameJa: 'プリン・オオズ (武器分裂・酸)', danger: 'NORMAL', descJa: '武器で分裂する黒プリン・茶色プリン', descEn: 'Black pudding, Brown pudding' },
    { symbol: 'Q', nameEn: 'quantum mechanic', nameJa: '量子力学者・遺伝子工学者 (瞬間移動・変異)', danger: 'NORMAL' },
    { symbol: 'R', nameEn: 'rust monster or disenchanter', nameJa: 'サビ怪物・ディスエンチャンター', danger: 'CRITICAL', descJa: '装備腐食・強化値吸収。大切な武具を劣化させる厄介者', descEn: 'Rust monster, Disenchanter' },
    { symbol: 'S', nameEn: 'snake', nameJa: 'ヘビ一族 (毒)', danger: 'NORMAL' },
    { symbol: 'T', nameEn: 'troll', nameJa: 'トロール一族 (再生不死)', danger: 'MEDIUM', descJa: '死んでも復活する強靭な再生力', descEn: 'Troll, Ice troll, Olog-hai' },
    { symbol: 'U', nameEn: 'umber hulk', nameJa: 'アンバーハルク (混乱の瞳)', danger: 'HIGH', descJa: '視線による混乱。壁掘り奇襲', descEn: 'Umber hulk' },
    { symbol: 'V', nameEn: 'vampire', nameJa: '吸血鬼・ヴァンパイア一族 (生命力吸収)', danger: 'HIGH' },
    { symbol: 'W', nameEn: 'wraith', nameJa: 'レイス・幽鬼一族', danger: 'NORMAL' },
    { symbol: 'X', nameEn: 'xorn', nameJa: 'ゾーン (壁抜け・岩喰い)', danger: 'NORMAL' },
    { symbol: 'Y', nameEn: 'apelike creature', nameJa: '類人猿・イエティ・サル', danger: 'NORMAL' },
    { symbol: 'Z', nameEn: 'zombie', nameJa: 'ゾンビ・死体兵', danger: 'NORMAL' },
    { symbol: '@', nameEn: 'human or elf', nameJa: '人間・エルフ (プレイヤー同族・店主)', danger: 'EXTREME_TRAP', raceTrap: ['human', 'elf'], descJa: '⚠️ 人間・エルフ即死！ 店主全滅による店舗崩壊', descEn: 'Human, Elf, Shopkeeper (⚠️ LETHAL for Human/Elf!)' },
    { symbol: ' ', nameEn: 'ghost', nameJa: 'ゴースト・幽霊', danger: 'NORMAL' },
    { symbol: '\'', nameEn: 'golem', nameJa: 'ゴーレム一族', danger: 'NORMAL' },
    { symbol: '&', nameEn: 'major demon', nameJa: '大悪魔・上級デーモン', danger: 'CRITICAL', descJa: '強大な悪魔一族。バルログ・ピットフィーンド等', descEn: 'Major Demons, Pit Fiend, Balrog' },
    { symbol: ';', nameEn: 'sea monster', nameJa: '海の怪物・水棲生物 (巻きつき即死)', danger: 'HIGH', descJa: 'クラーケン・電気ウナギ等。巻きつき・引きずり込み水没即死', descEn: 'Kraken, Electric eel, Giant eel' },
    { symbol: ':', nameEn: 'lizard', nameJa: 'トカゲ・爬虫類', danger: 'NORMAL' },
    { symbol: '~', nameEn: 'long worm tail', nameJa: 'ロングワームの尾', danger: 'NORMAL' }
];

export const MONSTER_CLASS_MAP = new Map();
for (const cls of MONSTER_CLASS_DEFINITIONS) {
    MONSTER_CLASS_MAP.set(cls.symbol, cls);
}

/**
 * シンボル記号からモンスタークラス定義を取得
 * @param {string} symbol 
 * @returns {Object|null}
 */
export function getMonsterClassDefinition(symbol) {
    if (!symbol || typeof symbol !== 'string') return null;
    return MONSTER_CLASS_MAP.get(symbol) || null;
}

/**
 * 全モンスタークラス定義一覧を取得
 * @returns {Array<Object>}
 */
export function getAllMonsterClassDefinitions() {
    return MONSTER_CLASS_DEFINITIONS;
}
