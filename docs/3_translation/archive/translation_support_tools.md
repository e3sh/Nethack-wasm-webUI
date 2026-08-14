---
title: translation_support_tools
status: active
last_updated: 2026-08-15
related_code:
  - src/
---

# NetHack 翻訳支援ツール＆リアルタイム検証環境ガイド

本ドキュメントでは、NetHack Wasm WebUI 移植プロジェクトにおける最新の翻訳支援ツール群（Web UIツールおよびCLIツール）の使い方、ならびにプレイ中に別タブ・別ウィンドウでリアルタイム対比ログや未翻訳管理ツールを並行運用する環境の構築・活用方法を解説します。

---

## 1. 翻訳支援ツールの全域マップ

現在、翻訳作業・デバッグ・検証・辞書更新を効率化するため、以下のツール群が提供されています。

```
                    ┌──────────────────────────────────────────────┐
                    │      メインゲーム画面 (index.html / game.html)  │
                    └──────────────────────┬───────────────────────┘
                                           │ (リアルタイムログ & 未翻訳収集)
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐
│  tr_log.html             │  │  tr_manager.html         │  │  tr_fail.html            │
│  (リアルタイム対比ビューア)│  │  (未翻訳管理・即時反映)  │  │  (未翻訳一覧・CSV保存)   │
└──────────────────────────┘  └────────────┬─────────────┘  └──────────────────────────┘
                                           │ (nhMessage_ext.json 出力)
                                           ▼
                              ┌──────────────────────────┐
                              │  tr_test.html            │
                              │  (単体翻訳テスター)       │
                              └──────────────────────────┘
                                           │ (マスター辞書統合: Backfill)
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  マスター更新・開発CLIツール (dict_converter.py / manage_translations_5.0.py)        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### ツール一覧と役割

| ツール名 | 種別 | 主な役割・用途 |
| :--- | :--- | :--- |
| **`tr_log.html`** | Web UI | **リアルタイム対比ログビューア**。プレイ中に適用された英文（RAW）と訳文（JP）を並行表示。 |
| **`tr_manager.html`** | Web UI | **未翻訳メッセージ管理・仮訳即時反映ツール**。蓄積された未翻訳ログに暫定訳を適用し、ゲーム画面をリロードするだけで即テスト。 |
| **`tr_fail.html`** | Web UI | **未翻訳メッセージ一覧・抽出画面**。未翻訳メッセージの単純一覧確認・CSV保存。 |
| **`tr_test.html`** | Web UI | **翻訳エンジン単体テスター**。任意の英文を入力し、正規表現パターンや辞書がどう適用されるか事前にスタンドアロン検証。 |
| **`tools/dict_converter.py`** | CLI (Python) | **辞書マスター変換ツール**。`dictionary.csv` ⇆ `param/nhMessage.js` の相互変換（export / import）。 |
| **`tools/dev_scripts/manage_translations_5.0.py`** | CLI (Python) | **5.0統合管理ツール**。網羅率診断 (`status`)、ソース自動スキャン (`add`)、Google/LLM自動翻訳 (`translate`)、クリーンアップ (`clean`)。 |

---

## 2. プレイ時のマルチタブ/ウィンドウ運用（リアルタイム検証環境）

ゲームをプレイしながら別タブやサブモニタの別ウィンドウでツールを表示しておくことで、**「訳文を見ながら原文（RAW）を確認する」「意味不明な訳が出たときに即座に原因を突き止める」** 理想的なデバッグ・デモ環境を構築できます。

```
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│  [ウィンドウ 1] メインゲーム画面        │  │  [ウィンドウ 2] 翻訳対比ビューア       │
│                                      │  │  (tr_log.html)                       │
│ You hit the Jackal.                  │  │                                      │
│ ジャッカルを攻撃した。                │  │  #142 (14:02:15)                     │
│                                      │  │    RAW : You hit the Jackal.         │
│ You hit the mold.                    │  │    JP  : ジャッカルを攻撃した。        │
│ カビに攻撃した。                      │  │  #143 (14:02:18)                     │
│                                      │  │    RAW : You hit the mold.           │
│                                      │  │    JP  : カビに攻撃した。             │
└──────────────────────────────────────┘  └──────────────────────────────────────┘
```

### マルチタブ/ウィンドウ運用のメリット

1. **訳文（JP）から原文（RAW）の即時確認**:
   - 画面に「〜に攻撃した」と出たとき、原文が `You hit the (.*)` なのか `You struck the (.*)` なのかをログ画面（`tr_log.html`）で即確認できます。
2. **不自然な訳文・意味不明な訳の即時調査**:
   - 変数置換が崩れたメッセージや、意図しない正規表現パターンに誤マッチした訳文が出力された際、`tr_log.html` の対比ログから生の英文を取得して原因究明できます。
3. **未翻訳メッセージのリアルタイム把握**:
   - 設定画面で「`LANG_LEARNMODE`（学習モード）」を有効にしておくと、翻訳が適用されなかった英文が `tr_log.html` 上で赤色の **`UNTRANSLATED (未翻訳)`** タグ付きでハイライト表示されます。

---

## 3. 具体的な使用例（ユースケース別ステップバイステップ）

### ユースケース 1: プレイ中に違和感のある訳文を発見し、原文確認・検証・修正する

1. **プレイ中に異変を察知**:
   - 例: ゲーム画面に「**カビは カビ に変身した！**」という奇妙なメッセージが表示された。
2. **`tr_log.html`（別ウィンドウ）で原文（RAW）を確認**:
   - 対比ログ画面を見ると、以下のログが記録されている：
     - `RAW : The mold turns into a mold!`
     - `JP  : カビは カビ に変身した！`
3. **`tr_test.html` でエンジンの挙動を単体テスト**:
   - ブラウザで `tr_test.html` を開き、Input 欄に `The mold turns into a mold!` を入力して実行。
   - どの正規表現パターン（例：`The (.*) turns into a (.*)!`）が適用されたか、変数の対応関係をステップ実行で確認。
4. **`tr_manager.html` または CSV で修正**:
   - `tr_manager.html` で一時的に正しい訳（例：`$1 は $2 に姿を変えた！`）を入力して「保存 & 反映」。
   - ゲーム画面をリロードして動作を確認。

---

### ユースケース 2: 未翻訳メッセージを収集し、仮訳をテスト適用する

1. **学習モードの有効化**:
   - 設定画面 (`config.html`) で **「LANG_LEARNMODE」** を ON にします（または `rogueDefines.js` の `LANG_LEARNMODE = true`）。
2. **プレイによる自動収集**:
   - ゲームをプレイすると、未翻訳のメッセージがブラウザの `localStorage("nh.temp")` に自動蓄積されます。
3. **`tr_manager.html` で仮訳の作成と適用**:
   - `tr_manager.html` を開くと、左側リストに未翻訳の原文が一覧表示されます。
   - 翻訳したい項目を選択し、右側の入力欄に仮訳を入力します。
   - **「保存 & 反映」** ボタンをクリックすると、`localStorage("nh.ext_data")` が更新され、`nhMessage_ext.json` ファイルがダウンロードされます。
4. **ゲーム画面での即時確認**:
   - ゲーム画面 (`index.html`) に戻り、リロードするだけで仮訳がすぐに反映されます。

---

### ユースケース 3: 暫定翻訳をマスター辞書 (`dictionary.csv`) へバックフィル（本反映）する

`tr_manager.html` や `nhMessage_ext.json` に蓄積された暫定翻訳は、リリースやチーム共有のためにマスター辞書 `dictionary.csv` へ統合（Backfill）します。

1. **`nhMessage_ext.json` または `tr_manager.html` からデータコピー**:
   - 確定した翻訳ペア（Source, Translation）を取得します。
2. **`dictionary.csv` へ追加**:
   - `dictionary.csv` を Excel やスプレッドシート、テキストエディタで開き、末尾に追記します。
   - **Group** 列に適切な値（`Message`, `Entity`, `Item`, `Pattern`）を指定します。
3. **マスター辞書から JS へのインポートビルド**:
   ```powershell
   python tools/dict_converter.py import
   ```
   - これにより `param/nhMessage.js` が自動更新されます。
4. **暫定データのクリア**:
   - バックフィル完了後は、`nhMessage_ext.json` やブラウザの `localStorage` の暫定データをクリアして構いません。

---

## 4. ファイル操作と CLI ツール活用ガイド

### A. マスター変換ツール (`tools/dict_converter.py`) の基本操作

マスター辞書である `dictionary.csv` と、WebUI 実行用ファイル `param/nhMessage.js` を相互変換する基本ツールです。**ファイル操作の手順は従来通り変更ありません。**

#### 1. 辞書を CSV にエクスポートする
`nhMessage.js` の内容を CSV に書き出します。

```powershell
# デフォルト（dictionary.csv）へエクスポート
python tools/dict_converter.py export

# 任意名でエクスポート
python tools/dict_converter.py export backup_dict.csv
```

#### 2. CSV から JS ファイルへインポートする
`dictionary.csv` の変更を `param/nhMessage.js` へ反映・生成します。

```powershell
# デフォルト（dictionary.csv）からインポート
python tools/dict_converter.py import

# 任意名からインポート
python tools/dict_converter.py import dictionary.csv
```

> [!IMPORTANT]
> **全自動変換の特記事項**:
> - インポート時、`[BEGIN: ...]` / `[END: ...]` や `=== TODO ===` などの作業用管理タグは全自動で綺麗に除去されて JS へ出力されます。
> - `Source` 列の半角スペースは、実行時マッチングの堅牢化のため自動的に `\s+`（正規表現スペース）に変換して書き出されます。

---

### B. NetHack 5.0 統合管理スクリプト (`tools/dev_scripts/manage_translations_5.0.py`)

大規模な翻訳網羅率の診断、新規ソースの自動抽出、LLMやGoogleによる一括自動翻訳、クリーンアップを行う高度な開発者用 CLI ツールです。

| コマンド | 使用例 | 説明 |
| :--- | :--- | :--- |
| **`status`** | `python tools/dev_scripts/manage_translations_5.0.py status` | グループごとの翻訳網羅率・未翻訳件数（TODO）を診断・集計。 |
| **`add`** | `python tools/dev_scripts/manage_translations_5.0.py add` | NetHack 5.0 本家 C/Lua ソースから未登録メッセージを自動抽出して CSV に追加。 |
| **`convert_patterns`**| `python tools/dev_scripts/manage_translations_5.0.py convert_patterns` | `%d`, `%s` 等を含むメッセージを `Pattern`（正規表現）へ自動移行。 |
| **`translate`** | `python tools/dev_scripts/manage_translations_5.0.py translate --limit 50` | 未翻訳項目を Google API または ローカルLLM（LM Studio / Ollama）で自動翻訳。 |
| **`clean`** | `python tools/dev_scripts/manage_translations_5.0.py clean` | ソース上に存在しなくなった古い孤立データを削除（※保護グループ `Message`, `Item`, `Entity` 等は絶対保護）。 |

---

## 5. 推奨する開発・プレイ・検証環境のまとめ

- **通常プレイ時**:
  - `index.html`（または `game.html`）でプレイしつつ、別ウィンドウに `tr_log.html` を配置。
  - 訳文とRAWを並行観察し、表現の揺れや誤訳の早期発見に努める。
- **デバッグ・試作時**:
  - `LANG_LEARNMODE` を ON にして未翻訳を収集。
  - `tr_manager.html` で暫定翻訳を作成し、リロード即確認。
  - 必要に応じて `tr_test.html` で単体パターンのテストを実施。
- **リリース・コミット時**:
  - `tr_manager.html` の暫定訳を `dictionary.csv` へバックフィル。
  - `python tools/dict_converter.py import` で `nhMessage.js` をビルドし、`git diff` で変更を確認。
