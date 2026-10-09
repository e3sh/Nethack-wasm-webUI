import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AreaStateManager } from '../../../../src/core/knowledge/state/AreaStateManager.js';
import { ContextActionEngine } from '../../../../src/core/knowledge/engines/ContextActionEngine.js';
import { GLYPH_OFFSETS, ENTITY_TYPES } from '../../../../src/core/knowledge/engines/glyphClassifier.js';

describe('AreaStateManager - Wasm Direct Binding (Stage 8.3)', () => {
    let mockService;
    let asm;

    beforeEach(() => {
        mockService = {
            isAvailable: vi.fn(() => true),
            getCellInfo: vi.fn((x, y) => ({
                x,
                y,
                typ: 25, // ROOM
                flags: 0,
                lit: true,
                roomno: 1,
                door: null
            })),
            getRoomType: vi.fn((roomno) => ({
                roomno,
                rtype: 18, // WEAPONSHOP
                isShop: true,
                name: 'Weapon Shop',
                nameJa: '武器屋'
            })),
            getTrapAt: vi.fn((x, y) => null),
            getEngravingAt: vi.fn((x, y) => null),
            getFullMonsterAt: vi.fn((x, y) => null),
            dumpLevelTerrain: vi.fn(() => new Uint8Array(80 * 21))
        };

        asm = new AreaStateManager(80, 24, null, mockService);
    });

    describe('getGenuineFloor (真の地形・部屋・罠・刻み文字直結)', () => {
        it('resolves genuine floor with weapon shop room data', () => {
            const floor = asm.getGenuineFloor(10, 10);

            expect(floor).toBeDefined();
            expect(floor.isGenuine).toBe(true);
            expect(floor.inferred).toBe(false);
            expect(floor.cellInfo.typ).toBe(25);
            expect(floor.room).toBeDefined();
            expect(floor.room.isShop).toBe(true);
            expect(floor.room.nameJa).toBe('武器屋');
        });

        it('resolves genuine locked and trapped door correctly', () => {
            mockService.getCellInfo.mockReturnValue({
                x: 12,
                y: 10,
                typ: 23, // DOOR
                flags: 0x04 | 0x08 | 0x10, // CLOSED | LOCKED | TRAPPED
                lit: false,
                roomno: 0,
                door: {
                    isClosed: true,
                    isLocked: true,
                    isOpen: false,
                    isBroken: false,
                    isTrapped: true,
                    isSecret: false
                }
            });

            const floor = asm.getGenuineFloor(12, 10);
            expect(floor.cellInfo.door.isLocked).toBe(true);
            expect(floor.cellInfo.door.isTrapped).toBe(true);
            expect(floor.cellInfo.door.isClosed).toBe(true);
        });

        it('resolves genuine trap information on floor cell', () => {
            mockService.getTrapAt.mockReturnValue({
                x: 15,
                y: 8,
                ttyp: 11, // PIT
                tseen: true,
                once: false,
                name: 'pit',
                nameJa: '落とし穴 (ピット)'
            });

            const floor = asm.getGenuineFloor(15, 8);
            expect(floor.trap).toBeDefined();
            expect(floor.trap.ttyp).toBe(11);
            expect(floor.trap.nameJa).toBe('落とし穴 (ピット)');
        });

        it('resolves genuine engraving and detects Elbereth', () => {
            mockService.getEngravingAt.mockReturnValue({
                x: 14,
                y: 7,
                text: 'Elbereth',
                engrType: 3, // BURN
                typeName: 'burned',
                typeNameJa: '焼き',
                isElbereth: true
            });

            const floor = asm.getGenuineFloor(14, 7);
            expect(floor.engraving).toBeDefined();
            expect(floor.engraving.isElbereth).toBe(true);
            expect(floor.engraving.typeNameJa).toBe('焼き');
        });
    });

    describe('updateGlyph - Monster & Floor Binding', () => {
        it('synchronizes genuine floor underneath an item appearing on unmapped tile', () => {
            mockService.getCellInfo.mockReturnValue({
                x: 20,
                y: 10,
                typ: 28, // FOUNTAIN
                flags: 0,
                lit: true,
                roomno: 0,
                door: null
            });

            // 宝石アイテムのグリフを受信
            const gemGlyph = GLYPH_OFFSETS.GLYPH_OBJ_OFF + 200;
            asm.updateGlyph(20, 10, gemGlyph);

            const cell = asm.grid[10][20];
            expect(cell.middle).not.toBeNull();
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.isGenuine).toBe(true);
            expect(cell.bottom.cellInfo.typ).toBe(28); // FOUNTAIN
        });

        it('synchronizes monster details (HP, peaceful, shopkeeper, state) upon monster glyph reception', () => {
            mockService.getFullMonsterAt.mockReturnValue({
                x: 25,
                y: 12,
                ptr: 0x5000,
                peaceful: true,
                tame: false,
                hp: 42,
                hpmax: 50,
                sleeping: true,
                fleeing: false,
                paralyzed: false,
                isShopkeeper: true,
                isPriest: false
            });

            const monGlyph = GLYPH_OFFSETS.GLYPH_MON_OFF + 50;
            asm.updateGlyph(25, 12, monGlyph);

            const cell = asm.grid[12][25];
            expect(cell.top).not.toBeNull();
            expect(cell.top.isPeaceful).toBe(true);
            expect(cell.top.isShopkeeper).toBe(true);
            expect(cell.top.hp).toBe(42);
            expect(cell.top.hpmax).toBe(50);
            expect(cell.top.dynamicState.sleeping).toBe(true);
        });
    });

    describe('updatePlayerPosition (足元同期と階段シード)', () => {
        it('updates engraving cache on player movement', () => {
            mockService.getEngravingAt.mockReturnValue({
                x: 10,
                y: 10,
                text: 'Elbereth',
                engrType: 1, // DUST
                isElbereth: true
            });

            asm.updatePlayerPosition(10, 10);

            const cached = asm.getEngravingAt(10, 10);
            expect(cached).toBeDefined();
            expect(cached.isElbereth).toBe(true);
            expect(cached.text).toBe('Elbereth');
        });
    });

    describe('syncFromDirectBinding (一括同期)', () => {
        it('synchronizes surrounding cells within radius', () => {
            asm.playerX = 10;
            asm.playerY = 10;

            mockService.getFullMonsterAt.mockImplementation((x, y) => {
                if (x === 11 && y === 10) {
                    return {
                        x,
                        y,
                        ptr: 0x6000,
                        peaceful: false,
                        tame: false,
                        hp: 15,
                        hpmax: 15,
                        sleeping: false,
                        fleeing: true,
                        paralyzed: false,
                        isShopkeeper: false,
                        isPriest: false
                    };
                }
                return null;
            });

            // (11, 10) にモンスター配置
            asm.grid[10][11].top = { type: ENTITY_TYPES.MONSTER, monOffset: 1 };

            asm.syncFromDirectBinding(2); // 半径 2

            const cell = asm.grid[10][11];
            expect(cell.top.hp).toBe(15);
            expect(cell.top.dynamicState.fleeing).toBe(true);
        });
    });

    describe('ContextActionEngine Integration with Direct Binding', () => {
        it('prioritizes untrap action when door has direct trapped flag', () => {
            const doorCell = {
                x: 11,
                y: 10,
                bottom: {
                    type: ENTITY_TYPES.TERRAIN,
                    cmapFlags: { isClosedDoor: true },
                    door: { isClosed: true, isTrapped: true, isLocked: true },
                    cellInfo: { door: { isClosed: true, isTrapped: true, isLocked: true } }
                },
                middle: null,
                top: null,
                dir: { code: 'E', key: '6', name: '東' }
            };

            const areaState = {
                playerX: 10,
                playerY: 10,
                feet: { bottom: { type: ENTITY_TYPES.TERRAIN, cmapFlags: { isFloor: true } }, middle: null, top: null },
                adjacentEntities: [{ dir: { code: 'E', key: '6', name: '東' }, cell: doorCell }]
            };

            const actions = ContextActionEngine.generateActions(areaState, null);
            const untrapAction = actions.find(a => a.id.startsWith('ACTION_UNTRAP_DOOR_E'));

            expect(untrapAction).toBeDefined();
            expect(untrapAction.priority).toBe(98); // 最優先
            expect(untrapAction.label).toContain('罠感知!');
        });

        it('prioritizes chat over attack for peaceful NPC or shopkeeper', () => {
            const npcCell = {
                x: 11,
                y: 10,
                bottom: { type: ENTITY_TYPES.TERRAIN, cmapFlags: { isFloor: true } },
                middle: null,
                top: {
                    type: ENTITY_TYPES.MONSTER,
                    isPeaceful: true,
                    isShopkeeper: false,
                    isPriest: false,
                    hp: 20,
                    hpmax: 20,
                    nameJa: 'エルフ'
                },
                dir: { code: 'E', key: '6', name: '東' }
            };

            const areaState = {
                playerX: 10,
                playerY: 10,
                feet: { bottom: { type: ENTITY_TYPES.TERRAIN, cmapFlags: { isFloor: true } }, middle: null, top: null },
                adjacentEntities: [{ dir: { code: 'E', key: '6', name: '東' }, cell: npcCell }],
                adjacentMonsters: [{ dir: { code: 'E', key: '6', name: '東' }, cell: npcCell, entity: npcCell.top }]
            };

            const actions = ContextActionEngine.generateActions(areaState, null);
            const chatAction = actions.find(a => a.id.startsWith('ACTION_CHAT_NPC_E'));
            const attackAction = actions.find(a => a.id.startsWith('ACTION_ATTACK_E'));

            expect(chatAction).toBeDefined();
            expect(chatAction.priority).toBe(90); // 平和的NPCは高優先度
            expect(chatAction.label).toContain('話しかける');
            // 平和的NPCに対する攻撃アクションは誤爆防止のため除外されること
            expect(attackAction).toBeUndefined();
        });
    });
});
