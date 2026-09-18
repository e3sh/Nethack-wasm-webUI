import { describe, it, expect, beforeEach } from 'vitest';
import { LoreDetector } from '../../src/core/lore/LoreDetector.js';

describe('LoreDetector Mode-Driven Architecture', () => {
    let detector;

    beforeEach(() => {
        detector = new LoreDetector();
    });

    it('クッキー3行シーケンスで True 198 が正しく検知されること', () => {
        const res1 = detector.processMessage('This cookie has a scrap of paper inside.');
        expect(res1).toBeNull();
        expect(detector.currentMode).toBe('COOKIE_OPENED');

        const res2 = detector.processMessage('It reads:');
        expect(res2).toBeNull();
        expect(detector.currentMode).toBe('COOKIE_READING');

        const res3 = detector.processMessage("They say that a grid bug won't hit you when you cross it.");
        expect(res3).not.toBeNull();
        expect(res3.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(res3.rumorId).toBe('rumor_tru_198');
        expect(res3.isTrue).toBe(true);
        expect(res3.source).toBe('cookie');
        expect(detector.currentMode).toBe('IDLE');
    });

    it('日本語メッセージシーケンスでも正しく検知されること', () => {
        const res1 = detector.processMessage('中に紙切れが入っている。');
        expect(res1).toBeNull();
        expect(detector.currentMode).toBe('COOKIE_OPENED');

        const res2 = detector.processMessage('そこにはこう書いてある：');
        expect(res2).toBeNull();
        expect(detector.currentMode).toBe('COOKIE_READING');

        // A katana might slice a worm in two.
        const res3 = detector.processMessage('A katana might slice a worm in two.');
        expect(res3).not.toBeNull();
        expect(res3.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(res3.rumorId).toBe('rumor_tru_6');
        expect(res3.source).toBe('cookie');
    });

    it('grave を含む噂話 (rumor_tru_39) が墓石判定に誤爆せず検知されること', () => {
        detector.processMessage('This cookie has a scrap of paper inside.');
        detector.processMessage('It reads:');
        
        // Digging up a grave could be a bad idea...
        const res = detector.processMessage("Digging up a grave could be a bad idea...");
        expect(res).not.toBeNull();
        expect(res.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(res.rumorId).toBe('rumor_tru_39');
        expect(res.isTrue).toBe(true);
    });

    it('[cookie] プレフィックスを除去した偽りの噂 (rumor_fal_80) が検知されること', () => {
        detector.processMessage('This cookie has a scrap of paper inside.');
        detector.processMessage('It reads:');

        const res = detector.processMessage("Help!  I'm being held prisoner in a fortune cookie factory!");
        expect(res).not.toBeNull();
        expect(res.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(res.rumorId).toBe('rumor_fal_80');
        expect(res.isTrue).toBe(false);
        expect(res.source).toBe('cookie');
    });

    it('床文字シーケンスがクッキーと混同されずに SIGNAL_LORE_ENGRAVE として検知されること', () => {
        const res1 = detector.processMessage('Something is written here in the dust.');
        expect(res1).toBeNull();
        expect(detector.currentMode).toBe('ENGRAVE_WAITING_TEXT');

        const res2 = detector.processMessage('You read: "Elbereth".');
        expect(res2).not.toBeNull();
        expect(res2.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(res2.actualText).toBe('Elbereth');
        expect(res2.engraveType).toBe('DUST');
        expect(res2.isElbereth).toBe(true);
    });

    it('先行行のない直接の噂話でもフォールバックで検知されること', () => {
        const res = detector.processMessage("They say that a grid bug won't hit you when you cross it.");
        expect(res).not.toBeNull();
        expect(res.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(res.rumorId).toBe('rumor_tru_198');
        expect(res.source).toBe('cookie');
    });

    it('It reads: と本文が1行に結合して届いた場合でも救済検知されること', () => {
        detector.processMessage('This cookie has a scrap of paper inside.');
        const res = detector.processMessage("It reads: They say that a grid bug won't hit you when you cross it.");
        expect(res).not.toBeNull();
        expect(res.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(res.rumorId).toBe('rumor_tru_198');
        expect(res.source).toBe('cookie');
    });
});
