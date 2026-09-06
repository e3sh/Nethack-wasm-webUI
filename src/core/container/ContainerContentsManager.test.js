/**
 * ContainerContentsManager.test.js
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContainerContentsManager, ContainerType } from './ContainerContentsManager.js';

describe('ContainerContentsManager', () => {
    let manager;

    beforeEach(() => {
        manager = new ContainerContentsManager();
    });

    // ========================================================================
    // openContainer()
    // ========================================================================

    describe('openContainer()', () => {
        it('should initialize container info', () => {
            manager.openContainer({ name: 'the bag of holding', onum: 346 });
            expect(manager.containerName).toBe('the bag of holding');
            expect(manager.containerOnum).toBe(346);
            expect(manager.containerType).toBe(ContainerType.BAG_OF_HOLDING);
            expect(manager.items).toEqual([]);
            expect(manager.isKnown).toBe(false);
        });

        it('should detect container type from name', () => {
            manager.openContainer({ name: 'the oilskin sack' });
            expect(manager.containerType).toBe(ContainerType.OILSKIN_SACK);

            manager.openContainer({ name: 'a sack' });
            expect(manager.containerType).toBe(ContainerType.SACK);

            manager.openContainer({ name: 'a chest' });
            expect(manager.containerType).toBe(ContainerType.CHEST);

            manager.openContainer({ name: 'a large box' });
            expect(manager.containerType).toBe(ContainerType.LARGE_BOX);

            manager.openContainer({ name: 'an ice box' });
            expect(manager.containerType).toBe(ContainerType.ICE_BOX);
        });

        it('should detect Japanese container names', () => {
            manager.openContainer({ name: '軽量化の鞄' });
            expect(manager.containerType).toBe(ContainerType.BAG_OF_HOLDING);

            manager.openContainer({ name: '油引きの袋' });
            expect(manager.containerType).toBe(ContainerType.OILSKIN_SACK);
        });

        it('should reset previous state', () => {
            manager.openContainer({ name: 'first bag' });
            manager.items = [{ letter: 'a', rawText: 'item' }];
            manager.isKnown = true;

            manager.openContainer({ name: 'second bag' });
            expect(manager.items).toEqual([]);
            expect(manager.isKnown).toBe(false);
            expect(manager.containerName).toBe('second bag');
        });
    });

    // ========================================================================
    // updateFromMenuItems()
    // ========================================================================

    describe('updateFromMenuItems()', () => {
        it('should parse menu items into container contents', () => {
            const menuItems = [
                { charStr: 'a', rawStr: 'a - a +2 long sword', glyph: 100, onum: 50 },
                { charStr: 'b', rawStr: 'b - 3 potions of healing', glyph: 200, onum: 60 },
            ];

            manager.openContainer({ name: 'a sack' });
            manager.updateFromMenuItems(menuItems);

            expect(manager.items).toHaveLength(2);
            expect(manager.items[0].letter).toBe('a');
            expect(manager.items[0].rawText).toBe('a - a +2 long sword');
            expect(manager.items[0].onum).toBe(50);
            expect(manager.items[1].letter).toBe('b');
            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(false);
        });

        it('should handle empty menu items (empty container)', () => {
            manager.openContainer({ name: 'a sack' });
            manager.updateFromMenuItems([]);

            expect(manager.items).toHaveLength(0);
            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(true);
        });

        it('should handle null/undefined menu items', () => {
            manager.openContainer({ name: 'a sack' });
            manager.updateFromMenuItems(null);

            expect(manager.items).toHaveLength(0);
            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(true);
        });

        it('should extract letter from charStr as number', () => {
            const menuItems = [
                { ch: 97, rawStr: 'a - a potion', glyph: 100, onum: 50 },
            ];

            manager.openContainer({ name: 'a sack' });
            manager.updateFromMenuItems(menuItems);

            expect(manager.items[0].letter).toBe('a');
        });

        it('should skip header lines without valid letter', () => {
            const menuItems = [
                { ch: 0, rawStr: 'Gems', glyph: -1 },
                { charStr: 'a', rawStr: 'a - a diamond', glyph: 100, onum: 50 },
            ];

            manager.openContainer({ name: 'a sack' });
            manager.updateFromMenuItems(menuItems);

            expect(manager.items).toHaveLength(1);
            expect(manager.items[0].letter).toBe('a');
        });
    });

    // ========================================================================
    // updateFromLines()
    // ========================================================================

    describe('updateFromLines()', () => {
        it('should parse English text lines from display_nhwindow into container contents', () => {
            const lines = [
                'Contents of the large box:',
                '',
                '  a food ration',
                '  6 uncursed daggers',
                '  an uncursed sack',
                '  234 gold pieces',
                '  Schroedinger\'s cat!',
            ];

            manager.openContainer({ name: 'large box' });
            manager.updateFromLines(lines);

            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(false);
            expect(manager.items).toHaveLength(5);

            expect(manager.items[0].count).toBe(1);
            expect(manager.items[0].name).toBe('food ration');
            expect(manager.items[0].rawText).toBe('a food ration');

            expect(manager.items[1].count).toBe(6);
            expect(manager.items[1].name).toBe('uncursed daggers');
            expect(manager.items[1].rawText).toBe('6 uncursed daggers');

            expect(manager.items[2].count).toBe(1);
            expect(manager.items[2].name).toBe('uncursed sack');

            expect(manager.items[3].count).toBe(234);
            expect(manager.items[3].name).toBe('gold pieces');

            expect(manager.items[4].count).toBe(1);
            expect(manager.items[4].name).toBe('Schroedinger\'s cat!');
        });

        it('should parse Japanese text lines into container contents', () => {
            const lines = [
                '大きな箱の中身:',
                '',
                '  食料の配給',
                '  6本のダガー',
                '  2個の林檎',
            ];

            manager.openContainer({ name: '大きな箱' });
            manager.updateFromLines(lines);

            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(false);
            expect(manager.items).toHaveLength(3);
            expect(manager.items[0].count).toBe(1);
            expect(manager.items[0].name).toBe('食料の配給');
            expect(manager.items[1].count).toBe(6);
            expect(manager.items[1].name).toBe('ダガー');
            expect(manager.items[2].count).toBe(2);
            expect(manager.items[2].name).toBe('林檎');
        });

        it('should handle empty lines array', () => {
            manager.openContainer({ name: 'large box' });
            manager.updateFromLines([]);

            expect(manager.items).toHaveLength(0);
            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(true);
        });

        it('should handle lines with only header', () => {
            manager.openContainer({ name: 'large box' });
            manager.updateFromLines(['Contents of the large box:', '']);

            expect(manager.items).toHaveLength(0);
            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(true);
        });
    });

    // ========================================================================
    // handleEmptyMessage()
    // ========================================================================

    describe('handleEmptyMessage()', () => {
        it('should recognize "is empty" message', () => {
            manager.openContainer({ name: 'a sack' });
            expect(manager.handleEmptyMessage('The sack is empty.')).toBe(true);
            expect(manager.isEmpty).toBe(true);
            expect(manager.isKnown).toBe(true);
        });

        it('should recognize "is now empty" message', () => {
            manager.openContainer({ name: 'a sack' });
            expect(manager.handleEmptyMessage('The sack is now empty.')).toBe(true);
            expect(manager.isEmpty).toBe(true);
        });

        it('should recognize Japanese empty message', () => {
            expect(manager.handleEmptyMessage('中身は空です。')).toBe(true);
        });

        it('should return false for non-empty messages', () => {
            expect(manager.handleEmptyMessage('You find a potion.')).toBe(false);
        });
    });

    // ========================================================================
    // onItemPutIn() / onItemTakenOut()
    // ========================================================================

    describe('onItemPutIn()', () => {
        it('should add item to contents and set isKnown to true', () => {
            manager.openContainer({ name: 'a sack' });
            manager.onItemPutIn({ letter: 'a', rawText: 'a potion of healing' });
            expect(manager.items).toHaveLength(1);
            expect(manager.isKnown).toBe(true);
            expect(manager.isEmpty).toBe(false);
        });

        it('同一アイテムが重複して投入された場合、2行に増殖せず二重追加を防ぐこと', () => {
            manager.openContainer({ name: 'a sack' });
            manager.onItemPutIn({ letter: 'a', identifier: 501, rawText: 'a food ration', name: 'a food ration' });
            // 同一アイテムを再度投入
            manager.onItemPutIn({ letter: 'a', identifier: 501, rawText: 'a food ration', name: 'a food ration' });
            expect(manager.items).toHaveLength(1);
        });
    });

    describe('updateFromSequenceBuffer()', () => {
        it('should update from menuItems in sequenceBuffer', () => {
            manager.openContainer({ name: 'a sack' });
            const buffer = [
                {
                    items: [
                        { str: 'Comestibles', identifier: 0 },
                        { str: 'a food ration', identifier: 3201216, accelerator: '\0' }
                    ]
                }
            ];
            const updated = manager.updateFromSequenceBuffer(buffer);
            expect(updated).toBe(true);
            expect(manager.items).toHaveLength(1);
            expect(manager.items[0].name).toBe('a food ration');
            expect(manager.isKnown).toBe(true);
        });

        it('should update from lines in sequenceBuffer', () => {
            manager.openContainer({ name: 'large box' });
            const buffer = [
                {
                    lines: [
                        'Contents of the large box:',
                        '  6 uncursed daggers',
                        '  a food ration'
                    ]
                }
            ];
            const updated = manager.updateFromSequenceBuffer(buffer);
            expect(updated).toBe(true);
            expect(manager.items).toHaveLength(2);
            expect(manager.items[0].name).toBe('uncursed daggers');
            expect(manager.items[0].count).toBe(6);
            expect(manager.items[1].name).toBe('food ration');
        });

        it('should handle empty container message in sequenceBuffer', () => {
            manager.openContainer({ name: 'a sack' });
            const buffer = [
                { type: 'putmsg', text: 'The sack is empty.' }
            ];
            const updated = manager.updateFromSequenceBuffer(buffer);
            expect(updated).toBe(true);
            expect(manager.items).toHaveLength(0);
            expect(manager.isEmpty).toBe(true);
            expect(manager.isKnown).toBe(true);
        });
    });

    describe('onItemTakenOut()', () => {
        it('should remove item from contents by letter', () => {
            manager.openContainer({ name: 'a sack' });
            manager.updateFromMenuItems([
                { charStr: 'a', rawStr: 'a - a potion of healing', glyph: 100, onum: 50 },
                { charStr: 'b', rawStr: 'b - a scroll of identify', glyph: 200, onum: 60 },
            ]);
            manager.onItemTakenOut({ letter: 'a' });
            expect(manager.items).toHaveLength(1);
            // 課題③の仕様: 取り出し後に残ったアイテムは連続再採番され 'a' となる
            expect(manager.items[0].letter).toBe('a');
            expect(manager.items[0].name).toContain('scroll of identify');
        });

        it('should remove item from contents by rawText', () => {
            manager.openContainer({ name: 'a sack' });
            manager.updateFromMenuItems([
                { charStr: 'a', rawStr: 'a - a potion of healing', glyph: 100, onum: 50 },
            ]);

            manager.onItemTakenOut({ rawText: 'a - a potion of healing' });
            expect(manager.items).toHaveLength(0);
            expect(manager.isEmpty).toBe(true);
        });
    });

    // ========================================================================
    // onContainerExploded()
    // ========================================================================

    describe('onContainerExploded()', () => {
        it('should clear all container state', () => {
            manager.openContainer({ name: 'the bag of holding', onum: 346 });
            manager.updateFromMenuItems([
                { charStr: 'a', rawStr: 'a - a potion', glyph: 100, onum: 50 },
            ]);

            manager.onContainerExploded();

            expect(manager.containerName).toBeNull();
            expect(manager.containerType).toBe(ContainerType.UNKNOWN);
            expect(manager.containerOnum).toBe(-1);
            expect(manager.items).toHaveLength(0);
            expect(manager.isKnown).toBe(false);
        });
    });

    // ========================================================================
    // closeContainer() / getSnapshot() / isBagOfHolding()
    // ========================================================================

    describe('closeContainer()', () => {
        it('should reset all state', () => {
            manager.openContainer({ name: 'a sack' });
            manager.closeContainer();

            expect(manager.containerName).toBeNull();
            expect(manager.containerType).toBe(ContainerType.UNKNOWN);
            expect(manager.isKnown).toBe(false);
        });
    });

    describe('getSnapshot()', () => {
        it('should return a frozen snapshot', () => {
            manager.openContainer({ name: 'the bag of holding', onum: 346 });
            manager.updateFromMenuItems([
                { charStr: 'a', rawStr: 'a - an item', glyph: 100, onum: 50 },
            ]);

            const snap = manager.getSnapshot();
            expect(snap.containerName).toBe('the bag of holding');
            expect(snap.containerType).toBe(ContainerType.BAG_OF_HOLDING);
            expect(snap.items).toHaveLength(1);
            expect(snap.itemCount).toBe(1);

            // Snapshot items should be a copy
            snap.items.push({ letter: 'z', rawText: 'fake' });
            expect(manager.items).toHaveLength(1);
        });
    });

    describe('isBagOfHolding()', () => {
        it('should return true for BoH', () => {
            manager.openContainer({ name: 'the bag of holding' });
            expect(manager.isBagOfHolding()).toBe(true);
        });

        it('should return false for other containers', () => {
            manager.openContainer({ name: 'a sack' });
            expect(manager.isBagOfHolding()).toBe(false);
        });
    });

    // ========================================================================
    // parseTransferResult()
    // ========================================================================

    describe('parseTransferResult()', () => {
        it('should parse successful put in message', () => {
            const buf = [
                { type: 'putmsg', text: 'You put a dagger into the sack.' }
            ];
            const res = manager.parseTransferResult(buf);
            expect(res.success).toBe(true);
            expect(res.direction).toBe('in');
            expect(res.isFull).toBe(false);
        });

        it('should detect container full / cannot fit message', () => {
            const buf = [
                { type: 'putmsg', text: "It doesn't fit." }
            ];
            const res = manager.parseTransferResult(buf);
            expect(res.isFull).toBe(true);
            expect(res.success).toBe(false);
        });

        it('should parse successful take out message', () => {
            const buf = [
                { type: 'putmsg', text: 'You take a potion of healing out of the sack.' }
            ];
            const res = manager.parseTransferResult(buf);
            expect(res.success).toBe(true);
            expect(res.direction).toBe('out');
        });

        it('should handle empty or non-array buffer safely', () => {
            const res = manager.parseTransferResult([]);
            expect(res.success).toBe(false);
            expect(res.direction).toBeNull();
        });
    });

    // ========================================================================
    // hasCategoryMenu()
    // ========================================================================

    describe('hasCategoryMenu()', () => {
        it('should detect category menu from prompt text', () => {
            const buf = [
                { type: 'select_menu', prompt: 'Put in what type of objects?' }
            ];
            expect(manager.hasCategoryMenu(buf)).toBe(true);
        });

        it('should detect category menu from menu items containing All types', () => {
            const buf = [
                { items: [{ str: 'All types', identifier: -2 }] }
            ];
            expect(manager.hasCategoryMenu(buf)).toBe(true);
        });

        it('should return false when category menu is skipped', () => {
            const buf = [
                { prompt: 'Put in what?' }
            ];
            expect(manager.hasCategoryMenu(buf)).toBe(false);
        });
    });
});

