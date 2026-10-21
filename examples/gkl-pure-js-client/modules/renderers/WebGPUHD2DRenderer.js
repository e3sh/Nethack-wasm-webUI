/**
 * WebGPUHD2DRenderer.js - NetHack Wasm WebUI HD2D風 ジオラマレンダラー (Rev 6: ハイブリッドHD-2D)
 * 
 * WebGPU (WGSL) を活用し、NetHack のダンジョンをオクトパストラベラー風の
 * 立体ジオラマ（水平床、3D壁キューブ、直立ビルボード、浮遊アイテム）として
 * 本番 NetHack タイルテクスチャ ＆ 鮮明なジオラマ立体ベースで描画するアドオンレンダラー。
 */

import { DEFAULT_TOMBSTONE_GLYPH } from "../../../../src/core/knowledge/state/AreaStateManager.js";
import { GLYPH_STONE } from "../../../../src/core/knowledge/engines/glyphClassifier.js";
import { getTileCandidatePaths } from "../config/TileConfig.js";
import { Mat4 } from "./hd2d/hd2dMath.js";
import { WGSL_SHADER } from "./hd2d/hd2dShaders.js";
import { HD2DFxOverlay } from "./hd2d/hd2dFxOverlay.js";
import { isCellInShadow } from "./VirtualDungeonScreen.js";

export { Mat4, WGSL_SHADER, HD2DFxOverlay, isCellInShadow };

// ============================================================================
// WebGPUHD2DRenderer クラス本体
// ============================================================================
export class WebGPUHD2DRenderer {
  constructor({ canvas, getSituation, getAreaGrid, getGlyphBuffer, getCore, getTileImg, isTileLoaded, onCellClick, onCellHover, tileSource = null, floorMarkerService = null, getFacingDir = null }) {
    this.canvas = canvas;
    this.getSituation = getSituation || (() => null);
    this.getAreaGrid = getAreaGrid || (() => null);
    this.getGlyphBuffer = getGlyphBuffer || (() => null);
    this.getCore = getCore || (() => null);
    this.getFacingDir = getFacingDir || (() => 'S');
    this.getTileImg = getTileImg || (() => null);
    this.isTileLoaded = isTileLoaded || (() => false);
    this.onCellClick = onCellClick || null;
    this.onCellHover = onCellHover || null;
    this.tileSource = tileSource;
    this.floorMarkerService = floorMarkerService;

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

    // 2D FX & オーバーレイマネージャー
    this.targetCursorX = -1;
    this.targetCursorY = -1;
    this.isPlayerDead = false;
    this.deathPosition = null;

    this.fxOverlay = new HD2DFxOverlay({
      canvas: this.canvas,
      worldToScreen: (gx, gy, gz) => this.worldToScreen(gx, gy, gz),
      getSituation: this.getSituation,
      getAreaGrid: this.getAreaGrid,
      wakeUp: () => this.wakeUp(),
      getPlayerPos: () => ({ x: this.playerX, y: this.playerY }),
      getTargetCursor: () => ({ x: this.targetCursorX, y: this.targetCursorY }),
      getZoom: () => this.currentZoom,
      getCore: this.getCore,
      getFacingDir: this.getFacingDir,
      floorMarkerService: this.floorMarkerService
    });

    this._boundCore = null;
    this._ensureCoreEvents();

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

    // 岩盤レンダリング設定 ('smart' | 'minimal' | 'classic_tile')
    this.stoneRenderingMode = 'smart';
  }

  setStoneRenderingMode(mode) {
    if (mode === 'smart' || mode === 'minimal' || mode === 'classic_tile') {
      this.stoneRenderingMode = mode;
      this.isInstanceDirty = true;
      this.wakeUp();
    }
  }

  setMapActionIndicator(enabled) {
    if (this.fxOverlay) {
      this.fxOverlay.setMapActionIndicator(enabled);
      this.wakeUp();
    }
  }

  _ensureCoreEvents() {
    const core = this.getCore?.();
    if (!core || this._boundCore === core || typeof core.on !== 'function') return;
    this._boundCore = core;
    core.on('dungeonOverviewUpdated', () => {
      this.markDirty();
      this.wakeUp();
    });
  }

  // 互換用プロパティ連携
  get activeFxList() {
    return this.fxOverlay ? this.fxOverlay.activeFxList : [];
  }
  set activeFxList(v) {
    if (this.fxOverlay) this.fxOverlay.activeFxList = v;
  }
  get screenShakeTime() {
    return this.fxOverlay ? this.fxOverlay.screenShakeTime : 0;
  }
  set screenShakeTime(v) {
    if (this.fxOverlay) this.fxOverlay.screenShakeTime = v;
  }
  get screenShakeDuration() {
    return this.fxOverlay ? this.fxOverlay.screenShakeDuration : 0;
  }
  set screenShakeDuration(v) {
    if (this.fxOverlay) this.fxOverlay.screenShakeDuration = v;
  }
  get screenShakeIntensity() {
    return this.fxOverlay ? this.fxOverlay.screenShakeIntensity : 0;
  }
  set screenShakeIntensity(v) {
    if (this.fxOverlay) this.fxOverlay.screenShakeIntensity = v;
  }
  get fxCanvas() {
    return this.fxOverlay ? this.fxOverlay.fxCanvas : null;
  }
  set fxCanvas(v) {
    if (this.fxOverlay) this.fxOverlay.fxCanvas = v;
  }
  get fxCtx() {
    return this.fxOverlay ? this.fxOverlay.fxCtx : null;
  }
  set fxCtx(v) {
    if (this.fxOverlay) this.fxOverlay.fxCtx = v;
  }
  get ambientParticles() {
    return this.fxOverlay ? this.fxOverlay.ambientParticles : [];
  }
  set ambientParticles(v) {
    if (this.fxOverlay) this.fxOverlay.ambientParticles = v;
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
    const candidatePaths = getTileCandidatePaths(this.tileSource);

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
    const idleBadge = this.isIdle ? ' <span style="color:#88ddff">[Idle]</span>' : '';

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
        this.onCellClick(grid.x, grid.y, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) }, false);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.isActive) return;
      const grid = this._raycastFloor(e.clientX, e.clientY);
      if (grid) {
        if (this.onCellContextMenu) {
          this.onCellContextMenu(grid.x, grid.y, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) });
        } else if (this.onCellClick) {
          this.onCellClick(grid.x, grid.y, { clientX: e.clientX, clientY: e.clientY, shiftKey: Boolean(e.shiftKey) }, true);
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
    this.fxOverlay.init();
  }

  addVisualFx(fx) {
    this.fxOverlay.addVisualFx(fx);
    this.wakeUp();
  }

  triggerScreenShake(intensity = 3, durationMs = 100) {
    this.fxOverlay.triggerScreenShake(intensity, durationMs);
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
    this.fxOverlay._renderCursorFrames(ctx, ts, now, { x: this.playerX, y: this.playerY }, { x: this.targetCursorX, y: this.targetCursorY });
  }

  /**
   * Pet / Ridden / piletop アイテムの視覚的強調描画 (3D 空間追従オーバーレイ)
   */
  _renderEntityHighlights(ctx, ts, now) {
    this.fxOverlay._renderEntityHighlights(ctx, ts, now);
  }

  _initAmbientParticles() {
    this.fxOverlay?._initAmbientParticles();
  }

  _renderAmbientParticles(ctx, now) {
    this.fxOverlay._renderAmbientParticles(ctx, now, { x: this.playerX, y: this.playerY });
  }

  /**
   * Visual FX の描画＆自動ライフサイクル管理 (オーバーレイ Canvas 2D)
   */
  renderVisualFx(now) {
    this.fxOverlay.render(now);
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
    this._ensureCoreEvents();
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

    const pBottom = playerCell?.bottom?.rawGlyph ?? -1;
    const pMiddle = playerCell?.middle?.rawGlyph ?? -1;
    const pPile = playerCell?.middle?.isPile ? 1 : 0;
    const committedTurnCount = this.getCore?.()?.gkl?.areaStateManager?.committedTurnCount ?? 0;
    const gridSignature = `${turn}_${committedTurnCount}_${Math.round(targetPx)}_${Math.round(targetPy)}_${pBottom}_${pMiddle}_${pPile}_${activeMonstersCount}_${dirtyCount}_${currentEffectCount}_${this.cameraMode}_${this.isPlayerDead ? 1 : 0}`;

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
          const gData = glyphBuffer ? glyphBuffer[y]?.[x] : null;
          const hasNetHackGlyph = Boolean(gData && gData.glyph >= 0 && gData.glyph < 9622 && gData.ch !== ' ');
          const isObserved = Boolean(hasNetHackGlyph || cell?.middle || cell?.top);

          const isExploredBottom = Boolean(
            cell &&
            cell.bottom &&
            cell.bottom.type !== 'UNEXPLORED' &&
            cell.bottom.rawGlyph >= 0 &&
            cell.bottom.rawGlyph < 9622 &&
            (!cell.bottom.isCachedPreload || isObserved)
          );

          // タイルの基礎環境明度の判定 (明室: 1.0, 暗室: 0.35, 通路: 0.45, 壁: 0.75, その他: 0.85)
          let cellLight = 0.85;
          if (isExploredBottom) {
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

          // アイテムまたはモンスターが存在する場合の周囲近傍判定 (局所的影コントロール)
          const hasItem = Boolean(cell?.middle && cell.middle.rawGlyph >= 0 && cell.middle.rawGlyph < 9622);
          const hasMonster = Boolean(cell?.top && !cell.top.isPlayer && cell.top.rawGlyph >= 0 && cell.top.rawGlyph < 9622);
          const inShadow = (hasItem || hasMonster) && isCellInShadow(areaGrid, x, y, targetPx, targetPy);

          if (cell) {
            // Layer 0 & 1/2: Bottom (床 / 壁) - 未踏領域 (UNEXPLORED / >= 9622) は描画しない
            if (isExploredBottom) {
              const isWall = cell.bottom.category === 'WALL' || cell.bottom.cmapFlags?.isWall;
              const tileIdx = getTileIdx(cell.bottom.rawGlyph);
              if (isWall) {
                pushInstance(x, 0.0, y, 1.0, 0.0, 0.0, tileIdx, cellLight); // 壁天面
                // トップビューモード専用時以外は壁前面も生成
                if (this.cameraMode !== 'topdown') {
                  pushInstance(x, 0.0, y, 2.0, 0.0, 0.0, tileIdx, cellLight); // 壁前面
                }
              } else {
                // 影エリアの床は真っ黒照明 (0.20) で描画
                pushInstance(x, 0.0, y, 0.0, 0.0, 0.0, tileIdx, inShadow ? 0.20 : cellLight); // 床
              }
              drawnAny = true;
            } else if (inShadow) {
              // 3D 空間で床が透明に抜けるのを防ぐため、暗室床 (S_darkroom: 3993) を真っ黒照明 (0.20) で敷く
              const floorTileIdx = getTileIdx(3993);
              pushInstance(x, 0.0, y, 0.0, 0.0, 0.0, floorTileIdx, 0.20);
              drawnAny = true;
            } else if (this.stoneRenderingMode !== 'minimal' && cell?.bottom?.isObservedStone && !cell.bottom.isCachedPreload) {
              const dx = x - Math.round(targetPx);
              const dy = y - Math.round(targetPy);
              const dist = Math.max(Math.abs(dx), Math.abs(dy));

              // 掘削アクション判定 (隣接 1 マス)
              let targetDir = null;
              if (dist <= 1) {
                if (dx === 0 && dy === -1) targetDir = 'N';
                else if (dx === 1 && dy === -1) targetDir = 'NE';
                else if (dx === 1 && dy === 0) targetDir = 'E';
                else if (dx === 1 && dy === 1) targetDir = 'SE';
                else if (dx === 0 && dy === 1) targetDir = 'S';
                else if (dx === -1 && dy === 1) targetDir = 'SW';
                else if (dx === -1 && dy === 0) targetDir = 'W';
                else if (dx === -1 && dy === -1) targetDir = 'NW';
              }

              const hasDig = Boolean(
                targetDir && situation?.actions?.some(a => {
                  const d = a.directionCode || a.dirCode;
                  const isDig = a.id?.includes('DIG');
                  return d === targetDir && isDig;
                })
              );

              const stoneGlyph = cell?.bottom?.rawGlyph || GLYPH_STONE;
              const stoneIdx = getTileIdx(stoneGlyph);

              if (hasDig) {
                pushInstance(x, 0.0, y, 1.0, 0.0, 0.0, stoneIdx, 0.85); // 壁天面
                if (this.cameraMode !== 'topdown') {
                  pushInstance(x, 0.0, y, 2.0, 0.0, 0.0, stoneIdx, 0.85); // 壁前面
                }
                drawnAny = true;
              } else if (this.stoneRenderingMode === 'classic_tile') {
                pushInstance(x, 0.0, y, 1.0, 0.0, 0.0, stoneIdx, 0.75);
                if (this.cameraMode !== 'topdown') {
                  pushInstance(x, 0.0, y, 2.0, 0.0, 0.0, stoneIdx, 0.75);
                }
                drawnAny = true;
              }
            }

            // Layer 3: Middle (アイテム) - 床さえ暗くなればアイテムは暗くする必要はないため cellLight で通常描画
            if (cell.middle && cell.middle.rawGlyph >= 0 && cell.middle.rawGlyph < 9622) {
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
            } else if (cell.top && cell.top.rawGlyph >= 0 && cell.top.rawGlyph < 9622) {
              const isPlayer = cell.top.isPlayer ? 1.0 : 0.0;
              const tileIdx = getTileIdx(cell.top.rawGlyph);
              const charLight = isPlayer > 0.5 ? 1.0 : cellLight;
              pushInstance(x, 0.0, y, 4.0, isPlayer, (x * 3 + y * 5) % 8, tileIdx, charLight);
              drawnAny = true;
            }

            // Layer 5: Effect (過渡的エフェクト: 投擲物・杖ビーム・爆発等)
            if (cell.effect && cell.effect.rawGlyph >= 0 && cell.effect.rawGlyph < 9622) {
              const tileIdx = getTileIdx(cell.effect.rawGlyph);
              pushInstance(x, 0.0, y, 5.0, 0.0, 0.0, tileIdx, 1.0); // 自発光
              drawnAny = true;
            }
          }

          // フォールバック: areaGrid が未初期化、または過渡的グリフの場合 (未踏 ' ' や >= 9622 は除外)
          const gBufCell = glyphBuffer && glyphBuffer[y]?.[x];
          if (!drawnAny && gBufCell && gBufCell.glyph >= 0 && gBufCell.glyph < 9622 && gBufCell.ch !== ' ') {
            const isDeathPos = this.isPlayerDead && this.deathPosition && x === this.deathPosition.x && y === this.deathPosition.y;
            if (isDeathPos) {
              const tombGlyph = (typeof DEFAULT_TOMBSTONE_GLYPH !== 'undefined') ? DEFAULT_TOMBSTONE_GLYPH : 2321;
              const tileIdx = (tileMap && tileMap[tombGlyph] !== undefined) ? tileMap[tombGlyph] : 1310;
              pushInstance(x, 0.0, y, 4.0, 0.0, -1.0, tileIdx, cellLight);
            } else {
              const gId = gBufCell.glyph;
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
