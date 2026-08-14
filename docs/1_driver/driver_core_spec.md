---
title: driver_core_spec
status: active
last_updated: 2026-08-15
related_code:
  - src/driver/
---

# NetHackWasmDriver コア技術仕様書 (Driver Core Specification)

本書は `NetHackWasmDriver` ドライバーレイヤー本体（`NetHackWasmDriver.js`, `NetHackMemory.js`, `NetHackFSManager.js`, `InputResolver.js`, `NetHackWasmWorkerBridge.js`）の内部構造・Wasm メモリバインド・C コア接続仕様についてまとめた純粋なドライバー技術資料です。

---

## 1. ドライバー構造 ＆ 設計思想

`NetHackWasmDriver` は、NetHack 5.0 / 3.7 C コア (Wasm) とクライアント UI の間を仲介するイベント駆動型ドライバーです。

- **完全な疎結合 (Decoupled)**: UI 側の実装構造（DOM / Canvas / Vue / React / Svelte / SolidJS 等）に依存せず、標準化された JavaScript イベント (`EventEmitter`) を通じて通信します。
- **メモリ非破壊の徹底**: Emscripten 32-bit Wasm のメモリ構造体を安全にアロケート・解放し、C コアのクラッシュを防御します。
- **Asyncify の完全制御**: `InputResolver` および `SafeResolver` による Promise ラッパーで Wasm スタックの休止・再開をハンドリングします。
- **Universal Script ＆ ESM 互換性**: ES Module (`import / export`) および Classic Script の双方向に完全対応し、二重定義エラーを防止します。

---

## 2. コア機能 ＆ 低層仕様

### 2.1 Wasm メモリ構造体バインド ＆ ポインタ安全性 (`NetHackMemory.js`)
- **動的関数の遅延・動的解決 (Dynamic Binding)**:
  - Wasm インスタンス化のタイミングに左右されないよう、`Module.getValue`, `Module.setValue`, `UTF8ToString`, `stringToUTF8` を呼び出し時に動的にバインド・解決します。
- **C 構造体サイズ整合 (`menu_item` / `struct mi`)**:
  - Wasm32 ABI レイアウト (`sizeof(struct mi) = 12 bytes`: `item` 4b, `count` 4b, `itemflags` 4b) に合わせてメモリ確保サイズを 12バイトに適正化。
- **型曖昧さ・ESC/キャンセルの安全鋳造 (Safe Cast & Fallback)**:
  - C コアからのポインタ書き込み `setPointerValue(ret_ptr, 's', value)` において、`value` が数値 `27` (ESC) や `0` や `-1` などのキャンセルコードで渡された場合でも、例外クラッシュさせずに安全に NULL ポインタ (`0`) または C 文字列ポインタへ動的変換します。
- **ステータス情報の完全構造化デコード (`BL_` フィールド)**:
  - **`BL_GOLD` (field 10)**: 金額および Gold Pieces Glyph ID (`3886`) の自動解析データ `goldData` を生成。
  - **`BL_DLEVEL` (field 20)**: ダンジョン名 (`dlevelStr`), 階層数値 (`dlevelNum`), ダンジョンブランチ (`branch`) を解析した `dlevelData` を生成。
  - **`BL_HUNGER` (field 17)**: 空腹・満腹状態 (`"Satiated"`, `"Hungry"`, `"Weak"`, `"Fainting"`) の解釈と文字列変換。
  - **`BL_CONDITION` (field 22)**: ビットマスクからの全30種状態異常文字列配列への展開。

### 2.2 仮想ファイルシステム ＆ 永続化 (`NetHackFSManager.js`)
- **システム環境ファイルの全自動生成とオプション重複防止**:
  - NetHack C コア初期化時に必須となる `/sysconf`, `/perm`, `NetHack.cnf`, `.nethackrc` を仮想 FS (Emscripten `FS`) 上へ自動構築。
- **IDBFS 自動同期と一括物理消去 (`deleteSaveFile`)**:
  - `/save` および `/tmp` ディレクトリを IDBFS へマウントし、IndexedDB との双方向同期 (`FS.syncfs`) を制御。

### 2.3 Asyncify 非同期化・プロンプト保護 ＆ 二重応答防止 (`InputResolver.js`)
- **`SafeResolver` (二重呼び出し防止)**:
  - クライアント側から同一 Resolver に対して `respond()` が 2 回呼ばれた場合、2 回目以降を安全な no-op に制御。
- **`unwrapPayload` (Proxy ディープコピー)**:
  - Vue 3 や SolidJS 等の State (Proxy) オブジェクトが渡された際、Worker 送信前に Plain JavaScript Object へディープコピーアンラップ。
- **`isUserPromptContext` (ユーザープロンプトコンテキスト保護)**:
  - 待機中コンテキストが `askname`, `yn_function`, `select_menu`, `getlin`, `get_ext_cmd` 等の本物のプロンプトである場合、非入力の表示イベント (`display_nhwindow` `blocking: false`) によって破棄・Stale 化されないよう保護。

### 2.4 EXTCMD (拡張コマンド) インデックス整合 (`NetHackWasmDriver.js`)
- **C コアテーブル完全一致の `DEFAULT_EXTCMDS`**:
  - C言語コア (`cmd.c` / `extcmd.h`) のインデックスと 100% 整合する正順の全拡張コマンド配列を保持。
- **`safeResolver.respond()` による数値マッピング**:
  - 文字列（`"pray"`, `"jump"` 等）や `#` 付き文字列が入力された際、正当なインデックス数値へマッピングして `safeResolver.respond()` を実行。

### 2.5 シーケンス自走消化 ＆ FIFOタスクキュー構造 (`queueSequence`)
- **タスクオブジェクトによる FIFO 管理**:
  - シーケンス呼び出しを単一のグローバル配列で直接上書き管理するのではなく、個別のタスクオブジェクト `{ id, tokens, options, buffer }` として `sequenceTaskQueue` 配列（FIFO）に安全に保持します。
- **先行シーケンスの非破棄順次消化**:
  - 先行するシーケンスが自走消化中、または現在 Cコアからの入力問い合わせ中（`activeResolver` 保持時）であっても、投入された新しいシーケンスが既存キューを破棄することはありません。先行タスクの全トークンが消化され Cコアの処理が一段落したタイミングで自動的に次のタスクを開始します。
- **実行結果バッファと表示オプションの隔離**:
  - 各タスクは独自の実行結果バッファ (`buffer`) と表示制御オプション (`suppressPrompts`) をカプセル化して保持します。これにより、サイレントクエリ（`suppressPrompts: true`）と通常シーケンスが連続投入された場合でも、画面プロンプト抑止やバッファ取得の独立性が 100% 保証されます。
- **安全な一括キャンセル (`cancelSequence`)**:
  - `cancelSequence()` が呼び出された場合、進行中のアクティブタスクに加えて FIFO キュー内に保留されている未実行予約タスクも一括で完全消去されます。

---

## 3. ドライバー発行イベント一覧 (`EventEmitter`)

| イベント名 | 発火タイミング | ペイロードデータ |
| :--- | :--- | :--- |
| `stateChange` | ドライバー状態変更時 | `{ state, oldState }` |
| `print_glyph` | マップ上のセル描画 | `{ windowId, x, y, glyphInfo }` |
| `curs` | カーソル位置移動 | `{ windowId, x, y }` |
| `putstr` | テキスト/ステータス出力 | `{ windowId, attr, text }` |
| `putmixed` | タイル混在テキスト出力 | `{ windowId, attr, text }` |
| `raw_print` | 生メッセージ出力 (ノイズ・重複カット制御済み) | `{ text }` |
| `status_update` | ステータス値変更 | `{ field, value, glyphId, goldData, dlevelData, change, color }` |
| `clear_nhwindow` | ウィンドウ消去要求 | `{ windowId }` |
| `display_nhwindow` | ウィンドウ表示/ブロッキング | `{ windowId, blocking, resolver }` |
| `inputRequired` | プレイヤー入力待ち状態発生 | `{ context, type, promptCategory, question, choices, defaultChoice, prompt, items, how, detectedName, resolver }` |
| `bell` | C コアビープ音発生 | `{}` |
| `exit_nhwindows` | ゲーム終了時 | `{ message }` |

---

## 4. Web Worker 隔離アーキテクチャ (Web Worker Integration)

メインスレッドでの UI レンダリング（60fps）やユーザー入力を滑らかに維持するため、ドライバーコアおよび Wasm エンジンをバックグラウンドの Web Worker 上で分離稼働させる構成が標準化されています。

```mermaid
graph TD
    subgraph MainThread ["メインスレッド (UI レイヤー)"]
        UI["クライアント UI (Vue / React / Canvas / DOM)"]
        Bridge["NetHackWasmWorkerBridge"]
    end
    
    subgraph WorkerThread ["Worker スレッド (バックグラウンド)"]
        Worker["nethack.worker.js"]
        Driver["NetHackWasmDriver"]
        Wasm["NetHack Wasm Engine (nethack.js)"]
    end

    UI -->|イベントリスナー / メソッド呼出| Bridge
    Bridge <-->|postMessage (unwrapPayload / safeResolverId)| Worker
    Worker <-->|直接メソッド呼出 / イベント| Driver
    Driver <-->|ccall / getValue / FS / onRuntimeInitialized| Wasm
```

1. **`NetHackWasmWorkerBridge.js` (メインスレッド側)**:
   - UI レイヤーから従来の `NetHackWasmDriver` と 100% 同一のインターフェースとしてアクセスできるブリッジ。
   - `on()`, `off()` EventEmitter API を提供し、UI 側のレスポンダー呼び出しを Worker に安全伝送します。
