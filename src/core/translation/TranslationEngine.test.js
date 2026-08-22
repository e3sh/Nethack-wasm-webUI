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
});

