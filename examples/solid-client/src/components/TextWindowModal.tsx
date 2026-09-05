import { Component, onMount, onCleanup, Show, For } from 'solid-js';
import { activeTextModal, setActiveTextModal } from '../stores/gameStore';
import { trapFocus } from '@core/input/focusTrap.js';

export const TextWindowModal: Component = () => {
  let modalCardRef: HTMLDivElement | undefined;

  const handleClose = () => {
    const modal = activeTextModal();
    if (modal && modal.resolver) {
      const res = modal.resolver;
      setActiveTextModal(null);
      res.respond(0);
    } else {
      setActiveTextModal(null);
    }
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTextModal()) return;

      if (modalCardRef && trapFocus(modalCardRef, e)) {
        return;
      }

      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown, true);
    });
  });

  return (
    <Show when={activeTextModal()}>
      {(modal) => (
        <div class="modal-backdrop" onClick={handleClose}>
          <div ref={modalCardRef} class="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">{modal().title || 'Information'}</h3>

            <div class="text-body">
              <For each={modal().lines}>
                {(line) => <div class="text-line">{line}</div>}
              </For>
            </div>

            <div class="modal-footer">
              <button onClick={handleClose} class="btn btn-primary">
                OK (Space / Enter / ESC)
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
