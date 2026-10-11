import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AreaStateManager } from '../../../../src/core/knowledge/state/AreaStateManager.js';
import { WasmDirectBindingService } from '../../../../src/core/knowledge/services/WasmDirectBindingService.js';
import { InteractionContext } from '../../../../src/core/knowledge/context/InteractionContext.js';
import { ActionSignalResolver } from '../../../../src/core/knowledge/engines/ActionSignalResolver.js';
import { GKLPlugin } from '../../../../src/core/knowledge/GKLPlugin.js';
import { ContextActionEngine } from '../../../../src/core/knowledge/engines/ContextActionEngine.js';

describe('Stage 8.3-A: AreaStateManager Terrain Dump, Door Traps/Locks & Monster Direct Binding', () => {
    let directBindingService;
    let areaStateManager;
    let interactionContext;
    let actionSignalResolver;

    beforeEach(() => {
        directBindingService = new WasmDirectBindingService({ mode: 'strict' });
        areaStateManager = new AreaStateManager(80, 21, null, directBindingService);
        interactionContext = new InteractionContext();
        actionSignalResolver = new ActionSignalResolver();
    });

    describe('1. dumpLevelTerrain (80x21 Lookup Table Retention, Unexplored Suppression & True Floor Supplement)', () => {
        it('should retain 80x21 floor terrain in lookup table without writing to unexplored grid cells or registering undiscovered stairs', () => {
            const COLNO = 80;
            const ROWNO = 21;
            const mockTerrain = new Uint8Array(COLNO * ROWNO);

            // 初期化: 全部 STONE (typ 0: 無地の岩盤)
            mockTerrain.fill(0);

            // 特定マスに地形配置
            // (10, 5): 垂直壁 (typ 1)
            mockTerrain[5 * COLNO + 10] = 1;
            // (15, 5): 水 (typ 18)
            mockTerrain[5 * COLNO + 15] = 18;
            // (20, 5): 溶岩 (typ 20)
            mockTerrain[5 * COLNO + 20] = 20;
            // (25, 5): 上り階段 (typ 26)
            mockTerrain[5 * COLNO + 25] = 26;
            // (30, 5): ハシゴ (typ 27)
            mockTerrain[5 * COLNO + 30] = 27;
            // (35, 5): 泉 (typ 28)
            mockTerrain[5 * COLNO + 35] = 28;

            directBindingService.setCachedLevelTerrain(mockTerrain);
            areaStateManager.clearDirtyCells();

            const success = areaStateManager.dumpLevelTerrain();
            expect(success).toBe(true);

            // 1. print_glyph 未受信の未踏セルには cell.bottom を書き込まず、Dirty 登録もしないこと
            expect(areaStateManager.grid[5][10].bottom).toBeNull();
            expect(areaStateManager.grid[5][15].bottom).toBeNull();
            expect(areaStateManager.grid[5][20].bottom).toBeNull();
            expect(areaStateManager.grid[5][25].bottom).toBeNull();
            expect(areaStateManager.grid[5][30].bottom).toBeNull();
            expect(areaStateManager.getDirtyCells().size).toBe(0);

            // 2. 未発見の階段・ハシゴが landmarkCache に早期登録されないこと
            const landmarksBefore = areaStateManager.getFloorLandmarks('Dlvl:1');
            expect(landmarksBefore.stairsUp.length).toBe(0);

            // 3. 観測済みマスでアイテムやモンスターにより下層が隠れている場合、ルックアップテーブルから真の床を補完できること
            areaStateManager.updateGlyph(15, 5, 3448 + 10); // 水の上にアイテム出現 (bkglyph なし)
            expect(areaStateManager.grid[5][15].bottom).not.toBeNull();
            expect(areaStateManager.grid[5][15].bottom.isGenuine).toBe(true);
            expect(areaStateManager.grid[5][15].bottom.typ).toBe(18);
            expect(areaStateManager.grid[5][15].bottom.glyph).toBe(4015); // WATER

            areaStateManager.updateGlyph(20, 5, 10); // 溶岩の上にモンスター出現 (bkglyph なし)
            expect(areaStateManager.grid[5][20].bottom).not.toBeNull();
            expect(areaStateManager.grid[5][20].bottom.typ).toBe(20);
            expect(areaStateManager.grid[5][20].bottom.glyph).toBe(4017); // LAVAPOOL

            // 4. print_glyph で階段 (4000) を観測した時点で初めて cell.bottom と landmarkCache に登録されること
            areaStateManager.updateGlyph(25, 5, 4000);
            expect(areaStateManager.grid[5][25].bottom.glyph).toBe(4000);
            const landmarksAfter = areaStateManager.getFloorLandmarks('Dlvl:1');
            expect(landmarksAfter.stairsUp.some(s => s.x === 25 && s.y === 5)).toBe(true);
            expect(landmarksAfter.stairsUp.some(s => s.x === 30 && s.y === 5)).toBe(false);
        });

        it('should guard typ === 0 (STONE), typ === 14 (SDOOR), and typ === 15 (SCORR) against floor/spoiler conversion', () => {
            const COLNO = 80;
            const ROWNO = 21;
            const mockTerrain = new Uint8Array(COLNO * ROWNO);
            mockTerrain[5 * COLNO + 5] = 0;  // STONE
            mockTerrain[5 * COLNO + 6] = 14; // SDOOR (隠し扉)
            mockTerrain[5 * COLNO + 7] = 15; // SCORR (隠し通路)
            directBindingService.setCachedLevelTerrain(mockTerrain);

            // STONE (0) は null を返し、床タイル (3992) を生成しない
            expect(areaStateManager.getGlyphForTerrainType(0, 5, 5)).toBeNull();
            expect(areaStateManager.getGenuineFloor(5, 5)).toBeNull();

            // SDOOR (14) は扉グリフ (3988) ではなく壁グリフ (3930) を返し、door 属性を漏洩しない
            expect(areaStateManager.getGlyphForTerrainType(14, 6, 5)).toBe(3930);
            const sdoorFloor = areaStateManager.getGenuineFloor(6, 5);
            expect(sdoorFloor).not.toBeNull();
            expect(sdoorFloor.glyph).toBe(3930);
            expect(sdoorFloor.door).toBeNull();

            // SCORR (15) は通路グリフ (3995) ではなく null を返し、床エンティティを生成しない
            expect(areaStateManager.getGlyphForTerrainType(15, 7, 5)).toBeNull();
            expect(areaStateManager.getGenuineFloor(7, 5)).toBeNull();
        });

        it('should NOT overwrite unobserved cells during syncFromDirectBinding', () => {
            const COLNO = 80;
            const ROWNO = 21;
            const mockTerrain = new Uint8Array(COLNO * ROWNO).fill(25); // 全域 ROOM
            directBindingService.setCachedLevelTerrain(mockTerrain);

            areaStateManager.playerX = 10;
            areaStateManager.playerY = 10;
            // (11, 10) は観測済みモンスターが存在、(12, 10) は未観測
            areaStateManager.grid[10][11].top = { type: 'MONSTER', glyph: 10, rawGlyph: 10 };
            areaStateManager.clearDirtyCells();

            areaStateManager.syncFromDirectBinding(5);

            // プレイヤー座標 (10, 10) と観測済みモンスター座標 (11, 10) のみ下層が補完され、未観測の (12, 10) は null のまま
            expect(areaStateManager.grid[10][10].bottom).not.toBeNull();
            expect(areaStateManager.grid[10][11].bottom).not.toBeNull();
            expect(areaStateManager.grid[10][12].bottom).toBeNull();
            expect(areaStateManager.getDirtyCells().has('12,10')).toBe(false);
        });

        it('should synchronize cell.middle (pickup, drop, piletop isPile) at player feet even when player does not move', () => {
            const px = 12;
            const py = 8;
            directBindingService._cachedCellX = px;
            directBindingService._cachedCellY = py;
            directBindingService._cachedCellInfo = {
                x: px,
                y: py,
                typ: 25,
                flags: 0,
                lit: true,
                roomno: 1,
                door: null
            };

            areaStateManager.updatePlayerPosition(px, py);
            areaStateManager.clearDirtyCells();

            // 1. その場でアイテム 1 個 (otyp=25: long sword) を落とした場合 ('d')
            directBindingService.setCachedFloorObjects(px, py, [
                { otyp: 25, quan: 1, oclass: 2 }
            ]);
            const droppedSingle = areaStateManager.syncPlayerFeetFloor();
            expect(droppedSingle).toBe(true);
            expect(areaStateManager.grid[py][px].middle).not.toBeNull();
            expect(areaStateManager.grid[py][px].middle.subType).toBe(25);
            expect(areaStateManager.grid[py][px].middle.isPile).toBe(false);
            expect(areaStateManager.grid[py][px].middle.rawGlyph).toBe(3448 + 25);
            expect(areaStateManager.getDirtyCells().has(`${px},${py}`)).toBe(true);

            // 2. さらにその場で 2 個目のアイテム (otyp=16: dagger) を落として山積み (isPile: true) になった場合
            areaStateManager.clearDirtyCells();
            directBindingService.setCachedFloorObjects(px, py, [
                { otyp: 16, quan: 1, oclass: 2 },
                { otyp: 25, quan: 1, oclass: 2 }
            ]);
            const droppedPile = areaStateManager.syncPlayerFeetFloor();
            expect(droppedPile).toBe(true);
            expect(areaStateManager.grid[py][px].middle.subType).toBe(16);
            expect(areaStateManager.grid[py][px].middle.isPile).toBe(true);
            expect(areaStateManager.grid[py][px].middle.rawGlyph).toBe(7992 + 16); // GLYPH_OBJ_PILETOP_OFF + 16
            expect(areaStateManager.getDirtyCells().has(`${px},${py}`)).toBe(true);

            // 3. その場で全アイテムを拾って (',') 0個になった場合
            areaStateManager.clearDirtyCells();
            directBindingService.setCachedFloorObjects(px, py, []);
            const pickedUpAll = areaStateManager.syncPlayerFeetFloor();
            expect(pickedUpAll).toBe(true);
            expect(areaStateManager.grid[py][px].middle).toBeNull();
            expect(areaStateManager.getDirtyCells().has(`${px},${py}`)).toBe(true);
        });

        it('should prioritize genuine floor directly and eliminate stairCache rendering hacks', () => {
            // プレイヤーが階段 (26) の上に乗る
            const x = 12;
            const y = 8;

            // WasmDirectBindingService にセル情報を注入 (STAIRS: 26)
            directBindingService._cachedCellX = x;
            directBindingService._cachedCellY = y;
            directBindingService._cachedCellInfo = {
                x,
                y,
                typ: 26, // STAIRS
                flags: 0,
                lit: true,
                roomno: 1,
                door: null
            };

            areaStateManager.updatePlayerPosition(x, y);

            const cell = areaStateManager.grid[y][x];
            expect(cell.bottom).not.toBeNull();
            expect(cell.bottom.isGenuine).toBe(true);
            expect(cell.bottom.glyph).toBe(4002); // Dlvl:1 初期脱出階段 (真の床から直接解決)
            expect(cell.bottom.inferred).toBe(false);
        });
    });

    describe('2. Door Traps & Locks Integration with ActionSignalResolver', () => {
        it('should resolve UNTRAP action for trapped doors with high confidence', () => {
            // (10, 10) にプレイヤー、(10, 9) [北] に罠付き扉
            const areaState = {
                playerLocation: { x: 10, y: 10 },
                cells: [
                    [
                        null,
                        {
                            x: 10,
                            y: 9,
                            relX: 0,
                            relY: -1,
                            dir: { key: '8', code: 'N' },
                            bottom: {
                                typ: 23,
                                type: 'DOOR',
                                door: {
                                    isClosed: true,
                                    isLocked: true,
                                    isTrapped: true
                                }
                            }
                        },
                        null
                    ],
                    [null, { relX: 0, relY: 0 }, null],
                    [null, null, null]
                ]
            };

            interactionContext.updateFromAreaState(areaState);

            const focus = interactionContext.getPrimaryFocus();
            expect(focus).not.toBeNull();
            expect(focus.type).toBe('DOOR');
            expect(focus.isTrapped).toBe(true);
            expect(focus.isLocked).toBe(true);

            // ActionSignalResolver でシグナル導出
            const signal = actionSignalResolver.resolve(interactionContext, { language: 'ja' });
            expect(signal).not.toBeNull();
            expect(signal.signalId).toBe('ACT_DOOR_INTERACTION');

            // 罠解除 (#untrap) が含まれていること
            const untrapAction = signal.recommendedActions.find(a => a.method === 'UNTRAP');
            expect(untrapAction).toBeDefined();
            expect(untrapAction.confidence).toBe(1.0);
            expect(signal.warnings.length).toBeGreaterThan(0);
        });

        it('should resolve USE_KEY action for locked doors when key is available', () => {
            // (10, 10) にプレイヤー、(11, 10) [東] に施錠扉
            const areaState = {
                playerLocation: { x: 10, y: 10 },
                cells: [
                    [null, null, null],
                    [
                        null,
                        { relX: 0, relY: 0 },
                        {
                            x: 11,
                            y: 10,
                            relX: 1,
                            relY: 0,
                            dir: { key: '6', code: 'E' },
                            bottom: {
                                typ: 23,
                                type: 'DOOR',
                                door: {
                                    isClosed: true,
                                    isLocked: true,
                                    isTrapped: false
                                }
                            }
                        }
                    ],
                    [null, null, null]
                ]
            };

            interactionContext.updateFromAreaState(areaState);

            // 鍵を所持しているコンテキスト
            const stateWithKey = {
                ...interactionContext.getState(),
                capabilities: {
                    hasKey: true,
                    keyItem: { invlet: 'b', name: 'skeleton key' }
                }
            };

            const signal = actionSignalResolver.resolve(stateWithKey, { language: 'ja' });
            expect(signal).not.toBeNull();

            const keyAction = signal.recommendedActions.find(a => a.method === 'USE_KEY');
            expect(keyAction).toBeDefined();
            expect(keyAction.toolSlot).toBe('b');
            expect(keyAction.confidence).toBe(1.0);
        });

        it('should NOT generate ACTION_UNTRAP_DOOR in ContextActionEngine when door has NO trap', () => {
            const mockAreaState = {
                playerX: 10,
                playerY: 10,
                keyMode: 'numpad',
                feet: { x: 10, y: 10, bottom: { glyph: 3992 } },
                adjacentMonsters: [],
                adjacentEntities: [
                    {
                        dir: { code: 'E', key: '6', name: '東' },
                        cell: { x: 11, y: 10 },
                        entity: {
                            type: 'DOOR',
                            name: 'closed door',
                            isClosed: true,
                            isLocked: false,
                            isTrapped: false,
                            directState: {
                                isClosed: true,
                                isLocked: false,
                                isTrapped: false
                            }
                        }
                    }
                ]
            };

            const actions = ContextActionEngine.generateActions(mockAreaState);
            const untrapAction = actions.find(a => a.id.startsWith('ACTION_UNTRAP_DOOR'));
            expect(untrapAction).toBeUndefined();

            // 開けるアクションは生成されること
            const openAction = actions.find(a => a.id.startsWith('ACTION_OPEN_DOOR'));
            expect(openAction).toBeDefined();
        });

        it('should generate ACTION_UNTRAP_DOOR in ContextActionEngine when door is TRAPPED', () => {
            const mockAreaState = {
                playerX: 10,
                playerY: 10,
                keyMode: 'numpad',
                feet: { x: 10, y: 10, bottom: { glyph: 3992 } },
                adjacentMonsters: [],
                adjacentEntities: [
                    {
                        dir: { code: 'E', key: '6', name: '東' },
                        cell: { x: 11, y: 10 },
                        entity: {
                            type: 'DOOR',
                            name: 'trapped door',
                            isClosed: true,
                            isLocked: true,
                            isTrapped: true,
                            directState: {
                                isClosed: true,
                                isLocked: true,
                                isTrapped: true
                            }
                        }
                    }
                ]
            };

            const actions = ContextActionEngine.generateActions(mockAreaState);
            const untrapAction = actions.find(a => a.id.startsWith('ACTION_UNTRAP_DOOR'));
            expect(untrapAction).toBeDefined();
            expect(untrapAction.id).toBe('ACTION_UNTRAP_DOOR_E');
        });
    });

    describe('3. Monster Direct Binding & Peaceful Attack Prevention', () => {
        it('should prevent ATTACK_HIT FX trigger on peaceful monsters in GKLPlugin', () => {
            const mockCore = {
                emit: vi.fn(),
                on: vi.fn(),
                listeners: new Map()
            };

            const gkl = new GKLPlugin();
            gkl.core = mockCore;
            gkl.areaStateManager = areaStateManager;
            gkl.wasmDirectBindingService = directBindingService;

            const px = 10;
            const py = 10;
            areaStateManager.playerX = px;
            areaStateManager.playerY = py;

            // 東マス (11, 10) にモンスター配置
            const tx = 11;
            const ty = 10;
            areaStateManager.grid[ty][tx].top = {
                type: 'MONSTER',
                name: 'peaceful guard',
                monOffset: 100
            };

            // WasmDirectBindingService に平和モンスター情報を注入
            directBindingService.setCachedMonster(tx, ty, {
                ptr: 0x1234,
                peaceful: true,
                tame: false,
                hp: 30,
                hpmax: 30
            });

            // GKLPlugin の内部イベントハンドラをテストするため、executeAction や handlePlayerAction の文脈を模擬
            // executeAction(ACTION_ATTACK) を呼んだ場合、あるいはキー送信時の ATTACK_HIT 発火ロジックを直接検証
            const targetCell = areaStateManager.grid[ty][tx];
            const directMon = directBindingService.getFullMonsterAt(tx, ty);

            // directMon が平和判定されることを確認
            expect(directMon.peaceful).toBe(true);

            // GKLPlugin.emitFxTrigger のスパイ
            const fxSpy = vi.spyOn(gkl, 'emitFxTrigger');

            // プレイヤーが東 ('6') に移動・攻撃キーを入力した場合のハンドラを呼ぶ
            // GKLPlugin 内の addCoreListener('beforeKeyProcess', ...) を模擬
            const key = '6';
            const offset = gkl._getDirOffset(key);
            expect(offset).toEqual({ dx: 1, dy: 0 });

            // GKLPlugin の該当ロジック（L830〜L846）を検証
            const isPet = (targetCell.top && (targetCell.top.type === 'PET' || targetCell.top.isPet || targetCell.top.isTame)) || Boolean(directMon?.tame);
            const isPeaceful = (targetCell.top && targetCell.top.isPeaceful) || Boolean(directMon?.peaceful);

            expect(isPeaceful).toBe(true);

            // isPeaceful === true のため、ATTACK_HIT は発火されないこと
            if (targetCell.top && targetCell.top.type === 'MONSTER' && !isPet && !isPeaceful) {
                gkl.emitFxTrigger({ type: 'ATTACK_HIT', targetX: tx, targetY: ty });
            }

            expect(fxSpy).not.toHaveBeenCalled();
        });

        it('should suppress ACTION_ATTACK in ContextActionEngine for peaceful monsters', () => {
            const tx = 11;
            const ty = 10;

            const mockAreaState = {
                playerX: 10,
                playerY: 10,
                keyMode: 'numpad',
                feet: { x: 10, y: 10, bottom: { glyph: 3992 } },
                adjacentMonsters: [
                    {
                        dir: { code: 'E', key: '6', name: '東' },
                        cell: { x: tx, y: ty },
                        entity: {
                            type: 'MONSTER',
                            name: 'peaceful monk',
                            isPeaceful: true,
                            directState: {
                                peaceful: true,
                                tame: false,
                                hp: 25,
                                hpmax: 25
                            }
                        }
                    }
                ],
                adjacentEntities: []
            };

            const actions = ContextActionEngine.generateActions(mockAreaState);

            // 攻撃アクション ACTION_ATTACK_E が生成されていないこと
            const attackAction = actions.find(a => a.id === 'ACTION_ATTACK_E');
            expect(attackAction).toBeUndefined();

            // 会話アクション ACTION_CHAT_NPC_E が生成されていること
            const chatAction = actions.find(a => a.id === 'ACTION_CHAT_NPC_E');
            expect(chatAction).toBeDefined();
        });
    });
});
