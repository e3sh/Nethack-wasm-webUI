---
title: NetHack WASM WebUI プロジェクト総合ロードマップ＆進捗ダッシュボード
status: living-document
last_updated: 2026-10-08
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
- **ステータス**: `🚧 in-progress` (最優先フォーカス, 2026-10-08 計画策定)
- **設計書**: [official_shim_direct_binding_implementation_plan.md](./1_driver/official_shim_direct_binding_implementation_plan.md)
- **詳細解析書**: [official_shim_interface_capabilities_analysis.md](./1_driver/official_shim_interface_capabilities_analysis.md)
- **基本原則**:
  - `win/shim/winshim.c` 等の公式NetHackコードには一切手を加えず、独立した専用ブリッジファイル **`win/shim/shim_bridge.c`** を 1 つ新規追加・リンクする「公式コード完全非侵襲エクステンション方式」を採用。
  - **単一汎用ディスパッチャー窓口 (`shim_bridge_call`)**: 個別関数を乱立させず、Unix `ioctl` のように 1 つの窓口関数のみをエクスポート。Driverは透過中継に徹し、GKLが `SHIM_CMD_*` の定義とアンパックを司る。
  - 1マスずつWASM境界を往復するオーバーヘッドを排除し、単一呼び出しで「真の床 + 施錠フラグ + 明暗」をビットパック一括返却。
- **マイグレーションステップ**:
  - [ ] **Stage 8.1: 単一窓口ブリッジ配備 ＆ ビルド・Driver汎用ゲートウェイ整備**
    - `win/shim/shim_bridge.c`（単一エクスポート `shim_bridge_call`）を新設、`nethack_files.rsp` および `nethack_flags.rsp` に追記してビルド
    - `NetHackMemory.js` に `bridgeCall(cmd, a1, a2, buf, len)` を 1 つだけ実装
    - `NetHackWasmDriver.js` の `shim_add_menu` で `rawObjPtr` をディスパッチ
  - [ ] **Stage 8.2: コンテナ・アイテム・所持重量の完全直結**
    - `NetHackObjectSchema.js` を新設し、`Module._weight()` / `Module._inv_weight()` を `EncumbranceStateManager` へ直結
    - 地面に落ちているアイテムの BUC 判定（`SHIM_CMD_GET_OBJECT_AT` ➔ `obj->blessed/cursed/bknown`）をナレッジカードへ連携
  - [ ] **Stage 8.3: 真の地形・扉施錠・罠判定 ＆ モンスターPeaceful直結**
    - `WasmDirectBindingService.js` を新設（`SHIM_CMD_*` 定数とアンパック群）
    - `AreaStateManager.js`: `getCellInfo(x, y)` により足元の真の床を即時確定（仮床推測をバイパス）
    - `ActionSignalResolver.js`: 扉の `flags`（`D_LOCKED` / `D_TRAPPED`）から最適な解錠・罠解除アクションを即時導出。`mpeaceful` / `mtame` により攻撃エフェクト誤爆を完全防止
  - [ ] **Stage 8.4: ブランチ同定・お祈りタイマー・プレイヤー耐性直結**
    - `getPlayerSummary()` から `dnum` によるブランチ 100% 確定同定（`branch:dlvl` キャッシュ分離 ＆ 新エリア突入演出 `AREA_ENTERED` 発火）
    - `ublesscnt` をタイムライン燃料計（お祈りタイマー）へ直結（推測誤差ゼロ）
    - `SHIM_CMD_GET_PLAYER_PTR` から `uprops`（耐性配列）を抽出して `AttributeStateManager` へ注入

#### 🗺️ Phase 8 がもたらす「後続機能・構想への影響・恩恵マップ」
Phase 8 による C構造体メモリ直結によって、これまで「テキスト画面解析」や「複雑な推定・推論」に頼っていた多くの機能が、**確定情報（Ground Truth）の直接取得**へと劇的に単純化・堅牢化されます。

| 後続タスク / 構想 | これまでのアプローチ (推測・画面パース) | Phase 8 後のアプローチ (メモリ直結) | もたらされる劇的恩恵 |
| :--- | :--- | :--- | :--- |
| **Phase 7 Phase 3: 命名アシスト** | `\` 画面出力の文字列パース、店頭価格からの basePrice 逆算推定 | `SHIM_CMD_GET_OBJECT_AT` / `inv_item` から `otyp`・買値・売値を直接取得 | 画面パース不要、誤判定ゼロ、未鑑定アイテムの仮名付与が $O(1)$ 確定 |
| **GKL ブランチ同定 & エリア演出** | メッセージや階段トポロジーからの推測（ゴースト階段リスク） | `dnum`（ダンジョン番号）直結 | 100% 確定同定。エリア突入バナー演出が完全な信頼性で発火 |
| **GKL タイムライン予測 (燃料計)** | メッセージ検知からの経過歩数逆算（セーブ再開でリセット） | `ublesscnt`（祈りクールダウン）および内部耐性配列直結 | コールドスタート問題ゼロ、推測誤差ゼロの真値燃料計 |
| **AreaStateManager 4分割** | 背景グリフ・仮床・大岩押しからの泥臭い空間推論 | `getCellInfo(x,y)` による真の床・罠・扉フラグの一括直結 | 空間推論コードの半分が不要化。シンプルな台帳・描画分離へ移行可能 |
| **ハイブリッド翻訳** | 英語メッセージ全文の正規表現マッチング・名詞抽出 | `struct obj` から ID・数量・祝福フラグを抽出しテンプレート埋め込み | 英語パースの組み合わせ爆発を根絶、辞書を18,000行➔1,500行へ90%削減 |

---

## ⏸️ 2. 設計完了・着手待ち (Wait / Pending / Ready)

仕様・設計が完了していますが、**「Phase 8 の完了待ち」** または **「次期着手スロット待ち」** として意図的にペンディングしているタスク群です。つまみ食いを防ぐため、Phase 8 完了後に順次着手します。

### 2.1 GKL Pure JS Client (main.js) モジュール分割＆オーケストレーター適正化
- **ステータス**: `⏸️ pending` (設計完了 / 次期スロット待ち)
- **設計書**: [gkl_client_modularization_plan.ja.md](./2_client_ui/gkl_client_modularization_plan.ja.md)
- **対象コード**: `examples/gkl-pure-js-client/main.js` (現在 2,364行 ➔ 400〜500行へ削減目標)
- **理由**: GKLクライアントのメインエントリポイントの肥大化を解消し、新UI機能の安全な受け入れ態勢を整える。Phase 8 の直結基盤の進捗を見極めつつ、クライアント保守性のために着手。
- **ステップ**:
  - [ ] Phase 1: 多言語 UI 更新の分離 (`modules/i18n/`)
  - [ ] Phase 2: レイアウト & プリセット管理の分離 (`modules/layout/`)
  - [ ] Phase 3: Visual FX ディスパッチャの分離 (`modules/effects/`)
  - [ ] Phase 4: スタートアップ・セーブ管理の分離 (`modules/startup/`)
  - [ ] Phase 5: 盤面インタラクションの分離 (`modules/interaction/`)
  - [ ] Phase 6: 全体リグレッションテスト ＆ クライアント動作検証

### 2.2 Phase 7 Phase 3: 命名アシスト ＆ GamePad候補選択 (Gap 2 対応)
- **ステータス**: `⏸️ pending` (Phase 8 完了待ち)
- **設計書**: [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md)
- **保留理由**: 画面テキストパースによる複雑な価格逆引きロジックを組むより、**Phase 8 で Cコアから直接アイテム情報（買値・売値・真名）を取得する方が圧倒的に安全でシンプル**になるため、Phase 8 完了まで意図的に着手を待機。
- **ステップ**:
  - [ ] Step 1: `DiscoveryStateManager.js` への Phase 8 価格・未鑑定直結
  - [ ] Step 2: `ItemCandidateResolver.js` によるワンタップ候補サジェストコア
  - [ ] Step 3: GamePad対応 候補選択ダイアログ (`<nh-call-candidate-dialog>`)

### 2.3 事後ナレッジ連携 ＆ 戦術アドバイザー刷新（残存部）
- **ステータス**: `⏸️ pending` (設計完了 / 連動待ち)
- **設計書**: [post_mortem_knowledge_and_tactical_advisor_redesign.ja.md](./7_futures/post_mortem_knowledge_and_tactical_advisor_redesign.ja.md)
- **現状**: `tools/scoreboard.html` および `PostMortemKnowledgeResolver.js`（多段構文解析・RCA調停）は実装完了。残る「未接続アドバイス（マインドフレア、グリーンスライム等）の包括バインド」および「50+件の死因検証ベンチマークテスト」が着手待ち。

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
  - 設計書: [AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md), [Spatial_Pattern_Engine_Architecture.md](./3_gkl/Spatial_Pattern_Engine_Architecture.md)
  - 概要: Phase 8 の `getCellInfo` 直結により、真の床推論をバイパス。空間グリッド、ランドマーク台帳、描画プロジェクターを疎結合化。
- **啓蒙ダイアログシグナル化による隠れステータス横取り**:
  - 設計書: [enlightenment_dialog_signal_and_state_interception_architecture.ja.md](./7_futures/enlightenment_dialog_signal_and_state_interception_architecture.ja.md)
  - 概要: 魔法の啓蒙（`MAGICENLIGHTENMENT`）ダイアログから不可視な運（Luck）や神の怒りを自動横取り。

### 3.2 独立した長期構想群
- **外部ナレッジ連携 (NetHackWiki) ＆ 翻訳モード連動 Web ジャンプ構想**:
  - 設計書: [external_wiki_knowledge_linking_architecture.ja.md](./7_futures/external_wiki_knowledge_linking_architecture.ja.md)
  - 概要: モンスター・アイテム・伝承からNetHackWikiへワンクリックジャンプ。
- **ヘルプ専用ダイアログ化 ＆ 外部ドキュメント連携構想**:
  - 設計書: [help_dialog_and_external_doc_system_architecture.ja.md](./7_futures/help_dialog_and_external_doc_system_architecture.ja.md)
  - 概要: CUI英文ヘルプに代わる、WebUI最適化ガイドモーダル（`HelpGuideModal`）と外部翻訳連携。
- **将来の完全独立マイクロカーネル化構想**:
  - 設計書: [webuicore_final_architecture_vision.md](./7_futures/webuicore_final_architecture_vision.md)
  - 概要: `WebUICore` を `WebUIDevice` と `WebUISound` に完全分離する長期ビジョン。

---

## 🟢 4. 実装完了コア機能・現行仕様 (Living Specs)

すでに実装が完了し、テストが通過（**全125スイート・1,566テスト 100% PASS**）しており、現在の動作の正解（Single Source of Truth）となっている機能群です。

| ドメイン | 機能・仕様書 | 主要ソースコード | 状態 | 概要 |
| :--- | :--- | :--- | :--- | :--- |
| **全体・横断** | **[SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md)** | `src/` 全体 | `🟢 implemented` | **システム現有能力カタログ＆責務境界・統廃合・ギャップ分析**<br>通信・同期、状態解析、データ・伝承、UI調停、基本憲法、重複整理、未接続パイプラインの公式総合カタログ |
| **戦歴・スコア** | [post_mortem_knowledge_and_tactical_advisor_redesign.ja.md](./7_futures/post_mortem_knowledge_and_tactical_advisor_redesign.ja.md) | `tools/scoreboard.html`<br>`PostMortemKnowledgeResolver.js`<br>`GameOverResolver.js` | `🟢 implemented` | **公式 xlogfile 準拠スコアボード ＆ 事後ナレッジ構文解析 (2026-10-08)**<br>公式戦歴ビュワー、NetHack 5.0 `formatkiller()` 構文解析（Prefix/Core/Suffix分解）、根本原因調停 (RCA) コア |
| **品質・堅牢化** | [bugfix_plan_oracles_explore_attackfx.ja.md](./6_project_reports/archive/bugfix_plan_oracles_explore_attackfx.ja.md) | `WebUICore.js`<br>`GKLPlugin.js`<br>`AdventureLogManager.js` | `🟢 implemented` | **3大不具合是正 ＆ 品質堅牢化 (2026-10-08)**<br>信託テキストウィンドウ検知＆大予言一括管理（OOM解消）、exploreランキング除外＆死因SSOT化、攻撃FX誤爆完全抑止 |
| **操作・動的知識** | [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md) | `OnDemandLookupService.js`<br>`NhKnowledgeCard.js`<br>`NhDiscoveryCodex.js` | `🟢 implemented` | **標準操作プログレッシブ拡張 Phase 1 (2026-10-02)**<br>`/` 動的サイレントクエリ、3層統合ナレッジカード（基本・攻撃・文学引用）、`\` 発見済みアイテム真名・外見対照図鑑 |
| **伝承・冒険手帳** | [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md) | `tools/adventure_log.html`<br>`AdventureLogManager.js`<br>`NhCodexGrid.js` | `🟢 implemented` | **標準操作プログレッシブ拡張 Phase 2 (2026-10-03)**<br>独立冒険手帳画面、セッション横断メタ進行管理、シルエット解禁グリッド、モンスター公式攻撃データ3,767行 |
| **音響・調停** | [sound_coordinator_and_multidriver_architecture.ja.md](./4_sound/sound_coordinator_and_multidriver_architecture.ja.md) | `SoundCoordinator.js`<br>`SoundArbiter.js`<br>`SoundEngine.js`<br>`src/core/sound/drivers/` | `🟢 implemented` | **統合サウンドコーディネーター ＆ 音響駆動ドライバ分離 (Phase 6: 2026-10-02)**<br>照合・調停・駆動の3層完全分離。プラガブル・マルチドライバ（Wave, PsgBeep, ProceduralSynth）、Headless調停エンジン、100%後方互換ファサード |
| **入力・パッド** | [gamepad_console_mode_architecture.ja.md](./7_futures/gamepad/gamepad_console_mode_architecture.ja.md) | `GamepadInputController.js`<br>`RadialInputRecognizer.js`<br>`examples/console-client/` | `🟢 implemented` | **ゲームパッド操作体系 ＆ Console Client PoC (2026-10-01)**<br>ラジアルメニュー認識、シレン風インベントリドロワー、独立コンソールクライアントレファレンス配備 |
| **Driver・WASM** | [nethack_version_upgrade_guide.ja.md](./1_driver/nethack_version_upgrade_guide.ja.md) | `NetHackWasmDriver.js`<br>`NetHackMemory.js` | `🟢 implemented` | **NetHack 5.0.1 移行 ＆ 公式コード非侵襲 Driver (2026-09-30)**<br>5.0.1 (Commit c1b1b08) 追従。`winshim.c` 完全無改造で動作する非侵襲アーキテクチャ確立 |
| **音響・シンセシス** | [dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md) | `SoundEngine.js`<br>`SoundEventCatalog.js` | `🟢 implemented` | **動的音程シンセシス (Dynamic Musical Synthesis / Stage 5.6)**<br>外部音源不要(容量ゼロ)のWeb Audio APIオシレーター合成。きしむ床12音階、モンスター咆哮(ピッチベンド/和音/AM/FM/パルス)、楽器演奏・城の跳ね橋5音メロディ |
| **品質・i18n** | [stage5_5_quality_assurance_and_i18n.ja.md](./7_futures/archive/phase5/stage5_5_quality_assurance_and_i18n.ja.md) | `MessageContextResolver.js`<br>`tests/unit/robustness.test.js` | `🟢 implemented` | **言語非依存ロジック確立と総合品質保証 (Stage 5.5)**<br>二重キーワード完全根絶、多言語拡張ファクトリ（`createForVariant`）、翻訳非依存テスト実証、全クライアントビルド100%成功 |
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
| **GKL / 空間** | [AreaStateManager_Architecture_and_Specification.ja.md](./3_gkl/AreaStateManager_Architecture_and_Specification.ja.md) | `src/core/knowledge/state/`<br>`AreaStateManager.js` | `🟢 implemented` | **空間状態総合オーケストレーター仕様 ＆ モジュール機能整理計画**<br>4層グリッド(bottom/middle/top/effect)、背景グリフ/仮床/自己修復、階段永続化・初手先行シード(4002)、ランドマーク台帳(階段/祭壇/店舗)、大岩押し推論、戦術視野・カメラ投影 |
| **GKL** | [gkl_documentation.md](./3_gkl/gkl_documentation.md) | `src/core/knowledge/` | `🟢 implemented` | **GKL 総合アーキテクチャ・プラグイン構造** |
| **GKL** | [GKL_Visual_FX_Event_Architecture.md](./3_gkl/GKL_Visual_FX_Event_Architecture.md) | `src/core/knowledge/` | `🟢 implemented` | **視覚演出 (Visual FX) イベントアーキテクチャ** |
| **GKL** | [GKL_Structured_Knowledge_Usage_Guide.md](./3_gkl/GKL_Structured_Knowledge_Usage_Guide.md) | `src/core/knowledge/data/` | `🟢 implemented` | **構造化知識ベース (384体・481アイテム・アーティファクト)** |
| **Core / UI** | [Interactive_Request_Controller_Architecture_and_Roadmap.md](./2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md) | `src/core/request/` | `🟢 implemented` | **連続リクエストコントローラ (IRC) ＆ 制御シグナル同定基盤** |
| **Core / UI** | [WebUICore_Usage_Guide.md](./2_client_ui/WebUICore_Usage_Guide.md) | `src/core/WebUICore.js` | `🟢 implemented` | **WebUICore 利用ガイド** |
| **Driver** | [driver_core_spec.md](./1_driver/driver_core_spec.md) | `src/driver/NetHackWasmDriver.js` | `🟢 implemented` | **Web Worker WASM コア駆動ドライバ** |
| **Sound** | [sound_system_spec.md](./4_sound/sound_system_spec.md) | `src/sound/` | `🟢 implemented` | **Web Audio API サウンドシステム** |
| **Testing** | [README.md (テストガイド)](./8_testing/README.md) | `tests/` | `🟢 implemented` | **Vitest 全自動テスト基盤 (全125スイート・1,566テスト 100% PASS)** |
| **Translation** | [DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md) | `dictionary.csv`, `tools/` | `🟢 implemented` | **翻訳辞書・CSV相互変換運用ガイド** |

---

## 📦 5. 完了済みマイルストーン・アーカイブ記録 (Completed Milestones & Archives)

過去の検討経緯や完了済みプロジェクトレポート、旧アーキテクチャ資料です。

- **直近引き継ぎ・状況評価レポート**:
  - **[handover_20261008_status_reevaluation.ja.md](./6_project_reports/handover_20261008_status_reevaluation.ja.md)** (NetHack 5.0.1 追従、Phase 6 マルチドライバ分離完遂、Phase 7 冒険手帳/ナレッジカード完遂、3大不具合是正、1,566テスト通過)
  - [handover_20260929_status_reevaluation.ja.md](./6_project_reports/archive/handover_20260929_status_reevaluation.ja.md) (Phase E / Phase 5 完遂、Web Audio API 動的音程シンセシス、現有能力カタログ、1,300テスト通過)
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
   - 本ロードマップの「3. 構想・将来バックログ」にリンクと1行要約を追記。
2. **⏸️ 仕様・設計が合意できたら**:
   - 直ちに着手せず、前提条件や優先順位を判断して「2. 設計完了・着手待ち (Wait / Pending)」へ配置。
3. **🚧 実装を開始したら**:
   - 本ロードマップで「1. 現在実施中・最優先フォーカス (Active Focus)」へ単一集中移動し、タスクチェックリストを管理。
4. **🟢 実装が完了したら**:
   - 仕様部分を現行仕様書として整理し、`status: implemented` に更新。
   - 本ロードマップの「4. 実装完了コア機能 (Living Specs)」テーブルへ移動。
   - 一時的な移行メモや作業ログは各カテゴリの `archive/` へ退避。
