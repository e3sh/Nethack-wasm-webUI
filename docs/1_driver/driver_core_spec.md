---
title: driver_core_spec
status: implemented
last_updated: 2026-10-11
related_code:
  - src/driver/
  - src/driver/shim/shim_bridge.c
---

# NetHackWasmDriver コア技術仕様書 (Driver Core Specification)

本書は `NetHackWasmDriver` ドライバーレイヤー本体（`NetHackWasmDriver.js`, `NetHackMemory.js`, `NetHackFSManager.js`, `InputResolver.js`, `NetHackWasmWorkerBridge.js`, `nethack.worker.js`, `shim/shim_bridge.c`）の内部構造・Wasm メモリバインド・C コア接続仕様についてまとめたドライバー技術仕様書です。

---

## 1. ドライバー構造 ＆ 設計思想

`NetHackWasmDriver` は、NetHack 5.0.1 C コア (Wasm) とクライアント UI / GKL の間を仲介するイベント駆動型ドライバーです。

- **純粋なトランスポートへの徹頭徹尾 (Pure Transport)**: ドライバーおよび Web Worker はゲームルールやドメイン知識を一切解釈せず、C コアと上位層（WebUICore / GKL）を結ぶ透過的な通信・メモリ中継インフラ（手足）に徹します。
- **公式 C コア完全非侵襲 (0% Intrusion)**: `win/shim/winshim.c` 等の公式ソースコードには 1 文字も手を加えず、独立エクステンション `src/driver/shim/shim_bridge.c` の単一窓口関数 `_shim_bridge_call` のみをリンクして構造化メモリアクセスを提供します。
- **完全な疎結合 (Decoupled)**: UI 側の実装構造（DOM / Canvas / WebGPU / Vue / React / Svelte / SolidJS 等）に依存せず、標準化された JavaScript イベント (`EventEmitter`) を通じて通信します。
- **メモリ非破壊の徹底**: Emscripten 32-bit Wasm のメモリ構造体を安全にアロケート・解放し、C コアのクラッシュを防御します。
- **Asyncify の完全制御**: `InputResolver` および `SafeResolver` による Promise ラッパーで Wasm スタックの休止・再開をハンドリングします。
- **Universal Script ＆ ESM 互換性**: ES Module (`import / export`) および Classic Script (`importScripts`) の双方向に完全対応し、二重定義エラーを防止します。

---

## 2. コア機能 ＆ 低層仕様

### 2.1 Wasm メモリ構造体バインド ＆ 単一汎用ブリッジ (`NetHackMemory.js` / `shim_bridge.c`)
- **動的関数の遅延・動的解決 (Dynamic Binding)**:
  - Wasm インスタンス化のタイミングに左右されないよう、`Module.getValue`, `Module.setValue`, `UTF8ToString`, `stringToUTF8`, `_shim_bridge_call` を呼び出し時に動的にバインド・解決します。
- **単一汎用ディスパッチャーブリッジ (`bridgeCall`)**:
  - `src/driver/shim/shim_bridge.c` が公開する唯一の C 関数 `long shim_bridge_call(int cmd, long arg1, long arg2, void *buf, int len)` を呼び出すゲートウェイ `memory.bridgeCall(cmd, arg1, arg2, buf, len)` を提供します。
  - `allocateBuffer(size)` / `freeBuffer(ptr)` / `readInt32Array(ptr, count)` / `readUint8Array(ptr, length)` / `readString(ptr, maxBytes)` と組み合わせることで、地形 (`0x10`/`0x11`)・罠 (`0x12`)・刻み文字 (`0x13`)・部屋種別 (`0x14`)・床オブジェクト (`0x20`)・モンスター詳細 (`0x21`〜`0x23`)・プレイヤー状態/耐性 (`0x30`〜`0x32`)・所持品/装備一括ダンプ (`0x40`〜`0x43`)・呪文/スキル (`0x50`〜`0x51`)・発見図鑑/外見シャッフル配列 (`0x60`〜`0x62`)・シンボル基底ポインタ (`0x70`) を安全に取得します。
- **C 構造体サイズ整合 (`menu_item` / `struct mi`)**:
  - NetHack 5.0 において、`anything` 共用体に 64bit 整数が含まれるため、Wasm32 環境でも 8 バイト境界でアラインされ、`sizeof(struct mi)` は 16 バイトとなります (`offset 0`: `mi.item` low 4B, `offset 4`: `mi.item` high 4B zero padding, `offset 8`: `mi.count` int32 4B, `offset 12`: `mi.itemflags` unsigned int 4B)。`NetHackMemory.buildMenuItemBuffer()` はこの 16 バイト境界仕様に厳密に準拠してバッファを構築します。
- **型曖昧さ・ESC/キャンセルの安全鋳造 (Safe Cast & Fallback)**:
  - C コアからのポインタ書き込み `setPointerValue(ret_ptr, 's', value, name)` において、`svp.plname` 固定長バッファ (`char[32]`) への直接書き込みや、数値 `27` (ESC)・`0`・`-1` などのキャンセルコードに対する NULL ポインタ (`0`) 安全変換を行います。
- **ステータス情報の完全構造化デコード (`BL_` フィールド)**:
  - **`BL_GOLD` (field 10)**: 金額および Gold Pieces Glyph ID (`3886`) の自動解析データ `goldData` を生成。
  - **`BL_DLEVEL` (field 20)**: ダンジョン名 (`dlevelStr`), 階層数値 (`dlevelNum`), ダンジョンブランチ (`branch`) を解析した `dlevelData` を生成。
  - **`BL_HUNGER` (field 17)**: 空腹・満腹状態 (`"Satiated"`, `"Hungry"`, `"Weak"`, `"Fainting"`) の解釈と文字列変換。
  - **`BL_CONDITION` (field 22)**: ビットマスクからの全30種状態異常文字列配列への展開。

> [!WARNING]
> ### 💡 低層バインドの教訓: Wasm32 における 12B vs 16B メモリ破壊
> 初期実装では「32bit 環境なのでポインタは 4 バイト、`struct mi` は `item (4B) + count (4B) + itemflags (4B) = 12B`」と仮定してバッファを割り当てていました。しかし、NetHack C コアの `anything` 共用体には 64bit 整数（`genericptr_t` 等）が含まれるため、Clang/LLVM コンパイラは Wasm32 環境であっても **8 バイト境界でのアライメント** を強制します。
> その結果、実際の `sizeof(struct mi)` は **16 バイト** となり、12 バイトで連続配置すると 2 つ目以降の選択項目オフセットが 4 バイトずつズレて C コアが不正メモリアクセスや未定義動作を起こしました。低層構造体バッファを構築する際は、コンパイラのアライメント規則（8バイト境界）を厳密に遵守する必要があります。

### 2.2 仮想ファイルシステム ＆ 永続化 (`NetHackFSManager.js`)
- **システム環境ファイルの全自動生成とオプション重複防止**:
  - NetHack C コア初期化時に必須となる `/sysconf`, `/perm`, `NetHack.cnf`, `.nethackrc` を仮想 FS (Emscripten `FS`) 上へ自動構築。
- **IDBFS 自動同期と戦歴ファイル (`xlogfile` / `record`) 読み出し**:
  - `/save` および `/tmp` ディレクトリを IDBFS へマウントし、IndexedDB との双方向同期 (`FS.syncfs`)、セーブファイル一覧取得 (`listSaveFiles`)、および公式戦歴ファイル (`readXlogTextAsync`, `readRecordTextAsync`) の読み出しを制御。

### 2.3 Asyncify 非同期化・プロンプト保護 ＆ ターン静止判定 (`InputResolver.js` / `NetHackWasmDriver.js`)
- **`SafeResolver` (二重呼び出し防止)**:
  - クライアント側から同一 Resolver に対して `respond()` が 2 回呼ばれた場合、2 回目以降を安全な no-op に制御。
- **`unwrapPayload` (Proxy ディープコピー)**:
  - Vue 3 や SolidJS 等の State (Proxy) オブジェクトが渡された際、Worker 送信前に Plain JavaScript Object へディープコピーアンラップ。
- **`isTopLevelTurn` ＆ `canAcceptSequenceInterruption()`**:
  - Wasm コアが 1 ターンの演算を終えてトップレベルの行動入力待ち（`poskey` / `nhgetch` かつモーダル・サブプロンプト非表示）で静止しているかを厳密に判定し、GKL の Direct Binding 同期や自走シーケンスが安全に介入できるタイミングを提供します。

### 2.4 EXTCMD (拡張コマンド) インデックス整合 (`NetHackWasmDriver.js`)
- **C コアテーブル完全一致の `DEFAULT_EXTCMDS`**:
  - C言語コア (`cmd.c` / `extcmd.h`) のインデックスと 100% 整合する正順の全拡張コマンド配列を保持。
- **`safeResolver.respond()` による数値マッピング**:
  - 文字列（`"pray"`, `"jump"` 等）や `#` 付き文字列が入力された際、正当なインデックス数値へマッピングして `safeResolver.respond()` を実行。

### 2.5 シーケンス自走消化 ＆ FIFOタスクキュー構造 (`queueSequence`)
- **タスクオブジェクトによる FIFO 管理 ＆ Promise 結果返却**:
  - シーケンス呼び出しを個別のタスクオブジェクト `{ sequenceId, tokens, options, buffer, resolve, reject }` として `sequenceTaskQueue` 配列（FIFO）に保持し、完了時に `resolve(buffer)` でキャプチャ結果を直接返却します。
- **Web Worker / WorkerBridge 間の `sequenceId` 追跡**:
  - 一意の `sequenceId` を Worker へ送信し、完了時に `SEQUENCE_FINISHED` メッセージ（`sequenceId`, `buffer`）を postMessage で返送してメインスレッド側の Pending Promise を非同期解決します。
- **明確なキャンセル保護ガード (Cancellation Safeguards)**:
  - 重複サイレントタスク（`isSilentSync: true`）の安全破棄、手動操作介入時の自動キャンセル、ターゲット指定モード (`isTargetingMode`) での保護待機、および `suppressPrompts: true` 時のブロッキングウィンドウ自動解決によってデッドロックを構造的に防止します。

---

## 3. ドライバー発行イベント一覧 (`EventEmitter`)

| イベント名 | 発火タイミング | ペイロードデータ |
| :--- | :--- | :--- |
| `stateChange` | ドライバー状態変更時 | `{ state, oldState, isTopLevelTurn, canAcceptSequenceInterruption }` |
| `print_glyph` | マップ上のセル描画 | `{ windowId, x, y, glyphInfo }` |
| `curs` | カーソル位置移動 | `{ windowId, x, y }` |
| `putstr` | テキスト/ステータス出力 | `{ windowId, attr, text }` |
| `putmixed` | タイル混在テキスト出力 | `{ windowId, attr, text }` |
| `raw_print` | 生メッセージ出力 (ノイズ・重複カット制御済み) | `{ text }` |
| `status_update` | ステータス値変更 | `{ field, value, glyphId, goldData, dlevelData, change, color }` |
| `clear_nhwindow` | ウィンドウ消去要求 | `{ windowId }` |
| `display_nhwindow` | ウィンドウ表示/ブロッキング | `{ windowId, blocking, resolver }` |
| `inputRequired` | プレイヤー入力待ち状態発生 | `{ context, type, promptCategory, question, choices, defaultChoice, prompt, items, how, detectedName, isTopLevelTurn, resolver }` |
| `bell` | C コアビープ音発生 | `{}` |
| `exit_nhwindows` | ゲーム終了時 | `{ message }` |

---

## 4. Web Worker 隔離アーキテクチャ ＆ 非同期 Shim ブリッジ

メインスレッドでの UI レンダリング（60fps）やユーザー入力を滑らかに維持するため、ドライバーコアおよび Wasm エンジンをバックグラウンドの Web Worker 上で分離稼働させる構成が標準化されています。

```mermaid
graph TD
    subgraph MainThread ["メインスレッド (UI / GKL レイヤー)"]
        UI["クライアント UI / WebUICore / GKL"]
        Bridge["NetHackWasmWorkerBridge"]
    end
    
    subgraph WorkerThread ["Worker スレッド (バックグラウンド)"]
        Worker["nethack.worker.js"]
        Driver["NetHackWasmDriver"]
        Memory["NetHackMemory (bridgeCall)"]
        Wasm["NetHack 5.0.1 Wasm Engine + shim_bridge.c"]
    end

    UI -->|イベント受聴 / queueSequence / callShim| Bridge
    Bridge <-->|postMessage (EVENT / RESPOND_INPUT / CALL_SHIM / SHIM_RESULT)| Worker
    Worker <-->|イベント転送 / シーケンス制御| Driver
    Worker <-->|CALL_SHIM バッファ確保・解放・読出| Memory
    Driver <--> Memory
    Memory <-->|_shim_bridge_call / getValue / FS| Wasm
```

1. **`NetHackWasmWorkerBridge.js` (メインスレッド側)**:
   - UI / Core レイヤーから `NetHackWasmDriver` と同一のインターフェースとしてアクセスできる透過ブリッジ。
   - **`callShim(cmd, arg1, arg2, bufferSize, bufferType)`**: Worker 内の `NetHackMemory.bridgeCall` を `callId` 付きの Promise で非同期呼び出しし、Wasm ヒープから読み出した構造化バッファ（`int32` / `uint8` / `string`）を 1 往復で安全にメインスレッドへ返却します。
2. **`nethack.worker.js` (Worker スレッド側)**:
   - `CALL_SHIM` メッセージを受信すると、`bufferSize > 0` の場合は `mem.allocateBuffer(bufferSize)` で一時バッファを確保して `mem.bridgeCall(cmd, arg1, arg2, bufPtr, bufferSize)` を実行し、結果を型変換して `mem.freeBuffer(bufPtr)` で確実にメモリ解放した上で `SHIM_RESULT` を返送します。

