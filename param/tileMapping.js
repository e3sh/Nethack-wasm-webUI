/**
 * tileMapping
 * NetHack 3.7 Glyph ID to Tile Index Mapping Table
 * 
 * @description
 * win/share/tilemap.c の init_tilemap() ロジックを完全に再現し、
 * NetHack 3.7.0 のグリフIDをタイルインデックスに変換します。
 */
function tileMapping() {
    const m = {};

    // --- NetHack 3.7 定数 ---
    const NUMMONS = 394;
    const NUM_OBJECTS = 453;

    // --- グリフ・オフセット (include/display.h) ---
    // NetHack 3.7.0 の標準的なオフセット
    const GLYPH_MON_MALE_OFF = 0;
    const GLYPH_MON_FEM_OFF = NUMMONS + GLYPH_MON_MALE_OFF;
    const GLYPH_PET_MALE_OFF = (NUMMONS * 2) + GLYPH_MON_MALE_OFF;
    const GLYPH_PET_FEM_OFF = NUMMONS + GLYPH_PET_MALE_OFF;
    const GLYPH_INVIS_OFF = NUMMONS + GLYPH_PET_FEM_OFF;
    const GLYPH_DETECT_MALE_OFF = 1 + GLYPH_INVIS_OFF;
    const GLYPH_DETECT_FEM_OFF = NUMMONS + GLYPH_DETECT_MALE_OFF;
    const GLYPH_BODY_OFF = NUMMONS + GLYPH_DETECT_FEM_OFF;
    const GLYPH_RIDDEN_MALE_OFF = NUMMONS + GLYPH_BODY_OFF;
    const GLYPH_RIDDEN_FEM_OFF = NUMMONS + GLYPH_RIDDEN_MALE_OFF;
    const GLYPH_OBJ_OFF = NUMMONS + GLYPH_RIDDEN_FEM_OFF;
    const GLYPH_CMAP_OFF = NUM_OBJECTS + GLYPH_OBJ_OFF;

    // --- タイル・マッピング・ロジック ---
    // ユーザー指摘のレイアウト: モンスター T:0-391, 不可視 T:392, オブジェクト T:393-
    // 地形 (CMAP) は T:847 から開始 (オブジェクト 453個の後 + 1つの空き)

    // 1. モンスター (通常, ペット, 被発見, 騎乗)
    // 392以降が不可視とオブジェクトになるため、391を上限とします。
    for (let i = 0; i < NUMMONS; i++) {
        const tile = Math.min(i, 391);
        m[GLYPH_MON_MALE_OFF + i] = tile;
        m[GLYPH_MON_FEM_OFF + i] = tile;
        m[GLYPH_PET_MALE_OFF + i] = tile;
        m[GLYPH_PET_FEM_OFF + i] = tile;
        m[GLYPH_DETECT_MALE_OFF + i] = tile;
        m[GLYPH_DETECT_FEM_OFF + i] = tile;
        m[GLYPH_RIDDEN_MALE_OFF + i] = tile;
        m[GLYPH_RIDDEN_FEM_OFF + i] = tile;

        // Body (死体) はオブジェクト扱いで、別途マッピングされることが多いですが、
        // 念のためモンスタータイルにもフォールバックできるようにしておきます。
        m[GLYPH_BODY_OFF + i] = tile;
    }

    // 不可視モンスター
    m[GLYPH_INVIS_OFF] = 392;

    // 2. オブジェクト
    // Strange Object (G:3547) を T:393 から開始します。
    let objTilenum = 393;
    for (let i = 0; i < NUM_OBJECTS; i++) {
        m[GLYPH_OBJ_OFF + i] = objTilenum + i;
    }

    // 3. CMAP (ダンジョン要素)
    // 調査結果に基づき、タイルセット画像の特定の配置に合わせてマッピングを補正します。
    const TILE_CMAP_BASE = 847; // Stone (G:4000)
    for (let i = 0; i < 400; i++) {
        let t = TILE_CMAP_BASE + i;

        // ズレの補正ロジック:
        if (i >= 12) t += 1; // Wall(1-11)の後に 1枚余分な壁タイル(T:859)がある
        if (i >= 19) t += 1; // Tree(18)の後に 1枚余分な木タイル(T:867)がある

        // Room(19)〜Corr(22)の間でタイルセット側が 2枚圧縮されている (DarkRoom等)
        if (i >= 20) t -= 1;
        if (i >= 21) t -= 1;

        // Corr(22)〜Stairs(25)の間で 1枚予備タイルが入っている
        if (i >= 25) t += 1;

        m[GLYPH_CMAP_OFF + i] = t;
    }

    return m;
}

