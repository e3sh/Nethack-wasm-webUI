import { describe, it, expect, vi } from 'vitest';
import { OnDemandLookService } from './OnDemandLookService.js';
import { StructuredKnowledgeEngine } from './StructuredKnowledgeEngine.js';

describe('OnDemandLookService', () => {
    const service = new OnDemandLookService();

    describe('buildLookSequence', () => {
        it('斜め右下 (2マス) への Look シーケンスを生成できること', () => {
            const playerPos = { x: 10, y: 5 };
            const targetPos = { x: 12, y: 7 };
            const tokens = service.buildLookSequence(playerPos, targetPos);

            expect(tokens).toEqual([';', 'DIR_SE', 'DIR_SE', '\u001b']);
        });

        it('上 3マス 左 1マス への Look シーケンスを正確に生成できること', () => {
            const playerPos = { x: 15, y: 10 };
            const targetPos = { x: 14, y: 7 };
            const tokens = service.buildLookSequence(playerPos, targetPos);

            // (15,10) -> (14,9)[DIR_NW] -> (14,8)[DIR_N] -> (14,7)[DIR_N]
            expect(tokens).toEqual([';', 'DIR_NW', 'DIR_N', 'DIR_N', '\u001b']);
        });

        it('隣接 (上 1マス) への Look シーケンスを生成できること', () => {
            const playerPos = { x: 10, y: 5 };
            const targetPos = { x: 10, y: 4 };
            const tokens = service.buildLookSequence(playerPos, targetPos);

            expect(tokens).toEqual([';', 'DIR_N', '\u001b']);
        });

        it('自キャラマスの場合は DIR_SELF を指定して ESC で終了すること', () => {
            const playerPos = { x: 10, y: 5 };
            const targetPos = { x: 10, y: 5 };
            const tokens = service.buildLookSequence(playerPos, targetPos);

            expect(tokens).toEqual([';', 'DIR_SELF', '\u001b']);
        });
    });

    describe('parseLookResponse', () => {
        it('peaceful モンスターを判定できること (括弧あり・なし・日本語)', () => {
            const res1 = service.parseLookResponse('a shopkeeper (peaceful)');
            expect(res1.isPeaceful).toBe(true);
            expect(res1.isTamed).toBe(false);
            expect(res1.isHostile).toBe(false);

            const res2 = service.parseLookResponse('a peaceful shopkeeper');
            expect(res2.isPeaceful).toBe(true);
            expect(res2.isHostile).toBe(false);

            const res3 = service.parseLookResponse('a peaceful watchman');
            expect(res3.isPeaceful).toBe(true);
            expect(res3.isHostile).toBe(false);

            const res4 = service.parseLookResponse('平和な店主');
            expect(res4.isPeaceful).toBe(true);
            expect(res4.isHostile).toBe(false);
        });

        it('tamed / friendly モンスターを判定できること', () => {
            const res1 = service.parseLookResponse('a domestic cat (friendly)');
            expect(res1.isTamed).toBe(true);

            const res2 = service.parseLookResponse('a kitten (tamed)');
            expect(res2.isTamed).toBe(true);

            const res3 = service.parseLookResponse('おとなしい子猫');
            expect(res3.isTamed).toBe(true);
        });

        it('標記なしの通常モンスターを hostile と判定できること', () => {
            const res = service.parseLookResponse('a red dragon');
            expect(res.isPeaceful).toBe(false);
            expect(res.isTamed).toBe(false);
            expect(res.isHostile).toBe(true);
            expect(res.hasResult).toBe(true);
        });

        it('空のレスポンスの場合は hasResult: false かつ isHostile: false となること', () => {
            const res = service.parseLookResponse('');
            expect(res.hasResult).toBe(false);
            expect(res.isHostile).toBe(false);
            expect(res.isPeaceful).toBe(false);
        });
    });

    describe('executeLook', () => {
        it('queueSequence を呼び出し解析結果を返すこと', async () => {
            const mockDriver = {
                queueSequence: vi.fn().mockResolvedValue(['a shopkeeper (peaceful)'])
            };
            const mockService = new OnDemandLookService({ driver: mockDriver });
            const result = await mockService.executeLook({ x: 10, y: 5 }, { x: 12, y: 7 });

            expect(mockDriver.queueSequence).toHaveBeenCalledWith([';', 'DIR_SE', 'DIR_SE', '\u001b'], { isSilentSync: true, suppressPrompts: true });
            expect(result.isPeaceful).toBe(true);
        });
    });
});

describe('StructuredKnowledgeEngine defaultPeaceful & Dynamic State Integration', () => {
    const engine = new StructuredKnowledgeEngine({ autoInit: true });

    it('店主 (shopkeeper) の未確定時の脅威度が SAFE (DEFAULT_PEACEFUL) と判定されること', () => {
        const mon = engine.getMonsterKnowledge(271, { translate: false });
        expect(mon.defaultPeaceful).toBe(true);
        expect(mon.dangerLevel).toBe('SAFE');
        expect(mon.dispositionStatus).toBe('DEFAULT_PEACEFUL');
    });

    it('店主が敵対化した (isHostile) 動的状態では LETHAL に上書きされること', () => {
        const mon = engine.getMonsterKnowledge(271, {
            translate: false,
            dynamicState: { isPeaceful: false, isHostile: true, hasResult: true }
        });
        expect(mon.dangerLevel).toBe('LETHAL');
        expect(mon.dispositionStatus).toBe('HOSTILE');
    });

    it('Look 応答の取得に失敗した場合 (hasResult: false) でも店主の DEFAULT_PEACEFUL が維持されること', () => {
        const mon = engine.getMonsterKnowledge(271, {
            translate: false,
            dynamicState: { isPeaceful: false, isHostile: false, hasResult: false }
        });
        expect(mon.dangerLevel).toBe('SAFE');
        expect(mon.dispositionStatus).toBe('DEFAULT_PEACEFUL');
    });

    it('自キャラ (isPlayer: true) は dangerLevel: NONE と評価されること', () => {
        const mon = engine.getMonsterKnowledge(271, {
            translate: false,
            isPlayer: true
        });
        expect(mon.dangerLevel).toBe('NONE');
        expect(mon.dispositionStatus).toBe('PLAYER');
    });
});
