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
    });
});
