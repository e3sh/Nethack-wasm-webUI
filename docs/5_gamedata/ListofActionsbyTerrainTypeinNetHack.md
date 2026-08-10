# **NetHack地形別アクション一覧**

[https://gemini.google.com/app/d36d3aebd07a519d](https://gemini.google.com/app/d36d3aebd07a519d)

*User prompt: nethackで地形ごとにできるアクションを 足元の場合と 隣接している場合でそれぞれ可能アクションの一覧を作成したい*

Response: NetHackにおいて、足元（Stepping on / Sitting on）にある地形・オブジェクトに対して可能なアクションと、隣接（Adjacent / Next to）している場合に可能なアクションの一覧です。

## **1\. 足元にある場合に可能なアクション**

足元（.キーで自分の立ち位置を確認）にある地形や罠、オブジェクトに対して行える主なコマンド一覧です。

| 地形・現象 | コマンド（キー） | アクション・内容 |
| :---- | :---- | :---- |
| **アイテム全般** | , (pick up) | 足元のアイテムを拾う |
|  | \#loot | 袋や箱、宝箱の中身を漁る / 開ける |
|  | d (drop) | 手持ちのアイテムを足元に落とす |
|  | \#untrap | 罠がかかった箱を解除する |
| **階段（上り/下り）** | \< または \> | 階層を移動する（上る/下る） |
| **祭壇 (Altar)** | \#offer | 死体を捧げる（アライメントの向上・神の恩恵） |
|  | \#pray | 神に祈る（祭壇の上で祈るとより安全・効果的） |
|  | d (drop) | アイテムを置いて呪い/祝福（BUC）の判別をする |
| **水たまり / 泉 (Fountain)** | q (quaff) | 泉の水を飲む |
|  | \#dip | 泉の中に手持ちのアイテムを浸す（ポーションの洗う、剣の鍛え上げなど） |
|  | \#untrap | （毒針罠などが仕掛けられている場合）解除を試みる |
| **罠 (Traps)** | \#untrap | 足元の罠（ベアトラップ、矢の罠など）を解除する |
|  | \#sit | 罠に自ら座る（一部の罠で特殊効果） |
| **氷 (Ice)** | a (apply) | 氷上で特定の行動（スケート靴の使用など） |
|  | f (fire) / ポーション等 | 火炎攻撃で氷を溶かして水（プール）に変える |
| **シンク (Sink)** | \#sit | シンクの上に座る（指輪が流れるなどの特殊イベント） |
|  | q (quaff) | シンクから水を飲む |
|  | \#dip | シンクにアイテムを浸す |
| **床全般 (Floor)** | E (Engrave) | 床に文字を書く（Elberethによる魔よけ、指輪の識別） |
|  | \#sit | 床に座る |
|  | \#search | 足元を含めた周囲の隠し罠・隠し扉を探す |

## **2\. 隣接している場合に可能なアクション**

自分と1マス隣接（斜め含む8方向）している地形に対して行える主なコマンド一覧です。方向指定（h, j, k, l, y, u, b, n）を伴います。

| 地形・構造物 | コマンド（キー） | アクション・内容 |
| :---- | :---- | :---- |
| **壁 (Wall)** | s (search) | 隠し扉（Secret Door）を探す |
|  | a (apply) | ツルハシ（pick-axe）などで壁を掘削・破壊する |
|  | c (close) | （隠し扉を発見後）扉を閉める |
| **扉 (Door / Closed Door)** | o (open) | 閉まっている扉を開ける |
|  | c (close) | 開いている扉を閉める |
|  | ctrl \+ d (kick) | 扉を蹴破る（鍵がかかっている場合など） |
|  | a (apply) | 鍵（Key / Lock pick）やクレジットカードで解錠・施錠する |
|  | \#untrap | 扉に仕掛けられた罠を解除する |
| **水場 / プール / 溶岩 (Water / Lava)** | a (apply) | ツルハシ等で橋を架ける、または氷の杖（Wand of frost）で凍らせる |
|  | f (fire) / t (throw) | アイテムを水や溶岩の中に投げ込む |
| **樹木 (Tree)** | a (apply) | ツルハシや斧で切り倒す |
|  | ctrl \+ d (kick) | 木を蹴って実（ユーカリの葉や果物など）を落とす |
| **鉄格子 (Bars)** | a (apply) | 酸のポーションなどで溶かす / ツルハシで破壊を試みる |
|  | f (fire) / t (throw) | 隙間を通して遠距離攻撃や投げ攻撃を行う |
| **跳ね橋 (Drawbridge)** | a (apply) | 楽器（Bugle, Trumpet等）を鳴らして開閉する |
|  | ctrl \+ d (kick) | 叩いて振動させる |
| **お店の入口・カウンター** | p (pay) | 店主に対して買い物の支払方を行う |
| **全般（隣接地形共通）** | s (search) | 隠し罠や隠し通路の探索 |
|  | ctrl \+ d (kick) | 対象を蹴る |

### **アクションの補足ノート**

> * **\#untrap（罠解除コマンド）**: 足元だけでなく、**隣接している箱や扉**にかかっている罠を解除する際にも使用します。  
> * **ctrl \+ d（Kick / 蹴る）**: 扉や木だけでなく、足元の箱を蹴って開けたり（破錠）、壁を蹴ったりすることも可能です（足や靴のエンチャント状態に注意）。  
> * **E（Engrave / 刻む）**: 原則として**足元の床**に対してのみ行えます（木や壁には刻めません）。

---

*User prompt: NetHackの特定の地形や罠（祭壇、シンク、泉など）における詳細なアクションや効果について教えてください。*

Response: NetHackにおいて、特にプレイヤーの選択（コマンド）によって様々な効果や危険が生じる**特殊な地形・罠**についての詳細なアクションと効果のまとめです。

## **1\. 祭壇 (Altar)**

自分の神（アライメント）に捧げ物（\#offer）をする、または呪い/祝福（BUC）の識別をする重要な施設です。

### **主なアクションと効果**

> * **捧げ物 (\#offer)**  
  * **生の死体**を足元の祭壇で捧げます。  
  * **同アライメントの祭壇:** 神の好感度が上がり、Luck上昇、耐性付与、アーティファクトの下賜（ギフト）などの恩恵を得られます。  
  * **中立/他アライメントの祭壇:** 自分のアライメントへ「再改宗（Convert）」を試みることができます。成功すると自分の属性の祭壇に変化します。  
  * **注意:** 人間（Human）プレイヤーが人間や同族の死体を捧げると「人食い（Cannibalism）」のペナルティを受け、神の激怒やLuck激減を招きます。  
> * **BUC判別 (d でドロップ)**  
  * アイテムを祭壇の上に落とすだけで、そのアイテムが**Holy (緑/祝福)**、**Uncursed (白/未呪い)**、Unholy (赤/呪い)のいずれであるかがひと目で判別できます（識別コマンドや鑑定の巻物が不要）。  
> * **祈り (\#pray)**  
  * 祭壇の上で祈ると、神の好感度が高い場合に「聖水（Holy Water）」の作成や、安全なステータス回復などの特別な恩恵を受けやすくなります。

## **2\. シンク (Sink)**

ダンジョンの各所に存在する流し台です。水仕事や指輪に関する特殊な効果が発動します。

### **主なアクションと効果**

> * **飲む (q) / 水を浸す (\#dip)**  
  * 飲むと喉の渇きを癒せますが、たまに汚れで毒（毒耐性なしだとダメージ）を受けたり、指輪が排水口から湧き出たり、水のエレメンタル（Water Elemental）が出現したりします。  
  * アイテムを浸すと、ポーションのラベルが剥がれて「ただの水（Water）」に変化します。  
> * **座る (\#sit)**  
  * 手持ちの「識別されていない指輪」を1つランダムに排水口へ落として失うリスクがありますが、その指輪の種別が識別（Identify）されます。  
> * **蹴る (ctrl \+ d)**  
  * 一回蹴ると、指輪（Ring）やブラックプディング（Black Pudding）が湧き出ることがあります。  
  * 蹴りすぎるとシンクが破壊され、ただの「水たまり（Fountain/Pool）」に変化します。

## **3\. 泉 (Fountain)**

喉を潤したり、ポーションを作成したりできる水場です。ハイリスク・ハイリターンな要素が詰まっています。

### **主なアクションと効果**

> * **飲む (q)**  
  * 喉が渇いているときに飲むと腹持ちが良くなります。  
  * 一定確率で以下のイベントが発生します：  
    * **良い効果:** ステータス上昇（STR/CON等）、見えざるもの（Invisibility）付与、願望（Wish）を叶えてくれる魔人（Genie）の出現。  
    * **悪い効果:** 水のエレメンタルや蛇の大量発生、呪い、失明、泉の枯渇。  
> * **浸す (\#dip)**  
  * ただの水（Clear potion）を浸すと「聖水（Holy Water）」に変化させられる可能性があります（アライメントやLuckに依存）。  
  * 武器（特に長剣）を浸すと、神の恩恵で強力なアーティファクト「Excalibur」に変化することがあります（レベル5以上の騎士や秩序のアライメント限定）。  
> * **蹴る (ctrl \+ d)**  
  * 水が噴き出して周りのアイテムが濡れたり（巻物や魔法書が濡れて白紙になるリスク）、泉が枯れて穴（Pit）になったりします。

## **4\. 樹木 (Tree)**

庭園や地上階に生えている木です。食料確保や障害物の排除に利用します。

### **主なアクションと効果**

> * **蹴る (ctrl \+ d)**  
  * 木を蹴ると、一定確率で果物（AppleやPearなど）**や**ユーカリの葉（Eucalyptus leaf）が落ちてきます。食料確保に便利です。  
  * ただし、脚を痛めたり、蜂の巣が落ちてきてキラービー（Killer bee）に襲われる危険もあります。  
> * **伐採 (a でツルハシや斧を使用)**  
  * 木を切り倒して通行可能な床（.）に変えることができます。木材（Wood）を手に入れることも可能です。

## **5\. 危険な罠（Traps）への対処と活用**

足元や隣接マスに存在する罠は、解除するだけでなく利用することも可能です。

| 罠の種類 | アクションコマンド | 効果と詳細 |
| :---- | :---- | :---- |
| **ベアトラップ / 落とし穴 (Pit)** | \#untrap | 隣接または足元の罠を安全に解除・埋め立てを試みます（素手や道具を使用）。 |
|  | \#sit | 自ら穴やベアトラップに入り込む（モンスターの追撃から身を隠す・固定する）。 |
| **矢の罠 / 毒針の罠** | \#untrap | 解除に成功すると、仕掛けられていた**矢（Arrow）や毒針（Dart）を入手**できます。 |
| **テレポートの罠 (Teleport Trap)** | 移動して踏む | 一瞬で同階層のランダムな場所へワープします。緊急脱出や逃走に活用可能。 |
| **レベルワープの罠 (Level Teleporter)** | 移動して踏む | 別の階層へ移動します。階層移動のコントロール能力があれば目的地を指定可能です。 |
| **ポリモーフの罠 (Polymorph Trap)** | アイテムを投げる (t) | 罠の上に不要なアイテムや武器を投げ込むと、**別のランダムなアイテムに変化**します。 |

---

*User prompt: 地形を検出してガイダンスを出すことを考えています。（例：ボタンに割り当てなど）地形ごとに可能なアクションを列挙してください*

Response: NetHackでプレイヤーの足元や周囲の地形（Tile / Terrain feature）を検出し、ショートカットボタンやUIに操作ガイダンスを動的に表示するシステムを構築する場合の設計用一覧です。

各地形において「**足元（Stepping on）**」と「**隣接（Adjacent / 八方向）**」の状態で割り当てるべき主要なアクションを整理しました。

## **地形別コンテキストアクション一覧**

### **1\. 床・廊下（Floor / Corridor: ., \#）**

基本となるマップ地形です。

> * **足元:**  
  * E (Engrave) : 文字を刻む（Elberethによる魔除け、指輪の識別）  
  * , (Pick up) : 足元のアイテムを拾う（※アイテムが存在する場合）  
  * \#loot : 足元の箱/袋を開ける（※コンテナが存在する場合）  
  * \#sit : 床に座る  
  * d (Drop) : アイテムを落とす  
> * **隣接:**  
  * s (Search) : 隠し扉・隠し罠の探索  
  * ctrl \+ d (Kick) : 壁を蹴る（効果は薄いがコマンドとして存在）

### **2\. 階段（Stairs: \<, \>）**

階層移動の重要ポイントです。

> * **足元:**  
  * \< (Up) : 上り階段を上がる  
  * \> (Down) : 下り階段を下りる  
> * **隣接:**  
  * アクション特記なし（通常の攻撃・移動対象）

### **3\. 扉（Door: \+ 閉じた扉, | \- 開いた扉）**

ダンジョンの境界・部屋の入口です。

> * **足元:** （開いている扉の上に立つ場合）  
  * c (Close) : 足元の扉を閉める  
> * **隣接:**  
  * o (Open) : 扉を開ける（閉まっている場合）  
  * c (Close) : 扉を閉める（開いている場合）  
  * a (Apply) : 鍵やクレジットカードで解錠/施錠する  
  * ctrl \+ d (Kick) : 扉を蹴破る（施錠時や鍵がないとき）  
  * \#untrap : 扉に仕掛けられた罠の解除

### **4\. 壁・隠し扉（Wall / Secret Door: |, \-）**

ダンジョンの区切りです。

> * **足元:** 通常侵入不可（壁抜け能力保持時を除く）  
> * **隣接:**  
  * s (Search) : 隠し扉（Secret Door）を探す  
  * a (Apply) : ツルハシ（pick-axe）や採掘の杖（Wand of digging）で掘削・破壊する

### **5\. 祭壇（Altar: \_）**

アライメント管理や呪い識別を行う重要施設です。

> * **足元:**  
  * \#offer : 生の死体を捧げる（アライメント向上・神の恩恵）  
  * \#pray : 神に祈る  
  * d (Drop) : 置いてアイテムの呪い/祝福（BUC）を判別する  
> * **隣接:**  
  * アクション特記なし（通常は足元に立って操作）

### **6\. 泉（Fountain: {）**

ステータス変化やイベントが起きる水場です。

> * **足元:**  
  * q (Quaff) : 泉の水を飲む  
  * \#dip : アイテムを浸す（長剣を浸してExcalibur作成、聖水作成など）  
  * \#untrap : 毒針などの罠解除を試みる  
> * **隣接:**  
  * ctrl \+ d (Kick) : 泉を蹴る（水が吹き出す、枯れて穴になる）

### **7\. シンク（Sink: \# または固有シンボル）**

流し台です。

> * **足元:**  
  * q (Quaff) : シンクから水を飲む  
  * \#dip : アイテムを浸す（ポーションの洗う/白紙化）  
  * \#sit : 座る（手持ちの指輪を失うリスクと引き換えに識別）  
> * **隣接:**  
  * ctrl \+ d (Kick) : シンクを蹴る（指輪やプディングが湧く）

### **8\. 樹木（Tree: \# または T）**

庭園や地上階に生える木です。

> * **足元:** 通常侵入不可（木の上に昇るなどの特殊状態除く）  
> * **隣接:**  
  * ctrl \+ d (Kick) : 木を蹴る（果物やユーカリの葉を落とす）  
  * a (Apply) : ツルハシや斧で切り倒す

### **9\. 罠（Traps: ^）**

ダンジョン内に設置された各種罠です。

> * **足元:**  
  * \#untrap : 足元の罠の解除を試みる  
  * \#sit : 穴やベアトラップに自ら座る/入り込む  
> * **隣接:**  
  * \#untrap : 隣接する罠の解除を試みる  
  * s (Search) : 周囲の未発見の罠を探す

### **10\. 水場・溶岩・鉄格子（Water / Lava / Bars）**

特殊な通行障害です。

> * **足元:**  
  * （水場・溶岩の場合）水泳・浮遊・耐性がない場合ダメージまたは即死行動（コマンドというより状態維持）  
> * **隣接:**  
  * **水場/溶岩:** a (Apply) で氷の杖を使って凍らせる、ツルハシで橋を架ける  
  * **鉄格子:** a (Apply) で酸のポーション等を使って溶かす、f (Fire) で隙間越しに遠距離攻撃

## **ガイダンスUI設計時の実装ポイント**

> 1. **優先度の判定基準**  
   * **「足元にアイテムがあるか」**：床（.）であってもアイテムが存在する場合は , (Pick up) や \#loot を最優先ガイダンスとして表示。  
   * **「ドアの状態（開・閉・鍵）」**：隣接地形がドアの場合、ドアの状態フラグによって「開ける(o)」「閉める(c)」「蹴る(ctrl+d)」「鍵を使う(a)」を切り替える。  
> 2. **安全ガードの提示**  
   * 泉（Fountain）やシンク（Sink）での ctrl+d (Kick) や q (Quaff) はハイリスクな行動であるため、ガイダンス上で注意を促すコンテキストアイコン（警告マーク等）を付与する。  
> 3. **キーバインドのコンテキスト提示**  
   * 例：「\[\<\] 階段を上がる」「\[E\] 文字を刻む」「\[o\] 扉を開ける」のように、**検出地形＋実行可能キー＋アクション名**のセットでコンテキストメニューを自動生成する。

---

*User prompt: NetHackの地形コンテキストに応じた画面ボタン配置（タッチ操作やショートカットキー割り当て）の具体案を作成してください。*

Response: NetHackのコンテキスト（プレイヤーの足元・隣接状況）に応じて動的に変化する**画面UIボタン配置案およびショートカット割り当ての設計案**です。スマホ等のタッチ操作や、PCでのファンクションキー（F1〜F4）/クイックアクセストリガーにそのまま適用できる構造にしています。

## **1\. 画面レイアウト構成案**

画面下部（またはサイドバー）に、状況に応じて切り替わる「コンテキストアクション領域（4〜5枠）」**と、常に固定表示される**「基本アクション領域」を分離配置します。

`+-------------------------------------------------------------------+`  
`|                        ゲーム描画エリア                             |`  
`|                                                                   |`  
`| [@]: プレイヤー  [<]: 階段  [+]: 閉じた扉  [_]: 祭壇               |`  
`+-------------------------------------------------------------------+`  
`| 【動的コンテキストボタン】※周囲・足元の地形によって自動変化           |`  
`|  [ Action 1 ]  [ Action 2 ]  [ Action 3 ]  [ Action 4 ]          |`  
`+-------------------------------------------------------------------+`  
`| 【固定基本ボタン】                                                 |`  
`|  [ 移動/方向 ] [ 持ち物(i) ] [ 探す(s) ] [ 刻む(E) ] [ メニュー(#) ]|`  
`+-------------------------------------------------------------------+`

## **2\. 地形・状況別の動的ボタン配置セット**

プレイヤーが特定の地形の上に立っている（On）、または隣接している（Adjacent）ときに優先度順（左からAction 1〜4）で割り当てるボタン構成です。

### **1\. 床 / 廊下（Floor / Corridor）**

> * **足元にアイテム無し**  
  1. E : **刻む** (Engrave \- Elbereth等)  
  2. s : **探す** (Search)  
  3. \#sit : **座る** (Sit)  
  4. d : **落とす** (Drop)  
> * **足元にアイテムあり**  
  1. , : **拾う** (Pick up)  
  2. \#loot : **漁る** (Loot \- 箱・袋の場合)  
  3. E : **刻む** (Engrave)  
  4. \#untrap : **罠解除** (Un-trap \- 箱の罠解除)

### **2\. 階段（Stairs）**

> * **上り階段の上**  
  1. \< : **上がる** (Go up)  
  2. , : **拾う** (アイテムがある場合)  
  3. E : **刻む**  
  4. d : **落とす**  
> * **下り階段の上**  
  1. \> : **下りる** (Go down)  
  2. , : **拾う**  
  3. E : **刻む**  
  4. d : **落とす**

### **3\. 扉（Door）**

> * **閉じた扉に隣接**  
  1. o : **開ける** (Open)  
  2. a : **鍵を使う** (Apply key/pick)  
  3. ctrl+d : **蹴破る** (Kick)  
  4. \#untrap : **罠解除** (Un-trap)  
> * **開いた扉に隣接 / 足元**  
  1. c : **閉める** (Close)  
  2. s : **探す** (Search)  
  3. E : **刻む**  
  4. ctrl+d : **蹴る**

### **4\. 壁 / 隠し扉（Wall）**

> * **壁に隣接**  
  1. s : **隠し扉探す** (Search)  
  2. a : **採掘する** (Apply pick-axe/wand)  
  3. ctrl+d : **蹴る**  
  4. *(空き/汎用)*

### **5\. 祭壇（Altar）**

> * **祭壇の上**  
  1. \#offer : **捧げる** (Offer corpse)  
  2. d : **BUC判別** (Drop item)  
  3. \#pray : **祈る** (Pray)  
  4. , : **拾う**

### **6\. 泉（Fountain）**

> * **泉の上**  
  1. q : **飲む** (Quaff)  
  2. \#dip : **浸す** (Dip item \- 聖水/Excalibur)  
  3. \#untrap : **罠解除**  
  4. ctrl+d : **蹴る** *(※警告表示推奨)*

### **7\. シンク（Sink）**

> * **シンクの上**  
  1. \#sit : **座る/指輪識別** (Sit)  
  2. q : **飲む** (Quaff)  
  3. \#dip : **浸す** (Dip \- ポーション洗う)  
  4. ctrl+d : **蹴る** *(※警告表示推奨)*

### **8\. 樹木（Tree）**

> * **樹木に隣接**  
  1. ctrl+d : **蹴る** (Kick \- 木の実を落とす)  
  2. a : **伐採する** (Apply axe/pick)  
  3. s : **探す**  
  4. *(空き/汎用)*

### **9\. 罠（Trap）**

> * **罠の上 / 隣接**  
  1. \#untrap : **罠解除** (Un-trap)  
  2. \#sit : **ハマる/座る** (Sit)  
  3. s : **周囲探す** (Search)  
  4. *(空き/汎用)*

## **3\. UI/UX制御アルゴリズムの仕様案**

ボタンを自動生成・表示するための内部フラグ処理ロジックです。

`[毎ターン更新処理]`  
`1. PlayerPos（プレイヤー位置）のTileTypeを取得`  
`2. PlayerPos（足元）のItemCountおよびContainerTypeを取得`  
`3. AdjacentPos（周囲8マス）のTileTypeおよびDoorStateを取得`

`IF (足元にアイテムあり) {`  
    `PrimaryAction = PickUp (,)`  
`} ELSE IF (TileType == ALTAIR) {`  
    `PrimaryAction = Offer (#offer)`  
`} ELSE IF (TileType == STAIR_UP) {`  
    `PrimaryAction = GoUp (<)`  
`} ELSE IF (隣接地に CLOSED_DOOR あり) {`  
    `PrimaryAction = Open (o)`  
`} ...`

## **4\. 特殊アクションに対する安全設計（誤操作防止）**

NetHackでは一部の地形アクションで即死・致命的なリスク（泉でのエレメンタル出現、不調時の神への祈りなど）が発生するため、以下の視覚演出・タップガードを実装することを推奨します。

| アクション | リスク | UI上の対策 |
| :---- | :---- | :---- |
| **\#pray (祈る)** | 頻繁に祈ると神の激怒で即死 | ボタン背景を**赤色**にし、タップ時に「本当に祈りますか？」のコンファームダイアログを表示（神の怒りタイマー管理時のみ無効化）。 |
| **ctrl+d (泉/シンクを蹴る)** | 水没・強力なモンスター出現 | ボタン縁に\*\*危険マーク（⚠）\*\*を表示。長押しでのみ発動する仕様にする。 |
| **\#offer (人間死体の献上)** | 人食いペナルティ | 持ち物の中に同族（Human）の死体しかない場合、ボタンを\*\*グレーアウト（非活性化）\*\*する。 |

---

*User prompt: NetHackの地形コンテキストボタンUIを実装するためのHTML/CSS/JavaScript（またはReact/Vue等）のコンポーネントコード案を作成してください。*

Response: NetHackの地形や足元の状況を自動判定し、動的にアクションボタンを切り替えるWebベースのUIコンポーネント案です。Vanilla JavaScript（HTML/CSS/JS）で記述しているため、そのまま動作確認が可能です。

### **実装コード（HTML / CSS / JavaScript）**

`<!DOCTYPE html>`  
`<html lang="ja">`  
`<head>`  
  `<meta charset="UTF-8">`  
  `<title>NetHack Contextual UI Sample</title>`  
  `<style>`  
    `:root {`  
      `--bg-color: #121212;`  
      `--panel-bg: #1e1e1e;`  
      `--btn-bg: #2a2a2a;`  
      `--btn-hover: #3a3a3a;`  
      `--text-color: #e0e0e0;`  
      `--accent-color: #4caf50;`  
      `--danger-color: #f44336;`  
      `--warning-color: #ff9800;`  
    `}`

    `body {`  
      `background-color: var(--bg-color);`  
      `color: var(--text-color);`  
      `font-family: 'Courier New', Courier, monospace;`  
      `margin: 0;`  
      `padding: 20px;`  
      `display: flex;`  
      `flex-direction: column;`  
      `align-items: center;`  
    `}`

    `/* ゲーム画面・マップ表現用スタイル */`  
    `#game-container {`  
      `background: #000;`  
      `border: 2px solid #444;`  
      `padding: 10px;`  
      `margin-bottom: 20px;`  
      `width: 320px;`  
      `text-align: center;`  
    `}`

    `.status-bar {`  
      `color: #888;`  
      `font-size: 14px;`  
      `margin-bottom: 10px;`  
    `}`

    `/* コンテキストボタンエリア */`  
    `.ui-container {`  
      `background: var(--panel-bg);`  
      `border: 1px solid #333;`  
      `border-radius: 8px;`  
      `padding: 16px;`  
      `width: 360px;`  
      `box-shadow: 0 4px 10px rgba(0,0,0,0.5);`  
    `}`

    `.ui-title {`  
      `font-size: 12px;`  
      `color: #888;`  
      `text-transform: uppercase;`  
      `letter-spacing: 1px;`  
      `margin-bottom: 12px;`  
    `}`

    `.action-grid {`  
      `display: grid;`  
      `grid-template-columns: repeat(2, 1fr);`  
      `gap: 10px;`  
    `}`

    `/* ボタンデザイン */`  
    `.action-btn {`  
      `background: var(--btn-bg);`  
      `border: 1px solid #444;`  
      `border-radius: 6px;`  
      `color: var(--text-color);`  
      `padding: 12px 8px;`  
      `font-family: inherit;`  
      `font-size: 14px;`  
      `cursor: pointer;`  
      `display: flex;`  
      `flex-direction: column;`  
      `align-items: center;`  
      `gap: 4px;`  
      `transition: all 0.15s ease;`  
      `position: relative;`  
    `}`

    `.action-btn:hover {`  
      `background: var(--btn-hover);`  
      `border-color: #666;`  
    `}`

    `.action-btn:active {`  
      `transform: scale(0.98);`  
    `}`

    `.action-btn .key-badge {`  
      `background: #111;`  
      `border: 1px solid #555;`  
      `border-radius: 3px;`  
      `padding: 1px 5px;`  
      `font-size: 11px;`  
      `color: var(--accent-color);`  
      `font-weight: bold;`  
    `}`

    `/* 危険度別の装飾 */`  
    `.action-btn.danger {`  
      `border-color: var(--danger-color);`  
    `}`  
    `.action-btn.danger .key-badge {`  
      `color: var(--danger-color);`  
    `}`

    `.action-btn.warning {`  
      `border-color: var(--warning-color);`  
    `}`  
    `.action-btn.warning .key-badge {`  
      `color: var(--warning-color);`  
    `}`

    `/* シミュレーション切り替え用デモコントローラー */`  
    `.demo-controls {`  
      `margin-top: 30px;`  
      `padding: 10px;`  
      `background: #222;`  
      `border-radius: 6px;`  
      `text-align: center;`  
    `}`  
    `.demo-controls select {`  
      `background: #333;`  
      `color: #fff;`  
      `padding: 5px;`  
      `border: 1px solid #555;`  
    `}`  
  `</style>`  
`</head>`  
`<body>`

  `<!-- ゲーム状態表示枠（簡易デモ用） -->`  
  `<div id="game-container">`  
    `<div class="status-bar" id="terrain-desc">現在地: 床</div>`  
    `<div id="map-display" style="font-size: 24px;">. @ .</div>`  
  `</div>`

  `<!-- 地形コンテキスト依存 UI パネル -->`  
  `<div class="ui-container">`  
    `<div class="ui-title">Context Actions</div>`  
    `<div class="action-grid" id="action-grid">`  
      `<!-- JavaScriptにより動的にボタンが差し込まれます -->`  
    `</div>`  
  `</div>`

  `<!-- テスト用コンテキスト切替セレクター -->`  
  `<div class="demo-controls">`  
    `<label for="state-selector">マップ状態の変更（テスト用）: </label>`  
    `<select id="state-selector" onchange="changeState(this.value)">`  
      `<option value="floor_empty">1. 床 (アイテムなし)</option>`  
      `<option value="floor_item">2. 床 (アイテムあり)</option>`  
      `<option value="stair_down">3. 下り階段の上</option>`  
      `<option value="door_closed">4. 閉じた扉に隣接</option>`  
      `<option value="altar">5. 祭壇の上</option>`  
      `<option value="fountain">6. 泉の上</option>`  
      `<option value="sink">7. シンクの上</option>`  
    `</select>`  
  `</div>`

  `<script>`  
    `// ----------------------------------------------------`  
    `// 1. 地形・状況別のアクション定義テーブル`  
    `// ----------------------------------------------------`  
    `const ACTION_TABLE = {`  
      `floor_empty: {`  
        `desc: "現在地: 床",`  
        `map: ". @ .",`  
        `actions: [`  
          `{ key: "E", label: "刻む (Engrave)", cmd: "Engrave" },`  
          `{ key: "s", label: "探す (Search)", cmd: "Search" },`  
          `{ key: "#sit", label: "座る (Sit)", cmd: "Sit" },`  
          `{ key: "d", label: "落とす (Drop)", cmd: "Drop" }`  
        `]`  
      `},`  
      `floor_item: {`  
        `desc: "現在地: 床 (アイテムあり)",`  
        `map: "% @ .",`  
        `actions: [`  
          `{ key: ",", label: "拾う (Pick up)", cmd: "PickUp" },`  
          `{ key: "#loot", label: "漁る (Loot)", cmd: "Loot" },`  
          `{ key: "E", label: "刻む (Engrave)", cmd: "Engrave" },`  
          `{ key: "d", label: "落とす (Drop)", cmd: "Drop" }`  
        `]`  
      `},`  
      `stair_down: {`  
        `desc: "現在地: 下り階段",`  
        `map: ". @ >",`  
        `actions: [`  
          `{ key: ">", label: "下りる (Go down)", cmd: "GoDown" },`  
          `{ key: ",", label: "拾う (Pick up)", cmd: "PickUp" },`  
          `{ key: "E", label: "刻む (Engrave)", cmd: "Engrave" },`  
          `{ key: "d", label: "落とす (Drop)", cmd: "Drop" }`  
        `]`  
      `},`  
      `door_closed: {`  
        `desc: "状況: 閉じた扉に隣接",`  
        `map: ". @ +",`  
        `actions: [`  
          `{ key: "o", label: "開ける (Open)", cmd: "Open" },`  
          `{ key: "a", label: "鍵を使う (Unlock)", cmd: "ApplyKey" },`  
          `{ key: "C-d", label: "蹴破る (Kick)", cmd: "Kick", risk: "warning" },`  
          `{ key: "#untrap", label: "罠解除 (Un-trap)", cmd: "Untrap" }`  
        `]`  
      `},`  
      `altar: {`  
        `desc: "現在地: 祭壇",`  
        `map: ". @ _",`  
        `actions: [`  
          `{ key: "#offer", label: "捧げる (Offer)", cmd: "Offer" },`  
          `{ key: "d", label: "BUC判別 (Drop)", cmd: "Drop" },`  
          `{ key: "#pray", label: "祈る (Pray)", cmd: "Pray", risk: "danger" },`  
          `{ key: ",", label: "拾う (Pick up)", cmd: "PickUp" }`  
        `]`  
      `},`  
      `fountain: {`  
        `desc: "現在地: 泉",`  
        `map: ". @ {",`  
        `actions: [`  
          `{ key: "q", label: "飲む (Quaff)", cmd: "Quaff", risk: "warning" },`  
          `{ key: "#dip", label: "浸す (Dip)", cmd: "Dip" },`  
          `{ key: "#untrap", label: "罠解除 (Un-trap)", cmd: "Untrap" },`  
          `{ key: "C-d", label: "蹴る (Kick)", cmd: "Kick", risk: "danger" }`  
        `]`  
      `},`  
      `sink: {`  
        `desc: "現在地: シンク",`  
        `map: ". @ #",`  
        `actions: [`  
          `{ key: "#sit", label: "座る/指輪識別", cmd: "SitSink" },`  
          `{ key: "q", label: "飲む (Quaff)", cmd: "Quaff", risk: "warning" },`  
          `{ key: "#dip", label: "浸す (Dip)", cmd: "Dip" },`  
          `{ key: "C-d", label: "蹴る (Kick)", cmd: "Kick", risk: "warning" }`  
        `]`  
      `}`  
    `};`

    `// ----------------------------------------------------`  
    `// 2. UIレンダリング関数`  
    `// ----------------------------------------------------`  
    `function renderUI(stateKey) {`  
      `const state = ACTION_TABLE[stateKey];`  
      `if (!state) return;`

      `// ゲーム画面テキストの更新`  
      `document.getElementById("terrain-desc").textContent = state.desc;`  
      `document.getElementById("map-display").textContent = state.map;`

      `const grid = document.getElementById("action-grid");`  
      `grid.innerHTML = ""; // 初期化`

      `// コンテキストアクションボタンの動的生成`  
      `state.actions.forEach(action => {`  
        `const btn = document.createElement("button");`  
        ``btn.className = `action-btn ${action.risk || ""}`;``  
          
        `// ボタン内部要素（キーバッジ＋アクション名）`  
        `` btn.innerHTML = ` ``  
          `<span class="key-badge">${action.key}</span>`  
          `<span>${action.label}</span>`  
        `` `; ``

        `// クリックハンドラとガード処理`  
        `btn.onclick = () => handleAction(action);`

        `grid.appendChild(btn);`  
      `});`  
    `}`

    `// ----------------------------------------------------`  
    `// 3. アクション実行・安全ガード処理`  
    `// ----------------------------------------------------`  
    `function handleAction(action) {`  
      `// 危険なアクションに対するモーダル代わりのコンファーム`  
      `if (action.risk === "danger") {`  
        ``const confirmState = confirm(`【注意】${action.label} はリスクを伴う行動です。実行しますか？`);``  
        `if (!confirmState) return;`  
      `}`

      `// NetHackコアへコマンド送信（想定ログ）`  
      ``console.log(`[Command Sent]: ${action.key} (${action.cmd})`);``  
      ``alert(`コマンド送信: [ ${action.key} ] -> ${action.label}`);``  
    `}`

    `// デモ状態切り替え`  
    `function changeState(newState) {`  
      `renderUI(newState);`  
    `}`

    `// 初期化実行`  
    `renderUI("floor_empty");`  
  `</script>`  
`</body>`  
`</html>`

### **コンポーネント設計のポイント**

> 1. **データ駆動によるボタンの動的生成 (ACTION\_TABLE)**  
   * マップエンジン側のロジック（プレイヤーの座標と Map\[x\]\[y\] のタイル情報）からコンテキスト文字列を渡すことで、レンダリング関数 renderUI() が自動的に適切な4つのアクションボタンを生成します。  
> 2. **リスク度（risk プロパティ）に応じたビジュアルフィードバック**  
   * risk: "warning"（オレンジ枠）や risk: "danger"（赤枠）をテーブル内に持たせ、CSSクラスを付与することで、泉の蹴り落としや祈りなどの誤タップ即死リスクを視覚的に警告します。  
> 3. **キーバインドバッジ表示**  
   * スマホのタップ操作だけでなく、PCでのキーボード操作ユーザーが直感的にショートカットキーを把握できるよう、コマンドバッジ（\[E\] や \[\#sit\]）を強調表示しています。

---

