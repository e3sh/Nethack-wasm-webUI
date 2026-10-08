/**
 * PortalState.js
 * 
 * NetHack WASM WebUI ポータル全体における設定・言語状態の一元管理マネージャー。
 * - localStorage ('nh.config') を Single Source of Truth として同期
 * - 言語切り替え時に 'nh-lang-changed' カスタムイベントを発火
 * - 複数タブ間での変更も storage イベントで検知・同期
 */

const STORAGE_KEY = 'nh.config';

class PortalStateManager {
    constructor() {
        this._listenersAttached = false;
        this._initStorageListener();
    }

    /**
     * 現在の設定オブジェクトを取得
     * @returns {Object}
     */
    getConfig() {
        if (typeof localStorage === 'undefined') {
            return { lang: true };
        }
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { lang: true };
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : { lang: true };
        } catch (e) {
            console.warn('[PortalState] Failed to read nh.config from localStorage:', e);
            return { lang: true };
        }
    }

    /**
     * 設定オブジェクトを部分更新・保存
     * @param {Object} patch 
     */
    saveConfig(patch) {
        if (typeof localStorage === 'undefined') return;
        try {
            const current = this.getConfig();
            const updated = { ...current, ...patch };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            console.warn('[PortalState] Failed to write nh.config to localStorage:', e);
        }
    }

    /**
     * 現在の言語が日本語かどうかを判定
     * @returns {boolean} true: 日本語, false: 英語
     */
    isJapanese() {
        const config = this.getConfig();
        if (typeof config.lang === 'boolean') {
            return config.lang;
        }
        if (typeof config.lang === 'string') {
            return config.lang.toLowerCase().startsWith('ja');
        }
        return true; // デフォルトは日本語
    }

    /**
     * 現在の言語コードを取得 ('ja' | 'en')
     * @returns {'ja' | 'en'}
     */
    getLanguage() {
        return this.isJapanese() ? 'ja' : 'en';
    }

    /**
     * 言語を設定し、永続化および変更通知を発火
     * @param {boolean | string} langOrBool true/'ja' なら日本語、false/'en' なら英語
     */
    setLanguage(langOrBool) {
        const isJp = (langOrBool === true || langOrBool === 'ja' || langOrBool === 'jp');
        this.saveConfig({ lang: isJp });
        this._notify();
    }

    /**
     * 言語（日本語 / 英語）を切り替える
     * @returns {boolean} 切り替え後の日本語判定
     */
    toggleLanguage() {
        const next = !this.isJapanese();
        this.setLanguage(next);
        return next;
    }

    /**
     * 言語変更イベントを発火
     * @private
     */
    _notify() {
        if (typeof window === 'undefined') return;
        const detail = {
            lang: this.getLanguage(),
            isJapanese: this.isJapanese()
        };
        const evt = new CustomEvent('nh-lang-changed', {
            bubbles: true,
            composed: true,
            detail
        });
        window.dispatchEvent(evt);
    }

    /**
     * 別タブでの localStorage 変更監視
     * @private
     */
    _initStorageListener() {
        if (this._listenersAttached || typeof window === 'undefined') return;
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) {
                this._notify();
            }
        });
        this._listenersAttached = true;
    }
}

// シングルトンインスタンス
export const PortalState = new PortalStateManager();

// 非モジュール環境やインラインスクリプト向けにグローバルへも公開
if (typeof window !== 'undefined') {
    window.PortalState = PortalState;
}
