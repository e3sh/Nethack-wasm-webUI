import { ref, onMounted, onUnmounted, toRaw } from 'vue';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { useGameStore } from '../stores/gameStore';

export function useNetHackDriver() {
  const gameStore = useGameStore();
  const isInitialized = ref(false);
  
  // メニュー用 Resolver と 汎用プロンプト/キー入力用 Resolver を独立分離管理
  const activePromptResolver = ref<any>(null);
  const activeMenuResolver = ref<any>(null);
  let bridge: any = null;

  // テキストウィンドウバッファ (windowId >= 4 用)
  const textWindowBuffers: Record<number, string[]> = {};

  // Resolver の二重応答防止ラップヘルパー
  function createSafeResolver(originalResolver: any) {
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
      }
    };
  }

  onMounted(() => {
    const workerPath = import.meta.env.PROD
      ? './src/driver/nethack.worker.js'
      : '/src/driver/nethack.worker.js';

    const nethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    // 1. Worker ブリッジの生成
    bridge = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });

    // 2. ドライバー状態変更イベント
    bridge.on('stateChange', ({ state }: { state: string }) => {
      if (state === 'RUNNING' || state === 'WAITING_INPUT' || state === 'WAITING_MENU') {
        gameStore.setEngineState('RUNNING');
      } else if (state === 'STOPPED') {
        gameStore.setEngineState('IDLE');
      }
    });

    // 3. メッセージ & テキスト出力イベント
    bridge.on('putstr', ({ windowId, text }: { windowId: number; attr: number; text: string }) => {
      if (windowId === 1) { // NHW_MESSAGE
        gameStore.addMessage(text);
      } else if (windowId >= 4) { // NHW_MENU / NHW_TEXT
        if (!textWindowBuffers[windowId]) {
          textWindowBuffers[windowId] = [];
        }
        textWindowBuffers[windowId].push(text);
      } else {
        gameStore.addMessage(text);
      }
    });

    bridge.on('raw_print', ({ text }: { text: string }) => {
      gameStore.addMessage(text);
    });

    bridge.on('raw_print_bold', ({ text }: { text: string }) => {
      gameStore.addMessage(text);
    });

    // 4. ステータス更新 & タイル・文字描画 & カーソル位置追従
    bridge.on('status_update', (payload: any) => {
      const field = payload.field ?? payload.fld;
      const value = payload.value ?? payload.parsedVal ?? payload.rawVal;
      gameStore.updateStatus(field, value, payload);
    });

    bridge.on('curs', ({ windowId, x, y }: { windowId: number; x: number; y: number }) => {
      if (windowId === 3) {
        gameStore.setCursorPos(x, y);
      }
    });

    bridge.on('print_glyph', ({ x, y, glyphInfo }: any) => {
      if (glyphInfo) {
        const glyph = typeof glyphInfo === 'object' ? (glyphInfo.glyph ?? 0) : glyphInfo;
        const ch = glyphInfo.ch || (glyphInfo.symbol ? String.fromCharCode(glyphInfo.symbol) : ' ');
        const color = glyphInfo.color ?? 7;
        gameStore.updateTile(x, y, glyph, ch, color);
      }
    });

    // 5. ウィンドウクリア
    bridge.on('clear_nhwindow', ({ windowId }: { windowId: number }) => {
      if (windowId >= 4) {
        delete textWindowBuffers[windowId];
      }
    });

    // テキストウィンドウ/ヘルプウィンドウのモーダル表示処理
    bridge.on('display_nhwindow', ({ windowId, resolver }: any) => {
      const safeRes = createSafeResolver(resolver);
      if (windowId >= 4 && textWindowBuffers[windowId] && textWindowBuffers[windowId].length > 0) {
        const lines = [...textWindowBuffers[windowId]];
        delete textWindowBuffers[windowId];
        gameStore.setTextModal({
          title: 'Information / Help',
          lines,
          resolver: safeRes
        });
      } else {
        if (safeRes) safeRes.respond(0);
      }
    });

    bridge.on('display_file', ({ fileText, resolver }: any) => {
      const safeRes = createSafeResolver(resolver);
      if (fileText) {
        const lines = fileText.split('\n');
        gameStore.setTextModal({
          title: 'Help File',
          lines,
          resolver: safeRes
        });
      } else {
        if (safeRes) safeRes.respond(0);
      }
    });

    // 6. 入力必須イベント (inputRequired)
    bridge.on('inputRequired', (payload: any) => {
      const { context, question, choices, prompt, items, how, resolver, detectedName } = payload;
      const safeRes = createSafeResolver(resolver);

      // Case A: 名前問い合わせ (askname / name)
      if (context === 'askname' || context === 'name') {
        gameStore.clearMapGrid();
        const playerName = detectedName || 'Hero';
        if (detectedName) {
          gameStore.addMessage(`[Auto Resume] セーブデータ (${detectedName}) を自動読み込み中...`);
          gameStore.setDetectedSaveName(detectedName);
        } else {
          gameStore.addMessage(`[New Game] プレイヤー名 '${playerName}' で開始します。`);
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

        activeMenuResolver.value = safeRes;
        gameStore.setMenu({
          windowId: payload.windowId || 1,
          prompt: prompt || question || (isViewOnly ? 'Information:' : 'Select item:'),
          items: items,
          resolver: safeRes,
          how: isViewOnly ? 0 : (how || 1),
        } as any);
        return;
      }

      // Case C: yn_function, nhgetch, poskey, getlin, get_ext_cmd 等
      activePromptResolver.value = safeRes;
      gameStore.setPrompt({
        context: context || 'nhgetch',
        prompt: prompt || question || (context === 'get_ext_cmd' ? 'Extended Command (#):' : (context === 'nhgetch' || context === 'poskey' ? '[TURN INPUT]' : '[INPUT WAITING]')),
        choices: choices,
        resolver: safeRes,
      });
    });

    // 7. Wasm エンジン初期化完了
    bridge.on('initialized', async () => {
      isInitialized.value = true;
      gameStore.setEngineState('RUNNING');
      gameStore.clearMapGrid();

      window.addEventListener('keydown', handleGlobalKeyDown);

      const exitCode = await bridge.start();
      console.log('Engine exited with code:', exitCode);

      const saveName = await bridge.autoDetectSavePlayerName();
      if (saveName) {
        gameStore.setEngineState('SAVED');
        gameStore.addMessage('ℹ️ ゲームは正常にセーブ中断されました（次回起動時に再開可能です）。');
      } else {
        gameStore.setEngineState('GAMEOVER');
        gameStore.addMessage('☠️ セーブデータがありません。ゲームオーバーです。');
      }
    });

    bridge.init(nethackJsPath);
  });

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (gameStore.activeMenu || gameStore.activeTextModal) {
      return;
    }
    // yn_function, yn, getlin, askname, get_ext_cmd などの専用プロンプト処理中は汎用キーハンドラからの誤応答をブロック
    if (
      gameStore.activePrompt &&
      (gameStore.activePrompt.context === 'yn_function' ||
        gameStore.activePrompt.context === 'yn' ||
        gameStore.activePrompt.context === 'getlin' ||
        gameStore.activePrompt.context === 'askname' ||
        gameStore.activePrompt.context === 'get_ext_cmd')
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

    if (charCode > 0 && activePromptResolver.value) {
      const res = activePromptResolver.value;
      activePromptResolver.value = null;
      gameStore.setPrompt(null);
      res.respond(charCode);
    }
  }

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeyDown);
    if (bridge) {
      bridge.terminate();
    }
  });

  async function deleteSaveFile() {
    if (bridge) {
      await bridge.deleteSaveFile();
      gameStore.setDetectedSaveName(null);
      gameStore.addMessage('🗑️ セーブデータを完全物理削除しました。');
    }
  }

  function respondPrompt(value: any) {
    if (activePromptResolver.value) {
      const res = activePromptResolver.value;
      activePromptResolver.value = null;
      gameStore.setPrompt(null);

      const rawValue = typeof value === 'object' && value !== null
        ? JSON.parse(JSON.stringify(toRaw(value)))
        : value;

      res.respond(rawValue);
    }
  }

  function respondMenu(resValue: any) {
    const res = activeMenuResolver.value;
    activeMenuResolver.value = null;
    gameStore.setMenu(null);

    if (!res) {
      return;
    }

    if (!resValue || resValue === 0) {
      res.respond(0);
      return;
    }

    let cleanVal: any;
    if (Array.isArray(resValue)) {
      cleanVal = JSON.parse(JSON.stringify(toRaw(resValue)));
    } else if (typeof resValue === 'object') {
      cleanVal = [JSON.parse(JSON.stringify(toRaw(resValue)))];
    } else {
      cleanVal = resValue;
    }

    res.respond(cleanVal);
  }

  return {
    isInitialized,
    deleteSaveFile,
    respondPrompt,
    respondMenu,
  };
}
