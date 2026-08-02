# NetHackWasmDriver API & Message Reference Guide

`NetHackWasmDriver` (`@nethack/wasm-driver`) は、NetHack 5.0 Wasm C コア (`winshim.c`) とクライアント UI（Web 画面、Canvas 描画層、モバイル UI、Vue/React/Svelte/SolidJS 等）を繋ぐイベント駆動型の統合ドライバモジュールです。

---

## 1. モジュール構成 (Module Structure)

`src/driver/` ディレクトリ内に配置された独立モジュールで構成されます：

1. **`NetHackMemory.js`**: Wasm メモリ (`Module.HEAP32` 等) の相互変換、ポインタの低レイヤー安全読み書き (`getPointerValue`, `setPointerValue`)、`glyph_info` C 構造体のデコード、ステータス構造化 (`DLEVEL` `dlevelData`, `Gold` `goldData`), 動的関数の動的バインドを提供。
2. **`NetHackFSManager.js`**: Emscripten 仮想 FS (`/save`, `/tmp`) の初期化、IDBFS 永続化同期、`/sysconf`, `/perm`, `.nethackrc` システム自動生成、ログおよびスコアファイルパースを提供。
3. **`InputResolver.js`**: Asyncify 同期入力待ちを安全な Promise としてラッピングし、`SafeResolver` (二重呼び出しガード)、`unwrapPayload` (Proxyディープコピー), `isUserPromptContext` (コンテキスト保護) を提供。
4. **`NetHackWasmDriver.js`**: 全 C コア関数をインターセプトし、JS EventEmitter イベントとしてパブリッシュするメインドライバー。`promptCategory`, `filterSysconfLogs`, `deduplicateMessages`, `autoRespondEmptyMenu` を標準搭載。
5. **`NetHackWasmWorkerBridge.js`**: メインスレッドと Web Worker スレッド間の通信・イベント中継を透明に行うブリッジモジュール。

---

## 2. API リファレンス (NetHackWasmDriver Class)

### コンストラクタ `new NetHackWasmDriver(options)`

```javascript
const driver = new NetHackWasmDriver({
    wasmModule: window.Module,   // Emscripten Module インスタンス (省略可)
    filterSysconfLogs: true,    // sysconf デバッグノイズログの自動カット
    deduplicateMessages: true,  // 同文面メッセージの自動重複除去
    autoRespondEmptyMenu: true, // 空メニューの 0 自動返送
    debug: false                // デバッグログの出力有無
});
```

### インスタンスメソッド

- **`init(wasmModule)`**: ドライバのパッチ適応および C コアへのコールバックディスパッチャ（`window.nhDispatcher`）の登録を行います。
- **`start(customArgs)`**: Emscripten 仮想 FS とシステムファイル (`/sysconf`, `/perm`, `.nethackrc`) を準備し、Wasm `ccall('main', ...)` により非同期に C メインエンジンを起動します。
- **`on(event, listener)` / `off(event, listener)`**: イベントリスナーの登録・削除。
- **`terminate()` / `destroy()`**: 実行中の Worker プロセス・リソースを安全に解放破棄。

---

## 3. イベント & メッセージ一覧 (Events & Messages)

### 画面描画・メッセージ・入力待ちイベント

| イベント名 | ペイロード (`data`) | 内容・説明 |
| :--- | :--- | :--- |
| **`stateChange`** | `{ state, oldState }` | ドライバの状態（`IDLE`, `RUNNING`, `WAITING_INPUT` 等）が変化した際に発火。 |
| **`putstr`** | `{ windowId, attr, text }` | ウィンドウへの指定属性テキスト出力。 |
| **`raw_print`** | `{ text }` | ノイズ・重複除去済みの生テキストメッセージ。 |
| **`print_glyph`** | `{ windowId, x, y, glyphInfo }` | マップ画面 (x, y) へのタイル・文字描画。 |
| **`curs`** | `{ windowId, x, y }` | カーソル位置移動。 |
| **`status_update`** | `{ field, value, glyphId, goldData, dlevelData, change, color }` | ステータス更新（所持金 `goldData`, 階層 `dlevelData`, 空腹, 状態異常等）。 |
| **`inputRequired`** | `{ context, type, promptCategory, prompt, choices, items, how, resolver }` | 入力要求イベント。<br>`promptCategory`: `'TEXT'` \| `'YN'` \| `'KEY'` \| `'MENU'` \| `'POSKEY'` \| `'FILE'` \| `'OTHER'`<br>`resolver`: `SafeResolver` オブジェクト。`resolver.respond(val)` または `resolver.cancel()` で応答。 |

---

## 4. 履歴・アーカイブノート

旧バージョン（Driver 1.0）からの進化点：
- C コアの非ブロッキング画面表示 (`shim_display_nhwindow` `blocking: false`) が `askname` 等を強制キャンセルしていた現象を `isUserPromptContext` により修正保護しました。
- `#` 拡張コマンド (`shim_get_ext_cmd`) における `safeResolver` の型ミスマッチを修正しました。
- Vue 3 等の Proxy オブジェクトが `postMessage` に入った場合の `DataCloneError` を `unwrapPayload` により自動ディープコピー解除するように改善しました。
