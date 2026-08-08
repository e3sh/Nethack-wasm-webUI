# 🏛️ NetHack WASM WebUI Legacy Prototype Clients (`legacy/`)

本ディレクトリ (`legacy/`) は、`WebUIcore` (`src/core/`) 導入前に開発された初期のフル機能プロトタイプクライアント群（`game.html`, `game_jp.html`, `mobile.html`, `rogue/` スクリプト等）を格納・隔離した領域です。

---

## 📌 位置づけと設計原則

1. **歴史的動作実績の保護 (Legacy Reference)**:
   - 本ディレクトリ内のコードは、`WebUIcore` 設計前のオリジナル実装として動作・構造を保持しています。
   - 強引なリファクタリングを行わず、過去の動作検証や機能参照用のレガシー環境として固定保存しています。

2. **新アーキテクチャへの推奨**:
   - 新規開発や拡張は、共通コアエンジンである **`WebUIcore` (`src/core/WebUICore.js`)** および `examples/` 配下のモダンクライアント（Vue 3, React 18, Svelte, SolidJS, Pure JS）をご利用ください。

---

## 🎮 収録ファイル一覧

- **`game.html`**: デスクトップ用 Canvas 描画初期プロトタイプ (include.js 経由)
- **`game_jp.html`**: NetHackJP Native UTF-8 動作検証用プロトタイプ (include_jp.js 経由)
- **`mobile.html`**: スマホ・モバイル端末向け DOM/タッチ操作プロトタイプ
- **`rogue/`**: 初期プロトprototype用 UI/サウンド/ロジックマネージャー群

---
