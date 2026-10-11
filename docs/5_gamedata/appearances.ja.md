---
title: appearances.ja
status: active
last_updated: 2026-10-11
related_code:
  - src/core/knowledge/state/DiscoveryStateManager.js
  - src/core/knowledge/engines/ItemIdentificationResolver.js
  - src/driver/shim/shim_bridge.c
---

# NetHack アイテム出現名（エイリアス名）と外見シャッフル仕様

NetHackにおいて、未識別状態で表示されるアイテムの外見や素材（エイリアス名：`oc_descr`）のリストと、ゲーム開始時のシャッフル仕様です。

> [!IMPORTANT]
> **外見の「シャッフル対象」と「固定対象」の違い（`o_init.c: shuffle_all()`）**
> * **シャッフルされる外見グループ**:
>   薬 (Potions)・巻物 (Scrolls)・指輪 (Rings)・杖 (Wands)・魔除け (Amulets)・魔法書 (Spellbooks)・宝石 (Gems)、および防具の一部（兜・外套・盾・**手袋**・**靴**）は、新規ゲーム開始時にグループ内で `objects[otyp].oc_descr_idx` がランダムにシャッフルされます。
>   * 例：手袋の4種（`leather gloves` / `gauntlets of fumbling` / `gauntlets of power` / `gauntlets of dexterity`）に対して、`old gloves` / `padded gloves` / `riding gloves` / `fencing gloves` のどれが割り当てられるかは**毎ゲーム異なります**。
> * **固定外見（非シャッフル）グループ**:
>   武器（例：`samurai sword` = `katana`）や道具（例：`looking glass` = `mirror`）などの未識別外見は、`oc_descr_idx == otyp` で固定されており、ゲームごとに変化しません。
> * **Wasm-JS 間の同期方式**:
>   Cコアが送出する `glyphId` やインベントリの `onum` は常に「真のアイテム番号（`otyp`）」であるため、WebUI 側では `SHIM_CMD_DUMP_DESCR_INDEXES (0x62)` によって `objects[0..NUM_OBJECTS].oc_descr_idx` 配列を直接同期し、未識別名称およびタイル画像（[glyph_tile_mapping.ja.md](file:///C:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/docs/5_gamedata/glyph_tile_mapping.ja.md) 参照）の両方を補正しています。

## 1. 薬 (Potions) - 液体の色や状態

*   ruby (ルビー色の)
*   pink (ピンク色の)
*   orange (オレンジ色の)
*   yellow (黄色の)
*   emerald (エメラルド色の)
*   dark green (濃い緑色の)
*   cyan (シアン色の)
*   sky blue (空色の)
*   brilliant blue (鮮やかな青色の)
*   magenta (マゼンタ色の)
*   purple-red (紫がかった赤の)
*   puce (暗褐色の)
*   milky (乳白色の)
*   swirly (渦巻いた)
*   bubbly (泡立つ)
*   smoky (煙った)
*   cloudy (濁った)
*   effervescent (弾ける)
*   black (黒色の)
*   golden (金色の)
*   brown (茶色の)
*   fizzy (シュワシュワする)
*   dark (暗い色の)
*   white (白色の)
*   murky (泥り)
*   clear (透明な) ※水

## 2. 指輪 (Rings) - 素材や形状
*   wooden (木製の)
*   granite (花崗岩の)
*   opal (オパール製の)
*   clay (粘土製の)
*   coral (珊瑚製の)
*   black onyx (ブラックオニキス製の)
*   moonstone (ムーンストーン製の)
*   tiger eye (タイガーアイ製の)
*   jade (翡翠製の)
*   bronze (青銅製の)
*   agate (瑪瑙製の)
*   topaz (トパーズ製の)
*   sapphire (サファイア製の)
*   ruby (ルビー製の)
*   diamond (ダイヤモンド製の)
*   pearl (真珠製の)
*   iron (鉄製の)
*   brass (真鍮製の)
*   copper (銅製の)
*   twisted (ねじれた)
*   steel (鋼鉄製の)
*   silver (銀製の)
*   gold (金製の)
*   ivory (象牙製の)
*   emerald (エメラルド製の)
*   wire (針金状の)
*   engagement (婚約の)
*   shiny (輝く)

## 3. 魔法書 (Spellbooks) - 表紙やページの状態
*   parchment (羊皮紙の)
*   vellum (上質皮紙の)
*   ragged (ぼろぼろの)
*   dog eared (耳折れの)
*   mottled (斑点のある)
*   stained (汚れた)
*   cloth (布製の)
*   leathery (革のような)
*   white (白の)
*   pink (ピンクの)
*   red (赤の)
*   orange (オレンジの)
*   yellow (黄の)
*   velvet (ベルベットの)
*   light green (明るい緑の)
*   dark green (濃い緑の)
*   turquoise (ターコイズの)
*   cyan (シアンの)
*   light blue (明るい青の)
*   dark blue (濃い青の)
*   indigo (藍色の)
*   magenta (マゼンタの)
*   purple (紫の)
*   violet (スミレ色の)
*   tan (黄褐色の)
*   plaid (格子縞の)
*   light brown (明るい茶色の)
*   dark brown (濃い茶色の)
*   gray (灰色の)
*   wrinkled (しわくちゃの)
*   dusty (埃っぽい)
*   bronze (青銅の)
*   copper (銅の)
*   silver (銀の)
*   gold (金の)
*   glittering (きらめく)
*   shining (光り輝く)
*   dull (鈍い色の)
*   thin (薄い)
*   thick (厚い)
*   checkered (市松模様の)
*   paperback (ペーパーバックの)
*   papyrus (パピルスの)

## 4. 杖 (Wands) - 素材や形状
*   glass (ガラスの)
*   balsa (バルサ材の)
*   crystal (水晶の)
*   maple (カエデの)
*   pine (松の)
*   oak (樫の)
*   ebony (コクタンの)
*   marble (大理石の)
*   tin (錫の)
*   brass (真鍮の)
*   copper (銅の)
*   silver (銀の)
*   platinum (白金の)
*   iridium (イリジウムの)
*   zinc (亜鉛の)
*   aluminum (アルミニウムの)
*   uranium (ウランの)
*   iron (鉄の)
*   steel (鋼鉄の)
*   hexagonal (六角形の)
*   short (短い)
*   runed (ルーンの刻まれた)
*   long (長い)
*   curved (曲がった)
*   forked (二股の)
*   spiked (スパイク付きの)
*   jeweled (宝石を散りばめた)

## 5. アミュレット (Amulets) - 形状
*   circular (円形の)
*   spherical (球体の)
*   oval (楕円形の)
*   triangular (三角形の)
*   pyramidal (ピラミッド型の)
*   square (四角形の)
*   concave (凹型の)
*   hexagonal (六角形の)
*   octagonal (八角形の)
*   perforated (穴の空いた)
*   cubical (立方体の)

## 6. 防具 (Armor) ※固定外見とシャッフル対象が混在
*   **兜 (Helmets)**
    *   **[固定外見: 1対1]**
        *   leather hat (革の帽子) — `fedora` (`onum 89`)
        *   iron skull cap (鉄のどてら帽) — `dented pot` (`onum 91`)
        *   hard hat (安全ヘルメット) — `dwarvish iron helm` (`onum 93`)
        *   conical hat (円錐形の帽子) — `cornuthaum` (`onum 94`)
        *   crystal helmet (水晶の兜) — `helm of brilliance` (`onum 96`) ※シャッフル対象外！
    *   **[シャッフル対象: `onum 97〜100` (`HELMET`〜`HELM_OF_TELEPATHY` 4種)]**
        *   plumed helmet (羽飾りの兜)
        *   etched helmet (エッチングされた兜)
        *   crested helmet (前立てのある兜)
        *   visored helmet (面頬付きの兜)
*   **外套 (Cloaks)**
    *   **[固定外見: 1対1]**
        *   faded pall (色あせた覆い) — `mummy wrapping` (`onum 139`)
        *   coarse mantelet (粗い外衣) — `orcish cloak` (`onum 140`)
        *   hooded cloak (フード付き外套) — `dwarvish cloak` (`onum 141`)
        *   slippery cloak (滑りやすい外套) — `oilskin cloak` (`onum 142`)
        *   apron (エプロン) — `alchemy smock` (`onum 144`)
    *   **[シャッフル対象: `onum 146〜149` (`CLOAK_OF_PROTECTION`〜`CLOAK_OF_DISPLACEMENT` 4種)]**
        *   tattered cape (ぼろぼろのケープ)
        *   opera cloak (オペラマント)
        *   ornamental cope (装飾的な典礼用マント)
        *   piece of cloth (布切れ)
*   **盾 (Shields) [すべて固定外見・シャッフルなし]**
    *   wooden shield (木の盾) — **[固定共有]** `small shield` / `elven shield` / `Uruk-hai shield` (`onum 150〜152`)
    *   red-eyed shield (赤い目のついた盾) — `orcish shield` (`onum 155`)
    *   large round shield (大きな円形の盾) — `dwarvish roundshield` (`onum 157`)
    *   polished silver shield (磨かれた銀の盾) — `shield of reflection` (`onum 158`)
*   **手袋 (Gloves) [すべてシャッフル対象: `onum 159〜162` (`LEATHER_GLOVES`〜`GAUNTLETS_OF_DEXTERITY` 4種)]**
    *   old gloves (古い手袋)
    *   padded gloves (パッド入りの手袋)
    *   riding gloves (乗馬用の手袋)
    *   fencing gloves (フェンシング用の手袋)
*   **靴 (Boots)**
    *   **[固定外見: 1対1]**
        *   walking shoes (ウォーキングシューズ) — `low boots` (`onum 163`)
        *   hard shoes (固い靴) — `iron shoes` (`onum 164`)
        *   jackboots (長靴) — `high boots` (`onum 165`)
    *   **[シャッフル対象: `onum 166〜172` (`SPEED_BOOTS`〜`LEVITATION_BOOTS` 7種)]**
        *   combat boots (コンバットブーツ)
        *   jungle boots (ジャングルブーツ)
        *   hiking boots (ハイキングブーツ)
        *   mud boots (泥靴)
        *   buckled boots (バックル付きの靴)
        *   riding boots (乗馬靴)
        *   snow boots (スノーブーツ)

## 7. 道具 (Tools) [すべて固定外見（一部複数アイテムで共有）]
*   bag (袋) — **[固定共有]** `sack` / `oilskin sack` / `bag of holding` / `bag of tricks` (`onum 217〜220`)
*   key (鍵) — `skeleton key` (`onum 221`)
*   candle (蝋燭) — **[固定共有]** `tallow candle` / `wax candle` (`onum 224〜225`)
*   lamp (ランプ) — **[固定共有]** `oil lamp` / `magic lamp` (`onum 227〜228`)
*   looking glass (手鏡) — `mirror` (`onum 230`)
*   glass orb (ガラスの球) — `crystal ball` (`onum 231`)
*   whistle (笛) — **[固定共有]** `tin whistle` / `magic whistle` (`onum 245〜246`)
*   flute (フルート) — **[固定共有]** `wooden flute` / `magic flute` (`onum 247〜248`)
*   horn (角笛) — **[固定共有]** `tooled horn` / `frost horn` / `fire horn` / `horn of plenty` (`onum 249〜252`)
*   harp (竪琴) — **[固定共有]** `wooden harp` / `magic harp` (`onum 253〜254`)
*   drum (太鼓) — **[固定共有]** `leather drum` / `drum of earthquake` (`onum 257〜258`)

## 8. 武器 (Weapons) [すべて固定外見（出身種族・特殊名のみ未識別）]
*   runed ... (ルーンの刻まれた...) — エルフ製武器 (`elven dagger` / `elven spear` / `elven short sword` / `elven broadsword` / `elven bow` / `elven arrow`)
*   crude ... (粗末な...) — オーク製武器 (`orcish dagger` / `orcish spear` / `orcish short sword` / `orcish bow` / `orcish arrow`)
*   bamboo ... (竹製の...) — `ya` (`bamboo arrow`, `onum 58`)
*   throwing star (手裏剣) — `shuriken` (`onum 34`)
*   throwing spear (投げ槍) — `javelin` (`onum 22`)
*   double-headed axe (両刃の斧) — `battle-axe` (`onum 28`)
*   broad ... (幅広の...) — ドワーフ製武器 (`dwarvish spear` / `dwarvish short sword` / `dwarvish mattock`)
*   curved sword (曲刀) — `scimitar` (`onum 31`)
*   samurai sword (侍の刀) — `katana` (`onum 37`)
*   long samurai sword (侍の長刀) — `tsurugi` (`onum 38`)
*   vulgar polearm (低俗な長柄武器) — `partisan` (`onum 40`)
*   hilted polearm (柄のある長柄武器) — `ranseur` (`onum 41`)
*   forked polearm (二股の長柄武器) — `spetum` (`onum 42`)
*   single-edged polearm (片刃の長柄武器) — `glaive` (`onum 43`)
*   angled poleaxe (角度のついた戦斧) — `halberd` (`onum 45`)
*   long poleaxe (長い戦斧) — `bardiche` (`onum 46`)
*   pole cleaver (長柄の包丁) — `voulge` (`onum 47`)
*   pole sickle (長柄の鎌) — `fauchard` (`onum 48`)
*   pruning hook (剪定用の鉤) — `guisarme` (`onum 49`)
*   hooked polearm (鉤のある長柄武器) — `bill-guisarme` (`onum 50`)
*   pronged polearm (先の分かれた長柄武器) — `lucern hammer` (`onum 51`)
*   beaked polearm (嘴状の長柄武器) — `bec de corbin` (`onum 52`)
*   broad pick (幅広のつるはし) — `dwarvish mattock` (`onum 69`)
*   staff (杖) — `quarterstaff` (`onum 71`)
*   thonged club (紐付きの棍棒) — `aklys` (`onum 72`)

## 9. 宝石・石 (Gems/Stones) [固定共有色 ＋ 一部ゲーム開始時ランダム色]
*   white (白い宝石) — `dilithium crystal`, `diamond`, `worthless piece of white glass`
*   red (赤い宝石) — `ruby`, `jasper`, `worthless piece of red glass`
*   orange (オレンジ色の宝石) — `jacinth`, `agate`, `worthless piece of orange glass`
*   blue (青い宝石) — `sapphire`, `worthless piece of blue glass` (+ 確率で `turquoise`, `aquamarine`, `fluorite`)
*   black (黒い宝石) — `black opal`, `obsidian`, `jet`, `worthless piece of black glass`
*   green (緑の宝石) — `emerald`, `jade`, `worthless piece of green glass` (+ 確率で `turquoise`, `aquamarine`, `fluorite`)
*   yellow (黄色い宝石) — `citrine`, `chrysoberyl`, `worthless piece of yellow glass`
*   yellowish brown (黄褐色の宝石) — `amber`, `topaz`, `worthless piece of yellowish brown glass`
*   violet (スミレ色の宝石) — `amethyst`, `worthless piece of violet glass` (+ 確率で `fluorite`)
*   **[色ランダム宝石 (`randomize_gem_colors()` によりゲーム開始時に決定)]**
    *   `turquoise` (`onum 446`) / `aquamarine` (`onum 448`) — 各50%で `green` または `blue`
    *   `fluorite` (`onum 457`) — 各25%で `green`, `blue`, `white`, `violet`
*   gray (灰色の石) — **[固定共有]** `luckstone`, `loadstone`, `touchstone`, `flint` (`onum 470〜473`)
