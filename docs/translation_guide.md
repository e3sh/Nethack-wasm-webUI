# NetHack 5.0 Lookup Information 翻訳手順書

本ドキュメントは、NetHack 5.0における「Lookup information (アイテムやモンスター等の解説文データベース)」の翻訳データを安全かつ確実に管理・更新するための手順書です。
手動入力された最新データと、ゲーム本体のデータベース（`data.base`）の差分を抽出し、一ステップずつ確認しながら翻訳を進めることができます。

---

## 🛠️ システム構成と関係ファイル

翻訳データは以下のファイル間で同期・比較を行います。

1. **[dictionary.csv](../dictionary.csv) (翻訳マスター)**
   - 全ての翻訳データが記録されたCSVファイル。エディタやExcel等で編集するマスターデータです。
2. **[nhMessage.js](../param/nhMessage.js) (ゲーム用実行ファイル)**
   - WebUI側で実際に読み込まれるJavaScript辞書ファイル。直接手打ちで編集することもあります。
3. **[data.base](../../NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/dat/data.base) (NetHack 5.0の英文ソース)**
   - ゲーム本体（NetHack 5.0）が持つ、解説文のマスターデータベース（英語）。ここから未翻訳のテキストを抽出します。

---

## 🔄 翻訳作業の基本ワークフロー

基本的には以下の **1 ➡ 2 ➡ 3 ➡ 4 ➡ 5** の順に、一ステップずつ状況を確認しながら実行します。

```mermaid
graph TD
    A[1. JS의 編集内容をCSVへ同期] -->|dict_converter.py export| B(dictionary.csv)
    B --> C[2. 抜け漏れスキャン]
    C -->|check_missing_translations.py| D{未着手のキーブロックはあるか？}
    D -->|あり| E[3. CSVへ [TODO] として一括追記]
    E -->|add_missing_to_csv.py| F[4. 翻訳の適用]
    D -->|なし/移行完了| F
    F -->|方法A: 自動翻訳スクリプト / 方法B: 手動入力| G[5. CSVからJSへインポート]
    G -->|dict_converter.py import| H(nhMessage.js に反映)
```

---

## 📖 各ステップの詳細手順

### ステップ 1: 手打ちされた最新の翻訳をCSVに同期する
作業を始める前に、必ず `nhMessage.js` に直接書き込まれた最新の翻訳を `dictionary.csv` に書き戻します。これを怠ると、手打ちした最新の翻訳が古いCSVデータで上書きされて消えてしまいます。

* **実行コマンド**:
  ```powershell
  python tools/dict_converter.py export
  ```
* **確認事項**:
  - `Exported XXX entries to dictionary.csv` と表示され、CSVファイルが更新されたことを確認します。
  - 必要に応じて、`git diff dictionary.csv` で意図しない書き換えが発生していないか確認します。

---

### ステップ 2: 翻訳されていない解説ブロック（抜け）があるかスキャンする
現在のCSVデータと、NetHack 5.0の最新の `data.base` を突き合わせ、まだ翻訳されていない（CSVに一度も翻訳が登録されていない）アイテム・モンスターなどの解説ブロックを抽出します。

* **実行コマンド**:
  ```powershell
  python scratch/check_missing_translations.py
  ```
* **出力の読み方**:
  - **総解説ブロック数**: `data.base` に定義されているアイテムやモンスターなどの総説明ブロック数。
  - **翻訳完了ブロック数**: 少なくとも1行以上の有効な日本語訳が存在するブロックの数。
  - **未翻訳ブロック数 (未着手)**: 1行も翻訳されていない（すべて `[TODO]` または未登録の）ブロックの数。

> [!TIP]
> **「行数調整のための空行」への対応について**
> 英語原文（例えば5行）に対し、日本語訳がコンパクト（例えば3行）で済み、残りの行を空行（`""`）にして処理している場合があります。
> 本スキャンスクリプトは「キーブロック単位」で判定を行うため、**1行でも日本語訳が存在するブロックは「翻訳完了」とみなされ、意図的な空行が「未翻訳」として誤検出されることはありません。**

---

### ステップ 3: 抜け漏れしている英文をCSVに [TODO] 付きで追記する
ステップ2で「未登録の英文」が存在する場合、それらを安全に `dictionary.csv` の末尾に追加します。
このとき、翻訳が空欄になってゲーム内で非表示になるのを防ぐため、`Translation` 列に `[TODO] (英語原文)` の形式で追記します。

* **実行コマンド**:
  ```powershell
  python scratch/add_missing_to_csv.py
  ```
* **確認事項**:
  - CSV의 末尾に、未翻訳の英文が `[TODO] ...` というプレフィックス付きで追加されていることを確認します。

---

### ステップ 4: 翻訳を適用する

#### 方法A：機械翻訳スクリプトを使って下訳を入れる場合
追加した `[TODO]` 部分に対して、Google翻訳APIを用いて自動で下訳を作成します。件数を指定して少しずつ実行することが可能です。

* **実行コマンド (例: 最初の50件のみ翻訳する場合)**:
  ```powershell
  python scratch/auto_translate.py 50
  ```
* **実行コマンド (全件翻訳する場合)**:
  ```powershell
  python scratch/auto_translate.py
  ```
  *(※ Ctrl+C でいつでも安全に中断でき、そこまでの翻訳は保存されます。)*

#### 方法B：手動で翻訳を修正・入力する場合
[dictionary.csv](../dictionary.csv) をテキストエディタやExcel等で直接開き、`[TODO]` が付いている行の `Translation` 列を、正しい日本語に書き換えます。

---

### ステップ 5: CSVからJSへインポート（ゲームへの反映）
CSV上の翻訳（手動修正または自動翻訳）が完了したら、それを実行用ファイル `nhMessage.js` に反映させます。

* **実行コマンド**:
  ```powershell
  python tools/dict_converter.py import
  ```
* **確認事項**:
  - `Import completed successfully to param/nhMessage.js` と表示されれば完了です。ブラウザでWebUIをリロードし、ゲーム内で実際に翻訳が表示されるかテストします。

---

## ⚠️ トラブルシューティング（元に戻す方法）

作業中にCSVのデータが壊れたり、意図しない自動翻訳が行われた場合は、Gitを使用して簡単に元のクリーンな状態に戻すことができます。

* **自動翻訳や追記をする前のCSVに戻したい場合**:
  ```powershell
  git restore dictionary.csv
  ```
* **手打ちした `nhMessage.js` の内容がおかしくなり、元に戻したい場合**:
  ```powershell
  git restore param/nhMessage.js
  ```
