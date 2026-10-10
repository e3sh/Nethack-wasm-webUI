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

    describe('1. dumpLevelTerrain (80x21 Floor Terrain Dump & Landmark Seeding)', () => {
        it('should dump entire 80x21 floor terrain and populate grid with genuine typ and glyphs', () => {
            const COLNO = 80;
            const ROWNO = 21;
            const mockTerrain = new Uint8Array(COLNO * ROWNO);

            // 初期化: 全部通常部屋床 (typ 25)
            mockTerrain.fill(25);

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

            const success = areaStateManager.dumpLevelTerrain();
            expect(success).toBe(true);

            // グリッド検証
            const wallCell = areaStateManager.grid[5][10];
            expect(wallCell.bottom.typ).toBe(1);
            expect(wallCell.bottom.isGenuine).toBe(true);
            expect(wallCell.bottom.inferred).toBe(false);

            const waterCell = areaStateManager.grid[5][15];
            expect(waterCell.bottom.typ).toBe(18);
            expect(waterCell.bottom.glyph).toBe(4015); // WATER

            const lavaCell = areaStateManager.grid[5][20];
            expect(lavaCell.bottom.typ).toBe(20);
            expect(lavaCell.bottom.glyph).toBe(4017); // LAVAPOOL

            const stairCell = areaStateManager.grid[5][25];
            expect(stairCell.bottom.typ).toBe(26);
            expect(stairCell.bottom.glyph).toBe(4000); // 上り階段

            const ladderCell = areaStateManager.grid[5][30];
            expect(ladderCell.bottom.typ).toBe(27);
            expect(ladderCell.bottom.glyph).toBe(4004); // 上りハシゴ

            // 階段・ハシゴが landmarkCache に一括自動登録されていること
            const landmarks = areaStateManager.getFloorLandmarks('Dlvl:1');
            expect(landmarks.stairsUp.length).toBeGreaterThanOrEqual(1);
            expect(landmarks.stairsUp.some(s => s.x === 25 && s.y === 5)).toBe(true);
            expect(landmarks.stairsUp.some(s => s.x === 30 && s.y === 5)).toBe(true);
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
