# NetHack Wasm Driver - Vue 3 + Vite + TypeScript サンプルクライアント

本サンプルクライアント (`examples/vue-client`) は、**`@nethack/wasm-driver`** を使用して構築された、Vue 3 + TypeScript による実践的な WebUI アプリケーションです。

単なる「動くだけ」の最小サンプルではなく、プロダクション運用や他フレームワーク（React, Svelte, SolidJS 等）への移植の『正解のお手本』となるよう、エッジケース・キー入力競合・二重応答防止・Tile Mapping 描画などのノウハウが完全実装されています。

---

## 🎮 ライブデモ (Live Demo)

- 🔗 **[Vue 3 サンプルクライアントを今すぐ体験する (Live Demo)](https://e3sh.github.io/Nethack-wasm-webUI/examples/vue-client/dist/index.html)**
  *(※ GitHub Pages 公開時は `https://<username>.github.io/<repo>/examples/vue-client/dist/` にてそのまま 1 クリックで動作します)*

---

## ✨ 主な機能

- **ハイブリッド 2D Canvas マップ (`MapCanvas.vue`)**:
  - `param/tileMapping.js` の正統スプライトマッピング (`nethack_default_32.png`) に対応。
  - 未割り当てタイルや文字マスは 16 色 TTY カラーの monospace フォントでハイブリッド描画。
  - 暗闇・未探知マス (`tileId === 0`) でのアリ描画を自動スキップし、漆黒のダンジョン表現を実現。
  - `curs` イベントによるリアルタイムなプレイヤー位置・カーソル位置のシックなスリム枠線表示。
- **堅牢なメッセージ & ステータスバー (`StatusBar.vue`)**:
  - HP, Pw, AC, Gold, Exp, Dungeon Level (`DLEVEL`) などをリアルタイム同期。
  - 重複メッセージの自動排他カット。
- **万能プロンプトハンドラ (`InputPrompt.vue`)**:
  - 文字列入力 (`askname`, `getlin`, `#extcmd`) に応じた安全な入力フォーム (+ ESC キャンセル)。
  - Y/N 質問プロンプトの確定受容 (y/n/q ボタン & ダイレクトキー操作)。
  - 例外的な質問文言（`"Do you want a tutorial?"` 等）を無表示・操作不能にならず自動吸収する安全フォールバック。
- **インベントリ & メニューダイアログ (`MenuModal.vue`)**:
  - 選択肢アイテムのスプライト表示 & アクセラレータキー (a, b, c...) のクリック/直接打鍵。
  - 閲覧専用メニュー (`how === 0`) やアイテムなしメニューの自動解放処理。
- **長文閲覧用テキストモーダル (`TextWindowModal.vue`)**:
  - ヘルプファイル (`display_file`) や案内画面 (`display_nhwindow` >= 4) の閲覧モード。

---

## 🚀 起動 & ビルド方法

### 開発用ローカルサーバーの起動 (Vite)
プロジェクトルートディレクトリにて：

```bash
# Vue 3 サンプルクライアントの起動
npm run dev:vue
```
自動的に `http://localhost:3000/` が立ち上がり、ホットリロード対応の開発環境がブラウザで開きます。

### スタンドアロン静的ビルド (GitHub Pages / Live Server 用)
```bash
# examples/vue-client ディレクトリにて
npm run build
```
ビルドが完了すると、`examples/vue-client/dist/` ディレクトリ内に **Wasm バイナリ・Worker スクリプト・画像データがすべて同梱された完全独立パッケージ** が生成されます。
この `dist/` フォルダをそのまま VS Code Live Server で開いたり、GitHub Pages へ配備するだけで 100% 動作します。

---

## 🏛️ 実装のツボ & 注意点 (アーキテクチャノウハウ)

他フレームワーク（React, Svelte, SolidJS 等）へ展開・移植する際に必ず遵守すべき重要な設計ノウハウと解決策の一覧です。

### 1. Worker ブリッジ通信と リアクティブ Proxy の解体 (`toRaw` / Plain Copy)
- **注意点**: Vue 3 の `ref` / `reactive` や React の State / Proxy オブジェクトをそのまま Worker へ `postMessage` すると `DataCloneError` でアプリが即座にクラッシュします。
- **解決策**: Worker へ応答を送る (`respondMenu` や `respondPrompt`) 直前で、`toRaw()` または `JSON.parse(JSON.stringify(toRaw(val)))` を通してプレーンな JavaScript オブジェクトに変換してから送信します。

### 2. 二重応答防止ラッパー (`createSafeResolver`) と Resolver の分離管理
- **注意点**: キー入力とボタンクリックが同報発生した際、同一 Resolver に対して 2 回 `respond()` が呼ばれると Worker 内で `Resolver not found or already resolved` 警告が発生します。また、メニュー用とプロンプト用で Resolver を単一変数で共有すると競合フリーズします。
- **解決策**:
  - `activeMenuResolver` と `activePromptResolver` を完全に独立分離して保持します。
  - すべての Resolver を 1 回しか応答を受け付けない `createSafeResolver` ラッパーで包んでから使用します。

### 3. `select_menu` 応答型の厳守と `NetHackWasmDriver.js:671` クラッシュ防止
- **注意点**: `select_menu` に対する応答型は「選択アイテムオブジェクトの配列 `[item]`」、キャンセル時や選択なし時は数値 `0` を返す仕様です。不適切な型を返すと C コア Shim 側で `res.charCodeAt` TypeError クラッシュが発生します。
- **解決策**: キャンセル時/空メニュー時は必ず `0` を返し、単一選択時であっても `[item]` 配列化して返送します。また、`respondMenu` が呼ばれたら `gameStore.setMenu(null)` を最優先で無条件実行してモーダル画面の残像フリーズを根絶します。

### 4. 正統 Tile Mapping スプライト切出数式と暗闇マススキップ
- **注意点**: `nethack_default_32.png` スプライトシートは **1 行 40 タイル (`tilesPerRow = 40`)** 配置です。16px メニューアイコン表示時の CSS 切り出し倍率を間違えると表示がズレます。また、`tileId === 0` をそのまま描画するとダンジョン全体に「アリ」が敷き詰められます。
- **解決策**:
  - **Canvas (32px)**: `sx = (tileIdx % 40) * 32`, `sy = Math.floor(tileIdx / 40) * 32`
  - **CSS Sprite (16px)**: `background-size: 640px auto`, `posX = -(tx / 2)`, `posY = -(ty / 2)`
  - `tileId === 0` かつ文字が空白の未探知マスは Canvas 描画をスキップし、漆黒のダンジョン背景を維持します。

### 5. `DLEVEL` (`field 20`) の階層変化検知と `clearMapGrid()`
- **注意点**: 毎ターン発行される `clear_nhwindow(3)` でマップバッファを消去すると画面が黒く点滅します。一方、`field 20` の数値のみを監視すると、ダンジョンブランチ名が変わる階層移動（チュートリアルや鉱山等）のクリアが漏れます。
- **解決策**:
  - 毎ターンの `clear_nhwindow(3)` ではクリアを行わず、`print_glyph` の差分描画を維持します。
  - `field 20` のポインタ文字列全体（例: `"Dlvl:1"`, `"Tut:1"`, `"Mines:1"`）の変化を検知した時、およびセッション開始時 (`askname` / `initialized`) にのみ `clearMapGrid()` を呼んでマップを全リセットします。

### 6. 万能プロンプトハンドラ (`InputPrompt.vue`) による例外自動吸収
- **注意点**: NetHack C コアには `[y/n]` 表記のない質問（例: `"Do you want a tutorial?"`）やマイナーなプロンプトが多数存在し、特定の文字列条件だけで分岐すると無画面・操作不能フリーズが発生します。
- **解決策**:
  - `isTextPrompt` (1行入力) 以外は、全プロンプトで **Yes(y) / No(n) / Quit(q) ボタン** および **全キーボード受容** を常時確保し、未知のプロンプトが届いても二度と画面がフリーズしない万能構造を構築します。
  - 通常移動時 (`isTurnInput` / `nhgetch` / `poskey`) は不要な Y/N ボタンを非表示にし、矢印キーや `hjkl` キーのダイレクト操作を受容します。

### 7. 静的スタンドアロンビルドと Live Server / GitHub Pages 互換性
- **注意点**: サブディレクトリ階層（VS Code Live Server や GitHub Pages）で動かす際、絶対パス (`/nethack.wasm`) を使うと 404 Error (`<!DOCTYPE...`) になり Wasm コンパイルがクラッシュします。
- **解決策**:
  - `vite.config.ts` で `base: './'` を指定し、相対パスビルドを行います。
  - ビルド時に `nethack.wasm`, `nethack.js`, `pict/`, `param/`, `src/driver/` を `dist/` へ自動コピーし、`dist/` フォルダ単体で完結するポータブルパッケージを生成します。
  - `src/driver/nethack.worker.js` 内の `locateFile` アルゴリズムを修正し、Worker から見た相対位置 (`../../nethack.wasm`) を自動計算させて 404 エラーを完全に防ぎます。
