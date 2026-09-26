/**
 * MainViewportRenderer.js
 * メイン Canvas (#game-canvas) を担当する迫力あるメインビューポートレンダラー
 * - 32px 原寸スプライトによる高精細レンダリング
 * - プレイヤー中心のスムーズなカメラ追従 (Lerp 補間)
 * - VirtualDungeonScreen.bgCanvas からの高速切り出し転送 (たった 1 回の drawImage)
 * - 視界内モンスター・自キャラのバウンスアニメーション描画
 * - ターゲットカーソル枠、自キャラ枠ハイライト
 * - Visual FX (斬撃、被弾赤フラッシュ、撃破バースト、回復リング、死亡衝撃波)
 * - 画面振動 (Screen Shake)
 * - Color ASCII Grid (#ascii-grid) との表示切替サポート
 */

import { DEFAULT_TOMBSTONE_GLYPH } from "../../../../src/core/knowledge/state/AreaStateManager.js";
import { classifyGlyph } from "../../../../src/core/knowledge/engines/glyphClassifier.js";

export class MainViewportRenderer {
  constructor({
    canvas,
    asciiGrid,
    btnToggleView,
    virtualScreen = null,
    getAreaGrid = null,
    getSituation = null,
    getCore = null,
    tileImg = null,
    tileLoaded = false
  } = {}) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.asciiGrid = asciiGrid;
    this.btnToggleView = btnToggleView;
    this.virtualScreen = virtualScreen;
    this.getAreaGrid = getAreaGrid || (() => null);
    this.getSituation = getSituation || (() => null);
    this.getCore = getCore || (() => null);

    this.tileSize = 32; // 原寸 32px
    this.isGraphicCanvasMode = true;
    this.currentLanguage = 'ja';

    // カメラ位置 (即時追従モード: smoothScroll = false)
    this.camX = 40;
    this.camY = 12;
    this.smoothScroll = false;
    this.cameraLerp = 0.2;
    this.isCameraInitialized = false;

    // 80x24 バッファ (ASCII & グリフ情報)
    this.asciiGridBuffer = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => ({ ch: ' ', color: 7 })));
    this.glyphGridBuffer = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));

    this.targetCursorX = -1;
    this.targetCursorY = -1;
    this.isPlayerDead = false;
    this.deathPosition = null;

    // タイル画像
    this.tileImg = this.virtualScreen?.tileImg || tileImg || (typeof Image !== 'undefined' ? new Image() : null);
    this.tileLoaded = Boolean(this.virtualScreen?.tileLoaded || tileLoaded);
    this.loadedTileImagePath = this.virtualScreen?.loadedTileImagePath || null;

    // Visual FX & Screen Shake State
    this.activeFxList = [];
    this.screenShakeTime = 0;
    this.screenShakeDuration = 0;
    this.screenShakeIntensity = 0;
  }

  init() {
    this.initAsciiGridDom();

    if (this.virtualScreen && this.virtualScreen.tileLoaded) {
      this.tileImg = this.virtualScreen.tileImg;
      this.tileLoaded = true;
      this.loadedTileImagePath = this.virtualScreen.loadedTileImagePath;
      this.render();
      return;
    }

    this.initTileImageWithFallback([
      '../../pict/nethack_default_32_tr.png',
      '../../assets/nethack_default_32_tr.png',
      'pict/nethack_default_32_tr.png',
      'assets/nethack_default_32_tr.png',
      '/pict/nethack_default_32_tr.png',
      '/assets/nethack_default_32_tr.png'
    ], (p) => {
      this.tileImg.src = p;
      this.loadedTileImagePath = p;
      this.tileLoaded = true;
      if (this.virtualScreen) {
        this.virtualScreen.tileImg = this.tileImg;
        this.virtualScreen.tileLoaded = true;
        this.virtualScreen.loadedTileImagePath = p;
        this.virtualScreen.markAllDirty();
      }
      this.render();
    });
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this.updateViewButtonText();
  }

  initTileImageWithFallback(paths, onSuccess) {
    let index = 0;
    const tryNext = () => {
      if (index >= paths.length) {
        console.warn("[MainViewportRenderer] Tile paths failed for:", paths[0]);
        return;
      }
      const p = paths[index++];
      const testImg = (typeof Image !== 'undefined') ? new Image() : null;
      if (!testImg) return;
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

  initAsciiGridDom() {
    if (!this.asciiGrid) return;
    this.asciiGrid.innerHTML = '';
    for (let y = 0; y < 24; y++) {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'ascii-line';
      for (let x = 0; x < 80; x++) {
        const cellSpan = document.createElement('span');
        cellSpan.id = `ascii-cell-${x}-${y}`;
        cellSpan.className = 'ascii-cell clr-7';
        cellSpan.textContent = ' ';
        lineDiv.appendChild(cellSpan);
      }
      this.asciiGrid.appendChild(lineDiv);
    }
  }

  updateViewButtonText() {
    if (!this.btnToggleView) return;
    const isEn = this.currentLanguage === 'en';
    const prefix = isEn ? 'Toggle View: ' : 'ビュー切替: ';
    if (this.isGraphicCanvasMode) {
      this.btnToggleView.textContent = prefix + '🎨 Main Camera';
    } else {
      this.btnToggleView.textContent = prefix + '🔤 Color ASCII Grid';
    }
  }

  switchViewMode(graphicCanvasMode, updateButton = true) {
    this.isGraphicCanvasMode = graphicCanvasMode;
    if (this.isGraphicCanvasMode) {
      if (this.canvas) this.canvas.classList.remove('hidden');
      if (this.asciiGrid) this.asciiGrid.classList.add('hidden');
      if (updateButton) this.updateViewButtonText();
      this.render();
    } else {
      if (this.canvas) this.canvas.classList.add('hidden');
      if (this.asciiGrid) this.asciiGrid.classList.remove('hidden');
      if (updateButton) this.updateViewButtonText();
      this.renderColorAsciiMap();
    }
  }

  renderColorAsciiMap() {
    if (!this.asciiGrid) return;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const cellData = this.asciiGridBuffer[y][x];
        const cellSpan = document.getElementById(`ascii-cell-${x}-${y}`);
        if (cellSpan) {
          cellSpan.textContent = cellData.ch || ' ';
          const isCursorCell = (x === this.targetCursorX && y === this.targetCursorY);
          cellSpan.className = `ascii-cell clr-${cellData.color !== undefined ? cellData.color : 7} ${isCursorCell ? 'is-cursor' : ''}`;
        }
      }
    }
  }

  redrawSingleCell(x, y) {
    if (x < 0 || x >= 80 || y < 0 || y >= 24) return;
    if (!this.isGraphicCanvasMode) {
      const cellData = this.asciiGridBuffer[y][x];
      const cellSpan = document.getElementById(`ascii-cell-${x}-${y}`);
      if (cellSpan) {
        const isDeathPos = this.isPlayerDead && this.deathPosition && this.deathPosition.x === x && this.deathPosition.y === y;
        cellSpan.textContent = isDeathPos ? '|' : (cellData.ch || ' ');
        const isCursorCell = (x === this.targetCursorX && y === this.targetCursorY);
        cellSpan.className = `ascii-cell clr-${isDeathPos ? 15 : (cellData.color !== undefined ? cellData.color : 7)} ${isCursorCell ? 'is-cursor' : ''}`;
      }
    } else {
      // 仮想スクリーンに dirty セルを登録
      if (this.virtualScreen) {
        this.virtualScreen.markDirty(x, y);
      }
    }
  }

  clearMapGrid() {
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        this.asciiGridBuffer[y][x] = { ch: ' ', color: 7 };
        this.glyphGridBuffer[y][x] = null;
      }
    }
    if (this.virtualScreen) {
      this.virtualScreen.clearScreen();
    }
    if (this.isGraphicCanvasMode) {
      if (this.ctx && this.canvas) {
        this.ctx.fillStyle = '#090916';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else {
      this.renderColorAsciiMap();
    }
  }

  triggerScreenShake(intensity = 3, durationMs = 100) {
    this.screenShakeTime = performance.now();
    this.screenShakeDuration = durationMs;
    this.screenShakeIntensity = intensity;
  }

  resize(width, height) {
    if (!this.canvas || width <= 0 || height <= 0) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
  }

  addVisualFx(fx) {
    this.activeFxList.push(fx);
  }

  /**
   * 毎フレームの描画メインエントリ
   */
  render() {
    if (!this.isGraphicCanvasMode || !this.ctx || !this.canvas) return;

    const situation = this.getSituation();
    const areaState = situation?.area;
    this.renderMainViewport(areaState);
  }

  /**
   * メインビューポートの描画処理
   */
  renderMainViewport(areaState) {
    if (!this.ctx || !this.canvas) return;

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

    // カメラ位置の追従 (Canvas 2D フォールバックでは補間スクロールを行わず即時タイル追従)
    if (!this.smoothScroll) {
      this.camX = px;
      this.camY = py;
      this.isCameraInitialized = true;
    } else {
      if (!this.isCameraInitialized) {
        this.camX = px;
        this.camY = py;
        this.isCameraInitialized = true;
      } else {
        this.camX += (px - this.camX) * this.cameraLerp;
        this.camY += (py - this.camY) * this.cameraLerp;
      }
    }

    // 1. 仮想スクリーンに残っている差分セルをオフスクリーン背景に反映
    if (this.virtualScreen) {
      const core = this.getCore();
      const asm = core?.gkl?.areaStateManager;
      if (asm && typeof asm.getDirtyCells === 'function' && asm.getDirtyCells().size > 0) {
        this.virtualScreen.markCellsDirty(asm.getDirtyCells());
        asm.clearDirtyCells();
      }
      this.virtualScreen.flushDirtyCells(areaState?.grid, this.glyphGridBuffer);
    }

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const ts = this.tileSize; // 32px
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

    this.ctx.save();
    this.ctx.translate(shakeX, shakeY);

    this.ctx.fillStyle = '#05070e';
    this.ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. カメラ切り出し範囲の計算
    const bgTotalW = this.virtualScreen?.width || (80 * ts); // 2560px
    const bgTotalH = this.virtualScreen?.height || (24 * ts); // 768px

    const cameraPixelX = this.camX * ts + ts / 2;
    const cameraPixelY = this.camY * ts + ts / 2;

    const srcW = Math.min(bgTotalW, canvasW);
    const srcH = Math.min(bgTotalH, canvasH);

    let srcX = Math.max(0, Math.min(bgTotalW - srcW, cameraPixelX - srcW / 2));
    let srcY = Math.max(0, Math.min(bgTotalH - srcH, cameraPixelY - srcH / 2));

    const dstX = (canvasW > bgTotalW) ? Math.floor((canvasW - bgTotalW) / 2) : 0;
    const dstY = (canvasH > bgTotalH) ? Math.floor((canvasH - bgTotalH) / 2) : 0;

    // 3. 背景 Canvas から自キャラ周辺を高速切り出し転送 (たった 1 回の drawImage)
    if (this.virtualScreen && this.virtualScreen.bgCanvas) {
      this.ctx.drawImage(
        this.virtualScreen.bgCanvas,
        srcX, srcY, srcW, srcH,
        dstX, dstY, srcW, srcH
      );
    }

    // 4. 画面内に入る動的モンスター・自キャラ (Top) & エフェクト & 枠線を描画
    const bounceY = this.isPlayerDead ? 0 : -Math.round(Math.abs(Math.sin(now / 160)) * 3);
    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
    const cols = (this.tileImg?.width) ? Math.floor(this.tileImg.width / 32) : 40;

    // 画面内に収まるタイル範囲 (余裕を持たせて ±1 マス)
    const minTileX = Math.max(0, Math.floor((srcX - dstX) / ts) - 1);
    const maxTileX = Math.min(79, Math.ceil((srcX - dstX + canvasW) / ts) + 1);
    const minTileY = Math.max(0, Math.floor((srcY - dstY) / ts) - 1);
    const maxTileY = Math.min(23, Math.ceil((srcY - dstY + canvasH) / ts) + 1);

    const areaGrid = areaState?.grid || this.getAreaGrid();

    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        const screenX = Math.round(tx * ts - srcX + dstX);
        const screenY = Math.round(ty * ts - srcY + dstY);

        const isPlayerTile = (tx === px && ty === py);
        const cell = areaGrid?.[ty]?.[tx];
        const gData = this.glyphGridBuffer?.[ty]?.[tx];

        // 仮想スクリーン未ロード時のフォールバック (テスト等)
        if (!this.virtualScreen) {
          if (cell?.bottom && cell.bottom.rawGlyph >= 0) {
            this.drawTile(cell.bottom.rawGlyph, cols, tileMap, screenX, screenY, 0);
          }
          if (cell?.middle && cell.middle.rawGlyph >= 0) {
            this.drawTile(cell.middle.rawGlyph, cols, tileMap, screenX, screenY, 0);
          }
        }

        // piletop (アイテム山積み) 視覚強調マーク (右下 [+] バッジ)
        const middleGlyph = cell?.middle?.rawGlyph ?? -1;
        const isPile = Boolean(cell?.middle?.isPile || (middleGlyph >= 7992 && middleGlyph < 9622));
        if (isPile) {
          this.ctx.save();
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          this.ctx.fillRect(screenX + ts - 11, screenY + ts - 11, 10, 10);
          this.ctx.strokeStyle = '#ffd700';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(screenX + ts - 11, screenY + ts - 11, 10, 10);
          if (typeof this.ctx.fillText === 'function') {
            this.ctx.fillStyle = '#ffeb3b';
            this.ctx.font = 'bold 9px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('+', screenX + ts - 6, screenY + ts - 6);
          }
          this.ctx.restore();
        }

        // 自キャラ足元枠ハイライト (Middle レイヤー: cell.middle 直後、cell.top 直前)
        // キャラクターのドット絵・バウンスの下に潜り込ませる
        if (isPlayerTile) {
          this.ctx.strokeStyle = this.isPlayerDead ? '#ef4444' : '#00e676';
          this.ctx.lineWidth = this.isPlayerDead ? 1 : 2;
          this.ctx.strokeRect(screenX + 1, screenY + 1, ts - 2, ts - 2);
        }

        // Pet / Ridden の同定判定
        const topGlyph = cell?.top?.rawGlyph ?? -1;
        const isPet = Boolean(cell?.top?.isPet || (topGlyph >= 766 && topGlyph < 1532));
        const isRidden = Boolean(cell?.top?.isRidden || (topGlyph >= 2682 && topGlyph < 3448));

        // Pet / Ridden 足元サークル (直立キャラクターの足元・背面)
        if (isPet || isRidden) {
          this.ctx.save();
          this.ctx.strokeStyle = isRidden ? '#00b0ff' : '#00e676';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          if (typeof this.ctx.ellipse === 'function') {
            this.ctx.ellipse(screenX + ts / 2, screenY + ts - 3, ts * 0.35, ts * 0.16, 0, 0, Math.PI * 2);
          } else {
            this.ctx.arc(screenX + ts / 2, screenY + ts - 3, ts * 0.3, 0, Math.PI * 2);
          }
          this.ctx.stroke();
          this.ctx.restore();
        }

        // Layer 3: Top (キャラクター / モンスター / 死亡時墓石)
        if (cell?.top && cell.top.rawGlyph >= 0) {
          const isBouncing = !this.isPlayerDead;
          this.drawTile(cell.top.rawGlyph, cols, tileMap, screenX, screenY, isBouncing ? bounceY : 0);
        } else if (!this.virtualScreen && gData && gData.glyph >= 0 && (!cell?.bottom && !cell?.middle)) {
          this.drawTile(gData.glyph, cols, tileMap, screenX, screenY, 0);
        }

        // Pet / Ridden 頭上ミニバッジ (♥ / R, PileTop と同様の統一ミニバッジ形式)
        if (isPet || isRidden) {
          const bounceOffset = !this.isPlayerDead ? bounceY : 0;
          const bx = screenX + ts - 6;
          const by = screenY + bounceOffset + 6;
          this.ctx.save();
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          this.ctx.fillRect(bx - 5, by - 5, 10, 10);
          this.ctx.strokeStyle = isRidden ? '#00b0ff' : '#00e676';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(bx - 5, by - 5, 10, 10);
          if (typeof this.ctx.fillText === 'function') {
            this.ctx.fillStyle = isRidden ? '#00b0ff' : '#00e676';
            this.ctx.font = 'bold 9px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(isRidden ? 'R' : '♥', bx, by);
          }
          this.ctx.restore();
        }

        // Layer 4: Effect (過渡的エフェクト)
        if (cell?.effect && cell.effect.rawGlyph >= 0) {
          this.drawTile(cell.effect.rawGlyph, cols, tileMap, screenX, screenY, 0);
        }

        // ターゲットカーソル枠 (最前面)
        if (this.targetCursorX >= 0 && tx === this.targetCursorX && ty === this.targetCursorY) {
          this.ctx.strokeStyle = '#ffd700';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(screenX + 1, screenY + 1, ts - 2, ts - 2);
        }
      }
    }

    // 5. Visual FX 最前面オーバーレイ描画
    this.renderVisualFx(srcX, srcY, dstX, dstY, ts, canvasW, canvasH, now);

    this.ctx.restore();
  }

  /**
   * Visual FX の描画＆自動ライフサイクル管理
   */
  renderVisualFx(srcX, srcY, dstX, dstY, ts, canvasW, canvasH, now) {
    if (!this.activeFxList || this.activeFxList.length === 0) return;

    this.activeFxList = this.activeFxList.filter(fx => {
      const elapsed = now - fx.startTime;
      if (elapsed >= fx.durationMs) return false;

      const progress = Math.min(1.0, elapsed / fx.durationMs);
      const easeOut = 1 - Math.pow(1 - progress, 2);

      const targetGx = fx.followPlayer ? this.camX : fx.gx;
      const targetGy = fx.followPlayer ? this.camY : fx.gy;

      if (targetGx === undefined || targetGy === undefined) return true;

      const screenX = Math.round(targetGx * ts - srcX + dstX);
      const screenY = Math.round(targetGy * ts - srcY + dstY);

      if (screenX < -ts || screenX > canvasW || screenY < -ts || screenY > canvasH) {
        return true;
      }

      this.ctx.save();

      if (fx.type === 'SLASH') {
        // ⚔️ 斬撃エフェクト
        const alpha = 1 - progress;
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#ffd740';
        this.ctx.shadowBlur = 8;
        this.ctx.beginPath();
        const startX = screenX + 4;
        const startY = screenY + 4;
        const endX = startX + (ts - 8) * Math.min(1.0, progress * 2.5);
        const endY = startY + (ts - 8) * Math.min(1.0, progress * 2.5);
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        if (progress > 0.2) {
          this.ctx.strokeStyle = `rgba(255, 215, 64, ${alpha * 0.8})`;
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(screenX + ts - 8, screenY + 8);
          this.ctx.lineTo(screenX + 8, screenY + ts - 8);
          this.ctx.stroke();
        }
      } else if (fx.type === 'DAMAGE_FLASH') {
        // 💥 被弾赤フラッシュ（最初の160msで素早く点滅）
        const flashProgress = Math.min(1.0, elapsed / 160);
        if (flashProgress < 1.0) {
          const alpha = (1 - flashProgress) * 0.6;
          this.ctx.fillStyle = `rgba(244, 67, 54, ${alpha})`;
          this.ctx.fillRect(screenX, screenY, ts, ts);
          this.ctx.strokeStyle = `rgba(255, 23, 68, ${1 - flashProgress})`;
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(screenX, screenY, ts, ts);
        }

        // 🔢 ダメージ数値ポップアップ（上方向へ浮遊しながらフェードアウト）
        if (fx.amount !== undefined && fx.amount > 0) {
          const textAlpha = Math.max(0, 1 - progress);
          const floatY = -easeOut * (ts * 0.75);
          const textX = screenX + ts / 2;
          const textY = screenY + (ts * 0.25) + floatY;

          this.ctx.save();
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          const fontSize = Math.max(12, Math.round(ts * 0.45));
          this.ctx.font = `bold ${fontSize}px monospace, sans-serif`;

          const text = `-${fx.amount}`;
          this.ctx.strokeStyle = `rgba(0, 0, 0, ${textAlpha * 0.9})`;
          this.ctx.lineWidth = 3;
          this.ctx.strokeText(text, textX, textY);

          this.ctx.fillStyle = `rgba(255, 68, 68, ${textAlpha})`;
          this.ctx.fillText(text, textX, textY);
          this.ctx.restore();
        }
      } else if (fx.type === 'KILL_BURST') {
        // 💀 撃破消滅バースト
        const alpha = 1 - progress;
        const radius = (ts * 0.5) * (0.3 + easeOut * 0.7);
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2;

        this.ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#ff9100';
        this.ctx.shadowBlur = 8;

        this.ctx.beginPath();
        this.ctx.moveTo(cx - radius, cy);
        this.ctx.lineTo(cx + radius, cy);
        this.ctx.moveTo(cx, cy - radius);
        this.ctx.lineTo(cx, cy + radius);
        this.ctx.stroke();

        this.ctx.fillStyle = `rgba(255, 235, 59, ${alpha})`;
        const d = radius * 0.7;
        const pSize = Math.max(1, 3 * (1 - progress));
        this.ctx.fillRect(cx - d, cy - d, pSize, pSize);
        this.ctx.fillRect(cx + d, cy - d, pSize, pSize);
        this.ctx.fillRect(cx - d, cy + d, pSize, pSize);
        this.ctx.fillRect(cx + d, cy + d, pSize, pSize);
      } else if (fx.type === 'HEAL_RING') {
        // 💚 回復リング
        const ringProgress = Math.min(1.0, elapsed / 250);
        const ringEaseOut = 1 - Math.pow(1 - ringProgress, 2);
        const alpha = 1 - ringProgress;
        const liftY = -ringEaseOut * 12;
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2 + liftY;
        const r = 4 + ringEaseOut * 10;

        if (ringProgress < 1.0) {
          this.ctx.strokeStyle = `rgba(0, 230, 118, ${alpha})`;
          this.ctx.lineWidth = 2;
          this.ctx.shadowColor = '#69f0ae';
          this.ctx.shadowBlur = 6;
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
          this.ctx.stroke();
        }

        // 🔢 回復数値ポップアップ（緑色）
        if (fx.amount !== undefined && fx.amount > 0) {
          const textAlpha = Math.max(0, 1 - progress);
          const floatY = -easeOut * (ts * 0.75);
          const textX = screenX + ts / 2;
          const textY = screenY + (ts * 0.25) + floatY;

          this.ctx.save();
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          const fontSize = Math.max(12, Math.round(ts * 0.45));
          this.ctx.font = `bold ${fontSize}px monospace, sans-serif`;

          const text = `+${fx.amount}`;
          this.ctx.strokeStyle = `rgba(0, 0, 0, ${textAlpha * 0.9})`;
          this.ctx.lineWidth = 3;
          this.ctx.strokeText(text, textX, textY);

          this.ctx.fillStyle = `rgba(0, 230, 118, ${textAlpha})`;
          this.ctx.fillText(text, textX, textY);
          this.ctx.restore();
        }
      } else if (fx.type === 'DEATH_BURST') {
        // 🪦 死亡エフェクト
        const alpha = Math.max(0, 1 - progress);
        const radius = (ts * 0.8) * (0.2 + easeOut * 1.2);
        const cx = screenX + ts / 2;
        const cy = screenY + ts / 2;

        this.ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * 0.9})`;
        this.ctx.lineWidth = 3 * (1 - progress * 0.5);
        this.ctx.shadowColor = '#dc2626';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
      return true;
    });
  }

  drawTile(glyphId, cols, tileMap, dx, dy, animY = 0) {
    if (this.virtualScreen) {
      this.virtualScreen.drawTile(this.ctx, glyphId, dx, dy, this.tileSize, this.tileSize, animY, () => tileMap);
      return;
    }

    if (this.tileLoaded && this.tileImg && this.tileImg.naturalWidth > 0) {
      const tileIndex = tileMap[glyphId] !== undefined ? tileMap[glyphId] : 0;
      const imgCols = Math.floor(this.tileImg.width / 32) || cols;
      const sx = (tileIndex % imgCols) * 32;
      const sy = Math.floor(tileIndex / imgCols) * 32;
      this.ctx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy + animY, this.tileSize, this.tileSize);
    } else {
      this.ctx.fillStyle = glyphId === 0 ? '#00e676' : '#ffd740';
      this.ctx.fillRect(dx + 4, dy + 4 + animY, 24, 24);
    }
  }

  /**
   * クライアント画面座標 (clientX, clientY) からダンジョンタイル座標 (gx, gy) を逆算
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ gx: number, gy: number } | null}
   */
  screenToGrid(clientX, clientY) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    const ts = this.tileSize || 32;
    const bgTotalW = this.virtualScreen?.width || (80 * ts);
    const bgTotalH = this.virtualScreen?.height || (24 * ts);
    const cameraPixelX = this.camX * ts + ts / 2;
    const cameraPixelY = this.camY * ts + ts / 2;

    const srcW = Math.min(bgTotalW, this.canvas.width);
    const srcH = Math.min(bgTotalH, this.canvas.height);

    const srcX = Math.max(0, Math.min(bgTotalW - srcW, cameraPixelX - srcW / 2));
    const srcY = Math.max(0, Math.min(bgTotalH - srcH, cameraPixelY - srcH / 2));

    const dstX = (this.canvas.width > bgTotalW) ? Math.floor((this.canvas.width - bgTotalW) / 2) : 0;
    const dstY = (this.canvas.height > bgTotalH) ? Math.floor((this.canvas.height - bgTotalH) / 2) : 0;

    const gx = Math.floor((canvasX - dstX + srcX) / ts);
    const gy = Math.floor((canvasY - dstY + srcY) / ts);

    if (gx >= 0 && gx < 80 && gy >= 0 && gy < 24) {
      return { gx, gy };
    }
    return null;
  }

  /**
   * ダンジョンタイル座標 (gx, gy) から Canvas のクライアント画面座標 (clientX, clientY) を計算
   * @param {number} gx
   * @param {number} gy
   * @returns {{ clientX: number, clientY: number } | null}
   */
  gridToScreen(gx, gy) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const ts = this.tileSize || 32;
    const bgTotalW = this.virtualScreen?.width || (80 * ts);
    const bgTotalH = this.virtualScreen?.height || (24 * ts);
    const cameraPixelX = this.camX * ts + ts / 2;
    const cameraPixelY = this.camY * ts + ts / 2;

    const srcW = Math.min(bgTotalW, this.canvas.width);
    const srcH = Math.min(bgTotalH, this.canvas.height);

    const srcX = Math.max(0, Math.min(bgTotalW - srcW, cameraPixelX - srcW / 2));
    const srcY = Math.max(0, Math.min(bgTotalH - srcH, cameraPixelY - srcH / 2));

    const dstX = (this.canvas.width > bgTotalW) ? Math.floor((this.canvas.width - bgTotalW) / 2) : 0;
    const dstY = (this.canvas.height > bgTotalH) ? Math.floor((this.canvas.height - bgTotalH) / 2) : 0;

    const canvasX = Math.round(gx * ts - srcX + dstX + ts / 2);
    const canvasY = Math.round(gy * ts - srcY + dstY + ts / 2);

    const clientX = rect.left + canvasX * (rect.width / this.canvas.width);
    const clientY = rect.top + canvasY * (rect.height / this.canvas.height);

    return { clientX, clientY };
  }
}
