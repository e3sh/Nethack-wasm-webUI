import { useState, useEffect, useCallback } from 'react';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { useGameStore } from '../stores/gameStore';

let globalCore: any = null;
let isCoreInitialized = false;
let isInitializingPromise: Promise<void> | null = null;

export function useNetHackDriver() {
  const [isInitialized, setIsInitialized] = useState(isCoreInitialized);

  const respondPrompt = useCallback((value: any) => {
    if (globalCore) {
      useGameStore.getState().setPrompt(null);
      globalCore.respond(value);
    }
  }, []);

  const respondMenu = useCallback((resValue: any) => {
    if (globalCore) {
      useGameStore.getState().setMenu(null);
      globalCore.respond(resValue);
    }
  }, []);

  const deleteSaveFile = useCallback(async () => {
    if (globalCore) {
      if (typeof globalCore.deleteSaveFile === 'function') {
        await globalCore.deleteSaveFile();
      } else if (globalCore.driver && typeof globalCore.driver.deleteSaveFile === 'function') {
        await globalCore.driver.deleteSaveFile();
      }
    }
    useGameStore.getState().setDetectedSaveName(null);
    useGameStore.getState().addMessage('🗑️ セーブデータを完全物理削除しました。');
  }, []);

  const startCore = useCallback(() => {
    if (isInitializingPromise) return isInitializingPromise;

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

    const core = new WebUICore({ driver });
    globalCore = core;

    core.on('stateChange', ({ state }: { state: string }) => {
      if (state === 'RUNNING' || state === 'WAITING_INPUT') {
        useGameStore.getState().setEngineState('RUNNING');
      } else if (state === 'EXITED') {
        useGameStore.getState().setEngineState('SAVED');
      } else if (state === 'GAME_OVER') {
        useGameStore.getState().setEngineState('GAMEOVER');
      } else if (state === 'READY' || state === 'INITIALIZING') {
        useGameStore.getState().setEngineState('RUNNING');
      } else {
        useGameStore.getState().setEngineState('IDLE');
      }
    });

    core.on('message', (msg: string) => {
      useGameStore.getState().addMessage(msg);
    });

    core.on('statusUpdate', (data: any) => {
      const field = data.field;
      const value = data.value;
      useGameStore.getState().updateStatus(field, value, data);
    });

    core.on('cursor', ({ x, y }: { x: number; y: number }) => {
      useGameStore.getState().setCursorPos(x, y);
    });

    core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      useGameStore.getState().updateTile(x, y, glyph, ch, color);
    });

    core.on('map_cleared', () => {
      useGameStore.getState().clearMapGrid();
    });

    core.on('textWindowModal', (payload: any) => {
      useGameStore.getState().setTextModal({
        title: payload.payload?.rawPrompt || 'Information / Help',
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;

      if (category === 'MENU' || payload.inputType === 'MENU' || context === 'select_menu') {
        useGameStore.getState().setMenu({
          windowId: payload.windowId || 1,
          prompt: payload.promptText || prompt || 'Select item:',
          items: payload.options || items || payload.menuItems || [],
          resolver: resolver,
          how: payload.how !== undefined ? payload.how : 1,
        } as any);
        return;
      }

      useGameStore.getState().setPrompt(payload);
    });

    core.on('inputResolved', () => {
      useGameStore.getState().setPrompt(null);
      useGameStore.getState().setMenu(null);
      useGameStore.getState().setTextModal(null);
    });

    core.on('gameOver', (result: any) => {
      const store = useGameStore.getState();
      store.setPrompt(null);
      store.setMenu(null);
      store.setTextModal(null);
      store.setGameOverResult(result);

      if (result && result.reason === 'save_and_exit') {
        store.setEngineState('SAVED');
        store.addMessage('ℹ️ ゲームは正常にセーブ中断されました（次回起動時に再開可能です）。');
      } else {
        store.addMessage(result?.deathMessage ? `☠️ ${result.deathMessage}` : '☠️ セーブデータがありません。ゲームオーバーです。');
      }
    });

    isInitializingPromise = core.start(nethackJsPath).then(() => {
      isCoreInitialized = true;
      setIsInitialized(true);
      isInitializingPromise = null;
    }).catch((err: any) => {
      console.error("React client WebUICore start error:", err);
      isInitializingPromise = null;
    });

    return isInitializingPromise;
  }, []);

  const restartGame = useCallback(async () => {
    const store = useGameStore.getState();
    store.resetAllState();

    if (globalCore) {
      try {
        if (typeof globalCore.deleteSaveFile === 'function') {
          await globalCore.deleteSaveFile();
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
  }, []);

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    const store = useGameStore.getState();

    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (store.activeMenu || store.activeTextModal) {
      return;
    }

    if (globalCore) {
      globalCore.sendKeyEvent(e);
    }
  }, []);

  useEffect(() => {
    if (!globalCore) {
      startCore();
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown, startCore]);

  return {
    isInitialized,
    deleteSaveFile,
    restartGame,
    respondPrompt,
    respondMenu,
  };
}
