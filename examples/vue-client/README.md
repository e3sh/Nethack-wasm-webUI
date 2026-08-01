# NetHack Wasm Vue 3 サンプルクライアント (`@nethack/vue-client`)

このディレクトリは、**NetHack Wasm Driver (`@nethack/wasm-driver`)** を利用して構築された、Vue 3 + Vite + TypeScript + Pinia による実証検証用フル機能 Web UI サンプルです。

モダンな Vue 3 コンポジション API と TypeScript を活用して、NetHack C コアの非同期 Asyncify イベント駆動型ゲームループと安全かつ美しく連携する実装パターンを示しています。

---

## 🌟 主な機能と特徴

1. **ハイブリッド 2D Canvas マップ描画**
   - `param/tileMapping.js` に準拠した正統スプライト描画 (`nethack_default_32.png`)
   - 16 色 TTY カラーパレットによる高精細 ASCII フォールバック描画
   - `requestAnimationFrame` による高速かつ滑らかなリアルタイム同期

2. **直感的なメニュー & インベントリモーダル (`MenuModal.vue`)**
   - スプライトアイコン表示付きのインベントリ一覧
   - 単一選択 (`how === 1`) / 複数選択 (`how === 2`) / 閲覧専用 (`how === 0`) モード対応
   - アクセラレータキー (`a`, `b`, `c`...) 表示およびキーボード文字直接押下による即時決定・送信
   - クリック選択対応

3. **ヘルプ & テキスト閲覧モーダル (`TextWindowModal.vue`)**
   - 長文テキスト、ヘルプ文言、ガイドのポップアップ閲覧
   - `OK (Enter / Space / ESC)` ボタンおよびキー操作による快適な閉じ動作

4. **動的ステータスバー (`StatusBar.vue`)**
   - ダンジョンブランチ名を含む階層 (`Dlvl:1`, `Tut:1`, `Mines:1` 等) の完全自動追従
   - HP, Pw, AC, Gold, Hunger 状態, コンディションバッジの表示

5. **入力プロンプト & 拡張コマンド (`InputPrompt.vue`)**
   - 1 行テキスト入力プロンプト (`askname`, `getlin` 等)
   - 拡張コマンド (`#` / `get_ext_cmd`) のライン入力対応 (`pray`, `dip`, `jump` 等)
   - オプションや名前変更時の安全な `Cancel (ESC)` 機能

6. **キー入力・操作の完全分離ガード**
   - テキスト入力フォームフォーカス時、モーダル表示中のグローバルキー爆発・誤作動を 100% 遮断

---

## 🚀 動作・起動方法

### 1. 開発サーバーの起動

リポジトリルートから以下の npm スクリプトを実行します：

```bash
# リポジトリルートから実行
npm run dev:vue
```

または、本ディレクトリに移動して直接起動します：

```bash
cd examples/vue-client
npm run dev
```

ブラウザで `http://localhost:3000/` にアクセスするとサンプル UI が起動します。

### 2. プロダクションビルド & 型チェック

TypeScript の型チェックおよび Vite ビルドの正常性を検証するには：

```bash
# 本ディレクトリにて実行
npm run build
```

---

## 💡 実装のツボと注意点 (Key Implementation Details)

`NetHackWasmDriver` を利用したクライアント開発において、**特に重要となるノウハウとハマりポイント**を以下にまとめています。

### 1. Web Worker 境界と Proxy 解除 (`toRaw`)

Vue 3 の `ref` や `reactive` で管理されたオブジェクト（例: メニューアイテム）には JavaScript の `Proxy` ラッパーが付与されています。
これをそのまま Web Worker の `postMessage` へ送信すると、ブラウザが `DataCloneError: [object Array] could not be cloned` 例外を発生させてクラッシュします。

**【解決策】**: `toRaw()` や `JSON.parse(JSON.stringify(toRaw(obj)))` で Plain Object に変換してから `resolver.respond()` に渡してください。

```typescript
const rawValue = JSON.parse(JSON.stringify(toRaw(value)));
resolver.respond(rawValue);
```

### 2. Resolver の分離管理と二重応答防止 (`createSafeResolver`)

NetHack C コアからは `inputRequired` イベントが頻繁に発行されます。特にメニュー表示中やプロンプト表示中に、画面の裏で次の入力イベントが届く場合があります。

- **Resolver の分離**: メニュー用 `activeMenuResolver` と 汎用プロンプト用 `activePromptResolver` を完全に独立して保持します。
- **二重呼び出しガード**: 1 つの Resolver に対し、キーイベントと UI ボタンクリックで 2 回 `respond()` が呼ばれると Worker 内で `Resolver not found or already resolved` 警告が発生します。`createSafeResolver` ラッパーで二重呼出しをガードします。

```typescript
function createSafeResolver(originalResolver: any) {
  let isResolved = false;
  return {
    respond: (val: any) => {
      if (isResolved) return;
      isResolved = true;
      originalResolver.respond(val);
    }
  };
}
```

### 3. メニュー応答データフォーマットの厳守

`select_menu` (`context === 'select_menu'`) に対する応答形式は以下のように型が厳密に定められています。

- **選択時**: **「アイテムオブジェクトの配列 `[item]`」**
- **キャンセル時**: **数値 `0`**

※ 単なるインデックス数値の配列 `[0]` や文字列を送ると、`NetHackWasmDriver.js` 内部で `TypeError: res.charCodeAt is not a function` が発生して C コアの Asyncify スタックがクラッシュします。

### 4. マップ背景の全消去（クリア）の正しい制御ルール

NetHack C コアは、歩行（1マス移動）のたびに毎ターン `clear_nhwindow({ windowId: 3 })` を発行してきます。

- ❌ **誤った実装**: `clear_nhwindow(3)` が届くたびにマップ全消去を呼ぶ ➔ 移動のたびに背景が全消去されて画面が真っ黒（またはチラつき）になる。
- ⭕ **正しい実装**:
  1. **毎ターンの `clear_nhwindow(3)`**: 全消去を行わず、`print_glyph` で届いたセルのみピンポイント差分更新する。
  2. **ダンジョン階層・ブランチ変更時**: `status_update` で `field === 20` (`DLEVEL`) の文字列（例: `"Dlvl:1"`, `"Tut:1"`, `"Mines:1"`）が変更された時のみ、`clearMapGrid()` で旧階層のバッファを全消去する。
  3. **新セッション開始時**: `askname` や `initialized` イベント時に初回 `clearMapGrid()` を呼ぶ。

### 5. 正統 Glyph ID ➔ Tile Index 変換 (`tileMapping.js`)

Wasm から届く `glyph`（Glyph ID）はそのままスプライトシートの格子番号ではありません。

- `param/tileMapping.js` の `tileMapping()` 関数を通して `tileIdx = tileMapping()[glyph]` を参照します。
- スプライト画像 `nethack_default_32.png` の 1 行あたりの横タイル数は **40 タイル (`tilesPerRow = 40`)** です。
- CSS スプライト (16px 表示時) の縮尺計算式:
  - `background-size: 640px auto;` (40 tiles × 16px = 640px)
  - `posX = -( (tileIdx % 40) * 32 / 2 )`
  - `posY = -( Math.floor(tileIdx / 40) * 32 / 2 )`

### 6. Vite 開発サーバープラグイン (`serveRootAssets`)

Vite 開発環境において、Web Worker 内から相対パスで要求される `/nethack.wasm` や `/pict/nethack_default_32.png` や `/param/tileMapping.js` を、リポジトリルートのファイル構造から正しくヘッダー付与 (`Content-Type: application/wasm` 等) して配給するために、`vite.config.ts` 内に `serveRootAssets()` プラグインを配置しています。

---

## 📁 ディレクトリ構造

```text
examples/vue-client/
├── package.json               # Vue 3 サンプル用パッケージ定義
├── vite.config.ts             # ルートアセット配信ミドルウェア & エイリアス設定
├── index.html                 # エントリ HTML
├── README.md                  # 本ドキュメント
└── src/
    ├── main.ts                # Vue アプリ初期化
    ├── App.vue                # メインコンポーネント & レイアウト
    ├── vite-env.d.ts          # 型定義拡張
    ├── stores/
    │   └── gameStore.ts       # Pinia ゲーム状態ストア (MapGrid, Messages, Status)
    ├── composables/
    │   └── useNetHackDriver.ts# Driver Worker 通信, Resolver 管理, キー操作フック
    └── components/
        ├── MapCanvas.vue      # 2D Canvas ハイブリッドマップ描画
        ├── MessageLog.vue     # 重複防止付きメッセージログ
        ├── StatusBar.vue      # 動的ステータス & コンディションバッジ
        ├── InputPrompt.vue    # テキスト/EXTCMD 入力 & Cancel (ESC)
        ├── MenuModal.vue      # インベントリ & メニューモーダル
        └── TextWindowModal.vue# ヘルプ & 長文テキスト閲覧モーダル
```
