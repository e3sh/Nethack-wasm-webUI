/**
 * NhDiscoveryCodex.js
 *
 * ディスカバリー図鑑 Web Component (<nh-discovery-codex>) (Gap 1 対応)
 *
 * 【設計思想】
 * 1. Cコアの `\`（Known objects）から蓄積された DiscoveryStateManager のデータを美麗な対照カタログとして可視化。
 * 2. 真名（True Name）、外見（Appearance in this dungeon）、プレイヤー仮名（Called Name）を一覧照合。
 * 3. カテゴリ切り替え（薬・巻物・杖・指輪・魔除け・魔法書）およびリアルタイムインクリメンタル検索。
 * 4. アイテム選択時に nh-item-select イベントを発行し、<nh-knowledge-card> へシームレス連携。
 */

import { NhBaseElement } from './NhBaseElement.js';

const DISCOVERY_CSS = `
:host {
  display: block;
  font-family: var(--font-retro, 'Courier New', monospace);
  color: var(--text-color, #e2e8f0);
}

.discovery-container {
  background: var(--glass-bg, rgba(15, 23, 42, 0.95));
  border: 1px solid var(--glass-border, rgba(56, 189, 248, 0.3));
  border-radius: var(--radius-lg, 12px);
  backdrop-filter: blur(var(--glass-blur, 16px));
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
  padding: 18px 22px;
  max-width: 680px;
  margin: 0 auto;
  box-sizing: border-box;
}

.discovery-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding-bottom: 12px;
  margin-bottom: 14px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 24px;
}

.discovery-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.discovery-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 2px;
}

.close-btn {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.5);
}

/* 検索バー ＆ カテゴリタブ */
.filter-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  padding: 7px 12px;
  color: #f8fafc;
  font-size: 0.85rem;
  outline: none;
  font-family: inherit;
}

.search-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
}

.category-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 12px;
}

.cat-btn {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  color: #94a3b8;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  font-weight: 600;
  transition: all 0.15s ease;
}

.cat-btn:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.05);
}

.cat-btn.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.4);
}

/* カタログリスト */
.catalog-list {
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}

.catalog-list::-webkit-scrollbar {
  width: 6px;
}
.catalog-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

.catalog-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 6px;
  padding: 9px 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.catalog-item:hover {
  background: rgba(56, 189, 248, 0.12);
  border-color: rgba(56, 189, 248, 0.35);
  transform: translateX(2px);
}

.item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-truename {
  font-size: 0.9rem;
  font-weight: 700;
  color: #f8fafc;
}

.item-subname {
  font-size: 0.78rem;
  font-weight: 400;
  color: #94a3b8;
  margin-left: 6px;
}

.item-appearance {
  font-size: 0.76rem;
  color: #38bdf8;
}

.item-called {
  font-size: 0.73rem;
  color: #facc15;
  font-style: italic;
}

.item-badge-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-discovered {
  font-size: 0.7rem;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.4);
}

.badge-called {
  font-size: 0.7rem;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(234, 179, 8, 0.2);
  color: #facc15;
  border: 1px solid rgba(250, 204, 21, 0.4);
}

.badge-spec {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.35);
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 40px 10px;
  color: #64748b;
  font-size: 0.85rem;
}

.discovery-footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: #64748b;
}

.kbd {
  background: rgba(51, 65, 85, 0.6);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
}
`;

export class NhDiscoveryCodex extends NhBaseElement {
  static get observedAttributes() {
    return ['lang'];
  }

  constructor() {
    super({ customCss: DISCOVERY_CSS });

    this.discoveryManager = null;
    this.currentLanguage = 'ja';
    this.selectedCategory = 'all'; // 'all' | 'potion' | 'scroll' | 'wand' | 'ring' | 'amulet' | 'spellbook'
    this.searchQuery = '';
    this.items = [];

    this._boundKeyDown = this._handleKeyDown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._boundKeyDown);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._boundKeyDown);
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'lang') {
      this.currentLanguage = newVal === 'en' ? 'en' : 'ja';
      this.render();
    }
  }

  /**
   * DiscoveryStateManager をセットし、データをロード
   * @param {Object} discoveryManager 
   */
  setDiscoveryManager(discoveryManager) {
    this.discoveryManager = discoveryManager;
    this._refreshItems();
    this.render();
  }

  /**
   * 直接アイテムリストを設定 (モック・外部テスト用)
   * @param {Array<Object>} items 
   */
  setItems(items) {
    this.items = items || [];
    this.render();
  }

  /**
   * 言語の切り替え
   * @param {'ja'|'en'} lang 
   */
  setLanguage(lang) {
    this.currentLanguage = lang === 'en' ? 'en' : 'ja';
    this.setAttribute('lang', this.currentLanguage);
    this.render();
  }

  /**
   * カテゴリフィルタの選択
   * @param {string} cat 
   */
  setCategory(cat) {
    this.selectedCategory = cat;
    this.render();
  }

  /**
   * 検索クエリのセット
   * @param {string} query 
   */
  setSearchQuery(query) {
    this.searchQuery = query || '';
    this.render();
  }

  /**
   * 閉じる
   */
  close() {
    this.dispatchEvent(new CustomEvent('nh-close', {
      bubbles: true,
      composed: true
    }));
  }

  _handleKeyDown(e) {
    if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') {
      // 検索入力フォーカス中の Esc は検索クリア、非フォーカス時は閉じる
      const searchEl = this.shadowRoot?.querySelector('.search-input');
      if (document.activeElement === searchEl && e.key === 'Escape') {
        this.searchQuery = '';
        this.render();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  _refreshItems() {
    if (!this.discoveryManager) {
      this.items = [];
      return;
    }

    const dm = this.discoveryManager;
    if (typeof dm.getDiscoveredItems === 'function') {
      this.items = dm.getDiscoveredItems();
      return;
    }

    const items = [];

    // appearanceMap から生成 (例: "ruby" -> "potion of healing")
    if (dm.appearanceMap) {
      for (const [app, trueName] of dm.appearanceMap.entries()) {
        const calledName = dm.calledNamesMap?.get(app) || dm.calledNamesMap?.get(trueName.toLowerCase()) || null;
        items.push({
          trueName,
          appearance: app,
          calledName,
          category: this._inferCategory(trueName, app),
          isDiscovered: true
        });
      }
    }

    // calledNamesMap だけに存在する仮名アイテムの追加
    if (dm.calledNamesMap) {
      for (const [key, calledName] of dm.calledNamesMap.entries()) {
        const already = items.some(it => it.appearance === key || it.trueName.toLowerCase() === key);
        if (!already) {
          items.push({
            trueName: key,
            appearance: key,
            calledName,
            category: this._inferCategory(key, ''),
            isDiscovered: false
          });
        }
      }
    }

    this.items = items;
  }

  _inferCategory(trueName, app) {
    const t = (trueName || '').toLowerCase();
    const a = (app || '').toLowerCase();

    // 防具・鎧判定 (ring mail 等を最優先で防具へ)
    if (/\bmail\b/i.test(t) || /\b(armor|shield|helmet|helm|boots|gloves|cloak|suit)\b/i.test(t)) return 'armor';

    // 武器判定
    if (/\b(sword|blade|dagger|knife|bow|arrow|axe|spear|mace|flail|dart|shuriken|polearm)\b/i.test(t)) return 'weapon';

    // ランダム外見カテゴリ (単語境界判定)
    if (/\bpotion\b/i.test(t) || /\bpotion\b/i.test(a)) return 'potion';
    if (/\bscroll\b/i.test(t) || /\bscroll\b/i.test(a)) return 'scroll';
    if (/\bwand\b/i.test(t) || /\bwand\b/i.test(a)) return 'wand';
    if (/\bring\b/i.test(t) || /\bring\b/i.test(a)) return 'ring';
    if (/\bamulet\b/i.test(t) || /\bamulet\b/i.test(a)) return 'amulet';
    if (/\b(spellbook|book)\b/i.test(t) || /\b(spellbook|book)\b/i.test(a)) return 'spellbook';

    // 食料・道具
    if (/\b(food|corpse|meat|ration|apple|pear|slime)\b/i.test(t)) return 'food';
    if (/\b(lamp|lantern|key|lock|horn|whistle|bell|bag|box|chest|towel|mirror)\b/i.test(t)) return 'tool';

    return 'other';
  }

  render() {
    if (!this.shadowRoot) return;

    const isEn = this.currentLanguage === 'en';
    const filtered = this._getFilteredItems();

    const categories = [
      { id: 'all', label: isEn ? 'All' : 'すべて' },
      { id: 'potion', label: isEn ? 'Potions' : '薬 (Potion)' },
      { id: 'scroll', label: isEn ? 'Scrolls' : '巻物 (Scroll)' },
      { id: 'wand', label: isEn ? 'Wands' : '杖 (Wand)' },
      { id: 'ring', label: isEn ? 'Rings' : '指輪 (Ring)' },
      { id: 'amulet', label: isEn ? 'Amulets' : '魔除け (Amulet)' },
      { id: 'spellbook', label: isEn ? 'Spellbooks' : '魔法書 (Book)' },
      { id: 'armor', label: isEn ? 'Armor' : '防具 (Armor)' },
      { id: 'weapon', label: isEn ? 'Weapons' : '武器 (Weapon)' },
      { id: 'tool', label: isEn ? 'Tools' : '道具 (Tool)' },
      { id: 'food', label: isEn ? 'Food' : '食料 (Food)' }
    ];

    this.shadowRoot.innerHTML = `
      <div class="discovery-container" role="dialog" aria-modal="true" aria-label="${isEn ? 'Discoveries Codex' : 'ディスカバリー図鑑'}">
        <!-- ヘッダー -->
        <div class="discovery-header">
          <div class="header-left">
            <span class="header-icon">📜</span>
            <div>
              <h2 class="discovery-title">${isEn ? 'Discoveries Codex' : 'ディスカバリー図鑑 (発見物アーカイブ)'}</h2>
              <div class="discovery-subtitle">${isEn ? 'Known true names and appearances in this world' : 'この世界で判明した真名・外見・仮名対照カタログ'}</div>
            </div>
          </div>
          <button class="close-btn" id="closeBtn" title="${isEn ? 'Close (Esc / q)' : '閉じる (Esc / q)'}">✕</button>
        </div>

        <!-- 検索バー -->
        <div class="filter-bar">
          <input
            type="text"
            class="search-input"
            id="searchInput"
            placeholder="${isEn ? 'Search by true name, appearance, or called name...' : '真名・日本語名・外見名・仮名でリアルタイム絞り込み...'}"
            value="${this.searchQuery}"
          />
        </div>

        <!-- カテゴリタブ -->
        <div class="category-tabs" role="tablist">
          ${categories.map(c => `
            <button
              class="cat-btn ${this.selectedCategory === c.id ? 'active' : ''}"
              data-cat="${c.id}"
              role="tab"
              aria-selected="${this.selectedCategory === c.id}"
            >${c.label}</button>
          `).join('')}
        </div>

        <!-- カタログリスト -->
        <div class="catalog-list">
          ${filtered.length === 0 ? `
            <div class="empty-state">${isEn ? 'No discoveries matched.' : '該当する発見済みアイテムはありません。'}</div>
          ` : filtered.map(item => {
            const displayName = (!isEn && item.nameJa) ? item.nameJa : item.trueName;
            const subName = (!isEn && item.nameJa && item.trueName && item.nameJa !== item.trueName) ? item.trueName : '';
            let appearanceText = '';
            if (item.appearance) {
              if (!isEn && item.appearanceJa && item.appearanceJa !== item.appearance) {
                appearanceText = `${item.appearanceJa} (${item.appearance})`;
              } else {
                appearanceText = item.appearance;
              }
            }

            // 実用スペックタグの算出 (武器: 威力, 防具: AC 等)
            let specBadge = '';
            if (item.isDiscovered && item.knowledge) {
              const k = item.knowledge;
              const stats = k.stats || {};
              const cat = (k.category || item.category || '').toLowerCase();
              if (cat === 'weapon') {
                const sdam = k.sdam || stats.sdam;
                const ldam = k.ldam || stats.ldam;
                if (sdam) {
                  specBadge = `<span class="badge-spec">⚔️ ${sdam}/${ldam || sdam}</span>`;
                }
              } else if (cat === 'armor') {
                const ac = k.ac ?? stats.ac;
                if (ac !== undefined && ac !== null && ac !== 0) {
                  specBadge = `<span class="badge-spec">🛡️ AC +${ac}</span>`;
                }
              }
            }

            return `
            <div class="catalog-item" data-name="${item.trueName}">
              <div class="item-main">
                <div class="item-truename">
                  ${displayName}
                  ${subName ? `<span class="item-subname">(${subName})</span>` : ''}
                </div>
                ${appearanceText ? `<div class="item-appearance">🎭 ${appearanceText}</div>` : ''}
                ${item.calledName ? `<div class="item-called">🏷️ called "${item.calledName}"</div>` : ''}
              </div>
              <div class="item-badge-group">
                ${specBadge}
                <span class="${item.isDiscovered ? 'badge-discovered' : 'badge-called'}">
                  ${item.isDiscovered ? (isEn ? 'DISCOVERED' : '識別済み') : (isEn ? 'CALLED' : '仮名')}
                </span>
                <span style="color: #64748b; font-size: 0.8rem;">➔</span>
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <!-- フッター -->
        <div class="discovery-footer">
          <div><span class="kbd">Esc</span> / <span class="kbd">q</span> ${isEn ? 'Close' : '閉じる'}</div>
          <div>${isEn ? 'Click item to open 3-Tier Knowledge Card' : '項目クリックで3層統合ナレッジカードを表示'}</div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _getFilteredItems() {
    let result = [...this.items];

    // カテゴリ絞り込み
    if (this.selectedCategory !== 'all') {
      result = result.filter(it => it.category === this.selectedCategory);
    }

    // 検索クエリ絞り込み
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(it =>
        (it.nameJa && it.nameJa.toLowerCase().includes(q)) ||
        (it.trueName && it.trueName.toLowerCase().includes(q)) ||
        (it.appearance && it.appearance.toLowerCase().includes(q)) ||
        (it.calledName && it.calledName.toLowerCase().includes(q))
      );
    }

    return result;
  }

  _bindEvents() {
    if (!this.shadowRoot) return;

    // 閉じるボタン
    const closeBtn = this.shadowRoot.querySelector('#closeBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // カテゴリタブ
    const catBtns = this.shadowRoot.querySelectorAll('.cat-btn');
    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat');
        if (cat) this.setCategory(cat);
      });
    });

    // 検索入力
    const searchInput = this.shadowRoot.querySelector('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
        const el = this.shadowRoot.querySelector('#searchInput');
        if (el) {
          el.focus();
          el.selectionStart = el.selectionEnd = el.value.length;
        }
      });
    }

    // アイテムクリック
    const catalogItems = this.shadowRoot.querySelectorAll('.catalog-item');
    catalogItems.forEach(el => {
      el.addEventListener('click', () => {
        const name = el.dataset?.name || el.getAttribute('data-name');
        const item = this.items.find(it => it.trueName === name);
        if (item) {
          this.dispatchEvent(new CustomEvent('nh-item-select', {
            bubbles: true,
            composed: true,
            detail: { item }
          }));
        }
      });
    });
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('nh-discovery-codex')) {
  customElements.define('nh-discovery-codex', NhDiscoveryCodex);
}
