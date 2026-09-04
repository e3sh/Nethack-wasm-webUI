<template>
  <header class="header-panel">
    <div class="brand">
      <span class="logo-icon">🐉</span>
      <span class="title">NetHack Wasm <small>GKL Vue 3 Client</small></span>
    </div>

    <div class="quick-actions">
      <button
        class="btn btn-secondary"
        @click="toggleViewMode"
      >
        {{ viewMode === 'GRAPHIC' ? (isEn ? 'View: 🎨 Graphic Canvas' : 'ビュー切替: 🎨 Graphic Canvas') : (isEn ? 'View: 🔤 ASCII Grid' : 'ビュー切替: 🔤 ASCII Grid') }}
      </button>

      <button
        class="btn btn-secondary"
        @click="toggleZoom"
      >
        {{ isZoomEnabled ? (isEn ? '🎯 Focus Camera: ON' : '🎯 ズームカメラ: ON') : (isEn ? '🎯 Focus Camera: OFF' : '🎯 ズームカメラ: OFF') }}
      </button>
    </div>

    <div class="controls">
      <span class="engine-badge" :class="engineState.toLowerCase()">
        {{ engineState }}
      </span>

      <button
        @click="handleRestart"
        class="btn btn-secondary"
        :title="isEn ? 'Restart game immediately' : 'ゲームを即時再起動'"
      >
        🔄 Restart
      </button>

      <button
        @click="deleteSaveFile"
        class="btn btn-danger"
        :title="isEn ? 'Delete save file completely' : 'セーブデータを完全削除'"
      >
        🗑️ Delete Save
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';

const { deleteSaveFile, restartGame, currentLanguage } = useNetHackDriver();
const gameStore = useGameStore();
const { engineState, viewMode, isZoomEnabled } = storeToRefs(gameStore);
const { toggleViewMode, toggleZoom } = gameStore;

const isEn = computed(() => currentLanguage.value === 'en');

function handleRestart() {
  const msg = isEn.value ? 'Restart the game now?' : '現在のゲームを中断して再起動しますか？';
  if (confirm(msg)) {
    restartGame();
  }
}
</script>

<style scoped>
.header-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1e293b;
  border-radius: 8px;
  padding: 8px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  gap: 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 22px;
}

.title {
  font-size: 16px;
  font-weight: 700;
  color: #f8fafc;
}

.title small {
  font-size: 11px;
  color: #94a3b8;
  font-weight: normal;
  margin-left: 4px;
}

.quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.engine-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
  font-family: monospace;
}

.engine-badge.running { background: #10b981; color: #022c22; }
.engine-badge.idle { background: #64748b; color: #f8fafc; }
.engine-badge.saved { background: #f59e0b; color: #451a03; }
.engine-badge.gameover { background: #ef4444; color: #ffffff; }

.btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #334155;
  color: #f1f5f9;
  border-color: #475569;
}

.btn-secondary:hover {
  background: #475569;
  color: #ffffff;
}

.btn-danger {
  background: #dc2626;
  color: #ffffff;
}

.btn-danger:hover {
  background: #b91c1c;
}
</style>
