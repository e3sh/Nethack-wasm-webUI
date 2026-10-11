---
title: glyph_tile_mapping.ja
status: active
last_updated: 2026-10-11
related_code:
  - src/driver/tileMapping.js
  - src/driver/shim/shim_bridge.c
  - src/core/knowledge/state/DiscoveryStateManager.js
  - param/tileMapping.js
---

# NetHack 5.0 グリフ・タイルマッピング技術解説

> [!IMPORTANT]
> このドキュメントは **NetHack 5.0.0 正式版** に準拠して更新されています。
> グリフからタイルインデックスへの変換は、以下の**2段階構成**で行われます。
> 1. **基底1:1直接マッピングテーブル（静的）**: ビルド生成物 [tilemappings.lst](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/5_gamedata/tilemappings.lst) から自動生成された [param/tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/param/tileMapping.js)。
> 2. **ゲームごとの未識別外見シャッフル補正（動的・重要）**: ゲーム開始時に NetHack Cコアの `shuffle_all()`（`o_init.c`）で決定される `objects[otyp].oc_descr_idx` を `SHIM_CMD_DUMP_DESCR_INDEXES (0x62)` で同期し、[src/driver/tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/tileMapping.js) にて `shuffle_tiles()` 相当のタイル番号入れ替えを適用します。

NetHack 5.0 において、Wasm内部データ（グリフ）がどのようにタイルの索引（Tile Index）に変換され、画面上で描画されるかの仕組みについて解説します。

---

## 1. エンコードされたグリフ (\G 形式)

NetHack 5.0 では、ステータス行やメッセージなどで「アイコン付きテキスト」を表示するために、`\G` で始まる特殊な文字列を使用します。

**例: `\G210C0F2B:100`**

*   **`\G`**: エンコードされたグリフの開始記号。
*   **最初の4桁の16進数 (`210C`)**: セッションごとのセキュリティキー（Wasm-JS間の通信整合性検証用）。
*   **次の4桁の16進数 (`0F2B`)**: グリフ番号 (Glyph Index) です。
    *   `0x0F2B` = 10進数で **3883**。所持金などのアイコンに使用されます。
*   **`:`**: グリフデータと実データ（テキスト）の区切り。
*   **`100`**: 実際に表示される数値やテキスト（例：所持金）。

---

## 2. グリフ番号からタイルインデックスへの変換 (設計の変遷)

### 主要な定数 (NetHack 5.0 正式版)
*   **NUMMONS**: **383** (モンスターの種類数)
*   **NUM_OBJECTS**: **481** (オブジェクトの種類数)
*   **GLYPH_OBJ_OFF**: **3448** (通常オブジェクトの開始グリフID: `3448 + onum`)
*   **GLYPH_CMAP_OFF**: **3929** (ダンジョン地形 CMAP の開始グリフID)
*   **GLYPH_OBJ_PILETOP_OFF**: **7992** (複数アイテム積み重なり Piletop オブジェクトの開始グリフID: `7992 + onum`)
*   **GLYPH_BODY_PILETOP_OFF**: **8473** (Piletop 死体の開始グリフID)
*   **MAX_GLYPH**: **9624** (全グリフ数)

### 以前の設計（動的オフセット計算）とその限界
以前は `display.h` の定義値と `tilemap.c` の例外処理（条件付きシフト）を JavaScript 側で模倣し、実行時に計算してインデックスを求めていました。しかし、NetHack 5.0 内部の例外処理は複雑（後述の「条件付きシフト」参照）であり、少しの定義のズレで Objects や CMAP 以降の全てのタイルがずれる不具合を引き起こしやすくなっていました。

### 現在の設計（基底1:1直接マッピング ＋ 実行時シャッフル補正）
計算ミスや定義のズレを完全に排除するため、現在はホスト上でビルドした `tilemap.exe` から抽出した正確なマッピングデータ [tilemappings.lst](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/5_gamedata/tilemappings.lst) をインプットとし、**1:1で直接変換する基底マッピングテーブル**（`param/tileMapping.js`）を生成しています。

さらに、そこにゲーム開始時の**外見シャッフル（`oc_descr_idx`）**を上書き反映することで、O(1) のルックアップ性能を維持したまま、マップ表示とインベントリ表示の両方で正確な外見タイルを描画します（詳細は「5. 未識別アイテムの外見シャッフルと `glyphId` の重要な仕様」を参照）。


---

## 3. マッピングテーブルの自動生成 (generate_mapping.js)

マッピングテーブルの定義ファイル [tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/param/tileMapping.js) は、自動生成スクリプトを用いて構築されます。

### 生成手順
1. NetHack 5.0 ソースビルドから生成された [tilemappings.lst](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/tilemappings.lst) を `docs/` ディレクトリに配置します。
2. 以下のコマンドを実行してマッピングファイルを自動生成します。
   ```bash
   node tools/generate_mapping.js
   ```
3. このスクリプトは `tilemappings.lst` をパースし、各 Glyph ID に対応する Tile Index を羅列した [tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/param/tileMapping.js) を出力します。また、3.7.0の古いタイルセットから5.0.0へ並べ替えるための CSV マップなども同時に生成します。

### tileMapping.js の構造
```javascript
/**
 * tileMapping (Generated)
 * NetHack 5.0.0 Glyph ID to 5.0.0 Tile Index 1:1 Mapping Table
 */
function tileMapping(offsets) {
    const m = {
        0: 0,
        1: 2,
        2: 4,
        // ... (全9624グリフ分のマッピングペア)
    };
    return m;
}
```

---

## 4. 参考：条件付きシフト (Conditional Shifts)

`tilemap.c` には、特定のモンスターやオブジェクトの後に「予備のタイル」や「特殊な置換タイル」を挿入するためのロジックがあります。
**現在これらは `generate_mapping.js` の変換時に自動で織り込み済み**ですが、NetHack 5.0 の仕様理解のための参考として以下にリストを残します。

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

## 5. 未識別アイテムの外見シャッフルと `glyphId` の重要な仕様

### 5.1 Cコアが送出する `glyphId` は「外見」ではなく「真のアイテムID (`otyp`)」である
NetHack の C コアが `print_glyph(x, y, glyph)` イベントや `\G` エンコードで JS 側へ通知するアイテムの `glyphId` は、識別状態や外見シャッフルに関わらず、常に**真のアイテム番号（`otyp` / `onum`）**から計算されます。

*   **単一床置きアイテム / インベントリアイコン**: `glyphId = GLYPH_OBJ_OFF + otyp` (`3448 + onum`)
*   **複数積み重なり（Piletop）アイテム**: `glyphId = GLYPH_OBJ_PILETOP_OFF + otyp` (`7992 + onum`)

たとえば、`gauntlets of power`（`onum = 161`）が床に落ちている場合、そのゲームでの外見が `"riding gloves"` であろうと `"fencing gloves"` であろうと、C コアは常に `glyphId = 3609`（`3448 + 161`）を送出します。

### 5.2 本家 NetHack における `shuffle_all()` と `shuffle_tiles()` の二段構え
では、なぜ本家 NetHack のタイル表示では未識別アイテムの見た目がゲームごとにシャッフルされるのかというと、`src/o_init.c` の初期化処理が以下の二段構えになっているためです。

1. **`shuffle_all()` による `oc_descr_idx` のシャッフル**:
   - 各オブジェクト定義 `objects[i]` は、真名インデックス `oc_name_idx`（常に `i` 固定）と、外見インデックス `oc_descr_idx`（初期値は `i`）を持っています。
   - 新規ゲーム開始時、シャッフル対象グループ（薬・巻物・指輪・杖・魔除け・魔法書、および防具の鉄兜4種・魔法の外套4種・手袋4種・魔法の靴7種）の区間内で `objects[i].oc_descr_idx` がランダムに入れ替えられます。
   - 例：`objects[161]`（`gauntlets of power`）の `oc_descr_idx` が `162`（初期定義で `"fencing gloves"` を持つ `gauntlets of dexterity` のインデックス）に書き換わります。
2. **`shuffle_tiles()` による `glyph2tile[]` テーブルの書き換え**:
   - C コアのタイル描画層は、`glyphId`（真の `otyp` 基準）を受け取った際、`glyph2tile[glyphId]` を引いて描画するタイル番号を決定します。
   - `shuffle_tiles()` はゲーム開始時・セーブデータ復帰時に `objects[i].oc_descr_idx` を走査し、`glyph2tile[GLYPH_OBJ_OFF + i]` の中身を「初期状態の `GLYPH_OBJ_OFF + objects[i].oc_descr_idx` のタイル番号」にスワップします。

> [!WARNING]
> **静的な `param/tileMapping.js` をそのまま引いてはいけない理由**
> ビルド時に `tilemappings.lst` から生成した `param/tileMapping.js` は、あくまで**シャッフル前の初期状態（`oc_descr_idx == i`）**のテーブルです。
> C コアから来た `glyphId` を `param/tileMapping.js` の初期テーブルでそのまま引いてしまうと、テキストメッセージ（`objects[otyp].oc_descr_idx` を参照して `"fencing gloves"` と出力）と、タイル画像・GKLナレッジ表示（初期定義 `onum = 161` の `"riding gloves"` を参照）が食い違う不具合が発生します。

### 5.3 WebUI / GKL における同期と補正アーキテクチャ
この NetHack C コアの仕様に完全準拠するため、WebUI では以下のパイプラインで外見名とグリフタイルの双方を同期しています。

1. **Wasm メモリからの `oc_descr_idx` 直接ダンプ (`0x62`)**:
   - [shim_bridge.c](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/shim/shim_bridge.c) の `SHIM_CMD_DUMP_DESCR_INDEXES (0x62)` により、`objects[0..NUM_OBJECTS].oc_descr_idx` の `int` 配列（`481 * 4` バイト）を [WasmDirectBindingService.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/services/WasmDirectBindingService.js) がプロンプト待機時に一括取得します。
2. **ナレッジ・インベントリ名称の動的解決**:
   - [DiscoveryStateManager.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/state/DiscoveryStateManager.js) の `syncDescrIndexes()` が `onum -> descrOnum` のマッピングを構築します。
   - 未識別状態（`discoveries` に未登録）のままでも、`getAppearance(onum)` が `OBJECT_KNOWLEDGE_MAP.get(descrOnum).descr` を返すことで、真名（ネタバレ）を秘匿したまま今ゲームでの正確な未識別外見名（日英両方）を返します。
3. **インベントリアイコンおよび全マップレンダラのタイルマッピング補正**:
   - [src/driver/tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/tileMapping.js) の `setDescrIndexesForTileMapping(descrIndexes)` が、元の未シャッフルテーブル `baseTable` を保持した上で、共有キャッシュテーブル `cachedTable` の以下の2領域をインプレースで書き換えます。
     - 通常オブジェクト領域: `cachedTable[3448 + onum] = baseTable[3448 + oc_descr_idx[onum]]`
     - Piletop オブジェクト領域: `cachedTable[7992 + onum] = baseTable[7992 + oc_descr_idx[onum]]`
   - また、マップレンダラ群（`VirtualDungeonScreen`、`MainViewportRenderer`、`WebGPUHD2DRenderer` 等）が直接呼び出すグローバル関数 `window.tileMapping()` 自体もこの `cachedTable` を返すラッパーに置き換えられ、同期完了イベント（`discoveriesStateUpdated`）でマップ全体の再描画がトリガーされます。

---

## 参考ファイル
*   [tilemappings.lst](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/5_gamedata/tilemappings.lst): 生成された正確なマッピングデータの一覧（シャッフル前の基底定義）
*   [generate_mapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/generate_mapping.js): マッピングテーブル生成スクリプト
*   [param/tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/param/tileMapping.js): 生成された基底マッピングテーブル定義
*   [src/driver/tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/tileMapping.js): `oc_descr_idx` シャッフルを適用するランタイムタイルマッピングモジュール
*   [DiscoveryStateManager.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/state/DiscoveryStateManager.js): 識別状態および動的シャッフル外見（`oc_descr_idx`）の管理クラス
*   `include/display.h`: Wasm側グリフ・オフセット定義
*   `src/o_init.c`: Wasm側 `shuffle_all()` / `shuffle_tiles()` の実装
*   `win/share/tilemap.c`: Wasm側タイルマッピングのロジック

