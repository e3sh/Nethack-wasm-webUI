---
title: NetHack WASM WebUI ドキュメントポータル
status: living-document
last_updated: 2026-10-11
---

# 📚 NetHack WASM WebUI ドキュメントポータル

> [!TIP]
> **🚀 プロジェクト全体の進捗状況・構想バックログはこちら**  
> 現在進行中のタスク（WIP）、実装待ちの構想一覧（Backlog）、実装完了仕様（Living Specs）は **[総合ロードマップ＆進捗ダッシュボード (ROADMAP.md)](./ROADMAP.md)** にて一元管理されています。

> [!IMPORTANT]
> **🧭 設計・開発・リファクタリング時の最重要必読インベントリ**  
> システムが現在持っている全機能、APIシグネチャ、WASM通信パイプライン（Phase 8 Direct Binding + IRC フォールバック）、データ資産（全384体モンスター・481アイテム・787件の噂）、アーキテクチャの基本憲法、および機能重複統廃合・ギャップ分析は、**[システム現有能力カタログ (SYSTEM_CAPABILITIES.md)](./SYSTEM_CAPABILITIES.md)** にて一元集約されています。新機能の検討や改修時は必ずこちらをご一読ください。

本ディレクトリには、NetHack WASM WebUI プロジェクトのアーキテクチャ、コア技術仕様、GKL (Game Knowledge Layer)、翻訳、サウンド、ドライバに関する公式ドキュメントが格納されています。

---

## 🏷️ ドキュメント・ライフサイクル規約

ドキュメントの鮮度と信頼性を保つため、各ドキュメントは以下の4つのステータスで分類・管理されています：
- **`💡 proposed` (構想・RFC)**: 将来構想・アイデアメモ。コード未反映。いつでも変更・破棄可能。
- **`🚧 in-progress / ⏸️ pending` (進行中・計画)**: 実装中、または直近で着手予定のタスク・設計書。
- **`🟢 implemented / active` (現行仕様)**: 実装完了済み。**現在のコードの挙動を示す正解（SSOT）**。
- **`📦 archived` (記録・退避)**: 完了した過去の移行計画・作業ログや旧アーキテクチャ資料（各カテゴリの `archive/` に退避）。

---

## 📊 メイン仕様書・ガイド ダッシュボード (Core Documents)

### 0. 🧭 システム現有能力カタログ ＆ 設計憲法 (`docs/SYSTEM_CAPABILITIES.md`)
システム全体の機能・API・データ資産インベントリ、責務境界、アーキテクチャ5大原則、重複機能統廃合、未接続パイプライン分析を集約した総合カタログです。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md)** | `🟢 implemented` | `src/` 全体 | システム現有能力カタログ、WASM通信・同期（Phase 8 `shim_bridge.c` / IRC）、状態解析、データ・伝承、UI制御、アーキテクチャ5大原則、統廃合・ギャップ分析 |

---

### 1. 🧠 GKL (Game Knowledge Layer) 仕様・設計書 (`docs/3_gkl/`)
ゲーム状態解析、構造化知識ベース（SSOT）、戦術アドバイザー、状態同期、演出に関する公式仕様書群です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[gkl_documentation.md](./3_gkl/gkl_documentation.md)** | `🟢 implemented` | `src/core/knowledge/` | GKL 総合アーキテクチャ・プラグイン構造・API利用ガイド |
| **[GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md](./3_gkl/GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md)** | `🚧 in-progress` | `src/core/knowledge/GKLPlugin.js` | GKLPlugin モジュール分割・アーキテクチャ適正化設計書 (ROADMAP 2.2) |
| **[floor_item_direct_binding_and_peek_wisdom_architecture.ja.md](./3_gkl/floor_item_direct_binding_and_peek_wisdom_architecture.ja.md)** | `⏸️ pending` | `AreaStateManager.js`<br>`NhKnowledgeCard.js` | 床アイテム・コンテナ・死体の Direct Binding 完全化 ＆ 覗き見知恵（Peek Wisdom）統合設計書 |
| **[AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md)** | `🟢 implemented` | `src/core/knowledge/state/AreaStateManager.js` | 空間状態総合オーケストレーター仕様書（Stage 8.3-A フロア全域ダンプ対応）＆ 4分割計画 |
| **[TacticalAdvisor_Specification_and_Architecture.md](./3_gkl/TacticalAdvisor_Specification_and_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/engines/TacticalAdvisor.js` | データ駆動型戦術アドバイザー（ADVICE_DEFINITIONS 7系統）設計仕様 |
| **[Assist_Signal_and_Stance_Architecture.md](./3_gkl/Assist_Signal_and_Stance_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/engines/AssistSignalSynthesizer.js` | アシストシグナル＆スタンス（ASSIST_SIGNAL_DEFINITIONS）設計 |
| **[Container_Interaction_Specification_IRC.md](./3_gkl/Container_Interaction_Specification_IRC.md)** | `🟢 implemented` | `src/core/container/` | IRC ベース二画面コンテナ出し入れ対話仕様書 (`ContainerController`) |
| **[Equipment_Paperdoll_and_Dependency_Architecture.md](./3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/equipment/` | 装備ペーパードールUI ＆ 依存関係診断・換装プランナー設計仕様書（Stage 8.2-C 装備ポインタ直結対応） |
| **[Encumbrance_and_Weight_Management_Architecture.md](./3_gkl/Encumbrance_and_Weight_Management_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/state/EncumbranceStateManager.js` | インベントリ重量・負荷状態管理仕様書（Stage 8.2-C 真の重量直結対応） |
| **[GKL_Visual_FX_Event_Architecture.md](./3_gkl/GKL_Visual_FX_Event_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/` | 視覚演出 (Visual FX) イベントおよび音響連携アーキテクチャ |
| **[GKL_Structured_Knowledge_Usage_Guide.md](./3_gkl/GKL_Structured_Knowledge_Usage_Guide.md)** | `🟢 implemented` | `src/core/knowledge/` | 構造化知識ベース API 利用リファレンス（5段階識別モデル・適応型スペック） |
| **[Control_Signal_and_Dedicated_UI_Architecture.md](./3_gkl/Control_Signal_and_Dedicated_UI_Architecture.md)** | `🟢 implemented` | `src/core/prompt/` | 制御シグナル同定基盤＆専用UI連携仕様書 |
| **[Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md](./3_gkl/Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md)** | `🟢 implemented` | `src/core/knowledge/lore/` | 伝承・構造化知識クロスリファレンス設計仕様書 (Rumor/Oracleとモンスター/アイテム紐付け) |
| **[Branch_Detection_and_Area_Announcement_Architecture.ja.md](./3_gkl/Branch_Detection_and_Area_Announcement_Architecture.ja.md)** | `💡 proposed` | - | GKL ブランチ検出・フロアキャッシュ分離 ＆ エリア突入アナウンス演出設計書 (Stage 8.4 連動) |
| **[Spatial_Pattern_Engine_Architecture.md](./3_gkl/Spatial_Pattern_Engine_Architecture.md)** | `💡 proposed` | - | GKL空間幾何学認識エンジン設計書 (床パターン・密集シグナル認識) |
| **[Dungeon_Tracker_and_Checkpoint_Architecture.md](./3_gkl/Dungeon_Tracker_and_Checkpoint_Architecture.md)** | `💡 proposed` | - | ダンジョン探索トラッカー＆チェックポイント（箱・旗立て🚩）構想書 |
| **[📦 archive/ サブフォルダ](./3_gkl/archive/)** | `📦 archived` | - | ADR（意思決定記録）、完了済み設計書（SSOT統合、ポストコンバット同期等）・旧資料群（15ファイル退避済） |

---

### 2. 🧪 テスト・品質保証 (`docs/8_testing/`)
Vitest による全自動単体・統合テスト基盤、プロトコル検証、実機シナリオテストに関するガイドと仕様書です。

| ドキュメント | ステータス | 関連ソースコード / ツール | 概要 |
| :--- | :---: | :--- | :--- |
| **[README.md (テストガイド)](./8_testing/README.md)** | `🟢 implemented` | `tests/`, `tools/dev_tools.html` | WebUICore テストガイド（**全136スイート・1,670テスト 100% PASS**） |
| **[Scenario_Testing_and_Event_Capture_Architecture.md](./8_testing/Scenario_Testing_and_Event_Capture_Architecture.md)** | `🟢 implemented` | `tools/scenario-recorder.html` | 下り方向：実機イベントキャプチャ＆統合シナリオ再生仕様書 |
| **[Sequence_Protocol_Validation_Architecture.md](./8_testing/Sequence_Protocol_Validation_Architecture.md)** | `🟢 implemented` | `tests/protocol/` | 上り方向：キーシーケンス・プロトコル3重防壁検証仕様書 |
| **[📦 archive/ サブフォルダ](./8_testing/archive/)** | `📦 archived` | `tests/` | 完了したテスト基盤刷新ロードマップ（全5フェーズ）等の過去移行計画を退避（2ファイル退避済） |

---

### 3. 🌐 翻訳エンジン & 辞書運用 (`docs/9_translation/`)
リアルタイム翻訳エンジン、DevTools Inspector 連携、辞書データ運用に関するドキュメントです。

| ドキュメント | ステータス | 関連ソースコード / ツール | 概要 |
| :--- | :---: | :--- | :--- |
| **[DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md)** | `🟢 implemented` | `dictionary.csv`, `tools/dict_converter.py` | マスター翻訳辞書運用・Inspector未翻訳収集・CSV相互変換オペレーションガイド |
| **[signal_driven_hybrid_translation_architecture.ja.md](./9_translation/signal_driven_hybrid_translation_architecture.ja.md)** | `💡 proposed` | `src/core/translation/` | シグナル駆動ハイブリッド翻訳＆辞書スリム化構想（Pinpoint/Synthesized/Fallback 3層モデル） |
| **[📦 archive/ サブフォルダ](./9_translation/archive/)** | `📦 archived` | `tools/dev_scripts/` | 翻訳フロー解説、旧支援ツールガイド、Inspector統合設計、Lookup翻訳手順等（7ファイル退避済） |

---

### 4. 📦 Driver & Web Worker 仕様 (`docs/1_driver/`)
WASM Cコアをバックグラウンド Web Worker で駆動し、Phase 8 単一窓口 `shim_bridge.c` でメモリ直結を行うドライバ仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[official_shim_direct_binding_implementation_plan.md](./1_driver/official_shim_direct_binding_implementation_plan.md)** | `🚧 in-progress` | `src/driver/shim/shim_bridge.c`<br>`WasmDirectBindingService.js` | **Phase 8: 公式Shim構造化バインディング ＆ C構造体メモリ直結 実装計画書** (Stage 8.1〜8.3-A 完了) |
| **[direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md](./1_driver/direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md)** | `⏸️ pending` | `src/driver/`<br>`WasmDirectBindingService.js` | Direct Binding (`CALL_SHIM`) アイドリング調停 ＆ `--More--` 待機・メッセージライフサイクル是正計画 (ROADMAP 2.5) |
| **[driver_core_spec.md](./1_driver/driver_core_spec.md)** | `🟢 implemented` | `src/driver/NetHackWasmDriver.js` | NetHack WASM Driver コア仕様書（Phase 8 `shim_bridge.c` / ターン静止調停含む） |
| **[driver_api_reference.md](./1_driver/driver_api_reference.md)** | `🟢 implemented` | `src/driver/` | Web Worker 通信プロトコル・Direct Binding RPC (`callShim`)・API リファレンス |
| **[driver_quickstart_guide.md](./1_driver/driver_quickstart_guide.md)** | `🟢 implemented` | `src/driver/` | ドライバ クイックスタートガイド |
| **[nethack_version_upgrade_guide.ja.md](./1_driver/nethack_version_upgrade_guide.ja.md)** | `🟢 implemented` | `scripts/build_wasm_50.ps1`<br>`src/driver/shim/shim_bridge.c` | NetHack バージョン更新・WASM 再ビルド引継ぎガイド |
| **[📦 archive/ サブフォルダ](./1_driver/archive/)** | `📦 archived` | - | 公式Shim能力解析書、Stage 8.2-B 検証環境計画書、旧ロードマップ・C層Shim調査メモ等（5ファイル退避済） |

---

### 5. 💻 クライアント UI & コアエンジン (`docs/2_client_ui/`)
共通コアエンジン `WebUICore`、Headless UIController、共通 Web Components、およびレンダラー仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[shim_driven_rendering_pipeline_architecture.ja.md](./2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md)** | `🚧 in-progress` | `AreaStateManager.js`<br>`VirtualDungeonScreen.js` | Shim-Driven 確定同期型レンダリング・パイプライン刷新設計書 (Stage 8.3-B) |
| **[ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md)** | `🟢 implemented` | `src/ui-controller/`<br>`src/components/`<br>`<nh-*>` | UIController (Headless UI) アーキテクチャ設計仕様書（Model/View完全分離・Web Components共通基盤・Phase E） |
| **[immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md)** | `🟢 implemented` | `FloatingMessageHud.js`<br>`MessageHistoryDrawer.js` | イマーシブHUD ＆ 過去ログドロワーメッセージウィンドウ仕様書 (Phase D) |
| **[modal_interaction_and_navigation_guide.ja.md](./2_client_ui/modal_interaction_and_navigation_guide.ja.md)** | `🟢 implemented` | `src/components/`<br>`src/ui-controller/` | モーダル操作性＆ナビゲーション統合設計ガイド (キーボード/パッド完結・3層協調) |
| **[WebUICore_Usage_Guide.md](./2_client_ui/WebUICore_Usage_Guide.md)** | `🟢 implemented` | `src/core/WebUICore.js` | WebUICore 利用ガイド・機能仕様（Phase 5〜8 イベント・Direct Binding 対応） |
| **[Interactive_Request_Controller_Architecture_and_Roadmap.md](./2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md)** | `🟢 implemented` | `src/core/request/` | 汎用連続リクエストコントローラ (IRC) ＆ 制御シグナル同定基盤仕様書 |
| **[PromptCategory_UI_Implementation_Guide.md](./2_client_ui/PromptCategory_UI_Implementation_Guide.md)** | `🟢 implemented` | `src/core/prompt/` | プロンプトカテゴリ分類 ＆ UI 実装ガイド (`WRITE`, `CHARACTER_INTRO` 含む) |
| **[gkl_inspect_cell_on_demand_guide.md](./2_client_ui/gkl_inspect_cell_on_demand_guide.md)** | `🟢 implemented` | `src/core/knowledge/services/OnDemandLookService.js` | セルオンデマンド照会・インスペクト実装ガイド |
| **[unified_renderer_and_screen_architecture_plan.md](./2_client_ui/unified_renderer_and_screen_architecture_plan.md)** | `🟢 implemented` | `examples/gkl-pure-js-client/modules/renderers/` | 仮想スクリーン統合レンダラー (`VirtualDungeonScreen` / `MainViewportRenderer` / `MinimapHudRenderer`) 仕様書 |
| **[webgpu_hd2d_diorama_renderer.ja.md](./2_client_ui/webgpu_hd2d_diorama_renderer.ja.md)** | `🟢 implemented` | `WebGPUHD2DRenderer.js` | WebGPU (WGSL) による HD-2D ジオラマレンダラー仕様＆移植ガイド（3Dパース吸着・ミニバッジ対応） |
| **[📦 archive/ サブフォルダ](./2_client_ui/archive/)** | `📦 archived` | - | GKLクライアントUI刷新計画(Phase A〜D)、main.jsモジュール分割計画、ダイアログデザイン統一構想、Web Components規約等（12ファイル退避済） |

---

### 6. 🔊 音響システム (`docs/4_sound/`)
Web Audio API を活用した 3 層分離サウンドコーディネーター ＆ マルチドライバ音響再生システム仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[sound_coordinator_and_multidriver_architecture.ja.md](./4_sound/sound_coordinator_and_multidriver_architecture.ja.md)** | `🟢 implemented` | `src/core/sound/` | **統合サウンドコーディネーター ＆ 音響駆動ドライバ分離アーキテクチャ仕様書 (Phase 6)**（Wave / PsgBeep LFO・MML / ProceduralSynth） |
| **[dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md)** | `🟢 implemented` | `ProceduralSynthDriver.js`<br>`SoundEventCatalog.js` | 動的音程シンセシス仕様書 (Web Audio API オシレーター6大合成・容量ゼロ / Stage 5.6) |
| **[📦 archive/ サブフォルダ](./4_sound/archive/)** | `📦 archived` | - | 旧 SoundEngine 単一クラス仕様書 (`sound_system_spec.md`)、C層 soundprocs 調査メモ（2ファイル退避済） |

---

### 7. 🔮 将来構想 & アーキテクチャ深化 (`docs/7_futures/`)
進行中の Phase 7 機能群および Phase 8 直結を活用する次期機能・長期構想資料です。

| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| **[native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md)** | `🚧 in-progress` | **標準操作プログレッシブ拡張 ＆ WASM動的ルックアップ統合ナレッジ仕様書 (Phase 7)**（Phase 1・2 実装完了、Phase 3 命名アシスト待機中） |
| **[post_mortem_knowledge_and_tactical_advisor_redesign.ja.md](./7_futures/post_mortem_knowledge_and_tactical_advisor_redesign.ja.md)** | `🚧 in-progress` | **事後ナレッジ連携 ＆ 戦術アドバイザー刷新仕様書**（`scoreboard.html` / `PostMortemKnowledgeResolver.js` 実装完了、残タスク待機中） |
| **[modern_inventory_dialog_and_weight_analytics_architecture.ja.md](./7_futures/modern_inventory_dialog_and_weight_analytics_architecture.ja.md)** | `💡 proposed` | モダン総合インベントリダイアログ ＆ 重量アナリティクス構想 (`i`キー専用2ペイン所持品コックピット) |
| **[floor_pile_filer_and_dialog_navigation_architecture.ja.md](./7_futures/floor_pile_filer_and_dialog_navigation_architecture.ja.md)** | `💡 proposed` | 足元山積み（Floor Pile）の二画面ファイラー統合 ＆ ダイアログ操作系（Key/Pad）完全統一構想 |
| **[nethack_fuel_gauge_spec.md](./7_futures/nethack_fuel_gauge_spec.md)** | `💡 proposed` | GKL タイムライン予測エンジン：神のご機嫌管理＆燃料計構想書 (`ublesscnt` / 耐性メモリ直結連動) |
| **[enlightenment_dialog_signal_and_state_interception_architecture.ja.md](./7_futures/enlightenment_dialog_signal_and_state_interception_architecture.ja.md)** | `💡 proposed` | 啓蒙ダイアログ専用モーダルUI化 ＆ 隠れステータス補正構想 |
| **[external_wiki_knowledge_linking_architecture.ja.md](./7_futures/external_wiki_knowledge_linking_architecture.ja.md)** | `💡 proposed` | 外部ナレッジ連携 (NetHackWiki) ＆ 翻訳モード連動 Web ジャンプ構想 |
| **[help_dialog_and_external_doc_system_architecture.ja.md](./7_futures/help_dialog_and_external_doc_system_architecture.ja.md)** | `💡 proposed` | ヘルプ専用ダイアログ化 (`HelpGuideModal`) ＆ 外部ドキュメント連携構想 |
| **[gamepad/ (ゲームパッド構想群)](./7_futures/gamepad/README.md)** | `💡 proposed` | ゲームパッド・コンソールモード仕様（共通コンポーネント・`console-client` PoC 実装完了、Nehww オンデマンド統合構想） |
| **[gkl_variant_adaptation_architecture.md](./7_futures/gkl_variant_adaptation_architecture.md)** | `💡 proposed` | GKL バリアント適応拡張・互換性構想（メタデータ契約・分離設計） |
| **[📦 archive/ サブフォルダ](./7_futures/archive/)** | `📦 archived` | 完遂済み Phase 5 詳細計画群（全6ステージ）、旧マイクロカーネル構想、旧Gamepad独立クライアント構想等（15ファイル退避済） |

---

### 8. 📂 ゲームリファレンスデータ (`docs/5_gamedata/`)
ゲーム内タイル・地形・アイテム・モンスターのリファレンス資料群です。

| ドキュメント | 概要 |
| :--- | :--- |
| **[appearances.ja.md](./5_gamedata/appearances.ja.md)** | アイテム未識別外見（外観名）対訳リスト |
| **[glyph_tile_mapping.ja.md](./5_gamedata/glyph_tile_mapping.ja.md)** / **[tilemappings.lst](./5_gamedata/tilemappings.lst)** | Glyph ID とタイル番号の対応表・NetHack 5.0.1 タイルマッピング定義 (2,307タイル) |
| **[monster_list.ja.md](./5_gamedata/monster_list.ja.md)** / **[item_list.ja.md](./5_gamedata/item_list.ja.md)** | モンスター (384体) / アイテム (481種) の日英対訳一覧 |
| **[ListofActionsbyTerrainTypeinNetHack.md](./5_gamedata/ListofActionsbyTerrainTypeinNetHack.md)** | 地形別アクション一覧リファレンス |
| **[polymorph_carrying_capacity_mechanics.ja.md](./5_gamedata/polymorph_carrying_capacity_mechanics.ja.md)** | 多重変身（Polymorph）時の運搬許容量・所持重量減少メカニズム調査資料 |
| **[Guidebook.ja.html](./5_gamedata/Guidebook.ja.html)** / **[Guidebook.txt](./5_gamedata/Guidebook.txt)** | NetHack 5.0 日本語公式ガイドブック / 英語原文ガイドブック |
| **[📦 archive/ サブフォルダ](./5_gamedata/archive/)** | 店主仕様・アイテム効果レポート等（3ファイル退避済） |

---

### 9. 📈 プロジェクト報告書・引き継ぎ資料 (`docs/6_project_reports/`)
開発の節目における評価レポートおよび引き継ぎ資料です。

| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| **[handover_20261008_status_reevaluation.ja.md](./6_project_reports/handover_20261008_status_reevaluation.ja.md)** | `🟢 latest` | **【最新】NetHack 5.0.1 移行・Phase 6/7 完遂・Phase 8 始動 現有能力再評価総合レポート（2026/10/08版）** |
| **[📦 archive/ サブフォルダ](./6_project_reports/archive/)** | `📦 archived` | 過去の引き継ぎ資料（09/29版、09/21版、09/14版等）・進捗報告書群・不具合是正計画書（21ファイル退避済） |

---

## 📁 ディレクトリ構造

```text
docs/
├── README.md                       # ドキュメント総合ポータル（本ファイル: SSOT）
├── ROADMAP.md                      # 総合ロードマップ＆進捗ダッシュボード
├── SYSTEM_CAPABILITIES.md          # システム現有能力カタログ＆アーキテクチャ5大原則
├── FAQ_and_Configuration_Guide.md  # 逆引き設定・セーブデータ管理 FAQ / 開発者ガイド
├── 1_driver/                       # WASM Driver & Phase 8 Direct Binding 仕様書 (直下6本 + archive/)
├── 2_client_ui/                    # UI / WebUICore / レンダラー仕様書 (直下10本 + archive/)
├── 3_gkl/                          # GKL 総合・戦術・空間・装備・コンテナ仕様書 (直下16本 + archive/)
├── 4_sound/                        # 音響コーディネーター & 動的シンセシス仕様書 (直下2本 + archive/)
├── 5_gamedata/                     # ゲームリファレンスデータ群 (直下9本 + archive/)
├── 6_project_reports/              # 最新再評価レポート(1008版) & プロジェクト報告書 (直下1本 + archive/)
├── 7_futures/                      # 次世代構想・Phase 7 (直下9本 + gamepad/ + archive/)
├── 8_testing/                      # テストガイド & プロトコル/シナリオ検証仕様書 (直下3本 + archive/)
└── 9_translation/                  # 辞書運用マニュアル & ハイブリッド翻訳構想 (直下2本 + archive/)
```

