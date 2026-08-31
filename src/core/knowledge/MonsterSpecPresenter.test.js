import { describe, it, expect } from 'vitest';
import { getAdaptiveMonsterSpecs, getMonsterSpecSummaryStrings } from './MonsterSpecPresenter.js';
import { ALL_MONSTER_KNOWLEDGE_BASE } from './MONSTER_KNOWLEDGE_FULL.js';

describe('MonsterSpecPresenter: フラグ動的スペック・バッジ生成テスト', () => {

    it('コカトリス (monOffset 10) から接触石化・死体石化バッジが動的生成されること', () => {
        const cockatrice = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 10);
        expect(cockatrice).toBeDefined();

        // 日本語スペック
        const specsJa = getAdaptiveMonsterSpecs(cockatrice, { language: 'ja' });
        expect(specsJa.some(s => s.id === 'trait_petrify' && s.label.includes('接触石化'))).toBe(true);
        expect(specsJa.some(s => s.id === 'corpse_hazard_petrify' && s.label.includes('接触石化'))).toBe(true);

        // 英語スペック
        const specsEn = getAdaptiveMonsterSpecs(cockatrice, { language: 'en' });
        expect(specsEn.some(s => s.id === 'trait_petrify' && s.label.includes('Petrification'))).toBe(true);
        expect(specsEn.some(s => s.id === 'corpse_hazard_petrify' && s.label.includes('Petrifies'))).toBe(true);
    });

    it('浮遊目玉 (monOffset 28) から麻痺視線バッジおよび死体テレパシー獲得バッジが動的生成されること', () => {
        const floatingEye = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 28);
        expect(floatingEye).toBeDefined();

        const specsJa = getAdaptiveMonsterSpecs(floatingEye, { language: 'ja' });
        expect(specsJa.some(s => s.id === 'trait_paralysis_gaze' && s.label.includes('麻痺視線'))).toBe(true);
    });

    it('マインドフレア (monOffset 48) から知力吸い/脳食いバッジが動的生成されること', () => {
        const mindFlayer = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 48);
        expect(mindFlayer).toBeDefined();

        const specsJa = getAdaptiveMonsterSpecs(mindFlayer, { language: 'ja' });
        expect(specsJa.some(s => s.id === 'trait_brain_eat' && s.label.includes('知力吸い/脳食い'))).toBe(true);
    });

    it('getMonsterSpecSummaryStrings が図鑑表示用文字列リストを正確に出力すること', () => {
        const cockatrice = ALL_MONSTER_KNOWLEDGE_BASE.find(m => m.monOffset === 10);
        const summariesJa = getMonsterSpecSummaryStrings(cockatrice, { language: 'ja' });
        expect(Array.isArray(summariesJa)).toBe(true);
        expect(summariesJa.length).toBeGreaterThan(0);
        expect(summariesJa.some(str => str.includes('接触石化'))).toBe(true);

        const summariesEn = getMonsterSpecSummaryStrings(cockatrice, { language: 'en' });
        expect(summariesEn.some(str => str.includes('Petrification'))).toBe(true);
    });

    it('手書きテキストが存在しない空のモンスターでも安全にフォールバックサマリーを返すこと', () => {
        const emptyMon = { name: 'generic monster', stats: { hd: 2, ac: 8 } };
        const summaries = getMonsterSpecSummaryStrings(emptyMon, { language: 'ja' });
        expect(summaries.length).toBe(2);
        expect(summaries[0]).toContain('標準的な魔獣');
    });
});
