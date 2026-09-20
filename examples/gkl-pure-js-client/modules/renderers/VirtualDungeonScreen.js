/**
 * VirtualDungeonScreen.js
 * 80x24 マス (2560x768px) の完全な仮想ダンジョン背景管理 ＆ 共通タイル描画エンジン
 */

export class VirtualDungeonScreen {
  constructor({ tileSize = 32, cols = 80, rows = 24, tileImg = null, tileLoaded = false } = {}) {
    this.tileSize = tileSize;
    this.cols = cols;
    this.rows = rows;
    this.width = cols * tileSize;   // 2560px
    this.height = rows * tileSize;  // 768px

    // 2560 x 768px オフスクリーン Canvas
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.bgCanvas = document.createElement('canvas');
      this.bgCanvas.width = this.width;
      this.bgCanvas.height = this.height;
      this.bgCtx = this.bgCanvas.getContext('2d');
    } else {
      // Node.js / テスト環境用モックフォールバック
      this.bgCanvas = { width: this.width, height: this.height };
      this.bgCtx = null;
    }

    this.dirtyCells = new Set();
    this.tileImg = tileImg || (typeof Image !== 'undefined' ? new Image() : null);
    this.tileLoaded = Boolean(tileLoaded);
    this.loadedTileImagePath = null;
  }

  /**
   * 画像パスフォールバック試行付きローダー
   */
  initTileImageWithFallback(paths, onSuccess) {
    if (!this.tileImg) return;
    let index = 0;
    const tryNext = () => {
      if (index >= paths.length) {
        console.warn("[VirtualDungeonScreen] Tile paths failed for:", paths[0]);
        return;
      }
      const p = paths[index++];
      const testImg = (typeof Image !== 'undefined') ? new Image() : null;
      if (!testImg) return;
      testImg.onload = () => {
        this.tileImg.src = p;
        this.loadedTileImagePath = p;
        this.tileLoaded = true;
        this.markAllDirty();
        if (typeof onSuccess === 'function') {
          onSuccess(p);
        }
      };
      testImg.onerror = tryNext;
      testImg.src = p;
    };
    tryNext();
  }

  /**
   * 単一マスの差分更新フラグを付与
   */
  markDirty(x, y) {
    if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
      this.dirtyCells.add(`${x},${y}`);
    }
  }

  /**
   * 複数マスの差分更新フラグを一括付与
   */
  markCellsDirty(cellKeys) {
    if (!cellKeys) return;
    for (const key of cellKeys) {
      this.dirtyCells.add(key);
    }
  }

  /**
   * 全 80x24 マスの差分更新フラグを一括付与
   */
  markAllDirty() {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.dirtyCells.add(`${x},${y}`);
      }
    }
  }

  /**
   * 背景 Canvas を完全クリアし、全マスを dirty にする
   */
  clearScreen() {
    if (this.bgCtx) {
      this.bgCtx.fillStyle = '#000000';
      this.bgCtx.fillRect(0, 0, this.width, this.height);
    }
    this.dirtyCells.clear();
    this.markAllDirty();
  }

  /**
   * 共通タイル描画メソッド
   * 各種 Canvas コンテキストに対して、glyphId のスプライトを指定位置・指定サイズで描画
   */
  drawTile(ctx, glyphId, dx, dy, w = 32, h = 32, animY = 0, tileMapFn = null) {
    if (!ctx) return;
    const tileMap = typeof tileMapFn === 'function' ? tileMapFn() : (typeof tileMapping === 'function' ? tileMapping() : []);
    const tileIndex = (glyphId >= 0 && tileMap[glyphId] !== undefined) ? tileMap[glyphId] : 0;
    const imgWidth = (this.tileImg && this.tileImg.naturalWidth > 0) ? this.tileImg.naturalWidth : (this.tileImg?.width || 1280);
    const colsInAtlas = Math.floor(imgWidth / 32) || 40;

    if (this.tileLoaded && this.tileImg && (this.tileImg.naturalWidth > 0 || this.tileImg.width > 0)) {
      const sx = (tileIndex % colsInAtlas) * 32;
      const sy = Math.floor(tileIndex / colsInAtlas) * 32;
      ctx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy + animY, w, h);
    } else {
      // タイル未ロード時のフォールバック
      ctx.fillStyle = glyphId === 0 ? '#00e676' : '#ffd740';
      ctx.fillRect(dx + 2, dy + 2 + animY, Math.max(2, w - 4), Math.max(2, h - 4));
    }
  }

  /**
   * 差分セルのみをピンポイントでオフスクリーン背景 Canvas に再描画
   * Layer 1: 地形 (Bottom) ＋ Layer 2: アイテム (Middle) を焼き込み
   */
  flushDirtyCells(areaGrid, glyphGridBuffer = null, tileMappingFn = null) {
    if (!this.bgCtx || this.dirtyCells.size === 0) return 0;

    const tileMap = typeof tileMappingFn === 'function' ? tileMappingFn() : (typeof tileMapping === 'function' ? tileMapping() : []);
    const ts = this.tileSize;
    let renderedCount = 0;

    for (const key of this.dirtyCells) {
      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      if (isNaN(x) || isNaN(y) || x < 0 || x >= this.cols || y < 0 || y >= this.rows) continue;

      const dx = x * ts;
      const dy = y * ts;

      // セル領域を背景黒でクリア
      this.bgCtx.fillStyle = '#000000';
      this.bgCtx.fillRect(dx, dy, ts, ts);

      const cell = areaGrid?.[y]?.[x];
      const gData = glyphGridBuffer?.[y]?.[x];

      if (cell) {
        const hasNetHackGlyph = gData && gData.glyph >= 0 && gData.ch !== ' ';
        // Layer 1: 地形 (Bottom)
        if (cell.bottom && cell.bottom.rawGlyph >= 0 && (!cell.bottom.isCachedPreload || hasNetHackGlyph)) {
          this.drawTile(this.bgCtx, cell.bottom.rawGlyph, dx, dy, ts, ts, 0, () => tileMap);
        } else if (!cell.bottom && !cell.middle && gData && gData.glyph >= 0) {
          // フォールバック
          this.drawTile(this.bgCtx, gData.glyph, dx, dy, ts, ts, 0, () => tileMap);
        }

        // Layer 2: アイテム (Middle - 透過重ね描き)
        if (cell.middle && cell.middle.rawGlyph >= 0) {
          this.drawTile(this.bgCtx, cell.middle.rawGlyph, dx, dy, ts, ts, 0, () => tileMap);
        }
      } else if (gData && gData.glyph >= 0) {
        this.drawTile(this.bgCtx, gData.glyph, dx, dy, ts, ts, 0, () => tileMap);
      }

      renderedCount++;
    }

    this.dirtyCells.clear();
    return renderedCount;
  }
}
