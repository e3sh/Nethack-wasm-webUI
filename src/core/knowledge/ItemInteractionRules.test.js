import { describe, it, expect } from 'vitest';
import { ContextActionEngine } from './ContextActionEngine.js';
import { TacticalAdvisor } from './TacticalAdvisor.js';
import { InventoryStateManager } from './InventoryStateManager.js';
import { AreaStateManager } from './AreaStateManager.js';
import { createTestItem } from '../../../test/helpers/testItemFactory.js';

describe('ITEM_INTERACTION_RULES - アイテム・相互作用ルール連携テスト', () => {

    describe('1. 床刻み (E) のコンテキスト制御と無条件 E の抑制', () => {
        it('平常時（安全な部屋・未識別の杖なし）では、床刻み (E) が無条件に生成されないこと', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isFloor: true }
            };

            const actions = ContextActionEngine.generateActions(areaState);
            const engraveAction = actions.find(a => a.key === 'E' || a.id.includes('ENGRAVE'));
            expect(engraveAction).toBeUndefined();
        });

        it('危険な敵が接近している場合、エルベレス刻み (ACTION_ENGRAVE_ELBERETH) が高優先度で生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isFloor: true }
            };
            areaState.adjacentMonsters = [{
                dir: { code: 'N' },
                entity: { name: 'soldier ant', monOffset: 2 }
            }];

            const actions = ContextActionEngine.generateActions(areaState);
            const elberethAction = actions.find(a => a.id === 'ACTION_ENGRAVE_ELBERETH');
            expect(elberethAction).toBeDefined();
            expect(elberethAction.priority).toBe(92);
            expect(elberethAction.label).toContain('エルベレス');

            const advices = TacticalAdvisor.generateAdvices({ areaState });
            const elberethAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_EMERGENCY_ELBERETH');
            expect(elberethAdvice).toBeDefined();
            expect(elberethAdvice.severity).toBe('CRITICAL');
        });

        it('ペット（飼い犬・猫等）のみが隣接している場合、エルベレス刻みやCRITICAL警告が出ないこと', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isFloor: true }
            };
            areaState.adjacentMonsters = [{
                dir: { code: 'N' },
                entity: { name: 'little dog', type: 'PET', isPet: true, monOffset: 260 }
            }];

            const actions = ContextActionEngine.generateActions(areaState);
            const elberethAction = actions.find(a => a.id === 'ACTION_ENGRAVE_ELBERETH');
            expect(elberethAction).toBeUndefined();

            const advices = TacticalAdvisor.generateAdvices({ areaState });
            const elberethAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_EMERGENCY_ELBERETH');
            expect(elberethAdvice).toBeUndefined();
        });

        it('LOW DANGER のザコ敵 (newt等) が1体接近しているだけではエルベレス刻み（CRITICAL）が出ないこと', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isFloor: true }
            };
            areaState.adjacentMonsters = [{
                dir: { code: 'N' },
                entity: { name: 'newt', monOffset: 322 }
            }];

            const actions = ContextActionEngine.generateActions(areaState);
            const elberethAction = actions.find(a => a.id === 'ACTION_ENGRAVE_ELBERETH');
            expect(elberethAction).toBeUndefined();

            const advices = TacticalAdvisor.generateAdvices({ areaState });
            const elberethAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_EMERGENCY_ELBERETH');
            expect(elberethAdvice).toBeUndefined();
        });

        it('ザコ敵でも HP が 50% 以下に低下しているピンチ時はエルベレス刻みが発動すること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isFloor: true }
            };
            areaState.adjacentMonsters = [{
                dir: { code: 'N' },
                entity: { name: 'newt', monOffset: 322 }
            }];

            const statusAccessor = {
                getStatus: () => ({
                    hp: { current: 4, max: 15 } // 26% HP (Pinch)
                })
            };

            const actions = ContextActionEngine.generateActions(areaState, null, null, null, statusAccessor);
            const elberethAction = actions.find(a => a.id === 'ACTION_ENGRAVE_ELBERETH');
            expect(elberethAction).toBeDefined();

            const advices = TacticalAdvisor.generateAdvices({ areaState, statusAccessor });
            const elberethAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_EMERGENCY_ELBERETH');
            expect(elberethAdvice).toBeDefined();
            expect(elberethAdvice.severity).toBe('CRITICAL');
        });

        it('安全な部屋で未識別の杖を所持している場合、杖テスト刻み (ACTION_ENGRAVE_TEST_WAND) が生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isFloor: true }
            };

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('glass wand', 'a', { isUnidentified: true })
            ];

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const wandAction = actions.find(a => a.id === 'ACTION_ENGRAVE_TEST_WAND');
            expect(wandAction).toBeDefined();
            expect(wandAction.label).toContain('杖を床に刻んで鑑定テスト');

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const wandAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_WAND_ENGRAVE_TEST');
            expect(wandAdvice).toBeDefined();
            expect(wandAdvice.messageJa).toContain('未識別の杖 [a]');
        });
    });

    describe('2. 神壇 (Altar) & 流し台 (Sink) での判定アクション', () => {
        it('神壇の上に立ち BUC 未判定アイテムがある場合、神壇置きアクション (ACTION_DROP_ON_ALTAR) が生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isAltar: true }
            };

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('helmet', 'b', { buc: 'unknown' })
            ];

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const altarAction = actions.find(a => a.id === 'ACTION_DROP_ON_ALTAR');
            expect(altarAction).toBeDefined();
            expect(altarAction.priority).toBe(88);
            expect(altarAction.label).toContain('神壇に置いて呪い判定');

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const altarAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_ALTAR_BUC_DROP');
            expect(altarAdvice).toBeDefined();
            expect(altarAdvice.messageJa).toContain('神壇検知');
        });

        it('シンクの上に立ち未識別の指輪がある場合、指輪識別アクション (ACTION_SINK_TEST_RING) がdドロップ・CRITICALリスクで生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = {
                cmapFlags: { isSink: true }
            };

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('wooden ring', 'c', { isUnidentified: true })
            ];

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const sinkAction = actions.find(a => a.id === 'ACTION_SINK_TEST_RING');
            expect(sinkAction).toBeDefined();
            expect(sinkAction.label).toContain('指輪を流し台に落として識別');
            expect(sinkAction.keySequence).toEqual(['d', 'c']);
            expect(sinkAction.risk).toBe('CRITICAL');
            expect(sinkAction.consumesItem).toBe(true);
        });

        it('鑑定済みの杖 (wand of striking 等) のみ所持している場合、杖の安全鑑定テストが出ないこと', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = { cmapFlags: { isFloor: true } };

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('wand of striking', 'w', { rawText: 'w - a wand of striking (0:4)', isUnidentified: false })
            ];

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const wandAction = actions.find(a => a.id === 'ACTION_ENGRAVE_TEST_WAND');
            expect(wandAction).toBeUndefined();

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const wandAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_WAND_ENGRAVE_TEST');
            expect(wandAdvice).toBeUndefined();
        });

        it('未識別の杖 (glass wand) を所持している場合、杖の安全鑑定テストが生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);
            areaState.feet.bottom = { cmapFlags: { isFloor: true } };

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('glass wand', 'z', { isUnidentified: true })
            ];

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const wandAction = actions.find(a => a.id === 'ACTION_ENGRAVE_TEST_WAND');
            expect(wandAction).toBeDefined();

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const wandAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_WAND_ENGRAVE_TEST');
            expect(wandAdvice).toBeDefined();
        });
    });

    describe('3. 特殊アイテム相互作用 & 誤用防止ガード', () => {
        it('ユニコーンの角と未識別薬がある場合、#dip アクションとアドバイスが生成されること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            const areaState = areaMgr.getAreaState(10, 10, 1);

            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('unicorn horn', 'h'),
                createTestItem('purple potion', 'p', { isUnidentified: true })
            ];

            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const dipAction = actions.find(a => a.id === 'ACTION_DIP_UNICORN_HORN');
            expect(dipAction).toBeDefined();
            expect(dipAction.label).toContain('ユニコーンの角を薬に浸す');

            const advices = TacticalAdvisor.generateAdvices({ areaState, inventoryState: invMgr });
            const dipAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_UNICORN_HORN_DIP');
            expect(dipAdvice).toBeDefined();
            expect(dipAdvice.messageJa).toContain('ユニコーンの角 [h]');
            expect(dipAdvice.messageJa).toContain('薬 [p]');
        });

        it('恐怖の巻物所持時、手持ち読書を阻止する誤用防止警告が出ること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('scroll of scare monster', 's')
            ];

            const advices = TacticalAdvisor.generateAdvices({ inventoryState: invMgr });
            const scareAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_SCARE_MONSTER_MISUSE');
            expect(scareAdvice).toBeDefined();
            expect(scareAdvice.severity).toBe('CRITICAL');
            expect(scareAdvice.messageJa).toContain('手持ちで読むと消滅します');
        });

        it('手品袋と打ち消しの杖を同時に所持している場合、爆発防止即死警告が出ること', () => {
            const invMgr = new InventoryStateManager();
            invMgr.items = [
                createTestItem('bag of holding', 'b'),
                createTestItem('wand of cancellation', 'w')
            ];

            const advices = TacticalAdvisor.generateAdvices({ inventoryState: invMgr });
            const explosionAdvice = advices.find(a => a.id === 'ADVICE_INTERACTION_BAG_OF_HOLDING_EXPLOSION');
            expect(explosionAdvice).toBeDefined();
            expect(explosionAdvice.severity).toBe('CRITICAL');
            expect(explosionAdvice.messageJa).toContain('大爆発し全アイテムが消滅');
        });
    });
});
