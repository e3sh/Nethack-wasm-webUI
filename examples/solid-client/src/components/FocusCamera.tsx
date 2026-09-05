import { Component, createEffect, onMount, onCleanup, createMemo, Show } from 'solid-js';
import {
  isZoomEnabled,
  cursorPos,
  gklSituation,
  isPlayerDead,
  activeFxEvent,
  screenShakeEvent,
  VisualFxItem,
} from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';
import { getTileMapping } from '../utils/tileMapping';

const canvasWidth = 672; // 21 cols * 32px
const canvasHeight = 288; // 9 rows * 32px
const zoomTileSize = 32;
const halfRangeX = 10;
const halfRangeY = 4;

export const FocusCamera: Component = () => {
  let zoomCanvasRef: HTMLCanvasElement | undefined;

  let tileImg: HTMLImageElement | null = null;
  let tileLoaded = false;
  let tileMapTable: Record<number, number> = {};
  let animFrameId: number | null = null;

  const activeFxList: VisualFxItem[] = [];
  const shakeState = { time: 0, duration: 0, intensity: 0 };

  const playerPos = createMemo(() => {
    const sit = gklSituation();
    const cur = cursorPos();
    const px = (sit?.area && typeof sit.area.playerX === 'number')
      ? sit.area.playerX
      : (sit?.area?.playerLocation?.x ?? (cur ? cur.x : 0));
    const py = (sit?.area && typeof sit.area.playerY === 'number')
      ? sit.area.playerY
      : (sit?.area?.playerLocation?.y ?? (cur ? cur.y : 0));
    return { x: px, y: py };
  });

  // Visual FX 監視
  createEffect(() => {
    const fx = activeFxEvent();
    if (fx) {
      activeFxList.push({
        type: fx.type,
        followPlayer: fx.followPlayer ?? (fx.gx === undefined),
        gx: fx.gx,
        gy: fx.gy,
        startTime: fx.triggerTime || performance.now(),
        durationMs: fx.durationMs || (fx.type === 'DEATH_BURST' ? 900 : 300),
      });
    }
  });

  // Screen shake 監視
  createEffect(() => {
    const shake = screenShakeEvent();
    if (shake) {
      shakeState.time = performance.now();
      shakeState.duration = shake.durationMs || 120;
      shakeState.intensity = shake.intensity || 3;
    }
  });

  const drawTile = (ctx: CanvasRenderingContext2D, glyphId: number, cols: number, dx: number, dy: number, animY = 0) => {
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
  };

  const renderVisualFx = (ctx: CanvasRenderingContext2D, px: number, py: number, now: number) => {
    if (activeFxList.length === 0) return;

    for (let i = activeFxList.length - 1; i >= 0; i--) {
      const fx = activeFxList[i];
      const elapsed = now - (fx.startTime || 0);
      const duration = fx.durationMs || 300;
      if (elapsed >= duration) {
        activeFxList.splice(i, 1);
        continue;
      }

      const progress = Math.min(1.0, elapsed / duration);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const targetGx = fx.followPlayer ? px : fx.gx;
      const targetGy = fx.followPlayer ? py : fx.gy;

      if (targetGx === undefined || targetGy === undefined) continue;

      const screenX = (targetGx - px + halfRangeX) * zoomTileSize;
      const screenY = (targetGy - py + halfRangeY) * zoomTileSize;

      if (screenX < -zoomTileSize || screenX > canvasWidth || screenY < -zoomTileSize || screenY > canvasHeight) {
        continue;
      }

      ctx.save();

      if (fx.type === 'SLASH') {
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
        const alpha = (1 - progress) * 0.6;
        ctx.fillStyle = `rgba(244, 67, 54, ${alpha})`;
        ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
        ctx.strokeStyle = `rgba(255, 23, 68, ${1 - progress})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, zoomTileSize, zoomTileSize);
      } else if (fx.type === 'KILL_BURST') {
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
        ctx.lineTo(cx, cy + radius);
        ctx.stroke();
      } else if (fx.type === 'HEAL_RING') {
        const alpha = 1 - progress;
        const r = (zoomTileSize * 0.4) * (0.5 + progress * 0.8);
        const cx = screenX + zoomTileSize / 2;
        const cy = screenY + zoomTileSize / 2;

        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (fx.type === 'DEATH_BURST') {
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
    }
  };

  const drawZoomCanvas = () => {
    const canvas = zoomCanvasRef;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = playerPos();
    const px = pos.x;
    const py = pos.y;
    const cols = 40;
    const now = performance.now();

    // 画面シェイクの計算
    let shakeX = 0;
    let shakeY = 0;
    if (shakeState.time > 0) {
      const elapsed = now - shakeState.time;
      if (elapsed < shakeState.duration) {
        const progress = 1 - (elapsed / shakeState.duration);
        const mag = shakeState.intensity * progress;
        shakeX = (Math.random() * 2 - 1) * mag;
        shakeY = (Math.random() * 2 - 1) * mag;
      } else {
        shakeState.time = 0;
      }
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    ctx.fillStyle = '#090916';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const isDead = isPlayerDead();
    const bounceY = isDead ? 0 : -Math.round(Math.abs(Math.sin(Date.now() / 160)) * 3);

    const core = driverController.getCore();
    const tiles = (core && core.gkl && typeof core.gkl.getFocusCameraTiles === 'function')
      ? core.gkl.getFocusCameraTiles(halfRangeX, halfRangeY)
      : [];

    for (const t of tiles) {
      const screenX = (t.dx + halfRangeX) * zoomTileSize;
      const screenY = (t.dy + halfRangeY) * zoomTileSize;

      if (t.isUnexplored) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
        continue;
      }

      if (t.renderGlyphs && t.renderGlyphs.length > 0) {
        // Layer 1: Bottom (地形)
        if (t.bottomGlyph !== undefined && t.bottomGlyph >= 0) {
          drawTile(ctx, t.bottomGlyph, cols, screenX, screenY, 0);
        }

        // Layer 2: Middle (アイテム)
        if (t.middleGlyph !== undefined && t.middleGlyph >= 0) {
          drawTile(ctx, t.middleGlyph, cols, screenX, screenY, 0);
        }

        // 自キャラマスのネオン枠ハイライト
        if (t.isPlayer) {
          ctx.strokeStyle = isDead ? '#ef4444' : '#00e676';
          ctx.lineWidth = isDead ? 1 : 2;
          ctx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
        }

        // Layer 3: Top (キャラクター/モンスター / 死亡時墓石)
        if (t.topGlyph !== undefined && t.topGlyph >= 0) {
          const isBouncingMonster = Boolean(t.cell && t.cell.top && !isDead);
          drawTile(ctx, t.topGlyph, cols, screenX, screenY, isBouncingMonster ? bounceY : 0);
        }

        // Layer 4: Effect (過渡的エフェクト)
        if (t.effectGlyph !== undefined && t.effectGlyph >= 0) {
          drawTile(ctx, t.effectGlyph, cols, screenX, screenY, 0);
        }
      } else if (t.glyphId >= 0) {
        if (t.isPlayer) {
          ctx.strokeStyle = isDead ? '#ef4444' : '#00e676';
          ctx.lineWidth = isDead ? 1 : 2;
          ctx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
        }
        drawTile(ctx, t.glyphId, cols, screenX, screenY, 0);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
      }
    }

    // Layer 5: Visual FX 最前面オーバーレイ描画
    renderVisualFx(ctx, px, py, now);

    ctx.restore();
  };

  onMount(() => {
    tileMapTable = getTileMapping();
    tileImg = new Image();
    tileImg.src = './pict/nethack_default_32_tr.png';
    tileImg.onload = () => {
      tileLoaded = true;
    };
    tileImg.onerror = () => {
      if (tileImg) {
        tileImg.src = './pict/nethack_default_32.png';
        tileImg.onload = () => {
          tileLoaded = true;
        };
      }
    };

    const render = () => {
      if (isZoomEnabled() && zoomCanvasRef) {
        drawZoomCanvas();
      }
      animFrameId = requestAnimationFrame(render);
    };
    animFrameId = requestAnimationFrame(render);

    onCleanup(() => {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
    });
  });

  const handleMouseMove = (e: MouseEvent) => {
    const canvas = zoomCanvasRef;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const dx = Math.floor(canvasX / zoomTileSize) - halfRangeX;
    const dy = Math.floor(canvasY / zoomTileSize) - halfRangeY;

    const pos = playerPos();
    const targetGx = pos.x + dx;
    const targetGy = pos.y + dy;

    if (targetGx >= 0 && targetGx < 80 && targetGy >= 0 && targetGy < 21) {
      driverController.inspectTileKnowledge(targetGx, targetGy);
    } else {
      driverController.inspectTileKnowledge(-1, -1);
    }
  };

  const handleMouseLeave = () => {
    driverController.inspectTileKnowledge(-1, -1);
  };

  const handleClick = async (e: MouseEvent) => {
    const canvas = zoomCanvasRef;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const dx = Math.floor(canvasX / zoomTileSize) - halfRangeX;
    const dy = Math.floor(canvasY / zoomTileSize) - halfRangeY;

    const pos = playerPos();
    const targetGx = pos.x + dx;
    const targetGy = pos.y + dy;

    if (targetGx >= 0 && targetGx < 80 && targetGy >= 0 && targetGy < 21) {
      await driverController.travelTo(targetGx, targetGy);
    }
  };

  return (
    <Show when={isZoomEnabled()}>
      <div class="zoom-viewport-box">
        <div class="zoom-header">
          <span>🎯 FOCUS CAMERA</span>
          <span class="zoom-badge">@ ({playerPos().x},{playerPos().y})</span>
        </div>
        <canvas
          ref={zoomCanvasRef}
          width={canvasWidth}
          height={canvasHeight}
          class="zoom-canvas"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />
      </div>
    </Show>
  );
};
