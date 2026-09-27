/**
 * NhFloatingHud.js
 *
 * <nh-floating-hud> Web Component
 * FloatingMessageHudController と連携し、透過ポップアップ・世代別透明度・自動フェードを自律管理。
 */

import { NhBaseElement } from './NhBaseElement.js';
import { FloatingMessageHudController, LINE_STATE } from '../ui-controller/FloatingMessageHudController.js';

const HUD_CSS = `
:host {
  display: block;
  pointer-events: none;
  position: relative;
  z-index: 100;
  width: 100%;
}

.hud-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  padding: 8px 12px;
}

.floating-message-line {
  pointer-events: none;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 6px 14px;
  font-family: var(--nh-font-mono);
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--nh-text-main);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  transition: opacity 0.35s ease, transform 0.35s ease, border-color 0.2s ease;
  width: auto;
  max-width: 100%;
  text-align: center;
  word-break: break-word;
}

.floating-message-line.line-age-0 {
  opacity: 1;
  transform: translateY(0);
  border-color: rgba(56, 189, 248, 0.35);
}

.floating-message-line.line-age-1 {
  opacity: 0.85;
  transform: translateY(-2px) scale(0.98);
}

.floating-message-line.line-age-2 {
  opacity: 0.65;
  transform: translateY(-4px) scale(0.96);
}

.floating-message-line.line-age-3 {
  opacity: 0.45;
  transform: translateY(-6px) scale(0.94);
}

.floating-message-line.line-age-4 {
  opacity: 0.25;
  transform: translateY(-8px) scale(0.92);
}

.floating-message-line.bold {
  font-weight: 700;
  color: var(--nh-primary-color);
  border-color: rgba(56, 189, 248, 0.6);
  box-shadow: 0 0 12px var(--nh-primary-glow);
}

.floating-message-line.fading {
  opacity: 0 !important;
  transform: translateY(-12px) scale(0.9) !important;
}
`;

export class NhFloatingHud extends NhBaseElement {
  static get observedAttributes() {
    return ['max-lines', 'fade-timeout', 'fade-delay'];
  }

  constructor() {
    super({ customCss: HUD_CSS });

    const maxLines = parseInt(this.getAttribute('max-lines') || '5', 10);
    const fadeTimeout = parseInt(this.getAttribute('fade-timeout') || '0', 10);
    const fadeDelay = parseInt(this.getAttribute('fade-delay') || '2500', 10);

    this.controller = new FloatingMessageHudController({
      maxLines,
      fadeTimeoutMs: fadeTimeout,
      fadeDelayAfterActionMs: fadeDelay
    });

    this._container = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.subscribeController(this.controller, () => {
      this._updateDisplay();
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'max-lines' && newValue != null) {
      this.controller.setMaxLines(parseInt(newValue, 10));
    } else if (name === 'fade-timeout' && newValue != null) {
      this.controller.fadeTimeoutMs = parseInt(newValue, 10);
    } else if (name === 'fade-delay' && newValue != null) {
      this.controller.fadeDelayAfterActionMs = parseInt(newValue, 10);
    }
  }

  /**
   * 外部コントローラーの注入 (必要な場合)
   * @param {FloatingMessageHudController} controller
   */
  setController(controller) {
    if (!controller) return;
    this._cleanupSubscriptions();
    this.controller = controller;
    this.subscribeController(this.controller, () => {
      this._updateDisplay();
    });
    this._updateDisplay();
  }

  /**
   * メッセージの追加
   */
  pushMessage(msg) {
    const res = this.controller.pushMessage(msg);
    this._updateDisplay();
    return res;
  }

  /**
   * メッセージの更新
   */
  updateMessage(msg) {
    const res = this.controller.updateMessage(msg);
    this._updateDisplay();
    return res;
  }

  /**
   * ユーザーアクション通知
   */
  notifyUserAction() {
    this.controller.notifyUserAction();
    this._updateDisplay();
  }

  /**
   * 全行フェード
   */
  fadeAll() {
    this.controller.fadeAll();
    this._updateDisplay();
  }

  /**
   * クリア
   */
  clear() {
    this.controller.clear();
    this._updateDisplay();
  }

  render() {
    if (!this.shadowRoot) return;

    let container = this.shadowRoot.querySelector('.hud-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'hud-container';
      this.shadowRoot.appendChild(container);
    }
    this._container = container;
    this._updateDisplay();
  }

  _updateDisplay() {
    if (!this._container) return;

    const lines = this.controller.getLines();
    this._container.innerHTML = '';

    for (const line of lines) {
      const lineEl = document.createElement('div');
      lineEl.className = `floating-message-line line-age-${line.age}`;
      if (line.isBold) lineEl.classList.add('bold');
      if (line.state === LINE_STATE.FADING) lineEl.classList.add('fading');
      lineEl.dataset.messageId = String(line.id);
      lineEl.textContent = line.text;

      this._container.appendChild(lineEl);
    }
  }
}
