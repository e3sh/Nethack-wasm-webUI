/**
 * NhCodexGrid.js
 *
 * 冒険手帳 Web Component (<nh-codex-grid>) (Gap 4 対応)
 *
 * 【設計思想】
 * 1. セッション横断のメタプログレッション（モンスター383種・アイテム481品・噂787件）を
 *    タイルアイコンが並ぶグリッドギャラリーとして可視化。
 * 2. 未遭遇・未識別エントリは黒塗りのシルエット (brightness(0) opacity(0.25)) で表現し、
 *    解禁時はカラー点灯 ＋ NEW! バッジを表示。
 * 3. タイルクリック時に entry-selected イベントを発行し、<nh-knowledge-card> と連携。
 * 4. 既存の GlyphHelper と nethack_default_32.png を活用した超軽量レンダリング。
 */

import { NhBaseElement } from './NhBaseElement.js';
import { GlyphHelper } from '../core/renderers/GlyphHelper.js';
import { AdventureLogManager } from '../core/knowledge/lore/AdventureLogManager.js';

const CODEX_GRID_CSS = `
:host {
  display: block;
  font-family: var(--font-retro, 'Courier New', monospace);
  color: var(--text-color, #e2e8f0);
}

.codex-container {
  background: var(--glass-bg, rgba(15, 23, 42, 0.95));
  border: 1px solid var(--glass-border, rgba(56, 189, 248, 0.3));
  border-radius: var(--radius-lg, 12px);
  backdrop-filter: blur(var(--glass-blur, 16px));
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 480px;
}

.codex-header {
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding-bottom: 14px;
  margin-bottom: 14px;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 26px;
}

.codex-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
  letter-spacing: 0.5px;
}

.progress-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.progress-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: #38bdf8;
}

.progress-bar-bg {
  width: 180px;
  height: 8px;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #818cf8);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* ツールバー */
.codex-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.tab-group {
  display: flex;
  gap: 6px;
}

.tab-btn {
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #94a3b8;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn:hover {
  background: rgba(51, 65, 85, 0.8);
  color: #f1f5f9;
}

.tab-btn.active {
  background: #0284c7;
  color: #ffffff;
  border-color: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
}

.tab-badge {
  background: rgba(0, 0, 0, 0.3);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 0.75rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 6px;
  padding: 6px 10px;
  color: #f8fafc;
  font-size: 0.85rem;
  font-family: inherit;
  width: 140px;
  outline: none;
  transition: border-color 0.2s, width 0.2s;
}

.search-input:focus {
  border-color: #38bdf8;
  width: 180px;
}

.select-filter {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 6px;
  padding: 6px 8px;
  color: #f8fafc;
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}

/* グリッドコンテナ */
.grid-viewport {
  flex: 1;
  overflow-y: auto;
  min-height: 320px;
  max-height: calc(100vh - 210px);
  padding-right: 4px;
}

.grid-viewport::-webkit-scrollbar {
  width: 6px;
}

.grid-viewport::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

@media (max-width: 960px) {
  .grid-viewport {
    max-height: 50vh;
  }
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
  padding: 4px;
}

.tile-item {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

.tile-item:hover {
  transform: translateY(-2px);
  border-color: #38bdf8;
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
  z-index: 2;
}

.tile-item.selected {
  border-color: #fbbf24;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.5);
  background: rgba(251, 191, 36, 0.15);
}

/* シルエット（未解禁） */
.tile-item.locked {
  background: rgba(15, 23, 42, 0.4);
  border: 1px dashed rgba(100, 116, 139, 0.3);
  cursor: default;
}

.tile-item.locked:hover {
  transform: none;
  box-shadow: none;
  border-color: rgba(100, 116, 139, 0.5);
}

.tile-item.locked .glyph-icon {
  filter: brightness(0) opacity(0.25);
}

.tile-item.locked .text-symbol {
  color: #475569;
  filter: opacity(0.3);
}

/* NEW! バッジ */
.new-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #ffffff;
  font-size: 8px;
  font-weight: 700;
  padding: 1px 3px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  animation: pulse-badge 1.8s infinite;
  pointer-events: none;
}

@keyframes pulse-badge {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* 噂リスト表示（噂タブ用） */
.rumor-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
}

.rumor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.rumor-item:hover {
  background: rgba(51, 65, 85, 0.8);
  border-color: #38bdf8;
  transform: translateX(4px);
}

.rumor-item.locked {
  background: rgba(15, 23, 42, 0.4);
  border-style: dashed;
  cursor: default;
}

.rumor-item.locked:hover {
  background: rgba(15, 23, 42, 0.4);
  transform: none;
  border-color: rgba(100, 116, 139, 0.3);
}

.rumor-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rumor-no {
  font-weight: 700;
  font-size: 0.85rem;
  color: #64748b;
  min-width: 48px;
}

.rumor-text {
  font-size: 0.85rem;
  color: #e2e8f0;
}

.rumor-item.locked .rumor-text {
  color: #475569;
  letter-spacing: 2px;
}

.rumor-type-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  margin-left: 8px;
}

.badge-true {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.badge-false {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #64748b;
  font-size: 0.95rem;
  gap: 10px;
}
`;

export class NhCodexGrid extends NhBaseElement {
    static get styles() {
        return [CODEX_GRID_CSS];
    }

    constructor() {
        super({ customCss: CODEX_GRID_CSS });
        this.manager = null;
        this.currentCategory = 'all'; // 'all' | 'monster' | 'object' | 'rumor'
        this.statusFilter = 'all';    // 'all' | 'unlocked' | 'locked' | 'new'
        this.searchQuery = '';
        this.selectedEntryId = null;
        this.tileImage = '../pict/nethack_default_32.png';
        this.unsubscribe = null;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.manager) {
            this.manager = new AdventureLogManager();
        }
        this.unsubscribe = this.manager.subscribe(() => {
            this.render();
        });
        this.render();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    /**
     * 外部からマネージャを設定
     * @param {AdventureLogManager} manager 
     */
    setManager(manager) {
        if (this.unsubscribe) this.unsubscribe();
        this.manager = manager;
        if (this.manager) {
            this.unsubscribe = this.manager.subscribe(() => {
                this.render();
            });
        }
        this.render();
    }

    /**
     * タイル画像のパスを設定
     * @param {string} path 
     */
    setTileImage(path) {
        this.tileImage = path;
        this.render();
    }

    /**
     * カテゴリの変更
     * @param {'all'|'monster'|'object'|'rumor'} cat 
     */
    setCategory(cat) {
        if (this.currentCategory !== cat) {
            this.currentCategory = cat;
            this.render();
        }
    }

    /**
     * ID指定で特定エントリを選択・表示
     * @param {string|number} id
     * @param {'monster'|'object'|'rumor'} [category]
     */
    selectEntryById(id, category = null) {
        if (!id) return;
        if (category && this.currentCategory !== category) {
            this.currentCategory = category;
            this.render();
        }
        const allEntries = this._getFilteredEntries();
        const found = allEntries.find(e => e.id === id || String(e.id) === String(id));
        if (found) {
            this._handleEntryClick(found);
        }
    }

    /**
     * エントリクリック処理
     * @private
     */
    _handleEntryClick(entry) {
        if (!entry.isUnlocked) {
            // 未解禁の場合はクリック無効
            return;
        }

        this.selectedEntryId = entry.id;

        // NEW! の既読化
        if (entry.isNew && this.manager) {
            this.manager.markAsRead(entry.category, entry.monOffset !== undefined ? entry.monOffset : (entry.onum !== undefined ? entry.onum : entry.id));
        }

        this.emit('entry-selected', {
            entry,
            category: entry.category,
            data: entry.data
        });

        this.render();
    }

    /**
     * 表示対象エントリの取得
     * @private
     */
    _getFilteredEntries() {
        if (!this.manager) return [];

        let list = [];
        if (this.currentCategory === 'all') {
            list = [
                ...this.manager.getAllMonstersWithStatus(),
                ...this.manager.getAllObjectsWithStatus(),
                ...this.manager.getAllRumorsWithStatus()
            ];
        } else if (this.currentCategory === 'monster') {
            list = this.manager.getAllMonstersWithStatus();
        } else if (this.currentCategory === 'object') {
            list = this.manager.getAllObjectsWithStatus();
        } else if (this.currentCategory === 'rumor') {
            list = this.manager.getAllRumorsWithStatus();
        }

        // 状態フィルタ
        if (this.statusFilter === 'unlocked') {
            list = list.filter(e => e.isUnlocked);
        } else if (this.statusFilter === 'locked') {
            list = list.filter(e => !e.isUnlocked);
        } else if (this.statusFilter === 'new') {
            list = list.filter(e => e.isNew);
        }

        // 検索クエリフィルタ
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase().trim();
            list = list.filter(e => {
                if (!e.isUnlocked) return false;
                const name = (e.name || '').toLowerCase();
                const nameJa = (e.nameJa || '').toLowerCase();
                const text = (e.text || '').toLowerCase();
                const textJa = (e.textJa || '').toLowerCase();
                return name.includes(q) || nameJa.includes(q) || text.includes(q) || textJa.includes(q);
            });
        }

        return list;
    }

    render() {
        if (!this.shadowRoot) return;

        const viewport = this.shadowRoot.querySelector('.grid-viewport');
        const prevScrollTop = viewport ? viewport.scrollTop : 0;

        const progress = this.manager ? this.manager.getProgress() : {
            monsters: { unlocked: 0, total: 383, percentage: 0 },
            objects: { unlocked: 0, total: 481, percentage: 0 },
            rumors: { unlocked: 0, total: 787, percentage: 0 },
            overall: { unlocked: 0, total: 1651, percentage: 0 }
        };

        const currentProg = this.currentCategory === 'all' ? progress.overall :
            (this.currentCategory === 'monster' ? progress.monsters :
                (this.currentCategory === 'object' ? progress.objects : progress.rumors));

        const entries = this._getFilteredEntries();

        this.shadowRoot.innerHTML = `
            <style>${CODEX_GRID_CSS}</style>
            <div class="codex-container">
                <header class="codex-header">
                    <div class="header-top">
                        <div class="title-group">
                            <span class="header-icon">📖</span>
                            <h2 class="codex-title">冒険手帳 <span style="font-size:0.8rem; font-weight:normal; color:#94a3b8;">(Adventure Log)</span></h2>
                        </div>
                        <div class="progress-group">
                            <span class="progress-text">${currentProg.unlocked} / ${currentProg.total} (${currentProg.percentage}%)</span>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, currentProg.percentage))}%;"></div>
                            </div>
                        </div>
                    </div>

                    <div class="codex-toolbar">
                        <div class="tab-group">
                            <button class="tab-btn ${this.currentCategory === 'all' ? 'active' : ''}" data-cat="all">
                                すべて <span class="tab-badge">${progress.overall.unlocked}</span>
                            </button>
                            <button class="tab-btn ${this.currentCategory === 'monster' ? 'active' : ''}" data-cat="monster">
                                👾 モンスター <span class="tab-badge">${progress.monsters.unlocked}</span>
                            </button>
                            <button class="tab-btn ${this.currentCategory === 'object' ? 'active' : ''}" data-cat="object">
                                ⚔️ アイテム <span class="tab-badge">${progress.objects.unlocked}</span>
                            </button>
                            <button class="tab-btn ${this.currentCategory === 'rumor' ? 'active' : ''}" data-cat="rumor">
                                📜 噂・伝承 <span class="tab-badge">${progress.rumors.unlocked}</span>
                            </button>
                        </div>

                        <div class="filter-group">
                            <input type="text" class="search-input" placeholder="検索..." value="${this._escapeHtml(this.searchQuery)}">
                            <select class="select-filter">
                                <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>すべて</option>
                                <option value="unlocked" ${this.statusFilter === 'unlocked' ? 'selected' : ''}>解禁済み</option>
                                <option value="locked" ${this.statusFilter === 'locked' ? 'selected' : ''}>未遭遇・未識別</option>
                                <option value="new" ${this.statusFilter === 'new' ? 'selected' : ''}>NEW! のみ</option>
                            </select>
                        </div>
                    </div>
                </header>

                <main class="grid-viewport">
                    ${this._renderContent(entries)}
                </main>
            </div>
        `;

        this._bindEvents();

        if (prevScrollTop > 0) {
            const newViewport = this.shadowRoot.querySelector('.grid-viewport');
            if (newViewport) {
                newViewport.scrollTop = prevScrollTop;
            }
        }
    }

    /**
     * メインコンテンツのレンダリング
     * @private
     */
    _renderContent(entries) {
        if (entries.length === 0) {
            return `
                <div class="empty-state">
                    <span>🔍 該当するエントリが見つかりませんでした</span>
                </div>
            `;
        }

        if (this.currentCategory === 'rumor') {
            return `
                <div class="rumor-grid">
                    ${entries.map(e => this._renderRumorItem(e)).join('')}
                </div>
            `;
        }

        return `
            <div class="tile-grid">
                ${entries.map(e => this._renderTileItem(e)).join('')}
            </div>
        `;
    }

    /**
     * タイルアイテムのレンダリング
     * @private
     */
    _renderTileItem(entry) {
        const isLocked = !entry.isUnlocked;
        const isSelected = this.selectedEntryId === entry.id;
        const title = isLocked ? `No.${entry.monOffset !== undefined ? entry.monOffset : entry.onum} ???` : (entry.nameJa || entry.name);

        let iconHtml = '';
        if (entry.glyphId !== undefined) {
            const style = GlyphHelper.getGlyphStyle(entry.glyphId, {
                tileImage: this.tileImage,
                tileSize: 32,
                displaySize: 32
            });

            if (style) {
                const styleStr = Object.entries(style)
                    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
                    .join(';');
                iconHtml = `<span class="glyph-icon" style="${styleStr}"></span>`;
            }
        }

        if (!iconHtml) {
            const symbol = entry.symbol || (entry.category === 'monster' ? 'M' : '?');
            iconHtml = `<span class="text-symbol" style="font-size:20px; font-weight:bold;">${symbol}</span>`;
        }

        return `
            <div class="tile-item ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}"
                 data-entry-id="${entry.id}"
                 title="${this._escapeHtml(title)}">
                ${iconHtml}
                ${entry.isNew ? '<span class="new-badge">NEW</span>' : ''}
            </div>
        `;
    }

    _renderRumorItem(entry) {
        const isLocked = !entry.isUnlocked;
        const isSelected = this.selectedEntryId === entry.id;
        const isTrue = entry.isTrue !== undefined ? Boolean(entry.isTrue) : (entry.type === 'TRUE' || (entry.id && entry.id.includes('_tru_')));
        const related = (entry.data && Array.isArray(entry.data.relatedEntities)) ? entry.data.relatedEntities : [];

        return `
            <div class="rumor-item ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}"
                 data-entry-id="${entry.id}">
                <div class="rumor-left" style="flex: 1; flex-direction: column; align-items: flex-start; gap: 4px;">
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                        <span class="rumor-no">#${String(entry.index).padStart(3, '0')}</span>
                        <span class="rumor-text">${this._escapeHtml(entry.textJa || entry.text)}</span>
                    </div>
                    ${!isLocked && related.length > 0 ? `
                        <div style="display: flex; gap: 6px; margin-left: 60px; flex-wrap: wrap;">
                            ${related.map(rel => `
                                <span style="font-size: 0.72rem; background: rgba(56, 189, 248, 0.12); color: #38bdf8; padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.25);">
                                    🔗 ${this._escapeHtml(rel.nameJa || rel.name)}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                ${!isLocked ? `
                    <span class="rumor-type-badge ${isTrue ? 'badge-true' : 'badge-false'}">
                        ${isTrue ? '真の噂 (True)' : '偽の噂 (False)'}
                    </span>
                ` : ''}
                ${entry.isNew ? '<span class="new-badge" style="position:static; margin-left:8px;">NEW</span>' : ''}
            </div>
        `;
    }

    /**
     * イベントバインド
     * @private
     */
    _bindEvents() {
        if (!this.shadowRoot) return;

        // タブ切り替え
        this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-cat');
                if (cat) this.setCategory(cat);
            });
        });

        // 状態フィルタ
        const selectEl = this.shadowRoot.querySelector('.select-filter');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                this.statusFilter = e.target.value;
                this.render();
            });
        }

        // 検索インプット
        const searchInput = this.shadowRoot.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.render();
            });
        }

        // タイルクリック
        this.shadowRoot.querySelectorAll('.tile-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-entry-id');
                const entries = this._getFilteredEntries();
                const entry = entries.find(e => e.id === id);
                if (entry) this._handleEntryClick(entry);
            });
        });

        // 噂クリック
        this.shadowRoot.querySelectorAll('.rumor-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-entry-id');
                const entries = this._getFilteredEntries();
                const entry = entries.find(e => e.id === id);
                if (entry) this._handleEntryClick(entry);
            });
        });
    }

    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('nh-codex-grid')) {
    customElements.define('nh-codex-grid', NhCodexGrid);
}

export default NhCodexGrid;
