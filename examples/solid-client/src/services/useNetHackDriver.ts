import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { GKLPlugin } from '@core/knowledge/GKLPlugin.js';
import { ATTRIBUTE_DEFINITIONS } from '@core/knowledge/AttributeStateManager.js';
import { getAdaptiveItemSpecs } from '@core/knowledge/ItemSpecPresenter.js';
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
  setPendingSaveInfo,
  setGameOverResult,
  setGklSituation,
  setHoveredTileKnowledge,
  resetAllState,
  cursorPos,
  mapGrid,
} from '../stores/gameStore';

export class NetHackDriverController {
  private core: any = null;
  private nethackJsPath: string = '';
  private isInitialized = false;

  public sendAction = (action: any) => {
    if (this.core && typeof this.core.sendAction === 'function') {
      this.core.sendAction(action);
    } else if (this.core && typeof this.core.respond === 'function') {
      this.core.respond(action);
    }
  };

  public cancelPrompt = () => {
    if (this.core) {
      setActivePrompt(null);
      this.core.cancelPrompt();
    }
  };

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

    this.nethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    const driver = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });

    this.core = new WebUICore({ driver });

    const gklPlugin = new GKLPlugin({ keyMode: 'numpad' });
    gklPlugin.attach(this.core);

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
      if (this.core && this.core.gkl && this.core.gkl.areaStateManager) {
        this.core.gkl.areaStateManager.updatePlayerPosition(x, y);
      }
      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        setGklSituation(this.core.gkl.getSituation());
      }
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      updateTile(x, y, glyph, ch, color);
      if (this.core && this.core.gkl && this.core.gkl.areaStateManager) {
        this.core.gkl.areaStateManager.updateGlyph(x, y, glyph);
      }
    });

    this.core.on('inventoryStateUpdated', () => {
      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        setGklSituation(this.core.gkl.getSituation());
      }
    });

    this.core.on('map_cleared', () => {
      clearMapGrid();
    });

    this.core.on('restarted', () => {
      resetAllState();
    });

    this.core.on('textWindowModal', (payload: any) => {
      setActiveTextModal({
        title: payload.payload?.title || payload.title || payload.payload?.rawPrompt || 'Information / Help',
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

      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        setGklSituation(this.core.gkl.getSituation());
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
        addMessage('ℹ️ ゲームは正常にセーブ中断されました（再開可能です）。');
        // セーブ終了後はセーブデータを保持したまま待機し、選択モーダルを表示
        if (this.core && typeof this.core.restart === 'function') {
          this.core.restart({ clearStorage: false, autoStart: false }).then(async () => {
            const saveInfo = await this.core.detectSavedGameInfo();
            if (saveInfo && saveInfo.hasSave) {
              setPendingSaveInfo(saveInfo);
            }
          }).catch((err: any) => {
            console.warn("Failed to reset core after save:", err);
          });
        }
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

    this.core.detectSavedGameInfo().then((saveInfo: any) => {
      if (saveInfo && saveInfo.hasSave) {
        setPendingSaveInfo(saveInfo);
      } else {
        this.core.start(this.nethackJsPath).catch((err: any) => {
          console.error("Solid client WebUICore start error:", err);
        });
      }
    }).catch((err: any) => {
      console.warn("Save detection failed, starting default game:", err);
      this.core.start(this.nethackJsPath).catch((startErr: any) => {
        console.error("Solid client WebUICore start error:", startErr);
      });
    });
  }

  public async resumeSavedGame() {
    setPendingSaveInfo(null);
    if (this.core) {
      await this.core.start(this.nethackJsPath);
    }
  }

  public async startNewGame() {
    setPendingSaveInfo(null);
    if (this.core) {
      await this.core.start(this.nethackJsPath, { forceNewGame: true });
    }
  }

  public async restartGame(options: { clearStorage?: boolean; autoStart?: boolean; wasmJsUrl?: string } = { clearStorage: false }) {
    resetAllState();

    const shouldClear = options.clearStorage ?? false;

    if (this.core && typeof this.core.restart === 'function') {
      await this.core.restart({
        wasmJsUrl: this.nethackJsPath,
        clearStorage: shouldClear,
        autoStart: false,
        ...options,
      });

      if (!shouldClear) {
        try {
          const saveInfo = await this.core.detectSavedGameInfo();
          if (saveInfo && saveInfo.hasSave) {
            setPendingSaveInfo(saveInfo);
            return;
          }
        } catch (e) {
          console.warn("Failed to detect save on restart:", e);
        }
      }

      await this.core.start(this.nethackJsPath, { forceNewGame: shouldClear });
    } else {
      window.location.reload();
    }
  }

  public executeAction(action: any) {
    if (this.core) {
      if (typeof this.core.executeAction === 'function') {
        return this.core.executeAction(action);
      } else if (this.core.gkl && typeof this.core.gkl.executeAction === 'function') {
        return this.core.gkl.executeAction(action);
      }
    }
    return false;
  }

  public executeSequence(sequence: any[]) {
    if (!this.core) return false;

    const rawSeq = Array.isArray(sequence)
      ? sequence.map(item => typeof item === 'object' ? (item.key || item.letter || String(item)) : String(item))
      : [String(sequence)];

    if (typeof this.core.executeSequence === 'function') {
      return this.core.executeSequence(rawSeq);
    } else if (this.core.requestController && typeof this.core.requestController.executeSequence === 'function') {
      return this.core.requestController.executeSequence(rawSeq);
    } else if (typeof this.core.sendKey === 'function') {
      rawSeq.forEach(ch => this.core.sendKey(ch, false, false, false, ch, true));
      return true;
    }
    return false;
  }

  public getGlyphStyle(glyphId: number, options: any = {}) {
    if (this.core && typeof this.core.getGlyphStyle === 'function') {
      return this.core.getGlyphStyle(glyphId, options);
    }
    return null;
  }

  public extractDirectionCode(action: any): string {
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
  }

  public getZoomAreaTiles(radius: number = 3): Array<{ dx: number; dy: number; glyphId: number; symbol: string; color: number; nameJa: string; knowledge: any; x: number; y: number; isPlayer: boolean }> {
    const px = cursorPos() ? cursorPos()!.x : -1;
    const py = cursorPos() ? cursorPos()!.y : -1;
    const grid = mapGrid;

    const tiles: Array<any> = [];
    const gkl = this.core ? this.core.gkl : null;
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
          const gridTile = grid[ty]?.[tx];
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
  }

  public inspectTileKnowledge(x: number, y: number) {
    if (!this.core || !this.core.gkl) {
      setHoveredTileKnowledge(null);
      return;
    }

    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix < 0 || ix >= 80 || iy < 0 || iy >= 21) {
      setHoveredTileKnowledge(null);
      return;
    }

    const gkl = this.core.gkl;
    const asm = gkl ? gkl.areaStateManager : null;
    let glyphId = -1;

    if (asm && typeof asm.getGlyph === 'function') {
      glyphId = asm.getGlyph(ix, iy);
    }

    if (glyphId < 0) {
      const gridTile = mapGrid[iy]?.[ix];
      if (gridTile) glyphId = gridTile.tileId;
    }

    if (glyphId >= 0 && gkl && gkl.structuredKnowledge && typeof gkl.structuredKnowledge.getKnowledge === 'function') {
      const knowledge = gkl.structuredKnowledge.getKnowledge(glyphId);
      setHoveredTileKnowledge({ x: ix, y: iy, glyphId, knowledge });
    } else {
      setHoveredTileKnowledge(null);
    }
  }

  public async syncInventorySilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncInventorySilent === 'function') {
      await this.core.gkl.syncInventorySilent();
      setGklSituation(this.core.gkl.getSituation());
    }
  }

  public async syncSkillsSilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncSkillsSilent === 'function') {
      await this.core.gkl.syncSkillsSilent();
      setGklSituation(this.core.gkl.getSituation());
    }
  }

  public async syncSpellsSilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncSpellsSilent === 'function') {
      await this.core.gkl.syncSpellsSilent();
      setGklSituation(this.core.gkl.getSituation());
    }
  }

  public moveToCell(x: number, y: number) {
    if (this.core && this.core.gkl && typeof this.core.gkl.moveToCell === 'function') {
      return this.core.gkl.moveToCell(x, y);
    }
    return false;
  }

  public castSpell(letter: string) {
    if (this.core && this.core.gkl && typeof this.core.gkl.castSpell === 'function') {
      return this.core.gkl.castSpell(letter);
    }
    return this.executeSequence([letter]);
  }

  public enhanceSkill(skill?: any) {
    if (this.core && this.core.gkl && typeof this.core.gkl.enhanceSkill === 'function') {
      return this.core.gkl.enhanceSkill(skill);
    }
    return this.executeSequence(['#enhance']);
  }

  public getAdaptiveSpecs(knowledge: any) {
    const sm = this.core?.gkl?.skillStateManager || null;
    return getAdaptiveItemSpecs(knowledge, { skillStateManager: sm });
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    if (this.core) {
      this.core.destroy();
      this.core = null;
    }
  }
}

export { ATTRIBUTE_DEFINITIONS };
export const driverController = new NetHackDriverController();
