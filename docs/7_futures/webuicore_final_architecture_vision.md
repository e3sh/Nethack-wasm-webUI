---
title: webuicore_final_architecture_vision
status: reference
last_updated: 2026-08-27
related_code:
  - src/core/
  - src/client/
---

# WebUICore 最終形態ビジョンと拡張ロードマップ (Final Architecture Vision & Futures)

## 1. ビジョン概要 (Vision Overview)

本ドキュメントは、NetHack WebUI プロジェクトにおける **WebUICore (Core SDK) の最新アーキテクチャビジョン** および拡張ロードマップを定義した仕様書である。

本プロジェクトは「次世代マルチプラットフォーム NetHack SDK」として、Wasm Cコアとフロントエンド（Vue 3, React, Svelte, SolidJS, DOM, Canvas 等）の間の通信・描画・入力を完全に抽象化し、フレームワーク非依存で柔軟に組み込み可能なアーキテクチャを提供する。

本改訂（2026-08-27）では、従来の「Core過密（モノリシック内包型）」から、**「マイクロカーネル ＆ イベント駆動エコシステム（Microkernel & Event-Driven Ecosystem）」** への深化を定義し、ハードウェア/デバイス入力の独立層化（`WebUIDevice`）および出力系のイベント受信駆動化（`WebUISound`）による**完全な関心事の分離**を確立する。

```
+-----------------------------------------------------------------------------------+
|                        [WebUICore 最新プラットフォームアーキテクチャ]                 |
|                                                                                   |
|  [ 入力層 (Input & Devices) ]               [ 中核 (Microkernel) ]                |
|  +---------------------------+             +-----------------------------------+  |
|  | WebUIDevice (外付けアダプタ) |             | WebUICore                         |  |
|  | ・Gamepad Manager (ポーリング)|             | ・WASM Lifecycle (Init/Restart)   |  |
|  | ・Touch Gesture Calculator |             | ・VFS / Memory Access / IO Bridge |  |
|  | ・Keyboard Mapper / Layout| ── sendAction ──> | ・Core State Management           |  |
|  | ・Macro Expander / Queue  | ── sendKey ───> | ・Event Bus (emit 'sound', etc.)  |  |
|  | ・IMEサニタイズ / 誤爆防止 |             | ・Prompt & Window Buffers         |  |
|  | ・nh.gpadAssign ストレージ  |             +-----------------------------------+  |
|  +---------------------------+                               │                     |
|               ▲                                              │ (Pub / Sub Events)  |
|               │ (物理アサイン指示)                                 ▼                     |
|  [ UI & プレゼンテーション層 ]              [ 変換・出力・知識層 (Peripherals & GKL) ]   |
|  +---------------------------+             +-----------------------------------+  |
|  | UI View / Frameworks      | <── Context ──| Game Knowledge Layer (GKL Plugin) |  |
|  | ・React / Vue / Svelte    |   Actions   | ・AreaStateManager (足元/隣接/射線)|  |
|  | ・仮想D-Pad / アクションボタン|             | ・ContextActionEngine (優先度提案) |  |
|  | ・キー/パッドコンフィグUI   |             | ・InventoryStateManager (持ち物)  |  |
|  +---------------------------+             +-----------------------------------+  |
|                                            +-----------------------------------+  |
|                                            | WebUISound (受信駆動・音効)         |  |
|                                            | ・Web Audio / SE / BGM 再生       |  |
|                                            | ・User-Gesture Unlock / Mute管理  |  |
|                                            +-----------------------------------+  |
|                                            +-----------------------------------+  |
|                                            | WebUITranslation (翻訳・整形)     |  |
|                                            | ・辞書引き / メッセージ・エンティティ|  |
|                                            +-----------------------------------+  |
+-----------------------------------------------------------------------------------+
                                          ▲
                                          │  (Transparent Protocol)
                                          ▼
+-----------------------------------------------------------------------------------+
|                     NetHackWasmDriver / NetHackWasmWorkerBridge                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. アーキテクチャ深化と設計原則 (Architectural Refinements)

### (1) 「指示の回り込み」の解消と `WebUIDevice` の独立分離
- **課題**: 従来は `WebUICore` 内に `GamepadManager` や `KeyMapper`、`localStorage("nh.gpadAssign")` を内包していたため、UI側でボタンアサインを変更しようとすると「UI → Core設定 → Core入力処理 → Coreキー送信」という責任のねじれが発生していた。
- **解決策**:
  - デバイス制御・物理マッピング・ストレージ永続化を **`WebUIDevice`** として Core の外側に完全抽出する。
  - **ゲーム側（Core/GKL）**: 「何ができるか（優先度付きアクションリスト）」を提示するだけに専念。
  - **UI / デバイス側（UI + WebUIDevice）**: 提示されたアクションを「どの物理ボタン（Aボタン/右タップ/Tabキー等）に割り当てるか」を100%主導権を持って決定し、解決された `sendAction(id)` または `sendKey(code)` を Core に送信する。
  - **マクロ・キーバインド・IME吸収**: 連続探索マクロ（`20s`）やViキー/WASD配列切り替え、IME誤爆防止、JIS/USキー差異をすべて `WebUIDevice` 内で吸収し、Core をクリーンに保つ。

### (2) メッセージ受信駆動による `WebUISound` の疎結合化
- **課題**: Web Audio API や自動再生ポリシー（User Gesture Unlock）、ミュート設定などを Core が抱え込むと、ヘッドレス実行や初期化フローが複雑化する。
- **解決策**:
  - サウンドは典型的な「一方向の副作用（出力系）」として扱い、**イベント受信駆動（Pub/Sub）** で動作する独立モジュール `WebUISound` に分離。
  - `WebUICore` はゲーム内事象（`core.emit('soundEffect', { cue: 'hit', ... })`）を発行するだけで、オーディオ再生の成否やブラウザ制約は一切意識しない。

### (3) ドメイン知識層（GKL）のプラガブル化
- `AreaStateManager` や `ContextActionEngine`、`InventoryStateManager` などの知識層は、`WebUICore` のパブリックイベントにアタッチする独立プラグイン（`GKLPlugin`）として稼働。
- UIは GKL が生成する構造化データ（`contextActions`, `situation`）のみを購読して描画可能。

---

## 3. 達成済みコア能力 (Achieved Core Capabilities)

開発の進行に伴い、以下のコア能力がカプセル化・モジュール化され、組み込み済みとなっている。

### (1) モジュール完結型マルチプラットフォーム入力基盤 (`src/core/input/`)
- **完全な ES モジュール化 (`window.*` レガシー依存の排除)**:
  - ブラウザのグローバル変数 (`window.rogueDefines`) を全廃し、`defaultDefines.js` およびインデックス `src/core/input/index.js` による純粋な ESM インポート体系を確立。
- **GamepadManager / TouchCalculator / KeyMapper**:
  - コントローラー動的アサイン、960x600/12x9 タップアスペクト比補正、修飾キーマッピングの集約（将来の `WebUIDevice` への移行母体）。

### (2) プロンプト・テキストバッファの責務分離
- **PromptPayloadBuilder / TextWindowManager**:
  - GUIモーダル構造化パースおよびテキスト行バッファリング管理の完全独立モジュール化。

### (3) 高精度 TypeScript 型定義 ＆ 全自動ユニットテスト (Vitest)
- **`src/core/index.d.ts`**: `any` 型を徹底排除し、`DriverLike`, `RendererLike`, `InputResolverLike` 等の高精度型システムを確立。
- **10大ユニットテストスイート**: 26件の全テストケースが 0.49秒で全自動検証 (`npm test`)。

### (4) 開発者用 Debug Inspector DevTools (`src/core/inspector/`)
- ゲーム画面への物理的干渉 0% の `BroadcastChannel` 別タブ/別ウィンドウ独立デバッグコンソール。
- 🌳 GKL State Tree (JSONインスペクター), ⚡ Context Actions モニター, 📜 Event Stream ログ, 🎯 Direct Injector (手動応答/アクション割込) の統合。

---

## 4. 進展版ロードマップ (Updated Roadmap)

```
Phase 1 【完了】        Phase 2 【完了】           Phase 3 【完了】          Phase 4 【次期計画】        Phase 5 【将来展望】
コア基盤 & 完結化     DX & Unit Testing       Debug Inspector DevTools  マイクロカーネル・外出し化   Next-Gen Multi-Client
・ESM化/グローバル排除 ・TS型定義(any排除完了) ・BroadcastChannel 独立化 ・WebUIDevice 外出し分離  ・GKLデータ駆動UI作成
・input/ ディレクトリ ・Vitest 10大テスト完成   ・GKL State Tree & Watcher ・WebUISound 受信駆動化   ・Canvas/WebGL 高速化
・パース/バッファ分離 ・全件0.49s自動検証       ・Direct Injector 完成   ・GKL プラグイン完全疎結合 ・マルチセーブ Bridge API
```

### Phase 1: コア基盤の完全独立・モジュール化 【達成完了】
- `WebUICore` の独立 ESM 化 (`window.*` 依存排除)。
- 入力サブシステム (`src/core/input/`) 集約。
- パース・バッファリングの責任分離 (`PromptPayloadBuilder`, `TextWindowManager`)。

### Phase 2: DX (開発者体験)・TypeScript ・ユニットテスト 【達成完了】
- `src/core/index.d.ts` の `any` 型完全排除と具象型定義の確立。
- Vitest による 10大モジュール別全自動ユニットテストスイート (26ケース, 0.49s) の構築。

### Phase 3: デバッグ・インスペクター DevTools 【達成完了】
- `DebugInspector.js` & `inspector_console.html` による独立 4大タブ DevTools コンソール構築。
- GKL State Tree、Context Actions Monitor、Event Stream、Direct Injector、動作状態インジケーターの完成。

### Phase 4: マイクロカーネル化 ＆ 周辺サブシステム（Device/Sound/GKL）の外出し分離 【次期計画】
1. **`WebUIDevice` の独立パッケージ化**:
   - `GamepadManager`, `TouchCalculator`, `KeyMapper` を Core 内部から外出しし、UIと連携する独立デバイス制御層を構築。
   - キーボードマクロ展開（`20s` 等）、キーリマップ、IME誤爆防止、localStorage設定管理をこの層に完全集約。
   - `WebUICore` の入力 API を `core.sendAction(id, payload)` / `core.sendKey(code)` に純粋化。
2. **`WebUISound` のメッセージ受信駆動化**:
   - Core からのオーディオエンジン直接呼出しを廃止し、`core.on('soundEffect', ...)` を購読して動作する疎結合モジュールへ移行。
3. **GKL (Game Knowledge Layer) プラグイン化の完成**:
   - `inventoryStateManager` 等の残存知識コードを Core から完全に切り離し、純粋なイベントバス経由のアタッチメントへ統一。

### Phase 5: 次世代データ駆動クライアント ＆ エコシステム展開 【将来展望】
- **GKL データ駆動型フロントエンドクライアントの構築**:
  - Cコードやキーコマンドを一切意識せず、GKL (`situation`, `contextActions`) の JSON データだけで動く新世代 UI / スマホ特化 UI / AI 自動プレイエージェントの作成。
- **Canvas / WebGL レンダラーの洗練**:
  - スプライトアニメーション、タイルのスムーズ移動、オーバーレイエフェクトを描画できる高速レンダラーの強化。
- **Save/Load Bridge API の拡張**:
  - 複数セーブデータのバックアップ/復元・クラウドストレージ連携 API。
