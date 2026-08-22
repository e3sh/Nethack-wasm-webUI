import { Component, Show } from 'solid-js';
import { pendingSaveInfo } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const SaveSelectorModal: Component = () => {
  const handleStartNew = () => {
    if (window.confirm('保存されているセーブデータを破棄して最初から開始しますか？')) {
      driverController.startNewGame();
    }
  };

  return (
    <Show when={pendingSaveInfo()}>
      {(info) => (
        <div class="modal-backdrop">
          <div class="modal-card">
            <div class="modal-header">
              <h2>💾 セーブデータが見つかりました</h2>
            </div>
            <div class="modal-body">
              <p class="save-desc">
                前回の冒険記録が残っています。再開しますか？それとも新規に開始しますか？
              </p>
              <div class="save-info-box">
                <span class="label">冒険者名 (Player):</span>
                <strong class="player-name">
                  {info().savePlayerName || 'Hero'}
                </strong>
              </div>
            </div>
            <div class="modal-footer">
              <button
                onClick={() => driverController.resumeSavedGame()}
                class="btn btn-primary btn-large"
              >
                ▶️ セーブデータから再開 (Continue Game)
              </button>
              <button onClick={handleStartNew} class="btn btn-danger">
                ⚠️ 新規ゲーム開始 (New Game / セーブ破棄)
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
