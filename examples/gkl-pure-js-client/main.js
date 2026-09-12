import { WebUICore } from '../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../src/driver/index.js';
import { GKLPlugin } from '../../src/core/knowledge/GKLPlugin.js';
import { OnDemandLookService } from '../../src/core/knowledge/OnDemandLookService.js';

import { MapRenderer } from './modules/renderers/MapRenderer.js';
import { ZoomRenderer } from './modules/renderers/ZoomRenderer.js';
import { KnowledgeView } from './modules/components/KnowledgeView.js';
import { InventoryView } from './modules/components/InventoryView.js';
import { AssistHud } from './modules/components/AssistHud.js';
import { DirectionPad } from './modules/components/DirectionPad.js';
import { StatusView } from './modules/components/StatusView.js';
import { ModalManager } from './modules/components/ModalManager.js';
import { ContainerModal } from './modules/components/ContainerModal.js';
import { KeyHandler } from './modules/handlers/KeyHandler.js';

/**
 * GklPureJSClient - GKL (Game Knowledge Layer) 統合 Pure JS クライアント メインコントローラー
 */
class GklPureJSClient {
  constructor() {
    console.log('[GKLpureJSclient] 🚀 Loaded main.js (build: 2026-09-11-v3)');
    this.core = null;
    this.lookService = null;
    this.currentLanguage = 'ja';
    this.userPreferredTab = 'advices';
    this.lastKnowledgeTarget = null;
    this.isGameExited = false;
    this.currentGameOverResult = null;

    // DOM Elements
    this.canvas = document.getElementById('game-canvas');
    this.asciiGrid = document.getElementById('ascii-grid');
    this.btnToggleView = document.getElementById('btn-toggle-view');
    this.btnToggleZoom = document.getElementById('btn-toggle-zoom');
    this.elMessageLog = document.getElementById('message-log');
    this.elGklTooltip = document.getElementById('gkl-item-tooltip');

    // 1. Map Renderer
    this.mapRenderer = new MapRenderer({
      canvas: this.canvas,
      asciiGrid: this.asciiGrid,
      btnToggleView: this.btnToggleView,
      getAreaGrid: () => this.core?.gkl?.getSituation()?.area?.grid
    });

    // 2. Zoom Camera Renderer
    this.zoomRenderer = new ZoomRenderer({
      zoomCanvas: document.getElementById('zoom-canvas'),
      zoomViewportBox: document.getElementById('zoom-viewport-box'),
      zoomPosBadge: document.getElementById('zoom-pos-badge'),
      btnToggleZoom: this.btnToggleZoom,
      getSituation: () => this.core?.gkl?.getSituation(),
      getGlyphBuffer: () => this.mapRenderer.glyphGridBuffer,
      getCore: () => this.core,
      tileImg: this.mapRenderer.tileImg,
      tileLoaded: this.mapRenderer.tileLoaded
    });

    // 3. Knowledge & Advices View
    this.knowledgeView = new KnowledgeView({
      elGklKnowledgeContent: document.getElementById('gkl-knowledge-content'),
      getCore: () => this.core,
      onTabChanged: (tabName) => {
        // Tab changed hook
      }
    });

    // 4. Inventory View
    this.inventoryView = new InventoryView({
      elGklInventoryGrid: document.getElementById('gkl-inventory-grid'),
      elGklInvCount: document.getElementById('gkl-inv-count'),
      elGklTooltip: this.elGklTooltip,
      elGklTtName: document.getElementById('gkl-tt-name'),
      elGklTtTags: document.getElementById('gkl-tt-tags'),
      getCore: () => this.core,
      getLoadedTileImagePath: () => this.mapRenderer.loadedTileImagePath,
      onInspectItem: (item) => this.knowledgeView.renderKnowledgeCard(item)
    });

    // 5. Assist HUD & Landmarks
    this.assistHud = new AssistHud({
      elAssistSignalBar: document.getElementById('assist-signal-bar'),
      elAssistSignalIcon: document.getElementById('assist-signal-icon'),
      elAssistSignalText: document.getElementById('assist-signal-text'),
      elBtnAssistAction: document.getElementById('btn-assist-action'),
      elAssistActionLabel: document.getElementById('assist-action-label'),
      elBtnAssistWhy: document.getElementById('btn-assist-why'),
      elAssistWhyTooltip: document.getElementById('assist-why-tooltip'),
      elFloorLandmarksHud: document.getElementById('floor-landmarks-hud'),
      elLandmarksFloorTag: document.getElementById('landmarks-floor-tag'),
      elLandmarksBadgesContainer: document.getElementById('landmarks-badges-container'),
      getCore: () => this.core,
      //appendLog: (msg) => this.addMessageLog(msg)
    });

    // 6. Direction Pad & Recommended Actions
    this.directionPad = new DirectionPad({
      elGklDirectionPad: document.getElementById('gkl-direction-pad'),
      elGklFilterLabel: document.getElementById('gkl-filter-label'),
      elBtnDirReset: document.getElementById('btn-dir-reset'),
      elGklActionList: document.getElementById('gkl-action-list'),
      elGklActionCount: document.getElementById('gkl-action-count'),
      getCore: () => this.core,
      onDirectionFiltered: () => this.renderGklUi()
    });

    // 7. Status Bar & Attributes & Spells & Skills
    this.statusView = new StatusView({
      elStatusBar: document.getElementById('status-bar'),
      elBtnToggleStatusDetails: document.getElementById('btn-toggle-status-details'),
      elStName: document.getElementById('st-name'),
      elStDlvl: document.getElementById('st-dlvl'),
      elStHp: document.getElementById('st-hp'),
      elStPw: document.getElementById('st-pw'),
      elStAc: document.getElementById('st-ac'),
      elStGold: document.getElementById('st-gold'),
      elStCond: document.getElementById('st-cond'),
      elHpBarFill: document.getElementById('hp-bar-fill'),
      elMpBarFill: document.getElementById('mp-bar-fill'),
      elStStr: document.getElementById('st-str'),
      elStDex: document.getElementById('st-dex'),
      elStCon: document.getElementById('st-con'),
      elStInt: document.getElementById('st-int'),
      elStWis: document.getElementById('st-wis'),
      elStCha: document.getElementById('st-cha'),
      elStAlign: document.getElementById('st-align'),
      elStExp: document.getElementById('st-exp'),
      elStTurns: document.getElementById('st-turns'),
      elStScore: document.getElementById('st-score'),
      elStItemTurns: document.getElementById('st-item-turns'),
      elStItemScore: document.getElementById('st-item-score'),
      getCore: () => this.core,
      getLoadedTileImagePath: () => this.mapRenderer.loadedTileImagePath
    });

    // 8. Modal Manager
    this.modalManager = new ModalManager({
      elPromptBar: document.getElementById('prompt-bar'),
      elPromptText: document.getElementById('prompt-text'),
      elInputControls: document.getElementById('input-controls'),
      elMenuModal: document.getElementById('menu-modal'),
      elMenuTitle: document.getElementById('menu-title'),
      elMenuItemsContainer: document.getElementById('menu-items-container'),
      elBtnCancelMenu: document.getElementById('btn-cancel-menu'),
      elGameOverModal: document.getElementById('gameover-modal'),
      elGameOverSummary: document.getElementById('gameover-summary'),
      elScoreboardContainer: document.getElementById('gameover-scoreboard'),
      elLoading: document.getElementById('loading-overlay'),
      elSpinnerBox: document.getElementById('loading-spinner-box'),
      elSelectorCard: document.getElementById('start-selector-card'),
      elSaveName: document.getElementById('start-save-name'),
      elWishModal: document.getElementById('wish-modal'),
      getCore: () => this.core,
      getLoadedTileImagePath: () => this.mapRenderer.loadedTileImagePath,
      onRestartGame: () => this.restartGame()
    });

    // 8.5 Container Modal (Two-Pane GUI)
    this.containerModal = new ContainerModal({
      elContainerModal: document.getElementById('container-modal'),
      getCore: () => this.core,
      getLoadedTileImagePath: () => this.mapRenderer.loadedTileImagePath,
    });

    // 9. Key Handler
    this.keyHandler = new KeyHandler({
      getCore: () => this.core,
      getModalManager: () => this.modalManager,
      getContainerModal: () => this.containerModal,
    });

    // 10. Startup Step Progression State
    this.isStartingUp = true;
    this.isSaveResuming = false;
    this.startupStep = 'INITIALIZING';

    this.init();
  }

  init() {
    this.mapRenderer.init();
    this.zoomRenderer.init();
    this.initCore();
    this.bindCoreEvents();
    this.bindDOMEvents();
    this.onLanguageChanged();
    this.bootstrapGame();
    this.zoomRenderer.startGklRenderLoop();
  }

  initCore() {
    const workerPath = '../../src/driver/nethack.worker.js';
    const bridge = new NetHackWasmWorkerBridge(workerPath);
    this.core = new WebUICore({ driver: bridge, keyMode: 'numpad' });
    this.currentLanguage = this.core.language || 'ja';

    this.lookService = new OnDemandLookService({ core: this.core });
  }

  setLanguage(lang) {
    if (this.core && typeof this.core.setLanguage === 'function') {
      this.core.setLanguage(lang);
    } else {
      this.currentLanguage = (lang === 'en' ? 'en' : 'ja');
      this.onLanguageChanged();
    }
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
        this.modalManager.elGameOverModal.classList.add('hidden');
        if (this.isStartingUp) {
          this.setStartupView(this.startupStep);
        } else {
          this.modalManager.elLoading.classList.remove('hidden');
        }
      } else if (state === 'READY' || state === 'RUNNING' || state === 'WAITING_INPUT') {
        if (!this.isStartingUp) {
          this.modalManager.elLoading.classList.add('hidden');
        }
        this.modalManager.elGameOverModal.classList.add('hidden');
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
      this.statusView.updateStatus(status);
      this.renderGklUi();
    });

    // 4. Cursor Movement
    this.core.on('cursor', ({ x, y }) => {
      const prevX = this.mapRenderer.targetCursorX;
      const prevY = this.mapRenderer.targetCursorY;
      this.mapRenderer.targetCursorX = x;
      this.mapRenderer.targetCursorY = y;
      this.zoomRenderer.targetCursorX = x;
      this.zoomRenderer.targetCursorY = y;

      if (prevX >= 0 && prevY >= 0) this.mapRenderer.redrawSingleCell(prevX, prevY);
      if (x >= 0 && y >= 0) {
        this.mapRenderer.redrawSingleCell(x, y);
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
        this.mapRenderer.asciiGridBuffer[y][x] = { ch, color };
        this.mapRenderer.glyphGridBuffer[y][x] = { glyph: gId, ch, color };
        this.mapRenderer.redrawSingleCell(x, y);

        if (this.zoomRenderer.isZoomMode && this.zoomRenderer.zoomCtx && this.core.gkl) {
          const situation = this.core.gkl.getSituation();
          this.zoomRenderer.renderZoomCanvas(situation?.area);
        }
      }
    });

    // 6. Clear Window / Clear Map
    this.core.on('clear_nhwindow', ({ windowId }) => {
      if (windowId === 2 || windowId === 0) {
        this.mapRenderer.clearMapGrid();
        if (this.zoomRenderer.zoomCtx && this.zoomRenderer.zoomCanvas) {
          this.zoomRenderer.zoomCtx.fillStyle = '#090916';
          this.zoomRenderer.zoomCtx.fillRect(0, 0, this.zoomRenderer.zoomCanvas.width, this.zoomRenderer.zoomCanvas.height);
        }
      }
    });

    this.core.on('map_cleared', () => {
      this.mapRenderer.clearMapGrid();
    });

    this.core.on('restarted', () => {
      this.resetUiForNewGame();
    });

    // 7. Input Required Prompts & Modals
    this.core.on('inputRequired', (data) => {
      // 起動シーケンス進行中の場合
      if (this.isStartingUp && this.startupStep === 'PROGRESS') {
        const cat = data?.promptCategory || data?.category;
        console.log(`[Startup] inputRequired during PROGRESS: cat=${cat}, prompt=${data?.prompt || data?.rawPrompt}`);

        // 1. 本編最初の通常ターン（POSKEY）を受信した時点で準備完了へ移行
        if (cat === 'POSKEY') {
          this.transitionToStartupReady();
          return;
        }
        if (this.isSaveResuming) {
          // 2. セーブ復元処理中の空バッファ待機のみを自動通過
          const hasMeaningfulText = (data?.lines && data.lines.length > 0) || 
                                    (data?.prompt && data.prompt !== 'Press Space or Enter to continue...' && data.prompt.trim() !== '');
          
          if (cat === 'KEY' && !hasMeaningfulText) {
            console.log('[Startup] Auto-responding Space for empty KEY prompt during save restore');
            setTimeout(() => {
              if (this.core) this.core.respond(' ', { force: true });
            }, 30);
            return;
          }
          // 3. ロックファイル衝突 (YN) や具体的なテキスト/選択肢が発生した場合は
          // ローディングを隠してモーダルを操作可能にする
          if (this.modalManager.elLoading) this.modalManager.elLoading.classList.add('hidden');
          if (this.modalManager.elSelectorCard) this.modalManager.elSelectorCard.classList.add('hidden');
        } else {
          // 新規ゲーム時: キャラ作成プロンプト操作のためローディングを隠す
          if (this.modalManager.elLoading) this.modalManager.elLoading.classList.add('hidden');
          if (this.modalManager.elSelectorCard) this.modalManager.elSelectorCard.classList.add('hidden');
        }
      }

      // コンテナFSMがアクティブな場合、通常のメニュー表示は抑制（二面パネルUIが担当）
      if (this.core.containerFSM && this.core.containerFSM.isActive()) {
        this.renderGklUi();
        return;
      }
      this.modalManager.handleInputRequired(data);
      this.renderGklUi();
    });

    this.core.on('inputAutoResolved', (data) => {
      console.log(`[Startup] inputAutoResolved: category=${data?.category}, response=${data?.response}`);
    });

    // 8. Input Resolved
    this.core.on('inputResolved', () => {
      this.modalManager.clearAllModals();
      this.renderGklUi();
    });

    // GKL 状態同期イベント時の UI 再描画
    this.core.on('inventoryStateUpdated', () => this.renderGklUi());
    this.core.on('attributesStateUpdated', () => this.renderGklUi());
    this.core.on('spellsStateUpdated', () => this.renderGklUi());
    this.core.on('skillsStateUpdated', () => this.renderGklUi());

    // 9. Game Over & Exited
    this.core.on('gameOver', (result) => {
      this.currentGameOverResult = result;
    });

    this.core.on('exited', async (data) => {
      await this.handleExited(data);
    });

    // 10. Visual FX 演出トリガーイベント (fx_trigger) 購読
    this.core.on('fx_trigger', (fx) => {
      if (!fx || !fx.type) return;
      const now = performance.now();

      if (fx.type === 'ATTACK_HIT') {
        this.zoomRenderer.addVisualFx({
          type: 'SLASH',
          gx: fx.targetX,
          gy: fx.targetY,
          startTime: now,
          durationMs: 130,
          color: '#ffffff'
        });
      } else if (fx.type === 'DAMAGE_TAKEN') {
        this.zoomRenderer.addVisualFx({
          type: 'DAMAGE_FLASH',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          amount: fx.amount,
          startTime: now,
          durationMs: 160,
          color: '#ff1744'
        });
        this.zoomRenderer.triggerScreenShake(3, 100);
      } else if (fx.type === 'KILL_CONFIRMED') {
        this.zoomRenderer.addVisualFx({
          type: 'KILL_BURST',
          gx: fx.targetX,
          gy: fx.targetY,
          startTime: now,
          durationMs: 200,
          color: '#ffd700'
        });
      } else if (fx.type === 'RECOVER_HEAL') {
        this.zoomRenderer.addVisualFx({
          type: 'HEAL_RING',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          amount: fx.amount,
          startTime: now,
          durationMs: 250,
          color: '#00e676'
        });
      } else if (fx.type === 'PLAYER_DIED') {
        this.mapRenderer.isPlayerDead = true;
        this.mapRenderer.deathPosition = { x: fx.targetX, y: fx.targetY };
        this.zoomRenderer.isPlayerDead = true;
        this.zoomRenderer.deathPosition = { x: fx.targetX, y: fx.targetY };
        this.zoomRenderer.triggerScreenShake(5, 300);
        this.zoomRenderer.addVisualFx({
          type: 'DEATH_BURST',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 1200,
          color: '#ef4444'
        });
        if (fx.targetX !== undefined && fx.targetY !== undefined) {
          this.mapRenderer.redrawSingleCell(fx.targetX, fx.targetY);
        }
        if (this.zoomRenderer.isZoomMode && this.zoomRenderer.zoomCtx && this.core && this.core.gkl) {
          const situation = this.core.gkl.getSituation();
          this.zoomRenderer.renderZoomCanvas(situation?.area);
        }
      } else if (fx.type === 'PLAYER_RESURRECTED') {
        const prevDeathPos = this.mapRenderer.deathPosition;
        this.mapRenderer.isPlayerDead = false;
        this.mapRenderer.deathPosition = null;
        this.zoomRenderer.isPlayerDead = false;
        this.zoomRenderer.deathPosition = null;
        this.zoomRenderer.addVisualFx({
          type: 'HEAL_RING',
          gx: fx.targetX,
          gy: fx.targetY,
          followPlayer: true,
          startTime: now,
          durationMs: 400,
          color: '#ffd700'
        });
        if (prevDeathPos) {
          this.mapRenderer.redrawSingleCell(prevDeathPos.x, prevDeathPos.y);
        }
        if (this.zoomRenderer.isZoomMode && this.zoomRenderer.zoomCtx && this.core && this.core.gkl) {
          const situation = this.core.gkl.getSituation();
          this.zoomRenderer.renderZoomCanvas(situation?.area);
        }
      }
    });

    // 10. Visual Container UI Transaction
    this.core.on('containerTransaction', (event) => {
      const { state, containerName, containerType, contents, isBagOfHolding } = event;
      if (state === 'ACTION_PROMPT') {
        this.containerModal.show({
          containerName,
          containerType,
          contents,
          isBagOfHolding,
        });
      } else if (state === 'IDLE' || state === 'EXPLODED') {
        this.containerModal.hide();
        if (state === 'EXPLODED') {
          alert(this.currentLanguage === 'en'
            ? '⚠️ A magical explosion blasts through the air! The container was destroyed!'
            : '⚠️ 鞄が魔法の爆発を起こして粉微塵になりました！');
        }
      }
    });
  }

  bindDOMEvents() {
    this.btnToggleView.onclick = () => {
      this.mapRenderer.switchViewMode(!this.mapRenderer.isGraphicCanvasMode);
    };

    if (this.btnToggleZoom) {
      this.btnToggleZoom.onclick = () => {
        this.zoomRenderer.toggleZoom();
      };
    }

    document.getElementById('btn-restart').onclick = () => this.restartGame();
    document.getElementById('btn-delete-save').onclick = () => this.deleteSaveFile();
    document.getElementById('btn-gameover-restart').onclick = () => this.restartGame();

    const elStatusBar = document.getElementById('status-bar');
    if (elStatusBar) {
      elStatusBar.addEventListener('click', (e) => {
        const spellBtn = e.target.closest('.gkl-spell-badge');
        if (spellBtn) {
          e.stopPropagation();
          const letter = spellBtn.dataset.letter;
          if (letter) this.statusView.castSpell(letter);
          return;
        }

        const skillBtn = e.target.closest('.gkl-skill-badge');
        if (skillBtn) {
          e.stopPropagation();
          const skillKey = skillBtn.dataset.skill;
          this.statusView.enhanceSkill(skillKey);
          return;
        }

        elStatusBar.classList.toggle('is-expanded');
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
          btnRefreshInv.textContent = this.currentLanguage === 'en' ? '🔄 Sync' : '🔄 同期';
        }
      };
    }

    const btnCastSpellMenu = document.getElementById('btn-cast-spell-menu');
    if (btnCastSpellMenu) {
      btnCastSpellMenu.onclick = () => {
        this.statusView.castSpell();
      };
    }

    const tabBtnAdvices = document.getElementById('tab-btn-advices');
    if (tabBtnAdvices) {
      tabBtnAdvices.onclick = () => {
        this.userPreferredTab = 'advices';
        this.knowledgeView.userPreferredTab = 'advices';
        this.knowledgeView.switchBottomTab('advices');
      };
    }

    const tabBtnKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabBtnKnowledge) {
      tabBtnKnowledge.onclick = () => {
        this.userPreferredTab = 'knowledge';
        this.knowledgeView.userPreferredTab = 'knowledge';
        this.knowledgeView.switchBottomTab('knowledge', this.lastKnowledgeTarget);
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
        return;
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
          this.lastKnowledgeTarget = cardData;
          this.knowledgeView.lastKnowledgeTarget = cardData;

          const basicCategories = ['FLOOR', 'WALL', 'CORRIDOR', 'TERRAIN', 'BARS'];
          const isBasicTerrain = basicCategories.includes(cardData.category) && !cardData.isTrap && !cardData.isAltar && !cardData.isFountain && !cardData.isThrone && !cardData.isSink;

          if (isBasicTerrain) {
            if (this.userPreferredTab === 'advices') {
              this.knowledgeView.switchBottomTab('advices');
            } else {
              this.knowledgeView.switchBottomTab('knowledge', cardData, { isClickConfirmed: cardData?.isClickConfirmed || !isHover });
            }
          } else {
            this.knowledgeView.switchBottomTab('knowledge', cardData, { isClickConfirmed: cardData?.isClickConfirmed || !isHover });
          }
        }
      }

      if (!isHover && this.core?.gkl?.travelTo) {
        await this.core.gkl.travelTo({ x: gx, y: gy });
      }
    };

    // メインキャンバスのクリック＆ホバーイベント
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', async (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const gx = Math.floor(((e.clientX - rect.left) * (this.canvas.width / rect.width)) / 16);
        const gy = Math.floor(((e.clientY - rect.top) * (this.canvas.height / rect.height)) / 14);
        await handleCanvasInspect(gx, gy, true);
      });

      this.canvas.addEventListener('click', async (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const gx = Math.floor(((e.clientX - rect.left) * (this.canvas.width / rect.width)) / 16);
        const gy = Math.floor(((e.clientY - rect.top) * (this.canvas.height / rect.height)) / 14);
        await handleCanvasInspect(gx, gy, false);
      });
    }

    // ズームカメラ (zoom-canvas) のクリック＆ホバーイベント
    const zoomCanvas = document.getElementById('zoom-canvas');
    if (zoomCanvas) {
      zoomCanvas.addEventListener('mousemove', async (e) => {
        const rect = zoomCanvas.getBoundingClientRect();
        const tileX = Math.floor(((e.clientX - rect.left) * (zoomCanvas.width / rect.width)) / 32);
        const tileY = Math.floor(((e.clientY - rect.top) * (zoomCanvas.height / rect.height)) / 32);

        const px = this.mapRenderer.targetCursorX >= 0 ? this.mapRenderer.targetCursorX : 0;
        const py = this.mapRenderer.targetCursorY >= 0 ? this.mapRenderer.targetCursorY : 0;

        const gx = px + (tileX - 10);
        const gy = py + (tileY - 4);

        await handleCanvasInspect(gx, gy, true);
      });

      zoomCanvas.addEventListener('mouseleave', () => {
        this.knowledgeView.renderKnowledgeCard(null);
      });

      zoomCanvas.addEventListener('click', async (e) => {
        const rect = zoomCanvas.getBoundingClientRect();
        const tileX = Math.floor(((e.clientX - rect.left) * (zoomCanvas.width / rect.width)) / 32);
        const tileY = Math.floor(((e.clientY - rect.top) * (zoomCanvas.height / rect.height)) / 32);

        const px = this.mapRenderer.targetCursorX >= 0 ? this.mapRenderer.targetCursorX : 0;
        const py = this.mapRenderer.targetCursorY >= 0 ? this.mapRenderer.targetCursorY : 0;

        const gx = px + (tileX - 10);
        const gy = py + (tileY - 4);

        await handleCanvasInspect(gx, gy, false);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (this.isStartingUp && this.startupStep === 'READY') {
        if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) return;
        e.preventDefault();
        e.stopPropagation();
        this.completeStartup(e.code || e.key);
        return;
      }
      this.keyHandler.handleGlobalKeyDown(e);
    });
  }

  renderGklUi() {
    if (!this.core || !this.core.gkl) return;
    const situation = this.core.gkl.getSituation();
    if (!situation) return;

    const slotBadges = situation.assistState?.slotBadges || {};

    // 0. 🚨 HUD 最優先アシストシグナル (Level 2 & Level 3)
    this.assistHud.renderAssistSignalBar(situation.assistState);

    // 0.5 🧭 フロア設備案内フローティング HUD (Landmarks Bar)
    this.assistHud.renderFloorLandmarks(situation.landmarks);

    // 1. GKL 推奨アクションパネル
    this.directionPad.renderGklActions(situation.actions || []);

    // 2. GKL アイコン型所持品インベントリ (Level 1 Nano Badge 付与)
    this.inventoryView.renderGklInventory(situation.inventory, slotBadges);

    // 3. 属性耐性 & 修得魔法 & スキル熟練度
    this.statusView.renderGklAttributes(situation.attributes);
    this.statusView.renderGklSpells(situation.spells, slotBadges);
    this.statusView.renderGklSkills(situation.skills);

    // 4. 戦術アドバイス ＆ 危機警告
    this.knowledgeView.renderGklAdvices(situation.advices || []);
  }

  onLanguageChanged() {
    const isEn = this.currentLanguage === 'en';

    this.mapRenderer.setLanguage(this.currentLanguage);
    this.zoomRenderer.setLanguage(this.currentLanguage);
    this.knowledgeView.setLanguage(this.currentLanguage);
    this.inventoryView.setLanguage(this.currentLanguage);
    this.assistHud.setLanguage(this.currentLanguage);
    this.directionPad.setLanguage(this.currentLanguage);
    this.statusView.setLanguage(this.currentLanguage);
    this.modalManager.setLanguage(this.currentLanguage);
    this.containerModal.setLanguage(this.currentLanguage);

    const elInvHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(1) .gkl-card-header span');
    if (elInvHeader) elInvHeader.textContent = isEn ? '🎒 Inventory Items (Icon Inventory)' : '🎒 所持品アイテム (Icon Inventory)';

    const elBtnRefreshInv = document.getElementById('btn-refresh-inv');
    if (elBtnRefreshInv) {
      elBtnRefreshInv.textContent = isEn ? '🔄 Sync' : '🔄 同期';
      elBtnRefreshInv.title = isEn ? 'Sync inventory immediately' : '所持品情報を即座に最新同期';
    }

    const elActHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(2) .gkl-card-header span');
    if (elActHeader) elActHeader.textContent = isEn ? '🧠 Recommended Actions (ContextActions)' : '🧠 推奨アクション (ContextActions)';

    const elKnHeader = document.querySelector('.gkl-side-panel .gkl-card:nth-child(3) .gkl-card-header span');
    if (elKnHeader) elKnHeader.textContent = isEn ? '💡 Structured Knowledge (GKL Knowledge)' : '💡 構造化ナレッジ (GKL Knowledge)';

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.title = isEn ? 'Restart game immediately' : 'ゲームを即時再起動';

    const btnDeleteSave = document.getElementById('btn-delete-save');
    if (btnDeleteSave) btnDeleteSave.title = isEn ? 'Delete save file completely' : 'セーブデータを完全削除';

    const btnStartResume = document.getElementById('btn-start-resume');
    if (btnStartResume) btnStartResume.textContent = isEn ? '▶️ Continue Game' : '▶️ セーブデータから再開';

    const btnStartNew = document.getElementById('btn-start-new');
    if (btnStartNew) btnStartNew.textContent = isEn ? '⚠️ New Game (Delete Save)' : '⚠️ 新規ゲーム開始 (セーブ破棄)';

    const btnStartFresh = document.getElementById('btn-start-fresh');
    if (btnStartFresh) btnStartFresh.textContent = isEn ? '⚔️ Start Adventure' : '⚔️ 新しい冒険を始める';

    const btnEnter = document.getElementById('btn-enter-dungeon');
    if (btnEnter) btnEnter.textContent = isEn ? '▶️ Enter Dungeon [Space / Move]' : '▶️ ダンジョンへ入る [Space / 移動キー]';

    const readyMsg = document.getElementById('start-ready-msg');
    if (readyMsg) readyMsg.textContent = isEn ? 'Dungeon Ready! Enter dungeon' : '✨ 準備完了！ ダンジョンへ入る';

    const progressText = document.getElementById('start-card-progress-text');
    if (progressText) {
      if (this.isSaveResuming) {
        progressText.textContent = isEn ? '🔄 Restoring dungeon state...' : '🔄 ダンジョンを復元中...';
      } else {
        progressText.textContent = isEn ? '🔄 Generating new dungeon...' : '🔄 新しいダンジョンを生成中...';
      }
    }

    if (this.knowledgeView.currentBottomTab === 'knowledge' && this.lastKnowledgeTarget) {
      this.knowledgeView.renderKnowledgeCard(this.lastKnowledgeTarget);
    } else {
      this.knowledgeView.renderSideAdvices();
    }

    if (this.core && this.core.gkl) {
      if (typeof this.core.gkl.setLanguage === 'function') {
        this.core.gkl.setLanguage(this.currentLanguage);
      }
      this.renderGklUi();
    }
  }

  addMessageLog(msg) {
    if (!msg || !this.elMessageLog) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = msg;
    this.elMessageLog.appendChild(line);
    this.elMessageLog.scrollTop = this.elMessageLog.scrollHeight;
  }

  resetUiForNewGame() {
    this.isGameExited = false;
    this.currentGameOverResult = null;
    this.mapRenderer.isPlayerDead = false;
    this.mapRenderer.deathPosition = null;
    this.zoomRenderer.isPlayerDead = false;
    this.zoomRenderer.deathPosition = null;
    this.zoomRenderer.activeFxList = [];
    this.lastKnowledgeTarget = null;
    this.userPreferredTab = 'advices';

    this.modalManager.reset();
    this.mapRenderer.clearMapGrid();
    if (this.elMessageLog) this.elMessageLog.innerHTML = '';

    const elCritBadge = document.getElementById('st-advice-critical-badge');
    if (elCritBadge) elCritBadge.classList.add('hidden');

    this.assistHud.renderAssistSignalBar(null);
    this.assistHud.renderFloorLandmarks(null);
    this.directionPad.renderGklActions([]);
    this.inventoryView.renderGklInventory({ items: [] }, {});
    this.knowledgeView.lastAdvices = [];
    this.knowledgeView.lastKnowledgeTarget = null;
    this.knowledgeView.renderSideAdvices();

    if (this.core && this.core.gkl && typeof this.core.gkl.reset === 'function') {
      this.core.gkl.reset();
    }
  }

  setStartupView(step) {
    this.startupStep = step;

    const card = this.modalManager.elSelectorCard;
    const cardButtons = document.getElementById('start-card-buttons');
    const cardInfo = document.getElementById('start-card-info');
    const cardSpinner = document.getElementById('start-card-spinner');
    const cardReady = document.getElementById('start-card-ready');
    const readyAction = document.getElementById('start-card-ready-action');
    const spinnerBox = this.modalManager.elSpinnerBox;
    const loadingOverlay = this.modalManager.elLoading;

    if (step === 'INITIALIZING') {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');
      if (spinnerBox) spinnerBox.classList.remove('hidden');
      if (card) card.classList.add('hidden');
      return;
    }

    if (step === 'SELECTION') {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');
      if (spinnerBox) spinnerBox.classList.add('hidden');
      if (card) card.classList.remove('hidden', 'is-fade-out');
      if (cardButtons) cardButtons.classList.remove('hidden');
      if (cardInfo) cardInfo.classList.remove('hidden');
      if (cardSpinner) cardSpinner.classList.add('hidden');
      if (cardReady) cardReady.classList.add('hidden');
      if (readyAction) readyAction.classList.add('hidden');
      return;
    }

    if (step === 'PROGRESS') {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');
      if (spinnerBox) spinnerBox.classList.add('hidden');
      if (card) card.classList.remove('hidden', 'is-fade-out');
      if (cardButtons) cardButtons.classList.add('hidden');
      if (cardInfo) cardInfo.classList.add('hidden');
      if (cardSpinner) cardSpinner.classList.remove('hidden');
      if (cardReady) cardReady.classList.add('hidden');
      if (readyAction) readyAction.classList.add('hidden');
      return;
    }

    if (step === 'READY') {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');
      if (spinnerBox) spinnerBox.classList.add('hidden');
      if (card) card.classList.remove('hidden', 'is-fade-out');
      if (cardButtons) cardButtons.classList.add('hidden');
      if (cardInfo) cardInfo.classList.add('hidden');
      if (cardSpinner) cardSpinner.classList.add('hidden');
      if (cardReady) cardReady.classList.remove('hidden');
      if (readyAction) readyAction.classList.remove('hidden');
      return;
    }

    if (step === 'PLAYING') {
      if (card) card.classList.add('is-fade-out');
      setTimeout(() => {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        if (card) {
          card.classList.add('hidden');
          card.classList.remove('is-fade-out');
        }
      }, 200);
      return;
    }
  }

  async restartGame() {
    this.isStartingUp = true;
    this.setStartupView('INITIALIZING');
    this.resetUiForNewGame();
    this.modalManager.elGameOverModal.classList.add('hidden');

    try {
      await this.core.restart({ clearStorage: false, autoStart: false });
    } catch (err) {
      console.warn("[GklPureJSClient] core.restart:", err);
    }
    await this.bootstrapGame();
  }

  async deleteSaveFile() {
    const isEn = this.currentLanguage === 'en';
    const confirmMsg = isEn ? 'Are you sure you want to completely delete the save file?' : 'セーブファイルを完全に削除しますか？';
    if (confirm(confirmMsg)) {
      this.isStartingUp = true;
      this.setStartupView('INITIALIZING');
      this.resetUiForNewGame();
      this.modalManager.elGameOverModal.classList.add('hidden');

      try {
        await this.core.restart({ clearStorage: true, autoStart: false });
      } catch (err) {
        console.warn("[GklPureJSClient] core.restart:", err);
      }
      await this.bootstrapGame();
    }
  }

  async handleExited(data) {
    this.isGameExited = true;

    // 死亡/終了時に背後のアドバイス・HUD・アクションをクリーンアップ
    this.assistHud.renderAssistSignalBar(null);
    this.assistHud.renderFloorLandmarks(null);
    this.directionPad.renderGklActions([]);
    this.knowledgeView.renderGklAdvices([]);

    const result = this.currentGameOverResult || await this.core.resolveGameOver();
    await this.modalManager.handleExited(result);
  }

  async bootstrapGame() {
    try {
      this.isStartingUp = true;
      this.setStartupView('SELECTION');

      const btnStartResume = document.getElementById('btn-start-resume');
      const btnStartNew = document.getElementById('btn-start-new');
      const btnStartFresh = document.getElementById('btn-start-fresh');
      const cardTitle = document.getElementById('start-card-title');
      const cardMsg = document.getElementById('start-card-msg');
      const isEn = this.currentLanguage === 'en';

      const saveInfo = await this.core.detectSavedGameInfo();
      if (saveInfo && saveInfo.hasSave) {
        this.isSaveResuming = true;
        if (cardTitle) cardTitle.textContent = isEn ? '💾 Save Data Found' : '💾 セーブデータが見つかりました';
        if (cardMsg) cardMsg.innerHTML = `${isEn ? 'Player' : '冒険者'}: <strong id="start-save-name">${saveInfo.savePlayerName || 'Hero'}</strong>`;
        if (btnStartResume) btnStartResume.classList.remove('hidden');
        if (btnStartNew) btnStartNew.classList.remove('hidden');
        if (btnStartFresh) btnStartFresh.classList.add('hidden');
      } else {
        this.isSaveResuming = false;
        if (cardTitle) cardTitle.textContent = '⚔️ NetHack Wasm WebUI';
        if (cardMsg) cardMsg.innerHTML = isEn ? 'Begin a new adventure in the Mazes of Menace.' : '危険に満ちた死の迷宮へ、新たな冒険に出発します。';
        if (btnStartResume) btnStartResume.classList.add('hidden');
        if (btnStartNew) btnStartNew.classList.add('hidden');
        if (btnStartFresh) btnStartFresh.classList.remove('hidden');
      }

      if (btnStartResume) {
        btnStartResume.onclick = async () => {
          await this.startWithProgress(true, false);
        };
      }

      if (btnStartNew) {
        btnStartNew.onclick = async () => {
          const confirmMsg = isEn
            ? 'Delete saved game and start a new game?'
            : '保存されているセーブデータを破棄して最初から開始しますか？';
          if (!window.confirm(confirmMsg)) return;
          await this.startWithProgress(false, true);
        };
      }

      if (btnStartFresh) {
        btnStartFresh.onclick = async () => {
          await this.startWithProgress(false, false);
        };
      }
    } catch (e) {
      console.error("Core start error:", e);
    }
  }

  async startWithProgress(isResume, forceNewGame) {
    this.isSaveResuming = isResume;
    this.setStartupView('PROGRESS');

    const isEn = this.currentLanguage === 'en';
    const progressText = document.getElementById('start-card-progress-text');
    if (progressText) {
      progressText.textContent = isResume
        ? (isEn ? '🔄 Restoring dungeon state...' : '🔄 ダンジョンを復元中...')
        : (isEn ? '🔄 Generating new dungeon...' : '🔄 新しいダンジョンを生成中...');
    }

    try {
      await this.core.start('nethack.js', { forceNewGame });
    } catch (e) {
      console.error("Core start failed:", e);
    }
  }

  transitionToStartupReady() {
    if (this.startupStep !== 'PROGRESS') return;
    this.setStartupView('READY');

    const isEn = this.currentLanguage === 'en';
    const cardTitle = document.getElementById('start-card-title');
    const cardReady = document.getElementById('start-card-ready');
    const readyMsg = document.getElementById('start-ready-msg');
    const btnEnter = document.getElementById('btn-enter-dungeon');

    if (cardTitle) {
      cardTitle.textContent = isEn ? '✨ Ready to Enter' : '✨ ダンジョン突入準備完了';
    }
    if (cardReady) {
      cardReady.onclick = () => this.completeStartup(' ');
    }
    if (readyMsg) {
      readyMsg.textContent = isEn
        ? 'Dungeon is ready! Press Space or Move key'
        : 'ダンジョンの準備が整いました！ [Space] または [移動キー] で開始';
    }
    if (btnEnter) {
      btnEnter.textContent = isEn
        ? '▶️ Enter Dungeon [Space / Move]'
        : '▶️ ダンジョンへ入る [Space / 移動キー]';
      btnEnter.onclick = () => this.completeStartup(' ');
    }
  }

  completeStartup(triggerCodeOrKey = null) {
    if (!this.isStartingUp && this.startupStep === 'PLAYING') return;
    this.isStartingUp = false;
    this.setStartupView('PLAYING');

    setTimeout(() => {
      window.focus();

      if (this.isSaveResuming) {
        const isEn = this.currentLanguage === 'en';
        //const restoreMsg = isEn
        //  ? '💾 Saved game restored. Move to begin your adventure.'
        //  : '💾 セーブデータを復元しました。移動キーで行動を開始してください。';
        //this.addMessageLog(restoreMsg);

        // curses 初回画面フラッシュを促すため、Space/Enterによる突入時は Ctrl-R (Redraw) を送信してマップを描画
        if (!triggerCodeOrKey || triggerCodeOrKey === ' ' || triggerCodeOrKey === 'Space' || triggerCodeOrKey === 'Enter') {
          if (this.core) {
            this.core.sendKey('r', false, true, false, 'r', true);
          }
          return;
        }
      }

      if (triggerCodeOrKey && this.core) {
        if (triggerCodeOrKey !== ' ' && triggerCodeOrKey !== 'Space' && triggerCodeOrKey !== 'Enter') {
          this.core.sendKey(triggerCodeOrKey);
        }
      }
    }, 200);
  }
}

// 起動
const gklClient = new GklPureJSClient();
if (typeof window !== 'undefined') {
  window.gklClient = gklClient;
}

