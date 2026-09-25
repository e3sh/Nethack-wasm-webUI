import { describe, it, expect, beforeEach } from 'vitest';
import { ActionSignalResolver } from '../../../../src/core/knowledge/engines/ActionSignalResolver.js';
import { InteractionContext } from '../../../../src/core/knowledge/context/InteractionContext.js';

describe('ActionSignalResolver', () => {
    let resolver;
    let ctx;
    let mockGkl;

    beforeEach(() => {
        mockGkl = {
            inventoryStateManager: {
                items: [],
                getKeyOrLockPick: () => null,
                getPickAxe: () => null,
                getAxe: () => null
            },
            spellStateManager: {
                spells: []
            },
            statusAccessor: {
                getStatus: () => ({ hp: { current: 15, max: 15 } })
            }
        };
        ctx = new InteractionContext(mockGkl);
        resolver = new ActionSignalResolver(mockGkl, { language: 'ja' });
    });

    describe('施錠された箱 (CONTAINER, isLocked=true) のアクション導出', () => {
        it('合鍵を所持している場合、信頼度 1.0 で合鍵解錠アクションと ActionRecipe を生成すること', () => {
            mockGkl.inventoryStateManager.getKeyOrLockPick = () => ({
                invlet: 'k',
                name: 'skeleton key'
            });

            ctx.setFocus({
                type: 'CONTAINER',
                name: 'large box',
                isLocked: true,
                pos: { x: 0, y: 0 }
            }, 'atFeet');

            const actionSig = resolver.resolve(ctx);

            expect(actionSig).not.toBeNull();
            expect(actionSig.signalId).toBe('ACT_CONTAINER_INTERACTION');
            expect(actionSig.target.type).toBe('CONTAINER');
            expect(actionSig.target.isLocked).toBe(true);

            // 推奨アクションの検証
            expect(actionSig.recommendedActions.length).toBeGreaterThan(0);
            const primaryAction = actionSig.recommendedActions[0];
            expect(primaryAction.method).toBe('USE_KEY');
            expect(primaryAction.actionKey).toBe('a');
            expect(primaryAction.toolSlot).toBe('k');
            expect(primaryAction.confidence).toBe(1.0);
            expect(primaryAction.label).toBe('鍵で解錠する');

            // ActionRecipe の検証
            expect(actionSig.actionRecipe).toBeDefined();
            expect(actionSig.actionRecipe.recipeId).toBe('UNLOCK_CONTAINER_WITH_KEY');
            expect(actionSig.actionRecipe.initialSequence).toEqual(['a', 'k', '.']);
            expect(actionSig.warnings.length).toBe(0);
        });

        it('合鍵がなく、ツルハシ等のこじ開け道具がある場合、信頼度 0.6 の FORCE アクションと破損警告を生成すること', () => {
            mockGkl.inventoryStateManager.getPickAxe = () => ({
                invlet: 'p',
                name: 'pick-axe'
            });

            ctx.setFocus({
                type: 'CONTAINER',
                name: 'chest',
                isLocked: true
            }, 'atFeet');

            const actionSig = resolver.resolve(ctx);

            expect(actionSig).not.toBeNull();
            const forceAction = actionSig.recommendedActions.find(a => a.method === 'FORCE');
            expect(forceAction).toBeDefined();
            expect(forceAction.confidence).toBe(0.6);
            expect(forceAction.toolSlot).toBe('p');
            expect(actionSig.warnings.length).toBeGreaterThan(0);
            expect(actionSig.warnings[0]).toContain('破損');
        });

        it('道具が一切ない場合、立ち去る推奨と破壊警告を生成すること', () => {
            ctx.setFocus({
                type: 'CONTAINER',
                name: 'chest',
                isLocked: true
            }, 'atFeet');

            const actionSig = resolver.resolve(ctx);

            expect(actionSig).not.toBeNull();
            const cancelAction = actionSig.recommendedActions.find(a => a.method === 'CANCEL');
            expect(cancelAction).toBeDefined();
            expect(cancelAction.confidence).toBe(0.9);
            expect(actionSig.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('未施錠・解錠済みの箱', () => {
        it('中身を漁る (LOOT) 推奨アクションを生成すること', () => {
            ctx.setFocus({
                type: 'CONTAINER',
                name: 'large box',
                isLocked: false
            }, 'atFeet');

            const actionSig = resolver.resolve(ctx);

            expect(actionSig).not.toBeNull();
            const lootAction = actionSig.recommendedActions[0];
            expect(lootAction.method).toBe('LOOT');
            expect(lootAction.confidence).toBe(1.0);
        });
    });

    describe('施錠された扉 (DOOR, isLocked=true)', () => {
        it('合鍵所持時に合鍵解錠アクションと ActionRecipe を生成すること', () => {
            mockGkl.inventoryStateManager.getKeyOrLockPick = () => ({
                invlet: 'k',
                name: 'key'
            });

            ctx.setFocus({
                type: 'DOOR',
                name: 'iron door',
                isLocked: true,
                direction: 'DIR_E'
            }, 'adjacent');

            const actionSig = resolver.resolve(ctx);

            expect(actionSig).not.toBeNull();
            expect(actionSig.signalId).toBe('ACT_DOOR_INTERACTION');
            const unlockAction = actionSig.recommendedActions[0];
            expect(unlockAction.method).toBe('USE_KEY');
            expect(actionSig.actionRecipe.initialSequence).toEqual(['a', 'k', 'DIR_E']);
        });
    });

    describe('フォーカスなし時の所持品逆引き推測 (仕様 3.4)', () => {
        it('非戦闘中の apply プロンプトで探索道具を優先サジェストすること', () => {
            mockGkl.inventoryStateManager.items = [
                { invlet: 'a', name: 'magic lamp' },
                { invlet: 'b', name: 'skeleton key' },
                { invlet: 'c', name: 'food ration' }
            ];

            ctx.setImmediatePrompt({
                type: 'APPLY',
                prompt: 'What do you want to use? [*]'
            });

            const actionSig = resolver.resolve(ctx);

            expect(actionSig).not.toBeNull();
            expect(actionSig.signalId).toBe('ACT_INVENTORY_INFERENCE');
            expect(actionSig.recommendedActions.length).toBe(2);
            expect(actionSig.recommendedActions.some(a => a.toolSlot === 'b')).toBe(true);
        });

        it('戦闘中の apply プロンプトで緊急アイテム (ポーション/ワンド) を優先サジェストすること', () => {
            mockGkl.inventoryStateManager.items = [
                { invlet: 'a', name: 'skeleton key' },
                { invlet: 'w', name: 'wand of fire' },
                { invlet: 'p', name: 'potion of extra healing' }
            ];

            ctx.combat.inCombat = true;
            ctx.setImmediatePrompt({
                type: 'APPLY',
                prompt: 'What do you want to use? [*]'
            });

            const actionSig = resolver.resolve(ctx);

            expect(actionSig).not.toBeNull();
            expect(actionSig.signalId).toBe('ACT_INVENTORY_INFERENCE');
            expect(actionSig.recommendedActions.length).toBe(2);
            expect(actionSig.recommendedActions.some(a => a.toolSlot === 'w')).toBe(true);
            expect(actionSig.recommendedActions.some(a => a.toolSlot === 'p')).toBe(true);
        });
    });

    describe('多言語対応 (ローカライズ)', () => {
        it('英語設定 (en) の場合に英語のラベルと警告を生成すること', () => {
            resolver.setLanguage('en');
            mockGkl.inventoryStateManager.getKeyOrLockPick = () => ({
                invlet: 'k',
                name: 'skeleton key'
            });

            ctx.setFocus({
                type: 'CONTAINER',
                name: 'large box',
                isLocked: true
            }, 'atFeet');

            const actionSig = resolver.resolve(ctx);
            expect(actionSig.recommendedActions[0].label).toBe('Unlock with key');
        });
    });
});
