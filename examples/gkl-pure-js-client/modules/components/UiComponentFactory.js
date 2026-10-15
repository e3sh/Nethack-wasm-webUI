/**
 * @file UiComponentFactory.js
 * @description GKL Pure JS Client の全UIコンポーネント・レンダラー・モーダルのインスタンス化＆相互配線ファクトリ
 */

import { MainViewportRenderer } from '../renderers/MainViewportRenderer.js';
import { MinimapHudRenderer } from '../renderers/MinimapHudRenderer.js';
import { VirtualDungeonScreen } from '../renderers/VirtualDungeonScreen.js';
import { WebGPUHD2DRenderer } from '../renderers/WebGPUHD2DRenderer.js';
import { KnowledgeView } from './KnowledgeView.js';
import { InventoryView } from './InventoryView.js';
import { AssistHud } from './AssistHud.js';
import { DirectionPad } from './DirectionPad.js';
import { StatusView } from './StatusView.js';
import { ModalManager } from './ModalManager.js';
import { CharacterCreationModal } from './CharacterCreationModal.js';
import { CharacterIntroModal } from './CharacterIntroModal.js';
import { ContainerModal } from './ContainerModal.js';
import { PaperdollModal } from './PaperdollModal.js';
import { CodexModal } from './CodexModal.js';
import { KnowledgeDetailModal } from './KnowledgeDetailModal.js';
import { EngravingHud } from './EngravingHud.js';
import { FloatingContextActions } from './FloatingContextActions.js';
import { AdventureLogToast } from './AdventureLogToast.js';
import { FloatingMessageHud } from './FloatingMessageHud.js';
import { MessageHistoryDrawer } from './MessageHistoryDrawer.js';
import { KeyHandler } from '../handlers/KeyHandler.js';
import { getDefaultTilePath } from '../config/TileConfig.js';

export class UiComponentFactory {
  /**
   * 全UIコンポーネントおよびレンダラーをインスタンス化し client にバインド
   * @param {Object} client - GklPureJSClient インスタンス
   */
  static createAndBindComponents(client) {
    // DOM Elements
    client.canvas = document.getElementById('game-canvas');
    client.webgpuCanvas = document.getElementById('webgpu-canvas');
    client.asciiGrid = document.getElementById('ascii-grid');
    client.btnToggleView = document.getElementById('btn-toggle-view');
    client.btnToggleCameraMode = document.getElementById('btn-toggle-camera-mode');
    client.btnToggleMinimap = document.getElementById('btn-toggle-minimap') || document.getElementById('btn-toggle-zoom');
    client.btnToggleZoom = client.btnToggleMinimap; // 後方互換
    client.btnSettingsToggle = document.getElementById('btn-settings-toggle');
    client.settingsDropdown = document.getElementById('settings-menu-dropdown');
    client.elMessageLog = document.getElementById('message-log');
    client.elGklTooltip = document.getElementById('gkl-item-tooltip');

    // 💬 フローティング最新行 HUD
    client.floatingMessageHud = new FloatingMessageHud({
      container: document.getElementById('floating-message-hud'),
      maxLines: 5,
      fadeTimeoutMs: 0,
      fadeDelayAfterActionMs: 2500
    });

    // 📜 展開型過去ログドロワー
    client.messageHistoryDrawer = new MessageHistoryDrawer({
      drawerElement: document.getElementById('message-history-drawer'),
      listElement: document.getElementById('message-drawer-list'),
      backdropElement: document.getElementById('drawer-backdrop'),
      btnClose: document.getElementById('btn-drawer-close'),
      btnPin: document.getElementById('btn-drawer-pin'),
      btnModeBilingual: document.getElementById('btn-drawer-mode-bilingual'),
      btnModeJa: document.getElementById('btn-drawer-mode-ja'),
      btnModeRaw: document.getElementById('btn-drawer-mode-raw'),
      language: client.currentLanguage,
      onPinStateChanged: (isPinned) => {
        if (client.uiConfigStore) {
          client.layoutConfig = client.uiConfigStore.setProperty('panelHistoryDock', isPinned);
        }
        const chkDock = document.getElementById('chk-panel-history-dock');
        if (chkDock) chkDock.checked = isPinned;
        const minimapBox = document.getElementById('minimap-hud-box');
        if (minimapBox) minimapBox.classList.toggle('with-pinned-drawer', isPinned);
      },
      getCore: () => client.core
    });

    const btnOpenHistory = document.getElementById('btn-open-history');
    if (btnOpenHistory) {
      btnOpenHistory.onclick = () => {
        client.messageHistoryDrawer.toggle();
      };
    }

    client.currentViewMode = 'graphic'; // 'graphic' | 'ascii' | 'hd2d'

    // 0. 仮想スクリーン統合背景マネージャー
    client.virtualScreen = new VirtualDungeonScreen();

    // 1. メインビューポートレンダラー
    client.mainViewportRenderer = new MainViewportRenderer({
      canvas: client.canvas,
      asciiGrid: client.asciiGrid,
      btnToggleView: client.btnToggleView,
      virtualScreen: client.virtualScreen,
      getAreaGrid: () => client.core?.gkl?.getSituation()?.area?.grid,
      getSituation: () => client.core?.gkl?.getSituation(),
      getCore: () => client.core,
      tileSource: client.layoutConfig?.tileImage
    });
    client.mapRenderer = client.mainViewportRenderer; // 後方互換

    // 1.5. WebGPU HD2D Renderer
    client.webgpuRenderer = new WebGPUHD2DRenderer({
      canvas: client.webgpuCanvas,
      getSituation: () => client.core?.gkl?.getSituation(),
      getAreaGrid: () => client.core?.gkl?.getSituation()?.area?.grid,
      getGlyphBuffer: () => client.mainViewportRenderer.glyphGridBuffer,
      getCore: () => client.core,
      getTileImg: () => client.mainViewportRenderer.tileImg,
      isTileLoaded: () => client.mainViewportRenderer.tileLoaded,
      tileSource: client.layoutConfig?.tileImage
    });

    // 2. ミニマップ HUD レンダラー
    client.minimapRenderer = new MinimapHudRenderer({
      minimapCanvas: document.getElementById('minimap-canvas'),
      minimapHudBox: document.getElementById('minimap-hud-box') || document.getElementById('zoom-viewport-box'),
      minimapPosBadge: document.getElementById('minimap-pos-badge') || document.getElementById('zoom-pos-badge'),
      btnToggleMinimap: document.getElementById('btn-minimap-toggle'),
      virtualScreen: client.virtualScreen,
      getSituation: () => client.core?.gkl?.getSituation(),
      getCore: () => client.core
    });
    client.zoomRenderer = client.mainViewportRenderer; // 後方互換

    // 3. Knowledge & Advices View
    client.knowledgeView = new KnowledgeView({
      elGklKnowledgeContent: document.getElementById('gkl-knowledge-content'),
      getCore: () => client.core,
      onTabChanged: () => {}
    });

    // 4. Inventory View
    client.inventoryView = new InventoryView({
      elGklInventoryGrid: document.getElementById('gkl-inventory-grid'),
      elGklInvCount: document.getElementById('gkl-inv-count'),
      elGklTooltip: client.elGklTooltip,
      elGklTtName: document.getElementById('gkl-tt-name'),
      elGklTtTags: document.getElementById('gkl-tt-tags'),
      getCore: () => client.core,
      getLoadedTileImagePath: () => client.mapRenderer.loadedTileImagePath,
      onInspectItem: (item) => {
        if (client.knowledgeDetailModal) {
          client.knowledgeDetailModal.open(item);
        } else if (client.knowledgeView) {
          client.knowledgeView.renderKnowledgeCard(item);
        }
      }
    });

    // 5. Assist HUD & Landmarks
    client.assistHud = new AssistHud({
      elAssistSignalBar: document.getElementById('assist-signal-bar'),
      elAssistSignalIcon: document.getElementById('assist-signal-icon'),
      elAssistSignalText: document.getElementById('assist-signal-text'),
      elBtnAssistAction: document.getElementById('btn-assist-action'),
      elAssistActionLabel: document.getElementById('assist-action-label'),
      elBtnAssistWhy: document.getElementById('btn-assist-why'),
      elAssistWhyTooltip: document.getElementById('assist-why-tooltip'),
      elFloorLandmarksHud: document.getElementById('floor-landmarks-hud'),
      elLandmarksFloorTag: document.getElementById('landmarks-floor-tag'),
      elLandmarksBadgesContainer: document.getElementById('landmarks-badges-container'),
      getCore: () => client.core
    });

    // 6. Direction Pad & Recommended Actions
    client.directionPad = new DirectionPad({
      elGklDirectionPad: document.getElementById('gkl-direction-pad'),
      elGklFilterLabel: document.getElementById('gkl-filter-label'),
      elBtnDirReset: document.getElementById('btn-dir-reset'),
      elGklActionList: document.getElementById('gkl-action-list'),
      elGklActionCount: document.getElementById('gkl-action-count'),
      getCore: () => client.core,
      onDirectionFiltered: () => client.renderGklUi(),
      onUserAction: () => client.floatingMessageHud?.notifyUserAction()
    });

    // 7. Status Bar
    client.statusView = new StatusView({
      elStatusBar: document.getElementById('status-bar'),
      elBtnToggleStatusDetails: document.getElementById('btn-toggle-status-details'),
      elStName: document.getElementById('st-name'),
      elStDlvl: document.getElementById('st-dlvl'),
      elStHp: document.getElementById('st-hp'),
      elStPw: document.getElementById('st-pw'),
      elStAc: document.getElementById('st-ac'),
      elStGold: document.getElementById('st-gold'),
      elStCond: document.getElementById('st-cond'),
      elHpBarFill: document.getElementById('hp-bar-fill'),
      elMpBarFill: document.getElementById('mp-bar-fill'),
      elStStr: document.getElementById('st-str'),
      elStDex: document.getElementById('st-dex'),
      elStCon: document.getElementById('st-con'),
      elStInt: document.getElementById('st-int'),
      elStWis: document.getElementById('st-wis'),
      elStCha: document.getElementById('st-cha'),
      elStAlign: document.getElementById('st-align'),
      elStExp: document.getElementById('st-exp'),
      elStTurns: document.getElementById('st-turns'),
      elStScore: document.getElementById('st-score'),
      elStItemTurns: document.getElementById('st-item-turns'),
      elStItemScore: document.getElementById('st-item-score'),
      getCore: () => client.core,
      getLoadedTileImagePath: () => client.mapRenderer.loadedTileImagePath
    });

    // 7.5 Engraving HUD
    client.engravingHud = new EngravingHud({
      elEngravingHud: document.getElementById('engraving-hud'),
      elEngravingHudIcon: document.getElementById('engraving-hud-icon'),
      elEngravingActual: document.getElementById('engraving-actual'),
      elEngravingArrow: document.getElementById('engraving-arrow'),
      elEngravingPristine: document.getElementById('engraving-pristine'),
      elEngravingConfidenceBadge: document.getElementById('engraving-confidence-badge'),
      elEngravingTranslation: document.getElementById('engraving-translation'),
      elEngravingSourceBadge: document.getElementById('engraving-source-badge'),
      elBtnEngraveReapply: document.getElementById('btn-engrave-reapply'),
      elBtnEngravingClose: document.getElementById('btn-engraving-close'),
      getCore: () => client.core,
      language: client.currentLanguage
    });

    // 8. Character Creation Modal
    client.characterCreationModal = new CharacterCreationModal({
      getCore: () => client.core
    });

    // 8.05 Character Intro Modal
    client.characterIntroModal = new CharacterIntroModal({
      getCore: () => client.core,
      characterCreationModal: client.characterCreationModal,
      currentLanguage: client.currentLanguage
    });

    // 8.1 Modal Manager
    client.modalManager = new ModalManager({
      elPromptBar: document.getElementById('prompt-bar'),
      elPromptText: document.getElementById('prompt-text'),
      elInputControls: document.getElementById('input-controls'),
      elMenuModal: document.getElementById('menu-modal'),
      elMenuTitle: document.getElementById('menu-title'),
      elMenuItemsContainer: document.getElementById('menu-items-container'),
      elBtnCancelMenu: document.getElementById('btn-cancel-menu'),
      elGameOverModal: document.getElementById('gameover-modal'),
      elGameOverSummary: document.getElementById('gameover-summary'),
      elScoreboardContainer: document.getElementById('gameover-scoreboard'),
      elLoading: document.getElementById('loading-overlay'),
      elSpinnerBox: document.getElementById('loading-spinner-box'),
      elSelectorCard: document.getElementById('start-selector-card'),
      elSaveName: document.getElementById('start-save-name'),
      elWishModal: document.getElementById('wish-modal'),
      characterCreationModal: client.characterCreationModal,
      characterIntroModal: client.characterIntroModal,
      getCore: () => client.core,
      getLoadedTileImagePath: () => client.mapRenderer.loadedTileImagePath,
      onRestartGame: () => client.restartGame()
    });

    // 8.5 Container Modal
    client.containerModal = new ContainerModal({
      elContainerModal: document.getElementById('container-modal'),
      getCore: () => client.core,
      getContainerController: () => client.containerController,
      getLoadedTileImagePath: () => client.mapRenderer.loadedTileImagePath,
    });

    // 8.6 Equipment Paperdoll Modal
    client.paperdollModal = new PaperdollModal({
      elPaperdollModal: document.getElementById('paperdoll-modal'),
      getCore: () => client.core,
      getLoadedTileImagePath: () => client.mapRenderer.loadedTileImagePath,
      onInspectItem: (item) => {
        if (client.knowledgeDetailModal) {
          client.knowledgeDetailModal.open(item);
        } else if (client.knowledgeView) {
          client.knowledgeView.renderKnowledgeCard(item);
        }
      }
    });

    // 8.7 Codex Modal
    client.codexModal = new CodexModal({
      elCodexModal: document.getElementById('codex-modal'),
      getCore: () => client.core,
      getLoadedTileImagePath: () => client.mapRenderer?.loadedTileImagePath,
      language: client.currentLanguage,
      onUnreadCountChanged: (count) => client.updateCodexBadge(count),
      onClose: () => {}
    });

    // 8.8 Detailed Knowledge Modal
    client.knowledgeDetailModal = new KnowledgeDetailModal({
      getCore: () => client.core,
      getLoadedTileImagePath: () => client.mapRenderer.loadedTileImagePath,
      language: client.currentLanguage,
      onCastSpellRequested: (letter) => {
        if (client.statusView) client.statusView.castSpell(letter);
      },
      onActionTriggered: () => client.floatingMessageHud?.notifyUserAction()
    });

    // 8.9 Smart Floating ContextActions Menu
    const viewportContainer = typeof document !== 'undefined' ? document.querySelector('.game-viewport') : null;
    client.floatingActions = new FloatingContextActions({
      container: viewportContainer,
      getCore: () => client.core,
      language: client.currentLanguage,
      onInspectDetail: (targetData) => {
        if (client.knowledgeDetailModal) {
          client.knowledgeDetailModal.open(targetData);
        }
      },
      onNavigateKnowledge: (targetData) => {
        if (client.knowledgeDetailModal) {
          client.knowledgeDetailModal.open(targetData);
        } else if (client.codexModal) {
          client.codexModal.open();
        }
      },
      onUserAction: () => {
        client.floatingMessageHud?.notifyUserAction();
      }
    });

    // 8.95 Adventure Log Toast
    client.adventureLogToast = new AdventureLogToast({
      container: document.body,
      tileImage: getDefaultTilePath(),
      getLoadedTileImagePath: () => client.mapRenderer?.loadedTileImagePath,
      language: client.currentLanguage,
      onToastClick: () => {
        if (client.codexModal) {
          client.codexModal.open();
        }
      }
    });

    // 9. Key Handler
    client.keyHandler = new KeyHandler({
      getCore: () => client.core,
      getModalManager: () => client.modalManager,
      getContainerModal: () => client.containerModal,
      getPaperdollModal: () => client.paperdollModal,
      getCodexModal: () => client.codexModal,
      getKnowledgeDetailModal: () => client.knowledgeDetailModal,
      getMinimapRenderer: () => client.minimapRenderer,
      getMessageHistoryDrawer: () => client.messageHistoryDrawer,
      toggleSidePanel: (forceState) => client.toggleSidePanel(forceState),
      onOpenKnowledgeInspector: () => client.openKnowledgeInspector(),
      onOpenDiscoveryCodex: () => client.openDiscoveryCodex()
    });

  }
}
