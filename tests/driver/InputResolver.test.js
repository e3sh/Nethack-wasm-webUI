import { describe, it, expect } from 'vitest';
import '../../src/driver/InputResolver.js';

const InputResolver = globalThis.InputResolver;

describe('InputResolver', () => {
    it('SafeResolver (Double respond guard)', async () => {
        const resolver = new InputResolver();
        const { promise, safeResolver } = resolver.createPending('yn_function', { query: 'Quit?' });

        let callCount = 0;
        promise.then(() => {
            callCount++;
        });

        const res1 = safeResolver.respond('y');
        expect(res1).toBe(true);
        expect(safeResolver.isResolved()).toBe(true);

        // 二重呼び出しガード
        const res2 = safeResolver.respond('n');
        expect(res2).toBe(false);

        await promise;
        expect(callCount).toBe(1);
    });

    it('unwrapPayload (Proxy / Object plain copy)', () => {
        const mockProxy = {
            name: 'Hero',
            stats: { level: 5 }
        };

        const unwrapped = InputResolver.unwrapPayload(mockProxy);
        expect(unwrapped).toEqual({ name: 'Hero', stats: { level: 5 } });
        expect(unwrapped).not.toBe(mockProxy);
    });

    it('stale (Invalidate old resolver on new pending)', async () => {
        const resolver = new InputResolver();
        const { safeResolver: oldSafeResolver } = resolver.createPending('getch');
        expect(resolver.isWaiting()).toBe(true);

        const { promise: newPromise } = resolver.createPending('yn_function');
        expect(oldSafeResolver.isResolved()).toBe(true);
        expect(resolver.getContext().context).toBe('yn_function');

        resolver.respond('y');
        const ans = await newPromise;
        expect(ans).toBe('y');
    });
});
