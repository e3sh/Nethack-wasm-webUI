/**
 * CodexModal.js - 冒険手帳 (Adventure Log & Lore Codex) クライアントモーダル
 *
 * 【設計思想】
 * セッション横断のメタプログレッション（モンスター383種・アイテム481品・噂話787件・神託20件・床文字）を
 * 省スペースな「Master-Detail (タイル一覧/コンパクト一覧 ＋ 選択詳細カード)」構造で提示する。
 * ゲーム内言語 (JP/EN) に完全連動し、リアルタイム検索・カテゴリ別フィルタ・全マスタ閲覧に対応。
 */

import { GlyphHelper } from '../../../../src/core/renderers/GlyphHelper.js';
import { AdventureLogManager } from '../../../../src/core/knowledge/lore/AdventureLogManager.js';
import { LORE_MASTER } from '../../../../src/core/knowledge/lore/data/LoreMasterData.js';

// 多言語リソース辞書 (i18n)
const CODEX_I18N = {
    ja: {
        brandTitle: 'ADVENTURE LOG & CODEX',
        brandSubtitle: '冒険手帳 (図鑑・伝承アーカイブ)',
        lblSumMonster: '👾 モンスター:',
        lblSumObject: '⚔️ アイテム:',
        lblSumRumor: '📜 噂話 総収集率:',
        lblSumTrue: '真実 (TRUE):',
        lblSumFalse: '偽り (FALSE):',
        lblSumOracle: '神託 (公式ガイド):',
        lblSumEngr: '床文字:',
        unitItems: '件',
        tabMonsters: '👾 モンスター',
        tabObjects: '⚔️ アイテム',
        tabRumors: '📜 噂話 (Rumors)',
        tabOracles: '🔮 神託ガイド (Oracles)',
        tabEngravings: '🏛️ 床文字・落書き (Engravings)',
        searchPlaceholder: "英和キーワード検索 (例: 'dragon', 'plate', 'ドラコ', '指輪')...",
        filterAll: 'すべて',
        filterTrue: '✅ 真実のみ',
        filterFalse: '❌ 偽りのみ',
        filterGraffiti: '🏛️ 落書き',
        filterHeadstone: '🪦 墓碑銘',
        filterElbereth: '🛡️ Elbereth',
        filterUnlocked: '✅ 解禁済み',
        filterLocked: '❓ 未遭遇',
        filterObjLocked: '❓ 未識別',
        filterNew: '✨ NEW!',
        filterWeapon: '⚔️ 武器',
        filterArmor: '🛡️ 防具',
        filterFood: '🍖 食料',
        filterScroll: '📜 巻物',
        filterPotion: '🧪 薬品',
        filterWand: '🪄 杖',
        filterRing: '💍 装飾',
        filterTool: '🎒 道具',
        detailEmpty: '左側のリストから項目を選択すると、<br>完全な英和テキストと詳細情報が表示されます。',
        emptyTabMsg: 'まだ記録がありません。<br>ダンジョンを探索したり、アイテムを拾得・識別したり、フォーチュンクッキーを食べるとここに記録されます。',
        emptyFilterMsg: '条件に一致する記録が見つかりませんでした。',
        btnMarkAllRead: 'すべて既読',
        badgeNew: '✨ NEW',
        badgeTrue: 'TRUE',
        badgeFalse: 'FALSE',
        badgeOracle: 'ORACLE',
        badgeGraffiti: '🏛️ 落書',
        badgeHeadstone: '🪦 墓碑',
        badgeElbereth: '🛡️ 結界',
        badgeMonster: '👾 モンスター',
        badgeObject: '⚔️ アイテム',
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
        statusUnlocked: '✅ 調査・識別完了',
        statusLocked: '❓ 未遭遇・未識別',
        srcDelphi: 'デルフィ神託所',
        srcFloor: '床文字',
        srcCookie: 'フォーチュンクッキー',
        srcPaper: '床の紙片',
        srcEngraving: '床の刻み文字',
        srcHeadstone: '墓碑銘 (Headstone)',
        srcElbereth: 'Elbereth (魔除けの結界文字)',
        lblRelatedEntities: '🔗 関連する知識・対象 (Related Knowledge):',
        lblRelatedLore: '📜 関連する噂・伝承 (Related Lore):',
        specClose: '✕ 閉じる',
        specDanger: '危険度:',
        specSize: 'サイズ:',
        specHp: '体力(HD):',
        specAc: '防御(AC):',
        specSpeed: '速度:',
        specMr: '魔抵抗:',
        specResists: '固有耐性:',
        specAttacks: '攻撃手段:',
        specAttrs: '特性・能力:',
        specCost: '基本価格:',
        specWeight: '重量:',
        specSkill: '武器スキル:',
        specDamage: '攻撃力:',
        specCategory: '分類:',
        specStats: '基礎値:',
        specAdvice: '戦術助言 / 効果:',
        lockedMonsterTitle: '未知のモンスター (Undiscovered)',
        lockedMonsterHint: 'まだダンジョン内で遭遇していない未知のモンスターです。危険を冒して地下深くを探索することで、生態や弱点が手帳に記録されます。',
        lockedObjectTitle: '未識別のアイテム (Unidentified)',
        lockedObjectHint: 'まだダンジョン内で識別・活用されていない未知のアイテムです。拾得や識別巻物、鑑定を通じて真の性能が手帳に記録されます。'
    },
    en: {
        brandTitle: 'ADVENTURE LOG & CODEX',
        brandSubtitle: 'Adventure Codex & Lore Archive',
        lblSumMonster: 'Monsters:',
        lblSumObject: 'Objects:',
        lblSumRumor: 'Rumors Collected:',
        lblSumTrue: 'True Rumors:',
        lblSumFalse: 'False Rumors:',
        lblSumOracle: 'Oracles (Guide):',
        lblSumEngr: 'Engravings:',
        unitItems: 'entries',
        tabMonsters: '👾 Monsters',
        tabObjects: '⚔️ Objects',
        tabRumors: '📜 Rumors',
        tabOracles: '🔮 Oracles (Guide)',
        tabEngravings: '🏛️ Engravings',
        searchPlaceholder: "Search by keyword (e.g. 'dragon', 'plate', 'ring')...",
        filterAll: 'All',
        filterTrue: '✅ True Only',
        filterFalse: '❌ False Only',
        filterGraffiti: '🏛️ Graffiti',
        filterHeadstone: '🪦 Headstone',
        filterElbereth: '🛡️ Elbereth',
        filterUnlocked: '✅ Unlocked',
        filterLocked: '❓ Undiscovered',
        filterObjLocked: '❓ Unidentified',
        filterNew: '✨ NEW!',
        filterWeapon: '⚔️ Weapon',
        filterArmor: '🛡️ Armor',
        filterFood: '🍖 Food',
        filterScroll: '📜 Scroll',
        filterPotion: '🧪 Potion',
        filterWand: '🪄 Wand',
        filterRing: '💍 Ring',
        filterTool: '🎒 Tool',
        detailEmpty: 'Select an item from the list on the left<br>to view its full text and details.',
        emptyTabMsg: 'No entries recorded yet.<br>Explore the dungeon, identify items, or consult the Oracle to collect knowledge.',
        emptyFilterMsg: 'No matching entries found.',
        btnMarkAllRead: 'Mark All Read',
        badgeNew: '✨ NEW',
        badgeTrue: 'TRUE',
        badgeFalse: 'FALSE',
        badgeOracle: 'ORACLE',
        badgeGraffiti: '🏛️ Engr',
        badgeHeadstone: '🪦 Grave',
        badgeElbereth: '🛡️ Ward',
        badgeMonster: '👾 MONSTER',
        badgeObject: '⚔️ ITEM',
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
        statusUnlocked: '✅ Identified & Documented',
        statusLocked: '❓ Undiscovered / Unidentified',
        srcDelphi: 'Oracle of Delphi',
        srcFloor: 'Floor Engraving',
        srcCookie: 'Fortune Cookie',
        srcPaper: 'Scrap of Paper',
        srcEngraving: 'Floor Engraving',
        srcHeadstone: 'Headstone Inscription',
        srcElbereth: 'Ward of Elbereth',
        lblRelatedEntities: '🔗 Related Knowledge:',
        lblRelatedLore: '📜 Related Lore & Rumors:',
        specClose: '✕ Close',
        specDanger: 'Danger:',
        specSize: 'Size:',
        specHp: 'Health (HD):',
        specAc: 'Defense (AC):',
        specSpeed: 'Speed:',
        specMr: 'Magic Res:',
        specResists: 'Resistances:',
        specAttacks: 'Attacks:',
        specAttrs: 'Attributes:',
        specCost: 'Base Cost:',
        specWeight: 'Weight:',
        specSkill: 'Skill:',
        specDamage: 'Damage:',
        specCategory: 'Category:',
        specStats: 'Stats:',
        specAdvice: 'Tactics / Effect:',
        lockedMonsterTitle: 'Unknown Monster',
        lockedMonsterHint: 'You have not encountered this monster in the dungeon yet. Brave the depths to document its nature and weaknesses.',
        lockedObjectTitle: 'Unidentified Item',
        lockedObjectHint: 'You have not identified this item in the dungeon yet. Discover, use, or identify it to reveal its true properties.'
    }
};

export class CodexModal {
    /**
     * @param {Object} options
     * @param {HTMLElement} [options.elCodexModal] - モーダル外枠DOM
     * @param {Function} options.getCore - WebUICore取得関数
     * @param {Function} [options.onClose] - モーダル閉鎖時コールバック
     * @param {Function} [options.onUnreadCountChanged] - 未読件数変更時コールバック
     * @param {AdventureLogManager} [options.adventureLogManager] - 冒険手帳マネージャ
     * @param {string} [options.defaultTab] - 初期選択タブ
     * @param {string} [options.tileImage] - タイル画像パス
     * @param {Function} [options.getLoadedTileImagePath] - タイル画像パス取得関数
     */
    constructor(options = {}) {
        this.options = options;
        this.elCodexModal = options.elCodexModal || (typeof document !== 'undefined' ? document.getElementById('codex-modal') : null);
        this.getCore = options.getCore || (() => null);
        this.onClose = options.onClose || (() => {});
        this.onUnreadCountChanged = options.onUnreadCountChanged || (() => {});
        this.knowledgeEngine = options.knowledgeEngine || null;
        this.adventureLogManager = options.adventureLogManager || null;
        this.tileImage = options.tileImage || 'pict/nethack_default_32.png';
        this.getLoadedTileImagePath = options.getLoadedTileImagePath || null;

        this.currentLanguage = 'ja';
        this.isVisible = false;

        // デフォルトタブ: options.defaultTab があればそれ、なければ DOM に #codex-tab-monsters があれば 'monsters'、なければ 'rumors'
        if (options.defaultTab) {
            this.activeTab = options.defaultTab;
        } else if (this.elCodexModal && this.elCodexModal.querySelector && this.elCodexModal.querySelector('#codex-tab-monsters')) {
            this.activeTab = 'monsters';
        } else {
            this.activeTab = 'rumors';
        }

        // フィルタ状態
        this.currentMonFilter = 'ALL';
        this.currentObjFilter = 'ALL';
        this.currentRumorFilter = 'ALL';
        this.currentEngrFilter = 'ALL';

        this.selectedItem = null;
        this.selectedEntitySpec = null;
        this._currentItems = [];

        this.readIds = this.loadReadIds();
        this._subscribed = false;
        this._subscribedCodex = null;
        this._subscribedAlm = null;

        this.setupDOM();
    }

    /**
     * タイル画像パスの取得
     * @returns {string}
     */
    getTileImage() {
        if (typeof this.getLoadedTileImagePath === 'function') {
            const p = this.getLoadedTileImagePath();
            if (p) return p;
        }
        return this.tileImage || 'pict/nethack_default_32.png';
    }

    /**
     * 冒険手帳メタプログレッションマネージャの取得
     * @returns {AdventureLogManager|null}
     */
    getAdventureLogManager() {
        if (this.adventureLogManager) return this.adventureLogManager;
        const core = this.getCore();
        if (core && typeof core.getAdventureLogManager === 'function') {
            const mgr = core.getAdventureLogManager();
            if (mgr) {
                this.adventureLogManager = mgr;
                return mgr;
            }
        }
        if (core?.gkl && typeof core.gkl.getAdventureLogManager === 'function') {
            const mgr = core.gkl.getAdventureLogManager();
            if (mgr) {
                this.adventureLogManager = mgr;
                return mgr;
            }
        }
        if (typeof window !== 'undefined' && window.__nh_adventure_log_mgr) {
            this.adventureLogManager = window.__nh_adventure_log_mgr;
            return this.adventureLogManager;
        }
        // 自動初期化フォールバック
        this.adventureLogManager = new AdventureLogManager();
        return this.adventureLogManager;
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
        if (core?.gkl?.structuredKnowledge) {
            return core.gkl.structuredKnowledge;
        }
        return null;
    }

    /**
     * 既読IDの読み込み (localStorage) - 噂・神託・床文字用
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
        if (!item) return false;
        if (item.category === 'monster' || item.monOffset !== undefined) {
            const alm = this.getAdventureLogManager();
            return alm ? alm.isNew('monster', item.monOffset !== undefined ? item.monOffset : item.id) : false;
        }
        if (item.category === 'object' || item.onum !== undefined) {
            const alm = this.getAdventureLogManager();
            return alm ? alm.isNew('object', item.onum !== undefined ? item.onum : item.id) : false;
        }
        if (item.category === 'RUMOR' || item.category === 'rumor') {
            const alm = this.getAdventureLogManager();
            if (alm && alm.isNew('rumor', item.id)) return true;
        }
        if (!item.id) return false;
        return !this.readIds.has(item.id);
    }

    /**
     * 単一アイテムを既読化
     * @param {string|number} id
     * @param {string} [category]
     */
    markAsRead(id, category = null) {
        if (!id) return;
        const alm = this.getAdventureLogManager();

        if (category === 'monster') {
            if (alm) alm.markAsRead('monster', id);
        } else if (category === 'object') {
            if (alm) alm.markAsRead('object', id);
        } else if (category === 'rumor' || category === 'RUMOR') {
            if (alm) alm.markAsRead('rumor', id);
            this.readIds.add(id);
            this.saveReadIds();
        } else {
            // 汎用判定
            if (typeof id === 'string' && (id.startsWith('mon_') || id.startsWith('monster_'))) {
                if (alm) alm.markAsRead('monster', id);
            } else if (typeof id === 'string' && (id.startsWith('obj_') || id.startsWith('object_'))) {
                if (alm) alm.markAsRead('object', id);
            }
            if (this.readIds.has(id)) return;
            this.readIds.add(id);
            this.saveReadIds();
        }

        // リスト項目のNEWバッジと未読クラスを即座に更新
        if (this.elCodexModal) {
            const listEl = this.elCodexModal.querySelector('#codex-master-list');
            if (listEl) {
                const itemEls = listEl.querySelectorAll(`.codex-list-item[data-id="${id}"]`);
                itemEls.forEach(el => {
                    el.classList.remove('is-unread');
                    const badge = el.querySelector('.badge-new');
                    if (badge) badge.remove();
                });
            }
        }

        this.updateUnreadBadges();
        this.notifyUnreadCount();
    }

    /**
     * すべての獲得済み・解禁済み項目を既読化
     */
    markAllAsRead() {
        const alm = this.getAdventureLogManager();
        if (alm) {
            alm.markAllAsRead('all');
        }

        const core = this.getCore();
        const codex = core?.getLoreCodex();
        if (codex) {
            const allItems = [
                ...(codex.getRumors() || []),
                ...(codex.getOracles() || []),
                ...(codex.getEngravings() || [])
            ];

            for (const item of allItems) {
                if (item.id) this.readIds.add(item.id);
            }
            this.saveReadIds();
        }

        this.renderList();
        this.updateUnreadBadges();
        this.notifyUnreadCount();
    }

    /**
     * 各カテゴリおよび全体の未読件数を取得
     */
    getUnreadCounts() {
        const alm = this.getAdventureLogManager();
        const monsters = alm ? alm.newMonsters.size : 0;
        const objects = alm ? alm.newObjects.size : 0;

        const core = this.getCore();
        const codex = core?.getLoreCodex();

        let rumors = 0;
        let oracles = 0;
        let engravings = 0;

        if (codex) {
            const countUnread = (items = []) => {
                return items.filter(i => i && i.id && !this.readIds.has(i.id)).length;
            };
            rumors = countUnread(codex.getRumors());
            oracles = countUnread(codex.getOracles());
            engravings = countUnread(codex.getEngravings());
        }

        const total = monsters + objects + rumors + oracles + engravings;
        return { total, monsters, objects, rumors, oracles, engravings };
    }

    /**
     * タブ上およびモーダル内の未読バッジ要素を更新
     */
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

        updateTabBadge('#codex-unread-tab-monsters', counts.monsters);
        updateTabBadge('#codex-unread-tab-objects', counts.objects);
        updateTabBadge('#codex-unread-tab-rumors', counts.rumors);
        updateTabBadge('#codex-unread-tab-oracles', counts.oracles);
        updateTabBadge('#codex-unread-tab-engravings', counts.engravings);

        const btnMarkAll = this.elCodexModal.querySelector('#btn-codex-mark-all-read');
        if (btnMarkAll) {
            btnMarkAll.style.display = counts.total > 0 ? 'inline-flex' : 'none';
        }
    }

    /**
     * Codex および AdventureLogManager の変更リスナーを確実に購読
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

        const alm = this.getAdventureLogManager();
        if (alm && this._subscribedAlm !== alm) {
            const onAlmUpdate = () => {
                this.notifyUnreadCount();
                if (this.isVisible) {
                    this.updateSummaryBar();
                    this.renderList();
                    this.renderDetail();
                    this.updateUnreadBadges();
                }
            };
            if (typeof alm.subscribe === 'function') {
                alm.subscribe(onAlmUpdate);
            }
            this._subscribedAlm = alm;
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
        const tabMonsters = this.elCodexModal.querySelector('#codex-tab-monsters');
        const tabObjects = this.elCodexModal.querySelector('#codex-tab-objects');
        const tabRumors = this.elCodexModal.querySelector('#codex-tab-rumors');
        const tabOracles = this.elCodexModal.querySelector('#codex-tab-oracles');
        const tabEngravings = this.elCodexModal.querySelector('#codex-tab-engravings');
        if (tabMonsters) tabMonsters.addEventListener('click', () => this.switchTab('monsters'));
        if (tabObjects) tabObjects.addEventListener('click', () => this.switchTab('objects'));
        if (tabRumors) tabRumors.addEventListener('click', () => this.switchTab('rumors'));
        if (tabOracles) tabOracles.addEventListener('click', () => this.switchTab('oracles'));
        if (tabEngravings) tabEngravings.addEventListener('click', () => this.switchTab('engravings'));

        // モンスターフィルタ
        const bindMonFilter = (id, filter) => {
            const el = this.elCodexModal.querySelector(id);
            if (el) el.addEventListener('click', () => this.setMonsterFilter(filter));
        };
        bindMonFilter('#codex-filter-mon-all', 'ALL');
        bindMonFilter('#codex-filter-mon-unlocked', 'UNLOCKED');
        bindMonFilter('#codex-filter-mon-locked', 'LOCKED');
        bindMonFilter('#codex-filter-mon-new', 'NEW');

        // アイテムフィルタ
        const bindObjFilter = (id, filter) => {
            const el = this.elCodexModal.querySelector(id);
            if (el) el.addEventListener('click', () => this.setObjectFilter(filter));
        };
        bindObjFilter('#codex-filter-obj-all', 'ALL');
        bindObjFilter('#codex-filter-obj-weapon', 'WEAPON');
        bindObjFilter('#codex-filter-obj-armor', 'ARMOR');
        bindObjFilter('#codex-filter-obj-food', 'FOOD');
        bindObjFilter('#codex-filter-obj-scroll', 'SCROLL');
        bindObjFilter('#codex-filter-obj-potion', 'POTION');
        bindObjFilter('#codex-filter-obj-wand', 'WAND');
        bindObjFilter('#codex-filter-obj-ring', 'RING');
        bindObjFilter('#codex-filter-obj-tool', 'TOOL');
        bindObjFilter('#codex-filter-obj-unlocked', 'UNLOCKED');
        bindObjFilter('#codex-filter-obj-locked', 'LOCKED');
        bindObjFilter('#codex-filter-obj-new', 'NEW');

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

        // リスナーを購読
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

        setText('#codex-lbl-sum-monster', t.lblSumMonster);
        setText('#codex-lbl-sum-object', t.lblSumObject);
        setText('#codex-lbl-sum-rumor', t.lblSumRumor);
        setText('#codex-lbl-sum-true', t.lblSumTrue);
        setText('#codex-lbl-sum-false', t.lblSumFalse);
        setText('#codex-lbl-sum-oracle', t.lblSumOracle);
        setText('#codex-lbl-sum-engr', t.lblSumEngr);

        setText('#codex-txt-tab-monsters', t.tabMonsters);
        setText('#codex-txt-tab-objects', t.tabObjects);
        setText('#codex-txt-tab-rumors', t.tabRumors);
        setText('#codex-txt-tab-oracles', t.tabOracles);
        setText('#codex-txt-tab-engravings', t.tabEngravings);

        const searchInput = this.elCodexModal.querySelector('#codex-search-input');
        if (searchInput) searchInput.placeholder = t.searchPlaceholder;

        // モンスターフィルタ
        setText('#codex-filter-mon-all', t.filterAll);
        setText('#codex-filter-mon-unlocked', t.filterUnlocked);
        setText('#codex-filter-mon-locked', t.filterLocked);
        setText('#codex-filter-mon-new', t.filterNew);

        // アイテムフィルタ
        setText('#codex-filter-obj-all', t.filterAll);
        setText('#codex-filter-obj-weapon', t.filterWeapon);
        setText('#codex-filter-obj-armor', t.filterArmor);
        setText('#codex-filter-obj-food', t.filterFood);
        setText('#codex-filter-obj-scroll', t.filterScroll);
        setText('#codex-filter-obj-potion', t.filterPotion);
        setText('#codex-filter-obj-wand', t.filterWand);
        setText('#codex-filter-obj-ring', t.filterRing);
        setText('#codex-filter-obj-tool', t.filterTool);
        setText('#codex-filter-obj-unlocked', t.filterUnlocked);
        setText('#codex-filter-obj-locked', t.filterObjLocked);
        setText('#codex-filter-obj-new', t.filterNew);

        // 噂フィルタ
        setText('#codex-filter-all', t.filterAll);
        setText('#codex-filter-true', t.filterTrue);
        setText('#codex-filter-false', t.filterFalse);

        // 床文字フィルタ
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
        const alm = this.getAdventureLogManager();

        const progress = alm ? alm.getProgress() : {
            monsters: { unlocked: 0, total: 383, percentage: 0 },
            objects: { unlocked: 0, total: 481, percentage: 0 },
            rumors: { unlocked: 0, total: 787, percentage: 0 }
        };

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

        // モンスター
        setText('#codex-sum-monster-ratio', `${progress.monsters.unlocked} / ${progress.monsters.total}`);
        setText('#codex-sum-monster-pct', `(${progress.monsters.percentage}%)`);
        const monBar = this.elCodexModal.querySelector('#codex-sum-monster-bar');
        if (monBar) monBar.style.width = `${progress.monsters.percentage}%`;

        // アイテム
        setText('#codex-sum-object-ratio', `${progress.objects.unlocked} / ${progress.objects.total}`);
        setText('#codex-sum-object-pct', `(${progress.objects.percentage}%)`);
        const objBar = this.elCodexModal.querySelector('#codex-sum-object-bar');
        if (objBar) objBar.style.width = `${progress.objects.percentage}%`;

        // 噂話
        const rumorCollected = codex ? stats.rumors.collected : progress.rumors.unlocked;
        const rumorPct = codex ? stats.rumors.percentage : progress.rumors.percentage;
        setText('#codex-sum-rumor-ratio', `${rumorCollected} / ${stats.rumors.total}`);
        setText('#codex-sum-rumor-pct', `(${rumorPct}%)`);
        const rumorBar = this.elCodexModal.querySelector('#codex-sum-rumor-bar');
        if (rumorBar) rumorBar.style.width = `${rumorPct}%`;

        const isEn = this.currentLanguage === 'en';
        setText('#codex-sum-true-ratio', `${stats.rumors.trueCount} / ${stats.rumors.totalTrue}`);
        setText('#codex-sum-false-ratio', `${stats.rumors.falseCount} / ${stats.rumors.totalFalse}`);

        // 神託（Oracle）集計: 公式ガイドモード時は全20件、通常時はアンロック数/20
        const isGuide = Boolean(alm?.oracleGuideAlwaysUnlocked);
        const oracleUnlocked = alm ? (alm.unlockedOracles?.size || 0) : (codex ? codex.oracles.size : 0);
        const oracleTotal = 20;

        if (isGuide) {
            setText('#codex-lbl-sum-oracle', isEn ? 'Oracles (Guide):' : '神託 (公式ガイド):');
            setText('#codex-txt-tab-oracles', isEn ? '🔮 Oracles (Guide)' : '🔮 神託ガイド (Oracles)');
            setText('#codex-sum-oracle-ratio', isEn ? '20 entries' : '全 20 件');
            setText('#codex-badge-oracles', '20');
        } else {
            setText('#codex-lbl-sum-oracle', isEn ? 'Oracles:' : '神託:');
            setText('#codex-txt-tab-oracles', isEn ? '🔮 Oracles' : '🔮 神託 (Oracles)');
            setText('#codex-sum-oracle-ratio', `${oracleUnlocked} / ${oracleTotal}`);
            setText('#codex-badge-oracles', `${oracleUnlocked}/${oracleTotal}`);
        }

        setText('#codex-sum-engr-count', `${stats.engravings?.collected || 0} ${t.unitItems}`);

        // タブバッジ
        setText('#codex-badge-monsters', `${progress.monsters.unlocked}/${progress.monsters.total}`);
        setText('#codex-badge-objects', `${progress.objects.unlocked}/${progress.objects.total}`);
        setText('#codex-badge-rumors', `${rumorCollected}/${stats.rumors.total}`);
        setText('#codex-badge-engravings', stats.engravings?.collected || 0);
    }

    /**
     * タブ切り替え
     * @param {'monsters'|'objects'|'rumors'|'oracles'|'engravings'} tab
     */
    switchTab(tab) {
        this.activeTab = tab;
        this.selectedItem = null;
        this.selectedEntitySpec = null;

        const tabs = this.elCodexModal.querySelectorAll('.codex-nav-tab');
        tabs.forEach(t => t.classList.remove('active'));

        const tabEl = this.elCodexModal.querySelector(`#codex-tab-${tab}`);
        if (tabEl) tabEl.classList.add('active');

        const filtersMon = this.elCodexModal.querySelector('#codex-filters-monster');
        const filtersObj = this.elCodexModal.querySelector('#codex-filters-object');
        const filtersRumor = this.elCodexModal.querySelector('#codex-filters-rumor');
        const filtersEngr = this.elCodexModal.querySelector('#codex-filters-engraving');
        if (filtersMon) filtersMon.classList.toggle('hidden', tab !== 'monsters');
        if (filtersObj) filtersObj.classList.toggle('hidden', tab !== 'objects');
        if (filtersRumor) filtersRumor.classList.toggle('hidden', tab !== 'rumors');
        if (filtersEngr) filtersEngr.classList.toggle('hidden', tab !== 'engravings');

        const searchInput = this.elCodexModal.querySelector('#codex-search-input');
        if (searchInput) searchInput.value = '';

        this.renderList();
        this.renderDetail();
    }

    setMonsterFilter(filter) {
        this.currentMonFilter = filter;
        const chips = this.elCodexModal.querySelectorAll('#codex-filters-monster .codex-chip');
        chips.forEach(c => c.classList.remove('active'));
        const chipMap = {
            'ALL': 'all',
            'UNLOCKED': 'unlocked',
            'LOCKED': 'locked',
            'NEW': 'new'
        };
        const chip = this.elCodexModal.querySelector(`#codex-filter-mon-${chipMap[filter]}`);
        if (chip) chip.classList.add('active');
        this.renderList();
    }

    setObjectFilter(filter) {
        this.currentObjFilter = filter;
        const chips = this.elCodexModal.querySelectorAll('#codex-filters-object .codex-chip');
        chips.forEach(c => c.classList.remove('active'));
        const chipMap = {
            'ALL': 'all',
            'WEAPON': 'weapon',
            'ARMOR': 'armor',
            'FOOD': 'food',
            'SCROLL': 'scroll',
            'POTION': 'potion',
            'WAND': 'wand',
            'RING': 'ring',
            'TOOL': 'tool',
            'UNLOCKED': 'unlocked',
            'LOCKED': 'locked',
            'NEW': 'new'
        };
        const chip = this.elCodexModal.querySelector(`#codex-filter-obj-${chipMap[filter]}`);
        if (chip) chip.classList.add('active');
        this.renderList();
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
        const alm = this.getAdventureLogManager();

        let items = [];

        if (this.activeTab === 'monsters') {
            if (alm) {
                items = alm.getAllMonstersWithStatus();
            }
            if (this.currentMonFilter === 'UNLOCKED') items = items.filter(i => i.isUnlocked);
            else if (this.currentMonFilter === 'LOCKED') items = items.filter(i => !i.isUnlocked);
            else if (this.currentMonFilter === 'NEW') items = items.filter(i => i.isNew);

            if (q) {
                items = items.filter(i => {
                    const name = (i.name || '').toLowerCase();
                    const nameJa = (i.nameJa || '').toLowerCase();
                    const sym = (i.symbol || '').toLowerCase();
                    return name.includes(q) || nameJa.includes(q) || sym === q;
                });
            }

        } else if (this.activeTab === 'objects') {
            if (alm) {
                items = alm.getAllObjectsWithStatus();
            }
            if (this.currentObjFilter === 'UNLOCKED') {
                items = items.filter(i => i.isUnlocked);
            } else if (this.currentObjFilter === 'LOCKED') {
                items = items.filter(i => !i.isUnlocked);
            } else if (this.currentObjFilter === 'NEW') {
                items = items.filter(i => i.isNew);
            } else if (this.currentObjFilter !== 'ALL') {
                items = items.filter(i => i.itemCategory === this.currentObjFilter);
            }

            if (q) {
                items = items.filter(i => {
                    const name = (i.name || '').toLowerCase();
                    const nameJa = (i.nameJa || '').toLowerCase();
                    const cat = (i.itemCategory || '').toLowerCase();
                    return name.includes(q) || nameJa.includes(q) || cat.includes(q);
                });
            }

        } else if (this.activeTab === 'rumors') {
            if (codex) {
                items = codex.getRumors().map(i => ({
                    ...i,
                    category: 'RUMOR',
                    collected: true
                }));
            }
            if (this.currentRumorFilter === 'TRUE') items = items.filter(i => i.isTrue);
            if (this.currentRumorFilter === 'FALSE') items = items.filter(i => !i.isTrue);

            if (q) {
                items = items.filter(i => {
                    const tEn = (i.text || i.actualText || '').toLowerCase();
                    const tJp = (i.translatedText || i.title || '').toLowerCase();
                    const id = (i.id || '').toLowerCase();
                    return tEn.includes(q) || tJp.includes(q) || id.includes(q);
                });
            }

        } else if (this.activeTab === 'oracles') {
            const masterOracles = LORE_MASTER.oracles || [];
            const isGuide = Boolean(alm?.oracleGuideAlwaysUnlocked);

            items = masterOracles.map(o => {
                const isUnlocked = isGuide || (alm ? alm.isOracleUnlocked(o.id) : (codex && codex.oracles.has(o.id)));
                return {
                    ...o,
                    category: 'ORACLE',
                    collected: isUnlocked,
                    isUnlocked: isUnlocked
                };
            });
            if (q) {
                items = items.filter(i => {
                    const tEn = (i.text || '').toLowerCase();
                    const tJp = (i.translatedText || '').toLowerCase();
                    return tEn.includes(q) || tJp.includes(q);
                });
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
            if (q) {
                items = items.filter(i => {
                    const tEn = (i.text || i.actualText || '').toLowerCase();
                    const tJp = (i.translatedText || '').toLowerCase();
                    return tEn.includes(q) || tJp.includes(q);
                });
            }
        }

        if (items.length === 0) {
            let hasAnyInTab = false;
            if (this.activeTab === 'monsters') hasAnyInTab = (alm?.getAllMonstersWithStatus()?.length || 0) > 0;
            else if (this.activeTab === 'objects') hasAnyInTab = (alm?.getAllObjectsWithStatus()?.length || 0) > 0;
            else if (this.activeTab === 'rumors') hasAnyInTab = (codex?.getRumors()?.length || 0) > 0;
            else if (this.activeTab === 'oracles') hasAnyInTab = true;
            else hasAnyInTab = (codex?.getEngravings()?.length || 0) > 0;

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
            const isLocked = item.isUnlocked === false;
            const itemClass = [
                isSel ? 'codex-list-item selected' : 'codex-list-item',
                unread ? 'is-unread' : '',
                isLocked ? 'locked' : ''
            ].filter(Boolean).join(' ');

            // タイル生成 (モンスター & アイテム)
            let tileHtml = '';
            if (item.glyphId !== undefined) {
                const styleObj = GlyphHelper.getGlyphStyle(item.glyphId, {
                    tileImage: this.getTileImage(),
                    tileSize: 32,
                    displaySize: 32
                });
                if (styleObj) {
                    const styleStr = Object.entries(styleObj)
                        .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
                        .join(';');
                    tileHtml = `
                        <div class="codex-tile-wrap ${isLocked ? 'locked' : ''}">
                            <div class="codex-tile-glyph ${isLocked ? 'locked' : ''}" style="${styleStr}"></div>
                        </div>
                    `;
                } else {
                    const sym = item.symbol || (item.category === 'monster' ? 'M' : '?');
                    tileHtml = `
                        <div class="codex-tile-wrap ${isLocked ? 'locked' : ''}">
                            <span class="codex-symbol-fallback ${isLocked ? 'locked' : ''}">${sym}</span>
                        </div>
                    `;
                }
            }

            // バッジ
            let badgeHtml = '';
            if (item.category === 'monster') {
                const sym = item.symbol ? ` [${item.symbol}]` : '';
                badgeHtml = `<span class="codex-item-badge badge-monster">${t.badgeMonster}${sym}</span>`;
            } else if (item.category === 'object') {
                const catStr = item.itemCategory || '';
                badgeHtml = `<span class="codex-item-badge badge-object">${catStr || t.badgeObject}</span>`;
            } else if (item.category === 'RUMOR' || item.isTrue !== undefined) {
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

            // スニペットテキスト
            let mainTitle = '';
            let subTitle = '';

            if (item.category === 'monster') {
                mainTitle = isLocked ? `No.${item.monOffset} ???` : (isEn ? item.name : (item.nameJa || item.name));
                subTitle = isLocked ? '???' : (isEn ? (item.nameJa || '') : item.name);
            } else if (item.category === 'object') {
                mainTitle = isLocked ? `No.${item.onum} ???` : (isEn ? item.name : (item.nameJa || item.name));
                subTitle = isLocked ? '???' : (isEn ? (item.nameJa || '') : item.name);
            } else if (item.category === 'ORACLE') {
                const oracleNum = (item.id || '').replace(/^oracle_/, '');
                mainTitle = isLocked ? `No.${oracleNum || idx + 1} 🔒 ???` : (item.title || item.text || '');
                subTitle = isLocked ? (isEn ? 'Consult the Oracle in Delphi' : 'デルフィの神託所で授かることで解禁') : ((!isEn && item.translatedText) ? item.translatedText : '');
            } else {
                mainTitle = item.title || item.text || item.actualText || '';
                subTitle = (!isEn && item.translatedText) ? item.translatedText : '';
            }

            const transRowHtml = subTitle ? `<div class="codex-item-trans-snippet">${this.escapeHtml(subTitle)}</div>` : '';
            const seen = item.seenCount ? `x${item.seenCount}` : '';

            return `
                <div class="${itemClass}" data-idx="${idx}" data-id="${this.escapeHtml(item.id || '')}">
                    ${tileHtml}
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                            <div style="display:flex; align-items:center; gap:4px;">
                                ${badgeHtml}
                                ${newBadgeHtml}
                            </div>
                            <span class="codex-item-meta">${seen}</span>
                        </div>
                        <div class="codex-item-snippet" style="font-weight:600;">${this.escapeHtml(mainTitle)}</div>
                        ${transRowHtml}
                    </div>
                </div>
            `;
        }).join('');

        this._currentItems = items;

        // 初期選択アイテムを既読化
        if (this.selectedItem && this.selectedItem.id) {
            this.markAsRead(this.selectedItem.id, this.selectedItem.category);
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
                        this.markAsRead(chosen.id, chosen.category);
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

        // 1. モンスター詳細
        if (item.category === 'monster') {
            this._renderMonsterDetail(item, cardEl, isEn, t);
            return;
        }

        // 2. アイテム詳細
        if (item.category === 'object') {
            this._renderObjectDetail(item, cardEl, isEn, t);
            return;
        }

        // 3. 伝承（噂話・神託・床文字）詳細 (既存の充実描画)
        this._renderLoreDetail(item, cardEl, isEn, t);
    }

    /**
     * モンスター詳細カードのレンダリング
     * @private
     */
    _renderMonsterDetail(item, cardEl, isEn, t) {
        const isLocked = item.isUnlocked === false;
        const alm = this.getAdventureLogManager();
        const mon = item.data || {};

        // アバタータイル
        let avatarInner = '';
        if (item.glyphId !== undefined) {
            const styleObj = GlyphHelper.getGlyphStyle(item.glyphId, {
                tileImage: this.getTileImage(),
                tileSize: 32,
                displaySize: 32
            });
            if (styleObj) {
                const styleStr = Object.entries(styleObj)
                    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
                    .join(';');
                avatarInner = `<div class="codex-entry-avatar-glyph ${isLocked ? 'locked' : ''}" style="${styleStr}"></div>`;
            }
        }
        if (!avatarInner) {
            const sym = item.symbol || 'M';
            avatarInner = `<span class="codex-entry-avatar-symbol ${isLocked ? 'locked' : ''}">${sym}</span>`;
        }

        if (isLocked) {
            cardEl.innerHTML = `
                <div class="codex-detail-body">
                    <div class="codex-entry-header">
                        <div class="codex-entry-avatar locked">
                            ${avatarInner}
                        </div>
                        <div class="codex-entry-titles">
                            <div class="codex-entry-name-main" style="color:#94a3b8;">
                                No.${item.monOffset} ???
                            </div>
                            <div class="codex-entry-name-sub">Unknown Monster</div>
                            <div class="codex-entry-id-badge">OFFSET: ${item.monOffset}</div>
                        </div>
                    </div>
                    <div class="codex-locked-placeholder">
                        <div class="codex-locked-icon">🔒</div>
                        <div class="codex-locked-title">${t.lockedMonsterTitle}</div>
                        <div class="codex-locked-hint">${t.lockedMonsterHint}</div>
                    </div>
                </div>
            `;
            return;
        }

        // 解禁済みモンスター
        const mainName = isEn ? mon.name : (mon.nameJa || mon.name);
        const subName = isEn ? (mon.nameJa || '') : mon.name;
        const danger = mon.dangerLevel || 'MEDIUM';
        const size = mon.size || 'MEDIUM';
        const stats = mon.stats || {};
        const hp = stats.hd ? `${stats.hd}d8` : (stats.baseHp || '--');
        const ac = stats.ac !== undefined ? stats.ac : '--';
        const speed = stats.speed !== undefined ? stats.speed : '--';
        const mr = stats.mr !== undefined ? `${stats.mr}%` : '--';

        const resistances = mon.resistances || [];
        const attacks = mon.attacks || [];
        const attributes = this.getMonsterAttributeTags(mon, isEn);
        const desc = isEn ? (mon.flavorTextEn || mon.description || '') : (mon.flavorTextJa || mon.description || mon.flavorTextEn || '');

        // 関連する噂や伝承
        const allRelatedLore = alm ? alm.getRelatedLore(mon, { unlockedOnly: false }) : [];
        const relatedLore = allRelatedLore.filter(l => l.isUnlocked !== false);
        const lockedLoreCount = allRelatedLore.filter(l => l.isUnlocked === false).length;

        cardEl.innerHTML = `
            <div class="codex-detail-body">
                <div class="codex-entry-header">
                    <div class="codex-entry-avatar">
                        ${avatarInner}
                    </div>
                    <div class="codex-entry-titles">
                        <div class="codex-entry-name-main">
                            <span>${this.escapeHtml(mainName)}</span>
                            <span class="codex-item-badge badge-monster" style="font-size:11px;">[${this.escapeHtml(mon.symbol || 'M')}]</span>
                        </div>
                        <div class="codex-entry-name-sub">${this.escapeHtml(subName)}</div>
                        <div class="codex-entry-id-badge">No.${item.monOffset} | ${t.statusUnlocked}</div>
                    </div>
                </div>

                <!-- スペック表 -->
                <div class="codex-specs-grid">
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specDanger}</span>
                        <span class="codex-specs-val" style="color:var(--accent-gold);">${this.escapeHtml(danger)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specSize}</span>
                        <span class="codex-specs-val">${this.escapeHtml(size)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specHp}</span>
                        <span class="codex-specs-val">${this.escapeHtml(hp)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specAc}</span>
                        <span class="codex-specs-val">${this.escapeHtml(ac)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specSpeed}</span>
                        <span class="codex-specs-val">${this.escapeHtml(speed)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specMr}</span>
                        <span class="codex-specs-val">${this.escapeHtml(mr)}</span>
                    </div>
                </div>

                ${attacks.length > 0 ? `
                    <div class="codex-tag-group">
                        <div class="codex-tag-title">⚔️ ${t.specAttacks}</div>
                        <div class="codex-tag-wrap">
                            ${attacks.map(a => `<span class="codex-tag codex-tag-attack">${this.escapeHtml(this.formatAttack(a, isEn))}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${resistances.length > 0 ? `
                    <div class="codex-tag-group">
                        <div class="codex-tag-title">🛡️ ${t.specResists}</div>
                        <div class="codex-tag-wrap">
                            ${resistances.map(r => `<span class="codex-tag codex-tag-resist">${this.escapeHtml(this.formatResistance(r, isEn))}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${attributes.length > 0 ? `
                    <div class="codex-tag-group">
                        <div class="codex-tag-title">✨ ${t.specAttrs}</div>
                        <div class="codex-tag-wrap">
                            ${attributes.map(attr => `<span class="codex-tag codex-tag-attr">${this.escapeHtml(attr)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${desc ? `
                    <div class="codex-desc-box">
                        ${this.escapeHtml(desc)}
                    </div>
                ` : ''}

                ${(relatedLore.length > 0 || lockedLoreCount > 0) ? `
                    <div class="codex-related-section" style="margin-top:14px;">
                        <div class="codex-related-title">${t.lblRelatedLore} (${relatedLore.length})</div>
                        <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                            ${relatedLore.map(lore => {
                                const isOracle = lore.category === 'ORACLE';
                                const badgeTitle = isOracle ? ('🏛️ ' + (isEn ? 'Oracle' : '神託')) : ('📜 #' + (lore.id || ''));
                                const badgeColor = isOracle ? '#c084fc' : '#38bdf8';
                                return `
                                <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px 10px; font-size:12px;">
                                    <div style="color:${badgeColor}; font-weight:700; margin-bottom:2px;">${badgeTitle}</div>
                                    <div style="color:#cbd5e1;">${this.escapeHtml(isEn ? lore.text : (lore.translatedText || lore.text))}</div>
                                </div>
                                `;
                            }).join('')}
                            ${lockedLoreCount > 0 ? `
                                <div style="color:#94a3b8; font-size:11px; padding:6px 10px; background:rgba(148,163,184,0.06); border-radius:6px; border:1px dashed rgba(148,163,184,0.2);">
                                    🔒 ${isEn ? `${lockedLoreCount} related rumor${lockedLoreCount > 1 ? 's' : ''} not yet unlocked` : `未解禁の噂: ${lockedLoreCount}件`}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * アイテム詳細カードのレンダリング
     * @private
     */
    _renderObjectDetail(item, cardEl, isEn, t) {
        const isLocked = item.isUnlocked === false;
        const alm = this.getAdventureLogManager();
        const obj = item.data || {};

        // アバタータイル
        let avatarInner = '';
        if (item.glyphId !== undefined) {
            const styleObj = GlyphHelper.getGlyphStyle(item.glyphId, {
                tileImage: this.getTileImage(),
                tileSize: 32,
                displaySize: 32
            });
            if (styleObj) {
                const styleStr = Object.entries(styleObj)
                    .map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`)
                    .join(';');
                avatarInner = `<div class="codex-entry-avatar-glyph ${isLocked ? 'locked' : ''}" style="${styleStr}"></div>`;
            }
        }
        if (!avatarInner) {
            avatarInner = `<span class="codex-entry-avatar-symbol ${isLocked ? 'locked' : ''}">?</span>`;
        }

        if (isLocked) {
            cardEl.innerHTML = `
                <div class="codex-detail-body">
                    <div class="codex-entry-header">
                        <div class="codex-entry-avatar locked">
                            ${avatarInner}
                        </div>
                        <div class="codex-entry-titles">
                            <div class="codex-entry-name-main" style="color:#94a3b8;">
                                No.${item.onum} ???
                            </div>
                            <div class="codex-entry-name-sub">Unidentified Item</div>
                            <div class="codex-entry-id-badge">ONUM: ${item.onum}</div>
                        </div>
                    </div>
                    <div class="codex-locked-placeholder">
                        <div class="codex-locked-icon">🔒</div>
                        <div class="codex-locked-title">${t.lockedObjectTitle}</div>
                        <div class="codex-locked-hint">${t.lockedObjectHint}</div>
                    </div>
                </div>
            `;
            return;
        }

        // 解禁済みアイテム
        const mainName = isEn ? obj.name : (obj.nameJa || obj.name);
        const subName = isEn ? (obj.nameJa || '') : obj.name;
        const category = obj.category || 'TOOL';
        const cost = obj.cost !== undefined ? `$${obj.cost}` : '--';
        const weight = obj.weight !== undefined ? `${obj.weight}` : '--';
        const skill = obj.skill || '--';
        const damage = (obj.damageSmall && obj.damageLarge) ? `${obj.damageSmall} / ${obj.damageLarge}` : (obj.ac !== undefined ? `AC: ${obj.ac}` : '--');
        const effect = isEn ? (obj.effectSummaryEn || obj.effectSummary || '') : (obj.effectSummaryJa || obj.effectSummary || '');
        const desc = isEn ? (obj.flavorTextEn || obj.description || '') : (obj.flavorTextJa || obj.description || obj.flavorTextEn || '');

        const allRelatedLore = alm ? alm.getRelatedLore(obj, { unlockedOnly: false }) : [];
        const relatedLore = allRelatedLore.filter(l => l.isUnlocked !== false);
        const lockedLoreCount = allRelatedLore.filter(l => l.isUnlocked === false).length;

        cardEl.innerHTML = `
            <div class="codex-detail-body">
                <div class="codex-entry-header">
                    <div class="codex-entry-avatar">
                        ${avatarInner}
                    </div>
                    <div class="codex-entry-titles">
                        <div class="codex-entry-name-main">
                            <span>${this.escapeHtml(mainName)}</span>
                            <span class="codex-item-badge badge-object" style="font-size:11px;">[${this.escapeHtml(category)}]</span>
                        </div>
                        <div class="codex-entry-name-sub">${this.escapeHtml(subName)}</div>
                        <div class="codex-entry-id-badge">No.${item.onum} | ${t.statusUnlocked}</div>
                    </div>
                </div>

                <!-- スペック表 -->
                <div class="codex-specs-grid">
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specCategory}</span>
                        <span class="codex-specs-val" style="color:#fbbf24;">${this.escapeHtml(category)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specCost}</span>
                        <span class="codex-specs-val" style="color:var(--accent-gold);">${this.escapeHtml(cost)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specWeight}</span>
                        <span class="codex-specs-val">${this.escapeHtml(weight)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specSkill}</span>
                        <span class="codex-specs-val">${this.escapeHtml(skill)}</span>
                    </div>
                    <div class="codex-specs-cell">
                        <span class="codex-specs-key">${t.specDamage}</span>
                        <span class="codex-specs-val">${this.escapeHtml(damage)}</span>
                    </div>
                </div>

                ${effect ? `
                    <div class="codex-tag-group">
                        <div class="codex-tag-title">⚡ ${t.specAdvice}</div>
                        <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2); border-radius:6px; padding:8px 12px; font-size:12px; color:#e2e8f0;">
                            ${this.escapeHtml(effect)}
                        </div>
                    </div>
                ` : ''}

                ${desc ? `
                    <div class="codex-desc-box">
                        ${this.escapeHtml(desc)}
                    </div>
                ` : ''}

                ${(relatedLore.length > 0 || lockedLoreCount > 0) ? `
                    <div class="codex-related-section" style="margin-top:14px;">
                        <div class="codex-related-title">${t.lblRelatedLore} (${relatedLore.length})</div>
                        <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                            ${relatedLore.map(lore => {
                                const isOracle = lore.category === 'ORACLE';
                                const badgeTitle = isOracle ? ('🏛️ ' + (isEn ? 'Oracle' : '神託')) : ('📜 #' + (lore.id || ''));
                                const badgeColor = isOracle ? '#c084fc' : '#38bdf8';
                                return `
                                <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:8px 10px; font-size:12px;">
                                    <div style="color:${badgeColor}; font-weight:700; margin-bottom:2px;">${badgeTitle}</div>
                                    <div style="color:#cbd5e1;">${this.escapeHtml(isEn ? lore.text : (lore.translatedText || lore.text))}</div>
                                </div>
                                `;
                            }).join('')}
                            ${lockedLoreCount > 0 ? `
                                <div style="color:#94a3b8; font-size:11px; padding:6px 10px; background:rgba(148,163,184,0.06); border-radius:6px; border:1px dashed rgba(148,163,184,0.2);">
                                    🔒 ${isEn ? `${lockedLoreCount} related rumor${lockedLoreCount > 1 ? 's' : ''} not yet unlocked` : `未解禁の噂: ${lockedLoreCount}件`}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * 伝承（噂話・神託・床文字）詳細カードのレンダリング
     * @private
     */
    _renderLoreDetail(item, cardEl, isEn, t) {
        if (item.category === 'ORACLE' && item.isUnlocked === false) {
            cardEl.innerHTML = `
                <div class="codex-detail-body">
                    <div class="codex-detail-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
                        <div class="codex-detail-title-group">
                            <div><span class="codex-item-badge badge-oracle" style="font-size:12px; padding:3px 8px;">${t.truthBadgeOracle}</span></div>
                            <div style="font-size:15px; font-weight:700; color:#94a3b8; margin-top:4px;">No.${(item.id || '').replace(/^oracle_/, '')} ???</div>
                        </div>
                        <div style="text-align:right;">
                            <div class="codex-detail-id">${this.escapeHtml(item.id || '')}</div>
                        </div>
                    </div>
                    <div class="codex-locked-placeholder" style="margin-top:20px;">
                        <div class="codex-locked-icon">🔒</div>
                        <div class="codex-locked-title">${isEn ? 'Undiscovered Oracle' : '未解禁の神託'}</div>
                        <div class="codex-locked-hint">${isEn ? 'Consult the Oracle in Delphi to receive and unlock this ancient wisdom.' : 'デルフィの神託所で神託（大預言）を授かることで、この古代の知恵が解禁されます。'}</div>
                    </div>
                </div>
            `;
            return;
        }

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

        // 関連エンティティ（クロスリファレンス）
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

    /**
     * 攻撃手段オブジェクトまたは文字列を読みやすいテキストに変換
     * @param {Object|string} a
     * @param {boolean} isEn
     * @returns {string}
     */
    formatAttack(a, isEn) {
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
     * 耐性文字列を読みやすいテキストに変換
     * @param {string} r
     * @param {boolean} isEn
     * @returns {string}
     */
    formatResistance(r, isEn) {
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

    /**
     * モンスターの特性・能力タグを抽出
     * @param {Object} mon
     * @param {boolean} isEn
     * @returns {Array<string>}
     */
    getMonsterAttributeTags(mon, isEn) {
        if (!mon) return [];
        const tags = [];
        const add = (ja, en) => tags.push(isEn ? en : ja);

        if (mon.canFly) add('飛行', 'Flying');
        if (mon.canSwim) add('水棲', 'Swimming');
        if (mon.passesWalls) add('壁通過', 'Passes Walls');
        if (mon.isUndead) add('アンデッド', 'Undead');
        if (mon.isDemon) add('悪魔', 'Demon');
        if (mon.isUnique) add('固有種', 'Unique');
        if (mon.canPolymorph === false) add('変化耐性', 'Unpoly');
        if (mon.canGenocide === false) add('絶滅不能', 'Ungenocidable');
        if (mon.hasHands === false) add('手なし', 'Handless');

        const traits = mon.traits || {};
        if (mon.petrifiesOnTouch || traits.petrifiesOnTouch) add('接触石化', 'Petrifying Touch');
        if (mon.paralysisGaze || traits.paralysisGaze) add('麻痺睨み', 'Paralyzing Gaze');
        if (mon.explodesOnMelee || traits.explodesOnMelee) add('近接爆発', 'Explodes On Melee');
        if (traits.causesLycanthropy) add('獣人症伝染', 'Lycanthropy');
        if (traits.revives) add('自己復活', 'Revives');
        if (traits.regenerates) add('自動再生', 'Regeneration');
        if (traits.invisible) add('不可視', 'Invisible');
        if (traits.seeInvisible) add('可視能力', 'See Invisible');
        if (traits.teleport) add('テレポート', 'Teleporting');
        if (traits.teleportControl) add('制御テレポート', 'Teleport Control');

        return tags;
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

export default CodexModal;
