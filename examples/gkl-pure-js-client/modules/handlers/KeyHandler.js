/**
 * KeyHandler - グローバルキー入力 & モーダル・テキストウィンドウ・ゲームプレイ中のキーディスパッチャー
 */
export class KeyHandler {
  constructor({ getCore, getModalManager }) {
    this.getCore = getCore || (() => null);
    this.getModalManager = getModalManager || (() => null);
  }

  handleGlobalKeyDown(e) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    const core = this.getCore();
    const modal = this.getModalManager();
    if (!core || !modal) return;

    const elMenuModal = modal.elMenuModal;
    const isMenuOpen = elMenuModal && !elMenuModal.classList.contains('hidden');

    if (isMenuOpen && modal.isTextWindowMode) {
      if (['Space', 'Enter', 'Escape', 'KeyQ', 'Backspace'].includes(e.code) || e.key === ' ' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'q') {
        e.preventDefault();
        core.sendKey('Space');
        return;
      }
    }

    if (isMenuOpen && !modal.isTextWindowMode) {
      if (e.key === 'ArrowDown' || e.code === 'ArrowDown' || e.code === 'Numpad2') {
        e.preventDefault();
        if (modal.selectableMenuButtons.length > 0) {
          modal.activeMenuFocusIndex = (modal.activeMenuFocusIndex + 1) % modal.selectableMenuButtons.length;
          modal.updateMenuFocus();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.code === 'ArrowUp' || e.code === 'Numpad8') {
        e.preventDefault();
        if (modal.selectableMenuButtons.length > 0) {
          modal.activeMenuFocusIndex = (modal.activeMenuFocusIndex - 1 + modal.selectableMenuButtons.length) % modal.selectableMenuButtons.length;
          modal.updateMenuFocus();
        }
        return;
      }

      if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (modal.selectableMenuButtons[modal.activeMenuFocusIndex]) {
          modal.selectableMenuButtons[modal.activeMenuFocusIndex].click();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === '0' || e.key === 'q' || e.code === 'Escape' || e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'KeyQ') {
        e.preventDefault();
        core.respond(0);
        return;
      }

      if (e.key && e.key.length === 1) {
        e.preventDefault();
        core.respond(e.key);
        return;
      }
    }

    if (e.code) {
      if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) return;
      core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
    }
  }
}
