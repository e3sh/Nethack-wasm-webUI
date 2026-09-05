<script lang="ts">
  import {
    engineStateStore,
    viewModeStore,
    isZoomEnabledStore,
  } from '../stores/gameStore';
  import { driverController, currentLanguageStore } from '../services/useNetHackDriver';

  $: engineState = $engineStateStore;
  $: viewMode = $viewModeStore;
  $: isZoomEnabled = $isZoomEnabledStore;
  $: isEn = $currentLanguageStore === 'en';

  function toggleViewMode() {
    viewModeStore.update((prev) => (prev === 'GRAPHIC' ? 'ASCII' : 'GRAPHIC'));
  }

  function toggleZoom() {
    isZoomEnabledStore.update((prev) => !prev);
  }

  function handleRestart() {
    const msg = isEn ? 'Restart the game now?' : '現在のゲームを中断して再起動しますか？';
    if (confirm(msg)) {
      driverController.restartGame();
    }
  }

  function handleDeleteSave() {
    driverController.deleteSaveFile();
  }
</script>

<header class="header-panel">
  <div class="brand">
    <span class="logo-icon">🐉</span>
    <span class="title">NetHack Wasm <small>GKL Svelte Client</small></span>
  </div>

  <div class="quick-actions">
    <button
      class="btn btn-secondary"
      on:click={toggleViewMode}
    >
      {viewMode === 'GRAPHIC'
        ? (isEn ? 'View: 🎨 Graphic Canvas' : 'ビュー切替: 🎨 Graphic Canvas')
        : (isEn ? 'View: 🔤 ASCII Grid' : 'ビュー切替: 🔤 ASCII Grid')}
    </button>

    <button
      class="btn btn-secondary"
      on:click={toggleZoom}
    >
      {isZoomEnabled
        ? (isEn ? '🎯 Focus Camera: ON' : '🎯 ズームカメラ: ON')
        : (isEn ? '🎯 Focus Camera: OFF' : '🎯 ズームカメラ: OFF')}
    </button>
  </div>

  <div class="controls">
    <span class="engine-badge {engineState.toLowerCase()}">
      {engineState}
    </span>

    <button
      on:click={handleRestart}
      class="btn btn-secondary"
      title={isEn ? 'Restart game immediately' : 'ゲームを即時再起動'}
    >
      🔄 Restart
    </button>

    <button
      on:click={handleDeleteSave}
      class="btn btn-danger"
      title={isEn ? 'Delete save file completely' : 'セーブデータを完全削除'}
    >
      🗑️ Delete Save
    </button>
  </div>
</header>
