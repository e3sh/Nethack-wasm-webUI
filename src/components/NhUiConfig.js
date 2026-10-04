/**
 * NhUiConfig.js
 *
 * <nh-ui-config> Web Component
 * UIConfigStore と連携し、外観・レイアウト設定やプリセット（クラシック / モダン）切り替え UI を提供。
 */

import { NhBaseElement } from './NhBaseElement.js';
import { UIConfigStore, PRESETS } from '../ui-controller/UIConfigStore.js';

const CONFIG_CSS = `
:host {
  display: block;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.config-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid var(--nh-border-color);
  border-radius: 10px;
  padding: 16px 20px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--nh-primary-color);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Preset Buttons */
.preset-group {
  display: flex;
  gap: 8px;
}

.preset-btn {
  flex: 1;
  padding: 8px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--nh-border-color);
  background: rgba(22, 33, 62, 0.5);
  color: var(--nh-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.preset-btn:hover {
  background: rgba(30, 41, 59, 0.8);
  color: var(--nh-text-main);
}

.preset-btn.active {
  background: rgba(14, 165, 233, 0.25);
  border-color: var(--nh-primary-color);
  color: var(--nh-primary-color);
  box-shadow: 0 0 10px var(--nh-primary-glow);
}

/* Toggle Rows */
.toggle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(22, 33, 62, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 0.85rem;
}

.toggle-label {
  color: var(--nh-text-main);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 20px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.15);
  transition: .3s;
  border-radius: 20px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--nh-primary-color);
  box-shadow: 0 0 8px var(--nh-primary-glow);
}

input:checked + .slider:before {
  transform: translateX(18px);
}

/* Select Rows */
.select-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(22, 33, 62, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  font-size: 0.85rem;
}

.config-select {
  background: rgba(15, 23, 42, 0.9);
  color: var(--nh-text-main);
  border: 1px solid var(--nh-border-color);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.config-select:focus {
  border-color: var(--nh-primary-color);
  box-shadow: 0 0 6px var(--nh-primary-glow);
}
`;

export const UI_CONFIG_I18N = {
  ja: {
    sectionPreset: '🎨 UI プリセット',
    presetModern: 'モダン (推奨)',
    presetClassic: 'クラシック',
    presetCustom: 'カスタム',
    sectionPanels: '📐 パネル表示',
    panelInventory: '🎒 所持品パネル',
    panelActions: '⚡ アクションパネル',
    panelKnowledge: '📖 知識図鑑パネル',
    panelHistoryDock: '📜 過去ログドック',
    sectionStatus: '📊 ステータス表示',
    statusClassic2Line: '2行クラシック表示',
    statusGauges: 'グラフィカルゲージ (HP/MP)',
    statusGklExtra: 'GKL 拡張情報表示',
    sectionMessages: '⏱️ フローティングメッセージ',
    labelHudFadeDelay: '操作後の消去待機時間',
    hudFadeFast: '⚡ 1.2s - 早い',
    hudFadeNormal: '⏱️ 2.5s - 標準',
    hudFadeSlow: '⏳ 4.0s - ゆっくり',
    sectionGameplay: '🎮 難易度調整・探索アシスト',
    oracleGuideAlwaysUnlocked: '🔮 神託公式ガイドモード (常時閲覧・ネタバレ許可)',
    btnResetDefaults: '初期設定に戻す'
  },
  en: {
    sectionPreset: '🎨 UI Presets',
    presetModern: 'Modern (Recommended)',
    presetClassic: 'Classic',
    presetCustom: 'Custom',
    sectionPanels: '📐 Panel Display',
    panelInventory: '🎒 Inventory Panel',
    panelActions: '⚡ Actions Panel',
    panelKnowledge: '📖 Codex / Knowledge Panel',
    panelHistoryDock: '📜 Message History Dock',
    sectionStatus: '📊 Status Display',
    statusClassic2Line: 'Classic 2-Line Status',
    statusGauges: 'Graphical Gauges (HP/MP)',
    statusGklExtra: 'GKL Extended Status',
    sectionMessages: '⏱️ Floating Messages',
    labelHudFadeDelay: 'Fade delay after action',
    hudFadeFast: '⚡ 1.2s - Fast',
    hudFadeNormal: '⏱️ 2.5s - Standard',
    hudFadeSlow: '⏳ 4.0s - Relaxed',
    sectionGameplay: '🎮 Difficulty & Gameplay Assist',
    oracleGuideAlwaysUnlocked: '🔮 Oracle Guide Mode (Always Unlocked / Spoilers Allowed)',
    btnResetDefaults: 'Reset to Defaults'
  }
};

export class NhUiConfig extends NhBaseElement {
  static get observedAttributes() {
    return ['preset', 'lang'];
  }

  constructor() {
    super({ customCss: CONFIG_CSS });

    this.currentLanguage = this.getAttribute('lang') || 'ja';
    this.store = new UIConfigStore();
  }

  connectedCallback() {
    super.connectedCallback();
    this.subscribeController(this.store, () => {
      this._updateFormValues();
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'preset' && newValue) {
      this.store.applyPreset(newValue);
    } else if (name === 'lang' && newValue) {
      this.setLanguage(newValue);
    }
  }

  /**
   * 言語の切り替え ('ja' | 'en')
   * @param {string} lang
   */
  setLanguage(lang) {
    const normalized = (lang === 'en' || lang === 'ja') ? lang : 'ja';
    if (this.currentLanguage === normalized && this.shadowRoot && this.shadowRoot.querySelector('.config-container')) {
      return;
    }
    this.currentLanguage = normalized;
    this.render();
  }

  /**
   * 外部 UIConfigStore の注入
   * @param {UIConfigStore} store
   */
  setConfigStore(store) {
    if (!store) return;
    this._cleanupSubscriptions();
    this.store = store;
    this.subscribeController(this.store, () => {
      this._updateFormValues();
    });
    this._updateFormValues();
  }

  getConfig() {
    return this.store.get();
  }

  setConfig(key, value) {
    this.store.setProperty(key, value);
    this.emit('config-change', { config: this.store.get(), key, value });
  }

  resetDefaults() {
    if (typeof this.store.resetDefaults === 'function') {
      this.store.resetDefaults();
    } else {
      this.store.save(this.store.getDefaultConfig());
    }
    this.emit('config-change', { config: this.store.get() });
  }

  render() {
    if (!this.shadowRoot) return;

    const t = UI_CONFIG_I18N[this.currentLanguage] || UI_CONFIG_I18N.ja;

    this.shadowRoot.innerHTML = `
      <div class="config-container">
        <!-- プリセット選択 -->
        <div class="config-section">
          <div class="section-title">${t.sectionPreset}</div>
          <div class="preset-group">
            <button class="preset-btn" data-preset="${PRESETS.MODERN}">${t.presetModern}</button>
            <button class="preset-btn" data-preset="${PRESETS.CLASSIC}">${t.presetClassic}</button>
            <button class="preset-btn" data-preset="${PRESETS.CUSTOM}">${t.presetCustom}</button>
          </div>
        </div>

        <!-- パネル表示設定 -->
        <div class="config-section">
          <div class="section-title">${t.sectionPanels}</div>
          <div class="toggle-grid">
            <div class="toggle-row">
              <span class="toggle-label">${t.panelInventory}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelInventory">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">${t.panelActions}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelActions">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">${t.panelKnowledge}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelKnowledge">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">${t.panelHistoryDock}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelHistoryDock">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- ステータス設定 -->
        <div class="config-section">
          <div class="section-title">${t.sectionStatus}</div>
          <div class="toggle-grid">
            <div class="toggle-row">
              <span class="toggle-label">${t.statusClassic2Line}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="statusClassic2Line">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">${t.statusGauges}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="statusGauges">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">${t.statusGklExtra}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="statusGklExtra">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- フローティングメッセージ待機時間設定 -->
        <div class="config-section">
          <div class="section-title">${t.sectionMessages}</div>
          <div class="select-row">
            <span class="toggle-label">${t.labelHudFadeDelay}</span>
            <select class="config-select" data-config-key="hudFadeDelay">
              <option value="1200">${t.hudFadeFast}</option>
              <option value="2500">${t.hudFadeNormal}</option>
              <option value="4000">${t.hudFadeSlow}</option>
            </select>
          </div>
        </div>

        <!-- ゲームプレイ難易度設定 / 探索アシスト -->
        <div class="config-section">
          <div class="section-title">${t.sectionGameplay}</div>
          <div class="toggle-grid">
            <div class="toggle-row">
              <span class="toggle-label">${t.oracleGuideAlwaysUnlocked}</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="oracleGuideAlwaysUnlocked">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <button class="nh-btn btn-reset-defaults">${t.btnResetDefaults}</button>
        </div>
      </div>
    `;

    // プリセットボタンのリスナー
    const presetBtns = this.shadowRoot.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.store.applyPreset(preset);
        this.emit('preset-change', { preset, config: this.store.get() });
      });
    });

    // トグルスイッチのリスナー
    const checkboxes = this.shadowRoot.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const key = cb.dataset.configKey;
        this.setConfig(key, cb.checked);
      });
    });

    // セレクトボックスのリスナー
    const selects = this.shadowRoot.querySelectorAll('select[data-config-key]');
    selects.forEach(sel => {
      sel.addEventListener('change', () => {
        const key = sel.dataset.configKey;
        const val = parseInt(sel.value, 10);
        this.setConfig(key, val);
      });
    });

    // 初期化ボタン
    const resetBtn = this.shadowRoot.querySelector('.btn-reset-defaults');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetDefaults());
    }

    this._updateFormValues();
  }

  _updateFormValues() {
    if (!this.shadowRoot) return;

    const config = this.store.get();

    // プリセットボタン
    const presetBtns = this.shadowRoot.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      if (btn.dataset.preset === config.preset) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // チェックボックス
    const checkboxes = this.shadowRoot.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
      const key = cb.dataset.configKey;
      if (key in config) {
        cb.checked = Boolean(config[key]);
      }
    });

    // セレクトボックス
    const selects = this.shadowRoot.querySelectorAll('select[data-config-key]');
    selects.forEach(sel => {
      const key = sel.dataset.configKey;
      if (key in config) {
        sel.value = String(config[key]);
      }
    });
  }
}
