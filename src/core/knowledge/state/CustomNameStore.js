/**
 * CustomNameStore.js
 *
 * プレイヤー命名（Call / Name）仮名・個別名管理ストア (Gap 2 / ROADMAP §2.1 対応)
 *
 * 【役割と責務】
 * 1. プレイヤーがアイテム（外見名・真名・個別アイテム）に付与した仮名（Called Names）を一元管理。
 * 2. DiscoveryStateManager の calledNamesMap との双方向同期。
 * 3. 将来のセマンティック翻訳・メッセージセグメンテーション（MessageSegmenter）との連携を見据えた
 *    ASCII名と日本語別名（Japanese Alias）の構造化保持。
 * 4. LocalStorage によるセッション永続化と、テスト/ヘッドレス環境での安全なメモリ内動作。
 */

export const STORAGE_KEY_CUSTOM_NAMES = 'nethack_custom_names_v1';

export class CustomNameStore {
    static _instance = null;

    /**
     * シングルトンインスタンスの取得
     * @param {Object} [options]
     * @returns {CustomNameStore}
     */
    static getInstance(options = {}) {
        if (!CustomNameStore._instance) {
            CustomNameStore._instance = new CustomNameStore(options);
        } else if (options.discoveryStateManager && !CustomNameStore._instance.discoveryStateManager) {
            CustomNameStore._instance.setDiscoveryStateManager(options.discoveryStateManager);
        }
        return CustomNameStore._instance;
    }

    /**
     * @param {Object} [options={}]
     * @param {string} [options.storageKey]
     * @param {boolean} [options.autoPersist=true]
     * @param {Object} [options.discoveryStateManager]
     */
    constructor(options = {}) {
        this.storageKey = options.storageKey || STORAGE_KEY_CUSTOM_NAMES;
        this.autoPersist = options.autoPersist !== false;
        this.discoveryStateManager = options.discoveryStateManager || null;

        // キー ➡ CustomNameEntry
        this._entries = new Map();

        // 初期化時にストレージから復元
        this.loadFromStorage();

        if (this.discoveryStateManager) {
            this.syncFromDiscoveryState(this.discoveryStateManager);
        }
    }

    /**
     * DiscoveryStateManager の設定
     * @param {Object} dsm 
     */
    setDiscoveryStateManager(dsm) {
        this.discoveryStateManager = dsm;
        if (dsm) {
            this.syncFromDiscoveryState(dsm);
        }
    }

    /**
     * キーを小文字・トリム正規化
     * @param {string|number} key 
     * @returns {string}
     */
    _normalizeKey(key) {
        if (typeof key === 'number') {
            return `onum:${key}`;
        }
        if (!key || typeof key !== 'string') return '';
        return key.trim().toLowerCase();
    }

    /**
     * 仮名・個別名の登録または更新
     * @param {string|number} key - 外見名、真名、または onum
     * @param {string} customName - 命名文字列 (例: "100G?", "identify?", "回復？")
     * @param {Object} [options={}]
     * @param {string} [options.asciiName] - Cコア用の安全なASCII名
     * @param {string} [options.japaneseAlias] - 日本語別名
     * @param {string} [options.category] - アイテムカテゴリ
     * @returns {Object} 登録されたエントリ
     */
    setCustomName(key, customName, options = {}) {
        const normKey = this._normalizeKey(key);
        if (!normKey) return null;

        const cleanName = (customName || '').trim();
        if (!cleanName) {
            this.removeCustomName(key);
            return null;
        }

        const entry = {
            key: normKey,
            rawKey: key,
            customName: cleanName,
            asciiName: options.asciiName || cleanName,
            japaneseAlias: options.japaneseAlias || (typeof customName === 'string' && /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(customName) ? customName : null),
            category: options.category || null,
            timestamp: Date.now()
        };

        this._entries.set(normKey, entry);

        // DiscoveryStateManager への直接同期
        if (this.discoveryStateManager && this.discoveryStateManager.calledNamesMap) {
            this.discoveryStateManager.calledNamesMap.set(normKey, cleanName);
            if (typeof key === 'string' && key.toLowerCase() !== normKey) {
                this.discoveryStateManager.calledNamesMap.set(key.toLowerCase(), cleanName);
            }
        }

        if (this.autoPersist) {
            this.saveToStorage();
        }

        return entry;
    }

    /**
     * 仮名の取得
     * @param {string|number} key 
     * @returns {string|null}
     */
    getCustomName(key) {
        const entry = this.getEntry(key);
        return entry ? entry.customName : null;
    }

    /**
     * 詳細エントリの取得
     * @param {string|number} key 
     * @returns {Object|null}
     */
    getEntry(key) {
        const normKey = this._normalizeKey(key);
        if (!normKey) return null;

        if (this._entries.has(normKey)) {
            return this._entries.get(normKey);
        }

        // DiscoveryStateManager の calledNamesMap からのフォールバック参照
        if (this.discoveryStateManager && typeof this.discoveryStateManager.getCalledName === 'function') {
            const called = this.discoveryStateManager.getCalledName(key);
            if (called) {
                return {
                    key: normKey,
                    rawKey: key,
                    customName: called,
                    asciiName: called,
                    japaneseAlias: null,
                    category: null,
                    timestamp: 0
                };
            }
        }

        return null;
    }

    /**
     * 仮名の削除（命名解除）
     * @param {string|number} key 
     * @returns {boolean}
     */
    removeCustomName(key) {
        const normKey = this._normalizeKey(key);
        if (!normKey) return false;

        const existed = this._entries.delete(normKey);

        if (this.discoveryStateManager && this.discoveryStateManager.calledNamesMap) {
            this.discoveryStateManager.calledNamesMap.delete(normKey);
            if (typeof key === 'string') {
                this.discoveryStateManager.calledNamesMap.delete(key.toLowerCase());
            }
        }

        if (existed && this.autoPersist) {
            this.saveToStorage();
        }

        return existed;
    }

    /**
     * 仮名が存在するか
     * @param {string|number} key 
     * @returns {boolean}
     */
    hasCustomName(key) {
        const normKey = this._normalizeKey(key);
        if (this._entries.has(normKey)) return true;
        if (this.discoveryStateManager && typeof this.discoveryStateManager.getCalledName === 'function') {
            return Boolean(this.discoveryStateManager.getCalledName(key));
        }
        return false;
    }

    /**
     * 全エントリのリストを取得
     * @returns {Array<Object>}
     */
    getAllEntries() {
        return Array.from(this._entries.values());
    }

    /**
     * 全クリア
     */
    clear() {
        this._entries.clear();
        if (this.autoPersist) {
            this.saveToStorage();
        }
    }

    /**
     * DiscoveryStateManager の calledNamesMap からインポート同期
     * @param {Object} dsm 
     * @returns {number} 取り込まれた件数
     */
    syncFromDiscoveryState(dsm = this.discoveryStateManager) {
        if (!dsm || !dsm.calledNamesMap) return 0;

        let count = 0;
        for (const [key, called] of dsm.calledNamesMap.entries()) {
            if (!key || !called) continue;
            const normKey = this._normalizeKey(key);
            if (!this._entries.has(normKey)) {
                this._entries.set(normKey, {
                    key: normKey,
                    rawKey: key,
                    customName: called,
                    asciiName: called,
                    japaneseAlias: null,
                    category: null,
                    timestamp: Date.now()
                });
                count++;
            }
        }

        if (count > 0 && this.autoPersist) {
            this.saveToStorage();
        }

        return count;
    }

    /**
     * DiscoveryStateManager の calledNamesMap へエクスポート反映
     * @param {Object} dsm 
     * @returns {number} 反映した件数
     */
    syncToDiscoveryState(dsm = this.discoveryStateManager) {
        if (!dsm || !dsm.calledNamesMap) return 0;

        let count = 0;
        for (const entry of this._entries.values()) {
            if (entry && entry.key && entry.customName) {
                dsm.calledNamesMap.set(entry.key, entry.customName);
                if (entry.rawKey && typeof entry.rawKey === 'string') {
                    dsm.calledNamesMap.set(entry.rawKey.toLowerCase(), entry.customName);
                }
                count++;
            }
        }
        return count;
    }

    /**
     * LocalStorage への永続化保存
     */
    saveToStorage() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            const data = Array.from(this._entries.entries());
            window.localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            // ストレージ容量オーバーやプライベートブラウズ時は警告を抑制
        }
    }

    /**
     * LocalStorage からの復元読み出し
     */
    loadFromStorage() {
        if (typeof window === 'undefined' || !window.localStorage) {
            return;
        }
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                for (const [key, entry] of parsed) {
                    if (key && entry) {
                        this._entries.set(key, entry);
                    }
                }
            }
        } catch (e) {
            // パース失敗時は初期状態を維持
        }
    }
}
