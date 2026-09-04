import React, { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getTileMapping } from '../utils/tileMapping';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

const TILE_SIZE = 32;
const COLS = 80;
const ROWS = 21;
const canvasWidth = COLS * TILE_SIZE;
const canvasHeight = ROWS * TILE_SIZE;

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { inspectTileKnowledge, travelTo, on, off } = useNetHackDriver();

  const tileImageRef = useRef<HTMLImageElement | null>(null);
  const isTileLoadedRef = useRef(false);
  const tileMapTableRef = useRef<Record<number, number>>({});
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  const getTTYColor = useCallback((colorIdx: number): string => {
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
  }, []);

  const drawSingleTile = useCallback((x: number, y: number, tile: { tileId: number; symbol?: string; color?: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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

    if (isTileLoadedRef.current && tileImageRef.current && tile.tileId > 0 && tileMapTableRef.current) {
      const tileIdx = tileMapTableRef.current[tile.tileId];
      if (tileIdx !== undefined && tileIdx >= 0) {
        const tilesPerRow = 40;
        const origTileSize = 32;
        const sx = (tileIdx % tilesPerRow) * origTileSize;
        const sy = Math.floor(tileIdx / tilesPerRow) * origTileSize;

        if (sy < tileImageRef.current.height) {
          ctx.drawImage(
            tileImageRef.current,
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

    const cur = useGameStore.getState().cursorPos;
    if (cur && cur.x === x && cur.y === y) {
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1.5, py + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
  }, [getTTYColor]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
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
  }, [inspectTileKnowledge]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const gridX = Math.floor(canvasX / TILE_SIZE);
    const gridY = Math.floor(canvasY / TILE_SIZE);

    if (gridX >= 0 && gridX < COLS && gridY >= 0 && gridY < ROWS) {
      travelTo(gridX, gridY);
    }
  }, [travelTo]);

  const handleMouseLeave = useCallback(() => {
    inspectTileKnowledge(-1, -1);
  }, [inspectTileKnowledge]);

  const renderFullMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. 背景ブラッククリア
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. マップ描画
    const curGrid = useGameStore.getState().mapGrid;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = curGrid[y]?.[x];
        if (!tile) continue;

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        const isBlank = (!tile.symbol || tile.symbol === ' ' || tile.symbol === '') && tile.tileId === 0;
        if (isBlank) continue;

        let renderedSprite = false;

        if (isTileLoadedRef.current && tileImageRef.current && tile.tileId > 0 && tileMapTableRef.current) {
          const tileIdx = tileMapTableRef.current[tile.tileId];
          if (tileIdx !== undefined && tileIdx >= 0) {
            const tilesPerRow = 40;
            const origTileSize = 32;
            const sx = (tileIdx % tilesPerRow) * origTileSize;
            const sy = Math.floor(tileIdx / tilesPerRow) * origTileSize;

            if (sy < tileImageRef.current.height) {
              ctx.drawImage(
                tileImageRef.current,
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
    const cur = useGameStore.getState().cursorPos;
    if (cur) {
      const cx = cur.x * TILE_SIZE;
      const cy = cur.y * TILE_SIZE;

      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1.5, cy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
  }, [getTTYColor]);

  useEffect(() => {
    tileMapTableRef.current = getTileMapping();

    const img = new Image();
    img.src = './pict/nethack_default_32.png';
    img.onload = () => {
      isTileLoadedRef.current = true;
      renderFullMap();
    };
    img.onerror = () => {
      isTileLoadedRef.current = false;
      renderFullMap();
    };
    tileImageRef.current = img;

    const handleGlyph = (data: { x: number; y: number; glyph: number; ch: string; color: number }) => {
      drawSingleTile(data.x, data.y, { tileId: data.glyph, symbol: data.ch, color: data.color });
    };

    const handleCursor = (cur: { x: number; y: number }) => {
      if (lastCursorRef.current && (lastCursorRef.current.x !== cur.x || lastCursorRef.current.y !== cur.y)) {
        const prev = lastCursorRef.current;
        const prevTile = useGameStore.getState().mapGrid[prev.y]?.[prev.x];
        if (prevTile) drawSingleTile(prev.x, prev.y, prevTile);
      }
      lastCursorRef.current = { x: cur.x, y: cur.y };
      const curTile = useGameStore.getState().mapGrid[cur.y]?.[cur.x];
      if (curTile) drawSingleTile(cur.x, cur.y, curTile);
    };

    const handleMapCleared = () => {
      lastCursorRef.current = null;
      renderFullMap();
    };

    on('print_glyph', handleGlyph);
    on('cursor', handleCursor);
    on('map_cleared', handleMapCleared);

    renderFullMap();

    return () => {
      off('print_glyph', handleGlyph);
      off('cursor', handleCursor);
      off('map_cleared', handleMapCleared);
    };
  }, [on, off, renderFullMap, drawSingleTile]);

  return (
    <div className="game-canvas-container">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="game-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    </div>
  );
};
