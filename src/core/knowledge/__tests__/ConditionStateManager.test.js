import { describe, it, expect, beforeEach } from 'vitest';
import { ConditionStateManager } from '../state/ConditionStateManager.js';
import { CONDITION_SEVERITY } from '../data/CONDITION_DEFINITIONS.js';

describe('ConditionStateManager Tests', () => {
    let manager;

    beforeEach(() => {
        manager = new ConditionStateManager();
    });

    describe('resolveCondition', () => {
        it('CDT 状態異常（Stoned, Blind, Confused 等）が正しく解決されること', () => {
            const stoned = manager.resolveCondition('Stoned');
            expect(stoned).not.toBeNull();
            expect(stoned.nameJa).toBe('石化進行中');
            expect(stoned.nameEn).toBe('Petrifying');
            expect(stoned.severity).toBe(CONDITION_SEVERITY.FATAL);

            const blind = manager.resolveCondition('Blind');
            expect(blind).not.toBeNull();
            expect(blind.nameJa).toBe('盲目');
            expect(blind.severity).toBe(CONDITION_SEVERITY.WARNING);
        });

        it('短縮形エイリアス（Stone, Conf, Ill, FoodPois 等）が正規化解決されること', () => {
            const stone = manager.resolveCondition('Stone');
            expect(stone.key).toBe('stoned');

            const conf = manager.resolveCondition('Conf');
            expect(conf.key).toBe('confused');

            const ill = manager.resolveCondition('Ill');
            expect(ill.key).toBe('termill');

            const foodPois = manager.resolveCondition('FoodPois');
            expect(foodPois.key).toBe('foodpoisoning');
        });

        it('空腹度（Hungry, Weak, Starved 等）が正しく解決されること', () => {
            const hungry = manager.resolveCondition('Hungry');
            expect(hungry.nameJa).toBe('空腹');
            expect(hungry.severity).toBe(CONDITION_SEVERITY.INFO);

            const weak = manager.resolveCondition('Weak');
            expect(weak.nameJa).toBe('衰弱');
            expect(weak.severity).toBe(CONDITION_SEVERITY.WARNING);

            const starved = manager.resolveCondition('Starved');
            expect(starved.nameJa).toBe('餓死寸前');
            expect(starved.severity).toBe(CONDITION_SEVERITY.FATAL);
        });

        it('負荷（Burdened, Stressed, Overloaded 等）が正しく解決されること', () => {
            const burdened = manager.resolveCondition('Burdened');
            expect(burdened.nameJa).toBe('負荷');
            expect(burdened.severity).toBe(CONDITION_SEVERITY.WARNING);

            const overloaded = manager.resolveCondition('Overloaded');
            expect(overloaded.nameJa).toBe('限界負荷');
            expect(overloaded.severity).toBe(CONDITION_SEVERITY.FATAL);
        });

        it('Unencumbered は null が返却されること', () => {
            expect(manager.resolveCondition('Unencumbered')).toBeNull();
        });

        it('未知の異常に対して安全な動的フォールバックが生成されること', () => {
            const unknown = manager.resolveCondition('SuperCursed');
            expect(unknown).not.toBeNull();
            expect(unknown.nameJa).toBe('SuperCursed');
            expect(unknown.severity).toBe(CONDITION_SEVERITY.WARNING);
        });
    });

    describe('resolveStatusConditions', () => {
        it('状態異常、空腹度、負荷が統合され、深刻度順（FATAL > WARNING > INFO）にソートされること', () => {
            const status = {
                conditions: ['Blind', 'Stoned'], // Blind: WARNING, Stoned: FATAL
                hunger: 'Hungry',                // Hungry: INFO
                encumbrance: 'Burdened',          // Burdened: WARNING
                cap: 1
            };

            const badges = manager.resolveStatusConditions(status, 'ja');
            expect(badges.length).toBe(4);

            // 1番目は最優先の FATAL (石化)
            expect(badges[0].key).toBe('stoned');
            expect(badges[0].name).toBe('石化進行中');
            expect(badges[0].severity).toBe(CONDITION_SEVERITY.FATAL);
            expect(badges[0].colors.bg).toBe('#dc2626');

            // 2・3番目は WARNING (Blind, Burdened)
            expect(badges[1].severity).toBe(CONDITION_SEVERITY.WARNING);
            expect(badges[2].severity).toBe(CONDITION_SEVERITY.WARNING);

            // 4番目は INFO (Hungry)
            expect(badges[3].key).toBe('hungry');
            expect(badges[3].severity).toBe(CONDITION_SEVERITY.INFO);
        });

        it('英語モード時に英語ラベルおよび英語説明文が返却されること', () => {
            const status = {
                conditions: ['Stoned', 'Confused'],
                hunger: 'Weak'
            };

            const badges = manager.resolveStatusConditions(status, 'en');
            expect(badges[0].key).toBe('stoned');
            expect(badges[0].name).toBe('Petrifying');
            expect(badges[0].label).toBe('🗿Stone');
            expect(badges[0].description).toContain('slowing turning to stone');
        });

        it('状態異常がない場合は空配列が返却されること', () => {
            const status = {
                conditions: [],
                hunger: '',
                encumbrance: 'Unencumbered',
                cap: 0
            };

            const badges = manager.resolveStatusConditions(status, 'ja');
            expect(badges).toEqual([]);
        });
    });
});
