# NetHack 5.0 店・店主名生成仕様と考察・辞書対応資料 (Shopkeeper Spec & Trivia)

## 1. 概要
本資料は、NetHack 5.0における店舗（Shop）および店主（Shopkeeper）の名前決定メカニズム、ソースコードにおける構造、名前の元ネタ（地名、アナグラム、歴史的オマージュ）、ならびに日本語WebUI (`Nethack-wasm-webUI`) における翻訳辞書 (`dictionary.csv`) への対応内容をまとめたものです。

---

## 2. ソースコードの構造とファイル構成

店舗および店主に関する定義・処理は主に以下のファイルで管理されています。

* **メイン処理・定義ファイル**: [src/shknam.c]
* **主な構成要素**:
  * `shtypes[]` : 店舗の種類、名称（正式名・略称）、取扱アイテムの出現確率、対応する店主名リストの紐付け。
  * `shkliquors`, `shkbooks`, `shkarmors`, `shkwands`, `shkrings`, `shkfoods`, `shkweapons`, `shktools`, `shklight`, `shkgeneral`, `shkhealthfoods` : 店主名文字列配列リスト。
  * `nameshk()` : 店主の生成時に名前・性別を割り当てる関数。

---

## 3. 店および店主の定義

### 3.1 店舗の種類 (`shtypes[]`)
NetHack 5.0には全12種類の店舗が用意されています。

| 正式な店舗名 (`name`) | 略称・概要用表示名 (`subname`) | 取り扱いアイテムの傾向 |
| :--- | :--- | :--- |
| **general store** | *(なし)* | 雑多なアイテム全般 |
| **used armor dealership** | `armor shop` | 防具全般（一部武器） |
| **second-hand bookstore** | `scroll shop` | 巻物（一部魔法書） |
| **liquor emporium** | `potion shop` | ポーション類全般 |
| **antique weapons outlet** | `weapon shop` | 武器全般（一部防具） |
| **delicatessen** | `food shop` | 食料・果汁・酒類 |
| **jewelers** | `ring shop` | 指輪・宝石・魔除け |
| **quality apparel and accessories** | `wand shop` | 杖（一部手袋・外套） |
| **hardware store** | `tool shop` | 道具全般 |
| **rare books** | `bookstore` | 魔法書（一部巻物） |
| **health food store** | `vegetarian food shop` | ベジタリアン向け食料・ポーション |
| **lighting store** | `lighting shop` | 蝋燭・ランプ・明かりの杖など |

### 3.2 店主名生成メカニズム (`nameshk`)
店主の名前は動的なランダム文字列生成ではなく、**あらかじめ定義された名前リスト（配列）からの選択方式**をとっています。

1. **シード・決定アルゴリズム**:
   * モンスターID (`m_id`)、ダンジョン階層番号 (`ledger_no`)、ゲーム開始時のタイムスタンプ (`ubirthday`) を用いてインデックスを算出。
   * セーブ・ロードによる影響を受けず、ゲームごとに適度なバリエーションが生まれる設計。
2. **性別・敬称の制御記号（接頭辞）**:
   名前リストの先頭文字には制御記号が含まれており、性別や敬称（Mr. / Ms.）を自動決定します。
   * `+` : 男性・個人名 (例: `+Dirk`, `+Izchak`)
   * `-` : 女性・個人名 (例: `-Lucrezia`)
   * `_` : 女性・一般名
   * `|` : 男性・一般名
   * `=` : 性別指定なし・個人名 (例: `=Azura`)

---

## 4. 店主名の元ネタと考察 (Trivia)

NetHackの店主名リストには、40年近くにおよぶゲームの歴史、地理、そして開発コミュニティへのオマージュが込められています。

### 4.1 実在地名モチーフ
店舗のテーマに合わせて、世界各地のマイナーな都市や地名が割り当てられています。

| 店の種類 | 対応配列 | 主な地名・テーマ |
| :--- | :--- | :--- |
| **ポーション店** | `shkliquors` | ウクライナ、ベラルーシ、ロシア、シレジア、スイスの地名 (例: *Gomel, Tsjernigof, Leuk*) |
| **本屋** | `shkbooks` | アイルランドの地名 (例: *Skibbereen, Enniscorthy, Dromin*) |
| **防具屋** | `shkarmors` | トルコの地名 (例: *Gaziantep, Zonguldak, Kars*) |
| **杖屋** | `shkwands` | ウェールズ・スコットランドの地名 (例: *Trallwng, Braemar, Dunvegan*) |
| **指輪屋** | `shkrings` | オランダ系の姓、スカンジナビアの地名 (例: *Hoboken, Abisko, Rovaniemi*) |
| **食品店** | `shkfoods` | インドネシアの地名 (例: *Kediri, Tegal, Djombang*) |
| **武器屋** | `shkweapons` | フランス・ペリゴール地方の地名 (例: *Jonzac, Pons, Carignan*) |
| **照明店** | `shklight` | ルーマニア・ブルガリアの地名 (例: *Sighisoara, Mamaia, Sliven*) |
| **雑貨屋** | `shkgeneral` | スリナム、グリーンランド、カナダ北部、アイスランドの地名 (例: *Inuvik, Akureyri*) |
| **自然食品店**| `shkhealthfoods`| チベットの地名、ヒッピー風の名前 (例: *Lhasa, Shigatse, Azura, Blaze*) |

### 4.2 開発者・貢献者のアナグラム（道具屋 `shktools`）
道具屋の店主名（全67種類）は、NetHackの歴代開発チーム（DevTeam）や各OS（MS-DOS, Amiga, Macintosh, VMS, OS/2, Windows等）への移植担当者・貢献者の名前を**逆読みやアナグラム**にしたものです。

* **逆読み・アナグラムの例**:
  * `Noskcirdneh` → **Hendrickson** (ヘンドリクソン)
  * `Nosnehpets` → **Stephenson** (ステフェンソン)
  * `Yelpur` → **Rupley** (ルプリー)
  * `Renrut` → **Turner** (ターナー)
  * `Cire Htims` → **Eric Smith** (エリック・スミス)
  * `Dark Eery` → **Eric Drake** (エリック・ドレイク)
  * `Telloc Cyaj` → **Jay Collett** (ジェイ・コレット)
  * `Kachzi Rellim` → **Izchak Miller** (イズチャック・ミラー)

### 4.3 故 Izchak Miller 教授へのオマージュ
鉱山街（Minetown）の照明店には、特別ケースとして常に **`Izchak` (イズチャック)** という店主が配置されます。
これは、NetHackの初期開発において多大な貢献を果たし、1994年に他界された **Izchak Miller 教授** への追悼として、ゲーム内に永遠の存在として刻まれているものです。

---

## 5. 日本語WebUI (`Nethack-wasm-webUI`) 辞書更新

今回の調査に基づき、`Nethack-wasm-webUI/dictionary.csv` の更新を実施しました。

1. **店舗種類名の追加**: 未登録だった14種類の店舗名・略称（`armor shop`, `potion shop`, `weapon shop` 等）を `Entity` として登録。
2. **店主名エントリの追加（全397件）**:
   * 接頭辞付き (`+Izchak`, `-Lucrezia`, `=Azura`) および接頭辞なし (`Izchak`, `Lucrezia`, `Azura`) の全パターンを登録。
   * **地名由来の店主名**: 正確な日本語カタカナ表記（例: `Gomel` → **ゴメリ**, `Gaziantep` → **ガジアンテプ**, `Skibbereen` → **スキバリーン**）を反映。
   * **アナグラムの店主名**: 元の人物名（例: `Noskcirdneh` → **Hendrickson (ヘンドリクソン)**, `Cire Htims` → **Eric Smith (エリック・スミス)**）を反映。

---
*資料作成日: 2026年7月23日*


---

## 6. ペット名 (Pet Names) の仕様と元ネタ

店主名だけでなく、プレイヤーの初期ペット（Pet）の名前決定に関してもソースコード ([src/dog.c])にユニークな仕様が存在します。

### 6.1 プレイヤー自由設定とデフォルト名
* **設定ファイル・オプション**: プレイヤーは設定（`dogname=...`, `catname=...`, `horsename=...`）でペットの名前を任意に指定できます。
* **役職（Role）ごとのデフォルト犬名**: 犬の名前を指定していない（空欄の）場合、プレイヤーの職業（Role）に応じて元ネタのある特別なデフォルト名が自動的に割り当てられます。

| 役職 (Role) | デフォルト犬名 | 由来・元ネタ |
| :--- | :--- | :--- |
| **侍 (Samurai)** | `Hachi` (ハチ) | **渋谷駅の忠犬ハチ公** |
| **洞窟人 (Caveman)** | `Slasher` (スラッシャー) | 映画・戦士モチーフの犬名 |
| **野蛮人 (Barbarian)** | `Idefix` (イドフィックス) | バンド・デシネ（フランス漫画）『アステリックス』のオベリックスの愛犬 **Idefix / Dogmatix** |
| **レンジャー (Ranger)** | `Sirius` (シリウス) | オリオン座のおおいぬ座主星 **シリウス (Sirius)** |

※ 猫（Kitten）や子馬（Pony）には役職ごとのデフォルト名はなく、指定しない場合は無名のままスタートします。また、ゲーム中いつでも `#name` コマンドで名付けが可能です。
※ これら4つのデフォルトペット名 (`Hachi`, `Slasher`, `Idefix`, `Sirius`) も `dictionary.csv` の `Entity` として日本語カタカナ訳を追加登録済みです。


---

## 7. 巻物名 (Scroll Labels) のシャッフル生成仕様と元ネタ

巻物（Scroll）の未識別ラベル（呪文のような文字列）の生成仕様およびソースコード ([include/objects.h](file:///c:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/include/objects.h#L1180-L1260) / [src/o_init.c](file:///c:/Users/e3-sh/Desktop/works/NetHack-NetHack-5.0_org/NetHack-NetHack-5.0/src/o_init.c#L321-L347)) における構造は以下の通りです。

### 7.1 シャッフル決定メカニズム
* **完全な文字の自動ランダム生成ではなく、あらかじめ定義された固定の未識別ラベル（呪文風文字列）リストからのランダム割り当て（シャッフル）**です。
* ゲーム開始時に `o_init.c` 内の `shuffle_all()` 関数が実行され、未識別ラベル（`"ZELGO MER"`, `"ELBIB YLOH"` など）と巻物の本当の効果（防具強化、皆殺し、同定など）の組み合わせがゲームごとにランダムに入れ替わります。

### 7.2 巻物未識別ラベルの元ネタ・オマージュ一覧 (Trivia)
定義されている未識別ラベルには、ポップカルチャー、レトロゲーム、言語学、アナグラムなどの様々な元ネタが仕込まれています。

| ラベル文字列 | 本来の巻物効果（初期値） | 由来・元ネタ解説 |
| :--- | :--- | :--- |
| **`ELBIB YLOH`** | 皆殺し (`genocide`) | **HOLY BIBLE** (聖書) の逆読み |
| **`HACKEM MUCHE`** | 充電 (`charging`) | 英語 **"Hack 'em much"** (奴らを切り刻め) をラテン語風にしたジョーク |
| **`VE FORBRYDERNE`** | 罰 (`punishment`) | デンマーク語/ノルウェー語で「悪党どもよ！」の意味 |
| **`KIRJE`** | 地震 (`earth`) | フィンランド語で「手紙 / 書物」の意味 |
| **`MAPIRO MAHAMA DIROMAT`** | 余剰ラベル | レトロRPG **『ウィザードリィ (Wizardry)』** の攻撃・帰還呪文 |
| **`VAS CORP BET MANI`** | 余剰ラベル | レトロRPG **『ウルティマ (Ultima)』** の言語魔法システム |
| **`GHOTI`** | 余剰ラベル | ジョージ・バーナード・ショーの有名単語表記ジョーク (gh=f, o=i, ti=sh で **fish** と読む) |
| **`ASHPD SODALG`** | 余剰ラベル | ゲーム **『Portal』** (Aperture Science Handheld Portal Device のアナグラム) |
| **`ZLORFIK`** / **`GNIK SISI VLE`**| 余剰ラベル | ルーカスフィルムのアドベンチャーゲーム **『Zak McKracken』** の呪文 (GNIK SISI VLE = **ELVIS IS KING** 逆読み) |
| **`STRC PRST SKRZ KRK`** | 余剰ラベル | チェコ語・スロバキア語の有名な母音のない早口言葉 (「喉に指を突っ込め」の意味) |
| **`ETAOIN SHRDLU`** | 余剰ラベル | タイプライターや活版印刷機で出現頻度の高い文字順フレーズ |
| **`LOREM IPSUM`** | 余剰ラベル | 出版・グラフィックデザインで用いられる有名なダミーテキスト |
| **`FNORD`** | 余剰ラベル | 小説『イルミナティ三部作』のマインドコントロール単語 |

※ これら41種類の巻物未識別ラベルも `dictionary.csv` の `Entity` として登録済みです。
