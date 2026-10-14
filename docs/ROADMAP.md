---
title: NetHack WASM WebUI プロジェクト総合ロードマップ＆進捗ダッシュボード
status: living-document
last_updated: 2026-10-11
---

# 🗺️ NetHack WASM WebUI 総合ロードマップ＆進捗ダッシュボード

本ドキュメントは、NetHack WASM WebUI プロジェクトにおける**「現在実施中・最優先フォーカス (Active Focus)」「設計完了・着手待ち (Wait / Pending)」「実装待ちの構想・アイデア (Backlog)」「すでに実装完了している現行仕様 (Living Specs)」「過去の設計記録 (Archive)」**を一元管理する総合ダッシュボードです。

> [!IMPORTANT]
> **🧭 設計・開発・リファクタリング時の最重要必読インベントリ**  
> システムが現在持っている全機能、APIシグネチャ、WASM通信パイプライン、データ資産（全384体モンスター・481アイテム・787件の噂）、アーキテクチャの基本憲法、および機能重複統廃合・ギャップ分析は、**[システム現有能力カタログ (SYSTEM_CAPABILITIES.md)](./SYSTEM_CAPABILITIES.md)** にて一元集約されています。新機能の検討や改修時は必ずこちらをご一読ください。

直近の総合評価・引き継ぎ資料: **[handover_20261008_status_reevaluation.ja.md](./6_project_reports/handover_20261008_status_reevaluation.ja.md)**

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

## 🔥 1. 現在実施中・最優先フォーカス (Active Focus: Phase 8)

現在リソースを集中して進行中の**唯一の最優先基盤タスク**です。  
後続の多くの構想・ペンディング機能が本フェーズの「確定情報・メモリ直結」に依存しています。

### 1.1 Phase 8: 公式Shim構造化バインディング ＆ ゼロオーバーヘッド・メモリ直結 (Native Shim Unified Dispatcher Bridge)
- **ステータス**: `🚧 in-progress` (最優先フォーカス, 2026-10-08 計画策定 / 2026-10-11 更新)
- **設計書**: [official_shim_direct_binding_implementation_plan.md](./1_driver/official_shim_direct_binding_implementation_plan.md)
- **詳細解析書**: [official_shim_interface_capabilities_analysis.md](./1_driver/archive/official_shim_interface_capabilities_analysis.md) (`📦 archived`)
- **基本原則**:
  - `win/shim/winshim.c` 等の公式NetHackコードには一切手を加えず、WebUIリポジトリ管理の独立ブリッジファイル **`src/driver/shim/shim_bridge.c`**（ビルド時に `win/shim/shim_bridge.c` へ自動同期）を 1 つリンクする「公式コード完全非侵襲エクステンション方式」を採用。
  - **単一汎用ディスパッチャー窓口 (`_shim_bridge_call`)**: 個別関数を乱立させず、Unix `ioctl` のように 1 つの窓口関数のみをエクスポート。Driverは透過中継に徹し、GKLが `SHIM_CMD_*` の定義とアンパックを司る。
  - 1マスずつWASM境界を往復するオーバーヘッドを排除し、単一呼び出しで「真の床 + 施錠フラグ + 明暗」をビットパック一括返却。
- **マイグレーションステップ**:
  - [x] **Stage 8.1: 単一窓口ブリッジ配備 ＆ ビルド・Driver汎用ゲートウェイ整備**
    - `src/driver/shim/shim_bridge.c`（単一エクスポート `_shim_bridge_call`）を新設、`scripts/build_wasm_50.ps1` で自動同期・ビルド
    - `NetHackMemory.js` に `bridgeCall(cmd, a1, a2, buf, len)` を実装
    - `WasmDirectBindingService.js` による基本的なドメイン抽出
  - [x] **Stage 8.2-A: Web Worker 隔離調停プロトコルの配備**
    - `NetHackWasmWorkerBridge.js` ↔ `nethack.worker.js` 間の非同期調停（`CALL_SHIM`, `GET_INVENTORY`）
    - ターン確定時（`WAITING_INPUT && isTopLevelTurn`）での 1 往復静止同期モデルの確立
  - [x] **Stage 8.2-B: inspector_console 連携型 公式Shim直接調停 ＆ フォールバック検証環境の構築**
    - [direct_binding_verification_environment_plan.md](./1_driver/archive/direct_binding_verification_environment_plan.md) (`📦 archived`)
    - `inspector_console.html` に「所持品同期方式（🟢SHIM vs 🔵MACRO）」および「足元床状態（🟢SHIM vs 🟡INFERRED 3992）」のランプ・インジケーターを新設
    - `DIRECT_BINDING_MODE`（`auto` / `strict` / `fallback`）の切替スイッチ（config / BroadcastChannel 送出）を配備
    - フォールバック完全遮断（`strict` モード）下で、直接調停が 100% 確実に稼働していることを実機・シナリオ・結合テストで検証可能にする (全135スイート・1,655テスト 100% PASS)
  - [x] **Stage 8.2-C: インベントリ・装備スロット・重量の完全直結 ＆ 床アイテムBUC判定**
    - `_shim_bridge_call` への一本化により個別C関数直接呼出を完全排除、キー入力待ち静止時 (Sync Barrier) に `EncumbranceStateManager.js` へ真の重量直結（推測誤差ゼロ）
    - `SHIM_CMD_DUMP_ALL_INVENT` (0x43) および `SHIM_CMD_DUMP_DESCR_INDEXES` (0x62) によるインベントリ・シャッフル外見の一括同期
    - `SHIM_CMD_GET_OBJECT_AT` (0x20) からの `nexthere` 走査により、地面・祭壇に置かれたアイテムの BUC 判定（`blessed` / `cursed` / `bknown`）をテキストパース不要で 100% 同定 (全135スイート・1,660テスト 100% PASS)
  - [x] **Stage 8.3-A: 真の地形・扉施錠・罠判定 ＆ モンスター直結**
    - `AreaStateManager.js`: `dumpLevelTerrain()` によるフロア全域 (80x21) 真の地形・階段一括ダンプおよび `stairCache` 描画依存の適正化・スリム化
    - `ActionSignalResolver.js` / `ContextActionEngine.js`: 扉の `flags`（`D_LOCKED` / `D_TRAPPED`）から最適な解錠・罠解除アクションを即時導出（罠なし扉への `#untrap` 誤表示を完全根絶）。`mpeaceful` / `mtame` により平和NPC・ペットへの攻撃メニュー抑制および攻撃エフェクト誤爆を完全防止 (全136スイート・1,670テスト 100% PASS)
  - [x] **【先行着手 1】ROADMAP 2.1: GKL Pure JS Client (main.js) モジュール分割＆オーケストレーター適正化**
    - [gkl_client_modularization_plan.ja.md](./2_client_ui/archive/gkl_client_modularization_plan.ja.md) (`📦 archived`)
    - `main.js` (2,364行 ➔ 618行、約74%削減) の神クラス解消。描画・レイアウト・多言語・盤面操作・UIファクトリ・DOMイベントを分離し、Stage 8.3-B 確定描画の受け入れ態勢を完了 (全136スイート・1,670テスト 100% PASS)。
  - [x] **【先行着手 2】ROADMAP 2.2: GKLPlugin モジュール分割・アーキテクチャ適正化**
    - [GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md](./3_gkl/GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md) (`🟢 implemented`)
    - `GKLPlugin.js` (2,613行 ➔ 482行、約81.5%削減) の神クラス解消。`GKLEventRouter`・`SilentSyncCoordinator`・`GKLFxCoordinator`・`InspectionService`・`AutoTravelService` を分離し、Stage 8.3-B の Sync Barrier / ターンライフサイクル調停をクリーンに導入可能な基盤を確立 (全137スイート・1,698テスト PASS)。
  - [x] **【先行着手 3】AreaStateManager 4モジュール分割・責務整理 (Spatial Grid / Inference / Landmark / Projector 分離)**
    - [AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md) (`🟢 implemented`)
    - `src/core/knowledge/state/AreaStateManager.js` (1,552行 ➔ 437行、約71.8%削減) の責務分離。`TerrainInferenceEngine.js`（地形・物理推論）、`DungeonLandmarkRegistry.js`（階段・ランドマーク・店舗台帳）、`ViewportTileProjector.js`（戦術視野・カメラ投影）へ分割し、Stage 8.3-B の投機的仮床撤廃・Commit駆動投影をピンポイントかつ安全に導入可能にする基盤を確立 (全138スイート・1,707テスト PASS)。
  - [x] **Stage 8.3-B: Shim-Driven 確定同期型レンダリング・パイプラインの刷新 (＆ §2.5 Sync Barrier 調停統合)**
    - [shim_driven_rendering_pipeline_architecture.ja.md](./2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md) (`🟢 implemented`) / [direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md](./1_driver/direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md) (`🟢 implemented`)
    - ターン同期ライフサイクル (Sync Barrier: Phase 1 ACTION ➔ Phase 2 STREAMING ➔ Phase 3 SETTLED & SHIM SYNC ➔ Phase 4 COMMIT `areaStateCommitted`) の確立と `--More--` 待機ガード (`isMorePromptActive`)・世代排他制御 (`_syncGeneration`) の統合
    - `TerrainInferenceEngine` / `ViewportTileProjector` における Direct Binding アクティブ時の投機的仮床推測（`3992`）副作用の完全根絶、および `STONE (0)` / `SDOOR (14)` / `SCORR (15)` の未踏・ネタバレ防止ガード
    - フロア全域 `dumpLevelTerrain()` の参照用ルックアップテーブル化（未踏領域の非表示化）および `curs` ➔ Sync Barrier 連動の足元 `cell.middle`（床落ちアイテム・山積み）確定更新・Commit 駆動フラッシュ制御 (全138スイート・1,718テスト PASS)
  - [ ] **Stage 8.3-C: Direct Binding 確定情報（Ground Truth）純化 ＆ 足元地形・インベントリ不具合是正 (最優先次期タスク)**
    - **設計・是正計画書**: [direct_binding_ground_truth_and_terrain_glyph_bugfix_plan.ja.md](./3_gkl/direct_binding_ground_truth_and_terrain_glyph_bugfix_plan.ja.md) (`⏸️ pending` / 原因特定・設計完了)
    - **基本原則（全ドメイン横断・排他ルーティング / 基本憲法6）**: Shim 直結経路 (`SHIM_DIRECT`) とレガシー推測・文字列解析経路 (`FALLBACK_INFERENCE`) を入口で完全分岐。**Tier 1（C 構造体 Ground Truth ＋ `known`/`dknown`/`bknown`/`seenv`） > Tier 2（`print_glyph` 目視確定属性） > Tier 3（`fallback` 時のみの文字列・推論）** の優先順位を厳守し、Direct Binding 稼働時に仮文字列を正規表現で再パースする逆流や仮床推測の上書きを全ドメインで遮断する。
    - **テストランク制度（Rank S/A/B/C）の導入と不要テスト整理**: 過去の旧仕様（文字列推測や仮床混在）を前提としたテストを通すために本番コードを歪める本末転倒を防止。[テストガイド (`docs/8_testing/README.md`)](./8_testing/README.md) に Rank S（絶対死守: SSOT/Direct Binding真値）〜 Rank C（廃止・削除対象: 旧内部実装依存）を定義し、トレードオフ発生時は Rank S/A を優先して Rank B は `fallback` 隔離、Rank C は積極的に削除・スリム化する。
    - **Cシム層拡張 (`shim_bridge.c`)**: `SHIM_CMD_DUMP_ALL_INVENT` および `SHIM_CMD_DUMP_OBJECT_INFO` に `o->corpsenm`（死体・像・缶詰のモンスター種別ID）と `o->known`（強化値・チャージ数既知フラグ）を追加出力。
    - **足元地形・像グリフ是正 (`TerrainInferenceEngine.js` / `AreaStateManager.js`)**:
      - 扉のないドア (`D_NODOOR` / `D_BROKEN` ➔ `3985`) が閉扉 (`3988`) になる不具合、および開扉移動時に目視確定済みの縦横向き (`3986` vs `3987`) が変わる不具合の修正。
      - 足元・所持品のモンスター像 (`onum: 476`)・死体 (`onum: 265`) が専用グリフ (`GLYPH_STATUE_OFF + corpsenm` / `GLYPH_BODY_OFF + corpsenm`) ではなく汎用オブジェクトグリフになる不具合の修正（旧番号 `295`/`474` のハードコード是正含む）。
    - **アイコンインベントリ・ナレッジ精度是正 (`glyphClassifier.js` / `InventoryStateManager.js` / `ItemIdentificationResolver.js` / `EquipmentRules.js`)**:
      - `glyphClassifier.js` の魔法書・杖 `onum` 境界ズレ是正（`SPELLBOOK: 366〜409`, `WAND: 410〜438`）。
      - `glittering spellbook` の末尾 `"ring"` 誤爆（指輪・装備コマンド化）および `turquoise spellbook` の宝石色誤爆（投擲 `t` コマンド化）の根絶。
      - 自作缶詰 (`onum: 296`) に内部フラグ `spe` が付与されて `"-2 tin"` となりナレッジが `"tin wand"`（錫の杖）に化ける不具合、および死体にモンスター名が付かない不具合の完全解消。
  - [ ] **Stage 8.4: ブランチ同定・お祈りタイマー・プレイヤー耐性直結**
    - `getPlayerSummary()` から `dnum` によるブランチ 100% 確定同定（`branch:dlvl` キャッシュ分離 ＆ 新エリア突入演出 `AREA_ENTERED` 発火）
    - `ublesscnt` をタイムライン燃料計（お祈りタイマー）へ直結（推測誤差ゼロ）
    - `SHIM_CMD_GET_PLAYER_PROPS` (0x32) から `uprops`（耐性配列）を抽出して `AttributeStateManager` へ注入

#### 🗺️ Phase 8 がもたらす「後続機能・構想への影響・恩恵マップ」
Phase 8 による C構造体メモリ直結によって、これまで「テキスト画面解析」や「複雑な推定・推論」に頼っていた多くの機能が、**確定情報（Ground Truth）の直接取得**へと劇的に単純化・堅牢化されます。

| 後続タスク / 構想 | これまでのアプローチ (推測・画面パース) | Phase 8 後のアプローチ (メモリ直結) | もたらされる劇的恩恵 |
| :--- | :--- | :--- | :--- |
| **Phase 7 Phase 3: 命名アシスト** | `\` 画面出力の文字列パース、店頭価格からの basePrice 逆算推定 | `SHIM_CMD_GET_OBJECT_AT` / `DUMP_ALL_INVENT` から `otyp`・買値・売値を直接取得 | 画面パース不要、誤判定ゼロ、未鑑定アイテムの仮名付与が $O(1)$ 確定 |
| **GKL ブランチ同定 & エリア演出** | メッセージや階段トポロジーからの推測（ゴースト階段リスク） | `dnum`（ダンジョン番号）直結 | 100% 確定同定。エリア突入バナー演出が完全な信頼性で発火 |
| **GKL タイムライン予測 (燃料計)** | メッセージ検知からの経過歩数逆算（セーブ再開でリセット） | `ublesscnt`（祈りクールダウン）および内部耐性配列直結 | コールドスタート問題ゼロ、推測誤差ゼロの真値燃料計 |
| **AreaStateManager 4分割** | 背景グリフ・仮床・大岩押しからの泥臭い空間推論 | `getCellInfo(x,y)` / `dumpLevelTerrain()` による真の床・罠・扉フラグの一括直結 | 空間推論コードの半分が不要化。シンプルな台帳・描画分離へ移行可能 |
| **ハイブリッド翻訳** | 英語メッセージ全文の正規表現マッチング・名詞抽出 | `struct obj` から ID・数量・祝福フラグを抽出しテンプレート埋め込み | 英語パースの組み合わせ爆発を根絶、辞書を18,000行➔1,500行へ90%削減 |
| **モダン総合インベントリ & 重量分析** | 画面パース・外部推定不可、文字一覧のみ | `struct obj` から重量・スタック数・BUC・可搬限界直結 | クラス別重量比率・積載限界警告・モダンRPG所持品コックピット実現 |


---

## ⏸️ 2. 設計完了・着手待ち (Wait / Pending / Ready)

仕様・設計が完了していますが、**「Phase 8 の完了待ち」** または **「次期着手スロット待ち」** として意図的にペンディングしているタスク群です。  
※なお、**2.1、2.2、および 2.5** は Stage 8.3-B（確定同期レンダリング）と共に完遂し、§4 へ移行済みです。

### 2.3 Phase 7 Phase 3: 命名アシスト ＆ GamePad候補選択 (Gap 2 対応)
- **ステータス**: `⏸️ pending` (Phase 8 完了待ち)
- **設計書**: [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md)
- **保留理由**: 画面テキストパースによる複雑な価格逆引きロジックを組むより、**Phase 8 で Cコアから直接アイテム情報（買値・売値・真名）を取得する方が圧倒的に安全でシンプル**になるため、Phase 8 完了まで意図的に着手を待機。
- **ステップ**:
  - [ ] Step 1: `DiscoveryStateManager.js` への Phase 8 価格・未鑑定直結
  - [ ] Step 2: `ItemCandidateResolver.js` によるワンタップ候補サジェストコア
  - [ ] Step 3: GamePad対応 候補選択ダイアログ (`<nh-call-candidate-dialog>`)

### 2.4 事後ナレッジ連携 ＆ 戦術アドバイザー刷新（残存部）
- **ステータス**: `⏸️ pending` (設計完了 / 連動待ち)
- **設計書**: [post_mortem_knowledge_and_tactical_advisor_redesign.ja.md](./7_futures/post_mortem_knowledge_and_tactical_advisor_redesign.ja.md)
- **現状**: `tools/scoreboard.html` および `PostMortemKnowledgeResolver.js`（多段構文解析・RCA調停）は実装完了。残る「未接続アドバイス（マインドフレア、グリーンスライム等）の包括バインド」および「50+件の死因検証ベンチマークテスト」が着手待ち。

### 2.6 床アイテム・コンテナ・死体の Direct Binding 完全化 ＆ 覗き見知恵（Peek Wisdom）統合
- **ステータス**: `⏸️ pending` (2026-10-11 設計策定 / Stage 8.3-C と連動して着手可能)
- **設計書**: [floor_item_direct_binding_and_peek_wisdom_architecture.ja.md](./3_gkl/floor_item_direct_binding_and_peek_wisdom_architecture.ja.md) / [direct_binding_ground_truth_and_terrain_glyph_bugfix_plan.ja.md](./3_gkl/direct_binding_ground_truth_and_terrain_glyph_bugfix_plan.ja.md)
- **対象コード**: `src/core/knowledge/state/AreaStateManager.js`, `src/core/knowledge/presenters/ItemSpecPresenter.js`, `src/components/NhKnowledgeCard.js`
- **概要**: `syncPlayerFeetFloor()` で取得済みの C 構造体 (`struct obj`) 全フィールド（`spe`, `locked`, `broken`, `corpsenm`, `age`, `quan` 等）を欠落なく `AreaStateManager` / `NhKnowledgeCard` へ伝搬し、ネタバレ防止ルール（Known ガード）を維持したまま「覗き見知恵（Peek Wisdom）」を統合表示する（※ `shim_bridge.c` の `corpsenm`・`known` 拡張は Stage 8.3-C と共通基盤）。

---

## 💡 3. 構想・将来バックログ (Backlog / Ideas)

設計構想・アイデアが策定されている将来検討項目です。

### 3.1 Phase 8 直結の恩恵を強く受ける構想群
- **シグナル駆動ハイブリッド翻訳 ＆ 辞書スリム化構想**:
  - 設計書: [signal_driven_hybrid_translation_architecture.ja.md](./9_translation/signal_driven_hybrid_translation_architecture.ja.md)
  - 概要: 18,000行辞書を1,000〜1,500行へ90%削減。Phase 8 の `struct obj` から名詞スロットを直接埋め込む。
- **GKL ブランチ検出・フロアキャッシュ分離 ＆ エリア突入アナウンス演出構想**:
  - 設計書: [Branch_Detection_and_Area_Announcement_Architecture.ja.md](./3_gkl/Branch_Detection_and_Area_Announcement_Architecture.ja.md)
  - 概要: Phase 8 の `dnum` 直結により同一度数（Dlvl:3等）のキャッシュ混線を完全解消。新エリア突入バナー（`<nh-area-banner>`）と演出音響。
- **GKL タイムライン予測エンジン：神のご機嫌管理＆燃料計 (Prayer Tracker & Fuel Gauge)**:
  - 設計書: [nethack_fuel_gauge_spec.md](./7_futures/nethack_fuel_gauge_spec.md)
  - 概要: Phase 8 の `ublesscnt` / 耐性直結により、お祈りクールダウンと航続歩数を誤差ゼロで可視化。
- **GKL 空間幾何学認識エンジン ＆ ダンジョントラッカー (＋ AreaStateManager 4分割整理)**:
  - 設計書: [AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md), [Spatial_Pattern_Engine_Architecture.md](./3_gkl/Spatial_Pattern_Engine_Architecture.md), [Dungeon_Tracker_and_Checkpoint_Architecture.md](./3_gkl/Dungeon_Tracker_and_Checkpoint_Architecture.md)
  - 概要: Phase 8 の `getCellInfo` / `dumpLevelTerrain` 直結により、真の床推論をバイパス。空間グリッド、ランドマーク台帳、描画プロジェクターを疎結合化。
- **啓蒙ダイアログシグナル化による隠れステータス横取り**:
  - 設計書: [enlightenment_dialog_signal_and_state_interception_architecture.ja.md](./7_futures/enlightenment_dialog_signal_and_state_interception_architecture.ja.md)
  - 概要: 魔法の啓蒙（`MAGICENLIGHTENMENT`）ダイアログの専用モーダルUI化と Direct Binding 非稼働時のステータス補正。
- **モダン総合インベントリダイアログ ＆ 重量アナリティクス構想 (`i`キー専用UI)**:
  - 設計書: [modern_inventory_dialog_and_weight_analytics_architecture.ja.md](./7_futures/modern_inventory_dialog_and_weight_analytics_architecture.ja.md)
  - 概要: Phase 8 の真の重量・BUC直結により、クラス別重量構成比バー、積載境界警告、モダンRPG風の2ペイン所持品コックピット（詳細カード＆クイックアクション）を実現。
- **足元山積み（Floor Pile）の二画面ファイラー統合 ＆ ダイアログ操作系（Key/Pad）完全統一構想**:
  - 設計書: [floor_pile_filer_and_dialog_navigation_architecture.ja.md](./7_futures/floor_pile_filer_and_dialog_navigation_architecture.ja.md)
  - 概要: `ContainerController` の `turn_ready` 起点・1操作1レシピ設計と Phase 8 `SHIM_CMD_GET_OBJECT_AT` を応用し、足元の山積み（`,` 拾う ⇄ `d` 置く）を二画面コンテナUI（`ContainerModal`）でシームレスに整理可能にする。**※着手前提条件：ダイアログが開くたびにキーボードとマウスで手が移動してしまう課題を解消するため、全ダイアログのキーボード／ゲームパッド操作最適化（[`modal_interaction_and_navigation_guide.ja.md`](./2_client_ui/modal_interaction_and_navigation_guide.ja.md) 準拠）を先行完了させること。**
- **コンテキスト連動型・岩盤（STONE）可視化 ＆ 掘削アシストレンダリング構想**:
  - 設計書: [context_aware_stone_and_digging_rendering_concept.ja.md](./7_futures/context_aware_stone_and_digging_rendering_concept.ja.md)
  - 概要: 普段は通路・部屋の構造がくっきり見やすい「黒抜き」を維持しつつ、つるはし・穴掘りの杖等で `ContextActions` に「掘る」指示が出るときや自キャラの周辺狭域視野（トーチライト範囲）に限り、通路脇の観測済み岩盤（`STONE`: `glyph 3917` / `typ 0`）を浮かび上がらせるスマート描画拡張。


### 3.2 独立した長期構想群
- **外部ナレッジ連携 (NetHackWiki) ＆ 翻訳モード連動 Web ジャンプ構想**:
  - 設計書: [external_wiki_knowledge_linking_architecture.ja.md](./7_futures/external_wiki_knowledge_linking_architecture.ja.md)
  - 概要: モンスター・アイテム・伝承からNetHackWikiへワンクリックジャンプ。
- **ヘルプ専用ダイアログ化 ＆ 外部ドキュメント連携構想**:
  - 設計書: [help_dialog_and_external_doc_system_architecture.ja.md](./7_futures/help_dialog_and_external_doc_system_architecture.ja.md)
  - 概要: CUI英文ヘルプに代わる、WebUI最適化ガイドモーダル（`HelpGuideModal`）と外部翻訳連携。

---

## 🟢 4. 実装完了コア機能・現行仕様 (Living Specs)

すでに実装が完了し、テストが通過（**全138スイート・1,718テスト 100% PASS**）しており、現在の動作の正解（Single Source of Truth）となっている機能群です。

| ドメイン | 機能・仕様書 | 主要ソースコード | 状態 | 概要 |
| :--- | :--- | :--- | :---: | :--- |
| **全体・横断** | **[SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md)** | `src/` 全体 | `🟢 implemented` | **システム現有能力カタログ＆責務境界・統廃合・ギャップ分析**<br>通信・同期、状態解析、データ・伝承、UI調停、基本憲法、重複整理、未接続パイプラインの公式総合カタログ |
| **描画・同期** | [shim_driven_rendering_pipeline_architecture.ja.md](./2_client_ui/shim_driven_rendering_pipeline_architecture.ja.md)<br>[direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md](./1_driver/direct_binding_idle_arbitration_and_more_prompt_coordination_plan.ja.md) | `GKLEventRouter.js`<br>`WasmDirectBindingService.js`<br>`TerrainInferenceEngine.js`<br>`ViewportTileProjector.js`<br>`VirtualDungeonScreen.js`<br>`MainViewportRenderer.js` | `🟢 implemented` | **Shim-Driven 確定同期レンダリング・パイプライン ＆ Sync Barrier 調停 (Stage 8.3-B & §2.5: 2026-10-11)**<br>4フェーズ Turn Lifecycle（`userActionSent` ➔ Streaming ➔ Sync Barrier ➔ `areaStateCommitted`）、`--More--` 待機ガード (`isMorePromptActive`)、世代管理による遅延同期破棄、Direct Binding 時の投機的仮床（`3992`）完全根絶、未踏領域非表示化 ＆ `curs` 連動の足元 `cell.middle` 確定同期フラッシュ |
| **GKL・空間** | [AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md) | `src/core/knowledge/state/AreaStateManager.js`<br>`src/core/knowledge/state/area/` | `🟢 implemented` | **AreaStateManager 4モジュール分割 ＆ 空間状態オーケストレーター (Phase 8 先行3: 2026-10-11)**<br>`AreaStateManager.js` を 1,552行 ➔ 437行（約71.8%削減）へスリム化。`TerrainInferenceEngine`, `DungeonLandmarkRegistry`, `ViewportTileProjector` を分離し 100% 後方互換ファサード化 |
| **GKL・設計** | [GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md](./3_gkl/GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md) | `src/core/knowledge/GKLPlugin.js`<br>`src/core/knowledge/coordinators/`<br>`src/core/knowledge/services/` | `🟢 implemented` | **GKLPlugin モジュール分割 ＆ アーキテクチャ適正化 (ROADMAP 2.2: 2026-10-11)**<br>`GKLPlugin.js` を 2,613行 ➔ 482行（約81.5%削減）へスリム化。`SilentSyncCoordinator`, `GKLEventRouter`, `GKLFxCoordinator`, `InspectionService`, `AutoTravelService` を分離し 100% 後方互換ファサード化 |
| **UI・設計** | [gkl_client_modularization_plan.ja.md](./2_client_ui/archive/gkl_client_modularization_plan.ja.md) | `examples/gkl-pure-js-client/main.js`<br>`examples/gkl-pure-js-client/modules/` | `🟢 implemented` | **GKL Pure JS Client (main.js) モジュール分割 ＆ オーケストレーター適正化 (ROADMAP 2.1: 2026-10-11)**<br>`main.js` を 2,364行 ➔ 618行（約74%削減）へスリム化。多言語・レイアウト・FX・起動・盤面操作を独立モジュールへ分離 |
| **戦歴・スコア** | [post_mortem_knowledge_and_tactical_advisor_redesign.ja.md](./7_futures/post_mortem_knowledge_and_tactical_advisor_redesign.ja.md) | `tools/scoreboard.html`<br>`PostMortemKnowledgeResolver.js`<br>`GameOverResolver.js` | `🟢 implemented` | **公式 xlogfile 準拠スコアボード ＆ 事後ナレッジ構文解析 (2026-10-08)**<br>公式戦歴ビュワー、NetHack 5.0 `formatkiller()` 構文解析（Prefix/Core/Suffix分解）、根本原因調停 (RCA) コア |
| **品質・堅牢化** | [bugfix_plan_oracles_explore_attackfx.ja.md](./6_project_reports/archive/bugfix_plan_oracles_explore_attackfx.ja.md) | `WebUICore.js`<br>`GKLPlugin.js`<br>`AdventureLogManager.js` | `🟢 implemented` | **3大不具合是正 ＆ 品質堅牢化 (2026-10-08)**<br>信託テキストウィンドウ検知＆大予言一括管理（OOM解消）、exploreランキング除外＆死因SSOT化、攻撃FX誤爆完全抑止 |
| **操作・動的知識** | [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md) | `OnDemandLookupService.js`<br>`NhKnowledgeCard.js`<br>`NhDiscoveryCodex.js` | `🟢 implemented` | **標準操作プログレッシブ拡張 Phase 1 (2026-10-02)**<br>`/` 動的サイレントクエリ、3層統合ナレッジカード（基本・攻撃・文学引用）、`\` 発見済みアイテム真名・外見対照図鑑 |
| **伝承・冒険手帳** | [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md) | `tools/adventure_log.html`<br>`AdventureLogManager.js`<br>`NhCodexGrid.js` | `🟢 implemented` | **標準操作プログレッシブ拡張 Phase 2 (2026-10-03)**<br>独立冒険手帳画面、セッション横断メタ進行管理、シルエット解禁グリッド、モンスター公式攻撃データ3,767行 |
| **音響・調停** | [sound_coordinator_and_multidriver_architecture.ja.md](./4_sound/sound_coordinator_and_multidriver_architecture.ja.md) | `SoundCoordinator.js`<br>`SoundArbiter.js`<br>`SoundEngine.js`<br>`src/core/sound/drivers/` | `🟢 implemented` | **統合サウンドコーディネーター ＆ 音響駆動ドライバ分離 (Phase 6: 2026-10-02)**<br>照合・調停・駆動の3層完全分離。プラガブル・マルチドライバ（Wave, PsgBeep, ProceduralSynth）、Headless調停エンジン、100%後方互換ファサード |
| **入力・パッド** | [gamepad_console_mode_architecture.ja.md](./7_futures/gamepad/gamepad_console_mode_architecture.ja.md) | `GamepadInputController.js`<br>`RadialInputRecognizer.js`<br>`examples/console-client/` | `🟢 implemented` | **ゲームパッド操作体系 ＆ Console Client PoC (2026-10-01)**<br>ラジアルメニュー認識、シレン風インベントリドロワー、独立コンソールクライアントレファレンス配備 |
| **Driver・WASM** | [nethack_version_upgrade_guide.ja.md](./1_driver/nethack_version_upgrade_guide.ja.md) | `NetHackWasmDriver.js`<br>`NetHackMemory.js`<br>`src/driver/shim/shim_bridge.c` | `🟢 implemented` | **NetHack 5.0.1 移行 ＆ 公式コード非侵襲 Driver + Phase 8 Bridge (2026-10-11)**<br>5.0.1 (Commit c1b1b08) 追従。`winshim.c` 完全無改造＋単一外付け `shim_bridge.c` で動作する非侵襲アーキテクチャ確立 |
| **音響・シンセシス** | [dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md) | `ProceduralSynthDriver.js`<br>`SoundEventCatalog.js` | `🟢 implemented` | **動的音程シンセシス (Dynamic Musical Synthesis / Stage 5.6)**<br>外部音源不要(容量ゼロ)のWeb Audio APIオシレーター合成。きしむ床12音階、モンスター咆哮(ピッチベンド/和音/AM/FM/パルス)、楽器演奏・城の跳ね橋5音メロディ |
| **品質・i18n** | [stage5_5_quality_assurance_and_i18n.ja.md](./7_futures/archive/phase5/stage5_5_quality_assurance_and_i18n.ja.md) | `MessageContextResolver.js`<br>`tests/unit/robustness.test.js` | `🟢 implemented` | **言語非依存ロジック確立と総合品質保証 (Stage 5.5)**<br>二重キーワード完全根絶、多言語拡張ファクトリ（`createForVariant`）、翻訳非依存テスト実証、全クライアントビルド100%成功 |
| **音響・状態** | [stage5_4_domain_modules_migration.ja.md](./7_futures/archive/phase5/stage5_4_domain_modules_migration.ja.md) | `SoundCoordinator.js`<br>`AttributeStateManager.js`<br>`DiscoveryStateManager.js` | `🟢 implemented` | **ドメイン別既存モジュールのメッセージマスタ移行 (Stage 5.4)**<br>効果音 O(1) 決定論的発火＆スタガード遅延（60ms）、耐性マネージャ O(1) 確定更新、道具識別効果メッセージ真名自動昇格 |
| **UI・基盤** | [ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md) | `src/ui-controller/`<br>`src/components/`<br>`<nh-*>` | `🟢 implemented` | **UIController (Headless UI) ＆ Web Components 共通基盤 (Phase E)**<br>防腐層抽出（HUD・モーダルスタック・入力調停・ペーパードール・コンテナ・設定）、共通 Custom Elements（`<nh-*>`）、Nehww への逆輸入・最適化完了 |
| **UI・体験** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/archive/gkl_client_ui_ux_modernization_plan.ja.md)<br>[immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `FloatingMessageHud.js`<br>`MessageHistoryDrawer.js`<br>`MainViewportRenderer.js`<br>`WebGPUHD2DRenderer.js`<br>`base.css` | `🟢 implemented` | **GKL レファレンスクライアント (Nehww) UI/UX 刷新 (Phase A〜D)**<br>全画面マップ（100vw×100vh）、フローティング最新行HUD＋過去ログドロワー、足元枠3Dパース吸着、スマートContextActions、Neo-Retro Dark Glass UI統一 |
| **UI・デザイン** | [dialog_design_system_unification_concept.ja.md](./2_client_ui/archive/dialog_design_system_unification_concept.ja.md) | `base.css`<br>`modals.css`<br>各種モーダル CSS | `🟢 implemented` | **モーダル・ダイアログ群デザインシステム統一 (Dark Glass UI)**<br>デザイントークン一元化（`--glass-bg`, `--glass-blur`, `--glass-border`, `--primary-color: #38bdf8`）、金枠・スレート枠のバラつき解消、全モーダル共通規格化 |
| **UI・操作性** | [modal_interaction_and_navigation_guide.ja.md](./2_client_ui/modal_interaction_and_navigation_guide.ja.md) | `src/components/`<br>`src/ui-controller/`<br>`ModalManager.js` | `🟢 guideline` | **モーダル操作性＆ナビゲーション統合設計ガイド**<br>完全キーボード/パッド完結（3大アクセシビリティ）、3大レイアウトトポロジー（縦リスト/2Dグリッド/2ペイン複合）、3層協調アーキテクチャ（入力・Headless・描画） |
| **メッセージ** | [immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `WebUICore.js`<br>`NetHackWasmDriver.js` | `🟢 implemented` | **メッセージライフサイクル＆抑止制御**<br>モーダル（アイテム選択等）中のメッセージ抑止（`suppressMessage`）、構造化ログ（`bubbleMessage`, `messageItem`, `messageUpdate`）の一元配信 |
| **対話・制御** | [stage5_3_interaction_context_and_actions.ja.md](./7_futures/archive/phase5/stage5_3_interaction_context_and_actions.ja.md) | `InteractionContext.js`<br>`ActionSignalResolver.js`<br>`SituationCache.js` | `🟢 implemented` | **対話コンテキスト ＆ アクション導出基盤 (Stage 5.3)**<br>空間距離維持（チェビシェフ距離 $\le 1$）による対話維持、施錠箱・扉へのワンタップ推奨アクション（IRCレシピ連携） |
| **メッセージ** | [stage5_2_situation_signals.ja.md](./7_futures/archive/phase5/stage5_2_situation_signals.ja.md) | `MessageContextResolver.js`<br>`ContextFrameBuffer.js`<br>`build_message_context_catalog.py` | `🟢 implemented` | **状況シグナル基盤 (第1層) ＆ 実行時コンテキスト照合 (Stage 5.2)**<br>完全ASCII軽量カタログ(154.3KB)、三項演算子展開＆ノイズ排除、超高速同定(平均 0.0054ms)、翻訳責務完全分離 |
| **伝承・GKL** | [stage5_1_lore_gkl_migration.ja.md](./7_futures/archive/phase5/stage5_1_lore_gkl_migration.ja.md) | `src/core/knowledge/lore/`<br>`GKLPlugin.js` | `🟢 implemented` | **LORE / Codex の GKL 移設と責務純化 (Stage 5.1)**<br>`WebUICore` からのシグナルPub/Sub化、後方互換プロキシ委譲、知識層へのドメイン集約 |
| **操作・UI** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/archive/gkl_client_ui_ux_modernization_plan.ja.md) | `CharacterIntroModal.js`<br>`ModalManager.js` | `🟢 implemented` | **ゲーム開始導入フロー最適化 (Phase C)**<br>冒険者名入力の中央カード化・ランダムネーム生成・3大作成モードカード（おまかせ/手動/即開始）連携 |
| **画面・描画** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/archive/gkl_client_ui_ux_modernization_plan.ja.md) | `WebGPUHD2DRenderer.js`<br>`MainViewportRenderer.js` | `🟢 implemented` | **自キャラ足元枠 Middle レイヤー最適化 ＆ 3D パース吸着 (Phase A)**<br>床面 $Y=0.01$ (Layer 3.2) 配置、深度テストによる自然な足元表現、ターゲットカーソル立体結線枠 |
| **画面・描画** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/archive/gkl_client_ui_ux_modernization_plan.ja.md) | `WebGPUHD2DRenderer.js`<br>`MainViewportRenderer.js`<br>`glyphClassifier.js`<br>`StructuredKnowledgeEngine.js` | `🟢 implemented` | **Pet / Ridden / piletop 視覚的強調 ＆ ナレッジバッジ連携 (Phase A+)**<br>統一ミニバッジ (♥ / R / +)、Middle レイヤー (Layer 3.3) 足元サークル描画、ナレッジカード・モーダル・ContextActions への `📚 山積み (PileTop)` (`isPile`) バッジ伝搬 |
| **操作・UI** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/archive/gkl_client_ui_ux_modernization_plan.ja.md) | `FloatingContextActions.js`<br>`DirectionPad.js`<br>`main.js` | `🟢 implemented` | **スマート ContextActions フローティングメニュー (Phase B)**<br>マップクリック対象（敵/足元/地形）直上ポップアップ、移動暴発抑止、右クリック標準化 |
| **GKL / UI** | - | `KnowledgeDetailModal.js`<br>`NhKnowledgeCard.js` | `🟢 implemented` | **詳細ナレッジモーダル / 統合ナレッジカード**<br>サイドパネルのコンパクト化、クリック時の専用詳細モーダル（危険度・戦術・ステータス・効果・文学引用） |
| **伝承・GKL** | [Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md](./3_gkl/Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md) | `LoreMasterData.js`<br>`CodexModal.js`<br>`enrich_lore_entities.js`<br>`lore_codex.html` | `🟢 implemented` | **伝承・構造化知識クロスリファレンス (Lore Cross-Ref)**<br>Rumors/Oraclesとモンスター・アイテム相互紐付け、Codexミニスペック連携、キュレーションツール |
| **画面・描画** | [unified_renderer_and_screen_architecture_plan.md](./2_client_ui/unified_renderer_and_screen_architecture_plan.md) | `VirtualDungeonScreen.js`<br>`MainViewportRenderer.js`<br>`MinimapHudRenderer.js` | `🟢 implemented` | **仮想スクリーン統合レンダラー (Phase 1〜3)**<br>オフスクリーン統合、フォーカス追従、ミニマップスマート自動退避 |
| **画面・描画** | [webgpu_hd2d_diorama_renderer.ja.md](./2_client_ui/webgpu_hd2d_diorama_renderer.ja.md) | `WebGPUHD2DRenderer.js` | `🟢 implemented` | **WebGPU HD-2D ジオラマレンダラー**<br>生WGSLシェーダー、クオータビュー、動的ランタン視界、テスト完備 |
| **伝承・考古学** | - | `src/core/knowledge/lore/LoreCodex.js`<br>`src/core/knowledge/lore/LoreDetector.js`<br>`LoreModal.js` | `🟢 implemented` | **冒険手帳・伝承図鑑 (RUMOR & LORE CODEX)**<br>噂・神託・墓碑銘のアンロックとモーダル閲覧UI |
| **伝承・考古学** | - | `EngravingArchaeologist.js`<br>`EngravingHud.js`<br>`ElberethAnalyzer.js` | `🟢 implemented` | **床文字考古学復元 (Engraving)**<br>かすれ文字推測、Elbereth結界判定、HUDバナー、再刻みボタン |
| **操作・操作性** | [PLAYER_GUIDE.md](../examples/gkl-pure-js-client/PLAYER_GUIDE.md) | `DirectionPad.js`<br>(全クライアント) | `🟢 implemented` | **方向パッド (DirectionPad) コンテキスト操作**<br>長押し移動、ダブルタップダッシュ、全クライアント展開 |
| **GKL** | [Equipment_Paperdoll_and_Dependency_Architecture.md](./3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md) | `src/core/knowledge/equipment/`<br>`PaperdollModal.js` | `🟢 implemented` | **装備ペーパードールUI ＆ 換装プランナー (Phase 1〜3)**<br>3層構造解析、換装シミュレーション、部位スロットUI、Stage 8.2-C 装備ポインタ直結 |
| **GKL** | [Encumbrance_and_Weight_Management_Architecture.md](./3_gkl/Encumbrance_and_Weight_Management_Architecture.md) | `src/core/knowledge/state/`<br>`EncumbrancePresenter.js` | `🟢 implemented` | **インベントリ重量・負荷状態管理**<br>Stage 8.2-C 真の総重量直結＋手動合算フォールバック、プログレスゲージ、リスク状態ランプ |
| **UI / 支援** | [gkl_intelligent_ui_ideas.ja.md](./7_futures/archive/gkl_intelligent_ui_ideas.ja.md) | `CharacterCreationModal.js`<br>`WriteModal.js`<br>`WishModal.js`<br>`GenocideModal.js`<br>`PolymorphModal.js` | `🟢 implemented` | **インテリジェント入力支援ダイアログ群**<br>キャラ作成、巻物書き込み、願い、虐殺、変化制御の専用GUI |
| **GKL / UI** | [Container_Interaction_Specification_IRC.md](./3_gkl/Container_Interaction_Specification_IRC.md) | `src/core/container/`<br>`ContainerModal.js` | `🟢 implemented` | **二画面ファイラー型コンテナUI (IRC & SafetyGuard)**<br>アトミック出し入れ、手品袋爆発防止、金貨対応 |
| **GKL** | [TacticalAdvisor_Specification_and_Architecture.md](./3_gkl/TacticalAdvisor_Specification_and_Architecture.md) | `src/core/knowledge/engines/`<br>`TacticalAdvisor.js` | `🟢 implemented` | **データ駆動型戦術アドバイザー**<br>危険モンスター警告、狂犬病(Lycanthropy)対策等（7系統評価エンジン） |
| **GKL** | [Assist_Signal_and_Stance_Architecture.md](./3_gkl/Assist_Signal_and_Stance_Architecture.md) | `src/core/knowledge/engines/`<br>`AssistSignalSynthesizer.js` | `🟢 implemented` | **スタンス・アシストシグナル合成** |
| **GKL** | [gkl_documentation.md](./3_gkl/gkl_documentation.md) | `src/core/knowledge/` | `🟢 implemented` | **GKL 総合アーキテクチャ・プラグイン構造** |
| **GKL** | [GKL_Visual_FX_Event_Architecture.md](./3_gkl/GKL_Visual_FX_Event_Architecture.md) | `src/core/knowledge/` | `🟢 implemented` | **視覚演出 (Visual FX) イベントアーキテクチャ** |
| **GKL** | [GKL_Structured_Knowledge_Usage_Guide.md](./3_gkl/GKL_Structured_Knowledge_Usage_Guide.md) | `src/core/knowledge/data/` | `🟢 implemented` | **構造化知識ベース (384体・481アイテム・アーティファクト)** |
| **Core / UI** | [Interactive_Request_Controller_Architecture_and_Roadmap.md](./2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md) | `src/core/request/` | `🟢 implemented` | **連続リクエストコントローラ (IRC) ＆ 制御シグナル同定基盤** |
| **Core / UI** | [WebUICore_Usage_Guide.md](./2_client_ui/WebUICore_Usage_Guide.md) | `src/core/WebUICore.js` | `🟢 implemented` | **WebUICore 利用ガイド** |
| **Driver** | [driver_core_spec.md](./1_driver/driver_core_spec.md) | `src/driver/NetHackWasmDriver.js` | `🟢 implemented` | **Web Worker WASM コア駆動ドライバ** |
| **Testing** | [README.md (テストガイド)](./8_testing/README.md) | `tests/` | `🟢 implemented` | **Vitest 全自動テスト基盤 (全138スイート・1,718テスト 100% PASS)** |
| **Translation** | [DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md) | `dictionary.csv`, `tools/` | `🟢 implemented` | **翻訳辞書・CSV相互変換運用ガイド** |

---

## 📦 5. 完了済みマイルストーン・アーカイブ記録 (Completed Milestones & Archives)

過去の検討経緯や完了済みプロジェクトレポート、旧アーキテクチャ資料です。

- **直近引き継ぎ・状況評価レポート**:
  - **[handover_20261008_status_reevaluation.ja.md](./6_project_reports/handover_20261008_status_reevaluation.ja.md)** (NetHack 5.0.1 追従、Phase 6 マルチドライバ分離完遂、Phase 7 冒険手帳/ナレッジカード完遂、3大不具合是正)
  - [handover_20260929_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260929_status_reevaluation.ja.md) (Phase E / Phase 5 完遂、Web Audio API 動的音程シンセシス、現有能力カタログ、1,300テスト通過)
  - [handover_20260921_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260921_status_reevaluation.ja.md) (レンダラー統合、WebGPU HD-2D、LORE、ペーパードール完成)
  - [handover_20260914_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260914_status_reevaluation.ja.md) (IRC基盤、コンテナUI完成)
- **アーキテクチャ意思決定**: [ArchitectureDecisionRecord.md](./3_gkl/archive/ArchitectureDecisionRecord.md) (`📦 archived`)
- **各カテゴリのアーカイブフォルダ**:
  - `docs/1_driver/archive/`: 公式Shim能力解析書、Stage 8.2-B 検証環境計画書、旧ロードマップ・C層Shim調査メモ
  - `docs/2_client_ui/archive/`: GKLクライアントUI刷新計画(Phase A〜D)、main.jsモジュール分割計画、ダイアログデザイン統一構想、Web Components規約、旧入力仕様等
  - `docs/3_gkl/archive/`: ADR（意思決定記録）、旧SSOT統合計画、初期コンテナUI設計書等
  - `docs/4_sound/archive/`: 旧 SoundEngine 単一クラス仕様書 (`sound_system_spec.md`)、C層 soundprocs 調査メモ
  - `docs/5_gamedata/archive/`: 店主仕様・アイテム効果レポート等
  - `docs/6_project_reports/archive/`: 過去の引き継ぎ資料・進捗報告書群・不具合是正計画書
  - `docs/7_futures/archive/`: 完遂済み Phase 5 詳細計画群（全6ステージ）、旧マイクロカーネル構想、旧Gamepad独立クライアント構想等
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
