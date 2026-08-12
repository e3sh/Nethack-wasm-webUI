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

    assert.equal(capturedCategory, 'EXTCMD');
    const prayIdx = NetHackWasmDriver.DEFAULT_EXTCMDS.indexOf('pray');
    assert.equal(idx, prayIdx, 'pray string command should map to correct index');
});

test('NetHackWasmDriver - lastSequenceBuffer functionality', async () => {
    const driver = new NetHackWasmDriver();
    driver.queueSequence(['i']);
    
    assert.equal(driver.isExecutingSequence, true);
    assert.deepEqual(driver.getLastSequenceBuffer(), []);

    driver.eventHook('shim_putstr', 1, 0, 'You have a dagger.');
    
    const buffer = driver.getLastSequenceBuffer();
    assert.equal(buffer.length, 1);
    assert.equal(buffer[0].type, 'putstr');
    assert.equal(buffer[0].text, 'You have a dagger.');

    // New queueSequence clears previous buffer
    driver.queueSequence(['v']);
    assert.deepEqual(driver.getLastSequenceBuffer(), []);
});

test('NetHackWasmDriver - lastSequenceBuffer menu capture after sequence token consumption', async () => {
    const driver = new NetHackWasmDriver({ autoRespondEmptyMenu: false });
    
    // 1. queueSequence(['i']) を開始
    driver.queueSequence(['i']);
    assert.equal(driver.isExecutingSequence, true);

    // 2. Cコアが getch で入力待ちになり 'i' が自走消費される
    const getchPromise = driver.eventHook('shim_nhgetch', []);
    const key = await getchPromise;
    assert.equal(key, 'i');
    
    // トークンは消費されたが、Cコアが出力を完了するまで isExecutingSequence は true のまま！
    assert.equal(driver.isExecutingSequence, true);

    // 3. Cコアがメニューを構築して出力
    driver.eventHook('shim_start_menu', 1, 1);
    driver.eventHook('shim_add_menu', 1, 0, 101, 'a'.charCodeAt(0), 0, 0, 0, 'a - a dagger', 0);
    driver.eventHook('shim_end_menu', 1, 'Inventory');

    // shim_select_menu を発火
    const selectPromise = driver.eventHook('shim_select_menu', 1, 1, 0);

    // 4. バッファを確認: select_menu とその中のアイテムが保存されているか！
    const buffer = driver.getLastSequenceBuffer();
    assert.equal(buffer.length, 1);
    assert.equal(buffer[0].type, 'select_menu');
    assert.equal(buffer[0].prompt, 'Inventory');
    assert.equal(buffer[0].items.length, 1);
    assert.equal(buffer[0].items[0].str, 'a - a dagger');

    // 5. メニューに応答し、次の通常入力待ち (poskey等) が発生したら isExecutingSequence が完了して false になる
    driver.sendInput(0);
    await selectPromise;

    driver.eventHook('shim_nh_poskey', 0, 0, 0);
    assert.equal(driver.isExecutingSequence, false);
});
