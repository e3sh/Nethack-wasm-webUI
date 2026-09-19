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
        expect(sig.restored).not.toBeNull();
        expect(sig.restored.pristineText).toBe('Elbereth');
    });

    it('墓石 (HEADSTONE) のメッセージを検知し、劣化しない墓碑銘として判定されること', () => {
        expect(detector.processMessage('Something is engraved here on the headstone.')).toBeNull();

        const sig = detector.processMessage('You read: "Rest in Peace".');
        expect(sig).not.toBeNull();
        expect(sig.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sig.engraveType).toBe('HEADSTONE');
        expect(sig.isHeadstone).toBe(true);
        expect(sig.actualText).toBe('Rest in Peace');
        expect(sig.isElbereth).toBe(false);
        expect(sig.isWardActive).toBe(false);
        expect(sig.warning).toBeNull();
    });

    it('かすれた床文字から考古学的復元結果 (restored) がペイロードに付与されること', () => {
        // engrave.txt の落書きのかすれ
        const sigEngrave = detector.processMessage('You read: "Th? c?ke ?s a l?e".');
        expect(sigEngrave).not.toBeNull();
        expect(sigEngrave.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sigEngrave.actualText).toBe('Th? c?ke ?s a l?e');
        expect(sigEngrave.pristineText).toBe('The cake is a lie');
        expect(sigEngrave.restored).not.toBeNull();
        expect(sigEngrave.restored.pristineText).toBe('The cake is a lie');
        expect(sigEngrave.restored.translation).toContain('ケーキは嘘だ');
        expect(sigEngrave.restored.source).toContain('Portal');
        expect(sigEngrave.restored.confidence).toBeGreaterThan(0.7);

        // 床に刻まれた噂話 (Rumor) のかすれ
        const sigRumor = detector.processMessage('You read: "A cry?tal pl?te ma?l wi?l not ru?t."');
        expect(sigRumor).not.toBeNull();
        expect(sigRumor.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sigRumor.restored).not.toBeNull();
        expect(sigRumor.restored.category).toBe('RUMOR');
        expect(sigRumor.restored.isTrue).toBe(true);
        expect(sigRumor.restored.pristineText).toBe('A crystal plate mail will not rust.');
        expect(sigRumor.restored.translation).toContain('錆びない');
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

    it('同一行にプレフィックスと読取結果が連結されたメッセージから刻み種別と復元を検知できること (英語)', () => {
        // 1. 床の落書き (floor)
        const msgFloor = 'There\'s some graffiti on the floor here.  You read: "Th? c?ke ?s a l?e".';
        const sig1 = detector.processMessage(msgFloor);
        expect(sig1).not.toBeNull();
        expect(sig1.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sig1.engraveType).toBe('MARK');
        expect(sig1.actualText).toBe('Th? c?ke ?s a l?e');
        expect(sig1.restored).not.toBeNull();
        expect(sig1.restored.pristineText).toBe('The cake is a lie');

        // 2. 地面の落書き (ground - 洞窟や非部屋)
        const msgGround = 'There\'s some graffiti on the ground here.  You read: "Th? c?ke ?s a l?e".';
        const sig2 = detector.processMessage(msgGround);
        expect(sig2).not.toBeNull();
        expect(sig2.engraveType).toBe('MARK');

        // 3. 埃の刻み文字 (dust 連結)
        const msgDust = 'Something is written here in the dust.  You read: "Elbereth".';
        const sig3 = detector.processMessage(msgDust);
        expect(sig3).not.toBeNull();
        expect(sig3.engraveType).toBe('DUST');
        expect(sig3.isElbereth).toBe(true);
        expect(sig3.isWardActive).toBe(true);

        // 4. 床の刻み文字 (engraved 連結)
        const msgEngrave = 'Something is engraved here on the floor.  You read: "Vlad was here".';
        const sig4 = detector.processMessage(msgEngrave);
        expect(sig4).not.toBeNull();
        expect(sig4.engraveType).toBe('ENGRAVE');

        // 5. 焼き付き文字 (burned 連結)
        const msgBurn = 'Some text has been burned into the floor here.  You read: "Vlad was here".';
        const sig5 = detector.processMessage(msgBurn);
        expect(sig5).not.toBeNull();
        expect(sig5.engraveType).toBe('BURN');

        // 6. 盲目時の触覚読取 (You feel the words 連結)
        const msgBlind = 'Something is engraved here on the floor.  You feel the words: "Elbereth".';
        const sig6 = detector.processMessage(msgBlind);
        expect(sig6).not.toBeNull();
        expect(sig6.engraveType).toBe('ENGRAVE');
        expect(sig6.isElbereth).toBe(true);
    });

    it('複数行に分割された英語メッセージから刻み種別と復元を検知できること (Read: や --More-- に対応)', () => {
        // 1. 標準的な複数行分割 (1行目 There's..., 2行目 You read: ...)
        expect(detector.processMessage('There\'s some graffiti on the floor here.')).toBeNull();
        const sig1 = detector.processMessage('You read: "Th? c?ke ?s a l?e".');
        expect(sig1).not.toBeNull();
        expect(sig1.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sig1.engraveType).toBe('MARK');
        expect(sig1.restored.pristineText).toBe('The cake is a lie');

        // 2. You なしの "Read: ..." パターン
        expect(detector.processMessage('There\'s some graffiti on the floor here.')).toBeNull();
        const sig2 = detector.processMessage('Read: "Vlad was here".');
        expect(sig2).not.toBeNull();
        expect(sig2.actualText).toBe('Vlad was here');
        expect(sig2.engraveType).toBe('MARK');

        // 4. 実機ログ生テキスト (\r 混入および先頭オフセットずれによる復元)
        expect(detector.processMessage('There\'s some graffiti on the floor here.')).toBeNull();
        const rawUserMsg = 'You read: "hey ?ay tha? ga?ter sn? e me?t may nct ?aste good b?t it s still hcalt?y.\r".';
        const sig4 = detector.processMessage(rawUserMsg);
        expect(sig4).not.toBeNull();
        expect(sig4.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sig4.engraveType).toBe('MARK');
        expect(sig4.restored).not.toBeNull();
        expect(sig4.restored.pristineText).toBe("They say that garter snake meat may not taste good but it's still healthy.");
        expect(sig4.restored.translation).toContain('ガータースネーク');
        expect(sig4.restored.confidence).toBeGreaterThan(0.9);
        expect(sig4.restored.isTrue).toBe(true);
    });

    it('NetHackJPの日本語メッセージ (同一行連結および複数行) を完璧に検知できること', () => {
        // 日本語: 落書き踏み荒らし (同一行連結)
        const msgGraffiti = '床に落書きがある.  あなたは読んだ: "Th? c?ke ?s a l?e".';
        const sig1 = detector.processMessage(msgGraffiti);
        expect(sig1).not.toBeNull();
        expect(sig1.signalId).toBe('SIGNAL_LORE_ENGRAVE');
        expect(sig1.engraveType).toBe('MARK');
        expect(sig1.restored.pristineText).toBe('The cake is a lie');

        // 日本語: 埃文字 (複数行)
        expect(detector.processMessage('埃の上に何かが書かれている.')).toBeNull();
        const sig2 = detector.processMessage('あなたは読んだ: "Elbereth".');
        expect(sig2).not.toBeNull();
        expect(sig2.engraveType).toBe('DUST');
        expect(sig2.isElbereth).toBe(true);
        expect(sig2.isWardActive).toBe(true);

        // 日本語: 盲目時の触覚読取
        const msgBlind = '床に何かが刻まれている.  あなたは文字を触って感じた: "Elbereth".';
        const sig3 = detector.processMessage(msgBlind);
        expect(sig3).not.toBeNull();
        expect(sig3.engraveType).toBe('ENGRAVE');
        expect(sig3.isElbereth).toBe(true);

        // フォーチュンクッキー (英語 rawText 本文)
        expect(detector.processMessage('This cookie has a scrap of paper inside.')).toBeNull();
        expect(detector.processMessage('It reads:')).toBeNull();
        const sigEnRumor1 = detector.processMessage('Good day for overcoming obstacles.  Try a steeplechase.');
        expect(sigEnRumor1).not.toBeNull();
        expect(sigEnRumor1.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(sigEnRumor1.rumorId).toBe('rumor_fal_78');
        expect(sigEnRumor1.isTrue).toBe(false);

        // 単独行での噂話フォールバック検知 (英語 rawText)
        const sigEnRumor2 = detector.processMessage('They say that only big spenders carry gold.');
        expect(sigEnRumor2).not.toBeNull();
        expect(sigEnRumor2.signalId).toBe('SIGNAL_LORE_RUMOR');
        expect(sigEnRumor2.rumorId).toBe('rumor_fal_290');
        expect(sigEnRumor2.isTrue).toBe(false);
    });

    it('通常の戦闘・行動メッセージで誤爆 (False Positive) を起こさないこと', () => {
        const normalMessages = [
            'You hit the goblin!',
            'The dog whimpers.',
            'You eat a fortune cookie.',
            'In what direction?',
            'What do you want to drink? [a or ?*]',
            'You feel much better.',
            'There is a wooden door here.',
            '床の上に何かがある.',
            'ゴブリンを攻撃した!'
        ];

        for (const msg of normalMessages) {
            expect(detector.processMessage(msg)).toBeNull();
        }
    });
});

