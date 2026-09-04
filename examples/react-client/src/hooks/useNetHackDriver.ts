import { useState, useEffect, useCallback } from 'react';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { GKLPlugin } from '@core/knowledge/GKLPlugin.js';
import { ATTRIBUTE_DEFINITIONS } from '@core/knowledge/AttributeStateManager.js';
import { getAdaptiveItemSpecs } from '@core/knowledge/ItemSpecPresenter.js';
import { useGameStore } from '../stores/gameStore';

class NetHackDriverController {
  private core: any = null;
  private nethackJsPath: string = '';
  private customListeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  public isInitialized = false;
  public currentLanguage: 'ja' | 'en' = 'ja';

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
        console.error(`[useNetHackDriver] Event listener error (${event}):`, err);
      }
    }
  }

  public init() {
    if (this.core) return;
    this.startCore();
  }

  private startCore() {
    const store = useGameStore.getState();

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
    this.currentLanguage = this.core.language || 'ja';
    store.setLanguage(this.currentLanguage);

    // GKL (Game Knowledge Layer) プラグインの自動アタッチ
    const gklPlugin = new GKLPlugin({ keyMode: 'numpad', language: this.currentLanguage });
    gklPlugin.attach(this.core);

    // 2. WebUICore イベントのバインド
    this.core.on('languageChanged', ({ language }: { language: 'ja' | 'en' }) => {
      this.currentLanguage = language || 'ja';
      useGameStore.getState().setLanguage(this.currentLanguage);
      this.emit('languageChanged', language);
    });

    this.core.on('stateChange', ({ state }: { state: string }) => {
      const s = useGameStore.getState();
      if (state === 'RUNNING' || state === 'WAITING_INPUT') {
        s.setEngineState('RUNNING');
      } else if (state === 'EXITED') {
        s.setEngineState('SAVED');
      } else if (state === 'GAME_OVER') {
        s.setEngineState('GAMEOVER');
      } else if (state === 'READY' || state === 'INITIALIZING') {
        s.setEngineState('RUNNING');
      } else {
        s.setEngineState('IDLE');
      }
    });

    this.core.on('message', (msg: string) => {
      useGameStore.getState().addMessage(msg);
    });

    this.core.on('statusUpdate', (data: any) => {
      const field = data.field;
      const value = data.value;
      useGameStore.getState().updateStatus(field, value, data);
      this.updateGklSituation();
    });

    this.core.on('cursor', ({ x, y }: { x: number; y: number }) => {
      useGameStore.getState().setCursorPos(x, y);
      this.updateGklSituation();
      this.emit('cursor', { x, y });
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      useGameStore.getState().updateTile(x, y, glyph, ch, color);
      this.emit('print_glyph', { x, y, glyph, ch, color });
    });

    this.core.on('inventoryStateUpdated', () => this.updateGklSituation());
    this.core.on('attributesStateUpdated', () => this.updateGklSituation());
    this.core.on('spellsStateUpdated', () => this.updateGklSituation());
    this.core.on('skillsStateUpdated', () => this.updateGklSituation());

    // 🎨 Visual FX 演出トリガーイベント (fx_trigger) 購読＆完全マッピング
    this.core.on('fx_trigger', (fx: any) => {
      if (!fx || !fx.type) return;
      const now = performance.now();
      const s = useGameStore.getState();

      if (fx.type === 'ATTACK_HIT') {
        s.triggerFx({
          type: 'SLASH',
          gx: fx.targetX,
          gy: fx.targetY,
          startTime: now,
          durationMs: 130,
        });
      } else if (fx.type === 'DAMAGE_TAKEN') {
        s.triggerFx({
          type: 'DAMAGE_FLASH',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          amount: fx.amount,
          startTime: now,
          durationMs: 160,
        });
        s.triggerScreenShake(3, 100);
      } else if (fx.type === 'KILL_CONFIRMED') {
        s.triggerFx({
          type: 'KILL_BURST',
          gx: fx.targetX,
          gy: fx.targetY,
          startTime: now,
          durationMs: 200,
        });
      } else if (fx.type === 'RECOVER_HEAL') {
        s.triggerFx({
          type: 'HEAL_RING',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          amount: fx.amount,
          startTime: now,
          durationMs: 250,
        });
      } else if (fx.type === 'PLAYER_DIED') {
        s.setIsPlayerDead(true);
        s.triggerScreenShake(5, 300);
        s.triggerFx({
          type: 'DEATH_BURST',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 1200,
        });
      } else if (fx.type === 'PLAYER_RESURRECTED') {
        s.setIsPlayerDead(false);
        s.triggerFx({
          type: 'HEAL_RING',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 400,
        });
      } else {
        s.triggerFx({
          ...fx,
          startTime: now,
          durationMs: fx.durationMs || 250,
        });
      }

      this.emit('fx_trigger', fx);
    });

    this.core.on('map_cleared', () => {
      useGameStore.getState().clearMapGrid();
      this.emit('map_cleared', {});
    });

    this.core.on('restarted', () => {
      if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
        this.core.gkl.reset();
      }
      useGameStore.getState().resetAllState();
      this.emit('restarted', {});
    });

    this.core.on('textWindowModal', (payload: any) => {
      const cleanTitle = payload.payload?.title || payload.title || payload.payload?.rawPrompt || 'Information / Help';
      useGameStore.getState().setTextModal({
        title: cleanTitle,
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    this.core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;
      const s = useGameStore.getState();

      // 🎯 GKL 願い（#wish）コンテキスト判定
      if (payload.subCategory === 'WISH' || (payload.assistant && payload.assistant.type === 'WISH')) {
        s.setWishData(payload);
        return;
      }

      // 1. メニューモーダル
      if (category === 'MENU' || payload.inputType === 'MENU' || context === 'select_menu') {
        s.setMenu({
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
        s.setTextModal({
          title: payload.title || payload.rawPrompt || prompt || 'Information / Help',
          lines: payload.lines || [],
          resolver: resolver,
        });
        return;
      }

      // 🎯 キャラクター作成・名前入力・ゲーム未開始プロンプト時の GKL 強制クリア
      const isCharacterCreation = category === 'ASKNAME' ||
        (typeof prompt === 'string' && (prompt.includes('Who are you?') || prompt.includes('What is your name?'))) ||
        s.status.hpMax === 0;

      if (isCharacterCreation) {
        if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
          this.core.gkl.reset();
        }
        s.setGklSituation(null);
      } else if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        s.setGklSituation(this.core.gkl.getSituation());
      }

      // 3. 通常の入力プロンプト
      s.setPrompt(payload);
    });

    this.core.on('inputResolved', () => {
      const s = useGameStore.getState();
      s.setPrompt(null);
      s.setMenu(null);
      s.setTextModal(null);
      s.setWishData(null);
    });

    this.core.on('gameOver', (result: any) => {
      const s = useGameStore.getState();
      s.setPrompt(null);
      s.setMenu(null);
      s.setTextModal(null);
      s.setWishData(null);
      s.setGameOverResult(result);

      if (result && result.reason === 'save_and_exit') {
        s.setEngineState('SAVED');
        s.addMessage('ℹ️ ゲームは正常にセーブ中断されました（再開可能です）。');
        if (this.core && typeof this.core.restart === 'function') {
          this.core.restart({ clearStorage: false, autoStart: false }).then(async () => {
            const saveInfo = await this.core.detectSavedGameInfo();
            if (saveInfo && saveInfo.hasSave) {
              s.setPendingSaveInfo(saveInfo);
            }
          }).catch((err: any) => {
            console.warn("Failed to reset core after save:", err);
          });
        }
      } else {
        s.setEngineState('GAMEOVER');
        s.setIsPlayerDead(true);
        s.triggerFx({
          type: 'DEATH_BURST',
          followPlayer: true,
          startTime: performance.now(),
          durationMs: 900,
        });
        if (result && result.deathMessage) {
          s.addMessage(`☠️ ${result.deathMessage}`);
        } else {
          s.addMessage('☠️ セーブデータがありません。ゲームオーバーです。');
        }
      }
    });

    window.removeEventListener('keydown', this.handleGlobalKeyDown.bind(this));
    window.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));

    this.core.detectSavedGameInfo().then((saveInfo: any) => {
      if (saveInfo && saveInfo.hasSave) {
        useGameStore.getState().setPendingSaveInfo(saveInfo);
        this.isInitialized = true;
        this.emit('initialized', true);
      } else {
        this.core.start(this.nethackJsPath).then(() => {
          this.isInitialized = true;
          this.emit('initialized', true);
        }).catch((err: any) => {
          console.error("WebUICore start error:", err);
        });
      }
    }).catch((err: any) => {
      console.warn("Save detection failed, starting default game:", err);
      this.core.start(this.nethackJsPath).then(() => {
        this.isInitialized = true;
        this.emit('initialized', true);
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

    const s = useGameStore.getState();
    if (s.activeTextModal || s.activeMenu) {
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
    useGameStore.getState().setPendingSaveInfo(null);
    if (this.core) {
      await this.core.start(this.nethackJsPath);
    }
  }

  public async startNewGame() {
    useGameStore.getState().setPendingSaveInfo(null);
    if (this.core) {
      await this.core.start(this.nethackJsPath, { forceNewGame: true });
    }
  }

  public async deleteSaveFile() {
    const s = useGameStore.getState();
    if (this.core) {
      if (typeof this.core.deleteSaveFile === 'function') {
        await this.core.deleteSaveFile();
      } else if (this.core.driver && typeof this.core.driver.deleteSaveFile === 'function') {
        await this.core.driver.deleteSaveFile();
      }
    }
    s.setDetectedSaveName(null);
    s.addMessage('🗑️ セーブデータを完全物理削除しました。');
  }

  public async restartGame(options: { clearStorage?: boolean; autoStart?: boolean; wasmJsUrl?: string } = { clearStorage: false }) {
    const s = useGameStore.getState();
    s.resetAllState();

    if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
      this.core.gkl.reset();
    }

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
            s.setPendingSaveInfo(saveInfo);
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
    useGameStore.getState().setPrompt(null);
    if (this.core) {
      this.core.cancelPrompt();
    }
  }

  public respondPrompt(value: any) {
    useGameStore.getState().setPrompt(null);
    if (this.core) {
      this.core.respond(value);
    }
  }

  public respondMenu(resValue: any) {
    useGameStore.getState().setMenu(null);
    if (this.core) {
      this.core.respond(resValue);
    }
  }

  public respondTextModal(val: any = ' ') {
    useGameStore.getState().setTextModal(null);
    if (this.core) {
      if (val === ' ' || val === 32 || !val) {
        this.core.sendKey('Space');
      } else {
        this.core.respond(val);
      }
    }
  }

  private updateGklSituation() {
    const s = useGameStore.getState();
    if (s.isPlayerDead || s.engineState === 'GAMEOVER' || s.status.hpMax <= 0) {
      return;
    }
    if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
      s.setGklSituation(this.core.gkl.getSituation());
    }
  }

  public executeAction(action: any) {
    if (!action || !this.core) return false;
    const rawAction = typeof action === 'object' ? JSON.parse(JSON.stringify(action)) : action;

    if (rawAction.keySequence && Array.isArray(rawAction.keySequence) && rawAction.keySequence.length > 0) {
      return this.queueSequence(rawAction.keySequence);
    }

    if (typeof this.core.executeAction === 'function') {
      return this.core.executeAction(rawAction);
    } else if (this.core.gkl && typeof this.core.gkl.executeAction === 'function') {
      return this.core.gkl.executeAction(rawAction);
    }
    return false;
  }

  public executeSequence(sequence: any[]) {
    if (!this.core) return false;

    const rawSeq = Array.isArray(sequence)
      ? sequence.map(item => {
          if (item === null || item === undefined) return '';
          if (typeof item === 'object') return item.key || item.letter || item.code || String(item);
          return item;
        })
      : [sequence];

    if (this.core.driver && typeof this.core.driver.queueSequence === 'function') {
      return this.core.driver.queueSequence(rawSeq);
    } else if (typeof this.core.sendKeySequence === 'function') {
      return this.core.sendKeySequence(rawSeq);
    } else if (typeof this.core.executeSequence === 'function') {
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

    const validDirections = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'SELF']);

    if (action.dirCode) {
      const c = String(action.dirCode).toUpperCase().replace(/^DIR_/, '');
      if (validDirections.has(c)) return c;
      if (c === 'FEET' || c === 'CURRENT' || c === 'HERE') return 'SELF';
    }

    if (action.direction) {
      const code = typeof action.direction === 'object' ? (action.direction.code || action.direction.key) : action.direction;
      if (code) {
        const c = String(code).toUpperCase().replace(/^DIR_/, '');
        if (validDirections.has(c)) return c;
      }
    }

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

    if (Array.isArray(action.keySequence)) {
      const dirToken = action.keySequence.find((t: any) => typeof t === 'string' && t.startsWith('DIR_'));
      if (dirToken) {
        const c = dirToken.replace(/^DIR_/, '').toUpperCase();
        if (validDirections.has(c)) return c;
      }
    }

    if (action.target === 'feet' || action.isDirectional === false || action.category === 'SURVIVAL') {
      return 'SELF';
    }

    if (action.id) {
      const match = action.id.match(/_([NESW]|NE|NW|SE|SW|SELF|FEET)$/);
      if (match) {
        return match[1] === 'FEET' ? 'SELF' : match[1];
      }
    }

    return 'NONE';
  }

  public getZoomAreaTiles(radius: number = 3): Array<{ dx: number; dy: number; glyphId: number; symbol: string; color: number; name?: string; nameJa: string; knowledge: any; x: number; y: number; isPlayer: boolean }> {
    const s = useGameStore.getState();
    const px = s.cursorPos ? s.cursorPos.x : -1;
    const py = s.cursorPos ? s.cursorPos.y : -1;

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
          const gridTile = s.mapGrid[ty]?.[tx];
          if (gridTile) {
            symbol = gridTile.symbol || ' ';
            color = gridTile.color;
            if (symbol === ' ' || (gridTile.tileId === 0 && !isPlayer)) {
              glyphId = -1;
              name = isEn ? 'Unexplored' : '未探索';
            } else {
              glyphId = gridTile.tileId;
            }
          }

          if (asm && typeof asm.getGlyph === 'function' && symbol !== ' ') {
            const asmGlyph = asm.getGlyph(tx, ty);
            if (asmGlyph > 0) glyphId = asmGlyph;
          }

          if (glyphId > 0 && sk && typeof sk.getKnowledge === 'function') {
            knowledge = sk.getKnowledge(glyphId);
            if (knowledge && knowledge.name) {
              name = knowledge.name;
            }
          } else if (glyphId === 0 && symbol !== ' ' && isPlayer && sk && typeof sk.getKnowledge === 'function') {
            knowledge = sk.getKnowledge(0);
            if (knowledge && knowledge.name) name = knowledge.name;
          } else if (symbol === ' ') {
            name = isEn ? 'Unexplored' : '未探索';
            knowledge = null;
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

  public async inspectTileKnowledge(x: number, y: number, isHover: boolean = true) {
    const s = useGameStore.getState();
    if (!this.core || !this.core.gkl) {
      s.setHoveredTileKnowledge(null);
      return null;
    }

    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix < 0 || ix >= 80 || iy < 0 || iy >= 21) {
      s.setHoveredTileKnowledge(null);
      return null;
    }

    const gridTile = s.mapGrid[iy]?.[ix];
    if (!gridTile || gridTile.symbol === ' ') {
      s.setHoveredTileKnowledge(null);
      return null;
    }

    const gkl = this.core.gkl;
    if (typeof gkl.inspectCellOnDemand === 'function') {
      try {
        const cardData = await gkl.inspectCellOnDemand({ x: ix, y: iy }, { isHover });
        if (cardData) {
          s.setHoveredTileKnowledge({ x: ix, y: iy, knowledge: cardData, isClickConfirmed: !isHover });
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
      s.setHoveredTileKnowledge({ x: ix, y: iy, glyphId, knowledge, isClickConfirmed: !isHover });
      return knowledge;
    } else {
      s.setHoveredTileKnowledge(null);
      return null;
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
      useGameStore.getState().setGklSituation(this.core.gkl.getSituation());
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

  public getCore() {
    return this.core;
  }

  public async queueSequence(sequence: any[], options: any = {}) {
    if (!this.core) return false;

    const rawSeq = Array.isArray(sequence)
      ? sequence.map(item => {
          if (item === null || item === undefined) return '';
          if (typeof item === 'object') return item.key || item.letter || item.code || String(item);
          return item;
        })
      : [sequence];

    const rawOptions = options ? JSON.parse(JSON.stringify(options)) : {};

    if (this.core.driver && typeof this.core.driver.queueSequence === 'function') {
      return await this.core.driver.queueSequence(rawSeq, rawOptions);
    } else if (typeof this.core.sendKeySequence === 'function') {
      return await this.core.sendKeySequence(rawSeq);
    } else if (typeof this.core.executeSequence === 'function') {
      return await this.core.executeSequence(rawSeq);
    }
    return false;
  }

  public getAdaptiveSpecs(knowledge: any) {
    const sm = this.core?.gkl?.skillStateManager || null;
    const lang = this.currentLanguage || this.core?.language || 'ja';
    return getAdaptiveItemSpecs(knowledge, { skillStateManager: sm, language: lang });
  }
}

export { ATTRIBUTE_DEFINITIONS };
export const driverController = new NetHackDriverController();

export function useNetHackDriver() {
  const [isInitialized, setIsInitialized] = useState(driverController.isInitialized);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  useEffect(() => {
    driverController.init();
    if (driverController.isInitialized) {
      setIsInitialized(true);
    } else {
      const handleInit = () => setIsInitialized(true);
      driverController.on('initialized', handleInit);
      return () => {
        driverController.off('initialized', handleInit);
      };
    }
  }, []);

  return {
    isInitialized,
    currentLanguage,
    getCore: useCallback(() => driverController.getCore(), []),
    resumeSavedGame: useCallback(() => driverController.resumeSavedGame(), []),
    startNewGame: useCallback(() => driverController.startNewGame(), []),
    deleteSaveFile: useCallback(() => driverController.deleteSaveFile(), []),
    restartGame: useCallback((options?: any) => driverController.restartGame(options), []),
    cancelPrompt: useCallback(() => driverController.cancelPrompt(), []),
    respondPrompt: useCallback((val: any) => driverController.respondPrompt(val), []),
    respondMenu: useCallback((val: any) => driverController.respondMenu(val), []),
    respondTextModal: useCallback((val?: any) => driverController.respondTextModal(val), []),
    sendAction: useCallback((act: any) => driverController.sendAction(act), []),
    executeAction: useCallback((act: any) => driverController.executeAction(act), []),
    executeSequence: useCallback((seq: any[]) => driverController.executeSequence(seq), []),
    queueSequence: useCallback((seq: any[], options?: any) => driverController.queueSequence(seq, options), []),
    getGlyphStyle: useCallback((glyphId: number, options?: any) => driverController.getGlyphStyle(glyphId, options), []),
    extractDirectionCode: useCallback((act: any) => driverController.extractDirectionCode(act), []),
    getZoomAreaTiles: useCallback((radius?: number) => driverController.getZoomAreaTiles(radius), []),
    getAdjacentAreaTiles: useCallback(() => driverController.getZoomAreaTiles(1), []),
    inspectTileKnowledge: useCallback((x: number, y: number, isHover?: boolean) => driverController.inspectTileKnowledge(x, y, isHover), []),
    syncInventorySilent: useCallback(() => driverController.syncInventorySilent(), []),
    syncSkillsSilent: useCallback(() => driverController.syncSkillsSilent(), []),
    syncSpellsSilent: useCallback(() => driverController.syncSpellsSilent(), []),
    moveToCell: useCallback((x: number, y: number) => driverController.moveToCell(x, y), []),
    castSpell: useCallback((letter: string) => driverController.castSpell(letter), []),
    enhanceSkill: useCallback((skill?: any) => driverController.enhanceSkill(skill), []),
    travelTo: useCallback((x: number, y: number) => driverController.travelTo(x, y), []),
    openItemActionMenu: useCallback((letter: string) => driverController.openItemActionMenu(letter), []),
    driverController,
    on: useCallback((event: string, fn: (...args: any[]) => void) => driverController.on(event, fn), []),
    off: useCallback((event: string, fn: (...args: any[]) => void) => driverController.off(event, fn), []),
    getAdaptiveSpecs: useCallback((knowledge: any) => driverController.getAdaptiveSpecs(knowledge), []),
  };
}
