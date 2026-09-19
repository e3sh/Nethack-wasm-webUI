/**
 * WebGPUHD2DRenderer.js - NetHack Wasm WebUI HD2D風 ジオラマレンダラー (Rev 6: ハイブリッドHD-2D)
 * 
 * WebGPU (WGSL) を活用し、NetHack のダンジョンをオクトパストラベラー風の
 * 立体ジオラマ（水平床、3D壁キューブ、直立ビルボード、浮遊アイテム）として
 * 本番 NetHack タイルテクスチャ ＆ 鮮明なジオラマ立体ベースで描画するアドオンレンダラー。
 */

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
  @location(7) padding: f32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) @interpolate(flat) layerType: f32,
  @location(2) @interpolate(flat) isPlayer: f32,
  @location(3) texCoord: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  var finalPos = input.worldPos;

  let lx = input.localPos.x;
  let ly = input.localPos.y;

  if (input.layerType < 0.5) {
    // 【Layer 0: 床】 水平プレーン (Y = 0.0, XZ平面)
    finalPos += vec3<f32>(lx, 0.0, ly);
  } else if (input.layerType < 1.5) {
    // 【Layer 1: 壁キューブ天面】 水平プレーン (Y = 1.0, XZ平面)
    finalPos += vec3<f32>(lx, 1.0, ly);
  } else if (input.layerType < 2.5) {
    // 【Layer 2: 壁キューブ前面】 垂直プレーン (手前 Z = +0.5, Y = 0.0 ~ 1.0)
    finalPos += vec3<f32>(lx, ly + 0.5, 0.5);
  } else if (input.layerType < 3.5) {
    // 【Layer 3: アイテム】 浮遊水平プレーン (Y = 0.25 + 微バウンス, XZ平面)
    let bounce = sin(uniforms.time * 4.0 + input.animOffset) * 0.05;
    finalPos += vec3<f32>(lx * 0.75, 0.25 + bounce, ly * 0.75);
  } else {
    // 【Layer 4: キャラクター】 直立ビルボード (手前 +Z を向く直立プレーン, Y = 0.0 ~ 0.9)
    let bounce = abs(sin(uniforms.time * 6.0 + input.animOffset)) * 0.06;
    finalPos += vec3<f32>(lx * 0.88, (ly + 0.5) * 0.88 + bounce, 0.05);
  }

  out.position = uniforms.viewProj * vec4<f32>(finalPos, 1.0);
  out.uv = input.uv;
  out.layerType = input.layerType;
  out.isPlayer = input.isPlayer;

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

  // 1. 各レイヤーの基本立体カラー (ジオラマベース)
  var baseColor = vec3<f32>(0.20, 0.34, 0.26); // 床
  if (input.layerType < 0.5) {
    // 床: スレートグリーン + 黒枠グリッド線
    if (uv.x < 0.06 || uv.x > 0.94 || uv.y < 0.06 || uv.y > 0.94) {
      baseColor = vec3<f32>(0.08, 0.15, 0.11);
    }
  } else if (input.layerType < 1.5) {
    // 壁天面: サンドストーン
    baseColor = vec3<f32>(0.88, 0.76, 0.55);
    if (uv.x < 0.06 || uv.x > 0.94 || uv.y < 0.06 || uv.y > 0.94) {
      baseColor = vec3<f32>(0.68, 0.56, 0.38);
    }
  } else if (input.layerType < 2.5) {
    // 壁前面: 陰影レンガブラウン
    baseColor = vec3<f32>(0.58, 0.42, 0.28);
    if (uv.x < 0.06 || uv.x > 0.94 || uv.y < 0.06 || uv.y > 0.94) {
      baseColor = vec3<f32>(0.38, 0.26, 0.16);
    }
  } else if (input.layerType < 3.5) {
    // アイテム: ひし形
    let dist = abs(uv.x - 0.5) + abs(uv.y - 0.5);
    if (dist > 0.42) { discard; }
    baseColor = vec3<f32>(0.15, 0.90, 1.0);
  } else {
    // キャラクター: 円形トークン
    let dist = distance(uv, vec2<f32>(0.5, 0.5));
    if (dist > 0.48) { discard; }
    if (input.isPlayer > 0.5) {
      baseColor = vec3<f32>(1.0, 0.88, 0.15);
    } else {
      baseColor = vec3<f32>(0.95, 0.20, 0.20);
    }
  }

  // 2. タイルテクスチャ合成
  if (uniforms.hasTexture > 0.5) {
    let texColor = textureSample(tileTexture, tileSampler, input.texCoord);

    if (input.layerType >= 2.5) {
      // キャラクター & アイテム:
      // タイルの非黒・非透明ピクセルを鮮やかに表示
      let hasContent = texColor.a > 0.2 && (texColor.r > 0.06 || texColor.g > 0.06 || texColor.b > 0.06);
      if (hasContent) {
        var charRgb = texColor.rgb;
        if (input.isPlayer > 0.5) {
          // 自キャラはほんのり明るく存在感を強調
          charRgb = mix(charRgb, vec3<f32>(1.0, 0.95, 0.7), 0.12);
        }
        return vec4<f32>(charRgb, 1.0);
      }
      // タイルの透明/黒ピクセル部分は、トークン形状外を破棄
      if (input.layerType < 3.5) {
        let dist = abs(uv.x - 0.5) + abs(uv.y - 0.5);
        if (dist > 0.40) { discard; }
      } else {
        let dist = distance(uv, vec2<f32>(0.5, 0.5));
        if (dist > 0.45) { discard; }
      }
      return vec4<f32>(baseColor, 1.0);
    } else {
      // 床 & 壁:
      // タイルに絵柄（石の線や模様）がある部分はベースカラーの上にオーバーレイ
      let hasDetail = texColor.a > 0.1 && (texColor.r > 0.06 || texColor.g > 0.06 || texColor.b > 0.06);
      if (hasDetail) {
        let blended = mix(baseColor, texColor.rgb, 0.55);
        return vec4<f32>(blended, 1.0);
      } else {
        // 背景の黒部分はベースカラーをそのまま表示 (真っ暗になるのを100%防止！)
        return vec4<f32>(baseColor, 1.0);
      }
    }
  }

  return vec4<f32>(baseColor, 1.0);
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
    this.instanceCounts = { total: 0, floor: 0, wall: 0, item: 0, char: 0 };
    this.debugHudElement = null;

    // カメラ位置 (斜め約 45度見下ろしの HD-2D ジオラマアングル ＆ スムーズ追従)
    this.currentCamX = null;
    this.currentCamZ = null;
    this.camEye = [40.0, 18.0, 26.0];
    this.camCenter = [40.0, 0.0, 12.0];
    this.playerX = 40.0;
    this.playerY = 12.0;
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
    const parent = this.canvas.parentElement;
    if (!parent) return;

    this.debugHudElement = document.createElement('div');
    this.debugHudElement.id = 'webgpu-debug-hud';
    this.debugHudElement.style.display = 'none';
    parent.appendChild(this.debugHudElement);
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

    const { total, floor, wall, item, char } = this.instanceCounts;
    const camX = this.currentCamX !== null ? this.currentCamX.toFixed(1) : '-';
    const camZ = this.currentCamZ !== null ? this.currentCamZ.toFixed(1) : '-';
    const texBadge = this.hasTexture ? `Texture: OK` : `Texture: ${this.textureStatus}`;

    this.debugHudElement.innerHTML = `
      <div><span class="badge-ok">✨ WebGPU HD-2D</span> &nbsp;|&nbsp; <b>${this.currentFps} FPS</b></div>
      <div class="hud-details">
        <div>${texBadge} &nbsp;|&nbsp; Instances: <b>${total}</b> (<span class="badge-layer" style="color:#60c075">Floor: ${floor}</span> <span class="badge-layer" style="color:#e0b070">Wall: ${wall}</span> <span class="badge-layer" style="color:#40e0ff">Item: ${item}</span> <span class="badge-layer" style="color:#ffdc40">Char: ${char}</span>)</div>
        <div>Player: (${this.playerX.toFixed(0)}, ${this.playerY.toFixed(0)}) &nbsp;|&nbsp; Cam: (${camX}, ${camZ})</div>
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
        this.onCellClick(grid.x, grid.y);
      }
    });
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

  setActive(active) {
    this.isActive = active;
    if (active) {
      this.canvas.classList.remove('hidden');
      if (this.debugHudElement) this.debugHudElement.style.display = 'block';
      this._startRenderLoop();
    } else {
      this.canvas.classList.add('hidden');
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
      this.render(timestamp / 1000.0);
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

    if (area && typeof area.playerX === 'number') {
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

    this.playerX = targetPx;
    this.playerY = targetPy;

    // 2. カメラ行列計算 (プレイヤー追従 HD-2D ジオラマ斜め見下ろしビュー)
    if (this.currentCamX === null || this.currentCamZ === null) {
      this.currentCamX = targetPx;
      this.currentCamZ = targetPy;
    } else {
      this.currentCamX += (targetPx - this.currentCamX) * 0.12;
      this.currentCamZ += (targetPy - this.currentCamZ) * 0.12;
    }

    const camHeight = 18.0;
    const camDistZ = 16.0;

    const eyeX = this.currentCamX;
    const eyeY = camHeight;
    const eyeZ = this.currentCamZ + camDistZ;

    this.camEye = [eyeX, eyeY, eyeZ];
    this.camCenter = [this.currentCamX, 0.0, this.currentCamZ];
    const up = [0.0, 1.0, 0.0];

    const viewMatrix = Mat4.create();
    Mat4.lookAt(viewMatrix, this.camEye, this.camCenter, up);

    const aspect = this.canvas.width / this.canvas.height;
    const projMatrix = Mat4.create();
    Mat4.perspective(projMatrix, 36.0 * (Math.PI / 180), aspect, 0.5, 120.0);

    Mat4.multiply(this.viewProjMatrix, projMatrix, viewMatrix);

    // 3. インスタンスデータの構築 (1インスタンス = 8 floats)
    let instanceCount = 0;
    let countFloor = 0;
    let countWall = 0;
    let countItem = 0;
    let countChar = 0;
    const data = this.instanceData;

    const pushInstance = (wx, wy, wz, layerType, isPlayer = 0.0, anim = 0.0, tileIdx = 0.0) => {
      if (instanceCount >= this.maxInstances) return;
      const idx = instanceCount * 8;
      data[idx + 0] = wx;
      data[idx + 1] = wy;
      data[idx + 2] = wz;
      data[idx + 3] = layerType;
      data[idx + 4] = isPlayer;
      data[idx + 5] = anim;
      data[idx + 6] = tileIdx;
      data[idx + 7] = 0.0;
      instanceCount++;

      if (layerType === 0.0) countFloor++;
      else if (layerType === 1.0 || layerType === 2.0) countWall++;
      else if (layerType === 3.0) countItem++;
      else if (layerType === 4.0) countChar++;
    };

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const cell = areaGrid ? areaGrid[y]?.[x] : null;
        let drawnAny = false;

        if (cell) {
          // Layer 0 & 1/2: Bottom (床 / 壁)
          if (cell.bottom && cell.bottom.rawGlyph >= 0) {
            const isWall = cell.bottom.category === 'WALL' || cell.bottom.cmapFlags?.isWall;
            const tileIdx = getTileIdx(cell.bottom.rawGlyph);
            if (isWall) {
              pushInstance(x, 0.0, y, 1.0, 0.0, 0.0, tileIdx); // 壁天面
              pushInstance(x, 0.0, y, 2.0, 0.0, 0.0, tileIdx); // 壁前面
            } else {
              pushInstance(x, 0.0, y, 0.0, 0.0, 0.0, tileIdx); // 床
            }
            drawnAny = true;
          }

          // Layer 3: Middle (アイテム)
          if (cell.middle && cell.middle.rawGlyph >= 0) {
            const tileIdx = getTileIdx(cell.middle.rawGlyph);
            pushInstance(x, 0.0, y, 3.0, 0.0, (x * 7 + y * 13) % 10, tileIdx);
            drawnAny = true;
          }

          // Layer 4: Top (モンスター / プレイヤー)
          if (cell.top && cell.top.rawGlyph >= 0) {
            const isPlayer = cell.top.isPlayer ? 1.0 : 0.0;
            const tileIdx = getTileIdx(cell.top.rawGlyph);
            pushInstance(x, 0.0, y, 4.0, isPlayer, (x * 3 + y * 5) % 8, tileIdx);
            drawnAny = true;
          }
        }

        // フォールバック: areaGrid が未初期化の場合は glyphBuffer から直接描画
        if (!drawnAny && glyphBuffer && glyphBuffer[y]?.[x]?.glyph >= 0) {
          const gId = glyphBuffer[y][x].glyph;
          const tileIdx = getTileIdx(gId);
          if (x === Math.round(targetPx) && y === Math.round(targetPy)) {
            pushInstance(x, 0.0, y, 4.0, 1.0, 0.0, tileIdx);
          } else {
            pushInstance(x, 0.0, y, 0.0, 0.0, 0.0, tileIdx);
          }
        }
      }
    }

    this.instanceCounts = {
      total: instanceCount,
      floor: countFloor,
      wall: countWall,
      item: countItem,
      char: countChar
    };

    // 4. GPU バッファ書き込み
    if (instanceCount > 0) {
      this.device.queue.writeBuffer(this.instanceBuffer, 0, this.instanceData, 0, instanceCount * 8);
    }

    // Uniform バッファ書き込み
    // viewProj (16 floats = 64 bytes)
    // texWidth (1 float), texHeight (1 float), time (1 float), hasTexture (1 float) = 16 bytes
    const uniformArray = new Float32Array(20);
    uniformArray.set(this.viewProjMatrix, 0);
    uniformArray[16] = this.texWidth;
    uniformArray[17] = this.texHeight;
    uniformArray[18] = timeInSeconds;
    uniformArray[19] = this.hasTexture ? 1.0 : 0.0;
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

    if (instanceCount > 0) {
      renderPass.draw(6, instanceCount, 0, 0);
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // 6. デバッグ HUD の更新
    this._updateDebugHud(timeInSeconds);
  }
}
