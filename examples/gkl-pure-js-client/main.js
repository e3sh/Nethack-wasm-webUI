import { WebUICore } from '../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../src/driver/index.js';
import { GKLPlugin } from '../../src/core/knowledge/GKLPlugin.js';
import { OnDemandLookService } from '../../src/core/knowledge/OnDemandLookService.js';
import { getAdaptiveItemSpecs } from '../../src/core/knowledge/ItemSpecPresenter.js';
import { ATTRIBUTE_DEFINITIONS } from '../../src/core/knowledge/AttributeStateManager.js';

class GklPureJSClient {
  constructor() {
    this.core = null;
    this.lookService = null;
    this.currentLanguage = 'ja';
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
    this.elStatusBar = document.getElementById('status-bar');
    this.elBtnToggleStatusDetails = document.getElementById('btn-toggle-status-details');
    this.elStName = document.getElementById('st-name');
    this.elStDlvl = document.getElementById('st-dlvl');
    this.elStHp = document.getElementById('st-hp');
    this.elStPw = document.getElementById('st-pw');
    this.elStAc = document.getElementById('st-ac');
    this.elStGold = document.getElementById('st-gold');
    this.elStCond = document.getElementById('st-cond');
    this.elHpBarFill = document.getElementById('hp-bar-fill');
    this.elMpBarFill = document.getElementById('mp-bar-fill');

    // Status Details Elements (Expandable)
    this.elStStr = document.getElementById('st-str');
    this.elStDex = document.getElementById('st-dex');
    this.elStCon = document.getElementById('st-con');
    this.elStInt = document.getElementById('st-int');
    this.elStWis = document.getElementById('st-wis');
    this.elStCha = document.getElementById('st-cha');
    this.elStAlign = document.getElementById('st-align');
    this.elStExp = document.getElementById('st-exp');
    this.elStTurns = document.getElementById('st-turns');
    this.elStScore = document.getElementById('st-score');
    this.elStItemTurns = document.getElementById('st-item-turns');
    this.elStItemScore = document.getElementById('st-item-score');

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

    // 💡 ナレッジ ＆ 🛡️ 戦術アドバイス ボトムタブ状態
    this.currentBottomTab = 'advices';
    this.userPreferredTab = 'advices';
    this.lastKnowledgeTarget = null;
    this.lastAdvices = [];

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

  updateZoomButtonText() {
    if (!this.btnToggleZoom) return;
    const isEn = this.currentLanguage === 'en';
    const prefix = isEn ? '🎯 Zoom Camera: ' : '🎯 ズームカメラ: ';
    this.btnToggleZoom.textContent = prefix + (this.isZoomMode ? 'ON' : 'OFF');
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

  initCore() {
    const workerPath = '../../src/driver/nethack.worker.js';
    const bridge = new NetHackWasmWorkerBridge(workerPath);
    this.core = new WebUICore({ driver: bridge });
    this.currentLanguage = this.core.language || 'ja';

    const gklPlugin = new GKLPlugin({ keyMode: 'numpad', language: this.currentLanguage });
    gklPlugin.attach(this.core);

    this.lookService = new OnDemandLookService({ core: this.core });

    this.bindCoreEvents();
    this.onLanguageChanged();
  }

  bindCoreEvents() {
    // 0. Language Changed
    this.core.on('languageChanged', ({ language }) => {
      this.currentLanguage = language || 'ja';
      this.onLanguageChanged();
    });

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
      this.renderGklUi();
    });

    // 8. Input Resolved
    this.core.on('inputResolved', () => {
      this.clearAllModals();
      this.renderGklUi();
    });

    // GKL 状態同期イベント時の UI 再描画
    this.core.on('inventoryStateUpdated', () => this.renderGklUi());
    this.core.on('spellsStateUpdated', () => this.renderGklUi());
    this.core.on('skillsStateUpdated', () => this.renderGklUi());

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
        } else {
          this.zoomViewportBox.classList.add('hidden');
        }
        this.updateZoomButtonText();
      };
    }

    document.getElementById('btn-restart').onclick = () => this.restartGame();
    document.getElementById('btn-delete-save').onclick = () => this.deleteSaveFile();
    document.getElementById('btn-gameover-restart').onclick = () => this.restartGame();

    if (this.elStatusBar) {
      this.elStatusBar.addEventListener('click', (e) => {
        const spellBtn = e.target.closest('.gkl-spell-badge');
        if (spellBtn) {
          e.stopPropagation();
          const letter = spellBtn.dataset.letter;
          if (letter) this.castSpell(letter);
          return;
        }

        const skillBtn = e.target.closest('.gkl-skill-badge');
        if (skillBtn) {
          e.stopPropagation();
          const skillKey = skillBtn.dataset.skill;
          this.enhanceSkill(skillKey);
          return;
        }

        // ステータスバー（または切り替えボタン）のクリックで固定トグル展開を切替
        this.elStatusBar.classList.toggle('is-expanded');
      });
    }

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

    const btnCastSpellMenu = document.getElementById('btn-cast-spell-menu');
    if (btnCastSpellMenu) {
      btnCastSpellMenu.onclick = () => {
        this.castSpell();
      };
    }

    const tabBtnAdvices = document.getElementById('tab-btn-advices');
    if (tabBtnAdvices) {
      tabBtnAdvices.onclick = () => {
        this.userPreferredTab = 'advices';
        this.switchBottomTab('advices');
      };
    }

    const tabBtnKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabBtnKnowledge) {
      tabBtnKnowledge.onclick = () => {
        this.userPreferredTab = 'knowledge';
        this.switchBottomTab('knowledge', this.lastKnowledgeTarget);
      };
    }

    // ツールチップ追従
    document.addEventListener('mousemove', (e) => {
      if (this.elGklTooltip && !this.elGklTooltip.classList.contains('hidden')) {
        this.elGklTooltip.style.left = (e.clientX + 14) + 'px';
        this.elGklTooltip.style.top = (e.clientY + 14) + 'px';
      }
    });

    // 🎯 キャンバス操作共有関数 (メインキャンバス・ズームカメラ共通のホバー/クリック制御 + GKL自動移動)
    let lastHoverTileX = -1;
    let lastHoverTileY = -1;

    const handleCanvasInspect = async (gx, gy, isHover) => {
      if (gx < 0 || gx >= 80 || gy < 0 || gy >= 24) return;
      if (isHover && gx === lastHoverTileX && gy === lastHoverTileY) {
        return; // 同一タイルホバー時はスキップ
      }
      if (isHover) {
        lastHoverTileX = gx;
        lastHoverTileY = gy;
      } else {
        lastHoverTileX = -1;
        lastHoverTileY = -1;
      }

      if (this.core?.gkl?.inspectCellOnDemand) {
        const cardData = await this.core.gkl.inspectCellOnDemand({ x: gx, y: gy }, { isHover });
        if (cardData) {
          // 床や壁も含め、直近のナレッジデータとしては常に最新保持
          this.lastKnowledgeTarget = cardData;

          const basicCategories = ['FLOOR', 'WALL', 'CORRIDOR', 'TERRAIN', 'BARS'];
          const isBasicTerrain = basicCategories.includes(cardData.category) && !cardData.isTrap && !cardData.isAltar && !cardData.isFountain && !cardData.isThrone && !cardData.isSink;

          if (isBasicTerrain) {
            // 単なる床・壁の場合:
            // ユーザーがアドバイス優先モード（デフォルト）ならアドバイス表示を優先維持！
            // ユーザーが明示的に「💡 ナレッジ」タブを選んでいる時だけ床や壁のナレッジを表示
            if (this.userPreferredTab === 'advices') {
              this.switchBottomTab('advices');
            } else {
              this.switchBottomTab('knowledge', cardData, { isClickConfirmed: cardData?.isClickConfirmed || !isHover });
            }
          } else {
            // モンスター・アイテム・扉・罠・祭壇・泉などの特別オブジェクトの場合:
            // 注目すべき対象なので自動でナレッジを表示
            this.switchBottomTab('knowledge', cardData, { isClickConfirmed: cardData?.isClickConfirmed || !isHover });
          }
        }
      }

      // 🏃‍♂️ 確定クリック時 (isHover === false): GKL プラグインの高レベル travelTo API を直接呼び出し
      if (!isHover && this.core?.gkl?.travelTo) {
        await this.core.gkl.travelTo({ x: gx, y: gy });
      }
    };

    // 1. メインキャンバス (Graphic & Ascii Canvas) のクリック＆ホバーイベント
    [this.canvasGraphic, this.canvasAscii].forEach(cvs => {
      if (!cvs) return;
      cvs.addEventListener('mousemove', async (e) => {
        const rect = cvs.getBoundingClientRect();
        const gx = Math.floor(((e.clientX - rect.left) * (cvs.width / rect.width)) / 32);
        const gy = Math.floor(((e.clientY - rect.top) * (cvs.height / rect.height)) / 32);
        await handleCanvasInspect(gx, gy, true); // 仮ホバー
      });

      cvs.addEventListener('click', async (e) => {
        const rect = cvs.getBoundingClientRect();
        const gx = Math.floor(((e.clientX - rect.left) * (cvs.width / rect.width)) / 32);
        const gy = Math.floor(((e.clientY - rect.top) * (cvs.height / rect.height)) / 32);
        await handleCanvasInspect(gx, gy, false); // 確定クリック調査！
      });
    });

    // 2. ズームカメラ (zoom-canvas) のクリック＆ホバーイベント
    if (this.zoomCanvas) {
      this.zoomCanvas.addEventListener('mousemove', async (e) => {
        const rect = this.zoomCanvas.getBoundingClientRect();
        const tileX = Math.floor(((e.clientX - rect.left) * (this.zoomCanvas.width / rect.width)) / 32);
        const tileY = Math.floor(((e.clientY - rect.top) * (this.zoomCanvas.height / rect.height)) / 32);

        const px = this.targetCursorX >= 0 ? this.targetCursorX : 0;
        const py = this.targetCursorY >= 0 ? this.targetCursorY : 0;

        const gx = px + (tileX - 10);
        const gy = py + (tileY - 4);

        await handleCanvasInspect(gx, gy, true); // 仮ホバー
      });

      this.zoomCanvas.addEventListener('mouseleave', () => {
        this.renderKnowledgeCard(null);
      });

      this.zoomCanvas.addEventListener('click', async (e) => {
        const rect = this.zoomCanvas.getBoundingClientRect();
        const tileX = Math.floor(((e.clientX - rect.left) * (this.zoomCanvas.width / rect.width)) / 32);
        const tileY = Math.floor(((e.clientY - rect.top) * (this.zoomCanvas.height / rect.height)) / 32);

        const px = this.targetCursorX >= 0 ? this.targetCursorX : 0;
        const py = this.targetCursorY >= 0 ? this.targetCursorY : 0;

        const gx = px + (tileX - 10);
        const gy = py + (tileY - 4);

        await handleCanvasInspect(gx, gy, false); // 確定クリック調査！
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
          const isEn = this.currentLanguage === 'en';
          const confirmMsg = isEn
            ? 'Delete saved game and start a new game?'
            : '保存されているセーブデータを破棄して最初から開始しますか？';
          if (!window.confirm(confirmMsg)) return;
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

  renderGklUi() {
    if (!this.core || !this.core.gkl) return;
    const situation = this.core.gkl.getSituation();

    // プレイヤー移動時の方向フィルター自動リセットチェック
    this.checkPlayerMovementAndResetFilter(situation);

    // 1. GKL 推奨アクションパネル
    this.renderGklActions(situation.actions || []);

    // 2. GKL アイコン型所持品インベントリ
    this.renderGklInventory(situation.inventory);

    // 4. 属性耐性 (全25種) & 修得魔法 & スキル熟練度の描画
    this.renderGklAttributes(situation.attributes);
    this.renderGklSpells(situation.spells);
    this.renderGklSkills(situation.skills);

    // 5. 🛡️ 戦術アドバイス ＆ 危機警告の描画 (TacticalAdvisor)
    this.renderGklAdvices(situation.advices || []);
  }

  startGklRenderLoop() {
    const loop = () => {
      if (this.core && this.isZoomMode && this.zoomCtx && this.core.gkl) {
        // 🎯 自キャラ周辺 拡大ズームカメラ描画 (Canvas のみ 60fps)
        const situation = this.core.gkl.getSituation();
        this.renderZoomCanvas(situation.area);
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  // 🎯 自キャラ周辺 拡大ズームカメラ描画 (21x9 マス, 32px タイル)
  renderZoomCanvas(areaState) {
    if (!this.zoomCtx) return;

    const grid = areaState?.grid;
    const px = (areaState && typeof areaState.playerX === 'number')
      ? areaState.playerX
      : (areaState?.playerLocation?.x ?? (this.targetCursorX >= 0 ? this.targetCursorX : 0));
    const py = (areaState && typeof areaState.playerY === 'number')
      ? areaState.playerY
      : (areaState?.playerLocation?.y ?? (this.targetCursorY >= 0 ? this.targetCursorY : 0));
    const width = areaState?.width || 80;
    const height = areaState?.height || 21;

    if (this.zoomPosBadge) {
      this.zoomPosBadge.textContent = `@ (${px},${py})`;
    }

    const tileMap = typeof tileMapping === 'function' ? tileMapping() : [];
    const cols = (this.tileImg && this.tileImg.width) ? Math.floor(this.tileImg.width / 32) : 40;

    const canvasW = this.zoomCanvas.width; // 672
    const canvasH = this.zoomCanvas.height; // 288
    const zoomTileSize = 32; // 拡大 32px タイル

    this.zoomCtx.fillStyle = '#090916';
    this.zoomCtx.fillRect(0, 0, canvasW, canvasH);

    // 21x9 マスを中心（10,4）に配置
    const halfRangeX = 10;
    const halfRangeY = 4;
    const bounceY = Math.round(Math.sin(Date.now() / 180) * 2);

    for (let dy = -halfRangeY; dy <= halfRangeY; dy++) {
      for (let dx = -halfRangeX; dx <= halfRangeX; dx++) {
        const gx = px + dx;
        const gy = py + dy;

        const screenX = (dx + halfRangeX) * zoomTileSize;
        const screenY = (dy + halfRangeY) * zoomTileSize;

        if (gx >= 0 && gx < width && gy >= 0 && gy < height) {
          const cell = (grid && grid[gy]) ? grid[gy][gx] : null;
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

  onLanguageChanged() {
    this._lastActionHtml = null;
    this._lastInvHtml = null;
    const isEn = this.currentLanguage === 'en';

    // 静的DOMヘッダー・ボタンの更新
    this.updateViewButtonText();
    this.updateZoomButtonText();

    const elInvHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(1) .gkl-card-header span');
    if (elInvHeader) elInvHeader.textContent = isEn ? '🎒 Inventory Items (Icon Inventory)' : '🎒 所持品アイテム (Icon Inventory)';

    const elBtnRefreshInv = document.getElementById('btn-refresh-inv');
    if (elBtnRefreshInv) elBtnRefreshInv.textContent = isEn ? '🔄 Sync' : '🔄 同期';

    const elActHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(2) .gkl-card-header span');
    if (elActHeader) elActHeader.textContent = isEn ? '🧠 Recommended Actions (ContextActions)' : '🧠 推奨アクション (ContextActions)';

    const elKnHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(3) .gkl-card-header span');
    if (elKnHeader) elKnHeader.textContent = isEn ? '💡 Structured Knowledge (GKL Knowledge)' : '💡 構造化ナレッジ (GKL Knowledge)';

    const tabBtnAdvices = document.getElementById('tab-btn-advices');
    const tabAdvicesBadge = document.getElementById('tab-advices-badge');
    if (tabBtnAdvices) {
      tabBtnAdvices.title = isEn ? 'Show Tactical Advices & Danger Alerts' : '戦術アドバイス ＆ 危険警告を表示';
      const badgeCount = tabAdvicesBadge ? tabAdvicesBadge.textContent : '0';
      const isBadgeHidden = tabAdvicesBadge ? tabAdvicesBadge.classList.contains('hidden') : false;
      tabBtnAdvices.innerHTML = `🛡️ ${isEn ? 'Advices' : 'アドバイス'} <span id="tab-advices-badge" class="gkl-badge${isBadgeHidden ? ' hidden' : ''}">${badgeCount}</span>`;
    }

    const tabBtnKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabBtnKnowledge) {
      tabBtnKnowledge.title = isEn ? 'Show Structured Knowledge' : '直前に調査した構造化ナレッジを表示';
      tabBtnKnowledge.textContent = isEn ? '💡 Knowledge' : '💡 ナレッジ';
    }

    const btnStartResume = document.getElementById('btn-start-resume');
    if (btnStartResume) btnStartResume.textContent = isEn ? '▶️ Continue Game' : '▶️ セーブデータから再開';

    const btnStartNew = document.getElementById('btn-start-new');
    if (btnStartNew) btnStartNew.textContent = isEn ? '⚠️ New Game (Delete Save)' : '⚠️ 新規ゲーム開始 (セーブ破棄)';

    if (this.core && this.core.gkl) {
      if (typeof this.core.gkl.setLanguage === 'function') {
        this.core.gkl.setLanguage(this.currentLanguage);
      }
      const situation = this.core.gkl.getSituation();
      this.renderGklActions(situation.actions || []);
      this.renderGklInventory(situation.inventory);
      this.renderGklAttributes(situation.attributes);
      this.renderGklSpells(situation.spells);
      this.renderGklSkills(situation.skills);
    }
  }

  /**
   * 💡 構造化ナレッジ ↔ 🛡️ 戦術アドバイス のボトムタブ切り替え
   * @param {'advices'|'knowledge'} tabName 
   * @param {Object} [target=null]
   * @param {Object} [options={}]
   */
  switchBottomTab(tabName, target = null, options = {}) {
    this.currentBottomTab = tabName;

    const tabAdvices = document.getElementById('tab-btn-advices');
    const tabKnowledge = document.getElementById('tab-btn-knowledge');

    if (tabAdvices) {
      if (tabName === 'advices') tabAdvices.classList.add('active');
      else tabAdvices.classList.remove('active');
    }
    if (tabKnowledge) {
      if (tabName === 'knowledge') tabKnowledge.classList.add('active');
      else tabKnowledge.classList.remove('active');
    }

    if (tabName === 'advices') {
      this.renderSideAdvices();
    } else {
      this.renderKnowledgeCard(target || this.lastKnowledgeTarget, options);
    }
  }

  renderKnowledgeCard(target, options = {}) {
    if (!this.elGklKnowledgeContent) return;
    const isEn = this.currentLanguage === 'en';
    if (target) {
      this.lastKnowledgeTarget = target;
    }

    if (!target) {
      this.switchBottomTab('advices');
      return;
    }

    // ナレッジタブのアクティブ化
    const tabAdvices = document.getElementById('tab-btn-advices');
    const tabKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabAdvices) tabAdvices.classList.remove('active');
    if (tabKnowledge) tabKnowledge.classList.add('active');
    this.currentBottomTab = 'knowledge';

    let data = null;
    let dynamicState = options.dynamicState || target.dynamicState || null;
    let isPet = target.type === 'PET' || (target.entity && target.entity.type === 'PET');
    let isPlayer = options.isPlayer || target.isPlayer || target.type === 'PLAYER' || (dynamicState && dynamicState.isPlayer);

    // 👤 1. プレイヤー自身の場合はリアルタイムステータスカードを優先採用
    if (isPlayer) {
      data = (target && target.stats && target.stats.hp) ? target : {
        name: isEn ? 'You (Player)' : '自分 (Player)',
        category: 'PLAYER',
        dangerLevel: 'NONE',
        dispositionStatus: 'PLAYER',
        stats: { hd: 'Player', ac: 'Self', speed: 'Self', mr: 0 },
        effectSummary: isEn ? 'The adventurer exploring the Mazes of Menace.' : 'ダンジョンを探索中のプレイヤー自身です。'
      };
    } else if (target && typeof target === 'object' && target.knowledge) {
      // 🎒 所持品アイテム等: すでにキャッシュされたナレッジと最新動的状態を安全に合成
      data = {
        ...target.knowledge,
        rawText: target.rawText || target.knowledge.rawText,
        identification: target.identification || target.knowledge.identification,
        bucStatus: target.bucStatus || target.knowledge.bucStatus,
        isWielded: target.isWielded,
        isOffhand: target.isOffhand,
        isQuivered: target.isQuivered,
        isWorn: target.isWorn,
        letter: target.letter
      };
    } else if (target && (target.dangerLevel || target.category || target.isUnidentified || target.effectSummary)) {
      // すでに完全な構造化カードデータである場合
      data = target;
    } else if (this.core && this.core.gkl && this.core.gkl.structuredKnowledge) {
      // 🎯 2. 万能統合ナレッジアクセサ getKnowledge を直接安全呼び出し
      data = this.core.gkl.structuredKnowledge.getKnowledge(target, { dynamicState, isPet, isPlayer, translate: true, language: this.currentLanguage });
    }

    if (!data && target && typeof target === 'object' && target.knowledge) {
      data = target.knowledge;
    }

    if (!data) {
      this.elGklKnowledgeContent.innerHTML = `<div class="gkl-empty-hint">${isEn ? 'No knowledge data available' : '該当するナレッジ情報がありません'}</div>`;
      return;
    }

    // 🎯 3. 明確な型判定: モンスター/ペット/プレイヤー vs アイテム/死体/地形
    const isMonsterType = data.dangerLevel || data.category === 'MONSTER' || data.dispositionStatus || isPet;

    if (isMonsterType) {
      const badgeClass = `kn-danger-${data.dangerLevel || 'MEDIUM'}`;
      let dispositionBadge = '';
      let dispositionNote = '';

      if (data.dispositionStatus === 'PEACEFUL') {
        dispositionBadge = `<span class="kn-status-badge kn-status-peaceful">${isEn ? '☮️ Peaceful (SAFE)' : '☮️ 平和的 (SAFE)'}</span>`;
      } else if (data.dispositionStatus === 'DEFAULT_PEACEFUL') {
        dispositionBadge = `<span class="kn-status-badge kn-status-peaceful">${isEn ? '☮️ Normally Peaceful' : '☮️ 通常平和 (SAFE)'}</span>`;
        dispositionNote = `<div style="font-size:11px; color:#a6adc8; margin-top:4px;">${isEn ? '※ Normally peaceful; becomes hostile (LETHAL) if attacked or stolen from.' : '※ 通常は平和的ですが、攻撃・泥棒を行うと敵対化 (LETHAL) します'}</div>`;
      } else if (data.dispositionStatus === 'TAMED' || isPet) {
        dispositionBadge = `<span class="kn-status-badge kn-status-tamed">${isEn ? '🐾 Pet (TAMED)' : '🐾 ペット (TAMED)'}</span>`;
      } else if (data.dispositionStatus === 'PLAYER' || isPlayer) {
        dispositionBadge = `<span class="kn-status-badge kn-status-player">${isEn ? '👤 Player' : '👤 プレイヤー'}</span>`;
      } else {
        dispositionBadge = `<span class="kn-status-badge kn-status-hostile">${isEn ? `⚔️ Hostile (${data.dangerLevel || 'LETHAL'})` : `⚔️ 敵対的 (${data.dangerLevel || 'LETHAL'})`}</span>`;
      }

      const clickBadge = options.isClickConfirmed ? `<span class="kn-status-badge kn-status-confirmed">${isEn ? '🔍 Look Inspected' : '🔍 Look確認済み'}</span>` : '';

      this.elGklKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.name}</span>
            <span class="kn-danger-badge ${badgeClass}">${data.dangerLevel || 'MEDIUM'} DANGER</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin:4px 0 6px 0;">
            ${dispositionBadge}
            ${clickBadge}
          </div>
          ${dispositionNote}
          <div class="kn-stats-row" style="margin-top:6px; flex-wrap:wrap; gap:8px;">
            <span>HD/Lv:${data.stats?.hd ?? '-'}</span>
            <span>AC:${data.stats?.ac ?? '-'}</span>
            ${data.stats?.hp ? `<span style="color:#4ade80;">HP:${data.stats.hp}</span>` : ''}
            ${data.stats?.pw ? `<span style="color:#60a5fa;">Pw:${data.stats.pw}</span>` : ''}
            ${data.stats?.gold ? `<span style="color:#facc15;">${isEn ? 'Gold:' : '金:'}${data.stats.gold}</span>` : ''}
            ${data.stats?.dlvl ? `<span>${data.stats.dlvl}</span>` : ''}
            ${data.inventoryCount !== undefined ? `<span style="color:#c084fc;">🎒${isEn ? 'Items:' : '所持品:'}${data.inventoryCount}</span>` : ''}
          </div>
          ${data.corpseInfo?.warningNote ? `<div class="kn-warning-box">⚠️ ${data.corpseInfo.warningNote}</div>` : ''}
          ${data.effectSummary ? `<div style="font-size:12px; margin-top:4px;">${data.effectSummary}</div>` : ''}
          ${data.tacticalAdvice && data.tacticalAdvice.length > 0 ? `
            <div style="margin-top:6px;">
              <div class="kn-section-label">💡 ${isEn ? 'Tactical Advice' : '実戦戦術アドバイス'}</div>
              <ul class="kn-advice-list">${data.tacticalAdvice.map(adv => `<li>• ${adv}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      // 🎒 4. アイテム / 死体 / 地形カードのレンダリング
      let statsHtml = '';
      const sm = this.core?.gkl?.skillStateManager || null;
      const adaptiveSpecs = getAdaptiveItemSpecs(data, { skillStateManager: sm, language: this.currentLanguage });

      if (adaptiveSpecs.length > 0) {
        statsHtml = `
          <div class="kn-stats-row" style="margin:6px 0; padding:6px 10px; background:rgba(56, 189, 248, 0.15); border:1px solid rgba(56, 189, 248, 0.3); border-radius:4px; font-size:12px; color:#38bdf8; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
            ${adaptiveSpecs.map(s => {
              const borderStyle = s.highlight ? 'border:1px solid #38bdf8; background:rgba(56,189,248,0.2);' : 'border:1px solid #475569; background:rgba(255,255,255,0.05);';
              const valColor = s.highlight ? '#f8fafc' : '#cbd5e1';
              const labelColor = s.highlight ? '#38bdf8' : '#94a3b8';
              const skillBadgeHtml = s.skillBadge ? `<span style="color:#22c55e; font-weight:bold; margin-left:4px;">${s.skillBadge.label}</span>` : '';
              return `
                <span style="${borderStyle} padding:2px 6px; border-radius:3px;">
                  <span style="color:${labelColor}; font-size:10px;">${s.label}:</span>
                  <strong style="color:${valColor};">${s.value}</strong>
                  ${skillBadgeHtml}
                </span>
              `;
            }).join('')}
          </div>
        `;
      }

      let bucHtml = '';
      if (data.bucEffects) {
        const b = data.bucEffects;
        const bParts = [];
        if (b.blessed) bParts.push(`<li style="color:#2ecc71;"><strong>${isEn ? 'Blessed:' : '祝福:'}</strong> ${b.blessed}</li>`);
        if (b.uncursed) bParts.push(`<li style="color:#bdc3c7;"><strong>${isEn ? 'Uncursed:' : '通常:'}</strong> ${b.uncursed}</li>`);
        if (b.cursed) bParts.push(`<li style="color:#e74c3c;"><strong>${isEn ? 'Cursed:' : '呪い:'}</strong> ${b.cursed}</li>`);
        if (bParts.length > 0) {
          bucHtml = `<div><div class="kn-section-label">⚖️ ${isEn ? 'BUC Effects' : 'BUC効果'}</div><ul class="kn-advice-list">${bParts.join('')}</ul></div>`;
        }
      }

      let adviceHtml = '';
      if (data.usageAdvice && data.usageAdvice.length > 0) {
        adviceHtml = `
          <div style="margin-top:6px;">
            <div class="kn-section-label">💡 ${isEn ? 'Usage & Strategy Advice' : '用途・活用アドバイス'}</div>
            <ul class="kn-advice-list">${data.usageAdvice.map(adv => `<li>• ${adv}</li>`).join('')}</ul>
          </div>
        `;
      }

      let tipsHtml = '';
      if (data.unidentifiedTips && data.unidentifiedTips.length > 0) {
        tipsHtml = `
          <div style="margin-top:6px;">
            <div class="kn-section-label">🔍 ${isEn ? 'Identification Tips' : '識別戦術テクニック'}</div>
            <ul class="kn-advice-list">${data.unidentifiedTips.map(tip => `<li>• ${tip}</li>`).join('')}</ul>
          </div>
        `;
      }

      const id = data.identification || (data.knowledge && data.knowledge.identification) || {};
      const isUnid = !!id.isUnidentified || !!data.isUnidentified;
      const canBeUnid = (data.canBeUnidentified !== undefined) ? !!data.canBeUnidentified : isUnid;
      const rawLower = (data.rawText || data.name || '').toLowerCase();
      const bucStatus = id.bucStatus || data.bucStatus || (rawLower.includes('blessed') ? 'BLESSED' : rawLower.includes('cursed') ? 'CURSED' : rawLower.includes('uncursed') ? 'UNCURSED' : 'UNKNOWN');

      const idBadges = [];
      if (canBeUnid) {
        if (isUnid) {
          idBadges.push(`<span class="kn-status-badge kn-status-unid">${isEn ? '🔍 UNIDENTIFIED' : '🔍 未識別 (UNIDENTIFIED)'}</span>`);
        } else {
          idBadges.push(`<span class="kn-status-badge kn-status-known">${isEn ? '✅ IDENTIFIED' : '✅ 識別済み (IDENTIFIED)'}</span>`);
        }
      }

      if (bucStatus === 'BLESSED') {
        idBadges.push(`<span class="kn-status-badge kn-status-blessed">${isEn ? '✨ BLESSED' : '✨ 祝福 (BLESSED)'}</span>`);
      } else if (bucStatus === 'CURSED') {
        idBadges.push(`<span class="kn-status-badge kn-status-cursed">${isEn ? '💀 CURSED' : '💀 呪い (CURSED)'}</span>`);
      } else if (bucStatus === 'UNCURSED' && canBeUnid) {
        idBadges.push(`<span class="kn-status-badge kn-status-uncursed">${isEn ? '⚪ UNCURSED' : '⚪ 通常 (UNCURSED)'}</span>`);
      }

      if (id.appearanceName) {
        idBadges.push(`<span class="kn-status-badge kn-status-named">${isEn ? `🎨 Appearance: ${id.appearanceName}` : `🎨 外見: ${id.appearanceName}`}</span>`);
      }
      if (id.calledName) {
        idBadges.push(`<span class="kn-status-badge kn-status-named">${isEn ? `🏷️ Called: ${id.calledName}` : `🏷️ 仮名: ${id.calledName}`}</span>`);
      }

      this.elGklKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.name}</span>
            <span class="kn-category-badge">${data.category || 'ITEM'}</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin:4px 0 6px 0;">
            ${idBadges.join('')}
          </div>
          ${statsHtml}
          ${data.effectSummary ? `<div style="font-size:12px; margin-top:4px;">${data.effectSummary}</div>` : ''}
          ${data.flavorNote ? `<div style="font-style:italic; font-size:11px; color:#94a3b8; margin:4px 0;">" ${data.flavorNote} "</div>` : ''}
          ${bucHtml}
          ${tipsHtml}
          ${adviceHtml}
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
    const isEn = this.currentLanguage === 'en';

    const dirNameMapEn = {
      'ALL': 'All',
      'N': 'N', 'NE': 'NE', 'E': 'E', 'SE': 'SE',
      'S': 'S', 'SW': 'SW', 'W': 'W', 'NW': 'NW',
      'SELF': 'Self'
    };
    const dirNameMapJa = {
      'ALL': '全て',
      'N': '北 (N)', 'NE': '北東 (NE)', 'E': '東 (E)', 'SE': '南東 (SE)',
      'S': '南 (S)', 'SW': '南西 (SW)', 'W': '西 (W)', 'NW': '北西 (NW)',
      'SELF': '足元 (SELF)'
    };
    const dirNameMap = isEn ? dirNameMapEn : dirNameMapJa;

    const dirTitleMapEn = {
      'NW': 'Northwest (7 / y / ↖)',
      'N': 'North (8 / k / ↑)',
      'NE': 'Northeast (9 / u / ↗)',
      'W': 'West (4 / h / ←)',
      'SELF': 'Self / Feet (5 / . / ·)',
      'E': 'East (6 / l / →)',
      'SW': 'Southwest (1 / b / ↙)',
      'S': 'South (2 / j / ↓)',
      'SE': 'Southeast (3 / n / ↘)'
    };
    const dirTitleMapJa = {
      'NW': '北西 (7 / y / ↖)',
      'N': '北 (8 / k / ↑)',
      'NE': '北東 (9 / u / ↗)',
      'W': '西 (4 / h / ←)',
      'SELF': '足元 (5 / . / ・)',
      'E': '東 (6 / l / →)',
      'SW': '南西 (1 / b / ↙)',
      'S': '南 (2 / j / ↓)',
      'SE': '南東 (3 / n / ↘)'
    };
    const dirTitleMap = isEn ? dirTitleMapEn : dirTitleMapJa;

    // リセットボタンの状態
    if (this.elBtnDirReset) {
      this.elBtnDirReset.classList.toggle('active', this.selectedDir === 'ALL');
      this.elBtnDirReset.textContent = isEn ? 'Show All (ALL)' : '全表示 (ALL)';
      this.elBtnDirReset.title = isEn ? 'Clear Filter (Show All)' : 'フィルター解除 (すべて表示)';
    }

    // ラベル表示
    if (this.elGklFilterLabel) {
      this.elGklFilterLabel.textContent = isEn
        ? `Filter: ${dirNameMap[this.selectedDir] || this.selectedDir}`
        : `表示: ${dirNameMap[this.selectedDir] || this.selectedDir}`;
    }

    // 各方向ボタンの表示更新
    const buttons = this.elGklDirectionPad.querySelectorAll('.gkl-dir-btn');
    buttons.forEach(btn => {
      const dir = btn.dataset.dir;
      const count = dirCounts.get(dir) || 0;
      const badge = btn.querySelector('.gkl-dir-badge');

      if (dirTitleMap[dir]) {
        btn.title = dirTitleMap[dir];
      }

      if (dir === 'SELF') {
        btn.innerHTML = `${isEn ? 'Self' : '足元'}<span class="gkl-dir-badge">${count > 0 ? count : ''}</span>`;
      } else if (badge) {
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
    const isEn = this.currentLanguage === 'en';

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
    const actionKeyStr = `${this.currentLanguage}_${this.selectedDir}_${filteredActions.map(a => `${a.id}:${a.label}`).join('|')}`;
    if (this._lastActionHtml !== actionKeyStr) {
      this._lastActionHtml = actionKeyStr;

      const newHtml = filteredActions.length === 0 
        ? `<div class="gkl-empty-hint">${this.selectedDir === 'ALL' ? (isEn ? 'Recommended actions for nearby targets will be shown automatically' : '周辺環境に応じたアクションが自動表示されます') : (isEn ? 'No recommended actions in this direction' : 'この方向の推奨アクションはありません')}</div>`
        : filteredActions.map(action => `
            <button class="gkl-action-btn ${action.risk === 'danger' ? 'danger' : ''}" data-act-id="${action.id}">
              <span>${action.label}</span>
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
              const confirmMsg = isEn ? `[⚠️ Dangerous Action]\nExecute "${action.label}"?` : `【⚠️ 危険な行動】\n"${action.label}" を実行しますか？`;
              if (!confirm(confirmMsg)) return;
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
    const isEn = this.currentLanguage === 'en';
    const items = inventory.items || [];
    this.elGklInvCount.textContent = items.length;

    const newHtml = items.length === 0
      ? `<div class="gkl-empty-hint">${isEn ? 'Inventory Empty' : 'インベントリ空'}</div>`
      : items.map(item => {
          const equipClasses = [];
          if (item.isWielded) equipClasses.push('is-wielded');
          if (item.isOffhand) equipClasses.push('is-offhand');
          if (item.isQuivered) equipClasses.push('is-quivered');
          if (item.isWorn) equipClasses.push('is-worn');
          const equipClassStr = equipClasses.join(' ');

          let badgeHtml = '';
          if (item.isWielded) badgeHtml = `<span class="gkl-slot-equip-badge badge-wielded" title="${isEn ? 'Main weapon' : 'メイン武器'}">${isEn ? 'Main' : '手'}</span>`;
          else if (item.isOffhand) badgeHtml = `<span class="gkl-slot-equip-badge badge-offhand" title="${isEn ? 'Off-hand weapon' : '副武器'}">${isEn ? 'Off' : '副'}</span>`;
          else if (item.isQuivered) badgeHtml = `<span class="gkl-slot-equip-badge badge-quivered" title="${isEn ? 'Quiver' : '矢筒'}">${isEn ? 'Quiv' : '筒'}</span>`;
          else if (item.isWorn) badgeHtml = `<span class="gkl-slot-equip-badge badge-worn" title="${isEn ? 'Worn' : '着用中'}">${isEn ? 'Worn' : '着'}</span>`;

          let skillBadgeHtml = '';
          if (item.skillBadge?.isProficient || item.isRecommendedWeapon) {
            skillBadgeHtml = `<span class="gkl-slot-equip-badge" style="background:#22c55e; color:#000; font-weight:bold; right:auto; left:2px;" title="${isEn ? 'Proficient weapon' : '得意武器'} (${item.skillBadge?.label || '+'})">+</span>`;
          }

          const id = item.identification || (item.knowledge && item.knowledge.identification) || {};
          const isUnidentified = !!id.isUnidentified;
          const rawLower = (item.rawText || '').toLowerCase();
          const bucStatus = id.bucStatus || (rawLower.includes('blessed') ? 'BLESSED' : rawLower.includes('cursed') ? 'CURSED' : rawLower.includes('uncursed') ? 'UNCURSED' : 'UNKNOWN');

          let bucBadgeHtml = '';
          if (isUnidentified) {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-unid" title="${isEn ? 'Unidentified' : '未識別'}">?</span>`;
          } else if (bucStatus === 'CURSED') {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-cursed" title="${isEn ? 'Cursed' : '呪い'}">-</span>`;
          } else if (bucStatus === 'BLESSED') {
            bucBadgeHtml = `<span class="gkl-slot-buc-badge badge-buc-blessed" title="${isEn ? 'Blessed' : '祝福'}">+</span>`;
          }

          return `
            <div class="gkl-item-slot ${equipClassStr}" data-letter="${item.letter}" data-rawtext="${encodeURIComponent(item.rawText)}">
              <span class="gkl-slot-letter">${item.letter}</span>
              <div class="gkl-slot-icon" id="slot-icon-${item.letter}"></div>
              ${badgeHtml}
              ${skillBadgeHtml}
              ${bucBadgeHtml}
            </div>
          `;
        }).join('');

    if (this._lastInvHtml !== `${this.currentLanguage}_${newHtml}`) {
      this._lastInvHtml = `${this.currentLanguage}_${newHtml}`;
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

            if (item.isWielded) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#e9c46a;color:#1a1a2e;font-weight:bold;">${isEn ? 'Main weapon' : '手持ち武器'}</span>`;
            if (item.isOffhand) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#4ea8de;color:#0f172a;font-weight:bold;">${isEn ? 'Off-hand weapon' : '副武器'}</span>`;
            if (item.isQuivered) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#2a9d8f;color:#fff;font-weight:bold;">${isEn ? 'Quiver' : '矢筒'}</span>`;
            if (item.isWorn) this.elGklTtTags.innerHTML += `<span class="tag" style="background:#9d4edd;color:#fff;font-weight:bold;">${isEn ? 'Worn' : '着用中'}</span>`;

            const tapAction = item.knowledge?.actionLabel || item.defaultActionLabel;
            if (tapAction && item.defaultVerb) {
              this.elGklTtTags.innerHTML += `<span class="tag" style="background:#2a9d8f;color:#ffffff;font-weight:bold;">${isEn ? 'One-Tap:' : 'ワンタップ:'} ${tapAction}</span>`;
            }

            if (item.isPickAxe) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Dig(a)' : '掘削(a)'}</span>`;
            if (item.isDigWand) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Wand of Digging(z)' : '採掘の杖(z)'}</span>`;
            if (item.isKey) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Key/Lockpick' : '鍵・ピック'}</span>`;
            if (item.isAxe) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Axe' : '斧'}</span>`;
            if (item.isFrostWand) this.elGklTtTags.innerHTML += `<span class="tag">${isEn ? 'Wand of Cold' : '氷の杖'}</span>`;

            this.elGklTooltip.classList.remove('hidden');
          };

          slot.onmouseleave = () => {
            this.elGklTooltip.classList.add('hidden');
          };

          // 2段目アクションメニュー起動関数 (長押し / 右クリック)
          const triggerActionMenu = async () => {
            if (!this.core || !this.core.driver) return;
            this.elGklTooltip.classList.add('hidden');
            if (typeof this.appendLog === 'function') {
              this.appendLog(`[Action] アイテム '${item.letter}' (${item.rawText || ''}) のアクションメニューを起動...`);
            }
            // 1段目インベントリをサイレント通過して2段目アクションメニューを表示
            await this.core.driver.queueSequence(['i', item.letter], { isSilentSync: true });
          };

          // 通常クリック処理 (短タップ)
          const triggerNormalClick = async () => {
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

          // 長押し (Pointer Events) & 通常クリック分離ハンドラ
          let pressTimer = null;
          let isLongPress = false;
          const LONG_PRESS_MS = 400;

          slot.onpointerdown = (e) => {
            if (e.button !== 0) return; // 左クリック / タッチのみ
            isLongPress = false;
            slot.classList.add('pressing');

            pressTimer = setTimeout(() => {
              isLongPress = true;
              slot.classList.remove('pressing');
              if (navigator.vibrate) navigator.vibrate(25);
              triggerActionMenu();
            }, LONG_PRESS_MS);
          };

          slot.onpointerup = (e) => {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
            slot.classList.remove('pressing');

            if (!isLongPress && e.button === 0) {
              triggerNormalClick();
            }
          };

          const cancelPress = () => {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
            slot.classList.remove('pressing');
          };

          slot.onpointercancel = cancelPress;
          slot.onpointerleave = cancelPress;

          // PC向け: 右クリックでも即座に2段目アクションメニューを起動
          slot.oncontextmenu = (e) => {
            e.preventDefault();
            cancelPress();
            triggerActionMenu();
          };
        }
      });
    }
  }

  /**
   * 属性耐性・固有能力の描画 (所持している有効耐性・付加能力を全件表示)
   * @param {Object} attrObj 
   */
  renderGklAttributes(attrObj) {
    const elBadges = document.getElementById('status-attr-badges');
    const elDetail = document.getElementById('status-attr-detail');
    const elContainer = document.getElementById('gkl-attributes-list') || elDetail;
    const res = attrObj?.effectiveResistances || {};
    const isEn = this.currentLanguage === 'en';

    if (elBadges) {
      elBadges.innerHTML = '';
    }

    if (!elContainer) return;

    const activeRes = ATTRIBUTE_DEFINITIONS.filter(item => Boolean(res[item.key]));

    if (activeRes.length === 0) {
      elContainer.innerHTML = `<span style="color:#64748b; font-size:11px;">${isEn ? '🛡️ Resistances: None' : '🛡️ 属性耐性: なし'}</span>`;
    } else {
      const activeHtml = activeRes.map(item => {
        const displayLabel = isEn ? (item.en || item.label) : item.label;
        return `<span class="gkl-attr-badge active" title="${item.label} / ${item.en} (有効)">${displayLabel}</span>`;
      }).join(' ');
      elContainer.innerHTML = `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong style="font-size:11px; color:#94a3b8;">${isEn ? '🛡️ Resistances:' : '🛡️ 属性・能力:'}</strong> ${activeHtml}</div>`;
    }
  }

  /**
   * 習得呪文の詠唱 (#cast / Z) を実行
   * @param {string} [letter] 
   */
  castSpell(letter) {
    if (letter) {
      if (this.core && this.core.gkl && typeof this.core.gkl.castSpell === 'function') {
        return this.core.gkl.castSpell(letter);
      }
      if (this.core && this.core.driver && typeof this.core.driver.queueSequence === 'function') {
        return this.core.driver.queueSequence(['Z', letter]);
      }
    }
    if (this.core && typeof this.core.sendKey === 'function') {
      return this.core.sendKey('Z', true, false, false, 'Z', true);
    }
  }

  /**
   * スキル向上 (#enhance) を実行
   * @param {Object|string} [skill] 
   */
  enhanceSkill(skill) {
    if (this.core && this.core.gkl && typeof this.core.gkl.enhanceSkill === 'function') {
      return this.core.gkl.enhanceSkill(skill);
    }
    if (this.core && typeof this.core.sendKey === 'function') {
      return this.core.sendKey('Hash');
    }
  }

  /**
   * 修得魔法一覧の描画 (StatusBar 内)
   * @param {Object} spellsObj 
   */
  renderGklSpells(spellsObj) {
    const elSpellsDetail = document.getElementById('status-spells-detail');
    if (!elSpellsDetail) return;
    const isEn = this.currentLanguage === 'en';
    const spells = spellsObj?.items || [];

    if (spells.length === 0) {
      elSpellsDetail.innerHTML = `<span style="color:#64748b; font-size:11px;">${isEn ? '📖 Spells: None' : '📖 修得魔法: なし'}</span>`;
      return;
    }

    const listHtml = spells.map(sp => {
      const titleStr = isEn
        ? `Key: ${sp.letter}, Lv.${sp.level} ${sp.category} (Fail: ${sp.failRate}) - Click to cast`
        : `キー: ${sp.letter}, Lv.${sp.level} ${sp.category} (失敗率: ${sp.failRate}) - クリックで詠唱`;
      return `<button class="gkl-spell-badge" data-letter="${sp.letter}" style="background:rgba(139, 92, 246, 0.15); border:1px solid #a78bfa; color:#ddd6fe; padding:2px 8px; border-radius:4px; font-size:11px; font-family:inherit; cursor:pointer;" title="${titleStr}">✨ [${sp.letter}] ${sp.name} <small style="color:#94a3b8;">(Lv.${sp.level} ${sp.failRate})</small></button>`;
    }).join(' ');

    elSpellsDetail.innerHTML = `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong style="font-size:11px; color:#94a3b8;">${isEn ? '📖 Spells:' : '📖 修得魔法:'}</strong> ${listHtml}</div>`;

    elSpellsDetail.querySelectorAll('.gkl-spell-badge').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const letter = btn.dataset.letter;
        if (letter) this.castSpell(letter);
      };
    });
  }

  /**
   * 🥋 スキル熟練度一覧の描画
   * @param {Object} skillsObj 
   */
  renderGklSkills(skillsObj) {
    const elSkillsDetail = document.getElementById('status-skills-detail');
    if (!elSkillsDetail) return;
    const isEn = this.currentLanguage === 'en';

    const activeSkills = skillsObj ? (skillsObj.activeItems || []) : [];
    if (!skillsObj || !skillsObj.isSynced) {
      elSkillsDetail.innerHTML = `<span style="color:#64748b; font-size:11px;">${isEn ? '🥋 Skills: Not Synced' : '🥋 スキル: 未同期'}</span>`;
      return;
    }

    if (activeSkills.length === 0) {
      elSkillsDetail.innerHTML = `<span style="color:#64748b; font-size:11px;">${isEn ? '🥋 Skills: None (Unskilled)' : '🥋 スキル: なし (未熟)'}</span>`;
      return;
    }

    const listHtml = activeSkills.map(skill => {
      const rankKey = skill.rank ? skill.rank.key : 'basic';
      const rankLabel = isEn
        ? (skill.rank ? (skill.rank.en || skill.rank.label) : 'Basic')
        : (skill.rank ? (skill.rank.label || skill.rank.en) : '入門');
      const enhClass = skill.canEnhance ? 'enhanceable' : '';
      const star = skill.canEnhance ? '⭐ ' : '';
      const hint = skill.canEnhance ? (isEn ? ' (Click to enhance)' : ' (クリックで向上)') : '';
      return `<span class="gkl-skill-badge gkl-skill-badge-${rankKey} ${enhClass}" data-letter="${skill.letter || ''}" title="${skill.rawText || skill.name}${hint}">${star}<strong>${skill.name}</strong> [${rankLabel}]</span>`;
    }).join(' ');

    elSkillsDetail.innerHTML = `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong style="font-size:11px; color:#94a3b8;">${isEn ? '🥋 Skills:' : '🥋 スキル:'}</strong> ${listHtml}</div>`;

    elSkillsDetail.querySelectorAll('.gkl-skill-badge.enhanceable').forEach(badge => {
      badge.onclick = (e) => {
        e.stopPropagation();
        this.enhanceSkill(badge.dataset.letter || undefined);
      };
    });
  }

  /**
   * 🛡️ 戦術アドバイス ＆ 危機警告の描画 (TacticalAdvisor)
   * @param {Array<Object>} advices 
   */
  renderGklAdvices(advices) {
    this.lastAdvices = advices || [];
    const isEn = this.currentLanguage === 'en';

    const hasCritical = this.lastAdvices.some(a => a.severity === 'CRITICAL');

    // 1. ステータスバーの緊急アラートバッジ更新 (CRITICAL 存在時のみ点灯)
    const elCritBadge = document.getElementById('st-advice-critical-badge');
    if (elCritBadge) {
      if (hasCritical) {
        elCritBadge.classList.remove('hidden');
        elCritBadge.textContent = isEn ? '🚨 Danger' : '🚨 危険';
      } else {
        elCritBadge.classList.add('hidden');
      }
    }

    // 2. 右サイドカードのアドバイスタブ・インジケータ更新
    const tabAdvicesBadge = document.getElementById('tab-advices-badge');
    const tabBtnAdvices = document.getElementById('tab-btn-advices');
    if (tabAdvicesBadge) {
      tabAdvicesBadge.textContent = `${this.lastAdvices.length}`;
      if (this.lastAdvices.length > 0) tabAdvicesBadge.classList.remove('hidden');
      else tabAdvicesBadge.classList.add('hidden');
    }
    if (tabBtnAdvices) {
      if (hasCritical) tabBtnAdvices.classList.add('has-critical');
      else tabBtnAdvices.classList.remove('has-critical');
    }

    // 3. 現在アドバイスタブが開いている場合、アドバイス一覧を自動反映
    if (this.currentBottomTab === 'advices') {
      this.renderSideAdvices();
    }
  }

  /**
   * 🛡️ 右サイド最下部カードへの戦術アドバイス一覧の描画
   */
  renderSideAdvices() {
    if (!this.elGklKnowledgeContent) return;
    const isEn = this.currentLanguage === 'en';
    const advices = this.lastAdvices || [];

    // タブのactive同期
    const tabAdvices = document.getElementById('tab-btn-advices');
    const tabKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabAdvices) tabAdvices.classList.add('active');
    if (tabKnowledge) tabKnowledge.classList.remove('active');
    this.currentBottomTab = 'advices';

    if (advices.length === 0) {
      this.elGklKnowledgeContent.innerHTML = `
        <div class="gkl-empty-hint" style="padding:16px 8px;">
          <div style="font-size:18px; margin-bottom:4px;">🛡️</div>
          <div style="color:#94a3b8; font-weight:500;">${isEn ? 'Tactical Status: Normal (Safe)' : '戦術状況: 平常 (安全)'}</div>
          <div style="color:#64748b; font-size:11px; margin-top:4px;">${isEn ? 'No immediate danger detected.<br>Click a tile or item to inspect knowledge.' : '直近の危険・戦術提案はありません。<br>マップや所持品を選択するとナレッジが表示されます。'}</div>
        </div>`;
      return;
    }

    const cardsHtml = advices.map(adv => {
      const sev = adv.severity || 'INFO';
      const msg = adv.message || (isEn ? adv.messageEn : adv.messageJa);
      const hintKey = adv.hintCommand ? `[${adv.hintCommand}]` : (adv.hintLetters && adv.hintLetters.length > 0 ? `[${adv.hintLetters.join(',')}]` : '');
      const hintHtml = hintKey ? `<span class="gkl-advice-card-hint">${hintKey}</span>` : '';

      let tagLabel = 'INFO';
      if (sev === 'CRITICAL') tagLabel = isEn ? 'CRITICAL' : '危険';
      else if (sev === 'WARNING') tagLabel = isEn ? 'WARNING' : '警告';
      else if (adv.topic === 'EQUIPMENT') tagLabel = isEn ? 'EQUIP' : '装備';
      else if (adv.topic === 'MAGIC') tagLabel = isEn ? 'MAGIC' : '魔法';
      else if (adv.topic === 'SURVIVAL') tagLabel = isEn ? 'SURVIVE' : '生存';

      return `
        <div class="gkl-side-advice-card severity-${sev}" title="${msg} (ホバーで全文表示)">
          <div class="gkl-side-advice-header">
            <div style="display:flex; align-items:center; gap:5px;">
              <span>${sev === 'CRITICAL' ? '🚨' : (sev === 'WARNING' ? '⚠️' : '💡')}</span>
              <span class="gkl-side-advice-tag">${tagLabel}</span>
            </div>
            ${hintHtml}
          </div>
          <div class="gkl-side-advice-body">
            <div class="gkl-side-advice-text">${msg}</div>
          </div>
        </div>
      `;
    }).join('');

    this.elGklKnowledgeContent.innerHTML = `
      <div class="gkl-side-advices-container">
        ${cardsHtml}
      </div>
    `;
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
    const areaGrid = (this.core && this.core.gkl && typeof this.core.gkl.getSituation === 'function') ? this.core.gkl.getSituation()?.area?.grid : null;

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
    if (this.isGraphicCanvasMode) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.renderColorAsciiMap();
    }
    if (this.zoomCtx && this.zoomCanvas) {
      this.zoomCtx.fillStyle = '#090916';
      this.zoomCtx.fillRect(0, 0, this.zoomCanvas.width, this.zoomCanvas.height);
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

    // 展開詳細ステータス (Str, Dex, Con, Int, Wis, Cha, Align, Exp, Turns, Score)
    if (status.stats) {
      if (this.elStStr) this.elStStr.textContent = status.stats.str !== undefined ? status.stats.str : '--';
      if (this.elStDex) this.elStDex.textContent = status.stats.dex !== undefined ? status.stats.dex : '--';
      if (this.elStCon) this.elStCon.textContent = status.stats.con !== undefined ? status.stats.con : '--';
      if (this.elStInt) this.elStInt.textContent = status.stats.int !== undefined ? status.stats.int : '--';
      if (this.elStWis) this.elStWis.textContent = status.stats.wis !== undefined ? status.stats.wis : '--';
      if (this.elStCha) this.elStCha.textContent = status.stats.cha !== undefined ? status.stats.cha : '--';
    }
    if (this.elStAlign) this.elStAlign.textContent = status.align || 'Neutral';

    // 累積経験値 (showexp オプション有効時 / status.hasExp かつ pts > 0 時のみ併記)
    if (this.elStExp) {
      const lvl = status.level !== undefined ? status.level : (status.xp !== undefined ? status.xp : 1);
      const pts = status.exp !== undefined ? status.exp : 0;
      if (status.hasExp && pts > 0) {
        this.elStExp.textContent = `${lvl}/${pts}`;
      } else {
        this.elStExp.textContent = `${lvl}`;
      }
    }

    // 経過ターン数 (time オプション有効時 / status.hasTime かつ turns > 0 時のみ表示)
    if (this.elStItemTurns && this.elStTurns) {
      if (status.hasTime || status.turns > 0) {
        this.elStItemTurns.classList.remove('hidden');
        this.elStTurns.textContent = String(status.turns);
      } else {
        this.elStItemTurns.classList.add('hidden');
      }
    }

    // スコア (showscore オプション有効時 / status.hasScore かつ score > 0 時のみ表示)
    if (this.elStItemScore && this.elStScore) {
      if (status.hasScore || status.score > 0) {
        this.elStItemScore.classList.remove('hidden');
        this.elStScore.textContent = String(status.score);
      } else {
        this.elStItemScore.classList.add('hidden');
      }
    }

    this.renderGklUi();
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

    if (data.inputType === 'DIRECTION' || category === 'DIRECTION') {
      this.isDirectionPromptActive = true;
      this.elPromptBar.classList.remove('hidden');
      const isEn = this.currentLanguage === 'en';
      const promptTitle = data.promptText || data.title || rawPrompt || (isEn ? 'In what direction?' : 'どの方向に？');
      this.elPromptText.textContent = promptTitle;
      this.elInputControls.innerHTML = `
        <div class="prompt-dir-container">
          <div class="prompt-dir-grid">
            <button class="prompt-dir-btn" data-dir="DIR_NW" title="7 / y (北西)"><span style="font-size:13px; font-weight:bold;">↖</span><span style="font-size:7px; opacity:0.8;">7 / y</span></button>
            <button class="prompt-dir-btn" data-dir="DIR_N"  title="8 / k (北)"><span style="font-size:13px; font-weight:bold;">↑</span><span style="font-size:7px; opacity:0.8;">8 / k</span></button>
            <button class="prompt-dir-btn" data-dir="DIR_NE" title="9 / u (北東)"><span style="font-size:13px; font-weight:bold;">↗</span><span style="font-size:7px; opacity:0.8;">9 / u</span></button>
            <button class="prompt-dir-btn" data-dir="DIR_W"  title="4 / h (西)"><span style="font-size:13px; font-weight:bold;">←</span><span style="font-size:7px; opacity:0.8;">4 / h</span></button>
            <button class="prompt-dir-btn self" data-dir="DIR_SELF" title=". (自身)"><span style="font-size:13px; font-weight:bold;">●</span><span style="font-size:7px; opacity:0.8;">. (自身)</span></button>
            <button class="prompt-dir-btn" data-dir="DIR_E"  title="6 / l (東)"><span style="font-size:13px; font-weight:bold;">→</span><span style="font-size:7px; opacity:0.8;">6 / l</span></button>
            <button class="prompt-dir-btn" data-dir="DIR_SW" title="1 / b (南西)"><span style="font-size:13px; font-weight:bold;">↙</span><span style="font-size:7px; opacity:0.8;">1 / b</span></button>
            <button class="prompt-dir-btn" data-dir="DIR_S"  title="2 / j (南)"><span style="font-size:13px; font-weight:bold;">↓</span><span style="font-size:7px; opacity:0.8;">2 / j</span></button>
            <button class="prompt-dir-btn" data-dir="DIR_SE" title="3 / n (南東)"><span style="font-size:13px; font-weight:bold;">↘</span><span style="font-size:7px; opacity:0.8;">3 / n</span></button>
          </div>
          <div class="prompt-dir-side-actions">
            <button class="prompt-dir-side-btn" data-dir="DIR_UP" title="上階 / 上方向 (<)">▲ ${isEn ? 'Up (<)' : '上方向 (<)'}</button>
            <button class="prompt-dir-side-btn" data-dir="DIR_DOWN" title="下階 / 下方向 (>)>">▼ ${isEn ? 'Down (>)' : '下方向 (>)'}</button>
            <button class="prompt-dir-side-btn cancel" id="btn-cancel-dir" title="取消 (ESC)">✖ ${isEn ? 'Cancel (ESC)' : '取消 (ESC)'}</button>
          </div>
        </div>
      `;

      this.elInputControls.querySelectorAll('button[data-dir]').forEach(btn => {
        btn.onclick = () => {
          this.core.respond(btn.dataset.dir);
        };
      });

      const btnCancel = document.getElementById('btn-cancel-dir');
      if (btnCancel) {
        btnCancel.onclick = () => {
          if (typeof this.core.cancelPrompt === 'function') {
            this.core.cancelPrompt();
          } else {
            this.core.respond('\x1b');
          }
        };
      }

      return;
    }

    if (data.options && data.options.length > 0) {
      this.elPromptBar.classList.remove('hidden');
      this.elPromptText.textContent = data.promptText || data.title || rawPrompt || 'Select Option';
      this.elInputControls.innerHTML = '';

      data.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.textContent = opt.label.includes(`(${opt.key})`) ? opt.label : `${opt.label} (${opt.key})`;
        btn.onclick = () => this.core.respond(opt.key);
        this.elInputControls.appendChild(btn);
      });

      return;
    }

    if (data.inputType === 'SINGLE_KEY' || category === 'YN' || data.context === 'yn_function') {
      this.elPromptBar.classList.remove('hidden');
      const promptTitle = data.promptText || data.title || rawPrompt || 'Press key...';
      this.elPromptText.textContent = promptTitle;
      this.elInputControls.innerHTML = `
        <span style="font-size:12px; color:var(--text-secondary); padding:4px 8px;">(1キー入力待機 / Press key)</span>
        <button id="btn-cancel-single-key" class="prompt-cancel-btn" style="padding:4px 10px; font-size:11px; margin-left:6px;">✖ 取消 (ESC)</button>
      `;
      const btnCancel = document.getElementById('btn-cancel-single-key');
      if (btnCancel) {
        btnCancel.onclick = () => {
          if (typeof this.core.cancelPrompt === 'function') {
            this.core.cancelPrompt();
          } else {
            this.core.respond('\x1b');
          }
        };
      }
      return;
    }

    this.elPromptBar.classList.add('hidden');

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
    this.lastAdvices = [];
    this.lastKnowledgeTarget = null;
    this.currentBottomTab = 'advices';
    this.userPreferredTab = 'advices';
    this.clearAllModals();
    this.clearMapGrid();
    this.elMessageLog.innerHTML = '';

    const elCritBadge = document.getElementById('st-advice-critical-badge');
    if (elCritBadge) elCritBadge.classList.add('hidden');

    this.renderSideAdvices();

    if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
      this.core.gkl.reset();
    }
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
    if (confirm("セーブファイルを完全に削除しますか？")) {
      this.resetUiForNewGame();
      this.elLoading.classList.remove('hidden');
      this.elGameOverModal.classList.add('hidden');
      this.elSelectorCard.classList.add('hidden');
      this.elSpinnerBox.classList.remove('hidden');

      await this.core.restart({ clearStorage: true, autoStart: false });
      await this.bootstrapGame();
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
