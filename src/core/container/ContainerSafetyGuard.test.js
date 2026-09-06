/**
 * ContainerSafetyGuard.test.js
 */
import { describe, it, expect } from 'vitest';
import { ContainerSafetyGuard, DangerLevel } from './ContainerSafetyGuard.js';

const ONUMS = ContainerSafetyGuard.DANGEROUS_ONUMS;

const bohContainer = { name: 'the bag of holding', onum: ONUMS.BAG_OF_HOLDING };
const sackContainer = { name: 'the sack', onum: 999 };

describe('ContainerSafetyGuard', () => {
    let guard;

    beforeEach(() => {
        guard = new ContainerSafetyGuard();
    });

    // ========================================================================
    // isBagOfHolding()
    // ========================================================================

    describe('isBagOfHolding()', () => {
        it('should identify BoH by onum', () => {
            expect(guard.isBagOfHolding({ onum: ONUMS.BAG_OF_HOLDING })).toBe(true);
        });

        it('should identify BoH by English text', () => {
            expect(guard.isBagOfHolding({ name: 'a blessed bag of holding' })).toBe(true);
        });

        it('should identify BoH by Japanese text', () => {
            expect(guard.isBagOfHolding({ name: '軽量化の鞄' })).toBe(true);
        });

        it('should not identify sack as BoH', () => {
            expect(guard.isBagOfHolding({ name: 'a sack', onum: 999 })).toBe(false);
        });

        it('should return false for null', () => {
            expect(guard.isBagOfHolding(null)).toBe(false);
        });
    });

    // ========================================================================
    // assessItem() — 個別アイテム危険度判定
    // ========================================================================

    describe('assessItem()', () => {

        // ---------- コンテナが BoH でない場合 ----------

        it('should return SAFE if container is not BoH', () => {
            const result = guard.assessItem(
                { onum: ONUMS.WAN_CANCELLATION, rawText: 'a wand of cancellation (0:3)' },
                sackContainer
            );
            expect(result.level).toBe(DangerLevel.SAFE);
        });

        // ---------- Wand of Cancellation ----------

        it('should return CRITICAL for WAN_CANCELLATION with charges in BoH', () => {
            const result = guard.assessItem(
                { onum: ONUMS.WAN_CANCELLATION, rawText: 'a wand of cancellation (0:5)' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
            expect(result.reason).toContain('打ち消しの杖');
        });

        it('should return DISCHARGED for WAN_CANCELLATION with 0 charges', () => {
            const result = guard.assessItem(
                { onum: ONUMS.WAN_CANCELLATION, rawText: 'a wand of cancellation (0:0)' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.DISCHARGED);
        });

        it('should return CRITICAL for WAN_CANCELLATION without charge info (assume charged)', () => {
            const result = guard.assessItem(
                { onum: ONUMS.WAN_CANCELLATION, rawText: 'a wand of cancellation' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
        });

        // ---------- Bag of Holding in Bag of Holding ----------

        it('should return CRITICAL for BAG_OF_HOLDING into BoH', () => {
            const result = guard.assessItem(
                { onum: ONUMS.BAG_OF_HOLDING, rawText: 'a bag of holding' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
            expect(result.reason).toContain('Bag of Holding');
        });

        // ---------- Bag of Tricks ----------

        it('should return CRITICAL for BAG_OF_TRICKS with charges in BoH', () => {
            const result = guard.assessItem(
                { onum: ONUMS.BAG_OF_TRICKS, rawText: 'a bag of tricks (0:12)' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
        });

        it('should return DISCHARGED for BAG_OF_TRICKS with 0 charges', () => {
            const result = guard.assessItem(
                { onum: ONUMS.BAG_OF_TRICKS, rawText: 'a bag of tricks (0:0)' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.DISCHARGED);
        });

        // ---------- テキストフォールバック (onum 不明) ----------

        it('should detect WAN_CANCELLATION by English text when onum is unknown', () => {
            const result = guard.assessItem(
                { onum: -1, rawText: 'a wand of cancellation (0:3)' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
        });

        it('should detect WAN_CANCELLATION by Japanese text', () => {
            const result = guard.assessItem(
                { onum: -1, rawText: '打ち消しの杖 (0:5)' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
        });

        it('should detect bag of holding by English text when onum is unknown', () => {
            const result = guard.assessItem(
                { onum: -1, rawText: 'a blessed bag of holding' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
        });

        it('should detect bag of tricks by Japanese text when onum is unknown', () => {
            const result = guard.assessItem(
                { onum: -1, rawText: 'いたずらの袋 (0:8)' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.CRITICAL);
        });

        // ---------- 未識別アイテムの疑義判定 ----------

        it('should return SUSPICIOUS for unidentified wand', () => {
            const result = guard.assessItem(
                { onum: -1, rawText: 'a long wand', identification: { isUnidentified: true } },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.SUSPICIOUS);
            expect(result.reason).toContain('打ち消しの杖');
        });

        it('should return SUSPICIOUS for unidentified bag', () => {
            const result = guard.assessItem(
                { onum: -1, rawText: 'a bag', identification: { isUnidentified: true } },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.SUSPICIOUS);
        });

        it('should NOT be suspicious for identified non-dangerous wand', () => {
            const result = guard.assessItem(
                { onum: 999, rawText: 'a wand of fire (0:5)', identification: { isUnidentified: false } },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.SAFE);
        });

        it('should NOT be suspicious for oilskin sack (known safe bag)', () => {
            const result = guard.assessItem(
                { onum: -1, rawText: 'an oilskin sack', identification: { isUnidentified: true } },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.SAFE);
        });

        // ---------- 安全なアイテム ----------

        it('should return SAFE for normal items', () => {
            const result = guard.assessItem(
                { onum: 100, rawText: 'a +2 long sword' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.SAFE);
        });

        it('should return SAFE for potions', () => {
            const result = guard.assessItem(
                { onum: 200, rawText: 'a potion of healing' },
                bohContainer
            );
            expect(result.level).toBe(DangerLevel.SAFE);
        });
    });

    // ========================================================================
    // assessItems() — 一括判定
    // ========================================================================

    describe('assessItems()', () => {
        it('should classify multiple items correctly', () => {
            const items = [
                { onum: ONUMS.WAN_CANCELLATION, rawText: 'a wand of cancellation (0:5)' },
                { onum: 100, rawText: 'a +2 long sword' },
                { onum: -1, rawText: 'a marble wand', identification: { isUnidentified: true } },
                { onum: ONUMS.BAG_OF_TRICKS, rawText: 'a bag of tricks (0:0)' },
            ];

            const result = guard.assessItems(items, bohContainer);
            expect(result.critical).toHaveLength(1);
            expect(result.safe).toHaveLength(1);
            expect(result.suspicious).toHaveLength(1);
            expect(result.discharged).toHaveLength(1);
            expect(result.hasDanger).toBe(true);
        });

        it('should return hasDanger=false when all items are safe', () => {
            const items = [
                { onum: 100, rawText: 'a +2 long sword' },
                { onum: 200, rawText: 'a potion of healing' },
            ];

            const result = guard.assessItems(items, bohContainer);
            expect(result.hasDanger).toBe(false);
            expect(result.safe).toHaveLength(2);
        });

        it('should handle empty array', () => {
            const result = guard.assessItems([], bohContainer);
            expect(result.hasDanger).toBe(false);
            expect(result.safe).toHaveLength(0);
        });
    });

    // ========================================================================
    // filterDangerousItems()
    // ========================================================================

    describe('filterDangerousItems()', () => {
        it('should filter out critical items', () => {
            const woc = { onum: ONUMS.WAN_CANCELLATION, rawText: 'a wand of cancellation (0:5)' };
            const sword = { onum: 100, rawText: 'a +2 long sword' };
            const items = [woc, sword];

            const result = guard.filterDangerousItems(items, bohContainer);
            expect(result.filteredItems).toHaveLength(1);
            expect(result.filteredItems[0]).toBe(sword);
            expect(result.blockedItems).toHaveLength(1);
        });

        it('should optionally filter suspicious items', () => {
            const suspiciousWand = { onum: -1, rawText: 'a maple wand', identification: { isUnidentified: true } };
            const sword = { onum: 100, rawText: 'a +2 long sword' };
            const items = [suspiciousWand, sword];

            const result = guard.filterDangerousItems(items, bohContainer, { blockSuspicious: true });
            expect(result.filteredItems).toHaveLength(1);
            expect(result.filteredItems[0]).toBe(sword);
        });

        it('should keep suspicious items when blockSuspicious is false', () => {
            const suspiciousWand = { onum: -1, rawText: 'a maple wand', identification: { isUnidentified: true } };
            const sword = { onum: 100, rawText: 'a +2 long sword' };
            const items = [suspiciousWand, sword];

            const result = guard.filterDangerousItems(items, bohContainer, { blockSuspicious: false });
            expect(result.filteredItems).toHaveLength(2);
        });
    });

    // ========================================================================
    // _extractCharges()
    // ========================================================================

    describe('_extractCharges()', () => {
        it('should extract charges from "(0:N)" pattern', () => {
            expect(guard._extractCharges('a wand of cancellation (0:5)')).toBe(5);
            expect(guard._extractCharges('a wand of cancellation (0:0)')).toBe(0);
            expect(guard._extractCharges('a bag of tricks (0:12)')).toBe(12);
        });

        it('should return null when no charge info', () => {
            expect(guard._extractCharges('a wand of cancellation')).toBeNull();
            expect(guard._extractCharges('')).toBeNull();
            expect(guard._extractCharges(null)).toBeNull();
        });
    });
});
