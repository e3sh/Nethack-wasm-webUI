---
title: Game Knowledge Layer (GKL) 総合解説・利用ガイド仕様書
status: active
last_updated: 2026-08-21
related_code:
  - src/core/knowledge/
  - src/core/knowledge/TacticalAdvisor.js
  - src/core/knowledge/GKLPlugin.js
  - src/core/knowledge/SituationCache.js
  - src/core/knowledge/ContextActionEngine.js
  - src/core/knowledge/InventoryStateManager.js
  - src/core/knowledge/AreaStateManager.js
  - src/core/knowledge/SpellStateManager.js
  - src/core/knowledge/AttributeStateManager.js
  - src/core/knowledge/SkillStateManager.js
  - src/core/knowledge/DiscoveryStateManager.js
  - src/core/knowledge/ItemIdentificationResolver.js
  - src/core/knowledge/ItemSpecPresenter.js
  - src/core/knowledge/OnDemandLookService.js
  - src/core/knowledge/RequestController.js
  - src/core/knowledge/StructuredKnowledgeEngine.js
  - src/core/WebUICore.js
---

# Game Knowledge Layer (GKL) 総合解説・利用ガイド仕様書

本書は、NetHack WASM WebUI Core に組み込まれている **Game Knowledge Layer (GKL / ゲーム知識層)** の全体アーキテクチャ、疎結合化プラグイン仕様、主要モジュール群、データ構造、および利用呼び出し規則（API）を網羅する公式仕様書です。

---

## 1. GKL (Game Knowledge Layer) の概要

GKL は、NetHack の複雑なゲーム状態・コンテキストを Web フロントエンド層でリアルタイムに解析・復元し、**「多次元状況認知」「ドメイン知識解決」「先回り推奨アクション」「自律シーケンス実行」** を提供するインテリジェントモジュール群です。

### 疎結合化プラグイン構造 (Decoupled Plugin Architecture)
`WebUICore` は Wasm Cコアとの低レイヤー通信・入出力・イベント仲介に専念し、GKL は独立した拡張プラグイン (`GKLPlugin`) としてアタッチされる疎結合設計を採用しています。

---

## 2. アーキテクチャ & 全コンポーネント構成

GKL は `src/core/knowledge/` 配下の 11 個の専門モジュールで構成され、`GKLPlugin` および `SituationCache` がそれらを統合します。

```text
  [ Client UI / Zoom Viewport / AI Agent / Debug Inspector ]
                              │
                              ▼  core.use(gklPlugin) / gkl.getSituation()
 ┌──────────────────────────────────────────────────────────┐
 │                     WebUICore.js                         │
 │        (汎用通信・イベントバス / EventHub 基盤)             │
 └────────────────────────────┬─────────────────────────────┘
                              │ core.emit() / Events
                              ▼
 ┌──────────────────────────────────────────────────────────┐
 │                GKLPlugin (統合プラグイン)                 │
 │                                                          │
 │ ┌─────────────────── [ 動的状態管理層 ] ────────────────┐ │
 │ │ AreaStateManager         InventoryStateManager        │ │
 │ │ (3層マップ/地形/NPC)     (所持品/装備/ツール)         │ │
 │ │ SpellStateManager        AttributeStateManager        │ │
 │ │ (習得魔法/詠唱率)        (^X 耐性/固有能力/装備合算)  │ │
 │ │ SkillStateManager        DiscoveryStateManager        │ │
 │ │ (#enhance スキル)        (\ 鑑定/発見台帳)            │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │ ┌─────────────────── [ 静的知識・解決層 ] ──────────────┐ │
 │ │ StructuredKnowledgeEngine (静的ドメイン辞書/481品)    │ │
 │ │ ItemIdentificationResolver (未識別/価格/確定判定)     │ │
 │ │ ItemSpecPresenter (UIスペック成形)                    │ │
 │ │ OnDemandLookService (; lookコマンド調査)              │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │                            ▼                              │
 │ ┌───────────────────────────────────────────────────────┐ │
 │ │            SituationCache (統合状況ファサード)        │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │                            ▼                              │
 │ ┌───────────────────────────────────────────────────────┐ │
 │ │ ContextActionEngine (即時推奨アクション生成)          │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │                            ▼                              │
 │ ┌───────────────────────────────────────────────────────┐ │
 │ │ RequestController (サイレントクエリ・自走実行制御)    │ │
 │ └───────────────────────────────────────────────────────┘ │
 └──────────────────────────────────────────────────────────┘
```

### 主要コンポーネントの責務一覧

| レイヤー | モジュール名 | 役割と責務 |
| :--- | :--- | :--- |
| **統合** | [`GKLPlugin.js`](/src/core/knowledge/GKLPlugin.js) | GKL のエントリーポイント。`WebUICore` へのイベントバインドと全モジュールのライフサイクル管理。 |
| **ファサード** | [`SituationCache.js`](/src/core/knowledge/SituationCache.js) | 分散する全マネージャの状態を集約し、最新の統合状況（`Situation`）を一括提供。 |
| **動的状態** | [`InventoryStateManager.js`](/src/core/knowledge/InventoryStateManager.js) | 所持品（インベントリ）の解析・BUC状態・装備・各アイテムへの `item.knowledge` 物理アタッチ。 |
| **動的状態** | [`AreaStateManager.js`](/src/core/knowledge/AreaStateManager.js) | プレイヤー周辺地形・エンティティを 3 層（Top: 敵/NPC, Middle: アイテム, Bottom: 地形）で解析。 |
| **動的状態** | [`SpellStateManager.js`](/src/core/knowledge/SpellStateManager.js) | `+` コマンド結果の解析・保持。習得中の魔法一覧、レベル、カテゴリ、詠唱失敗率の管理。 |
| **動的状態** | [`AttributeStateManager.js`](/src/core/knowledge/AttributeStateManager.js) | `^X` 耐性・特性の解析 ＋ 装備品（指輪・防具）の付加耐性を自動合算（Extrinsics統合）。 |
| **動的状態** | [`SkillStateManager.js`](/src/core/knowledge/SkillStateManager.js) | `#enhance` メニューの解析。武器・魔法スキルの現在ランクおよび向上可能状態の管理。 |
| **動的状態** | [`DiscoveryStateManager.js`](/src/core/knowledge/DiscoveryStateManager.js) | `\` (Discoveries) メニューの解析。ゲーム内で既に発見・判明済みのアイテム外見・正体の記録。 |
| **知識解決** | [`ItemIdentificationResolver.js`](/src/core/knowledge/ItemIdentificationResolver.js) | 発見台帳とアイテム外見から「完全識別 (Fully) / 未識別 (Unidentified) / 価格識別」を厳密判定。 |
| **知識整形** | [`ItemSpecPresenter.js`](/src/core/knowledge/ItemSpecPresenter.js) | ナレッジと識別状態を組み合わせ、UI 描画用フォーマット（d値、AC、特効、警告文）へ成形。 |
| **調査サービス** | [`OnDemandLookService.js`](/src/core/knowledge/OnDemandLookService.js) | 任意のマスに対して `;` (Look) コマンドをサイレント実行し、視界外・未知タイルの詳細情報を取得。 |
| **静的知識** | [`StructuredKnowledgeEngine.js`](/src/core/knowledge/StructuredKnowledgeEngine.js) | 全 481 アイテムおよび 2,000 体以上のモンスター・地形に関する不変のドメイン知識辞書。 |
| **戦術助言** | [`TacticalAdvisor.js`](/src/core/knowledge/TacticalAdvisor.js) | 危険予知（コカトリス・溶岩・爆発等）・熟練武器適正・金属防具詠唱警告等を多次元評価。詳細: [TacticalAdvisor仕様書](./TacticalAdvisor_Specification_and_Architecture.md) |
| **アクション生成** | [`ContextActionEngine.js`](/src/core/knowledge/ContextActionEngine.js) | 周辺状況・所持品・位置関係からワンタップで即時1ターン実行可能なコマンドアクション（扉開閉・拾う・攻撃・射撃等）を生成。 |
| **制御** | [`RequestController.js`](/src/core/knowledge/RequestController.js) | サイレントクエリ (`querySequenceSilent`) や自動シーケンスの多重実行制御・キュー管理。 |

---

## 3. 呼び出し規則と API (Usage & Integration)

### 3.1 プラグイン初期化とアタッチ
```javascript
import { WebUICore } from './core/WebUICore.js';
import { GKLPlugin } from './core/knowledge/GKLPlugin.js';

const core = new WebUICore();
const gkl = new GKLPlugin({ keyMode: 'vi' });

// WebUICore にプラグインとして注入
core.use(gkl);
```

### 3.2 統合ゲーム状況の取得 (`getSituation`)
UI や AI エージェントは、`gkl.getSituation()` または `core.getSituation()` を呼び出すだけで、全マネージャの統合データを即座に取得できます。

```javascript
const situation = gkl.getSituation();

console.log("プレイヤー:", situation.player);
console.log("推奨アクション:", situation.recommendedActions);
console.log("所持品 (item.knowledge付き):", situation.inventory);
console.log("習得魔法:", situation.spells);
console.log("属性耐性 (内在+装備合算):", situation.attributes.resistances);
console.log("スキル熟練度:", situation.skills);
```

### 3.3 単体ナレッジのオンデマンド取得
```javascript
// Glyph ID または Onum からナレッジを取得 (日本語自動翻訳オプション)
const knowledge = gkl.getKnowledge(glyphId, { translate: true });

// アイテムの鑑定状態・UIスペックを取得
const spec = gkl.itemSpecPresenter.present(item);
console.log(spec.header);      // "長剣 (long sword) +1"
console.log(spec.damageSmall);  // "1d8+1"
```

---

## 4. 統合データ構造 (`Situation` & `ContextAction`)

### ① 統合ゲーム状況構造体 (`Situation`)
```typescript
interface GameSituation {
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    pw: number;
    maxPw: number;
    ac: number;
    level: number;
    hunger: string;
    conditions: string[]; // "Blind", "Confused", "Poisoned" 等
  };
  currentTile: TileInfo;
  adjacentTiles: TileInfo[];
  recommendedActions: ContextAction[];
  inventory: InventoryItem[];
  spells: SpellInfo[];               // SpellStateManager より
  attributes: {                      // AttributeStateManager より
    intrinsics: string[];
    extrinsics: string[];
    resistances: Record<string, boolean>;
    abilities: string[];
  };
  skills: SkillInfo[];               // SkillStateManager より
  discoveries: DiscoveryInfo[];      // DiscoveryStateManager より
}
```

### ② 推奨アクション構造体 (`ContextAction`)
```typescript
interface ContextAction {
  id: string;             // アクションID (例: "cast_force_bolt", "loot_container")
  label: string;          // 表示ラベル (例: "力線ボルトを詠唱", "箱を解錠して漁る")
  key: string;            // 代表実行キー
  keySequence: string[];  // 連続実行トークン (例: ['Z', 'a', 'DIR_E'])
  dangerLevel: "safe" | "warning" | "dangerous" | "lethal";
  priority: number;       // スコアリング優先度 (AdviceScore)
  reason?: string;        // 推薦理由・戦術コメント
}
```

---

## 5. 自動テストと品質保証

GKL の全コンポーネントは Vitest による自動回帰テストで 100% カバーされています：
- **テストスイート**: 26 テストファイル / 170 テストケース
- **全 Glyph ストレストライアル**: 0 〜 9622 の全 9,623 Glyph ID に対する無停止検証済み
- **実行コマンド**: `npm test`
