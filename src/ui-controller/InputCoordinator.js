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
  SHORTCUT_TOGGLE_FLOOR_TRACKER: 'SHORTCUT_TOGGLE_FLOOR_TRACKER',
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
  OPEN_CALL_DIALOG: 'OPEN_CALL_DIALOG',
  PASSTHROUGH_GAME_KEY: 'PASSTHROUGH_GAME_KEY',
  SWITCH_INPUT_MODE: 'SWITCH_INPUT_MODE',
  ROTATE_FACING: 'ROTATE_FACING',
  EXECUTE_CONTEXT_PRIMARY: 'EXECUTE_CONTEXT_PRIMARY',
  TOGGLE_INVENTORY: 'TOGGLE_INVENTORY',
  TOGGLE_CHARACTER_STATUS: 'TOGGLE_CHARACTER_STATUS',
  SHOW_KEYMAP_HELP: 'SHOW_KEYMAP_HELP',
  EXECUTE_CONTEXT_FEET: 'EXECUTE_CONTEXT_FEET',
  DASH_MOVE: 'DASH_MOVE'
};

export const DIRECTION_KEY_MAP = Object.freeze({
  'ArrowUp': 'N',
  'ArrowDown': 'S',
  'ArrowLeft': 'W',
  'ArrowRight': 'E',
  'Numpad8': 'N',
  'Numpad2': 'S',
  'Numpad4': 'W',
  'Numpad6': 'E',
  'Numpad7': 'NW',
  'Numpad9': 'NE',
  'Numpad1': 'SW',
  'Numpad3': 'SE',
  'KeyW': 'N',
  'KeyS': 'S',
  'KeyX': 'S',
  'KeyA': 'W',
  'KeyD': 'E',
  'KeyQ': 'NW',
  'KeyE': 'NE',
  'KeyZ': 'SW',
  'KeyC': 'SE'
});

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

    // 0. 🔄 入力モード切替ショートカット (F1)
    if (code === 'F1' || key === 'F1') {
      return { action: ROUTE_ACTIONS.SWITCH_INPUT_MODE };
    }

    // 1. 🎒 サイドパネル一時退避・再展開ショートカット (Alt+S または F2)
    if ((altKey && (code === 'KeyS' || key === 's' || key === 'S')) || code === 'F2') {
      return { action: ROUTE_ACTIONS.SHORTCUT_TOGGLE_PANEL };
    }

    // 2. 📜 過去ログドロワー (Ctrl+P) の開閉ハンドリング
    if (ctrlKey && (code === 'KeyP' || key === 'p' || key === 'P')) {
      return { action: ROUTE_ACTIONS.SHORTCUT_TOGGLE_HISTORY };
    }

    // 2.5 🗺️ フロア記録・マーカー管理 (Ctrl+O または Alt+A) の開閉ハンドリング
    if ((ctrlKey && (code === 'KeyO' || key === 'o' || key === 'O')) ||
        (altKey && (code === 'KeyA' || key === 'a' || key === 'A'))) {
      return { action: ROUTE_ACTIONS.SHORTCUT_TOGGLE_FLOOR_TRACKER };
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

      // モーダルごとのESC/q閉塞判定 (isInputFocused 時は上記で除外済み)
      if (isEscape || (topModal.id === 'paperdoll' && isQ) || (topModal.id === 'container' && isQ) || (topModal.id === 'charStatus' && isQ) || (topModal.id === 'characterStatus' && isQ) || (topModal.id === 'floorTracker' && isQ)) {
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
      const isNehww = (context.inputMode || 'classic') === 'nehww';
      if (key === 'ArrowDown' || code === 'ArrowDown' || code === 'Numpad2' || (isNehww && code === 'KeyS')) {
        return { action: ROUTE_ACTIONS.MENU_SCROLL_DOWN };
      }
      if (key === 'ArrowUp' || code === 'ArrowUp' || code === 'Numpad8' || (isNehww && code === 'KeyW')) {
        return { action: ROUTE_ACTIONS.MENU_SCROLL_UP };
      }
      if (key === 'Enter' || code === 'Enter' || code === 'NumpadEnter' || (isNehww && (code === 'Space' || key === ' '))) {
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
    if (context.isMinimapMaximized && (code === 'Escape' || key === 'Escape' || code === 'KeyM' || key === 'm' || key === 'M')) {
      return { action: ROUTE_ACTIONS.SHORTCUT_ESCAPE_MINIMAP };
    }

    // 9. 修飾キー単体押下は無視
    if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(code)) {
      return { action: ROUTE_ACTIONS.BLOCK_INPUT };
    }

    // 10. 入力モード判定 (CLASSIC vs NEHWW)
    const inputMode = context.inputMode || 'classic';
    const isClassic = inputMode === 'classic';

    // 11. 方向キー情報の導出
    const dirCode = DIRECTION_KEY_MAP[code] || DIRECTION_KEY_MAP[key] || null;

    // 12. 🛡️ NEHWW モード専用の論理アクション処理
    if (!isClassic && !context.isPromptActive) {
      // 12.1 🔄 Shift + 方向キー ➔ その場向き変更 (ターン消費ゼロ)
      if (event.shiftKey && dirCode) {
        return {
          action: ROUTE_ACTIONS.ROTATE_FACING,
          payload: { dirCode }
        };
      }

      // 12.15 🏃 Ctrl + 方向キー ➔ ダッシュ移動 (連続歩行)
      if (ctrlKey && !altKey && dirCode) {
        return {
          action: ROUTE_ACTIONS.DASH_MOVE,
          payload: { dirCode }
        };
      }

      // 12.16 👣 Shift + Space ➔ 足元アクション (拾う/階段/祭壇/調べる)
      if (event.shiftKey && !ctrlKey && !altKey && (code === 'Space' || key === ' ')) {
        return { action: ROUTE_ACTIONS.EXECUTE_CONTEXT_FEET };
      }

      // 12.2 修飾キーなしの論理ショートカット
      if (!ctrlKey && !altKey) {
        // 決定 / 文脈アクション実行 [Space]
        if (code === 'Space' || key === ' ') {
          return { action: ROUTE_ACTIONS.EXECUTE_CONTEXT_PRIMARY };
        }

        // 🎒 所持品 & 装備ペーパードール [I]
        if (code === 'KeyI' || key === 'i' || key === 'I') {
          return { action: ROUTE_ACTIONS.TOGGLE_INVENTORY };
        }

        // 👤 キャラクター詳細ステータス [P] または [V]
        if (code === 'KeyP' || key === 'p' || key === 'P' || code === 'KeyV' || key === 'v' || key === 'V') {
          return { action: ROUTE_ACTIONS.TOGGLE_CHARACTER_STATUS };
        }

        // 🗺️ 全体ミニマップ HUD [M]
        if (code === 'KeyM' || key === 'm' || key === 'M') {
          return { action: ROUTE_ACTIONS.SHORTCUT_TOGGLE_MINIMAP };
        }

        // 📖 冒険手帳・ディスカバリー図鑑 [B]
        if (code === 'KeyB' || key === 'b' || key === 'B') {
          return { action: ROUTE_ACTIONS.OPEN_DISCOVERY_CODEX };
        }

        // ❓ キーレイアウトヘルプ [?]
        if (key === '?' || (code === 'Slash' && event.shiftKey)) {
          return { action: ROUTE_ACTIONS.SHOW_KEYMAP_HELP };
        }
      }
    }

    // 13. 📚 標準操作プログレッシブ拡張 (Phase 7: 通常プレイ時の '/' および '\')
    if (!context.bypassEnhancedSignals && !ctrlKey && !altKey) {
      if (key === '/') {
        return { action: ROUTE_ACTIONS.OPEN_KNOWLEDGE_INSPECTOR };
      }
      if (key === '\\' || key === '¥') {
        return { action: ROUTE_ACTIONS.OPEN_DISCOVERY_CODEX };
      }
    }

    // 14. 通常のゲームキー操作 (パススルー)
    return {
      action: ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY,
      payload: {
        code,
        key,
        shiftKey: Boolean(event.shiftKey),
        ctrlKey: Boolean(event.ctrlKey),
        altKey: Boolean(event.altKey),
        dirCode
      }
    };
  }
}
