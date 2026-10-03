---
title: NetHack WASM WebUI プロジェクト総合ロードマップ＆進捗ダッシュボード
status: living-document
last_updated: 2026-10-01
---

# 🗺️ NetHack WASM WebUI 総合ロードマップ＆進捗ダッシュボード

本ドキュメントは、NetHack WASM WebUI プロジェクトにおける**「現在進行中・直近の移行タスク (WIP)」「実装待ちの構想・アイデア (Backlog)」「すでに実装完了している現行仕様 (Living Specs)」「過去の設計記録 (Archive)」**を一元管理する総合ダッシュボードです。

> [!IMPORTANT]
> **🧭 設計・開発・リファクタリング時の最重要必読インベントリ**  
> システムが現在持っている全機能、APIシグネチャ、WASM通信パイプライン、データ資産（全384体モンスター・481アイテム・787件の噂）、アーキテクチャの基本憲法、および機能重複統廃合・ギャップ分析は、**[システム現有能力カタログ (SYSTEM_CAPABILITIES.md)](./SYSTEM_CAPABILITIES.md)** にて一元集約されています。新機能の検討や改修時は必ずこちらをご一読ください。

直近の総合評価・引き継ぎ資料: **[handover_20260929_status_reevaluation.ja.md](./6_project_reports/handover_20260929_status_reevaluation.ja.md)**

---

## 📌 ドキュメント・ライフサイクル規約

ドキュメントの鮮度と信頼性を担保するため、すべての設計・仕様ドキュメントは以下の4段階のライフサイクルで分類・運用されます。

| ステータス | バッジ | 定義 | 取扱方針 |
| :--- | :---: | :--- | :--- |
| **`proposed`** | 💡 構想 (Idea / RFC) | 思いつき・将来構想。コードには未反映。 | アイデア出し用。いつでも変更・破棄可能。 |
| **`in-progress`** | 🚧 進行中 (WIP / Plan) | 仕様合意済みで実装中、または直近着手予定。 | 作業計画とタスクチェックリストを含む。 |
| **`implemented`** | 🟢 現行仕様 (Living Spec) | 実装完了。**現在のコードの挙動を示す正解（SSOT）**。 | コード変更時に合わせて最新状態へ更新する。 |
| **`archived`** | 📦 記録 (Archive / ADR) | 完了した作業記録、過去ログ、意思決定記録。 | 歴史的経緯として保存。原則更新しない。 |

---

## 🔥 1. 直近フォーカス・移行計画 (Next Focus / Active Plan)

現在設計が完了し、直近の着手対象である最重要リファクタリング・機能拡充タスクです。  
直近で策定された音響系・操作系の新アーキテクチャに基づき、**「Phase 6: 統合サウンドコーディネーター ＆ 音響駆動ドライバ分離」** および **「Phase 7: 標準操作プログレッシブ拡張 ＆ WASM動的ルックアップ統合ナレッジ」** を順次推進します。

> [!NOTE]
> 直近に完了した **Phase E (UIController / Web Components: 2026-09-27 完了)** および **Phase 5 (メッセージシグナル化刷新 Stage 5.1〜5.6: 2026-09-29 完了)** の実施実績詳細は、**[最新引き継ぎレポート (handover_20260929)](./6_project_reports/handover_20260929_status_reevaluation.ja.md)** および **[3. 実装完了コア機能 (Living Specs)](#🟢-3-実装完了コア機能現行仕様-living-specs)** をご参照ください。

---

### 1.1 Phase 6: 統合サウンドコーディネーター ＆ 音響駆動ドライバ分離構想 (Sound Coordinator & Multi-Driver Decoupling)
- **ステータス**: `🟢 implemented` (実装完了, 2026-10-02)
- **設計書**: [sound_coordinator_and_multidriver_architecture.ja.md](./4_sound/sound_coordinator_and_multidriver_architecture.ja.md)
- **最優先着手理由**:
  - Stage 5.4（決定論的SE・スタガード遅延）および Stage 5.6（動的音程シンセシス）の完了に伴い、`SoundEngine.js` に「入力トリガー受付・照合」「調停・仲裁（優先度・キュー・クールダウン）」「物理音響駆動（Howler/WebAudio/Beepcore）」の3大責務が過密集中。
  - カタログ試聴時のシンセシス漏れやモード判定の分散を根絶し、疎結合なプラガブル・マルチドライバ構成を確立する。
- **アーキテクチャ3層モデル**:
  - **システム単一窓口 (`SoundCoordinator` / `SoundEngine`)**: 外部（WebUICore, UI, テスト）からは完全互換の単一ファサードのみが見える構造を維持。
  - **調停エンジン (`SoundArbiter`)**: クールダウン、優先度ソート（100〜30）、スタガード遅延（60ms）、再生モード（Auto/Wave/Beep/Mute）判定を一元化（SSOT）。
  - **物理駆動ドライバ層 (`AudioDrivers`)**: ゲームロジックを一切持たない純粋な `WaveAudioDriver`、`PsgBeepDriver`、`ProceduralSynthDriver`（FM/AM/和音/ピッチベンド）の独立プラグイン構造。
- **マイグレーションステップ**:
  - [x] **Step 1: 物理駆動ドライバ群の抽出と単体テスト配備**
    - `src/core/sound/drivers/` 新設 (`WaveAudioDriver.js`, `PsgBeepDriver.js`, `ProceduralSynthDriver.js`, `BaseAudioDriver.js`)
    - 各ドライバの独立単体テスト配備（モック AudioContext / Howler による 100% カバレッジ）
  - [x] **Step 2: `SoundArbiter.js` による調停ロジックの Headless 化**
    - クールダウン、優先度ソート、スタガードキュー、モード判定の完全抽出 (`SoundArbiter.js`, `SoundModeManager.js`)
    - 単体テスト配備（タイマー仮想化によるキュー挙動・割り込み検証）
  - [x] **Step 3: `SoundCoordinator.js` 統合 Facade 配備と `SoundEngine.js` 委譲ラッパー化**
    - 外部 API（`processMessageContext`, `handleFxTrigger`, `setSoundMode`, `enqueueSound` 等）の後方互換 100% 維持
    - 全117テストスイート・1,392テスト完全パスおよび全4サンプルクライアントビルド確認

---

### 1.2 Phase 7: 標準操作プログレッシブ拡張 ＆ WASM動的ルックアップ統合ナレッジ (Native Command Progressive Enhancement)
- **ステータス**: `🚧 in-progress` (Phase 1 完了, 2026-10-02)
- **設計書**: [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md)
- **関連カタログ**: [SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md) (第7章 ギャップ分析)
- **概要**:
  - [SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md) で特定された **「内部蓄積されているがUIと未結線な4大ギャップ」** を、NetHackの標準コマンド（`/`, `\`, `;`, `C` 等）を自然にフックして昇華させる「プログレッシブ・エンハンスメント」の思想のもとで包括的に結線・解決する中核計画。
  - **4大ギャップとの対応結線**:
    - **Gap 3 (文学引用閲覧)** ➔ `/` コマンド動的サイレントクエリ ＋ 3層統合ナレッジカード（`<nh-knowledge-card>`）
    - **Gap 1 (ディスカバリー図鑑)** ➔ `\` コマンド拡張（発見済みアイテム真名・外見対照カタログ）
    - **Gap 2 (価格識別命名支援)** ➔ `C` コマンド拡張（店売買価格逆引きワンタップ命名アシスト）
    - **Gap 4 (手帳収集率ダッシュボード)** ➔ セッション横断の冒険手帳画面（`<nh-codex-grid>` ＆ `adventure_log.html` / `tools/save_manager.html`）
  - **WASM動的サイレントクエリ**: 静的辞書の二重持ちを排し、既存の `querySequenceSilent`（`suppressPrompts: true`）でCコアから動的抽出することで、ちらつきゼロと完全なバリアント・バージョン追従性を両立。
  - **直交レイヤー＆エンハンス・インジケーター**: 「描画表現（ASCII/タイル vs WebGPU HD-2D）」と「操作拡張（Vanilla ⇄ Enhanced）」が直交する2×2マトリクス設計。
- **マイグレーションステップ**:
  - [x] **Phase 1 (ゲーム内最優先 / Gap 3 & Gap 1 対応)**:
    - `/` コマンド向け動的ルックアップサービス（`OnDemandLookupService`）の実装
    - 統合カードコンポーネント（`<nh-knowledge-card>`）および `\` ディスカバリー連携（`<nh-discovery-codex>`）の実装
  - [x] **Phase 2 (ゲーム外ビューア / Gap 4 対応)**:
    - 独立冒険手帳画面（`<nh-codex-grid>` ＆ シルエット解禁ギャラリー `adventure_log.html`、および `SaveManager` データメンテナンス連携）の実装
    - セッション横断メタプログレッション管理（`AdventureLogManager` / `AdventureLogStorage`）配備
    - 全122テストスイート・1,469テスト100% PASSおよび4大サンプルクライアントビルド成功
  - [ ] **Phase 3 (命名アシスト / Gap 2 対応)**:
    - 店頭価格識別からのワンタップ命名アシスト（`C` / `#name`）の実装

---

## 📋 2. 構想・実装待ちバックログ (Ideas & Planned Backlog)

設計構想・アイデアが策定されており、優先度に応じて着手を待つバックログです。

### 2.1 GKL 空間幾何学認識エンジン ＆ ダンジョントラッカー
- **ステータス**: `💡 proposed` (2026-09-21 策定)
- **設計書**:
  - [Spatial_Pattern_Engine_Architecture.md](./3_gkl/Spatial_Pattern_Engine_Architecture.md) (基底エンジン)
  - [Dungeon_Tracker_and_Checkpoint_Architecture.md](./3_gkl/Dungeon_Tracker_and_Checkpoint_Architecture.md) (トラッカー仕様)
- **概要**: Cコード改変禁止ルールのもと、マップ上のグリフ配置パターン（刻み文字の並び等）をプレイヤールールによるシグナルとして検知し、全階層の宝箱・重要拠点マーカー（🚩）をセーブデータ非破壊・相乗りで管理する。
- **次のステップ**: `SpatialPatternEngine` のパターン認識コアのプロトタイプ実装

### 2.2 GKL タイムライン予測エンジン：神のご機嫌管理＆燃料計 (Prayer Tracker & Fuel Gauge)
- **ステータス**: `💡 proposed` (2026-09-25 策定)
- **設計書**: [nethack_fuel_gauge_spec.md](./7_futures/nethack_fuel_gauge_spec.md)
- **対象コード**: `src/core/knowledge/state/`, `MinimapHudRenderer.js`
- **概要**: Cコード非侵襲・セーブデータ非破壊で、メッセージシグナルから「神のご機嫌・お祈りクールダウン」を逆算エミュレートし、食料寿命・燃費消費ペース（指輪・重量負荷）・航続歩数をミニマップ周辺に可視化するタイムライン予測エンジン。Phase 5 シグナル基盤との強力な連携ショーケース。

### 2.3 啓蒙ダイアログシグナル化による隠れステータス横取り ＆ 状態精度向上構想 (Enlightenment Dialog Signal & Hidden Status Interception)
- **ステータス**: `💡 proposed` (2026-10-01 策定)
- **設計書**: [enlightenment_dialog_signal_and_state_interception_architecture.ja.md](./7_futures/enlightenment_dialog_signal_and_state_interception_architecture.ja.md)
- **関連ドキュメント**: [nethack_fuel_gauge_spec.md](./7_futures/nethack_fuel_gauge_spec.md), [message_context_and_signal_driven_architecture.ja.md](./7_futures/archive/phase5/message_context_and_signal_driven_architecture.ja.md)
- **対象コード**: `src/core/prompt/ControlSignalCatalog.js`, `src/core/knowledge/state/AttributeStateManager.js`, `src/core/knowledge/state/SkillStateManager.js`, `src/core/knowledge/engines/TacticalAdvisor.js`
- **概要**:
  - ポーション・杖・泉等による「魔法の啓蒙 (`MAGICENLIGHTENMENT`: `src/insight.c`)」ダイアログを `SIGNAL_DIALOG_ENLIGHTENMENT` として同定し、通常プレイでは不可視な隠れ情報（祈りの安全性真値、運Luck、神の怒り、獲得耐性、現在武器スキル、幸運の石効果）をGKLが自動横取り・吸収する。
  - **タイムライン予測（2.2 燃料計）との連動**: 推測カウンター（`approximateCooldown`）の誤差を確定補正（Ground Truth Calibration）し、お祈りタイマーの信頼性を100%に引き上げる。
  - **コールドスタート問題の解決**: メッセージ検知だけでは対応できない「セーブ＆再開（Resume Save）時に失われる過去の獲得耐性・状態」を、たまたまの啓蒙機会からスマートに完全同期・復元する。

### 2.4 シグナル駆動ハイブリッド翻訳 ＆ 辞書スリム化構想 (Signal-Driven Hybrid Translation Architecture)
- **ステータス**: `💡 proposed` (2026-09-29 刷新)
- **設計書**: [signal_driven_hybrid_translation_architecture.ja.md](./9_translation/signal_driven_hybrid_translation_architecture.ja.md)
- **概要**: 
  - 全文・部分検索依存の18,000行ベタ書き辞書から脱却し、**「特定シグナル専用訳（Pinpoint）」「構文テンプレート合成（Synthesized）」「構造化仮訳（Fallback）」** の3層ハイブリッド翻訳モデルを導入。
  - **特定シグナル専用訳**: 神託、神の怒り、特殊死亡、文学的言い回し・修辞、DevTeamブラックユーモアなど、NetHack特有の味・ニュアンスを `messageId` 単位（$O(1)$、誤爆率0%）で格調高い専用訳として維持。
  - **構文テンプレート合成**: 戦闘ログ・持ち物操作・飲食など、主語・目的語・道具の組み合わせ爆発を起こしている大量日常メッセージを約150件のテンプレートに集約し、GKL名詞マスタ（モンスター384体・アイテム481品）から自動注入。辞書行数を90%以上削減（18,000行 ➔ 1,000〜1,500行）。
  - **プレイヤー別名・自動呼び名フォロー**: C本体へのマルチバイト入力を完全撤廃し、UI/GKL層（`CustomNameStore`）で安全に日本語エイリアスを管理。

### 2.5 将来の完全独立マイクロカーネル化構想
- **ステータス**: `💡 proposed`
- **設計書**: [webuicore_final_architecture_vision.md](./7_futures/webuicore_final_architecture_vision.md)
- **概要**: `WebUICore` をさらに疎結合化し、`WebUIDevice`（仮想端末）と `WebUISound`（音響）を完全分離する長期ビジョン。

### 2.6 システム現有能力ギャップ解消 ＆ 未接続パイプライン結線 (➔ 1.2 Phase 7 に統合)
- **ステータス**: `🚧 in-progress (1.2 Phase 7 にて具体化・進行中)`
- **カタログ**: [SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md) (第7章 ギャップ分析)
- **概要**: 内部蓄積されているが UI と未結線な 4 大ギャップ（① ディスカバリー図鑑 UI、② 店頭売買価格識別からの自動仮名命名支援、③ WASM 文学引用の動的オンデマンド閲覧、④ セッション横断手帳収集率ダッシュボード）。
- **統合関係**: 本課題群は、**[1.2 Phase 7: 標準操作プログレッシブ拡張](#12-phase-7-標準操作プログレッシブ拡張--wasm動的ルックアップ統合ナレッジ-native-command-progressive-enhancement)** において、NetHack標準コマンド（`/`, `\`, `C`, 独立ビューア）のエンハンスメントとして包括的に設計・実装されます。

---

## 🟢 3. 実装完了コア機能・現行仕様 (Living Specs)

すでに実装が完了し、テストが通過（**全120スイート・1,440テスト 100% PASS**）しており、現在の動作の正解（Single Source of Truth）となっている機能群です。

| ドメイン | 機能・仕様書 | 主要ソースコード | 状態 | 概要 |
| :--- | :--- | :--- | :--- | :--- |
| **全体・横断** | **[SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md)** | `src/` 全体 | `🟢 implemented` | **システム現有能力カタログ＆責務境界・統廃合・ギャップ分析**<br>通信・同期、状態解析、データ・伝承、UI調停、アーキテクチャ5大原則、重複整理、未接続パイプラインの公式総合カタログ |
| **音響・調停** | [sound_coordinator_and_multidriver_architecture.ja.md](./4_sound/sound_coordinator_and_multidriver_architecture.ja.md) | `SoundCoordinator.js`<br>`SoundArbiter.js`<br>`SoundEngine.js`<br>`src/core/sound/drivers/` | `🟢 implemented` | **統合サウンドコーディネーター ＆ 音響駆動ドライバ分離 (Phase 6)**<br>照合・調停・駆動の3層完全分離。プラガブル・マルチドライバ（Wave, PsgBeep, ProceduralSynth）、Headless調停エンジン、100%後方互換ファサード |
| **音響・シンセシス** | [dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md) | `SoundEngine.js`<br>`SoundEventCatalog.js` | `🟢 implemented` | **動的音程シンセシス (Dynamic Musical Synthesis / Stage 5.6)**<br>外部音源不要(容量ゼロ)のWeb Audio APIオシレーター合成。きしむ床12音階、モンスター咆哮(ピッチベンド/和音/AM/FM/パルス)、楽器演奏・城の跳ね橋5音メロディ |
| **品質・i18n** | [stage5_5_quality_assurance_and_i18n.ja.md](./7_futures/archive/phase5/stage5_5_quality_assurance_and_i18n.ja.md) | `MessageContextResolver.js`<br>`tests/unit/robustness.test.js` | `🟢 implemented` | **言語非依存ロジック確立と総合品質保証 (Stage 5.5)**<br>二重キーワード完全根絶、多言語拡張ファクトリ（`createForVariant`）、翻訳非依存テスト実証、全1,300テスト・全クライアントビルド100%成功 |
| **音響・状態** | [stage5_4_domain_modules_migration.ja.md](./7_futures/archive/phase5/stage5_4_domain_modules_migration.ja.md) | `SoundEngine.js`<br>`AttributeStateManager.js`<br>`DiscoveryStateManager.js` | `🟢 implemented` | **ドメイン別既存モジュールのメッセージマスタ移行 (Stage 5.4)**<br>効果音 O(1) 決定論的発火＆スタガード遅延（60ms）、耐性マネージャ O(1) 確定更新、道具識別効果メッセージ真名自動昇格 |
| **UI・基盤** | [ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md) | `src/ui-controller/`<br>`src/components/`<br>`<nh-*>` | `🟢 implemented` | **UIController (Headless UI) ＆ Web Components 共通基盤 (Phase E)**<br>防腐層抽出（HUD・モーダルスタック・入力調停・ペーパードール・コンテナ・設定）、共通 Custom Elements（`<nh-*>`）、Nehww への逆輸入・最適化完了 |
| **UI・体験** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md)<br>[immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `FloatingMessageHud.js`<br>`MessageHistoryDrawer.js`<br>`MainViewportRenderer.js`<br>`WebGPUHD2DRenderer.js`<br>`base.css` | `🟢 implemented` | **GKL レファレンスクライアント (Nehww) UI/UX 刷新 (Phase A〜D)**<br>全画面マップ（100vw×100vh）、フローティング最新行HUD＋過去ログドロワー、足元枠3Dパース吸着、スマートContextActions、Neo-Retro Dark Glass UI統一 |
| **UI・デザイン** | [dialog_design_system_unification_concept.ja.md](./2_client_ui/dialog_design_system_unification_concept.ja.md) | `base.css`<br>`modals.css`<br>各種モーダル CSS | `🟢 implemented` | **モーダル・ダイアログ群デザインシステム統一 (Dark Glass UI)**<br>デザイントークン一元化（`--glass-bg`, `--glass-blur`, `--glass-border`, `--primary-color: #38bdf8`）、金枠・スレート枠のバラつき解消、全モーダル共通規格化 |
| **UI・操作性** | [modal_interaction_and_navigation_guide.ja.md](./2_client_ui/modal_interaction_and_navigation_guide.ja.md) | `src/components/`<br>`src/ui-controller/`<br>`ModalManager.js` | `🟢 guideline` | **モーダル操作性＆ナビゲーション統合設計ガイド**<br>完全キーボード/パッド完結（3大アクセシビリティ）、3大レイアウトトポロジー（縦リスト/2Dグリッド/2ペイン複合）、3層協調アーキテクチャ（入力・Headless・描画） |
| **メッセージ** | [immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `WebUICore.js`<br>`NetHackWasmDriver.js` | `🟢 implemented` | **メッセージライフサイクル＆抑止制御**<br>モーダル（アイテム選択等）中のメッセージ抑止（`suppressMessage`）、構造化ログ（`bubbleMessage`, `messageItem`, `messageUpdate`）の一元配信 |
| **対話・制御** | [stage5_3_interaction_context_and_actions.ja.md](./7_futures/archive/phase5/stage5_3_interaction_context_and_actions.ja.md) | `InteractionContext.js`<br>`ActionSignalResolver.js`<br>`SituationCache.js` | `🟢 implemented` | **対話コンテキスト ＆ アクション導出基盤 (Stage 5.3)**<br>空間距離維持（チェビシェフ距離 $\le 1$）による対話維持、施錠箱・扉へのワンタップ推奨アクション（IRCレシピ連携） |
| **メッセージ** | [stage5_2_situation_signals.ja.md](./7_futures/archive/phase5/stage5_2_situation_signals.ja.md) | `MessageContextResolver.js`<br>`ContextFrameBuffer.js`<br>`build_message_context_catalog.py` | `🟢 implemented` | **状況シグナル基盤 (第1層) ＆ 実行時コンテキスト照合 (Stage 5.2)**<br>完全ASCII軽量カタログ(154.3KB)、三項演算子展開＆ノイズ排除、超高速同定(平均 0.0054ms)、翻訳責務完全分離 |
| **伝承・GKL** | [stage5_1_lore_gkl_migration.ja.md](./7_futures/archive/phase5/stage5_1_lore_gkl_migration.ja.md) | `src/core/knowledge/lore/`<br>`GKLPlugin.js` | `🟢 implemented` | **LORE / Codex の GKL 移設と責務純化 (Stage 5.1)**<br>`WebUICore` からのシグナルPub/Sub化、後方互換プロキシ委譲、知識層へのドメイン集約 |
| **操作・UI** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `CharacterIntroModal.js`<br>`ModalManager.js` | `🟢 implemented` | **ゲーム開始導入フロー最適化 (Phase C)**<br>冒険者名入力の中央カード化・ランダムネーム生成・3大作成モードカード（おまかせ/手動/即開始）連携 |
| **画面・描画** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `WebGPUHD2DRenderer.js`<br>`MainViewportRenderer.js` | `🟢 implemented` | **自キャラ足元枠 Middle レイヤー最適化 ＆ 3D パース吸着 (Phase A)**<br>床面 $Y=0.01$ (Layer 3.2) 配置、深度テストによる自然な足元表現、ターゲットカーソル立体結線枠 |
| **画面・描画** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `WebGPUHD2DRenderer.js`<br>`MainViewportRenderer.js`<br>`glyphClassifier.js` | `🟢 implemented` | **Pet / Ridden / piletop 視覚的強調 (Phase A)**<br>統一ミニバッジ (♥ / R / +)、Middle レイヤー (Layer 3.3) 足元サークル描画 |
| **操作・UI** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `FloatingContextActions.js`<br>`DirectionPad.js`<br>`main.js` | `🟢 implemented` | **スマート ContextActions フローティングメニュー (Phase B)**<br>マップクリック対象（敵/足元/地形）直上ポップアップ、移動暴発抑止、右クリック標準化 |
| **GKL / UI** | - | `KnowledgeDetailModal.js` | `🟢 implemented` | **詳細ナレッジモーダル (KnowledgeDetailModal)**<br>サイドパネルのコンパクト化、クリック時の専用詳細モーダル（危険度・戦術・ステータス・効果） |
| **伝承・GKL** | [Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md](./3_gkl/Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md) | `LoreMasterData.js`<br>`CodexModal.js`<br>`enrich_lore_entities.js`<br>`lore_codex.html` | `🟢 implemented` | **伝承・構造化知識クロスリファレンス (Lore Cross-Ref)**<br>Rumors/Oraclesとモンスター・アイテム相互紐付け、Codexミニスペック連携、キュレーションツール |
| **画面・描画** | [unified_renderer_and_screen_architecture_plan.md](./2_client_ui/unified_renderer_and_screen_architecture_plan.md) | `VirtualDungeonScreen.js`<br>`MainViewportRenderer.js`<br>`MinimapHudRenderer.js` | `🟢 implemented` | **仮想スクリーン統合レンダラー (Phase 1〜3)**<br>オフスクリーン統合、フォーカス追従、ミニマップスマート自動退避 |
| **画面・描画** | [webgpu_hd2d_diorama_renderer.ja.md](./2_client_ui/webgpu_hd2d_diorama_renderer.ja.md) | `WebGPUHD2DRenderer.js` | `🟢 implemented` | **WebGPU HD-2D ジオラマレンダラー**<br>生WGSLシェーダー、クオータビュー、動的ランタン視界、テスト完備 |
| **伝承・考古学** | - | `src/core/knowledge/lore/LoreCodex.js`<br>`src/core/knowledge/lore/LoreDetector.js`<br>`LoreModal.js` | `🟢 implemented` | **冒険手帳・伝承図鑑 (RUMOR & LORE CODEX)**<br>噂・神託・墓碑銘のアンロックとモーダル閲覧UI |
| **伝承・考古学** | - | `EngravingArchaeologist.js`<br>`EngravingHud.js`<br>`ElberethAnalyzer.js` | `🟢 implemented` | **床文字考古学復元 (Engraving)**<br>かすれ文字推測、Elbereth結界判定、HUDバナー、再刻みボタン |
| **操作・操作性** | [PLAYER_GUIDE.md](../examples/gkl-pure-js-client/PLAYER_GUIDE.md) | `DirectionPad.js`<br>(全5種クライアント) | `🟢 implemented` | **方向パッド (DirectionPad) コンテキスト操作**<br>長押し移動、ダブルタップダッシュ、全クライアント展開 |
| **GKL** | [Equipment_Paperdoll_and_Dependency_Architecture.md](./3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md) | `src/core/knowledge/equipment/`<br>`PaperdollModal.js` | `🟢 implemented` | **装備ペーパードールUI ＆ 換装プランナー (Phase 1〜3)**<br>3層構造解析、換装シミュレーション、部位スロットUI |
| **GKL** | [Encumbrance_and_Weight_Management_Architecture.md](./3_gkl/Encumbrance_and_Weight_Management_Architecture.md) | `src/core/knowledge/state/`<br>`EncumbrancePresenter.js` | `🟢 implemented` | **インベントリ重量・負荷状態管理**<br>総重量計算、プログレスゲージ、リスク状態ランプ |
| **UI / 支援** | [gkl_intelligent_ui_ideas.ja.md](./7_futures/archive/gkl_intelligent_ui_ideas.ja.md) | `CharacterCreationModal.js`<br>`WriteModal.js`<br>`WishModal.js`<br>`GenocideModal.js`<br>`PolymorphModal.js` | `🟢 implemented` | **インテリジェント入力支援ダイアログ群**<br>キャラ作成、巻物書き込み、願い、虐殺、変化制御の専用GUI |
| **GKL / UI** | [Container_Interaction_Specification_IRC.md](./3_gkl/Container_Interaction_Specification_IRC.md) | `src/core/container/`<br>`ContainerModal.js` | `🟢 implemented` | **二画面ファイラー型コンテナUI (IRC & SafetyGuard)**<br>アトミック出し入れ、手品袋爆発防止、金貨対応 |
| **GKL** | [TacticalAdvisor_Specification_and_Architecture.md](./3_gkl/TacticalAdvisor_Specification_and_Architecture.md) | `src/core/knowledge/engines/`<br>`TacticalAdvisor.js` | `🟢 implemented` | **データ駆動型戦術アドバイザー**<br>危険モンスター警告、狂犬病(Lycanthropy)対策等 |
| **GKL** | [Assist_Signal_and_Stance_Architecture.md](./3_gkl/Assist_Signal_and_Stance_Architecture.md) | `src/core/knowledge/engines/`<br>`AssistSignalSynthesizer.js` | `🟢 implemented` | **スタンス・アシストシグナル合成** |
| **GKL** | [gkl_documentation.md](./3_gkl/gkl_documentation.md) | `src/core/knowledge/` | `🟢 implemented` | **GKL 総合アーキテクチャ・プラグイン構造** |
| **GKL** | [GKL_Visual_FX_Event_Architecture.md](./3_gkl/GKL_Visual_FX_Event_Architecture.md) | `src/core/knowledge/` | `🟢 implemented` | **視覚演出 (Visual FX) イベントアーキテクチャ** |
| **GKL** | [GKL_Structured_Knowledge_Usage_Guide.md](./3_gkl/GKL_Structured_Knowledge_Usage_Guide.md) | `src/core/knowledge/data/` | `🟢 implemented` | **構造化知識ベース (384体・481アイテム・アーティファクト)** |
| **Core / UI** | [Interactive_Request_Controller_Architecture_and_Roadmap.md](./2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md) | `src/core/request/` | `🟢 implemented` | **連続リクエストコントローラ (IRC) ＆ 制御シグナル同定基盤** |
| **Core / UI** | [WebUICore_Usage_Guide.md](./2_client_ui/WebUICore_Usage_Guide.md) | `src/core/WebUICore.js` | `🟢 implemented` | **WebUICore 利用ガイド** |
| **Driver** | [driver_core_spec.md](./1_driver/driver_core_spec.md) | `src/driver/NetHackWasmDriver.js` | `🟢 implemented` | **Web Worker WASM コア駆動ドライバ** |
| **Sound** | [sound_system_spec.md](./4_sound/sound_system_spec.md) | `src/sound/` | `🟢 implemented` | **Web Audio API サウンドシステム** |
| **Testing** | [README.md (テストガイド)](./8_testing/README.md) | `tests/` | `🟢 implemented` | **Vitest 全自動テスト基盤 (全111スイート・1,355テスト 100% PASS)** |
| **Translation** | [DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md) | `dictionary.csv`, `tools/` | `🟢 implemented` | **翻訳辞書・CSV相互変換運用ガイド** |

---

## 📦 4. 完了済みマイルストーン・アーカイブ記録 (Completed Milestones & Archives)

過去の検討経緯や完了済みプロジェクトレポート、旧アーキテクチャ資料です。

- **直近引き継ぎ・状況評価レポート**:
  - **[handover_20260929_status_reevaluation.ja.md](./6_project_reports/handover_20260929_status_reevaluation.ja.md)** (Phase E / Phase 5 完遂、Web Audio API 動的音程シンセシス、現有能力カタログ、1,300テスト通過)
  - [handover_20260921_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260921_status_reevaluation.ja.md) (レンダラー統合、WebGPU HD-2D、LORE、ペーパードール完成)
  - [handover_20260914_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260914_status_reevaluation.ja.md) (IRC基盤、コンテナUI完成)
- **アーキテクチャ意思決定**: [ArchitectureDecisionRecord.md](./3_gkl/ArchitectureDecisionRecord.md) (`📦 record`)
- **各カテゴリのアーカイブフォルダ**:
  - `docs/1_driver/archive/`: 旧ロードマップ・C層Shim調査メモ
  - `docs/2_client_ui/archive/`: 旧入力仕様、UI Decoupling設計、キャンバス描画分析等
  - `docs/3_gkl/archive/`: 旧SSOT統合計画、初期コンテナUI設計書等
  - `docs/6_project_reports/archive/`: 過去の引き継ぎ資料・進捗報告書群（9月中旬以前・ドライバ改善記録）
  - `docs/8_testing/archive/`: 旧テスト基盤刷新ロードマップ等
  - `docs/9_translation/archive/`: 旧翻訳フロー、旧次世代翻訳拡張計画（かすれ文字・Unicodeシム）、Inspector統合計画等

---

## 🛠️ ドキュメントの保守・運用フロー（AIペアプロ連携）

1. **💡 アイデアが浮かんだら**:
   - `docs/7_futures/` または該当カテゴリに `status: proposed` で構想メモを作成。
   - 本ロードマップの「構想・実装待ちバックログ」にリンクと1行要約を追記。
2. **🚧 実装を開始したら**:
   - 本ロードマップで `🔥 直近フォーカス・移行計画 (Active Plan)` に移動し、タスクチェックリストを管理。
3. **🟢 実装が完了したら**:
   - 仕様部分を現行仕様書として整理し、`status: implemented` に更新。
   - 本ロードマップの「実装完了コア機能 (Living Specs)」テーブルへ移動。
   - 一時的な移行メモや作業ログは各カテゴリの `archive/` へ退避。
