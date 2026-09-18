/**
 * LoreCodexStorage.js - 冒険手帳メタプログレッション永続化ストレージ
 *
 * NetHack 本編の Wasm セーブデータ (/save) とは完全に分離し、
 * プレイヤー自身の知識資産（噂話・神託・コレクション）をセッション横断で永続化する。
 * ブラウザ環境下では localStorage / IndexedDB を透過的に使用し、
 * Node.js / テスト環境ではインメモリストレージへ安全にフォールバックする。
 */

const STORAGE_KEY = 'nethack_webui_lore_codex';

export class LoreCodexStorage {
    /**
     * @param {Object} [options]
     * @param {string} [options.storageKey] - ストレージキー名
     * @param {Object} [options.customStorage] - カスタムストレージオブジェクト
     */
    constructor(options = {}) {
        this.storageKey = options.storageKey || STORAGE_KEY;
        this.memoryFallback = null;
        this.customStorage = options.customStorage || null;
    }

    /**
     * 利用可能なストレージ実装を取得 (customStorage -> localStorage -> memoryFallback)
     * @private
     */
    _getStorage() {
        if (this.customStorage) return this.customStorage;

        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                // localStorage の読み書きテスト (プライベートブラウズ等の例外検知)
                const testKey = '__storage_test__';
                window.localStorage.setItem(testKey, '1');
                window.localStorage.removeItem(testKey);
                return window.localStorage;
            } catch (e) {
                // localStorage が使用不可の場合はメモリフォールバックへ
            }
        }

        if (!this.memoryFallback) {
            this.memoryFallback = new Map();
        }
        return {
            getItem: (key) => this.memoryFallback.get(key) || null,
            setItem: (key, val) => this.memoryFallback.set(key, String(val)),
            removeItem: (key) => this.memoryFallback.delete(key),
            clear: () => this.memoryFallback.clear()
        };
    }

    /**
     * データを保存
     * @param {Object} data
     * @returns {Promise<boolean>}
     */
    async save(data) {
        try {
            const storage = this._getStorage();
            const payload = {
                version: 1,
                updatedAt: new Date().toISOString(),
                data: data
            };
            const jsonStr = JSON.stringify(payload);
            storage.setItem(this.storageKey, jsonStr);
            return true;
        } catch (e) {
            console.warn('[LoreCodexStorage] Failed to save data:', e);
            return false;
        }
    }

    /**
     * データを読み込み
     * @returns {Promise<Object|null>}
     */
    async load() {
        try {
            const storage = this._getStorage();
            const raw = storage.getItem(this.storageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed.data || parsed;
        } catch (e) {
            console.warn('[LoreCodexStorage] Failed to load data:', e);
            return null;
        }
    }

    /**
     * ストレージを消去
     * @returns {Promise<boolean>}
     */
    async clear() {
        try {
            const storage = this._getStorage();
            storage.removeItem(this.storageKey);
            return true;
        } catch (e) {
            console.warn('[LoreCodexStorage] Failed to clear storage:', e);
            return false;
        }
    }

    /**
     * JSON 文字列としてエクスポート
     * @param {Object} data
     * @returns {string}
     */
    exportJSON(data) {
        return JSON.stringify({
            application: 'nethack-wasm-webui',
            type: 'lore_codex_backup',
            version: 1,
            exportedAt: new Date().toISOString(),
            payload: data
        }, null, 2);
    }

    /**
     * JSON 文字列からインポート
     * @param {string} jsonString
     * @returns {Object}
     */
    importJSON(jsonString) {
        const parsed = JSON.parse(jsonString);
        if (parsed.payload) {
            return parsed.payload;
        }
        if (parsed.rumors || parsed.oracles) {
            return parsed;
        }
        throw new Error('Invalid Lore Codex JSON backup format.');
    }
}

export default LoreCodexStorage;
