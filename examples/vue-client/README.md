# NetHack WebUICore - Vue 3 + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/vue-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、Vue 3 + TypeScript による公式サンプルアプリケーションです。

Pinia による状態管理、TypeScript による型安全なイベント受容、Vue 3 Composition API と `WebUICore` / `GKLPlugin` の構造化データ・ダイレクトバインド設計パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[Vue 3 サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

- **`useNetHackDriver.ts` (`NetHackDriverController`)**:
  - `WebUICore` を管理する Vue 3 用コントローラー。キーイベント一括委譲 (`sendKeyEvent`)、非同期セーブ削除、安全なリスタートおよび状況推論データ (`gklSituation`) / 周辺ズームセル (`getZoomAreaTiles`) 取得を担当。
- **`GklKnowledgePanel.vue` (🧠 GKL 状況推論 ＆ ナレッジアシスト)**:
  - **⚡ アイコン即時自動実行**: 所持品アイコンタップで `executeSequence` による装備・使用の一発即時実行。
  - **💡 浮き出し解説ポップアップ**: ホバー時にアイテム名・ワンタップアクション予告・日本語効果解説を浮き出し表示。
  - **🎽 装備バッジ ＆ 枠線カラー**: メイン武器 (`[手]`, `#e9c46a`)、副武器 (`[副]`, `#4ea8de`)、矢筒 (`[筒]`, `#2a9d8f`)、着用防具 (`[着]`, `#9d4edd`)。
  - **🎯 8方向アクションフィルター (`extractDirectionCode`)**: 8方向 ＋ 足元 (`SELF`) の正規化コードによる一貫したアクション絞り込みと件数バッジ。
  - **🔍 7x7 高精細ダンジョンズームカメラ**: プレイヤーを中心とした半径3マス（7x7=全49マス）の 24px スプライトタイル高密度ミニマップビューア。マス選択で日本語ナレッジカードを表示。
- **`GameCanvas.vue`**:
  - 2D Canvas マップ描画コンポーネント。正統スプライトマッピング (`nethack_default_32.png`) と 16 色 TTY フォント描画に対応。
- **`StatusBar.vue`**:
  - HP, Pw, AC, Gold, Exp, Dungeon Level (`DLEVEL` 構造化データ) 等のリアルタイムステータス表示。
- **`PromptModal.vue` / `MenuModal.vue` / `TextWindowModal.vue` / `GameOverModal.vue`**:
  - 各種モーダルUIコンポーネント。

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

1. **完全な疎結合設計 (GKL オプショナル設計)**:
   `WebUICore` 単体でも完全に独立して動作し、`GKLPlugin` を接続しない場合でも下部パネルが静かに待機するのみで、通常プレイに影響を与えません。
2. **Vue 3 Proxy 解除と Sequence 送信**:
   Vue 3 の Reactive Proxy 配列を `Array.from()` や `toRaw()` で解き、純粋な文字列配列にして `executeSequence` や `sendKey` フォールバックへ渡すことで一発実行の信頼性を保証します。
3. **未探索セル (`glyphId = 0`) の誤検出防止**:
   NetHack の Glyph ID 0 は `giant ant` に該当するため、`tileId === 0` かつ `symbol === ' '` のセルは `glyphId = -1` (未探索) として扱い誤判定を防ぎます。
