---
title: NetHack ソースメッセージ静的抽出の設計思想と運用・拡張ガイド
status: standard / guide
created_at: 2026-09-17
last_updated: 2026-09-17
related_code:
  - tools/extract_source_messages.py
  - tools/data/source_messages.json
  - tools/data/source_messages.csv
  - docs/7_futures/message_context_and_signal_driven_architecture.ja.md
---

# NetHack ソースメッセージ静的抽出の設計思想と運用・拡張ガイド

**〜 Vanilla 差分追跡・バリアント展開・シグナル辞書/訳語検討のための方法論基盤 〜**

---

## 1. はじめに・本資料の目的

本書は、NetHack の次世代シグナル駆動型アーキテクチャ（`docs/7_futures/message_context_and_signal_driven_architecture.ja.md`）の基盤となる **「オリジナルソース起点のメッセージ静的抽出技術」** について、その設計思想、ツールの使用方法、将来の Vanilla バージョンアップ時の差分追跡手順、およびバリアント（JNetHack 等）展開や訳語検討への応用方法をまとめた公式運用ガイドです。

「画面に出力された文字列を後から正規表現で推測する対症療法」から脱却し、**「ゲームの全メッセージをコンテキスト付きの構造化マスター（SSOT: Single Source of Truth）として管理・運用する」** ための恒久的な指針を提供します。

---

## 2. 抽出アプローチの設計思想（考え方）

### 2.1 なぜ外部依存なしの特化型ステートマシンなのか？
C言語の静的解析には Clang/libclang や AST パーサライブラリが存在しますが、本プロジェクトでは **「Python 標準ライブラリのみで動作する特化型字句解析器（CTokenizer）」** を採用しています。

- **理由 1: 開発環境ポータビリティの最大化**:
  - Windows / macOS / Linux を問わず、Python さえあれば環境構築（LLVM インストールや C コンパイラパス解決）なしで 1 コマンドで即座に実行可能。
- **理由 2: NetHack 特有の C 記法への最適化**:
  - 複数行にわたる隣接文字列リテラルの連結 (`"You see " \n "a door."` → `"You see a door."`)
  - 古い C 記法（K&R 型関数定義、型宣言と関数名の行分離など）の柔軟な許容
  - マクロや条件分岐が含まれていても行番号を 1 行もズラさずにコメント（`/*...*/`, `//...`）のみを透明化する行維持フィルタリング

### 2.2 メッセージコンテキスト（5大レイヤー構造）の自動付与
単に文字列を抜き出すのではなく、以下の 5 層のコンテキストを抽出時に自動結合します：

```
[Layer 1] 視点・知覚 (関数名)     : You (能動), You_feel (感覚), You_hear (音響SE), verbalize (台詞)
[Layer 2] ドメイン (ソースファイル) : eat.c (飲食), pray.c (祈り), shk.c (店舗), combat (戦闘)
[Layer 3] 制御シグナル (対話関数)   : yn_function (選択), getlin (テキスト入力), getdir (方向)
[Layer 4] 環境・伝承 (データファイル): rumors (噂の真偽), oracles (神託), engrave (刻み文字原形)
[Layer 5] エンティティ・変数       : %s, %d などのフォーマット指定子、動的プレースホルダ
```

これにより、後続の WebUI 層やシグナルディスパッチャは「文字列」ではなく「ゲーム内事象のセマンティクス」としてメッセージを購読できるようになります。

### 2.3 動的・変数渡し（Variable）の逆引きヒューリスティック
NetHack C コアでは、全体の約 8%（約 540 件）で `pline(buf);` や `yn_function(qbuf, ...);` のように変数が渡されます。
本ツールでは、変数渡しを検出した際に **同一スコープ内の直前 2,500 文字を後方探索し、直近の `Sprintf(buf, "...")` や `Strcpy(buf, "...")` から本来のフォーマット文字列を自動復元** します。
これにより、プロンプト系関数（`yn_function` / `getlin` / `getdir`）の動的バッファでも高い確率で静的フォーマットを特定できます。

---

## 3. ツール仕様と基本使用方法

### 3.1 ファイル構成
- **抽出スクリプト**: [`tools/extract_source_messages.py`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/extract_source_messages.py)
- **生成マスタ (JSON)**: [`tools/data/source_messages.json`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/data/source_messages.json)（完全構造化データ）
- **生成マスタ (CSV)**: [`tools/data/source_messages.csv`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/data/source_messages.csv)（一覧・検索・名寄せ用）
- **サマリレポート**: [`tools/data/extraction_report.txt`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/data/extraction_report.txt)

### 3.2 コマンド実行方法

```powershell
# デフォルト実行（Vanilla NetHack 5.0 ソースから tools/data に出力）
python tools/extract_source_messages.py

# パスを明示して実行
python tools/extract_source_messages.py `
  --nethack-dir "path/to/NetHack-5.0" `
  --output-dir "tools/data"
```

### 3.3 JSON スキーマ主要フィールド
```jsonc
{
  "id": "eat.c:L124:You:0",         // 一意なID (ファイル:行:関数:連番)
  "source_type": "c_source",        // c_source または dat_file
  "file": "eat.c",                  // 定義ファイル名
  "line": 124,                      // 行番号
  "caller_func": "eatcorpse",       // 所属するC関数名
  "callee_func": "You",             // 呼び出しメッセージ関数
  "layer": 1,                       // コンテキストレイヤー (1〜5)
  "semantic_role": "PLAYER_ACTION", // セマンティクス分類
  "domain": "eat/hunger",           // 機能ドメイン
  "literal_type": "literal",        // literal, variable, conditional
  "raw_format": "You finish eating %s.",
  "placeholders": [                 // 埋め込みフォーマット指定子
    { "index": 0, "raw": "%s", "specifier": "%s", "type": "string" }
  ],
  "c_arguments": ["\"You finish eating %s.\"", "corpse_name"],
  "prompt_meta": null,              // yn_function/getlin 時の選択肢・デフォルトキー等
  "inferred_format": null           // 変数渡し時の逆引き推定フォーマット
}
```

---

## 4. Vanilla NetHack アップデート時の差分調査手順

NetHack 本家（Vanilla）のマイナーアップデート（例: 5.0.0 → 5.0.1）や次期バージョン（5.1+）がリリースされた際、以下の手順でメッセージ差分を完全追跡します。

```
[新バージョンソースの取得]
         │
         ▼
[extract_source_messages.py を新旧ソースに対して実行]
   旧: source_messages_v5.0.json
   新: source_messages_v5.1.json
         │
         ▼
[差分検出スクリプト / jq による比較]
  ① 新規追加されたメッセージ (Added Messages)
  ② 削除・廃止されたメッセージ (Removed Messages)
  ③ 変更されたフォーマット文字列 (Changed Format / Placeholders)
  ④ 制御プロンプト (Layer 3) の増減チェック
         │
         ▼
[dictionary.csv および SignalCatalog への差分反映]
```

### 差分チェックの着眼点
1. **制御プロンプト（`yn_function`, `getlin`, `getdir`）の変更**:
   - プロンプトの追加・変更がある場合、`ControlSignalCatalog.js` に直ちに新規シグナル ID を割り当てる必要があります。
2. **フォーマット指定子（プレースホルダ）の順序・個数の変更**:
   - `%s` が追加されたり順序が変わった場合、既存の翻訳テンプレートがクラッシュする原因になるため最優先で検知します。
3. **新規 LORE（Rumors / Oracles）の追加**:
   - 噂話や預言が増えた場合、冒険手帳（Codex）マスタへ追加登録します。

---

## 5. バリアント展開（JNetHack / Slash'EM 等）への適用ガイド

### 5.1 バリアント対応における主な論点
バリアント（特に JNetHack や Slash'EM）では、Vanilla と比較して以下の相違点が発生します：
1. **固有メッセージ関数の存在**:
   - JNetHack における `jpline` や日本語処理用ラッパー。
2. **`#ifdef JNETHACK` によるソース分岐**:
   - 同一ファイル内で英語メッセージと日本語メッセージがプリプロセッサで切り替わる構造。
3. **データファイルの文字コード**:
   - EUC-JP や UTF-8 の混在。
4. **新規ドメイン・アイテム・モンスターの追加**:
   - Slash'EM 等における新属性・新ダンジョン・新スキル。

### 5.2 適用・カスタマイズ手順

#### Step 1: 関数カタログの拡張 (`MESSAGE_FUNCTIONS`)
バリアント固有のメッセージ出力関数やマクロを `MESSAGE_FUNCTIONS` に登録します：
```python
MESSAGE_FUNCTIONS.update({
    "jpline": (1, "NARRATION_JAPANESE", 0),
    # バリアント固有のプロンプト関数があれば登録
    "yn_function_custom": (3, "PROMPT_YN", 0),
})
```

#### Step 2: 文字コード対応とプリプロセッサ解析
バリアントソース読み込み時のエンコーディングを柔軟に扱えるよう設定し（`errors='replace'` または `euc-jp` 自動判定）、`#ifdef JNETHACK` ブロックの抽出モード（英語版抽出モード／日本語版抽出モード）を切り替えられるようにします。

#### Step 3: Vanilla との「アライメント（対応付け）マッピング」
バリアント専用の `source_messages_variant.json` を生成した後、Vanilla の `source_messages.json` と **ファイル名・行番号・呼び出し元関数（`caller_func`）** をキーにして突合します。
- これにより、「どの Vanilla メッセージがバリアント側でどの日本語メッセージ（または新規メッセージ）に対応しているか」を 100% の精度でペアリングできます。

---

## 6. シグナル辞書策定と訳語検討（Phase 2/3）への活用フロー

本マスタデータを活用することで、翻訳・シグナル設計の品質を飛躍的に向上させることができます。

### 6.1 Phase 2: 既存 `dictionary.csv` との自動照合（名寄せ）
1. **完全一致（Exact Match）**:
   - `raw_format` がそのまま `dictionary.csv` の `Source` と一致するものを即座にマッピングし、ドメイン・レイヤータグを逆流付与。
2. **プレースホルダ正規化一致**:
   - `%s` や `%d` を `{0}`, `{1}` 等に置換した正規化キーで照合。
3. **未翻訳リストの網羅的抽出**:
   - Cソース内に存在するが `dictionary.csv` に存在しないメッセージを「未翻訳ギャップリスト」として自動出力。

### 6.2 Phase 3: 制御シグナルカタログの先行完全網羅
- `source_messages.json` から `layer == 3` のエントリ（計 102 件）を抽出し、`ControlSignalCatalog.js` の定数定義を半自動生成します：
  ```javascript
  // 自動生成されるカタログ定義例
  export const CONTROL_SIGNALS = {
    CMD_HIDE_OR_SPIN: {
      id: "cmd.c:L871:yn_function",
      pattern: "Hide [h] or spin a web [s]?",
      validKeys: ["h", "s", "q"],
      defaultKey: "q"
    },
    // ...
  };
  ```

### 6.3 訳語の統一と文脈に応じた翻訳（Contextual Translation）
従来は単なる文字列だったため、「Close（閉じる / 近い）」や「Right（右 / 正しい）」の訳語衝突が発生していました。
本マスタの `domain`（`lock.c` なのか `combat.c` なのか）および `caller_func` を参照することで、**「同じ英単語でも機能ドメインに応じて適切な日本語訳を出し分ける」コンテキスト翻訳** が可能になります。

---

## 7. まとめ

本抽出手法は、単なる一回限りのスクリプトではなく、**WebUICore の多言語化・シグナル駆動化・バリアント拡張を長期にわたって支える基盤技術** です。

今後 NetHack のバージョンが上がった場合や、JNetHack / バリアントの対応を行う際にも、本ガイドの手順に沿ってマスタを更新・比較することで、安全かつ迅速なシステム進化を実現できます。
