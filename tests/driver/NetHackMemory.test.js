import { describe, it, expect } from 'vitest';
import '../../src/driver/NetHackMemory.js';

const NetHackMemory = globalThis.NetHackMemory;

describe('NetHackMemory', () => {
    it('parseStatusUpdate DLEVEL (field 20)', () => {
        const memory = new NetHackMemory();
        const res = memory.parseStatusUpdate(20, 0, 0, 0);
        expect(res.fld).toBe(20);
        expect(res.dlevelData).not.toBeNull();
        expect(res.dlevelData.branch).toBe('Dlvl');
    });

    it('DLEVEL formatting logic check', () => {
        const parseDLevelStr = (rawVal) => {
            let dlevelStr = String(rawVal || "");
            let branch = "Dlvl";
            let dlevelNum = 1;

            if (dlevelStr.includes(':')) {
                const parts = dlevelStr.split(':');
                branch = parts[0].trim();
                dlevelNum = parseInt(parts[1], 10) || 1;
            } else {
                const match = dlevelStr.match(/([a-zA-Z]+)?\s*[:\-]?\s*(\d+)/);
                if (match) {
                    if (match[1]) branch = match[1];
                    if (match[2]) dlevelNum = parseInt(match[2], 10);
                } else if (!isNaN(parseInt(dlevelStr, 10))) {
                    dlevelNum = parseInt(dlevelStr, 10);
                }
            }

            return { raw: rawVal, dlevelStr, dlevelNum, branch };
        };

        const tut = parseDLevelStr("Tut:1");
        expect(tut.branch).toBe("Tut");
        expect(tut.dlevelNum).toBe(1);

        const mines = parseDLevelStr("Mines:3");
        expect(mines.branch).toBe("Mines");
        expect(mines.dlevelNum).toBe(3);

        const plain = parseDLevelStr("Dlvl:5");
        expect(plain.branch).toBe("Dlvl");
        expect(plain.dlevelNum).toBe(5);
    });

    it('buildMenuItemBuffer 16-byte struct alignment check', () => {
        const memBuffer = new ArrayBuffer(1024);
        const view = new DataView(memBuffer);
        let allocatedPtr = 128;

        const fakeModule = {
            _malloc: (size) => {
                const ptr = allocatedPtr;
                allocatedPtr += size;
                return ptr;
            },
            setValue: (ptr, val, type) => {
                const offset = ptr;
                if (type === 'i32') view.setInt32(offset, val, true); // little endian
                else if (type === 'i8') view.setInt8(offset, val);
            }
        };

        const memory = new NetHackMemory(fakeModule);
        const selected = [
            { identifier: 2001, count: 5 },
            { identifier: 3002, count: -1 }
        ];

        const ptr = memory.buildMenuItemBuffer(selected);
        expect(ptr).toBe(128);

        // item 0: offset 128
        // mi.item low 4 bytes (128): 2001
        expect(view.getInt32(128, true)).toBe(2001);
        // mi.item high 4 bytes (132): 0
        expect(view.getInt32(132, true)).toBe(0);
        // mi.count (136): 5
        expect(view.getInt32(136, true)).toBe(5);
        // mi.itemflags (140): 1
        expect(view.getInt32(140, true)).toBe(1);

        // item 1: offset 144 (128 + 16)
        // mi.item low 4 bytes (144): 3002
        expect(view.getInt32(144, true)).toBe(3002);
        // mi.item high 4 bytes (148): 0
        expect(view.getInt32(148, true)).toBe(0);
        // mi.count (152): -1
        expect(view.getInt32(152, true)).toBe(-1);
        // mi.itemflags (156): 1
        expect(view.getInt32(156, true)).toBe(1);
    });

    it('setPointerValue with name svp.plname writes string directly to buffer instead of pointer', () => {
        let writtenStr = null;
        let writtenPtr = null;
        let writtenMax = null;
        let intWritten = false;

        const fakeModule = {
            stringToUTF8: (str, ptr, max) => {
                writtenStr = str;
                writtenPtr = ptr;
                writtenMax = max;
            },
            setValue: (ptr, val, type) => {
                intWritten = true;
            }
        };

        const memory = new NetHackMemory(fakeModule);
        memory.setPointerValue(0x2000, 's', 'HeroExplorer', 'svp.plname');

        expect(writtenStr).toBe('HeroExplorer');
        expect(writtenPtr).toBe(0x2000);
        expect(writtenMax).toBe(32);
        // int（ポインタアドレス数値）の書き込みが行われないこと
        expect(intWritten).toBe(false);
    });

    it('setPointerValue for standard callback return allocates and writes pointer', () => {
        let allocatedSize = null;
        let setValueArgs = null;

        const fakeModule = {
            _malloc: (size) => {
                allocatedSize = size;
                return 0x5000;
            },
            stringToUTF8: () => {},
            setValue: (ptr, val, type) => {
                setValueArgs = { ptr, val, type };
            }
        };

        const memory = new NetHackMemory(fakeModule);
        memory.setPointerValue(0x1000, 's', 'HistoryText', 'shim_getmsghistory');

        expect(allocatedSize).toBe('HistoryText'.length + 1);
        expect(setValueArgs).toEqual({
            ptr: 0x1000,
            val: 0x5000,
            type: 'i32'
        });
    });

    describe('bridgeCall & Direct Binding Gateway', () => {
        it('has SHIM_CMD and SHIM_SYM constants defined', () => {
            expect(NetHackMemory.SHIM_CMD.GET_CELL_INFO).toBe(0x10);
            expect(NetHackMemory.SHIM_CMD.GET_PLAYER_SUMMARY).toBe(0x30);
            expect(NetHackMemory.SHIM_CMD.GET_SYMBOL_PTR).toBe(0x70);
            expect(NetHackMemory.SHIM_SYM.U).toBe(1);
            expect(NetHackMemory.SHIM_SYM.INVENT).toBe(2);
        });

        it('bridgeCall dispatches correctly to Module._shim_bridge_call', () => {
            let capturedArgs = null;
            const fakeModule = {
                _shim_bridge_call: (cmd, a1, a2, buf, len) => {
                    capturedArgs = { cmd, a1, a2, buf, len };
                    return 42;
                }
            };

            const memory = new NetHackMemory(fakeModule);
            const res = memory.bridgeCall(NetHackMemory.SHIM_CMD.GET_CELL_INFO, 10, 20, 0, 0);

            expect(res).toBe(42);
            expect(capturedArgs).toEqual({
                cmd: 0x10,
                a1: 10,
                a2: 20,
                buf: 0,
                len: 0
            });
        });

        it('bridgeCall returns -1 when _shim_bridge_call is missing', () => {
            const memory = new NetHackMemory({});
            const res = memory.bridgeCall(0x10);
            expect(res).toBe(-1);
        });

        it('getSymbolPtr calls bridgeCall with 0x70 and symId', () => {
            let capturedCmd = null;
            let capturedArg1 = null;
            const fakeModule = {
                _shim_bridge_call: (cmd, a1, a2, buf, len) => {
                    capturedCmd = cmd;
                    capturedArg1 = a1;
                    return 0x12345678;
                }
            };

            const memory = new NetHackMemory(fakeModule);
            const ptr = memory.getSymbolPtr(NetHackMemory.SHIM_SYM.U);

            expect(capturedCmd).toBe(0x70);
            expect(capturedArg1).toBe(1);
            expect(ptr).toBe(0x12345678);
        });

        it('allocateBuffer and freeBuffer work with Module._malloc / _free', () => {
            let freedPtr = null;
            const fakeModule = {
                _malloc: (size) => 0x8000,
                _free: (ptr) => { freedPtr = ptr; }
            };

            const memory = new NetHackMemory(fakeModule);
            const buf = memory.allocateBuffer(64);
            expect(buf).toBe(0x8000);

            memory.freeBuffer(buf);
            expect(freedPtr).toBe(0x8000);
        });

        it('readInt32Array and readUint8Array correctly decode memory', () => {
            const mem = new Map();
            const fakeModule = {
                getValue: (ptr, type) => {
                    if (type === 'i32') return mem.get(ptr) || 0;
                    if (type === 'i8') return mem.get(ptr) || 0;
                    return 0;
                }
            };

            mem.set(0x1000, 100);
            mem.set(0x1004, 200);
            mem.set(0x1008, 300);

            mem.set(0x2000, 65);
            mem.set(0x2001, 66);
            mem.set(0x2002, 67);

            const memory = new NetHackMemory(fakeModule);

            const i32Arr = memory.readInt32Array(0x1000, 3);
            expect(i32Arr).toEqual([100, 200, 300]);

            const u8Arr = memory.readUint8Array(0x2000, 3);
            expect(Array.from(u8Arr)).toEqual([65, 66, 67]);
        });
    });
});

