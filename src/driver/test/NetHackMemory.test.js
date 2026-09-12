import test from 'node:test';
import assert from 'node:assert/strict';
import '../NetHackMemory.js';

const NetHackMemory = globalThis.NetHackMemory;

test('NetHackMemory - parseStatusUpdate DLEVEL (field 20)', () => {
    const memory = new NetHackMemory();
    const res = memory.parseStatusUpdate(20, 0, 0, 0);
    assert.equal(res.fld, 20);
    assert.notEqual(res.dlevelData, null);
    assert.equal(res.dlevelData.branch, 'Dlvl');
});

test('NetHackMemory - DLEVEL formatting logic check', () => {
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
    assert.equal(tut.branch, "Tut");
    assert.equal(tut.dlevelNum, 1);

    const mines = parseDLevelStr("Mines:3");
    assert.equal(mines.branch, "Mines");
    assert.equal(mines.dlevelNum, 3);

    const plain = parseDLevelStr("Dlvl:5");
    assert.equal(plain.branch, "Dlvl");
    assert.equal(plain.dlevelNum, 5);
});

test('NetHackMemory - buildMenuItemBuffer 16-byte struct alignment check', () => {
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
    assert.equal(ptr, 128);

    // item 0: offset 128
    // mi.item low 4 bytes (128): 2001
    assert.equal(view.getInt32(128, true), 2001);
    // mi.item high 4 bytes (132): 0
    assert.equal(view.getInt32(132, true), 0);
    // mi.count (136): 5
    assert.equal(view.getInt32(136, true), 5);
    // mi.itemflags (140): 1
    assert.equal(view.getInt32(140, true), 1);

    // item 1: offset 144 (128 + 16)
    // mi.item low 4 bytes (144): 3002
    assert.equal(view.getInt32(144, true), 3002);
    // mi.item high 4 bytes (148): 0
    assert.equal(view.getInt32(148, true), 0);
    // mi.count (152): -1
    assert.equal(view.getInt32(152, true), -1);
    // mi.itemflags (156): 1
    assert.equal(view.getInt32(156, true), 1);
});
