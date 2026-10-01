/**
 * NhShirenInventoryDrawer.js
 * 
 * <nh-shiren-drawer> Web Component
 * 風来のシレン風の縦型スライドインベントリドロワー。
 * ゲームパッド（十字キー、A/B/X/Y、LB/RB）に完全対応し、
 * GKL InventoryStateManager とリアルタイム連動する。
 */

import { NhBaseElement } from '../NhBaseElement.js';

const DRAWER_CSS = `
:host {
  display: block;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 400px;
  max-width: 90vw;
  z-index: 1000;
  transform: translateX(105%);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
}

:host([open]) {
  transform: translateX(0);
  pointer-events: auto;
}

.drawer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(11, 15, 25, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-left: 2px solid var(--nh-primary-color, #38bdf8);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #f8fafc;
}

/* ヘッダー */
.drawer-header {
  padding: 16px 20px 12px 20px;
  background: rgba(15, 23, 42, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  font-size: 1.4rem;
}

.title-text {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #38bdf8;
}

.item-count-badge {
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  color: #38bdf8;
  font-weight: 600;
}

.btn-close {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.btn-close:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border-color: #f87171;
}

/* タブバー (LB / RB) */
.tab-bar-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bumper-badge {
  font-size: 0.7rem;
  font-weight: bold;
  padding: 3px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #94a3b8;
  user-select: none;
}

.tabs-wrapper {
  flex: 1;
  display: flex;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs-wrapper::-webkit-scrollbar { display: none; }

.tab-btn {
  flex: 1;
  padding: 6px 4px;
  font-size: 0.75rem;
  text-align: center;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-btn.active {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
}

/* アイテムリスト */
.item-list-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-message {
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.item-row:hover {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.3);
}

.item-row.selected {
  background: rgba(56, 189, 248, 0.25);
  border-color: #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
  transform: translateX(-4px);
}

.item-cursor {
  width: 14px;
  font-size: 0.85rem;
  color: #38bdf8;
  visibility: hidden;
  font-weight: bold;
}
.item-row.selected .item-cursor {
  visibility: visible;
}

.item-letter {
  font-size: 0.8rem;
  font-weight: bold;
  color: #e2e8f0;
  width: 18px;
}

.item-icon {
  font-size: 1.25rem;
  width: 24px;
  text-align: center;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-desc {
  font-size: 0.72rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge-equipped {
  font-size: 0.68rem;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid #22c55e;
  color: #4ade80;
}

.badge-quiver {
  font-size: 0.68rem;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(234, 179, 8, 0.2);
  border: 1px solid #eab308;
  color: #fde047;
}

.badge-buc {
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 3px;
}
.badge-buc.cursed {
  background: rgba(239, 68, 68, 0.25);
  color: #f87171;
}
.badge-buc.blessed {
  background: rgba(168, 85, 247, 0.25);
  color: #c084fc;
}

/* アクションサブメニュー (ポップアップ) */
.submenu-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(11, 15, 25, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 10;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.submenu-card {
  width: 100%;
  max-width: 320px;
  background: #0f172a;
  border: 2px solid #38bdf8;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.submenu-header {
  padding: 12px 16px;
  background: rgba(56, 189, 248, 0.15);
  border-bottom: 1px solid rgba(56, 189, 248, 0.3);
  display: flex;
  align-items: center;
  gap: 10px;
}

.submenu-title {
  font-size: 0.95rem;
  font-weight: bold;
  color: #38bdf8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submenu-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.submenu-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #f1f5f9;
  cursor: pointer;
  transition: all 0.15s;
}

.submenu-btn.selected {
  background: rgba(56, 189, 248, 0.3);
  border-color: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
}

.action-label-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 600;
}

.action-key-badge {
  font-size: 0.72rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-family: monospace;
}

/* フッター (操作ガイド) */
.drawer-footer {
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.9);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-around;
  gap: 8px;
  font-size: 0.75rem;
  color: #94a3b8;
}

.guide-pill {
  display: flex;
  align-items: center;
  gap: 5px;
}

.guide-key {
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
}
`;

const TAB_CATEGORIES = [
    { id: 'ALL', label: 'すべて' },
    { id: 'EQUIPMENT', label: '武器防具' },
    { id: 'SCROLL_WAND', label: '巻物杖' },
    { id: 'POTION_FOOD', label: '薬食料' },
    { id: 'OTHER', label: '道具他' }
];

export class NhShirenInventoryDrawer extends NhBaseElement {
    constructor() {
        super();
        this.items = [];
        this.currentTabIndex = 0;
        this.selectedIndex = 0;
        this.isOpen = false;
        this.isSubmenuOpen = false;
        this.selectedSubmenuIndex = 0;
        this.activeActions = [];
        this.core = null;
        this.modalStack = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._render();
    }

    /**
     * 外部依存の注入
     * @param {Object} options
     * @param {Object} options.core - WebUICore
     * @param {Object} options.modalStack - ModalStackController
     */
    init(options = {}) {
        this.core = options.core || null;
        this.modalStack = options.modalStack || null;

        if (this.core && this.core.knowledge && this.core.knowledge.inventoryStateManager) {
            this.core.knowledge.inventoryStateManager.on('inventoryUpdated', (inv) => {
                this.setItems(inv.items || []);
            });
            const cur = this.core.knowledge.inventoryStateManager.getInventoryState();
            if (cur && cur.items) {
                this.setItems(cur.items);
            }
        }
    }

    /**
     * アイテムリストの更新
     * @param {Array<Object>} items 
     */
    setItems(items = []) {
        this.items = items;
        this._clampSelection();
        this._render();
    }

    /**
     * 開閉の切り替え
     * @param {boolean} [open]
     */
    toggle(open = undefined) {
        const next = open !== undefined ? !!open : !this.isOpen;
        if (next) this.open();
        else this.close();
    }

    open() {
        this.isOpen = true;
        this.setAttribute('open', '');
        this.isSubmenuOpen = false;
        this._clampSelection();

        if (this.modalStack && typeof this.modalStack.registerModal === 'function') {
            this.modalStack.registerModal('shirenDrawer', {
                isOpen: () => this.isOpen,
                close: () => this.close(),
                priority: 50
            });
        }

        this.dispatchEvent(new CustomEvent('drawerOpened', { bubbles: true, composed: true }));
        this._render();
    }

    close() {
        this.isOpen = false;
        this.removeAttribute('open');
        this.isSubmenuOpen = false;

        if (this.modalStack && typeof this.modalStack.unregisterModal === 'function') {
            this.modalStack.unregisterModal('shirenDrawer');
        }

        this.dispatchEvent(new CustomEvent('drawerClosed', { bubbles: true, composed: true }));
        this._render();
    }

    /**
     * ゲームパッドナビゲーションシグナル受信ハンドラー
     * @param {{ type: 'prev'|'next'|'pagePrev'|'pageNext'|'tabPrev'|'tabNext'|'select'|'menu'|'close' }} navAction 
     */
    handleGamepadNav(navAction) {
        if (!this.isOpen) return;

        const filtered = this._getFilteredItems();

        if (this.isSubmenuOpen) {
            // サブメニュー操作
            switch (navAction.type) {
                case 'prev':
                    this.selectedSubmenuIndex = Math.max(0, this.selectedSubmenuIndex - 1);
                    this._renderSubmenuOnly();
                    break;
                case 'next':
                    this.selectedSubmenuIndex = Math.min(this.activeActions.length - 1, this.selectedSubmenuIndex + 1);
                    this._renderSubmenuOnly();
                    break;
                case 'select':
                    this._executeSelectedSubmenuAction();
                    break;
                case 'close':
                case 'menu':
                    this.isSubmenuOpen = false;
                    this._render();
                    break;
            }
            return;
        }

        // 通常リスト操作
        switch (navAction.type) {
            case 'prev':
                if (filtered.length > 0) {
                    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
                    this._scrollToSelected();
                    this._renderListOnly();
                }
                break;
            case 'next':
                if (filtered.length > 0) {
                    this.selectedIndex = Math.min(filtered.length - 1, this.selectedIndex + 1);
                    this._scrollToSelected();
                    this._renderListOnly();
                }
                break;
            case 'pagePrev':
                if (filtered.length > 0) {
                    this.selectedIndex = Math.max(0, this.selectedIndex - 5);
                    this._scrollToSelected();
                    this._renderListOnly();
                }
                break;
            case 'pageNext':
                if (filtered.length > 0) {
                    this.selectedIndex = Math.min(filtered.length - 1, this.selectedIndex + 5);
                    this._scrollToSelected();
                    this._renderListOnly();
                }
                break;
            case 'tabPrev':
                this.currentTabIndex = (this.currentTabIndex - 1 + TAB_CATEGORIES.length) % TAB_CATEGORIES.length;
                this.selectedIndex = 0;
                this._render();
                break;
            case 'tabNext':
                this.currentTabIndex = (this.currentTabIndex + 1) % TAB_CATEGORIES.length;
                this.selectedIndex = 0;
                this._render();
                break;
            case 'select':
            case 'menu':
                if (filtered.length > 0 && filtered[this.selectedIndex]) {
                    this._openSubmenuForItem(filtered[this.selectedIndex]);
                }
                break;
            case 'close':
                this.close();
                break;
        }
    }

    _getFilteredItems() {
        const cat = TAB_CATEGORIES[this.currentTabIndex].id;
        if (cat === 'ALL') return this.items;

        return this.items.filter(item => {
            const c = (item.category || item.type || '').toUpperCase();
            if (cat === 'EQUIPMENT') {
                return ['WEAPON', 'ARMOR', 'RING', 'AMULET', 'SHIELD', 'HELMET', 'BOOTS', 'CLOAK', 'GLOVES'].includes(c);
            }
            if (cat === 'SCROLL_WAND') {
                return ['SCROLL', 'WAND', 'SPELLBOOK'].includes(c);
            }
            if (cat === 'POTION_FOOD') {
                return ['POTION', 'FOOD'].includes(c);
            }
            if (cat === 'OTHER') {
                return ['TOOL', 'GEM', 'GOLD', 'ROCK', 'OTHER', 'MISCELLANEOUS'].includes(c) || !c;
            }
            return true;
        });
    }

    _clampSelection() {
        const filtered = this._getFilteredItems();
        if (filtered.length === 0) {
            this.selectedIndex = 0;
        } else if (this.selectedIndex >= filtered.length) {
            this.selectedIndex = filtered.length - 1;
        }
    }

    _scrollToSelected() {
        const root = this.shadowRoot;
        if (!root) return;
        const row = root.querySelector(`.item-row[data-index="${this.selectedIndex}"]`);
        if (row && typeof row.scrollIntoView === 'function') {
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    _getItemIcon(item) {
        const cat = (item.category || item.type || '').toUpperCase();
        switch (cat) {
            case 'WEAPON': return '⚔️';
            case 'ARMOR': case 'SHIELD': case 'HELMET': case 'BOOTS': case 'CLOAK': case 'GLOVES': return '🛡️';
            case 'RING': return '💍';
            case 'AMULET': return '📿';
            case 'POTION': return '🧪';
            case 'SCROLL': return '📜';
            case 'SPELLBOOK': return '📖';
            case 'WAND': return '🪄';
            case 'FOOD': return '🍖';
            case 'TOOL': return '🧰';
            case 'GEM': return '💎';
            case 'GOLD': return '🪙';
            default: return '📦';
        }
    }

    /**
     * アイテムに対する実行可能アクション一覧を生成
     */
    _getActionsForItem(item) {
        const cat = (item.category || item.type || '').toUpperCase();
        const letter = item.letter || item.invlet || item.charStr || '';
        const isEquipped = !!(item.equipped || item.isEquipped);

        const actions = [];

        // カテゴリ別推奨主アクション
        if (cat === 'WEAPON') {
            actions.push({ id: 'WIELD', label: '装備する', key: 'w', letter });
        } else if (cat === 'ARMOR' || cat === 'SHIELD' || cat === 'HELMET' || cat === 'BOOTS' || cat === 'CLOAK' || cat === 'GLOVES') {
            if (isEquipped) actions.push({ id: 'TAKEOFF', label: '脱ぐ', key: 'T', letter });
            else actions.push({ id: 'WEAR', label: '着る', key: 'W', letter });
        } else if (cat === 'RING' || cat === 'AMULET') {
            if (isEquipped) actions.push({ id: 'REMOVE', label: '外す', key: 'R', letter });
            else actions.push({ id: 'PUTON', label: '身につける', key: 'P', letter });
        } else if (cat === 'POTION') {
            actions.push({ id: 'QUAFF', label: '飲む', key: 'q', letter });
            actions.push({ id: 'DIP', label: '浸す', key: '#dip', letter });
        } else if (cat === 'SCROLL' || cat === 'SPELLBOOK') {
            actions.push({ id: 'READ', label: '読む', key: 'r', letter });
        } else if (cat === 'WAND') {
            actions.push({ id: 'ZAP', label: '振る', key: 'z', letter });
        } else if (cat === 'FOOD') {
            actions.push({ id: 'EAT', label: '食べる', key: 'e', letter });
        } else if (cat === 'TOOL') {
            actions.push({ id: 'APPLY', label: '使う', key: 'a', letter });
        }

        // 共通アクション (投げる、置く、調べる)
        actions.push({ id: 'THROW', label: '投げる', key: 't', letter });
        actions.push({ id: 'DROP', label: '置く', key: 'd', letter });

        return actions;
    }

    _openSubmenuForItem(item) {
        this.activeActions = this._getActionsForItem(item);
        this.selectedSubmenuIndex = 0;
        this.isSubmenuOpen = true;
        this._render();
    }

    async _executeSelectedSubmenuAction() {
        if (!this.activeActions || !this.activeActions[this.selectedSubmenuIndex]) return;
        const act = this.activeActions[this.selectedSubmenuIndex];
        const filtered = this._getFilteredItems();
        const item = filtered[this.selectedIndex];

        this.close();

        this.dispatchEvent(new CustomEvent('itemActionExecuted', {
            detail: { action: act, item },
            bubbles: true,
            composed: true
        }));

        if (this.core) {
            // NetHack へのコマンド送信 (例: 'q' + 'a' 等)
            if (act.key && act.letter) {
                if (this.core.sendKey) {
                    this.core.sendKey(act.key);
                    // わずかなディレイを置いてアイテムレターを送信
                    setTimeout(() => {
                        this.core.sendKey(act.letter);
                    }, 40);
                }
            } else if (act.key && this.core.sendKey) {
                this.core.sendKey(act.key);
            }
        }
    }

    _render() {
        const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
        const filtered = this._getFilteredItems();

        root.innerHTML = `
<style>${DRAWER_CSS}</style>
<div class="drawer-overlay">
  <!-- ヘッダー -->
  <div class="drawer-header">
    <div class="header-top">
      <div class="title-wrap">
        <span class="title-icon">🎒</span>
        <span class="title-text">道具袋</span>
        <span class="item-count-badge">${this.items.length} 個</span>
      </div>
      <button class="btn-close" id="btn-close">閉じる [B]</button>
    </div>

    <!-- タブバー (LB / RB) -->
    <div class="tab-bar-container">
      <span class="bumper-badge">LB</span>
      <div class="tabs-wrapper">
        ${TAB_CATEGORIES.map((tab, idx) => `
          <button class="tab-btn ${idx === this.currentTabIndex ? 'active' : ''}" data-tab-idx="${idx}">
            ${tab.label}
          </button>
        `).join('')}
      </div>
      <span class="bumper-badge">RB</span>
    </div>
  </div>

  <!-- アイテム一覧 -->
  <div class="item-list-container" id="item-list">
    ${filtered.length === 0 ? `
      <div class="empty-message">所持品はありません</div>
    ` : filtered.map((item, idx) => {
        const isSel = idx === this.selectedIndex;
        const icon = this._getItemIcon(item);
        const name = item.translatedName || item.jpName || item.name || item.str || '???';
        const letter = item.letter || item.invlet || item.charStr || '-';
        const isEquipped = !!(item.equipped || item.isEquipped);
        const isQuiver = !!(item.quiver || item.isQuiver);

        return `
        <div class="item-row ${isSel ? 'selected' : ''}" data-index="${idx}">
          <span class="item-cursor">▶</span>
          <span class="item-letter">${letter})</span>
          <span class="item-icon">${icon}</span>
          <div class="item-info">
            <div class="item-name">${name}</div>
            <div class="item-badges">
              ${isEquipped ? '<span class="badge-equipped">[装備中]</span>' : ''}
              ${isQuiver ? '<span class="badge-quiver">[矢筒]</span>' : ''}
            </div>
          </div>
        </div>
        `;
    }).join('')}
  </div>

  <!-- フッター操作ガイド -->
  <div class="drawer-footer">
    <div class="guide-pill"><span class="guide-key">↑↓</span> 選択</div>
    <div class="guide-pill"><span class="guide-key">A</span> 決定</div>
    <div class="guide-pill"><span class="guide-key">B</span> 閉じる</div>
    <div class="guide-pill"><span class="guide-key">LB/RB</span> タブ</div>
    <div class="guide-pill"><span class="guide-key">X</span> メニュー</div>
  </div>

  <!-- サブメニュー (ポップアップ) -->
  ${this.isSubmenuOpen && filtered[this.selectedIndex] ? `
    <div class="submenu-overlay" id="submenu-overlay">
      <div class="submenu-card">
        <div class="submenu-header">
          <span>${this._getItemIcon(filtered[this.selectedIndex])}</span>
          <span class="submenu-title">${filtered[this.selectedIndex].translatedName || filtered[this.selectedIndex].name}</span>
        </div>
        <div class="submenu-list">
          ${this.activeActions.map((act, actIdx) => `
            <div class="submenu-btn ${actIdx === this.selectedSubmenuIndex ? 'selected' : ''}" data-act-idx="${actIdx}">
              <div class="action-label-wrap">
                <span>▶</span>
                <span>${act.label}</span>
              </div>
              <span class="action-key-badge">${act.key}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : ''}
</div>
        `;

        this._bindEvents();
    }

    _renderListOnly() {
        const root = this.shadowRoot;
        if (!root) return;
        const rows = root.querySelectorAll('.item-row');
        rows.forEach((row, idx) => {
            if (idx === this.selectedIndex) row.classList.add('selected');
            else row.classList.remove('selected');
        });
    }

    _renderSubmenuOnly() {
        const root = this.shadowRoot;
        if (!root) return;
        const btns = root.querySelectorAll('.submenu-btn');
        btns.forEach((btn, idx) => {
            if (idx === this.selectedSubmenuIndex) btn.classList.add('selected');
            else btn.classList.remove('selected');
        });
    }

    _bindEvents() {
        const root = this.shadowRoot;
        if (!root) return;

        // 閉じるボタン
        const btnClose = root.querySelector('#btn-close');
        if (btnClose) {
            btnClose.addEventListener('click', () => this.close());
        }

        // タブクリック
        const tabBtns = root.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-tab-idx'), 10);
                if (!isNaN(idx)) {
                    this.currentTabIndex = idx;
                    this.selectedIndex = 0;
                    this._render();
                }
            });
        });

        // アイテム行クリック
        const rows = root.querySelectorAll('.item-row');
        rows.forEach(row => {
            row.addEventListener('click', () => {
                const idx = parseInt(row.getAttribute('data-index'), 10);
                if (!isNaN(idx)) {
                    this.selectedIndex = idx;
                    const filtered = this._getFilteredItems();
                    if (filtered[idx]) {
                        this._openSubmenuForItem(filtered[idx]);
                    }
                }
            });
        });

        // サブメニューアクションクリック
        const actBtns = root.querySelectorAll('.submenu-btn');
        actBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-act-idx'), 10);
                if (!isNaN(idx)) {
                    this.selectedSubmenuIndex = idx;
                    this._executeSelectedSubmenuAction();
                }
            });
        });

        // サブメニュー外側クリックで閉じる
        const subOverlay = root.querySelector('#submenu-overlay');
        if (subOverlay) {
            subOverlay.addEventListener('click', (e) => {
                if (e.target === subOverlay) {
                    this.isSubmenuOpen = false;
                    this._render();
                }
            });
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('nh-shiren-drawer')) {
    customElements.define('nh-shiren-drawer', NhShirenInventoryDrawer);
}
