---
title: itemname_pattern
status: active
last_updated: 2026-09-04
related_code:
  - src/objnam.c
  - src/core/translation/TranslationEngine.js
---

# NetHack 5.0 アイテム名出力フォーマット仕様（doname / xname）

NetHack 5.0 のソースコード（主に `src/objnam.c` の `doname_base()` および `xname_flags()` 関数）に基づくアイテム名出力仕様書です。

## 1. 基本的な構成順序

アイテム名は、以下の要素がこの順番で連結されて生成されます。

`[数量/冠詞] [空状態] [BUC] [罠] [施錠] [油/使用状態] [毒] [侵食修飾語+状態1] [侵食修飾語+状態2] [耐性] [修正値] [アイテム本体名] [回数/チャージ] [内容物] [装備/使用状態/価格/デバッグ]`

---

## 2. 各要素の詳細仕様

### ① 数量/冠詞 (Quantity/Article)
- `a `, `an `, `the `
- `5 `, `10 ` (具体的な個数)
- `some ` (矢やダーツなど数量不明・曖昧な場合)
- `Your `, `your ` (一部のメッセージやインベントリ表示)

### ② 空状態 (Empty)
- `empty ` (中身のない容器、空の魔法の小袋 `bag of tricks`、像 `statue`)

### ③ BUC状態 (Blessed/Uncursed/Cursed)
- `blessed `
- `uncursed `
- `cursed `

### ④ 罠・施錠状態 (Traps/Locks)
- **罠**: `trapped ` (罠が仕掛けられた箱/チェスト)
- **施錠**: `locked `, `unlocked `, `broken ` (鍵のかかった/外れた/壊れた箱)

### ⑤ 追加の状態 (Greased / Partly Used / Partly Eaten)
- `greased ` (油を塗られた)
- `partly used ` (使用途中のロウソクやランプ)
- `partly eaten ` (食べかけの食料/死体)

### ⑥ 毒 (Poison)
- `poisoned ` (毒が塗られた武器/矢)

### ⑦ 侵食状態と耐性 (Erosion & Proof)
- **侵食修飾語**: `very `, `thoroughly `
- **侵食状態1 (錆/ヒビ/焼損)**: `rusty `, `cracked `, `burnt `
- **侵食状態2 (腐食/腐敗)**: `corroded `, `rotted `
- **耐性 (Proof)**:
  - `fixed ` (クリスタルなど壊れない)
  - `rustproof ` (防錆)
  - `corrodeproof ` (耐腐食)
  - `fireproof ` (耐火)
  - `tempered ` (焼き入れ・強化ガラス)
  - `rotproof ` (防腐)
  *(※ 侵食状態の後に耐性が表示されます。例: `very rusty rustproof`)*

### ⑧ 魔法の修正値 (Enchantment)
- `+1 `, `+3 `, `-2 `, `+0 ` など（武器、防具、指輪など）

### ⑨ アイテム本体名 (Base Name / `xname`)
- **数量単位**: `pair of ` (手袋、靴、レンズなど)
- **希釈**: `diluted ` (水で薄められた薬)
- **ベース名**: `long sword`, `potion of extra healing`, `elven dagger`
- **個別名/呼称**:
  - `called <name>` (プレイヤーによる仮称: `clear potion called healing`)
  - `named <name>` (アーティファクト等の固有名: `elven dagger named Sting`)
- **特殊複合**:
  - `tin of <monster> meat`
  - `statue of a <monster>`
  - `figurine of a <monster>`
  - `<monster> corpse`
  - `<monster> egg`

### ⑩ 魔法の回数・チャージ (Charges)
- `(0:5)` (杖や一部の道具：充填回数:残り回数)
- `(3 of 7 candles attached, lit)` (燭台のロウソク装着・点灯数)

### ⑪ 内容物 (Contents)
- ` containing 3 items` *(※ 括弧なしで付与される)*

### ⑫ 装備・使用状態・店舗価格・デバッグ (Status Suffixes)
- **防具装備**:
  - ` (being worn)` (装備中)
  - ` (being donned)` (装着中 / 5.0新要素)
  - ` (being doffed)` (脱衣中 / 5.0新要素)
  - ` (embedded in your skin)` (肌に埋め込まれた / 5.0新要素)
  - ` (; slippery)` (手が滑る状態の手袋 / 5.0新要素)
- **武器装備**:
  - ` (weapon in right hand)`, ` (weapon in left hand)`, ` (weapon in hands)`
  - ` (wielded in right hand)`, ` (wielded in left hand)` (二刀流)
  - ` (tethered to right hand)` (アクリス等の紐付き武器 / 5.0新要素)
  - ` (wielded)` (矢や投擲武器など)
  - ` (alternate weapon; not wielded)`, ` (alternate weapons; not wielded)` (裏持ち武器)
- **装飾品/道具/照明**:
  - ` (on right hand)`, ` (on left hand)` (指輪)
  - ` (in quiver)`, ` (in quiver pouch)`, ` (at the ready)` (矢筒・発射準備)
  - ` (lit)` (明かりが点いている)
  - ` (attached to <monster>)` (リードで繋がれている)
  - ` (chained to you)`, ` (attached to you)` (鉄球・鎖)
  - ` (laid by you)` (産み落とした卵)
- **店舗・価格**:
  - ` (unpaid, 500 zorkmids)` (未払い品)
  - ` (contents, 500 zorkmids)` (容器内の未払い品合計)
  - ` (for sale, 100 zorkmids)` (床置きの売り物 / 5.0新要素)
  - ` (no charge)` (無料品 / 5.0新要素)
- **ウィザード/デバッグ**:
  - ` (50 aum)` (重量表示 Arbitrary Unit of Measure / 5.0新要素)
  - ` (male)`, ` (female)`, ` (unspecified gender)` (性別表示)

---

## 3. 具体的な出力例

- `a blessed greased +1 silver saber (weapon in right hand)`
- `5 uncursed poisoned +0 darts`
- `a thoroughly rusty rustproof +0 long sword`
- `an empty cursed locked chest`
- `a large box containing 5 items`
- `a diluted potion of extra healing called panic`
- `an elven dagger named Sting (wielded in right hand)`
- `a pair of +0 leather boots (being donned)`
- `an aklys (tethered to right hand)`
- `a long sword (for sale, 50 zorkmids)`
- `a wand of wishing (1:3)`
