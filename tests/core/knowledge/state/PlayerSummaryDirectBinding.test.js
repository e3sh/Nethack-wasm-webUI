import { describe, it, expect, beforeEach } from 'vitest';
import { parsePlayerSummaryBuffer, getDungeonBranch, DUNGEON_BRANCHES, SHIM_CMD } from '../../../../src/core/knowledge/services/binding/BindingConstants.js';
import { PlayerWasmAdapter } from '../../../../src/core/knowledge/services/binding/PlayerWasmAdapter.js';
import { WasmDirectBindingService } from '../../../../src/core/knowledge/services/WasmDirectBindingService.js';
import { AttributeStateManager } from '../../../../src/core/knowledge/state/AttributeStateManager.js';
import { AreaStateManager } from '../../../../src/core/knowledge/state/AreaStateManager.js';

describe('Stage 8.4: Branch Identification, Prayer Tracker, and Player Resistances Integration', () => {

    describe('1. BindingConstants: parsePlayerSummaryBuffer and getDungeonBranch', () => {
        it('correctly maps all 9 NetHack 5.0 dungeon branches by dnum', () => {
            const expected = [
                { dnum: 0, id: 'dungeon', nameJa: 'メインダンジョン' },
                { dnum: 1, id: 'gehennom', nameJa: 'ゲヘナ' },
                { dnum: 2, id: 'mines', nameJa: 'ノームの鉱山' },
                { dnum: 3, id: 'quest', nameJa: 'クエスト' },
                { dnum: 4, id: 'sokoban', nameJa: '倉庫番' },
                { dnum: 5, id: 'fort_ludios', nameJa: 'フォート・ルディオス' },
                { dnum: 6, id: 'vlad_tower', nameJa: 'ヴラドの塔' },
                { dnum: 7, id: 'elemental_planes', nameJa: '元素界' },
                { dnum: 8, id: 'tutorial', nameJa: 'チュートリアル' }
            ];

            for (const item of expected) {
                const branch = getDungeonBranch(item.dnum);
                expect(branch.id).toBe(item.id);
                expect(branch.nameJa).toBe(item.nameJa);
            }

            // 未知の dnum はデフォルトで dungeon に安全フォールバック
            expect(getDungeonBranch(99).id).toBe('dungeon');
        });

        it('decodes raw int32 buffer into structured player summary object', () => {
            // [dnum, dlevel, ublesscnt, ugangr, uluck, ualign_record, uhunger, moves]
            const raw = new Int32Array([2, 5, 0, 0, 3, 10, 800, 1500]);
            const summary = parsePlayerSummaryBuffer(raw);

            expect(summary).not.toBeNull();
            expect(summary.dnum).toBe(2);
            expect(summary.dlevel).toBe(5);
            expect(summary.branchId).toBe('mines');
            expect(summary.floorKey).toBe('mines:5');
            expect(summary.ublesscnt).toBe(0);
            expect(summary.ugangr).toBe(0);
            expect(summary.uluck).toBe(3);
            expect(summary.ualignRecord).toBe(10);
            expect(summary.uhunger).toBe(800);
            expect(summary.moves).toBe(1500);
            expect(summary.canPray).toBe(true);
        });

        it('calculates canPray correctly based on ublesscnt and ugangr', () => {
            // お祈りクールダウン中 (ublesscnt > 0)
            const coolingDown = parsePlayerSummaryBuffer([0, 1, 150, 0, 0, 0, 900, 200]);
            expect(coolingDown.canPray).toBe(false);

            // 神の怒り中 (ugangr > 0)
            const angryGod = parsePlayerSummaryBuffer([0, 1, 0, 2, 0, 0, 900, 200]);
            expect(angryGod.canPray).toBe(false);

            // 両方 0 のときのみ安全にお祈り可能
            const ready = parsePlayerSummaryBuffer([0, 1, 0, 0, 0, 0, 900, 200]);
            expect(ready.canPray).toBe(true);
        });

        it('returns null when buffer length is less than 8', () => {
            expect(parsePlayerSummaryBuffer(null)).toBeNull();
            expect(parsePlayerSummaryBuffer([])).toBeNull();
            expect(parsePlayerSummaryBuffer([0, 1, 2])).toBeNull();
        });
    });

    describe('2. PlayerWasmAdapter and WasmDirectBindingService: getPlayerSummary', () => {
        let adapter;
        let mockMemory;

        beforeEach(() => {
            adapter = new PlayerWasmAdapter();
            mockMemory = {
                isBridgeAvailable: () => true,
                allocateBuffer: () => 0x1000,
                freeBuffer: () => {},
                bridgeCall: (cmd, a1, a2, bufPtr, bufSize) => {
                    if (cmd === SHIM_CMD.GET_PLAYER_SUMMARY) {
                        return 0; // 成功
                    }
                    return -1;
                },
                readInt32Array: (ptr, count) => {
                    // dnum: 4 (Sokoban), dlevel: 2, ublesscnt: 50, ugangr: 0
                    return new Int32Array([4, 2, 50, 0, 1, 5, 950, 340]);
                }
            };
        });

        it('dumps player summary from live memory bridgeCall', () => {
            const summary = adapter.getPlayerSummary(mockMemory, true, true);
            expect(summary).not.toBeNull();
            expect(summary.branchId).toBe('sokoban');
            expect(summary.floorKey).toBe('sokoban:2');
            expect(summary.ublesscnt).toBe(50);
            expect(summary.canPray).toBe(false);
            expect(adapter.cachedPlayerSummary).toEqual(summary);
        });

        it('delegates through WasmDirectBindingService facade', () => {
            const service = new WasmDirectBindingService();
            service.memory = mockMemory;

            const summary = service.getPlayerSummary();
            expect(summary).not.toBeNull();
            expect(summary.branchId).toBe('sokoban');
            expect(summary.ublesscnt).toBe(50);
        });

        it('fetches player summary asynchronously via worker bridge', async () => {
            const mockBridge = {
                callShim: async (cmd, a1, a2, size, type) => {
                    if (cmd === SHIM_CMD.GET_PLAYER_SUMMARY) {
                        return { result: 0, buffer: [1, 20, 0, 0, 0, 0, 700, 5000] }; // Gehennom 20F
                    }
                    return { result: -1 };
                }
            };

            const summary = await adapter.fetchPlayerSummary(mockBridge, null, true, false);
            expect(summary).not.toBeNull();
            expect(summary.branchId).toBe('gehennom');
            expect(summary.floorKey).toBe('gehennom:20');
            expect(summary.canPray).toBe(true);
        });
    });

    describe('3. AttributeStateManager: Prayer Tracker and God Anger SSOT Integration', () => {
        let manager;

        beforeEach(() => {
            manager = new AttributeStateManager();
        });

        it('syncs ublesscnt, ugangr, and canSafelyPray directly from direct binding service', () => {
            const mockSummary = {
                dnum: 2,
                dlevel: 3,
                branchId: 'mines',
                floorKey: 'mines:3',
                ublesscnt: 120,
                ugangr: 1,
                uluck: 2,
                canPray: false
            };

            const mockService = {
                getPlayerProps: () => new Array(69).fill(0),
                getPlayerProfile: () => null,
                getPlayerSummary: () => mockSummary
            };

            const changed = manager.syncFromDirectBinding(mockService);
            expect(changed).toBe(true);
            expect(manager.ublesscnt).toBe(120);
            expect(manager.ugangr).toBe(1);
            expect(manager.uluck).toBe(2);
            expect(manager.canSafelyPray).toBe(false);
            expect(manager.dnum).toBe(2);
            expect(manager.dlevel).toBe(3);
            expect(manager.playerSummary).toEqual(mockSummary);
        });

        it('updates canSafelyPray to true when prayer timer expires and god is peaceful', () => {
            const readySummary = {
                dnum: 0,
                dlevel: 1,
                branchId: 'dungeon',
                floorKey: 'dungeon:1',
                ublesscnt: 0,
                ugangr: 0,
                uluck: 0,
                canPray: true
            };

            manager.syncPlayerSummaryFromDirectBinding(readySummary);
            expect(manager.ublesscnt).toBe(0);
            expect(manager.ugangr).toBe(0);
            expect(manager.canSafelyPray).toBe(true);
            expect(manager.isSafeToPray()).toBe(true);
        });

        it('returns false from isSafeToPray when cooling down or god is angry', () => {
            manager.syncPlayerSummaryFromDirectBinding({
                ublesscnt: 100,
                ugangr: 0,
                canPray: false
            });
            expect(manager.isSafeToPray()).toBe(false);

            manager.syncPlayerSummaryFromDirectBinding({
                ublesscnt: 0,
                ugangr: 1,
                canPray: false
            });
            expect(manager.isSafeToPray()).toBe(false);
        });
    });

    describe('4. AreaStateManager: 100% Deterministic Branch Identification and Floor Separation', () => {
        let asm;

        beforeEach(() => {
            asm = new AreaStateManager(80, 21);
        });

        it('updates currentFloor and identifies branch transition deterministically from dnum', () => {
            // 初期状態: dungeon:1
            expect(asm.currentFloor).toBe('Dlvl:1');
            expect(asm.currentBranchId).toBe('dungeon');

            // ノームの鉱山 地下2階へ突入
            const minesSummary = {
                dnum: 2,
                dlevel: 2,
                branchId: 'mines',
                branchName: 'The Gnomish Mines',
                branchNameJa: 'ノームの鉱山',
                theme: 'cave',
                floorKey: 'mines:2'
            };

            const transition = asm.syncPlayerSummary(minesSummary);
            expect(transition).not.toBeNull();
            expect(transition.isNewFloor).toBe(true);
            expect(transition.isNewBranch).toBe(true);
            expect(transition.branchId).toBe('mines');
            expect(transition.floorKey).toBe('mines:2');
            expect(asm.currentFloor).toBe('mines:2');
            expect(asm.currentBranchId).toBe('mines');
            expect(asm.currentDnum).toBe(2);
            expect(asm.currentDlevel).toBe(2);

            // 鉱山内での階層移動 (mines:2 -> mines:3)
            const deeperMines = {
                dnum: 2,
                dlevel: 3,
                branchId: 'mines',
                branchName: 'The Gnomish Mines',
                branchNameJa: 'ノームの鉱山',
                theme: 'cave',
                floorKey: 'mines:3'
            };

            const deeperTransition = asm.syncPlayerSummary(deeperMines);
            expect(deeperTransition.isNewFloor).toBe(true);
            expect(deeperTransition.isNewBranch).toBe(false); // 同一ブランチ内のため false
            expect(asm.currentFloor).toBe('mines:3');

            // 本流ダンジョンへの帰還 (dnum: 0 -> Dlvl:3)
            const dungeonReturn = {
                dnum: 0,
                dlevel: 3,
                branchId: 'dungeon',
                branchName: 'The Dungeons of Doom',
                branchNameJa: 'メインダンジョン',
                theme: 'dungeon',
                floorKey: 'Dlvl:3'
            };

            const returnTransition = asm.syncPlayerSummary(dungeonReturn);
            expect(returnTransition.isNewFloor).toBe(true);
            expect(returnTransition.isNewBranch).toBe(true); // ブランチ再遷移
            expect(returnTransition.branchId).toBe('dungeon');
            expect(asm.currentFloor).toBe('Dlvl:3');
        });

        it('does not trigger floor transition or reset grid on initial game start (Dlvl:1)', () => {
            // ゲーム開始時: initial state is Dlvl:1
            expect(asm.currentFloor).toBe('Dlvl:1');

            // 1ターン目のサマリー同期 (dnum: 0, dlevel: 1 -> Dlvl:1)
            const initSummary = parsePlayerSummaryBuffer([0, 1, 0, 0, 0, 0, 900, 1]);
            expect(initSummary.floorKey).toBe('Dlvl:1');

            const transition = asm.syncPlayerSummary(initSummary);
            expect(transition.isNewFloor).toBe(false); // 新フロアではない
            expect(transition.isNewBranch).toBe(false); // 新ブランチではない
            expect(asm.currentFloor).toBe('Dlvl:1');
        });

        it('automatically syncs player summary inside syncFromDirectBinding', () => {
            const mockService = {
                isAvailable: () => true,
                getCellInfo: () => null,
                getPlayerSummary: () => ({
                    dnum: 4,
                    dlevel: 1,
                    branchId: 'sokoban',
                    branchName: 'Sokoban',
                    branchNameJa: '倉庫番',
                    theme: 'puzzle',
                    floorKey: 'sokoban:1'
                }),
                getFullMonsterAt: () => null
            };

            asm.setDirectBindingService(mockService);
            asm.syncFromDirectBinding(0);

            expect(asm.currentFloor).toBe('sokoban:1');
            expect(asm.currentBranchId).toBe('sokoban');
        });
    });
});
