# Svelte Client - WebUIcore / Driver パッチ＆調整記録 (PATCH_LOG.md)

本ドキュメントは、`Modern_Web_Components_Update_Rules.md` に基づき、Svelte サンプルクライアントの開発・更新作業において発生した WebUIcore / Driver との適合問題および Web コンポーネント側で実施した調整（暫定パッチ/ワークアラウンド）を記録するログファイルです。

---

## パッチ・調整記録一覧

| ID | 対象機能 | 発生した問題・現象 | Webコンポーネント側での調整対応（パッチ内容） | 本来 WebUIcore / Driver に求められる改善案 | 状態 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#001** | 初期化未発火 (State IDLE 停止) | `App.svelte` 読み込み時に `driverController.init()` が実行されずゲームが動作しない | `App.svelte` の `onMount` ライフサイクルで `driverController.init()` を明示的に呼び出し | フレームワーク統合プロトコル/自動初期化ラッパーの検討 | **暫定対応済** |
| **#002** | `deleteSaveFile` | `TypeError: this.core.clearAllStorage is not a function` エラーが発生し削除不可 | `useNetHackDriver.ts` 内で `this.core.driver.deleteSaveFile()` を安全に呼び出す処理に修正 | `WebUICore` への `deleteSaveFile()` メソッド透過定義 | **暫定対応済** |
| **#003** | `askname` / `InputPrompt` | "Who are you?" などの名前入力で 1 文字入力した瞬間に送信されてしまう | `InputPrompt.svelte` にて `isTextPrompt` (`ASKNAME`/`TEXT`/`getlin`) の判定を最優先にし行入力を保護 | `inputRequired` イベントでのカテゴリ抽象化の強化 | **暫定対応済** |
| **#004** | プレイ中 `Restart` / WASM再起動 | `core.restart()` 実行時に `RuntimeError: memory access out of bounds` が発生 | `restartGame()` にて既存の `WebUICore` インスタンスを `destroy()` しクリーン再初期化を実装 | Worker / Wasm 側の安全な再起動 API サポート | **暫定対応済** |
| **#005** | `choices` 選択肢明記・動的ボタン | 指輪装着 (`r`/`l`) 等で何を入力すべきか不明、無関係な Yes/No ボタンが表示 | `InputPrompt.svelte` で `choices` (例: `"rl"`) をパースし `[Choices: r/l]` の明記 ＆ `[ Right (r) ]` `[ Left (l) ]` 等の动的ボタン生成を実装 | `inputRequired` イベントで選択肢アイテム配列 (`options: [{key, label}]`) を構造化データとして返却 | **暫定対応済** |
| **#006** | グローバルCSS未読込 | メッセージ欄が縦に伸びたり、メニューモーダルがマップ下にインライン展開される | `main.ts` に `import './App.css'` を追記し、メッセージ欄の固定高さ・自動スクロールおよび固定オーバーレイを復元 | クライアント構築用標準テンプレート/ベーススタイルのバンドル提供 | **暫定対応済** |

---
