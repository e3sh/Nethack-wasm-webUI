---
title: modern_client_development_guide
status: active
last_updated: 2026-08-15
related_code:
  - src/
---

# 📘 モダン Web フロントエンド対応 クライアント構築・実装ガイド (WebUICore 準拠版)

本ドキュメントは、統合ドメイン層 **`WebUICore`** を使用して、Vue 3、React 18、Svelte、SolidJS 等のモダンな Web フロントエンドフレームワークで NetHack クライアントを構築するための標準実装ガイドおよびベストプラクティス集です。

> [!IMPORTANT]
> **API リファレンス・イベント一覧の公式ドキュメント**:  
> `WebUICore` の具体的な API リファレンス、引数仕様、イベント一覧については、公式リファレンス [docs/WebUICore_Usage_Guide.md](file:///C:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/WebUICore_Usage_Guide.md) をご参照ください。

---

## 1. 概要とアーキテクチャ

本プロジェクトでは、Wasm C コアのブロッキング制御および Web Worker 通信、各種データ変換（ステータス・死因・メッセージ翻訳・キー入力・音効）をすべて **`WebUICore`** がファサードとして一括カプセル化しています。

UI プレゼンテーション層（Vue, React, Svelte, SolidJS）は、`WebUICore` から配信される構造化データおよび状態イベントを受け取り、画面レンダリングおよびユーザー操作の転送に専念する Clean Architecture 構成を採用しています。

```text
+-----------------------------------------------------------------------------------+
| 1. Presentation Tier (UI レイヤー: Vue 3 / React 18 / Svelte / SolidJS)             |
|   - UI コンポーネント (GameCanvas, PromptModal, StatusBar, MessageLog)            |
|   - driverController (Singleton WebUICore コントローラー)                          |
+-----------------------------------------------------------------------------------+
                                       │
                                       ▼ (Method Calls / Event Subscriptions)
+-----------------------------------------------------------------------------------+
| 2. Unified Domain Tier (WebUICore Facade)                                         |
|   - WebUICore (Lifecycle State: CoreState.INITIALIZING -> READY -> RUNNING -> etc.) |
|   - Submodules: StatusAccessor, KeyMapper, SoundEngine, TranslationEngine,        |
|                 GameOverResolver, TouchCalculator, GamepadManager                 |
+-----------------------------------------------------------------------------------+
                                       │
                                       ▼ (Worker postMessage 通信)
+-----------------------------------------------------------------------------------+
| 3. Execution Engine Tier (Web Worker Thread: nethack.worker.js)                   |
|   - NetHackWasmDriver & NetHackWasmWorkerBridge                                   |
|   - NetHack 5.0 Wasm C Core (Asyncify スタック制御)                                |
+-----------------------------------------------------------------------------------+
```

---

## 2. 実装における必須ノウハウ ＆ ベストプラクティス

### ① 通信部は Singleton パターン (`driverController`) で一元管理する
- **背景**: Vue 3 の `ref()` や Composition API、SolidJS の Signal 等に `WebUICore` や Wasm レスポンダー (`Resolver`) を直接格納すると、自動的に Reactive Proxy 化され、内部状態の破損や `respond()` 呼び出し時のコンテキスト破壊が発生します。
- **解決策**: 通信および `WebUICore` インスタンスは、フレームワークの Reactive State の外側に置いた **`driverController` シングルトンクラス** で管理し、UI 側へはプレーンなデータのみをセットします。

```typescript
// services/useNetHackDriver.ts (標準設計パターン)
import { WebUICore, CoreState, KEYS } from '../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../src/driver/NetHackWasmWorkerBridge.js';
import { gameStore } from './gameStore';

class NetHackDriverController {
  private core: WebUICore | null = null;

  public async init() {
    if (this.core) return;

    const bridge = new NetHackWasmWorkerBridge('/src/driver/nethack.worker.js');
    this.core = new WebUICore({ driver: bridge, translateEnabled: true });

    // 8 段階 Lifecycle State の変化をバインド
    this.core.on('stateChange', ({ state }) => {
      gameStore.setCoreState(state);
    });

    // 入力モーダル要求
    this.core.on('inputRequired', (payload) => {
      // Proxy 化を防ぐためプレーンなデータのみをストアへ送信
      gameStore.setInputRequired(payload);
    });

    // メッセージログ
    this.core.on('message', (msgText) => {
      gameStore.addLog(msgText);
    });

    // ゲーム開始
    await this.core.start('nethack.js');
  }

  public respond(val: any) {
    if (this.core) this.core.respond(val);
  }

  public sendKeyEvent(e: KeyboardEvent) {
    if (this.core) this.core.sendKeyEvent(e);
  }

  public cancelPrompt() {
    if (this.core) this.core.cancelPrompt();
  }

  public async restartGame() {
    if (this.core) {
      // ページリロード不要のクリーン再起動
      await this.core.restart({ clearStorage: true });
    }
  }
}

export const driverController = new NetHackDriverController();
```

### ② `CoreState` ライフサイクルによる操作ガード ＆ 画面切り替え
`WebUICore` は 8 段階のライフサイクル状態 (`CoreState`) を管理しています。

- **`INITIALIZING`**: Wasm / VFS / タイル等のロード中。全操作入力を受け付けず、ローディングインジケーターを表示。
- **`READY` / `RUNNING`**: ゲーム稼働中。メインゲーム UI（Canvas / DOM Grid / ステータスバー）を表示。
- **`WAITING_INPUT`**: 入力待ちモーダルを表示。
- **`GAME_OVER` / `EXITED`**: 死因 (`result.deathMessage`) やスコアボードを表示。

### ③ キー入力 ＆ 汎用アクション抽象化 (`sendKeyEvent` / `sendAction`)
キーボード入力は、個別の `e.keyCode` 判定を行わず、`WebUICore` のマッピング関数に直接委譲します。

- **生キー入力**: `core.sendKeyEvent(event)`（`preventDefault` や Shift/Ctrl/Alt 判定、トラベルキー `_` 換算を全自動化）。
- **プロンプトキャンセル**: `core.cancelPrompt()` または `KEYS.ESC` (`27`)。
- **仮想ボタン / アクション**: `core.sendAction('MOVE_UP')`, `core.sendAction('CONFIRM')` を呼び出し。

### ④ メニューモーダルのアクセラレータ (`charStr`) ＆ 上下キー操作
`inputRequired` で `promptCategory === 'MENU'` の場合、`guiData.options` の各項目に表示用 1 文字アクセラレータ `charStr` (`'a'`, `'b'` 等) が 100% 保証されます。

- 上下カーソルキー (`↑`/`↓`) でアクティブフォーカスを移動し、`Enter` で `core.respond(selectedItem.charStr)` を送信するナビゲーションを標準実装してください。

### ⑤ クリーン再起動 (`core.restart({ clearStorage: true })`)
ゲームオーバー時や設定変更時の再ゲーム開始には、`location.reload()` や `localStorage.clear()` を行わず、`core.restart({ clearStorage: true })` を呼び出します。
Worker 再構築、セーブ削除、ストレージ破棄、および `map_cleared`（画面全クリアイベント）が全自動発行されます。

---

## 3. 実装ステップバイステップ

### ステップ 1: `WebUICore` の初期化とイベントバインド

```javascript
import { WebUICore, CoreState } from './src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from './src/driver/NetHackWasmWorkerBridge.js';

const bridge = new NetHackWasmWorkerBridge('/src/driver/nethack.worker.js');
const core = new WebUICore({ driver: bridge });

// 描画・ステータスイベントの購読
core.on('print_glyph', ({ x, y, glyphInfo }) => renderTile(x, y, glyphInfo));
core.on('statusUpdate', (status) => updateStatusUI(status));
core.on('message', (text) => addLog(text));
core.on('map_cleared', () => clearCanvas());

// ゲームスタート
await core.start('nethack.js');
```

### ステップ 2: モーダル入力への安全な応答

```javascript
core.on('inputRequired', (event) => {
  const { promptCategory, promptText, options } = event;
  
  if (promptCategory === 'YN') {
    showYnModal(promptText, (answerKey) => core.respond(answerKey));
  } else if (promptCategory === 'MENU') {
    showMenuModal(options, (selectedChar) => core.respond(selectedChar));
  } else if (promptCategory === 'TEXT') {
    showTextInputModal(promptText, (text) => core.respond(text));
  }
});
```

---

## 4. 提供されている標準サンプルクライアント一覧 (`examples/`)

最新の `WebUICore` 準拠実装パターンは、以下の 4 大フレームワークサンプルクライアントで直接確認・参照いただけます：

1. **Vue 3 サンプル (`examples/vue-client`)**: Composition API + Pinia + TypeScript
2. **React 18 サンプル (`examples/react-client`)**: React Hooks + Zustand / Context + TypeScript
3. **Svelte サンプル (`examples/svelte-client`)**: Svelte Store + Components
4. **SolidJS サンプル (`examples/solid-client`)**: Solid Signals / Store + JSX

全サンプルのソースコードは本ガイドラインに基づき `WebUICore` に完全適用済みであり、パッチログゼロ（完全解消）の状態で維持されています。
