# Game Knowledge Layer (GKL) 総合解説・利用ガイド仕様書

本書は、NetHack WebUI Core に組み込まれている **Game Knowledge Layer (GKL / ゲーム知識層)** の現在の実装状況、機能・能力、取得できる情報データ構造、および利用方法（API）を整理した技術資料です。

---

## 1. GKL (Game Knowledge Layer) とは

GKL は、NetHack の複雑なゲーム仕様・コンテキスト情報をWebフロントエンド層で安全かつ高精度に解釈し、**リアルタイムな状況認識・知識支援・自動アクション生成・自走シーケンス実行** を提供する知能レイヤーモジュール群です。

NetHack 特有の「何ができるか分かりづらい設置物（祭壇、噴水、シンク、罠、玉座等）」「複雑なコマンド入力シーケンス（鍵開け、解錠、壁の掘削、樹木の伐採、会話、支払い等）」を抽象化し、UI クライアント（ボタン、タッチ操作、コマンドパレット等）や AI Agent が容易にゲーム操作を行えるように設計されています。

---

## 2. 現在の実装アーキテクチャ & コンポーネント構成

GKL は以下の 6 つのコアコンポーネントによって構成されています。

```
 [ UI Layer / Custom Buttons / AI Agent / Debug Inspector ]
                        │
                        │  core.getSituation() / core.executeAction(action)
                        ▼
 ┌──────────────────────────────────────────────────────────┐
 │ 🧠 Game Knowledge Layer (GKL)                            │
 │                                                          │
 │  1. 状況統合・キャッシュアクセサ                         │
 │     - SituationCache                                     │
 │       (ステータス・マップ・所持品・推奨アクションを一発取得)   │
 │                                                          │
 │  2. 推奨アクション自動生成エンジン                       │
 │     - ContextActionEngine                                │
 │       (周辺マップ環境と所持ツールから最適コマンド群を推論)     │
 │                                                          │
 │  3. エリア・ダンジョンマップ状態マネージャー              │
 │     - AreaStateManager                                   │
 │       (80x21グリッドを3階層[地形/アイテム/モンスター]管理)│
 │                                                          │
 │  4. インベントリ（所持品）状態マネージャー                │
 │     - InventoryStateManager                              │
 │       (ツルハシ・鍵・斧・杖等を三層アルゴリズムで高精度識別) │
 │                                                          │
 │  5. グリフ・エンティティ分類ユーティリティ              │
 │     - glyphClassifier                                    │
 │       (NetHack 5.0/3.7 の Glyph ID を意味カテゴリに分類)  │
 │                                                          │
 │  6. シーケンス自走実行・状態制御コントローラー            │
 │     - RequestController                                  │
 │       (トークン配列の自動消化・手動割り込み・復帰制御)       │
 └────────────────────────────┬─────────────────────────────┘
                              │ queueSequence / querySequenceSilent
                              ▼
 ┌──────────────────────────────────────────────────────────┐
 │ ⚙️ WebUI Core & NetHack WASM Core                         │
 └──────────────────────────────────────────────────────────┘
```

### コアコンポーネント詳細

| コンポーネント | ソースコード | 主な責務・役割 |
| :--- | :--- | :--- |
| **`SituationCache`** | [`SituationCache.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/SituationCache.js) | ゲームの全状態（ステータス、マップ、所持品、推奨アクション）を統合ファサードとして一括提供するキャッシュアクセサ。 |
| **`ContextActionEngine`** | [`ContextActionEngine.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/ContextActionEngine.js) | 足元・隣接マスの環境とインベントリツールを解析し、今可能なアクション (`ContextAction`) を優先度順で自動判定・生成。 |
| **`AreaStateManager`** | [`AreaStateManager.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/AreaStateManager.js) | 80x21グリッドの 3 階層（Bottom: 地形/トラップ, Middle: アイテム/死体/箱, Top: モンスター/ペット）のマップ状態をリアルタイム更新・保持。 |
| **`InventoryStateManager`** | [`InventoryStateManager.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/InventoryStateManager.js) | 所持品を管理し、三層識別アルゴリズム (Glyph ID → ONUM → テキスト正規表現) で重要ツール (ツルハシ, 鍵, 斧, 氷の杖) を検出。 |
| **`glyphClassifier`** | [`glyphClassifier.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/glyphClassifier.js) | NetHack 5.0 (3.7) の約10000種類の Glyph ID を意味カテゴリ (`TERRAIN`, `ITEM`, `MONSTER`, `PET`, `BODY` 等) や CMAP フラグへ分類。 |
| **`RequestController`** | [`RequestController.js`](file:///c:/Users/e3-sh/Documents/GitHub/Nethack-wasm-webUI/src/core/knowledge/RequestController.js) | 状態マシン (`IDLE`, `EXECUTING`, `ABORTING_ESC`, `SUSPENDED`) を持ち、多段階プロンプトの自走自動消化と割り込み安全キャンセルを制御。 |

---

## 3. GKL の主要な機能と能力

### ① 周辺環境・文脈に応じた推奨アクション (Contextual Action Recommendation)
`ContextActionEngine` が自動でゲーム状況を読み取り、以下の環境・対象に応じた実行可能アクションを即座に生成します。

* **足元 (Stepping On)**
  * **落ちているアイテム**: 拾う (`,`), 落とす (`d`)
  * **箱・コンテナ**: 漁る/開ける (`#loot`), 鍵で解錠 (`a` + 鍵スロット + `DIR_SELF`), 罠解除 (`#untrap`)
  * **階段**: 降りる (`>`), 上る (`<`)
  * **祭壇 (Altar)**: 生贄を捧げる (`#offer`), BUC判別落とし (`d`), 祈る (`#pray`) ※危険度警告付き
  * **泉 (Fountain)**: 飲む (`q`), 浸す (`#dip`), 罠解除 (`#untrap`), 蹴る (`C-d`)
  * **シンク (Sink)**: 座る/指輪識別 (`#sit`), 飲む (`q`), 浸す (`#dip`), 蹴る (`C-d`)
  * **罠 (Trap)**: 解除/埋め立て (`#untrap`), 自ら座る (`#sit`)
  * **玉座 (Throne)**: 座る (`#sit`)
  * **床/廊下**: 文字を刻む (`E`), 探す (`s`), 座る (`#sit`)
* **隣接 8 方向 (Adjacent Tiles & Creatures)**
  * **モンスター / NPC**: 近接攻撃 (`DIR`), 話しかける (`#chat`), 代金を支払う (`#pay` ※店主のみ)
  * **ペット (Pet)**: 話しかける (`#chat`) ※ペット誤爆攻撃を完全防止
  * **扉 (Door)**: 開ける (`o` + `DIR`), 閉める (`c` + `DIR`), 鍵で解錠 (`a` + 鍵 + `DIR`), 蹴破る (`#kick` + `DIR`), 罠解除 (`#untrap` + `DIR`)
  * **壁 / 隠し扉**: 捜索 (`s`), ツルハシで掘削 (`a` + ツルハシ + `DIR`)
  * **樹木**: 蹴る (`C-d` + `DIR`), 斧で伐採 (`a` + 斧 + `DIR`)
  * **水場 / 溶岩**: 氷の杖で凍らせる (`a` + 氷の杖 + `DIR`), アイテムを投げ入れる (`t` + `DIR`)
  * **鉄格子**: 酸/ツルハシで溶かす・壊す (`a` + `DIR`)

### ② 高精度インベントリツール検出＆動的コマンドキー切替
所持アイテムについて以下を自動識別し、ツールの分類に応じた正しいコマンドキー (`verb`) を自動的に割り当ててアクションを生成します：
* **`pickAxe` / ツルハシ類** (`pick-axe`, `dwarvish mattock`): **Apply コマンド (`a`)** で使用 ➔ `['a', letter, DIR]`
* **`isDigWand` / 採掘の杖** (`wand of digging`): **Zap コマンド (`z`)** で使用 ➔ `['z', letter, DIR]`
* **`key` / 鍵類** (`skeleton key`, `lock pick`, `credit card`): **Apply コマンド (`a`)** ➔ `['a', letter, DIR]`
* **`axe` / 斧類** (`axe`, `battle-axe`): **Apply コマンド (`a`)** ➔ `['a', letter, DIR]`
* **`frostWand` / 氷の杖**: **Zap コマンド (`z`)** ➔ `['z', letter, DIR]`

### ③ 抽象キー＆プロンプトの自走自動消化
`['#', 'open', 'DIR_E']` や `['a', 'b', 'DIR_N']` などの多段階コマンドを送信した際、WASM コア側のプロンプト入力待ちを低レイヤーで認識し、画面を乱さずに自動連続送信・完了消化します。

### ④ バックグラウンド・サイレント同期
画面表示や UI のちらつきなしに、バックグラウンドでインベントリ (`i`) やコマンドバッファを同期取得可能 (`querySequenceSilent`, `syncInventorySilent`)。

---

## 4. GKL から取得できる情報データ構造

### ① 統合状況データ構造 (`gkl.getSituation()`)

```typescript
interface Situation {
    // プレイヤーのステータス情報 (HP, Level, AC, 属性, ゴールド等)
    status: StructuredStatus;

    // インベントリ情報
    inventory: {
        items: InventoryItem[];
        isSynced: boolean; // 同期済みフラグ
    };

    // 周辺マップ・位置情報
    area: {
        center: { x: number; y: number };
        feet: CellState;                // 足元のセル情報
        adjacentMonsters: MonsterInfo[]; // 隣接モンスター一覧
        adjacentEntities: EntityInfo[]; // 隣接 8 方向のセル情報
        cells: CellState[][];           // 周辺 3x3 グリッド行列
    };

    // 検出済み主要ツール
    tools: {
        pickAxe: InventoryItem | null;
        key: InventoryItem | null;
        axe: InventoryItem | null;
        frostWand: InventoryItem | null;
    };

    // 現在実行推奨されるアクション一覧 (priority 降順)
    actions: ContextAction[];
}
```

### ② 推奨アクションデータ構造 (`ContextAction`)

```typescript
interface ContextAction {
    id: string;            // 一意の識別子 (例: 'ACTION_OPEN_DOOR_N', 'ACTION_OFFER')
    category: 'INTERACT' | 'COMBAT' | 'ITEM' | 'MOVEMENT';
    label: string;         // 英語ラベル ("Open door")
    labelJa?: string;      // 日本語ラベル ("扉を開ける (Open)")
    key: string;           // 代表キー ("o", "C-d", "#sit")
    keySequence?: string[];// 連続実行用抽象トークン配列 (['o', 'DIR_E'], ['#', 'loot', 'DIR_SELF'])
    charStr?: string;      // メイン文字
    extCmd?: string;       // 拡張コマンド名 ("open", "loot", "chat", "pay", "pray")
    directionKey?: string; // 抽象方向トークン ("DIR_N", "DIR_E", "DIR_SELF" 等)
    risk?: null | 'warning' | 'danger'; // リスクレベル ('danger' は確認ダイアログ表示を推薦)
    priority: number;      // 優先度 (数値が高いものほど画面上位に配置)
    target?: 'self' | 'feet' | 'adjacent' | 'inventory';
    description?: string;  // 英語説明文
    descriptionJa?: string;// 日本語説明文
}
```

---

## 5. GKL の具体的な利用方法 (コード例)

WebUI Core インスタンス (`core`) から直接 GKL の API を呼び出すことができます。

### 1) ゲームの統合状況と推奨アクションの取得

```javascript
// WebUICore インスタンスを取得
const situation = core.getSituation();

// 1. 現在推奨されているアクションの一覧を取得
console.log("推奨アクション一覧:", situation.actions);

// 2. 所持ツールの確認
if (situation.tools.key) {
    console.log("鍵を所持しています:", situation.tools.key.rawText);
}
```

### 2) 推奨アクション (`ContextAction`) の実行

`core.executeAction(action)` を呼ぶだけで、単一キー・拡張コマンド・方向指定シーケンスが安全かつ自動的に送出されます。

```javascript
// UI ボタンクリック時などのハンドラー
function onActionButtonClick(action) {
    if (!action) return;

    // 危険なアクションに対する確認
    if (action.risk === 'danger') {
        const confirmOk = window.confirm(`【⚠️ 危険】\n${action.labelJa || action.label} を実行しますか？`);
        if (!confirmOk) return;
    }

    // GKL ファサードを通じてアクションを統一実行
    core.executeAction(action);
}
```

### 3) バックグラウンドでのサイレントインベントリ同期

画面のダイアログ表示を出さずにインベントリの状態を更新したい場合：

```javascript
// バックグラウンドで 'i' コマンドを発行してインベントリ状態を最新化
await core.syncInventorySilent();

// 最新のインベントリ状態を取得
const inventoryState = core.getInventoryState();
console.log("インベントリアイテム数:", inventoryState.items.length);
```

### 4) 拡張コマンドの直接実行

`#chat`, `#pay`, `#loot`, `#untrap` などの拡張コマンドをプログラムから実行：

```javascript
// 東方向 (DIR_E) の店主に代金を支払う
core.sendExtCommand('pay', 'DIR_E');

// 足元の箱を開ける
core.sendExtCommand('loot', 'DIR_SELF');
```

---

## 6. まとめ

GKL (Game Knowledge Layer) は、以下のような価値を提供しています：

1. **画面非依存・デバイス非依存な統一操作**: キーボードの無いスマホ/タブレット、ゲームパッド、マウス操作、AI Agent からでも安全かつ直感的にゲームをプレイ可能。
2. **安全な誤操作防止**: ペットへの誤攻撃防止、危険アクション（祈り・泉蹴り等）の事前リスク警告。
3. **ノイズの少ない最適なコンテキスト選択肢**: 鍵を持っていない場合は「鍵開け」を表示しないなど、所持品と周囲環境を完全に連動させたスマートなアクション提示。
