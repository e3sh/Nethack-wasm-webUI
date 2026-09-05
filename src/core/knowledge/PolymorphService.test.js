import { describe, it, expect } from 'vitest';
import { PolymorphService } from './PolymorphService.js';

describe('PolymorphService', () => {
    const mockTranslationEngine = {
        translateMonster: (en) => {
            const dict = {
                'silver dragon': '銀のドラゴン',
                'gray dragon': '灰色のドラゴン',
                'master lich': 'マスター・リッチ',
                'titan': 'タイタン',
                'xorn': 'ゾーン'
            };
            return dict[en] || en;
        }
    };

    it('should extract polymorph candidates correctly (canPolymorph === true)', () => {
        const service = new PolymorphService({ translationEngine: mockTranslationEngine, language: 'ja' });
        const candidates = service.getPolymorphCandidates();

        expect(candidates.length).toBeGreaterThan(100);
        // 全て canPolymorph が true であること
        for (const mon of candidates) {
            expect(mon.canPolymorph).toBe(true);
        }

        // silver dragon が含まれること
        const silverDragon = candidates.find(m => m.name === 'silver dragon');
        expect(silverDragon).toBeDefined();
        expect(silverDragon.nameJa).toBe('銀のドラゴン');
        expect(silverDragon.displayName).toBe('銀のドラゴン');
    });

    it('should identify armor breaking risk accurately based on NetHack C core rules (breakarm / sliparm)', () => {
        const service = new PolymorphService({ translationEngine: mockTranslationEngine, language: 'ja' });

        // 1. 大型モンスター（ドラゴン）: breakarm (LARGE) -> 鎧破壊
        const dragonRisk = service.checkArmorRisk('silver dragon');
        expect(dragonRisk.willBreakArmor).toBe(true);
        expect(dragonRisk.breaksSuit).toBe(true);
        expect(dragonRisk.severity).toBe('DANGER');

        // 2. 中型・非人型モンスター（xorn）: breakarm (MEDIUM && !humanoid) -> 鎧破壊！
        const xornRisk = service.checkArmorRisk('xorn');
        expect(xornRisk.willBreakArmor).toBe(true);
        expect(xornRisk.breaksSuit).toBe(true);
        expect(xornRisk.breaksShirt).toBe(true);
        expect(xornRisk.dropsCloak).toBe(true);
        expect(xornRisk.severity).toBe('DANGER');
        expect(xornRisk.messageJa).toContain('体型不一致');

        // 3. 中型・人型モンスター（master lich）: 人型かつ中型 -> 防具安全
        const lichRisk = service.checkArmorRisk('master lich');
        expect(lichRisk.willBreakArmor).toBe(false);
        expect(lichRisk.willDropArmor).toBe(false);
        expect(lichRisk.severity).toBe('SAFE');

        // 4. 中型・人型モンスター（vampire lord）: 人型かつ中型 -> 防具安全
        const vampRisk = service.checkArmorRisk('vampire lord');
        expect(vampRisk.willBreakArmor).toBe(false);
        expect(vampRisk.severity).toBe('SAFE');

        // 5. TINY モンスター: sliparm -> 破壊されず脱落
        const tinyRisk = service.checkArmorRisk('TINY');
        expect(tinyRisk.willBreakArmor).toBe(false);
        expect(tinyRisk.willDropArmor).toBe(true);
        expect(tinyRisk.severity).toBe('WARNING');
    });

    it('should provide structured presets with translation', () => {
        const serviceJa = new PolymorphService({ translationEngine: mockTranslationEngine, language: 'ja' });
        const presetsJa = serviceJa.getPresets();

        expect(presetsJa.length).toBeGreaterThanOrEqual(3);
        const combatCategory = presetsJa.find(c => c.categoryKey === 'combat');
        expect(combatCategory).toBeDefined();
        expect(combatCategory.label).toBe('戦闘・防御特化');

        const silverDragonItem = combatCategory.items.find(i => i.nameEn === 'silver dragon');
        expect(silverDragonItem).toBeDefined();
        expect(silverDragonItem.displayName).toBe('銀のドラゴン');
        expect(silverDragonItem.monster).toBeDefined();
        expect(silverDragonItem.monster.armorRisk.willBreakArmor).toBe(true);

        // 英語モードのプリセット
        const serviceEn = new PolymorphService({ translationEngine: mockTranslationEngine, language: 'en' });
        const presetsEn = serviceEn.getPresets();
        const combatEn = presetsEn.find(c => c.categoryKey === 'combat');
        expect(combatEn.label).toBe('Combat & Defense');
        const silverDragonItemEn = combatEn.items.find(i => i.nameEn === 'silver dragon');
        expect(silverDragonItemEn.displayName).toBe('silver dragon');
    });

    it('should search and filter candidates by criteria', () => {
        const service = new PolymorphService({ translationEngine: mockTranslationEngine, language: 'ja' });

        // 和名検索
        const searchLich = service.searchCandidates('マスター');
        expect(searchLich.some(m => m.name === 'master lich')).toBe(true);

        // 英名検索
        const searchDragon = service.searchCandidates('dragon');
        expect(searchDragon.length).toBeGreaterThan(5);

        // 飛行フィルタ
        const flyOnly = service.searchCandidates('', { canFly: true });
        for (const mon of flyOnly) {
            expect(mon.canFly).toBe(true);
        }

        // 手ありフィルタ
        const handsOnly = service.searchCandidates('', { hasHands: true });
        for (const mon of handsOnly) {
            expect(mon.hasHands).toBe(true);
        }

        // 防具安全フィルタ (breakarm が false のもののみ: 人型中型または小型)
        const safeArmorOnly = service.searchCandidates('', { safeArmor: true });
        // xorn は中型だが非人型のため除外されること
        expect(safeArmorOnly.some(m => m.name === 'xorn')).toBe(false);
        // master lich は人型中型のため含まれること
        expect(safeArmorOnly.some(m => m.name === 'master lich')).toBe(true);
        for (const mon of safeArmorOnly) {
            const risk = service.checkArmorRisk(mon);
            expect(risk.willBreakArmor).toBe(false);
        }
    });

    it('should find monster by exact name (bilingual)', () => {
        const service = new PolymorphService({ translationEngine: mockTranslationEngine, language: 'ja' });

        const byEn = service.findMonsterByName('titan');
        expect(byEn).not.toBeNull();
        expect(byEn.name).toBe('titan');

        const byJa = service.findMonsterByName('銀のドラゴン');
        expect(byJa).not.toBeNull();
        expect(byJa.name).toBe('silver dragon');
    });

    it('should sanitize monster names for NetHack C engine (strip curly braces)', () => {
        expect(PolymorphService.cleanMonsterName('vampire leader {vampire lord}')).toBe('vampire lord');
        expect(PolymorphService.cleanMonsterName('dwarf leader {dwarf lord}')).toBe('dwarf lord');
        expect(PolymorphService.cleanMonsterName('silver dragon')).toBe('silver dragon');

        const service = new PolymorphService();
        const mon = service.findMonsterByName('vampire lord');
        expect(mon).not.toBeNull();
        expect(mon.cleanName).toBe('vampire lord');
    });
});
