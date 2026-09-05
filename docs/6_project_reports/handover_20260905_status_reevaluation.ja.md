# NetHack WASM WebUI 完了状態・ペンディング状態 再評価総合レポート
**調査・評価実施日**: 2026年9月5日  
**対象リポジトリ**: `Nethack-wasm-webUI` (最新コミット `dee6b1c` 時点)

---

## 1. エグゼクティブサマリー (Executive Summary)

本レポートは、前回引き継ぎ資料（2026/08/29）以降の最新ソースコード（`src/`、`examples/`）およびコミット履歴（2026/08/29 〜 2026/09/05）、ならびに `docs/` 内の全設計書・将来構想（`7_futures/`, `9_translation/`, `8_testing/`, `3_gkl/`）を徹底精査し、**「実際に完了している状態」** と **「今後取り組むべき真のペンディング（未着手・構想中）状態」** を再評価・整理したものです。

### 📊 主な再評価ハイライト
1. **前回引き継ぎ事項の「大幅な前倒し達成」**:
   - 前回（08/29）で引き継ぎ事項とされていた「モダンクライアント（Vue, React, Svelte, SolidJS）への最新GKL機能の水平展開」および「UI層からのゲーム内知識排除（UI Decoupling）」は、直近コミット（`dee6b1c`, `456ec53`, `c32d723`）によって **全クライアントで完全実装完了** しています。
   - ナレッジ単一真実源（SSOT）統合（Phase 0〜5）およびインベントリポストコンバット同期（Phase 2）も **完全実装・検証済み** です。
2. **品質・自動テストの大幅拡充**:
   - 単体テスト数は 338 件から **507 件（全 47 テストスイート 100% PASS）** へと飛躍的に拡大し、全領域での堅牢性が担保されています。
3. **真のペンディング事項（将来構想）の明確化**:
   - `7_futures`（インテリジェントUI・マイクロカーネル化）、`9_translation`（かすれ文字復元・固定長マルチバイトシム）、および演出・音響連携のロードマップが、次の開発ターゲットとしてクリアに抽出されました。

---

## 2. 現在の完了状態 (Completed Status - ソース検証済み)

以下は、ソースコードおよびテストコードの直接確認により、**すでに実装および検証が完了していることが確認された項目**です。

### 2.1. UI層のゲーム内知識排除・アーキテクチャ境界改善 (UI Decoupling) 【最新完了: 2026/09/05】
- **該当設計**: [`docs/2_client_ui/UI_Domain_Knowledge_Decoupling_Plan.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/2_client_ui/UI_Domain_Knowledge_Decoupling_Plan.md)
- **達成内容**:
  - **確定耐性・キャラクター要約のコア昇格**: `AttributeStateManager` および `SituationCache` に `activeResistances` と `characterSummary`（種族・職業・Lvタグ）を新設。UI側での辞書・外部マップループ処理を完全撤廃。
  - **正規化方向コード付与**: `ContextActionEngine` がアクション生成時に `directionCode`（`'N'`, `'NE'` 等）を標準付与。UI側の泥臭い正規表現・キーマップ判定を全廃。
  - **フォーカスカメラタイルのコア解決**: `AreaStateManager.getFocusCameraTiles(radiusX, radiusY)` および `GKLPlugin` 経由のファサードを実装。死亡時墓石（4011）や未探索判定（Glyph 0）をコアで完全解決し、UIへ整形済み 2D 配列を一発返却。
  - **移動APIの統一**: `core.gkl.travelTo({ x, y })` への一本化。

### 2.2. 全モダンWebクライアントへの最新GKL機能の水平展開 【完了: 2026/09/04〜09/05】
- **対象クライアント**:
  - `examples/gkl-pure-js-client/` (Pure JS)
  - `examples/vue-client/` (Vue 3 + Vite)
  - `examples/react-client/` (React 18 + Vite)
  - `examples/svelte-client/` (Svelte 5 + Vite)
  - `examples/solid-client/` (SolidJS + Vite)
- **達成内容**:
  - **HUD最上部 1行シグナルバー (Level 2)**: 優先度スコアリングに基づく最重要アドバイスの1行表示。
  - **スロット Nano Badge (Level 1)**: インベントリや魔法一覧での `[💊緊急回復]`, `[🔥治療]`, `[⚠️高失敗]` 等の分散バッジ表示。
  - **FocusCamera (21×9)**: 広域ズームカメラ、透過レイヤー合成、死亡墓石描画。
  - **フロア設備サマリー (HUD & Tooltip)**: 階段・祭壇・泉・店主の自動集約ナビゲーション。
  - **ワンタップ魔法詠唱 (`z`)**: 失敗率・系統表示とワンタップ詠唱連携。
  - **願いビルダー (WishModal)**: 480種以上のアイテムカタログ、プリセット、属性設定、正規コマンド生成GUIを全クライアントに統合。

### 2.3. 構造化ナレッジ単一真実源 (SSOT) 統合 【完了: Phase 0〜5 全完了】
- **該当設計**: [`docs/3_gkl/GKL_Knowledge_SSOT_and_Tactical_Integration_Architecture.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/GKL_Knowledge_SSOT_and_Tactical_Integration_Architecture.md)
- **達成内容**:
  - **Phase 0 (テストファクトリ)**: `createTestItem` の導入と手動文字列モックの排除。
  - **Phase 1 (ナレッジスキーマ拡張)**: モンスター（`threat`, `counters`）、アイテム（`effects`, `protectsAgainst`）のメタデータ化、辞書（`dictionary.csv`）統合。
  - **Phase 2 (確定耐性モデル)**: 種族・職業・レベル・装備から算出する決定論的確定耐性への一本化（`^X` 依存コードの廃止）。
  - **Phase 3 (戦術アドバイザーのデータ駆動化)**: `TacticalAdvisor` の個別ハードコードを排除し、`ADVICE_DEFINITIONS` マスター連動へ移行。
  - **Phase 3.5 (スキーマ正規化 ＆ 静的監査)**: 統合防護モデル（モンスター＋地形ハザード）の策定、`KnowledgeIntegrityAudit.test.js` による全データ完全性監査の配備。
  - **Phase 4 (ケミストリーSSOT統合)**: `CHEMISTRY_KNOWLEDGE_BASE.js` による流し台（`#sit` 撤廃・ドロップ是正）、神壇、泉、ユニコーンの角、手品袋の一元管理。
  - **Phase 5 (アシストシグナルのデータ駆動化)**: `ASSIST_SIGNAL_DEFINITIONS.js` 新設、生存アイテム・戦闘脅威のデータ駆動判定、コード量大幅スリム化。

### 2.4. インベントリ状態同期アーキテクチャ 【完了: Phase 1 & Phase 2】
- **該当設計**: [`docs/3_gkl/GKL_Inventory_Synchronization_Architecture.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/3_gkl/GKL_Inventory_Synchronization_Architecture.md)
- **達成内容**:
  - **Phase 1 (AC変化検知同期)**: `BL_AC = 14` 変動監視によるゼロオーバーヘッド即時 invalidate。
  - **Phase 2 (MonsterTracker連動型ポストコンバット同期)**: `stealsItems` 特性敵（ニンフ、レプラコーン、猿等）との接触フラグ（`hadCloseContact`）管理。戦闘中は同期待機し、監視外れ（テレポート、逃走LoS外れ、撃破、減衰）時に 1 度だけ遅延 invalidate を実行する結果的整合性モデルを完全配備。

### 2.5. 翻訳管理 DevTools インスペクター統合 【完了】
- **該当設計**: [`docs/9_translation/translation_inspector_integration_plan.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/9_translation/translation_inspector_integration_plan.md)
- **達成内容**:
  - `WebUICore` の `translationLog` および `messageUntranslated` イベント発行基盤。
  - `DebugInspector` からの BroadcastChannel 配信。
  - ノイズメッセージ（数字単体等）の自動除外、既知翻訳フィルタリング、リアルタイム対比ログ、未翻訳キューのエクスポート機能。

### 2.6. テスト基盤刷新 (Testing Modernization) 【完了: Phase 1〜4 & Phase 5一部】
- **該当設計**: [`docs/8_testing/Testing_Modernization_Implementation_Roadmap.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/8_testing/Testing_Modernization_Implementation_Roadmap.md)
- **達成内容**:
  - **Phase 1 (上り第1防壁)**: `SequenceProtocolValidator.js`（静的プロトコル検査）。
  - **Phase 2 (下り基盤整備)**: `ScenarioDriver.js`（疑似ドライバ再生ランタイム）、`NetHackWasmDriver` 録画機能。
  - **Phase 3 (統合シナリオテスト)**: 実機キャプチャ JSON 7件に基づく `realScenarios.test.js`。
  - **Phase 4 (上り第2/第3防壁)**: `ProtocolValidatorFakeDriver`（動的契約検査）、`headlessDriverSimulation`（マルチステップ完走検証）。
  - **Phase 5一部 (録画スタジオUI ＆ 開発ツール統合)**:
    - **Scenario Recorder Studio ([`tools/scenario-recorder.html`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/scenario-recorder.html))**: `<iframe>` 内に全クライアント（Pure JS, Vue, React, Svelte, Solid 等）を動的に読み込んで実機プレイしながら、イベントストリームをリアルタイムキャプチャし、統合テスト用シナリオ JSON（`test/fixtures/scenarios/*.json`）を一発生成・ダウンロードできる専用スタジオ環境を構築完了。
    - **開発ツールポータル統合 ([`tools/dev_tools.html`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/tools/dev_tools.html))**: 開発ツールポータル画面に「Scenario Recorder Studio」のアクセスカードを正式配備。
    - **インスペクター内コントロールバー ([`ScenarioRecorder.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/inspector/ScenarioRecorder.js))**: 単体テスト検証済みの極小 REC バー（[● REC] [■ Stop] [💾 Export]）も完備。
  - **テスト実行実績**: **Vitest 47 ファイル 507 テスト 100% PASS**、ドライバーテスト 12 テスト 100% PASS。

---

## 3. 再評価されたペンディング状態 (Pending & Future Roadmap)

ソースコードおよび docs 内の設計書を精査した結果、**現在未着手・進行中・将来構想として保留されている事項**をカテゴリ別に再評価・分類しました。

```mermaid
mindmap
  root((NetHack WASM WebUI<br/>ペンディング・構想))
    インテリジェントUI<br/>docs/7_futures
      虐殺アシスタント (P1)
        自己虐殺防止ガード
        危険種族サジェスト
        クラス/単体切替
      ビジュアル・コンテナUI (P2)
        2カラム視覚的インベントリ
        鞄爆発防止警告
        ワンタップ一括収納
      変化制御アシスタント (P3)
        変身候補モンスター一覧
        能力・耐性・サイズプレビュー
      魔法詠唱ダイアログ (P4)
        系統別グリッド
        成功率/消費MP/範囲可視化
      文字彫り/エルベレス手動拡張
      アイテム命名/コール手動拡張
    アーキテクチャ深化<br/>docs/7_futures
      WebUIDevice 独立分離
        Gamepad/Touch/KeyMapper外出し
        マクロ展開/IME誤爆防止
      WebUISound 受信駆動化
        core.on('soundEffect') 疎結合化
      Canvas/WebGL レンダラー高度化
        アニメーション/スムーズ移動
      Save/Load Bridge API 拡張
        複数セーブ/クラウド連携
    翻訳システム次世代刷新<br/>docs/9_translation
      Phase 1: 自動タグ付けスクリプト
        Category列の付与マイグレーション
      Phase 2: コンテキスト別ファジーマッチ
        かすれ文字(Engraving)復元
      Phase 3: 固定長マルチバイトシム
        [uXXXX]相互変換・耐かすれ
    演出・遠距離・音響連携
      遠距離/AoE 射線プレビュー
      fx_trigger と SoundEngine の統合
    テスト・運用自動化
      GitHub Actions CI ゲートウェイ化
```

---

### 3.1. 🔮 インテリジェントUI・操作高度化 (docs/7_futures/gkl_intelligent_ui_ideas.ja.md)

願いビルダー（Wish Builder）の成功に続く、コンテキスト検知型GUIアシスタント群です。

| 優先度 | 機能名 | 対象トリガー | 主な構想・仕様 | 現在のステータス |
| :---: | :--- | :--- | :--- | :---: |
| **P1** | **虐殺アシスタント<br>(Genocide Assistant)** | `"What monster do you want to genocide?"` | ・**自己虐殺防止セーフティガード**（プレイヤーの現種族入力時に赤枠警告）<br>・危険種族（`L`, `h`, `c`, `&`, `disenchanter` 等）のサジェスト<br>・単体種 / クラス（大文字シンボル一族）のトグル切替 | **未着手・ペンディング** |
| **P2** | **二画面ファイラー型<br>ビジュアル・コンテナUI** | Container 操作<br>(`apply` / `#loot` / `#tip`) | ・**DOS時代の二画面ファイラー（FD/Norton Commander）思想**による直感的出し入れ<br>・手持ち鞄だけでなくダンジョン設置の**宝箱(Chest)・木箱(Box)・氷箱(Ice Box)**に対応<br>・拠点倉庫整理の劇的快適化＆氷箱での死体・食料腐敗防止ストック管理<br>・**鍵（合鍵・ピックでの解錠）＆罠（#untrap火薬爆発防止）のセーフティ連携**<br>・**手品袋（Bag of Holding）の大爆発防止セーフティ警告**（変化の杖等の誤投入遮断）<br>・金貨・宝石の一括収納＆重量積載率プログレスバー | **未着手・ペンディング** |
| **P3** | **変化制御アシスタント<br>(Polymorph Control)** | `"You feel a change coming over you..."` | ・変身候補モンスターのビジュアル一覧<br>・変身後の飛行・耐性・装備可否・サイズ（装備破壊リスク）のプレビュー | **未着手・ペンディング** |
| **P4** | **ビジュアル魔法詠唱ダイアログ<br>(Visual Spellcasting UI)** | `cast spell` (`Z`) | ・系統別（攻撃、回復、補助、脱出）グリッド配置<br>・装備ペナルティを考慮した詠唱成功率（%）、消費MP、効果範囲の可視化 | **未着手・ペンディング**<br>※現在スロットからのワンタップ詠唱(z)のみ実装済 |
| - | **文字彫り・エルベレス手動アシスタント** | `#engrave` (`E`) | ・道具（指輪・杖・素手等）別の摩耗ターン数・成功率事前表示<br>・Elbereth等の定型文クイック選択ダイアログ | **未着手・ペンディング**<br>※緊急時HUDボタンは実装済 |
| - | **アイテム命名・コール手動アシスタント** | `#call` / `#name` | ・価格識別メモ（100zm, 300zm）のワンタップ付与<br>・過去の同種族アイテム候補サジェスト | **未着手・ペンディング**<br>※自動メモ機能は実装済 |

---

### 3.2. 🏛️ アーキテクチャ深化・マイクロカーネル化 (docs/7_futures/webuicore_final_architecture_vision.md)

モノリシックな `WebUICore` から、マイクロカーネル＆イベント駆動エコシステムへの移行計画です。

1. **`WebUIDevice` の独立分離 (Phase 4)**:
   - **内容**: `GamepadManager`, `TouchCalculator`, `KeyMapper` を `WebUICore` 内部から完全に外出し分離し、外付け入力アダプタ層とする。
   - **効果**: キーボードマクロ展開（`20s` 等）、キーリマップ、IME誤爆防止、localStorage設定管理をこの層に集約し、Core の責務を純粋化。
   - **ステータス**: **未着手・ペンディング**
2. **`WebUISound` のメッセージ受信駆動（Pub/Sub）化 (Phase 4)**:
   - **内容**: Core 内部からのオーディオエンジン直接呼び出しを廃止し、`core.on('soundEffect', ...)` を購読して動作する完全疎結合モジュールへ移行。
   - **ステータス**: **未着手・ペンディング**
3. **Canvas / WebGL レンダラーの高度化 (Phase 5)**:
   - **内容**: スプライトアニメーション、タイルのスムーズ移動、オーバーレイエフェクトを描画できる高速レンダラーの強化。
   - **ステータス**: **将来構想・ペンディング**
4. **Save/Load Bridge API の拡張 (Phase 5)**:
   - **内容**: 複数セーブデータのバックアップ/復元、クラウドストレージ連携 API の整備。
   - **ステータス**: **将来構想・ペンディング**

---

### 3.3. 🌐 翻訳システム次世代刷新 (docs/9_translation/translation_architecture_enhancement_plan.md)

約18,000行の辞書資産（`dictionary.csv`）を活用した、多段翻訳パイプラインとマルチバイト安全化です。

1. **Phase 1: 自動タグ付け・辞書マイグレーションスクリプト整備**:
   - **内容**: NetHack 本体の `dat/engrave.txt` や `dat/rumors.*` から英文リストを抽出し、既存の `dictionary.csv` に文脈小分類（`Category: Engraving, Rumor, Combat...`）を自動付与するスクリプトの作成。
   - **ステータス**: **未着手・ペンディング**
2. **Phase 2: コンテキスト限定ファジーマッチングの実装**:
   - **内容**: 地面の刻み文字（`Engraving`）など、歩行や時間経過でランダムにかすれたテキスト（`El?ereth` 等）に対し、探索スコープを絞ってレーベンシュタイン距離（類似度85%以上）で安全に復元・日本語化する処理。
   - **ステータス**: **未着手・ペンディング**
3. **Phase 3: WebUI 側での固定長エンコード（`[uXXXX]`）シム導入**:
   - **内容**: プレイヤーが日本語を入力した際、固定長 ASCII（`[uXXXX]`）に変換して Wasm へ送信し、メッセージ受信時にデコードするフロントエンド・シム。Wasm 本体を一切改変せずに、日本語刻みでの文字化け（マルチバイト破壊）防止と耐かすれ復元を実現。
   - **ステータス**: **未着手・ペンディング**

---

### 3.4. 🎬 演出・遠距離ターゲティング・音響連携 (docs/3_gkl/GKL_Visual_FX_Event_Architecture.md)

1. **遠距離・AoE ターゲティング射線プレビュー機能**:
   - **内容**: 投擲（`t`）、杖（`z`）、魔法詠唱モード時における射線や効果範囲（AoE: ボール魔法等）のオーバーレイプレビュー表示。
   - **ステータス**: **未着手・ペンディング**
2. **`fx_trigger` イベントと `SoundEngine` の連携**:
   - **内容**: 現在視覚演出（画面シェイク、斬撃エフェクト、墓石描画）のみにバインドされている `fx_trigger` イベント（`ATTACK_HIT`, `DAMAGE_TAKEN`, `KILL_CONFIRMED`, `PLAYER_DIED` 等）を `SoundEngine` と連携させ、攻撃ヒット音・被弾音・死亡ファンファーレなどの効果音を自動再生する。
   - **ステータス**: **未着手・ペンディング**

---

### 3.5. 🧪 テスト自動化・運用体制 (docs/8_testing/Testing_Modernization_Implementation_Roadmap.md)

1. **Phase 5: GitHub Actions CI ゲートウェイ化**:
   - **内容**: プルリクエスト・コミット時に `npm test`（Vitest 507件）および `node --test`（Driver 12件）を自動実行し、プロトコル規約違反やデグレードを機械的にブロックする CI ワークフローの構築。
   - **ステータス**: **進行中・ペンディング**

---

### 3.6. ⚙️ C言語・エンジン側調査 (NetHackJP / NetHack 5.0)

1. **絵文字（OPTIONS=glyph）描画サポートの扱い ([`emoji_support_investigation.md`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/NetHackJP/docs/emoji_support_investigation.md))**:
   - **調査結果**: Windows コンソール API（`WriteConsoleOutputW`）の 16bit `CHAR_INFO` 制限（サロゲートペア不可）、C内部のパース文字数制限（6文字）、2カラム幅による次セル上書き破壊の3つの重層的要因により、Windows tty版でのカラー絵文字描画は構造的に困難。
   - **再評価**: WASM WebUI 版においては HTML/Canvas/SVG レンダラー経由で任意の絵文字・画像描画が既に可能であるため、tty版での C改修は優先度低の **保留（調査完了）** と評価。

---

## 4. 今後の推奨着手順序 (Recommended Roadmap)

以上の再評価に基づき、次回以降の開発セッションにおいて推奨されるロードマップ案です。

```text
【即効性・UX向上】
Step 1: 虐殺アシスタント (Genocide Assistant) の実装
        └─ PromptPayloadBuilder に GENOCIDE 判定を追加し、自己虐殺防止UIと危険シンボルサジェストを配備。

Step 2: fx_trigger と SoundEngine の連携
        └─ 既存の視覚演出イベントに音響（ヒット音・被弾音・死亡音）を接続し、臨場感を大幅向上。

【機能・利便性拡張】
Step 3: ビジュアル・コンテナUI (Visual Container Management) の実装
        └─ 魔法の利いた鞄の爆発防止警告、2カラムインベントリ、ワンタップ収納。

Step 4: 遠距離・AoE ターゲティング射線プレビューの実装
        └─ 投擲・魔法・杖の誤爆防止と視覚的ガイド。

【基盤・翻訳強化】
Step 5: 翻訳次世代刷新 (Phase 1〜3)
        └─ 辞書の Category タグ付け、かすれ文字復元、[uXXXX] による日本語刻み文字化け防止シム。

Step 6: WebUICore マイクロカーネル化 (WebUIDevice / WebUISound の完全分離)
```
