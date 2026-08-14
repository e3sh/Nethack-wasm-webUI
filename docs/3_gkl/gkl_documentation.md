---
title: Game Knowledge Layer (GKL) 総合解説・利用ガイド仕様書
status: active
last_updated: 2026-08-15
related_code:
  - src/core/knowledge/
  - src/core/knowledge/GKLPlugin.js
  - src/core/knowledge/ContextActionEngine.js
  - src/core/knowledge/InventoryStateManager.js
  - src/core/knowledge/AreaStateManager.js
  - src/core/WebUICore.js
---

#  Game Knowledge Layer (GKL) 総合解説・利用ガイド仕様書

本書は、NetHack WASM WebUI Core に組み込まれている **Game Knowledge Layer (GKL / ゲーム知識層)** の全体アーキテクチャ、疎結合化プラグイン仕様、主要機能、データ構造、および利用呼び出し規則（API）を解説する公式仕様書です。

---

## 1. GKL (Game Knowledge Layer) の概要

GKL は、NetHack の複雑なゲーム状態・コンテキストを Web フロントエンド層でリアルタイムに解析・復元し、**「状況認知」「知識推論」「先回り推奨アクション」「自動シーケンス実行」** を提供するインテリジェントモジュール群です。

###  疎結合化プラグイン構造 (Decoupled Plugin Architecture)
WebUICore コアエンジンと GKL ドメイン知識モジュールは完全な**疎結合設計**となっています。WebUICore 自体は汎用的な通信・イベントバスに専念し、GKL は独立した拡張プラグイン (`GKLPlugin`) としてアタッチ（注入）される呼び出し規則を採用しています。

---

## 2. アーキテクチャ & コンポーネント構成

GKL は `src/core/knowledge/` 配下の独立モジュール群で構成され、`GKLPlugin` がアタッチメントポイントとして機能します。

```text
 [ Client UI Layer / Custom Buttons / AI Agent / Debug Inspector ]
                                │
                                ▼  core.use(gklPlugin)
 ┌──────────────────────────────────────────────────────────┐
 │                     WebUICore.js                         │
 │        (汎用通信・イベントバス / EventHub 基盤)             │
 └──────────────────────────────┬───────────────────────────┘
                                │  core.emit() / Events
                                ▼
 ┌──────────────────────────────────────────────────────────┐
 │                 GKLPlugin (アタッチドモジュール)          │
 │                                                          │
 │  ┌────────────────────────┐   ┌───────────────────────┐  │
 │  │   AreaStateManager     │   │ InventoryState        │  │
 │  │ (3層マップ/地形/NPC解析) │   │ Manager (所持品・同期) │  │
 │  └───────────┬────────────┘   └───────────┬───────────┘  │
 │              │                            │              │
 │              └────────────┬───────────────┘              │
 │                           ▼                              │
 │            ┌─────────────────────────────┐               │
 │            │   ContextActionEngine       │               │
 │            │   (先回り推奨アクション推論)│               │
 │            └──────────────┬──────────────┘               │
 │                           │                              │
 │                           ▼                              │
 │            ┌─────────────────────────────┐               │
 │            │      SituationCache         │               │
 │            └─────────────────────────────┘               │
 └──────────────────────────────────────────────────────────┘
```

### 主要コンポーネントの役割
1. **`GKLPlugin.js`**:
   - プラグインのエントリーポイント。`core.use(plugin)` または `plugin.attach(core)` で WebUICore にアタッチされ、イベントリスナーを接続。
2. **`AreaStateManager.js`**:
   - プレイヤー周辺の地形（箱・祭壇・泉・シンク・罠・扉等）やモンスター/NPCの位置関係を 3層マップ構造でリアルタイム解析。
3. **`InventoryStateManager.js`**:
   - 所持品アイテムの識別名、BUC (Blessed/Uncursed/Cursed)、装備状態、各種ツールのキー割り当てを管理。
   - 低レイヤーでのバックグラウンド・サイレントインベントリ同期を担当。
4. **`ContextActionEngine.js`**:
   - 現在地や周辺環境、所持品に応じた「推奨アクション（`ContextAction`）」を自動推論。
5. **`SituationCache.js`**:
   - 統合ゲーム状況（`Situation`）のキャッシュ管理と高速データバインドを提供。

---

## 3. 呼び出し規則と初期化パターン (API Usage)

GKL モジュールは疎結合化されているため、用途に応じた3通りの呼び出し・初期化パターンがサポートされています。

### パターン 1: プラグイン注入 (`use()` 推奨パターン)
WebUICore インスタンスを生成後、`use()` メソッドで `GKLPlugin` をアタッチします。

```javascript
import { WebUICore } from './core/WebUICore.js';
import { GKLPlugin } from './core/knowledge/GKLPlugin.js';

const core = new WebUICore();
const gkl = new GKLPlugin({ keyMode: 'vi' });

// プラグインとして注入
core.use(gkl);

// GKL からゲーム状況と推奨アクションを取得
const situation = gkl.getSituation();
console.log("推奨アクション:", situation.recommendedActions);
```

### パターン 2: WebUICore オプション経由での自動アタッチ
コンストラクタオプション `options.gkl` で指定します。（未指定の場合もデフォルトの `GKLPlugin` が自動注入され、透過的互換性が維持されます）

```javascript
const core = new WebUICore({
  gkl: new GKLPlugin({ keyMode: 'numpad' })
});

// WebUICore 経由の Delegator アクセス
const situation = core.getSituation();
```

### パターン 3: スタンドアロン・イベント連携
`GKLPlugin` 自身が発行するパブリックイベントを直接購読して非同期にUIを更新します。

```javascript
const gkl = new GKLPlugin();
gkl.attach(core);

// 状況更新イベントの購読
gkl.on('situation_updated', (situation) => {
  renderActionButtons(situation.recommendedActions);
});
```

---

## 4. GKL の主要機能と推奨アクション推論

### ① 周辺環境に応じた推奨アクション推論 (`ContextAction`)
- **箱・コンテナ (Container)**: 漁る/開ける (`#loot`), 鍵で解錠 (`a` + 鍵 + 方向), 罠解除 (`#untrap`)
- **祭壇 (Altar)**: 生贄を捧げる (`#offer`), BUC判別落とし (`d`), 祈る (`#pray`) ※危険度警告表示機能付き
- **泉 (Fountain)**: 飲む (`q`), 浸す (`#dip`), 罠解除 (`#untrap`), 蹴る (`ctrl+d`)
- **シンク (Sink)**: 座る/指輪識別 (`#sit`), 飲む (`q`), 浸す (`#dip`), 蹴る (`ctrl+d`)
- **罠 (Trap)**: 解除/埋め立て (`#untrap`), 自ら座る (`#sit`)
- **扉 (Door)**: 開ける (`o`), 閉める (`c`), 鍵で解錠 (`a`), 蹴破る (`#kick`), 罠解除 (`#untrap`)
- **モンスター / NPC**: 近接攻撃, 話しかける (`#chat`), 代金を支払う (`#pay` ※店主)
- **ペット (Pet)**: 話しかける (`#chat`) ※ペットに対する誤攻撃を自動防止

### ② バックグラウンド・サイレント同期
画面表示を乱すことなくインベントリ・状態クエリを裏で発行・パースし、最新のアイテム一覧を非同期で維持。

---

## 5. データ構造

### ① 統合ゲーム状況構造体 (`Situation`)
```typescript
interface GameSituation {
  player: {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    level: number;
  };
  currentTile: TileInfo;         // 足元の地形・オブジェクト情報
  adjacentTiles: TileInfo[];     // 隣接8マスの地形・オブジェクト情報
  recommendedActions: ContextAction[]; // 推奨アクション一覧
  inventory: InventoryItem[];    // 所持品一覧
}
```

### ② 推奨アクション構造体 (`ContextAction`)
```typescript
interface ContextAction {
  id: string;            // 一意のアクションID (例: "loot_container")
  label: string;         // UI表示用ラベル (例: "箱を漁る")
  key: string;           // 代表実行キー (例: "#loot")
  keySequence?: string[];// 連続実行用トークン配列 (例: ['#', 'loot', 'DIR_E'])
  dangerLevel: "safe" | "warning" | "dangerous"; // 危険度区分
}
```
