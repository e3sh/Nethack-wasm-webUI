/**
 * EncumbrancePresenter.js
 *
 * インベントリ重量・負荷状態の UI 描画用プレゼンター・ViewModel 生成ヘルパー。
 *
 * 責務:
 * 1. EncumbranceState から UI 用 ViewModel（カラー、多言語ラベル、クランプ率、バッジ）を生成。
 * 2. 複数 UI（アイコンインベントリ、コンテナモーダル、ペーパードール）で再利用可能な
 *    軽量ミニゲージ・状態ランプの HTML 文字列生成。
 */

import { EncumbranceLevel } from './EncumbranceStateManager.js';

/**
 * 段階別テーマ定義 (カラー・背景・ラベル・アイコン)
 */
export const ENCUMBRANCE_THEME = {
    [EncumbranceLevel.NORMAL]: {
        color: '#3fb950',
        bgColor: 'rgba(63, 185, 80, 0.15)',
        borderColor: 'rgba(63, 185, 80, 0.4)',
        labelJa: '余裕',
        labelEn: 'Normal',
        icon: '🏃',
    },
    [EncumbranceLevel.CAUTION]: {
        color: '#d29922',
        bgColor: 'rgba(210, 153, 34, 0.15)',
        borderColor: 'rgba(210, 153, 34, 0.4)',
        labelJa: '負担',
        labelEn: 'Burdened',
        icon: '🚶',
    },
    [EncumbranceLevel.DANGER]: {
        color: '#db6d28',
        bgColor: 'rgba(219, 109, 40, 0.15)',
        borderColor: 'rgba(219, 109, 40, 0.4)',
        labelJa: '重荷',
        labelEn: 'Stressed',
        icon: '🏋️',
    },
    [EncumbranceLevel.CRITICAL]: {
        color: '#f85149',
        bgColor: 'rgba(248, 81, 73, 0.15)',
        borderColor: 'rgba(248, 81, 73, 0.4)',
        labelJa: '超過重',
        labelEn: 'Overloaded',
        icon: '🚨',
    },
};

export class EncumbrancePresenter {
    /**
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language='ja']
     */
    constructor(options = {}) {
        this.language = options.language || 'ja';
    }

    /**
     * 言語設定の更新
     * @param {'ja'|'en'} lang 
     */
    setLanguage(lang = 'ja') {
        const isJa = (lang === 'ja' || lang === 'jp' || lang === true);
        this.language = isJa ? 'ja' : 'en';
    }

    /**
     * EncumbranceState から UI 用 ViewModel を生成
     * @param {Object} state - EncumbranceStateManager から得られた state
     * @param {Object} [options={}]
     * @param {'ja'|'en'} [options.language]
     * @returns {Object}
     */
    formatViewModel(state, options = {}) {
        const lang = options.language || this.language || 'ja';
        const isJa = (lang === 'ja' || lang === 'jp');

        if (!state) {
            return {
                level: EncumbranceLevel.NORMAL,
                percentage: 0,
                clampedPercentage: 0,
                color: ENCUMBRANCE_THEME[EncumbranceLevel.NORMAL].color,
                bgColor: ENCUMBRANCE_THEME[EncumbranceLevel.NORMAL].bgColor,
                borderColor: ENCUMBRANCE_THEME[EncumbranceLevel.NORMAL].borderColor,
                statusText: isJa ? '余裕' : 'Normal',
                icon: '🏃',
                totalWeight: 0,
                capacity: 0,
                ratio: 0,
                hasUninspectedContainer: false,
                tooltipText: isJa ? '推定積載率: 約0%' : 'Est. Load: ~0%',
            };
        }

        const level = state.level || EncumbranceLevel.NORMAL;
        const theme = ENCUMBRANCE_THEME[level] || ENCUMBRANCE_THEME[EncumbranceLevel.NORMAL];

        const percentage = typeof state.percentage === 'number' ? state.percentage : 0;
        const clampedPercentage = Math.min(100, Math.max(0, percentage));
        const statusText = isJa ? theme.labelJa : theme.labelEn;

        const totalWeight = state.totalWeight || 0;
        const capacity = state.capacity || 0;
        const ratio = state.ratio !== undefined ? state.ratio : (capacity > 0 ? totalWeight / capacity : 0);
        const hasUninspectedContainer = Boolean(state.hasUninspectedContainer);

        const uninspectedSuffix = hasUninspectedContainer ? (isJa ? ' [未確認袋あり]' : ' [Uninspected bag]') : '';
        const tooltipText = isJa
            ? `推定積載率: 約${percentage}% (推定重量: 約${totalWeight} / 推定許容量: 約${capacity}) - ${statusText}${uninspectedSuffix}`
            : `Est. Load: ~${percentage}% (Est. Weight: ~${totalWeight} / Capacity: ~${capacity}) - ${statusText}${uninspectedSuffix}`;

        return {
            level,
            percentage,
            clampedPercentage,
            color: theme.color,
            bgColor: theme.bgColor,
            borderColor: theme.borderColor,
            statusText,
            icon: theme.icon,
            totalWeight,
            capacity,
            ratio,
            hasUninspectedContainer,
            tooltipText,
        };
    }

    /**
     * ミニゲージコンポーネントの HTML 文字列を生成
     * @param {Object} state - EncumbranceState
     * @param {Object} [options={}]
     * @param {boolean} [options.compact=false] - 省略表示
     * @param {'ja'|'en'} [options.language]
     * @returns {string} HTML 文字列
     */
    renderMiniGaugeHtml(state, options = {}) {
        const vm = this.formatViewModel(state, options);

        const uninspectedBadge = vm.hasUninspectedContainer
            ? `<span class="encumbrance-uninspected-badge" style="display:inline-block; font-size:10px; font-weight:bold; background:#d29922; color:#fff; border-radius:50%; width:14px; height:14px; line-height:14px; text-align:center; margin-left:4px;" title="${options.language === 'en' ? 'Uninspected container inside' : '中身未確認の袋があります'}">?</span>`
            : '';

        if (options.compact) {
            return `
<div class="encumbrance-gauge-compact" title="${vm.tooltipText}" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; cursor:default;">
    <span class="encumbrance-icon">${vm.icon}</span>
    <span class="encumbrance-status" style="font-weight:bold; color:${vm.color};">${vm.statusText}</span>
    ${uninspectedBadge}
</div>`.trim();
        }

        return `
<div class="encumbrance-gauge-widget" title="${vm.tooltipText}" style="display:flex; flex-direction:column; gap:2px; font-size:11px; user-select:none; min-width:100px;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="display:flex; align-items:center; gap:4px;">
            <span>${vm.icon}</span>
            <span style="font-weight:bold; color:${vm.color};">${vm.statusText}</span>
            ${uninspectedBadge}
        </span>
    </div>
    <div class="encumbrance-bar-bg" style="height:4px; width:100%; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
        <div class="encumbrance-bar-fill" style="height:100%; width:${vm.clampedPercentage}%; background-color:${vm.color}; transition: width 0.2s ease, background-color 0.2s ease;"></div>
    </div>
</div>`.trim();
    }
}
