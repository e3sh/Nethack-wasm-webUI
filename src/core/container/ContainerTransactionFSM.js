/**
 * ContainerTransactionFSM.js
 *
 * コンテナ操作（#loot / apply bag）のマルチステップ・トランザクションを管理する
 * ステートマシン。WebUICore のイベント/API のみを介して動作し、
 * NetHackWasmDriver への直接アクセスは行わない。
 *
 * ## 前提
 * - menu_style = FULL (select_menu ベース)
 * - UI表示タイミング: 案B (`:` 先読みで中身取得後に表示)
 *
 * ## アーキテクチャ
 * - WebUICore.on('inputRequired') でプロンプトを検知・横取り
 * - WebUICore.respond() で C コアに応答
 * - WebUICore.on('message') で結果メッセージを監視
 * - WebUICore.emit('containerTransaction') で UI 層に状態変化を通知
 */

import { ContainerPromptDetector, ContainerPromptType, ContainerAction } from './ContainerPromptDetector.js';
import { ContainerSafetyGuard, DangerLevel } from './ContainerSafetyGuard.js';
import { ContainerContentsManager } from './ContainerContentsManager.js';
import { ContainerSequenceBuilder } from './ContainerSequenceBuilder.js';

/**
 * FSM 状態定数
 */
export const ContainerState = {
    /** 待機中（コンテナ操作なし） */
    IDLE: 'IDLE',
    /** コンテナ操作プロンプト検知、横取り判定中 */
    INTERCEPTING: 'INTERCEPTING',
    /** 複数コンテナからの選択待ち */
    CONTAINER_SELECT: 'CONTAINER_SELECT',
    /** アクション選択待ち (:oibrsq) — UI 表示前の先読みフェーズ含む */
    ACTION_PROMPT: 'ACTION_PROMPT',
    /** 中身先読み中 (`:` 自動送信 → 中身取得) */
    PREFETCHING_CONTENTS: 'PREFETCHING_CONTENTS',
    /** 中身閲覧中 */
    VIEWING: 'VIEWING',
    /** 取り出しフェーズ */
    TAKING_OUT: 'TAKING_OUT',
    /** 投入フェーズ */
    PUTTING_IN: 'PUTTING_IN',
    /** 1個投入フェーズ */
    STASHING_ONE: 'STASHING_ONE',
    /** カテゴリ選択サブフェーズ */
    CATEGORY_SELECT: 'CATEGORY_SELECT',
    /** アイテム選択サブフェーズ */
    ITEM_SELECT: 'ITEM_SELECT',
    /** Cコアへのアイテム移動処理中 */
    PROCESSING: 'PROCESSING',
    /** インベントリ再同期中 */
    SYNC: 'SYNC',
    /** BoH 爆発発生 → 強制終了 */
    EXPLODED: 'EXPLODED',
};

/**
 * BoH 爆発検知パターン
 */
const EXPLOSION_PATTERNS = [
    /blasted by a magical explosion/i,
    /magical explosion/i,
    /魔法の爆発/,
];

/**
 * アイテム投入成功メッセージパターン
 */
const PUT_IN_PATTERN = /^You put (.+) into (.+)\.$/i;

/**
 * アイテム取り出し成功メッセージパターン
 */
const TAKE_OUT_PATTERN = /removing/i;


export class ContainerTransactionFSM {

    /**
     * @param {Object} core - WebUICore インスタンス
     * @param {Object} [options={}]
     */
    constructor(core, options = {}) {
        if (!core) throw new Error('ContainerTransactionFSM: WebUICore instance is required.');

        /** @type {Object} WebUICore インスタンス (Driver には触らない) */
        this.core = core;

        /** @type {string} 現在の FSM 状態 */
        this.state = ContainerState.IDLE;

        /** @type {ContainerSafetyGuard} BoH セーフティガード */
        this.inventoryStateManager = options.inventoryStateManager || (core.gkl && core.gkl.inventoryStateManager) || null;
        this.safetyGuard = new ContainerSafetyGuard({
            inventoryStateManager: this.inventoryStateManager,
        });

        /** @type {ContainerSequenceBuilder} シーケンスビルダー */
        this.sequenceBuilder = new ContainerSequenceBuilder({
            safetyGuard: this.safetyGuard,
        });

        /** @type {ContainerContentsManager} コンテナ中身マネージャー */
        this.contentsManager = new ContainerContentsManager();

        /** @type {Function|null} 現在待機中のアイテム転送トランザクションの resolver */
        this._activeTransferResolver = null;
        /** @type {any|null} 転送タイムアウトタイマー */
        this._transferTimeoutTimer = null;

        /** @type {Object|null} 現在のアクション選択 resolver (先読み復帰用) */
        this._actionPromptPayload = null;

        /** @type {string|null} 現在実行中の操作方向 ('in' | 'out') */
        this._currentDirection = null;

        /** @type {string|null} 複合操作 ('b' | 'r') の場合の元アクション */
        this._compositeAction = null;

        /** @type {boolean} 複合操作の第1フェーズが完了したか */
        this._compositePhase1Done = false;

        /** @type {{ direction: 'in'|'out', items: Array<Object> }|null} 自動消化転送タスク */
        this._pendingTransfer = null;

        /** @type {boolean} コンテナ操作セッションが有効かどうか（ダイアログ表示維持） */
        this._sessionActive = false;

        /** @type {{ name: string, onum: number, letter: string|null, isFloorContainer: boolean }|null} コンテナ識別情報 */
        this._containerContext = null;

        /** @type {string|null} 直近に apply された文字 */
        this._lastAppliedLetter = null;

        /** @type {Object|null} 直近の poskey ペイロード */
        this._lastPoskeyPayload = null;

        /** @type {boolean|null} 直前コマンドが apply ('a') または #loot だったか */
        this._isApplyActive = null;

        /** @type {boolean} 有効化フラグ */
        this.enabled = options.enabled !== false;

        /** @type {boolean} デバッグログ出力 */
        this.debug = options.debug || false;

        // イベントバインド
        this._boundOnInputRequired = this._onInputRequired.bind(this);
        this._boundOnMessage = this._onMessage.bind(this);
        this._boundOnInputResolved = this._onInputResolved.bind(this);
        this._boundOnUserActionSent = this._onUserActionSent.bind(this);

        if (this.enabled) {
            this.attach();
        }
    }

    // ========================================================================
    // ライフサイクル
    // ========================================================================

    /**
     * WebUICore にアタッチ (イベント購読開始)
     */
    attach() {
        this.core.on('inputRequired', this._boundOnInputRequired);
        this.core.on('message', this._boundOnMessage);
        this.core.on('inputResolved', this._boundOnInputResolved);
        if (typeof this.core.on === 'function') {
            this.core.on('userActionSent', this._boundOnUserActionSent);
        }
        this._log('Attached to WebUICore');
    }

    /**
     * WebUICore からデタッチ (イベント購読解除)
     */
    detach() {
        this.core.off('inputRequired', this._boundOnInputRequired);
        this.core.off('message', this._boundOnMessage);
        this.core.off('inputResolved', this._boundOnInputResolved);
        if (typeof this.core.off === 'function') {
            this.core.off('userActionSent', this._boundOnUserActionSent);
        }
        this._reset();
        this._log('Detached from WebUICore');
    }

    /**
     * 内部状態をリセット
     * @private
     */
    _reset() {
        this._resolveActiveTransfer(false, { reason: 'reset' });
        this.state = ContainerState.IDLE;
        this._sessionActive = false;
        this._isApplyActive = null;
        this._containerContext = null;
        this._lastPoskeyPayload = null;
        this._actionPromptPayload = null;
        this._currentDirection = null;
        this._compositeAction = null;
        this._compositePhase1Done = false;
        this._pendingTransfer = null;
        this.contentsManager.closeContainer();
    }

    /**
     * 待機中のアイテム転送トランザクション Promise を解決
     * @private
     */
    _resolveActiveTransfer(success = true, detail = {}) {
        if (this._transferTimeoutTimer) {
            clearTimeout(this._transferTimeoutTimer);
            this._transferTimeoutTimer = null;
        }
        if (typeof this._activeTransferResolver === 'function') {
            const resolver = this._activeTransferResolver;
            this._activeTransferResolver = null;
            try {
                resolver({ success, ...detail });
            } catch (e) {
                this._log('Error in active transfer resolver:', e);
            }
        }
    }

    /**
     * プレイヤー所持品の内部差分更新
     * コンテナセッション中は裏サイレント同期を抑止するため、ローカルで所持品を同期維持
     * @private
     */
    _updateInventoryDiff(action, target) {
        if (!this.inventoryStateManager || !Array.isArray(this.inventoryStateManager.items)) {
            return;
        }
        const invItems = this.inventoryStateManager.items;
        const targetLetter = target.letter || target.invlet;
        const targetName = target.name || target.rawText || '';

        if (action === 'remove') {
            const idx = invItems.findIndex(it =>
                (targetLetter && (it.letter === targetLetter || it.invlet === targetLetter)) ||
                (target.identifier && it.identifier === target.identifier) ||
                (targetName && it.name === targetName)
            );
            if (idx !== -1) {
                const it = invItems[idx];
                const moveCount = (typeof target.count === 'number' && target.count > 0) ? target.count : (it.count || 1);
                if (typeof it.count === 'number' && it.count > moveCount) {
                    it.count -= moveCount;
                } else {
                    invItems.splice(idx, 1);
                }
            }
        } else if (action === 'add') {
            const existing = invItems.find(it => it.name && targetName && it.name === targetName);
            if (existing && typeof existing.count === 'number' && existing.count > 0 && typeof target.count === 'number' && target.count > 0) {
                existing.count += target.count;
            } else {
                invItems.push({
                    ...target,
                    letter: target.letter || '',
                    count: (typeof target.count === 'number' && target.count > 0) ? target.count : 1,
                });
            }
        }
    }

    // ========================================================================
    // 状態遷移
    // ========================================================================

    /**
     * 状態遷移を実行し、UI 層に通知
     * @private
     */
    _transition(newState, detail = {}) {
        const oldState = this.state;
        this.state = newState;
        this._log(`Transition: ${oldState} → ${newState}`, detail);

        this.core.emit('containerTransaction', {
            state: newState,
            oldState,
            containerName: this.contentsManager.containerName,
            containerType: this.contentsManager.containerType,
            contents: this.contentsManager.getSnapshot(),
            isBagOfHolding: this.contentsManager.isBagOfHolding(),
            ...detail,
        });
    }

    // ========================================================================
    // イベントハンドラ
    // ========================================================================

    /**
     * WebUICore の inputRequired イベントハンドラ
     * @private
     */
    _onInputRequired(payload) {
        if (!this.enabled) return;

        // C コアが通常ターン (poskey) に復帰した場合の検知
        const isPoskey = (payload.context === 'poskey' || payload.type === 'poskey' || payload.promptCategory === 'POSKEY');
        if (isPoskey) {
            this._lastPoskeyPayload = payload;
            if (this._sessionActive) {
                this._log('poskey received during active container session; returning to ACTION_PROMPT');
                const wasTransfer = !!this._pendingTransfer;
                this._pendingTransfer = null;
                this._compositeAction = null;
                this._compositePhase1Done = false;
                this._actionPromptPayload = null;
                if (wasTransfer && this.lastTransactionDebug) {
                    this.lastTransactionDebug.status = 'SUCCESS';
                    this.lastTransactionDebug.message = `Successfully transferred ${this.lastTransactionDebug.items?.length || 0} item(s).`;
                }
                this._transition(ContainerState.ACTION_PROMPT, {
                    contents: this.contentsManager.getSnapshot(),
                    debug: this.lastTransactionDebug,
                });
                this._resolveActiveTransfer(true);
                return;
            } else if (this.state !== ContainerState.IDLE) {
                this._resolveActiveTransfer(false, { reason: 'poskey_inactive' });
                this._reset();
                return;
            } else {
                this._isApplyActive = null;
                this._resolveActiveTransfer(false, { reason: 'poskey_idle' });
            }
        }

        const detection = ContainerPromptDetector.detect(payload);

        // 2回目以降の個別操作 (Re-apply パイプライン) 進行中の自動応答
        if (this._pendingTransfer && this._pendingTransfer.phase) {
            const rawPrompt = payload.rawPrompt || payload.prompt || '';
            // "What do you want to use or apply?" プロンプト
            if (/use or apply/i.test(rawPrompt) || payload.context === 'getdir' || payload.context === 'apply') {
                this._log('Re-apply: sending container letter', this.getContainerLetter());
                this._pendingTransfer.phase = 'LETTER_SENT';
                this._respondToCore(this.getContainerLetter());
                return;
            }

            // 同一グリッドに複数コンテナがある場合の選択
            if (detection.type === ContainerPromptType.CONTAINER_SELECT) {
                this._log('Re-apply: auto-selecting container from multi-container menu');
                this._pendingTransfer.phase = 'CONTAINER_SELECTED';
                this._handleContainerSelectAuto(payload);
                return;
            }

            // コンテナ操作メニューに到達
            if (detection.type === ContainerPromptType.ACTION_MENU) {
                if (this._pendingTransfer.phase === 'ITEM_SENT') {
                    this._log('Re-apply: ITEM_SENT phase completed, sending (q) to exit use_container loop');
                    this._actionPromptPayload = payload;
                    this._pendingTransfer = null;
                    if (this.lastTransactionDebug) {
                        this.lastTransactionDebug.status = 'SUCCESS';
                        this.lastTransactionDebug.message = `Successfully transferred ${this.lastTransactionDebug.items?.length || 0} item(s).`;
                    }
                    this._respondToCore('q');
                    return;
                }

                this._log('Re-apply: reached ACTION_MENU, sending direction action', this._pendingTransfer.direction);
                this._actionPromptPayload = payload;
                const dir = this._pendingTransfer.direction;
                this._pendingTransfer.phase = 'ACTION_SENT';
                if (dir === 'in') {
                    this._currentDirection = 'in';
                    this._transition(ContainerState.PUTTING_IN);
                    this._respondToCore('i');
                } else {
                    this._currentDirection = 'out';
                    this._transition(ContainerState.TAKING_OUT);
                    this._respondToCore('o');
                }
                return;
            }

            // 数量指定プロンプト (How many?)
            if (detection.type === ContainerPromptType.COUNT_PROMPT) {
                this._log('Re-apply: reached COUNT_PROMPT, responding with count');
                const targetItem = (this._pendingTransfer.items && this._pendingTransfer.items[0]) || {};
                const targetCount = (typeof targetItem.count === 'number' && targetItem.count > 0) ? targetItem.count : '';
                this._respondToCore(targetCount ? `${targetCount}\n` : '\n');
                return;
            }
        }

        switch (this.state) {
            case ContainerState.IDLE:
                this._handleIdleInput(payload, detection);
                break;

            case ContainerState.PREFETCHING_CONTENTS:
                this._handlePrefetchInput(payload, detection);
                break;

            case ContainerState.ACTION_PROMPT:
                this._handleActionPromptInput(payload, detection);
                break;

            case ContainerState.CONTAINER_SELECT:
                // コンテナ選択は通常のメニューとしてユーザーに表示
                // (FSM はこの段階では横取りせず、選択後の ACTION_MENU を待つ)
                break;

            case ContainerState.TAKING_OUT:
            case ContainerState.PUTTING_IN:
            case ContainerState.STASHING_ONE:
            case ContainerState.CATEGORY_SELECT:
            case ContainerState.ITEM_SELECT:
                this._handleLootPhaseInput(payload, detection);
                break;

            default:
                break;
        }
    }

    /**
     * IDLE 状態での inputRequired 処理
     * @private
     */
    _handleIdleInput(payload, detection) {
        if (detection.type === ContainerPromptType.ACTION_MENU) {
            // 明示的に非 apply / 非 loot コマンド（'d', 't' 等）による一般メニューの場合は横取りしない
            // ただしプロンプト文面自体がコンテナアクションプロンプトである場合は確実に横取りする
            const isExplicitContainerPrompt = ContainerPromptDetector.isActionPrompt(payload.rawPrompt || payload.prompt || '');
            if (this._isApplyActive === false && !isExplicitContainerPrompt && !/loot/i.test(payload.rawPrompt || '')) {
                this._log('ACTION_MENU ignored: command is not apply/loot and prompt is not container action');
                return;
            }

            // コンテナのアクション選択プロンプトを検知 → 横取り開始
            this._sessionActive = true;
            this.contentsManager.openContainer({
                name: detection.containerName,
                rawText: detection.containerName,
            });
            const detectedLetter = this._lastAppliedLetter || this.getContainerLetter();
            this._containerContext = {
                name: detection.containerName || '',
                onum: this.contentsManager.containerOnum || -1,
                letter: detectedLetter && detectedLetter !== '.' ? detectedLetter : null,
                isFloorContainer: detectedLetter === '.' || detectedLetter === null,
            };
            this._transition(ContainerState.INTERCEPTING, { prompt: payload.rawPrompt });
            this._actionPromptPayload = payload;

            const rawPrompt = payload.rawPrompt || payload.prompt || '';
            const isEmptyContainer = /is\s+(now\s+)?empty/i.test(rawPrompt) || /空です/i.test(rawPrompt) || /中身は空/i.test(rawPrompt);

            const menuItems = payload.items || payload.menuItems || [];
            const hasTakeOutOption = menuItems.some(mi => {
                const s = (mi.str || mi.rawStr || '').toLowerCase();
                const acc = mi.accelerator || mi.charStr || (mi.ch ? String.fromCharCode(mi.ch) : '');
                return acc === 'o' || s.includes('take something out') || s.includes('取り出');
            });

            if (isEmptyContainer || !hasTakeOutOption) {
                // 空コンテナの場合: 中身空として 'q' でメニューを抜け通常ターン (poskey) に着地
                this._log('Container is empty; exiting menu with (q) and transitioning to ACTION_PROMPT');
                this._respondToCore('q');
                this.contentsManager.updateFromMenuItems([]);
                this.contentsManager.isEmpty = true;
                this._transition(ContainerState.ACTION_PROMPT, {
                    contents: this.contentsManager.getSnapshot(),
                });
                return;
            }

            // 中身が存在する場合:
            // 【ユーザー提案の採用】その場で 'o' (take something out) を送出し、
            // Cコア公式のアクセラレータキー・identifier付き中身メニューをダイレクトに先読み取得する
            this._log("Container has contents; sending 'o' (take out) to prefetch items with official accelerators");
            this._transition(ContainerState.PREFETCHING_CONTENTS, { prompt: payload.rawPrompt });
            this._respondToCore('o');
            return;
        }

        if (detection.type === ContainerPromptType.CONTAINER_SELECT) {
            // 複数コンテナの選択メニュー → FSM は状態だけ追跡し、選択自体はユーザーに委ねる
            this._transition(ContainerState.CONTAINER_SELECT);
            return;
        }
    }

    /**
     * PREFETCHING_CONTENTS 状態での inputRequired 処理
     * 'o' 送信後に来るカテゴリ選択、アイテム一覧表示、またはアクション選択プロンプトを処理
     * @private
     */
    _handlePrefetchInput(payload, detection) {
        // カテゴリ選択プロンプト (Put in / Take out what type of objects?)
        if (detection.type === ContainerPromptType.CATEGORY_SELECT) {
            this._log("Prefetching: sending 'a' (All types) for category select");
            this._respondToCore('a');
            return;
        }

        // アイテム選択メニュー (Take out what?)
        if (detection.type === ContainerPromptType.ITEM_SELECT) {
            this._log('Prefetching: received Take out what? menu, updating contents with official items');
            const items = payload.items || payload.menuItems || [];
            this.contentsManager.updateFromMenuItems(items);

            // 中身データを回収完了！アイテムは取り出さずに ESC (27) でキャンセルし通常ターンに着地
            this._log("Prefetching: cancelling menu with ESC to keep items and land at poskey");
            this._respondToCore(27);

            this._sessionActive = true;
            this._transition(ContainerState.ACTION_PROMPT, {
                contents: this.contentsManager.getSnapshot(),
            });
            return;
        }

        if (detection.type === ContainerPromptType.CONTENTS_VIEW) {
            // 中身一覧 (テキスト行) が表示された場合のフォールバック
            if (Array.isArray(payload.lines) && payload.lines.length > 0) {
                this.contentsManager.updateFromLines(payload.lines);
            } else {
                const items = payload.items || payload.menuItems || [];
                this.contentsManager.updateFromMenuItems(items);
            }
            // 中身表示メニュー/ウィンドウを閉じるために応答 (ESC で閉じる)
            this._respondToCore(27);
            return;
        }

        if (detection.type === ContainerPromptType.ACTION_MENU) {
            // 再度のアクション選択プロンプトに戻った場合は 'q' で抜けて ACTION_PROMPT へ
            this._sessionActive = true;
            this._respondToCore('q');
            this._transition(ContainerState.ACTION_PROMPT, {
                contents: this.contentsManager.getSnapshot(),
            });
            return;
        }

        // 予期しないプロンプト → 中身が空の場合の "X is empty." 等
        // アクション選択プロンプトとして扱う
        if (detection.type === ContainerPromptType.NONE) {
            // 空コンテナの場合、先読み応答後にすぐ ACTION_MENU が来る
            // payload をアクション選択として保存
            const rawPrompt = payload.rawPrompt || '';
            const linesStr = Array.isArray(payload.lines) ? payload.lines.join(' ') : '';
            const isEmptyMsg = /is\s+(now\s+)?empty/i.test(rawPrompt) || /中身は空/i.test(rawPrompt) ||
                               /is\s+(now\s+)?empty/i.test(linesStr) || /中身は空/i.test(linesStr);

            if (isEmptyMsg) {
                this.contentsManager.updateFromMenuItems([]);
                this._sessionActive = true;
                this._actionPromptPayload = payload;
                this._transition(ContainerState.ACTION_PROMPT, {
                    contents: this.contentsManager.getSnapshot(),
                });
                return;
            } else if (ContainerPromptDetector.isActionPrompt(rawPrompt) || ContainerPromptDetector.isActionMenuByItems(payload.items)) {
                // 中身はクリアせず、先読みした内容を正(SSOT)として保持したまま ACTION_PROMPT へ
                this._sessionActive = true;
                this._actionPromptPayload = payload;
                this._transition(ContainerState.ACTION_PROMPT, {
                    contents: this.contentsManager.getSnapshot(),
                });
                return;
            }
        }
    }

    /**
     * ACTION_PROMPT 状態での inputRequired 処理
     * @private
     */
    _handleActionPromptInput(payload, detection) {
        // アクション選択が再表示された場合 (ループ)
        if (detection.type === ContainerPromptType.ACTION_MENU) {
            this._actionPromptPayload = payload;
            this._transition(ContainerState.ACTION_PROMPT, {
                contents: this.contentsManager.getSnapshot(),
            });
            return;
        }
    }

    /**
     * 取り出し/投入フェーズでの inputRequired 処理
     * @private
     */
    _handleLootPhaseInput(payload, detection) {
        if (detection.type === ContainerPromptType.CATEGORY_SELECT) {
            this._transition(ContainerState.CATEGORY_SELECT, {
                direction: detection.direction,
            });

            // 自動転送タスクが待機中なら、全カテゴリ選択 (ALL_TYPES_SELECTED: -2) を自動返答
            if (this._pendingTransfer) {
                this._log('Auto-resolving CATEGORY_SELECT with ALL_TYPES_SELECTED');
                const menuItems = payload.items || payload.menuItems || [];
                const allTypesItem = menuItems.find(it => it.identifier === -2 || /All types/i.test(it.str || it.label || ''));
                const responseVal = allTypesItem
                    ? [{ identifier: allTypesItem.identifier, count: -1 }]
                    : [{ identifier: -2, count: -1 }];
                this._respondToCore(responseVal);
                return;
            }

            // カテゴリ選択メニューはユーザーに委ねる (通常のメニューとして表示)
            return;
        }

        if (detection.type === ContainerPromptType.ITEM_SELECT) {
            this._transition(ContainerState.ITEM_SELECT, {
                direction: detection.direction,
            });

            // 自動転送タスクが待機中なら、対象アイテムを自動選択して返答
            if (this._pendingTransfer) {
                this._log('Auto-resolving ITEM_SELECT for pending transfer', this._pendingTransfer);
                const menuItems = payload.items || payload.menuItems || [];
                const targetItems = this._pendingTransfer.items || [];
                const direction = this._pendingTransfer.direction || detection.direction;
                const selectedResponses = [];
                const selectedIdentifiers = new Set();
                const usedMenuIndices = new Set();

                // direction === 'out' (取り出し) の場合、メニュー項目はコンテナの中身そのもの
                if (direction === 'out' && menuItems.length > 0) {
                    this.contentsManager.updateFromMenuItems(menuItems);
                }

                for (const target of targetItems) {
                    // 投入時: 装備中・着用中アイテムは除外
                    if (direction === 'in') {
                        if (target.isWielded || target.isWorn || target.worn || target.isQuivered) {
                            continue;
                        }
                        // 開いているコンテナ自身を除外
                        if (this.contentsManager.containerOnum !== -1 && target.onum === this.contentsManager.containerOnum) {
                            continue;
                        }
                        if (this.contentsManager.containerName && target.name === this.contentsManager.containerName) {
                            continue;
                        }
                    }

                    // menuItems から照合 (既に使用済みのインデックスは除外)
                    let matched = null;
                    let matchedIdx = -1;

                    for (let idx = 0; idx < menuItems.length; idx++) {
                        if (usedMenuIndices.has(idx)) continue;
                        const it = menuItems[idx];

                        // 投入時: メニュー項目の文字列に装備中表示がある場合はスキップ
                        if (direction === 'in' && it.str) {
                            if (/\((?:wielded|weapon in hand|being worn|in quiver)\)/i.test(it.str)) {
                                continue;
                            }
                        }

                        // 1. identifier 一致
                        if (target.identifier !== undefined && target.identifier !== 0 && target.identifier !== -1 && it.identifier === target.identifier) {
                            matched = it;
                            matchedIdx = idx;
                            break;
                        }
                        // 2. letter / accelerator 一致
                        if (target.letter) {
                            const targetChar = String(target.letter);
                            if (it.accelerator === targetChar || (it.charStr && it.charStr === targetChar)) {
                                matched = it;
                                matchedIdx = idx;
                                break;
                            }
                            if (it.ch && it.ch === targetChar.charCodeAt(0)) {
                                matched = it;
                                matchedIdx = idx;
                                break;
                            }
                        }
                        // 3. rawText / str 一致
                        if (target.rawText && it.str) {
                            if (it.str === target.rawText || it.str.includes(target.rawText) || target.rawText.includes(it.str)) {
                                matched = it;
                                matchedIdx = idx;
                                break;
                            }
                        }
                        // 4. name 一致
                        if (target.name && it.str && it.str.includes(target.name)) {
                            matched = it;
                            matchedIdx = idx;
                            break;
                        }
                    }

                    if (matched && matchedIdx !== -1) {
                        const id = matched.identifier !== undefined ? matched.identifier : matched.ch;
                        // 重複 identifier 防止 (Double Free / Memory access out of bounds 防止)
                        if (!selectedIdentifiers.has(id)) {
                            selectedIdentifiers.add(id);
                            usedMenuIndices.add(matchedIdx);
                            let targetCount = (typeof target.count === 'number' && target.count > 0)
                                ? target.count
                                : (typeof matched.count === 'number' && matched.count > 0 ? matched.count : -1);
                            if (targetCount <= 0) {
                                const textToMatch = target.rawText || matched.str || '';
                                const numMatch = textToMatch.match(/^(\d+)\s+/);
                                if (numMatch) {
                                    targetCount = parseInt(numMatch[1], 10);
                                }
                            }
                            selectedResponses.push({
                                identifier: id,
                                count: targetCount,
                            });
                            // 差分更新は transferItems 呼び出し時に先行反映済みのため、ここでは二重呼び出しを行わない
                        }
                    }
                }

                if (selectedResponses.length > 0) {
                    this._log('Auto-resolved ITEM_SELECT with:', selectedResponses);
                    this._pendingTransfer.phase = 'ITEM_SENT';
                    this._respondToCore(selectedResponses);
                } else {
                    this._log('Auto-resolve ITEM_SELECT found no matching items; cancelling.');
                    this._resolveActiveTransfer(false, { reason: 'no_matching_items' });
                    this._pendingTransfer = null;
                    this._respondToCore(0);
                }
                return;
            }

            // アイテム選択メニューもユーザーに委ねる
            return;
        }

        if (detection.type === ContainerPromptType.COUNT_PROMPT) {
            if (this._pendingTransfer) {
                this._log('Auto-resolving COUNT_PROMPT for pending transfer');
                const targetItem = (this._pendingTransfer.items && this._pendingTransfer.items[0]) || {};
                const targetCount = (typeof targetItem.count === 'number' && targetItem.count > 0) ? targetItem.count : '';
                this._respondToCore(targetCount ? `${targetCount}\n` : '\n');
                return;
            }
        }

        if (detection.type === ContainerPromptType.ACTION_MENU) {
            // 取り出し/投入が完了して再度アクション選択に戻った
            const wasTransfer = !!this._pendingTransfer;
            this._pendingTransfer = null;
            if (this._compositeAction && !this._compositePhase1Done) {
                // 複合操作の第1フェーズ完了 → 第2フェーズへ
                this._compositePhase1Done = true;
                this._actionPromptPayload = payload;
                this._executeCompositePhase2();
                return;
            }

            // 通常のアクション選択ループ復帰
            this._actionPromptPayload = payload;
            this._compositeAction = null;
            this._compositePhase1Done = false;
            if (wasTransfer && this.lastTransactionDebug) {
                this.lastTransactionDebug.status = 'SUCCESS';
                this.lastTransactionDebug.message = `Successfully transferred ${this.lastTransactionDebug.items?.length || 0} item(s).`;
            }
            this._transition(ContainerState.ACTION_PROMPT, {
                contents: this.contentsManager.getSnapshot(),
                debug: this.lastTransactionDebug,
            });
            this._resolveActiveTransfer(true);
            return;
        }
    }

    /**
     * WebUICore の message イベントハンドラ
     * @private
     */
    _onMessage(text) {
        if (!this.enabled || this.state === ContainerState.IDLE) return;

        if (typeof text !== 'string') return;

        // BoH 爆発検知
        for (const pattern of EXPLOSION_PATTERNS) {
            if (pattern.test(text)) {
                this._log('BoH EXPLOSION detected!', { message: text });
                this.contentsManager.onContainerExploded();
                this._transition(ContainerState.EXPLODED, { message: text });
                // 爆発後は IDLE にリセット
                this._reset();
                return;
            }
        }

        // アイテム投入成功メッセージ（非セッション時の手動プレイ反映用）
        const putInMatch = text.match(PUT_IN_PATTERN);
        if (putInMatch) {
            if (!this._sessionActive) {
                this.contentsManager.onItemPutIn({ rawText: putInMatch[1] });
            }
            return;
        }

        // 空メッセージ
        this.contentsManager.handleEmptyMessage(text);
    }

    /**
     * WebUICore の inputResolved イベントハンドラ
     * @private
     */
    _onInputResolved() {
        // inputResolved は各プロンプト解決時に発火するが、
        // コンテナ操作ループ中は連続的に発火するため、ここでは追加処理は不要
    }

    // ========================================================================
    // パブリック API (UI 層から呼ばれる)
    // ========================================================================

    /**
     * 自動消化パイプラインによるアイテム転送（投入または取り出し）
     *
     * @param {Object} options
     * @param {'in'|'out'} options.direction - 転送方向 ('in': 投入, 'out': 取り出し)
     * @param {Array<Object>|Object} options.items - 転送対象アイテム (letter, identifier, count, rawText, name 等)
     * @returns {boolean} 転送リクエストが開始されたか
     */
    /**
     * 現在操作中のコンテナ情報を取得
     * @returns {Object} { letter, onum, name, isBagOfHolding, isFloorContainer }
     */
    getContainerInfo() {
        const letter = this.getContainerLetter();
        const isFloor = (letter && letter !== '.' && /^[a-zA-Z]$/.test(letter))
            ? false
            : (this._containerContext ? this._containerContext.isFloorContainer : (letter === '.' || letter === null));
        return {
            letter: letter,
            onum: this.contentsManager.containerOnum,
            name: this.contentsManager.containerName,
            isBagOfHolding: this.contentsManager.isBagOfHolding(),
            isFloorContainer: isFloor,
        };
    }

    /**
     * コンテナ中身をサイレント同期
     * @param {Object} [options={}]
     * @param {boolean} [options.force=false] - 空判定を無視して強制的に再取得するか
     * @returns {Promise<boolean>}
     */
    async syncContentsSilent(options = {}) {
        if (!this.core || typeof this.core.querySequenceSilent !== 'function') {
            return false;
        }

        // すでに空であることが確定しており、強制フラグもない場合は、無駄な Look inside (:) を送出しない
        // (空コンテナに : を送ると中身ウィンドウが開かずアクションメニューが返るため)
        if (!options.force && this.contentsManager.isEmpty && this.contentsManager.getItems().length === 0) {
            return true;
        }

        const containerInfo = this.getContainerInfo();
        const seq = this.sequenceBuilder.buildLookSequence(containerInfo);
        if (!seq || seq.length === 0) return false;

        const buffer = await this.core.querySequenceSilent(seq);
        return this.contentsManager.updateFromSequenceBuffer(buffer);
    }

    /**
     * 自動消化パイプラインによるアイテム転送（投入または取り出し）
     * 2ステップ動的実行によりカテゴリ選択メニューの有無を安全に判定
     *
     * @param {Object} options
     * @param {'in'|'out'} options.direction - 転送方向 ('in': 投入, 'out': 取り出し)
     * @param {Array<Object>|Object} options.items - 転送対象アイテム (letter, identifier, count, rawText, name 等)
     * @param {boolean} [options.allowSuspicious=false] - 未識別アイテムの投入を許可するか
     * @returns {boolean} 転送リクエストが開始されたか (完了待機は waitForCompletion() または transferItemsAsync() を利用)
     */
    transferItems({ direction, items, allowSuspicious = false }) {
        if (this.state !== ContainerState.ACTION_PROMPT) {
            this._log('transferItems rejected: not in ACTION_PROMPT state', { state: this.state });
            this._resolveActiveTransfer(false, { reason: 'not_in_action_prompt' });
            return false;
        }

        const itemList = Array.isArray(items) ? items : (items ? [items] : []);
        if (itemList.length === 0) {
            this._log('transferItems rejected: items list is empty');
            this._resolveActiveTransfer(false, { reason: 'empty_items' });
            return false;
        }

        const containerInfo = this.getContainerInfo();

        let validItems = itemList;
        let excludedItems = [];

        if (direction === 'in') {
            const validation = this.sequenceBuilder.validatePutInItems(containerInfo, itemList, { allowSuspicious });
            validItems = validation.validItems;
            excludedItems = validation.excludedItems;

            if (validItems.length === 0) {
                this._log('transferItems: sequence build returned null (all items excluded or invalid)');
                this._resolveActiveTransfer(false, { reason: 'all_items_excluded' });
                return false;
            }
        }

        // 投入時のセーフティガード判定（BoHの場合）
        if (direction === 'in' && this.contentsManager.isBagOfHolding()) {
            const safety = this.checkSafety(validItems);
            if (safety.critical.length > 0) {
                this._log('transferItems rejected by SafetyGuard: CRITICAL items detected', safety.critical);
                this._resolveActiveTransfer(false, { reason: 'safety_guard_critical', critical: safety.critical });
                return false;
            }
        }

        // 完了待機用リゾルバの初期化
        this._resolveActiveTransfer(false, { aborted: true });
        this._transactionPromise = new Promise((resolve) => {
            this._activeTransferResolver = resolve;
        });
        if (this._transferTimeoutTimer) clearTimeout(this._transferTimeoutTimer);
        this._transferTimeoutTimer = setTimeout(() => {
            this._log('transferItems: safety timeout (8000ms) reached');
            this._resolveActiveTransfer(false, { timeout: true });
        }, 8000);

        this._pendingTransfer = {
            direction,
            items: validItems,
        };

        // 動的対話型 FSM パイプラインの開始
        this._log('transferItems: Starting dynamic prompt-driven transfer from poskey', { direction, count: validItems.length });

        // 直近トランザクションのデバッグログ情報（画面表示用）
        this.lastTransactionDebug = {
            direction,
            items: validItems.map(it => it.letter || it.name || it.rawText),
            timestamp: new Date().toLocaleTimeString(),
            status: 'EXECUTING',
            message: `Executing ${direction === 'in' ? 'Put In' : 'Take Out'} for ${validItems.length} items...`,
        };

        this._transition(direction === 'in' ? ContainerState.PUTTING_IN : ContainerState.TAKING_OUT, {
            validItems,
            excludedItems,
            debug: this.lastTransactionDebug,
        });

        // 差分更新を先行反映
        for (const target of validItems) {
            if (direction === 'in') {
                this.contentsManager.onItemPutIn(target);
                this._updateInventoryDiff('remove', target);
            } else if (direction === 'out') {
                this.contentsManager.onItemTakenOut(target);
                this._updateInventoryDiff('add', target);
            }
        }

        // C コアに対するコンテナオープン初動
        const openPrefix = this.sequenceBuilder.getContainerOpenPrefix(containerInfo);
        this._pendingTransfer.phase = containerInfo.isFloorContainer ? 'START_LOOT' : 'START_APPLY';

        if (this.core && typeof this.core.executeSequence === 'function') {
            this.core.executeSequence(openPrefix);
        } else if (this.core && typeof this.core.querySequenceSilent === 'function') {
            this.core.querySequenceSilent(openPrefix);
        } else {
            const firstChar = (Array.isArray(openPrefix) && openPrefix.length > 0) ? openPrefix[0] : 'a';
            this._respondToCore(firstChar);
        }
        return true;
    }

    /**
     * 現在進行中のコンテナ転送トランザクションの完了を待機
     * @param {number} [timeoutMs=10000] - タイムアウトミリ秒
     * @returns {Promise<{ success: boolean, [key: string]: any }>}
     */
    waitForCompletion(timeoutMs = 10000) {
        if (!this._activeTransferResolver && !this._pendingTransfer) {
            return Promise.resolve({ success: true, idle: true });
        }
        return new Promise((resolve) => {
            let timer = null;
            const prevResolver = this._activeTransferResolver;

            const onDone = (res) => {
                if (timer) clearTimeout(timer);
                resolve(res);
            };

            this._activeTransferResolver = (res) => {
                if (typeof prevResolver === 'function') {
                    try { prevResolver(res); } catch (e) {}
                }
                onDone(res);
            };

            if (timeoutMs > 0) {
                timer = setTimeout(() => {
                    this._log('waitForCompletion: timeout reached');
                    onDone({ success: false, timeout: true });
                }, timeoutMs);
            }
        });
    }

    /**
     * 非同期版アイテム転送（開始〜Cコアのターン完了着地まで待機）
     * @param {Object} options
     * @returns {Promise<{ success: boolean, [key: string]: any }>}
     */
    async transferItemsAsync(options) {
        const started = this.transferItems(options);
        if (!started) {
            return { success: false, reason: 'rejected_or_invalid' };
        }
        return await this.waitForCompletion();
    }

    /**
     * UI 層からのアクション選択
     *
     * @param {string} action - ContainerAction の値 (':','o','i','b','r','s','n','q')
     * @returns {boolean} アクションが受理されたか
     */
    selectAction(action) {
        if (this.state !== ContainerState.ACTION_PROMPT) {
            this._log('selectAction rejected: not in ACTION_PROMPT state', { state: this.state });
            return false;
        }

        switch (action) {
            case ContainerAction.LOOK:
                this._transition(ContainerState.VIEWING);
                this._respondToCore(':');
                return true;

            case ContainerAction.TAKE_OUT:
                this._currentDirection = 'out';
                this._compositeAction = null;
                this._transition(ContainerState.TAKING_OUT);
                this._respondToCore('o');
                return true;

            case ContainerAction.PUT_IN:
                this._currentDirection = 'in';
                this._compositeAction = null;
                this._transition(ContainerState.PUTTING_IN);
                this._respondToCore('i');
                return true;

            case ContainerAction.BOTH:
                this._compositeAction = 'b';
                this._compositePhase1Done = false;
                this._currentDirection = 'out';
                this._transition(ContainerState.TAKING_OUT, { composite: 'both' });
                this._respondToCore('b');
                return true;

            case ContainerAction.REVERSED:
                this._compositeAction = 'r';
                this._compositePhase1Done = false;
                this._currentDirection = 'in';
                this._transition(ContainerState.PUTTING_IN, { composite: 'reversed' });
                this._respondToCore('r');
                return true;

            case ContainerAction.STASH:
                this._currentDirection = 'in';
                this._compositeAction = null;
                this._transition(ContainerState.STASHING_ONE);
                this._respondToCore('s');
                return true;

            case ContainerAction.NEXT:
                this._respondToCore('n');
                this._reset();
                return true;

            case ContainerAction.QUIT:
                this._respondToCore('q');
                this._reset();
                return true;

            default:
                this._log('Unknown action', { action });
                return false;
        }
    }

    /**
     * セーフティチェック実行
     * 投入予定アイテムリストに対して BoH セーフティガードを実行
     *
     * @param {Array<Object>} items - 投入予定アイテムリスト
     * @returns {{ safe: Array, critical: Array, suspicious: Array, discharged: Array, hasDanger: boolean }}
     */
    checkSafety(items) {
        const containerInfo = {
            name: this.contentsManager.containerName,
            onum: this.contentsManager.containerOnum,
        };
        return this.safetyGuard.assessItems(items, containerInfo);
    }

    /**
     * 単一アイテムのコンテナへの投入可否を判定 (SSOT ロジック)
     *
     * @param {Object} item - 判定対象アイテム
     * @param {Object} [options={}]
     * @param {boolean} [options.allowSuspicious=false] - 未識別アイテムを許可するか
     * @returns {{ valid: boolean, reason: string|null }}
     */
    validatePutIn(item, options = {}) {
        if (!item) {
            return { valid: false, reason: 'INVALID_ITEM' };
        }
        const containerInfo = this.getContainerInfo();
        const { validItems, excludedItems } = this.sequenceBuilder.validatePutInItems(containerInfo, [item], options);
        if (validItems.length > 0) {
            return { valid: true, reason: null };
        }
        const excluded = excludedItems[0];
        return { valid: false, reason: excluded ? excluded.reason : 'INVALID' };
    }

    /**
     * 複数アイテムのコンテナへの投入可否を一括判定
     *
     * @param {Array<Object>} items - 判定対象アイテムリスト
     * @param {Object} [options={}]
     * @returns {{ validItems: Array<Object>, excludedItems: Array<{ item: Object, reason: string }> }}
     */
    validatePutInItems(items, options = {}) {
        const containerInfo = this.getContainerInfo();
        return this.sequenceBuilder.validatePutInItems(containerInfo, items, options);
    }

    /**
     * 現在の FSM 状態のスナップショットを取得
     * @returns {Object}
     */
    getSnapshot() {
        return {
            state: this.state,
            enabled: this.enabled,
            container: this.contentsManager.getSnapshot(),
            isBagOfHolding: this.contentsManager.isBagOfHolding(),
            currentDirection: this._currentDirection,
            compositeAction: this._compositeAction,
            pendingTransfer: this._pendingTransfer ? { ...this._pendingTransfer } : null,
            debug: this.lastTransactionDebug || null,
        };
    }

    /**
     * トランザクションがアクティブかどうか
     * @returns {boolean}
     */
    isActive() {
        return this.state !== ContainerState.IDLE;
    }

    /**
     * コンテナ操作セッションを明示的に終了（ユーザーが閉じるボタン / ESC を押した時）
     */
    closeSession() {
        this._log('Closing container session');
        this._sessionActive = false;
        if (this.state === ContainerState.ACTION_PROMPT && this._actionPromptPayload) {
            this._respondToCore('q');
        }
        this._reset();
    }

    /**
     * 強制的にトランザクションを中止して IDLE に戻す
     */
    abort() {
        if (this.state !== ContainerState.IDLE) {
            this._log('Aborting container transaction');
            this.closeSession();
        }
    }

    // ========================================================================
    // 内部ヘルパー
    // ========================================================================

    /**
     * コンテナのインベントリレター（または床の '.'）を取得
     * @returns {string}
     */
    getContainerLetter() {
        if (this._containerContext && this._containerContext.letter) {
            return this._containerContext.letter;
        }
        if (this._lastAppliedLetter) {
            return this._lastAppliedLetter;
        }
        // インベントリからコンテナ名に一致するアイテムを検索
        const invMgr = (this.core.gkl && this.core.gkl.inventoryStateManager) || (this.core.inventoryStateManager);
        if (invMgr && this.contentsManager.containerName) {
            const items = (typeof invMgr.getItems === 'function' ? invMgr.getItems() : invMgr.items) || [];
            const targetName = this.contentsManager.containerName.toLowerCase();
            const found = items.find(it => {
                const name = (it.rawText || it.name || it.str || '').toLowerCase();
                return name.includes(targetName);
            });
            if (found && (found.letter || found.invlet)) {
                const letter = found.letter || found.invlet;
                if (this._containerContext) this._containerContext.letter = letter;
                return letter;
            }
        }
        // 見つからない場合は床コンテナとみなして '.'
        return '.';
    }

    /**
     * 冠詞や修飾語を除去してコンテナ名を正規化
     * @private
     */
    _normalizeContainerName(name) {
        if (!name) return '';
        return name.toLowerCase()
            .replace(/^(?:the|a|an|your|his|her|its)\s+/, '')
            .replace(/^(?:closed|locked|unlocked)\s+/, '')
            .trim();
    }

    /**
     * 複数コンテナメニュー (CONTAINER_SELECT) から同一コンテナを自動選択
     * @private
     */
    _handleContainerSelectAuto(payload) {
        const items = payload.items || payload.menuItems || [];
        const rawName = this.contentsManager.containerName || (this._containerContext && this._containerContext.name) || '';
        const normalizedTarget = this._normalizeContainerName(rawName);
        let targetItem = null;

        for (const it of items) {
            const text = it.rawStr || it.str || it.text || '';
            const normalizedItem = this._normalizeContainerName(text);
            if (normalizedTarget && (normalizedItem.includes(normalizedTarget) || normalizedTarget.includes(normalizedItem))) {
                targetItem = it;
                break;
            }
        }

        if (targetItem) {
            const id = targetItem.identifier !== undefined ? targetItem.identifier : targetItem.ch;
            this._respondToCore([{ identifier: id, count: -1 }]);
        } else if (items.length > 0) {
            const first = items[0];
            const id = first.identifier !== undefined ? first.identifier : first.ch;
            this._respondToCore([{ identifier: id, count: -1 }]);
        } else {
            this._respondToCore(0);
        }
    }

    /**
     * userActionSent イベントハンドラ（直前の apply 入力を追跡）
     * @private
     */
    _onUserActionSent(data) {
        if (!data || !Array.isArray(data.sequence) || data.sequence.length === 0) return;

        // セッション中は確定したコンテナレターを保護
        if (this._sessionActive) return;

        const seq = data.sequence;
        const firstKey = seq[0];

        const isLootCommand = firstKey === '#loot' || firstKey === 'l' || 
            (typeof firstKey === 'string' && (firstKey === '#' || firstKey.toLowerCase().includes('loot'))) ||
            seq.some(k => typeof k === 'string' && k.toLowerCase().includes('loot'));

        if (firstKey === 'a' || isLootCommand) {
            this._isApplyActive = true;
            if (isLootCommand) {
                this._lastAppliedLetter = '.'; // 床コンテナ / 足元
            } else if (seq.length > 1 && typeof seq[1] === 'string' && /^[a-zA-Z\.]$/.test(seq[1])) {
                this._lastAppliedLetter = seq[1];
            }
        } else if (typeof firstKey === 'string' && /^[a-zA-Z]$/.test(firstKey) && firstKey !== 'a') {
            // 'd', 't' 等の明確な非 apply/loot コマンド時は false に設定
            this._isApplyActive = false;
        }
    }

    /**
     * WebUICore.respond() を通じて C コアに応答
     * @private
     */
    _respondToCore(value) {
        if (typeof value === 'string' && value.length === 1) {
            this.core.respond(value.charCodeAt(0));
        } else {
            this.core.respond(value);
        }
    }

    /**
     * 複合操作 ('b'/'r') の第2フェーズを実行
     * @private
     */
    _executeCompositePhase2() {
        if (this._compositeAction === 'b') {
            // 'b' = out → in: 第2フェーズは put_in
            this._currentDirection = 'in';
            this._transition(ContainerState.PUTTING_IN, { composite: 'both_phase2' });
            // C コアが自動的に第2フェーズを開始するため、追加応答は不要
            // (use_container 内で loot_out → loot_in と自動進行)
        } else if (this._compositeAction === 'r') {
            // 'r' = in → out: 第2フェーズは take_out
            this._currentDirection = 'out';
            this._transition(ContainerState.TAKING_OUT, { composite: 'reversed_phase2' });
        }
    }

    /**
     * デバッグログ出力
     * @private
     */
    _log(message, data = null) {
        if (this.debug) {
            if (data) {
                console.log(`[ContainerFSM] ${message}`, data);
            } else {
                console.log(`[ContainerFSM] ${message}`);
            }
        }
    }
}
