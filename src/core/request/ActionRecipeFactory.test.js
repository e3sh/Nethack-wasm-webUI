import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionRecipeFactory } from './ActionRecipeFactory.js';
import { InteractiveRequestController } from './InteractiveRequestController.js';
import { SignalDetector } from '../prompt/SignalDetector.js';

describe('ActionRecipeFactory - 高優先度動的アクションレシピの生成と対話制御', () => {
    let detector;

    beforeEach(() => {
        detector = SignalDetector.createDefault();
    });

    describe('1. レシピ定義の生成検証', () => {
        it('createZapWandRecipe: 杖振りレシピが正しい構造で生成されること', () => {
            const recipe = ActionRecipeFactory.createZapWandRecipe('a', 'DIR_E');
            expect(recipe.id).toBe('RECIPE_ZAP_WAND');
            expect(recipe.start).toEqual(['z', 'a']);
            expect(recipe.handlers).toHaveLength(2);
            expect(recipe.until).toEqual({ type: 'turn_ready' });
            expect(recipe.defaultAction).toBe('\x1b');
        });

        it('createThrowItemRecipe: 投擲レシピが数量・方向ハンドラを持つこと', () => {
            const recipe = ActionRecipeFactory.createThrowItemRecipe('b', 'DIR_NW', 3);
            expect(recipe.id).toBe('RECIPE_THROW_ITEM');
            expect(recipe.start).toEqual(['t', 'b']);
            expect(recipe.handlers).toHaveLength(2);
            expect(recipe.handlers[0].match).toEqual({ signalId: 'SIGNAL_COUNT_PROMPT' });
            expect(recipe.handlers[0].action).toBe('3\r');
            expect(recipe.handlers[1].match).toEqual({ signalId: 'SIGNAL_DIRECTION' });
            expect(recipe.handlers[1].action).toBe('DIR_NW');
        });

        it('createFireAmmoRecipe: 射撃レシピが方向ハンドラを持つこと', () => {
            const recipe = ActionRecipeFactory.createFireAmmoRecipe('DIR_N');
            expect(recipe.id).toBe('RECIPE_FIRE_AMMO');
            expect(recipe.start).toEqual(['f']);
            expect(recipe.handlers[0].match).toEqual({ signalId: 'SIGNAL_DIRECTION' });
            expect(recipe.handlers[0].action).toBe('DIR_N');
        });

        it('createEatFoodRecipe: 食事レシピが確認・ツールハンドラを持つこと', () => {
            const recipe = ActionRecipeFactory.createEatFoodRecipe('c', { tinOpenerLetter: 't' });
            expect(recipe.id).toBe('RECIPE_EAT_FOOD');
            expect(recipe.start).toEqual(['e', 'c']);
            expect(recipe.handlers).toHaveLength(2);
            expect(recipe.handlers[0].match).toEqual({ signalId: 'SIGNAL_CONFIRM_YN' });
            expect(recipe.handlers[1].match).toEqual({ signalId: 'SIGNAL_TOOL_SELECT' });
            expect(recipe.handlers[1].action).toBe('t');
        });

        it('createPrayRecipe: 祈りレシピが確認ハンドラを持つこと', () => {
            const recipe = ActionRecipeFactory.createPrayRecipe({ confirm: true });
            expect(recipe.id).toBe('RECIPE_PRAY');
            expect(recipe.start).toEqual(['#', 'pray']);
            expect(recipe.handlers[0].match).toEqual({ signalId: 'SIGNAL_CONFIRM_YN' });
            expect(recipe.handlers[0].action).toBe('y');
        });

        it('createEngraveElberethRecipe: Elbereth刻みレシピが確認・ツール・文字列ハンドラを持つこと', () => {
            const recipe = ActionRecipeFactory.createEngraveElberethRecipe('-');
            expect(recipe.id).toBe('RECIPE_ENGRAVE_ELBERETH');
            expect(recipe.start).toEqual(['E']);
            expect(recipe.handlers).toHaveLength(3);
            expect(recipe.handlers[0].match).toEqual({ signalId: 'SIGNAL_CONFIRM_YN' });
            expect(recipe.handlers[1].match).toEqual({ signalId: 'SIGNAL_TOOL_SELECT' });
            expect(recipe.handlers[1].action).toBe('-');
            expect(recipe.handlers[2].match).toEqual({ signalId: 'SIGNAL_TEXT_INPUT' });
            expect(recipe.handlers[2].action).toBe('Elbereth\r');
        });

        it('createDropItemRecipe: ドロップレシピが数量ハンドラを持つこと', () => {
            const recipeAll = ActionRecipeFactory.createDropItemRecipe('d', 'all');
            expect(recipeAll.handlers[0].action).toBe('a\r');

            const recipeCount = ActionRecipeFactory.createDropItemRecipe('d', 5);
            expect(recipeCount.handlers[0].action).toBe('5\r');
        });
    });

    describe('2. InteractiveRequestController との対話連携と誤爆防止の検証', () => {
        let driver;
        let controller;
        let sentResponses;

        beforeEach(() => {
            sentResponses = [];
            driver = {
                keyMode: 'numpad',
                on: vi.fn(),
                removeListener: vi.fn(),
                activeResolver: null,
                sendKey: vi.fn(),
                queueSequence: vi.fn()
            };
            controller = new InteractiveRequestController({
                driver,
                signalDetector: detector
            });
        });

        it('射撃レシピ: 矢筒が空で方向プロンプトが出ず通常ターンに復帰した場合、方向キー (8) が送信されないこと (誤爆防止)', async () => {
            const recipe = ActionRecipeFactory.createFireAmmoRecipe('DIR_N');
            const execPromise = controller.querySequenceSilent(recipe);

            // inputRequired のリスナー取得
            const inputRequiredHandler = driver.on.mock.calls.find(c => c[0] === 'inputRequired')[1];

            // 1. 通常ターン (poskey) で 'f' が消費される
            const resolverTurn1 = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                context: 'poskey',
                safeResolver: resolverTurn1
            });
            expect(resolverTurn1.respond).toHaveBeenCalledWith('f');

            // 2. 矢筒が空のため、C コアは方向プロンプトを出さずに次の通常ターン (poskey) に戻る
            const resolverTurn2 = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                context: 'poskey',
                safeResolver: resolverTurn2
            });

            const result = await execPromise;
            expect(result.success).toBe(true);

            // 【重要検証】方向キー 'DIR_N' (NUMkeyでは '8') は送信されず、turn2 は消費されていないこと！
            expect(resolverTurn2.respond).not.toHaveBeenCalled();
            expect(sentResponses).toEqual(['f']);
        });

        it('射撃レシピ: 矢筒に弾があり方向プロンプトが出た場合のみ、DIR_N が送信されて完了すること', async () => {
            const recipe = ActionRecipeFactory.createFireAmmoRecipe('DIR_N');
            const execPromise = controller.querySequenceSilent(recipe);

            const inputRequiredHandler = driver.on.mock.calls.find(c => c[0] === 'inputRequired')[1];

            // 1. 通常ターン (poskey) で 'f' が消費される
            const resolverTurn1 = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                context: 'poskey',
                safeResolver: resolverTurn1
            });
            expect(resolverTurn1.respond).toHaveBeenCalledWith('f');

            // 2. 方向プロンプト (In what direction?) が届く
            const resolverDir = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                category: 'DIRECTION',
                rawPrompt: 'In what direction?',
                safeResolver: resolverDir
            });
            expect(resolverDir.respond).toHaveBeenCalledWith('8');

            // 3. 発射が実行され通常ターン (poskey) に復帰
            const resolverTurn2 = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                context: 'poskey',
                safeResolver: resolverTurn2
            });

            const result = await execPromise;
            expect(result.success).toBe(true);
            expect(sentResponses).toEqual(['f', '8']);
        });

        it('射撃レシピ (実機等価イベントシーケンス): putstr("In what direction?") と poskey の組み合わせで DIR_N が 8 に解決されて送信され完走すること', async () => {
            driver.resolveTokenKey = vi.fn((token) => token === 'DIR_N' ? '8' : token);
            const recipe = ActionRecipeFactory.createFireAmmoRecipe('DIR_N');
            const execPromise = controller.querySequenceSilent(recipe);

            const inputRequiredHandler = driver.on.mock.calls.find(c => c[0] === 'inputRequired')[1];
            const putstrHandler = driver.on.mock.calls.find(c => c[0] === 'putstr')[1];

            // 1. 通常ターン (poskey) で 'f' が消費される
            const resolverTurn1 = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                type: 'poskey',
                context: 'poskey',
                safeResolver: resolverTurn1
            });
            expect(resolverTurn1.respond).toHaveBeenCalledWith('f');

            // 2. 実機 C コアが putstr でプロンプト文面を出力
            putstrHandler({ windowId: 1, text: 'In what direction?' });

            // 3. 実機 C コアが引数なしの生 poskey で方向待機を発行
            const resolverDir = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                type: 'poskey',
                context: 'poskey',
                safeResolver: resolverDir
            });
            // NUMkey で '8' に解決されて送信されること！
            expect(resolverDir.respond).toHaveBeenCalledWith('8');

            // 4. 発射が実行され通常ターン (poskey) に復帰
            const resolverTurn2 = {
                respond: vi.fn((val) => sentResponses.push(val))
            };
            inputRequiredHandler({
                type: 'poskey',
                context: 'poskey',
                safeResolver: resolverTurn2
            });

            const result = await execPromise;
            expect(result.success).toBe(true);
            expect(sentResponses).toEqual(['f', '8']);
            expect(resolverTurn2.respond).not.toHaveBeenCalled();
        });

        it('祈りレシピ: 祈願確認プロンプトが出た場合のみ同意 "y" が送信されること', async () => {
            const recipe = ActionRecipeFactory.createPrayRecipe({ confirm: true });
            const execPromise = controller.querySequenceSilent(recipe);

            const inputRequiredHandler = driver.on.mock.calls.find(c => c[0] === 'inputRequired')[1];

            // 1. '#' 送信
            inputRequiredHandler({ context: 'poskey', safeResolver: { respond: (val) => sentResponses.push(val) } });
            // 2. 'pray' 送信
            inputRequiredHandler({ context: 'getlin', safeResolver: { respond: (val) => sentResponses.push(val) } });

            // 3. "Are you sure you want to pray? [yn]" プロンプト
            const prayResolver = { respond: vi.fn((val) => sentResponses.push(val)) };
            inputRequiredHandler({
                category: 'YN',
                rawPrompt: 'Are you sure you want to pray? [yn]',
                safeResolver: prayResolver
            });
            expect(prayResolver.respond).toHaveBeenCalledWith('y');

            // 4. 通常ターン復帰
            inputRequiredHandler({ context: 'poskey', safeResolver: { respond: (val) => sentResponses.push(val) } });

            const result = await execPromise;
            expect(result.success).toBe(true);
            expect(sentResponses).toEqual(['#', 'pray', 'y']);
        });

        it('食事レシピ: 腐敗死体警告時に forceEat: false の場合は "n" を送信して安全に中止すること', async () => {
            const recipe = ActionRecipeFactory.createEatFoodRecipe('e', { forceEat: false });
            const execPromise = controller.querySequenceSilent(recipe);

            const inputRequiredHandler = driver.on.mock.calls.find(c => c[0] === 'inputRequired')[1];

            // 1. 'e' ➔ 2. 'e' (アイテム文字)
            inputRequiredHandler({ context: 'poskey', safeResolver: { respond: (val) => sentResponses.push(val) } });
            inputRequiredHandler({ category: 'ITEM_SELECT', safeResolver: { respond: (val) => sentResponses.push(val) } });

            // 3. 腐敗警告
            const eatResolver = { respond: vi.fn((val) => sentResponses.push(val)) };
            inputRequiredHandler({
                category: 'YN',
                rawPrompt: 'This corpse smells terrible! Eat it anyway? [yn]',
                safeResolver: eatResolver
            });
            expect(eatResolver.respond).toHaveBeenCalledWith('n');

            // 4. 通常ターン復帰
            inputRequiredHandler({ context: 'poskey', safeResolver: { respond: (val) => sentResponses.push(val) } });

            const result = await execPromise;
            expect(result.success).toBe(true);
            expect(sentResponses).toEqual(['e', 'e', 'n']);
        });
    });
});
