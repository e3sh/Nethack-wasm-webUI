import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MinimapHudRenderer } from '../../examples/gkl-pure-js-client/modules/renderers/MinimapHudRenderer.js';
import { VirtualDungeonScreen } from '../../examples/gkl-pure-js-client/modules/renderers/VirtualDungeonScreen.js';

describe('MinimapHudRenderer - ミニマップ HUD ＆ [Tab] オーバーレイ Phase 2', () => {
  let mockCtx;
  let mockCanvas;
  let mockHudBox;
  let mockPosBadge;
  let mockToggleBtn;
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
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn()
    };

    mockCanvas = {
      width: 240,
      height: 72,
      getContext: vi.fn(() => mockCtx),
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn() }
    };

    mockHudBox = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
        toggle: vi.fn()
      },
      addEventListener: vi.fn()
    };

    mockPosBadge = { textContent: '' };
    mockToggleBtn = { textContent: '', title: '', addEventListener: vi.fn() };

    vScreen = new VirtualDungeonScreen();
    vScreen.tileLoaded = true;
  });

  it('1. 初期化時に通常解像度 (240x72) および初期状態が設定されること', () => {
    const minimap = new MinimapHudRenderer({
      minimapCanvas: mockCanvas,
      minimapHudBox: mockHudBox,
      minimapPosBadge: mockPosBadge,
      btnToggleMinimap: mockToggleBtn,
      virtualScreen: vScreen
    });

    expect(minimap.normalWidth).toBe(240);
    expect(minimap.normalHeight).toBe(72);
    expect(minimap.maximizedWidth).toBe(720);
    expect(minimap.maximizedHeight).toBe(216);
    expect(minimap.isMaximized).toBe(false);
    expect(minimap.isVisible).toBe(true);
  });

  it('2. renderMinimap で VirtualDungeonScreen.bgCanvas 全体を 1 回の drawImage で縮小転送すること', () => {
    const minimap = new MinimapHudRenderer({
      minimapCanvas: mockCanvas,
      minimapHudBox: mockHudBox,
      minimapPosBadge: mockPosBadge,
      btnToggleMinimap: mockToggleBtn,
      virtualScreen: vScreen
    });

    const situation = {
      area: { playerX: 35, playerY: 12 },
      landmarks: { all: [] }
    };

    minimap.renderMinimap(situation);

    // 背景クリア fillRect
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 240, 72);

    // 1 回の drawImage で bgCanvas 全体を (0, 0, 240, 72) へ縮小転送
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      vScreen.bgCanvas,
      0, 0, 2560, 768,
      0, 0, 240, 72
    );

    // 座標バッジが更新されること
    expect(mockPosBadge.textContent).toBe('@ (35,12)');
  });

  it('3. プレイヤー現在地の発光ドットとパルス円環が描画されること', () => {
    const minimap = new MinimapHudRenderer({
      minimapCanvas: mockCanvas,
      minimapHudBox: mockHudBox,
      minimapPosBadge: mockPosBadge,
      btnToggleMinimap: mockToggleBtn,
      virtualScreen: vScreen
    });

    const situation = {
      area: { playerX: 40, playerY: 12 },
      landmarks: { all: [] }
    };

    minimap.renderMinimap(situation);

    // arc による円弧描画 (パルス円環とコア)
    expect(mockCtx.arc).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('4. 階段・店舗・祭壇などのランドマークがピン留め描画されること', () => {
    const minimap = new MinimapHudRenderer({
      minimapCanvas: mockCanvas,
      minimapHudBox: mockHudBox,
      minimapPosBadge: mockPosBadge,
      btnToggleMinimap: mockToggleBtn,
      virtualScreen: vScreen
    });

    const situation = {
      area: { playerX: 10, playerY: 5 },
      landmarks: {
        all: [
          { type: 'STAIR_UP', x: 12, y: 5 },
          { type: 'STAIR_DOWN', x: 20, y: 8 },
          { type: 'ALTAR', x: 30, y: 15 },
          { type: 'SHOP', x: 45, y: 10 }
        ]
      }
    };

    minimap.renderMinimap(situation);

    // ランドマーク描画処理で各シンボルが描画されたこと
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('5. モンスター位置に赤ドットが描画されること', () => {
    const minimap = new MinimapHudRenderer({
      minimapCanvas: mockCanvas,
      minimapHudBox: mockHudBox,
      minimapPosBadge: mockPosBadge,
      btnToggleMinimap: mockToggleBtn,
      virtualScreen: vScreen
    });

    const situation = {
      area: {
        playerX: 10,
        playerY: 5,
        perceivedMonsters: [
          { x: 15, y: 6 },
          { x: 18, y: 7 }
        ]
      },
      landmarks: { all: [] }
    };

    minimap.renderMinimap(situation);

    expect(mockCtx.fillStyle).toBe('#00ff66'); // 最後のプレイヤー色または赤
    expect(mockCtx.arc).toHaveBeenCalled();
  });

  it('6. toggleMaximize で通常 ⇔ 最大化 (720x216) が切り替わり、クラスと解像度が更新されること', () => {
    const minimap = new MinimapHudRenderer({
      minimapCanvas: mockCanvas,
      minimapHudBox: mockHudBox,
      minimapPosBadge: mockPosBadge,
      btnToggleMinimap: mockToggleBtn,
      virtualScreen: vScreen,
      getSituation: () => ({ area: { playerX: 10, playerY: 10 }, landmarks: { all: [] } })
    });

    // 1回目: 最大化
    minimap.toggleMaximize();
    expect(minimap.isMaximized).toBe(true);
    expect(mockHudBox.classList.add).toHaveBeenCalledWith('maximized');
    expect(mockCanvas.width).toBe(720);
    expect(mockCanvas.height).toBe(216);

    // 2回目: 縮小
    minimap.toggleMaximize();
    expect(minimap.isMaximized).toBe(false);
    expect(mockHudBox.classList.remove).toHaveBeenCalledWith('maximized');
    expect(mockCanvas.width).toBe(240);
    expect(mockCanvas.height).toBe(72);
  });

  it('7. プレイヤーがダンジョン右端・右上に近づいた際にミニマップが自動退避 (dock-left) すること', () => {
    const classSet = new Set();
    const dynamicHudBox = {
      classList: {
        add: vi.fn((cls) => classSet.add(cls)),
        remove: vi.fn((cls) => classSet.delete(cls)),
        contains: vi.fn((cls) => classSet.has(cls))
      },
      addEventListener: vi.fn()
    };

    const minimap = new MinimapHudRenderer({
      minimapCanvas: mockCanvas,
      minimapHudBox: dynamicHudBox,
      minimapPosBadge: mockPosBadge,
      btnToggleMinimap: mockToggleBtn,
      virtualScreen: vScreen
    });

    // プレイヤーがダンジョン右端 (x: 75, y: 2) に接近
    minimap.renderMinimap({
      area: { playerX: 75, playerY: 2 },
      landmarks: { all: [] }
    });

    // dock-left クラスが付与され、左上へ退避すること
    expect(dynamicHudBox.classList.add).toHaveBeenCalledWith('dock-left');
    expect(classSet.has('dock-left')).toBe(true);

    // プレイヤーが中央 (x: 40, y: 12) に戻った場合、通常位置 (右上) に復帰すること
    minimap.renderMinimap({
      area: { playerX: 40, playerY: 12 },
      landmarks: { all: [] }
    });
    expect(dynamicHudBox.classList.remove).toHaveBeenCalledWith('dock-left');
    expect(classSet.has('dock-left')).toBe(false);
  });
});
