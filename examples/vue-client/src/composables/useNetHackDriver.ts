import { ref, onMounted } from 'vue';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { GKLPlugin } from '@core/knowledge/GKLPlugin.js';
import { ATTRIBUTE_DEFINITIONS } from '@core/knowledge/AttributeStateManager.js';
import { getAdaptiveItemSpecs } from '@core/knowledge/ItemSpecPresenter.js';
import { useGameStore } from '../stores/gameStore';

class NetHackDriverController {
  private core: any = null;
  private nethackJsPath: string = '';
  public isInitialized = ref(false);
  public currentLanguage = ref<'ja' | 'en'>('ja');

  public init() {
    if (this.core) return;
    this.startCore();
  }

  private startCore() {
    const gameStore = useGameStore();

    const workerPath = import.meta.env.PROD
      ? './src/driver/nethack.worker.js'
      : '/src/driver/nethack.worker.js';

    this.nethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    // 1. Worker ブリッジおよび WebUICore の生成
    const driver = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });

    this.core = new WebUICore({ driver });
    this.currentLanguage.value = this.core.language || 'ja';

    // GKL (Game Knowledge Layer) プラグインの自動アタッチ
    const gklPlugin = new GKLPlugin({ keyMode: 'numpad', language: this.currentLanguage.value });
    gklPlugin.attach(this.core);

    // 2. WebUICore イベントのバインド
    this.core.on('languageChanged', ({ language }: { language: 'ja' | 'en' }) => {
      this.currentLanguage.value = language || 'ja';
    });
    this.core.on('stateChange', ({ state }: { state: string }) => {
      if (state === 'RUNNING' || state === 'WAITING_INPUT') {
        gameStore.setEngineState('RUNNING');
      } else if (state === 'EXITED') {
        gameStore.setEngineState('SAVED');
      } else if (state === 'GAME_OVER') {
        gameStore.setEngineState('GAMEOVER');
      } else if (state === 'READY' || state === 'INITIALIZING') {
        gameStore.setEngineState('RUNNING');
      } else {
        gameStore.setEngineState('IDLE');
      }
    });

    this.core.on('message', (msg: string) => {
      gameStore.addMessage(msg);
    });

    this.core.on('statusUpdate', (data: any) => {
      const field = data.field;
      const value = data.value;
      gameStore.updateStatus(field, value, data);
    });

    this.core.on('cursor', ({ x, y }: { x: number; y: number }) => {
      gameStore.setCursorPos(x, y);
      this.updateGklSituation();
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      gameStore.updateTile(x, y, glyph, ch, color);
    });

    this.core.on('inventoryStateUpdated', () => {
      this.updateGklSituation();
    });

    this.core.on('map_cleared', () => {
      gameStore.clearMapGrid();
    });

    this.core.on('restarted', () => {
      gameStore.resetAllState();
    });

    this.core.on('textWindowModal', (payload: any) => {
      const cleanTitle = payload.payload?.title || payload.title || payload.payload?.rawPrompt || 'Information / Help';
      gameStore.setTextModal({
        title: cleanTitle,
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    this.core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;

      // 1. メニューモーダル
      if (category === 'MENU' || payload.inputType === 'MENU' || context === 'select_menu') {
        gameStore.setMenu({
          windowId: payload.windowId || 1,
          prompt: payload.promptText || prompt || 'Select item:',
          items: payload.options || items || payload.menuItems || [],
          resolver: resolver,
          how: payload.how !== undefined ? payload.how : 1,
        } as any);
        return;
      }

      // 2. ヘルプファイル閲覧モーダル (FILE カテゴリ専用)
      if (category === 'FILE') {
        gameStore.setTextModal({
          title: payload.title || payload.rawPrompt || prompt || 'Information / Help',
          lines: payload.lines || [],
          resolver: resolver,
        });
        return;
      }

      // GKL (Game Knowledge Layer) 状況の同期更新 (core.gkl.getSituation())
      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        const situation = this.core.gkl.getSituation();
        gameStore.setGklSituation(situation);
      }

      // 3. 通常の入力プロンプト (WebUICore の最新構造化 payload をそのまま伝達)
      gameStore.setPrompt(payload);
    });

    this.core.on('inputResolved', () => {
      gameStore.setPrompt(null);
      gameStore.setMenu(null);
      gameStore.setTextModal(null);
    });

    this.core.on('gameOver', (result: any) => {
      gameStore.setPrompt(null);
      gameStore.setMenu(null);
      gameStore.setTextModal(null);
      gameStore.setGameOverResult(result);

      if (result && result.reason === 'save_and_exit') {
        gameStore.setEngineState('SAVED');
        gameStore.addMessage('ℹ️ ゲームは正常にセーブ中断されました（再開可能です）。');
        // セーブ終了後はセーブデータを保持したまま待機し、選択モーダルを表示
        if (this.core && typeof this.core.restart === 'function') {
          this.core.restart({ clearStorage: false, autoStart: false }).then(async () => {
            const saveInfo = await this.core.detectSavedGameInfo();
            if (saveInfo && saveInfo.hasSave) {
              gameStore.setPendingSaveInfo(saveInfo);
            }
          }).catch((err: any) => {
            console.warn("Failed to reset core after save:", err);
          });
        }
      } else {
        gameStore.setEngineState('GAMEOVER');
        if (result && result.deathMessage) {
          gameStore.addMessage(`☠️ ${result.deathMessage}`);
        } else {
          gameStore.addMessage('☠️ セーブデータがありません。ゲームオーバーです。');
        }
      }
    });

    window.removeEventListener('keydown', this.handleGlobalKeyDown.bind(this));
    window.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));

    this.core.detectSavedGameInfo().then((saveInfo: any) => {
      if (saveInfo && saveInfo.hasSave) {
        gameStore.setPendingSaveInfo(saveInfo);
        this.isInitialized.value = true;
      } else {
        this.core.start(this.nethackJsPath).then(() => {
          this.isInitialized.value = true;
        }).catch((err: any) => {
          console.error("WebUICore start error:", err);
        });
      }
    }).catch((err: any) => {
      console.warn("Save detection failed, starting default game:", err);
      this.core.start(this.nethackJsPath).then(() => {
        this.isInitialized.value = true;
      }).catch((startErr: any) => {
        console.error("WebUICore start error:", startErr);
      });
    });
  }

  private handleGlobalKeyDown(e: KeyboardEvent) {
    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }

    const gameStore = useGameStore();
    if (gameStore.activeTextModal || gameStore.activeMenu) {
      return;
    }

    if (this.core) {
      this.core.sendKeyEvent(e);
    }
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown.bind(this));
    if (this.core) {
      this.core.destroy();
      this.core = null;
    }
  }

  public async resumeSavedGame() {
    const gameStore = useGameStore();
    gameStore.setPendingSaveInfo(null);
    if (this.core) {
      await this.core.start(this.nethackJsPath);
    }
  }

  public async startNewGame() {
    const gameStore = useGameStore();
    gameStore.setPendingSaveInfo(null);
    if (this.core) {
      await this.core.start(this.nethackJsPath, { forceNewGame: true });
    }
  }

  public async deleteSaveFile() {
    const gameStore = useGameStore();
    if (this.core) {
      if (typeof this.core.deleteSaveFile === 'function') {
        await this.core.deleteSaveFile();
      } else if (this.core.driver && typeof this.core.driver.deleteSaveFile === 'function') {
        await this.core.driver.deleteSaveFile();
      }
    }
    gameStore.setDetectedSaveName(null);
    gameStore.addMessage('🗑️ セーブデータを完全物理削除しました。');
  }

  public async restartGame(options: { clearStorage?: boolean; autoStart?: boolean; wasmJsUrl?: string } = { clearStorage: false }) {
    const gameStore = useGameStore();
    gameStore.resetAllState();

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
            gameStore.setPendingSaveInfo(saveInfo);
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

  public cancelPrompt() {
    const gameStore = useGameStore();
    gameStore.setPrompt(null);
    if (this.core) {
      this.core.cancelPrompt();
    }
  }

  public respondPrompt(value: any) {
    const gameStore = useGameStore();
    gameStore.setPrompt(null);
    if (this.core) {
      this.core.respond(value);
    }
  }

  public respondMenu(resValue: any) {
    const gameStore = useGameStore();
    gameStore.setMenu(null);
    if (this.core) {
      this.core.respond(resValue);
    }
  }

  public respondTextModal(val: any = ' ') {
    const gameStore = useGameStore();
    gameStore.setTextModal(null);
    if (this.core) {
      if (val === ' ' || val === 32 || !val) {
        this.core.sendKey('Space');
      } else {
        this.core.respond(val);
      }
    }
  }
  private updateGklSituation() {
    if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
      const gameStore = useGameStore();
      gameStore.setGklSituation(this.core.gkl.getSituation());
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

    // Vue 3 Proxy の解除と純粋な文字列配列化
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

  public getZoomAreaTiles(radius: number = 3): Array<{ dx: number; dy: number; glyphId: number; symbol: string; color: number; name?: string; nameJa: string; knowledge: any; x: number; y: number; isPlayer: boolean }> {
    const gameStore = useGameStore();
    const px = gameStore.cursorPos ? gameStore.cursorPos.x : -1;
    const py = gameStore.cursorPos ? gameStore.cursorPos.y : -1;

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
        let knowledge = null;
        const isEn = (this.core && this.core.language === 'en');
        let name = isEn ? 'Out of Sight' : '視界外';

        if (px >= 0 && py >= 0 && tx >= 0 && tx < 80 && ty >= 0 && ty < 21) {
          const gridTile = gameStore.mapGrid[ty]?.[tx];
          if (gridTile) {
            symbol = gridTile.symbol || ' ';
            color = gridTile.color;
            if (gridTile.tileId === 0 && symbol === ' ') {
              glyphId = -1;
              name = isEn ? 'Unexplored' : '未探索';
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
              name = knowledge.name;
            }
          } else if (glyphId === 0 && symbol !== ' ' && sk && typeof sk.getKnowledge === 'function') {
            knowledge = sk.getKnowledge(0);
            if (knowledge && knowledge.name) name = knowledge.name;
          } else if (symbol === ' ') {
            name = isEn ? 'Unexplored' : '未探索';
          }
        }

        tiles.push({
          dx,
          dy,
          glyphId,
          symbol,
          color,
          name,
          nameJa: name,
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
    const gameStore = useGameStore();
    if (!this.core || !this.core.gkl) {
      gameStore.setHoveredTileKnowledge(null);
      return;
    }

    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix < 0 || ix >= 80 || iy < 0 || iy >= 21) {
      gameStore.setHoveredTileKnowledge(null);
      return;
    }

    const gkl = this.core.gkl;
    const asm = gkl ? gkl.areaStateManager : null;
    let glyphId = -1;

    if (asm && typeof asm.getGlyph === 'function') {
      glyphId = asm.getGlyph(ix, iy);
    }

    if (glyphId < 0) {
      const gridTile = gameStore.mapGrid[iy]?.[ix];
      if (gridTile) glyphId = gridTile.tileId;
    }

    if (glyphId >= 0 && gkl && gkl.structuredKnowledge && typeof gkl.structuredKnowledge.getKnowledge === 'function') {
      const knowledge = gkl.structuredKnowledge.getKnowledge(glyphId);
      gameStore.setHoveredTileKnowledge({ x: ix, y: iy, glyphId, knowledge });
    } else {
      gameStore.setHoveredTileKnowledge(null);
    }
  }

  public sendAction(action: string | any) {
    if (this.core && typeof this.core.sendAction === 'function') {
      this.core.sendAction(action);
    } else if (this.core && typeof this.core.respond === 'function') {
      this.core.respond(action);
    }
  }

  public async syncInventorySilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncInventorySilent === 'function') {
      await this.core.gkl.syncInventorySilent();
      const gameStore = useGameStore();
      gameStore.setGklSituation(this.core.gkl.getSituation());
    }
  }

  public async syncSkillsSilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncSkillsSilent === 'function') {
      await this.core.gkl.syncSkillsSilent();
      this.updateGklSituation();
    }
  }

  public async syncSpellsSilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncSpellsSilent === 'function') {
      await this.core.gkl.syncSpellsSilent();
      this.updateGklSituation();
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
    return this.executeSequence(['Z', letter]);
  }

  public enhanceSkill(skill?: any) {
    if (this.core && this.core.gkl && typeof this.core.gkl.enhanceSkill === 'function') {
      return this.core.gkl.enhanceSkill(skill);
    }
    return this.executeSequence(['#enhance']);
  }

  public getAdaptiveSpecs(knowledge: any) {
    const sm = this.core?.gkl?.skillStateManager || null;
    const lang = this.currentLanguage.value || this.core?.language || 'ja';
    return getAdaptiveItemSpecs(knowledge, { skillStateManager: sm, language: lang });
  }
}

export { ATTRIBUTE_DEFINITIONS };
export const driverController = new NetHackDriverController();

export function useNetHackDriver() {
  onMounted(() => {
    driverController.init();
  });

  return {
    isInitialized: driverController.isInitialized,
    currentLanguage: driverController.currentLanguage,
    resumeSavedGame: () => driverController.resumeSavedGame(),
    startNewGame: () => driverController.startNewGame(),
    deleteSaveFile: () => driverController.deleteSaveFile(),
    restartGame: (options?: any) => driverController.restartGame(options),
    cancelPrompt: () => driverController.cancelPrompt(),
    respondPrompt: (val: any) => driverController.respondPrompt(val),
    respondMenu: (val: any) => driverController.respondMenu(val),
    respondTextModal: (val?: any) => driverController.respondTextModal(val),
    sendAction: (act: any) => driverController.sendAction(act),
    executeAction: (act: any) => driverController.executeAction(act),
    executeSequence: (seq: any[]) => driverController.executeSequence(seq),
    getGlyphStyle: (glyphId: number, options?: any) => driverController.getGlyphStyle(glyphId, options),
    extractDirectionCode: (act: any) => driverController.extractDirectionCode(act),
    getZoomAreaTiles: (radius?: number) => driverController.getZoomAreaTiles(radius),
    getAdjacentAreaTiles: () => driverController.getZoomAreaTiles(1),
    inspectTileKnowledge: (x: number, y: number) => driverController.inspectTileKnowledge(x, y),
    syncInventorySilent: () => driverController.syncInventorySilent(),
    syncSkillsSilent: () => driverController.syncSkillsSilent(),
    syncSpellsSilent: () => driverController.syncSpellsSilent(),
    moveToCell: (x: number, y: number) => driverController.moveToCell(x, y),
    castSpell: (letter: string) => driverController.castSpell(letter),
    enhanceSkill: (skill?: any) => driverController.enhanceSkill(skill),
    getAdaptiveSpecs: (knowledge: any) => driverController.getAdaptiveSpecs(knowledge),
  };
}
