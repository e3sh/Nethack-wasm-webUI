/**
 * NhContextHintPill.js
 * 
 * <nh-context-pill> Web Component
 * 現在の足元・隣接状況に応じた最優先推奨アクションを、
 * 控えめなピルバッジとして画面下部にオンデマンド表示するガイドコンポーネント。
 */

import { NhBaseElement } from '../NhBaseElement.js';

const PILL_CSS = `
:host {
  display: block;
  pointer-events: none;
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(10px);
  z-index: 9998;
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1);
}

:host([visible]) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.pill-container {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.35);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.2);
  color: #f8fafc;
  font-family: var(--nh-font-mono, monospace);
  font-size: 0.9rem;
  letter-spacing: 0.03em;
  user-select: none;
}

.button-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #38bdf8;
  color: #0f172a;
  font-weight: bold;
  font-size: 0.75rem;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
}

.action-label {
  font-weight: 600;
  color: #e2e8f0;
}

.key-hint {
  font-size: 0.8rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
`;

export class NhContextHintPill extends NhBaseElement {
    constructor() {
        super();
        this._action = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._render();
    }

    /**
     * 推奨アクション情報の更新
     * @param {Object|null} action - ContextActionEngine の推奨アクション
     */
    setAction(action) {
        this._action = action;
        if (action && (action.label || action.labelJa) && action.visible !== false) {
            this.setAttribute('visible', '');
        } else {
            this.removeAttribute('visible');
        }
        this._render();
    }

    /**
     * update メソッド (setAction のエイリアス)
     * @param {Object|null} action 
     */
    update(action) {
        this.setAction(action);
    }


    _render() {
        if (!this.shadowRoot) return;

        if (!this._action) {
            this.shadowRoot.innerHTML = `<style>${PILL_CSS}</style>`;
            return;
        }

        const label = this._action.labelJa || this._action.label || '行動';
        let keyText = '';
        if (this._action.key) {
            keyText = Array.isArray(this._action.key) ? this._action.key.join(' ') : String(this._action.key);
        } else if (this._action.keySequence) {
            keyText = this._action.keySequence.join(' ');
        } else if (this._action.id) {
            keyText = this._action.id.replace('ACTION_', '');
        }

        this.shadowRoot.innerHTML = `
            <style>${PILL_CSS}</style>
            <div class="pill-container">
                <span class="button-badge">A</span>
                <span class="action-label">${label}</span>
                ${keyText ? `<span class="key-hint">${keyText}</span>` : ''}
            </div>
        `;
    }
}

export { NhContextHintPill as ContextHintPill };

if (typeof customElements !== 'undefined' && !customElements.get('nh-context-pill')) {
    customElements.define('nh-context-pill', NhContextHintPill);
}

