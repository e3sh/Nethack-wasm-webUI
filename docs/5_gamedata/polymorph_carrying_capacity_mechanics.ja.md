# 多重変身（Polymorph）時における運搬許容量・所持重量上限のメカニズム調査資料

本資料は、NetHack においてプレイヤーが多重変身（Polymorph の罠や巻物・杖など）により犬などの動物・小型モンスターや手のないモンスターに変身した際、**「なぜ持ち物上限（運搬許容量）が大幅に低下し、過荷重（Overloaded / Strained）に陥るのか」** について、NetHack C コアの内部実装を調査・整理した技術リファレンスです。

---

## 1. 調査サマリー（結論）

1. **直接の原因は「体重（`cwt`）比率によるスケーリング」**:
   - 変身先が力持ち（`M2_STRONG`）フラグを持たない場合、運搬許容量は **モンスターの体重 $\div$ 人間の基準体重（$1450$）** に比例して激減します。
   - 子犬（体重 150）に変身した場合は **約 10%（1/10）**、犬（体重 400）に変身した場合は **約 28%** にまで許容量が急落します。
2. **「手がないこと（`M1_NOHANDS`）」による間接的ペナルティ**:
   - 手袋・盾・武器・兜・靴などの装備が強制的に脱落します。
   - 特に **力の小手（Gauntlets of Power: STR 25）** を装備していた場合、強制解除により STR が素の値に急落し、基礎許容量そのものが削られます。
   - 力持ちでないモンスターに変身すると、最大筋力が 18 にクランプされ、例外筋力（18/50 や 18/** 等）も剥奪されます。
   - 手がないためバッグ類（軽量化の鞄など）の開閉操作（`#loot` / `apply`）が拒否され、荷物の再整理・軽量化が不可能になります。

---

## 2. 運搬許容量の算出ロジック (`weight_cap()`)

運搬許容量の計算は、C コアの [`src/hack.c`](file:///c:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/src/hack.c#L4294-L4346) 内の `weight_cap()` で行われます。

### 2.1. 通常時（人間・ベースフォーム）の計算式

```c
carrcap = (WT_WEIGHTCAP_STRCON * (ACURRSTR + ACURR(A_CON))) + WT_WEIGHTCAP_SPARE;
```

定数の定義（[`include/weight.h`](file:///c:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/include/weight.h)）：
- `WT_WEIGHTCAP_STRCON = 25`
- `WT_WEIGHTCAP_SPARE = 50`
- `MAX_CARR_CAP = 1000`（最大運搬能力のハードキャップ）

$$\text{通常許容量} = 25 \times (\text{STR} + \text{CON}) + 50 \quad (\text{上限: } 1000)$$

*例: STR 16, CON 14 の場合 $\rightarrow 25 \times 30 + 50 = 800$*

### 2.2. 変身時（`Upolyd`）の補正式

変身中の場合、以下の処理が割り込みます：

```c
if (Upolyd) {
    /* consistent with can_carry() in mon.c */
    if (gy.youmonst.data->mlet == S_NYMPH)
        carrcap = MAX_CARR_CAP;
    else if (!gy.youmonst.data->cwt)
        carrcap = (carrcap * (long) gy.youmonst.data->msize) / MZ_HUMAN;
    else if (!strongmonst(gy.youmonst.data)
             || (strongmonst(gy.youmonst.data)
                 && (gy.youmonst.data->cwt > WT_HUMAN)))
        carrcap = (carrcap * (long) gy.youmonst.data->cwt / WT_HUMAN);
}
```

- **`WT_HUMAN` = 1450**（人間の基準体重）
- **ニンフ (`S_NYMPH`)**: 無条件で最大許容量（`MAX_CARR_CAP = 1000`）。
- **死体の残らないモンスター (`cwt == 0`)**: サイズ分類（`msize / MZ_HUMAN`）でスケーリング。
- **通常のモンスター**:
  - 変身先が **力持ち（`strongmonst` / `M2_STRONG`）ではない場合**、または力持ちだが体重が人間より重い（巨人体型など）場合：
    $$\text{変身後許容量} = \text{基礎許容量} \times \frac{\text{モンスターの体重 (cwt)}}{1450}$$
  - ※体重が人間より軽い力持ちモンスター（大型犬など）は、この縮小判定から除外されます。

---

## 3. 犬系および主要モンスター変身時の減少率リファレンス

[`include/monsters.h`](file:///c:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/include/monsters.h) に定義されているデータに基づく比較：

| モンスター名 | 体重 (`cwt`) | 力持ち (`M2_STRONG`) | 手の有無 (`M1_NOHANDS`) | 許容量倍率 (`cwt / 1450`) | 通常時 800 の場合の実効上限 |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **人間 (ベース)** | 1450 | - | あり | **100.0%** | **800** |
| **小犬 (little dog)** | 150 | × | なし | **約 10.3%** | **82** (激減) |
| **ジャッカル (jackal)** | 300 | × | なし | **約 20.7%** | **165** |
| **犬 (dog)** | 400 | × | なし | **約 27.6%** | **220** |
| **ディンゴ (dingo)** | 400 | × | なし | **約 27.6%** | **220** |
| **狼 (wolf)** | 500 | × | なし | **約 34.5%** | **275** |
| **大型犬 (large dog)** | 800 | **○** | なし | **100.0% (ペナルティ免除)** | **800** |
| **子猫 (kitten)** | 150 | × | なし | **約 10.3%** | **82** |
| **家猫 (housecat)** | 200 | × | なし | **約 13.8%** | **110** |
| **大型猫 (large cat)** | 250 | **○** | なし | **100.0% (ペナルティ免除)** | **800** |
| **ポニー (pony)** | 1200 | × | なし | **約 82.8%** | **662** |
| **馬 (horse)** | 1800 | **○** | なし | **約 124.1% (上限1000)** | **993** |

> [!NOTE]
> 大型犬（large dog）や大型猫（large cat）は `M2_STRONG` フラグを持っているため、小型動物でありながら体重縮小ペナルティが免除される例外となっています。

---

## 4. 「手がないこと（`M1_NOHANDS`）」による複合的ペナルティ

「手がない」モンスターに変身した際、[`src/polyself.c`](file:///c:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/src/polyself.c) の変身シーケンス（`polymon()`）において、以下の事象が連鎖的に発生します。

### 4.1. 防具・武器の強制脱落 (`break_armor()` / `drop_weapon()`)
- `nohands(uptr)` または `verysmall(uptr)` の場合：
  - **手袋（Gloves）**: `"You drop your gloves!"` とともに床に落ちる。
  - **武器・二刀流武器**: `"You drop your weapon!"` とともに手放す。
  - **盾（Shield）**: `"You can no longer hold your shield!"` とともに床に落ちる。
  - **兜（Helm）**: `"Your helmet falls to the floor!"` とともに床に落ちる。
  - **靴（Boots）**: `"Your boots are pushed off your feet!"` と脱落する。
  - ※鎧・クローク・シャツは体型・サイズ差（`breakarm` / `sliparm`）により破れるか脱げ落ちます。

### 4.2. 筋力（STR）ボーナスの強制剥奪
1. **力の小手（Gauntlets of Power）の喪失**:
   - 手袋が外れるため、STR 25 の固定補正が消え去ります。
2. **例外筋力のクランプ (`uasmon_maxStr()`)**:
   - 力持ちでないモンスターの場合、最大筋力が 18（`STR18(0)`）に制限されます。
   - `18/50` や `18/**` 等の例外筋力ボーナスは一時的に無効化され、素の STR も 18 以下に引き下げられます。
3. **基礎許容量の低下**:
   - 上記により、スケーリング前の $25 \times (\text{STR} + \text{CON}) + 50$ 自体が大幅に減少し、そこへさらに体重比率（10%〜28%）が乗算されます。

### 4.3. コンテナ（バッグ類）の操作遮断
- 手がない状態では、`#loot` コマンドや `apply` による袋の開閉（`ContainerModal` / IRC 相当の操作）ができません（`pickup.c: u_handsy()` により `"You have no hands!"` と判定される）。
- そのため、軽量化の鞄（Bag of Holding）に荷物を詰め込んで重さを 1/4 や 1/2 に減らす緊急避難が取れなくなります。

---

## 5. 負荷状態（Encumbrance / `BL_CAP`）の判定式

NetHack では、所持品全体の総重量と `weight_cap()` の差分から負荷状態を判定します（[`src/hack.c` の `calc_capacity()`](file:///c:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/src/hack.c#L4371-L4382)）：

```c
int wt = inv_weight();  /* 所持品総重量 - weight_cap() */
if (wt <= 0) return UNENCUMBERED;  /* 0: Normal */
cap = (wt * 2 / gw.wc) + 1;
return min(cap, OVERLOADED);
```

| `BL_CAP` 値 | 状態名 | 内部判定閾値 | プレイヤーへの影響 |
| :---: | :--- | :--- | :--- |
| **0** | **Unencumbered (通常)** | $\text{総重量} \le \text{許容量}$ | 影響なし |
| **1** | **Burdened (負担)** | $\text{許容量} < \text{総重量} \le 1.5 \times \text{許容量}$ | 移動速度低下 |
| **2** | **Stressed (重荷)** | $1.5 \times \text{許容量} < \text{総重量} \le 2.0 \times \text{許容量}$ | 移動速度大幅低下、祈り不可 |
| **3** | **Strained (過重)** | $2.0 \times \text{許容量} < \text{総重量} \le 2.5 \times \text{許容量}$ | 飢餓進行、飛び降り危険 |
| **4** | **Overtaxed (過重負荷)** | $2.5 \times \text{許容量} < \text{総重量} \le 3.0 \times \text{許容量}$ | 移動ごとにHP減少の恐れ |
| **5** | **Overloaded (過負荷)** | $3.0 \times \text{許容量} < \text{総重量}$ | **移動不可（1歩も動けない）** |

小犬に変身して許容量が 800 から **82** に落ちると、手持ちのアイテム重量が 250（巻物・ポーション・杖・食料など）あるだけで $250 \div 82 \approx 3.05$ 倍となり、**即座に Overloaded（完全行動不能）** に陥ります。

---

## 6. フロントエンド（WebUI / GKL）アーキテクチャへの示唆

本調査結果に基づき、[`Encumbrance_and_Weight_Management_Architecture.md`](../3_gkl/Encumbrance_and_Weight_Management_Architecture.md) の設計方針が正しいことが裏付けられました：

1. **変身時（Upolyd 時）にフロントエンド側で詳細許容量を再計算しない**:
   - モンスター全種の体重（`cwt`）、`M2_STRONG` フラグ、装備強制脱落の追従、例外筋力解除をフロントエンド側（JavaScript）で再実装することは、保守コストとバグリスクを跳ね上げます。
2. **`BL_CAP` ハイブリッド連動モデルの優位性**:
   - 変身時、フロントエンドの推定式がズレても、C コアから送信されるステータス `BL_CAP`（1〜5）が「危険・過負荷」を検知した瞬間に、UI 側のランプ・警告色を強制的に確定状態へ引き上げる設計により、表示矛盾なくプレイヤーに正確な危険度を通知できます。
