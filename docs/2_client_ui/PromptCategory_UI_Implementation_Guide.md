---
title: PromptCategory_UI_Implementation_Guide
status: draft
last_updated: 2026-09-08
related_code:
  - src/core/WebUICore.js
  - src/core/types.js
  - src/core/prompt/PromptPayloadBuilder.js
  - examples/gkl-pure-js-client/modules/components/ModalManager.js
  - examples/gkl-pure-js-client/main.js
---

# promptCategory 仕様・UI 実装ガイド & 改善予定案

本ドキュメントは、WebUICore が発行する `inputRequired` イベントの `promptCategory` 構造化タグの仕様、GKL Pure JS Client における UI 実装の分岐ロジック、および現在判明している未対応シーン（`KEY` カテゴリで画面演出がないケース）の原因調査と改善案をまとめた参照資料です。

---

## 1. `promptCategory` とは

`promptCategory` は NetHack Wasm WebUICore が `inputRequired` イベントに付与する**構造化タグ**。
C コア（Wasm）から発生する入力待ちの種類を UI 側が扱いやすい統一型に分類したもの。

**定義ファイル**: `src/core/types.js`

```js
export const PROMPT_CATEGORY = {
  NONE:      'NONE',      // 入力待ちなし（初期値）
  POSKEY:    'POSKEY',    // 通常ターン入力
  YN:        'YN',        // Y/N 確認プロンプト
  MENU:      'MENU',      // アイテムメニュー選択
  TEXT:      'TEXT',      // フリーテキスト入力
  ASKNAME:   'ASKNAME',   // プレイヤー名入力
  EXTCMD:    'EXTCMD',    // 拡張コマンド(#cmd)入力
  FILE:      'FILE',      // ファイル表示後の確認
  KEY:       'KEY',       // テキストウィンドウ後の確認
  DIRECTION: 'DIRECTION', // 方向入力
  OTHER:     'OTHER',     // 未分類
};
```

`promptCategory` は Driver 層で C コアコンテキスト（`poskey`, `yn_function`, `select_menu`, `getlin` 等）から自動判定されて付与される。UI 側はこのタグを見るだけで表示分岐が行えるよう設計されている。

---

## 2. カテゴリ一覧・発生元・期待応答

| カテゴリ | `inputType` | C コア発生元 | 期待する応答型 |
|---|---|---|---|
| `POSKEY` | `TURN_INPUT` | `poskey` | `number`（キーコード）|
| `YN` | `CHOICE_BUTTONS` or `SINGLE_KEY` | `yn_function` | `number` / `string`（1文字）|
| `MENU` | `MENU` | `select_menu` | `Array<{identifier,count}>` / `number` / `0`（ESC）|
| `TEXT` | `LINE_TEXT` | `getlin` | `string`（テキスト全体）|
| `ASKNAME` | `LINE_TEXT` | `askname` | `string`（プレイヤー名）|
| `EXTCMD` | `LINE_TEXT` | `get_ext_cmd` | `string`（コマンド名）|
| `FILE` | `CONFIRM` | `display_file` | `number`（スペース = 32）|
| `KEY` | `CONFIRM` | `display_nhwindow`（blocking）| `number`（スペース / Enter）|
| `DIRECTION` | `DIRECTION` | POSKEY + 方向検出 | `'DIR_N'` 等の抽象トークン |
| `OTHER` / `NONE` | `CONFIRM` | 未分類 | `number` / `string` |

### 2-1. WebUICore 内の応答変換フロー（`respond()` メソッド）

UI 側は `core.respond(inputVal)` を呼ぶ。WebUICore が `currentPromptCategory` に応じて値を変換してから `resolver.respond()` で C コアへ送る。

```
UI が core.respond(inputVal) を呼ぶ
        |
        |-- inputVal が 'DIR_*' --> vi / numpad キーコードへ変換（keyMode に応じて自動切替）
        |-- MENU       --> identifier 配列 / アクセラレータコード / 0（キャンセル）
        |-- YN         --> charCodeAt(0) に正規化
        |-- TEXT / ASKNAME / FILE / EXTCMD --> string のまま通過（ESC は '\x1b'）
        |-- DIRECTION / POSKEY / KEY --> charCodeAt(0) に正規化
        |
        +-- resolver.respond(finalResponse) --> Wasm C コアへ送信
```

### 2-2. `PromptPayloadBuilder` による `subCategory` と `assistant` の自動付与

`TEXT` 系カテゴリでは、プロンプト文のパターンマッチにより専用フィールドが追加される。

| `subCategory` | 検出パターン（例）| `assistant.type` |
|---|---|---|
| `WISH` | "for what do you wish" | `'WISH'` + presets, wishService |
| `GENOCIDE` | "what type of monsters to genocide" | `'GENOCIDE'` + mode(CLASS/SINGLE/ALL) |
| `POLYMORPH` | "become what kind of monster" | `'POLYMORPH'` + presets |

UI 側は `data.assistant?.type` を確認するだけで専用モーダルを出すかどうか判断できる。

---

## 3. GKL Pure JS Client の UI 実装（`ModalManager.handleInputRequired`）

**ファイル**: `examples/gkl-pure-js-client/modules/components/ModalManager.js`

`inputRequired` イベントを受け取り、以下の優先順で分岐して UI を構築する。

```
inputRequired イベント受信 (data)
|
|--① data.subCategory === 'WISH'
|     -> Wish ビルダーモーダル (#wish-modal)
|        専用の大型モーダルに wishService のアイテム検索・プリセット・オプション設定を表示
|
|--② data.subCategory === 'GENOCIDE'
|     -> Genocide アシスタントモーダル
|        CLASS / SINGLE / ALL の3モードに対応した専用モーダル
|
|--③ data.subCategory === 'POLYMORPH'
|     -> Polymorph アシスタントモーダル
|
|--④ data.lines.length > 0
|     -> テキストウィンドウ（FILE / KEY の lines あり）
|        #menu-modal を流用。lines を div で1行ずつ表示。
|        Cancel ボタンの textContent を「閉じる / 次へ (Space)」に変更。
|        -> core.sendKey('Space') で閉じる
|
|--⑤ category === 'MENU'
|     -> アイテムメニューモーダル
|        #menu-modal に button を動的生成。charStr バッジ + グリフアイコン付。
|        上下キーで activeMenuFocusIndex を更新して疑似フォーカス移動。
|        -> core.respond(item) / キャンセルは core.respond(0)
|
|--⑥ inputType === 'LINE_TEXT'（TEXT / ASKNAME / EXTCMD）
|     -> テキスト入力フォーム
|        #prompt-bar 内に <input type="text"> + OK ボタンを動的生成。
|        Enter で送信、Esc で '\x1b' 送信。setTimeout で自動フォーカス。
|
|--⑦ inputType === 'DIRECTION'
|     -> 方向入力パッド
|        3x3 グリッドボタン + 上下方向 + キャンセルを生成。
|        -> core.respond('DIR_N') 等の抽象トークンを送信
|           ※ WebUICore 側で vi / numpad キーコードへ自動変換される
|
|--⑧ data.options.length > 0（YN系 CHOICE_BUTTONS）
|     -> 選択肢ボタン
|        PromptPayloadBuilder が整形した options を横並びボタンで表示。
|        -> core.respond(opt.key)（'y' / 'n' / 'q' 等の1文字 string）
|
|--⑨ inputType === 'SINGLE_KEY'
|     -> 1キー待機インジケーター
|        「入力待機中 / Press key」テキスト + ESC キャンセルボタンのみ表示。
|
+--⑩（全分岐を通過）
      -> elPromptBar.classList.add('hidden')
         プロンプトバーを非表示にして何もしない。
         ★ POSKEY（通常ターン）はここに落ちる（意図的）。
         ★ KEY（lines が空）もここに落ちる（未対応バグ）。
```

---

## 4. 未対応問題: `KEY` カテゴリで UI 演出がないシーン

### 4-1. 発生条件

`display_nhwindow`（blocking: true）イベントが発火した際、対応するウィンドウバッファが**空**だった場合。

```
data.lines    = []        <- バッファが空なので④を通過できない
data.category = 'KEY'
data.options  = undefined <- display_nhwindow ハンドラーは PromptPayloadBuilder を経由しないため
                             options フィールド自体が存在しない
```

### 4-2. コードレベルの根本原因

WebUICore 内に `inputRequired` イベントを発行するハンドラーは2種類存在する。

**① `driver.on('inputRequired')` ハンドラー（汎用）**
`PromptPayloadBuilder.build()` を呼び出し、`options` / `inputType` 等を完全整形してから `core.emit('inputRequired', ...)` する。

**② `driver.on('display_nhwindow')` ハンドラー（専用）**
`PromptPayloadBuilder` を**経由せず**、独自に payload を組み立てて `core.emit('inputRequired', ...)` する。
この payload には `options` フィールドが存在しない。

```js
// WebUICore.js（display_nhwindow 専用ハンドラー）
const payload = {
    category: PROMPT_CATEGORY.KEY,
    promptCategory: PROMPT_CATEGORY.KEY,
    choices: ' ',
    prompt: translatedPrompt,
    lines: bufferLines,    // <- 空配列の可能性あり
    windowId: windowId,
    // <- options フィールドが存在しない！
};
this.emit('textWindowModal', { lines: bufferLines, resolver, payload });
this.emit('inputRequired', payload);
```

### 4-3. `textWindowModal` イベントが未購読

WebUICore は `inputRequired` と同時に `textWindowModal` も発火する。
しかし `gkl-pure-js-client` の `main.js` は **`textWindowModal` を `core.on()` でリッスンしていない**。

```js
// main.js の bindCoreEvents()（抜粋）
core.on('stateChange', ...)
core.on('message', ...)
core.on('statusUpdate', ...)
core.on('cursor', ...)
core.on('print_glyph', ...)
core.on('clear_nhwindow', ...)
core.on('inputRequired', ...)  <- ここだけで全プロンプトを処理しようとしている
core.on('inputResolved', ...)
// ★ core.on('textWindowModal', ...) が存在しない
```

### 4-4. 結果として起きること

```
display_nhwindow (blocking) 発火
   |
WebUICore: bufferLines が空 -> options なしの payload を組み立て
   |
emit('textWindowModal', { lines: [], ... })  <- 誰もリッスンしていない（無視）
emit('inputRequired',   { category:'KEY', lines: [], options: undefined })
   |
main.js -> modalManager.handleInputRequired(data)
   |
④ data.lines.length > 0    -> No（空なのでスキップ）
⑧ data.options.length > 0  -> No（undefined なのでスキップ）
⑩ フォールスルー -> elPromptBar.classList.add('hidden')
   |
★ UIには何も表示されない。ゲームは Space / Enter 待ちのまま無応答に見える。
```

---

## 5. 改善案: `KEY` 入力待ちへのアニメーションアイコン追加

メッセージやテキストの表示は不要。「何かキーを押してください」という意図が伝わる小さなアニメーションアイコンを表示するだけで十分。

### 5-1. 推奨: 案A — `handleInputRequired` に `KEY` 分岐を追加

変更箇所が最小かつ既存の `inputRequired` フローに乗るため最もシンプル。

**変更対象**: `examples/gkl-pure-js-client/modules/components/ModalManager.js`

`handleInputRequired` メソッドの⑨ `SINGLE_KEY` 分岐（L351 付近）の**直前**に挿入する:

```js
// KEY カテゴリ: 「何か押せ」バウンスアニメーションアイコン
if (category === 'KEY') {
  if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
  if (this.elPromptText) this.elPromptText.textContent = '';  // テキストなし
  if (this.elInputControls) {
    this.elInputControls.innerHTML = `
      <span class="press-any-key-hint">
        <span class="press-any-key-icon">▼</span>
      </span>
    `;
  }
  return;
}
```

### 5-2. CSS アニメーション追加

**変更対象**: `examples/gkl-pure-js-client/css/modals.css`（末尾に追加）

```css
/* KEY カテゴリ: 「何か押せ」待機アニメーション */
.press-any-key-hint {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  opacity: 0.8;
}

.press-any-key-icon {
  font-size: 16px;
  color: var(--accent-gold, #f0c040);
  animation: press-key-bounce 1.2s ease-in-out infinite;
  display: inline-block;
}

@keyframes press-key-bounce {
  0%,  100% { transform: translateY(0);   opacity: 0.35; }
  50%        { transform: translateY(5px); opacity: 1.0;  }
}
```

### 5-3. 参考: 案B — `textWindowModal` イベントを別途購読

より正確な制御が必要な場合の代替案。`lines` が空の `display_nhwindow` のみを対象にできる。

**変更対象 ①**: `examples/gkl-pure-js-client/main.js` の `bindCoreEvents()` 内に追加

```js
// KEY カテゴリ: バッファ空の display_nhwindow 専用ハンドリング
this.core.on('textWindowModal', ({ lines, resolver, payload }) => {
  if (lines && lines.length > 0) {
    // lines がある場合は inputRequired の④分岐で処理されるため、ここでは何もしない
    return;
  }
  // lines が空のとき（バッファ空の display_nhwindow blocking）だけアイコン表示
  this.modalManager.showPressAnyKeyHint();
});
```

**変更対象 ②**: `ModalManager.js` に専用メソッドを追加

```js
showPressAnyKeyHint() {
  if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
  if (this.elPromptText) this.elPromptText.textContent = '';
  if (this.elInputControls) {
    this.elInputControls.innerHTML = `
      <span class="press-any-key-hint">
        <span class="press-any-key-icon">▼</span>
      </span>
    `;
  }
}
```

### 5-4. 案の比較

| | 案A（`handleInputRequired` 分岐追加）| 案B（`textWindowModal` 購読）|
|---|---|---|
| **変更箇所** | `ModalManager.js` + `modals.css` | `main.js` + `ModalManager.js` + `modals.css` |
| **カバー範囲** | `category === 'KEY'` 全般 | `lines` が空の `display_nhwindow` のみ |
| **確実性** | 既存フローに乗るため確実 | イベント二重処理に注意が必要 |
| **推奨** | こちらを推奨 | 参考案 |

> **注意**: `FILE` カテゴリも `inputType: CONFIRM` を持つが、`FILE` は通常 `data.lines.length > 0` が④で先に拾うため案A と競合しない。条件を `category === 'KEY'` だけに絞ることで安全性を確保している。

---

## 6. 変更対象ファイル一覧

| ファイル | 変更内容 | 優先度 |
|---|---|---|
| `examples/gkl-pure-js-client/modules/components/ModalManager.js` | `handleInputRequired` に `KEY` 分岐を追加（L351 付近） | 高 |
| `examples/gkl-pure-js-client/css/modals.css` | `.press-any-key-hint` / `.press-any-key-icon` + `@keyframes` 追加（末尾） | 高 |
| `examples/gkl-pure-js-client/main.js` | （案B のみ）`textWindowModal` イベント購読追加 | 低（案B 選択時）|

---

## 7. 派生課題: セーブデータ再開時の「暗黒・無表示入力待ち」問題と改善案

### 7-1. 現象と根本原因の切り分け

* **現象**:
  起動時に「💾 Save Data Found」のダイアログから「▶ Continue Game」を押して再開させた際、ダイアログが消えた後にマップも復元中スピナーも表示されず、真っ暗なキャンバスのまま入力待ちになる。プレイヤーが移動キー等の何らかのキーを押して初めてマップやステータスがパッと出現する。
* **原因の切り分け**:
  1. `#save` で終了した時の入力待ちは **`promptCategory: 'KEY'`**（空バッファの `display_nhwindow(blocking)` による Space 待ち）が原因。
  2. 一方、セーブデータ再開時の入力待ちは **`promptCategory: 'POSKEY'`**（C コアの復元完了後の通常ターン待ち）であり、`KEY` ではない。
  3. NetHack（curses系）の仕様として、復元直後は初回のキー入力をトリガーにして画面全体の完全フラッシュ（`doupdate` / `refresh`）が行われるため、**最初の1キーが押されるまで `print_glyph` が届かずマップが描画されない**。
  4. 加えて、UI 側（`main.js`）は `core.start()` を呼ぶと `stateChange: READY/RUNNING` でローディング用オーバーレイを即座に消去してしまうため、「復元中...」の表示も消えて真っ暗な画面が剥き出しになる。

---

### 7-2. 改善案: 「タイトル画面（ダイアログ）一体型」シームレス開始演出

セーブ再開ダイアログを UI 側で表示している以上、**「ダイアログが消えて唐突に真っ暗になる」のではなく、ダイアログ自体をゲームのタイトル画面のように位置づけ、再開完了から最初の1歩までを自然な流れとして演出する** のが極めて有効な解決策となります。

#### 案1: タイトルカード一体型ステップ進行（おすすめ）
1. **ステップ 1（選択）**:
   タイトル画面中央にカード表示（「▶ 続きから再開」/「⚠️ 最初から始める」）。
2. **ステップ 2（復元中表示の維持）**:
   「続きから再開」を押しても即座にカードを消去せず、カード内で **「🔄 ダンジョンを復元中...」** に切り替えてスピナーを回す（マップが描かれるまで背景の暗黒を見せない）。
3. **ステップ 3（準備完了・開始案内）**:
   最初の `POSKEY` が届き、初期マップが描画された段階で、カード上の表示を **「✨ 準備完了！ [Space] または [移動キー] でダンジョンへ入る」** に変化させ、「▼」バウンスアイコンを点滅させる。
4. **ステップ 4（シームレス移行）**:
   プレイヤーがキーを押した瞬間にカードがフェードアウトし、すでに展開済みのダンジョン画面へ滑らかに切り替わる。

#### 案2: 再開直後のトースト／開始メッセージ注入
* 再開直後の `ASKNAME` 自動通過 ＆ 復元完了時に、UI 側のメッセージログまたは HUD に **「💾 セーブデータを復元しました。移動キーで行動を開始してください。」** という明示的な開始メッセージ・案内を自動で挿入する。
* キーボードフォーカスを確実にゲームウィンドウへ戻す（`window.focus()`）。

このように、セーブ再開処理の責務を「ただボタンを押してバックエンドを呼ぶだけ」から「ゲーム開始の演出として完結させる」方針へ昇華させることで、初見のプレイヤーがフリーズと誤認する問題を根本的に解消できます。

#### 案3: 常設タイトル画面化（新規ゲーム時も「最初から始める」を表示して統一）
* **新規ゲーム開始時（セーブデータなし時）もタイトルカードを常設**:
  セーブデータが存在しない場合、現在はローディングスピナーから唐突にゲーム本編が始まりますが、セーブ有無に関わらず**常にタイトルカードを表示**する。
  - セーブあり時: `[▶ 続きから再開 (Hero)]` / `[⚠️ 最初から始める]`
  - セーブなし時: `[⚔️ 新しい冒険を始める]`
* **得られるメリット**:
  1. 初回訪問時・新規開始時でも「ゲームのタイトル画面に来た」という明確な認知ができ、ブラウザを開いた瞬間の唐突感がなくなる。
  2. ボタンを押して「ダンジョンを生成中...」➔「準備完了！ [Space] または [移動キー] で開始」という共通の演出ステップを通るため、**新規・再開問わず完全に一貫したゲーム起動フロー**が完成する。
  3. ボタンクリックというユーザーの明示的なジェスチャーから始まるため、ブラウザの音声再生ポリシー（AudioContext のアンブロック）やキーボードフォーカス（`window.focus()`）も確実に自動解決できる。
