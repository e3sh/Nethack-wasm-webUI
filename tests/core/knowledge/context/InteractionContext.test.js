import { describe, it, expect, beforeEach } from 'vitest';
import { InteractionContext } from '../../../../src/core/knowledge/context/InteractionContext.js';

describe('InteractionContext', () => {
    let ctx;
    let mockGkl;

    beforeEach(() => {
        mockGkl = {
            inventoryStateManager: {
                items: [],
                getKeyOrLockPick: () => null,
                getPickAxe: () => null,
                getAxe: () => null
            },
            spellStateManager: {
                spells: []
            },
            statusAccessor: {
                getStatus: () => ({ hp: { current: 15, max: 15 } })
            }
        };
        ctx = new InteractionContext(mockGkl, { defaultTtl: 2 });
    });

    describe('初期化とリセット', () => {
        it('初期ステートが正しく設定されること', () => {
            const state = ctx.getState();
            expect(state.focus).toBeNull();
            expect(state.focusCandidates.atFeet).toBeNull();
            expect(state.focusCandidates.adjacent).toEqual([]);
            expect(state.combat.inCombat).toBe(false);
            expect(state.combat.dangerLevel).toBe('NORMAL');
            expect(state.immediate.active).toBe(false);
        });

        it('reset() でステートが初期状態に戻ること', () => {
            ctx.setFocus({ type: 'CONTAINER', name: 'chest', isLocked: true });
            ctx.combat.inCombat = true;
            ctx.reset();

            expect(ctx.getPrimaryFocus()).toBeNull();
            expect(ctx.combat.inCombat).toBe(false);
        });
    });

    describe('空間距離ベースの維持 (チェビシェフ距離 <= 1) と移動離脱消去', () => {
        it('足元 (0, 0) の対象は隣接マス (1, 1) へ移動してもチェビシェフ距離1のため維持され、隣接に再分類されること', () => {
            ctx.updatePlayerPosition(0, 0);
            ctx.setFocus({
                type: 'CONTAINER',
                name: 'large box',
                isLocked: true,
                pos: { x: 0, y: 0 }
            }, 'atFeet');

            expect(ctx.focusCandidates.atFeet).not.toBeNull();
            expect(ctx.focusCandidates.atFeet.name).toBe('large box');

            // プレイヤーが斜め隣 (1, 1) へ移動（チェビシェフ距離 = 1）
            ctx.updatePlayerPosition(1, 1);

            // チェビシェフ距離1以内なので消滅せず、adjacent に再分類される
            expect(ctx.focusCandidates.atFeet).toBeNull();
            expect(ctx.focusCandidates.adjacent.length).toBe(1);
            expect(ctx.focusCandidates.adjacent[0].name).toBe('large box');
            expect(ctx.getPrimaryFocus().name).toBe('large box');
        });

        it('2歩離脱 (チェビシェフ距離 > 1) すると空間コンテキストが安全に消去されること', () => {
            ctx.updatePlayerPosition(0, 0);
            ctx.setFocus({
                type: 'CONTAINER',
                name: 'chest',
                isLocked: true,
                pos: { x: 0, y: 0 }
            }, 'atFeet');

            // プレイヤーが (2, 0) へ移動（チェビシェフ距離 = 2）
            ctx.updatePlayerPosition(2, 0);

            expect(ctx.focusCandidates.atFeet).toBeNull();
            expect(ctx.focusCandidates.adjacent.length).toBe(0);
            expect(ctx.getPrimaryFocus()).toBeNull();
        });
    });

    describe('ターン進行と TTL 減衰', () => {
        it('ターン経過に伴い TTL が減算され、0 で自動消去されること', () => {
            ctx.setFocus({
                type: 'DOOR',
                name: 'iron door',
                isLocked: true,
                ttl: 2
            }, 'adjacent');

            expect(ctx.focusCandidates.adjacent.length).toBe(1);

            // 1ターン経過
            ctx.advanceTurn(1);
            expect(ctx.focusCandidates.adjacent.length).toBe(1);
            expect(ctx.focusCandidates.adjacent[0].ttl).toBe(1);

            // 2ターン経過 -> TTL=0 で消去
            ctx.advanceTurn(2);
            expect(ctx.focusCandidates.adjacent.length).toBe(0);
        });

        it('戦闘状態が4ターン以上経過で自動沈静化すること', () => {
            ctx.combat.inCombat = true;
            ctx.combat.lastAttackedTurn = 10;
            ctx.currentTurn = 10;

            ctx.advanceTurn(12);
            expect(ctx.combat.inCombat).toBe(true);

            ctx.advanceTurn(15);
            expect(ctx.combat.inCombat).toBe(false);
        });
    });

    describe('能力評価 (assessCapabilities)', () => {
        it('鍵や開錠具を正しく検知できること', () => {
            mockGkl.inventoryStateManager.getKeyOrLockPick = () => ({
                invlet: 'b',
                name: 'skeleton key'
            });

            const caps = ctx.assessCapabilities();
            expect(caps.hasKey).toBe(true);
            expect(caps.keyItem.invlet).toBe('b');
        });

        it('強制こじ開け道具 (ツルハシ等) を正しく検知できること', () => {
            mockGkl.inventoryStateManager.getPickAxe = () => ({
                invlet: 'p',
                name: 'pick-axe'
            });

            const caps = ctx.assessCapabilities();
            expect(caps.hasForceTool).toBe(true);
            expect(caps.forceToolItem.invlet).toBe('p');
        });
    });

    describe('第1層 状況シグナル (situationSignal) 受信処理', () => {
        it('施錠箱メッセージのシグナルを受信するとフォーカスが自動登録されること', () => {
            ctx.handleSituationSignal({
                type: 'MESSAGE',
                context: {
                    domain: 'CONTAINER',
                    subDomain: 'LOCKED',
                    tags: ['container', 'locked'],
                    params: { containerName: 'large box' }
                }
            });

            const focus = ctx.getPrimaryFocus();
            expect(focus).not.toBeNull();
            expect(focus.type).toBe('CONTAINER');
            expect(focus.name).toBe('large box');
            expect(focus.isLocked).toBe(true);
        });

        it('プロンプト要求シグナルを受信すると即時文脈が設定されること', () => {
            ctx.handleSituationSignal({
                type: 'INPUT_REQUIRED',
                promptCategory: 'DIRECTION',
                prompt: 'In what direction?'
            });

            expect(ctx.immediate.active).toBe(true);
            expect(ctx.immediate.type).toBe('DIRECTION');
            expect(ctx.immediate.prompt).toBe('In what direction?');
        });
    });
});
