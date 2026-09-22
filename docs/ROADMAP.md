---
title: NetHack WASM WebUI プロジェクト総合ロードマップ＆進捗ダッシュボード
status: living-document
last_updated: 2026-09-21
---

# 🗺️ NetHack WASM WebUI 総合ロードマップ＆進捗ダッシュボード

本ドキュメントは、NetHack WASM WebUI プロジェクトにおける**「現在進行中・直近の移行タスク (WIP)」「実装待ちの構想・アイデア (Backlog)」「すでに実装完了している現行仕様 (Living Specs)」「過去の設計記録 (Archive)」**を一元管理する総合ダッシュボードです。

直近の総合評価・引き継ぎ資料: **[handover_20260921_status_reevaluation.ja.md](./6_project_reports/handover_20260921_status_reevaluation.ja.md)**

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

現在設計が完了し、直近の着手対象となっている最重要リファクタリング・移行タスクです。

### 1.1 Phase 5: 既存状態把握機能のメッセージマスタ移行と WebUICore 責務純化
- **ステータス**: `🚧 in-progress`
- **設計書**: [phase5_detailed_migration_plan.ja.md](./7_futures/phase5_detailed_migration_plan.ja.md)
- **対象コード**: `src/core/WebUICore.js`, `src/core/knowledge/GKLPlugin.js`, `src/core/lore/`
- **概要**: 抽出完了した NetHack Cソースメッセージ（14,849件）を基盤とし、WebUICore から LORE などのドメインロジックを GKL へ移設・純化して、メッセージ駆動パイプラインを一元化する計画。
- **タスクロードマップ**:
  - [ ] **Stage 5.1: 責務純化とアーキテクチャ境界の確立**
    - `src/core/lore/` を `src/core/knowledge/lore/` へ移設
    - `WebUICore.js` 内のインライン LORE 処理（約90行）を GKL 側のシグナル購読へ分離
  - [ ] **Stage 5.2: 実行時メッセージコンテキスト照合基盤**
    - `build_message_context_catalog.py` による軽量実行時カタログ生成
    - `MessageContextResolver` の新設（O(1)〜O(N_small) 高速同定）
    - `WebUICore` メッセージ監視パイプラインの一元化
  - [ ] **Stage 5.3: ドメイン別既存モジュールのメッセージマスタ移行**
    - 効果音エンジン (`SoundEngine`): `You_hear` 等の決定論的トリガー
    - 耐性マネージャ (`AttributeStateManager`): `You_feel` 等の確定的耐性獲得
    - 道具識別 (`ItemIdentificationResolver`): 読解・振るメッセージによるタイプ判明
  - [ ] **Stage 5.4: 多言語透過性の完全達成と総合検証**
    - 日英二重キーワードの完全撤廃 (`messageId` への一元化)

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

### 2.2 動的音程シンセシス構想 (Dynamic Musical Synthesis)
- **ステータス**: `💡 proposed`
- **設計書**: [dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md)
- **対象コード**: `src/sound/`
- **概要**: NetHackのメッセージに含まれる音程・罠の音・モンスターの咆哮・楽器演奏をWeb Audio APIオシレーターでリアルタイム合成発音する。外部音源ファイル不要でリッチな音響体験を提供。

### 2.3 翻訳アーキテクチャ次世代刷新
- **ステータス**: `💡 proposed`
- **設計書**: [translation_architecture_enhancement_plan.md](./9_translation/translation_architecture_enhancement_plan.md)
- **概要**: 翻訳カテゴリ付与、かすれ文字（Engraving等）の復元、多段翻訳キャッシュパイプラインの導入。

### 2.4 将来の完全独立マイクロカーネル化構想
- **ステータス**: `💡 proposed`
- **設計書**: [webuicore_final_architecture_vision.md](./7_futures/webuicore_final_architecture_vision.md)
- **概要**: `WebUICore` をさらに疎結合化し、`WebUIDevice`（仮想端末）と `WebUISound`（音響）を完全分離する長期ビジョン。

---

## 🟢 3. 実装完了コア機能・現行仕様 (Living Specs)

すでに実装が完了し、テストが通過（全78スイート・1046テスト 100% PASS）しており、現在の動作の正解（Single Source of Truth）となっている機能群です。

| ドメイン | 機能・仕様書 | 主要ソースコード | 状態 | 概要 |
| :--- | :--- | :--- | :---: | :--- |
| **画面・描画** | [unified_renderer_and_screen_architecture_plan.md](./2_client_ui/unified_renderer_and_screen_architecture_plan.md) | `VirtualDungeonScreen.js`<br>`MainViewportRenderer.js`<br>`MinimapHudRenderer.js` | `🟢 implemented` | **仮想スクリーン統合レンダラー (Phase 1〜3)**<br>オフスクリーン統合、フォーカス追従、ミニマップスマート自動退避 |
| **画面・描画** | [webgpu_hd2d_diorama_renderer.ja.md](./7_futures/webgpu_hd2d_diorama_renderer.ja.md) | `WebGPUHD2DRenderer.js` | `🟢 implemented` | **WebGPU HD-2D ジオラマレンダラー**<br>生WGSLシェーダー、クオータビュー、動的ランタン視界、テスト完備 |
| **伝承・考古学** | - | `src/core/lore/LoreCodex.js`<br>`src/core/lore/LoreDetector.js`<br>`LoreModal.js` | `🟢 implemented` | **冒険手帳・伝承図鑑 (RUMOR & LORE CODEX)**<br>噂・格言・墓碑銘のアンロックとモーダル閲覧UI |
| **伝承・考古学** | - | `EngravingArchaeologist.js`<br>`EngravingHud.js`<br>`ElberethAnalyzer.js` | `🟢 implemented` | **床文字考古学復元 (Engraving)**<br>かすれ文字推測、Elbereth結界判定、HUDバナー、再刻みボタン |
| **操作・操作性** | [PLAYER_GUIDE.md](../examples/gkl-pure-js-client/PLAYER_GUIDE.md) | `DirectionPad.js`<br>(全5種クライアント) | `🟢 implemented` | **方向パッド (DirectionPad) コンテキスト操作**<br>長押し移動、ダブルタップダッシュ、全クライアント展開 |
| **GKL** | [Equipment_Paperdoll_and_Dependency_Architecture.md](./3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md) | `src/core/knowledge/equipment/`<br>`PaperdollModal.js` | `🟢 implemented` | **装備ペーパードールUI ＆ 換装プランナー (Phase 1〜3)**<br>3層構造解析、換装シミュレーション、部位スロットUI |
| **GKL** | [Encumbrance_and_Weight_Management_Architecture.md](./3_gkl/Encumbrance_and_Weight_Management_Architecture.md) | `src/core/knowledge/state/`<br>`EncumbrancePresenter.js` | `🟢 implemented` | **インベントリ重量・負荷状態管理**<br>総重量計算、プログレスゲージ、リスク状態ランプ |
| **UI / 支援** | [gkl_intelligent_ui_ideas.ja.md](./7_futures/gkl_intelligent_ui_ideas.ja.md) | `CharacterCreationModal.js`<br>`WriteModal.js`<br>`WishModal.js`<br>`GenocideModal.js`<br>`PolymorphModal.js` | `🟢 implemented` | **インテリジェント入力支援ダイアログ群**<br>キャラ作成、巻物書き込み、願い、虐殺、変化制御の専用GUI |
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
| **Testing** | [README.md (テストガイド)](./8_testing/README.md) | `tests/` | `🟢 implemented` | **Vitest 全自動テスト基盤 (78スイート・1,046テスト 100% PASS)** |
| **Translation** | [DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md) | `dictionary.csv`, `tools/` | `🟢 implemented` | **翻訳辞書・CSV相互変換運用ガイド** |

---

## 📦 4. 完了済みマイルストーン・アーカイブ記録 (Completed Milestones & Archives)

過去の検討経緯や完了済みプロジェクトレポート、旧アーキテクチャ資料です。

- **直近引き継ぎ・状況評価レポート**:
  - **[handover_20260921_status_reevaluation.ja.md](./6_project_reports/handover_20260921_status_reevaluation.ja.md)** (最新版: レンダラー統合、WebGPU HD-2D、LORE、ペーパードール完成)
  - [handover_20260914_status_reevaluation.ja.md](./6_project_reports/handover_20260914_status_reevaluation.ja.md) (IRC基盤、コンテナUI完成)
- **アーキテクチャ意思決定**: [ArchitectureDecisionRecord.md](./3_gkl/ArchitectureDecisionRecord.md) (`📦 record`)
- **各カテゴリのアーカイブフォルダ**:
  - `docs/1_driver/archive/`: 旧ロードマップ・C層Shim調査メモ
  - `docs/2_client_ui/archive/`: 旧入力仕様、UI Decoupling設計、キャンバス描画分析等
  - `docs/3_gkl/archive/`: 旧SSOT統合計画、初期コンテナUI設計書等
  - `docs/6_project_reports/archive/`: 過去の開発マイルストーン報告書（8月以前）
  - `docs/9_translation/archive/`: 旧翻訳フロー、Inspector統合計画等

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
