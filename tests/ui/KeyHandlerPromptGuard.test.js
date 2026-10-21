import { describe, it, expect, vi } from 'vitest';
import { KeyHandler } from '../../examples/gkl-pure-js-client/modules/handlers/KeyHandler.js';
import { ROUTE_ACTIONS } from '../../src/ui-controller/index.js';

describe('KeyHandler - プロンプト待機時 (YNQ / アイテム選択 / 方向) の入力ガード検証', () => {
  it('YNQ プロンプト時 (cat === "YN"): "q" キーを押してもテンキー "7" に化けず、文字 "q" がそのまま C コアへ送信されること', () => {
    const mockCore = {
      currentPromptCategory: 'YN',
      activeResolver: vi.fn(),
      sendKey: vi.fn(),
      getGKLPlugin: () => null
    };

    const mockUIConfig = {
      get: () => ({ inputMode: 'nehww', bypassEnhancedSignals: true })
    };

    const handler = new KeyHandler({
      getCore: () => mockCore,
      getUIConfigStore: () => mockUIConfig
    });

    const eventQ = {
      key: 'q',
      code: 'KeyQ',
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      preventDefault: vi.fn()
    };

    handler.handleGlobalKeyDown(eventQ);

    // 【重要】テンキー "7" ではなく、文字 "q" が送られていること！
    expect(mockCore.sendKey).toHaveBeenCalledWith('KeyQ', false, false, false, 'q');
    expect(mockCore.sendKey).not.toHaveBeenCalledWith('7', false, false, false, '7');
  });

  it('YNQ プロンプト時 (cat === "YN"): "y" および "n" キーがそのまま C コアへ送信されること', () => {
    const mockCore = {
      currentPromptCategory: 'YN',
      activeResolver: vi.fn(),
      sendKey: vi.fn(),
      getGKLPlugin: () => null
    };

    const mockUIConfig = {
      get: () => ({ inputMode: 'nehww', bypassEnhancedSignals: true })
    };

    const handler = new KeyHandler({
      getCore: () => mockCore,
      getUIConfigStore: () => mockUIConfig
    });

    handler.handleGlobalKeyDown({
      key: 'y', code: 'KeyY', shiftKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn()
    });
    expect(mockCore.sendKey).toHaveBeenCalledWith('KeyY', false, false, false, 'y');

    handler.handleGlobalKeyDown({
      key: 'n', code: 'KeyN', shiftKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn()
    });
    expect(mockCore.sendKey).toHaveBeenCalledWith('KeyN', false, false, false, 'n');
  });

  it('方向プロンプト時 (cat === "DIRECTION"): "w" キーを押した時にテンキー "8" (北) に偽装変換されて送信されること', () => {
    const mockCore = {
      currentPromptCategory: 'DIRECTION',
      activeResolver: vi.fn(),
      sendKey: vi.fn(),
      getGKLPlugin: () => null
    };

    const mockUIConfig = {
      get: () => ({ inputMode: 'nehww', bypassEnhancedSignals: true })
    };

    const handler = new KeyHandler({
      getCore: () => mockCore,
      getUIConfigStore: () => mockUIConfig
    });

    handler.handleGlobalKeyDown({
      key: 'w', code: 'KeyW', shiftKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn()
    });

    // 方向プロンプトでは "8" に偽装返却
    expect(mockCore.sendKey).toHaveBeenCalledWith('8', false, false, false, '8');
  });

  it('通常ターン歩行時 (cat === "NONE" / isPromptActive === false): "w" キーで "8" (北移動) が送信されること', () => {
    const mockCore = {
      currentPromptCategory: 'NONE',
      activeResolver: null,
      sendKey: vi.fn(),
      getGKLPlugin: () => null
    };

    const mockUIConfig = {
      get: () => ({ inputMode: 'nehww', bypassEnhancedSignals: true })
    };

    const handler = new KeyHandler({
      getCore: () => mockCore,
      getUIConfigStore: () => mockUIConfig
    });

    handler.handleGlobalKeyDown({
      key: 'w', code: 'KeyW', shiftKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn()
    });

    expect(mockCore.sendKey).toHaveBeenCalledWith('8', false, false, false, '8');
  });

  it('アイテム選択プロンプト時 (currentPromptChoices が存在する場合): スロット文字 "a", "s", "d" がテンキーに化けずそのまま送られること', () => {
    const mockCore = {
      currentPromptCategory: 'KEY',
      currentPromptChoices: 'abcdefghijklmnopqrstuvwxyz',
      activeResolver: vi.fn(),
      sendKey: vi.fn(),
      getGKLPlugin: () => null
    };

    const mockUIConfig = {
      get: () => ({ inputMode: 'nehww', bypassEnhancedSignals: true })
    };

    const handler = new KeyHandler({
      getCore: () => mockCore,
      getUIConfigStore: () => mockUIConfig
    });

    // スロット 's' (KeyS)
    handler.handleGlobalKeyDown({
      key: 's', code: 'KeyS', shiftKey: false, ctrlKey: false, altKey: false, preventDefault: vi.fn()
    });
    // '2' ではなく生キー 'KeyS' / 's' が送られること
    expect(mockCore.sendKey).toHaveBeenCalledWith('KeyS', false, false, false, 's');
  });
});
