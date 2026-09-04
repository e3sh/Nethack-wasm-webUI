import { describe, it, expect } from 'vitest';
import { TranslationEngine } from './TranslationEngine.js';

describe('TranslationEngine', () => {
    it('完全一致辞書引きによる翻訳ができること', () => {
        const engine = new TranslationEngine({
            lookupDict: { 'You hit the goblin.': 'あなたはゴブリンを攻撃した。' }
        });

        expect(engine.translate('You hit the goblin.')).toBe('あなたはゴブリンを攻撃した。');
    });

    it('品詞対応単語辞書引き lookupWord が動作すること', () => {
        const engine = new TranslationEngine({
            lookupDict: { 'dagger': { noun: 'ダガー', verb: '短剣で刺す' } }
        });

        expect(engine.lookupWord('dagger', 'noun')).toBe('ダガー');
        expect(engine.lookupWord('dagger', 'verb')).toBe('短剣で刺す');
    });

    it('containsJapanese で日本語文字列が含まれるか検出できること', () => {
        const engine = new TranslationEngine();
        expect(engine.containsJapanese('Hello World')).toBe(false);
        expect(engine.containsJapanese('こんにちは世界')).toBe(true);
    });

    it('無効化時 (enabled: false) は原文をそのまま返却すること', () => {
        const engine = new TranslationEngine({
            enabled: false,
            lookupDict: { 'test': 'テスト' }
        });

        expect(engine.translate('test')).toBe('test');
        expect(engine.lastMatchSuccess).toBe(false);
    });

    it('翻訳マッチ成否判定 (lastMatchSuccess) およびメタデータが正しく更新されること', () => {
        const engine = new TranslationEngine({
            lookupDict: { 'You hit the goblin.': 'あなたはゴブリンを攻撃した。' }
        });

        // 成功ケース
        const result1 = engine.translate('You hit the goblin.');
        expect(result1).toBe('あなたはゴブリンを攻撃した。');
        expect(engine.lastMatchSuccess).toBe(true);
        expect(engine.lastMatchMethod).toBe('exact');
        expect(engine.getLastMatchInfo()).toEqual({
            success: true,
            method: 'exact',
            raw: 'You hit the goblin.',
            translated: 'あなたはゴブリンを攻撃した。'
        });

        // 失敗ケース（未翻訳）
        const result2 = engine.translate('Unknown message from nethack.');
        expect(result2).toBe('Unknown message from nethack.');
        expect(engine.lastMatchSuccess).toBe(false);
        expect(engine.lastMatchMethod).toBe('none');
        expect(engine.getLastMatchInfo().success).toBe(false);
    });

    it('isNoiseMessage で数字や1文字のノイズを正確に除外判定できること', () => {
        const engine = new TranslationEngine();
        expect(engine.isNoiseMessage('12345')).toBe(true);
        expect(engine.isNoiseMessage('a')).toBe(true);
        expect(engine.isNoiseMessage('12:34')).toBe(true);
        expect(engine.isNoiseMessage('1/2')).toBe(true);
        expect(engine.isNoiseMessage('')).toBe(true);
        expect(engine.isNoiseMessage('You hit the goblin.')).toBe(false);
    });

    it('onTranslate フックが翻訳完了時に正しく呼び出され、再帰時も1回のみ通知されること', () => {
        const logs = [];
        const engine = new TranslationEngine({
            lookupDict: {
                'You hit the goblin.': 'あなたはゴブリンを攻撃した。',
                'dagger': { noun: 'ダガー' },
                'blessed': { adj: '祝福された' }
            },
            onTranslate: (log) => logs.push(log)
        });

        // 1. 翻訳成功時
        engine.translate('You hit the goblin.');
        expect(logs).toHaveLength(1);
        expect(logs[0].raw).toBe('You hit the goblin.');
        expect(logs[0].translated).toBe('あなたはゴブリンを攻撃した。');
        expect(logs[0].success).toBe(true);
        expect(logs[0].method).toBe('exact');

        // 2. 未翻訳時
        engine.translate('Some mysterious wand');
        expect(logs).toHaveLength(2);
        expect(logs[1].raw).toBe('Some mysterious wand');
        expect(logs[1].translated).toBe('Some mysterious wand');
        expect(logs[1].success).toBe(false);
        expect(logs[1].method).toBe('none');

        // 3. アイテム分解による再帰翻訳（内部で複数回 translate や lookupWord を呼ぶ場合）
        engine.translate('a blessed dagger');
        expect(logs).toHaveLength(3);
        expect(logs[2].raw).toBe('a blessed dagger');
        expect(logs[2].translated).toBe('祝福された ダガー');
        expect(logs[2].success).toBe(true);
        expect(logs[2].method).toBe('decompose');
    });

    it('すでに日本語が含まれる文字列は辞書探索をスキップし already_japanese として即時返却されること', () => {
        const logs = [];
        const engine = new TranslationEngine({
            lookupDict: { 'test': 'テスト' },
            onTranslate: (log) => logs.push(log)
        });

        const res1 = engine.translate('階段（上り）');
        expect(res1).toBe('階段（上り）');
        expect(engine.lastMatchSuccess).toBe(true);
        expect(engine.lastMatchMethod).toBe('already_japanese');
        // 日本語文字列は未翻訳ノイズ防止のため onTranslate を発火しない（logsは空）
        expect(logs).toHaveLength(0);

        const res2 = engine.translate('所持品一覧');
        expect(res2).toBe('所持品一覧');
        expect(engine.lastMatchSuccess).toBe(true);
        expect(engine.lastMatchMethod).toBe('already_japanese');
        expect(logs).toHaveLength(0);
    });

    describe('decomposeItemName (NetHack 5.0 完全準拠)', () => {
        const engine = new TranslationEngine({
            lookupDict: {
                'dagger': { noun: 'ダガー' },
                'knife': { noun: 'ナイフ' },
                'silver knife': { noun: '銀のナイフ' },
                'dart': { noun: 'ダーツ' },
                'long sword': { noun: '長剣' },
                'silver saber': { noun: '銀のサーベル' },
                'chest': { noun: 'チェスト' },
                'box': { noun: '箱' },
                'large box': { noun: '大型の箱' },
                'leather boots': { noun: '革のブーツ' },
                'potion of extra healing': { noun: '超回復の薬' },
                'elven dagger': { noun: 'エルフのダガー' },
                'aklys': { noun: 'アクリス' },
                'blessed': { adj: '祝福された' },
                'uncursed': { adj: '呪われていない' },
                'cursed': { adj: '呪われた' },
                'locked': { adj: '施錠された' },
                'unlocked': { adj: '開錠された' },
                'trapped': { adj: '罠の仕掛けられた' },
                'empty': { adj: '空の' },
                'greased': { adj: '油を塗られた' },
                'poisoned': { adj: '毒が塗られた' },
                'rusty': { adj: '錆びた' },
                'very rusty': { adj: 'ひどく錆びた' },
                'thoroughly rusty': { adj: '完全に錆びた' },
                'rustproof': { adj: '防錆の' },
                'fireproof': { adj: '耐火の' },
                'corrodeproof': { adj: '耐腐食の' },
                'fixed': { adj: '耐破壊の' },
                'tempered': { adj: '強化された' },
                'rotproof': { adj: '防腐の' },
                'cracked': { adj: 'ヒビの入った' },
                'very cracked': { adj: 'ひどくヒビの入った' },
                'diluted': { adj: '薄められた' },
                'partly used': { adj: '使用途中の' },
                'partly eaten': { adj: '食べかけの' },
                'apple': { noun: 'リンゴ' },
                'pair of': { adj: '一組の' },
                'your': { adj: 'あなたの' },
                'Your': 'あなたの',
                '(being worn)': '（装備中）',
                '(being donned)': '（装着中）',
                '(being doffed)': '（脱衣中）',
                '(weapon in right hand)': '（右手で所持）',
                '(tethered to right hand)': '（右手に紐付け）',
                '(wielded in right hand)': '（右手に装備）'
            },
            patternDict: [
                { pattern: /^\(unpaid,\s*(\d+)\s*zorkmids?\)$/, replace: '（未払い: $1 ゾークミッド）' },
                { pattern: /^\(for sale,\s*(\d+)\s*zorkmids?\)$/, replace: '（売り物: $1 ゾークミッド）' },
                { pattern: /^\((\d+)\s*aum\)$/, replace: '（重さ: $1 aum）' },
                { pattern: /^containing\s+(\d+)\s+items?$/, replace: '（$1個収納）' }
            ]
        });

        it('複合プレフィックス（BUC + 施錠/罠）が正確に分解できること', () => {
            expect(engine.translate('an empty cursed locked chest')).toBe('空の 呪われた 施錠された チェスト');
            expect(engine.translate('a blessed trapped chest')).toBe('祝福された 罠の仕掛けられた チェスト');
        });

        it('複合プレフィックス（油 + 毒 + 侵食 + 耐性 + 修正値）が正確に分解できること', () => {
            expect(engine.translate('a blessed greased poisoned +1 silver saber')).toBe('祝福された 油を塗られた 毒が塗られた +1 銀のサーベル');
            expect(engine.translate('a very rusty rustproof +0 long sword')).toBe('ひどく錆びた 防錆の +0 長剣');
            expect(engine.translate('a very cracked tempered +1 dagger')).toBe('ひどくヒビの入った 強化された +1 ダガー');
            expect(engine.translate('a fixed +2 silver knife')).toBe('耐破壊の +2 銀のナイフ');
        });

        it('数量（数値、some、Your）および食用状態の分解・日本語合成が正しく機能すること', () => {
            expect(engine.translate('5 uncursed poisoned +0 darts')).toBe('呪われていない 毒が塗られた +0 ダーツ (5個)');
            expect(engine.translate('some uncursed darts')).toBe('呪われていない ダーツ (複数)');
            expect(engine.translate('Your blessed long sword')).toBe('あなたの 祝福された 長剣');
            expect(engine.translate('a uncursed partly eaten apple')).toBe('呪われていない 食べかけの リンゴ');
        });

        it('括弧なし内容物（containing N items）が正しく分解・合成できること', () => {
            expect(engine.translate('a large box containing 3 items')).toBe('大型の箱（3個収納）');
        });

        it('内部修飾（diluted, called, named）が正しく分解・合成できること', () => {
            expect(engine.translate('a diluted potion of extra healing called panic')).toBe('薄められた 超回復の薬（呼称: panic）');
            expect(engine.translate('an elven dagger named Sting (wielded in right hand)')).toBe('エルフのダガー「Sting」（右手に装備）');
        });

        it('不規則複数形や単位（pair of）が正しく認識されること', () => {
            expect(engine.translate('a pair of +0 leather boots (being donned)')).toBe('一組の +0 革のブーツ（装着中）');
            expect(engine.translate('3 silver knives')).toBe('銀のナイフ (3個)');
        });

        it('NetHack 5.0 特有の接尾辞（脱着・紐付き・店舗売り・重量等）が正しく合成されること', () => {
            expect(engine.translate('an aklys (tethered to right hand)')).toBe('アクリス（右手に紐付け）');
            expect(engine.translate('a blessed silver saber (weapon in right hand)')).toBe('祝福された 銀のサーベル（右手で所持）');
            expect(engine.translate('a leather boots (being doffed)')).toBe('革のブーツ（脱衣中）');
            expect(engine.translate('a long sword (for sale, 50 zorkmids)')).toBe('長剣（売り物: 50 ゾークミッド）');
            expect(engine.translate('a chest (unpaid, 120 zorkmids)')).toBe('チェスト（未払い: 120 ゾークミッド）');
            expect(engine.translate('a dagger (25 aum)')).toBe('ダガー（重さ: 25 aum）');
        });
    });
});


