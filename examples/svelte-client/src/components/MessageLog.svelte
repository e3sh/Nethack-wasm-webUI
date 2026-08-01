<script lang="ts">
  import { afterUpdate } from 'svelte';
  import { messagesStore } from '../stores/gameStore';

  let logContainer: HTMLDivElement;

  afterUpdate(() => {
    if (logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });
</script>

<div class="message-log" bind:this={logContainer}>
  {#each $messagesStore as msg, index (index)}
    <div class="log-line">{msg}</div>
  {/each}
</div>
