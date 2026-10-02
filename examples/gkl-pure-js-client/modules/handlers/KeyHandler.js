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
    getCodexModal,
    getMinimapRenderer,
    getMessageHistoryDrawer,
    toggleSidePanel,
    getKnowledgeDetailModal,
    onOpenKnowledgeInspector,
    onOpenDiscoveryCodex
  }) {
    this.getCore = getCore || (() => null);
    this.getModalManager = getModalManager || (() => null);
    this.getContainerModal = getContainerModal || (() => null);
    this.getPaperdollModal = getPaperdollModal || (() => null);
    this.getCodexModal = getCodexModal || (() => null);
    this.getKnowledgeDetailModal = getKnowledgeDetailModal || (() => null);
    this.getMinimapRenderer = getMinimapRenderer || (() => null);
    this.getMessageHistoryDrawer = getMessageHistoryDrawer || (() => null);
    this.toggleSidePanel = toggleSidePanel || (() => null);
    this.onOpenKnowledgeInspector = onOpenKnowledgeInspector || (() => null);
    this.onOpenDiscoveryCodex = onOpenDiscoveryCodex || (() => null);

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
    const isDomInputActive = Boolean(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA'));

    const context = {
      isMinimapMaximized: Boolean(minimap && minimap.isMaximized),
      isDomInputActive,
      isMenuOpen,
      isTextWindowMode: Boolean(modal && modal.isTextWindowMode),
      isCharacterCreationOpen: Boolean(modal && modal.characterCreationModal && modal.characterCreationModal.isVisible),
      isSuggestActive,
      hasActiveCard: Boolean(activeCard)
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

      case ROUTE_ACTIONS.PASSTHROUGH_GAME_KEY:
        if (modal && modal.isAnyModalOpen && modal.isAnyModalOpen()) {
          return;
        }
        if (core && e.code) {
          // ブラウザ標準ショートカットの抑止 (Ctrl+P: 印刷, Ctrl+S: 保存, Ctrl+D: ブックマーク等)
          if (e.ctrlKey && ['KeyP', 'KeyS', 'KeyD', 'KeyO'].includes(e.code)) {
            e.preventDefault();
          }
          core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
        }
        return;

      default:
        break;
    }
  }
}
