---
title: WebUICore_Usage_Guide
status: active
last_updated: 2026-08-15
related_code:
  - src/core/WebUICore.js
---

# 📖 WebUICore 利用方法・機能仕様ガイド

本ドキュメントは、各サンプルクライアント（Vue 3, React 18, Svelte, SolidJS, Mobile, HTML DOM 等）の開発者が NetHack Wasm ゲームエンジンと連携するための **`WebUICore` API リファレンスおよび実装ガイド** です。

---

## 1. クライアント初期化とライフサイクル制御

```javascript
import { WebUICore, KEYS, CoreState } from './src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from './src/driver/NetHackWasmWorkerBridge.js';

// 1. ドライバ・ブリッジの生成
const bridge = new NetHackWasmWorkerBridge();

// 2. WebUICore インスタンスの生成
const core = new WebUICore({ 
    driver: bridge,
    variant: 'vanilla',        // Wasm C コアのバリアント指定 ('vanilla' | 'jnethack')
    language: 'ja',            // UI 表示言語 ('ja' | 'en')
    translateEnabled: true,    // UI テキスト動的翻訳の有効化
    keyMode: 'numpad',         // 入力モード ('numpad' | 'vi')
    soundMode: 'se'
});

// 3. ライフサイクル状態の変更をバインド
core.on('stateChange', ({ state, oldState }) => {
    console.log("Core StateChanged:", oldState, "->", state);
    // CoreState: UNINITIALIZED -> INITIALIZING -> READY -> RUNNING -> WAITING_INPUT -> GAME_OVER / EXITED
    if (state === CoreState.INITIALIZING) {
        // ローディング画面表示 & UIリセット
    } else if (state === CoreState.READY || state === CoreState.RUNNING) {
        // ゲームメインUI表示
    } else if (state === CoreState.GAME_OVER || state === CoreState.EXITED) {
        // リザルトモーダル表示
    }
});

// 4. ゲームの開始
await core.start('nethack.js');

// 5. クリーン再スタート (セーブ消去・全ストレージ破棄・Worker再構築・map_cleared自動発行)
await core.restart({ clearStorage: true });

// 6. リソース破棄
core.destroy();
```

### 1.1 WebUICore 初期化オプション (`options`)

| オプション名 | 型 | デフォルト値 | 説明 |
| :--- | :--- | :--- | :--- |
| **`driver`** | `Object` | `null` | `NetHackWasmWorkerBridge` または `NetHackWasmDriver` インスタンス。 |
| **`variant`** | `string` | `'vanilla'` | **【重要】Wasm C コアのバリアント種別** (`'vanilla'` \| `'jnethack'`)。<br>制御シグナル検知器（`SignalDetector` / `InteractiveRequestController`）が C コア生プロンプトの同定に用いる**機械用カタログ（英語または日本語）**を決定します。 |
| **`language`** | `string` | `'ja'` | **UI 表示言語** (`'ja'` \| `'en'`)。<br>画面表示用翻訳エンジン（`TranslationEngine`）が UI コンポーネントに描画するテキストの言語です。 |
| **`translateEnabled`** | `boolean` | `true` | UI テキストの動的翻訳を有効にするかどうか。 |
| **`keyMode`** | `string` | `'numpad'` | 方向・移動キーのモード (`'numpad'` = 数字キー 1〜9 \| `'vi'` = hjkl)。推奨アクション等の抽象方向コード（`DIR_W` 等）は自動的にこのモードに従って物理キー（例: `'4'` または `'h'`）に解決されます。 |
| **`gkl`** | `GKLPlugin` | 自動生成 | GKL（Game Knowledge Layer）プラグインインスタンス。外部で生成したインスタンスを注入して一元化することも可能です。 |
| **`soundMode`** | `string` | `'none'` | サウンド再生モード (`'se'`, `'bgm'`, `'none'`)。 |

> [!IMPORTANT]
> ### 🚨 【超重要】バリアント指定 (`variant`) と翻訳・表示言語指定 (`language`) の完全分離
> 
> WebUICore において、**「C コアとの通信制御（システム）」** と **「画面への UI 描画（プレイヤー向け）」** は完全に独立した別レイヤーとして設計されています。
> 
> ```
> 【Cコア / Wasm エンジン】
>      │
>      │ 生データ (例: "In what direction?")
>      ├───► [UI 翻訳レイヤー] (TranslationEngine: language / translateEnabled)
>      │          │
>      │          └──► UI 画面表示 (例: 「どの方向？」) ※シグナル制御には一切干渉しない
>      │
>      └───► [シグナル制御層] (SignalDetector & InteractiveRequestController: variant)
>                 │
>                 └──► C コア生プロンプト辞書 (variant: 'vanilla' = 英語カタログ)
>                      ※UI が日本語表示であっても、C コアの生データから直接判定
> ```
> 
> - **Vanilla NetHack 5.0 Wasm を日本語 UI で遊ぶ場合（現在の標準設定）**:  
>   `variant: 'vanilla'` かつ `language: 'ja'` と指定します。  
>   C コア自身は英語で生データ（`"In what direction?"` 等）を出力するため、シグナル制御層は**英語カタログ**を使って正確に制御シグナル（`SIGNAL_DIRECTION` 等）を検知します。UI 翻訳層がどうテキストを表示しようと、シグナル判定が壊れることはありません。
> - **JNetHack Wasm（日本語 C コア）を動かす場合**:  
>   `variant: 'jnethack'` と指定します。  
>   C コア自身が日本語生データを出力するため、シグナル制御層は**日本語カタログ**を使って検知します。
> 
> **※シグナル制御層が UI 表示用の翻訳後テキストを読み取ることは設計上禁止されています。** これにより、翻訳辞書のアップデートや多言語対応によって自動アクションや対話シーケンスが破壊されるリスクが根本的に排除されています。

---

## 2. コア API リファレンス

| メソッド API | 返り値 | 説明 |
| :--- | :--- | :--- |
| `start(entryScript, options)` | `Promise<void>` | Wasm / VFS / タイルをロードし、ゲームエンジンを初期化・開始 |
| `restart(options)` | `Promise<boolean>` | `{ clearStorage: true }` 指定時、VFSセーブデータ・全ストレージ破棄＋Worker再構築＋`map_cleared`を全自動発行して再初期化 |
| `destroy()` | `void` | インターバル・リスナー等のリソースを安全解放 |
| `getState()` | `CoreState` | 現在の 8 段階 Lifecycle State (`UNINITIALIZED` 〜 `DESTROYED`) を取得 |
| `getStatus()` | `Object` | 最新の構造化ステータス（`hp`, `gold`, `dlevel`, `conditions`, `stats` 等）を取得 |
| `detectSavedGameInfo()` | `Promise<Object>` | セーブデータの有無および検出されたプレイヤー名 (`{ hasSave, savePlayerName }`) を取得 |
| `hasSaveData()` / `hasSaveDataAsync()` | `boolean` / `Promise<boolean>` | VFS または IndexedDB にセーブデータが存在するかチェック |
| `deleteSaveFile(targetFilename)` | `Promise<boolean>` | 指定セーブファイル（未指定時は自プレイヤーセーブ）を削除する透過 Safe API |
| `clearAllStorage()` | `Promise<boolean>` | `deleteSaveFile()` の互換エイリアス API |
| `getHighScores()` / `getHighScoresAsync()` | `Array<Object>` / `Promise<Array>` | VFS からパースされた Top 10 ランキング構造化配列を取得 |
| `resolveGameOver()` | `Promise<GameOverResult>` | 死因 (`deathMessage`), 勝敗, スコアボード (`scoreboard`) を完全解析・返却 |
| `cancelPrompt()` | `boolean` | アクティブなプロンプトを `KEYS.ESC` (`27`) で安全にキャンセル |
| `sendKeyEvent(event)` | `boolean` | 生の `KeyboardEvent` を自動マッピングし C コアへ送信 (`preventDefault` 自動適用) |
| `sendAction(actionName)` | `boolean` | `'MOVE_UP'`, `'CONFIRM'`, `'CANCEL'` 等の汎用キーアクション名を送信 |
| `sendKey(inputVal, shift, ctrl, alt, rawKey)` | `void` | キー入力を C コアへ送信 (ASCIIコード・特殊キーマップへ自動変換) |
| `querySequenceSilent(sequenceOrRecipe, options)` | `Promise<Array<Object> \| Object>` | トークン配列（`['i', ' ']` 等）または対話レシピオブジェクトを画面非表示で自走実行し、結果を返却 |
| `executeSequence(sequenceOrRecipe, options)` | `Promise<boolean \| Object>` | キーシーケンスまたは対話レシピオブジェクトを安全に実行し完了状態を返却 |
| `getLastSequenceBuffer()` | `Array<Object>` | 直近のシーケンス実行結果バッファのクリーンコピーを取得 |
| `getSituation()` | `Object` | GKL が管理する統合ゲーム状況 (`{ status, inventory, area, tools, actions }`) を一括取得 |
| `syncInventorySilent(options)` | `Promise<boolean>` | `querySequenceSilent(['i', ' '])` を実行し、`InventoryStateManager` を 100% 正確に最新化 |
| `gkl.inspectCellOnDemand(targetPos, options)` | `Promise<Object>` | 指定座標 `(x, y)` のプレイヤー/敵/アイテム/死体/地形を調査し統一カードデータを返却 |
| `gkl.getFocusCameraTiles(radiusX, radiusY, options)` | `Array<Object>` | プレイヤー中心の 4層レイヤー解決済みタイル配列（`renderGlyphs`、仮床・墓石自動補完）を取得 |
| `respond(inputVal)` | `void` | メニュー選択・YN回答・テキストプロンプト応答を安全送信 |
| `translate(text)` | `string` | 指定したテキストを内蔵 `TranslationEngine` で動的翻訳 |
| `lookupWord(word, pos)` | `string` | 品詞 (`noun` 等) を指定して名詞/単語辞書引きを実行 |
| `getGlyphStyle(glyph, options)` | `Object` | 指定グリフ ID に対応する CSS スタイルオブジェクトを取得 |
| `getGlyphHtml(glyph, options)` | `string` | 指定グリフ ID に対応する HTML スニペットを取得 |
| `handleTouchPoint(pageX, pageY, rect, scrollX, scrollY)` | `void` | タッチタップ位置から 3x3/5x5 グリッドを判定し移動キーを送信 |

---

## 3. 定数定義 (Constants)

### `KEYS` (統一キーコード定数)
```javascript
import { KEYS } from './src/core/WebUICore.js';

KEYS.ESC;       // 27
KEYS.ENTER;     // 13
KEYS.SPACE;     // 32
KEYS.BACKSPACE; // 8
KEYS.TAB;       // 9
```

### `CoreState` (8 段階ライフサイクル)
- `UNINITIALIZED`: 未初期化
- `INITIALIZING`: 非同期アセット・Wasm ロード中 (操作ガード)
- `READY`: 準備完了
- `RUNNING`: ゲームループ稼働中
- `WAITING_INPUT`: ユーザー入力待ち
- `GAME_OVER`: 死因確定・リザルト画面
- `EXITED`: WASM プロセス正常終了
- `DESTROYED`: インスタンス破棄済

---

## 4. 主要イベントリスナー一覧 (`core.on(eventName, callback)`)

| イベント名 | パラメータ | 用途・説明 |
| :--- | :--- | :--- |
| `stateChange` | `{ state, oldState }` | 8 段階 Lifecycle State の変化通知 |
| `print_glyph` | `{ windowId, x, y, glyph, ch, color, glyphInfo }` | マップセル単体の更新描画通知 |
| `cursor` | `{ x, y, windowId }` | ターゲットカーソル（ルックモード等）のリアルタイム移動通知 |
| `clear_nhwindow` | `{ windowId }` | ウィンドウ描画領域のクリア命令通知 |
| `map_cleared` | `void` | ダンジョン階層・分岐移動時およびリスタート時のマップ全消去通知 |
| `message` | `msgText` (String) | 日本語自動翻訳済みのゲームメッセージログ通知 |
| `statusUpdate` | `{ field, value, change, color, allFields, status }` | ステータス変化および全構造化ステータス更新通知 |
| `inputRequired` | `payload` | メニュー表示・YNプロンプト・テキストプロンプト等の入力待機通知 (`promptCategory` 付与) |
| `inputResolved` | `void` | 入力モーダル閉塞・解決通知 |
| `textWindowModal` | `{ title, lines, resolver, payload }` | 整形・翻訳済み `title` を含む全画面ヘルプ・テキスト表示要求 |
| `gameOver` | `result` (`GameOverResult`) | 翻訳済み死因 `deathMessage` やスコアボード確定時のリザルト通知 |
| `exited` | `{ gameOverResult, exitCode }` | Wasm プロセス終了時の通知 |

---

## 5. UI 開発時の標準仕様化ガイドライン（全サンプル共通）

1. **上下カーソルキー (`↑`/`↓`) ＋ `Enter` 決定機能**:
   - `inputRequired` で `promptCategory === 'MENU'` の場合、`guiData.options` の各項目に表示用一文字 `charStr` (`'a'`, `'b'` 等) が 100% 保証されます。
   - UI 側では選択肢を配列表示し、上下キーでフォーカス移動して `Enter` キーで `core.respond(selectedItem.charStr)` または `core.respond(index)` を送信してください。
2. **安全なプロンプトキャンセル**:
   - キャンセルボタンや `ESC` キー押下時には、マジックナンバーを使わず `core.cancelPrompt()` を呼び出します。
3. **ゲームオーバー死因表記**:
   - `gameOver` イベント時、`result.deathMessage` プロパティを参照することで、翻訳済みの正式死因文面を直接表示できます。
4. **カーソルフォーカス枠描画**:
   - `cursor` イベント受診時、操作中のターゲットカーソル座標 `(x, y)` の位置に金色のフォーカス枠を描画。セルサイズ 16px * 14px の**内側 1px（`dx+1.5, dy+1.5, 13px * 11px`）**に描画して残像ゴミの発生を抑止すること。
5. **ローディングガード**:
   - `state === CoreState.INITIALIZING` 時は全操作入力を受け付けず、画面中央にローディングインジケーターを表示すること。

---

## 6. GKL (Game Knowledge Layer) 状況推論 ＆ ナレッジアシストの統合パターン

### 6.1 完全疎結合・オプショナルプラグイン設計
`WebUICore` は `GKLPlugin`（Game Knowledge Layer）を完全にオプショナルなプラグインとして扱います。
`GKLPlugin` を接続しない場合でも、キャンバス描画、キー入力、メニュー、プロンプト、ステータス表示は 100% 独立して通常プレイ可能です。

### 6.2 ナレッジ UI 構築のベストプラクティス
1. **⚡ アイコン即時一発実行（ワンタップ）**:
   所持品一覧のアイテムアイコンを短くタップした際、`executeSequence(['w', item.letter])` や `executeSequence([item.letter])` を送出することで、確認ダイアログなしで即座に装備・使用が可能です。（Vue 3 では Reactive Proxy を `Array.from()` で解くこと）。
2. **📱 所持アイテムの長押し / 右クリックによる 2段目アクションメニュー表示**:
   アイテムアイコンの長押し（約400ms）またはマウス右クリック時に `core.driver.queueSequence(['i', item.letter], { isSilentSync: true })` を送出することで、1段目インベントリの画面遷移をサイレント通過し、**NetHack 公式の 2段目アクションメニュー（`itemactions`: "Do what with <item>?"）をダイレクトに画面中央へモーダル表示**できます。
   - **日常の基本操作**: 短タップでワンタップ即時実行（装備・食べる・飲むなど）
   - **詳細・特殊操作**: 長押し／右クリックで公式アクション一覧（置く、投げる、名付け、調べるなど）から安全に選択
   - **実装パターン例 (Pointer Events)**:
     ```javascript
     let pressTimer = null;
     let isLongPress = false;
     const LONG_PRESS_MS = 400;

     slot.onpointerdown = (e) => {
       if (e.button !== 0) return;
       isLongPress = false;
       slot.classList.add('pressing');
       pressTimer = setTimeout(() => {
         isLongPress = true;
         slot.classList.remove('pressing');
         if (navigator.vibrate) navigator.vibrate(25);
         // 2段目アクションメニューをサイレント起動
         core.driver.queueSequence(['i', item.letter], { isSilentSync: true });
       }, LONG_PRESS_MS);
     };

     slot.onpointerup = (e) => {
       if (pressTimer) clearTimeout(pressTimer);
       slot.classList.remove('pressing');
       if (!isLongPress && e.button === 0) {
         // 通常クリック (ワンタップ実行)
         core.executeSequence([item.letter]);
       }
     };

     slot.oncontextmenu = (e) => {
       e.preventDefault();
       if (pressTimer) clearTimeout(pressTimer);
       slot.classList.remove('pressing');
       core.driver.queueSequence(['i', item.letter], { isSilentSync: true });
     };
     ```
3. **💡 浮き出しポップオーバー (Popover)**:
   アイコンのホバー時に「アイテム名」「ワンタップ時の予想動作 (`💡 ワンタップ: 装備する [w]`)」「日本語効果サマリー」を表示する UX パターン。
4. **🎯 方向フィルター (`extractDirectionCode`)**:
   アクション配列から `extractDirectionCode(act)` を通して `'NW'`, `'N'`, `'NE'`, `'W'`, `'SELF'`, `'E'`, `'SW'`, `'S'`, `'SE'` を判定し、キーパッドへ件数バッジを表示。
5. **🔍 7x7 ダンジョンズームカメラ (`getZoomAreaTiles(radius = 3)`)**:
   `cursorPos` を中心に 7x7 (49マス) の 24px スプライト格子を描画。
   ※ NetHack の Glyph ID `0` は `giant ant` のため、`tileId === 0` かつ `symbol === ' '` のマスは `glyphId = -1` (未探索) として扱うこと。
6. **フレームワーク別リアクティビティバインド**:
   - **Svelte**: `$: zoomTiles = ($cursorPosStore, $mapGridStore, driverController.getZoomAreaTiles(3));`
   - **SolidJS**: `getSolidGlyphStyle` によるハイフン区切り (`background-image`) スタイル展開。

---

## 7. まとめ

`WebUICore` は、コアのゲーム駆動ロジックとフロントエンド表示層・ナレッジ層を明確に分離したクリーンアーキテクチャを提供します。開発者はコンポーネントフレームワーク（Vue, React, Svelte, SolidJS）の違いに関わらず、最小限のコードで高品質な NetHack Web アプリケーションを構築できます。

