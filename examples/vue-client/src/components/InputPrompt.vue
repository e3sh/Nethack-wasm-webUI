<template>
  <div class="prompt-wrapper">
    <div v-if="activePrompt" class="prompt-container">
      <div class="prompt-badge" :class="{ 'turn-badge': isTurnInput }">
        <span class="pulse-icon">●</span> {{ isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]' }}
      </div>

      <div class="prompt-content">
        <div class="prompt-text">
          {{ activePrompt.promptText || activePrompt.prompt || '' }}
          <span v-if="activePrompt.choicesHint" class="choices-hint">
            ({{ activePrompt.choicesHint }})
          </span>
        </div>

        <!-- 1. テキスト入力プロンプト -->
        <div v-if="isLineText" class="prompt-text-input">
          <input
            v-model="inputText"
            @keydown.enter="submitText"
            @keydown.esc.prevent="cancelText"
            type="text"
            placeholder="Input text (ESC to cancel)"
            ref="inputRef"
            autofocus
          />
          <button @click="submitText" class="btn btn-primary">Submit</button>
          <button @click="cancelText" class="btn btn-secondary">Cancel</button>
        </div>

        <!-- 2. コア構造化選択肢ボタン群 -->
        <div v-else-if="options.length > 0" class="prompt-actions">
          <button
            v-for="btn in options"
            :key="btn.key"
            @click="respondPrompt(btn.key)"
            class="btn"
            :class="btn.btnClass || 'btn-primary'"
          >
            {{ btn.label }}
          </button>
        </div>

        <!-- 3. 通常ターン移動入力待ち -->
        <div v-else-if="isTurnInput" class="turn-hint">
          <span>Use Arrow keys / hjkl / numpad to move</span>
        </div>
      </div>
    </div>

    <div v-else class="prompt-placeholder">
      <span class="idle-text">Ready / Turn Input Waiting</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';
import { useNetHackDriver } from '../composables/useNetHackDriver';

const gameStore = useGameStore();
const { activePrompt } = storeToRefs(gameStore);
const { respondPrompt, cancelPrompt } = useNetHackDriver();

const inputText = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

const isLineText = computed(() => activePrompt.value?.inputType === 'LINE_TEXT');
const isTurnInput = computed(() => activePrompt.value?.inputType === 'DIRECTION');

const options = computed(() => activePrompt.value?.options || []);

watch(activePrompt, async (newVal) => {
  if (newVal && isLineText.value) {
    inputText.value = '';
    await nextTick();
    inputRef.value?.focus();
  }
});

function submitText() {
  const val = inputText.value ? inputText.value.trim() : '';
  inputText.value = '';
  respondPrompt(val);
}

function cancelText() {
  inputText.value = '';
  cancelPrompt();
}
</script>

<style scoped>
.prompt-wrapper { min-height: 48px; display: flex; align-items: center; }
.prompt-container {
  width: 100%; background: #222831; border: 1px solid #00adb5;
  border-radius: 4px; padding: 8px 15px; display: flex; align-items: center;
  gap: 15px; color: #eeeeee; font-family: monospace; box-sizing: border-box;
}
.prompt-placeholder {
  width: 100%; padding: 8px 15px; color: #7f8c8d; font-family: monospace;
  font-size: 13px; border: 1px dashed #333; border-radius: 4px; box-sizing: border-box;
}
.prompt-badge {
  background: #00adb5; color: #222831; font-weight: bold; padding: 4px 8px;
  border-radius: 4px; font-size: 12px; display: flex; align-items: center;
  gap: 5px; white-space: nowrap;
}
.prompt-badge.turn-badge { background: #2ecc71; color: #111; }
.pulse-icon { color: #ff2e63; animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
.prompt-content { flex-grow: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.prompt-text { font-size: 14px; }
.choices-hint { color: #f1c40f; font-weight: bold; margin-left: 8px; font-size: 13px; }
.turn-hint { color: #7f8c8d; font-size: 12px; }
.prompt-text-input { display: flex; gap: 8px; }
.prompt-text-input input {
  background: #393e46; border: 1px solid #00adb5; color: #fff;
  padding: 6px 10px; border-radius: 4px; font-family: monospace; width: 220px;
}
.prompt-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.btn { padding: 6px 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
.btn-primary { background: #00adb5; color: #111; }
.btn-secondary { background: #555; color: #fff; }
</style>
