import { writable, get } from 'svelte/store';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { GKLPlugin } from '@core/knowledge/GKLPlugin.js';
import { getAdaptiveItemSpecs } from '@core/knowledge/ItemSpecPresenter.js';
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
  pendingSaveInfoStore,
  isPlayerDeadStore,
  gameOverResultStore,
  gklSituationStore,
  hoveredTileKnowledgeStore,
  floorLandmarksStore,
  activeWishDataStore,
  triggerFx,
  triggerScreenShake,
  resetAllState,
  cursorPosStore,
  mapGridStore,
} from '../stores/gameStore';

export const currentLanguageStore = writable<'ja' | 'en'>('ja');

export class NetHackDriverController {
  private core: any = null;
  private nethackJsPath: string = '';
  private isInitialized = false;
  private customListeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  public on(event: string, fn: (...args: any[]) => void) {
    if (!this.customListeners.has(event)) this.customListeners.set(event, []);
    this.customListeners.get(event)!.push(fn);
  }

  public off(event: string, fn: (...args: any[]) => void) {
    if (!this.customListeners.has(event)) return;
    const list = this.customListeners.get(event)!;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  public emit(event: string, ...args: any[]) {
    if (!this.customListeners.has(event)) return;
    for (const fn of this.customListeners.get(event)!) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[Svelte useNetHackDriver] Event error (${event}):`, err);
      }
    }
  }

  public sendAction = (action: any) => {
    if (this.core && typeof this.core.sendAction === 'function') {
      this.core.sendAction(action);
    } else if (this.core && typeof this.core.respond === 'function') {
      this.core.respond(action);
    }
  };

  public cancelPrompt = () => {
    if (this.core) {
      activePromptStore.set(null);
      this.core.cancelPrompt();
    }
  };

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
    if (this.core) {
      if (typeof this.core.deleteSaveFile === 'function') {
        await this.core.deleteSaveFile();
      } else if (this.core.driver && typeof this.core.driver.deleteSaveFile === 'function') {
        await this.core.driver.deleteSaveFile();
      }
    }
    detectedSaveNameStore.set(null);
    addMessage('🗑️ セーブデータを完全物理削除しました。');
  };

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    const activeMenu = get(activeMenuStore);
    const activeTextModal = get(activeTextModalStore);
    const activeWish = get(activeWishDataStore);
    const pendingSave = get(pendingSaveInfoStore);
    const engineState = get(engineStateStore);
    const gameOverResult = get(gameOverResultStore);

    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (
      activeMenu ||
      activeTextModal ||
      activeWish ||
      pendingSave ||
      engineState === 'GAMEOVER' ||
      gameOverResult
    ) {
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
    const initialLang = this.core.language || 'ja';
    currentLanguageStore.set(initialLang);

    // GKL (Game Knowledge Layer) プラグインの自動アタッチ
    const gklPlugin = new GKLPlugin({ keyMode: 'numpad', language: initialLang });
    gklPlugin.attach(this.core);

    this.core.on('languageChanged', ({ language }: { language: 'ja' | 'en' }) => {
      currentLanguageStore.set(language || 'ja');
    });

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
      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        const sit = this.core.gkl.getSituation();
        gklSituationStore.set(sit);
      }
      this.emit('cursor', { x, y });
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      updateTile(x, y, glyph, ch, color);
      this.emit('print_glyph', { x, y, glyph, ch, color });
    });

    const updateGklSituation = () => {
      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        const sit = this.core.gkl.getSituation();
        gklSituationStore.set(sit);
        if (sit?.area?.landmarks) {
          floorLandmarksStore.set(sit.area.landmarks);
        }
      }
    };

    this.core.on('inventoryStateUpdated', updateGklSituation);
    this.core.on('attributesStateUpdated', updateGklSituation);
    this.core.on('spellsStateUpdated', updateGklSituation);
    this.core.on('skillsStateUpdated', updateGklSituation);
    this.core.on('landmarksUpdated', (landmarks: any) => {
      floorLandmarksStore.set(landmarks);
    });

    // 🎨 Visual FX & 画面振動イベントの処理
    this.core.on('fx_trigger', (fx: any) => {
      const now = performance.now();
      if (fx.type === 'SCREEN_SHAKE') {
        triggerScreenShake(fx.intensity || 3, fx.durationMs || 100);
      } else if (fx.type === 'PLAYER_DIED') {
        isPlayerDeadStore.set(true);
        triggerScreenShake(8, 600);
        triggerFx({
          type: 'DEATH_BURST',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 1200,
        });
      } else if (fx.type === 'PLAYER_RESURRECTED') {
        isPlayerDeadStore.set(false);
        triggerFx({
          type: 'HEAL_RING',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 400,
        });
      } else {
        triggerFx({
          ...fx,
          startTime: now,
          durationMs: fx.durationMs || 250,
        });
      }

      this.emit('fx_trigger', fx);
    });

    this.core.on('map_cleared', () => {
      clearMapGrid();
      this.emit('map_cleared', {});
    });

    this.core.on('restarted', () => {
      if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
        this.core.gkl.reset();
      }
      resetAllState();
      this.emit('restarted', {});
    });

    this.core.on('textWindowModal', (payload: any) => {
      activeTextModalStore.set({
        title: payload.payload?.title || payload.title || payload.payload?.rawPrompt || 'Information / Help',
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    this.core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;

      // 🎯 GKL 願い（#wish）コンテキスト判定
      if (payload.subCategory === 'WISH' || (payload.assistant && payload.assistant.type === 'WISH')) {
        activeWishDataStore.set(payload);
        return;
      }

      if (category === 'MENU' || payload.inputType === 'MENU' || context === 'select_menu') {
        activeMenuStore.set({
          windowId: payload.windowId || 1,
          prompt: payload.promptText || prompt || 'Select item:',
          items: payload.options || items || payload.menuItems || [],
          resolver: resolver,
          how: payload.how !== undefined ? payload.how : 1,
        });
        return;
      }

      if (category === 'FILE') {
        activeTextModalStore.set({
          title: payload.title || payload.rawPrompt || prompt || 'Information / Help',
          lines: payload.lines || [],
          resolver: resolver,
        });
        return;
      }

      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        gklSituationStore.set(this.core.gkl.getSituation());
      }

      activePromptStore.set(payload);
    });

    this.core.on('inputResolved', () => {
      activePromptStore.set(null);
      activeMenuStore.set(null);
      activeTextModalStore.set(null);
      activeWishDataStore.set(null);
    });

    this.core.on('gameOver', (result: any) => {
      activePromptStore.set(null);
      activeMenuStore.set(null);
      activeTextModalStore.set(null);
      activeWishDataStore.set(null);
      gameOverResultStore.set(result);

      if (result && result.reason === 'save_and_exit') {
        engineStateStore.set('SAVED');
        addMessage('ℹ️ ゲームは正常にセーブ中断されました（再開可能です）。');
        // セーブ終了後はセーブデータを保持したまま待機し、選択モーダルを表示
        if (this.core && typeof this.core.restart === 'function') {
          this.core.restart({ clearStorage: false, autoStart: false }).then(async () => {
            const saveInfo = await this.core.detectSavedGameInfo();
            if (saveInfo && saveInfo.hasSave) {
              pendingSaveInfoStore.set(saveInfo);
            }
          }).catch((err: any) => {
            console.warn("Failed to reset core after save:", err);
          });
        }
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

    this.core.detectSavedGameInfo().then((saveInfo: any) => {
      if (saveInfo && saveInfo.hasSave) {
        pendingSaveInfoStore.set(saveInfo);
      } else {
        this.core.start(this.nethackJsPath).catch((err: any) => {
          console.error("Svelte client WebUICore start error:", err);
        });
      }
    }).catch((err: any) => {
      console.warn("Save detection failed, starting default game:", err);
      this.core.start(this.nethackJsPath).catch((startErr: any) => {
        console.error("Svelte client WebUICore start error:", startErr);
      });
    });
  }

  public async resumeSavedGame() {
    pendingSaveInfoStore.set(null);
    if (this.core) {
      await this.core.start(this.nethackJsPath);
    }
  }

  public async startNewGame() {
    pendingSaveInfoStore.set(null);
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
            pendingSaveInfoStore.set(saveInfo);
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

  public getCore() {
    return this.core;
  }

  public extractDirectionCode(action: any): string {
    if (!action) return 'NONE';
    if (action.directionCode) return action.directionCode;
    if (action.dirCode) return String(action.dirCode).toUpperCase().replace(/^DIR_/, '');
    return action.isDirectional === false ? 'SELF' : 'NONE';
  }

  public sendWish(wishText: string) {
    if (!wishText) {
      this.cancelWish();
      return;
    }
    activeWishDataStore.set(null);
    if (this.core && typeof this.core.respond === 'function') {
      this.core.respond(wishText);
    }
  }

  public cancelWish() {
    activeWishDataStore.set(null);
    if (this.core && typeof this.core.cancelPrompt === 'function') {
      this.core.cancelPrompt();
    }
  }

  public async travelToLandmark(landmark: any) {
    if (!landmark || landmark.x === undefined || landmark.y === undefined) return;
    return await this.travelTo(landmark.x, landmark.y);
  }

  public getGlyphStyle(glyphId: number, options: any = {}) {
    if (this.core && typeof this.core.getGlyphStyle === 'function') {
      return this.core.getGlyphStyle(glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 28, ...options });
    }
    return null;
  }

  public getGlyphStyleString(glyphId: number, options: any = {}): string {
    const styleObj = this.getGlyphStyle(glyphId, options);
    if (!styleObj) return '';
    return Object.entries(styleObj)
      .map(([k, v]) => {
        const kebabKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebabKey}:${v}`;
      })
      .join(';');
  }

  public async inspectTileKnowledge(x: number, y: number, isHover: boolean = true) {
    if (!this.core || !this.core.gkl) {
      hoveredTileKnowledgeStore.set(null);
      return null;
    }

    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix < 0 || ix >= 80 || iy < 0 || iy >= 21) {
      hoveredTileKnowledgeStore.set(null);
      return null;
    }

    const grid = get(mapGridStore);
    const gridTile = grid[iy]?.[ix];
    if (!gridTile || gridTile.symbol === ' ') {
      hoveredTileKnowledgeStore.set(null);
      return null;
    }

    const gkl = this.core.gkl;
    if (typeof gkl.inspectCellOnDemand === 'function') {
      try {
        const cardData = await gkl.inspectCellOnDemand({ x: ix, y: iy }, { isHover });
        if (cardData) {
          hoveredTileKnowledgeStore.set({ x: ix, y: iy, knowledge: cardData, isClickConfirmed: !isHover });
          return cardData;
        }
      } catch (err) {
        console.warn("[inspectTileKnowledge] onDemand inspect error:", err);
      }
    }

    const asm = gkl ? gkl.areaStateManager : null;
    let glyphId = -1;

    if (asm && typeof asm.getGlyph === 'function') {
      const g = asm.getGlyph(ix, iy);
      if (g > 0) glyphId = g;
    }

    if (glyphId <= 0 && gridTile && gridTile.tileId > 0) {
      glyphId = gridTile.tileId;
    }

    if (glyphId > 0 && gkl && gkl.structuredKnowledge && typeof gkl.structuredKnowledge.getKnowledge === 'function') {
      const knowledge = gkl.structuredKnowledge.getKnowledge(glyphId);
      hoveredTileKnowledgeStore.set({ x: ix, y: iy, glyphId, knowledge, isClickConfirmed: !isHover });
      return knowledge;
    } else {
      hoveredTileKnowledgeStore.set(null);
      return null;
    }
  }

  public async syncInventorySilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncInventorySilent === 'function') {
      await this.core.gkl.syncInventorySilent();
      gklSituationStore.set(this.core.gkl.getSituation());
    }
  }

  public async syncSkillsSilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncSkillsSilent === 'function') {
      await this.core.gkl.syncSkillsSilent();
      gklSituationStore.set(this.core.gkl.getSituation());
    }
  }

  public async syncSpellsSilent() {
    if (this.core && this.core.gkl && typeof this.core.gkl.syncSpellsSilent === 'function') {
      await this.core.gkl.syncSpellsSilent();
      gklSituationStore.set(this.core.gkl.getSituation());
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

  public async travelTo(x: number, y: number) {
    if (this.core && this.core.gkl && typeof this.core.gkl.travelTo === 'function') {
      return await this.core.gkl.travelTo({ x, y });
    }
    if (this.core && typeof this.core.executeSequence === 'function') {
      return await this.core.executeSequence(['_', `${x},${y}`, 'Enter']);
    }
    return false;
  }

  public async openItemActionMenu(letter: string) {
    if (!this.core || !letter) return;
    if (this.core.driver && typeof this.core.driver.queueSequence === 'function') {
      await this.core.driver.queueSequence(['i', letter], { isSilentSync: true });
    } else if (typeof this.core.executeSequence === 'function') {
      await this.core.executeSequence(['i', letter]);
    }
  }

  public getAdaptiveSpecs(knowledge: any) {
    const sm = this.core?.gkl?.skillStateManager || null;
    const lang = get(currentLanguageStore) || this.core?.language || 'ja';
    return getAdaptiveItemSpecs(knowledge, { skillStateManager: sm, language: lang });
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

