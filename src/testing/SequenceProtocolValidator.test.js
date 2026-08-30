import { describe, it, expect } from 'vitest';
import { SequenceProtocolValidator } from './SequenceProtocolValidator.js';

describe('SequenceProtocolValidator - 単体テスト', () => {

    describe('1. 正常系シーケンスの検証', () => {
        it('単一文字キーシーケンスが PASS すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['k']);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('複数ステップの正常キーシーケンスが PASS すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['e', 'f']);
            expect(result.valid).toBe(true);
        });

        it('拡張コマンド (#pray y) が PASS すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['#', 'pray', 'y']);
            expect(result.valid).toBe(true);
        });

        it('抽象方向コード (DIR_N 等) を含むシーケンスが PASS すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['DIR_N']);
            expect(result.valid).toBe(true);
        });

        it('動的プレースホルダー (${writeTool}) を含むシーケンスが PASS すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['E', '${writeTool}', 'Elbereth']);
            expect(result.valid).toBe(true);
        });
    });

    describe('2. 異常系・規約違反の検知', () => {
        it('改行コード (\\n や \\r) が混入している場合に検知して FAIL すること', () => {
            const result1 = SequenceProtocolValidator.validateSequence(['#pray\n', 'y']);
            expect(result1.valid).toBe(false);
            expect(result1.errors.some(e => e.includes('newline'))).toBe(true);

            const result2 = SequenceProtocolValidator.validateSequence(['Elbereth\r\n']);
            expect(result2.valid).toBe(false);
            expect(result2.errors.some(e => e.includes('newline'))).toBe(true);
        });

        it('poskey に複数文字が指定されている場合に FAIL すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['apply']);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('single character'))).toBe(true);
        });

        it('不正な拡張コマンド名が指定された場合に FAIL すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['#', 'unknown_cmd_xyz']);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('not a valid NetHack extended command'))).toBe(true);
        });

        it('# の後にコマンド名が欠落している場合に FAIL すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['#']);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('missing the extended command token'))).toBe(true);
        });

        it('不正な方向コードが指定された場合に FAIL すること', () => {
            const result = SequenceProtocolValidator.validateSequence(['DIR_FORWARD']);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('invalid direction code'))).toBe(true);
        });

        it('空配列や非配列が渡された場合に FAIL すること', () => {
            expect(SequenceProtocolValidator.validateSequence([]).valid).toBe(false);
            expect(SequenceProtocolValidator.validateSequence(null).valid).toBe(false);
        });
    });
});
