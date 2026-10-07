/**
 * ModalStackController.js
 *
 * モーダルダイアログの表示状態・スタック順序・最前面ESC閉塞を管理する Headless コントローラー。
 * DOM非依存であり、各モーダルの開閉コールバックを登録して調停する。
 */

export class ModalStackController {
  constructor() {
    /** @type {Map<string, { id: string, isOpen: Function, close: Function, priority: number, isInputFocused?: Function }>} */
    this.modals = new Map();
  }

  /**
   * モーダルハンドラーを登録
   * @param {string} id - モーダル識別子 (例: 'historyDrawer', 'paperdoll', 'codex', 'container')
   * @param {Object} handler
   * @param {Function} handler.isOpen - 開いているかどうかを返す関数
   * @param {Function} handler.close - モーダルを閉じる関数
   * @param {number} [handler.priority=0] - 優先度 (高いほど最前面として扱われる)
   * @param {Function} [handler.isInputFocused] - 内部の入力欄にフォーカスがあるかを返す関数
   * @param {Function} [handler.navigate] - ナビゲーション操作委譲関数 (dir: 'prev'|'next'|'left'|'right') => boolean
   * @param {Function} [handler.submit] - 決定操作委譲関数 () => boolean
   */
  registerModal(id, handler) {
    this.modals.set(id, {
      id,
      priority: handler.priority || 0,
      isOpen: handler.isOpen || (() => false),
      close: handler.close || (() => {}),
      isInputFocused: handler.isInputFocused || (() => false),
      navigate: handler.navigate || null,
      submit: handler.submit || null
    });
  }

  /**
   * モーダルハンドラーの登録解除
   * @param {string} id
   */
  unregisterModal(id) {
    this.modals.delete(id);
  }

  /**
   * 現在開いているモーダル群を優先度順 (降順) で取得
   * @returns {Array<Object>}
   */
  getOpenModals() {
    const openModals = [];
    for (const modal of this.modals.values()) {
      if (modal.isOpen()) {
        openModals.push(modal);
      }
    }
    // 優先度が高い順にソート
    return openModals.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 最前面の開いているモーダルを取得
   * @returns {Object|null}
   */
  getTopModal() {
    const openModals = this.getOpenModals();
    return openModals.length > 0 ? openModals[0] : null;
  }

  /**
   * いずれかのモーダルが開いているか
   * @returns {boolean}
   */
  hasOpenModal() {
    for (const modal of this.modals.values()) {
      if (modal.isOpen()) return true;
    }
    return false;
  }

  /**
   * 最前面のモーダルを閉じる
   * @returns {boolean} モーダルを閉じた場合は true
   */
  closeTopModal() {
    const top = this.getTopModal();
    if (top && typeof top.close === 'function') {
      top.close();
      return true;
    }
    return false;
  }

  /**
   * 最前面のモーダルにナビゲーション操作 (上下左右/前後) を委譲
   * @param {'prev'|'next'|'left'|'right'} dir 
   * @returns {boolean} 操作が処理された場合は true
   */
  navigateTopModal(dir) {
    const top = this.getTopModal();
    if (top && typeof top.navigate === 'function') {
      return Boolean(top.navigate(dir));
    }
    return false;
  }

  /**
   * 最前面のモーダルに決定操作 (Submit) を委譲
   * @returns {boolean} 操作が処理された場合は true
   */
  submitTopModal() {
    const top = this.getTopModal();
    if (top && typeof top.submit === 'function') {
      return Boolean(top.submit());
    }
    return false;
  }

  /**
   * 最前面または開いているモーダル内部でテキスト入力にフォーカス中か
   * @returns {boolean}
   */
  isAnyInputFocused() {
    for (const modal of this.modals.values()) {
      if (modal.isOpen() && modal.isInputFocused && modal.isInputFocused()) {
        return true;
      }
    }
    return false;
  }
}
