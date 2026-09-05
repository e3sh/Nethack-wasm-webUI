# 📚 NetHack WASM WebUI ドキュメントポータル

本ディレクトリには、NetHack WASM WebUI プロジェクトのアーキテクチャ、コア技術仕様、GKL (Game Knowledge Layer)、翻訳、サウンド、ドライバに関する公式ドキュメントが格納されています。

各ディレクトリ直下には**「現在アクティブに参照・運用されるメイン仕様書・ガイド」**を配置しており、過去の開発メモや移行完了済みの旧設計資料は各フォルダ内の `archive/` へ整理・退避されています。

---

## 📊 メイン仕様書・ガイド ダッシュボード (Core Documents)

### 1. 🧠 GKL (Game Knowledge Layer) 仕様・設計書 (`docs/3_gkl/`)
ゲーム状態解析、構造化知識ベース（SSOT）、戦術アドバイザー、状態同期、演出に関する公式仕様書群です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[gkl_documentation.md](./3_gkl/gkl_documentation.md)** | `🟢 active` | `src/core/knowledge/` | GKL 総合アーキテクチャ・プラグイン構造・API利用ガイド |
| **[ArchitectureDecisionRecord.md](./3_gkl/ArchitectureDecisionRecord.md)** | `🟢 active` | `src/core/knowledge/` | GKL アーキテクチャ意思決定記録 (ADR) |
| **[TacticalAdvisor_Specification_and_Architecture.md](./3_gkl/TacticalAdvisor_Specification_and_Architecture.md)** | `🟢 active` | `src/core/knowledge/TacticalAdvisor.js` | データ駆動型戦術アドバイザー（ADVICE_DEFINITIONS）設計仕様 |
| **[Assist_Signal_and_Stance_Architecture.md](./3_gkl/Assist_Signal_and_Stance_Architecture.md)** | `🟢 active` | `src/core/knowledge/AssistSignalSynthesizer.js` | アシストシグナル＆スタンス（ASSIST_SIGNAL_DEFINITIONS）設計 |
| **[GKL_Visual_FX_Event_Architecture.md](./3_gkl/GKL_Visual_FX_Event_Architecture.md)** | `🟢 active` | `src/core/knowledge/` | 視覚演出 (Visual FX) イベントおよび音響連携アーキテクチャ |
| **[GKL_Structured_Knowledge_Usage_Guide.md](./3_gkl/GKL_Structured_Knowledge_Usage_Guide.md)** | `🟢 active` | `src/core/knowledge/` | 構造化知識ベース API 利用リファレンス |
| **[📦 archive/ サブフォルダ](./3_gkl/archive/)** | `📦 archived` | - | 完了済み設計書（SSOT統合、ポストコンバット同期等）・旧資料群（11ファイル退避済） |

---

### 2. 🧪 テスト・品質保証 (`docs/8_testing/`)
Vitest による全自動単体・統合テスト基盤、プロトコル検証、実機シナリオテストに関するガイドと構想書です。

| ドキュメント | ステータス | 関連ソースコード / ツール | 概要 |
| :--- | :---: | :--- | :--- |
| **[README.md (テストガイド)](./8_testing/README.md)** | `🟢 active` | `tests/`, `tools/dev_tools.html` | WebUICore テストガイド（全47スイート・507テスト 100% PASS） |
| **[Testing_Modernization_Implementation_Roadmap.md](./8_testing/Testing_Modernization_Implementation_Roadmap.md)** | `🟢 active` | `tests/`, `src/testing/` | テスト基盤刷新ロードマップ（全5フェーズ） |
| **[Scenario_Testing_and_Event_Capture_Architecture.md](./8_testing/Scenario_Testing_and_Event_Capture_Architecture.md)** | `🟢 active` | `tools/scenario-recorder.html` | 下り方向：実機イベントキャプチャ＆統合シナリオ再生設計 |
| **[Sequence_Protocol_Validation_Architecture.md](./8_testing/Sequence_Protocol_Validation_Architecture.md)** | `🟢 active` | `tests/protocol/` | 上り方向：キーシーケンス・プロトコル3重防壁検証設計 |

---

### 3. 🌐 翻訳エンジン & 辞書運用 (`docs/9_translation/`)
リアルタイム翻訳エンジン、DevTools Inspector 連携、辞書データ運用に関するドキュメントです。

| ドキュメント | ステータス | 関連ソースコード / ツール | 概要 |
| :--- | :---: | :--- | :--- |
| **[DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md)** | `🟢 active` | `dictionary.csv`, `tools/dict_converter.py` | マスター翻訳辞書運用・CSV相互変換オペレーションガイド |
| **[translation_architecture_enhancement_plan.md](./9_translation/translation_architecture_enhancement_plan.md)** | `🟢 active` | `src/core/translation/` | 翻訳システム次世代刷新構想（Category付与・かすれ文字復元・多段化） |
| **[📦 archive/ サブフォルダ](./9_translation/archive/)** | `📦 archived` | `tools/dev_scripts/` | 翻訳フロー解説、旧支援ツールガイド、Inspector統合設計、Lookup翻訳手順等（7ファイル退避済） |

---

### 4. 📦 Driver & Web Worker 仕様 (`docs/1_driver/`)
WASM Cコアをバックグラウンド Web Worker で駆動するドライバ仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[driver_core_spec.md](./1_driver/driver_core_spec.md)** | `🟢 active` | `src/driver/NetHackWasmDriver.js` | NetHack WASM Driver コア仕様書 |
| **[driver_api_reference.md](./1_driver/driver_api_reference.md)** | `🟢 active` | `src/driver/` | Web Worker 通信プロトコル・API リファレンス |
| **[driver_quickstart_guide.md](./1_driver/driver_quickstart_guide.md)** | `🟢 active` | `src/driver/` | ドライバ クイックスタートガイド |
| **[📦 archive/ サブフォルダ](./1_driver/archive/)** | `📦 archived` | - | 旧ロードマップ・C層Shim調査メモ等（3ファイル退避済） |

---

### 5. 💻 クライアント UI & コアエンジン (`docs/2_client_ui/`)
共通コアエンジン `WebUICore` およびフロントエンド連携仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[WebUICore_Usage_Guide.md](./2_client_ui/WebUICore_Usage_Guide.md)** | `🟢 active` | `src/core/WebUICore.js` | WebUICore 利用ガイド・機能仕様 |
| **[Modern_Web_Components_Update_Rules.md](./2_client_ui/Modern_Web_Components_Update_Rules.md)** | `🟢 active` | `src/` | モダン Web コンポーネント実装・更新規約 |
| **[gkl_inspect_cell_on_demand_guide.md](./2_client_ui/gkl_inspect_cell_on_demand_guide.md)** | `🟢 active` | `src/core/knowledge/OnDemandLookService.js` | セルオンデマンド照会・インスペクト実装ガイド |
| **[📦 archive/ サブフォルダ](./2_client_ui/archive/)** | `📦 archived` | - | 入力仕様、UI Decoupling設計、描画パフォーマンス分析等（8ファイル退避済） |

---

### 6. 🔊 音響システム (`docs/4_sound/`)
Web Audio API を活用した音響・効果音再生システム仕様書です。

| ドキュメント | ステータス | 関連ソースコード | 概要 |
| :--- | :---: | :--- | :--- |
| **[sound_system_spec.md](./4_sound/sound_system_spec.md)** | `🟢 active` | `src/sound/` | 音響・Web Audio システム仕様書 |
| **[📦 archive/ サブフォルダ](./4_sound/archive/)** | `📦 archived` | - | C層 soundprocs Shim 調査メモ退避 |

---

### 7. 🔮 将来構想 & アーキテクチャ深化 (`docs/7_futures/`)
次期開発セッションに向けたインテリジェント UI およびマイクロカーネル化の構想資料です。

| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| **[gkl_intelligent_ui_ideas.ja.md](./7_futures/gkl_intelligent_ui_ideas.ja.md)** | `🔵 reference` | 次世代インテリジェントUI構想（虐殺・2画面コンテナ・変化制御・魔法詠唱ダイアログ等） |
| **[webuicore_final_architecture_vision.md](./7_futures/webuicore_final_architecture_vision.md)** | `🔵 reference` | 将来の WebUICore 完全独立・マイクロカーネル化構想（WebUIDevice/WebUISound分離） |

---

### 8. 📂 ゲームリファレンスデータ (`docs/5_gamedata/`)
ゲーム内タイル・地形・アイテム・モンスターのリファレンス資料群です。

| ドキュメント | 概要 |
| :--- | :--- |
| **[appearances.ja.md](./5_gamedata/appearances.ja.md)** | アイテム未識別外見（外観名）対訳リスト |
| **[glyph_tile_mapping.ja.md](./5_gamedata/glyph_tile_mapping.ja.md)** | Glyph ID とタイル番号の対応表 |
| **[monster_list.ja.md](./5_gamedata/monster_list.ja.md)** / **[item_list.ja.md](./5_gamedata/item_list.ja.md)** | モンスター / アイテムの日英対訳一覧 |
| **[ListofActionsbyTerrainTypeinNetHack.md](./5_gamedata/ListofActionsbyTerrainTypeinNetHack.md)** | 地形別アクション一覧リファレンス |
| **[Guidebook.ja.html](./5_gamedata/Guidebook.ja.html)** | NetHack 5.0 日本語公式ガイドブック |
| **[📦 archive/ サブフォルダ](./5_gamedata/archive/)** | 店主仕様・アイテム効果レポート等（3ファイル退避済） |

---

### 9. 📈 プロジェクト報告書・引き継ぎ資料 (`docs/6_project_reports/`)
開発の節目における評価レポートおよび引き継ぎ資料です。

| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| **[handover_20260905_status_reevaluation.ja.md](./6_project_reports/handover_20260905_status_reevaluation.ja.md)** | `🟢 latest` | **【最新】完了状態・ペンディング状態 再評価総合レポート（2026/09/05）** |
| **[notebooklm_knowledge_base.md](./6_project_reports/notebooklm_knowledge_base.md)** | `🔵 reference` | AIアシスタント・NotebookLM用ナレッジベース構築手順 |
| **[driver_improvements.md](./6_project_reports/driver_improvements.md)** | `🔵 reference` | ドライバ改善・イベントディスパッチ最適化レポート |
| **[nethack_jp_wasm_experiment.md](./6_project_reports/nethack_jp_wasm_experiment.md)** | `🔵 reference` | NetHack日本語版 (NetHackJP) WASM化実験記録 |
| **[📦 archive/ サブフォルダ](./6_project_reports/archive/)** | `📦 archived` | 開発初期〜中期の引き継ぎ資料・進捗報告書群（10ファイル退避済） |

---

## 📁 ディレクトリ構造

```text
docs/
├── README.md             # ドキュメント総合ポータル（本ファイル: SSOT）
├── FAQ_and_Configuration_Guide.md # 逆引き設定・セーブデータ管理 FAQ / 開発者ガイド
├── 1_driver/             # WASM Driver 仕様書 (直下3本 + archive/)
├── 2_client_ui/          # UI / WebUICore 仕様書 (直下3本 + archive/)
├── 3_gkl/                # GKL 総合・ADR・戦術・演出・API仕様書 (直下6本 + archive/)
├── 4_sound/              # 音響システム仕様書 (直下1本 + archive/)
├── 5_gamedata/           # ゲームリファレンスデータ群 (直下8本 + archive/)
├── 6_project_reports/    # 最新再評価レポート & プロジェクト報告書 (直下4本 + archive/)
├── 7_futures/            # 次世代インテリジェントUI・マイクロカーネル構想 (直下2本)
├── 8_testing/            # テストガイド & ロードマップ・構想書 (直下4本)
└── 9_translation/        # 辞書運用マニュアル & 次世代刷新構想 (直下2本 + archive/)
```

