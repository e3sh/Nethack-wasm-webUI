import { Component } from 'solid-js';
import { engineState, currentLanguage } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const HeaderPanel: Component = () => {
  const isEn = () => currentLanguage() === 'en';

  const handleRestart = () => {
    const msg = isEn() ? 'Restart the game now?' : '現在のゲームを中断して再起動しますか？';
    if (confirm(msg)) {
      driverController.restartGame();
    }
  };

  const handleDeleteSave = () => {
    driverController.deleteSaveFile();
  };

  return (
    <header class="header-panel">
      <div class="header-title">
        <h1>NetHack WebUICore</h1>
        <span class="subtitle">SolidJS Sample Client</span>
      </div>

      <div class="header-controls">
        <span class={`engine-badge ${engineState().toLowerCase()}`}>
          State: {engineState()}
        </span>

        <button
          onClick={handleRestart}
          class="btn-control btn-restart"
          title={isEn() ? 'Restart game immediately' : 'ゲームを即時再起動'}
        >
          🔄 Restart
        </button>

        <button
          onClick={handleDeleteSave}
          class="btn-control btn-delete-save"
          title={isEn() ? 'Delete save file completely' : 'セーブデータを完全削除'}
        >
          🗑️ Del Save
        </button>
      </div>
    </header>
  );
};
