/**
 * KeyHandler - グローバルキー入力 & モーダル・テキストウィンドウ・ゲームプレイ中のキーディスパッチャー
 */
import { trapFocus } from '../../../../src/core/input/focusTrap.js';

export class KeyHandler {
  constructor({ getCore, getModalManager, getContainerModal }) {
    this.getCore = getCore || (() => null);
    this.getModalManager = getModalManager || (() => null);
    this.getContainerModal = getContainerModal || (() => null);
  }

  handleGlobalKeyDown(e) {
    // コンテナモーダルが開いている場合の処理
    const containerModal = this.getContainerModal();
    if (containerModal && containerModal.isVisible) {
      if (e.key === 'Escape' || e.key === 'q' || e.code === 'Escape' || e.code === 'KeyQ') {
        e.preventDefault();
        containerModal.close();
        return;
      }
      // コンテナモーダル表示中は通常のゲームキー入力をブロック
      return;
    }

    const modal = this.getModalManager();
    if (modal) {
      const activeCard = modal.getActiveModalCard ? modal.getActiveModalCard() : null;
      if (activeCard) {
        const wishSuggest = document.getElementById('wish-suggest-dropdown');
        const genocideSuggest = document.getElementById('genocide-suggest-dropdown');
        const polySuggest = document.getElementById('poly-suggest-dropdown');
        const isSuggestActive = (wishSuggest && wishSuggest.classList.contains('active')) ||
                                (genocideSuggest && genocideSuggest.classList.contains('active')) ||
                                (polySuggest && polySuggest.style.display !== 'none' && polySuggest.children.length > 0);
        if (!isSuggestActive) {
          if (trapFocus(activeCard, e)) {
            return;
          }
        }
      }
    }

    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    const core = this.getCore();
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

    if (modal.isAnyModalOpen && modal.isAnyModalOpen()) {
      return;
    }

    if (e.code) {
      if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) return;
      core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
    }
  }
}
