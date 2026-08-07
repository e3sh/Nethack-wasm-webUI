<script lang="ts">
  import { engineStateStore } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';

  $: engineState = $engineStateStore;

  function handleRestart() {
    if (confirm('現在のゲームを中断して再起動しますか？')) {
      driverController.restartGame();
    }
  }

  function handleDeleteSave() {
    driverController.deleteSaveFile();
  }
</script>

<header class="header-panel">
  <div class="header-title">
    <h1>NetHack Wasm Driver</h1>
    <span class="subtitle">Svelte Sample Client</span>
  </div>

  <div class="header-controls">
    <span class="engine-badge {engineState.toLowerCase()}">
      State: {engineState}
    </span>

    <button
      on:click={handleRestart}
      class="btn-control btn-restart"
      title="ゲームを即時再起動"
    >
      🔄 Restart
    </button>

    <button
      on:click={handleDeleteSave}
      class="btn-control btn-delete-save"
      title="セーブデータを完全削除"
    >
      🗑️ Del Save
    </button>
  </div>
</header>

<style>
.header-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #16213e;
  padding-bottom: 12px;
}

.header-title h1 {
  margin: 0;
  font-size: 22px;
  color: #4ecca3;
  display: inline-block;
}

.subtitle {
  margin-left: 10px;
  font-size: 13px;
  color: #7f8c8d;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.engine-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  font-family: monospace;
}

.engine-badge.running { background: #2ecc71; color: #111; }
.engine-badge.idle { background: #7f8c8d; color: #fff; }
.engine-badge.saved { background: #f39c12; color: #111; }
.engine-badge.gameover { background: #e74c3c; color: #fff; }

.btn-control {
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-restart {
  background: #2980b9;
}
.btn-restart:hover {
  background: #3498db;
}

.btn-delete-save {
  background: #c0392b;
}
.btn-delete-save:hover {
  background: #e74c3c;
}
</style>
