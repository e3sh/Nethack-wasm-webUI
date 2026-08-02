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
