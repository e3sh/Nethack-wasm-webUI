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
        expect(snapshot.situation).toBeDefined();
        expect(snapshot.situation.env).toBe('room');
        expect(snapshot).toHaveProperty('silentSyncStatus');
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

    it('QUERY_KNOWLEDGE メッセージを処理して defaultVerb を含むナレッジを postMessage 配信すること', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: false });
        let postedMsg = null;
        inspector.channel = { postMessage: (msg) => { postedMsg = msg; } };
        inspector.isBroadcasting = true;

        inspector._handleConsoleMessage({
            data: { type: 'QUERY_KNOWLEDGE', entityType: 'ITEM', identifier: 259 }
        });

        expect(postedMsg).toBeDefined();
        expect(postedMsg.type).toBe('KNOWLEDGE_QUERY_RESULT');
        expect(postedMsg.result).toBeDefined();
        expect(postedMsg.result.onum).toBe(259);
        expect(postedMsg.result.defaultVerb).toBe('apply');
        expect(postedMsg.result.verbKey).toBe('a');
    });

    it('translationLog および messageUntranslated イベントを購読し BroadcastChannel に配信すること', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: false });
        const postedMsgs = [];
        inspector.channel = { postMessage: (msg) => { postedMsgs.push(msg); } };
        inspector.isBroadcasting = true;
        inspector._bindCoreEvents();

        // 1. translationLog 発火
        const trData = { raw: 'You hit the Jackal.', translated: 'ジャッカルを攻撃した。', success: true, method: 'exact' };
        core.emit('translationLog', trData);

        expect(postedMsgs.some(m => m.type === 'TRANSLATION_LOG' && m.data.raw === 'You hit the Jackal.')).toBe(true);

        // 2. messageUntranslated 発火
        const untranslatedData = { raw: 'New monster screams.', translated: 'New monster screams.' };
        core.emit('messageUntranslated', untranslatedData);

        expect(postedMsgs.some(m => m.type === 'MESSAGE_UNTRANSLATED' && m.data.raw === 'New monster screams.')).toBe(true);
    });

    it('skillsStateUpdated, spellsStateUpdated, discoveriesStateUpdated, attributesStateUpdated イベントを購読しログ・スナップショットを配信すること', () => {
        const core = createMockCore();
        core.gkl = {
            skillStateManager: {
                getSkills: () => [{ name: 'dagger', rank: { key: 'basic', label: '入門' }, canEnhance: true }],
                getActiveSkills: () => [{ name: 'dagger', rank: { key: 'basic', label: '入門' }, canEnhance: true }]
            },
            spellStateManager: {
                getSpells: () => [{ letter: 'a', name: 'force bolt', level: 1, failRate: '0%' }]
            },
            discoveryStateManager: {
                discoveredOnums: new Set([259]),
                appearanceMap: new Map([['ruby potion', 'potion of healing']]),
                isSynced: true
            },
            attributeStateManager: {
                getAttributes: () => ({
                    effectiveResistances: { fire: true }
                })
            }
        };

        const inspector = new DebugInspector(core, { autoStart: false });
        const postedMsgs = [];
        inspector.channel = { postMessage: (msg) => { postedMsgs.push(msg); } };
        inspector.isBroadcasting = true;
        inspector._bindCoreEvents();

        // 1. skillsStateUpdated
        core.emit('skillsStateUpdated');
        expect(postedMsgs.some(m => m.type === 'INSPECTOR_LOG' && m.entry.category === 'EVENT:skillsStateUpdated' && m.entry.data.enhanceableCount === 1)).toBe(true);

        // 2. spellsStateUpdated
        core.emit('spellsStateUpdated');
        expect(postedMsgs.some(m => m.type === 'INSPECTOR_LOG' && m.entry.category === 'EVENT:spellsStateUpdated' && m.entry.data.spellCount === 1)).toBe(true);

        // 3. discoveriesStateUpdated
        core.emit('discoveriesStateUpdated');
        expect(postedMsgs.some(m => m.type === 'INSPECTOR_LOG' && m.entry.category === 'EVENT:discoveriesStateUpdated' && m.entry.data.discoveredCount === 1)).toBe(true);

        // 4. attributesStateUpdated
        core.emit('attributesStateUpdated');
        expect(postedMsgs.some(m => m.type === 'INSPECTOR_LOG' && m.entry.category === 'EVENT:attributesStateUpdated' && m.entry.data.resistances.fire === true)).toBe(true);

        // 5. broadcastState スナップショットの検証
        const snapshot = inspector.broadcastState();
        expect(snapshot.discoveries.discoveredCount).toBe(1);
        expect(snapshot.situation).toBeDefined();
    });

    it('連続するイベント発火時にスロットリング（間引き）が機能し、スナップショット送信が過剰に発生しないこと', () => {
        vi.useFakeTimers();
        try {
            const core = createMockCore();
            const inspector = new DebugInspector(core, { autoStart: false, stateThrottleDelay: 100 });
            const postedMsgs = [];
            inspector.channel = { postMessage: (msg) => { postedMsgs.push(msg); } };
            inspector.isBroadcasting = true;
            inspector._bindCoreEvents();

            // 短時間に連続してイベントを発火
            core.emit('statusUpdate', { field: 'hp', value: 10 });
            core.emit('statusUpdate', { field: 'gold', value: 120 });
            core.emit('inventoryStateUpdated');
            core.emit('stateChange', { state: 'WAITING_INPUT' });

            // 発火直後はログは送信されるが、スナップショットはスロットル待機中（まだ0件）
            const snapshotsBefore = postedMsgs.filter(m => m.type === 'INSPECTOR_STATE_SNAPSHOT');
            expect(snapshotsBefore).toHaveLength(0);

            // 100ms 経過
            vi.advanceTimersByTime(100);

            // 1回だけスナップショットが送信されていること
            const snapshotsAfter = postedMsgs.filter(m => m.type === 'INSPECTOR_STATE_SNAPSHOT');
            expect(snapshotsAfter).toHaveLength(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('ActionRecipe などの関数や循環参照が含まれる場合でも DataCloneError を防ぎ、structuredClone で正常に複製できること', () => {
        const core = createMockCore();
        // 関数 (ActionRecipe のハンドラ等) を含むアイテムと循環参照を設定
        const circularObj = { name: 'circular item' };
        circularObj.self = circularObj;

        core.situationCache.getSituation = () => ({
            inventory: {
                items: [
                    {
                        letter: 'a',
                        name: 'wand of striking',
                        defaultActionRecipe: {
                            id: 'RECIPE_ZAP_WAND',
                            handlers: [
                                {
                                    match: { signalId: 'SIGNAL_DIRECTION' },
                                    action: (ctx) => 'DIR_E' // ← 関数オブジェクト
                                }
                            ]
                        }
                    },
                    circularObj
                ]
            },
            actions: [
                {
                    id: 'ACTION_FIRE',
                    actionRecipe: {
                        handler: (ctx) => 'DIR_N' // ← 関数オブジェクト
                    }
                }
            ],
            someSet: new Set([1, 2, 3]),
            someMap: new Map([['key', 'val']])
        });

        const inspector = new DebugInspector(core, { autoStart: false });
        let postedSnapshot = null;
        inspector.channel = {
            postMessage: vi.fn((msg) => {
                if (msg.type === 'INSPECTOR_STATE_SNAPSHOT') {
                    // 実際の BroadcastChannel と同様に structuredClone を適用して検証
                    structuredClone(msg.snapshot);
                    postedSnapshot = msg.snapshot;
                }
            })
        };
        inspector.isBroadcasting = true;

        const snapshot = inspector.broadcastState();

        // 1. broadcastState が例外を投げずに完了すること
        expect(snapshot).toBeDefined();

        // 2. channel.postMessage に渡されたスナップショットが structuredClone できること
        expect(postedSnapshot).toBeDefined();
        expect(inspector.channel.postMessage).toHaveBeenCalledTimes(1);

        // 3. 関数が文字列 '[Function]' に変換されていること
        const zapHandlerAction = postedSnapshot.situation.inventory.items[0].defaultActionRecipe.handlers[0].action;
        expect(zapHandlerAction).toBe('[Function]');

        // 4. 循環参照が '[Circular]' に変換されていること
        expect(postedSnapshot.situation.inventory.items[1].self).toBe('[Circular]');

        // 5. Set, Map が安全に配列・オブジェクトに変換されていること
        expect(postedSnapshot.situation.someSet).toEqual([1, 2, 3]);
        expect(postedSnapshot.situation.someMap).toEqual({ key: 'val' });
    });

    it('broadcastLog に関数オブジェクトが含まれていても安全にクローン可能な形式で送信されること', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: false });
        let postedLog = null;
        inspector.channel = {
            postMessage: vi.fn((msg) => {
                if (msg.type === 'INSPECTOR_LOG') {
                    structuredClone(msg.entry);
                    postedLog = msg.entry;
                }
            })
        };
        inspector.isBroadcasting = true;

        inspector.broadcastLog('TEST_FN', {
            callback: () => true,
            label: 'safe'
        });

        expect(postedLog).toBeDefined();
        expect(postedLog.data.callback).toBe('[Function]');
        expect(postedLog.data.label).toBe('safe');
    });

    it('core が signal イベントを発火した際、category: SIGNAL のログが自動ブロードキャストされること', () => {
        const core = createMockCore();
        const inspector = new DebugInspector(core, { autoStart: true });
        let postedLog = null;
        inspector.channel = {
            postMessage: vi.fn((msg) => {
                if (msg.type === 'INSPECTOR_LOG') {
                    postedLog = msg.entry;
                }
            })
        };

        core.emit('signal', {
            signalId: 'SIGNAL_WISH',
            subCategory: 'WISH',
            inputType: 'LINE_TEXT',
            validKeys: null,
            defaultKey: null,
            params: {},
            rawPrompt: 'For what do you wish?'
        });

        expect(postedLog).toBeDefined();
        expect(postedLog.category).toBe('SIGNAL');
        expect(postedLog.data.signalId).toBe('SIGNAL_WISH');
        expect(postedLog.data.subCategory).toBe('WISH');
        expect(postedLog.data.inputType).toBe('LINE_TEXT');
        expect(postedLog.data.prompt).toBe('For what do you wish?');
    });
});
