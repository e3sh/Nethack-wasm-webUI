/**
 * theme.css.js
 *
 * Neo-Retro Dark Glass UI 共通 CSS トークン & スタイル定義。
 * Constructable Stylesheets および <style> 要素の両方で利用可能な CSS 文字列を提供します。
 */

export const THEME_CSS = `
:host {
  --nh-bg-color: #0b0f19;
  --nh-panel-bg: rgba(15, 23, 42, 0.85);
  --nh-card-bg: rgba(22, 33, 62, 0.75);
  --nh-border-color: rgba(255, 255, 255, 0.12);
  --nh-border-subtle: rgba(255, 255, 255, 0.06);
  --nh-border-glow: rgba(56, 189, 248, 0.45);
  --nh-text-main: #f1f5f9;
  --nh-text-muted: #94a3b8;
  --nh-primary-color: #38bdf8;
  --nh-primary-hover: #0ea5e9;
  --nh-primary-glow: rgba(56, 189, 248, 0.35);
  --nh-danger-color: #ef4444;
  --nh-danger-hover: #dc2626;
  --nh-danger-glow: rgba(239, 68, 68, 0.35);
  --nh-warning-color: #f59e0b;
  --nh-warning-glow: rgba(245, 158, 11, 0.35);
  --nh-success-color: #10b981;
  --nh-success-glow: rgba(16, 185, 129, 0.35);

  --nh-glass-bg: rgba(15, 23, 42, 0.85);
  --nh-glass-bg-card: rgba(22, 33, 62, 0.75);
  --nh-glass-bg-hover: rgba(30, 41, 59, 0.9);
  --nh-glass-bg-active: rgba(30, 58, 95, 0.7);
  --nh-glass-border: 1px solid rgba(255, 255, 255, 0.12);
  --nh-glass-border-glow: 1px solid rgba(56, 189, 248, 0.5);
  --nh-glass-blur: blur(12px);
  --nh-glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
  --nh-glass-shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.1);

  --nh-font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --nh-font-mono: "Cascadia Code", "Fira Code", Consolas, Monaco, "Courier New", monospace;

  font-family: var(--nh-font-sans);
  color: var(--nh-text-main);
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
}

/* Glass Card Base */
.nh-glass-card {
  background: var(--nh-glass-bg-card);
  backdrop-filter: var(--nh-glass-blur);
  -webkit-backdrop-filter: var(--nh-glass-blur);
  border: var(--nh-glass-border);
  box-shadow: var(--nh-glass-shadow);
  border-radius: 8px;
  color: var(--nh-text-main);
}

/* Button Base */
.nh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--nh-border-color);
  background: rgba(30, 41, 59, 0.6);
  color: var(--nh-text-main);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.nh-btn:hover {
  background: var(--nh-glass-bg-hover);
  border-color: var(--nh-primary-color);
  box-shadow: 0 0 10px var(--nh-primary-glow);
  color: #fff;
}

.nh-btn:active {
  background: var(--nh-glass-bg-active);
  transform: translateY(1px);
}

.nh-btn-primary {
  background: rgba(14, 165, 233, 0.25);
  border-color: var(--nh-primary-color);
  color: var(--nh-primary-color);
}

.nh-btn-primary:hover {
  background: var(--nh-primary-color);
  color: #0b0f19;
  box-shadow: 0 0 15px var(--nh-primary-glow);
}

.nh-btn-danger {
  background: rgba(239, 68, 68, 0.2);
  border-color: var(--nh-danger-color);
  color: var(--nh-danger-color);
}

.nh-btn-danger:hover {
  background: var(--nh-danger-color);
  color: #fff;
  box-shadow: 0 0 15px var(--nh-danger-glow);
}

/* Badge Base */
.nh-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  border: 1px solid var(--nh-border-color);
  background: rgba(15, 23, 42, 0.6);
}

.nh-badge-warning {
  border-color: var(--nh-warning-color);
  color: var(--nh-warning-color);
  background: rgba(245, 158, 11, 0.15);
  box-shadow: 0 0 8px var(--nh-warning-glow);
}

.nh-badge-danger {
  border-color: var(--nh-danger-color);
  color: var(--nh-danger-color);
  background: rgba(239, 68, 68, 0.15);
  box-shadow: 0 0 8px var(--nh-danger-glow);
}

.nh-badge-info {
  border-color: var(--nh-primary-color);
  color: var(--nh-primary-color);
  background: rgba(56, 189, 248, 0.15);
  box-shadow: 0 0 8px var(--nh-primary-glow);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 9999px;
  transition: background-color 0.2s ease;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--nh-primary-color);
}
`;

/**
 * ShadowRoot にテーマスタイルを適用
 * @param {ShadowRoot} shadowRoot
 * @param {string} [customCss]
 */
export function applyThemeStyles(shadowRoot, customCss = '') {
  if (!shadowRoot) return;

  const combined = customCss ? `${THEME_CSS}\n${customCss}` : THEME_CSS;

  // Constructable Stylesheet をサポートしている場合
  if (typeof CSSStyleSheet !== 'undefined' && shadowRoot.adoptedStyleSheets) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(combined);
      shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
      return;
    } catch (_) {
      // フォールバック
    }
  }

  // <style> 要素によるフォールバック
  if (typeof document !== 'undefined' && document.createElement) {
    const styleEl = document.createElement('style');
    styleEl.textContent = combined;
    shadowRoot.appendChild(styleEl);
  }
}
