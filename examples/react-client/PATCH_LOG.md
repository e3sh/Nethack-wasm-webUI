# React 18 Client - WebUIcore / Driver パッチ＆調整記録 (PATCH_LOG.md)

本ドキュメントは、`Modern_Web_Components_Update_Rules.md` に基づき、React 18 サンプルクライアントの開発・更新作業において発生した WebUIcore / Driver との適合問題および Web コンポーネント側で実施した調整（暫定パッチ/ワークアラウンド）を記録するログファイルです。

---

## パッチ・調整記録一覧

| ID | 対象機能 | 発生した問題・現象 | Webコンポーネント側での調整対応（パッチ内容） | 本来 WebUIcore / Driver に求められる改善案 | 状態 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#001** | React 18 StrictMode / 解体二重発火 | `SafeResolver: Worker bridge resolver was already resolved. Ignoring duplicate call.` が発生し画面停止 | `useNetHackDriver.ts` 内でのイベント重複登録をガードし、シングルインスタンス参照に統一 | `WebUICore` 側の idempotent リスナーバインド | **暫定対応済** |
| **#002** | `deleteSaveFile` | `TypeError: this.core.clearAllStorage is not a function` エラーが発生し削除不可 | `useNetHackDriver.ts` 内で `globalCore.driver.deleteSaveFile()` を呼び出すように修正 | `WebUICore` への `deleteSaveFile()` メソッド透過定義 | **暫定対応済** |
| **#003** | `askname` / `InputPrompt` | "Who are you?" などの名前入力で 1 文字入力した瞬間に送信されてしまう | `InputPrompt.tsx` にて `isTextPrompt` (`ASKNAME`/`TEXT`/`getlin`) の判定を最優先にし行入力を保護 | `inputRequired` イベントでのカテゴリ抽象化の強化 | **暫定対応済** |
| **#004** | プレイ中 `Restart` / WASM再起動 | `core.restart()` 実行時に `RuntimeError: memory access out of bounds` が発生 | `restartGame()` にて既存の `WebUICore` インスタンスを `destroy()` しクリーン再初期化を実装 | Worker / Wasm 側の安全な再起動 API サポート | **暫定対応済** |
| **#005** | `GameOverModal` スコア表示 | `#quit` や討死時に Top 10 ランキングが表示されない | `GameOverResolver` が返却する `scoreboard` / `records` / `topScores` をフォールバック取得 | `GameOverResolver` の返却プロパティ名の統一規格化 | **暫定対応済** |
| **#006** | `choices` 選択肢明記・動的ボタン | 指輪装着 (`r`/`l`) 等で何を入力すべきか不明、無関係な Yes/No ボタンが表示 | `InputPrompt.tsx` で `choices` (例: `"rl"`) をパースし `[Choices: r/l]` の明記 ＆ `[ Right (r) ]` `[ Left (l) ]` 等の動的ボタン生成を実装 | `inputRequired` イベントで選択肢アイテム配列 (`options: [{key, label}]`) を構造化データとして返却 | **暫定対応済** |
| **#007** | `MENU` フォーカスハイライト | カーソルキー (`↑`/`↓`) での項目選択時にハイライト枠線が表示されない | `App.css` に `.menu-item-row.focused` スタイルを追加し、`MenuModal.tsx` のフォーカス移動を関数型更新に修復 | GUI用メニューアイテム状態の共通UI抽象化 | **暫定対応済** |

---
