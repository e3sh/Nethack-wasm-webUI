/**
 * CodexModal.js - 冒険手帳 (Rumor & Lore Codex) クライアントモーダル
 *
 * 【設計思想】
 * セッション横断の伝承アーカイブ（噂話・神託・床文字・墓碑銘）を
 * 省スペースな「Master-Detail (コンパクト一覧 ＋ 選択1件のみ詳細カード)」構造で提示する。
 * ゲーム内言語 (JP/EN) に完全連動し、リアルタイム検索・真偽フィルタ・全マスタ閲覧に対応。
 */

// 多言語リソース辞書 (i18n)
const CODEX_I18N = {
    ja: {
        brandTitle: 'RUMOR & LORE CODEX',
        brandSubtitle: '冒険手帳 (伝承アーカイブ)',
        lblSumRumor: '噂話 総収集率:',
        lblSumTrue: '真実 (TRUE):',
        lblSumFalse: '偽り (FALSE):',
        lblSumOracle: '神託 (ORACLE):',
        lblSumEngr: '床文字:',
        unitItems: '件',
        tabRumors: '📜 噂話 (Rumors)',
        tabOracles: '🔮 神託 (Oracles)',
        tabEngravings: '🏛️ 床文字・落書き (Engravings)',
        searchPlaceholder: "英和キーワード検索 (例: 'plate', '指輪', 'Elbereth')...",
        filterAll: 'すべて',
        filterTrue: '✅ 真実のみ',
        filterFalse: '❌ 偽りのみ',
        filterGraffiti: '🏛️ 落書き',
        filterHeadstone: '🪦 墓碑銘',
        filterElbereth: '🛡️ Elbereth',
        detailEmpty: '左側のリストから項目を選択すると、<br>完全な英和テキストと詳細情報が表示されます。',
        emptyTabMsg: 'まだ記録がありません。<br>フォーチュンクッキーを食べたり、神託を聞いたり、床文字を読むとここに記録されます。',
        emptyFilterMsg: '条件に一致する記録が見つかりませんでした。',
        btnMarkAllRead: 'すべて既読',
        badgeNew: '✨ NEW',
        badgeTrue: 'TRUE',
        badgeFalse: 'FALSE',
        badgeOracle: 'ORACLE',
        badgeGraffiti: '🏛️ 落書',
        badgeHeadstone: '🪦 墓碑',
        badgeElbereth: '🛡️ 結界',
        truthBadgeTrue: '✅ 真実の噂 (TRUE)',
        truthBadgeFalse: '❌ 偽りの噂 (FALSE)',
        truthBadgeOracle: '🔮 デルフィの大預言 (ORACLE)',
        badgeHeadstoneCard: '🪦 墓碑銘 (HEADSTONE)',
        badgeElberethCard: '🛡️ 魔除けの結界 (ELBERETH)',
        badgeGraffitiCard: '🏛️ 床の落書き (ENGRAVING)',
        encounters: '遭遇回数:',
        lblActualScuffed: '読取時のかすれ文字 (ACTUAL):',
        lblTranslation: '日本語訳 (TRANSLATION):',
        lblTranslationEnNote: '日本語参考訳 (JAPANESE TRANSLATION):',
        noTranslation: '（日本語訳データ未登録）',
        lblMetaMedium: '入手媒体',
        lblMetaOrigin: '元ネタ・引用出典',
        lblMetaStatus: '状態',
        lblMetaCategory: '分類',
        statusCollected: '✅ 獲得済み',
        srcDelphi: 'デルフィ神託所',
        srcFloor: '床文字',
        srcCookie: 'フォーチュンクッキー',
        srcPaper: '床の紙片',
        srcEngraving: '床の刻み文字',
        srcHeadstone: '墓碑銘 (Headstone)',
        srcElbereth: 'Elbereth (魔除けの結界文字)',
        lblRelatedEntities: '🔗 関連する知識・対象 (Related Knowledge):',
        specClose: '✕ 閉じる',
        specDanger: '危険度:',
        specCategory: '分類:',
        specStats: '基礎値:',
        specAdvice: '戦術助言 / 効果:'
    },
    en: {
        brandTitle: 'RUMOR & LORE CODEX',
        brandSubtitle: 'Adventure Codex & Lore Archive',
        lblSumRumor: 'Rumors Collected:',
        lblSumTrue: 'True Rumors:',
        lblSumFalse: 'False Rumors:',
        lblSumOracle: 'Oracles:',
        lblSumEngr: 'Engravings:',
        unitItems: 'entries',
        tabRumors: '📜 Rumors',
        tabOracles: '🔮 Oracles',
        tabEngravings: '🏛️ Engravings',
        searchPlaceholder: "Search by keyword (e.g. 'plate', 'ring', 'Elbereth')...",
        filterAll: 'All',
        filterTrue: '✅ True Only',
        filterFalse: '❌ False Only',
        filterGraffiti: '🏛️ Graffiti',
        filterHeadstone: '🪦 Headstone',
        filterElbereth: '🛡️ Elbereth',
        detailEmpty: 'Select an item from the list on the left<br>to view its full text and details.',
        emptyTabMsg: 'No lore recorded yet.<br>Explore the dungeon, eat fortune cookies, consult the Oracle, or read floor engravings to collect lore.',
        emptyFilterMsg: 'No matching entries found.',
        btnMarkAllRead: 'Mark All Read',
        badgeNew: '✨ NEW',
        badgeTrue: 'TRUE',
        badgeFalse: 'FALSE',
        badgeOracle: 'ORACLE',
        badgeGraffiti: '🏛️ Engr',
        badgeHeadstone: '🪦 Grave',
        badgeElbereth: '🛡️ Ward',
        truthBadgeTrue: '✅ True Rumor (TRUE)',
        truthBadgeFalse: '❌ False Rumor (FALSE)',
        truthBadgeOracle: '🔮 Major Oracle of Delphi',
        badgeHeadstoneCard: '🪦 Headstone Inscription',
        badgeElberethCard: '🛡️ Ward of Elbereth',
        badgeGraffitiCard: '🏛️ Dungeon Graffiti',
        encounters: 'Encounters:',
        lblActualScuffed: 'Scuffed / Rubbed text read (ACTUAL):',
        lblTranslation: 'Japanese Translation (Reference):',
        lblTranslationEnNote: 'Japanese Translation (Reference):',
        noTranslation: '(No translation registered)',
        lblMetaMedium: 'Medium / Source',
        lblMetaOrigin: 'Origin / Reference',
        lblMetaStatus: 'Status',
        lblMetaCategory: 'Category',
        statusCollected: '✅ Collected',
        srcDelphi: 'Oracle of Delphi',
        srcFloor: 'Floor Engraving',
        srcCookie: 'Fortune Cookie',
        srcPaper: 'Scrap of Paper',
        srcEngraving: 'Floor Engraving',
        srcHeadstone: 'Headstone Inscription',
        srcElbereth: 'Ward of Elbereth',
        lblRelatedEntities: '🔗 Related Knowledge:',
        specClose: '✕ Close',
        specDanger: 'Danger:',
        specCategory: 'Category:',
        specStats: 'Stats:',
        specAdvice: 'Tactics / Effect:'
    }
};

export class CodexModal {
    /**
     * @param {Object} options
     * @param {HTMLElement} [options.elCodexModal] - モーダル外枠DOM
     * @param {Function} options.getCore - WebUICore取得関数
     * @param {Function} [options.onClose] - モーダル閉鎖時コールバック
     */
    constructor(options = {}) {
        this.options = options;
        this.elCodexModal = options.elCodexModal || document.getElementById('codex-modal');
        this.getCore = options.getCore || (() => null);
        this.onClose = options.onClose || (() => {});
        this.onUnreadCountChanged = options.onUnreadCountChanged || (() => {});
        this.knowledgeEngine = options.knowledgeEngine || null;

        this.currentLanguage = 'ja';
        this.isVisible = false;
        this.activeTab = 'rumors';
        this.currentRumorFilter = 'ALL';
        this.currentEngrFilter = 'ALL';
        this.selectedItem = null;
        this.selectedEntitySpec = null;
        this._currentItems = [];

        this.readIds = this.loadReadIds();
        this._subscribed = false;
        this.setupDOM();
    }

    /**
     * 構造化ナレッジエンジンの取得
     * @returns {Object|null}
     */
    getKnowledgeEngine() {
        if (this.knowledgeEngine) return this.knowledgeEngine;
        const core = this.getCore();
        if (core && typeof core.getKnowledgeEngine === 'function') {
            return core.getKnowledgeEngine();
        }
        return null;
    }

    /**
     * 既読IDの読み込み (localStorage)
     */
    loadReadIds() {
        try {
            if (typeof localStorage !== 'undefined') {
                const raw = localStorage.getItem('nethack_codex_read_ids');
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) return new Set(arr);
                }
            }
        } catch (e) {
            // ignore
        }
        return new Set();
    }

    /**
     * 既読IDの保存 (localStorage)
     */
    saveReadIds() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('nethack_codex_read_ids', JSON.stringify(Array.from(this.readIds)));
            }
        } catch (e) {
            // ignore
        }
    }

    /**
     * 指定アイテムが未読かどうか
     */
    isUnread(item) {
        if (!item || !item.id) return false;
        return !this.readIds.has(item.id);
    }

    /**
     * 単一アイテムを既読化
     * @param {string} id
     */
    markAsRead(id) {
        if (!id || this.readIds.has(id)) return;
        this.readIds.add(id);
        this.saveReadIds();

        // リスト項目のNEWバッジと未読クラスを即座に更新
        const listEl = this.elCodexModal.querySelector('#codex-master-list');
        if (listEl) {
            const itemEls = listEl.querySelectorAll(`.codex-list-item[data-id="${id}"]`);
            itemEls.forEach(el => {
                el.classList.remove('is-unread');
                const badge = el.querySelector('.badge-new');
                if (badge) badge.remove();
            });
        }

        this.updateUnreadBadges();
        this.notifyUnreadCount();
    }

    /**
     * すべての獲得済み伝承を既読化
     */
    markAllAsRead() {
        const core = this.getCore();
        const codex = core?.getLoreCodex();
        if (!codex) return;

        const allItems = [
            ...(codex.getRumors() || []),
            ...(codex.getOracles() || []),
            ...(codex.getEngravings() || [])
        ];

        for (const item of allItems) {
            if (item.id) this.readIds.add(item.id);
        }
        this.saveReadIds();

        this.renderList();
        this.updateUnreadBadges();
        this.notifyUnreadCount();
    }

    /**
     * 各カテゴリおよび全体の未読件数を取得
     */
    getUnreadCounts() {
        const core = this.getCore();
        const codex = core?.getLoreCodex();
        if (!codex) {
            return { total: 0, rumors: 0, oracles: 0, engravings: 0 };
        }

        const countUnread = (items = []) => {
            return items.filter(i => i && i.id && !this.readIds.has(i.id)).length;
        };

        const rumors = countUnread(codex.getRumors());
        const oracles = countUnread(codex.getOracles());
        const engravings = countUnread(codex.getEngravings());
        const total = rumors + oracles + engravings;

        return { total, rumors, oracles, engravings };
    }

    /**
     * タブ上およびモーダル内の未読バッジ要素を更新
     */
    updateUnreadBadges() {
        if (!this.elCodexModal) return;
        const counts = this.getUnreadCounts();

        const updateTabBadge = (sel, count) => {
            const el = this.elCodexModal.querySelector(sel);
            if (!el) return;
            if (count > 0) {
                el.textContent = count > 99 ? '99+' : count;
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        };

        updateTabBadge('#codex-unread-tab-rumors', counts.rumors);
        updateTabBadge('#codex-unread-tab-oracles', counts.oracles);
        updateTabBadge('#codex-unread-tab-engravings', counts.engravings);

        const btnMarkAll = this.elCodexModal.querySelector('#btn-codex-mark-all-read');
        if (btnMarkAll) {
            btnMarkAll.style.display = counts.total > 0 ? 'inline-flex' : 'none';
        }
    }

    /**
     * Codex の変更リスナーを確実に購読 (モーダルを開く前でも常時受信可能にする)
     */
    _ensureSubscribed() {
        const core = this.getCore();
        const codex = core?.getLoreCodex();
        if (codex && this._subscribedCodex !== codex) {
            const onUpdate = () => {
                this.notifyUnreadCount();
                if (this.isVisible) {
                    this.updateSummaryBar();
                    this.renderList();
                    this.renderDetail();
                    this.updateUnreadBadges();
                }
            };
            if (typeof codex.subscribe === 'function') {
                codex.subscribe(onUpdate);
            } else if (typeof codex.on === 'function') {
                codex.on('updated', onUpdate);
            }
            this._subscribedCodex = codex;
            this._subscribed = true;
        }
    }

    /**
     * 初期化・未読件数即時反映
     */
    init() {
        this._ensureSubscribed();
        this.notifyUnreadCount();
    }

    /**
     * 外部リスナーへ未読件数変更を通知
     */
    notifyUnreadCount() {
        this._ensureSubscribed();
        const counts = this.getUnreadCounts();
        if (typeof this.onUnreadCountChanged === 'function') {
            this.onUnreadCountChanged(counts.total, counts);
        }
    }

    /**
     * DOM要素のバインドとイベントリスナー設定
     */
    setupDOM() {
        if (!this.elCodexModal) return;

        // イベント委譲で各種ボタンを監視
        this.elCodexModal.addEventListener('click', (e) => {
            if (e.target.closest('#btn-codex-close') || e.target.classList.contains('codex-modal-backdrop')) {
                this.close();
            }
        });

        // すべて既読ボタン
        const btnMarkAll = this.elCodexModal.querySelector('#btn-codex-mark-all-read');
        if (btnMarkAll) {
            btnMarkAll.addEventListener('click', () => this.markAllAsRead());
        }

        // 検索入力リスナー
        const searchInput = this.elCodexModal.querySelector('#codex-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.applyFilters());
        }

        // タブボタン
        const tabRumors = this.elCodexModal.querySelector('#codex-tab-rumors');
        const tabOracles = this.elCodexModal.querySelector('#codex-tab-oracles');
        const tabEngravings = this.elCodexModal.querySelector('#codex-tab-engravings');
        if (tabRumors) tabRumors.addEventListener('click', () => this.switchTab('rumors'));
        if (tabOracles) tabOracles.addEventListener('click', () => this.switchTab('oracles'));
        if (tabEngravings) tabEngravings.addEventListener('click', () => this.switchTab('engravings'));

        // 噂話フィルタ
        const filterAll = this.elCodexModal.querySelector('#codex-filter-all');
        const filterTrue = this.elCodexModal.querySelector('#codex-filter-true');
        const filterFalse = this.elCodexModal.querySelector('#codex-filter-false');
        if (filterAll) filterAll.addEventListener('click', () => this.setRumorFilter('ALL'));
        if (filterTrue) filterTrue.addEventListener('click', () => this.setRumorFilter('TRUE'));
        if (filterFalse) filterFalse.addEventListener('click', () => this.setRumorFilter('FALSE'));

        // 床文字フィルタ
        const engrAll = this.elCodexModal.querySelector('#codex-engr-all');
        const engrGraffiti = this.elCodexModal.querySelector('#codex-engr-graffiti');
        const engrHeadstone = this.elCodexModal.querySelector('#codex-engr-headstone');
        const engrElbereth = this.elCodexModal.querySelector('#codex-engr-elbereth');
        if (engrAll) engrAll.addEventListener('click', () => this.setEngrFilter('ALL'));
        if (engrGraffiti) engrGraffiti.addEventListener('click', () => this.setEngrFilter('ENGRAVING'));
        if (engrHeadstone) engrHeadstone.addEventListener('click', () => this.setEngrFilter('HEADSTONE'));
        if (engrElbereth) engrElbereth.addEventListener('click', () => this.setEngrFilter('ELBERETH'));
    }

    /**
     * 表示言語の同期設定
     * @param {'ja'|'en'} lang
     */
    setLanguage(lang) {
        this.currentLanguage = lang === 'en' ? 'en' : 'ja';
        if (this.isVisible) {
            this.applyLanguageUI();
            this.updateSummaryBar();
            this.renderList();
            this.renderDetail();
        }
    }

    /**
     * モーダルを開く
     */
    open() {
        if (!this.elCodexModal) return;
        this.isVisible = true;
        this.elCodexModal.classList.remove('hidden');

        // Codex の変更リスナーを購読
        this._ensureSubscribed();

        this.applyLanguageUI();
        this.updateSummaryBar();
        this.renderList();
        this.renderDetail();
        this.updateUnreadBadges();
        this.notifyUnreadCount();
    }

    /**
     * モーダルを閉じる
     */
    close() {
        if (!this.isVisible) return;
        this.isVisible = false;
        if (this.elCodexModal) {
            this.elCodexModal.classList.add('hidden');
        }
        if (typeof this.onClose === 'function') {
            this.onClose();
        }
    }

    /**
     * モーダル表示中判定
     */
    isOpen() {
        return this.isVisible;
    }

    /**
     * UIテキストの言語切り替え反映
     */
    applyLanguageUI() {
        if (!this.elCodexModal) return;
        const t = CODEX_I18N[this.currentLanguage];

        const setText = (selector, text) => {
            const el = this.elCodexModal.querySelector(selector);
            if (el) el.textContent = text;
        };
        const setHtml = (selector, html) => {
            const el = this.elCodexModal.querySelector(selector);
            if (el) el.innerHTML = html;
        };

        setText('#codex-brand-title', t.brandTitle);
        setText('#codex-brand-subtitle', t.brandSubtitle);
        setText('#codex-mark-read-label', t.btnMarkAllRead);

        setText('#codex-lbl-sum-rumor', t.lblSumRumor);
        setText('#codex-lbl-sum-true', t.lblSumTrue);
        setText('#codex-lbl-sum-false', t.lblSumFalse);
        setText('#codex-lbl-sum-oracle', t.lblSumOracle);
        setText('#codex-lbl-sum-engr', t.lblSumEngr);

        setText('#codex-txt-tab-rumors', t.tabRumors);
        setText('#codex-txt-tab-oracles', t.tabOracles);
        setText('#codex-txt-tab-engravings', t.tabEngravings);

        const searchInput = this.elCodexModal.querySelector('#codex-search-input');
        if (searchInput) searchInput.placeholder = t.searchPlaceholder;

        setText('#codex-filter-all', t.filterAll);
        setText('#codex-filter-true', t.filterTrue);
        setText('#codex-filter-false', t.filterFalse);

        setText('#codex-engr-all', t.filterAll);
        setText('#codex-engr-graffiti', t.filterGraffiti);
        setText('#codex-engr-headstone', t.filterHeadstone);
        setText('#codex-engr-elbereth', t.filterElbereth);

        setHtml('#codex-detail-empty', t.detailEmpty);
    }

    /**
     * 総計サマリーバーの更新
     */
    updateSummaryBar() {
        if (!this.elCodexModal) return;
        const core = this.getCore();
        const codex = core?.getLoreCodex();
        const stats = codex ? codex.getStats() : {
            rumors: { collected: 0, total: 787, percentage: 0, trueCount: 0, totalTrue: 390, falseCount: 0, totalFalse: 397 },
            oracles: { collected: 0, total: 20, percentage: 0 },
            engravings: { collected: 0 }
        };
        const t = CODEX_I18N[this.currentLanguage];

        const setText = (id, text) => {
            const el = this.elCodexModal.querySelector(id);
            if (el) el.textContent = text;
        };

        setText('#codex-sum-rumor-ratio', `${stats.rumors.collected} / ${stats.rumors.total}`);
        setText('#codex-sum-rumor-pct', `(${stats.rumors.percentage}%)`);
        const bar = this.elCodexModal.querySelector('#codex-sum-rumor-bar');
        if (bar) bar.style.width = `${stats.rumors.percentage}%`;

        setText('#codex-sum-true-ratio', `${stats.rumors.trueCount} / ${stats.rumors.totalTrue}`);
        setText('#codex-sum-false-ratio', `${stats.rumors.falseCount} / ${stats.rumors.totalFalse}`);
        setText('#codex-sum-oracle-ratio', `${stats.oracles.collected} / ${stats.oracles.total}`);
        setText('#codex-sum-engr-count', `${stats.engravings?.collected || 0} ${t.unitItems}`);

        setText('#codex-badge-rumors', stats.rumors.collected);
        setText('#codex-badge-oracles', stats.oracles.collected);
        setText('#codex-badge-engravings', stats.engravings?.collected || 0);
    }

    /**
     * タブ切り替え
     * @param {'rumors'|'oracles'|'engravings'} tab
     */
    switchTab(tab) {
        this.activeTab = tab;
        this.selectedItem = null;

        const tabs = this.elCodexModal.querySelectorAll('.codex-nav-tab');
        tabs.forEach(t => t.classList.remove('active'));

        const tabEl = this.elCodexModal.querySelector(`#codex-tab-${tab}`);
        if (tabEl) tabEl.classList.add('active');

        const filtersRumor = this.elCodexModal.querySelector('#codex-filters-rumor');
        const filtersEngr = this.elCodexModal.querySelector('#codex-filters-engraving');
        if (filtersRumor) filtersRumor.classList.toggle('hidden', tab !== 'rumors');
        if (filtersEngr) filtersEngr.classList.toggle('hidden', tab !== 'engravings');

        const searchInput = this.elCodexModal.querySelector('#codex-search-input');
        if (searchInput) searchInput.value = '';

        this.renderList();
        this.renderDetail();
    }

    setRumorFilter(filter) {
        this.currentRumorFilter = filter;
        const chips = this.elCodexModal.querySelectorAll('#codex-filters-rumor .codex-chip');
        chips.forEach(c => c.classList.remove('active'));
        const chip = this.elCodexModal.querySelector(`#codex-filter-${filter.toLowerCase()}`);
        if (chip) chip.classList.add('active');
        this.renderList();
    }

    setEngrFilter(filter) {
        this.currentEngrFilter = filter;
        const chips = this.elCodexModal.querySelectorAll('#codex-filters-engraving .codex-chip');
        chips.forEach(c => c.classList.remove('active'));
        const chipMap = { 'ALL': 'all', 'ENGRAVING': 'graffiti', 'HEADSTONE': 'headstone', 'ELBERETH': 'elbereth' };
        const chip = this.elCodexModal.querySelector(`#codex-engr-${chipMap[filter]}`);
        if (chip) chip.classList.add('active');
        this.renderList();
    }

    applyFilters() {
        this.renderList();
    }

    /**
     * 一覧リストの描画 (Master List)
     */
    renderList() {
        const listEl = this.elCodexModal.querySelector('#codex-master-list');
        if (!listEl) return;

        const q = (this.elCodexModal.querySelector('#codex-search-input')?.value || '').toLowerCase().trim();
        const t = CODEX_I18N[this.currentLanguage];
        const isEn = this.currentLanguage === 'en';
        const core = this.getCore();
        const codex = core?.getLoreCodex();

        let items = [];

        if (this.activeTab === 'rumors') {
            if (codex) {
                items = codex.getRumors().map(i => ({
                    ...i,
                    category: 'RUMOR',
                    collected: true
                }));
            }
            if (this.currentRumorFilter === 'TRUE') items = items.filter(i => i.isTrue);
            if (this.currentRumorFilter === 'FALSE') items = items.filter(i => !i.isTrue);

        } else if (this.activeTab === 'oracles') {
            if (codex) {
                items = codex.getOracles().map(i => ({
                    ...i,
                    category: 'ORACLE',
                    collected: true
                }));
            }
        } else if (this.activeTab === 'engravings') {
            if (codex) {
                items = codex.getEngravings().map(i => ({
                    ...i,
                    collected: true
                }));
                if (this.currentEngrFilter !== 'ALL') {
                    items = items.filter(i => i.category === this.currentEngrFilter);
                }
            }
        }

        // 検索絞り込み (英和双方)
        if (q) {
            items = items.filter(i => {
                const tEn = (i.text || i.actualText || '').toLowerCase();
                const tJp = (i.translatedText || i.title || '').toLowerCase();
                const id = (i.id || '').toLowerCase();
                return tEn.includes(q) || tJp.includes(q) || id.includes(q);
            });
        }

        if (items.length === 0) {
            const hasAnyInTab = (this.activeTab === 'rumors' ? codex?.getRumors()?.length :
                                 this.activeTab === 'oracles' ? codex?.getOracles()?.length :
                                 codex?.getEngravings()?.length) > 0;
            const emptyMsg = hasAnyInTab ? t.emptyFilterMsg : t.emptyTabMsg;

            listEl.innerHTML = `
                <div style="padding:48px 16px; text-align:center; color:var(--text-muted); font-size:13px; line-height:1.6;">
                    ${emptyMsg}
                </div>
            `;
            this._currentItems = [];
            this.selectedItem = null;
            this.renderDetail();
            return;
        }

        // 選択アイテムの同期
        if (this.selectedItem) {
            const found = items.find(i => (i.id && i.id === this.selectedItem.id) || (i.text && i.text === this.selectedItem.text));
            if (found) this.selectedItem = found;
            else this.selectedItem = null;
        }
        if (!this.selectedItem && items.length > 0) {
            this.selectedItem = items[0];
        }

        listEl.innerHTML = items.map((item, idx) => {
            const isSel = this.selectedItem && ((item.id && item.id === this.selectedItem.id) || (item.text && item.text === this.selectedItem.text));
            const unread = this.isUnread(item);
            const itemClass = [isSel ? 'codex-list-item selected' : 'codex-list-item', unread ? 'is-unread' : ''].filter(Boolean).join(' ');

            let badgeHtml = '';
            if (item.category === 'RUMOR' || item.isTrue !== undefined) {
                badgeHtml = item.isTrue
                    ? `<span class="codex-item-badge badge-true">${t.badgeTrue}</span>`
                    : `<span class="codex-item-badge badge-false">${t.badgeFalse}</span>`;
            } else if (item.category === 'ORACLE' || item.title) {
                badgeHtml = `<span class="codex-item-badge badge-oracle">${t.badgeOracle}</span>`;
            } else {
                const sub = item.isHeadstone ? t.badgeHeadstone : (item.category === 'ELBERETH' ? t.badgeElbereth : t.badgeGraffiti);
                badgeHtml = `<span class="codex-item-badge badge-engr">${sub}</span>`;
            }

            const newBadgeHtml = unread ? `<span class="codex-item-badge badge-new">${t.badgeNew}</span>` : '';
            const snippet = this.escapeHtml(item.title || item.text || item.actualText || '');
            const transSnippet = this.escapeHtml(item.translatedText || '');
            const seen = item.seenCount ? `x${item.seenCount}` : '';

            const transRowHtml = (!isEn && transSnippet)
                ? `<div class="codex-item-trans-snippet">${transSnippet}</div>`
                : '';

            return `
                <div class="${itemClass}" data-idx="${idx}" data-id="${this.escapeHtml(item.id || '')}">
                    <div style="display:flex; align-items:center;">
                        ${badgeHtml}
                        ${newBadgeHtml}
                    </div>
                    <div class="codex-item-info">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="codex-item-id">${this.escapeHtml(item.id || '')}</span>
                            <span class="codex-item-meta">${seen}</span>
                        </div>
                        <div class="codex-item-snippet">${snippet}</div>
                        ${transRowHtml}
                    </div>
                </div>
            `;
        }).join('');

        this._currentItems = items;

        // 初期選択アイテムを既読化
        if (this.selectedItem && this.selectedItem.id) {
            this.markAsRead(this.selectedItem.id);
        }

        // リスト行クリックハンドラ
        listEl.querySelectorAll('.codex-list-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.getAttribute('data-idx'), 10);
                if (!isNaN(idx) && this._currentItems[idx]) {
                    const chosen = this._currentItems[idx];
                    this.selectedItem = chosen;
                    this.selectedEntitySpec = null;
                    if (chosen.id) {
                        this.markAsRead(chosen.id);
                    }
                    listEl.querySelectorAll('.codex-list-item').forEach((itemEl, i) => {
                        itemEl.classList.toggle('selected', i === idx);
                    });
                    this.renderDetail();
                }
            });
        });

        this.renderDetail();
        this.updateUnreadBadges();
    }

    /**
     * 選択アイテムの詳細カード描画 (Detail Card)
     */
    renderDetail() {
        const emptyEl = this.elCodexModal.querySelector('#codex-detail-empty');
        const cardEl = this.elCodexModal.querySelector('#codex-detail-card');
        if (!emptyEl || !cardEl) return;

        const t = CODEX_I18N[this.currentLanguage];
        const isEn = this.currentLanguage === 'en';

        if (!this.selectedItem) {
            emptyEl.classList.remove('hidden');
            cardEl.classList.add('hidden');
            return;
        }

        emptyEl.classList.add('hidden');
        cardEl.classList.remove('hidden');

        const item = this.selectedItem;
        let truthBadge = '';
        if (item.category === 'RUMOR' || item.isTrue !== undefined) {
            truthBadge = item.isTrue
                ? `<span class="codex-item-badge badge-true" style="font-size:12px; padding:3px 8px;">${t.truthBadgeTrue}</span>`
                : `<span class="codex-item-badge badge-false" style="font-size:12px; padding:3px 8px;">${t.truthBadgeFalse}</span>`;
        } else if (item.category === 'ORACLE' || item.title) {
            truthBadge = `<span class="codex-item-badge badge-oracle" style="font-size:12px; padding:3px 8px;">${t.truthBadgeOracle}</span>`;
        } else {
            const sub = item.isHeadstone ? t.badgeHeadstoneCard : (item.category === 'ELBERETH' ? t.badgeElberethCard : t.badgeGraffitiCard);
            truthBadge = `<span class="codex-item-badge badge-engr" style="font-size:12px; padding:3px 8px;">${sub}</span>`;
        }

        const headerHtml = `
            <div class="codex-detail-title-group">
                <div>${truthBadge}</div>
                ${item.title ? `<div style="font-size:15px; font-weight:700; color:var(--accent-gold); margin-top:4px;">${this.escapeHtml(item.title)}</div>` : ''}
            </div>
            <div style="text-align:right;">
                <div class="codex-detail-id">${this.escapeHtml(item.id || '')}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    ${item.seenCount ? `${t.encounters} <b>x${item.seenCount}</b>` : ''}
                </div>
            </div>
        `;

        const actualScuffedHtml = (item.actualText && item.actualText !== item.text) ? `
            <div style="background:#111620; border:1px dashed var(--accent-gold); border-radius:6px; padding:8px 12px; font-size:12px;">
                <div style="color:var(--text-muted); font-size:10px; margin-bottom:2px;">${t.lblActualScuffed}</div>
                <div style="font-family:var(--font-mono); color:var(--accent-gold);">${this.escapeHtml(item.actualText)}</div>
            </div>
        ` : '';

        // 日本語訳ボックス (ENモード時は補助参考枠)
        let transHtml = '';
        if (item.translatedText) {
            if (isEn) {
                transHtml = `
                    <div class="codex-text-jp-box subtle-en">
                        <div class="codex-text-jp-label subtle-en">${t.lblTranslationEnNote}</div>
                        <div>${this.escapeHtml(item.translatedText)}</div>
                    </div>
                `;
            } else {
                transHtml = `
                    <div class="codex-text-jp-box">
                        <div class="codex-text-jp-label">${t.lblTranslation}</div>
                        <div>${this.escapeHtml(item.translatedText)}</div>
                    </div>
                `;
            }
        } else if (!isEn) {
            transHtml = `
                <div class="codex-text-jp-box" style="color:var(--text-muted); font-style:italic;">
                    ${t.noTranslation}
                </div>
            `;
        }

        const mediumVal = this.formatMedium(item, isEn);
        const originVal = this.formatOrigin(item, isEn);
        const statusVal = t.statusCollected;
        const categoryVal = this.formatCategory(item.subCategory || item.category, isEn);

        const originCellHtml = originVal ? `
            <div class="codex-meta-cell">
                <span class="codex-meta-label">${t.lblMetaOrigin}</span>
                <span class="codex-meta-value" style="color:var(--accent-gold);">${this.escapeHtml(originVal)}</span>
            </div>
        ` : '';

        const metaHtml = `
            <div class="codex-detail-meta-grid">
                <div class="codex-meta-cell">
                    <span class="codex-meta-label">${t.lblMetaMedium}</span>
                    <span class="codex-meta-value">${this.escapeHtml(mediumVal)}</span>
                </div>
                ${originCellHtml}
                <div class="codex-meta-cell">
                    <span class="codex-meta-label">${t.lblMetaCategory}</span>
                    <span class="codex-meta-value">${this.escapeHtml(categoryVal)}</span>
                </div>
                <div class="codex-meta-cell">
                    <span class="codex-meta-label">${t.lblMetaStatus}</span>
                    <span class="codex-meta-value">${statusVal}</span>
                </div>
            </div>
        `;

        // 関連エンティティ（クロスリファレンス）セクション
        let relatedHtml = '';
        if (Array.isArray(item.relatedEntities) && item.relatedEntities.length > 0) {
            const badgesHtml = item.relatedEntities.map((ent, idx) => {
                const isSelected = this.selectedEntitySpec && this.selectedEntitySpec.id === ent.id;
                const entName = isEn ? ent.name : (ent.nameJa || ent.name);
                const icon = ent.type === 'MONSTER' ? '👾' : '🛡️';
                const typeClass = ent.type === 'MONSTER' ? 'badge-monster' : 'badge-item';
                const activeClass = isSelected ? 'active' : '';
                return `
                    <button class="codex-entity-badge ${typeClass} ${activeClass}" data-entity-idx="${idx}" title="${this.escapeHtml(ent.name)}">
                        <span>${icon}</span>
                        <span>${this.escapeHtml(entName)}</span>
                    </button>
                `;
            }).join('');

            const specBoxHtml = this.selectedEntitySpec ? this.buildEntitySpecHtml(this.selectedEntitySpec, isEn) : '';

            relatedHtml = `
                <div class="codex-related-section">
                    <div class="codex-related-title">${t.lblRelatedEntities}</div>
                    <div class="codex-related-badges">
                        ${badgesHtml}
                    </div>
                    <div id="codex-entity-spec-container" class="codex-entity-spec-box ${this.selectedEntitySpec ? '' : 'hidden'}">
                        ${specBoxHtml}
                    </div>
                </div>
            `;
        }

        cardEl.innerHTML = `
            <div class="codex-detail-header">
                ${headerHtml}
            </div>
            <div class="codex-detail-body">
                ${actualScuffedHtml}
                <div class="codex-text-en-box">
                    ${this.escapeHtml(item.text || item.actualText || '')}
                </div>
                ${transHtml}
                ${metaHtml}
                ${relatedHtml}
            </div>
        `;

        // 関連エンティティバッジのクリック監視
        cardEl.querySelectorAll('.codex-entity-badge').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(badge.getAttribute('data-entity-idx'), 10);
                if (item.relatedEntities && item.relatedEntities[idx]) {
                    const targetEnt = item.relatedEntities[idx];
                    if (this.selectedEntitySpec && this.selectedEntitySpec.id === targetEnt.id) {
                        this.selectedEntitySpec = null;
                    } else {
                        this.selectedEntitySpec = targetEnt;
                    }
                    this.renderDetail();
                }
            });
        });

        const closeSpecBtn = cardEl.querySelector('#btn-close-entity-spec');
        if (closeSpecBtn) {
            closeSpecBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedEntitySpec = null;
                this.renderDetail();
            });
        }
    }

    /**
     * エンティティのミニスペックカードHTML生成
     * @param {Object} entity 
     * @param {boolean} isEn 
     * @returns {string}
     */
    buildEntitySpecHtml(entity, isEn) {
        const t = CODEX_I18N[isEn ? 'en' : 'ja'];
        const ke = this.getKnowledgeEngine();
        let fullData = null;
        if (ke) {
            if (entity.type === 'MONSTER') {
                fullData = ke.getMonsterKnowledge(entity.id || entity.name, { language: isEn ? 'en' : 'ja' });
            } else if (entity.type === 'ITEM') {
                fullData = ke.getItemKnowledge(entity.onum !== undefined ? entity.onum : (entity.id || entity.name), { language: isEn ? 'en' : 'ja' });
            }
        }

        const displayName = isEn ? (fullData?.nameEn || entity.name) : (fullData?.nameJa || entity.nameJa || entity.name);
        const subName = isEn ? (fullData?.nameJa || entity.nameJa || '') : (fullData?.nameEn || entity.name || '');
        const typeLabel = entity.type === 'MONSTER' ? '👾 MONSTER' : '🛡️ ITEM';
        
        let detailsHtml = '';
        if (entity.type === 'MONSTER') {
            const danger = fullData?.dangerLevel || entity.dangerLevel || 'MEDIUM';
            const stats = fullData?.stats ? `HD: ${fullData.stats.hd} | AC: ${fullData.stats.ac} | Spd: ${fullData.stats.speed} | MR: ${fullData.stats.mr}` : '';
            const adviceList = fullData?.tacticalAdvice || [];
            const adviceStr = adviceList.length > 0 ? adviceList.slice(0, 2).join(' / ') : (fullData?.threat?.description || fullData?.effectSummary || '');

            detailsHtml = `
                <div class="codex-spec-prop">
                    <span class="codex-spec-prop-label">${t.specDanger}</span>
                    <span class="codex-spec-prop-value" style="color:var(--accent-gold); font-weight:700;">${this.escapeHtml(danger)}</span>
                </div>
                ${stats ? `
                <div class="codex-spec-prop">
                    <span class="codex-spec-prop-label">${t.specStats}</span>
                    <span class="codex-spec-prop-value">${this.escapeHtml(stats)}</span>
                </div>` : ''}
                ${adviceStr ? `
                <div class="codex-spec-prop">
                    <span class="codex-spec-prop-label">${t.specAdvice}</span>
                    <span class="codex-spec-prop-value">${this.escapeHtml(adviceStr)}</span>
                </div>` : ''}
            `;
        } else {
            const category = fullData?.category || entity.category || 'TOOL';
            const effect = fullData?.effectSummary || fullData?.actionLabel || '';
            const cost = fullData?.cost ? `$${fullData.cost}` : '';

            detailsHtml = `
                <div class="codex-spec-prop">
                    <span class="codex-spec-prop-label">${t.specCategory}</span>
                    <span class="codex-spec-prop-value">${this.escapeHtml(category)} ${cost ? `(${cost})` : ''}</span>
                </div>
                ${effect ? `
                <div class="codex-spec-prop">
                    <span class="codex-spec-prop-label">${t.specAdvice}</span>
                    <span class="codex-spec-prop-value">${this.escapeHtml(effect)}</span>
                </div>` : ''}
            `;
        }

        return `
            <div class="codex-spec-header">
                <div>
                    <span class="codex-spec-title">${this.escapeHtml(displayName)}</span>
                    ${subName ? `<span style="font-size:11px; color:#94a3b8; margin-left:6px;">(${this.escapeHtml(subName)})</span>` : ''}
                    <span style="font-size:10px; color:#38bdf8; margin-left:8px; font-weight:700;">[${typeLabel}]</span>
                </div>
                <button class="codex-spec-close-btn" id="btn-close-entity-spec" title="閉じる">${t.specClose}</button>
            </div>
            <div class="codex-spec-body">
                ${detailsHtml}
            </div>
        `;
    }

    formatMedium(item, isEn) {
        const t = CODEX_I18N[isEn ? 'en' : 'ja'];
        if (item.category === 'ORACLE') return t.srcDelphi;
        if (item.category === 'RUMOR') {
            if (item.source === 'paper') return t.srcPaper;
            if (item.source === 'engraving') return t.srcEngraving;
            return t.srcCookie;
        }
        if (item.isHeadstone) return t.srcHeadstone;
        if (item.category === 'ELBERETH') return t.srcElbereth;
        return isEn ? 'Dungeon Floor Engraving' : '床の落書き';
    }

    formatOrigin(item, isEn) {
        const src = item.source || '';
        if (!src || src === 'cookie' || src === 'paper' || src === 'engraving' || src.includes('床の落書き') || src.includes('魔除けの結界')) {
            return null;
        }
        const match = src.match(/^(.*?)\s*[（\(]([^）\)]+)[）\)]\s*$/);
        if (match) {
            const enPart = match[1].trim();
            const jaPart = match[2].trim();
            return isEn ? (enPart || jaPart) : (enPart ? `${jaPart} (${enPart})` : jaPart);
        }
        return src;
    }

    formatCategory(catStr, isEn) {
        if (!catStr) return isEn ? 'General' : '一般';
        const catMap = {
            'TRUE_RUMOR': { en: 'True Rumor', ja: '真実の噂' },
            'FALSE_RUMOR': { en: 'False Rumor', ja: '偽りの噂' },
            'RUMOR': { en: 'Rumor', ja: '噂話' },
            'ORACLE': { en: 'Oracle', ja: '神託' },
            'SPECIAL_ORACLE': { en: 'Special Oracle', ja: '特別神託' },
            'ENGRAVING': { en: 'Graffiti / Quote', ja: '床の落書き・格言' },
            'HEADSTONE': { en: 'Headstone', ja: '墓碑銘' },
            'ELBERETH': { en: 'Elbereth Ward', ja: 'Elbereth結界' },
            'LITERATURE': { en: 'Literature / Fiction', ja: '文学・SF小説' },
            'CINEMA': { en: 'Cinema / Movies', ja: '映画・映像' },
            'PALINDROME': { en: 'Palindrome', ja: '回文' },
            'HUMOR': { en: 'Humor / Parody', ja: 'ユーモア・パロディ' },
            'GAME': { en: 'Video Games', ja: 'ビデオゲーム' },
            'SYSTEM': { en: 'UNIX / Operating System', ja: 'UNIX・システム' },
            'TECH': { en: 'Technology / Internet', ja: 'インターネット・IT' },
            'MEDIA': { en: 'TV / Pop Culture', ja: 'メディア・大衆文化' },
            'COMIC': { en: 'Comic / Strip', ja: 'コミック・漫画' },
            'MUSIC': { en: 'Music / Pop Song', ja: '音楽・ヒット曲' }
        };
        const found = catMap[catStr];
        if (found) return isEn ? found.en : found.ja;
        return catStr;
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

export default CodexModal;
