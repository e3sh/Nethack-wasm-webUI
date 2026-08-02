<template>
  <div class="prompt-wrapper">
    <div v-if="activePrompt" class="prompt-container">
      <div class="prompt-badge" :class="{ 'turn-badge': isTurnInput }">
        <span class="pulse-icon">●</span> {{ isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]' }}
      </div>

      <div class="prompt-text">
        {{ activePrompt.prompt }}
      </div>

      <!-- 1. テキスト入力プロンプト (askname, getlin, get_ext_cmd, options 等) -->
      <div v-if="isTextPrompt" class="prompt-text-input">
        <input
          v-model="inputText"
          @keydown.enter="submitText"
          @keydown.esc.prevent="cancelText"
          type="text"
          :placeholder="isExtCmd ? 'e.g. pray, dip, jump' : 'Input text (ESC to cancel)'"
          ref="inputRef"
          autofocus
        />
        <button @click="submitText" class="btn btn-primary">Submit</button>
        <button @click="cancelText" class="btn btn-secondary">Cancel (ESC)</button>
      </div>

      <!-- 2. Y/N または 選択肢(Choices/Yes/No) 質問プロンプトの場合 -->
      <div v-else-if="isYNPrompt && !isTurnInput" class="prompt-actions">
        <button @click="sendChar('y')" class="btn btn-yes">Yes (y)</button>
        <button @click="sendChar('n')" class="btn btn-no">No (n)</button>
        <button @click="sendChar('q')" class="btn btn-cancel">Quit/Cancel (ESC)</button>
      </div>

      <!-- 3. 通常移動/ターン入力待ちの場合 -->
      <div v-else-if="isTurnInput" class="turn-hint">
        <span>Use Arrow keys / hjkl to move</span>
      </div>
    </div>

    <div v-else class="prompt-placeholder">
      <span class="idle-text">Ready / Turn Input Waiting (Press arrow keys or hjkl)</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';
import { useNetHackDriver } from '../composables/useNetHackDriver';

const gameStore = useGameStore();
const { activePrompt } = storeToRefs(gameStore);
const { respondPrompt } = useNetHackDriver();

const inputText = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

const isTurnInput = computed(() => {
  if (!activePrompt.value) return false;
  const ctx = activePrompt.value.context;
  return ctx === 'nhgetch' || ctx === 'poskey' || ctx === 'getch' || ctx === 'nh_poskey';
});

const isTextPrompt = computed(() => {
  if (!activePrompt.value) return false;
  const ctx = activePrompt.value.context;
  return ctx === 'text' || ctx === 'getlin' || ctx === 'askname' || ctx === 'name' || ctx === 'get_ext_cmd';
});

const isExtCmd = computed(() => {
  return activePrompt.value?.context === 'get_ext_cmd';
});

const isYNPrompt = computed(() => {
  if (!activePrompt.value || isTurnInput.value) return false;
  const ctx = activePrompt.value.context;
  const choices = activePrompt.value.choices;
  const prompt = activePrompt.value.prompt || '';

  if (prompt.toLowerCase().includes('direction')) return false;

  return (
    ctx === 'yn' ||
    ctx === 'yn_function' ||
    !!choices ||
    prompt.includes('[y/n]') ||
    prompt.includes('(y/n)') ||
    (prompt.includes('?') && !prompt.toLowerCase().includes('direction')) ||
    prompt.toLowerCase().includes('tutorial')
  );
});

watch(activePrompt, async (newVal) => {
  if (newVal && isTextPrompt.value) {
    inputText.value = '';
    await nextTick();
    inputRef.value?.focus();
  }
});

function respondDirect(val: any) {
  respondPrompt(val);
}

function sendChar(char: string) {
  respondDirect(char.charCodeAt(0));
}

function submitText() {
  const val = inputText.value ? inputText.value.trim() : (isExtCmd.value ? 'pray' : 'Hero');
  inputText.value = '';
  respondDirect(val);
}

function cancelText() {
  inputText.value = '';
  if (isExtCmd.value) {
    respondDirect(-1);
  } else {
    respondDirect('');
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (!activePrompt.value) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    if (isTextPrompt.value) {
      cancelText();
    } else {
      respondDirect(27);
    }
    return;
  }

  if (isYNPrompt.value && !isTurnInput.value) {
    const k = e.key.toLowerCase();
    if (k === 'y' || k === 'n' || k === 'q') {
      e.preventDefault();
      sendChar(k);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChar('y');
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      sendChar(e.key);
      return;
    }
  }

  if (isTextPrompt.value && document.activeElement === inputRef.value) {
    return;
  }

  // 方向入力プロンプト (e.g. "In what direction?") などのプロンプトキーボード入力ダイレクト受容
  if (!isTextPrompt.value && e.key.length === 1) {
    let charCode = 0;
    if (e.key === 'ArrowUp') charCode = 107; // 'k'
    else if (e.key === 'ArrowDown') charCode = 106; // 'j'
    else if (e.key === 'ArrowLeft') charCode = 104; // 'h'
    else if (e.key === 'ArrowRight') charCode = 108; // 'l'
    else charCode = e.key.charCodeAt(0);

    if (charCode > 0) {
      e.preventDefault();
      respondDirect(charCode);
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.prompt-wrapper {
  min-height: 48px;
  display: flex;
  align-items: center;
}

.prompt-container {
  width: 100%;
  background: #222831;
  border: 1px solid #00adb5;
  border-radius: 4px;
  padding: 8px 15px;
  display: flex;
  align-items: center;
  gap: 15px;
  color: #eeeeee;
  font-family: monospace;
  box-sizing: border-box;
}

.prompt-placeholder {
  width: 100%;
  padding: 8px 15px;
  color: #7f8c8d;
  font-family: monospace;
  font-size: 13px;
  border: 1px dashed #333;
  border-radius: 4px;
  box-sizing: border-box;
}

.prompt-badge {
  background: #00adb5;
  color: #222831;
  font-weight: bold;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.prompt-badge.turn-badge {
  background: #2ecc71;
  color: #111;
}

.pulse-icon {
  color: #ff2e63;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.prompt-text {
  flex-grow: 1;
  font-size: 14px;
}

.turn-hint {
  color: #7f8c8d;
  font-size: 12px;
}

.prompt-text-input {
  display: flex;
  gap: 8px;
}

.prompt-text-input input {
  background: #393e46;
  border: 1px solid #00adb5;
  color: #fff;
  padding: 6px 10px;
  border-radius: 4px;
  font-family: monospace;
  width: 220px;
}

.prompt-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.btn-primary { background: #00adb5; color: #111; }
.btn-secondary { background: #555; color: #fff; }
.btn-yes { background: #4ecca3; color: #111; }
.btn-no { background: #e74c3c; color: #fff; }
.btn-cancel { background: #7f8c8d; color: #fff; }
</style>
