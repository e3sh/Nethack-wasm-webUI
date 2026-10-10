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

    it('3. syncInventorySilent または inputRequired でキー送信マクロがバイパスされ、Worker 汎用 CALL_SHIM 経由で装備スロットが即時同期されること', async () => {
        // querySequenceSilent をスパイしてキー送信マクロが呼ばれないことを検証
        const querySequenceSilentSpy = vi.spyOn(core, 'querySequenceSilent');

        // メニュー経由 (nh_menu) で届いたアイテム (rawObjPtr 保持) をセット
        const menuItems = [
            {
                letter: 'a',
                str: 'a - a blessed +2 long sword (weapon in hand)',
                rawStr: 'a - a blessed +2 long sword (weapon in hand)',
                glyph: 3707,
                onum: 24,
                rawObjPtr: 0x1000,
                flags: { blessed: true, cursed: false, bknown: true }
            },
            {
                letter: 'b',
                str: 'b - 5 uncursed rations of cram',
                rawStr: 'b - 5 uncursed rations of cram',
                glyph: 3700,
                onum: 10,
                quan: 5,
                rawObjPtr: 0x2000,
                flags: { uncursed: true, blessed: false, cursed: false, bknown: true }
            }
        ];
        gkl.inventoryStateManager.updateFromMenuItems(menuItems);
        expect(gkl.inventoryStateManager.items.length).toBe(2);

        const dummyEquipment = [0x1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // uwep = 0x1000 ('a')

        // Worker 側: 汎用 CALL_SHIM のみを処理（GET_INVENTORY 等のドメインメッセージは一切受け付けない）
        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'CALL_SHIM') {
                const { callId, payload } = msg;
                let buffer = null;
                let result = 0;
                if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                    buffer = dummyEquipment;
                }
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'SHIM_RESULT',
                            callId,
                            result,
                            buffer
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
        expect(sword.rawObjPtr).toBe(0x1000);
        expect(sword.isWielded).toBe(true);
        expect(sword.equipSlot).toBe('weapon');
        expect(sword.flags.blessed).toBe(true);

        const food = gkl.inventoryStateManager.items[1];
        expect(food.letter).toBe('b');
        expect(food.onum).toBe(10);
        expect(food.quan).toBe(5);
        expect(food.rawObjPtr).toBe(0x2000);
        expect(food.isWielded).toBe(false);
    });

    it('4. ターン確定 (inputRequired, isTopLevelTurn: true) 時に CALL_SHIM 経由で装備スロットが自動同期され、inventoryStateUpdated が発火すること', async () => {
        const menuItems = [
            {
                letter: 'd',
                str: 'd - a cursed leather armor (being worn)',
                rawStr: 'd - a cursed leather armor (being worn)',
                glyph: 3750,
                onum: 15,
                quan: 1,
                rawObjPtr: 0x5000,
                flags: { blessed: false, cursed: true, bknown: true }
            }
        ];
        gkl.inventoryStateManager.updateFromMenuItems(menuItems);

        const dummyEquipment = [0, 0, 0, 0x5000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // uarm = 0x5000 (suit)

        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'CALL_SHIM') {
                const { callId, payload } = msg;
                let buffer = null;
                let result = 0;
                if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                    buffer = dummyEquipment;
                }
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'SHIM_RESULT',
                            callId,
                            result,
                            buffer
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
        expect(armor.rawObjPtr).toBe(0x5000);
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

    it('6. 初期起動時(メニュー未受信)でも、auto/strict モードで DUMP_ALL_INVENT (0x43) によりキーマクロゼロで即座にインベントリと装備が完全同期されること', async () => {
        gkl.inventoryStateManager.directBindingMode = 'strict';
        expect(gkl.inventoryStateManager.items).toHaveLength(0);
        expect(gkl.inventoryStateManager.isSynced).toBe(false);

        // キー入力送信監視スパイ
        const queueSequenceSpy = vi.fn();
        bridge.queueSequence = queueSequenceSpy;

        const dummyEquipment = new Array(14).fill(0);
        dummyEquipment[0] = 0x1000; // uwep = 0x1000 (weapon)
        dummyEquipment[3] = 0x2000; // uarm = 0x2000 (suit)

        // Item 1: long sword (+1, quan 1, invlet 'a' (97), blessed|bknown (5), weight 40, ptr 0x1000, o_id 101, cobj 0)
        const item1 = [25, 40, 1, 1, 1, 97, 5, 40, 0x1000, 101, 0, 0];
        // Item 2: leather armor (+0, quan 1, invlet 'b' (98), uncursed|bknown (4), weight 150, ptr 0x2000, o_id 102, cobj 0)
        const item2 = [15, 150, 1, 0, 3, 98, 4, 150, 0x2000, 102, 0, 0];
        // Item 3: food ration (quan 2, invlet 'c' (99), uncursed|bknown (4), weight 40, ptr 0x3000, o_id 103, cobj 0)
        const item3 = [278, 20, 2, 0, 7, 99, 4, 40, 0x3000, 103, 0, 0];

        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'CALL_SHIM') {
                const { callId, payload } = msg;
                let buffer = null;
                let result = 0;
                if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                    buffer = dummyEquipment;
                } else if (payload.cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                    result = 3;
                    buffer = [...item1, ...item2, ...item3];
                }
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'SHIM_RESULT',
                            callId,
                            result,
                            buffer
                        }
                    });
                });
            }
        });

        let updatedEmitted = false;
        core.on('inventoryStateUpdated', (mgr) => {
            updatedEmitted = true;
        });

        // syncInventorySilent を直接呼び出し (サイドバーの同期ボタン、または初回起動ターンの自動同期)
        const syncSuccess = await gkl.syncInventorySilent();

        expect(syncSuccess).toBe(true);
        // キーマクロが一切送出されていないこと（完全バイパス）
        expect(queueSequenceSpy).not.toHaveBeenCalled();

        // イベントが発火したこと
        expect(updatedEmitted).toBe(true);

        // インベントリ状態が同期完了になっていること
        expect(gkl.inventoryStateManager.isSynced).toBe(true);
        expect(gkl.inventoryStateManager.items).toHaveLength(3);

        const sword = gkl.inventoryStateManager.items[0];
        expect(sword.letter).toBe('a');
        expect(sword.onum).toBe(25);
        expect(sword.rawObjPtr).toBe(0x1000);
        expect(sword.isWielded).toBe(true);
        expect(sword.equipSlot).toBe('weapon');

        const armor = gkl.inventoryStateManager.items[1];
        expect(armor.letter).toBe('b');
        expect(armor.onum).toBe(15);
        expect(armor.rawObjPtr).toBe(0x2000);
        expect(armor.isWorn).toBe(true);
        expect(armor.equipSlot).toBe('suit');

        const food = gkl.inventoryStateManager.items[2];
        expect(food.letter).toBe('c');
        expect(food.quan).toBe(2);
        expect(food.isWielded).toBe(false);
        expect(food.isWorn).toBe(false);
    });
});
