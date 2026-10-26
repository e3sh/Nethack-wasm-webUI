# WebUICore ユニットテストガイド (Testing Guide)

NetHack WebUI プロジェクトにおける **WebUICore (Core SDK) ユニットテスト・統合テスト基盤** の構成、実行方法、およびテスト追加ガイドライン。

本プロジェクトではテストランナーとして **Vitest** を採用しており、Wasm Cコアやブラウザ画面に依存しない純粋な計算・パースロジック、ナレッジ整合性監査、およびキー入力プロトコル検証（**全169テストスイート・2,177テスト（1 skipped） / 100% PASS**）をミリ秒単位（全件約16秒以内）で全自動検証します。

---

## 1. 実行コマンド (Execution Commands)

開発中やコミット前に、用途に合わせて以下のコマンドを使用します。

### ① 全件一括実行 (全自動検証)
```bash
npm test
```
* 全 169 テストスイート（2,177 件のテスト）が一括実行され、ターミナル上に合否結果を出力します。

### ② プロトコル検証テストのみ実行 (高速規約検査)
```bash
npx vitest run tests/protocol/
```
* 静的リンター、FakeDriver 契約検査、Headless シミュレーションの 3 防壁（27 テスト）をわずか 20ms 台でピンポイント実行します。

### ③ シナリオテストのみ実行 (Downlink 実機イベント再生)
```bash
npx vitest run tests/scenarios/
```
* 実機からキャプチャしたイベントログを ScenarioDriver で再生し、複数マネージャーの時系列連動を検証します。

### ④ ビジュアル UI 実行 (ブラウザ GUI)
```bash
npm run test:ui
```
* ブラウザ上に Vitest UI が立ち上がり、テストスイートのビジュアル選択、クリック実行、エラー行の比較表示が可能です。

---

## 2. 対象モジュールとテスト一覧 (Test Suites Overview)

現在構築されている主要テストスイート一覧です（※全 169 スイート・2,177 テストから主要カテゴリを抜粋）。

| レイヤー / 分類 | 主なテストファイル | 主な検証内容 |
| :--- | :--- | :--- |
| **【Layer 1: 純粋単体】入力・基盤・ライフサイクル** | `PromptPayloadBuilder.test.js`, `TouchCalculator.test.js`, `KeyMapper.test.js`, `GamepadManager.test.js`, `TextWindowManager.test.js`, `StatusAccessor.test.js`, `ArchitectureBoundary.test.js`, `GameOverResolver.test.js`, `GameLifecycleState.test.js` | プロンプト解析、画面アスペクト補正計算、キーマッピング、ウィンドウバッファ管理、UI Decoupling 境界規約、単一ステートマシンによるライフサイクル遷移管理（SSOT） |
| **【Layer 1: 純粋単体】GKL ナレッジ・状態追跡** | `TacticalAdvisor.test.js`, `AssistSignalSynthesizer.test.js`, `AreaStateManager.test.js`, `AreaStateManagerModularization.test.js`, `InventoryStateManager.test.js`, `MonsterTracker.test.js`, `ChemistryKnowledge.test.js`, `CharacterKnowledge.test.js`, `ItemInteractionRules.test.js`, `SpellStateManager.test.js`, `SkillStateManager.test.js`, `AttributeStateManager.test.js`, `DiscoveryStateManager.test.js` | 種族・職業・確定耐性計算、モンスター追跡、エリア4分割状態、所持品・耐性状態の追跡、戦術助言、アシストシグナル、ケミストリー・道具相互作用判定 |
| **【Layer 1: 純粋単体】Phase E (UIController & Web Components)** | `UIController.test.js`, `InputCoordinator.test.js`, `GamepadInputController.test.js`, `NhPaperdoll.test.js`, `NhContainerFiler.test.js`, `NhRadialPaletteHud.test.js`, `NhShirenInventoryDrawer.test.js`, `NhGamepadGuideBar.test.js`, `NhContextHintPill.test.js` | フレームワーク非依存 UIController 制御、入力ルーティング調停、装備ペーパードール、二画面コンテナファイラー、GamePad コンポーネント群 |
| **【Layer 1: 純粋単体】Phase 6 (Sound & Audio Drivers)** | `SoundCoordinator.test.js`, `SoundArbiter.test.js`, `SoundEventRouter.test.js`, `SoundModeManager.test.js`, `WaveAudioDriver.test.js`, `PsgBeepDriver.test.js`, `ProceduralSynthDriver.test.js`, `SoundEngine.test.js` | マルチドライバ調停、優先度キュー＆クールダウン制御、PSG Beep (LFO/MML)、Web Audio 6大合成モード駆動 |
| **【Layer 1: 純粋単体】Phase 7 (Knowledge Card, Adventure Log & Post-Mortem)** | `OnDemandLookupService.test.js`, `NhKnowledgeCard.test.js`, `NhDiscoveryCodex.test.js`, `NhCodexGrid.test.js`, `AdventureLogManager.test.js`, `PostMortemKnowledgeResolver.test.js` | 3層ナレッジカード表示、冒険手帳アンロック＆収集率管理、Stage 1〜3 ハイブリッド死因名寄せ・根本原因調停 (RCA) |
| **【Layer 1: 純粋単体】Phase 8 (Wasm Direct Memory Binding)** | `WasmDirectBindingService.test.js`, `NetHackMemory.test.js`, `NetHackWasmWorkerBridge.shim.test.js`, `GKLPlugin.directBinding.test.js`, `InventoryStateManager.directBinding.test.js`, `SpellStateManager.directBinding.test.js`, `EncumbranceStateManager.directBinding.test.js`, `AreaStateManager.terrainDump.test.js`, `FirstTurnFullSync.test.js` | Cメモリ直結ダンプ (`0x10`〜`0x62`) のバイナリデコード、所持品・装備・耐性・お祈り・フロア地形の不可分同期、Sync Barrier 排他制御、Peek Wisdom 床アイテムスペックバインド |
| **【Layer 1: 静的監査】SSOT 完全性** | `KnowledgeIntegrityAudit.test.js`, `AllGlyphsVerification.test.js`, `ObjectKnowledgeIntegrity.test.js` | 全 384 モンスター / 481 アイテム / 24 助言 / 26 シグナルのスキーマ正規化・防護整合性・Glyph マッピング全数監査 |
| **【Layer 1: コア拡張・サービス】** | `DebugInspector.test.js`, `ScenarioRecorder.test.js`, `TranslationEngine.test.js`, `WishService.test.js`, `OnDemandLookService.test.js`, `RequestController.test.js`, `GKLPlugin.test.js`, `GKLPlugin.modularization.test.js`, `WebUICore.test.js` | リクエスト・キュー制御と実機同期、インスペクター配信、REC レコーダー制御、翻訳エンジン、願い解決、遅延照会、GKL 統合ライフサイクル |
| **【Layer 2: 上り第1/第2防壁】プロトコル** | `sequenceProtocol.test.js`, `actionExecutionProtocol.test.js`, `SequenceProtocolValidator.test.js` | 静的リンターによる改行・無効コマンド排除、FakeDriver による動的プレースホルダー（`${invlet}` 等）解決後の完走検査 |
| **【Layer 2: 上り第3防壁】ヘッドレス** | `headlessDriverSimulation.test.js` | 本物の `NetHackWasmDriver` を用いた非同期 Promise 解決、FIFO キュー順次実行、方向コード自動変換の完走検証 |
| **【Layer 3: 下り統合】シナリオ再生** | `realScenarios.test.js`, `ScenarioDriver.test.js`, `driverRecording.test.js` | 実機キャプチャ JSON（浮遊する目玉、コカトリス、瀕死祈り等）の時系列再生・スナップショット検証 |

---

## 3. テストランク制度（Test Rank S / A / B / C）とトレードオフ整理規約

Phase 8（C構造体 Direct Memory Binding）の進展に伴い、従来の「文字列正規表現パース」や「仮床推測（`3992`）」などの旧仕様・内部実装詳細に依存したテストと、新仕様（確定情報 Ground Truth の優先・2経路の完全分離）の間でトレードオフが発生することがあります。

**「過去の古いテストを無条件にすべて通すために、本番コードに不要なフォールバック混在や互換ハックを残す」という本末転倒を防ぐ**ため、すべてのテストを以下の **4段階ランク（Rank S / A / B / C）** で位置づけ、優先順位に応じた更新・隔離・削除（Prune）を行います。

| ランク | 定義・対象テスト | トレードオフ時の判断基準・運用方針 |
| :---: | :--- | :--- |
| **Rank S**<br>*(絶対死守)* | **SSOT マスター整合性・Direct Binding 真値契約・プロトコル防壁**<br>・`WasmDirectBindingService.test.js`, `DirectBindingVerificationEnvironment.test.js`<br>・`KnowledgeIntegrityAudit.test.js`, `ObjectKnowledgeIntegrity.test.js`, `AllGlyphsVerification.test.js`<br>・`sequenceProtocol.test.js`, `ArchitectureBoundary.test.js` | **最優先（100% PASS 必須）**。<br>C コアの真値（`onum` 境界、`corpsenm`、`known` フラグ、扉状態、UI Decoupling 境界規約）を保証する根幹テスト。ここが失敗した場合は必ずプロダクションコードを修正する。 |
| **Rank A**<br>*(現行主軸)* | **各 Manager / Engine の公開 API 契約 ＆ 実機シナリオ統合テスト**<br>・Direct Binding (`auto` / `strict`) モード下での `AreaStateManager`, `InventoryStateManager`, `StructuredKnowledgeEngine`, `EquipmentRules`, `UIController` 等のテスト<br>・`realScenarios.test.js` | **高優先（仕様進化に合わせて更新）**。<br>新仕様（Direct Binding 決定論的解決・確定描画・ネタバレ防止マスク）を検証する主軸テスト。旧仕様の期待値と衝突する場合は、**新仕様の正しい挙動に合わせてテストの期待値を更新**する。 |
| **Rank B**<br>*(フォールバック隔離)* | **レガシー文字列解析・ヒューリスティック推論専用テスト**<br>・`i` / `\` / `^X` コマンドのテキスト行正規表現パーステスト<br>・Direct Binding 非稼働時（`fallback` モード）の仮床 `3992` 推論・大岩移動推論テスト | **条件付き維持（`fallback` パスへ明示隔離）**。<br>Direct Binding 経路と混線しないよう、テスト内で明示的に `directBindingMode: 'fallback'`（または文字列専用関数 `parseInventoryLine` 等）を指定して隔離する。Rank S / A と競合する場合は Rank S / A を優先する。 |
| **Rank C**<br>*(廃止・統合対象)* | **旧アーキテクチャの内部実装詳細・撤廃済み仕様に依存した冗長テスト**<br>・Direct Binding 稼働中に文字列正規表現フォールバックが動くことを前提としたテスト<br>・モジュール分割前の内部プライベートメソッドや重複モックを叩くだけのテスト | **積極整理（削除または Rank A/B へ統合）**。<br>Rank C のテストを通すために本番コードへ余計なフォールバックや互換分岐を入れることは**厳禁**とし、発見次第速やかに削除（Prune）または統合してテストスイートの純度を維持する。 |

---

## 4. 新しいテストの追加方法 (How to Write New Tests)

新しいモジュールを追加した際、対象コードと同じディレクトリ内に `[ModuleName].test.js` を作成します。

```javascript
import { describe, it, expect } from 'vitest';
import { MyModule } from './MyModule.js';

describe('MyModule', () => {
    it('期待通りの計算結果を返すこと', () => {
        const instance = new MyModule();
        expect(instance.compute(2, 3)).toBe(5);
    });
});
```

新規作成したテストファイルは、[`vitest.config.js`](../../vitest.config.js) の `include` パターンに沿って自動認識されます。

---

## 5. 統合・シナリオテストおよびプロトコル検証構想 (Advanced Testing Architecture)

単体テスト（各モジュール個別の正確性検証）に加え、システム全体の一気通貫な信頼性を担保するための双方向テスト構想書が整備されています。

* 📥 **下り方向 (Downlink): [イベントキャプチャ ＆ 疑似ドライバによる統合・シナリオテスト設計構想書](./Scenario_Testing_and_Event_Capture_Architecture.md)**
  * 実ゲームのイベントストリームをキャプチャし、ScenarioDriver で再生することで GKL の状況解釈・戦術助言を一気通貫で検証するテスト基盤。
* 📤 **上り方向 (Uplink): [上り方向キーシーケンス・プロトコル検証テスト基盤 構想設計書](./Sequence_Protocol_Validation_Architecture.md)**
  * UI や GKL が発行するキーストローク列が NetHack C コアおよびドライバーの入力ステートマシン規約に適合し、実機で不発・誤爆なく完走することを静的・動的に保証するテスト基盤。
* 🗺️ **段階的導入 ＆ 従来テスト見直し: [テスト基盤刷新 ＆ 従来テスト見直し実装ロードマップ（アーカイブ）](./archive/Testing_Modernization_Implementation_Roadmap.md)**
  * 上記2大構想の実現と、従来単体テストの移行・スリム化を段階進行した全5フェーズ実装計画記録（全フェーズ完了済み）。

---

## 6. テスト支援ツール (Testing Tools & Studios)

実機プレイ中のイベントストリームをキャプチャし、リプレイ用シナリオテストを作成するための GUI ツールが整備されています。

* **[Scenario Recorder Studio](../../tools/scenario-recorder.html)**:
  * ブラウザ上で各クライアント（Pure JS, Vue, React, Svelte, Solid 等）を動的にプレイしながら、下りイベントストリームをリアルタイム記録し、統合テスト用シナリオ JSON（`test/fixtures/scenarios/*.json`）をエクスポートできる専用スタジオ。
* **[開発ツールポータル](../../tools/dev_tools.html)**:
  * Scenario Recorder Studio を含む各種開発・テストツールの総合メニュー画面。
