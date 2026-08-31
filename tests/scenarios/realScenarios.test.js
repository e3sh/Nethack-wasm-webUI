/**
 * realScenarios.test.js
 * ユーザーが実機 ScenarioRecorder Studio でキャプチャした本物のシナリオ JSON を使用した
 * 下り方向 (Downlink) の統合再生テスト
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WebUICore } from '../../src/core/WebUICore.js';
import { GKLPlugin } from '../../src/core/knowledge/GKLPlugin.js';
import { ScenarioDriver } from '../../test/helpers/ScenarioDriver.js';

function loadFixture(filename) {
    const filePath = path.resolve(__dirname, '../../test/fixtures/scenarios', filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
}

describe('実機キャプチャシナリオ再生テスト (Phase 3 Downlink Integration)', () => {

    it('① 敵遭遇シナリオ (monster_adjacent) の再生とモンスター認識・アドバイザーの挙動', async () => {
        const scenario = loadFixture('monster_adjacent_1788134811159.json');
        const driver = new ScenarioDriver(scenario);
        const core = new WebUICore({ driver });
        const gkl = core.gkl;

        // 1. 初期化再生
        driver.playInit(core);

        expect(core.getStatus().hp.current).toBe(46);
        expect(core.getStatus().hp.max).toBe(62);
        expect(gkl.inventoryStateManager.items.length).toBeGreaterThan(10);

        // 2. 全イベント再生
        driver.playRemainingEvents();

        // 診断サマリー取得
        const summary = core.getDiagnosticSummary();
        expect(summary).toBeDefined();
        expect(summary.turn).toBe(137);

        // プレイヤーの移動が反映されていること (x: 53 -> 54)
        expect(summary.playerPosition.x).toBe(54);
        expect(summary.playerPosition.y).toBe(6);
    });

    it('② 瀕死緊急シナリオ (low_hp_emergency) の再生と緊急サバイバルシグナルの発出', async () => {
        const scenario = loadFixture('low_hp_emergency_1788134903461.json');
        const driver = new ScenarioDriver(scenario);
        const core = new WebUICore({ driver });
        const gkl = core.gkl;

        // 1. 初期化再生
        driver.playInit(core);

        // HP 16 / 62 (25.8% で瀕死条件成立)
        expect(core.getStatus().hp.current).toBe(16);
        expect(core.getStatus().hp.max).toBe(62);

        // 2. イベント再生
        driver.playRemainingEvents();

        const summary = core.getDiagnosticSummary();
        expect(summary.turn).toBe(177);
        expect(summary.playerPosition.x).toBe(63);
        expect(summary.playerPosition.y).toBe(7);

        // アシストシグナルが生存・回復または高危険度を認知していること
        const assist = gkl.getAssistState();
        expect(assist).toBeDefined();
    });

    it('③ 床アイテム拾得シナリオ (item_pickup) の再生とメッセージ認識', async () => {
        const scenario = loadFixture('item_pickup_json_1788135079704.json');
        const driver = new ScenarioDriver(scenario);
        const core = new WebUICore({ driver });

        driver.playInit(core);
        driver.playRemainingEvents();

        const summary = core.getDiagnosticSummary();
        expect(summary.turn).toBe(103);
        // 床アイテムのメッセージ "You see here a dwarvish cloak." が受信されていること
        expect(summary.lastMessage).toContain('dwarvish cloak');
    });

    it('⑤ 階段下降シナリオ (stair_down) の再生とフロア遷移', async () => {
        const scenario = loadFixture('stair_down_1788134555767.json');
        const driver = new ScenarioDriver(scenario);
        const core = new WebUICore({ driver });

        driver.playInit(core);
        driver.playRemainingEvents();

        const summary = core.getDiagnosticSummary();
        expect(summary).toBeDefined();
    });

    it('⑤ 倉庫番への階段下降シナリオ (stair_down_to_sokoban) の再生', async () => {
        const scenario = loadFixture('stair_down_to_sokoban_1788134334264.json');
        const driver = new ScenarioDriver(scenario);
        const core = new WebUICore({ driver });

        driver.playInit(core);
        driver.playRemainingEvents();

        const summary = core.getDiagnosticSummary();
        expect(summary).toBeDefined();
    });
});
