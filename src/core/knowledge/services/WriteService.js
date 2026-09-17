/**
 * WriteService.js - NetHack 魔法のマーカー（Write）支援ナレッジサービス
 *
 * GKL (Game Knowledge Layer) の一部として、以下の機能を提供します：
 * 1. 白紙の巻物・白紙の魔法書に書き込み可能なアイテムカタログの提供
 * 2. NetHack 5.0 (write.c) 準拠のインク消費コスト（最小〜最大）計算
 * 3. 識別状態（真名識別・外見遭遇・習得呪文）に基づく安全性ステータス判定（事故防止ガード）
 * 4. 定番プリセット（虐殺、充填、鑑定、解呪、魔法の地図等の巻物、および主要魔法書）の提供
 * 5. 日英・エイリアス対応のインクリメンタルサジェスト検索
 * 6. NetHack Cコアの dowrite() へ送出する正規コマンド文字列の生成
 */

import { OBJECT_KNOWLEDGE_MAP, buildStandardItemName } from "../data/OBJECT_KNOWLEDGE_FULL.js";
import { OBJECT_KNOWLEDGE_BASE } from "../data/OBJECT_KNOWLEDGE_BASE.js";
import { OBJECT_JP_MAP } from "../data/OBJECT_JP_MAP.js";

/**
 * 巻物の基準インク消費コスト (write.c cost() 準拠)
 */
export const SCROLL_BASE_COSTS = {
    'mail': 2,
    'light': 8,
    'gold detection': 8,
    'food detection': 8,
    'magic mapping': 8,
    'amnesia': 8,
    'fire': 8,
    'earth': 8,
    'destroy armor': 10,
    'create monster': 10,
    'punishment': 10,
    'confuse monster': 12,
    'identify': 14,
    'enchant armor': 16,
    'remove curse': 16,
    'enchant weapon': 16,
    'charging': 16,
    'scare monster': 20,
    'stinking cloud': 20,
    'taming': 20,
    'teleportation': 20,
    'genocide': 30
};

/**
 * 安全性ステータス定義
 */
export const WRITE_SAFETY_STATUS = {
    IDENTIFIED: 'IDENTIFIED',             // 識別済み（成功率 100%）
    ENCOUNTERED_LABEL: 'ENCOUNTERED_LABEL', // ラベル遭遇済み（外見名で安全に書き込み可能）
    KNOWN_SPELL: 'KNOWN_SPELL',           // 呪文習得中（魔法書を安全に書き込み可能）
    UNKNOWN_RISKY: 'UNKNOWN_RISKY'        // 未識別・未遭遇（失敗・消滅リスク高）
};

/**
 * おすすめ定番プリセット
 */
export const WRITE_PRESETS = {
    SCROLL: [
        {
            id: 'scroll_genocide',
            name: 'scroll of genocide',
            writeName: 'genocide',
            labelJa: '虐殺の巻物 (最優先)',
            labelEn: 'scroll of genocide (Top Priority)',
            costRange: [15, 30],
            descriptionJa: '危険なモンスター種族（リッチ、マインドフレイヤ等）を絶滅'
        },
        {
            id: 'scroll_charging',
            name: 'scroll of charging',
            writeName: 'charging',
            labelJa: '充填の巻物 (願杖・重要道具用)',
            labelEn: 'scroll of charging',
            costRange: [8, 16],
            descriptionJa: '願いの杖や魔法のランプ、有用な杖を再充填'
        },
        {
            id: 'scroll_identify',
            name: 'scroll of identify',
            writeName: 'identify',
            labelJa: '鑑定の巻物 (持ち物鑑別)',
            labelEn: 'scroll of identify',
            costRange: [7, 14],
            descriptionJa: '手持ちの未識別アイテムを一括鑑定'
        },
        {
            id: 'scroll_remove_curse',
            name: 'scroll of remove curse',
            writeName: 'remove curse',
            labelJa: '解呪の巻物 (緊急リカバリ)',
            labelEn: 'scroll of remove curse',
            costRange: [8, 16],
            descriptionJa: '呪われた装備・アイテムの呪いを解除'
        },
        {
            id: 'scroll_magic_mapping',
            name: 'scroll of magic mapping',
            writeName: 'magic mapping',
            labelJa: '魔法の地図の巻物 (迷宮探索)',
            labelEn: 'scroll of magic mapping',
            costRange: [4, 8],
            descriptionJa: '現在の階層の全マップ構造・隠し扉を可視化'
        },
        {
            id: 'scroll_enchant_armor',
            name: 'scroll of enchant armor',
            writeName: 'enchant armor',
            labelJa: '防具強化の巻物 (AC向上)',
            labelEn: 'scroll of enchant armor',
            costRange: [8, 16],
            descriptionJa: '装備中の防具を強化してACを改善'
        },
        {
            id: 'scroll_enchant_weapon',
            name: 'scroll of enchant weapon',
            writeName: 'enchant weapon',
            labelJa: '武器強化の巻物 (命中・攻撃力)',
            labelEn: 'scroll of enchant weapon',
            costRange: [8, 16],
            descriptionJa: '主力武器の強化値を上げて威力向上'
        }
    ],
    SPELLBOOK: [
        {
            id: 'spellbook_identify',
            name: 'spellbook of identify',
            writeName: 'identify',
            level: 3,
            labelJa: '識別の呪文書 (Lv3)',
            labelEn: 'spellbook of identify (Lv3)',
            costRange: [15, 30],
            descriptionJa: '何回でも手持ちのアイテムを鑑定できる最重要呪文'
        },
        {
            id: 'spellbook_magic_missile',
            name: 'spellbook of magic missile',
            writeName: 'magic missile',
            level: 2,
            labelJa: '魔法の矢の呪文書 (Lv2)',
            labelEn: 'spellbook of magic missile (Lv2)',
            costRange: [10, 20],
            descriptionJa: '反射可能で威力・燃費に優れる主戦遠距離攻撃呪文'
        },
        {
            id: 'spellbook_remove_curse',
            name: 'spellbook of remove curse',
            writeName: 'remove curse',
            level: 3,
            labelJa: '解呪の呪文書 (Lv3)',
            labelEn: 'spellbook of remove curse (Lv3)',
            costRange: [15, 30],
            descriptionJa: 'いつでも呪いを解除できる安全確保呪文'
        },
        {
            id: 'spellbook_healing',
            name: 'spellbook of healing',
            writeName: 'healing',
            level: 1,
            labelJa: '回復の呪文書 (Lv1)',
            labelEn: 'spellbook of healing (Lv1)',
            costRange: [5, 10],
            descriptionJa: '低コストでHPを回復できる基本生存呪文'
        },
        {
            id: 'spellbook_dig',
            name: 'spellbook of dig',
            writeName: 'dig',
            level: 5,
            labelJa: '穴掘りの呪文書 (Lv5)',
            labelEn: 'spellbook of dig (Lv5)',
            costRange: [25, 50],
            descriptionJa: '岩壁を瞬時に掘り抜き下り階段への直通穴を開ける'
        },
        {
            id: 'spellbook_teleport_away',
            name: 'spellbook of teleport away',
            writeName: 'teleport away',
            level: 6,
            labelJa: 'テレポートの呪文書 (Lv6)',
            labelEn: 'spellbook of teleport away (Lv6)',
            costRange: [30, 60],
            descriptionJa: '危険な敵を遠くへ飛ばす、または自身を緊急脱出させる'
        }
    ]
};

export class WriteService {
    constructor(options = {}) {
        this.translator = options.translator || null;
        this.language = options.language || 'ja';
        this.discoveryStateManager = options.discoveryStateManager || null;
        this.spellStateManager = options.spellStateManager || null;

        this._scrollCatalog = null;
        this._spellbookCatalog = null;
        this._aliases = new Map();
        this._initAliases();
    }

    setLanguage(lang = 'ja') {
        this.language = (lang === 'en' || lang === 'english') ? 'en' : 'ja';
        this._scrollCatalog = null;
        this._spellbookCatalog = null;
    }

    setTranslator(translator) {
        this.translator = translator;
        this._scrollCatalog = null;
        this._spellbookCatalog = null;
    }

    setDiscoveryStateManager(dsm) {
        this.discoveryStateManager = dsm;
    }

    setSpellStateManager(ssm) {
        this.spellStateManager = ssm;
    }

    /**
     * エイリアス辞書の初期化
     * @private
     */
    _initAliases() {
        const addAlias = (alias, target) => {
            this._aliases.set(alias.toLowerCase(), target.toLowerCase());
        };

        if (OBJECT_JP_MAP && OBJECT_JP_MAP.aliases) {
            for (const [alias, target] of Object.entries(OBJECT_JP_MAP.aliases)) {
                addAlias(alias, target);
            }
        }

        addAlias('虐殺', 'genocide');
        addAlias('充填', 'charging');
        addAlias('鑑定', 'identify');
        addAlias('識別', 'identify');
        addAlias('解呪', 'remove curse');
        addAlias('地図', 'magic mapping');
        addAlias('武器強化', 'enchant weapon');
        addAlias('防具強化', 'enchant armor');
        addAlias('テレポート', 'teleportation');
        addAlias('穴掘り', 'dig');
        addAlias('回復', 'healing');
        addAlias('魔法の矢', 'magic missile');
    }

    /**
     * カタログの取得（targetType: 'SCROLL' | 'SPELLBOOK'）
     * @param {'SCROLL' | 'SPELLBOOK'} targetType
     * @returns {Array<Object>}
     */
    getCatalog(targetType = 'SCROLL') {
        const type = (targetType || 'SCROLL').toUpperCase();
        if (type === 'SPELLBOOK') {
            if (!this._spellbookCatalog) {
                this._spellbookCatalog = this._buildSpellbookCatalog();
            }
            return this._spellbookCatalog;
        }

        if (!this._scrollCatalog) {
            this._scrollCatalog = this._buildScrollCatalog();
        }
        return this._scrollCatalog;
    }

    /**
     * 定番プリセットの取得
     * @param {'SCROLL' | 'SPELLBOOK'} targetType
     * @returns {Array<Object>}
     */
    getPresets(targetType = 'SCROLL') {
        const type = (targetType || 'SCROLL').toUpperCase();
        return WRITE_PRESETS[type] || WRITE_PRESETS.SCROLL;
    }

    /**
     * 巻物カタログの構築
     * @private
     */
    _buildScrollCatalog() {
        const catalog = [];
        const seenNames = new Set();

        for (let onum = 0; onum <= 480; onum++) {
            const item = OBJECT_KNOWLEDGE_MAP.get(onum);
            if (!item || item.category !== 'SCROLL') continue;

            const fullName = buildStandardItemName(onum, 'SCROLL', item.name, item.tileName);
            const lowerFullName = fullName.toLowerCase();
            if (seenNames.has(lowerFullName)) continue;
            seenNames.add(lowerFullName);

            // 書くことができないアイテムの除外
            const cleanName = lowerFullName.replace(/^scroll of\s+/i, '').trim();
            if (cleanName === 'blank paper' || cleanName === 'generic scroll' || cleanName === 'mail') {
                continue;
            }

            const baseCost = SCROLL_BASE_COSTS[cleanName] ?? 16;
            const minCost = Math.floor(baseCost / 2);
            const maxCost = baseCost;

            // 日本語名の解決
            let jaName = item.nameJa || item.ja || '';
            if (this.translator && typeof this.translator.translate === 'function') {
                const tr = this.translator.translate(fullName, 'ja') || this.translator.translate(item.name, 'ja');
                if (tr && tr !== fullName && tr !== item.name) {
                    jaName = tr;
                }
            }
            if (typeof jaName === 'object' && jaName !== null) {
                jaName = jaName.noun || jaName.adj || String(jaName);
            }
            jaName = String(jaName || fullName);

            catalog.push({
                onum: onum,
                id: item.id || `scroll_${cleanName.replace(/\s+/g, '_')}`,
                name: fullName,
                writeName: cleanName,
                nameJa: jaName,
                category: 'SCROLL',
                baseCost: baseCost,
                costRange: [minCost, maxCost],
                effectSummary: item.effectSummary || ''
            });
        }

        // コスト順 ➔ 名前順でソート
        return catalog.sort((a, b) => b.baseCost - a.baseCost || a.writeName.localeCompare(b.writeName));
    }

    /**
     * 魔法書カタログの構築
     * @private
     */
    _buildSpellbookCatalog() {
        const catalog = [];
        const seenNames = new Set();

        for (let onum = 0; onum <= 480; onum++) {
            const item = OBJECT_KNOWLEDGE_MAP.get(onum);
            if (!item || item.category !== 'SPELLBOOK') continue;

            const fullName = buildStandardItemName(onum, 'SPELLBOOK', item.name, item.tileName);
            const lowerFullName = fullName.toLowerCase();
            if (seenNames.has(lowerFullName)) continue;
            seenNames.add(lowerFullName);

            // 書くことができないアイテムの除外（死者の書、小説、白紙の魔法書、generic）
            const cleanName = lowerFullName.replace(/^spellbook of\s+/i, '').trim();
            if (cleanName === 'blank paper' || cleanName === 'book of the dead' || cleanName === 'novel' || cleanName === 'generic spellbook') {
                continue;
            }

            // レベル取得 (OBJECT_KNOWLEDGE_BASE から)
            const baseObj = OBJECT_KNOWLEDGE_BASE[onum];
            const spellLevel = (baseObj && baseObj.spellLevel) ? baseObj.spellLevel : 1;
            const baseCost = 10 * spellLevel;
            const minCost = Math.floor(baseCost / 2);
            const maxCost = baseCost;

            // 日本語名の解決
            let jaName = item.nameJa || item.ja || '';
            if (this.translator && typeof this.translator.translate === 'function') {
                const tr = this.translator.translate(fullName, 'ja') || this.translator.translate(item.name, 'ja');
                if (tr && tr !== fullName && tr !== item.name) {
                    jaName = tr;
                }
            }
            if (typeof jaName === 'object' && jaName !== null) {
                jaName = jaName.noun || jaName.adj || String(jaName);
            }
            jaName = String(jaName || fullName);

            catalog.push({
                onum: onum,
                id: item.id || `spellbook_${cleanName.replace(/\s+/g, '_')}`,
                name: fullName,
                writeName: cleanName,
                nameJa: jaName,
                category: 'SPELLBOOK',
                level: spellLevel,
                baseCost: baseCost,
                costRange: [minCost, maxCost],
                effectSummary: item.effectSummary || ''
            });
        }

        // レベル順 ➔ 名前順でソート
        return catalog.sort((a, b) => a.level - b.level || a.writeName.localeCompare(b.writeName));
    }

    /**
     * 指定アイテムの安全性（識別状態・事故リスク）を評価
     * @param {Object|string|number} item - カタログ項目、名前、または onum
     * @param {'SCROLL' | 'SPELLBOOK'} targetType
     * @returns {Object} { status, isSafe, labelJa, labelEn, badgeClass, warningMessageJa, warningMessageEn }
     */
    evaluateSafety(item, targetType = 'SCROLL') {
        const type = (targetType || 'SCROLL').toUpperCase();
        let onum = null;
        let itemName = '';
        let writeName = '';

        if (typeof item === 'object' && item !== null) {
            onum = item.onum ?? null;
            itemName = item.name || '';
            writeName = item.writeName || itemName;
        } else if (typeof item === 'number') {
            onum = item;
            const meta = OBJECT_KNOWLEDGE_MAP.get(onum);
            if (meta) {
                itemName = meta.name;
                writeName = meta.name.replace(/^(scroll|spellbook) of\s+/i, '');
            }
        } else if (typeof item === 'string') {
            writeName = item.toLowerCase().replace(/^(scroll|spellbook) of\s+/i, '').trim();
            itemName = (type === 'SPELLBOOK') ? `spellbook of ${writeName}` : `scroll of ${writeName}`;
        }

        // 1. 識別済みチェック (DiscoveryStateManager)
        let isIdentified = false;
        let appearanceLabel = null;

        if (this.discoveryStateManager) {
            if (onum !== null && typeof this.discoveryStateManager.isIdentified === 'function') {
                isIdentified = this.discoveryStateManager.isIdentified(onum);
            } else if (itemName && typeof this.discoveryStateManager.isIdentified === 'function') {
                isIdentified = this.discoveryStateManager.isIdentified(itemName);
            }

            // 外見遭遇チェック（巻物のみ）
            if (!isIdentified && type === 'SCROLL' && this.discoveryStateManager.appearanceMap) {
                // appearanceMap のキーや値からこの巻物の外見（ラベル）を探す
                for (const [app, trueName] of this.discoveryStateManager.appearanceMap.entries()) {
                    if (trueName.toLowerCase().includes(writeName)) {
                        appearanceLabel = app;
                        break;
                    }
                }
            }
        }

        if (isIdentified) {
            return {
                status: WRITE_SAFETY_STATUS.IDENTIFIED,
                isSafe: true,
                badgeClass: 'badge-success',
                labelJa: '識別済み (100% 成功)',
                labelEn: 'Identified (100% Success)',
                warningMessageJa: null,
                warningMessageEn: null
            };
        }

        // 2. 巻物のラベル遭遇チェック
        if (type === 'SCROLL' && appearanceLabel) {
            return {
                status: WRITE_SAFETY_STATUS.ENCOUNTERED_LABEL,
                isSafe: true,
                appearanceLabel: appearanceLabel,
                badgeClass: 'badge-warning',
                labelJa: `ラベル遭遇済み ("${appearanceLabel}")`,
                labelEn: `Encountered Label ("${appearanceLabel}")`,
                warningMessageJa: `真名は未識別ですが、外見ラベル "${appearanceLabel}" を知っているため安全に書き込めます。`,
                warningMessageEn: `Unidentified true name, but can be safely written using known label "${appearanceLabel}".`
            };
        }

        // 3. 呪文習得チェック（魔法書のみ）
        if (type === 'SPELLBOOK' && this.spellStateManager) {
            const spells = (typeof this.spellStateManager.getSpells === 'function')
                ? this.spellStateManager.getSpells()
                : (this.spellStateManager.spells || []);

            const hasSpell = spells.some(sp => {
                const spName = (sp.name || '').toLowerCase().trim();
                return spName === writeName;
            });

            if (hasSpell) {
                return {
                    status: WRITE_SAFETY_STATUS.KNOWN_SPELL,
                    isSafe: true,
                    badgeClass: 'badge-info',
                    labelJa: '呪文習得中 (安全)',
                    labelEn: 'Known Spell (Safe)',
                    warningMessageJa: '現在この呪文を習得しているため、未識別の魔法書でも安全に書くことができます。',
                    warningMessageEn: 'You currently know this spell, so you can safely write it even if the spellbook is unidentified.'
                };
            }
        }

        // 4. 未知・危険（高確率で失敗し紙とインクが消滅）
        return {
            status: WRITE_SAFETY_STATUS.UNKNOWN_RISKY,
            isSafe: false,
            badgeClass: 'badge-danger',
            labelJa: '未識別 (危険: 失敗リスク大)',
            labelEn: 'Unidentified (High Risk)',
            warningMessageJa: '⚠️ このアイテムは未識別です！書こうとすると高確率で失敗し、白紙とインクが消滅します（幸運度が高い場合のみ極めて低確率で成功）。',
            warningMessageEn: '⚠️ This item is unidentified! Attempting to write it will likely fail and destroy the blank paper and ink.'
        };
    }

    /**
     * インクリメンタルサジェスト検索
     * @param {string} query - 検索クエリ
     * @param {'SCROLL' | 'SPELLBOOK'} targetType
     * @returns {Array<Object>}
     */
    search(query = '', targetType = 'SCROLL') {
        const catalog = this.getCatalog(targetType);
        if (!query || typeof query !== 'string' || !query.trim()) {
            return catalog;
        }

        const raw = query.trim().toLowerCase();
        const cleanQuery = raw.replace(/^(scroll|spellbook) of\s+/i, '');
        const aliasTarget = this._aliases.get(raw) || this._aliases.get(cleanQuery) || cleanQuery;

        return catalog.filter(item => {
            const nameLower = item.name.toLowerCase();
            const writeLower = item.writeName.toLowerCase();
            const jaLower = (item.nameJa || '').toLowerCase();

            return writeLower.includes(cleanQuery)
                || writeLower.includes(aliasTarget)
                || nameLower.includes(cleanQuery)
                || jaLower.includes(cleanQuery)
                || jaLower.includes(raw);
        });
    }

    /**
     * NetHack C コアへ送信する正規コマンド文字列を生成
     * @param {Object|string} item - 選択されたアイテムまたは名称
     * @param {Object} [options={}] - { useLabel: boolean, label: string }
     * @returns {string} コマンド文字列
     */
    buildWriteCommand(item, options = {}) {
        if (!item) return '';

        if (options.useLabel && options.label) {
            return options.label.trim();
        }

        let writeName = '';
        if (typeof item === 'object' && item !== null) {
            writeName = item.writeName || item.name || '';
        } else if (typeof item === 'string') {
            writeName = item;
        }

        // カテゴリプレフィックスを除去してシンプルな英語名にする
        writeName = writeName.replace(/^(scroll|spellbook) of\s+/i, '').trim();
        return writeName;
    }

    /**
     * 他ナレッジサービス (GenocideService等) とのインターフェース統一エイリアス
     */
    serializeCommand(item, options = {}) {
        return this.buildWriteCommand(item, options);
    }
}
