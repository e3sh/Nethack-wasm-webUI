/**
 * UIConfigStore.js
 *
 * UIレイアウト設定・プリセット・表示状態を管理する Headless な Config Store。
 * DOM非依存であり、LocalStorageまたはインメモリストレージに対応。
 */

export const STORAGE_KEY_DEFAULT = 'gkl_ui_layout_config';

export const PRESETS = {
  MODERN: 'modern',
  CLASSIC: 'classic',
  CUSTOM: 'custom'
};

export const DEFAULT_LAYOUT_CONFIG = Object.freeze({
  preset: PRESETS.MODERN,
  panelInventory: true,
  panelActions: true,
  panelKnowledge: true,
  panelHistoryDock: false,
  panelCollapsed: false,
  statusClassic2Line: false,
  statusGauges: true,
  statusGklExtra: true,
  hudFadeDelay: 2500,
  oracleGuideAlwaysUnlocked: false
});

export class UIConfigStore {
  /**
   * @param {Object} [options]
   * @param {Storage|Object} [options.storage] - Storage オブジェクト (getItem, setItem)。省略時はブラウザの localStorage
   * @param {string} [options.storageKey] - 保存キー
   * @param {Object} [options.initialConfig] - 初期設定オーバーライド
   */
  constructor(options = {}) {
    this.storageKey = options.storageKey || STORAGE_KEY_DEFAULT;
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.listeners = new Set();

    this.config = this.load(options.initialConfig);
  }

  /**
   * デフォルト設定を取得
   * @returns {Object}
   */
  getDefaultConfig() {
    return { ...DEFAULT_LAYOUT_CONFIG };
  }

  /**
   * 設定をロードしてスキーマ検証・フォールバック
   * @param {Object} [override]
   * @returns {Object}
   */
  load(override = null) {
    let loaded = {};
    if (this.storage) {
      try {
        const raw = this.storage.getItem(this.storageKey);
        if (raw) {
          loaded = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('[UIConfigStore] Failed to load config from storage', err);
      }
    }

    const merged = {
      ...this.getDefaultConfig(),
      ...(loaded || {}),
      ...(override || {})
    };

    return this._normalize(merged);
  }

  /**
   * 設定を永続化
   * @param {Object} [newConfig]
   */
  save(newConfig = null) {
    if (newConfig) {
      const normalized = this._normalize(newConfig);
      const isUnchanged = this.config &&
        Object.keys(normalized).every(k => this.config[k] === normalized[k]);
      if (isUnchanged) {
        return this.config;
      }
      this.config = normalized;
    }
    if (this.storage) {
      try {
        this.storage.setItem(this.storageKey, JSON.stringify(this.config));
      } catch (err) {
        console.warn('[UIConfigStore] Failed to save config to storage', err);
      }
    }
    this._notify();
    return this.config;
  }

  /**
   * 現在の設定を取得
   * @returns {Object}
   */
  get() {
    return { ...this.config };
  }

  /**
   * 単一プロパティの更新
   * @param {string} key
   * @param {*} value
   */
  setProperty(key, value) {
    if (this.config[key] === value) {
      return this.config;
    }
    const updated = {
      ...this.config,
      [key]: value,
      preset: PRESETS.CUSTOM
    };
    return this.save(updated);
  }

  /**
   * 複数プロパティの部分更新
   * @param {Object} partial
   */
  update(partial) {
    const updated = {
      ...this.config,
      ...partial,
      preset: partial.preset || PRESETS.CUSTOM
    };
    return this.save(updated);
  }

  /**
   * サイドパネルの折りたたみ状態をトグルまたは強制設定
   * @param {boolean} [forceState]
   * @returns {Object}
   */
  toggleSidePanel(forceState) {
    const nextState = forceState !== undefined ? Boolean(forceState) : !this.config.panelCollapsed;
    return this.save({
      ...this.config,
      panelCollapsed: nextState
    });
  }

  /**
   * プリセットの適用
   * @param {'classic'|'modern'} presetName
   * @returns {Object}
   */
  applyPreset(presetName) {
    let next = { ...this.config };

    if (presetName === PRESETS.CLASSIC) {
      next = {
        ...next,
        preset: PRESETS.CLASSIC,
        panelInventory: false,
        panelActions: false,
        panelKnowledge: false,
        statusClassic2Line: true,
        statusGauges: true,
        statusGklExtra: false
      };
    } else if (presetName === PRESETS.MODERN) {
      next = {
        ...next,
        preset: PRESETS.MODERN,
        panelInventory: true,
        panelActions: true,
        panelKnowledge: true,
        statusClassic2Line: false,
        statusGauges: true,
        statusGklExtra: true
      };
    }

    return this.save(next);
  }

  /**
   * 変更リスナーの登録
   * @param {Function} callback
   * @returns {Function} 解除用アンサブスクライブ関数
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.get());
      } catch (err) {
        console.error('[UIConfigStore] Listener error', err);
      }
    }
  }

  _normalize(raw) {
    return {
      preset: typeof raw.preset === 'string' ? raw.preset : PRESETS.MODERN,
      panelInventory: raw.panelInventory !== undefined ? Boolean(raw.panelInventory) : true,
      panelActions: raw.panelActions !== undefined ? Boolean(raw.panelActions) : true,
      panelKnowledge: raw.panelKnowledge !== undefined ? Boolean(raw.panelKnowledge) : true,
      panelHistoryDock: Boolean(raw.panelHistoryDock),
      panelCollapsed: Boolean(raw.panelCollapsed),
      statusClassic2Line: Boolean(raw.statusClassic2Line),
      statusGauges: raw.statusGauges !== undefined ? Boolean(raw.statusGauges) : true,
      statusGklExtra: raw.statusGklExtra !== undefined ? Boolean(raw.statusGklExtra) : true,
      hudFadeDelay: typeof raw.hudFadeDelay === 'number' && !Number.isNaN(raw.hudFadeDelay)
        ? raw.hudFadeDelay
        : (parseInt(raw.hudFadeDelay, 10) || 2500),
      oracleGuideAlwaysUnlocked: Boolean(raw.oracleGuideAlwaysUnlocked)
    };
  }
}
