---
title: WebGPU HD-2D ジオラマレンダラー アーキテクチャ設計・移植ガイド
status: implemented
last_updated: 2026-09-21
related_code:
  - examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js
  - tests/ui/WebGPUHD2DRenderer.test.js
related_docs:
  - docs/2_client_ui/unified_renderer_and_screen_architecture_plan.md
---

# WebGPU HD-2D ジオラマレンダラー アーキテクチャ設計・移植ガイド

> [!NOTE]
> **ステータス**: `🟢 implemented` (実装完了・稼働中)  
> 生WebGPU / WGSL によるクオータビュー 3D ジオラマレンダラーとして実装・テスト完備。

本ドキュメントは、NetHack-wasm-webUI において実装・稼働している **WebGPU (WGSL) による HD-2D 風 3D ジオラマレンダラー (`WebGPUHD2DRenderer`)** の最新アーキテクチャ設計、シェーダー技法、視覚効果（軽量ライティング・パーティクル）、およびモダン Web コンポーネントへの移植ガイドをまとめた技術資料です。

---

## 1. 概要とコンセプト

### 1.1 背景と目的
2D タイルベースのクラシック・ローグライクゲームである NetHack の世界を、オクトパストラベラー風の「美しい 3D ミニチュア・ジオラマ」としてリアルタイムレンダリングします。
新規プレイヤーや技術コミュニティを惹きつける **「圧倒的なビジュアル・ショーケース（技術デモ）」** として機能するとともに、既存のゲームコア（Wasm、キーボード操作、探索ロジック、FocusCamera 等）に一切の悪影響を与えない完全アドオンとして設計されています。

### 1.2 コア原則
1. **完全アドオン＆非破壊設計**:
   既存の 2D Graphic Canvas や Color ASCII Grid と 1 クリックで相互切り替え可能。
2. **非アクティブ時・アイドル時の省電力設計**:
   非表示時は `cancelAnimationFrame` により描画ループが完全停止（0% CPU / 0 FPS）。表示中も操作やカメラ収束後に自動で間引き（Throttling 15 FPS）を行い、バッテリー消費を最小化。
3. **外部 3D ライブラリ依存ゼロ**:
   Three.js や Babylon.js などの重量級ライブラリを使わず、生 WebGPU API と純粋な WGSL のみで超軽量・高速に動作。
4. **安全な環境フォールバック**:
   WebGPU 非対応ブラウザでは静かに機能を無効化し、従来の 2D 表示にフォールバック。

---

## 2. 3D ジオラマの階層表現（レイヤー構造）

板ポリゴンとビルボードで構成される本レンダラーは、以下の6層レイヤーで立体ジオラマを構築しています。

| レイヤー | 種別 | 3Dジオラマ表現 | シェーダー・配置処理 |
| :--- | :--- | :--- | :--- |
| **Layer 0** | **床・地形** (Bottom) | 水平プレーン ($Y = 0.0$, XZ平面) | タイル絵柄を描画。透明部分は濃紺の石畳地色（`#1a1f26`）で補完 |
| **Layer 1** | **壁キューブ天面** | 水平プレーン ($Y = 0.45$, XZ平面) | 水平上面。上面テクスチャを描画 |
| **Layer 2** | **壁キューブ前面** | 垂直プレーン ($Z = +0.5$, $Y = 0.0 \sim 0.45$) | 立体的に立ち上がる前面。陰影（明度 $0.72\times$）で奥行きを強調 |
| **Layer 3** | **アイテム・宝箱** (Middle) | 静止水平プレーン ($Y = 0.12$, XZ平面) | 床面直上に静止配置。タイルの透過ピクセル（$a < 0.2$）を自動 `discard` |
| **Layer 4** | **キャラクター・モンスター** (Top) | スクリーン正対チルトビルボード ($Y = 0.44$, 高さ 0.88) | カメラの視線ベクトルに直交する Up 方向に展開。生存キャラは微小なふわふわ跳ねアニメ（animOffset）。プレイヤーは視認性微光オーラ。死亡時は静止墓石 |
| **Layer 5** | **過渡的エフェクト** (Effect) | 空中正対チルトビルボード ($Y = 0.45$, 高さ 0.88) | 投擲物・杖ビーム・爆発等のグリフ。自発光（減衰なし）で空中展開 |

---

## 3. WebGPU パイプライン ＆ シェーダー設計

### 3.1 メモリアライメント完全準拠のインスタンス構造 (32 bytes)
GPU パイプラインにおける JavaScript（`Float32Array`）と WGSL（頂点属性）のメモリ配置を完全に一致させるため、全属性を `float32` に統一し、32バイト境界（1インスタンス = 8 floats）に揃えています。

```typescript
// 1インスタンス = 8 floats (32 bytes stride)
[
  worldX,     // 0: float32 (X座標: 0〜79)
  worldY,     // 4: float32 (Y座標: 0.0)
  worldZ,     // 8: float32 (Z座標: 0〜23)
  layerType,  // 12: float32 (0:床, 1:壁天面, 2:壁前面, 3:アイテム, 4:キャラ, 5:エフェクト)
  isPlayer,   // 16: float32 (0.0: false, 1.0: true)
  animOffset, // 20: float32 (浮遊/歩行バウンス用位相, -1.0で完全静止)
  tileIndex,  // 24: float32 (NetHack タイルアトラス番号)
  tileLight   // 28: float32 (タイルの基礎環境明度: 0.2〜1.0) ★パディング領域を活用
]
```

### 3.2 軽量ライティング ＆ 動的ランタン視界（3Dライト不要の高効率設計）
板ポリゴンとビルボードで構成される空間では、法線やシャドウマップを計算する本格的な3Dライトは不自然な陰影や多大なGPU負荷の原因となります。
本レンダラーでは、**「タイルの基礎環境明度（`tileLight`）」** と **「プレイヤー中心の距離減衰（ランタン視界サークル）」** をシェーダー内で合成する独自設計を採用しています。

1. **タイル環境明度（CPU側判定）**:
   - **明るい部屋 (`S_room` / 3992):** 明度 `1.0`
   - **通路 (`S_corr` / 3995, 3997):** 明度 `0.45`
   - **暗い部屋 (`S_darkroom` / 3993):** 明度 `0.35`
   - **壁キューブ:** 明度 `0.75`
2. **プレイヤー中心のランタン光サークル（GPU側 WGSL 計算）**:
   - フラグメントシェーダーでプレイヤー位置との距離 `dist = distance(input.worldPos.xz, uniforms.playerPos)` を計算。
   - `torchLight = 1.0 - smoothstep(1.5, uniforms.lightRadius, dist)` により、滑らかな円形グラデーションを生成。
   - `light = clamp(max(input.tileLight * uniforms.ambientFloor, torchLight * 0.95), 0.22, 1.15)` で合成し、テクスチャ色に乗算。視界外の暗がりでも最低限のシルエット（0.22）を残し、探索の視認性を確保。
3. **動的視界伸縮アニメーション**:
   - プレイヤーが通路に入ると視界半径が `3.8` に縮小（閉塞感・緊張感）。
   - 明るい部屋に入ると視界半径が `7.5` に拡大（見通しの良い開放感）。
   - 毎フレーム `0.12` の係数でスムーズに補間（Lerp）。

```wgsl
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // プレイヤー中心の光サークル (ランタン視界)
  let dist = distance(input.worldPos.xz, uniforms.playerPos);
  let torchLight = 1.0 - smoothstep(1.5, uniforms.lightRadius, dist);

  // 総合明度: タイル環境光 (tileLight) と ランタン光 (torchLight) のブレンド
  var light = max(input.tileLight * uniforms.ambientFloor, torchLight * 0.95);
  light = clamp(light, 0.22, 1.15);

  if (input.isPlayer > 0.5) {
    light = 1.0; // プレイヤー自身は常に最大光度
  }

  // テクスチャサンプリングとアルファ切り抜き
  let texColor = textureSample(tileTexture, tileSampler, input.texCoord);
  if (input.layerType >= 2.5 && texColor.a < 0.2) {
    discard; // 黒ピクセルは保持し、透過アルファのみ除外
  }

  // 各レイヤーに明度を乗算して出力
  ...
}
```

---

## 4. カメラシステムと視覚演出 (Visual FX)

### 4.1 デュアルカメラモード (Diorama $\leftrightarrow$ TopDown)
- **🏛️ ジオラマモード (`diorama`)**:
  - 斜め見下ろし（FOV 30度、カメラ高 11.5、手前オフセット 4.2）。
  - ビルボードが斜め上方に展開し、立体感と奥行きを最大化。
- **📐 トップビューモード (`topdown`)**:
  - 真上からの俯瞰（FOV 28度、カメラ高 11.0、手前オフセット 0.001）。
  - ビルボードが真上に正対し、従来の2Dグリッドに近い直感的な位置関係を提供。
- **スムーズアングル補間**:
  モード切り替え時は、カメラ位置・注視点・Up ベクトル・チルト角度が毎フレーム滑らかにモーフィング補間されます。

### 4.2 加算合成による環境浮遊パーティクル ＆ Visual FX
最前面に同期配置されたオーバーレイ Canvas (`webgpu-fx-canvas`) により、透視投影（`worldToScreen`）を用いた各種エフェクトを描画しています。

- **環境浮遊パーティクル（加算合成）**:
  - プレイヤー周囲の 3D 空間を漂う 32 個の微小粒子（金色の火の粉 / 青白い魔力塵）。
  - `ctx.globalCompositeOperation = 'lighter'` により、暗い通路や部屋の中で幻想的に光り輝く浮遊感を演出（GPU/CPU 負荷ほぼゼロ）。
- **戦闘・状態エフェクト**:
  - ⚔️ 斬撃（SLASH）、💥 被弾赤フラッシュ（DAMAGE_FLASH）、💀 撃破消滅バースト（KILL_BURST）、💚 回復リング（HEAL_RING）、🪦 死亡エフェクト（DEATH_BURST）。
  - 画面シェイク（`triggerScreenShake`）による打撃の重み演出。
- **自キャラ枠 ＆ ターゲットカーソル**:
  - 自キャラの緑色枠、および Look・照準モード時のパルス明滅＋四隅ブラケットカーソル。

---

## 5. 他の Web コンポーネント（React / Vue / Svelte 等）への移植ガイド

本レンダラーは疎結合に設計されており、以下のシンプルなインターフェースで任意の Web フロントエンド環境に組み込むことができます。

### 5.1 コンストラクタ引数
```typescript
interface WebGPUHD2DRendererOptions {
  canvas: HTMLCanvasElement;
  getSituation: () => GameSituation;     // プレイヤー座標、エリア情報
  getAreaGrid: () => Cell[][];           // 80x24 の各セル情報 (bottom, middle, top, effect)
  getGlyphBuffer: () => GlyphCell[][];   // 生グリフバッファ (フォールバック用)
  getTileImg?: () => HTMLImageElement;   // ロード済みタイル画像 (オプション)
  onCellClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number) => void;
}
```

### 5.2 React での実装例
```tsx
import React, { useEffect, useRef } from 'react';
import { WebGPUHD2DRenderer } from './modules/renderers/WebGPUHD2DRenderer';

export const WebGpuViewport: React.FC<{ isVisible: boolean; core: any }> = ({ isVisible, core }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGPUHD2DRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new WebGPUHD2DRenderer({
      canvas: canvasRef.current,
      getSituation: () => core?.getSituation(),
      getAreaGrid: () => core?.getSituation()?.area?.grid,
      onCellClick: (x, y) => core?.moveTo(x, y),
    });

    renderer.init().then((supported) => {
      if (supported) rendererRef.current = renderer;
    });

    return () => renderer.setActive(false);
  }, [core]);

  useEffect(() => {
    rendererRef.current?.setActive(isVisible);
  }, [isVisible]);

  return <canvas ref={canvasRef} width={1280} height={336} style={{ display: isVisible ? 'block' : 'none' }} />;
};
```

---

## 6. 実装における重要な知見・ハマりどころ (Pitfalls)

1. **WGSL に三項演算子（`? :`）は存在しない**:
   - `cond ? a : b` を書くとコンパイルエラーとなります。`if-else` または `select()` を使用してください。
2. **Float32Array と Uint32 のビット列解釈**:
   - 頂点・インスタンス属性はすべて `float32` に統一するのが最も安全です。
3. **黒ピクセルとアルファ透過の判別**:
   - 昔のテクスチャに見られる「RGB=(0,0,0) を透過色とみなす」ナイーブな実装を行うと、モンスターの目や輪郭線、黒髪まで透明化してしまいます。本レンダラーでは `texColor.a < 0.2` のアルファ判定を採用し、純黒ピクセルを鮮明に描画しています。
4. **ダミーテクスチャによる即時起動**:
   - パイプライン作成時に 1x1 のダミー白テクスチャを BindGroup に登録しておくことで、非同期画像ロードの完了を待たずに即時レンダリングを開始できます。
5. **インスタンスパディング領域の再利用**:
   - メモリアライメント用に確保していた `padding: f32` を `tileLight: f32` として再利用することで、バッファ再確保や stride 変更なしで安全に環境明度を GPU へ渡せます。

---

## 7. なぜ WebGL ではなく WebGPU なのか（技術的意義と実績）

本プロジェクトがあえて従来の WebGL ではなく、次世代規格である **WebGPU (WGSL)** を採用したことには、極めて強力な技術的意義があります。

### 7.1 「超レトロ名作 (1987) × 最先端 Web 技術」の強烈なコントラスト
NetHack という約40年の歴史を持つ世界最古参のローグライクが、**WebAssembly で完全駆動し、かつ最新の WebGPU でオクトパストラベラー風の 3D ジオラマとして描画される** という事実は、技術コミュニティにおいて最大のキラー要素（技術的ロマン）となります。

### 7.2 圧倒的な低オーバーヘッドと 1 ドローコール描画
- ダンジョン全体（数千個の床、壁天面、壁前面、アイテム、モンスター、エフェクト）を **たった 1 回のドローコール (`draw(6, instanceCount)`)** で一括描画。
- 3Dライトの重い計算を排し、距離減衰と加算パーティクルを組み合わせることで、ノートPCやモバイル環境でも極めて安定した **60 FPS** を余裕で維持。

### 7.3 コンピュートシェーダー（Compute Shader）への今後の発展性
- 将来的には、コンピュートシェーダーを活用した数万個規模のスペル・ブレスパーティクル物理演算や、ポストプロセス（画面全体のトーンマッピングや被写界深度・ブルーム効果）など、さらなるハイエンド表現への拡張が可能です。

