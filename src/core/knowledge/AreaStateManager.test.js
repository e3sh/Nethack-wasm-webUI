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

    describe('Staircase Cache and Floor Transition Recovery', () => {
        it('should cache staircase when terrain glyph is stair up or down', () => {
            asm.setCurrentFloor('Dlvl:1');
            const stairDownGlyph = 3999; // 下り階段
            asm.updateGlyph(18, 12, stairDownGlyph);

            expect(asm.stairCache.has('Dlvl:1:18,12')).toBe(true);
            const cached = asm.stairCache.get('Dlvl:1:18,12');
            expect(cached.cmapFlags.isStairDown).toBe(true);
        });

        it('should restore staircase at player feet when revisiting floor', () => {
            // 1. Dlvl:1 で階段(18, 12)を発見・記録
            asm.setCurrentFloor('Dlvl:1');
            const stairDownGlyph = 3999;
            asm.updateGlyph(18, 12, stairDownGlyph);

            // 2. Dlvl:2 へ移動 (グリッドリセット & フロア切替)
            asm.setCurrentFloor('Dlvl:2');
            asm.resetGrid();
            expect(asm.grid[18][12].bottom).toBeNull();

            // 3. Dlvl:1 に戻ってきて (18, 12) に出現
            asm.setCurrentFloor('Dlvl:1');
            asm.resetGrid();
            expect(asm.grid[18][12].bottom).toBeNull();

            asm.updatePlayerPosition(18, 12);

            const feetCell = asm.grid[12][18]; // y=12, x=18
            expect(feetCell.bottom).not.toBeNull();
            expect(feetCell.bottom.cmapFlags.isStairDown).toBe(true);
            expect(feetCell.bottom.inferred).toBeUndefined(); // 確定情報として復元
        });

        it('should fallback to inferred floor if player arrives at non-staircase position (e.g. pit / teleport)', () => {
            asm.setCurrentFloor('Dlvl:1');
            const stairDownGlyph = 3999;
            asm.updateGlyph(18, 12, stairDownGlyph);

            // フロア移動後、落とし穴等で (5, 5) に出現
            asm.resetGrid();
            asm.updatePlayerPosition(5, 5);

            const feetCell = asm.grid[5][5];
            expect(feetCell.bottom).not.toBeNull();
            expect(feetCell.bottom.inferred).toBe(true);
            expect(feetCell.bottom.cmapFlags.isFloor).toBe(true);
        });

        it('should preload all cached stairs of the floor into grid on setCurrentFloor', () => {
            // 1. Dlvl:1 で上り階段 (5, 5) と下り階段 (20, 15) の2つを記録
            asm.setCurrentFloor('Dlvl:1');
            asm.updateGlyph(5, 5, 3998);   // 上り階段
            asm.updateGlyph(20, 15, 3999); // 下り階段

            // 2. Dlvl:2 へ移動 (グリッドリセット)
            asm.setCurrentFloor('Dlvl:2');
            asm.resetGrid();
            expect(asm.grid[5][5].bottom).toBeNull();
            expect(asm.grid[15][20].bottom).toBeNull();

            // 3. Dlvl:1 に戻ると、グリッドに (5, 5) と (20, 15) の両方が自動復元される
            asm.setCurrentFloor('Dlvl:1');
            expect(asm.grid[5][5].bottom).not.toBeNull();
            expect(asm.grid[5][5].bottom.cmapFlags.isStairUp).toBe(true);

            expect(asm.grid[15][20].bottom).not.toBeNull();
            expect(asm.grid[15][20].bottom.cmapFlags.isStairDown).toBe(true);
        });

        it('should clear stair cache when clearStairCache is called', () => {
            asm.setCurrentFloor('Dlvl:1');
            asm.updateGlyph(10, 10, 3998); // 上り階段
            expect(asm.stairCache.size).toBe(1);

            asm.clearStairCache();
            expect(asm.stairCache.size).toBe(0);
        });
    });
});
