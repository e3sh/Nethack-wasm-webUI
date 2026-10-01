/**
 * NhGamepadGuideBar.js
 * 
 * <nh-gamepad-guide-bar> Web Component
 * 画面最下部に常設され、現在のコンテキスト（通常探索・道具袋・ダイアログ・YN・方向指定等）
 * に応じた有効なボタン割り当てを1行で可視化するガイドバー。
 */

import { NhBaseElement } from '../NhBaseElement.js';

export const GUIDE_PRESETS = Object.freeze({
  NORMAL: [
    { key: 'D-Pad', type: 'dpad', label: '移動' },
    { key: 'A', type: 'btn-a', label: '足元アクション' },
    { key: 'B', type: 'btn-b', label: '待機 (1T)' },
    { key: 'Y', type: 'btn-y', label: '道具袋' },
    { key: 'R-Stick', type: 'stick', label: 'アクション選択' }
  ],
  MODAL_INVENTORY: [
    { key: 'D-Pad ↑↓', type: 'dpad', label: '選択' },
    { key: 'LB / RB', type: 'shoulder', label: 'タブ切替' },
    { key: 'A', type: 'btn-a', label: '決定 / つかう' },
    { key: 'B', type: 'btn-b', label: 'とじる' }
  ],
  DIRECTION: [
    { key: 'D-Pad / Stick', type: 'stick', label: '8方向照準' },
    { key: 'A', type: 'btn-a', label: '足元・決定' },
    { key: 'B', type: 'btn-b', label: 'キャンセル' }
  ],
  YN: [
    { key: 'A', type: 'btn-a', label: 'はい (y)' },
    { key: 'B', type: 'btn-b', label: 'いいえ (n)' },
    { key: 'B / ESC', type: 'btn-b', label: 'キャンセル' }
  ],
  DIALOG: [
    { key: 'D-Pad ↑↓', type: 'dpad', label: '選択' },
    { key: 'A', type: 'btn-a', label: '決定' },
    { key: 'B', type: 'btn-b', label: '戻る / 閉じる' }
  ]
});

const GUIDE_CSS = `
:host {
  display: block;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 38px;
  z-index: 20000;
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.4);
  font-family: var(--nh-font-mono, "Consolas", "Courier New", monospace);
  font-size: 0.8rem;
  color: #e2e8f0;
  user-select: none;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

:host([hidden]) {
  display: none !important;
}

.guide-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.guide-context-badge {
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.3);
  text-transform: uppercase;
}

.guide-items {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.guide-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.btn-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  min-width: 18px;
  height: 18px;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: bold;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.btn-badge.btn-a {
  background: #22c55e;
  color: #052e16;
}

.btn-badge.btn-b {
  background: #ef4444;
  color: #450a0a;
}

.btn-badge.btn-x {
  background: #3b82f6;
  color: #172554;
}

.btn-badge.btn-y {
  background: #eab308;
  color: #422006;
}

.btn-badge.dpad,
.btn-badge.stick,
.btn-badge.shoulder {
  background: #334155;
  color: #cbd5e1;
  border: 1px solid #475569;
  border-radius: 4px;
}

.item-label {
  font-size: 0.78rem;
  color: #cbd5e1;
}
`;

export class NhGamepadGuideBar extends NhBaseElement {
  static get observedAttributes() {
    return ['context', 'visible'];
  }

  constructor() {
    super();
    this._context = 'NORMAL';
    this._customItems = null;
    this._render();
  }

  connectedCallback() {
    super.connectedCallback();
    this._render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'context') {
      this._context = (newValue || 'NORMAL').toUpperCase();
      this._render();
    }
  }

  /**
   * 現在のコンテキストを設定
   * @param {string} contextName 'NORMAL' | 'MODAL_INVENTORY' | 'DIRECTION' | 'YN' | 'DIALOG'
   * @param {Array<{key: string, label: string, type?: string}>} [customItems]
   */
  setContext(contextName, customItems = null) {
    this._context = (contextName || 'NORMAL').toUpperCase();
    this._customItems = customItems;
    this._render();
  }

  getContext() {
    return this._context;
  }

  _render() {
    if (!this.shadowRoot) return;

    const items = this._customItems || GUIDE_PRESETS[this._context] || GUIDE_PRESETS.NORMAL;

    let itemsHtml = '';
    for (const it of items) {
      const typeClass = it.type || 'btn-badge';
      itemsHtml += `
        <span class="guide-item">
          <span class="btn-badge ${typeClass}">${it.key}</span>
          <span class="item-label">${it.label}</span>
        </span>
      `;
    }

    this.shadowRoot.innerHTML = `
      <style>${GUIDE_CSS}</style>
      <div class="guide-container">
        <div class="guide-context-badge">${this._context}</div>
        <div class="guide-items">
          ${itemsHtml}
        </div>
        <div></div>
      </div>
    `;
  }
}

export { NhGamepadGuideBar as GamepadGuideBar };

if (typeof customElements !== 'undefined' && !customElements.get('nh-gamepad-guide-bar')) {
  customElements.define('nh-gamepad-guide-bar', NhGamepadGuideBar);
}
