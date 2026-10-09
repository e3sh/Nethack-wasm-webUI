import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebUICore } from '../../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../../src/driver/NetHackWasmWorkerBridge.js';
import { GKLPlugin } from '../../../src/core/knowledge/GKLPlugin.js';
import { SHIM_CMD } from '../../../src/core/knowledge/services/WasmDirectBindingService.js';

describe('GKLPlugin - WorkerBridge 隔離環境における直接同期 ＆ フォールバックバイパス検証 (Stage 8.2-A / Task 3)', () => {
    let mockWorker;
    let bridge;
    let core;
    let gkl;

    beforeEach(() => {
        // Web Worker モック
        mockWorker = {
            postMessage: vi.fn(),
            terminate: vi.fn(),
            onmessage: null,
            onerror: null
        };

        globalThis.Worker = vi.fn().mockImplementation(() => mockWorker);

        // メインスレッド側の WorkerBridge を生成 (driver.memory は当然 undefined)
        bridge = new NetHackWasmWorkerBridge('dummy-worker.js');
        expect(bridge.memory).toBeUndefined();

        // GKLPlugin を作成し、WebUICore にマウント
        gkl = new GKLPlugin();
        core = new WebUICore({ driver: bridge, gkl });
    });

    afterEach(() => {
        delete globalThis.Worker;
    });

    it('1. ブラウザ環境 (driver.memory が undefined) でも WasmDirectBindingService が正常に初期化されること', () => {
        expect(gkl.wasmDirectBindingService).not.toBeNull();
        expect(gkl.wasmDirectBindingService.bridge).toBe(bridge);
        expect(gkl.wasmDirectBindingService.isAvailable()).toBe(true);
        expect(gkl.areaStateManager.directBindingService).toBe(gkl.wasmDirectBindingService);
    });

    it('2. ターン待ち確定時に Worker から真の床・部屋・罠が同期され、推測床 (3992番) がバイパスされること', async () => {
        const playerX = 12;
        const playerY = 6;

        // 自キャラ座標を設定
        gkl.areaStateManager.updatePlayerPosition(playerX, playerY);

        // Worker 側の CALL_SHIM 応答を模擬 (C コアの shim_bridge_call 相当)
        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'CALL_SHIM') {
                const { callId, payload } = msg;
                const { cmd, arg1, arg2 } = payload;

                let result = 0;
                if (cmd === SHIM_CMD.GET_CELL_INFO && arg1 === playerX && arg2 === playerY) {
                    // typ=25 (ROOM), flags=0, lit=1, roomno=3
                    result = 25 | (0 << 8) | (1 << 16) | (3 << 17);
                } else if (cmd === SHIM_CMD.GET_ROOM_TYPE && arg1 === 3) {
                    // rtype=10 (TEMPLE / 寺院)
                    result = 10;
                } else if (cmd === SHIM_CMD.GET_TRAP_AT && arg1 === playerX && arg2 === playerY) {
                    // ttyp=0 (罠なし)
                    result = 0;
                }

                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'SHIM_RESULT',
                            callId,
                            result,
                            buffer: null
                        }
                    });
                });
            }
        });

        // ターン確定イベント (WAITING_INPUT, isTopLevelTurn: true) を発火
        core.emit('inputRequired', {
            context: 'poskey',
            type: 'poskey',
            isTopLevelTurn: true
        });

        // 非同期の Worker 往復完了を待機
        await new Promise(r => setTimeout(r, 20));

        // 1. Worker へ CALL_SHIM が送信されたことを検証
        const callShimMessages = mockWorker.postMessage.mock.calls
            .map(c => c[0])
            .filter(m => m.type === 'CALL_SHIM');
        expect(callShimMessages.length).toBeGreaterThanOrEqual(1);
        expect(callShimMessages[0].payload.cmd).toBe(SHIM_CMD.GET_CELL_INFO);

        // 2. 足元の真の床情報を取得
        const genuineFloor = gkl.areaStateManager.getGenuineFloor(playerX, playerY);
        expect(genuineFloor).toBeDefined();

        // 🎯 決定的な確認:
        // 推測床 (inferred: true, glyph: 3992) ではなく、Worker 経由で取得した真の床 (ROOM) であること！
        expect(genuineFloor.inferred).toBe(false); // 推測ではなく真の床！
        expect(genuineFloor.isGenuine).toBe(true);
        expect(genuineFloor.cellInfo.typ).toBe(25); // LEVL_TYP.ROOM
        expect(genuineFloor.room).toBeDefined();
        expect(genuineFloor.room.rtype).toBe(10); // TEMPLE (寺院)
        expect(genuineFloor.room.nameJa).toBe('寺院');
    });

    it('3. syncInventorySilent または inputRequired でキー送信マクロがバイパスされ、Worker 経由でインベントリが即時同期されること', async () => {
        // querySequenceSilent をスパイしてキー送信マクロが呼ばれないことを検証
        const querySequenceSilentSpy = vi.spyOn(core, 'querySequenceSilent');

        const dummyItems = [
            {
                ptr: 0x1000,
                invlet: 'a',
                onum: 24, // long sword
                otyp: 24,
                quan: 1,
                spe: 2,
                oclass: 1, // WEAPON_CLASS
                weight: 40,
                owt: 40,
                flags: { blessed: true, cursed: false, bknown: true }
            },
            {
                ptr: 0x2000,
                invlet: 'b',
                onum: 10,
                otyp: 10,
                quan: 5,
                spe: 0,
                oclass: 7, // FOOD_CLASS
                weight: 10,
                owt: 10,
                flags: { uncursed: true, blessed: false, cursed: false, bknown: true }
            }
        ];
        const dummyEquipment = {
            ptrArray: [0x1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // uwep = 0x1000 ('a')
        };

        // Worker 側の GET_INVENTORY 応答を模擬
        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'GET_INVENTORY') {
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'GET_INVENTORY_RESULT',
                            callId: msg.callId,
                            items: dummyItems,
                            equipment: dummyEquipment
                        }
                    });
                });
            } else if (msg.type === 'CALL_SHIM') {
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'SHIM_RESULT',
                            callId: msg.callId,
                            result: 0,
                            buffer: null
                        }
                    });
                });
            }
        });

        // 🎯 syncInventorySilent を直接呼び出す
        const success = await gkl.syncInventorySilent();
        expect(success).toBe(true);

        // 🎯 決定的な確認: キー送信マクロ (['i', ' ', '\x1b']) は一切呼び出されていない！
        expect(querySequenceSilentSpy).not.toHaveBeenCalled();

        // GKL のインベントリ状態が即時同期されていること
        expect(gkl.inventoryStateManager.items.length).toBe(2);

        const sword = gkl.inventoryStateManager.items[0];
        expect(sword.letter).toBe('a');
        expect(sword.onum).toBe(24);
        expect(sword.isWielded).toBe(true);
        expect(sword.equipSlot).toBe('weapon');
        expect(sword.flags.blessed).toBe(true);

        const food = gkl.inventoryStateManager.items[1];
        expect(food.letter).toBe('b');
        expect(food.onum).toBe(10);
        expect(food.quan).toBe(5);
        expect(food.isWielded).toBe(false);
    });

    it('4. ターン確定 (inputRequired, isTopLevelTurn: true) 時にインベントリが自動同期され、inventoryStateUpdated が発火すること', async () => {
        const dummyItems = [
            {
                ptr: 0x5000,
                invlet: 'd',
                onum: 15,
                otyp: 15,
                quan: 1,
                spe: 0,
                oclass: 2, // ARMOR_CLASS
                weight: 50,
                owt: 50,
                flags: { blessed: false, cursed: true, bknown: true }
            }
        ];
        const dummyEquipment = {
            ptrArray: [0, 0, 0, 0x5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // uarm = 0x5000 (suit)
        };

        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'GET_INVENTORY') {
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'GET_INVENTORY_RESULT',
                            callId: msg.callId,
                            items: dummyItems,
                            equipment: dummyEquipment
                        }
                    });
                });
            } else if (msg.type === 'CALL_SHIM') {
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'SHIM_RESULT',
                            callId: msg.callId,
                            result: 0,
                            buffer: null
                        }
                    });
                });
            }
        });

        let updatedEmitted = false;
        core.on('inventoryStateUpdated', (mgr) => {
            updatedEmitted = true;
        });

        // ターン確定イベントを発火
        core.emit('inputRequired', {
            type: 'poskey',
            isTopLevelTurn: true
        });

        // Worker 通信完了を待機
        await new Promise(r => setTimeout(r, 20));

        expect(updatedEmitted).toBe(true);
        expect(gkl.inventoryStateManager.items.length).toBe(1);
        const armor = gkl.inventoryStateManager.items[0];
        expect(armor.letter).toBe('d');
        expect(armor.equipSlot).toBe('suit');
        expect(armor.isWorn).toBe(true);
        expect(armor.flags.cursed).toBe(true);
    });

    it('5. print_glyph イベント受信時に Worker 隔離環境でも TypeError (bridgeCall) が発生せず、自機・モンスターが反映されること', () => {
        // 自キャラ glyph: GLYPH_PET_OFF + 0 (ペット猫) or 自機 '@' (GLYPH_MON_OFF + valkyrie)
        const monGlyph = 100; // モンスター glyph
        const playerGlyph = 300; // 自機 glyph

        // print_glyph イベントを発火（WebUICore 経由）
        expect(() => {
            core.emit('print_glyph', {
                x: 10,
                y: 5,
                glyph: monGlyph,
                glyphInfo: {
                    glyph: monGlyph,
                    sym: 'd',
                    color: 3,
                    oclass: 1
                }
            });
            core.emit('print_glyph', {
                x: 15,
                y: 8,
                glyph: playerGlyph,
                glyphInfo: {
                    glyph: playerGlyph,
                    sym: '@',
                    color: 7,
                    oclass: 1
                }
            });
        }).not.toThrow();

        // エラーなく cell.top が更新されていること
        const cellMon = gkl.areaStateManager.grid[5][10];
        expect(cellMon.top).toBeDefined();
        expect(cellMon.top.glyph).toBe(monGlyph);

        const cellPlayer = gkl.areaStateManager.grid[8][15];
        expect(cellPlayer.top).toBeDefined();
        expect(cellPlayer.top.glyph).toBe(playerGlyph);
    });
});
