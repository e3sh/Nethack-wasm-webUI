# NetHack WASM WebUI Phase 8 完遂・引き継ぎ総合レポート (2026年10月15日版)
**調査・評価実施日**: 2026年10月15日  
**対象リポジトリ**: `Nethack-wasm-webUI` (main branch)  
**前回レポート**: [`docs/6_project_reports/archive/handover_20261008_status_reevaluation.ja.md`](./archive/handover_20261008_status_reevaluation.ja.md)  
**関連主要仕様書**: 
- [総合ロードマップ (ROADMAP.md)](../ROADMAP.md)
- [システム現有能力カタログ (SYSTEM_CAPABILITIES.md)](../SYSTEM_CAPABILITIES.md)
- [公式Shim直接調停実装計画書](../1_driver/official_shim_direct_binding_implementation_plan.md)
- [Direct Binding 確定情報・純化計画書](../3_gkl/direct_binding_ground_truth_and_terrain_glyph_bugfix_plan.ja.md)
- [Direct Binding ライフサイクル・UI刷新計画書](../2_client_ui/direct_binding_lifecycle_and_ui_pipeline_reconstruction_plan.ja.md)
- [テストガイド](../8_testing/README.md)

---

## 1. エグゼクティブサマリー (Executive Summary)

本レポートは、前回総合評価レポート（2026/10/08）以降のソースコード（`src/`、`examples/`、`tests/`、`tools/`）、コミット履歴、テストスイート、および最新の設計書群を網羅的・実態ベースで精査し、**「Phase 8: 公式Shim構造化バインディング ＆ ゼロオーバーヘッド・メモリ直結」の全ステージ（8.1 〜 8.5）完遂**、**4大先行リファクタリング（神クラス解体）**、**アーキテクチャの基本憲法第6条（確定情報とフォールバックの排他ルーティング）の確立**、および **次期着手スロットに向けた引き継ぎ事項** を体系的にまとめた引き継ぎ総合レポートです。

この7日間（2026/10/08 〜 2026/10/15）において、プロジェクトは長年の課題であった「画面テキストパースやヒューリスティック推論への依存」から脱却し、**公式 NetHack 5.0.1 の C コアメモリから直接 0.1ms 未満・副作用ゼロで真値（Ground Truth）を取得する不可分同期インフラ** を完成させました。

すべての改修は「今できていることを絶対に壊さない」非破壊的原則のもとで進められ、**全149テストスイート・1,811テスト 100% PASS**（前回比 +24スイート、+245テスト、1 skipped）、および **全サンプルクライアントの整合性維持** を達成・維持しています。

### 📊 主な再評価ハイライト (前回 10/08 からの主要な変化)

1. **Phase 8 (Stage 8.1〜8.5) の完全完遂**:
   - **Stage 8.1**: 単一汎用窓口ブリッジ (`src/driver/shim/shim_bridge.c` / `_shim_bridge_call`) を新設。公式 C ソースコード無改変（非侵襲）での WASM メモリ直接ディスパッチ網を構築。
   - **Stage 8.2-A / 8.2-B**: Web Worker 隔離調停プロトコル（Turn確定静止同期）と `inspector_console.html` 連携型検証環境（`auto` / `strict` / `fallback` 3モード切替）の配備。
   - **Stage 8.2-C**: 全所持品構造体・14装備スロットポインタ・真の総重量 (`inv_weight()`) の完全直結、および地面・祭壇アイテムの BUC 判定（`blessed` / `cursed` / `bknown`）の 100% 同定。
   - **Stage 8.3-A**: フロア全域 (80×21) 真の地形・扉施錠・罠一括ダンプ (`dumpLevelTerrain()`) とモンスター直結 (`mpeaceful`, `mtame`) による誤爆完全根絶。
   - **Stage 8.3-B**: Shim-Driven 確定同期型レンダリング・パイプライン刷新 ＆ Sync Barrier 調停統合。投機的仮床推測（`3992`）の完全根絶と未踏領域ネタバレ防止ガード。
   - **Stage 8.3-C**: Direct Binding 確定情報純化 ＆ 地形・インベントリ不具合是正。Cシム層の `corpsenm` / `known` 拡張、像・死体専用グリフ適用、扉なし枠（`3985`）適正化、魔法書・杖・自作缶詰の境界誤爆根絶。
   - **Stage 8.4**: ダンジョン番号 (`dnum`) による全9ブランチ確定同定＆フロアキャッシュ分離、お祈りタイマー (`ublesscnt`) / 神の怒り (`ugangr`) 直結、プレイヤー耐性配列 (`uprops` 69要素) SSOT 直結。
   - **Stage 8.5**: `StartupFlowController` の `completeStartup` を完全 async 化し、従来の `setTimeout` 遅延ハックを完全根絶。ライフサイクル管理ステートマシン `GameLifecycleManager`（`GAME_LIFECYCLE_STATE`）を新設。モデル層からの日本語正規表現完全削除による ASCII 純化、床落ちアイテム個体スペック（数量、強化値、残チャージ、対象モンスター、BUC）の動的反映（Peek Wisdom）完遂。
2. **4大先行リファクタリングによる大規模神クラスの解体**:
   - **`main.js`**: 2,364行 ➔ 618行（約74%削減）。多言語・レイアウト・FX・起動・盤面操作を独立モジュールへ分離。
   - **`GKLPlugin.js`**: 2,613行 ➔ 482行（約81.5%削減）。`GKLEventRouter`、`SilentSyncCoordinator`、`GKLFxCoordinator`、`InspectionService`、`AutoTravelService` を分離。
   - **`AreaStateManager.js`**: 1,552行 ➔ 437行（約71.8%削減）。`TerrainInferenceEngine`、`DungeonLandmarkRegistry`、`ViewportTileProjector` へ分離。
   - **`WasmDirectBindingService.js`**: 2,160行 ➔ 約350行（約84%削減）。`WasmSyncCoordinator`、`InventoryWasmAdapter`、`PlayerWasmAdapter`、`SpatialWasmAdapter`、`MonsterWasmAdapter`、`DiscoveryWasmAdapter` へ分離し、薄型ファサード化。
3. **アーキテクチャ基本憲法第6条の制定**:
   - 「確定情報（Direct Binding）と推論フォールバックの排他ルーティング原則」。Tier 1（C構造体 Ground Truth） > Tier 2（目視確定属性） > Tier 3（fallback 時の推論）の優先順位を厳守し、確定値取得時の正規表現パース逆流を全ドメインで完全遮断。
4. **テストランク制度（Rank S / A / B / C）の導入と全テスト通過維持**:
   - テストスイートは **全149ファイル・1,811テスト 100% PASS**（1 skipped）を達成。不要テストの温存によるコード歪みを防ぐ運用規約を整備。
5. **構想の明確な分離（スコープ規約）**:
   - 通常時キー透過、統合ツールバー（Quick Dock）、キャラクター詳細ダイアログ等の UI/操作系刷新は、Stage 8.5 の基盤完遂後に別構想（ROADMAP 2.8）として分離・待機化。

---

## 2. Phase 8 完遂による詳細実装実績 (Completed Stages: 8.1 〜 8.5)

### 2.1 Stage 8.1: 単一窓口ブリッジ配備 ＆ Driver汎用ゲートウェイ整備
- **該当ソース**: `src/driver/shim/shim_bridge.c`, `src/driver/NetHackMemory.js`, `src/core/knowledge/services/WasmDirectBindingService.js`
- **設計書**: [`docs/1_driver/official_shim_direct_binding_implementation_plan.md`](../1_driver/official_shim_direct_binding_implementation_plan.md)
- **達成内容**:
  - 公式 NetHack ソースを一切改変しない「公式コード完全非侵襲エクステンション方式」を採用。
  - Unix `ioctl` パターンの単一エクスポート関数 `_shim_bridge_call(int cmd, int arg1, int arg2, void *buf, int len)` を配備。個別 C 関数を乱立させず、通信窓口を 1 つに集約。
  - WSL2 Linux ネイティブビルドスクリプト（`scripts/build_wasm_50_wsl.ps1`）および Windows スクリプト（`scripts/build_wasm_50.ps1`）により、ブリッジコードを公式 `win/shim/` へ自動リンクビルドする環境を構築。
  - `NetHackMemory.js` に `bridgeCall` ゲートウェイを整備。

### 2.2 Stage 8.2-A / 8.2-B: Web Worker 調停 ＆ 検証環境配備
- **該当ソース**: `src/driver/NetHackWasmWorkerBridge.js`, `src/driver/nethack.worker.js`, `tools/dev_tools.html`, `inspector_console.html`
- **達成内容**:
  - Web Worker とメインスレッド間の `CALL_SHIM` / `GET_INVENTORY` メッセージング調停。
  - ターン確定時（`WAITING_INPUT && isTopLevelTurn`）に 1 往復で同期を完了させる「Sync Barrier 静止同期モデル」を確立。
  - `inspector_console.html` に「所持品同期方式（🟢SHIM vs 🔵MACRO）」および「足元床状態（🟢SHIM vs 🟡INFERRED 3992）」のインジケーターを新設。
  - `DIRECT_BINDING_MODE`（`auto` / `strict` / `fallback`）の切替スイッチを配備し、フォールバック遮断環境（`strict` モード）下で単体・シナリオテストが 100% 稼働することを実証。

### 2.3 Stage 8.2-C: インベントリ・装備スロット・重量直結 ＆ 床アイテムBUC判定
- **該当ソース**: `src/driver/shim/shim_bridge.c`, `src/core/knowledge/state/InventoryStateManager.js`, `src/core/knowledge/state/EncumbranceStateManager.js`
- **達成内容**:
  - `SHIM_CMD_DUMP_ALL_INVENT` (0x43) により、全所持品のポインタ・識別状態・個体データを一括ダンプ。
  - `SHIM_CMD_GET_EQUIPMENT_PTRS` (0x41) により、14スロット（武器、鎧、盾、兜、手袋、ブーツ、マント、シャツ、指輪左右、アミュレット、眼鏡、光源、投擲物）の真の装備ポインタを直結。
  - `SHIM_CMD_GET_INV_WEIGHT` (0x42) により、Cコアの `inv_weight()` を直接取得し、`EncumbranceStateManager` の推測誤差をゼロ化。
  - `SHIM_CMD_GET_OBJECT_AT` (0x20) から `nexthere` 走査により、床や祭壇に置かれたアイテムの BUC 判定（`blessed` / `cursed` / `bknown`）を画面パース不要で 100% 同定。

### 2.4 Stage 8.3-A: 真の地形・扉施錠・罠判定 ＆ モンスター直結
- **該当ソース**: `src/core/knowledge/state/AreaStateManager.js`, `src/core/knowledge/engines/ActionSignalResolver.js`, `src/core/knowledge/engines/ContextActionEngine.js`
- **達成内容**:
  - `SHIM_CMD_DUMP_LEVEL_TERRAIN` (0x15) により、フロア全域 (80×21) の真の地形 (`typ`)、扉施錠・破壊フラグ (`flags`)、階段位置を一括取得。
  - 扉の `D_LOCKED` / `D_TRAPPED` フラグから最適なアクション（鍵開け、罠解除）を即時導出。罠のない扉への `#untrap` 誤表示を完全根絶。
  - `SHIM_CMD_GET_MONSTER_AT` (0x21) により、モンスターの平和NPCフラグ (`mpeaceful`)、ペットフラグ (`mtame`) を取得し、誤爆攻撃や攻撃FX誤爆を完全防止。

### 2.5 【先行着手 1〜4】大規模神クラスの解体と責務分離
- **達成内容**:
  1. **`main.js` モジュール分割 (2,364行 ➔ 618行、74%減)**: 多言語・レイアウト・FX・起動・盤面操作を `modules/` 配下へ分離。
  2. **`GKLPlugin.js` モジュール分割 (2,613行 ➔ 482行、81.5%減)**: `SilentSyncCoordinator`, `GKLEventRouter`, `GKLFxCoordinator`, `InspectionService`, `AutoTravelService` を分離。
  3. **`AreaStateManager.js` 4分割 (1,552行 ➔ 437行、71.8%減)**: `TerrainInferenceEngine`, `DungeonLandmarkRegistry`, `ViewportTileProjector` へ分離。
  4. **`WasmDirectBindingService.js` 6分割 (2,160行 ➔ 350行、84%減)**: `WasmSyncCoordinator`, `InventoryWasmAdapter`, `PlayerWasmAdapter`, `SpatialWasmAdapter`, `MonsterWasmAdapter`, `DiscoveryWasmAdapter` へ分離し、責務特化。

### 2.6 Stage 8.3-B: Shim-Driven 確定同期型レンダリング・パイプライン刷新 ＆ Sync Barrier 調停統合
- **該当ソース**: `src/core/knowledge/coordinators/GKLEventRouter.js`, `src/core/knowledge/services/WasmDirectBindingService.js`, `src/core/knowledge/state/area/TerrainInferenceEngine.js`, `src/core/knowledge/state/area/ViewportTileProjector.js`, `src/renderer/VirtualDungeonScreen.js`
- **設計書**: [`docs/2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md`](../2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md), [`docs/1_driver/direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md`](../1_driver/direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md)
- **達成内容**:
  - ターン同期ライフサイクルの確立（Phase 1: ACTION ➔ Phase 2: STREAMING ➔ Phase 3: SETTLED & SHIM SYNC ➔ Phase 4: COMMIT `areaStateCommitted`）。
  - `--More--` 待機ガード (`isMorePromptActive`) と世代排他制御 (`_syncGeneration`) の統合により、非同期通信の追い越しやレースコンディションを完全排除。
  - Direct Binding アクティブ時の投機的仮床推測（`3992`）の完全根絶、および未踏領域（`STONE 0`, `SDOOR 14`, `SCORR 15`）のネタバレ防止マスク。
  - `curs` 座標と Sync Barrier の連動による、足元アイテム（`cell.middle`）の確定更新と Commit 駆動フラッシュ制御。

### 2.7 Stage 8.3-C: Direct Binding 確定情報純化 ＆ 地形・インベントリ不具合是正
- **該当ソース**: `src/driver/shim/shim_bridge.c`, `src/core/knowledge/glyphClassifier.js`, `src/core/knowledge/state/InventoryStateManager.js`, `src/core/knowledge/engines/ItemIdentificationResolver.js`, `src/core/knowledge/state/area/TerrainInferenceEngine.js`
- **設計書**: [`docs/3_gkl/direct_binding_ground_truth_and_terrain_glyph_bugfix_plan.ja.md`](../3_gkl/direct_binding_ground_truth_and_terrain_glyph_bugfix_plan.ja.md)
- **達成内容**:
  - テストランク制度（Rank S/A/B/C）を導入し、旧仕様前提テストのための本番コード歪みを是正。
  - Cシム層 `shim_bridge.c` を拡張し、`SHIM_CMD_DUMP_ALL_INVENT` および `SHIM_CMD_DUMP_OBJECT_INFO` に `o->corpsenm`（死体・像・缶詰のモンスターID）と `o->known`（強化値・チャージ既知フラグ）を追加。
  - 扉のないドア枠 (`D_NODOOR` / `D_BROKEN` ➔ `3985`) が閉扉 (`3988`) として誤認される不具合を解消。開扉移動時も目視確定済みの向きを最優先保持。
  - 足元・所持品のモンスター像 (`onum: 476`)・死体 (`onum: 265`) に専用グリフ (`GLYPH_STATUE_OFF + corpsenm` / `GLYPH_BODY_OFF + corpsenm`) を適用。
  - `glyphClassifier.js` の魔法書・杖 `onum` 境界判定（`SPELLBOOK: 366〜409`, `WAND: 410〜437`, `COIN: 438`）を厳密化。
  - `glittering spellbook` / `turquoise spellbook` のカテゴリ誤爆（指輪・投擲化）を根絶。
  - 自作缶詰 (`onum: 296`) の `spe` フラグ誤爆（"tin wand" 化）を解消し、モンスター名付き缶詰・死体名称合成を確立。

### 2.8 Stage 8.4: ブランチ確定同定・お祈りタイマー・プレイヤー耐性直結
- **該当ソース**: `src/core/knowledge/adapters/PlayerWasmAdapter.js`, `src/core/knowledge/BindingConstants.js`, `src/core/knowledge/state/AreaStateManager.js`, `src/core/knowledge/state/AttributeStateManager.js`, `src/core/knowledge/coordinators/GKLEventRouter.js`
- **設計書**: [`docs/3_gkl/Branch_Detection_and_Area_Announcement_Architecture.ja.md`](../3_gkl/Branch_Detection_and_Area_Announcement_Architecture.ja.md), [`docs/7_futures/nethack_fuel_gauge_spec.md`](../7_futures/nethack_fuel_gauge_spec.md)
- **達成内容**:
  - **ブランチ確定同定 (`SHIM_CMD_GET_PLAYER_SUMMARY` 0x30 ➔ `u.uz.dnum`)**:
    - `dnum` から全9ブランチ（0: メインダンジョン, 1: ゲヘナ, 2: ノームの鉱山, 3: クエスト, 4: 倉庫番, 5: フォート・ルディオス, 6: ヴラドの塔, 7: 元素界, 8: チュートリアル）を 100% 確定同定。
    - `branch:dlvl` 形式でフロアキャッシュを完全分離し、新エリア突入バナー演出（`AREA_ENTERED`）を決定論的に発火。
  - **お祈りタイマー (`u.ublesscnt`) ＆ 神の怒り (`u.ugangr`) 直結**:
    - `u.ublesscnt`（クールダウン残ターン）および `u.ugangr`（神の怒り値）を C コアから直接取得。推測誤差ゼロ、セーブ再開コールドスタートゼロの安全なお祈り判定（`canSafelyPray`）を確立。
  - **プレイヤー耐性配列 (`SHIM_CMD_GET_PLAYER_PROPS` 0x32 ➔ `u.uprops`) 直結**:
    - 69要素の耐性配列から内因性（intrinsic: `uprops[i].intrinsic`）と外因性（extrinsic: `uprops[i].extrinsic`）をビット分離し、`AttributeStateManager` へ SSOT として完全直結。

### 2.9 Stage 8.5: Direct Binding ライフサイクル・同期パイプライン刷新 ＆ ASCII純化・床アイテム完全バインド
- **該当ソース**: `examples/gkl-pure-js-client/modules/startup/StartupFlowController.js`, `src/core/lifecycle/GameLifecycleState.js`, `src/core/knowledge/state/InventoryStateManager.js`, `src/core/knowledge/engines/ItemIdentificationResolver.js`, `src/core/knowledge/equipment/EquipmentRules.js`, `src/core/knowledge/equipment/EquipmentDependencyAnalyzer.js`, `src/core/knowledge/presenters/ItemSpecPresenter.js`, `src/core/knowledge/coordinators/SilentSyncCoordinator.js`
- **設計書**: [`docs/2_client_ui/direct_binding_lifecycle_and_ui_pipeline_reconstruction_plan.ja.md`](../2_client_ui/direct_binding_lifecycle_and_ui_pipeline_reconstruction_plan.ja.md), [`docs/3_gkl/gkl_multibyte_removal_and_ascii_purification_plan.ja.md`](../3_gkl/gkl_multibyte_removal_and_ascii_purification_plan.ja.md), [`docs/3_gkl/floor_item_direct_binding_and_peek_wisdom_architecture.ja.md`](../3_gkl/floor_item_direct_binding_and_peek_wisdom_architecture.ja.md)
- **達成内容**:
  - **遅延ハック排除 ＆ セーブ復帰不可分同期 (Step 1)**:
    - `StartupFlowController.js` の `completeStartup` を完全 `async` 化。
    - 従来の `setTimeout(..., 30/50)` による対症療法的遅延ハックを完全排除。`await (dbs.currentSyncPromise || dbs._currentSyncPromise)` による確定同期待ちへ移行し、セーブ復帰時のインベントリ空化や初期描画のチラつきを根本根絶。
  - **ライフサイクルステートマシン統合 ＆ 不要コード整理 (Step 3)**:
    - `src/core/lifecycle/GameLifecycleState.js`（`GAME_LIFECYCLE_STATE` / `GameLifecycleManager`）を新設。
    - 散在していた旧フラグ（`isFirstTurnSyncing`, `isStartingUp` 等）を一元化し、単一ステートマシンによるライフサイクル遷移管理（SSOT）を確立。
  - **GKL/装備判定ロジックの ASCII / 確定メタデータ純化 (Step 4 / ROADMAP 2.7)**:
    - `InventoryStateManager.js` における和名合成による `rawText` 汚染を解消し、`rawText` を 100% 英語 ASCII に純化（和名は `nameJa` / `customNameJa` へ分離）。
    - `ItemIdentificationResolver.js`、`EquipmentRules.js`、`EquipmentDependencyAnalyzer.js` から不要な日本語正規表現を完全削除し、多言語混在による判定バグリスクを根絶。
  - **床落ちアイテム Direct Binding 完全化 ＆ 覗き見知恵 (Step 4 / ROADMAP 2.6)**:
    - `ItemSpecPresenter.js` に `directObject` 由来の個体スペック動的反映（数量 `quan`、強化値 `spe`、残チャージ `charges`、対象生物 `corpse_monster`、`bucStatus`）を配備。
  - **構想分離の適用**:
    - 通常時キー透過、統合ツールバー（Quick Dock）、キャラクター詳細ダイアログ等の UI/操作系刷新は、ユーザー方針に基づき別構想（ROADMAP 2.8）として分離・待機化。

---

## 3. アーキテクチャの進化と基本憲法第6条

### 3.1 6大アーキテクチャ基本憲法

Phase 8 の完遂に伴い、アーキテクチャ憲法は以下の 6 原則として公式カタログ（`SYSTEM_CAPABILITIES.md`）に確立されました。

| 憲法条項 | 名称 | コア原則 |
| :---: | :--- | :--- |
| **第1条** | **DRY ＆ バリアント追従の原則** | WASM 一次情報（所持品、真の地形、属性等）を JS 側で静的二重持ちしない。C メモリ直接参照または動的クエリで運用する。 |
| **第2条** | **公式 C コード非侵襲の原則** | NetHack 本体の公式 C ソースコードを改変しない。単一外付けファイル `shim_bridge.c` に集約し、本家追従性を 100% 維持する。 |
| **第3条** | **直交性の原則** | 描画表現（ASCII ⇄ 2Dタイル ⇄ WebGPU HD-2D）と操作性（Vanilla ⇄ Enhanced）を完全に独立分離する。 |
| **第4条** | **パーマデス維持と知のメタ進行** | キャラクター能力はセッション終了時に完全リセット。持ち越す要素は図鑑収集率や死因記録などの「知の蓄積」に限定する。 |
| **第5条** | **ゲーム内とゲーム外の疎結合** | プレイ中は超軽量カード（`<nh-knowledge-card>`）、一覧鑑賞や戦歴分析は大図鑑（`adventure_log.html`, `scoreboard.html`）へ分離する。 |
| **第6条** | **確定情報とフォールバックの排他ルーティング** | Shim 直結（`SHIM_DIRECT`）稼働時は、文字列正規表現パースやヒューリスティック推論への逆流・混在を完全遮断。Tier 1（Ground Truth） > Tier 2（目視確定属性） > Tier 3（fallback 時の推論）の優先順位を厳守する。 |

---

## 4. 品質保証・テスト状況 (Testing & Quality Assurance)

### 4.1 テスト実行結果
- **テストランナー**: Vitest (v2.x)
- **テスト結果**: **全 149 テストファイル・1,811 テスト 100% PASS (1 skipped)**
- **実行時間**: 約 16 秒（全自動検証）

### 4.2 テストランク制度（Rank S / A / B / C）の運用
- **Rank S（絶対死守）**: C コア Ground Truth（Direct Binding 真値）のデコード整合性、WASM メモリレイアウト契約、SSOT 完全性。
- **Rank A（コア機能保証）**: ターン確定同期ライフサイクル、Sync Barrier 排他制御、装備依存シミュレーション、Web Components 契約。
- **Rank B（フォールバック隔離）**: レガシーマクロ（`querySequenceSilent`）や文字列推論の動作検証（`fallback` モード時のみのテスト）。
- **Rank C（廃止・削除対象）**: 旧内部実装依存のテスト。Direct Binding 移行に伴い不要となったものは速やかに退役・削除。

---

## 5. 次期フェーズへの引き継ぎ事項と優先度整理

Phase 8 の完遂によって、長らく待機（Pending）となっていた機能群の前提条件が完全に整いました。  
今後の開発において、次に取り組むべきフォーカス候補および関連構想は以下の通りです。

### 5.1 次期フォーカス候補（優先着手スロット候補）

#### 候補 A: ROADMAP 2.3 - 命名アシスト ＆ GamePad候補選択 (Gap 2 対応)
- **ステータス**: `⏸️ pending` ➔ **着手可能 (Ready)**
- **設計書**: [`docs/7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md`](../7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md)
- **概要**: 
  - 未鑑定アイテムの仮名付け（`#name` / `#call`）を、店頭価格や出現階層から逆引きしてワンタップでサジェストするコアエンジン（`ItemCandidateResolver.js`）。
  - GamePad / キーボード完全対応の候補選択ダイアログ（`<nh-call-candidate-dialog>`）。
  - **Phase 8 の恩恵**: 画面テキストパース不要。`SHIM_CMD_GET_OBJECT_AT` / `DUMP_ALL_INVENT` から `otyp`・買値・売値を直接取得できるため、極めて安全・シンプルに実装可能。

#### 候補 B: ROADMAP 2.8 - NetHack ネイティブキー透過 ＆ 統合ツールバー (Quick Dock) ＆ キャラクター詳細ダイアログ
- **ステータス**: `⏸️ pending` ➔ **着手可能 (Ready)**
- **設計書**: [`docs/2_client_ui/direct_binding_lifecycle_and_ui_pipeline_reconstruction_plan.ja.md`](../2_client_ui/direct_binding_lifecycle_and_ui_pipeline_reconstruction_plan.ja.md)
- **概要**:
  - 通常プレイ中のキー入力（`/`, `\`, `^X`, `?` 等）を C コアへ 100% 素通し（ネイティブパススルー）し、モーダルダイアログ表示中のみ排他的キートラップを適用。
  - 画面上部に WebUI 拡張機能（インベントリ、ペーパードール、冒険手帳、キャラクター詳細、設定）を一覧できる統合ツールバー（Quick Dock）を新設。
  - ステータスバーのインラインアコーディオン（▽）を全廃し、オンデマンド取得型の専用キャラクター詳細ダイアログ（`[👤 キャラクター]`）を新設。

#### 候補 C: ROADMAP 3.1 - シグナル駆動ハイブリッド翻訳 ＆ セマンティック・メッセージトークン化
- **ステータス**: `💡 proposed / backlog` ➔ **設計完了・プロトタイプ着手可能**
- **設計書**: 
  - [`docs/9_translation/signal_driven_hybrid_translation_architecture.ja.md`](../9_translation/signal_driven_hybrid_translation_architecture.ja.md)
  - [`docs/9_translation/semantic_message_tokenization_and_interactive_rendering_specification.ja.md`](../9_translation/semantic_message_tokenization_and_interactive_rendering_specification.ja.md)
- **概要**:
  - 18,000行の巨大な正規表現翻訳辞書を、Phase 8 の `struct obj` メタデータ埋め込みにより 1,000〜1,500行へ90%スリム化。
  - 翻訳OFF（英語原文）時でも構文シグナルから名詞・変数をトークン分離（Message AST）し、固有名詞ハイライト、クリックによるナレッジポップアップ、アイテム即時操作、VFX/SFX連動を実現。

### 5.2 開発・ビルド環境の運用手順

1. **C コア / WASM のビルド**:
   ```powershell
   # WSL2 Linux ネイティブビルド（推奨）
   .\scripts\build_wasm_50_wsl.ps1
   # または Windows スクリプト
   .\scripts\build_wasm_50.ps1
   ```
2. **全自動ユニットテスト実行**:
   ```powershell
   npm test
   ```
3. **レファレンスクライアント（Nehww）の起動**:
   ```powershell
   npm run dev
   # ブラウザで http://localhost:5173/examples/gkl-pure-js-client/ を開く
   ```
4. **検証モードの切替**:
   - `inspector_console.html` またはブラウザコンソールにて:
     - `window.__DIRECT_BINDING_MODE__ = 'strict';`（フォールバック完全遮断・直結強制検証）
     - `window.__DIRECT_BINDING_MODE__ = 'auto';`（直結優先・フォールバック自動許容）
     - `window.__DIRECT_BINDING_MODE__ = 'fallback';`（旧マクロ強制モード）

---

## 6. まとめ

Phase 8 の完遂により、NetHack WASM WebUI は「真値直結（Ground Truth）」という最大の技術的転換点を完全に乗り越えました。  
画面テキストの推測や非同期タイミングのハックに苦しむ時代は終わり、強固でモジュール化された薄型ファサードと高速メモリ直結網の上に、直感的でモダンな UI/UX を極めて安全かつ迅速に積み上げられる開発体制が整いました。
