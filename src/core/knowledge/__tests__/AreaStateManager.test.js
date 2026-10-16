import { describe, it, expect, beforeEach } from 'vitest';
import { AreaStateManager, DEFAULT_INFERRED_FLOOR_GLYPH, createInferredFloor, normalizeFloorKey } from "../state/AreaStateManager.js";
import { GLYPH_OFFSETS, ENTITY_TYPES } from "../engines/glyphClassifier.js";

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
        it('should preserve grid cell bottom null and not invent speculative floor without DirectBinding', () => {
            expect(asm.grid[10][10].bottom).toBeNull();

            asm.updatePlayerPosition(10, 10);

            // 未探索マスを勝手に推測床 (3992) で汚染しないこと (DirectBinding Native)
            const cell = asm.grid[10][10];
            expect(cell.bottom).toBeNull();

            // DirectBinding 接続がない場合は勝手に捏造せず null
            const areaState = asm.getAreaState();
            expect(areaState.feet.bottom).toBeNull();
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
        it('should preserve bottom as null without DirectBinding or bkglyphInfo when monster glyph arrives', () => {
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 10; // 特定モンスター
            expect(asm.grid[12][15].bottom).toBeNull();

            asm.updateGlyph(15, 12, monsterGlyph);

            const cell = asm.grid[12][15];
            expect(cell.top).not.toBeNull();
            expect(cell.top.type).toBe(ENTITY_TYPES.MONSTER);
            // DirectBinding Native: 未確定マスに勝手に推測仮床 (3992) を作らない
            expect(cell.bottom).toBeNull();
        });

        it('should preserve bottom as null without DirectBinding or bkglyphInfo when pet glyph arrives', () => {
            const petGlyph = GLYPH_OFFSETS.GLYPH_PET_OFF + 5; // ペット
            expect(asm.grid[8][8].bottom).toBeNull();

            asm.updateGlyph(8, 8, petGlyph);

            const cell = asm.grid[8][8];
            expect(cell.top).not.toBeNull();
            expect(cell.top.type).toBe(ENTITY_TYPES.PET);
            expect(cell.bottom).toBeNull();
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
        it('should preserve bottom as null without DirectBinding or bkglyphInfo when item glyph arrives', () => {
            const itemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 10;
            expect(asm.grid[7][7].bottom).toBeNull();

            asm.updateGlyph(7, 7, itemGlyph);

            const cell = asm.grid[7][7];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.type).toBe(ENTITY_TYPES.ITEM);
            expect(cell.bottom).toBeNull();
        });

        it('should preserve bottom as null without DirectBinding or bkglyphInfo when body arrives', () => {
            const bodyGlyph = GLYPH_OFFSETS.GLYPH_BODY_OFF + 2;
            asm.updateGlyph(6, 6, bodyGlyph);

            const cell = asm.grid[6][6];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.type).toBe(ENTITY_TYPES.BODY);
            expect(cell.bottom).toBeNull();
        });

        it('should preserve UNEXPLORED bottom when item arrives without DirectBinding or bkglyphInfo', () => {
            const unexploredGlyph = GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF; // 9622
            asm.updateGlyph(12, 12, unexploredGlyph);

            expect(asm.grid[12][12].bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);

            // アイテムグリフが届く
            const itemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 25;
            asm.updateGlyph(12, 12, itemGlyph);

            const cell = asm.grid[12][12];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.type).toBe(ENTITY_TYPES.ITEM);
            expect(cell.bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);
        });

        it('should preserve UNEXPLORED bottom when monster arrives without DirectBinding or bkglyphInfo', () => {
            const unexploredGlyph = GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF;
            asm.updateGlyph(13, 13, unexploredGlyph);

            expect(asm.grid[13][13].bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);

            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 5;
            asm.updateGlyph(13, 13, monsterGlyph);

            const cell = asm.grid[13][13];
            expect(cell.top).not.toBeNull();
            expect(cell.top.type).toBe(ENTITY_TYPES.MONSTER);
            expect(cell.bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);
        });
    });

    describe('Background Glyph (bkglyphInfo) Ground Truth Resolution', () => {
        it('should resolve cell.bottom with bkglyphInfo terrain when monster glyph arrives with bkglyphInfo', () => {
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 10;
            const waterGlyph = 4015; // 水路 (cmap)
            const bkglyphInfo = { glyph: waterGlyph, ch: '}', color: 4 };

            asm.updateGlyph(14, 14, monsterGlyph, null, bkglyphInfo);

            const cell = asm.grid[14][14];
            expect(cell.top).not.toBeNull();
            expect(cell.top.type).toBe(ENTITY_TYPES.MONSTER);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.glyph).toBe(waterGlyph);
            expect(cell.bottom.rawGlyph).toBe(waterGlyph);
            expect(cell.bottom.glyphInfo).toEqual(bkglyphInfo);
            expect(cell.bottom.cmapFlags?.isWater).toBe(true);
            expect(cell.bottom.inferred).toBeUndefined();
        });

        it('should resolve cell.bottom with bkglyphInfo terrain when pet glyph arrives with bkglyphInfo', () => {
            const petGlyph = GLYPH_OFFSETS.GLYPH_PET_OFF + 5;
            const floorGlyph = 3992;
            const bkglyphInfo = { glyph: floorGlyph, ch: '.', color: 7 };

            asm.updateGlyph(15, 15, petGlyph, null, bkglyphInfo);

            const cell = asm.grid[15][15];
            expect(cell.top).not.toBeNull();
            expect(cell.top.type).toBe(ENTITY_TYPES.PET);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.glyph).toBe(floorGlyph);
            expect(cell.bottom.glyphInfo).toEqual(bkglyphInfo);
            expect(cell.bottom.inferred).toBeUndefined();
        });

        it('should resolve cell.bottom with bkglyphInfo terrain when item glyph arrives with bkglyphInfo', () => {
            const itemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 20;
            const iceGlyph = 4016; // 氷 (cmap: 4016)
            const bkglyphInfo = { glyph: iceGlyph, ch: '.', color: 14 };

            asm.updateGlyph(16, 16, itemGlyph, null, bkglyphInfo);

            const cell = asm.grid[16][16];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.type).toBe(ENTITY_TYPES.ITEM);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.glyph).toBe(iceGlyph);
            expect(cell.bottom.rawGlyph).toBe(iceGlyph);
            expect(cell.bottom.glyphInfo).toEqual(bkglyphInfo);
            expect(cell.bottom.cmapFlags?.isIce).toBe(true);
            expect(cell.bottom.inferred).toBeUndefined();
        });

        it('should resolve cell.bottom with bkglyphInfo terrain when body / statue arrives with bkglyphInfo', () => {
            const bodyGlyph = GLYPH_OFFSETS.GLYPH_BODY_OFF + 3;
            const lavaGlyph = 4017; // 溶岩
            const bkglyphInfo = { glyph: lavaGlyph, ch: '}', color: 1 };

            asm.updateGlyph(17, 17, bodyGlyph, null, bkglyphInfo);

            const cell = asm.grid[17][17];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.type).toBe(ENTITY_TYPES.BODY);
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.glyph).toBe(lavaGlyph);
            expect(cell.bottom.cmapFlags?.isLava).toBe(true);
            expect(cell.bottom.inferred).toBeUndefined();
        });

        it('should update cell.bottom from UNEXPLORED to bkglyphInfo terrain when monster or item arrives', () => {
            const unexploredGlyph = GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF;
            asm.updateGlyph(18, 18, unexploredGlyph);
            expect(asm.grid[18][18].bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);

            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 1;
            const floorGlyph = 3992;
            const bkglyphInfo = { glyph: floorGlyph, ch: '.', color: 7 };

            asm.updateGlyph(18, 18, monsterGlyph, null, bkglyphInfo);

            const cell = asm.grid[18][18];
            expect(cell.bottom.type).toBe(ENTITY_TYPES.TERRAIN);
            expect(cell.bottom.glyph).toBe(floorGlyph);
            expect(cell.bottom.inferred).toBeUndefined();
            expect(cell.bottom.glyphInfo).toEqual(bkglyphInfo);
        });

        it('should keep bottom as null without DirectBinding when bkglyphInfo is missing or invalid or GLYPH_UNEXPLORED (9622)', () => {
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 2;
            asm.updateGlyph(19, 19, monsterGlyph, null, null);

            const monsterCell = asm.grid[19][19];
            expect(monsterCell.bottom).toBeNull();

            const itemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 2;
            asm.updateGlyph(20, 20, itemGlyph, null, { glyph: -1 });

            const itemCell = asm.grid[20][20];
            expect(itemCell.bottom).toBeNull();

            // NetHack 5.0 C コアがデフォルトで送信する 9622 (GLYPH_UNEXPLORED) の場合
            const unexploredBkglyph = { glyph: 9622, ch: ' ', color: 8 };
            asm.updateGlyph(21, 21, monsterGlyph, null, unexploredBkglyph);

            const unexpCell = asm.grid[21][21];
            expect(unexpCell.bottom).toBeNull();
        });
    });

    describe('Terrain Updates and Overwrite by Genuine Terrain', () => {
        it('should set genuine terrain when terrain glyph arrives', () => {
            // 1. モンスターが出現
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 10;
            asm.updateGlyph(14, 14, monsterGlyph);

            const cell = asm.grid[14][14];
            expect(cell.top).not.toBeNull();
            expect(cell.bottom).toBeNull();

            // 2. NetHack から正規の床グリフを受信
            const genuineFloorGlyph = 3992;
            asm.updateGlyph(14, 14, genuineFloorGlyph);

            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.inferred).toBeUndefined();
            expect(cell.bottom.glyph).toBe(genuineFloorGlyph);
            expect(cell.top).toBeNull();
        });

        it('should update cell bottom when wall arrives', () => {
            // モンスター出現
            const monsterGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 5;
            asm.updateGlyph(3, 3, monsterGlyph);
            expect(asm.grid[3][3].top).not.toBeNull();

            // 壁グリフを受信
            const wallGlyph = 3929;
            asm.updateGlyph(3, 3, wallGlyph);

            const cell = asm.grid[3][3];
            expect(cell.bottom).not.toBeNull();
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

        it('should preserve null if player arrives at non-staircase position (e.g. pit / teleport) without DirectBinding', () => {
            asm.setCurrentFloor('Dlvl:1');
            const stairDownGlyph = 3999;
            asm.updateGlyph(18, 12, stairDownGlyph);

            // フロア移動後、落とし穴等で (5, 5) に出現
            asm.resetGrid();
            asm.updatePlayerPosition(5, 5);

            // グリッドセル自体は汚染されず未探索(null)を維持
            const feetCell = asm.grid[5][5];
            expect(feetCell.bottom).toBeNull();

            // DirectBinding 接続がない場合は勝手に推測床を作らず null
            const areaState = asm.getAreaState();
            expect(areaState.feet.bottom).toBeNull();
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

        it('should normalize floor keys with various formats', () => {
            expect(normalizeFloorKey('Dlvl: 1')).toBe('Dlvl:1');
            expect(normalizeFloorKey('Dlvl:1')).toBe('Dlvl:1');
            expect(normalizeFloorKey('2')).toBe('Dlvl:2');
            expect(normalizeFloorKey(3)).toBe('Dlvl:3');
            expect(normalizeFloorKey('Minetown: 3')).toBe('Minetown:3');
            expect(normalizeFloorKey('Mines:2')).toBe('Mines:2');
            expect(normalizeFloorKey('The Dungeons of Doom:1')).toBe('The Dungeons of Doom:1');
            expect(normalizeFloorKey(null)).toBe('Dlvl:1');
            expect(normalizeFloorKey('')).toBe('Dlvl:1');
        });

        it('should cache branch staircase (glyph 4002) and mark preloaded stairs with isCachedPreload', () => {
            asm.setCurrentFloor('Mines:2');
            const branchStairUpGlyph = 4002; // 分岐上り階段
            asm.updateGlyph(25, 10, branchStairUpGlyph);

            expect(asm.stairCache.has('Mines:2:25,10')).toBe(true);
            const cached = asm.stairCache.get('Mines:2:25,10');
            expect(cached.cmapFlags.isStairUp).toBe(true);

            // フロア切替後、戻った時に isCachedPreload が付与されて復元される
            asm.setCurrentFloor('Mines:3');
            expect(asm.grid[10][25].bottom).toBeNull();

            asm.setCurrentFloor('Mines:2');
            expect(asm.grid[10][25].bottom).not.toBeNull();
            expect(asm.grid[10][25].bottom.isCachedPreload).toBe(true);

            // プレイヤーがそのマスに到達したときは isCachedPreload が解除される
            asm.updatePlayerPosition(25, 10);
            expect(asm.grid[10][25].bottom.isCachedPreload).toBeUndefined();
        });

        it('should reset grid and only apply target floor stairs on setCurrentFloor change', () => {
            // 1. Dlvl:1 で下り階段を記録
            asm.setCurrentFloor('Dlvl:1');
            asm.updateGlyph(10, 10, 3999); // Dlvl:1 の下り階段
            expect(asm.grid[10][10].bottom).not.toBeNull();

            // 2. Dlvl:2 へフロア変更 (setCurrentFloor 内部で resetGrid が走り、Dlvl:2 のキャッシュのみ反映)
            asm.setCurrentFloor('Dlvl:2');
            // Dlvl:2 は新規到達フロアなので、(10, 10) は null のままで前フロアの階段が残留しないこと
            expect(asm.grid[10][10].bottom).toBeNull();

            // 3. Dlvl:2 で上り階段 (5, 5) を記録
            asm.updateGlyph(5, 5, 3998);
            expect(asm.grid[5][5].bottom).not.toBeNull();

            // 4. 再び Dlvl:1 に戻ると、グリッドがリセットされて Dlvl:1 の階段 (10, 10) のみが復元され、Dlvl:2 の階段 (5, 5) は存在しないこと
            asm.setCurrentFloor('Dlvl:1');
            expect(asm.grid[10][10].bottom).not.toBeNull();
            expect(asm.grid[10][10].bottom.cmapFlags.isStairDown).toBe(true);
            expect(asm.grid[5][5].bottom).toBeNull();
        });

        it('should handle whitespace variations in floor keys transparently', () => {
            asm.setCurrentFloor('Dlvl: 1'); // スペースあり
            asm.updateGlyph(15, 15, 3999);

            asm.setCurrentFloor('Dlvl:2');
            expect(asm.grid[15][15].bottom).toBeNull();

            asm.setCurrentFloor('Dlvl:1'); // スペースなしで再訪
            expect(asm.grid[15][15].bottom).not.toBeNull();
            expect(asm.grid[15][15].bottom.cmapFlags.isStairDown).toBe(true);
        });
    });

    describe('Landmark Registry and POI Extraction', () => {
        it('should extract and register various landmarks (stairs, altars, sink, fountain, throne, shopkeeper)', () => {
            asm.setCurrentFloor('Dlvl:3');

            // 1. 上り階段 (3998)
            asm.updateGlyph(10, 5, 3998);
            // 2. 下り階段 (3999)
            asm.updateGlyph(20, 5, 3999);
            // 3. 祭壇 - 中立 (4008)
            asm.updateGlyph(30, 5, 4008);
            // 4. 祭壇 - 秩序 (4009)
            asm.updateGlyph(35, 5, 4009);
            // 5. 流し台 (4013)
            asm.updateGlyph(40, 5, 4013);
            // 6. 噴水 (4014)
            asm.updateGlyph(50, 5, 4014);
            // 7. 王座 (4012)
            asm.updateGlyph(60, 5, 4012);
            // 8. 店主 (モンスター monOffset 271)
            const shopkeeperGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 271;
            asm.updateGlyph(70, 5, shopkeeperGlyph);

            const summary = asm.getFloorLandmarks('Dlvl:3');
            expect(summary.floorKey).toBe('Dlvl:3');
            expect(summary.stairsUp.length).toBe(1);
            expect(summary.stairsUp[0].type).toBe('STAIR_UP');
            expect(summary.stairsDown.length).toBe(1);
            expect(summary.stairsDown[0].type).toBe('STAIR_DOWN');
            expect(summary.altars.length).toBe(2);
            expect(summary.altars[0].details.alignment).toBe('neutral');
            expect(summary.altars[1].details.alignment).toBe('lawful');
            expect(summary.sinks.length).toBe(1);
            expect(summary.sinks[0].type).toBe('SINK');
            expect(summary.fountains.length).toBe(1);
            expect(summary.thrones.length).toBe(1);
            expect(summary.shops.length).toBe(1);
            expect(summary.shops[0].type).toBe('SHOP');
            expect(summary.all.length).toBe(8);

            const allLandmarks = asm.getAllLandmarks();
            expect(allLandmarks.length).toBe(8);
        });

        it('店主が同フロア内を移動した場合でも、SHOP ランドマークが最新座標の1件に維持され重複しないこと', () => {
            asm.setCurrentFloor('Dlvl:4');
            const shopkeeperGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 271;

            // 1. 最初は (15, 8) に店主が出現
            asm.updateGlyph(15, 8, shopkeeperGlyph);
            let summary = asm.getFloorLandmarks('Dlvl:4');
            expect(summary.shops.length).toBe(1);
            expect(summary.shops[0].x).toBe(15);
            expect(summary.shops[0].y).toBe(8);

            // 2. 店主が (15, 9) に1歩移動
            asm.updateGlyph(15, 9, shopkeeperGlyph);
            summary = asm.getFloorLandmarks('Dlvl:4');
            expect(summary.shops.length).toBe(1); // 2件にならず1件のまま
            expect(summary.shops[0].x).toBe(15);
            expect(summary.shops[0].y).toBe(9); // 最新座標に更新

            // 3. 店主が (16, 9) にさらに移動
            asm.updateGlyph(16, 9, shopkeeperGlyph);
            summary = asm.getFloorLandmarks('Dlvl:4');
            expect(summary.shops.length).toBe(1);
            expect(summary.shops[0].x).toBe(16);
            expect(summary.shops[0].y).toBe(9);
        });

        it('should handle pending landmarks during floor transition', () => {
            asm.prepareFloorTransition();
            expect(asm.isFloorPending).toBe(true);

            // フロア確定待ち中に流し台と祭壇を受信
            asm.updateGlyph(12, 8, 4013); // 流し台
            asm.updateGlyph(14, 8, 4008); // 祭壇

            expect(asm.pendingLandmarks.length).toBe(2);

            // フロア確定
            asm.setCurrentFloor('Dlvl:5');
            expect(asm.isFloorPending).toBe(false);
            expect(asm.pendingLandmarks.length).toBe(0);

            const summary = asm.getFloorLandmarks('Dlvl:5');
            expect(summary.sinks.length).toBe(1);
            expect(summary.altars.length).toBe(1);
        });

        it('should clear landmarks on clearLandmarkCache', () => {
            asm.setCurrentFloor('Dlvl:2');
            asm.updateGlyph(10, 10, 4013);
            expect(asm.getAllLandmarks().length).toBe(1);

            asm.clearLandmarkCache();
            expect(asm.getAllLandmarks().length).toBe(0);
            expect(asm.stairCache.size).toBe(0);
        });

        it('should generate grouped summary with count and multi-coordinate tooltips (e.g. Oracle with 4 fountains)', () => {
            asm.setCurrentFloor('Dlvl:5');

            // 神託所 (Oracle) のように噴水が4つ並ぶケース
            asm.updateGlyph(20, 10, 4014);
            asm.updateGlyph(20, 12, 4014);
            asm.updateGlyph(35, 10, 4014);
            asm.updateGlyph(35, 12, 4014);

            // 上り階段1つ、下り階段1つ
            asm.updateGlyph(10, 5, 3998);
            asm.updateGlyph(50, 18, 3999);

            // 中立祭壇1つ
            asm.updateGlyph(28, 11, 4008);

            const floorData = asm.getFloorLandmarks('Dlvl:5');
            expect(floorData.totalCount).toBe(7);
            expect(floorData.all.length).toBe(7);

            // summary は 4種類 (FOUNTAIN, STAIR_UP, STAIR_DOWN, ALTAR:neutral) に集約される
            expect(floorData.summary.length).toBe(4);

            const fountainSummary = floorData.summary.find(s => s.type === 'FOUNTAIN');
            expect(fountainSummary).toBeDefined();
            expect(fountainSummary.count).toBe(4);
            expect(fountainSummary.coords.length).toBe(4);
            expect(fountainSummary.icon).toBe('⛲');
            expect(fountainSummary.nameJa).toBe('噴水');
            expect(fountainSummary.nameEn).toBe('fountain');
            expect(fountainSummary.tooltipJa).toBe('噴水 (4箇所): (20,10), (20,12), (35,10), (35,12)');
            expect(fountainSummary.tooltipEn).toBe('fountain (4 locations): (20,10), (20,12), (35,10), (35,12)');

            const stairUpSummary = floorData.summary.find(s => s.type === 'STAIR_UP');
            expect(stairUpSummary.count).toBe(1);
            expect(stairUpSummary.tooltipJa).toBe('上り階段: (10,5)');

            const altarSummary = floorData.summary.find(s => s.type === 'ALTAR');
            expect(altarSummary.count).toBe(1);
            expect(altarSummary.nameJa).toBe('祭壇 (中立)');
            expect(altarSummary.tooltipJa).toBe('祭壇 (中立): (28,11)');
        });
    });

    describe('Boulder Push Detection and Feet Clearance', () => {
        const BOULDER_GLYPH = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 475; // 3923
        const PILE_BOULDER_GLYPH = GLYPH_OFFSETS.GLYPH_OBJ_PILETOP_OFF + 475; // 8467

        it('should clear boulder from feet when pushing forward (boulder arrives at destination before player pos update)', () => {
            // (10, 10) に岩が存在
            asm.updateGlyph(10, 10, BOULDER_GLYPH);
            expect(asm.grid[10][10].middle).not.toBeNull();

            // プレイヤー初期位置 (9, 10)
            asm.updatePlayerPosition(9, 10);

            // 押し出し先 (11, 10) に岩が届く (Case A)
            asm.updateGlyph(11, 10, BOULDER_GLYPH);

            // プレイヤーが (10, 10) に移動
            asm.updatePlayerPosition(10, 10);

            // 移動先の足元 (10, 10) の岩がクリアされ、押し出し先 (11, 10) に岩が残る
            expect(asm.grid[10][10].middle).toBeNull();
            expect(asm.grid[10][11].middle).not.toBeNull();
            expect(asm.grid[10][11].middle.subType).toBe(475);
        });

        it('should clear boulder from feet when pushing forward (player pos updates before boulder arrives at destination)', () => {
            // (10, 10) に岩が存在
            asm.updateGlyph(10, 10, BOULDER_GLYPH);
            expect(asm.grid[10][10].middle).not.toBeNull();

            // プレイヤー初期位置 (9, 10)
            asm.updatePlayerPosition(9, 10);

            // プレイヤーが (10, 10) に移動 (Case B)
            asm.updatePlayerPosition(10, 10);

            // この時点では押し出し先が未確定のため一時的に middle が残る
            expect(asm.grid[10][10].middle).not.toBeNull();

            // 押し出し先 (11, 10) に岩グリフが届く
            asm.updateGlyph(11, 10, BOULDER_GLYPH);

            // 足元 (10, 10) の岩が自動クリアされる
            expect(asm.grid[10][10].middle).toBeNull();
            expect(asm.grid[10][11].middle).not.toBeNull();
        });

        it('should retain boulder at player feet when not pushed (e.g. Scroll of Earth / Drop)', () => {
            // プレイヤー位置 (10, 10)
            asm.updatePlayerPosition(10, 10);

            // 大地の巻物やドロップでプレイヤー足元 (10, 10) に岩が配置される
            asm.updateGlyph(10, 10, BOULDER_GLYPH);

            // 押し出し先には岩が出現しない
            expect(asm.grid[10][10].middle).not.toBeNull();
            expect(asm.grid[10][10].middle.subType).toBe(475);

            // 状況取得時も足元のアイテムとして岩が正しく認識される
            const areaState = asm.getAreaState();
            expect(areaState.feet.middle).not.toBeNull();
            expect(areaState.feet.middle.subType).toBe(475);
        });

        it('should handle diagonal boulder pushing correctly', () => {
            // (10, 10) に山積み岩が存在
            asm.updateGlyph(10, 10, PILE_BOULDER_GLYPH);

            // プレイヤー初期位置 (9, 9) から南東 (10, 10) へ
            asm.updatePlayerPosition(9, 9);
            asm.updatePlayerPosition(10, 10);

            // 押し出し先 (11, 11) に岩グリフが届く
            asm.updateGlyph(11, 11, BOULDER_GLYPH);

            // 足元 (10, 10) の岩がクリアされる
            expect(asm.grid[10][10].middle).toBeNull();
            expect(asm.grid[11][11].middle).not.toBeNull();
        });

        it('未探索マス（UNEXPLORED）の上で updatePlayerPosition が呼ばれても床に化けず UNEXPLORED が維持されること', () => {
            const asm = new AreaStateManager(80, 24);
            asm.updatePlayerPosition(10, 10);

            // 隣接マス (11, 10) を未探索マスに設定
            const unexploredGlyph = GLYPH_OFFSETS.GLYPH_UNEXPLORED_OFF;
            asm.updateGlyph(11, 10, unexploredGlyph);
            expect(asm.grid[10][11].bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);

            // (11, 10) で updatePlayerPosition が呼ばれても床には化けない
            asm.updatePlayerPosition(11, 10);

            expect(asm.grid[10][11].bottom.type).toBe(ENTITY_TYPES.UNEXPLORED);
            expect(asm.grid[10][11].bottom.inferred).toBeUndefined();
        });

        it('getFocusCameraTiles がプレイヤー中心の整形済みタイルグリッドを正しく返却すること', () => {
            const asm = new AreaStateManager(80, 24);
            asm.updatePlayerPosition(10, 10);

            // (10, 10) に床
            asm.updateGlyph(10, 10, 3992);
            // (11, 10) にモンスター (jackal: glyph 1)
            asm.updateGlyph(11, 10, 1);

            const tiles = asm.getFocusCameraTiles(2, 2, { language: 'ja' });
            // 5x5 = 25 tiles
            expect(tiles.length).toBe(25);

            const playerTile = tiles.find(t => t.dx === 0 && t.dy === 0);
            expect(playerTile).toBeDefined();
            expect(playerTile.isPlayer).toBe(true);
            expect(playerTile.isUnexplored).toBe(false);
            expect(playerTile.bottomGlyph).toBe(3992);
            expect(playerTile.renderGlyphs).toContain(3992);

            const monsterTile = tiles.find(t => t.dx === 1 && t.dy === 0);
            expect(monsterTile).toBeDefined();
            expect(monsterTile.isPlayer).toBe(false);
            expect(monsterTile.glyphId).toBe(1);
            expect(monsterTile.isUnexplored).toBe(false);
            // DirectBinding Native: 真の床が未解決の場合は -1 となり、renderGlyphs にはモンスターのみ含まれる
            expect(monsterTile.bottomGlyph).toBe(-1);
            expect(monsterTile.topGlyph).toBe(1);
            expect(monsterTile.renderGlyphs).toEqual([1]);

            const farTile = tiles.find(t => t.dx === -2 && t.dy === -2);
            expect(farTile).toBeDefined();
            expect(farTile.isUnexplored).toBe(true);
            expect(farTile.renderGlyphs).toEqual([]);
        });

        it('getFocusCameraTiles が死亡時にプレイヤー位置へ墓石グリフ(4011)を自動配置すること', () => {
            const asm = new AreaStateManager(80, 24);
            asm.updatePlayerPosition(10, 10);
            asm.updateGlyph(10, 10, 3992);

            const tiles = asm.getFocusCameraTiles(1, 1, { isDead: true });
            const playerTile = tiles.find(t => t.isPlayer);
            expect(playerTile).toBeDefined();
            expect(playerTile.topGlyph).toBe(4011);
            expect(playerTile.renderGlyphs).toEqual([3992, 4011]);
            expect(playerTile.nameJa).toBe('墓石');
        });
    });

    describe('seedInitialStair - ゲーム開始時初手足元上り階段の先行シード', () => {
        it('Dlvl:1 で初手に seedInitialStair を呼ぶと上り階段がキャッシュとセルに登録されること', () => {
            const asm = new AreaStateManager(80, 24);
            expect(asm.stairCache.size).toBe(0);

            const result = asm.seedInitialStair(12, 14);
            expect(result).toBe(true);

            // 1. stairCache に登録されたこと
            expect(asm.stairCache.has('Dlvl:1:12,14')).toBe(true);
            const stair = asm.stairCache.get('Dlvl:1:12,14');
            expect(stair.glyph).toBe(4002);
            expect(stair.cmapFlags?.isStairUp).toBe(true);

            // 2. landmarkCache にも登録されたこと
            expect(asm.landmarkCache.has('Dlvl:1:12,14:STAIR_UP')).toBe(true);

            // 3. セル底面にもセットされたこと
            const cell = asm.grid[14][12];
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.glyph).toBe(4002);
            expect(cell.bottom.cmapFlags?.isStairUp).toBe(true);
            expect(cell.bottom.inferred).toBe(false);
        });

        it('2回目の seedInitialStair 呼び出しでは多重実行されないこと', () => {
            const asm = new AreaStateManager(80, 24);
            expect(asm.seedInitialStair(12, 14)).toBe(true);
            expect(asm.seedInitialStair(15, 15)).toBe(false);

            expect(asm.stairCache.size).toBe(1);
            expect(asm.stairCache.has('Dlvl:1:15,15')).toBe(false);
        });

        it('Dlvl:1 以外のフロアでは seedInitialStair が実行されないこと', () => {
            const asm = new AreaStateManager(80, 24);
            asm.setCurrentFloor('Dlvl:2');

            expect(asm.seedInitialStair(10, 10)).toBe(false);
            expect(asm.stairCache.size).toBe(0);
        });

        it('clearStairCache 実行後は再度シード可能なこと', () => {
            const asm = new AreaStateManager(80, 24);
            expect(asm.seedInitialStair(12, 14)).toBe(true);

            asm.clearStairCache();
            expect(asm.stairCache.size).toBe(0);

            expect(asm.seedInitialStair(20, 10)).toBe(true);
            expect(asm.stairCache.has('Dlvl:1:20,10')).toBe(true);
        });
    });

    describe('Stage 8.3 - Wasm Direct Binding Integration', () => {
        let mockBindingService;
        let asm;

        beforeEach(() => {
            mockBindingService = {
                isAvailable: vi.fn(() => true),
                getCellInfo: vi.fn((x, y) => {
                    if (x === 15 && y === 10) {
                        // 武器屋の部屋床 (typ: ROOM=25, roomno: 2)
                        return { x, y, typ: 25, flags: 0, lit: true, roomno: 2, door: null };
                    }
                    if (x === 12 && y === 10) {
                        // 氷の床 (typ: ICE=33)
                        return { x, y, typ: 33, flags: 0, lit: true, roomno: 0, door: null };
                    }
                    if (x === 14 && y === 10) {
                        // 施錠扉 (typ: DOOR=23, D_LOCKED)
                        return {
                            x, y, typ: 23, flags: 0x08, lit: true, roomno: 2,
                            door: { isClosed: false, isLocked: true, isOpen: false, isTrapped: false }
                        };
                    }
                    return { x, y, typ: 25, flags: 0, lit: false, roomno: 0, door: null };
                }),
                getRoomType: vi.fn((roomno) => {
                    if (roomno === 2) return { roomno: 2, rtype: 18, isShop: true, name: 'Weapon Shop', nameJa: '武器屋' };
                    return { roomno: 0, rtype: 0, isShop: false, name: 'Room', nameJa: '普通の部屋' };
                }),
                getTrapAt: vi.fn((x, y) => {
                    if (x === 15 && y === 10) {
                        return { x, y, ttyp: 11, tseen: true, once: false, name: 'pit', nameJa: '落とし穴 (ピット)' };
                    }
                    return null;
                }),
                getEngravingAt: vi.fn((x, y) => {
                    if (x === 15 && y === 10) {
                        return { x, y, text: 'Elbereth', engrType: 3, typeNameJa: '焼き', isElbereth: true };
                    }
                    return null;
                }),
                getFullMonsterAt: vi.fn((x, y) => {
                    if (x === 16 && y === 10) {
                        return {
                            x, y, ptr: 0x4000, peaceful: true, tame: false, hp: 60, hpmax: 60,
                            sleeping: true, fleeing: false, paralyzed: false,
                            isShopkeeper: true, isPriest: false
                        };
                    }
                    return null;
                }),
                _cachedLevelGlyphs: new Int32Array(80 * 24).fill(3992)
            };
            mockBindingService._cachedLevelGlyphs[10 * 80 + 12] = 4016; // (12, 10): ICE
            mockBindingService._cachedLevelGlyphs[10 * 80 + 14] = 3988; // (14, 10): 施錠扉
            mockBindingService._cachedLevelGlyphs[10 * 80 + 15] = 3992; // (15, 10): 武器屋床

            asm = new AreaStateManager(80, 24, null, mockBindingService);
        });

        it('resolves genuine terrain, room type, trap and engraving for feet', () => {
            asm.updatePlayerPosition(15, 10);
            const state = asm.getAreaState(15, 10, 1);

            expect(state.feet).not.toBeNull();
            expect(state.feet.bottom.inferred).toBe(false);
            expect(state.feet.bottom.isGenuine).toBe(true);
            expect(state.feet.bottom.room).toEqual({
                roomno: 2, rtype: 18, isShop: true, name: 'Weapon Shop', nameJa: '武器屋'
            });
            expect(state.feet.bottom.trap).toEqual({
                x: 15, y: 10, ttyp: 11, tseen: true, once: false, name: 'pit', nameJa: '落とし穴 (ピット)'
            });
            expect(state.feet.bottom.engraving).toEqual({
                x: 15, y: 10, text: 'Elbereth', engrType: 3, typeNameJa: '焼き', isElbereth: true
            });

            // engravingCache にも登録されていること
            expect(asm.getEngravingAt(15, 10).isElbereth).toBe(true);
        });

        it('resolves genuine ice terrain under items instead of default floor (3992)', () => {
            // (12, 10) にアイテムグリフが届いた場合
            const itemGlyph = 3450;
            asm.updateGlyph(12, 10, itemGlyph);

            const cell = asm.grid[10][12];
            expect(cell.middle).not.toBeNull();
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.inferred).toBe(false);
            expect(cell.bottom.isGenuine).toBe(true);
            expect(cell.bottom.glyph).toBe(4016); // ICE グリフ
            expect(cell.bottom.cmapFlags.isIce).toBe(true);
        });

        it('syncs monster direct binding stats (peaceful, shopkeeper, sleeping, hp) when monster arrives', () => {
            // (16, 10) にモンスターグリフが届いた場合
            const monGlyph = 100;
            asm.updateGlyph(16, 10, monGlyph);

            const cell = asm.grid[10][16];
            expect(cell.top).not.toBeNull();
            expect(cell.top.isPeaceful).toBe(true);
            expect(cell.top.isShopkeeper).toBe(true);
            expect(cell.top.hp).toBe(60);
            expect(cell.top.hpmax).toBe(60);
            expect(cell.top.dynamicState.sleeping).toBe(true);
        });

        it('syncFromDirectBinding synchronizes surrounding genuine terrain and monsters', () => {
            asm.updatePlayerPosition(15, 10);
            // 視界周囲を一括同期
            asm.syncFromDirectBinding(2);

            const feetCell = asm.grid[10][15];
            expect(feetCell.bottom).not.toBeNull();
            expect(feetCell.bottom.isGenuine).toBe(true);
            expect(feetCell.bottom.room.nameJa).toBe('武器屋');
        });

        describe('Floor Transition Feet Staircase Auto-Seeding', () => {
            it('seeds STAIR_UP (4000) when player descends to a deeper floor (Dlvl:1 -> Dlvl:2)', () => {
                const stairMockService = {
                    isAvailable: vi.fn(() => true),
                    getCellInfo: vi.fn((x, y) => {
                        if (x === 18 && y === 12) {
                            return { x, y, typ: 26, flags: 0, lit: true, roomno: 0, door: null }; // STAIRS
                        }
                        return { x, y, typ: 25, flags: 0, lit: false, roomno: 0, door: null };
                    }),
                    getRoomType: vi.fn(() => null),
                    getTrapAt: vi.fn(() => null),
                    getEngravingAt: vi.fn(() => null),
                    getFullMonsterAt: vi.fn(() => null)
                };

                const testAsm = new AreaStateManager(80, 24, null, stairMockService);
                testAsm.setCurrentFloor('Dlvl:1');
                // Dlvl:2 へ階層移動
                testAsm.setCurrentFloor('Dlvl:2');
                testAsm.updatePlayerPosition(18, 12);

                const key = 'Dlvl:2:18,12';
                expect(testAsm.stairCache.has(key)).toBe(true);
                const stair = testAsm.stairCache.get(key);
                expect(stair.glyph).toBe(3998); // 上り階段 (STAIR_UP: 3998)
                expect(stair.cmapFlags.isStairUp).toBe(true);

                // ランドマーク台帳にも登録されていること
                const lmKey = 'Dlvl:2:18,12:STAIR_UP';
                expect(testAsm.landmarkCache.has(lmKey)).toBe(true);

                // 足元セルにも即時反映されていること
                const cell = testAsm.grid[12][18];
                expect(cell.bottom).not.toBeNull();
                expect(cell.bottom.glyph).toBe(3998);
            });

            it('seeds STAIR_DOWN (3999) when player ascends to a shallower floor (Dlvl:2 -> Dlvl:1)', () => {
                const stairMockService = {
                    isAvailable: vi.fn(() => true),
                    getCellInfo: vi.fn((x, y) => {
                        if (x === 10 && y === 8) {
                            return { x, y, typ: 26, flags: 0, lit: true, roomno: 0, door: null }; // STAIRS
                        }
                        return { x, y, typ: 25, flags: 0, lit: false, roomno: 0, door: null };
                    }),
                    getRoomType: vi.fn(() => null),
                    getTrapAt: vi.fn(() => null),
                    getEngravingAt: vi.fn(() => null),
                    getFullMonsterAt: vi.fn(() => null)
                };

                const testAsm = new AreaStateManager(80, 24, null, stairMockService);
                testAsm.setCurrentFloor('Dlvl:2');
                // Dlvl:1 へ階層移動 (浅い階へ上る)
                testAsm.setCurrentFloor('Dlvl:1');
                testAsm.updatePlayerPosition(10, 8);

                const key = 'Dlvl:1:10,8';
                expect(testAsm.stairCache.has(key)).toBe(true);
                const stair = testAsm.stairCache.get(key);
                expect(stair.glyph).toBe(3999); // 下り階段 (STAIR_DOWN: 3999)
                expect(stair.cmapFlags.isStairDown).toBe(true);

                const lmKey = 'Dlvl:1:10,8:STAIR_DOWN';
                expect(testAsm.landmarkCache.has(lmKey)).toBe(true);
            });

            it('seeds LADDER (4000/4001) properly according to ascend/descend progression', () => {
                const ladderMockService = {
                    isAvailable: vi.fn(() => true),
                    getCellInfo: vi.fn((x, y) => {
                        return { x, y, typ: 27, flags: 0, lit: true, roomno: 0, door: null }; // LADDER
                    }),
                    getRoomType: vi.fn(() => null),
                    getTrapAt: vi.fn(() => null),
                    getEngravingAt: vi.fn(() => null),
                    getFullMonsterAt: vi.fn(() => null)
                };

                const testAsm = new AreaStateManager(80, 24, null, ladderMockService);
                testAsm.setCurrentFloor('Dlvl:2');
                testAsm.setCurrentFloor('Dlvl:3'); // 深層へ移動
                testAsm.updatePlayerPosition(5, 5);

                expect(testAsm.stairCache.get('Dlvl:3:5,5').glyph).toBe(4000); // 上りハシゴ: 4000

                // 上層へ移動
                testAsm.setCurrentFloor('Dlvl:2');
                testAsm.updatePlayerPosition(6, 6);
                expect(testAsm.stairCache.get('Dlvl:2:6,6').glyph).toBe(4001); // 下りハシゴ: 4001
            });

            it('seeds STAIR_UP (3998) on floor descent (Dlvl:1 -> Dlvl:2) via directBindingService getCellInfo (typ === 26)', () => {
                const stairMockService = {
                    isAvailable: vi.fn(() => true),
                    getCellInfo: vi.fn((x, y) => {
                        if (x === 14 && y === 11) {
                            return { x, y, typ: 26, flags: 0, lit: true, roomno: 0, door: null }; // STAIRS
                        }
                        return { x, y, typ: 25, flags: 0, lit: false, roomno: 0, door: null };
                    }),
                    getRoomType: vi.fn(() => null),
                    getTrapAt: vi.fn(() => null),
                    getEngravingAt: vi.fn(() => null),
                    getFullMonsterAt: vi.fn(() => null)
                };

                const testAsm = new AreaStateManager(80, 24, null, stairMockService);
                testAsm.setCurrentFloor('Dlvl:1');
                testAsm.setCurrentFloor('Dlvl:2'); // フロア遷移
                testAsm.updatePlayerPosition(14, 11);

                const key = 'Dlvl:2:14,11';
                expect(testAsm.stairCache.has(key)).toBe(true);
                const stair = testAsm.stairCache.get(key);
                expect(stair.glyph).toBe(3998); // 上り階段 (STAIR_UP: 3998)
                expect(stair.cmapFlags.isStairUp).toBe(true);

                // セル底面にも階段が反映されていること
                expect(testAsm.grid[11][14].bottom.glyph).toBe(3998);

                // その後、ペットがそのマスに乗った場合 (updateGlyph) でも階段が維持されること
                testAsm.updateGlyph(14, 11, 766); // ペット (イヌ)
                expect(testAsm.grid[11][14].bottom.glyph).toBe(3998); // 階段維持！
                expect(testAsm.grid[11][14].top.rawGlyph).toBe(766);   // ペットが Top
            });

            it('NEVER seeds stairs when falling through trapdoor/pit or level teleports to a room floor (typ === 25)', () => {
                const roomMockService = {
                    isAvailable: vi.fn(() => true),
                    getCellInfo: vi.fn((x, y) => {
                        return { x, y, typ: 25, flags: 0, lit: true, roomno: 1, door: null }; // ROOM
                    }),
                    getRoomType: vi.fn(() => null),
                    getTrapAt: vi.fn(() => null),
                    getEngravingAt: vi.fn(() => null),
                    getFullMonsterAt: vi.fn(() => null)
                };

                const testAsm = new AreaStateManager(80, 24, null, roomMockService);
                testAsm.setCurrentFloor('Dlvl:1');
                testAsm.setCurrentFloor('Dlvl:2'); // 落とし穴で Dlvl:2 へ落下

                // 落下先は部屋床 (typ: 25)
                testAsm.updatePlayerPosition(20, 10);

                const key = 'Dlvl:2:20,10';
                // 🎯 階段キャッシュには絶対にシードされない！
                expect(testAsm.stairCache.has(key)).toBe(false);
                // 階段が生成されていないこと (bottom は階段ではない)
                expect(testAsm.grid[10][20].bottom?.cmapFlags?.isStairUp).toBeFalsy();
                expect(testAsm.grid[10][20].bottom?.glyph).not.toBe(4000);
            });
        });

        describe('Universal Confirmed Terrain Glyph Protection (Altar, Door, Stairs)', () => {
            it('should preserve altar glyph (4009 lawful / 4007 chaotic) and merge metadata when player steps on it', () => {
                const mockDirectService = {
                    isAvailable: vi.fn(() => true),
                    getCellInfo: vi.fn((x, y) => {
                        return {
                            x,
                            y,
                            typ: 32, // ALTAR
                            flags: 0x04, // AM_LAWFUL
                            lit: true,
                            roomno: 1,
                            door: null,
                            altar: { alignment: 'lawful', alignmentJa: '秩序', isSanctum: false, isShrine: false, glyph: 4009 }
                        };
                    }),
                    getRoomType: vi.fn(() => ({ roomno: 1, rtype: 10, isShop: false, name: 'Temple', nameJa: '寺院' })),
                    getTrapAt: vi.fn(() => null),
                    getEngravingAt: vi.fn(() => null),
                    getFullMonsterAt: vi.fn(() => null)
                };

                const testAsm = new AreaStateManager(80, 24, null, mockDirectService);
                testAsm.setCurrentFloor('Dlvl:5');

                // 1. print_glyph で秩序の祭壇 (4009) を観測
                testAsm.updateGlyph(25, 10, 4009);
                expect(testAsm.grid[10][25].bottom.glyph).toBe(4009);
                expect(testAsm.grid[10][25].bottom.cmapFlags.isAltar).toBe(true);

                // 2. プレイヤーが祭壇マス (25, 10) に移動
                testAsm.updatePlayerPosition(25, 10);

                // 🎯 祭壇グリフ 4009 が中立 (4008) に上書きされず、100% 維持されること！
                expect(testAsm.grid[10][25].bottom.glyph).toBe(4009);
                expect(testAsm.grid[10][25].bottom.isGenuine).toBe(true);
                expect(testAsm.grid[10][25].bottom.altar?.alignment).toBe('lawful');
                expect(testAsm.grid[10][25].bottom.room?.nameJa).toBe('寺院');

                // 3. syncPlayerFeetFloor の実行でもグリフ 4009 が保持されること
                testAsm.syncPlayerFeetFloor();
                expect(testAsm.grid[10][25].bottom.glyph).toBe(4009);
            });

            it('should resolve correct altar glyph from cellInfo.flags when bottom is unconfirmed', () => {
                const mockDirectService = {
                    isAvailable: vi.fn(() => true),
                    getCellInfo: vi.fn((x, y) => {
                        return {
                            x,
                            y,
                            typ: 32, // ALTAR
                            flags: 0x01, // AM_CHAOTIC (混沌)
                            lit: true,
                            roomno: 0,
                            door: null,
                            altar: { alignment: 'chaotic', alignmentJa: '混沌', isSanctum: false, isShrine: false, glyph: 4007 }
                        };
                    }),
                    getRoomType: vi.fn(() => null),
                    getTrapAt: vi.fn(() => null),
                    getEngravingAt: vi.fn(() => null),
                    getFullMonsterAt: vi.fn(() => null),
                    _cachedLevelGlyphs: new Int32Array(80 * 24).fill(3992)
                };
                mockDirectService._cachedLevelGlyphs[8 * 80 + 15] = 4007; // (15, 8): 混沌の祭壇 (ALTAR)

                const testAsm = new AreaStateManager(80, 24, null, mockDirectService);
                testAsm.setCurrentFloor('Dlvl:7');

                // print_glyph 未受信マスで getGenuineFloor を取得
                const floor = testAsm.getGenuineFloor(15, 8);
                expect(floor).not.toBeNull();
                expect(floor.typ).toBe(32);
                // 🎯 cellInfo.altar のアライメントから 4007 (混沌) が解決されること
                expect(floor.glyph).toBe(4007);
                expect(floor.altar.alignment).toBe('chaotic');
            });
        });
    });

    describe('Sync Barrier Rendering Gating (pendingDirtyCells)', () => {
        it('gates dirty cells during turn transition and flushes them on commitTurnState', () => {
            const asm = new AreaStateManager(80, 24);
            asm.clearDirtyCells();
            expect(asm.getDirtyCells().size).toBe(0);

            // Phase 1 (ACTION): ターン遷移開始
            asm.beginTurnTransition();
            expect(asm.isTurnTransitioning).toBe(true);

            // ストリーミング中に print_glyph 更新が発生
            asm.updateGlyph(10, 10, 3992);
            asm.updateGlyph(11, 10, 381);
            asm.markDirty(12, 10);

            // 🎯 レンダリング非遮断: isTurnTransitioning のブロックを撤廃し、ターン遷移中も即時差分セルを取得可能
            expect(asm.getDirtyCells().size).toBe(3);
            expect(asm.getDirtyCells().has('10,10')).toBe(true);
            expect(asm.getDirtyCells().has('11,10')).toBe(true);
            expect(asm.getDirtyCells().has('12,10')).toBe(true);
            expect(asm.pendingDirtyCells.has('10,10')).toBe(true);
            expect(asm.pendingDirtyCells.has('11,10')).toBe(true);
            expect(asm.pendingDirtyCells.has('12,10')).toBe(true);

            // Phase 4 (COMMIT): 全DirectBinding同期完了後の状態確定コミット
            asm.commitTurnState();
            expect(asm.isTurnTransitioning).toBe(false);

            // コミット後も dirtyCells に全座標が保持されている
            const dirty = asm.getDirtyCells();
            expect(dirty.size).toBe(3);
            expect(dirty.has('10,10')).toBe(true);
            expect(dirty.has('11,10')).toBe(true);
            expect(dirty.has('12,10')).toBe(true);
            expect(asm.pendingDirtyCells.size).toBe(0);
        });

        it('adds directly to dirtyCells when not transitioning', () => {
            const asm = new AreaStateManager(80, 24);
            asm.clearDirtyCells();

            expect(asm.isTurnTransitioning).toBe(false);
            asm.markDirty(5, 5);

            expect(asm.getDirtyCells().has('5,5')).toBe(true);
            expect(asm.pendingDirtyCells.size).toBe(0);
        });
    });
});



