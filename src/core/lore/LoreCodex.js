/**
 * LoreCodex.js - 冒険手帳・伝承コレクションマネージャ
 *
 * プレイヤーが獲得した噂話 (Rumor)、神託 (Oracle)、床の結界文字 (Engrave / Elbereth)
 * をセッション横断で蓄積・検索・真偽照合・統計集計する知識基盤。
 */

import { LoreCodexStorage } from './LoreCodexStorage.js';
import { LORE_MASTER } from './data/LoreMasterData.js';
import { WARD_STATUS } from './ElberethAnalyzer.js';

export class LoreCodex {
    /**
     * @param {Object} [options]
     * @param {LoreCodexStorage} [options.storage] - カスタムストレージ
     * @param {boolean} [options.autoLoad=true] - 初期化時にストレージから自動復元するか
     * @param {Object} [options.translationEngine] - 翻訳エンジン (TranslationEngine)
     * @param {Object} [options.translator] - 翻訳エンジン別名
     * @param {Object} [options.master] - カスタム LORE マスタ
     */
    constructor(options = {}) {
        this.storage = options.storage || new LoreCodexStorage();
        this.translationEngine = options.translationEngine || options.translator || null;
        this.rumors = new Map();     // rumorId -> rumorObject
        this.oracles = new Map();    // oracleId -> oracleObject
        this.engravings = new Map(); // engravingId -> engravingObject (床文字・落書き・墓碑銘コレクション)
        this.currentWard = null;     // 最新の結界状態
        this.listeners = new Set();
        this.master = options.master || LORE_MASTER;

        if (options.autoLoad !== false) {
            this.load();
        }
    }

    /**
     * 翻訳エンジンの設定・更新（最新辞書による翻訳再解決も同時に実行）
     * @param {Object} engine - TranslationEngine インスタンス
     */
    setTranslationEngine(engine) {
        this.translationEngine = engine;
        this.refreshTranslations();
    }

    /**
     * 辞書更新や言語切り替え時に全メモリ上エントリの翻訳を再解決
     */
    refreshTranslations() {
        for (const [id, r] of this.rumors.entries()) {
            r.translatedText = this._resolveTranslation(r, 'RUMOR');
            if (!r.relatedEntities || r.relatedEntities.length === 0) {
                const rel = this._resolveRelatedEntities(r, 'RUMOR');
                if (rel && rel.length > 0) r.relatedEntities = rel;
            }
        }
        for (const [id, o] of this.oracles.entries()) {
            o.translatedText = this._resolveTranslation(o, 'ORACLE');
            if (!o.relatedEntities || o.relatedEntities.length === 0) {
                const rel = this._resolveRelatedEntities(o, 'ORACLE');
                if (rel && rel.length > 0) o.relatedEntities = rel;
            }
        }
        for (const [id, e] of this.engravings.entries()) {
            const cat = e.category || (e.isHeadstone ? 'HEADSTONE' : 'ENGRAVING');
            e.translatedText = this._resolveTranslation(e, cat);
            if (!e.relatedEntities || e.relatedEntities.length === 0) {
                const rel = this._resolveRelatedEntities(e, cat);
                if (rel && rel.length > 0) e.relatedEntities = rel;
            }
        }
        this._notify('translationsRefreshed', null);
    }

    /**
     * エントリの日本語訳を動的に解決（マスタまたは翻訳エンジン）
     * @param {Object} item
     * @param {'RUMOR'|'ORACLE'|'ENGRAVING'|'HEADSTONE'|'ELBERETH'} [category]
     * @returns {string}
     * @private
     */
    _resolveTranslation(item, category = null) {
        if (!item) return '';

        const targetCat = category || item.category || (item.isHeadstone ? 'HEADSTONE' : '');

        // 1. Elbereth の場合
        if (targetCat === 'ELBERETH' || item.isElbereth) {
            return 'エルベレス';
        }

        const rawText = (item.text || item.actualText || '').trim();
        if (!rawText) return item.translatedText || '';

        // 2. マスタデータからの逆引き
        if (targetCat === 'RUMOR') {
            if (this.master?.rumors) {
                const found = this.master.rumors.find(r => r.id === item.id || r.text === rawText);
                if (found && found.translatedText) return found.translatedText;
            }
        } else if (targetCat === 'ORACLE') {
            if (this.master?.oracles) {
                const found = this.master.oracles.find(o => o.id === item.id || o.text === rawText);
                if (found && found.translatedText) return found.translatedText;
            }
        } else if (targetCat === 'ENGRAVING' && !item.isHeadstone) {
            if (this.master?.engravings) {
                const found = this.master.engravings.find(e => e.id === item.id || e.text === rawText);
                if (found && found.translatedText) return found.translatedText;
            }
        }

        // 3. TranslationEngine による動的翻訳（墓碑銘やマスタ外の床文字・噂話）
        if (this.translationEngine && typeof this.translationEngine.translate === 'function') {
            const translated = this.translationEngine.translate(rawText);
            if (translated && translated !== rawText) {
                return translated;
            }
        }

        // 4. 既存の translatedText があればフォールバック
        return item.translatedText || '';
    }

    /**
     * エントリの関連知識 (relatedEntities) を動的に解決（直接指定またはマスタデータ）
     * @param {Object} item
     * @param {'RUMOR'|'ORACLE'|'ENGRAVING'|'HEADSTONE'|'ELBERETH'} [category]
     * @returns {Array<Object>}
     * @private
     */
    _resolveRelatedEntities(item, category = null) {
        if (!item) return [];
        if (Array.isArray(item.relatedEntities) && item.relatedEntities.length > 0) {
            return item.relatedEntities;
        }

        const targetCat = category || item.category || (item.isHeadstone ? 'HEADSTONE' : '');
        const rawText = (item.text || item.actualText || '').trim();
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const rawNorm = norm(rawText);

        if (targetCat === 'RUMOR') {
            if (this.master?.rumors) {
                const found = this.master.rumors.find(r => 
                    (item.id && r.id === item.id) || 
                    (rawText && r.text === rawText) ||
                    (rawNorm && norm(r.text) === rawNorm)
                );
                if (found && Array.isArray(found.relatedEntities) && found.relatedEntities.length > 0) {
                    return found.relatedEntities;
                }
            }
        } else if (targetCat === 'ORACLE') {
            if (this.master?.oracles) {
                const found = this.master.oracles.find(o => 
                    (item.id && o.id === item.id) || 
                    (rawText && (o.text === rawText || o.normalizedText === rawText)) ||
                    (rawNorm && (norm(o.text) === rawNorm || norm(o.normalizedText) === rawNorm))
                );
                if (found && Array.isArray(found.relatedEntities) && found.relatedEntities.length > 0) {
                    return found.relatedEntities;
                }
            }
        } else if (targetCat === 'ENGRAVING' && !item.isHeadstone) {
            if (this.master?.engravings) {
                const found = this.master.engravings.find(e => 
                    (item.id && e.id === item.id) || 
                    (rawText && (e.text === rawText || e.normalizedText === rawText)) ||
                    (rawNorm && (norm(e.text) === rawNorm || norm(e.normalizedText) === rawNorm))
                );
                if (found && Array.isArray(found.relatedEntities) && found.relatedEntities.length > 0) {
                    return found.relatedEntities;
                }
            }
        }

        return [];
    }

    /**
     * 変更リスナーの登録
     * @param {Function} listener
     * @returns {Function} 解除関数
     */
    subscribe(listener) {
        if (typeof listener === 'function') {
            this.listeners.add(listener);
        }
        return () => this.listeners.delete(listener);
    }

    _notify(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data, this);
            } catch (e) {
                console.error('[LoreCodex] Listener error:', e);
            }
        }
    }

    /**
     * 噂話の追加・記録
     *
     * @param {Object} rumor
     * @param {string} rumor.id - 噂ID (例: 'rumor_tru_1')
     * @param {string} rumor.text - 英語原文
     * @param {string} [rumor.translatedText] - 日本語訳
     * @param {boolean} rumor.isTrue - 真偽
     * @param {string} [rumor.source='cookie'] - 入手元 ('cookie'|'paper'|'oracle')
     * @returns {{ isNew: boolean, rumor: Object }}
     */
    addRumor(rumor) {
        if (!rumor || (!rumor.id && !rumor.text)) {
            return { isNew: false, rumor: null };
        }

        const id = rumor.id || `custom_${rumor.text.substring(0, 20)}`;
        const existing = this.rumors.get(id);
        const isNew = !existing;

        const tr = rumor.translatedText || this._resolveTranslation({ id, text: rumor.text }, 'RUMOR');
        const related = rumor.relatedEntities || existing?.relatedEntities || this._resolveRelatedEntities({ id, text: rumor.text }, 'RUMOR');
        const entry = {
            id: id,
            text: rumor.text,
            translatedText: tr || existing?.translatedText || '',
            isTrue: rumor.isTrue !== undefined ? rumor.isTrue : (existing ? existing.isTrue : true),
            category: 'RUMOR',
            subCategory: rumor.isTrue ? 'TRUE_RUMOR' : 'FALSE_RUMOR',
            source: rumor.source || existing?.source || 'unknown',
            firstDiscoveredAt: existing ? existing.firstDiscoveredAt : new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            seenCount: (existing?.seenCount || 0) + 1
        };
        if (related && related.length > 0) {
            entry.relatedEntities = related;
        }

        this.rumors.set(id, entry);
        this._autoSave();
        this._notify('rumorAdded', { isNew, rumor: entry });

        return { isNew, rumor: entry };
    }

    /**
     * 神託の追加・記録
     *
     * @param {Object} oracle
     * @param {string} oracle.id - 神託ID (例: 'oracle_1')
     * @param {string} oracle.text - 英文
     * @param {string} [oracle.translatedText] - 日本語訳
     * @param {string} [oracle.title] - 概要タイトル
     * @param {boolean} [oracle.isSpecial=false]
     * @returns {{ isNew: boolean, oracle: Object }}
     */
    addOracle(oracle) {
        if (!oracle || (!oracle.id && !oracle.text)) {
            return { isNew: false, oracle: null };
        }

        const id = oracle.id || `custom_oracle_${oracle.text.substring(0, 20)}`;
        const existing = this.oracles.get(id);
        const isNew = !existing;

        const tr = oracle.translatedText || this._resolveTranslation({ id, text: oracle.text }, 'ORACLE');
        const related = oracle.relatedEntities || existing?.relatedEntities || this._resolveRelatedEntities({ id, text: oracle.text }, 'ORACLE');
        const entry = {
            id: id,
            title: oracle.title || existing?.title || oracle.text.split('\n')[0].substring(0, 40),
            text: oracle.text,
            translatedText: tr || existing?.translatedText || '',
            category: 'ORACLE',
            isSpecial: oracle.isSpecial || existing?.isSpecial || false,
            firstDiscoveredAt: existing ? existing.firstDiscoveredAt : new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            seenCount: (existing?.seenCount || 0) + 1
        };
        if (related && related.length > 0) {
            entry.relatedEntities = related;
        }

        this.oracles.set(id, entry);
        this._autoSave();
        this._notify('oracleAdded', { isNew, oracle: entry });

        return { isNew, oracle: entry };
    }

    /**
     * 床の刻み文字 / 落書き / 墓碑銘を冒険手帳に記録・追加
     *
     * @param {Object} engraving
     * @param {string} [engraving.id]
     * @param {string} engraving.text - 原型または読み取った文字列
     * @param {string} [engraving.actualText] - 読んだ際のかすれ文字
     * @param {string} [engraving.translatedText] - 日本語訳
     * @param {string} [engraving.source] - 出典 (Portal, Discworld, 墓碑銘等)
     * @param {string} [engraving.category='ENGRAVING']
     * @param {string} [engraving.subCategory]
     * @param {boolean} [engraving.isHeadstone=false]
     * @returns {{ isNew: boolean, engraving: Object }}
     */
    addEngraving(engraving) {
        if (!engraving || (!engraving.id && !engraving.text)) {
            return { isNew: false, engraving: null };
        }

        const id = engraving.id || `engr_${(engraving.text || engraving.actualText).substring(0, 32).toLowerCase()}`;
        const existing = this.engravings.get(id);
        const isNew = !existing;

        // 床文字コレクション内の category は ENGRAVING / HEADSTONE / ELBERETH に正規化
        let validCategory = engraving.category || existing?.category;
        if (!validCategory || validCategory === 'RUMOR' || validCategory === 'ORACLE') {
            validCategory = engraving.isHeadstone ? 'HEADSTONE' : (engraving.category === 'ELBERETH' ? 'ELBERETH' : 'ENGRAVING');
        }

        const rawText = engraving.text || existing?.text || engraving.actualText || '';
        const tr = engraving.translatedText || this._resolveTranslation({
            id,
            text: rawText,
            actualText: engraving.actualText,
            isHeadstone: engraving.isHeadstone,
            isElbereth: validCategory === 'ELBERETH',
            category: validCategory
        }, validCategory);
        const related = engraving.relatedEntities || existing?.relatedEntities || this._resolveRelatedEntities({
            id,
            text: rawText,
            actualText: engraving.actualText,
            isHeadstone: engraving.isHeadstone,
            category: validCategory
        }, validCategory);

        const entry = {
            id: id,
            text: rawText,
            actualText: engraving.actualText || existing?.actualText || '',
            translatedText: tr || existing?.translatedText || '',
            source: engraving.source || existing?.source || (engraving.isHeadstone ? '墓碑銘 (Headstone)' : '床の落書き'),
            category: validCategory,
            subCategory: engraving.subCategory || existing?.subCategory || (engraving.category === 'RUMOR' ? 'RUMOR' : ''),
            isHeadstone: engraving.isHeadstone || existing?.isHeadstone || false,
            firstDiscoveredAt: existing ? existing.firstDiscoveredAt : new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            seenCount: (existing?.seenCount || 0) + 1
        };
        if (related && related.length > 0) {
            entry.relatedEntities = related;
        }

        this.engravings.set(id, entry);
        this._autoSave();
        this._notify('engravingAdded', { isNew, engraving: entry });

        return { isNew, engraving: entry };
    }

    /**
     * 伝承エントリの個別削除
     *
     * @param {string} id - 削除対象ID
     * @param {'RUMOR'|'ORACLE'|'ENGRAVING'} [category=null] - カテゴリ指定 (省略時は全コレクションから検索)
     * @returns {boolean} 削除が成功したかどうか
     */
    removeEntry(id, category = null) {
        if (!id) return false;
        let deleted = false;

        if (!category || category === 'RUMOR') {
            if (this.rumors.delete(id)) deleted = true;
        }
        if (!category || category === 'ORACLE') {
            if (this.oracles.delete(id)) deleted = true;
        }
        if (!category || category === 'ENGRAVING') {
            if (this.engravings.delete(id)) deleted = true;
        }

        if (deleted) {
            this._autoSave();
            this._notify('entryRemoved', { id, category });
            this._notify('updated', this.getStats());
        }

        return deleted;
    }

    /**
     * 床文字エントリの個別削除 (ショートカット)
     *
     * @param {string} id
     * @returns {boolean}
     */
    removeEngraving(id) {
        return this.removeEntry(id, 'ENGRAVING');
    }

    /**
     * 最新の床の刻み文字 / Elbereth 結界状態を更新
     * @param {Object} wardData
     */
    updateWard(wardData) {
        this.currentWard = {
            ...wardData,
            updatedAt: new Date().toISOString()
        };
        this._notify('wardUpdated', this.currentWard);
    }

    /**
     * 現在の結界状態を取得
     * @returns {Object|null}
     */
    getCurrentWard() {
        return this.currentWard;
    }

    /**
     * 収集した噂話一覧を取得 (デフォルト: 最新順)
     * @param {'recent'|'id'|'truth'} [sortBy='recent']
     * @returns {Array<Object>}
     */
    getRumors(sortBy = 'recent') {
        const list = Array.from(this.rumors.values());
        if (sortBy === 'recent') {
            return list.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
        } else if (sortBy === 'truth') {
            return list.sort((a, b) => Number(b.isTrue) - Number(a.isTrue));
        } else if (sortBy === 'id') {
            return list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        }
        return list;
    }

    /**
     * 収集した神託一覧を取得
     * @returns {Array<Object>}
     */
    getOracles() {
        return Array.from(this.oracles.values()).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    }

    /**
     * 収集した床文字・落書き・墓碑銘一覧を取得
     * @param {'recent'|'id'|'category'} [sortBy='recent']
     * @returns {Array<Object>}
     */
    getEngravings(sortBy = 'recent') {
        const list = Array.from(this.engravings.values());
        if (sortBy === 'recent') {
            return list.sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
        } else if (sortBy === 'category') {
            return list.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
        } else if (sortBy === 'id') {
            return list.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        }
        return list;
    }

    /**
     * 収集統計（Rumor / Oracle / Engraving / 全体）の取得
     * @returns {Object}
     */
    getStats() {
        const totalMasterRumors = this.master?.metadata?.rumorCount || 787;
        const totalMasterTrue = this.master?.metadata?.trueRumorCount || 390;
        const totalMasterFalse = this.master?.metadata?.falseRumorCount || 397;
        const totalMasterOracles = this.master?.metadata?.oracleCount || 20;

        const collectedRumors = Array.from(this.rumors.values());
        const trueCount = collectedRumors.filter(r => r.isTrue).length;
        const falseCount = collectedRumors.filter(r => !r.isTrue).length;
        const oracleCount = this.oracles.size;
        const engravingCount = this.engravings.size;

        return {
            rumors: {
                total: totalMasterRumors,
                totalMaster: totalMasterRumors,
                collected: collectedRumors.length,
                trueCount: trueCount,
                falseCount: falseCount,
                totalTrue: totalMasterTrue,
                totalFalse: totalMasterFalse,
                percentage: Number(((collectedRumors.length / totalMasterRumors) * 100).toFixed(1)),
                truePercentage: Number(((trueCount / totalMasterTrue) * 100).toFixed(1)),
                falsePercentage: Number(((falseCount / totalMasterFalse) * 100).toFixed(1)),
                ratio: totalMasterRumors > 0 ? collectedRumors.length / totalMasterRumors : 0,
                trueRatio: totalMasterTrue > 0 ? trueCount / totalMasterTrue : 0,
                falseRatio: totalMasterFalse > 0 ? falseCount / totalMasterFalse : 0
            },
            oracles: {
                total: totalMasterOracles,
                totalMaster: totalMasterOracles,
                collected: oracleCount,
                percentage: Number(((oracleCount / totalMasterOracles) * 100).toFixed(1)),
                ratio: totalMasterOracles > 0 ? oracleCount / totalMasterOracles : 0
            },
            engravings: {
                collected: engravingCount
            },
            overall: {
                totalEntries: totalMasterRumors + totalMasterOracles,
                totalCollected: collectedRumors.length + oracleCount + engravingCount,
                totalEngravings: engravingCount,
                percentage: Number((((collectedRumors.length + oracleCount) / (totalMasterRumors + totalMasterOracles)) * 100).toFixed(1))
            }
        };
    }

    /**
     * 伝承コレクションの検索・フィルタ
     *
     * @param {string} [query=''] - 検索語 (英和部分一致)
     * @param {'ALL'|'RUMOR'|'TRUE'|'FALSE'|'ORACLE'|'ENGRAVING'} [filter='ALL'] - 種別フィルタ
     * @returns {Array<Object>}
     */
    search(query = '', filter = 'ALL') {
        const q = String(query).trim().toLowerCase();
        let items = [];

        if (filter !== 'ORACLE' && filter !== 'ENGRAVING') {
            const rumors = this.getRumors();
            for (const r of rumors) {
                if (filter === 'TRUE' && !r.isTrue) continue;
                if (filter === 'FALSE' && r.isTrue) continue;
                items.push(r);
            }
        }

        if (filter === 'ALL' || filter === 'ORACLE') {
            const oracles = this.getOracles();
            items.push(...oracles);
        }

        if (filter === 'ALL' || filter === 'ENGRAVING') {
            const engravings = this.getEngravings();
            items.push(...engravings);
        }

        if (!q) {
            return items;
        }

        return items.filter(item => {
            const textMatch = item.text && item.text.toLowerCase().includes(q);
            const trMatch = item.translatedText && item.translatedText.toLowerCase().includes(q);
            const titleMatch = item.title && item.title.toLowerCase().includes(q);
            const idMatch = item.id && item.id.toLowerCase().includes(q);
            return textMatch || trMatch || titleMatch || idMatch;
        });
    }

    /**
     * ストレージへの自動保存 (同期)
     * @private
     */
    _autoSave() {
        if (!this.storage) return;
        const data = this.serialize();
        this.storage.save(data);
    }

    /**
     * 現在の状態をシリアライズ (LocalStorage 容量節約のため translatedText を除外)
     * @returns {Object}
     */
    serialize() {
        const stripTranslation = (item) => {
            const { translatedText, ...rest } = item;
            return rest;
        };

        return {
            rumors: Array.from(this.rumors.values()).map(stripTranslation),
            oracles: Array.from(this.oracles.values()).map(stripTranslation),
            engravings: Array.from(this.engravings.values()).map(stripTranslation),
            lastWard: this.currentWard
        };
    }

    /**
     * ストレージからの復元 (同期)
     * @returns {boolean}
     */
    load() {
        if (!this.storage) return false;
        const data = this.storage.load();
        if (!data) return false;

        this.deserialize(data);
        this._notify('loaded', this.getStats());
        return true;
    }

    /**
     * データをデシリアライズして取り込み（メモリ復元時に日本語訳を動的解決・キャッシュ）
     * @param {Object} data
     */
    deserialize(data) {
        if (!data) return;

        if (Array.isArray(data.rumors)) {
            for (const r of data.rumors) {
                if (r && r.id) {
                    const entry = { ...r };
                    const tr = this._resolveTranslation(entry, 'RUMOR');
                    entry.translatedText = tr || entry.translatedText || '';
                    const related = entry.relatedEntities || this._resolveRelatedEntities(entry, 'RUMOR');
                    if (related && related.length > 0) {
                        entry.relatedEntities = related;
                    }
                    this.rumors.set(r.id, entry);
                }
            }
        }
        if (Array.isArray(data.oracles)) {
            for (const o of data.oracles) {
                if (o && o.id) {
                    const entry = { ...o };
                    const tr = this._resolveTranslation(entry, 'ORACLE');
                    entry.translatedText = tr || entry.translatedText || '';
                    const related = entry.relatedEntities || this._resolveRelatedEntities(entry, 'ORACLE');
                    if (related && related.length > 0) {
                        entry.relatedEntities = related;
                    }
                    this.oracles.set(o.id, entry);
                }
            }
        }
        if (Array.isArray(data.engravings)) {
            for (const e of data.engravings) {
                if (e && e.id) {
                    const entry = { ...e };
                    const cat = entry.category || (entry.isHeadstone ? 'HEADSTONE' : (entry.isElbereth ? 'ELBERETH' : 'ENGRAVING'));
                    const tr = this._resolveTranslation(entry, cat);
                    entry.translatedText = tr || entry.translatedText || '';
                    const related = entry.relatedEntities || this._resolveRelatedEntities(entry, cat);
                    if (related && related.length > 0) {
                        entry.relatedEntities = related;
                    }
                    this.engravings.set(e.id, entry);
                }
            }
        }
        if (data.lastWard) {
            this.currentWard = data.lastWard;
        }
    }

    /**
     * 手帳のリセット (全消去・同期)
     * @returns {boolean}
     */
    reset() {
        this.rumors.clear();
        this.oracles.clear();
        this.engravings.clear();
        this.currentWard = null;
        if (this.storage) {
            this.storage.clear();
        }
        this._notify('reset', null);
        return true;
    }

    /**
     * JSON バックアップエクスポート
     * @returns {string}
     */
    exportJSON() {
        const data = this.serialize();
        return this.storage ? this.storage.exportJSON(data) : JSON.stringify(data);
    }

    /**
     * JSON バックアップからのインポート (同期)
     * @param {string} jsonString
     * @returns {boolean}
     */
    importJSON(jsonString) {
        try {
            const data = this.storage ? this.storage.importJSON(jsonString) : JSON.parse(jsonString);
            this.deserialize(data);
            this._autoSave();
            this._notify('imported', this.getStats());
            return true;
        } catch (e) {
            console.error('[LoreCodex] Import failed:', e);
            return false;
        }
    }
}

export default LoreCodex;
