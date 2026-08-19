import { describe, it, expect, beforeEach } from 'vitest';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';
import { GLYPH_OFFSETS } from './glyphClassifier.js';

describe('StructuredKnowledgeEngine', () => {
    let engine;
    let mockTranslationEngine;

    beforeEach(() => {
        mockTranslationEngine = {
            translate: (text) => {
                const dict = {
                    'cockatrice': 'コカトリス',
                    'wand of digging': '掘削の杖',
                    'Petrifies instantly if touched or eaten without gloves!': '手袋なしで触ると石化します！',
                    'Engrave Elbereth to keep away': 'Elbereth(Eの字)を刻んで遠ざける',
                    'Digs holes or tunnels in walls and floor.': '壁や床に穴や通路を掘る。'
                };
                return dict[text] || text;
            }
        };

        engine = new StructuredKnowledgeEngine({
            translationEngine: mockTranslationEngine
        });
    });

    describe('Monster Knowledge Retrieval', () => {
        it('should retrieve monster knowledge by ID string', () => {
            const mon = engine.getMonsterKnowledge('cockatrice', { translate: false });
            expect(mon).not.toBeNull();
            expect(mon.id).toBe('cockatrice');
            expect(mon.name).toBe('cockatrice');
            expect(mon.dangerLevel).toBe('LETHAL');
            expect(mon.stats.hd).toBe(5);
        });

        it('should retrieve monster knowledge by monOffset number', () => {
            const mon = engine.getMonsterKnowledge(28, { translate: false }); // tilemappings.lst floating eye mnum = 28
            expect(mon).not.toBeNull();
            expect(mon.id).toBe('floating_eye');
            expect(mon.dangerLevel).toBe('HIGH');
        });

        it('should retrieve monster knowledge by glyphId number', () => {
            // NetHack cockatrice monOffset = 10
            const mon = engine.getMonsterKnowledge(10, { translate: false });
            expect(mon).not.toBeNull();
            expect(mon.id).toBe('cockatrice');
        });

        it('should return null for unknown monster', () => {
            const mon = engine.getMonsterKnowledge('non_existent_monster');
            expect(mon).toBeNull();
        });
    });

    describe('Item Knowledge Retrieval', () => {
        it('should retrieve item knowledge by ID string', () => {
            const item = engine.getItemKnowledge('wand_of_digging', { translate: false });
            expect(item).not.toBeNull();
            expect(item.id).toBe('wand_of_digging');
            expect(item.onum).toBe(428);
            expect(item.category).toBe('WAND');
        });

        it('should retrieve item knowledge by onum number', () => {
            const item = engine.getItemKnowledge(428, { translate: false });
            expect(item).not.toBeNull();
            expect(item.id).toBe('wand_of_digging');
        });

        it('should retrieve item knowledge by glyphId number', () => {
            // GLYPH_OBJ_OFF (3448) + 428 = 3876
            const wandGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 428;
            const item = engine.getItemKnowledge(wandGlyph, { translate: false });
            expect(item).not.toBeNull();
            expect(item.id).toBe('wand_of_digging');
        });

        it('should resolve item knowledge from complex NetHack inventory strings', () => {
            const item = engine.getItemKnowledge('a - 2 uncursed rations of cram', { translate: false });
            expect(item).not.toBeNull();
            expect(item.name).toBe('ration of cram');
            expect(item.category).toBe('FOOD');
        });
    });

    describe('TranslationEngine Localizing Integration', () => {
        it('should return raw English data when translate is false', () => {
            const mon = engine.getMonsterKnowledge('cockatrice', { translate: false });
            expect(mon.name).toBe('cockatrice');
            expect(mon.corpseInfo.warningNote).toBe('Petrifies instantly if touched or eaten without gloves!');
            expect(mon.tacticalAdvice[0]).toBe('Engrave Elbereth to keep away');
        });

        it('should return localized Japanese data when translate is true', () => {
            const mon = engine.getMonsterKnowledge('cockatrice', { translate: true });
            expect(mon.name).toBe('コカトリス');
            expect(mon.corpseInfo.warningNote).toBe('手袋なしで触ると石化します！');
            expect(mon.tacticalAdvice[0]).toBe('Elbereth(Eの字)を刻んで遠ざける');
        });

        it('should automatically detect unidentified item appearances and return unidentified tips', () => {
            const unidPotion = engine.getItemKnowledge('ruby potion', { translate: false });
            expect(unidPotion).not.toBeNull();
            expect(unidPotion.isUnidentified).toBe(true);
            expect(unidPotion.category).toBe('POTION');
            expect(unidPotion.unidentifiedTips.length).toBeGreaterThan(0);

            const unidScroll = engine.getItemKnowledge('scroll labelled FOO', { translate: false });
            expect(unidScroll).not.toBeNull();
            expect(unidScroll.isUnidentified).toBe(true);
            expect(unidScroll.category).toBe('SCROLL');
        });

        it('should localize item fields when translate is true', () => {
            const item = engine.getItemKnowledge('wand_of_digging', { translate: true });
            expect(item.name).toBe('掘削の杖');
            expect(item.effectSummary).toBe('壁や床に穴や通路を掘る。');
        });
    });

    describe('Statue Knowledge Tests', () => {
        it('should resolve Statue knowledge by glyph ID for both single and pile statues', () => {
            // 単体像 (GLYPH_STATUE_OFF = 7226) -> monOffset 0 (ジャッカル / jackal など)
            const statue1 = engine.getKnowledge(7226, { translate: true });
            expect(statue1).not.toBeNull();
            expect(statue1.category).toBe('STATUE');
            expect(statue1.name).toContain('像');
            expect(statue1.effectSummary).toContain('石像');

            // 山積み像 (GLYPH_STATUE_PILETOP_OFF = 8856)
            const statuePile = engine.getKnowledge(8856, { translate: true });
            expect(statuePile).not.toBeNull();
            expect(statuePile.category).toBe('STATUE');
            expect(statuePile.name).toContain('像');
        });

        it('should resolve Statue knowledge from classifier entity object', () => {
            const entity = { type: 'STATUE', subType: 0, rawGlyph: 7226 };
            const statue = engine.getKnowledge(entity, { translate: true });
            expect(statue).not.toBeNull();
            expect(statue.category).toBe('STATUE');
            expect(statue.name).toContain('像');
        });
    });
});
