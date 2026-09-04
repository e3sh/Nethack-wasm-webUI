<template>
  <section class="game-viewport">
    <!-- メイン 80x24 描画 Canvas -->
    <GameCanvas v-show="viewMode === 'GRAPHIC'" />

    <!-- ASCII Grid (ビュー切替時) -->
    <div v-show="viewMode === 'ASCII'" class="ascii-grid">
      <div v-for="(row, y) in mapGrid" :key="y" class="ascii-row">
        <span
          v-for="(tile, x) in row"
          :key="x"
          class="ascii-cell"
          :class="{ 'cursor-focus': cursorPos && cursorPos.x === x && cursorPos.y === y }"
          :style="{ color: getAsciiColor(tile.color) }"
        >
          {{ tile.symbol || ' ' }}
        </span>
      </div>
    </div>

    <!-- 🎯 自キャラ周辺 拡大ズームカメラ窓 (オーバーレイ右上固定) -->
    <FocusCamera />

    <!-- 🧭 フロア設備案内フローティング HUD (Landmarks Bar) -->
    <FloorLandmarksHud />
  </section>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';
import GameCanvas from './GameCanvas.vue';
import FocusCamera from './FocusCamera.vue';
import FloorLandmarksHud from './FloorLandmarksHud.vue';

const gameStore = useGameStore();
const { viewMode, mapGrid, cursorPos } = storeToRefs(gameStore);

function getAsciiColor(colorNum: number = 7): string {
  const colors = [
    '#000000', '#b21818', '#18b218', '#b26818',
    '#1818b2', '#b218b2', '#18b2b2', '#b2b2b2',
    '#686868', '#ff5454', '#54ff54', '#ffff54',
    '#5454ff', '#ff54ff', '#54ffff', '#ffffff'
  ];
  return colors[colorNum] || '#ffffff';
}
</script>

<style scoped>
.game-viewport {
  position: relative;
  background-color: #050505;
  border: 1px solid #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 380px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
}

.ascii-grid {
  font-family: 'Courier New', Consolas, monospace;
  font-size: 16px;
  line-height: 1.1;
  background: #000;
  padding: 8px;
  user-select: none;
  white-space: pre;
}

.ascii-row {
  display: flex;
}

.ascii-cell {
  width: 10px;
  height: 18px;
  display: inline-block;
  text-align: center;
}

.ascii-cell.cursor-focus {
  background: rgba(241, 196, 15, 0.4);
  outline: 1px solid #f1c40f;
}
</style>
