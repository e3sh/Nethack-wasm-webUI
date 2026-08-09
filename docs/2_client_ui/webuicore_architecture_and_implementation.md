# WebUICore アーキテクチャ設計・既存Webコンポーネント連携・詳細実装仕様書

## 1. 概要と基本方針

本仕様書は、NetHack Wasm Driver (`NetHackWasmDriver` / `NetHackWasmWorkerBridge`) と既存のWebUI表現層（`mobileCurses.js`, `DisplayManager.js`, `UIManager.js` などのWebコンポーネント・UIモジュール）を架橋する **WebUICore** のシステム設計、および各種入力手続きにおける型の揺れ補正・翻訳連携・型安全ステータスアクセサに関する詳細実装仕様を明確化したドキュメントである。

過度な抽象化や WebUICore 内部でのレンダラーの車輪の再発明（ゼロからのCanvas描画等）を一切排し、**既存の動作実績のあるWebコンポーネントにイベント・データを透明かつ確実にバインドする** 最小限で最も堅牢なコア構造を提供する。

```
+-----------------------------------------------------------------------+
|  既存 WebUI 表現層 (mobileCurses.js / UIManager.js / React, Vue, Svelte, Solid) |
|  ・スプライト/ASCII レンダラー, DOM Curses エミュレーション              |
|  ・ステータスバー, メニューモーダル, タッチ / キーボード / ゲームパッド UI   |
+-----------------------------------------------------------------------+
                                   ▲
                                   │  (イベント: message, statusUpdate, inputRequired, print_glyph, gameOver, textWindowModal)
                                   ▼  (操作: sendKey, respond, getStatus, getHighScores, restart, handleTouchPoint)
+-----------------------------------------------------------------------+
|  WebUICore (Core SDK レイヤー / Facade)                                |
|  ・8段階 Lifecycle Management & リロード不要再起動 (restart)             |
|  ・GameOverResolver (勝敗・死因自律解析 & Top 10 ランキングパース)          |
|  ・TranslationEngine (プロンプト/選択肢動的翻訳, オンデマンドファイル翻訳)   |
|  ・StatusAccessor (統一ステータスモデル提供 & 階層変更検知 map_cleared)   |
|  ・Input Engine (sendKey, respond, GamepadManager, TouchCalculator)   |
|  ・SoundEngine (メッセージキーワード連動 SE 再生)                       |
|  ・Renderer Adapters (NullRenderer, CanvasRenderer, DOMGridRenderer)  |
+-----------------------------------------------------------------------+
                                   ▲
                                   │  (Wasm Driver Protocol)
                                   ▼
+-----------------------------------------------------------------------+
|  NetHackWasmDriver / NetHackWasmWorkerBridge (Wasm/Worker レイヤー)   |
+-----------------------------------------------------------------------+
```

---

## 2. Wasm 起動パラメータ仕様

Wasm エンジン起動時、`WebUICore` は `GameManager.js` と完全互換のある以下の起動オプションを Worker Bridge へ引き渡す。

- **`wasmModule`**: `'nethack.js'` (または `'nethack_jp.js'`)
- **`args`**: `['nethack', '-otime,showexp,showvers,number_pad']`
  - **重要**: `-otime,showexp,showvers,number_pad` を指定することで、Cコアが「テンキー・数字キー操作モード (`number_pad`)」として起動し、移動およびテンキーアサインが正常化する。
- **`extraOptions`**: `localStorage.getItem("nh.config")` 内の `extra_options` を自動読み込み。

---

## 3. Driver ↔ Core イベント構造定義

| Driver 発火イベント | 生 Payload | Core でのバインドと変換 | Core 発火イベント / 連携データ |
| :--- | :--- | :--- | :--- |
| **`putstr`** | `{ windowId, attr, text }` | 翻訳エンジンに通し、ログバッファおよび UI ログ表示へ追加 | **`message`** (`translatedText`) |
| **`raw_print` / `raw_print_bold`** | `{ text }` | 起動ログ・ダイレクト出力を `putstr` (windowId: 1) と同等として透過統合処理 | **`message`** (`translatedText`) |
| **`putmsghistory`** | `{ text, restoring }` | メッセージ履歴出力のうち、表示対象 (restoring=false) のテキストを `message` へ透過統合 | **`message`** (`translatedText`) |
| **`status_update`** | `{ field, value, change, color }` | デコード済みデータを内部 `statusFields[field]` および後述の `StatusAccessor` モデルへ反映 | **`statusUpdate`** (`{ field, value, change, color, allFields, status }`) |
| **`print_glyph`** | `{ windowId, x, y, glyph, bkglyph }` | `(x, y)` 座標と `glyph` ID を既存 Webコンポーネント (mobileCurses 等) へ伝達 | **`print_glyph`** (`data`) |
| **`clear_nhwindow`** | `{ windowId }` | マップ画面 (`windowId === 3`) のクリア命令をバインド先へ送出 | **`clear_nhwindow`** (`data`) |
| **`display_nhwindow`** | `{ windowId, blocking, resolver }` | 後述の **「display_nhwindow 解凍判別ルール」** に従って処理 | **`textWindowModal`**, **`inputRequired`** (KEY) または 自動 `respond(0)` |
| **`inputRequired`** | `{ context, prompt, choices, items, resolver }` | プロンプト/選択肢翻訳 (`prompt`/`rawPrompt`), `isSelectable` / `accelerator` 付与 | **`inputRequired`** (`passThroughPayload`) |
| **`inputResolved`** | なし | Core 内部の `activeResolver` を `null` にクリア | **`inputResolved`** |

---

## 4. 入力コンテキスト別のレスポンス相互変換・補正ルール

Driver (Cコア) が要求する型と、UI/入力機器 (キーボード, タッチ, モーダルダイアログ) から渡される値の不一致を WebUICore 内で相互変換・補正する。

### ① `select_menu` (`MENU` カテゴリ)
- **Cコア要求レスポンス**: `MenuItem[]` (選択アイテムの `identifier` と `count` を持つ構造体配列) または `0` (選択なし/キャンセル)。
- **WebUICore レスポンス補正動作**:
  1. **キーボード / アスキーコード入力時** (例: `'a'` 押下 ➔ アスキーコード `97`):
     - 現在アクティブな `menuItems` から `accelerator` または `ch` が `97` に合致する項目を自動検索し、`[{ identifier: item.identifier, count: -1 }]` 配列へ自動変換して Driver へ返却。
  2. **UIダイアログ / オブジェクト入力時** (例: ダイアログやカーソル決定から `{ identifier: 104528, count: -1 }` が渡された場合):
     - そのまま `[item]` 配列として Driver の `resolver.respond()` に渡す。
  3. **キャンセル時** (例: `ESC` / `0` / 空配列):
     - `0` を返却して C コアのメニュー選択を安全にスキップ。

### ② `yn_function` (`YN` カテゴリ)
- **Cコア要求レスポンス**: 文字コード数値 (`number`, 例: `'y'` ➔ 121, `'n'` ➔ 110, `ESC` ➔ 27) または 1文字 `string`。
- **WebUICore レスポンス補正動作**:
  - `sendKey` または `respond` に文字列 (`"y"`/`"n"`/`" "`) や数値 (`121`), 配列 (`[121]`) が渡された場合、第1文字/要素を安全に取り出して Driver に渡す。
  - Driver 内の安全ガード機能 (Enter/Space 押下時のデフォルト選択肢 `def` 適用、 choices 以外の不適切な文字の排除) を活用し Wasm フリーズを防止。

### ③ `askname` / `getlin` (`TEXT` カテゴリ)
- **Cコア要求レスポンス**: 文字列 (`string`, 例: `"Hero"`) または `null` / 空文字。
- **WebUICore レスポンス補正動作**:
  - 引数が `string` の場合、アスキー数値配列化を行わず、文字列をそのまま Driver に返却。

---

## 5. 翻訳エンジン (`TranslationEngine`) 連携とプロパティ構造仕様

`WebUICore` は内蔵する `TranslationEngine` を介して、生メッセージと日本語翻訳メッセージの両方を同一 Payload 内に保持する。

1. **プロンプトメッセージ**:
   - **`rawPrompt`**: 生の英文プロンプト (例: `"Select an item:"`)
   - **`prompt`**: 翻訳済み日本語プロンプト (例: `"アイテムを選択してください:"`)
2. **メニュー項目 (`items`)**:
   - **`rawStr`**: 生の英文文字列 (例: `"a - a dagger (+0)"`)
   - **`str`**: 翻訳済み日本語文字列 (例: `"a - 匕首 (+0)"`)
   - **`isSelectable`**: アイテムが選択可能な行かどうかを示す Boolean 値。
   - **`charStr`**: 選択キー文字 (例: `"a"`)
3. **未翻訳モード (`translateEnabled: false`) / 日本語コア (`nethack_jp.js`) 時の挙動**:
   - `TranslationEngine.translate(text)` は引数をそのまま返却するため、`prompt === rawPrompt` および `str === rawStr` となり完全な同一性と下位互換性が保証される。

---

## 6. 統一ステータスモデルアクセサ (`StatusAccessor`) 仕様

Cコアから通知される `status_update` のマジックナンバー (`field === 10`, `18`, `22`) やデータ型 (数値/文字列 `"glyph:0x0f2e:100"`/配列/オブジェクト `goldData`) の複雑さをカプセル化し、UI層に型安全な構造体プロパティ (`gold.amount`, `hp.current` 等) を提供する。

### 1. `core.getStatus()` 戻り値オブジェクト仕様

`WebUICore` 内部で `statusFields` を元に常時同期・更新される統合モデル。

```javascript
{
    hp: { current: 15, max: 15, percent: 1.0 },
    gold: { amount: 150, glyphId: 3886 },
    dlevel: { branch: "Dlvl", level: 1, text: "Dlvl:1" },
    conditions: ["Blind"], // 常に string[] を保証 (未発生時は空配列 [])
    hunger: "Hungry",      // 常に string を保証 (なしは空文字 "")
    stats: { str: "18/10", dex: 16, con: 14, int: 10, wis: 12, cha: 9 },
    score: 0,
    ac: 10
}
```

### 2. UI層での利用方法
UI側はマジックナンバーや型チェックを行う必要がなく、直感的なプロパティ参照でステータスバーやDOM要素を更新できる。

```javascript
// statusUpdate イベントハンドラ内
core.on('statusUpdate', ({ status }) => {
    // HP更新
    updateHpBar(status.hp.current, status.hp.max);
    
    // ゴールド & アイコン更新
    updateGold(status.gold.amount, status.gold.glyphId);
    
    // デバフバッジ一覧更新 (常に配列のため safe)
    renderConditionBadges(status.conditions);
});
```

---

## 7. `display_nhwindow` ブロッキング解凍判別ルール

NetHack Cコアにおける `display_nhwindow` は、画面表示の更新とユーザーキー入力待ちの2つの役割を持つ。

1. **非ブロッキング描画更新 (`windowId <= 3` かつ `blocking === false`)**:
   - マップやログの描画更新完了シグナル。
   - **動作**: `resolver` が存在する場合、即座に **`resolver.respond(0)` を自動実行** し、Wasm スレッドを止めることなく全速力で進行させる。
2. **ブロッキング画面表示 (`windowId >= 4` または `blocking === true`)**:
   - オープニング口上、全画面ヘルプ、テキスト閲覧など、ユーザーがキー（Space / Enter）を押して画面を閉じるまで Cコアが待機する状態。
   - **動作**: `activeResolver` に `resolver` をセットし、`textWindowModal` または `inputRequired` (category: `KEY`, choices: `' '`) を発火。ユーザーの Space/Enter/ESC 押下で `resolver.respond(0)` を返して解凍する。

---

## 8. キーコード変換仕様 (`sendKey`)

`KeyboardEvent.code` (例: `ArrowUp`, `KeyS`, `Numpad8`) を `rogueDefines.js` の `KEYMAP` テーブルに従って正確なアスキーコードへ変換する。

- **`rogueDefines.js` `KEYMAP` テーブルの参照**:
  - `KeyS` + `Shift` ➔ `83` (`'S'`)
  - `KeyS` ➔ `115` (`'s'`)
- **`number_pad` モード適合マップ**:
  - `ArrowUp` / `Numpad8` ➔ `56` (`'8'`)
  - `ArrowDown` / `Numpad2` ➔ `50` (`'2'`)
  - `ArrowLeft` / `Numpad4` ➔ `54` (`'4'`)
  - `ArrowRight` / `Numpad6` ➔ `54` (`'6'`)
  - `Space` ➔ `32` (`' '`)
  - `Enter` ➔ `13` (`'\r'`)
  - `Escape` ➔ `27` (`'\x1b'`)

---

## 9. 手作業検証・実装手順 (Phase)

- **Phase 1: 仕様資料の確定** (`docs/webuicore_architecture_and_implementation.md` の合意)
- **Phase 2: WebUICore 実装・リファクタリング** (レスポンス型補正, `StatusAccessor`, 翻訳連携強化)
- **Phase 3: 既存Webコンポーネント (mobileCurses/DisplayManager) へのバインド検証**
- **Phase 4: キー操作・ステータス動的更新・メニュー選択の手動検証**
- **Phase 5: PoC統合テスト環境 (`webuicore_poc.html`) での動作確認**
