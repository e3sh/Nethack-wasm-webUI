import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AreaStateManager } from '../../../../src/core/knowledge/state/AreaStateManager.js';
import { InventoryStateManager } from '../../../../src/core/knowledge/state/InventoryStateManager.js';
import { StructuredKnowledgeEngine } from '../../../../src/core/knowledge/engines/StructuredKnowledgeEngine.js';
import { TerrainInferenceEngine } from '../../../../src/core/knowledge/state/area/TerrainInferenceEngine.js';
import { GLYPH_OFFSETS, ENTITY_TYPES, getItemInfoFromOnum, getCategoryFromOnum } from '../../../../src/core/knowledge/engines/glyphClassifier.js';

describe('Stage 8.3-C: Direct Binding 確定情報（Ground Truth）純化 ＆ 地形・インベントリ不具合是正テスト', () => {

    describe('1. 足元地形・エンティティ Glyph 表示の是正', () => {
        let asm;
        let mockDirectBindingService;

        beforeEach(() => {
            asm = new AreaStateManager(80, 21);
            mockDirectBindingService = {
                isAvailable: () => true,
                getCellInfo: (x, y) => ({
                    typ: 23, // DOOR
                    flags: 0, // D_NODOOR
                    door: {
                        isOpen: false,
                        isClosed: false,
                        isBroken: false,
                        isLocked: false,
                        isNoDoor: true
                    }
                }),
                getObjectsAt: (x, y) => [],
                hasFloorObjectsCacheAt: () => true,
                getEngravingAt: () => null,
                getTrapAt: () => null
            };
            asm.directBindingService = mockDirectBindingService;
        });



        it('(2) 目視確定済みの横向き開扉(3987)の上にプレイヤーが移動した際、縦向き(3986)で上書きされず横向きが維持されること', () => {
            // セルに目視で確定した横向き開扉 (3987) をセット
            const cell = asm.grid[5][10];
            cell.bottom = {
                type: ENTITY_TYPES.TERRAIN,
                glyph: 3987,
                rawGlyph: 3987
            };

            // DirectBindingService からは open door (isOpen: true) が返る
            mockDirectBindingService.getCellInfo = () => ({
                typ: 23,
                flags: 2, // D_ISOPEN
                door: { isOpen: true, isClosed: false, isBroken: false, isNoDoor: false }
            });

            // プレイヤーが (10, 5) に移動
            asm.updatePlayerPosition(10, 5);

            expect(cell.bottom.glyph).toBe(3987); // 3986 (縦) ではなく 3987 (横) が維持される
        });

        it('(3) 目視確定済みの横向き閉扉(3989)の上に移動した際、横向き閉扉が維持されること', () => {
            const cell = asm.grid[5][10];
            cell.bottom = {
                type: ENTITY_TYPES.TERRAIN,
                glyph: 3989,
                rawGlyph: 3989
            };

            mockDirectBindingService.getCellInfo = () => ({
                typ: 23,
                flags: 4, // D_CLOSED
                door: { isOpen: false, isClosed: true, isBroken: false, isNoDoor: false }
            });

            asm.updatePlayerPosition(10, 5);
            expect(cell.bottom.glyph).toBe(3989); // 3988 (縦) ではなく 3989 (横) が維持される
        });

        it('(4) 足元の死体(onum: 265)・像(onum: 476)が corpsenm に応じた専用グリフになること', () => {
            const cell = asm.grid[5][10];
            asm.playerX = 10;
            asm.playerY = 5;

            // corpsenm: 0 (giant ant) の死体
            mockDirectBindingService.getObjectsAt = () => ([{
                onum: 265,
                otyp: 265,
                corpsenm: 0,
                quan: 1
            }]);

            asm.syncPlayerFeetObjects(10, 5);
            expect(cell.middle).not.toBeNull();
            expect(cell.middle.glyph).toBe(GLYPH_OFFSETS.GLYPH_BODY_OFF + 0);

            // corpsenm: 1 (killer bee) の像
            mockDirectBindingService.getObjectsAt = () => ([{
                onum: 476,
                otyp: 476,
                corpsenm: 1,
                quan: 1
            }]);

            asm.syncPlayerFeetObjects(10, 5);
            expect(cell.middle.glyph).toBe(GLYPH_OFFSETS.GLYPH_STATUE_OFF + 1);
        });

        it('(5) ドアを閉めた際(print_glyphで3989受信後)、足元同期(syncPlayerFeetFloor)が走っても横向き閉扉(3989)が保護されること', () => {
            const cell = asm.grid[5][10];
            asm.playerX = 10;
            asm.playerY = 5;

            // NetHack Cコアからドアを閉めた描画ストリーム (print_glyph) を受信
            asm.updateGlyph(10, 5, 3989);
            expect(cell.bottom.glyph).toBe(3989);

            // DirectBindingService からは向きを持たないドア情報 (typ: 23, D_CLOSED) が同期される
            mockDirectBindingService.getCellInfo = (x, y) => {
                if (x === 10 && y === 5) {
                    return {
                        typ: 23,
                        flags: 4, // D_CLOSED
                        door: { isOpen: false, isClosed: true, isBroken: false, isNoDoor: false }
                    };
                }
                return null;
            };

            // 足元同期を実行しても、print_glyph で確定した 3989 が上書きされず保護される
            asm.syncPlayerFeetFloor();
            expect(cell.bottom.glyph).toBe(3989);
            expect(cell.bottom.door.isClosed).toBe(true);
        });

        it('(6) ドアを開けた際(print_glyphで3987受信後)、足元同期(syncPlayerFeetFloor)が走っても横向き開扉(3987)が保護されること', () => {
            const cell = asm.grid[5][10];
            asm.playerX = 10;
            asm.playerY = 5;

            // NetHack Cコアからドアを開けた描画ストリーム (print_glyph) を受信
            asm.updateGlyph(10, 5, 3987);
            expect(cell.bottom.glyph).toBe(3987);

            // DirectBindingService からは向きを持たないドア情報 (typ: 23, D_ISOPEN) が同期される
            mockDirectBindingService.getCellInfo = (x, y) => {
                if (x === 10 && y === 5) {
                    return {
                        typ: 23,
                        flags: 2, // D_ISOPEN
                        door: { isOpen: true, isClosed: false, isBroken: false, isNoDoor: false }
                    };
                }
                return null;
            };

            // 足元同期を実行しても、print_glyph で確定した 3987 が上書きされず保護される
            asm.syncPlayerFeetFloor();
            expect(cell.bottom.glyph).toBe(3987);
            expect(cell.bottom.door.isOpen).toBe(true);
        });

        it('(7) 横向き開扉の上で10ターン連続待機(syncPlayerFeetFloor)しても、横向き開扉(3987)が維持され続けること', () => {
            const cell = asm.grid[5][10];
            asm.playerX = 10;
            asm.playerY = 5;
            asm.updateGlyph(10, 5, 3987);

            mockDirectBindingService.getCellInfo = (x, y) => {
                if (x === 10 && y === 5) {
                    return {
                        typ: 23,
                        flags: 2, // D_ISOPEN
                        door: { isOpen: true, isClosed: false, isBroken: false, isNoDoor: false }
                    };
                }
                return null;
            };

            for (let i = 0; i < 10; i++) {
                asm.syncPlayerFeetFloor();
                expect(cell.bottom.glyph).toBe(3987);
            }
        });

        it('(8) ドアが破壊された際(print_glyphで3985受信後)、足元同期が走っても扉なし枠(3985)が正しく維持されること', () => {
            const cell = asm.grid[5][10];
            asm.playerX = 10;
            asm.playerY = 5;
            
            // 破壊されたドア枠を受信
            asm.updateGlyph(10, 5, 3985);
            expect(cell.bottom.glyph).toBe(3985);

            mockDirectBindingService.getCellInfo = (x, y) => {
                if (x === 10 && y === 5) {
                    return {
                        typ: 23,
                        flags: 1, // D_BROKEN
                        door: { isOpen: false, isClosed: false, isBroken: true, isNoDoor: false }
                    };
                }
                return null;
            };

            asm.syncPlayerFeetFloor();
            expect(cell.bottom.glyph).toBe(3985);
            expect(cell.bottom.door.isBroken).toBe(true);
        });

        it('(9) 縦向き開扉(3986)および縦向き閉扉(3988)も同様に足元同期で上書き・変異しないこと', () => {
            const cell = asm.grid[5][10];
            asm.playerX = 10;
            asm.playerY = 5;

            // 縦向き開扉
            asm.updateGlyph(10, 5, 3986);
            mockDirectBindingService.getCellInfo = () => ({
                typ: 23,
                flags: 2,
                door: { isOpen: true, isClosed: false, isBroken: false, isNoDoor: false }
            });
            asm.syncPlayerFeetFloor();
            expect(cell.bottom.glyph).toBe(3986);

            // 縦向き閉扉
            asm.updateGlyph(10, 5, 3988);
            mockDirectBindingService.getCellInfo = () => ({
                typ: 23,
                flags: 4,
                door: { isOpen: false, isClosed: true, isBroken: false, isNoDoor: false }
            });
            asm.syncPlayerFeetFloor();
            expect(cell.bottom.glyph).toBe(3988);
        });
    });

    describe('2. アイコンインベントリ・ナレッジ動作精度の是正', () => {
        let ism;
        let ske;
        let mockWasmService;

        beforeEach(() => {
            ske = new StructuredKnowledgeEngine();
            mockWasmService = {
                isAvailable: vi.fn(() => true),
                getInventory: vi.fn(() => []),
                getEquipmentPtrs: vi.fn(() => ({ slotByPtr: new Map() })),
                getInventoryWeight: vi.fn(() => 0),
                getDiscoveries: vi.fn(() => null)
            };
            ism = new InventoryStateManager({
                wasmDirectBindingService: mockWasmService,
                structuredKnowledgeEngine: ske,
                language: 'en'
            });
        });

        it('(1) glyphClassifier の魔法書 (366〜409) と杖 (410〜437) の境界が正しいこと', () => {
            expect(getCategoryFromOnum(366)).toBe('SPELLBOOK');
            expect(getCategoryFromOnum(401)).toBe('SPELLBOOK'); // create familiar
            expect(getCategoryFromOnum(409)).toBe('SPELLBOOK'); // Book of the Dead
            expect(getCategoryFromOnum(410)).toBe('WAND');       // light wand
            expect(getCategoryFromOnum(437)).toBe('WAND');       // wishing wand
            expect(getCategoryFromOnum(438)).toBe('COIN');       // gold piece
            expect(getCategoryFromOnum(439)).toBe('GEM');        // dilithium crystal

            expect(getItemInfoFromOnum(401).category).toBe('SPELLBOOK');
            expect(getItemInfoFromOnum(410).category).toBe('WAND');
        });

        it('(2) glittering spellbook (onum: 401) が指輪(P)にならず、勉強する(r)になること', () => {
            mockWasmService.getInventory.mockReturnValue([{
                onum: 401,
                otyp: 401,
                invlet: 'a',
                quan: 1,
                spe: 0,
                ptr: 0x1001,
                flags: { bknown: false, known: false }
            }]);

            const res = ism.syncFromDirectBinding();

            expect(res).toBe(true);
            const item = ism.items[0];
            expect(item).toBeDefined();
            expect(item.name).toContain('spellbook');
            expect(item.name).not.toBe('glittering'); // 末尾 ring 誤爆で spellbook が脱落しないこと
            expect(item.defaultVerb).toBe('r');       // 指輪(P)ではなく読む/勉強する(r)
            expect(item.defaultActionLabel).toBe('Read');
        });

        it('(3) turquoise spellbook (onum: 382) が宝石・投擲(t)にならず、勉強する(r)になること', () => {
            mockWasmService.getInventory.mockReturnValue([{
                onum: 382,
                otyp: 382,
                invlet: 'b',
                quan: 1,
                spe: 0,
                ptr: 0x1002,
                flags: { bknown: false, known: false }
            }]);

            ism.syncFromDirectBinding();

            const item = ism.items[0];
            expect(item).toBeDefined();
            expect(item.isGem).toBe(false);           // 色名 turquoise で isGem にならないこと
            expect(item.defaultVerb).toBe('r');       // 投げる(t)ではなく読む/勉強する(r)
        });

        it('(4) 自作缶詰 (onum: 296, spe: -2, corpsenm: 0) が "-2 tin" にならず、ナレッジが tin wand にならないこと', () => {
            mockWasmService.getInventory.mockReturnValue([{
                onum: 296,
                otyp: 296,
                invlet: 'c',
                quan: 1,
                spe: -2, // 自作缶詰フラグ
                corpsenm: 0, // giant ant
                ptr: 0x1003,
                flags: { bknown: true, uncursed: true, known: true }
            }]);

            ism.syncFromDirectBinding();

            const item = ism.items[0];
            expect(item).toBeDefined();
            expect(item.rawText).not.toContain('-2 tin'); // -2 が強化値として付加されないこと
            expect(item.name).toContain('tin of giant ant meat');
            expect(item.defaultVerb).toBe('e'); // 食べる(e)

            // ナレッジの検証
            const knowledge = ske.getItemKnowledge(item);
            expect(knowledge.category).toBe('FOOD');
            expect(knowledge.name).not.toContain('wand'); // tin wand に化けないこと
        });

        it('(5) 所持品の死体(onum: 265)・像(onum: 476)にモンスター名が付与され、個別ナレッジが取得できること', () => {
            mockWasmService.getInventory.mockReturnValue([
                {
                    onum: 265,
                    otyp: 265,
                    invlet: 'd',
                    quan: 1,
                    spe: 0,
                    corpsenm: 0, // giant ant
                    ptr: 0x1004,
                    flags: { bknown: false, known: false }
                },
                {
                    onum: 476,
                    otyp: 476,
                    invlet: 'e',
                    quan: 1,
                    spe: 0,
                    corpsenm: 1, // killer bee
                    ptr: 0x1005,
                    flags: { bknown: false, known: false }
                }
            ]);

            ism.syncFromDirectBinding();

            const cItem = ism.items.find(i => i.letter === 'd');
            expect(cItem).toBeDefined();
            expect(cItem.name).toBe('giant ant corpse');
            expect(cItem.glyphId).toBe(GLYPH_OFFSETS.GLYPH_BODY_OFF + 0);

            const sItem = ism.items.find(i => i.letter === 'e');
            expect(sItem).toBeDefined();
            expect(sItem.name).toBe('statue of a killer bee');
            expect(sItem.glyphId).toBe(GLYPH_OFFSETS.GLYPH_STATUE_OFF + 1);

            // モンスター固有ナレッジの照合
            const cKnowledge = ske.getCorpseKnowledge(cItem);
            expect(cKnowledge).toBeDefined();
            expect(cKnowledge.nameEn || cKnowledge.name).toContain('ant');

            const sKnowledge = ske.getStatueKnowledge(sItem);
            expect(sKnowledge).toBeDefined();
            expect(sKnowledge.nameEn || sKnowledge.name).toContain('bee');
        });
    });
});
