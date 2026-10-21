import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MainViewportRenderer } from '../../examples/gkl-pure-js-client/modules/renderers/MainViewportRenderer.js';
import { VirtualDungeonScreen } from '../../examples/gkl-pure-js-client/modules/renderers/VirtualDungeonScreen.js';

describe('MainViewportRenderer - 自キャラ追従迫力メインビューポート Phase 2', () => {
  let mockCtx;
  let mockCanvas;
  let mockAsciiGrid;
  let vScreen;

  beforeEach(() => {
    mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      shadowColor: '',
      shadowBlur: 0,
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fillText: vi.fn(),
      fill: vi.fn()
    };

    mockCanvas = {
      width: 720,
      height: 288,
      getContext: vi.fn(() => mockCtx),
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() }
    };

    mockAsciiGrid = {
      innerHTML: '',
      appendChild: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() }
    };

    globalThis.document = {
      createElement: vi.fn((tag) => {
        if (tag === 'canvas') return mockCanvas;
        return {
          id: '',
          className: '',
          textContent: '',
          classList: { add: vi.fn(), remove: vi.fn() },
          appendChild: vi.fn()
        };
      }),
      getElementById: vi.fn(() => null)
    };

    vScreen = new VirtualDungeonScreen();
    vScreen.tileLoaded = true;
  });

  it('1. 初期化時に 32px 原寸タイルサイズおよびカメラ座標が設定されること', () => {
    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen
    });

    expect(renderer.tileSize).toBe(32);
    expect(renderer.isGraphicCanvasMode).toBe(true);
    expect(renderer.camX).toBe(40);
    expect(renderer.camY).toBe(12);
  });

  it('2. プレイヤー位置に合わせてカメラが即時追従し、背景 Canvas から高速切り出し転送すること', () => {
    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => []
    });

    // 初回描画でカメラがプレイヤー (25, 10) に設定される
    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: [] });
    expect(renderer.camX).toBe(25);
    expect(renderer.camY).toBe(10);

    // 1 回の drawImage で仮想スクリーンの bgCanvas から切り出されること
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    const firstCallArgs = mockCtx.drawImage.mock.calls[0];
    expect(firstCallArgs[0]).toBe(vScreen.bgCanvas);

    // プレイヤーが移動 (30, 12) した場合、デフォルトの即時追従でピタッと一致
    renderer.renderMainViewport({ playerX: 30, playerY: 12, grid: [] });
    expect(renderer.camX).toBe(30);
    expect(renderer.camY).toBe(12);

    // smoothScroll が true の場合は Lerp で滑らかに移動
    renderer.smoothScroll = true;
    renderer.camX = 20;
    renderer.renderMainViewport({ playerX: 30, playerY: 12, grid: [] });
    expect(renderer.camX).toBeGreaterThan(20);
    expect(renderer.camX).toBeLessThan(30);
  });

  it('3. 視界内のモンスター (Top レイヤー) をバウンス付きで描画すること', () => {
    const areaGrid = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));
    // プレイヤー周辺にモンスターを配置
    areaGrid[10][26] = {
      bottom: { rawGlyph: 3992 },
      middle: null,
      top: { rawGlyph: 120 } // モンスター
    };

    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => areaGrid
    });

    // タイル画像をモック
    vScreen.tileImg = { width: 1280, naturalWidth: 1280 };
    vScreen.tileLoaded = true;

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid });

    // 背景切り出し drawImage (1回) + モンスターの描画 drawImage (1回)
    expect(mockCtx.drawImage).toHaveBeenCalled();
  });

  it('4. ターゲットカーソル枠および自キャラ枠を描画すること', () => {
    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => []
    });

    renderer.targetCursorX = 27;
    renderer.targetCursorY = 10;

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: [] });

    // strokeRect が呼ばれること (自キャラ枠とターゲットカーソル枠)
    expect(mockCtx.strokeRect).toHaveBeenCalled();
  });

  it('5. 画面振動 (Screen Shake) が発生した際に ctx.translate でオフセットされること', () => {
    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => []
    });

    renderer.triggerScreenShake(5, 200);
    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: [] });

    expect(mockCtx.translate).toHaveBeenCalled();
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('6. Visual FX (SLASH, DAMAGE_FLASH など) が最前面に描画されること', () => {
    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => []
    });

    renderer.addVisualFx({
      type: 'SLASH',
      gx: 26,
      gy: 10,
      startTime: performance.now(),
      durationMs: 200
    });

    renderer.addVisualFx({
      type: 'DAMAGE_FLASH',
      gx: 25,
      gy: 10,
      followPlayer: true,
      startTime: performance.now(),
      durationMs: 200
    });

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: [] });

    expect(renderer.activeFxList.length).toBe(2);
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });

  it('7. switchViewMode で ASCII モードと Graphic モードを正しく切り替えられること', () => {
    const btnToggleView = { textContent: '' };
    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      btnToggleView,
      virtualScreen: vScreen
    });

    renderer.switchViewMode(false);
    expect(renderer.isGraphicCanvasMode).toBe(false);
    expect(mockCanvas.classList.add).toHaveBeenCalledWith('hidden');
    expect(mockAsciiGrid.classList.remove).toHaveBeenCalledWith('hidden');

    renderer.switchViewMode(true);
    expect(renderer.isGraphicCanvasMode).toBe(true);
    expect(mockCanvas.classList.remove).toHaveBeenCalledWith('hidden');
    expect(mockAsciiGrid.classList.add).toHaveBeenCalledWith('hidden');
  });

  it('8. Phase A テーマ 1: 自キャラ枠ハイライトが cell.middle 直後、cell.top の前に描画されること (Middle プライオリティ)', () => {
    const areaGrid = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));
    // 自キャラ位置 (25, 10) に middle (アイテム) と top (プレイヤー) を配置
    areaGrid[10][25] = {
      bottom: { rawGlyph: 3992 },
      middle: { rawGlyph: 3450 },
      top: { rawGlyph: 100, isPlayer: true }
    };

    const callOrder = [];
    mockCtx.strokeRect = vi.fn((x, y, w, h) => {
      callOrder.push('strokeRect');
    });

    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => areaGrid
    });

    renderer.drawTile = vi.fn((glyphId, cols, tileMap, sx, sy, by) => {
      callOrder.push(`drawTile:${glyphId}`);
    });

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid });

    // 自キャラ枠 (strokeRect) が cell.top (100) の drawTile よりも前に呼ばれていること
    const frameIndex = callOrder.indexOf('strokeRect');
    const playerTileIndex = callOrder.indexOf('drawTile:100');
    expect(frameIndex).toBeGreaterThan(-1);
    expect(playerTileIndex).toBeGreaterThan(-1);
    expect(frameIndex).toBeLessThan(playerTileIndex);
  });

  it('9. Phase A テーマ 2: Pet / Ridden / piletop の視覚的強調マークが描画されること', () => {
    const areaGrid = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));
    // (25, 10): プレイヤー
    areaGrid[10][25] = { bottom: { rawGlyph: 3992 }, middle: null, top: { rawGlyph: 100, isPlayer: true } };
    // (26, 10): Pet
    areaGrid[10][26] = { bottom: { rawGlyph: 3992 }, middle: null, top: { rawGlyph: 770, isPet: true } };
    // (27, 10): Ridden
    areaGrid[10][27] = { bottom: { rawGlyph: 3992 }, middle: null, top: { rawGlyph: 2700, isRidden: true } };
    // (28, 10): piletop
    areaGrid[10][28] = { bottom: { rawGlyph: 3992 }, middle: { rawGlyph: 8000, isPile: true }, top: null };

    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => areaGrid
    });

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid });

    // Pet / Ridden 用の足元サークル (ellipse または arc) が呼ばれること
    expect(mockCtx.ellipse).toHaveBeenCalled();

    // Pet (♥), Ridden (R), piletop (+) のバッジ描画 (fillText) が呼ばれること
    expect(mockCtx.fillText).toHaveBeenCalled();
    const renderedTexts = mockCtx.fillText.mock.calls.map(c => c[0]);
    expect(renderedTexts).toContain('♥');
    expect(renderedTexts).toContain('R');
    expect(renderedTexts).toContain('+');
  });

  it('10. マップ上の ContextActions バッジ ＆ 掘削アシスト枠がオーバーレイ描画されること', () => {
    const areaGrid = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));
    // プレイヤー (25, 10)
    areaGrid[10][25] = { bottom: { rawGlyph: 3992 }, middle: null, top: { rawGlyph: 100, isPlayer: true } };
    // 東隣 (26, 10): 観測済み岩盤
    areaGrid[10][26] = { bottom: { rawGlyph: 3929, isObservedStone: true, type: 'UNEXPLORED' }, middle: null, top: null };

    const actions = [
      { id: 'ACTION_APPLY_DIG', dirCode: 'E', category: 'SURVIVAL', labelJa: '東の岩盤を掘る' },
      { id: 'ACTION_WAIT', dirCode: 'SELF', isDefault: true, category: 'DEFAULT', labelJa: '待機' } // デフォルトは除外されるべき
    ];

    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => areaGrid
    });

    renderer.drawTile = vi.fn();

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid }, actions);

    // 固有アクション（掘削）が存在する東隣セルにバッジテキスト '1' が描画されること
    expect(mockCtx.fillText).toHaveBeenCalled();
    const renderedTexts = mockCtx.fillText.mock.calls.map(c => c[0]);
    expect(renderedTexts).toContain('1');

    // 掘削ハイライトによる drawTile(3929) が呼ばれていること
    expect(renderer.drawTile).toHaveBeenCalledWith(3929, expect.any(Number), expect.anything(), expect.any(Number), expect.any(Number), 0);

    // mapActionIndicator を false にするとバッジ描画がスキップされること
    mockCtx.fillText.mockClear();
    renderer.setMapActionIndicator(false);
    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid }, actions);
    const textsAfterDisable = mockCtx.fillText.mock.calls.map(c => c[0]);
    expect(textsAfterDisable).not.toContain('1');
  });

  it('11. smart モードでは掘削アクションがない時に岩盤が描画されず（黒抜き）、classic_tile モードでは常時描画されること', () => {
    const areaGrid = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));
    // プレイヤー (25, 10)
    areaGrid[10][25] = { bottom: { rawGlyph: 3992 }, middle: null, top: { rawGlyph: 100, isPlayer: true } };
    // 東隣 (26, 10): 観測済み岩盤
    areaGrid[10][26] = { bottom: { rawGlyph: 3929, isObservedStone: true, type: 'UNEXPLORED' }, middle: null, top: null };

    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => areaGrid
    });

    renderer.drawTile = vi.fn();

    // 1. smart モード（デフォルト）かつ掘削アクションなし（待機アクションのみ）
    const normalActions = [
      { id: 'ACTION_WAIT', dirCode: 'SELF', isDefault: true, category: 'DEFAULT', labelJa: '待機' }
    ];
    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid }, normalActions);

    // 掘削アクションがないため、岩盤タイル(3929)は描画されない（黒抜き維持）
    const stoneCallsInSmart = renderer.drawTile.mock.calls.filter(call => call[0] === 3929);
    expect(stoneCallsInSmart.length).toBe(0);

    // 2. classic_tile モードに切り替え
    renderer.drawTile.mockClear();
    renderer.setStoneRenderingMode('classic_tile');
    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid }, normalActions);

    // classic_tile では掘削アクションがなくても観測済み岩盤(3929)が常時描画されること
    const stoneCallsInClassic = renderer.drawTile.mock.calls.filter(call => call[0] === 3929);
    expect(stoneCallsInClassic.length).toBeGreaterThan(0);
  });

  it('12. classic_tile モードであっても、未到達のプリロード壁 (isCachedPreload: true) は絶対に岩盤として描画されないこと', () => {
    const areaGrid = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));
    // プレイヤー (25, 10)
    areaGrid[10][25] = { bottom: { rawGlyph: 3992 }, middle: null, top: { rawGlyph: 100, isPlayer: true } };

    // 観測済みの正規岩盤 (26, 10)
    areaGrid[10][26] = { bottom: { rawGlyph: 3929, isObservedStone: true, isCachedPreload: false, type: 'UNEXPLORED' }, middle: null, top: null };

    // 未到達の部屋の壁 (27, 10): Cコア初期値 3929、TERRAIN、プリロード下敷き (未観測)
    areaGrid[10][27] = { bottom: { rawGlyph: 3929, glyph: 3929, isCachedPreload: true, isObservedStone: false, type: 'TERRAIN' }, middle: null, top: null };

    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getAreaGrid: () => areaGrid
    });

    renderer.drawTile = vi.fn();
    renderer.setStoneRenderingMode('classic_tile');

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: areaGrid }, []);

    // 観測済みの (26, 10) のみ描画され、未到達の (27, 10) は絶対に描画されない
    const calls = renderer.drawTile.mock.calls.filter(call => call[0] === 3929);
    expect(calls.length).toBe(1); // 26,10 の1回のみ
  });

  it('13. 現在階層のフロアマーカーが実マップ（メインダンジョン画面）上の該当タイルにオーバーレイ描画されること', () => {
    const mockCore = {
      getCurrentFloorMarkers: vi.fn(() => [
        { type: 0, x: 25, y: 10 }, // 🚩 拠点 (プレイヤーと同じマス)
        { type: 2, x: 26, y: 10 }  // ⚠️ 危険マス (隣接マス)
      ])
    };

    const renderer = new MainViewportRenderer({
      canvas: mockCanvas,
      asciiGrid: mockAsciiGrid,
      virtualScreen: vScreen,
      getCore: () => mockCore,
      getAreaGrid: () => []
    });

    renderer.drawTile = vi.fn();
    mockCtx.fillText.mockClear();

    renderer.renderMainViewport({ playerX: 25, playerY: 10, grid: [] }, []);

    // core.getCurrentFloorMarkers が呼ばれたこと
    expect(mockCore.getCurrentFloorMarkers).toHaveBeenCalled();

    // fillText でマーカーアイコン (🚩, ⚠️) が描画されたこと
    const textCalls = mockCtx.fillText.mock.calls.map(c => c[0]);
    expect(textCalls).toContain('🚩');
    expect(textCalls).toContain('⚠️');
  });
});
