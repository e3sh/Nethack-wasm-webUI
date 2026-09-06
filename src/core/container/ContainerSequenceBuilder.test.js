import { describe, it, expect } from 'vitest';
import { ContainerSequenceBuilder } from './ContainerSequenceBuilder.js';
import { DangerLevel } from './ContainerSafetyGuard.js';

describe('ContainerSequenceBuilder', () => {
    const builder = new ContainerSequenceBuilder();

    describe('validatePutInItems', () => {
        it('装備中アイテムを除外すること', () => {
            const container = { letter: 'e', name: 'sack' };
            const items = [
                { letter: 'a', name: 'dagger', isWielded: true },
                { letter: 'b', name: 'leather armor', isWorn: true },
                { letter: 'c', name: 'arrow', isQuivered: true },
                { letter: 'd', name: 'food ration' },
            ];

            const result = builder.validatePutInItems(container, items);
            expect(result.validItems.length).toBe(1);
            expect(result.validItems[0].letter).toBe('d');
            expect(result.excludedItems.length).toBe(3);
            expect(result.excludedItems.map(e => e.reason)).toEqual(['EQUIPPED', 'EQUIPPED', 'EQUIPPED']);
        });

        it('コンテナ自身を除外すること', () => {
            const container = { letter: 'e', onum: 100, name: 'sack' };
            const items = [
                { letter: 'e', onum: 100, name: 'sack' },
                { letter: 'f', onum: 101, name: 'apple' },
            ];

            const result = builder.validatePutInItems(container, items);
            expect(result.validItems.length).toBe(1);
            expect(result.validItems[0].letter).toBe('f');
            expect(result.excludedItems[0].reason).toBe('SELF_CONTAINER');
        });

        it('Bag of Holding に対して CRITICAL な危険物をハード除外すること', () => {
            const container = { letter: 'e', isBagOfHolding: true, name: 'bag of holding' };
            const items = [
                { letter: 'w', name: 'wand of cancellation' },
                { letter: 'b', name: 'bag of tricks' },
                { letter: 'f', name: 'food ration' },
            ];

            const result = builder.validatePutInItems(container, items);
            expect(result.validItems.length).toBe(1);
            expect(result.validItems[0].letter).toBe('f');
            expect(result.excludedItems.length).toBe(2);
            expect(result.excludedItems.map(e => e.reason)).toEqual(['BOH_CRITICAL', 'BOH_CRITICAL']);
        });

        it('Bag of Holding に対して SUSPICIOUS なアイテムは通常除外され、allowSuspicious 指定時のみ通ること', () => {
            const container = { letter: 'e', isBagOfHolding: true, name: 'bag of holding' };
            const items = [
                { letter: 'w', name: 'silver wand', identification: { isUnidentified: true } }, // 未識別の杖
                { letter: 'f', name: 'food ration' },
            ];

            const res1 = builder.validatePutInItems(container, items, { allowSuspicious: false });
            expect(res1.validItems.length).toBe(1);
            expect(res1.validItems[0].letter).toBe('f');
            expect(res1.excludedItems[0].reason).toBe('BOH_SUSPICIOUS');

            const res2 = builder.validatePutInItems(container, items, { allowSuspicious: true });
            expect(res2.validItems.length).toBe(2);
        });
    });

    describe('buildPutInSequence', () => {
        it('単一アイテムの安全な投入シーケンスを生成すること (All types 含む)', () => {
            const container = { letter: 'e', name: 'sack' };
            const items = [
                { letter: 'f', name: 'food ration' },
            ];

            const { sequence, validItems } = builder.buildPutInSequence(container, items);
            expect(sequence).toEqual(['a', 'e', 'i', 'a', 'f']);
            expect(validItems.length).toBe(1);
        });

        it('複数アイテムの一括投入シーケンスを生成すること (menuSelectionToken 含む)', () => {
            const container = { letter: 'e', name: 'sack' };
            const items = [
                { letter: 'f', identifier: 1001, name: 'food ration' },
                { letter: 'g', identifier: 1002, name: 'apple' },
            ];

            const { sequence, validItems } = builder.buildPutInSequence(container, items);
            expect(sequence).toEqual([
                'a', 'e', 'i', 'a',
                [
                    { identifier: 1001, count: -1 },
                    { identifier: 1002, count: -1 }
                ]
            ]);
            expect(validItems.length).toBe(2);
        });

        it('全アイテムが除外された場合は null を返すこと', () => {
            const container = { letter: 'e', name: 'sack' };
            const items = [
                { letter: 'a', name: 'dagger', isWielded: true },
            ];

            const { sequence, validItems, excludedItems } = builder.buildPutInSequence(container, items);
            expect(sequence).toBeNull();
            expect(validItems.length).toBe(0);
            expect(excludedItems.length).toBe(1);
        });
    });

    describe('buildLookSequence', () => {
        it('中身閲覧シーケンスを生成すること (手持ちコンテナ: o + a + ESC)', () => {
            const seq = builder.buildLookSequence('e');
            expect(seq).toEqual(['a', 'e', 'o', 'a', '\x1b']);
        });

        it('中身閲覧シーケンスを生成すること (床コンテナ / 箱: #loot + . + o + a + ESC)', () => {
            const seq = builder.buildLookSequence({ isFloorContainer: true, name: 'chest' });
            expect(seq).toEqual(['#', 'loot', '\r', '.', 'o', 'a', '\x1b']);
        });
    });

    describe('getContainerOpenPrefix', () => {
        it('手持ちコンテナの場合は [a, letter] を返すこと', () => {
            expect(builder.getContainerOpenPrefix('f')).toEqual(['a', 'f']);
            expect(builder.getContainerOpenPrefix({ letter: 'f' })).toEqual(['a', 'f']);
        });

        it('床コンテナまたは letter がない場合は [#, loot, \\r, .] を返すこと', () => {
            expect(builder.getContainerOpenPrefix({ isFloorContainer: true })).toEqual(['#', 'loot', '\r', '.']);
            expect(builder.getContainerOpenPrefix({ letter: '.' })).toEqual(['#', 'loot', '\r', '.']);
            expect(builder.getContainerOpenPrefix(null)).toEqual(['#', 'loot', '\r', '.']);
        });

        it('同一マスに複数コンテナが存在する場合は targetLetter を付与すること', () => {
            expect(builder.getContainerOpenPrefix({ isFloorContainer: true, targetLetter: 'b' })).toEqual(['#', 'loot', '\r', '.', 'b']);
        });
    });

    describe('buildItemSelectionToken', () => {
        it('単一アイテムの場合はレター文字列を返すこと', () => {
            expect(builder.buildItemSelectionToken([{ letter: 'f' }])).toBe('f');
        });

        it('複数アイテムの場合は identifier/count 配列トークンを返すこと', () => {
            const token = builder.buildItemSelectionToken([
                { letter: 'a', identifier: 101, count: 2 },
                { letter: 'b', identifier: 102 }
            ]);
            expect(token).toEqual([
                { identifier: 101, count: 2 },
                { identifier: 102, count: -1 }
            ]);
        });
    });

    describe('buildTakeOutSequence', () => {
        it('単一アイテムの取り出しシーケンスを生成すること', () => {
            const container = { letter: 'e' };
            const items = [{ letter: 'a' }];
            const { sequence } = builder.buildTakeOutSequence(container, items);
            expect(sequence).toEqual(['a', 'e', 'o', 'a', 'a']);
        });

        it('複数アイテムの一括取り出しシーケンスを生成すること', () => {
            const container = { letter: 'e' };
            const items = [{ letter: 'a', identifier: 201 }, { letter: 'b', identifier: 202 }];
            const { sequence } = builder.buildTakeOutSequence(container, items);
            expect(sequence).toEqual([
                'a', 'e', 'o', 'a',
                [
                    { identifier: 201, count: -1 },
                    { identifier: 202, count: -1 }
                ]
            ]);
        });
    });
});

