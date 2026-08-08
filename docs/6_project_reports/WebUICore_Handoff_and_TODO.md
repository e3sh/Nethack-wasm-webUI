# WebUIcore / Driver 次期リファクタリング作業指示書 ＆ ロードマップ (WebUICore_Handoff_and_TODO.md)

> [!NOTE]
> **【完了報告】**  
> 本ドキュメントに記載されていた全 12 タスク（`inputRequired` 構造化データパース、キーコード・アクション送信統合、セーブデータ削除透過 API、Worker クリーン再起動 `restart({ clearStorage: true })`、`deathMessage` 統一、`charStr` 保証、`cancelPrompt()` 等）は **`src/core/` および各サンプルクライアントにおいて完全実装・適用完了** しました。本資料はアーカイブとして保存されています。

---

## 1. 基本設計思想 (Architectural Principle)

**「関心事の分離 (Separation of Concerns)」の徹底**

- **`WebUICore` (ドメイン / コア制御層)**:
  - C言語 (NetHack WASM) の複雑なテキストプロンプト・キーコード合成・メモリ状態を**「完全構造化された GUI 用コントロールデータ」**にパース・変換して提供する。
  - フロントエンド側で書く必要のないパース処理・入力変換処理を積極的に吸収する。
- **`UI / クライアントコンポーネント` (プレゼンテーション / 演出層)**:
  - `WebUICore` から受け取った構造化データを、デザイン・アニメーション・ダイアログ演出・各フレームワーク（Vue/React/Svelte/SolidJS）のスタイルで画面表示することだけに専念する。
  - パッド・タッチ・キーボード等のマルチデバイス対応を容易にする。

---

## 2. WebUIcore / Driver 改善タスク一覧 (全タスク完了)

### 【タスク 1】プロンプト・選択肢データの構造化 GUI データ変換 (`inputRequired` 規格化) `[✅ 実装完了]`
- **概要**: テキストベースのプロンプト（`category: "yn"`, `choices: "rl"`）を、UI コンポーネントがそのままバインド可能な構造化データへ自動パース変換する。
- **改修仕様**:
  - `inputRequired` イベントの payload に構造化オブジェクトを含める。
    ```typescript
    interface GUIInputRequiredPayload {
      inputType: 'CHOICE_BUTTONS' | 'LINE_TEXT' | 'MENU' | 'DIRECTION' | 'CONFIRM';
      promptText: string; // "Put on which ring?"
      choicesHint?: string; // "r or l"
      options?: Array<{ key: string; label: string; btnClass?: string }>;
    }
    ```
- **効果**: 指輪装着 (`r`/`l`) や Yes/No (`y`/`n`/`q`) 等の画面で、UI側が選択肢パース処理を書く必要がなくなり、コード量が半減した。

---

### 【タスク 2】キーコード合成・修飾キー変換レイヤーの `WebUICore` 統合 (`sendKeyEvent`) `[✅ 実装完了]`
- **概要**: ブラウザの生 `KeyboardEvent` や修飾キー (Ctrl/Alt) 合成、テンキー・矢印キー変換を `WebUICore` 内部の `KeyMapper` で吸収する。
- **改修仕様**:
  - `core.sendKeyEvent(e: KeyboardEvent)` メソッドを公開。
  - `ctrlKey` / `altKey` 判定時のビット演算 (`key.charCodeAt(0) & 0x1F`) や C コア用 ASCII コード合成を内部処理。
  - 汎用アクション送信 API (`core.sendAction('MOVE_UP')`, `core.sendAction('CONFIRM')`) を用意。
- **効果**: UI 側でのキーコード合成処理・二重送信防止ガード・e.preventDefault() の重複記述が不要となった。

---

### 【タスク 3】ストレージ全削除 Safe API の透過公開 (`deleteSaveFile`) `[✅ 実装完了]`
- **概要**: 現在 `core.driver.deleteSaveFile()` と階層を深く呼ぶ必要があるセーブデータ完全削除処理を `WebUICore` に直接透過定義する。
- **改修仕様**:
  - `WebUICore` に `async deleteSaveFile(): Promise<void>` メソッドを追加（内部で `this.driver.deleteSaveFile()` を実行）。
- **効果**: クライアント側での事故を防止。

---

### 【タスク 4】Worker / Wasm クリーン再起動 API (`core.restart()`) の統合 `[✅ 実装完了]`
- **概要**: WASM メモリの再利用時に発生するエラーを防止するため、`WebUICore` 内で Worker の安全な破棄と再生成を自動カプセル化する。
- **改修仕様**:
  - `core.restart({ clearStorage: true })` 実行時に、内部で Worker Bridge の解体・新規生成・イベントリスナー再初期化を透過的に実行。
  - 全状態（マップ・ログ・プロンプト）の初期化イベント (`map_cleared`) を自動発行。
- **効果**: フロントエンド側で Worker インスタンスの直接 destroy / 再生成ロジックを書く必要がなくなった。

---

### 【タスク 5】スコアボード・ゲームオーバーデータの統一規格化 (`GameOverResolver`) `[✅ 実装完了]`
- **概要**: `GameOverResolver` が返却するオブジェクトのプロパティ名（`scoreboard` / `records` / `topScores`）を統一定義する。
- **改修仕様**:
  - `scoreboard: Array<{ rank: number; score: number; name: string; title: string; death: string }>` に一本化。
  - 型定義ファイル (`types/nethack-core.d.ts`) の提供。

---

### 【タスク 6】GUI メニュー用データ抽象化の強化 (`MENU` コンテキスト) `[✅ 実装完了]`
- **概要**: メニュー項目に含まれるアクセラレータキー (ASCII 数値 vs 文字) やタイルスプライト情報を標準化する。
- **改修仕様**:
  - メニュー項目の `accelerator` / `charStr` を統一して1文字 (`charStr: "a"`) で提供。

---

### 【タスク 7】トラベルキー (`_` / Shift+Minus) 等の記号キーマッピング完全対応 `[✅ 実装完了]`
- **概要**: NetHack のマップ自動移動コマンドであるトラベルキー (`_` アンダースコア) や Shift + 記号キー入力時、`WebUICore` の `sendKeyEvent` / `KeyMapper` で `event.key` の文字 (`'_'`) がそのまま ASCII コード (95) として正しく C コアに変換・送信されるよう修正。
- **効果**: キーボードからの `_` キー入力によるトラベルコマンド移動が正確に作動するようになった。

---

### 【タスク 8】`restart()` 実行時の Worker / WASM 完全再構築と `map_cleared` 自動発行 `[✅ 実装完了]`
- **概要**: ゲームオーバー後や「🔄 Restart Game」実行時、`core.restart({ clearStorage: true })` 内で Worker スレッドの完全再インスタンス化、VFS セーブ削除、ストレージ全クリア、および `map_cleared` イベントの自律的自動発行を実装。
- **効果**: クライアント側で `location.reload()` や `localStorage.clear()` に頼らず、一発で瞬時にクリーンな新ゲームへ移行できるようになった。

---

### 【タスク 9】`cancelPrompt()` キャンセル専用 API / キー定数の提供 (`#E-002`) `[✅ 実装完了]`
- **改修仕様**: `WebUICore.prototype.cancelPrompt()` または `WebUICore.KEYS.ESC` を提供し、UI 側での ASCII マジックナンバー `27` 直送信を全廃。

---

### 【タスク 10】`textWindowModal` タイトル自動整形 ＆ 保証 (`#E-003`) `[✅ 実装完了]`
- **改修仕様**: `WebUICore` 側で "Press Space" 等の不必要な文字を判定・クレンジングし、整形済み `title` プロパティをイベント時に提供。

---

### 【タスク 11】`GameOverResolver` プロパティ名 `deathMessage` 一体統一 (`#E-004`) `[✅ 実装完了]`
- **改修仕様**: 死因文字列プロパティを `deathMessage` (翻訳済) に完全一元化し、UI 側の多重フォールバック参照を排斥。

---

### 【タスク 12】`guiData.options` アクセラレータ一文字 `charStr` 100% 保証 (`#E-005`) `[✅ 実装完了]`
- **改修仕様**: メニュー用 `options` 配列の全項目で表示用一文字 `charStr` (`'a'`, `'b'` 等) を保証し、UI 側での文字コード変換 (`String.fromCharCode`) を不要化。

---

## 3. 次回作業での実行ステップ

全タスクの実装および検証が正常に完了し、各サンプルクライアント (`vue-client`, `react-client`, `svelte-client`, `solid-client`) へ適用済みです。
