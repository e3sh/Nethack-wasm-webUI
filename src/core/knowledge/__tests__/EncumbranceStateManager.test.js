import { describe, it, expect, beforeEach } from 'vitest';
import {
    EncumbranceStateManager,
    EncumbranceLevel,
    parseAcurrStr,
    parseCon,
    calculateCarryingCapacity,
    detectBucStatus,
    detectContainerType,
    getContainerBaseWeight
} from "../state/EncumbranceStateManager.js";

describe('EncumbranceStateManager (GKL 重量・負荷管理コア)', () => {
    let esm;

    beforeEach(() => {
        esm = new EncumbranceStateManager();
    });

    describe('1. 筋力・耐久度パースと許容量 (Carrying Capacity) 算出', () => {
        it('acurrstr 準拠で STR が正しく数値に変換されること', () => {
            expect(parseAcurrStr(10)).toBe(10);
            expect(parseAcurrStr("16")).toBe(16);
            expect(parseAcurrStr("18")).toBe(18);
            // 18/01 ~ 18/31 -> 19
            expect(parseAcurrStr("18/01")).toBe(19);
            expect(parseAcurrStr("18/31")).toBe(19);
            // 18/32 ~ 18/81 -> 20
            expect(parseAcurrStr("18/32")).toBe(20);
            expect(parseAcurrStr("18/50")).toBe(20);
            expect(parseAcurrStr("18/81")).toBe(20);
            // 18/82 ~ 18/100, 18/** -> 21
            expect(parseAcurrStr("18/82")).toBe(21);
            expect(parseAcurrStr("18/99")).toBe(21);
            expect(parseAcurrStr("18/**")).toBe(21);
            // 19 ~ 25 (Gauntlets of Power 等)
            expect(parseAcurrStr("25")).toBe(25);
            // 範囲外クランプ
            expect(parseAcurrStr(1)).toBe(3);
            expect(parseAcurrStr(30)).toBe(25);
        });

        it('CON が正しくパースされること', () => {
            expect(parseCon(14)).toBe(14);
            expect(parseCon("18")).toBe(18);
            expect(parseCon(2)).toBe(3);
            expect(parseCon(30)).toBe(25);
        });

        it('NetHack 計算式 (25 * (STR + CON) + 50) により許容量が算出され、最大1000に制限されること', () => {
            // STR 16, CON 14 -> 25 * (16 + 14) + 50 = 800
            expect(calculateCarryingCapacity(16, 14)).toBe(800);

            // STR 18/50 (=20), CON 16 -> 25 * (20 + 16) + 50 = 950
            expect(calculateCarryingCapacity("18/50", 16)).toBe(950);

            // STR 25, CON 20 -> 25 * (25 + 20) + 50 = 1175 -> MAX 1000
            expect(calculateCarryingCapacity(25, 20)).toBe(1000);
        });
    });

    describe('2. 単一アイテム重量と金貨計算', () => {
        it('OBJECT_KNOWLEDGE_MAP からアイテム基本重量が取得できること', () => {
            // onum 27 = spear (重量 30)
            const spear = { onum: 27, count: 1 };
            expect(esm.getItemWeight(spear)).toBe(30);

            // 3本の槍 -> 90
            const spears = { onum: 27, count: 3 };
            expect(esm.getItemWeight(spears)).toBe(90);
        });

        it('金貨は 100 枚あたり重量 1 として計算されること', () => {
            const gold50 = { letter: '$', isGold: true, count: 50 };
            expect(esm.getItemWeight(gold50)).toBe(0);

            const gold100 = { letter: '$', isGold: true, count: 100 };
            expect(esm.getItemWeight(gold100)).toBe(1);

            const gold250 = { letter: '$', isGold: true, count: 250 };
            expect(esm.getItemWeight(gold250)).toBe(2);

            // rawText からのパース: "340 gold pieces"
            const goldText = { letter: '$', isGold: true, rawText: '340 gold pieces' };
            expect(esm.getItemWeight(goldText)).toBe(3);
        });

        it('彫像 (Statue)、巨岩 (Boulder)、死体 (Corpse) の重量がフォールバック認識されること', () => {
            const statue = { letter: 's', rawText: 'a statue of a newt' };
            expect(esm.getItemWeight(statue)).toBe(2500);

            const statueJa = { letter: 's', rawText: 'ニュートの像' };
            expect(esm.getItemWeight(statueJa)).toBe(2500);

            const boulder = { letter: '`', rawText: 'a boulder' };
            expect(esm.getItemWeight(boulder)).toBe(6000);

            const corpse = { letter: '%', rawText: 'a goblin corpse' };
            expect(esm.getItemWeight(corpse)).toBe(200);
        });
    });

    describe('3. コンテナ（袋・箱）の実効重量と BoH 補正', () => {
        it('通常の袋 (Sack: 基本重量 15) は中身と単純合算されること', () => {
            const sackRecord = {
                containerType: 'SACK',
                baseWeight: 15,
                isKnown: true,
                bcursed: 0,
                contentsRawWeight: 100,
            };
            expect(esm.computeContainerWeight(sackRecord)).toBe(115);
        });

        it('未確認の袋 (isKnown = false) は中身重量を合算せず、袋自体の重さのみとなること', () => {
            const unknownRecord = {
                containerType: 'SACK',
                baseWeight: 15,
                isKnown: false,
                bcursed: 0,
                contentsRawWeight: 100,
            };
            expect(esm.computeContainerWeight(unknownRecord)).toBe(15);
        });

        it('保持の袋 (Bag of Holding) の BUC 状態による重量軽減・増加が正確に計算されること', () => {
            // 中身 100 の場合
            // 祝福 (25% 切り上げ) -> 15 + ceil(100 / 4) = 15 + 25 = 40
            const blessedBoH = {
                containerType: 'BAG_OF_HOLDING',
                baseWeight: 15,
                isKnown: true,
                bcursed: 1,
                contentsRawWeight: 100,
            };
            expect(esm.computeContainerWeight(blessedBoH)).toBe(40);

            // 未呪い (50% 切り上げ) -> 15 + ceil(100 / 2) = 15 + 50 = 65
            const uncursedBoH = {
                containerType: 'BAG_OF_HOLDING',
                baseWeight: 15,
                isKnown: true,
                bcursed: 0,
                contentsRawWeight: 100,
            };
            expect(esm.computeContainerWeight(uncursedBoH)).toBe(65);

            // 呪い (200%) -> 15 + 100 * 2 = 215
            const cursedBoH = {
                containerType: 'BAG_OF_HOLDING',
                baseWeight: 15,
                isKnown: true,
                bcursed: -1,
                contentsRawWeight: 100,
            };
            expect(esm.computeContainerWeight(cursedBoH)).toBe(215);

            // 端数切り上げの確認 (中身 11)
            // 祝福: 15 + ceil(11 / 4) = 15 + 3 = 18
            const fractionalBoH = {
                containerType: 'BAG_OF_HOLDING',
                baseWeight: 15,
                isKnown: true,
                bcursed: 1,
                contentsRawWeight: 11,
            };
            expect(esm.computeContainerWeight(fractionalBoH)).toBe(18);
        });
    });

    describe('4. インベントリ総合負荷状態 (getEncumbranceState) の算出', () => {
        it('手持ちアイテム・許容量から比率とレベルを判定できること', () => {
            // モックの StatusAccessor
            const mockStatusAccessor = {
                getStatus: () => ({
                    stats: { str: "16", con: 14 }, // capacity = 800
                    cap: 0,
                    gold: { amount: 0 }
                })
            };

            // モックの InventoryStateManager (総重量 400 -> 50% = NORMAL)
            const mockInventoryStateManager = {
                getItems: () => [
                    { letter: 'a', onum: 27, count: 10, rawText: '10 spears' } // 30 * 10 = 300
                ]
            };

            esm.setStatusAccessor(mockStatusAccessor);
            esm.setInventoryStateManager(mockInventoryStateManager);

            let state = esm.getEncumbranceState();
            expect(state.totalWeight).toBe(300);
            expect(state.capacity).toBe(800);
            expect(state.percentage).toBe(38);
            expect(state.level).toBe(EncumbranceLevel.NORMAL);
            expect(state.hasUninspectedContainer).toBe(false);

            // 槍を20本追加 (計 600 / 800 = 75% -> CAUTION)
            mockInventoryStateManager.getItems = () => [
                { letter: 'a', onum: 27, count: 20, rawText: '20 spears' } // 30 * 20 = 600
            ];

            state = esm.getEncumbranceState();
            expect(state.totalWeight).toBe(600);
            expect(state.percentage).toBe(75);
            expect(state.level).toBe(EncumbranceLevel.CAUTION);

            // 槍を30本追加 (計 900 / 800 = 113% -> DANGER)
            mockInventoryStateManager.getItems = () => [
                { letter: 'a', onum: 27, count: 30, rawText: '30 spears' } // 30 * 30 = 900
            ];

            state = esm.getEncumbranceState();
            expect(state.totalWeight).toBe(900);
            expect(state.percentage).toBe(113);
            expect(state.level).toBe(EncumbranceLevel.DANGER);
        });

        it('未確認袋がある場合は hasUninspectedContainer が true となり、袋自体の重さのみ反映されること', () => {
            const mockStatusAccessor = {
                getStatus: () => ({
                    stats: { str: 10, con: 10 }, // capacity = 550
                    cap: 0,
                    gold: { amount: 0 }
                })
            };

            const mockInventoryStateManager = {
                getItems: () => [
                    { letter: 'b', isBag: true, isContainer: true, rawText: 'a sack', onum: 217 }
                ]
            };

            esm.setStatusAccessor(mockStatusAccessor);
            esm.setInventoryStateManager(mockInventoryStateManager);

            let state = esm.getEncumbranceState();
            expect(state.hasUninspectedContainer).toBe(true);
            expect(state.totalWeight).toBe(15); // Sack の基本重量のみ

            // 袋の中身を確認 (updateContainer でスナップ確定)
            esm.updateContainer('b', {
                name: 'a sack',
                isKnown: true,
                items: [
                    { onum: 27, count: 2 } // 30 * 2 = 60
                ]
            });

            state = esm.getEncumbranceState();
            expect(state.hasUninspectedContainer).toBe(false);
            expect(state.totalWeight).toBe(75); // 15 + 60
        });
    });

    describe('5. BL_CAP 公式ステータスとのハイブリッド連動', () => {
        it('計算上 Normal でも BL_CAP が 1 (Burdened) なら最終レベルが CAUTION に引き上げられること', () => {
            const mockStatusAccessor = {
                getStatus: () => ({
                    stats: { str: 18, con: 18 }, // capacity = 950
                    cap: 1, // BL_CAP: Burdened
                    gold: { amount: 0 }
                })
            };

            // 総重量わずか 30 (比率 3%)
            const mockInventoryStateManager = {
                getItems: () => [
                    { letter: 'a', onum: 27, count: 1 } // 30
                ]
            };

            esm.setStatusAccessor(mockStatusAccessor);
            esm.setInventoryStateManager(mockInventoryStateManager);

            const state = esm.getEncumbranceState();
            expect(state.calculatedLevel).toBe(EncumbranceLevel.NORMAL);
            expect(state.blCap).toBe(1);
            expect(state.blCapLevel).toBe(EncumbranceLevel.CAUTION);
            // ハイブリッド連動で CAUTION へ引き上げ
            expect(state.level).toBe(EncumbranceLevel.CAUTION);
        });

        it('BL_CAP が 5 (Overloaded) の場合は CRITICAL に引き上げられ、パーセンテージも 134% 以上に同期されること', () => {
            const mockStatusAccessor = {
                getStatus: () => ({
                    stats: { str: 18, con: 18 }, // capacity = 950
                    cap: 5, // BL_CAP: Overloaded
                    gold: { amount: 0 }
                })
            };

            // 推定計算上はわずか 300 (約 32%)
            const mockInventoryStateManager = {
                getItems: () => [
                    { letter: 'a', onum: 27, count: 10 } // 30 * 10 = 300
                ]
            };

            esm.setStatusAccessor(mockStatusAccessor);
            esm.setInventoryStateManager(mockInventoryStateManager);

            const state = esm.getEncumbranceState();
            expect(state.blCap).toBe(5);
            expect(state.level).toBe(EncumbranceLevel.CRITICAL);
            expect(state.calculatedPercentage).toBe(32);
            // 🎯 BL_CAP=5 に同期してパーセンテージは 134%、比率は 1.0 (満タン)
            expect(state.percentage).toBe(134);
            expect(state.ratio).toBe(1.0);
        });
    });

    describe('6. ContainerContentsManager とのイベント連携', () => {
        it('contentsConfirmed イベント受信時にコンテナキャッシュが isKnown=true で更新されること', () => {
            let confirmedCallback;
            const mockContentsManager = {
                on: (event, cb) => {
                    if (event === 'contentsConfirmed') confirmedCallback = cb;
                }
            };
            esm.setContainerContentsManager(mockContentsManager);

            const mockStatusAccessor = {
                getStatus: () => ({ stats: { str: 10, con: 10 }, cap: 0, gold: { amount: 0 } })
            };
            const mockInventoryStateManager = {
                getItems: () => [{ letter: 'c', isBag: true, isContainer: true, rawText: 'a sack', onum: 217 }]
            };
            esm.setStatusAccessor(mockStatusAccessor);
            esm.setInventoryStateManager(mockInventoryStateManager);

            // 最初は未確認袋がある
            expect(esm.getEncumbranceState().hasUninspectedContainer).toBe(true);

            // contentsConfirmed 発火
            confirmedCallback({
                letter: 'c',
                name: 'a sack',
                items: [{ onum: 27, count: 1 }] // 30
            });

            const state = esm.getEncumbranceState();
            expect(state.hasUninspectedContainer).toBe(false);
            expect(state.totalWeight).toBe(45); // 15 + 30
        });

        it('itemTransferred イベント受信時にもコンテナキャッシュが更新されること', () => {
            let transferCallback;
            const mockContentsManager = {
                on: (event, cb) => {
                    if (event === 'itemTransferred') transferCallback = cb;
                }
            };
            esm.setContainerContentsManager(mockContentsManager);

            const mockStatusAccessor = {
                getStatus: () => ({ stats: { str: 10, con: 10 }, cap: 0, gold: { amount: 0 } })
            };
            const mockInventoryStateManager = {
                getItems: () => [{ letter: 'c', isBag: true, isContainer: true, rawText: 'a sack', onum: 217 }]
            };
            esm.setStatusAccessor(mockStatusAccessor);
            esm.setInventoryStateManager(mockInventoryStateManager);

            transferCallback({
                letter: 'c',
                name: 'a sack',
                items: [{ onum: 27, count: 2 }] // 60
            });

            const state = esm.getEncumbranceState();
            expect(state.hasUninspectedContainer).toBe(false);
            expect(state.totalWeight).toBe(75); // 15 + 60
        });
    });
});
