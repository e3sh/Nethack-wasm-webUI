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
            { letter: 'a', name: 'short sword', rawText: 'a - an uncursed short sword (weapon in hand)', isWeapon: true, isWielded: true },
            { letter: 'b', name: 'long sword', rawText: 'b - a +2 long sword', isWeapon: true, isWielded: false }
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

    describe('解錠操作 (Unlock actions) テスト', () => {
        it('足元の箱解錠 (ACTION_UNLOCK_CONTAINER_FEET): 鍵所持時に末尾に "y" を伴うシーケンスが生成されること', () => {
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
        });

        it('扉の解錠 (ACTION_UNLOCK_DOOR_*): 鍵所持時に末尾に "y" を伴うシーケンスが生成されること', () => {
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
        });

        it('隣接マスの箱: 鍵を所持していても隣接方向への解錠アクションは生成されないこと（足元のみに限定）', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                { letter: 'k', name: 'skeleton key', rawText: 'k - a skeleton key', isKey: true }
            ];

            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            // 東 (11, 10) に大きな箱 (chest / large box: glyphId 3448 + 348 = 3796 等)
            // AreaStateManager の adjacentEntities に isContainer: true のオブジェクトとして認識させる
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
            const adjUnlockAction = actions.find(a => a.id?.startsWith('ACTION_UNLOCK_CONTAINER_') && a.id !== 'ACTION_UNLOCK_CONTAINER_FEET');
            expect(adjUnlockAction).toBeUndefined();
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
});


