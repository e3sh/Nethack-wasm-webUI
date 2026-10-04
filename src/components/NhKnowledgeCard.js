/**
 * NhKnowledgeCard.js
 *
 * 3層統合ナレッジカード Web Component (<nh-knowledge-card>)
 *
 * 【3層統合ナレッジモデル】
 * - Layer 1: GKL 実用スペック & 識別解析 (危険度・AC/攻撃力・耐性・重量・材質・ネタバレ防止マスク)
 * - Layer 2: NetHack 公式 Lookup Information (WASM Cコア data.base の文学引用動的取得)
 * - Layer 3: 冒険の豆知識・伝承 (LoreCodex の Rumors 787件・真偽バッジ・神託・刻み文字)
 */

import { NhBaseElement } from './NhBaseElement.js';
import { findLoreForEntity } from '../core/knowledge/lore/LoreEntityCrossReference.js';
import { GlyphHelper } from '../core/renderers/GlyphHelper.js';
import { GLYPH_OFFSETS } from '../core/knowledge/engines/glyphClassifier.js';

const CARD_CSS = `
:host {
  display: block;
  font-family: var(--font-retro, 'Courier New', monospace);
  color: var(--text-color, #e2e8f0);
}

.knowledge-card {
  background: var(--glass-bg, rgba(15, 23, 42, 0.95));
  border: 1px solid var(--glass-border, rgba(56, 189, 248, 0.3));
  border-radius: var(--radius-lg, 12px);
  backdrop-filter: blur(var(--glass-blur, 16px));
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
  padding: 18px 22px;
  max-width: 640px;
  margin: 0 auto;
  box-sizing: border-box;
}

.card-header {
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
  gap: 12px;
}

.header-icon {
  font-size: 28px;
}

.header-glyph-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background-color: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  display: inline-block;
  vertical-align: middle;
}


.header-title-group {
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.card-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 2px;
}

.card-badges {
  display: flex;
  gap: 6px;
  align-items: center;
}

.badge {
  font-size: 0.72rem;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.badge-danger-safe { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
.badge-danger-low { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.4); }
.badge-danger-mid { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.4); }
.badge-danger-high { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.4); }
.badge-category { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
.badge-unidentified { background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.4); }

.card-close-btn {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
  border-radius: 6px;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.card-close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.5);
}

/* 3大タブナビゲーション */
.card-tabs {
  display: flex;
  gap: 4px;
  background: rgba(15, 23, 42, 0.6);
  padding: 4px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid rgba(148, 163, 184, 0.15);
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 8px 10px;
  font-size: 0.82rem;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.tab-btn:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

/* タブコンテンツ共通 */
.tab-content {
  min-height: 180px;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 4px;
}

.tab-content::-webkit-scrollbar {
  width: 6px;
}
.tab-content::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
}

/* Layer 1: 実用スペックグリッド */
.spec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.spec-item {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.15);
  padding: 8px 10px;
  border-radius: 6px;
}

.spec-label {
  font-size: 0.7rem;
  color: #94a3b8;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.spec-val {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f8fafc;
}

.spec-section-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #38bdf8;
  margin: 12px 0 6px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tactical-advice {
  background: rgba(56, 189, 248, 0.08);
  border-left: 3px solid #38bdf8;
  padding: 8px 12px;
  font-size: 0.82rem;
  line-height: 1.4;
  border-radius: 0 6px 6px 0;
  margin-top: 8px;
}

.danger-warning {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #f87171;
  color: #fca5a5;
  padding: 8px 12px;
  font-size: 0.82rem;
  border-radius: 0 6px 6px 0;
  margin-top: 8px;
}

/* Layer 2: 公式解説 (WASM) */
.official-wrapper {
  padding: 8px 4px;
}

.official-quote {
  font-style: italic;
  font-size: 0.88rem;
  line-height: 1.6;
  color: #e2e8f0;
  background: rgba(30, 41, 59, 0.4);
  padding: 14px 18px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  white-space: pre-wrap;
}

.official-source {
  margin-top: 10px;
  text-align: right;
  font-size: 0.75rem;
  color: #38bdf8;
  font-weight: 600;
}

.official-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #94a3b8;
  gap: 12px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(56, 189, 248, 0.2);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.official-empty {
  text-align: center;
  padding: 30px 10px;
  color: #64748b;
  font-size: 0.85rem;
}

/* Layer 3: 噂・豆知識 (LoreCodex) */
.lore-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lore-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 6px;
  padding: 10px 14px;
}

.lore-card.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.lore-card.clickable:hover {
  border-color: #38bdf8;
  background: rgba(30, 41, 59, 0.85);
  transform: translateY(-1px);
}

.lore-card.locked {
  opacity: 0.65;
  border-style: dashed;
}

.lore-badge-locked {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.lore-subtext {
  margin-top: 6px;
  font-size: 0.75rem;
  color: #94a3b8;
  font-style: italic;
  border-top: 1px dashed rgba(148, 163, 184, 0.15);
  padding-top: 4px;
}

.lore-card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 0.72rem;
}

.lore-badge-true { color: #4ade80; background: rgba(34, 197, 94, 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 700; }
.lore-badge-false { color: #f87171; background: rgba(239, 68, 68, 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 700; }
.lore-badge-rumor { color: #facc15; background: rgba(234, 179, 8, 0.15); padding: 2px 6px; border-radius: 4px; }
.lore-badge-oracle { color: #c084fc; background: rgba(192, 132, 252, 0.15); border: 1px solid rgba(192, 132, 252, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 700; }

.lore-locked-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.5);
  border: 1px dashed rgba(148, 163, 184, 0.25);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.8rem;
  color: #94a3b8;
}

.lore-text {
  font-size: 0.83rem;
  line-height: 1.45;
  color: #cbd5e1;
}

.card-footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: #64748b;
}

.footer-nav-hint {
  display: flex;
  gap: 12px;
}

.kbd {
  background: rgba(51, 65, 85, 0.6);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;
}
`;

export class NhKnowledgeCard extends NhBaseElement {
  static get observedAttributes() {
    return ['lang', 'active-tab'];
  }

  constructor() {
    super({ customCss: CARD_CSS });

    this.targetData = null;
    this.currentLanguage = 'ja';
    this.activeTab = 'spec'; // 'spec' | 'official' | 'lore'
    this.lookupService = null;
    this.loreCodex = null;
    this.adventureLogManager = null;
    this.unlockedOnly = false;
    this.tileImage = '../pict/nethack_default_32.png';

    // Layer 2 状態
    this.officialData = null;
    this.isOfficialLoading = false;
    this.officialError = null;

    // Layer 3 状態
    this.loreEntries = [];

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
    } else if (name === 'active-tab') {
      this.activeTab = newVal || 'spec';
      this.render();
    }
  }

  /**
   * 対象データを設定し、3層データをロード
   * @param {Object|string} targetData 
   * @param {Object} [options={}]
   * @param {Object} [options.lookupService]
   * @param {Object} [options.loreCodex]
   * @param {Object} [options.adventureLogManager]
   * @param {boolean} [options.unlockedOnly=false]
   * @param {string} [options.tileImage]
   * @param {string} [options.currentLanguage='ja']
   * @param {string} [options.activeTab='spec']
   */
  setTarget(targetData, options = {}) {
    this.targetData = targetData;
    if (options.lookupService) this.lookupService = options.lookupService;
    if (options.loreCodex) this.loreCodex = options.loreCodex;
    if (options.adventureLogManager) this.adventureLogManager = options.adventureLogManager;
    if (options.unlockedOnly !== undefined) this.unlockedOnly = options.unlockedOnly;
    if (options.tileImage) this.tileImage = options.tileImage;
    if (options.currentLanguage) this.currentLanguage = options.currentLanguage;
    if (options.activeTab) this.activeTab = options.activeTab;

    // 公式解説（Layer 2）の初期化と非同期フェッチ
    this.officialData = null;
    this.officialError = null;

    // Lore（Layer 3）の抽出
    this._resolveLoreEntries();

    this.render();

    // WASM動的取得（Layer 2）の開始
    this._fetchOfficialLookup();
  }

  /**
   * タイル画像パスのセット
   * @param {string} url 
   */
  setTileImage(url) {
    this.tileImage = url;
    this.render();
  }

  /**
   * 対象エンティティの Glyph ID を解決 (knowledge-inspector 準拠)
   * @param {Object} entity 
   * @returns {number}
   * @private
   */
  _resolveGlyphId(entity) {
    if (!entity) return -1;
    if (entity.glyphId !== undefined && entity.glyphId >= 0) return entity.glyphId;
    if (entity.glyph !== undefined && entity.glyph >= 0) return entity.glyph;

    const category = String(entity.category || '').toUpperCase();
    const isMonster = category === 'MONSTER' || entity.dangerLevel !== undefined || entity.threat !== undefined || entity.monOffset !== undefined;

    // 1. モンスター
    if (isMonster) {
      const monOffset = entity.monOffset ?? entity.knowledge?.monOffset ?? entity.stats?.monOffset ?? (entity.monNum !== undefined ? entity.monNum : null);
      if (monOffset !== null && monOffset !== undefined && monOffset >= 0) {
        return (GLYPH_OFFSETS?.GLYPH_MON_OFF ?? 0) + monOffset;
      }
    }

    // 2. アイテム
    const onum = entity.onum ?? entity.knowledge?.onum ?? entity.identification?.onum ??
      (typeof entity.id === 'string' && entity.id.startsWith('item_onum_') ? parseInt(entity.id.replace('item_onum_', ''), 10) : null);
    if (onum !== null && onum !== undefined && onum >= 0) {
      return (GLYPH_OFFSETS?.GLYPH_OBJ_OFF ?? 3448) + onum;
    }

    return -1;
  }


  /**
   * 公式解説サービスのセット
   * @param {Object} service 
   */
  setLookupService(service) {
    this.lookupService = service;
  }

  /**
   * 公式解説タブ（Layer 2）を表示すべきかどうかの判定 (WASM動的取得依存)
   * @returns {boolean}
   * @private
   */
  _shouldShowOfficialTab() {
    return Boolean(this.lookupService) && !this.hasAttribute('hide-official-tab') && !this.hasAttribute('offline-mode');
  }

  /**
   * 表示タブの切り替え
   * @param {'spec'|'official'|'lore'} tab 
   */
  setActiveTab(tab) {
    if (tab === 'official' && !this._shouldShowOfficialTab()) {
      return;
    }
    this.activeTab = tab;
    this.setAttribute('active-tab', tab);
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
   * ESC または q で閉じる、1/2/3 でタブ切替
   * @private
   */
  _handleKeyDown(e) {
    if (!this.targetData) return;

    if (e.key === 'Escape' || e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    } else if (e.key === '1') {
      this.setActiveTab('spec');
    } else if (e.key === '2') {
      if (this._shouldShowOfficialTab()) {
        this.setActiveTab('official');
      } else {
        this.setActiveTab('lore');
      }
    } else if (e.key === '3') {
      this.setActiveTab('lore');
    }
  }

  /**
   * カードを閉じるイベントを発行
   */
  close() {
    this.dispatchEvent(new CustomEvent('nh-close', {
      bubbles: true,
      composed: true,
      detail: { targetData: this.targetData }
    }));
  }

  /**
   * WASM公式解説の動的取得 (Layer 2)
   * @private
   */
  async _fetchOfficialLookup() {
    if (!this.targetData || !this.lookupService) {
      return;
    }

    const target = this.targetData;
    const targetLang = this.currentLanguage;

    // キャッシュチェック (即座にあればローディング表示不要)
    const cached = typeof this.lookupService.getCached === 'function' ? this.lookupService.getCached(target, { language: targetLang }) : null;
    if (cached) {
      this.officialData = cached;
      this.isOfficialLoading = false;
      this.render();
      return;
    }

    this.isOfficialLoading = true;
    this.render();

    try {
      const result = await this.lookupService.lookup(target, { language: targetLang });
      this.officialData = result;
    } catch (e) {
      this.officialError = e.message || 'Lookup failed';
    } finally {
      this.isOfficialLoading = false;
      this.render();

      this.dispatchEvent(new CustomEvent('nh-lookup-loaded', {
        bubbles: true,
        composed: true,
        detail: { data: this.officialData }
      }));
    }
  }

  /**
   * 検索対象名の抽出
   * @private
   */
  _getQueryTargetName() {
    if (!this.targetData) return null;
    if (typeof this.targetData === 'string') return this.targetData;
    const t = this.targetData;

    // 1. target.knowledge (インベントリやコンテナのアイテムスロット)
    if (t.knowledge) {
      const k = t.knowledge;
      const kName = k.nameEn || k.oc_name || k.english || k.trueName || k.rawName;
      if (kName) return kName;
    }

    // 2. target.identification (真名識別情報)
    if (t.identification) {
      const iden = t.identification;
      const idenName = iden.trueName || iden.rawName;
      if (idenName) return idenName;
    }

    // 3. トップレベル
    return t.nameEn || t.oc_name || t.english || t.trueName || t.rawName || t.name || null;
  }

  /**
   * 関連する噂や伝承を抽出 (Layer 3)
   * @private
   */
  _resolveLoreEntries() {
    this.loreEntries = [];
    if (!this.targetData) return;

    // 1. AdventureLogManager がある場合 (解禁状態を自動反映)
    if (this.adventureLogManager && typeof this.adventureLogManager.getRelatedLore === 'function') {
      this.loreEntries = this.adventureLogManager.getRelatedLore(this.targetData, {
        unlockedOnly: this.unlockedOnly
      }) || [];
      return;
    }

    // 2. LoreCodex がある場合
    if (this.loreCodex && typeof this.loreCodex.getRelatedLore === 'function') {
      this.loreEntries = this.loreCodex.getRelatedLore(this.targetData, {
        unlockedOnly: this.unlockedOnly
      }) || [];
      return;
    }

    // 3. targetData 自体に relatedLore 配列がある場合
    if (this.targetData.relatedLore && Array.isArray(this.targetData.relatedLore)) {
      this.loreEntries = this.targetData.relatedLore;
      return;
    }

    // 4. 逆引きエンジン (findLoreForEntity) による直接解決
    this.loreEntries = findLoreForEntity(this.targetData) || [];
  }


  render() {
    if (!this.shadowRoot) return;

    if (!this.targetData) {
      this.shadowRoot.innerHTML = '<div class="knowledge-card"><div class="official-empty">No Target Data</div></div>';
      return;
    }

    const isEn = this.currentLanguage === 'en';
    const data = typeof this.targetData === 'string' ? { name: this.targetData } : this.targetData;

    const nameJa = data.nameJa || data.knowledge?.nameJa || data.japanese || data.japaneseName;
    const nameEn = data.nameEn || data.trueName || data.name || data.knowledge?.name;
    const title = (!isEn && nameJa) ? `${nameJa}${nameEn ? ` (${nameEn})` : ''}` : (nameEn || data.name || (isEn ? 'Unknown Entity' : '未知の対象'));
    const category = String(data.category || (data.dangerLevel ? 'MONSTER' : 'ITEM')).toUpperCase();
    const isMonster = category === 'MONSTER' || Boolean(data.dangerLevel);
    let headerIcon = data.icon || '🏷️';
    if (isMonster) {
      headerIcon = '👾';
    } else if (category === 'ARMOR') {
      headerIcon = '🛡️';
    } else if (category === 'WEAPON') {
      headerIcon = '⚔️';
    } else if (category === 'POTION') {
      headerIcon = '🧪';
    } else if (category === 'SCROLL') {
      headerIcon = '📜';
    } else if (category === 'WAND') {
      headerIcon = '🪄';
    } else if (category === 'RING') {
      headerIcon = '💍';
    } else if (category === 'AMULET') {
      headerIcon = '📿';
    } else if (category === 'FOOD') {
      headerIcon = '🍖';
    } else if (category === 'TOOL' || category === 'CONTAINER') {
      headerIcon = '📦';
    }

    // タイル画像の解決 (knowledge-inspector 準拠)
    const glyphId = this._resolveGlyphId(data);
    let glyphStyleStr = '';
    if (glyphId >= 0) {
      const glyphStyle = GlyphHelper.getGlyphStyle(glyphId, {
        tileImage: this.tileImage,
        tileSize: 32,
        displaySize: 36
      });
      if (glyphStyle) {
        glyphStyleStr = Object.entries(glyphStyle)
          .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
          .join(';');
      }
    }

    const iconHtml = glyphStyleStr
      ? `<span class="header-glyph-icon" style="${glyphStyleStr}"></span>`
      : `<span class="header-icon">${headerIcon}</span>`;

    const showOfficial = this._shouldShowOfficialTab();
    if (!showOfficial && this.activeTab === 'official') {
      this.activeTab = 'spec';
    }

    this.shadowRoot.innerHTML = `
      <div class="knowledge-card" role="dialog" aria-modal="true" aria-label="${title}">
        <!-- ヘッダー -->
        <div class="card-header">
          <div class="header-left">
            ${iconHtml}
            <div class="header-title-group">
              <h2 class="card-title">${title}</h2>
              <div class="card-subtitle">${data.subtitle || data.japaneseName || (isEn ? category : this._translateCategory(category))}</div>
            </div>
          </div>
          <div class="card-badges">
            <span class="badge badge-category">${category}</span>
            ${data.dangerLevel ? `<span class="badge ${this._getDangerClass(data.dangerLevel)}">${data.dangerLevel}</span>` : ''}
            ${data.isUnidentified ? `<span class="badge badge-unidentified">${isEn ? 'Unidentified' : '未識別'}</span>` : ''}
            <button class="card-close-btn" id="closeBtn" title="${isEn ? 'Close (Esc / q)' : '閉じる (Esc / q)'}">✕</button>
          </div>
        </div>

        <!-- タブナビゲーション -->
        <div class="card-tabs" role="tablist">
          <button class="tab-btn ${this.activeTab === 'spec' ? 'active' : ''}" data-tab="spec" role="tab" aria-selected="${this.activeTab === 'spec'}">
            📊 ${isEn ? '1. Specs & Tactics' : '1. 実用スペック'}
          </button>
          ${showOfficial ? `
            <button class="tab-btn ${this.activeTab === 'official' ? 'active' : ''}" data-tab="official" role="tab" aria-selected="${this.activeTab === 'official'}">
              📖 ${isEn ? '2. Official Lore (WASM)' : '2. 公式解説 (WASM)'}
            </button>
          ` : ''}
          <button class="tab-btn ${this.activeTab === 'lore' ? 'active' : ''}" data-tab="lore" role="tab" aria-selected="${this.activeTab === 'lore'}">
            💡 ${isEn ? (showOfficial ? '3. Rumors' : '2. Rumors') : (showOfficial ? '3. 冒険の噂' : '2. 冒険の噂')} ${this.loreEntries.length > 0 ? `(${this.loreEntries.length})` : ''}
          </button>
        </div>

        <!-- タブコンテンツエリア -->
        <div class="tab-content">
          ${this._renderActiveTabContent(data, isEn)}
        </div>

        <!-- フッターガイド -->
        <div class="card-footer">
          <div class="footer-nav-hint">
            <span>${showOfficial ? '<span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span>' : '<span class="kbd">1</span><span class="kbd">2</span>'} ${isEn ? 'Switch Tab' : 'タブ切替'}</span>
            <span><span class="kbd">Esc</span> / <span class="kbd">q</span> ${isEn ? 'Close' : '閉じる'}</span>
          </div>
          <div>NetHack WebUI Knowledge Integration</div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  /**
   * アクティブタブに応じたHTML描画
   * @private
   */
  _renderActiveTabContent(data, isEn) {
    if (this.activeTab === 'spec') {
      return this._renderLayer1Spec(data, isEn);
    } else if (this.activeTab === 'official') {
      return this._renderLayer2Official(isEn);
    } else if (this.activeTab === 'lore') {
      return this._renderLayer3Lore(isEn);
    }
    return '';
  }

  /**
   * Layer 1: 実用スペック & 識別解析
   * @private
   */
  _renderLayer1Spec(data, isEn) {
    const isMonster = data.category === 'MONSTER' || Boolean(data.dangerLevel);

    if (isMonster) {
      const stats = data.stats || {};
      return `
        <div class="spec-grid">
          <div class="spec-item"><div class="spec-label">${isEn ? 'HD / Level' : 'レベル (HD)'}</div><div class="spec-val">${stats.hd ?? data.level ?? '-'}</div></div>
          <div class="spec-item"><div class="spec-label">${isEn ? 'AC' : 'AC (守備力)'}</div><div class="spec-val">${stats.ac ?? data.ac ?? '-'}</div></div>
          <div class="spec-item"><div class="spec-label">${isEn ? 'Speed' : '移動速度'}</div><div class="spec-val">${stats.speed ?? data.speed ?? '-'}</div></div>
          <div class="spec-item"><div class="spec-label">${isEn ? 'MR' : '魔法防御 (MR)'}</div><div class="spec-val">${stats.mr ?? data.mr ?? '-'}</div></div>
        </div>
        ${data.resistances && data.resistances.length > 0 ? `
          <div class="spec-section-title">🛡️ ${isEn ? 'Resistances' : '耐性属性'}</div>
          <div>${data.resistances.map(r => `<span class="badge badge-category" style="margin-right: 4px;">${this._formatResistance(r, isEn)}</span>`).join('')}</div>
        ` : ''}
        ${data.attacks && data.attacks.length > 0 ? `
          <div class="spec-section-title">⚔️ ${isEn ? 'Attacks' : '攻撃手段'}</div>
          <div>${data.attacks.map(a => `<span class="badge badge-danger-mid" style="margin-right: 4px;">${this._formatAttack(a, isEn)}</span>`).join('')}</div>
        ` : ''}
        ${data.warning ? `<div class="danger-warning">⚠️ ${data.warning}</div>` : ''}
        ${data.tacticalAdvice || data.effectSummary ? `
          <div class="tactical-advice">💡 ${data.tacticalAdvice || data.effectSummary}</div>
        ` : ''}
      `;
    }

    // アイテム・地形
    return `
      <div class="spec-grid">
        <div class="spec-item"><div class="spec-label">${isEn ? 'Category' : '種別'}</div><div class="spec-val">${data.category || '-'}</div></div>
        <div class="spec-item"><div class="spec-label">${isEn ? 'Weight' : '重量'}</div><div class="spec-val">${data.weight ?? '-'}</div></div>
        <div class="spec-item"><div class="spec-label">${isEn ? 'Material' : '材質'}</div><div class="spec-val">${data.material ?? '-'}</div></div>
        <div class="spec-item"><div class="spec-label">${isEn ? 'BUC Status' : '祝福状態'}</div><div class="spec-val">${data.bucStatus || (isEn ? 'Uncursed' : '通常')}</div></div>
      </div>
      ${data.appearance ? `
        <div class="spec-section-title">🎭 ${isEn ? 'Appearance' : 'ゲーム内での外見'}</div>
        <div style="font-size: 0.85rem; color: #f8fafc;">${data.appearance}</div>
      ` : ''}
      ${data.effectSummary || data.description ? `
        <div class="tactical-advice">💡 ${data.effectSummary || data.description}</div>
      ` : ''}
    `;
  }

  /**
   * Layer 2: WASM動的公式解説
   * @private
   */
  _renderLayer2Official(isEn) {
    if (this.isOfficialLoading) {
      return `
        <div class="official-loading">
          <div class="spinner"></div>
          <div>${isEn ? 'Querying NetHack C core data.base...' : 'WASM Cコア (data.base) より公式解説を抽出中...'}</div>
        </div>
      `;
    }

    if (this.officialData && this.officialData.found) {
      return `
        <div class="official-wrapper">
          <div class="official-quote">${this.officialData.text}</div>
          ${(!isEn && this.officialData.rawText && this.officialData.rawText !== this.officialData.text) ? `
            <details style="margin-top: 10px; font-size: 0.8rem; color: #94a3b8; border-top: 1px dashed rgba(148, 163, 184, 0.2); padding-top: 6px;">
              <summary style="cursor: pointer; color: #38bdf8; user-select: none;">🔍 英語原文 (Original English text)</summary>
              <div style="font-style: italic; margin-top: 6px; white-space: pre-wrap; color: #cbd5e1;">${this.officialData.rawText}</div>
            </details>
          ` : ''}
          <div class="official-source">📖 ${this.officialData.source || 'NetHack data.base'}</div>
        </div>
      `;
    }

    return `
      <div class="official-empty">
        <div>${isEn ? 'No official literature quote found in data.base.' : 'NetHack 公式 data.base に該当する文学解説はありません。'}</div>
      </div>
    `;
  }

  /**
   * Layer 3: 噂・豆知識 (LoreCodex)
   * @private
   */
  _renderLayer3Lore(isEn) {
    if (this.loreEntries.length === 0) {
      return `
        <div class="official-empty">
          <div>${isEn ? 'No related rumors recorded in LoreCodex yet.' : 'この対象に関する噂や伝承はまだ冒険手帳に記録されていません。'}</div>
        </div>
      `;
    }

    const unlockedEntries = this.loreEntries.filter(l => l.isUnlocked !== false);
    const lockedCount = this.loreEntries.filter(l => l.isUnlocked === false).length;

    if (unlockedEntries.length === 0 && lockedCount > 0) {
      return `
        <div class="official-empty">
          <div>🔒 ${isEn ? `${lockedCount} related rumor${lockedCount > 1 ? 's' : ''} not yet unlocked.` : `この対象に関する噂はまだ解禁されていません（未解禁: ${lockedCount}件）`}</div>
        </div>
      `;
    }

    return `
      <div class="lore-list">
        ${unlockedEntries.map((lore, idx) => {
          const isOracle = lore.category === 'ORACLE';
          const isTrue = lore.isTrue !== undefined ? Boolean(lore.isTrue) : (lore.type === 'TRUE');
          const isFalse = lore.isFalse !== undefined ? Boolean(lore.isFalse) : (lore.type === 'FALSE');
          const mainText = !isEn && (lore.translatedText || lore.textJa) ? (lore.translatedText || lore.textJa) : (lore.text || lore.rawText || '');
          const subText = (!isEn && lore.text && (lore.translatedText || lore.textJa)) ? lore.text : '';

          let badgeHtml = '';
          if (isOracle) {
            badgeHtml = `<span class="lore-badge-oracle">🏛️ ${isEn ? 'ORACLE' : '神託'}</span>`;
          } else if (isTrue) {
            badgeHtml = `<span class="lore-badge-true">${isEn ? '✓ TRUE RUMOR' : '✓ 真の噂'}</span>`;
          } else if (isFalse) {
            badgeHtml = `<span class="lore-badge-false">${isEn ? '✗ FALSE RUMOR' : '✗ 偽りの噂'}</span>`;
          } else {
            badgeHtml = `<span class="lore-badge-rumor">${isEn ? '? RUMOR' : '? 噂'}</span>`;
          }

          const entryNo = isOracle
            ? (lore.id ? `#${lore.id}` : (isEn ? 'Oracle' : '神託'))
            : (lore.index ? `#${String(lore.index).padStart(3, '0')}` : (lore.id || `No.${idx + 1}`));

          return `
            <div class="lore-card clickable" data-rumor-id="${lore.id || ''}" data-rumor-index="${lore.index || ''}" title="${isEn ? 'Click to jump to this lore' : 'クリックしてこの伝承を表示'}">
              <div class="lore-card-header">
                ${badgeHtml}
                <span>${entryNo}</span>
              </div>
              <div class="lore-text">「${mainText}」</div>
              ${subText ? `<div class="lore-subtext">"${subText}"</div>` : ''}
            </div>
          `;
        }).join('')}
        ${lockedCount > 0 ? `
          <div class="lore-locked-summary">
            <span>🔒</span>
            <span>${isEn ? `${lockedCount} related rumor${lockedCount > 1 ? 's' : ''} not yet unlocked` : `未解禁の噂: ${lockedCount}件`}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * イベントバインド
   * @private
   */
  _bindEvents() {
    if (!this.shadowRoot) return;

    // 閉じるボタン
    const closeBtn = this.shadowRoot.querySelector('#closeBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // タブ切り替えボタン
    const tabBtns = this.shadowRoot.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.setActiveTab(tab);
      });
    });

    // 噂カードのクリックイベント（手帳や一覧へのジャンプ連携）
    const rumorCards = this.shadowRoot.querySelectorAll('.lore-card.clickable');
    rumorCards.forEach(card => {
      card.addEventListener('click', () => {
        const rumorId = card.getAttribute('data-rumor-id');
        const rumorIndex = card.getAttribute('data-rumor-index');
        const lore = this.loreEntries.find(l => l.id === rumorId) || null;
        this.dispatchEvent(new CustomEvent('nh-rumor-selected', {
          bubbles: true,
          composed: true,
          detail: {
            rumorId,
            index: rumorIndex ? parseInt(rumorIndex, 10) : undefined,
            lore
          }
        }));
      });
    });
  }

  _getDangerClass(danger) {
    if (!danger) return 'badge-danger-low';
    const d = danger.toUpperCase();
    if (d === 'SAFE') return 'badge-danger-safe';
    if (d === 'HIGH' || d === 'CRITICAL' || d === 'EXTREME' || d === 'LETHAL') return 'badge-danger-high';
    if (d === 'MID' || d === 'MEDIUM') return 'badge-danger-mid';
    return 'badge-danger-low';
  }

  /**
   * 攻撃手段オブジェクトまたは文字列をフォーマット
   * @param {Object|string} a
   * @param {boolean} isEn
   * @returns {string}
   * @private
   */
  _formatAttack(a, isEn) {
    if (!a) return '';
    if (typeof a === 'string') return a;

    const ATTACK_TYPE_MAP = {
      'bite': { ja: '噛みつき', en: 'Bite' },
      'claw': { ja: 'ひっかき', en: 'Claw' },
      'butt': { ja: '頭突き', en: 'Headbutt' },
      'touch': { ja: '接触', en: 'Touch' },
      'gaze': { ja: '凝視', en: 'Gaze' },
      'breath': { ja: 'ブレス', en: 'Breath' },
      'brea': { ja: 'ブレス', en: 'Breath' },
      'spit': { ja: '毒液吐き', en: 'Spit' },
      'engulf': { ja: '丸呑み', en: 'Engulf' },
      'weapon': { ja: '武器攻撃', en: 'Weapon' },
      'weap': { ja: '武器攻撃', en: 'Weapon' },
      'hit': { ja: '打撃', en: 'Hit' },
      'weapon/hit': { ja: '通常打撃', en: 'Hit' },
      'sting': { ja: '刺突', en: 'Sting' },
      'hug': { ja: '締め付け', en: 'Hug' },
      'kick': { ja: '蹴り', en: 'Kick' },
      'cast': { ja: '呪文詠唱', en: 'Cast' },
      'magc': { ja: '呪文詠唱', en: 'Cast' },
      'spell': { ja: '呪文詠唱', en: 'Spell' },
      'pass': { ja: 'すり抜け', en: 'Pass' },
      'boom': { ja: '自爆', en: 'Explode' },
      'explode': { ja: '爆発', en: 'Explode' },
      'tentacle': { ja: '触手', en: 'Tentacle' }
    };

    const ATTACK_EFFECT_MAP = {
      'poison': { ja: '毒', en: 'Poison' },
      'fire': { ja: '火炎', en: 'Fire' },
      'cold': { ja: '冷気', en: 'Cold' },
      'elec': { ja: '電撃', en: 'Elec' },
      'acid': { ja: '酸', en: 'Acid' },
      'sleep': { ja: '睡眠', en: 'Sleep' },
      'paralysis': { ja: '麻痺', en: 'Paralysis' },
      'drain': { ja: 'ドレイン', en: 'Drain' },
      'drain_level': { ja: 'レベル低下', en: 'Level Drain' },
      'drain_energy': { ja: '魔力吸収', en: 'Energy Drain' },
      'drain_dex': { ja: '器用さ低下', en: 'Dexterity Drain' },
      'drain_con': { ja: '耐久力低下', en: 'Constitution Drain' },
      'brain_eat': { ja: '脳喰らい', en: 'Brain Eat' },
      'stone': { ja: '石化', en: 'Stoning' },
      'stoning': { ja: '石化', en: 'Stoning' },
      'blind': { ja: '盲目', en: 'Blind' },
      'disenchant': { ja: '魔法弱体化', en: 'Disenchant' },
      'rust': { ja: '錆', en: 'Rust' },
      'rot': { ja: '腐食', en: 'Rot' },
      'slow': { ja: '減速', en: 'Slow' },
      'hallu': { ja: '幻覚', en: 'Hallucination' },
      'steal': { ja: '盗み', en: 'Steal' },
      'steal_gold': { ja: '金盗み', en: 'Steal Gold' },
      'steal_item': { ja: 'アイテム盗み', en: 'Steal Item' },
      'steal_amulet': { ja: '魔除け強奪', en: 'Steal Amulet' },
      'seduce': { ja: '誘惑', en: 'Seduce' },
      'teleport': { ja: 'テレポート', en: 'Teleport' },
      'digest': { ja: '消化', en: 'Digest' },
      'drown': { ja: '溺死', en: 'Drown' },
      'wrap': { ja: '巻きつき', en: 'Wrap' },
      'lycanthropy': { ja: '獣化感染', en: 'Lycanthropy' },
      'disease': { ja: '病気感染', en: 'Disease' },
      'pestilence': { ja: 'ペスト', en: 'Pestilence' },
      'famine': { ja: '飢餓', en: 'Famine' },
      'death': { ja: '即死', en: 'Death' },
      'slime': { ja: 'スライム化', en: 'Slime' },
      'polymorph': { ja: '変身', en: 'Polymorph' },
      'clerical_spell': { ja: '僧侶呪文', en: 'Clerical Spell' },
      'magic_spell': { ja: '攻撃魔法', en: 'Magic Spell' },
      'random_breath': { ja: 'ランダムブレス', en: 'Random Breath' },
      'curse': { ja: 'アイテム呪い', en: 'Curse' },
      'leg_wound': { ja: '足負傷', en: 'Leg Wound' },
      'confuse': { ja: '混乱', en: 'Confuse' },
      'stun': { ja: '朦朧', en: 'Stun' },
      'stick': { ja: '粘着', en: 'Sticky' },
      'heal': { ja: '回復', en: 'Heal' },
      'magic_missile': { ja: '魔法の矢', en: 'Magic Missile' },
      'disintegration': { ja: '分解', en: 'Disintegration' }
    };

    const typeKey = (a.type || '').toLowerCase();
    const effectKey = (a.effect || '').toLowerCase();

    const typeLabel = ATTACK_TYPE_MAP[typeKey]?.[isEn ? 'en' : 'ja'] || a.type || (isEn ? 'Attack' : '攻撃');
    const effectLabel = ATTACK_EFFECT_MAP[effectKey]?.[isEn ? 'en' : 'ja'] || a.effect;
    const damageStr = a.damage ? ` [${a.damage}]` : '';

    if (effectLabel && effectLabel.toLowerCase() !== typeLabel.toLowerCase()) {
      return `${typeLabel}: ${effectLabel}${damageStr}`;
    }
    return `${typeLabel}${damageStr}`;
  }

  /**
   * 耐性文字列をフォーマット
   * @param {string} r
   * @param {boolean} isEn
   * @returns {string}
   * @private
   */
  _formatResistance(r, isEn) {
    if (!r || typeof r !== 'string') return String(r || '');
    if (isEn) {
      return r.charAt(0).toUpperCase() + r.slice(1);
    }
    const RESIST_MAP = {
      'fire': '耐火',
      'cold': '耐冷',
      'elec': '耐電',
      'shock': '耐電撃',
      'sleep': '耐睡眠',
      'poison': '耐毒',
      'acid': '耐酸',
      'stone': '耐石化',
      'stoning': '耐石化',
      'disint': '耐分解',
      'disintegration': '耐分解',
      'magic': '魔法防御',
      'drain': '耐ドレイン',
      'hallu': '耐幻覚'
    };
    return RESIST_MAP[r.toLowerCase()] || r;
  }

  _translateCategory(cat) {
    const map = {
      MONSTER: 'モンスター',
      ITEM: '道具/アイテム',
      WEAPON: '武器',
      ARMOR: '防具',
      POTION: '薬/ポーション',
      SCROLL: '巻物',
      WAND: '杖',
      RING: '指輪',
      AMULET: '魔除け',
      TOOL: '道具',
      FOOD: '食料',
      TERRAIN: '地形/構造物'
    };
    return map[cat] || cat;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('nh-knowledge-card')) {
  customElements.define('nh-knowledge-card', NhKnowledgeCard);
}
