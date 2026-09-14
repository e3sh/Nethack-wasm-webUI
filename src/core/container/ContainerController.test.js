/**
 * ContainerController.test.js
 *
 * ContainerController（IRC & Signal-Driven コンテナ対話制御基盤）の単体テスト
 *
 * 検証項目:
 * 1. 初回オープン時の空/非空の遷移 (SIGNAL_CONTAINER_ACTION_MENU)
 * 2. 投入（Put In）時のセーフティガードブロック (自己投入・装備中・BoH危険物)
 * 3. 投入（Put In）時の IRC レシピ実行と 16バイト構造体直接返却
 * 4. 取り出し（Take Out）時の正常取り出しと最後の1個の消滅
 * 5. 裏マクロなし、平文パースなしで turn_ready 着地をもって完了することの保証
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContainerController } from './ContainerController.js';
import { ContainerSafetyGuard } from './ContainerSafetyGuard.js';
import { ContainerContentsManager } from './ContainerContentsManager.js';

describe('ContainerController (IRC & Signal-Driven)', () => {
    let controller;
    let mockCore;
    let mockInteractive;
    let safetyGuard;
    let contentsManager;

    beforeEach(() => {
        mockCore = {
            emit: vi.fn(),
            lastUsedItemLetter: null,
            gkl: {
                syncInventorySilent: vi.fn().mockResolvedValue(true),
                inventoryStateManager: {
                    getItems: vi.fn(() => [
                        { letter: 'a', rawText: 'a +0 dagger', identifier: 101 },
                        { letter: 's', rawText: 'the sack', identifier: 999 },
                        { letter: 'b', rawText: 'a bag of holding', identifier: 998, onum: 346 },
                        { letter: 'w', rawText: 'a wand of cancellation', identifier: 201, onum: 263, spe: 1 },
                        { letter: 'u', rawText: 'a wooden wand', identifier: 202, isSuspicious: true },
                        { letter: 'e', rawText: 'a sword (weapon in hand)', identifier: 301, isWielded: true },
                    ]),
                },
            },
            activeResolver: null,
        };

        mockInteractive = {
            isExecuting: vi.fn(() => false),
            querySequenceSilent: vi.fn().mockResolvedValue({ success: true, buffer: [] }),
        };

        safetyGuard = new ContainerSafetyGuard();
        contentsManager = new ContainerContentsManager();

        controller = new ContainerController({
            core: mockCore,
            interactiveController: mockInteractive,
            safetyGuard: safetyGuard,
            contentsManager: contentsManager,
        });
    });

    // ========================================================================
    // 1. 基本状態とセーフティチェック委譲
    // ========================================================================

    describe('Basic state and safety delegation', () => {
        it('初期状態では非アクティブであること', () => {
            expect(controller.isActive()).toBe(false);
            expect(controller.getContentsManager()).toBe(contentsManager);
            expect(controller.getSafetyGuard()).toBe(safetyGuard);
        });

        it('checkSafety() で items のセーフティ判定が委譲され、criticalItems / suspiciousItems が取得できること', () => {
            const items = [
                { onum: 263, rawText: 'wand of cancellation', spe: 1 },
                { rawText: 'wooden wand', isSuspicious: true },
                { rawText: 'food ration' },
            ];

            const result = controller.checkSafety(items);
            expect(result.hasDanger).toBe(true);
            expect(result.criticalItems.length).toBe(1);
            expect(result.criticalItems[0].item.rawText).toBe('wand of cancellation');
            expect(result.suspiciousItems.length).toBe(1);
            expect(result.safe.length).toBe(1);
        });
    });

    // ========================================================================
    // 2. 初回オープン時の空/非空の遷移 (handleInitialActionMenu)
    // ========================================================================

    describe('handleInitialActionMenu (Initial entry)', () => {
        it('中身が空の場合 (Take out なし): "q" で応答して即座に通常ターンへ抜け、空でオープンすること', async () => {
            const mockResolver = { respond: vi.fn() };
            const payload = {
                rawPromptText: 'Do what with your sack? [i or ?*]',
                items: [
                    { charStr: 'i', str: 'Put in' },
                ],
                safeResolver: mockResolver,
            };

            const handled = await controller.handleInitialActionMenu(payload);

            expect(handled).toBe(true);
            expect(controller.isActive()).toBe(true);
            expect(mockResolver.respond).toHaveBeenCalledWith('q');
            expect(contentsManager.getItems()).toEqual([]);
            // IRC querySequenceSilent は呼ばれない（空なので覗き見不要）
            expect(mockInteractive.querySequenceSilent).not.toHaveBeenCalled();
            // イベントが発行されること
            expect(mockCore.emit).toHaveBeenCalledWith('containerTransaction', expect.objectContaining({
                state: 'ACTION_PROMPT',
                contents: [],
                isContainerSessionActive: true,
            }));
        });

        it('中身がある場合 (Take out あり): "o" で初回一覧を取得し ESC で抜けて通常ターンに着地すること', async () => {
            const payload = {
                rawPromptText: 'Do what with your sack? [io or ?*]',
                items: [
                    { charStr: 'i', str: 'Put in' },
                    { charStr: 'o', str: 'Take out' },
                ],
            };

            let capturedRecipe = null;
            mockInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                capturedRecipe = recipe;
                // ハンドラをシミュレート
                const itemSelectHandler = recipe.handlers.find(h => h.match.subCategory === 'CONTAINER_ITEM_SELECT');
                const ctx = {
                    menuItems: [
                        { identifier: 501, charStr: 'a', str: 'a potion of healing', count: 1 },
                        { identifier: 502, charStr: 'b', str: 'a scroll of identify', count: 2 },
                    ],
                };
                const actionResult = itemSelectHandler.action(ctx);
                expect(actionResult).toBe('\x1b'); // 取り出さずにキャンセルして抜ける
                return { success: true };
            });

            const handled = await controller.handleInitialActionMenu(payload);

            expect(handled).toBe(true);
            expect(controller.isActive()).toBe(true);
            expect(capturedRecipe).toBeDefined();
            expect(capturedRecipe.start).toEqual(['o']);
            expect(capturedRecipe.until).toEqual({ type: 'turn_ready' });
            // contentsManager にアイテムが格納されていること
            expect(contentsManager.getItems().length).toBe(2);
            expect(contentsManager.getItems()[0].identifier).toBe(501);
            expect(contentsManager.getItems()[1].identifier).toBe(502);
        });

        it('未識別の鞄 (an empty bag / "Do what with your bag?"): 手持ちアイテムと正確に同定され、letter が設定されて手持ちコンテナとして認識されること', async () => {
            // インベントリに未識別の鞄 { letter: 'g', rawText: 'an empty bag', identifier: 777 } を設定
            mockCore.gkl.inventoryStateManager.getItems = vi.fn(() => [
                { letter: 'a', rawText: 'a +0 dagger', identifier: 101 },
                { letter: 'g', rawText: 'an empty bag', identifier: 777 },
                { letter: 'f', rawText: 'food ration', identifier: 102 },
            ]);

            const mockResolver = { respond: vi.fn() };
            const payload = {
                rawPromptText: 'Do what with your bag? [i or ?*]',
                signal: {
                    id: 'SIGNAL_CONTAINER_ACTION_MENU',
                    subCategory: 'CONTAINER_ACTION_MENU',
                    params: { containerName: 'your bag' },
                },
                items: [
                    { charStr: 'i', str: 'Put in' },
                ],
                safeResolver: mockResolver,
            };

            const handled = await controller.handleInitialActionMenu(payload);

            expect(handled).toBe(true);
            expect(controller.isActive()).toBe(true);
            expect(controller.currentContainer).toBeDefined();
            // 手持ち鞄として letter が 'g' に特定されていること
            expect(controller.currentContainer.letter).toBe('g');
            expect(controller.currentContainer.identifier).toBe(777);
            expect(controller.currentContainer.isFloorContainer).toBe(false);

            // 自己投入ガード (validatePutIn) で開いている bag 自身の投入がブロックされること
            const selfItem = { letter: 'g', rawText: 'an empty bag', identifier: 777 };
            const validation = controller.validatePutIn(selfItem);
            expect(validation.allowed).toBe(false);
            expect(validation.reason).toBe('SELF_CONTAINER');

            // 別のアイテム (food ration) は投入可能であること
            const otherItem = { letter: 'f', rawText: 'food ration', identifier: 102 };
            const otherValidation = controller.validatePutIn(otherItem);
            expect(otherValidation.allowed).toBe(true);
        });
    });

    // ========================================================================
    // 3. 投入（Put In）の事前セーフティガード (validatePutIn)
    // ========================================================================

    describe('validatePutIn (Safety Guard)', () => {
        beforeEach(async () => {
            // 袋 (sack) を開いている状態を作る
            await controller.handleInitialActionMenu({
                rawPromptText: 'Do what with your sack?',
                items: [{ charStr: 'i', str: 'Put in' }],
                safeResolver: { respond: vi.fn() },
            }, { letter: 's', containerName: 'sack' });
        });

        it('開いているコンテナ自身の投入をブロックすること (SELF_CONTAINER)', () => {
            const selfItem = { letter: 's', identifier: 999, rawText: 'the sack' };
            const validation = controller.validatePutIn(selfItem);
            expect(validation.allowed).toBe(false);
            expect(validation.reason).toBe('SELF_CONTAINER');
        });

        it('装備中・着用中アイテムの投入をブロックすること (EQUIPPED)', () => {
            const equippedItem = { letter: 'e', identifier: 301, isWielded: true, rawText: 'a sword' };
            const validation = controller.validatePutIn(equippedItem);
            expect(validation.allowed).toBe(false);
            expect(validation.reason).toBe('EQUIPPED');
        });

        it('Bag of Holding に対する打ち消しの杖投入をブロックすること (BOH_CRITICAL)', () => {
            // BoH を開いた状態に変更
            controller.currentContainer.isBagOfHolding = true;

            const cancelWand = { letter: 'w', onum: 263, rawText: 'wand of cancellation', spe: 1 };
            const validation = controller.validatePutIn(cancelWand);
            expect(validation.allowed).toBe(false);
            expect(validation.reason).toBe('BOH_CRITICAL');
        });

        it('Bag of Holding に対する未識別アイテム投入に警告を発すること (BOH_SUSPICIOUS)', () => {
            controller.currentContainer.isBagOfHolding = true;

            const susWand = { letter: 'u', rawText: 'wooden wand', isSuspicious: true };
            const validation = controller.validatePutIn(susWand);
            expect(validation.allowed).toBe(false);
            expect(validation.valid).toBe(true);
            expect(validation.warning).toBe('BOH_SUSPICIOUS');
        });

        it('通常アイテムの投入を許可すること', () => {
            const food = { letter: 'a', identifier: 101, rawText: 'a +0 dagger' };
            const validation = controller.validatePutIn(food);
            expect(validation.allowed).toBe(true);
            expect(validation.valid).toBe(true);
        });
    });

    // ========================================================================
    // 4. 投入（Put In）時の IRC レシピ実行と 16バイト構造体直接返却
    // ========================================================================

    describe('transferItem (Put In execution)', () => {
        beforeEach(async () => {
            await controller.handleInitialActionMenu({
                rawPromptText: 'Do what with your sack?',
                items: [{ charStr: 'i', str: 'Put in' }],
                safeResolver: { respond: vi.fn() },
            }, { letter: 's', containerName: 'sack' });
        });

        it('危険アイテムの投入は IRC を起動せずに即座にエラー返却されること', async () => {
            controller.currentContainer.isBagOfHolding = true;
            const cancelWand = { letter: 'w', onum: 263, rawText: 'wand of cancellation', spe: 1 };

            const result = await controller.transferItem({
                direction: 'in',
                item: cancelWand,
            });

            expect(result.success).toBe(false);
            expect(result.error.message).toContain('Blocked by safety guard: BOH_CRITICAL');
            expect(mockInteractive.querySequenceSilent).not.toHaveBeenCalled();
        });

        it('正常投入時: レシピが turn_ready まで走り、CONTAINER_ITEM_SELECT が 16バイト構造体を返すこと', async () => {
            const foodItem = { letter: 'f', identifier: 777, rawText: 'a food ration' };
            let capturedRecipe = null;

            mockInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                capturedRecipe = recipe;
                // CONTAINER_ITEM_SELECT ハンドラのシミュレーション
                const handler = recipe.handlers.find(h => h.match.subCategory === 'CONTAINER_ITEM_SELECT');
                const ctx = {
                    menuItems: [
                        { identifier: 777, charStr: 'f', str: 'a food ration', count: 1 },
                    ],
                };
                const selections = handler.action(ctx);
                expect(selections).toEqual([{ identifier: 777, count: 2 }]);
                return { success: true };
            });

            const result = await controller.transferItem({
                direction: 'in',
                item: foodItem,
                quantity: 2,
            });

            expect(result.success).toBe(true);
            expect(capturedRecipe).toBeDefined();
            expect(capturedRecipe.id).toBe('RECIPE_CONTAINER_IN');
            expect(capturedRecipe.until).toEqual({ type: 'turn_ready' });
            // contentsManager にアイテムが追加されていること
            const contents = contentsManager.getItems();
            expect(contents.length).toBe(1);
            expect(contents[0].identifier).toBe(777);
            expect(contents[0].count).toBe(2);
        });

        it('全量投入時 (count: -1 または未指定): select_menu に count: -1 が渡されること', async () => {
            const arrowItem = { letter: 'a', identifier: 888, rawText: '50 arrows' };
            let capturedSelections = null;

            mockInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                const handler = recipe.handlers.find(h => h.match.subCategory === 'CONTAINER_ITEM_SELECT');
                const ctx = {
                    menuItems: [
                        { identifier: 888, charStr: 'a', str: '50 arrows' },
                    ],
                };
                capturedSelections = handler.action(ctx);
                return { success: true };
            });

            const result = await controller.transferItem({
                direction: 'in',
                item: arrowItem,
                count: -1,
            });

            expect(result.success).toBe(true);
            expect(capturedSelections).toEqual([{ identifier: 888, count: -1 }]);
        });
    });

    // ========================================================================
    // 5. 取り出し（Take Out）時の正常取り出しと最後の1個の消滅
    // ========================================================================

    describe('transferItem (Take Out execution)', () => {
        beforeEach(async () => {
            // 初期状態としてアイテムが1個入っているコンテナを開く
            await controller.handleInitialActionMenu({
                rawPromptText: 'Do what with your sack? [io or ?*]',
                items: [{ charStr: 'o', str: 'Take out' }],
            }, { letter: 's', containerName: 'sack' });

            contentsManager.updateFromMenuItems([
                { identifier: 801, charStr: 'a', str: 'a scroll of teleportation', count: 1 },
            ]);
        });

        it('1個のアイテムを取り出した際、中身が0件になり消滅すること', async () => {
            const targetItem = { identifier: 801, charStr: 'a', str: 'a scroll of teleportation', count: 1 };
            let capturedRecipe = null;

            mockInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                capturedRecipe = recipe;
                const handler = recipe.handlers.find(h => h.match.subCategory === 'CONTAINER_ITEM_SELECT');
                const ctx = {
                    menuItems: [
                        { identifier: 801, charStr: 'a', str: 'a scroll of teleportation', count: 1 },
                    ],
                };
                const selections = handler.action(ctx);
                expect(selections).toEqual([{ identifier: 801, count: 1 }]);
                return { success: true };
            });

            const result = await controller.transferItem({
                direction: 'out',
                item: targetItem,
                count: 1,
            });

            expect(result.success).toBe(true);
            expect(capturedRecipe.id).toBe('RECIPE_CONTAINER_OUT');
            expect(capturedRecipe.until).toEqual({ type: 'turn_ready' });
            // 中身から消滅して 0 件になっていること（最後の1個問題の解消保証）
            expect(contentsManager.getItems().length).toBe(0);
        });

        it('金貨を取り出した際、accelerator $ や gold テキストで正しく識別子が同定され取り出せること', async () => {
            contentsManager.updateFromMenuItems([
                { identifier: 9999, accelerator: 36, ch: 36, str: '234 gold pieces', count: 234, glyph: 3886 }
            ]);

            const goldItem = contentsManager.getItems()[0];
            expect(goldItem.letter).toBe('$');

            let capturedSelections = null;
            mockInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                const handler = recipe.handlers.find(h => h.match.subCategory === 'CONTAINER_ITEM_SELECT');
                const ctx = {
                    menuItems: [
                        { identifier: 0, str: 'Coins' },
                        { identifier: 9999, accelerator: 36, ch: 36, str: '234 gold pieces', glyph: 3886 },
                    ],
                };
                capturedSelections = handler.action(ctx);
                return { success: true };
            });

            // 全量取り出し (count: -1)
            const result = await controller.transferItem({
                direction: 'out',
                item: goldItem,
                count: -1,
            });

            expect(result.success).toBe(true);
            expect(capturedSelections).toEqual([{ identifier: 9999, count: -1 }]);
            expect(contentsManager.getItems().length).toBe(0);
        });

        it('手持ちの金貨をコンテナに投入した際、select_menu で金貨が同定され正しく投入されること', async () => {
            const playerGoldItem = {
                letter: '$',
                invlet: '$',
                name: 'gold pieces',
                rawText: '100 gold pieces',
                count: 100,
                isGold: true
            };

            let capturedSelections = null;
            mockInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                const handler = recipe.handlers.find(h => h.match.subCategory === 'CONTAINER_ITEM_SELECT');
                const ctx = {
                    menuItems: [
                        { identifier: 0, str: 'Coins' },
                        { identifier: 12345, accelerator: 36, ch: 36, str: '100 gold pieces', glyph: 3886 },
                        { identifier: 0, str: 'Weapons' },
                        { identifier: 54321, accelerator: 97, ch: 97, str: 'a dagger', glyph: 2000 }
                    ],
                };
                capturedSelections = handler.action(ctx);
                return { success: true };
            });

            const result = await controller.transferItem({
                direction: 'in',
                item: playerGoldItem,
                count: 100,
            });

            expect(result.success).toBe(true);
            expect(capturedSelections).toEqual([{ identifier: 12345, count: 100 }]);
            // contentsManager に金貨が追加されたこと
            const contents = contentsManager.getItems();
            expect(contents.some(it => it.isGold && it.count === 100)).toBe(true);
        });
    });

    // ========================================================================
    // 6. セッション終了 (closeSession)
    // ========================================================================

    describe('closeSession', () => {
        it('セッションを正常に終了し、IDLE イベントを発行すること', async () => {
            await controller.handleInitialActionMenu({
                rawPromptText: 'Do what with your sack?',
                items: [{ charStr: 'i', str: 'Put in' }],
                safeResolver: { respond: vi.fn() },
            }, { letter: 's', containerName: 'sack' });

            expect(controller.isActive()).toBe(true);

            controller.closeSession();

            expect(controller.isActive()).toBe(false);
            expect(mockCore.emit).toHaveBeenCalledWith('containerTransaction', {
                state: 'IDLE',
                isContainerSessionActive: false,
            });
        });
    });

    describe('attach / detach & Signal Subscription', () => {
        it('attach 時に core の signal イベントを購読し、SIGNAL_CONTAINER_ACTION_MENU 受信時に自律起動すること', async () => {
            const listeners = {};
            const testCore = {
                on: vi.fn((evt, fn) => { listeners[evt] = fn; }),
                off: vi.fn((evt, fn) => { if (listeners[evt] === fn) delete listeners[evt]; }),
                emit: vi.fn(),
                interactiveController: {
                    isBusy: vi.fn(() => false),
                    acquireSessionLock: vi.fn(() => true),
                    releaseSessionLock: vi.fn(() => true)
                }
            };

            const autoController = new ContainerController();
            const spyHandle = vi.spyOn(autoController, 'handleInitialActionMenu').mockResolvedValue(true);

            autoController.attach(testCore);
            expect(testCore.on).toHaveBeenCalledWith('signal', expect.any(Function));

            // シグナルを発火
            const payload = {
                signal: { signalId: 'SIGNAL_CONTAINER_ACTION_MENU' },
                subCategory: 'CONTAINER_ACTION_MENU'
            };
            listeners['signal'](payload);

            expect(spyHandle).toHaveBeenCalledWith(payload);

            // detach 後は反応しないこと
            autoController.detach();
            expect(testCore.off).toHaveBeenCalledWith('signal', expect.any(Function));
        });
    });

    describe('8. 箱（large box / chest）の出し入れ・同定テスト（床コンテナおよび手持ちコンテナ）', () => {
        let testCore;
        let testInteractive;
        let controller;

        beforeEach(() => {
            testInteractive = {
                querySequenceSilent: vi.fn().mockResolvedValue({ success: true, buffer: [] }),
                acquireSessionLock: vi.fn(() => true),
                releaseSessionLock: vi.fn(() => true)
            };

            testCore = {
                interactiveController: testInteractive,
                inventoryStateManager: {
                    getItems: () => [
                        { letter: 'a', invlet: 'a', name: 'food ration', identifier: 10, count: 1 },
                        { letter: 'b', invlet: 'b', name: 'large box', identifier: 20, onum: 214, count: 1 }
                    ]
                },
                lastUsedItemLetter: 'a', // 直前に食料を食べたレターが残っている状況を模擬
                on: vi.fn(),
                off: vi.fn()
            };

            controller = new ContainerController({
                core: testCore,
                interactiveController: testInteractive
            });
        });

        it('床の大型箱 (the large box) を開けた際、手持ち箱や lastUsedItemLetter があっても床コンテナと判定されること', async () => {
            const payload = {
                rawPrompt: 'Do what with the large box? [:oibrs nq or ?] (q)',
                signal: {
                    id: 'SIGNAL_CONTAINER_ACTION_MENU',
                    params: { containerName: 'the large box' }
                },
                items: [
                    { charStr: 'o', label: 'Take out' },
                    { charStr: 'i', label: 'Put in' }
                ]
            };

            // 中身取得ハンドラのエミュレート
            testInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                const ctx = {
                    menuItems: [
                        { identifier: 101, charStr: 'a', str: '3 gold pieces' },
                        { identifier: 102, charStr: 'b', str: 'an uncursed dagger' }
                    ]
                };
                const itemHandler = recipe.handlers.find(h => h.match?.subCategory === 'CONTAINER_ITEM_SELECT');
                itemHandler.action(ctx);
                return { success: true, buffer: [] };
            });

            const opened = await controller.handleInitialActionMenu(payload);
            expect(opened).toBe(true);
            expect(controller.currentContainer.isFloorContainer).toBe(true);
            expect(controller.currentContainer.letter).toBeNull();
            expect(controller.currentContainer.cleanName).toBe('large box');
            expect(controller.contentsManager.getItems().length).toBe(2);

            // 取り出し (Take Out) の検証: start が ['#', 'loot'] であること
            const targetItem = controller.contentsManager.getItems()[1]; // dagger
            testInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                expect(recipe.start).toEqual(['#', 'loot']);
                return { success: true, buffer: [] };
            });

            const transferRes = await controller.transferItem({
                direction: 'out',
                item: targetItem
            });
            expect(transferRes.success).toBe(true);
            expect(testInteractive.querySequenceSilent).toHaveBeenCalled();
        });

        it('手持ちの箱 (your large box) を開けた際、手持ち箱のレターと同定され [a, letter] で出し入れされること', async () => {
            const payload = {
                rawPrompt: 'Do what with your large box? [:oibrs nq or ?] (q)',
                signal: {
                    id: 'SIGNAL_CONTAINER_ACTION_MENU',
                    params: { containerName: 'your large box' }
                },
                items: [
                    { charStr: 'o', label: 'Take out' },
                    { charStr: 'i', label: 'Put in' }
                ]
            };

            testInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                const ctx = {
                    menuItems: [{ identifier: 201, charStr: 'a', str: 'a ruby' }]
                };
                const itemHandler = recipe.handlers.find(h => h.match?.subCategory === 'CONTAINER_ITEM_SELECT');
                itemHandler.action(ctx);
                return { success: true, buffer: [] };
            });

            const opened = await controller.handleInitialActionMenu(payload);
            expect(opened).toBe(true);
            expect(controller.currentContainer.isFloorContainer).toBe(false);
            expect(controller.currentContainer.letter).toBe('b');
            expect(controller.currentContainer.identifier).toBe(20);

            // 投入 (Put In) の検証: start が ['a', 'b'] であること
            const putInItem = { letter: 'a', name: 'food ration', identifier: 10, count: 1 };
            testInteractive.querySequenceSilent = vi.fn(async (recipe) => {
                expect(recipe.start).toEqual(['a', 'b']);
                return { success: true, buffer: [] };
            });

            const transferRes = await controller.transferItem({
                direction: 'in',
                item: putInItem
            });
            expect(transferRes.success).toBe(true);
            expect(testInteractive.querySequenceSilent).toHaveBeenCalled();
        });

        it('手持ちの宝箱 (your chest) で修飾名 (an unlocked chest) でも単一所持フォールバックで同定されること', async () => {
            testCore.inventoryStateManager.getItems = () => [
                { letter: 'c', invlet: 'c', name: 'an unlocked chest', identifier: 30, onum: 215, count: 1 }
            ];

            const payload = {
                rawPrompt: 'Do what with your chest? [:oibrs nq or ?] (q)',
                signal: {
                    id: 'SIGNAL_CONTAINER_ACTION_MENU',
                    params: { containerName: 'your chest' }
                },
                items: [{ charStr: 'i', label: 'Put in' }] // 空箱
            };

            const opened = await controller.handleInitialActionMenu(payload);
            expect(opened).toBe(true);
            expect(controller.currentContainer.isFloorContainer).toBe(false);
            expect(controller.currentContainer.letter).toBe('c');
            expect(controller.currentContainer.identifier).toBe(30);
        });

        it('手持ちの箱自身をその箱に投入 (Put In) しようとした場合に自己投入ガードでブロックされること', async () => {
            const payload = {
                rawPrompt: 'Do what with your large box? [:oibrs nq or ?] (q)',
                signal: {
                    id: 'SIGNAL_CONTAINER_ACTION_MENU',
                    params: { containerName: 'your large box' }
                },
                items: [{ charStr: 'i', label: 'Put in' }]
            };

            await controller.handleInitialActionMenu(payload);

            const selfItem = { letter: 'b', invlet: 'b', name: 'large box', identifier: 20, count: 1 };
            const res = await controller.transferItem({
                direction: 'in',
                item: selfItem
            });

            expect(res.success).toBe(false);
            expect(res.error.message).toContain('Blocked by safety guard');
            expect(testInteractive.querySequenceSilent).not.toHaveBeenCalled();
        });
    });

    describe('9. GlyphID による種別管理（isContainer / isBag / isBox）に基づく同定テスト', () => {
        it('修飾名や特殊名称であっても、glyphId (3665) から袋コンテナと同定され、currentContainer にフラグが設定されること', async () => {
            // onum なし、テキストが特殊修飾名、glyphId: 3665 (sack) のみを持つインベントリアイテム
            mockCore.gkl.inventoryStateManager.getItems.mockReturnValue([
                { letter: 'd', rawText: 'an ornate embroidered silk container', glyphId: 3665, identifier: 300 }
            ]);

            const payload = {
                rawPrompt: 'Do what with your bag? [:oibrs nq or ?] (q)',
                signal: {
                    id: 'SIGNAL_CONTAINER_ACTION_MENU',
                    params: { containerName: 'your bag' }
                },
                items: [{ charStr: 'i', label: 'Put in' }]
            };

            const handled = await controller.handleInitialActionMenu(payload);
            expect(handled).toBe(true);

            expect(controller.currentContainer).toBeDefined();
            expect(controller.currentContainer.letter).toBe('d');
            expect(controller.currentContainer.isFloorContainer).toBe(false);
            expect(controller.currentContainer.isContainer).toBe(true);
            expect(controller.currentContainer.isBag).toBe(true);
            expect(controller.currentContainer.isBox).toBe(false);
            expect(controller.currentContainer.onum).toBe(217); // 3665 - 3448 = 217 (SACK)
            expect(controller.currentContainer.glyphId).toBe(3665);
        });

        it('修飾名の箱アイテムであっても、glyphId (3663) から箱コンテナと同定され、currentContainer にフラグが設定されること', async () => {
            mockCore.gkl.inventoryStateManager.getItems.mockReturnValue([
                { letter: 'k', rawText: 'an ancient coffer', glyphId: 3663, identifier: 400 }
            ]);

            const payload = {
                rawPrompt: 'Do what with your chest? [:oibrs nq or ?] (q)',
                signal: {
                    id: 'SIGNAL_CONTAINER_ACTION_MENU',
                    params: { containerName: 'your chest' }
                },
                items: [{ charStr: 'i', label: 'Put in' }]
            };

            const handled = await controller.handleInitialActionMenu(payload);
            expect(handled).toBe(true);

            expect(controller.currentContainer).toBeDefined();
            expect(controller.currentContainer.letter).toBe('k');
            expect(controller.currentContainer.isFloorContainer).toBe(false);
            expect(controller.currentContainer.isContainer).toBe(true);
            expect(controller.currentContainer.isBag).toBe(false);
            expect(controller.currentContainer.isBox).toBe(true);
            expect(controller.currentContainer.onum).toBe(215); // 3663 - 3448 = 215 (CHEST)
            expect(controller.currentContainer.glyphId).toBe(3663);
        });
    });

});


