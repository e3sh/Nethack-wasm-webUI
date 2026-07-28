# NetHackWasmDriver コア技術仕様書 (Driver Core Specification)

本書は `NetHackWasmDriver` ドライバーレイヤー本体（`NetHackWasmDriver.js`, `NetHackMemory.js`, `InputResolver.js`）の内部構造・Wasm メモリバインド・C コア接続仕様についてまとめた純粋なドライバー技術資料です。

---

## 1. ドライバー構造 ＆ 設計思想

`NetHackWasmDriver` は、NetHack 5.0 / 3.7 C コア (Wasm) とクライアント UI の間を仲介するイベント駆動型ドライバーです。

- **完全な疎結合 (Decoupled)**: UI 側の実装構造（DOM / Canvas / React / Vue 等）に依存せず、標準化された JavaScript イベント (`EventEmitter`) を通じて通信します。
- **メモリ非破壊の徹底**: Emscripten 32-bit Wasm のメモリ構造体を安全にアロケート・解放し、C コアのクラッシュを防御します。
- **Asyncify の完全制御**: `InputResolver` による Promise ラッパーで Wasm スタックの休止・再開をハンドリングします。

---

## 2. コア機能 ＆ 低層仕様

### 2.1 Wasm メモリ構造体バインド ＆ ポインタ安全性
- **`shim_select_menu` の NULL ポインタ書き戻し**:
  - メニュー選択で非選択・キャンセルの場合、C 側の `MENU_ITEM_P**` (指し示しているポインタのアドレス) に **`0 (NULL)`** を書き込まないと C コアがガベージアドレスを参照・解放して `memory access out of bounds` クラッシュを起こします。
  - 返却時は必ず未選択なら `*menuListPtrPtr = 0` を書き込みます。
- **`menu_item` 構造体 (16 bytes) のクリア**:
  - `anything item` 共用体 (offset 0-7) の上位 4 バイト (offset + 4) を確実に 0 クリアします。

### 2.2 Asyncify 非同期化 ＆ 遅延解決 (`InputResolver`)
- **Micro-task Delay**:
  - `InputResolver.respond(value)` 内で `setTimeout(() => resolve(value), 10)` の 10ms 非同期遅延を適用。
  - Emscripten Asyncify の Wasm スタックアンワインド（一時停止）が 100% 完了した後に巻き戻し（rewind）を発火させ、ビジーフリーズを防止します。

### 2.3 起動オプション構築 ＆ 事前設定機能
- **`-u<UserName>` ＆ `OPTIONS=name:...` の先頭注入**:
  - `gameOptions.name` を受け取り、C main コマンドライン引数 `-u<UserName>` を自動先頭追加します。
  - 仮想 FS (Emscripten `FS`) の `sysconf` および `.nethackrc` へ `OPTIONS=name:<UserName>` を自動作成します。
  - これにより C コア初期化時の `askname()` ("Who are you?") プロンプト割り込みを自動スキップさせます。

---

## 3. ドライバー発行イベント一覧 (`EventEmitter`)

| イベント名 | 発火タイミング | ペイロードデータ |
| :--- | :--- | :--- |
| `stateChange` | ドライバー状態変更時 | `{ state, oldState }` |
| `print_glyph` | マップ上のセル描画 | `{ windowId, x, y, glyphInfo }` |
| `curs` | カーソル位置移動 | `{ windowId, x, y }` |
| `putstr` | テキスト/ステータス出力 | `{ windowId, attr, text }` |
| `putmixed` | タイル混在テキスト出力 | `{ windowId, attr, text }` |
| `raw_print` | 生メッセージ/物拾い通知 | `{ text }` |
| `status_update` | ステータス値変更 | `{ field, value }` |
| `clear_nhwindow` | ウィンドウ消去要求 | `{ windowId }` |
| `display_nhwindow` | ウィンドウ表示/ブロッキング | `{ windowId, blocking }` |
| `inputRequired` | プレイヤー入力待ち状態発生 | `{ context, question, choices, defaultChoice, prompt, items, how, resolver }` |
