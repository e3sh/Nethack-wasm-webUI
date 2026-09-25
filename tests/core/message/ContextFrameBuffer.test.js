/**
 * ContextFrameBuffer.test.js
 * Phase 5 - Stage 5.2: 履歴ウィンドウバッファの単体テスト
 */

import { describe, it, expect } from 'vitest';
import { ContextFrameBuffer } from '../../../src/core/message/ContextFrameBuffer.js';

describe('ContextFrameBuffer - 履歴ウィンドウバッファ', () => {
    it('正常に初期化され、デフォルトサイズが10であること', () => {
        const buffer = new ContextFrameBuffer();
        expect(buffer.maxSize).toBe(10);
        expect(buffer.size).toBe(0);
        expect(buffer.peek()).toBeNull();
    });

    it('メッセージフレームを追加でき、最新の要素が peek できること', () => {
        const buffer = new ContextFrameBuffer(5);
        const frame1 = buffer.push({ rawText: 'You feel hot.', context: { layer: 1 } });
        expect(buffer.size).toBe(1);
        expect(buffer.peek()).toEqual(frame1);
        expect(frame1.rawText).toBe('You feel hot.');
        expect(frame1.timestamp).toBeTypeOf('number');
    });

    it('maxSize を超えた場合、最も古い要素が自動で押し出されること (リングバッファ動作)', () => {
        const buffer = new ContextFrameBuffer(3);
        buffer.push({ rawText: 'Message 1' });
        buffer.push({ rawText: 'Message 2' });
        buffer.push({ rawText: 'Message 3' });
        expect(buffer.size).toBe(3);

        buffer.push({ rawText: 'Message 4' });
        expect(buffer.size).toBe(3);

        const snapshot = buffer.getSnapshot();
        expect(snapshot.map(s => s.rawText)).toEqual(['Message 2', 'Message 3', 'Message 4']);
    });

    it('getRecent で直近の履歴を新しい順に取得できること', () => {
        const buffer = new ContextFrameBuffer(5);
        buffer.push({ rawText: 'A' });
        buffer.push({ rawText: 'B' });
        buffer.push({ rawText: 'C' });

        const recent2 = buffer.getRecent(2);
        expect(recent2.map(r => r.rawText)).toEqual(['C', 'B']);

        const recentAll = buffer.getRecent();
        expect(recentAll.map(r => r.rawText)).toEqual(['C', 'B', 'A']);
    });

    it('clear で全履歴がリセットされること', () => {
        const buffer = new ContextFrameBuffer(5);
        buffer.push({ rawText: 'Hello' });
        expect(buffer.size).toBe(1);

        buffer.clear();
        expect(buffer.size).toBe(0);
        expect(buffer.getSnapshot()).toEqual([]);
        expect(buffer.peek()).toBeNull();
    });

    it('不正な入力 (空文字列や null) を適切にガードすること', () => {
        const buffer = new ContextFrameBuffer(5);
        expect(buffer.push(null)).toBeNull();
        expect(buffer.push({})).toBeNull();
        expect(buffer.size).toBe(0);
    });
});
