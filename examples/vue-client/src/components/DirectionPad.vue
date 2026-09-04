<template>
  <div class="gkl-dir-filter-container">
    <div class="gkl-dir-filter-bar">
      <span class="gkl-filter-label">{{ isEn ? 'Filter:' : '表示:' }} {{ filterLabel }}</span>
      <button
        class="gkl-dir-reset-btn"
        :class="{ active: modelValue === 'ALL' }"
        :title="isEn ? 'Reset filter (Show all)' : 'フィルター解除 (すべて表示)'"
        @click="selectDir('ALL')"
      >
        {{ isEn ? 'Show All' : '全表示' }}
      </button>
    </div>

    <div class="gkl-direction-pad">
      <button
        v-for="btn in dirButtons"
        :key="btn.id"
        class="gkl-dir-btn"
        :class="{ active: modelValue === btn.id, 'has-action': getActionCount(btn.id) > 0 }"
        :title="btn.title"
        @click="selectDir(btn.id)"
      >
        {{ btn.label }}
        <span v-if="getActionCount(btn.id) > 0" class="gkl-dir-badge">
          {{ getActionCount(btn.id) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useNetHackDriver } from '../composables/useNetHackDriver';

const props = defineProps<{
  modelValue: string;
  actionCounts?: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

const { currentLanguage } = useNetHackDriver();
const isEn = computed(() => currentLanguage.value === 'en');

const dirButtons = computed(() => [
  { id: 'NW', label: '↖', title: isEn.value ? 'Northwest (7 / y / ↖)' : '北西 (7 / y / ↖)' },
  { id: 'N', label: '↑', title: isEn.value ? 'North (8 / k / ↑)' : '北 (8 / k / ↑)' },
  { id: 'NE', label: '↗', title: isEn.value ? 'Northeast (9 / u / ↗)' : '北東 (9 / u / ↗)' },
  { id: 'W', label: '←', title: isEn.value ? 'West (4 / h / ←)' : '西 (4 / h / ←)' },
  { id: 'SELF', label: isEn.value ? 'Feet' : '足元', title: isEn.value ? 'Feet / Self (5 / . / ·)' : '足元 (5 / . / ・)' },
  { id: 'E', label: '→', title: isEn.value ? 'East (6 / l / →)' : '東 (6 / l / →)' },
  { id: 'SW', label: '↙', title: isEn.value ? 'Southwest (1 / b / ↙)' : '南西 (1 / b / ↙)' },
  { id: 'S', label: '↓', title: isEn.value ? 'South (2 / j / ↓)' : '南 (2 / j / ↓)' },
  { id: 'SE', label: '↘', title: isEn.value ? 'Southeast (3 / n / ↘)' : '南東 (3 / n / ↘)' },
]);

const filterLabel = computed(() => {
  if (props.modelValue === 'ALL') return isEn.value ? 'All Directions' : '全て';
  if (props.modelValue === 'SELF') return isEn.value ? 'Feet (Self)' : '足元';
  return props.modelValue;
});

function getActionCount(dir: string): number {
  return props.actionCounts?.[dir] || 0;
}

function selectDir(dir: string) {
  emit('update:modelValue', dir);
}
</script>

<style scoped>
.gkl-dir-filter-container {
  padding: 8px 12px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gkl-dir-filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.gkl-filter-label {
  font-size: 11px;
  font-weight: bold;
  color: #94a3b8;
}

.gkl-dir-reset-btn {
  background: #1e293b;
  color: #cbd5e1;
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 1px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.gkl-dir-reset-btn.active, .gkl-dir-reset-btn:hover {
  background: #38bdf8;
  color: #0f172a;
  font-weight: bold;
}

.gkl-direction-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  max-width: 180px;
  margin: 0 auto;
}

.gkl-dir-btn {
  position: relative;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 4px;
  color: #f1f5f9;
  height: 28px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.gkl-dir-btn:hover {
  background: #334155;
  border-color: #64748b;
}

.gkl-dir-btn.active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
}

.gkl-dir-btn.has-action {
  border-color: #38bdf8;
}

.gkl-dir-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  background: #38bdf8;
  color: #0f172a;
  font-size: 8px;
  font-weight: 800;
  width: 12px;
  height: 12px;
  line-height: 12px;
  border-radius: 50%;
  text-align: center;
}
</style>
