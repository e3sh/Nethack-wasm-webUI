---
title: NetHack WASM WebUI プロジェクト総合ロードマップ＆進捗ダッシュボード
status: living-document
last_updated: 2026-10-29
---

# 🗺️ NetHack WASM WebUI 総合ロードマップ＆進捗ダッシュボード

本ドキュメントは、NetHack WASM WebUI プロジェクトにおける**「現在実施中・最優先フォーカス (Active Focus)」「設計完了・着手待ち (Wait / Pending)」「実装待ちの構想・アイデア (Backlog)」「すでに実装完了している現行仕様 (Living Specs)」「過去の設計記録 (Archive)」**を一元管理する総合ダッシュボードです。

> [!NOTE]
> 🛡️ **全体整合性監査完了日: 2026-10-26**  
> 全63現役仕様書とコードベース（`src/`, `tools/`, `tests/`）の100%完全一致検証が完了し、公式ベースラインが確立されました。次回以降のドキュメント監査は **本日（2026-10-26）以降に変更された差分ファイルのみ** を対象とする「差分監査（Incremental Audit）」プロトコルが適用されます。

> [!IMPORTANT]
> **🧭 設計・開発・リファクタリング時の最重要必読インベントリ**  
> システムが現在持っている全機能、APIシグネチャ、WASM通信パイプライン、データ資産（全384体モンスター・481アイテム・787件の噂）、アーキテクチャの基本憲法、および機能重複統廃合・ギャップ分析は、**[システム現有能力カタログ (SYSTEM_CAPABILITIES.md)](./SYSTEM_CAPABILITIES.md)** にて一元集約されています。新機能の検討や改修時は必ずこちらをご一読ください。

直近の総合評価・引き継ぎ資料: **[handover_20261026_docs_and_codebase_baseline.ja.md](./6_project_reports/handover_20261026_docs_and_codebase_baseline.ja.md)**（全仕様書・実装整合性ベースライン確定報告書）

---

## 📌 ドキュメント・タスク・ライフサイクル規約

「あれもこれも着手中」というつまみ食い状態を防ぎ、手戻りのない堅牢なアーキテクチャ進化を維持するため、すべてのタスクおよび仕様書は以下のライフサイクルで厳格に分類・運用されます。

| ステータス | バッジ | 定義 | 取扱方針 |
| :--- | :---: | :--- | :--- |
| **`proposed`** | 💡 構想 (Backlog / RFC) | アイデア・将来構想。コードには未反映。 | アイデア出し用。いつでも変更・破棄可能。 |
| **`pending`** | ⏸️ 着手待ち (Pending / Wait) | **設計完了済みだが、前提基盤や順番を待っている状態**。 | 前提条件が整うまで着手せず待機（つまみ食い防止）。 |
| **`in-progress`** | 🚧 実施中 (Active Focus) | **現在まさに手を動かしている最優先の単一焦点**。 | リソースを集中し、完了まで最速で走り切る。 |
| **`implemented`** | 🟢 現行仕様 (Living Spec) | 実装完了。**現在のコードの挙動を示す正解（SSOT）**。 | コード変更時に合わせて最新状態へ更新する。 |
| **`archived`** | 📦 記録 (Archive / ADR) | 完了した作業記録、過去ログ、意思決定記録。 | 歴史的経緯として保存。原則更新しない。 |

---

## 🔥 1. 現在実施中・最優先フォーカス (Active Focus: 次期着手スロット)

現在進行中（`in-progress`）のタスクはありません。直近の最優先タスクであった **「§2.1 セマンティック・メッセージトークン化 V2」** を含む全開発タスクが完遂し、**[§4 実装完了コア機能 (Living Specs)](#living-specs)** へ移行済みです。

| 候補 | 対象タスク | 実装内容 / スコープ | ステータス |
| :--- | :--- | :--- | :--- |
| **次期着手候補** | **[§3.1 モダン総合インベントリダイアログ (`i`) ＆ 足元山積み二画面ファイラー (`,`)](./7_futures/modern_inventory_dialog_and_weight_analytics_architecture.ja.md)** | Direct Binding 床スタック直結・重量構成比バー付き 2 ペイン所持品コックピット ＆ 足元山積み二画面ファイラー | **💡 proposed / Ready for Design Alignment** |
| **次期着手候補** | **[§3.4 Nehww モダン入力の Web Components 昇格 ＆ Headless 純化](./2_client_ui/input_mode_separation_and_semantic_action_architecture.ja.md#8-ui層肥大化の解消とコンポーネント化-nh--への移行方針)** | InputCoordinator への完全カプセル化 ＆ `<nh-context-actions>` Web Components 化 | **💡 proposed / Backlog** |

---

## ⏸️ 2. 設計完了・着手待ち (Wait / Pending / Ready)

現在、設計完了・着手待ち（`pending`）のタスクはありません。  
**直近の「セマンティック・メッセージトークン化 V2」を含め、過去の全設計完了タスク（命名アシスト、事後ナレッジ連携、キャラクター詳細ダイアログ＆Quick Dock、床落ちアイテム・コンテナ・Peek Wisdom、ASCII純化、アイテム正規化、ブランチ同定＆エリアアナウンス等）はすべて 100% 完遂**し、**[§4 実装完了コア機能 (Living Specs)](#living-specs)** へ移行・統合済みです。

次期タスクを開始する際は、**[§3 構想・将来バックログ](#3-構想将来バックログ-backlog--ideas)** より要件定義・設計（RFC）を策定して着手します。

---

## 💡 3. 構想・将来バックログ (Backlog / Ideas)

設計構想・アイデアが策定されている将来検討項目です（Phase 8 で不要となった旧構想は `docs/7_futures/archive/` へ整理済み）。

### 3.1 Phase 8 直結の恩恵を強く受ける構想群
- **セマンティック・メッセージトークン化 ＆ ハイブリッド翻訳連携構想**:
  - 設計書:
    - [semantic_message_tokenization_and_interactive_rendering_specification.ja.md](./9_translation/semantic_message_tokenization_and_interactive_rendering_specification.ja.md)
    - [signal_driven_hybrid_translation_architecture.ja.md](./9_translation/signal_driven_hybrid_translation_architecture.ja.md)
  - 概要: **既存の 18,000 行辞書（`dictionary.csv`）は安定フォールバック資産として温存（非破壊）**した上で、物理コンテキスト制約および構文解析から名詞をトークン化する `MessageTokenParser.js` を導入。英語原文プレイ時でもモンスター・アイテムが色分けされ、クリックから GKL ナレッジカードへ即座に連携。ハイブリッド翻訳導入時にも、この確定 ID（`onum` / `monNum`）を元に公式和名を合成することで、翻訳名とナレッジ表示の完全一致を保証する。
- **モダン総合インベントリダイアログ (`i`) ＆ 足元山積み二画面ファイラー (`,`) ＆ ダイアログ操作系（Key/Pad）完全統一構想**:
  - 設計書:
    - [modern_inventory_dialog_and_weight_analytics_architecture.ja.md](./7_futures/modern_inventory_dialog_and_weight_analytics_architecture.ja.md)
    - [floor_pile_filer_and_dialog_navigation_architecture.ja.md](./7_futures/floor_pile_filer_and_dialog_navigation_architecture.ja.md)
  - 概要: Phase 8 の真の重量・BUC・床スタック直結（`SHIM_CMD_GET_OBJECT_AT`）を活かし、クラス別重量構成比バー付き2ペイン所持品コックピット（`i`）および足元山積み二画面ファイラー（`,` 拾う ⇄ `d` 置く）を実現。**※両構想とも、全ダイアログ共通の2ペイン・キーボード／ゲームパッド操作骨格（[`modal_interaction_and_navigation_guide.ja.md`](./2_client_ui/modal_interaction_and_navigation_guide.ja.md) 準拠）を共通基盤として実装する。**

### 3.2 独立した長期構想群
- **外部ナレッジ連携 (NetHackWiki) ＆ 翻訳モード連動 Web ジャンプ構想**:
  - 設計書: [external_wiki_knowledge_linking_architecture.ja.md](./7_futures/external_wiki_knowledge_linking_architecture.ja.md)
  - 概要: ナレッジカード（`<nh-knowledge-card>`）や詳細モーダルのヘッダーに `[🌐 NetHackWiki]` ボタンを配置し、英語真名（`entity.name`）で外部 Wiki へワンクリックジャンプ（約50行で独立実装可能）。
- **GamePad 右ホイール・ボタンセット切替構想 (Radial Button Set Switching Concept)**:
  - 設計書: [gamepad_radial_button_set_switching_concept.ja.md](./7_futures/gamepad/gamepad_radial_button_set_switching_concept.ja.md)
  - 概要: ゲームパッド右ホイールのボタンセット動的切替構想（`💡 proposed`）。コンソールクライアントでの PoC 実験候補。

### 3.4 Nehww モダン入力の Web Components (`<nh-*>`) 昇格 ＆ Headless 純化構想 (Componentization & Input Architecture)
- **ステータス**: `💡 proposed (Backlog / RFC)`
- **設計書**: **[input_mode_separation_and_semantic_action_architecture.ja.md §8](./2_client_ui/input_mode_separation_and_semantic_action_architecture.ja.md#8-ui層肥大化の解消とコンポーネント化-nh--への移行方針)**
- **背景と課題**:
  - 先行して急遽実装された Nehww モダン操作系（WASD移動、テンキー偽装返却、Facing向き管理、スマート文脈メニュー、ダッシュ、YNQプロンプトガード）は現在 `KeyHandler.js`（View-Handler）にロジックが集約されており、View層が肥大化・ややこしくなっている。
- **目的と方針**:
  1. **`InputCoordinator` への状態評価・キーコード生成の完全カプセル化**:
     - プロンプト状態判定や Numpad 偽装判定を `src/ui-controller/` に集約し、`KeyHandler` を単にイベントを流すだけの100行未満の薄い土管に純化する。
  2. **スマート文脈メニューの Web Component 化 (`<nh-context-actions>`)**:
     - `FloatingContextActions.js` を独立した自立型 Web Component へ昇格。
  3. **スマートガイドバー ＆ ヘルプダイアログの Web Component 化**:
     - `<nh-key-guide-bar>` および `<nh-keymap-dialog>` を新設し、UI固有の HTML からプロジェクト標準コンポーネントへ共通化。
  4. **ゲームパッド ＆ キーリマップ連携**:
     - パッド操作体系（Phase 2）および `<nh-ui-config>` でのキーコンフィグ（Phase 3）とシームレスに統合。

### 3.3 レガシーフォールバック一掃 ＆ Direct-Only アーキテクチャ純化構想 (Tech Debt Cleanup)
- **ステータス**: `💡 proposed (Backlog / RFC)`
- **背景と課題**:
  - Direct Binding（WASM メモリ直結）がモンスター・床落ちアイテム・インベントリ・ダンジョン全域にわたって開通した現在、過去のテキスト端末ベースで使われていた「オンデマンド Look（`;` キー送信と画面メッセージ行パース）」や「文字列正規表現 BUC/強化値抽出」などのフォールバック処理は不要化しており、逆に誤判定や不要なキーストローク通信・遅延の原因となっている。
- **目的**:
  - レガシーフォールバックコードを計画的に一掃し、NetHack C コア絶対真値（SSOT）のみに基づく軽量・堅牢・ゼロ遅延の Direct-Only アーキテクチャへ純化する。
- **撤廃対象コンポーネント**:
  1. **`OnDemandLookService.js`**: `;` キー送信によるメッセージ行パースの完全廃止・ファイル削除（`getFullMonsterAt` への一本化）。
  2. **`ItemIdentificationResolver.js`**: 文字列からの `extractBuc`, `extractEnchantmentAndCharges` 正規表現パース群の撤廃（C コア構造体データ受取型への純化）。
  3. **`AreaStateManager.js` / `TerrainInferenceEngine.js`**: 地形推論・捏造コードの完全撤廃（C コア直接真値 `_cachedLevelGlyphs` / `_cachedLevelTerrain` への一本化）。
  4. **`InventoryStateManager.js`**: TTY メニューテキスト逆算パースコードの撤廃。
- **3段階移行ロードマップ**:
  - **Phase 1（実施済）**: Direct Binding 優先化＆フォールバックの完全バイパス（副作用・遅延・誤判定の根絶）。
  - **Phase 2（次期マイルストーン）**: レガシー関数への `@deprecated` 付与、およびテストスイートの Direct Binding 構造体検証への一本化。
  - **Phase 3（Stage 9）**: レガシーファイル・関数の物理削除による数千行規模のコードベーススリム化とメンテナンス性向上。

---

## 🟢 4. 実装完了コア機能・現行仕様インデックス (Living Specs Index) <a id="living-specs"></a>

すでに実装が完了し、テストが通過（**全169スイート・2,177テスト 100% PASS**）している現行動作の正解（Single Source of Truth）となる仕様書群です。  
※システムが現在保有する全機能・API・アーキテクチャ憲法・データ資産の網羅カタログは **[SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md)** を参照してください。

### 4.1 通信・同期 ＆ WASM ドライバ基盤
| 機能・仕様書 | 主要コード / モジュール | 完了期 | 概要 |
| :--- | :--- | :---: | :--- |
| **[SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md)** | `src/` 全域 | 最新 SSOT | **システム現有能力カタログ**（全機能・API・アーキテクチャ憲法・資産インベントリ） |
| [official_shim_direct_binding_implementation_plan.md](./1_driver/official_shim_direct_binding_implementation_plan.md) | `shim_bridge.c`, `WasmDirectBindingService` | Stage 8.1〜8.5 | WASM Cメモリ構造体直結（`CALL_SHIM`）パイプライン |
| [shim_driven_rendering_pipeline_architecture.ja.md](./2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md) | `GKLEventRouter`, `SyncBarrier` | Stage 8.3-B | 4フェーズ Turn Lifecycle ＆ Sync Barrier による遅延破棄・確定同期 |
| [nethack_version_upgrade_guide.ja.md](./1_driver/nethack_version_upgrade_guide.ja.md) | `NetHackWasmDriver.js`, `winshim.c` | Stage 8.1 | NetHack 5.0.1 追従 ＆ 公式Cコード非侵襲 Driver 基盤 |
| [Interactive_Request_Controller_Architecture_and_Roadmap.md](./2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md) | `src/core/request/` | Phase 2 | 連続リクエストコントローラ (IRC) ＆ サイレント同期マクロ基盤 |

### 4.2 ゲーム状態追跡・構造化知識 (GKL)
| 機能・仕様書 | 主要コード / モジュール | 完了期 | 概要 |
| :--- | :--- | :---: | :--- |
| [canonical_item_schema_and_normalization_architecture.ja.md](./3_gkl/canonical_item_schema_and_normalization_architecture.ja.md) | `ItemNormalizer.js`, `ItemDisplayPresenter.js` | 2026-10-18 | 公式 `objnam.c` 準拠のアイテム正規化 (Canonical Schema) ＆ `\|\|` 根絶 |
| [Branch_Detection_and_Area_Announcement_Architecture.ja.md](./3_gkl/Branch_Detection_and_Area_Announcement_Architecture.ja.md) | `AreaStateManager.js`, `GKLEventRouter.js`, `drawAreaBanner.js` | 2026-10-29 | ブランチ100%確定同定・`branch:dlvl`キャッシュ分離 ＆ `AREA_ENTERED` 演出バナーパイプライン |
| [floor_item_direct_binding_and_peek_wisdom_architecture.ja.md](./3_gkl/floor_item_direct_binding_and_peek_wisdom_architecture.ja.md) | `InventoryWasmAdapter.js`, `ItemSpecPresenter` | Stage 8.5 | 床アイテム・コンテナ Direct Binding ＆ 覗き見知恵 (Peek Wisdom) |
| [levl_glyph_and_terrain_hybrid_architecture_plan.ja.md](./3_gkl/levl_glyph_and_terrain_hybrid_architecture_plan.ja.md) | `SpatialWasmAdapter.js`, `AreaStateManager.js` | 2026-10-21 | NetHack Cコア直接グリフ (`levl.glyph`) ＆ 抽象地形 (`typ`) ハイブリッド二重管理アーキテクチャ |
| [official_shim_direct_binding_implementation_plan.md (Stage 8.4)](./1_driver/official_shim_direct_binding_implementation_plan.md) | `PlayerWasmAdapter.js`, `AttributeStateManager` | Stage 8.4 | ブランチ100%確定同定・耐性69要素・お祈りタイマー直結 |
| [gkl_multibyte_removal_and_ascii_purification_plan.ja.md](./3_gkl/archive/gkl_multibyte_removal_and_ascii_purification_plan.ja.md) | `InventoryStateManager`, `EquipmentRules` | Stage 8.5 | モデル層からの日本語正規表現完全削除 ＆ 100% ASCII 純化 (archive 退避済) |
| [AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md) | `AreaStateManager.js` (4分割) | Phase 8 先行 | 空間状態 4分割オーケストレーター化（コード71.8%スリム化） |
| [GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md](./3_gkl/GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md) | `GKLPlugin.js` (5分割) | Phase 8 先行 | GKLPlugin 神クラス解体 ＆ ファサード化（コード81.5%スリム化） |
| [post_mortem_knowledge_and_tactical_advisor_redesign.ja.md](./7_futures/post_mortem_knowledge_and_tactical_advisor_redesign.ja.md) | `PostMortemKnowledgeResolver.js` | 2026-10-16 | 公式 xlogfile 準拠スコアボード ＆ 死因根本原因調停 (RCA) |
| [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md) | `ItemCandidateResolver`, `AdventureLogManager` | Phase 7 | 命名アシスト（Gap 2）、動的文学引用（Gap 3）、冒険手帳メタ進行（Gap 4） |
| [Equipment_Paperdoll_and_Dependency_Architecture.md](./3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md) | `src/core/knowledge/equipment/` | Phase 4 | 装備換装シミュレーション ＆ 着脱依存解析エンジン |
| [TacticalAdvisor_Specification_and_Architecture.md](./3_gkl/TacticalAdvisor_Specification_and_Architecture.md) | `TacticalAdvisor.js`, `AssistSignalSynthesizer` | Phase 3 | データ駆動型戦術アドバイザー ＆ アシストスタンス導出 |

### 4.3 盤面描画・レンダラー・空間可視化
| 機能・仕様書 | 主要コード / モジュール | 完了期 | 概要 |
| :--- | :--- | :---: | :--- |
| [GKL_Visual_FX_Event_Architecture.md](./3_gkl/GKL_Visual_FX_Event_Architecture.md) | `VisualFxDispatcher.js`, `drawAreaBanner.js`, `drawDamagePopup.js` | 2026-10-29 | GKL 演出トリガー (`fx_trigger`) 仕様 ＆ スクリーン空間/グリッド空間 FX ライフサイクル |
| [context_aware_stone_and_digging_rendering_spec.ja.md](./2_client_ui/context_aware_stone_and_digging_rendering_spec.ja.md) | `AreaStateManager.js`, `MainViewportRenderer.js` | 2026-10-19 | スマート岩盤可視化（3モード）＆ 掘削連動アンバー枠・3D壁投影 |
| [webgpu_hd2d_diorama_renderer.ja.md](./2_client_ui/webgpu_hd2d_diorama_renderer.ja.md) | `WebGPUHD2DRenderer.js` | Phase 3 | 生WGSLシェーダーによる WebGPU HD-2D クオータビュージオラマ描画 |
| [unified_renderer_and_screen_architecture_plan.md](./2_client_ui/unified_renderer_and_screen_architecture_plan.md) | `VirtualDungeonScreen.js`, `MainViewportRenderer` | Phase 1〜3 | 仮想スクリーン統合オフスクリーン描画 ＆ ミニマップスマート退避 |
| [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/archive/gkl_client_ui_ux_modernization_plan.ja.md) | `MainViewportRenderer.js`, `WebGPUHD2DRenderer.js` | Phase A〜D | 自キャラ足元枠Middle層最適化 ＆ Pet/Ridden/PileTop視覚強調バッジ |

### 4.4 UI制御・操作調停・Web Components
| 機能・仕様書 | 主要コード / モジュール | 完了期 | 概要 |
| :--- | :--- | :---: | :--- |
| [ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md) | `src/ui-controller/`, `src/components/` | Phase E | DOM非依存 Headless UI 層 ＆ モダン `<nh-*>` Web Components 共通基盤 |
| [modal_interaction_and_navigation_guide.ja.md](./2_client_ui/modal_interaction_and_navigation_guide.ja.md) | `src/components/`, `ModalStackController` | ガイドライン | 完全キーボード/ゲームパッド完結モーダル操作性＆ナビゲーション設計規格 |
| [Container_Interaction_Specification_IRC.md](./3_gkl/Container_Interaction_Specification_IRC.md) | `<nh-container-filer>`, `ContainerController` | Phase 3 | 2画面コンテナ出し入れファイラー ＆ BoH防爆安全ガード |
| [gamepad_console_mode_architecture.ja.md](./7_futures/gamepad/gamepad_console_mode_architecture.ja.md) | `GamepadInputController.js`, `RadialInputRecognizer` | Phase 5 | ラジアルメニュー認識 ＆ ゲームパッド操作体系 |
| [direct_binding_lifecycle_and_ui_pipeline_reconstruction_plan.ja.md](./2_client_ui/direct_binding_lifecycle_and_ui_pipeline_reconstruction_plan.ja.md) | `CharacterStatusModal.js`, `UIConfigStore.js` | Phase 8.5 | オンデマンド型キャラ詳細モーダル・Quick Dock・透過入力調停 |
| [input_mode_separation_and_semantic_action_architecture.ja.md](./2_client_ui/input_mode_separation_and_semantic_action_architecture.ja.md) | `InputCoordinator.js`, `KeyHandler.js` | 2026-10-21 | Nehwwモダン操作 (WASD/Facing/ダッシュ/スマートメニュー) ⇄ Classic (Cコアテンキー偽装返却) 完全分離 ＆ プロンプトガード基盤 |

### 4.5 音響・メッセージ・テスト基盤
| 機能・仕様書 | 主要コード / モジュール | 完了期 | 概要 |
| :--- | :--- | :---: | :--- |
| [semantic_message_tokenization_and_interactive_rendering_specification.ja.md](./9_translation/semantic_message_tokenization_and_interactive_rendering_specification.ja.md) | `MessageTokenParser.js`, `TokenKnowledgeResolver.js`, `MessageTokenCatalog.js` | 2026-10-29 | **セマンティック・メッセージトークン化 (V2)**: 物理コンテキスト制約による日常アイテム・金貨100%救済、地形誤爆0%完全遮断、多段正規化パイプライン ＆ 事後辞書検証ゲート |
| [sound_coordinator_and_multidriver_architecture.ja.md](./4_sound/sound_coordinator_and_multidriver_architecture.ja.md) | `SoundCoordinator.js`, `src/core/sound/drivers/` | Phase 6 | 照合・調停・駆動の3層完全分離 ＆ マルチドライバ音響基盤 |
| [dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md) | `ProceduralSynthDriver.js` | Stage 5.6 | Web Audio API オシレーター動的音程シンセシス（床12音階・咆哮・演奏） |
| [immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `FloatingMessageHudController`, `<nh-floating-hud>` | Phase B | 全画面フローティング最新行HUD ＋ 過去ログドロワー ＆ 抑止制御 |
| [README.md (テストガイド)](./8_testing/README.md) | `tests/` | 継続運用 | Vitest 全自動テスト基盤（**全169スイート・2,177テスト 100% PASS**） |
| [DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md) | `dictionary.csv`, `tools/` | 運用中 | 翻訳辞書・CSV相互変換運用ガイド |

---

## 📦 5. 完了済みマイルストーン・アーカイブ記録 (Completed Milestones & Archives)

過去の検討経緯や完了済みプロジェクトレポート、旧アーキテクチャ資料です。

- **直近引き継ぎ・状況評価レポート**:
  - **[handover_20261026_docs_and_codebase_baseline.ja.md](./6_project_reports/handover_20261026_docs_and_codebase_baseline.ja.md)** (10/15〜10/26実装実績［Nehww操作系刷新、CコアSSOT確立、ダンジョントラッカー等］＋全63仕様書・3大ハブ完全整合ベースライン確立、ミスマッチ0件証明、全169スイート・2,177テスト 100% PASS)
  - [handover_20261015_stage8_completion.ja.md](./6_project_reports/handover_20261015_stage8_completion.ja.md) (Phase 8 全ステージ 8.1〜8.5 完遂、4大リファクタリング・神クラス解体、全149スイート・1,811テスト 100% PASS)
  - [handover_20261008_status_reevaluation.ja.md](./6_project_reports/archive/handover_20261008_status_reevaluation.ja.md) (NetHack 5.0.1 追従、Phase 6 マルチドライバ分離完遂、Phase 7 冒険手帳/ナレッジカード完遂、3大不具合是正)
  - [handover_20260929_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260929_status_reevaluation.ja.md) (Phase E / Phase 5 完遂、Web Audio API 動的音程シンセシス、現有能力カタログ、1,300テスト通過)
  - [handover_20260921_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260921_status_reevaluation.ja.md) (レンダラー統合、WebGPU HD-2D、LORE、ペーパードール完成)
  - [handover_20260914_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260914_status_reevaluation.ja.md) (IRC基盤、コンテナUI完成)
- **完了済み大型マイルストーン計画書**:
  - [official_shim_direct_binding_implementation_plan.md](./1_driver/official_shim_direct_binding_implementation_plan.md) (Phase 8 公式Shim構造化バインディング＆メモリ直結 全ステージ 8.1〜8.5 完遂)
  - [ArchitectureDecisionRecord.md](./3_gkl/archive/ArchitectureDecisionRecord.md) (`📦 archived`)
- **各カテゴリのアーカイブフォルダ**:
  - `docs/1_driver/archive/`: 公式Shim能力解析書、Stage 8.2-B 検証環境計画書、旧ロードマップ・C層Shim調査メモ
  - `docs/2_client_ui/archive/`: GKLクライアントUI刷新計画(Phase A〜D)、main.jsモジュール分割計画、ダイアログデザイン統一構想、Web Components規約、旧入力仕様等
  - `docs/3_gkl/archive/`: ADR（意思決定記録）、旧SSOT統合計画、初期コンテナUI設計書等
  - `docs/4_sound/archive/`: 旧 SoundEngine 単一クラス仕様書 (`sound_system_spec.md`)、C層 soundprocs 調査メモ
  - `docs/5_gamedata/archive/`: 店主仕様・アイテム効果レポート等
  - `docs/6_project_reports/archive/`: 過去の引き継ぎ資料・進捗報告書群・不具合是正計画書
  - `docs/7_futures/archive/`: 完遂済み Phase 5 詳細計画群（全6ステージ）、Phase 8 で代替・不要となった旧構想群（啓蒙ダイアログ横取り、真値監査エンジン、ヘルプ専用モーダル、バリアント適合メモ）、旧マイクロカーネル構想、旧Gamepad独立クライアント構想等
  - `docs/8_testing/archive/`: 旧テスト基盤刷新ロードマップ等
  - `docs/9_translation/archive/`: 旧翻訳フロー、旧次世代翻訳拡張計画（かすれ文字・Unicodeシム）、Inspector統合計画等

---

## 🛠️ ドキュメントの保守・運用フロー（AIペアプロ連携）

1. **💡 アイデアが浮かんだら**:
   - `docs/7_futures/` または該当カテゴリに `status: proposed` で構想メモを作成。
   - 本ロードマップの「3. 構想・将来バックログ」にリンクと1行要約を追記。
2. **⏸️ 仕様・設計が合意できたら**:
   - 直ちに着手せず、前提条件や優先順位を判断して「2. 設計完了・着手待ち (Wait / Pending)」へ配置。
3. **🚧 実装を開始したら**:
   - 本ロードマップで「1. 現在実施中・最優先フォーカス (Active Focus)」へ単一集中移動し、タスクチェックリストを管理。
4. **🟢 実装が完了したら**:
   - 仕様部分を現行仕様書として整理し、`status: implemented` に更新。
   - 本ロードマップの「4. 実装完了コア機能 (Living Specs)」テーブルへ移動。
   - 一時的な移行メモや作業ログは各カテゴリの `archive/` へ退避。
5. **🛡️ 定期・継続的ドキュメント監査（差分監査プロトコル）**:
   - 2026-10-26 に確立されたベースライン（`handover_20261026_docs_and_codebase_baseline.ja.md`）以降、全件総当たり調査は不要です。
   - 次回以降の監査では、`git diff --name-only <baseline-commit>..HEAD` 等で変更差分を抽出し、変更された仕様書とコードの対応関係のみを局所的に検証・更新してください。
