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
`;

export class NhUiConfig extends NhBaseElement {
  static get observedAttributes() {
    return ['preset'];
  }

  constructor() {
    super({ customCss: CONFIG_CSS });

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
    }
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

    this.shadowRoot.innerHTML = `
      <div class="config-container">
        <!-- プリセット選択 -->
        <div class="config-section">
          <div class="section-title">🎨 UI プリセット</div>
          <div class="preset-group">
            <button class="preset-btn" data-preset="${PRESETS.MODERN}">モダン (推奨)</button>
            <button class="preset-btn" data-preset="${PRESETS.CLASSIC}">クラシック</button>
            <button class="preset-btn" data-preset="${PRESETS.CUSTOM}">カスタム</button>
          </div>
        </div>

        <!-- パネル表示設定 -->
        <div class="config-section">
          <div class="section-title">📐 パネル表示</div>
          <div class="toggle-grid">
            <div class="toggle-row">
              <span class="toggle-label">🎒 所持品パネル</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelInventory">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">⚡ アクションパネル</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelActions">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">📖 知識図鑑パネル</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelKnowledge">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">📜 過去ログドック</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="panelHistoryDock">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- ステータス設定 -->
        <div class="config-section">
          <div class="section-title">📊 ステータス表示</div>
          <div class="toggle-grid">
            <div class="toggle-row">
              <span class="toggle-label">2行クラシック表示</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="statusClassic2Line">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">グラフィカルゲージ (HP/MP)</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="statusGauges">
                <span class="slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">GKL 拡張情報表示</span>
              <label class="toggle-switch">
                <input type="checkbox" data-config-key="statusGklExtra">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <button class="nh-btn btn-reset-defaults">初期設定に戻す</button>
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
  }
}
