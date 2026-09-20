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
        @pointerdown="(e) => handlePointerDown(btn.id, e)"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp(btn.id)"
        @pointercancel="clearLongPress"
        @pointerleave="clearLongPress"
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
import { computed, ref } from 'vue';
import { useNetHackDriver } from '../composables/useNetHackDriver';

const props = defineProps<{
  modelValue: string;
  actionCounts?: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

const { currentLanguage, getDefaultAction, getDashAction, executeAction, executeSequence } = useNetHackDriver();
const isEn = computed(() => currentLanguage.value === 'en');

let longPressTimer: any = null;
const startPos = ref<{ x: number; y: number } | null>(null);
const isLongPressTriggered = ref<boolean>(false);
let lastTapTime = 0;
let lastTapDir = '';

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  startPos.value = null;
}

function handlePointerDown(dirId: string, e: PointerEvent) {
  clearLongPress();
  isLongPressTriggered.value = false;
  startPos.value = { x: e.clientX, y: e.clientY };

  longPressTimer = setTimeout(() => {
    isLongPressTriggered.value = true;
    const defaultAct = getDefaultAction(dirId);
    if (defaultAct) {
      if (defaultAct.actionRecipe) {
        executeSequence(defaultAct.actionRecipe);
      } else if (defaultAct.keySequence) {
        executeSequence(defaultAct.keySequence);
      } else {
        executeAction(defaultAct);
      }
    }
  }, 450);
}

function handlePointerMove(e: PointerEvent) {
  if (startPos.value) {
    const dx = Math.abs(e.clientX - startPos.value.x);
    const dy = Math.abs(e.clientY - startPos.value.y);
    if (dx > 10 || dy > 10) {
      clearLongPress();
    }
  }
}

function handlePointerUp(dirId: string) {
  clearLongPress();
  if (isLongPressTriggered.value) {
    return;
  }

  const now = Date.now();
  if (now - lastTapTime < 300 && lastTapDir === dirId) {
    // 🏃 ダブルタップ成立: ダッシュ移動（走り）を即時実行
    lastTapTime = 0;
    lastTapDir = '';
    const dashAct = getDashAction(dirId);
    if (dashAct) {
      if (dashAct.actionRecipe) {
        executeSequence(dashAct.actionRecipe);
      } else if (dashAct.keySequence) {
        executeSequence(dashAct.keySequence);
      } else {
        executeAction(dashAct);
      }
      return;
    }
  }

  lastTapTime = now;
  lastTapDir = dirId;
  emit('update:modelValue', dirId);
}

const dirButtons = computed(() => {
  const hint = isEn.value
    ? ' (Double-tap: Dash / Long press: 1-step)'
    : ' (ダブルタップ: ダッシュ / 長押し: 1歩移動・待機)';
  return [
    { id: 'NW', label: '↖', title: (isEn.value ? 'Northwest (7 / y / ↖)' : '北西 (7 / y / ↖)') + hint },
    { id: 'N', label: '↑', title: (isEn.value ? 'North (8 / k / ↑)' : '北 (8 / k / ↑)') + hint },
    { id: 'NE', label: '↗', title: (isEn.value ? 'Northeast (9 / u / ↗)' : '北東 (9 / u / ↗)') + hint },
    { id: 'W', label: '←', title: (isEn.value ? 'West (4 / h / ←)' : '西 (4 / h / ←)') + hint },
    { id: 'SELF', label: isEn.value ? 'Feet' : '足元', title: (isEn.value ? 'Feet / Self (5 / . / ·)' : '足元 (5 / . / ・)') + hint },
    { id: 'E', label: '→', title: (isEn.value ? 'East (6 / l / →)' : '東 (6 / l / →)') + hint },
    { id: 'SW', label: '↙', title: (isEn.value ? 'Southwest (1 / b / ↙)' : '南西 (1 / b / ↙)') + hint },
    { id: 'S', label: '↓', title: (isEn.value ? 'South (2 / j / ↓)' : '南 (2 / j / ↓)') + hint },
    { id: 'SE', label: '↘', title: (isEn.value ? 'Southeast (3 / n / ↘)' : '南東 (3 / n / ↘)') + hint },
  ];
});


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
  transition: all 0.12s ease;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}

.gkl-dir-btn:hover {
  background: #334155;
  border-color: #64748b;
}

.gkl-dir-btn:active {
  transform: scale(0.92);
  background: #0284c7;
  color: #ffffff;
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
