# WebGPU HD-2D ジオラマレンダラー アーキテクチャ設計・移植ガイド

本ドキュメントは、NetHack-wasm-webUI においてプロトタイプ検証・実装された **WebGPU (WGSL) による HD-2D 風 3D ジオラマレンダラー (`WebGPUHD2DRenderer`)** のアーキテクチャ設計、シェーダー技法、および React / Vue / Svelte などのモダン Web コンポーネントへの移植ガイドをまとめた技術資料です。

---

## 1. 概要とコンセプト

### 1.1 背景と目的
2D タイルベースのクラシック・ローグライクゲームである NetHack の世界を、オクトパストラベラー風の「美しい 3D ミニチュア・ジオラマ」としてリアルタイムレンダリングします。
新規プレイヤーや技術コミュニティを惹きつける **「圧倒的なビジュアル・ショーケース（技術デモ）」** として機能するとともに、既存のゲームコア（Wasm、キーボード操作、探索ロジック、FocusCamera 等）に一切の悪影響を与えない完全アドオンとして設計されています。

### 1.2 コア原則
1. **完全アドオン＆非破壊設計**:
   既存の 2D Graphic Canvas や Color ASCII Grid と 1 クリックで相互切り替え可能。
2. **非アクティブ時の負荷ゼロ (0% CPU / 0 FPS)**:
   HD-2D 表示時以外は `cancelAnimationFrame` により描画ループが完全に停止し、ゲームプレイに一切の負荷を与えない。
3. **外部 3D ライブラリ依存ゼロ**:
   Three.js や Babylon.js などの重量級ライブラリを使わず、生 WebGPU API と純粋な WGSL のみで超軽量・高速に動作。
4. **安全な環境フォールバック**:
   WebGPU 非対応ブラウザでは静かに機能を無効化し、従来の 2D 表示にフォールバック。

---

## 2. 3D ジオラマの階層表現（レイヤー構造）

| レイヤー | 種別 | 3Dジオラマ表現 | シェーダー処理 |
| :--- | :--- | :--- | :--- |
| **Layer 0** | **床・罠** (Bottom) | 水平プレーン ($Y = 0.0$, XZ平面) | スレートグリーンの石畳ベース ＋ マス目グリッド線 ＋ タイル絵柄オーバーレイ |
| **Layer 1** | **壁キューブ天面** | 水平プレーン ($Y = 1.0$, XZ平面) | サンドストーン（明度 $1.12\times$）で上面からの光を表現 |
| **Layer 2** | **壁キューブ前面** | 垂直プレーン ($Z = +0.5$, $Y = 0.0 \sim 1.0$) | 陰影ブラウン（明度 $0.72\times$）で手前に立ち上がる立体感を強調 |
| **Layer 3** | **アイテム・宝箱** (Middle) | 水平浮遊プレーン ($Y = 0.25$ ＋ 微バウンス) | 正方形/ひし形。タイルの黒・透明ピクセルを自動 `discard` |
| **Layer 4** | **キャラクター・モンスター** (Top) | 直立ビルボード ($Y = 0.0 \sim 0.9$, 足元接地) | 直立プレーン。ドット絵を鮮明に切り抜き。自キャラには黄金の微光オーラ |

---

## 3. WebGPU パイプライン ＆ シェーダー設計

### 3.1 メモリアライメント完全準拠のインスタンス構造 (32 bytes)
GPU パイプラインにおける JavaScript（`Float32Array`）と WGSL（頂点属性）のメモリ配置を完全に一致させるため、全属性を `float32` に統一し、16/32バイト境界に揃えています。

```typescript
// 1インスタンス = 8 floats (32 bytes stride)
[
  worldX,     // 0: float32 (X座標: 0〜79)
  worldY,     // 4: float32 (Y座標: 0.0 / 1.0)
  worldZ,     // 8: float32 (Z座標: 0〜23)
  layerType,  // 12: float32 (0:床, 1:壁天面, 2:壁前面, 3:アイテム, 4:キャラ)
  isPlayer,   // 16: float32 (0.0: false, 1.0: true)
  animOffset, // 20: float32 (浮遊/歩行バウンス用位相)
  tileIndex,  // 24: float32 (NetHack タイルアトラス番号)
  padding     // 28: float32 (32バイトアライメント用パディング)
]
```

### 3.2 ハイブリッド HD-2D シェーダー技法
2D NetHack タイルアトラスの「床タイルが黒/透明である」という特性に対処するため、**「立体ジオラマベース色 ＋ タイルドット絵合成」** のハイブリッド合成を採用しています。

```wgsl
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // 1. レイヤーごとの確実なベースカラー (床=緑石畳, 壁=砂色/陰影茶色)
  var baseColor = ...;

  if (uniforms.hasTexture > 0.5) {
    let texColor = textureSample(tileTexture, tileSampler, input.texCoord);
    let hasContent = texColor.a > 0.1 && (texColor.r > 0.06 || texColor.g > 0.06 || texColor.b > 0.06);

    if (input.layerType >= 2.5) {
      // キャラクター & アイテム: ドット絵部分のみを描画し、背景を破棄
      if (hasContent) {
        return vec4<f32>(texColor.rgb, 1.0);
      }
      discard;
    } else {
      // 床 & 壁: タイルの絵柄をベースカラーの上にブレンド合成 (真っ黒化を100%防止)
      if (hasContent) {
        return vec4<f32>(mix(baseColor, texColor.rgb, 0.55), 1.0);
      } else {
        return vec4<f32>(baseColor, 1.0);
      }
    }
  }

  return vec4<f32>(baseColor, 1.0);
}
```

---

## 4. カメラシステムとスムーズ追従

### 4.1 ジオラマアングル設定
真上（トップダウン）から見下ろすと垂直ポリゴン（壁前面やキャラクター）が線幅ゼロで不可視化するため、**斜め約 45 度の手前上空** から見下ろします。
- **カメラ注視点 (`center`)**: `[currentCamX, 0.0, currentCamZ]`
- **カメラ位置 (`eye`)**: `[currentCamX, 18.0, currentCamZ + 16.0]`
- **視野角 (FOV)**: 36度（広角すぎず歪みを抑えたミニチュア感）
- **上方向 (`up`)**: `[0.0, 1.0, 0.0]`

### 4.2 滑らかな Lerp 追従
毎フレーム、プレイヤーの目標マスに向かって係数 `0.12` で注視点を補間します。
カチカチとした 1 マスごとのターン移動に対しても、カメラがフワッと滑らかに追従し、画面酔いを防ぎながら心地よい操作感を提供します。

### 4.3 逆行列によるマウスレイキャスト
クリック移動やホバー判定のため、NDC 座標から ViewProjection 逆行列 (`invViewProjMatrix`) を用いて $Y = 0.0$ の床面との交点を逆算し、画面上のクリック位置を NetHack の $(X, Y)$ マス座標へ変換します。

---

## 5. 他の Web コンポーネント（React / Vue / Svelte 等）への移植ガイド

本レンダラーは疎結合に設計されており、以下のシンプルなインターフェースで任意の Web フロントエンド環境に組み込むことができます。

### 5.1 コンストラクタ引数
```typescript
interface WebGPUHD2DRendererOptions {
  canvas: HTMLCanvasElement;
  getSituation: () => GameSituation;     // プレイヤー座標、エリア情報
  getAreaGrid: () => Cell[][];           // 80x24 の各セル情報 (bottom, middle, top)
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
   - C言語や JS の感覚で `cond ? a : b` を書くと `invalid character found` でパイプライン生成が静かに失敗します。`if-else` または `select()` を使用してください。
2. **Float32Array と Uint32 のビット列解釈**:
   - JS 側で `Float32Array` に代入した数値を GPU 側で `uint32` 属性として読み取ると、浮動小数点のビット表現（例: `1.0f` $\to$ `1065353216u`）となり条件分岐が全滅します。頂点属性は `float32` に統一するのが最も安全です。
3. **NetHack タイルの床・壁は背景が透明/黒**:
   - 2D 用タイル画像をそのまま 3D に貼ると画面が暗黒化します。床や壁には必ず鮮やかなジオラマベース色を敷き、タイルのテクスチャをその上にオーバーレイするハイブリッド合成が必須です。
4. **ダミーテクスチャによる安全な初期化**:
   - パイプライン作成時に 1x1 のダミー白テクスチャを BindGroup に登録しておくことで、非同期画像ロードの完了を待たずに即時レンダリングを開始できます。

---

## 7. 次世代モダンクライアントへの展望（全体画面 ＋ メニューオーバーラップ）

現在の `gkl-pure-js-client` は古典的なダッシュボード分割型（画面を四角くブロック分割するレトロUI）ですが、本 WebGPU HD-2D レンダラーを本格的なメイン画面として活かす次世代クライアントでは、**「100vw × 100vh の全体画面に UI がオーバーラップ（浮遊）する今風のゲーム画面構成」** が最適です。

### 7.1 モダンフルスクリーン UI 設計
- **背景全体 (Viewport 100%)**:
  - 画面の端から端まで広がる WebGPU 3D ジオラマビューポート。
  - マウスホイールによるシームレスなズーム（クローズアップ迫力視点 $\leftrightarrow$ 全体見渡しジオラマ視点）。
- **左下 (Player Orb / Stance HUD)**:
  - 半透明のフロストガラス（Glassmorphism）風に浮遊する HP/PW オーブやコンディションバッジ。
- **右上 (Radar Mini-Map)**:
  - 従来の 2D Graphic Canvas / ASCII Grid を小さな円形・角丸の「レーダー・ミニマップ」として右上にコンパクト常駐。
- **右下 (ContextActions Palette)**:
  - 移動パッドや GKL 推奨アクションが半透明のフローティングパレットとして浮遊。
- **中央〜右 (Sliding Drawer Panels)**:
  - インベントリ、装備ペーパードール、冒険手帳・ナレッジカードは、画面を切り替えるのではなく、左右から滑らかにスライドインするフローティングオーバーレイパネルとして表示。

---

## 8. なぜ WebGL ではなく WebGPU なのか（技術的意義と訴求力）

本プロジェクトがあえて従来の WebGL ではなく、次世代規格である **WebGPU (WGSL)** を採用したことには、極めて強力な技術的意義とコミュニティへの訴求力があります。

### 8.1 「超レトロ名作 (1987) × 最先端 Web 技術 (2020年代)」の強烈なコントラスト
NetHack という約40年の歴史を持つ世界最古参のローグライクが、**WebAssembly で完全駆動し、かつ最新の WebGPU でオクトパストラベラー風の 3D ジオラマとして描画される** という事実は、Hacker News、Twitter/X、技術カンファレンス等においてエンジニアやゲーマーを一目で引き込む最大のキラー要素（技術的ロマン）となります。

### 8.2 低オーバーヘッドと圧倒的な GPU インスタンシング
- **WebGL の限界**:
  WebGL（OpenGL ES ベース）は CPU-GPU 間のバインディングやバリデーションのオーバーヘッドが大きく、多数の 3D キューブやビルボードを描画すると CPU がボトルネックになりやすい課題がありました。
- **WebGPU の真価**:
  Vulkan / Metal / DirectX 12 を直接叩く現代のネイティブ設計であり、NetHack のダンジョン全体（数千個の壁キューブ・床プレーン・ビルボード）を **たった 1 回のドローコール (`draw(6, instanceCount)`)** で GPU に一括投入できます。これにより、ブラウザ上で常に安定した 60 FPS を余裕で維持できます。

### 8.3 コンピュートシェーダー（Compute Shader）への発展性
WebGL 2.0 にすら存在しない **コンピュートシェーダー** を扱えるのが WebGPU の決定的な強みです。
将来的に以下のような高度なグラフィックス表現を GPU 並列計算で追加できます：
- **動的ランタン・たいまつライティング**:
  プレイヤーやモンスターが持つ光源によるリアルタイム陰影計算。
- **GPU パーティクルエフェクト**:
  火炎放射、氷のビーム、稲妻、死霊の霧などの数万個のパーティクル物理演算を GPU 上で完結。
- **GPU オクルージョンカリング**:
  カメラ視界外のブロックの描画判定を CPU を介さず GPU 内で直接破棄。
