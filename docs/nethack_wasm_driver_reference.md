# NetHackWasmDriver API & Message Reference Guide

`NetHackWasmDriver` は、NetHack 5.0 Wasm C コア (`winshim.c`) とクライアント UI（Web 画面、Canvas 描画層、モバイル UI、AI Bot 等）を繋ぐイベント駆動型の統合ドライバモジュールです。

---

## 1. モジュール構成 (Module Structure)

`src/driver/` ディレクトリ内に配置された3つの独立したモジュールで構成されます：

1. **`NetHackMemory.js`**: Wasm メモリ (`Module.HEAP32` 等) の相互変換、ポインタの読み書き、`glyph_info` C 構造体のデコード、Sticky Getter パッチを提供。
2. **`InputResolver.js`**: Asyncify 同期入力待ちを安全な Promise としてラッピングし、タイムアウト制御や ESC 自動キャンセル機能を提供。
3. **`NetHackWasmDriver.js`**: 全 47 種類の `shim_*` C コア関数をインターセプトし、JS EventEmitter イベントとしてパブリッシュするメインドライバー。

---

## 2. API リファレンス (NetHackWasmDriver Class)

### コンストラクタ `new NetHackWasmDriver(options)`

```javascript
const driver = new NetHackWasmDriver({
    wasmModule: window.Module,  // Emscripten Module インスタンス (省略可)
    inputTimeoutMs: 0,          // 入力待ちセーフティタイムアウト時間 (ms)。デフォルト: 0 (無制限待機)
    debug: true,                // デバッグログの出力有無 (デフォルト: false)
    extCmds: [...]              // カスタム拡張コマンド配列 (省略時は C コア完全同期の全 114 コマンドリスト)
});
```

### インスタンスメソッド

#### コア機能
- **`init(wasmModule)`**: ドライバのパッチ適応および C コアへのコールバックディスパッチャ（`window.nhDispatcher`）の登録を行います。
- **`start(customArgs)`**: Emscripten 仮想 FS (`/save`, `/tmp`, `.nethackrc`) を準備し、Wasm `ccall('main', ...)` により非同期に C メインエンジンを起動します。
  - **戻り値**: `Promise<number>` (終了コード)
- **`on(event, listener)`**: イベントリスナーの登録。
- **`off(event, listener)`**: イベントリスナーの削除。
- **`once(event, listener)`**: 一度限りのイベントリスナーの登録。
- **`cancelPendingInput()`**: 現在進行中の入力待ち (`InputResolver`) があれば ESC キャンセルを実行します。

#### セーブデータ管理ヘルパー (Save Data Helpers)
- **`listSaveFiles()`**: 仮想 FS 上の全セーブファイル一覧とサイズ・更新日時を取得。
  - **戻り値**: `Array<{ filename: string, size: number, timestamp: Date }>`
- **`exportSaveData(targetFilename)`**: 仮想 FS からセーブデータのバイナリを取得。
  - **戻り値**: `Array<{ filename: string, data: Uint8Array }>`
- **`importSaveData(filename, data)`**: 指定ファイル名でバイナリセーブデータを仮想 FS へ書き込み・注入。
  - **戻り値**: `boolean` (成功時 true)
- **`deleteSaveFile(filename)`**: 仮想 FS から指定セーブファイルを削除。
  - **戻り値**: `boolean` (成功時 true)

### プロパティ

- **`driver.state`**: 現在の動作状態（`DriverState`）。
  - `IDLE`: 初期状態
  - `RUNNING`: Wasm コア実行中
  - `WAITING_INPUT`: 通常入力待ち中 (`poskey`, `getch`, `getlin`, `yn_function`, `get_ext_cmd`)
  - `WAITING_MENU`: メニュー選択待ち中 (`select_menu`)
  - `STOPPED`: Wasm エンジン停止・終了状態

---

## 3. イベント & メッセージ一覧 (Events & Messages)

### A. ライフサイクル & 状態変更イベント

| イベント名 | レスポンス | ペイロード (`data`) | 説明 |
| :--- | :---: | :--- | :--- |
| **`stateChange`** | 不要 | `{ state, oldState }` | ドライバの状態（`IDLE`, `RUNNING`, `WAITING_INPUT` 等）が変化した際に発火。 |
| **`init_nhwindows`** | 不要 | `{}` | ウィンドウシステム初期化通知。 |
| **`exit_nhwindows`** | 不要 | `{ message }` | ゲーム終了・ウィンドウ破棄通知。 |
| **`inputTimeout`** | 不要 | `{ context, rescuedValue, state }` | オプションでセーフティタイムアウトが設定されている場合 (`inputTimeoutMs > 0`)、入力待ちがタイムアウトした際に発火。<br>※`select_menu` ➔ `0` (非選択キャンセル), `getlin` ➔ `""`, `get_ext_cmd` ➔ `-1`, `poskey` ➔ `27` (ESC) のコンテキスト別安全値で自動救出され、Wasm メモリ破損クラッシュを防ぎます。 |

---

### B. 画面描画 & メッセージ出力イベント

| イベント名 | ペイロード (`data`) | 内容・説明 |
| :--- | :--- | :--- |
| **`putstr`** | `{ windowId, attr, text }` | ウィンドウへの指定属性テキスト出力。 |
| **`putmixed`** | `{ windowId, attr, text }` | 属性と文字が混在したテキスト出力。 |
| **`raw_print`** | `{ text }` | TTY/生の標準テキスト直接出力。 |
| **`raw_print_bold`** | `{ text }` | ボールド直接テキスト出力。 |
| **`print_glyph`** | `{ windowId, x, y, glyphInfo }` | マップ画面 (x, y) へのタイル・文字描画。<br>`glyphInfo`: `{ glyph, symbol, color, flags, symidx, ch }` |
| **`curs`** | `{ windowId, x, y }` | カーソル位置移動。 |
| **`clear_nhwindow`** | `{ windowId }` | ウィンドウ表示消去（マップクリア等）。 |
| **`create_nhwindow`** | `{ type }` | 新規ウィンドウ生成 (`1`:MESSAGE, `2`:STATUS, `3`:MAP, `4`:MENU, `5`:TEXT)。 |
| **`destroy_nhwindow`**| `{ windowId }` | ウィンドウ破棄。 |
| **`status_update`** | `{ field, value, change, percent, color }` | ステータス属性更新 (HP, AC, Gold, Level, 状態異常等)。 |
| **`display_file`** | `{ filename, complain, fileText, resolver }` | クレジットやヘルプ等の仮想ファイルテキスト表示。<br>※ `resolver.respond(0)` で閲覧完了通知を行ってください。 |
| **`bell`** | `{}` | **実効イベント**: C コア `shim_nhbell` からのビープ音通知。 |
| **`soundTrigger`** | `{ soundText }` | **将来拡張予約**: NetHack 5.0 C サウンド API (`soundprocs`) からのサウンドトリガー用。 |

---

### C. メニュー処理イベント

メニュー処理は `start_menu` ➔ `add_menu` (複数回) ➔ `end_menu` ➔ `inputRequired (select_menu)` の順序で発行されます。

#### `add_menu` ペイロード `menuItem` の構造:
```javascript
{
    glyphInfo: { glyph: 123, symbol: ')', color: 7, ch: ')' }, // タイルグラフィック情報
    identifier: 12345678,    // C オブジェクトポインタ (0 の場合は選択不可見出し)
    isHeader: false,         // ヘッダー行判定 (identifier === 0)
    accelerator: 97,         // 'a' などのショートカットキー (ASCII / 文字)
    groupAcc: 0,             // グループアクセラレータ
    attr: 0,                 // テキスト属性
    color: 7,                // 表示色
    str: "a +1 short sword", // アイテム名表示文字列
    itemflags: 0             // 既選択フラグ
}
```

---

### D. 入力要求イベント (`inputRequired`)

ユーザーまたは UI からの非同期入力を必要とするとき、`inputRequired` イベントが発行されます。
受け取った `data.resolver` に対して `resolver.respond(value)` を呼び出すことで C コアへ値を入力返却します。

| `context` | 目的 | `data` ペイロードの固有プロパティ | `resolver.respond(...)` で返すべき値 |
| :--- | :--- | :--- | :--- |
| **`poskey`** | 移動・アクション・マウス入力 | `{ xPtr, yPtr, modPtr, resolver }` | **キー入力の場合**: ASCII コード数文字 (`49`='1', `'a'`.charCodeAt(0), `^p` ➔ `16`, `Alt+s` ➔ `243`)。<br>**マウスの場合**: `{ x, y, mod }` オブジェクト。 |
| **`getch`** | 1文字入力待機 | `{ resolver }` | ASCII コード数値 (例: `32`=Space, `27`=ESC)。 |
| **`yn_function`** | Yes/No 質問待機 | `{ question, choices, defaultChoice, resolver }` | 文字の ASCII コード (例: `'y'.charCodeAt(0)` または `'n'.charCodeAt(0)`)。 |
| **`getlin`** | 1行文字列入力待機 | `{ prompt, bufPtr, resolver }` | 入力された文字列 (例: `"my_pet_name"`)。 |
| **`get_ext_cmd`**| 拡張コマンド (`#`) 入力 | `{ extcmds, resolver }` | **文字列推奨**: コマンド名文字列 (例: `"loot"`, `"chat"`, `"untrap"`, `"pray"`)。<br>または数値インデックス。 |
| **`select_menu`**| メニュー項目選択 | `{ windowId, how, items, prompt, resolver }` | 選択された `menuItem` オブジェクトの配列 (例: `[selectedItem1, selectedItem2]`)。<br>キャンセル時は `0` または `-1` または空配列 `[]`。 |
| **`askname`** | プレイヤー名入力 | `{ resolver }` | プレイヤー名文字列 (例: `"Hero"`). |

---

## 4. `InputResolver` レスポンダーの使用例

`inputRequired` イベントを受信した UI 側の入力完了処理コード例：

```javascript
driver.on('inputRequired', (data) => {
    switch (data.context) {
        case 'poskey':
            // 'k' キー (北移動) を送る
            data.resolver.respond('k'.charCodeAt(0));
            break;

        case 'get_ext_cmd':
            // #loot コマンドを送る
            data.resolver.respond("loot");
            break;

        case 'select_menu':
            // 最初の選択可能アイテムを選択して送る
            const validItems = data.items.filter(item => !item.isHeader);
            if (validItems.length > 0) {
                data.resolver.respond([validItems[0]]);
            } else {
                data.resolver.respond(0); // キャンセル
            }
            break;

        case 'getlin':
            data.resolver.respond("My Custom String");
            break;
    }
});
```

---

## 5. 特殊キーコードの変換規約

`poskey` で入力するキーコードの変換ルール：

- **通常文字**: `'a'.charCodeAt(0)` (97)
- **Ctrl + キー**: `'p'.toUpperCase().charCodeAt(0) & 0x1F` (Ctrl+P = 16)
- **Alt (Meta) + キー**: `'s'.toLowerCase().charCodeAt(0) | 0x80` (Alt+S = 243)
- **テンキー移動 (`1`〜`9`)**: `'1'.charCodeAt(0)` (49), `'2'.charCodeAt(0)` (50) ... ※数値の 1 ではなく文字 `'1'` の ASCII を渡すことでテンキー移動となります。

---

## 6. セーブ & ロード（ゲーム状態の永続化と再開）

Driver の提供するセーブデータ管理 API ヘルパー (`listSaveFiles`, `exportSaveData`, `importSaveData`, `deleteSaveFile`) を利用することで、管理画面や UI 側は低レイヤーの Emscripten `FS` を直接操作する必要がなくなります。

### A. セーブデータ管理UI 側での利用例

```javascript
// 仮想 FS 上のセーブファイル一覧を取得
const saves = driver.listSaveFiles();
saves.forEach(saveInfo => {
    console.log(`Save: ${saveInfo.filename}, Size: ${saveInfo.size} bytes`);
});

// セーブデータをブラウザの LocalStorage や IndexedDB へバックアップ
const exported = driver.exportSaveData();
exported.forEach(item => {
    localStorage.setItem('nethack_backup_' + item.filename, item.data);
});
```

### B. セーブデータの復元・ゲーム再開 (Restore & Load)

`driver.start()` を呼び出す**前**に、バックアップしておいたバイナリデータを `importSaveData()` で注入します：

```javascript
async function loadAndStartGame() {
    const driver = new NetHackWasmDriver();
    driver.init(Module);

    // バックアップからデータを復元して Driver へ注入
    const backupData = getBackupFromLocalStorage('1000Hero.NetHack-saved-game');
    if (backupData) {
        driver.importSaveData('1000Hero.NetHack-saved-game', backupData);
    }

    // Wasm 起動 (C コアが自動的にセーブファイルを検出し再開します)
    await driver.start();
}
```
