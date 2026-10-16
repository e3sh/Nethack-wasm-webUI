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

let _defaultInstance = null;

export class AdventureLogManager {
    /**
     * 共有シングルトンインスタンスの取得
     * @param {Object} [options]
     * @returns {AdventureLogManager}
     */
    static getInstance(options = {}) {
        if (!_defaultInstance) {
            _defaultInstance = new AdventureLogManager(options);
            if (typeof window !== 'undefined') {
                window.__nh_adventure_log_mgr = _defaultInstance;
            }
        }
        return _defaultInstance;
    }

    /**
     * シングルトンインスタンスのリセット（テスト・再初期化用）
     */
    static resetInstance() {
        _defaultInstance = null;
        if (typeof window !== 'undefined') {
            try {
                delete window.__nh_adventure_log_mgr;
            } catch (e) {
                window.__nh_adventure_log_mgr = null;
            }
        }
    }

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
        this.unlockedOracles = new Set();  // oracleId (string)

        // 新規解禁（NEW! バッジ対象）識別子セット
        this.newMonsters = new Set();
        this.newObjects = new Set();
        this.newRumors = new Set();
        this.newOracles = new Set();

        // 覗き見解禁（👁️マーク）識別子セット
        this.peekedObjects = new Set(); // onum (number)

        // 3段階の知恵・ガイド支援モード: 'STOIC' | 'VETERAN' | 'SAGE_GUIDE' (デフォルト: 'VETERAN')
        if (options.guideAssistanceMode) {
            this.guideAssistanceMode = options.guideAssistanceMode;
        } else if (options.oracleGuideAlwaysUnlocked) {
            this.guideAssistanceMode = 'SAGE_GUIDE';
        } else {
            this.guideAssistanceMode = 'VETERAN';
        }

        this.listeners = new Set();

        if (options.autoLoad !== false) {
            this.load();
        }
    }

    /**
     * 🔮 公式ガイドモード（常時開示・ネタバレ許可）の後方互換 getter/setter
     */
    get oracleGuideAlwaysUnlocked() {
        return this.guideAssistanceMode === 'SAGE_GUIDE';
    }

    set oracleGuideAlwaysUnlocked(enabled) {
        this.setGuideAssistanceMode(enabled ? 'SAGE_GUIDE' : 'VETERAN');
    }

    /**
     * ガイド支援モードの設定 ('STOIC' | 'VETERAN' | 'SAGE_GUIDE')
     * @param {'STOIC' | 'VETERAN' | 'SAGE_GUIDE'} mode
     */
    setGuideAssistanceMode(mode) {
        const validModes = ['STOIC', 'VETERAN', 'SAGE_GUIDE'];
        const newMode = validModes.includes(mode) ? mode : 'VETERAN';
        if (this.guideAssistanceMode !== newMode) {
            this.guideAssistanceMode = newMode;
            this.save();
            this._notify('GUIDE_ASSISTANCE_MODE_CHANGED', { mode: newMode });
            this._notify('ORACLE_GUIDE_MODE_CHANGED', { enabled: newMode === 'SAGE_GUIDE' });
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
        if (Array.isArray(data.peekedObjects)) {
            this.peekedObjects = new Set(data.peekedObjects.map(Number));
        }
        if (data.guideAssistanceMode) {
            this.guideAssistanceMode = data.guideAssistanceMode;
        }
        if (Array.isArray(data.unlockedRumors)) {
            this.unlockedRumors = new Set(data.unlockedRumors);
        }
        if (Array.isArray(data.unlockedOracles)) {
            this.unlockedOracles = new Set(data.unlockedOracles);
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
            if (Array.isArray(data.newlyUnlocked.oracles)) {
                this.newOracles = new Set(data.newlyUnlocked.oracles);
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
                let changed = false;
                if (Array.isArray(data.rumors)) {
                    for (const r of data.rumors) {
                        const id = typeof r === 'string' ? r : (r.id || r.rumorId);
                        if (id && !this.unlockedRumors.has(id)) {
                            this.unlockedRumors.add(id);
                            changed = true;
                        }
                    }
                }
                if (Array.isArray(data.oracles)) {
                    for (const o of data.oracles) {
                        const id = typeof o === 'string' ? o : (o.id || o.oracleId);
                        if (id && !this.unlockedOracles.has(id)) {
                            this.unlockedOracles.add(id);
                            changed = true;
                        }
                    }
                }
                if (changed) this.save();
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
            peekedObjects: Array.from(this.peekedObjects),
            guideAssistanceMode: this.guideAssistanceMode,
            unlockedRumors: Array.from(this.unlockedRumors),
            unlockedOracles: Array.from(this.unlockedOracles),
            newlyUnlocked: {
                monsters: Array.from(this.newMonsters),
                objects: Array.from(this.newObjects),
                rumors: Array.from(this.newRumors),
                oracles: Array.from(this.newOracles)
            },
            stats: {
                monstersCount: this.unlockedMonsters.size,
                objectsCount: this.unlockedObjects.size,
                peekedObjectsCount: this.peekedObjects.size,
                rumorsCount: this.unlockedRumors.size,
                oraclesCount: this.unlockedOracles.size
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
     * @param {Object} [options={}]
     * @param {boolean} [options.viaPeek=false] - 覗き見知恵による一時解禁フラグ
     * @returns {boolean} 新規にアンロックまたは昇格されたかどうか
     */
    unlockObject(identifier, { viaPeek = false } = {}) {
        const onum = this._resolveObjectOnum(identifier);
        if (onum === null || onum < 0 || onum >= OBJECT_KNOWLEDGE_MAP.size) {
            return false;
        }

        if (viaPeek) {
            if (!this.unlockedObjects.has(onum)) {
                this.unlockedObjects.add(onum);
                this.peekedObjects.add(onum);
                this.newObjects.add(onum);
                this.save();
                this._notify('OBJECT_UNLOCKED', { onum, viaPeek: true });
                return true;
            }
            return false;
        }

        let promoted = false;
        if (this.peekedObjects.has(onum)) {
            this.peekedObjects.delete(onum);
            promoted = true;
        }

        if (this.unlockedObjects.has(onum)) {
            if (promoted) {
                this.save();
                this._notify('OBJECT_PROMOTED', { onum });
                return true;
            }
            return false;
        }

        this.unlockedObjects.add(onum);
        this.newObjects.add(onum);
        this.save();
        this._notify('OBJECT_UNLOCKED', { onum, viaPeek: false });
        return true;
    }

    /**
     * アイテムの複数一括アンロック (初期所持品同期・一括識別用)
     * ストレージ保存およびイベント通知を1回に集約して高パフォーマンスに処理する。
     * @param {Array<number|string>} identifiers - onum またはアイテム真名の配列
     * @param {Object} [options={}]
     * @param {boolean} [options.viaPeek=false]
     * @returns {{ count: number, isNew: boolean, newOnums: Array<number> }}
     */
    unlockObjects(identifiers, { viaPeek = false } = {}) {
        if (!Array.isArray(identifiers) || identifiers.length === 0) {
            return { count: 0, isNew: false, newOnums: [] };
        }

        const newOnums = [];
        let anyPromoted = false;
        for (const id of identifiers) {
            const onum = this._resolveObjectOnum(id);
            if (onum === null || onum < 0 || onum >= OBJECT_KNOWLEDGE_MAP.size) continue;

            if (viaPeek) {
                if (!this.unlockedObjects.has(onum)) {
                    this.unlockedObjects.add(onum);
                    this.peekedObjects.add(onum);
                    this.newObjects.add(onum);
                    newOnums.push(onum);
                }
            } else {
                if (this.peekedObjects.has(onum)) {
                    this.peekedObjects.delete(onum);
                    anyPromoted = true;
                }
                if (!this.unlockedObjects.has(onum)) {
                    this.unlockedObjects.add(onum);
                    this.newObjects.add(onum);
                    newOnums.push(onum);
                }
            }
        }

        if (newOnums.length > 0 || anyPromoted) {
            this.save();
            this._notify('OBJECTS_UNLOCKED_BATCH', { onums: newOnums, count: newOnums.length, viaPeek });
        }

        return {
            count: newOnums.length,
            isNew: newOnums.length > 0,
            newOnums
        };
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
     * アイテムが覗き見知恵（Peek Wisdom）可能か判定する
     * - STOIC: 常に false（完全無効）
     * - VETERAN: 手帳に正式登録されている品目のみ true（未知アイテムのネタバレ防止）
     * - SAGE_GUIDE: 常に true
     * @param {number|string} identifier
     * @returns {boolean}
     */
    canPeekObject(identifier) {
        if (this.guideAssistanceMode === 'STOIC') {
            return false;
        }
        if (this.guideAssistanceMode === 'SAGE_GUIDE') {
            return true;
        }
        const onum = this._resolveObjectOnum(identifier);
        if (onum === null) return false;
        return this.unlockedObjects.has(onum);
    }

    /**
     * アイテムが覗き見解禁（👁️）状態か確認
     * @param {number|string} identifier
     * @returns {boolean}
     */
    isObjectPeeked(identifier) {
        const onum = this._resolveObjectOnum(identifier);
        return onum !== null && this.peekedObjects.has(onum);
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
     * 神託のアンロック
     * @param {string} oracleId
     * @returns {boolean} 新規にアンロックされたかどうか
     */
    unlockOracle(oracleId) {
        if (!oracleId || this.unlockedOracles.has(oracleId)) {
            return false;
        }
        this.unlockedOracles.add(oracleId);
        this.newOracles.add(oracleId);
        this.save();
        this._notify('ORACLE_UNLOCKED', { oracleId });
        return true;
    }

    /**
     * 神託の全件一括アンロック（大予言受託時用）
     * 複数件の神託をストレージ保存・イベント発火1回のみで安全に一括登録する。
     * @param {Array<string>} [oracleIds] - アンロック対象のIDリスト（省略時は全20件）
     * @returns {{ count: number, isNew: boolean }}
     */
    unlockAllOracles(oracleIds = null) {
        const ids = Array.isArray(oracleIds) && oracleIds.length > 0
            ? oracleIds
            : (LORE_MASTER?.oracles ? LORE_MASTER.oracles.map(o => o.id) : []);

        let newlyUnlockedCount = 0;
        for (const id of ids) {
            if (id && !this.unlockedOracles.has(id)) {
                this.unlockedOracles.add(id);
                this.newOracles.add(id);
                newlyUnlockedCount++;
            }
        }

        if (newlyUnlockedCount > 0) {
            this.save();
            this._notify('ORACLE_UNLOCKED_ALL', { count: newlyUnlockedCount, total: this.unlockedOracles.size });
        }

        return {
            count: newlyUnlockedCount,
            isNew: newlyUnlockedCount > 0
        };
    }

    /**
     * 神託がアンロック済みか確認（公式ガイドモードがONなら常にtrue）
     * @param {string} oracleId
     * @returns {boolean}
     */
    isOracleUnlocked(oracleId) {
        if (this.oracleGuideAlwaysUnlocked) {
            return true;
        }
        return this.unlockedOracles.has(oracleId);
    }

    /**
     * 神託が新着（未読）か確認
     * @param {string} oracleId
     * @returns {boolean}
     */
    isOracleNew(oracleId) {
        if (this.oracleGuideAlwaysUnlocked) {
            return false;
        }
        return this.newOracles.has(oracleId);
    }

    /**
     * 公式ガイドモード（常時開示・ネタバレ許可）の設定
     * @param {boolean} enabled
     */
    setOracleGuideAlwaysUnlocked(enabled) {
        const val = Boolean(enabled);
        if (this.oracleGuideAlwaysUnlocked !== val) {
            this.oracleGuideAlwaysUnlocked = val;
            this._notify('ORACLE_GUIDE_MODE_CHANGED', { enabled: val });
        }
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

        // LoreCodex の神託を取り込み
        if (loreCodex.oracles) {
            for (const id of loreCodex.oracles.keys()) {
                if (!this.unlockedOracles.has(id)) {
                    this.unlockedOracles.add(id);
                    changed = true;
                }
            }
        }

        // 冒険手帳の神託を LoreCodex に反映
        for (const id of this.unlockedOracles) {
            if (loreCodex.oracles && !loreCodex.oracles.has(id)) {
                const masterOracle = (LORE_MASTER.oracles || []).find(o => o.id === id);
                if (masterOracle && typeof loreCodex.addOracle === 'function') {
                    loreCodex.addOracle(masterOracle);
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
     * @param {'monster'|'object'|'rumor'|'oracle'} category
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
        if (category === 'oracle') {
            return this.isOracleNew(identifier);
        }
        return false;
    }

    /**
     * 指定エントリを既読化
     * @param {'monster'|'object'|'rumor'|'oracle'} category
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
        } else if (category === 'oracle') {
            if (this.newOracles.delete(identifier)) changed = true;
        }

        if (changed) {
            this.save();
            this._notify('READ_STATE_CHANGED', { category, identifier });
        }
    }

    /**
     * カテゴリ内（または全エントリ）をすべて既読化
     * @param {'monster'|'object'|'rumor'|'oracle'|'all'} [category='all']
     */
    markAllAsRead(category = 'all') {
        if (category === 'monster' || category === 'all') this.newMonsters.clear();
        if (category === 'object' || category === 'all') this.newObjects.clear();
        if (category === 'rumor' || category === 'all') this.newRumors.clear();
        if (category === 'oracle' || category === 'all') this.newOracles.clear();
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
        const totalOracles = (LORE_MASTER.oracles || []).length || 20;

        const mUnlocked = this.unlockedMonsters.size;
        const oUnlocked = this.unlockedObjects.size;
        const rUnlocked = this.unlockedRumors.size;
        const orcUnlocked = this.oracleGuideAlwaysUnlocked ? totalOracles : this.unlockedOracles.size;

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
            oracles: {
                unlocked: orcUnlocked,
                total: totalOracles,
                percentage: totalOracles > 0 ? Number(((orcUnlocked / totalOracles) * 100).toFixed(1)) : 0,
                newCount: this.newOracles.size,
                isGuideMode: this.oracleGuideAlwaysUnlocked
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
     * 全神託の状態付き一覧を取得
     * @returns {Array<Object>}
     */
    getAllOraclesWithStatus() {
        const oracles = LORE_MASTER.oracles || [];
        return oracles.map((o, index) => {
            const isUnlocked = this.isOracleUnlocked(o.id);
            return {
                id: o.id,
                category: 'oracle',
                index: index + 1,
                title: isUnlocked ? o.title : '???',
                text: isUnlocked ? o.text : '???????????????',
                textJa: isUnlocked ? (o.translatedText || o.textJa || o.text) : '???????????????',
                isUnlocked,
                isNew: this.isOracleNew(o.id),
                isSpecial: o.isSpecial,
                data: isUnlocked ? o : null
            };
        });
    }

    /**
     * 指定エンティティに関連する伝承（噂・神託）を取得
     * 
     * 【設計仕様】
     * - 神託（Oracle）: 公式ガイドモード（oracleGuideAlwaysUnlocked）または unlockOracle に応じて解禁
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
            const isUnlocked = isOracle ? this.isOracleUnlocked(lore.id) : this.unlockedRumors.has(lore.id);
            const isNew = isOracle ? this.isOracleNew(lore.id) : this.newRumors.has(lore.id);
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
        this.peekedObjects.clear();
        this.unlockedRumors.clear();
        this.unlockedOracles.clear();
        this.newMonsters.clear();
        this.newObjects.clear();
        this.newRumors.clear();
        this.newOracles.clear();
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
            peekedObjects: Array.from(this.peekedObjects),
            guideAssistanceMode: this.guideAssistanceMode,
            unlockedRumors: Array.from(this.unlockedRumors),
            unlockedOracles: Array.from(this.unlockedOracles),
            newlyUnlocked: {
                monsters: Array.from(this.newMonsters),
                objects: Array.from(this.newObjects),
                rumors: Array.from(this.newRumors),
                oracles: Array.from(this.newOracles)
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
            if (Array.isArray(data.peekedObjects)) {
                this.peekedObjects = new Set(data.peekedObjects.map(Number));
            }
            if (data.guideAssistanceMode) {
                this.guideAssistanceMode = data.guideAssistanceMode;
            }
            if (Array.isArray(data.unlockedRumors)) {
                this.unlockedRumors = new Set(data.unlockedRumors);
            }
            if (Array.isArray(data.unlockedOracles)) {
                this.unlockedOracles = new Set(data.unlockedOracles);
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
                if (Array.isArray(data.newlyUnlocked.oracles)) {
                    this.newOracles = new Set(data.newlyUnlocked.oracles);
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
