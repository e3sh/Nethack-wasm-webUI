---
title: SpatialPatternEngine (空間幾何学認識エンジン) 仕様・アーキテクチャ設計書
status: proposed
last_updated: 2026-09-21
related_docs:
  - docs/3_gkl/Dungeon_Tracker_and_Checkpoint_Architecture.md
  - docs/3_gkl/GKL_Visual_FX_Event_Architecture.md
  - docs/3_gkl/TacticalAdvisor_Specification_and_Architecture.md
---

# SpatialPatternEngine (空間幾何学認識エンジン) 仕様・アーキテクチャ設計書

本書は、NetHack Game Knowledge Layer (GKL) における基底認識レイヤー（Perception Layer）として機能する **SpatialPatternEngine (空間幾何学認識エンジン)** の設計思想、幾何学シグナルプロトコル、空間パターン認識アルゴリズム、および各コンシューマー（UI・演出・アドバイザー）へのインターフェース規則をまとめた公式仕様書です。

---

## 1. 背景と設計思想 (Motivation & Philosophy)

### 1.1 解決する課題
NetHackの描画プロトコル（WASM/TTY）から送られてくる情報は、マス目単位の「生グリフ（Glyph ID）」に過ぎません。
しかし、プレイヤーの意思決定や高度なUI演出を行うには、以下のような**「空間的な文脈・配置関係（コンテキスト）」**を理解する必要があります：
- 「床の刻み文字が2マス並んでいる（＝プレイヤーが意図した旗立て・目印）」
- 「箱が同じマスまたは近傍に複数集まっている（＝プレイヤーが集積した拠点）」
- 「蜂（`f`）や蝋の床が密集している（＝蜂の巣）」
- 「壁で四方を塞がれた孤立空間に金貨がある（＝隠し金庫 Vault）」

### 1.2 責務の明確化：基底認識エンジンとしての独立
本エンジンは、特定のUI（DungeonTrackerModal等）や演出の従属物ではなく、**「グリフマップの空間構造を解析し、幾何学的コンテキストを抽出する純粋な認識基盤」**として完全に独立します。

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Consumers / Feature Layer                       │
│ ┌───────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────┐ │
│ │ CheckPoint    │ │ DungeonTracker │ │ CustomTile     │ │ Tactical   │ │
│ │ (旗立て・拠点)│ │ (踏破サマリー) │ │ (拡張描画/FX)  │ │ Advisor    │ │
│ └───────┬───────┘ └───────┬────────┘ └───────┬────────┘ └─────┬──────┘ │
└─────────┼─────────────────┼──────────────────┼────────────────┼────────┘
          │                 │                  │                │ 利用
┌─────────▼─────────────────▼──────────────────▼────────────────▼────────┐
│        【基底認識レイヤー】SpatialPatternEngine (空間幾何学解析)         │
│  - 2マス隣接刻み文字の検出 (CheckpointDetector)                        │
│  - 箱の密集・重ね箱クラスタの検出 (ContainerClusterDetector)           │
│  - 特殊部屋・地形パターンの識別 (RoomClassifier: 蜂の巣, 金庫, 兵舎)   │
│  - 幾何学的重心・中間座標 (Sub-pixel Centroid) の計算                  │
├────────────────────────────────────────────────────────────────────────┤
│          AreaStateManager (生グリフ走査・タイルマップメモリ管理)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 空間幾何学シグナルプロトコル (Spatial Signal Protocols)

### 2.1 チェックポイント旗立てプロトコル (🚩 Dual-Engraving)
C言語ソースコードの改変を行わず、文字列（テキスト）も読めないロード直後の制約をクリアするため、**「2マスの幾何学的隣接関係」**をプロトコルとします。

#### 【判定規則】
- **トリガー**: `GLYPH_ENGRAVING` が、8近傍（チェビシェフ距離 = 1）に連続して2マス並んでいること。
- **中間座標（Centroid）の算出**:
  2マスの中心となるサブピクセル座標を計算し、演出用アンカーとして提供します。
  $$x_{\text{center}} = \frac{x_A + x_B}{2}, \quad y_{\text{center}} = \frac{y_A + y_B}{2}$$

```typescript
interface CheckpointGeometry {
  cellA: { x: number, y: number };
  cellB: { x: number, y: number };
  center: { x: number, y: number }; // 境界中央
  orientation: 'horizontal' | 'vertical' | 'diagonal';
}
```

#### 【なぜこのプロトコルなのか】
1. **自然生成との重複ゼロ**: NetHackの自動生成で刻み文字が2マス連続生成されることはないため、誤認率0%。
2. **ノーコスト・高速**: 指（`#engrave` -> `-`）で2ターンで設営可能。
3. **ロード復帰完全耐性**: テキスト内容を一切読まず、グリフIDの配置だけで100%復元可能。

---

### 2.2 コンテナ・クラスタリングプロトコル (Container Clustering)
ダンジョン内に存在する箱・袋（`LARGE_BOX`, `CHEST`, `SACK` 等）の密集度を解析します。

- **単独配置 (`isCluster: false`)**: スルーした鍵箱や道中のドロップ品。
- **密集配置 (`isCluster: true`)**: マンハッタン距離 $\le 2$ の範囲内に複数の箱が存在、または同一マスの重ね箱。
  ➔ **「拠点（ベースキャンプ）」** の強力な幾何シグネチャ。

---

### 2.3 特殊部屋・地形パターン認識 (Room Pattern Classifier)
ダンジョン生成アルゴリズム特有の幾何学タイル配置をパターンマッチングします：

| 対象 | 幾何パターン / グリフ条件 | 判定結果 |
| :--- | :--- | :--- |
| **蜂の巣 (Beehive)** | 蝋（Wax）の床、または一定密度以上の蜂（`f`）クラスタ | `ROOM_BEEHIVE` |
| **隠し金庫 (Vault)** | 四方を壁で完全に囲まれた孤立小部屋（2x2〜3x3）＋金貨（`$`） | `ROOM_VAULT` |
| **兵舎 (Barracks)** | ベッド等の家具が格子状に整列した空間 | `ROOM_BARRACKS` |

---

## 3. コンシューマーへの提供インターフェース (API & Output)

本エンジンの解析結果は、純粋なデータ構造として各上位レイヤーへ提供されます：

```typescript
interface SpatialAnalysisResult {
  checkpoints: CheckpointGeometry[];    // 検出された旗（🚩）
  containers: {
    total: number;                      // 総箱数
    clusters: ContainerCluster[];       // 拠点候補クラスタ
    isolated: ContainerNode[];          // 単独の箱
  };
  features: {
    specialRooms: SpecialRoomNode[];    // 蜂の巣、金庫など
  };
}
```

---

## 4. 拡張描画・レンダラー連携（仮想タイル / オートタイル）

本エンジンの判定結果は、描画層において**「公式Glyphを上書きするカスタム拡張タイル」**のトリガーとしても機能します。

1. **ベースキャンプタイルの合成**:
   - `checkpoints`（2マスEngraving）の `center` 座標に対して、2マスぶち抜きの「野営地（焚き火とテント）」グラフィックをオーバーレイ描画。
2. **特殊地形の専用タイル化**:
   - `ROOM_BEEHIVE` と判定された床を「ハニカム（蜜蝋）タイル」に動的差し替え。
   - `ROOM_VAULT` と判定された壁を「重厚な金庫鉄壁」に差し替え。

---

## 5. 構築・テスト戦略 (TDD Roadmap)

本エンジンは**純粋関数型（ステートレス）の幾何計算モジュール**として実装されるため、NetHack本体やブラウザUIを起動せず、Jest単体テストのみで100%開発・検証が可能です。

### テストケース例 (`SpatialPatternEngine.test.js`)
1. **隣接Engraving検出テスト**:
   - 水平、垂直、斜めに2マス並んだグリフ配列から、正しく `center` 座標と方向が返るか。
   - 孤立した1マスのみのEngravingでは反応しないか。
2. **コンテナ密集テスト**:
   - 3x3内に箱が3個ある場合、`isCluster: true` と判定されるか。
3. **金庫（Vault）幾何判定テスト**:
   - 壁に囲まれた2x2の空間にゴールドがある場合、`ROOM_VAULT` が検出されるか。
