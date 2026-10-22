/**
 * KeyHandler - グローバルキー入力 & モーダル・テキストウィンドウ・ゲームプレイ中のキーディスパッチャー
 *
 * InputCoordinator & ModalStackController (Headless Controller) と連携し、
 * ブラウザDOMイベントの受け取りとディスパッチに純化された View-Handler。
 */
import { trapFocus } from '../../../../src/core/input/focusTrap.js';
import { ModalStackController, InputCoordinator, ROUTE_ACTIONS } from '../../../../src/ui-controller/index.js';

export class KeyHandler {
  constructor({
    getCore,
    getModalManager,
    getContainerModal,
    getPaperdollModal,
    getCharacterStatusModal,
    getFloorTrackerModal,
    getCodexModal,
    getMinimapRenderer,
    getMessageHistoryDrawer,
    getUIConfigStore,
    toggleSidePanel,
    getKnowledgeDetailModal,
    onOpenKnowledgeInspector,
    onOpenDiscoveryCodex,
    getCallCandidateDialog,
    onOpenCallDialog,
    getFloatingContextActions,
    onFacingChanged,
    onInputModeChanged,
    onShowKeymapHelp
  }) {
    this.getCore = getCore || (() => null);
    this.getModalManager = getModalManager || (() => null);
    this.getContainerModal = getContainerModal || (() => null);
    this.getPaperdollModal = getPaperdollModal || (() => null);
    this.getCharacterStatusModal = getCharacterStatusModal || (() => null);
    this.getFloorTrackerModal = getFloorTrackerModal || (() => null);
    this.getCodexModal = getCodexModal || (() => null);
    this.getKnowledgeDetailModal = getKnowledgeDetailModal || (() => null);
    this.getCallCandidateDialog = getCallCandidateDialog || (() => null);
    this.getMinimapRenderer = getMinimapRenderer || (() => null);
    this.getMessageHistoryDrawer = getMessageHistoryDrawer || (() => null);
    this.getUIConfigStore = getUIConfigStore || (() => null);
    this.toggleSidePanel = toggleSidePanel || (() => null);
    this.onOpenKnowledgeInspector = onOpenKnowledgeInspector || (() => null);
    this.onOpenDiscoveryCodex = onOpenDiscoveryCodex || (() => null);
    this.onOpenCallDialog = onOpenCallDialog || (() => null);
    this.getFloatingContextActions = getFloatingContextActions || (() => null);
    this.onFacingChanged = onFacingChanged || (() => null);
    this.onInputModeChanged = onInputModeChanged || (() => null);
    this.onShowKeymapHelp = onShowKeymapHelp || (() => null);

    this.currentFacingDir = 'S';

    this.modalStack = new ModalStackController();
    this.inputCoordinator = new InputCoordinator({ modalStack: this.modalStack });

    this._registerModals();
  }

  /**
   * 各モーダルの開閉状態・閉じる操作を ModalStackController に登録
   * @private
   */
  _registerModals() {
    // 過去ログドロワー (一時展開中のみモーダル扱い)
    this.modalStack.registerModal('historyDrawer', {
      priority: 10,
      isOpen: () => {
        const drawer = this.getMessageHistoryDrawer();
        return Boolean(drawer && drawer.isOpen() && !drawer.isPinned);
      },
      close: () => {
        const drawer = this.getMessageHistoryDrawer();
        if (drawer) drawer.close();
      }
    });

    // フローティング文脈アクション (FloatingContextActions)
    this.modalStack.registerModal('floatingContext', {
      priority: 15,
      isOpen: () => {
        const floating = this.getFloatingContextActions ? this.getFloatingContextActions() : null;
        return Boolean(floating && floating.isVisible);
      },
      close: () => {
        const floating = this.getFloatingContextActions ? this.getFloatingContextActions() : null;
        if (floating) floating.hide();
      }
    });

    // 冒険手帳モーダル
    this.modalStack.registerModal('codex', {
      priority: 20,
      isOpen: () => {
        const codex = this.getCodexModal();
        return Boolean(codex && codex.isOpen());
      },
      close: () => {
        const codex = this.getCodexModal();
        if (codex) codex.close();
      },
      isInputFocused: () => {
        return Boolean(document.activeElement && document.activeElement.id === 'codex-search-input');
      }
    });

    // ペーパードールモーダル
    this.modalStack.registerModal('paperdoll', {
      priority: 30,
      isOpen: () => {
        const paperdoll = this.getPaperdollModal();
        return Boolean(paperdoll && paperdoll.isVisible);
      },
      close: () => {
        const paperdoll = this.getPaperdollModal();
        if (paperdoll) paperdoll.hide();
      }
    });

    // キャラクター詳細モーダル
    this.modalStack.registerModal('charStatus', {
      priority: 30,
      isOpen: () => {
        const charModal = this.getCharacterStatusModal();
        return Boolean(charModal && charModal.isVisible);
      },
      close: () => {
        const charModal = this.getCharacterStatusModal();
        if (charModal) charModal.close();
      }
    });

    // フロア記録・マーカー管理モーダル
    this.modalStack.registerModal('floorTracker', {
      priority: 30,
      isOpen: () => {
        const ftModal = this.getFloorTrackerModal();
        return Boolean(ftModal && ftModal.isVisible);
      },
      close: () => {
        const ftModal = this.getFloorTrackerModal();
        if (ftModal) ftModal.close();
      },
      isInputFocused: () => {
        const ftModal = this.getFloorTrackerModal();
        if (ftModal && typeof ftModal.isInputFocused === 'function') {
          return ftModal.isInputFocused();
        }
        return false;
      }
    });

    // コンテナモーダル
    this.modalStack.registerModal('container', {
      priority: 30,
      isOpen: () => {
        const container = this.getContainerModal();
        return Boolean(container && container.isVisible);
      },
      close: () => {
        const container = this.getContainerModal();
        if (container) container.close();
      }
    });

    // 設定モーダル (<nh-modal id="nh-modal-settings">)
    this.modalStack.registerModal('settings', {
      priority: 15,
      isOpen: () => {
        const modal = typeof document !== 'undefined' ? document.getElementById('nh-modal-settings') : null;
        return Boolean(modal && (modal.open || modal.hasAttribute?.('open')));
      },
      close: () => {
        const modal = typeof document !== 'undefined' ? document.getElementById('nh-modal-settings') : null;
        if (modal) modal.close();
      }
    });

    // ディスカバリー図鑑モーダル (<nh-discovery-codex>)
    this.modalStack.registerModal('discoveryCodex', {
      priority: 25,
      isOpen: () => {
        const container = typeof document !== 'undefined' ? document.getElementById('discovery-codex-modal-container') : null;
        return Boolean(container && !container.classList.contains('hidden'));
      },
      close: () => {
        const container = typeof document !== 'undefined' ? document.getElementById('discovery-codex-modal-container') : null;
        if (container) container.classList.add('hidden');
      }
    });

    // 構造化ナレッジ詳細モーダル (KnowledgeDetailModal)
    this.modalStack.registerModal('knowledgeDetail', {
      priority: 35,
      isOpen: () => {
        const modal = this.getKnowledgeDetailModal ? this.getKnowledgeDetailModal() : null;
        return Boolean(modal && modal.isVisible);
      },
      close: () => {
        const modal = this.getKnowledgeDetailModal ? this.getKnowledgeDetailModal() : null;
        if (modal) modal.close();
      }
    });

    // キーマップヘルプモーダル (#keymap-help-modal)
    this.modalStack.registerModal('keymapHelp', {
      priority: 25,
      isOpen: () => {
        const modal = typeof document !== 'undefined' ? document.getElementById('keymap-help-modal') : null;
        return Boolean(modal && !modal.classList.contains('hidden'));
      },
      close: () => {
        const modal = typeof document !== 'undefined' ? document.getElementById('keymap-help-modal') : null;
        if (modal) modal.classList.add('hidden');
      }
    });

    // 命名アシストダイアログ (<nh-call-candidate-dialog>)
    this.modalStack.registerModal('callCandidateDialog', {
      priority: 40,
      isOpen: () => {
        const dialog = (this.getCallCandidateDialog && this.getCallCandidateDialog()) || 
                       (typeof document !== 'undefined' ? document.getElementById('nh-call-candidate-dialog') : null);
        return Boolean(dialog && dialog.open);
      },
      close: () => {
        const dialog = (this.getCallCandidateDialog && this.getCallCandidateDialog()) || 
                       (typeof document !== 'undefined' ? document.getElementById('nh-call-candidate-dialog') : null);
        if (dialog) dialog.close();
      }
    });

    // DOM 上の <nh-modal> インスタンスがあれば modalStack を直接注入
    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
      const nhModals = document.querySelectorAll('nh-modal');
      nhModals.forEach(el => {
        if (typeof el.setModalStack === 'function') {
          el.setModalStack(this.modalStack);
        }
      });
    }
  }

  handleGlobalKeyDown(e) {
    const modal = this.getModalManager();
    const core = this.getCore();
    const minimap = this.getMinimapRenderer ? this.getMinimapRenderer() : null;

    // 実行時コンテキストの収集
    const activeCard = modal && modal.getActiveModalCard ? modal.getActiveModalCard() : null;
    const wishSuggest = typeof document !== 'undefined' ? document.getElementById('wish-suggest-dropdown') : null;
    const genocideSuggest = typeof document !== 'undefined' ? document.getElementById('genocide-suggest-dropdown') : null;
    const polySuggest = typeof document !== 'undefined' ? document.getElementById('poly-suggest-dropdown') : null;
    const isSuggestActive = Boolean(
      (wishSuggest && wishSuggest.classList.contains('active')) ||
      (genocideSuggest && genocideSuggest.classList.contains('active')) ||
      (polySuggest && polySuggest.style.display !== 'none' && polySuggest.children.length > 0)
    );

    const elMenuModal = modal ? modal.elMenuModal : null;
    const isMenuOpen = Boolean(elMenuModal && !elMenuModal.classList.contains('hidden'));
    const isDomInputActive = Boolean(typeof document !== 'undefined' && document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));
    const uiConfig = this.getUIConfigStore ? this.getUIConfigStore()?.get?.() : null;
    const isBypass = Boolean(
      uiConfig?.bypassEnhancedSignals ||
      (core && core.bypassEnhancedSignals)
    );
    const inputMode = uiConfig?.inputMode || 'nehww';
    const cat = core?.currentPromptCategory;
    const isDirectionPrompt = cat === 'DIRECTION' || (core?.lastPutstrText && core.lastPutstrText.toLowerCase().includes('in what direction'));
    const hasPromptChoices = Boolean(core?.currentPromptChoices && core.currentPromptChoices.length > 0);
    const isInteractivePrompt = Boolean(cat && cat !== 'NONE' && (cat !== 'POSKEY' || hasPromptChoices || isDirectionPrompt));
    const isPromptActive = Boolean(core && core.activeResolver && isInteractivePrompt);

    const context = {
      isMinimapMaximized: Boolean(minimap && minimap.isMaximized),
      isDomInputActive,
      isMenuOpen,
      isTextWindowMode: Boolean(modal && modal.isTextWindowMode),
      isCharacterCreationOpen: Boolean(modal && modal.characterCreationModal && modal.characterCreationModal.isVisible),
      isSuggestActive,
      hasActiveCard: Boolean(activeCard),
      bypassEnhancedSignals: isBypass,
      inputMode,
      isPromptActive
    };

    // InputCoordinator によるアクション評価 (Headless)
    const evaluated = this.inputCoordinator.evaluateKeyDown(e, context);

    switch (evaluated.action) {
      case ROUTE_ACTIONS.SHORTCUT_TOGGLE_PANEL:
        e.preventDefault();
        this.toggleSidePanel();
        return;

      case ROUTE_ACTIONS.SHORTCUT_TOGGLE_HISTORY: {
        e.preventDefault();
        const historyDrawer = this.getMessageHistoryDrawer();
        if (historyDrawer) historyDrawer.toggle();
        return;
      }

      case ROUTE_ACTIONS.SHORTCUT_TOGGLE_MINIMAP:
        if (minimap) {
          e.preventDefault();
          minimap.toggleMaximize();
        }
        return;

      case ROUTE_ACTIONS.SHORTCUT_TOGGLE_FLOOR_TRACKER: {
        e.preventDefault();
        const floorTrackerModal = this.getFloorTrackerModal();
        if (floorTrackerModal) floorTrackerModal.toggle();
        return;
      }

      case ROUTE_ACTIONS.SHORTCUT_ESCAPE_MINIMAP:
        if (minimap) {
          e.preventDefault();
          minimap.toggleMaximize(false);
        }
        return;

      case ROUTE_ACTIONS.CLOSE_TOP_MODAL:
        e.preventDefault();
        this.modalStack.closeTopModal();
        return;

      case ROUTE_ACTIONS.OPEN_KNOWLEDGE_INSPECTOR:
        e.preventDefault();
        this.onOpenKnowledgeInspector();
        return;

      case ROUTE_ACTIONS.OPEN_DISCOVERY_CODEX:
        e.preventDefault();
        this.onOpenDiscoveryCodex();
        return;

      case ROUTE_ACTIONS.OPEN_CALL_DIALOG:
        e.preventDefault();
        this.onOpenCallDialog();
        return;

      case ROUTE_ACTIONS.TRAP_FOCUS:
        if (activeCard) {
          trapFocus(activeCard, e);
        }
        return;

      case ROUTE_ACTIONS.TEXT_WINDOW_DISMISS:
        if (core) {
          e.preventDefault();
          core.sendKey('Space');
        }
        return;

      case ROUTE_ACTIONS.MENU_SCROLL_DOWN:
        if (modal) {
          e.preventDefault();
          if (modal.selectableMenuButtons.length > 0) {
            modal.activeMenuFocusIndex = (modal.activeMenuFocusIndex + 1) % modal.selectableMenuButtons.length;
            modal.updateMenuFocus();
          }
        }
        return;

      case ROUTE_ACTIONS.MENU_SCROLL_UP:
        if (modal) {
          e.preventDefault();
          if (modal.selectableMenuButtons.length > 0) {
            modal.activeMenuFocusIndex = (modal.activeMenuFocusIndex - 1 + modal.selectableMenuButtons.length) % modal.selectableMenuButtons.length;
            modal.updateMenuFocus();
          }
        }
        return;

      case ROUTE_ACTIONS.MENU_SELECT:
        if (modal) {
          e.preventDefault();
          if (modal.selectableMenuButtons[modal.activeMenuFocusIndex]) {
            modal.selectableMenuButtons[modal.activeMenuFocusIndex].click();
          }
        }
        return;

      case ROUTE_ACTIONS.MENU_CANCEL:
        if (core) {
          e.preventDefault();
          core.respond(0);
        }
        return;

      case ROUTE_ACTIONS.MENU_RESPOND_CHAR:
        if (core && evaluated.payload?.char) {
          e.preventDefault();
          core.respond(evaluated.payload.char);
        }
        return;

      case ROUTE_ACTIONS.BLOCK_INPUT:
        // payload.passToNative の場合はブラウザ標準の入力（テキストボックスへのタイピング等）を通す
        return;

      case ROUTE_ACTIONS.SWITCH_INPUT_MODE: {
        e.preventDefault();
        const store = this.getUIConfigStore ? this.getUIConfigStore() : null;
        if (store) {
          const current = store.get()?.inputMode || 'nehww';
          const next = current === 'classic' ? 'nehww' : 'classic';
          store.setProperty('inputMode', next);
          this.onInputModeChanged(next);
        }
        return;
      }

      case ROUTE_ACTIONS.ROTATE_FACING:
        e.preventDefault();
        if (evaluated.payload?.dirCode) {
          this.currentFacingDir = evaluated.payload.dirCode;
          this.onFacingChanged(this.currentFacingDir);
        }
        return;

      case ROUTE_ACTIONS.EXECUTE_CONTEXT_PRIMARY:
        e.preventDefault();
        this.executeContextPrimary();
        return;

      case ROUTE_ACTIONS.EXECUTE_CONTEXT_FEET:
        e.preventDefault();
        this._updateDashGuide(false);
        this.executeContextFeet();
        return;

      case ROUTE_ACTIONS.ACTIVATE_DASH_PREFIX:
        e.preventDefault();
        this._updateDashGuide(true);
        return;

      case ROUTE_ACTIONS.CANCEL_DASH_PREFIX:
        e.preventDefault();
        this._updateDashGuide(false);
        return;

      case ROUTE_ACTIONS.DASH_MOVE:
        e.preventDefault();
        this._updateDashGuide(false);
        if (evaluated.payload?.dirCode) {
          const dirCode = evaluated.payload.dirCode;
          this.currentFacingDir = dirCode;
          this.onFacingChanged(this.currentFacingDir);
          const DIR_TO_NETHACK_NUMPAD = {
            'N': '8', 'S': '2', 'W': '4', 'E': '6',
            'NW': '7', 'NE': '9', 'SW': '1', 'SE': '3'
          };
          const numpadChar = DIR_TO_NETHACK_NUMPAD[dirCode];
          if (numpadChar && core) {
            core.sendKeySequence(['5', numpadChar]);
          }
        }
        return;

      case ROUTE_ACTIONS.TOGGLE_INVENTORY: {
        e.preventDefault();
        const paperdoll = this.getPaperdollModal ? this.getPaperdollModal() : null;
        if (paperdoll) paperdoll.toggle();
        return;
      }

      case ROUTE_ACTIONS.TOGGLE_CHARACTER_STATUS: {
        e.preventDefault();
        const charModal = this.getCharacterStatusModal ? this.getCharacterStatusModal() : null;
        if (charModal) charModal.toggle();
        return;
      }

      case ROUTE_ACTIONS.SHOW_KEYMAP_HELP:
        e.preventDefault();
        this.onShowKeymapHelp();
        return;

      case ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY:
        this._updateDashGuide(false);
        if (modal && modal.isAnyModalOpen && modal.isAnyModalOpen()) {
          return;
        }
        if (evaluated.payload?.dirCode) {
          this.currentFacingDir = evaluated.payload.dirCode;
          this.onFacingChanged(this.currentFacingDir);
        }
        if (core && e.code) {
          // ブラウザ標準ショートカットの抑止 (Ctrl+P: 印刷, Ctrl+S: 保存, Ctrl+D: ブックマーク等)
          if (e.ctrlKey && ['KeyP', 'KeyS', 'KeyD', 'KeyO'].includes(e.code)) {
            e.preventDefault();
          }

          // 🛡️ Nehww モード時: Cコア（number_pad: 1 テンキーモード）へ Classic テンキー数字として偽装返却
          const isNehww = context.inputMode === 'nehww';
          const dirCode = evaluated.payload?.dirCode;
          const cat = core.currentPromptCategory;

          // 🎯 方向キー（WASD / 矢印 / テンキー）をテンキー数字 ('8','2','4','6','7','9','1','3') に偽装変換すべきか判定:
          // 条件:
          // 1. Nehww モードであること
          // 2. dirCode が存在すること (W, A, S, D, Q, E, Z, C, 矢印キー等)
          // 3. 修飾キー Ctrl / Alt がないこと
          // 4. 【最重要】プロンプト待機中ではない (通常の移動歩行)、または「方向指定プロンプト (DIRECTION)」であること！
          //    ※ YNQプロンプト (cat === 'YN')、テキスト入力 (TEXT/ASKNAME/EXTCMD/FILE)、アイテム選択待ち等では絶対に変換せず、
          //       押された生キー (y, n, q, a, b, c 等) をそのまま C コアへ送信する！
          const isDirectionWaiting = cat === 'DIRECTION' || (core.lastPutstrText && core.lastPutstrText.toLowerCase().includes('in what direction'));
          const isTopLevelTurn = !context.isPromptActive;

          const shouldTranslateToNumpad = isNehww && dirCode && !e.ctrlKey && !e.altKey && (isTopLevelTurn || isDirectionWaiting);

          if (shouldTranslateToNumpad) {
            const DIR_TO_NETHACK_NUMPAD = {
              'N': '8', 'S': '2', 'W': '4', 'E': '6',
              'NW': '7', 'NE': '9', 'SW': '1', 'SE': '3'
            };
            const numpadChar = DIR_TO_NETHACK_NUMPAD[dirCode];
            if (numpadChar) {
              e.preventDefault();
              core.sendKey(numpadChar, false, false, false, numpadChar);
              return;
            }
          }

          core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
        }
        return;

      default:
        break;
    }
  }

  /**
   * 決定キー [Space] 押下時のスマート文脈アクション実行
   * 優先度: 足元アクション ➔ 目の前 (Facing) 候補 (複数ならメニュー / 単一なら即実行) ➔ 単一扉オート ➔ 待機
   */
  /**
   * GKL 推奨アクション一覧の確実な取得 (SSOT準拠: getRecommendedActions ➔ getSituation.actions)
   * @private
   */
  _getContextActions() {
    const core = this.getCore();
    if (!core) return [];
    const gkl = core.getGKLPlugin ? core.getGKLPlugin() : (core.gkl || null);

    if (gkl && typeof gkl.getRecommendedActions === 'function') {
      return gkl.getRecommendedActions() || [];
    }
    if (gkl && typeof gkl.getSituation === 'function') {
      return gkl.getSituation()?.actions || [];
    }
    if (core.getSituation && typeof core.getSituation === 'function') {
      return core.getSituation()?.actions || [];
    }
    return [];
  }

  /**
   * 決定キー [Space] 押下時のスマート文脈アクション実行
   * 優先度: 目の前 (Facing) のアクションメニュー提示 ➔ 足元メニュー提示 ➔ 周囲単一扉 ➔ 待機
   */
  async executeContextPrimary() {
    const core = this.getCore();
    if (!core) return;

    const floatingContext = this.getFloatingContextActions ? this.getFloatingContextActions() : null;
    const actions = this._getContextActions();

    const facingCandidates = this.currentFacingDir
      ? actions.filter(a => (a.dirCode === this.currentFacingDir || a.directionCode === this.currentFacingDir) && a.category !== 'WAIT')
      : [];

    // 1. 目の前 (Facing) のアクション候補があればメニュー展開 (単一・複数問わず提示)
    if (facingCandidates.length > 0) {
      if (floatingContext && typeof floatingContext.showAtPlayerAdjacent === 'function') {
        floatingContext.showAtPlayerAdjacent(this.currentFacingDir, facingCandidates);
        return;
      }
      // フォールバック: 単一実行
      const facingAction = facingCandidates[0];
      if (typeof core.executeAction === 'function') {
        await core.executeAction(facingAction);
      }
      return;
    }

    // 2. 足元アクション候補 (拾う、階段、祭壇等)
    const feetCandidates = actions.filter(a => (a.dirCode === 'SELF' || a.directionCode === 'SELF' || a.target === 'feet') && a.category !== 'WAIT');
    if (feetCandidates.length > 0) {
      if (floatingContext && typeof floatingContext.showAtPlayerAdjacent === 'function') {
        floatingContext.showAtPlayerAdjacent('SELF', feetCandidates);
        return;
      }
      if (typeof core.executeAction === 'function') {
        await core.executeAction(feetCandidates[0]);
      }
      return;
    }

    // 3. スマート自動補完: 周囲に扉アクションが1つだけ存在するか
    const doorActions = actions.filter(a => (a.id?.includes('DOOR') || a.category === 'DOOR') && a.dirCode !== 'SELF');
    if (doorActions.length === 1) {
      if (floatingContext && typeof floatingContext.showAtPlayerAdjacent === 'function') {
        const doorDir = doorActions[0].dirCode || doorActions[0].directionCode || 'SELF';
        floatingContext.showAtPlayerAdjacent(doorDir, doorActions);
        return;
      }
      if (typeof core.executeAction === 'function') {
        await core.executeAction(doorActions[0]);
      }
      return;
    }

    // 4. フォールバック: その場で1ターン待機 (.)
    core.sendKey('Period', false, false, false, '.');
  }

  /**
   * 足元指定キー [Shift + Space] 押下時の足元コンテキストメニュー強制展開
   */
  async executeContextFeet() {
    const core = this.getCore();
    if (!core) return;

    const floatingContext = this.getFloatingContextActions ? this.getFloatingContextActions() : null;
    const actions = this._getContextActions();

    const feetCandidates = actions.filter(a => a.dirCode === 'SELF' || a.directionCode === 'SELF' || a.target === 'feet');
    if (feetCandidates.length > 0 && floatingContext && typeof floatingContext.showAtPlayerAdjacent === 'function') {
      floatingContext.showAtPlayerAdjacent('SELF', feetCandidates);
      return;
    }

    // 候補がなければ待機 (.)
    core.sendKey('Period', false, false, false, '.');
  }

  /**
   * スマートガイドバーのダッシュ状態表示更新
   * @param {boolean} isActive
   * @private
   */
  _updateDashGuide(isActive) {
    if (typeof document === 'undefined') return;
    const chip = document.getElementById('guide-chip-dash');
    if (!chip) return;
    const core = this.getCore?.();
    const isEn = Boolean(core?.language === 'en' || (typeof window !== 'undefined' && window.gklClient?.currentLanguage === 'en'));
    if (isActive) {
      chip.classList.add('active');
      chip.innerHTML = isEn
        ? '<kbd>WASD/Arrows</kbd> 🏃Run Direction... <kbd style="margin-left:4px;">Esc</kbd> Cancel'
        : '<kbd>WASD/矢印</kbd> 🏃ダッシュ方向入力... <kbd style="margin-left:4px;">Esc</kbd> 取消';
    } else {
      chip.classList.remove('active');
      chip.innerHTML = isEn ? '<kbd>G</kbd>+<kbd>WASD</kbd> Run' : '<kbd>G</kbd>+<kbd>WASD</kbd> ダッシュ';
    }
  }
}
