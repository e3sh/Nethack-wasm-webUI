/**
 * sequenceProtocol.test.js
 * 上り方向キーシーケンス・プロトコル検証テストスイート (第1防壁: 静的リンター)
 */
import { describe, it, expect } from 'vitest';
import { SequenceProtocolValidator } from '../../src/testing/SequenceProtocolValidator.js';
import { ITEM_INTERACTION_RULES } from '../../src/core/knowledge/ITEM_INTERACTION_RULES.js';
import { AssistSignalSynthesizer } from '../../src/core/knowledge/AssistSignalSynthesizer.js';

describe('Sequence Protocol Validation Suite (第1防壁: 静的プロトコルリンター)', () => {

    describe('1. ITEM_INTERACTION_RULES の全 keySequence 走査検証', () => {
        it('全アクションルールの keySequence がプロトコル規約に適合していること', () => {
            const violationReport = [];

            ITEM_INTERACTION_RULES.forEach(rule => {
                if (rule.action && Array.isArray(rule.action.keySequence)) {
                    const result = SequenceProtocolValidator.validateSequence(
                        rule.action.keySequence,
                        { ruleId: rule.id }
                    );
                    if (!result.valid) {
                        violationReport.push({
                            ruleId: rule.id,
                            sequence: rule.action.keySequence,
                            errors: result.errors
                        });
                    }
                }
            });

            expect(
                violationReport,
                `ITEM_INTERACTION_RULES にプロトコル規約違反が検出されました:\n${JSON.stringify(violationReport, null, 2)}`
            ).toEqual([]);
        });
    });

    describe('2. AssistSignalSynthesizer 生成シーケンスの規約適合検証', () => {
        it('神への祈り (#pray y) シーケンスが規約に適合していること', () => {
            const context = {
                status: { conditions: ['Stone'], hp: { current: 20, max: 20, percent: 1.0 } },
                inventory: []
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primaryAction).toBeDefined();

            const seq = state.primaryAction.keySequence;
            const result = SequenceProtocolValidator.validateSequence(seq);

            expect(result.valid, `Errors: ${result.errors.join(', ')}`).toBe(true);
            expect(seq).toEqual(['#', 'pray', 'y']);
        });

        it('緊急治癒 (e f) シーケンスが規約に適合していること', () => {
            const context = {
                status: { conditions: ['Stone'], hp: { current: 20, max: 20, percent: 1.0 } },
                inventory: [{ invlet: 'f', name: 'lizard corpse', category: 'FOOD' }]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primaryAction).toBeDefined();

            const seq = state.primaryAction.keySequence;
            const result = SequenceProtocolValidator.validateSequence(seq);

            expect(result.valid, `Errors: ${result.errors.join(', ')}`).toBe(true);
            expect(seq).toEqual(['e', 'f']);
        });

        it('杖による自己治療 (z b .) シーケンスが規約に適合していること', () => {
            const context = {
                status: { conditions: ['Slimed'], hp: { current: 30, max: 30, percent: 1.0 } },
                inventory: [{ invlet: 'b', name: 'wand of fire', category: 'WAND' }]
            };

            const state = AssistSignalSynthesizer.synthesize(context);
            expect(state.primaryAction).toBeDefined();

            const seq = state.primaryAction.keySequence;
            const result = SequenceProtocolValidator.validateSequence(seq);

            expect(result.valid, `Errors: ${result.errors.join(', ')}`).toBe(true);
            expect(seq).toEqual(['z', 'b', '.']);
        });
    });
});
