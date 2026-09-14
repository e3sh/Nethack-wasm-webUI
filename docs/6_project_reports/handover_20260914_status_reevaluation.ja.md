# NetHack WASM WebUI 完了状態・ペンディング状態 再評価総合レポート (2026年9月14日版)
**調査・評価実施日**: 2026年9月14日  
**対象リポジトリ**: `Nethack-wasm-webUI` (最新コミット `981fcfd` 時点)  
**前回レポート**: [`docs/6_project_reports/archive/handover_20260905_status_reevaluation.ja.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/6_project_reports/archive/handover_20260905_status_reevaluation.ja.md) (コミット `dee6b1c`)

---

## 1. エグゼクティブサマリー (Executive Summary)

本レポートは、前回総合評価レポート（2026/09/05）以降のソースコード（`src/`、`examples/`、`tests/`）、コミット履歴（2026/09/05 〜 2026/09/14、計36コミット）、および最新の設計書群（`docs/1_driver/`, `docs/2_client_ui/`, `docs/3_gkl/`, `docs/7_futures/`）を網羅的に精査し、**「9月5日以降に新たに達成された完了状態」** と **「新たに策定された設計仕様および更新されたペンディング状態」** を体系的にまとめたものです。

### 📊 主な再評価ハイライト (前回 09/05 からの主要な変化)
1. **基幹通信アーキテクチャの世代交代: InteractiveRequestController (IRC) & シグナル同定基盤**:
   - 従来の「固定トークン配列送信」の限界（プロンプト分岐でのハング・キーずれ）を解消するため、WebUICore 基盤に **`InteractiveRequestController` (IRC)** を新設。
   - 動的対話レシピ（ハンドラ駆動・コンテキスト分岐・アトミック実行・ESC連打復帰・汎用セッション排他制御）と、機械用制御シグナル同定エンジン（`SignalDetector`）を配備しました。
2. **二画面ファイラー型ビジュアル・コンテナUI (P2) の試作・挫折・そして抜本的完成**:
   - 一度は専用FSM方式での不具合により無効化（WIP: `622a6f0`）されたコンテナUIが、IRC基盤と C レベルのメモリ直接取得（`NetHackMemory.getOpenContainerInfo`）を得て **`ContainerController` としてゼロから再構築・完全復活**。手品袋の爆発防止ガード（`ContainerSafetyGuard`）や金貨対応を含め、Pure JS クライアントで実稼働を達成しました。
3. **インテリジェントUI群（P1, P3）の先行実装**:
   - **虐殺アシスタント (Genocide Assistant - P1)**: NetHack 5.0 公式フラグ（4987行）準拠の自己虐殺防止セーフティガード、クラス/単体切替、危険種族サジェストを完全実装。
   - **変化制御アシスタント (Polymorph Assistant - P3)**: 変身候補モンスター一覧、能力・耐性・サイズプレビュー、変身時装備破壊リスク（`MonsterArmorRiskResolver`）を実装。
4. **新規設計ドキュメントの策定**:
   - **装備ペーパードールUI ＆ 依存関係診断・換装プランナー** (`docs/3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md`)
   - **インベントリ重量・負荷状態管理アーキテクチャ** (`docs/3_gkl/Encumbrance_and_Weight_Management_Architecture.md`)
   - **GKL バリアント適応拡張・互換性アーキテクチャ構想** (`docs/7_futures/gkl_variant_adaptation_architecture.md`)
5. **品質・自動テストのさらなる飛躍**:
   - 単体・統合テストは前回 507 件から **758 件（全 58 テストスイート 100% PASS）** へと約 50% 拡大。全テストが Vitest に一元化され、約 3 秒で高速完走する堅牢性を確立しました。

---

## 2. 前回以降の完了状態 (Completed Status - 2026/09/05 〜 2026/09/14 実装検証済み)

以下は、ソースコードおよびテストコードの直接確認により、**この期間に新たに実装・検証が完了した項目**です。

### 2.1. 汎用連続リクエストコントローラ (InteractiveRequestController) ＆ 制御シグナル同定基盤
- **該当設計**: [`docs/2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/2_client_ui/Interactive_Request_Controller_Architecture_and_Roadmap.md)
- **達成内容**:
  - **二層分離されたシグナル辞書 (`ControlSignalCatalog.js` / `.ja.js`)**: プレイヤー用翻訳（表示用）と機械用制御辞書を完全分離。C コア生プロンプトから `SIGNAL_ITEM_SELECT`, `SIGNAL_CONTAINER_ACTION_MENU`, `SIGNAL_DIRECTION_PROMPT` などのシグナルを高精度に同定。
  - **ハイブリッド動作モード**: 従来の固定配列渡し（モードA: 後方互換 100%）と、動的ハンドラルールを持つ対話レシピ（モードB）を単一エントリポイント（`core.querySequenceSilent` / `core.executeSequence`）で自動切り替え。
  - **構造的デッドロック根絶**: タイムアウト検知時に Driver のシーケンスを安全にキャンセルし、C コアに対して ESC 連打 (`['\x1b', '\x1b', '\x1b']`) を投入してトップレベル通常ターン（poskey）へ強制安全復帰する `abortWithESC()` を完備。
  - **汎用セッションロック機構 (`acquireSessionLock` / `isBusy`)**: コンテナや将来のペーパードールなど複数ターンに跨るセッション中、外部からの割り込みや裏での自動同期を安全に排他制御。

### 2.2. 二画面ファイラー型ビジュアル・コンテナUI (ContainerController) 【完成・本接続】
- **該当設計**: [`docs/3_gkl/Container_Interaction_Specification_IRC.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/Container_Interaction_Specification_IRC.md)
- **達成内容**:
  - **IRCベースの再構築**: 9/6に一時無効化した専用FSMを廃止し、正規の `PromptPayloadBuilder`（`CONTAINER_ACTION_MENU` 検知）→ `ContainerController` → IRC レシピ実行モデルへ全面刷新。
  - **オンデマンド・アトミック実行**: モーダル表示中は C コアを通常ターンで静止させ、ユーザーの出し入れ操作時のみ一瞬でレシピ（`openPrefix` → `i`/`o` → 全カテゴリ選択 → `identifier` 完全一致 & `count` 選択 → `q` 脱出）を実行。画面ちらつきやレースコンディションを完全排除。
  - **手品袋（Bag of Holding）大爆発防止セーフティガード**: `ContainerSafetyGuard.js` により、手品袋への魔法の鞄・変化の杖等の誤投入を検知し、UI レベルで投入をブロックする安全防壁を実装。
  - **金貨（$ / Gold）およびスタックアイテムの完全サポート**: 金貨の正確な枚数追跡、UI最上部ソート、手持ち所持金との連動。
  - **Pure JS クライアント統合**: `examples/gkl-pure-js-client/modules/components/ContainerModal.js` にて、DOS Norton Commander 風の二画面ファイラー（手持ち荷物 ⇄ 袋の中身）が正式稼働。
  - **実機シナリオテスト完走**: 実機キャプチャ JSON（`sack_food_in_out_1788646234719.json`）を用いた再生テストで、出し入れの完全整合性を検証済み。

### 2.3. インテリジェントUI群（虐殺 P1 ＆ 変化制御 P3）の先行実装
- **該当設計**: [`docs/7_futures/gkl_intelligent_ui_ideas.ja.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/7_futures/gkl_intelligent_ui_ideas.ja.md)
- **達成内容**:
  - **虐殺アシスタント (Genocide Assistant - P1)**:
    - `GenocideService.js`: 自己虐殺防止ガード（自キャラの現種族入力時に赤枠警告）、危険種族（L, h, c, &, disenchanter等）のクイックサジェスト、クラス一族/単体種の切替トグル。
    - `MONSTER_OFFICIAL_FLAGS.js`（4,987行）: NetHack 5.0 Cヘッダ（`monflag.h`）に完全準拠した公式属性マスターを配備。
    - `genocide_assistant_sandbox.html` および各クライアント用モーダルを配備。
  - **変化制御アシスタント (Polymorph Assistant - P3)**:
    - `PolymorphService.js`: 変身候補モンスター一覧の検索・提示、飛行・耐性・サイズプレビュー。
    - `MonsterArmorRiskResolver.js`: 変身後の体型変化（大・小・無足・多腕等）による装備破壊リスクを事前診断。
    - `polymorph_assistant_sandbox.html` を配備。

### 2.4. GKL 構造化知識の深化 ＆ データ集約
- **達成内容**:
  - **アーティファクト知識ベース (`ARTIFACT_KNOWLEDGE_BASE.js`)**: 全アーティファクトの特殊効果、耐性、ベースアイテム、出現条件等の完全マスタライズ（636行）。
  - **モンスター種族クラス知識 (`MONSTER_CLASS_KNOWLEDGE.js`)**: シンボル文字ごとの生態・危険度メタデータの一元管理。
  - **願いサービス (`WishService.js`) の強化**: プリセット拡充、アーティファクトおよびカテゴリ別アドバイス（`OBJECT_CATEGORY_ADVICE.js`）の連動。
  - **Knowledge Inspector 刷新 (`tools/knowledge-inspector.html`)**: アーティファクト、公式フラグ、変身リスクなどを視覚的に確認・監査できる開発ポータルへと大幅強化。
  - **辞書データの適正化**: `dictionary.csv` の不要エントリ・重複を整理。

### 2.5. NetHack C-Shim / メモリ直接アクセスの強化
- **達成内容**:
  - `NetHackMemory.js` に `getOpenContainerInfo()` などのメモリ直接読み出し関数を追加。開いている鞄・箱のオブジェクトポインタやインベントリ座標を C レベルで正確に取得可能に。
  - `NetHackWasmDriver.js` の状態同期、メモリ整合性、ダウンリンク録画機能の堅牢化。

### 2.6. インベントリ同期の最適化 ＆ 設定・音響・DevToolsの整理
- **達成内容**:
  - **インベントリワンクリック同期最適化**: `IconInventory` 操作時の表示不整合を修正。移動キーやカウント入力など非アイテム操作時の無駄な `invalidate()` を抑止する `isNonItemSequence` ガードを導入。
  - **複数スタック装備枠表示の修正**: 投擲用短剣など複数所持アイテムをメイン武器にした際の装備枠ハイライト不具合を修正。
  - **設定パラメータ (localStorage) の統一**: `FAQ_and_Configuration_Guide.md`、`tools/config.html`、`SoundEngine.js` の設定キー体系を整理・統一。
  - **DevTools / DebugInspector のスリム化**: `inspector_console.html` の保守性向上とテスト追加。

### 2.7. テスト基盤の完全統合・大整理
- **達成内容**:
  - `src/driver/test/` のテストコードを `tests/driver/` へ集約・移設し、Vitest に完全一元化。
  - **テスト実行実績**: **Vitest 58 テストスイート 758 テスト 100% PASS**（前回比 +251 テスト）。約 3 秒で全件が超高速に完走。

---

## 3. 新たに策定された設計仕様・新構想 (New Architecture & Specifications)

この期間中に、将来および次期実装に向けて新たに策定された重要設計ドキュメントです。

### 3.1. 装備ペーパードールUI ＆ 依存関係診断・換装プランナー
- **ドキュメント**: [`docs/3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md)
- **構想・アプローチ**:
  - **Diablo / Baldur's Gate 風の現代的ペーパードールUI** の実現。
  - 「外套を脱いでから鎧を脱ぎ、シャツを着て鎧と外套を着直す」「手袋を外して指輪を嵌める」といった NetHack 特有の煩雑な依存関係を自動解決。
  - **3フェーズ戦略**:
    - **Phase 1: 依存関係診断 (`EquipmentDependencyAnalyzer`)**: UIなしの純粋ドメインロジック。ブロッカー、所要ターン、呪いリスクを診断（既存の `TacticalAdvisor` に即時活用可能）。
    - **Phase 2: 自動換装プランナー (`EquipmentActionPlanner`)**: IRC レシピを自動生成し、最短手順で安全に着脱。
    - **Phase 3: ペーパードール UI (`PaperdollModal`)**: アバター描画、ドラッグ＆ドロップ、AC・耐性・重量リアルタイムプレビュー。

### 3.2. インベントリ重量・負荷状態管理アーキテクチャ
- **ドキュメント**: [`docs/3_gkl/Encumbrance_and_Weight_Management_Architecture.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/Encumbrance_and_Weight_Management_Architecture.md)
- **構想・アプローチ**:
  - **ゲージ・ランプ中心のUX**: 未知の袋や食べかけ食料の端数誤差を吸収し、「あとどれくらい持てるか」「動けなくなる危険があるか」を直感的に可視化。
  - **袋の中身スナップ確定**: 袋を開いた（`ContainerContentsManager` がフックした）瞬間に中身と重量を確定。
  - **手品袋（Bag of Holding）の適正補正**: 祝福（25%）、未呪い（50%）、呪い（200%）の中身重量軽減・倍増を精密計算。
  - **共通サービス化**: `EncumbranceStateManager` と `EncumbrancePresenter` を独立させ、アイコンインベントリ、コンテナUI、ペーパードールUIで統一表示。

### 3.3. GKL バリアント適応拡張・互換性アーキテクチャ構想
- **ドキュメント**: [`docs/7_futures/gkl_variant_adaptation_architecture.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/7_futures/gkl_variant_adaptation_architecture.md)
- **構想・アプローチ**:
  - Vanilla NetHack 5.0 以外のバリアント（Slash'EM、JNetHack、3.6系逆移植版等）に対する GKL プラグインの互換性設計。
  - **メタデータ契約 ＆ ソフトチェック方式の採用**: バリアント不一致時にハードリジェクトせず、マップ追跡やトラベルなどの共通機能を生かしつつ、危険な図鑑・戦術誤情報のみを安全にフォールバック/警告。
  - 依存度別 3 レベル分類（L1: 非依存、L2: 弱依存、L3: 強依存）。

---

## 4. 更新されたペンディング状態 (Updated Pending & Future Roadmap)

最新のソースコードおよびドキュメント状況に基づき、現在のペンディング事項を再整理しました。

```mermaid
mindmap
  root((NetHack WASM WebUI<br/>ペンディング・構想<br/>2026/09/14版))
    インテリジェントUI・操作高度化
      コンテナUI 水平展開 (最優先)
        Vue / React / Svelte / Solid展開
      装備ペーパードール (新規)
        Phase 1: 依存関係診断レポート
        Phase 2: IRC換装プランナー
        Phase 3: PaperdollModal UI
      重量・負荷管理 (新規)
        EncumbranceStateManager
        ゲージ・ランプ共通Presenter
      魔法詠唱ダイアログ (P4)
        系統別グリッド / 成功率可視化
      文字彫り・命名手動アシスタント
    アーキテクチャ深化 (docs/7_futures)
      WebUIDevice 独立分離
      WebUISound 受信駆動 (Pub/Sub) 化
      Canvas/WebGL レンダラー高度化
      Save/Load Bridge API 拡張
    翻訳システム次世代刷新 (docs/9_translation)
      Phase 1: 辞書自動タグ付け
      Phase 2: かすれ文字復元ファジーマッチ
      Phase 3: 固定長 [uXXXX] シム
    演出・遠距離・音響連携
      遠距離/AoE 射線プレビュー
      fx_trigger と SoundEngine の統合
    テスト・CI運用
      GitHub Actions CI 自動テスト
```

### 4.1. ペンディング機能一覧テーブル

| 領域 | 優先度 | 機能・構想名 | 主な内容・目標 | 現在のステータス |
| :--- | :---: | :--- | :--- | :---: |
| **操作・UI** | **P0** | **コンテナUIのモダンクライアント水平展開** | Pure JS クライアントで完成した `ContainerModal` を、Vue, React, Svelte, SolidJS の各モダンクライアントへ移植・展開する | **未着手 (Pure JS のみ先行完了)** |
| **操作・UI** | **P1** | **装備依存関係診断レポート<br>(Equipment Paperdoll Phase 1)** | `EquipmentDependencyAnalyzer` を作成。既存の `TacticalAdvisor` / `ItemSpecPresenter` と連動し、「なぜ着られないか」「どう脱ぐか」を提示 | **仕様確定・未着手** |
| **操作・UI** | **P1** | **インベントリ重量・負荷管理<br>(Encumbrance Architecture)** | `EncumbranceStateManager` と共通 Presenter を作成。アイコンインベントリやコンテナUIに負荷ゲージ・警告ランプを配備 | **仕様確定・未着手** |
| **操作・UI** | **P2** | **換装プランナー ＆ ペーパードールUI<br>(Equipment Paperdoll Phase 2-3)** | IRC レシピによる多段階着脱の自動実行、およびアバター付き二面ペーパードール画面（`PaperdollModal`）の構築 | **仕様策定済み・ペンディング** |
| **操作・UI** | **P3** | **ビジュアル魔法詠唱ダイアログ<br>(Visual Spellcasting UI - P4)** | 系統別グリッド配置、装備ペナルティ込み詠唱成功率・消費MP・効果範囲の可視化 | **ペンディング**<br>(※スロットz詠唱は実装済) |
| **操作・UI** | - | **文字彫り・命名アシスタント** | 道具別摩耗ターン事前表示、Elberethクイック彫り、価格識別メモのワンタップ付与 | **ペンディング** |
| **基幹** | **P2** | **WebUIDevice の独立分離** | Gamepad, Touch, KeyMapper を Core 内部から外出しし、マクロ展開・キーリマップ層を集約 | **ペンディング** |
| **基幹** | **P2** | **WebUISound の受信駆動化** | Core からの直接呼び出しを撤廃し、`core.on('soundEffect')` 購読型へ疎結合化 | **ペンディング** |
| **演出** | **P2** | **fx_trigger と SoundEngine 連携** | 攻撃ヒット、被弾、死亡等のイベントに効果音（ヒット音・被弾音・ファンファーレ）を自動接続 | **ペンディング** |
| **演出** | **P3** | **遠距離・AoE 射線プレビュー** | 投擲・杖・魔法詠唱時の誤爆防止と視覚的射線オーバーレイガイド | **ペンディング** |
| **翻訳** | **P3** | **翻訳次世代刷新 (Phase 1〜3)** | 辞書の Category タグ付け、かすれ文字復元ファジーマッチ、`[uXXXX]` シムによる文字化け防止 | **ペンディング** |
| **CI** | **P2** | **GitHub Actions CI ゲートウェイ化** | PR・コミット時に Vitest 758件を自動実行するワークフローの構築 | **ペンディング** |

---

## 5. 次回以降の推奨着手順序 (Recommended Roadmap)

以上の再評価に基づき、直近の開発セッションにおいて推奨されるロードマップ案です。

```text
【最優先: 成果の水平展開】
Step 1: コンテナUIのモダンクライアント水平展開 (Vue / React / Svelte / Solid)
        └─ Pure JS 版で実稼働・検証済みの ContainerModal / ContainerController 連携を各クライアントに展開。

【即効性・UX向上: Quick-Win】
Step 2: 装備依存関係診断 (Paperdoll Phase 1) ＆ 重量管理 (Encumbrance) の実装
        └─ EquipmentDependencyAnalyzer による装備ブロッカー診断（TacticalAdvisor連携）。
        └─ EncumbranceStateManager によるインベントリ負荷ゲージ表示。

Step 3: fx_trigger と SoundEngine の連携
        └─ 既存の視覚演出イベントに音響（攻撃ヒット・被弾・死亡ファンファーレ）をバインド。

【高度機能の具現化】
Step 4: 装備換装プランナー ＆ ペーパードールUI (Paperdoll Phase 2-3)
        └─ IRC レシピによる安全な自動着脱と、アバター付きビジュアル換装モーダル。

Step 5: ビジュアル魔法詠唱ダイアログ (P4) ＆ 射線プレビュー
        └─ 魔法グリッド・成功率表示、および投擲・魔法の弾道可視化。

【基盤・翻訳強化】
Step 6: WebUICore マイクロカーネル化 (WebUIDevice / WebUISound の分離)
Step 7: 翻訳次世代刷新 (Phase 1〜3)
```
