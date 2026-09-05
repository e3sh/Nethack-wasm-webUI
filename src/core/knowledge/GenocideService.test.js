import { describe, it, expect } from 'vitest';
import { GenocideService, MONSTER_CLASS_DEFINITIONS, GENOCIDE_PRESETS } from './GenocideService.js';

describe('GenocideService', () => {
    const service = new GenocideService();

    it('should initialize presets and classes correctly', () => {
        const presets = service.getPresets();
        expect(presets.length).toBeGreaterThan(0);

        const classPresets = service.getPresets('CLASS');
        expect(classPresets.every(p => p.type === 'CLASS')).toBe(true);

        const singlePresets = service.getPresets('SINGLE');
        expect(singlePresets.every(p => p.type === 'SINGLE')).toBe(true);

        const classes = service.getMonsterClasses();
        expect(classes.some(c => c.symbol === 'L')).toBe(true);
        expect(classes.some(c => c.symbol === 'c')).toBe(true);
        expect(classes.some(c => c.symbol === '&')).toBe(true);
    });

    describe('checkSelfGenocide (Self-Genocide Safety Guard)', () => {
        it('should detect lethal danger when human player chooses @ or human', () => {
            const checkAt = service.checkSelfGenocide('@', 'human', 'valkyrie');
            expect(checkAt.isSelf).toBe(true);
            expect(checkAt.dangerLevel).toBe('LETHAL');

            const checkHuman = service.checkSelfGenocide('human', 'human', 'valkyrie');
            expect(checkHuman.isSelf).toBe(true);
            expect(checkHuman.dangerLevel).toBe('LETHAL');
        });

        it('should detect lethal danger when dwarf player chooses h or humanoid', () => {
            const checkH = service.checkSelfGenocide('h', 'dwarf', 'valkyrie');
            expect(checkH.isSelf).toBe(true);
            expect(checkH.dangerLevel).toBe('LETHAL');

            const checkDwarf = service.checkSelfGenocide('dwarf', 'dwarf', 'valkyrie');
            expect(checkDwarf.isSelf).toBe(true);
            expect(checkDwarf.dangerLevel).toBe('LETHAL');
        });

        it('should NOT trigger self-genocide for dwarf when choosing single mind flayer or L', () => {
            const checkL = service.checkSelfGenocide('L', 'dwarf', 'valkyrie');
            expect(checkL.isSelf).toBe(false);
            expect(checkL.dangerLevel).toBe('SAFE');

            const checkMmf = service.checkSelfGenocide('master mind flayer', 'dwarf', 'valkyrie');
            expect(checkMmf.isSelf).toBe(false);
            expect(checkMmf.dangerLevel).toBe('SAFE');
        });

        it('should detect lethal danger when orc chooses o and gnome chooses G', () => {
            const checkOrc = service.checkSelfGenocide('o', 'orc', 'barbarian');
            expect(checkOrc.isSelf).toBe(true);

            const checkGnome = service.checkSelfGenocide('G', 'gnome', 'archeologist');
            expect(checkGnome.isSelf).toBe(true);
        });

        it('should detect lethal danger when player matches role', () => {
            const checkRole = service.checkSelfGenocide('valkyrie', 'human', 'valkyrie');
            expect(checkRole.isSelf).toBe(true);
            expect(checkRole.matchedType).toBe('ROLE');
        });
    });

    describe('suggest', () => {
        it('should find classes and monsters matching query', () => {
            const resultsSymbol = service.suggest('L');
            expect(resultsSymbol.some(r => r.target === 'L')).toBe(true);

            const resultsEn = service.suggest('mind flayer');
            expect(resultsEn.some(r => r.nameEn.toLowerCase().includes('mind flayer'))).toBe(true);
        });

        it('should resolve Japanese names from TranslationEngine dynamically', () => {
            const mockTranslator = {
                translate: (text, lang) => {
                    if (text === 'master lich') return 'マスター・リッチ';
                    if (text === 'cockatrice') return 'コカトリス';
                    return text;
                }
            };
            const svcWithTrans = new GenocideService({ translator: mockTranslator });
            const results = svcWithTrans.suggest('リッチ');
            expect(results.some(r => r.nameJa.includes('リッチ'))).toBe(true);
        });

        it('should filter monsters belonging to a symbol correctly via SSOT', () => {
            const lichMonsters = service.getMonstersBySymbol('L');
            expect(lichMonsters.length).toBeGreaterThan(0);
            expect(lichMonsters.some(m => m.name === 'master lich')).toBe(true);
            expect(lichMonsters.every(m => m.symbol === 'L')).toBe(true);
        });

        it('should suggest class [h] when typing "flayer" or monster name in CLASS mode (Reverse Lookup)', () => {
            const results = service.suggest('flayer', { mode: 'CLASS' });
            expect(results.length).toBeGreaterThan(0);
            const classH = results.find(r => r.target === 'h');
            expect(classH).toBeDefined();
            expect(classH.type).toBe('CLASS');
            expect(classH.symbol).toBe('h');
        });

        it('should suggest exact class symbol when typing 1 character symbol (e.g. "L", "d")', () => {
            const resultsL = service.suggest('L', { mode: 'CLASS' });
            expect(resultsL.length).toBeGreaterThan(0);
            expect(resultsL[0].target).toBe('L');
            expect(resultsL[0].isExact).toBe(true);
            expect(resultsL[0].examples.length).toBeGreaterThan(0);

            // 小文字 d (dog)
            const resultsD = service.suggest('d', { mode: 'CLASS' });
            expect(resultsD.length).toBeGreaterThan(0);
            expect(resultsD[0].target).toBe('d');
        });
    });

    describe('serializeCommand', () => {
        it('should return none for empty or none queries', () => {
            expect(service.serializeCommand('')).toBe('none');
            expect(service.serializeCommand('none')).toBe('none');
            expect(service.serializeCommand('NONE')).toBe('none');
        });

        it('should return trimmed target string for valid choices', () => {
            expect(service.serializeCommand('L')).toBe('L');
            expect(service.serializeCommand('  master mind flayer  ')).toBe('master mind flayer');
        });
    });

    describe('isDangerousGenocide', () => {
        it('should return null for safe choices', () => {
            expect(service.isDangerousGenocide('silver dragon', { playerRace: 'human' })).toBeNull();
            expect(service.isDangerousGenocide('L', { mode: 'CLASS', playerRace: 'human' })).toBeNull();
        });

        it('should detect danger when single mode has 1-char symbol', () => {
            const danger = service.isDangerousGenocide('L', { mode: 'SINGLE' });
            expect(danger).not.toBeNull();
            expect(danger?.isDangerous).toBe(true);
            expect(danger?.dangerLevel).toBe('WARNING');
        });

        it('should detect lethal self-genocide', () => {
            const danger = service.isDangerousGenocide('human', { playerRace: 'human' });
            expect(danger).not.toBeNull();
            expect(danger?.isDangerous).toBe(true);
            expect(danger?.isSelf).toBe(true);
            expect(danger?.dangerLevel).toBe('LETHAL');
        });
    });
});
