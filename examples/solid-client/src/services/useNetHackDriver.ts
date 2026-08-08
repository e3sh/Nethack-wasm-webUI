import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import {
  addMessage,
  updateStatus,
  updateTile,
  setCursorPos,
  clearMapGrid,
  activePrompt,
  setActivePrompt,
  activeMenu,
  setActiveMenu,
  activeTextModal,
  setActiveTextModal,
  setEngineState,
  setDetectedSaveName,
  setGameOverResult,
  resetAllState,
} from '../stores/gameStore';

export class NetHackDriverController {
  private core: any = null;
  private isInitialized = false;

  public respondPrompt = (value: any) => {
    if (this.core) {
      setActivePrompt(null);
      this.core.respond(value);
    }
  };

  public respondMenu = (resValue: any) => {
    if (this.core) {
      setActiveMenu(null);
      this.core.respond(resValue);
    }
  };

  public deleteSaveFile = async () => {
    if (this.core) {
      if (typeof this.core.deleteSaveFile === 'function') {
        await this.core.deleteSaveFile();
      } else if (this.core.driver && typeof this.core.driver.deleteSaveFile === 'function') {
        await this.core.driver.deleteSaveFile();
      }
    }
    setDetectedSaveName(null);
    addMessage('🗑️ セーブデータを完全物理削除しました。');
  };

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    const currentMenu = activeMenu();
    const currentModal = activeTextModal();

    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (currentMenu || currentModal) {
      return;
    }

    if (this.core) {
      this.core.sendKeyEvent(e);
    }
  };

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const workerPath = import.meta.env.PROD
      ? './src/driver/nethack.worker.js'
      : '/src/driver/nethack.worker.js';

    const nethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    const driver = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });

    this.core = new WebUICore({ driver });

    this.core.on('stateChange', ({ state }: { state: string }) => {
      if (state === 'RUNNING' || state === 'WAITING_INPUT') {
        setEngineState('RUNNING');
      } else if (state === 'EXITED') {
        setEngineState('SAVED');
      } else if (state === 'GAME_OVER') {
        setEngineState('GAMEOVER');
      } else if (state === 'READY' || state === 'INITIALIZING') {
        setEngineState('RUNNING');
      } else {
        setEngineState('IDLE');
      }
    });

    this.core.on('message', (msg: string) => {
      addMessage(msg);
    });

    this.core.on('statusUpdate', (data: any) => {
      const field = data.field;
      const value = data.value;
      updateStatus(field, value, data);
    });

    this.core.on('cursor', ({ x, y }: { x: number; y: number }) => {
      setCursorPos({ x, y });
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      updateTile(x, y, glyph, ch, color);
    });

    this.core.on('map_cleared', () => {
      clearMapGrid();
    });

    this.core.on('textWindowModal', (payload: any) => {
      setActiveTextModal({
        title: payload.payload?.rawPrompt || 'Information / Help',
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    this.core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;

      if (category === 'MENU' || payload.inputType === 'MENU' || context === 'select_menu') {
        setActiveMenu({
          windowId: payload.windowId || 1,
          prompt: payload.promptText || prompt || 'Select item:',
          items: payload.options || items || payload.menuItems || [],
          resolver: resolver,
          how: payload.how !== undefined ? payload.how : 1,
        });
        return;
      }

      setActivePrompt(payload);
    });

    this.core.on('inputResolved', () => {
      setActivePrompt(null);
      setActiveMenu(null);
      setActiveTextModal(null);
    });

    this.core.on('gameOver', (result: any) => {
      setActivePrompt(null);
      setActiveMenu(null);
      setActiveTextModal(null);
      setGameOverResult(result);

      if (result && result.reason === 'save_and_exit') {
        setEngineState('SAVED');
        addMessage('ℹ️ ゲームは正常にセーブ中断されました（次回起動時に再開可能です）。');
      } else {
        setEngineState('GAMEOVER');
        if (result && result.deathMessage) {
          addMessage(`☠️ ${result.deathMessage}`);
        } else {
          addMessage('☠️ セーブデータがありません。ゲームオーバーです。');
        }
      }
    });

    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    window.addEventListener('keydown', this.handleGlobalKeyDown);

    this.core.start(nethackJsPath).catch((err: any) => {
      console.error("Solid client WebUICore start error:", err);
    });
  }

  public async restartGame() {
    resetAllState();

    if (this.core) {
      try {
        if (typeof this.core.deleteSaveFile === 'function') {
          await this.core.deleteSaveFile();
        }
      } catch (e) {
        console.warn("Save clear on restart warning:", e);
      }
    }

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Storage clear warning:", e);
    }

    window.location.reload();
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    if (this.core) {
      this.core.destroy();
      this.core = null;
    }
  }
}

export const driverController = new NetHackDriverController();
