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

### `async bridge.listSaveFiles()` / `async g.rogue.listSaveFiles()`
VFS (`/save` および `/` ディレクトリ) 内に存在するすべてのセーブファイルの一覧（`path`, `filename`, `playerName`, `size`, `mtime`）を非同期取得します。

### `async g.rogue.getSaveStatus()`
現行の Worker / FS 状態におけるアクティブなセーブデータの有無 (`hasSave`), 検出されたプレイヤー名 (`saveName`), および全セーブファイル一覧 (`saveFiles`) を取得します。

### `async bridge.deleteSaveFile(filename)` / `async g.rogue.deleteSaveFile(filename)`
指定されたセーブファイル（および IndexedDB の FILE_DATA 永続化キー）を物理削除します。

### `g.rogue.readPanicLog()`
Emscripten VFS 内の `paniclog` ファイルを自動探索・読み込みし、コンソールへ警告出力するとともにログ文字列を返却します。

---

## 3. ドライバー発行イベント一覧 (Driver Events)

### `stateChange`
ドライバーの内部実行状態が変更された際に発火します。
- **ペイロード**: `{ state: string, oldState: string }`
- **状態値**: `'IDLE'`, `'RUNNING'`, `'WAITING_INPUT'`, `'WAITING_MENU'`, `'STOPPED'`, `'ERROR'`

### `inputRequired`
プレイヤーからの入力待ち状態（ターン待機・質問・メニュー選択・テキスト入力・拡張コマンド）が発生した際に発火します。
- **ペイロード**:
  ```javascript
  {
      context: string,        // 'yn_function', 'select_menu', 'getlin', 'askname', 'nhgetch', 'poskey', 'get_ext_cmd'
      type: string,           // 'char', 'yn', 'menu', 'line', 'ext_cmd'
      question: string,       // 質問内容 (yn_function 等)
      choices: string,        // 受容可能な選択肢文字列 (例: "ynaq", "hjklyubn")
      defaultChoice: string,  // デフォルト選択肢 (例: 'y')
      prompt: string,         // 入力プロンプト
      items: Array<Object>,   // メニュー項目配列 (select_menu 時)
      how: number,            // メニュー選択方式 (1: PICK_ONE, 2: PICK_ANY)
      detectedName: string,   // セーブデータ自動検知名 (askname 時)
      resolver: InputResolver // 安全な Promise レスポンダーオブジェクト
  }
  ```
- **拡張機能**:
  - `context === 'get_ext_cmd'`: `#` 押下時の拡張コマンド名入力。`resolver.respond("pray")` 等の文字列送信により拡張コマンドを発行。
  - `context === 'yn_function'`: Enter キー (`13`) や Space キー (`32`) 入力時、C コアが `impossible` と判定しないよう、デフォルト選択肢文字 (`defaultChoice`) へ自動正規化。

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
アイテム拾い通知 ("You pick up...") や各種生コメント、死因メッセージが届いた際に発火します。
- **ペイロード**: `{ text: string }`

### `status_update`
HP(18/19)、Pw(11/12)、AC(14)、Au/Gold(10)、Dlevel(20)、空腹(17)、状態異常(22) などのステータスフィールドが変更された際に発火します。
- **ペイロード**: `{ field: number, value: any, glyphId?: number, goldData?: Object }`

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
  - 拡張コマンド入力時: コマンド文字列 (`string`) (例: `"pray"`, `"jump"`)
  - テキスト入力時: 入力文字列 (`string`) (例: `"e3-sh"`)
  - メニュー選択時: 選択されたアイテムオブジェクトの配列 (`Array<Object>`)
  - メニューキャンセル時: `0` (`number`)

### `resolver.cancel(overrideValue)`
入力キャンセルを安全に実行します。

