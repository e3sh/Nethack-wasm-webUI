# NetHack Wasm Driver サンプルクライアント (`examples/`)

本ディレクトリ (`examples/`) は、**`WebUICore` / NetHack Wasm Driver (`@nethack/wasm-driver`)** を主要なモダン Web フロントエンドフレームワーク（Vue 3, React 18, SolidJS, Svelte, Pure JS 等）と結合したサンプルクライアント群を提供する領域です。

各サンプルは 2カラム構成や GKL（Game Knowledge Layer）との連携（フォーカスカメラ、インベントリ、ナレッジ表示等）の参照実装として活用できます。

すべてのサンプルはスタンドアロン静的ビルド (`dist/`) に対応しており、GitHub Pages 上でブラウザからそのまま直接動作確認が可能です。

---

## 🎮 ライブデモ (Live Demo)

- **Vue 3 サンプルクライアント**: 
  - 🔗 **[Vue 3 Client を開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)**
- **React 18 サンプルクライアント**: 
  - 🔗 **[React 18 Client を開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/react-client/dist/index.html)**
- **SolidJS サンプルクライアント**: 
  - 🔗 **[SolidJS Client を開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/solid-client/dist/index.html)**
- **Svelte サンプルクライアント**: 
  - 🔗 **[Svelte Client を開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/svelte-client/dist/index.html)**

---

## 🗺️ サンプルクライアント一覧 (Examples Overview)

| ディレクトリ | 技術スタック | 状態 | ライブデモ | 特徴・構成例 |
| :--- | :--- | :--- | :--- | :--- |
| **`examples/vue-client`** | Vue 3 + Vite + TypeScript + Pinia | 【サンプル実装】 | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html) | 2カラムUI、フォーカスカメラ、Visual FX、HUDシグナル、スプライトインベントリ、GKLナレッジ・アドバイス連携 |
| **`examples/react-client`** | React 18 + Vite + TypeScript + Zustand | 【サンプル実装】 | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/react-client/dist/index.html) | 2カラムUI、フォーカスカメラ、Zustand状態管理、GKLナレッジ・アドバイス連携 |
| **`examples/solid-client`** | SolidJS + Vite + TypeScript | 【サンプル実装】 | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/solid-client/dist/index.html) | 2カラムUI、SolidJS Signals/Store によるリアクティブ連携、フォーカスカメラ |
| **`examples/svelte-client`** | Svelte 4/5 + Vite + TypeScript | 【サンプル実装】 | [🎮 開く](https://e3sh.github.io/Nethack-wasm-webUI/examples/svelte-client/dist/index.html) | 2カラムUI、Svelte Writable Store による軽量リアクティブ連携、フォーカスカメラ |
| **`examples/gkl-pure-js-client`** | Vanilla ES Modules + CSS | 【サンプル実装】 | - | フレームワーク非依存の純粋な JS / CSS による GKL 連携サンプル |
| **`examples/pure-js-client`** | Pure ES Modules JS + HTML5 Canvas | 【最小構成】 | - | フレームワーク非依存の最小構成 `WebUICore` 直用クライアント |
| **`examples/legacy-client`** | Canvas 2D / Touch | 【旧仕様参考】 | - | 従来のクラシックタイル描画とモバイル用バーチャルパッド実装 |

---

## 🏛️ 最新フラッグシップ（Vue 3 / React 18）の共通UIアーキテクチャ

Vue 3 版および React 18 版では、以下のモダンな 2 カラム＋オーバーレイ UI 設計が採用されています：

```text
+------------------------------------------------------------------------------------------------------+
|  HeaderPanel: ビューポート切替 (Canvas / ASCII), ズームトグル, 言語切替 (日英), セーブ/リセット           |
+-------------------------------------------------------------------+----------------------------------+
|  [左カラム: メインゲーム画面]                                      |  [右カラム: GKL 知能パネル]      |
|                                                                   |                                  |
|  +-------------------------------------------------------------+  |  1. 🛡️ AssistSignalBar (HUD)     |
|  | GameViewport: メイン Canvas / ASCII テキスト描画             |  |     Level 3 緊急ワンタップ対応   |
|  |                                                             |  |                                  |
|  | +---------------------------------------------------------+ |  |  2. 🧭 DirectionPad & Actions    |
|  | | FocusCamera: 21x9 中央フォーカス・ズームビュー          | |  |     3x3方向連動推奨アクション    |
|  | |   自キャラバウンス / Visual FX / 死亡時墓石 / 移動連携   | |  |                                  |
|  | +---------------------------------------------------------+ |  |  3. 🎒 InventoryGrid (32px)      |
|  |                                                             |  |     Nano Badge / BUC / 熟練(+)   |
|  | FloorLandmarksHud: 階段・祭壇・泉・店舗バッジ ＆ 自動移動    |  |                                  |
|  +-------------------------------------------------------------+  |  4. 💡 GklKnowledgeTabs          |
|                                                                   |     戦術アドバイス ＆ ナレッジ   |
|  StatusBar: HP/MP ゲージ, 属性耐性, 修得魔法, スキル熟練度        |                                  |
|  InputPrompt: コマンド待機中ガイド, 方向・文字入力, 多言語対応     |                                  |
+-------------------------------------------------------------------+----------------------------------+
|  [オーバーレイ モーダル群]                                                                           |
|  WishModal (#wish ビルダー), MenuModal, TextWindowModal, GameOverModal, SaveSelectorModal             |
+------------------------------------------------------------------------------------------------------+
```

---

## 📖 公式開発ガイドライン & 参照ルール

各サンプルクライアントの更新・構築作業時は、以下の公式ルールドキュメントを参照してください。

- 🔗 **[モダンWebコンポーネント版 サンプル更新作業ルール & 開発ガイドライン (`docs/Modern_Web_Components_Update_Rules.md`)](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/Modern_Web_Components_Update_Rules.md)**

### 🛡️ 設計原則
1. **SSOT (Single Source of Truth) の遵守**:
   - メッセージテキストから内部状態（所持品や習得魔法）を直接推測・変更するアンチパターンを排除。
   - メッセージは `invalidate()` によるダーティフラグ立てのみを行い、実データは NetHack 本体のクエリ（`+`, `i`, `^X`, `#enhance` 等）から得られる構造化データから確定同期する。
2. **完全な疎結合設計 (GKL オプショナル設計)**:
   - `WebUICore` 単体でも完全に独立して動作し、`GKLPlugin` を接続しない場合でも通常プレイに一切影響を与えません。
3. **統一キーイベント委譲 (`sendKeyEvent`)**:
   - 各コンポーネントで自前のキーマッピングを行わず、`core.sendKeyEvent(e)` へ委譲することで一貫した操作性を担保。
