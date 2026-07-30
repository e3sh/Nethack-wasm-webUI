# NetHackWasmDriver コア技術仕様書 (Driver Core Specification)

本書は `NetHackWasmDriver` ドライバーレイヤー本体（`NetHackWasmDriver.js`, `NetHackMemory.js`, `NetHackFSManager.js`, `InputResolver.js`）の内部構造・Wasm メモリバインド・C コア接続仕様についてまとめた純粋なドライバー技術資料です。

---

## 1. ドライバー構造 ＆ 設計思想

`NetHackWasmDriver` は、NetHack 5.0 / 3.7 C コア (Wasm) とクライアント UI の間を仲介するイベント駆動型ドライバーです。

- **完全な疎結合 (Decoupled)**: UI 側の実装構造（DOM / Canvas / React / Vue 等）に依存せず、標準化された JavaScript イベント (`EventEmitter`) を通じて通信します。
- **メモリ非破壊の徹底**: Emscripten 32-bit Wasm のメモリ構造体を安全にアロケート・解放し、C コアのクラッシュを防御します。
- **Asyncify の完全制御**: `InputResolver` による Promise ラッパーで Wasm スタックの休止・再開をハンドリングします。
- **Universal Script 互換性**: ES Module (`import / export`) および Classic Script (<script>) の双方向に完全対応し、IIFE ガードにより二重定義エラー (`Identifier 'X' has already been declared`) を防止します。

---

## 2. コア機能 ＆ 低層仕様

### 2.1 Wasm メモリ構造体バインド ＆ ポインタ安全性 (`NetHackMemory.js`)
- **動的関数の遅延・動的解決 (Dynamic Binding)**:
  - Wasm インスタンス化のタイミングに左右されないよう、`Module.getValue`, `Module.setValue`, `UTF8ToString`, `stringToUTF8` を呼び出し時に `window.Module` や `globalThis.Module` から動的にバインド・解決します。
- **C 構造体サイズ整合 (`menu_item` / `struct mi`)**:
  - Wasm32 ABI レイアウト (`sizeof(struct mi) = 12 bytes`: `item` 4b, `count` 4b, `itemflags` 4b) に合わせてメモリ確保サイズを 12バイトに適正化し、`assert(otmp != 0)` クラッシュを根絶。
- **型曖昧さ・ESC/キャンセルの安全鋳造 (Safe Cast & Fallback)**:
  - C コアからのポインタ書き込み `setPointerValue(ret_ptr, 's', value)` において、`value` が文字列以外（数値 `27` (ESC) や `0` や `-1` などのキャンセルコード）で渡された場合でも、例外クラッシュさせずに安全に NULL ポインタ (`0`) または C 文字列ポインタへ動的変換します。
- **ステータス情報の完全構造化デコード (`BL_` フィールド)**:
  - **`BL_GOLD` (field 10)**: `"glyph:0x0f2e:100"` からの Gold Pieces Glyph ID (`3886`) および金額の自動解析。
  - **`BL_HUNGER` (field 17)**: 空腹・満腹状態 (`"Satiated"`, `"Hungry"`, `"Weak"`, `"Fainting"`) の解釈と文字列変換。
  - **`BL_CONDITION` (field 22)**: ビットマスクからの全30種状態異常文字列配列への展開。
- **`shim_select_menu` の NULL ポインタ書き戻し**:
  - メニュー選択で非選択・キャンセルの場合、C 側の `MENU_ITEM_P**` に **`0 (NULL)`** を書き込み、ガベージアドレス参照による `memory access out of bounds` クラッシュを防ぎます。

### 2.2 仮想ファイルシステム ＆ 永続化 (`NetHackFSManager.js`)
- **システム環境ファイルの全自動生成とオプション重複防止**:
  - NetHack C コア初期化時に必須となる `/sysconf` (`WIZARDS=*\nEXPLORERS=*\n`), `/perm` (`*\n`), `NetHack.cnf`, `.nethackrc` を仮想 FS (Emscripten `FS`) 上へ自動構築し、ファイルオープンエラーによるエンジン強制終了を防止します。
  - `NetHack.cnf` / `.nethackrc` 内への固定 `OPTIONS=` の冗長書き込みを除去し、`4 errors in //.nethackrc.` 警告を完全消去。
- **IDBFS 自動同期と一括物理消去 (`deleteSaveFile`)**:
  - `/save` および `/tmp` ディレクトリを IDBFS へマウントし、IndexedDB との双方向同期 (`FS.syncfs`) を制御。
  - 物理消去メソッド `deleteSaveFile` により、VFS (`/save`) および Browser IndexedDB (`/indexedDB` の `FILE_DATA` ストア) 内の全セーブキーを走査し完全無条件物理削除を保証。

### 2.3 Asyncify 非同期化 ＆ 遅延解決 (`InputResolver.js`)
- **Micro-task Delay**:
  - `InputResolver.respond(value)` 内で 10ms の非同期遅延を適用し、Emscripten Asyncify の Wasm スタックアンワインド（一時停止）が 100% 完了した後に巻き戻し（rewind）を発火させ、フリーズを防止します。

### 2.4 EXTCMD (拡張コマンド) インデックス整合 (`NetHackWasmDriver.js`)
- **C コアテーブル完全一致の `DEFAULT_EXTCMDS`**:
  - C言語コア (`cmd.c` / `extcmd.h`) のインデックスと100%整合する `"adjust"` から始まる正順の全拡張コマンド配列を保持します。
- **柔軟な文字列パース**:
  - `get_ext_cmd` 入力時、`"#chat"` などの先頭 `#` 付き文字列が渡された場合でも、自動的に `#` を除去してインデックスを一致・照合します。

---

## 3. ドライバー発行イベント一覧 (`EventEmitter`)

| イベント名 | 発火タイミング | ペイロードデータ |
| :--- | :--- | :--- |
| `stateChange` | ドライバー状態変更時 | `{ state, oldState }` |
| `print_glyph` | マップ上のセル描画 | `{ windowId, x, y, glyphInfo }` |
| `curs` | カーソル位置移動 | `{ windowId, x, y }` |
| `putstr` | テキスト/ステータス出力 | `{ windowId, attr, text }` |
| `putmixed` | タイル混在テキスト出力 | `{ windowId, attr, text }` |
| `raw_print` | 生メッセージ出力 (重複無く1回のみ発火) | `{ text }` |
| `status_update` | ステータス値変更 | `{ field, value, glyphId, goldData, change, color }` |
| `clear_nhwindow` | ウィンドウ消去要求 | `{ windowId }` |
| `display_nhwindow` | ウィンドウ表示/ブロッキング | `{ windowId, blocking }` |
| `inputRequired` | プレイヤー入力待ち状態発生 | `{ context, question, choices, defaultChoice, prompt, items, how, detectedName, resolver }` |
| `bell` | C コアビープ音発生 | `{}` |
| `exit_nhwindows` | ゲーム終了時 | `{ message }` |

---

## 4. Web Worker 隔離アーキテクチャ (Web Worker Integration)

NetHack の C コア (Wasm) および Asyncify によるスタック退避・復元処理（マイクロタスク占有）が、同一スレッドで動作する他の Web アプリケーション（YouTube 等）に描画・通信遅延を引き起こす問題を根本的に解決するため、ドライバーをバックグラウンドの Web Worker に隔離するアーキテクチャを採用しています。

### 4.1 構成モジュール

```mermaid
graph TD
    subgraph MainThread ["メインスレッド (UI レイヤー)"]
        UI["クライアント UI (DriverDomTestClient 等)"]
        Bridge["NetHackWasmWorkerBridge"]
    end
    
    subgraph WorkerThread ["Worker スレッド (バックグラウンド)"]
        Worker["nethack.worker.js"]
        Driver["NetHackWasmDriver"]
        Wasm["NetHack Wasm Engine (nethack.js)"]
    end

    UI -->|イベントリスナー / メソッド呼出| Bridge
    Bridge <-->|postMessage (プレーンオブジェクト / resolverId)| Worker
    Worker <-->|直接メソッド呼出 / イベント| Driver
    Driver <-->|ccall / getValue / FS / onRuntimeInitialized| Wasm
```

1. **`NetHackWasmWorkerBridge.js` (メインスレッド側)**:
   - UIレイヤーから従来の `NetHackWasmDriver` と100%同一のインターフェースとしてアクセスできるブリッジ。
   - `on()`, `once()`, `off()` などの EventEmitter API を提供し、UI側のキー入力や操作を Worker に中継します。
2. **`nethack.worker.js` (Workerスレッド側)**:
   - Worker のエントリーポイント。指定された Wasm JS（例: `nethack.js`）を動的にインポートし、Worker 内部で Wasm の初期化を監視・制御します。

### 4.2 スレッド境界の通信仕様と resolver 再構築
Web Worker とメインスレッド間では、関数を含むオブジェクトを `postMessage` で送信することができません（構造化複製エラー）。これを解決するため、非同期入力の解決用関数である `resolver` の ID 管理を行っています。

- **イベント中継と IDマッピング**:
  - Worker内で `inputRequired` や `display_file` などの同期待ちイベントが発生した際、`data.resolver` オブジェクトを `savedResolvers` (Map) に一時退避し、代わりに一意の数値 `resolverId` を付与してプレーンなオブジェクトとしてメインスレッドにポストします。
  - メインスレッドの Bridge は、受信した `resolverId` を元に、`respond(value)` や `cancel()` を呼び出すと Worker 側にメッセージ（`RESPOND_INPUT`）を送って Wasm 側の Promise を解決する**擬似 resolver**を動的に生成し、UIレイヤーに渡します。
- **`activeResolver` ゲッターのフォワード**:
  - UI側が `driver.activeResolver` を参照して汎用キー入力等を行う仕組みと互換性を保つため、Bridge側で現在アクティブな疑似 resolver のキャッシュを保持し、ゲッター経由で露出させます。
- **`display_file` の非同期フォワード**:
  - メインスレッドに Wasm のファイルシステム (`FS`) が存在しないため、ファイル表示イベント時は Worker 側で `FS.readFile` によりテキストを読み出し、`fileText` をオブジェクトに付加して中継します。

### 4.3 ロード順序と環境変数 (preRun) の確実な適用
Emscripten が生成する `nethack.js` はロード時に環境変数 (`ENV`) を同期的に初期化します。これを保証するため、Worker 側では `importScripts(wasmJsUrl)` を呼ぶ前に、`self.Module.preRun` および `self.Module.arguments` を設定します。
これにより、テンキーオプション (`number_pad:1`) などの環境変数が Wasm の起動時に 100% 確実に適用されます。


