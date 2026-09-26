/**
 * WebGPUHD2DRenderer.js - NetHack Wasm WebUI HD2D風 ジオラマレンダラー (Rev 6: ハイブリッドHD-2D)
 * 
 * WebGPU (WGSL) を活用し、NetHack のダンジョンをオクトパストラベラー風の
 * 立体ジオラマ（水平床、3D壁キューブ、直立ビルボード、浮遊アイテム）として
 * 本番 NetHack タイルテクスチャ ＆ 鮮明なジオラマ立体ベースで描画するアドオンレンダラー。
 */

import { DEFAULT_TOMBSTONE_GLYPH } from "../../../../src/core/knowledge/state/AreaStateManager.js";

// ============================================================================
// 1. 超軽量 4x4 行列ユーティリティ (外部依存ゼロ)
// ============================================================================
class Mat4 {
  static create() {
    const out = new Float32Array(16);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
  }

  static perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1.0 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = far * nf;
    out[11] = -1.0;
    out[14] = far * near * nf;
    return out;
  }

  static lookAt(out, eye, center, up) {
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
    const eyex = eye[0], eyey = eye[1], eyez = eye[2];
    const upx = up[0], upy = up[1], upz = up[2];
    const centerx = center[0], centery = center[1], centerz = center[2];

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;
    len = 1 / Math.hypot(z0, z1, z2);
    z0 *= len; z1 *= len; z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.hypot(x0, x1, x2);
    if (!len) {
      x0 = 0; x1 = 0; x2 = 0;
    } else {
      len = 1 / len;
      x0 *= len; x1 *= len; x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;
    len = Math.hypot(y0, y1, y2);
    if (!len) {
      y0 = 0; y1 = 0; y2 = 0;
    } else {
      len = 1 / len;
      x0 *= len; x1 *= len; x2 *= len;
    }

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;
    return out;
  }

  static multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  }

  static invert(out, a) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }
}

// ============================================================================
// 2. WGSL シェーダーコード (ハイブリッド HD-2D: ジオラマベース ＋ タイルドット絵)
// ============================================================================
const WGSL_SHADER = `
struct Uniforms {
  viewProj: mat4x4<f32>,
  texWidth: f32,
  texHeight: f32,
  time: f32,
  hasTexture: f32,
  topDownFactor: f32,
  lightRadius: f32,
  ambientFloor: f32,
  pad0: f32,
  playerPos: vec2<f32>,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var tileSampler: sampler;
@group(0) @binding(2) var tileTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) localPos: vec2<f32>, // -0.5 ~ 0.5 の標準 Quad (x, y)
  @location(1) uv: vec2<f32>,       // 0.0 ~ 1.0
  // Instance attributes (32 bytes = 8 floats)
  @location(2) worldPos: vec3<f32>,
  @location(3) layerType: f32,      // 0.0: floor, 1.0: wall_top, 2.0: wall_front, 3.0: item, 4.0: char
  @location(4) isPlayer: f32,       // 0.0: false, 1.0: true
  @location(5) animOffset: f32,
  @location(6) tileIndex: f32,
  @location(7) tileLight: f32,      // 0.2 ~ 1.0 (タイルの基礎環境明度)
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) @interpolate(flat) layerType: f32,
  @location(2) @interpolate(flat) isPlayer: f32,
  @location(3) texCoord: vec2<f32>,
  @location(4) @interpolate(flat) tileLight: f32,
  @location(5) worldPos: vec3<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  var finalPos = input.worldPos;

  let lx = input.localPos.x;
  let ly = input.localPos.y;

  if (input.layerType < 0.5) {
    // 【Layer 0: 床・地形】 水平プレーン (Y = 0.0, XZ平面, -ly で正しい向き)
    finalPos += vec3<f32>(lx, 0.0, -ly);
  } else if (input.layerType < 1.5) {
    // 【Layer 1: 壁キューブ天面】 水平プレーン (Y = 0.45, XZ平面, -ly で正しい向き)
    finalPos += vec3<f32>(lx, 0.45, -ly);
  } else if (input.layerType < 2.5) {
    // 【Layer 2: 壁キューブ前面】 垂直プレーン (手前 Z = +0.5, Y = 0.0 ~ 0.45)
    // キャラクター (高さ 0.88) が手前壁の陰に隠れないよう高さを 0.45 に調整
    let frontHeight = (ly + 0.5) * 0.45 * (1.0 - uniforms.topDownFactor);
    let frontZ = 0.5 * (1.0 - uniforms.topDownFactor);
    finalPos += vec3<f32>(lx, frontHeight, frontZ);
  } else if (input.layerType < 3.05) {
    // 【Layer 3: アイテム】 静止水平プレーン (床面直上 Y = 0.12, XZ平面, バウンスなし)
    // カメラの Up ベクトル ([0, 0, -1]) に合わせて -ly で正しい向きに配置
    finalPos += vec3<f32>(lx * 0.75, 0.12, -ly * 0.75);
  } else if (input.layerType < 3.25) {
    // 【Layer 3.2: 自キャラ足元枠プレーン (Middle)】 水平プレーン (床面直上 Y = 0.02, XZ平面)
    // 深度テストにより直立するキャラクター (Layer 4) の足元・背面へ自然に潜り込む
    finalPos += vec3<f32>(lx * 0.96, 0.02, -ly * 0.96);
  } else if (input.layerType < 3.45) {
    // 【Layer 3.3: Pet / Ridden 足元サークルプレーン (Middle)】 水平プレーン (床面直上 Y = 0.015, XZ平面)
    // 深度テストにより直立するキャラクター (Layer 4: Top) の足元・背面へ自然に潜り込む
    finalPos += vec3<f32>(lx * 0.88, 0.015, -ly * 0.88);
  } else if (input.layerType < 4.5) {
    // 【Layer 4: キャラクター - スクリーン正対チルトビルボード (マスの中心基準)】
    // マスの中心 (worldPos) を原点として、カメラの視線ベクトルに直交する Up 方向 (ジオラマ: (0.343, -0.939), トップビュー: (0.0, -1.0)) に展開。
    // animOffset < -0.5 (墓石など) の場合はバウンスを強制ゼロで完全静止
    var bounce = 0.0;
    if (input.animOffset >= -0.5) {
      bounce = abs(sin(uniforms.time * 6.0 + input.animOffset)) * 0.06;
    }
    let upVec = mix(vec2<f32>(0.343, -0.939), vec2<f32>(0.0, -1.0), uniforms.topDownFactor);
    let h = ly * 0.88;
    let centerY = mix(0.44, 0.30, uniforms.topDownFactor);
    // bounce をカメラ・スクリーンの Up ベクトル (upVec) に沿って適用することで、
    // ジオラマモード・トップビューモードの双方で画面上方向に均一かつ生き生きとしたふわふわ跳ねアニメーションを実現
    let dioramaTilt = vec3<f32>(lx * 0.88, centerY + (h + bounce) * upVec.x, (h + bounce) * upVec.y);
    finalPos += dioramaTilt;
  } else {
    // 【Layer 5: 過渡的エフェクト (投擲物、杖ビーム、爆発等) - 空中正対チルトビルボード (マスの中心基準)】
    // マスの中心・空中 (Y = 0.45) を基準にスクリーン正対チルト展開
    let upVec = mix(vec2<f32>(0.343, -0.939), vec2<f32>(0.0, -1.0), uniforms.topDownFactor);
    let h = ly * 0.88;
    finalPos += vec3<f32>(lx * 0.88, 0.45 + h * upVec.x, h * upVec.y);
  }

  out.position = uniforms.viewProj * vec4<f32>(finalPos, 1.0);
  out.uv = input.uv;
  out.layerType = input.layerType;
  out.isPlayer = input.isPlayer;
  out.tileLight = input.tileLight;
  out.worldPos = finalPos;

  // タイルアトラス UV 座標計算 (ピクセル絶対位置から安全に算出)
  let tileCols = floor(uniforms.texWidth / 32.0);
  let row = floor(input.tileIndex / tileCols);
  let col = input.tileIndex - row * tileCols;
  let clampedUv = clamp(input.uv, vec2<f32>(0.004, 0.004), vec2<f32>(0.996, 0.996));
  let px = (col + clampedUv.x) * 32.0;
  let py = (row + clampedUv.y) * 32.0;
  out.texCoord = vec2<f32>(px / uniforms.texWidth, py / uniforms.texHeight);

  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;

  // プレイヤー中心の光サークル (ランタン視界)
  let dist = distance(input.worldPos.xz, uniforms.playerPos);
  let torchLight = 1.0 - smoothstep(1.5, uniforms.lightRadius, dist);

  // 総合明度: タイル基礎明度 (tileLight) と ランタン光 (torchLight) をブレンド
  // 視界外でも最低限のシルエット (0.22) は確保
  var light = max(input.tileLight * uniforms.ambientFloor, torchLight * 0.95);
  light = clamp(light, 0.22, 1.15);

  if (input.isPlayer > 0.5) {
    // プレイヤー自身は常に最大光度
    light = 1.0;
  }

  // 0. 自キャラ足元枠プレーン (Layer 3.2: Middle)
  if (input.layerType >= 3.05 && input.layerType < 3.25) {
    var frameColor = vec3<f32>(0.0, 0.90, 0.46); // 通常時: エメラルドグリーン (#00e676)
    if (input.isPlayer > 1.5) {
      frameColor = vec3<f32>(0.94, 0.27, 0.27); // 死亡時: レッド (#ef4444)
    }
    let edgeDist = max(abs(uv.x - 0.5), abs(uv.y - 0.5)); // 0.0 ~ 0.5
    if (edgeDist > 0.49 || edgeDist < 0.41) {
      if (edgeDist <= 0.41) {
        // 内側の淡い透過グロー
        let pulse = 0.12 + 0.05 * sin(uniforms.time * 3.0);
        return vec4<f32>(frameColor, pulse);
      }
      discard;
    }
    // 枠線 (パルス明滅)
    let borderAlpha = 0.88 + 0.12 * sin(uniforms.time * 4.0);
    return vec4<f32>(frameColor, borderAlpha);
  }

  // 0-B. Pet / Ridden 足元サークルプレーン (Layer 3.3: Middle)
  if (input.layerType >= 3.25 && input.layerType < 3.45) {
    var circleColor = vec3<f32>(0.0, 0.90, 0.46); // Pet: エメラルドグリーン (#00e676)
    if (input.isPlayer > 1.5) {
      circleColor = vec3<f32>(0.0, 0.69, 1.0);   // Ridden: シアンブルー (#00b0ff)
    }
    let dist = distance(uv, vec2<f32>(0.5, 0.5));
    if (dist > 0.46 || dist < 0.36) {
      if (dist <= 0.36) {
        // サークル内側の淡い透過グロー
        let pulse = 0.10 + 0.04 * sin(uniforms.time * 3.0);
        return vec4<f32>(circleColor * light, pulse);
      }
      discard;
    }
    // サークルリング線 (パルス明滅)
    let ringAlpha = 0.85 + 0.15 * sin(uniforms.time * 4.0);
    return vec4<f32>(circleColor, ringAlpha);
  }

  // 1. タイルテクスチャがロードされている場合 (通常動作)
  if (uniforms.hasTexture > 0.5) {
    let texColor = textureSampleLevel(tileTexture, tileSampler, input.texCoord, 0.0);

    if (input.layerType >= 2.5) {
      // 【キャラクター (Layer 4)、アイテム (Layer 3)、エフェクト (Layer 5)】
      if (texColor.a < 0.2) {
        discard;
      }

      var spriteColor = texColor.rgb;
      if (input.isPlayer > 0.5) {
        // 自キャラは視認性向上のためほんのり明るく
        spriteColor = mix(spriteColor, vec3<f32>(1.0, 0.98, 0.85), 0.08);
      } else if (input.layerType >= 4.5) {
        // エフェクト (Layer 5) は自発光のため減衰なし
      } else {
        spriteColor = spriteColor * light;
      }
      return vec4<f32>(spriteColor, 1.0);

    } else if (input.layerType < 0.5) {
      // 【床 (Layer 0)】
      if (texColor.a < 0.1) {
        return vec4<f32>(vec3<f32>(0.10, 0.12, 0.15) * light, 1.0); // 床タイルの透明地色
      }
      return vec4<f32>(texColor.rgb * light, 1.0);

    } else if (input.layerType < 1.5) {
      // 【壁天面 (Layer 1)】
      if (texColor.a < 0.1) {
        return vec4<f32>(vec3<f32>(0.35, 0.38, 0.42) * light, 1.0);
      }
      return vec4<f32>(texColor.rgb * light, 1.0);

    } else {
      // 【壁前面 (Layer 2)】
      if (texColor.a < 0.1) {
        return vec4<f32>(vec3<f32>(0.24, 0.26, 0.30) * light, 1.0);
      }
      return vec4<f32>(texColor.rgb * 0.72 * light, 1.0);
    }
  }

  // 2. テクスチャ未ロード時 / フォールバック用のソリッドカラー
  var baseColor = vec3<f32>(0.18, 0.22, 0.26); // 床
  if (input.layerType < 1.5 && input.layerType >= 0.5) {
    baseColor = vec3<f32>(0.45, 0.48, 0.52); // 壁天面
  } else if (input.layerType < 2.5 && input.layerType >= 1.5) {
    baseColor = vec3<f32>(0.30, 0.32, 0.36); // 壁前面
  } else if (input.layerType < 3.5 && input.layerType >= 2.5) {
    let dist2 = abs(uv.x - 0.5) + abs(uv.y - 0.5);
    if (dist2 > 0.42) { discard; }
    baseColor = vec3<f32>(0.20, 0.85, 0.95); // アイテム
  } else if (input.layerType < 4.5 && input.layerType >= 3.5) {
    let dist2 = distance(uv, vec2<f32>(0.5, 0.5));
    if (dist2 > 0.48) { discard; }
    if (input.isPlayer > 0.5) {
      baseColor = vec3<f32>(1.0, 0.88, 0.2);
    } else {
      baseColor = vec3<f32>(0.9, 0.2, 0.2);
    }
  } else {
    // エフェクトフォールバック (黄金の光)
    let dist2 = distance(uv, vec2<f32>(0.5, 0.5));
    if (dist2 > 0.45) { discard; }
    baseColor = vec3<f32>(1.0, 0.95, 0.3);
  }
  return vec4<f32>(baseColor * light, 1.0);
}
`;

// ============================================================================
// 3. WebGPUHD2DRenderer クラス本体
// ============================================================================
export class WebGPUHD2DRenderer {
  constructor({ canvas, getSituation, getAreaGrid, getGlyphBuffer, getCore, getTileImg, isTileLoaded, onCellClick, onCellHover }) {
    this.canvas = canvas;
    this.getSituation = getSituation || (() => null);
    this.getAreaGrid = getAreaGrid || (() => null);
    this.getGlyphBuffer = getGlyphBuffer || (() => null);
    this.getCore = getCore || (() => null);
    this.getTileImg = getTileImg || (() => null);
    this.isTileLoaded = isTileLoaded || (() => false);
    this.onCellClick = onCellClick || null;
    this.onCellHover = onCellHover || null;

    this.isSupported = false;
    this.initError = null;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.vertexBuffer = null;
    this.instanceBuffer = null;
    this.depthTexture = null;

    // テクスチャ管理
    this.tileTexture = null;
    this.tileSampler = null;
    this.hasTexture = false;
    this.texWidth = 1280.0;
    this.texHeight = 1874.0;
    this.textureStatus = "Loading...";

    // インスタンスデータ: 1インスタンス = 8 floats (32 bytes)
    // [worldX, worldY, worldZ, layerType, isPlayer, animOffset, tileIndex, padding]
    this.maxInstances = 8192;
    this.instanceData = new Float32Array(this.maxInstances * 8);

    this.viewProjMatrix = Mat4.create();
    this.invViewProjMatrix = Mat4.create();

    this.animationFrameId = null;
    this.isActive = false;

    // パフォーマンス & デバッグ計測
    this.frameCount = 0;
    this.lastFpsUpdate = 0;
    this.currentFps = 0;
    this.instanceCounts = { total: 0, floor: 0, wall: 0, item: 0, char: 0, effect: 0 };
    this.debugHudElement = null;

    // カメラ位置・モード (diorama: 斜め見下ろし / topdown: 真上俯瞰)
    this.cameraMode = 'diorama'; // 'diorama' | 'topdown'
    this.userZoom = 1.0;         // プレイヤー指定ズーム倍率 (0.45〜2.5x)
    this.currentZoom = 1.0;      // Lerp スムーズ補間現在値
    this.currentCamX = null;
    this.currentCamZ = null;
    this.currentCamDistZ = 5.8;
    this.currentCamHeight = 16.5;
    this.currentTopDownFactor = 0.0;
    this.currentUpY = 1.0;
    this.currentUpZ = 0.0;
    this.camEye = [40.0, 16.5, 12.0 + 5.8];
    this.camCenter = [40.0, 0.0, 12.0];
    this.playerX = 40.0;
    this.playerY = 12.0;

    // Visual FX & Screen Shake State
    this.activeFxList = [];
    this.screenShakeTime = 0;
    this.screenShakeDuration = 0;
    this.screenShakeIntensity = 0;
    this.fxCanvas = null;
    this.fxCtx = null;
    this.targetCursorX = -1;
    this.targetCursorY = -1;
    this.isPlayerDead = false;
    this.deathPosition = null;

    // インスタンスバッファ Dirty キャッシュ
    this.isInstanceDirty = true;
    this.cachedInstanceCount = 0;
    this.lastGridSignature = null;

    // 省電力モード (Idle Throttling)
    this.isPowerSavingEnabled = true;
    this.lastActivityTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.isIdle = false;
    this.lastRenderTime = 0;

    // ライティング＆視界効果 (Lighting & Lantern / Fog)
    this.currentLightRadius = 6.0;
    this.targetLightRadius = 6.0;
    this.ambientFloor = 0.45;

    // 環境パーティクル (浮遊微粒子・ダスト・加算合成)
    this.ambientParticles = [];
    this._initAmbientParticles();
  }

  async init() {
    if (!navigator.gpu) {
      this.initError = "navigator.gpu is undefined (WebGPU not enabled/supported)";
      console.warn(`[WebGPU HD2D] ${this.initError}`);
      return false;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        this.initError = "requestAdapter() returned null";
        console.warn(`[WebGPU HD2D] ${this.initError}`);
        return false;
      }

      this.device = await adapter.requestDevice();
      this.context = this.canvas.getContext('webgpu');

      const format = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: format,
        alphaMode: 'opaque'
      });

      await this._initPipeline(format);
      this._setupEventListeners();
      this._initFxOverlay();
      this._createDebugHud();

      // 非同期でタイルアトラスをロード
      this._loadTileAtlas();

      this.isSupported = true;
      console.log("[WebGPU HD2D] ✨ Hybrid HD-2D Renderer initialized successfully!");
      return true;
    } catch (e) {
      this.initError = e.message || String(e);
      console.error("[WebGPU HD2D] Initialization failed:", e);
      this._createDebugHud();
      return false;
    }
  }

  async _initPipeline(format) {
    const shaderModule = this.device.createShaderModule({ code: WGSL_SHADER });
    const compInfo = await shaderModule.getCompilationInfo();
    const hasError = compInfo.messages.some(m => m.type === 'error');
    if (hasError) {
      const errMsg = compInfo.messages.filter(m => m.type === 'error').map(m => `Line ${m.lineNum}: ${m.message}`).join('; ');
      throw new Error(`WGSL Shader Error: ${errMsg}`);
    }

    // 単一 Quad (6 頂点: 2 三角形)
    // localPos(2 floats), uv(2 floats) = 4 floats (16 bytes)
    const quadVertices = new Float32Array([
      -0.5, -0.5,  0.0, 1.0,
       0.5, -0.5,  1.0, 1.0,
      -0.5,  0.5,  0.0, 0.0,
      -0.5,  0.5,  0.0, 0.0,
       0.5, -0.5,  1.0, 1.0,
       0.5,  0.5,  1.0, 0.0,
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, quadVertices);

    // インスタンスバッファ (8 floats = 32 bytes per instance)
    this.instanceBuffer = this.device.createBuffer({
      size: this.instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Uniform バッファ: viewProj(64) + texWidth(4) + texHeight(4) + time(4) + hasTexture(4) = 80 bytes -> 128 bytes
    this.uniformBuffer = this.device.createBuffer({
      size: 128,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 深度バッファ
    this.depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // サンプラー (ドット絵がくっきり見える nearest フィルタ)
    this.tileSampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
    });

    // 初期化用 1x1 ダミー白テクスチャ
    const dummyTexture = this.device.createTexture({
      size: [1, 1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const whitePixel = new Uint8Array([255, 255, 255, 255]);
    this.device.queue.writeTexture(
      { texture: dummyTexture },
      whitePixel,
      { bytesPerRow: 4 },
      [1, 1, 1]
    );
    this.tileTexture = dummyTexture;

    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          // Vertex buffer (Quad)
          {
            arrayStride: 16, // 4 * 4 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' }, // localPos
              { shaderLocation: 1, offset: 8, format: 'float32x2' }, // uv
            ],
          },
          // Instance buffer (すべて float32 統一, 32 bytes stride)
          {
            arrayStride: 32, // 8 * 4 bytes
            stepMode: 'instance',
            attributes: [
              { shaderLocation: 2, offset: 0, format: 'float32x3' },  // worldPos
              { shaderLocation: 3, offset: 12, format: 'float32' },   // layerType
              { shaderLocation: 4, offset: 16, format: 'float32' },   // isPlayer
              { shaderLocation: 5, offset: 20, format: 'float32' },   // animOffset
              { shaderLocation: 6, offset: 24, format: 'float32' },   // tileIndex
              { shaderLocation: 7, offset: 28, format: 'float32' },   // padding
            ],
          }
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [
          {
            format: format,
            blend: {
              color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });

    this._updateBindGroup();
  }

  _updateBindGroup() {
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.tileSampler },
        { binding: 2, resource: this.tileTexture.createView() },
      ],
    });
  }

  async _loadTileAtlas() {
    const candidatePaths = [
      '../../pict/nethack_default_32_tr.png',
      '../../pict/nethack_default_32.png',
      'pict/nethack_default_32_tr.png',
      'pict/nethack_default_32.png',
      'assets/nethack_default_32.png'
    ];

    let imgBitmap = null;
    let loadedPath = '';

    for (const p of candidatePaths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          const blob = await res.blob();
          imgBitmap = await createImageBitmap(blob);
          loadedPath = p;
          break;
        }
      } catch (e) {}
    }

    if (!imgBitmap) {
      const tileImg = this.getTileImg ? this.getTileImg() : null;
      if (tileImg && tileImg.complete && tileImg.naturalWidth > 0) {
        try {
          imgBitmap = await createImageBitmap(tileImg);
          loadedPath = 'from MapRenderer.tileImg';
        } catch (e) {}
      }
    }

    if (imgBitmap) {
      this.texWidth = Number(imgBitmap.width);
      this.texHeight = Number(imgBitmap.height);

      this.tileTexture = this.device.createTexture({
        size: [imgBitmap.width, imgBitmap.height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      this.device.queue.copyExternalImageToTexture(
        { source: imgBitmap },
        { texture: this.tileTexture },
        [imgBitmap.width, imgBitmap.height]
      );

      this.hasTexture = true;
      this.textureStatus = `OK (${this.texWidth}x${this.texHeight})`;
      this._updateBindGroup();
      console.log(`[WebGPU HD2D] ✨ Tile Atlas loaded (${loadedPath}): ${this.textureStatus}`);
    } else {
      this.textureStatus = "Fallback (Solid Color)";
      console.warn("[WebGPU HD2D] Could not load tile atlas, staying in solid color mode.");
    }
  }

  _createDebugHud() {
    if (this.debugHudElement) return;
    const existing = typeof document !== 'undefined' ? document.getElementById('webgpu-debug-hud') : null;
    if (existing) {
      this.debugHudElement = existing;
      if (this.isActive) this.debugHudElement.style.display = 'block';
      return;
    }
    const container = (typeof document !== 'undefined' ? (document.querySelector('.app-container') || document.body) : null) || this.canvas.parentElement;
    if (!container) return;

    this.debugHudElement = document.createElement('div');
    this.debugHudElement.id = 'webgpu-debug-hud';
    this.debugHudElement.style.display = this.isActive ? 'block' : 'none';
    this.debugHudElement.innerHTML = `<div><span class="badge-ok">✨ WebGPU HD-2D</span> &nbsp;|&nbsp; <b>-- FPS</b> &nbsp;|&nbsp; <span>🏛️ Diorama</span> &nbsp;|&nbsp; <span style="color:#6ee7b7">🔍 1.00x</span></div>`;
    container.appendChild(this.debugHudElement);
  }

  _updateDebugHud(timeInSeconds) {
    if (!this.debugHudElement) return;

    this.frameCount++;
    if (timeInSeconds - this.lastFpsUpdate >= 0.5) {
      this.currentFps = Math.round(this.frameCount / (timeInSeconds - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = timeInSeconds;
    }

    if (this.initError) {
      this.debugHudElement.innerHTML = `
        <span class="badge-error">WebGPU: ERROR</span>
        <div>Reason: ${this.initError}</div>
      `;
      return;
    }

    const { total, floor, wall, item, char, effect = 0 } = this.instanceCounts;
    const camX = this.currentCamX !== null ? this.currentCamX.toFixed(1) : '-';
    const camZ = this.currentCamZ !== null ? this.currentCamZ.toFixed(1) : '-';
    const texBadge = this.hasTexture ? `Texture: OK` : `Texture: ${this.textureStatus}`;
    const modeBadge = this.cameraMode === 'topdown' ? '📐 TopDown' : '🏛️ Diorama';
    const idleBadge = this.isIdle ? ' <span style="color:#88ddff">[Idle 省電力]</span>' : '';

    this.debugHudElement.innerHTML = `
      <div><span class="badge-ok">✨ WebGPU HD-2D</span> &nbsp;|&nbsp; <b>${this.currentFps} FPS</b> &nbsp;|&nbsp; <span>${modeBadge}${idleBadge}</span> &nbsp;|&nbsp; <span style="color:#6ee7b7">🔍 ${(this.currentZoom).toFixed(2)}x</span></div>
      <div class="hud-details">
        <div>${texBadge} &nbsp;|&nbsp; Instances: <b>${total}</b> (<span class="badge-layer" style="color:#60c075">Floor: ${floor}</span> <span class="badge-layer" style="color:#e0b070">Wall: ${wall}</span> <span class="badge-layer" style="color:#40e0ff">Item: ${item}</span> <span class="badge-layer" style="color:#ffdc40">Char: ${char}</span> <span class="badge-layer" style="color:#ff80df">Fx: ${effect}</span>)</div>
        <div>Player: (${this.playerX.toFixed(0)}, ${this.playerY.toFixed(0)}) &nbsp;|&nbsp; Cam: (${camX}, ${camZ}) &nbsp;|&nbsp; Tilt: ${(this.currentTopDownFactor * 100).toFixed(0)}% &nbsp;|&nbsp; <span style="color:#ffe57f">💡 Light: r=${this.currentLightRadius.toFixed(1)}</span></div>
      </div>
    `;
  }

  _setupEventListeners() {
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isActive) return;
      const grid = this._raycastFloor(e.clientX, e.clientY);
      if (grid && this.onCellHover) {
        this.onCellHover(grid.x, grid.y);
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (!this.isActive) return;
      const grid = this._raycastFloor(e.clientX, e.clientY);
      if (grid && this.onCellClick) {
        this.onCellClick(grid.x, grid.y, { clientX: e.clientX, clientY: e.clientY }, false);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.isActive) return;
      const grid = this._raycastFloor(e.clientX, e.clientY);
      if (grid) {
        if (this.onCellContextMenu) {
          this.onCellContextMenu(grid.x, grid.y, { clientX: e.clientX, clientY: e.clientY });
        } else if (this.onCellClick) {
          this.onCellClick(grid.x, grid.y, { clientX: e.clientX, clientY: e.clientY }, true);
        }
      }
    });

    // 🔍 マウスホイールによるカメラズーム調整 (ホイール上: 拡大, ホイール下: 縮小)
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.isActive) return;
      e.preventDefault();
      const zoomStep = 0.12;
      if (e.deltaY < 0) {
        this.userZoom = Math.min(2.5, this.userZoom + zoomStep);
      } else {
        this.userZoom = Math.max(0.45, this.userZoom - zoomStep);
      }
      this.wakeUp();
    }, { passive: false });

    // 🎯 ダブルクリックで標準ズーム (1.0x) にリセット
    this.canvas.addEventListener('dblclick', (e) => {
      if (!this.isActive) return;
      e.preventDefault();
      this.userZoom = 1.0;
      this.wakeUp();
    });
  }

  /**
   * ズーム倍率を直接設定
   * @param {number} zoom
   */
  setZoom(zoom) {
    this.userZoom = Math.max(0.45, Math.min(2.5, Number(zoom) || 1.0));
    this.wakeUp();
  }

  /**
   * ズームを標準倍率 (1.0x) にリセット
   */
  resetZoom() {
    this.userZoom = 1.0;
    this.wakeUp();
  }

  /**
   * 3D ワールド座標 (gx, y, gy) を Canvas 内スクリーン座標 (screenX, screenY) に射影変換
   * @param {number} gx
   * @param {number} [y=0.45]
   * @param {number} gy
   * @returns {{ screenX: number, screenY: number } | null}
   */
  worldToScreen(gx, y = 0.45, gy) {
    if (!this.viewProjMatrix || !this.canvas) return null;
    const m = this.viewProjMatrix;
    const clipX = m[0] * gx + m[4] * y + m[8] * gy + m[12];
    const clipY = m[1] * gx + m[5] * y + m[9] * gy + m[13];
    const clipW = m[3] * gx + m[7] * y + m[11] * gy + m[15];

    if (clipW <= 0.0001) return null;

    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;

    const screenX = ((ndcX + 1.0) / 2.0) * this.canvas.width;
    const screenY = ((-ndcY + 1.0) / 2.0) * this.canvas.height;

    return { screenX, screenY };
  }

  _raycastFloor(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2.0 - 1.0;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2.0 - 1.0);

    Mat4.invert(this.invViewProjMatrix, this.viewProjMatrix);

    const nearVec = this._unproject(ndcX, ndcY, 0.0, this.invViewProjMatrix);
    const farVec = this._unproject(ndcX, ndcY, 1.0, this.invViewProjMatrix);

    const dirX = farVec[0] - nearVec[0];
    const dirY = farVec[1] - nearVec[1];
    const dirZ = farVec[2] - nearVec[2];

    if (Math.abs(dirY) < 0.0001) return null;

    const t = -nearVec[1] / dirY;
    if (t < 0) return null;

    const hitX = nearVec[0] + t * dirX;
    const hitZ = nearVec[2] + t * dirZ;

    const gx = Math.round(hitX);
    const gy = Math.round(hitZ);

    if (gx >= 0 && gx < 80 && gy >= 0 && gy < 24) {
      return { x: gx, y: gy };
    }
    return null;
  }

  _unproject(x, y, z, invMat) {
    const w = invMat[3] * x + invMat[7] * y + invMat[11] * z + invMat[15];
    return [
      (invMat[0] * x + invMat[4] * y + invMat[8] * z + invMat[12]) / w,
      (invMat[1] * x + invMat[5] * y + invMat[9] * z + invMat[13]) / w,
      (invMat[2] * x + invMat[6] * y + invMat[10] * z + invMat[14]) / w
    ];
  }

  setCameraMode(mode) {
    if (mode === 'diorama' || mode === 'topdown') {
      if (this.cameraMode !== mode) {
        this.cameraMode = mode;
        this.isInstanceDirty = true;
        this.wakeUp();
      }
    }
  }

  toggleCameraMode() {
    this.setCameraMode(this.cameraMode === 'diorama' ? 'topdown' : 'diorama');
    return this.cameraMode;
  }

  markDirty() {
    this.isInstanceDirty = true;
    this.wakeUp();
  }

  wakeUp() {
    this.lastActivityTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.isIdle = false;
  }

  _initFxOverlay() {
    if (!this.canvas || typeof document === 'undefined') return;
    let fxCanvas = document.getElementById('webgpu-fx-canvas');
    if (!fxCanvas && this.canvas.parentElement) {
      fxCanvas = document.createElement('canvas');
      fxCanvas.id = 'webgpu-fx-canvas';
      fxCanvas.width = this.canvas.width;
      fxCanvas.height = this.canvas.height;
      this.canvas.parentElement.appendChild(fxCanvas);
    }
    if (fxCanvas) {
      this.fxCanvas = fxCanvas;
      this.fxCtx = fxCanvas.getContext('2d');
    }
  }

  addVisualFx(fx) {
    if (!fx) return;
    this.activeFxList.push(fx);
    this.wakeUp();
  }

  triggerScreenShake(intensity = 3, durationMs = 100) {
    this.screenShakeTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.screenShakeDuration = durationMs;
    this.screenShakeIntensity = intensity;
    this.wakeUp();
  }

  resize(width, height) {
    if (!this.canvas || width <= 0 || height <= 0) return;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.fxCanvas) {
      this.fxCanvas.width = width;
      this.fxCanvas.height = height;
    }
    if (this.device) {
      if (this.depthTexture && typeof this.depthTexture.destroy === 'function') {
        try {
          this.depthTexture.destroy();
        } catch {}
      }
      this.depthTexture = this.device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.markDirty();
      this.wakeUp();
    }
  }

  /**
   * 3D ワールド座標 (gx: X, gy: 高さY, gz: 奥行きZ) を 2D スクリーンピクセル座標へ変換 (透視投影)
   */
  worldToScreen(gx, gy, gz = 0.0) {
    const wx = gx;
    const wy = gy; // 3D 上の高さ Y
    const wz = gz; // 3D 上の奥 Z

    const m = this.viewProjMatrix;
    const clipX = m[0] * wx + m[4] * wy + m[8] * wz + m[12];
    const clipY = m[1] * wx + m[5] * wy + m[9] * wz + m[13];
    const clipW = m[3] * wx + m[7] * wy + m[11] * wz + m[15];

    if (clipW <= 0.0001) return null; // カメラの背面

    const ndcX = clipX / clipW;
    const ndcY = clipY / clipW;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const screenX = (ndcX + 1.0) * 0.5 * w;
    const screenY = (1.0 - ndcY) * 0.5 * h;

    return { screenX, screenY, depth: clipW };
  }

  /**
   * 自キャラ枠ハイライト ＆ ターゲットカーソル枠の描画 (オーバーレイ Canvas 2D)
   */
  _renderCursorFrames(ctx, ts, now) {
    // 1. 自キャラ枠ハイライト:
    // WebGPU パイプライン内の Layer 3.2 (Middle レイヤー, 床面直上 Y = 0.02) で描画されるため、
    // 最前面 2D オーバーレイでの描画は行わない (深度テストによりキャラクター足元・背面に自然に潜り込む)。

    // 2. ターゲットカーソル枠 (Look や照準時: 4 頂点 3D 空間結線による立体パースペクティブ化 ＋ コーナー演出)
    if (this.targetCursorX >= 0 && this.targetCursorY >= 0 &&
        (this.targetCursorX !== this.playerX || this.targetCursorY !== this.playerY)) {
      this.wakeUp(); // カーソルのパルス明滅中は 60FPS 描画
      const tx = this.targetCursorX;
      const ty = this.targetCursorY;
      const p0 = this.worldToScreen(tx - 0.48, 0.01, ty - 0.48);
      const p1 = this.worldToScreen(tx + 0.48, 0.01, ty - 0.48);
      const p2 = this.worldToScreen(tx + 0.48, 0.01, ty + 0.48);
      const p3 = this.worldToScreen(tx - 0.48, 0.01, ty + 0.48);

      if (p0 && p1 && p2 && p3) {
        const pulse = 0.65 + 0.35 * Math.sin(now / 140);
        ctx.save();
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(p0.screenX, p0.screenY);
        ctx.lineTo(p1.screenX, p1.screenY);
        ctx.lineTo(p2.screenX, p2.screenY);
        ctx.lineTo(p3.screenX, p3.screenY);
        if (typeof ctx.closePath === 'function') {
          ctx.closePath();
        } else {
          ctx.lineTo(p0.screenX, p0.screenY);
        }
        ctx.stroke();

        // 四隅コーナーブラケット演出 (立体パースペクティブ結線に沿ったコーナー線)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        const cornerFactor = 0.22;
        // p0 (左奥)
        ctx.beginPath();
        ctx.moveTo(p0.screenX + (p1.screenX - p0.screenX) * cornerFactor, p0.screenY + (p1.screenY - p0.screenY) * cornerFactor);
        ctx.lineTo(p0.screenX, p0.screenY);
        ctx.lineTo(p0.screenX + (p3.screenX - p0.screenX) * cornerFactor, p0.screenY + (p3.screenY - p0.screenY) * cornerFactor);
        ctx.stroke();

        // p1 (右奥)
        ctx.beginPath();
        ctx.moveTo(p1.screenX + (p0.screenX - p1.screenX) * cornerFactor, p1.screenY + (p0.screenY - p1.screenY) * cornerFactor);
        ctx.lineTo(p1.screenX, p1.screenY);
        ctx.lineTo(p1.screenX + (p2.screenX - p1.screenX) * cornerFactor, p1.screenY + (p2.screenY - p1.screenY) * cornerFactor);
        ctx.stroke();

        // p2 (右手前)
        ctx.beginPath();
        ctx.moveTo(p2.screenX + (p1.screenX - p2.screenX) * cornerFactor, p2.screenY + (p1.screenY - p2.screenY) * cornerFactor);
        ctx.lineTo(p2.screenX, p2.screenY);
        ctx.lineTo(p2.screenX + (p3.screenX - p2.screenX) * cornerFactor, p2.screenY + (p3.screenY - p2.screenY) * cornerFactor);
        ctx.stroke();

        // p3 (左手前)
        ctx.beginPath();
        ctx.moveTo(p3.screenX + (p2.screenX - p3.screenX) * cornerFactor, p3.screenY + (p2.screenY - p3.screenY) * cornerFactor);
        ctx.lineTo(p3.screenX, p3.screenY);
        ctx.lineTo(p3.screenX + (p0.screenX - p3.screenX) * cornerFactor, p3.screenY + (p0.screenY - p3.screenY) * cornerFactor);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  /**
   * Pet / Ridden / piletop アイテムの視覚的強調描画 (3D 空間追従オーバーレイ)
   */
  _renderEntityHighlights(ctx, ts, now) {
    const situation = this.getSituation ? this.getSituation() : null;
    const area = situation?.area;
    const areaGrid = area?.grid || (this.getAreaGrid ? this.getAreaGrid() : null);
    if (!areaGrid) return;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const cell = areaGrid[y]?.[x];
        if (!cell) continue;

        // 1. piletop (アイテム山積み) 視覚強調マーク (右下 [+] バッジ)
        const middleGlyph = cell.middle?.rawGlyph ?? -1;
        const isPile = Boolean(cell.middle?.isPile || (middleGlyph >= 7992 && middleGlyph < 9622));
        if (isPile) {
          const itemProj = this.worldToScreen(x, 0.12, y);
          if (itemProj && itemProj.screenX >= -20 && itemProj.screenX <= canvasW + 20 &&
              itemProj.screenY >= -20 && itemProj.screenY <= canvasH + 20) {
            const badgeSize = Math.max(10, Math.min(18, Math.round(ts * 0.28)));
            const halfSize = Math.round(badgeSize / 2);
            const fontSize = Math.max(9, Math.min(13, Math.round(badgeSize * 0.8)));

            const bx = Math.round(itemProj.screenX + ts * 0.22);
            const by = Math.round(itemProj.screenY + ts * 0.22);
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(bx - halfSize, by - halfSize, badgeSize, badgeSize);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - halfSize, by - halfSize, badgeSize, badgeSize);
            if (typeof ctx.fillText === 'function') {
              ctx.fillStyle = '#ffeb3b';
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('+', bx, by);
            }
            ctx.restore();
          }
        }

        // 2. Pet / Ridden の同定判定
        const topGlyph = cell.top?.rawGlyph ?? -1;
        const isPet = Boolean(cell.top?.isPet || (topGlyph >= 766 && topGlyph < 1532));
        const isRidden = Boolean(cell.top?.isRidden || (topGlyph >= 2682 && topGlyph < 3448));

        if (isPet || isRidden) {
          // ※足元サークルは WebGPU パイプライン内の Layer 3.3 (Middle レイヤー) で描画されるため、
          // 直立キャラクター (Layer 4: Top) の足元・背面に自然に潜り込み、前面に被りません。

          // 頭上ミニバッジ (頭上直上 Y = 0.88, PileTop と同様の統一ミニバッジ形式)
          const headProj = this.worldToScreen(x, 0.88, y);
          if (headProj && headProj.screenX >= -30 && headProj.screenX <= canvasW + 30 &&
              headProj.screenY >= -30 && headProj.screenY <= canvasH + 30) {
            const badgeSize = Math.max(10, Math.min(18, Math.round(ts * 0.28)));
            const halfSize = Math.round(badgeSize / 2);
            const fontSize = Math.max(9, Math.min(13, Math.round(badgeSize * 0.8)));

            const bx = Math.round(headProj.screenX + ts * 0.22);
            const by = Math.round(headProj.screenY - ts * 0.22);
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(bx - halfSize, by - halfSize, badgeSize, badgeSize);
            ctx.strokeStyle = isRidden ? '#00b0ff' : '#00e676';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - halfSize, by - halfSize, badgeSize, badgeSize);
            if (typeof ctx.fillText === 'function') {
              ctx.fillStyle = isRidden ? '#00b0ff' : '#00e676';
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(isRidden ? 'R' : '♥', bx, by);
            }
            ctx.restore();
          }
        }
      }
    }
  }

  _initAmbientParticles() {
    this.ambientParticles = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      this.ambientParticles.push({
        offsetX: (Math.random() * 2 - 1) * 6.0,
        offsetY: Math.random() * 1.5,
        offsetZ: (Math.random() * 2 - 1) * 6.0,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() * 0.2) + 0.06, // ふわりと上に上昇
        vz: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.8 + 1.2,
        baseAlpha: Math.random() * 0.35 + 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.2 + 0.8,
        isGold: Math.random() > 0.45
      });
    }
  }

  _renderAmbientParticles(ctx, now) {
    if (!this.ambientParticles || this.ambientParticles.length === 0) return;
    const dt = 0.016;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // 加算合成で暗闇に光る微粒子

    for (const p of this.ambientParticles) {
      p.offsetX += p.vx * dt;
      p.offsetY += p.vy * dt;
      p.offsetZ += p.vz * dt;

      // 一定の高さや範囲を超えたらランダムにリセットして循環
      if (p.offsetY > 1.6 || Math.abs(p.offsetX) > 7.0 || Math.abs(p.offsetZ) > 7.0) {
        p.offsetX = (Math.random() * 2 - 1) * 5.5;
        p.offsetY = 0.05;
        p.offsetZ = (Math.random() * 2 - 1) * 5.5;
      }

      const worldX = this.playerX + p.offsetX;
      const worldY = p.offsetY;
      const worldZ = this.playerY + p.offsetZ;

      const proj = this.worldToScreen(worldX, worldY, worldZ);
      if (proj && proj.screenX >= -10 && proj.screenX <= this.canvas.width + 10 &&
          proj.screenY >= -10 && proj.screenY <= this.canvas.height + 10) {
        const pulse = Math.sin(now * 0.003 * p.speed + p.phase);
        const currentAlpha = Math.max(0.05, p.baseAlpha * (0.6 + 0.4 * pulse));
        
        ctx.fillStyle = p.isGold
          ? `rgba(255, 215, 120, ${currentAlpha})`
          : `rgba(160, 220, 255, ${currentAlpha * 0.8})`;

        ctx.beginPath();
        ctx.arc(proj.screenX, proj.screenY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Visual FX の描画＆自動ライフサイクル管理 (オーバーレイ Canvas 2D)
   */
  renderVisualFx(now) {
    if (!this.fxCtx || !this.fxCanvas) return;
    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

    // 3D 空間でのプレイヤー位置における 1 タイルの見かけのスクリーンピクセルサイズを動的算出
    const pP0 = this.worldToScreen(this.playerX - 0.5, 0.45, this.playerY);
    const pP1 = this.worldToScreen(this.playerX + 0.5, 0.45, this.playerY);
    const baseTs = (pP0 && pP1)
      ? Math.max(16, Math.round(Math.abs(pP1.screenX - pP0.screenX)))
      : Math.max(16, Math.round(32 * (this.currentZoom || 1.0)));

    // 0. 環境浮遊パーティクル (加算合成 lighter)
    this._renderAmbientParticles(ctx, now);

    // 1. 自キャラ枠 ＆ ターゲットカーソル枠の描画
    this._renderCursorFrames(ctx, baseTs, now);

    // 2. Pet / Ridden / piletop アイテムの視覚的強調描画 (3D 空間追従オーバーレイ)
    this._renderEntityHighlights(ctx, baseTs, now);

    // 3. Visual FX の描画
    if (!this.activeFxList || this.activeFxList.length === 0) return;

    // FX 再生中はアイドル化させず 60FPS を維持
    this.wakeUp();

    const canvasW = this.fxCanvas.width;
    const canvasH = this.fxCanvas.height;

    this.activeFxList = this.activeFxList.filter(fx => {
      const elapsed = now - fx.startTime;
      if (elapsed >= fx.durationMs) return false;

      const progress = Math.min(1.0, elapsed / fx.durationMs);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const targetGx = fx.followPlayer ? this.playerX : fx.gx;
      const targetGy = fx.followPlayer ? this.playerY : fx.gy;

      if (targetGx === undefined || targetGy === undefined) return true;

      // 3D 空間からスクリーンピクセル座標へ変換 (高さ Y = 0.45)
      const projected = this.worldToScreen(targetGx, 0.45, targetGy);
      if (!projected) return true;

      // 対象タイルの見かけのスクリーンピクセルサイズを算出 (カメラズーム・パースペクティブ完全追従)
      const pLeft = this.worldToScreen(targetGx - 0.5, 0.45, targetGy);
      const pRight = this.worldToScreen(targetGx + 0.5, 0.45, targetGy);
      const ts = (pLeft && pRight)
        ? Math.max(16, Math.round(Math.abs(pRight.screenX - pLeft.screenX)))
        : baseTs;

      const screenX = Math.round(projected.screenX - ts / 2);
      const screenY = Math.round(projected.screenY - ts / 2);

      if (screenX < -ts || screenX > canvasW || screenY < -ts || screenY > canvasH) {
        return true;
      }

      ctx.save();

      if (fx.type === 'SLASH') {
        // ⚔️ 斬撃エフェクト
        const alpha = 1 - progress;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd740';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const startX = screenX + 4;
        const startY = screenY + 4;
        const endX = startX + (ts - 8) * Math.min(1.0, progress * 2.5);
        const endY = startY + (ts - 8) * Math.min(1.0, progress * 2.5);
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (progress > 0.2) {
          ctx.strokeStyle = `rgba(255, 215, 64, ${alpha * 0.8})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(screenX + ts - 8, screenY + 8);
          ctx.lineTo(screenX + 8, screenY + ts - 8);
          ctx.stroke();
        }
      } else if (fx.type === 'DAMAGE_FLASH') {
        // 💥 被弾赤フラッシュ（最初の160msで素早く点滅）
        const flashProgress = Math.min(1.0, elapsed / 160);
        if (flashProgress < 1.0) {
          const alpha = (1 - flashProgress) * 0.6;
          ctx.fillStyle = `rgba(244, 67, 54, ${alpha})`;
          ctx.fillRect(screenX, screenY, ts, ts);
          ctx.strokeStyle = `rgba(255, 23, 68, ${1 - flashProgress})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX, screenY, ts, ts);
        }

        // 🔢 ダメージ数値ポップアップ（上方向へ浮遊しながらフェードアウト）
        if (fx.amount !== undefined && fx.amount > 0) {
          const textAlpha = Math.max(0, 1 - progress);
          const floatY = -easeOut * (ts * 0.75);
          const textX = screenX + ts / 2;
          const textY = screenY + (ts * 0.25) + floatY;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = Math.max(12, Math.round(ts * 0.45));
          ctx.font = `bold ${fontSize}px monospace, sans-serif`;

          const text = `-${fx.amount}`;
          ctx.strokeStyle = `rgba(0, 0, 0, ${textAlpha * 0.9})`;
          ctx.lineWidth = 3;
          ctx.strokeText(text, textX, textY);

          ctx.fillStyle = `rgba(255, 68, 68, ${textAlpha})`;
          ctx.fillText(text, textX, textY);
          ctx.restore();
        }
      } else if (fx.type === 'KILL_BURST') {
        // 💀 撃破消滅バースト
        const alpha = 1 - progress;
        const radius = (ts * 0.5) * (0.3 + easeOut * 0.7);
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2;

        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff9100';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(cx - radius, cy);
        ctx.lineTo(cx + radius, cy);
        ctx.moveTo(cx, cy - radius);
        ctx.lineTo(cx, cy + radius);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
        const d = radius * 0.7;
        const pSize = Math.max(1, 3 * (1 - progress));
        ctx.fillRect(cx - d, cy - d, pSize, pSize);
        ctx.fillRect(cx + d, cy - d, pSize, pSize);
        ctx.fillRect(cx - d, cy + d, pSize, pSize);
        ctx.fillRect(cx + d, cy + d, pSize, pSize);
      } else if (fx.type === 'HEAL_RING') {
        // 💚 回復リング
        const ringProgress = Math.min(1.0, elapsed / 250);
        const ringEaseOut = 1 - Math.pow(1 - ringProgress, 2);
        const alpha = 1 - ringProgress;
        const liftY = -ringEaseOut * 12;
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2 + liftY;
        const r = 4 + ringEaseOut * 10;

        if (ringProgress < 1.0) {
          ctx.strokeStyle = `rgba(0, 230, 118, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.shadowColor = '#69f0ae';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 🔢 回復数値ポップアップ（緑色）
        if (fx.amount !== undefined && fx.amount > 0) {
          const textAlpha = Math.max(0, 1 - progress);
          const floatY = -easeOut * (ts * 0.75);
          const textX = screenX + ts / 2;
          const textY = screenY + (ts * 0.25) + floatY;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = Math.max(12, Math.round(ts * 0.45));
          ctx.font = `bold ${fontSize}px monospace, sans-serif`;

          const text = `+${fx.amount}`;
          ctx.strokeStyle = `rgba(0, 0, 0, ${textAlpha * 0.9})`;
          ctx.lineWidth = 3;
          ctx.strokeText(text, textX, textY);

          ctx.fillStyle = `rgba(0, 230, 118, ${textAlpha})`;
          ctx.fillText(text, textX, textY);
          ctx.restore();
        }
      } else if (fx.type === 'DEATH_BURST') {
        // 🪦 死亡エフェクト
        const alpha = Math.max(0, 1 - progress);
        const radius = (ts * 0.8) * (0.2 + easeOut * 1.2);
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2;

        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
        ctx.lineWidth = 3 * (1 - progress * 0.5);
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      return true;
    });
  }

  setActive(active) {
    this.isActive = active;
    if (active) {
      this.canvas.classList.remove('hidden');
      if (this.fxCanvas) this.fxCanvas.classList.remove('hidden');
      if (this.debugHudElement) this.debugHudElement.style.display = 'block';
      this.wakeUp();
      this.isInstanceDirty = true;
      this._startRenderLoop();
    } else {
      this.canvas.classList.add('hidden');
      if (this.fxCanvas) this.fxCanvas.classList.add('hidden');
      if (this.debugHudElement) this.debugHudElement.style.display = 'none';
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  }

  _startRenderLoop() {
    const loop = (timestamp) => {
      if (!this.isActive) return;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

      // エフェクトまたはシェイク発生中は常時アクティブ (wakeUp)
      const hasActiveFx = this.activeFxList && this.activeFxList.length > 0;
      const hasShake = this.screenShakeTime > 0;
      if (hasActiveFx || hasShake) {
        this.wakeUp();
      }

      // アイドル判定:
      // 1. カメラ座標追従が収束している
      const isCamSettled = this.currentCamX !== null &&
        Math.abs(this.currentCamX - this.playerX) < 0.01 &&
        Math.abs(this.currentCamZ - this.playerY) < 0.01;
      // 2. カメラアングル (topDownFactor) 補間が収束している
      const targetFactor = this.cameraMode === 'topdown' ? 1.0 : 0.0;
      const isAngleSettled = Math.abs(this.currentTopDownFactor - targetFactor) < 0.005;
      // 3. ズーム倍率補間が収束している
      const isZoomSettled = Math.abs(this.currentZoom - this.userZoom) < 0.005;
      // 4. 直近 1.5 秒間にプレイヤー操作・ダンジョン変化がない
      const timeSinceActivity = now - this.lastActivityTime;

      if (this.isPowerSavingEnabled && isCamSettled && isAngleSettled && isZoomSettled && timeSinceActivity > 1500 && !hasActiveFx && !hasShake) {
        this.isIdle = true;
      } else {
        this.isIdle = false;
      }

      // 省電力モード時は 15 FPS (約 66ms 間隔) に間引き、通常時は 60 FPS
      const minInterval = this.isIdle ? 66.6 : 0;
      if (now - this.lastRenderTime >= minInterval) {
        this.render(timestamp / 1000.0);
        this.lastRenderTime = now;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  render(timeInSeconds = 0) {
    if (!this.isSupported || !this.pipeline || !this.bindGroup) {
      this._updateDebugHud(timeInSeconds);
      return;
    }

    const situation = this.getSituation ? this.getSituation() : null;
    const area = situation?.area;
    const areaGrid = area?.grid || this.getAreaGrid();
    const glyphBuffer = this.getGlyphBuffer ? this.getGlyphBuffer() : null;
    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];

    const getTileIdx = (glyphId) => {
      if (tileMap && tileMap[glyphId] !== undefined) return tileMap[glyphId];
      return glyphId >= 0 ? glyphId : 0;
    };

    // 1. プレイヤー座標の取得
    let targetPx = 40.0;
    let targetPy = 12.0;

    if (this.isPlayerDead && this.deathPosition) {
      targetPx = this.deathPosition.x;
      targetPy = this.deathPosition.y;
    } else if (area && typeof area.playerX === 'number') {
      targetPx = area.playerX;
      targetPy = area.playerY;
    } else if (area?.playerLocation) {
      targetPx = area.playerLocation.x;
      targetPy = area.playerLocation.y;
    } else if (areaGrid) {
      for (let y = 0; y < 24; y++) {
        for (let x = 0; x < 80; x++) {
          if (areaGrid[y]?.[x]?.top?.isPlayer) {
            targetPx = x;
            targetPy = y;
            break;
          }
        }
      }
    }

    if (targetPx !== this.playerX || targetPy !== this.playerY) {
      this.playerX = targetPx;
      this.playerY = targetPy;
      this.wakeUp();
    }

    // 2. カメラ行列計算 (プレイヤー追従 ＆ ジオラマ/トップビュー スムーズ補間)
    if (this.currentCamX === null || this.currentCamZ === null) {
      this.currentCamX = targetPx;
      this.currentCamZ = targetPy;
    } else {
      this.currentCamX += (targetPx - this.currentCamX) * 0.12;
      this.currentCamZ += (targetPy - this.currentCamZ) * 0.12;
    }

    // ズーム補間 (Lerp)
    this.currentZoom += (this.userZoom - this.currentZoom) * 0.18;
    const effectiveZoom = Math.max(0.35, this.currentZoom);
    const zoomInv = 1.0 / effectiveZoom;

    // 目標パラメータ (全画面解像度に応じた適正見通しスケール ＋ ズーム連動)
    const isTopDown = this.cameraMode === 'topdown';
    const baseDistZ = isTopDown ? 0.001 : 5.8;
    const baseHeight = isTopDown ? 16.0 : 16.5;

    const targetDistZ = baseDistZ * zoomInv;
    const targetHeight = baseHeight * zoomInv;
    const targetFactor = isTopDown ? 1.0 : 0.0;
    const targetUpY = isTopDown ? 0.0 : 1.0;
    const targetUpZ = isTopDown ? -1.0 : 0.0;

    // スムーズ補間 (Lerp)
    this.currentCamDistZ += (targetDistZ - this.currentCamDistZ) * 0.15;
    this.currentCamHeight += (targetHeight - this.currentCamHeight) * 0.15;
    this.currentTopDownFactor += (targetFactor - this.currentTopDownFactor) * 0.15;
    this.currentUpY += (targetUpY - this.currentUpY) * 0.15;
    this.currentUpZ += (targetUpZ - this.currentUpZ) * 0.15;

    // 画面シェイクの計算
    let shakeX = 0;
    let shakeZ = 0;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.screenShakeTime > 0) {
      const elapsed = nowMs - this.screenShakeTime;
      if (elapsed < this.screenShakeDuration) {
        const progress = 1 - (elapsed / this.screenShakeDuration);
        const mag = (this.screenShakeIntensity * progress) * 0.12;
        shakeX = (Math.random() * 2 - 1) * mag;
        shakeZ = (Math.random() * 2 - 1) * mag;
      } else {
        this.screenShakeTime = 0;
      }
    }

    const eyeX = this.currentCamX + shakeX;
    const eyeY = this.currentCamHeight;
    const eyeZ = this.currentCamZ + this.currentCamDistZ + shakeZ;

    this.camEye = [eyeX, eyeY, eyeZ];
    this.camCenter = [this.currentCamX + shakeX, 0.0, this.currentCamZ + shakeZ];
    const up = [0.0, this.currentUpY, this.currentUpZ];

    const viewMatrix = Mat4.create();
    Mat4.lookAt(viewMatrix, this.camEye, this.camCenter, up);

    const aspect = this.canvas.width / this.canvas.height;
    const projMatrix = Mat4.create();
    const fov = isTopDown ? 28.0 : 30.0;
    Mat4.perspective(projMatrix, fov * (Math.PI / 180), aspect, 0.5, 200.0);

    Mat4.multiply(this.viewProjMatrix, projMatrix, viewMatrix);

    // 3. プレイヤー足元セルの環境判定に基づき、視界半径 (lightRadius) を動的に補間
    const playerCell = areaGrid ? areaGrid[Math.round(this.playerY)]?.[Math.round(this.playerX)] : null;
    let targetRadius = 6.2; // デフォルト (通常の部屋)
    if (playerCell && playerCell.bottom) {
      const pGlyph = playerCell.bottom.rawGlyph;
      if (pGlyph === 3995 || pGlyph === 3997) {
        // 通路: 視界を狭めて閉塞感と緊張感を高める (半径 3.8)
        targetRadius = 3.8;
      } else if (pGlyph === 3993) {
        // 暗い部屋: 少し狭め (半径 4.6)
        targetRadius = 4.6;
      } else if (pGlyph === 3992 || pGlyph === 3996) {
        // 明るい部屋 / 照らされた通路: 広々 (半径 7.5)
        targetRadius = 7.5;
      }
    }
    this.targetLightRadius = targetRadius;
    if (Math.abs(this.targetLightRadius - this.currentLightRadius) > 0.05) {
      this.currentLightRadius += (this.targetLightRadius - this.currentLightRadius) * 0.12;
      this.wakeUp();
    }

    // 4. インスタンスデータの構築 (Dirty キャッシュ判定)
    const turn = situation?.turn ?? 0;
    const activeMonstersCount = area?.activeMonsters?.length ?? 0;
    const dirtyCount = area?.dirtyCells ? area.dirtyCells.size : 0;

    // 過渡的エフェクトグリフ (投擲物・杖ビーム・爆発) の存在検出
    let currentEffectCount = 0;
    if (areaGrid) {
      for (let y = 0; y < 24; y++) {
        for (let x = 0; x < 80; x++) {
          if (areaGrid[y]?.[x]?.effect && areaGrid[y][x].effect.rawGlyph >= 0) {
            currentEffectCount++;
          }
        }
      }
    }
    if (currentEffectCount > 0) {
      this.wakeUp();
    }

    const gridSignature = `${turn}_${Math.round(targetPx)}_${Math.round(targetPy)}_${activeMonstersCount}_${dirtyCount}_${currentEffectCount}_${this.cameraMode}_${this.isPlayerDead ? 1 : 0}`;

    if (gridSignature !== this.lastGridSignature) {
      this.isInstanceDirty = true;
      this.lastGridSignature = gridSignature;
      this.wakeUp();
    }

    // セルまたは状態に変更がある時のみインスタンスバッファを再生成
    if (this.isInstanceDirty) {
      let instanceCount = 0;
      let countFloor = 0;
      let countWall = 0;
      let countItem = 0;
      let countChar = 0;
      let countEffect = 0;
      const data = this.instanceData;

      const pushInstance = (wx, wy, wz, layerType, isPlayer = 0.0, anim = 0.0, tileIdx = 0.0, tileLight = 1.0) => {
        if (instanceCount >= this.maxInstances) return;
        const idx = instanceCount * 8;
        data[idx + 0] = wx;
        data[idx + 1] = wy;
        data[idx + 2] = wz;
        data[idx + 3] = layerType;
        data[idx + 4] = isPlayer;
        data[idx + 5] = anim;
        data[idx + 6] = tileIdx;
        data[idx + 7] = tileLight;
        instanceCount++;

        if (layerType === 0.0) countFloor++;
        else if (layerType === 1.0 || layerType === 2.0) countWall++;
        else if (layerType >= 3.0 && layerType < 3.5) countItem++;
        else if (layerType === 4.0) countChar++;
        else if (layerType === 5.0) countEffect++;
      };

      for (let y = 0; y < 24; y++) {
        for (let x = 0; x < 80; x++) {
          const cell = areaGrid ? areaGrid[y]?.[x] : null;
          let drawnAny = false;

          // タイルの基礎環境明度の判定 (明室: 1.0, 暗室: 0.35, 通路: 0.45, 壁: 0.75, その他: 0.85)
          let cellLight = 0.85;
          if (cell && cell.bottom) {
            const g = cell.bottom.rawGlyph;
            if (g === 3993) {
              cellLight = 0.35; // 暗い部屋 (S_darkroom)
            } else if (g === 3995 || g === 3994 || g === 3997) {
              cellLight = 0.45; // 通路 (S_corr, S_engrcorr)
            } else if (g === 3992 || g === 3996) {
              cellLight = 1.0;  // 明るい部屋 (S_room), 明るい通路 (S_litcorr)
            } else if (cell.bottom.category === 'WALL' || cell.bottom.cmapFlags?.isWall) {
              cellLight = 0.75; // 壁
            }
          }

          if (cell) {
            // Layer 0 & 1/2: Bottom (床 / 壁)
            if (cell.bottom && cell.bottom.rawGlyph >= 0) {
              const isWall = cell.bottom.category === 'WALL' || cell.bottom.cmapFlags?.isWall;
              const tileIdx = getTileIdx(cell.bottom.rawGlyph);
              if (isWall) {
                pushInstance(x, 0.0, y, 1.0, 0.0, 0.0, tileIdx, cellLight); // 壁天面
                // トップビューモード専用時以外は壁前面も生成
                if (this.cameraMode !== 'topdown') {
                  pushInstance(x, 0.0, y, 2.0, 0.0, 0.0, tileIdx, cellLight); // 壁前面
                }
              } else {
                pushInstance(x, 0.0, y, 0.0, 0.0, 0.0, tileIdx, cellLight); // 床
              }
              drawnAny = true;
            }

            // Layer 3: Middle (アイテム)
            if (cell.middle && cell.middle.rawGlyph >= 0) {
              const tileIdx = getTileIdx(cell.middle.rawGlyph);
              pushInstance(x, 0.0, y, 3.0, 0.0, (x * 7 + y * 13) % 10, tileIdx, cellLight);
              drawnAny = true;
            }

            // 自キャラ足元枠 (Layer 3.2: Middle) - キャラクター (Layer 4) の足元・背面に潜り込ませる
            if (x === Math.round(targetPx) && y === Math.round(targetPy)) {
              pushInstance(x, 0.0, y, 3.2, this.isPlayerDead ? 2.0 : 1.0, 0.0, 0.0, 1.0);
              drawnAny = true;
            }

            // Pet / Ridden 足元サークル (Layer 3.3: Middle) - 直立キャラクター (Layer 4) の足元・背面に潜り込ませる
            const topGlyph = cell.top?.rawGlyph ?? -1;
            const isPet = Boolean(cell.top?.isPet || (topGlyph >= 766 && topGlyph < 1532));
            const isRidden = Boolean(cell.top?.isRidden || (topGlyph >= 2682 && topGlyph < 3448));
            if (isPet || isRidden) {
              pushInstance(x, 0.0, y, 3.3, isRidden ? 2.0 : 1.0, 0.0, 0.0, cellLight);
              drawnAny = true;
            }

            // Layer 4: Top (モンスター / プレイヤー / 死亡時墓石)
            const isDeathPos = this.isPlayerDead && this.deathPosition && x === this.deathPosition.x && y === this.deathPosition.y;
            if (isDeathPos) {
              // 🪦 プレイヤー死亡時は墓石タイルを配置 (静止、バウンスなし: anim = -1.0)
              const tombGlyph = (typeof DEFAULT_TOMBSTONE_GLYPH !== 'undefined') ? DEFAULT_TOMBSTONE_GLYPH : 2321;
              const tileIdx = (tileMap && tileMap[tombGlyph] !== undefined) ? tileMap[tombGlyph] : 1310;
              pushInstance(x, 0.0, y, 4.0, 0.0, -1.0, tileIdx, cellLight);
              drawnAny = true;
            } else if (cell.top && cell.top.rawGlyph >= 0) {
              const isPlayer = cell.top.isPlayer ? 1.0 : 0.0;
              const tileIdx = getTileIdx(cell.top.rawGlyph);
              const charLight = isPlayer > 0.5 ? 1.0 : cellLight;
              pushInstance(x, 0.0, y, 4.0, isPlayer, (x * 3 + y * 5) % 8, tileIdx, charLight);
              drawnAny = true;
            }

            // Layer 5: Effect (過渡的エフェクト: 投擲物・杖ビーム・爆発等)
            if (cell.effect && cell.effect.rawGlyph >= 0) {
              const tileIdx = getTileIdx(cell.effect.rawGlyph);
              pushInstance(x, 0.0, y, 5.0, 0.0, 0.0, tileIdx, 1.0); // 自発光
              drawnAny = true;
            }
          }

          // フォールバック: areaGrid が未初期化、または過渡的グリフの場合
          if (!drawnAny && glyphBuffer && glyphBuffer[y]?.[x]?.glyph >= 0) {
            const isDeathPos = this.isPlayerDead && this.deathPosition && x === this.deathPosition.x && y === this.deathPosition.y;
            if (isDeathPos) {
              const tombGlyph = (typeof DEFAULT_TOMBSTONE_GLYPH !== 'undefined') ? DEFAULT_TOMBSTONE_GLYPH : 2321;
              const tileIdx = (tileMap && tileMap[tombGlyph] !== undefined) ? tileMap[tombGlyph] : 1310;
              pushInstance(x, 0.0, y, 4.0, 0.0, -1.0, tileIdx, cellLight);
            } else {
              const gId = glyphBuffer[y][x].glyph;
              const tileIdx = getTileIdx(gId);
              if (x === Math.round(targetPx) && y === Math.round(targetPy)) {
                pushInstance(x, 0.0, y, 3.2, this.isPlayerDead ? 2.0 : 1.0, 0.0, 0.0, 1.0);
                pushInstance(x, 0.0, y, 4.0, 1.0, 0.0, tileIdx, 1.0);
              } else {
                pushInstance(x, 0.0, y, 5.0, 0.0, 0.0, tileIdx, 1.0);
              }
            }
          }
        }
      }

      this.instanceCounts = {
        total: instanceCount,
        floor: countFloor,
        wall: countWall,
        item: countItem,
        char: countChar,
        effect: countEffect
      };

      // GPU バッファ書き込み
      if (instanceCount > 0) {
        this.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceData, 0, instanceCount * 8);
      }
      this.cachedInstanceCount = instanceCount;
      this.isInstanceDirty = false;
    }

    // 5. Uniform バッファ書き込み (112 bytes = 28 floats, 128 bytes バッファ内に格納)
    const uniformArray = new Float32Array(28);
    uniformArray.set(this.viewProjMatrix, 0);
    uniformArray[16] = this.texWidth;
    uniformArray[17] = this.texHeight;
    uniformArray[18] = timeInSeconds;
    uniformArray[19] = this.hasTexture ? 1.0 : 0.0;
    uniformArray[20] = this.currentTopDownFactor;
    uniformArray[21] = this.currentLightRadius;
    uniformArray[22] = this.ambientFloor;
    uniformArray[23] = 0.0; // pad0
    uniformArray[24] = this.playerX;
    uniformArray[25] = this.playerY;
    uniformArray[26] = 0.0; // pad1
    uniformArray[27] = 0.0; // pad2
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformArray);

    // 5. レンダリングコマンドの発行
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.08, g: 0.12, b: 0.20, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.instanceBuffer);

    if (this.cachedInstanceCount > 0) {
      renderPass.draw(6, this.cachedInstanceCount, 0, 0);
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // 6. Visual FX 最前面オーバーレイ描画
    this.renderVisualFx(nowMs);

    // 7. デバッグ HUD の更新
    this._updateDebugHud(timeInSeconds);
  }

  /**
   * マルチカメラ描画ヘルパー: 1回のインスタンスバッファから別カメラ行列・別レンダーターゲットに描画可能
   */
  renderSubViewport({ renderPass, viewProjMatrix, topDownFactor = 1.0, timeInSeconds = 0 }) {
    if (!this.isSupported || !this.pipeline || !this.bindGroup || this.cachedInstanceCount === 0) return;

    // サブカメラ用の Uniform を更新して描画
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setVertexBuffer(1, this.instanceBuffer);
    renderPass.draw(6, this.cachedInstanceCount, 0, 0);
  }
}
