/**
 * hd2dFxOverlay.js - WebGPU HD2D ジオラマ用 2D Canvas オーバーレイ描画マネージャー
 *
 * 斬撃、ダメージ被弾、撃破バースト、回復リング、死亡エフェクト等のビジュアルFX、
 * ターゲットカーソル枠、エンティティ（Pet/Ridden/PileTop）ハイライト、環境浮遊パーティクル、
 * 画面振動 (Screen Shake) を担当します。
 */

export class HD2DFxOverlay {
  constructor({
    canvas,
    worldToScreen,
    getSituation,
    getAreaGrid,
    wakeUp,
    getPlayerPos,
    getTargetCursor,
    getZoom
  }) {
    this.canvas = canvas;
    this.worldToScreen = worldToScreen || (() => null);
    this.getSituation = getSituation || (() => null);
    this.getAreaGrid = getAreaGrid || (() => null);
    this.wakeUp = wakeUp || (() => {});
    this.getPlayerPos = getPlayerPos || (() => ({ x: 0, y: 0 }));
    this.getTargetCursor = getTargetCursor || (() => ({ x: -1, y: -1 }));
    this.getZoom = getZoom || (() => 1.0);

    this.fxCanvas = null;
    this.fxCtx = null;
    this.activeFxList = [];

    this.screenShakeTime = 0;
    this.screenShakeDuration = 0;
    this.screenShakeIntensity = 0;

    this.ambientParticles = [];
    this.mapActionIndicator = true;
  }

  setMapActionIndicator(enabled) {
    this.mapActionIndicator = Boolean(enabled);
  }

  init() {
    if (!this.canvas || typeof document === 'undefined') return;
    let fxCanvas = document.getElementById('webgpu-fx-canvas');
    if (!fxCanvas && this.canvas.parentElement) {
      fxCanvas = document.createElement('canvas');
      fxCanvas.id = 'webgpu-fx-canvas';
      fxCanvas.width = this.canvas.width;
      fxCanvas.height = this.canvas.height;
      this.canvas.parentElement.appendChild(fxCanvas);
    }
    if (fxCanvas) {
      this.fxCanvas = fxCanvas;
      this.fxCtx = fxCanvas.getContext('2d');
    }
    this._initAmbientParticles();
  }

  resize(width, height) {
    if (this.fxCanvas) {
      this.fxCanvas.width = width;
      this.fxCanvas.height = height;
    }
  }

  addVisualFx(fx) {
    if (!fx) return;
    this.activeFxList.push(fx);
    this.wakeUp();
  }

  triggerScreenShake(intensity = 3, durationMs = 100) {
    this.screenShakeTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.screenShakeDuration = durationMs;
    this.screenShakeIntensity = intensity;
    this.wakeUp();
  }

  getScreenShakeOffset(now) {
    if (this.screenShakeTime > 0) {
      const elapsed = now - this.screenShakeTime;
      if (elapsed < this.screenShakeDuration) {
        const factor = 1 - (elapsed / this.screenShakeDuration);
        const intensity = this.screenShakeIntensity * factor;
        return {
          x: (Math.random() * 2 - 1) * intensity,
          y: (Math.random() * 2 - 1) * intensity
        };
      } else {
        this.screenShakeTime = 0;
      }
    }
    return { x: 0, y: 0 };
  }

  _initAmbientParticles() {
    this.ambientParticles = [];
    const count = 32;
    for (let i = 0; i < count; i++) {
      this.ambientParticles.push({
        offsetX: (Math.random() * 2 - 1) * 6.0,
        offsetY: Math.random() * 1.5,
        offsetZ: (Math.random() * 2 - 1) * 6.0,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() * 0.2) + 0.06,
        vz: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.8 + 1.2,
        baseAlpha: Math.random() * 0.35 + 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.2 + 0.8,
        isGold: Math.random() > 0.45
      });
    }
  }

  _renderAmbientParticles(ctx, now, playerPos) {
    if (!this.ambientParticles || this.ambientParticles.length === 0) return;
    const dt = 0.016;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.ambientParticles) {
      p.offsetX += p.vx * dt;
      p.offsetY += p.vy * dt;
      p.offsetZ += p.vz * dt;

      if (p.offsetY > 1.6 || Math.abs(p.offsetX) > 7.0 || Math.abs(p.offsetZ) > 7.0) {
        p.offsetX = (Math.random() * 2 - 1) * 5.5;
        p.offsetY = 0.05;
        p.offsetZ = (Math.random() * 2 - 1) * 5.5;
      }

      const worldX = playerPos.x + p.offsetX;
      const worldY = p.offsetY;
      const worldZ = playerPos.y + p.offsetZ;

      const proj = this.worldToScreen(worldX, worldY, worldZ);
      if (proj && proj.screenX >= -10 && proj.screenX <= this.canvas.width + 10 &&
          proj.screenY >= -10 && proj.screenY <= this.canvas.height + 10) {
        const pulse = Math.sin(now * 0.003 * p.speed + p.phase);
        const currentAlpha = Math.max(0.05, p.baseAlpha * (0.6 + 0.4 * pulse));
        
        ctx.fillStyle = p.isGold
          ? `rgba(255, 215, 120, ${currentAlpha})`
          : `rgba(160, 220, 255, ${currentAlpha * 0.8})`;

        ctx.beginPath();
        ctx.arc(proj.screenX, proj.screenY, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _renderCursorFrames(ctx, ts, now, playerPos, targetCursor) {
    if (targetCursor.x >= 0 && targetCursor.y >= 0 &&
        (targetCursor.x !== playerPos.x || targetCursor.y !== playerPos.y)) {
      this.wakeUp();
      const tx = targetCursor.x;
      const ty = targetCursor.y;
      const p0 = this.worldToScreen(tx - 0.48, 0.01, ty - 0.48);
      const p1 = this.worldToScreen(tx + 0.48, 0.01, ty - 0.48);
      const p2 = this.worldToScreen(tx + 0.48, 0.01, ty + 0.48);
      const p3 = this.worldToScreen(tx - 0.48, 0.01, ty + 0.48);

      if (p0 && p1 && p2 && p3) {
        const pulse = 0.65 + 0.35 * Math.sin(now / 140);
        ctx.save();
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(p0.screenX, p0.screenY);
        ctx.lineTo(p1.screenX, p1.screenY);
        ctx.lineTo(p2.screenX, p2.screenY);
        ctx.lineTo(p3.screenX, p3.screenY);
        if (typeof ctx.closePath === 'function') {
          ctx.closePath();
        } else {
          ctx.lineTo(p0.screenX, p0.screenY);
        }
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        const cornerFactor = 0.22;
        // p0 (左奥)
        ctx.beginPath();
        ctx.moveTo(p0.screenX + (p1.screenX - p0.screenX) * cornerFactor, p0.screenY + (p1.screenY - p0.screenY) * cornerFactor);
        ctx.lineTo(p0.screenX, p0.screenY);
        ctx.lineTo(p0.screenX + (p3.screenX - p0.screenX) * cornerFactor, p0.screenY + (p3.screenY - p0.screenY) * cornerFactor);
        ctx.stroke();

        // p1 (右奥)
        ctx.beginPath();
        ctx.moveTo(p1.screenX + (p0.screenX - p1.screenX) * cornerFactor, p1.screenY + (p0.screenY - p1.screenY) * cornerFactor);
        ctx.lineTo(p1.screenX, p1.screenY);
        ctx.lineTo(p1.screenX + (p2.screenX - p1.screenX) * cornerFactor, p1.screenY + (p2.screenY - p1.screenY) * cornerFactor);
        ctx.stroke();

        // p2 (右手前)
        ctx.beginPath();
        ctx.moveTo(p2.screenX + (p1.screenX - p2.screenX) * cornerFactor, p2.screenY + (p1.screenY - p2.screenY) * cornerFactor);
        ctx.lineTo(p2.screenX, p2.screenY);
        ctx.lineTo(p2.screenX + (p3.screenX - p2.screenX) * cornerFactor, p2.screenY + (p3.screenY - p2.screenY) * cornerFactor);
        ctx.stroke();

        // p3 (左手前)
        ctx.beginPath();
        ctx.moveTo(p3.screenX + (p2.screenX - p3.screenX) * cornerFactor, p3.screenY + (p2.screenY - p3.screenY) * cornerFactor);
        ctx.lineTo(p3.screenX, p3.screenY);
        ctx.lineTo(p3.screenX + (p0.screenX - p3.screenX) * cornerFactor, p3.screenY + (p0.screenY - p3.screenY) * cornerFactor);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  _renderEntityHighlights(ctx, ts, now) {
    const situation = this.getSituation ? this.getSituation() : null;
    const area = situation?.area;
    const areaGrid = area?.grid || (this.getAreaGrid ? this.getAreaGrid() : null);
    if (!areaGrid) return;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const cell = areaGrid[y]?.[x];
        if (!cell) continue;

        // 1. piletop (アイテム山積み) 視覚強調マーク (右下 [+] または [+N] バッジ)
        const middleGlyph = cell.middle?.rawGlyph ?? -1;
        const extraCount = cell.middle?.extraPileCount ?? 0;
        const isPile = Boolean(cell.middle?.isPile || extraCount > 0 || (middleGlyph >= 7992 && middleGlyph < 9622));
        if (isPile) {
          const itemProj = this.worldToScreen(x, 0.12, y);
          if (itemProj && itemProj.screenX >= -20 && itemProj.screenX <= canvasW + 20 &&
              itemProj.screenY >= -20 && itemProj.screenY <= canvasH + 20) {
            const badgeText = extraCount > 0 ? (extraCount >= 10 ? '+9+' : `+${extraCount}`) : '+';
            const baseSize = Math.max(10, Math.min(18, Math.round(ts * 0.28)));
            const badgeWidth = badgeText.length > 2 ? Math.round(baseSize * 1.5) : (badgeText.length > 1 ? Math.round(baseSize * 1.25) : baseSize);
            const badgeHeight = baseSize;
            const halfW = Math.round(badgeWidth / 2);
            const halfH = Math.round(badgeHeight / 2);
            const fontSize = Math.max(9, Math.min(13, Math.round(baseSize * 0.8)));

            const bx = Math.round(itemProj.screenX + ts * 0.22);
            const by = Math.round(itemProj.screenY + ts * 0.22);
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(bx - halfW, by - halfH, badgeWidth, badgeHeight);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - halfW, by - halfH, badgeWidth, badgeHeight);
            if (typeof ctx.fillText === 'function') {
              ctx.fillStyle = '#ffeb3b';
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeText, bx, by);
            }
            ctx.restore();
          }
        }

        // 2. Pet / Ridden の同定判定
        const topGlyph = cell.top?.rawGlyph ?? -1;
        const isPet = Boolean(cell.top?.isPet || (topGlyph >= 766 && topGlyph < 1532));
        const isRidden = Boolean(cell.top?.isRidden || (topGlyph >= 2682 && topGlyph < 3448));

        if (isPet || isRidden) {
          const headProj = this.worldToScreen(x, 0.88, y);
          if (headProj && headProj.screenX >= -30 && headProj.screenX <= canvasW + 30 &&
              headProj.screenY >= -30 && headProj.screenY <= canvasH + 30) {
            const badgeSize = Math.max(10, Math.min(18, Math.round(ts * 0.28)));
            const halfSize = Math.round(badgeSize / 2);
            const fontSize = Math.max(9, Math.min(13, Math.round(badgeSize * 0.8)));

            const bx = Math.round(headProj.screenX + ts * 0.22);
            const by = Math.round(headProj.screenY - ts * 0.22);
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(bx - halfSize, by - halfSize, badgeSize, badgeSize);
            ctx.strokeStyle = isRidden ? '#00b0ff' : '#00e676';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx - halfSize, by - halfSize, badgeSize, badgeSize);
            if (typeof ctx.fillText === 'function') {
              ctx.fillStyle = isRidden ? '#00b0ff' : '#00e676';
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(isRidden ? 'R' : '♥', bx, by);
            }
            ctx.restore();
          }
        }
      }
    }
  }

  _renderActionBadges(ctx, ts, now, playerPos) {
    if (!this.mapActionIndicator) return;
    const situation = this.getSituation ? this.getSituation() : null;
    const actions = situation?.actions || [];
    if (!actions || actions.length === 0) return;

    const DIR_OFFSETS = [
      { dx: 0, dy: 0, dir: 'SELF' },
      { dx: 0, dy: -1, dir: 'N' },
      { dx: 1, dy: -1, dir: 'NE' },
      { dx: 1, dy: 0, dir: 'E' },
      { dx: 1, dy: 1, dir: 'SE' },
      { dx: 0, dy: 1, dir: 'S' },
      { dx: -1, dy: 1, dir: 'SW' },
      { dx: -1, dy: 0, dir: 'W' },
      { dx: -1, dy: -1, dir: 'NW' }
    ];

    const extractDir = (a) => {
      if (!a) return 'NONE';
      if (a.directionCode) return a.directionCode;
      if (a.dirCode) return String(a.dirCode).toUpperCase().replace(/^DIR_/, '');
      return a.isDirectional === false ? 'SELF' : 'NONE';
    };

    const isSpecificAction = (a) => {
      if (!a) return false;
      if (a.isDefault) return false;
      if (a.category === 'DEFAULT') return false;
      if (a.id === 'ACTION_WAIT' || a.id === 'ACTION_MOVE') return false;
      return true;
    };

    const isDigAction = (a) => {
      if (!a || !a.id) return false;
      return a.id.includes('DIG') || a.id === 'ACTION_APPLY_DIG' || a.id === 'ACTION_ZAP_DIG';
    };

    for (const { dx, dy, dir } of DIR_OFFSETS) {
      const gx = playerPos.x + dx;
      const gy = playerPos.y + dy;
      if (gx < 0 || gx >= 80 || gy < 0 || gy >= 24) continue;

      const cellActions = actions.filter(a => extractDir(a) === dir && isSpecificAction(a));
      if (cellActions.length === 0) continue;

      const hasDig = cellActions.some(isDigAction);

      // セル枠の 3D 投影四隅
      const p0 = this.worldToScreen(gx - 0.48, 0.02, gy - 0.48);
      const p1 = this.worldToScreen(gx + 0.48, 0.02, gy - 0.48);
      const p2 = this.worldToScreen(gx + 0.48, 0.02, gy + 0.48);
      const p3 = this.worldToScreen(gx - 0.48, 0.02, gy + 0.48);

      if (p0 && p1 && p2 && p3) {
        ctx.save();
        ctx.strokeStyle = hasDig ? 'rgba(251, 191, 36, 0.65)' : 'rgba(56, 189, 248, 0.45)';
        ctx.lineWidth = hasDig ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(p0.screenX, p0.screenY);
        ctx.lineTo(p1.screenX, p1.screenY);
        ctx.lineTo(p2.screenX, p2.screenY);
        ctx.lineTo(p3.screenX, p3.screenY);
        if (typeof ctx.closePath === 'function') {
          ctx.closePath();
        } else {
          ctx.lineTo(p0.screenX, p0.screenY);
        }
        ctx.stroke();

        // 左上（p0）付近にミニバッジを描画
        const countText = String(cellActions.length);
        const baseSize = Math.max(10, Math.min(16, Math.round(ts * 0.28)));
        const badgeWidth = countText.length > 1 ? Math.round(baseSize * 1.35) : baseSize;
        const badgeHeight = Math.round(baseSize * 0.85);
        const bx = Math.round(p0.screenX + 2);
        const by = Math.round(p0.screenY + 2);
        const fontSize = Math.max(8, Math.min(11, Math.round(baseSize * 0.75)));

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(bx, by, badgeWidth, badgeHeight);
        ctx.strokeStyle = hasDig ? '#fbbf24' : '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, badgeWidth, badgeHeight);

        if (typeof ctx.fillText === 'function') {
          ctx.fillStyle = hasDig ? '#fbbf24' : '#e0f2fe';
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(countText, bx + badgeWidth / 2, by + badgeHeight / 2 + 0.5);
        }

        ctx.restore();
      }
    }
  }

  render(now) {
    if (!this.fxCtx || !this.fxCanvas) return;
    const ctx = this.fxCtx;
    ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);

    const playerPos = this.getPlayerPos();
    const targetCursor = this.getTargetCursor();
    const currentZoom = this.getZoom();

    const pP0 = this.worldToScreen(playerPos.x - 0.5, 0.45, playerPos.y);
    const pP1 = this.worldToScreen(playerPos.x + 0.5, 0.45, playerPos.y);
    const baseTs = (pP0 && pP1)
      ? Math.max(16, Math.round(Math.abs(pP1.screenX - pP0.screenX)))
      : Math.max(16, Math.round(32 * (currentZoom || 1.0)));

    // 0. 環境浮遊パーティクル
    this._renderAmbientParticles(ctx, now, playerPos);

    // 1. 自キャラ枠 ＆ ターゲットカーソル枠の描画
    this._renderCursorFrames(ctx, baseTs, now, playerPos, targetCursor);

    // 2. Pet / Ridden / piletop アイテムの視覚的強調描画
    this._renderEntityHighlights(ctx, baseTs, now);

    // 2.5. マップ上への ContextActions バッジ ＆ 掘削アシスト枠描画
    this._renderActionBadges(ctx, baseTs, now, playerPos);

    // 3. Visual FX の描画
    if (!this.activeFxList || this.activeFxList.length === 0) return;

    this.wakeUp();

    const canvasW = this.fxCanvas.width;
    const canvasH = this.fxCanvas.height;

    this.activeFxList = this.activeFxList.filter(fx => {
      const elapsed = now - fx.startTime;
      if (elapsed >= fx.durationMs) return false;

      const progress = Math.min(1.0, elapsed / fx.durationMs);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const targetGx = fx.followPlayer ? playerPos.x : fx.gx;
      const targetGy = fx.followPlayer ? playerPos.y : fx.gy;

      if (targetGx === undefined || targetGy === undefined) return true;

      const projected = this.worldToScreen(targetGx, 0.45, targetGy);
      if (!projected) return true;

      const pLeft = this.worldToScreen(targetGx - 0.5, 0.45, targetGy);
      const pRight = this.worldToScreen(targetGx + 0.5, 0.45, targetGy);
      const ts = (pLeft && pRight)
        ? Math.max(16, Math.round(Math.abs(pRight.screenX - pLeft.screenX)))
        : baseTs;

      const screenX = Math.round(projected.screenX - ts / 2);
      const screenY = Math.round(projected.screenY - ts / 2);

      if (screenX < -ts || screenX > canvasW || screenY < -ts || screenY > canvasH) {
        return true;
      }

      ctx.save();

      if (fx.type === 'SLASH') {
        const alpha = 1 - progress;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ffd740';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const startX = screenX + 4;
        const startY = screenY + 4;
        const endX = startX + (ts - 8) * Math.min(1.0, progress * 2.5);
        const endY = startY + (ts - 8) * Math.min(1.0, progress * 2.5);
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        if (progress > 0.2) {
          ctx.strokeStyle = `rgba(255, 215, 64, ${alpha * 0.8})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(screenX + ts - 8, screenY + 8);
          ctx.lineTo(screenX + 8, screenY + ts - 8);
          ctx.stroke();
        }
      } else if (fx.type === 'DAMAGE_FLASH') {
        const flashProgress = Math.min(1.0, elapsed / 160);
        if (flashProgress < 1.0) {
          const alpha = (1 - flashProgress) * 0.6;
          ctx.fillStyle = `rgba(244, 67, 54, ${alpha})`;
          ctx.fillRect(screenX, screenY, ts, ts);
          ctx.strokeStyle = `rgba(255, 23, 68, ${1 - flashProgress})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX, screenY, ts, ts);
        }

        if (fx.amount !== undefined && fx.amount > 0) {
          const textAlpha = Math.max(0, 1 - progress);
          const floatY = -easeOut * (ts * 0.75);
          const textX = screenX + ts / 2;
          const textY = screenY + (ts * 0.25) + floatY;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = Math.max(12, Math.round(ts * 0.45));
          ctx.font = `bold ${fontSize}px monospace, sans-serif`;

          const text = `-${fx.amount}`;
          ctx.strokeStyle = `rgba(0, 0, 0, ${textAlpha * 0.9})`;
          ctx.lineWidth = 3;
          ctx.strokeText(text, textX, textY);

          ctx.fillStyle = `rgba(255, 68, 68, ${textAlpha})`;
          ctx.fillText(text, textX, textY);
          ctx.restore();
        }
      } else if (fx.type === 'KILL_BURST') {
        const alpha = 1 - progress;
        const radius = (ts * 0.5) * (0.3 + easeOut * 0.7);
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2;

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

        ctx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
        const d = radius * 0.7;
        const pSize = Math.max(1, 3 * (1 - progress));
        ctx.fillRect(cx - d, cy - d, pSize, pSize);
        ctx.fillRect(cx + d, cy - d, pSize, pSize);
        ctx.fillRect(cx - d, cy + d, pSize, pSize);
        ctx.fillRect(cx + d, cy + d, pSize, pSize);
      } else if (fx.type === 'HEAL_RING') {
        const ringProgress = Math.min(1.0, elapsed / 250);
        const ringEaseOut = 1 - Math.pow(1 - ringProgress, 2);
        const alpha = 1 - ringProgress;
        const liftY = -ringEaseOut * 12;
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2 + liftY;
        const r = 4 + ringEaseOut * 10;

        if (ringProgress < 1.0) {
          ctx.strokeStyle = `rgba(0, 230, 118, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.shadowColor = '#69f0ae';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (fx.amount !== undefined && fx.amount > 0) {
          const textAlpha = Math.max(0, 1 - progress);
          const floatY = -easeOut * (ts * 0.75);
          const textX = screenX + ts / 2;
          const textY = screenY + (ts * 0.25) + floatY;

          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const fontSize = Math.max(12, Math.round(ts * 0.45));
          ctx.font = `bold ${fontSize}px monospace, sans-serif`;

          const text = `+${fx.amount}`;
          ctx.strokeStyle = `rgba(0, 0, 0, ${textAlpha * 0.9})`;
          ctx.lineWidth = 3;
          ctx.strokeText(text, textX, textY);

          ctx.fillStyle = `rgba(0, 230, 118, ${textAlpha})`;
          ctx.fillText(text, textX, textY);
          ctx.restore();
        }
      } else if (fx.type === 'DEATH_BURST') {
        const alpha = Math.max(0, 1 - progress);
        const radius = (ts * 0.8) * (0.2 + easeOut * 1.2);
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2;

        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
        ctx.lineWidth = 3 * (1 - progress * 0.5);
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      return true;
    });
  }
}
