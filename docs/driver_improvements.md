# NetHackWasmDriver コア機能改善・将来リファクタリング計画 (`docs/driver_improvements.md`)

各種モダン Web フロントエンド（Vue 3, React, Svelte, SolidJS 等）向けサンプルクライアント (`examples/`) を構築・検証する中で明確になった、**`NetHackWasmDriver` コア本体 (`src/driver/`) へ今後フィードバック・標準搭載すべき改善アイデアの集積ドキュメント**です。

既存の全クライアント（既存 WebUI, MobileDomClient, DriverDomTestClient 等）との互換性を保護するため、全サンプルの完成後に本計画に基づく一括リファクタリング（メジャーバージョンアップ）を実施します。

---

## 📋 コア機能改善アイデア一覧

### 1. ビルトイン・セーフ・レスポンダー (`SafeResolver` / 二重応答防止の標準搭載)
- **背景**: UI 側のキーイベントとボタンクリック等で 1 つの `resolver` に対して 2 回 `respond()` が呼ばれると、Web Worker 内で `Resolver not found or already resolved` 警告が発生する。
- **改善案**: Driver / Bridge 側で `resolver` を生成・配信する段階で、最初から二重呼び出しを安全に無視する **`SafeResolver` ラッパー** を標準で渡す構造にする。

### 2. 空メニュー / 選択肢なしメニューの自動短縮応答 (`autoRespondEmptyMenu`)
- **背景**: NetHack C コアは時折 `select_menu` としてメッセージ文言のみを送り、選択項目 (`items`) が空 (`[]`) またはヘッダーのみで選択可能アイテムが存在しないメニューを発行する。クライアント側で判定漏れがあると画面がフリーズする。
- **改善案**: Driver コア側で `items` が空の `select_menu` を検知した場合、UI イベントを発火せずに即座に C コアへ `0` を自動返送して進行させるオプション (`autoRespondEmptyMenu: true`) を標準搭載する。

### 3. メッセージ重複自動フィルタ (`deduplicateMessages`)
- **背景**: NetHack C コアの仕様上、太字メッセージ等の出力時に `raw_print_bold` と `raw_print` が同報発行され、クライアント側で受容するとメッセージログに同文面が 2 行重畳表示される。
- **改善案**: Driver に `deduplicateMessages: true` オプションを設け、直前ログと全く同じテキストメッセージの自動重複カット機能を標準提供する。

### 4. `DLEVEL` ステータスの構造化強化 (`NetHackMemory.js`)
- **背景**: C コアから届く `fld === 20` (`DLEVEL`) の生データは `"Dlvl:1"`, `"Tut:1"`, `"Mines:1"` などのポインタ文字列。クライアント側で数字だけを抽出するとダンジョンブランチ切り替え（チュートリアルや鉱山等）のマップクリアが検知できなくなる。
- **改善案**: `NetHackMemory.js` の `parseStatusUpdate` 内で、ダンジョン名を含む階層文字列 (`dlevelStr`: `"Tut:1"`) と 階層数値 (`dlevelNum`: `1`) の両方を最初から構造化プロパティとして標準提供する。

---

## 🔮 将来の拡張構想 (Future Extensions)

### 5. 公式フレームワーク・アダプターのエクスポート
- Vue, React, Svelte などの全サンプルが出揃い検証が完了した段階で、共通の通信・状態連携フックを Driver パッケージの一部として公式エクスポート (`import { useNetHackDriver } from '@nethack/wasm-driver/react'`) できるように拡張する。
