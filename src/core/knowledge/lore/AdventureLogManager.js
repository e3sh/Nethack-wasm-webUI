/**
 * AdventureLogManager.js - 冒険手帳メタプログレッション総合マネージャ
 *
 * セッション横断（LocalStorage）でプレイヤーの知の蓄積を管理する。
 * - 👾 モンスター遭遇・調査記録 (全384体)
 * - ⚔️ アイテム識別・発見記録 (全481品)
 * - 📜 噂・神託・伝承コレクション (全787件)
 *
 * パーマデスルールを100%遵守し、ゲーム内能力の持ち越しは行わない。
 */

import { AdventureLogStorage } from './AdventureLogStorage.js';
import { ALL_MONSTER_KNOWLEDGE_BASE, MONSTER_KNOWLEDGE_MAP } from '../data/MONSTER_KNOWLEDGE_FULL.js';
import { OBJECT_KNOWLEDGE_MAP } from '../data/OBJECT_KNOWLEDGE_FULL.js';
import { LORE_MASTER } from './data/LoreMasterData.js';
import { findLoreForEntity } from './LoreEntityCrossReference.js';


export const GLYPH_OFFSET_MONSTER = 0;
export const GLYPH_OFFSET_OBJECT = 3448;

export class AdventureLogManager {
    /**
     * @param {Object} [options]
     * @param {AdventureLogStorage} [options.storage] - カスタムストレージ
     * @param {boolean} [options.autoLoad=true] - 自動読み込みを行うか
     */
    constructor(options = {}) {
        this.storage = options.storage || new AdventureLogStorage();
        
        // アンロック済み識別子セット
        this.unlockedMonsters = new Set(); // monOffset (number)
        this.unlockedObjects = new Set();  // onum (number)
        this.unlockedRumors = new Set();   // rumorId (string)

        // 新規解禁（NEW! バッジ対象）識別子セット
        this.newMonsters = new Set();
        this.newObjects = new Set();
        this.newRumors = new Set();

        this.listeners = new Set();

        if (options.autoLoad !== false) {
            this.load();
        }
    }

    /**
     * 変更リスナーの追加
     * @param {Function} listener
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * リスナーへの通知
     * @private
     */
    _notify(changeType, detail) {
        for (const listener of this.listeners) {
            try {
                listener({ changeType, detail, progress: this.getProgress() });
            } catch (e) {
                console.error('[AdventureLogManager] Listener error:', e);
            }
        }
    }

    /**
     * ストレージからロード
     */
    load() {
        const data = this.storage.load();
        if (!data) {
            // 既存の LoreCodex データがあればRumorsを初期インポート
            this._tryImportLegacyLoreCodex();
            return;
        }

        if (Array.isArray(data.unlockedMonsters)) {
            this.unlockedMonsters = new Set(data.unlockedMonsters.map(Number));
        }
        if (Array.isArray(data.unlockedObjects)) {
            this.unlockedObjects = new Set(data.unlockedObjects.map(Number));
        }
        if (Array.isArray(data.unlockedRumors)) {
            this.unlockedRumors = new Set(data.unlockedRumors);
        }

        if (data.newlyUnlocked) {
            if (Array.isArray(data.newlyUnlocked.monsters)) {
                this.newMonsters = new Set(data.newlyUnlocked.monsters.map(Number));
            }
            if (Array.isArray(data.newlyUnlocked.objects)) {
                this.newObjects = new Set(data.newlyUnlocked.objects.map(Number));
            }
            if (Array.isArray(data.newlyUnlocked.rumors)) {
                this.newRumors = new Set(data.newlyUnlocked.rumors);
            }
        }

        // 既存の LoreCodex データとのマージ確認
        this._tryImportLegacyLoreCodex();
    }

    /**
     * レガシー LoreCodex (nethack_webui_lore_codex) からの透過的取り込み
     * @private
     */
    _tryImportLegacyLoreCodex() {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const raw = window.localStorage.getItem('nethack_webui_lore_codex');
            if (raw) {
                const parsed = JSON.parse(raw);
                const data = parsed.data || parsed;
                if (Array.isArray(data.rumors)) {
                    let changed = false;
                    for (const r of data.rumors) {
                        const id = typeof r === 'string' ? r : (r.id || r.rumorId);
                        if (id && !this.unlockedRumors.has(id)) {
                            this.unlockedRumors.add(id);
                            changed = true;
                        }
                    }
                    if (changed) this.save();
                }
            }
        } catch (e) {
            // 無視
        }
    }

    /**
     * ストレージへ保存
     */
    save() {
        const payload = {
            unlockedMonsters: Array.from(this.unlockedMonsters),
            unlockedObjects: Array.from(this.unlockedObjects),
            unlockedRumors: Array.from(this.unlockedRumors),
            newlyUnlocked: {
                monsters: Array.from(this.newMonsters),
                objects: Array.from(this.newObjects),
                rumors: Array.from(this.newRumors)
            },
            stats: {
                monstersCount: this.unlockedMonsters.size,
                objectsCount: this.unlockedObjects.size,
                rumorsCount: this.unlockedRumors.size
            }
        };
        return this.storage.save(payload);
    }

    // ==========================================
    // モンスター関連
    // ==========================================

    /**
     * モンスターのアンロック
     * @param {number|string} identifier - monOffset またはモンスター名
     * @returns {boolean} 新規にアンロックされたかどうか
     */
    unlockMonster(identifier) {
        const monOffset = this._resolveMonsterOffset(identifier);
        if (monOffset === null || monOffset < 0 || monOffset >= ALL_MONSTER_KNOWLEDGE_BASE.length) {
            return false;
        }

        if (this.unlockedMonsters.has(monOffset)) {
            return false;
        }

        this.unlockedMonsters.add(monOffset);
        this.newMonsters.add(monOffset);
        this.save();
        this._notify('MONSTER_UNLOCKED', { monOffset });
        return true;
    }

    /**
     * モンスターがアンロック済みか確認
     * @param {number|string} identifier
     * @returns {boolean}
     */
    isMonsterUnlocked(identifier) {
        const monOffset = this._resolveMonsterOffset(identifier);
        return monOffset !== null && this.unlockedMonsters.has(monOffset);
    }

    /**
     * モンスター識別子から monOffset を解決
     * @private
     */
    _resolveMonsterOffset(identifier) {
        if (typeof identifier === 'number') {
            return identifier;
        }
        if (typeof identifier === 'string') {
            const entry = MONSTER_KNOWLEDGE_MAP.get(identifier.toLowerCase().trim());
            if (entry && entry.monOffset !== undefined) {
                return entry.monOffset;
            }
            const num = parseInt(identifier, 10);
            if (!isNaN(num)) return num;
        }
        return null;
    }

    // ==========================================
    // アイテム関連
    // ==========================================

    /**
     * アイテムのアンロック
     * @param {number|string} identifier - onum またはアイテム真名
     * @returns {boolean} 新規にアンロックされたかどうか
     */
    unlockObject(identifier) {
        const onum = this._resolveObjectOnum(identifier);
        if (onum === null || onum < 0 || onum >= OBJECT_KNOWLEDGE_MAP.size) {
            return false;
        }

        if (this.unlockedObjects.has(onum)) {
            return false;
        }

        this.unlockedObjects.add(onum);
        this.newObjects.add(onum);
        this.save();
        this._notify('OBJECT_UNLOCKED', { onum });
        return true;
    }

    /**
     * アイテムがアンロック済みか確認
     * @param {number|string} identifier
     * @returns {boolean}
     */
    isObjectUnlocked(identifier) {
        const onum = this._resolveObjectOnum(identifier);
        return onum !== null && this.unlockedObjects.has(onum);
    }

    /**
     * アイテム識別子から onum を解決
     * @private
     */
    _resolveObjectOnum(identifier) {
        if (typeof identifier === 'number') {
            return identifier;
        }
        if (typeof identifier === 'string') {
            const clean = identifier.toLowerCase().trim();
            for (const [key, entry] of OBJECT_KNOWLEDGE_MAP.entries()) {
                if (entry.name && entry.name.toLowerCase() === clean) return entry.onum;
                if (entry.nameJa && entry.nameJa === clean) return entry.onum;
                if (entry.tileName && entry.tileName.toLowerCase() === clean) return entry.onum;
            }
            const num = parseInt(identifier, 10);
            if (!isNaN(num)) return num;
        }
        return null;
    }

    // ==========================================
    // 噂・伝承関連
    // ==========================================

    /**
     * 噂のアンロック
     * @param {string} rumorId
     * @returns {boolean} 新規にアンロックされたかどうか
     */
    unlockRumor(rumorId) {
        if (!rumorId || this.unlockedRumors.has(rumorId)) {
            return false;
        }
        this.unlockedRumors.add(rumorId);
        this.newRumors.add(rumorId);
        this.save();
        this._notify('RUMOR_UNLOCKED', { rumorId });
        return true;
    }

    /**
     * 噂がアンロック済みか確認
     * @param {string} rumorId
     * @returns {boolean}
     */
    isRumorUnlocked(rumorId) {
        return this.unlockedRumors.has(rumorId);
    }

    /**
     * LoreCodex インスタンスとの双方向同期
     * @param {Object} loreCodex
     */
    syncWithLoreCodex(loreCodex) {
        if (!loreCodex) return;
        let changed = false;

        // LoreCodex の噂を取り込み
        if (loreCodex.rumors) {
            for (const id of loreCodex.rumors.keys()) {
                if (!this.unlockedRumors.has(id)) {
                    this.unlockedRumors.add(id);
                    changed = true;
                }
            }
        }

        // 冒険手帳の噂を LoreCodex に反映
        for (const id of this.unlockedRumors) {
            if (loreCodex.rumors && !loreCodex.rumors.has(id)) {
                const masterRumor = (LORE_MASTER.rumors || []).find(r => r.id === id);
                if (masterRumor && typeof loreCodex.recordRumor === 'function') {
                    loreCodex.recordRumor(masterRumor.text, masterRumor.type === 'TRUE');
                }
            }
        }

        if (changed) {
            this.save();
        }
    }

    // ==========================================
    // 既読 (NEW! バッジ) 管理
    // ==========================================

    /**
     * 指定エントリが NEW! かどうか
     * @param {'monster'|'object'|'rumor'} category
     * @param {number|string} identifier
     * @returns {boolean}
     */
    isNew(category, identifier) {
        if (category === 'monster') {
            const off = this._resolveMonsterOffset(identifier);
            return off !== null && this.newMonsters.has(off);
        }
        if (category === 'object') {
            const onum = this._resolveObjectOnum(identifier);
            return onum !== null && this.newObjects.has(onum);
        }
        if (category === 'rumor') {
            return this.newRumors.has(identifier);
        }
        return false;
    }

    /**
     * 指定エントリを既読化
     * @param {'monster'|'object'|'rumor'} category
     * @param {number|string} identifier
     */
    markAsRead(category, identifier) {
        let changed = false;
        if (category === 'monster') {
            const off = this._resolveMonsterOffset(identifier);
            if (off !== null && this.newMonsters.delete(off)) changed = true;
        } else if (category === 'object') {
            const onum = this._resolveObjectOnum(identifier);
            if (onum !== null && this.newObjects.delete(onum)) changed = true;
        } else if (category === 'rumor') {
            if (this.newRumors.delete(identifier)) changed = true;
        }

        if (changed) {
            this.save();
            this._notify('READ_STATE_CHANGED', { category, identifier });
        }
    }

    /**
     * カテゴリ内（または全エントリ）をすべて既読化
     * @param {'monster'|'object'|'rumor'|'all'} [category='all']
     */
    markAllAsRead(category = 'all') {
        if (category === 'monster' || category === 'all') this.newMonsters.clear();
        if (category === 'object' || category === 'all') this.newObjects.clear();
        if (category === 'rumor' || category === 'all') this.newRumors.clear();
        this.save();
        this._notify('ALL_READ', { category });
    }

    // ==========================================
    // 進捗集計
    // ==========================================

    /**
     * 収集率（%）および進捗サマリーの取得
     * @returns {Object}
     */
    getProgress() {
        const totalMonsters = ALL_MONSTER_KNOWLEDGE_BASE.length;
        const totalObjects = OBJECT_KNOWLEDGE_MAP.size;
        const totalRumors = (LORE_MASTER.rumors || []).length || 787;

        const mUnlocked = this.unlockedMonsters.size;
        const oUnlocked = this.unlockedObjects.size;
        const rUnlocked = this.unlockedRumors.size;

        const totalAll = totalMonsters + totalObjects + totalRumors;
        const unlockedAll = mUnlocked + oUnlocked + rUnlocked;

        return {
            monsters: {
                unlocked: mUnlocked,
                total: totalMonsters,
                percentage: totalMonsters > 0 ? Number(((mUnlocked / totalMonsters) * 100).toFixed(1)) : 0,
                newCount: this.newMonsters.size
            },
            objects: {
                unlocked: oUnlocked,
                total: totalObjects,
                percentage: totalObjects > 0 ? Number(((oUnlocked / totalObjects) * 100).toFixed(1)) : 0,
                newCount: this.newObjects.size
            },
            rumors: {
                unlocked: rUnlocked,
                total: totalRumors,
                percentage: totalRumors > 0 ? Number(((rUnlocked / totalRumors) * 100).toFixed(1)) : 0,
                newCount: this.newRumors.size
            },
            overall: {
                unlocked: unlockedAll,
                total: totalAll,
                percentage: totalAll > 0 ? Number(((unlockedAll / totalAll) * 100).toFixed(1)) : 0,
                newCount: this.newMonsters.size + this.newObjects.size + this.newRumors.size
            }
        };
    }

    // ==========================================
    // リスト取得 API
    // ==========================================

    /**
     * 全モンスターの状態付き一覧を取得
     * @returns {Array<Object>}
     */
    getAllMonstersWithStatus() {
        return ALL_MONSTER_KNOWLEDGE_BASE.map(mon => {
            const isUnlocked = this.unlockedMonsters.has(mon.monOffset);
            return {
                id: mon.id,
                category: 'monster',
                monOffset: mon.monOffset,
                glyphId: GLYPH_OFFSET_MONSTER + mon.monOffset,
                name: isUnlocked ? mon.name : '???',
                nameJa: isUnlocked ? (mon.nameJa || mon.name) : '???',
                symbol: mon.symbol,
                isUnlocked,
                isNew: this.newMonsters.has(mon.monOffset),
                data: isUnlocked ? mon : null
            };
        });
    }

    /**
     * 全アイテムの状態付き一覧を取得
     * @returns {Array<Object>}
     */
    getAllObjectsWithStatus() {
        const list = [];
        for (const [onum, obj] of OBJECT_KNOWLEDGE_MAP.entries()) {
            const isUnlocked = this.unlockedObjects.has(onum);
            list.push({
                id: obj.id || `obj_${onum}`,
                category: 'object',
                onum: onum,
                glyphId: GLYPH_OFFSET_OBJECT + onum,
                itemCategory: obj.category,
                name: isUnlocked ? obj.name : '???',
                nameJa: isUnlocked ? (obj.nameJa || obj.name) : '???',
                isUnlocked,
                isNew: this.newObjects.has(onum),
                data: isUnlocked ? obj : null
            });
        }
        return list;
    }

    /**
     * 全噂の状態付き一覧を取得
     * @returns {Array<Object>}
     */
    getAllRumorsWithStatus() {
        const rumors = LORE_MASTER.rumors || [];
        return rumors.map((r, index) => {
            const isUnlocked = this.unlockedRumors.has(r.id);
            const isTrue = r.isTrue !== undefined ? Boolean(r.isTrue) : (r.subCategory === 'TRUE_RUMOR' || (r.id && r.id.includes('_tru_')));
            return {
                id: r.id,
                category: 'rumor',
                index: index + 1,
                isTrue,
                type: isTrue ? 'TRUE' : 'FALSE',
                text: isUnlocked ? r.text : '???????????????',
                textJa: isUnlocked ? (r.translatedText || r.textJa || r.text) : '???????????????',
                isUnlocked,
                isNew: this.newRumors.has(r.id),
                data: isUnlocked ? r : null
            };
        });
    }

    /**
     * 指定エンティティに関連する伝承（噂・神託）を取得
     * 
     * 【設計仕様】
     * - 神託（Oracle）: ゲームの重要公式ガイドとして常時開示（isUnlocked: true、収集率の計算対象外）
     * - 噂話（Rumor）: 冒険手帳のアンロック対象（unlockedRumors による解禁判定）
     * 
     * @param {Object|string|number} target - 対象エンティティ
     * @param {Object} [options={}]
     * @param {boolean} [options.unlockedOnly=false] - 解禁済みの伝承のみに絞り込むか
     * @returns {Array<Object>}
     */
    getRelatedLore(target, options = {}) {
        const list = findLoreForEntity(target, options);
        const { unlockedOnly = false } = options;

        return list.map(lore => {
            const isOracle = lore.category === 'ORACLE';
            const isUnlocked = isOracle ? true : this.unlockedRumors.has(lore.id);
            const isNew = isOracle ? false : this.newRumors.has(lore.id);
            return {
                ...lore,
                isUnlocked,
                isNew
            };
        }).filter(entry => !unlockedOnly || entry.isUnlocked);
    }

    // ==========================================
    // メンテナンス・リセット・エクスポート
    // ==========================================

    /**
     * 冒険手帳の全データを消去（完全リセット）
     * @returns {boolean}
     */
    reset() {
        this.unlockedMonsters.clear();
        this.unlockedObjects.clear();
        this.unlockedRumors.clear();
        this.newMonsters.clear();
        this.newObjects.clear();
        this.newRumors.clear();
        const success = this.storage.clear();
        this._notify('RESET', {});
        return success;
    }

    /**
     * JSON 文字列としてエクスポート
     * @returns {string}
     */
    exportJSON() {
        const payload = {
            unlockedMonsters: Array.from(this.unlockedMonsters),
            unlockedObjects: Array.from(this.unlockedObjects),
            unlockedRumors: Array.from(this.unlockedRumors),
            newlyUnlocked: {
                monsters: Array.from(this.newMonsters),
                objects: Array.from(this.newObjects),
                rumors: Array.from(this.newRumors)
            },
            exportedAt: new Date().toISOString()
        };
        return this.storage.exportJSON(payload);
    }

    /**
     * JSON 文字列からインポート
     * @param {string} jsonString
     * @returns {boolean}
     */
    importJSON(jsonString) {
        try {
            const data = this.storage.importJSON(jsonString);
            if (Array.isArray(data.unlockedMonsters)) {
                this.unlockedMonsters = new Set(data.unlockedMonsters.map(Number));
            }
            if (Array.isArray(data.unlockedObjects)) {
                this.unlockedObjects = new Set(data.unlockedObjects.map(Number));
            }
            if (Array.isArray(data.unlockedRumors)) {
                this.unlockedRumors = new Set(data.unlockedRumors);
            }
            if (data.newlyUnlocked) {
                if (Array.isArray(data.newlyUnlocked.monsters)) {
                    this.newMonsters = new Set(data.newlyUnlocked.monsters.map(Number));
                }
                if (Array.isArray(data.newlyUnlocked.objects)) {
                    this.newObjects = new Set(data.newlyUnlocked.objects.map(Number));
                }
                if (Array.isArray(data.newlyUnlocked.rumors)) {
                    this.newRumors = new Set(data.newlyUnlocked.rumors);
                }
            }
            this.save();
            this._notify('IMPORTED', {});
            return true;
        } catch (e) {
            console.error('[AdventureLogManager] Import failed:', e);
            return false;
        }
    }
}

export default AdventureLogManager;
