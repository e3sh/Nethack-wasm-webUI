# NetHack WebUICore - Vue 3 + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/vue-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、Vue 3 + TypeScript によるサンプルアプリケーションです。

Pinia による状態管理、TypeScript による型安全なイベント受容、Vue 3 Composition API と `WebUICore` / `GKLPlugin` を統合した2カラム＋オーバーレイUI構造を提供します。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[Vue 3 サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

- **`useNetHackDriver.ts` (`NetHackDriverController`)**:
  - `WebUICore` と GKL を一括管理するコントローラー。Visual FX 発火、サイレント同期（`syncPendingStateSilent`）、オンデマンドLook、自動移動（Travel）連携を提供。
- **`FocusCamera.vue` (🔍 21x9 中央フォーカス・ズームビュー)**:
  - プレイヤーを中心とした 21x9 の中央配置ズームカメラ。自キャラ移動時のバウンス演出、Visual FX（攻撃・被ダメージ・回復・死亡・蘇生エフェクト）、死亡時墓石、Look / クリック自動移動に対応。
- **`FloorLandmarksHud.vue` (🚩 階層・フロア設備HUD)**:
  - 現在階層、発見済みランドマーク（上り階段・下り階段・祭壇・泉・店舗など）をアイコンバッジ一覧化し、ワンクリックでその設備へ自動移動。
- **`AssistSignalBar.vue` (🛡️ 最優先HUDシグナル)**:
  - 危険度点滅、スタンス（戦闘・警戒・通常）、Level 3 緊急ワンタップ実行アクションボタン、Why 理由ツールチップ。
- **`DirectionPad.vue` & `ContextActions.vue` (🧭 方向パッド ＆ 推奨アクション)**:
  - 3x3 方向パッドフィルター、方向連動推奨アクションカード、キーバッジ、戦闘/危険ハイライト。
- **`InventoryGrid.vue` (🎒 32px スプライトインベントリ)**:
  - 32px スプライト、Nano Badge（危険・注意・情報）、BUC（祝福・呪い・未識別）、得意武器 (`+`) バッジ、ワンタップ装備/使用メニュー。
- **`GklKnowledgeTabs.vue` (💡 戦術アドバイス ＆ ナレッジタブ)**:
  - 🛡️ アドバイスタブ（戦術・危機アドバイス一覧） ＆ 💡 調査ナレッジタブ（詳細スペック、耐性・弱点・特性タグ、ステータス）。
- **`StatusBar.vue` (📊 ゲージ ＆ 詳細ステータスバー)**:
  - HP/MP ゲージ、6大能力値、確定属性耐性、修得魔法、スキル熟練度。
- **`WishModal.vue` (✨ `#wish` ビルダー)**:
  - プリセット（アーティファクト・定番装備・道具）、インクリメンタル検索、生成プレビュー。
- **`InputPrompt.vue` (💬 プロンプトバー)**:
  - 待機時コマンド案内ガイド、方向/テキスト/YesNoプロンプト、多言語（日英）動的切替。
- **`GameViewport.vue` / `GameCanvas.vue`**:
  - 32px Canvas スプライト描画 と 16色 ASCII Grid のリアルタイム切替表示。
- **各種オーバーレイモーダル (`MenuModal`, `TextWindowModal`, `GameOverModal`, `SaveSelectorModal`)**:
  - NetHack 本体のメニュー、テキストウィンドウ、セーブデータ選択、ゲームオーバー結果表示。

---

## 🚀 起動 & ビルド方法

### 開発用ローカルサーバーの起動 (Vite)
プロジェクトルートディレクトリにて：

```bash
npm run dev:vue
```
自動的に `http://localhost:3000/` が立ち上がり、ホットリロード対応の開発環境が開きます。

### スタンドアロンビルド
```bash
# examples/vue-client ディレクトリにて
npm run build
```
ビルド完了後、`examples/vue-client/dist/` ディレクトリ内に完全に自己完結した静的パッケージが生成されます。

---

## 🏛️ アーキテクチャと構築ガイドライン

1. **SSOT (Single Source of Truth) の遵守**:
   - メッセージテキストから内部状態を直接推測・変更せず、NetHack 本体のクエリ（`+`, `i`, `^X`, `#enhance` 等）から得られたデータから確定同期します。
2. **完全な疎結合設計 (GKL オプショナル設計)**:
   - `WebUICore` 単体でも完全に独立して動作し、`GKLPlugin` を接続しない場合でも通常プレイに一切影響を与えません。
3. **未探索セル (`glyphId = 0`) の誤検出防止**:
   - NetHack の Glyph ID 0 は `giant ant` に該当するため、`tileId === 0` かつ `symbol === ' '` のセルは `glyphId = -1` (未探索) として扱い誤判定を防ぎます。
