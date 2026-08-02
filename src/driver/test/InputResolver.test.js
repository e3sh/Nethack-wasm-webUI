import test from 'node:test';
import assert from 'node:assert/strict';
import '../InputResolver.js';

const InputResolver = globalThis.InputResolver;

test('InputResolver - SafeResolver (Double respond guard)', async () => {
    const resolver = new InputResolver();
    const { promise, safeResolver } = resolver.createPending('yn_function', { query: 'Quit?' });

    let callCount = 0;
    promise.then(() => {
        callCount++;
    });

    const res1 = safeResolver.respond('y');
    assert.equal(res1, true);
    assert.equal(safeResolver.isResolved(), true);

    // 二重呼び出しガード
    const res2 = safeResolver.respond('n');
    assert.equal(res2, false);

    await promise;
    assert.equal(callCount, 1);
});

test('InputResolver - unwrapPayload (Proxy / Object plain copy)', () => {
    const mockProxy = {
        name: 'Hero',
        stats: { level: 5 }
    };

    const unwrapped = InputResolver.unwrapPayload(mockProxy);
    assert.deepEqual(unwrapped, { name: 'Hero', stats: { level: 5 } });
    assert.notEqual(unwrapped, mockProxy);
});

test('InputResolver - stale (Invalidate old resolver on new pending)', async () => {
    const resolver = new InputResolver();
    const { safeResolver: oldSafeResolver } = resolver.createPending('getch');
    assert.equal(resolver.isWaiting(), true);

    const { promise: newPromise } = resolver.createPending('yn_function');
    assert.equal(oldSafeResolver.isResolved(), true);
    assert.equal(resolver.getContext().context, 'yn_function');

    resolver.respond('y');
    const ans = await newPromise;
    assert.equal(ans, 'y');
});
