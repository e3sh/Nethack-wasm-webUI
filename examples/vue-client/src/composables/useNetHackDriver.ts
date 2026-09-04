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
  private customListeners: Map<string, Array<(...args: any[]) => void>> = new Map();
  public isInitialized = ref(false);
  public currentLanguage = ref<'ja' | 'en'>('ja');

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
      this.updateGklSituation();
    });

    this.core.on('cursor', ({ x, y }: { x: number; y: number }) => {
      gameStore.setCursorPos(x, y);
      this.updateGklSituation();
      this.emit('cursor', { x, y });
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      gameStore.updateTile(x, y, glyph, ch, color);
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

      if (fx.type === 'ATTACK_HIT') {
        gameStore.triggerFx({
          type: 'SLASH',
          gx: fx.targetX,
          gy: fx.targetY,
          startTime: now,
          durationMs: 130
        });
      } else if (fx.type === 'DAMAGE_TAKEN') {
        gameStore.triggerFx({
          type: 'DAMAGE_FLASH',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          amount: fx.amount,
          startTime: now,
          durationMs: 160
        });
        gameStore.triggerScreenShake(3, 100);
      } else if (fx.type === 'KILL_CONFIRMED') {
        gameStore.triggerFx({
          type: 'KILL_BURST',
          gx: fx.targetX,
          gy: fx.targetY,
          startTime: now,
          durationMs: 200
        });
      } else if (fx.type === 'RECOVER_HEAL') {
        gameStore.triggerFx({
          type: 'HEAL_RING',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          amount: fx.amount,
          startTime: now,
          durationMs: 250
        });
      } else if (fx.type === 'PLAYER_DIED') {
        gameStore.setIsPlayerDead(true);
        gameStore.triggerScreenShake(5, 300);
        gameStore.triggerFx({
          type: 'DEATH_BURST',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 1200
        });
      } else if (fx.type === 'PLAYER_RESURRECTED') {
        gameStore.setIsPlayerDead(false);
        gameStore.triggerFx({
          type: 'HEAL_RING',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 400
        });
      } else {
        // 直接渡された FX
        gameStore.triggerFx({
          ...fx,
          startTime: now,
          durationMs: fx.durationMs || 250
        });
      }

      this.emit('fx_trigger', fx);
    });

    this.core.on('map_cleared', () => {
      gameStore.clearMapGrid();
      this.emit('map_cleared', {});
    });

    this.core.on('restarted', () => {
      if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
        this.core.gkl.reset();
      }
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

      // 🎯 GKL 願い（#wish）コンテキスト判定
      if (payload.subCategory === 'WISH' || (payload.assistant && payload.assistant.type === 'WISH')) {
        gameStore.setWishData(payload);
        return;
      }

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

      // 🎯 キャラクター作成・名前入力・ゲーム未開始プロンプト時の GKL 強制クリア
      const isCharacterCreation = category === 'ASKNAME' ||
        (typeof prompt === 'string' && (prompt.includes('Who are you?') || prompt.includes('What is your name?'))) ||
        gameStore.status.hpMax === 0;

      if (isCharacterCreation) {
        if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
          this.core.gkl.reset();
        }
        gameStore.setGklSituation(null);
      } else if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
        // GKL (Game Knowledge Layer) 状況の同期更新
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
      gameStore.setWishData(null);
    });

    this.core.on('gameOver', (result: any) => {
      gameStore.setPrompt(null);
      gameStore.setMenu(null);
      gameStore.setTextModal(null);
      gameStore.setWishData(null);
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
        gameStore.setIsPlayerDead(true);
        // 死亡エフェクトを即座に自キャラ位置に発火
        gameStore.triggerFx({
          type: 'DEATH_BURST',
          followPlayer: true,
          startTime: performance.now(),
          durationMs: 900
        });
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
    const gameStore = useGameStore();
    if (gameStore.isPlayerDead || gameStore.engineState === 'GAMEOVER' || gameStore.status.hpMax <= 0) {
      return;
    }
    if (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') {
      gameStore.setGklSituation(this.core.gkl.getSituation());
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

    // Vue 3 Proxy の解除と純粋な配列化
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
    const gameStore = useGameStore();
    if (!this.core || !this.core.gkl) {
      gameStore.setHoveredTileKnowledge(null);
      return null;
    }

    const ix = Math.floor(x);
    const iy = Math.floor(y);

    if (ix < 0 || ix >= 80 || iy < 0 || iy >= 21) {
      gameStore.setHoveredTileKnowledge(null);
      return null;
    }

    const gridTile = gameStore.mapGrid[iy]?.[ix];
    // 空白マス（未探索）の場合はナレッジカードなし
    if (!gridTile || gridTile.symbol === ' ') {
      gameStore.setHoveredTileKnowledge(null);
      return null;
    }

    const gkl = this.core.gkl;
    if (typeof gkl.inspectCellOnDemand === 'function') {
      try {
        const cardData = await gkl.inspectCellOnDemand({ x: ix, y: iy }, { isHover });
        if (cardData) {
          gameStore.setHoveredTileKnowledge({ x: ix, y: iy, knowledge: cardData, isClickConfirmed: !isHover });
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
      gameStore.setHoveredTileKnowledge({ x: ix, y: iy, glyphId, knowledge, isClickConfirmed: !isHover });
      return knowledge;
    } else {
      gameStore.setHoveredTileKnowledge(null);
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
    getCore: () => driverController.getCore(),
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
    queueSequence: (seq: any[], options?: any) => driverController.queueSequence(seq, options),
    getGlyphStyle: (glyphId: number, options?: any) => driverController.getGlyphStyle(glyphId, options),
    extractDirectionCode: (act: any) => driverController.extractDirectionCode(act),
    getZoomAreaTiles: (radius?: number) => driverController.getZoomAreaTiles(radius),
    getAdjacentAreaTiles: () => driverController.getZoomAreaTiles(1),
    inspectTileKnowledge: (x: number, y: number, isHover?: boolean) => driverController.inspectTileKnowledge(x, y, isHover),
    syncInventorySilent: () => driverController.syncInventorySilent(),
    syncSkillsSilent: () => driverController.syncSkillsSilent(),
    syncSpellsSilent: () => driverController.syncSpellsSilent(),
    moveToCell: (x: number, y: number) => driverController.moveToCell(x, y),
    castSpell: (letter: string) => driverController.castSpell(letter),
    enhanceSkill: (skill?: any) => driverController.enhanceSkill(skill),
    travelTo: (x: number, y: number) => driverController.travelTo(x, y),
    openItemActionMenu: (letter: string) => driverController.openItemActionMenu(letter),
    driverController,
    on: (event: string, fn: (...args: any[]) => void) => driverController.on(event, fn),
    off: (event: string, fn: (...args: any[]) => void) => driverController.off(event, fn),
    getAdaptiveSpecs: (knowledge: any) => driverController.getAdaptiveSpecs(knowledge),
  };
}
