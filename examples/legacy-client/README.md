# 🏛️ NetHack WASM WebUI Desktop Canvas & Mobile Touch Clients (`examples/legacy-client/`)

本ディレクトリ (`examples/legacy-client/`) は、**共通コアエンジン `WebUICore` (`src/core/`) に完全フィッティング（統合）**されたバニラ JS クライアント群（`game.html`, `game_jp.html`, `mobile.html`, `rogue/`）を格納している領域です。

歴史的経緯によりフォルダ名は `legacy-client` となっておりますが、内部のデータ通信・状態管理・スコア解析は全て共通コア **`WebUICore`** に接続されています。

---

## 📌 アーキテクチャと特徴

1. **`WebUICore` 完全適合**:
   - `WebUICore` (`src/core/WebUICore.js`) をメディエーター接続し、型安全なステータス参照 (`StatusAccessor`) や全自動スコア/死因解析 (`GameOverResolver`) を一元利用して動作します。

2. **独自 Canvas タイル描画 & モバイル DOM タッチ操作**:
   - **`game.html` / `game_jp.html`**: 独自グラフィックタイル＆日本語フォントの高度な協調制御を備えた、キーボード/ゲームパッド操作に最適な Desktop Canvas クライアント。
   - **`mobile.html`**: スマホ・タブレット向けにレスポンシブな下部ステータス表示枠とコンテキストバーチャルパッドを備えた Touch クライアント。

3. **フレームワーク非依存 (Pure JS)**:
   - React / Vue 等の外部ライブラリを持たないバニラ JS 実装のため、超軽量かつ高いパフォーマンスを発揮します。

---

## 🎮 収録ファイル一覧

- **`game.html`**: Desktop Canvas クライアント (WebUICore Canvas モード)
- **`game_jp.html`**: NetHackJP Native UTF-8 モード
- **`mobile.html`**: モバイル端末向け DOM/タッチ操作クライアント (WebUICore Mobile モード)
- **`rogue/`**: Canvas/DOM 描画エンジン、サウンド、UIマネージャー群
