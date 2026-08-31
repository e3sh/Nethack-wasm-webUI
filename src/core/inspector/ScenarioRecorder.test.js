/**
 * ScenarioRecorder.test.js
 * ScenarioRecorder の単体テスト
 */
import { describe, it, expect, vi } from 'vitest';
import { ScenarioRecorder } from './ScenarioRecorder.js';

function createMockCore() {
    const listeners = new Map();
    let recordedEvents = [];
    let isRecording = false;

    return {
        listeners,
        isRecording: () => isRecording,
        startRecording: vi.fn(() => {
            isRecording = true;
            recordedEvents = [];
        }),
        stopRecording: vi.fn(() => {
            isRecording = false;
            const res = [...recordedEvents];
            recordedEvents = [];
            return res;
        }),
        getStatus: vi.fn(() => ({
            hp: { current: 18, max: 18 },
            dlevel: { text: 'dungeon:1' },
            turns: 42
        })),
        gkl: {
            areaStateManager: { playerX: 10, playerY: 5 },
            inventoryStateManager: {
                items: [
                    { rawText: 'a - a blessed +1 dagger' },
                    { rawText: 'b - a blindfold' }
                ]
            },
            monsterTracker: {
                getCurrentTurn: vi.fn(() => 42)
            }
        },
        on: vi.fn((evt, fn) => {
            if (!listeners.has(evt)) listeners.set(evt, []);
            listeners.get(evt).push(fn);
        }),
        off: vi.fn((evt, fn) => {
            if (!listeners.has(evt)) return;
            listeners.set(evt, listeners.get(evt).filter(l => l !== fn));
        }),
        emit: vi.fn((evt, data) => {
            if (isRecording) {
                recordedEvents.push({ type: evt, data, timestamp: Date.now() });
            }
            if (listeners.has(evt)) {
                listeners.get(evt).forEach(fn => fn(data));
            }
        })
    };
}

describe('ScenarioRecorder - シナリオ記録ツール', () => {

    it('録画開始 (start) 時に initialState がキャプチャされ、core.startRecording が呼ばれること', () => {
        const core = createMockCore();
        const recorder = new ScenarioRecorder(core, { autoMount: false });

        expect(recorder.isRecording).toBe(false);

        recorder.start('浮遊する目玉遭遇テスト');

        expect(recorder.isRecording).toBe(true);
        expect(core.startRecording).toHaveBeenCalledTimes(1);

        // initialState の検証
        expect(recorder.initialState).toBeDefined();
        expect(recorder.initialState.status.hp).toBe(18);
        expect(recorder.initialState.status.x).toBe(10);
        expect(recorder.initialState.status.y).toBe(5);
        expect(recorder.initialState.silentBuffers.i).toEqual([
            'a - a blessed +1 dagger',
            'b - a blindfold'
        ]);
        expect(recorder.initialState.initialEvents).toHaveLength(1);
    });

    it('録画中にイベントが発火した際、リアルタイムプレビューログに蓄積されること', () => {
        const core = createMockCore();
        const recorder = new ScenarioRecorder(core, { autoMount: false });

        recorder.start('プレビュー検証');

        core.emit('print_glyph', { x: 11, y: 5, glyph: 300 });
        core.emit('messageText', { text: 'You see a floating eye.' });
        core.emit('inputRequired', { category: 'POSKEY' });

        expect(recorder.recentPreviewLogs.length).toBe(3);
        expect(recorder.recentPreviewLogs[0]).toContain('glyph');
        expect(recorder.recentPreviewLogs[1]).toContain('floating eye');
        expect(recorder.recentPreviewLogs[2]).toContain('POSKEY');
    });

    it('録画停止 (stop) 時にイベント列が回収され、exportData で完全な JSON が生成されること', () => {
        const core = createMockCore();
        const recorder = new ScenarioRecorder(core, { autoMount: false });

        recorder.start('完全エクスポート検証');

        core.emit('curs', { x: 10, y: 5 });
        core.emit('messageText', { text: 'You hear a monster.' });
        core.emit('inputRequired', { category: 'POSKEY' });

        const events = recorder.stop();

        expect(recorder.isRecording).toBe(false);
        expect(core.stopRecording).toHaveBeenCalledTimes(1);
        expect(events).toHaveLength(3);

        const data = recorder.exportData();
        expect(data.version).toBe('1.0');
        expect(data.meta.title).toBe('完全エクスポート検証');
        expect(data.meta.turn).toBe(42);
        expect(data.initialState).toBeDefined();
        expect(data.events).toHaveLength(3);
        expect(data.events[1].type).toBe('messageText');
    });
});
