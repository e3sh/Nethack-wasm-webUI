# NetHackWasmDriver 設計仕様書 & リファクタリングロードマップ

本ドキュメントは、**NetHack 5.0 Wasm WebUI** における C/Wasm コアと JavaScript UI 層の密結合を解き、単体で再利用・テスト可能な汎用ドライバ **`NetHackWasmDriver`** を構築するための設計仕様書および段階的移行ロードマップです。

次回の開発セッション（新しい Conversation）へスムーズに引き継げるよう、現行の課題、設計アーキテクチャ、イベント仕様、実装ステップを網羅しています。

---

## 1. プロジェクトの目的と背景

### 目的
1. **Wasm Shim レイヤーの単体独立化**: C言語（`winshim.c`）との低レイヤー通信・メモリ型変換・Asyncify 同期制御を `NetHackWasmDriver` として完全にカプセル化する。
2. **UI・クライアントのマルチ化**: 独立した Driver の上に、現在の Canvas WebUI、Mobile DOM UI のみならず、React/Vue UI、Node.js ヘッドレス Bot、ログ解析リプレイ Viewer など様々なクライアントを接続可能にする。
3. **堅牢性と安全性の向上**: Asyncify の入力待機漏れによるブラウザフリーズ（デッドロック）を、Driver 側のセーフティネット（自動 ESC 補完・状態管理・タイムアウト）により防止する。

---

## 2. 現状の課題と構成の認識

*   **[rogue/GameManager.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/rogue/GameManager.js)**:
    *   `window.eventHook` を直接定義し、`switch(type)` で `shim_*` イベントを受信。
    *   Emscripten メモリの直接読み書き（`getPointerValue`, `setPointerValue`, `parseGlyphInfo`）を実施。
    *   `UIManager`, `jncurses`, `SoundManager`, `trancelate` などを直に呼び出しており、Wasm 規約と UI 表現が強く密結合している（約 1,500 行の肥大化）。
*   **[sys/main.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/sys/main.js)**:
    *   HTML Canvas 初期化、フォント・タイル画像アセットのプリロード、Dirty Flag 方式の描画ループ（GPU/CPU負荷制御）を担当。

---

## 3. `NetHackWasmDriver` アーキテクチャ設計仕様

### 3.1 3層レイヤー構造

```
+-------------------------------------------------------------+
| Layer 1: NetHack 5.0 Wasm Core (C / winshim.c)             |
+-------------------------------------------------------------+
                              | (emscripten_run_script)
                              v
+-------------------------------------------------------------+
| Layer 2: NetHackWasmDriver (汎用 Shim ブリッジ)              |
|  - NetHackMemory.js   (型変換 / ポインタ解釈 / オフセット計算) |
|  - InputResolver.js    (Asyncify 安全 Promise ラッパー)     |
|  - Driver Core         (EventEmitter / ドメインイベント変換) |
+-------------------------------------------------------------+
                              | (Typed Events / High-level API)
                              v
+-------------------------------------------------------------+
| Layer 3: Client Applications (UI / Logic)                    |
|  - Existing GameManager & WebUI (Canvas / DOM)              |
|  - Headless AI Bot / Test Client                            |
+-------------------------------------------------------------+
```

### 3.2 構成モジュール詳細

#### ① `src/driver/NetHackMemory.js` (メモリ・型変換モジュール)
Emscripten メモリとの低レイヤー相互変換を隠蔽する。
- `getPointerValue(ptr, type)`: `i32`, `i16`, `i8`, `UTF8ToString` 等の解釈。
- `setPointerValue(ret_ptr, type, value)`: `Module._malloc()` や `Module.setValue()` を用いた C 側メモリへの安全な書き込み。
- `parseGlyphInfo(ptr)`: C 側の `glyph_info` 構造体メモリから `glyph`, `symbol`, `color`, `flags`, `unicode` をデコード。

#### ② `src/driver/InputResolver.js` (Asyncify セーフティレスポンダー)
Wasm 側の同期入力待ち（`nhgetch`, `yn_function`, `select_menu` 等）のハングアップを防ぐ安全網。
- `respond(value)`: クライアントからの正当な応答を `resolve` する。
- `cancel()`: UI が途中で閉じられたり例外が起きた際、自動的に `ESC` (ASCII `27`) を `resolve` して Wasm のフリーズを回避。
- **Safety Timeout**: 開発・テスト時、指定時間（例: 30秒）応答がない場合、警告ログを出して自動 `cancel()`。

#### ③ `src/driver/NetHackWasmDriver.js` (ドライバ本体)
EventEmitter ベースのセントラルクラス。
- `eventHook(type, ...args)` を実装し、C 側の Shim イベントを受信。
- 受信データを Plain JS Object にデコードし、登録されたイベントリスナーへパブリッシュ。
- `state` (`IDLE`, `RUNNING`, `WAITING_INPUT`, `WAITING_MENU`) を管理し、不正な二重入力や応答漏れを防止。

### 3.3 定義イベント（DOM / Typed Events）

| イベント名 | パラメータ (`payload`) | 説明 |
| :--- | :--- | :--- |
| `putstr` | `{ windowId, attr, text }` | 文字列出力 |
| `print_glyph` | `{ windowId, x, y, tileId, symbol, color, unicode }` | タイル/文字描画 |
| `curs` | `{ windowId, x, y }` | カーソル移動 |
| `clear_nhwindow` | `{ windowId }` | ウィンドウ消去 |
| `display_nhwindow` | `{ windowId, blocking }` | ウィンドウ表示 |
| `inputRequired` | `{ context, type, prompt, choices, resolver }` | キー・選択待機要求 |
| `soundTrigger` | `{ text }` | メッセージフック音効発火 |

### 3.4 Web Worker 隔離モデル (Web Worker Integration)
YouTube再生フリーズなどの非同期タスク占有問題を解消するため、Driverを Web Worker 内で稼働させる並行実行モデルをサポートします。

```
+-------------------------------------------------------------------+
|  Main Thread (メインスレッド)                                      |
|    - client_ui  (DriverDomTestClient / UIManager.js)              |
|          ^                                                        |
|          | (Events: putstr, print_glyph, inputRequired)           |
|          v                                                        |
|    - NetHackWasmWorkerBridge.js (擬似 resolver 再構築 / 中継)        |
+-------------------------------------------------------------------+
                                  |
                                  | postMessage (resolverId, payload)
                                  v
+-------------------------------------------------------------------+
|  Worker Thread (Web Worker バックグラウンドスレッド)               |
|    - nethack.worker.js (Wasm ライフサイクル / ENV / preRun 早期設定)|
|          ^                                                        |
|          v (Direct API / syncfs / ccall)                          |
|    - NetHackWasmDriver.js (Wasm 駆動 & メモリ操作 & FS制御)         |
|    - NetHack Wasm Engine  (nethack.js / Wasm バイナリ)              |
+-------------------------------------------------------------------+
```

---

## 4. 段階的リファクタリング・ロードマップ (Strangler Fig パターン)

標準動作モデルとして **Web Worker 隔離モデル (`NetHackWasmWorkerBridge`)** を使用し、既存の WebUI 環境を安全に移行・リファクタリングします。

```
[Phase 1: モジュール作成 (済)] ➔ [Phase 2: テスト検証 (済)] ➔ [Worker化: WorkerBridge構築 (済)] ➔ [Phase 3: GameManager 接続 & UI機能復元 (済)] ➔ [Phase 4: クリーンアップ (次回)]
```

### ✅ Phase 1: Driver モジュールの新規作成 (完了)
- `src/driver/` 配下の全モジュール作成完了。

### ✅ Phase 2: 最小テスト環境での検証 (完了)
- `driver_test.html`, `driver_dom_test.html`, `MobileDomClient.js` での動作検証完了。

### ✅ Worker化: Web Worker 隔離によるマルチスレッド化 (完了・標準モデル)
- WasmコアをWorkerに分離した `NetHackWasmWorkerBridge` を標準動作モデルとして採用。

### ✅ Phase 3: 既存 `GameManager.js` への WorkerBridge 接続 ＆ UI機能復元 (完了)
- **達成成果**:
  - `GameManager.js` を `NetHackWasmWorkerBridge` イベント通信モデルへ接続変更。
  - 移動/非移動コマンド、インベントリ Glyph 描画、Look (`:`, `/`, `;`) タイルカーソル同期の正常化。
  - 日本語ファイル優先読み込み (`./dat/*_jp`) と `yn_function` 質問翻訳対応。
  - JIS キーボード (`#` / `IntlRo`) および拡張コマンド (`#` / EXT_CMD) プロンプト統合。
  - 死亡時墓石 ➔ TOP 10 ハイスコア表示 (VFS全パス探索 & `localStorage` 永続化 & 詳細死因記録) の完全修復。
  - `save_manager.html` に現行構成対応「Current Save Status」カードおよび詳細確認・削除 API を統合。
  - 参照専用長文メニュー (ダンジョン概要等) での `do...while` 無限ループフリーズ保護ガードの実装。
  - Cコア `paniclog` 解析に基づく `yn_function` レスポンス (`^M`) の安全自動正規化。

### 📍 Phase 4: クリーンアップ & パッケージ独立化 (次回実施予定)
- **タスク要件**:
  - `GameManager.js` 内の旧 Wasm 直結時代の不要コード（未使用の旧直接フック処理、不要な直接メモリ変換関数 `getPointerValue` / `parseGlyphInfo` 等）を安全に整理・除去し、純粋な UI アダプタへスリム化。
  - `src/driver/`（`NetHackWasmDriver`, `NetHackWasmWorkerBridge`, `NetHackFSManager`, `NetHackMemory`, `InputResolver`）を他プロジェクトから単体で再利用できる独立ライブラリとしてパッケージ整理・ドキュメント整備。

---

## 5. 次回 Conversation（引き継ぎ）用コンテキスト & 指示書

次の会話（新しい Conversation）を開始する際は、以下のプロンプトをそのまま入力してください。

```text
前回のセッションで「Phase 3: GameManager 接続 & UI機能復元」が 100% 完了しました。
「docs/1_driver/driver_architecture_and_roadmap.md」の設計仕様書に基づき、最後の【Phase 4: クリーンアップ & パッケージ独立化】の作業を開始してください。

具体的には：
1. GameManager.js 内に残っている旧 Wasm 直結時代の不要コード（未使用の直接ポインタ関数 getPointerValue / parseGlyphInfo 等やレガシーな不要処理）を安全にクリーンアップ・スリム化する。
2. src/driver/ 配下のモジュール群を、外部プロジェクトからも単体で独立利用できる汎用 WASM Driver ライブラリとして整理・クリーンアップする。
```

### 関連主要参照ファイル
*   仕様書: [docs/1_driver/driver_architecture_and_roadmap.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/driver_architecture_and_roadmap.md)
*   メイン UI マネージャー: [rogue/GameManager.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/rogue/GameManager.js)
*   Worker ブリッジ: [src/driver/NetHackWasmWorkerBridge.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/NetHackWasmWorkerBridge.js)
*   WASM ドライバコア: [src/driver/NetHackWasmDriver.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/driver/NetHackWasmDriver.js)
