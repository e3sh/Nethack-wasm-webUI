---
title: Game Knowledge Layer (GKL) 総合解説・利用ガイド仕様書
status: implemented
last_updated: 2026-10-11
related_code:
  - src/core/knowledge/
  - src/core/knowledge/GKLPlugin.js
  - src/core/knowledge/state/SituationCache.js
  - src/core/knowledge/state/AreaStateManager.js
  - src/core/knowledge/state/InventoryStateManager.js
  - src/core/knowledge/state/EncumbranceStateManager.js
  - src/core/knowledge/state/ConditionStateManager.js
  - src/core/knowledge/state/MonsterTracker.js
  - src/core/knowledge/state/SpellStateManager.js
  - src/core/knowledge/state/AttributeStateManager.js
  - src/core/knowledge/state/SkillStateManager.js
  - src/core/knowledge/state/DiscoveryStateManager.js
  - src/core/knowledge/engines/StructuredKnowledgeEngine.js
  - src/core/knowledge/engines/ItemIdentificationResolver.js
  - src/core/knowledge/engines/TacticalAdvisor.js
  - src/core/knowledge/engines/ContextActionEngine.js
  - src/core/knowledge/engines/AssistSignalSynthesizer.js
  - src/core/knowledge/engines/ActionSignalResolver.js
  - src/core/knowledge/services/PostMortemKnowledgeResolver.js
  - src/core/knowledge/services/WasmDirectBindingService.js
  - src/core/knowledge/services/OnDemandLookService.js
  - src/core/knowledge/services/OnDemandLookupService.js
  - src/core/knowledge/presenters/ItemSpecPresenter.js
  - src/core/knowledge/presenters/EncumbrancePresenter.js
  - src/core/knowledge/equipment/
  - src/core/knowledge/lore/LoreCodex.js
  - src/core/knowledge/lore/AdventureLogManager.js
  - src/core/knowledge/context/InteractionContext.js
  - src/core/request/InteractiveRequestController.js
  - src/core/WebUICore.js
---

# Game Knowledge Layer (GKL) 総合解説・利用ガイド仕様書

本書は、NetHack WASM WebUI Core に組み込まれている **Game Knowledge Layer (GKL / ゲーム知識層)** の全体アーキテクチャ、疎結合化プラグイン仕様、主要モジュール群、データ構造、および利用呼び出し規則（API）を網羅する公式仕様書です。

---

## 1. GKL (Game Knowledge Layer) の概要

GKL は、NetHack の複雑なゲーム状態・コンテキストを Web フロントエンド層でリアルタイムに解析・復元し、**「多次元状況認知」「ドメイン知識解決」「先回り推奨アクション」「自律シーケンス実行」** を提供するインテリジェントモジュール群です。

### 疎結合化プラグイン構造 (Decoupled Plugin Architecture)
`WebUICore` は Wasm Cコアとの低レイヤー通信・入出力・イベント仲介に専念し、GKL は独立した拡張プラグイン (`GKLPlugin`) としてアタッチされる疎結合設計を採用しています。また Phase 8 により、Wasm C メモリ直結 (`WasmDirectBindingService` / `shim_bridge.c`) によるゼロオーバーヘッド同期と、従来のテキスト/ウィンドウ解析フォールバックのハイブリッド構成を備えています。

---

## 2. アーキテクチャ & 全コンポーネント構成

GKL は `src/core/knowledge/` 配下の 8 つの専門サブディレクトリ（`state/`, `engines/`, `services/`, `presenters/`, `equipment/`, `lore/`, `context/`, `data/`）に整理されたモジュール群で構成され、`GKLPlugin` および `SituationCache` がそれらを統合します（詳細: [GKLPlugin モジュール分割設計仕様書](./GKLPlugin_Modularization_and_Refactoring_Architecture.ja.md)）。

```text
  [ Client UI / Zoom Viewport / AI Agent / Debug Inspector ]
                              │
                              ▼  core.use(gklPlugin) / gkl.getSituation()
 ┌──────────────────────────────────────────────────────────┐
 │                     WebUICore.js                         │
 │        (汎用通信・イベントバス / EventHub 基盤)             │
 └────────────────────────────┬─────────────────────────────┘
                              │ core.emit() / CALL_SHIM (Phase 8)
                              ▼
 ┌──────────────────────────────────────────────────────────┐
 │                GKLPlugin (統合プラグイン)                 │
 │                                                          │
 │ ┌──────────── [ C メモリ直結 & 調査サービス層 ] ─────────┐ │
 │ │ WasmDirectBindingService (Phase 8 shim_bridge.c 直結)  │ │
 │ │ OnDemandLookService (; look) / OnDemandLookupService   │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │ ┌─────────────────── [ 動的状態管理層 (state/) ] ────────┐ │
 │ │ AreaStateManager         InventoryStateManager        │ │
 │ │ EncumbranceStateManager  ConditionStateManager        │ │
 │ │ MonsterTracker           SpellStateManager            │ │
 │ │ AttributeStateManager    SkillStateManager            │ │
 │ │ DiscoveryStateManager    ContainerContentsManager     │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │ ┌──────────── [ 静的知識・解決・装備・伝承層 ] ──────────┐ │
 │ │ StructuredKnowledgeEngine (481アイテム / 384モンスター)│ │
 │ │ ItemIdentificationResolver / ItemSpecPresenter        │ │
 │ │ EquipmentDependencyAnalyzer / EquipmentActionPlanner  │ │
 │ │ LoreCodex / AdventureLogManager / PostMortemResolver  │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │                            ▼                              │
 │ ┌───────────────────────────────────────────────────────┐ │
 │ │         SituationCache (統合状況ファサード)           │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │                            ▼                              │
 │ ┌───────────────────────────────────────────────────────┐ │
 │ │ TacticalAdvisor / AssistSignalSynthesizer             │ │
 │ │ ContextActionEngine / ActionSignalResolver            │ │
 │ └──────────────────────────┬────────────────────────────┘ │
 │                            │                              │
 │                            ▼                              │
 │ ┌───────────────────────────────────────────────────────┐ │
 │ │ InteractiveRequestController (IRC 自律シーケンス制御) │ │
 │ └───────────────────────────────────────────────────────┘ │
 └──────────────────────────────────────────────────────────┘
```

### 主要コンポーネントの責務一覧

| レイヤー | モジュール名 | 役割と責務 |
| :--- | :--- | :--- |
| **統合** | [`GKLPlugin.js`](/src/core/knowledge/GKLPlugin.js) | GKL のエントリーポイント。`WebUICore` へのイベントバインドとサブコーディネーター群のライフサイクル管理。 |
| **ファサード** | [`state/SituationCache.js`](/src/core/knowledge/state/SituationCache.js) | 分散する全マネージャの状態を集約し、最新の統合状況（`Situation`）を一括提供。 |
| **メモリ直結** | [`services/WasmDirectBindingService.js`](/src/core/knowledge/services/WasmDirectBindingService.js) | Phase 8 `shim_bridge.c` (`CALL_SHIM` 0x01〜0x62) と連携し、インベントリ・足元・コンテナ・セル・属性耐性・スキル・魔法・地形ダンプをゼロオーバーヘッドで取得。 |
| **動的状態** | [`state/InventoryStateManager.js`](/src/core/knowledge/state/InventoryStateManager.js) | 所持品（インベントリ）の解析・BUC状態・装備・各アイテムへの `item.knowledge` 物理アタッチ（Direct Binding 優先＋メニューフォールバック）。 |
| **動的状態** | [`state/EncumbranceStateManager.js`](/src/core/knowledge/state/EncumbranceStateManager.js) | 所持重量・袋の中身重量（保持の袋軽減補正含む）・運搬許容量および負荷段階の管理（`inv_weight()` メモリ直結対応）。 |
| **動的状態** | [`state/AreaStateManager.js`](/src/core/knowledge/state/AreaStateManager.js) | プレイヤー周辺地形・エンティティ・エフェクトを 4 層（Bottom/Middle/Top/Effect）で管理。80×21 一括地形ダンプ (`dumpLevelTerrain`) や階段・ランドマーク台帳を保持。 |
| **動的状態** | [`state/MonsterTracker.js`](/src/core/knowledge/state/MonsterTracker.js) | 視界内モンスターの個体追跡、敵対/平和/ペット状態 (`mpeaceful`/`mtame`)、睡眠/麻痺状態の管理。 |
| **動的状態** | [`state/ConditionStateManager.js`](/src/core/knowledge/state/ConditionStateManager.js) | 状態異常（盲目・混乱・幻覚・毒・石化進行等）の発生要因と残りターン推定の管理。 |
| **動的状態** | [`state/SpellStateManager.js`](/src/core/knowledge/state/SpellStateManager.js) | 習得中の魔法一覧、レベル、カテゴリ、詠唱失敗率、忘却度 (`sp_know`) の管理。 |
| **動的状態** | [`state/AttributeStateManager.js`](/src/core/knowledge/state/AttributeStateManager.js) | `u.uprops` メモリ直結（および `^X` 解析）による内在耐性・装備品付加耐性（Extrinsics）の統合管理。 |
| **動的状態** | [`state/SkillStateManager.js`](/src/core/knowledge/state/SkillStateManager.js) | `P_SKILL` メモリ直結（および `#enhance` 解析）による武器・魔法スキルの現在ランク・熟練度 (`P_EXP`) 管理。 |
| **動的状態** | [`state/DiscoveryStateManager.js`](/src/core/knowledge/state/DiscoveryStateManager.js) | `objects[]` メモリ直結（および `\` 発見台帳解析）による既発見・価格識別状態の管理。 |
| **知識解決** | [`engines/ItemIdentificationResolver.js`](/src/core/knowledge/engines/ItemIdentificationResolver.js) | 発見台帳とアイテム外見から 5 段階の識別レベル（`Lv.0 UNIDENTIFIED` 〜 `Lv.4 FULLY_IDENTIFIED`）を厳密判定。 |
| **知識整形** | [`presenters/ItemSpecPresenter.js`](/src/core/knowledge/presenters/ItemSpecPresenter.js) | ナレッジと識別状態を組み合わせ、UI 描画用フォーマット（適応的プログレッシブ開示スペック）へ成形。 |
| **調査サービス** | [`services/OnDemandLookService.js`](/src/core/knowledge/services/OnDemandLookService.js) / [`OnDemandLookupService.js`](/src/core/knowledge/services/OnDemandLookupService.js) | 任意マスの調査（`CALL_SHIM` 0x20〜0x23 直結 ＋ `;` Look フォールバック）および `/` (Whatis) 動的図鑑検索サービス。 |
| **静的知識** | [`engines/StructuredKnowledgeEngine.js`](/src/core/knowledge/engines/StructuredKnowledgeEngine.js) | 全 481 アイテムおよび全 384 体のモンスター・地形に関する不変のドメイン知識辞書。 |
| **装備計画** | [`equipment/EquipmentDependencyAnalyzer.js`](/src/core/knowledge/equipment/EquipmentDependencyAnalyzer.js) / [`EquipmentActionPlanner.js`](/src/core/knowledge/equipment/EquipmentActionPlanner.js) | 3層防具や手袋・指輪の着脱依存関係診断と、自動換装レシピ (`ActionRecipe`) の生成。 |
| **伝承・図鑑** | [`lore/LoreCodex.js`](/src/core/knowledge/lore/LoreCodex.js) / [`lore/AdventureLogManager.js`](/src/core/knowledge/lore/AdventureLogManager.js) | 世界観伝承（Lore）と構造化データの相互参照、および永続化冒険手帳（発見図鑑・マイルストーン）の管理。 |
| **戦術・信号** | [`engines/TacticalAdvisor.js`](/src/core/knowledge/engines/TacticalAdvisor.js) / [`AssistSignalSynthesizer.js`](/src/core/knowledge/engines/AssistSignalSynthesizer.js) | 7系統の戦術助言生成、危険予知（コカトリス・溶岩等）、および AssistSignal / Stance 統合。 |
| **アクション生成** | [`engines/ContextActionEngine.js`](/src/core/knowledge/engines/ContextActionEngine.js) / [`ActionSignalResolver.js`](/src/core/knowledge/engines/ActionSignalResolver.js) | 周辺状況・所持品・位置関係からワンタップで実行可能なスマートアクションの生成とアクション結果シグナル解決。 |
| **死因分析** | [`services/PostMortemKnowledgeResolver.js`](/src/core/knowledge/services/PostMortemKnowledgeResolver.js) | ゲームオーバー時の死因名寄せ（Stage 1〜3 ハイブリッド解決）と根本原因分析（RCA）・教訓カードの生成。 |
| **対話制御** | [`src/core/request/InteractiveRequestController.js`](/src/core/request/InteractiveRequestController.js) | サイレントクエリ (`querySequenceSilent`) やマルチステップ自動シーケンス（換装・コンテナ操作等）の安全実行・中断ロールバック制御。 |

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

### 3.3 単体ナレッジおよびマップタイルのオンデマンド取得
#### ① マップマスの高レベルオンデマンド調査 (`inspectCellOnDemand`)
UI 側で複雑なレイヤー判定や Look コマンド (`;`) 発火条件を書く必要なく、マス座標 `(x, y)` を指定するだけで、プレイヤー・モンスター・アイテム・死体・地形の統一カードデータ（`cardData`）を取得できます。

```javascript
// マップ座標 (x: 12, y: 8) を調査
const cardData = await gkl.inspectCellOnDemand({ x: 12, y: 8 }, { isHover: false });
if (cardData) {
  console.log(cardData.name);              // "ジャッカル (jackal)"
  console.log(cardData.category);          // "MONSTER"
  console.log(cardData.dispositionStatus); // "HOSTILE" | "PEACEFUL" | "TAMED"
  console.log(cardData.tacticalAdvice);    // ["一対一で対峙してください。"]
}
```

#### ② フォーカスカメラ・ズームビュー用タイルの取得 (`getFocusCameraTiles`)
プレイヤー中心の指定半径（例: 21x9）のタイル配列を取得します。GKL が**未探索判定・アイテム/敵下の仮床補完（3992）・プレイヤー死亡時の墓石配置（4011）・4層レイヤー解決**をすべて自動で行い、描画順配列 `renderGlyphs: number[]` を提供します。

```javascript
const tiles = gkl.getFocusCameraTiles(10, 4); // 21x9 タイル
for (const tile of tiles) {
  // UI 側は渡された renderGlyphs を順に Canvas に描画するだけで完了
  for (const glyphId of tile.renderGlyphs) {
    drawTile(ctx, glyphId, screenX, screenY);
  }
}
```

#### ③ Glyph ID / アイテムスペックの直接取得
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

GKL の全コンポーネントは Vitest による自動回帰テストでカバーされています：
- **プロジェクト全体テストスイート**: 全 136 テストスイート / 1,670 テストケース（100% PASS）
- **全 Glyph ストレストライアル**: 0 〜 9622 の全 9,623 Glyph ID に対する無停止検証済み
- **実行コマンド**: `npm test`
