import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VirtualDungeonScreen } from '../../examples/gkl-pure-js-client/modules/renderers/VirtualDungeonScreen.js';
import { ZoomRenderer } from '../../examples/gkl-pure-js-client/modules/renderers/ZoomRenderer.js';
import { AreaStateManager } from '../../src/core/knowledge/state/AreaStateManager.js';

describe('VirtualDungeonScreen - 仮想スクリーン統合レンダラー Phase 1', () => {
  let mockCtx;
  let mockCanvas;

  beforeEach(() => {
    mockCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn()
    };

    mockCanvas = {
      width: 2560,
      height: 768,
      getContext: vi.fn(() => mockCtx)
    };

    globalThis.document = {
      createElement: vi.fn((tag) => {
        if (tag === 'canvas') return mockCanvas;
        return { classList: { add: vi.fn(), remove: vi.fn() } };
      })
    };
  });

  it('1. 初期化時に 80x24 マス x 32px (2560x768px) のオフスクリーン Canvas を保持すること', () => {
    const vScreen = new VirtualDungeonScreen();
    expect(vScreen.cols).toBe(80);
    expect(vScreen.rows).toBe(24);
    expect(vScreen.tileSize).toBe(32);
    expect(vScreen.width).toBe(2560);
    expect(vScreen.height).toBe(768);
    expect(vScreen.dirtyCells.size).toBe(0);
  });

  it('2. markDirty と markAllDirty で差分セルが正しく追跡されること', () => {
    const vScreen = new VirtualDungeonScreen();
    vScreen.markDirty(10, 5);
    vScreen.markDirty(10, 5); // 重複追加
    vScreen.markDirty(99, 99); // 範囲外

    expect(vScreen.dirtyCells.size).toBe(1);
    expect(vScreen.dirtyCells.has('10,5')).toBe(true);

    vScreen.markAllDirty();
    expect(vScreen.dirtyCells.size).toBe(80 * 24);
  });

  it('3. clearScreen を呼んだとき背景 Canvas がクリアされ、全マスが dirty になること', () => {
    const vScreen = new VirtualDungeonScreen();
    vScreen.clearScreen();

    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 2560, 768);
    expect(vScreen.dirtyCells.size).toBe(80 * 24);
  });

  it('4. flushDirtyCells で dirtyCells のセルのみが再描画され、完了後にクリアされること', () => {
    const vScreen = new VirtualDungeonScreen();
    vScreen.tileLoaded = true;
    vScreen.tileImg = { width: 1280, naturalWidth: 1280 };

    const areaGrid = Array.from({ length: 24 }, (_, y) =>
      Array.from({ length: 80 }, (_, x) => ({
        bottom: { rawGlyph: 3992 },
        middle: null,
        top: null
      }))
    );

    vScreen.markDirty(5, 5);
    vScreen.markDirty(6, 6);

    const count = vScreen.flushDirtyCells(areaGrid);
    expect(count).toBe(2);
    expect(vScreen.dirtyCells.size).toBe(0);
    expect(mockCtx.fillRect).toHaveBeenCalledWith(5 * 32, 5 * 32, 32, 32);
    expect(mockCtx.fillRect).toHaveBeenCalledWith(6 * 32, 6 * 32, 32, 32);
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(2);

    // 差分がない待機時は再描画コスト 0
    const idleCount = vScreen.flushDirtyCells(areaGrid);
    expect(idleCount).toBe(0);
  });

  it('5. AreaStateManager の updateGlyph で地形・アイテムが変化した際に dirtyCells が記録されること', () => {
    const asm = new AreaStateManager(80, 24);
    asm.clearDirtyCells();
    expect(asm.getDirtyCells().size).toBe(0);

    // 地形グリフ (TERRAIN)
    asm.updateGlyph(12, 8, 3992);
    expect(asm.getDirtyCells().has('12,8')).toBe(true);

    // resetGrid で全マス dirty 化
    asm.resetGrid();
    expect(asm.getDirtyCells().size).toBe(80 * 24);
  });

  it('6. ZoomRenderer が VirtualDungeonScreen から自キャラ周辺を 1 回の drawImage で高速切り出し転送すること', () => {
    const vScreen = new VirtualDungeonScreen();
    vScreen.tileLoaded = true;

    const zoomCtx = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      strokeRect: vi.fn()
    };

    const zoomCanvas = {
      width: 672,
      height: 288,
      getContext: vi.fn(() => zoomCtx)
    };

    const zoomRenderer = new ZoomRenderer({
      zoomCanvas,
      virtualScreen: vScreen,
      getSituation: () => ({ area: { playerX: 20, playerY: 10, grid: [] } }),
      getCore: () => ({
        gkl: {
          areaStateManager: new AreaStateManager(80, 24),
          getFocusCameraTiles: () => []
        }
      })
    });

    zoomRenderer.renderZoomCanvas({ playerX: 20, playerY: 10 });

    // 背景オフスクリーン Canvas から zoomCtx への切り出し drawImage が呼ばれたこと
    expect(zoomCtx.drawImage).toHaveBeenCalledWith(
      vScreen.bgCanvas,
      (20 - 10) * 32, (10 - 4) * 32, 21 * 32, 9 * 32,
      0, 0, 21 * 32, 9 * 32
    );
  });
});
