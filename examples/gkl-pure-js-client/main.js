import { WebUICore } from '../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../src/driver/index.js';

class GklPureJSClient {
  constructor() {
    this.core = null;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.asciiGrid = document.getElementById('ascii-grid');
    this.btnToggleView = document.getElementById('btn-toggle-view');
    this.btnToggleZoom = document.getElementById('btn-toggle-zoom');
    
    // Zoom Viewport Elements
    this.zoomCanvas = document.getElementById('zoom-canvas');
    this.zoomCtx = this.zoomCanvas ? this.zoomCanvas.getContext('2d') : null;
    this.zoomViewportBox = document.getElementById('zoom-viewport-box');
    this.zoomPosBadge = document.getElementById('zoom-pos-badge');
    this.isZoomMode = true;
    
    // UI Elements
    this.elLoading = document.getElementById('loading-overlay');
    this.elSpinnerBox = document.getElementById('loading-spinner-box');
    this.elSelectorCard = document.getElementById('start-selector-card');
    this.elSaveName = document.getElementById('start-save-name');
    this.elMessageLog = document.getElementById('message-log');

    // Prompt Elements
    this.elPromptBar = document.getElementById('prompt-bar');
    this.elPromptText = document.getElementById('prompt-text');
    this.elInputControls = document.getElementById('input-controls');

    // Menu / Text Modal Elements
    this.elMenuModal = document.getElementById('menu-modal');
    this.elMenuTitle = document.getElementById('menu-title');
    this.elMenuItemsContainer = document.getElementById('menu-items-container');
    this.elBtnCancelMenu = document.getElementById('btn-cancel-menu');

    // Status & Gauge Elements
    this.elStName = document.getElementById('st-name');
    this.elStDlvl = document.getElementById('st-dlvl');
    this.elStHp = document.getElementById('st-hp');
    this.elStPw = document.getElementById('st-pw');
    this.elStAc = document.getElementById('st-ac');
    this.elStGold = document.getElementById('st-gold');
    this.elStCond = document.getElementById('st-cond');
    this.elHpBarFill = document.getElementById('hp-bar-fill');
    this.elMpBarFill = document.getElementById('mp-bar-fill');

    // GKL Elements
    this.elGklActionList = document.getElementById('gkl-action-list');
    this.elGklActionCount = document.getElementById('gkl-action-count');
    this.elGklDirectionPad = document.getElementById('gkl-direction-pad');
    this.elGklFilterLabel = document.getElementById('gkl-filter-label');
    this.elBtnDirReset = document.getElementById('btn-dir-reset');
    this.elGklInventoryGrid = document.getElementById('gkl-inventory-grid');
    this.elGklInvCount = document.getElementById('gkl-inv-count');
    this.elGklKnowledgeContent = document.getElementById('gkl-knowledge-content');
    this.elGklTooltip = document.getElementById('gkl-item-tooltip');
    this.elGklTtName = document.getElementById('gkl-tt-name');
    this.elGklTtTags = document.getElementById('gkl-tt-tags');

    // GKL 方向フィルター状態
    this.selectedDir = 'ALL';
    this.initDirectionPadEvents();

    // GameOver Modal
    this.elGameOverModal = document.getElementById('gameover-modal');
    this.elGameOverSummary = document.getElementById('gameover-summary');
    this.elScoreboardContainer = document.getElementById('gameover-scoreboard');

    // View & Rendering State
    this.isGraphicCanvasMode = true;
    this.isTextWindowMode = false;
    this.isGameExited = false;
    this.currentGameOverResult = null;

    this.activeMenuFocusIndex = 0;
    this.selectableMenuButtons = [];

    this.targetCursorX = -1;
    this.targetCursorY = -1;

    // 80x24 Buffers
    this.asciiGridBuffer = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => ({ ch: ' ', color: 7 })));
    this.glyphGridBuffer = Array.from({ length: 24 }, () => Array.from({ length: 80 }, () => null));

    // Multi-path Sprite Tile Image Loader
    this.tileImg = new Image();
    this.tileLoaded = false;
    this.initTileImageWithFallback([
      '../../pict/nethack_default_32.png',
      '../../assets/nethack_default_32.png',
      'pict/nethack_default_32.png',
      'assets/nethack_default_32.png',
      '/pict/nethack_default_32.png',
      '/assets/nethack_default_32.png'
    ]);

    this.init();
  }

  init() {
    this.initAsciiGridDom();
    this.initCore();
    this.bindDOMEvents();
    this.bootstrapGame();
    this.startGklRenderLoop();
  }

  initAsciiGridDom() {
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

  initTileImageWithFallback(paths) {
    let index = 0;
    const tryNext = () => {
      if (index >= paths.length) {
        console.warn("[GKL PureJS] All tile paths failed. Fallback active.");
        return;
      }
      const p = paths[index++];
      const testImg = new Image();
      testImg.onload = () => {
        this.tileImg.src = p;
        this.loadedTileImagePath = p;
        this.tileLoaded = true;
        this.redrawAllGraphicTiles();
      };
      testImg.onerror = tryNext;
      testImg.src = p;
    };
    tryNext();
  }

  switchViewMode(graphicCanvasMode) {
    this.isGraphicCanvasMode = graphicCanvasMode;
    if (this.isGraphicCanvasMode) {
      this.canvas.classList.remove('hidden');
      this.asciiGrid.classList.add('hidden');
      this.btnToggleView.textContent = 'ビュー切替: 🎨 Graphic Canvas';
      this.redrawAllGraphicTiles();
    } else {
      this.canvas.classList.add('hidden');
      this.asciiGrid.classList.remove('hidden');
      this.btnToggleView.textContent = 'ビュー切替: 🔤 Color ASCII Grid';
      this.renderColorAsciiMap();
    }
  }

  initCore() {
    const workerPath = '../../src/driver/nethack.worker.js';
    const bridge = new NetHackWasmWorkerBridge(workerPath);
    this.core = new WebUICore({ driver: bridge });

    this.bindCoreEvents();
  }

  bindCoreEvents() {
    // 1. State Change
    this.core.on('stateChange', ({ state }) => {
      if (state === 'INITIALIZING') {
        this.resetUiForNewGame();
        this.elLoading.classList.remove('hidden');
        this.elGameOverModal.classList.add('hidden');
      } else if (state === 'READY' || state === 'RUNNING' || state === 'WAITING_INPUT') {
        this.elLoading.classList.add('hidden');
        this.elGameOverModal.classList.add('hidden');
      }
    });

    // 2. Message Log
    this.core.on('message', (msg) => {
      if (this.isGameExited) return;
      this.addMessageLog(msg);
    });

    // 3. Status Update
    this.core.on('statusUpdate', ({ status }) => {
      if (!status) return;
      this.updateStatus(status);
    });

    // 4. Cursor Movement
    this.core.on('cursor', ({ x, y }) => {
      const prevX = this.targetCursorX;
      const prevY = this.targetCursorY;
      this.targetCursorX = x;
      this.targetCursorY = y;

      if (prevX >= 0 && prevY >= 0) this.redrawSingleCell(prevX, prevY);
      if (this.targetCursorX >= 0 && this.targetCursorY >= 0) {
        this.redrawSingleCell(this.targetCursorX, this.targetCursorY);
        // プレイヤーの現在位置を AreaStateManager に同期 (ターゲットカーソル移動中でないメインターン時のみ)
        if (this.core && this.core.gkl && this.core.gkl.areaStateManager) {
          if (!this.core.driver || typeof this.core.driver.canAcceptSequenceInterruption !== 'function' || this.core.driver.isTopLevelTurn) {
            this.core.gkl.areaStateManager.updatePlayerPosition(x, y);
          }
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.core = this.core;
      window.gkl = this.core.gkl;
    }

    // 5. Print Glyph (Map Update & GKL AreaStateManager 同期)
    this.core.on('print_glyph', ({ x, y, glyphInfo, glyph }) => {
      const gi = glyphInfo || {};
      const ch = gi.ch || ' ';
      const color = gi.color !== undefined ? gi.color : 7;
      const gId = (gi.glyph !== undefined && gi.glyph !== null) ? gi.glyph : (glyph !== undefined && glyph !== null ? glyph : -1);

      if (x >= 0 && x < 80 && y >= 0 && y < 24) {
        this.asciiGridBuffer[y][x] = { ch, color };
        this.glyphGridBuffer[y][x] = { glyph: gId, ch, color };
        this.redrawSingleCell(x, y);
      }

      // GKL の 3階層 AreaStateManager にグリフを即座に同期
      if (this.core && this.core.gkl && this.core.gkl.areaStateManager && gId >= 0) {
        this.core.gkl.areaStateManager.updateGlyph(x, y, gId, glyphInfo);
      }
    });

    // 6. Clear Window / Clear Map
    this.core.on('clear_nhwindow', ({ windowId }) => {
      if (windowId === 2 || windowId === 0) {
        this.clearMapGrid();
      }
    });

    this.core.on('map_cleared', () => {
      this.clearMapGrid();
    });

    // 7. Input Required Prompts & Modals
    this.core.on('inputRequired', (data) => {
      this.handleInputRequired(data);
    });

    // 8. Input Resolved
    this.core.on('inputResolved', () => {
      this.clearAllModals();
    });

    // 9. Game Over & Exited
    this.core.on('gameOver', (result) => {
      this.currentGameOverResult = result;
    });

    this.core.on('exited', async (data) => {
      this.handleExited(data);
    });
  }

  bindDOMEvents() {
    this.btnToggleView.onclick = () => {
      this.switchViewMode(!this.isGraphicCanvasMode);
    };

    if (this.btnToggleZoom) {
      this.btnToggleZoom.onclick = () => {
        this.isZoomMode = !this.isZoomMode;
        if (this.isZoomMode) {
          this.zoomViewportBox.classList.remove('hidden');
          this.btnToggleZoom.textContent = '🎯 ズームカメラ: ON';
        } else {
          this.zoomViewportBox.classList.add('hidden');
          this.btnToggleZoom.textContent = '🎯 ズームカメラ: OFF';
        }
      };
    }

    document.getElementById('btn-restart').onclick = () => this.restartGame();
    document.getElementById('btn-delete-save').onclick = () => this.deleteSaveFile();
    document.getElementById('btn-gameover-restart').onclick = () => this.restartGame();

    const btnRefreshInv = document.getElementById('btn-refresh-inv');
    if (btnRefreshInv) {
      btnRefreshInv.onclick = async () => {
        if (this.core && this.core.gkl && typeof this.core.gkl.syncInventorySilent === 'function') {
          btnRefreshInv.disabled = true;
          btnRefreshInv.textContent = '...';
          await this.core.gkl.syncInventorySilent();
          btnRefreshInv.disabled = false;
          btnRefreshInv.textContent = '🔄 同期';
        }
      };
    }

    // ツールチップ追従
    document.addEventListener('mousemove', (e) => {
      if (this.elGklTooltip && !this.elGklTooltip.classList.contains('hidden')) {
        this.elGklTooltip.style.left = (e.clientX + 14) + 'px';
        this.elGklTooltip.style.top = (e.clientY + 14) + 'px';
      }
    });

    // ズームカメラ (zoom-canvas) 内の受信連動 7x7 マス ホバーナレッジ表示 (Top -> Middle -> Bottom 優先順位)
    if (this.zoomCanvas) {
      this.zoomCanvas.addEventListener('mousemove', (e) => {
        const rect = this.zoomCanvas.getBoundingClientRect();
        const tileX = Math.floor(((e.clientX - rect.left) * (this.zoomCanvas.width / rect.width)) / 32);
        const tileY = Math.floor(((e.clientY - rect.top) * (this.zoomCanvas.height / rect.height)) / 32);

        const dx = tileX - 3;
        const dy = tileY - 3;

        // プレイヤー最新座標の安全取得 (AreaStateManager -> targetCursorX -> default)
        const asm = this.core?.gkl?.areaStateManager;
        const px = (asm && typeof asm.playerX === 'number') ? asm.playerX : (this.targetCursorX >= 0 ? this.targetCursorX : 0);
        const py = (asm && typeof asm.playerY === 'number') ? asm.playerY : (this.targetCursorY >= 0 ? this.targetCursorY : 0);

        const gx = px + dx;
        const gy = py + dy;

        if (gx >= 0 && gx < 80 && gy >= 0 && gy < 24) {
          const cell = asm?.grid?.[gy]?.[gx];
          // 優先順位: 1. Top (モンスター) -> 2. Middle (アイテム) -> 3. Bottom (地形)
          const targetEntity = cell?.top || cell?.middle || cell?.bottom;

          if (targetEntity) {
            const glyphId = (typeof targetEntity.glyph === 'number')
              ? targetEntity.glyph
              : (targetEntity.glyphInfo && typeof targetEntity.glyphInfo.glyph === 'number'
                  ? targetEntity.glyphInfo.glyph
                  : (typeof targetEntity.rawGlyph === 'number' ? targetEntity.rawGlyph : -1));
            if (glyphId >= 0) {
              this.renderKnowledgeCard(glyphId);
            } else {
              this.renderKnowledgeCard(targetEntity);
            }
          } else {
            const gData = this.glyphGridBuffer[gy] ? this.glyphGridBuffer[gy][gx] : null;
            if (gData && gData.glyph >= 0) {
              this.renderKnowledgeCard(gData.glyph);
            } else {
              this.renderKnowledgeCard(null);
            }
          }
        } else {
          this.renderKnowledgeCard(null);
        }
      });

      this.zoomCanvas.addEventListener('mouseleave', () => {
        this.renderKnowledgeCard(null);
      });
    }

    window.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e));
  }

  handleGlobalKeyDown(e) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    if (!this.elMenuModal.classList.contains('hidden') && this.isTextWindowMode) {
      if (['Space', 'Enter', 'Escape', 'KeyQ', 'Backspace'].includes(e.code) || e.key === ' ' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'q') {
        e.preventDefault();
        this.core.sendKey('Space');
        return;
      }
    }

    if (!this.elMenuModal.classList.contains('hidden') && !this.isTextWindowMode) {
      if (e.key === 'ArrowDown' || e.code === 'ArrowDown' || e.code === 'Numpad2') {
        e.preventDefault();
        if (this.selectableMenuButtons.length > 0) {
          this.activeMenuFocusIndex = (this.activeMenuFocusIndex + 1) % this.selectableMenuButtons.length;
          this.updateMenuFocus();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.code === 'ArrowUp' || e.code === 'Numpad8') {
        e.preventDefault();
        if (this.selectableMenuButtons.length > 0) {
          this.activeMenuFocusIndex = (this.activeMenuFocusIndex - 1 + this.selectableMenuButtons.length) % this.selectableMenuButtons.length;
          this.updateMenuFocus();
        }
        return;
      }

      if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        if (this.selectableMenuButtons[this.activeMenuFocusIndex]) {
          this.selectableMenuButtons[this.activeMenuFocusIndex].click();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === '0' || e.key === 'q' || e.code === 'Escape' || e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'KeyQ') {
        e.preventDefault();
        this.core.respond(0);
        return;
      }

      if (e.key && e.key.length === 1) {
        e.preventDefault();
        this.core.respond(e.key);
        return;
      }
    }

    if (e.code) {
      if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) return;
      this.core.sendKey(e.code, e.shiftKey, e.ctrlKey, e.altKey, e.key);
    }
  }

  async bootstrapGame() {
    try {
      const saveInfo = await this.core.detectSavedGameInfo();
      if (saveInfo.hasSave) {
        this.elSaveName.textContent = saveInfo.savePlayerName || 'Hero';
        this.elSpinnerBox.classList.add('hidden');
        this.elSelectorCard.classList.remove('hidden');

        document.getElementById('btn-start-resume').onclick = async () => {
          this.elSelectorCard.classList.add('hidden');
          this.elSpinnerBox.classList.remove('hidden');
          await this.core.start('nethack.js');
        };

        document.getElementById('btn-start-new').onclick = async () => {
          this.elSelectorCard.classList.add('hidden');
          this.elSpinnerBox.classList.remove('hidden');
          await this.core.start('nethack.js', { forceNewGame: true });
        };
      } else {
        await this.core.start('nethack.js');
      }
    } catch (e) {
      console.error("Core start error:", e);
    }
  }

  // =========================================================================
  // GKL (Game Knowledge Layer) リアルタイム同期 & UI レンダリング
  // =========================================================================

  /**
   * プレイヤーの移動 (位置座標・階層・ターン変化) を検知して方向フィルターを 'ALL' に自動リセット
   */
  checkPlayerMovementAndResetFilter(situation) {
    if (!situation) return;
    const area = situation.area;
    const status = situation.status;

    let posKey = '';

    // 1. area.playerLocation または area.center ({ x, y })
    if (area && (area.playerLocation || area.center)) {
      const p = area.playerLocation || area.center;
      posKey += `pos:${p.x},${p.y}`;
    }

    // 2. status ({ x, y, dlvl, turn })
    if (status) {
      if (status.x !== undefined && status.y !== undefined) {
        posKey += `_st:${status.x},${status.y}`;
      }
      if (status.dlvl !== undefined || status.dlevel !== undefined) {
        posKey += `_d:${status.dlvl || status.dlevel}`;
      }
      if (status.turn !== undefined || status.turns !== undefined) {
        posKey += `_t:${status.turn || status.turns}`;
      }
    }

    // 3. situation 直下の turn
    if (situation.turn !== undefined) {
      posKey += `_sit:${situation.turn}`;
    }

    if (posKey && this._lastPlayerPosKey && this._lastPlayerPosKey !== posKey) {
      // プレイヤーが移動またはターン進行したため、方向フィルターを 'ALL' に自動リセット
      if (this.selectedDir !== 'ALL') {
        this.selectedDir = 'ALL';
        this._lastActionHtml = null;
      }
    }

    if (posKey) {
      this._lastPlayerPosKey = posKey;
    }
  }

  startGklRenderLoop() {
    const loop = () => {
      if (this.core) {
        const situation = (this.core && this.core.gkl) ? this.core.gkl.getSituation() : {};

        // プレイヤー移動時の方向フィルター自動リセットチェック
        this.checkPlayerMovementAndResetFilter(situation);

        // 1. GKL 推奨アクションパネル
        this.renderGklActions(situation.actions || []);

        // 2. GKL アイコン型所持品インベントリ
        this.renderGklInventory(situation.inventory);

        // 3. 🎯 自キャラ周辺 拡大ズームカメラ描画
        if (this.isZoomMode && this.zoomCtx) {
          this.renderZoomCanvas(situation.area);
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  // 🎯 自キャラ周辺 拡大ズームカメラ描画 (7x7 マス, 32px タイル)
  renderZoomCanvas(areaState) {
    const areaMgr = (this.core && this.core.gkl) ? this.core.gkl.areaStateManager : null;
    if (!this.zoomCtx || !areaMgr) return;

    const grid = areaMgr.grid;
    const px = areaMgr.playerX || 0;
    const py = areaMgr.playerY || 0;
    const width = areaMgr.width || 80;
    const height = areaMgr.height || 21;

    if (this.zoomPosBadge) {
      this.zoomPosBadge.textContent = `@ (${px},${py})`;
    }

    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
    const cols = (this.tileImg && this.tileImg.width) ? Math.floor(this.tileImg.width / 32) : 40;

    const canvasW = this.zoomCanvas.width; // 224
    const canvasH = this.zoomCanvas.height; // 224
    const zoomTileSize = 32; // 拡大 32px タイル

    this.zoomCtx.fillStyle = '#090916';
    this.zoomCtx.fillRect(0, 0, canvasW, canvasH);

    // 7x7 マスを中心（3,3）に配置
    const halfRange = 3;
    const bounceY = Math.round(Math.sin(Date.now() / 180) * 2);

    for (let dy = -halfRange; dy <= halfRange; dy++) {
      for (let dx = -halfRange; dx <= halfRange; dx++) {
        const gx = px + dx;
        const gy = py + dy;

        const screenX = (dx + halfRange) * zoomTileSize;
        const screenY = (dy + halfRange) * zoomTileSize;

        if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
          const cell = grid[gy][gx];
          const gData = (this.glyphGridBuffer[gy] && this.glyphGridBuffer[gy][gx]) ? this.glyphGridBuffer[gy][gx] : null;

          // セルに一度でも記憶された地形/アイテム/エンティティ情報があるかチェック
          const hasMemory = cell && (cell.bottom || cell.middle || cell.top);

          if (!hasMemory && (!gData || gData.glyph < 0 || gData.ch === ' ')) {
            // 未探索マスはブラックアウト
            this.zoomCtx.fillStyle = '#000000';
            this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
          } else {
            if (cell && (cell.bottom || cell.middle || cell.top)) {
              // Layer 1: Bottom (現フロアで一度でも確認した壁・床・通路等の地形)
              if (cell.bottom && cell.bottom.rawGlyph >= 0) {
                this.drawZoomTile(cell.bottom.rawGlyph, cols, tileMap, screenX, screenY, 0);
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

              // Layer 3: Top (キャラクター/モンスター + バウンス)
              if (cell.top && cell.top.rawGlyph >= 0) {
                this.drawZoomTile(cell.top.rawGlyph, cols, tileMap, screenX, screenY, bounceY);
              }
            } else if (gData && gData.glyph >= 0 && gData.ch !== ' ') {
              this.drawZoomTile(gData.glyph, cols, tileMap, screenX, screenY, 0);
            } else {
              this.zoomCtx.fillStyle = '#000000';
              this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
            }
          }
        } else {
          // 範囲外ブラック
          this.zoomCtx.fillStyle = '#000000';
          this.zoomCtx.fillRect(screenX, screenY, zoomTileSize, zoomTileSize);
        }

        // 自キャラマスのネオン枠ハイライト
        if (dx === 0 && dy === 0) {
          this.zoomCtx.strokeStyle = '#00e676';
          this.zoomCtx.lineWidth = 2;
          this.zoomCtx.strokeRect(screenX + 1, screenY + 1 + bounceY, zoomTileSize - 2, zoomTileSize - 2);
        }
      }
    }
  }

  drawZoomTile(glyphId, cols, tileMap, dx, dy, animY = 0) {
    if (this.tileLoaded && this.tileImg.naturalWidth > 0) {
      const tileIndex = tileMap[glyphId] !== undefined ? tileMap[glyphId] : 0;
      const sx = (tileIndex % cols) * 32;
      const sy = Math.floor(tileIndex / cols) * 32;
      this.zoomCtx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy + animY, 32, 32);
    } else {
      this.zoomCtx.fillStyle = glyphId === 0 ? '#00e676' : '#ffd740';
      this.zoomCtx.fillRect(dx + 4, dy + 4 + animY, 24, 24);
    }
  }

  // =========================================================================
  // GKL 方向フィルターインジケーター (「囲」キーパッド) 関連処理
  // =========================================================================

  /**
   * 推奨アクションから正規の方向コード (N, NE, E, SE, S, SW, W, NW, SELF) を抽出
   * ※ コマンドキー(action.key)と混同しないよう、方向プロパティ(directionKey, direction, dirCode, target)のみを参照
   * @param {Object} action - 推奨アクションオブジェクト
   * @returns {string} 方向コード ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'SELF', または 'NONE')
   */
  extractDirectionCode(action) {
    if (!action) return 'NONE';

    // 1. directionKey プロパティ (例: 'DIR_N', 'DIR_NE', 'DIR_SELF')
    let rawDir = action.directionKey;

    // 2. direction プロパティ (例: { code: 'N' }, 'DIR_N', 'N')
    if (!rawDir && action.direction) {
      if (typeof action.direction === 'string') {
        rawDir = action.direction;
      } else if (typeof action.direction === 'object') {
        rawDir = action.direction.code || action.direction.key || action.direction.name;
      }
    }

    // 3. dirCode プロパティ
    if (!rawDir && action.dirCode) {
      rawDir = action.dirCode;
    }

    // 4. keySequence 配列内の DIR_* トークン
    if (!rawDir && Array.isArray(action.keySequence)) {
      const dirToken = action.keySequence.find(t => typeof t === 'string' && t.startsWith('DIR_'));
      if (dirToken) rawDir = dirToken;
    }

    // 5. target が 'feet' の場合、または非方向性アクションの場合は 'SELF' (足元)
    if (!rawDir) {
      if (action.target === 'feet' || action.isDirectional === false) {
        return 'SELF';
      }
      return 'NONE';
    }

    // 文字列のクリーンアップ ('DIR_N' -> 'N', 'DIR_SELF' -> 'SELF')
    const cleaned = String(rawDir).toUpperCase().replace(/^DIR_/, '');
    const validDirections = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'SELF']);

    if (validDirections.has(cleaned)) {
      return cleaned;
    }

    // 名前表現マッピング
    const nameMap = {
      'NORTH': 'N', 'UP': 'N',
      'EAST': 'E', 'RIGHT': 'E',
      'SOUTH': 'S', 'DOWN': 'S',
      'WEST': 'W', 'LEFT': 'W',
      'NORTHEAST': 'NE',
      'NORTHWEST': 'NW',
      'SOUTHEAST': 'SE',
      'SOUTHWEST': 'SW',
      'FEET': 'SELF', 'HERE': 'SELF'
    };

    return nameMap[cleaned] || 'NONE';
  }

  /**
   * 方向フィルターインジケーターのイベント初期設定
   */
  initDirectionPadEvents() {
    if (this.elGklDirectionPad) {
      this.elGklDirectionPad.addEventListener('click', (e) => {
        const btn = e.target.closest('.gkl-dir-btn');
        if (!btn) return;
        const dir = btn.dataset.dir;
        this.selectedDir = (this.selectedDir === dir) ? 'ALL' : dir;
        this._lastActionHtml = null; // リセットして再描画を強制
      });
    }

    if (this.elBtnDirReset) {
      this.elBtnDirReset.addEventListener('click', () => {
        this.selectedDir = 'ALL';
        this._lastActionHtml = null;
      });
    }
  }

  renderKnowledgeCard(target) {
    if (!this.elGklKnowledgeContent) return;

    if (!target) {
      this.elGklKnowledgeContent.innerHTML = `
        <div class="gkl-empty-hint">
          マップのマスをホバーまたはタップすると<br>リアルタイムで構造化ナレッジが表示されます
        </div>`;
      return;
    }

    let data = null;
    if (target && typeof target === 'object' && target.knowledge) {
      data = target.knowledge;
    } else if (this.core && this.core.gkl && this.core.gkl.structuredKnowledge) {
      data = this.core.gkl.structuredKnowledge.getKnowledge(target, { translate: true });
    }

    if (!data) {
      this.elGklKnowledgeContent.innerHTML = '<div class="gkl-empty-hint">該当するナレッジ情報がありません</div>';
      return;
    }

    if (data.dangerLevel) {
      const badgeClass = `kn-danger-${data.dangerLevel || 'LOW'}`;
      this.elGklKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.name}</span>
            <span class="kn-danger-badge ${badgeClass}">${data.dangerLevel} DANGER</span>
          </div>
          <div class="kn-stats-row">
            <span>HD:${data.stats?.hd ?? '-'}</span>
            <span>AC:${data.stats?.ac ?? '-'}</span>
            <span>Spd:${data.stats?.speed ?? '-'}</span>
            <span>MR:${data.stats?.mr ?? 0}%</span>
          </div>
          ${data.corpseInfo?.warningNote ? `<div class="kn-warning-box">⚠️ ${data.corpseInfo.warningNote}</div>` : ''}
          ${data.effectSummary ? `<div style="font-size:12px; margin-top:4px;">${data.effectSummary}</div>` : ''}
          ${data.tacticalAdvice && data.tacticalAdvice.length > 0 ? `
            <div style="margin-top:6px;">
              <div class="kn-section-label">💡 実戦戦術アドバイス</div>
              <ul class="kn-advice-list">${data.tacticalAdvice.map(adv => `<li>• ${adv}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      let statsHtml = '';
      if (data.stats) {
        const s = data.stats;
        const parts = [];
        if (s.sdam) parts.push(`⚔️ 攻撃力: <strong style="color:#fff;">${s.sdam}</strong> (小型) / <strong style="color:#fff;">${s.ldam || s.sdam}</strong> (大型)`);
        if (s.ac !== undefined) parts.push(`🛡️ 防御力: <strong style="color:#fff;">AC ${s.ac}</strong>`);
        if (s.material) parts.push(`素材: ${s.material}`);
        if (s.hands) parts.push(`${s.hands}手持ち`);
        if (parts.length > 0) {
          statsHtml = `<div class="kn-stats-row" style="margin:6px 0; padding:6px 10px; background:rgba(56, 189, 248, 0.15); border:1px solid rgba(56, 189, 248, 0.3); border-radius:4px; font-size:12px; color:#38bdf8; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">${parts.map(p => `<span>${p}</span>`).join('')}</div>`;
        }
      }

      let bucHtml = '';
      if (data.bucEffects) {
        const b = data.bucEffects;
        const bParts = [];
        if (b.blessed) bParts.push(`<li style="color:#2ecc71;"><strong>祝福:</strong> ${b.blessed}</li>`);
        if (b.uncursed) bParts.push(`<li style="color:#bdc3c7;"><strong>通常:</strong> ${b.uncursed}</li>`);
        if (b.cursed) bParts.push(`<li style="color:#e74c3c;"><strong>呪い:</strong> ${b.cursed}</li>`);
        if (bParts.length > 0) {
          bucHtml = `<ul class="kn-advice-list">${bParts.join('')}</ul>`;
        }
      }

      this.elGklKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.inventoryLabel || data.name}</span>
            <span class="kn-danger-badge kn-danger-ITEM">${data.category}${data.isUnidentified ? ' (未識別)' : ''}</span>
          </div>
          ${statsHtml}
          ${data.effectSummary ? `<div style="font-size:12px; margin-top:4px;">${data.effectSummary}</div>` : ''}
          ${data.flavorNote ? `<div style="font-style:italic; font-size:11px; color:#94a3b8; margin:4px 0;">" ${data.flavorNote} "</div>` : ''}
          ${bucHtml ? `
            <div>
              <div class="kn-section-label">⚖️ BUC効果</div>
              ${bucHtml}
            </div>
          ` : ''}
          ${data.unidentifiedTips && data.unidentifiedTips.length > 0 ? `
            <div class="kn-unid-box">
              <div class="kn-section-label" style="color:#3498db;">🔍 識別テスト・コツ</div>
              <ul class="kn-advice-list">
                ${data.unidentifiedTips.map(t => `<li>${t}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  /**
   * 方向キーパッドの点灯・バッジ状態を更新
   * @param {Map<string, number>} dirCounts - 各方向の件数マップ
   */
  renderDirectionPad(dirCounts) {
    if (!this.elGklDirectionPad) return;

    const dirNameMap = {
      'ALL': '全て',
      'N': '北 (N)', 'NE': '北東 (NE)', 'E': '東 (E)', 'SE': '南東 (SE)',
      'S': '南 (S)', 'SW': '南西 (SW)', 'W': '西 (W)', 'NW': '北西 (NW)',
      'SELF': '足元 (SELF)'
    };

    // リセットボタンの状態
    if (this.elBtnDirReset) {
      this.elBtnDirReset.classList.toggle('active', this.selectedDir === 'ALL');
    }

    // ラベル表示
    if (this.elGklFilterLabel) {
      this.elGklFilterLabel.textContent = `表示: ${dirNameMap[this.selectedDir] || this.selectedDir}`;
    }

    // 各方向ボタンの表示更新
    const buttons = this.elGklDirectionPad.querySelectorAll('.gkl-dir-btn');
    buttons.forEach(btn => {
      const dir = btn.dataset.dir;
      const count = dirCounts.get(dir) || 0;
      const badge = btn.querySelector('.gkl-dir-badge');

      if (badge) {
        badge.textContent = count > 0 ? count : '';
      }

      // アクションの有無によるハイライト
      btn.classList.toggle('has-action', count > 0);
      // アクティブ選択中のハイライト
      btn.classList.toggle('active', this.selectedDir === dir);
    });
  }

  renderGklActions(actions) {
    if (!this.elGklActionList) return;

    // 1. 各方向のアクション件数を算出
    const dirCounts = new Map();
    actions.forEach(action => {
      const dirCode = this.extractDirectionCode(action);
      dirCounts.set(dirCode, (dirCounts.get(dirCode) || 0) + 1);
    });

    // 2. 方向フィルターインジケーター（「囲」キーパッド）の表示更新
    this.renderDirectionPad(dirCounts);

    // 3. 選択中フィルターに応じてアクションを絞り込み
    const filteredActions = (this.selectedDir === 'ALL')
      ? actions
      : actions.filter(action => this.extractDirectionCode(action) === this.selectedDir);

    // 件数バッジの表示 (例: 絞り込み時は 3/10、全体時は 10)
    this.elGklActionCount.textContent = (this.selectedDir === 'ALL')
      ? actions.length
      : `${filteredActions.length}/${actions.length}`;

    // 4. 前回のHTMLと比較し変化が無ければ書き換えない (軽量化)
    const actionKeyStr = `${this.selectedDir}_${filteredActions.map(a => `${a.id}:${a.label}`).join('|')}`;
    if (this._lastActionHtml !== actionKeyStr) {
      this._lastActionHtml = actionKeyStr;

      const newHtml = filteredActions.length === 0 
        ? `<div class="gkl-empty-hint">${this.selectedDir === 'ALL' ? '周辺環境に応じたアクションが自動表示されます' : 'この方向の推奨アクションはありません'}</div>`
        : filteredActions.map(action => `
            <button class="gkl-action-btn ${action.risk === 'danger' ? 'danger' : ''}" data-act-id="${action.id}">
              <span>${action.labelJa || action.label}</span>
              <span class="gkl-key-badge">${action.charStr || action.key || '?'}</span>
            </button>
          `).join('');

      this.elGklActionList.innerHTML = newHtml;

      // ボタンイベント登録
      filteredActions.forEach(action => {
        const btn = this.elGklActionList.querySelector(`[data-act-id="${action.id}"]`);
        if (btn) {
          btn.onclick = () => {
            if (action.risk === 'danger') {
              if (!confirm(`【⚠️ 危険な行動】\n"${action.labelJa || action.label}" を実行しますか？`)) return;
            }
            // アクション実行時にフィルターを 'ALL' に自動リセット
            this.selectedDir = 'ALL';
            this._lastActionHtml = null;
            this.core.executeAction(action);
          };
        }
      });
    }
  }

  renderGklInventory(inventory) {
    if (!this.elGklInventoryGrid || !inventory) return;
    const items = inventory.items || [];
    this.elGklInvCount.textContent = items.length;

    const newHtml = items.length === 0
      ? '<div class="gkl-empty-hint">インベントリ空</div>'
      : items.map(item => {
          const equipClasses = [];
          if (item.isWielded) equipClasses.push('is-wielded');
          if (item.isOffhand) equipClasses.push('is-offhand');
          if (item.isQuivered) equipClasses.push('is-quivered');
          if (item.isWorn) equipClasses.push('is-worn');
          const equipClassStr = equipClasses.join(' ');

          let badgeHtml = '';
          if (item.isWielded) badgeHtml = '<span class="gkl-slot-equip-badge badge-wielded" title="メイン武器 (wielded)">手</span>';
          else if (item.isOffhand) badgeHtml = '<span class="gkl-slot-equip-badge badge-offhand" title="副武器 (off-hand)">副</span>';
          else if (item.isQuivered) badgeHtml = '<span class="gkl-slot-equip-badge badge-quivered" title="矢筒 (quivered)">筒</span>';
          else if (item.isWorn) badgeHtml = '<span class="gkl-slot-equip-badge badge-worn" title="着用中 (worn)">着</span>';

          return `
            <div class="gkl-item-slot ${equipClassStr}" data-letter="${item.letter}" data-rawtext="${encodeURIComponent(item.rawText)}">
              <span class="gkl-slot-letter">${item.letter}</span>
              <div class="gkl-slot-icon" id="slot-icon-${item.letter}"></div>
              ${badgeHtml}
            </div>
          `;
        }).join('');

    if (this._lastInvHtml !== newHtml) {
      this._lastInvHtml = newHtml;
      this.elGklInventoryGrid.innerHTML = newHtml;

      // アイテムスタイルとツールチップイベント
      items.forEach(item => {
        const slot = this.elGklInventoryGrid.querySelector(`[data-letter="${item.letter}"]`);
        const iconEl = this.elGklInventoryGrid.querySelector(`#slot-icon-${item.letter}`);
        const tileImgPath = this.loadedTileImagePath || '../../pict/nethack_default_32.png';

        if (iconEl && item.glyphId >= 0 && this.core) {
          const styleObj = this.core.getGlyphStyle(item.glyphId, { tileImage: tileImgPath, tileSize: 32, displaySize: 28 });
          if (styleObj && styleObj.backgroundImage) {
            Object.assign(iconEl.style, styleObj);
          } else {
            iconEl.textContent = this.getItemSymbol(item);
          }
        } else if (iconEl) {
          iconEl.textContent = this.getItemSymbol(item);
        }

        if (slot) {
          slot.onmouseenter = () => {
            this.renderKnowledgeCard(item);
            this.elGklTtName.textContent = item.rawText;
            this.elGklTtTags.innerHTML = '';

            if (item.isWielded) this.elGklTtTags.innerHTML += '<span class="tag" style="background:#e9c46a;color:#1a1a2e;font-weight:bold;">手持ち武器</span>';
            if (item.isOffhand) this.elGklTtTags.innerHTML += '<span class="tag" style="background:#4ea8de;color:#0f172a;font-weight:bold;">副武器</span>';
            if (item.isQuivered) this.elGklTtTags.innerHTML += '<span class="tag" style="background:#2a9d8f;color:#fff;font-weight:bold;">矢筒</span>';
            if (item.isWorn) this.elGklTtTags.innerHTML += '<span class="tag" style="background:#9d4edd;color:#fff;font-weight:bold;">着用中</span>';

            if (item.defaultActionLabelJa && item.defaultVerb) {
              this.elGklTtTags.innerHTML += `<span class="tag" style="background:#2a9d8f;color:#ffffff;font-weight:bold;">ワンタップ: ${item.defaultActionLabelJa}</span>`;
            }

            if (item.isPickAxe) this.elGklTtTags.innerHTML += '<span class="tag">掘削(a)</span>';
            if (item.isDigWand) this.elGklTtTags.innerHTML += '<span class="tag">採掘の杖(z)</span>';
            if (item.isKey) this.elGklTtTags.innerHTML += '<span class="tag">鍵・ピック</span>';
            if (item.isAxe) this.elGklTtTags.innerHTML += '<span class="tag">斧</span>';
            if (item.isFrostWand) this.elGklTtTags.innerHTML += '<span class="tag">氷の杖</span>';

            this.elGklTooltip.classList.remove('hidden');
          };

          slot.onmouseleave = () => {
            this.elGklTooltip.classList.add('hidden');
          };

          slot.onclick = async () => {
            if (!this.core) return;
            const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
              ? item.defaultSequence
              : [item.letter];

            if (typeof this.core.executeSequence === 'function') {
              await this.core.executeSequence(seq);
            } else if (this.core.requestController && typeof this.core.requestController.executeSequence === 'function') {
              await this.core.requestController.executeSequence(seq);
            } else {
              seq.forEach(ch => this.core.sendKey(ch, false, false, false, ch, true));
            }

          };
        }


      });
    }
  }


  getItemSymbol(item) {
    if (item.isPickAxe) return '⛏️';
    if (item.isDigWand) return '🪄';
    if (item.isFrostWand) return '❄️';
    if (item.isKey) return '🔑';
    if (item.isAxe) return '🪓';

    const text = (item.rawText || '').toLowerCase();
    if (text.includes('sword') || text.includes('dagger') || text.includes('weapon') || text.includes('blade')) return '🗡️';
    if (text.includes('armor') || text.includes('shield') || text.includes('helmet') || text.includes('mail') || text.includes('cloak') || text.includes('glovers') || text.includes('boots')) return '🛡️';
    if (text.includes('wand')) return '🪄';
    if (text.includes('ring')) return '💍';
    if (text.includes('scroll')) return '📜';
    if (text.includes('potion')) return '🧪';
    if (text.includes('food') || text.includes('ration') || text.includes('apple') || text.includes('corpse')) return '🍎';
    if (text.includes('gem') || text.includes('stone')) return '💎';
    if (text.includes('gold')) return '💰';
    return '📦';
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
    if (!this.isGraphicCanvasMode || !this.tileLoaded || this.tileImg.naturalWidth === 0) return;
    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
    const cols = Math.floor(this.tileImg.width / 32);

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const bounceY = Math.round(Math.sin(Date.now() / 180) * 2);

    // GKL AreaStateManager の 3層グリッドがある場合は重ね描き
    const areaGrid = (this.core && this.core.gkl && this.core.gkl.areaStateManager) ? this.core.gkl.areaStateManager.grid : null;

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const dx = x * 16;
        const dy = y * 14;

        if (areaGrid && areaGrid[y] && areaGrid[y][x]) {
          const cell = areaGrid[y][x];
          
          // Layer 1 (Bottom)
          if (cell.bottom && cell.bottom.rawGlyph >= 0) {
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

    if (this.isGraphicCanvasMode) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(dx, dy, 16, 14);

      if (gData && gData.glyph >= 0 && this.tileLoaded && this.tileImg.naturalWidth > 0) {
        const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
        const tileIndex = tileMap[gData.glyph] !== undefined ? tileMap[gData.glyph] : 0;
        const cols = Math.floor(this.tileImg.width / 32);
        const sx = (tileIndex % cols) * 32;
        const sy = Math.floor(tileIndex / cols) * 32;
        this.ctx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy, 16, 14);
      }

      if (x === this.targetCursorX && y === this.targetCursorY) {
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(dx + 0.5, dy + 0.5, 15, 13);
      }
    } else {
      const cellData = this.asciiGridBuffer[y][x];
      const cellSpan = document.getElementById(`ascii-cell-${x}-${y}`);
      if (cellSpan) {
        cellSpan.textContent = cellData.ch || ' ';
        const isCursorCell = (x === this.targetCursorX && y === this.targetCursorY);
        cellSpan.className = `ascii-cell clr-${cellData.color !== undefined ? cellData.color : 7} ${isCursorCell ? 'is-cursor' : ''}`;
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
    if (this.core && this.core.gkl && this.core.gkl.areaStateManager) {
      this.core.gkl.areaStateManager.resetGrid();
    }
    if (this.isGraphicCanvasMode) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.renderColorAsciiMap();
    }
  }

  addMessageLog(msg) {
    if (!msg) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = msg;
    this.elMessageLog.appendChild(line);
    this.elMessageLog.scrollTop = this.elMessageLog.scrollHeight;
  }

  updateStatus(status) {
    this.elStName.textContent = status.title || 'Hero';
    this.elStDlvl.textContent = status.dlevel ? status.dlevel.text : 'Dlvl:1';
    
    // HP ゲージ＆テキスト
    if (status.hp) {
      this.elStHp.textContent = `HP:${status.hp.current}(${status.hp.max})`;
      const hpPct = Math.max(0, Math.min(100, Math.round((status.hp.current / Math.max(1, status.hp.max)) * 100)));
      if (this.elHpBarFill) this.elHpBarFill.style.width = `${hpPct}%`;
    } else {
      this.elStHp.textContent = 'HP:0(0)';
      if (this.elHpBarFill) this.elHpBarFill.style.width = '0%';
    }

    // MP (Pw) ゲージ＆テキスト
    if (status.pw) {
      this.elStPw.textContent = `Pw:${status.pw.current}(${status.pw.max})`;
      const mpPct = Math.max(0, Math.min(100, Math.round((status.pw.current / Math.max(1, status.pw.max)) * 100)));
      if (this.elMpBarFill) this.elMpBarFill.style.width = `${mpPct}%`;
    } else {
      this.elStPw.textContent = 'Pw:0(0)';
      if (this.elMpBarFill) this.elMpBarFill.style.width = '0%';
    }

    this.elStAc.textContent = status.ac !== undefined ? `AC:${status.ac}` : 'AC:10';
    
    // Gold
    if (status.gold) {
      const tileImgPath = this.loadedTileImagePath || '../../assets/nethack_default_32.png';
      const goldGlyphHtml = (this.core && typeof this.core.getGlyphHtml === 'function') 
        ? this.core.getGlyphHtml(status.gold.glyphId || 3886, { displaySize: 14, tileImage: tileImgPath }) 
        : '💰';
      this.elStGold.innerHTML = `${goldGlyphHtml} <span>$${status.gold.amount}</span>`;
    } else {
      this.elStGold.innerHTML = '💰 0';
    }

    const conds = (status.conditions || []).concat(status.hunger ? [status.hunger] : []);
    if (conds.length > 0) {
      this.elStCond.classList.remove('hidden');
      this.elStCond.textContent = conds.join(', ');
    } else {
      this.elStCond.classList.add('hidden');
    }
  }

  handleInputRequired(data) {
    this.clearAllModals();
    if (this.isGameExited) return;

    const category = data.category || data.promptCategory || 'OTHER';
    const rawPrompt = data.prompt || data.message || data.question || '';
    const items = data.menuItems || data.items || [];
    const textLines = data.lines || [];

    if (textLines && textLines.length > 0) {
      this.isTextWindowMode = true;
      this.elMenuModal.classList.remove('hidden');
      this.elMenuTitle.textContent = rawPrompt || 'Information';
      this.elMenuItemsContainer.innerHTML = '';

      textLines.forEach(lineText => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'text-window-line';
        lineDiv.textContent = lineText;
        this.elMenuItemsContainer.appendChild(lineDiv);
      });

      this.elBtnCancelMenu.textContent = '閉じる / 次へ (Space)';
      this.elBtnCancelMenu.onclick = () => this.core.sendKey('Space');
      return;
    }

    if (category === 'MENU' || (items && items.length > 0)) {
      this.isTextWindowMode = false;
      this.elMenuModal.classList.remove('hidden');
      this.elMenuTitle.textContent = rawPrompt || 'Select Item (↑↓ / Enter)';
      this.elMenuItemsContainer.innerHTML = '';
      this.selectableMenuButtons = [];
      this.activeMenuFocusIndex = 0;

      items.forEach((item) => {
        const itemText = item.str || item.text || (typeof item === 'string' ? item : '');
        if (item.isSelectable === false) {
          const headerDiv = document.createElement('div');
          headerDiv.className = 'menu-header-item';
          headerDiv.textContent = itemText;
          this.elMenuItemsContainer.appendChild(headerDiv);
          return;
        }

        const btn = document.createElement('button');
        btn.className = 'menu-item-btn';
        const chStr = item.charStr || (item.ch ? String.fromCharCode(item.ch) : '');
        const badgeHtml = chStr ? `<strong style="color:var(--accent-gold);">${chStr})</strong>` : '';
        
        const glyphId = item.glyph !== undefined ? item.glyph : (item.glyphInfo ? item.glyphInfo.glyph : -1);
        const tileImgPath = this.loadedTileImagePath || '../../assets/nethack_default_32.png';
        const glyphHtml = (glyphId >= 0 && this.core && typeof this.core.getGlyphHtml === 'function')
          ? this.core.getGlyphHtml(glyphId, { displaySize: 18, tileImage: tileImgPath })
          : '';

        btn.innerHTML = `${badgeHtml} ${glyphHtml} <span>${itemText}</span>`;

        btn.onclick = () => {
          const val = (item.identifier !== undefined && item.identifier !== 0) ? [{ identifier: item.identifier, count: -1 }] : (item.ch || item.accelerator || itemText);
          this.core.respond(val);
        };

        this.selectableMenuButtons.push(btn);
        this.elMenuItemsContainer.appendChild(btn);
      });

      this.updateMenuFocus();
      this.elBtnCancelMenu.textContent = 'Cancel (ESC / 0)';
      this.elBtnCancelMenu.onclick = () => this.core.respond(0);
      return;
    }

    const isLineText = data.inputType === 'LINE_TEXT' || 
                       category === 'TEXT' || 
                       category === 'ASKNAME' || 
                       category === 'FILE' || 
                       category === 'EXTCMD' || 
                       category === 'LINE' || 
                       data.context === 'getlin' || 
                       data.context === 'get_ext_cmd' || 
                       data.context === 'text' || 
                       data.context === 'extcmd';

    if (isLineText) {
      this.elPromptBar.classList.remove('hidden');
      const promptTitle = data.promptText || data.title || rawPrompt || 'Enter text:';
      this.elPromptText.textContent = promptTitle;
      this.elInputControls.innerHTML = `
        <input type="text" id="prompt-text-input" placeholder="Type here..." />
        <button id="btn-submit-text">OK</button>
      `;

      const inputEl = document.getElementById('prompt-text-input');
      const submitBtn = document.getElementById('btn-submit-text');

      const submitAction = () => {
        const val = inputEl.value;
        this.core.respond(val);
      };

      submitBtn.onclick = submitAction;
      inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitAction();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (typeof this.core.cancelPrompt === 'function') {
            this.core.cancelPrompt();
          } else {
            this.core.respond('\x1b');
          }
        }
      };
      setTimeout(() => inputEl.focus(), 50);
      return;
    }

    if (data.inputType === 'DIRECTION' || !data.options || data.options.length === 0) {
      this.elPromptBar.classList.add('hidden');
      return;
    }

    if (data.options && data.options.length > 0) {
      this.elPromptBar.classList.remove('hidden');
      this.elPromptText.textContent = rawPrompt || 'Select Option';
      this.elInputControls.innerHTML = '';

      data.options.forEach(opt => {
        const btn = document.createElement('button');
        // opt.label に既に (key) が含まれている場合は二重付加を防ぐ
        btn.textContent = opt.label.includes(`(${opt.key})`) ? opt.label : `${opt.label} (${opt.key})`;
        btn.onclick = () => this.core.respond(opt.key);
        this.elInputControls.appendChild(btn);
      });

      return;
    }

  }

  updateMenuFocus() {
    this.selectableMenuButtons.forEach((btn, index) => {
      if (index === this.activeMenuFocusIndex) {
        btn.classList.add('focus');
        btn.scrollIntoView({ block: 'nearest' });
      } else {
        btn.classList.remove('focus');
      }
    });
  }

  clearAllModals() {
    this.elPromptBar.classList.add('hidden');
    this.elMenuModal.classList.add('hidden');
    this.isTextWindowMode = false;
  }

  resetUiForNewGame() {
    this.isGameExited = false;
    this.currentGameOverResult = null;
    this.clearAllModals();
    this.clearMapGrid();
    this.elMessageLog.innerHTML = '';
  }

  async restartGame() {
    this.elLoading.classList.remove('hidden');
    this.elGameOverModal.classList.add('hidden');
    this.elSelectorCard.classList.add('hidden');
    this.elSpinnerBox.classList.remove('hidden');

    await this.core.restart({ clearStorage: false });
  }

  async deleteSaveFile() {
    if (confirm("セーブファイルを完全に削除しますか？")) {
      await this.core.deleteSaveData();
      await this.restartGame();
    }
  }

  async handleExited(data) {
    this.isGameExited = true;
    this.clearAllModals();

    const result = this.currentGameOverResult || await this.core.resolveGameOver();
    this.elGameOverModal.classList.remove('hidden');
    
    document.getElementById('gameover-title').textContent = 
      result.reason === 'ascended' ? '🎉 ASCENDED!' : (result.reason === 'save_and_exit' ? '💾 Game Saved' : '💀 GAME OVER');

    const deathText = result.translatedDeath || result.deathMessage || result.death || 'Unknown causes';
    const scoreText = result.finalScore !== undefined ? result.finalScore : 0;
    this.elGameOverSummary.innerHTML = `
      <p><strong>Player:</strong> ${result.playerName || 'Hero'}</p>
      <p><strong>Result:</strong> ${deathText}</p>
      <p><strong>Final Score:</strong> <span style="color:var(--accent-gold); font-size:1.1em;">${scoreText}</span></p>
    `;

    this.renderScoreboard(result.scoreboard || []);
  }

  renderScoreboard(scores) {
    this.elScoreboardContainer.innerHTML = '';
    if (!scores || scores.length === 0) {
      this.elScoreboardContainer.innerHTML = '<p style="padding:10px; color:#888;">No high score records found.</p>';
      return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 1px solid #333; color: var(--primary-color);">
          <th style="padding:6px; text-align:left;">#</th>
          <th style="padding:6px; text-align:left;">Score</th>
          <th style="padding:6px; text-align:left;">Name</th>
          <th style="padding:6px; text-align:left;">Death Reason</th>
        </tr>
      </thead>
      <tbody>
        ${scores.map((sc, idx) => `
          <tr style="border-bottom: 1px solid #222;">
            <td style="padding:6px; color:#888;">${idx + 1}</td>
            <td style="padding:6px; color:var(--accent-gold); font-weight:bold;">${sc.points || sc.score || 0}</td>
            <td style="padding:6px;">${sc.name || 'Hero'} (${sc.role || ''})</td>
            <td style="padding:6px; color:#aaa;">${sc.death || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    this.elScoreboardContainer.appendChild(table);
  }
}

// 起動
new GklPureJSClient();
