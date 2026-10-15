import { describe, it, expect } from 'vitest';
import {
    ROLE_RANKS_TABLE,
    getRoleRankTable
} from '../../../../src/core/knowledge/data/CHARACTER_KNOWLEDGE_BASE.js';

describe('Official Role Ranks Knowledge Base (ROLE_RANKS_TABLE)', () => {
    const EXPECTED_ROLES = [
        'archeologist',
        'barbarian',
        'caveman',
        'healer',
        'knight',
        'monk',
        'priest',
        'rogue',
        'ranger',
        'samurai',
        'tourist',
        'valkyrie',
        'wizard'
    ];

    const EXPECTED_LEVEL_RANGES = [
        '1-2',
        '3-5',
        '6-9',
        '10-13',
        '14-17',
        '18-21',
        '22-25',
        '26-29',
        '30'
    ];

    it('全13ロールが定義されていること', () => {
        expect(Object.keys(ROLE_RANKS_TABLE).sort()).toEqual(EXPECTED_ROLES.slice().sort());
    });

    it('各ロールが Rank 0〜8 の全9ランクを過不足なく保持していること', () => {
        for (const role of EXPECTED_ROLES) {
            const table = getRoleRankTable(role);
            expect(table).toHaveLength(9);

            table.forEach((entry, idx) => {
                expect(entry.rank).toBe(idx);
                expect(entry.levelRange).toBe(EXPECTED_LEVEL_RANGES[idx]);
                expect(typeof entry.minLevel).toBe('number');
                expect(typeof entry.maxLevel).toBe('number');
                expect(entry.minLevel).toBeLessThanOrEqual(entry.maxLevel);
                expect(typeof entry.titleEn).toBe('string');
                expect(entry.titleEn.length).toBeGreaterThan(0);
                expect(typeof entry.titleJa).toBe('string');
                expect(entry.titleJa.length).toBeGreaterThan(0);
            });
        }
    });

    it('主要ロールの女性形/別名が正確に定義されていること', () => {
        // Valkyrie Rank 3 (Man-at-arms / Woman-at-arms), Rank 6 (Hero / Heroine), Rank 8 (Lord / Lady)
        const valkyrie = getRoleRankTable('valkyrie');
        expect(valkyrie[0].titleEn).toBe('Stripling');
        expect(valkyrie[3].titleFemaleEn).toBe('Woman-at-arms');
        expect(valkyrie[6].titleFemaleEn).toBe('Heroine');
        expect(valkyrie[8].titleFemaleEn).toBe('Lady');

        // Samurai Rank 2 (Ninja / Kunoichi)
        const samurai = getRoleRankTable('samurai');
        expect(samurai[0].titleEn).toBe('Hatamoto');
        expect(samurai[2].titleEn).toBe('Ninja');
        expect(samurai[2].titleFemaleEn).toBe('Kunoichi');
        expect(samurai[8].titleEn).toBe('Shogun');

        // Knight Rank 6 (Chevalier / Chevaliere), Rank 7 (Seignieur / Dame)
        const knight = getRoleRankTable('knight');
        expect(knight[0].titleEn).toBe('Gallant');
        expect(knight[6].titleFemaleEn).toBe('Chevaliere');
        expect(knight[7].titleFemaleEn).toBe('Dame');
        expect(knight[8].titleEn).toBe('Paladin');

        // Priest Rank 3 (Priest / Priestess), Rank 5 (Canon / Canoness), Rank 7 (Patriarch / Matriarch), Rank 8 (High Priest / High Priestess)
        const priest = getRoleRankTable('priest');
        expect(priest[3].titleFemaleEn).toBe('Priestess');
        expect(priest[5].titleFemaleEn).toBe('Canoness');
        expect(priest[7].titleFemaleEn).toBe('Matriarch');
        expect(priest[8].titleFemaleEn).toBe('High Priestess');
    });

    it('getRoleRankTable ヘルパーは大文字小文字を許容し、未知のロールには空配列を返すこと', () => {
        expect(getRoleRankTable('VALKYRIE')).toHaveLength(9);
        expect(getRoleRankTable('Wizard')).toHaveLength(9);
        expect(getRoleRankTable('unknown_role')).toEqual([]);
        expect(getRoleRankTable(null)).toEqual([]);
        expect(getRoleRankTable('')).toEqual([]);
    });
});
