# WebUICore ユニットテストガイド (Testing Guide)

NetHack WebUI プロジェクトにおける **WebUICore (Core SDK) ユニットテスト** の構成、実行方法、およびテスト追加ガイドライン。

本プロジェクトではテストランナーとして **Vitest** を採用しており、Wasm Cコアやブラウザ画面に依存しない純粋な計算・パースロジックをミリ秒単位（全件0.5秒以内）で全自動検証します。

---

## 1. 実行コマンド (Execution Commands)

開発中やコミット前に、用途に合わせて以下のコマンドを使用します。

### ① 全件一括実行 (全自動検証)
```bash
npm test
```
* 9 つのコアモジュールの全テストスイートが一瞬で実行され、ターミナル上に合否結果を出力します。

### ② ビジュアル UI 実行 (ブラウザ GUI)
```bash
npm run test:ui
```
* ブラウザ上に Vitest UI が立ち上がり、テストスイートのビジュアル選択、クリック実行、エラー行の比較表示が可能です。

### ③ 特定のモジュール・テストファイル指定実行
```bash
npx vitest TranslationEngine
```
* 指定したキーワードにマッチするテストファイルのみをピンポイントで実行します。

---

## 2. 対象モジュールとテスト一覧 (Test Suites Overview)

現在構築されている 9 大コアモジュールのテストスイート一覧です。

| ディレクトリ | テストファイル | 主な検証内容 |
| :--- | :--- | :--- |
| `src/core/prompt/` | [`PromptPayloadBuilder.test.js`](/src/core/prompt/PromptPayloadBuilder.test.js) | YN / MENU / DIRECTION プロンプトから GUI モーダル構造化データへのパース |
| `src/core/window/` | [`TextWindowManager.test.js`](/src/core/window/TextWindowManager.test.js) | テキスト行の蓄積、`clearWindow` 消去、タイトルの抽出、`flushBuffer` 消化 |
| `src/core/input/` | [`TouchCalculator.test.js`](/src/core/input/TouchCalculator.test.js) | 960x600 / 12x9 アスペクト比補正計算、タップ位置からの `Numpad8` 等の移動キー変換 |
| `src/core/input/` | [`KeyMapper.test.js`](/src/core/input/KeyMapper.test.js) | KeyboardEvent / Shift/Ctrl/Alt 修飾キー・制御コード (`Ctrl+D` ➔ `\x04`) マッピング |
| `src/core/input/` | [`GamepadManager.test.js`](/src/core/input/GamepadManager.test.js) | Gamepad 初期アサイン、`applyContextOverlay` による YN/MENU コンテキストオーバーレイ |
| `src/core/translation/` | [`TranslationEngine.test.js`](/src/core/translation/TranslationEngine.test.js) | メッセージ完全一致辞書引き、品詞別 `lookupWord`、日本語判定、無効化時の動作 |
| `src/core/lifecycle/` | [`GameOverResolver.test.js`](/src/core/lifecycle/GameOverResolver.test.js) | NetHack `record` ログ行からの ScoreboardEntry パース、勝敗・スコア判定 |
| `src/core/` | [`StatusAccessor.test.js`](/src/core/StatusAccessor.test.js) | Cコアステータスフィールド (HP/Gold/Dlevel等) の更新と統一構造体生成 |
| `src/core/knowledge/` | [`InventoryStateManager.test.js`](/src/core/knowledge/InventoryStateManager.test.js) | インベントリテキスト行 (`"a - a blessed +1 dagger"`) からの所持品データ抽出 |
| `src/core/inspector/` | [`DebugInspector.test.js`](/src/core/inspector/DebugInspector.test.js) | イベントログ蓄積・フィルタリング、BroadcastChannel 通信、レスポンス注入 |

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

新規作成したテストファイルは、[`vitest.config.js`](/vitest.config.js) の `include` パターンに沿って自動認識されます。

---

## 4. 統合・シナリオテストおよびプロトコル検証構想 (Advanced Testing Architecture)

単体テスト（各モジュール個別の正確性検証）に加え、システム全体の一気通貫な信頼性を担保するための双方向テスト構想書が整備されています。

* 📥 **下り方向 (Downlink): [イベントキャプチャ ＆ 疑似ドライバによる統合・シナリオテスト設計構想書](./Scenario_Testing_and_Event_Capture_Architecture.md)**
  * 実ゲームのイベントストリームをキャプチャし、ScenarioDriver で再生することで GKL の状況解釈・戦術助言を一気通貫で検証するテスト基盤。
* 📤 **上り方向 (Uplink): [上り方向キーシーケンス・プロトコル検証テスト基盤 構想設計書](./Sequence_Protocol_Validation_Architecture.md)**
  * UI や GKL が発行するキーストローク列が NetHack C コアおよびドライバーの入力ステートマシン規約に適合し、実機で不発・誤爆なく完走することを静的・動的に保証するテスト基盤。


