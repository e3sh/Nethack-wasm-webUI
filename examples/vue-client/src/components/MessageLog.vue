<template>
  <div class="message-log" ref="logContainer">
    <div v-for="(msg, index) in messages" :key="index" class="log-line">
      {{ msg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';

const gameStore = useGameStore();
const { messages } = storeToRefs(gameStore);
const logContainer = ref<HTMLDivElement | null>(null);

// メッセージ更新時に最下部へ自動スクロール
watch(
  messages,
  async () => {
    await nextTick();
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  },
  { deep: true }
);
</script>

<style scoped>
.message-log {
  background-color: #121212;
  color: #e0e0e0;
  font-family: monospace;
  font-size: 14px;
  height: 120px;
  overflow-y: auto;
  padding: 8px 12px;
  border: 1px solid #333;
  border-radius: 4px;
  box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
}

.log-line {
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
