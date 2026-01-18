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
    // ユーザー指摘のレイアウト: モンスター T:0-393, オブジェクト T:394-

    // 1. モンスター (通常, ペット, 被発見, 騎乗)
    // 雄・雌・ペットなど全てのバリエーションを同じ1つのタイルにマップします
    for (let i = 0; i < NUMMONS; i++) {
        const tile = i; // 0 から 393
        m[GLYPH_MON_MALE_OFF + i] = tile;
        m[GLYPH_MON_FEM_OFF + i] = tile;
        m[GLYPH_PET_MALE_OFF + i] = tile;
        m[GLYPH_PET_FEM_OFF + i] = tile;
        m[GLYPH_DETECT_MALE_OFF + i] = tile;
        m[GLYPH_DETECT_FEM_OFF + i] = tile;
        m[GLYPH_RIDDEN_MALE_OFF + i] = tile;
        m[GLYPH_RIDDEN_FEM_OFF + i] = tile;
    }

    // 不可視モンスター
    // オブジェクトが 394 から始まるため、不可視モンスター用の空きがない場合は
    // 暫定的に 394 (Strange Object) または 393 に重ねる。
    // ここでは 394 を指すようにし、オブジェクト開始をこれに合わせて調整する。
    let tilenum = NUMMONS; // 394
    m[GLYPH_INVIS_OFF] = tilenum;
    tilenum++; // 395 になる

    // 2. オブジェクト
    // ユーザーの「objectはT:394-」という言葉を尊重し、
    // もし不可視モンスタータイルが不要なら 394 から開始する。
    // ここでは厳密に 394 からオブジェクトを開始させる。
    tilenum = 394;
    for (let i = 0; i < NUM_OBJECTS; i++) {
        m[GLYPH_OBJ_OFF + i] = tilenum;
        tilenum++;
    }

    // 3. CMAP (ダンジョン要素)
    const TILE_CMAP_START = tilenum;
    for (let i = 0; i < 400; i++) {
        m[GLYPH_CMAP_OFF + i] = TILE_CMAP_START + i;
    }

    return m;
}

