# WebUICore 最終形態ビジョンと拡張ロードマップ (Final Architecture Vision & Futures)

## 1. ビジョン概要 (Vision Overview)

本ドキュメントは、NetHack WebUI プロジェクトにおける **WebUICore (Core SDK) の最終形態 (Final Architecture Vision)** および将来的な拡張機能を定義した未来仕様書である。

現段階の開発においては、Wasm Cコアと既存 Webコンポーネント（`mobileCurses.js`, `DisplayManager.js` 等）の間の基本通信・描画・入力を100%安定させる手作業実装を最優先とする。
その上で、本プロジェクトが最終的に目指すべき「次世代マルチプラットフォーム NetHack SDK」としてのフルスペックな姿と、各種サンプルコード (`examples/`, デバッグコンソール等) から取り込むべき能力をここに体系化する。

```
+-----------------------------------------------------------------------------------+
|                        [WebUICore 最終形態 プラットフォーム]                       |
|                                                                                   |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  | Input Modules       |  | Translation Engine  |  | Sound & Effect Engine     |  |
|  | ・Gamepad Manager   |  | ・nhMessage 辞書     |  | ・BGM / SE Playback       |  |
|  | ・Touch D-Pad       |  | ・nhPatterns 正規表現|  | ・Message Keyword Trigger |  |
|  | ・KeyMap Normalizer |  | ・Entity (Mon/Item) |  | ・Sound Mode (SE/Beep/Off)|  |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  +---------------------+  +---------------------+  +---------------------------+  |
|  | Renderer Adapters   |  | Lifecycle & State   |  | Debug & Inspector         |  |
|  | ・DOM / MobileCurses|  | ・Auto Resume       |  | ・Realtime Event Stream   |  |
|  | ・Canvas / Sprite   |  | ・GameOver Resolver |  | ・State Monitor           |  |
|  | ・WebGL (Future)    |  | ・Save/Load Bridge  |  | ・Direct Resolver Injector|  |
|  +---------------------+  +---------------------+  +---------------------------+  |
+-----------------------------------------------------------------------------------+
                                          ▲
                                          │  (Transparent Protocol)
                                          ▼
+-----------------------------------------------------------------------------------+
|                     NetHackWasmDriver / NetHackWasmWorkerBridge                   |
+-----------------------------------------------------------------------------------+
```

---

## 2. サンプルコード (`examples/` / PoC) から取り込むべき CoreSDK 能力

これまでに作成したサンプルコード・デバッグコンソール・PoCクライアントで検証した機能の中から、将来的に CoreSDK へ取り込むべき能力を以下の通り整理・抽出する。

### (1) 高度なマルチプラットフォーム入力統合能力 (Input Module)
- **GamepadManager のコア標準化**:
  - HTML5 Gamepad API のポーリングおよび `PROMPT_CATEGORY` (YN, MENU, ASKNAME, KEY) に応じた動的ボタンマッピング。
  - アナログスティックの 8 方向移動キー変換。
  - ガイド用 UI オーバーレイデータ (`buttonOverlay`) の動的生成。
- **TouchCalculator (タッチ / 仮想 D-Pad)**:
  - 画面タップ位置 (x, y) から 3x3 / 5x5 グリッド ID への変換および NetHack 移動キー (`8`, `2`, `4`, `6`, `7`, `9`, `1`, `3`) への即時リスケール変換。

### (2) 完全日本語化・高度動的翻訳能力 (Translation Engine)
- **3層ハイブリッド翻訳**:
  1. `nhMessage()` による完全一致文章の高速 O(1) 辞書引き。
  2. `nhPatterns()` による正規表現動的パターン置換。
  3. `nhEntities()` (モンスター名) および `nhItems()` (アイテム名) の名詞・単語辞書統合によるメッセージ内動的単語置換。
- **localStorage 設定完全同期**:
  - ユーザーの翻訳 ON/OFF 設定 (`nh.translate_enabled`) の自動保存・読み込み。

### (3) サウンド・演出制御能力 (Sound Engine)
- **メッセージキーワード連動 SE/BGM 再生**:
  - `putstr` メッセージ（例: "You hit...", "zap", "die", "gold"）のキーワードを自動検出し、SE (効果音) を遅延なくトリガー。
- **サウンドモード制御**:
  - `mute` (消音) / `se` (効果音) / `beep` (ビープ音) の動的切り替え。

### (4) 独立デバッグ・リアルタイムインスペクター能力 (Debug Inspector)
- **リアルタイム・イベントストリーム監視**:
  - Wasm Driver ↔ Core 間で受送信される全イベント (`putstr`, `status_update`, `inputRequired`, `display_nhwindow`) のミリ秒タイムスタンプ付きリアルタイムカラーログ出力。
- **コア状態モニター (State Monitor)**:
  - `Driver State`, `Prompt Category`, `Active Resolver`, `Menu Items Count` の常時モニタリング。
- **Direct Resolver Injector**:
  - UI層を迂回して `activeResolver.respond(...)` に任意のキーやレスポンスを手動注入するデバッグテスター機能。

### (5) ライフサイクル & ゲームオーバー自動判定能力 (Lifecycle Engine)
- **GameOverResolver**:
  - 死亡時・勝敗決定時のメッセージログ (`putstr`) および `exited` イベントから、死因・最終スコア・遺言を自動パースして構造化データとして抽出。
- **Auto Resume (セーブデータ自動復元)**:
  - IndexedDB (`IDBFS`) 内の既存セーブファイルを自動検知し、`askname` プロンプト時にプレイヤー名を自動注入してセーブデータから一発再開。

---

## 3. 最終形態のアーキテクチャ階層構造

最終形態の WebUICore は、高機能でありながら各機能が完全な**プラグイン式モジュール構造**として分離され、利用者が自由に必要な機能のみを組み合わせて起動できる設計とする。

- **`WebUICore.js`**: 全モジュールを統括するファサード (Facade) クラス。
- **`src/core/input/`**: GamepadManager, TouchCalculator, KeyNormalizer
- **`src/core/translation/`**: TranslationEngine, DictionaryParser
- **`src/core/sound/`**: SoundEngine, AudioBufferPlayer
- **`src/core/renderers/`**: MobileCursesAdapter, CanvasRenderer, NullRenderer
- **`src/core/inspector/`**: DebugInspector, EventLogger, StateMonitor
- **`src/core/lifecycle/`**: GameOverResolver, AutoResumeManager

---

## 4. 将来展望 (Future Roadmap)

- **Phase I [現在]: 基本コアの完全安定化**
  - Wasm Driver と既存 Webコンポーネント (mobileCurses 等) 間での描画・キー操作・ステータス更新の 100% 安定動作の確立。
- **Phase II: サンプルコード機能のモジュール化と組み込み**
  - 本資料に記載した SoundEngine, TranslationEngine, GamepadManager, DebugInspector をプラグインモジュールとして順次洗練・組み込み。
- **Phase III: 次世代 WebUI プラットフォーム最終形態の完成**
  - モバイル、デスクトップ、ゲームパッド、タッチパネル、音声効果、完全日本語化、デバッグインスペクターが一体となった、NetHack WebUI プラットフォームの完成。
