import { describe, it, expect } from 'vitest';
import { KeyMapper } from './KeyMapper.js';

describe('KeyMapper', () => {
    it('KeyboardEvent から正確な修飾キーフラグとキー情報を抽出できること', () => {
        const mapper = new KeyMapper();
        const dummyEvent = {
            code: 'KeyD',
            key: 'd',
            shiftKey: false,
            ctrlKey: true,
            altKey: false
        };

        const keyInfo = mapper.mapKeyEvent(dummyEvent);
        expect(keyInfo).toBe('\x04');
    });
});
