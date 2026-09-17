import { describe, it, expect } from 'vitest';
import { EncumbrancePresenter, ENCUMBRANCE_THEME } from "../presenters/EncumbrancePresenter.js";
import { EncumbranceLevel } from "../state/EncumbranceStateManager.js";

describe('EncumbrancePresenter (UI 表現・ViewModel ヘルパー)', () => {
    it('正常状態 (Normal) の ViewModel を正しく生成すること', () => {
        const presenter = new EncumbrancePresenter({ language: 'ja' });
        const state = {
            level: EncumbranceLevel.NORMAL,
            totalWeight: 200,
            capacity: 800,
            percentage: 25,
            ratio: 0.25,
            hasUninspectedContainer: false,
        };

        const vm = presenter.formatViewModel(state);
        expect(vm.level).toBe(EncumbranceLevel.NORMAL);
        expect(vm.statusText).toBe('余裕');
        expect(vm.color).toBe('#3fb950');
        expect(vm.percentage).toBe(25);
        expect(vm.clampedPercentage).toBe(25);
        expect(vm.hasUninspectedContainer).toBe(false);
    });

    it('英語ロケールで正しいラベルが生成されること', () => {
        const presenter = new EncumbrancePresenter({ language: 'en' });
        const state = {
            level: EncumbranceLevel.CAUTION,
            totalWeight: 600,
            capacity: 800,
            percentage: 75,
            hasUninspectedContainer: true,
        };

        const vm = presenter.formatViewModel(state);
        expect(vm.statusText).toBe('Burdened');
        expect(vm.color).toBe('#d29922');
        expect(vm.hasUninspectedContainer).toBe(true);
        expect(vm.tooltipText).toContain('Uninspected bag');
    });

    it('超過重 (Critical / 150%) の場合に clampedPercentage が 100 に制限されること', () => {
        const presenter = new EncumbrancePresenter();
        const state = {
            level: EncumbranceLevel.CRITICAL,
            totalWeight: 1200,
            capacity: 800,
            percentage: 150,
        };

        const vm = presenter.formatViewModel(state);
        expect(vm.level).toBe(EncumbranceLevel.CRITICAL);
        expect(vm.percentage).toBe(150);
        expect(vm.clampedPercentage).toBe(100);
        expect(vm.color).toBe('#f85149');
    });

    it('ミニゲージの HTML 文字列が生成されること', () => {
        const presenter = new EncumbrancePresenter({ language: 'ja' });
        const state = {
            level: EncumbranceLevel.NORMAL,
            totalWeight: 300,
            capacity: 800,
            percentage: 38,
            hasUninspectedContainer: true,
        };

        const html = presenter.renderMiniGaugeHtml(state);
        expect(html).toContain('encumbrance-gauge-widget');
        expect(html).toContain('width:38%');
        expect(html).toContain('encumbrance-uninspected-badge');
        expect(html).toContain('余裕');
        expect(html).toContain('title="推定積載率: 約38%');
        expect(html).not.toContain('300/800</span>');

        const compactHtml = presenter.renderMiniGaugeHtml(state, { compact: true });
        expect(compactHtml).toContain('encumbrance-gauge-compact');
        expect(compactHtml).toContain('余裕');
        expect(compactHtml).toContain('title="推定積載率: 約38%');
    });
});
