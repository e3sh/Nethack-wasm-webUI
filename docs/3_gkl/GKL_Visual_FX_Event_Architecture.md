# GKL 演出トリガーイベント仕様 & クライアント実装設計書

本ドキュメントは、Game Knowledge Layer (GKL) と UI クライアント（演出家）の間で、操作テンポを損なわずに効果的なゲームフィール（手応え・フィードバック）を実現するための**演出トリガーイベント仕様**および **`GklPureJSClient` における実装ガイドライン**をまとめた設計資料です。

---

## 1. 設計思想と責務分離

```text
┌────────────────────────────────────────┐
│      GKL (Game Knowledge Layer)        │ ◀── 事実・コンテキスト（何がどこで起きたか）
│ - ContextAction（隣接敵・攻撃先検知）   │
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
│ - タイル点滅・フラッシュ               │
│ - 斬撃/火花エフェクト描画               │
│ - 微小画面シェイク / ダメージ数値      │
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

イベント名は `fx_trigger` として統一し、`payload.type` で識別します。

```typescript
interface FxTriggerPayload {
  type: 
    | 'ATTACK_HIT' 
    | 'DAMAGE_TAKEN' 
    | 'KILL_CONFIRMED' 
    | 'RECOVER_HEAL'
    | 'PLAYER_DIED'
    | 'PLAYER_RESURRECTED';
  targetX?: number;      // 発生対象のマップ座標 X (0〜79)
  targetY?: number;      // 発生対象のマップ座標 Y (0〜23)
  isPlayer?: boolean;    // 自キャラ対象フラグ
  amount?: number;       // 変動量（ダメージ量 / 回復量）
  currentHp?: number;    // 現在HP
  maxHp?: number;        // 最大HP
  text?: string;         // トリガーとなった元テキストメッセージ
  timestamp: number;     // 発火時刻 (Date.now())
}
```

### イベント種別一覧

| 種別 (`type`) | 発火タイミング（GKL側） | ペイロード情報 | 推奨される演出表現（UI側） |
| :--- | :--- | :--- | :--- |
| `ATTACK_HIT` | ContextActionの攻撃ボタン押下時、または隣接敵への近接攻撃成立時 | `targetX, targetY` | 敵マスの一瞬の白/赤フラッシュ、または斜め斬撃・火花スプライト（約100ms） |
| `DAMAGE_TAKEN` | 自キャラの `currentHP < prevHP` を検知した時 | `targetX, targetY, amount` | 自キャラマスの赤色点滅、画面の微小シェイク（1〜2px振動）、被弾SE |
| `KILL_CONFIRMED` | 攻撃直後に敵Glyphが消滅、または死体/アイテムが出現した時 | `targetX, targetY` | 対象マスに煙・消滅パーティクル、または撃破SE |
| `RECOVER_HEAL` | 自キャラの `currentHP > prevHP`（回復）またはレベルアップ時 | `targetX, targetY, amount` | 自キャラ足元からの緑/黄色の光のエフェクト上昇 |
| `PLAYER_DIED` | メッセージ `You die...` / `あなたは死んだ` 受信時 | `targetX, targetY, isPlayer, text` | **自キャラマスへの墓石タイル (glyph 4011 / tile 1310) 描画**、バウンス停止、死亡エフェクト・画面シェイク |
| `PLAYER_RESURRECTED` | 命の魔除け等による蘇生メッセージ受信時 | `targetX, targetY, isPlayer, text` | 墓石表示の解除・自キャラタイルの復元、蘇生光輪エフェクト |

---

## 3. GklPureJSClient での演出実装ガイド

`examples/gkl-pure-js-client/main.js`（FocusCamera / ZoomMap）での組み込み例です。

### 3.1. エフェクトキュー（FX Queue）の管理
UIクライアント内で、一時的な演出オブジェクトを配列（またはMap）で保持します。

```javascript
// クライアントの初期化時
this.activeFxList = []; // { type, gx, gy, startTime, durationMs, color }

// イベント購読
this.core.on('fx_trigger', (fx) => {
  if (fx.type === 'ATTACK_HIT') {
    this.activeFxList.push({
      type: 'SLASH',
      gx: fx.targetX,
      gy: fx.targetY,
      startTime: performance.now(),
      durationMs: 120,
      color: '#fff'
    });
  } else if (fx.type === 'DAMAGE_TAKEN') {
    // 画面シェイクをトリガー
    this.triggerScreenShake(2, 100);
  }
});
```

### 3.2. FocusCamera（`renderZoomMap`）での描画
FocusCamera の Layer 4 (Effect) または最前面オーバーレイとして描画ループ内で描画・破棄します。

```javascript
// レンダリングループ内 (renderZoomMap)
const now = performance.now();
this.activeFxList = this.activeFxList.filter(fx => {
  const elapsed = now - fx.startTime;
  if (elapsed >= fx.durationMs) return false; // 期限切れで自動破棄

  const progress = elapsed / fx.durationMs; // 0.0 〜 1.0

  // FocusCamera 中心からの相対画面座標を算出
  const screenX = (fx.gx - px + halfRangeX) * zoomTileSize;
  const screenY = (fx.gy - py + halfRangeY) * zoomTileSize;

  if (screenX >= 0 && screenX < canvasW && screenY >= 0 && screenY < canvasH) {
    if (fx.type === 'SLASH') {
      // 斬撃エフェクトの描画（斜めライン）
      this.zoomCtx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
      this.zoomCtx.lineWidth = 3;
      this.zoomCtx.beginPath();
      this.zoomCtx.moveTo(screenX + 6, screenY + 6);
      this.zoomCtx.lineTo(screenX + zoomTileSize - 6, screenY + zoomTileSize - 6);
      this.zoomCtx.stroke();
    }
  }
  return true;
});
```

---

## 4. 今後の展開と拡張性（アイデアメモ）

* **AoE / 遠距離ターゲット指定の統合**:
  - 投擲・魔法詠唱モード時に `this.core.emit('targeting_preview', { originX, originY, path: [...] })` を発行し、射線や効果範囲をオーバーレイ描画。
* **サウンド（SE）との連携**:
  - `fx_trigger` はビジュアルエフェクトだけでなく、効果音再生マネージャー（SoundManager）のトリガーとしてもそのまま共有可能。
