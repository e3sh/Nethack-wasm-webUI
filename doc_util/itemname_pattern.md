# NetHack アイテム名出力フォーマット調査結果

NetHack 3.7 のソースコード（主に src/objnam.c）を調査した結果、アイテム名の出力（doname(src/objnam.c#1744-1749) 関数）は以下の順序とルールで構成されていることが分かりました。

## 1. 基本的な構成順序

アイテム名は、以下の要素がこの順番で連結されて生成されます。

`[数量/冠詞] [空状態] [BUC] [罠] [施錠] [油] [使用状態] [侵食修飾語] [侵食状態] [耐性] [毒] [修正値] [アイテム本体名] [回数] [内容物] [装備状態]`

---

## 2. 各要素の詳細

### ① 数量/冠詞 (Quantity/Article)
- `a `, `an `, `the `
- `5 `, `10 ` (具体的な個数)
- `some ` (個数が不明な場合)

### ② 空状態 (Empty)
- `empty ` (容器や像が空の場合)

### ③ BUC状態 (Blessed/Uncursed/Cursed)
- `blessed `
- `uncursed `
- `cursed `

### ④ 罠・施錠状態 (Traps/Locks)
- `trapped ` (罠が仕掛けられた箱)
- `locked `, `unlocked `, `broken ` (箱の状態)

### ⑤ 追加の状態 (Greased/Partly Used)
- `greased ` (油を塗られた)
- `partly used ` (ロウソクやランプ)

### ⑥ 侵食状態と耐性 (Erosion & Proof)
- **修飾語**: `very `, `thoroughly `
- **状態1**: `rusty `, `cracked `, `burnt `
- **状態2**: `corroded `, `rotted `
- **耐性**: `fixed `, `rustproof `, `corrodeproof `, `fireproof `, `tempered `, `rotproof `
    - ※ 侵食状態の **後** に耐性が表示されます（例: `very rusty rustproof`）。

### ⑦ 毒 (Poison)
- `poisoned ` (武器など)

### ⑧ 魔法の修正値 (Enchantment)
- `+1 `, `+3 `, `-2 ` など

### ⑨ アイテム本体名 (Base Name / xname(src/objnam.c#574-579))
- アイテム本来の名前や説明。
- **ベース名**: `long sword`, `potion of healing`
- **ユーザー名付与**: `clear potion called healing`
- **一部食べた**: `partly eaten ` (食べ物の場合、本体名の前に付くことがある)

### ⑩ 魔法の回数 (Charges)
- `(0:5)`(src/objnam.c#2135-2147) (充填回数:残り回数。杖や一部の道具)
- `(3 of 7 candles attached, lit)`(src/objnam.c#2135-2147) (燭台など)

### ⑪ 内容物 (Contents)
- ` containing 3 items`

### ⑫ 装備・使用状態 (Status Suffixes)
- ` (being worn)` (防具を装備中)
- ` (weapon in hand)`, ` (wielded)` (武器を手に持っている)
- ` (lit)` (明かりが点いている)
- ` (on left hand)`, ` (on right hand)` (指輪をはめている)
- ` (unpaid, 500 zorkmids)` (店の商品/未払い)

---

## 3. 具体的な出力例

- `a blessed greased +1 silver saber (weapon in hand)`
- `5 uncursed poisoned +0 darts`
- `a thoroughly rusty rustproof +0 long sword`
- `an empty cursed locked chest`
- `a potion of extra healing called panic button`
- `a wand of wishing (1:3)`
- `a large box containing 5 items`
