import { useState, useEffect, useCallback } from 'react';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { GKLPlugin } from '@core/knowledge/GKLPlugin.js';
import { ATTRIBUTE_DEFINITIONS } from '@core/knowledge/AttributeStateManager.js';
import { getAdaptiveItemSpecs } from '@core/knowledge/ItemSpecPresenter.js';
import { useGameStore } from '../stores/gameStore';

let globalCore: any = null;
let globalNethackJsPath = './nethack.js';
let isCoreInitialized = false;
let isInitializingPromise: Promise<void> | null = null;

const driverEventTarget = new EventTarget();

export const onDriverEvent = (event: string, fn: (data: any) => void) => {
  const handler = (e: any) => fn(e.detail);
  driverEventTarget.addEventListener(event, handler);
  return () => driverEventTarget.removeEventListener(event, handler);
};

export const emitDriverEvent = (event: string, data: any) => {
  driverEventTarget.dispatchEvent(new CustomEvent(event, { detail: data }));
};

export function useNetHackDriver() {
  const [isInitialized, setIsInitialized] = useState(isCoreInitialized);
  const [currentLanguage, setCurrentLanguage] = useState<'ja' | 'en'>(globalCore?.language || 'ja');

  useEffect(() => {
    if (!globalCore) return;
    const initialLang = (globalCore.language || 'ja') as 'ja' | 'en';
    setCurrentLanguage(initialLang);
    useGameStore.getState().setLanguage(initialLang);

    const handleLang = ({ language }: { language: 'ja' | 'en' }) => {
      const resolved = (language || 'ja') as 'ja' | 'en';
      setCurrentLanguage(resolved);
      useGameStore.getState().setLanguage(resolved);
    };
    globalCore.on('languageChanged', handleLang);
    return () => {
      if (globalCore) globalCore.off('languageChanged', handleLang);
    };
  }, []);

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

    globalNethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    const driver = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });

    const core = new WebUICore({ driver });
    globalCore = core;
    const initialLang: 'ja' | 'en' = (core as any).language || 'ja';
    setCurrentLanguage(initialLang);

    const gklPlugin = new GKLPlugin({ keyMode: 'numpad', language: initialLang });
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
      if ((core as any).gkl && typeof (core as any).gkl.getSituation === 'function') {
        useGameStore.getState().setGklSituation((core as any).gkl.getSituation());
      }
      emitDriverEvent('cursor', { x, y });
    });

    core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      useGameStore.getState().updateTile(x, y, glyph, ch, color);
      emitDriverEvent('print_glyph', { x, y, glyph, ch, color });
    });

    core.on('inventoryStateUpdated', () => {
      if ((core as any).gkl && typeof (core as any).gkl.getSituation === 'function') {
        useGameStore.getState().setGklSituation((core as any).gkl.getSituation());
      }
    });

    core.on('map_cleared', () => {
      useGameStore.getState().clearMapGrid();
      emitDriverEvent('map_cleared', {});
    });

    core.on('restarted', () => {
      useGameStore.getState().resetAllState();
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
        store.addMessage('ℹ️ ゲームは正常にセーブ中断されました（再開可能です）。');
        // セーブ終了後はセーブデータを保持したまま待機し、選択モーダルを表示
        if (globalCore && typeof globalCore.restart === 'function') {
          globalCore.restart({ clearStorage: false, autoStart: false }).then(async () => {
            const saveInfo = await globalCore.detectSavedGameInfo();
            if (saveInfo && saveInfo.hasSave) {
              store.setPendingSaveInfo(saveInfo);
            }
          }).catch((err: any) => {
            console.warn("Failed to reset core after save:", err);
          });
        }
      } else {
        store.addMessage(result?.deathMessage ? `☠️ ${result.deathMessage}` : '☠️ セーブデータがありません。ゲームオーバーです。');
      }
    });

    isInitializingPromise = core.detectSavedGameInfo().then((saveInfo: any) => {
      if (saveInfo && saveInfo.hasSave) {
        useGameStore.getState().setPendingSaveInfo(saveInfo);
        isCoreInitialized = true;
        setIsInitialized(true);
        isInitializingPromise = null;
      } else {
        return core.start(globalNethackJsPath).then(() => {
          isCoreInitialized = true;
          setIsInitialized(true);
          isInitializingPromise = null;
        });
      }
    }).catch((err: any) => {
      console.warn("Save detection failed, starting default game:", err);
      return core.start(globalNethackJsPath).then(() => {
        isCoreInitialized = true;
        setIsInitialized(true);
        isInitializingPromise = null;
      }).catch((startErr: any) => {
        console.error("React client WebUICore start error:", startErr);
        isInitializingPromise = null;
      });
    });

    return isInitializingPromise;
  }, []);

  const resumeSavedGame = useCallback(async () => {
    useGameStore.getState().setPendingSaveInfo(null);
    if (globalCore) {
      await globalCore.start(globalNethackJsPath);
    }
  }, []);

  const startNewGame = useCallback(async () => {
    useGameStore.getState().setPendingSaveInfo(null);
    if (globalCore) {
      await globalCore.start(globalNethackJsPath, { forceNewGame: true });
    }
  }, []);

  const cancelPrompt = useCallback(() => {
    if (globalCore) {
      useGameStore.getState().setPrompt(null);
      globalCore.cancelPrompt();
    }
  }, []);

  const restartGame = useCallback(async (options?: { clearStorage?: boolean; autoStart?: boolean; wasmJsUrl?: string }) => {
    const store = useGameStore.getState();
    store.resetAllState();

    const shouldClear = options?.clearStorage ?? false;

    if (globalCore && typeof globalCore.restart === 'function') {
      await globalCore.restart({
        wasmJsUrl: globalNethackJsPath,
        clearStorage: shouldClear,
        autoStart: false,
        ...options,
      });

      if (!shouldClear) {
        try {
          const saveInfo = await globalCore.detectSavedGameInfo();
          if (saveInfo && saveInfo.hasSave) {
            store.setPendingSaveInfo(saveInfo);
            return;
          }
        } catch (e) {
          console.warn("Failed to detect save on restart:", e);
        }
      }

      await globalCore.start(globalNethackJsPath, { forceNewGame: shouldClear });
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

    const validDirections = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'SELF']);

    // 1. dirCode を最優先判定
    if (action.dirCode) {
      const c = String(action.dirCode).toUpperCase().replace(/^DIR_/, '');
      if (validDirections.has(c)) return c;
      if (c === 'FEET' || c === 'CURRENT' || c === 'HERE') return 'SELF';
    }

    // 2. direction オブジェクト
    if (action.direction) {
      const code = typeof action.direction === 'object' ? (action.direction.code || action.direction.key) : action.direction;
      if (code) {
        const c = String(code).toUpperCase().replace(/^DIR_/, '');
        if (validDirections.has(c)) return c;
      }
    }

    // 3. directionKey (e.g. DIR_N, DIR_SELF, k, l, j, h, etc.)
    if (action.directionKey) {
      const cleaned = String(action.directionKey).toUpperCase().replace(/^DIR_/, '');
      if (validDirections.has(cleaned)) return cleaned;
      const viKeyMap: Record<string, string> = {
        'K': 'N', 'L': 'E', 'J': 'S', 'H': 'W',
        'U': 'NE', 'Y': 'NW', 'N': 'SE', 'B': 'SW', '.': 'SELF', '5': 'SELF',
        '8': 'N', '6': 'E', '2': 'S', '4': 'W', '9': 'NE', '7': 'NW', '3': 'SE', '1': 'SW'
      };
      if (viKeyMap[cleaned]) return viKeyMap[cleaned];
    }

    // 4. keySequence (e.g. ['DIR_N'], ['a', 'b', 'DIR_SELF'])
    if (Array.isArray(action.keySequence)) {
      const dirToken = action.keySequence.find((t: any) => typeof t === 'string' && t.startsWith('DIR_'));
      if (dirToken) {
        const c = dirToken.replace(/^DIR_/, '').toUpperCase();
        if (validDirections.has(c)) return c;
      }
    }

    // 5. target === 'feet' or non-directional
    if (action.target === 'feet' || action.isDirectional === false || action.category === 'SURVIVAL') {
      return 'SELF';
    }

    // 6. action.id 末尾からの抽出 (e.g. ACTION_ATTACK_N, ACTION_OPEN_DOOR_W)
    if (action.id) {
      const match = action.id.match(/_([NESW]|NE|NW|SE|SW|SELF|FEET)$/);
      if (match) {
        return match[1] === 'FEET' ? 'SELF' : match[1];
      }
    }

    return 'NONE';
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
            if (knowledge && knowledge.name) {
              nameJa = knowledge.name;
            }
          } else if (glyphId === 0 && symbol !== ' ' && sk && typeof sk.getKnowledge === 'function') {
            knowledge = sk.getKnowledge(0);
            if (knowledge && knowledge.name) nameJa = knowledge.name;
          } else if (symbol === ' ') {
            nameJa = (globalCore && globalCore.language === 'en') ? 'Unexplored' : '未探索';
          }
        }

        tiles.push({
          dx,
          dy,
          glyphId,
          symbol,
          color,
          name: nameJa,
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

  const syncSkillsSilent = useCallback(async () => {
    if (globalCore && globalCore.gkl && typeof globalCore.gkl.syncSkillsSilent === 'function') {
      await globalCore.gkl.syncSkillsSilent();
      useGameStore.getState().setGklSituation(globalCore.gkl.getSituation());
    }
  }, []);

  const syncSpellsSilent = useCallback(async () => {
    if (globalCore && globalCore.gkl && typeof globalCore.gkl.syncSpellsSilent === 'function') {
      await globalCore.gkl.syncSpellsSilent();
      useGameStore.getState().setGklSituation(globalCore.gkl.getSituation());
    }
  }, []);

  const moveToCell = useCallback((x: number, y: number) => {
    if (globalCore && globalCore.gkl && typeof globalCore.gkl.moveToCell === 'function') {
      return globalCore.gkl.moveToCell(x, y);
    }
    return false;
  }, []);

  const castSpell = useCallback((letter: string) => {
    if (globalCore && globalCore.gkl && typeof globalCore.gkl.castSpell === 'function') {
      return globalCore.gkl.castSpell(letter);
    }
    if (globalCore && typeof globalCore.executeSequence === 'function') {
      return globalCore.executeSequence(['Z', letter]);
    }
    return false;
  }, []);

  const enhanceSkill = useCallback((skill?: any) => {
    if (globalCore && globalCore.gkl && typeof globalCore.gkl.enhanceSkill === 'function') {
      return globalCore.gkl.enhanceSkill(skill);
    }
    if (globalCore && typeof globalCore.executeSequence === 'function') {
      return globalCore.executeSequence(['#enhance']);
    }
    return false;
  }, []);

  const travelTo = useCallback(async (x: number, y: number) => {
    if (globalCore && globalCore.gkl && typeof globalCore.gkl.travelTo === 'function') {
      return await globalCore.gkl.travelTo({ x, y });
    }
    if (globalCore && typeof globalCore.executeSequence === 'function') {
      return await globalCore.executeSequence(['_', `${x},${y}`, 'Enter']);
    }
    return false;
  }, []);

  const openItemActionMenu = useCallback(async (letter: string) => {
    if (!globalCore || !letter) return;
    if (globalCore.driver && typeof globalCore.driver.queueSequence === 'function') {
      await globalCore.driver.queueSequence(['i', letter], { isSilentSync: true });
    } else if (typeof globalCore.executeSequence === 'function') {
      await globalCore.executeSequence(['i', letter]);
    }
  }, []);

  const getAdaptiveSpecs = useCallback((knowledge: any) => {
    const sm = globalCore?.gkl?.skillStateManager || null;
    const lang = currentLanguage || globalCore?.language || 'ja';
    return getAdaptiveItemSpecs(knowledge, { skillStateManager: sm, language: lang });
  }, [currentLanguage]);

  return {
    isInitialized,
    currentLanguage,
    resumeSavedGame,
    startNewGame,
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
    syncSkillsSilent,
    syncSpellsSilent,
    moveToCell,
    castSpell,
    enhanceSkill,
    travelTo,
    openItemActionMenu,
    getAdaptiveSpecs,
  };
}

export { ATTRIBUTE_DEFINITIONS };

