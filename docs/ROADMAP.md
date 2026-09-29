---
title: NetHack WASM WebUI プロジェクト総合ロードマップ＆進捗ダッシュボード
status: living-document
last_updated: 2026-09-29
---

# 🗺️ NetHack WASM WebUI 総合ロードマップ＆進捗ダッシュボード

本ドキュメントは、NetHack WASM WebUI プロジェクトにおける**「現在進行中・直近の移行タスク (WIP)」「実装待ちの構想・アイデア (Backlog)」「すでに実装完了している現行仕様 (Living Specs)」「過去の設計記録 (Archive)」**を一元管理する総合ダッシュボードです。

> [!IMPORTANT]
> **🧭 設計・開発・リファクタリング時の最重要必読インベントリ**  
> システムが現在持っている全機能、APIシグネチャ、WASM通信パイプライン、データ資産（全384体モンスター・481アイテム・787件の噂）、アーキテクチャの基本憲法、および機能重複統廃合・ギャップ分析は、**[システム現有能力カタログ (SYSTEM_CAPABILITIES.md)](./SYSTEM_CAPABILITIES.md)** にて一元集約されています。新機能の検討や改修時は必ずこちらをご一読ください。

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

現在設計が完了し、直近の着手対象である最重要リファクタリング・機能拡充タスクです。
UI層への影響・手戻りを最小化するため、**「先に防腐層（UIController）を確立し、その保護下で基幹メッセージシグナル刷新（Phase 5 Stage 5.4〜5.5）を進める」** 順序で実行します。

### 1.1 Phase E: UIController (Headless UI) 抽出と Web Components 共通基盤
- **ステータス**: `🟢 implemented` (全ステップ完了, 2026-09-27)
- **設計書**: [ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md)
- **最優先着手理由**:
  - Model（Cコア / WASM / GKL）のシグナル高度化に対する**「防腐層（Anti-Corruption Layer）」** を先行配備することで、後続の Phase 5 (Stage 5.4〜5.5) におけるイベント・シグナル刷新が起きても View 側の修正・手戻りをゼロにする。
- **概要**:
  - `Nehww`（Phase A〜D 完了）で先行実証された高度なUIロジック（HUD状態マシン、モーダルスタック/FocusTrap、ペーパードール部位判定、コンテナD&Dドラフト、キーバインド調停）を、DOM非依存の Headless UI 層（**`UIController`**）として抽出・独立パッケージ化。
  - UIController にバインドする共通 **Web Components（`<nh-*>`）** を提供し、任意のフレームワーク（React / Vue / Svelte / Vanilla HTML）からタグ1行で最高峰のUIを利用可能にする。
- **マイグレーションステップ**:
  - [x] **Step 1: `Nehww` 内部のUI計算・状態管理コードを `controller/` へ分離（Headless化）** (2026-09-27 完了)
    - `UIConfigStore`（レイアウト設定・LocalStorage永続化・プリセット管理）抽出
    - `ModalStackController`（多重モーダル管理・ESC閉塞・最前面判定）新設
    - `InputCoordinator`（キー入力競合調停・ルーティング判定）新設
    - `FloatingMessageHudController`（行数キュー・世代判定・フェード状態）抽出
    - `PaperdollPresenter`（部位適合判定・リアルタイム差分計算・二刀流適性）抽出
    - `ContainerDraftController`（コンテナ移動ドラフト・数量計算・BoH防爆ガード）抽出
    - Headless 単体テスト（6スイート・26テスト）配備、全96テスト（1,216テスト）100% PASS
  - [x] **Step 2: DOM非依存の独立パッケージ（`@nethack-webui/ui-controller`）化と共通モジュール整備** (2026-09-27 完了)
    - `src/ui-controller/` へのコントローラー群昇格配置 (`UIConfigStore`, `ModalStackController`, `InputCoordinator`, `FloatingMessageHudController`, `PaperdollPresenter`, `ContainerDraftController`)
    - `src/ui-controller/index.js` による一元エクスポートおよび `package.json` (`@nethack-webui/ui-controller`) の配備
    - `Nehww`（`main.js`, `KeyHandler.js`, `FloatingMessageHud.js`, `PaperdollModal.js`, `ContainerModal.js`）のインポート切り替え
    - 単体テスト（`tests/ui-controller/` 全6スイート）のインポート追従
  - [x] **Step 3: Web Components ライブラリ（`<nh-*>`）の実装** (2026-09-27 完了)
    - `src/components/` ディレクトリ新設および `NhBaseElement`（Shadow DOM, ライフサイクル, 購読自動解除）配備
    - Neo-Retro Dark Glass UI 共通 CSS トークン・スタイル（`theme.css.js`）配備
    - コア Web Components 実装：
      - `<nh-floating-hud>`: `FloatingMessageHudController` 連携、世代別透過・フェードアウト
      - `<nh-modal>`: `ModalStackController` 連携、Z-Index スタック順・ESC 閉塞・FocusTrap
      - `<nh-paperdoll>`: `PaperdollPresenter` 連携、14部位スロット、適合ハイライト、差分プレビュー
      - `<nh-container-filer>`: `ContainerDraftController` 連携、二画面ファイラー、移動ドラフト、BoH防爆警告バッジ
      - `<nh-ui-config>`: `UIConfigStore` 連携、外観・レイアウト設定、プリセット切り替え
    - `src/components/index.js` 一括エクスポート & `customElements.define` 自動/一括登録
    - インタラクティブデモカタログ (`examples/web-components-demo/index.html`) 配備
    - 単体テスト新設、全103テストスイート・1,247テスト 100% PASS、全4サンプルクライアントビルド成功確認
  - [x] **Step 4: `Nehww` への Web Components 逆輸入・共通化と最高峰 UX の完全復元** (2026-09-27 完了)
    - フローティング HUD の最高峰アニメーション・世代遷移・ゴールド演出を 100% 維持しつつ `FloatingMessageHudController`（Headless）と完全同期
    - モーダル外枠（`#container-modal`, `#paperdoll-modal`）の 2 ペイン全画面美麗 GUI を維持し、設定モーダル（`<nh-modal id="nh-modal-settings">`）および `KeyHandler` のスタック調停・ESC 閉塞と安全連携
    - 設定パネル / プリセット管理を `<nh-ui-config>` および `UIConfigStore`（未定義値安全正規化）と双方向バインド連携
    - `PaperdollModal` の部位メタ定義を `PaperdollPresenter` の SSOT へ集約
    - 逆輸入連携テスト（`NehwwWebComponentsIntegration.test.js`）配備、全104テストスイート・1,252テスト 100% PASS、全4サンプルクライアントビルド完全成功

### 1.2 Phase 5: メッセージシグナル化刷新と次世代 WebUICore / GKL 連携
- **ステータス**: `🚧 in-progress` (Stage 5.1〜5.3 ＆ メッセージライフサイクル完了、Stage 5.4 準備中)
- **マスタープラン**: [phase5_detailed_migration_plan.ja.md](./7_futures/phase5_detailed_migration_plan.ja.md)
- **全体設計構想**: [message_context_and_signal_driven_architecture.ja.md](./7_futures/message_context_and_signal_driven_architecture.ja.md)
- **バリアント適合運用規程**: [variant_message_catalog_adaptation_guide.ja.md](./7_futures/phase5/variant_message_catalog_adaptation_guide.ja.md)
- **最上位制約**: **「今できていること（全90スイート・1,190テスト・全4クライアントビルド・既存モーダル操作）を絶対に壊さない」非破壊的移行**
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
  - [x] **[Stage 5.4: ドメイン別既存モジュールのメッセージマスタ移行 (2026-09-28 完了)](./7_futures/phase5/stage5_4_domain_modules_migration.ja.md)**
    - **5.4A 効果音エンジン (`SoundEngine`)**: `SoundEventCatalog.js` 新設、O(1) 決定論的発火、Audio Queue スタガード遅延（60ms）・優先度ソート、動的シンセシス拡張スロット (`trap.c:squeak_board`)
    - **5.4B 耐性マネージャ (`AttributeStateManager`)**: `INTRINSIC_MESSAGE_MAP.js` 新設、`processMessageContext` による耐性獲得 O(1) 確定更新 ＆ 未マッピング時フォールバック
    - **5.4C 道具識別 (`DiscoveryStateManager`)**: `DISCOVERY_MESSAGE_MAP.js` 新設、`processDiscoveryMessage` による効果メッセージからの真名・外見自動昇格
    - 単体テスト新設（+12テスト）、全104テストスイート・1,269テスト 100% PASS、全4サンプルクライアントビルド完全成功確認
  - [x] **[Stage 5.5: 言語非依存ロジック確立と総合品質保証 (2026-09-28 完了)](./7_futures/phase5/stage5_5_quality_assurance_and_i18n.ja.md)**
    - **二重キーワードの完全撤廃**: `AttributeStateManager`, `SoundEngine`, `MonsterTracker`, `SkillStateManager`, `SpellStateManager`, `SignalDetector`, `WebUICore` から翻訳後日本語テキストの覗き見を完全根絶し、`MessageContext` および英語 `rawText` 判定へ一本化
    - **多言語拡張ファクトリ**: `MessageContextResolver.createForVariant(variant)` 新設により将来の JNetHack Wasm (ja) 等の投入に即応できる拡張性を確立
    - **3層テストピラミッド再編**: 旧来の日本語文章渡しテストを整理し、`MessageContext` 渡しテストを主軸へ移行
    - **翻訳非依存性自動テスト (`robustness.test.js`) 実証**: 通常辞書 vs 異言語ダミー辞書 vs 翻訳無効化でシグナル・耐性・音響・識別・FX が 100% 同一に動作することを実証
    - 全105テストスイート・1,277テスト 100% PASS、全4サンプルクライアント（Vue, React, Solid, Svelte）ビルド完全成功確認
  - [x] **[Stage 5.6: 動的音程シンセシス (Dynamic Musical Synthesis) (2026-09-29 完了)](./4_sound/dynamic_musical_synthesis_concept.ja.md)**
    - **Web Audio API 合成コア (`playSynth`) 拡張**: 外部音源不要（容量ゼロ）・数式計算のみでピッチベンド（指数降下）、3音和音同時発振（突撃ラッパ）、AM振幅変調（羽音）、FM周波数変調（バブリング音）、時系列シーケンス（アルペジオ・ファンファーレ）、連続短パルス（骨カタカタ音）の6大シンセシスモードを完備
    - **動的シンセシスハンドラ完全配備 (`SoundEventCatalog.js`)**: きしむ床12音階 (`trap.c:squeak_board`) に加え、モンスター咆哮 5種 (`sounds.c:shriek`, `trumpet`, `buzz/drone`, `rattle`, `gurgle`)、楽器演奏・城の跳ね橋 4種 (`music.c:flute`, `bugle`, `drum`, `drawbridge_tune`) を完全配備
    - **二重フォールバック配線 (`SoundEngine.js`)**: `context.messageId` / `metadata.synthId` による $O(1)$ 発火に加え、英文正規表現ルールによるフォールバック発火を整備
    - **総合品質保証**: 単体テスト `SoundEngine.test.js` 拡充（全20テスト）、全106テストスイート・1,298テスト 100% PASS、全4サンプルクライアントビルド完全成功確認

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

### 2.3 統合サウンドコーディネーター ＆ 音響駆動ドライバ分離構想 (Sound Coordinator & Multi-Driver Decoupling Architecture)
- **ステータス**: `💡 proposed` (2026-09-29 策定)
- **設計書**: [sound_coordinator_and_multidriver_architecture.ja.md](./4_sound/sound_coordinator_and_multidriver_architecture.ja.md)
- **対象コード**: `src/core/sound/SoundEngine.js`, `src/core/sound/SoundCoordinator.js`, `src/core/sound/drivers/`
- **概要**: 
  - `SoundEngine.js` に集中していた「入力トリガー受付・照合」「仲裁・調停（クールダウン・優先度キュー・スタガード遅延・モード判定）」「物理音響駆動（Howler/WebAudio/Beepcore）」の3責務をクリーンに分離。
  - **システム単一窓口（Unified Facade）**: 外部（WebUICore, UI, テスト）からは完全互換の単一窓口 `SoundCoordinator` のみが見える構造を維持。
  - **調停エンジン (`SoundArbiter`)**: クールダウン、優先度ソート（100〜30）、スタガード遅延（60ms）、再生モード（Auto/Wave/Beep/Mute）の判定を一元化（SSOT）し、設定変更時の挙動のブレや音割れを根本根絶。
  - **物理駆動ドライバ層 (`AudioDrivers`)**: ゲームロジックを一切持たない純粋な `WaveAudioDriver`、`PsgBeepDriver`、`ProceduralSynthDriver`（FM/AM/和音/ピッチベンド）の独立プラグイン構造を確立し、モックテスト容易性と拡張性を飛躍的に高める。
- **次のステップ**:
  - Step 1: `src/core/sound/drivers/` へのドライバ群抽出と単体テスト配備
  - Step 2: `SoundArbiter.js` による調停ロジックの Headless 化
  - Step 3: `SoundEngine.js` を Facade ラッパーとして委譲接続（全106スイート・1,300テスト互換維持）

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

### 2.6 標準操作プログレッシブ拡張 ＆ WASM動的ルックアップ統合ナレッジ (Native Command Progressive Enhancement & Dynamic Lookup Architecture)
- **ステータス**: `💡 proposed` (2026-09-28 策定)
- **設計書**: [native_command_extension_and_dynamic_lookup_architecture.ja.md](./7_futures/native_command_extension_and_dynamic_lookup_architecture.ja.md)
- **対象コード**: `src/ui-controller/InputCoordinator.js`, `src/core/knowledge/`, `src/components/`
- **概要**: 
  - 独自UIの別系統化から脱却し、NetHackの標準コマンド（`/`, `\`, `;`, `^O` 等）を自然にフックしてモダンなリッチダイアログへと昇華させる「プログレッシブ・エンハンスメント」構想。
  - **3層統合ナレッジ**: ① NetHack公式 Lookup Information (Cコア内蔵の文学引用・公式設定) ＋ ② GKL実用スペック (耐性・危険度・未識別マスク・スキル適性) ＋ ③ Lore豆知識 (787件の噂・真偽・神託)。
  - **WASM動的サイレントクエリ**: 静的辞書の二重持ちを排し、既存の `querySequenceSilent`（`suppressPrompts: true`）でCコアから動的抽出することで、ちらつきゼロと完全なバリアント・バージョン追従性を両立。初回取得後はオンデマンド・メモリキャッシュにより0msレスポンスを実現。
  - **直交レイヤー＆エンハンス・インジケーター**: 「描画表現（ASCII/タイル vs WebGPU HD-2D）」と「操作拡張（Vanilla ⇄ Enhanced）」が直交する2×2マトリクス設計。単一インジケーター（`[✨Enhanced] ⇄ [⚡Classic]`）のワンタッチ切り替えで、古参向け完全原作動作と現代的モダンUI動作を自在に行き来可能。
  - **即時調査 (Inspector) ⇄ 大図鑑 (Codex) の二本柱と知のメタプログレッション**:
    - 現場の即時確認（`/` でのカード表示）と、セッション横断の冒険大図鑑（モンスター・アイテム・噂の収集率 %）で `<nh-knowledge-card>` を完全共通化。
    - NetHackの神聖なパーマデス（死んだら全ロスト）とCコア非侵襲ルールを100%守りつつ、「死んでも図鑑の収集率が引き継がれる」という現代的な知のメタ進行を実現。
    - **タイルグリッド＆シルエット解禁演出**: 既存の32×32タイルシートを活用し、未遭遇・未識別は黒塗りシルエット（`???`）、遭遇・識別でフルカラー点灯＆NEWバッジを付与する現代的コレクションUI。
    - **ゲーム内／ゲーム外の疎結合展開**: ゲーム内は「現場のサバイバル調査（`/`）」に専念して超軽量・ESC即閉じとし、リッチな大図鑑（Codex）はタイトル画面や独立HTML（`compendium.html`）などゲーム外で安全に鑑賞可能（Web Components 部品 `<nh-knowledge-card>` は完全共通化）。
- **次のステップ**:
  - **Phase 1 (ゲーム内最優先)**: `/` コマンド向け動的ルックアップサービス（`OnDemandLookupService`）および統合カードコンポーネント（`<nh-knowledge-card>`）のプロトタイプ実装。
  - **Phase 2 (ゲーム外ビューア)**: 独立冒険大図鑑画面（`<nh-codex-grid>` ＆ シルエット解禁ギャラリー）の実装。

---

## 🟢 3. 実装完了コア機能・現行仕様 (Living Specs)

すでに実装が完了し、テストが通過（**全106スイート・1,298テスト 100% PASS**）しており、現在の動作の正解（Single Source of Truth）となっている機能群です。

| ドメイン | 機能・仕様書 | 主要ソースコード | 状態 | 概要 |
| :--- | :--- | :--- | :--- | :--- |
| **全体・横断** | **[SYSTEM_CAPABILITIES.md](./SYSTEM_CAPABILITIES.md)** | `src/` 全体 | `🟢 implemented` | **システム現有能力カタログ＆責務境界・統廃合・ギャップ分析**<br>通信・同期、状態解析、データ・伝承、UI調停、アーキテクチャ5大原則、重複整理、未接続パイプラインの公式総合カタログ |
| **音響・シンセシス** | [dynamic_musical_synthesis_concept.ja.md](./4_sound/dynamic_musical_synthesis_concept.ja.md) | `SoundEngine.js`<br>`SoundEventCatalog.js` | `🟢 implemented` | **動的音程シンセシス (Dynamic Musical Synthesis / Stage 5.6)**<br>外部音源不要(容量ゼロ)のWeb Audio APIオシレーター合成。きしむ床12音階、モンスター咆哮(ピッチベンド/和音/AM/FM/パルス)、楽器演奏・城の跳ね橋5音メロディ |
| **UI・基盤** | [ui_controller_headless_architecture.ja.md](./2_client_ui/ui_controller_headless_architecture.ja.md) | `src/ui-controller/`<br>`src/components/`<br>`<nh-*>` | `🟢 implemented` | **UIController (Headless UI) ＆ Web Components 共通基盤 (Phase E)**<br>防腐層抽出（HUD・モーダルスタック・入力調停・ペーパードール・コンテナ・設定）、共通 Custom Elements（`<nh-*>`）、Nehww への逆輸入・最適化完了 |
| **UI・体験** | [gkl_client_ui_ux_modernization_plan.ja.md](./2_client_ui/gkl_client_ui_ux_modernization_plan.ja.md)<br>[immersive_hud_message_window_specification.ja.md](./2_client_ui/immersive_hud_message_window_specification.ja.md) | `FloatingMessageHud.js`<br>`MessageHistoryDrawer.js`<br>`MainViewportRenderer.js`<br>`WebGPUHD2DRenderer.js`<br>`base.css` | `🟢 implemented` | **GKL レファレンスクライアント (Nehww) UI/UX 刷新 (Phase A〜D)**<br>全画面マップ（100vw×100vh）、フローティング最新行HUD＋過去ログドロワー、足元枠3Dパース吸着、スマートContextActions、Neo-Retro Dark Glass UI統一 |
| **UI・デザイン** | [dialog_design_system_unification_concept.ja.md](./2_client_ui/dialog_design_system_unification_concept.ja.md) | `base.css`<br>`modals.css`<br>各種モーダル CSS | `🟢 implemented` | **モーダル・ダイアログ群デザインシステム統一 (Dark Glass UI)**<br>デザイントークン一元化（`--glass-bg`, `--glass-blur`, `--glass-border`, `--primary-color: #38bdf8`）、金枠・スレート枠のバラつき解消、全モーダル共通規格化 |
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
| **Testing** | [README.md (テストガイド)](./8_testing/README.md) | `tests/` | `🟢 implemented` | **Vitest 全自動テスト基盤 (全104スイート・1,252テスト 100% PASS)** |
| **Translation** | [DICTIONARY_OPERATION.md](./9_translation/DICTIONARY_OPERATION.md) | `dictionary.csv`, `tools/` | `🟢 implemented` | **翻訳辞書・CSV相互変換運用ガイド** |

---

## 📦 4. 完了済みマイルストーン・アーカイブ記録 (Completed Milestones & Archives)

過去の検討経緯や完了済みプロジェクトレポート、旧アーキテクチャ資料です。

- **直近引き継ぎ・状況評価レポート**:
  - **[handover_20260921_status_reevaluation.ja.md](./6_project_reports/handover_20260921_status_reevaluation.ja.md)** (レンダラー統合、WebGPU HD-2D、LORE、ペーパードール完成)
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
