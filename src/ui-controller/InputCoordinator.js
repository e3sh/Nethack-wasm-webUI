/**
 * InputCoordinator.js
 *
 * キーボード入力の競合調停とルーティング判定を行う Headless コントローラー。
 * 1. グローバルUIショートカット (Alt+S, Ctrl+P, Tab)
 * 2. モーダルスタックとESC閉塞
 * 3. フォーム入力中のキーブロック
 * 4. メニュー/テキストウィンドウ操作
 * 5. ゲーム操作キー (NetHack C Core / WASM)
 */

export const ROUTE_ACTIONS = {
  SHORTCUT_TOGGLE_PANEL: 'SHORTCUT_TOGGLE_PANEL',
  SHORTCUT_TOGGLE_HISTORY: 'SHORTCUT_TOGGLE_HISTORY',
  SHORTCUT_TOGGLE_MINIMAP: 'SHORTCUT_TOGGLE_MINIMAP',
  SHORTCUT_ESCAPE_MINIMAP: 'SHORTCUT_ESCAPE_MINIMAP',
  CLOSE_TOP_MODAL: 'CLOSE_TOP_MODAL',
  BLOCK_INPUT: 'BLOCK_INPUT',
  TRAP_FOCUS: 'TRAP_FOCUS',
  MENU_SCROLL_DOWN: 'MENU_SCROLL_DOWN',
  MENU_SCROLL_UP: 'MENU_SCROLL_UP',
  MENU_SELECT: 'MENU_SELECT',
  MENU_CANCEL: 'MENU_CANCEL',
  MENU_RESPOND_CHAR: 'MENU_RESPOND_CHAR',
  TEXT_WINDOW_DISMISS: 'TEXT_WINDOW_DISMISS',
  OPEN_KNOWLEDGE_INSPECTOR: 'OPEN_KNOWLEDGE_INSPECTOR',
  OPEN_DISCOVERY_CODEX: 'OPEN_DISCOVERY_CODEX',
  PASSTHROUGH_GAME_KEY: 'PASSTHROUGH_GAME_KEY'
};

export class InputCoordinator {
  /**
   * @param {Object} options
   * @param {import('./ModalStackController.js').ModalStackController} options.modalStack
   */
  constructor({ modalStack }) {
    this.modalStack = modalStack;
  }

  /**
   * キーイベントを評価し、実行すべきアクション種別を導出する (Headless)
   * @param {Object} event - 簡略化されたキーイベント情報
   * @param {string} event.key
   * @param {string} event.code
   * @param {boolean} [event.altKey]
   * @param {boolean} [event.ctrlKey]
   * @param {boolean} [event.shiftKey]
   * @param {Object} context - 実行時コンテキスト
   * @param {boolean} [context.isMinimapMaximized] - ミニマップ最大化中か
   * @param {boolean} [context.isDomInputActive] - INPUT/TEXTAREA要素にフォーカスがあるか
   * @param {boolean} [context.isMenuOpen] - メニューモーダルが開いているか
   * @param {boolean} [context.isTextWindowMode] - メニューがテキスト閲覧モードか
   * @param {boolean} [context.isCharacterCreationOpen] - キャラ作成モーダルが開いているか
   * @param {boolean} [context.isSuggestActive] - サジェストリストが表示中か
   * @param {boolean} [context.hasActiveCard] - フォーカストラップ対象のアクティブカードがあるか
   * @returns {{ action: string, payload?: any }}
   */
  evaluateKeyDown(event, context = {}) {
    const { key, code, altKey, ctrlKey } = event;

    // 1. 🎒 サイドパネル一時退避・再展開ショートカット (Alt+S または F2)
    if ((altKey && (code === 'KeyS' || key === 's' || key === 'S')) || code === 'F2') {
      return { action: ROUTE_ACTIONS.SHORTCUT_TOGGLE_PANEL };
    }

    // 2. 📜 過去ログドロワー (Ctrl+P) の開閉ハンドリング
    if (ctrlKey && (code === 'KeyP' || key === 'p' || key === 'P')) {
      return { action: ROUTE_ACTIONS.SHORTCUT_TOGGLE_HISTORY };
    }

    // 3. モーダルスタックチェック (最前面モーダルが開いている場合)
    const topModal = this.modalStack.getTopModal();
    if (topModal) {
      if (topModal.isInputFocused && topModal.isInputFocused()) {
        // モーダル内検索入力等にフォーカスがある場合はそのまま入力を通す
        return { action: ROUTE_ACTIONS.BLOCK_INPUT, payload: { passToNative: true } };
      }

      const isEscape = key === 'Escape' || code === 'Escape';
      const isQ = key === 'q' || key === 'Q' || code === 'KeyQ';

      // モーダルごとのESC/q閉塞判定
      if (isEscape || (topModal.id === 'paperdoll' && isQ) || (topModal.id === 'container' && isQ)) {
        return { action: ROUTE_ACTIONS.CLOSE_TOP_MODAL, payload: { modalId: topModal.id } };
      }

      // モーダル表示中は通常ゲームキーをブロック
      return { action: ROUTE_ACTIONS.BLOCK_INPUT };
    }

    // 4. キャラクター作成モーダル表示中
    if (context.isCharacterCreationOpen) {
      return { action: ROUTE_ACTIONS.BLOCK_INPUT };
    }

    // 5. フォーカストラップ対象のカードがある場合
    if (context.hasActiveCard && !context.isSuggestActive && key === 'Tab') {
      return { action: ROUTE_ACTIONS.TRAP_FOCUS };
    }

    // 6. DOM入力要素にフォーカスがある場合
    if (context.isDomInputActive) {
      return { action: ROUTE_ACTIONS.BLOCK_INPUT, payload: { passToNative: true } };
    }

    // 7. メニューモーダル / テキストウィンドウ表示中の制御
    if (context.isMenuOpen) {
      if (context.isTextWindowMode) {
        if (['Space', 'Enter', 'Escape', 'KeyQ', 'Backspace'].includes(code) || key === ' ' || key === 'Enter' || key === 'Escape' || key === 'q') {
          return { action: ROUTE_ACTIONS.TEXT_WINDOW_DISMISS };
        }
        return { action: ROUTE_ACTIONS.BLOCK_INPUT };
      }

      // 通常メニュー操作
      if (key === 'ArrowDown' || code === 'ArrowDown' || code === 'Numpad2') {
        return { action: ROUTE_ACTIONS.MENU_SCROLL_DOWN };
      }
      if (key === 'ArrowUp' || code === 'ArrowUp' || code === 'Numpad8') {
        return { action: ROUTE_ACTIONS.MENU_SCROLL_UP };
      }
      if (key === 'Enter' || code === 'Enter' || code === 'NumpadEnter') {
        return { action: ROUTE_ACTIONS.MENU_SELECT };
      }
      if (key === 'Escape' || key === '0' || key === 'q' || code === 'Escape' || code === 'Digit0' || code === 'Numpad0' || code === 'KeyQ') {
        return { action: ROUTE_ACTIONS.MENU_CANCEL };
      }
      if (key && key.length === 1) {
        return { action: ROUTE_ACTIONS.MENU_RESPOND_CHAR, payload: { char: key } };
      }
      return { action: ROUTE_ACTIONS.BLOCK_INPUT };
    }

    // 8. 🗺️ ミニマップ HUD 全体オーバーレイ展開 [Tab]
    if (code === 'Tab' || key === 'Tab') {
      return { action: ROUTE_ACTIONS.SHORTCUT_TOGGLE_MINIMAP };
    }

    // ミニマップ最大化中に Escape が押された場合は縮小
    if (context.isMinimapMaximized && (code === 'Escape' || key === 'Escape')) {
      return { action: ROUTE_ACTIONS.SHORTCUT_ESCAPE_MINIMAP };
    }

    // 9. 修飾キー単体押下は無視
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(code)) {
      return { action: ROUTE_ACTIONS.BLOCK_INPUT };
    }

    // 10. 📚 標準操作プログレッシブ拡張 (Phase 7: Native Command Progressive Enhancement)
    // 通常プレイ中（モーダル/メニュー/テキスト入力非表示時）の '/' (What is this?) および '\' (Known objects)
    if (!context.bypassEnhancedSignals && !ctrlKey && !altKey) {
      if (key === '/' || code === 'Slash') {
        return { action: ROUTE_ACTIONS.OPEN_KNOWLEDGE_INSPECTOR };
      }
      if (key === '\\' || key === '¥' || code === 'Backslash' || code === 'IntlYen') {
        return { action: ROUTE_ACTIONS.OPEN_DISCOVERY_CODEX };
      }
    }

    // 11. 通常のゲームキー操作 (パススルー)
    return {
      action: ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY,
      payload: {
        code,
        key,
        shiftKey: Boolean(event.shiftKey),
        ctrlKey: Boolean(event.ctrlKey),
        altKey: Boolean(event.altKey)
      }
    };
  }
}
