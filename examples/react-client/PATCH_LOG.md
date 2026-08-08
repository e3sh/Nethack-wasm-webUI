# React 18 Client - WebUIcore / Driver パッチ＆調整記録 (PATCH_LOG.md)

本ドキュメントは、`Modern_Web_Components_Update_Rules.md` および `WebUICore_Handoff_and_TODO.md` に基づき、React 18 サンプルクライアントの開発・更新作業において発生した WebUIcore / Driver との適合問題および Web コンポーネント側で実施した調整（パッチおよび本実装適用）を記録するログファイルです。

---

## パッチ・調整記録および本実装移行一覧

| ID | 対象機能 | 発生した問題・現象 | Webコンポーネント側での調整対応（パッチ内容） | 本来 WebUIcore / Driver に求められる改善案 | 状態 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#001** | React 18 StrictMode / 解体二重発火 | `SafeResolver: Worker bridge resolver was already resolved. Ignoring duplicate call.` が発生し画面停止 | `useNetHackDriver.ts` 内でのイベント重複登録をガードし、シングルインスタンス参照に統一 | `WebUICore` 側の idempotent リスナーバインド | **本実装完了 (パッチ解消)** |
| **#002** | `deleteSaveFile` | `TypeError: this.core.clearAllStorage is not a function` エラーが発生し削除不可 | `useNetHackDriver.ts` 内で `globalCore.deleteSaveFile()` 透過APIを直接呼び出すようにリファクタリング | `WebUICore` への `deleteSaveFile()` メソッド透過定義 | **本実装完了 (パッチ解消)** |
| **#003** | `askname` / `InputPrompt` | "Who are you?" などの名前入力で 1 文字入力した瞬間に送信されてしまう | `InputPrompt.tsx` にて `isTextPrompt` (`ASKNAME`/`TEXT`/`getlin`) の判定を最優先にし行入力を保護 | `inputRequired` イベントでのカテゴリ抽象化の強化 | **本実装完了 (パッチ解消)** |
| **#004** | プレイ中 `Restart` / WASM再起動 | `core.restart()` 実行時に `RuntimeError: memory access out of bounds` が発生 | `restartGame()` にて `WebUICore.restart()` 透過クリーン再起動APIを利用するようリファクタリング | Worker / Wasm 側の安全な再起動 API サポート | **本実装完了 (パッチ解消)** |
| **#005** | `GameOverModal` スコア表示 | `#quit` や討死時に Top 10 ランキングが表示されない | `GameOverResolver` の標準 `scoreboard` 配列をダイレクトバインド | `GameOverResolver` の返却プロパティ名の統一規格化 | **本実装完了 (パッチ解消)** |
| **#006** | `choices` 選択肢明記・動的ボタン | 指輪装着 (`r`/`l`) 等で何を入力すべきか不明、無関係な Yes/No ボタンが表示 | `InputPrompt.tsx` で `inputRequired` が返す構造化 `options` 配列を優先バインドするよう本実装 | `inputRequired` イベントで選択肢アイテム配列 (`options: [{key, label}]`) を構造化データとして返却 | **本実装完了 (パッチ解消)** |
| **#007** | `MENU` フォーカスハイライト | カーソルキー (`↑`/`↓`) での項目選択時にハイライト枠線が表示されない | `App.css` に `.menu-item-row.focused` スタイルを追加し、`MenuModal.tsx` のフォーカス移動を関数型更新に修復 | GUI用メニューアイテム状態の共通UI抽象化 | **本実装完了 (パッチ解消)** |
| **#008** | トラベルキー (`_` / Shift+Minus) | `WebUICore` の `sendKeyEvent` で `_` (アンダースコア) 入力時、ASCII 95 が届かずトラベル不可 | `WebUICore` 側の `convertToAscii` で単一記号文字優先パスと `specialKeyMap` (Shift+Minus) を修復 | `WebUICore` 側のキーマッピング修復 | **本実装完了 (コア修正により解消)** |
| **#009** | リスタート時マップ暗転停滞 | `core.restart()` 実行後にキャンバス描画イベントが届かず画面が暗転したまま停滞 | `useNetHackDriver.ts` の `restartGame()` にてセーブ削除の上 `location.reload()` で確実なクリーン復帰を暫定適用 | `WebUICore.prototype.restart()` 内で Worker / WASM メモリ再構築と全マップ描画リセット (`map_cleared`) を自動発行 | **暫定対応済 (要コア改修)** |

---

## 💡 今後の更新アイデア / 次期改善提案 (Update Ideas)

- **[更新アイデア #009] タッチ / スマホ用 D-Pad 仮想コントローラーのコンポーネント化**:
  - `WebUICore.sendAction('MOVE_UP')` などのアクション送信機能が備わったため、各サンプルにスマホ操作用のオプショナルな画面上 D-Pad 仮想ボタンコンポーネントを追加すると、モバイル環境でのプレイ感が大きく向上する。
- **[更新アイデア #010] サウンド / SE 音効用イベントフック機能**:
  - `SoundEngine` のSE再生タイミング（攻撃hit、階段移動など）と連動し、Webコンポーネント側でアニメーションエフェクト（画面シェイクや画面フラッシュ）を発火させる簡易イベントリスナーを追加提案。

---
