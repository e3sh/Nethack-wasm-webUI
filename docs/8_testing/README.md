# WebUICore ユニットテストガイド (Testing Guide)

NetHack WebUI プロジェクトにおける **WebUICore (Core SDK) ユニットテスト・統合テスト基盤** の構成、実行方法、およびテスト追加ガイドライン。

本プロジェクトではテストランナーとして **Vitest** を採用しており、Wasm Cコアやブラウザ画面に依存しない純粋な計算・パースロジック、ナレッジ整合性監査、およびキー入力プロトコル検証（**全47テストスイート・507テスト / 100% PASS**）をミリ秒単位（全件約3秒以内）で全自動検証します。

---

## 1. 実行コマンド (Execution Commands)

開発中やコミット前に、用途に合わせて以下のコマンドを使用します。

### ① 全件一括実行 (全自動検証)
```bash
npm test
```
* 全 47 テストスイート（507 件のテスト）が一括実行され、ターミナル上に合否結果を出力します。

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

現在構築されている主要テストスイート一覧です（**全 47 ファイル・507 テスト**）。

| レイヤー / 分類 | 主なテストファイル | 主な検証内容 |
| :--- | :--- | :--- |
| **【Layer 1: 純粋単体】入力・基盤・境界** | `PromptPayloadBuilder.test.js`, `TouchCalculator.test.js`, `KeyMapper.test.js`, `GamepadManager.test.js`, `TextWindowManager.test.js`, `StatusAccessor.test.js`, `ArchitectureBoundary.test.js`, `GameOverResolver.test.js` | プロンプト解析、画面アスペクト補正計算、キーマッピング、ウィンドウバッファ管理、UI Decoupling 境界規約 |
| **【Layer 1: 純粋単体】GKL ナレッジ・状態追跡** | `TacticalAdvisor.test.js`, `AssistSignalSynthesizer.test.js`, `AreaStateManager.test.js`, `InventoryStateManager.test.js`, `MonsterTracker.test.js`, `ChemistryKnowledge.test.js`, `ItemInteractionRules.test.js`, `SpellStateManager.test.js`, `SkillStateManager.test.js`, `AttributeStateManager.test.js`, `DiscoveryStateManager.test.js` | モンスター追跡、エリア・所持品・耐性状態の追跡、戦術助言、アシストシグナル、ケミストリー・道具相互作用判定 |
| **【Layer 1: 静的監査】SSOT 完全性** | `KnowledgeIntegrityAudit.test.js`, `AllGlyphsVerification.test.js`, `ObjectKnowledgeIntegrity.test.js` | 全 384 モンスター / 481 アイテム / 24 助言 / 26 シグナルのスキーマ正規化・防護整合性・Glyph マッピング全数監査 |
| **【Layer 1: コア拡張・サービス】** | `DebugInspector.test.js`, `ScenarioRecorder.test.js`, `TranslationEngine.test.js`, `WishService.test.js`, `OnDemandLookService.test.js`, `GKLPlugin.test.js`, `WebUICore.test.js` | インスペクター配信、REC レコーダー制御、翻訳エンジン、願い解決、遅延照会、GKL 統合ライフサイクル |
| **【Layer 2: 上り第1/第2防壁】プロトコル** | `sequenceProtocol.test.js`, `actionExecutionProtocol.test.js`, `SequenceProtocolValidator.test.js` | 静的リンターによる改行・無効コマンド排除、FakeDriver による動的プレースホルダー（`${invlet}` 等）解決後の完走検査 |
| **【Layer 2: 上り第3防壁】ヘッドレス** | `headlessDriverSimulation.test.js` | 本物の `NetHackWasmDriver` を用いた非同期 Promise 解決、FIFO キュー順次実行、方向コード自動変換の完走検証 |
| **【Layer 3: 下り統合】シナリオ再生** | `realScenarios.test.js`, `ScenarioDriver.test.js`, `driverRecording.test.js` | 実機キャプチャ JSON（浮遊する目玉、コカトリス、瀕死祈り等）の時系列再生・スナップショット検証 |

---

## 3. 新しいテストの追加方法 (How to Write New Tests)

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

## 4. 統合・シナリオテストおよびプロトコル検証構想 (Advanced Testing Architecture)

単体テスト（各モジュール個別の正確性検証）に加え、システム全体の一気通貫な信頼性を担保するための双方向テスト構想書が整備されています。

* 📥 **下り方向 (Downlink): [イベントキャプチャ ＆ 疑似ドライバによる統合・シナリオテスト設計構想書](./Scenario_Testing_and_Event_Capture_Architecture.md)**
  * 実ゲームのイベントストリームをキャプチャし、ScenarioDriver で再生することで GKL の状況解釈・戦術助言を一気通貫で検証するテスト基盤。
* 📤 **上り方向 (Uplink): [上り方向キーシーケンス・プロトコル検証テスト基盤 構想設計書](./Sequence_Protocol_Validation_Architecture.md)**
  * UI や GKL が発行するキーストローク列が NetHack C コアおよびドライバーの入力ステートマシン規約に適合し、実機で不発・誤爆なく完走することを静的・動的に保証するテスト基盤。
* 🗺️ **段階的導入 ＆ 従来テスト見直し: [テスト基盤刷新 ＆ 従来テスト見直し実装ロードマップ](./Testing_Modernization_Implementation_Roadmap.md)**
  * 上記2大構想の実現と、従来単体テストの移行・スリム化を安全に段階進行するための全5フェーズ実装計画。

---

## 5. テスト支援ツール (Testing Tools & Studios)

実機プレイ中のイベントストリームをキャプチャし、リプレイ用シナリオテストを作成するための GUI ツールが整備されています。

* **[Scenario Recorder Studio](../../tools/scenario-recorder.html)**:
  * ブラウザ上で各クライアント（Pure JS, Vue, React, Svelte, Solid 等）を動的にプレイしながら、下りイベントストリームをリアルタイム記録し、統合テスト用シナリオ JSON（`test/fixtures/scenarios/*.json`）をエクスポートできる専用スタジオ。
* **[開発ツールポータル](../../tools/dev_tools.html)**:
  * Scenario Recorder Studio を含む各種開発・テストツールの総合メニュー画面。



