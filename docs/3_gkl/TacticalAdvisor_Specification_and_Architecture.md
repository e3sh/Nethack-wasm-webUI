---
title: TacticalAdvisor 仕様・アーキテクチャ解説書
status: implemented
last_updated: 2026-10-11
related_code:
  - src/core/knowledge/engines/TacticalAdvisor.js
  - src/core/knowledge/data/ADVICE_DEFINITIONS.js
  - src/core/knowledge/state/SituationCache.js
  - src/core/knowledge/GKLPlugin.js
---

# TacticalAdvisor (戦術アドバイザー) 仕様・アーキテクチャ解説書

本書は、NetHack Game Knowledge Layer (GKL) における状況評価・危険予知・戦術提案エンジンである **TacticalAdvisor** の設計思想、評価トピック体系、データ構造、および UI 連携規則をまとめた公式仕様書です。

---

## 1. 背景と設計思想 (Motivation & Philosophy)

### 従来の課題
従来の GKL では、ContextActionEngine が「即座にキーを入力して 1 ターン行動するアクション (ドアを開ける、アイテムを拾う等)」と「気づきや警告、装備の適正評価 (コカトリスに素手で殴ると石化する、より強い武器がある等)」の両方を担っていました。
その結果：
- ワンタップ実行ボタン群の中に長文の警告が混ざり、操作ボタンのレイアウトが肥大化。
- 「今すぐ行動したい」ニーズと「状況を落ち着いて把握したい」ニーズが衝突し、UI のノイズが増加。

### 責務の完全分離 (Separation of Concerns)
GKL ではこの 2 つの責務を完全に分離しました：

```text
┌────────────────────────────────────────────────────────┐
│               Game Knowledge Layer (GKL)               │
├────────────────────────────┬───────────────────────────┤
│ ContextActionEngine        │ TacticalAdvisor           │
│ (即時行動エンジン)         │ (戦術助言・危険予知)      │
├────────────────────────────┼───────────────────────────┤
│ ・ワンタップで 1 ターン消費│ ・ターンを消費しない      │
│ ・ドアを開ける ('o')       │ ・危険・リスクの事前察知  │
│ ・アイテムを拾う (',')     │ ・熟練度・装備適正の助言  │
│ ・隣接モンスター攻撃/射撃  │ ・呪文詠唱ペナルティ警告  │
│ ➔ [右: 🧠 推奨アクション]  │ ➔ [右: 🛡️ 戦術アドバイス] │
└────────────────────────────┴───────────────────────────┘
```

---

## 2. アーキテクチャ & 評価ライフサイクル

`TacticalAdvisor`（`src/core/knowledge/engines/TacticalAdvisor.js`）は**純粋関数型（ステートレス）**の評価エンジンとして設計されており、データ駆動のアドバイス定義辞書 [`ADVICE_DEFINITIONS.js`](/src/core/knowledge/data/ADVICE_DEFINITIONS.js) を参照して評価を行います。

```text
       AreaStateManager         InventoryStateManager      SkillStateManager
      (マップ/地形/NPC/罠)        (所持品/装備/BUC)         (熟練度/rank/ボーナス)
               │                        │                         │
               └──────────────┬─────────┴───────────────┬─────────┘
                              ▼                         ▼
                     StatusAccessor           AttributeStateManager
                    (HP/Pw/空腹/AC)          (耐性/固有能力/装備合算)
                              │                         │
                              └───────────┬─────────────┘
                                          ▼
                         ┌─────────────────────────────────┐
                         │   TacticalAdvisor.generateAdvices│
                         └────────────────┬────────────────┘
                                          ▼
                              Array<TacticalAdvice>
                                          │
            ┌─────────────────────────────┴────────────────────────────┐
            ▼                                                          ▼
  [ステータスバー / AssistSignal]                            [右サイド下部カード]
  ・平常時: スッキリ1行表示                                  ・[🛡️ アドバイス (N)] タブ
  ・CRITICAL 時のみ [🚨 危険] 点灯                           ・ホバーで長文理由をスムーズ全文展開
                                                             ・重要度別カラーハイライト
```

---

## 3. 評価トピック体系 (Evaluation Topics / 全7系統)

`TacticalAdvisor.generateAdvices()` は、以下の 7 系統の評価関数を実行し、ゲーム内のあらゆる危険と最適化ポイントを統合評価します：
1. `evaluateSurvivalAdvices`（生命維持・HP・飢餓・状態異常）
2. `evaluateNearbyThreats`（周辺モンスター脅威：コカトリス・浮遊目玉・ガス胞子・銀特効・平和NPC誤爆警告等）
3. `evaluateEnvironmentalHazards`（地形ハザード：溶岩・水場・露出罠・袋爆発等）
4. `evaluateEquipmentAdvices`（熟練武器適正・最適武器提案）
5. `evaluateEquipmentDependencyAdvices`（`EquipmentDependencyAnalyzer` 連携による着脱ブロッカー・呪詛阻害の解説）
6. `evaluateItemInteractionAdvices`（祭壇 BUC 鑑定・流し台指輪識別・彫刻・箱解錠等の知識活用助言）
7. `evaluateMagicAdvices`（金属防具着用時の呪文詠唱失敗率ペナルティ）

### ① THREAT（即死・致命的脅威・環境ハザード）

| 対象 | 重要度 | 検出条件 | アドバイス内容・理由 |
| :--- | :--- | :--- | :--- |
| **コカトリス (Chickatrice / Cockatrice)** | CRITICAL | 周辺に存在 ＆ 手袋未着用 | ⚠️ 危険: コカトリス接近！手袋未着用のため素手・キック攻撃は石化即死リスク。手袋着用 (W) または射撃を推奨。 |
| **浮遊目玉 (Floating Eye)** | WARNING | 周辺に存在 ＆ 目隠しなし | ⚠️ 浮遊目玉注意: 近接攻撃すると麻痺して無防備になります。遠隔武器または目隠し・盲目状態での攻撃を推奨。 |
| **ガス胞子 (Gas Spore)** | WARNING | 周辺に存在 | ⚠️ ガス胞子接近: 近接攻撃で大爆発し大ダメージを受けます。飛び道具で離れて倒すか回避を推奨。 |
| **銀特効 (Silver vs Undead/Demon)** | TIP | 悪魔/アンデッド接近 ＆ 銀装備所持 | 💡 銀特効: 接近中の敵は銀弱点です。所持している銀の武器を装備 (w) すると大ダメージを与えられます。 |
| **溶岩 (Lava)** | CRITICAL | 隣接または視界内に溶岩 ＆ 浮遊/飛行なし | 🚨 即死警告: 溶岩マスへの進入は即死およびアイテム全焼失の危険。浮遊手段 (#apply / 指輪 / 薬) が必須。 |
| **水場 (Water / Pool)** | WARNING | 隣接または視界内に水場 ＆ 水上歩行/浮遊なし | ⚠️ 水没警告: 水場に入ると所持品（巻物・薬・鉄製防具）が水濡れ破損・錆びます。水上歩行や浮遊を推奨。 |
| **露出した罠 (Exposed Trap)** | WARNING | 周辺に落とし穴・熊罠・矢の罠等が露出 | ⚠️ 罠警戒: 視界内に危険なトラップを検知。歩行ルートに注意するか、箱や岩で埋めることを推奨。 |
| **手品袋の爆発 (Bag of Tricks Hazard)** | CRITICAL | 手品袋と他の収納袋（軽量化袋等）を同時所持 | 🚨 爆発ハザード: 手品袋を軽量化の袋等の収納具に入れると大爆発し、全アイテムと周囲が消滅します。絶対に入れないでください！ |

### ② EQUIPMENT（熟練武器適正・着脱依存診断・アイテム相互作用）

- **熟練度と武器性能の総合評価 (`evaluateEquipmentAdvices`)**:
  - キャラクターのスキルランク（達人・熟練・入門・未熟）と、武器の基礎ダイス、強化値 (+N)、BUC 状態を総合判定。
  - 近接武器とランチャー（弓・クロスボウ・スリング）を分離して評価し、現在装備中の武器より戦闘効率が高い熟練武器があればキーヒント (`[w]`) つきで提案。
- **装備着脱の依存関係診断 (`evaluateEquipmentDependencyAdvices`)**:
  - `EquipmentDependencyAnalyzer` と連携し、「外套・鎧を着ているためシャツを着られない」「呪われた手袋のため指輪を着脱できない」といった阻害要因と解決手順を提示。
- **知識・環境相互作用 (`evaluateItemInteractionAdvices`)**:
  - 足元の祭壇での BUC 識別、流し台での指輪調査、箱・袋の取り扱いなど、現在地の設備と所持品の組み合わせから有益な知識活用アクションを助言。

### ③ MAGIC（呪文詠唱制限 ＆ ペナルティ）

- **金属防具着用ペナルティ**:
  - 金属製の鎧（Iron / Metal Suit / Shield / Helm）を着用していると、呪文詠唱の失敗率が跳ね上がります（最大 100% 失敗）。
  - 魔法を習得している状態で金属防具を着ている場合、詠唱失敗リスクを WARNING で助言。

### ④ SURVIVAL（生命維持 ＆ 状態異常）

- **瀕死警告**:
  - 残り HP が最大 HP の 25% 以下になった時、CRITICAL で回復手段（回復の薬 'q'、杖 'z' 等）を即座に提示。
- **飢餓・衰弱警告**:
  - Weak（衰弱）や Fainting（気絶寸前）のステータス異常を検知し、食料摂取 ('e') を警告。

---

## 4. データ構造仕様 (TacticalAdvice)

```typescript
interface TacticalAdvice {
  id: string;              // 一意な識別ID (例: 'threat_cockatrice_barehand')
  topic: 'THREAT' | 'EQUIPMENT' | 'MAGIC' | 'SURVIVAL';
  severity: 'CRITICAL' | 'WARNING' | 'TIP' | 'INFO';
  message: string;         // 言語設定に応じた解説文
  messageJa: string;       // 日本語詳細メッセージ
  messageEn: string;       // 英語詳細メッセージ
  actionHint?: string;     // 推奨キーヒント (例: 'W', 'w', 'q')
  category?: string;       // サブカテゴリ (例: 'PETRIFICATION', 'PROFICIENT_WEAPON')
  entityName?: string;     // 関連対象名 (例: 'Cockatrice', 'Lava')
}
```

---

## 5. UI/UX 統合仕様 (gkl-pure-js-client)

### 1. ステータスバー（1 行の静けさ）
- 通常時は NetHack 本来のクラシックな 1 行表示を維持。
- CRITICAL（コカトリス石化、溶岩即死、手品袋爆発等）が発生した時のみ、右端に控えめな **🚨 危険** バッジが点滅点灯。

### 2. 右サイドパネル（タブ式インジケータ ＆ ホバー全文展開）

```text
┌────────────────────────────────────────────────────────┐
│ [🛡️ アドバイス (2)]   [💡 ナレッジ]                     │
├────────────────────────────────────────────────────────┤
│ [🚨 CRITICAL] ⚠️ 危険: コカトリス接近！手袋未着用... [W]│
│ [💡 TIP] 熟練武器: [b] 短剣 (達人) の方が高い戦闘... [w]│
└────────────────────────────────────────────────────────┘
```

- **平常時（アドバイス優先モード）**:
  - マップの床をクリックして移動したり、床・壁の上をマウスが通過しても、アドバイス一覧が隠れずに常時表示。
- **オブジェクト調査時（オンデマンド切替）**:
  - モンスター、アイテム、扉、罠、祭壇にマウスが触れた瞬間、または所持品アイコンをクリックした時だけ自動で 💡 ナレッジ に切り替わり、詳細を表示。
- **全行スムーズ展開**:
  - アドバイスカードは通常時 2 行に省略（クランプ）され、マウスホバー時に**全行がスムーズに展開されて詳細な理由・対処法を全文閲覧可能**。
- **完全な情報保持**:
  - 床や壁に触れた際も内部データ（lastKnowledgeTarget）には床・壁ナレッジが記憶されており、[💡 ナレッジ] タブを押せばいつでも床や壁の詳細（Elbereth 刻み、採掘等）を確認可能。

---

## 6. テストと保守性

- **単体テスト**: `tests/unit/TacticalAdvisor.test.js`
  - コカトリス、浮遊目玉、ガス胞子、銀特効、溶岩、水没、罠、手品袋爆発、熟練武器、装備依存関係、金属鎧詠唱ペナルティ、瀕死・飢餓の全項目を網羅。
  - プロジェクト全体テストスイート（全 136 スイート・1,670 テスト）で 100% PASS を維持。
