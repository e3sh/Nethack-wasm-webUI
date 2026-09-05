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
  activePrompt,
  setActivePrompt,
  activeMenu,
  setActiveMenu,
  activeTextModal,
  setActiveTextModal,
  setEngineState,
  setDetectedSaveName,
  setPendingSaveInfo,
  setIsPlayerDead,
  setGameOverResult,
  setGklSituation,
  setHoveredTileKnowledge,
  setFloorLandmarks,
  setActiveWishData,
  triggerFx,
  triggerScreenShake,
  setCurrentLanguage,
  resetAllState,
  cursorPos,
  mapGrid,
} from '../stores/gameStore';

export class NetHackDriverController {
  private core: any = null;
  private nethackJsPath: string = '';
  private isInitialized = false;
  public currentLanguage: 'ja' | 'en' = 'ja';
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
        console.error(`[Solid useNetHackDriver] Event error (${event}):`, err);
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
    this.currentLanguage = this.core.language || 'ja';
    setCurrentLanguage(this.currentLanguage);

    // GKL (Game Knowledge Layer) プラグインの自動アタッチ
    const gklPlugin = new GKLPlugin({ keyMode: 'numpad', language: this.currentLanguage });
    gklPlugin.attach(this.core);

    // 2. WebUICore イベントのバインド
    this.core.on('languageChanged', ({ language }: { language: 'ja' | 'en' }) => {
      this.currentLanguage = language || 'ja';
      setCurrentLanguage(this.currentLanguage);
    });

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
      if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        setGklSituation(this.core.gkl.getSituation());
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
        setGklSituation(sit);
        if (sit?.area?.landmarks) {
          setFloorLandmarks(sit.area.landmarks);
        }
      }
    };

    this.core.on('inventoryStateUpdated', updateGklSituation);
    this.core.on('attributesStateUpdated', updateGklSituation);
    this.core.on('spellsStateUpdated', updateGklSituation);
    this.core.on('skillsStateUpdated', updateGklSituation);
    this.core.on('landmarksUpdated', (landmarks: any) => {
      setFloorLandmarks(landmarks);
    });

    // 🎨 Visual FX & 画面振動イベントの処理
    this.core.on('fx_trigger', (fx: any) => {
      const now = performance.now();
      if (fx.type === 'SCREEN_SHAKE') {
        triggerScreenShake(fx.intensity || 3, fx.durationMs || 100);
      } else if (fx.type === 'PLAYER_DIED') {
        setIsPlayerDead(true);
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
        setIsPlayerDead(false);
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
      setActiveTextModal({
        title: payload.payload?.title || payload.title || payload.payload?.rawPrompt || 'Information / Help',
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    this.core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;

      // 🎯 GKL 願い（#wish）コンテキスト判定
      if (payload.subCategory === 'WISH' || (payload.assistant && payload.assistant.type === 'WISH')) {
        setActiveWishData(payload);
        return;
      }

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

      if (category === 'FILE') {
        setActiveTextModal({
          title: payload.title || payload.rawPrompt || prompt || 'Information / Help',
          lines: payload.lines || [],
          resolver: resolver,
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
      setActiveWishData(null);
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
    if (!wishText) return;
    setActiveWishData(null);
    if (this.core && typeof this.core.respond === 'function') {
      this.core.respond(wishText);
    }
  }

  public cancelWish() {
    setActiveWishData(null);
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
      setHoveredTileKnowledge(null);
      return null;
    }

    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix < 0 || ix >= 80 || iy < 0 || iy >= 21) {
      setHoveredTileKnowledge(null);
      return null;
    }

    const gridTile = mapGrid[iy]?.[ix];
    if (!gridTile || gridTile.symbol === ' ') {
      setHoveredTileKnowledge(null);
      return null;
    }

    const gkl = this.core.gkl;
    if (typeof gkl.inspectCellOnDemand === 'function') {
      try {
        const cardData = await gkl.inspectCellOnDemand({ x: ix, y: iy }, { isHover });
        if (cardData) {
          setHoveredTileKnowledge({ x: ix, y: iy, knowledge: cardData, isClickConfirmed: !isHover });
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
      setHoveredTileKnowledge({ x: ix, y: iy, glyphId, knowledge, isClickConfirmed: !isHover });
      return knowledge;
    } else {
      setHoveredTileKnowledge(null);
      return null;
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
    const lang = this.currentLanguage || this.core?.language || 'ja';
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
