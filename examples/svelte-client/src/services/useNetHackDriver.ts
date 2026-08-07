import { get } from 'svelte/store';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import {
  addMessage,
  updateStatus,
  updateTile,
  setCursorPos,
  clearMapGrid,
  activePromptStore,
  activeMenuStore,
  activeTextModalStore,
  engineStateStore,
  detectedSaveNameStore,
  gameOverResultStore,
  resetAllState,
} from '../stores/gameStore';

export class NetHackDriverController {
  private core: any = null;
  private isInitialized = false;

  public respondPrompt = (value: any) => {
    if (this.core) {
      activePromptStore.set(null);
      this.core.respond(value);
    }
  };

  public respondMenu = (resValue: any) => {
    if (this.core) {
      activeMenuStore.set(null);
      this.core.respond(resValue);
    }
  };

  public deleteSaveFile = async () => {
    if (this.core && this.core.driver && typeof this.core.driver.deleteSaveFile === 'function') {
      await this.core.driver.deleteSaveFile();
    }
    detectedSaveNameStore.set(null);
    addMessage('🗑️ セーブデータを完全物理削除しました。');
  };

  public restartGame = async () => {
    resetAllState();

    if (this.core) {
      try {
        this.core.destroy();
      } catch (e) {
        console.warn("Svelte core destroy warning:", e);
      }
      this.core = null;
      this.isInitialized = false;
    }
    this.init();
  };

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    const activeMenu = get(activeMenuStore);
    const activeTextModal = get(activeTextModalStore);
    const activePrompt = get(activePromptStore);

    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (activeMenu || activeTextModal || activePrompt) {
      return;
    }

    if (this.core && this.core.activeResolver) {
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
      }
      this.core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
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
        engineStateStore.set('RUNNING');
      } else if (state === 'EXITED') {
        engineStateStore.set('SAVED');
      } else if (state === 'GAME_OVER') {
        engineStateStore.set('GAMEOVER');
      } else if (state === 'READY' || state === 'INITIALIZING') {
        engineStateStore.set('RUNNING');
      } else {
        engineStateStore.set('IDLE');
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
      setCursorPos(x, y);
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      updateTile(x, y, glyph, ch, color);
    });

    this.core.on('map_cleared', () => {
      clearMapGrid();
    });

    this.core.on('textWindowModal', (payload: any) => {
      activeTextModalStore.set({
        title: payload.payload?.rawPrompt || 'Information / Help',
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    this.core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;

      if (category === 'MENU' || context === 'select_menu') {
        activeMenuStore.set({
          windowId: payload.windowId || 1,
          prompt: prompt || 'Select item:',
          items: items || [],
          resolver: resolver,
          how: payload.how || 1,
        });
        return;
      }

      activePromptStore.set({
        context: context || category || 'input',
        prompt: prompt || '[INPUT WAITING]',
        choices: choices || '',
        resolver: resolver,
        category: category,
      } as any);
    });

    this.core.on('inputResolved', () => {
      activePromptStore.set(null);
      activeMenuStore.set(null);
      activeTextModalStore.set(null);
    });

    this.core.on('gameOver', (result: any) => {
      activePromptStore.set(null);
      activeMenuStore.set(null);
      activeTextModalStore.set(null);
      gameOverResultStore.set(result);

      if (result && result.reason === 'save_and_exit') {
        engineStateStore.set('SAVED');
        addMessage('ℹ️ ゲームは正常にセーブ中断されました（次回起動時に再開可能です）。');
      } else {
        engineStateStore.set('GAMEOVER');
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
      console.error("Svelte client WebUICore start error:", err);
    });
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
