import { WebUICore } from '../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../src/driver/index.js';
import { GKLPlugin } from '../../src/core/knowledge/GKLPlugin.js';
import { OnDemandLookService } from "../../src/core/knowledge/services/OnDemandLookService.js";
import { ContainerController } from '../../src/core/container/ContainerController.js';
import { UIConfigStore } from '../../src/ui-controller/index.js';
import '../../src/components/index.js';

import { ClientLocalization } from './modules/i18n/ClientLocalization.js';
import { LayoutController } from './modules/layout/LayoutController.js';
import { VisualFxDispatcher } from './modules/effects/VisualFxDispatcher.js';
import { StartupFlowController } from './modules/startup/StartupFlowController.js';
import { CanvasInteractionController } from './modules/interaction/CanvasInteractionController.js';
import { ViewModeController } from './modules/renderers/ViewModeController.js';
import { UiComponentFactory } from './modules/components/UiComponentFactory.js';
import { DomEventBinder } from './modules/handlers/DomEventBinder.js';

/**
 * GklPureJSClient - GKL (Game Knowledge Layer) 統合 Pure JS クライアント メインコントローラー
 */
class GklPureJSClient {
  constructor() {
    this.uiConfigStore = new UIConfigStore();
    this.layoutConfig = this.uiConfigStore.get();
    this.clientLocalization = new ClientLocalization(this);
    this.layoutController = new LayoutController(this);
    this.visualFxDispatcher = new VisualFxDispatcher(this);
    this.startupFlow = new StartupFlowController(this);
    this.interactionController = new CanvasInteractionController(this);
    this.viewModeController = new ViewModeController(this);
    this.core = null;
    this.containerController = null;
    this.lookService = null;
    this.currentLanguage = 'ja';
    this.userPreferredTab = 'advices';
    this.lastKnowledgeTarget = null;
    this.isGameExited = false;
    this.currentGameOverResult = null;
    this.lastTurns = -1;

    UiComponentFactory.createAndBindComponents(this);
    this.init();
  }

  get currentViewMode() {
    return this.viewModeController ? this.viewModeController.currentViewMode : (this._currentViewMode || 'graphic');
  }

  set currentViewMode(val) {
    this._currentViewMode = val;
    if (this.viewModeController) {
      this.viewModeController.currentViewMode = val;
    }
  }

  init() {
    this.virtualScreen.initTileImageWithFallback([
      '../../pict/nethack_default_32_tr.png',
      '../../assets/nethack_default_32_tr.png',
      'pict/nethack_default_32_tr.png',
      'assets/nethack_default_32_tr.png',
      '/pict/nethack_default_32_tr.png',
      '/assets/nethack_default_32_tr.png'
    ], () => {
      this.virtualScreen.markAllDirty();
    });
    this.mainViewportRenderer.init();

    // 🖥️ 初期ビューモードの同期確定 (WebGPU判定前のフォールバック/クラシック初期化)
    const initialMode = this.layoutConfig?.preset === 'classic' ? 'ascii' : 'graphic';
    this.setViewMode(initialMode);

    if (this.webgpuRenderer) {
      this.webgpuRenderer.init().then((ok) => {
        if (this.layoutConfig?.preset === 'classic') {
          // クラシックプリセットの場合は ASCII を優先
          this.setViewMode('ascii');
          return;
        }
        if (ok) {
          // WebGPU 対応環境ではデフォルトで HD2D ジオラマを本番メインに昇格
          this.setViewMode('hd2d');
          //console.log("[WebGPU HD2D] ✨ HD2D Diorama promoted to primary renderer!");
        } else {
          // 非対応環境では Canvas 2D フォールバック
          this.setViewMode('graphic');
        }
      });
    }

    this.initCore();
    const alm = this.core?.getAdventureLogManager?.();
    if (this.codexModal && alm) {
      this.codexModal.setAdventureLogManager(alm);
    }
    this.layoutController.init();
    this.codexModal?.init();
    this.bindCoreEvents();
    this.bindDOMEvents();
    this.layoutController.bindLayoutEvents();
    this.interactionController.bindInteractionEvents();
    this.onLanguageChanged();
    this.bootstrapGame();
    this.startMainRenderLoop();
  }

  startMainRenderLoop() {
    const loop = () => {
      const situation = this.core?.gkl?.getSituation();
      if (situation) {
        if (this.currentViewMode === 'graphic' && this.mainViewportRenderer) {
          this.mainViewportRenderer.renderMainViewport(situation.area);
        } else if (this.currentViewMode === 'hd2d') {
          // WebGPU モード時も VirtualDungeonScreen の Dirty セルをオフスクリーン Canvas にフラッシュ！
          this.virtualScreen.flushDirtyCells(situation.area?.grid, this.mainViewportRenderer.glyphGridBuffer);
        }
        // WebGPU HD2D モード中もミニマップ HUD はフロア全体をリアルタイム連動描画
        if (this.currentViewMode === 'graphic' || this.currentViewMode === 'hd2d') {
          this.minimapRenderer?.renderMinimap(situation);
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  initCore() {
    const workerPath = '../../src/driver/nethack.worker.js';
    const bridge = new NetHackWasmWorkerBridge(workerPath);
    this.core = new WebUICore({ driver: bridge, keyMode: 'numpad' });
    this.currentLanguage = this.core.language || 'ja';

    this.containerController = new ContainerController({ core: this.core });
    this.containerController.attach(this.core);

    // GKL EncumbranceStateManager と ContainerController の自動連携
    const encMgr = this.core.gkl?.getEncumbranceStateManager();
    if (encMgr && this.containerController.contentsManager) {
      encMgr.setContainerContentsManager(this.containerController.contentsManager);
    }

    // コンテナ中身の確定・出し入れ時にインベントリ・負荷ゲージを即座に再描画
    if (this.containerController.contentsManager) {
      this.containerController.contentsManager.on('contentsConfirmed', () => {
        this.renderGklUi();
      });
      this.containerController.contentsManager.on('itemTransferred', () => {
        this.renderGklUi();
      });
    }

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

  updateCodexBadge(count) {
    const elBadge = document.getElementById('codex-unread-badge');
    if (!elBadge) return;
    if (count > 0) {
      elBadge.textContent = count > 99 ? '99+' : count;
      elBadge.classList.remove('hidden');
    } else {
      elBadge.classList.add('hidden');
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

    // 2. Message Log & Floating HUD
    this.core.on('message', (msg) => {
      if (this.isGameExited) return;
      this.addMessageLog(msg);
    });

    this.core.on('bubbleMessage', (bubble) => {
      if (this.isGameExited || !bubble) return;
      this.floatingMessageHud.pushMessage(bubble);
      if (this.messageHistoryDrawer.isOpen()) {
        this.messageHistoryDrawer.renderList();
      }
    });

    this.core.on('messageItem', (item) => {
      if (this.isGameExited || !item) return;
      if (this.messageHistoryDrawer.isOpen()) {
        this.messageHistoryDrawer.renderList();
      }
    });

    this.core.on('messageUpdate', (item) => {
      if (this.isGameExited || !item) return;
      this.floatingMessageHud.updateMessage(item);
      if (this.messageHistoryDrawer.isOpen()) {
        this.messageHistoryDrawer.renderList();
      }
    });

    // 3. Status Update
    this.core.on('statusUpdate', ({ status }) => {
      if (!status) return;
      if (status.turns !== undefined && status.turns > this.lastTurns) {
        // [HOTFIX] メッセージ出力直後の受動的なターン更新でメッセージが早期STALE/フェードアウト消滅するのを防止。
        // notifyUserAction はプレイヤー自身の能動的な操作 (キー入力、D-Padタップ、アクション実行等) に限定。
        // if (this.lastTurns !== -1) {
        //   this.floatingMessageHud?.notifyUserAction();
        // }
        this.lastTurns = status.turns;
      }
      this.statusView.updateStatus(status);
      this.renderGklUi();
    });

    // 4. Cursor Movement
    this.core.on('cursor', ({ x, y }) => {
      const prevX = this.mainViewportRenderer.targetCursorX;
      const prevY = this.mainViewportRenderer.targetCursorY;
      this.mainViewportRenderer.targetCursorX = x;
      this.mainViewportRenderer.targetCursorY = y;
      if (this.minimapRenderer) {
        this.minimapRenderer.targetCursorX = x;
        this.minimapRenderer.targetCursorY = y;
      }
      if (this.webgpuRenderer) {
        this.webgpuRenderer.targetCursorX = x;
        this.webgpuRenderer.targetCursorY = y;
        this.webgpuRenderer.wakeUp();
      }

      if (prevX >= 0 && prevY >= 0) this.mainViewportRenderer.redrawSingleCell(prevX, prevY);
      if (x >= 0 && y >= 0) {
        this.mainViewportRenderer.redrawSingleCell(x, y);
      }

      // プレイヤーが移動した場合は床文字HUD・フローティングアクションを自然に片付け
      if (prevX !== x || prevY !== y) {
        this.engravingHud?.onPlayerMoved(x, y);
        this.floatingActions?.onPlayerMoved(x, y);
      }
    });

    // 4.5 床文字・考古学的復元シグナル (SIGNAL_LORE_ENGRAVE) の受信 (案A HUD)
    this.core.on('signal:SIGNAL_LORE_ENGRAVE', (data) => {
      //console.log('[GklClient] Received signal:SIGNAL_LORE_ENGRAVE:', data);
      if (this.isGameExited) return;
      this.engravingHud?.show(data);
    });

    // 4.6 伝承シグナル (噂話、神託、床文字、墓碑銘) 受信時の冒険手帳未読バッジ即時反映
    this.core.on('loreSignal', (data) => {
      //console.log('[GklClient] Received loreSignal for LoreCodex:', data);
      if (this.codexModal) {
        this.codexModal.notifyUnreadCount();
      }
    });

    // 4.7 冒険手帳 (Adventure Log) リアルタイム新規発見トースト通知
    this.core.on('adventureLogUnlocked', (data) => {
      if (this.isGameExited || !data) return;
      this.adventureLogToast?.notifyUnlock(data);
      this.codexModal?.notifyUnreadCount();

      // 💬 ゲーム内メッセージHUD ＆ ログへの出力
      const isEn = this.currentLanguage === 'en';
      let sysMsg = '';
      if (data.category === 'monster') {
        const name = isEn ? data.name : (data.nameJa || data.name);
        sysMsg = isEn ? `📖 [Adventure Log] Encountered new monster: ${name}` : `📖 [冒険手帳] 新種モンスター遭遇: ${name} を記録しました`;
      } else if (data.category === 'object') {
        const name = isEn ? data.name : (data.nameJa || data.name);
        sysMsg = isEn ? `📖 [Adventure Log] New item obtained: ${name}` : `📖 [冒険手帳] 新アイテム入手: ${name} を記録しました`;
      } else if (data.category === 'rumor') {
        sysMsg = isEn ? `📜 [Adventure Log] Recorded new rumor into Codex!` : `📜 [冒険手帳] 新たな噂を手帳に記録しました`;
      } else if (data.category === 'oracle') {
        if (data.isBulk) {
          sysMsg = isEn ? `🏛️ [Adventure Log] Recorded Oracle's prophecies!` : `🏛️ [冒険手帳] オラクルの大予言を手帳に記録しました！`;
        } else {
          const title = isEn ? (data.title || 'Prophecy') : (data.titleJa || data.title || '神託');
          sysMsg = isEn ? `🏛️ [Adventure Log] Recorded prophecy: ${title}` : `🏛️ [冒険手帳] 神託を記録しました: ${title}`;
        }
      }

      if (sysMsg) {
        if (this.floatingMessageHud) {
          this.floatingMessageHud.pushMessage({
            id: Date.now(),
            text: sysMsg,
            isBold: true
          });
        }
        this.addMessageLog(sysMsg);
      }
    });

    if (typeof window !== 'undefined') {
      window.core = this.core;
      window.gkl = this.core.gkl;
      window.engravingHud = this.engravingHud;
      window.mainViewportRenderer = this.mainViewportRenderer;
      window.minimapRenderer = this.minimapRenderer;
    }

    // 5. Print Glyph (Map Update & GKL AreaStateManager 同期)
    this.core.on('print_glyph', ({ x, y, glyphInfo, glyph }) => {
      const gi = glyphInfo || {};
      const ch = gi.ch || ' ';
      const color = gi.color !== undefined ? gi.color : 7;
      const gId = (gi.glyph !== undefined && gi.glyph !== null) ? gi.glyph : (glyph !== undefined && glyph !== null ? glyph : -1);

      if (x >= 0 && x < 80 && y >= 0 && y < 24) {
        this.virtualScreen?.markDirty(x, y);
        this.mainViewportRenderer.asciiGridBuffer[y][x] = { ch, color };
        this.mainViewportRenderer.glyphGridBuffer[y][x] = { glyph: gId, ch, color };
        this.mainViewportRenderer.redrawSingleCell(x, y);
        if (this.currentViewMode === 'hd2d' && this.webgpuRenderer) {
          this.webgpuRenderer.markDirty();
          this.webgpuRenderer.wakeUp();
        }
      }
    });

    // 6. Clear Window / Clear Map
    this.core.on('clear_nhwindow', ({ windowId }) => {
      if (windowId === 2 || windowId === 0) {
        this.virtualScreen?.clearScreen();
        this.mainViewportRenderer.clearMapGrid();
        this.webgpuRenderer?.markDirty();
        this.webgpuRenderer?.wakeUp();
      }
    });

    this.core.on('map_cleared', () => {
      this.virtualScreen?.clearScreen();
      this.mainViewportRenderer.clearMapGrid();
      this.webgpuRenderer?.markDirty();
      this.webgpuRenderer?.wakeUp();
    });

    this.core.on('restarted', () => {
      this.resetUiForNewGame();
    });

    // 7. Input Required Prompts & Modals
    this.core.on('inputRequired', (data) => {
      // 起動シーケンス進行中の場合
      if (this.isStartingUp && this.startupStep === 'PROGRESS') {
        const cat = data?.promptCategory || data?.category;
        //console.log(`[Startup] inputRequired during PROGRESS: cat=${cat}, prompt=${data?.prompt || data?.rawPrompt}`);

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
            //console.log('[Startup] Auto-responding Space for empty KEY prompt during save restore');
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

      // コンテナセッションがアクティブな場合、通常のメニュー表示は抑制（二面パネルUIが担当）
      if (this.core.isContainerSessionActive) {
        this.renderGklUi();
        return;
      }
      this.modalManager.handleInputRequired(data);
      this.renderGklUi();
    });

    this.core.on('inputAutoResolved', (data) => {
      //console.log(`[Startup] inputAutoResolved: category=${data?.category}, response=${data?.response}`);
    });

    // 8. Input Resolved
    this.core.on('inputResolved', () => {
      this.modalManager.clearAllModals();
      this.renderGklUi();
    });

    // GKL 状態同期イベント時の UI 再描画
    this.core.on('inventoryStateUpdated', () => {
      this.renderGklUi();
      if (this.paperdollModal && this.paperdollModal.isVisible) {
        this.paperdollModal.render();
      }
    });
    this.core.on('attributesStateUpdated', () => this.renderGklUi());
    this.core.on('spellsStateUpdated', () => this.renderGklUi());
    this.core.on('skillsStateUpdated', () => this.renderGklUi());
    this.core.on('discoveriesStateUpdated', () => {
      this.virtualScreen?.markAllDirty();
      this.mainViewportRenderer?.render();
      this.webgpuRenderer?.markDirty();
      this.webgpuRenderer?.wakeUp();
      this.renderGklUi();
    });


    // 9. Game Over & Exited
    this.core.on('gameOver', (result) => {
      this.currentGameOverResult = result;
    });

    this.core.on('exited', async (data) => {
      await this.handleExited(data);
    });

    // 10. Visual FX 演出トリガーイベント (fx_trigger) 購読 (VisualFxDispatcher 委譲)
    this.core.on('fx_trigger', (fx) => {
      this.visualFxDispatcher.handleFxTrigger(fx);
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

  setViewMode(mode) {
    this.viewModeController.setViewMode(mode);
  }

  cycleViewMode() {
    this.viewModeController.cycleViewMode();
  }

  updateViewModeUI() {
    this.viewModeController.updateViewModeUI();
  }

  toggleCameraMode() {
    this.viewModeController.toggleCameraMode();
  }


  bindDOMEvents() {
    DomEventBinder.bind(this);
  }

  renderAll() {
    this.renderGklUi();
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

    // 2. GKL アイコン型所持品インベントリ (Level 1 Nano Badge 付与 & 負荷ゲージ)
    this.inventoryView.renderGklInventory(situation.inventory, slotBadges, situation.encumbrance);

    // 3. 属性耐性 & 修得魔法 & スキル熟練度
    this.statusView.renderGklAttributes(situation.attributes);
    this.statusView.renderGklSpells(situation.spells, slotBadges);
    this.statusView.renderGklSkills(situation.skills);

    // 4. 戦術アドバイス ＆ 危機警告
    this.knowledgeView.renderGklAdvices(situation.advices || []);
  }

  onLanguageChanged() {
    this.clientLocalization.applyLanguage(this.currentLanguage);
  }

  /**
   * 📚 '/' コマンドプログレッシブ拡張: 統合ナレッジインスペクターを開く (CanvasInteractionController 委譲)
   */
  openKnowledgeInspector() {
    this.interactionController.openKnowledgeInspector();
  }

  /**
   * 📜 '\' または '¥' コマンドプログレッシブ拡張: ディスカバリー図鑑を開く (CanvasInteractionController 委譲)
   */
  openDiscoveryCodex() {
    this.interactionController.openDiscoveryCodex();
  }

  addMessageLog(msg) {
    if (!msg || !this.elMessageLog) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.textContent = msg;
    this.elMessageLog.appendChild(line);
    this.elMessageLog.scrollTop = this.elMessageLog.scrollHeight;
  }

  // ==========================================
  // 🚀 スタートアップ ＆ セーブ管理 (StartupFlowController 委譲)
  // ==========================================
  resetUiForNewGame() {
    this.startupFlow.resetUiForNewGame();
  }

  setStartupView(step) {
    this.startupFlow.setStartupView(step);
  }

  async restartGame() {
    await this.startupFlow.restartGame();
  }

  async deleteSaveFile() {
    await this.startupFlow.deleteSaveFile();
  }

  async handleExited(data) {
    await this.startupFlow.handleExited(data);
  }

  async bootstrapGame() {
    await this.startupFlow.bootstrapGame();
  }

  async startWithProgress(isResume, forceNewGame) {
    await this.startupFlow.startWithProgress(isResume, forceNewGame);
  }

  transitionToStartupReady() {
    this.startupFlow.transitionToStartupReady();
  }

  completeStartup(triggerCodeOrKey = null) {
    this.startupFlow.completeStartup(triggerCodeOrKey);
  }

  // ==========================================
  // 🎨 レイアウト & 外観カスタマイズ管理 (LayoutController 委譲)
  // ==========================================
  initLayoutConfig() {
    this.layoutController.init();
  }

  getDefaultLayoutConfig() {
    return this.layoutController.getDefaultLayoutConfig();
  }

  loadLayoutConfig() {
    return this.layoutController.loadLayoutConfig();
  }

  saveLayoutConfig(config) {
    return this.layoutController.saveLayoutConfig(config);
  }

  toggleSidePanel(forceState) {
    this.layoutController.toggleSidePanel(forceState);
  }

  applyLayoutConfig(config) {
    this.layoutController.applyLayoutConfig(config);
  }

  setPreset(presetName) {
    this.layoutController.setPreset(presetName);
  }
}

// 起動
const gklClient = new GklPureJSClient();
if (typeof window !== 'undefined') {
  window.gklClient = gklClient;
}

