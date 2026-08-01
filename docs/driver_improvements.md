# NetHackWasmDriver コア機能改善・将来リファクタリング計画 (`docs/driver_improvements.md`)

各種モダン Web フロントエンド（Vue 3, React, Svelte, SolidJS 等）向けサンプルクライアント (`examples/`) を構築・検証する中で明確になった、**`NetHackWasmDriver` コア本体 (`src/driver/`) へ今後フィードバック・標準搭載すべき改善アイデアの集積ドキュメント**です。

既存の全クライアント（既存 WebUI, MobileDomClient, DriverDomTestClient 等）との互換性を保護するため、全サンプルの完成後に本計画に基づく一括リファクタリング（メジャーバージョンアップ）を実施します。

---

## 📋 コア機能改善アイデア一覧と精査結果

### 1. ビルトイン・セーフ・レスポンダー (`SafeResolver` / 二重応答防止の標準搭載) `[❌ 未実装 / 要改善]`
- **背景**: UI 側のキーイベントとボタンクリック等で 1 つの `resolver` に対して 2 回 `respond()` が呼ばれると、Web Worker 内で `Resolver not found or already resolved` 警告が発生する。
- **現状**: WorkerBridge / Worker 側で重複検出時に Warning を出す構造はあるが、二重呼び出し自体をフロントで吸収するガードはない。
- **改善案**: Driver / Bridge 側で `resolver` を生成・配信する段階で、一度呼び出された `respond()` / `cancel()` を safe no-op にする **`SafeResolver` ラッパー** を標準で渡す構造にする。

### 2. 空メニュー / 選択肢なしメニューの自動短縮応答 (`autoRespondEmptyMenu`) `[❌ 未実装 / 要改善]`
- **背景**: NetHack C コアは時折 `select_menu` としてメッセージ文言のみを送り、選択項目 (`items`) が空 (`[]`) またはヘッダーのみで選択可能アイテムが存在しないメニューを発行する。クライアント側で判定漏れがあると画面がフリーズする。
- **現状**: 現在 `shim_select_menu` は `items` が空であっても `inputRequired` を無条件で UI へ発行している。
- **改善案**: Driver コア側で `items` が空の `select_menu` を検知した場合、UI イベントを発火せずに即座に C コアへ `0` を自動返送して進行させるオプション (`autoRespondEmptyMenu: true` デフォルト ON) を標準搭載する。

### 3. メッセージ重複自動フィルタ (`deduplicateMessages`) `[❌ 未実装 / 要改善]`
- **背景**: NetHack C コアの仕様上、太字メッセージ等の出力時に `raw_print_bold` と `raw_print` が同報発行され、クライアント側で受容するとメッセージログに同文面が 2 行重畳表示される。
- **現状**: `shim_raw_print_bold` 内で `raw_print_bold` と `raw_print` の両方を emit しており、重複表示の一因になっている。
- **改善案**: Driver の `shim_raw_print_bold` の重複 emit 構造を修正し、さらに `deduplicateMessages: true` オプションを設け、直前ログと全く同じテキストメッセージの自動重複カット機能を標準提供する。

### 4. `DLEVEL` ステータスの構造化強化 (`NetHackMemory.js`) `[❌ 未実装 / 要改善]`
- **背景**: C コアから届く `fld === 20` (`DLEVEL`) の生データは `"Dlvl:1"`, `"Tut:1"`, `"Mines:1"` などのポインタ文字列。クライアント側で数字だけを抽出するとダンジョンブランチ切り替え（チュートリアルや鉱山等）のマップクリアが検知できなくなる。
- **現状**: `parseStatusUpdate` 内に `BL_DLEVEL` (20) の専用デコーダがまだ入っていない。
- **改善案**: `NetHackMemory.js` の `parseStatusUpdate` 内で、ダンジョン名を含む階層文字列 (`dlevelStr`: `"Tut:1"`), 階層数値 (`dlevelNum`: `1`), ダンジョンブランチ名 (`branch`: `"Tut"`) を含む `dlevelData` オブジェクトを標準提供する。

### 5. `locateFile` の相対パス計算アルゴリズム修復 `[⚠️ 一部対応済み / 強化要]`
- **背景**: Live Server や GitHub Pages などのサブディレクトリ環境で `wasmJsUrl` が `'./nethack.js'` と指定されると、従来の `locateFile` は誤った階層を参照して 404 HTML エラーが発生することがあった。
- **現状**: `nethack.worker.js` 内で `.js` -> `.wasm` 置換処理が一部実装された。
- **改善案**: ベース URL や `new URL()` を併用した完全決定論的な相対/絶対パス計算ロジックへ固定化・修復する。

### 6. C コア起動時 sysconf ノイズログの自動フィルタリング (`filterSysconfLogs`) `[❌ 未実装 / 要改善]`
- **背景**: C コア起動時、`sysconf` 初期設定読み込みの際に `raw_print` 経由で `"MAXPLAYERS are set in sysconf file."` や `"WIZARDS are set in sysconf file."` などの初期化デバッグログが発行され、画面上のメッセージログにノイズ混入していた。
- **現状**: フィルター処理はなく、そのまま UI へ転送されている。
- **改善案**: Driver に `filterSysconfLogs: true`（デフォルト ON）オプションを設け、C コアシステム初期化ノイズログを Driver レイヤーで自動除外してゲームメッセージのみをクリーンに配信する。

### 7. Gold (`field 10`) ステータスデコードの `goldData` オブジェクト参照の標準化 `[✅ コード実装済み / 型・ドキュメント要追加]`
- **背景**: NetHackMemory.js は `status_update` 発行時に `goldData: { glyphId, amount, raw }` オブジェクトをすでにデコード生成して渡す設計になっている。
- **現状**: コードレベルでは `NetHackMemory.js:193` に実装済みだが、型定義やクライアント開発ガイドラインへの明確な記載が不足している。
- **改善案**: ドライバーの `status_update` イベントの型定義および使用ガイドラインとして、Gold (`field 10`) 参照時は `goldData.amount` を直接使用することを明記・型定義に追加する。

### 8. `NetHackWasmWorkerBridge.terminate()` の標準 API 化 `[✅ 実装完了]`
- **背景**: React 18 の `useEffect` アンマウント処理（StrictMode のダブルインボーク等）やコンポーネント解体時に Worker の破棄を行う `.terminate()` メソッドが必要。
- **精査結果**: **`NetHackWasmWorkerBridge.js:319` に既に実装済み** (`this.worker.terminate()`, `STOPPED` 状態移行)。標準 API として使用可能。

### 9. ドライバー層でのコンテキスト排他ガードと `inputRequired` 状態遷移の自動制御 (`inputContextGuard`) `[❌ 未実装 / 要改善]`
- **背景**: `askname` や `yn_function` の直後、C コアから高速連続で `inputRequired` や `display_nhwindow` が届く際、古い Resolver がフォールバック値（0 や ESC）を C コアへ返してしまい、Wasm コアへ偽入力が送信されて UI がフリーズする問題が発生する。
- **現状**: 旧 Resolver のキャンセル時に C コアへフォールバック値が返信される仕様になっている。
- **改善案**: Driver / Bridge 側で新しい `inputRequired` が届いた際、直前の未解決 `resolver` を「Cコアへの応答なしで安全に stale 化（無効化）」し、UI 側でも現在の待ち状態を判断できる `currentContext` フラグを Driver から標準提供する。

---

## 🔮 将来の拡張構想 (Future Extensions)

### 10. 公式フレームワーク・アダプター & セーブマネージャーのエクスポート `[🔮 将来拡張]`
- 全サンプルが出揃い検証が完了した段階で、共通の通信・状態連携フック (`useNetHackDriver`) および 同一 IndexedDB 領域のセーブ管理クラス (`SaveManager`) を Driver パッケージの一部として公式エクスポート (`import { useNetHackDriver, SaveManager } from '@nethack/wasm-driver'`) できるように拡張する。

### 11. Structured Clone 対策・DataCloneError を防ぐ自動 Plain Copy / アンラップ機能 (`unwrapPayload`) `[❌ 未実装 / 要改善]`
- **背景**: Vue 3 の `reactive`/`ref` Proxy や SolidJS の Signal/Proxy、Svelte Store 等の State オブジェクトを Worker へ `respond(val)` する際、`postMessage` 時の Structured Clone アルゴリズムで `DataCloneError: Cannot clone object containing proxy` が発生する。
- **改善案**: Driver / Bridge コアの `respond(val)` 入口で、`val` が Object/Array の場合に自動的に Plain JavaScript Object にディープコピー（アンラップ）する変換処理を標準搭載する。

### 12. `select_menu` 応答の自動フォーマット＆安全バリア (`normalizeMenuResponse`) `[❌ 未実装 / 要改善]`
- **背景**: C コアの `select_menu` 応答では、選択項目は `[item]` 配列、未選択/キャンセルは `0` を返すプロトコルがある。万が一クライアントが単一オブジェクト `{ identifier: 1 }` や不適切な型を返すと C コアがクラッシュする。
- **改善案**: Driver コア側で `select_menu` 応答の引数を自動検証し、単一オブジェクトが渡された場合は `[item]` 配列へ自動整形、falsy / 不正型の場合は `0` へ補正して C コアへ送る安全バリアを標準搭載する。

### 13. スプライトタイルマッピング (`tileMapping.js`) の ESM モジュール標準エクスポート `[❌ 未実装 / 要改善]`
- **背景**: 2D Canvas 描画用のタイルインデックス参照関数 `tileMapping()` が現在各サンプルの script タグ経由 `window.tileMapping` 読み込みになっている。
- **改善案**: `@nethack/wasm-driver` パッケージから `import { getTileMapping } from '@nethack/wasm-driver'` として ESM モジュール形式で直接エクスポート可能にし、HTML への script タグ直書きを不要にする。

### 14. プロンプト種別の統一構造化ヘルパー (`promptCategory`) `[❌ 未実装 / 要改善]`
- **背景**: C コアから届く `context` 名 (`yn_function`, `yn`, `askname`, `getlin`, `get_ext_cmd`, `nhgetch`, `poskey` 等) は多岐にわたり、UI 側の条件分岐が複雑化しやすい。
- **改善案**: `inputRequired` イベント発行時、Driver レイヤーで解析済みの統一型プロパティ `promptCategory` (`'TEXT'` | `'YN'` | `'TURN'` | `'MENU'` | `'POSKEY'` | `'FILE'`) を最初から付与して UI へ配信する。

### 15. [新規提案] TypeScript 型定義ファイル (`types/index.d.ts`) の公式提供 `[❌ 未実装 / 要改善]`
- **背景**: 現在 Vite, React, Vue, Svelte 等の TypeScript プロジェクトで `@nethack/wasm-driver` を利用する場合、型定義ファイルが存在しないため TypeScript 型チェックで `any` 扱いとなり、補完や型安全性が活かせない。
- **改善案**: `NetHackWasmDriver`, `NetHackWasmWorkerBridge`, イベントペイロード (`InputRequiredEvent`, `StatusUpdateEvent` 等) の完全な `.d.ts` ファイルをパッケージ内に同梱し、TypeScript 対応を標準化する。

### 16. [新規提案] Web Worker / IndexedDB セーブデータの Auto-Flush & 離脱前同期 (`safeSaveSync`) `[❌ 未実装 / 要改善]`
- **背景**: ブラウザを閉じる際やタブの移動時に、Emscripten VFS に書き込まれたセーブデータが IndexedDB へ書き戻される前にセッションが切断され、データ損失が発生するリスクがある。
- **改善案**: 一定周期での自動 Flush（`autoSaveInterval`）や `beforeunload` と連携したセーフセーブ同期機能を WorkerBridge に標準搭載する。

---

## 🗺️ 実装ロードマップ & 開発フェーズ計画

一括リファクタリング（メジャーバージョンアップ）実施時は、以下の 3 フェーズに分けて段階的に実装・検証を進めます。

### Phase 1: コアの安全性・フリーズ防止 (Core Safety) 【最優先】
UI と Worker / Wasm 間の通信安全性、二重発火、フリーズ、Proxy 伝送エラーを防ぐ最優先ガードを実装します。
- **1. SafeResolver**: 二重応答を自動的に安全な no-op にガード
- **9. inputContextGuard**: 新しい入力要求発生時に旧 Resolver を safe stale 化し、`currentContext` を提供
- **11. unwrapPayload**: Vue/Solid/Svelte 等の State (Proxy) を自動的に Plain Object へアンラップ
- **12. normalizeMenuResponse**: `select_menu` への応答引数を安全な型・配列へ自動補正

### Phase 2: データ解釈・ログクリーン化 (Data & Quality)
C コア特有のノイズや非構造化データを Driver レイヤーで吸収し、UI が扱いやすい形式に整えます。
- **2. autoRespondEmptyMenu**: 選択項目がないメニューの C コア自動即時応答 (`0` 返送)
- **3. deduplicateMessages**: `raw_print_bold` 等の同報・同文面メッセージの自動重複除去
- **4. DLEVEL 構造化**: `dlevelData` (`dlevelStr`, `dlevelNum`, `branch`) の自動生成
- **6. filterSysconfLogs**: C コア起動時 sysconf ノイズログの除外
- **14. promptCategory**: プロンプト種別の統一構造化タグ付与 (`'TEXT'`|`'YN'`|`'MENU'`|`'KEY'`|`'POSKEY'`|`'FILE'`)

### Phase 3: DX 向上・型定義・エクスポート (Developer Experience)
開発体験の向上とフレームワーク連携の容易化を図ります。
- **7. goldData ドキュメント・型定義化**: JSDoc および TS 型定義への明記
- **13. tileMapping.js ESM 化**: パッケージ本体からの `import { getTileMapping }` サポート
- **15. TypeScript 型定義 (`types/index.d.ts`)**: 完全な TS 型定義ファイルの公式同梱
- **16. Safe-Save / Auto-Flush 同期**: 離脱前・定周期での VFS ⇔ IndexedDB 自動同期

---

## ⚙️ 新追加オプションとデフォルト値方針

既存クライアントとの完全な互換性を維持しつつ、デフォルトで安全・クリーンに動作するようオプションの初期値を以下のように規定します。

| オプション名 | デフォルト値 | 役割・説明 |
|---|---|---|
| `autoRespondEmptyMenu` | `true` | 空メニュー検知時に UI を待たず C コアへ自動応答する |
| `deduplicateMessages` | `true` | 直前と全く同じメッセージログの重複 emit を自動カットする |
| `filterSysconfLogs` | `true` | C コア起動時の sysconf 設定デバッグログを自動除外する |
| `inputContextGuard` | `true` | 新しい `inputRequired` 発生時に旧 Resolver を無効化する |
| `unwrapPayload` | `true` | `respond(val)` に渡された Proxy オブジェクトを自動 Plain Copy する |
| `normalizeMenuResponse` | `true` | `select_menu` の返り値を安全な `[item]` 配列/0 へ正規化する |

---

## 🧪 単体テスト (Unit Test) による検証計画

UI や WebAssembly コア全体を動作させずとも、Driver 単体で品質を担保できるよう `src/driver/test/` 内に以下のテストスイートを追加・実行します。

1. **`InputResolver.test.js`**
   - `respond()` が 2 回呼ばれた場合に 2 回目が安全に無視されるか (SafeResolver)
   - Vue/Svelte 風の Proxy オブジェクトを渡した際に Plain Object にアンラップされるか (unwrapPayload)
2. **`NetHackMemory.test.js`**
   - `parseStatusUpdate` で `fld === 20` (DLEVEL) が `dlevelData` オブジェクトに正しく変換されるか
   - `fld === 10` (Gold) が `goldData` として正常に解釈されるか
3. **`NetHackWasmDriver.test.js`**
   - `select_menu` 応答で不正な型（単一オブジェクトや null）が渡された時に `normalizeMenuResponse` が安全な値へ整えるか
   - 空の `menuItems` 時に `autoRespondEmptyMenu` が作動して C コアに即座に `0` を返せるか
