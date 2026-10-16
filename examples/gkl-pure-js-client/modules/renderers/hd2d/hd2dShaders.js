/**
 * hd2dShaders.js - WGSL シェーダーコード
 * WebGPU HD2D ジオラマレンダラー用 (ハイブリッド HD-2D: ジオラマベース ＋ タイルドット絵)
 */

export const WGSL_SHADER = `
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

  // 影エリアの個別暗所処理: tileLight <= 0.25 の床プレーンは完全に真っ黒
  if (input.tileLight <= 0.25 && input.layerType < 0.5) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  // 総合明度: 通常タイルおよび上に乗る敵・アイテムはトーチ光で照らされる (暗くしない)
  var light = max(input.tileLight * uniforms.ambientFloor, torchLight * 0.95);
  light = clamp(light, 0.08, 1.15);

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
