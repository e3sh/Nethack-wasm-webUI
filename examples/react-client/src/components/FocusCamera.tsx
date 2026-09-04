import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useGameStore, VisualFxItem } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';
import { getTileMapping } from '../utils/tileMapping';

const canvasWidth = 672; // 21 cols * 32px
const canvasHeight = 288; // 9 rows * 32px
const zoomTileSize = 32;
const halfRangeX = 10;
const halfRangeY = 4;

export const FocusCamera: React.FC = () => {
  const zoomCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isZoomEnabled = useGameStore((state) => state.isZoomEnabled);
  const cursorPos = useGameStore((state) => state.cursorPos);
  const gklSituation = useGameStore((state) => state.gklSituation);
  const isPlayerDead = useGameStore((state) => state.isPlayerDead);
  const activeFxEvent = useGameStore((state) => state.activeFxEvent);
  const screenShakeEvent = useGameStore((state) => state.screenShakeEvent);

  const { getCore, inspectTileKnowledge, travelTo } = useNetHackDriver();

  const tileImgRef = useRef<HTMLImageElement | null>(null);
  const tileLoadedRef = useRef(false);
  const tileMapTableRef = useRef<Record<number, number>>({});
  const animFrameIdRef = useRef<number | null>(null);

  const activeFxListRef = useRef<VisualFxItem[]>([]);
  const shakeStateRef = useRef({ time: 0, duration: 0, intensity: 0 });

  const playerPos = useMemo(() => {
    const sit = gklSituation;
    const cur = cursorPos;
    const px = (sit?.area && typeof sit.area.playerX === 'number')
      ? sit.area.playerX
      : (sit?.area?.playerLocation?.x ?? (cur ? cur.x : 0));
    const py = (sit?.area && typeof sit.area.playerY === 'number')
      ? sit.area.playerY
      : (sit?.area?.playerLocation?.y ?? (cur ? cur.y : 0));
    return { x: px, y: py };
  }, [gklSituation, cursorPos]);

  // Visual FX 監視
  useEffect(() => {
    if (activeFxEvent) {
      activeFxListRef.current.push({
        type: activeFxEvent.type,
        followPlayer: activeFxEvent.followPlayer ?? (activeFxEvent.gx === undefined),
        gx: activeFxEvent.gx,
        gy: activeFxEvent.gy,
        startTime: activeFxEvent.triggerTime || performance.now(),
        durationMs: activeFxEvent.durationMs || (activeFxEvent.type === 'DEATH_BURST' ? 900 : 300),
      });
    }
  }, [activeFxEvent]);

  // Screen shake 監視
  useEffect(() => {
    if (screenShakeEvent) {
      shakeStateRef.current = {
        time: performance.now(),
        duration: screenShakeEvent.durationMs || 120,
        intensity: screenShakeEvent.intensity || 3,
      };
    }
  }, [screenShakeEvent]);

  const drawTile = useCallback((ctx: CanvasRenderingContext2D, glyphId: number, cols: number, dx: number, dy: number, animY = 0) => {
    const tileLoaded = tileLoadedRef.current;
    const tileImg = tileImgRef.current;
    const tileMapTable = tileMapTableRef.current;

    if (tileLoaded && tileImg) {
      const tileIndex = tileMapTable[glyphId] !== undefined ? tileMapTable[glyphId] : 0;
      const imgCols = Math.floor(tileImg.width / 32) || cols;
      const sx = (tileIndex % imgCols) * 32;
      const sy = Math.floor(tileIndex / imgCols) * 32;
      ctx.drawImage(tileImg, sx, sy, 32, 32, dx, dy + animY, 32, 32);
    } else {
      ctx.fillStyle = glyphId === 0 ? '#00e676' : '#ffd740';
      ctx.fillRect(dx + 4, dy + 4 + animY, 24, 24);
    }
  }, []);

  const renderVisualFx = useCallback((ctx: CanvasRenderingContext2D, px: number, py: number, now: number) => {
    if (activeFxListRef.current.length === 0) return;

    activeFxListRef.current = activeFxListRef.current.filter((fx) => {
      const elapsed = now - (fx.startTime || 0);
      const duration = fx.durationMs || 300;
      if (elapsed >= duration) return false;

      const progress = Math.min(1.0, elapsed / duration);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const targetGx = fx.followPlayer ? px : fx.gx;
      const targetGy = fx.followPlayer ? py : fx.gy;

      if (targetGx === undefined || targetGy === undefined) return true;

      const screenX = (targetGx - px + halfRangeX) * zoomTileSize;
      const screenY = (targetGy - py + halfRangeY) * zoomTileSize;

      if (screenX < -zoomTileSize || screenX > canvasWidth || screenY < -zoomTileSize || screenY > canvasHeight) {
        return true;
      }

      ctx.save();

      if (fx.type === 'SLASH') {
        // ⚔️ 斬撃エフェクト
        const alpha = 1 - progress;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd740';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        const startX = screenX + 4;
        const startY = screenY + 4;
        const endX = startX + (zoomTileSize - 8) * Math.min(1.0, progress * 2.5);
        const endY = startY + (zoomTileSize - 8) * Math.min(1.0, progress * 2.5);
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (progress > 0.2) {
          ctx.strokeStyle = `rgba(255, 215, 64, ${alpha * 0.8})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(screenX + zoomTileSize - 8, screenY + 8);
          ctx.lineTo(screenX + 8, screenY + zoomTileSize - 8);
          ctx.stroke();
        }
      } else if (fx.type === 'DAMAGE_FLASH') {
        // 💥 被弾赤フラッシュ
        const alpha = (1 - progress) * 0.6;
        ctx.fillStyle = `rgba(244, 67, 54, ${alpha})`;
        ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
        ctx.strokeStyle = `rgba(255, 23, 68, ${1 - progress})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, zoomTileSize, zoomTileSize);
      } else if (fx.type === 'KILL_BURST') {
        // 💀 撃破消滅バースト
        const alpha = 1 - progress;
        const radius = (zoomTileSize * 0.5) * (0.3 + easeOut * 0.7);
        const cx = screenX + zoomTileSize / 2;
        const cy = screenY + zoomTileSize / 2;

        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff9100';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(cx - radius, cy);
        ctx.lineTo(cx + radius, cy);
        ctx.moveTo(cx, cy - radius);
        ctx.lineTo(cx + radius, cy);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
        const d = radius * 0.7;
        const pSize = Math.max(1, 3 * (1 - progress));
        ctx.fillRect(cx - d, cy - d, pSize, pSize);
        ctx.fillRect(cx + d, cy - d, pSize, pSize);
        ctx.fillRect(cx - d, cy + d, pSize, pSize);
        ctx.fillRect(cx + d, cy + d, pSize, pSize);
      } else if (fx.type === 'HEAL_RING') {
        // 💚 回復リング
        const alpha = 1 - progress;
        const liftY = -easeOut * 12;
        const cx = screenX + zoomTileSize / 2;
        const cy = screenY + zoomTileSize / 2 + liftY;
        const r = 4 + easeOut * 10;

        ctx.strokeStyle = `rgba(0, 230, 118, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#69f0ae';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.type === 'DEATH_BURST') {
        // 🪦 死亡エフェクト
        const alpha = Math.max(0, 1 - progress);
        const radius = (zoomTileSize * 0.8) * (0.2 + easeOut * 1.2);
        const cx = screenX + zoomTileSize / 2;
        const cy = screenY + zoomTileSize / 2;

        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
        ctx.lineWidth = 3 * (1 - progress * 0.5);
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (progress < 0.7) {
          const crossProgress = 1 - (progress / 0.7);
          ctx.strokeStyle = `rgba(254, 202, 202, ${crossProgress})`;
          ctx.lineWidth = 2;
          const crossLen = (zoomTileSize * 0.35);
          ctx.beginPath();
          ctx.moveTo(cx - crossLen, cy - crossLen);
          ctx.lineTo(cx + crossLen, cy + crossLen);
          ctx.moveTo(cx + crossLen, cy - crossLen);
          ctx.lineTo(cx - crossLen, cy + crossLen);
          ctx.stroke();
        }
      }

      ctx.restore();
      return true;
    });
  }, []);

  const drawZoomCanvas = useCallback(() => {
    const canvas = zoomCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const store = useGameStore.getState();
    const sit = store.gklSituation;
    const area = sit?.area;
    const grid = area?.grid;
    const cur = store.cursorPos;
    const px = (sit?.area && typeof sit.area.playerX === 'number')
      ? sit.area.playerX
      : (sit?.area?.playerLocation?.x ?? (cur ? cur.x : 0));
    const py = (sit?.area && typeof sit.area.playerY === 'number')
      ? sit.area.playerY
      : (sit?.area?.playerLocation?.y ?? (cur ? cur.y : 0));
    const width = area?.width || 80;
    const height = area?.height || 21;

    const cols = 40;
    const now = performance.now();

    // 画面シェイクの計算
    let shakeX = 0;
    let shakeY = 0;
    const shake = shakeStateRef.current;
    if (shake.time > 0) {
      const elapsed = now - shake.time;
      if (elapsed < shake.duration) {
        const progress = 1 - (elapsed / shake.duration);
        const mag = shake.intensity * progress;
        shakeX = (Math.random() * 2 - 1) * mag;
        shakeY = (Math.random() * 2 - 1) * mag;
      } else {
        shake.time = 0;
      }
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = '#090916';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 自キャラのキビキビとした上方向バウンス (周期約0.5秒, 0〜-3px / 死亡時は静止)
    const isDead = store.isPlayerDead;
    const bounceY = isDead ? 0 : -Math.round(Math.abs(Math.sin(Date.now() / 160)) * 3);

    const core = getCore();
    const glyphGridBuffer = (core && core.driver && core.driver.getGlyphBuffer) ? core.driver.getGlyphBuffer() : null;

    for (let dy = -halfRangeY; dy <= halfRangeY; dy++) {
      for (let dx = -halfRangeX; dx <= halfRangeX; dx++) {
        const gx = px + dx;
        const gy = py + dy;

        const screenX = (dx + halfRangeX) * zoomTileSize;
        const screenY = (dy + halfRangeY) * zoomTileSize;

        if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
          const cell = (grid && grid[gy]) ? grid[gy][gx] : null;
          const gData = (glyphGridBuffer && glyphGridBuffer[gy] && glyphGridBuffer[gy][gx]) ? glyphGridBuffer[gy][gx] : null;

          const isPreloadOnly = cell && cell.bottom && cell.bottom.isCachedPreload && !cell.middle && !cell.top;
          const hasNetHackGlyph = gData && gData.glyph >= 0 && gData.ch !== ' ';
          const hasExploredMemory = cell && ((cell.bottom && !cell.bottom.isCachedPreload) || cell.middle || cell.top);
          const isCurrentPlayerFeet = (dx === 0 && dy === 0);
          const hasMemory = hasExploredMemory || hasNetHackGlyph || (isPreloadOnly && isCurrentPlayerFeet);

          if (!hasMemory && !hasNetHackGlyph) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
          } else {
            if (cell && (cell.bottom || cell.middle || cell.top)) {
              // Layer 1: Bottom (地形)
              if (cell.bottom && cell.bottom.rawGlyph >= 0 && (!cell.bottom.isCachedPreload || hasNetHackGlyph || isCurrentPlayerFeet)) {
                drawTile(ctx, cell.bottom.rawGlyph, cols, screenX, screenY, 0);
              } else if (cell.middle || cell.top) {
                drawTile(ctx, 3992, cols, screenX, screenY, 0); // 仮床
              } else if (gData && gData.glyph >= 0) {
                drawTile(ctx, gData.glyph, cols, screenX, screenY, 0);
              } else {
                ctx.fillStyle = '#121224';
                ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
              }

              // Layer 2: Middle (アイテム)
              if (cell.middle && cell.middle.rawGlyph >= 0) {
                drawTile(ctx, cell.middle.rawGlyph, cols, screenX, screenY, 0);
              }

              // 自キャラマスのネオン枠ハイライト
              if (dx === 0 && dy === 0) {
                if (isDead) {
                  ctx.strokeStyle = '#ef4444';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                } else {
                  ctx.strokeStyle = '#00e676';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                }
              }

              // Layer 3: Top (キャラクター/モンスター / 死亡時は墓石 glyph 4011)
              if (isDead && dx === 0 && dy === 0) {
                drawTile(ctx, 4011, cols, screenX, screenY, 0);
              } else if (cell.top && cell.top.rawGlyph >= 0) {
                drawTile(ctx, cell.top.rawGlyph, cols, screenX, screenY, bounceY);
              }

              // Layer 4: Effect (過渡的エフェクト)
              if (cell.effect && cell.effect.rawGlyph >= 0) {
                drawTile(ctx, cell.effect.rawGlyph, cols, screenX, screenY, 0);
              }
            } else if (gData && gData.glyph >= 0 && gData.ch !== ' ') {
              if (dx === 0 && dy === 0) {
                if (isDead) {
                  ctx.strokeStyle = '#ef4444';
                  ctx.lineWidth = 1;
                  ctx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                  drawTile(ctx, 4011, cols, screenX, screenY, 0);
                } else {
                  ctx.strokeStyle = '#00e676';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                  drawTile(ctx, gData.glyph, cols, screenX, screenY, 0);
                }
              } else {
                drawTile(ctx, gData.glyph, cols, screenX, screenY, 0);
              }
            } else {
              ctx.fillStyle = '#000000';
              ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
            }
          }
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
        }
      }
    }

    // Layer 5: Visual FX 最前面オーバーレイ描画
    renderVisualFx(ctx, px, py, now);

    ctx.restore();
  }, [drawTile, renderVisualFx, getCore]);

  // レンダリングループ初期化
  useEffect(() => {
    tileMapTableRef.current = getTileMapping();
    const img = new Image();
    img.src = './pict/nethack_default_32_tr.png';
    img.onload = () => {
      tileLoadedRef.current = true;
    };
    img.onerror = () => {
      img.src = './pict/nethack_default_32.png';
      img.onload = () => {
        tileLoadedRef.current = true;
      };
    };
    tileImgRef.current = img;

    const render = () => {
      if (useGameStore.getState().isZoomEnabled && zoomCanvasRef.current) {
        drawZoomCanvas();
      }
      animFrameIdRef.current = requestAnimationFrame(render);
    };
    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [drawZoomCanvas]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = zoomCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const dx = Math.floor(canvasX / zoomTileSize) - halfRangeX;
    const dy = Math.floor(canvasY / zoomTileSize) - halfRangeY;

    const targetGx = playerPos.x + dx;
    const targetGy = playerPos.y + dy;

    if (targetGx >= 0 && targetGx < 80 && targetGy >= 0 && targetGy < 21) {
      inspectTileKnowledge(targetGx, targetGy);
    } else {
      inspectTileKnowledge(-1, -1);
    }
  }, [playerPos, inspectTileKnowledge]);

  const handleMouseLeave = useCallback(() => {
    inspectTileKnowledge(-1, -1);
  }, [inspectTileKnowledge]);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = zoomCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const dx = Math.floor(canvasX / zoomTileSize) - halfRangeX;
    const dy = Math.floor(canvasY / zoomTileSize) - halfRangeY;

    const targetGx = playerPos.x + dx;
    const targetGy = playerPos.y + dy;

    if (targetGx >= 0 && targetGx < 80 && targetGy >= 0 && targetGy < 21) {
      // 1. オンデマンド Look 確定実行 (isHover: false)
      await inspectTileKnowledge(targetGx, targetGy, false);

      // 2. 移動実行
      await travelTo(targetGx, targetGy);
    }
  }, [playerPos, inspectTileKnowledge, travelTo]);

  if (!isZoomEnabled) return null;

  return (
    <div className="zoom-viewport-box">
      <div className="zoom-header">
        <span>🎯 FOCUS CAMERA</span>
        <span className="zoom-badge">@ ({playerPos.x},{playerPos.y})</span>
      </div>
      <canvas
        ref={zoomCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="zoom-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    </div>
  );
};
