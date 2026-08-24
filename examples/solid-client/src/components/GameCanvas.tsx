import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { mapGrid, mapRevision, cursorPos } from '../stores/gameStore';
import { getTileMapping } from '../utils/tileMapping';
import { driverController } from '../services/useNetHackDriver';

const TILE_SIZE = 32;
const COLS = 80;
const ROWS = 21;
const canvasWidth = COLS * TILE_SIZE;
const canvasHeight = ROWS * TILE_SIZE;

export const GameCanvas: Component = () => {
  let canvasRef: HTMLCanvasElement | undefined;
  let tileImage: HTMLImageElement | null = null;
  let isTileLoaded = false;
  let renderRequested = false;
  let tileMapTable: Record<number, number> = {};

  const requestRender = () => {
    if (renderRequested || !canvasRef) return;
    renderRequested = true;
    requestAnimationFrame(() => {
      renderRequested = false;
      renderFullMap();
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
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
  };

  const handleClick = (e: MouseEvent) => {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(canvasX / TILE_SIZE);
    const gridY = Math.floor(canvasY / TILE_SIZE);

    if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
      driverController.travelTo(gridX, gridY);
    }
  };

  const handleMouseLeave = () => {
    driverController.inspectTileKnowledge(-1, -1);
  };

  const getTTYColor = (colorIdx: number): string => {
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
  };

  const renderFullMap = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    // 1. 背景ブラッククリア
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const grid = mapGrid;

    // 2. マップ描画
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = grid[y]?.[x];
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
    const pos = cursorPos();
    if (pos) {
      const cx = pos.x * TILE_SIZE;
      const cy = pos.y * TILE_SIZE;

      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1.5, cy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
  };

  let lastCursorPos: { x: number; y: number } | null = null;

  const drawSingleTile = (x: number, y: number, tile: { tileId: number; symbol?: string; color?: number }) => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;

    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;

    // 1. セル領域ブラッククリア
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

    const cur = cursorPos();
    if (cur && cur.x === x && cur.y === y) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1.5, py + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
  };

  const onPrintGlyph = (data: { x: number; y: number; glyph: number; ch: string; color: number }) => {
    drawSingleTile(data.x, data.y, { tileId: data.glyph, symbol: data.ch, color: data.color });
  };

  const onCursorMove = (cur: { x: number; y: number }) => {
    if (lastCursorPos && (lastCursorPos.x !== cur.x || lastCursorPos.y !== cur.y)) {
      const prev = lastCursorPos;
      const prevTile = mapGrid[prev.y]?.[prev.x];
      if (prevTile) drawSingleTile(prev.x, prev.y, prevTile);
    }
    lastCursorPos = { x: cur.x, y: cur.y };
    const curTile = mapGrid[cur.y]?.[cur.x];
    if (curTile) drawSingleTile(cur.x, cur.y, curTile);
  };

  const onMapCleared = () => {
    lastCursorPos = null;
    requestRender();
  };

  onMount(() => {
    tileMapTable = getTileMapping();

    tileImage = new Image();
    tileImage.src = './pict/nethack_default_32.png';
    tileImage.onload = () => {
      isTileLoaded = true;
      renderFullMap();
    };
    tileImage.onerror = () => {
      isTileLoaded = false;
      renderFullMap();
    };

    driverController.on('print_glyph', onPrintGlyph);
    driverController.on('cursor', onCursorMove);
    driverController.on('map_cleared', onMapCleared);

    renderFullMap();
  });

  onCleanup(() => {
    renderRequested = false;
    driverController.off('print_glyph', onPrintGlyph);
    driverController.off('cursor', onCursorMove);
    driverController.off('map_cleared', onMapCleared);
  });

  return (
    <div class="game-canvas-container">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        class="game-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    </div>
  );
};
