import { describe, it, expect, beforeEach } from 'vitest';
import { LoreDetector } from './LoreDetector.js';

describe('LoreDetector - メッセージストリーム LORE シグナル検知器', () => {
    let detector;

    beforeEach(() => {
        detector = new LoreDetector();
    });

    it('フォーチュンクッキー経由で真実の噂話を検知し、SIGNAL_LORE_RUMOR を発行すること', () => {
        expect(detector.processMessage('This cookie has a scrap of paper inside.')).toBeNull();
        expect(detector.processMessage('It reads:')).toBeNull();

        const sig = detector.processMessage("A blindfold can be very useful if you're telepathic.");
        expect(sig).not.toBeNull();
        expect(sig.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(sig.subCategory).toBe('RUMOR');
        expect(sig.isTrue).toBe(true);
        expect(sig.source).toBe('cookie');
        expect(sig.translatedText).toBe('テレパシー能力があるなら、目隠しはとても役に立つ。');
    });

    it('紙片経由で偽りの噂話を検知し、isTrue: false と判定されること', () => {
        expect(detector.processMessage('It reads:')).toBeNull();

        const sig = detector.processMessage('A glowing potion is too hot to drink.');
        expect(sig).not.toBeNull();
        expect(sig.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(sig.isTrue).toBe(false);
        expect(sig.source).toBe('paper');
    });

    it('神託所経由で小預言（Minor Oracle）の噂話を検知できること', () => {
        expect(detector.processMessage('True to her word, the Oracle offhandedly says: ')).toBeNull();

        const sig = detector.processMessage('A crystal plate mail will not rust.');
        expect(sig).not.toBeNull();
        expect(sig.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(sig.source).toBe('oracle');
        expect(sig.isTrue).toBe(true);
    });

    it('床の刻み文字メッセージから SIGNAL_LORE_ENGRAVE を検知し、結界有効性を判定できること', () => {
        expect(detector.processMessage('Something is written here in the dust.')).toBeNull();

        const sig = detector.processMessage('You read: "Elbereth".');
        expect(sig).not.toBeNull();
        expect(sig.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sig.engraveType).toBe('DUST');
        expect(sig.actualText).toBe('Elbereth');
        expect(sig.isElbereth).toBe(true);
        expect(sig.isWardActive).toBe(true);
        expect(sig.elberethIntegrity).toBe(1.0);
        expect(sig.status).toBe('ACTIVE');
    });

    it('風化した床文字 (Elber?th) を検知し、結界無効 (DEGRADED) と判定されること', () => {
        expect(detector.processMessage('Something is engraved here on the floor.')).toBeNull();

        const sig = detector.processMessage('You read: "Elber?th".');
        expect(sig).not.toBeNull();
        expect(sig.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sig.engraveType).toBe('ENGRAVE');
        expect(sig.actualText).toBe('Elber?th');
        expect(sig.isElbereth).toBe(true);
        expect(sig.isWardActive).toBe(false);
        expect(sig.status).toBe('DEGRADED');
        expect(sig.warning).toContain('結界無効');
    });

    it('神託所の大預言から SIGNAL_LORE_ORACLE を検知できること', () => {
        expect(detector.processMessage('The Oracle meditates for a moment and then intones:')).toBeNull();

        // oracles.txt の第1エントリ
        const oracleText = `If thy wand hath run out of charges, thou mayst zap it again and again; though
naught will happen at first, verily, thy persistence shall be rewarded, as
one last charge may yet be wrested from it!`;

        const sig = detector.processMessage(oracleText);
        expect(sig).not.toBeNull();
        expect(sig.signalId).toBe('SIGNAL_LORE_ORACLE');
        expect(sig.oracleId).toBe('oracle_1');
        expect(sig.translatedText).toBeTruthy();
    });

    it('通常の戦闘・行動メッセージで誤爆 (False Positive) を起こさないこと', () => {
        const normalMessages = [
            'You hit the goblin!',
            'The dog whimpers.',
            'You eat a fortune cookie.',
            'In what direction?',
            'What do you want to drink? [a or ?*]',
            'You feel much better.',
            'There is a wooden door here.'
        ];

        for (const msg of normalMessages) {
            expect(detector.processMessage(msg)).toBeNull();
        }
    });
});
