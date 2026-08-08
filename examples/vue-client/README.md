# NetHack Wasm Driver - Vue 3 + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/vue-client`) は、**`WebUICore` / `@nethack/wasm-driver`** を使用して構築された、Vue 3 + TypeScript による公式サンプルアプリケーションです。

Pinia による状態管理、TypeScript による型安全なイベント受容、Vue 3 Composition API と `WebUICore` の構造化データ・ダイレクトバインド設計パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[Vue 3 サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

- **`useNetHackDriver.ts` (`NetHackDriverController`)**:
  - `WebUICore` を管理する Vue 3 用コントローラー。キーイベント一括委譲 (`sendKeyEvent`)、非同期セーブ削除、安全なリスタートおよび状態同期を担当。
- **`GameCanvas.vue`**:
  - 2D Canvas マップ描画コンポーネント。正統スプライトマッピング (`nethack_default_32.png`) と 16 色 TTY フォント描画に対応。
- **`StatusBar.vue`**:
  - HP, Pw, AC, Gold, Exp, Dungeon Level (`DLEVEL` 構造化データ) 等のリアルタイムステータス表示。
- **`InputPrompt.vue` (第 2 サイクル極限スリム化済)**:
  - `WebUICore` が生成する構造化プロパティ (`inputType`, `options`, `promptText`, `choicesHint`) をダイレクト参照し、手動パース全廃によりコード量を約 70% 削減した入力プロンプト。
- **`MenuModal.vue` / `TextWindowModal.vue`**:
  - インベントリ・装備アイテム選択メニューおよび閲覧専用テキスト（`lookupInformation` / ヘルプファイル）のモーダル表示。
- **`GameOverModal.vue`**:
  - 死因・タイトルおよび Top 10 Hall of Fame スコアボードの表示。

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

## 🏛️ アーキテクチャと標準機能

`WebUICore` コアパッケージ側に以下の機能が標準搭載されているため、コンポーネント側は数行のダイレクトバインドのみで直観的に実装可能です：

1. **GUI 構造化データパイプライン (`guiData`)**: `inputType` (`'CHOICE_BUTTONS'`, `'LINE_TEXT'`, `'DIRECTION'`, `'MENU'`) および各ボタン配列 (`options`) が自動生成されて届きます。
2. **統一キーマッパー (`sendKeyEvent`)**: 生の `KeyboardEvent` を一括受容し、Ctrl/Alt 修飾キーや Arrow キーを標準 ASCII コードへ自動変換します。
3. **SafeResolver (二重応答の自動ガード)**: ボタンクリックとキー入力が重複しても 2 回目以降は安全な no-op となります。
4. **セーブ削除・リスタート API**: `deleteSaveFile()` およびクリーンリスタート処理に対応。
