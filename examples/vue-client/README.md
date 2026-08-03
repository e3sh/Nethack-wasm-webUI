# NetHack Wasm Driver - Vue 3 + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/vue-client`) は、**`@nethack/wasm-driver`** を使用して構築された、Vue 3 + TypeScript による公式サンプルアプリケーションです。

Pinia による状態管理、TypeScript による型安全なイベント受容、Vue 3 Composition API と `@nethack/wasm-driver` の連携パターンを提示しています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[Vue 3 サンプルクライアントを体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)**

---

## ✨ 主な機能 ＆ コンポーネント構成

- **`useNetHackDriver.ts` (`driverController`)**:
  - `NetHackWasmWorkerBridge` を管理する Singleton コントローラー。Vue 3 の Reactive Proxy 変換による Wasm レスポンダーの破損を完全に防止し、安全な通信インターフェースを提供。
- **`MapCanvas.vue`**:
  - 2D Canvas マップ描画コンポーネント。正統スプライトマッピング (`nethack_default_32.png`) と 16 色 TTY フォント描画に対応。
- **`StatusBar.vue`**:
  - HP, Pw, AC, Gold, Exp, Dungeon Level (`DLEVEL` 構造化データ) 等のリアルタイムステータス表示。
- **`InputPrompt.vue`**:
  - `promptCategory` に応じた Yes/No ボタン・テキスト入力フォームおよびテンキー/ダイレクトキー受容。
- **`MenuModal.vue` / `TextWindowModal.vue`**:
  - インベントリ・アイテム選択メニューおよび閲覧専用テキスト（`lookupInformation` / ヘルプファイル）のモーダル表示。

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

## 🏛️ アーキテクチャと安全機能

`@nethack/wasm-driver` コアパッケージ側に以下の安全機構が標準搭載されているため、UI 側で複雑なエラーハンドリングを記述する必要はありません：

1. **SafeResolver (二重応答の自動ガード)**: ボタンクリックとキー入力が重複しても 2 回目以降は安全な no-op となります。
2. **unwrapPayload (Proxy ディープコピー解体)**: Vue 3 の State (Proxy) オブジェクトを Worker へ送る際、自動的にディープコピーアンラップされます。
3. **promptCategory (構造化プロンプトタグ)**: `'YN'`, `'TEXT'`, `'MENU'`, `'KEY'`, `'FILE'` などのタグが自動付与されるため、UI 側はシンプルな条件分岐で実装可能です。
4. **isUserPromptContext (コンテキスト保護)**: 非入力画面表示による入力待ちプロンプトの誤破棄を自動保護します。
