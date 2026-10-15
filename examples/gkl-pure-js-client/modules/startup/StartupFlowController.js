/**
 * @file StartupFlowController.js
 * @description GKL Pure JS Client のスタートアップ状態遷移 ＆ セーブデータ管理コントローラー
 */

import { GAME_LIFECYCLE_STATE, GameLifecycleManager } from '../../../../src/core/lifecycle/GameLifecycleState.js';

export class StartupFlowController {
  /**
   * @param {Object} client - GklPureJSClient インスタンス参照
   */
  constructor(client) {
    this.client = client;
    this.startupStep = 'INITIALIZING';
    this.isStartingUp = true;
    this.isSaveResuming = false;
    this.lifecycle = new GameLifecycleManager();
  }

  /**
   * スタートアップウィザードの表示段階を切り替え
   * @param {'INITIALIZING' | 'SELECTION' | 'PROGRESS' | 'READY' | 'PLAYING'} step
   */
  setStartupView(step) {
    this.startupStep = step;
    this.client.startupStep = step;

    // GameLifecycleState との連動
    const stateMap = {
      INITIALIZING: GAME_LIFECYCLE_STATE.INITIALIZING,
      SELECTION: GAME_LIFECYCLE_STATE.BOOTSTRAPPING,
      PROGRESS: GAME_LIFECYCLE_STATE.CORE_STARTING,
      READY: GAME_LIFECYCLE_STATE.READY_STANDBY,
      PLAYING: GAME_LIFECYCLE_STATE.ACTIVE_PLAY
    };
    if (stateMap[step]) {
      this.lifecycle.isSaveResuming = this.isSaveResuming;
      this.lifecycle.transitionTo(stateMap[step]);
    }

    if (typeof document === 'undefined') return;

    const modalManager = this.client.modalManager;
    const card = modalManager?.elSelectorCard;
    const cardButtons = document.getElementById('start-card-buttons');
    const cardInfo = document.getElementById('start-card-info');
    const cardSpinner = document.getElementById('start-card-spinner');
    const cardReady = document.getElementById('start-card-ready');
    const readyAction = document.getElementById('start-card-ready-action');
    const spinnerBox = modalManager?.elSpinnerBox;
    const loadingOverlay = modalManager?.elLoading;

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

  /**
   * 新規ゲーム開始時の各種UI・状態の初期化
   */
  resetUiForNewGame() {
    const client = this.client;
    client.currentGameOverResult = null;
    client.isGameExited = false;
    client.lastTurns = -1;
    client.isPlayerDead = false;

    if (client.mapRenderer) {
      client.mapRenderer.isPlayerDead = false;
      client.mapRenderer.deathPosition = null;
    }
    if (client.zoomRenderer) {
      client.zoomRenderer.isPlayerDead = false;
      client.zoomRenderer.deathPosition = null;
      client.zoomRenderer.activeFxList = [];
    }
    if (client.mainViewportRenderer) {
      client.mainViewportRenderer.isPlayerDead = false;
      client.mainViewportRenderer.deathPosition = null;
      client.mainViewportRenderer.activeFxList = [];
    }
    if (client.webgpuRenderer) {
      client.webgpuRenderer.isPlayerDead = false;
      client.webgpuRenderer.deathPosition = null;
      client.webgpuRenderer.activeFxList = [];
      client.webgpuRenderer.markDirty();
      client.webgpuRenderer.wakeUp();
    }
    client.lastKnowledgeTarget = null;
    client.userPreferredTab = 'advices';

    client.modalManager?.reset();
    client.virtualScreen?.clearScreen();
    client.mapRenderer?.clearMapGrid();
    if (client.elMessageLog) client.elMessageLog.innerHTML = '';
    client.floatingMessageHud?.clear();

    const elCritBadge = document.getElementById('st-advice-critical-badge');
    if (elCritBadge) elCritBadge.classList.add('hidden');

    client.assistHud?.renderAssistSignalBar(null);
    client.assistHud?.renderFloorLandmarks(null);
    client.directionPad?.renderGklActions([]);
    client.inventoryView?.renderGklInventory({ items: [] }, {});
    if (client.knowledgeView) {
      client.knowledgeView.lastAdvices = [];
      client.knowledgeView.lastKnowledgeTarget = null;
      client.knowledgeView.renderSideAdvices();
    }

    if (client.core && client.core.gkl && typeof client.core.gkl.reset === 'function') {
      client.core.gkl.reset();
    }

    client.codexModal?.notifyUnreadCount();
  }

  /**
   * ゲーム起動ウィザード（セーブデータ検出・選択肢提示）
   */
  async bootstrapGame() {
    try {
      this.isStartingUp = true;
      this.client.isStartingUp = true;
      if (this.client.characterCreationModal) {
        this.client.characterCreationModal.reset();
      }
      if (this.client.characterIntroModal) {
        this.client.characterIntroModal.reset();
      }
      this.setStartupView('SELECTION');

      const btnStartResume = document.getElementById('btn-start-resume');
      const btnStartNew = document.getElementById('btn-start-new');
      const btnStartFresh = document.getElementById('btn-start-fresh');
      const cardTitle = document.getElementById('start-card-title');
      const cardMsg = document.getElementById('start-card-msg');
      const isEn = this.client.currentLanguage === 'en';

      const saveInfo = await this.client.core.detectSavedGameInfo();
      if (saveInfo && saveInfo.hasSave) {
        this.isSaveResuming = true;
        this.client.isSaveResuming = true;
        if (cardTitle) cardTitle.textContent = isEn ? '💾 Save Data Found' : '💾 セーブデータが見つかりました';
        if (cardMsg) cardMsg.innerHTML = `${isEn ? 'Player' : '冒険者'}: <strong id="start-save-name">${saveInfo.savePlayerName || 'Hero'}</strong>`;
        if (btnStartResume) btnStartResume.classList.remove('hidden');
        if (btnStartNew) btnStartNew.classList.remove('hidden');
        if (btnStartFresh) btnStartFresh.classList.add('hidden');
      } else {
        this.isSaveResuming = false;
        this.client.isSaveResuming = false;
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

  /**
   * プログレス表示を伴うゲームコアの起動
   * @param {boolean} isResume
   * @param {boolean} forceNewGame
   */
  async startWithProgress(isResume, forceNewGame) {
    this.isSaveResuming = isResume;
    this.client.isSaveResuming = isResume;
    this.setStartupView('PROGRESS');

    const isEn = this.client.currentLanguage === 'en';
    const progressText = document.getElementById('start-card-progress-text');
    if (progressText) {
      progressText.textContent = isResume
        ? (isEn ? '🔄 Restoring dungeon state...' : '🔄 ダンジョンを復元中...')
        : (isEn ? '🔄 Generating new dungeon...' : '🔄 新しいダンジョンを生成中...');
    }

    try {
      await this.client.core.start('nethack.js', { forceNewGame });
    } catch (e) {
      console.error("Core start failed:", e);
    }
  }

  /**
   * ダンジョン準備完了への移行 (READY)
   */
  transitionToStartupReady() {
    if (this.startupStep !== 'PROGRESS') return;
    if (this.client.characterCreationModal) {
      this.client.characterCreationModal.isCompleted = true;
    }
    if (this.client.modalManager) {
      this.client.modalManager.clearAllModals();
    }
    this.setStartupView('READY');

    const isEn = this.client.currentLanguage === 'en';
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

  /**
   * ダンジョン突入完了 (PLAYING への遷移)
   * @param {string|null} triggerCodeOrKey
   */
  async completeStartup(triggerCodeOrKey = null) {
    if (!this.isStartingUp && this.startupStep === 'PLAYING') return;
    this.isStartingUp = false;
    this.client.isStartingUp = false;
    this.setStartupView('PLAYING');

    const executeTrigger = () => {
      if (typeof window !== 'undefined' && typeof window.focus === 'function') {
        window.focus();
      }

      // 🎯 セーブ復帰・新規開始共通: ダンジョン突入トリガー発火時のインベントリ・ステータス強制確定同期
      const gkl = this.client.core?.gkl;
      if (gkl && gkl.inventoryStateManager && typeof gkl.inventoryStateManager.syncFromDirectBinding === 'function') {
        const changed = gkl.inventoryStateManager.syncFromDirectBinding();
        if (changed && this.client.core) {
          this.client.core.emit('inventoryStateUpdated', gkl.inventoryStateManager);
        }
      }

      if (this.client.statusView && this.client.core?.statusAccessor) {
        const currentStatus = this.client.core.statusAccessor.getStatus();
        if (currentStatus) {
          this.client.statusView.updateStatus(currentStatus);
        }
      }
      if (typeof this.client.renderGklUi === 'function') {
        this.client.renderGklUi();
      }

      // レンダラーの確定フラッシュ (Cコアへ余計な再描画キー Ctrl-R を送る代わり直接キック)
      if (this.client.mainViewportRenderer && typeof this.client.mainViewportRenderer.flushCommittedArea === 'function') {
        this.client.mainViewportRenderer.flushCommittedArea();
      }

      // 突入完了に伴いセーブ復帰ステートをリセット
      this.isSaveResuming = false;
      this.client.isSaveResuming = false;
      if (this.client.core) {
        this.client.core.isResumingSave = false;
      }

      if (triggerCodeOrKey && this.client.core) {
        if (triggerCodeOrKey !== ' ' && triggerCodeOrKey !== 'Space' && triggerCodeOrKey !== 'Enter') {
          this.client.core.sendKey(triggerCodeOrKey);
        }
      }
    };

    const dbs = this.client.core?.gkl?.wasmDirectBindingService;
    if (dbs && (dbs.isSyncing || dbs._isSyncing) && (dbs.currentSyncPromise || dbs._currentSyncPromise)) {
      try {
        await (dbs.currentSyncPromise || dbs._currentSyncPromise);
      } catch (_) {}
    }
    executeTrigger();
  }

  /**
   * ゲームの即時再起動
   */
  async restartGame() {
    this.isStartingUp = true;
    this.client.isStartingUp = true;
    this.setStartupView('INITIALIZING');
    this.resetUiForNewGame();
    if (this.client.modalManager?.elGameOverModal) {
      this.client.modalManager.elGameOverModal.classList.add('hidden');
    }

    try {
      await this.client.core.restart({ clearStorage: false, autoStart: false });
    } catch (err) {
      console.warn("[GklPureJSClient] core.restart:", err);
    }
    await this.bootstrapGame();
  }

  /**
   * セーブデータの完全削除
   */
  async deleteSaveFile() {
    const isEn = this.client.currentLanguage === 'en';
    const confirmMsg = isEn ? 'Are you sure you want to completely delete the save file?' : 'セーブファイルを完全に削除しますか？';
    if (confirm(confirmMsg)) {
      this.isStartingUp = true;
      this.client.isStartingUp = true;
      this.setStartupView('INITIALIZING');
      this.resetUiForNewGame();
      if (this.client.modalManager?.elGameOverModal) {
        this.client.modalManager.elGameOverModal.classList.add('hidden');
      }

      try {
        await this.client.core.restart({ clearStorage: true, autoStart: false });
      } catch (err) {
        console.warn("[GklPureJSClient] core.restart:", err);
      }
      await this.bootstrapGame();
    }
  }

  /**
   * ゲーム終了 (exited) 処理
   * @param {Object} data
   */
  async handleExited(data) {
    this.client.isGameExited = true;

    // 死亡/終了時に背後のアドバイス・HUD・アクションをクリーンアップ
    this.client.assistHud?.renderAssistSignalBar(null);
    this.client.assistHud?.renderFloorLandmarks(null);
    this.client.directionPad?.renderGklActions([]);
    this.client.knowledgeView?.renderGklAdvices([]);

    const result = this.client.currentGameOverResult || await this.client.core.resolveGameOver();
    await this.client.modalManager?.handleExited(result);
  }
}
