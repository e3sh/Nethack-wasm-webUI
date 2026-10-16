import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AreaStateManager } from '../../../../src/core/knowledge/state/AreaStateManager.js';
import { ENTITY_TYPES } from '../../../../src/core/knowledge/engines/glyphClassifier.js';
import { VirtualDungeonScreen } from '../../../../examples/gkl-pure-js-client/modules/renderers/VirtualDungeonScreen.js';

describe('C-Core Direct Glyph Floor Underlay & Multi-Layer Rendering Normalization', () => {
    let asm;
    let mockDirectBindingService;

    beforeEach(() => {
        const mockTerrain = new Uint8Array(80 * 21);
        const mockGlyphs = new Int32Array(80 * 21);

        // (10, 10): 部屋床 (typ: 25, ROOM / glyph: 3992)
        mockTerrain[10 * 80 + 10] = 25;
        mockGlyphs[10 * 80 + 10] = 3992;

        // (15, 10): 通路 (typ: 24, CORR / glyph: 3995)
        mockTerrain[10 * 80 + 15] = 24;
        mockGlyphs[10 * 80 + 15] = 3995;

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
                return {
                    x,
                    y,
                    typ,
                    flags: 0,
                    lit: true,
                    roomno: typ === 25 ? 1 : 0,
                    door: null,
                    altar: null
                };
            }),
            getRoomType: vi.fn(() => null),
            getTrapAt: vi.fn(() => null),
            getEngravingAt: vi.fn(() => null),
            getObjectAt: vi.fn(() => 0),
            getObjectsAt: vi.fn(() => []),
            getFullMonsterAt: vi.fn(() => null)
        };

        asm = new AreaStateManager(80, 24, null, mockDirectBindingService);
    });

    describe('1. C-Core Base Floor Constant Underlay (dumpLevelMap & deployLevelBaseTerrain)', () => {
        it('deploys genuine floor to cell.bottom across 80x21 cells', () => {
            expect(asm.grid[10][10].bottom).toBeNull();
            expect(asm.grid[10][15].bottom).toBeNull();

            const ok = asm.dumpLevelMap();
            expect(ok).toBe(true);

            // (10, 10) 部屋床が cell.bottom に展開されていること
            const roomCell = asm.grid[10][10];
            expect(roomCell.bottom).not.toBeNull();
            expect(roomCell.bottom.glyph).toBe(3992);
            expect(roomCell.bottom.typ).toBe(25);
            expect(roomCell.bottom.isGenuine).toBe(true);

            // (15, 10) 通路床が cell.bottom に展開されていること
            const corrCell = asm.grid[10][15];
            expect(corrCell.bottom).not.toBeNull();
            expect(corrCell.bottom.glyph).toBe(3995);
            expect(corrCell.bottom.typ).toBe(24);
        });

        it('preserves existing floor underlay when an item appears (No floor dropout / black hole)', () => {
            asm.dumpLevelMap();

            const roomCell = asm.grid[10][10];
            expect(roomCell.bottom.glyph).toBe(3992);

            // (10, 10) にアイテム出現 (GLYPH_OBJ_OFF: 3448 + 10 = 3458: 食料/アイテム)
            const itemGlyphId = 3458;
            asm.updateGlyph(10, 10, itemGlyphId, { glyph: itemGlyphId, ch: '%' });

            // cell.middle にアイテムがセットされ、cell.bottom の真床は維持されること (床抜け防止)
            expect(roomCell.middle).not.toBeNull();
            expect(roomCell.middle.glyph).toBe(itemGlyphId);
            expect(roomCell.bottom).not.toBeNull();
            expect(roomCell.bottom.glyph).toBe(3992);
            expect(roomCell.bottom.isGenuine).toBe(true);
        });
    });

    describe('2. Unblocking Dirty Cells during Turn Transition', () => {
        it('does not block getDirtyCells() when isTurnTransitioning is true', () => {
            asm.clearDirtyCells();
            expect(asm.getDirtyCells().size).toBe(0);

            // ターン遷移開始
            asm.beginTurnTransition();
            expect(asm.isTurnTransitioning).toBe(true);

            // アイテム出現または変更
            asm.markDirty(10, 10);

            // ゲーティングが撤廃され、即座に dirtyCells に反映されること
            expect(asm.getDirtyCells().has('10,10')).toBe(true);
            expect(asm.getDirtyCells().size).toBe(1);
        });
    });

    describe('3. Multi-Layer Rendering & Item Clearance in VirtualDungeonScreen', () => {
        let mockCtx;

        beforeEach(() => {
            mockCtx = {
                fillStyle: '',
                fillRect: vi.fn(),
                drawImage: vi.fn()
            };
        });

        it('draws both bottom floor and middle item, then clears item cleanly when picked up', () => {
            const vScreen = new VirtualDungeonScreen({ tileSize: 32, cols: 80, rows: 24 });
            vScreen.bgCtx = mockCtx;
            vScreen.tileLoaded = true;

            const drawTileSpy = vi.spyOn(vScreen, 'drawTile');

            asm.dumpLevelMap();
            // (10, 10) にアイテム出現 (3458)
            asm.updateGlyph(10, 10, 3458, { glyph: 3458, ch: '%' });

            // レンダラーに反映
            vScreen.markDirty(10, 10);
            vScreen.flushDirtyCells(asm.grid);

            // Layer 1 (床: 3992) と Layer 2 (アイテム: 3458) の両方が描画されたこと
            expect(drawTileSpy).toHaveBeenCalledWith(
                expect.anything(),
                3992, // 床
                10 * 32, 10 * 32, 32, 32, 0, expect.any(Function)
            );
            expect(drawTileSpy).toHaveBeenCalledWith(
                expect.anything(),
                3458, // アイテム
                10 * 32, 10 * 32, 32, 32, 0, expect.any(Function)
            );

            drawTileSpy.mockClear();

            // アイテムを拾って cell.middle = null になる
            mockDirectBindingService.getObjectsAt.mockReturnValue([]);
            const changed = asm.syncCellObjects(10, 10);
            expect(changed).toBe(true);
            expect(asm.grid[10][10].middle).toBeNull();
            expect(asm.getDirtyCells().has('10,10')).toBe(true);

            // 次の描画フレーム
            vScreen.markCellsDirty(asm.getDirtyCells());
            vScreen.flushDirtyCells(asm.grid);

            // 床 (3992) のみが描画され、アイテム (3458) は描画されないこと（アイテム消去）
            expect(drawTileSpy).toHaveBeenCalledWith(
                expect.anything(),
                3992, // 床
                10 * 32, 10 * 32, 32, 32, 0, expect.any(Function)
            );
            const drawnGlyphs = drawTileSpy.mock.calls.map(call => call[1]);
            expect(drawnGlyphs).not.toContain(3458);
        });

        it('draws genuine floor even without glyphInfo.ch (elimination of inference char dependency)', () => {
            const vScreen = new VirtualDungeonScreen({ tileSize: 32, cols: 80, rows: 24 });
            vScreen.bgCtx = mockCtx;
            vScreen.tileLoaded = true;
            const drawTileSpy = vi.spyOn(vScreen, 'drawTile');

            // cell.bottom に glyphInfo.ch がない (or 空白) 正規グリフ
            asm.grid[10][10].bottom = {
                type: ENTITY_TYPES.TERRAIN,
                rawGlyph: 3992,
                glyph: 3992,
                isGenuine: true
            };

            vScreen.markDirty(10, 10);
            vScreen.flushDirtyCells(asm.grid);

            // 推測文字に依存せず確実に床が描画されること
            expect(drawTileSpy).toHaveBeenCalledWith(
                expect.anything(),
                3992,
                10 * 32, 10 * 32, 32, 32, 0, expect.any(Function)
            );
        });
    });

    describe('4. Received Glyph (print_glyph) Priority & Anti-Corruption Protection', () => {
        it('prioritizes received terrain glyph (e.g. corner wall 3933) and protects it against dumpLevelMap overwrite', () => {
            // (5, 5) に NetHack から角壁 (3933: S_urcorner) を受信
            asm.updateGlyph(5, 5, 3933, { glyph: 3933, ch: '+' });
            const cell = asm.grid[5][5];
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.glyph).toBe(3933);
            expect(cell.bottom.fromPrintGlyph).toBe(true);

            // Cコア側は typ=1 (一般的な壁) を保持しており、逆算推論だと 3930 になる状態
            mockDirectBindingService._cachedLevelTerrain[5 * 80 + 5] = 1;
            mockDirectBindingService.getCellInfo.mockImplementation((x, y) => {
                if (x === 5 && y === 5) {
                    return { x, y, typ: 1, flags: 0, lit: true, roomno: 0, door: null, altar: null };
                }
                return { x, y, typ: 0, flags: 0, lit: true, roomno: 0, door: null, altar: null };
            });

            // dumpLevelMap() が実行されても、受信した角壁 (3933) が保護され、3930 等に化けないこと
            asm.dumpLevelMap();
            expect(cell.bottom.glyph).toBe(3933);
            expect(cell.bottom.fromPrintGlyph).toBe(true);

            // syncFromDirectBinding() が実行されても保護されること
            asm.syncFromDirectBinding(0);
            expect(cell.bottom.glyph).toBe(3933);
        });

        it('updates terrain when physical change (e.g. wall dug into room floor typ: 25) actually occurs', () => {
            // 最初は角壁 (3933)
            asm.updateGlyph(5, 5, 3933);
            expect(asm.grid[5][5].bottom.glyph).toBe(3933);

            // 掘削により typ が 25 (ROOM floor) に物理的変化
            mockDirectBindingService._cachedLevelTerrain[5 * 80 + 5] = 25;
            mockDirectBindingService._cachedLevelGlyphs[5 * 80 + 5] = 3992;
            mockDirectBindingService.getCellInfo.mockImplementation((x, y) => {
                if (x === 5 && y === 5) {
                    return { x, y, typ: 25, flags: 0, lit: true, roomno: 1, door: null, altar: null };
                }
                return { x, y, typ: 0, flags: 0, lit: true, roomno: 0, door: null, altar: null };
            });

            // (5, 5) のプレイヤー足元として同期
            asm.playerX = 5;
            asm.playerY = 5;
            asm.syncPlayerFeetFloor();
            expect(asm.grid[5][5].bottom.glyph).toBe(3992);
            expect(asm.grid[5][5].bottom.typ).toBe(25);
        });

        it('keeps open door glyph (3986/3987) when player steps on the door cell without collapsing into closed door', () => {
            // (6, 6) に C コアから開いた縦扉 (3986: S_vodoor) を受信
            asm.updateGlyph(6, 6, 3986, { glyph: 3986, ch: '-' });
            const cell = asm.grid[6][6];
            expect(cell.bottom.glyph).toBe(3986);

            // Cコア側のセル情報は DOOR (typ=23)
            // 不完全な Worker キャッシュ等で flags=0 (isNoDoor: true / isOpen: false) になっていても、
            // 開いた扉が閉じた扉 (3988) に化けてはならない
            mockDirectBindingService._cachedLevelTerrain[6 * 80 + 6] = 23;
            mockDirectBindingService.getCellInfo.mockImplementation((x, y) => {
                if (x === 6 && y === 6) {
                    return {
                        x, y, typ: 23, flags: 0, lit: true, roomno: 0,
                        door: { isOpen: false, isClosed: false, isBroken: false, isNoDoor: true }
                    };
                }
                return { x, y, typ: 0, flags: 0, lit: true, roomno: 0, door: null, altar: null };
            });

            // プレイヤーが開いた扉 (6, 6) に乗る (updatePlayerPosition)
            asm.updatePlayerPosition(6, 6);
            expect(cell.bottom.glyph).toBe(3986); // 閉じた扉 (3988) に化けない！

            // ターン毎の足元同期 (syncPlayerFeetFloor) が実行されても開いた扉を維持
            asm.syncPlayerFeetFloor();
            expect(cell.bottom.glyph).toBe(3986);

            // 周辺セル同期 (syncFromDirectBinding) が実行されても開いた扉を維持
            asm.syncFromDirectBinding(1);
            expect(cell.bottom.glyph).toBe(3986);
        });

        it('does NOT revert dug wall to wall when player steps on it even if initial cache was wall (3930)', () => {
            const x = 7, y = 7;
            // 1. フロア初期ダンプ時: (7, 7) は壁 (typ: 1, glyph: 3930) だった
            mockDirectBindingService._cachedLevelTerrain[y * 80 + x] = 1;
            mockDirectBindingService._cachedLevelGlyphs[y * 80 + x] = 3930;
            asm.dumpLevelMap();
            expect(asm.grid[y][x].bottom.glyph).toBe(3930);

            // 2. プレイヤーがつるはしで掘削し、Cコアから print_glyph で通路 (3995) を受信
            mockDirectBindingService.getCellInfo.mockImplementation((cx, cy) => {
                if (cx === x && cy === y) {
                    return { x: cx, y: cy, typ: 24, flags: 0, lit: true, roomno: 0, door: null, altar: null };
                }
                return { x: cx, y: cy, typ: 0, flags: 0, lit: true, roomno: 0, door: null, altar: null };
            });
            // NetHack Cコアの back_to_glyph はリアルタイムに通路 (3995) を返す
            mockDirectBindingService.getCellGlyph = vi.fn((cx, cy) => (cx === x && cy === y ? 3995 : null));

            asm.updateGlyph(x, y, 3995, { glyph: 3995, ch: '#' });
            expect(asm.grid[y][x].bottom.glyph).toBe(3995);
            expect(asm.grid[y][x].bottom.fromPrintGlyph).toBe(true);

            // 3. プレイヤーが掘削したマスに乗る (updatePlayerPosition & syncPlayerFeetFloor)
            asm.updatePlayerPosition(x, y);
            expect(asm.grid[y][x].bottom.glyph).toBe(3995); // 壁 (3930) に戻らないこと！

            asm.syncPlayerFeetFloor();
            expect(asm.grid[y][x].bottom.glyph).toBe(3995);

            asm.syncFromDirectBinding(1);
            expect(asm.grid[y][x].bottom.glyph).toBe(3995);
        });

        it('does NOT revert opened door to closed door when player walks through it even if initial cache was closed door (3988)', () => {
            const x = 8, y = 8;
            // 1. フロア初期ダンプ時: (8, 8) は閉じた扉 (typ: 23, glyph: 3988) だった
            mockDirectBindingService._cachedLevelTerrain[y * 80 + x] = 23;
            mockDirectBindingService._cachedLevelGlyphs[y * 80 + x] = 3988;
            asm.dumpLevelMap();
            expect(asm.grid[y][x].bottom.glyph).toBe(3988);

            // 2. プレイヤーがドアを開け、Cコアから print_glyph で開扉 (3989: S_hodoor) を受信
            mockDirectBindingService.getCellInfo.mockImplementation((cx, cy) => {
                if (cx === x && cy === y) {
                    return {
                        x: cx, y: cy, typ: 23, flags: 0, lit: true, roomno: 0,
                        door: { isOpen: true, isClosed: false, isBroken: false, isNoDoor: false }
                    };
                }
                return { x: cx, y: cy, typ: 0, flags: 0, lit: true, roomno: 0, door: null, altar: null };
            });
            // NetHack Cコアの back_to_glyph はリアルタイムに開扉 (3989) を返す
            mockDirectBindingService.getCellGlyph = vi.fn((cx, cy) => (cx === x && cy === y ? 3989 : null));

            asm.updateGlyph(x, y, 3989, { glyph: 3989, ch: '-' });
            expect(asm.grid[y][x].bottom.glyph).toBe(3989);
            expect(asm.grid[y][x].bottom.fromPrintGlyph).toBe(true);

            // 3. プレイヤーが開いたドアマスを通過する (updatePlayerPosition & syncPlayerFeetFloor)
            asm.updatePlayerPosition(x, y);
            expect(asm.grid[y][x].bottom.glyph).toBe(3989); // 閉じた扉 (3988) に戻らないこと！

            asm.syncPlayerFeetFloor();
            expect(asm.grid[y][x].bottom.glyph).toBe(3989);

            asm.syncFromDirectBinding(1);
            expect(asm.grid[y][x].bottom.glyph).toBe(3989);
        });
    });
});

