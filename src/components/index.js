/**
 * @nethack-webui/components
 *
 * NetHack WASM WebUI - Web Components Library (<nh-*>)
 * UIController (Headless UI) と連携する Custom Elements & Shadow DOM コンポーネント群。
 */

export { NhBaseElement } from './NhBaseElement.js';
export { THEME_CSS, applyThemeStyles } from './theme.css.js';

export { NhFloatingHud } from './NhFloatingHud.js';
export { NhModal } from './NhModal.js';
export { NhPaperdoll } from './NhPaperdoll.js';
export { NhContainerFiler } from './NhContainerFiler.js';
export { NhUiConfig } from './NhUiConfig.js';
export { NhKnowledgeCard } from './NhKnowledgeCard.js';
export { NhDiscoveryCodex } from './NhDiscoveryCodex.js';

import { NhFloatingHud } from './NhFloatingHud.js';
import { NhModal } from './NhModal.js';
import { NhPaperdoll } from './NhPaperdoll.js';
import { NhContainerFiler } from './NhContainerFiler.js';
import { NhUiConfig } from './NhUiConfig.js';
import { NhKnowledgeCard } from './NhKnowledgeCard.js';
import { NhDiscoveryCodex } from './NhDiscoveryCodex.js';

export const COMPONENT_MAP = {
  'nh-floating-hud': NhFloatingHud,
  'nh-modal': NhModal,
  'nh-paperdoll': NhPaperdoll,
  'nh-container-filer': NhContainerFiler,
  'nh-ui-config': NhUiConfig,
  'nh-knowledge-card': NhKnowledgeCard,
  'nh-discovery-codex': NhDiscoveryCodex
};

/**
 * 全 Web Components を customElements に一括登録
 * @param {CustomElementRegistry} [registry] - 省略時は globalThis.customElements
 */
export function registerAllComponents(registry = null) {
  const reg = registry || (typeof customElements !== 'undefined' ? customElements : null);
  if (!reg || typeof reg.define !== 'function') return;

  for (const [tagName, ElementClass] of Object.entries(COMPONENT_MAP)) {
    if (!reg.get(tagName)) {
      reg.define(tagName, ElementClass);
    }
  }
}

// ブラウザ環境で自動登録を試行
if (typeof customElements !== 'undefined') {
  try {
    registerAllComponents(customElements);
  } catch (_) {
    // 既に登録済み等の例外防止
  }
}
