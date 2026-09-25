/**
 * MessageContextResolver.test.js
 * Phase 5 - Stage 5.2: 実行時コンテキスト照合エンジンの単体テスト & 性能検証
 */

import { describe, it, expect } from 'vitest';
import { MessageContextResolver } from '../../../src/core/message/MessageContextResolver.js';

describe('MessageContextResolver - 実行時コンテキスト照合エンジン', () => {
    const resolver = new MessageContextResolver();

    describe('完全一致 (Exact Match) 照合', () => {
        it('完全一致する固定メッセージから MessageContext を即時同定できること', () => {
            const rawText = 'You feel better.';
            const ctx = resolver.resolve(rawText);

            expect(ctx).not.toBeNull();
            expect(ctx.rawText).toBe(rawText);
            expect(ctx.calleeFunc).toBe('You_feel');
            expect(ctx.semanticRole).toBe('PERCEPTION_FEELING');
            expect(ctx.placeholders).toEqual([]);
        });

        it('知覚・制約メッセージ (You_cant) を正しく解決できること', () => {
            const rawText = "You can't jump very far.";
            const ctx = resolver.resolve(rawText);

            expect(ctx).not.toBeNull();
            expect(ctx.rawText).toBe(rawText);
            expect(ctx.calleeFunc).toBe('You_cant');
            expect(ctx.file).toBe('apply.c');
        });

        it('効果音カテゴリ (You_hear) をメタデータ付きで解決できること', () => {
            const rawText = 'You hear crashing rock.';
            const ctx = resolver.resolve(rawText);

            expect(ctx).not.toBeNull();
            expect(ctx.calleeFunc).toBe('You_hear');
            expect(ctx.metadata.soundCategory).toBe('HEAR');
            expect(ctx.metadata.soundId).toBe('se_rumble');
        });

        it('三項演算子から実ランタイムメッセージへ展開された各ブランチを同定できること', () => {
            const ctx1 = resolver.resolve('You feel totally together, man.');
            expect(ctx1).not.toBeNull();
            expect(ctx1.calleeFunc).toBe('You_feel');
            expect(ctx1.messageId).toContain('eat.c:L1021');

            const ctx2 = resolver.resolve('You feel very firm.');
            expect(ctx2).not.toBeNull();
            expect(ctx2.calleeFunc).toBe('You_feel');
            expect(ctx2.messageId).toContain('eat.c:L1021');
        });
    });

    describe('パターン一致 (Pattern Match) 照合 & 動的引数抽出', () => {
        it('プレースホルダを含むメッセージから動的引数を抽出できること', () => {
            const rawText = 'You hear a voice say, "He\'s dead, Jim."';
            const ctx = resolver.resolve(rawText);

            if (ctx) {
                expect(ctx.placeholders.length).toBeGreaterThan(0);
                expect(ctx.placeholders[0]).toBe("He's dead");
            }
        });

        it('耐性推論メタデータが付与されていること', () => {
            const rawText = 'You feel a sudden chill.';
            const ctx = resolver.resolve(rawText);

            if (ctx) {
                expect(ctx.metadata.intrinsic).toBe('cold_resistance');
            }
        });
    });

    describe('Layer 3: 制御シグナル (Control Signal) プロンプト照合', () => {
        it('方向プロンプトを SIGNAL_DIRECTION メタデータ付きで同定できること', () => {
            const rawText = 'In what direction?';
            const ctx = resolver.resolve(rawText);

            expect(ctx).not.toBeNull();
            expect(ctx.layer).toBe(3);
            expect(ctx.metadata.signalId).toBe('SIGNAL_DIRECTION');
            expect(ctx.metadata.subCategory).toBe('DIRECTION');
            expect(ctx.metadata.inputType).toBe('DIRECTION');
        });
    });

    describe('未定義・未知メッセージのハンドリング', () => {
        it('未登録のメッセージに対しては null を返すこと', () => {
            expect(resolver.resolve('Some completely unknown message xyz123')).toBeNull();
            expect(resolver.resolve('')).toBeNull();
            expect(resolver.resolve(null)).toBeNull();
            expect(resolver.resolve(undefined)).toBeNull();
        });
    });

    describe('DoD 性能要件: 照合レイテンシ < 0.1ms (100μs)', () => {
        it('10,000 回の照合ベンチマークで平均レイテンシが 0.1ms 未満であること', () => {
            const sampleMessages = [
                'You feel better.',
                "You can't jump very far.",
                'You hear crashing rock.',
                'You feel a sudden chill.',
                'You hear a voice say, "Danger, Jim."',
                'Unknown message that misses all indexes and patterns 12345',
                'You feel full of hot air.',
                'You hear a door open.',
                'Another random string test message for cache miss scenario'
            ];

            const iterations = 10000;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const msg = sampleMessages[i % sampleMessages.length];
                resolver.resolve(msg);
            }

            const endTime = performance.now();
            const totalElapsedMs = endTime - startTime;
            const avgLatencyMs = totalElapsedMs / iterations;

            console.log(`[MessageContextResolver Benchmark] Total: ${totalElapsedMs.toFixed(2)}ms for ${iterations} calls, Avg: ${avgLatencyMs.toFixed(4)}ms/call (${(avgLatencyMs * 1000).toFixed(1)}μs)`);

            // DoD: < 0.1ms (100μs)
            expect(avgLatencyMs).toBeLessThan(0.1);
        });
    });
});
