/**
 * ScenarioDriver.test.js
 * ScenarioDriver 疑似ドライバの単体・統合テスト
 */
import { describe, it, expect } from 'vitest';
import { ScenarioDriver } from '../../test/helpers/ScenarioDriver.js';
import { WebUICore } from '../../src/core/WebUICore.js';

describe('ScenarioDriver - シナリオ再生疑似ドライバ', () => {

    const sampleScenario = {
        version: '1.0',
        meta: {
            title: 'テストシナリオ: ゴブリン遭遇',
            turn: 10
        },
        initialState: {
            status: { hp: 16, maxHp: 16, dlevel: 'dungeon:1', x: 5, y: 5 },
            initialEvents: [
                { type: 'curs', data: { x: 5, y: 5 } }
            ],
            silentBuffers: {
                'i': [
                    'a - a blessed +1 dagger (weapon in hand)',
                    'b - 2 potions of extra healing'
                ]
            }
        },
        events: [
            { type: 'print_glyph', data: { x: 6, y: 5, glyph: 300, glyphInfo: { char: 'g', type: 'MONSTER' } } },
            { type: 'messageText', data: { text: 'You see here a goblin.' } },
            { type: 'inputRequired', data: { category: 'POSKEY' } },
            { type: 'messageText', data: { text: 'The goblin attacks!' } },
            { type: 'inputRequired', data: { category: 'POSKEY' } }
        ]
    };

    it('シナリオのロードと初期イベント再生 (playInit) が正常に動作すること', () => {
        const driver = new ScenarioDriver(sampleScenario);
        const receivedEvents = [];

        driver.on('curs', (data) => receivedEvents.push({ type: 'curs', data }));
        driver.on('status_update', (data) => receivedEvents.push({ type: 'status_update', data }));

        driver.playInit();

        expect(receivedEvents.length).toBeGreaterThan(0);
        expect(receivedEvents.some(e => e.type === 'curs')).toBe(true);
        expect(receivedEvents.some(e => e.type === 'status_update')).toBe(true);
    });

    it('ステップ実行 (stepNextTurn) が POSKEY ごとに一時停止すること', async () => {
        const driver = new ScenarioDriver(sampleScenario);
        const receivedMessages = [];

        driver.on('messageText', (data) => receivedMessages.push(data.text));

        // 【ステップ 1】 1 ターン目まで進める
        const hasMore1 = await driver.stepNextTurn();
        expect(hasMore1).toBe(true);
        expect(receivedMessages).toEqual(['You see here a goblin.']);
        expect(driver.getPromptCategory()).toBe('POSKEY');

        // 【ステップ 2】 2 ターン目まで進める
        const hasMore2 = await driver.stepNextTurn();
        expect(hasMore2).toBe(true);
        expect(receivedMessages).toEqual(['You see here a goblin.', 'The goblin attacks!']);

        // 【ステップ 3】 終端
        const hasMore3 = await driver.stepNextTurn();
        expect(hasMore3).toBe(false);
    });

    it('queueSequence が silentBuffers を即答すること', async () => {
        const driver = new ScenarioDriver(sampleScenario);
        const buffer = await driver.queueSequence(['i']);

        expect(buffer).toEqual([
            'a - a blessed +1 dagger (weapon in hand)',
            'b - 2 potions of extra healing'
        ]);
    });

    it('WebUICore と連携して getDiagnosticSummary が正常に取得できること', async () => {
        const driver = new ScenarioDriver(sampleScenario);
        const core = new WebUICore({ driver });

        // シナリオを最後まで再生
        await driver.playUntilTurn();

        // 診断サマリーを取得
        const summary = core.getDiagnosticSummary();
        expect(summary).toBeDefined();
        expect(summary.lastMessage).toBe('The goblin attacks!');
        expect(Array.isArray(summary.warnings)).toBe(true);
        expect(Array.isArray(summary.trackedMonsters)).toBe(true);
    });
});
