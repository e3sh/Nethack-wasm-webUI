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
                    'plains centaur': '平原のケンタウロス',
                    'kitten': '子猫',
                    'little dog': '小犬',
                    'wand of digging': '掘削の杖',
                    'mineral': '鉱物',
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
            expect(item.actionLabel).toBe('振る (z)');
        });

        it('should localize stats.material (e.g. mineral) when translate is true', () => {
            // onum 472 (black opal 等の mineral 素材アイテム)
            const item = engine.getItemKnowledge(472, { translate: true });
            expect(item).not.toBeNull();
            expect(item.stats.material).toBe('鉱物');
        });

        it('should keep English action labels when translate is false', () => {
            const item = engine.getItemKnowledge('wand_of_digging', { translate: false });
            expect(item.name).toBe('wand of digging');
            expect(item.actionLabelEn).toBe('Zap (z)');
            expect(item.actionLabelJa).toBe('振る (z)');
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

        it('should resolve Statue and Terrain knowledge correctly from text/name without falling back to TOOL', () => {
            // 石像 (statue)
            const statueStr = engine.getKnowledge('statue of goblin', { translate: true });
            expect(statueStr).not.toBeNull();
            expect(statueStr.category).toBe('STATUE');

            // 噴水 (fountain)
            const fountainStr = engine.getKnowledge('fountain', { translate: true });
            expect(fountainStr).not.toBeNull();
            expect(fountainStr.category).toBe('FOUNTAIN');

            // ダンジョン壁 (dungeon wall)
            const wallStr = engine.getKnowledge('dungeon wall', { translate: true });
            expect(wallStr).not.toBeNull();
            expect(wallStr.category).toBe('WALL');

            // ダンジョン床 (dungeon floor)
            const floorStr = engine.getKnowledge('dungeon floor', { translate: true });
            expect(floorStr).not.toBeNull();
            expect(floorStr.category).toBe('FLOOR');

            // オブジェクト ({ name: 'fountain' })
            const fountainObj = engine.getKnowledge({ name: 'fountain' }, { translate: true });
            expect(fountainObj).not.toBeNull();
            expect(fountainObj.category).toBe('FOUNTAIN');
        });

        it('should resolve specific monster name for statue glyph IDs (e.g. plains centaur 7356 / subType 130) even on hover', () => {
            // Glyph ID 7356 = GLYPH_STATUE_OFF (7226) + 130 (plains centaur)
            const statueGlyph = engine.getKnowledge(7356, { translate: true });
            expect(statueGlyph).not.toBeNull();
            expect(statueGlyph.category).toBe('STATUE');
            expect(statueGlyph.name).toContain('平原のケンタウロス');

            // オブジェクト { type: 'STATUE', subType: 130, rawGlyph: 7356 }
            const statueEntity = engine.getKnowledge({ type: 'STATUE', subType: 130, rawGlyph: 7356 }, { translate: true });
            expect(statueEntity).not.toBeNull();
            expect(statueEntity.category).toBe('STATUE');
            expect(statueEntity.name).toContain('平原のケンタウロス');

            // モンスター情報のない単なる石像テキスト/オブジェクトの場合、Unknown Creature にならずシンプルな「石像」になること
            const genericStatue = engine.getKnowledge({ name: 'statue' }, { translate: true });
            expect(genericStatue).not.toBeNull();
            expect(genericStatue.category).toBe('STATUE');
            expect(genericStatue.name).not.toContain('Unknown Creature');
            expect(genericStatue.name).toContain('石像');

            // マップセル上のアイテムオブジェクト ({ type: 'ITEM', subType: 476, glyph: 7356 }) も正しく転送され平原のケンタウロス像になること
            const mapItemStatue = engine.getKnowledge({ type: 'ITEM', subType: 476, glyph: 7356 }, { translate: true });
            expect(mapItemStatue).not.toBeNull();
            expect(mapItemStatue.category).toBe('STATUE');
            expect(mapItemStatue.name).toContain('平原のケンタウロス');

            // すでに完成したナレッジカードオブジェクトが getKnowledge に再投入されてもそのまま返却され上書き破棄されないこと
            const re投入Result = engine.getKnowledge(mapItemStatue, { translate: true });
            expect(re投入Result).toEqual(mapItemStatue);
            expect(re投入Result.name).toContain('平原のケンタウロス');
        });
    });

    describe('Pet and Special Monster Knowledge Tests', () => {
        it('should correctly resolve pet knowledge from pet glyph IDs (GLYPH_PET_OFF: 766~1531)', () => {
            // GLYPH_PET_OFF (766) + 32 (子猫 / kitten)
            const kittenGlyph = 766 + 32;
            const kittenKnowledge = engine.getKnowledge(kittenGlyph, { translate: true });
            expect(kittenKnowledge).not.toBeNull();
            expect(kittenKnowledge.category).toBe('MONSTER');
            expect(kittenKnowledge.name).toContain('子猫');
            expect(kittenKnowledge.dangerLevel).toBe('SAFE');
            expect(kittenKnowledge.dispositionStatus).toBe('TAMED');

            // GLYPH_PET_OFF (766) + 16 (小犬 / little dog)
            const dogGlyph = 766 + 16;
            const dogKnowledge = engine.getMonsterKnowledge(dogGlyph, { translate: true });
            expect(dogKnowledge).not.toBeNull();
            expect(dogKnowledge.name).toContain('小犬');
            expect(dogKnowledge.dangerLevel).toBe('SAFE');
            expect(dogKnowledge.dispositionStatus).toBe('TAMED');
        });

        it('should correctly resolve pet knowledge from classifier entity object ({ type: "PET", ... })', () => {
            const petEntity = { type: 'PET', subType: 32, rawGlyph: 766 + 32 };
            const petKnowledge = engine.getKnowledge(petEntity, { translate: true });
            expect(petKnowledge).not.toBeNull();
            expect(petKnowledge.name).toContain('子猫');
            expect(petKnowledge.dangerLevel).toBe('SAFE');
            expect(petKnowledge.dispositionStatus).toBe('TAMED');
        });

        it('should resolve ridden and detected monsters by glyph ID', () => {
            // GLYPH_RIDDEN_OFF (2682) + 130 (平原のケンタウロス)
            const riddenGlyph = 2682 + 130;
            const riddenKnowledge = engine.getKnowledge(riddenGlyph, { translate: true });
            expect(riddenKnowledge).not.toBeNull();
            expect(riddenKnowledge.name).toContain('平原のケンタウロス');

            // GLYPH_DETECT_OFF (1533) + 130
            const detectGlyph = 1533 + 130;
            const detectKnowledge = engine.getKnowledge(detectGlyph, { translate: true });
            expect(detectKnowledge).not.toBeNull();
            expect(detectKnowledge.name).toContain('平原のケンタウロス');
        });
    });
});
