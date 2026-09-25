import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LoreDetector } from '../../src/core/knowledge/lore/LoreDetector.js';
import { LoreCodex } from '../../src/core/knowledge/lore/LoreCodex.js';


describe('LoreDetector & LoreCodex - Fortune Cookie 3 Times Scenario Verification', () => {
    it('fortuneCookie_eat_3times シナリオにおいて3回すべての噂話が漏れなく検知・登録されること', () => {
        const scenarioPath = path.resolve(__dirname, '../fixtures/scenarios/fotuneCookie_eat_3times_1789793130516.json');
        if (!fs.existsSync(scenarioPath)) {
            console.warn('Scenario file not found:', scenarioPath);
            return;
        }

        const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
        const detector = new LoreDetector();
        const codex = new LoreCodex({ autoLoad: false });

        const capturedSignals = [];

        for (const ev of scenario.events) {
            if (ev.type === 'putstr' || ev.type === 'raw_print' || ev.type === 'putmsg' || ev.type === 'messageText') {
                const text = ev.data?.text || '';
                const signal = detector.processMessage(text);
                if (signal && signal.matched && signal.signalId === 'SIGNAL_LORE_RUMOR') {
                    capturedSignals.push(signal);
                    codex.addRumor({
                        id: signal.rumorId,
                        text: signal.text,
                        translatedText: signal.translatedText,
                        isTrue: signal.isTrue,
                        source: signal.source
                    });
                }
            }
        }

        // 3回中3回すべて検知されていること
        expect(capturedSignals.length).toBe(3);

        // 1回目: wand of cancellation
        expect(capturedSignals[0].rumorId).toBe('rumor_tru_212');
        expect(capturedSignals[0].isTrue).toBe(true);

        // 2回目: giant gets strong (末尾に _\r のカーソルが付いていたもの)
        expect(capturedSignals[1].rumorId).toBe('rumor_tru_197');
        expect(capturedSignals[1].isTrue).toBe(true);

        // 3回目: hair of the dog
        expect(capturedSignals[2].rumorId).toBe('rumor_fal_310');
        expect(capturedSignals[2].isTrue).toBe(false);

        // Codex にも3件登録されていること
        const rumors = codex.getRumors();
        expect(rumors.length).toBe(3);
        const rumorIds = rumors.map(r => r.id);
        expect(rumorIds).toContain('rumor_tru_212');
        expect(rumorIds).toContain('rumor_tru_197');
        expect(rumorIds).toContain('rumor_fal_310');
    });
});
