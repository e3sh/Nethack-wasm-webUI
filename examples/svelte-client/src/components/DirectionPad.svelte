<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentLanguageStore, driverController } from '../services/useNetHackDriver';

  export let value: string = 'ALL';
  export let actionCounts: Record<string, number> = {};

  const dispatch = createEventDispatcher<{ change: string }>();

  $: isEn = $currentLanguageStore === 'en';

  let longPressTimer: any = null;
  let startPos: { x: number; y: number } | null = null;
  let isLongPressTriggered = false;
  let lastTapTime = 0;
  let lastTapDir = '';

  const clearLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    startPos = null;
  };

  const handlePointerDown = (dirId: string, e: PointerEvent) => {
    clearLongPress();
    isLongPressTriggered = false;
    startPos = { x: e.clientX, y: e.clientY };

    longPressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      const defaultAct = driverController.getDefaultAction(dirId);
      if (defaultAct) {
        if (defaultAct.actionRecipe) {
          driverController.executeSequence(defaultAct.actionRecipe);
        } else if (defaultAct.keySequence) {
          driverController.executeSequence(defaultAct.keySequence);
        } else {
          driverController.executeAction(defaultAct);
        }
      }
    }, 450);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (startPos) {
      const dx = Math.abs(e.clientX - startPos.x);
      const dy = Math.abs(e.clientY - startPos.y);
      if (dx > 10 || dy > 10) {
        clearLongPress();
      }
    }
  };

  const handlePointerUp = (dirId: string) => {
    clearLongPress();
    if (isLongPressTriggered) {
      return;
    }

    const now = Date.now();
    if (now - lastTapTime < 300 && lastTapDir === dirId) {
      // 🏃 ダブルタップ成立: ダッシュ移動（走り）を即時実行
      lastTapTime = 0;
      lastTapDir = '';
      const dashAct = driverController.getDashAction(dirId);
      if (dashAct) {
        if (dashAct.actionRecipe) {
          driverController.executeSequence(dashAct.actionRecipe);
        } else if (dashAct.keySequence) {
          driverController.executeSequence(dashAct.keySequence);
        } else {
          driverController.executeAction(dashAct);
        }
        return;
      }
    }

    lastTapTime = now;
    lastTapDir = dirId;
    dispatch('change', dirId);
  };

  $: hint = isEn
    ? ' (Double-tap: Dash / Long press: 1-step)'
    : ' (ダブルタップ: ダッシュ / 長押し: 1歩移動・待機)';

  $: dirButtons = [
    { id: 'NW', label: '↖', title: (isEn ? 'Northwest (7 / y / ↖)' : '北西 (7 / y / ↖)') + hint },
    { id: 'N', label: '↑', title: (isEn ? 'North (8 / k / ↑)' : '北 (8 / k / ↑)') + hint },
    { id: 'NE', label: '↗', title: (isEn ? 'Northeast (9 / u / ↗)' : '北東 (9 / u / ↗)') + hint },
    { id: 'W', label: '←', title: (isEn ? 'West (4 / h / ←)' : '西 (4 / h / ←)') + hint },
    { id: 'SELF', label: isEn ? 'Feet' : '足元', title: (isEn ? 'Feet / Self (5 / . / ·)' : '足元 (5 / . / ・)') + hint },
    { id: 'E', label: '→', title: (isEn ? 'East (6 / l / →)' : '東 (6 / l / →)') + hint },
    { id: 'SW', label: '↙', title: (isEn ? 'Southwest (1 / b / ↙)' : '南西 (1 / b / ↙)') + hint },
    { id: 'S', label: '↓', title: (isEn ? 'South (2 / j / ↓)' : '南 (2 / j / ↓)') + hint },
    { id: 'SE', label: '↘', title: (isEn ? 'Southeast (3 / n / ↘)' : '南東 (3 / n / ↘)') + hint },
  ];

  $: filterLabel = (() => {
    if (value === 'ALL') return isEn ? 'All Directions' : '全て';
    if (value === 'SELF') return isEn ? 'Feet (Self)' : '足元';
    return value;
  })();
</script>

<div class="gkl-dir-filter-container">
  <div class="gkl-dir-filter-bar">
    <span class="gkl-filter-label">{isEn ? 'Filter:' : '表示:'} {filterLabel}</span>
    <button
      class="gkl-dir-reset-btn {value === 'ALL' ? 'active' : ''}"
      title={isEn ? 'Reset filter (Show all)' : 'フィルター解除 (すべて表示)'}
      on:click={() => dispatch('change', 'ALL')}
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
        on:pointerdown={(e) => handlePointerDown(btn.id, e)}
        on:pointermove={handlePointerMove}
        on:pointerup={() => handlePointerUp(btn.id)}
        on:pointercancel={clearLongPress}
        on:pointerleave={clearLongPress}
      >
        {btn.label}
        {#if count > 0}
          <span class="gkl-dir-badge">{count}</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

