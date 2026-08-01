<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { activePromptStore } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';

  let textInputValue = '';
  let inputEl: HTMLInputElement;

  $: activePrompt = $activePromptStore;

  $: isTurnInput =
    activePrompt?.context === 'nhgetch' ||
    activePrompt?.context === 'poskey' ||
    activePrompt?.context === 'getch' ||
    activePrompt?.context === 'nh_poskey';

  $: isTextPrompt =
    activePrompt?.context === 'text' ||
    activePrompt?.context === 'getlin' ||
    activePrompt?.context === 'askname' ||
    activePrompt?.context === 'name' ||
    activePrompt?.context === 'get_ext_cmd';

  $: isExtCmd = activePrompt?.context === 'get_ext_cmd';

  $: isYNPrompt = (() => {
    if (!activePrompt || isTurnInput) return false;
    const ctx = activePrompt.context;
    const choices = activePrompt.choices;
    const prompt = activePrompt.prompt || '';

    return (
      ctx === 'yn' ||
      ctx === 'yn_function' ||
      !!choices ||
      prompt.includes('[y/n]') ||
      prompt.includes('(y/n)') ||
      prompt.includes('?') ||
      prompt.toLowerCase().includes('tutorial')
    );
  })();

  $: if (isTextPrompt && inputEl) {
    setTimeout(() => inputEl?.focus(), 50);
  }

  function respondDirect(val: any) {
    if (activePrompt) {
      driverController.respondPrompt(val);
    }
  }

  function sendChar(char: string) {
    respondDirect(char.charCodeAt(0));
  }

  function handleTextInputSubmit() {
    const val = textInputValue ? textInputValue.trim() : (isExtCmd ? 'pray' : 'Hero');
    textInputValue = '';
    respondDirect(val);
  }

  function handleTextInputCancel() {
    textInputValue = '';
    if (isExtCmd) {
      respondDirect(-1);
    } else {
      respondDirect('');
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!activePrompt) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (isTextPrompt) {
        handleTextInputCancel();
      } else {
        respondDirect(27);
      }
      return;
    }

    if (isYNPrompt && !isTurnInput) {
      const k = e.key.toLowerCase();
      if (k === 'y' || k === 'n' || k === 'q') {
        e.preventDefault();
        e.stopPropagation();
        sendChar(k);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        sendChar('y');
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        e.stopPropagation();
        sendChar(e.key);
        return;
      }
    }

    if (isTextPrompt && document.activeElement === inputEl) {
      return;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown, true);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown, true);
  });
</script>

<div class="prompt-wrapper">
  {#if activePrompt}
    <div class="prompt-container">
      <div class="prompt-badge" class:turn-badge={isTurnInput}>
        <span class="pulse-icon">●</span>
        <span>{isTurnInput ? 'YOUR TURN' : 'PROMPT'}</span>
      </div>

      <div class="prompt-text">
        {activePrompt.prompt}
        {#if isTurnInput}
          <span class="turn-hint">（hjkl / 矢印キーで移動, ?でヘルプ, #で拡張コマンド）</span>
        {/if}
      </div>

      {#if isTextPrompt}
        <div class="prompt-text-input">
          <input
            type="text"
            bind:this={inputEl}
            bind:value={textInputValue}
            on:keydown={(e) => {
              if (e.key === 'Enter') handleTextInputSubmit();
              if (e.key === 'Escape') handleTextInputCancel();
            }}
            placeholder={isExtCmd ? 'e.g. pray, dip, jump' : 'Input text (ESC to cancel)'}
          />
          <button class="btn btn-primary" on:click={handleTextInputSubmit}>Submit</button>
          <button class="btn btn-cancel" on:click={handleTextInputCancel}>Cancel (ESC)</button>
        </div>
      {:else if isYNPrompt && !isTurnInput}
        <div class="prompt-actions">
          <button class="btn btn-yes" on:click={() => sendChar('y')}>Yes (y)</button>
          <button class="btn btn-no" on:click={() => sendChar('n')}>No (n)</button>
          <button class="btn btn-cancel" on:click={() => sendChar('q')}>Quit/Cancel (ESC)</button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="prompt-placeholder">
      <span class="idle-text">Ready / Turn Input Waiting (Press arrow keys or hjkl)</span>
    </div>
  {/if}
</div>
