<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mapGridStore, cursorPosStore } from '../stores/gameStore';
  import { getTileMapping } from '../utils/tileMapping';
  import { driverController } from '../services/useNetHackDriver';

  const TILE_SIZE = 32;
  const COLS = 80;
  const ROWS = 21;
  const canvasWidth = COLS * TILE_SIZE;
  const canvasHeight = ROWS * TILE_SIZE;

  let canvasRef: HTMLCanvasElement | null = null;
  let tileImage: HTMLImageElement | null = null;
  let isTileLoaded = false;
  let animFrameId: number | null = null;
  let tileMapTable: Record<number, number> = {};

  $: mapGrid = $mapGridStore;
  $: cursorPos = $cursorPosStore;

  function getTTYColor(colorIdx: number): string {
    const colors: Record<number, string> = {
      0: '#000000',
      1: '#ff4d4d',
      2: '#4ecca3',
      3: '#f39c12',
      4: '#3498db',
      5: '#9b59b6',
      6: '#00adb5',
      7: '#e0e0e0',
      8: '#7f8c8d',
      9: '#ff6b6b',
      10: '#2ecc71',
      11: '#f1c40f',
      12: '#54a0ff',
      13: '#ff7979',
      14: '#00d2d3',
      15: '#ffffff',
    };
    return colors[colorIdx] || '#ffffff';
  }

  function renderFullMap() {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    // 1. 背景ブラッククリア
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. マップタイル描画
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = mapGrid[y]?.[x];
        if (!tile) continue;

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        const isBlank = (!tile.symbol || tile.symbol === ' ' || tile.symbol === '') && tile.tileId === 0;
        if (isBlank) continue;

        let renderedSprite = false;

        if (isTileLoaded && tileImage && tile.tileId > 0 && tileMapTable) {
          const tileIdx = tileMapTable[tile.tileId];
          if (tileIdx !== undefined && tileIdx >= 0) {
            const tilesPerRow = 40;
            const origTileSize = 32;
            const sx = (tileIdx % tilesPerRow) * origTileSize;
            const sy = Math.floor(tileIdx / tilesPerRow) * origTileSize;

            if (sy < tileImage.height) {
              ctx.drawImage(
                tileImage,
                sx,
                sy,
                origTileSize,
                origTileSize,
                px,
                py,
                TILE_SIZE,
                TILE_SIZE
              );
              renderedSprite = true;
            }
          }
        }

        if (!renderedSprite) {
          const charToDraw = tile.symbol && tile.symbol !== '' ? tile.symbol : ' ';
          if (charToDraw !== ' ') {
            ctx.fillStyle = getTTYColor(tile.color);
            ctx.font = 'bold 22px "Courier New", Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(charToDraw, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
          }
        }
      }
    }

    // 3. ターゲットカーソル枠線描画 (ゴールド枠線)
    if (cursorPos) {
      const cx = cursorPos.x * TILE_SIZE;
      const cy = cursorPos.y * TILE_SIZE;

      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1.5, cy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
  }

  let renderRequested = false;

  function requestRender() {
    if (renderRequested || !canvasRef) return;
    renderRequested = true;
    requestAnimationFrame(() => {
      renderRequested = false;
      renderFullMap();
    });
  }

  $: if (canvasRef && (mapGrid || cursorPos || isTileLoaded)) {
    requestRender();
  }

  onMount(() => {
    tileMapTable = getTileMapping();

    tileImage = new Image();
    tileImage.src = './pict/nethack_default_32.png';
    tileImage.onload = () => {
      isTileLoaded = true;
      requestRender();
    };
    tileImage.onerror = () => {
      isTileLoaded = false;
      requestRender();
    };

    requestRender();
  });

  onDestroy(() => {
    renderRequested = false;
  });

  function handleMouseMove(e: MouseEvent) {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(canvasX / TILE_SIZE);
    const gridY = Math.floor(canvasY / TILE_SIZE);

    if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
      driverController.inspectTileKnowledge(gridX, gridY);
    } else {
      driverController.inspectTileKnowledge(-1, -1);
    }
  }

  function handleMouseLeave() {
    driverController.inspectTileKnowledge(-1, -1);
  }

  onDestroy(() => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
    }
  });
</script>

<div class="game-canvas-container">
  <canvas
    bind:this={canvasRef}
    width={canvasWidth}
    height={canvasHeight}
    class="game-canvas"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
  ></canvas>
</div>

<style scoped>
.game-canvas-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #050505;
  border: 2px solid #00adb5;
  border-radius: 6px;
  overflow: auto;
  padding: 6px;
  box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.9);
}

.game-canvas {
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
}
</style>
