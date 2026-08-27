---
title: GKL 構造化ナレッジ単一真実源 (SSOT) ＆ 戦術・アシスト統合アーキテクチャ仕様書
status: planned
last_updated: 2026-08-27
related_code:
  - src/core/knowledge/StructuredKnowledgeEngine.js
  - src/core/knowledge/TacticalAdvisor.js
  - src/core/knowledge/AssistSignalSynthesizer.js
  - src/core/knowledge/ContextActionEngine.js
  - src/core/knowledge/ItemInteractionRules.js
---

# GKL 構造化ナレッジ単一真実源 (SSOT) ＆ 戦術・アシスト統合アーキテクチャ仕様書

**〜知識の分散とハードコードを根絶し、図鑑マスターデータから戦術・シグナル・アクションを自動生成するデータ駆動型ナレッジ基盤〜**

---

## 1. 背景と課題意識 (Background & Problem Statement)

### 1.1 知識の多重定義・ハードコードの課題
現在、NetHack の特有ルール（浮遊する目玉への目隠し対策、銀弱点モンスターへの銀武器持替、反射敵への直線ビーム自爆警告、コカトリスの死体接触危険、錆び・腐食など）に関する知識が、以下の **4つのモジュールに分散して個別ハードコード** されています：

```
【浮遊する目玉（floating eye）の例】

1. MONSTER_KNOWLEDGE_MAP (構造化ナレッジ図鑑)
   └─ 静的解説文: "麻痺の凝視攻撃を行う。目隠しやタオルを着用して盲目状態で接近するか、遠隔攻撃が必須。"

2. TacticalAdvisor.js (戦術アドバイザー)
   └─ ロジック: perceivedMonsters から "floating eye" を検索し、目隠し所持を調べて CRITICAL 警告を発行。

3. AssistSignalSynthesizer.js (アシストシグナル)
   └─ ロジック: 改めて "floating eye" を検索し、目隠し着用 (EQUIP) や遠隔 (RANGED) の Stance / ワンタップボタンを生成。

4. ItemInteractionRules.js / ContextActionEngine
   └─ ロジック: 目隠し・タオル使用 (a / W) の物理アクションを個別判定。
```

### 1.2 発生する問題
- **多大なメンテナンスコスト**: 新しいモンスター（メデューサ、マインドフレア、サキュバス等）やアイテム対策を追加・修正するたびに、4〜5箇所のコードを個別に修正・追試する必要がある。
- **仕様の乖離リスク**: 「図鑑には目隠しが効くと書いてあるのに、戦術アドバイスが出ない」「アシストシグナルだけ別メッセージが出る」といった仕様の不整合が原理的に発生しやすい。

---

## 2. 統合アーキテクチャ：SSOT (Single Source of Truth) モデル

### 2.1 コア設計方針
**「構造化ナレッジ（図鑑データ）を単一真実源（SSOT）とし、戦術アドバイザー・アシストシグナル・推奨アクションはすべてそのメタデータを消費する」** アーキテクチャへ一本化します。

```
                  ┌────────────────────────────────────────────────────────┐
                  │ 📚 構造化ナレッジ (SSOT: 単一真実源)                   │
                  │   - MONSTER_KNOWLEDGE_MAP                              │
                  │   - OBJECT_KNOWLEDGE_MAP                               │
                  │   - TERRAIN_KNOWLEDGE_MAP                              │
                  │                                                        │
                  │  【脅威・特性メタデータ】                              │
                  │    threat: { type: 'GAZE_PARALYSIS', priority: 76 }    │
                  │    counters: [ { type: 'EQUIP', match: 'BLINDFOLD' } ] │
                  │    vulnerabilities: ['SILVER']                         │
                  │    properties: { reflectsBeam: true, rusts: true }     │
                  └───────────────────────────┬────────────────────────────┘
                                              │ 参照・消費 (Data-Driven)
           ┌──────────────────────────────────┼──────────────────────────────────┐
           ▼                                  ▼                                  ▼
┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
│ 🛡️ 戦術アドバイザー   │          │ 🚨 アシストシグナル   │          │ 🧠 コンテキスト      │
│  (TacticalAdvisor)   │          │ (AssistSignal)       │          │    アクション        │
│                      │          │                      │          │  (ContextAction)     │
│ ナレッジの threat と │          │ ナレッジの counters  │          │ ナレッジの推奨       │
│ vulnerabilities から │          │ から Stance・最優先  │          │ 操作から物理         │
│ 危険度スコアを算出   │          │ 1行バーを調停        │          │ アクションを生成     │
└──────────────────────┘          └──────────────────────┘          └──────────────────────┘
```

---

## 3. 構造化ナレッジのメタデータスキーマ (Schema Definition)

### 3.1 モンスター知識メタデータ (`MonsterKnowledge`)
```typescript
export interface MonsterThreatCounter {
  id: string;                      // 例: 'COUNTER_BLINDFOLD', 'COUNTER_SILVER_WEAPON'
  type: 'EQUIP_ITEM' | 'USE_ITEM' | 'RANGED_ATTACK' | 'CAST_SPELL' | 'WAIT' | 'FLEE';
  stance: ActionStance;            // 'EQUIP' | 'CURE' | 'RANGED' | 'WAIT_SAFE' | 'PRAY' | 'CAUTION'
  priority: number;                // 76
  matchItem?: (item: any) => boolean; // アイテム合致判定（目隠し、銀武器、解呪等）
  matchSpell?: (spell: any) => boolean;
  actionKeySequence?: (item: any) => string[]; // ['W', item.invlet]
  messageJa: string;               // "浮遊する目玉: 目隠し着用で安全接近"
  messageEn: string;               // "Floating Eye: Wear blindfold to approach safely"
  whyJa: string;                   // "盲目状態になることで麻痺凝視を防げます。"
  whyEn: string;                   // "Wearing a blindfold prevents paralysis gaze."
  wikiTopic?: string;              // "Floating_eye"
}

export interface MonsterThreatDefinition {
  type: 'GAZE_PARALYSIS' | 'PETRIFICATION' | 'BRAIN_EAT' | 'LEVEL_DRAIN' | 'POISON' | 'REFLECT';
  severity: 'CRITICAL' | 'WARNING' | 'CAUTION';
  basePriority: number;            // 70〜90
  descriptionJa: string;
  descriptionEn: string;
  counters: MonsterThreatCounter[];
}

export interface MonsterKnowledgeEntry {
  id: string;                      // 'floating_eye'
  name: string;                    // 'floating eye'
  nameJa: string;                  // '浮遊する目玉'
  monOffset: number;               // 57
  vulnerabilities?: Array<'SILVER' | 'FIRE' | 'COLD' | 'POISON' | 'UNDEAD'>;
  properties?: {
    reflectsBeam?: boolean;        // 銀竜等
    gazeAttack?: boolean;          // 目玉、メデューサ
    passiveAttack?: 'PARALYSIS' | 'FREEZE' | 'CORROSIVE' | 'NONE';
  };
  threat?: MonsterThreatDefinition;
}
```

---

## 4. 各エンジンのデータ駆動化 (Data-Driven Refactoring)

### 4.1 `TacticalAdvisor.js` のリファクタリング
- **変更前**: 個別のモンスター名文字列（`m.name.includes('floating eye')`）を何重にも `if-else` で判定。
- **変更後**:
  ```javascript
  // 汎用脅威スキャナー
  for (const monster of areaState.perceivedMonsters) {
    const knowledge = monster.knowledge;
    if (knowledge?.threat) {
      advices.push({
        id: `ADVICE_MONSTER_${monster.id}`,
        category: knowledge.threat.severity,
        score: knowledge.threat.basePriority,
        textJa: `【${knowledge.threat.severity}】${monster.nameJa}: ${knowledge.threat.descriptionJa}`,
        ...
      });
    }
  }
  ```

### 4.2 `AssistSignalSynthesizer.js` のリファクタリング
- **変更前**: `evaluateCombatThreatStance` 内で個別に目隠し・銀武器・反射を検索。
- **変更後**:
  ```javascript
  for (const monster of areaState.perceivedMonsters) {
    const knowledge = monster.knowledge;
    if (!knowledge?.threat?.counters) continue;

    for (const counter of knowledge.threat.counters) {
      if (counter.type === 'EQUIP_ITEM') {
        const item = inventoryItems.find(counter.matchItem);
        if (item && !item.isWorn) {
          candidateSignals.push({
            id: `SIGNAL_${counter.id}`,
            priority: counter.priority,
            category: 'TACTICAL_COMBAT',
            stance: counter.stance,
            icon: '🙈',
            shortMessageJa: counter.messageJa,
            shortMessageEn: counter.messageEn,
            detailWhyJa: counter.whyJa,
            detailWhyEn: counter.whyEn,
            actionKeySequence: counter.actionKeySequence ? counter.actionKeySequence(item) : ['W', item.invlet],
            actionLabelJa: `${item.nameJa || item.name}を装備`,
            wikiTopic: counter.wikiTopic
          });
        }
      }
    }
  }
  ```

---

## 5. 移行ロードマップ (Migration Roadmap)

```
Phase 1: 構造化ナレッジ スキーマ拡張 ＆ マスターデータ定義 (SSOT 構築)
 ├─ MONSTER_KNOWLEDGE_MAP に threat / counters / vulnerabilities を追加
 └─ 主要モンスター（浮遊する目玉、銀竜、人狼、コカトリス、マインドフレア、サキュバス等）の定義

Phase 2: TacticalAdvisor のデータ駆動化リファクタリング
 ├─ ハードコード判定をナレッジ走査型に置き換え
 └─ 既存の単体テスト（全23テスト）の完全互換・パス確認

Phase 3: AssistSignalSynthesizer のデータ駆動化リファクタリング
 ├─ evaluateCombatThreatStance の完全データ駆動化
 └─ 既存の単体テスト（全18テスト）の完全互換・パス確認

Phase 4: アイテム・環境ケミストリーの SSOT 統合
 ├─ 指輪＋流し台、死体＋祭壇、ユニコーンの角等のルールを OBJECT_KNOWLEDGE_MAP / TERRAIN_KNOWLEDGE_MAP へ集約
```

---

## 6. 期待される効果
- **圧倒的な拡張性**: 新しいモンスター・アイテム対策の追加が「データ定義の追加」だけで 100% 完結。
- **コード削減**: `TacticalAdvisor` および `AssistSignalSynthesizer` のコード量を 30〜40% 削減。
- **アーキテクチャの統一**: 図鑑、戦術、アシスト、アクションが 1 つのナレッジマスターから美しく連動。
