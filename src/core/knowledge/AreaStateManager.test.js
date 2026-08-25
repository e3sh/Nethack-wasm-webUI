import { describe, it, expect, beforeEach } from 'vitest';
import { AreaStateManager, DEFAULT_INFERRED_FLOOR_GLYPH, createInferredFloor } from './AreaStateManager.js';
import { GLYPH_OFFSETS, ENTITY_TYPES } from './glyphClassifier.js';

describe('AreaStateManager - Terrain Inference and Dynamic State', () => {
    let asm;

    beforeEach(() => {
        asm = new AreaStateManager(80, 24);
    });

    describe('createInferredFloor', () => {
        it('should create an inferred floor entity with inferred: true and isFloor: true', () => {
            const floor = createInferredFloor();
            expect(floor).toBeDefined();
            expect(floor.type).toBe(ENTITY_TYPES.TERRAIN);
            expect(floor.glyph).toBe(DEFAULT_INFERRED_FLOOR_GLYPH);
            expect(floor.rawGlyph).toBe(DEFAULT_INFERRED_FLOOR_GLYPH);
            expect(floor.inferred).toBe(true);
            expect(floor.cmapFlags).toBeDefined();
            expect(floor.cmapFlags.isFloor).toBe(true);
        });
    });

    describe('Player Position Terrain Inference', () => {
        it('should infer floor at player position when bottom is null on game start / movement', () => {
            expect(asm.grid[10][10].bottom).toBeNull();

            asm.updatePlayerPosition(10, 10);

            const cell = asm.grid[10][10];
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.inferred).toBe(true);
            expect(cell.bottom.cmapFlags.isFloor).toBe(true);

            const areaState = asm.getAreaState();
            expect(areaState.feet.bottom).not.toBeNull();
            expect(areaState.feet.bottom.inferred).toBe(true);
            expect(areaState.feet.bottom.cmapFlags.isFloor).toBe(true);
        });

        it('should NOT overwrite existing terrain at player position with inferred floor', () => {
            // 水路マス (glyph 4015) を受信して確定
            const waterGlyph = 4015;
            asm.updateGlyph(5, 5, waterGlyph);
            expect(asm.grid[5][5].bottom.cmapFlags.isWater).toBe(true);
            expect(asm.grid[5][5].bottom.inferred).toBeUndefined();

            // プレイヤーがその水路マスに移動
            asm.updatePlayerPosition(5, 5);

            const cell = asm.grid[5][5];
            expect(cell.bottom.cmapFlags.isWater).toBe(true);
            expect(cell.bottom.inferred).toBeUndefined();
        });
    });

    describe('Monster and Pet Appearance Terrain Inference', () => {
        it('should infer floor when monster glyph arrives at an unmapped cell', () => {
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 10; // 特定モンスター
            expect(asm.grid[12][15].bottom).toBeNull();

            asm.updateGlyph(15, 12, monsterGlyph);

            const cell = asm.grid[12][15];
            expect(cell.top).not.toBeNull();
            expect(cell.top.type).toBe(ENTITY_TYPES.MONSTER);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.inferred).toBe(true);
            expect(cell.bottom.cmapFlags.isFloor).toBe(true);
        });

        it('should infer floor when pet glyph arrives at an unmapped cell', () => {
            const petGlyph = GLYPH_OFFSETS.GLYPH_PET_OFF + 5; // ペット
            expect(asm.grid[8][8].bottom).toBeNull();

            asm.updateGlyph(8, 8, petGlyph);

            const cell = asm.grid[8][8];
            expect(cell.top).not.toBeNull();
            expect(cell.top.type).toBe(ENTITY_TYPES.PET);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.inferred).toBe(true);
            expect(cell.bottom.cmapFlags.isFloor).toBe(true);
        });

        it('should preserve existing terrain (e.g. lava) when monster appears on it', () => {
            const lavaGlyph = 4017;
            asm.updateGlyph(20, 10, lavaGlyph);
            expect(asm.grid[10][20].bottom.cmapFlags.isLava).toBe(true);

            // モンスターが溶岩マスに出現
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 20;
            asm.updateGlyph(20, 10, monsterGlyph);

            const cell = asm.grid[10][20];
            expect(cell.top).not.toBeNull();
            expect(cell.bottom.cmapFlags.isLava).toBe(true);
            expect(cell.bottom.inferred).toBeUndefined();
        });
    });

    describe('Item and Entity Appearance Terrain Inference', () => {
        it('should infer floor when item glyph arrives at an unmapped cell', () => {
            const itemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 10;
            expect(asm.grid[7][7].bottom).toBeNull();

            asm.updateGlyph(7, 7, itemGlyph);

            const cell = asm.grid[7][7];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.type).toBe(ENTITY_TYPES.ITEM);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.inferred).toBe(true);
            expect(cell.bottom.cmapFlags.isFloor).toBe(true);
        });

        it('should infer floor when corpse / body arrives at an unmapped cell', () => {
            const bodyGlyph = GLYPH_OFFSETS.GLYPH_BODY_OFF + 2;
            asm.updateGlyph(6, 6, bodyGlyph);

            const cell = asm.grid[6][6];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.type).toBe(ENTITY_TYPES.BODY);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.inferred).toBe(true);
        });
    });

    describe('Self-Healing / Overwrite by Genuine Terrain', () => {
        it('should replace inferred floor with genuine terrain when terrain glyph arrives', () => {
            // 1. モンスターが出現して仮床が推測される
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 10;
            asm.updateGlyph(14, 14, monsterGlyph);

            const cell = asm.grid[14][14];
            expect(cell.bottom.inferred).toBe(true);

            // 2. モンスターが移動し、NetHack から正規の床グリフを受信
            const genuineFloorGlyph = 3992;
            asm.updateGlyph(14, 14, genuineFloorGlyph);

            expect(cell.bottom.inferred).toBeUndefined();
            expect(cell.bottom.glyph).toBe(genuineFloorGlyph);
            expect(cell.top).toBeNull();
        });

        it('should replace inferred floor with wall or door when genuine terrain arrives', () => {
            // プレイヤーが位置更新で仮床セット
            asm.updatePlayerPosition(3, 3);
            expect(asm.grid[3][3].bottom.inferred).toBe(true);

            // 壁グリフを受信
            const wallGlyph = 3929;
            asm.updateGlyph(3, 3, wallGlyph);

            const cell = asm.grid[3][3];
            expect(cell.bottom.inferred).toBeUndefined();
            expect(cell.bottom.cmapFlags.isWall).toBe(true);
        });
    });
});
