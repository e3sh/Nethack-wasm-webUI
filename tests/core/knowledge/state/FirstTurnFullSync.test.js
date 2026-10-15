import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebUICore } from '../../../../src/core/WebUICore.js';
import { NetHackWasmWorkerBridge } from '../../../../src/driver/NetHackWasmWorkerBridge.js';
import { GKLPlugin } from '../../../../src/core/knowledge/GKLPlugin.js';
import { SHIM_CMD } from '../../../../src/core/knowledge/services/WasmDirectBindingService.js';

describe('セーブ復帰 / !tutorial 時の初回ターン同期 統合検証テスト (FirstTurnFullSync)', () => {
    let mockWorker;
    let bridge;
    let core;
    let gkl;

    beforeEach(() => {
        mockWorker = {
            postMessage: vi.fn(),
            terminate: vi.fn(),
            onmessage: null,
            onerror: null
        };

        globalThis.Worker = vi.fn().mockImplementation(() => mockWorker);

        bridge = new NetHackWasmWorkerBridge('dummy-worker.js');
        gkl = new GKLPlugin();
        core = new WebUICore({ driver: bridge, gkl });
    });

    afterEach(() => {
        delete globalThis.Worker;
    });

    it('初回ターン (poskey) においてマクロ競合なくインベントリ・スキル・属性・識別がすべて同期されること', async () => {
        const rawSkills = new Array(38 * 2).fill(0);
        rawSkills[7 * 2 + 0] = 2; // long sword: basic
        rawSkills[7 * 2 + 1] = 3; // skilled

        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'CALL_SHIM') {
                const { callId, payload } = msg;
                let result = 0;
                let buffer = null;

                if (payload.cmd === SHIM_CMD.DUMP_SKILLS) {
                    result = 1; // 1 slot available
                    buffer = rawSkills;
                } else if (payload.cmd === SHIM_CMD.DUMP_ALL_INVENT) {
                    result = 2;
                    // 12 words per item: [otyp, owt, quan, spe, oclass, invlet, flags, weight, corpsenm, nexthere, cobj, o_id]
                    buffer = [
                        // item 1: short sword (otyp: 4, oclass: 2 (WEAPON), invlet: 'a' (97))
                        4, 30, 1, 0, 2, 97, 0, 30, -1, 0, 0, 1,
                        // item 2: apple (otyp: 300, oclass: 7 (FOOD), invlet: 'b' (98))
                        300, 2, 2, 0, 7, 98, 0, 2, -1, 0, 0, 2
                    ];
                } else if (payload.cmd === SHIM_CMD.GET_EQUIPMENT_PTRS) {
                    buffer = new Array(14).fill(0);
                } else if (payload.cmd === SHIM_CMD.GET_CELL_INFO) {
                    result = 25 | (0 << 8) | (1 << 16) | (1 << 17);
                } else if (payload.cmd === SHIM_CMD.GET_PLAYER_PROPS) {
                    result = 69;
                    buffer = new Array(69).fill(0);
                } else if (payload.cmd === SHIM_CMD.DUMP_DISCOVERIES) {
                    result = 600;
                    buffer = new Array(600).fill(1);
                }

                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: { type: 'SHIM_RESULT', callId, result, buffer }
                    });
                });
            }
        });

        const querySpy = vi.spyOn(core, 'querySequenceSilent');

        // 1. セーブ復帰やゲーム開始時に神話・復帰メッセージのテキストウィンドウ (windowId: 4) が開く
        bridge.emit('create_nhwindow', { windowId: 4 });
        bridge.emit('display_nhwindow', { windowId: 4, blocking: false });
        // 2. ウィンドウが破棄される
        bridge.emit('destroy_nhwindow', { windowId: 4 });

        // 3. 復帰時イベント (game_restored) 発火
        bridge.emit('game_restored', {});

        // 4. 第1ターンの poskey 入力待ちが発火 (Driver から送られてくる)
        core.emit('inputRequired', {
            context: 'poskey',
            type: 'poskey',
            promptCategory: 'POSKEY',
            isTopLevelTurn: true,
            isMorePrompt: false
        });

        // Worker との非同期往復を待機
        await new Promise(r => setTimeout(r, 60));

        // 検証:
        // A. インベントリが同期されていること
        expect(gkl.inventoryStateManager.isSynced).toBe(true);
        expect(gkl.inventoryStateManager.items.length).toBe(2);
        expect(gkl.inventoryStateManager.items[0].letter).toBe('a');

        // B. スキル熟練度が同期されていること
        expect(gkl.skillStateManager.isSynced).toBe(true);
        expect(gkl.skillStateManager.getSkills().length).toBe(37);
        const ls = gkl.skillStateManager.getSkills().find(s => s.id === 7);
        expect(ls.name).toBe('long sword');
        expect(ls.rank.key).toBe('basic');
        expect(ls.canEnhance).toBe(false);

        // C. 属性耐性が同期されていること
        expect(gkl.attributeStateManager.isSynced).toBe(true);

        // D. 識別状態が同期されていること
        expect(gkl.discoveryStateManager.isSynced).toBe(true);

        // E. マクロキーは一切送信されていないこと（画面汚染・非同期衝突ゼロ）
        expect(querySpy).not.toHaveBeenCalled();
    });
});
