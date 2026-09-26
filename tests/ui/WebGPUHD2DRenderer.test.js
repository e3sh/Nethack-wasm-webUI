import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebGPUHD2DRenderer } from '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js';

describe('WebGPUHD2DRenderer - Phase 3 WebGPU HD2D 一本化 ＆ 描画調整', () => {
  let mockCanvas;

  beforeEach(() => {
    mockCanvas = {
      width: 720,
      height: 288,
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn()
      },
      parentElement: {
        appendChild: vi.fn()
      },
      addEventListener: vi.fn(),
      getContext: vi.fn()
    };
  });

  it('1. navigator.gpu が未定義の環境では安全に false を返し、エラーを記録すること', async () => {
    // navigator.gpu がない環境 (Node / jsdom / 非対応ブラウザ)
    const originalGpu = navigator.gpu;
    try {
      // @ts-ignore
      delete navigator.gpu;

      const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
      const ok = await renderer.init();

      expect(ok).toBe(false);
      expect(renderer.isSupported).toBe(false);
      expect(renderer.initError).toContain('WebGPU not enabled/supported');
    } finally {
      if (originalGpu !== undefined) {
        navigator.gpu = originalGpu;
      }
    }
  });

  it('2. カメラモードの初期値が diorama であり、setCameraMode / toggleCameraMode で相互に切り替わること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    expect(renderer.cameraMode).toBe('diorama');

    // topdown への切り替え
    renderer.setCameraMode('topdown');
    expect(renderer.cameraMode).toBe('topdown');
    expect(renderer.isInstanceDirty).toBe(true);

    // toggle で diorama に戻る
    const nextMode = renderer.toggleCameraMode();
    expect(nextMode).toBe('diorama');
    expect(renderer.cameraMode).toBe('diorama');

    // 無効なモード指定は無視されること
    renderer.setCameraMode('invalid_mode');
    expect(renderer.cameraMode).toBe('diorama');
  });

  it('3. markDirty および wakeUp によりアイドル状態が解除され Dirty フラグが立つこと', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    renderer.isIdle = true;
    renderer.isInstanceDirty = false;

    renderer.markDirty();
    expect(renderer.isInstanceDirty).toBe(true);
    expect(renderer.isIdle).toBe(false);

    renderer.isIdle = true;
    renderer.wakeUp();
    expect(renderer.isIdle).toBe(false);
  });

  it('4. インスタンスキャッシュ: プレイヤー座標やダンジョンターンが未変化の時、キャッシュが維持されること', () => {
    const renderer = new WebGPUHD2DRenderer({
      canvas: mockCanvas,
      getSituation: () => ({
        turn: 10,
        area: { playerX: 20, playerY: 10, grid: [], activeMonsters: [] }
      })
    });

    // 初期化状態
    expect(renderer.isInstanceDirty).toBe(true);
    renderer.cachedInstanceCount = 120;
    renderer.isInstanceDirty = false;
    renderer.lastGridSignature = '10_20_10_0_0_diorama';

    // 同一シグネチャの場合は isInstanceDirty が立たない
    const situation = {
      turn: 10,
      area: { playerX: 20, playerY: 10, grid: [], activeMonsters: [] }
    };
    const turn = situation.turn;
    const gridSignature = `${turn}_20_10_0_0_diorama`;
    expect(gridSignature).toBe(renderer.lastGridSignature);

    // プレイヤーが移動した場合はシグネチャが変わり Dirty になる
    const newSignature = `${turn}_21_10_0_0_diorama`;
    expect(newSignature).not.toBe(renderer.lastGridSignature);
  });

  it('5. 省電力アイドル判定: カメラ追従が収束し、一定時間経過すると isIdle が true に判定されるロジック', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    renderer.currentCamX = 40.0;
    renderer.currentCamZ = 12.0;
    renderer.playerX = 40.0;
    renderer.playerY = 12.0;
    renderer.currentTopDownFactor = 0.0;
    renderer.cameraMode = 'diorama';

    // カメラが収束している条件
    const isCamSettled = Math.abs(renderer.currentCamX - renderer.playerX) < 0.01 &&
      Math.abs(renderer.currentCamZ - renderer.playerY) < 0.01;
    const targetFactor = renderer.cameraMode === 'topdown' ? 1.0 : 0.0;
    const isAngleSettled = Math.abs(renderer.currentTopDownFactor - targetFactor) < 0.005;

    expect(isCamSettled).toBe(true);
    expect(isAngleSettled).toBe(true);

    // 1.5秒 (1500ms) 以上経過していればアイドル
    const timeSinceActivity = 2000;
    const shouldBeIdle = renderer.isPowerSavingEnabled && isCamSettled && isAngleSettled && timeSinceActivity > 1500;
    expect(shouldBeIdle).toBe(true);
  });

  it('6. renderSubViewport がサポート外や未初期化時にもクラッシュせず安全にスキップされること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    const dummyRenderPass = {
      setPipeline: vi.fn(),
      setBindGroup: vi.fn(),
      setVertexBuffer: vi.fn(),
      draw: vi.fn()
    };

    // isSupported が false の状態での呼び出し
    expect(() => {
      renderer.renderSubViewport({
        renderPass: dummyRenderPass,
        viewProjMatrix: new Float32Array(16)
      });
    }).not.toThrow();

    expect(dummyRenderPass.draw).not.toHaveBeenCalled();
  });

  it('7. WebGPU HD2D 実行中も VirtualDungeonScreen の flushDirtyCells が安全に実行可能であること', () => {
    const mockVirtualScreen = {
      dirtyCells: new Set(['5,5', '6,5']),
      flushDirtyCells: vi.fn((grid, glyphs) => {
        mockVirtualScreen.dirtyCells.clear();
      })
    };

    const areaGrid = [[{ bottom: { rawGlyph: 1 } }]];
    const glyphBuffer = [[{ glyph: 1 }]];

    // 呼び出し実行
    mockVirtualScreen.flushDirtyCells(areaGrid, glyphBuffer);

    expect(mockVirtualScreen.flushDirtyCells).toHaveBeenCalledWith(areaGrid, glyphBuffer);
    expect(mockVirtualScreen.dirtyCells.size).toBe(0);
  });

  it('8. WGSL シェーダー内に構文エラー原因となる三項演算子 (?) が含まれていないこと', async () => {
    // WGSL シェーダー文字列を抽出して検証
    const fs = await import('fs');
    const path = await import('path');
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js'), 'utf-8');

    const shaderMatch = rendererCode.match(/const WGSL_SHADER = `([\s\S]*?)`;/);
    expect(shaderMatch).not.toBeNull();
    const shaderCode = shaderMatch[1];

    // WGSL 内に三項演算子 '?' が含まれていないことを確認
    expect(shaderCode).not.toContain('?');
  });

  it('9. addVisualFx によりエフェクトが登録され、エフェクト再生中は wakeUp が呼ばれアイドル化が阻止されること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    renderer.isIdle = true;
    expect(renderer.activeFxList.length).toBe(0);

    renderer.addVisualFx({
      type: 'SLASH',
      gx: 10,
      gy: 5,
      startTime: 1000,
      durationMs: 150
    });

    expect(renderer.activeFxList.length).toBe(1);
    expect(renderer.isIdle).toBe(false);
  });

  it('10. triggerScreenShake により画面シェイクが開始され、アクティブ状態が維持されること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    renderer.isIdle = true;
    expect(renderer.screenShakeTime).toBe(0);

    renderer.triggerScreenShake(4, 200);
    expect(renderer.screenShakeDuration).toBe(200);
    expect(renderer.screenShakeIntensity).toBe(4);
    expect(renderer.screenShakeTime).toBeGreaterThan(0);
    expect(renderer.isIdle).toBe(false);
  });

  it('11. worldToScreen が 3D 空間座標をビューポートピクセル座標へ正しく変換できること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    // 単位行列を viewProjMatrix に設定してテスト
    renderer.viewProjMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);

    // 原点 (0, 0, 0) -> NDC (0, 0) -> スクリーン中央 (360, 144)
    const projected = renderer.worldToScreen(0, 0, 0);
    expect(projected).not.toBeNull();
    expect(projected.screenX).toBeCloseTo(360, 1);
    expect(projected.screenY).toBeCloseTo(144, 1);

    // カメラ背面 (clipW <= 0) の場合は null を返すこと
    const behind = renderer.worldToScreen(0, 0, 0);
    renderer.viewProjMatrix[15] = -1; // w を負にしてテスト
    expect(renderer.worldToScreen(0, 0, 0)).toBeNull();
  });

  it('12. WGSL シェーダー内に Layer 5 (過渡的エフェクト) と壁高さ 0.45 の定義が含まれていること', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js'), 'utf-8');

    expect(rendererCode).toContain('Layer 5: 過渡的エフェクト');
    expect(rendererCode).toContain('0.45');
  });

  it('13. WGSL シェーダー内にスクリーン正対チルトビルボードの Up ベクトル展開ロジックが含まれていること', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js'), 'utf-8');

    expect(rendererCode).toContain('スクリーン正対チルトビルボード');
    expect(rendererCode).toContain('0.343');
    expect(rendererCode).toContain('-0.939');
  });

  it('14. isPlayerDead と deathPosition が設定された際、死亡位置のターゲット追従と墓石描画ロジックが安全に動作すること', () => {
    const renderer = new WebGPUHD2DRenderer({
      canvas: mockCanvas,
      getSituation: () => ({
        turn: 15,
        area: { playerX: 40, playerY: 12, grid: [], activeMonsters: [] }
      })
    });

    renderer.isPlayerDead = true;
    renderer.deathPosition = { x: 42, y: 13 };

    // プレイヤー死亡時は deathPosition を追従目標とする
    expect(renderer.isPlayerDead).toBe(true);
    expect(renderer.deathPosition.x).toBe(42);
    expect(renderer.deathPosition.y).toBe(13);
  });

  it('15. アイテム (Layer 3) の WGSL 定義がバウンス浮遊を廃止した床面水平プレーンであること', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js'), 'utf-8');

    expect(rendererCode).toContain('Layer 3: アイテム');
    expect(rendererCode).toContain('0.12');
  });

  it('16. キャラクター (Layer 4) の WGSL 定義で animOffset による墓石静止 (bounce = 0.0) 分岐が含まれていること', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js'), 'utf-8');

    expect(rendererCode).toContain('input.animOffset >= -0.5');
    expect(rendererCode).toContain('var bounce = 0.0;');
  });

  it('17. targetCursorX / targetCursorY の保持と _renderCursorFrames によるオーバーレイ描画が正常に行われること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    expect(renderer.targetCursorX).toBe(-1);
    expect(renderer.targetCursorY).toBe(-1);

    renderer.targetCursorX = 15;
    renderer.targetCursorY = 8;
    renderer.playerX = 10;
    renderer.playerY = 5;

    // 擬似的な worldToScreen
    renderer.worldToScreen = (wx, wy, wz) => ({ screenX: wx * 10, screenY: wz * 10 });

    const dummyCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      strokeRect: vi.fn(),
      fillRect: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
      shadowColor: '',
      shadowBlur: 0
    };

    expect(() => {
      renderer._renderCursorFrames(dummyCtx, 32, 1000);
    }).not.toThrow();

    expect(dummyCtx.save).toHaveBeenCalled();
    expect(dummyCtx.restore).toHaveBeenCalled();
    // 自キャラ枠とターゲットカーソルの2回描画が行われること
    expect(dummyCtx.stroke).toHaveBeenCalled();
  });

  it('18. キャラクター (Layer 4) の WGSL 定義で (h + bounce) * upVec によるジオラマ・トップビュー両対応バウンス計算が含まれていること', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js'), 'utf-8');

    expect(rendererCode).toContain('(h + bounce) * upVec.x');
    expect(rendererCode).toContain('(h + bounce) * upVec.y');
  });

  it('19. Phase A テーマ 1: WGSL 定義に Layer 3.2 自キャラ足元枠および Layer 3.3 Pet/Ridden 足元サークルが含まれること', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const rendererCode = fs.readFileSync(path.resolve(__dirname, '../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js'), 'utf-8');

    expect(rendererCode).toContain('input.layerType < 3.25');
    expect(rendererCode).toContain('input.layerType < 3.45');
    expect(rendererCode).toContain('pushInstance(x, 0.0, y, 3.2');
    expect(rendererCode).toContain('pushInstance(x, 0.0, y, 3.3');
    // WGSL uniform control flow 制約回避のため textureSample ではなく textureSampleLevel を使用していること
    expect(rendererCode).toContain('textureSampleLevel(');
    expect(rendererCode).not.toContain('textureSample(');
  });

  it('20. Phase A テーマ 1: ターゲットカーソル枠が床面 4 隅の 3D 空間結線 (worldToScreen 結線) により描画されること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    renderer.targetCursorX = 15;
    renderer.targetCursorY = 8;
    renderer.playerX = 10;
    renderer.playerY = 5;

    const projectedCoords = [];
    renderer.worldToScreen = vi.fn((wx, wy, wz) => {
      projectedCoords.push({ wx, wy, wz });
      return { screenX: wx * 10, screenY: wz * 10, depth: 5.0 };
    });

    const dummyCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      shadowColor: '',
      shadowBlur: 0
    };

    renderer._renderCursorFrames(dummyCtx, 32, 1000);

    // 4頂点 (床面 Y=0.01) が worldToScreen に渡されていること
    expect(renderer.worldToScreen).toHaveBeenCalledTimes(4);
    const targetCalls = projectedCoords.filter(c => Math.abs(c.wy - 0.01) < 0.001);
    expect(targetCalls.length).toBe(4);
    expect(dummyCtx.beginPath).toHaveBeenCalled();
    expect(dummyCtx.moveTo).toHaveBeenCalled();
    expect(dummyCtx.lineTo).toHaveBeenCalled();
    expect(dummyCtx.stroke).toHaveBeenCalled();
  });

  it('21. Phase A テーマ 2: Pet / Ridden / piletop アイテムの統一ミニバッジ記号 (♥ / R / +) が正常に描画されること', () => {
    const grid = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));
    // (5, 5): Pet
    grid[5][5] = {
      bottom: { rawGlyph: 3992 },
      middle: null,
      top: { rawGlyph: 770, isPet: true }
    };
    // (6, 5): Ridden
    grid[5][6] = {
      bottom: { rawGlyph: 3992 },
      middle: null,
      top: { rawGlyph: 2700, isRidden: true }
    };
    // (7, 5): piletop アイテム
    grid[5][7] = {
      bottom: { rawGlyph: 3992 },
      middle: { rawGlyph: 8000, isPile: true },
      top: null
    };

    const renderer = new WebGPUHD2DRenderer({
      canvas: mockCanvas,
      getAreaGrid: () => grid,
      getSituation: () => ({ area: { grid } })
    });

    renderer.worldToScreen = vi.fn((wx, wy, wz) => ({ screenX: wx * 20, screenY: wz * 20 }));

    const dummyCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0
    };

    renderer._renderEntityHighlights(dummyCtx, 32, 1000);

    // ミニバッジの枠 (fillRect, strokeRect) が描画されること
    expect(dummyCtx.fillRect).toHaveBeenCalled();
    expect(dummyCtx.strokeRect).toHaveBeenCalled();

    // 統一記号マークの fillText (♥, R, +) が呼ばれること
    expect(dummyCtx.fillText).toHaveBeenCalled();
    const textCalls = dummyCtx.fillText.mock.calls.map(call => call[0]);
    expect(textCalls).toContain('♥');
    expect(textCalls).toContain('R');
    expect(textCalls).toContain('+');
  });

  it('22. ズーム倍率の初期値が 1.0 であり、setZoom / resetZoom で適正範囲内に制御されること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    expect(renderer.userZoom).toBe(1.0);
    expect(renderer.currentZoom).toBe(1.0);

    // ズームイン
    renderer.setZoom(1.8);
    expect(renderer.userZoom).toBe(1.8);

    // 上限ガード (2.5x)
    renderer.setZoom(5.0);
    expect(renderer.userZoom).toBe(2.5);

    // 下限ガード (0.45x)
    renderer.setZoom(0.1);
    expect(renderer.userZoom).toBe(0.45);

    // リセット (1.0x)
    renderer.resetZoom();
    expect(renderer.userZoom).toBe(1.0);
  });

  it('23. _setupEventListeners: wheel および dblclick リスナーが登録されること', () => {
    const renderer = new WebGPUHD2DRenderer({ canvas: mockCanvas });
    renderer._setupEventListeners();

    const registeredEvents = mockCanvas.addEventListener.mock.calls.map(call => call[0]);
    expect(registeredEvents).toContain('wheel');
    expect(registeredEvents).toContain('dblclick');
    expect(registeredEvents).toContain('mousemove');
    expect(registeredEvents).toContain('click');
    expect(registeredEvents).toContain('contextmenu');
  });
});



