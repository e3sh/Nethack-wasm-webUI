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
    const seqPromise = driver.queueSequence(['i']);
    seqPromise.catch(() => {});
    
    assert.equal(driver.isExecutingSequence, true);
    assert.deepEqual(driver.getLastSequenceBuffer(), []);

    driver.eventHook('shim_putstr', 1, 0, 'You have a dagger.');
    
    const buffer = driver.getLastSequenceBuffer();
    assert.equal(buffer.length, 1);
    assert.equal(buffer[0].type, 'putstr');
    assert.equal(buffer[0].text, 'You have a dagger.');

    // Cancel sequence clears buffer and tasks
    driver.cancelSequence();
    assert.deepEqual(driver.getLastSequenceBuffer(), []);
    assert.equal(driver.isExecutingSequence, false);
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

test('NetHackWasmDriver - FIFO sequence task queue sequential execution and option isolation', async () => {
    const driver = new NetHackWasmDriver();
    const emittedPrompts = [];
    driver.on('putmsg', (payload) => { emittedPrompts.push(payload.text); });

    // 1. Task A (suppressPrompts: false) と Task B (suppressPrompts: true) を連続投入
    driver.queueSequence(['kick'], { suppressPrompts: false });
    driver.queueSequence(['i'], { suppressPrompts: true });

    // Task A がアクティブ
    assert.equal(driver.isExecutingSequence, true);
    assert.equal(driver.sequenceTaskQueue.length, 1); // Task B が予約待機中

    // 2. Cコアが shim_get_ext_cmd で 'kick' を消費 (suppressPrompts: false なので "#" の putmsg が emit される)
    const extPromise = driver.eventHook('shim_get_ext_cmd', []);
    const extIdx = await extPromise;
    const kickIdx = NetHackWasmDriver.DEFAULT_EXTCMDS.indexOf('kick');
    assert.equal(extIdx, kickIdx);
    assert.equal(emittedPrompts.length, 1);
    assert.equal(emittedPrompts[0], '#');

    // 3. Task A のトークンが消化された。次の Cコア呼び出し (shim_nhgetch) で Task B ('i') へ自動移行して消化
    const getchPromise = driver.eventHook('shim_nhgetch', ['Inventory prompt']);
    const getchKey = await getchPromise;
    assert.equal(getchKey, 'i');

    // Task B の suppressPrompts: true により、'Inventory prompt' の putmsg は emit されず、配列長は 1 のまま！
    assert.equal(emittedPrompts.length, 1, 'Task B should suppress prompts as specified in its own options');
});

test('NetHackWasmDriver - queueSequence Promise resolution and isSilentSync cancellation safeguards', async () => {
    const driver = new NetHackWasmDriver({ autoRespondEmptyMenu: false });

    // 1. queueSequence が Promise を返し、バッファで解約されるか
    const seqPromise = driver.queueSequence(['i'], { isSilentSync: true });

    driver.eventHook('shim_nhgetch', []);
    driver.eventHook('shim_start_menu', 1, 1);
    driver.eventHook('shim_add_menu', 1, 0, 101, 'a'.charCodeAt(0), 0, 0, 0, 'a - a dagger', 0);
    driver.eventHook('shim_end_menu', 1, 'Inventory');
    const selectPromise = driver.eventHook('shim_select_menu', 1, 1, 0);

    driver.sendInput(0);
    await selectPromise;
    driver.eventHook('shim_nh_poskey', 0, 0, 0);

    const buffer = await seqPromise;
    assert.equal(Array.isArray(buffer), true);
    assert.equal(buffer.length, 1);
    assert.equal(buffer[0].type, 'select_menu');

    // 2. 新しい isSilentSync が投入された際、未実行の旧 isSilentSync がキャンセルされるか
    const p1 = driver.queueSequence(['i'], { isSilentSync: true });
    let p1Rejected = false;
    p1.catch(err => { p1Rejected = true; });

    const p2 = driver.queueSequence(['i'], { isSilentSync: true });
    await Promise.resolve();

    assert.equal(p1Rejected, true, 'Previous unexecuted silent sync task should be cancelled when a new one arrives');
    driver.cancelSequence();
    p2.catch(() => {});
});

test('NetHackWasmDriver - queueSequence stepDelayMs and allowMapUpdates options', async () => {
    const driver = new NetHackWasmDriver();

    let mapDisplayEmitted = false;
    let putstrEmitted = false;

    driver.on('display_nhwindow', (data) => {
        if (data.windowId <= 3 && !data.blocking) {
            mapDisplayEmitted = true;
        }
    });
    driver.on('putstr', () => {
        putstrEmitted = true;
    });

    const startTime = Date.now();
    const seqPromise = driver.queueSequence(['j'], { isSilentSync: true, stepDelayMs: 30, allowMapUpdates: true });

    // 1. isSilentSync 時でも allowMapUpdates: true / stepDelayMs > 0 の場合、非ブロック display_nhwindow (windowId: 2) が emit されるか確認
    driver.eventHook('shim_display_nhwindow', 2, 0); // WIN_MAP non-blocking
    assert.equal(mapDisplayEmitted, true, 'Map display_nhwindow should be emitted when allowMapUpdates or stepDelayMs > 0 is set');

    // 2. putstr 等のメッセージ系イベントは依然として抑止されることの確認
    driver.eventHook('shim_putstr', 1, 0, 'Test message');
    assert.equal(putstrEmitted, false, 'Message putstr should still be suppressed during silent sync');

    // 3. stepDelayMs に応じて自動応答が遅延されることを確認
    const getchPromise = driver.eventHook('shim_nhgetch');
    const midTime = Date.now();
    assert.ok(midTime - startTime < 20, 'Should reach nhgetch before stepDelayMs completes');

    const key = await getchPromise;
    const endTime = Date.now();
    assert.equal(key, 'j');
    assert.ok(endTime - startTime >= 25, `Should delay response by ~30ms (elapsed: ${endTime - startTime}ms)`);

    driver.eventHook('shim_nh_poskey', 0, 0, 0);
    await seqPromise;
});


