import test from 'node:test';
import assert from 'node:assert/strict';
import '../InputResolver.js';
import '../NetHackMemory.js';
import '../NetHackFSManager.js';
import '../NetHackWasmDriver.js';

const NetHackWasmDriver = globalThis.NetHackWasmDriver;

test('NetHackWasmDriver - filterSysconfLogs option', () => {
    const driver = new NetHackWasmDriver({ filterSysconfLogs: true });
    let emitted = false;

    driver.on('raw_print', () => { emitted = true; });
    driver.eventHook('shim_raw_print', ['MAXPLAYERS are set in sysconf file.']);

    assert.equal(emitted, false, 'Sysconf log should be filtered out');
});

test('NetHackWasmDriver - deduplicateMessages option', () => {
    const driver = new NetHackWasmDriver({ deduplicateMessages: true, filterSysconfLogs: false });
    const messages = [];

    driver.on('raw_print', (payload) => { messages.push(payload.text); });

    driver.eventHook('shim_raw_print', ['Welcome to NetHack!']);
    driver.eventHook('shim_raw_print', ['Welcome to NetHack!']);

    assert.equal(messages.length, 1, 'Duplicate message should be suppressed');
    assert.equal(messages[0], 'Welcome to NetHack!');
});

test('NetHackWasmDriver - promptCategory tag in inputRequired', async () => {
    const driver = new NetHackWasmDriver();
    let capturedCategory = null;

    driver.on('inputRequired', (payload) => {
        capturedCategory = payload.promptCategory;
        payload.resolver.respond('y');
    });

    driver.eventHook('shim_yn_function', ['Save game?', 'yn', 'y']);
    assert.equal(capturedCategory, 'YN');
});

test('NetHackWasmDriver - autoRespondEmptyMenu', async () => {
    const driver = new NetHackWasmDriver({ autoRespondEmptyMenu: true });
    let inputFired = false;

    driver.on('inputRequired', () => { inputFired = true; });

    driver.eventHook('shim_start_menu', [1, 0]);
    driver.eventHook('shim_end_menu', [1, 'Empty Menu Header']);
    const res = await driver.eventHook('shim_select_menu', [1, 1, 0]);

    assert.equal(inputFired, false, 'inputRequired should not fire for empty menu when autoRespondEmptyMenu is enabled');
    assert.equal(res, 0, 'Empty menu should immediately return 0');
});

test('NetHackWasmDriver - shim_get_ext_cmd string command resolution', async () => {
    const driver = new NetHackWasmDriver();
    let capturedCategory = null;

    driver.on('inputRequired', (payload) => {
        capturedCategory = payload.promptCategory;
        payload.resolver.respond('pray');
    });

    const promise = driver.eventHook('shim_get_ext_cmd', []);
    const idx = await promise;

    assert.equal(capturedCategory, 'TEXT');
    const prayIdx = NetHackWasmDriver.DEFAULT_EXTCMDS.indexOf('pray');
    assert.equal(idx, prayIdx, 'pray string command should map to correct index');
});
