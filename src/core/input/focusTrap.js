/**
 * focusTrap.js - アクセシビリティ・モーダル内フォーカス巡回制御ユーティリティ
 *
 * ダイアログ・モーダル表示中に Tab / Shift+Tab によるフォーカスの画面外脱出（漏出）を防ぎ、
 * モーダル内部のフォーカス可能要素間を循環させます。
 */

export const FOCUSABLE_ELEMENTS_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  '[tabindex]:not([tabindex^="-"])',
].join(', ');

/**
 * 指定されたコンテナ要素内のフォーカス可能要素を取得する
 * @param {HTMLElement} container 
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(container) {
  if (!container || typeof container.querySelectorAll !== 'function') return [];
  const elements = Array.from(container.querySelectorAll(FOCUSABLE_ELEMENTS_SELECTOR));
  return elements.filter((el) => {
    return el.offsetParent !== null && window.getComputedStyle(el).visibility !== 'hidden';
  });
}

/**
 * Tabキー押下時にコンテナ内部でフォーカスをトラップするイベントハンドラー
 * @param {HTMLElement} container - モーダルコンテナ要素
 * @param {KeyboardEvent} event - keydownイベント
 * @returns {boolean} トラップ処理を実行した場合は true
 */
export function trapFocus(container, event) {
  if (!container || !event || event.key !== 'Tab') return false;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    event.preventDefault();
    return true;
  }

  const firstElement = focusables[0];
  const lastElement = focusables[focusables.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey) {
    // Shift + Tab: 逆方向
    if (activeElement === firstElement || !container.contains(activeElement)) {
      event.preventDefault();
      lastElement.focus();
      return true;
    }
  } else {
    // Tab: 順方向
    if (activeElement === lastElement || !container.contains(activeElement)) {
      event.preventDefault();
      firstElement.focus();
      return true;
    }
  }

  return false;
}
