/**
 * NhBaseElement.js
 *
 * 全 Web Components の共通基底クラス。
 * - Shadow DOM の自動初期化
 * - Neo-Retro Dark Glass UI スタイルの自動適用
 * - UIController とのライフサイクル調停（自動購読 & アンサブスクライブによるメモリリーク防止）
 * - カスタムイベントディスパッチの標準化 (bubbles: true, composed: true)
 */

import { applyThemeStyles } from './theme.css.js';

// Node.js テスト環境とブラウザ環境の両立
const BaseClass = typeof HTMLElement !== 'undefined'
  ? HTMLElement
  : class MockHTMLElement {
      constructor() {
        this.shadowRoot = null;
        this.attributes = new Map();
        this.children = [];
        this._listeners = new Map();

        // Node.js テスト環境下でクラス名から tagName を自動導出 (ブラウザでは HTMLElement が自動管理)
        const name = this.constructor.name || '';
        const kebab = name.replace(/^Nh/, 'nh-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        this.tagName = (kebab.startsWith('nh-') ? kebab : `nh-${kebab}`).toUpperCase();
      }
      attachShadow(options = { mode: 'open' }) {
        if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
          const sr = document.createElement('shadow-root');
          sr.mode = options.mode;
          sr.adoptedStyleSheets = [];
          this.shadowRoot = sr;
        } else {
          this.shadowRoot = {
            mode: options.mode,
            innerHTML: '',
            children: [],
            adoptedStyleSheets: [],
            appendChild: (c) => c,
            querySelector: () => null,
            querySelectorAll: () => []
          };
        }
        return this.shadowRoot;
      }
      getAttribute(name) { return this.attributes.get(name) || null; }
      setAttribute(name, val) {
        const old = this.attributes.get(name);
        this.attributes.set(name, String(val));
        if (typeof this.attributeChangedCallback === 'function' && old !== String(val)) {
          this.attributeChangedCallback(name, old, String(val));
        }
      }
      removeAttribute(name) {
        const old = this.attributes.get(name);
        this.attributes.delete(name);
        if (typeof this.attributeChangedCallback === 'function' && old !== null) {
          this.attributeChangedCallback(name, old, null);
        }
      }
      hasAttribute(name) { return this.attributes.has(name); }
      dispatchEvent(ev) {
        const handlers = this._listeners.get(ev.type) || [];
        for (const h of handlers) h(ev);
        return true;
      }
      addEventListener(evt, h) {
        if (!this._listeners.has(evt)) this._listeners.set(evt, []);
        this._listeners.get(evt).push(h);
      }
      removeEventListener(evt, h) {
        if (!this._listeners.has(evt)) return;
        this._listeners.set(evt, this._listeners.get(evt).filter(fn => fn !== h));
      }
    };

export class NhBaseElement extends BaseClass {
  /**
   * @param {Object} [options]
   * @param {string} [options.customCss]
   */
  constructor(options = {}) {
    super();
    this._unsubscribers = [];
    this._customCss = options.customCss || '';
    this._isInitialized = false;

    // Shadow DOM の初期化
    if (!this.shadowRoot && typeof this.attachShadow === 'function') {
      this.attachShadow({ mode: 'open' });
    }
  }

  connectedCallback() {
    if (!this._isInitialized) {
      if (this.shadowRoot) {
        applyThemeStyles(this.shadowRoot, this._customCss);
      }
      this.render();
      this._isInitialized = true;
    }
  }

  disconnectedCallback() {
    this._cleanupSubscriptions();
  }

  /**
   * UIController などの購読を登録し、DOM 切り離し時に自動解除
   * @param {Object} controller - subscribe メソッドを持つコントローラー
   * @param {Function} callback - コールバック
   * @returns {Function} 個別解除関数
   */
  subscribeController(controller, callback) {
    if (!controller || typeof controller.subscribe !== 'function') return () => {};

    const unsub = controller.subscribe(callback);
    this._unsubscribers.push(unsub);
    return unsub;
  }

  /**
   * 全購読のクリーンアップ
   * @protected
   */
  _cleanupSubscriptions() {
    for (const unsub of this._unsubscribers) {
      try {
        if (typeof unsub === 'function') {
          unsub();
        }
      } catch (err) {
        console.warn('[NhBaseElement] Error during unsubscribe', err);
      }
    }
    this._unsubscribers = [];
  }

  /**
   * Shadow DOM 境界を超えてイベントを発行 (bubbles: true, composed: true)
   * @param {string} eventName
   * @param {any} [detail]
   * @returns {boolean}
   */
  emit(eventName, detail = null) {
    const CustomEventClass = typeof CustomEvent !== 'undefined'
      ? CustomEvent
      : class MockCustomEvent {
          constructor(type, params = {}) {
            this.type = type;
            this.detail = params.detail;
            this.bubbles = Boolean(params.bubbles);
            this.composed = Boolean(params.composed);
          }
        };

    const ev = new CustomEventClass(eventName, {
      detail,
      bubbles: true,
      composed: true
    });
    return this.dispatchEvent(ev);
  }

  /**
   * DOM 描画処理 (サブクラスで実装)
   */
  render() {}
}
