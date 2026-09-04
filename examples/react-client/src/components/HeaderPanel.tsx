import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const HeaderPanel: React.FC = () => {
  const engineState = useGameStore((state) => state.engineState);
  const viewMode = useGameStore((state) => state.viewMode);
  const isZoomEnabled = useGameStore((state) => state.isZoomEnabled);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  const toggleViewMode = useGameStore((state) => state.toggleViewMode);
  const toggleZoom = useGameStore((state) => state.toggleZoom);

  const { deleteSaveFile, restartGame } = useNetHackDriver();

  const isEn = currentLanguage === 'en';

  const handleRestart = () => {
    const msg = isEn ? 'Restart the game now?' : '現在のゲームを中断して再起動しますか？';
    if (window.confirm(msg)) {
      restartGame();
    }
  };

  return (
    <header className="header-panel">
      <div className="brand">
        <span className="logo-icon">🐉</span>
        <span className="title">NetHack Wasm <small>GKL React 18 Client</small></span>
      </div>

      <div className="quick-actions">
        <button
          className="btn btn-secondary"
          onClick={toggleViewMode}
        >
          {viewMode === 'GRAPHIC'
            ? (isEn ? 'View: 🎨 Graphic Canvas' : 'ビュー切替: 🎨 Graphic Canvas')
            : (isEn ? 'View: 🔤 ASCII Grid' : 'ビュー切替: 🔤 ASCII Grid')}
        </button>

        <button
          className="btn btn-secondary"
          onClick={toggleZoom}
        >
          {isZoomEnabled
            ? (isEn ? '🎯 Focus Camera: ON' : '🎯 ズームカメラ: ON')
            : (isEn ? '🎯 Focus Camera: OFF' : '🎯 ズームカメラ: OFF')}
        </button>
      </div>

      <div className="controls">
        <span className={`engine-badge ${engineState.toLowerCase()}`}>
          {engineState}
        </span>

        <button
          onClick={handleRestart}
          className="btn btn-secondary"
          title={isEn ? 'Restart game immediately' : 'ゲームを即時再起動'}
        >
          🔄 Restart
        </button>

        <button
          onClick={deleteSaveFile}
          className="btn btn-danger"
          title={isEn ? 'Delete save file completely' : 'セーブデータを完全削除'}
        >
          🗑️ Delete Save
        </button>
      </div>
    </header>
  );
};
