<template>
  <div class="game-canvas-container">
    <canvas
      ref="canvasRef"
      :width="canvasWidth"
      :height="canvasHeight"
      class="game-canvas"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @click="handleClick"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';
import { getTileMapping } from '../utils/tileMapping';
import { useNetHackDriver } from '../composables/useNetHackDriver';

const TILE_SIZE = 32; // スプライトタイルセルサイズ (32x32)
const COLS = 80;
const ROWS = 21;
const canvasWidth = COLS * TILE_SIZE;
const canvasHeight = ROWS * TILE_SIZE;

const canvasRef = ref<HTMLCanvasElement | null>(null);
const gameStore = useGameStore();
const { mapGrid, cursorPos } = storeToRefs(gameStore);
const { inspectTileKnowledge, travelTo, on: onDriverEvent, off: offDriverEvent } = useNetHackDriver();

let tileImage: HTMLImageElement | null = null;
let isTileLoaded = false;
let renderRequested = false;
let tileMapTable: Record<number, number> = {};
let lastCursorPos: { x: number; y: number } | null = null;

function requestRender() {
  if (renderRequested) return;
  renderRequested = true;
  requestAnimationFrame(() => {
    renderRequested = false;
    renderFullMap();
  });
}

function handleMouseMove(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;

  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  const gridX = Math.floor(canvasX / TILE_SIZE);
  const gridY = Math.floor(canvasY / TILE_SIZE);

  if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
    inspectTileKnowledge(gridX, gridY);
  } else {
    inspectTileKnowledge(-1, -1);
  }
}

async function handleClick(e: MouseEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvasWidth / rect.width;
  const scaleY = canvasHeight / rect.height;

  const canvasX = (e.clientX - rect.left) * scaleX;
  const canvasY = (e.clientY - rect.top) * scaleY;

  const gridX = Math.floor(canvasX / TILE_SIZE);
  const gridY = Math.floor(canvasY / TILE_SIZE);

  if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
    // 1. オンデマンド Look 確定実行 (isHover: false)
    await inspectTileKnowledge(gridX, gridY, false);

    // 2. 移動実行 (モンスターマスの場合は travelTo が自動安全抑止)
    await travelTo(gridX, gridY);
  }
}

function handleMouseLeave() {
  inspectTileKnowledge(-1, -1);
}

function drawSingleTile(x: number, y: number, tile: { tileId: number; symbol?: string; color?: number }) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  // 1. セル領域をブラッククリア
  ctx.fillStyle = '#050505';
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  const isBlank = (!tile.symbol || tile.symbol === ' ' || tile.symbol === '') && tile.tileId === 0;
  if (isBlank) return;

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
      ctx.fillStyle = getTTYColor(tile.color ?? 7);
      ctx.font = 'bold 22px "Courier New", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(charToDraw, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
    }
  }

  // カーソル枠線
  const cur = cursorPos.value;
  if (cur && cur.x === x && cur.y === y) {
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1.5, py + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
  }
}

const onPrintGlyph = (data: { x: number; y: number; glyph: number; ch: string; color: number }) => {
  drawSingleTile(data.x, data.y, { tileId: data.glyph, symbol: data.ch, color: data.color });
};

const onCursorMove = (cur: { x: number; y: number }) => {
  if (lastCursorPos && (lastCursorPos.x !== cur.x || lastCursorPos.y !== cur.y)) {
    const prev = lastCursorPos;
    const tile = mapGrid.value[prev.y]?.[prev.x];
    if (tile) drawSingleTile(prev.x, prev.y, tile);
  }
  lastCursorPos = { x: cur.x, y: cur.y };
  const curTile = mapGrid.value[cur.y]?.[cur.x];
  if (curTile) drawSingleTile(cur.x, cur.y, curTile);
};

const onMapCleared = () => {
  lastCursorPos = null;
  requestRender();
};

onMounted(() => {
  tileMapTable = getTileMapping();

  // 相対パス ./pict/nethack_default_32.png (Vite Relative Path / GitHub Pages 互換)
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

  onDriverEvent('print_glyph', onPrintGlyph);
  onDriverEvent('cursor', onCursorMove);
  onDriverEvent('map_cleared', onMapCleared);

  requestRender();
});

onUnmounted(() => {
  renderRequested = false;
  offDriverEvent('print_glyph', onPrintGlyph);
  offDriverEvent('cursor', onCursorMove);
  offDriverEvent('map_cleared', onMapCleared);
});

// ============================================================================
// [PATCH-WEBCORE] #002: マップ全消去 & ターゲットカーソル枠線描画規則
// 毎ターンの clear_nhwindow では全消去を行わず、print_glyph 差分更新を維持。
// DLEVEL 移動時の map_cleared のみ Canvas クリア。
// カーソル受診時、セル内側にゴールド枠線を描画。
// ============================================================================
function renderFullMap() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. 背景ブラッククリア
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const grid = mapGrid.value;

  // 2. マップタイル / TTY 文字描画
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = grid[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      const isBlank = (!tile.symbol || tile.symbol === ' ' || tile.symbol === '') && tile.tileId === 0;
      if (isBlank) {
        continue;
      }

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

  // 3. ターゲットカーソル描画 (セル内側 1px ゴールド枠線)
  if (cursorPos.value) {
    const cx = cursorPos.value.x * TILE_SIZE;
    const cy = cursorPos.value.y * TILE_SIZE;

    ctx.strokeStyle = '#f1c40f'; // 鮮やかなゴールド
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1.5, cy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
  }
}

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
</script>

<style scoped>
.game-canvas-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background-color: #000000;
  overflow: hidden;
}

.game-canvas {
  width: 100%;
  max-width: 1280px;
  height: auto;
  aspect-ratio: 80 / 21;
  image-rendering: pixelated;
  display: block;
}
</style>
