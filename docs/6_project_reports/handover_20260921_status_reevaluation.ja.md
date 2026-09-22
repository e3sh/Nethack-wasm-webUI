# NetHack WASM WebUI 完了状態・ペンディング状態 再評価総合レポート (2026年9月21日版)
**調査・評価実施日**: 2026年9月21日  
**対象リポジトリ**: `Nethack-wasm-webUI` (最新コミット `55289c8` 時点)  
**前回レポート**: [`docs/6_project_reports/handover_20260914_status_reevaluation.ja.md`](./handover_20260914_status_reevaluation.ja.md) (コミット `981fcfd`)

---

## 1. エグゼクティブサマリー (Executive Summary)

本レポートは、前回総合評価レポート（2026/09/14）以降のソースコード（`src/`、`examples/`、`tests/`）、コミット履歴（2026/09/14 〜 2026/09/21、計42コミット）、および最新の設計書群（`docs/1_driver/`, `docs/2_client_ui/`, `docs/3_gkl/`, `docs/4_sound/`, `docs/7_futures/`）を網羅的に精査し、**「9月14日以降に新たに達成された完了状態」** と **「新たに策定された設計仕様および更新されたペンディング状態」** を体系的にまとめたものです。

この1週間でプロジェクトは**「描画系（WebGPU/仮想スクリーン）の抜本的刷新」「伝承図鑑・床文字考古学の統合」「ペーパードール・重量負荷の完成」「Cソースメッセージの全件静的抽出」**という極めて大きなマイルストーンを次々と突破し、飛躍的な進化を遂げました。

### 📊 主な再評価ハイライト (前回 09/14 からの主要な変化)

1. **画面描画アーキテクチャの全面革新 (仮想スクリーン統合 ＆ WebGPU HD-2D レンダラー)**:
   - 従来の「80x24固定縮小画面とフォーカスカメラの二重表示」という構造的課題を解消するため、**`VirtualDungeonScreen`、`MainViewportRenderer`、`MinimapHudRenderer`** による仮想スクリーン統合（Phase 1〜3）を完遂。
   - さらに、オクトパストラベラー風の **生WebGPU / WGSL による HD-2D ジオラマレンダラー (`WebGPUHD2DRenderer`)** が正式稼働。軽量ライティング、動的ランタン視界、テストスイートを配備し、単なる構想を超えて本番描画モードとして結実しました。
2. **冒険手帳・伝承図鑑 (RUMOR & LORE CODEX) ＆ 床文字考古学復元 (Engraving)**:
   - ダンジョン内で遭遇した噂（フォーチュンクッキー）、格言、墓碑銘を永続知識として蓄積・閲覧できる **`LoreCodex` / `LoreModal`** を実装。
   - 床文字のかすれ文章から真のテキストを推測・復元し、Elbereth 結界判定や再刻み（再書き込み）を支援する **`EngravingArchaeologist` / `EngravingHud`** を新設。
3. **装備ペーパードールUI ＆ インベントリ重量負荷管理の完全稼働**:
   - 前回設計書として策定されたペーパードール構想が、`EquipmentDependencyAnalyzer`（Phase 1）、`EquipmentActionPlanner`（Phase 2）、`PaperdollModal`（Phase 3）を経て完全稼働。
   - 重量・負荷状態をプログレスゲージとリスクランプで可視化する `EncumbranceStateManager` / `EncumbrancePresenter` を配備。
4. **各種インテリジェント入力支援ダイアログの完成**:
   - キャラクター作成画面 (`CharacterCreationModal`)、巻物・魔導書書き込み支援 (`WriteModal` / `WriteService`) を新設。願い、虐殺、変化制御とあわせて主要なプロンプト入力支援が勢揃いしました。
5. **NetHack Cソースからのメッセージ完全静的抽出（14,849件）と Phase 5 移行計画**:
   - `extract_source_messages.py` により、NetHack 5.0 C言語コア内の全メッセージ（14,849件）を静的抽出完了。
   - これを基礎とした次世代シグナル駆動＆多言語透過アーキテクチャの公式移行計画書 (`docs/7_futures/phase5_detailed_migration_plan.ja.md`) を策定。
6. **方向パッド (DirectionPad) コンテキスト操作 ＆ 全クライアント展開**:
   - 方向選択時のデフォルト操作、長押し移動、ダブルタップダッシュを実装。PureJS、React、Solid、Svelte、Vue の全5種クライアントへ一括展開。
7. **品質・自動テストのさらなる拡大**:
   - 単体・統合テストは前回の 758 件から **1,046 件（全 78 テストスイート 100% PASS）** へと大幅拡大。

---

## 2. 前回以降の完了状態 (Completed Status - 2026/09/14 〜 2026/09/21 実装検証済み)

以下は、ソースコードおよびテストコードの直接確認により、**この期間に新たに実装・検証が完了した項目**です。

### 2.1. 仮想スクリーン統合レンダラー ＆ UI画面刷新 (Phase 1〜3 完成)
- **該当設計**: [`docs/2_client_ui/unified_renderer_and_screen_architecture_plan.md`](../2_client_ui/unified_renderer_and_screen_architecture_plan.md)
- **達成内容**:
  - **Phase 1: オフスクリーン仮想スクリーンバッファ (`VirtualDungeonScreen.js`)**:
    - ダンジョン全体描画をオフスクリーンキャンバスに集約し、描画負荷を劇的に低減。
  - **Phase 2: UI 画面構成刷新 (`MainViewportRenderer.js` / `MinimapHudRenderer.js`)**:
    - メイン領域をプレイヤー中心のフォーカスビュー（高解像度）とし、全体マップは半透明のミニマップHUDとしてオーバーレイ表示。プレイヤーの移動に伴い、視界を遮らないようミニマップが画面四隅へ自動退避（スマート退避）するロジックを実装。
    - ASCII モード時におけるマウスホバー・クリックによるセル検知を完全対応。
  - **Phase 3: レンダラー切替と描画調整**:
    - 通常2Dキャンバス、ASCIIグリッド、WebGPU HD-2Dの3モードを1クリックでシームレスに切り替え可能に。

### 2.2. WebGPU HD-2D ジオラマレンダラー (`WebGPUHD2DRenderer.js`) 【完成・本稼働】
- **該当設計**: [`docs/7_futures/webgpu_hd2d_diorama_renderer.ja.md`](../7_futures/webgpu_hd2d_diorama_renderer.ja.md)
- **達成内容**:
  - **生WebGPU / WGSL による 3D ミニチュア表現**: 外部ライブラリ依存ゼロで、NetHack の 2D タイルをクオータビュー（アイソメトリック）の 3D ジオラマとして描画。
  - **動的ランタン視界＆軽量ライティング**: WGSL シェーダー内に動的光源計算を組み込み、プレイヤー周辺のランタン光やダンジョンの陰影・パーティクル効果を演出。
  - **省電力・安全フォールバック**: 非表示時の 0 FPS 停止、非対応ブラウザでの自動フォールバック、単体テスト (`tests/ui/WebGPUHD2DRenderer.test.js`) 完備。

### 2.3. 冒険手帳・伝承図鑑 (RUMOR & LORE CODEX) ＆ 床文字考古学復元 (Engraving)
- **達成内容**:
  - **冒険手帳 (`LoreCodex.js` / `LoreDetector.js` / `LoreModal.js`)**:
    - フォーチュンクッキーの噂（True/False Rumors）、神託所の託宣（Oracle）、墓碑銘（Headstone）、格言落書き（Wisdom）をテキストストリームから自動検出し、図鑑としてアンロック・LocalStorage 永続化。
    - 閲覧用リッチモーダル `LoreModal` を配備。墓碑銘の日本語訳表示バグなども修正済み。
  - **床文字考古学復元 (`EngravingArchaeologist.js` / `EngravingHud.js`)**:
    - かすれた床文字（例: `El?ereth`）から原型を推測し、魔除けの結界文字（Elbereth）の完全性（Integrity）や結界有効状態を判定。
    - ステータスバー直下の専用HUDバナーにて、原型差分や日本語訳・出典（『Portal』など）を表示し、ワンクリックで再刻み（再書き込み）を実行するボタンを提供。

### 2.4. 装備ペーパードールUI ＆ 依存関係診断・換装プランナー (Phase 1〜3 完成)
- **該当設計**: [`docs/3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md`](../3_gkl/Equipment_Paperdoll_and_Dependency_Architecture.md)
- **達成内容**:
  - **Phase 1: 依存関係診断 (`EquipmentDependencyAnalyzer.js`)**: 外套・鎧・シャツの3層構造や手袋・指輪・武器・盾の依存ルールを解析。
  - **Phase 2: 換装キーストロークプランナー (`EquipmentActionPlanner.js`)**: 脱着に必要な最適手順（所要ターン数、脱衣順序）を事前シミュレーション。
  - **Phase 3: スロット別ペーパードールUI (`PaperdollModal.js`)**: 部位ごとのスロット表示、装備中/空きスロット状態、控え武器表示を実装。

### 2.5. インベントリ重量・負荷状態管理アーキテクチャ
- **該当設計**: [`docs/3_gkl/Encumbrance_and_Weight_Management_Architecture.md`](../3_gkl/Encumbrance_and_Weight_Management_Architecture.md)
- **達成内容**:
  - `EncumbranceStateManager.js` および `EncumbrancePresenter.js` により、所持アイテム総重量と負荷レベル（無負荷/負荷/過負荷/動けない等）をリアルタイム計算。
  - 誤差を自然に吸収するプログレスゲージとカラーランプによるリスク表示をクライアントに統合。

### 2.6. キャラクター作成画面 ＆ 巻物・魔導書書き込み UI
- **達成内容**:
  - **キャラクター作成画面 (`CharacterCreationModal.js`)**: ゲーム開始時の役割（Role）、種族（Race）、性別（Gender）、属性（Alignment）をGUIで選択可能に。
  - **書き込み支援 (`WriteService.js` / `WriteModal.js`)**: 魔法のマーカー使用時の定番巻物・魔導書プリセット、必要インク量表示、白紙ロスト警告を提供。

### 2.7. 方向パッド (DirectionPad) によるコンテキスト移動・ダッシュ操作
- **達成内容**:
  - 推奨アクションが無い場合に方向選択でデフォルト操作ボタンを表示。
  - 方向長押しによる連続移動、ダブルタップ/クリックによるダッシュ移動をサポート。
  - Pure JS、React、Solid、Svelte、Vue の全5種類のクライアント実装に横断適用。

### 2.8. NetHack Cソースメッセージ静的抽出（14,849件）
- **達成内容**:
  - Pythonスクリプト `tools/extract_source_messages.py` により、Cソース全域から14,849件のメッセージ定義を自動抽出。
  - JSON / CSV 形式でカタログ化（`tools/data/source_messages.json`）し、機械制御用シグナル網羅と次世代メッセージ照合基盤の土台を構築。

---

## 3. 新規策定ドキュメント ＆ 将来構想 (New Documents & Backlog)

| ドキュメント | ステータス | 概要 |
| :--- | :---: | :--- |
| **[`phase5_detailed_migration_plan.ja.md`](../7_futures/phase5_detailed_migration_plan.ja.md)** | `🚧 planned` | メッセージマスタ移行・WebUICore責務純化（Stage 5.1〜5.4）詳細設計書 |
| **[`Dungeon_Tracker_and_Checkpoint_Architecture.md`](../3_gkl/Dungeon_Tracker_and_Checkpoint_Architecture.md)** | `💡 proposed` | ダンジョン探索トラッカー＆チェックポイント（箱・旗立て🚩）構想書 (9/21作成) |
| **[`Spatial_Pattern_Engine_Architecture.md`](../3_gkl/Spatial_Pattern_Engine_Architecture.md)** | `💡 proposed` | GKL空間幾何学認識エンジン設計書 (床パターン・密集シグナル認識) (9/21作成) |
| **[`dynamic_musical_synthesis_concept.ja.md`](../4_sound/dynamic_musical_synthesis_concept.ja.md)** | `💡 proposed` | Web Audio オシレーターによるリアルタイム音程・楽器シンセシス構想 |
| **[`ROADMAP.md`](../ROADMAP.md)** | `🟢 active` | プロジェクト総合ロードマップ＆進捗ダッシュボード（9/21新設） |

---

## 4. 現在のペンディング状態 ＆ 次のセッション推奨フォーカス

### 🎯 最優先推奨タスク: Phase 5 段階的移行の着手
[`docs/7_futures/phase5_detailed_migration_plan.ja.md`](../7_futures/phase5_detailed_migration_plan.ja.md) に基づき、以下の順序で進めることが推奨されます：

1. **Stage 5.1: LORE/Codex の GKL 配下への移設と WebUICore 責務純化**:
   - `src/core/lore/` を `src/core/knowledge/lore/` へ移設。
   - `WebUICore.js` に直接書かれている LORE 処理（約90行）を GKLPlugin 側のシグナル購読モデルへ移行し、WebUICore を低レベル I/O に純化。
2. **Stage 5.2: 実行時メッセージコンテキスト照合基盤 (`MessageContextResolver`) の配備**:
   - 抽出済みメッセージマスタから軽量実行時カタログを生成し、O(1) 高速照合パイプラインを確立。
3. **Stage 5.3: ドメイン別モジュールのマスタ移行**:
   - SoundEngine (5.3A)、AttributeStateManager (5.3B)、ItemIdentificationResolver (5.3C) のメッセージ依存部をマスタ移行。

### 🔮 次期機能拡張候補
- **空間幾何学認識エンジン (`SpatialPatternEngine`) ＆ ダンジョントラッカー**:
  - マップ上のグリフ配置パターン認識のプロトタイプ実装。
  - セーブデータ完全相乗りによる全階層宝箱・拠点トラッキング。
