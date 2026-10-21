/**
 * @file ClientLocalization.js
 * @description GKL Pure JS Client の多言語UIテキスト更新コントローラー
 */

import { CLIENT_DICTIONARY } from './clientDictionary.js';

export class ClientLocalization {
  /**
   * @param {Object} client - GklPureJSClient インスタンス参照
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * 言語変更を全サブコンポーネントおよびDOM要素へ適用
   * @param {string} lang - 'ja' または 'en'
   */
  applyLanguage(lang) {
    const isEn = lang === 'en';
    const dict = CLIENT_DICTIONARY[lang] || CLIENT_DICTIONARY.ja;
    const client = this.client;

    // 1. 各種レンダラー・ビュー・モーダルへの言語伝播
    client.mainViewportRenderer?.setLanguage(lang);
    client.minimapRenderer?.setLanguage(lang);
    client.updateViewModeUI?.();
    client.knowledgeView?.setLanguage(lang);
    client.inventoryView?.setLanguage(lang);
    client.assistHud?.setLanguage(lang);
    client.directionPad?.setLanguage(lang);
    client.statusView?.setLanguage(lang);
    client.modalManager?.setLanguage(lang);
    client.containerModal?.setLanguage(lang);
    client.paperdollModal?.setLanguage?.(lang);
    client.characterStatusModal?.setLanguage?.(lang);
    client.floorTrackerModal?.setLanguage?.(lang);
    client.codexModal?.setLanguage?.(lang);
    client.characterCreationModal?.setLanguage?.(lang);
    client.characterIntroModal?.setLanguage?.(lang);
    client.floatingActions?.setLanguage?.(lang);
    client.knowledgeDetailModal?.setLanguage?.(lang);
    client.floatingMessageHud?.setLanguage?.(lang);
    client.messageHistoryDrawer?.setLanguage?.(lang);
    client.engravingHud?.setLanguage?.(lang);
    client.adventureLogToast?.setLanguage?.(lang);

    const nhUiConfig = document.getElementById('nh-ui-config-modal-panel');
    if (nhUiConfig && typeof nhUiConfig.setLanguage === 'function') {
      nhUiConfig.setLanguage(lang);
    }
    const nhModalSettings = document.getElementById('nh-modal-settings');
    if (nhModalSettings) {
      nhModalSettings.setAttribute('title', dict.settingsTitle);
    }

    // 2. ヘッダー：サイドパネル開閉ボタンおよび履歴・設定
    const isCollapsed = Boolean(client.layoutConfig?.panelCollapsed);
    const btnToggleSidePanel = document.getElementById('btn-toggle-side-panel');
    const btnSidePanelLabel = document.getElementById('btn-side-panel-label');
    if (btnSidePanelLabel) {
      btnSidePanelLabel.textContent = isCollapsed
        ? dict.sidePanelLabelCollapsed
        : dict.sidePanelLabelExpanded;
    }
    if (btnToggleSidePanel) {
      btnToggleSidePanel.title = dict.toggleSidePanelTitle;
    }

    const btnCollapseSidePanel = document.getElementById('btn-collapse-side-panel');
    if (btnCollapseSidePanel) {
      btnCollapseSidePanel.title = dict.collapseSidePanelTitle;
    }

    const peekTab = document.getElementById('side-panel-peek-tab');
    if (peekTab) {
      peekTab.title = dict.expandSidePanelTitle;
      const peekLabel = peekTab.querySelector('.peek-tab-label');
      if (peekLabel) {
        peekLabel.textContent = dict.sidePanelPeekLabel;
      }
    }

    const btnOpenCharStatus = document.getElementById('btn-open-char-status');
    const lblCharStatus = document.getElementById('btn-char-status-label');
    if (lblCharStatus) {
      lblCharStatus.textContent = dict.charStatusLabel;
    } else if (btnOpenCharStatus) {
      btnOpenCharStatus.textContent = dict.charStatusLabel;
    }
    if (btnOpenCharStatus) {
      btnOpenCharStatus.title = dict.charStatusTitle;
    }

    const btnOpenPaperdollHdr = document.getElementById('btn-open-paperdoll-header');
    const lblPaperdollHdr = document.getElementById('btn-paperdoll-header-label');
    if (lblPaperdollHdr) {
      lblPaperdollHdr.textContent = dict.paperdollHeaderLabel;
    } else if (btnOpenPaperdollHdr) {
      btnOpenPaperdollHdr.textContent = dict.paperdollHeaderLabel;
    }
    if (btnOpenPaperdollHdr) {
      btnOpenPaperdollHdr.title = dict.paperdollHeaderTitle;
    }

    const btnOpenHistory = document.getElementById('btn-open-history');
    const lblHistory = document.getElementById('btn-history-label');
    if (lblHistory) {
      lblHistory.textContent = dict.historyLabel;
    } else if (btnOpenHistory) {
      btnOpenHistory.textContent = dict.historyLabel;
    }
    if (btnOpenHistory) {
      btnOpenHistory.title = dict.historyTitle;
    }

    const btnOpenCodex = document.getElementById('btn-open-codex');
    const lblCodex = document.getElementById('btn-codex-label');
    if (lblCodex) {
      lblCodex.textContent = dict.codexLabel;
    } else if (btnOpenCodex) {
      btnOpenCodex.textContent = dict.codexLabel;
    }
    if (btnOpenCodex) {
      btnOpenCodex.title = dict.codexTitle;
    }

    // 3. 設定ドロップダウンメニュー (settings-menu-dropdown)
    const btnSettingsToggle = document.getElementById('btn-settings-toggle');
    if (btnSettingsToggle) {
      btnSettingsToggle.textContent = dict.settingsMenuToggle;
      btnSettingsToggle.title = dict.settingsMenuToggleTitle;
    }

    // 3.1 外観・レイアウト
    const lblLayoutSec = document.getElementById('lbl-settings-layout-section');
    if (lblLayoutSec) lblLayoutSec.textContent = dict.layoutSection;

    const btnPresetClassic = document.getElementById('btn-preset-classic');
    if (btnPresetClassic) {
      btnPresetClassic.textContent = dict.presetClassic;
      btnPresetClassic.title = dict.presetClassicTitle;
    }
    const btnPresetModern = document.getElementById('btn-preset-modern');
    if (btnPresetModern) {
      btnPresetModern.textContent = dict.presetModern;
      btnPresetModern.title = dict.presetModernTitle;
    }
    const btnOpenUiConfig = document.getElementById('btn-open-ui-config');
    if (btnOpenUiConfig) {
      btnOpenUiConfig.textContent = dict.advancedUiConfig;
      btnOpenUiConfig.title = dict.advancedUiConfigTitle;
    }

    // 3.2 サイドパネル枠
    const lblPanelsSec = document.getElementById('lbl-settings-panels-section');
    if (lblPanelsSec) lblPanelsSec.textContent = dict.panelsSection;

    const chkInvSpan = document.querySelector('#chk-panel-inventory ~ span');
    if (chkInvSpan) chkInvSpan.textContent = dict.panelInventory;

    const chkActSpan = document.querySelector('#chk-panel-actions ~ span');
    if (chkActSpan) chkActSpan.textContent = dict.panelActions;

    const chkKnoSpan = document.querySelector('#chk-panel-knowledge ~ span');
    if (chkKnoSpan) chkKnoSpan.textContent = dict.panelKnowledge;

    const lblPanelHistoryDock = document.getElementById('lbl-panel-history-dock');
    if (lblPanelHistoryDock) {
      lblPanelHistoryDock.textContent = dict.panelHistoryDock;
    }

    // 3.3 ステータス ＆ HUD
    const lblStatusSec = document.getElementById('lbl-settings-status-section');
    if (lblStatusSec) lblStatusSec.textContent = dict.statusSection;

    const chk2LineSpan = document.querySelector('#chk-status-classic-2line ~ span');
    if (chk2LineSpan) chk2LineSpan.textContent = dict.statusClassic2Line;

    const chkGaugesSpan = document.querySelector('#chk-status-gauges ~ span');
    if (chkGaugesSpan) chkGaugesSpan.textContent = dict.statusGauges;

    const chkGklSpan = document.querySelector('#chk-status-gkl-extra ~ span');
    if (chkGklSpan) chkGklSpan.textContent = dict.statusGklExtra;

    // 3.35 キー入力 ＆ 操作
    const lblInputSec = document.getElementById('lbl-settings-input-section');
    if (lblInputSec) lblInputSec.textContent = dict.inputSection;

    const lblBypass = document.getElementById('lbl-bypass-enhanced-signals');
    if (lblBypass) lblBypass.textContent = dict.bypassEnhancedSignals;

    // ステータスバー詳細ボタン
    const btnToggleStatusDetails = document.getElementById('btn-toggle-status-details');
    if (btnToggleStatusDetails) {
      btnToggleStatusDetails.textContent = `👤 ${isEn ? 'Details' : '詳細'}`;
      btnToggleStatusDetails.title = dict.charStatusTitle;
    }

    // 3.4 表示・カメラ
    const lblViewSec = document.getElementById('lbl-settings-view-section');
    if (lblViewSec) lblViewSec.textContent = dict.viewSection;

    if (client.btnToggleMinimap) {
      client.btnToggleMinimap.textContent = dict.minimapPrefix + (client.minimapRenderer?.isVisible ? 'ON' : 'OFF');
      client.btnToggleMinimap.title = dict.minimapTitle;
    }

    const btnToggleDebugHud = document.getElementById('btn-toggle-debug-hud');
    if (btnToggleDebugHud) {
      const hud = client.webgpuRenderer?.debugHudElement || document.getElementById('webgpu-debug-hud');
      const isVisible = hud && hud.style.display !== 'none';
      btnToggleDebugHud.textContent = dict.debugHudPrefix + (isVisible ? 'ON' : 'OFF');
    }

    // 3.5 システム操作
    const lblSysSec = document.getElementById('lbl-settings-sys-section');
    if (lblSysSec) lblSysSec.textContent = dict.sysSection;

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.textContent = dict.restart;
      btnRestart.title = dict.restartTitle;
    }

    const btnDeleteSave = document.getElementById('btn-delete-save');
    if (btnDeleteSave) {
      btnDeleteSave.textContent = dict.deleteSave;
      btnDeleteSave.title = dict.deleteSaveTitle;
    }

    // 4. サイドパネル (gkl-side-panel) の各カード・ボタン
    const elInvHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(1) .gkl-card-header span');
    if (elInvHeader) elInvHeader.textContent = dict.invHeader;

    const btnOpenPaperdoll = document.getElementById('btn-open-paperdoll');
    if (btnOpenPaperdoll) {
      btnOpenPaperdoll.textContent = dict.paperdoll;
      btnOpenPaperdoll.title = dict.paperdollTitle;
    }

    const btnRefreshInv = document.getElementById('btn-refresh-inv');
    if (btnRefreshInv) {
      btnRefreshInv.textContent = dict.syncInv;
      btnRefreshInv.title = dict.syncInvTitle;
    }

    const invEmptyHint = document.querySelector('#gkl-inventory-grid .gkl-empty-hint');
    if (invEmptyHint) {
      invEmptyHint.textContent = dict.invEmpty;
    }

    const elActHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(2) .gkl-card-header span');
    if (elActHeader) elActHeader.textContent = dict.actHeader;

    const elKnHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(3) .gkl-card-header span');
    if (elKnHeader) elKnHeader.textContent = dict.knHeader;

    const knEmptyHint = document.querySelector('#gkl-knowledge-content .gkl-empty-hint');
    if (knEmptyHint) {
      knEmptyHint.textContent = dict.knEmpty;
    }

    const btnStartResume = document.getElementById('btn-start-resume');
    if (btnStartResume) btnStartResume.textContent = dict.startResume;

    const btnStartNew = document.getElementById('btn-start-new');
    if (btnStartNew) btnStartNew.textContent = dict.startNew;

    const btnStartFresh = document.getElementById('btn-start-fresh');
    if (btnStartFresh) btnStartFresh.textContent = dict.startFresh;

    const btnEnter = document.getElementById('btn-enter-dungeon');
    if (btnEnter) btnEnter.textContent = dict.enterDungeon;

    const readyMsg = document.getElementById('start-ready-msg');
    if (readyMsg) readyMsg.textContent = dict.readyMsg;

    const progressText = document.getElementById('start-card-progress-text');
    if (progressText) {
      progressText.textContent = client.isSaveResuming
        ? dict.progressRestoring
        : dict.progressGenerating;
    }

    if (client.knowledgeView?.currentBottomTab === 'knowledge' && client.lastKnowledgeTarget) {
      client.knowledgeView.renderKnowledgeCard(client.lastKnowledgeTarget);
    } else {
      client.knowledgeView?.renderSideAdvices?.();
    }

    if (client.core && client.core.gkl) {
      if (typeof client.core.gkl.setLanguage === 'function') {
        client.core.gkl.setLanguage(lang);
      }
      client.renderGklUi?.();
    }
  }
}
