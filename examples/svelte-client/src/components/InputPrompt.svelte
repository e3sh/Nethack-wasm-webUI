<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { activePromptStore } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';

  let inputText = '';
  let inputRef: HTMLInputElement | null = null;

  $: activePrompt = $activePromptStore;

  $: isTurnInput = (() => {
    if (!activePrompt) return false;
    const ctx = activePrompt.context;
    return ctx === 'nhgetch' || ctx === 'poskey' || ctx === 'getch' || ctx === 'nh_poskey';
  })();

  $: isTextPrompt = (() => {
    if (!activePrompt) return false;
    const ctx = (activePrompt.context || '').toLowerCase();
    const cat = (((activePrompt as any).category) || '').toUpperCase();
    const prompt = (activePrompt.prompt || '').toLowerCase();

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
  })();

  $: isExtCmd = activePrompt?.context === 'get_ext_cmd';

  $: choiceButtons = (() => {
    if (!activePrompt || isTurnInput || isTextPrompt) return [];
    const rawChoices = activePrompt.choices || '';
    const prompt = (activePrompt.prompt || '').toLowerCase();

    let chars: string[] = [];

    if (rawChoices) {
      if (!rawChoices.includes('-') && rawChoices.length <= 10) {
        chars = rawChoices.split('');
      }
    }

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
  })();

  $: if (activePrompt && isTextPrompt) {
    inputText = '';
    tick().then(() => inputRef?.focus());
  }

  function respondDirect(val: any) {
    driverController.respondPrompt(val);
  }

  function sendChar(char: string) {
    respondDirect(char.charCodeAt(0));
  }

  function submitText() {
    const val = inputText.trim() ? inputText.trim() : (isExtCmd ? 'pray' : 'Hero');
    inputText = '';
    respondDirect(val);
  }

  function cancelText() {
    inputText = '';
    respondDirect(isExtCmd ? -1 : '');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!activePrompt) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (isTextPrompt) {
        cancelText();
      } else {
        respondDirect(27);
      }
      return;
    }

    if (isTextPrompt) return;

    if (choiceButtons.length > 0) {
      const pressedKey = e.key.toLowerCase();
      const match = choiceButtons.find((b) => b.char.toLowerCase() === pressedKey);
      if (match) {
        e.preventDefault();
        sendChar(match.char);
        return;
      }
    }

    if (!isTextPrompt && e.key.length === 1) {
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

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="prompt-wrapper">
  {#if activePrompt}
    <div class="prompt-container">
      <div class="prompt-badge" class:turn-badge={isTurnInput}>
        <span class="pulse-icon">●</span>
        {isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]'}
      </div>

      <div class="prompt-content">
        <div class="prompt-text">
          {activePrompt.prompt}
          {#if activePrompt.choices && !isTurnInput}
            <span class="choices-hint">(Choices: {activePrompt.choices})</span>
          {/if}
        </div>

        {#if isTextPrompt}
          <div class="prompt-text-input">
            <input
              bind:value={inputText}
              on:keydown={(e) => {
                if (e.key === 'Enter') submitText();
                if (e.key === 'Escape') cancelText();
              }}
              type="text"
              placeholder={isExtCmd ? 'e.g. pray, dip, jump' : 'Input text (ESC to cancel)'}
              bind:this={inputRef}
              autofocus
            />
            <button on:click={submitText} class="btn btn-primary">Submit</button>
            <button on:click={cancelText} class="btn btn-secondary">Cancel (ESC)</button>
          </div>
        {:else if choiceButtons.length > 0 && !isTurnInput}
          <div class="prompt-actions">
            {#each choiceButtons as btn (btn.char)}
              <button on:click={() => sendChar(btn.char)} class="btn {btn.btnClass}">
                {btn.label}
              </button>
            {/each}
          </div>
        {:else if isTurnInput}
          <div class="turn-hint">
            <span>Use Arrow keys / hjkl to move</span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="prompt-placeholder">
      <span class="idle-text">Ready / Turn Input Waiting (Press arrow keys or hjkl)</span>
    </div>
  {/if}
</div>

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
