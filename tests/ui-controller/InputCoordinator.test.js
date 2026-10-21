import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalStackController, InputCoordinator, ROUTE_ACTIONS } from '../../src/ui-controller/index.js';

describe('InputCoordinator (Headless Input Routing)', () => {
  let modalStack;
  let coordinator;

  beforeEach(() => {
    modalStack = new ModalStackController();
    coordinator = new InputCoordinator({ modalStack });
  });

  it('グローバルショートカット (Alt+S, Ctrl+P) が正しくルーティングされること', () => {
    // Alt+S -> サイドパネルトグル
    const resPanel = coordinator.evaluateKeyDown({ key: 's', code: 'KeyS', altKey: true });
    expect(resPanel.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_PANEL);

    // Ctrl+P -> 過去ログドロワートグル
    const resHistory = coordinator.evaluateKeyDown({ key: 'p', code: 'KeyP', ctrlKey: true });
    expect(resHistory.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_HISTORY);

    // Ctrl+O -> フロア記録・マーカー管理トグル
    const resFloorCtrl = coordinator.evaluateKeyDown({ key: 'o', code: 'KeyO', ctrlKey: true });
    expect(resFloorCtrl.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_FLOOR_TRACKER);

    // Alt+A -> フロア記録・マーカー管理トグル
    const resFloorAlt = coordinator.evaluateKeyDown({ key: 'a', code: 'KeyA', altKey: true });
    expect(resFloorAlt.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_FLOOR_TRACKER);
  });

  it('モーダルが開いている場合は ESC で CLOSE_TOP_MODAL が導出されること', () => {
    modalStack.registerModal('paperdoll', {
      isOpen: () => true,
      close: vi.fn(),
      priority: 10
    });

    const res = coordinator.evaluateKeyDown({ key: 'Escape', code: 'Escape' });
    expect(res.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);
    expect(res.payload?.modalId).toBe('paperdoll');

    // q キーでもペーパードールが閉じられる
    const resQ = coordinator.evaluateKeyDown({ key: 'q', code: 'KeyQ' });
    expect(resQ.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);

    // 通常キーはブロックされる
    const resChar = coordinator.evaluateKeyDown({ key: 'j', code: 'KeyJ' });
    expect(resChar.action).toBe(ROUTE_ACTIONS.BLOCK_INPUT);
  });

  it('charStatus モーダルが開いている場合は ESC および q で CLOSE_TOP_MODAL が導出されること', () => {
    modalStack.registerModal('charStatus', {
      isOpen: () => true,
      close: vi.fn(),
      priority: 30
    });

    const resEsc = coordinator.evaluateKeyDown({ key: 'Escape', code: 'Escape' });
    expect(resEsc.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);
    expect(resEsc.payload?.modalId).toBe('charStatus');

    const resQ = coordinator.evaluateKeyDown({ key: 'q', code: 'KeyQ' });
    expect(resQ.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);
    expect(resQ.payload?.modalId).toBe('charStatus');
  });

  it('floorTracker モーダルが開いている場合は ESC および q で CLOSE_TOP_MODAL が導出されること', () => {
    modalStack.registerModal('floorTracker', {
      isOpen: () => true,
      close: vi.fn(),
      priority: 30
    });

    const resEsc = coordinator.evaluateKeyDown({ key: 'Escape', code: 'Escape' });
    expect(resEsc.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);
    expect(resEsc.payload?.modalId).toBe('floorTracker');

    const resQ = coordinator.evaluateKeyDown({ key: 'q', code: 'KeyQ' });
    expect(resQ.action).toBe(ROUTE_ACTIONS.CLOSE_TOP_MODAL);
    expect(resQ.payload?.modalId).toBe('floorTracker');
  });

  it('モーダル内の入力欄にフォーカスがある場合は passToNative で通すこと', () => {
    modalStack.registerModal('codex', {
      isOpen: () => true,
      close: vi.fn(),
      priority: 10,
      isInputFocused: () => true
    });

    const res = coordinator.evaluateKeyDown({ key: 'a', code: 'KeyA' });
    expect(res.action).toBe(ROUTE_ACTIONS.BLOCK_INPUT);
    expect(res.payload?.passToNative).toBe(true);

    // floorTracker でも入力欄フォーカス時は 'q' で閉じずに passToNative となること
    modalStack.registerModal('floorTracker', {
      isOpen: () => true,
      close: vi.fn(),
      priority: 30,
      isInputFocused: () => true
    });
    const resFloorQ = coordinator.evaluateKeyDown({ key: 'q', code: 'KeyQ' });
    expect(resFloorQ.action).toBe(ROUTE_ACTIONS.BLOCK_INPUT);
    expect(resFloorQ.payload?.passToNative).toBe(true);
  });

  it('メニューモーダル表示中の操作が正しくルーティングされること', () => {
    // 矢印下 -> SCROLL_DOWN
    const resDown = coordinator.evaluateKeyDown(
      { key: 'ArrowDown', code: 'ArrowDown' },
      { isMenuOpen: true, isTextWindowMode: false }
    );
    expect(resDown.action).toBe(ROUTE_ACTIONS.MENU_SCROLL_DOWN);

    // Enter -> SELECT
    const resEnter = coordinator.evaluateKeyDown(
      { key: 'Enter', code: 'Enter' },
      { isMenuOpen: true, isTextWindowMode: false }
    );
    expect(resEnter.action).toBe(ROUTE_ACTIONS.MENU_SELECT);

    // Escape / 0 -> CANCEL
    const resEsc = coordinator.evaluateKeyDown(
      { key: 'Escape', code: 'Escape' },
      { isMenuOpen: true, isTextWindowMode: false }
    );
    expect(resEsc.action).toBe(ROUTE_ACTIONS.MENU_CANCEL);

    // テキストウィンドウモード中の Space -> DISMISS
    const resTextSpace = coordinator.evaluateKeyDown(
      { key: ' ', code: 'Space' },
      { isMenuOpen: true, isTextWindowMode: true }
    );
    expect(resTextSpace.action).toBe(ROUTE_ACTIONS.TEXT_WINDOW_DISMISS);
  });

  it('マップ探索中の通常キーは PASSTHROUGH_GAME_KEY として渡されること', () => {
    const res = coordinator.evaluateKeyDown({
      key: 'k',
      code: 'KeyK',
      shiftKey: false,
      ctrlKey: false,
      altKey: false
    });

    expect(res.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
    expect(res.payload?.code).toBe('KeyK');
  });

  it('Tab キーでミニマップ最大化トグルが導出されること', () => {
    const res = coordinator.evaluateKeyDown({ key: 'Tab', code: 'Tab' });
    expect(res.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_MINIMAP);
  });

  it('Nehww モード時、M キーでもミニマップ最大化トグルが導出されること', () => {
    const res = coordinator.evaluateKeyDown(
      { key: 'm', code: 'KeyM' },
      { inputMode: 'nehww', isPromptActive: false }
    );
    expect(res.action).toBe(ROUTE_ACTIONS.SHORTCUT_TOGGLE_MINIMAP);

    // 最大化中に M で縮小
    const resClose = coordinator.evaluateKeyDown(
      { key: 'm', code: 'KeyM' },
      { isMinimapMaximized: true, inputMode: 'nehww' }
    );
    expect(resClose.action).toBe(ROUTE_ACTIONS.SHORTCUT_ESCAPE_MINIMAP);
  });

  it('標準操作プログレッシブ拡張: "/" で OPEN_KNOWLEDGE_INSPECTOR、"\\" で OPEN_DISCOVERY_CODEX が導出されること', () => {
    // '/' キー
    const resSlash = coordinator.evaluateKeyDown({ key: '/', code: 'Slash' });
    expect(resSlash.action).toBe(ROUTE_ACTIONS.OPEN_KNOWLEDGE_INSPECTOR);

    // '\' キー
    const resBackslash = coordinator.evaluateKeyDown({ key: '\\', code: 'Backslash' });
    expect(resBackslash.action).toBe(ROUTE_ACTIONS.OPEN_DISCOVERY_CODEX);

    // bypassEnhancedSignals: true の場合は PASSTHROUGH_GAME_KEY になること (素通し)
    const resBypass = coordinator.evaluateKeyDown(
      { key: '/', code: 'Slash' },
      { bypassEnhancedSignals: true }
    );
    expect(resBypass.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);

    // Shift + Slash ('?') は OPEN_KNOWLEDGE_INSPECTOR にならず PASSTHROUGH_GAME_KEY になること
    const resQuestion = coordinator.evaluateKeyDown({ key: '?', code: 'Slash', shiftKey: true });
    expect(resQuestion.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
    expect(resQuestion.payload?.key).toBe('?');

    // 'C' (Call) キーは NetHack のゲームコマンドとして C コアへパススルーされること
    const resCall = coordinator.evaluateKeyDown({ key: 'C', code: 'KeyC', shiftKey: true });
    expect(resCall.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
    expect(resCall.payload?.key).toBe('C');

    // 小文字 'c' は close コマンドなので PASSTHROUGH_GAME_KEY になること
    const resClose = coordinator.evaluateKeyDown({ key: 'c', code: 'KeyC', shiftKey: false });
    expect(resClose.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);

    // Shift + Backslash ('|') は PASSTHROUGH_GAME_KEY になること
    const resPipe = coordinator.evaluateKeyDown({ key: '|', code: 'Backslash', shiftKey: true });
    expect(resPipe.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
    expect(resPipe.payload?.key).toBe('|');
  });

  it('F1 キーで SWITCH_INPUT_MODE が導出されること', () => {
    const res = coordinator.evaluateKeyDown({ key: 'F1', code: 'F1' });
    expect(res.action).toBe(ROUTE_ACTIONS.SWITCH_INPUT_MODE);
  });

  describe('NEHWW モードでの論理アクション導出', () => {
    const nehwwContext = { inputMode: 'nehww' };

    it('Shift + 方向キーでターン消費ゼロの ROTATE_FACING が導出されること', () => {
      // Shift + 上矢印 -> 北向き
      const resUp = coordinator.evaluateKeyDown(
        { key: 'ArrowUp', code: 'ArrowUp', shiftKey: true },
        nehwwContext
      );
      expect(resUp.action).toBe(ROUTE_ACTIONS.ROTATE_FACING);
      expect(resUp.payload?.dirCode).toBe('N');

      // Shift + KeyD -> 東向き (WASD系)
      const resD = coordinator.evaluateKeyDown(
        { key: 'd', code: 'KeyD', shiftKey: true },
        nehwwContext
      );
      expect(resD.action).toBe(ROUTE_ACTIONS.ROTATE_FACING);
      expect(resD.payload?.dirCode).toBe('E');
    });

    it('Space キーで決定・文脈アクション EXECUTE_CONTEXT_PRIMARY が導出されること', () => {
      const res = coordinator.evaluateKeyDown(
        { key: ' ', code: 'Space' },
        nehwwContext
      );
      expect(res.action).toBe(ROUTE_ACTIONS.EXECUTE_CONTEXT_PRIMARY);
    });

    it('Shift + Space キーで足元アクション EXECUTE_CONTEXT_FEET が導出されること', () => {
      const res = coordinator.evaluateKeyDown(
        { key: ' ', code: 'Space', shiftKey: true },
        nehwwContext
      );
      expect(res.action).toBe(ROUTE_ACTIONS.EXECUTE_CONTEXT_FEET);
    });

    it('G キーによるプレフィックス ➔ WASD でダッシュ移動 DASH_MOVE が導出されること', () => {
      // 1. G キー押下でダッシュプレフィックス待機
      const resG = coordinator.evaluateKeyDown(
        { key: 'g', code: 'KeyG' },
        nehwwContext
      );
      expect(resG.action).toBe(ROUTE_ACTIONS.ACTIVATE_DASH_PREFIX);
      expect(coordinator.isDashPrefixActive).toBe(true);

      // 2. 次に W キー押下で北向きダッシュ移動
      const resW = coordinator.evaluateKeyDown(
        { key: 'w', code: 'KeyW' },
        nehwwContext
      );
      expect(resW.action).toBe(ROUTE_ACTIONS.DASH_MOVE);
      expect(resW.payload?.dirCode).toBe('N');
      expect(coordinator.isDashPrefixActive).toBe(false);

      // 3. G キー押下後に Escape でダッシュキャンセル
      coordinator.evaluateKeyDown({ key: 'g', code: 'KeyG' }, nehwwContext);
      expect(coordinator.isDashPrefixActive).toBe(true);
      const resEsc = coordinator.evaluateKeyDown({ key: 'Escape', code: 'Escape' }, nehwwContext);
      expect(resEsc.action).toBe(ROUTE_ACTIONS.CANCEL_DASH_PREFIX);
      expect(coordinator.isDashPrefixActive).toBe(false);

      // 4. ブラウザ保護: Ctrl + WASD は DASH_MOVE にならず、タブ終了等の事故を防止すること
      const resCtrlW = coordinator.evaluateKeyDown(
        { key: 'w', code: 'KeyW', ctrlKey: true },
        nehwwContext
      );
      expect(resCtrlW.action).not.toBe(ROUTE_ACTIONS.DASH_MOVE);
    });

    it('I キーで所持品・装備 TOGGLE_INVENTORY が導出されること', () => {
      const res = coordinator.evaluateKeyDown(
        { key: 'i', code: 'KeyI' },
        nehwwContext
      );
      expect(res.action).toBe(ROUTE_ACTIONS.TOGGLE_INVENTORY);
    });

    it('P および V キーでキャラクター詳細ステータス TOGGLE_CHARACTER_STATUS が導出されること', () => {
      const resP = coordinator.evaluateKeyDown(
        { key: 'p', code: 'KeyP' },
        nehwwContext
      );
      expect(resP.action).toBe(ROUTE_ACTIONS.TOGGLE_CHARACTER_STATUS);

      const resV = coordinator.evaluateKeyDown(
        { key: 'v', code: 'KeyV' },
        nehwwContext
      );
      expect(resV.action).toBe(ROUTE_ACTIONS.TOGGLE_CHARACTER_STATUS);
    });

    it('B キーで冒険手帳 OPEN_DISCOVERY_CODEX が導出されること', () => {
      const res = coordinator.evaluateKeyDown(
        { key: 'b', code: 'KeyB' },
        nehwwContext
      );
      expect(res.action).toBe(ROUTE_ACTIONS.OPEN_DISCOVERY_CODEX);
    });

    it('? キーでキーレイアウトヘルプ SHOW_KEYMAP_HELP が導出されること', () => {
      const res = coordinator.evaluateKeyDown(
        { key: '?', code: 'Slash', shiftKey: true },
        nehwwContext
      );
      expect(res.action).toBe(ROUTE_ACTIONS.SHOW_KEYMAP_HELP);
    });

    it('通常移動キーで PASSTHROUGH_GAME_KEY に dirCode が付与されること (WASD / KeyS 対応)', () => {
      const resW = coordinator.evaluateKeyDown(
        { key: 'w', code: 'KeyW', shiftKey: false },
        nehwwContext
      );
      expect(resW.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
      expect(resW.payload?.dirCode).toBe('N');

      const resS = coordinator.evaluateKeyDown(
        { key: 's', code: 'KeyS', shiftKey: false },
        nehwwContext
      );
      expect(resS.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
      expect(resS.payload?.dirCode).toBe('S');

      // Shift + KeyS で ROTATE_FACING (dirCode: 'S')
      const resShiftS = coordinator.evaluateKeyDown(
        { key: 'S', code: 'KeyS', shiftKey: true },
        nehwwContext
      );
      expect(resShiftS.action).toBe(ROUTE_ACTIONS.ROTATE_FACING);
      expect(resShiftS.payload?.dirCode).toBe('S');
    });

    it('メニュー表示中、Nehww モードでは KeyW/KeyS/Space でスクロール・選択できること', () => {
      const menuContext = { isMenuOpen: true, isTextWindowMode: false, inputMode: 'nehww' };
      
      const resS = coordinator.evaluateKeyDown({ key: 's', code: 'KeyS' }, menuContext);
      expect(resS.action).toBe(ROUTE_ACTIONS.MENU_SCROLL_DOWN);

      const resW = coordinator.evaluateKeyDown({ key: 'w', code: 'KeyW' }, menuContext);
      expect(resW.action).toBe(ROUTE_ACTIONS.MENU_SCROLL_UP);

      const resSpace = coordinator.evaluateKeyDown({ key: ' ', code: 'Space' }, menuContext);
      expect(resSpace.action).toBe(ROUTE_ACTIONS.MENU_SELECT);
    });

    it('プロンプト要求中 (isPromptActive) はショートカットが横取りされずパススルーされること', () => {
      const promptContext = { inputMode: 'nehww', isPromptActive: true };
      const res = coordinator.evaluateKeyDown(
        { key: 'i', code: 'KeyI' },
        promptContext
      );
      expect(res.action).toBe(ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY);
    });
  });
});

