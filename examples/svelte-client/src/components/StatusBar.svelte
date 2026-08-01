<script lang="ts">
  import { statusStore } from '../stores/gameStore';
</script>

<div class="status-bar">
  <div class="status-main">
    <span class="title">{$statusStore.title || 'NetHack Hero'}</span>
    <span class="dlvl">{$statusStore.dlvl || 'Dlvl:1'}</span>
    <span class="hp">HP: {$statusStore.hp}/{$statusStore.hpMax}</span>
    <span class="pw">Pw: {$statusStore.pw}/{$statusStore.pwMax}</span>
    <span class="ac">AC: {$statusStore.ac}</span>
    <span class="gold">$: {$statusStore.gold}</span>
  </div>

  <div class="status-badges">
    {#if $statusStore.hunger}
      <span class="badge hunger-badge">{$statusStore.hunger}</span>
    {/if}

    {#each $statusStore.condition as cond}
      <span class="badge cond-badge">{cond}</span>
    {/each}
  </div>
</div>
