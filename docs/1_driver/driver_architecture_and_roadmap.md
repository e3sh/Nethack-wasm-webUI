# NetHackWasmDriver 設計仕様書 & リファクタリングロードマップ

本ドキュメントは、**NetHack 5.0 Wasm WebUI** における C/Wasm コアと JavaScript UI 層の密結合を解き、単体で再利用・テスト可能な汎用ドライバ **`NetHackWasmDriver` (`@nethack/wasm-driver`)** のアーキテクチャ設計仕様および実装完了報告です。

---

## 1. プロジェクトの目的と背景

### 目的
1. **Wasm Shim レイヤーの単体独立化**: C言語（`winshim.c`）との低レイヤー通信・メモリ型変換・Asyncify 同期制御を `NetHackWasmDriver` として完全にカプセル化する。
2. **UI・クライアントのマルチ化**: 独立した Driver の上に、従来の Canvas WebUI、Mobile DOM UI のみならず、Vue 3, React 18, Svelte, SolidJS などの現代的なフロントエンドや Node.js テストクライアントを接続可能にする。
3. **堅牢性と安全性の向上**: Asyncify の入力待機漏れによるブラウザフリーズ（デッドロック）を、Driver 側のセーフティネット（`SafeResolver`, `unwrapPayload`, `autoRespondEmptyMenu` 等）により防止する。

---

## 2. アーキテクチャ設計仕様

### 2.1 3層レイヤー構造

```
+-------------------------------------------------------------+
| Layer 1: NetHack 5.0 Wasm Core (C / winshim.c / Asyncify)  |
+-------------------------------------------------------------+
                              | (Web Worker / postMessage)
                              v
+-------------------------------------------------------------+
| Layer 2: NetHackWasmDriver (@nethack/wasm-driver)           |
|  - NetHackMemory.js   (型変換 / ポインタ解釈 / オフセット計算) |
|  - InputResolver.js    (Asyncify 安全 Promise / SafeResolver)|
|  - NetHackWasmWorkerBridge.js (Worker 非同期メッセージ中継)  |
|  - Driver Core         (EventEmitter / ドメインイベント変換) |
+-------------------------------------------------------------+
                              | (Typed Events / High-level API)
                              v
+-------------------------------------------------------------+
| Layer 3: Client Applications & Framework Examples           |
|  - WebUI (Canvas / DOM Mobile)                              |
|  - Modern Frameworks (Vue 3, React 18, Svelte, SolidJS)     |
|  - Driver Test & Driver DOM Test Clients                    |
+-------------------------------------------------------------+
```

### 2.2 構成モジュール詳細

#### ① `src/driver/NetHackMemory.js` (メモリ・型変換モジュール)
Emscripten メモリとの低レイヤー相互変換を隠蔽する。
- `parseStatusUpdate(fld, val, ptr)`: C 側のステータス生データを構造化データ（`DLEVEL` 階層オブジェクト `dlevelData`, 所持金 `goldData` 等）にデコード。
- `parseGlyphInfo(ptr)`: C 側の `glyph_info` 構造体メモリから `glyph`, `symbol`, `color`, `flags` をデコード。

#### ② `src/driver/InputResolver.js` (Asyncify セーフティレスポンダー)
Wasm 側の同期入力待ち（`nhgetch`, `yn_function`, `select_menu`, `get_ext_cmd` 等）のハングアップを防ぐ安全網。
- **SafeResolver**: 1 つの Resolver に対して `respond()` が重複呼び出しされた場合、2 回目以降を安全な no-op にガード。
- **unwrapPayload (Proxy 解除)**: Vue 3 / SolidJS 等の State (Proxy) オブジェクトを Worker へ送る際、自動的に Plain JavaScript Object にアンラップ。
- **isUserPromptContext (コンテキスト保護)**: 入力不要な画面表示 (`shim_display_nhwindow` `blocking: false`) による待機中本物プロンプトの誤破棄 (Stale化) を防止。

#### ③ `src/driver/NetHackWasmDriver.js` (ドライバ本体)
EventEmitter ベースのセントラルクラス。
- `filterSysconfLogs: true` (起動時デバッグノイズログの自動カット)
- `deduplicateMessages: true` (同文面メッセージの自動重複除去)
- `autoRespondEmptyMenu: true` (空メニューの `0` 自動即時返送)
- `promptCategory` 付与 (`'TEXT'`, `'YN'`, `'KEY'`, `'MENU'`, `'POSKEY'`, `'FILE'`, `'OTHER'`)

#### ④ `src/driver/NetHackWasmWorkerBridge.js` (Web Worker 隔離モデル)
Wasm エンジンを Web Worker 内で分離稼働させ、メインスレッドの UI レンダリング（60fps）やキー入力を完全に独立・並行実行する。

---

## 3. 全 16 項目 リファクタリング実装完了実績

| # | 項目 | 状態 | 概要 |
|---|---|---|---|
| 1 | **SafeResolver** | ✅ **完了** | 二重応答を自動的に安全な no-op にガード |
| 2 | **autoRespondEmptyMenu** | ✅ **完了** | 選択項目のない空メニューの C コア自動即時応答 (`0` 返送) |
| 3 | **deduplicateMessages** | ✅ **完了** | `raw_print_bold` 等の同報・同文面メッセージの自動重複除去 |
| 4 | **DLEVEL 構造化デコード** | ✅ **完了** | ダンジョン名・階層数値・ブランチ名を完全構造化データとして提供 |
| 5 | **locateFile 相対パス修復** | ✅ **完了** | GitHub Pages / サブディレクトリ配備時の WASM パス計算の完全化 |
| 6 | **filterSysconfLogs** | ✅ **完了** | Cコア起動時の `MAXPLAYERS` 等ノイズログの自動カット |
| 7 | **goldData 標準化** | ✅ **完了** | 所持金 (`field 10`) の構造化オブジェクトデコード提供 |
| 8 | **terminate() API** | ✅ **完了** | コンポーネント解体時の Worker 安全破棄 API 提供 |
| 9 | **コンテキスト保護 Guard** | ✅ **完了** | `isUserPromptContext` による非ブロック描画でのプロンプト誤破棄防止 |
| 10 | **shim_get_ext_cmd 修正** | ✅ **完了** | `#` 拡張コマンドにおける `safeResolver` 型バグの修正 |
| 11 | **unwrapPayload (Proxy解除)** | ✅ **完了** | Vue/Solid/Svelte 等の State (Proxy) を自動 Plain Object 化 |
| 12 | **normalizeMenuResponse** | ✅ **完了** | `select_menu` 応答引数の自動補正バリア搭載 |
| 13 | **ESM TileMapping** | ✅ **完了** | `import { getTileMapping } from '@nethack/wasm-driver'` の標準エクスポート |
| 14 | **promptCategory タグ** | ✅ **完了** | UI 側での条件分岐を単純化する構造化タグの自動付与 |
| 15 | **types/index.d.ts** | ✅ **完了** | TypeScript 型定義ファイルの公式同梱 |
| 16 | **safeSaveSync** | ✅ **完了** | VFS ↔ IndexedDB のセーブデータ自動永続化同期 |

---

## 4. 履歴・互換性アーカイブ (History & Compatibility)

- **初期仕様からの進化**: 初期 WebUI はメインスレッドでの完全同期 C コア実行を行っていましたが、Driver 2.0 では `NetHackWasmWorkerBridge` による Web Worker 分離並列モデルへ移行し、メインスレッドのレスポンシブ性が大幅に向上しました。
- **全 8 クライアント検証**: 本 Driver は既存の WebUI (Canvas/DOM) および 4 つのモダンフレームワーク (Vue 3, React 18, Svelte, SolidJS) の全クライアントで動作検証済みです。
