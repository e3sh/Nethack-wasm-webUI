# NetHack 5.0 グリフ・タイルマッピング技術解説

> [!IMPORTANT]
> このドキュメントは **NetHack 5.0.0 正式版** に準拠して更新されています。
> 従来の「JavaScript側での条件付きシフト再現による動的計算」は廃止され、**完全1:1直接マッピングテーブルの自動生成方式**に移行しました。
> また、Glyph ID だけでなくアイテムの `onum`（オブジェクト固有番号）およびカテゴリ識別に関しても、Cソース (`objects.h`) の直接参照や動的推測を行わず、ビルド生成物 [tilemappings.lst](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/5_gamedata/tilemappings.lst) の抽出データを**唯一の真実 (Single Source of Truth)** として使用します。

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
*   **MAX_GLYPH**: **9624** (全グリフ数)

### 以前の設計（動的オフセット計算）とその限界
以前は `display.h` の定義値と `tilemap.c` の例外処理（条件付きシフト）を JavaScript 側で模倣し、実行時に計算してインデックスを求めていました。しかし、NetHack 5.0 内部の例外処理は複雑（後述の「条件付きシフト」参照）であり、少しの定義のズレで Objects や CMAP 以降の全てのタイルがずれる不具合を引き起こしやすくなっていました。

### 現在の設計（完全1:1直接マッピング）
計算ミスや定義のズレを完全に排除するため、現在はホスト上でビルドした `tilemap.exe` から抽出した正確なマッピングデータ [tilemappings.lst](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/tilemappings.lst) をインプットとし、**1:1で直接変換する静的マッピングテーブル**を使用しています。

これにより、JS側の実行時処理はマッピングオブジェクトのルックアップ（`tileIndex = m[glyph]`）のみとなり、O(1) で安全かつ確実にタイルを特定できます。

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

## 参考ファイル
*   [tilemappings.lst](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/tilemappings.lst): 生成された正確なマッピングデータの一覧
*   [generate_mapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/generate_mapping.js): マッピングテーブル生成スクリプト
*   [tileMapping.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/param/tileMapping.js): 生成されたマッピングテーブル定義
*   `include/display.h`: Wasm側グリフ・オフセット定義
*   `win/share/tilemap.c`: Wasm側タイルマッピングのロジック
