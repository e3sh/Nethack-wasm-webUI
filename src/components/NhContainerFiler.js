/**
 * NhContainerFiler.js
 *
 * <nh-container-filer> Web Component
 * ContainerDraftController と連携し、二画面ファイラー、移動ドラフト、BoH防爆警告バッジを描画。
 */

import { NhBaseElement } from './NhBaseElement.js';
import { ContainerDraftController, TRANSFER_DIRECTION } from '../ui-controller/ContainerDraftController.js';

const FILER_CSS = `
:host {
  display: block;
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
}

.filer-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filer-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(22, 33, 62, 0.5);
  border-radius: 8px;
  border: 1px solid var(--nh-border-color);
}

.filer-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.filer-pane {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid var(--nh-border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 340px;
  overflow: hidden;
}

.pane-header {
  padding: 8px 12px;
  background: rgba(30, 41, 59, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--nh-primary-color);
}

.pane-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filer-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(22, 33, 62, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.85rem;
}

.filer-item-card:hover {
  background: rgba(30, 41, 59, 0.8);
  border-color: rgba(56, 189, 248, 0.3);
}

.filer-item-card.risk {
  border-color: var(--nh-danger-color);
  background: rgba(239, 68, 68, 0.15);
}

.filer-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.item-glyph {
  font-size: 1rem;
}

.item-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.draft-summary-bar {
  background: rgba(22, 33, 62, 0.7);
  border: 1px solid var(--nh-border-color);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.draft-count-text {
  font-size: 0.85rem;
  color: var(--nh-text-muted);
}
`;

export class NhContainerFiler extends NhBaseElement {
  static get observedAttributes() {
    return ['container-name', 'is-bag-of-holding'];
  }

  constructor() {
    super({ customCss: FILER_CSS });

    const isBoH = this.hasAttribute('is-bag-of-holding');
    this.controller = new ContainerDraftController({ isBagOfHolding: isBoH });

    this._containerName = this.getAttribute('container-name') || 'コンテナ';
    this._playerItems = [];
    this._containerItems = [];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'is-bag-of-holding') {
      const isBoH = this.hasAttribute('is-bag-of-holding');
      this.controller.setBagOfHolding(isBoH);
      this._updateView();
    } else if (name === 'container-name') {
      this._containerName = newValue || 'コンテナ';
      this._updateView();
    }
  }

  /**
   * プレイヤー所持品リストの設定
   * @param {Array<Object>} items
   */
  setPlayerInventory(items) {
    this._playerItems = Array.isArray(items) ? [...items] : [];
    this._updateView();
  }

  /**
   * コンテナ内アイテムリストの設定
   * @param {Array<Object>} items
   */
  setContainerContents(items) {
    this._containerItems = Array.isArray(items) ? [...items] : [];
    this._updateView();
  }

  /**
   * 手品袋フラグの設定
   * @param {boolean} isBagOfHolding
   */
  setBagOfHolding(isBagOfHolding) {
    if (isBagOfHolding) {
      this.setAttribute('is-bag-of-holding', '');
    } else {
      this.removeAttribute('is-bag-of-holding');
    }
  }

  /**
   * アイテム転送ドラフトの追加
   */
  stageTransfer(item, direction, count = -1) {
    const res = this.controller.stageTransfer(item, direction, count);
    if (res.requiresWarning) {
      this.emit('explosion-warning', { item });
    }
    this.emit('transfer-staged', { draft: res.draft, requiresWarning: res.requiresWarning });
    this._updateView();
    return res;
  }

  /**
   * ドラフトクリア
   */
  clearDraft() {
    this.controller.clearDraft();
    this._updateView();
  }

  /**
   * 現在のドラフト取得
   */
  getDrafts() {
    return this.controller.getDrafts();
  }

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <div class="filer-container">
        <div class="filer-header-bar">
          <div style="font-weight: 600; display: flex; align-items: center; gap: 8px;">
            <span>📦 ${this._containerName}</span>
            <span class="boh-badge" style="display: none;"></span>
          </div>
          <div>
            <button class="nh-btn nh-btn-danger btn-clear-draft">ドラフト解除</button>
          </div>
        </div>

        <div class="filer-columns">
          <!-- プレイヤー所持品 -->
          <div class="filer-pane">
            <div class="pane-header">
              <span>🎒 プレイヤー所持品</span>
              <span class="player-count">0</span>
            </div>
            <div class="pane-list player-items-list"></div>
          </div>

          <!-- コンテナ内 -->
          <div class="filer-pane">
            <div class="pane-header">
              <span>📥 コンテナ内アイテム</span>
              <span class="container-count">0</span>
            </div>
            <div class="pane-list container-items-list"></div>
          </div>
        </div>

        <div class="draft-summary-bar">
          <div class="draft-count-text">転送ドラフト: <strong class="draft-total">0</strong> 件</div>
          <button class="nh-btn nh-btn-primary btn-commit-transfer">転送を実行</button>
        </div>
      </div>
    `;

    const clearBtn = this.shadowRoot.querySelector('.btn-clear-draft');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearDraft());
    }

    const commitBtn = this.shadowRoot.querySelector('.btn-commit-transfer');
    if (commitBtn) {
      commitBtn.addEventListener('click', () => {
        const drafts = this.getDrafts();
        this.emit('transfer-commit', { drafts });
      });
    }

    this._updateView();
  }

  _updateView() {
    if (!this.shadowRoot) return;

    // 手品袋バッジ
    const bohBadge = this.shadowRoot.querySelector('.boh-badge');
    if (bohBadge) {
      if (this.controller.isBagOfHolding) {
        bohBadge.style.display = 'inline-flex';
        bohBadge.className = 'boh-badge nh-badge nh-badge-warning';
        bohBadge.textContent = '⚠️ 手品袋 (Bag of Holding) 防爆モード';
      } else {
        bohBadge.style.display = 'none';
      }
    }

    // プレイヤー所持品リスト描画
    const playerList = this.shadowRoot.querySelector('.player-items-list');
    const playerCount = this.shadowRoot.querySelector('.player-count');
    if (playerList && playerCount) {
      playerList.innerHTML = '';
      playerCount.textContent = String(this._playerItems.length);

      for (const item of this._playerItems) {
        const isRisk = this.controller.checkExplosionRisk(item);
        const card = document.createElement('div');
        card.className = 'filer-item-card' + (isRisk ? ' risk' : '');
        const countStr = (item.count && item.count > 1) ? `(${item.count}) ` : '';
        const nameStr = item.name || item.text || item.rawText || '不明なアイテム';

        card.innerHTML = `
          <div class="filer-item-left">
            <span class="item-glyph">${item.glyph || '🗡️'}</span>
            <span class="item-name">${countStr}${nameStr}</span>
          </div>
          <div>
            ${isRisk ? '<span class="nh-badge nh-badge-danger">CRITICAL 爆発</span>' : ''}
            <button class="nh-btn" style="padding: 2px 6px; font-size: 0.75rem;">入れる ➔</button>
          </div>
        `;

        const btn = card.querySelector('button');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stageTransfer(item, TRANSFER_DIRECTION.TO_CONTAINER);
          });
        }

        playerList.appendChild(card);
      }
    }

    // コンテナ内リスト描画
    const containerList = this.shadowRoot.querySelector('.container-items-list');
    const containerCount = this.shadowRoot.querySelector('.container-count');
    if (containerList && containerCount) {
      containerList.innerHTML = '';
      containerCount.textContent = String(this._containerItems.length);

      for (const item of this._containerItems) {
        const card = document.createElement('div');
        card.className = 'filer-item-card';
        const countStr = (item.count && item.count > 1) ? `(${item.count}) ` : '';
        const nameStr = item.name || item.text || item.rawText || '不明なアイテム';

        card.innerHTML = `
          <div class="filer-item-left">
            <span class="item-glyph">${item.glyph || '💎'}</span>
            <span class="item-name">${countStr}${nameStr}</span>
          </div>
          <div>
            <button class="nh-btn" style="padding: 2px 6px; font-size: 0.75rem;">⬅ 取出す</button>
          </div>
        `;

        const btn = card.querySelector('button');
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stageTransfer(item, TRANSFER_DIRECTION.FROM_CONTAINER);
          });
        }

        containerList.appendChild(card);
      }
    }

    // ドラフト合計
    const draftTotal = this.shadowRoot.querySelector('.draft-total');
    if (draftTotal) {
      draftTotal.textContent = String(this.controller.getDrafts().length);
    }
  }
}
