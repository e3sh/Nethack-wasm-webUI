<template>
  <div class="prompt-wrapper">
    <div v-if="activePrompt" class="prompt-container">
      <div class="prompt-badge" :class="{ 'turn-badge': isTurnInput }">
        <span class="pulse-icon">●</span> {{ isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]' }}
      </div>

      <div class="prompt-content">
        <div class="prompt-text">
          {{ activePrompt.prompt }}
          <span v-if="activePrompt.choices && !isTurnInput" class="choices-hint">
            (Choices: {{ activePrompt.choices }})
          </span>
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

        <!-- 2. 動的選択ボタン群 (choices / yn / rl / 数値・文字選択肢) -->
        <div v-else-if="choiceButtons.length > 0 && !isTurnInput" class="prompt-actions">
          <button
            v-for="btn in choiceButtons"
            :key="btn.char"
            @click="sendChar(btn.char)"
            class="btn"
            :class="btn.btnClass"
          >
            {{ btn.label }}
          </button>
        </div>

        <!-- 3. 通常移動/ターン入力待ちの場合 -->
        <div v-else-if="isTurnInput" class="turn-hint">
          <span>Use Arrow keys / hjkl to move</span>
        </div>
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

// 行テキスト入力の優先判定（ASKNAME, GETLIN, TEXT 等）
const isTextPrompt = computed(() => {
  if (!activePrompt.value) return false;
  const ctx = (activePrompt.value.context || '').toLowerCase();
  const cat = ((activePrompt.value as any).category || '').toUpperCase();
  const prompt = (activePrompt.value.prompt || '').toLowerCase();

  return (
    cat === 'TEXT' ||
    cat === 'ASKNAME' ||
    ctx === 'text' ||
    ctx === 'getlin' ||
    ctx === 'askname' ||
    ctx === 'name' ||
    ctx === 'get_ext_cmd' ||
    prompt.includes('who are you') ||
    prompt.includes('your name') ||
    prompt.includes('what is your name')
  );
});

const isExtCmd = computed(() => {
  return activePrompt.value?.context === 'get_ext_cmd';
});

// choices やプロンプトテキストから動的選択ボタンを自動パース生成
const choiceButtons = computed(() => {
  if (!activePrompt.value || isTurnInput.value || isTextPrompt.value) return [];
  const rawChoices = activePrompt.value.choices || '';
  const prompt = (activePrompt.value.prompt || '').toLowerCase();

  let chars: string[] = [];

  if (rawChoices) {
    // 例: "rl", "ynq", "abc" のような1文字選択肢の展開
    if (!rawChoices.includes('-') && rawChoices.length <= 10) {
      chars = rawChoices.split('');
    }
  }

  // choices が存在しないが、質問文に [r/l] や [y/n] が含まれる場合の補完パース
  if (chars.length === 0) {
    if (prompt.includes('[r or l]') || prompt.includes('(r/l)') || prompt.includes('[r/l]')) {
      chars = ['r', 'l'];
    } else if (prompt.includes('[y/n]') || prompt.includes('(y/n)') || prompt.includes('[ynq]') || prompt.includes('[yn]')) {
      chars = ['y', 'n', 'q'];
    }
  }

  return chars.map((c) => {
    const lower = c.toLowerCase();
    let label = `${c}`;
    let btnClass = 'btn-secondary';

    if (lower === 'r') {
      label = 'Right (r)';
      btnClass = 'btn-primary';
    } else if (lower === 'l') {
      label = 'Left (l)';
      btnClass = 'btn-primary';
    } else if (lower === 'y') {
      label = 'Yes (y)';
      btnClass = 'btn-yes';
    } else if (lower === 'n') {
      label = 'No (n)';
      btnClass = 'btn-no';
    } else if (lower === 'q') {
      label = 'Quit/Cancel (q)';
      btnClass = 'btn-cancel';
    } else {
      label = `${c.toUpperCase()} (${c})`;
      btnClass = 'btn-primary';
    }

    return { char: c, label, btnClass };
  });
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

  if (isTextPrompt.value) {
    return;
  }

  // 動的ボタン選択肢キーの優先キャプチャ
  if (choiceButtons.value.length > 0) {
    const pressedKey = e.key.toLowerCase();
    const match = choiceButtons.value.find((b) => b.char.toLowerCase() === pressedKey);
    if (match) {
      e.preventDefault();
      sendChar(match.char);
      return;
    }
  }

  // 方向入力プロンプト等のダイレクト入力
  if (!isTextPrompt.value && e.key.length === 1) {
    let charCode = 0;
    if (e.key === 'ArrowUp') charCode = 107;
    else if (e.key === 'ArrowDown') charCode = 106;
    else if (e.key === 'ArrowLeft') charCode = 104;
    else if (e.key === 'ArrowRight') charCode = 108;
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
  white-space: nowrap;
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

.prompt-content {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.prompt-text {
  font-size: 14px;
}

.choices-hint {
  color: #f1c40f;
  font-weight: bold;
  margin-left: 8px;
  font-size: 13px;
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
  flex-wrap: wrap;
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
