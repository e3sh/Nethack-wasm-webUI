# WebUIcore / Driver 次期リファクタリング作業指示書 ＆ ロードマップ (WebUICore_Handoff_and_TODO.md)

本ドキュメントは、サンプルクライアント群（Vue 3, React 18, Svelte, SolidJS）の実装・動作検証および各 `PATCH_LOG.md` (`examples/PATCH_LOG.md` の #E-001～#E-005 および Update Ideas) の記録に基づき、次回の `src/core/` および `src/driver/` （コア更新サイクル）に向けた**改善項目リスト・アーキテクチャ設計・作業指示書**です。

---

## 1. 基本設計思想 (Architectural Principle)

**「関心事の分離 (Separation of Concerns)」の徹底**

- **`WebUICore` (ドメイン / コア制御層)**:
  - C言語 (NetHack WASM) の複雑なテキストプロンプト・キーコード合成・メモリ状態を**「完全構造化された GUI 用コントロールデータ」**にパース・変換して提供する。
  - フロントエンド側で書く必要のないパース処理・入力変換処理・判定ロジックを積極的にコア側で吸収する。
- **`UI / クライアントコンポーネント` (プレゼンテーション / 演出層)**:
  - `WebUICore` から受け取った構造化データを、デザイン・アニメーション・ダイアログ演出・各フレームワーク（Vue/React/Svelte/SolidJS）のスタイルで画面表示することだけに専念する。
  - マジックナンバーや文字列パターン判定を全廃し、直感的かつシンプルなコードにする。

---

## 2. WebUIcore / Driver 改善・吸収タスク一覧 (TODO List)

### 【タスク 1】プロンプト・選択肢データの構造化 GUI データ変換 (`inputRequired` 規格化 & モーダルタイトル自動生成)
- **関連パッチ**: `#E-003`, `#E-005`
- **概要**: テキストベースのプロンプト（`category: "yn"`, `choices: "rl"`）を構造化データへ自動パースし、長文ヘッダーからクレンジング済みの `title` プロパティや `charStr` 一文字キーを自動付与する。
- **改修仕様**:
  - `inputRequired` / `textWindowModal` / `FILE` イベント payload に以下を含める：
    ```typescript
    interface GUIInputRequiredPayload {
      inputType: 'CHOICE_BUTTONS' | 'LINE_TEXT' | 'MENU' | 'DIRECTION' | 'CONFIRM';
      title: string;       // 整形・ノイズ除去・翻訳済みのタイトル (例: "Inventory", "Dungeon History")
      promptText: string;  // メッセージ本文
      choicesHint?: string;// "r or l" 等
      options?: Array<{ key: string; charStr: string; label: string; btnClass?: string }>;
    }
    ```
- **効果**: UI側での `rawPrompt.length < 40 && !rawPrompt.includes('Press Space')` などの文言判定や手動 `charStr` 相互変換処理が完全不要になる。

---

### 【タスク 2】キーコード合成・修飾キー変換・プロンプトキャンセル専用 API (`cancelPrompt` & `KEYS`)
- **関連パッチ**: `#E-002`, `Update Ideas #001`
- **概要**: キーボードイベントの自動変換に加え、プロンプトの ESC キャンセル API (`cancelPrompt()`) と統一キー定数 (`WebUICore.KEYS`) を追加。
- **改修仕様**:
  - `WebUICore.KEYS = { ESC: 27, ENTER: 13, SPACE: 32, ... }` 定数を公開。
  - `core.cancelPrompt()` メソッドで、アクティブなプロンプトを安全に ESC (27) 解除。
  - `core.sendAction('MOVE_UP')`, `core.sendAction('CONFIRM')` などの D-Pad 仮想操作 API を拡充。
- **効果**: UI 側での `respondPrompt(27)` 等のマジックナンバー直書きが撲滅される。

---

### 【タスク 3】ストレージ全削除 Safe API の透過公開 (`deleteSaveFile`)
- **関連パッチ**: `タスク 3`
- **概要**: セーブデータ完全削除処理を `WebUICore` に直接透過定義する。
- **改修仕様**:
  - `WebUICore` に `async deleteSaveFile(): Promise<void>` メソッドを追加（内部で `this.driver.deleteSaveFile()` を実行）。
- **効果**: クライアント側での `TypeError: clearAllStorage is not a function` 事故を防止。

---

### 【タスク 4】Worker / Wasm クリーン再起動 API (`core.restart({ clearStorage: true })`)
- **関連パッチ**: `#E-001`, `#008`, `#009`
- **概要**: リスタート時のマップ暗転・停滞を防止するため、`WebUICore` 内で VFSセーブ消去・全ストレージ破棄・Worker 再起動・`map_cleared` 発行を一括処理する。
- **改修仕様**:
  - `core.restart({ clearStorage: true })` 実行時に、キャンバスクリア、全データ初期化、Worker のクリーン再生成を自動カプセル化。
- **効果**: UI側で `localStorage.clear()` や `location.reload()` を手動呼出しする必要がなくなる。

---

### 【タスク 5】スコアボード・ゲームオーバーデータの統一規格化 (`GameOverResolver`)
- **関連パッチ**: `#E-004`
- **概要**: `GameOverResolver` の返却オブジェクトにおける死因プロパティ名を `deathMessage` (翻訳済) に完全統一保証する。
- **改修仕様**:
  - `deathMessage` を常に含め、フォールバック（`deathMessage || translatedDeathMessage || death`）の多重参照を不要にする。

---

### 【タスク 6】サウンド / SE 音効用イベントフック機能 (`soundEffect`)
- **関連パッチ**: `Update Ideas #002`
- **概要**: `SoundEngine` の SE 再生タイミングと連動し、Web コンポーネント側で視覚効果（画面フラッシュ・シェイク等）を発火できるリスナーを提供。
- **改修仕様**:
  - `core.on('soundEffect', ({ sound, category }) => ...)` リスナーの提供。

---

## 3. 改修後のコンポーネントコード比較 (Before / After)

### 【Before】現在のクライアント側記述（パース・判定・マジックナンバーが混在）
```typescript
// ESC送信でマジックナンバー 27 を直書き
function cancel() {
  core.respondPrompt(27);
}
// タイトル判定をUI側で行う必要があった
const title = rawPrompt.length < 40 && !rawPrompt.includes('Press Space') ? rawPrompt : 'Dialog';
// リスタートでリロードが必要だった
function restart() {
  localStorage.clear();
  location.reload();
}
```

### 【After】改修後の理想のコンポーネント記述（数行・完全抽象化）
```typescript
// コアが提供する抽象 API を直接呼び出すだけ
function cancel() {
  core.cancelPrompt();
}
// コアが生成した title を直接バインド
const title = payload.title;
// コアが一括クリーンリスタートを保証
await core.restart({ clearStorage: true });
```

---

## 4. 次回作業での実行ステップ (Action Plan for Next Step)

1. **`src/core/WebUICore.js` の機能拡張**:
   - `cancelPrompt()`, `WebUICore.KEYS`, `restart({ clearStorage: true })` の実装強化。
   - `_buildGUIInputPayload` での `title` クレンジング・`charStr` 保証。
2. **`src/core/lifecycle/GameOverResolver.js` の改修**:
   - `deathMessage` プロパティの一律保証。
3. **サンプルクライアント (`examples/*`) の暫定パッチ除去**:
   - Vue / React / Svelte / SolidJS の `InputPrompt` や `useNetHackDriver` から暫定パッチコードを取り除き、新規格 API に合わせて数行へスリム化。

---
*更新日: 2026-08-08*  
*関連ドキュメント: `examples/PATCH_LOG.md`, 各サンプル `examples/*/PATCH_LOG.md`*
