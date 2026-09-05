import { Component, Show, createEffect, onMount, onCleanup } from 'solid-js';
import { pendingSaveInfo, currentLanguage } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';
import { trapFocus } from '@core/input/focusTrap.js';

export const SaveSelectorModal: Component = () => {
  const isEn = () => currentLanguage() === 'en';

  let modalCardRef: HTMLDivElement | undefined;
  let resumeBtnRef: HTMLButtonElement | undefined;

  createEffect(() => {
    if (pendingSaveInfo()) {
      setTimeout(() => resumeBtnRef?.focus(), 50);
    }
  });

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingSaveInfo()) return;
      if (modalCardRef && trapFocus(modalCardRef, e)) {
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  const handleStartNew = () => {
    const confirmMsg = isEn()
      ? 'Delete saved game and start a new game?'
      : '保存されているセーブデータを破棄して最初から開始しますか？';
    if (window.confirm(confirmMsg)) {
      driverController.startNewGame();
    }
  };

  return (
    <Show when={pendingSaveInfo()}>
      {(info) => (
        <div class="modal-backdrop">
          <div ref={modalCardRef} class="modal-card">
            <div class="modal-header">
              <h2>{isEn() ? '💾 Saved Game Detected' : '💾 セーブデータが見つかりました'}</h2>
            </div>
            <div class="modal-body">
              <p class="save-desc">
                {isEn()
                  ? 'A previous adventure was found. Do you want to resume or start a new game?'
                  : '前回の冒険記録が残っています。再開しますか？それとも新規に開始しますか？'}
              </p>
              <div class="save-info-box">
                <span class="label">{isEn() ? 'Player Name:' : '冒険者名 (Player):'}</span>
                <strong class="player-name">
                  {info().savePlayerName || 'Hero'}
                </strong>
              </div>
            </div>
            <div class="modal-footer">
              <button
                ref={resumeBtnRef}
                onClick={() => driverController.resumeSavedGame()}
                class="btn btn-primary btn-large"
              >
                {isEn() ? '▶️ Resume Saved Game (Continue)' : '▶️ セーブデータから再開 (Continue Game)'}
              </button>
              <button onClick={handleStartNew} class="btn btn-danger">
                {isEn() ? '⚠️ Start New Game (Delete Save)' : '⚠️ 新規ゲーム開始 (New Game / セーブ破棄)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
