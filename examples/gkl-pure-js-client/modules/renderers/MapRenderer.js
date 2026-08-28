/**
 * MapRenderer - メインCanvas (Graphic Canvas) & ASCII Grid の描画マネージャー
 */
export class MapRenderer {
  constructor({ canvas, asciiGrid, btnToggleView, getAreaGrid }) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.asciiGrid = asciiGrid;
    this.btnToggleView = btnToggleView;
    this.getAreaGrid = getAreaGrid || (() => null);

    this.isGraphicCanvasMode = true;
    this.currentLanguage = 'ja';

    // 80x24 Buffers
    this.asciiGridBuffer = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => ({ ch: ' ', color: 7 })));
    this.glyphGridBuffer = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));

    this.targetCursorX = -1;
    this.targetCursorY = -1;
    this.isPlayerDead = false;
    this.deathPosition = null;

    // Multi-path Sprite Tile Image Loader (Main: Opaque)
    this.tileImg = new Image();
    this.tileLoaded = false;
    this.loadedTileImagePath = null;
  }

  init() {
    this.initAsciiGridDom();
    this.initTileImageWithFallback([
      '../../pict/nethack_default_32.png',
      '../../assets/nethack_default_32.png',
      'pict/nethack_default_32.png',
      'assets/nethack_default_32.png',
      '/pict/nethack_default_32.png',
      '/assets/nethack_default_32.png'
    ], (p) => {
      this.tileImg.src = p;
      this.loadedTileImagePath = p;
      this.tileLoaded = true;
      this.redrawAllGraphicTiles();
    });
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this.updateViewButtonText();
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

  initTileImageWithFallback(paths, onSuccess) {
    let index = 0;
    const tryNext = () => {
      if (index >= paths.length) {
        console.warn("[GKL PureJS] Tile paths failed for:", paths[0]);
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

  updateViewButtonText() {
    if (!this.btnToggleView) return;
    const isEn = this.currentLanguage === 'en';
    const prefix = isEn ? 'Toggle View: ' : 'ビュー切替: ';
    if (this.isGraphicCanvasMode) {
      this.btnToggleView.textContent = prefix + '🎨 Graphic Canvas';
    } else {
      this.btnToggleView.textContent = prefix + '🔤 Color ASCII Grid';
    }
  }

  switchViewMode(graphicCanvasMode) {
    this.isGraphicCanvasMode = graphicCanvasMode;
    if (this.isGraphicCanvasMode) {
      this.canvas.classList.remove('hidden');
      this.asciiGrid.classList.add('hidden');
      this.updateViewButtonText();
      this.redrawAllGraphicTiles();
    } else {
      this.canvas.classList.add('hidden');
      this.asciiGrid.classList.remove('hidden');
      this.updateViewButtonText();
      this.renderColorAsciiMap();
    }
  }

  renderColorAsciiMap() {
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

  // 3層グラフィック描画 ＋ 上下浮遊バウンスアニメーション
  redrawAllGraphicTiles() {
    if (!this.isGraphicCanvasMode || !this.tileLoaded || this.tileImg.naturalWidth === 0 || !this.ctx) return;
    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
    const cols = Math.floor(this.tileImg.width / 32);

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // キビキビとした上方向バウンス (周期約0.5秒, 0〜-3px)
    const bounceY = -Math.round(Math.abs(Math.sin(Date.now() / 160)) * 3);
    const areaGrid = this.getAreaGrid();

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const dx = x * 16;
        const dy = y * 14;

        if (areaGrid && areaGrid[y] && areaGrid[y][x]) {
          const cell = areaGrid[y][x];
          
          // Layer 1 (Bottom)
          const gData = this.glyphGridBuffer[y][x];
          const hasNetHackGlyph = gData && gData.glyph >= 0 && gData.ch !== ' ';
          if (cell.bottom && cell.bottom.rawGlyph >= 0 && (!cell.bottom.isCachedPreload || hasNetHackGlyph)) {
            this.drawTileGlyph(cell.bottom.rawGlyph, cols, tileMap, dx, dy, 0);
          }
          // Layer 2 (Middle - 透過重ね描き)
          if (cell.middle && cell.middle.rawGlyph >= 0) {
            this.drawTileGlyph(cell.middle.rawGlyph, cols, tileMap, dx, dy, 0);
          }
          // Layer 3 (Top - 透過 + バウンスアニメ)
          if (cell.top && cell.top.rawGlyph >= 0) {
            this.drawTileGlyph(cell.top.rawGlyph, cols, tileMap, dx, dy, bounceY);
          } else if (!cell.bottom && !cell.middle) {
            const gData = this.glyphGridBuffer[y][x];
            if (gData && gData.glyph >= 0) {
              this.drawTileGlyph(gData.glyph, cols, tileMap, dx, dy, 0);
            }
          }

          // Layer 4 (Effect - 稲妻・ビーム・爆発等)
          if (cell.effect && cell.effect.rawGlyph >= 0) {
            this.drawTileGlyph(cell.effect.rawGlyph, cols, tileMap, dx, dy, 0);
          }
        } else {
          const gData = this.glyphGridBuffer[y][x];
          if (gData && gData.glyph >= 0) {
            this.drawTileGlyph(gData.glyph, cols, tileMap, dx, dy, 0);
          }
        }
      }
    }
  }

  drawTileGlyph(glyphId, cols, tileMap, dx, dy, animY = 0) {
    if (!this.ctx) return;
    const tileIndex = tileMap[glyphId] !== undefined ? tileMap[glyphId] : 0;
    const sx = (tileIndex % cols) * 32;
    const sy = Math.floor(tileIndex / cols) * 32;
    this.ctx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy + animY, 16, 14);
  }

  redrawSingleCell(x, y) {
    if (x < 0 || x >= 80 || y < 0 || y >= 24) return;
    const gData = this.glyphGridBuffer[y][x];
    const dx = x * 16;
    const dy = y * 14;

    const isDeathPos = this.isPlayerDead && this.deathPosition && this.deathPosition.x === x && this.deathPosition.y === y;

    if (this.isGraphicCanvasMode) {
      if (!this.ctx) return;
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(dx, dy, 16, 14);

      if (isDeathPos && this.tileLoaded && this.tileImg.naturalWidth > 0) {
        // 🪦 死亡位置には墓石タイル (glyph: 4011 / tile: 1310)
        const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
        const tileIndex = tileMap[4011] !== undefined ? tileMap[4011] : 1310;
        const cols = Math.floor(this.tileImg.width / 32);
        const sx = (tileIndex % cols) * 32;
        const sy = Math.floor(tileIndex / cols) * 32;
        this.ctx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy, 16, 14);
      } else if (gData && gData.glyph >= 0 && this.tileLoaded && this.tileImg.naturalWidth > 0) {
        const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
        const tileIndex = tileMap[gData.glyph] !== undefined ? tileMap[gData.glyph] : 0;
        const cols = Math.floor(this.tileImg.width / 32);
        const sx = (tileIndex % cols) * 32;
        const sy = Math.floor(tileIndex / cols) * 32;
        this.ctx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy, 16, 14);
      }

      if (x === this.targetCursorX && y === this.targetCursorY) {
        this.ctx.strokeStyle = isDeathPos ? '#ef4444' : '#ffd700';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(dx + 0.5, dy + 0.5, 15, 13);
      }
    } else {
      const cellData = this.asciiGridBuffer[y][x];
      const cellSpan = document.getElementById(`ascii-cell-${x}-${y}`);
      if (cellSpan) {
        cellSpan.textContent = isDeathPos ? '|' : (cellData.ch || ' ');
        const isCursorCell = (x === this.targetCursorX && y === this.targetCursorY);
        cellSpan.className = `ascii-cell clr-${isDeathPos ? 15 : (cellData.color !== undefined ? cellData.color : 7)} ${isCursorCell ? 'is-cursor' : ''}`;
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
    if (this.isGraphicCanvasMode) {
      if (this.ctx) {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else {
      this.renderColorAsciiMap();
    }
  }
}
