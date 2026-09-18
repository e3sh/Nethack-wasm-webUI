import { describe, it, expect, beforeEach } from 'vitest';
import { EngravingArchaeologist, RUBOUTS } from './EngravingArchaeologist.js';
import { LORE_MASTER } from './data/LoreMasterData.js';

describe('EngravingArchaeologist - GKL かすれ床文字の考古学的復元アシスト', () => {
    let archaeologist;

    beforeEach(() => {
        archaeologist = new EngravingArchaeologist({ master: LORE_MASTER });
    });

    describe('1. 完全一致の原型同定', () => {
        it('engrave.txt の銘文を完全一致で同定できること', () => {
            const res = archaeologist.restore('The cake is a lie');
            expect(res.matched).toBe(true);
            expect(res.confidence).toBe(1.0);
            expect(res.pristineText).toBe('The cake is a lie');
            expect(res.translation).toContain('ケーキは嘘だ');
            expect(res.category).toBe('ENGRAVING');
            expect(res.subCategory).toBe('GAME');
            expect(res.source).toContain('Portal');
        });

        it('回文落書きを同定できること', () => {
            const res = archaeologist.restore("Madam, in Eden, I'm Adam.");
            expect(res.matched).toBe(true);
            expect(res.confidence).toBe(1.0);
            expect(res.pristineText).toBe("Madam, in Eden, I'm Adam.");
            expect(res.translation).toContain('アダム');
            expect(res.category).toBe('ENGRAVING');
            expect(res.subCategory).toBe('PALINDROME');
        });

        it('Rumors (噂話) の落書きを完全一致で同定し、真偽フラグを保持すること', () => {
            const res = archaeologist.restore("A blindfold can be very useful if you're telepathic.");
            expect(res.matched).toBe(true);
            expect(res.confidence).toBe(1.0);
            expect(res.pristineText).toBe("A blindfold can be very useful if you're telepathic.");
            expect(res.category).toBe('RUMOR');
            expect(res.isTrue).toBe(true);
            expect(res.translation).toContain('目隠し');
        });
    });

    describe('2. 25% 欠損 (wipeout_text / ? 置換) からの復元', () => {
        it('約25%の文字が ? に置き換わった engrave.txt の落書きを復元できること', () => {
            // 原文: "The cake is a lie" (17文字中 4文字 '?' 置換: 約24%欠損)
            const degraded = "Th? c?ke ?s a l?e";
            const res = archaeologist.restore(degraded);

            expect(res.matched).toBe(true);
            expect(res.confidence).toBeGreaterThan(0.7);
            expect(res.pristineText).toBe('The cake is a lie');
            expect(res.translation).toContain('ケーキは嘘だ');
        });

        it('約25%の文字が ? に置き換わった噂話テキストを高精度に復元できること', () => {
            // 原文: "A crystal plate mail will not rust." (rumor_tru_4)
            const degraded = "A cry?tal pl?te ma?l wi?l not ru?t.";
            const res = archaeologist.restore(degraded);

            expect(res.matched).toBe(true);
            expect(res.confidence).toBeGreaterThan(0.7);
            expect(res.pristineText).toBe('A crystal plate mail will not rust.');
            expect(res.category).toBe('RUMOR');
            expect(res.isTrue).toBe(true);
            expect(res.translation).toContain('錆びない');
        });

        it('回文の ? 欠損を復元できること', () => {
            const degraded = "M?da?, in E?en, I'm Ada?.";
            const res = archaeologist.restore(degraded);

            expect(res.matched).toBe(true);
            expect(res.confidence).toBeGreaterThan(0.75);
            expect(res.pristineText).toBe("Madam, in Eden, I'm Adam.");
        });
    });

    describe('3. rubouts 置換 (文字劣化) パターンからの復元', () => {
        it('e -> c の rubouts 劣化を検知して復元できること', () => {
            // "The cake is a lie" の 'e' をすべて 'c' に劣化
            const degraded = "Thc cakc is a lic";
            const res = archaeologist.restore(degraded);

            expect(res.matched).toBe(true);
            expect(res.confidence).toBeGreaterThan(0.8);
            expect(res.pristineText).toBe('The cake is a lie');
        });

        it('複数の rubouts (A->^, e->c 等) が混ざった人狼の遠吠えを復元できること', () => {
            // 原文: "Arooo!  Werewolves of Yendor!"
            // 劣化: "^rooo!  Wcrcwolvcs of Ycndor!"
            const degraded = "^rooo!  Wcrcwolvcs of Ycndor!";
            const res = archaeologist.restore(degraded);

            expect(res.matched).toBe(true);
            expect(res.confidence).toBeGreaterThan(0.85);
            expect(res.pristineText).toBe('Arooo!  Werewolves of Yendor!');
            expect(res.translation).toContain('人狼');
        });

        it('rubouts と ? が複合した深刻な劣化床文字を復元できること', () => {
            // "Need a light?  Come visit the Minetown branch of Izchak's Lighting Store!"
            const degraded = "Nccd a |ight?  Comc visit thc Minc?own branch of Izchak's";
            const res = archaeologist.restore(degraded);

            expect(res.matched).toBe(true);
            expect(res.confidence).toBeGreaterThan(0.7);
            expect(res.pristineText).toBe("Need a light?  Come visit the Minetown branch of Izchak's Lighting Store!");
            expect(res.translation).toContain('照明店');
        });

        it('実機ログ: 多数の rubout/? と末尾ノイズ (.__ __?) を含む長文床文字を高精度に復元できること', () => {
            // 実機ログ: "I? vo?r ghost k?ll? ? playe?, i? in?rease? ycur ?c?re.__ __?"
            // 原文: "If your ghost kills a player, it increases your score." (rumor_fal_93)
            const realLog = "I? vo?r ghost k?ll? ? playe?, i? in?rease? ycur ?c?re.__ __?";
            const res = archaeologist.restore(realLog);

            expect(res.matched).toBe(true);
            expect(res.id).toBe('rumor_fal_93');
            expect(res.pristineText).toBe('If your ghost kills a player, it increases your score.');
            expect(res.confidence).toBeGreaterThan(0.9);
            expect(res.category).toBe('RUMOR');
            expect(res.isTrue).toBe(false);
            expect(res.translation).toContain('幽霊');
        });
    });

    describe('4. 踏み荒らし (末尾欠損・切り落とし) からの復元', () => {
        it('文末が削られて短くなった長文の落書きを復元できること', () => {
            // 原文: "If you can read these words then you are not only a nerd but probably dead."
            // 踏み荒らしにより後半が消失
            const scuffed = "If you can read these words then you are not only a nerd";
            const res = archaeologist.restore(scuffed);

            expect(res.matched).toBe(true);
            expect(res.confidence).toBeGreaterThan(0.85);
            expect(res.pristineText).toBe('If you can read these words then you are not only a nerd but probably dead.');
            expect(res.source).toContain('Whispers Under Ground');
        });
    });

    describe('5. Elbereth 結界解析器との協調', () => {
        it('完全な Elbereth は結界有効 (isWardActive: true) として復元されること', () => {
            const res = archaeologist.restore('Elbereth');
            expect(res.matched).toBe(true);
            expect(res.pristineText).toBe('Elbereth');
            expect(res.isElbereth).toBe(true);
            expect(res.isWardActive).toBe(true);
            expect(res.elberethIntegrity).toBe(1.0);
            expect(res.category).toBe('ELBERETH');
        });

        it('かすれた El?ereth は結界無効 (isWardActive: false) だが原型は Elbereth として同定されること', () => {
            const res = archaeologist.restore('El?ereth');
            expect(res.matched).toBe(true);
            expect(res.pristineText).toBe('Elbereth');
            expect(res.isElbereth).toBe(true);
            expect(res.isWardActive).toBe(false);
            expect(res.elberethIntegrity).toBeGreaterThan(0.7);
            expect(res.category).toBe('ELBERETH');
        });

        it('rubout劣化文字を含む El|crcth も Elbereth として同定されること', () => {
            const res = archaeologist.restore('El|crcth');
            expect(res.matched).toBe(true);
            expect(res.pristineText).toBe('Elbereth');
            expect(res.isElbereth).toBe(true);
        });
    });

    describe('6. 誤爆防止と異常系', () => {
        it('完全にランダムな意味のない文字列は matched: false となること', () => {
            const res = archaeologist.restore('qzxjvkblkjashdfkhj');
            expect(res.matched).toBe(false);
            expect(res.confidence).toBeLessThan(0.6);
            expect(res.pristineText).toBeNull();
        });

        it('有効英数字が2文字しかない風化末期文字 (?r  ? m) は無関係な長文に誤マッチせず matched: false となること', () => {
            // 実機ログで発生したスカスカ文字: 有効文字は 'r' と 'm' のみ
            const res = archaeologist.restore('?r  ? m');
            expect(res.matched).toBe(false);
            expect(res.pristineText).toBeNull();
        });

        it('アンカー候補がある場合、踏み荒らしで ?r  ? m まで劣化しても一貫して元の原型 (ad aerarium) を追跡できること', () => {
            // 1. 初回: '?d acra?ium' -> 'ad aerarium'
            const step1 = archaeologist.restore('?d acra?ium');
            expect(step1.matched).toBe(true);
            expect(step1.pristineText).toBe('ad aerarium');

            // 2. 踏まれて劣化: 'c ?cr??i?m' -> アンカー 'ad aerarium' で照合
            const step2 = archaeologist.restore('c ?cr??i?m', { anchorCandidate: step1 });
            expect(step2.matched).toBe(true);
            expect(step2.pristineText).toBe('ad aerarium');

            // 3. さらに劣化: '?  ?r? i?m' -> 他の文 (Madam, in Eden...) に化けず 'ad aerarium' として追跡
            const step3 = archaeologist.restore('?  ?r? i?m', { anchorCandidate: step1 });
            expect(step3.matched).toBe(true);
            expect(step3.pristineText).toBe('ad aerarium');

            // 4. 末期劣化: '?r  ? m' -> 他の長文 (Any small object...) に化けず 'ad aerarium' として追跡
            const step4 = archaeologist.restore('?r  ? m', { anchorCandidate: step1 });
            expect(step4.matched).toBe(true);
            expect(step4.pristineText).toBe('ad aerarium');
        });

        it('空文字や無効な入力に対して安全に matched: false を返却すること', () => {
            expect(archaeologist.restore('').matched).toBe(false);
            expect(archaeologist.restore('   ').matched).toBe(false);
            expect(archaeologist.restore(null).matched).toBe(false);
            expect(archaeologist.restore(undefined).matched).toBe(false);
        });
    });

    describe('7. パフォーマンス検証', () => {
        it('840件の全母数スキャンが 10ms 未満で完了すること', () => {
            const query = "W?at a cu?iou? f?eli?g!";
            // ウォームアップ
            archaeologist.restore(query);

            const start = performance.now();
            for (let i = 0; i < 10; i++) {
                archaeologist.restore(query);
            }
            const duration = (performance.now() - start) / 10;
            // 1回あたりの平均所要時間が 10ms 以下 (60fpsの1フレーム16.6ms未満)
            expect(duration).toBeLessThan(10);
        });
    });
});
