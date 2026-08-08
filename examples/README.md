# NetHack Wasm Driver サンプルクライアント拡充計画 & 開発ガイドライン (`examples/`)

本ディレクトリ (`examples/`) は、**`WebUICore` / NetHack Wasm Driver (`@nethack/wasm-driver`)** を主要なモダン Web フロントエンドフレームワーク（Vue 3, React 18, Svelte, SolidJS 等）と結合した、高品質なフル機能サンプルクライアント群を提供する領域です。

すべてのサンプルはスタンドアロン静的ビルド (`dist/`) に対応しており、**GitHub Pages 上で 1 クリックでブラウザからそのまま直接プレイ可能**です。

---

## 🎮 ライブデモ (Live Demo)

- **Vue 3 サンプルクライアント**: 
  - 🔗 **[Vue 3 Client をブラウザで今すぐ試す](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)**
- **React 18 サンプルクライアント**: 
  - 🔗 **[React 18 Client をブラウザで今すぐ試す](https://e3sh.github.io/Nethack-wasm-webUI/examples/react-client/dist/index.html)**
- **Svelte サンプルクライアント**: 
  - 🔗 **[Svelte Client をブラウザで今すぐ試す](https://e3sh.github.io/Nethack-wasm-webUI/examples/svelte-client/dist/index.html)**
- **SolidJS サンプルクライアント**: 
  - 🔗 **[SolidJS Client をブラウザで今すぐ試す](https://e3sh.github.io/Nethack-wasm-webUI/examples/solid-client/dist/index.html)**

---

## 🗺️ サンプルクライアント一覧 (Examples Overview)

| ディレクトリ | フレームワーク / 技術スタック | 状態 | ライブデモ | 概要 |
| :--- | :--- | :--- | :--- | :--- |
| **`examples/pure-js-client`** | Pure ES Modules JS + HTML5 Canvas | **【標準リファレンス】** | - | フレームワーク非依存の `WebUICore` 直用軽量クライアント |
| **`examples/vue-client`** | Vue 3 + Vite + TypeScript + Pinia | **【第2サイクル統一完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html) | `WebUICore` 構造化データ、2D Canvas、`sendKeyEvent` 統一キーマッパー |
| **`examples/react-client`** | React 18 + Vite + TypeScript + Zustand | **【第2サイクル統一完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/react-client/dist/index.html) | `WebUICore` 構造化データ、2D Canvas、`sendKeyEvent` 統一キーマッパー |
| **`examples/svelte-client`** | Svelte 4/5 + Vite + TypeScript | **【第2サイクル統一完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/svelte-client/dist/index.html) | `WebUICore` 構造化データ、2D Canvas、`sendKeyEvent` 統一キーマッパー |
| **`examples/solid-client`** | SolidJS + Vite + TypeScript | **【第2サイクル統一完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/solid-client/dist/index.html) | `WebUICore` 構造化データ、2D Canvas、`sendKeyEvent` 統一キーマッパー |

---

## 📖 公式開発ガイドライン & 参照ルール

各サンプルクライアントの更新・構築作業時は、必ず以下の公式ルールドキュメントを参照してください。

- 🔗 **[モダンWebコンポーネント版 サンプル更新作業ルール & 開発ガイドライン (`docs/Modern_Web_Components_Update_Rules.md`)](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/Modern_Web_Components_Update_Rules.md)**

### 🛡️ 開発サイクルの運用原則
1. **第 1 サイクル (課題収集)**: 各クライアントを泥臭く実装し、コアの改善点・不都合を `PATCH_LOG.md` に集約・記帳。
2. **第 2 サイクル (本実装 ＆ 超削減)**: `WebUICore` の統一 API を通じてコンポーネント側の泥臭手動コードを全排斥し、数行の構造化データダイレクトバインドへ極限スリム化。

---

## 🏛️ 全 Example 共通の最新アーキテクチャ & 設計基準 (v2.0)

新バージョン (`WebUICore` 構造化データ導入後) の設計標準：

### 1. 構造化データダイレクトバインド (`guiData`)
- `WebUICore` から届く構造化 `payload` のプロパティ (`inputType`, `options`, `promptText`, `choicesHint`) をそのままテンプレートにマッピング。
- `InputPrompt` コンポーネント内の手動文字分解や条件文パースを完全排斥（コード量 70〜80% 削減）。

### 2. 統一キーイベント委譲 (`sendKeyEvent`)
- `handleGlobalKeyDown` 内で自前の `if (e.ctrlKey || e.altKey)` や ASCII 判定を行わず、`core.sendKeyEvent(e)` へ直接丸投げ。
- 修飾キー (Ctrl/Alt) や Arrow キー・テンキー変換は `WebUICore` 内部の `KeyMapper` が一貫して自動処理。

### 3. マップ描画 & 階層消去ルール
- **ハイブリッド 2D Canvas**: `getTileMapping()` を使用してスプライト描画 (`nethack_default_32.png`)。
- **マップ自動消去**: `status_update` の `DLEVEL` 変更をトリガーとして `clearMapGrid()` を自動実行。
