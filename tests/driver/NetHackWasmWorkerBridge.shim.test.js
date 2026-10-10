import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetHackWasmWorkerBridge } from '../../src/driver/NetHackWasmWorkerBridge.js';

describe('NetHackWasmWorkerBridge - callShim 最小調停 PoC テスト (Stage 8.2-A)', () => {
    let mockWorker;
    let bridge;

    beforeEach(() => {
        // Web Worker の双方向メッセージングを模擬するモック
        mockWorker = {
            postMessage: vi.fn(),
            terminate: vi.fn(),
            onmessage: null,
            onerror: null
        };

        // Node.js 環境では globalThis.Worker が未定義のため直接代入
        globalThis.Worker = vi.fn().mockImplementation(() => mockWorker);
        bridge = new NetHackWasmWorkerBridge('dummy-worker.js');
    });

    afterEach(() => {
        delete globalThis.Worker;
    });

    it('1. callShim が Worker へ CALL_SHIM を送信し、SHIM_RESULT で 1 往復 Promise 解決されること', async () => {
        const cmd = 0x10; // SHIM_CMD_GET_CELL_INFO
        const arg1 = 15;
        const arg2 = 8;

        const promise = bridge.callShim(cmd, arg1, arg2);

        // 1. Worker への postMessage 送信を検証
        expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
        const sentMsg = mockWorker.postMessage.mock.calls[0][0];
        expect(sentMsg.type).toBe('CALL_SHIM');
        expect(sentMsg.callId).toBeDefined();
        expect(sentMsg.payload).toEqual({
            cmd: 0x10,
            arg1: 15,
            arg2: 8,
            bufferSize: 0,
            bufferType: 'int32'
        });

        // 2. Worker 側から SHIM_RESULT が返ってきたことを模擬
        mockWorker.onmessage({
            data: {
                type: 'SHIM_RESULT',
                callId: sentMsg.callId,
                result: 25, // typ: 25 (ROOM)
                buffer: null
            }
        });

        // 3. Promise が正しく解決されること
        const response = await promise;
        expect(response).toEqual({
            result: 25,
            buffer: null
        });
    });

    it('2. バッファ指定付き callShim で配列データが正しく取得できること', async () => {
        const cmd = 0x30; // SHIM_CMD_GET_PLAYER_SUMMARY
        const bufferSize = 32;

        const promise = bridge.callShim(cmd, 0, 0, bufferSize, 'int32');

        const sentMsg = mockWorker.postMessage.mock.calls[0][0];
        expect(sentMsg.type).toBe('CALL_SHIM');
        expect(sentMsg.payload.bufferSize).toBe(32);

        const dummyPlayerSummary = [0, 1, 0, 0, 0, 10, 900, 42]; // [dnum, dlevel, ...]
        mockWorker.onmessage({
            data: {
                type: 'SHIM_RESULT',
                callId: sentMsg.callId,
                result: 0,
                buffer: dummyPlayerSummary
            }
        });

        const response = await promise;
        expect(response.result).toBe(0);
        expect(response.buffer).toEqual(dummyPlayerSummary);
    });

    it('3. Worker 側でエラーが発生した場合、Promise が reject されること', async () => {
        const promise = bridge.callShim(0x99);

        const sentMsg = mockWorker.postMessage.mock.calls[0][0];

        mockWorker.onmessage({
            data: {
                type: 'SHIM_ERROR',
                callId: sentMsg.callId,
                error: 'Wasm memory not initialized'
            }
        });

        await expect(promise).rejects.toThrow('Wasm memory not initialized');
    });

    it('4. bridge.terminate() 実行時に未解決の shim 呼び出しが安全に reject されること', async () => {
        const promise = bridge.callShim(0x10, 1, 1);

        bridge.terminate();

        await expect(promise).rejects.toThrow('Worker terminated');
    });

    it('5. Worker 内の NetHackMemory と連動した 1 往復のフルサイクル疎通（E2E調停検証）', async () => {
        // NetHackMemory を Worker 側で用意
        const mockModule = {
            _shim_bridge_call: vi.fn((cmd, arg1, arg2, buf, len) => {
                if (cmd === 0x10) {
                    // SHIM_CMD_GET_CELL_INFO: typ(25=ROOM) | (flags << 8) | (lit << 16) | (roomno << 17)
                    return 25 | (0 << 8) | (1 << 16) | (2 << 17);
                }
                return 0;
            }),
            HEAPU8: new Uint8Array(1024),
            HEAP32: new Int32Array(256),
            _malloc: vi.fn(() => 64),
            _free: vi.fn()
        };

        const { NetHackMemory } = await import('../../src/driver/NetHackMemory.js');
        const memory = new NetHackMemory(mockModule);

        // Worker 側の CALL_SHIM ハンドラ（nethack.worker.js と等価）をシミュレート
        mockWorker.postMessage.mockImplementation((msg) => {
            if (msg.type === 'CALL_SHIM') {
                const { callId, payload } = msg;
                const { cmd, arg1, arg2, bufferSize, bufferType } = payload;

                let bufPtr = 0;
                if (bufferSize > 0) bufPtr = memory.allocateBuffer(bufferSize);

                const result = memory.bridgeCall(cmd, arg1, arg2, bufPtr, bufferSize);

                let bufferData = null;
                if (bufPtr > 0 && bufferSize > 0) {
                    const count = Math.floor(bufferSize / 4);
                    bufferData = Array.from(memory.readInt32Array(bufPtr, count));
                    memory.freeBuffer(bufPtr);
                }

                // 非同期返信
                Promise.resolve().then(() => {
                    mockWorker.onmessage({
                        data: {
                            type: 'SHIM_RESULT',
                            callId,
                            result,
                            buffer: bufferData
                        }
                    });
                });
            }
        });

        // メインスレッドから callShim を実行！
        const res = await bridge.callShim(0x10, 10, 20);

        expect(mockModule._shim_bridge_call).toHaveBeenCalledWith(0x10, 10, 20, 0, 0);
        // typ: 25 (ROOM), lit: 1, roomno: 2
        expect(res.result & 0xFF).toBe(25);
    });

    it('6. 汎用 callShim 経由で装備スロットポインタ (GET_EQUIPMENT_PTRS, 56バイト) が透過中継されること', async () => {
        const cmd = 0x41; // SHIM_CMD_GET_EQUIPMENT_PTRS
        const bufferSize = 56;

        const promise = bridge.callShim(cmd, 0, 0, bufferSize, 'int32');

        expect(mockWorker.postMessage).toHaveBeenCalledTimes(1);
        const sentMsg = mockWorker.postMessage.mock.calls[0][0];
        expect(sentMsg.type).toBe('CALL_SHIM');
        expect(sentMsg.payload.cmd).toBe(0x41);
        expect(sentMsg.payload.bufferSize).toBe(56);

        const dummyEquipment = [0x1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        mockWorker.onmessage({
            data: {
                type: 'SHIM_RESULT',
                callId: sentMsg.callId,
                result: 0,
                buffer: dummyEquipment
            }
        });

        const response = await promise;
        expect(response.result).toBe(0);
        expect(response.buffer).toEqual(dummyEquipment);
    });

    it('7. 汎用 callShim 経由で床アイテム (GET_OBJECT_AT / DUMP_OBJECT_INFO) が透過中継されること', async () => {
        // 1. GET_OBJECT_AT でオブジェクトポインタ取得
        const promise1 = bridge.callShim(0x20, 15, 8); // GET_OBJECT_AT
        const sentMsg1 = mockWorker.postMessage.mock.calls[0][0];
        expect(sentMsg1.payload.cmd).toBe(0x20);

        mockWorker.onmessage({
            data: {
                type: 'SHIM_RESULT',
                callId: sentMsg1.callId,
                result: 0x5000,
                buffer: null
            }
        });

        const res1 = await promise1;
        expect(res1.result).toBe(0x5000);

        // 2. DUMP_OBJECT_INFO でアイテム詳細バッファ取得
        const promise2 = bridge.callShim(0x42, 0x5000, 0, 32, 'int32');
        const sentMsg2 = mockWorker.postMessage.mock.calls[1][0];
        expect(sentMsg2.payload.cmd).toBe(0x42);
        expect(sentMsg2.payload.arg1).toBe(0x5000);

        const dummyDump = [24, 50, 1, 1, 2, 0, 5, 50]; // otyp:24, owt:50, quan:1, ...
        mockWorker.onmessage({
            data: {
                type: 'SHIM_RESULT',
                callId: sentMsg2.callId,
                result: 0,
                buffer: dummyDump
            }
        });

        const res2 = await promise2;
        expect(res2.result).toBe(0);
        expect(res2.buffer).toEqual(dummyDump);
    });
});
