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
  const mapGrid = useGameStore((state) => state.mapGrid);
  const cursorPos = useGameStore((state) => state.cursorPos);
  const { inspectTileKnowledge } = useNetHackDriver();

  const tileImageRef = useRef<HTMLImageElement | null>(null);
  const isTileLoadedRef = useRef(false);
  const tileMapTableRef = useRef<Record<number, number>>({});

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

  const handleMouseLeave = useCallback(() => {
    inspectTileKnowledge(-1, -1);
  }, [inspectTileKnowledge]);

  const renderFullMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    // 1. 背景ブラッククリア
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 2. マップ描画
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const tile = mapGrid[y]?.[x];
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
    if (cursorPos) {
      const cx = cursorPos.x * TILE_SIZE;
      const cy = cursorPos.y * TILE_SIZE;

      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx + 1.5, cy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
  }, [mapGrid, cursorPos]);

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
  }, [renderFullMap]);

  useEffect(() => {
    renderFullMap();
  }, [renderFullMap]);

  return (
    <div className="game-canvas-container">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="game-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};
