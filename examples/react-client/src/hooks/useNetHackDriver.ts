import { useState, useEffect, useCallback } from 'react';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { GKLPlugin } from '@core/knowledge/GKLPlugin.js';
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

    const gklPlugin = new GKLPlugin({ keyMode: 'numpad' });
    gklPlugin.attach(core);

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
      if ((core as any).gkl && (core as any).gkl.areaStateManager) {
        (core as any).gkl.areaStateManager.updatePlayerPosition(x, y);
      }
      if ((core as any).gkl && typeof (core as any).gkl.getSituation === 'function') {
        useGameStore.getState().setGklSituation((core as any).gkl.getSituation());
      }
    });

    core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      useGameStore.getState().updateTile(x, y, glyph, ch, color);
      if ((core as any).gkl && (core as any).gkl.areaStateManager) {
        (core as any).gkl.areaStateManager.updateGlyph(x, y, glyph);
      }
    });

    core.on('inventoryStateUpdated', () => {
      if ((core as any).gkl && typeof (core as any).gkl.getSituation === 'function') {
        useGameStore.getState().setGklSituation((core as any).gkl.getSituation());
      }
    });

    core.on('map_cleared', () => {
      useGameStore.getState().clearMapGrid();
    });

    core.on('textWindowModal', (payload: any) => {
      useGameStore.getState().setTextModal({
        title: payload.payload?.title || payload.title || payload.payload?.rawPrompt || 'Information / Help',
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

      if (core && (core as any).gkl && typeof (core as any).gkl.getSituation === 'function') {
        useGameStore.getState().setGklSituation((core as any).gkl.getSituation());
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

  const cancelPrompt = useCallback(() => {
    if (globalCore) {
      useGameStore.getState().setPrompt(null);
      globalCore.cancelPrompt();
    }
  }, []);

  const restartGame = useCallback(async (options?: { clearStorage?: boolean }) => {
    const store = useGameStore.getState();
    store.resetAllState();

    const opts = (options && typeof options === 'object' && ('clearStorage' in options)) ? options : { clearStorage: true };

    if (globalCore && typeof globalCore.restart === 'function') {
      await globalCore.restart(opts);
    } else {
      window.location.reload();
    }
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

  const sendAction = useCallback((action: any) => {
    useGameStore.getState().setPrompt(null);
    if (globalCore) {
      if (typeof globalCore.sendAction === 'function') {
        globalCore.sendAction(action);
      } else {
        globalCore.respond(action);
      }
    }
  }, []);

  const respondTextModal = useCallback((val: any = ' ') => {
    useGameStore.getState().setTextModal(null);
    if (globalCore) {
      if (val === ' ' || val === 32 || !val) {
        globalCore.sendKey('Space');
      } else {
        globalCore.respond(val);
      }
    }
  }, []);

  const executeAction = useCallback((action: any) => {
    if (globalCore) {
      if (typeof globalCore.executeAction === 'function') {
        return globalCore.executeAction(action);
      } else if (globalCore.gkl && typeof globalCore.gkl.executeAction === 'function') {
        return globalCore.gkl.executeAction(action);
      }
    }
    return false;
  }, []);

  const executeSequence = useCallback((sequence: any[]) => {
    if (globalCore) {
      if (typeof globalCore.executeSequence === 'function') {
        return globalCore.executeSequence(sequence);
      } else if (globalCore.requestController && typeof globalCore.requestController.executeSequence === 'function') {
        return globalCore.requestController.executeSequence(sequence);
      }
    }
    return false;
  }, []);

  const getGlyphStyle = useCallback((glyphId: number, options: any = {}) => {
    if (globalCore && typeof globalCore.getGlyphStyle === 'function') {
      return globalCore.getGlyphStyle(glyphId, options);
    }
    return null;
  }, []);

  const extractDirectionCode = useCallback((action: any): string => {
    if (!action) return 'NONE';

    let rawDir = action.directionKey;

    if (!rawDir && action.direction) {
      if (typeof action.direction === 'string') {
        rawDir = action.direction;
      } else if (typeof action.direction === 'object') {
        rawDir = action.direction.code || action.direction.key || action.direction.name;
      }
    }

    if (!rawDir && action.dirCode) {
      rawDir = action.dirCode;
    }

    if (!rawDir && Array.isArray(action.keySequence)) {
      const dirToken = action.keySequence.find((t: any) => typeof t === 'string' && t.startsWith('DIR_'));
      if (dirToken) rawDir = dirToken;
    }

    if (!rawDir) {
      if (action.target === 'feet' || action.isDirectional === false) {
        return 'SELF';
      }
      return 'NONE';
    }

    const cleaned = String(rawDir).toUpperCase().replace(/^DIR_/, '');
    const validDirections = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'SELF']);

    if (validDirections.has(cleaned)) {
      return cleaned;
    }

    const nameMap: Record<string, string> = {
      'NORTH': 'N', 'UP': 'N',
      'EAST': 'E', 'RIGHT': 'E',
      'SOUTH': 'S', 'DOWN': 'S',
      'WEST': 'W', 'LEFT': 'W',
      'NORTHEAST': 'NE', 'NORTHWEST': 'NW',
      'SOUTHEAST': 'SE', 'SOUTHWEST': 'SW',
      'FEET': 'SELF', 'HERE': 'SELF', 'CURRENT': 'SELF'
    };

    return nameMap[cleaned] || 'NONE';
  }, []);

  const getZoomAreaTiles = useCallback((radius: number = 3) => {
    const gameStore = useGameStore.getState();
    const px = gameStore.cursorPos ? gameStore.cursorPos.x : -1;
    const py = gameStore.cursorPos ? gameStore.cursorPos.y : -1;

    const tiles: Array<any> = [];
    const gkl = globalCore ? globalCore.gkl : null;
    const sk = gkl ? gkl.structuredKnowledge : null;
    const asm = gkl ? gkl.areaStateManager : null;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = px + dx;
        const ty = py + dy;
        const isPlayer = (dx === 0 && dy === 0);
        let glyphId = -1;
        let symbol = ' ';
        let color = 7;
        let knowledge: any = null;
        let nameJa = '視界外';

        if (px >= 0 && py >= 0 && tx >= 0 && tx < 80 && ty >= 0 && ty < 21) {
          const gridTile = gameStore.mapGrid[ty]?.[tx];
          if (gridTile) {
            symbol = gridTile.symbol || ' ';
            color = gridTile.color;
            if (gridTile.tileId === 0 && symbol === ' ') {
              glyphId = -1;
              nameJa = '未探索';
            } else {
              glyphId = gridTile.tileId;
            }
          }

          if (asm && typeof asm.getGlyph === 'function') {
            const asmGlyph = asm.getGlyph(tx, ty);
            if (asmGlyph > 0) glyphId = asmGlyph;
          }

          if (glyphId > 0 && sk && typeof sk.getKnowledge === 'function') {
            knowledge = sk.getKnowledge(glyphId);
            if (knowledge && knowledge.nameJa) {
              nameJa = knowledge.nameJa;
            }
          } else if (glyphId === 0 && symbol !== ' ' && sk && typeof sk.getKnowledge === 'function') {
            knowledge = sk.getKnowledge(0);
            if (knowledge && knowledge.nameJa) nameJa = knowledge.nameJa;
          } else if (symbol === ' ') {
            nameJa = '未探索';
          }
        }

        tiles.push({
          dx,
          dy,
          glyphId,
          symbol,
          color,
          nameJa,
          knowledge,
          x: tx,
          y: ty,
          isPlayer,
        });
      }
    }

    return tiles;
  }, []);

  const getAdjacentAreaTiles = useCallback(() => {
    return getZoomAreaTiles(1);
  }, [getZoomAreaTiles]);

  const inspectTileKnowledge = useCallback((x: number, y: number) => {
    if (!globalCore || !globalCore.gkl) {
      useGameStore.getState().setHoveredTileKnowledge(null);
      return;
    }

    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix < 0 || ix >= 80 || iy < 0 || iy >= 21) {
      useGameStore.getState().setHoveredTileKnowledge(null);
      return;
    }

    const gkl = globalCore.gkl;
    const asm = gkl ? gkl.areaStateManager : null;
    let glyphId = -1;

    if (asm && typeof asm.getGlyph === 'function') {
      glyphId = asm.getGlyph(ix, iy);
    }

    if (glyphId < 0) {
      const gridTile = useGameStore.getState().mapGrid[iy]?.[ix];
      if (gridTile) glyphId = gridTile.tileId;
    }

    if (glyphId >= 0 && gkl && gkl.structuredKnowledge && typeof gkl.structuredKnowledge.getKnowledge === 'function') {
      const knowledge = gkl.structuredKnowledge.getKnowledge(glyphId);
      useGameStore.getState().setHoveredTileKnowledge({ x: ix, y: iy, glyphId, knowledge });
    } else {
      useGameStore.getState().setHoveredTileKnowledge(null);
    }
  }, []);

  const syncInventorySilent = useCallback(async () => {
    if (globalCore && globalCore.gkl && typeof globalCore.gkl.syncInventorySilent === 'function') {
      await globalCore.gkl.syncInventorySilent();
      useGameStore.getState().setGklSituation(globalCore.gkl.getSituation());
    }
  }, []);

  return {
    isInitialized,
    deleteSaveFile,
    restartGame,
    cancelPrompt,
    respondPrompt,
    respondMenu,
    respondTextModal,
    sendAction,
    executeAction,
    executeSequence,
    getGlyphStyle,
    extractDirectionCode,
    getZoomAreaTiles,
    getAdjacentAreaTiles,
    inspectTileKnowledge,
    syncInventorySilent,
  };
}
