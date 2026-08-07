# WebUICore 開発引き継ぎ & タスク進捗ドキュメント

## 概要
NetHack WASM WebUI プロジェクトにおける Clean Architecture（Driver / Core / Event UI）に基づいたリファクタリングおよび `GameOverResolver` (勝敗判定 & ランキング解析) の単体検証完了状況と、次回セッションへの引き継ぎ事項です。

---

## 完了した成果 (Accomplished)

### 1. レイヤー責務分離 (Clean Architecture 徹底)
- **`NetHackFSManager.js` (Driver層)**:
  - ストレージ File I/O（`readXlogText()`, `readRecordText()`, `hasSaveData()`, `syncToPersistent()`, `_isRealSaveFile()`）に特化。
  - セーブファイルの判定を C コア標準規格 (`/^\d+[a-zA-Z0-9_\-]+$/`, UID数字+プレイヤー名) に限定し、`home` 等の非セーブデータの誤検出を完全解決。
  - ファイル読み出し時の `Uint8Array` デコード（`TextDecoder`）を安全化し、壊れない同期ロジックへ刷新。
- **`GameOverResolver.js` (Core層)**:
  - Wasm 終了時の勝敗・死因判定 (`resolveGameOver`) および Top 10 スコアボードパース (`parseRecordText`) を集約。
  - NetHack C言語コア ([`NetHackJP/src/topten.c`](file:///C:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/NetHackJP/src/topten.c)) の標準フォーマット (`fmt0` + `fmt33` + `fmtX`) および現行バージョン分離フィルター (`current_ver` 仕様) に完全準拠。
  - セーブデータが存在する中断時であっても、スコアボードを常に解析して返却する構成へ修正。

### 2. 単体テストポータルの完成
- **[`gameover_resolver_test.html`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/gameover_resolver_test.html)**:
  - IndexedDB の実環境データを可視化する Inspector (VFS `/save` 内一覧、`xlogfile` 生テキスト、`record` 生テキスト)。
  - モックデータ注入ボタン（Goblin討死, quit, escape, starve, セーブファイル作成/削除）。
  - バージョンフィルタードロップダウン（自動/5.0.0のみ/3.7.0のみ/全バージョン混在）を備え、動作検証が完了。

---

## 完了した成果 (Accomplished)

### 1. レイヤー責務分離 (Clean Architecture 徹底)
- **`NetHackFSManager.js` (Driver層)**:
  - ストレージ File I/O（`readXlogText()`, `readRecordText()`, `hasSaveData()`, `syncToPersistent()`, `_isRealSaveFile()`）に特化。
  - セーブファイルの判定を C コア標準規格 (`/^\d+[a-zA-Z0-9_\-]+$/`, UID数字+プレイヤー名) に限定し、`home` 等の非セーブデータの誤検出を完全解決。
  - ファイル読み出し時の `Uint8Array` デコード（`TextDecoder`）を安全化し、壊れない同期ロジックへ刷新。
- **`GameOverResolver.js` (Core層)**:
  - Wasm 終了時の勝敗・死因判定 (`resolveGameOver`) および Top 10 スコアボードパース (`parseRecordText`) を集約。
  - NetHack C言語コア ([`NetHackJP/src/topten.c`](file:///C:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/NetHackJP/src/topten.c)) の標準フォーマット (`fmt0` + `fmt33` + `fmtX`) および現行バージョン分離フィルター (`current_ver` 仕様) に完全準拠。
  - セーブデータが存在する中断時であっても、スコアボードを常に解析して返却する構成へ修正。

### 2. WebUICore へのコア機能統合 ＆ 型定義完備
- **`GameOverResolver` の WebUICore 自律統合**:
  - `WebUICore.js` にて Wasm 終了・死亡時に `GameOverResolver.resolveGameOver()` を自律呼出しし、UI側へ `gameOver` イベントおよび構造化データを通知。
  - `core.getHighScores()`, `core.getHighScoresAsync()` API により、UI 側が VFS を直接触らずにスコアボード配列を取得可能。
- **TypeScript 型定義 (`index.d.ts` & `WebUICore.d.ts`) の整備**:
  - `WebUICore`, `GameOverResolver`, `StatusAccessor`, `SoundEngine`, `TranslationEngine`, `StructuredStatus`, `ScoreboardEntry`, `GameOverResult` 等の全型定義を作成。

---

## ⚠️ 残課題 ＆ 次回のタスク (Remaining TODOs)

WebUICore のコア SDK 自体は安定動作に達していますが、**各Webコンポーネント版サンプル (`examples/` react, vue, svelte, solid) については手戻りや調整途中の未完成状態**です。

- [x] **TODO 1: WebUICore への GameOverResolver 統合** (完了)
- [x] **TODO 2: TypeScript 型定義 (`index.d.ts`) の整備** (完了)
- [ ] **TODO 3: 各サンプルクライアント (`examples/` react, vue, svelte, solid) の WebUICore 完全移行 ＆ 未完成部分の解消** (手戻り・未完成)
  - **現状の課題**:
    1. **旧状態管理の残存**: 各フレームワーク（React, Vue, Svelte, Solid）のストア側で `mapGrid`（80x21配列）やカーソル位置を独自二重管理しており、WebUICore の標準レンダラー（`CanvasRenderer` / `DOMGridRenderer`）との抽象統合が未完了。
    2. **Vite バンドル・アセット警告**: `tileMapping.js` のグローバル `<script>` タグ依存や `pict/nethack_default_32.png` の相対パスバンドルエラーの解消。
    3. **入力・モーダル二重制御**: キーボードイベント (`sendKey`) と各UIフレームワーク固有のモーダル状態 (`activeMenu`, `activeTextModal`) の二重判定を解消し、`WebUICore` に一括委任する構造への洗練。
