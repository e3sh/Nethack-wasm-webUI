# WebUICore DebugInspector モジュール仕様 ＆ 取扱説明書 (Inspector Guide)

`DebugInspector` は、`WebUICore` SDK にビルトインされた開発者支援・バグ切り分けデバッグ基盤です。

`BroadcastChannel` API を利用し、WebUI クライアント画面（Vue 3, React, Svelte, DOM, Canvas 等）のレイアウト・DOM・CSS に **100% 影響を与えない（画面への物理的干渉 0%）** 独立コンソールとして動作します。別タブ / 別ウィンドウ（ポップアップ）上に本格的な DevTools コンソールを表示し、リアルタイムの通信監視および手動応答注入をサポートします。

---

## 1. モジュール構成 (Module Structure)

`src/core/inspector/` 配下のファイル構成：

* **[`DebugInspector.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/inspector/DebugInspector.js)**:
  `WebUICore` のイベント・`state`・`activeResolver`・Game Knowledge Layer (GKL) データを自動抽出・配信し、別ウィンドウからの割り込みを受信する Headless エンジン。
* **[`inspector_console.html`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/inspector/inspector_console.html)**:
  別タブ/別ウィンドウで動作するスタンドアロンのグラフィカル DevTools ダッシュボード UI（ダークテーマ）。
* **[`index.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/inspector/index.js)**:
  モジュールのバレルエクスポート。
* **[`DebugInspector.test.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/inspector/DebugInspector.test.js)**:
  Vitest による全自動ユニットテストスイート。

---

## 2. デバッグコンソール 4 大機能 (DevTools Features)

`inspector_console.html` 上で利用できる機能：

### 1. 🌳 GKL State Tree (JSON インスペクター)
* `InventoryStateManager` の所持品オブジェクト配列 (`inventoryItems`) や、`SituationCache` の周辺文脈環境 (`situation`)、`StatusAccessor` の全属性・状態異常データを、折りたたみ・展開可能なツリー表示で閲覧できます。

### 2. ⚡ Context Actions Monitor (アクション提案モニタ)
* `ContextActionEngine` が今画面上に提案しているワンタップアクション（例: `"鍵でドアを開ける [o]"`）の一覧と対応キーをカード型表示でモニタリングできます。

### 3. 📜 Event Stream Log (時系列イベントログ)
* `inputRequired`, `textWindowModal`, `message`, `statusUpdate` などのイベントをカラー表示。キーワードフィルタリング検索およびログクリアが可能です。

### 4. 🎯 Direct Injector (手動応答・割込注入)
* ゲーム画面のボタン・タップ判定を一切汚さず、別ウィンドウから `y`, `n`, `Space`, `Enter`, `ESC`, `Wait(.)` やカスタムテキストを `WebUICore.respond()` / `sendAction()` へ直接手動テスト注入できます。

### 5. 常時固定インジケーターバー (Header Status)
* 画面最上部に `State` (`RUNNING` / `WAITING_INPUT`), `Category`, `Resolver` (`ACTIVE (Ready)` / `false`) を固定表示。どのタブを開いていてもエンジンの入力待ち状況を常時モニターできます。

---

## 3. 使い方 ＆ 起動方法 (Usage)

### ① JavaScript API からの起動
WebUI クライアントのコードから、以下の 1 行を呼び出すだけで別ウィンドウのデバッグコンソールがポップアップ起動します。

```javascript
import { WebUICore } from '@nethack/webuicore';

const core = new WebUICore({ driver });

// 別ウィンドウで DevTools インスペクターを起動
core.inspector.openConsoleWindow();
```

### ② ポータル画面 (`cltest.html`) からの起動
開発ポータル画面 **[`tools/cltest.html`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/cltest.html)** のヘッダーナビゲーションバーにある **`[🔍 開発者用 Debug Inspector Console を起動]`** ボタンをクリックすることでいつでも起動できます。

### ③ `localStorage` (`nh.config`) 自動連動
設定画面や `localStorage.getItem("nh.config")` 内の `debug: true / false` フラグと自動連動します。`debug: false` にするとパフォーマンス重視で Inspector の通信配信が安全に停止します。
