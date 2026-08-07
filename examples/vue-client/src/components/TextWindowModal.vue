<template>
  <div v-if="activeTextModal" class="modal-backdrop">
    <div class="modal-content">
      <h3 class="modal-title">{{ activeTextModal.title || 'Information / Help' }}</h3>

      <div class="text-body">
        <div v-for="(line, idx) in activeTextModal.lines" :key="idx" class="text-line">
          {{ line }}
        </div>
      </div>

      <div class="modal-footer">
        <button @click="closeTextModal" class="btn btn-primary">OK (Enter / Space / ESC)</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';
import { useNetHackDriver } from '../composables/useNetHackDriver';

const gameStore = useGameStore();
const { activeTextModal } = storeToRefs(gameStore);
const { respondTextModal } = useNetHackDriver();
let isClosing = false;

function closeTextModal() {
  if (isClosing) return;
  isClosing = true;
  respondTextModal(' ');
  setTimeout(() => {
    isClosing = false;
  }, 100);
}

function handleKeyDown(e: KeyboardEvent) {
  if (!activeTextModal.value || isClosing) return;

  const k = e.key.toLowerCase();
  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || k === 'q' || e.key === 'Backspace') {
    e.preventDefault();
    e.stopPropagation();
    closeTextModal();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true);
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
}

.modal-content {
  background: #16213e;
  border: 2px solid #0f3460;
  border-radius: 8px;
  width: 650px;
  max-width: 92vw;
  max-height: 85vh;
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

.text-body {
  flex-grow: 1;
  overflow-y: auto;
  margin: 8px 0;
  background: #1a1a2e;
  border-radius: 4px;
  padding: 12px;
  font-family: 'Courier New', Consolas, monospace;
  font-size: 14px;
  line-height: 1.5;
  color: #e0e0e0;
  white-space: pre-wrap;
}

.text-line {
  min-height: 18px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #0f3460;
  padding-top: 12px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.btn-primary { background: #4ecca3; color: #111; }
</style>
