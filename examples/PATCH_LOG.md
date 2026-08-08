# 全サンプルクライアント共通 - WebUIcore 改善・抽象化パッチログ (`examples/PATCH_LOG.md`)

本ドキュメントは、`Modern_Web_Components_Update_Rules.md` および `WebUICore_Handoff_and_TODO.md` に基づき、全サンプルクライアント（Vue 3, React 18, Svelte, SolidJS）に共通して存在する**「本来 UI 側に書くべきではなく、次期 WebUIcore 改善フェーズにてコア側が吸収・一括抽象化すべき課題」**を記録する共通パッチログファイルです。

---

## 🏛️ 全クライアント共通 - WebUIcore 抽象化・改善課題一覧

| ID | 対象機能 | 現状の UI 側コード（暫定対応） | 本来 WebUIcore に求められる理想の抽象化・改善案 | コア改修後の期待されるコンポーネント記述 | 状態 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **#E-001** | クリーンリスタート | UI 側で `localStorage.clear()`, `sessionStorage.clear()`, `deleteSaveFile()` を順次呼び出しブラウザリロード | `WebUICore.prototype.restart({ clearStorage: true })` 内で VFS セーブ消去・全ストレージ破棄・Worker 再起動・`map_cleared` 発行を一括自動化 | `await core.restart({ clearStorage: true })` | **コア改修完了 (完全吸収・解決済)** |
| **#E-002** | プロンプト ESC キャンセル | UI 側で `respondPrompt(27)` のように ASCII マジックナンバー (`27`) を直接指定して送信 | `WebUICore` にプロンプトキャンセル専用 API (`cancelPrompt()`) または統一キー定数 (`WebUICore.KEYS.ESC`) を用意 | `core.cancelPrompt()` | **コア改修完了 (完全吸収・解決済)** |
| **#E-003** | モーダルタイトルクレンジング | UI 側で `rawPrompt.length < 40 && !rawPrompt.includes('Press Space')` などの文言判定でタイトル補正 | `WebUICore` 側の `textWindowModal` や `FILE` イベント内で整形・翻訳済みの `title` プロパティを生成して伝送 | `gameStore.setTextModal({ title: payload.title, ... })` | **コア改修完了 (完全吸収・解決済)** |
| **#E-004** | ゲームオーバー死因表記 | UI 側で `deathMessage || translatedDeathMessage || death` などの多重フォールバックを参照 | `GameOverResolver` の返却型オブジェクトプロパティ名を `deathMessage` (翻訳済) に完全統一保証 | `<p>{{ gameOverResult.deathMessage }}</p>` | **コア改修完了 (完全吸収・解決済)** |
| **#E-005** | メニューアクセラレータ表示 | UI 側で `item.charStr || (item.accelerator ? String.fromCharCode(...) : '')` と手動相互変換 | `WebUICore` の `guiData.options` 各要素において表示用一文字 `charStr` (`'a'`, `'b'` 等) を 100% 保証 | `<span>{{ item.charStr }})</span>` | **コア改修完了 (完全吸収・解決済)** |

---

## 💡 次期 WebUIcore 改善サイクルへの反映方針

上記 5 つの課題項目は、次回 **「WebUIcore 一括改善フェーズ (第 3 サイクル)」** へ進むことが宣言された際、`src/core/WebUICore.js` および関連モジュールへ一括して実装・還元されます。

これにより、各フレームワーク用サンプルクライアントの UI コードはさらに洗練され、ブラウザ特有の操作やマジックナンバーから完全に解放されます。
