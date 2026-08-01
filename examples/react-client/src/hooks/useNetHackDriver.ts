import { useState, useEffect, useRef, useCallback } from 'react';
import { NetHackWasmWorkerBridge } from '@driver/index.js';
import { useGameStore } from '../stores/gameStore';

export function useNetHackDriver() {
  const [isInitialized, setIsInitialized] = useState(false);
  const bridgeRef = useRef<any>(null);

  // メニュー用 Resolver と 汎用プロンプト/キー入力用 Resolver を独立分離管理
  const activePromptResolverRef = useRef<any>(null);
  const activeMenuResolverRef = useRef<any>(null);

  // テキストウィンドウバッファ (windowId >= 4 用)
  const textWindowBuffersRef = useRef<Record<number, string[]>>({});

  // SafeResolver 生成関数（二重応答防止）
  const createSafeResolver = useCallback((originalResolver: any) => {
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
  }, []);

  const respondPrompt = useCallback((value: any) => {
    if (activePromptResolverRef.current) {
      const res = activePromptResolverRef.current;
      activePromptResolverRef.current = null;
      useGameStore.getState().setPrompt(null);

      // DataCloneError 防止のための Plain Object ディープコピー
      const rawValue =
        typeof value === 'object' && value !== null
          ? JSON.parse(JSON.stringify(value))
          : value;

      res.respond(rawValue);
    }
  }, []);

  const respondMenu = useCallback((resValue: any) => {
    const res = activeMenuResolverRef.current;
    activeMenuResolverRef.current = null;
    useGameStore.getState().setMenu(null);

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
  }, []);

  const deleteSaveFile = useCallback(async () => {
    if (bridgeRef.current) {
      await bridgeRef.current.deleteSaveFile();
      useGameStore.getState().setDetectedSaveName(null);
      useGameStore.getState().addMessage('🗑️ セーブデータを完全物理削除しました。');
    }
  }, []);

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    const store = useGameStore.getState();

    // フォーカス入力要素、モーダル表示中は移動キー送信を遮断
    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
    ) {
      return;
    }
    if (store.activeMenu || store.activeTextModal) {
      return;
    }
    // yn_function, yn, getlin, askname, get_ext_cmd などの専用プロンプト処理中は汎用キーハンドラからの誤誤応答をブロック
    if (
      store.activePrompt &&
      (store.activePrompt.context === 'yn_function' ||
        store.activePrompt.context === 'yn' ||
        store.activePrompt.context === 'getlin' ||
        store.activePrompt.context === 'askname' ||
        store.activePrompt.context === 'get_ext_cmd')
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

    if (charCode > 0 && activePromptResolverRef.current) {
      const res = activePromptResolverRef.current;
      activePromptResolverRef.current = null;
      store.setPrompt(null);
      res.respond(charCode);
    }
  }, []);

  useEffect(() => {
    const workerPath = import.meta.env.PROD
      ? './src/driver/nethack.worker.js'
      : '/src/driver/nethack.worker.js';

    const nethackJsPath = import.meta.env.PROD
      ? './nethack.js'
      : '/nethack.js';

    // 1. Worker ブリッジの生成
    const bridge = new NetHackWasmWorkerBridge(workerPath, {
      arguments: ['nethack', '-otime,showexp,showvers,number_pad'],
      debug: true,
    });
    bridgeRef.current = bridge;

    // 2. ドライバー状態変更イベント
    bridge.on('stateChange', ({ state }: { state: string }) => {
      if (state === 'RUNNING' || state === 'WAITING_INPUT' || state === 'WAITING_MENU') {
        useGameStore.getState().setEngineState('RUNNING');
      } else if (state === 'STOPPED') {
        useGameStore.getState().setEngineState('IDLE');
      }
    });

    // 3. メッセージ & テキスト出力イベント
    bridge.on('putstr', ({ windowId, text }: { windowId: number; attr: number; text: string }) => {
      if (windowId === 1) { // NHW_MESSAGE
        useGameStore.getState().addMessage(text);
      } else if (windowId >= 4) { // NHW_MENU / NHW_TEXT
        if (!textWindowBuffersRef.current[windowId]) {
          textWindowBuffersRef.current[windowId] = [];
        }
        textWindowBuffersRef.current[windowId].push(text);
      } else {
        useGameStore.getState().addMessage(text);
      }
    });

    bridge.on('raw_print', ({ text }: { text: string }) => {
      useGameStore.getState().addMessage(text);
    });

    bridge.on('raw_print_bold', ({ text }: { text: string }) => {
      useGameStore.getState().addMessage(text);
    });

    // 4. ステータス更新 & タイル・文字描画 & カーソル位置追従
    bridge.on('status_update', (payload: any) => {
      const field = payload.field ?? payload.fld;
      const value = payload.value ?? payload.parsedVal ?? payload.rawVal;
      useGameStore.getState().updateStatus(field, value, payload);
    });

    bridge.on('curs', ({ windowId, x, y }: { windowId: number; x: number; y: number }) => {
      if (windowId === 3) {
        useGameStore.getState().setCursorPos(x, y);
      }
    });

    bridge.on('print_glyph', ({ x, y, glyphInfo }: any) => {
      if (glyphInfo) {
        const glyph = typeof glyphInfo === 'object' ? (glyphInfo.glyph ?? 0) : glyphInfo;
        const ch = glyphInfo.ch || (glyphInfo.symbol ? String.fromCharCode(glyphInfo.symbol) : ' ');
        const color = glyphInfo.color ?? 7;
        useGameStore.getState().updateTile(x, y, glyph, ch, color);
      }
    });

    // 5. ウィンドウクリア
    bridge.on('clear_nhwindow', ({ windowId }: { windowId: number }) => {
      if (windowId >= 4) {
        delete textWindowBuffersRef.current[windowId];
      }
    });

    // テキストウィンドウ/ヘルプウィンドウのモーダル表示処理
    bridge.on('display_nhwindow', ({ windowId, resolver }: any) => {
      const safeRes = createSafeResolver(resolver);
      if (
        windowId >= 4 &&
        textWindowBuffersRef.current[windowId] &&
        textWindowBuffersRef.current[windowId].length > 0
      ) {
        const lines = [...textWindowBuffersRef.current[windowId]];
        delete textWindowBuffersRef.current[windowId];
        useGameStore.getState().setTextModal({
          title: 'Information / Help',
          lines,
          resolver: safeRes,
        });
      } else {
        if (safeRes) safeRes.respond(0);
      }
    });

    bridge.on('display_file', ({ fileText, resolver }: any) => {
      const safeRes = createSafeResolver(resolver);
      if (fileText) {
        const lines = fileText.split('\n');
        useGameStore.getState().setTextModal({
          title: 'Help File',
          lines,
          resolver: safeRes,
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
        useGameStore.getState().clearMapGrid();
        const playerName = detectedName || 'Hero';
        if (detectedName) {
          useGameStore.getState().addMessage(`[Auto Resume] セーブデータ (${detectedName}) を自動読み込み中...`);
          useGameStore.getState().setDetectedSaveName(detectedName);
        } else {
          useGameStore.getState().addMessage(`[New Game] プレイヤー名 '${playerName}' で開始します。`);
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

        activeMenuResolverRef.current = safeRes;
        useGameStore.getState().setMenu({
          windowId: payload.windowId || 1,
          prompt: prompt || question || (isViewOnly ? 'Information:' : 'Select item:'),
          items: items,
          resolver: safeRes,
          how: isViewOnly ? 0 : (how || 1),
        } as any);
        return;
      }

      // Case C: yn_function, nhgetch, poskey, getlin, get_ext_cmd 等
      activePromptResolverRef.current = safeRes;
      useGameStore.getState().setPrompt({
        context: context || 'nhgetch',
        prompt: prompt || question || (context === 'get_ext_cmd' ? 'Extended Command (#):' : (context === 'nhgetch' || context === 'poskey' ? '[TURN INPUT]' : '[INPUT WAITING]')),
        choices: choices,
        resolver: safeRes,
      });
    });

    // 7. Wasm エンジン初期化完了
    bridge.on('initialized', async () => {
      setIsInitialized(true);
      useGameStore.getState().setEngineState('RUNNING');
      useGameStore.getState().clearMapGrid();

      window.addEventListener('keydown', handleGlobalKeyDown);

      const exitCode = await bridge.start();
      console.log('Engine exited with code:', exitCode);

      const saveName = await bridge.autoDetectSavePlayerName();
      if (saveName) {
        useGameStore.getState().setEngineState('SAVED');
        useGameStore.getState().addMessage('ℹ️ ゲームは正常にセーブ中断されました（次回起動時に再開可能です）。');
      } else {
        useGameStore.getState().setEngineState('GAMEOVER');
        useGameStore.getState().addMessage('☠️ セーブデータがありません。ゲームオーバーです。');
      }
    });

    bridge.init(nethackJsPath);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (bridgeRef.current) {
        if (typeof bridgeRef.current.terminate === 'function') {
          bridgeRef.current.terminate();
        } else if (bridgeRef.current.worker && typeof bridgeRef.current.worker.terminate === 'function') {
          bridgeRef.current.worker.terminate();
        }
      }
    };
  }, [createSafeResolver, handleGlobalKeyDown]);

  return {
    isInitialized,
    deleteSaveFile,
    respondPrompt,
    respondMenu,
  };
}
