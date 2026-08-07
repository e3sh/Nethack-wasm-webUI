import { ref, onMounted } from 'vue';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { WebUICore } from '@core/WebUICore.js';
import { useGameStore } from '../stores/gameStore';

class NetHackDriverController {
  private core: any = null;
  public isInitialized = ref(false);

  public init() {
    if (this.core) return;
    this.startCore();
  }

  private startCore() {
    const gameStore = useGameStore();

    const workerPath = import.meta.env.PROD
      ? './src/driver/nethack.worker.js'
      : '/src/driver/nethack.worker.js';

    const nethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    // 1. Worker ブリッジおよび WebUICore の生成
    const driver = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });

    this.core = new WebUICore({ driver });

    // 2. WebUICore イベントのバインド
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
    });

    this.core.on('print_glyph', ({ x, y, glyph, ch, color }: any) => {
      gameStore.updateTile(x, y, glyph, ch, color);
    });

    this.core.on('map_cleared', () => {
      gameStore.clearMapGrid();
    });

    this.core.on('textWindowModal', (payload: any) => {
      const rawP = payload.payload?.rawPrompt || payload.payload?.prompt || '';
      const cleanTitle = (rawP && rawP.length < 40 && !rawP.includes('Press Space')) ? rawP : 'Information / Help';
      gameStore.setTextModal({
        title: cleanTitle,
        lines: payload.lines || [],
        resolver: payload.resolver,
      });
    });

    this.core.on('inputRequired', (payload: any) => {
      const { category, context, prompt, items, choices, resolver } = payload;

      // 1. メニューモーダル
      if (category === 'MENU' || context === 'select_menu') {
        gameStore.setMenu({
          windowId: payload.windowId || 1,
          prompt: prompt || 'Select item:',
          items: items || [],
          resolver: resolver,
          how: payload.how || 1,
        } as any);
        return;
      }

      // 2. ヘルプファイル閲覧モーダル (FILE カテゴリ専用)
      if (category === 'FILE') {
        gameStore.setTextModal({
          title: payload.rawPrompt || prompt || 'Information / Help',
          lines: payload.lines || [],
          resolver: resolver,
        });
        return;
      }

      // 3. 通常の入力プロンプト (YN質問, チュートリアル選択, テキスト入力, ターン入力等)
      gameStore.setPrompt({
        context: context || category || 'input',
        prompt: prompt || '[INPUT WAITING]',
        choices: choices || '',
        resolver: resolver,
        category: category,
      } as any);
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
        gameStore.addMessage('ℹ️ ゲームは正常にセーブ中断されました（次回起動時に再開可能です）。');
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

    this.core.start(nethackJsPath).then(() => {
      this.isInitialized.value = true;
    }).catch((err: any) => {
      console.error("WebUICore start error:", err);
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
    if (gameStore.activeTextModal || gameStore.activeMenu || gameStore.activePrompt) {
      return;
    }

    if (this.core && this.core.activeResolver) {
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
      }
      this.core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
    }
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown.bind(this));
    if (this.core) {
      this.core.destroy();
      this.core = null;
    }
  }

  public async deleteSaveFile() {
    const gameStore = useGameStore();
    if (this.core && this.core.driver && typeof this.core.driver.deleteSaveFile === 'function') {
      await this.core.driver.deleteSaveFile();
    }
    gameStore.setDetectedSaveName(null);
    gameStore.addMessage('🗑️ セーブデータを完全物理削除しました。');
  }

  public async restartGame() {
    const gameStore = useGameStore();
    gameStore.resetAllState();
    
    // WebUICore / Worker の再起動
    if (this.core) {
      try {
        this.core.destroy();
      } catch (e) {
        console.warn("Core destroy warning:", e);
      }
      this.core = null;
    }
    this.startCore();
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
}

export const driverController = new NetHackDriverController();

export function useNetHackDriver() {
  onMounted(() => {
    driverController.init();
  });

  return {
    isInitialized: driverController.isInitialized,
    deleteSaveFile: () => driverController.deleteSaveFile(),
    restartGame: () => driverController.restartGame(),
    respondPrompt: (val: any) => driverController.respondPrompt(val),
    respondMenu: (val: any) => driverController.respondMenu(val),
    respondTextModal: (val: any = 0) => driverController.respondTextModal(val),
  };
}
