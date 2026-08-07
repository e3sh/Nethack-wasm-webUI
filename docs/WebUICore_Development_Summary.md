# 🐍 NetHack Wasm WebUICore 開発成果まとめ資料

## 1. プロジェクト概要と開発背景

本プロジェクトは、オリジナル NetHack 5.0 (3.7 dev) の C言語コアからコンパイルされた WebAssembly (`nethack.wasm`) を**一切無改造でそのまま使用**しながら、現代的なブラウザ UI（Vue 3, React 18, Svelte, SolidJS, Mobile, DOM）へ統一的なゲーム状態・イベント・レンダリング・操作インターフェースを提供する **`WebUICore` アーキテクチャの設計および実証実装** を行ったものです。

---

## 2. 実装完了した主要成果一覧

### 1. 厳密な 8 段階 Lifecycle & State マネジメント
- **`CoreState` 列挙型の定義と組み込み**:
  - `UNINITIALIZED` / `INITIALIZING` / `READY` / `RUNNING` / `WAITING_INPUT` / `GAME_OVER` / `EXITED` / `DESTROYED`
- **リソース準備ガード**:
  - Wasm / VFS / タイル画像等の非同期ロード中は `INITIALIZING` 状態となり、画面にローディングインジケーターを表示して初期化途中のキー入力や描画欠損を 100% ガード。
  - 準備完了時に自動で `READY` ➔ `RUNNING` へ安全移行。

### 2. ページリロード不要の即時リトライ (`restart()`)
- **`core.restart()` API**:
  - メモリ・ステータスアクセサ・テキストバッファ・カーソル位置を安全に全初期化し、ブラウザのページリロードを行わずに一瞬でニューゲームを再スタート可能。
  - 再開時の画面・ログ・ステータスDOMの完全初期リセット処理を構築。

### 3. モダンなメニュー操作インターフェース (UI 標準仕様)
- **上下カーソルキー (`↑` / `↓` / Numpad 8/2) ＋ `Enter` 決定 UI**:
  - インベントリやオプション画面等のボタンメニューにおいて、上下キーで選択フォーカス枠を移動し、`Enter` で即時決定できるモダンな操作系を構築。
  - 長大メニューの自動スクロール、マウスホバー、ショートカットキー（`a`, `b`, `c` 等）との完全な両立。
- **UI 表示改善**:
  - グリフID非存在時（`glyphId < 0`）のプレースホルダー CSS ボックス（「■ (グレー四角)」）を除去し、チェックボックス風に見えてしまう違和感を完全解消。
  - プロンプト問い合わせバー（`In What Direction?` 等）を絶対配置 (`position: absolute`) 化し、出没時のキャンバス縦揺れ・画面ガタつきを 100% 防止。

### 4. 高解像度スプライトタイル描画 ＆ 自動マップ消去
- **1280px キャンバス解像度**: `<canvas width="1280" height="336">`（80セル × 16px）に拡大し、右半分見切れを完全解消。
- **`tileImg.onload` 自動全画面再描画**: タイル画像の非同期ロード完了時に `redrawAllGraphicTiles()` を自動実行し、タイル画像抜けを解消。
- **階層変更・ダンジョン分岐移動時の自動全消去**:
  - `clear_nhwindow` 受信時のマップクリア処理をカプセル化。
  - ダンジョン分岐文字列（例: `Dlvl:1` ↔ `Tutorial:1` ↔ `Town:1`）の変更を全自動検知して `map_cleared` を発火。

### 5. ターゲットカーソルのリアルタイム追従 ＆ 残像防止
- **ターゲットカーソル (`curs`, `curs_nhwindow`) のリアルタイム追従**:
  - マップ探査 (`Look` モード `/` や目標選択時) において、操作中のターゲットカーソル位置 `(targetCursorX, targetCursorY)` に金色のフォーカス枠がぴったり追従。
- **境界内描画による残像ゴミの全廃**:
  - 描画領域を 16px * 14px セルの内側（`dx + 1.5`, `dy + 1.5`, `13px * 11px`）に収めて描画し、移動後のセル黒塗り消去時に枠線が 100% 上書き消去される仕組みを構築。

### 6. データデコード・型安全化・GameOverResolver 完全統合
- **ステータス数値直値 (BL_SCORE 8, BL_TIME 16 等) の正常デコード**:
  - Cコアから届くポインタ/整数値の型混在をドライバ層 (`NetHackMemory.js`) で型安全に解釈し、所持金 (`$`), スコア (pts), 総ターン数, 到達フロアをリアルタイム更新。
- **`GameOverResolver` 自律統合とハイスコア・ランキング API**:
  - Wasm 終了・死亡時に死因・勝敗判定を全自動解析し、`gameOver` イベントとして発火。
  - `core.getHighScores()`, `core.getHighScoresAsync()` API を追加し、UI 側が VFS を直接見に行かなくても構造化ランキング配列を取得できるカプセル化を提供。

### 7. TypeScript 型定義整備 ＆ Webコンポーネント版サンプルの現状課題
- **`index.d.ts` / `WebUICore.d.ts` の整備**:
  - `@core` パッケージ全体の型定義を整備し、React / Vue / Svelte / SolidJS からの TypeScript 開発を型安全にサポート。
- **Webコンポーネント版サンプル (`examples/` react, vue, svelte, solid) の手戻り・未完成課題**:
  - 各フレームワークサンプルは `WebUICore` インスタンスを生成して初期化する構造自体は組まれているものの、以下のような手戻り・調整途中の課題が残存しており、未完成状態にある：
    1. 各 UI ストアで `mapGrid`（80x21 配列）を直接更新する旧直参照パターンが残存しており、`WebUICore` のビルトインレンダラー（`CanvasRenderer` 等）との完全統合が未完了。
    2. HTML / Vite ビルド時の `tileMapping.js` グローバル `<script>` タグ依存やアセットバインド警告の解消が未完。
    3. キー入力 (`sendKey`) と UI 側の固有モーダル状態との二重制御の解消・最適化が未完。

### 8. テキストファイルオンデマンド翻訳・サウンド・ゲームパッド・タッチ操作の統合
- **`display_file` オフライン/オンライン解凍 ＆ 辞書引き API**:
  - ヘルプやドキュメントファイルの表示時に VFS および HTTP fetch を通じて取得・動的日本語化。
  - 単語辞書引き API (`lookupWord`) の提供。
- **SoundEngine ＆ GamepadManager ＆ TouchCalculator**:
  - メッセージキーワード連動 SE 再生 (`SoundEngine`)、ブラウザ Gamepad API 連動 (`GamepadManager`)、画面タップ領域判定 (`TouchCalculator`) をコアファサードにビルトイン。

---

## 3. WebUICore 動作検証ポータル (`webuicore_poc.html`)

- `webuicore_poc.html` において、上記全機能（ローディングガード、Graphic / Color ASCII 切替、翻訳 ON/OFF、上下キー メニュー選択、ターゲットカーソル追従、Game Over リザルトモーダル、Top 10 ランキング一覧、リロードなし Restart）を統合実証済み。
