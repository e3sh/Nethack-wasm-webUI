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
  flushDirtyCells(areaGrid, glyphGridBuffer = null, tileMappingFn = null, px = null, py = null) {
    if (!this.bgCtx || this.dirtyCells.size === 0) return 0;

    const tileMap = typeof tileMappingFn === 'function' ? tileMappingFn() : (typeof tileMapping === 'function' ? tileMapping() : []);
    const ts = this.tileSize;
    let renderedCount = 0;

    let playerX = px;
    let playerY = py;
    if ((playerX == null || playerY == null || playerX < 0 || playerY < 0) && areaGrid) {
      outer: for (let r = 0; r < this.rows; r++) {
        const row = areaGrid[r];
        if (!row) continue;
        for (let c = 0; c < this.cols; c++) {
          if (row[c]?.top?.isPlayer) {
            playerX = c;
            playerY = r;
            break outer;
          }
        }
      }
    }

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
      const hasNetHackGlyph = Boolean(gData && gData.glyph >= 0 && gData.glyph < 9622 && gData.ch !== ' ');

      if (cell) {
        const isExploredBottom = Boolean(
          cell.bottom &&
          cell.bottom.type !== 'UNEXPLORED' &&
          cell.bottom.rawGlyph >= 0 &&
          cell.bottom.rawGlyph < 9622
        );
        const isObserved = Boolean(hasNetHackGlyph || cell.middle || cell.top);
        const hasMiddleItem = Boolean(cell.middle && cell.middle.rawGlyph >= 0 && cell.middle.rawGlyph < 9622);
        const inShadow = hasMiddleItem && isCellInShadow(areaGrid, x, y, playerX, playerY);

        // Layer 1: 地形 (Bottom)
        if (isExploredBottom && (!cell.bottom.isCachedPreload || isObserved)) {
          this.drawTile(this.bgCtx, cell.bottom.rawGlyph, dx, dy, ts, ts, 0, () => tileMap);
          if (inShadow) {
            // 個別暗所処理: 床は完全に真っ黒 (#000000) に塗りつぶす
            this.bgCtx.fillStyle = '#000000';
            this.bgCtx.fillRect(dx, dy, ts, ts);
          }
        } else if (inShadow) {
          // 下層の床が未探索でも、アイテムが影エリアにある場合は暗い床を補完描画した上で真っ黒に
          this.drawTile(this.bgCtx, 3993, dx, dy, ts, ts, 0, () => tileMap);
          this.bgCtx.fillStyle = '#000000';
          this.bgCtx.fillRect(dx, dy, ts, ts);
        } else if (!isExploredBottom && !cell.middle && hasNetHackGlyph) {
          // フォールバック
          this.drawTile(this.bgCtx, gData.glyph, dx, dy, ts, ts, 0, () => tileMap);
        }

        // Layer 2: アイテム (Middle - 透過重ね描き) - 床のみ黒塗りにし、上に乗るアイテムは暗くせず通常描画
        if (hasMiddleItem) {
          this.drawTile(this.bgCtx, cell.middle.rawGlyph, dx, dy, ts, ts, 0, () => tileMap);
        }
      } else if (hasNetHackGlyph) {
        this.drawTile(this.bgCtx, gData.glyph, dx, dy, ts, ts, 0, () => tileMap);
      }

      renderedCount++;
    }

    this.dirtyCells.clear();
    return renderedCount;
  }

  /**
   * Phase 4 (COMMIT): areaStateCommitted シグナル受信時に確定状態の差分セルを即時フラッシュ (Stage 8.3-B)
   * @param {Object} areaState - AreaStateManager.getAreaState() の戻り値
   * @param {Array<Array<Object>>} [glyphGridBuffer=null]
   * @param {Function} [tileMappingFn=null]
   * @param {Set<string>} [asmDirtyCells=null]
   * @param {number|null} [px=null]
   * @param {number|null} [py=null]
   * @returns {number} 再描画されたセル数
   */
  flushCommittedState(areaState, glyphGridBuffer = null, tileMappingFn = null, asmDirtyCells = null, px = null, py = null) {
    if (asmDirtyCells && asmDirtyCells.size > 0) {
      this.markCellsDirty(asmDirtyCells);
      if (typeof asmDirtyCells.clear === 'function') {
        asmDirtyCells.clear();
      }
    }
    const grid = areaState?.grid || areaState;
    const playerX = px ?? areaState?.playerX;
    const playerY = py ?? areaState?.playerY;
    return this.flushDirtyCells(grid, glyphGridBuffer, tileMappingFn, playerX, playerY);
  }
}

/**
 * 暗い部屋 (S_darkroom: 3993) に存在するアイテム・敵の局所的影判定
 * 廊下（通路）等での誤判定を防ぐため、S_darkroom: 3993 が自身または隣接に 2 個以上存在する場合のみ影エリアと判定する
 * @param {Array<Array<Object>>} areaGrid 
 * @param {number} x 
 * @param {number} y 
 * @param {number|null} [px=null] プレイヤーX座標
 * @param {number|null} [py=null] プレイヤーY座標
 * @param {number} [threshold=2] 必要とする S_darkroom (3993) の数 (デフォルト: 2個以上)
 * @returns {boolean}
 */
export function isCellInShadow(areaGrid, x, y, px = null, py = null, threshold = 2) {
  if (!areaGrid) return false;

  let playerX = px;
  let playerY = py;
  if ((playerX == null || playerY == null || playerX < 0 || playerY < 0) && areaGrid) {
    outer: for (let r = 0; r < 24; r++) {
      const row = areaGrid[r];
      if (!row) continue;
      for (let c = 0; c < 80; c++) {
        if (row[c]?.top?.isPlayer) {
          playerX = c;
          playerY = r;
          break outer;
        }
      }
    }
  }

  // プレイヤーの直近 (マンハッタン距離 1、直接照らされているマス) は除外 (通常描画)
  if (playerX != null && playerY != null && playerX >= 0 && playerY >= 0) {
    const dist = Math.abs(x - playerX) + Math.abs(y - playerY);
    if (dist <= 1) {
      return false;
    }
  }

  let darkRoomCount = 0;
  const targetCell = areaGrid[y]?.[x];
  if (targetCell?.bottom?.rawGlyph === 3993) {
    darkRoomCount++;
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || ny >= 24 || nx < 0 || nx >= 80) continue;

      const nCell = areaGrid[ny]?.[nx];
      if (nCell?.bottom?.rawGlyph === 3993) {
        darkRoomCount++;
      }
    }
  }

  return darkRoomCount >= threshold;
}

