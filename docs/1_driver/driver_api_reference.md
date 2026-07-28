# NetHackWasmDriver API リファレンスガイド (API Reference Guide)

本書は `NetHackWasmDriver` クラスのコンストラクタ、起動オプション、公開メソッド、発行イベント、およびレスポンダーオブジェクトの完全な API リファレンスです。

---

## 1. コンストラクタ `new NetHackWasmDriver(options)`

ドライバーのインスタンスを生成します。

```javascript
const driver = new NetHackWasmDriver({
    wasmModule: window.Module,
    gameOptions: {
        name: 'e3-sh',         // ユーザー名 (-uUsername & OPTIONS=name:Username へ自動組み込み)
        number_pad: 1,         // テンキー移動オプション
        showexp: true,         // 経験値表示
        time: true,            // ターン数表示
        showvers: true         // バージョン表示
    },
    arguments: [],             // カスタム C main 起動引数 (省略時は自動生成)
    debug: true                // デバッグログ出力
});
```

### オプションプロパティ

| プロパティ名 | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `wasmModule` | `Object` | `window.Module` | Emscripten Wasm モジュールオブジェクト |
| `gameOptions` | `Object` | `{ number_pad: 1, ... }` | NetHack 起動オプション設定オブジェクト |
| `arguments` | `Array<string>` | `null` | C コア `main()` へ渡すコマンドライン引数 |
| `debug` | `boolean` | `false` | ドライバ内部ログのコンソール出力フラグ |

---

## 2. 公開メソッド (Public Methods)

### `driver.init(wasmModule)`
ドライバーの内部状態とメモリヘルパー (`NetHackMemory`) を初期化し、C シムグラフィックコールバック `nhDispatcher` を登録します。

### `async driver.start(customArgs = null)`
NetHack Wasm C コアエンジンの `main()` 関数を実行起動します。
- **戻り値**: `Promise<number>` (C main の終了コード)
- **特徴**: コマンドライン引数先頭に `-u<name>` を自動セットし、`askname` ("Who are you?") の割り込み質問をスキップします。

### `driver.on(eventName, callback)` / `driver.off(eventName, callback)`
ドライバーからの各種イベントリスナーを登録・解除します。

---

## 3. ドライバー発行イベント一覧 (Driver Events)

### `stateChange`
ドライバーの内部実行状態が変更された際に発火します。
- **ペイロード**: `{ state: string, oldState: string }`
- **状態値**: `'IDLE'`, `'RUNNING'`, `'WAITING_INPUT'`, `'WAITING_MENU'`, `'STOPPED'`, `'ERROR'`

### `inputRequired`
プレイヤーからの入力待ち状態（ターン待機・質問・メニュー選択・テキスト入力）が発生した際に発火します。
- **ペイロード**:
  ```javascript
  {
      context: string,        // 'yn_function', 'select_menu', 'getlin', 'askname', 'nhgetch', 'poskey'
      question: string,       // 質問内容 (yn_function 等)
      choices: string,        // 受容可能な選択肢文字列 (例: "ynaq", "hjklyubn")
      defaultChoice: string,  // デフォルト選択肢 (例: 'y')
      prompt: string,         // 入力プロンプト
      items: Array<Object>,   // メニュー項目配列 (select_menu 時)
      how: number,            // メニュー選択方式 (1: PICK_ONE, 2: PICK_ANY)
      resolver: InputResolver // 安全な Promise レスポンダーオブジェクト
  }
  ```

### `print_glyph`
マップ上のセルの表示更新指示が届いた際に発火します。
- **ペイロード**: `{ windowId: number, x: number, y: number, glyphInfo: Object }`

### `curs`
カーソル位置移動指示が届いた際に発火します。
- **ペイロード**: `{ windowId: number, x: number, y: number }`

### `putstr` / `putmixed`
メッセージやステータス、またはテキストウィンドウ用文章が届いた際に発火します。
- **ペイロード**: `{ windowId: number, attr: number, text: string }`

### `raw_print` / `raw_print_bold`
アイテム拾い通知 ("You pick up...") や各種生コメントが届いた際に発火します。
- **ペイロード**: `{ text: string }`

### `status_update`
HP、Pw、AC、Au(Gold)、Dlevel などのステータスフィールドが変更された際に発火します。
- **ペイロード**: `{ field: number, value: any }`

### `clear_nhwindow` / `display_nhwindow`
ウィンドウの消去・表示指示が届いた際に発火します。
- **ペイロード (`display_nhwindow`)**: `{ windowId: number, blocking: boolean }`

---

## 4. `InputResolver` オブジェクト (Safety Responder)

`inputRequired` イベント発生時に渡される応答オブジェクトです。

### `resolver.respond(value)`
プレイヤーの選択・入力結果を C コアへ返却し、Asyncify スタックの再開（rewind）を行います。
- **引数 `value`**:
  - キー入力時: 文字コード (`number`) (例: `'y'` は `121`)
  - テキスト入力時: 入力文字列 (`string`) (例: `"e3-sh"`)
  - メニュー選択時: 選択されたアイテムオブジェクトの配列 (`Array<Object>`)
  - メニューキャンセル時: `0` (`number`)

### `resolver.cancel(overrideValue)`
入力キャンセルを安全に実行します。
