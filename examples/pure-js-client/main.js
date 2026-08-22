import { WebUICore } from '../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../src/driver/index.js';

class PureJSClient {
  constructor() {
    this.core = null;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.asciiGrid = document.getElementById('ascii-grid');
    this.btnToggleView = document.getElementById('btn-toggle-view');
    
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

    // Status Elements (Unified with Component Version Layout)
    this.elStName = document.getElementById('st-name');
    this.elStDlvl = document.getElementById('st-dlvl');
    this.elStHp = document.getElementById('st-hp');
    this.elStPw = document.getElementById('st-pw');
    this.elStAc = document.getElementById('st-ac');
    this.elStGold = document.getElementById('st-gold');
    this.elStCond = document.getElementById('st-cond');

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

    // Multi-path Sprite Tile Image Loader with Fallback
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
        console.warn("[PureJSClient] All sprite tile paths failed. Falling back to Color ASCII Grid view.");
        this.tileLoaded = false;
        this.switchViewMode(false);
        return;
      }
      const currentPath = paths[index++];
      this.tileImg.onload = () => {
        console.log(`[PureJSClient] Successfully loaded sprite tile image: ${currentPath}`);
        this.tileLoaded = true;
        this.loadedTileImagePath = currentPath;
        this.redrawAllGraphicTiles();
      };
      this.tileImg.onerror = () => {
        console.warn(`[PureJSClient] Failed to load sprite tile image at: ${currentPath}, trying next...`);
        tryNext();
      };
      this.tileImg.src = currentPath;
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
      if (this.targetCursorX >= 0 && this.targetCursorY >= 0) this.redrawSingleCell(this.targetCursorX, this.targetCursorY);
    });

    // 5. Print Glyph (Map Update)
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

    this.core.on('restarted', () => {
      this.resetUiForNewGame();
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

    document.getElementById('btn-restart').onclick = () => this.restartGame();
    document.getElementById('btn-delete-save').onclick = () => this.deleteSaveFile();
    document.getElementById('btn-gameover-restart').onclick = () => this.restartGame();

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

  redrawAllGraphicTiles() {
    if (!this.isGraphicCanvasMode || !this.tileLoaded || this.tileImg.naturalWidth === 0) return;
    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
    const cols = Math.floor(this.tileImg.width / 32);

    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 80; x++) {
        const gData = this.glyphGridBuffer[y][x];
        if (gData && gData.glyph >= 0) {
          const tileIndex = tileMap[gData.glyph] !== undefined ? tileMap[gData.glyph] : 0;
          const sx = (tileIndex % cols) * 32;
          const sy = Math.floor(tileIndex / cols) * 32;
          const dx = x * 16;
          const dy = y * 14;
          this.ctx.drawImage(this.tileImg, sx, sy, 32, 32, dx, dy, 16, 14);
        }
      }
    }
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
        this.ctx.strokeRect(dx + 1.5, dy + 1.5, 13, 11);
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
    this.elStHp.textContent = status.hp ? `HP:${status.hp.current}(${status.hp.max})` : 'HP:0(0)';
    this.elStPw.textContent = status.pw ? `Pw:${status.pw.current}(${status.pw.max})` : 'Pw:0(0)';
    this.elStAc.textContent = status.ac !== undefined ? `AC:${status.ac}` : 'AC:10';
    
    // Gold グリフアイコン
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

    // 1. HELP / FILE テキストウィンドウ
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

    // 2. MENU インベントリ表示 (アイテムタイルのグリフ表示 + 上下キー + Enter 対応)
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
        
        // アイテムタイルのグリフアイコン生成 (WebUICore.getGlyphHtml 連携)
        const glyphId = item.glyph !== undefined ? item.glyph : (item.glyphInfo ? item.glyphInfo.glyph : -1);
        const tileImgPath = this.loadedTileImagePath || '../../assets/nethack_default_32.png';
        const glyphHtml = (glyphId >= 0 && this.core && typeof this.core.getGlyphHtml === 'function') 
          ? this.core.getGlyphHtml(glyphId, { displaySize: 18, tileImage: tileImgPath }) 
          : '';

        btn.innerHTML = `${badgeHtml} ${glyphHtml} <span style="margin-left:6px;">${itemText}</span>`;

        const currentBtnIndex = this.selectableMenuButtons.length;
        this.selectableMenuButtons.push(btn);

        btn.onmouseenter = () => {
          this.activeMenuFocusIndex = currentBtnIndex;
          this.updateMenuFocus();
        };

        btn.onclick = () => this.core.respond(item);
        this.elMenuItemsContainer.appendChild(btn);
      });

      if (this.selectableMenuButtons.length > 0) {
        this.updateMenuFocus();
      }

      this.elBtnCancelMenu.textContent = 'Cancel (ESC / 0)';
      this.elBtnCancelMenu.onclick = () => this.core.respond(0);
      return;
    }

    // 3. ASKNAME, YN, TEXT, FILE, EXTCMD プロンプト
    this.isTextWindowMode = false;
    this.elPromptBar.classList.remove('hidden');
    this.elPromptText.textContent = rawPrompt || 'Please enter input:';
    this.elInputControls.innerHTML = '';

    if (category === 'ASKNAME' || category === 'TEXT' || category === 'FILE' || category === 'EXTCMD') {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = category === 'ASKNAME' ? 'Hero' : '';
      const btn = document.createElement('button');
      btn.textContent = 'Submit';

      const submit = () => {
        const val = input.value || 'Hero';
        this.core.respond(val);
      };
      btn.onclick = submit;
      input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };

      this.elInputControls.appendChild(input);
      this.elInputControls.appendChild(btn);
      setTimeout(() => { input.focus(); input.select(); }, 50);
    } else if (category === 'YN') {
      const choices = data.choices || 'yn';
      for (const ch of choices.split('')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.textContent = `${ch.toUpperCase()} (${ch})`;
        btn.onclick = () => this.core.respond(ch);
        this.elInputControls.appendChild(btn);
      }
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = 'Press Space to continue';
      btn.onclick = () => this.core.sendKey('Space');
      this.elInputControls.appendChild(btn);
    }
  }

  updateMenuFocus() {
    this.selectableMenuButtons.forEach((btn, idx) => {
      if (idx === this.activeMenuFocusIndex) {
        btn.classList.add('focus');
        btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        btn.classList.remove('focus');
      }
    });
  }

  clearAllModals() {
    this.isTextWindowMode = false;
    this.elPromptBar.classList.add('hidden');
    this.elMenuModal.classList.add('hidden');
    this.elMenuItemsContainer.innerHTML = '';
    this.elInputControls.innerHTML = '';
    this.selectableMenuButtons = [];
    this.activeMenuFocusIndex = 0;
  }

  async handleExited(data) {
    this.isGameExited = true;
    this.clearAllModals();
    this.elGameOverModal.classList.remove('hidden');

    const currentStatus = this.core ? this.core.getStatus() : {};
    let result = (data && data.gameOverResult) ? data.gameOverResult : this.currentGameOverResult;
    if (!result || !result.reason) {
      result = await this.core.resolveGameOver();
    }

    if (result && result.reason === 'save_and_exit') {
      this.elGameOverSummary.innerHTML = `
        <div style="color:var(--accent-hp); font-weight:bold;">💾 セーブしてゲームを中断しました</div>
        <div>Player: ${result.savePlayerName || 'Hero'}</div>
      `;
    } else {
      let rawDeath = result ? (result.death || result.deathMessage || 'Died in dungeon') : 'Died in dungeon';
      let translatedDeath = this.core.translate ? this.core.translate(rawDeath) : rawDeath;
      let scoreVal = (result && result.finalScore !== undefined) ? result.finalScore : (currentStatus ? currentStatus.score : 0);
      let turnsVal = currentStatus ? currentStatus.turns : 0;
      let dlvlVal = (currentStatus && currentStatus.dlevel) ? currentStatus.dlevel.text : 'Dlvl:1';

      this.elGameOverSummary.innerHTML = `
        <div style="color:var(--danger-color); font-weight:bold; font-size:1.1rem; margin-bottom:0.4rem;">☠️ ${translatedDeath}</div>
        <div>Dungeon Floor: <strong style="color:var(--accent-gold);">${dlvlVal}</strong></div>
        <div>Final Score: <strong style="color:var(--accent-hp);">${scoreVal} pts</strong></div>
        <div>Total Turns: <strong>${turnsVal}</strong></div>
      `;
    }

    // High Scores List
    const scores = (result && result.scoreboard && result.scoreboard.length > 0) ? result.scoreboard : await this.core.getHighScoresAsync();
    if (scores && scores.length > 0) {
      let html = `<table class="score-table"><thead><tr><th>#</th><th>Score</th><th>Name</th><th>Death</th></tr></thead><tbody>`;
      scores.forEach((s, idx) => {
        const deathStr = this.core.translate ? this.core.translate(s.death || '-') : (s.death || '-');
        html += `<tr><td>${s.rank || (idx + 1)}</td><td>${s.points || s.score || 0}</td><td>${s.name || 'Hero'}</td><td>${deathStr}</td></tr>`;
      });
      html += `</tbody></table>`;
      this.elScoreboardContainer.innerHTML = html;
    }
  }

  resetUiForNewGame() {
    this.clearAllModals();
    this.elMessageLog.innerHTML = '';
    this.elStName.textContent = 'Hero';
    this.elStDlvl.textContent = 'Dlvl:1';
    this.elStHp.textContent = 'HP:0(0)';
    this.elStPw.textContent = 'Pw:0(0)';
    this.elStAc.textContent = 'AC:10';
    this.elStGold.textContent = '💰 0';
    this.elStCond.classList.add('hidden');

    this.clearMapGrid();
  }

  async restartGame() {
    this.resetUiForNewGame();
    this.elLoading.classList.remove('hidden');
    this.elGameOverModal.classList.add('hidden');
    this.elSelectorCard.classList.add('hidden');
    this.elSpinnerBox.classList.remove('hidden');

    await this.core.restart({ clearStorage: false, autoStart: false });
    await this.bootstrapGame();
  }

  async deleteSaveFile() {
    if (confirm("保存されているセーブデータを完全削除し最初から始めますか？")) {
      this.resetUiForNewGame();
      this.elLoading.classList.remove('hidden');
      this.elGameOverModal.classList.add('hidden');
      this.elSelectorCard.classList.add('hidden');
      this.elSpinnerBox.classList.remove('hidden');

      await this.core.restart({ clearStorage: true, autoStart: false });
      await this.bootstrapGame();
    }
  }
}

// Initialize Client on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  new PureJSClient();
});
