<template>
  <div v-if="hasLandmarks" class="floor-landmarks-hud">
    <span class="landmarks-floor-tag">🗺️ {{ floorTag }}</span>
    <div class="landmarks-badges-container">
      <span
        v-for="(item, idx) in summaryItems"
        :key="idx"
        class="landmark-badge-item"
        :title="isEn ? item.tooltipEn : item.tooltipJa"
      >
        {{ item.icon }} {{ isEn ? item.nameEn : item.nameJa }}
        <small v-if="item.count > 1" class="landmark-count">x{{ item.count }}</small>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { storeToRefs } from 'pinia';

const gameStore = useGameStore();
const { floorLandmarks, gklSituation } = storeToRefs(gameStore);
const { currentLanguage } = useNetHackDriver();

const isEn = computed(() => currentLanguage.value === 'en');

const landmarks = computed(() => {
  return floorLandmarks.value || gklSituation.value?.landmarks || null;
});

const summaryItems = computed(() => {
  return landmarks.value?.summary || [];
});

const hasLandmarks = computed(() => {
  return summaryItems.value && summaryItems.value.length > 0;
});

const floorTag = computed(() => {
  return landmarks.value?.floorKey || 'Dlvl:1';
});
</script>

<style scoped>
.floor-landmarks-hud {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 20px;
  padding: 4px 12px;
  z-index: 60; /* フォーカスカメラ(50)より前面に最優先表示 */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.8), 0 0 8px rgba(56, 189, 248, 0.2);
  font-family: monospace;
  font-size: 11px;
  color: #94a3b8;
  max-width: calc(100% - 24px);
  overflow-x: auto;
  user-select: none;
  pointer-events: auto;
}

.landmarks-floor-tag {
  font-weight: 700;
  color: #38bdf8;
  padding-right: 6px;
  border-right: 1px solid rgba(100, 116, 139, 0.4);
  white-space: nowrap;
}

.landmarks-badges-container {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.landmark-badge-item {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 10px;
  padding: 1px 7px;
  color: #e2e8f0;
  font-size: 11px;
  white-space: nowrap;
  cursor: default;
  transition: all 0.15s ease;
}

.landmark-badge-item:hover {
  background: #334155;
  border-color: #38bdf8;
  color: #ffffff;
}

.landmark-count {
  color: #38bdf8;
  font-weight: bold;
}
</style>
