# GKL (Game Knowledge Layer) 推奨アクション高度化 施策提案書 (第2版)

**〜情報過多・ネタバレを抑え、体験先行型学習と段階的開示を実現する次世代ダンジョン参謀システム〜**

---

## 1. 概要と背景

### 【これまでの成果（Phase 1〜3 の達成）】
これまで GKL（Game Knowledge Layer）は、分散する NetHack のゲーム状態を統合するデータ駆動基盤として急速に進化を遂げました：
1. **状態同期・多次元キャッシュ層の確立**:
   - 習得魔法 (`SpellStateManager`: `+` キー)
   - 内因性/外因性耐性 (`AttributeStateManager`: `^X` ＋ 装備耐性自動合算)
   - 発見台帳 (`DiscoveryStateManager`: `\` キー)
   - スキル熟練度 (`SkillStateManager`: `#enhance` キー)
   - 認知メンタルマップ (`MonsterTracker`: 視界外モンスター確信度減衰)
2. **全アイテム・全モンスター構造化マスターデータの完成**:
   - 全 481 アイテム (`OBJECT_KNOWLEDGE_FULL.js`) の正式名称・動的スペック・BUC効果・推奨操作動詞
   - 全 384 モンスター (`MONSTER_KNOWLEDGE_FULL.js`) の危険度・耐性・弱点・死体特性・平和NPC判定
3. **戦術アドバイザー ＆ コンテキストアクションの統合**:
   - `TacticalAdvisor.js` による石化・麻痺・ドレイン・腐食等の事前警告と銀武器・適正装備サジェスト
   - `ContextActionEngine.js` による正規化された方向コード (`dirCode`) 付与と即時実行ボタン生成

---

### 【現在の課題：情報過多とネタバレのジレンマ】
基盤が整い、高度な戦術推論やアドバイスが出せるようになった一方で、実際のプレイ体験において新たな本質的課題が浮き彫りになりました：
* **「情報量が多すぎて画面を圧迫する」**: 詳細な解説やTipsをそのまま画面に出すと、文字が溢れて読まれなくなる。
* **「ネタバレと探求の楽しさの衝突」**: 未知の罠やアイテム効果をすべて事前に開示してしまうと、ローグライク特有の「手探りの面白さ」が損なわれる。
* **「説明書を読まないプレイヤーへのアプローチ」**: 初心者は長い理屈（なぜElberethで敵を避けられるのか、なぜ杖で床に文字を書くのか等）を読まないため、**「直感的な操作体験の中で自然に覚えられる仕組み」** が必要。

---

## 2. 次世代 GKL の設計原則 (Design Principles)

```
        ┌─────────────────────────────────────────────────────────────┐
        │                  次世代 GKL の 3 大設計原則                  │
        └─────────────────────────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
  【段階的開示】                【体験先行型学習】             【ネタバレ度制御】
(Progressive Disclosure)     (Experience-First Action)      (Assist Level Control)
・画面上は 1行要約のみ         ・理屈が分からなくても押せば   ・プレイヤーの好みに合わせて
・詳細は [?] やリンクで展開      助かる即時アクション提示       アシスト量をワンタッチ切替
・読まない人の視界を邪魔しない ・「助かった後に知る」サイクル ・初心者〜熟練者まで完全対応
```

1. **段階的開示 (Progressive Disclosure)**:
   - メイン画面には **「結論となる1行要約」**（例: `🛡️ ピンチ！足元に Elbereth を刻むと安全に回復できます [?]`）のみをスッキリ表示。
   - 理由や背景（Why）は、クリック時のアコーディオン展開や、公式 Wiki / 解説ページへの直通リンク（`🔗 Wikiで詳細を見る`）で提供。
2. **体験先行型アクション (Experience-First Action)**:
   - 「説明を読んで理解してから行動する」のではなく、**「推奨アクション欄に出た `[足元に刻む (E: Elbereth)]` や `[店主に支払う (#pay)]` を押したら助かった！」** という成功体験を先行させる。
3. **死因分析によるピンポイント学習 (Post-Mortem Learning)**:
   - プレイヤーが最も「なぜ！？」と真剣に情報を欲する **ゲームオーバー（死亡）の瞬間** に、その死因に直結する回避策（例: `コカトリスの死体は手袋を着用していれば持てました`）を1点集中で提示する。

---

## 3. 実装ロードマップ ＆ 新規フェーズ

```mermaid
gantt
    title GKL 開発ロードマップ (Phase 1 〜 Phase 6)
    dateFormat  YYYY-MM-DD
    section 完了済み基盤
    Phase 1: 状態同期・キャッシュ基盤 (Spells, Attributes, Discoveries) :done, p1, 2026-08-01, 2026-08-15
    Phase 2: 識別判定・スキル連動・Look調査 ＆ 構造化ナレッジ完成 :done, p2, 2026-08-16, 2026-08-20
    Phase 3: 認知メンタルマップ ＆ 高度戦術推論・方向コード標準化 :done, p3, 2026-08-21, 2026-08-24
    section 次期開発フェーズ
    Phase 4: 段階的開示・Wikiリンク ＆ ネタバレ度制御 (Assist Levels) :active, p4, 2026-08-25, 2026-08-30
    Phase 5: 死亡分析 (Post-Mortem) ＆ 体験先行型アクションUI洗練 :p5, 2026-08-31, 2026-09-07
    Phase 6: 空間知能 (Spatial Intelligence) ＆ ショップ価格識別連携 :p6, 2026-09-08, 2026-09-15
```

| フェーズ | 施策内容 | 主な成果物・対象コンポーネント | ステータス |
| :--- | :--- | :--- | :---: |
| **Phase 1: 情報取得・同期基盤** | ・`SpellStateManager.js` (`+` キー同期)<br>・`AttributeStateManager.js` (`^X` 自律同期 ＋ 装備耐性合算)<br>・`DiscoveryStateManager.js` (`\` 発見台帳同期) | [`SpellStateManager.js`](/src/core/knowledge/SpellStateManager.js)<br>[`AttributeStateManager.js`](/src/core/knowledge/AttributeStateManager.js)<br>[`DiscoveryStateManager.js`](/src/core/knowledge/DiscoveryStateManager.js) | **【✅ 完了】** |
| **Phase 2: 識別・スキル・完全ナレッジ** | ・未識別/価格識別/確定識別の厳密判定<br>・スキル熟練度 (`#enhance`) 同期<br>・全481アイテム ＆ 全384モンスター完全マスターデータ化<br>・適応型スペック提示成形 (`ItemSpecPresenter`) | [`ItemIdentificationResolver.js`](/src/core/knowledge/ItemIdentificationResolver.js)<br>[`SkillStateManager.js`](/src/core/knowledge/SkillStateManager.js)<br>[`OBJECT_KNOWLEDGE_FULL.js`](/src/core/knowledge/OBJECT_KNOWLEDGE_FULL.js)<br>[`MONSTER_KNOWLEDGE_FULL.js`](/src/core/knowledge/MONSTER_KNOWLEDGE_FULL.js) | **【✅ 完了】** |
| **Phase 3: 認知マップ・戦術推論基盤** | ・モンスター追跡 ＆ 確信度減衰 (`MonsterTracker.js`)<br>・戦術アドバイザー (`TacticalAdvisor.js`)<br>・推奨アクション方向コード (`dirCode`) 自動付与 ＆ 全クライアント連携 | [`MonsterTracker.js`](/src/core/knowledge/MonsterTracker.js)<br>[`TacticalAdvisor.js`](/src/core/knowledge/TacticalAdvisor.js)<br>[`ContextActionEngine.js`](/src/core/knowledge/ContextActionEngine.js) | **【✅ 完了】** |
| **Phase 4: 段階的開示 ＆ ネタバレ制御** | ・アドバイスの「1行要約 ＋ アコーディオン展開」成形<br>・公式 NetHack Wiki / スポイラーへの直通リンク埋め込み<br>・アシストレベル切替設定 (🔰ビギナー / ⚔️アドバンス / 💀クラシック) | [`TacticalAdvisor.js`](/src/core/knowledge/TacticalAdvisor.js)<br>UI 各クライアント (`gkl-pure-js-client`, `vue-client` 等) | **【🚀 開発着手】** |
| **Phase 5: 死亡分析 ＆ 体験学習UI** | ・ゲームオーバー時の「死因分析 ＆ 回避ヒント」ダイアログ (`PostMortemAdvisor`)<br>・Elbereth床彫りや安全鑑定等の「ワンタップ救済アクション」強化 | [`GameOverResolver.js`](/src/core/lifecycle/GameOverResolver.js)<br>[`ContextActionEngine.js`](/src/core/knowledge/ContextActionEngine.js) | **【次期予定】** |
| **Phase 6: 空間知能 ＆ 価格識別連携** | ・階段・祭壇・ショップのピン留め・フロアナビゲーション<br>・店主の売買価格からのアイテム自動推論（Price ID） | [`AreaStateManager.js`](/src/core/knowledge/AreaStateManager.js)<br>[`ItemIdentificationResolver.js`](/src/core/knowledge/ItemIdentificationResolver.js) | **【次期予定】** |

---

## 4. 各新規施策の詳細仕様

### 【施策 1: 段階的開示 ＆ Wikiリンク連携 (Phase 4)】

#### 1. 2階層アドバイスモデル
* **第1階層（サマリー）**:
  画面のアドバイスリストには、**20〜30文字程度の結論** のみを表示。
  - 例: `⚠️ [麻痺視線] 浮遊する目玉を直視・近接攻撃すると数ターン麻痺します [?]`
  - 例: `🛡️ [緊急結界] 足元に Elbereth を刻むと近接敵が逃走します [?]`
* **第2階層（詳細・Whyの解説 ＆ Wikiリンク）**:
  サマリー右端の `[?]` やクリックにより、以下のアコーディオンカードが展開：
  - **効果の理由**: なぜその現象が起きるのか、どういう原理か
  - **推奨される対策**: 遠距離攻撃、目隠し着用、手袋着用など
  - **Wikiリンク**: `🔗 NetHackWiki で「Floating Eye」の仕様を見る`

#### 2. アシストレベル（ネタバレ設定）
プレイヤーの設定で表示粒度をフィルタリング：
```javascript
export const ASSIST_LEVELS = {
    BEGINNER: {
        id: 'BEGINNER',
        labelJa: '🔰 ビギナー（フルガイド）',
        scoreThreshold: 100,
        showAdvices: true,
        showWikiLinks: true,
        allowSpoilers: true
    },
    ADVANCED: {
        id: 'ADVANCED',
        labelJa: '⚔️ アドバンス（危険アラートのみ）',
        scoreThreshold: 500,
        showAdvices: true,
        showWikiLinks: false,
        allowSpoilers: false // 未識別アイテムのネタバレ等を抑制
    },
    CLASSIC: {
        id: 'CLASSIC',
        labelJa: '💀 クラシック（アシストOFF）',
        scoreThreshold: Infinity,
        showAdvices: false,
        showWikiLinks: false,
        allowSpoilers: false
    }
};
```

---

### 【施策 2: 死因分析システム (Post-Mortem Analyzer / Phase 5)】

プレイヤーが力尽きた際、`GameOverResolver` と連携して「死の振り返りカード」を提示：
1. **直接の死因特定**:
   - `Petrification`（石化死）、`Drowning`（溺死）、`Level Drain`（ドレイン死）、`Poison`（毒死）、`Explosion`（自爆死）等の死因カテゴリを自動判定。
2. **1点集中ヒント**:
   - 説教くさくならないよう、**「次回生き残るための最も重要な1つのヒント」** のみを表示。
   - 例: `💡 コカトリスの死体は、革の手袋（leather gloves）を着用していれば安全に持ち運んで武器として使えます。`
   - 例: `💡 スライムに触られた時は、火の杖（Wand of Fire）を自分に振るか火炎ポーションを飲むことでスライム化を治療できます。`

---

### 【施策 3: 空間知能 ＆ ショップ価格識別 (Phase 6)】

1. **フロア施設マーカー**:
   - 一度発見した上り階段 (`<`)、下り階段 (`>`)、祭壇 (`_`)、泉 (`{`)、ショップの座標を記憶し、ミニマップやステータス欄にナビゲーションアイコンとして提示。
2. **価格識別 (Price ID) アシスタント**:
   - 店主がアイテムを売買する際の価格（例: `300zm` の指輪）を検知した際、`ItemIdentificationResolver` が候補（`ring of teleport control` または `ring of conflict`）を自動算出してナレッジカードに候補一覧を表示。

---

*改定日: 2026-08-24 (Phase 1〜3 完了反映 ＆ Phase 4〜6 次期ロードマップ策定)*  
*保存先: `docs/3_gkl/gkl_action_enhancement_proposal.md`*


