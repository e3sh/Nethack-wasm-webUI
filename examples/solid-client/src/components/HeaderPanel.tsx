import { Component } from 'solid-js';
import {
  engineState,
  viewMode,
  setViewMode,
  isZoomEnabled,
  setIsZoomEnabled,
  currentLanguage,
} from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const HeaderPanel: Component = () => {
  const isEn = () => currentLanguage() === 'en';

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'GRAPHIC' ? 'ASCII' : 'GRAPHIC'));
  };

  const toggleZoom = () => {
    setIsZoomEnabled((prev) => !prev);
  };

  const handleRestart = () => {
    const msg = isEn() ? 'Restart the game now?' : '現在のゲームを中断して再起動しますか？';
    if (window.confirm(msg)) {
      driverController.restartGame();
    }
  };

  const handleDeleteSave = () => {
    driverController.deleteSaveFile();
  };

  return (
    <header class="header-panel">
      <div class="brand">
        <span class="logo-icon">🐉</span>
        <span class="title">NetHack Wasm <small>GKL Solid Client</small></span>
      </div>

      <div class="quick-actions">
        <button
          class="btn btn-secondary"
          onClick={toggleViewMode}
        >
          {viewMode() === 'GRAPHIC'
            ? (isEn() ? 'View: 🎨 Graphic Canvas' : 'ビュー切替: 🎨 Graphic Canvas')
            : (isEn() ? 'View: 🔤 ASCII Grid' : 'ビュー切替: 🔤 ASCII Grid')}
        </button>

        <button
          class="btn btn-secondary"
          onClick={toggleZoom}
        >
          {isZoomEnabled()
            ? (isEn() ? '🎯 Focus Camera: ON' : '🎯 ズームカメラ: ON')
            : (isEn() ? '🎯 Focus Camera: OFF' : '🎯 ズームカメラ: OFF')}
        </button>
      </div>

      <div class="controls">
        <span class={`engine-badge ${engineState().toLowerCase()}`}>
          {engineState()}
        </span>

        <button
          onClick={handleRestart}
          class="btn btn-secondary"
          title={isEn() ? 'Restart game immediately' : 'ゲームを即時再起動'}
        >
          🔄 Restart
        </button>

        <button
          onClick={handleDeleteSave}
          class="btn btn-danger"
          title={isEn() ? 'Delete save file completely' : 'セーブデータを完全削除'}
        >
          🗑️ Delete Save
        </button>
      </div>
    </header>
  );
};
