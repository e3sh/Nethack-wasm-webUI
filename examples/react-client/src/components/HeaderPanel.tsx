import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const HeaderPanel: React.FC = () => {
  const engineState = useGameStore((state) => state.engineState);
  const { deleteSaveFile, restartGame } = useNetHackDriver();

  const handleRestart = () => {
    if (window.confirm('現在のゲームを中断して再起動しますか？')) {
      restartGame();
    }
  };

  return (
    <header className="header-panel">
      <div className="header-title">
        <h1>NetHack Wasm Driver</h1>
        <span className="subtitle">React 18 Sample Client</span>
      </div>

      <div className="header-controls">
        <span className={`engine-badge ${engineState.toLowerCase()}`}>
          State: {engineState}
        </span>

        <button
          onClick={handleRestart}
          className="btn-control btn-restart"
          title="ゲームを即時再起動"
        >
          🔄 Restart
        </button>

        <button
          onClick={deleteSaveFile}
          className="btn-control btn-delete-save"
          title="セーブデータを完全削除"
        >
          🗑️ Del Save
        </button>
      </div>
    </header>
  );
};
