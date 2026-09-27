/**
 * NhModal.js
 *
 * <nh-modal> Web Component
 * ModalStackController と連携し、Z-Index スタック順、最前面 ESC 閉塞、FocusTrap を内包したモーダル外枠。
 */

import { NhBaseElement } from './NhBaseElement.js';

const MODAL_CSS = `
:host {
  display: contents;
}

:host(:not([open])) .modal-overlay {
  display: none !important;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(4, 7, 13, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.modal-card {
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: var(--nh-glass-blur);
  -webkit-backdrop-filter: var(--nh-glass-blur);
  border: 1px solid var(--nh-border-color);
  box-shadow: var(--nh-glass-shadow-lg);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPop {
  0% {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(22, 33, 62, 0.4);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--nh-primary-color);
  letter-spacing: 0.03em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--nh-text-muted);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  color: var(--nh-danger-color);
  background: rgba(239, 68, 68, 0.15);
}

.modal-body {
  padding: 16px 18px;
  overflow-y: auto;
  flex: 1;
  font-size: 0.95rem;
  line-height: 1.5;
}

.modal-footer {
  padding: 12px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(22, 33, 62, 0.3);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
`;

export class NhModal extends NhBaseElement {
  static get observedAttributes() {
    return ['open', 'modal-id', 'title', 'priority', 'closable'];
  }

  constructor() {
    super({ customCss: MODAL_CSS });

    this._modalId = this.getAttribute('modal-id') || `modal-${Math.random().toString(36).slice(2, 9)}`;
    this._priority = parseInt(this.getAttribute('priority') || '0', 10);
    this._modalStack = null;
    this._keydownHandler = this._handleKeyDown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._keydownHandler, true);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._keydownHandler, true);
    }
    if (this._modalStack) {
      this._modalStack.unregisterModal(this._modalId);
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'open') {
      const isOpen = this.hasAttribute('open');
      if (isOpen) {
        this.emit('nh-modal-open', { modalId: this._modalId });
        this._trapInitialFocus();
      } else {
        this.emit('nh-modal-close', { modalId: this._modalId });
      }
    } else if (name === 'modal-id' && newValue) {
      if (this._modalStack) {
        this._modalStack.unregisterModal(this._modalId);
      }
      this._modalId = newValue;
      this._registerToStack();
    } else if (name === 'priority') {
      this._priority = parseInt(newValue || '0', 10);
      this._registerToStack();
    } else if (name === 'title') {
      this._updateTitle();
    }
  }

  get open() {
    return this.hasAttribute('open');
  }

  set open(val) {
    if (Boolean(val)) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
  }

  get modalId() {
    return this._modalId;
  }

  set modalId(id) {
    this.setAttribute('modal-id', id);
  }

  get priority() {
    return this._priority;
  }

  set priority(val) {
    this.setAttribute('priority', String(val));
  }

  /**
   * ModalStackController の注入
   * @param {import('../ui-controller/ModalStackController.js').ModalStackController} stackController
   */
  setModalStack(stackController) {
    if (this._modalStack) {
      this._modalStack.unregisterModal(this._modalId);
    }
    this._modalStack = stackController;
    this._registerToStack();
  }

  _registerToStack() {
    if (!this._modalStack) return;
    this._modalStack.registerModal(this._modalId, {
      isOpen: () => this.open,
      close: () => this.close(),
      priority: this._priority,
      isInputFocused: () => this._isInputFocused()
    });
  }

  _isInputFocused() {
    if (!this.shadowRoot || typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName ? active.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  _trapInitialFocus() {
    if (!this.shadowRoot) return;
    setTimeout(() => {
      const closeBtn = this.shadowRoot.querySelector('.modal-close-btn');
      if (closeBtn && typeof closeBtn.focus === 'function') {
        closeBtn.focus();
      }
    }, 50);
  }

  _handleKeyDown(e) {
    if (!this.open) return;

    // FocusTrap: Tab キー循環
    if (e.key === 'Tab') {
      const focusable = this._getFocusableElements();
      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    // 単独モーダル時の ESC 閉塞 (ModalStackController 未登録時のフォールバック)
    if (!this._modalStack && e.key === 'Escape') {
      const closable = this.getAttribute('closable') !== 'false';
      if (closable) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }
  }

  _getFocusableElements() {
    if (!this.shadowRoot) return [];
    const selectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const inner = Array.from(this.shadowRoot.querySelectorAll(selectors));
    const slotted = Array.from(this.querySelectorAll(selectors));
    return [...inner, ...slotted];
  }

  _updateTitle() {
    if (!this.shadowRoot) return;
    const titleEl = this.shadowRoot.querySelector('.modal-title');
    if (titleEl) {
      titleEl.textContent = this.getAttribute('title') || '';
    }
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-header">
            <slot name="header">
              <div class="modal-title">${this.getAttribute('title') || ''}</div>
            </slot>
            <button class="modal-close-btn" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <slot></slot>
          </div>
          <div class="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;

    const closeBtn = this.shadowRoot.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        const closable = this.getAttribute('closable') !== 'false';
        if (closable) {
          this.close();
        }
      });
    }

    const overlay = this.shadowRoot.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          const closable = this.getAttribute('closable') !== 'false';
          if (closable) {
            this.close();
          }
        }
      });
    }

    this._registerToStack();
  }
}
