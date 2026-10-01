import { describe, it, expect, vi } from 'vitest';
import { RadialInputRecognizer, RADIAL_SECTORS, RADIAL_STATE } from '../RadialInputRecognizer.js';

describe('RadialInputRecognizer ユニットテストスイート', () => {
    describe('calculateSector (静的幾何計算)', () => {
        it('真上 (y = -1, x = 0) が N セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(0, -1);
            expect(result.sector).toBe(RADIAL_SECTORS.N);
            expect(result.angleDeg).toBeCloseTo(-90);
        });

        it('右上 (y = -1, x = 1) が NE セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(1, -1);
            expect(result.sector).toBe(RADIAL_SECTORS.NE);
            expect(result.angleDeg).toBeCloseTo(-45);
        });

        it('真右 (y = 0, x = 1) が E セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(1, 0);
            expect(result.sector).toBe(RADIAL_SECTORS.E);
            expect(result.angleDeg).toBeCloseTo(0);
        });

        it('右下 (y = 1, x = 1) が SE セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(1, 1);
            expect(result.sector).toBe(RADIAL_SECTORS.SE);
            expect(result.angleDeg).toBeCloseTo(45);
        });

        it('真下 (y = 1, x = 0) が S セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(0, 1);
            expect(result.sector).toBe(RADIAL_SECTORS.S);
            expect(result.angleDeg).toBeCloseTo(90);
        });

        it('左下 (y = 1, x = -1) が SW セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(-1, 1);
            expect(result.sector).toBe(RADIAL_SECTORS.SW);
            expect(result.angleDeg).toBeCloseTo(135);
        });

        it('真左 (y = 0, x = -1) が W セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(-1, 0);
            expect(result.sector).toBe(RADIAL_SECTORS.W);
            expect(Math.abs(result.angleDeg)).toBeCloseTo(180);
        });

        it('左上 (y = -1, x = -1) が NW セクターになること', () => {
            const result = RadialInputRecognizer.calculateSector(-1, -1);
            expect(result.sector).toBe(RADIAL_SECTORS.NW);
            expect(result.angleDeg).toBeCloseTo(-135);
        });
    });

    describe('ステートマシンとフリック判定', () => {
        it('デッドゾーン内では IDLE を維持し、イベントを発火しないこと', () => {
            const recognizer = new RadialInputRecognizer({ innerDeadZone: 0.25, outerThreshold: 0.6 });
            const engagedSpy = vi.fn();
            recognizer.on('engaged', engagedSpy);

            const result = recognizer.update(0.1, 0.1);
            expect(result.state).toBe(RADIAL_STATE.IDLE);
            expect(engagedSpy).not.toHaveBeenCalled();
        });

        it('スティックを倒すと ENGAGED に遷移し、セクターが確定すること', () => {
            const recognizer = new RadialInputRecognizer({ innerDeadZone: 0.25, outerThreshold: 0.6 });
            const engagedSpy = vi.fn();
            const sectorChangeSpy = vi.fn();
            recognizer.on('engaged', engagedSpy);
            recognizer.on('sectorChange', sectorChangeSpy);

            // 真上（N）に倒す
            const result = recognizer.update(0, -0.8);
            expect(result.state).toBe(RADIAL_STATE.ENGAGED);
            expect(result.currentSector).toBe(RADIAL_SECTORS.N);
            expect(engagedSpy).toHaveBeenCalledWith(expect.objectContaining({ sector: RADIAL_SECTORS.N }));
            expect(sectorChangeSpy).toHaveBeenCalledWith(expect.objectContaining({ sector: RADIAL_SECTORS.N }));
        });

        it('ENGAGED中に方向を変えた場合、sectorChange が発火すること', () => {
            const recognizer = new RadialInputRecognizer();
            const sectorChangeSpy = vi.fn();
            recognizer.on('sectorChange', sectorChangeSpy);

            recognizer.update(0, -0.8); // 真上 (N)
            expect(sectorChangeSpy).toHaveBeenCalledTimes(1);

            recognizer.update(0.8, 0); // 真右 (E)
            expect(sectorChangeSpy).toHaveBeenCalledTimes(2);
            expect(recognizer.currentSector).toBe(RADIAL_SECTORS.E);
        });

        it('スティックを倒した後に離す（ニュートラル戻り）と flick イベントが発火すること', () => {
            const recognizer = new RadialInputRecognizer({ flickMaxHoldMs: 1000 });
            const flickSpy = vi.fn();
            const disengagedSpy = vi.fn();
            recognizer.on('flick', flickSpy);
            recognizer.on('disengaged', disengagedSpy);

            const t0 = 1000;
            // 1. 右上 (NE) に倒す
            recognizer.update(0.8, -0.8, t0);
            expect(recognizer.state).toBe(RADIAL_STATE.ENGAGED);

            // 2. 100ms 後に手を離してニュートラルへ戻す
            const result = recognizer.update(0, 0, t0 + 100);

            expect(result.state).toBe(RADIAL_STATE.IDLE);
            expect(result.flickTriggered).toBeDefined();
            expect(result.flickTriggered.sector).toBe(RADIAL_SECTORS.NE);
            expect(flickSpy).toHaveBeenCalledWith({
                sector: RADIAL_SECTORS.NE,
                holdDuration: 100
            });
            expect(disengagedSpy).toHaveBeenCalled();
        });

        it('ホールド時間が flickMaxHoldMs を超過した場合はフリック判定されないこと（キャンセル動作）', () => {
            const recognizer = new RadialInputRecognizer({ flickMaxHoldMs: 500 });
            const flickSpy = vi.fn();
            recognizer.on('flick', flickSpy);

            const t0 = 1000;
            recognizer.update(0.8, 0, t0); // 真右 (E)

            // 600ms ホールドした後に戻す
            const result = recognizer.update(0, 0, t0 + 600);

            expect(result.flickTriggered).toBeNull();
            expect(flickSpy).not.toHaveBeenCalled();
            expect(recognizer.state).toBe(RADIAL_STATE.IDLE);
        });

        it('reset() で状態が初期化されること', () => {
            const recognizer = new RadialInputRecognizer();
            recognizer.update(0, -0.9);
            expect(recognizer.state).toBe(RADIAL_STATE.ENGAGED);

            recognizer.reset();
            expect(recognizer.state).toBe(RADIAL_STATE.IDLE);
            expect(recognizer.currentSector).toBeNull();
        });
    });
});
