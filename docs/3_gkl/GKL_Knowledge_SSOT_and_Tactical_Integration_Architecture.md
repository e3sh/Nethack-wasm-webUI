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
1. **構造化ナレッジの一元化**: 図鑑マスターデータを単一真実源（SSOT）とし、戦術・アシスト・アクションはすべてそのメタデータを消費する。
2. **翻訳の一元化（TranslationEngine / dictionary.csv 統合）**:
   - **ナレッジの元データには訳語（`nameJa`, `messageJa`, `whyJa` 等）を直接保持しない**（英語の原語テキスト・キーのみで定義）。
   - ナレッジの読み込み・生成・提供時に **`TranslationEngine`（`dictionary.csv`）を通して動的に訳語を解決・アタッチ**する。
   - ナレッジ追加・作成時に新規のメッセージや単語が発生した場合は、その時点で **`dictionary.csv` に辞書登録**する。
   - これにより、「ナレッジから引いた用語」と「ゲーム画面・翻訳エンジンで表示される用語」の表記揺れや乖離を原理的に防止する。

```
                  ┌────────────────────────────────────────────────────────┐
                  │ 📚 構造化ナレッジ (SSOT: 原語・効果マスター)           │
                  │   - MONSTER_KNOWLEDGE_MAP (英語定義のみ)               │
                  │   - OBJECT_KNOWLEDGE_MAP (英語定義のみ)                │
                  │                                                        │
                  │  【脅威・効果メタデータ】                              │
                  │    threat: { type: 'GAZE_PARALYSIS', priority: 76 }    │
                  │    counters: [ { type: 'EQUIP', match: 'BLINDFOLD' } ] │
                  │    effects: { healHp: true, cureSickness: true }       │
                  └───────────────────────────┬────────────────────────────┘
                                              │
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │ 🌐 翻訳エンジン (TranslationEngine / dictionary.csv)   │
                  │    - すべての単語・メッセージ・解説文の翻訳を一元管理  │
                  │    - ナレッジ生成・消費時に動的にローカライズ          │
                  └───────────────────────────┬────────────────────────────┘
                                              │ 動的解決 (Data-Driven + tr())
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
  message: string;                 // "Floating Eye: Wear blindfold to approach safely" (辞書キー)
  why: string;                     // "Wearing a blindfold prevents paralysis gaze." (辞書キー)
  wikiTopic?: string;              // "Floating_eye"
}

export interface MonsterThreatDefinition {
  type: 'GAZE_PARALYSIS' | 'PETRIFICATION' | 'BRAIN_EAT' | 'LEVEL_DRAIN' | 'POISON' | 'REFLECT';
  severity: 'CRITICAL' | 'WARNING' | 'CAUTION';
  basePriority: number;            // 70〜90
  description: string;             // 英語解説文 (辞書キー)
  counters: MonsterThreatCounter[];
}

export interface MonsterKnowledgeEntry {
  id: string;                      // 'floating_eye'
  name: string;                    // 'floating eye'
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

### 3.2 アイテム知識メタデータ (`ObjectKnowledgeEntry`)
```typescript
export interface ItemEffectDefinition {
  healHp?: boolean;               // HP回復効果 (potion of healing等)
  healPower?: 'LOW' | 'MED' | 'HIGH' | 'FULL'; // 回復量グレード
  cureSickness?: boolean;         // 病気治療 (extra healing, unicorn horn等)
  cureBlindness?: boolean;        // 盲目治療
  curePetrification?: boolean;    // 石化治療 (lizard corpse等)
  removeCurse?: boolean;          // 解呪効果 (scroll of remove curse等)
  digs?: boolean;                 // 採掘効果 (pick-axe, wand of digging)
  unlocks?: boolean;              // 解錠効果 (key, lock pick, credit card)
}

export interface ObjectKnowledgeEntry {
  id: string;                      // 'potion_of_healing'
  onum: number;                    // 297
  name: string;                    // 'potion of healing'
  category: 'WEAPON' | 'ARMOR' | 'POTION' | 'SCROLL' | 'SPELLBOOK' | 'WAND' | 'RING' | 'AMULET' | 'TOOL' | 'FOOD' | 'GEM' | 'ROCK';
  material?: 'silver' | 'iron' | 'wood' | 'leather' | 'cloth' | 'glass' | 'none';
  actionVerb: string;              // 'q', 'r', 'z', 'a', 'w', 'W', 'e'
  protectsAgainst?: Array<'GAZE' | 'TOUCH_STONING' | 'BRAIN_EAT' | 'LAVA' | 'WATER' | 'FALLING_ROCKS' | 'PIT'>; // 脅威・ハザード防護
  effects?: ItemEffectDefinition;
  usageAdvice?: string[];          // 英語アドバイス配列 (辞書キー)
  unidentifiedTips?: string[];     // 英語ヒント配列 (辞書キー)
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
- **変更前**: `healingPotion` や `extraHealingPotion` などの探索を文字列部分一致（`name.includes('healing')`）で行っており、`spellbook of healing` などの他種別アイテムを誤認する脆弱性があった。
- **変更後**: ナレッジの効果メタデータ（`item.knowledge?.effects?.healHp`）およびカテゴリ（`item.knowledge?.category === 'POTION'`）による完全データ駆動判定へ一本化。
  ```javascript
  // 完全データ駆動による生存手段スキャン
  const healingPotion = inventoryItems.find(i => 
    i.knowledge?.category === 'POTION' && i.knowledge?.effects?.healHp
  );
  ```

---

## 5. テスト基盤の刷新とテストファクトリの標準化 (Test Fixture & Factory Modernization)

### 5.1 背景：不完全なテストモックが招く実装のテキスト依存
従来のテストコードでは、`{ invlet: 'a', name: 'potion of extra healing', category: 'POTION' }` のような簡易モックオブジェクトが直書きされていたため、実装側が「不完全なモックでも動くようにテキスト判定（`name.includes(...)`）を残す」という主客転倒な技術的負債を抱えていました。

### 5.2 解決策：ナレッジ連動型テストファクトリの導入
テスト側で完全なナレッジ（`onum`, `category`, `effects`, `knowledge`）を持つ実オブジェクトを1行で生成できるヘルパーを整備し、テストと実装の双方から不完全な文字列モックを一掃します。

```javascript
// test/helpers/testItemFactory.js
import { OBJECT_KNOWLEDGE_BASE } from '../../src/core/knowledge/ITEM_KNOWLEDGE_BASE.js';

export function createTestItem(nameOrOnum, invlet = 'a', overrides = {}) {
  const knowledge = typeof nameOrOnum === 'number'
    ? OBJECT_KNOWLEDGE_BASE.find(k => k.onum === nameOrOnum)
    : OBJECT_KNOWLEDGE_BASE.find(k => k.name === nameOrOnum || k.id === nameOrOnum);

  return {
    invlet,
    letter: invlet,
    onum: knowledge?.onum ?? -1,
    name: knowledge?.name ?? (typeof nameOrOnum === 'string' ? nameOrOnum : 'unknown'),
    category: knowledge?.category ?? 'OTHER',
    knowledge: knowledge ?? null,
    ...overrides
  };
}
```

```javascript
// テストコードでの利用例（簡潔かつ実データに即した記述へ刷新）
inventory: [
  createTestItem('potion of extra healing', 'a'),
  createTestItem('spellbook of healing', 'b')
]
```

---

## 6. 種族・職業ナレッジと耐性判定アーキテクチャ (Race & Role Knowledge and Resistance SSOT)

### 6.1 背景と課題（`^X` パースおよび動的キャプチャの限界）
- **NetHack本来の仕様**: 通常プレイ中の `^X`（属性確認）コマンドは基本能力値（STR, DEX等）やHP/AC等の基礎情報しか出力せず、**初期耐性・後天耐性・装備耐性を問わず一切の耐性・内在能力が表示されない**（啓蒙の薬を飲んだその瞬間のみ一時的にポップアップ表示される）。
- **課題**: 
  - `^X` テキストパース前提の実装（`AttributeStateManager.updateFromIntrinsicsLines`）は通常プレイ時に一切機能せず、セーブ＆ロードや同期時に耐性が消失・リセットされる。
  - 啓蒙の薬使用時のキャプチャや死体摂取ログ検知による動的トラッキングは、セーブ＆ロードやリロードによる消失・耐性喪失時の非同期など状態管理が極めて不安定になる。

### 6.2 設計方針：完全決定論的（Deterministic）な「確定耐性」モデル
1. **確定耐性（Confirmed Resistances）への完全一本化**:
   - 揮発的・不確定な動的キャプチャを行わず、**「種族・職業・レベルによる確定内在能力」＋「現在身につけている装備品」** のみから純粋に導出する。
   - これにより、セーブ＆ロード・ブラウザリロード時も常に 100% 正確に再計算・即時復元される。
2. **種族・職業ナレッジマスター（SSOT）の新設**:
   - `RACE_KNOWLEDGE_MAP` および `ROLE_KNOWLEDGE_MAP` を作成し、種族初期耐性および職業ごとの初期・レベルアップ獲得耐性をマスターデータ化。
3. **`^X` 依存コードおよび動的メッセージ検知の整理・廃止**:
   - 機能していない `^X` の耐性パース処理・バッファ監視、および中途半端なメッセージ検知処理を整理・廃止。
4. **実効耐性の算出**:
   $$\text{実効耐性} = \text{（種族・職業・レベルによる確定耐性）} \lor \text{（装備品ナレッジによる外因性耐性）}$$
5. **アドバイス判定の安全性（確定情報のみ採用）**:
   - 戦術アドバイスは「**耐性所持が確定している場合**」に限定して「〇〇耐性があるため安全」と判定。
   - 不確定・未所持の場合は過信させず、安全側に倒した警告・危険度判定を維持する（即死事故の防止）。
6. **UI表示・ガイダンス方針（混乱防止）**:
   - 耐性パネルの名称を **「属性耐性（種族・職業・装備）」** または **「確定耐性」** と明記。
   - ツールチップ等で *「※死体等で後天的に獲得した耐性はNetHackの仕様上ゲーム内で不可視のため、ここには反映されません（啓蒙の薬でのみ確認可能）」* と明記し、プレイヤーの混乱を完全に防ぐ。

---

## 7. 移行ロードマップ (Migration Roadmap)

```
Phase 0: テストファクトリ基盤の整備 ＆ テストデータ刷新 (Test Modernization)
 ├─ createTestItem / createTestMonster ファクトリの新設
 └─ 主要テスト（AssistSignalSynthesizer.test.js, TacticalAdvisor.test.js）のモックをファクトリ呼び出しへ移行

Phase 1: 構造化ナレッジ スキーマ拡張 ＆ マスターデータ定義 (SSOT 構築 ＆ 辞書統合)
 ├─ MONSTER_KNOWLEDGE_MAP に threat / counters / vulnerabilities を英語で追加
 ├─ OBJECT_KNOWLEDGE_BASE に effects / actionVerb などの効果フラグを追加
 ├─ RACE_KNOWLEDGE_MAP / ROLE_KNOWLEDGE_MAP（種族・職業・レベル別耐性テーブル）の新設
 ├─ ナレッジマスターデータ内の日本語ハードコード（nameJa等）を廃止
 ├─ 新規に追加された英語メッセージ・単語を dictionary.csv に一括登録
 └─ StructuredKnowledgeEngine.localizeKnowledge による動的翻訳アタッチの動作確認

Phase 2: AttributeStateManager の刷新（耐性判定の SSOT 化）
 ├─ ^X パース依存ロジック（updateFromIntrinsicsLines 等）の整理・廃止
 ├─ 種族・職業・レベル ＋ 装備ナレッジによる確定耐性算出ロジックの実装
 └─ 単体テストの追加・更新

Phase 3: TacticalAdvisor のデータ駆動化リファクタリング (完了)
 ├─ ハードコード判定をナレッジ走査型に置き換え
 ├─ 確定耐性に基づく安全/危険アドバイスの動的調停（毒・麻痺・ドレイン等）
 └─ 既存単体テスト（全31テスト）および全体回帰テスト（全398テスト）のパス確認

Phase 3.5: ナレッジデータ構造の根本整理 ＆ スキーマ正規化 (手戻り根絶フェーズ)
 ├─ 【スコープ分離】動的戦術（検知可能な具体的脅威）と静的知識（兜の落石防御等）の責務明確化
 ├─ 【統合防護モデル】モンスター脅威（GAZE, TOUCH等）＋ 地形ハザード（LAVA, WATER, TRAP等）の包括
 ├─ 【アイテム特性】protectsAgainst（'GAZE', 'TOUCH_STONING', 'LAVA'等）、material、effects の正規化
 ├─ 【個別名判定の完全撤廃】blindfold, gloves, iron, levitation 等の文字列/ID判定の一掃
 └─ 【静的監査基盤】KnowledgeIntegrityAudit.test.js（全384体/481アイテムの充足率・整合性テスト）の新設

Phase 4: AssistSignalSynthesizer のデータ駆動化リファクタリング
 ├─ evaluateCombatThreatStance および生存アイテム探索（回復・解呪等）の完全データ駆動化
 ├─ 文字列部分一致（name.includes）判定の全廃
 └─ 既存の単体テスト（全21テスト）の完全互換・パス確認

Phase 5: アイテム・環境ケミストリーの SSOT 統合
 ├─ 指輪＋流し台、死体＋祭壇、ユニコーンの角等のルールを OBJECT_KNOWLEDGE_MAP / TERRAIN_KNOWLEDGE_MAP へ集約
```

---

## 8. 期待される効果
- **圧倒的な拡張性**: 新しいモンスター・アイテム・種族・職業対策の追加が「データ定義の追加」だけで 100% 完結。
- **耐性判定の堅牢化**: NetHackのC/WASM内部仕様に左右されず、種族・職業・装備ナレッジから確実に耐性を判定。
- **用語・翻訳の完全統一**: ナレッジ・画面翻訳・ログのすべての日本語表現が `dictionary.csv`（`TranslationEngine`）から単一生成され、表記揺れを根絶。
- **テストの堅牢化と記述の簡素化**: テストデータが実データと完全に一致し、文字列判定のバグ（魔法書の誤認など）を原理的に排除。
- **コード削減**: `TacticalAdvisor` および `AssistSignalSynthesizer` のコード量を 30〜40% 削減。
- **アーキテクチャの統一**: 図鑑、戦術、アシスト、アクション、属性耐性、翻訳、テストが 1 つのナレッジマスターから美しく連動。
