/**
 * examples/console-client/main.js
 * 
 * シレン風 GamePad 専用クライアント メインコントローラー (再構築版)
 * 
 * 既存の完成済みコア資産・正規 API を直接再利用:
 * 1. ステータス管理: core.statusAccessor.getStatus() の構造化モデル
 * 2. モーダル・キャラ作成調廷: ModalManager / CharacterCreationModal / CharacterIntroModal
 *    (行選択は WebUICore 正規仕様 [{ identifier: item.identifier, count: -1 }] を利用)
 * 3. ゲームパッド入力・HUD: GamepadInputController, NhGamepadGuideBar, NhShirenInventoryDrawer
 */

import { WebUICore } from '../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../src/driver/index.js';
import { GamepadManager } from '../../src/core/input/GamepadManager.js';
import { GamepadInputController } from '../../src/core/input/GamepadInputController.js';
import { VirtualDungeonScreen } from '../gkl-pure-js-client/modules/renderers/VirtualDungeonScreen.js';
import { MainViewportRenderer } from '../gkl-pure-js-client/modules/renderers/MainViewportRenderer.js';
import { ModalManager } from '../gkl-pure-js-client/modules/components/ModalManager.js';
import { CharacterCreationModal } from '../gkl-pure-js-client/modules/components/CharacterCreationModal.js';
import { CharacterIntroModal } from '../gkl-pure-js-client/modules/components/CharacterIntroModal.js';

// Web Components
import '../../src/components/gamepad/index.js';

export class ConsoleClient {
  constructor() {
    this.core = null;
    this.gamepadManager = null;
    this.inputController = null;
    this.virtualScreen = null;
    this.viewportRenderer = null;
    this.modalManager = null;
    this.characterCreationModal = null;
    this.characterIntroModal = null;

    // DOM Elements
    this.canvas = document.getElementById('game-canvas');
    this.guideBar = document.getElementById('guide-bar');
    this.contextPill = document.getElementById('context-pill');
    this.radialHud = document.getElementById('radial-hud');
    this.shirenDrawer = document.getElementById('shiren-drawer');
    this.msgOverlay = document.getElementById('console-message-overlay');

    // ModalManager 用 DOM
    this.promptBar = document.getElementById('prompt-bar');
    this.promptText = document.getElementById('prompt-text');
    this.inputControls = document.getElementById('input-controls');
    this.menuModal = document.getElementById('menu-modal');
    this.menuTitle = document.getElementById('menu-title');
    this.menuItemsContainer = document.getElementById('menu-items-container');
    this.btnCancelMenu = document.getElementById('btn-cancel-menu');

    // Status DOM
    this.stDlevel = document.getElementById('st-dlevel');
    this.stHp = document.getElementById('st-hp');
    this.stHpFill = document.getElementById('st-hp-fill');
    this.stHunger = document.getElementById('st-hunger');
    this.stGold = document.getElementById('st-gold');
    this.stExp = document.getElementById('st-exp');
    this.stTurn = document.getElementById('st-turn');

    // 内部状態
    this.currentLanguage = 'ja';
    this.isStartingUp = true;
    this._msgTimer = null;
    this._introModeCardIndex = 0;
  }

  async init() {
    console.log('[ConsoleClient] 🎮 Initializing GamePad Console Client with Standard Modules...');

    // 1. レンダラー初期化
    this.initRenderers();

    // 2. WebUICore 初期化
    this.initCore();

    // 3. 正規モーダル初期化 (ModalManager, CharacterCreationModal, CharacterIntroModal)
    this.initModals();

    // 4. ゲームパッド入力初期化 (GamepadManager, GamepadInputController)
    this.initGamepad();

    // 5. イベント結線
    this.bindCoreEvents();
    this.bindGamepadEvents();
    this.bindKeyboardFallback();

    // 6. ウィンドウリサイズ監視
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();

    // 7. メインレンダーループ開始
    this.startMainLoop();

    // 8. WASM ブートストラップ
    await this.bootstrapGame();

    console.log('[ConsoleClient] ✨ Console Client Ready.');
  }

  initRenderers() {
    this.virtualScreen = new VirtualDungeonScreen({ tileSize: 32 });

    const tilePaths = [
      '../../pict/nethack_default_32_tr.png',
      '../../assets/nethack_default_32_tr.png',
      '../gkl-pure-js-client/assets/tiles32.png',
      '../../public/tiles32.png'
    ];

    this.virtualScreen.initTileImageWithFallback(tilePaths, (path) => {
      console.log('[ConsoleClient] 🎨 Tile image loaded:', path);
      if (this.viewportRenderer) {
        this.viewportRenderer.tileLoaded = true;
        this.viewportRenderer.tileImg = this.virtualScreen.tileImg;
        this.virtualScreen.markAllDirty();
        this.viewportRenderer.render();
      }
    });

    this.viewportRenderer = new MainViewportRenderer({
      canvas: this.canvas,
      virtualScreen: this.virtualScreen,
      getAreaGrid: () => this.core?.knowledge?.areaStateManager?.getAreaState()?.grid,
      getSituation: () => this.core?.gkl?.getSituation(),
      getCore: () => this.core,
      tileImg: this.virtualScreen.tileImg,
      tileLoaded: this.virtualScreen.tileLoaded
    });

    this.viewportRenderer.init();
    this.viewportRenderer.smoothScroll = true;
    this.viewportRenderer.cameraLerp = 0.25;
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;

    if (this.viewportRenderer) {
      this.viewportRenderer.resize(w, h);
    }
  }

  initCore() {
    const workerPath = '../../src/driver/nethack.worker.js';
    const bridge = new NetHackWasmWorkerBridge(workerPath);
    this.core = new WebUICore({ driver: bridge, keyMode: 'numpad' });

    // 道具袋 Web Component の初期化
    if (this.shirenDrawer) {
      this.shirenDrawer.init({ core: this.core });
      this.shirenDrawer.addEventListener('drawerClosed', () => {
        if (this.inputController) {
          this.inputController.setInventoryOpen(false);
        }
      });
      this.shirenDrawer.addEventListener('drawerOpened', () => {
        if (this.inputController) {
          this.inputController.setInventoryOpen(true);
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.client = this;
      window.core = this.core;
      window.gkl = this.core.gkl;
    }
  }

  initModals() {
    // 1. CharacterCreationModal (タブ型キャラ作成ウィザード)
    this.characterCreationModal = new CharacterCreationModal({
      getCore: () => this.core
    });
    this.characterCreationModal.setLanguage(this.currentLanguage);

    // 2. CharacterIntroModal (ASKNAME & ynaq プロンプト)
    this.characterIntroModal = new CharacterIntroModal({
      getCore: () => this.core,
      characterCreationModal: this.characterCreationModal,
      currentLanguage: this.currentLanguage
    });

    // 3. ModalManager (プロンプトバー、メニューモーダル等の統括)
    this.modalManager = new ModalManager({
      elPromptBar: this.promptBar,
      elPromptText: this.promptText,
      elInputControls: this.inputControls,
      elMenuModal: this.menuModal,
      elMenuTitle: this.menuTitle,
      elMenuItemsContainer: this.menuItemsContainer,
      elBtnCancelMenu: this.btnCancelMenu,
      characterCreationModal: this.characterCreationModal,
      characterIntroModal: this.characterIntroModal,
      getCore: () => this.core,
      getLoadedTileImagePath: () => this.viewportRenderer?.loadedTileImagePath
    });
    this.modalManager.setLanguage(this.currentLanguage);
  }

  initGamepad() {
    this.gamepadManager = new GamepadManager({
      useSemantic: true,
      dpadOnlyMove: true,
      useRadialPalette: true,
      radialStickIndex: 'right'
    });

    this.inputController = new GamepadInputController({
      core: this.core,
      gamepadManager: this.gamepadManager,
      modalManager: this.modalManager
    });
  }

  bindCoreEvents() {
    // 1. マップ描画 (print_glyph)
    this.core.on('print_glyph', ({ x, y, glyphInfo, glyph }) => {
      const gi = glyphInfo || {};
      const ch = gi.ch || ' ';
      const color = gi.color !== undefined ? gi.color : 7;
      const gId = (gi.glyph !== undefined && gi.glyph !== null) ? gi.glyph : (glyph !== undefined && glyph !== null ? glyph : -1);

      if (x >= 0 && x < 80 && y >= 0 && y < 24) {
        this.virtualScreen?.markDirty(x, y);
        if (this.viewportRenderer) {
          this.viewportRenderer.asciiGridBuffer[y][x] = { ch, color };
          this.viewportRenderer.glyphGridBuffer[y][x] = { glyph: gId, ch, color };
          this.viewportRenderer.redrawSingleCell(x, y);
        }
      }
    });

    // 2. カーソル移動
    this.core.on('cursor', ({ x, y }) => {
      if (!this.viewportRenderer) return;
      const prevX = this.viewportRenderer.targetCursorX;
      const prevY = this.viewportRenderer.targetCursorY;
      this.viewportRenderer.targetCursorX = x;
      this.viewportRenderer.targetCursorY = y;
      if (prevX >= 0 && prevY >= 0) this.viewportRenderer.redrawSingleCell(prevX, prevY);
      if (x >= 0 && y >= 0) this.viewportRenderer.redrawSingleCell(x, y);
    });

    // 3. マップクリア
    this.core.on('clear_nhwindow', ({ windowId }) => {
      if (windowId === 2 || windowId === 0) {
        this.virtualScreen?.clearScreen();
        this.viewportRenderer?.clearMapGrid();
      }
    });

    this.core.on('map_cleared', () => {
      this.virtualScreen?.clearScreen();
      this.viewportRenderer?.clearMapGrid();
    });

    // 4. ステータス更新 (StatusAccessor 正規モデル利用)
    this.core.on('statusUpdate', ({ status }) => {
      this.updateStatusBar(status);
    });

    // 5. メッセージ通知
    this.core.on('message', (msg) => {
      this.showMessage(msg);
    });

    // 6. 所持品更新
    this.core.on('inventoryStateUpdated', () => {
      if (this.shirenDrawer) {
        const items = this.core?.knowledge?.inventoryStateManager?.getInventoryState()?.items || [];
        this.shirenDrawer.setItems(items);
      }
    });

    // 7. 入力要求プロンプト＆メニュー調停 (ModalManager へ委譲)
    this.core.on('inputRequired', (data) => {
      this.handleInputRequired(data);
    });

    this.core.on('inputResolved', () => {
      this.handleInputResolved();
    });

    // 8. 言語変更
    this.core.on('languageChanged', (lang) => {
      this.currentLanguage = lang;
      this.modalManager?.setLanguage(lang);
      this.characterIntroModal?.setLanguage(lang);
      this.characterCreationModal?.setLanguage(lang);
      this.updateStatusBar();
    });
  }

  bindGamepadEvents() {
    // コンテキスト変更連動
    this.inputController.on('contextChanged', ({ current }) => {
      if (this.guideBar) {
        this.guideBar.setContext(current);
      }
    });

    // ラジアルHUD更新連動
    this.inputController.on('radialUpdate', (data) => {
      if (this.radialHud) {
        this.radialHud.update(data);
      }
    });

    this.inputController.on('radialFlick', (flick) => {
      if (flick && flick.sector) {
        console.log(`[ConsoleClient] 🎯 Radial command executed: ${flick.sector}`);
      }
    });

    // 道具袋トグル (Yボタン)
    this.inputController.on('toggleInventory', ({ isOpen }) => {
      if (this.shirenDrawer) {
        if (isOpen) {
          const items = this.core?.knowledge?.inventoryStateManager?.getInventoryState()?.items || [];
          this.shirenDrawer.setItems(items);
          this.shirenDrawer.open();
        } else {
          this.shirenDrawer.close();
        }
      }
    });

    // 道具袋十字キーナビ
    this.inputController.on('inventoryNav', (action) => {
      if (this.shirenDrawer && this.shirenDrawer.isOpen) {
        this.shirenDrawer.handleGamepadNav(action);
      }
    });

    // モーダル・ダイアログナビ (十字キー上下左右・Aボタン・Bボタン)
    this.inputController.on('dialogNav', (nav) => {
      this.handleModalNav(nav);
    });
    this.inputController.on('dialogSubmit', () => {
      this.handleModalSubmit();
    });
    this.inputController.on('dialogCancel', () => {
      this.handleModalCancel();
    });
  }

  bindKeyboardFallback() {
    window.addEventListener('keydown', (e) => {
      // 1. モーダルが開いている場合のフォールバック操作
      if (this.isAnyModalOpen()) {
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          this.handleModalNav({ type: 'next' });
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          this.handleModalNav({ type: 'prev' });
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'h') {
          e.preventDefault();
          this.handleModalNav({ type: 'left' });
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'l') {
          e.preventDefault();
          this.handleModalNav({ type: 'right' });
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleModalSubmit();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.handleModalCancel();
          return;
        }
      }

      // 2. 道具袋が開いている場合
      if (this.shirenDrawer && this.shirenDrawer.isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          this.shirenDrawer.handleGamepadNav({ type: 'next' });
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          this.shirenDrawer.handleGamepadNav({ type: 'prev' });
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          this.shirenDrawer.handleGamepadNav({ type: 'select' });
          return;
        }
        if (e.key === 'Escape' || e.key.toLowerCase() === 'y') {
          e.preventDefault();
          this.shirenDrawer.close();
          this.inputController?.setInventoryOpen(false);
          return;
        }
      }

      // 3. Yキーで道具袋トグル
      if (e.key.toLowerCase() === 'y' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!this.isAnyModalOpen()) {
          const isOpen = !this.shirenDrawer?.isOpen;
          if (isOpen) {
            const items = this.core?.knowledge?.inventoryStateManager?.getInventoryState()?.items || [];
            this.shirenDrawer?.setItems(items);
            this.shirenDrawer?.open();
          } else {
            this.shirenDrawer?.close();
          }
          this.inputController?.setInventoryOpen(isOpen);
          return;
        }
      }
    });
  }

  isAnyModalOpen() {
    if (this.characterIntroModal && this.characterIntroModal.isIntroActive()) return true;
    if (this.characterCreationModal && this.characterCreationModal.isVisible) return true;
    if (this.modalManager && this.modalManager.isAnyModalOpen()) return true;
    return false;
  }

  async bootstrapGame() {
    try {
      this.isStartingUp = true;
      console.log('[ConsoleClient] 🚀 Checking save data and booting NetHack WASM...');

      const saveInfo = await this.core.detectSavedGameInfo();
      if (saveInfo && saveInfo.hasSave) {
        console.log('[ConsoleClient] 💾 Save data detected:', saveInfo.savePlayerName);
        // セーブデータ選択メニューを正規の ModalManager 形式で提示
        this.modalManager.handleInputRequired({
          category: 'MENU',
          prompt: `💾 セーブデータが見つかりました (${saveInfo.savePlayerName || 'Hero'})`,
          items: [
            { identifier: 1, text: `冒険を再開する (${saveInfo.savePlayerName || 'Hero'})`, ch: 'r' },
            { identifier: 2, text: 'セーブデータを破棄して最初から開始', ch: 'n' }
          ]
        });

        // 選択時のカスタムハンドラ登録
        const originalRespond = this.core.respond.bind(this.core);
        this.core.respond = async (val, options) => {
          this.core.respond = originalRespond;
          this.modalManager.clearAllModals();

          let forceNew = false;
          if (Array.isArray(val) && val.length > 0) {
            forceNew = val[0].identifier === 2;
          } else if (val === 'n' || val === 'N') {
            forceNew = true;
          }

          console.log(`[ConsoleClient] Starting game (forceNewGame: ${forceNew})...`);
          await this.core.start('nethack.js', { forceNewGame: forceNew });
        };
      } else {
        console.log('[ConsoleClient] ⚔️ Starting new game...');
        await this.core.start('nethack.js', { forceNewGame: true });
      }
    } catch (err) {
      console.error('[ConsoleClient] ❌ Failed to bootstrap NetHack WASM:', err);
      this.showMessage(`WASM起動エラー: ${err.message}`);
    }
  }

  startMainLoop() {
    const loop = () => {
      // 1. ゲームパッド入力のポーリング＆ディスパッチ
      if (this.inputController) {
        this.inputController.pollAndDispatch();
      }

      // 2. メインビューポート描画
      if (this.viewportRenderer) {
        this.viewportRenderer.render();
      }

      // 3. 足元コンテキストピル更新
      if (this.contextPill && this.inputController) {
        const action = this.inputController.getPrimaryContextAction();
        this.contextPill.update(action);
      }

      // 4. 周囲状況（扉、階段、箱等）に応じた動的ラジアルパレット更新
      if (this.inputController) {
        this.inputController.updateDynamicPalette(this.radialHud);
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  /**
   * NetHack 入力要求イベントの調停
   * 低レベル自前処理を全廃し、正規 ModalManager へ完全委譲
   */
  handleInputRequired(data) {
    if (!data) return;

    const cat = (data.promptCategory || data.category || 'OTHER').toUpperCase();

    // 通常ターン (POSKEY) はダンジョン本編突入を意味する
    if (cat === 'POSKEY') {
      this.isStartingUp = false;
      this.modalManager?.clearAllModals();
      return;
    }

    // ModalManager による正規ディスパッチ (CharacterIntroModal / CharacterCreationModal 連動)
    this.modalManager.handleInputRequired(data);
  }

  handleInputResolved() {
    this.modalManager?.clearAllModals();
  }

  /**
   * モーダルナビゲーション (十字キー / 矢印キー)
   */
  handleModalNav(nav) {
    // 1. CharacterIntroModal の操作
    if (this.characterIntroModal && this.characterIntroModal.isIntroActive()) {
      if (this.characterIntroModal.activeType === 'MODE_SELECT') {
        const cards = document.querySelectorAll('#char-intro-modal .char-mode-card');
        if (cards && cards.length > 0) {
          const delta = (nav.type === 'next' || nav.type === 'down' || nav.type === 'right') ? 1 : -1;
          const currentIdx = (this._introModeCardIndex !== undefined) ? this._introModeCardIndex : 0;
          this._introModeCardIndex = (currentIdx + delta + cards.length) % cards.length;
          cards.forEach((c, idx) => {
            if (idx === this._introModeCardIndex) {
              c.classList.add('selected');
              if (typeof c.scrollIntoView === 'function') c.scrollIntoView({ block: 'nearest' });
              if (typeof c.focus === 'function') c.focus();
            } else {
              c.classList.remove('selected');
            }
          });
        }
      }
      return;
    }

    // 2. CharacterCreationModal の操作
    if (this.characterCreationModal && this.characterCreationModal.isVisible) {
      if (nav.type === 'left' || nav.type === 'right') {
        const tabs = ['role', 'race', 'gender', 'align', 'confirm'];
        const currentIdx = tabs.indexOf(this.characterCreationModal.activeTab);
        const nextIdx = (currentIdx + (nav.type === 'right' ? 1 : -1) + tabs.length) % tabs.length;
        this.characterCreationModal.onTabClick(tabs[nextIdx]);
      } else {
        const items = this.characterCreationModal.currentItems || [];
        if (items.length > 0) {
          // 下または上でカード選択
          const delta = (nav.type === 'next' || nav.type === 'down') ? 1 : -1;
          this._createItemIndex = ((this._createItemIndex ?? 0) + delta + items.length) % items.length;
          const cards = document.querySelectorAll('#char-create-modal .char-card-item');
          cards.forEach((c, idx) => {
            if (idx === this._createItemIndex) {
              c.classList.add('focus');
              c.scrollIntoView({ block: 'nearest' });
            } else {
              c.classList.remove('focus');
            }
          });
        }
      }
      return;
    }

    // 3. ModalManager のメニューモーダル操作
    if (this.modalManager && this.modalManager.elMenuModal && !this.modalManager.elMenuModal.classList.contains('hidden')) {
      const btns = this.modalManager.selectableMenuButtons || [];
      if (btns.length > 0) {
        const delta = (nav.type === 'next' || nav.type === 'down') ? 1 : -1;
        this.modalManager.activeMenuFocusIndex = (this.modalManager.activeMenuFocusIndex + delta + btns.length) % btns.length;
        this.modalManager.updateMenuFocus();
      }
      return;
    }
  }

  /**
   * モーダル決定 (Aボタン / Enter)
   */
  handleModalSubmit() {
    // 1. CharacterIntroModal の決定
    if (this.characterIntroModal && this.characterIntroModal.isIntroActive()) {
      if (this.characterIntroModal.activeType === 'ASKNAME') {
        const inputEl = document.getElementById('intro-name-input');
        const defaultName = this.characterIntroModal.currentData?.detectedName || this.characterIntroModal.currentData?.defaultName || 'Hero';
        const nameVal = (inputEl && inputEl.value.trim()) || defaultName;
        this.characterIntroModal.confirmName(nameVal);
      } else if (this.characterIntroModal.activeType === 'MODE_SELECT') {
        const cards = document.querySelectorAll('#char-intro-modal .char-mode-card');
        const target = cards[this._introModeCardIndex] || cards[0];
        if (target) {
          target.click();
        } else {
          this.characterIntroModal.selectMode('y');
        }
      }
      return;
    }

    // 2. CharacterCreationModal の決定
    if (this.characterCreationModal && this.characterCreationModal.isVisible) {
      if (this.characterCreationModal.activeTab === 'confirm') {
        this.characterCreationModal.onConfirmStart();
      } else {
        const items = this.characterCreationModal.currentItems || [];
        const item = items[this._createItemIndex ?? 0] || items[0];
        if (item) {
          this.characterCreationModal.onCardClick(item);
        }
      }
      return;
    }

    // 3. ModalManager のメニュー決定
    if (this.modalManager && this.modalManager.elMenuModal && !this.modalManager.elMenuModal.classList.contains('hidden')) {
      const btns = this.modalManager.selectableMenuButtons || [];
      const btn = btns[this.modalManager.activeMenuFocusIndex];
      if (btn) {
        btn.click();
      }
      return;
    }

    // 4. ModalManager のテキストウィンドウ (--More--)
    if (this.modalManager && this.modalManager.isTextWindowMode) {
      if (this.core) {
        this.core.sendKey('Space');
      }
      return;
    }

    // 5. プロンプトバー
    if (this.modalManager && this.modalManager.elPromptBar && !this.modalManager.elPromptBar.classList.contains('hidden')) {
      const submitBtn = document.getElementById('btn-submit-text');
      if (submitBtn) {
        submitBtn.click();
      } else if (this.core) {
        this.core.respond(' ');
      }
      return;
    }
  }

  /**
   * モーダルキャンセル (Bボタン / Escape)
   */
  handleModalCancel() {
    // 1. CharacterIntroModal のキャンセル
    if (this.characterIntroModal && this.characterIntroModal.isIntroActive()) {
      this.characterIntroModal.hide();
      if (this.core) {
        this.core.respond('\x1b');
      }
      return;
    }

    // 2. CharacterCreationModal のキャンセル
    if (this.characterCreationModal && this.characterCreationModal.isVisible) {
      this.characterCreationModal.hide();
      if (this.core) {
        this.core.respond('q');
      }
      return;
    }

    // 3. ModalManager のメニューキャンセル
    if (this.modalManager && this.modalManager.elMenuModal && !this.modalManager.elMenuModal.classList.contains('hidden')) {
      if (this.core) {
        this.core.respond(0);
      }
      this.modalManager.clearAllModals();
      return;
    }

    // 4. プロンプトバーのキャンセル
    if (this.modalManager && this.modalManager.elPromptBar && !this.modalManager.elPromptBar.classList.contains('hidden')) {
      if (this.core) {
        this.core.respond('\x1b');
      }
      this.modalManager.clearAllModals();
      return;
    }
  }

  /**
   * ステータスバー更新
   * StatusAccessor / WebUICore の構造化ステータスモデルを正規利用
   */
  updateStatusBar(status) {
    const st = status || this.core?.getStatus() || this.core?.statusAccessor?.getStatus() || {};

    // 1. 階層 (B1F 形式)
    if (this.stDlevel) {
      const level = (st.dlevel && typeof st.dlevel === 'object') 
        ? (st.dlevel.level || 1) 
        : (typeof st.dlevel === 'number' ? st.dlevel : 1);
      this.stDlevel.textContent = `🗺️ B${level}F`;
    }

    // 2. HP ゲージ＆テキスト
    if (this.stHp && this.stHpFill) {
      const curHp = (st.hp && typeof st.hp === 'object') 
        ? (st.hp.current ?? 16) 
        : (typeof st.hp === 'number' ? st.hp : 16);
      const maxHp = (st.hp && typeof st.hp === 'object') 
        ? (st.hp.max ?? 16) 
        : (st.hpMax ?? 16);

      this.stHp.textContent = `${curHp}/${maxHp}`;
      const ratio = maxHp > 0 ? (curHp / maxHp) : 0;
      const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
      this.stHpFill.style.width = `${pct}%`;

      if (pct <= 25) {
        this.stHpFill.style.background = '#ef4444';
      } else if (pct <= 50) {
        this.stHpFill.style.background = '#f59e0b';
      } else {
        this.stHpFill.style.background = '#22c55e';
      }
    }

    // 3. 満腹度・状態異常 (平常時は非表示、注意・異常時のみシレン風警告バッジを表示)
    if (this.stHunger) {
      const hungerMap = {
        'satiated': '満腹',
        'hungry': '空腹',
        'weak': 'ハラヘリ',
        'fainting': '倒れそう',
        'fainted': '失神',
        'starved': '餓死寸前'
      };
      const rawHunger = typeof st.hunger === 'string' ? st.hunger.toLowerCase().trim() : '';
      const condList = Array.isArray(st.conditions) ? st.conditions : [];

      if (rawHunger && hungerMap[rawHunger]) {
        this.stHunger.style.display = 'inline-flex';
        this.stHunger.textContent = `🍖 ${hungerMap[rawHunger]}`;
        this.stHunger.style.color = (rawHunger === 'satiated') ? '#38bdf8' : '#ef4444';
      } else if (condList.length > 0) {
        this.stHunger.style.display = 'inline-flex';
        this.stHunger.textContent = `⚠️ ${condList[0]}`;
        this.stHunger.style.color = '#ef4444';
      } else {
        // 平常時は非表示（不要なノイズを排除）
        this.stHunger.style.display = 'none';
        this.stHunger.textContent = '';
      }
    }

    // 4. ゴールド
    if (this.stGold) {
      const gold = (st.gold && typeof st.gold === 'object') 
        ? (st.gold.amount ?? 0) 
        : (typeof st.gold === 'number' ? st.gold : 0);
      this.stGold.textContent = `🪙 ${gold}`;
    }

    // 5. レベル
    if (this.stExp) {
      const expLvl = (st.exp && typeof st.exp === 'object') 
        ? (st.exp.level ?? 1) 
        : (st.expLevel ?? 1);
      this.stExp.textContent = `Lv: ${expLvl}`;
    }

    // 6. ターン数
    if (this.stTurn) {
      const turns = st.turns ?? st.turn ?? 1;
      this.stTurn.textContent = `T: ${turns}`;
    }
  }

  showMessage(msg) {
    if (!this.msgOverlay || !msg) return;
    this.msgOverlay.textContent = msg;
    this.msgOverlay.classList.add('active');
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => {
      this.msgOverlay.classList.remove('active');
    }, 3500);
  }
}

// 起動
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const client = new ConsoleClient();
    client.init().catch(err => {
      console.error('[ConsoleClient] Failed to initialize:', err);
    });
  });
}
