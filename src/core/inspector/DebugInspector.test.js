import { describe, it, expect, vi } from 'vitest';
import { DebugInspector } from './DebugInspector.js';

describe('DebugInspector', () => {
    function createMockCore() {
        const listeners = {};
        return {
            state: 'RUNNING',
            currentPromptCategory: 'YN',
            currentPromptChoices: 'y/n',
            activeResolver: { respond: vi.fn() },
            getStatus: () => ({ hp: { current: 15, max: 20 }, gold: 100 }),
            getAreaState: () => ({ playerX: 10, playerY: 12 }),
            inventoryStateManager: {
                items: [
                    { letter: 'a', name: 'dagger', isWielded: true }
                ]
            },
            situationCache: {
                getSituation: () => ({ env: 'room' }),
                queryAction: () => [{ label: '鍵でドアを開ける', key: 'o' }]
            },
            on: (evt, fn) => { listeners[evt] = fn; },
            emit: (evt, data) => { if (listeners[evt]) listeners[evt](data); },
            respond: vi.fn(),
            sendAction: vi.fn()
        };
    }

    it('モジュールが正常に初期化されログを蓄積できること', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: false });

        const log = inspector.broadcastLog('TEST', 'Hello World');
        expect(log).toBeDefined();
        expect(log.category).toBe('TEST');
        expect(log.data).toBe('Hello World');
        expect(inspector.logs.length).toBe(1);
    });

    it('broadcastState で GKL 内部構造を含む状態スナップショットが生成されること', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: false });

        const snapshot = inspector.broadcastState();
        expect(snapshot.state).toBe('RUNNING');
        expect(snapshot.promptCategory).toBe('YN');
        expect(snapshot.hasActiveResolver).toBe(true);
        expect(snapshot.status.hp.current).toBe(15);
        expect(snapshot.inventoryItems).toHaveLength(1);
        expect(snapshot.inventoryItems[0].name).toBe('dagger');
        expect(snapshot.contextActions).toHaveLength(1);
        expect(snapshot.contextActions[0].label).toBe('鍵でドアを開ける');
    });

    it('ダイレクト割り込みメッセージ (INJECT_RESPONSE) を処理して core.respond を呼び出すこと', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: false });

        inspector._handleConsoleMessage({
            data: { type: 'INJECT_RESPONSE', value: 'y' }
        });

        expect(core.respond).toHaveBeenCalledWith('y');
    });

    it('ダイレクト割り込みメッセージ (INJECT_ACTION) を処理して core.sendAction を呼び出すこと', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: false });

        inspector._handleConsoleMessage({
            data: { type: 'INJECT_ACTION', actionName: 'WAIT' }
        });

        expect(core.sendAction).toHaveBeenCalledWith('WAIT');
    });
});
