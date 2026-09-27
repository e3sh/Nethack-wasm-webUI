/**
 * testElementHelper.js
 *
 * Node.js (Vitest) 環境で Web Components / Custom Elements をテストするための
 * 軽量 DOM & Shadow DOM モック環境ヘルパー。
 */
import { vi } from 'vitest';

export function createMockNode(tagName = 'div') {
  const listeners = new Map();
  const attributes = new Map();
  const classListSet = new Set();
  const children = [];
  let innerHTMLStr = '';
  let textContentStr = '';

  const node = {
    tagName: tagName.toUpperCase(),
    style: {},
    dataset: {},
    children,
    value: '',
    checked: false,
    disabled: false,

    classList: {
      add: (...classes) => classes.forEach(c => classListSet.add(c)),
      remove: (...classes) => classes.forEach(c => classListSet.delete(c)),
      contains: (c) => classListSet.has(c),
      toggle: (c) => {
        if (classListSet.has(c)) {
          classListSet.delete(c);
          return false;
        } else {
          classListSet.add(c);
          return true;
        }
      }
    },

    getAttribute: (attr) => attributes.get(attr) || null,
    setAttribute: (attr, val) => attributes.set(attr, String(val)),
    removeAttribute: (attr) => attributes.delete(attr),
    hasAttribute: (attr) => attributes.has(attr),

    appendChild: vi.fn((child) => {
      children.push(child);
      child.parentNode = node;
      return child;
    }),

    removeChild: vi.fn((child) => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }),

    addEventListener: vi.fn((event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    }),

    removeEventListener: vi.fn((event, handler) => {
      if (!listeners.has(event)) return;
      const list = listeners.get(event).filter(h => h !== handler);
      listeners.set(event, list);
    }),

    dispatchEvent: vi.fn((event) => {
      const handlers = listeners.get(event.type) || [];
      for (const h of handlers) {
        h(event);
      }
      return true;
    }),

    querySelector: (selector) => {
      return findMatchingNode(node, selector);
    },

    querySelectorAll: (selector) => {
      const res = [];
      findAllMatchingNodes(node, selector, res);
      return res;
    },

    focus: vi.fn(),
    blur: vi.fn(),
    click: function() {
      const handlers = listeners.get('click') || [];
      for (const h of handlers) {
        h({ type: 'click', target: node });
      }
    }
  };

  Object.defineProperty(node, 'innerHTML', {
    get: () => innerHTMLStr,
    set: (val) => {
      innerHTMLStr = val;
      children.length = 0;
      // 簡易的なタグ解析による子ノード作成
      parseSimpleHtml(val, node);
    }
  });

  Object.defineProperty(node, 'textContent', {
    get: () => {
      if (children.length === 0) return textContentStr;
      return children.map(c => c.textContent).join('');
    },
    set: (val) => {
      textContentStr = val;
      if (children.length === 0) {
        // 子がいない場合は直接設定
      }
    }
  });

  Object.defineProperty(node, 'className', {
    get: () => Array.from(classListSet).join(' '),
    set: (val) => {
      classListSet.clear();
      if (val) {
        val.split(/\s+/).filter(Boolean).forEach(c => classListSet.add(c));
      }
    }
  });

  return node;
}

function parseSimpleHtml(html, parentNode) {
  if (typeof html !== 'string') return;

  const stack = [parentNode];
  // タグ開始、終了、自己終了、テキストを分割マッチする正規表現
  const tokenRegex = /<!--.*?-->|<([a-zA-Z0-9-]+)((?:\s+[^>]*?)?)\s*(\/?)>|<\/([a-zA-Z0-9-]+)\s*>|([^<]+)/gs;
  let match;

  const voidTags = new Set(['input', 'img', 'br', 'hr', 'slot']);

  while ((match = tokenRegex.exec(html)) !== null) {
    const [full, openTag, attrsStr, selfCloseSlash, closeTag, text] = match;

    if (full.startsWith('<!--')) {
      continue;
    }

    if (openTag) {
      const el = createMockNode(openTag);
      if (attrsStr) {
        // class
        const classMatch = attrsStr.match(/class=["']([^"']+)["']/);
        if (classMatch) {
          el.className = classMatch[1];
        }
        // data-*
        const dataMatches = attrsStr.matchAll(/data-([a-zA-Z0-9-]+)=["']([^"']+)["']/g);
        for (const dm of dataMatches) {
          const camelKey = dm[1].replace(/-([a-z])/g, (_, g) => g.toUpperCase());
          el.dataset[camelKey] = dm[2];
        }
        // id
        const idMatch = attrsStr.match(/id=["']([^"']+)["']/);
        if (idMatch) {
          el.id = idMatch[1];
          el.setAttribute('id', idMatch[1]);
        }
        // type
        const typeMatch = attrsStr.match(/type=["']([^"']+)["']/);
        if (typeMatch) {
          el.setAttribute('type', typeMatch[1]);
        }
        // role
        const roleMatch = attrsStr.match(/role=["']([^"']+)["']/);
        if (roleMatch) {
          el.setAttribute('role', roleMatch[1]);
        }
        // aria-modal
        const ariaModalMatch = attrsStr.match(/aria-modal=["']([^"']+)["']/);
        if (ariaModalMatch) {
          el.setAttribute('aria-modal', ariaModalMatch[1]);
        }
      }

      const currentParent = stack[stack.length - 1];
      if (currentParent) {
        currentParent.appendChild(el);
      }

      const isSelfClosing = selfCloseSlash === '/' || voidTags.has(openTag.toLowerCase());
      if (!isSelfClosing) {
        stack.push(el);
      }
    } else if (closeTag) {
      if (stack.length > 1) {
        const top = stack[stack.length - 1];
        if (top.tagName.toLowerCase() === closeTag.toLowerCase()) {
          stack.pop();
        } else {
          // 不正ネストなどのフォールバック
          for (let i = stack.length - 1; i >= 1; i--) {
            if (stack[i].tagName.toLowerCase() === closeTag.toLowerCase()) {
              stack.splice(i);
              break;
            }
          }
        }
      }
    } else if (text) {
      const trimmed = text.trim();
      if (trimmed) {
        const currentParent = stack[stack.length - 1];
        if (currentParent) {
          currentParent.textContent = (currentParent.textContent || '') + trimmed;
        }
      }
    }
  }
}

function findMatchingNode(root, selector) {
  for (const child of root.children) {
    if (matchesSelector(child, selector)) return child;
    const found = findMatchingNode(child, selector);
    if (found) return found;
  }
  return null;
}

function findAllMatchingNodes(root, selector, acc) {
  for (const child of root.children) {
    if (matchesSelector(child, selector)) acc.push(child);
    findAllMatchingNodes(child, selector, acc);
  }
}

function matchesSelector(node, selector) {
  if (!node || !selector) return false;
  selector = selector.trim();

  // ID セレクタ (#modal-id)
  if (selector.startsWith('#')) {
    return node.id === selector.slice(1);
  }
  // クラスセレクタ (.btn, .filer-item-card.risk)
  if (selector.startsWith('.')) {
    const classes = selector.split('.').filter(Boolean);
    return classes.every(cls => node.classList.contains(cls));
  }
  // 単純なタグセレクタ (button)
  if (/^[a-zA-Z0-9_-]+$/.test(selector)) {
    return node.tagName.toLowerCase() === selector.toLowerCase();
  }
  // 属性セレクタ ([data-config-key="..."], input[type="checkbox"])
  const attrMatch = selector.match(/^(?:([a-zA-Z0-9_-]+))?\[([a-zA-Z0-9_-]+)(?:=["']?([^"']*)["']?)?\]$/);
  if (attrMatch) {
    const tag = attrMatch[1];
    const attr = attrMatch[2];
    const val = attrMatch[3];
    if (tag && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;

    if (attr.startsWith('data-')) {
      const camelKey = attr.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
      const kebabKey = attr.slice(5);
      const actualVal = node.dataset[camelKey] ?? node.dataset[kebabKey] ?? node.getAttribute(attr);
      if (val !== undefined) {
        return actualVal === val;
      }
      return actualVal !== undefined && actualVal !== null;
    }
    return val !== undefined ? node.getAttribute(attr) === val : node.hasAttribute(attr);
  }

  return false;
}

export function setupMockDom() {
  const originalDoc = globalThis.document;
  const originalCustomElements = globalThis.customElements;
  const originalCustomEvent = globalThis.CustomEvent;

  const registry = new Map();

  const bodyNode = createMockNode('body');

  globalThis.document = {
    body: bodyNode,
    createElement: (tag) => createMockNode(tag),
    getElementById: (id) => findMatchingNode(bodyNode, `#${id}`),
    querySelector: (sel) => findMatchingNode(bodyNode, sel),
    querySelectorAll: (sel) => {
      const acc = [];
      findAllMatchingNodes(bodyNode, sel, acc);
      return acc;
    },
    activeElement: null
  };

  globalThis.customElements = {
    define: vi.fn((tag, cls) => registry.set(tag, cls)),
    get: vi.fn((tag) => registry.get(tag))
  };

  globalThis.CustomEvent = class MockCustomEvent {
    constructor(type, params = {}) {
      this.type = type;
      this.detail = params.detail;
      this.bubbles = Boolean(params.bubbles);
      this.composed = Boolean(params.composed);
    }
  };

  return () => {
    globalThis.document = originalDoc;
    globalThis.customElements = originalCustomElements;
    globalThis.CustomEvent = originalCustomEvent;
  };
}
