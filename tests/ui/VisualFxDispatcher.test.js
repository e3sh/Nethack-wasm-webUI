import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisualFxDispatcher } from '../../examples/gkl-pure-js-client/modules/effects/VisualFxDispatcher.js';

describe('VisualFxDispatcher - DAMAGE_DEALT to DAMAGE_POPUP dispatching', () => {
    let clientMock;
    let dispatcher;
    let dispatchedFx;
    let shaken;

    beforeEach(() => {
        dispatchedFx = [];
        shaken = [];
        clientMock = {
            mainViewportRenderer: {
                addVisualFx: (fx) => dispatchedFx.push(fx),
                triggerScreenShake: (intensity, duration) => shaken.push({ intensity, duration })
            },
            webgpuRenderer: null
        };
        dispatcher = new VisualFxDispatcher(clientMock);
    });

    it('通常被弾時: DAMAGE_POPUP が followPlayer:false かつ淡い黄色(#fff59d) で発行されること', () => {
        dispatcher.handleFxTrigger({
            type: 'DAMAGE_DEALT',
            targetX: 14,
            targetY: 8,
            amount: 4,
            maxHp: 20,
            isKill: false
        });

        expect(dispatchedFx).toHaveLength(1);
        const fx = dispatchedFx[0];
        expect(fx.type).toBe('DAMAGE_POPUP');
        expect(fx.gx).toBe(14);
        expect(fx.gy).toBe(8);
        expect(fx.followPlayer).toBe(false);
        expect(fx.amount).toBe(4);
        expect(fx.text).toBe('-4');
        expect(fx.color).toBe('#fff59d');
        expect(fx.scale).toBe(1.0);
        expect(shaken).toHaveLength(0);
    });

    it('撃破時: DAMAGE_POPUP がオレンジ(#ff9100)、通常表記 (-3)、scale: 1.3 で発行されること', () => {
        dispatcher.handleFxTrigger({
            type: 'DAMAGE_DEALT',
            targetX: 14,
            targetY: 8,
            amount: 3,
            maxHp: 10,
            isKill: true,
            amountIsLowerBound: true
        });

        expect(dispatchedFx).toHaveLength(1);
        const fx = dispatchedFx[0];
        expect(fx.type).toBe('DAMAGE_POPUP');
        expect(fx.text).toBe('-3');
        expect(fx.color).toBe('#ff9100');
        expect(fx.scale).toBe(1.3);
        expect(fx.durationMs).toBe(700);
    });

    it('クリティカル大ダメージ (>= 50% HP) 時: 明るい黄色(#ffea00) と微小シェイクが発火すること', () => {
        dispatcher.handleFxTrigger({
            type: 'DAMAGE_DEALT',
            targetX: 14,
            targetY: 8,
            amount: 8,
            maxHp: 10,
            isKill: false
        });

        expect(dispatchedFx).toHaveLength(1);
        expect(dispatchedFx[0].color).toBe('#ffea00');
        expect(dispatchedFx[0].scale).toBe(1.3);
        expect(shaken).toHaveLength(1);
        expect(shaken[0]).toEqual({ intensity: 1, duration: 80 });
    });

    it('ペット被弾時: シアン(#4dd0e1) で警告カラーになること', () => {
        dispatcher.handleFxTrigger({
            type: 'DAMAGE_DEALT',
            targetX: 10,
            targetY: 5,
            amount: 2,
            maxHp: 15,
            isTame: true
        });

        expect(dispatchedFx).toHaveLength(1);
        expect(dispatchedFx[0].color).toBe('#4dd0e1');
    });

    it('自キャラ被弾時 (DAMAGE_TAKEN): 従来どおり DAMAGE_FLASH かつ followPlayer:true で発行されること', () => {
        dispatcher.handleFxTrigger({
            type: 'DAMAGE_TAKEN',
            targetX: 10,
            targetY: 5,
            amount: 5
        });

        expect(dispatchedFx).toHaveLength(1);
        const fx = dispatchedFx[0];
        expect(fx.type).toBe('DAMAGE_FLASH');
        expect(fx.followPlayer).toBe(true);
        expect(fx.color).toBe('#ff1744');
        expect(shaken).toHaveLength(1);
        expect(shaken[0]).toEqual({ intensity: 3, duration: 100 });
    });

    it('AREA_ENTERED 時: AREA_ENTERED が mainViewportRenderer および webgpuRenderer へディスパッチされること', () => {
        let webgpuFx = [];
        let webgpuWoken = false;
        clientMock.webgpuRenderer = {
            addVisualFx: (fx) => webgpuFx.push(fx),
            wakeUp: () => { webgpuWoken = true; }
        };

        dispatcher.handleFxTrigger({
            type: 'AREA_ENTERED',
            branchId: 'mines',
            floorKey: 'mines:2',
            dlevel: 2,
            title: 'The Gnomish Mines',
            titleJa: 'ノームの鉱山',
            theme: 'mines',
            bannerDurationMs: 4000
        });

        expect(dispatchedFx).toHaveLength(1);
        expect(dispatchedFx[0].type).toBe('AREA_ENTERED');
        expect(dispatchedFx[0].branchId).toBe('mines');
        expect(dispatchedFx[0].durationMs).toBe(4000);

        expect(webgpuFx).toHaveLength(1);
        expect(webgpuFx[0].type).toBe('AREA_ENTERED');
        expect(webgpuWoken).toBe(true);
    });
});
