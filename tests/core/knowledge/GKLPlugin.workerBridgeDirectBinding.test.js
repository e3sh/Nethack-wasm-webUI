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
        gkl.wasmDirectBindingService.setCachedLevelGlyphs(new Int32Array(80 * 21).fill(3992));
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

    describe('Stage 8.3-B & §2.5: Turn Lifecycle (Sync Barrier), --More-- Guard & Commit-Driven Pipeline', () => {
        it('7. フロア移動 (clear_nhwindow) からターン確定 (inputRequired && isTopLevelTurn) で DUMP_LEVEL_TERRAIN が自動ロードされ、areaStateCommitted が発火すること', async () => {
            const committedEvents = [];
            core.on('areaStateCommitted', (payload) => {
                committedEvents.push(payload);
            });

            // Phase 1: ACTION
            core.emit('userActionSent', { sequence: ['>'] });
            expect(gkl.areaStateManager.isTurnTransitioning).toBe(true);

            // Phase 2: STREAMING (フロア移動によるマップクリア ➔ 座標・グリフ受信)
            core.emit('clear_nhwindow', { windowId: 2 });
            expect(gkl.areaStateManager.isFloorTransitioning).toBe(true);
            expect(gkl.areaStateManager._needsFullTerrainDump).toBe(true);

            core.emit('curs', { windowId: 2, x: 10, y: 5 });
            // ストリーミング中はまだ Worker 同期前のため推測仮床 (3992) を生成しない
            expect(gkl.areaStateManager.inferredFloorCount).toBe(0);

            // 全フロア地形モック (80x21 = 1680 bytes): (10, 5) を上り階段 (typ=26), (11, 5) を通路 (typ=24) に設定
            const mockTerrain = new Array(1680).fill(0);
            mockTerrain[5 * 80 + 10] = 26; // STAIRS
            mockTerrain[5 * 80 + 11] = 24; // CORR

            mockWorker.postMessage.mockImplementation((msg) => {
                if (msg.type === 'CALL_SHIM') {
                    const { callId, payload } = msg;
                    let result = 0;
                    let buffer = null;
                    if (payload.cmd === SHIM_CMD.GET_CELL_INFO && payload.arg1 === 10 && payload.arg2 === 5) {
                        result = 26 | (0 << 8) | (1 << 16) | (1 << 17);
                    } else if (payload.cmd === SHIM_CMD.DUMP_LEVEL_TERRAIN) {
                        result = 0;
                        buffer = mockTerrain;
                    } else if (payload.cmd === SHIM_CMD.DUMP_LEVEL_GLYPHS) {
                        const mockGlyphs = new Array(1680).fill(0);
                        mockGlyphs[5 * 80 + 10] = 3998; // STAIRS
                        mockGlyphs[5 * 80 + 11] = 3995; // CORR
                        result = 0;
                        buffer = mockGlyphs;
                    } else if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                        buffer = new Array(14).fill(0);
                    } else if (payload.cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                        result = 0;
                        buffer = [];
                    }
                    Promise.resolve().then(() => {
                        mockWorker.onmessage({
                            data: { type: 'SHIM_RESULT', callId, result, buffer }
                        });
                    });
                }
            });

            // Phase 3 & 4: SETTLED & SHIM SYNC -> COMMIT
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                isTopLevelTurn: true
            });

            await new Promise(r => setTimeout(r, 30));

            expect(committedEvents.length).toBe(1);
            expect(gkl.areaStateManager.isTurnTransitioning).toBe(false);
            expect(gkl.areaStateManager.isFloorTransitioning).toBe(false);
            expect(gkl.areaStateManager._needsFullTerrainDump).toBe(false);
            expect(gkl.areaStateManager.inferredFloorCount).toBe(0);

            // 自キャラ足元 (10, 5) は確定同期され、未踏セル (11, 5) にも全域下敷き真床 (isCachedPreload: true) が安全に展開されていること
            expect(gkl.areaStateManager.grid[5][10].bottom).not.toBeNull();
            expect(gkl.areaStateManager.grid[5][10].bottom.isGenuine).toBe(true);
            expect(gkl.areaStateManager.grid[5][11].bottom).not.toBeNull();
            expect(gkl.areaStateManager.grid[5][11].bottom.isCachedPreload).toBe(true);

            // その後 (11, 5) にモンスターが観測された時点で、isCachedPreload が解除され通路 (3995) が確定維持されること
            core.emit('print_glyph', {
                x: 11,
                y: 5,
                glyph: 10,
                glyphInfo: { glyph: 10, sym: 'd', color: 3, oclass: 1 }
            });
            expect(gkl.areaStateManager.grid[5][11].bottom).not.toBeNull();
            expect(gkl.areaStateManager.grid[5][11].bottom.isGenuine).toBe(true);
            expect(gkl.areaStateManager.grid[5][11].bottom.glyph).toBe(3995);
            expect(gkl.areaStateManager.grid[5][11].bottom.isCachedPreload).toBeUndefined();
        });

        it('8. --More-- 待機中 (display_nhwindow WIN_MESSAGE blocking / isMorePrompt: true) は Sync Barrier を通過せず CALL_SHIM や areaStateCommitted が発火しないこと', async () => {
            let committedCount = 0;
            core.on('areaStateCommitted', () => {
                committedCount++;
            });

            mockWorker.postMessage.mockClear();

            // Driver から --More-- (windowId=1, blocking=true) が発火されたケース
            const resolver = { respond: vi.fn() };
            bridge.emit('display_nhwindow', {
                windowId: 1,
                blocking: true,
                resolver
            });

            await new Promise(r => setTimeout(r, 20));

            expect(core.isMorePromptActive).toBe(true);
            const callShimCalls = mockWorker.postMessage.mock.calls.filter(c => c[0]?.type === 'CALL_SHIM');
            expect(callShimCalls.length).toBe(0);
            expect(committedCount).toBe(0);
        });

        it('9. 連続キー入力時に、古いターンの CALL_SHIM 応答が遅延到着しても世代管理 (notifyActionSent) により破棄され areaStateCommitted が誤発火しないこと', async () => {
            let committedCount = 0;
            core.on('areaStateCommitted', () => {
                committedCount++;
            });

            gkl.areaStateManager.updatePlayerPosition(10, 5);

            let pendingShimReplies = [];
            mockWorker.postMessage.mockImplementation((msg) => {
                if (msg.type === 'CALL_SHIM') {
                    // すぐには返さず保留する
                    pendingShimReplies.push(msg);
                }
            });

            // ターン N の inputRequired が発火し、非同期 CALL_SHIM が開始される
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                isTopLevelTurn: true
            });

            expect(pendingShimReplies.length).toBeGreaterThan(0);
            const turnNCall = pendingShimReplies[0];

            // ターン N の CALL_SHIM が返る前に、ユーザーが次のアクション (ターン N+1) を送出！
            core.emit('userActionSent', { sequence: ['l'] });

            // 遅れてターン N の CALL_SHIM 応答が Worker から返却される
            mockWorker.onmessage({
                data: {
                    type: 'SHIM_RESULT',
                    callId: turnNCall.callId,
                    result: 25 | (1 << 16),
                    buffer: null
                }
            });

            await new Promise(r => setTimeout(r, 20));

            // 世代不一致のため古いターン N の同期は破棄され、areaStateCommitted は発火しない！
            expect(committedCount).toBe(0);
        });

        it('10. プレイヤーがその場から動かずにアイテムを落とす (d) / 拾う (,) を行った場合、curs ➔ inputRequired で足元 cell.middle と山積み isPile が即座に更新されること', async () => {
            const px = 10;
            const py = 5;
            gkl.areaStateManager.updatePlayerPosition(px, py);

            let floorObjHeadPtr = 0x7000;
            // 0x7000 (dagger: otyp=16, nextPtr=0x7100) -> 0x7100 (long sword: otyp=25, nextPtr=0)
            let objMap = {
                0x7000: [16, 10, 1, 0, 2, 97, 4, 10, 0x7100, 0, 201],
                0x7100: [25, 40, 1, 1, 2, 98, 5, 40, 0, 0, 202]
            };

            mockWorker.postMessage.mockImplementation((msg) => {
                if (msg.type === 'CALL_SHIM') {
                    const { callId, payload } = msg;
                    let result = 0;
                    let buffer = null;
                    if (payload.cmd === SHIM_CMD.GET_CELL_INFO && payload.arg1 === px && payload.arg2 === py) {
                        result = 25 | (0 << 8) | (1 << 16) | (1 << 17); // ROOM
                    } else if (payload.cmd === SHIM_CMD.GET_OBJECT_AT && payload.arg1 === px && payload.arg2 === py) {
                        result = floorObjHeadPtr;
                    } else if (payload.cmd === SHIM_CMD.DUMP_OBJECT_INFO) {
                        result = 0;
                        buffer = objMap[payload.arg1] || null;
                    } else if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                        buffer = new Array(14).fill(0);
                    } else if (payload.cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                        result = 0;
                        buffer = [];
                    }
                    Promise.resolve().then(() => {
                        mockWorker.onmessage({
                            data: { type: 'SHIM_RESULT', callId, result, buffer }
                        });
                    });
                }
            });

            // 1. 2個山積み状態の足元で curs(10, 5) ➔ inputRequired が届いた場合
            core.emit('curs', { windowId: 2, x: px, y: py });
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                isTopLevelTurn: true
            });
            await new Promise(r => setTimeout(r, 30));

            const cellAfterDrop = gkl.areaStateManager.grid[py][px];
            expect(cellAfterDrop.middle).not.toBeNull();
            expect(cellAfterDrop.middle.subType).toBe(16);
            expect(cellAfterDrop.middle.isPile).toBe(true);
            expect(cellAfterDrop.middle.rawGlyph).toBe(7992 + 16); // GLYPH_OBJ_PILETOP_OFF + 16

            // 2. その場で全部拾って 0個になり curs(10, 5) ➔ inputRequired が届いた場合
            floorObjHeadPtr = 0;
            core.emit('userActionSent', { sequence: [','] });
            core.emit('curs', { windowId: 2, x: px, y: py });
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                isTopLevelTurn: true
            });
            await new Promise(r => setTimeout(r, 30));

            const cellAfterPickup = gkl.areaStateManager.grid[py][px];
            expect(cellAfterPickup.middle).toBeNull();
        });

        it('11. 新仕様（corpsenm 入り 12要素）の床アイテム走査時に corpsenm がポインタと誤認されず正しく山積みが取得できること', async () => {
            const px = 8;
            const py = 8;
            gkl.areaStateManager.updatePlayerPosition(px, py);

            const ptrStatue = 20001;
            const ptrRock = 20002;
            const objMap = {
                // 12要素: [otyp, owt, quan, spe, oclass, invlet, flags, weight, corpsenm, nexthere, cobj, o_id]
                // 像 (otyp: 476, corpsenm: 45) -> nexthere: ptrRock (20002)
                [ptrStatue]: [476, 500, 1, 0, 7, 0, 0, 500, 45, ptrRock, 0, 101],
                // 岩 (otyp: 474, corpsenm: -1) -> nexthere: 0
                [ptrRock]: [474, 10, 1, 0, 7, 0, 0, 10, -1, 0, 0, 102],
            };

            mockWorker.postMessage.mockImplementation((msg) => {
                if (msg.type === 'CALL_SHIM') {
                    const { callId, payload } = msg;
                    let result = 0;
                    let buffer = null;

                    if (payload.cmd === SHIM_CMD.GET_CELL_INFO) {
                        result = 25 | (0 << 8) | (1 << 16) | (1 << 17);
                    } else if (payload.cmd === SHIM_CMD.GET_OBJECT_AT) {
                        result = ptrStatue;
                    } else if (payload.cmd === SHIM_CMD.DUMP_OBJECT_INFO) {
                        result = 0;
                        buffer = objMap[payload.arg1] || null;
                    } else if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                        buffer = new Array(14).fill(0);
                    } else if (payload.cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                        result = 0;
                        buffer = [];
                    }

                    Promise.resolve().then(() => {
                        mockWorker.onmessage({
                            data: { type: 'SHIM_RESULT', callId, result, buffer }
                        });
                    });
                }
            });

            const floorItems = await gkl.wasmDirectBindingService.fetchObjectsAt(px, py);
            expect(floorItems.length).toBe(2);
            expect(floorItems[0].onum).toBe(476);
            expect(floorItems[0].corpsenm).toBe(45);
            expect(floorItems[1].onum).toBe(474);
            expect(floorItems[1].corpsenm).toBe(-1);
        });

        it('12. WorkerBridge 隔離環境において DUMP_SKILLS (0x51) が自動同期されマクロ送信なしに SkillStateManager が更新されること', async () => {
            const rawSkills = new Array(38 * 2).fill(0);
            // P_LONG_SWORD (id: 7) -> skillLev = 2 (Basic), maxSkillLev = 3 (Skilled)
            rawSkills[7 * 2 + 0] = 2;
            rawSkills[7 * 2 + 1] = 3;
            // P_TWO_WEAPON_COMBAT (id: 36) -> skillLev = 1 (Unskilled), maxSkillLev = 3 (Skilled)
            rawSkills[36 * 2 + 0] = 1;
            rawSkills[36 * 2 + 1] = 3;

            const weaponSlots = 2;

            mockWorker.postMessage.mockImplementation((msg) => {
                if (msg.type === 'CALL_SHIM') {
                    const { callId, payload } = msg;
                    let result = 0;
                    let buffer = null;

                    if (payload.cmd === SHIM_CMD.DUMP_SKILLS) {
                        result = weaponSlots;
                        buffer = rawSkills;
                    } else if (payload.cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                        result = 0;
                        buffer = [];
                    } else if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                        buffer = new Array(14).fill(0);
                    } else if (payload.cmd === SHIM_CMD.GET_CELL_INFO) {
                        result = 25 | (0 << 8) | (1 << 16) | (1 << 17);
                    }

                    Promise.resolve().then(() => {
                        mockWorker.onmessage({
                            data: { type: 'SHIM_RESULT', callId, result, buffer }
                        });
                    });
                }
            });

            let skillsUpdatedEmitted = false;
            core.on('skillsStateUpdated', () => {
                skillsUpdatedEmitted = true;
            });

            // マクロキー送信監視
            const querySpy = vi.spyOn(core, 'querySequenceSilent');

            // ターン入力待ちイベント (第1ターンを模した poskey)
            core.emit('inputRequired', {
                context: 'poskey',
                type: 'poskey',
                isTopLevelTurn: true
            });

            await new Promise(r => setTimeout(r, 40));

            // 1. SkillStateManager が同期され、正しいスキル情報を持つこと
            expect(gkl.skillStateManager.isSynced).toBe(true);
            const skills = gkl.skillStateManager.getSkills();
            expect(skills.length).toBe(37);

            const longSword = skills.find(s => s.id === 7);
            expect(longSword).toBeDefined();
            expect(longSword.name).toBe('long sword');
            expect(longSword.rank.key).toBe('basic');
            expect(longSword.canEnhance).toBe(false); // Direct Binding 単体では練習値 (P_ADVANCE) 未取得のため安全に false

            const twoWeapon = gkl.skillStateManager.getTwoWeaponSkill();
            expect(twoWeapon).toBeDefined();
            expect(twoWeapon.rank.key).toBe('unskilled');
            expect(gkl.skillStateManager.canTwoWeapon()).toBe(true); // not restricted

            // 2. skillsStateUpdated イベントが発火したこと
            expect(skillsUpdatedEmitted).toBe(true);

            // 3. マクロキー (#enhance 等) は一切送信されていないこと
            expect(querySpy).not.toHaveBeenCalled();

            // 4. syncSkillsSilent() を手動でキックしてもマクロがバイパスされること
            await gkl.syncSkillsSilent();
            expect(querySpy).not.toHaveBeenCalled();
        });
    });
});
