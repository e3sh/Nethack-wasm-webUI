import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AreaStateManager } from '../../../../src/core/knowledge/state/AreaStateManager.js';
import { ENTITY_TYPES } from '../../../../src/core/knowledge/engines/glyphClassifier.js';

describe('AreaStateManager - Hybrid Architecture (Direct Glyph & Terrain typ)', () => {
    let asm;
    let mockDirectBindingService;

    beforeEach(() => {
        // 80x21 のモックデータ
        const mockTerrain = new Uint8Array(80 * 21);
        const mockGlyphs = new Int32Array(80 * 21);

        // (10, 10): 部屋床 (typ: 25, ROOM / glyph: 3992)
        mockTerrain[10 * 80 + 10] = 25;
        mockGlyphs[10 * 80 + 10] = 3992;

        // (15, 10): 開いたドア (typ: 23, DOOR / glyph: 3986)
        mockTerrain[10 * 80 + 15] = 23;
        mockGlyphs[10 * 80 + 15] = 3986;

        // (20, 10): 垂直壁 (typ: 1, VWALL / glyph: 3931)
        mockTerrain[10 * 80 + 20] = 1;
        mockGlyphs[10 * 80 + 20] = 3931;

        mockDirectBindingService = {
            isAvailable: vi.fn(() => true),
            _cachedLevelTerrain: mockTerrain,
            _cachedLevelGlyphs: mockGlyphs,
            dumpLevelTerrain: vi.fn(() => mockTerrain),
            dumpLevelGlyphs: vi.fn(() => mockGlyphs),
            setCachedLevelTerrain: vi.fn((t) => { mockDirectBindingService._cachedLevelTerrain = t; }),
            setCachedLevelGlyphs: vi.fn((g) => { mockDirectBindingService._cachedLevelGlyphs = g; }),
            getCellInfo: vi.fn((x, y) => {
                const idx = y * 80 + x;
                const typ = mockTerrain[idx] || 0;
                const isDoor = (typ === 23);
                return {
                    x,
                    y,
                    typ,
                    flags: isDoor ? 0x02 : 0, // D_ISOPEN
                    lit: true,
                    roomno: 1,
                    door: isDoor ? { isOpen: true, isClosed: false, isLocked: false, isBroken: false } : null,
                    altar: null
                };
            }),
            getRoomType: vi.fn(() => ({ roomno: 1, rtype: 18, isShop: true, name: 'Weapon Shop', nameJa: '武器屋' })),
            getTrapAt: vi.fn(() => null),
            getEngravingAt: vi.fn(() => null),
            getObjectAt: vi.fn(() => 0),
            getObjectsAt: vi.fn((x, y) => []),
            getFullMonsterAt: vi.fn(() => null)
        };

        asm = new AreaStateManager(80, 24, null, mockDirectBindingService);
    });

    describe('1. Direct Glyphs & Terrain Hybrid Resolution', () => {
        it('uses C-core _cachedLevelGlyphs for display and typ/flags for logic', () => {
            // (15, 10) 開いたドア
            const genuine = asm.getGenuineFloor(15, 10);
            expect(genuine).not.toBeNull();
            // 表示グリフ: Cコア直接グリフ (3986)
            expect(genuine.glyph).toBe(3986);
            // 論理属性: typ = 23 (DOOR), door.isOpen = true, room 武器屋
            expect(genuine.typ).toBe(23);
            expect(genuine.door).toEqual({ isOpen: true, isClosed: false, isLocked: false, isBroken: false });
            expect(genuine.room).toBeDefined();
            expect(genuine.room.nameJa).toBe('武器屋');
        });

        it('dumpLevelMap populates both terrain and glyphs and backfills observed overlays', () => {
            // マス (10, 10) にモンスターが乗っており、下層地形が未観測
            asm.grid[10][10].top = { type: ENTITY_TYPES.MONSTER, rawGlyph: 100 };
            expect(asm.grid[10][10].bottom).toBeNull();

            const ok = asm.dumpLevelMap();
            expect(ok).toBe(true);
            expect(mockDirectBindingService.dumpLevelTerrain).toHaveBeenCalled();
            expect(mockDirectBindingService.dumpLevelGlyphs).toHaveBeenCalled();

            // 下層地形が二刀流で補完されていること
            const cell = asm.grid[10][10];
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.glyph).toBe(3992);
            expect(cell.bottom.typ).toBe(25);
            expect(asm.dirtyCells.has('10,10')).toBe(true);
        });
    });

    describe('2. Dynamic Change Detection (Removal of Rigid Confirmation Protection)', () => {
        it('updates cell.bottom when terrain is modified (e.g. wall dug into room floor)', () => {
            // 最初は垂直壁 (20, 10) で観測確定
            asm.updatePlayerPosition(20, 10);
            expect(asm.grid[10][20].bottom.glyph).toBe(3931);
            expect(asm.grid[10][20].bottom.typ).toBe(1);

            asm.dirtyCells.clear();

            // 壁が掘削されて部屋床 (typ: 25, glyph: 3992) に動的変化
            mockDirectBindingService._cachedLevelTerrain[10 * 80 + 20] = 25;
            mockDirectBindingService._cachedLevelGlyphs[10 * 80 + 20] = 3992;

            // 変化検知による同期
            asm.syncPlayerFeetFloor();

            // 硬直化せず最新の床に更新されること
            expect(asm.grid[10][20].bottom.glyph).toBe(3992);
            expect(asm.grid[10][20].bottom.typ).toBe(25);
            expect(asm.dirtyCells.has('20,10')).toBe(true);
        });

        it('updates cell.bottom when door state changes (e.g. closed -> open)', () => {
            // 最初は閉じたドア
            mockDirectBindingService._cachedLevelGlyphs[10 * 80 + 15] = 3988; // S_vcdoor
            mockDirectBindingService.getCellInfo = vi.fn(() => ({
                x: 15, y: 10, typ: 23, flags: 0x04, lit: true, roomno: 0,
                door: { isOpen: false, isClosed: true, isLocked: false, isBroken: false }
            }));

            asm.updatePlayerPosition(15, 10);
            expect(asm.grid[10][15].bottom.glyph).toBe(3988);
            expect(asm.grid[10][15].bottom.door.isClosed).toBe(true);

            asm.dirtyCells.clear();

            // ドアが開いた (glyph: 3986, isOpen: true)
            mockDirectBindingService._cachedLevelGlyphs[10 * 80 + 15] = 3986; // S_vodoor
            mockDirectBindingService.getCellInfo = vi.fn(() => ({
                x: 15, y: 10, typ: 23, flags: 0x02, lit: true, roomno: 0,
                door: { isOpen: true, isClosed: false, isLocked: false, isBroken: false }
            }));

            asm.syncPlayerFeetFloor();

            // 開いたドアに即時追従
            expect(asm.grid[10][15].bottom.glyph).toBe(3986);
            expect(asm.grid[10][15].bottom.door.isOpen).toBe(true);
            expect(asm.dirtyCells.has('15,10')).toBe(true);
        });
    });

    describe('3. Monster Feet Objects Synchronization (syncMonstersFeetObjects)', () => {
        it('synchronizes floor objects under monsters accurately', () => {
            // (12, 10) にモンスターが存在
            asm.grid[10][12].top = { type: ENTITY_TYPES.MONSTER, rawGlyph: 200, name: 'orc' };
            expect(asm.grid[10][12].middle).toBeNull();

            // モンスター足元にアイテムスタック (金貨 + 短剣) が存在
            const mockFloorItems = [
                { onum: 3886, otyp: 0, oclass: 1, quan: 50, glyph: 3886, isPile: true },
                { onum: 1, otyp: 1, oclass: 2, quan: 1, glyph: 4800, isPile: true }
            ];
            mockDirectBindingService.getObjectsAt.mockImplementation((x, y) => {
                if (x === 12 && y === 10) return mockFloorItems;
                return [];
            });

            // モンスター足元アイテム同期を実行
            const changed = asm.syncMonstersFeetObjects();
            expect(changed).toBe(true);

            // cell.middle に山積みアイテムが反映されていること
            const cell = asm.grid[10][12];
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.isPile).toBe(true);
            expect(cell.middle.floorObjects).toHaveLength(2);
            expect(asm.dirtyCells.has('12,10')).toBe(true);
        });

        it('clears cell.middle when monster picks up the item', () => {
            // (12, 10) にモンスターとアイテムが存在
            asm.grid[10][12].top = { type: ENTITY_TYPES.MONSTER, rawGlyph: 200 };
            asm.grid[10][12].middle = { glyph: 3886, isPile: false, floorObjects: [{ onum: 3886 }] };

            asm.dirtyCells.clear();

            // モンスターがアイテムを拾って足元が 0 件になった
            mockDirectBindingService.getObjectsAt.mockReturnValue([]);

            const changed = asm.syncMonstersFeetObjects();
            expect(changed).toBe(true);
            expect(asm.grid[10][12].middle).toBeNull();
            expect(asm.dirtyCells.has('12,10')).toBe(true);
        });
    });
});
