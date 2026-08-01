<template>
  <div v-if="activeMenu" class="modal-backdrop">
    <div class="modal-content">
      <h3 class="modal-title">{{ activeMenu.prompt || 'Select Item' }}</h3>

      <div class="menu-list">
        <div
          v-for="(item, idx) in activeMenu.items"
          :key="idx"
          class="menu-item-row"
          :class="{ 
            'menu-header': item.isHeader,
            'selected': selectedIndices.includes(idx)
          }"
          @click="handleItemClick(idx, item)"
        >
          <!-- 1. アクセラレータキー (a), b), c)...) -->
          <span class="item-acc" v-if="getAccChar(item)">
            {{ getAccChar(item) }})
          </span>

          <!-- 2. 正確な CSS Sprite タイル表示 -->
          <span
            v-if="getTileStyle(item)"
            class="item-tile"
            :style="getTileStyle(item)"
          ></span>

          <!-- 3. アイテム文字列 -->
          <span class="item-str">{{ item.str }}</span>
        </div>
      </div>

      <div class="modal-footer">
        <template v-if="activeMenu.how === 0">
          <button @click="cancelMenu" class="btn btn-primary">OK (Enter / Space / ESC)</button>
        </template>
        <template v-else>
          <button @click="confirmSelection" class="btn btn-primary">OK (Enter)</button>
          <button @click="cancelMenu" class="btn btn-secondary">Cancel (ESC)</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { getTileMapping } from '../utils/tileMapping';

const gameStore = useGameStore();
const { activeMenu } = storeToRefs(gameStore);
const { respondMenu } = useNetHackDriver();

const selectedIndices = ref<number[]>([]);
const isSubmitting = ref(false);
let tileMapTable: Record<number, number> = {};

onMounted(() => {
  tileMapTable = getTileMapping();
  window.addEventListener('keydown', handleKeyDown, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true);
});

watch(activeMenu, (newVal) => {
  if (newVal) {
    selectedIndices.value = [];
    isSubmitting.value = false;
  }
});

function getAccChar(item: any): string {
  if (item.isHeader) return '';
  const ch = item.accelerator || item.ch;
  if (typeof ch === 'string' && ch !== '\x00') return ch;
  if (typeof ch === 'number' && ch > 0) return String.fromCharCode(ch);
  return '';
}

function getTileStyle(item: any): string {
  if (item.isHeader) return '';
  const glyph = item.glyph !== undefined ? item.glyph : (item.glyphInfo?.glyph ?? -1);
  if (glyph < 0 || !tileMapTable) return '';

  const tileIdx = tileMapTable[glyph];
  if (tileIdx === undefined || tileIdx < 0) return '';

  const tilesPerRow = 40;
  const origTileSize = 32;
  const tx = (tileIdx % tilesPerRow) * origTileSize;
  const ty = Math.floor(tileIdx / tilesPerRow) * origTileSize;

  const posX = -(tx / 2);
  const posY = -(ty / 2);

  return `background-image: url(/pict/nethack_default_32.png); background-position: ${posX}px ${posY}px; background-size: 640px auto; width: 16px; height: 16px; min-width: 16px; min-height: 16px; flex-shrink: 0; display: inline-block; image-rendering: pixelated; margin-right: 6px; background-repeat: no-repeat; vertical-align: middle;`;
}

function safeRespondMenu(val: any) {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  respondMenu(val);
}

function handleItemClick(idx: number, item: any) {
  if (item.isHeader || isSubmitting.value) return;
  const how = activeMenu.value?.how ?? 1;

  if (how === 0) {
    safeRespondMenu(0);
    return;
  }

  if (how === 1) {
    safeRespondMenu([item]);
    return;
  }

  const pos = selectedIndices.value.indexOf(idx);
  if (pos > -1) {
    selectedIndices.value.splice(pos, 1);
  } else {
    selectedIndices.value.push(idx);
  }
}

function confirmSelection() {
  if (!activeMenu.value || isSubmitting.value) return;

  if (activeMenu.value.how === 0) {
    safeRespondMenu(0);
    return;
  }

  if (selectedIndices.value.length > 0) {
    const selectedItems = selectedIndices.value.map(
      (idx) => activeMenu.value!.items[idx]
    );
    safeRespondMenu(selectedItems);
  } else {
    const validItem = activeMenu.value.items.find(
      (it: any) => !it.isHeader && it.identifier !== undefined && it.identifier !== 0
    );
    safeRespondMenu(validItem ? [validItem] : 0);
  }
}

function cancelMenu() {
  if (isSubmitting.value) return;
  safeRespondMenu(0);
}

function handleKeyDown(e: KeyboardEvent) {
  if (!activeMenu.value || isSubmitting.value) return;

  if (e.key === 'Escape' || e.key === ' ' || (activeMenu.value.how === 0 && e.key === 'Enter')) {
    e.preventDefault();
    e.stopPropagation();
    cancelMenu();
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    confirmSelection();
    return;
  }

  if (e.key.length === 1 && activeMenu.value.how !== 0) {
    const pressedKey = e.key;
    const matchItem = activeMenu.value.items.find((it: any) => {
      if (it.isHeader) return false;
      const c = getAccChar(it);
      return c === pressedKey;
    });

    if (matchItem) {
      e.preventDefault();
      e.stopPropagation();
      safeRespondMenu([matchItem]);
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #16213e;
  border: 2px solid #0f3460;
  border-radius: 8px;
  width: 550px;
  max-width: 92vw;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9);
  color: #e94560;
}

.modal-title {
  margin: 0 0 10px 0;
  color: #4ecca3;
  font-size: 18px;
  border-bottom: 1px solid #0f3460;
  padding-bottom: 8px;
}

.menu-list {
  flex-grow: 1;
  overflow-y: auto;
  margin: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item-row {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  background: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e0e0e0;
  font-family: monospace;
}

.menu-item-row:hover:not(.menu-header) {
  background: #0f3460;
  color: #ffffff;
}

.menu-item-row.selected {
  background: #4ecca3;
  color: #111111;
  font-weight: bold;
}

.menu-header {
  font-weight: bold;
  color: #f39c12;
  background: transparent;
  cursor: default;
  padding-top: 8px;
  border-bottom: 1px dashed #333;
}

.item-acc {
  color: #f39c12;
  font-weight: bold;
  min-width: 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #0f3460;
  padding-top: 12px;
}

.btn {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.btn-primary { background: #4ecca3; color: #111; }
.btn-secondary { background: #555; color: #fff; }
</style>
