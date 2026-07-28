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

---

## 4. 段階的リファクタリング・ロードマップ (Strangler Fig パターン)

既存の動作する WebUI 環境を一切破壊せずに移行を進める 4 フェーズ構成です。

```
[Phase 1: モジュール新規作成] ➔ [Phase 2: 最小テスト環境検証] ➔ [Phase 3: GameManager 接続] ➔ [Phase 4: 完全移行・クリーンアップ]
```

### 📍 Phase 1: Driver モジュールの新規作成
- 既存コードを変更せず、`src/driver/` 配下に以下を新規作成。
  - `src/driver/NetHackMemory.js`
  - `src/driver/InputResolver.js`
  - `src/driver/NetHackWasmDriver.js`

### 📍 Phase 2: 最小テスト環境 (`driver_test.html`) での検証
- 軽量な検証用 HTML `driver_test.html` を作成（文字ログと入力テキストボックスのみ）。
- `NetHackWasmDriver` の単体起動、`shim_putstr` の受信、キーボードレスポンス（Asyncify 復帰）が純粋な Driver 単体で動くことを単体テスト検証。

### 📍 Phase 3: 既存 `GameManager.js` への接続 (パラレル移行)
- `GameManager.js` 内の直接 Shim 処理・ポインタ処理を撤去。
- `GameManager` が `NetHackWasmDriver` のイベントを受信し、既存の `jncurses`, `trancelate`, `SoundManager` へリレーするように改修。
- 既存の全画面 (`game.html`, `mobile.html`, `game_jp.html`) が正常動作することを確認。

### 📍 Phase 4: クリーンアップ & パッケージ独立化
- `GameManager.js` の不要コードを完全除去（スリム化）。
- `src/driver/` を単体ライブラリ（npm / 再利用可能モジュール）として整理。

---

## 5. 次回 Conversation（引き継ぎ）用コンテキスト & 指示書

次の会話を始める際は、以下のプロンプトをそのまま入力してください。

```text
前回のセッションで作成した「docs/driver_architecture_and_roadmap.md」の設計仕様書に基づき、NetHackWasmDriver の分離・実装プロジェクトを開始します。

まず【Phase 1: Driver モジュールの新規作成】として、以下のファイルを src/driver/ に作成してください。
1. src/driver/NetHackMemory.js
2. src/driver/InputResolver.js
3. src/driver/NetHackWasmDriver.js

GameManager.js 内のポインタ処理 (getPointerValue, setPointerValue, parseGlyphInfo) や eventHook のロジックを参考に、純粋な Driver モジュールとして実装をお願いします。
```

### 関連主要参照ファイル
*   仕様書: [docs/driver_architecture_and_roadmap.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/driver_architecture_and_roadmap.md)
*   現在の Wasm ブリッジ実装: [rogue/GameManager.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/rogue/GameManager.js)
*   Shim インターフェース仕様: [docs/shim_reference.ja.md](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/shim_reference.ja.md)
*   メインエントリポイント: [sys/main.js](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/sys/main.js)
