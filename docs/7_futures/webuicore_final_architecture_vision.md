# WebUICore 最終形態ビジョンと拡張ロードマップ (Final Architecture Vision & Futures)

## 1. ビジョン概要 (Vision Overview)

本ドキュメントは、NetHack WebUI プロジェクトにおける **WebUICore (Core SDK) の最新アーキテクチャビジョン** および拡張ロードマップを定義した仕様書である。

本プロジェクトは「次世代マルチプラットフォーム NetHack SDK」として、Wasm Cコアとフロントエンド（Vue 3, React, Svelte, SolidJS, DOM, Canvas 等）の間の通信・描画・入力を完全に抽象化し、フレームワーク非依存で柔軟に組み込み可能なアーキテクチャを提供する。

```
+-----------------------------------------------------------------------------------+
|                        [WebUICore 最新プラットフォームアーキテクチャ]                 |
|                                                                                   |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  | Input Modules       |  | Translation Engine  |  | Sound & Effect Engine     |  |
|  | ・Gamepad Manager   |  | ・nhMessage 辞書     |  | ・BGM / SE Playback       |  |
|  | ・Touch Calculator  |  | ・nhPatterns 正規表現|  | ・Message Keyword Trigger |  |
|  | ・KeyMapper / Defs  |  | ・Entity (Mon/Item) |  | ・Sound Mode (SE/Beep/Off)|  |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  | Renderer Adapters   |  | Lifecycle & State   |  | Game Knowledge Layer(GKL) |  |
|  | ・DOM / MobileCurses|  | ・Auto Resume       |  | ・AreaStateManager        |  |
|  | ・Canvas / Sprite   |  | ・GameOver Resolver |  | ・InventoryStateManager   |  |
|  | ・NullRenderer      |  | ・Save/Load Bridge  |  | ・SituationCache / Action |  |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  +----------------------------------------------+  +---------------------------+  |
|  | Prompt & Window Buffers                      |  | Debug Inspector (DevTools)|  |
|  | ・PromptPayloadBuilder (GUI 構造化)           |  | ・BroadcastChannel 通信    |  |
|  | ・TextWindowManager    (テキストバッファ)     |  | ・GKL State Tree & Watcher|  |
|  +----------------------------------------------+  +---------------------------+  |
+-----------------------------------------------------------------------------------+
                                          ▲
                                          │  (Transparent Protocol)
                                          ▼
+-----------------------------------------------------------------------------------+
|                     NetHackWasmDriver / NetHackWasmWorkerBridge                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. 達成済みコア能力 (Achieved Core Capabilities)

開発の進行に伴い、以下のコア能力が完全にカプセル化・モジュール化され、組み込み済みとなっている。

### (1) モジュール完結型マルチプラットフォーム入力統合 (`src/core/input/`)
- **完全な ES モジュール化 (`window.*` レガシー依存の排除)**:
  - ブラウザのグローバル変数 (`window.rogueDefines`) を全廃し、`defaultDefines.js` およびインデックス `src/core/input/index.js` による純粋な ESM インポート体系を確立。
- **GamepadManager / TouchCalculator / KeyMapper**:
  - コントローラー動的アサイン、960x600/12x9 タップアスペクト比補正、修飾キーマッピングの一元集約。

### (2) 責務分離
- **PromptPayloadBuilder / TextWindowManager**:
  - GUIモーダル構造化パースおよびテキスト行バッファリング管理の完全独立モジュール化。

### (3) 高精度 TypeScript 型定義 ＆ 全自動ユニットテスト (Vitest)
- **`src/core/index.d.ts`**: `any` 型を徹底排除し、`DriverLike`, `RendererLike`, `InputResolverLike` 等の高精度型システムを確立。
- **10大ユニットテストスイート**: 26件の全テストケースが 0.49秒で全自動検証 (`npm test`)。

### (4) 開発者用 Debug Inspector DevTools (`src/core/inspector/`)
- ゲーム画面への物理的干渉 0% の `BroadcastChannel` 別タブ/別ウィンドウ独立デバッグコンソール。
- 🌳 GKL State Tree (JSONインスペクター), ⚡ Context Actions モニター, 📜 Event Stream ログ, 🎯 Direct Injector (手動応答/アクション割込) の統合。

---

## 3. 進展版ロードマップ (Updated Roadmap)

```
Phase 1 【完了】        Phase 2 【完了】           Phase 3 【完了】          Phase 4 【将来展望】
コア基盤 & 完結化     DX & Unit Testing       Debug Inspector DevTools  Next-Gen Multi-Client
・ESM化/グローバル排除 ・TS型定義(any排除完了) ・BroadcastChannel 独立化 ・GKLデータ駆動UI作成
・input/ ディレクトリ ・Vitest 10大テスト完成   ・GKL State Tree & Watcher ・Canvas/WebGL 高速化
・パース/バッファ分離 ・全件0.49s自動検証       ・Direct Injector 完成   ・マルチセーブ Bridge API
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
- GKL State Tree、Context Actions Monitor、Event Stream、Direct Injector、常時表示動作状態インジケーターの完成。
- `cltest.html` ツールバーへの起動ボタン配置。

### Phase 4: 次世代データ駆動クライアント ＆ マルチメディア表現拡張 【今後の将来展望】
- **GKL データ駆動型フロントエンドクライアントの構築**:
  - Cコードやキーコマンドを一切意識せず、GKL (`situation`, `contextActions`) の JSON データだけで動く新世代 UI / スマホ特化 UI / AI 自動プレイエージェントの作成。
- **Canvas / WebGL レンダラーの洗練**:
  - スプライトアニメーション、タイルのスムーズ移動、オーバーレイエフェクトを描画できる高速レンダラーの強化。
- **Save/Load Bridge API の拡張**:
  - 複数セーブデータのバックアップ/復元・クラウドストレージ連携 API。
