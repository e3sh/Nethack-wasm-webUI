# NetHackWasmDriver コア機能改善・将来リファクタリング計画 (`docs/driver_improvements.md`)

各種モダン Web フロントエンド（Vue 3, React, Svelte, SolidJS 等）向けサンプルクライアント (`examples/`) および WebUI コアを構築・検証する中で明確になった、**`NetHackWasmDriver` コア本体 (`src/driver/`) の全 16 項目の改善および不具合の完全修正完了ドキュメント**です。

---

## 📋 コア機能改善および不具合修正の実績一覧

### 1. ビルトイン・セーフ・レスポンダー (`SafeResolver` / 二重応答防止の標準搭載) `[✅ 実装完了]`
- **背景**: UI 側のキーイベントとボタンクリック等で 1 つの `resolver` に対して 2 回 `respond()` が呼ばれると、Web Worker 内で `Resolver not found or already resolved` 警告が発生する。
- **改善結果**: Driver / Bridge 側で `resolver` を配信する段階で、一度呼び出された `respond()` / `cancel()` を safe no-op にする `SafeResolver` ラッパーを標準搭載。

### 2. 空メニュー / 選択肢なしメニューの自動短縮応答 (`autoRespondEmptyMenu`) `[✅ 実装完了]`
- **背景**: NetHack C コアは時折 `select_menu` としてメッセージ文言のみを送り、選択項目 (`items`) が空 (`[]`) またはヘッダーのみで選択可能アイテムが存在しないメニューを発行する。
- **改善結果**: Driver コア側で `items` が空の `select_menu` を検知した場合、UI イベントを発火せずに即座に C コアへ `0` を自動返送して進行させるオプション (`autoRespondEmptyMenu: true` デフォルト ON) を標準搭載。

### 3. メッセージ重複自動フィルタ (`deduplicateMessages`) `[✅ 実装完了]`
- **背景**: NetHack C コアの仕様上、太字メッセージ等の出力時に `raw_print_bold` と `raw_print` が同報発行され、メッセージログに同文面が 2 行重畳表示される。
- **改善結果**: Driver の `shim_raw_print_bold` の重複 emit 構造を修正し、さらに `deduplicateMessages: true` オプションを設け、直前ログと全く同じテキストメッセージの自動重複カット機能を標準提供。

### 4. `DLEVEL` ステータスの構造化強化 (`NetHackMemory.js`) `[✅ 実装完了]`
- **背景**: C コアから届く `fld === 20` (`DLEVEL`) の生データは `"Dlvl:1"`, `"Tut:1"`, `"Mines:1"` などのポインタ文字列。
- **改善結果**: `NetHackMemory.js` の `parseStatusUpdate` 内で、ダンジョン名を含む階層文字列 (`dlevelStr`: `"Tut:1"`), 階層数値 (`dlevelNum`: `1`), ダンジョンブランチ名 (`branch`: `"Tut"`) を含む `dlevelData` オブジェクトを標準提供。

### 5. `locateFile` の相対パス計算アルゴリズム修復 `[✅ 実装完了]`
- **背景**: Live Server や GitHub Pages などのサブディレクトリ環境で `wasmJsUrl` が `'./nethack.js'` と指定された場合の参照エラー。
- **改善結果**: ベース URL や `new URL()` を併用した完全決定論的な相対/絶対パス計算ロジックへ固定化。

### 6. C コア起動時 sysconf ノイズログの自動フィルタリング (`filterSysconfLogs`) `[✅ 実装完了]`
- **背景**: C コア起動時、`sysconf` 初期設定読み込みの際にデバッグログが発行され画面にノイズ混入していた。
- **改善結果**: Driver に `filterSysconfLogs: true`（デフォルト ON）オプションを設け、ノイズログを Driver レイヤーで自動除外。

### 7. Gold (`field 10`) ステータスデコードの `goldData` オブジェクト参照の標準化 `[✅ 実装完了]`
- **改善結果**: ドライバーの JSDoc および TypeScript 型定義 (`types/index.d.ts`) に `goldData` の型定義と明確なドキュメントを追加。

### 8. `NetHackWasmWorkerBridge.terminate()` の標準 API 化 `[✅ 実装完了]`
- **改善結果**: React / Vue / Svelte コンポーネント解体時に Worker の破棄を行う `.terminate()` メソッドを標準 API 化。

### 9. ユーザープロンプトコンテキストの保護と Stale ログの正常化 (`isUserPromptContext`) `[✅ 実装完了]`
- **背景**: 入力待ち不要な画面描画 (`shim_display_nhwindow` `blocking: false`) が `createPending('display')` を発呼し、直前の `askname` 等の本物のプロンプトが Stale 化（無効化）されて名前入力がスキップされる現象。
- **改善結果**: `blocking === false` の場合は `createPending` を呼ばず即復帰するよう修正。また `InputResolver` 内に `isUserPromptContext` 判定を設け、表示系イベントが本物のユーザープロンプトを誤破棄しない保護回路を導入。Stale ログ出力をデバッグ時のみに調整。

### 10. `shim_get_ext_cmd` (拡張コマンド `#`) における `safeResolver` 型バグの修正 `[✅ 実装完了]`
- **背景**: `#` 拡張コマンド（`pray`, `dip`, `jump` 等）入力時、Driver 内部で `safeResolver` オブジェクトを関数として呼び出して `TypeError` がスローされ、プロミスが解決されずゲームがフリーズする不具合。
- **改善結果**: `extResolverObj` 内の受容・キャンセルハンドラを `safeResolver.respond()` および `safeResolver.cancel()` を呼ぶ正統なメソッド形式へ修正。単体テストを追加。

### 11. Structured Clone 対策・自動 Plain Copy / アンラップ機能 (`unwrapPayload`) `[✅ 実装完了]`
- **改善結果**: Driver / Bridge コアの `respond(val)` 入口で、`val` が Proxy や Object の場合に自動的に Plain JavaScript Object にディープコピー（アンラップ）する変換処理を標準搭載。

### 12. `select_menu` 応答の自動フォーマット＆安全バリア (`normalizeMenuResponse`) `[✅ 実装完了]`
- **改善結果**: Driver コア側で `select_menu` 応答の引数を自動検証し、単一オブジェクトが渡された場合は `[item]` 配列へ自動整形、falsy / 不正型の場合は `0` へ補正して C コアへ送る安全バリアを標準搭載。

### 13. スプライトタイルマッピング (`tileMapping.js`) の ESM モジュール標準エクスポート `[✅ 実装完了]`
- **改善結果**: `@nethack/wasm-driver` パッケージから `import { getTileMapping } from '@nethack/wasm-driver'` として ESM モジュール形式で直接エクスポート可能化。

### 14. プロンプト種別の統一構造化ヘルパー (`promptCategory`) `[✅ 実装完了]`
- **改善結果**: `inputRequired` イベント発行時、Driver レイヤーで解析済みの統一型プロパティ `promptCategory` (`'TEXT'` | `'YN'` | `'KEY'` | `'MENU'` | `'POSKEY'` | `'FILE'` | `'OTHER'`) を最初から付与して UI へ配信。

### 15. TypeScript 型定義ファイル (`types/index.d.ts`) の公式提供 `[✅ 実装完了]`
- **改善結果**: `NetHackWasmDriver`, `NetHackWasmWorkerBridge`, イベントペイロードの完全な TypeScript 型定義 `types/index.d.ts` を同梱。

### 16. WebUI (Canvas版) 独自一行入力 `defaultShowInput` 内 150ms 非同期ギャップの解消 `[✅ 実装完了]`
- **背景**: Canvas 版の独自一行入力中に 150ms の非同期 `setTimeout` 待機が挟まれていたため、その空き時間にタイプされたキーが 1 文字コマンドとして NetHack C コアへ漏れ出し、改行中断やコマンド暴発が発生していた現象。
- **改善結果**: 非同期ウェイトを削除し、タイピング時に `r.pendingInputResolve = handler` を即時維持するように修正。

---

## 🛠️ 各種サンプルクライアント側の適用・改善実績

1. **Vue 3 サンプルクライアント (`examples/vue-client`)**
   - Composition API の `ref<any>(null)` による Resolver の Proxy 化・参照破損を解消するため、通信部を `driverController` シングルトン構造に一元化。
   - `InputPrompt.vue` の `isYNPrompt` 判定から `"direction"`（"In what direction?" 等の方向入力プロンプト）を除外し、キー入力を正常受容できるよう修正。

2. **React / Svelte / SolidJS サンプルクライアント**
   - シングルトン / `useRef` 設計により Proxy 問題を受けない構造であることを確認。
   - React 版の `InputPrompt.tsx` においても `respondPrompt` 統一呼び出しへ安全性を強化。

3. **全 8 クライアント・ポータルダッシュボード (`cltest.html`)**
   - ルートに全 8 クライアント（Core WebUI 2種, Driver Test 2種, サンプル 4種）をワンクリックで起動・検証できるポータルページを新設。

---

## 🧪 単体テスト検証方法

ドライバーパッケージ内のテストは Node.js 標準テストランナー (`node --test`) で実行可能です：

```bash
node --test src/driver/test/InputResolver.test.js src/driver/test/NetHackMemory.test.js src/driver/test/NetHackWasmDriver.test.js
```

**テスト結果**: 全 10 件 PASS
