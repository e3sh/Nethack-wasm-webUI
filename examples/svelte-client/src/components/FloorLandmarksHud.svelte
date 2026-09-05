<script lang="ts">
  import { floorLandmarksStore, gklSituationStore } from '../stores/gameStore';
  import { currentLanguageStore } from '../services/useNetHackDriver';

  $: isEn = $currentLanguageStore === 'en';
  $: landmarks = $floorLandmarksStore || $gklSituationStore?.landmarks || null;
  $: summaryItems = landmarks?.summary || [];
  $: hasLandmarks = summaryItems.length > 0;
  $: floorTag = landmarks?.floorKey || 'Dlvl:1';
</script>

{#if hasLandmarks}
  <div class="floor-landmarks-hud">
    <span class="landmarks-floor-tag">🗺️ {floorTag}</span>
    <div class="landmarks-badges-container">
      {#each summaryItems as item}
        <span
          class="landmark-badge-item"
          title={isEn ? item.tooltipEn : item.tooltipJa}
        >
          {item.icon} {isEn ? item.nameEn : item.nameJa}
          {#if item.count > 1}
            <small class="landmark-count">x{item.count}</small>
          {/if}
        </span>
      {/each}
    </div>
  </div>
{/if}
