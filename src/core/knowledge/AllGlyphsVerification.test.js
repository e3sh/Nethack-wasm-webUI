import { describe, it, expect } from 'vitest';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';
import { AreaStateManager } from './AreaStateManager.js';
import { classifyGlyph, ENTITY_TYPES, getOnumFromGlyph } from './glyphClassifier.js';
import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';

describe('All Glyphs (0 ~ 9622) Full Stress & Verification Test', () => {
    const engine = new StructuredKnowledgeEngine();

    it('should handle all glyph IDs (0 to 9622) without crashing and correctly return knowledge', () => {
        let monsterCount = 0;
        let itemCount = 0;
        let terrainCount = 0;
        let nullCount = 0;
        let errorCount = 0;

        for (let glyph = 0; glyph <= 9622; glyph++) {
            try {
                const info = classifyGlyph(glyph);
                const result = engine.getKnowledge(glyph, { translate: false });

                if (!result) {
                    nullCount++;
                } else if (info.type === ENTITY_TYPES.MONSTER || info.type === ENTITY_TYPES.PET) {
                    monsterCount++;
                    expect(result.name).toBeDefined();
                } else if (info.type === ENTITY_TYPES.ITEM || info.type === ENTITY_TYPES.BODY || info.type === ENTITY_TYPES.STATUE) {
                    itemCount++;
                    expect(result.name).toBeDefined();
                } else if (info.type === ENTITY_TYPES.TERRAIN || info.type === ENTITY_TYPES.TRAP || info.type === ENTITY_TYPES.CMAP || info.type === ENTITY_TYPES.UNEXPLORED) {
                    terrainCount++;
                    expect(result.name).toBeDefined();
                }
            } catch (err) {
                console.error(`Error at glyph ${glyph}:`, err);
                errorCount++;
            }
        }

        console.log(`[AllGlyphsTest Summary] Total Tested: 9623`);
        console.log(` - Monsters: ${monsterCount}`);
        console.log(` - Items: ${itemCount}`);
        console.log(` - Terrain: ${terrainCount}`);
        console.log(` - Null/Unmapped: ${nullCount}`);
        console.log(` - Errors: ${errorCount}`);

        expect(errorCount).toBe(0);
        expect(itemCount).toBeGreaterThan(0);
        expect(terrainCount).toBeGreaterThan(0);
    });

    it('should test all 481 item onums in OBJECT_KNOWLEDGE_MAP directly', () => {
        let mappedCount = 0;
        for (let onum = 0; onum <= 480; onum++) {
            const data = engine.getItemKnowledge(onum, { isOnum: true });
            if (data) {
                mappedCount++;
            } else {
                console.warn(`onum ${onum} returned null`);
            }
        }
        console.log(`Direct onum mapping (0~480): ${mappedCount} / 481`);
        expect(mappedCount).toBe(481);
    });

    it('should verify that terrain updates in AreaStateManager correctly override and clear items according to NetHack specs', () => {
        const asm = new AreaStateManager();
        const itemGlyph = 3469; // Silver arrow
        const terrainGlyph = 3993; // Floor

        // 1. マス (10, 5) にアイテムを設置
        asm.updateGlyph(10, 5, itemGlyph);
        expect(asm.grid[5][10].middle).not.toBeNull();
        expect(asm.grid[5][10].middle.glyph).toBe(itemGlyph);

        // 2. アイテム消滅時（何もなくなった時）、後から地形パケットが届く
        asm.updateGlyph(10, 5, terrainGlyph);

        // 地形更新によりアイテム(middle)が正しくクリアされることを検証（NetHack仕様）
        expect(asm.grid[5][10].bottom).not.toBeNull();
        expect(asm.grid[5][10].middle).toBeNull();
        expect(asm.grid[5][10].top).toBeNull();
        expect(asm.grid[5][10].effect).toBeNull();
    });

    it('should verify that EFFECT glyphs set cell.effect and are cleared when restored by terrain updates', () => {
        const asm = new AreaStateManager();
        const terrainGlyph = 3993; // Floor
        const zapGlyph = 4055;     // Wand zap effect

        // 1. まず地形をセット
        asm.updateGlyph(12, 6, terrainGlyph);
        expect(asm.grid[6][12].bottom).not.toBeNull();
        expect(asm.grid[6][12].effect).toBeNull();

        // 2. 光線・エフェクトが届く
        asm.updateGlyph(12, 6, zapGlyph);
        expect(asm.grid[6][12].bottom).not.toBeNull(); // 地形は保持される
        expect(asm.grid[6][12].effect).not.toBeNull(); // エフェクトがセットされる
        expect(asm.grid[6][12].effect.glyph).toBe(zapGlyph);

        // 3. newsym による元の地形の復元パケットが届く
        asm.updateGlyph(12, 6, terrainGlyph);
        expect(asm.grid[6][12].bottom).not.toBeNull();
        expect(asm.grid[6][12].effect).toBeNull();     // エフェクトがクリアされる
    });

    it('should test that all pet glyphs (766 to 1531) resolve to valid monster knowledge with TAMED disposition', () => {
        let petSuccessCount = 0;
        for (let g = 766; g < 1532; g++) {
            const petInfo = classifyGlyph(g);
            expect(petInfo.type).toBe(ENTITY_TYPES.PET);
            expect(petInfo.subType).toBeGreaterThanOrEqual(0);
            expect(petInfo.subType).toBeLessThan(383);

            const monData = engine.getMonsterKnowledge(g, { translate: false });
            expect(monData).not.toBeNull();
            expect(monData.dangerLevel).toBe('SAFE');
            expect(monData.dispositionStatus).toBe('TAMED');
            petSuccessCount++;
        }
        expect(petSuccessCount).toBe(1532 - 766);
    });
});
