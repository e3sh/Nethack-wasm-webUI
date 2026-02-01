# 辞書更新オペレーションガイド

新しい統合辞書形式（`nhMessage.js`）および高速化された翻訳エンジンに基づいた、翻訳データの更新手順を説明します。

## 基本のワークフロー

翻訳の追加・修正は、**CSVファイルを書き出して表計算ソフト（Excel, Google Sheets等）で編集し、再び取り込む**という流れで行います。

### 1. 辞書をCSVにエクスポートする
以下のコマンドを実行すると、プロジェクトルートに `dictionary.csv` が生成されます。

```powershell
# デフォルト（dictionary.csv）へエクスポート
python tools/dict_converter.py export

# 名前を指定してエクスポート
python tools/dict_converter.py export my_dict.csv
```

### 2. CSVファイルを編集する
`dictionary.csv` を Excel や Google スプレッドシートで開いて編集します。

- **Group**: データの所属（`Message`, `Entity`, `Item`, `Pattern`）です。**変更しないでください。**
- **Source**: 原文（英語）または正規表現パターンです。**基本的に変更しないでください。**
- **Translation**: 日本語訳（名詞または一般訳）を入力します。
- **Adj / Verb**: （Entity/Itemのみ）形容詞的・動詞的に使用される場合の訳を入力します（例：アイテムの状態異常など）。
- **改行の扱い**: 改行を含めたい場合は、スプレッドシート内で `\\n` と記述してください。

> [!IMPORTANT]
> 「Group」や「Source」の値を変更したり行を削除したりすると、既存のメッセージとの紐付けが壊れる可能性があります。主に「Translation」以降のカラムを編集してください。

### 3. 編集したCSVをプロジェクトに取り込む
CSVファイルを保存（UTF-8形式）し、プロジェクトルートに配置した状態で以下のコマンドを実行します。

```powershell
# デフォルト（dictionary.csv）から取り込み
python tools/dict_converter.py import

# 名前を指定して取り込み
python tools/dict_converter.py import my_dict.csv
```

これにより、以下のファイルが自動更新（書き出し）されます：
- `param/nhMessage.js`
    - この1つのファイルに全データ（Message, Entity, Item, Pattern）が集約されました。

---

## データの種類別アドバイス

### Message (一般的なメッセージ)
- ゲーム内の固定メッセージ（文章）です。
- 原文と日本語訳が一対一で管理されます。

### Entity / Item (固有名詞・アイテム)
- 品詞（Adj/Verb）のカラムを埋めることで、翻訳エンジンが状況に応じて適切な語形を選択します。
- 空欄の場合は `Translation`（Noun扱）が使用されます。

### Pattern (正規表現パターン)
- `Source` に正規表現（例：`You see here (.*)\.`）、`Translation` に置換文字列（例：`ここに$1がある。`）を記述します。
- **品詞の指定**: プレースホルダに `:adj`（形容詞）や `:verb`（動詞）を付けることで、`Entity` や `Item` 辞書に定義された特定の語形を呼び出せます。
    - 例1（標準）: `$1 が攻撃した。` → `$1` の名詞訳を使用。
    - 例2（形容詞指定）: `$1:adj 攻撃` → `$1` に一致した単語の `Adj` カラムの訳を使用。
    - 例3（動詞指定）: `$1:verb はじめた。` → `$1` に一致した単語の `Verb` カラムの訳を使用。
- **再帰翻訳**: プレースホルダ `$1` などでキャプチャされた内容は、自動的に他の辞書（Message, Entity, Item）で再帰的に翻訳されます。

---

## 注意点

- **BOM付きUTF-8**: ツールは Excel で開きやすいよう BOM 付き UTF-8 で出力します。保存時もこの形式を維持してください。
- **Gitでの確認**: `import` 後は `git diff` で意図しない破壊（エスケープ漏れなど）がないか必ず確認してください。
