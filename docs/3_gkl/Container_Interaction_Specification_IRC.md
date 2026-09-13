# コンテナ対話・UI 設計仕様書 (IRC & Signal-Driven SSOT)

## 1. 基本方針・設計原則 (Core Philosophy)

1. **裏マクロ同期の完全禁止 (Zero Hidden Macros / No `syncContents`)**:
   - 状態を取得・確定させるために「裏でもう一度コンテナを開けて覗いて閉じる」という旧来のアンチパターンは**完全に禁止・廃止**する。
   - すべての操作（開く、入れる、出す、閉じる）は、**C コアと直接対話する独立した IRC レシピ（トランザクション）** として完結させる。

2. **オンデマンド・アトミック実行（1操作＝1トランザクション）**:
   - コンテナメニューを開いたまま待機するのではなく、モーダル表示中の C コアは**常に安全な通常ターン待機（`poskey` / `turn_ready`）で完全静止**させる。
   - ユーザーが出し入れ操作を行った瞬間のみ、`ContainerController` が `openPrefix`（手持ち: `['a', letter]`、床: `['#', 'loot']`）から始まるアトミックなレシピを一瞬で実行し、アイテム選択後に `q` で脱出して通常ターンに着地させる。
   - これにより、待機中のハングやキー不整合、意図しないターンスキップが原理的に発生しない。

3. **シグナル駆動のライフサイクル (Signal-Driven Lifecycle)**:
   - 画面の更新・完了確認は、平文メッセージ（"You put... into the sack" 等）の文字列解析に頼らない。
   - C コアが発火するシグナル（`SIGNAL_CONTAINER_ACTION_MENU`, `SIGNAL_CONTAINER_ITEM_SELECT`, `SIGNAL_CONTAINER_FLOOR_SELECT` 等）の遷移そのものをトランザクションの進捗および完了トリガーとする。

4. **C コア メニュー構造体の直接返却 (Direct Binary/Object Resolution)**:
   - キーストローク列（`['2', 'd']` 等）を送信して選択する方式は完全撤廃。
   - C コアの `select_menu` に対して、16バイト境界アラインされた構造体オブジェクト配列（`[{ identifier, count }]`）を直接 resolver に解決させる。
   - スタックアイテムの全量移動フラグ（`count: -1`）および数量指定移動を完全サポート。

5. **インデックス基準の厳密な1:1選択 (Strict Index-Based UI Selection)**:
   - `undefined === undefined` や `str === str`、`name === name` などの曖昧一致判定を完全に根絶する。
   - UI上の選択状態（`selectedLeftIndex`, `selectedRightIndex`）は、配列のインデックス（`number`）または一意な ID のみで厳密に 1 アイテムのみを追跡する。

---

## 2. システムアーキテクチャと責任境界 (`ContainerController`)

`src/core/container/ContainerController.js` が中心となり、以下のモジュールと協調して動作します。

```mermaid
graph TD
    subgraph UI_Layer ["UI レイヤー"]
        Modal["ContainerModal (二面パネル UI)"]
    end

    subgraph Core_Container ["コンテナコア (`ContainerController`)"]
        CC["ContainerController (対話制御・トランザクション統括)"]
        CCM["ContainerContentsManager (中身・レター・金貨追跡)"]
        CSG["ContainerSafetyGuard (BoH防爆・装備中判定)"]
        CSB["ContainerSequenceBuilder (開閉プレフィックス構築)"]
    end

    subgraph Base_Control ["基盤制御レイヤー"]
        IRC["InteractiveRequestController (セッションロック / レシピ実行)"]
        CORE["WebUICore (Pub/Sub シグナル / 自動同期排他)"]
    end

    Modal <-->|transferItem / closeSession| CC
    CC --> CCM
    CC --> CSG
    CC --> CSB
    CC <-->|querySequenceSilent / sessionLock| IRC
    CORE -->|signal / inputRequired| CC
```

### 各モジュールの責務
- **`ContainerController`**:
  - `attach(core)` による WebUICore 購読とシグナル自動検知。
  - IRC 汎用セッションロック（`acquireSessionLock('container')`, `releaseSessionLock('container')`）の取得・解放。
  - 初回アクションメニュー（`handleInitialActionMenu`）のハンドリング。
  - アイテム転送（`transferItem`）のトランザクション実行とローカルモデル・インベントリ同期。
- **`ContainerContentsManager`**:
  - コンテナ内アイテム配列、金貨アイテム（`$`）の追跡、レターの再採番（`reindexLetters`）。
  - アイテム投入（`onItemPutIn`）および取り出し（`onItemTakenOut`）時のスタック数量計算。
- **`ContainerSafetyGuard`**:
  - Bag of Holding (BoH) 防爆ガード（自己投入阻止、魔法の鞄・トリックの鞄等の危険物投入阻止）。
  - 装備中アイテム（武器、防具、矢筒等）の投入ガード。
- **`ContainerSequenceBuilder`**:
  - コンテナの開閉プレフィックス生成。床コンテナは正規化された `['#', 'loot']`、手持ちコンテナは `['a', letter]` を生成。

---

## 3. コンテナ対話プロトコルとシーケンス (Interaction Protocol)

### 3.1 コンテナの初期オープン (Session Initialization)

プレイヤーが手持ちの鞄を使う（`apply` -> レター）か、床の箱の上で `#loot` を実行した際の流れ：

```mermaid
sequenceDiagram
    participant Player as プレイヤー操作
    participant Core as WebUICore
    participant IRC as InteractiveRequestController
    participant CC as ContainerController
    participant C as NetHack C-Core
    participant UI as ContainerModal

    Player->>Core: 'a' + 'e' (手持ち袋) または '#loot' (床の箱)
    C-->>Core: SIGNAL_CONTAINER_ACTION_MENU
    Core->>CC: _handleSignal (SIGNAL_CONTAINER_ACTION_MENU)
    Note over CC: インベントリ優先照合により手持ち/床を正確に判定
    CC->>IRC: acquireSessionLock('container')
    
    alt 中身が空の場合 (Take out 'o' なし)
        CC->>C: 'q' でアクションメニューを離脱
        C-->>CC: turn_ready (通常ターン poskey に着地)
    else 中身がある場合 (Take out 'o' あり)
        CC->>IRC: querySequenceSilent(RECIPE_CONTAINER_INITIAL_FETCH)
        Note over CC: 'o' -> CONTAINER_ITEM_SELECT から中身アイテム一覧を抽出<br/>-> ESC で選択キャンセル -> 'q' で通常ターンに着地
        C-->>CC: turn_ready (通常ターン poskey に着地)
    end

    CC->>UI: containerTransaction (ACTION_PROMPT, contents)
    UI->>UI: モーダル表示 (二面パネル・手持ち所持金を自動合成)
```

- **コンテナ種別の誤判定防止**:
  - プレイヤーが手持ちの袋やチェストを開けた場合、インベントリ内のアイテム（`onum`, `letter`, `name`）と優先照合。
  - 床の箱と誤判定されて `#loot` プレフィックスが生成される不具合を完全に防止します。
- **床コンテナプレフィックスの正規化**:
  - 床コンテナを開くプレフィックスは末尾の不要な `\r` を排除し `['#', 'loot']` に正規化。C コアが直後の文字を即座キャンセルや Quit コマンドと誤認する問題を解消。

---

### 3.2 アイテム転送 (Put In / Take Out: アトミック実行)

プレイヤーがアイテムの転送ボタン（1個 / 全量 / 任意数）を押下、またはドラッグ＆ドロップした際の流れ：

```mermaid
sequenceDiagram
    participant UI as ContainerModal
    participant CC as ContainerController
    participant IRC as InteractiveRequestController
    participant C as NetHack C-Core

    UI->>CC: transferItem({ direction: 'in'|'out', item, count })
    Note over CC: 1. validatePutIn (自己投入・装備中・BoH防爆チェック)<br/>2. count の正規化 (全量移動時は -1)
    
    CC->>IRC: querySequenceSilent(RECIPE_CONTAINER_TRANSFER)
    Note over IRC,C: start: openPrefix (手持ち: ['a', letter] / 床: ['#', 'loot'])
    IRC->>C: openPrefix 送出
    C-->>IRC: SIGNAL_DIRECTION / FLOOR_SELECT (床の場合) -> '.' や箱を選択
    C-->>IRC: SIGNAL_CONTAINER_ACTION_MENU -> 'i' (入れる) または 'o' (出す)
    C-->>IRC: SIGNAL_CONTAINER_CATEGORY_SELECT (ある場合) -> [{ identifier: -2, count: -1 }] (All)
    C-->>IRC: SIGNAL_CONTAINER_ITEM_SELECT (アイテム一覧)
    Note over IRC: 金貨優先 / identifier / accelerator / 名前照合で目的アイテムを特定
    IRC->>C: resolver.resolve([{ identifier: targetId, count: count }])
    C-->>IRC: SIGNAL_CONTAINER_ACTION_MENU (戻り)
    IRC->>C: 'q' でアクションメニューを離脱
    C-->>IRC: turn_ready (通常ターン poskey に着地)

    Note over CC: トランザクション完了確定！
    CC->>CC: contentsManager.onItemPutIn() または onItemTakenOut()
    CC->>Core: syncInventorySilent({ force: true }) (手持ちインベントリ同期)
    CC->>UI: containerTransaction (ACTION_PROMPT, 最新 contents)
    UI->>UI: 二面パネルを最新状態に即時再描画
```

- **全量移動 (`count: -1`) のサポート**:
  - 複数個スタック（矢、金貨、食料等）の全量移動時、NetHack C コアの仕様である `count: -1` を直接構造体に設定して `select_menu` に渡すため、数量入力プロンプトが挟まることなく一発で全量転送が完結します。
- **排他制御と描画サプレス**:
  - `InteractiveRequestController.isBusy()`（セッションロック中）の間、WebUICore は途中のプロンプト画面描画（`renderer.showPrompt`）をサプレスし、裏での自動サイレント同期も抑止します。

---

### 3.3 コンテナの終了 (Close Session)

プレイヤーが「閉じる」ボタン、`ESC`、または `q` を押下した際の流れ：

```mermaid
sequenceDiagram
    participant UI as ContainerModal
    participant CC as ContainerController
    participant IRC as InteractiveRequestController

    UI->>CC: closeSession()
    Note over CC: C コアは既に通常ターン (poskey) で静止しているため、<br/>キー送信は一切不要！
    CC->>IRC: releaseSessionLock('container')
    CC->>UI: containerTransaction (state: 'IDLE', isContainerSessionActive: false)
    UI->>UI: モーダルを閉じる (hidden)
```

- C コアは常に poskey で待機しているため、セッション終了時に余分なキーを送信する必要がなく、安全かつ即座に終了します。

---

## 4. 金貨（Gold Pieces / `$`）の総合仕様

NetHack において金貨は通常のアイテムとは異なる特殊な扱い（インベントリ文字 `$`、クラス `COIN_CLASS`、手持ちステータス `BL_GOLD` 管理）を受けるため、コンテナシステムでは以下の包括的対応を行っています。

### 4.1 金貨の正規アイテム同定
`ContainerContentsManager` および `ContainerController` は、以下の条件で金貨アイテムを正規に認識します：
1. **メニュー項目メタデータ**:
   - `mi.glyph === 3886` または `mi.glyphInfo.glyph === 3886`
   - `mi.accelerator === 36` (ASCII `$`) または `mi.charStr === '$'`
2. **テキストパターン判定**:
   - `/(?:gold\s+pieces?|pieces?\s+of\s+gold|zorkmids?|枚の金貨|^金貨$)/i`
3. **JNetHack の見出し誤判定対策**:
   - JNetHack において 1枚の金貨は「金貨」と表示されます。旧来のパーサーが見出し行（アイテムカテゴリ）と誤認して除外していた問題を解消し、単数金貨（`count: 1`, `isGold: true`）として正しくパースします。

### 4.2 NetHack 標準に準拠した最上部ソート順 (`reindexLetters`)
NetHack の標準インベントリ表示（`flags.inv_order`）において、金貨は常に先頭に配置されます。
- `ContainerContentsManager.reindexLetters()` は、金貨アイテム（`isGold || letter === '$'`）を手持ち・コンテナ内ともに**配列の最上部（インデックス 0）にソート**します。
- 金貨のレターは常に `'$'`（`accelerator: '$'`）に固定され、それに続く通常アイテムが `'a'...'z'`, `'A'...'Z'` で連続採番されます。

### 4.3 金貨の数量管理（加算・減算追跡）
- **投入時 (`onItemPutIn`)**:
  - コンテナ内に既に金貨が存在する場合、二重エントリーを作らず `existing.count += addCount` で合算。表示テキストも `${existing.count} gold pieces` に自動整形。
- **取り出し時 (`onItemTakenOut`)**:
  - 部分取り出しの場合、`existing.count -= takeCount` で減算。全量取り出し（または残数 0）で配列から削除。

### 4.4 手持ち所持金（Status gold）の UI 合成表示
NetHack では手持ちの金貨は通常インベントリ（`'i'`）の一覧には現れず、ステータス（`BL_GOLD`）として保持されます。
- `ContainerModal` は、プレイヤーの手持ち所持金（`core.getStatus()?.gold?.amount`）が 1 枚以上ある場合、左パネル（手持ちアイテム一覧）の最上部（インデックス 0）に**レター `$` の金貨アイテムを自動合成して描画**します。
- これにより、プレイヤーは手持ちの所持金を通常のアイテムと全く同じ感覚でコンテナ内へ投入（1個 / 全量 / 任意数）できます。

---

## 5. UI（ContainerModal）の操作・データバインディング仕様

### 5.1 左右二面パネルの構成
- **左パネル（Player Inventory）**:
  - プレイヤーの所持品一覧。最上部に手持ち所持金（Status gold）が自動合成される。
  - 装備中のアイテム（`E`, `W` 等のバッジ表示）や BoH 危険アイテム（防爆アイコン表示）は投入ボタンが無効化される。
- **右パネル（Container Contents）**:
  - コンテナ内アイテム一覧。金貨があれば最上部に表示。

### 5.2 厳密なインデックス選択管理
- `selectedLeftIndex: number | null`
- `selectedRightIndex: number | null`
- プロパティ値の曖昧一致（`name === name` 等）を完全撤廃し、選択中アイテムは配列インデックスのみで 1:1 に追跡されます。

### 5.3 移動操作インターフェース
各パネルのアイテムごとに以下の操作を提供：
1. **「1個」ボタン**: `count: 1` で即時転送。
2. **「全量」ボタン**: `count: -1` でスタックを即時全量転送。
3. **「数量」ボタン**: プロンプトで指定した個数を転送。
4. **ドラッグ＆ドロップ**: 反対側パネルへドロップして全量転送。
