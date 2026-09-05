<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { activeTextModalStore } from '../stores/gameStore';
  import { trapFocus } from '@core/input/focusTrap.js';

  let modalCardRef: HTMLDivElement | null = null;

  $: modal = $activeTextModalStore;

  function handleClose() {
    if (modal && modal.resolver) {
      const res = modal.resolver;
      activeTextModalStore.set(null);
      res.respond(0);
    } else {
      activeTextModalStore.set(null);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!modal) return;

    if (modalCardRef && trapFocus(modalCardRef, e)) {
      return;
    }

    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown, true);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown, true);
  });
</script>

{#if modal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click|self={handleClose}>
    <div class="modal-content" bind:this={modalCardRef}>
      <h3 class="modal-title">{modal.title || 'Information'}</h3>

      <div class="text-body">
        {#each modal.lines as line, index (index)}
          <div class="text-line">{line}</div>
        {/each}
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" on:click={handleClose}>
          OK (Space / Enter / ESC)
        </button>
      </div>
    </div>
  </div>
{/if}
