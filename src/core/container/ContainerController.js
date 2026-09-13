/**
 * ContainerController.js
 *
 * IRC（InteractiveRequestController）と SIGNAL 辞書に基づく純粋なコンテナ対話コントローラ。
 *
 * 設計原則 (SSOT):
 * 1. 裏マクロ同期 (syncContents 等の二重開閉) の完全禁止。
 * 2. 1操作＝1IRCトランザクション（直接対話）の徹底。
 * 3. C コアの select_menu に対しては、16バイト境界構造体配列 [{ identifier, count }] を直接返却。
 * 4. C コアからのシグナル復帰（SIGNAL_CONTAINER_ACTION_MENU / turn_ready）をもって完了判定。
 */

import { ContainerSafetyGuard } from './ContainerSafetyGuard.js';
import { ContainerContentsManager, ContainerType } from './ContainerContentsManager.js';
import { ContainerSequenceBuilder } from './ContainerSequenceBuilder.js';

export class ContainerController {
    /**
     * @param {Object} options
     * @param {Object} [options.core] - WebUICore インスタンス
     * @param {InteractiveRequestController} [options.interactiveController]
     * @param {ContainerSafetyGuard} [options.safetyGuard]
     * @param {ContainerContentsManager} [options.contentsManager]
     * @param {ContainerSequenceBuilder} [options.sequenceBuilder]
     */
    constructor(options = {}) {
        this.core = options.core || null;
        this.interactiveController = options.interactiveController || (this.core ? this.core.interactiveController : null);
        this.safetyGuard = options.safetyGuard || new ContainerSafetyGuard();
        this.contentsManager = options.contentsManager || new ContainerContentsManager();
        this.sequenceBuilder = options.sequenceBuilder || new ContainerSequenceBuilder({ safetyGuard: this.safetyGuard });

        this.currentContainer = null;
        this.isSessionActive = false;
        this.isProcessing = false;
        this.listeners = new Map();
        this._signalHandler = null;

        if (this.core) {
            this.attach(this.core);
        }
    }

    /**
     * WebUICore にアタッチし、シグナルイベントを自律購読
     * @param {Object} core - WebUICore インスタンス
     */
    attach(core) {
        if (!core) return;
        this.setCore(core);

        if (this._signalHandler) {
            this.detach();
        }

        this._signalHandler = (payload) => {
            this._handleSignal(payload);
        };

        if (typeof core.on === 'function') {
            core.on('signal', this._signalHandler);
            core.on('inputRequired', this._signalHandler);
        }
    }

    /**
     * WebUICore からデタッチ
     */
    detach() {
        if (this.core && this._signalHandler && typeof this.core.off === 'function') {
            this.core.off('signal', this._signalHandler);
            this.core.off('inputRequired', this._signalHandler);
        }
        this._signalHandler = null;
    }

    /**
     * シグナル受信時のハンドラ
     * @private
     */
    _handleSignal(payload) {
        if (!payload) return;
        const signal = payload.signal || payload.guiData || payload;
        const signalId = signal.signalId || signal.id;
        const subCategory = signal.subCategory;
        const inputType = signal.inputType;

        const isContainerMenu = signalId === 'SIGNAL_CONTAINER_ACTION_MENU' ||
                               signalId === 'SIGNAL_CONTAINER_ACTION_MENU_LOOT' ||
                               subCategory === 'CONTAINER_ACTION_MENU' ||
                               inputType === 'CONTAINER';

        const isBusy = Boolean(this.interactiveController && this.interactiveController.isBusy());

        if (isContainerMenu && !this.isSessionActive && !isBusy) {
            this.handleInitialActionMenu(payload);
        }
    }

    /**
     * イベントリスナーの登録
     */
    on(event, fn) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(fn);
        return this;
    }

    /**
     * イベントリスナーの解除
     */
    off(event, fn) {
        if (!this.listeners.has(event)) return this;
        const list = this.listeners.get(event);
        const idx = list.indexOf(fn);
        if (idx >= 0) list.splice(idx, 1);
        return this;
    }

    /**
     * イベントの発行
     */
    emit(event, data) {
        const list = this.listeners.get(event);
        if (list) {
            for (const fn of list) {
                try { fn(data); } catch (e) { console.error(`[ContainerController] Listener error on '${event}':`, e); }
            }
        }
    }

    setCore(core) {
        this.core = core;
        if (!this.interactiveController && core) {
            this.interactiveController = core.interactiveController;
        }
        if (this.safetyGuard && core && core.gkl) {
            this.safetyGuard.setInventoryStateManager(core.gkl.inventoryStateManager);
        }
    }

    isActive() {
        return this.isSessionActive;
    }

    getContentsManager() {
        return this.contentsManager;
    }

    getSafetyGuard() {
        return this.safetyGuard;
    }

    /**
     * コンテナ投入の事前バリデーション (BoH防爆・装備中・自己投入チェック)
     * @param {Object} item
     * @returns {{ allowed: boolean, valid: boolean, reason?: string }}
     */
    validatePutIn(item) {
        if (!this.currentContainer || !item) {
            return { allowed: false, valid: false, reason: 'NO_CONTAINER_OR_ITEM' };
        }

        // 1. 自己投入ガード
        const itemLetter = item.letter || item.invlet;
        const containerLetter = this.currentContainer.letter;
        if (itemLetter && containerLetter && itemLetter === containerLetter) {
            return { allowed: false, valid: false, reason: 'SELF_CONTAINER' };
        }
        if (item.identifier && this.currentContainer.identifier && item.identifier === this.currentContainer.identifier) {
            return { allowed: false, valid: false, reason: 'SELF_CONTAINER' };
        }

        // 2. 装備中アイテムガード
        if (item.isWielded || item.isWorn || item.worn || item.isOffhand || item.isQuivered) {
            return { allowed: false, valid: false, reason: 'EQUIPPED' };
        }

        // 3. BoH 防爆チェック
        if (this.currentContainer.isBagOfHolding) {
            const assessment = this.safetyGuard.assessItem(item, this.currentContainer);
            if (assessment.level === 'CRITICAL') {
                return { allowed: false, valid: false, reason: 'BOH_CRITICAL', assessment };
            }
            if (assessment.level === 'SUSPICIOUS') {
                return { allowed: false, valid: true, warning: 'BOH_SUSPICIOUS', assessment };
            }
        }

        return { allowed: true, valid: true };
    }

    /**
     * アイテムの BoH セーフティチェック (UI層への委譲インターフェース)
     * @param {Array<Object>|Object} items
     * @returns {{ safe: Array, critical: Array, suspicious: Array, discharged: Array, hasDanger: boolean, criticalItems: Array, suspiciousItems: Array }}
     */
    checkSafety(items) {
        if (!this.safetyGuard) {
            return { safe: [], critical: [], suspicious: [], discharged: [], hasDanger: false, criticalItems: [], suspiciousItems: [] };
        }
        const itemList = Array.isArray(items) ? items : [items];
        const result = this.safetyGuard.assessItems(itemList, this.currentContainer);
        result.criticalItems = result.critical;
        result.suspiciousItems = result.suspicious;
        return result;
    }

    /**
     * プレイヤーがコンテナを開いて SIGNAL_CONTAINER_ACTION_MENU が届いた際の初期化
     * @param {Object} payload - inputRequired ペイロード
     * @param {Object} [options={}]
     * @returns {Promise<boolean>}
     */
    async handleInitialActionMenu(payload, options = {}) {
        if (this.isSessionActive || this.isProcessing) {
            return false;
        }

        const controller = this.interactiveController || (this.core ? this.core.interactiveController : null);
        if (!controller) {
            console.error('[ContainerController] InteractiveRequestController is not available.');
            return false;
        }

        this.isProcessing = true;

        try {
            const signalParams = payload.signal?.params || {};
            const containerName = signalParams.containerName || options.containerName || 'container';

            let letter = options.letter || null;
            let matchedInventoryItem = null;

            // 1. 手持ちコンテナ判定 (NetHack C コアは手持ちアイテムに "your " / "あなたの" を付与)
            const isYourContainer = /^(?:your|あなたの)\s*/i.test(containerName);

            // 2. targetName の正規化 ("your bag" -> "bag", "the large box" -> "large box", "あなたの鞄" -> "鞄")
            const cleanTarget = containerName
                .toLowerCase()
                .replace(/^(?:the|an?|your|その|あの|あなたの)\s*/i, '')
                .replace(/[\?？\.\!]$/, '')
                .trim();

            const isBagPattern = /\b(bag|sack)\b/i.test(cleanTarget) || /(?:鞄|袋|バックパック)/.test(cleanTarget);
            const isBoxPattern = /\b(box|chest|iron safe|sarcophagus)\b/i.test(cleanTarget) || /(?:箱|宝箱|金庫)/.test(cleanTarget);
            const isFloorNamed = isBoxPattern;
            const isTheContainer = /^(?:the|その|あの)\s*/i.test(containerName);

            const isLootTriggered = payload.signal?.id === 'SIGNAL_CONTAINER_ACTION_MENU_LOOT' ||
                                   signalParams.source === 'LOOT_COMMAND' ||
                                   Boolean(signalParams.isFloorContainer);

            // 3. 床コンテナか手持ちコンテナかを厳格判定
            let isFloor;
            if (options.isFloorContainer !== undefined) {
                isFloor = options.isFloorContainer;
            } else if (isYourContainer) {
                // NetHack C コアにおいて "your " が付くのは 100% 手持ちインベントリ内アイテム
                isFloor = false;
            } else if (isLootTriggered || isTheContainer || isFloorNamed) {
                // "#loot" コマンド由来、"the ..." プレフィックス、または "your" が付かない床箱名は 100% 床コンテナ
                isFloor = true;
            } else {
                isFloor = false;
            }

            // 4. 手持ちコンテナの場合のみインベントリから該当アイテムを探索（床コンテナへの手持ち誤同定を完全遮断）
            if (!isFloor) {
                if (options.item) {
                    matchedInventoryItem = options.item;
                    letter = options.item.letter || options.item.invlet || letter;
                } else if (this.core) {
                    const invMgr = (this.core.gkl && this.core.gkl.inventoryStateManager) || this.core.inventoryStateManager;
                    const items = invMgr ? (typeof invMgr.getItems === 'function' ? invMgr.getItems() : invMgr.items) : [];
                    if (Array.isArray(items) && items.length > 0) {
                        // lastUsedItemLetter の検証: 直前の使用アイテムがコンテナ（鞄・箱）と一致する場合のみ採用
                        let candidateItem = null;
                        if (!letter && this.core.lastUsedItemLetter) {
                            const lastLetter = this.core.lastUsedItemLetter;
                            const found = items.find(it => (it.letter === lastLetter || it.invlet === lastLetter));
                            if (found) {
                                const raw = (found.rawText || found.name || '').toLowerCase();
                                const name = (found.name || '').toLowerCase();
                                const matchesName = cleanTarget && (raw.includes(cleanTarget) || name.includes(cleanTarget));
                                const matchesBag = isBagPattern && (/\b(bag|sack|bag of holding|bag of tricks|oilskin sack)\b/i.test(raw) ||
                                                                    /\b(bag|sack|bag of holding|bag of tricks|oilskin sack)\b/i.test(name) ||
                                                                    /(?:鞄|袋|バックパック)/.test(raw) || /(?:鞄|袋|バックパック)/.test(name) ||
                                                                    (found.onum >= 217 && found.onum <= 220) || found.isBag);
                                const matchesBox = isBoxPattern && (/\b(large box|chest|box|ice box|iron safe)\b/i.test(raw) ||
                                                                    /\b(large box|chest|box|ice box|iron safe)\b/i.test(name) ||
                                                                    /(?:箱|宝箱|金庫)/.test(raw) || /(?:箱|宝箱|金庫)/.test(name) ||
                                                                    (found.onum >= 214 && found.onum <= 216) || found.isBox);
                                if (matchesName || matchesBag || matchesBox) {
                                    candidateItem = found;
                                    letter = lastLetter;
                                }
                            }
                        }

                        if (candidateItem) {
                            matchedInventoryItem = candidateItem;
                        } else if (letter) {
                            matchedInventoryItem = items.find(it => (it.letter === letter || it.invlet === letter));
                        }

                        if (!matchedInventoryItem) {
                            matchedInventoryItem = items.find(it => {
                                const raw = (it.rawText || it.name || '').toLowerCase();
                                const name = (it.name || '').toLowerCase();

                                // 完全・部分一致
                                if (cleanTarget && (raw.includes(cleanTarget) || name.includes(cleanTarget))) {
                                    return true;
                                }

                                // 袋系（bag / sack / oilskin sack / bag of holding / bag of tricks）の包括照合
                                if (isBagPattern) {
                                    const itemIsBag = /\b(bag|sack|bag of holding|bag of tricks|oilskin sack)\b/i.test(raw) ||
                                                      /\b(bag|sack|bag of holding|bag of tricks|oilskin sack)\b/i.test(name) ||
                                                      /(?:鞄|袋|バックパック)/.test(raw) || /(?:鞄|袋|バックパック)/.test(name) ||
                                                      (it.onum >= 217 && it.onum <= 220) || it.isBag;
                                    if (itemIsBag) return true;
                                }

                                // 箱系（large box / chest / ice box / iron safe）の包括照合
                                if (isBoxPattern) {
                                    const itemIsBox = /\b(large box|chest|box|ice box|iron safe)\b/i.test(raw) ||
                                                      /\b(large box|chest|box|ice box|iron safe)\b/i.test(name) ||
                                                      /(?:箱|宝箱|金庫)/.test(raw) || /(?:箱|宝箱|金庫)/.test(name) ||
                                                      (it.onum >= 214 && it.onum <= 216) || it.isBox;
                                    if (itemIsBox) return true;
                                }
                                return false;
                            });
                        }

                        // フォールバック: 手持ちコンテナ確定時にインベントリ内同種アイテムが1つだけならそれを採用
                        if (!matchedInventoryItem) {
                            if (isBagPattern) {
                                const bagItems = items.filter(it => {
                                    const raw = (it.rawText || it.name || '').toLowerCase();
                                    const name = (it.name || '').toLowerCase();
                                    return /\b(bag|sack|bag of holding|bag of tricks|oilskin sack)\b/i.test(raw) ||
                                           /\b(bag|sack|bag of holding|bag of tricks|oilskin sack)\b/i.test(name) ||
                                           /(?:鞄|袋|バックパック)/.test(raw) || /(?:鞄|袋|バックパック)/.test(name) ||
                                           (it.onum >= 217 && it.onum <= 220) || it.isBag;
                                });
                                if (bagItems.length === 1) {
                                    matchedInventoryItem = bagItems[0];
                                }
                            } else if (isBoxPattern) {
                                const boxItems = items.filter(it => {
                                    const raw = (it.rawText || it.name || '').toLowerCase();
                                    const name = (it.name || '').toLowerCase();
                                    return /\b(large box|chest|box|ice box|iron safe)\b/i.test(raw) ||
                                           /\b(large box|chest|box|ice box|iron safe)\b/i.test(name) ||
                                           /(?:箱|宝箱|金庫)/.test(raw) || /(?:箱|宝箱|金庫)/.test(name) ||
                                           (it.onum >= 214 && it.onum <= 216) || it.isBox;
                                });
                                if (boxItems.length === 1) {
                                    matchedInventoryItem = boxItems[0];
                                }
                            }
                        }

                        if (matchedInventoryItem) {
                            letter = matchedInventoryItem.letter || matchedInventoryItem.invlet || letter;
                        }
                    }
                }
            } else {
                // 床コンテナ確定時は letter と matchedInventoryItem を確実にクリア
                letter = null;
                matchedInventoryItem = null;
            }

            const isBagOfHolding = this.safetyGuard ?
                this.safetyGuard.isBagOfHolding({ name: containerName, rawText: containerName, onum: matchedInventoryItem?.onum }) :
                /bag of holding/i.test(containerName);

            this.currentContainer = {
                name: containerName,
                cleanName: cleanTarget,
                rawName: containerName,
                letter: letter,
                identifier: matchedInventoryItem?.identifier || null,
                onum: matchedInventoryItem?.onum || -1,
                isFloorContainer: isFloor,
                isBagOfHolding: isBagOfHolding,
                targetLetter: options.targetLetter || null
            };

            this.contentsManager.openContainer(this.currentContainer);

            // メニューから 'o' (Take out) の有無を判定
            const menuItems = payload.items || payload.menuItems || [];
            const hasTakeOut = menuItems.some(it => {
                const ch = it.charStr || (it.accelerator ? String.fromCharCode(it.accelerator) : '') || it.ch;
                return ch === 'o' || String(ch).toLowerCase() === 'o';
            });

            // 中身が空なら、'q' でアクションメニューを抜けて poskey へ
            if (!hasTakeOut) {
                console.log('[ContainerController] Container is empty. Leaving with \'q\'.');
                const activeRes = payload.safeResolver || payload.resolver || (this.core ? this.core.activeResolver : null);
                if (activeRes && typeof activeRes.respond === 'function') {
                    activeRes.respond('q');
                } else if (this.core && typeof this.core.respond === 'function') {
                    this.core.respond('q', { force: true });
                }

                this.contentsManager.updateFromMenuItems([]);
                this.isSessionActive = true;
                this.isProcessing = false;
                if (this.interactiveController && typeof this.interactiveController.acquireSessionLock === 'function') {
                    this.interactiveController.acquireSessionLock('container');
                }
                this._emitSessionOpen();
                return true;
            }

            // 中身が存在する場合: 初回のみ 'o' で一覧を取得し 'ESC' で抜けて poskey へ
            console.log('[ContainerController] Container has items. Fetching initial contents...');
            const initialFetchRecipe = {
                id: 'RECIPE_CONTAINER_INITIAL_FETCH',
                start: ['o'],
                handlers: [
                    {
                        match: { subCategory: 'DIRECTION', signalId: 'SIGNAL_DIRECTION' },
                        action: () => '.'
                    },
                    {
                        match: { subCategory: 'CONTAINER_FLOOR_SELECT' },
                        action: (ctx) => {
                            const items = ctx.menuItems || [];
                            const tLetter = options.targetLetter;
                            const target = (tLetter && items.find(it => it.charStr === tLetter || it.accelerator === tLetter.charCodeAt(0))) || items[0];
                            return [{ identifier: target?.identifier || -1, count: -1 }];
                        }
                    },
                    {
                        match: { subCategory: 'CONTAINER_CATEGORY_SELECT' },
                        action: [{ identifier: -2, count: -1 }] // All types
                    },
                    {
                        match: { subCategory: 'CONTAINER_ITEM_SELECT' },
                        action: (ctx) => {
                            const items = ctx.menuItems || [];
                            console.log(`[ContainerController] Extracted ${items.length} initial items from container.`);
                            this.contentsManager.updateFromMenuItems(items);
                            ctx.state = 'CONTENTS_EXTRACTED';
                            return '\x1b'; // 取り出さずにキャンセル
                        }
                    },
                    {
                        match: { subCategory: 'CONTAINER_ACTION_MENU' },
                        action: () => 'q' // 終了して通常ターンへ
                    }
                ],
                until: { type: 'turn_ready' },
                timeoutMs: 4000,
                defaultAction: '\x1b'
            };

            const result = await controller.querySequenceSilent(initialFetchRecipe);
            this.isSessionActive = true;
            this.isProcessing = false;
            if (this.interactiveController && typeof this.interactiveController.acquireSessionLock === 'function') {
                this.interactiveController.acquireSessionLock('container');
            }

            if (!result.success) {
                console.warn('[ContainerController] Initial fetch finished with warnings:', result.error);
            }

            this._emitSessionOpen();
            return true;
        } catch (e) {
            console.error('[ContainerController] Error in handleInitialActionMenu:', e);
            this.isProcessing = false;
            this.isSessionActive = false;
            return false;
        }
    }

    /**
     * アイテム転送 (Put In / Take Out) をアトミックに実行 (1操作＝1トランザクション)
     * @param {Object} options
     * @param {'in'|'out'} options.direction
     * @param {Object} options.item
     * @param {number} [options.count=1]
     * @param {number} [options.quantity]
     * @param {boolean} [options.allowSuspicious=false]
     * @returns {Promise<{ success: boolean, error?: any }>}
     */
    async transferItem(options = {}) {
        if (!this.isSessionActive || !this.currentContainer) {
            throw new Error('[ContainerController] No active container session.');
        }

        const { direction, item, allowSuspicious = false } = options;
        const rawCount = options.count !== undefined ? options.count : options.quantity;
        const count = (typeof rawCount === 'number' && rawCount > 0) ? rawCount : -1;

        if (!item || (direction !== 'in' && direction !== 'out')) {
            throw new Error('[ContainerController] Valid item and direction (\'in\'|\'out\') required.');
        }

        if (direction === 'in') {
            const validation = this.validatePutIn(item);
            if (!validation.allowed) {
                return { success: false, error: new Error(`Blocked by safety guard: ${validation.reason}`) };
            }
            if (validation.warning === 'BOH_SUSPICIOUS' && !allowSuspicious) {
                return { success: false, error: new Error('Blocked by safety guard: BOH_SUSPICIOUS') };
            }
        }

        const controller = this.interactiveController || (this.core ? this.core.interactiveController : null);
        if (!controller) {
            throw new Error('[ContainerController] InteractiveRequestController is not available.');
        }

        this.isProcessing = true;

        try {
            const openPrefix = this.sequenceBuilder.getContainerOpenPrefix(this.currentContainer);
            console.log(`[ContainerController] Executing ${direction}: item=${item.name || item.rawText}, count=${count}`);

            const transferRecipe = {
                id: `RECIPE_CONTAINER_${direction.toUpperCase()}`,
                start: openPrefix,
                handlers: [
                    {
                        match: { subCategory: 'DIRECTION', signalId: 'SIGNAL_DIRECTION' },
                        action: () => '.'
                    },
                    {
                        match: { subCategory: 'CONTAINER_FLOOR_SELECT' },
                        action: (ctx) => {
                            const items = ctx.menuItems || [];
                            const tLetter = this.currentContainer?.targetLetter;
                            const target = (tLetter && items.find(mi => mi.charStr === tLetter || mi.accelerator === tLetter.charCodeAt(0))) || items[0];
                            return [{ identifier: target?.identifier || -1, count: -1 }];
                        }
                    },
                    {
                        match: { subCategory: 'CONTAINER_ACTION_MENU' },
                        action: (ctx) => {
                            if (ctx.state === 'ITEM_SELECTED') {
                                // アイテム選択後にアクションメニューへ戻ってきたら 'q' で抜けて turn_ready へ着地
                                return 'q';
                            }
                            return direction === 'in' ? 'i' : 'o';
                        }
                    },
                    {
                        match: { subCategory: 'CONTAINER_CATEGORY_SELECT' },
                        action: [{ identifier: -2, count: -1 }] // All types
                    },
                    {
                        match: { subCategory: 'CONTAINER_ITEM_SELECT' },
                        action: (ctx) => {
                            ctx.state = 'ITEM_SELECTED';
                            const menuItems = ctx.menuItems || [];

                            // 金貨アイテム判定
                            const isGoldTarget = item.isGold || item.letter === '$' || item.invlet === '$' ||
                                                 /(?:gold\s+pieces?|pieces?\s+of\s+gold|zorkmids?|枚の金貨|^金貨$)/i.test(item.name || item.str || item.rawText || '');

                            // identifier の厳密同定
                            let targetId = item.identifier || 0;
                            if (targetId && !menuItems.some(mi => mi.identifier === targetId)) {
                                targetId = 0; // ポインタが変動していたら再同定へ
                            }

                            if (!targetId) {
                                if (isGoldTarget) {
                                    // 金貨アイテムの優先探索: accelerator === 36 ('$')、glyph === 3886、またはテキスト照合
                                    const goldMatch = menuItems.find(mi => {
                                        if (mi.identifier === 0) return false;
                                        const ch = mi.charStr || (mi.accelerator ? String.fromCharCode(mi.accelerator) : '') || mi.ch;
                                        if (ch === '$' || mi.accelerator === 36) return true;
                                        if (mi.glyph === 3886 || (mi.glyphInfo && mi.glyphInfo.glyph === 3886)) return true;
                                        const miText = (mi.rawStr || mi.str || mi.text || '').toLowerCase();
                                        return /(?:gold\s+pieces?|pieces?\s+of\s+gold|zorkmids?|枚の金貨|^金貨$)/i.test(miText);
                                    });
                                    if (goldMatch && goldMatch.identifier) {
                                        targetId = goldMatch.identifier;
                                    }
                                }

                                if (!targetId) {
                                    const targetLetter = item.letter || item.invlet || item.accelerator;
                                    const targetName = (item.name || item.str || item.rawText || '').toLowerCase().trim();

                                    const letterMatch = menuItems.find(mi => {
                                        if (mi.identifier === 0) return false;
                                        const ch = mi.charStr || (mi.accelerator ? String.fromCharCode(mi.accelerator) : '') || mi.ch;
                                        return targetLetter && ch && ch.toLowerCase() === targetLetter.toLowerCase();
                                    });

                                    if (letterMatch && letterMatch.identifier) {
                                        targetId = letterMatch.identifier;
                                    } else {
                                        const nameMatch = menuItems.find(mi => {
                                            if (mi.identifier === 0) return false;
                                            const miText = (mi.rawStr || mi.str || mi.text || '').toLowerCase();
                                            return targetName && (miText.includes(targetName) || targetName.includes(miText));
                                        });
                                        if (nameMatch && nameMatch.identifier) {
                                            targetId = nameMatch.identifier;
                                        }
                                    }
                                }
                            }

                            if (!targetId) {
                                console.warn('[ContainerController] Could not find item in CONTAINER_ITEM_SELECT. Canceling.');
                                return '\x1b';
                            }

                            const selections = [{ identifier: targetId, count: count }];
                            return selections;
                        }
                    }
                ],
                until: { type: 'turn_ready' },
                timeoutMs: 5000,
                defaultAction: '\x1b'
            };

            const result = await controller.querySequenceSilent(transferRecipe);

            this.isProcessing = false;

            if (!result.success) {
                console.error('[ContainerController] Transfer failed in C core:', result.error);
                return { success: false, error: result.error };
            }

            // 🌟 C コアが処理を完了して turn_ready に着地した時点で成功確定！
            // 裏マクロ syncContents は一切行わず、ローカルモデルを1個更新
            if (direction === 'in') {
                this.contentsManager.onItemPutIn({ ...item, count: count });
            } else {
                this.contentsManager.onItemTakenOut({ ...item, count: count });
            }

            // 所持品インベントリを更新
            if (this.core && this.core.gkl && typeof this.core.gkl.syncInventorySilent === 'function') {
                await this.core.gkl.syncInventorySilent({ force: true });
            }

            this._emitSessionUpdate();
            return { success: true };
        } catch (e) {
            console.error('[ContainerController] Exception in transferItem:', e);
            this.isProcessing = false;
            return { success: false, error: e };
        }
    }

    /**
     * セッション終了
     */
    closeSession() {
        if (!this.isSessionActive) return;

        this.isSessionActive = false;
        this.currentContainer = null;
        this.isProcessing = false;

        if (this.interactiveController && typeof this.interactiveController.releaseSessionLock === 'function') {
            this.interactiveController.releaseSessionLock('container');
        }

        const eventData = {
            state: 'IDLE',
            isContainerSessionActive: false
        };
        this.emit('containerTransaction', eventData);
        if (this.core && typeof this.core.emit === 'function') {
            this.core.emit('containerTransaction', eventData);
        }
    }

    _emitSessionOpen() {
        if (!this.currentContainer) return;
        const eventData = {
            state: 'ACTION_PROMPT',
            containerName: this.currentContainer.name,
            containerType: this.currentContainer.isBagOfHolding ? ContainerType.BAG_OF_HOLDING : (this.contentsManager.containerType || ContainerType.UNKNOWN),
            contents: [...this.contentsManager.getItems()],
            isBagOfHolding: this.currentContainer.isBagOfHolding,
            isFloorContainer: this.currentContainer.isFloorContainer,
            containerLetter: this.currentContainer.letter,
            isContainerSessionActive: true
        };
        this.emit('containerTransaction', eventData);
        if (this.core && typeof this.core.emit === 'function') {
            this.core.emit('containerTransaction', eventData);
        }
    }

    _emitSessionUpdate() {
        const eventData = {
            state: 'ACTION_PROMPT',
            containerName: this.currentContainer ? this.currentContainer.name : '',
            containerType: this.currentContainer?.isBagOfHolding ? ContainerType.BAG_OF_HOLDING : (this.contentsManager.containerType || ContainerType.UNKNOWN),
            contents: [...this.contentsManager.getItems()],
            isBagOfHolding: Boolean(this.currentContainer?.isBagOfHolding),
            isFloorContainer: Boolean(this.currentContainer?.isFloorContainer),
            containerLetter: this.currentContainer?.letter || null,
            isContainerSessionActive: true
        };
        this.emit('containerTransaction', eventData);
        if (this.core && typeof this.core.emit === 'function') {
            this.core.emit('containerTransaction', eventData);
        }
    }
}
