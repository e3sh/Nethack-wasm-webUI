/**
 * MinimapHudRenderer.js
 * フロア全体 80x24 のミニマップ HUD レンダラー
 * - VirtualDungeonScreen.bgCanvas を 1 回の drawImage で縮小転送
 * - プレイヤー現在地（発光ドット）、モンスター（赤ドット）、階段・店舗などのランドマークピン留めオーバーレイ
 * - [Tab] キーまたはクリックによる中央半透明拡大（マキシマイズ）トグル
 */

export class MinimapHudRenderer {
  constructor({
    minimapCanvas,
    minimapHudBox,
    minimapPosBadge,
    btnToggleMinimap,
    virtualScreen = null,
    getSituation = null,
    getCore = null
  } = {}) {
    this.canvas = minimapCanvas;
    this.ctx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
    this.hudBox = minimapHudBox;
    this.posBadge = minimapPosBadge;
    this.btnToggleMinimap = btnToggleMinimap;
    this.virtualScreen = virtualScreen;
    this.getSituation = getSituation || (() => null);
    this.getCore = getCore || (() => null);

    this.isMaximized = false;
    this.isVisible = true;
    this.currentLanguage = 'ja';

    // 解像度設定 (通常: 240x72, 最大化時: 720x216)
    this.normalWidth = 240;
    this.normalHeight = 72;
    this.maximizedWidth = 720;
    this.maximizedHeight = 216;

    this.targetCursorX = -1;
    this.targetCursorY = -1;

    this.initEvents();
  }

  initEvents() {
    if (this.btnToggleMinimap) {
      this.btnToggleMinimap.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMaximize();
      });
    }

    if (this.hudBox) {
      this.hudBox.addEventListener('click', (e) => {
        // ボタン以外のクリックでも最大化トグル可能
        if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
          this.toggleMaximize();
        }
      });
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this.updateButtonText();
  }

  updateButtonText() {
    if (!this.btnToggleMinimap) return;
    const isEn = this.currentLanguage === 'en';
    if (this.isMaximized) {
      this.btnToggleMinimap.textContent = '✕';
      this.btnToggleMinimap.title = isEn ? 'Close Map [Tab / Esc]' : 'マップを閉じる [Tab / Esc]';
    } else {
      this.btnToggleMinimap.textContent = '⛶';
      this.btnToggleMinimap.title = isEn ? 'Expand Map [Tab]' : 'マップを最大化 [Tab]';
    }
  }

  toggleMaximize(force) {
    this.isMaximized = (force !== undefined) ? force : !this.isMaximized;

    if (this.hudBox) {
      if (this.isMaximized) {
        this.hudBox.classList.add('maximized');
      } else {
        this.hudBox.classList.remove('maximized');
      }
    }

    if (this.canvas) {
      const targetW = this.isMaximized ? this.maximizedWidth : this.normalWidth;
      const targetH = this.isMaximized ? this.maximizedHeight : this.normalHeight;
      if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
        this.canvas.width = targetW;
        this.canvas.height = targetH;
      }
    }

    this.updateButtonText();
    const situation = this.getSituation();
    this.renderMinimap(situation);
  }

  toggleVisibility(enabled) {
    this.isVisible = (enabled !== undefined) ? enabled : !this.isVisible;
    if (this.hudBox) {
      if (this.isVisible) {
        this.hudBox.classList.remove('hidden');
      } else {
        this.hudBox.classList.add('hidden');
      }
    }
  }

  /**
   * ミニマップ描画メインループ
   */
  renderMinimap(situation = null) {
    if (!this.isVisible || !this.ctx || !this.canvas) return;

    const sit = situation || this.getSituation();
    const areaState = sit?.area;
    const playerX = (areaState && typeof areaState.playerX === 'number')
      ? areaState.playerX
      : (areaState?.playerLocation?.x ?? 0);
    const playerY = (areaState && typeof areaState.playerY === 'number')
      ? areaState.playerY
      : (areaState?.playerLocation?.y ?? 0);

    // 座標バッジ更新
    if (this.posBadge) {
      this.posBadge.textContent = `@ (${playerX},${playerY})`;
    }

    // 🏃‍♂️ 自キャラがミニマップの裏に隠れないよう自動退避・ゴースト判定
    this.updateSmartDocking(playerX, playerY);

    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    // 1. 背景クリア
    ctx.fillStyle = '#05070e';
    ctx.fillRect(0, 0, w, h);

    // 2. VirtualDungeonScreen.bgCanvas (2560x768) 全体を 1 回の drawImage で縮小転送
    if (this.virtualScreen && this.virtualScreen.bgCanvas) {
      if (this.virtualScreen.dirtyCells && this.virtualScreen.dirtyCells.size > 0 && areaState?.grid) {
        const glyphGrid = this.getCore()?.gkl?.areaStateManager?.glyphGridBuffer;
        this.virtualScreen.flushDirtyCells(areaState.grid, glyphGrid);
      }
      const bgW = this.virtualScreen.width || (80 * 32);
      const bgH = this.virtualScreen.height || (24 * 32);
      ctx.drawImage(this.virtualScreen.bgCanvas, 0, 0, bgW, bgH, 0, 0, w, h);
    }

    const scaleX = w / 80;
    const scaleY = h / 24;

    // 3. ランドマークのピン留めオーバーレイ (階段・店舗・祭壇など)
    const landmarks = sit?.landmarks || (this.getCore()?.gkl?.areaStateManager?.getFloorLandmarks?.());
    if (landmarks) {
      this.renderLandmarks(ctx, landmarks, scaleX, scaleY);
    }

    // 4. モンスター位置オーバーレイ (赤ドット)
    if (areaState) {
      this.renderMonsters(ctx, areaState, scaleX, scaleY);
    }

    // 5. ターゲットカーソル枠
    if (this.targetCursorX >= 0 && this.targetCursorY >= 0) {
      const cx = (this.targetCursorX + 0.5) * scaleX;
      const cy = (this.targetCursorY + 0.5) * scaleY;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = this.isMaximized ? 2 : 1.5;
      const boxSize = Math.max(scaleX, scaleY) * 1.4;
      ctx.strokeRect(cx - boxSize / 2, cy - boxSize / 2, boxSize, boxSize);
    }

    // 6. プレイヤー現在地 (光るグリーンドット ＋ パルスアニメーション)
    const px = (playerX + 0.5) * scaleX;
    const py = (playerY + 0.5) * scaleY;
    const dotRadius = this.isMaximized ? 4 : 2.5;

    // パルス円環
    const pulsePhase = (Date.now() % 1200) / 1200; // 0..1
    const pulseRadius = dotRadius + pulsePhase * (this.isMaximized ? 6 : 4);
    const pulseAlpha = Math.max(0, 1 - pulsePhase);
    ctx.strokeStyle = `rgba(0, 255, 102, ${pulseAlpha * 0.8})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // プレイヤーコア
    ctx.fillStyle = '#00ff66';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = this.isMaximized ? 8 : 4;
    ctx.beginPath();
    ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // リセット
  }

  /**
   * ランドマークのピン留め描画
   */
  renderLandmarks(ctx, landmarks, scaleX, scaleY) {
    const list = landmarks.all || [];
    const iconSize = this.isMaximized ? 6 : 3.5;

    for (const lm of list) {
      if (typeof lm.x !== 'number' || typeof lm.y !== 'number') continue;
      const lx = (lm.x + 0.5) * scaleX;
      const ly = (lm.y + 0.5) * scaleY;

      ctx.save();
      switch (lm.type) {
        case 'STAIR_UP':
          // 上り階段: 水色の上向き三角 (<)
          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx, ly - iconSize);
          ctx.lineTo(lx - iconSize, ly + iconSize * 0.8);
          ctx.lineTo(lx + iconSize, ly + iconSize * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;

        case 'STAIR_DOWN':
          // 下り階段: 黄金の下向き三角 (>)
          ctx.fillStyle = '#fbbf24';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx, ly + iconSize);
          ctx.lineTo(lx - iconSize, ly - iconSize * 0.8);
          ctx.lineTo(lx + iconSize, ly - iconSize * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;

        case 'ALTAR':
          // 祭壇: 紫のひし形
          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.moveTo(lx, ly - iconSize);
          ctx.lineTo(lx + iconSize, ly);
          ctx.lineTo(lx, ly + iconSize);
          ctx.lineTo(lx - iconSize, ly);
          ctx.closePath();
          ctx.fill();
          break;

        case 'SHOP':
          // 店舗: 緑色の四角
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(lx - iconSize * 0.8, ly - iconSize * 0.8, iconSize * 1.6, iconSize * 1.6);
          break;

        case 'FOUNTAIN':
        case 'SINK':
          // 泉・流し台: シアン色の円
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(lx, ly, iconSize * 0.7, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'THRONE':
          // 玉座: 琥珀色の星/円
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(lx, ly, iconSize * 0.8, 0, Math.PI * 2);
          ctx.fill();
          break;

        default:
          break;
      }
      ctx.restore();
    }
  }

  /**
   * モンスターの赤ドット描画
   */
  renderMonsters(ctx, areaState, scaleX, scaleY) {
    const monsters = areaState.perceivedMonsters || areaState.adjacentMonsters || [];
    const r = this.isMaximized ? 2.5 : 1.5;

    ctx.fillStyle = '#ef4444';
    for (const m of monsters) {
      const mx = (typeof m.x === 'number') ? m.x : m.location?.x;
      const my = (typeof m.y === 'number') ? m.y : m.location?.y;
      if (typeof mx === 'number' && typeof my === 'number') {
        const sx = (mx + 0.5) * scaleX;
        const sy = (my + 0.5) * scaleY;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 🏃‍♂️ 自キャラやカーソルがミニマップの裏に隠れるのを防ぐスマート退避＆ゴースト化
   * プレイヤーが画面右端・右上に接近した場合は左上へ自動退避し、重なった場合は半透明化
   */
  updateSmartDocking(playerX, playerY) {
    if (!this.hudBox || this.isMaximized) {
      if (this.hudBox) {
        this.hudBox.classList.remove('dock-left');
        this.hudBox.classList.remove('is-ghosted');
      }
      return;
    }

    const ts = 32;
    const canvasW = 720;
    const canvasH = 288;
    const bgW = this.virtualScreen?.width || 2560;
    const bgH = this.virtualScreen?.height || 768;

    // メインカメラの切り出し基準座標 (即時追従準拠)
    const cx = playerX * ts + ts / 2;
    const cy = playerY * ts + ts / 2;
    const srcX = Math.max(0, Math.min(bgW - canvasW, cx - canvasW / 2));
    const srcY = Math.max(0, Math.min(bgH - canvasH, cy - canvasH / 2));

    // 自キャラのメイン画面内ピクセル座標
    const screenX = playerX * ts - srcX;
    const screenY = playerY * ts - srcY;

    // プレイヤーが画面右端・右上エリア (x >= canvasW - 270 && y <= 120) に侵入した場合は左上へ自動退避
    const isPlayerInTopRight = (screenX >= (canvasW - 270) && screenY <= 120);

    if (isPlayerInTopRight) {
      this.hudBox.classList.add('dock-left');
    } else {
      this.hudBox.classList.remove('dock-left');
    }

    // どちらのドッキング位置でも、万が一自キャラまたはカーソルが直下に位置する場合はゴースト化
    const currentIsLeft = this.hudBox.classList.contains('dock-left');
    const isUnderMinimap = currentIsLeft
      ? (screenX <= 260 && screenY <= 100)
      : (screenX >= (canvasW - 260) && screenY <= 100);

    if (isUnderMinimap) {
      this.hudBox.classList.add('is-ghosted');
    } else {
      this.hudBox.classList.remove('is-ghosted');
    }
  }
}
