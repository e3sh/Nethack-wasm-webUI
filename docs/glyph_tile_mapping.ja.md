# NetHack 5.0 グリフ・タイルマッピング技術解説

> [!IMPORTANT]
> このドキュメントは **NetHack 5.0.0 正式版** に準拠して更新されています。3.7開発版の情報は破棄されました。

NetHack 5.0 において、内部データ（グリフ）がどのようにタイルの索引（Tile Index）に変換され、画面上で描画されるかの仕組みについて解説します。

---

## 1. エンコードされたグリフ (\G 形式)

NetHack 5.0 では、ステータス行やメッセージなどで「アイコン付きテキスト」を表示するために、`\G` で始まる特殊な文字列を使用します。

**例: `\G210C0F2B:100`**

*   **`\G`**: エンコードされたグリフの開始記号。
*   **最初の4桁の16進数**: セキュリティ用のランダム値（セッションごとに変わることがあります）。
*   **次の4桁の16進数 (`0F2B`)**: グリフ番号 (Glyph Index) です。
    *   `0x0F2B` = 10進数で **3883**。所持金などのアイコンに使用されます。
*   **`:`**: グリフデータと実データの区切り。
*   **`100`**: 実際に表示される数値やテキスト（例：所持金）。

---

## 2. グリフ番号からタイルインデックスへの変換

NetHack 5.0 におけるグリフとタイルの関係は、カテゴリごとのオフセットによって管理されています。

### 主要な定数 (NetHack 5.0 正式版)
*   **NUMMONS**: **383** (モンスターの種類数)
*   **NUM_OBJECTS**: **481** (オブジェクトの種類数)
*   **MAX_GLYPH**: **9624** (全グリフ数)

### グリフとタイルのオフセット構造 (5.0 準拠)
内部的には `include/display.h` のオフセットと、`win/share/tilemap.c` のロジックによって以下のようにマップされます。

| グリフカテゴリ | グリフ開始オフセット | 対応するタイル (Tile Index) | 備考 |
| :--- | :--- | :--- | :--- |
| **Monsters (雄)** | `GLYPH_MON_MALE_OFF` (0) | `2 * mnum + (shifts * 2)` | モンスター番号 `mnum` と条件付きシフトの合計 |
| **Monsters (雌)** | `GLYPH_MON_FEM_OFF` (383) | `2 * mnum + 1 + (shifts * 2)` | 雄タイルの直後が雌タイルのペア |
| **Pets (雄)** | `GLYPH_PET_MALE_OFF` (766) | (Mon-M と同じ) | ペット表示用の雄タイル |
| **Pets (雌)** | `GLYPH_PET_FEM_OFF` (1149) | (Mon-F と同じ) | ペット表示用の雌タイル |
| **Invisible Mon** | `GLYPH_INVIS_OFF` (1532) | **788** (実測値) | 全モンスター(383種x2) + シフト(11種x2)の後 |
| **Detect (雄)** | `GLYPH_DETECT_MALE_OFF` (1533) | (Mon-M と同じ) | 被発見モンスター(雄) |
| **Detect (雌)** | `GLYPH_DETECT_FEM_OFF` (1916) | (Mon-F と同じ) | 被発見モンスター(雌) |
| **Body (死体等)** | `GLYPH_BODY_OFF` (2299) | (オブジェクト依存) | 死体はオブジェクトセクション (Tile 1272 以降) |
| **Ridden (雄)** | `GLYPH_RIDDEN_MALE_OFF` (2682) | (Mon-M と同じ) | 騎乗されているモンスター(雄) |
| **Ridden (雌)** | `GLYPH_RIDDEN_FEM_OFF` (3065) | (Mon-F と同じ) | 騎乗されているモンスター(雌) |
| **Objects** | `GLYPH_OBJ_OFF` (3448) | **789** (実測値) | 不可視モンスター(1タイル)の後 |
| **CMAP** | `GLYPH_CMAP_OFF` (3929) | **1272** (実測値) | 全オブジェクト(481枚) + オブジェクトシフト(2枚)の後 |
| **Zaps** | `GLYPH_ZAP_OFF` (4051) | **1350** (実測値) | 各種ビーム・光線エフェクト |
| **Swallows** | `GLYPH_SWALLOW_OFF` (4093) | **1392** (実測値) | 飲み込まれエフェクト |
| **Explodes** | `GLYPH_EXPLODE_OFF` (7157) | **1400** (実測値) | 爆発エフェクト |
| **Warnings** | `GLYPH_WARNING_OFF` (7220) | **1463** (実測値) | 警告表示タイル |
| **Unexplored** | `GLYPH_UNEXPLORED_OFF` (9622) | **1469** (実測値) | 未探索マップ領域 |
| **Nothing** | `GLYPH_NOTHING_OFF` (9623) | **1470** (実測値) | 何もない領域 |
| **Statues (雄)** | `GLYPH_STATUE_MALE_OFF` (7226) | **1515** (実測値) | 石像表示用のタイル (Mon-M + シフトに依存) |

---

## 3. 条件付きシフト (Conditional Shifts)

`tilemap.c` には、特定のモンスターやオブジェクトの後に「予備のタイル」や「特殊な置換タイル」を挿入するためのロジックがあります。このシフトを正確に再現しないと、それ以降のセクション（Objects や CMAP 等）の表示がずれることになります。

### モンスターセクションにおけるシフト (11箇所・計22タイル)
以下のモンスター（`mnum` は 0-indexed 番号）の直後に、雄・雌用の 2 タイル（シフト用）が挿入されます。これにより、それ以降のモンスタータイルのインデックスが +2 シフトします。

1.  `hell hound` (mnum = 26) -> 55, 56 に `Cerberus` を挿入
2.  `shocking sphere` (mnum = 31) -> 67, 68 に `beholder` を挿入
3.  `baby silver dragon` (mnum = 135) -> 277, 278 に `baby shimmering dragon` を挿入
4.  `silver dragon` (mnum = 145) -> 299, 300 に `shimmering dragon` を挿入
5.  `jabberwock` (mnum = 178) -> 367, 368 に `vorpal jabberwock` を挿入
6.  `vampire leader` (mnum = 227) -> 467, 468 に `vampire mage` を挿入
7.  `Croesus` (mnum = 286) -> 587, 588 に `Charon` を挿入
8.  `Shaman Karnov` (mnum = 346) -> 709, 710 に `Earendil` を挿入
9.  `Shaman Karnov` (mnum = 346) -> 711, 712 に `Elwing` を挿入 (連続して計4タイル分)
10. `Chromatic Dragon` (mnum = 359) -> 739, 740 に `Goblin King` を挿入
11. `neanderthal` (mnum = 371) -> 765, 766 に `High-elf` を挿入

### オブジェクトセクションにおけるシフト (2箇所・計2タイル)
以下のオブジェクト（`onum` は 0-indexed 番号）の直後に、1 タイルが挿入され、以降のインデックスが +1 シフトします。

1.  `silver dragon scale mail` (onum = 103) -> 104 に `shimmering dragon scale mail` を挿入
2.  `silver dragon scales` (onum = 113) -> 115 に `shimmering dragon scales` を挿入

---

## 4. UI マッピングファイル (tileMapping.js) の更新指針

Web-UI の表示テーブルを 5.0 に対応させるため、[tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/param/tileMapping.js) を以下のように修正します。

1.  `offsets` 定数の `NUMMONS: 383`、`NUM_OBJECTS: 481`、`MAX_GLYPH: 9624` に更新。
2.  `mon_conds` 配列を `[ 26, 31, 135, 145, 178, 227, 286, 346, 346, 359, 371 ]` に置き換え。
3.  `mon_conds_double` は 5.0 では不要なため空配列 `[]` または削除。
4.  `obj_conds` 配列を `[ 103, 113 ]` に置き換え。
5.  `obj_conds_del` は 5.0 では不要なため空配列 `[]` または削除。
6.  各種 Other セクションの開始タイルインデックス（Zaps: 1350, Swallows: 1392, Explodes: 1400, Warnings: 1463）を反映。

---

## 参考ファイル
*   `include/display.h`: グリフ・オフセット定義
*   `win/share/tilemap.c`: タイルマッピングのロジック
*   `docs/tilemappings.lst`: 生成された正確なマッピングデータの一覧
*   `Release/param/tileMapping.js`: マッピングテーブル定義
