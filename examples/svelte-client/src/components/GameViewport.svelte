<script lang="ts">
  import { viewModeStore, mapGridStore, cursorPosStore } from '../stores/gameStore';
  import GameCanvas from './GameCanvas.svelte';
  import FocusCamera from './FocusCamera.svelte';
  import FloorLandmarksHud from './FloorLandmarksHud.svelte';

  const asciiColors = [
    '#000000', '#b21818', '#18b218', '#b26818',
    '#1818b2', '#b218b2', '#18b2b2', '#b2b2b2',
    '#686868', '#ff5454', '#54ff54', '#ffff54',
    '#5454ff', '#ff54ff', '#54ffff', '#ffffff'
  ];

  function getAsciiColor(colorNum: number = 7): string {
    return asciiColors[colorNum] || '#ffffff';
  }
</script>

<section class="game-viewport">
  <!-- メイン 80x21 描画 Canvas -->
  <div class="game-viewport-graphic" style="display: {$viewModeStore === 'GRAPHIC' ? 'block' : 'none'}; width: 100%;">
    <GameCanvas />
  </div>

  <!-- ASCII Grid (ビュー切替時) -->
  {#if $viewModeStore === 'ASCII'}
    <div class="ascii-grid">
      {#each $mapGridStore as row, y}
        <div class="ascii-row">
          {#each row as tile, x}
            <span
              class="ascii-cell {$cursorPosStore && $cursorPosStore.x === x && $cursorPosStore.y === y ? 'cursor-focus' : ''}"
              style="color: {getAsciiColor(tile.color)};"
            >
              {tile.symbol || ' '}
            </span>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <!-- 🎯 自キャラ周辺 拡大ズームカメラ窓 (オーバーレイ中央固定) -->
  <FocusCamera />

  <!-- 🧭 フロア設備案内フローティング HUD (Landmarks Bar) -->
  <FloorLandmarksHud />
</section>
