/**
 * NhPaperdoll.js
 *
 * <nh-paperdoll> Web Component
 * PaperdollPresenter と連携し、人型部位スロットレイアウト、適合スロットハイライト、装備差分プレビューを描画。
 */

import { NhBaseElement } from './NhBaseElement.js';
import { PaperdollPresenter, SLOT_DEFINITIONS } from '../ui-controller/PaperdollPresenter.js';
import { resolveEligibleSlots } from '../core/knowledge/equipment/EquipmentRules.js';

const PAPERDOLL_CSS = `
:host {
  display: block;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.paperdoll-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
  gap: 10px;
}

.slot-card {
  background: rgba(22, 33, 62, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
  overflow: hidden;
}

.slot-card:hover {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(56, 189, 248, 0.4);
  transform: translateY(-2px);
}

.slot-card.selected {
  border-color: var(--nh-primary-color);
  background: rgba(14, 165, 233, 0.15);
  box-shadow: 0 0 14px var(--nh-primary-glow);
}

.slot-card.eligible {
  border-color: var(--nh-warning-color);
  background: rgba(245, 158, 11, 0.12);
  box-shadow: 0 0 12px var(--nh-warning-glow);
  animation: pulseEligible 1.5s infinite alternate;
}

@keyframes pulseEligible {
  0% { box-shadow: 0 0 6px var(--nh-warning-glow); }
  100% { box-shadow: 0 0 16px var(--nh-warning-glow); }
}

.slot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--nh-text-muted);
}

.slot-icon {
  font-size: 1.1rem;
}

.slot-layer-badge {
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.slot-item-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--nh-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slot-item-empty {
  color: var(--nh-text-muted);
  font-style: italic;
}

/* 差分プレビュー表示 */
.diff-panel {
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-header {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--nh-primary-color);
  display: flex;
  align-items: center;
  gap: 6px;
}

.diff-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.diff-metric-box {
  background: rgba(22, 33, 62, 0.5);
  border-radius: 6px;
  padding: 6px 8px;
  text-align: center;
}

.metric-label {
  font-size: 0.7rem;
  color: var(--nh-text-muted);
}

.metric-value {
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--nh-font-mono);
}

.metric-value.improved {
  color: var(--nh-success-color);
}

.metric-value.worsened {
  color: var(--nh-danger-color);
}

.diff-warnings {
  font-size: 0.75rem;
  color: var(--nh-warning-color);
  padding: 4px 8px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 4px;
}
`;

export class NhPaperdoll extends NhBaseElement {
  constructor() {
    super({ customCss: PAPERDOLL_CSS });

    this.presenter = new PaperdollPresenter();
    this._situation = null;
    this._candidateItem = null;
    this._selectedSlot = null;
    this._hoverDiff = null;
  }

  /**
   * ゲーム状況 (GKL Situation) の設定
   * @param {Object} situation
   */
  setSituation(situation) {
    this._situation = situation;
    this._updateSlots();
  }

  /**
   * 換装候補アイテムの設定 (適合スロットのハイライト & 差分計算用)
   * @param {Object|null} item
   */
  setCandidateItem(item) {
    this._candidateItem = item;
    this._updateSlots();
  }

  /**
   * 選択スロットの設定
   * @param {string|null} slotId
   */
  setSelectedSlot(slotId) {
    this._selectedSlot = slotId;
    this._updateSlots();
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <div class="paperdoll-container">
        <div class="slots-grid"></div>
        <div class="diff-panel" style="display: none;"></div>
      </div>
    `;

    this._updateSlots();
  }

  _updateSlots() {
    if (!this.shadowRoot) return;

    const grid = this.shadowRoot.querySelector('.slots-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const slotDefs = this.presenter.slotDefinitions;
    const eligibleSlots = this._candidateItem ? (resolveEligibleSlots(this._candidateItem) || []) : [];

    const inventoryItems = (this._situation && this._situation.inventory && Array.isArray(this._situation.inventory.items))
      ? this._situation.inventory.items
      : [];

    for (const [slotId, def] of Object.entries(slotDefs)) {
      const isEligible = eligibleSlots.includes(slotId);
      const isSelected = this._selectedSlot === slotId;

      // 現在装備中のアイテムを特定
      const currentEquipped = inventoryItems.find(it => {
        if (!it.equipped) return false;
        const slots = resolveEligibleSlots(it);
        return Array.isArray(slots) && slots.includes(slotId);
      });

      const slotCard = document.createElement('div');
      slotCard.className = 'slot-card';
      if (isSelected) slotCard.classList.add('selected');
      if (isEligible) slotCard.classList.add('eligible');
      slotCard.dataset.slotId = slotId;

      const layerBadge = def.layer ? `<span class="slot-layer-badge">L${def.layer}</span>` : '';
      const itemName = currentEquipped ? (currentEquipped.name || currentEquipped.text || currentEquipped.rawText) : '<span class="slot-item-empty">なし</span>';

      slotCard.innerHTML = `
        <div class="slot-header">
          <span class="slot-icon">${def.icon || '🛡️'}</span>
          <span>${def.labelJa}</span>
          ${layerBadge}
        </div>
        <div class="slot-item-name">${itemName}</div>
      `;

      // クリックイベント
      slotCard.addEventListener('click', () => {
        this.setSelectedSlot(slotId);
        const eligibleItems = this.presenter.getEligibleItemsForSlot(inventoryItems, slotId);
        this.emit('slot-select', {
          slotId,
          currentItem: currentEquipped || null,
          eligibleItems
        });
      });

      // ホバー時の差分計算
      slotCard.addEventListener('mouseenter', () => {
        const diff = this.presenter.calculatePreviewDiff({
          situation: this._situation,
          candidateItem: this._candidateItem,
          currentItem: currentEquipped,
          slotId
        });
        this._renderDiff(diff, def.labelJa);
        this.emit('slot-hover', { slotId, diff });
      });

      grid.appendChild(slotCard);
    }
  }

  _renderDiff(diff, slotLabel) {
    if (!this.shadowRoot) return;
    const diffPanel = this.shadowRoot.querySelector('.diff-panel');
    if (!diffPanel || !diff) return;

    diffPanel.style.display = 'flex';

    const acDelta = diff.ac ? diff.ac.delta : 0;
    const acClass = acDelta < 0 ? 'improved' : (acDelta > 0 ? 'worsened' : '');
    const acText = acDelta > 0 ? `+${acDelta}` : `${acDelta}`;

    const turns = diff.turns ? diff.turns.required : 1;
    const warnings = diff.warnings && diff.warnings.length > 0
      ? `<div class="diff-warnings">⚠️ ${diff.warnings.join(', ')}</div>`
      : '';

    diffPanel.innerHTML = `
      <div class="diff-header">
        <span>⚡ 装備差分プレビュー [${slotLabel}]</span>
      </div>
      <div class="diff-metrics">
        <div class="diff-metric-box">
          <div class="metric-label">AC 変動</div>
          <div class="metric-value ${acClass}">${acText} (目標: ${diff.ac?.target ?? '-'})</div>
        </div>
        <div class="diff-metric-box">
          <div class="metric-label">所要ターン</div>
          <div class="metric-value">${turns}T</div>
        </div>
        <div class="diff-metric-box">
          <div class="metric-label">重量差分</div>
          <div class="metric-value">${diff.weight?.delta ?? 0} aum</div>
        </div>
      </div>
      ${warnings}
    `;
  }
}
