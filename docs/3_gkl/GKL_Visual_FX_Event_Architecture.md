---
title: GKL 演出トリガーイベント仕様 & クライアント実装設計書
status: implemented
last_updated: 2026-10-29
related_code:
  - src/core/WebUICore.js
  - src/core/index.d.ts
  - src/core/knowledge/coordinators/GKLEventRouter.js
  - src/core/knowledge/coordinators/GKLFxCoordinator.js
  - examples/gkl-pure-js-client/modules/effects/VisualFxDispatcher.js
  - examples/gkl-pure-js-client/modules/renderers/fx/drawAreaBanner.js
  - examples/gkl-pure-js-client/modules/renderers/MainViewportRenderer.js
  - examples/gkl-pure-js-client/modules/renderers/ZoomRenderer.js
  - examples/gkl-pure-js-client/modules/renderers/hd2d/hd2dFxOverlay.js
  - tests/core/knowledge/AreaEnteredFxIntegration.test.js
---

# GKL 演出トリガーイベント仕様 & クライアント実装設計書

> [!NOTE]
> **ステータス**: `🟢 implemented` (実装完了・現行仕様：`VisualFxDispatcher.js` および 2D/3D レンダラー統合済み)

本ドキュメントは、Game Knowledge Layer (GKL) と UI クライアント（演出家）の間で、操作テンポを損なわずに効果的なゲームフィール（手応え・フィードバック）を実現するための**演出トリガーイベント仕様**および **`GklPureJSClient` における実装ガイドライン**をまとめた設計資料です。

---

## 1. 設計思想と責務分離

```text
┌────────────────────────────────────────┐
│      GKL (Game Knowledge Layer)        │ ◀── 事実・コンテキスト（何がどこで起きたか）
│ - VisualFxDispatcher（攻撃・被弾・撃破） │
│ - StatusAccessor（HP減少・回復検知）    │
└───────────────────┬────────────────────┘
                    │ core.emit('fx_trigger', payload)
                    ▼
┌────────────────────────────────────────┐
│         WebUICore (Event Bus)          │ ◀── 共通イベント基盤（既存 EventEmitter）
└───────────────────┬────────────────────┘
                    │ core.on('fx_trigger', handler)
                    ▼
┌────────────────────────────────────────┐
│     UI Client / 演出家 (GKL Client)     │ ◀── 表現・演出（どう見せるか・彩るか）
│ - MainViewportRenderer / WebGPU HD-2D  │
│ - 斬撃/火花エフェクト・浮遊ダメージ    │
│ - 微小画面シェイク / SoundCoordinator  │
└────────────────────────────────────────┘
```

### 設計原則
1. **GKL は「演出のきっかけと座標情報」を通知するだけに徹する**
   - 描画コンポーネントやアニメーションタイマーの詳細には関知しない。
2. **UI 側が「演出スタイル」を自由に選択・実装する（オプトイン）**
   - リッチな演出を行うクライアントも、演出をスキップする軽量ターミナルUIも共存可能。
3. **ローグライクの「サクサク進む操作テンポ」を最優先する**
   - アニメーション待ちによる入力ブロッキングは一切行わず、非同期・数フレーム（100〜200ms以内）の即時消滅エフェクトに留める。

---

## 2. 演出トリガーイベント仕様

イベント名は `fx_trigger` として統一し、`payload.type` で識別します（型定義: `src/core/index.d.ts` の `FxTriggerPayload` 準拠）。

```typescript
export interface FxTriggerPayload {
  type: 
    | 'ATTACK_HIT' 
    | 'DAMAGE_TAKEN' 
    | 'DAMAGE_DEALT'
    | 'KILL_CONFIRMED' 
    | 'RECOVER_HEAL'
    | 'PLAYER_DIED'
    | 'PLAYER_RESURRECTED'
    | 'AREA_ENTERED';
  targetX?: number;      // 発生対象のマップ座標 X (0〜79)
  targetY?: number;      // 発生対象のマップ座標 Y (0〜23)
  isPlayer?: boolean;    // 自キャラ対象フラグ
  amount?: number;       // 変動量（ダメージ量 / 回復量）
  currentHp?: number;    // 現在HP
  maxHp?: number;        // 最大HP
  text?: string;         // トリガーとなった元テキストメッセージ
  timestamp: number;     // 発火時刻 (Date.now())
  byPlayer?: boolean;    // プレイヤーによる攻撃フラグ
  isPeaceful?: boolean;  // 平和NPCフラグ
  isTame?: boolean;      // ペットフラグ

  // --- AREA_ENTERED 固有フィールド ---
  /** ダンジョンブランチID ('dungeon' | 'mines' | 'sokoban' | 'gehennom' | 'quest' | 'fort_ludios' | 'vlad_tower' | 'elemental_planes' | 'tutorial') */
  branchId?: string;
  /** フロア識別キー (例: 'Dlvl:1', 'mines:2') */
  floorKey?: string;
  /** 階層の深さ (1〜) */
  dlevel?: number;
  /** ブランチ英語名 (例: 'The Gnomish Mines') */
  title?: string;
  /** ブランチ日本語名 (例: 'ノームの鉱山') */
  titleJa?: string;
  /** サブタイトル英語表記 (例: 'Level 2') */
  subtitle?: string;
  /** サブタイトル日本語表記 (例: '地下 2 階') */
  subtitleJa?: string;
  /** 演出テーマ ('dungeon' | 'cave' | 'hell' | 'puzzle' | 'quest' | 'gold' | 'vampire' | 'celestial' | 'tutorial') */
  theme?: string;
  /** バナー表示持続時間 (ミリ秒、デフォルト 4000) */
  bannerDurationMs?: number;
}
```

### イベント種別一覧

| 種別 (`type`) | 発火タイミング（GKL側 `GKLFxCoordinator` / `GKLEventRouter`） | ペイロード情報 | 推奨される演出表現（UI側） |
| :--- | :--- | :--- | :--- |
| `ATTACK_HIT` | 隣接する**敵対モンスター**への近接攻撃成立時（※平和NPC `mpeaceful`・ペット `mtame` との位置交換や会話時は誤爆抑止） | `targetX, targetY` | 敵マスの一瞬の白/赤フラッシュ、または斜め斬撃・火花スプライト（約100ms） |
| `DAMAGE_TAKEN` | 自キャラの `currentHP < prevHP` を検知した時 | `targetX, targetY, amount` | 自キャラマスの赤色点滅、**頭上への浮遊ダメージ数値 (`-X`, 赤色/黒縁取り) ポップアップ**、画面の微小シェイク（1〜2px振動）、被弾SE |
| `DAMAGE_DEALT` | C コア 0x24 / 0x25 差分検知によりモンスターへの与ダメージが確定した時 | `targetX, targetY, amount, isTame, isPeaceful` | **敵頭上への浮遊与ダメージ数値 (`-X`, 橙色/白縁取り) ポップアップ** |
| `KILL_CONFIRMED` | 攻撃直後に敵Glyphが消滅、または死体/アイテムが出現した時 | `targetX, targetY` | 対象マスに煙・消滅パーティクル、または撃破SE |
| `RECOVER_HEAL` | 自キャラの `currentHP > prevHP`（回復）またはレベルアップ時 | `targetX, targetY, amount` | 自キャラ足元からの緑/黄色の光のエフェクト上昇、**頭上への浮遊回復数値 (`+X`, 緑色/黒縁取り) ポップアップ** |
| `PLAYER_DIED` | メッセージ `You die...` / `あなたは死んだ` 受信時 | `targetX, targetY, isPlayer, text` | **自キャラマスへの墓石タイル (glyph 4011 / tile 1310) 描画**、バウンス停止、死亡エフェクト・画面シェイク |
| `PLAYER_RESURRECTED` | 命の魔除け等による蘇生メッセージ受信時 | `targetX, targetY, isPlayer, text` | 墓石表示の解除・自キャラタイルの復元、蘇生光輪エフェクト |
| `AREA_ENTERED` | 新規ブランチ突入時 (`AreaStateManager.syncPlayerSummary` で `isNewBranch: true` 確定時) | `branchId, floorKey, dlevel, title, titleJa, subtitle, subtitleJa, theme, bannerDurationMs` | **ビューポート中央上部へのシネマティックブランチバナー表示**（フェードイン・ホールド・フェードアウト、テーマカラー発光） |

---

## 3. GklPureJSClient での演出実装ガイド

`examples/gkl-pure-js-client/modules/renderers/MainViewportRenderer.js`（2D ビューポート）、`ZoomRenderer.js`、および `hd2d/hd2dFxOverlay.js`（WebGPU 3D オーバーレイ）での組み込み構成です。

### 3.1. 空間分類：グリッド空間 FX と スクリーン空間 FX
演出エフェクトは、描画対象の座標系によって 2 種類に分類されます：

1. **グリッド追従型 FX (`DAMAGE_POPUP`, `SLASH` 等)**:
   - マップ上の特定マス（`gx, gy`）に紐付き、カメラのスクロールやズーム移動に追従して描画されます。
2. **スクリーン空間固定 FX (`AREA_ENTERED` エリアバナー)**:
   - マップ座標に依存せず、常に Canvas ビューポートの中央上部に固定描画されます。

### 3.2. エフェクトキュー（FX Queue）と上書き置換ルール
UI クライアントの `VisualFxDispatcher` が `fx_trigger` を受信し、各レンダラーの `addVisualFx(fx)` に投入します。

```javascript
// VisualFxDispatcher.js
else if (fx.type === 'AREA_ENTERED') {
  const durationMs = fx.bannerDurationMs || fx.durationMs || 4000;
  this.dispatchFx({
    type: 'AREA_ENTERED',
    branchId: fx.branchId,
    floorKey: fx.floorKey,
    dlevel: fx.dlevel,
    title: fx.title,
    titleJa: fx.titleJa,
    subtitle: fx.subtitle,
    subtitleJa: fx.subtitleJa,
    theme: fx.theme || 'dungeon',
    startTime: now,
    durationMs
  });
  webgpu?.wakeUp();
}
```

#### 上書き置換（単一性保証）
階段を素早く連続昇降するなどして複数の `AREA_ENTERED` が発生した場合、古いバナーが重なって表示されるのを防ぐため、投入時に既存の `AREA_ENTERED` を除外して最新のものに置き換えます：

```javascript
// MainViewportRenderer.js / ZoomRenderer.js / hd2dFxOverlay.js
addVisualFx(fx) {
  if (!fx) return;
  if (fx.type === 'AREA_ENTERED') {
    // 既存の AREA_ENTERED を除外して最新バナーに置換
    this.activeFxList = this.activeFxList.filter(item => item.type !== 'AREA_ENTERED');
  } else if (fx.type === 'DAMAGE_POPUP') {
    // ...
  }
  this.activeFxList.push(fx);
}
```

### 3.3. スクリーン空間バナーの描画ライフサイクル (`drawAreaBanner.js`)
レンダリングループ内で経過時間（`elapsed`）から進行度（`progress = elapsed / fx.durationMs`）を計算し、`drawAreaBanner` を呼び出します：

```javascript
// レンダリングループ内
if (fx.type === 'AREA_ENTERED') {
  drawAreaBanner(this.ctx, fx, canvasW, canvasH, progress, this.currentLanguage);
  return true; // エフェクト継続
}
```

#### 描画ライフサイクル（進行度別フェーズ）
- **フェーズ 1: フェードイン & スライドイン (`0.0 <= progress < 0.15`, 約 0〜600ms)**:
  - $\alpha = \frac{\text{progress}}{0.15}$ で滑らかに透明度が増加。
  - 初期位置から上方向に 10px オフセットされた状態から目標位置へスムーズにスライド。
- **フェーズ 2: ホールド表示 (`0.15 <= progress <= 0.80`, 約 600〜3200ms)**:
  - $\alpha = 1.0$ で静止。テーマ別アクセント枠線（`border`）とグロー（`glow`）が輝く。
  - 日本語設定時は大見出しに和名（`titleJa`）、サブ見出しに「英名 — 階層」をコントラスト高く描画。
- **フェーズ 3: フェードアウト (`0.80 < progress <= 1.0`, 約 3200〜4000ms)**:
  - $\alpha = \frac{1.0 - \text{progress}}{0.20}$ で静かにフェードアウト。
  - $1.0$ に達した時点で配列から自動破棄。

---

## 4. 今後の展開と拡張性（アイデアメモ）

* **AoE / 遠距離ターゲット指定の統合**:
  - 投擲・魔法詠唱モード時に `this.core.emit('targeting_preview', { originX, originY, path: [...] })` を発行し、射線や効果範囲をオーバーレイ描画。
* **サウンド（SE）との連携**:
  - `fx_trigger` はビジュアルエフェクトだけでなく、効果音再生マネージャー（SoundManager）のトリガーとしてもそのまま共有可能。
