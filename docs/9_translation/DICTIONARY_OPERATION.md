---
title: DICTIONARY_OPERATION
status: implemented
last_updated: 2026-10-11
related_code:
  - tools/dict_converter.py
  - param/nhMessage.js
  - src/core/translation/TranslationEngine.js
  - src/core/inspector/DebugInspector.js
  - src/core/inspector/inspector_console.html
---

# 辞書更新オペレーションガイド

本ドキュメントでは、マスター辞書データ（`dictionary.csv`）と実行用辞書（`param/nhMessage.js`）の連携、基本的なファイル操作コマンド、および翻訳運用フローについて説明します。

> [!TIP]
> プレイ中のリアルタイム対訳監視・未翻訳メッセージの自動キャプチャには、**DevTools Inspector ([`src/core/inspector/inspector_console.html`](../../src/core/inspector/inspector_console.html) の「📝 翻訳管理」タブ)** を使用します。（※旧世代の翻訳支援ツール仕様は [旧：翻訳支援ツール＆リアルタイム検証環境ガイド（アーカイブ）](./archive/translation_support_tools.md) を参照してください）

---

## 1. 基本のファイル操作コマンド（標準ワークフロー）

翻訳データの追加・修正は、**`dictionary.csv`（マスターデータ）を編集し、CLIツールで `param/nhMessage.js` へインポートする** という流れで行います。

### ステップ 1: 辞書を CSV にエクスポートする
以下のコマンドを実行すると、プロジェクトルートに `dictionary.csv` が生成されます。

```powershell
# デフォルト（dictionary.csv）へエクスポート
python tools/dict_converter.py export

# 名前を指定してエクスポート
python tools/dict_converter.py export my_dict.csv
```

### ステップ 2: CSV ファイルを編集する
`dictionary.csv` を Excel、Google スプレッドシート、またはテキストエディタで開いて編集します。

- **Group**: データの所属（`Message`, `Entity`, `Item`, `Pattern`）です。**変更しないでください。**
- **Source**: 原文（英語）または正規表現パターンです。**基本的に変更しないでください。**
- **Translation**: 日本語訳（名詞または一般訳）を入力します。
- **Adj / Verb**: （Entity/Itemのみ）形容詞的・動詞的に使用される場合の訳を入力します（例：アイテムの状態異常など）。
- **改行の扱い**: 改行を含めたい場合は、スプレッドシート内で `\n` または `\\n` と記述してください。

> [!IMPORTANT]
> 「Group」や「Source」の値を変更したり既存行を誤って削除すると、既存メッセージとの紐付けが壊れる可能性があります。主に「Translation」以降のカラムを編集してください。

### ステップ 3: 編集した CSV をプロジェクトに取り込む (インポート)
CSV ファイルを保存（UTF-8 形式）し、プロジェクトルートに配置した状態で以下のコマンドを実行します。

```powershell
# デフォルト（dictionary.csv）から取り込み
python tools/dict_converter.py import

# 名前を指定して取り込み
python tools/dict_converter.py import my_dict.csv
```

これにより、以下のファイルが全自動で更新（生成）されます：
- **`param/nhMessage.js`**: WebUI 実行時に読み込まれる統合辞書JavaScriptファイル。

> [!NOTE]
> **自動変換の仕組み**:
> - CSV 上の半角スペースは、インポート時に自動的に正規表現用スペース `\s+` に変換されます。
> - `[BEGIN: ...]` や `=== TODO ===` 等の管理用タグはインポート時に自動で除去されて出力されます。

---

## 2. データの種類別アドバイス

### Message (一般的なメッセージ)
- ゲーム内の固定メッセージ（文章）です。
- 原文と日本語訳が一対一で管理されます。

### Entity / Item (固有名詞・アイテム)
- 品詞（Adj/Verb）のカラムを埋めることで、翻訳エンジンが状況に応じて適切な語形を選択します。
- 空欄の場合は `Translation`（Noun扱い）が使用されます。

### Pattern (正規表現パターン)
- `Source` に正規表現（例：`You see here (.*)\.`）、`Translation` に置換文字列（例：`ここに$1がある。`）を記述します。
- **品詞の指定**: プレースホルダに `:adj`（形容詞）や `:verb`（動詞）を付けることで、`Entity` や `Item` 辞書に定義された特定の語形を呼び出せます。
    - 例1（標準）: `$1 が攻撃した。` → `$1` の名詞訳を使用。
    - 例2（形容詞指定）: `$1:adj 攻撃` → `$1` に一致した単語の `Adj` カラムの訳を使用。
    - 例3（動詞指定）: `$1:verb はじめた。` → `$1` に一致した単語の `Verb` カラムの訳を使用。
- **再帰翻訳**: プレースホルダ `$1` などでキャプチャされた内容は、自動的に他の辞書（Message, Entity, Item）で再帰的に翻訳されます。

---

## 3. DevTools Inspector (`inspector_console.html`) を併用したリアルタイム翻訳開発・検証フロー

現行アーキテクチャでは、`DebugInspector.js` と **DevTools Inspector (`src/core/inspector/inspector_console.html`)** が `BroadcastChannel ('nh_inspector_channel')` を介してリアルタイム連動し、設定変更や `localStorage` の一時領域を介さずに、プレイ中の未翻訳メッセージを即座に捕捉・CSVエクスポートできます。

```
[ゲームクライアント (WebUICore + TranslationEngine)]
       │ (BroadcastChannel: 'nh_inspector_channel')
       │ 翻訳イベント & 未翻訳メッセージをリアルタイム配信
       ▼
[DevTools Inspector (src/core/inspector/inspector_console.html)]
  └─ 「📝 翻訳管理 (Translation)」タブ
       │ ・リアルタイム対訳ストリーム監視 (原文 ⇄ 訳文 / ルール種別)
       │ ・未翻訳メッセージの自動フィルタリング・重複排除ストック
       │ ・その場での翻訳テスト & CSV フォーマット一括エクスポート
       ▼
[dictionary.csv] ──(python tools/dict_converter.py import)──> [param/nhMessage.js]
```

### ステップ 1: DevTools Inspector の起動とリアルタイム監視
1. ゲーム画面（または開発ツールポータル `tools/dev_tools.html`）から **DevTools Inspector (`src/core/inspector/inspector_console.html`)** を別タブまたは別ウィンドウで開きます。
2. 상部タブから **「📝 翻訳管理」** を選択します。
3. ゲームをプレイすると、`TranslationEngine` を通過したすべてのメッセージ（原文・翻訳結果・適用ルール）が `BroadcastChannel` 経由でリアルタイムに表示され、未翻訳（原文のまま残った行）が自動的にリストアップされます。

### ステップ 2: 未翻訳リストの確認と CSV エクスポート
1. 「📝 翻訳管理」タブ内の未翻訳メッセージ一覧で、捕捉された英文を確認し、必要に応じて仮訳や正規表現パターンを検証します。
2. エクスポート機能（CSVコピー／ダウンロード）を使用して、`dictionary.csv` 互換フォーマットの行データを出力します。

### ステップ 3: マスター辞書 (`dictionary.csv`) への統合とビルド
1. 出力した行データを `dictionary.csv` に追記・編集します。
2. `python tools/dict_converter.py import` を実行して `param/nhMessage.js` を再生成します。
3. `npm test`（`TranslationEngine.test.js` 等）を実行し、既存翻訳ルールとの競合や正規表現エラーがないことを確認します。

---

## 4. 運用上の注意点

- **BOM付き UTF-8**: ツールは Excel で編集しやすいよう BOM 付き UTF-8 で出力・読み込みを行います。保存時もこの形式を維持してください。
- **Git による確認**: `import` コマンド実行後は、必ず `git diff` を行い、エスケープ漏れや意図しない破壊がないか確認してください。

