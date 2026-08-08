<script lang="ts">
  import { activePromptStore } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';

  let inputText = '';

  $: activePrompt = $activePromptStore;
  $: isLineText = activePrompt?.inputType === 'LINE_TEXT';
  $: isTurnInput = activePrompt?.inputType === 'DIRECTION';
  $: options = activePrompt?.options || [];

  function autoFocusAction(node: HTMLElement) {
    node.focus();
  }

  function respondPrompt(val: any) {
    driverController.respondPrompt(val);
  }

  function submitText() {
    const val = inputText.trim();
    inputText = '';
    respondPrompt(val);
  }

  function cancelText() {
    inputText = '';
    respondPrompt(27);
  }
</script>

<div class="prompt-wrapper">
  {#if activePrompt}
    <div class="prompt-container">
      <div class="prompt-badge" class:turn-badge={isTurnInput}>
        <span class="pulse-icon">●</span> {isTurnInput ? '[TURN WAITING]' : '[INPUT WAITING]'}
      </div>

      <div class="prompt-content">
        <div class="prompt-text">
          {activePrompt.promptText || activePrompt.prompt || ''}
          {#if activePrompt.choicesHint}
            <span class="choices-hint">({activePrompt.choicesHint})</span>
          {/if}
        </div>

        {#if isLineText}
          <div class="prompt-text-input">
            <input
              bind:value={inputText}
              on:keydown={(e) => {
                if (e.key === 'Enter') submitText();
                if (e.key === 'Escape') cancelText();
              }}
              type="text"
              placeholder="Input text (ESC to cancel)"
              use:autoFocusAction
            />
            <button on:click={submitText} class="btn btn-primary">Submit</button>
            <button on:click={cancelText} class="btn btn-secondary">Cancel</button>
          </div>
        {:else if options.length > 0}
          <div class="prompt-actions">
            {#each options as btn (btn.key)}
              <button on:click={() => respondPrompt(btn.key)} class="btn {btn.btnClass || 'btn-primary'}">
                {btn.label}
              </button>
            {/each}
          </div>
        {:else if isTurnInput}
          <div class="turn-hint">
            <span>Use Arrow keys / hjkl / numpad to move</span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="prompt-placeholder">
      <span class="idle-text">Ready / Turn Input Waiting</span>
    </div>
  {/if}
</div>

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
