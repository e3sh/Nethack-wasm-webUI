# NetHack 翻訳ドキュメント＆ガイドインデックス

本フォルダ（`docs/3_translation/`）には、NetHack Wasm WebUI 移植プロジェクトにおける翻訳システム、辞書データ運用、支援ツールの使用法に関する説明ドキュメントが格納されています。

目的や作業内容に応じて、以下のドキュメントを参照してください。

---

## 📚 ドキュメント構成一覧

### 1. 📖 [翻訳支援ツール＆リアルタイム検証環境ガイド](translation_support_tools.md)
> **おすすめ: まず最初に読むべきドキュメント**
> 
> - **内容**: プレイ中に別タブ・別ウィンドウでリアルタイム対比ログ（`tr_log.html`）や未翻訳管理画面（`tr_manager.html`）を表示しておく並行運用環境の構築・活用方法。
> - **対象**: プレイしながら訳文から原文（RAW）を確認したい方、不自然な訳が出たときに即座にデバッグしたい方、各種翻訳支援ツールの使い方を知りたい方。

### 2. 📖 [辞書更新オペレーションガイド](DICTIONARY_OPERATION.md)
> **標準ファイル操作手順**
> 
> - **内容**: マスター辞書 `dictionary.csv` の編集方法、エクスポート・インポートコマンド（`python tools/dict_converter.py`）の使い方、データの種類（Message, Entity, Item, Pattern）に関するルール。
> - **対象**: 辞書データを手動で更新・ビルドしたい方。

### 3. 📖 [NetHack メッセージ翻訳フロー解説](translation_flow.md)
> **翻訳エンジンの内部仕組み**
> 
> - **内容**: 翻訳エンジンの優先順位（全文一致 ➔ 単語一致 ➔ 正規表現パターン ➔ アイテム分解）、再帰翻訳、品詞指定子（`:adj`, `:verb`）の内部仕様。
> - **対象**: 複雑な文章のパターンスキームを作成する方、エンジンのマッチング挙動を深く理解したい方。

### 4. 📖 [NetHack 5.0 翻訳システム統合管理ガイド](translation_management_guide_5.0.md)
> **開発者向け大規模スキャン＆自動翻訳ガイド**
> 
> - **内容**: 開発者用統合 CLI ツール `tools/dev_scripts/manage_translations_5.0.py`（網羅率診断 `status`、自動スキャン `add`、自動翻訳 `translate`、クリーンアップ `clean`）の使い方と実施済み開発実績。
> - **対象**: NetHack 5.0 本家リポジトリのソース変更に対応する開発者、ローカルLLM/Google APIによる自動下訳を実行したい方。

### 5. 📖 [NetHack 5.0 Lookup Information 翻訳手順書](translation_guide.md) （※実施済み・参考資料）
> **解説文（data.base）データベース翻訳手順（アーカイブ）**
> 
> - **内容**: モンスター・アイテム等の解説データベース（`data.base`）の未翻訳検出、`[BEGIN]` / `[END]` タグ付きブロックの翻訳手順。
> - **状態**: **現時点の翻訳作業は全件実施・反映済みです。** NetHack 本家側で `data.base` の大規模更新があった場合のみ参照する参考資料（アーカイブ）です。

---

## 🌐 WebUIcore (`TranslationEngine`) との統合ワークフロー

現在のモダンクライアント群（Vue, React, Svelte, Solid, Pure JS）では、**`src/core/translation/TranslationEngine.js`** がゲーム内の全メッセージ翻訳を一括管理しています。

```text
 NetHack WASM Core Engine
         │
         ▼
 WebUIcore (TranslationEngine) ────► 1. 翻訳済メッセージを各 UI クライアントへ送信
         │
         ├─► 未翻訳文章の自動記録 ──► localStorage ("nh.temp")
         │                                   │
         │                                   ▼
         │                            tr_manager.html (ブラウザ上での辞書試作・登録)
         │                                   │
         └─► カスタム追加辞書の即時適用 ◄────┴─► localStorage ("nh.ext_data")
```

1. **未翻訳ログの自動収集**: `WebUICore` 搭載クライアントでプレイ中、未翻訳の原文が `localStorage: nh.temp` へ自動ストックされます。
2. **辞書作成・反映**: プレイ中に別タブで **`tr_manager.html`** を開くことで、`nh.temp` の未翻訳項目をGUI上で直接翻訳・テスト登録できます（`nh.ext_data` へ保存され即座にゲーム画面に適用可能）。
3. **マスター辞書への同期**: 作成した翻訳は `dictionary.csv` 経由でリポジトリのマスター辞書へ反映されます。
4. **GKL 構造化ナレッジ連携 (Lazy Memoization)**: GKL (`StructuredKnowledgeEngine`) から参照される全アイテム・全モンスター・全地形の静的マスターは、初回アクセス時にのみ `TranslationEngine.translate()` を 1 度呼び出してキャッシュ固定化（初回遅延固定化）されます。これにより、プレイ中のインベントリ同期やマップホバー時に大量の単語が対比ログ（`tr_log.html`）に重複して流れることがなくなり、翻訳エンジンへの負荷が最小化されます。

---

## 🛠️ クイックリファレンス（よく使うコマンド）

```powershell
# 1. 辞書を CSV にエクスポート
python tools/dict_converter.py export

# 2. CSV の変更を param/nhMessage.js へ反映（インポート）
python tools/dict_converter.py import

# 3. 翻訳網羅率・残未翻訳数の集計
python tools/dev_scripts/manage_translations_5.0.py status
```
