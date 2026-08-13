# 📚 NetHack WASM WebUI ドキュメントポータル

本ディレクトリには、NetHack WASM WebUI プロジェクトのアーキテクチャ、コア技術仕様、GKL (Game Knowledge Layer)、翻訳、サウンド、ドライバに関する公式ドキュメントが格納されています。

---

## 📂 主要ドキュメント一覧

### 1. 🧠 [GKL (Game Knowledge Layer) 仕様・アーキテクチャ](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/gkl_documentation.md) (`docs/3_gkl/gkl_documentation.md`)
- C言語 NetHack WASM コアからのリアルタイム知識復元（3層レイヤーマップ、所持品解析、状況推定）。
- `ContextActionEngine` による推奨アクション先回り推論アルゴリズム。
- `SituationCache` および非同期サイレントインベントリ同期機能の仕様と使い方。

### 2. 📖 [WebUIcore 利用方法・機能仕様ガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/WebUICore_Usage_Guide.md) (`docs/WebUICore_Usage_Guide.md`)
- WebUICore の単一真実源 (Single Source of Truth) アーキテクチャ。
- 翻訳、音響、構造化プロンプト（YN/TEXT/MENU/FILE）のイベントハンドリングとデータバインド。

### 3. 📦 [WASM Driver & Web Worker 仕様](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/README.md) (`src/driver/README.md`)
- WASM Cコアエンジンを Web Worker 内で隔離実行する `@nethack/wasm-driver` の通信仕様。
- IDBFS によるセーブデータ永続化と復元メカニズム。

### 4. 🌐 [翻訳エンジン & 辞書ガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_translation/README.md) (`docs/3_translation/README.md`)
- `dictionary.csv` を用いた日本語自動翻訳・未翻訳ログ収集システム。

---

## 📁 ディレクトリ構造

```text
docs/
├── 1_driver/             # WASM Driver 関連設計書
├── 2_client_ui/          # クライアント UI 実装ガイド
├── 3_gkl/                # Game Knowledge Layer (GKL) 設計書
│   └── gkl_documentation.md
├── 3_translation/        # 翻訳辞書・翻訳エンジン仕様
├── 4_sound/              # Beepcore・Web Audio 仕様
├── 5_gamedata/           # ゲームデータパース仕様
├── 6_project_reports/    # プロジェクト引き継ぎ・報告書
├── 7_futures/            # 将来アーキテクチャ構想
└── 8_testing/            # テスト方針
```
