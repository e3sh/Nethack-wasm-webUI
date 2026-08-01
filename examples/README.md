# NetHack Wasm Driver サンプルクライアント拡充計画 & 開発ガイドライン (`examples/`)

本ディレクトリ (`examples/`) は、**NetHack Wasm Driver (`@nethack/wasm-driver`)** を主要な各種モダン Web フロントエンドフレームワーク（Vue, React, Svelte, SolidJS 等）と結合した、高品質なフル機能サンプルクライアント群を保持・提供する領域です。

すべてのサンプルはスタンドアロン静的ビルド (`dist/`) に対応しており、**GitHub Pages 上で 1 クリックでブラウザからそのまま直接体験・プレイ可能**です。

---

## 🎮 ライブデモ (Live Demo)

- **Vue 3 サンプルクライアント**: 
  - 🔗 **[Vue 3 Client をブラウザで今すぐ試す](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)** *(※ GitHub Pages 配備時は `https://<username>.github.io/<repo>/examples/vue-client/dist/`)*

---

## 🗺️ サンプルクライアント・ロードマップ (Examples Roadmap)

| ディレクトリ | フレームワーク / 技術スタック | 状態 | ライブデモ | 概要 |
| :--- | :--- | :--- | :--- | :--- |
| **`examples/vue-client`** | Vue 3 + Vite + TypeScript + Pinia | **【完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html) | 2D Canvas、メニュー、ヘルス、万能プロンプト、型安全接続 |
| **`examples/react-client`** | React 18 + Vite + TypeScript | **【計画中】** | - | Custom Hooks + React Context / Zustand 構成 |
| **`examples/svelte-client`** | Svelte 4/5 + Vite + TypeScript | **【計画中】** | - | 超軽量コンパイル & Svelte Store 構成 |
| **`examples/solid-client`** | SolidJS + Vite + TypeScript | **【計画中】** | - | Signals 爆速レンダリング構成 |

---

## 🏛️ 全 Example 共通のアーキテクチャ & 設計基準

新しい Conversation（会話）で新しいフレームワークの Example を作成する際は、**以下の共通設計標準および実績ノウハウを 100% 遵守**して構築します。

### 1. 通信 & レスポンダー管理 (`NetHackWasmWorkerBridge`)
- **Resolver の分離保持**: メニュー用 `activeMenuResolver` と 汎用プロンプト用 `activePromptResolver` を完全に分離管理する。
- **二重応答防止 (`createSafeResolver`)**: 同じ Resolver に対して `respond()` が二重呼び出しされて Worker 内で `Resolver not found or already resolved` 警告が発生するのを防止する安全ラッパーを適用する。
- **データオブジェクトのアンラップ (`toRaw` / Plain Copy)**: Vue や Reactive シグナルの `Proxy` を解除し、Plain JavaScript Object に変換してから Worker へ `postMessage` する（`DataCloneError` 防止）。
- **`select_menu` 応答フォーマットの厳守**: 選択時は「アイテムオブジェクトの配列 `[item]`」、キャンセル時/空メニュー時は数値 `0` を返す（`NetHackWasmDriver.js:671` の `res.charCodeAt` クラッシュ防止）。

### 2. マップ描画 & 階層消去ルール
- **ハイブリッド 2D Canvas**: `param/tileMapping.js` の `tileMapping()` 関数から Tile Index を取得してスプライト描画 (`nethack_default_32.png`)。スプライト未割り当て時や文字セルは 16 色 TTY カラー + monospace フォントで描画。
- **スプライト切出数式**: `tilesPerRow = 40`, `origTileSize = 32`。16px スプライト切り出し時は `background-size: 640px auto`。
- **マップ全消去 (`clearMapGrid`) の正統ルール**:
  - 歩行時の毎ターンの `clear_nhwindow(3)` では全消去を行わず、`print_glyph` 差分更新のみ維持する（画面の背景ブラックアウト防止）。
  - `status_update` で `field === 20` (`DLEVEL`) のポインタ文字列全体（例: `"Dlvl:1"`, `"Tut:1"`, `"Mines:1"`）が変化した時のみ `clearMapGrid()` を呼ぶ。
  - `askname` / `initialized` 発火時に初回 `clearMapGrid()` を呼ぶ。

### 3. モーダル & 万能プロンプトハンドラ
- **万能プロンプト (`InputPrompt`)**:
  - `type === 'string'` または `getlin` / `askname` / `#` (`get_ext_cmd`) ➔ テキスト入力フォーム (+ `Submit` & `Cancel (ESC)` ボタン)
  - 上記以外 ➔ `Yes (y)` / `No (n)` / `Cancel (ESC)` ボタンをデフォルト描画し、全キーボード入力（a〜z, Enter, ESC, y, n）をダイレクト受容（無表示・フリーズの100%防止）。
- **キー操作分離ガード**: テキスト入力フォーカス中、プロンプト表示中、モーダル表示中は、グローバル移動キー（hjkl, 矢印キー）の Wasm 送信を 100% 遮断する。
- **閲覧用長文モーダル (`TextWindowModal`)**: `display_nhwindow` (windowId >= 4) や `display_file` で届くテキスト行をポップアップ表示し、`OK / ESC / Space / Enter` で `0` を返して安全解放する。
- **案内専用メニュー (`how === 0`)**: `select_menu` で `items` が空の場合は即座に `0` を返送。選択肢のない案内メニューは `how === 0` 閲覧専用モードとして開き `OK / ESC` で閉じる。

---

## 🤖 新しい Conversation での依頼プロンプト例

別セッション（新しいチャット）を開始した際は、以下のように指示するだけで、AI が本ファイルを読解してノータイムで最高品質のサンプルクライアントを構築できます：

> **依頼プロンプト例**:
> 「`examples/README.md` の共通アーキテクチャ・設計基準に従って、`examples/react-client`（React 18 + Vite + TypeScript）のサンプルクライアントを構築してください。」
