import { describe, it, expect, vi } from 'vitest';
import {
  CanvasInteractionController,
  getAdjacentDirectionCode
} from '../../examples/gkl-pure-js-client/modules/interaction/CanvasInteractionController.js';
import { FloatingContextActions } from '../../examples/gkl-pure-js-client/modules/components/FloatingContextActions.js';

describe('CanvasInteractionController - 周囲8方向直近クリック時の向き (Facing) 追従検証', () => {
  describe('getAdjacentDirectionCode ユーティリティ', () => {
    it('基本4方向 (N, S, E, W) のデルタ座標を正しく変換できること', () => {
      expect(getAdjacentDirectionCode(0, -1)).toBe('N');
      expect(getAdjacentDirectionCode(0, 1)).toBe('S');
      expect(getAdjacentDirectionCode(1, 0)).toBe('E');
      expect(getAdjacentDirectionCode(-1, 0)).toBe('W');
    });

    it('斜め4方向 (NE, NW, SE, SW) のデルタ座標を正しく変換できること', () => {
      expect(getAdjacentDirectionCode(1, -1)).toBe('NE');
      expect(getAdjacentDirectionCode(-1, -1)).toBe('NW');
      expect(getAdjacentDirectionCode(1, 1)).toBe('SE');
      expect(getAdjacentDirectionCode(-1, 1)).toBe('SW');
    });

    it('長距離のデルタ座標でも目標位置の角度から8方向に正しく量子化されること', () => {
      expect(getAdjacentDirectionCode(10, 0)).toBe('E');
      expect(getAdjacentDirectionCode(-8, 0)).toBe('W');
      expect(getAdjacentDirectionCode(0, -15)).toBe('N');
      expect(getAdjacentDirectionCode(0, 20)).toBe('S');
      expect(getAdjacentDirectionCode(10, 10)).toBe('SE');
      expect(getAdjacentDirectionCode(-10, -10)).toBe('NW');
      expect(getAdjacentDirectionCode(5, -10)).toBe('NE');
      expect(getAdjacentDirectionCode(2, -10)).toBe('N');
    });

    it('足元 (0, 0) の場合は null を返すこと', () => {
      expect(getAdjacentDirectionCode(0, 0)).toBeNull();
    });
  });

  describe('handleCanvasInspect でのクリック時向き同期', () => {
    function createMockClient(playerX = 10, playerY = 10) {
      return {
        core: {
          gkl: {
            inspectCellOnDemand: vi.fn().mockResolvedValue(null),
            getSituation: () => ({
              area: { playerX, playerY }
            }),
            getRecommendedActions: () => [],
            travelTo: vi.fn().mockResolvedValue(true)
          }
        },
        mainViewportRenderer: {
          targetCursorX: playerX,
          targetCursorY: playerY
        },
        floatingActions: {
          resolveApplicableActions: () => [],
          show: vi.fn(),
          hide: vi.fn()
        },
        floatingMessageHud: {
          notifyUserAction: vi.fn()
        },
        setFacingDirection: vi.fn(),
        lastKnowledgeTarget: null
      };
    }

    it('直近の東マス (11, 10) をクリックした時、setFacingDirection("E") が呼び出されること', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      await controller.handleCanvasInspect(11, 10, false);

      expect(client.setFacingDirection).toHaveBeenCalledWith('E');
      expect(client.core.gkl.travelTo).toHaveBeenCalledWith({ x: 11, y: 10 });
    });

    it('直近の北マス (10, 9) をクリックした時、setFacingDirection("N") が呼び出されること', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      await controller.handleCanvasInspect(10, 9, false);

      expect(client.setFacingDirection).toHaveBeenCalledWith('N');
      expect(client.core.gkl.travelTo).toHaveBeenCalledWith({ x: 10, y: 9 });
    });

    it('直近の北西マス (9, 9) をクリックした時、setFacingDirection("NW") が呼び出されること', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      await controller.handleCanvasInspect(9, 9, false);

      expect(client.setFacingDirection).toHaveBeenCalledWith('NW');
      expect(client.core.gkl.travelTo).toHaveBeenCalledWith({ x: 9, y: 9 });
    });

    it('長距離マス (15, 10) [東] をクリックした時、目標位置への方向 setFacingDirection("E") が呼び出され、travelTo が実行されること', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      await controller.handleCanvasInspect(15, 10, false);

      expect(client.setFacingDirection).toHaveBeenCalledWith('E');
      expect(client.core.gkl.travelTo).toHaveBeenCalledWith({ x: 15, y: 10 });
    });

    it('長距離斜めマス (20, 20) [南東] をクリックした時、setFacingDirection("SE") が呼び出されること', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      await controller.handleCanvasInspect(20, 20, false);

      expect(client.setFacingDirection).toHaveBeenCalledWith('SE');
      expect(client.core.gkl.travelTo).toHaveBeenCalledWith({ x: 20, y: 20 });
    });

    it('足元自キャラマス (10, 10) をクリックした時は、向きは更新されないこと', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      await controller.handleCanvasInspect(10, 10, false);

      expect(client.setFacingDirection).not.toHaveBeenCalled();
    });

    it('ホバー操作時 (isHover: true) には、setFacingDirection は呼び出されないこと', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      await controller.handleCanvasInspect(11, 10, true);

      expect(client.setFacingDirection).not.toHaveBeenCalled();
      expect(client.core.gkl.travelTo).not.toHaveBeenCalled();
    });

    it('Shift + クリック時: setFacingDirection("E") で向きのみ変更され、travelTo やメニュー展開は一切実行されないこと (安全制御)', async () => {
      const client = createMockClient(10, 10);
      const controller = new CanvasInteractionController(client);

      // 直近マスを Shift+クリック
      await controller.handleCanvasInspect(11, 10, false, { clientX: 100, clientY: 100, shiftKey: true });

      expect(client.setFacingDirection).toHaveBeenCalledWith('E');
      expect(client.core.gkl.travelTo).not.toHaveBeenCalled();
      expect(client.floatingActions.show).not.toHaveBeenCalled();

      // 長距離マスを Shift+クリック
      client.setFacingDirection.mockClear();
      await controller.handleCanvasInspect(10, 5, false, { clientX: 100, clientY: 50, shiftKey: true });

      expect(client.setFacingDirection).toHaveBeenCalledWith('N');
      expect(client.core.gkl.travelTo).not.toHaveBeenCalled();
      expect(client.floatingActions.show).not.toHaveBeenCalled();
    });
  });

  describe('FloatingContextActions での向き同期', () => {
    it('アクション実行時に dirCode を持つ場合、onFacingChange が呼び出されること', async () => {
      const onFacingChange = vi.fn();
      const mockCore = {
        executeAction: vi.fn().mockResolvedValue(true)
      };

      const mockEl = {
        classList: { add: vi.fn(), remove: vi.fn() },
        style: {}
      };

      const floating = new FloatingContextActions({
        container: mockEl,
        elPopup: mockEl,
        getCore: () => mockCore,
        onFacingChange
      });

      const action = {
        id: 'ACTION_OPEN_DOOR_E',
        dirCode: 'E',
        label: '扉を開ける'
      };

      await floating.executeContextAction(action);

      expect(onFacingChange).toHaveBeenCalledWith('E');
      expect(mockCore.executeAction).toHaveBeenCalledWith(action);
    });
  });
});
