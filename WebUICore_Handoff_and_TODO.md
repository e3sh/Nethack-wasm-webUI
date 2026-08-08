# WebUIcore / Driver 次期リファクタリング作業指示書 ＆ ロードマップ (WebUICore_Handoff_and_TODO.md)

本ドキュメントは、サンプルクライアント群（Vue 3, React 18, Svelte, SolidJS）の実装・動作検証および各 `PATCH_LOG.md` の記録に基づき、次回の `src/core/` および `src/driver/` （コア凍結解除時）の改修に向けた**改善項目リスト・アーキテクチャ設計・作業指示書**です。

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

## 2. WebUIcore / Driver 改善タスク一覧 (TODO List)

### 【タスク 1】プロンプト・選択肢データの構造化 GUI データ変換 (`inputRequired` 規格化)
- **概要**: テキストベースのプロンプト（`category: "yn"`, `choices: "rl"`）を、UI コンポーネントがそのままバインド可能な構造化データへ自動パース変換する。
- **改修仕様**:
  - `inputRequired` イベントの payload に構造化オブジェクトを含める。
    ```typescript
    interface GUIInputRequiredPayload {
      inputType: 'CHOICE_BUTTONS' | 'LINE_TEXT' | 'MENU' | 'DIRECTION' | 'CONFIRM';
      promptText: string; // "Put on which ring?"
      choicesHint?: string; // "r or l"
      options?: Array<{ key: string; label: string; btnClass?: string }>;
      // 例: [{ key: 'r', label: 'Right ring (r)' }, { key: 'l', label: 'Left ring (l)' }]
    }
    ```
- **効果**: 指輪装着 (`r`/`l`) や Yes/No (`y`/`n`/`q`) 等の画面で、UI側が選択肢パース処理を書く必要がなくなり、コード量が半減する。スマホのタップ用ボタンも自動生成可能になる。

---

### 【タスク 2】キーコード合成・修飾キー変換レイヤーの `WebUICore` 統合 (`sendKeyEvent`)
- **概要**: ブラウザの生 `KeyboardEvent` や修飾キー (Ctrl/Alt) 合成、テンキー・矢印キー変換を `WebUICore` 内部の `KeyMapper` で吸収する。
- **改修仕様**:
  - `core.sendKeyEvent(e: KeyboardEvent)` メソッドを公開。
  - `ctrlKey` / `altKey` 判定時のビット演算 (`key.charCodeAt(0) & 0x1F`) や C コア用 ASCII コード合成を内部処理。
  - 汎用アクション送信 API (`core.sendAction('MOVE_UP')`, `core.sendAction('CONFIRM')`) を用意し、ゲームパッド D-Pad や仮想キーからも統一入力可能にする。
- **効果**: UI 側でのキーコード合成処理・二重送信防止ガード・e.preventDefault() の重複記述が不要になる。

---

### 【タスク 3】ストレージ全削除 Safe API の透過公開 (`deleteSaveFile`)
- **概要**: 現在 `core.driver.deleteSaveFile()` と階層を深く呼ぶ必要があるセーブデータ完全削除処理を `WebUICore` に直接透過定義する。
- **改修仕様**:
  - `WebUICore` に `async deleteSaveFile(): Promise<void>` メソッドを追加（内部で `this.driver.deleteSaveFile()` を実行）。
  - `clearAllStorage()` 等の旧呼び出しに対するエイリアス互換を保持。
- **効果**: クライアント側での `TypeError: this.core.clearAllStorage is not a function` 等の事故を防止。

---

### 【タスク 4】Worker / Wasm クリーン再起動 API (`core.restart()`) の統合
- **概要**: WASM メモリの再利用時に発生する `RuntimeError: memory access out of bounds` を防止するため、`WebUICore` 内で Worker の安全な破棄と再生成を自動カプセル化する。
- **改修仕様**:
  - `core.restart()` 実行時に、内部で Worker Bridge の解体・新規生成・イベントリスナー再初期化を透過的に実行。
  - 全状態（マップ・ログ・プロンプト）の初期化イベントを発行。
- **効果**: フロントエンド側で Worker インスタンスの直接 destroy / 再生成ロジックを書く必要がなくなる。

---

### 【タスク 5】スコアボード・ゲームオーバーデータの統一規格化 (`GameOverResolver`)
- **概要**: `GameOverResolver` が返却するオブジェクトのプロパティ名（`scoreboard` / `records` / `topScores`）を統一定義する。
- **改修仕様**:
  - `scoreboard: Array<{ rank: number; score: number; name: string; title: string; death: string }>` に一本化。
  - 型定義ファイル (`types/nethack-core.d.ts`) の提供。

---

### 【タスク 6】GUI メニュー用データ抽象化の強化 (`MENU` コンテキスト)
- **概要**: メニュー項目に含まれるアクセラレータキー (ASCII 数値 vs 文字) やタイルスプライト情報を標準化する。
- **改修仕様**:
  - メニュー項目の `accelerator` を統一して1文字 (`char: "a"`) で提供。
  - 上下キーフォーカス移動用の標準インデックス状態を `WebUICore` 側でも認識可能にする。

---

## 3. 改修後のコンポーネントコード比較 (Before / After)

### 【Before】現在のクライアント側記述（パース・判定が混在）
```typescript
// クライアント側でテキスト判定や選択肢パースを行う必要があった
const isYNPrompt = prompt.includes('?') && !isTextPrompt;
const choiceButtons = rawChoices.split('').map(c => ({
  char: c,
  label: c === 'r' ? 'Right (r)' : 'Left (l)'
}));
function handleKeyDown(e) {
  if (e.ctrlKey) respondDirect(e.key.charCodeAt(0) & 0x1f);
}
```

### 【After】改修後の理想のコンポーネント記述（数行に短縮）
```html
<!-- 届いた構造化データをそのままテンプレートにバインドするだけ -->
<div v-if="promptData.inputType === 'CHOICE_BUTTONS'" class="prompt-actions">
  <button v-for="btn in promptData.options" :key="btn.key" @click="core.respond(btn.key)">
    {{ btn.label }}
  </button>
</div>
```

---

## 4. 次回作業での実行ステップ (Action Plan for Next Step)

1. **`src/core/WebUICore.js` の機能拡張**:
   - タスク 1 (`inputRequired` 構造化パース) および タスク 3 (`deleteSaveFile` 直呼び出し) の実装。
2. **`src/core/input/KeyMapper.js` の新規作成**:
   - タスク 2 (生の `KeyboardEvent` を受け取って C コア互換コードに合成変換する層) の導入。
3. **`src/driver/NetHackWasmDriver.js` の Safe Restart 実装**:
   - タスク 4 (クリーンな Wasm 再生成付き `restart()` メソッド) のサポート。
4. **サンプルクライアントのコード削減**:
   - Vue / React / Svelte / SolidJS の `InputPrompt` や `useNetHackDriver` から暫定パッチコードを取り除き、新規格 API に合わせて数行へスリム化。

---
*作成日: 2026-08-07*  
*関連ドキュメント: `docs/Modern_Web_Components_Update_Rules.md`, 各サンプル `PATCH_LOG.md`*
