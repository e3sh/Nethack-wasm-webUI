<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { activeMenuStore, type MenuItem } from '../stores/gameStore';
  import { driverController } from '../services/useNetHackDriver';
  import { getTileMapping } from '../utils/tileMapping';

  let selectedIndices: number[] = [];
  let isSubmitting = false;
  let tileMapTable: Record<number, number> = {};

  $: menu = $activeMenuStore;

  $: if (menu) {
    selectedIndices = [];
    isSubmitting = false;
    tileMapTable = getTileMapping();
  }

  function getAccChar(item: MenuItem): string {
    if (item.isHeader) return '';
    const ch = item.accelerator || item.ch;
    if (typeof ch === 'string' && ch !== '\x00') return ch;
    if (typeof ch === 'number' && ch > 0) return String.fromCharCode(ch);
    return '';
  }

  function getTileStyle(item: MenuItem): string {
    if (item.isHeader) return '';
    const glyph = item.glyph !== undefined ? item.glyph : (item.glyphInfo?.glyph ?? -1);
    if (glyph < 0 || !tileMapTable) return '';

    const tileIdx = tileMapTable[glyph];
    if (tileIdx === undefined || tileIdx < 0) return '';

    const tilesPerRow = 40;
    const origTileSize = 32;
    const tx = (tileIdx % tilesPerRow) * origTileSize;
    const ty = Math.floor(tileIdx / tilesPerRow) * origTileSize;

    const posX = -(tx / 2);
    const posY = -(ty / 2);

    return `background-image: url(./pict/nethack_default_32.png); background-position: ${posX}px ${posY}px; background-size: 640px auto; width: 16px; height: 16px; min-width: 16px; min-height: 16px; flex-shrink: 0; display: inline-block; image-rendering: pixelated; margin-right: 6px; background-repeat: no-repeat; vertical-align: middle;`;
  }

  function safeRespondMenu(val: any) {
    if (isSubmitting) return;
    isSubmitting = true;
    driverController.respondMenu(val);
  }

  function handleItemClick(idx: number, item: MenuItem) {
    if (item.isHeader || isSubmitting) return;
    const how = menu?.how ?? 1;

    if (how === 0) {
      safeRespondMenu(0);
      return;
    }

    if (how === 1) {
      safeRespondMenu([item]);
      return;
    }

    if (selectedIndices.includes(idx)) {
      selectedIndices = selectedIndices.filter((i) => i !== idx);
    } else {
      selectedIndices = [...selectedIndices, idx];
    }
  }

  function confirmSelection() {
    if (!menu || isSubmitting) return;

    if (menu.how === 0) {
      safeRespondMenu(0);
      return;
    }

    if (selectedIndices.length > 0) {
      const selectedItems = selectedIndices.map((idx) => menu.items[idx]);
      safeRespondMenu(selectedItems);
    } else {
      const validItem = menu.items.find(
        (it: MenuItem) => !it.isHeader && it.identifier !== undefined && it.identifier !== 0
      );
      safeRespondMenu(validItem ? [validItem] : 0);
    }
  }

  function cancelMenu() {
    if (isSubmitting) return;
    safeRespondMenu(0);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!menu || isSubmitting) return;

    if (e.key === 'Escape' || e.key === ' ' || (menu.how === 0 && e.key === 'Enter')) {
      e.preventDefault();
      e.stopPropagation();
      cancelMenu();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      confirmSelection();
      return;
    }

    if (e.key.length === 1 && menu.how !== 0) {
      const pressedKey = e.key;
      const matchItem = menu.items.find((it: MenuItem) => {
        if (it.isHeader) return false;
        const c = getAccChar(it);
        return c === pressedKey;
      });

      if (matchItem) {
        e.preventDefault();
        e.stopPropagation();
        safeRespondMenu([matchItem]);
      }
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown, true);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown, true);
  });
</script>

{#if menu}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click|self={cancelMenu}>
    <div class="modal-content">
      <h3 class="modal-title">{menu.prompt || 'Select Item'}</h3>

      <div class="menu-list">
        {#each menu.items as item, idx (idx)}
          {@const accChar = getAccChar(item)}
          {@const tileStyle = getTileStyle(item)}
          {@const isSelected = selectedIndices.includes(idx)}

          {#if item.isHeader || item.identifier === 0 || item.identifier === undefined}
            <div class="menu-item-row menu-header">
              {item.str}
            </div>
          {:else}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
              class="menu-item-row"
              class:selected={isSelected}
              on:click={() => handleItemClick(idx, item)}
            >
              {#if accChar}
                <span class="item-acc">{accChar})</span>
              {/if}
              {#if tileStyle}
                <span class="item-tile" style={tileStyle}></span>
              {/if}
              <span class="item-str">{item.str}</span>
            </div>
          {/if}
        {/each}
      </div>

      <div class="modal-footer">
        {#if menu.how === 0}
          <button class="btn btn-primary" on:click={cancelMenu}>
            OK (Enter / Space / ESC)
          </button>
        {:else}
          <button class="btn btn-primary" on:click={confirmSelection}>
            OK (Enter)
          </button>
          <button class="btn btn-secondary" on:click={cancelMenu}>
            Cancel (ESC)
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
