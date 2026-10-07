/**
 * GamepadInputController.js
 * 
 * GamepadManager のポーリング結果（物理キー、セマンティックアクション、UIシグナル、ラジアル入力）を受け取り、
 * GKL (ContextActionEngine, ActionRecipeFactory) および WebUICore、モーダルスタックへ
 * 安全かつセマンティックにルーティング・実行するコントローラー。
 */

import { ContextActionEngine } from '../knowledge/engines/ContextActionEngine.js';
import { ActionRecipeFactory } from '../request/ActionRecipeFactory.js';
import { GamepadManager } from './GamepadManager.js';
import { RADIAL_PALETTE_DEFAULT } from './defaultDefines.js';

export class GamepadInputController {
    /**
     * @param {Object} options
     * @param {Object} options.core - WebUICore インスタンス
     * @param {GamepadManager} [options.gamepadManager] - GamepadManager インスタンス
     * @param {Object} [options.modalStack] - ModalStackController インスタンス
     * @param {typeof ContextActionEngine} [options.contextActionEngine=ContextActionEngine]
     * @param {typeof ActionRecipeFactory} [options.actionRecipeFactory=ActionRecipeFactory]
     */
    constructor(options = {}) {
        this.core = options.core;
        this.gamepad = options.gamepadManager || new GamepadManager({ useSemantic: true, dpadOnlyMove: true });
        this.modalStack = options.modalStack || null;
        this.modalManager = options.modalManager || null;
        this.contextActionEngine = options.contextActionEngine || ContextActionEngine;
        this.actionRecipeFactory = options.actionRecipeFactory || ActionRecipeFactory;
        this.defaultRadialPalette = options.defaultRadialPalette || RADIAL_PALETTE_DEFAULT;
        this._selectedContextAction = null;

        this._listeners = {
            radialUpdate: [],
            radialFlick: [],
            contextActionChanged: [],
            contextActionSelected: [],
            toggleInventory: [],
            openSpells: [],
            inventoryNav: [],
            contextChanged: [],
            directionConfirm: [],
            dialogNav: [],
            dialogSubmit: [],
            dialogCancel: [],
            paletteChanged: []
        };

        this.isInventoryOpen = false;
        this.isDialogOpen = false;
        this._lastContext = 'NORMAL';
    }

    on(event, callback) {
        if (this._listeners[event]) {
            this._listeners[event].push(callback);
        }
    }

    _emit(event, data) {
        if (this._listeners[event]) {
            this._listeners[event].forEach(cb => cb(data));
        }
    }

    /**
     * インベントリの開閉状態を設定
     * @param {boolean} isOpen 
     */
    setInventoryOpen(isOpen) {
        this.isInventoryOpen = !!isOpen;
    }

    /**
     * ダイアログの開閉状態を設定
     * @param {boolean} isOpen 
     */
    setDialogOpen(isOpen) {
        this.isDialogOpen = !!isOpen;
    }

    /**
     * 選択中のコンテキストアクションを設定
     * @param {Object|null} action 
     */
    setSelectedContextAction(action) {
        this._selectedContextAction = action || null;
        this._emit('contextActionSelected', this._selectedContextAction);
    }

    /**
     * 選択中のコンテキストアクションをクリア
     */
    clearSelectedContextAction() {
        this._selectedContextAction = null;
        this._emit('contextActionSelected', null);
    }

    /**
     * 現在のシステムUI状態から適切なコンテキストを動的に判定
     * 優先順位: ダイアログ開 ➔ モーダル/インベントリ開 ➔ 方向待ち ➔ YN確認 ➔ メニュー/テキスト ➔ 通常
     * @returns {'NORMAL'|'DIALOG'|'MODAL_INVENTORY'|'DIRECTION'|'YN'|'MENU'|'LIN'}
     */
    resolveCurrentContext() {
        // 0. ダイアログが開いている場合 (最優先 Fail-Safe)
        if (this.isDialogOpen) {
            return 'DIALOG';
        }
        if (this.modalManager && typeof this.modalManager.isAnyModalOpen === 'function' && this.modalManager.isAnyModalOpen()) {
            return 'DIALOG';
        }

        // 1. モーダルスタックまたはインベントリが開いている場合 (Fail-Safe)
        if (this.isInventoryOpen) {
            return 'MODAL_INVENTORY';
        }
        if (this.modalStack && typeof this.modalStack.hasOpenModal === 'function' && this.modalStack.hasOpenModal()) {
            const top = typeof this.modalStack.getTopModal === 'function' ? this.modalStack.getTopModal() : null;
            if (top && (top.isDialog || top.context === 'DIALOG' || (top.id && (top.id.startsWith('modal-') || top.id.endsWith('Dialog') || top.id.endsWith('Modal'))))) {
                return 'DIALOG';
            }
            return 'MODAL_INVENTORY';
        }

        // 2. WebUICore のプロンプト・シグナル状態の判定
        if (this.core) {
            const category = this.core.currentPromptCategory;
            if (category === 'DIRECTION' || category === 'direction') {
                return 'DIRECTION';
            }
            if (category === 'YN' || category === 'yn') {
                return 'YN';
            }
            if (category === 'MENU' || category === 'menu') {
                return 'MENU';
            }
            if (category === 'LIN' || category === 'lin' || category === 'TEXT' || category === 'ASKNAME' || category === 'askname') {
                return 'LIN';
            }
        }

        return 'NORMAL';
    }

    /**
     * 現在の足元・周辺から最優先の推奨アクションを取得
     * ユーザーが右ホイールで明示的に選択したアクションがあればそれを最優先で返却
     * @returns {Object|null}
     */
    getPrimaryContextAction() {
        if (!this.core) return null;

        // 0. ユーザーが右ホイールで選択したアクションがある場合はそれを最優先
        if (this._selectedContextAction) {
            return this._selectedContextAction;
        }

        // 1. WebUICore.getSituation() が存在すればその推奨アクションを採用
        if (typeof this.core.getSituation === 'function') {
            const situation = this.core.getSituation();
            if (situation && Array.isArray(situation.actions) && situation.actions.length > 0) {
                return situation.actions[0];
            }
        }

        // 2. core.gkl または core.knowledge からコンテキストアクションを生成
        const gkl = this.core.gkl || this.core.knowledge;
        if (!gkl) return null;
        const areaState = gkl.areaStateManager?.getAreaState?.();
        if (!areaState) return null;

        const invState = gkl.inventoryStateManager || null;
        const skillState = gkl.skillStateManager || null;
        const statusAccessor = this.core.statusAccessor || gkl.statusAccessor || null;

        const actions = this.contextActionEngine.generateActions(areaState, invState, skillState, {}, statusAccessor);
        return actions && actions.length > 0 ? actions[0] : null;
    }

    /**
     * ポーリング実行＆ディスパッチ (コンテキスト動的スワップ対応)
     * @param {string|null} [context=null] - 未指定時は resolveCurrentContext() で自動判定
     * @param {string|null} [choices=null] - 未指定時は core.currentPromptChoices を使用
     * @param {number} [now=Date.now()]
     * @returns {Object} 処理サマリー
     */
    pollAndDispatch(context = null, choices = null, now = Date.now()) {
        const activeContext = context || this.resolveCurrentContext();
        const activeChoices = choices !== null ? choices : (this.core?.currentPromptChoices || '');

        if (activeContext !== this._lastContext) {
            this._emit('contextChanged', { previous: this._lastContext, current: activeContext });
            this._lastContext = activeContext;
            this._selectedContextAction = null;
        }

        const result = this.gamepad.pollSemanticInput(activeContext, activeChoices, now);

        // ラジアル状態の通知と選択アクション連動
        if (result.radial) {
            this._emit('radialUpdate', result.radial);

            // 右スティックでセクターが指し示されている時、Aボタンのアクションをそのアクションに切り替え
            if (result.radial.currentSector && this.gamepad.radialPalette) {
                const item = this.gamepad.radialPalette[result.radial.currentSector];
                if (item && (item.actionObj || item.action)) {
                    const chosen = item.actionObj || item.action;
                    if (this._selectedContextAction !== chosen) {
                        this._selectedContextAction = chosen;
                        this._emit('contextActionSelected', chosen);
                    }
                }
            }

            if (result.radial.flickTriggered) {
                this._emit('radialFlick', result.radial.flickTriggered);
            }
        }

        // 1. 物理キーのディスパッチ
        if (result.keys && result.keys.length > 0) {
            // 移動やキー入力が行われた場合は選択アクションをリセット
            this._selectedContextAction = null;
            for (const key of result.keys) {
                if (this.core && typeof this.core.sendKey === 'function') {
                    this.core.sendKey(key);
                }
            }
        }

        // 2. セマンティックアクションのディスパッチ
        if (result.actions && result.actions.length > 0) {
            for (const act of result.actions) {
                this.executeSemanticAction(act);
            }
        }

        // 3. UIシグナルのディスパッチ
        if (result.signals && result.signals.length > 0) {
            for (const sig of result.signals) {
                this.executeSignal(sig);
            }
        }

        return result;
    }

    /**
     * セマンティックアクションの実行
     * @param {string|Object} actionId 
     */
    async executeSemanticAction(actionId) {
        if (!this.core) return;

        // コンテキストアクションオブジェクトが直接渡された場合
        if (typeof actionId === 'object' && actionId !== null) {
            if (typeof this.core.executeAction === 'function') {
                await this.core.executeAction(actionId);
            } else if (actionId.keySequence && (this.core.requestController || this.core.interactiveController)) {
                const rc = this.core.requestController || this.core.interactiveController;
                if (typeof rc.executeSequence === 'function') {
                    await rc.executeSequence(actionId.keySequence);
                }
            } else if (actionId.key) {
                this.core.sendKey(actionId.key);
            }
            return;
        }

        switch (actionId) {
            case 'ACTION:CONTEXT_PRIMARY': {
                const primary = this.getPrimaryContextAction();
                if (!primary) {
                    // 足元・周囲に何もない場合は1ターン待機 (.)
                    this.core.sendKey('.');
                    return;
                }

                // WebUICore.executeAction による正規実行
                if (typeof this.core.executeAction === 'function') {
                    await this.core.executeAction(primary);
                } else if (primary.recipe && (this.core.requestController || this.core.interactiveController)) {
                    const rc = this.core.requestController || this.core.interactiveController;
                    await rc.executeRecipe(primary.recipe);
                } else if (primary.keySequence && (this.core.requestController || this.core.interactiveController)) {
                    const rc = this.core.requestController || this.core.interactiveController;
                    if (typeof rc.executeSequence === 'function') {
                        await rc.executeSequence(primary.keySequence);
                    } else if (typeof rc.executeKeys === 'function') {
                        await rc.executeKeys(primary.keySequence);
                    }
                } else if (primary.key) {
                    this.core.sendKey(primary.key);
                }
                break;
            }

            case 'ACTION:WAIT_ONE_TURN': {
                this.core.sendKey('.');
                break;
            }

            case 'ACTION:RANGED_FIRE': {
                if (typeof this.actionRecipeFactory.createFireAmmoRecipe === 'function' && (this.core.requestController || this.core.interactiveController)) {
                    const rc = this.core.requestController || this.core.interactiveController;
                    const recipe = this.actionRecipeFactory.createFireAmmoRecipe();
                    await rc.executeRecipe(recipe);
                } else {
                    this.core.sendKey('f');
                }
                break;
            }

            case 'ACTION:ENGRAVE_ELBERETH': {
                if (typeof this.actionRecipeFactory.createEngraveElberethRecipe === 'function' && (this.core.requestController || this.core.interactiveController)) {
                    const rc = this.core.requestController || this.core.interactiveController;
                    const recipe = this.actionRecipeFactory.createEngraveElberethRecipe();
                    await rc.executeRecipe(recipe);
                } else {
                    // フォールバック: 手で地面に書く
                    this.core.sendKey('E');
                }
                break;
            }

            case 'ACTION:EXT_PRAY': {
                if (typeof this.actionRecipeFactory.createExtCommandRecipe === 'function' && (this.core.requestController || this.core.interactiveController)) {
                    const rc = this.core.requestController || this.core.interactiveController;
                    const recipe = this.actionRecipeFactory.createExtCommandRecipe('pray');
                    await rc.executeRecipe(recipe);
                } else {
                    this.core.sendKey('#');
                }
                break;
            }

            case 'ACTION:DIRECTION_CONFIRM': {
                this._emit('directionConfirm');
                break;
            }

            default: {
                if (actionId.startsWith('ACTION:DASH_')) {
                    const dir = actionId.replace('ACTION:DASH_', '');
                    if (typeof this.core.getDashAction === 'function' && typeof this.core.executeAction === 'function') {
                        const dashAction = this.core.getDashAction(dir);
                        if (dashAction) {
                            await this.core.executeAction(dashAction);
                            break;
                        }
                    }
                    const rc = this.core.requestController || this.core.interactiveController;
                    if (rc && typeof rc.executeSequence === 'function') {
                        await rc.executeSequence(['G', 'DIR_' + dir]);
                    } else {
                        this.core.sendKey('G');
                    }
                    break;
                }
                console.warn(`[GamepadInputController] 未知のアクション: ${actionId}`);
                break;
            }
        }
    }

    /**
     * UIシグナルの実行
     * @param {string} signalId 
     */
    executeSignal(signalId) {
        switch (signalId) {
            case 'SIGNAL:TOGGLE_INVENTORY':
                this.isInventoryOpen = !this.isInventoryOpen;
                this._emit('toggleInventory', { isOpen: this.isInventoryOpen });
                if (this.modalStack && typeof this.modalStack.toggleModal === 'function') {
                    this.modalStack.toggleModal('paperdoll');
                }
                break;

            case 'SIGNAL:OPEN_SPELLS':
                this._emit('openSpells');
                if (this.core && typeof this.core.sendKey === 'function') {
                    this.core.sendKey('Z');
                }
                break;

            case 'SIGNAL:INVENTORY_PREV':
                this._emit('inventoryNav', { type: 'prev' });
                break;

            case 'SIGNAL:INVENTORY_NEXT':
                this._emit('inventoryNav', { type: 'next' });
                break;

            case 'SIGNAL:INVENTORY_PAGE_PREV':
                this._emit('inventoryNav', { type: 'pagePrev' });
                break;

            case 'SIGNAL:INVENTORY_PAGE_NEXT':
                this._emit('inventoryNav', { type: 'pageNext' });
                break;

            case 'SIGNAL:INVENTORY_TAB_PREV':
                this._emit('inventoryNav', { type: 'tabPrev' });
                break;

            case 'SIGNAL:INVENTORY_TAB_NEXT':
                this._emit('inventoryNav', { type: 'tabNext' });
                break;

            case 'SIGNAL:INVENTORY_SELECT':
                this._emit('inventoryNav', { type: 'select' });
                break;

            case 'SIGNAL:INVENTORY_MENU':
                this._emit('inventoryNav', { type: 'menu' });
                break;

            case 'SIGNAL:INVENTORY_CLOSE':
                this.isInventoryOpen = false;
                this._emit('inventoryNav', { type: 'close' });
                if (this.modalStack && typeof this.modalStack.closeTopModal === 'function') {
                    this.modalStack.closeTopModal();
                }
                break;

            case 'SIGNAL:DIALOG_PREV':
                this._emit('dialogNav', { type: 'prev' });
                if (!this._listeners['dialogNav'] || this._listeners['dialogNav'].length === 0) {
                    this._handleDialogNav('prev');
                }
                break;

            case 'SIGNAL:DIALOG_NEXT':
                this._emit('dialogNav', { type: 'next' });
                if (!this._listeners['dialogNav'] || this._listeners['dialogNav'].length === 0) {
                    this._handleDialogNav('next');
                }
                break;

            case 'SIGNAL:DIALOG_LEFT':
                this._emit('dialogNav', { type: 'left' });
                if (!this._listeners['dialogNav'] || this._listeners['dialogNav'].length === 0) {
                    this._handleDialogNav('left');
                }
                break;

            case 'SIGNAL:DIALOG_RIGHT':
                this._emit('dialogNav', { type: 'right' });
                if (!this._listeners['dialogNav'] || this._listeners['dialogNav'].length === 0) {
                    this._handleDialogNav('right');
                }
                break;

            case 'SIGNAL:DIALOG_SUBMIT':
                this._emit('dialogSubmit');
                if (!this._listeners['dialogSubmit'] || this._listeners['dialogSubmit'].length === 0) {
                    this._handleDialogSubmit();
                }
                break;

            case 'SIGNAL:DIALOG_CANCEL':
                this.isDialogOpen = false;
                this._emit('dialogCancel');
                if (!this._listeners['dialogCancel'] || this._listeners['dialogCancel'].length === 0) {
                    this._handleDialogCancel();
                }
                break;

            default:
                console.warn(`[GamepadInputController] 未知のシグナル: ${signalId}`);
                break;
        }
    }

    /**
     * ダイアログ・メニューのナビゲーション（上/下/左/右）
     * @param {'prev'|'next'|'left'|'right'} dir 
     */
    _handleDialogNav(dir) {
        // 0. ModalStackController の最前面モーダル委譲 (DOM非依存)
        if (this.modalStack && typeof this.modalStack.navigateTopModal === 'function') {
            if (this.modalStack.navigateTopModal(dir)) {
                return;
            }
        }

        if (typeof document === 'undefined') return;

        // 1. CharacterIntroModal (名前入力 / モード選択)
        const introModal = this.modalManager?.characterIntroModal;
        if (introModal && introModal.isVisible) {
            if (introModal.activeType === 'MODE_SELECT') {
                const cards = Array.from(document.querySelectorAll('.char-mode-card'));
                if (cards.length > 0) {
                    let activeIndex = cards.findIndex(c => c.classList.contains('selected') || document.activeElement === c);
                    if (activeIndex === -1) activeIndex = 0;
                    if (dir === 'prev' || dir === 'left') {
                        activeIndex = (activeIndex - 1 + cards.length) % cards.length;
                    } else if (dir === 'next' || dir === 'right') {
                        activeIndex = (activeIndex + 1) % cards.length;
                    }
                    cards.forEach((c, idx) => {
                        c.classList.toggle('selected', idx === activeIndex);
                        if (idx === activeIndex) c.focus();
                    });
                }
            }
            return;
        }

        // 2. CharacterCreationModal (ロール/種族/性別/属性の選択カード)
        const charModal = this.modalManager?.characterCreationModal;
        if (charModal && charModal.isVisible) {
            const cards = Array.from(document.querySelectorAll('.char-card-item:not(.disabled)'));
            if (cards.length > 0) {
                let activeIndex = cards.findIndex(c => c.classList.contains('selected') || document.activeElement === c);
                if (activeIndex === -1) activeIndex = 0;
                if (dir === 'prev' || dir === 'left') {
                    activeIndex = (activeIndex - 1 + cards.length) % cards.length;
                } else if (dir === 'next' || dir === 'right') {
                    activeIndex = (activeIndex + 1) % cards.length;
                }
                cards.forEach((c, idx) => {
                    c.classList.toggle('selected', idx === activeIndex);
                    if (idx === activeIndex) {
                        c.focus();
                        if (typeof c.scrollIntoView === 'function') {
                            c.scrollIntoView({ block: 'nearest' });
                        }
                    }
                });
            }
            return;
        }

        // 3. ModalManager のメニューモーダル (elMenuModal)
        const mm = this.modalManager;
        if (mm && mm.selectableMenuButtons && mm.selectableMenuButtons.length > 0) {
            if (dir === 'prev' || dir === 'left') {
                mm.activeMenuFocusIndex = (mm.activeMenuFocusIndex - 1 + mm.selectableMenuButtons.length) % mm.selectableMenuButtons.length;
            } else {
                mm.activeMenuFocusIndex = (mm.activeMenuFocusIndex + 1) % mm.selectableMenuButtons.length;
            }
            if (typeof mm.updateMenuFocus === 'function') {
                mm.updateMenuFocus();
            }
            return;
        }

        // 4. 汎用 DOM ダイアログ / <nh-modal> / [role="dialog"] のフォーカス移動
        const activeDialog = document.querySelector('nh-modal[open], dialog[open], [role="dialog"]:not(.hidden)');
        if (activeDialog) {
            if (typeof activeDialog.navigateFocus === 'function') {
                if (activeDialog.navigateFocus(dir)) return;
            }

            const focusables = Array.from(activeDialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'));
            if (focusables.length > 0) {
                let idx = focusables.indexOf(document.activeElement);
                if (idx === -1) {
                    idx = (dir === 'prev' || dir === 'left') ? focusables.length - 1 : 0;
                } else if (dir === 'prev' || dir === 'left') {
                    idx = (idx - 1 + focusables.length) % focusables.length;
                } else {
                    idx = (idx + 1) % focusables.length;
                }
                if (focusables[idx] && typeof focusables[idx].focus === 'function') {
                    focusables[idx].focus();
                }
                return;
            }
        }
    }

    /**
     * ダイアログ・メニューの決定
     */
    _handleDialogSubmit() {
        // 0. ModalStackController の最前面モーダル委譲 (DOM非依存)
        if (this.modalStack && typeof this.modalStack.submitTopModal === 'function') {
            if (this.modalStack.submitTopModal()) {
                return;
            }
        }

        if (typeof document === 'undefined') {
            if (this.core && typeof this.core.sendKey === 'function') {
                this.core.sendKey('Enter');
            }
            return;
        }

        // 1. CharacterIntroModal
        const introModal = this.modalManager?.characterIntroModal;
        if (introModal && introModal.isVisible) {
            if (introModal.activeType === 'ASKNAME') {
                const inputEl = document.getElementById('intro-name-input');
                const initialDefault = introModal.currentData?.detectedName || introModal.currentData?.defaultName || 'Hero';
                let val = inputEl ? inputEl.value.trim() : '';
                if (!val) val = initialDefault;
                introModal.confirmName(val);
                return;
            } else if (introModal.activeType === 'MODE_SELECT') {
                const selectedCard = document.querySelector('.char-mode-card.selected') || document.querySelector('.char-mode-card');
                if (selectedCard) {
                    selectedCard.click();
                    return;
                }
            }
        }

        // 2. CharacterCreationModal
        const charModal = this.modalManager?.characterCreationModal;
        if (charModal && charModal.isVisible) {
            const selectedCard = document.querySelector('.char-card-item.selected') || document.querySelector('.char-card-item:focus');
            if (selectedCard) {
                selectedCard.click();
                return;
            }
        }

        // 3. ModalManager のメニュー項目決定
        const mm = this.modalManager;
        if (mm && mm.selectableMenuButtons && mm.selectableMenuButtons.length > 0) {
            const btn = mm.selectableMenuButtons[mm.activeMenuFocusIndex];
            if (btn) {
                btn.click();
                return;
            }
        }

        // 4. 汎用 DOM ダイアログ / <nh-modal> / [role="dialog"] の実行
        const activeDialog = document.querySelector('nh-modal[open], dialog[open], [role="dialog"]:not(.hidden)');
        if (activeDialog) {
            if (typeof activeDialog.submitFocused === 'function') {
                if (activeDialog.submitFocused()) return;
            }
            if (document.activeElement && activeDialog.contains(document.activeElement) && typeof document.activeElement.click === 'function') {
                document.activeElement.click();
                return;
            }
            const primaryBtn = activeDialog.querySelector('button[type="submit"], .btn-primary, button:not(.modal-close-btn)');
            if (primaryBtn && typeof primaryBtn.click === 'function') {
                primaryBtn.click();
                return;
            }
        }

        // 5. フォールバック: Enter キー送信
        if (this.core && typeof this.core.sendKey === 'function') {
            this.core.sendKey('Enter');
        }
    }

    /**
     * ダイアログ・メニューのキャンセル / 閉じる
     */
    _handleDialogCancel() {
        // 0. ModalStackController の最前面モーダル閉じる (DOM非依存)
        if (this.modalStack && typeof this.modalStack.hasOpenModal === 'function' && this.modalStack.hasOpenModal()) {
            if (this.modalStack.closeTopModal()) {
                return;
            }
        }

        // 1. CharacterIntroModal
        const introModal = this.modalManager?.characterIntroModal;
        if (introModal && introModal.isVisible) {
            introModal.hide();
            if (this.core) {
                if (typeof this.core.cancelPrompt === 'function') this.core.cancelPrompt();
                else this.core.respond('\x1b');
            }
            return;
        }

        // 2. CharacterCreationModal
        const charModal = this.modalManager?.characterCreationModal;
        if (charModal && charModal.isVisible) {
            charModal.hide();
            if (this.core) this.core.respond('q');
            return;
        }

        // 3. ModalManager のメニューキャンセル
        const mm = this.modalManager;
        if (mm && mm.elMenuModal && !mm.elMenuModal.classList.contains('hidden')) {
            if (this.core && typeof this.core.respond === 'function') {
                this.core.respond(0);
                return;
            }
        }

        // 4. 汎用 DOM ダイアログ閉じる
        if (typeof document !== 'undefined') {
            const activeModal = document.querySelector('nh-modal[open]');
            if (activeModal && typeof activeModal.close === 'function') {
                activeModal.close();
                return;
            }
            const activeDialog = document.querySelector('dialog[open]');
            if (activeDialog && typeof activeDialog.close === 'function') {
                activeDialog.close();
                return;
            }
        }

        // 5. フォールバック: Escape キー送信
        if (this.core && typeof this.core.sendKey === 'function') {
            this.core.sendKey('Escape');
        }
    }

    /**
     * 現在の周囲状況 (GKL ContextActionEngine) から動的ラジアルパレットを生成
     * @param {Object} [options={}]
     * @returns {Object} 8方向のパレット定義 { N: {...}, NE: {...}, ... }
     */
    buildContextAdaptiveRadialPalette(options = {}) {
        if (!this.core) return {};

        // 1. GKL の全推奨アクションを取得
        let actions = [];
        if (typeof this.core.getSituation === 'function') {
            const situation = this.core.getSituation();
            if (situation && Array.isArray(situation.actions)) {
                actions = situation.actions;
            }
        }
        if (actions.length === 0) {
            const gkl = this.core.gkl || this.core.knowledge;
            const areaState = gkl?.areaStateManager?.getAreaState?.();
            if (areaState) {
                const invState = gkl?.inventoryStateManager || null;
                const skillState = gkl?.skillStateManager || null;
                const statusAccessor = this.core.statusAccessor || gkl?.statusAccessor || null;
                actions = this.contextActionEngine.generateActions(areaState, invState, skillState, {}, statusAccessor);
            }
        }

        if (!actions || actions.length === 0) {
            return {};
        }

        const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const occupied = new Set();
        const dynamicPalette = {};

        // アクション用アイコンの推測
        const guessIcon = (act) => {
            if (act.icon) return act.icon;
            const id = act.id || '';
            if (id.includes('DOOR')) {
                if (id.includes('OPEN')) return '🚪';
                if (id.includes('CLOSE')) return '🚪';
                if (id.includes('UNLOCK') || id.includes('LOCK')) return '🔑';
                if (id.includes('KICK')) return '💥';
                if (id.includes('UNTRAP')) return '🪤';
            }
            if (id.includes('STAIR_DOWN')) return '🪜';
            if (id.includes('STAIR_UP')) return '🪜';
            if (id.includes('PICKUP')) return '🎒';
            if (id.includes('CONTAINER')) {
                if (id.includes('LOOT')) return '📦';
                if (id.includes('UNLOCK')) return '🔑';
                if (id.includes('KICK')) return '💥';
                if (id.includes('UNTRAP')) return '🪤';
            }
            if (id.includes('BOULDER')) return '🪨';
            if (id.includes('ATTACK')) return '⚔️';
            if (id.includes('RANGED')) return '🏹';
            if (id.includes('OFFER')) return '🥩';
            if (id.includes('SINK')) return '🚰';
            if (id.includes('THRONE')) return '👑';
            if (id.includes('CHAT')) return '💬';
            if (id.includes('SEARCH')) return '🔍';
            return '⚡';
        };

        // HUD用ショートラベル生成
        const getShortLabel = (act) => {
            const id = act.id || '';
            if (id.includes('OPEN_DOOR')) return '扉を開ける';
            if (id.includes('CLOSE_DOOR')) return '扉を閉める';
            if (id.includes('UNLOCK_DOOR')) return '鍵で解錠';
            if (id.includes('KICK_DOOR')) return '扉を蹴破る';
            if (id.includes('UNTRAP_DOOR')) return '扉の罠解除';
            if (id.includes('STAIR_DOWN')) return '階段降りる';
            if (id.includes('STAIR_UP')) return '階段上る';
            if (id.includes('PICKUP')) return '拾う';
            if (id.includes('LOOT_CONTAINER')) return '箱を開ける';
            if (id.includes('UNLOCK_CONTAINER')) return '箱を解錠';
            if (id.includes('KICK_CONTAINER')) return '箱を蹴る';
            if (id.includes('UNTRAP_CONTAINER') || id.includes('UNTRAP_FEET')) return '罠解除';
            if (id.includes('OFFER')) return '生贄を捧ぐ';
            if (id.includes('PUSH_BOULDER')) return '巨石を押す';
            if (id.includes('ATTACK')) return '攻撃';
            if (id.includes('CHAT')) return '会話';
            return act.labelJa || act.label || '実行';
        };

        const createPaletteItem = (act) => {
            return {
                id: act.id,
                label: getShortLabel(act),
                action: act,
                actionObj: act,
                keySequence: act.keySequence || null,
                key: act.key || null,
                icon: guessIcon(act),
                hint: act.charStr || act.key || '',
                isContextAction: true
            };
        };

        // 2. 方向付きアクション（隣接する扉、箱、敵など）を優先配置
        const directionalActions = actions.filter(a => a.dirCode && a.dirCode !== 'SELF');
        for (const act of directionalActions) {
            const primaryDir = act.dirCode;
            if (SECTORS.includes(primaryDir)) {
                if (!occupied.has(primaryDir)) {
                    dynamicPalette[primaryDir] = createPaletteItem(act);
                    occupied.add(primaryDir);
                } else {
                    // 同一方向の第2・第3アクション（例: 解錠、蹴破る等）は隣接セクターにスマート展開
                    const pIdx = SECTORS.indexOf(primaryDir);
                    const cwSector = SECTORS[(pIdx + 1) % SECTORS.length];
                    const ccwSector = SECTORS[(pIdx - 1 + SECTORS.length) % SECTORS.length];
                    if (!occupied.has(cwSector)) {
                        dynamicPalette[cwSector] = createPaletteItem(act);
                        occupied.add(cwSector);
                    } else if (!occupied.has(ccwSector)) {
                        dynamicPalette[ccwSector] = createPaletteItem(act);
                        occupied.add(ccwSector);
                    }
                }
            }
        }

        // 3. 足元・非方向アクション（階段、アイテム、祭壇など）の配置
        const feetActions = actions.filter(a => !a.dirCode || a.dirCode === 'SELF');
        for (const act of feetActions) {
            const id = act.id || '';
            let targetSector = null;
            if (id.includes('STAIR_DOWN')) targetSector = 'S';
            else if (id.includes('STAIR_UP')) targetSector = 'N';
            else if (id.includes('PICKUP')) targetSector = 'S';
            else if (id.includes('OFFER')) targetSector = 'SW';
            else if (id.includes('SEARCH')) targetSector = 'SE';

            if (targetSector && !occupied.has(targetSector)) {
                dynamicPalette[targetSector] = createPaletteItem(act);
                occupied.add(targetSector);
            } else {
                const freeSector = SECTORS.find(s => !occupied.has(s));
                if (freeSector) {
                    dynamicPalette[freeSector] = createPaletteItem(act);
                    occupied.add(freeSector);
                }
            }
        }

        // 4. 固定デフォルトコマンドは配置せず、純粋な状況アクション選択ホイールとする
        return dynamicPalette;
    }

    /**
     * 現在のコンテキストアクションに応じた動的ラジアルパレットを評価し、
     * GamepadManager および登録済み HUD へ自動反映
     * @param {Object} [hudElement=null]
     * @returns {Object} 生成されたパレット
     */
    updateDynamicPalette(hudElement = null) {
        const palette = this.buildContextAdaptiveRadialPalette();
        const serialized = JSON.stringify(palette);
        if (serialized === this._lastPaletteJson) {
            return palette;
        }
        this._lastPaletteJson = serialized;

        if (this.gamepad && typeof this.gamepad.setRadialPalette === 'function') {
            this.gamepad.setRadialPalette(palette);
        }
        if (hudElement && typeof hudElement.setPalette === 'function') {
            hudElement.setPalette(palette);
        }
        this._emit('paletteChanged', palette);
        return palette;
    }
}
