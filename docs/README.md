# 📚 NetHack WASM WebUI ドキュメントポータル

> [!TIP]
> **🚀 プロジェクト全体の進捗状況・構想バックログはこちら**  
> 現在進行中のタスク（WIP）、実装待ちの構想一覧（Backlog）、実装完了仕様（Living Specs）は **[総合ロードマップ＆進捗ダッシュボード (ROADMAP.md)](./ROADMAP.md)** にて一元管理されています。

本ディレクトリには、NetHack WASM WebUI プロジェクトのアーキテクチャ、コア技術仕様、GKL (Game Knowledge Layer)、翻訳、サウンド、ドライバに関する公式ドキュメントが格納されています。

---

## 🏷️ ドキュメント・ライフサイクル規約

ドキュメントの鮮度と信頼性を保つため、各ドキュメントは以下の4つのステータスで分類・管理されています：
- **`💡 proposed` (構想・RFC)**: 将来構想・アイデアメモ。コード未反映。いつでも変更・破棄可能。
- **`🚧 in-progress` (進行中・計画)**: 実装中、または直近で着手予定のタスク・計画。
- **`🟢 implemented / active` (現行仕様)**: 実装完了済み。**現在のコードの挙動を示す正解（SSOT）**。
- **`📦 archived` (記録・退避)**: 完了した過去の作業ログや旧アーキテクチャ資料。

---

## 📊 メイン仕様書・ガイド ダッシュボード (Core Documents)

### 1. 🧠 GKL (Game Knowledge Layer) 仕様・設計書 (`docs/3_gkl/`)
ゲーム状態解析、構造化知識ベース（SSOT）、戦術アドバイザー、状態同期、演出に関する公式仕様書群です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[gkl_documentation.md](./3_gkl/gkl_documentation.md)** | `🟢 implemented` | `src/core/knowledge/` | GKL 総合アーキテクチャ・プラグイン構造・API利用ガイド |
| **[ArchitectureDecisionRecord.md](./3_gkl/ArchitectureDecisionRecord.md)** | `📦 archived` | `src/core/knowledge/` | GKL アーキテクチャ意思決定記録 (ADR) |
| **[TacticalAdvisor_Specification_and_Architecture.md](./3_gkl/TacticalAdvisor_Specification_and_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/TacticalAdvisor.js` | データ駆動型戦術アドバイザー（ADVICE_DEFINITIONS）設計仕様 |
| **[Assist_Signal_and_Stance_Architecture.md](./3_gkl/Assist_Signal_and_Stance_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/AssistSignalSynthesizer.js` | アシストシグナル＆スタンス（ASSIST_SIGNAL_DEFINITIONS）設計 |
| **[Container_Interaction_Specification_IRC.md](./3_gkl/Container_Interaction_Specification_IRC.md)** | `🟢 implemented` | `src/core/container/` | IRC ベース二画面コンテナ出し入れ対話仕様書 (ContainerController) |
| **[Equipment_Paperdoll_and_Dependency_Architecture.md](./3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/` | 装備ペーパードールUI ＆ 依存関係診断・換装プランナー設計仕様書 |
| **[Encumbrance_and_Weight_Management_Architecture.md](./3_gkl/Encumbrance_and_Weight_Management_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/` | インベントリ重量・負荷状態管理仕様書 (ゲージ/ランプモデル) |
| **[GKL_Visual_FX_Event_Architecture.md](./3_gkl/GKL_Visual_FX_Event_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/` | 視覚演出 (Visual FX) イベントおよび音響連携アーキテクチャ |
| **[GKL_Structured_Knowledge_Usage_Guide.md](./3_gkl/GKL_Structured_Knowledge_Usage_Guide.md)** | `🟢 implemented` | `src/core/knowledge/` | 構造化知識ベース API 利用リファレンス |
| **[Spatial_Pattern_Engine_Architecture.md](./3_gkl/Spatial_Pattern_Engine_Architecture.md)** | `💡 proposed` | - | GKL空間幾何学認識エンジン設計書 (床パターン・密集シグナル認識) |
| **[Dungeon_Tracker_and_Checkpoint_Architecture.md](./3_gkl/Dungeon_Tracker_and_Checkpoint_Architecture.md)** | `💡 proposed` | - | ダンジョン探索トラッカー＆チェックポイント（箱・旗立て🚩）構想書 |
| **[Control_Signal_and_Dedicated_UI_Architecture.md](./3_gkl/Control_Signal_and_Dedicated_UI_Architecture.md)** | `🟢 implemented` | `src/core/knowledge/` | 制御シグナル同定基盤＆専用UI連携仕様書 |
| **[📦 archive/ サブフォルダ](./3_gkl/archive/)** | `📦 archived` | - | 完了済み設計書（SSOT統合、ポストコンバット同期等）・旧資料群（11ファイル退避済） |

---

### 2. 🧪 テスト・品質保証 (`docs/8_testing/`)
Vitest による全自動単体・統合テスト基盤、プロトコル検証、実機シナリオテストに関するガイドと構想書です。

| ドキュメント | ステータス | 関連ソースコード / ツール | 概要 |
| :--- | :---: | :--- | :--- |
| **[README.md (テストガイド)](./8_testing/README.md)** | `🟢 implemented` | `tests/`, `tools/dev_tools.html` | WebUICore テストガイド（全58スイート・758テスト 100% PASS） |
| **[Testing_Modernization_Implementation_Roadmap.md](./8_testing/Testing_Modernization_Implementation_Roadmap.md)** | `🟢 implemented` | `tests/`, `src/testing/` | テスト基盤刷新ロードマップ（全5フェーズ） |
| **[Scenario_Testing_and_Event_Capture_Architecture.md](./8_testing/Scenario_Testing_and_Event_Capture_Architecture.md)** | `🟢 implemented` | `tools/scenario-recorder.html` | 下り方向：実機イベントキャプチャ＆統合シナリオ再生設計 |
| **[Sequence_Protocol_Validation_Architecture.md](./8_testing/Sequence_Protocol_Validation_Architecture.md)** | `🟢 implemented` | `tests/protocol/` | 上り方向：キーシーケンス・プロトコル3重防壁検証設計 |

---

### 3. 🌐 翻訳エンジン & 辞書運用 (`docs/9_translation/`)
リアルタイム翻訳エンジン、DevTools Inspector 連携、辞書データ運用に関するドキュメントです。

| ドキュメント | ステータス | 関連ソースコード / ツール | 概要 |
| :--- | :---: | :--- | :--- |
| **[DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md)** | `🟢 implemented` | `dictionary.csv`, `tools/dict_converter.py` | マスター翻訳辞書運用・CSV相互変換オペレーションガイド |
| **[translation_architecture_enhancement_plan.md](./9_translation/translation_architecture_enhancement_plan.md)** | `💡 proposed` | `src/core/translation/` | 翻訳システム次世代刷新構想（Category付与・かすれ文字復元・多段化） |
| **[📦 archive/ サブフォルダ](./9_translation/archive/)** | `📦 archived` | `tools/dev_scripts/` | 翻訳フロー解説、旧支援ツールガイド、Inspector統合設計、Lookup翻訳手順等（7ファイル退避済） |

---

### 4. 📦 Driver & Web Worker 仕様 (`docs/1_driver/`)
WASM Cコアをバックグラウンド Web Worker で駆動するドライバ仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[driver_core_spec.md](./1_driver/driver_core_spec.md)** | `🟢 implemented` | `src/driver/NetHackWasmDriver.js` | NetHack WASM Driver コア仕様書 |
| **[driver_api_reference.md](./1_driver/driver_api_reference.md)** | `🟢 implemented` | `src/driver/` | Web Worker 通信プロトコル・API リファレンス |
| **[driver_quickstart_guide.md](./1_driver/driver_quickstart_guide.md)** | `🟢 implemented` | `src/driver/` | ドライバ クイックスタートガイド |
| **[📦 archive/ サブフォルダ](./1_driver/archive/)** | `📦 archived` | - | 旧ロードマップ・C層Shim調査メモ等（3ファイル退避済） |

---

### 5. 💻 クライアント UI & コアエンジン (`docs/2_client_ui/`)
共通コアエンジン `WebUICore` およびフロントエンド連携仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[WebUICore_Usage_Guide.md](./2_client_ui/WebUICore_Usage_Guide.md)** | `🟢 implemented` | `src/core/WebUICore.js` | WebUICore 利用ガイド・機能仕様 |
| **[Interactive_Request_Controller_Architecture_and_Roadmap.md](./2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md)** | `🟢 implemented` | `src/core/request/` | 汎用連続リクエストコントローラ (IRC) ＆ 制御シグナル同定基盤仕様書 |
| **[PromptCategory_UI_Implementation_Guide.md](./2_client_ui/PromptCategory_UI_Implementation_Guide.md)** | `🟢 implemented` | `src/core/prompt/` | プロンプトカテゴリ分類 ＆ UI 実装ガイド |
| **[Modern_Web_Components_Update_Rules.md](./2_client_ui/Modern_Web_Components_Update_Rules.md)** | `🟢 implemented` | `src/` | モダン Web コンポーネント実装・更新規約 |
| **[gkl_inspect_cell_on_demand_guide.md](./2_client_ui/gkl_inspect_cell_on_demand_guide.md)** | `🟢 implemented` | `src/core/knowledge/OnDemandLookService.js` | セルオンデマンド照会・インスペクト実装ガイド |
| **[unified_renderer_and_screen_architecture_plan.md](./2_client_ui/unified_renderer_and_screen_architecture_plan.md)** | `🟢 implemented` | `examples/gkl-pure-js-client/modules/renderers/` | 仮想スクリーン統合レンダラー (Phase 1〜3) ＆ UI画面刷新仕様書 |
| **[📦 archive/ サブフォルダ](./2_client_ui/archive/)** | `📦 archived` | - | 入力仕様、UI Decoupling設計、描画パフォーマンス分析等（8ファイル退避済） |

---

### 6. 🔊 音響システム (`docs/4_sound/`)
Web Audio API を活用した音響・効果音再生システム仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[sound_system_spec.md](./4_sound/sound_system_spec.md)** | `🟢 implemented` | `src/sound/` | 音響・Web Audio システム仕様書 |
| **[dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md)** | `💡 proposed` | `src/sound/` | 動的音程シンセシス構想（リアルタイム周波数・楽器合成） |
| **[📦 archive/ サブフォルダ](./4_sound/archive/)** | `📦 archived` | - | C層 soundprocs Shim 調査メモ退避 |

---

### 7. 🔮 将来構想 & アーキテクチャ深化 (`docs/7_futures/`)
次期開発セッションに向けたインテリジェント UI、マイクロカーネル化、およびバリアント適応拡張の構想資料です。

| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| **[phase5_detailed_migration_plan.ja.md](./7_futures/phase5_detailed_migration_plan.ja.md)** | `🚧 in-progress` | **Phase 5 詳細設計および段階的移行手順書 (メッセージマスタ移行・WebUICore純化)** |
| **[webgpu_hd2d_diorama_renderer.ja.md](./7_futures/webgpu_hd2d_diorama_renderer.ja.md)** | `🟢 implemented` | WebGPU (WGSL) による HD-2D ジオラマレンダラー仕様＆移植ガイド（実装稼働中） |
| **[gkl_intelligent_ui_ideas.ja.md](./7_futures/gkl_intelligent_ui_ideas.ja.md)** | `🟢 implemented` | 次世代インテリジェントUI構想（虐殺・コンテナ・変化制御・魔法書き込み・キャラ作成等実装済） |
| **[gkl_variant_adaptation_architecture.md](./7_futures/gkl_variant_adaptation_architecture.md)** | `💡 proposed` | GKL バリアント適応拡張・互換性構想（メタデータ契約・リジェクト是非・分離設計） |
| **[webuicore_final_architecture_vision.md](./7_futures/webuicore_final_architecture_vision.md)** | `💡 proposed` | 将来の WebUICore 完全独立・マイクロカーネル化構想（WebUIDevice/WebUISound分離） |
| **[message_context_and_signal_driven_architecture.ja.md](./7_futures/message_context_and_signal_driven_architecture.ja.md)** | `💡 proposed` | メッセージ文脈＆シグナル駆動アーキテクチャ構想 |
| **[source_message_extraction_methodology_guide.ja.md](./7_futures/source_message_extraction_methodology_guide.ja.md)** | `🟢 implemented` | NetHack Cソースコード全メッセージ静的抽出メソドロジーガイド（14,849件抽出済） |

---

### 8. 📂 ゲームリファレンスデータ (`docs/5_gamedata/`)
ゲーム内タイル・地形・アイテム・モンスターのリファレンス資料群です。

| ドキュメント | 概要 |
| :--- | :--- |
| **[appearances.ja.md](./5_gamedata/appearances.ja.md)** | アイテム未識別外見（外観名）対訳リスト |
| **[glyph_tile_mapping.ja.md](./5_gamedata/glyph_tile_mapping.ja.md)** | Glyph ID とタイル番号の対応表 |
| **[monster_list.ja.md](./5_gamedata/monster_list.ja.md)** / **[item_list.ja.md](./5_gamedata/item_list.ja.md)** | モンスター / アイテムの日英対訳一覧 |
| **[ListofActionsbyTerrainTypeinNetHack.md](./5_gamedata/ListofActionsbyTerrainTypeinNetHack.md)** | 地形別アクション一覧リファレンス |
| **[polymorph_carrying_capacity_mechanics.ja.md](./5_gamedata/polymorph_carrying_capacity_mechanics.ja.md)** | 多重変身（Polymorph）時の運搬許容量・所持重量減少メカニズム調査資料 |
| **[Guidebook.ja.html](./5_gamedata/Guidebook.ja.html)** | NetHack 5.0 日本語公式ガイドブック |
| **[📦 archive/ サブフォルダ](./5_gamedata/archive/)** | 店主仕様・アイテム効果レポート等（3ファイル退避済） |

---

### 9. 📈 プロジェクト報告書・引き継ぎ資料 (`docs/6_project_reports/`)
開発の節目における評価レポートおよび引き継ぎ資料です。

| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| **[handover_20260921_status_reevaluation.ja.md](./6_project_reports/handover_20260921_status_reevaluation.ja.md)** | `🟢 latest` | **【最新】完了状態・ペンディング状態 再評価総合レポート（2026/09/21版）** |
| **[handover_20260914_status_reevaluation.ja.md](./6_project_reports/handover_20260914_status_reevaluation.ja.md)** | `📦 past` | 完了状態・ペンディング状態 再評価総合レポート（2026/09/14版） |
| **[notebooklm_knowledge_base.md](./6_project_reports/notebooklm_knowledge_base.md)** | `🔵 reference` | AIアシスタント・NotebookLM用ナレッジベース構築手順 |
| **[driver_improvements.md](./6_project_reports/driver_improvements.md)** | `🔵 reference` | ドライバ改善・イベントディスパッチ最適化レポート |
| **[nethack_jp_wasm_experiment.md](./6_project_reports/nethack_jp_wasm_experiment.md)** | `🔵 reference` | NetHack日本語版 (NetHackJP) WASM化実験記録 |
| **[📦 archive/ サブフォルダ](./6_project_reports/archive/)** | `📦 archived` | 開発初期〜直近の引き継ぎ資料・進捗報告書群（11ファイル退避済: 2026/09/05版含む） |

---

## 📁 ディレクトリ構造

```text
docs/
├── README.md             # ドキュメント総合ポータル（本ファイル: SSOT）
├── FAQ_and_Configuration_Guide.md # 逆引き設定・セーブデータ管理 FAQ / 開発者ガイド
├── 1_driver/             # WASM Driver 仕様書 (直下3本 + archive/)
├── 2_client_ui/          # UI / WebUICore 仕様書 (直下5本 + archive/)
├── 3_gkl/                # GKL 総合・ADR・戦術・演出・API・コンテナ・ペーパードール仕様書 (直下9本 + archive/)
├── 4_sound/              # 音響システム仕様書 (直下1本 + archive/)
├── 5_gamedata/           # ゲームリファレンスデータ群 (直下8本 + archive/)
├── 6_project_reports/    # 最新再評価レポート & プロジェクト報告書 (直下4本 + archive/)
├── 7_futures/            # 次世代インテリジェントUI・マイクロカーネル・バリアント構想 (直下3本)
├── 8_testing/            # テストガイド & ロードマップ・構想書 (直下4本)
└── 9_translation/        # 辞書運用マニュアル & 次世代刷新構想 (直下2本 + archive/)
```

