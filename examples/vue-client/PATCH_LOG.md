# Vue 3 Client - WebUIcore / Driver パッチ＆調整記録 (PATCH_LOG.md)

本ドキュメントは、`Modern_Web_Components_Update_Rules.md` に基づき、Vue 3 サンプルクライアントの開発・更新作業において発生した WebUIcore / Driver との適合問題および Web コンポーネント側で実施した調整（暫定パッチ/ワークアラウンド）を記録するログファイルです。

---

## パッチ・調整記録一覧

| ID | 対象機能 | 発生した問題・現象 | Webコンポーネント側での調整対応（パッチ内容） | 本来 WebUIcore / Driver に求められる改善案 | 状態 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#001** | `deleteSaveFile` | `TypeError: this.core.clearAllStorage is not a function` エラーが発生し削除不可 | `useNetHackDriver.ts` 内で `this.core.driver.deleteSaveFile()` を安全に呼び出す処理に修正 | `WebUICore` に `deleteSaveFile()` メソッドを透過定義 | **暫定対応済** |
| **#002** | `askname` / `InputPrompt` | "Who are you?" などの名前入力で 1 文字入力した瞬間に送信されてしまう | `InputPrompt.vue` にて `isTextPrompt` (`ASKNAME`/`TEXT`/`getlin`) の判定を最優先にし行入力を保護 | `inputRequired` イベントでのカテゴリ種別抽象化の強化 | **暫定対応済** |
| **#003** | プレイ中 `Restart` / WASM再起動 | `core.restart()` 実行時に `RuntimeError: memory access out of bounds` が発生 | `restartGame()` にて既存の `WebUICore` / `WorkerBridge` を `destroy()` しクリーン再初期化を実装 | Wasm/Worker の内部 C メモリリセットおよび再初期化 API (`driver.restart()`) の安全化 | **暫定対応済** |
| **#004** | `GameOverModal` スコア表示 | `#quit` や討死時に Top 10 ランキングが表示されない | `GameOverResolver` が返却するプロパティ名 `scoreboard` / `records` / `topScores` のフォールバック参照を実装 | `GameOverResolver` の返却プロパティ名の統一規格化 | **暫定対応済** |
| **#005** | `MENU` キーナビゲーション | 上下矢印キー (`↑`/`↓`) でのフォーカス移動および `Enter` 選択機能の不足 | `MenuModal.vue` に `focusedIndex` 状態を追加し、`ArrowUp`/`ArrowDown` でヘッダーをスキップしつつ移動し、`Enter` で決定する処理を実装 | メニューナビゲーション状態を標準プロトコルとして Driver/WebUICore 側でもサポート | **暫定対応済** |
| **#006** | 修飾キー入力 (Ctrl / Alt) | ブラウザ標準のショートカットキーに奪われコマンド入力が不可 | `handleGlobalKeyDown` で `ctrlKey`/`altKey` 判定時に `preventDefault()` を呼び出し WASM へ確実に送信 | キーボードイベントマッピングとショートカット横取り制御のライブラリ化 | **暫定対応済** |
| **#007** | `choices` 選択肢明記・動的ボタン | 指輪装着 (`r`/`l`) 等で何を入力すべきか不明、無関係な Yes/No ボタンが表示 | `InputPrompt.vue` で `choices` (例: `"rl"`) をパースし `[Choices: r/l]` の明記 ＆ `[ Right (r) ]` `[ Left (l) ]` 等の動的ボタン生成を実装 | `inputRequired` イベントで選択肢アイテム配列 (`options: [{key, label}]`) を構造化データとして返却 | **暫定対応済** |

---
