# NetHack Wasm Driver サンプルクライアント拡充計画 & 開発ガイドライン (`examples/`)

本ディレクトリ (`examples/`) は、**NetHack Wasm Driver (`@nethack/wasm-driver`)** を主要なモダン Web フロントエンドフレームワーク（Vue 3, React 18, Svelte, SolidJS 等）と結合した、高品質なフル機能サンプルクライアント群を提供する領域です。

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
| **`examples/vue-client`** | Vue 3 + Vite + TypeScript + Pinia | **【完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html) | 2D Canvas、メニュー、ヘルス、`driverController` シングルトン設計 |
| **`examples/react-client`** | React 18 + Vite + TypeScript + Zustand | **【完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/react-client/dist/index.html) | 2D Canvas、メニュー、ヘルス、Hooks 通信設計 |
| **`examples/svelte-client`** | Svelte 4/5 + Vite + TypeScript | **【完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/svelte-client/dist/index.html) | 2D Canvas、メニュー、ヘルス、Svelte Store 構成 |
| **`examples/solid-client`** | SolidJS + Vite + TypeScript | **【完了】** | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/solid-client/dist/index.html) | 2D Canvas、メニュー、ヘルス、Signals 高速構成 |

---

## 📖 公式開発ガイドライン & 参照ルール

各サンプルクライアントの更新・構築作業時は、必ず以下の公式ルールドキュメントを参照してください。

- 🔗 **[モダンWebコンポーネント版 サンプル更新作業ルール & 開発ガイドライン (`docs/Modern_Web_Components_Update_Rules.md`)](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/Modern_Web_Components_Update_Rules.md)**

### 🛡️ サンプル更新時の原則ルール (Core Rules)
1. **WebUIcore / Driver 凍結原則**: サンプル更新作業期間中、コアコード (`WebUICore.js` / Driver) は原則変更しません。
2. **Webコンポーネント側での調整 & パッチ記録**: 動作不具合や調整が必要な場合は、コンポーネント側でパッチ/アダプターとして吸収し、理由・本来あるべきコア仕様を各サンプルの `PATCH_LOG.md` に詳細記録します。
3. **ペンディング (Pending) 戦略**: フレームワークの制約等で解決が困難な問題が発生した場合は、深追いせずペンディング（保留）とし、次のコンポーネント版開発へ移ります。
4. **事後一括コア改善サイクル**: 全サンプル出揃い後、集約された `PATCH_LOG.md` から最適な WebUIcore/Driver の機能調整を行い、`webuicore_poc.html` で検証後に各サンプルへ戻り本実装化（パッチ解除）します。

---

## 🏛️ 全 Example 共通の最新アーキテクチャ & 設計基準 (v2.0)

新しいフレームワークの Example や独自クライアントを構築する際は、**以下の共通設計標準**を遵守して構築します。

### 1. 通信 & レスポンダー管理 (`driverController` シングルトン構造)
- **Singleton 通信コントローラー**: フレームワークの Reactive State (Vue 3 `ref` や Solid Signals) による Wasm レスポンダー (`Resolver`) の参照破損を防ぐため、通信ブリッジおよび Resolver の保持は **非 Proxy の Singleton クラス (`driverController`)** で一元管理する。
- **ドライバーコアの安全ガード自動提供**:
  - `SafeResolver`: 二重応答防止をドライバーコアが自動ガード。
  - `unwrapPayload`: Vue/Solid等の State (Proxy) オブジェクト送信時のディープコピー解体をドライバーコアが自動適用。
  - `normalizeMenuResponse`: メニュー応答の型・配列自動整列をドライバーコアが自動補正。

### 2. マップ描画 & 階層消去ルール
- **ハイブリッド 2D Canvas**: `@nethack/wasm-driver` からエクスポートされる `getTileMapping()` を使用してスプライト描画 (`nethack_default_32.png`)。スプライト未割り当て時や文字セルは 16 色 TTY カラー + monospace フォントで描画。
- **スプライト切出数式**: `tilesPerRow = 40`, `origTileSize = 32`。16px スプライト切り出し時は `background-size: 640px auto`。
- **マップ全消去 (`clearMapGrid`) のルール**:
  - 毎ターンの `clear_nhwindow(3)` では全消去を行わず、`print_glyph` 差分更新のみ維持する。
  - `status_update` で `field === 20` (`DLEVEL`) の構造化階層オブジェクト `dlevelData` またはポインタ文字列全体（例: `"Dlvl:1"`, `"Tut:1"`, `"Mines:1"`）が変化した時のみ `clearMapGrid()` を呼ぶ。

### 3. モーダル & 構造化プロンプト (`promptCategory`)
- **`promptCategory` タグによる条件分岐**:
  - `'YN'`: Yes/No ダイアログ (y/n/q ボタン & キーボードダイレクト受容)
  - `'TEXT'`: 1行テキスト入力フォーム (askname, getlin, #extcmd)
  - `'MENU'`: インベントリ・アイテム選択モーダル
  - `'FILE'`: テキストファイル/ヘルプ閲覧モーダル
- **方向入力 ("In what direction?") の取扱い**: `"direction"` は `isYNPrompt` 判定から除外して Yes/No モーダルを出さず、移動・攻撃方向キー（h, j, k, l, 矢印キー等）を直接返送する。
- **閲覧専用テキストモーダル (`TextWindowModal`)**: `display_nhwindow` (windowId >= 4) や `display_file` および選択不可メニュー (`lookupInformation` 等) のテキスト行をポップアップ表示し、`OK / ESC / Space / Enter` で閉じる。

---

## 🤖 新しい Conversation での依頼プロンプト例

別セッション（新しいチャット）を開始した際は、以下のように指示するだけで、AI が本ファイルを読解してノータイムで最高品質のサンプルクライアントを構築できます：

> **依頼プロンプト例**:
> 「`examples/README.md` の共通アーキテクチャ・設計基準に従って、新しいフレームワークのサンプルクライアントを構築してください。」
