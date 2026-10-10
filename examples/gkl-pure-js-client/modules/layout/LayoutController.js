/**
 * @file LayoutController.js
 * @description GKL Pure JS Client のレイアウト & プリセット外観管理コントローラー (UIConfigStore 連携)
 */

export class LayoutController {
  /**
   * @param {Object} client - GklPureJSClient インスタンス参照
   */
  constructor(client) {
    this.client = client;
    this.uiConfigStore = client.uiConfigStore;
    this.layoutConfig = this.uiConfigStore.get();
  }

  /**
   * レイアウト設定の初期化と自動サブスクライブ
   */
  init() {
    this.layoutConfig = this.uiConfigStore.get();
    if (this.layoutConfig.panelInventory === undefined) this.layoutConfig.panelInventory = true;
    if (this.layoutConfig.panelActions === undefined) this.layoutConfig.panelActions = true;
    if (this.layoutConfig.panelKnowledge === undefined) this.layoutConfig.panelKnowledge = true;

    this.applyLayoutConfig(this.layoutConfig);

    // 設定変更の自動リアクティブ反映
    this.uiConfigStore.subscribe((newConfig) => {
      this.layoutConfig = newConfig;
      this.client.layoutConfig = newConfig;
      this.applyLayoutConfig(this.layoutConfig);
    });
  }

  getDefaultLayoutConfig() {
    return this.uiConfigStore.getDefaultConfig();
  }

  loadLayoutConfig() {
    return this.uiConfigStore.load();
  }

  saveLayoutConfig(config) {
    this.layoutConfig = this.uiConfigStore.save(config);
    this.client.layoutConfig = this.layoutConfig;
    return this.layoutConfig;
  }

  /**
   * サイドパネルのクイック折りたたみ (一時退避) / 再展開をトグル
   * @param {boolean} [forceState] - 強制設定 (true: 折りたたみ退避, false: 再展開)
   */
  toggleSidePanel(forceState) {
    this.layoutConfig = this.uiConfigStore.toggleSidePanel(forceState);
    this.client.layoutConfig = this.layoutConfig;
    this.applyLayoutConfig(this.layoutConfig);
  }

  /**
   * レイアウト設定をDOMおよびコンポーネントへ適用
   * @param {Object} config
   */
  applyLayoutConfig(config) {
    this.layoutConfig = config;
    this.client.layoutConfig = config;
    const client = this.client;

    // 1. 各サイドパネルカードの表示/非表示
    const cardInv = document.getElementById('card-inventory');
    const cardAct = document.getElementById('card-actions');
    const cardKno = document.getElementById('card-knowledge');
    const sidePanel = document.getElementById('gkl-side-panel');
    const workspace = document.querySelector('.gkl-workspace');
    const peekTab = document.getElementById('side-panel-peek-tab');
    const btnToggleSidePanel = document.getElementById('btn-toggle-side-panel');
    const btnSidePanelLabel = document.getElementById('btn-side-panel-label');

    if (cardInv) cardInv.classList.toggle('hidden', !config.panelInventory);
    if (cardAct) cardAct.classList.toggle('hidden', !config.panelActions);
    if (cardKno) cardKno.classList.toggle('hidden', !config.panelKnowledge);

    // 過去ログの左側常時固定 (ピン留め) 反映
    if (client.messageHistoryDrawer && typeof client.messageHistoryDrawer.setPinned === 'function') {
      client.messageHistoryDrawer.setPinned(Boolean(config.panelHistoryDock), true);
    }

    // 3枠すべて非表示ならサイドパネル全体を隠し、1カラム全画面化
    const isAllHidden = !config.panelInventory && !config.panelActions && !config.panelKnowledge;
    const isCollapsed = Boolean(config.panelCollapsed);

    if (sidePanel) {
      sidePanel.classList.toggle('hidden', isAllHidden);
      sidePanel.classList.toggle('collapsed', isCollapsed && !isAllHidden);
    }
    if (workspace) workspace.classList.toggle('no-sidebar', isAllHidden || isCollapsed);

    // 復帰用peek-tab (パネル退避時かつ全非表示でない時に画面右端に出現)
    if (peekTab) {
      peekTab.classList.toggle('hidden', !isCollapsed || isAllHidden);
      const isEn = client.currentLanguage === 'en';
      peekTab.title = isEn ? 'Expand side panel [ F2/Alt+S ]' : 'サイドパネルを再展開 [ F2/Alt+S ]';
      const peekLabel = peekTab.querySelector('.peek-tab-label');
      if (peekLabel) {
        peekLabel.textContent = isEn ? '🎒 Panel' : '🎒 パネル';
      }
    }

    // ヘッダー内サイドパネルトグルボタンの見た目同期
    if (btnToggleSidePanel) {
      btnToggleSidePanel.classList.toggle('is-collapsed', isCollapsed);
      const isEn = client.currentLanguage === 'en';
      btnToggleSidePanel.title = isEn
        ? 'Toggle side panel [ F2/Alt+S ]'
        : 'サイドパネル一時退避 / 再展開 [ F2/Alt+S ]';
      if (btnSidePanelLabel) {
        btnSidePanelLabel.textContent = isCollapsed
          ? (isEn ? '🎒 Panel ⏴' : '🎒 パネル ⏴')
          : (isEn ? '🎒 Panel ⏵' : '🎒 パネル ⏵');
      }
    }

    // ミニマップの位置をサイドパネル＆ピン留めドロワーの状態と自動同期 (退避時は画面右端へスムーズ追従)
    const minimapBox = document.getElementById('minimap-hud-box');
    if (minimapBox) {
      minimapBox.classList.toggle('with-side-panel', !isAllHidden && !isCollapsed);
      minimapBox.classList.toggle('with-pinned-drawer', Boolean(config.panelHistoryDock));
    }

    // 2. ステータスバー設定
    if (client.statusView) {
      client.statusView.setLayoutMode(config.statusClassic2Line ? 'classic' : 'modern');
      client.statusView.setGaugeVisibility(config.statusGauges);
      client.statusView.setGklExtraVisibility(config.statusGklExtra);
    }

    // 3. 設定メニュー内チェックボックスの同期
    const chkInv = document.getElementById('chk-panel-inventory');
    const chkAct = document.getElementById('chk-panel-actions');
    const chkKno = document.getElementById('chk-panel-knowledge');
    const chkDock = document.getElementById('chk-panel-history-dock');
    const chk2Line = document.getElementById('chk-status-classic-2line');
    const chkGauges = document.getElementById('chk-status-gauges');
    const chkGkl = document.getElementById('chk-status-gkl-extra');

    if (chkInv) chkInv.checked = Boolean(config.panelInventory);
    if (chkAct) chkAct.checked = Boolean(config.panelActions);
    if (chkKno) chkKno.checked = Boolean(config.panelKnowledge);
    if (chkDock) chkDock.checked = Boolean(config.panelHistoryDock);
    if (chk2Line) chk2Line.checked = Boolean(config.statusClassic2Line);
    if (chkGauges) chkGauges.checked = Boolean(config.statusGauges);
    if (chkGkl) chkGkl.checked = Boolean(config.statusGklExtra);

    // 4. プリセットボタンのアクティブ表示同期
    const btnClassic = document.getElementById('btn-preset-classic');
    const btnModern = document.getElementById('btn-preset-modern');
    if (btnClassic) btnClassic.classList.toggle('active', config.preset === 'classic');
    if (btnModern) btnModern.classList.toggle('active', config.preset === 'modern');

    // 5. プリセットに応じたビューの初期復元
    if (config.preset === 'classic' && client.currentViewMode !== 'ascii') {
      client.setViewMode('ascii');
    }

    // 6. フローティングメッセージ待機時間設定の反映
    if (client.floatingMessageHud && typeof config.hudFadeDelay === 'number') {
      client.floatingMessageHud.setFadeDelay(config.hudFadeDelay);
    }

    // 7. 神託公式ガイドモード (常時閲覧) の反映
    const oracleGuide = Boolean(config.oracleGuideAlwaysUnlocked);
    const alm = client.codexModal?.getAdventureLogManager?.() || client.adventureLogManager;
    if (alm && typeof alm.setOracleGuideAlwaysUnlocked === 'function') {
      alm.setOracleGuideAlwaysUnlocked(oracleGuide);
    }
    if (client.codexModal && typeof client.codexModal.updateSummary === 'function') {
      client.codexModal.updateSummary();
    }

  }

  /**
   * プリセット（classic / modern）の適用
   * @param {string} presetName
   */
  setPreset(presetName) {
    const client = this.client;
    if (presetName === 'classic') {
      client.setViewMode('ascii');
      if (client.minimapRenderer && client.minimapRenderer.isVisible) {
        client.minimapRenderer.toggleVisibility(false);
      }
    } else if (presetName === 'modern') {
      client.setViewMode('hd2d');
      if (client.minimapRenderer && !client.minimapRenderer.isVisible) {
        client.minimapRenderer.toggleVisibility(true);
      }
    }
    this.layoutConfig = this.uiConfigStore.applyPreset(presetName);
    this.client.layoutConfig = this.layoutConfig;
    this.applyLayoutConfig(this.layoutConfig);
  }

  /**
   * レイアウト・外観関連の DOM イベントをバインド
   */
  bindLayoutEvents() {
    const btnPresetClassic = document.getElementById('btn-preset-classic');
    if (btnPresetClassic) {
      btnPresetClassic.onclick = () => this.setPreset('classic');
    }
    const btnPresetModern = document.getElementById('btn-preset-modern');
    if (btnPresetModern) {
      btnPresetModern.onclick = () => this.setPreset('modern');
    }

    const bindLayoutCheckbox = (id, propName) => {
      const el = document.getElementById(id);
      if (el) {
        el.onchange = (e) => {
          this.layoutConfig = this.uiConfigStore.setProperty(propName, Boolean(e.target.checked));
          this.client.layoutConfig = this.layoutConfig;
          this.applyLayoutConfig(this.layoutConfig);
        };
      }
    };
    bindLayoutCheckbox('chk-panel-inventory', 'panelInventory');
    bindLayoutCheckbox('chk-panel-actions', 'panelActions');
    bindLayoutCheckbox('chk-panel-knowledge', 'panelKnowledge');
    bindLayoutCheckbox('chk-panel-history-dock', 'panelHistoryDock');
    bindLayoutCheckbox('chk-status-classic-2line', 'statusClassic2Line');
    bindLayoutCheckbox('chk-status-gauges', 'statusGauges');
    bindLayoutCheckbox('chk-status-gkl-extra', 'statusGklExtra');

    // Web Components (<nh-ui-config> & <nh-modal>) 連携
    const nhUiConfig = document.getElementById('nh-ui-config-modal-panel');
    const nhModalSettings = document.getElementById('nh-modal-settings');
    const btnOpenUiConfig = document.getElementById('btn-open-ui-config');

    if (nhUiConfig && typeof nhUiConfig.setConfigStore === 'function') {
      nhUiConfig.setConfigStore(this.uiConfigStore);
      if (typeof nhUiConfig.setLanguage === 'function') {
        nhUiConfig.setLanguage(this.client.currentLanguage);
      }
      nhUiConfig.addEventListener('config-change', (e) => {
        this.layoutConfig = e.detail?.config || this.uiConfigStore.get();
        this.client.layoutConfig = this.layoutConfig;
        this.applyLayoutConfig(this.layoutConfig);
      });
      nhUiConfig.addEventListener('preset-change', (e) => {
        if (e.detail?.preset) {
          this.setPreset(e.detail.preset);
        }
      });
    }

    if (btnOpenUiConfig && nhModalSettings) {
      btnOpenUiConfig.onclick = () => {
        const isEn = this.client.currentLanguage === 'en';
        nhModalSettings.setAttribute('title', isEn ? '⚙️ Settings & UI Customization' : '⚙️ 環境設定・UIカスタマイズ');
        if (nhUiConfig && typeof nhUiConfig.setLanguage === 'function') {
          nhUiConfig.setLanguage(this.client.currentLanguage);
        }
        nhModalSettings.open = true;
        if (this.client.settingsDropdown) {
          this.client.settingsDropdown.classList.add('hidden');
        }
      };
    }

    // サブウィンドウ (右サイドパネル) のワンタップ一時退避 ＆ 再展開リスナー
    const btnToggleSidePanel = document.getElementById('btn-toggle-side-panel');
    if (btnToggleSidePanel) btnToggleSidePanel.onclick = () => this.toggleSidePanel();

    const sidePanelPeekTab = document.getElementById('side-panel-peek-tab');
    if (sidePanelPeekTab) sidePanelPeekTab.onclick = () => this.toggleSidePanel(false);

    const btnCollapseSidePanel = document.getElementById('btn-collapse-side-panel');
    if (btnCollapseSidePanel) btnCollapseSidePanel.onclick = () => this.toggleSidePanel(true);

    if (typeof window !== 'undefined') {
      window.toggleSidePanel = (forceState) => this.toggleSidePanel(forceState);
    }
  }
}
