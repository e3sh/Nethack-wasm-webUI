---
title: driver_api_reference
status: active
last_updated: 2026-08-15
related_code:
  - src/driver/
---

# NetHackWasmDriver API リファレンスガイド (API Reference Guide)

本書は `@nethack/wasm-driver` パッケージ (`NetHackWasmDriver`, `NetHackWasmWorkerBridge`, `NetHackMemory`, `NetHackFSManager`, `InputResolver`) のコンストラクタ、起動オプション、公開メソッド、発行イベント、およびレスポンダーオブジェクトの完全な API リファレンスです。

> [!TIP]
> **導入手順・起動フロー・Wasmコア差し替えガイド**
> ゼロからの導入手順、起動コード例、Wasmコア（`nethack.js` / `.wasm`）のバージョン変更・切り替え方法については 📄 **[ドライバー導入・クイックスタートガイド](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/1_driver/driver_quickstart_guide.md)** をご覧ください。

---

## 1. コンストラクタ `new NetHackWasmDriver(options)`

ドライバーのインスタンスを生成します。

```javascript
import { NetHackWasmDriver } from '@nethack/wasm-driver';

const driver = new NetHackWasmDriver({
    wasmModule: window.Module,
    gameOptions: {
        name: 'Hero',          // ユーザー名 (-uHero & OPTIONS=name:Hero へ自動組み込み)
        number_pad: 1,         // テンキー移動オプション
        showexp: true,         // 経験値表示
        time: true,            // ターン数表示
        showvers: true         // バージョン表示
    },
    filterSysconfLogs: true,   // sysconf デバッグノイズログの自動フィルタ (デフォルト: true)
    deduplicateMessages: true, // 直前と同文面メッセージの自動重複カット (デフォルト: true)
    autoRespondEmptyMenu: true,// 選択項目がない空メニューの自動即時応答 (デフォルト: true)
    arguments: [],             // カスタム C main 起動引数 (省略時は自動生成)
    debug: false               // デバッグログ出力
});
```

### オプションプロパティ

| プロパティ名 | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| `wasmModule` | `Object` | `window.Module` | Emscripten Wasm モジュールオブジェクト |
| `gameOptions` | `Object` | `{ number_pad: 1, ... }` | NetHack 起動オプション設定オブジェクト |
| `filterSysconfLogs` | `boolean` | `true` | Cコア起動時の `MAXPLAYERS` 等システムノイズログの自動カット |
| `deduplicateMessages` | `boolean` | `true` | 直前ログと全く同一文面メッセージの自動重複除去 |
| `autoRespondEmptyMenu` | `boolean` | `true` | 選択肢アイテムのない閲覧専用空メニューの `0` 自動返送応答 |
| `arguments` | `Array<string>` | `null` | C コア `main()` へ渡すコマンドライン引数 |
| `debug` | `boolean` | `false` | ドライバ内部デバッグログのコンソール出力 |

---

## 2. 公開メソッド (Public Methods)

### `driver.init(wasmModule)`
ドライバーの内部状態とメモリヘルパー (`NetHackMemory`) を初期化し、C シムグラフィックコールバック `nhDispatcher` を登録します。

### `async driver.start(customArgs = null)`
NetHack Wasm C コアエンジンの `main()` 関数を実行起動します。
- **戻り値**: `Promise<number>` (C main の終了コード)

### `driver.on(eventName, callback)` / `driver.off(eventName, callback)`
ドライバーからの各種イベントリスナーを登録・解除します。

### `bridge.terminate()` / `driver.destroy()`
Web Worker プロセスを破棄し、イベントハンドラ・メモリ参照を安全に解放・終了します。

### `async bridge.listSaveFiles()`
VFS (`/save` および `/` ディレクトリ) 内に存在するすべてのセーブファイルの一覧を取得します。

### `async bridge.deleteSaveFile(filename)`
指定されたセーブファイル（および IndexedDB の永続化データ）を物理削除します。

---

## 3. シーケンス制御 ＆ サイレントクエリ API (Sequence Control)

### `driver.queueSequence(tokens, options = {})`
連続するキー入力や抽象方向トークンの配列をタスクとして **FIFO（先入れ先出し）タスクキュー** へ投入し、Cコアの `inputRequired` 発生タイミングに合わせて安全に自動消化・自動応答します。
- **引数**:
  - `tokens`: `Array<string | number>` - トークン配列 (例: `['#', 'kick', 'DIR_E']` や `['i']`)
  - `options`: `Object` - `{ suppressPrompts: boolean }` (省略可)
    - `suppressPrompts`: `true` に設定すると、画面プロンプト（`putmsg`）の発行を抑止してサイレント消化を行います。
- **特徴**:
  - 連続で投入された場合でも既存のシーケンスを上書き破棄せず、先行するシーケンスの完了および空いたタイミングで順次安全に開始します。

### `driver.cancelSequence()`
実行中のシーケンスおよび FIFO タスクキューに予約されている未実行の全シーケンスを即時クリアし、通常状態に安全復帰します。

### `driver.getLastSequenceBuffer()`
直近に完了したシーケンス、または現在実行中のシーケンスがキャプチャした実行結果バッファ（`putstr`, `select_menu`, `display_file`, `raw_print` 等のオブジェクト配列）のクリーンコピーを取得します。

### `driver.isExecutingSequence` (プロパティ / Read-Only)
現在ドライバーが自走シーケンスを実行中（アクティブなタスクが存在）かどうかを示す `boolean` フラグです。

---

## 4. ドライバー発行イベント一覧 (Driver Events)

### `stateChange`
ドライバーの内部実行状態が変更された際に発火します。
- **ペイロード**: `{ state: string, oldState: string }`
- **状態値**: `'IDLE'`, `'RUNNING'`, `'WAITING_INPUT'`, `'WAITING_MENU'`, `'STOPPED'`, `'ERROR'`

### `inputRequired`
プレイヤーからの入力待ち状態（ターン待機・質問・メニュー選択・テキスト入力・拡張コマンド）が発生した際に発火します。
- **ペイロード構造**:
  ```typescript
  interface InputRequiredEvent {
      context: string;        // 'yn_function', 'select_menu', 'getlin', 'askname', 'nhgetch', 'poskey', 'get_ext_cmd'
      type: string;           // 'char', 'yn', 'menu', 'line', 'ext_cmd', 'string'
      promptCategory: 'TEXT' | 'YN' | 'KEY' | 'MENU' | 'POSKEY' | 'FILE' | 'OTHER'; // ★構造化タグ
      question?: string;      // 質問内容
      choices?: string;       // 受容可能な選択肢文字列 (例: "ynaq", "hjklyubn")
      defaultChoice?: string; // デフォルト選択肢 (例: 'y')
      prompt?: string;        // 入力プロンプト
      items?: MenuItem[];     // メニュー項目配列 (select_menu 時)
      how?: number;           // メニュー選択方式 (0: VIEW_ONLY, 1: PICK_ONE, 2: PICK_ANY)
      detectedName?: string;  // セーブデータ自動検知名 (askname 時)
      resolver: SafeResolver; // ★二重呼び出し・Proxy自動解除対応済み安全レスポンダー
  }
  ```

#### レスポンダーオブジェクト (`SafeResolver`)
UI 側からは `resolver.respond(value)` または `resolver.cancel()` を呼び出します。
- **二重呼び出し防止 (Safe Guard)**: 同じ Resolver に対して 2 回以上 `respond()` を呼んでも 2 回目以降は安全な no-op となり警告・例外が発生しません。
- **Proxy ディープコピー (unwrapPayload)**: Vue 3 / SolidJS 等の Reactive State (Proxy) オブジェクトを渡した場合、Worker 通信前に自動的に Plain JavaScript Object に変換されます。

---

## 5. エクスポートモジュール一覧

```javascript
import {
  NetHackWasmDriver,
  NetHackWasmWorkerBridge,
  NetHackMemory,
  NetHackFSManager,
  InputResolver,
  getTileMapping
} from '@nethack/wasm-driver';
```

- **`getTileMapping()`**: 2D Canvas 描画用のスプライトタイルインデックス参照テーブル（`Record<number, number>`）を取得します。

---

## 6. TypeScript 型定義サポート

本パッケージには公式 TypeScript 型定義ファイル `types/index.d.ts` が同梱されており、TypeScript プロジェクトで型補完・型安全性が有効です。

---

## 7. 履歴・互換性ノート (History & Compatibility)

- **Worker 構造の分離**: 初期仕様では C コアがメインスレッドで同期的に直接動作していましたが、バージョン 2.0 以降は Web Worker 上で完全非同期通信（`NetHackWasmWorkerBridge`）を行うアーキテクチャに進化しました。
- **コンテキスト保護**: 非ブロック画面表示 (`shim_display_nhwindow` `blocking: false`) が `askname` 等の待機中プロンプトを誤って上書き破棄しないコンテキスト保護 (`isUserPromptContext`) が導入されています。
