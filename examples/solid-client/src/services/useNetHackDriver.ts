import { NetHackWasmWorkerBridge } from '@driver/index.js';
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
} from '../stores/gameStore';

export class NetHackDriverController {
  private bridge: any = null;
  private activePromptResolver: any = null;
  private activeMenuResolver: any = null;
  private textWindowBuffers: Record<number, string[]> = {};
  private isInitialized = false;

  private createSafeResolver(originalResolver: any) {
    if (!originalResolver) return null;
    let isResolved = false;
    return {
      respond: (val: any) => {
        if (isResolved) return;
        isResolved = true;
        originalResolver.respond(val);
      },
      cancel: (overrideVal?: any) => {
        if (isResolved) return;
        isResolved = true;
        if (originalResolver.cancel) {
          originalResolver.cancel(overrideVal);
        } else {
          originalResolver.respond(overrideVal ?? 0);
        }
      },
    };
  }

  public respondPrompt = (value: any) => {
    if (this.activePromptResolver) {
      const res = this.activePromptResolver;
      this.activePromptResolver = null;
      setActivePrompt(null);

      // DataCloneError 防止のための Plain Object ディープコピー
      const rawValue =
        typeof value === 'object' && value !== null
          ? JSON.parse(JSON.stringify(value))
          : value;

      res.respond(rawValue);
    }
  };

  public respondMenu = (resValue: any) => {
    const res = this.activeMenuResolver;
    this.activeMenuResolver = null;
    setActiveMenu(null);

    if (!res) {
      return;
    }

    if (!resValue || resValue === 0) {
      res.respond(0);
      return;
    }

    let cleanVal: any;
    if (Array.isArray(resValue)) {
      cleanVal = JSON.parse(JSON.stringify(resValue));
    } else if (typeof resValue === 'object') {
      cleanVal = [JSON.parse(JSON.stringify(resValue))];
    } else {
      cleanVal = resValue;
    }

    res.respond(cleanVal);
  };

  public deleteSaveFile = async () => {
    if (this.bridge) {
      await this.bridge.deleteSaveFile();
      setDetectedSaveName(null);
      addMessage('🗑️ セーブデータを完全物理削除しました。');
    }
  };

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    const currentMenu = activeMenu();
    const currentModal = activeTextModal();
    const currentPrompt = activePrompt();

    // フォーカス入力要素、モーダル表示中は移動キー送信を遮断
    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (currentMenu || currentModal) {
      return;
    }
    // yn_function, yn, getlin, askname, get_ext_cmd などの専用プロンプト処理中は汎用キーハンドラからの誤応答をブロック
    if (
      currentPrompt &&
      (currentPrompt.context === 'yn_function' ||
        currentPrompt.context === 'yn' ||
        currentPrompt.context === 'getlin' ||
        currentPrompt.context === 'askname' ||
        currentPrompt.context === 'get_ext_cmd')
    ) {
      return;
    }

    let charCode = 0;
    if (e.key === 'ArrowUp') charCode = 107; // 'k'
    else if (e.key === 'ArrowDown') charCode = 106; // 'j'
    else if (e.key === 'ArrowLeft') charCode = 104; // 'h'
    else if (e.key === 'ArrowRight') charCode = 108; // 'l'
    else if (e.key === 'Enter') charCode = 13;
    else if (e.key === 'Escape') charCode = 27;
    else if (e.key === ' ') charCode = 32;
    else if (e.key.length === 1) charCode = e.key.charCodeAt(0);

    if (charCode > 0 && this.activePromptResolver) {
      const res = this.activePromptResolver;
      this.activePromptResolver = null;
      setActivePrompt(null);
      res.respond(charCode);
    }
  };

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const workerPath = import.meta.env.PROD
      ? './src/driver/nethack.worker.js'
      : '/src/driver/nethack.worker.js';

    const nethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    // 1. Worker ブリッジの生成
    this.bridge = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });

    // 2. ドライバー状態変更イベント
    this.bridge.on('stateChange', ({ state }: { state: string }) => {
      if (state === 'RUNNING' || state === 'WAITING_INPUT' || state === 'WAITING_MENU') {
        setEngineState('RUNNING');
      } else if (state === 'STOPPED') {
        setEngineState('IDLE');
      }
    });

    // 3. メッセージ & テキスト出力イベント
    this.bridge.on('putstr', ({ windowId, text }: { windowId: number; attr: number; text: string }) => {
      if (windowId === 1) { // NHW_MESSAGE
        addMessage(text);
      } else if (windowId >= 4) { // NHW_MENU / NHW_TEXT
        if (!this.textWindowBuffers[windowId]) {
          this.textWindowBuffers[windowId] = [];
        }
        this.textWindowBuffers[windowId].push(text);
      } else {
        addMessage(text);
      }
    });

    this.bridge.on('raw_print', ({ text }: { text: string }) => {
      addMessage(text);
    });

    this.bridge.on('raw_print_bold', ({ text }: { text: string }) => {
      addMessage(text);
    });

    // 4. ステータス更新 & タイル・文字描画 & カーソル位置追従
    this.bridge.on('status_update', (payload: any) => {
      const field = payload.field ?? payload.fld;
      const value = payload.value ?? payload.parsedVal ?? payload.rawVal;
      updateStatus(field, value, payload);
    });

    this.bridge.on('curs', ({ windowId, x, y }: { windowId: number; x: number; y: number }) => {
      if (windowId === 3) {
        setCursorPos({ x, y });
      }
    });

    this.bridge.on('print_glyph', ({ x, y, glyphInfo }: any) => {
      if (glyphInfo) {
        const glyph = typeof glyphInfo === 'object' ? (glyphInfo.glyph ?? 0) : glyphInfo;
        const ch = glyphInfo.ch || (glyphInfo.symbol ? String.fromCharCode(glyphInfo.symbol) : ' ');
        const color = glyphInfo.color ?? 7;
        updateTile(x, y, glyph, ch, color);
      }
    });

    // 5. ウィンドウクリア
    this.bridge.on('clear_nhwindow', ({ windowId }: { windowId: number }) => {
      if (windowId >= 4) {
        delete this.textWindowBuffers[windowId];
      }
    });

    // テキストウィンドウ/ヘルプウィンドウのモーダル表示処理
    this.bridge.on('display_nhwindow', ({ windowId, resolver }: any) => {
      const safeRes = this.createSafeResolver(resolver);
      if (
        windowId >= 4 &&
        this.textWindowBuffers[windowId] &&
        this.textWindowBuffers[windowId].length > 0
      ) {
        const lines = [...this.textWindowBuffers[windowId]];
        delete this.textWindowBuffers[windowId];
        setActiveTextModal({
          title: 'Information / Help',
          lines,
          resolver: safeRes,
        });
      } else {
        if (safeRes) safeRes.respond(0);
      }
    });

    this.bridge.on('display_file', ({ fileText, resolver }: any) => {
      const safeRes = this.createSafeResolver(resolver);
      if (fileText) {
        const lines = fileText.split('\n');
        setActiveTextModal({
          title: 'Help File',
          lines,
          resolver: safeRes,
        });
      } else {
        if (safeRes) safeRes.respond(0);
      }
    });

    // 6. 入力必須イベント (inputRequired)
    this.bridge.on('inputRequired', (payload: any) => {
      const { context, question, choices, prompt, items, how, resolver, detectedName } = payload;
      const safeRes = this.createSafeResolver(resolver);

      // Case A: 名前問い合わせ (askname / name)
      if (context === 'askname' || context === 'name') {
        clearMapGrid();
        const playerName = detectedName || 'Hero';
        if (detectedName) {
          addMessage(`[Auto Resume] セーブデータ (${detectedName}) を自動読み込み中...`);
          setDetectedSaveName(detectedName);
        } else {
          addMessage(`[New Game] プレイヤー名 '${playerName}' で開始します。`);
        }
        if (safeRes) safeRes.respond(playerName);
        return;
      }

      // Case B: インベントリ / メニュー選択 (select_menu)
      if (context === 'select_menu') {
        if (!items || items.length === 0) {
          if (safeRes) safeRes.respond(0);
          return;
        }

        const hasSelectable = items.some(
          (it: any) => !it.isHeader && it.identifier !== undefined && it.identifier !== 0
        );
        const isViewOnly = how === 0 || !hasSelectable;

        this.activeMenuResolver = safeRes;
        setActiveMenu({
          windowId: payload.windowId || 1,
          prompt: prompt || question || (isViewOnly ? 'Information:' : 'Select item:'),
          items: items,
          resolver: safeRes,
          how: isViewOnly ? 0 : (how || 1),
        });
        return;
      }

      // Case C: yn_function, nhgetch, poskey, getlin, get_ext_cmd 等
      this.activePromptResolver = safeRes;
      setActivePrompt({
        context: context || 'nhgetch',
        prompt: prompt || question || (context === 'get_ext_cmd' ? 'Extended Command (#):' : (context === 'nhgetch' || context === 'poskey' ? '[TURN INPUT]' : '[INPUT WAITING]')),
        choices: choices,
        resolver: safeRes,
      });
    });

    // 7. Wasm エンジン初期化完了
    this.bridge.on('initialized', async () => {
      setEngineState('RUNNING');
      clearMapGrid();

      window.addEventListener('keydown', this.handleGlobalKeyDown);

      const exitCode = await this.bridge.start();
      console.log('Engine exited with code:', exitCode);

      const saveName = await this.bridge.autoDetectSavePlayerName();
      if (saveName) {
        setEngineState('SAVED');
        addMessage('ℹ️ ゲームは正常にセーブ中断されました（次回起動時に再開可能です）。');
      } else {
        setEngineState('GAMEOVER');
        addMessage('☠️ セーブデータがありません。ゲームオーバーです。');
      }
    });

    this.bridge.init(nethackJsPath);
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    if (this.bridge) {
      if (typeof this.bridge.terminate === 'function') {
        this.bridge.terminate();
      } else if (this.bridge.worker && typeof this.bridge.worker.terminate === 'function') {
        this.bridge.worker.terminate();
      }
    }
  }
}

export const driverController = new NetHackDriverController();
