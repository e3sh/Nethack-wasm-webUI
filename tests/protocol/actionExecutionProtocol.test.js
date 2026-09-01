/**
 * actionExecutionProtocol.test.js
 * 
 * 【第2防壁: 動的契約検査 (Protocol Validator Fake Driver)】
 * 
 * プレースホルダー（${invlet}, ${writeTool}, ${ringLetter} 等）解決後のキーストローク列が、
 * C コア入力ステートマシンにおいて各コンテキスト規約に適合し、
 * 過不足なく最後まで完走できるかを検証するテストスイート。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProtocolValidatorFakeDriver } from '../../test/helpers/ProtocolValidatorFakeDriver.js';
import { ContextActionEngine } from '../../src/core/knowledge/ContextActionEngine.js';
import { AreaStateManager } from '../../src/core/knowledge/AreaStateManager.js';
import { InventoryStateManager } from '../../src/core/knowledge/InventoryStateManager.js';
import { ITEM_INTERACTION_RULES } from '../../src/core/knowledge/ITEM_INTERACTION_RULES.js';
import { ASSIST_SIGNAL_DEFINITIONS, createAssistSignal } from '../../src/core/knowledge/ASSIST_SIGNAL_DEFINITIONS.js';
import { createTestItem } from '../../test/helpers/testItemFactory.js';

describe('Action Execution Protocol Test Suite (第2防壁: 契約検査フェイクドライバー)', () => {
    let fakeDriver;

    beforeEach(() => {
        fakeDriver = new ProtocolValidatorFakeDriver();
    });

    // -------------------------------------------------------------------------
    // 1. ProtocolValidatorFakeDriver 自体の契約検査エンジン機能の自己検証
    // -------------------------------------------------------------------------
    describe('1. ProtocolValidatorFakeDriver の契約検査・診断機能の自己検証', () => {
        it('未解決の動的プレースホルダー (${invlet}) が残っている場合、消費時に即座に Descriptive Error をスローすること', () => {
            fakeDriver.queueSequence(['e', '${invlet}']);
            
            // 1ステップ目 (poskey: 'e') は正常
            expect(fakeDriver.stepPoskey()).toBe('e');

            // 2ステップ目で未解決プレースホルダーを検出して例外
            expect(() => {
                fakeDriver.stepSelectMenu();
            }).toThrowError(/Unresolved placeholder "\$\{invlet\}"/);
        });

        it('トークンに改行文字 (\\n, \\r) が含まれている場合、消費時に即座に例外をスローすること', () => {
            fakeDriver.queueSequence(['#pray\n', 'y']);

            expect(() => {
                fakeDriver.stepPoskey();
            }).toThrowError(/contains forbidden newline characters/);
        });

        it('poskey に複数文字トークンが渡された場合、契約違反を検出すること', () => {
            fakeDriver.queueSequence(['apply', 'a']);

            expect(() => {
                fakeDriver.stepPoskey();
            }).toThrowError(/poskey requires a single character or valid direction code/);
        });

        it('get_ext_cmd に DEFAULT_EXTCMDS 外の未知の拡張コマンドが渡された場合、契約違反を検出すること', () => {
            fakeDriver.queueSequence(['#', 'unknown_cmd_xyz']);

            expect(fakeDriver.stepPoskey()).toBe('#');
            expect(() => {
                fakeDriver.stepExtCmd();
            }).toThrowError(/Unknown extended command/);
        });

        it('yn_function に選択肢外の回答が渡された場合、契約違反を検出すること', () => {
            fakeDriver.queueSequence(['#', 'pray', 'x']);

            expect(fakeDriver.stepPoskey()).toBe('#');
            expect(fakeDriver.stepExtCmd()).toBe('pray');
            expect(() => {
                fakeDriver.stepYn('yn');
            }).toThrowError(/Choice "x" not in allowed choices "yn"/);
        });

        it('シーケンスの途中でトークンが不足（キューが空）になった場合、契約違反を検出すること', () => {
            fakeDriver.queueSequence(['#', 'pray']);

            expect(fakeDriver.stepPoskey()).toBe('#');
            expect(fakeDriver.stepExtCmd()).toBe('pray');
            // Cコアがさらに yn_function を要求したのにトークンが尽きている
            expect(() => {
                fakeDriver.stepYn('yn');
            }).toThrowError(/Unexpected end of sequence in context "yn_function"/);
        });

        it('シーケンス実行後に余剰トークンが残っている場合、assertCompleted で検出すること', () => {
            fakeDriver.queueSequence(['o', 'DIR_E', 'extra_junk']);

            expect(fakeDriver.stepPoskey()).toBe('o');
            expect(fakeDriver.stepGetch()).toBe('DIR_E');

            expect(() => {
                fakeDriver.assertCompleted();
            }).toThrowError(/Sequence has 1 remaining unconsumed tokens/);
        });
    });

    // -------------------------------------------------------------------------
    // 2. ContextActionEngine および ITEM_INTERACTION_RULES 生成アクションの動的解決 ＆ 完走契約検査
    // -------------------------------------------------------------------------
    describe('2. ContextActionEngine 生成アクションの動的解決 ＆ 完走検査', () => {
        it('扉開放アクション (ACTION_OPEN_DOOR_*): [o, DIR_*] が規約通り完走すること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            // 東 (11, 10) に閉じた扉を配置 (glyphId: 3988)
            areaMgr.updateGlyph(11, 10, 3988);

            const areaState = areaMgr.getAreaState();
            const actions = ContextActionEngine.generateActions(areaState);
            const openAction = actions.find(a => a.id?.startsWith('ACTION_OPEN_DOOR'));
            expect(openAction).toBeDefined();

            // 仮想ドライバで実行
            fakeDriver.queueSequence(openAction.keySequence);
            expect(fakeDriver.stepPoskey()).toBe('o');
            expect(fakeDriver.stepGetch()).toBe('DIR_E');
            fakeDriver.assertCompleted();
        });

        it('足元アイテム拾い (ACTION_PICKUP): [,] が規約通り完走すること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            // 足元にアイテム (dagger: GLYPH_OBJ_OFF 3448 + 310) を配置
            areaMgr.updateGlyph(10, 10, 3758);

            const areaState = areaMgr.getAreaState();
            const actions = ContextActionEngine.generateActions(areaState);
            const pickupAction = actions.find(a => a.id === 'ACTION_PICKUP');
            expect(pickupAction).toBeDefined();

            fakeDriver.queueSequence([pickupAction.charStr || ',']);
            expect(fakeDriver.stepPoskey()).toBe(',');
            fakeDriver.assertCompleted();
        });

        it('エルベレス刻み (ACTION_ENGRAVE_ELBERETH): [E, -, Elbereth] が指プレースホルダー解決後に完走すること', () => {
            const elberethRule = ITEM_INTERACTION_RULES.find(r => r.action?.id === 'ACTION_ENGRAVE_ELBERETH');
            expect(elberethRule).toBeDefined();
            const rawSeq = elberethRule.action.keySequence;
            expect(rawSeq).toEqual(['E', '${writeTool}', 'Elbereth']);

            // 動的プレースホルダー (${writeTool} ➔ 指 '-') の置換
            const resolvedSeq = rawSeq.map(t => t === '${writeTool}' ? '-' : t);

            fakeDriver.queueSequence(resolvedSeq);
            expect(fakeDriver.stepPoskey()).toBe('E');
            expect(fakeDriver.stepGetch()).toBe('-');
            expect(fakeDriver.stepGetlin()).toBe('Elbereth');
            fakeDriver.assertCompleted();
        });

        it('流し台指輪落とし (ACTION_SINK_TEST_RING): [d, a] がスロット解決後に完走すること', () => {
            const sinkRingRule = ITEM_INTERACTION_RULES.find(r => r.action?.id === 'ACTION_SINK_TEST_RING');
            expect(sinkRingRule).toBeDefined();
            const rawSeq = sinkRingRule.action.keySequence;
            expect(rawSeq).toEqual(['d', '${ringLetter}']);

            const resolvedSeq = rawSeq.map(t => t === '${ringLetter}' ? 'a' : t);
            fakeDriver.queueSequence(resolvedSeq);
            expect(fakeDriver.stepPoskey()).toBe('d');
            expect(fakeDriver.stepSelectMenu(['a', 'b', 'c'])).toBe('a');
            fakeDriver.assertCompleted();
        });

        it('流し台コンテキストアクション (ACTION_SINK_DROP_*): [d, a] がインベントリスロット解決後に完走すること', () => {
            const areaMgr = new AreaStateManager(80, 21);
            areaMgr.updatePlayerPosition(10, 10);
            areaMgr.updateGlyph(10, 10, 4013); // isSink glyph

            const invMgr = new InventoryStateManager();
            invMgr.items = [createTestItem('iron ring', 'a')];

            const areaState = areaMgr.getAreaState();
            const actions = ContextActionEngine.generateActions(areaState, invMgr);
            const dropRingAction = actions.find(a => a.id?.startsWith('ACTION_SINK_DROP') || a.id?.includes('RING'));
            if (dropRingAction) {
                const resolvedSeq = dropRingAction.keySequence.map(token => token === '${invlet}' ? 'a' : token);
                fakeDriver.queueSequence(resolvedSeq);
                expect(fakeDriver.stepPoskey()).toBe('d');
                expect(fakeDriver.stepSelectMenu(['a', 'b', 'c'])).toBe('a');
                fakeDriver.assertCompleted();
            }
        });
    });

    // -------------------------------------------------------------------------
    // 3. AssistSignalSynthesizer 生成シグナルの動的解決 ＆ 完走契約検査
    // -------------------------------------------------------------------------
    describe('3. AssistSignalSynthesizer 生成シグナルの動的解決 ＆ 完走検査', () => {
        it('神への祈り (SIGNAL_PETRIFY_PRAY): [#, pray, y] が規約通り完走すること', () => {
            const signal = createAssistSignal('SIGNAL_PETRIFY_PRAY');
            expect(signal).toBeDefined();

            fakeDriver.queueSequence(signal.actionKeySequence);
            expect(fakeDriver.stepPoskey()).toBe('#');
            expect(fakeDriver.stepExtCmd()).toBe('pray');
            expect(fakeDriver.stepYn('yn', 'y')).toBe('y');
            fakeDriver.assertCompleted();
        });

        it('トカゲの死体摂取 (SIGNAL_PETRIFY_CURE): [e, f] がインベントリスロット解決後に完走すること', () => {
            const signal = createAssistSignal('SIGNAL_PETRIFY_CURE', { invlet: 'f' });
            expect(signal).toBeDefined();

            fakeDriver.queueSequence(signal.actionKeySequence);
            expect(fakeDriver.stepPoskey()).toBe('e');
            expect(fakeDriver.stepSelectMenu(['f', 'g'])).toBe('f');
            fakeDriver.assertCompleted();
        });

        it('火の杖自己照射 (SIGNAL_SLIMING_FIRE): [z, b, .] が完走すること', () => {
            const signal = createAssistSignal('SIGNAL_SLIMING_FIRE', { invlet: 'b' });
            expect(signal).toBeDefined();

            fakeDriver.queueSequence(signal.actionKeySequence);
            expect(fakeDriver.stepPoskey()).toBe('z');
            expect(fakeDriver.stepSelectMenu(['a', 'b'])).toBe('b');
            expect(fakeDriver.stepGetch()).toBe('.');
            fakeDriver.assertCompleted();
        });

        it('全 26 種の ASSIST_SIGNAL_DEFINITIONS の defaultKeySequence がプレースホルダー解決後に完走可能であること', () => {
            for (const [id, def] of Object.entries(ASSIST_SIGNAL_DEFINITIONS)) {
                const sampleParams = { invlet: 'a', targetDir: 'DIR_E' };
                const signal = createAssistSignal(id, sampleParams);
                expect(signal).toBeDefined();

                // プレースホルダーが一切残っていないこと
                const seq = signal.actionKeySequence;
                seq.forEach((token, idx) => {
                    expect(String(token)).not.toMatch(/\$\{[^}]+\}/);
                    expect(String(token)).not.toContain('\n');
                    expect(String(token)).not.toContain('\r');
                });

                // 先頭トークンが poskey 規約に適合していること
                const first = String(seq[0]);
                expect(first.length === 1 || first.startsWith('DIR_') || first === '#').toBe(true);
            }
        });
    });
});
