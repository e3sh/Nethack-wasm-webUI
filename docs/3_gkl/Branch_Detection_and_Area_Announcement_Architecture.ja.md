---
title: GKL ブランチ検出・フロアキャッシュ分離 ＆ エリア突入アナウンス演出アーキテクチャ
status: implemented
last_updated: 2026-10-29
domain: GKL (State/Knowledge) / Client UI (Presentation) / Sound
related_code:
  - src/core/knowledge/state/AreaStateManager.js
  - src/core/knowledge/coordinators/GKLEventRouter.js
  - src/core/knowledge/coordinators/GKLFxCoordinator.js
  - examples/gkl-pure-js-client/modules/effects/VisualFxDispatcher.js
  - examples/gkl-pure-js-client/modules/renderers/fx/drawAreaBanner.js
  - examples/gkl-pure-js-client/modules/renderers/MainViewportRenderer.js
  - examples/gkl-pure-js-client/modules/renderers/hd2d/hd2dFxOverlay.js
  - tests/core/knowledge/AreaEnteredFxIntegration.test.js
---

# 🏰 GKL ブランチ検出・フロアキャッシュ分離 ＆ エリア突入アナウンス演出アーキテクチャ

## 1. 背景と課題

NetHack 5.0 において、ステータス行（Index 20 / `BL_DLEVEL`）の階層表示は `Dlvl:3` のように単なる数値深度のみが出力され、ブランチ名（ダンジョン本流、ノームの鉱山、倉庫番等）が含まれません。
これにより、以下の課題と発展の機会が存在します：

1. **同一度数（Dlvl）重複によるキャッシュ混同（ゴースト階段・地形混線リスク）**:
   - 例えばダンジョン本流の地下3階（`Dlvl:3`）と、ノームの鉱山の地下3階（`Dlvl:3`）が同じキーとして扱われると、階段キャッシュや地形記憶が混ざり合い、再訪時やマップ復元時に不整合を引き起こすリスクがあります。
2. **現代的RPG体験・探索没入感の欠如**:
   - 近年のアクションRPG（ダークソウル、エルデンリング等）やローグライク作品では、新エリアや特殊フロアへの到達時に「**ノームの鉱山 (The Gnomish Mines)**」「**倉庫番 (Sokoban)**」といったエリア名がドラマチックに画面中央へフェードイン表示されるシネマティック演出が標準となっています。
   - NetHack のクラシックな体験を尊重しつつ、WebUI のオーバーレイ技術によってモダンな冒険感を大幅に強化できます。

---

## 2. ブランチ検出メカニズム (3重検出アプローチと C メモリ直結)

Cコアのコードを改変せず、以下の3段階のハイブリッド手法で現在フロアのブランチを特定します。特に Phase 8 Direct Binding 稼働後は、**レベル3 (C メモリ直結)** が第一真値として決定論的に機能します。

```mermaid
flowchart TD
    WASM[NetHack WASM C コア] -->|1. メモリ直結 SHIM_CMD_GET_PLAYER_SUMMARY| DBS[WasmDirectBindingService]
    WASM -->|2. 特殊グリフ/階段移動| ASM[AreaStateManager]
    WASM -->|3. メッセージ送出| MCR[MessageContextResolver / GKLPlugin]
    
    DBS -->|dnum / dlevel / moves| ASM
    MCR -.->|フォールバック| ASM
    
    ASM -->|syncPlayerSummary: isNewBranch| ER[GKLEventRouter (inputRequired settled)]
    ER -->|areaEntered イベント| Core[WebUICore]
    ER -->|onAreaEntered(syncedAreaInfo)| FXC[GKLFxCoordinator]
    
    FXC -->|fx_trigger: AREA_ENTERED| VFD[VisualFxDispatcher]
    VFD -->|dispatchFx| Renderers[MainViewportRenderer / HD2DFxOverlay / ZoomRenderer]
    Renderers -->|drawAreaBanner| Banner[スクリーン中央上部エリア突入バナー]
```

### ① レベル1: Phase 8 (Native Shim) C メモリ直結判定 (確定真値・決定論的)
- `WasmDirectBindingService.getPlayerSummary()` 経由で C コアの `u.uz.dnum`（ダンジョン番号）および `u.uz.dlevel` を直接取得。
- 全9ブランチ（`dungeon`, `mines`, `sokoban`, `gehennom`, `quest`, `fort_ludios`, `vlad_tower`, `elemental_planes`, `tutorial`）を 0ms・メッセージ不要で 100% 同定。
- `AreaStateManager.syncPlayerSummary(summary)` がブランチの変化（`currentBranchId !== branchId`）を検出し、`isNewBranch: true` を付与した `syncedAreaInfo` を返却。

### ② レベル2: メッセージ駆動型判定 (高信頼・補助判定)
NetHack コアがフロア突入時や階段移動時に送出する固有メッセージをフック（Direct Binding 未接続時のフォールバック）：

| 検知パターン (正規表現 / 文字列) | ブランチID (`branchId`) | 表示用日本語名 | 英語名 | 演出スタイル (`theme`) |
| :--- | :--- | :--- | :--- | :--- |
| `Welcome to the Gnomish Mines!` | `mines` | **ノームの鉱山** | The Gnomish Mines | `cave` (鉱山・土埃) |
| `Welcome to the town of Minetown!` / `Welcome to Minetown!` | `minetown` | **ノームの町** | Minetown | `cave` (街・石畳) |
| `Welcome to Mine's End!` | `mines_end` | **鉱山の最下層** | Mine's End | `cave` (深紅) |
| `Welcome to Sokoban!` | `sokoban` | **倉庫番** | Sokoban | `puzzle` (知性・青) |
| `Welcome to Fort Ludios!` | `fort_ludios` | **フォート・ルディオス** | Fort Ludios | `gold` (黄金) |
| `Welcome to the Valley of the Dead!` | `valley_of_the_dead` | **死の谷** | Valley of the Dead | `hell` (紫煙・死霊) |
| `Welcome to Gehennom!` / `Entering Gehennom...` | `gehennom` | **ゲヘナ** | Gehennom | `hell` (火炎・獄炎) |
| `Welcome to Vlad's Tower!` | `vlad_tower` | **ヴラドの塔** | Vlad's Tower | `vampire` (血塗られた塔) |
| `Welcome to the Wizard's Tower!` | `wizard_tower` | **魔法使いの塔** | The Wizard's Tower | `hell` (秘術) |
| `Astral Plane` | `astral_plane` | **天上界 (アストラル界)** | Astral Plane | `celestial` (神聖) |

### ③ レベル3: 地形・階段トポロジー判定 (補助)
- ダンジョン本流から鉱山への分岐階段（分岐先情報）をトラッキング。
- 鉱山特有の不規則な岩壁（rough-hewn rock）やソコバン特有の石壁配置パターンによる補助識別。

---

## 3. GKL 階層キャッシュのブランチ完全分離 ＆ リスタート保護

### 3.1 キャッシュキーの設計
`AreaStateManager` および `DungeonLandmarkRegistry` が管理する階層別キャッシュのキーを、従来の数値 `dlvl` から以下のように名前空間分離しています：

$$\text{FloorKey} = \text{branchId} + \text{":"} + \text{dlvl}$$

- 例:
  - ダンジョン本流 地下3階: `dungeon:3`
  - ノームの鉱山 地下3階: `mines:3`
  - 倉庫番 1階: `sokoban:1` (ゲーム内部的には Dlvl:6〜9 付近)

### 3.2 ゲームリスタート時のリセット仕様 (`AreaStateManager.resetAll`)
別ブランチ（例: `mines` や `sokoban`）のプレイ中またはゲームオーバー後にゲームを再開（リスタート）した際、旧セッションのブランチ状態が残存していると、ゲーム開始時（初期フロア `dungeon:1`）に「ブランチが変わった」と誤認して `AREA_ENTERED` が誤発火する危険性があります。

これを確実に防止するため、`AreaStateManager.resetAll()` では以下のブランチ追跡状態を完全に初期化します：

```javascript
resetAll() {
    this.clearGrid();
    this.isTurnTransitioning = false;
    this.isFloorTransitioning = false;
    this._needsFullTerrainDump = true;
    this._hasPlayerPosOnCurrentFloor = false;
    this._pendingStatusFloorKey = null;

    // ★ ブランチ追跡状態の完全初期化 (初期フロア Dlvl:1 での誤発火を防止)
    this.currentBranchId = 'dungeon';
    this.currentDnum = 0;
    this.currentDlevel = 1;
    this.playerSummary = null;

    if (this.directBindingService && typeof this.directBindingService.clearFloorCaches === 'function') {
        this.directBindingService.clearFloorCaches();
    }
}
```

---

## 4. エリア突入アナウンス演出パイプライン (Visual FX & Sound)

### 4.1 イベント発火フロー (`GKLEventRouter` ⇄ `GKLFxCoordinator`)
ターン確定時（`inputRequired settled` ステップ 10）、`AreaStateManager.syncPlayerSummary` の戻り値 `syncedAreaInfo.isNewBranch === true` の場合に以下を実行します：

1. `core.emit('areaEntered', syncedAreaInfo)`: 汎用エリア突入イベントを発行（ログ・音響・手帳向け）。
2. `p.fxCoordinator.onAreaEntered(syncedAreaInfo)` を呼び出し、演出トリガーを発行：
   ```javascript
   this.emitFxTrigger({
       type: 'AREA_ENTERED',
       branchId: areaInfo.branchId,
       floorKey: areaInfo.floorKey,
       dlevel: areaInfo.dlevel ?? 1,
       title: areaInfo.branchName || areaInfo.title || 'Dungeon',
       titleJa: areaInfo.branchNameJa || areaInfo.titleJa || 'ダンジョン',
       subtitle: areaInfo.subtitle || `Level ${dlevel}`,
       subtitleJa: areaInfo.subtitleJa || `地下 ${dlevel} 階`,
       theme: areaInfo.theme || 'dungeon',
       bannerDurationMs: areaInfo.bannerDurationMs || 4000
   });
   ```

### 4.2 テーマ別カラーパレット (`AREA_BANNER_THEMES`)
`drawAreaBanner.js` にて、ブランチの雰囲気に合わせたアクセント・ボーダー・グロー色を定義しています：

| テーマ (`theme`) | 対象ブランチ例 | `accent` (テキスト) | `border` (枠線) | `glow` (影・光彩) |
| :--- | :--- | :--- | :--- | :--- |
| `dungeon` | 本流ダンジョン | `#94a3b8` (スレート灰) | `rgba(148, 163, 184, 0.75)` | `#64748b` |
| `cave` | ノームの鉱山 | `#fbbf24` (琥珀・金) | `rgba(251, 191, 36, 0.85)` | `#f59e0b` |
| `hell` | ゲヘナ・死の谷 | `#f87171` (深紅) | `rgba(239, 68, 68, 0.85)` | `#dc2626` |
| `puzzle` | 倉庫番 | `#38bdf8` (知性シアン) | `rgba(56, 189, 248, 0.85)` | `#0284c7` |
| `quest` | クエスト | `#c084fc` (神秘パープル) | `rgba(192, 132, 252, 0.85)` | `#9333ea` |
| `gold` | フォート・ルディオス | `#facc15` (純金イエロー) | `rgba(250, 204, 21, 0.85)` | `#ca8a04` |
| `vampire` | ヴラドの塔 | `#ef4444` (鮮血レッド) | `rgba(220, 38, 38, 0.85)` | `#991b1b` |
| `celestial` | 元素界・アストラル界 | `#2dd4bf` (天界エメラルド) | `rgba(45, 212, 191, 0.85)` | `#0d9488` |
| `tutorial` | チュートリアル | `#4ade80` (若葉グリーン) | `rgba(74, 222, 128, 0.85)` | `#16a34a` |

### 4.3 スクリーン空間バナー描画アルゴリズム (`drawAreaBanner.js`)
ビューポートのグリッド座標（タイル座標）に縛られず、**スクリーン空間（Canvas Viewport 中央上部）** にオーバーレイ描画されます。

1. **アルファ・アニメーション推移 (`computeAreaBannerAlpha`)**:
   - `0.0 <= progress < 0.15` (フェードイン & 上部からのスライドイン): $\alpha = \frac{\text{progress}}{0.15}$。開始時に上方向へ 10px オフセットした位置からスライド。
   - `0.15 <= progress <= 0.80` (ホールド): $\alpha = 1.0$。中央上部（Canvas 高さの約 22% 位置、最大幅 420px）で安定表示。
   - `0.80 < progress <= 1.0` (フェードアウト): $\alpha = \frac{1.0 - \text{progress}}{0.20}$。
2. **多言語タイトル合成**:
   - `lang === 'ja'` の場合: メインタイトルに `titleJa`（例:「ノームの鉱山」）、サブタイトルに英語名と階層（例:「The Gnomish Mines — 地下 2 階」）を表示。
   - `lang === 'en'` の場合: メインタイトルに `title`（例:「The Gnomish Mines」）、サブタイトルに階層（例:「Level 2」）を表示。
3. **上書き置換ルール**:
   - 短時間の間に連続してエリア突入が発生した場合、レンダラー（`MainViewportRenderer`, `HD2DFxOverlay`, `ZoomRenderer`）の `addVisualFx` 内で既存の `AREA_ENTERED` をフィルタリング除外し、最新のバナーに即時上書き置換されます。

---

## 5. 統合検証と品質保証 (`AreaEnteredFxIntegration.test.js`)

自動テストスイート `tests/core/knowledge/AreaEnteredFxIntegration.test.js` において、以下の網羅的な統合検証を実施しています：

- **新規ブランチ突入検証**:
  - `dnum: 2, dlevel: 2` (Mines) への突入時に `areaEntered` イベントおよび `fx_trigger (AREA_ENTERED)` が正確に発火すること。
- **同一ブランチ内階層移動検証**:
  - `mines:2` から `mines:3` への階層移動時は `isNewBranch: false` となり、`AREA_ENTERED` が発火しないこと。
- **リスタート時のリセット保護検証**:
  - `AreaStateManager.resetAll()` 実行後、初期状態（`dungeon:1`）に正しく初期化され、誤発火しないこと。
- **バナー進行度アルファ値計算検証**:
  - `computeAreaBannerAlpha` の境界値（0.0, 0.075, 0.15, 0.50, 0.80, 0.90, 1.0）における計算精度。
- **Canvas レンダラー描画検証**:
  - `drawAreaBanner` が日本語・英語設定で正しく Canvas API（`fillText`, `stroke`, `fillRect`）を呼び出し、アルファ 0 で早期リターンすること。
