---
title: NetHack WASM WebUI プロジェクト総合ロードマップ＆進捗ダッシュボード
status: living-document
last_updated: 2026-09-26
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

現在設計が完了し、直近の着手対象および直近完了した最重要リファクタリング・機能拡充タスクです。

### 1.1 Phase 5: メッセージシグナル化刷新と次世代 WebUICore / GKL 連携
- **ステータス**: `🚧 in-progress` (Stage 5.1〜5.3 ＆ メッセージライフサイクル完了、Stage 5.4 準備中)
- **マスタープラン**: [phase5_detailed_migration_plan.ja.md](./7_futures/phase5_detailed_migration_plan.ja.md)
- **全体設計構想**: [message_context_and_signal_driven_architecture.ja.md](./7_futures/message_context_and_signal_driven_architecture.ja.md)
- **バリアント適合運用規程**: [variant_message_catalog_adaptation_guide.ja.md](./7_futures/phase5/variant_message_catalog_adaptation_guide.ja.md)
- **最上位制約**: **「今できていること（全88スイート・1,157テスト・全4クライアントビルド・既存モーダル操作）を絶対に壊さない」非破壊的移行**
- **コアアーキテクチャ**:
  - **2段構えシグナル**: WebUICore（第1層: 状況シグナル＝客観事実） ➔ GKL（第2層: `SituationCache` シグナル駆動化 ＆ 実施シグナル）
  - **多重状況レイヤー**: 単一ターン減衰のジレンマを克服する空間距離ベースの対峙維持（チェビシェフ距離 $\le 1$、迎撃時の取りこぼし防止・離脱時誤爆防止・`SpatialPatternEngine` 連携）
  - **演出のデュアルパイプライン**: ログ・耐性・SE は即時ストリーム（Audio Queue 50〜80ms スタガード）、戦術助言はターン完了時（`poskey`）評価
- **サブステージ別進捗状況**:
  - [x] **[Stage 5.1: LORE/Codex の GKL 移設と責務純化 (2026-09-25 完了)](./7_futures/phase5/stage5_1_lore_gkl_migration.ja.md)**
    - `src/core/lore/` を `src/core/knowledge/lore/` へ移設、後方互換性 re-export ラッパーを配備
    - `WebUICore.js` 内のインライン LORE / Codex ロジック（約90行）を完全撤廃し、純粋なシグナル発行（Pub/Sub）に純化
    - `GKLPlugin.js` がシグナル（`SIGNAL_LORE_RUMOR`, `SIGNAL_LORE_ORACLE`, `SIGNAL_LORE_ENGRAVE`）を購読して図鑑・結界・床文字キャッシュを更新
    - `core.getCodex()` / `core.getLoreCodex()` のプロキシ委譲により既存UI・ツールとの完全互換性を担保
  - [x] **[Stage 5.2: 状況シグナル基盤（第1層）と実行時コンテキスト照合 (2026-09-25 完了)](./7_futures/phase5/stage5_2_situation_signals.ja.md)**
    - `build_message_context_catalog.py` による軽量実行時カタログ生成（154.3KB, 完全ASCII・言語非依存、三項演算子展開＆Cコードノイズ完全排除、< 250KB DoD達成）
    - `MessageContextResolver`（完全一致 Map + プレフィックス分類 + 正規表現テーブル、平均 0.0054ms/件 << 0.1ms DoD達成）および `ContextFrameBuffer`（リングバッファ）の新設
    - `WebUICore.js` からの `situationSignal` (`{ type: 'MESSAGE', context }`) および `messageContext:${domain}` 一元ディスパッチ配線（翻訳責務を完全分離）
  - [x] **[Stage 5.3: GKL 状況キャッシュのシグナル駆動化と対話コンテキスト (2026-09-25 完了)](./7_futures/phase5/stage5_3_interaction_context_and_actions.ja.md)**
    - 既存 `SituationCache` をシグナル購読型へ進化させ、対話サブステート `InteractionContext` を統合（`getSituation().interaction` 提供）
    - 複数フォーカス候補（足元 `atFeet` / 隣接 `adjacent`）、多重状況レイヤー（即時／空間距離維持／戦闘警戒）、フォーカスなし直接逆引き推測を完備
    - 空間距離ベースの維持（チェビシェフ距離 $\le 1$）により、迎撃時の文脈消失防止と 2歩離脱時の安全な自動消去を両立
    - `ActionSignalResolver` により施錠箱・扉に対する `recommendedActions`（合鍵・こじ開け・警告）およびワンタップ実行レシピ `ActionRecipe`（IRC 連携）を導出
  - [x] **[MessageItemLifecycle: メッセージライフサイクル基盤＆抑止制御 (2026-09-26 完了)](./2_client_ui/immersive_hud_message_window_specification.ja.md)**
    - `WebUICore.js` / `NetHackWasmDriver.js`: アイテム選択モーダル中等の内部メッセージ抑止制御（`suppressMessage`）の実装
    - フローティングHUD・吹き出し・過去ログ向けの構造化イベント（`bubbleMessage`, `messageItem`, `messageUpdate`）の安定化
    - 単体テスト `MessageItemLifecycle.test.js`（7テスト）新規配備・PASS
  - [ ] **[Stage 5.4: ドメイン別既存モジュールのメッセージマスタ移行](./7_futures/phase5/stage5_4_domain_modules_migration.ja.md)**
    - **5.4A 効果音エンジン (`SoundEngine`)**: `You_hear`（142件）等 O(1) 発火、Audio Queue スタガード遅延（50〜80ms）、動的シンセシス拡張スロット
    - **5.4B 耐性マネージャ (`AttributeStateManager`)**: `INTRINSIC_MESSAGE_MAP` による耐性獲得 O(1) 確定更新
    - **5.4C 道具識別 (`DiscoveryStateManager`)**: `DISCOVERY_MESSAGE_MAP` による真名自動昇格
  - [ ] **[Stage 5.5: 言語非依存ロジック確立と総合品質保証](./7_futures/phase5/stage5_5_quality_assurance_and_i18n.ja.md)**
    - 二重キーワード（翻訳後日本語文字列依存）の完全撤廃
    - 3層テストピラミッド再編（文章渡しテストの整理と `MessageContext` 渡しテスト主軸化）
    - 翻訳非依存性テスト (`robustness.test.js`) 実証
    - 全単体テスト（1,157+件）および全 4 クライアント（Vue, React, Solid, Svelte）ビルド完全検証

### 1.2 GKL レファレンスクライアント (Nehww) UI/UX 刷新＆レンダラー表現高度化
- **ステータス**: `🟢 implemented` (Phase A〜D & UI Styling 完了、次期: Phase E)
- **対象ディレクトリ**: `examples/gkl-pure-js-client/` (レファレンスクライアント略称: **`Nehww`**)
- **設計書**:
  - 全体計画: [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md)
  - Phase D イマーシブHUD仕様書: [immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md)
- **完了済みテーマ (Phase A, B, C & D / UI Styling)**:
  - **Phase A (テーマ 1 & 2: 足元枠 3D パース吸着 ＆ Middle レイヤー最適化 ＆ Pet/Ridden 強調)**:
    - WebGPU HD2D レンダラー: WGSL パイプライン内の Layer 3.2 (自キャラ床枠) に床面 $Y=0.01$ で投入。深度テストにより直立キャラクター（Layer 4）の下に枠線が潜り込む自然な足元配置を実現。ターゲットカーソル枠は床面4隅の 3D 空間結線（`worldToScreen`）により立体吸着描画。
    - Canvas 2D レンダラー (`MainViewportRenderer.js`): 自キャラ枠描画を `cell.middle` 直後、`cell.top` 直前に移動し前後関係を統一。
    - Pet (♥), Ridden (R), piletop (+) の統一ミニバッジおよび足元サークル（Layer 3.3）を描画。
  - **Phase B (テーマ 4: スマート ContextActions ＆ 操作近代化)**:
    - `FloatingContextActions.js`: マップ上のクリック対象（自キャラ足元、敵モンスター、ギミック、床）の直上に吹き出し型で推奨アクション（戦う/話す/拾う/開ける/移動）をポップアップ表示。不用意な移動暴発を抑止。
    - 右クリック時のブラウザ標準 contextmenu 表示抑止をコンポーネント全体へ適用。
    - `DirectionPad.js`: 方向未選択時にアクションボタンを非表示化・自動復帰する標準化。
  - **Phase C (テーマ 3: ゲーム開始時の導入フロー最適化 ＆ ナレッジ表示刷新)**:
    - `CharacterIntroModal.js`: `ASKNAME`（冒険者名入力）の中央カード化、🎲 ランダムネーム生成ボタン、Enter確定 ＆ `core.setPlayerName` 連動。
    - `ynaq` プロンプト検知時の 3 大カード選択肢提示（🎲 おまかせ作成 / ⚙️ 自分で詳細に選ぶ / ⚡ クイック即開始）。キーボード（[Y], [N], [Q]）およびクリック対応。手動作成時は `CharacterCreationModal` へシームレス連携。
    - `KnowledgeDetailModal.js`: サイドパネルをコンパクト化し、クリック時に専用のモーダルで詳細ナレッジ（危険度、基礎ステータス、戦術助言、アイテム効果）を表示。
  - **Phase D (テーマ 5: 全画面マップ ＋ 透過 HUD レイアウト刷新 ＆ イマーシブメッセージウィンドウ) (2026-09-26 完了)**:
    - マップをウィンドウ追従全画面化（100vw × 100vh、アスペクト比維持と広大視界、マウスホイールズーム＆HD-2Dカメラ適正化）
    - フローティング最新行HUD (`FloatingMessageHud.js`) ＋ 過去ログドロワー (`MessageHistoryDrawer.js`: `L` キー・画面クリック展開・画面左側ピン留め固定 ＆ 自動追従スクロール)
    - ステータスバー、緊急アシストバー、ミニマップHUD、フロア設備案内HUD、床文字HUD（Engraving）の全HUDフローティング化
    - 右サイドパネルのワンタップ一時退避・スライドイン復帰（`Alt+S` / `[` キー / パネル内ボタン / 画面右端 Peek タブ）
  - **UI スタイル・テーマ全体統一 (Neo-Retro Dark Glass UI) (2026-09-26 完了)**:
    - 全画面（HUD・右サイドパネル・各種モーダル・ヘッダー・ボタン群・スクロールバー）でサイバーシアンアクセント（`#38bdf8`）とフロストガラスマテリアル（`backdrop-filter: blur(12px)` + 極細透過ボーダー）を徹底統一
    - 右サイドパネル展開時も背景ダンジョンが透け、公式スクリーンショットとして映える本格PCゲームクライアントのルック＆フィールを確立
    - 全90テストファイル、1,180テストすべて PASS（回帰ゼロ）

### 1.3 Phase E: UIController (Headless UI) 抽出と Web Components 共通基盤
- **ステータス**: `💡 proposed` (2026-09-26 策定)
- **設計書**: [ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md)
- **概要**:
  - `Nehww` で先行実証された高度なUIロジック（HUD状態マシン、モーダルスタック/FocusTrap、ペーパードール部位判定、コンテナD&Dドラフト、キーバインド調停）を、DOM非依存の Headless UI 層（**`UIController`**）として抽出・独立パッケージ化。
  - **Model（Cコア / WASM / GKL）のシグナル高度化に対する「防腐層（Anti-Corruption Layer）」** として機能させ、Model側の内部仕様変更やストリーム化が起きても View 側の修正・手戻りをゼロにする長寿命アーキテクチャを確立。
  - UIController にバインドする共通 **Web Components（`<nh-*>`）** を提供し、任意のフレームワーク（React / Vue / Svelte / Vanilla HTML）からタグ1行で最高峰のUIを利用可能にする。
- **マイグレーションステップ**:
  - [ ] **Step 1**: `Nehww` 内部のUI計算・状態管理コードを `controller/` へ分離（Headless化）
  - [ ] **Step 2**: DOM非依存の独立パッケージ（`@nethack/ui-core`）化と Node.js 単体テストの整備
  - [ ] **Step 3**: Web Components ライブラリ（`<nh-hud>`, `<nh-paperdoll>`, `<nh-container>` 等）の実装
  - [ ] **Step 4**: `Nehww` および他クライアントへの逆輸入・共通化

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

### 2.3 モーダル・ダイアログ群デザインシステム統一＆UIリファクタリング構想
- **ステータス**: `💡 proposed` (2026-09-25 策定)
- **設計書**: [dialog_design_system_unification_concept.ja.md](./2_client_ui/dialog_design_system_unification_concept.ja.md)
- **概要**: 導入カード、キャラ作成、コンテナ、ペーパードール、Codex、願い等の各モーダルが機能単位で順次追加されてきた経緯から生じている枠線（金枠 vs スレート枠）・ヘッダー構成・ボタン等のバラつきを、共通デザインシステム（デザイントークン・共通カード規格）として整理・統一するリファクタリング。

### 2.4 動的音程シンセシス構想 (Dynamic Musical Synthesis)
- **ステータス**: `💡 proposed`
- **設計書**: [dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md)
- **対象コード**: `src/sound/`
- **概要**: NetHackのメッセージに含まれる音程・罠の音・モンスターの咆哮・楽器演奏をWeb Audio APIオシレーターでリアルタイム合成発音する。外部音源ファイル不要でリッチな音響体験を提供（Stage 5.4A 効果音エンジンとの連携スロット）。

### 2.5 翻訳アーキテクチャ次世代刷新
- **ステータス**: `💡 proposed`
- **設計書**: [translation_architecture_enhancement_plan.md](./9_translation/translation_architecture_enhancement_plan.md)
- **概要**: 翻訳カテゴリ付与、かすれ文字（Engraving等）の復元、多段翻訳キャッシュパイプラインの導入。

### 2.6 将来の完全独立マイクロカーネル化構想
- **ステータス**: `💡 proposed`
- **設計書**: [webuicore_final_architecture_vision.md](./7_futures/webuicore_final_architecture_vision.md)
- **概要**: `WebUICore` をさらに疎結合化し、`WebUIDevice`（仮想端末）と `WebUISound`（音響）を完全分離する長期ビジョン。

---

## 🟢 3. 実装完了コア機能・現行仕様 (Living Specs)

すでに実装が完了し、テストが通過（**全90スイート・1,180テスト 100% PASS**）しており、現在の動作の正解（Single Source of Truth）となっている機能群です。

| ドメイン | 機能・仕様書 | 主要ソースコード | 状態 | 概要 |
| :--- | :--- | :--- | :--- | :--- |
| **UI・体験** | [ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md)<br>[immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `FloatingMessageHud.js`<br>`MessageHistoryDrawer.js`<br>`base.css` | `🟢 implemented` | **全画面マップ ＋ イマーシブHUD ＆ Neo-Retro Dark Glass UI (Phase D)**<br>100vw×100vh 全画面マップ、フローティング最新行HUD、左側ピン留め過去ログドロワー、サイバーシアン（`#38bdf8`）×フロストガラス全体統一 |
| **メッセージ** | [immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `WebUICore.js`<br>`NetHackWasmDriver.js` | `🟢 implemented` | **メッセージライフサイクル＆抑止制御**<br>モーダル（アイテム選択等）中のメッセージ抑止（`suppressMessage`）、構造化ログ（`bubbleMessage`, `messageItem`, `messageUpdate`）の一元配信 |
| **対話・制御** | [stage5_3_interaction_context_and_actions.ja.md](./7_futures/phase5/stage5_3_interaction_context_and_actions.ja.md) | `InteractionContext.js`<br>`ActionSignalResolver.js`<br>`SituationCache.js` | `🟢 implemented` | **対話コンテキスト ＆ アクション導出基盤 (Stage 5.3)**<br>空間距離維持（チェビシェフ距離 $\le 1$）による対話維持、施錠箱・扉へのワンタップ推奨アクション（IRCレシピ連携） |
| **メッセージ** | [stage5_2_situation_signals.ja.md](./7_futures/phase5/stage5_2_situation_signals.ja.md) | `MessageContextResolver.js`<br>`ContextFrameBuffer.js`<br>`build_message_context_catalog.py` | `🟢 implemented` | **状況シグナル基盤 (第1層) ＆ 実行時コンテキスト照合 (Stage 5.2)**<br>完全ASCII軽量カタログ(154.3KB)、三項演算子展開＆ノイズ排除、超高速同定(平均 0.0054ms)、翻訳責務完全分離 |
| **伝承・GKL** | [stage5_1_lore_gkl_migration.ja.md](./7_futures/phase5/stage5_1_lore_gkl_migration.ja.md) | `src/core/knowledge/lore/`<br>`GKLPlugin.js` | `🟢 implemented` | **LORE / Codex の GKL 移設と責務純化 (Stage 5.1)**<br>`WebUICore` からのシグナルPub/Sub化、後方互換プロキシ委譲、知識層へのドメイン集約 |
| **操作・UI** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `CharacterIntroModal.js`<br>`ModalManager.js` | `🟢 implemented` | **ゲーム開始導入フロー最適化 (Phase C)**<br>冒険者名入力の中央カード化・ランダムネーム生成・3大作成モードカード（おまかせ/手動/即開始）連携 |
| **画面・描画** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `WebGPUHD2DRenderer.js`<br>`MainViewportRenderer.js` | `🟢 implemented` | **自キャラ足元枠 Middle レイヤー最適化 ＆ 3D パース吸着 (Phase A)**<br>床面 $Y=0.01$ (Layer 3.2) 配置、深度テストによる自然な足元表現、ターゲットカーソル立体結線枠 |
| **画面・描画** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `WebGPUHD2DRenderer.js`<br>`MainViewportRenderer.js`<br>`glyphClassifier.js` | `🟢 implemented` | **Pet / Ridden / piletop 視覚的強調 (Phase A)**<br>統一ミニバッジ (♥ / R / +)、Middle レイヤー (Layer 3.3) 足元サークル描画 |
| **操作・UI** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md) | `FloatingContextActions.js`<br>`DirectionPad.js`<br>`main.js` | `🟢 implemented` | **スマート ContextActions フローティングメニュー (Phase B)**<br>マップクリック対象（敵/足元/地形）直上ポップアップ、移動暴発抑止、右クリック標準化 |
| **GKL / UI** | - | `KnowledgeDetailModal.js` | `🟢 implemented` | **詳細ナレッジモーダル (KnowledgeDetailModal)**<br>サイドパネルのコンパクト化、クリック時の専用詳細モーダル（危険度・戦術・ステータス・効果） |
| **伝承・GKL** | [Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md](./3_gkl/Lore_and_Structured_Knowledge_Cross_Reference_Specification.ja.md) | `LoreMasterData.js`<br>`CodexModal.js`<br>`enrich_lore_entities.js`<br>`lore_codex.html` | `🟢 implemented` | **伝承・構造化知識クロスリファレンス (Lore Cross-Ref)**<br>Rumors/Oraclesとモンスター・アイテム相互紐付け、Codexミニスペック連携、キュレーションツール |
| **画面・描画** | [unified_renderer_and_screen_architecture_plan.md](./2_client_ui/unified_renderer_and_screen_architecture_plan.md) | `VirtualDungeonScreen.js`<br>`MainViewportRenderer.js`<br>`MinimapHudRenderer.js` | `🟢 implemented` | **仮想スクリーン統合レンダラー (Phase 1〜3)**<br>オフスクリーン統合、フォーカス追従、ミニマップスマート自動退避 |
| **画面・描画** | [webgpu_hd2d_diorama_renderer.ja.md](./7_futures/webgpu_hd2d_diorama_renderer.ja.md) | `WebGPUHD2DRenderer.js` | `🟢 implemented` | **WebGPU HD-2D ジオラマレンダラー**<br>生WGSLシェーダー、クオータビュー、動的ランタン視界、テスト完備 |
| **伝承・考古学** | - | `src/core/knowledge/lore/LoreCodex.js`<br>`src/core/knowledge/lore/LoreDetector.js`<br>`LoreModal.js` | `🟢 implemented` | **冒険手帳・伝承図鑑 (RUMOR & LORE CODEX)**<br>噂・神託・墓碑銘のアンロックとモーダル閲覧UI |
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
| **Testing** | [README.md (テストガイド)](./8_testing/README.md) | `tests/` | `🟢 implemented` | **Vitest 全自動テスト基盤 (88スイート・1,157テスト 100% PASS)** |
| **Translation** | [DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md) | `dictionary.csv`, `tools/` | `🟢 implemented` | **翻訳辞書・CSV相互変換運用ガイド** |

---

## 📦 4. 完了済みマイルストーン・アーカイブ記録 (Completed Milestones & Archives)

過去の検討経緯や完了済みプロジェクトレポート、旧アーキテクチャ資料です。

- **直近引き継ぎ・状況評価レポート**:
  - **[handover_20260921_status_reevaluation.ja.md](./6_project_reports/handover_20260921_status_reevaluation.ja.md)** (レンダラー統合、WebGPU HD-2D、LORE、ペーパードール完成)
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
