# GKL ナレッジ駆動型コンテキストアクション リファクタリング計画書

## 1. 目的と方針 (Goal & Strategy)

本計画は、`InventoryStateManager.js` および `ContextActionEngine.js` に散在しているハードコードされた個別判定ロジック (例: `if (item.isPickAxe)`, `if (cell.category === 'STAIRS')`) を整理し、**`StructuredKnowledgeEngine` が提供する静的ナレッジデータ駆動 (Data-Driven) 方式へ段階的に統一・リファクタリング** するための設計指針および実装タスク仕様書です。

### アーキテクチャ原則: 二層分離ハイブリッドモデル
- **層 1: `StructuredKnowledgeEngine` (静的知識プロバイダ)**
  - オブジェクトの本質的な属性 (`defaultVerb`, `actionCategory`, `bucEffects`) のみを提供。「何であるか」を管理。
- **層 2: `ContextActionEngine` / `InventoryStateManager` (動的文脈アグリゲータ)**
  - プレイヤーの動的状態 (HP, 空腹, 隣接セル, インベントリ) を入力とし、ナレッジを参照して「今何をすべきか」の優先度 (`priority`) を決定・アクション生成。

---

## 2. 現状の課題と改善対象 (Current Issues & Targets)

### 課題 1: `InventoryStateManager.js` の硬直判定
現在、所持品アイテムの推奨アクション (`defaultSequence`, `defaultActionLabelJa`) を決める際、フラグ (`isPickAxe`, `isKey`, `isWand`, `isAxe`) を個別に参照して分岐しています。
- **改善案**: `item.knowledge.defaultVerb` (例: `"wield"`, `"wear"`, `"quaff"`, `"read"`, `"zap"`, `"apply"`) および `item.knowledge.actionLabelJa` を参照して動的に推奨アクションを生成します。

### 課題 2: `ContextActionEngine.js` の地形・モンスターアクションの重複
足元や隣接マスのオブジェクト（階段、扉、泉、モンスター）の判定において、`isShopkeeperMonster` や個別文字判定が重複しています。
- **改善案**: `cell.top.knowledge` や `cell.bottom.knowledge` から得られるナレッジスキーマに基いてアクションを構築します。

---

## 3. 実装マイルストーン (Implementation Milestones)

### Phase 1: ナレッジマスターデータへの推奨動詞 (`defaultVerb`) 定義の拡充
- **対象ファイル**: [`src/core/knowledge/OBJECT_KNOWLEDGE_FULL.js`](file:///c:/Users/e3-sh/Documents/GitHub/NetHack-wasm-webUI/src/core/knowledge/OBJECT_KNOWLEDGE_FULL.js)
- **内容**: 全 481 アイテムの定義に対し、標準的な操作動詞 `defaultVerb` (例: 武器➔`wield`, 防具➔`wear`, 薬➔`quaff`, 巻物➔`read`, 杖➔`zap`, ツルハシ/鍵➔`apply`) を定義。

### Phase 2: `InventoryStateManager.js` のデータ駆動化
- **対象ファイル**: [`src/core/knowledge/InventoryStateManager.js`](file:///c:/Users/e3-sh/Documents/GitHub/NetHack-wasm-webUI/src/core/knowledge/InventoryStateManager.js)
- **内容**: ハードコード分岐を廃止し、`item.knowledge` から `defaultVerb` および `actionLabelJa` を読み込んで `defaultSequence` を動的に自動算出する処理へ移行。

### Phase 3: `ContextActionEngine.js` のナレッジ参照一元化
- **対象ファイル**: [`src/core/knowledge/ContextActionEngine.js`](file:///c:/Users/e3-sh/Documents/GitHub/NetHack-wasm-webUI/src/core/knowledge/ContextActionEngine.js)
- **内容**: 足元・隣接エンティティからのアクション生成時に、ナレッジオブジェクトの `category` や `effectSummary` を参照してプライオリティ判定を一元化。

### Phase 4: 全自動テストによる回帰検証
- **対象テスト**: `npx vitest run` (全 34 テストの 100% PASS 確認)

---

## 4. 次の Conversation 向けプロンプト指示文

次の会話を開始する際、以下のテキストをコピー＆ペーストして Antigravity AI へご指示ください：

```text
前回の検討結果および docs/3_gkl/GKL_Context_Action_Refactoring_Plan.md の計画に基づき、GKL ナレッジ駆動型コンテキストアクションのリファクタリング（Phase 1: OBJECT_KNOWLEDGE_FULL.js への defaultVerb 定義拡充 ＆ Phase 2: InventoryStateManager.js のデータ駆動化）を開始してください。
```
