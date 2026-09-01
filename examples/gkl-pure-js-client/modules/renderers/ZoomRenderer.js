/**
 * ZoomRenderer - 自キャラ周辺の 7x7 / 21x9 マス拡大ズームカメラ Canvas 描画 & Visual FX & 画面振動マネージャー
 */
export class ZoomRenderer {
  constructor({
    zoomCanvas,
    zoomViewportBox,
    zoomPosBadge,
    btnToggleZoom,
    getSituation,
    getGlyphBuffer,
    tileImg,
    tileLoaded
  }) {
    this.zoomCanvas = zoomCanvas;
    this.zoomCtx = zoomCanvas ? zoomCanvas.getContext('2d') : null;
    this.zoomViewportBox = zoomViewportBox;
    this.zoomPosBadge = zoomPosBadge;
    this.btnToggleZoom = btnToggleZoom;

    this.getSituation = getSituation || (() => null);
    this.getGlyphBuffer = getGlyphBuffer || (() => null);
    this.mainTileImg = tileImg;
    this.mainTileLoaded = tileLoaded;

    this.isZoomMode = true;
    this.currentLanguage = 'ja';
    this.targetCursorX = -1;
    this.targetCursorY = -1;
    this.isPlayerDead = false;
    this.deathPosition = null;

    // Multi-path Sprite Tile Image Loader (Zoom: Transparent)
    this.zoomTileImg = new Image();
    this.zoomTileLoaded = false;
    this.loadedZoomTileImagePath = null;

    // Visual FX & Screen Shake State
    this.activeFxList = [];
    this.screenShakeTime = 0;
    this.screenShakeDuration = 0;
    this.screenShakeIntensity = 0;
  }

  init() {
    this.initTileImageWithFallback([
      '../../pict/nethack_default_32_tr.png',
      '../../assets/nethack_default_32_tr.png',
      'pict/nethack_default_32_tr.png',
      'assets/nethack_default_32_tr.png',
      '/pict/nethack_default_32_tr.png',
      '/assets/nethack_default_32_tr.png'
    ], (p) => {
      this.zoomTileImg.src = p;
      this.loadedZoomTileImagePath = p;
      this.zoomTileLoaded = true;
      const situation = this.getSituation();
      if (situation) {
        this.renderZoomCanvas(situation.area);
      }
    });
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this.updateZoomButtonText();
  }

  initTileImageWithFallback(paths, onSuccess) {
    let index = 0;
    const tryNext = () => {
      if (index >= paths.length) {
        console.warn("[GKL PureJS] Zoom tile paths failed for:", paths[0]);
        return;
      }
      const p = paths[index++];
      const testImg = new Image();
      testImg.onload = () => {
        if (typeof onSuccess === 'function') {
          onSuccess(p);
        }
      };
      testImg.onerror = tryNext;
      testImg.src = p;
    };
    tryNext();
  }

  updateZoomButtonText() {
    if (!this.btnToggleZoom) return;
    const isEn = this.currentLanguage === 'en';
    const prefix = isEn ? '🎯 Zoom Camera: ' : '🎯 ズームカメラ: ';
    this.btnToggleZoom.textContent = prefix + (this.isZoomMode ? 'ON' : 'OFF');
  }

  toggleZoom(enabled) {
    this.isZoomMode = (enabled !== undefined) ? enabled : !this.isZoomMode;
    if (this.zoomViewportBox) {
      if (this.isZoomMode) {
        this.zoomViewportBox.classList.remove('hidden');
      } else {
        this.zoomViewportBox.classList.add('hidden');
      }
    }
    this.updateZoomButtonText();
  }

  triggerScreenShake(intensity = 3, durationMs = 100) {
    this.screenShakeTime = performance.now();
    this.screenShakeDuration = durationMs;
    this.screenShakeIntensity = intensity;
  }

  addVisualFx(fx) {
    this.activeFxList.push(fx);
  }

  startGklRenderLoop() {
    const loop = () => {
      if (this.isZoomMode && this.zoomCtx) {
        const situation = this.getSituation();
        if (situation) {
          this.renderZoomCanvas(situation.area);
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  // 🎯 自キャラ周辺 拡大ズームカメラ描画 (21x9 マス, 32px タイル)
  renderZoomCanvas(areaState) {
    if (!this.zoomCtx || !this.zoomCanvas) return;

    const grid = areaState?.grid;
    const px = (this.targetCursorX >= 0)
      ? this.targetCursorX
      : ((areaState && typeof areaState.playerX === 'number')
          ? areaState.playerX
          : (areaState?.playerLocation?.x ?? 0));
    const py = (this.targetCursorY >= 0)
      ? this.targetCursorY
      : ((areaState && typeof areaState.playerY === 'number')
          ? areaState.playerY
          : (areaState?.playerLocation?.y ?? 0));
    const width = areaState?.width || 80;
    const height = areaState?.height || 21;

    if (this.zoomPosBadge) {
      this.zoomPosBadge.textContent = `@ (${px},${py})`;
    }

    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
    const activeZoomImg = (this.zoomTileLoaded && this.zoomTileImg && this.zoomTileImg.naturalWidth > 0)
      ? this.zoomTileImg
      : (this.mainTileLoaded && this.mainTileImg && this.mainTileImg.naturalWidth > 0 ? this.mainTileImg : null);
    const cols = (activeZoomImg && activeZoomImg.width) ? Math.floor(activeZoomImg.width / 32) : 40;

    const canvasW = this.zoomCanvas.width; // 672
    const canvasH = this.zoomCanvas.height; // 288
    const zoomTileSize = 32; // 拡大 32px タイル

    const now = performance.now();

    // 画面シェイクの計算
    let shakeX = 0;
    let shakeY = 0;
    if (this.screenShakeTime > 0) {
      const elapsed = now - this.screenShakeTime;
      if (elapsed < this.screenShakeDuration) {
        const progress = 1 - (elapsed / this.screenShakeDuration);
        const mag = this.screenShakeIntensity * progress;
        shakeX = (Math.random() * 2 - 1) * mag;
        shakeY = (Math.random() * 2 - 1) * mag;
      } else {
        this.screenShakeTime = 0;
      }
    }

    this.zoomCtx.save();
    this.zoomCtx.translate(shakeX, shakeY);

    this.zoomCtx.fillStyle = '#090916';
    this.zoomCtx.fillRect(0, 0, canvasW, canvasH);

    // 21x9 マスを中心（10,4）に配置
    const halfRangeX = 10;
    const halfRangeY = 4;
    // キビキビとした上方向バウンス (周期約0.5秒, 0〜-3px / 死亡時は静止)
    const bounceY = this.isPlayerDead ? 0 : -Math.round(Math.abs(Math.sin(Date.now() / 160)) * 3);
    const glyphGridBuffer = this.getGlyphBuffer();

    for (let dy = -halfRangeY; dy <= halfRangeY; dy++) {
      for (let dx = -halfRangeX; dx <= halfRangeX; dx++) {
        const gx = px + dx;
        const gy = py + dy;

        const screenX = (dx + halfRangeX) * zoomTileSize;
        const screenY = (dy + halfRangeY) * zoomTileSize;

        if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
          const cell = (grid && grid[gy]) ? grid[gy][gx] : null;
          const gData = (glyphGridBuffer && glyphGridBuffer[gy] && glyphGridBuffer[gy][gx]) ? glyphGridBuffer[gy][gx] : null;

          // セルに一度でも記憶された地形/アイテム/エンティティ情報があるかチェック
          // ※ isCachedPreload (プリロード階段) のみの未探索マスはブラックアウトとして扱う
          const isPreloadOnly = cell && cell.bottom && cell.bottom.isCachedPreload && !cell.middle && !cell.top;
          const hasNetHackGlyph = gData && gData.glyph >= 0 && gData.ch !== ' ';
          const hasExploredMemory = cell && ((cell.bottom && !cell.bottom.isCachedPreload) || cell.middle || cell.top);
          const isCurrentPlayerFeet = (dx === 0 && dy === 0);
          const hasMemory = hasExploredMemory || hasNetHackGlyph || (isPreloadOnly && isCurrentPlayerFeet);

          if (!hasMemory && !hasNetHackGlyph) {
            // 未探索マスはブラックアウト
            this.zoomCtx.fillStyle = '#000000';
            this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
          } else {
            if (cell && (cell.bottom || cell.middle || cell.top)) {
              // Layer 1: Bottom (現フロアで一度でも確認した壁・床・通路等の地形)
              if (cell.bottom && cell.bottom.rawGlyph >= 0 && (!cell.bottom.isCachedPreload || hasNetHackGlyph || isCurrentPlayerFeet)) {
                this.drawZoomTile(cell.bottom.rawGlyph, cols, tileMap, screenX, screenY, 0);
              } else if (cell.middle || cell.top) {
                // Bottom が未確定だがアイテムやモンスターが存在する場合は仮床を描画
                this.drawZoomTile(3992, cols, tileMap, screenX, screenY, 0);
              } else if (gData && gData.glyph >= 0) {
                this.drawZoomTile(gData.glyph, cols, tileMap, screenX, screenY, 0);
              } else {
                this.zoomCtx.fillStyle = '#121224';
                this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
              }

              // Layer 2: Middle (アイテム)
              if (cell.middle && cell.middle.rawGlyph >= 0) {
                this.drawZoomTile(cell.middle.rawGlyph, cols, tileMap, screenX, screenY, 0);
              }

              // 自キャラマスのネオン枠ハイライト（自キャラタイルの背面に固定描画）
              if (dx === 0 && dy === 0) {
                if (this.isPlayerDead) {
                  this.zoomCtx.strokeStyle = '#ef4444';
                  this.zoomCtx.lineWidth = 1;
                  this.zoomCtx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                } else {
                  this.zoomCtx.strokeStyle = '#00e676';
                  this.zoomCtx.lineWidth = 2;
                  this.zoomCtx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                }
              }

              // Layer 3: Top (キャラクター/モンスター + バウンス / 死亡時は墓石)
              if (this.isPlayerDead && dx === 0 && dy === 0) {
                this.drawZoomTile(4011, cols, tileMap, screenX, screenY, 0);
              } else if (cell.top && cell.top.rawGlyph >= 0) {
                this.drawZoomTile(cell.top.rawGlyph, cols, tileMap, screenX, screenY, bounceY);
              }

              // Layer 4: Effect (稲妻・ビーム・爆発等の過渡的エフェクト)
              if (cell.effect && cell.effect.rawGlyph >= 0) {
                this.drawZoomTile(cell.effect.rawGlyph, cols, tileMap, screenX, screenY, 0);
              }
            } else if (gData && gData.glyph >= 0 && gData.ch !== ' ') {
              if (dx === 0 && dy === 0) {
                if (this.isPlayerDead) {
                  this.zoomCtx.strokeStyle = '#ef4444';
                  this.zoomCtx.lineWidth = 1;
                  this.zoomCtx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                  this.drawZoomTile(4011, cols, tileMap, screenX, screenY, 0);
                } else {
                  this.zoomCtx.strokeStyle = '#00e676';
                  this.zoomCtx.lineWidth = 2;
                  this.zoomCtx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
                  this.drawZoomTile(gData.glyph, cols, tileMap, screenX, screenY, 0);
                }
              } else {
                this.drawZoomTile(gData.glyph, cols, tileMap, screenX, screenY, 0);
              }
            } else {
              this.zoomCtx.fillStyle = '#000000';
              this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
            }
          }

          // 🎯 ターゲットカーソル枠 または 自キャラ枠の描画（未探索ブラックアウトマス上でも常に最前面に視認可能）
          const isTargetCursor = (this.targetCursorX >= 0 && gx === this.targetCursorX && gy === this.targetCursorY);
          const isCenter = (dx === 0 && dy === 0);

          if (isTargetCursor) {
            this.zoomCtx.strokeStyle = '#ffd700'; // ターゲットカーソル枠（金色）
            this.zoomCtx.lineWidth = 2;
            this.zoomCtx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
          } else if (isCenter && this.targetCursorX < 0) {
            if (this.isPlayerDead) {
              this.zoomCtx.strokeStyle = '#ef4444';
              this.zoomCtx.lineWidth = 1;
              this.zoomCtx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
            } else {
              this.zoomCtx.strokeStyle = '#00e676';
              this.zoomCtx.lineWidth = 2;
              this.zoomCtx.strokeRect(screenX + 1, screenY + 1, zoomTileSize - 2, zoomTileSize - 2);
            }
          }
        } else {
          // 範囲外ブラック
          this.zoomCtx.fillStyle = '#000000';
          this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
        }
      }
    }

    // 🎨 Layer 5: Visual FX 最前面オーバーレイ描画
    this.renderVisualFx(px, py, halfRangeX, halfRangeY, zoomTileSize, canvasW, canvasH, now);

    this.zoomCtx.restore();
  }

  /**
   * 🎨 FocusCamera 上での Visual FX 最前面オーバーレイ描画＆自動ライフサイクル管理
   */
  renderVisualFx(px, py, halfRangeX, halfRangeY, zoomTileSize, canvasW, canvasH, now) {
    if (!this.activeFxList || this.activeFxList.length === 0) return;

    this.activeFxList = this.activeFxList.filter(fx => {
      const elapsed = now - fx.startTime;
      if (elapsed >= fx.durationMs) return false;

      const progress = Math.min(1.0, elapsed / fx.durationMs);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const targetGx = fx.followPlayer ? px : fx.gx;
      const targetGy = fx.followPlayer ? py : fx.gy;

      if (targetGx === undefined || targetGy === undefined) return true;

      const screenX = (targetGx - px + halfRangeX) * zoomTileSize;
      const screenY = (targetGy - py + halfRangeY) * zoomTileSize;

      if (screenX < -zoomTileSize || screenX > canvasW || screenY < -zoomTileSize || screenY > canvasH) {
        return true;
      }

      this.zoomCtx.save();

      if (fx.type === 'SLASH') {
        // ⚔️ 斬撃エフェクト (斜めラインと光彩)
        const alpha = 1 - progress;
        this.zoomCtx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        this.zoomCtx.lineWidth = 3;
        this.zoomCtx.shadowColor = '#ffd740';
        this.zoomCtx.shadowBlur = 6;
        this.zoomCtx.beginPath();
        const startX = screenX + 4;
        const startY = screenY + 4;
        const endX = startX + (zoomTileSize - 8) * Math.min(1.0, progress * 2.5);
        const endY = startY + (zoomTileSize - 8) * Math.min(1.0, progress * 2.5);
        this.zoomCtx.moveTo(startX, startY);
        this.zoomCtx.lineTo(endX, endY);
        this.zoomCtx.stroke();

        if (progress > 0.2) {
          this.zoomCtx.strokeStyle = `rgba(255, 215, 64, ${alpha * 0.8})`;
          this.zoomCtx.lineWidth = 1.5;
          this.zoomCtx.beginPath();
          this.zoomCtx.moveTo(screenX + zoomTileSize - 8, screenY + 8);
          this.zoomCtx.lineTo(screenX + 8, screenY + zoomTileSize - 8);
          this.zoomCtx.stroke();
        }
      } else if (fx.type === 'DAMAGE_FLASH') {
        // 💥 被弾赤フラッシュ (半透明赤矩形 + 赤枠)
        const alpha = (1 - progress) * 0.6;
        this.zoomCtx.fillStyle = `rgba(244, 67, 54, ${alpha})`;
        this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
        this.zoomCtx.strokeStyle = `rgba(255, 23, 68, ${1 - progress})`;
        this.zoomCtx.lineWidth = 2;
        this.zoomCtx.strokeRect(screenX, screenY, zoomTileSize, zoomTileSize);
      } else if (fx.type === 'KILL_BURST') {
        // 💀 撃破消滅バースト (放射状パーティクル・クロス光)
        const alpha = 1 - progress;
        const radius = (zoomTileSize * 0.5) * (0.3 + easeOut * 0.7);
        const cx = screenX + zoomTileSize / 2;
        const cy = screenY + zoomTileSize / 2;

        this.zoomCtx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        this.zoomCtx.lineWidth = 2;
        this.zoomCtx.shadowColor = '#ff9100';
        this.zoomCtx.shadowBlur = 8;

        this.zoomCtx.beginPath();
        this.zoomCtx.moveTo(cx - radius, cy);
        this.zoomCtx.lineTo(cx + radius, cy);
        this.zoomCtx.moveTo(cx, cy - radius);
        this.zoomCtx.lineTo(cx, cy + radius);
        this.zoomCtx.stroke();

        this.zoomCtx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
        const d = radius * 0.7;
        const pSize = Math.max(1, 3 * (1 - progress));
        this.zoomCtx.fillRect(cx - d, cy - d, pSize, pSize);
        this.zoomCtx.fillRect(cx + d, cy - d, pSize, pSize);
        this.zoomCtx.fillRect(cx - d, cy + d, pSize, pSize);
        this.zoomCtx.fillRect(cx + d, cy + d, pSize, pSize);
      } else if (fx.type === 'HEAL_RING') {
        // 💚 回復リング (上昇する緑のリング)
        const alpha = 1 - progress;
        const liftY = -easeOut * 12;
        const cx = screenX + zoomTileSize / 2;
        const cy = screenY + zoomTileSize / 2 + liftY;
        const r = 4 + easeOut * 10;

        this.zoomCtx.strokeStyle = `rgba(0, 230, 118, ${alpha})`;
        this.zoomCtx.lineWidth = 2;
        this.zoomCtx.shadowColor = '#69f0ae';
        this.zoomCtx.shadowBlur = 6;
        this.zoomCtx.beginPath();
        this.zoomCtx.arc(cx, cy, r, 0, Math.PI * 2);
        this.zoomCtx.stroke();
      } else if (fx.type === 'DEATH_BURST') {
        // 🪦 死亡エフェクト (拡大する赤黒の衝撃波 & 赤いクロス)
        const alpha = Math.max(0, 1 - progress);
        const radius = (zoomTileSize * 0.8) * (0.2 + easeOut * 1.2);
        const cx = screenX + zoomTileSize / 2;
        const cy = screenY + zoomTileSize / 2;

        this.zoomCtx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
        this.zoomCtx.lineWidth = 3 * (1 - progress * 0.5);
        this.zoomCtx.shadowColor = '#dc2626';
        this.zoomCtx.shadowBlur = 12;
        this.zoomCtx.beginPath();
        this.zoomCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.zoomCtx.stroke();

        if (progress < 0.7) {
          const crossProgress = 1 - (progress / 0.7);
          this.zoomCtx.strokeStyle = `rgba(254, 202, 202, ${crossProgress})`;
          this.zoomCtx.lineWidth = 2;
          const crossLen = (zoomTileSize * 0.35);
          this.zoomCtx.beginPath();
          this.zoomCtx.moveTo(cx - crossLen, cy - crossLen);
          this.zoomCtx.lineTo(cx + crossLen, cy + crossLen);
          this.zoomCtx.moveTo(cx + crossLen, cy - crossLen);
          this.zoomCtx.lineTo(cx - crossLen, cy + crossLen);
          this.zoomCtx.stroke();
        }
      }

      this.zoomCtx.restore();
      return true;
    });
  }

  drawZoomTile(glyphId, cols, tileMap, dx, dy, animY = 0) {
    const activeZoomImg = (this.zoomTileLoaded && this.zoomTileImg && this.zoomTileImg.naturalWidth > 0)
      ? this.zoomTileImg
      : (this.mainTileLoaded && this.mainTileImg && this.mainTileImg.naturalWidth > 0 ? this.mainTileImg : null);

    if (activeZoomImg) {
      const tileIndex = tileMap[glyphId] !== undefined ? tileMap[glyphId] : 0;
      const imgCols = Math.floor(activeZoomImg.width / 32) || cols;
      const sx = (tileIndex % imgCols) * 32;
      const sy = Math.floor(tileIndex / imgCols) * 32;
      this.zoomCtx.drawImage(activeZoomImg, sx, sy, 32, 32, dx, dy + animY, 32, 32);
    } else {
      this.zoomCtx.fillStyle = glyphId === 0 ? '#00e676' : '#ffd740';
      this.zoomCtx.fillRect(dx + 4, dy + 4 + animY, 24, 24);
    }
  }
}
