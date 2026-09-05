<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentLanguageStore } from '../services/useNetHackDriver';

  export let value: string = 'ALL';
  export let actionCounts: Record<string, number> = {};

  const dispatch = createEventDispatcher<{ change: string }>();

  $: isEn = $currentLanguageStore === 'en';

  $: dirButtons = [
    { id: 'NW', label: '↖', title: isEn ? 'Northwest (7 / y / ↖)' : '北西 (7 / y / ↖)' },
    { id: 'N', label: '↑', title: isEn ? 'North (8 / k / ↑)' : '北 (8 / k / ↑)' },
    { id: 'NE', label: '↗', title: isEn ? 'Northeast (9 / u / ↗)' : '北東 (9 / u / ↗)' },
    { id: 'W', label: '←', title: isEn ? 'West (4 / h / ←)' : '西 (4 / h / ←)' },
    { id: 'SELF', label: isEn ? 'Feet' : '足元', title: isEn ? 'Feet / Self (5 / . / ·)' : '足元 (5 / . / ・)' },
    { id: 'E', label: '→', title: isEn ? 'East (6 / l / →)' : '東 (6 / l / →)' },
    { id: 'SW', label: '↙', title: isEn ? 'Southwest (1 / b / ↙)' : '南西 (1 / b / ↙)' },
    { id: 'S', label: '↓', title: isEn ? 'South (2 / j / ↓)' : '南 (2 / j / ↓)' },
    { id: 'SE', label: '↘', title: isEn ? 'Southeast (3 / n / ↘)' : '南東 (3 / n / ↘)' },
  ];

  $: filterLabel = (() => {
    if (value === 'ALL') return isEn ? 'All Directions' : '全て';
    if (value === 'SELF') return isEn ? 'Feet (Self)' : '足元';
    return value;
  })();

  const selectDir = (dir: string) => {
    dispatch('change', dir);
  };
</script>

<div class="gkl-dir-filter-container">
  <div class="gkl-dir-filter-bar">
    <span class="gkl-filter-label">{isEn ? 'Filter:' : '表示:'} {filterLabel}</span>
    <button
      class="gkl-dir-reset-btn {value === 'ALL' ? 'active' : ''}"
      title={isEn ? 'Reset filter (Show all)' : 'フィルター解除 (すべて表示)'}
      on:click={() => selectDir('ALL')}
    >
      {isEn ? 'Show All' : '全表示'}
    </button>
  </div>

  <div class="gkl-direction-pad">
    {#each dirButtons as btn}
      {@const count = (actionCounts && actionCounts[btn.id]) || 0}
      <button
        class="gkl-dir-btn {value === btn.id ? 'active' : ''} {count > 0 ? 'has-action' : ''}"
        title={btn.title}
        on:click={() => selectDir(btn.id)}
      >
        {btn.label}
        {#if count > 0}
          <span class="gkl-dir-badge">{count}</span>
        {/if}
      </button>
    {/each}
  </div>
</div>
