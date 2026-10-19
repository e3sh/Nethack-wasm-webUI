import { describe, it, expect } from 'vitest';
import { ContextActionEngine } from "../engines/ContextActionEngine.js";
import { SkillStateManager } from "../state/SkillStateManager.js";
import { InventoryStateManager } from "../state/InventoryStateManager.js";
import { AreaStateManager } from "../state/AreaStateManager.js";

describe('ContextActionEngine - スキル連動＆おすすめ装備提案テスト', () => {
    it('matchWeaponToSkill: 各種武器アイテムが正確な NetHack スキル種別名にマッチすること', () => {
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'long sword', rawText: '+1 long sword' })).toBe('long sword');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'katana', rawText: 'katana' })).toBe('long sword');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'elven dagger', rawText: 'elven dagger' })).toBe('dagger');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'short sword', rawText: 'short sword' })).toBe('short sword');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'bow', rawText: 'elven bow' })).toBe('bow');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'crossbow', rawText: 'crossbow' })).toBe('crossbow');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'silver spear', rawText: 'silver spear' })).toBe('spear');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'battle-axe', rawText: '+0 battle-axe' })).toBe('axe');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'pick-axe', rawText: 'pick-axe' })).toBe('pick-axe');
        expect(ContextActionEngine.matchWeaponToSkill({ name: 'mace', rawText: 'mace' })).toBe('mace');
    });

    it('ContextActions に装備持ち替えアクション (ACTION_WIELD_RECOMMENDED_*) は含まれず、純粋な即時アクションのみになること', () => {
        const invMgr = new InventoryStateManager();
        invMgr.items = [
            { letter: 'a', name: 'short sword', rawText: 'a - an uncursed short sword (weapon in hand)', category: 'WEAPON', isWielded: true },
            { letter: 'b', name: 'long sword', rawText: 'b - a +2 long sword', category: 'WEAPON', isWielded: false }
        ];

        const skillMgr = new SkillStateManager();
        skillMgr.updateFromLines([
            'short sword [Unskilled]',
            'long sword [Expert]'
        ]);

        const areaState = {
            feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
            adjacentMonsters: [],
            adjacentEntities: []
        };

        const actions = ContextActionEngine.generateActions(areaState, invMgr, skillMgr);

        // 推奨アクションには武器持ち替えが含まれないこと（即時アクションのみ）
        const wieldAction = actions.find(a => a.id.startsWith('ACTION_WIELD_RECOMMENDED'));
        expect(wieldAction).toBeUndefined();
    });

    it('遠隔射撃 (f): 矢筒内の弾薬に対応するスキル熟練度が高い場合 priority が加算されること', () => {
        const invMgr = new InventoryStateManager();
        invMgr.items = [
            { letter: 'd', name: 'arrows', rawText: 'd - 20 uncursed arrows (in quiver)', isAmmo: true, isQuivered: true }
        ];

        const skillMgr = new SkillStateManager();
        skillMgr.updateFromLines(['bow [Expert]']); // score: 40

        const areaMgr = new AreaStateManager(80, 21);
        areaMgr.updatePlayerPosition(10, 10);
        // (10, 8) にモンスター (北に2マス離れている)
        areaMgr.updateGlyph(10, 8, 70); // goblin (monOffset: 70)

        const areaState = areaMgr.getAreaState();
        const actions = ContextActionEngine.generateActions(areaState, invMgr, skillMgr);

        const fireAction = actions.find(a => a.id === 'ACTION_FIRE_N');
        expect(fireAction).toBeDefined();
        // 基本85 + Expert加算 (40/4 = 10) = 95
        expect(fireAction.priority).toBe(95);
    });

    describe('解錠/施錠操作 (Lock/Unlock actions) テスト', () => {
        it('足元の箱解錠/施錠 (ACTION_UNLOCK_CONTAINER_FEET): 鍵所持時に末尾に "y" を伴うシーケンスが生成されること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                { letter: 'k', name: 'skeleton key', rawText: 'k - a skeleton key', isKey: true }
            ];

            const areaState = {
                feet: {
                    middle: {
                        type: 'ITEM',
                        isContainer: true,
                        rawText: 'large box',
                        name: 'large box'
                    }
                },
                adjacentMonsters: [],
                adjacentEntities: []
            };

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const unlockAction = actions.find(a => a.id === 'ACTION_UNLOCK_CONTAINER_FEET');
            expect(unlockAction).toBeDefined();
            expect(unlockAction.keySequence).toEqual(['a', 'k', 'DIR_SELF', 'y']);
            expect(unlockAction.key).toBe('ak.y');
            expect(unlockAction.target).toBe('feet');
            expect(unlockAction.label).toBe('箱を解錠/施錠 (k)');

            const actionsEn = ContextActionEngine.generateActions(areaState, invMgr, null, { language: 'en' });
            const unlockActionEn = actionsEn.find(a => a.id === 'ACTION_UNLOCK_CONTAINER_FEET');
            expect(unlockActionEn.label).toBe('Lock/Unlock container with k - a skeleton key');
        });

        it('扉の解錠/施錠 (ACTION_UNLOCK_DOOR_*): 鍵所持時に末尾に "y" を伴うシーケンスが生成されること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                { letter: 'k', name: 'skeleton key', rawText: 'k - a skeleton key', isKey: true }
            ];

            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            // 東 (11, 10) に閉じた扉を配置 (glyphId: 3988)
            areaMgr.updateGlyph(11, 10, 3988);

            const areaState = areaMgr.getAreaState();
            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const unlockAction = actions.find(a => a.id === 'ACTION_UNLOCK_DOOR_E');
            expect(unlockAction).toBeDefined();
            expect(unlockAction.keySequence).toEqual(['a', 'k', 'DIR_E', 'y']);
            expect(unlockAction.key).toBe('akDIR_Ey');
            expect(unlockAction.label).toBe('扉を解錠/施錠 [東] (k)');
        });

        it('隣接マスの箱 (isContainer): 鍵所持時に隣接解錠/施錠・漁る・罠解除・箱蹴りアクションが生成されること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                { letter: 'k', name: 'skeleton key', rawText: 'k - a skeleton key', isKey: true }
            ];

            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState();
            areaState.adjacentEntities = [
                {
                    x: 11,
                    y: 10,
                    dir: { code: 'E', name: 'East', key: '6' },
                    cell: {
                        middle: { isContainer: true, name: 'chest' }
                    }
                }
            ];

            const actions = ContextActionEngine.generateActions(areaState, invMgr);

            // 1. 解錠/施錠 (ACTION_UNLOCK_CONTAINER_E)
            const unlockAction = actions.find(a => a.id === 'ACTION_UNLOCK_CONTAINER_E');
            expect(unlockAction).toBeDefined();
            expect(unlockAction.keySequence).toEqual(['a', 'k', 'DIR_E', 'y']);
            expect(unlockAction.dirCode).toBe('E');
            expect(unlockAction.label).toBe('箱を解錠/施錠 [東] (k)');

            // 2. 漁る (ACTION_LOOT_CONTAINER_E)
            const lootAction = actions.find(a => a.id === 'ACTION_LOOT_CONTAINER_E');
            expect(lootAction).toBeDefined();
            expect(lootAction.keySequence).toEqual(['#', 'loot', 'DIR_E']);
            expect(lootAction.dirCode).toBe('E');

            // 3. 罠解除 (ACTION_UNTRAP_CONTAINER_E)
            const untrapAction = actions.find(a => a.id === 'ACTION_UNTRAP_CONTAINER_E');
            expect(untrapAction).toBeDefined();
            expect(untrapAction.keySequence).toEqual(['#', 'untrap', 'DIR_E']);
            expect(untrapAction.dirCode).toBe('E');

            // 4. 箱蹴り (ACTION_KICK_CONTAINER_E)
            const kickAction = actions.find(a => a.id === 'ACTION_KICK_CONTAINER_E');
            expect(kickAction).toBeDefined();
            expect(kickAction.keySequence).toEqual(['#', 'kick', 'DIR_E']);
            expect(kickAction.dirCode).toBe('E');
        });

        it('隣接マスの巨石 (boulder): 巨石を押すアクション (ACTION_PUSH_BOULDER_*) が生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState();
            areaState.adjacentEntities = [
                {
                    x: 11,
                    y: 10,
                    dir: { code: 'E', name: 'East', key: '6' },
                    cell: {
                        middle: { name: 'boulder', isBoulder: true }
                    }
                }
            ];

            const actions = ContextActionEngine.generateActions(areaState, null);
            const pushAction = actions.find(a => a.id === 'ACTION_PUSH_BOULDER_E');
            expect(pushAction).toBeDefined();
            expect(pushAction.keySequence).toEqual(['DIR_E']);
            expect(pushAction.dirCode).toBe('E');
        });
    });

    describe('getDefaultActionForDirection - 方向選択時のデフォルト推奨アクション（待機・移動/押す）', () => {
        it('SELF を指定した場合、待機アクション (ACTION_DEFAULT_WAIT) を返すこと', () => {
            const actJa = ContextActionEngine.getDefaultActionForDirection('SELF', null, { language: 'ja' });
            expect(actJa).toBeDefined();
            expect(actJa.id).toBe('ACTION_DEFAULT_WAIT');
            expect(actJa.label).toBe('待機 (1ターン)');
            expect(actJa.keySequence).toEqual(['.']);
            expect(actJa.dirCode).toBe('SELF');

            const actEn = ContextActionEngine.getDefaultActionForDirection('SELF', null, { language: 'en' });
            expect(actEn.label).toBe('Wait (1 turn)');
        });

        it('8方向（例: N, E）を指定した場合、移動/押すアクションを返すこと', () => {
            const actN = ContextActionEngine.getDefaultActionForDirection('N', null, { language: 'ja' });
            expect(actN).toBeDefined();
            expect(actN.id).toBe('ACTION_DEFAULT_MOVE_N');
            expect(actN.label).toContain('北へ移動 / 押す');
            expect(actN.keySequence).toEqual(['DIR_N']);
            expect(actN.dirCode).toBe('N');

            const actE = ContextActionEngine.getDefaultActionForDirection('E', null, { language: 'en' });
            expect(actE).toBeDefined();
            expect(actE.id).toBe('ACTION_DEFAULT_MOVE_E');
            expect(actE.label).toContain('Move / Push East');
            expect(actE.keySequence).toEqual(['DIR_E']);
        });

        it('areaState で対象方向が壁 (isWall: true) かつ岩やモンスターがない場合、null を返して移動アクションを抑制すること', () => {
            const areaState = {
                adjacentEntities: [
                    {
                        dir: { code: 'N' },
                        cell: {
                            bottom: { type: 'TERRAIN', cmapFlags: { isWall: true } },
                            middle: null,
                            top: null
                        }
                    }
                ]
            };
            const act = ContextActionEngine.getDefaultActionForDirection('N', areaState);
            expect(act).toBeNull();
        });

        it('areaState で対象方向が壁であっても岩 (middle) やモンスター (top) がある場合、移動/押すアクションを返すこと', () => {
            const areaState = {
                adjacentEntities: [
                    {
                        dir: { code: 'N' },
                        cell: {
                            bottom: { type: 'TERRAIN', cmapFlags: { isWall: true } },
                            middle: { name: 'boulder', type: 'ITEM' },
                            top: null
                        }
                    }
                ]
            };
            const act = ContextActionEngine.getDefaultActionForDirection('N', areaState);
            expect(act).toBeDefined();
            expect(act.id).toBe('ACTION_DEFAULT_MOVE_N');
        });

        it('generateActions() で生成されるアクション一覧にはデフォルトアクションが含まれないこと（全表示での点灯・溢れ防止）', () => {
            const areaState = {
                feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
                adjacentMonsters: [],
                adjacentEntities: []
            };
            const actions = ContextActionEngine.generateActions(areaState);
            expect(actions.some(a => a.id === 'ACTION_DEFAULT_WAIT')).toBe(false);
            expect(actions.some(a => a.id.startsWith('ACTION_DEFAULT_MOVE_'))).toBe(false);
        });

        it('getDashActionForDirection: 8方向指定で G + DIR_* のダッシュ移動シーケンスを生成すること', () => {
            const dashN = ContextActionEngine.getDashActionForDirection('N', null, { language: 'ja' });
            expect(dashN).toBeDefined();
            expect(dashN.id).toBe('ACTION_DASH_MOVE_N');
            expect(dashN.keySequence).toEqual(['G', 'DIR_N']);
            expect(dashN.label).toContain('北へダッシュ');
            expect(dashN.icon).toBe('🏃');

            const dashE = ContextActionEngine.getDashActionForDirection('E', null, { language: 'en' });
            expect(dashE).toBeDefined();
            expect(dashE.keySequence).toEqual(['G', 'DIR_E']);
            expect(dashE.label).toContain('Dash / Run East');
        });

        it('getDashActionForDirection: SELF 指定時は待機アクションを返却すること', () => {
            const dashSelf = ContextActionEngine.getDashActionForDirection('SELF', null);
            expect(dashSelf).toBeDefined();
            expect(dashSelf.id).toBe('ACTION_DEFAULT_WAIT');
            expect(dashSelf.keySequence).toEqual(['.']);
        });

        it('getDashActionForDirection: 壁の方向へのダッシュは null を返して抑制すること', () => {
            const areaState = {
                adjacentEntities: [
                    {
                        dir: { code: 'E' },
                        cell: {
                            bottom: { type: 'TERRAIN', cmapFlags: { isWall: true } },
                            middle: null,
                            top: null
                        }
                    }
                ]
            };
            const dashE = ContextActionEngine.getDashActionForDirection('E', areaState);
            expect(dashE).toBeNull();
        });
    });

    describe('Stage 8.3 - 罠付き扉 ＆ モンスター直結（誤攻撃完全防止・HP・状態異常）', () => {
        it('罠付き扉（isTrappedDoor）に直面時、罠解除 (#untrap) が最優先 (priority: 98) で提示され、開くアクションに危険リスクが付くこと', () => {
            const invMgr = new InventoryStateManager();
            const areaState = {
                feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
                adjacentMonsters: [],
                adjacentEntities: [
                    {
                        dir: { code: 'N' },
                        cell: {
                            bottom: {
                                type: 'TERRAIN',
                                cmapFlags: { isClosedDoor: true, isTrappedDoor: true }
                            },
                            middle: null,
                            top: null
                        }
                    }
                ]
            };

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const untrapAction = actions.find(a => a.id === 'ACTION_UNTRAP_DOOR_N');
            expect(untrapAction).toBeDefined();
            expect(untrapAction.priority).toBe(98);
            expect(untrapAction.label).toContain('罠感知!');

            const openAction = actions.find(a => a.id === 'ACTION_OPEN_DOOR_N');
            expect(openAction).toBeDefined();
            expect(openAction.risk).toBe('danger');
            expect(openAction.priority).toBe(65);
        });

        it('扉のない戸口（doorway / isNoDoor）や破壊された扉（isBroken）に対して扉の開閉・施錠アクションを一切提案しないこと', () => {
            const invMgr = new InventoryStateManager();
            const areaState = {
                feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
                adjacentMonsters: [],
                adjacentEntities: [
                    {
                        // 扉のない戸口 (CMAP: isDoorway = true, S_ndoor 3985)
                        dir: { code: 'N' },
                        cell: {
                            bottom: {
                                type: 'TERRAIN',
                                cmapFlags: { isDoorway: true },
                                door: { isNoDoor: true, isClosed: false, isOpen: false, isLocked: false, isBroken: false }
                            },
                            middle: null,
                            top: null
                        }
                    },
                    {
                        // 壊れた扉 (DirectBinding: isBroken = true)
                        dir: { code: 'E' },
                        cell: {
                            bottom: {
                                type: 'TERRAIN',
                                cmapFlags: {},
                                door: { isBroken: true, isClosed: false, isOpen: false, isLocked: false, isNoDoor: false }
                            },
                            middle: null,
                            top: null
                        }
                    }
                ]
            };

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const doorActions = actions.filter(a => a.id.includes('_DOOR_'));
            expect(doorActions).toHaveLength(0);
        });

        it('開いた扉（isOpenDoor または door.isOpen）に対して扉を閉める (c) アクションが正しく提案されること', () => {
            const invMgr = new InventoryStateManager();
            const areaState = {
                feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
                adjacentMonsters: [],
                adjacentEntities: [
                    {
                        dir: { code: 'S' },
                        cell: {
                            bottom: {
                                type: 'TERRAIN',
                                cmapFlags: { isOpenDoor: true },
                                door: { isOpen: true, isClosed: false, isLocked: false }
                            },
                            middle: null,
                            top: null
                        }
                    }
                ]
            };

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const closeAction = actions.find(a => a.id === 'ACTION_CLOSE_DOOR_S');
            expect(closeAction).toBeDefined();
            expect(closeAction.key).toBe('cDIR_S');
            expect(closeAction.keySequence).toEqual(['c', 'DIR_S']);
            expect(closeAction.dirCode).toBe('S');
        });

        it('描画グリフ（isClosedDoor / isOpenDoor）が最優先され、キャッシュに isNoDoor が紛れ込んでいても扉アクションが正しく提案されること', () => {
            const invMgr = new InventoryStateManager();
            const areaState = {
                feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
                adjacentMonsters: [],
                adjacentEntities: [
                    {
                        // 画面上は閉じた扉（+）だが、キャッシュに isNoDoor: true があるケース
                        dir: { code: 'W' },
                        cell: {
                            bottom: {
                                type: 'TERRAIN',
                                cmapFlags: { isClosedDoor: true },
                                door: { isNoDoor: true, isClosed: false }
                            },
                            middle: null,
                            top: null
                        }
                    },
                    {
                        // 画面上は開いた扉（|）だが、キャッシュに isNoDoor: true があるケース
                        dir: { code: 'E' },
                        cell: {
                            bottom: {
                                type: 'TERRAIN',
                                cmapFlags: { isOpenDoor: true },
                                door: { isNoDoor: true, isClosed: false }
                            },
                            middle: null,
                            top: null
                        }
                    }
                ]
            };

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const openDoorW = actions.find(a => a.id === 'ACTION_OPEN_DOOR_W');
            expect(openDoorW).toBeDefined();
            expect(openDoorW.label).toContain('扉を開ける');

            const closeDoorE = actions.find(a => a.id === 'ACTION_CLOSE_DOOR_E');
            expect(closeDoorE).toBeDefined();
            expect(closeDoorE.label).toContain('扉を閉める');
        });

        it('平和的NPC（isPeaceful）および店主・僧侶に対して近接攻撃アクションを一切生成せず、話しかけ (#chat) を優先提示すること', () => {
            const invMgr = new InventoryStateManager();
            const areaState = {
                feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
                adjacentMonsters: [
                    {
                        dir: { code: 'E' },
                        entity: {
                            type: 'MONSTER',
                            name: 'shopkeeper',
                            isShopkeeper: true,
                            isPeaceful: true,
                            hp: 40,
                            hpmax: 40,
                            directState: { peaceful: true, isShopkeeper: true, hp: 40, hpmax: 40, sleeping: true }
                        }
                    },
                    {
                        dir: { code: 'W' },
                        entity: {
                            type: 'MONSTER',
                            name: 'aligned priest',
                            isPriest: true,
                            isPeaceful: true,
                            hp: 55,
                            hpmax: 55,
                            directState: { peaceful: true, isPriest: true, hp: 55, hpmax: 55 }
                        }
                    }
                ],
                adjacentEntities: []
            };

            const actions = ContextActionEngine.generateActions(areaState, invMgr);

            // 攻撃アクションが一切生成されていないこと（誤攻撃完全抑止）
            expect(actions.some(a => a.id === 'ACTION_ATTACK_E')).toBe(false);
            expect(actions.some(a => a.id === 'ACTION_ATTACK_W')).toBe(false);

            // 店主への話しかけと支払い
            const chatShop = actions.find(a => a.id === 'ACTION_CHAT_NPC_E');
            expect(chatShop).toBeDefined();
            expect(chatShop.label).toContain('店主');
            expect(chatShop.label).toContain('HP:40/40');
            expect(chatShop.label).toContain('睡眠中');

            const payShop = actions.find(a => a.id === 'ACTION_PAY_E');
            expect(payShop).toBeDefined();

            // 僧侶への話しかけ
            const chatPriest = actions.find(a => a.id === 'ACTION_CHAT_NPC_W');
            expect(chatPriest).toBeDefined();
            expect(chatPriest.label).toContain('僧侶');
            expect(chatPriest.label).toContain('HP:55/55');
        });

        it('敵対モンスターに対しては攻撃アクションを生成し、HPゲージと状態異常を表示すること', () => {
            const invMgr = new InventoryStateManager();
            const areaState = {
                feet: { bottom: { type: 'TERRAIN', cmapFlags: { isFloor: true } } },
                adjacentMonsters: [
                    {
                        dir: { code: 'S' },
                        entity: {
                            type: 'MONSTER',
                            name: 'orc',
                            isPeaceful: false,
                            isHostile: true,
                            hp: 8,
                            hpmax: 12,
                            directState: { peaceful: false, fleeing: true, hp: 8, hpmax: 12 }
                        }
                    }
                ],
                adjacentEntities: []
            };

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const attackOrc = actions.find(a => a.id === 'ACTION_ATTACK_S');
            expect(attackOrc).toBeDefined();
            expect(attackOrc.label).toContain('HP:8/12');
            expect(attackOrc.label).toContain('逃走中');
        });
    });
});


