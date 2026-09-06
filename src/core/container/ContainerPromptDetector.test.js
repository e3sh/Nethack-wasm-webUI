/**
 * ContainerPromptDetector.test.js
 */
import { describe, it, expect } from 'vitest';
import {
    ContainerPromptDetector,
    ContainerPromptType,
    ContainerAction,
} from './ContainerPromptDetector.js';

describe('ContainerPromptDetector', () => {

    // ========================================================================
    // detect() — 統合判定
    // ========================================================================

    describe('detect()', () => {
        it('should return NONE for null/undefined/empty payload', () => {
            expect(ContainerPromptDetector.detect(null).type).toBe(ContainerPromptType.NONE);
            expect(ContainerPromptDetector.detect(undefined).type).toBe(ContainerPromptType.NONE);
            expect(ContainerPromptDetector.detect({}).type).toBe(ContainerPromptType.NONE);
        });

        it('should detect ACTION_MENU for "Do what with X?"', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Do what with the bag of holding?',
            });
            expect(result.type).toBe(ContainerPromptType.ACTION_MENU);
            expect(result.containerName).toBe('the bag of holding');
        });

        it('should detect ACTION_MENU for empty container prompt', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'The sack is empty.  Do what with it?',
            });
            expect(result.type).toBe(ContainerPromptType.ACTION_MENU);
            expect(result.containerName).toBe('The sack');
        });

        it('should detect CONTAINER_SELECT', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Loot which containers?',
            });
            expect(result.type).toBe(ContainerPromptType.CONTAINER_SELECT);
        });

        it('should detect CATEGORY_SELECT for take out', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Take out what type of objects?',
            });
            expect(result.type).toBe(ContainerPromptType.CATEGORY_SELECT);
            expect(result.direction).toBe('out');
        });

        it('should detect CATEGORY_SELECT for put in', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Put in what type of objects?',
            });
            expect(result.type).toBe(ContainerPromptType.CATEGORY_SELECT);
            expect(result.direction).toBe('in');
        });

        it('should detect ITEM_SELECT for take out', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Take out what?',
            });
            expect(result.type).toBe(ContainerPromptType.ITEM_SELECT);
            expect(result.direction).toBe('out');
        });

        it('should detect ITEM_SELECT for put in', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Put in what?',
            });
            expect(result.type).toBe(ContainerPromptType.ITEM_SELECT);
            expect(result.direction).toBe('in');
        });

        it('should detect CONTENTS_VIEW', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Contents of the bag of holding:',
            });
            expect(result.type).toBe(ContainerPromptType.CONTENTS_VIEW);
        });

        it('should detect CONTENTS_VIEW from payload.lines (display_nhwindow)', () => {
            const result = ContainerPromptDetector.detect({
                lines: [
                    'Contents of the large box:',
                    '',
                    '  a food ration',
                    '  6 uncursed daggers',
                ],
            });
            expect(result.type).toBe(ContainerPromptType.CONTENTS_VIEW);
        });

        it('should detect CONTENTS_VIEW for Japanese translation', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: '大きな箱の中身:',
            });
            expect(result.type).toBe(ContainerPromptType.CONTENTS_VIEW);

            const resultFromLines = ContainerPromptDetector.detect({
                lines: ['袋の中身:', '  食料の配給'],
            });
            expect(resultFromLines.type).toBe(ContainerPromptType.CONTENTS_VIEW);
        });

        it('should detect HELP_TEXT', () => {
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Container actions:',
            });
            expect(result.type).toBe(ContainerPromptType.HELP_TEXT);
        });

        it('should return NONE for unrelated prompts', () => {
            expect(ContainerPromptDetector.detect({ rawPrompt: 'What do you want to eat?' }).type).toBe(ContainerPromptType.NONE);
            expect(ContainerPromptDetector.detect({ rawPrompt: 'In what direction?' }).type).toBe(ContainerPromptType.NONE);
            expect(ContainerPromptDetector.detect({ rawPrompt: 'Really quit?' }).type).toBe(ContainerPromptType.NONE);
        });

        it('should use prompt field as fallback when rawPrompt is missing', () => {
            const result = ContainerPromptDetector.detect({
                prompt: 'Do what with the chest?',
            });
            expect(result.type).toBe(ContainerPromptType.ACTION_MENU);
        });
    });

    // ========================================================================
    // isActionPrompt()
    // ========================================================================

    describe('isActionPrompt()', () => {
        it('should match standard action prompt', () => {
            expect(ContainerPromptDetector.isActionPrompt('Do what with the bag of holding?')).toBe(true);
            expect(ContainerPromptDetector.isActionPrompt('Do what with the chest?')).toBe(true);
            expect(ContainerPromptDetector.isActionPrompt('Do what with the oilskin sack?')).toBe(true);
        });

        it('should match empty container prompt', () => {
            expect(ContainerPromptDetector.isActionPrompt('The sack is empty.  Do what with it?')).toBe(true);
            expect(ContainerPromptDetector.isActionPrompt('The chest is empty. Do what with it?')).toBe(true);
            expect(ContainerPromptDetector.isActionPrompt('The chest is empty.  Do what with it? [:irs nq or ?]')).toBe(true);
            expect(ContainerPromptDetector.isActionPrompt('There is a chest here.  The chest is empty.  Do what with it?')).toBe(true);
        });

        it('should not match unrelated prompts', () => {
            expect(ContainerPromptDetector.isActionPrompt('What do you want to eat?')).toBe(false);
            expect(ContainerPromptDetector.isActionPrompt('')).toBe(false);
            expect(ContainerPromptDetector.isActionPrompt(null)).toBe(false);
        });
    });

    // ========================================================================
    // extractContainerName()
    // ========================================================================

    describe('extractContainerName()', () => {
        it('should extract container name from standard prompt', () => {
            expect(ContainerPromptDetector.extractContainerName('Do what with the bag of holding?')).toBe('the bag of holding');
            expect(ContainerPromptDetector.extractContainerName('Do what with the chest?')).toBe('the chest');
            expect(ContainerPromptDetector.extractContainerName('Do what with a sack?')).toBe('a sack');
        });

        it('should extract container name from empty container prompt', () => {
            expect(ContainerPromptDetector.extractContainerName('The sack is empty.  Do what with it?')).toBe('The sack');
            expect(ContainerPromptDetector.extractContainerName('The chest is empty. Do what with it?')).toBe('The chest');
            expect(ContainerPromptDetector.extractContainerName('The chest is empty.  Do what with it? [:irs nq or ?]')).toBe('The chest');
            expect(ContainerPromptDetector.extractContainerName('There is a chest here.  The chest is empty.  Do what with it?')).toBe('The chest');
        });

        it('should return null for non-matching prompts', () => {
            expect(ContainerPromptDetector.extractContainerName('What do you want?')).toBeNull();
            expect(ContainerPromptDetector.extractContainerName(null)).toBeNull();
        });
    });

    // ========================================================================
    // identifyActionFromMenuItem()
    // ========================================================================

    describe('identifyActionFromMenuItem()', () => {
        it('should identify Look inside', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'Look inside the bag of holding' })).toBe(ContainerAction.LOOK);
        });

        it('should identify take out', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'take something out' })).toBe(ContainerAction.TAKE_OUT);
        });

        it('should identify put in', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'put something in' })).toBe(ContainerAction.PUT_IN);
        });

        it('should identify both (take out then put in)', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'both; take out, then put in' })).toBe(ContainerAction.BOTH);
        });

        it('should identify reversed (put in then take out)', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'both reversed; put in, then take out' })).toBe(ContainerAction.REVERSED);
        });

        it('should identify stash one', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'stash one item into the bag' })).toBe(ContainerAction.STASH);
        });

        it('should identify next container', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'loot next container' })).toBe(ContainerAction.NEXT);
        });

        it('should identify quit/done', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'done' })).toBe(ContainerAction.QUIT);
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'do nothing' })).toBe(ContainerAction.QUIT);
        });

        it('should return null for unrecognized items', () => {
            expect(ContainerPromptDetector.identifyActionFromMenuItem({ rawStr: 'something else' })).toBeNull();
            expect(ContainerPromptDetector.identifyActionFromMenuItem(null)).toBeNull();
        });
    });

    // ========================================================================
    // isInventoryActionMenu()
    // ========================================================================

    describe('isInventoryActionMenu()', () => {
        it('drop, name, throw などのインベントリアクション項目が含まれるメニューを検知すること', () => {
            const inventoryMenuItems = [
                { accelerator: ':', str: 'Look inside the sack' },
                { accelerator: 'i', str: 'put something in' },
                { accelerator: 'd', str: 'drop the sack' },
                { accelerator: 'C', str: 'name the sack' },
            ];
            expect(ContainerPromptDetector.isInventoryActionMenu(inventoryMenuItems)).toBe(true);

            // detect() でも NONE と判定されてコンテナUIが誤爆しないこと
            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Do what with the sack?',
                items: inventoryMenuItems,
            });
            expect(result.type).toBe(ContainerPromptType.NONE);
        });

        it('純粋なコンテナ操作メニュー (use_container) では false を返すこと', () => {
            const containerMenuItems = [
                { accelerator: ':', str: 'Look inside the sack' },
                { accelerator: 'i', str: 'put something in' },
                { accelerator: 'o', str: 'take something out' },
                { accelerator: 'q', str: 'do nothing' },
            ];
            expect(ContainerPromptDetector.isInventoryActionMenu(containerMenuItems)).toBe(false);

            const result = ContainerPromptDetector.detect({
                rawPrompt: 'Do what with the sack?',
                items: containerMenuItems,
            });
            expect(result.type).toBe(ContainerPromptType.ACTION_MENU);
        });
    });
});
