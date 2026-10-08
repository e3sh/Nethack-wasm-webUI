/**
 * NhPortalNav.js
 * 
 * ポータル共通ナビゲーションバー Web Component (<nh-portal-nav>)
 * - 各画面間移動メニュー（タイトル戻る、タブグループ、言語切替）を統合
 * - PortalState と連動し、言語切替時にメニュー文言を即座に自動反映
 * - 画面側の対応なしでも常に正確な日英表示を提供
 */

import { PortalState } from '../../core/portal/PortalState.js';

const I18N = {
    ja: {
        backTitle: '← タイトルへ戻る',
        langToggle: '🌐 English',
        inspectorBtn: '🔍 Debug Inspector'
    },
    en: {
        backTitle: '← Back to Title',
        langToggle: '🌐 日本語',
        inspectorBtn: '🔍 Debug Inspector'
    }
};

const NAV_GROUPS = {
    user: [
        { id: 'scoreboard', file: 'scoreboard.html', accent: 'accent-gold', ja: '🏆 殿堂・スコアボード', en: '🏆 Hall of Fame' },
        { id: 'adventure_log', file: 'adventure_log.html', accent: 'accent-blue', ja: '👣 冒険手帳 (Log)', en: '👣 Adventure Log' },
        { id: 'config', file: 'config.html', accent: 'accent-green', ja: '⚙️ システム設定', en: '⚙️ System Config' },
        { id: 'save_manager', file: 'save_manager.html', accent: 'accent-blue', ja: '💾 セーブデータ管理', en: '💾 Save Data Manager' }
    ],
    dev: [
        { id: 'cltest', file: 'cltest.html', accent: 'accent-purple', ja: '🧪 クライアント検証', en: '🧪 Client Test Portal' },
        { id: 'dev_tools', file: 'dev_tools.html', accent: 'accent-purple', ja: '🛠️ 開発者ツール一覧', en: '🛠️ All Dev Tools' }
    ],
    knowledge: [
        { id: 'inspector', file: 'knowledge-inspector.html', accent: 'accent-blue', ja: '🔍 構造化図鑑', en: '🔍 Knowledge Inspector' },
        { id: 'codex', file: 'lore_codex.html', accent: 'accent-gold', ja: '📜 伝承アーカイブ', en: '📜 Rumor & Lore Codex' },
        { id: 'adventure_log_dev', file: 'adventure_log.html?dev=1', accent: 'accent-blue', ja: '👣 冒険ログ', en: '👣 Adventure Log' }
    ]
};

const BaseClass = typeof HTMLElement !== 'undefined' 
    ? HTMLElement 
    : class MockHTMLElement {
        constructor() {
            this.attributes = new Map();
        }
        getAttribute(name) { return this.attributes.get(name) || null; }
        setAttribute(name, val) { this.attributes.set(name, String(val)); }
        hasAttribute(name) { return this.attributes.has(name); }
        removeAttribute(name) { this.attributes.delete(name); }
        querySelector() { return null; }
    };

export class NhPortalNav extends BaseClass {
    static get observedAttributes() {
        return ['group', 'active', 'root-href', 'tools-base', 'hide-lang-toggle', 'hide-back-btn'];
    }

    constructor() {
        super();
        this._onLangChanged = this._onLangChanged.bind(this);
    }

    connectedCallback() {
        window.addEventListener('nh-lang-changed', this._onLangChanged);
        this.render();
    }

    disconnectedCallback() {
        window.removeEventListener('nh-lang-changed', this._onLangChanged);
    }

    attributeChangedCallback() {
        this.render();
    }

    _onLangChanged() {
        this.render();
    }

    render() {
        const isJp = PortalState.isJapanese();
        const t = isJp ? I18N.ja : I18N.en;

        const groupKey = this.getAttribute('group') || 'user';
        const activeId = this.getAttribute('active') || '';
        const rootHref = this.getAttribute('root-href') || '../index.html';
        const toolsBase = this.getAttribute('tools-base') || './';
        const hideLangToggle = this.hasAttribute('hide-lang-toggle') && this.getAttribute('hide-lang-toggle') !== 'false';
        const hideBackBtn = this.hasAttribute('hide-back-btn') && this.getAttribute('hide-back-btn') !== 'false';

        const items = NAV_GROUPS[groupKey] || NAV_GROUPS.user;

        // タブ項目の構築
        const tabItemsHtml = items.map(item => {
            const isActive = item.id === activeId;
            const activeClass = isActive ? ` active ${item.accent}` : '';
            const label = isJp ? item.ja : item.en;
            const href = `${toolsBase}${item.file}`;
            return `<a href="${href}" class="nav-pill-item nav-tab-item${activeClass}" data-nav-id="${item.id}">${label}</a>`;
        }).join('');

        // Inspector ボタン（開発グループ時のみ付与）
        let extraActionHtml = '';
        if (groupKey === 'dev') {
            extraActionHtml = `
                <button type="button" class="btn btn-blue nav-pill-item" id="nh-nav-btn-inspector" style="font-size: 13px; cursor: pointer; padding: 6px 12px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 9px;">
                    ${t.inspectorBtn}
                </button>
            `;
        }

        // 言語切替ボタン
        const langToggleHtml = hideLangToggle ? '' : `
            <button type="button" class="nav-pill-item" id="nh-nav-lang-toggle" style="cursor: pointer; background: rgba(255, 255, 255, 0.06); border: 1px solid var(--border-color, rgba(255,255,255,0.15)); border-radius: 9px; padding: 6px 14px; font-weight: 600; font-family: inherit;">
                ${t.langToggle}
            </button>
        `;

        // 戻るボタン
        const backBtnHtml = hideBackBtn ? '' : `
            <a href="${rootHref}" class="nav-back-btn" id="nh-nav-back-btn">
                ${t.backTitle}
            </a>
        `;

        this.innerHTML = `
            <nav class="portal-nav portal-nav-wide header-nav nav-bar" style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                    ${backBtnHtml}
                    <div class="nav-pill-group nav-tabs-group">
                        ${tabItemsHtml}
                    </div>
                    ${extraActionHtml}
                </div>
                <div class="nav-actions" style="display: flex; align-items: center; gap: 10px;">
                    ${langToggleHtml}
                </div>
            </nav>
        `;

        // イベントバインド
        const langBtn = this.querySelector('#nh-nav-lang-toggle');
        if (langBtn) {
            langBtn.addEventListener('click', (e) => {
                e.preventDefault();
                PortalState.toggleLanguage();
            });
        }

        const inspectorBtn = this.querySelector('#nh-nav-btn-inspector');
        if (inspectorBtn) {
            inspectorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const inspectorPath = `${toolsBase}../src/core/inspector/inspector_console.html`;
                window.open(inspectorPath, 'WebUICoreInspectorConsole', 'width=920,height=720,resizable=yes,scrollbars=yes');
            });
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get('nh-portal-nav')) {
    customElements.define('nh-portal-nav', NhPortalNav);
}
