# モダン Web フロントエンド対応 クライアント構築・実装ガイド (v2.0)

本ドキュメントは、**`@nethack/wasm-driver` 2.0 (NetHackWasmDriver / Web Worker Bridge)** を使用して、Vue 3、React 18、Svelte、SolidJS 等のモダンな Web フロントエンドフレームワークで NetHack 5.0 クライアントを構築するための最新実装ガイドおよびノウハウ集です。

---

## 1. 概要とアーキテクチャ

従来（初期仕様）の WebUI は、メインスレッド上で Wasm エンジンが直接ブロッキング動作する完全同期型でしたが、**バージョン 2.0 以降は Web Worker 上で Wasm コアが分離独立して非同期動作するアーキテクチャ**へ進化しました。

```
+-------------------------------------------------------------+
| Main Thread (UI レイヤー: Vue / React / Svelte / SolidJS)     |
|   - UI コンポーネント (モーダル, 2D Canvas, Status, Logs)     |
|   - driverController (Singleton ドライバーコントローラー)    |
+-------------------------------------------------------------+
                              | (postMessage / EventEmitter)
                              v
+-------------------------------------------------------------+
| Worker Thread (バックグラウンド: NetHackWasmWorkerBridge)    |
|   - NetHackWasmDriver (@nethack/wasm-driver)                |
|   - NetHack 5.0 Wasm C Core (Asyncify スタック制御)          |
+-------------------------------------------------------------+
```

---

## 2. 実装における必須ノウハウ ＆ ベストプラクティス

### ① 通信部は Singleton パターン (`driverController`) で一元管理する
- **背景**: Vue 3 の `ref()` や Composition API、SolidJS の Signal 等に Wasm レスポンダーオブジェクト (`Resolver`) を代入すると、自動的に Reactive Proxy 化され、`respond()` 呼出時に関数の参照やコンテキストが破壊されて Worker へ応答が届かなくなります。
- **解決策**: 通信ブリッジおよび `activeResolver` の保持は、フレームワークの Reactive State の外側に置いた **`driverController` シングルトンクラス** で管理し、UI 側からはプレーンなラッパー関数 (`respondPrompt`, `respondMenu`, `respondTextModal`) を通じて呼び出します。

```typescript
// useNetHackDriver.ts (推奨設計パターン)
class NetHackDriverController {
  private bridge: any = null;
  private activeMenuResolver: any = null;

  public init() {
    if (this.bridge) return;
    this.bridge = new NetHackWasmWorkerBridge('/src/driver/nethack.worker.js', { ... });
    
    this.bridge.on('inputRequired', (payload: any) => {
      if (payload.context === 'select_menu') {
        this.activeMenuResolver = payload.resolver;
        // UI ストアへはプレーンなデータのみをセットする (Resolver はセットしない)
        gameStore.setActiveMenu({ prompt: payload.prompt, items: payload.items, how: payload.how });
      }
    });
  }

  public respondMenu(selectedItems: any) {
    if (this.activeMenuResolver) {
      const res = this.activeMenuResolver;
      this.activeMenuResolver = null;
      gameStore.setActiveMenu(null);
      res.respond(selectedItems); // 安全な呼出し
    }
  }
}
```

### ② `promptCategory` を活用して UI 条件分岐を単純化する
C コアから届く `context` (`yn_function`, `select_menu`, `getlin`, `askname`, `nhgetch`, `poskey`, `get_ext_cmd` 等) は多岐にわたりますが、Driver 2.0 では解析済みの統一タグ `promptCategory` が自動付与されます。

- `'YN'`: Yes/No 選択プロンプト (例: "Quit? [y/n]")
- `'TEXT'`: 1行テキスト入力 (例: "What do you want to call this monster?")
- `'MENU'`: インベントリ・アイテム選択メニュー
- `'KEY'`: 1文字キー入力待機 (例: "--More--")
- `'FILE'`: テキストファイル閲覧
- `'OTHER'`: その他のコンテキスト

### ③ 方向入力プロンプト ("In what direction?") の注意点
"In what direction?" (移動・攻撃方向の問い合わせ) は、コンテキスト `yn_function` として届く場合があります。
UI 側の `isYNPrompt` 判定で "direction" を除外条件とし、Yes/No ダイアログを誤表示させずにテンキーや矢印キー入力（`h, j, k, l, y, u, b, n` 等）を直接 `respondPrompt()` へ返送するように実装してください。

### ④ 閲覧専用メニュー (`isViewOnly`) の判別と応答
`select_menu` で選択肢のないテキスト閲覧メニュー（`lookupInformation` やヘルプ等の `items` に選択可能アイテムがないもの）が届く場合があります。
UI 側で `const hasSelectable = items.some(it => !it.isHeader && it.identifier !== 0)` を判定し、選択項目がない場合は「閲覧専用テキストモーダル (OK / Space / Enter / ESC で閉じる)」として表示し、`respondMenu(0)` を送信して閉じてください。

---

## 3. 実装ステップバイステップ

### ステップ 1: Web Worker ブリッジの初期化

```javascript
import { NetHackWasmWorkerBridge } from '@nethack/wasm-driver';

const bridge = new NetHackWasmWorkerBridge('/src/driver/nethack.worker.js', {
  arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
  debug: false
});
```

### ステップ 2: 描画・ステータスイベントの購読

```javascript
// 1. テキストメッセージ出力
bridge.on('putstr', ({ windowId, text }) => {
  if (windowId === 1) addMessageLog(text);
});

// 2. ステータス更新 (HP, DLEVEL, Gold 等)
bridge.on('status_update', (payload) => {
  const field = payload.field ?? payload.fld;
  const value = payload.value ?? payload.parsedVal;
  updateStatusStore(field, value, payload);
});

// 3. マップ画面の描画更新
bridge.on('print_glyph', ({ x, y, glyphInfo }) => {
  renderMapTile(x, y, glyphInfo);
});
```

### ステップ 3: 入力プロンプト・モーダルへの応答

```javascript
// プロンプト発生
bridge.on('inputRequired', (event) => {
  const { promptCategory, question, choices, prompt, resolver } = event;
  
  if (promptCategory === 'YN') {
    showYnModal(question, choices, (answer) => resolver.respond(answer));
  } else if (promptCategory === 'TEXT') {
    showTextInputModal(prompt, (text) => resolver.respond(text));
  }
});
```

---

## 4. 提供されているサンプルクライアント一覧 (`examples/`)

最新の実装パターンは以下のサンプルクライアントで確認・参照いただけます：

1. **Vue 3 サンプル (`examples/vue-client`)**: Pinia + TypeScript + Composition API
2. **React 18 サンプル (`examples/react-client`)**: React Hooks + TypeScript
3. **Svelte サンプル (`examples/svelte-client`)**: Svelte Store + Components
4. **SolidJS サンプル (`examples/solid-client`)**: Solid Signals + JSX

各サンプルのソースコードは本ガイドラインに基づき 100% 動作・テスト検証済みです。
