import { describe, it, expect } from 'vitest';
import { 
    RACE_KNOWLEDGE_MAP, 
    ROLE_KNOWLEDGE_MAP, 
    ALIGNMENT_KNOWLEDGE_MAP,
    GENDER_KNOWLEDGE_MAP,
    resolveRaceKey, 
    resolveRoleKey, 
    resolveAlignmentKey,
    resolveGenderKey,
    getRoleKnowledge,
    getRaceKnowledge,
    getAlignmentKnowledge,
    getGenderKnowledge,
    getCharacterBadges,
    calculateInnateResistances 
} from "../data/CHARACTER_KNOWLEDGE_BASE.js";
import { 
    TERRAIN_KNOWLEDGE_MAP, 
    getTerrainEntryByCmap, 
    getTerrainEntryByKey 
} from "../data/TERRAIN_KNOWLEDGE_BASE.js";
import { ALL_MONSTER_KNOWLEDGE_BASE, MONSTER_KNOWLEDGE_MAP } from "../data/MONSTER_KNOWLEDGE_FULL.js";
import { OBJECT_KNOWLEDGE_MAP } from "../data/OBJECT_KNOWLEDGE_FULL.js";
import { StructuredKnowledgeEngine } from "../engines/StructuredKnowledgeEngine.js";

describe('GKL SSOT Phase 1 - Knowledge Infrastructure Tests', () => {
    describe('CHARACTER_KNOWLEDGE_BASE (Official NetHack C source attrib.c compliance)', () => {
        it('should correctly resolve race and role keys from various forms', () => {
            expect(resolveRaceKey('elf')).toBe('elf');
            expect(resolveRaceKey('エルフ')).toBe('elf');
            expect(resolveRaceKey('Dwarf')).toBe('dwarf');
            expect(resolveRaceKey('ドワーフ')).toBe('dwarf');
            expect(resolveRaceKey('Orcish')).toBe('orc');

            expect(resolveRoleKey('val')).toBe('valkyrie');
            expect(resolveRoleKey('Valkyrie')).toBe('valkyrie');
            expect(resolveRoleKey('ワルキューレ')).toBe('valkyrie');
            expect(resolveRoleKey('Monk')).toBe('monk');
            expect(resolveRoleKey('修道士')).toBe('monk');
            expect(resolveRoleKey('wiz')).toBe('wizard');
        });

        it('should calculate deterministic innate resistances according to level progression', () => {
            // Elf: Level 1 grants infravision, Level 4 grants sleep resistance
            const elfLvl1 = calculateInnateResistances('elf', 'wizard', 1);
            expect(elfLvl1.infravision).toBe(true);
            expect(elfLvl1.sleep).toBeUndefined();

            const elfLvl4 = calculateInnateResistances('elf', 'wizard', 4);
            expect(elfLvl4.sleep).toBe(true);

            // Valkyrie: Level 1 grants cold, Level 7 grants speed (fast)
            const valLvl1 = calculateInnateResistances('human', 'valkyrie', 1);
            expect(valLvl1.cold).toBe(true);
            expect(valLvl1.fast).toBeUndefined();

            const valLvl7 = calculateInnateResistances('human', 'valkyrie', 7);
            expect(valLvl7.cold).toBe(true);
            expect(valLvl7.fast).toBe(true);

            // Monk: Level 1 fast, sleep, seeInvis; Level 3 poison; Level 15 shock
            const monkLvl1 = calculateInnateResistances('human', 'monk', 1);
            expect(monkLvl1.fast).toBe(true);
            expect(monkLvl1.sleep).toBe(true);
            expect(monkLvl1.poison).toBeUndefined();

            const monkLvl3 = calculateInnateResistances('human', 'monk', 3);
            expect(monkLvl3.poison).toBe(true);

            const monkLvl11 = calculateInnateResistances('human', 'monk', 11);
            expect(monkLvl11.fast).toBe(true);
            expect(monkLvl11.sleep).toBe(true);
            expect(monkLvl11.poison).toBe(true);
            expect(monkLvl11.shock).toBeUndefined();

            const monkLvl15 = calculateInnateResistances('human', 'monk', 15);
            expect(monkLvl15.shock).toBe(true);

            // Orc: Level 1 grants poison resistance
            const orcLvl1 = calculateInnateResistances('orc', 'barbarian', 1);
            expect(orcLvl1.poison).toBe(true);
        });

        it('should handle unknown race or role gracefully without throwing', () => {
            const unknownRes = calculateInnateResistances('UnknownRace', 'UnknownRole', 10);
            expect(typeof unknownRes).toBe('object');
            expect(Object.keys(unknownRes).length).toBe(0);
        });

        it('should verify official NetHack role.c race and alignment constraints across all 13 roles', () => {
            // Arc: human, dwarf, gnome / lawful, neutral / male, female
            const arc = ROLE_KNOWLEDGE_MAP.archeologist;
            expect(arc.allowedRaces).toEqual(['human', 'dwarf', 'gnome']);
            expect(arc.allowedAlignments).toEqual(['lawful', 'neutral']);
            expect(arc.allowedGenders).toEqual(['male', 'female']);

            // Bar: human, orc / neutral, chaotic
            const bar = ROLE_KNOWLEDGE_MAP.barbarian;
            expect(bar.allowedRaces).toEqual(['human', 'orc']);
            expect(bar.allowedAlignments).toEqual(['neutral', 'chaotic']);

            // Cav: human, dwarf, gnome / lawful, neutral
            const cav = ROLE_KNOWLEDGE_MAP.caveman;
            expect(cav.allowedRaces).toEqual(['human', 'dwarf', 'gnome']);
            expect(cav.allowedAlignments).toEqual(['lawful', 'neutral']);

            // Hea: human, gnome / neutral only
            const hea = ROLE_KNOWLEDGE_MAP.healer;
            expect(hea.allowedRaces).toEqual(['human', 'gnome']);
            expect(hea.allowedAlignments).toEqual(['neutral']);

            // Kni: human only / lawful only
            const kni = ROLE_KNOWLEDGE_MAP.knight;
            expect(kni.allowedRaces).toEqual(['human']);
            expect(kni.allowedAlignments).toEqual(['lawful']);

            // Mon: human only / lawful, neutral, chaotic
            const mon = ROLE_KNOWLEDGE_MAP.monk;
            expect(mon.allowedRaces).toEqual(['human']);
            expect(mon.allowedAlignments).toEqual(['lawful', 'neutral', 'chaotic']);

            // Pri: human, elf / lawful, neutral, chaotic
            const pri = ROLE_KNOWLEDGE_MAP.priest;
            expect(pri.allowedRaces).toEqual(['human', 'elf']);
            expect(pri.allowedAlignments).toEqual(['lawful', 'neutral', 'chaotic']);

            // Ran: human, elf, gnome, orc / neutral, chaotic
            const ran = ROLE_KNOWLEDGE_MAP.ranger;
            expect(ran.allowedRaces).toEqual(['human', 'elf', 'gnome', 'orc']);
            expect(ran.allowedAlignments).toEqual(['neutral', 'chaotic']);

            // Rog: human, orc / chaotic only
            const rog = ROLE_KNOWLEDGE_MAP.rogue;
            expect(rog.allowedRaces).toEqual(['human', 'orc']);
            expect(rog.allowedAlignments).toEqual(['chaotic']);

            // Sam: human only / lawful only
            const sam = ROLE_KNOWLEDGE_MAP.samurai;
            expect(sam.allowedRaces).toEqual(['human']);
            expect(sam.allowedAlignments).toEqual(['lawful']);

            // Tou: human only / neutral only
            const tou = ROLE_KNOWLEDGE_MAP.tourist;
            expect(tou.allowedRaces).toEqual(['human']);
            expect(tou.allowedAlignments).toEqual(['neutral']);

            // Val: human, dwarf / lawful, neutral / female only!
            const val = ROLE_KNOWLEDGE_MAP.valkyrie;
            expect(val.allowedRaces).toEqual(['human', 'dwarf']);
            expect(val.allowedAlignments).toEqual(['lawful', 'neutral']);
            expect(val.allowedGenders).toEqual(['female']);

            // Wiz: human, elf, gnome, orc / neutral, chaotic
            const wiz = ROLE_KNOWLEDGE_MAP.wizard;
            expect(wiz.allowedRaces).toEqual(['human', 'elf', 'gnome', 'orc']);
            expect(wiz.allowedAlignments).toEqual(['neutral', 'chaotic']);
        });

        it('should verify official NetHack role.c race alignment constraints across all 5 races', () => {
            // Human: lawful, neutral, chaotic
            expect(RACE_KNOWLEDGE_MAP.human.allowedAlignments).toEqual(['lawful', 'neutral', 'chaotic']);
            // Dwarf: lawful only
            expect(RACE_KNOWLEDGE_MAP.dwarf.allowedAlignments).toEqual(['lawful']);
            // Elf: chaotic only
            expect(RACE_KNOWLEDGE_MAP.elf.allowedAlignments).toEqual(['chaotic']);
            // Gnome: neutral only
            expect(RACE_KNOWLEDGE_MAP.gnome.allowedAlignments).toEqual(['neutral']);
            // Orc: chaotic only
            expect(RACE_KNOWLEDGE_MAP.orc.allowedAlignments).toEqual(['chaotic']);
        });

        it('should resolve alignment and gender keys correctly', () => {
            expect(resolveAlignmentKey('lawful')).toBe('lawful');
            expect(resolveAlignmentKey('秩序')).toBe('lawful');
            expect(resolveAlignmentKey('neutral')).toBe('neutral');
            expect(resolveAlignmentKey('中立')).toBe('neutral');
            expect(resolveAlignmentKey('chaotic')).toBe('chaotic');
            expect(resolveAlignmentKey('混沌')).toBe('chaotic');

            expect(resolveGenderKey('male')).toBe('male');
            expect(resolveGenderKey('男性')).toBe('male');
            expect(resolveGenderKey('female')).toBe('female');
            expect(resolveGenderKey('女性')).toBe('female');
        });

        it('should generate proper character badges with constraint and trait distinctions in Japanese and English', () => {
            // Valkyrie: female only (constraint), cold res (trait), combat (trait)
            const valBadgesJa = getCharacterBadges('role', 'valkyrie', 'ja');
            expect(valBadgesJa.some(b => b.type === 'constraint' && b.label === '女性限定')).toBe(true);
            expect(valBadgesJa.some(b => b.type === 'trait' && b.label === '冷気耐性')).toBe(true);

            const valBadgesEn = getCharacterBadges('role', 'valkyrie', 'en');
            expect(valBadgesEn.some(b => b.type === 'constraint' && b.label === 'Female only')).toBe(true);
            expect(valBadgesEn.some(b => b.type === 'trait' && b.label === 'Cold res')).toBe(true);

            // Knight: human only, lawful only
            const kniBadgesJa = getCharacterBadges('role', 'knight', 'ja');
            expect(kniBadgesJa.some(b => b.type === 'constraint' && b.label === '人間限定')).toBe(true);
            expect(kniBadgesJa.some(b => b.type === 'constraint' && b.label === '秩序固定')).toBe(true);

            // Dwarf: lawful only (constraint), infravision (trait)
            const dwaBadgesJa = getCharacterBadges('race', 'dwarf', 'ja');
            expect(dwaBadgesJa.some(b => b.type === 'constraint' && b.label === '秩序固定')).toBe(true);
            expect(dwaBadgesJa.some(b => b.type === 'trait' && b.label === '暗視')).toBe(true);

            // Orc: chaotic only (constraint), infravision / poison res (traits)
            const orcBadgesJa = getCharacterBadges('race', 'orc', 'ja');
            expect(orcBadgesJa.some(b => b.type === 'constraint' && b.label === '混沌固定')).toBe(true);
            expect(orcBadgesJa.some(b => b.type === 'trait' && b.label === '毒耐性')).toBe(true);
        });
    });

    describe('TERRAIN_KNOWLEDGE_BASE (Terrain & Landmark SSOT)', () => {
        it('should resolve terrain entries from cmapInfo flags', () => {
            const stairDown = getTerrainEntryByCmap({ isStairDown: true });
            expect(stairDown).toBeDefined();
            expect(stairDown.id).toBe('stairs_down');
            expect(stairDown.category).toBe('STAIRS');
            expect(stairDown.defaultVerb).toBe('>');

            const fountain = getTerrainEntryByCmap({ isFountain: true });
            expect(fountain).toBeDefined();
            expect(fountain.id).toBe('fountain');
            expect(fountain.category).toBe('FOUNTAIN');
            expect(fountain.defaultVerb).toBe('q');

            const lava = getTerrainEntryByCmap({ isLava: true });
            expect(lava).toBeDefined();
            expect(lava.id).toBe('lava');
            expect(lava.category).toBe('LAVA');
        });

        it('should resolve terrain entries from string identifiers and keywords', () => {
            const door = getTerrainEntryByKey('closed_door');
            expect(door).toBeDefined();
            expect(door.id).toBe('closed_door');

            const altarJa = getTerrainEntryByKey('祭壇');
            expect(altarJa).toBeDefined();
            expect(altarJa.id).toBe('altar');

            const sink = getTerrainEntryByKey('sink');
            expect(sink).toBeDefined();
            expect(sink.id).toBe('sink');
        });

        it('should verify all terrain entries have required properties and no hardcoded Japanese properties', () => {
            for (const [key, entry] of Object.entries(TERRAIN_KNOWLEDGE_MAP)) {
                expect(entry.id).toBe(key);
                expect(typeof entry.name).toBe('string');
                expect(typeof entry.category).toBe('string');
                expect(typeof entry.effectSummary).toBe('string');

                // 🎯 GKL SSOT 原則: マスターデータには nameJa, actionLabelJa, effectSummaryJa を直接保持しない
                expect(entry.nameJa).toBeUndefined();
                expect(entry.actionLabelJa).toBeUndefined();
                expect(entry.effectSummaryJa).toBeUndefined();
            }
        });

        it('should dynamically localize terrain name, actionLabel, and effectSummary via StructuredKnowledgeEngine', () => {
            const mockTranslationEngine = {
                translate: (text) => {
                    const dict = {
                        'Stairs Down': '下り階段',
                        'Descend stairs (>)': '階段を降りる (>)',
                        'Use \'>\' key to descend to deeper dungeon floor.': '\'>\' キーで下の階層へ降ります。'
                    };
                    return dict[text] || text;
                }
            };
            const engine = new StructuredKnowledgeEngine({ translationEngine: mockTranslationEngine });
            const localized = engine.getTerrainKnowledge('stairs_down', { translate: true });

            expect(localized).toBeDefined();
            expect(localized.name).toBe('下り階段');
            expect(localized.actionLabel).toBe('階段を降りる (>)');
            expect(localized.effectSummary).toBe('\'>\' キーで下の階層へ降ります。');
        });
    });

    describe('MONSTER_KNOWLEDGE_FULL (Threat & Counter Schema SSOT)', () => {
        it('should contain structured threat metadata and counters for major threats', () => {
            // killer bee (monOffset: 1)
            const bee = MONSTER_KNOWLEDGE_MAP.get(1);
            expect(bee).toBeDefined();
            expect(bee.threat).toBeDefined();
            expect(bee.threat.type).toBe('POISON');
            expect(bee.threat.severity).toBe('WARNING');
            expect(bee.threat.counters[0].id).toBe('COUNTER_POISON_RES');
            expect(bee.threat.counters[0].stance).toBe('EQUIP');

            // gas spore (monOffset: 27)
            const spore = MONSTER_KNOWLEDGE_MAP.get(27);
            expect(spore).toBeDefined();
            expect(spore.threat).toBeDefined();
            expect(spore.threat.type).toBe('EXPLOSION');
            expect(spore.threat.counters[0].stance).toBe('RANGED');

            // floating eye (monOffset: 28)
            const eye = MONSTER_KNOWLEDGE_MAP.get(28);
            expect(eye).toBeDefined();
            expect(eye.threat).toBeDefined();
            expect(eye.threat.type).toBe('GAZE_PARALYSIS');
            expect(eye.threat.counters.some(c => c.matchItemId === 'blindfold')).toBe(true);

            // cockatrice (monOffset: 10)
            const cockatrice = MONSTER_KNOWLEDGE_MAP.get(10);
            expect(cockatrice).toBeDefined();
            expect(cockatrice.threat).toBeDefined();
            expect(cockatrice.threat.type).toBe('PETRIFICATION');
            expect(cockatrice.threat.counters.some(c => c.matchItemId === 'gloves')).toBe(true);

            // silver dragon (monOffset: 145)
            const silver = MONSTER_KNOWLEDGE_MAP.get(145);
            expect(silver).toBeDefined();
            expect(silver.threat).toBeDefined();
            expect(silver.threat.type).toBe('REFLECT');

            // rust monster (monOffset: 212)
            const rust = MONSTER_KNOWLEDGE_MAP.get(212);
            expect(rust).toBeDefined();
            expect(rust.threat).toBeDefined();
            expect(rust.threat.type).toBe('EQUIPMENT_DAMAGE');

            // wraith (monOffset: 230)
            const wraith = MONSTER_KNOWLEDGE_MAP.get(230);
            expect(wraith).toBeDefined();
            expect(wraith.threat).toBeDefined();
            expect(wraith.threat.type).toBe('LEVEL_DRAIN');
        });

        it('should localize threat metadata and counters via StructuredKnowledgeEngine', () => {
            const mockTranslationEngine = {
                translate: (text) => {
                    const dict = {
                        'Paralysis gaze immobilizes player for dozens of turns on melee contact.': '視線により近接接触時にプレイヤーを数十ターンにわたって麻痺状態にします。',
                        'Floating eye: Wear blindfold or towel to approach safely': '浮遊する目玉: 目隠しやタオルを着用して安全に接近してください'
                    };
                    return dict[text] || text;
                }
            };
            const engine = new StructuredKnowledgeEngine({ translationEngine: mockTranslationEngine });
            const localizedEye = engine.getMonsterKnowledge('floating eye', { translate: true });
            expect(localizedEye).toBeDefined();
            expect(localizedEye.threat).toBeDefined();
            // threat.description should be translated to Japanese
            expect(localizedEye.threat.description).toContain('麻痺');
            expect(localizedEye.threat.counters[0].id).toBe('COUNTER_BLINDFOLD');
            expect(localizedEye.threat.counters[0].message).toContain('目隠し');
        });
    });

    describe('OBJECT_KNOWLEDGE_FULL (Effects & actionVerb SSOT)', () => {
        it('should bind effects and actionVerb across healing, utility, and equipment items', () => {
            // Potion of healing (onum: 307)
            const healPot = OBJECT_KNOWLEDGE_MAP.get(307);
            expect(healPot).toBeDefined();
            expect(healPot.actionVerb).toBe('q');
            expect(healPot.effects.healHp).toBe(true);
            expect(healPot.effects.healPower).toBe('LOW');
            expect(healPot.effects.cureBlindness).toBe(true);

            // Potion of extra healing (onum: 308)
            const extraHeal = OBJECT_KNOWLEDGE_MAP.get(308);
            expect(extraHeal).toBeDefined();
            expect(extraHeal.actionVerb).toBe('q');
            expect(extraHeal.effects.healHp).toBe(true);
            expect(extraHeal.effects.healPower).toBe('MED');
            expect(extraHeal.effects.cureSickness).toBe(true);

            // Potion of full healing (onum: 315)
            const fullHeal = OBJECT_KNOWLEDGE_MAP.get(315);
            expect(fullHeal).toBeDefined();
            expect(fullHeal.actionVerb).toBe('q');
            expect(fullHeal.effects.healHp).toBe(true);
            expect(fullHeal.effects.healPower).toBe('FULL');
            expect(fullHeal.effects.cureSickness).toBe(true);

            // Unicorn horn (onum: 261)
            const uniHorn = OBJECT_KNOWLEDGE_MAP.get(261);
            expect(uniHorn).toBeDefined();
            expect(uniHorn.actionVerb).toBe('a');
            expect(uniHorn.effects.cureSickness).toBe(true);
            expect(uniHorn.effects.cureBlindness).toBe(true);

            // Glob of black pudding (onum: 274)
            const blackPudding = OBJECT_KNOWLEDGE_MAP.get(274);
            expect(blackPudding).toBeDefined();
            expect(blackPudding.name).toBe('glob of black pudding');
            expect(blackPudding.actionVerb).toBe('e');
            expect(blackPudding.effects.curePetrification).toBeUndefined();

            // Scroll of remove curse (onum: 327)
            const uncurse = OBJECT_KNOWLEDGE_MAP.get(327);
            expect(uncurse).toBeDefined();
            expect(uncurse.actionVerb).toBe('r');
            expect(uncurse.effects.removeCurse).toBe(true);

            // Pick-axe (onum: 259)
            const pickAxe = OBJECT_KNOWLEDGE_MAP.get(259);
            expect(pickAxe).toBeDefined();
            expect(pickAxe.effects.digs).toBe(true);

            // Skeleton key (onum: 221)
            const key = OBJECT_KNOWLEDGE_MAP.get(221);
            expect(key).toBeDefined();
            expect(key.effects.unlocks).toBe(true);
        });
    });
});
