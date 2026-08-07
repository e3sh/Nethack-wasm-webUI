# 📖 WebUICore 利用方法・機能仕様ガイド

本ドキュメントは、各サンプルクライアント（Vue 3, React 18, Svelte, SolidJS, Mobile, HTML DOM 等）の開発者が NetHack Wasm ゲームエンジンと連携するための **`WebUICore` API リファレンスおよび実装ガイド** です。

---

## 1. クライアント初期化とライフサイクル制御

```javascript
import { WebUICore } from './src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from './src/driver/NetHackWasmWorkerBridge.js';

// 1. ドライバ・ブリッジの生成
const bridge = new NetHackWasmWorkerBridge();

// 2. WebUICore インスタンスの生成
const core = new WebUICore({ driver: bridge });

// 3. ライフサイクル状態の変更をバインド
core.on('stateChange', ({ state }) => {
    console.log("Core StateChanged:", state);
    // CoreState: UNINITIALIZED -> INITIALIZING -> READY -> RUNNING -> WAITING_INPUT -> GAME_OVER / EXITED
    if (state === 'INITIALIZING') {
        // ローディング画面表示 & UIリセット
    } else if (state === 'READY' || state === 'RUNNING') {
        // ゲームメインUI表示
    } else if (state === 'GAME_OVER' || state === 'EXITED') {
        // リザルトモーダル表示
    }
});

// 4. ゲームの開始
await core.start('nethack.js');

// 5. ページリロード不要のゲーム再スタート
await core.restart();

// 6. リソース破棄
core.destroy();
```

---

## 2. コア API リファレンス

| メソッド API | 返り値 | 説明 |
| :--- | :--- | :--- |
| `start(entryScript, options)` | `Promise<void>` | Wasm / VFS / タイルをロードし、ゲームエンジンを初期化・開始 |
| `restart()` | `Promise<void>` | メモリ・ステータスを全リセットし、ブラウザリロードなしで再初期化スタート |
| `destroy()` | `void` | インターバル・リスナー等のリソースを安全解放 |
| `getState()` | `CoreState` | 現在の 8 段階 Lifecycle State を取得 |
| `getStatus()` | `Object` | 最新の構造化ステータス（`hp`, `gold`, `dlevel`, `conditions`, `stats` 等）を取得 |
| `detectSavedGameInfo()` | `Promise<Object>` | セーブデータの有無および検出されたプレイヤー名 (`{ hasSave, savePlayerName }`) を取得 |
| `hasSaveData()` / `hasSaveDataAsync()` | `boolean` / `Promise<boolean>` | VFS または IndexedDB にセーブデータが存在するかチェック |
| `deleteSaveData()` | `Promise<void>` | 既存セーブファイルを完全に削除 |
| `clearAllStorage()` | `Promise<boolean>` | VFS および IndexedDB 内の全データをクリーンアップ |
| `getHighScores()` / `getHighScoresAsync()` | `Array<Object>` / `Promise<Array>` | VFS からパースされた Top 10 ランキング構造化配列を取得 |
| `resolveGameOver()` | `Promise<GameOverResult>` | ゲームオーバー/Wasm終了時の勝敗・死因・遺言を解析・返却 |
| `translate(text)` | `string` | 指定したテキストを内蔵 `TranslationEngine` で動的翻訳 |
| `lookupWord(word, pos)` | `string` | 品詞 (`noun` 等) を指定して名詞/単語辞書引きを実行 |
| `getGlyphStyle(glyph, options)` | `Object` | 指定グリフ ID に対応する CSS スタイルオブジェクトを取得 |
| `getGlyphHtml(glyph, options)` | `string` | 指定グリフ ID に対応する HTML スニペットを取得 |
| `handleTouchPoint(pageX, pageY, rect, scrollX, scrollY)` | `void` | タッチタップ位置から 3x3/5x5 グリッドを判定し移動キーを送信 |
| `sendKey(keyCode, shift, ctrl, alt, key)` | `void` | キー入力を C コアへ送信 (ASCIIコード・キーマップへ自動変換) |
| `respond(value)` | `void` | メニュー選択・プロンプトへの回答応答を安全送信 |

---

## 3. 主要イベントリスナー一覧 (`core.on(eventName, callback)`)

| イベント名 | パラメータ | 用途・説明 |
| :--- | :--- | :--- |
| `stateChange` | `{ state, oldState }` | 8 段階 Lifecycle State の変化通知 |
| `print_glyph` | `{ windowId, x, y, glyph, ch, color, glyphInfo }` | マップセル単体の更新描画通知 |
| `cursor` | `{ x, y, windowId }` | ターゲットカーソル（ルックモード等）のリアルタイム移動通知 |
| `clear_nhwindow` | `{ windowId }` | ウィンドウ描画領域のクリア命令通知 |
| `map_cleared` | `void` | ダンジョン階層・分岐移動時のマップ全消去通知 |
| `message` | `msgText` (String) | 日本語自動翻訳済みのゲームメッセージログ通知 |
| `statusUpdate` | `{ field, value, change, color, allFields, status }` | ステータス変化および全構造化ステータス更新通知 |
| `inputRequired` | `passThroughPayload` | メニュー表示・YNプロンプト・テキストプロンプト等の入力待機通知 |
| `inputResolved` | `void` | 入力モーダル閉塞・解決通知 |
| `textWindowModal` | `{ lines, resolver, payload }` | 全画面ヘルプやスクロールテキスト等の表示要求通知 |
| `gameOver` | `result` (`GameOverResult`) | 死因・勝敗・最終スコア確定時のリザルト通知 |
| `exited` | `{ gameOverResult, ... }` | Wasm プロセス終了時の通知 |

---

## 4. UI 開発時の標準仕様化ガイドライン（全サンプル共通）

1. **上下カーソルキー (`↑`/`↓`) ＋ `Enter` 決定機能**:
   - `inputRequired` で `category === 'MENU'` または `items.length > 0` の場合、メニュー項目を配列保持し、上下キーでアクティブインデックスを変更して `.focus` クラス（ハイライト）をアタッチ。`Enter` キーで該当ボタンの `click()` を発火すること。
2. **カーソルフォーカス枠描画**:
   - `cursor` イベント受診時、操作中のターゲットカーソル座標 `(x, y)` の位置に金色のフォーカス枠を描画。セルサイズ 16px * 14px の**内側 1px（`dx+1.5, dy+1.5, 13px * 11px`）**に描画して残像ゴミの発生を抑止すること。
3. **ローディングガード**:
   - `state === 'INITIALIZING'` 時は全操作入力を受け付けず、画面中央にローディングインジケーターを表示すること。
