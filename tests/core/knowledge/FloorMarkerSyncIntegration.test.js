import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AreaStateManager } from '../../../src/core/knowledge/state/AreaStateManager.js';
import { GKLPlugin } from '../../../src/core/knowledge/GKLPlugin.js';
import { MinimapHudRenderer } from '../../../examples/gkl-pure-js-client/modules/renderers/MinimapHudRenderer.js';
import { MapRenderer } from '../../../examples/gkl-pure-js-client/modules/renderers/MapRenderer.js';
import { MainViewportRenderer } from '../../../examples/gkl-pure-js-client/modules/renderers/MainViewportRenderer.js';
import { FloorMarkerService } from '../../../src/core/knowledge/services/FloorMarkerService.js';
import { WebGPUHD2DRenderer } from '../../../examples/gkl-pure-js-client/modules/renderers/WebGPUHD2DRenderer.js';

describe('FloorMarkerSyncIntegration - フロア遷移・セーブ復元・注釈メッセージ自動同期検証', () => {
  let gkl;
  let mockCore;
  let coreListeners;

  beforeEach(() => {
    coreListeners = new Map();
    mockCore = {
      language: 'ja',
      plugins: [],
      on: vi.fn((event, handler) => {
        if (!coreListeners.has(event)) {
          coreListeners.set(event, []);
        }
        coreListeners.get(event).push(handler);
      }),
      emit: vi.fn((event, data) => {
        const handlers = coreListeners.get(event) || [];
        handlers.forEach(h => h(data));
      }),
      driver: {
        callShim: vi.fn(async () => []),
        on: vi.fn()
      },
      interactiveController: {
        executeSequence: vi.fn(async () => true)
      }
    };

    gkl = new GKLPlugin();
    gkl.attach(mockCore);
  });

  it('1. AreaStateManager.updateFloor() での新フロア確定時に syncDungeonOverviewOnDemand が自動発火すること', async () => {
    const syncSpy = vi.spyOn(gkl, 'syncDungeonOverviewOnDemand').mockResolvedValue([]);

    // 初期フロアは Dlvl:1
    expect(gkl.areaStateManager.currentFloor).toBe('Dlvl:1');

    // 同一フロアへの updateFloor では発火しないこと
    const changedSame = gkl.areaStateManager.updateFloor('Dlvl:1');
    expect(changedSame).toBe(false);
    expect(syncSpy).not.toHaveBeenCalled();

    // 新フロア "Dlvl:2" への updateFloor
    const changed = gkl.areaStateManager.updateFloor('Dlvl:2');
    expect(changed).toBe(true);
    expect(gkl.areaStateManager.currentFloor).toBe('Dlvl:2');
    expect(syncSpy).toHaveBeenCalledTimes(1);

    // プレイヤーサマリーオブジェクト形式での updateFloor
    const summaryChanged = gkl.areaStateManager.updateFloor({
      dnum: 0,
      dlevel: 3,
      branchId: 'dungeon',
      floorKey: 'Dlvl:3'
    });
    expect(summaryChanged).toBe(true);
    expect(gkl.areaStateManager.currentFloor).toBe('Dlvl:3');
    expect(syncSpy).toHaveBeenCalledTimes(2);
  });

  it('2. セーブデータ復元完了時 (restore / game_restored) に自動的に syncDungeonOverviewOnDemand が発火すること', async () => {
    const syncSpy = vi.spyOn(gkl, 'syncDungeonOverviewOnDemand').mockResolvedValue([]);

    // restore イベント発火
    mockCore.emit('restore', {});
    expect(syncSpy).toHaveBeenCalledTimes(1);

    // game_restored イベント発火
    mockCore.emit('game_restored', {});
    expect(syncSpy).toHaveBeenCalledTimes(2);
  });

  it('3. メッセージ「You remember this level as ...」受信時に自動的に syncDungeonOverviewOnDemand が発火すること', async () => {
    const syncSpy = vi.spyOn(gkl, 'syncDungeonOverviewOnDemand').mockResolvedValue([]);

    // 無関係なメッセージでは発火しないこと
    mockCore.emit('messageText', { text: 'You hit the goblin.' });
    expect(syncSpy).not.toHaveBeenCalled();

    // 階層注釈メッセージを受信
    mockCore.emit('messageText', { text: 'You remember this level as Main Base !M:154C.' });
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('4. dungeonOverviewUpdated イベント発火時に Minimap, MapRenderer, MainViewport, WebGPU が即時反映されること', () => {
    // A. MinimapHudRenderer
    const mockMinimap = new MinimapHudRenderer({
      getCore: () => mockCore
    });
    const minimapSpy = vi.spyOn(mockMinimap, 'renderMinimap');

    // B. MapRenderer
    const mockMapRenderer = new MapRenderer({
      getCore: () => mockCore
    });
    const mapRedrawSpy = vi.spyOn(mockMapRenderer, 'redrawAllGraphicTiles');

    // C. MainViewportRenderer
    const mockViewport = new MainViewportRenderer({
      getCore: () => mockCore
    });
    const viewportSpy = vi.spyOn(mockViewport, 'render');

    // D. WebGPUHD2DRenderer
    const mockWebGpu = new WebGPUHD2DRenderer({
      getCore: () => mockCore
    });
    const webgpuDirtySpy = vi.spyOn(mockWebGpu, 'markDirty');
    const webgpuWakeSpy = vi.spyOn(mockWebGpu, 'wakeUp');

    // dungeonOverviewUpdated イベントを発行
    mockCore.emit('dungeonOverviewUpdated', [{ floorKey: 'Dlvl:1', annotation: '!M:154C' }]);

    // 全てのレンダラーで即時再描画・更新が発火したこと
    expect(minimapSpy).toHaveBeenCalled();
    expect(mapRedrawSpy).toHaveBeenCalled();
    expect(viewportSpy).toHaveBeenCalled();
    expect(webgpuDirtySpy).toHaveBeenCalled();
    expect(webgpuWakeSpy).toHaveBeenCalled();
  });

  it('5. カスタムタグのアイコン設定（例: 💎）が FloorMarkerService 経由で各レンダラーに即時反映されること', () => {
    const markerService = FloorMarkerService.getInstance();
    markerService.saveCustomSlot(6, {
      icon: '💎',
      labelEn: 'Diamond Stash',
      labelJa: 'ダイヤ保管場所'
    });

    const mockViewport = new MainViewportRenderer({
      getCore: () => mockCore
    });
    const defViewport = mockViewport.floorMarkerService.getSlotDefinition(6);
    expect(defViewport.icon).toBe('💎');
    expect(defViewport.labelJa).toBe('ダイヤ保管場所');

    const mockMinimap = new MinimapHudRenderer({
      getCore: () => mockCore
    });
    const defMinimap = mockMinimap.floorMarkerService.getSlotDefinition(6);
    expect(defMinimap.icon).toBe('💎');

    const mockWebGpu = new WebGPUHD2DRenderer({
      getCore: () => mockCore
    });
    const defFx = mockWebGpu.fxOverlay.floorMarkerService.getSlotDefinition(6);
    expect(defFx.icon).toBe('💎');
  });
});