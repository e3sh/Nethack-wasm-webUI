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
});
