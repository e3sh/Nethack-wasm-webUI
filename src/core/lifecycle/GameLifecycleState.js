/**
 * GameLifecycleState.js
 *
 * NetHack Wasm WebUI の包括的ゲームライフサイクルステートマシン定義 (SSOT)
 * 散在していた起動・セーブ復帰・ターン確定・終了フラグを一元化する。
 */

export const GAME_LIFECYCLE_STATE = {
    /** 初期化前 (WASM/スクリプト読み込み中) */
    INITIALIZING: 'INITIALIZING',
    /** 起動ウィザード・セーブデータ検出選択中 */
    BOOTSTRAPPING: 'BOOTSTRAPPING',
    /** キャラクター作成モーダル対話中 */
    CHARACTER_CREATION: 'CHARACTER_CREATION',
    /** Cコア起動プロセス進行中 */
    CORE_STARTING: 'CORE_STARTING',
    /** 初回不可分同期実行中 (ユーザー入力遮断・プロファイル/インベントリ/耐性等一括同期) */
    ATOMIC_INITIAL_SYNC: 'ATOMIC_INITIAL_SYNC',
    /** ダンジョン突入待機中 (READY) */
    READY_STANDBY: 'READY_STANDBY',
    /** 通常ゲームプレイ中 (アクティブ) */
    ACTIVE_PLAY: 'ACTIVE_PLAY',
    /** 死亡または脱出によるゲーム終了 */
    GAME_OVER: 'GAME_OVER'
};

export class GameLifecycleManager {
    constructor() {
        this._state = GAME_LIFECYCLE_STATE.INITIALIZING;
        this._isSaveResuming = false;
        this._listeners = new Set();
    }

    get state() {
        return this._state;
    }

    get isSaveResuming() {
        return this._isSaveResuming;
    }

    set isSaveResuming(val) {
        this._isSaveResuming = Boolean(val);
    }

    /**
     * 状態を遷移させる
     * @param {string} nextState - GAME_LIFECYCLE_STATE のいずれか
     * @param {Object} [payload={}]
     * @returns {boolean} 遷移成功か
     */
    transitionTo(nextState, payload = {}) {
        if (!Object.values(GAME_LIFECYCLE_STATE).includes(nextState)) {
            console.warn(`[GameLifecycleManager] Unknown state: ${nextState}`);
            return false;
        }
        const prevState = this._state;
        if (prevState === nextState) return false;

        this._state = nextState;
        this._notify({ prevState, nextState, ...payload });
        return true;
    }

    /**
     * 状態変更リスナーを登録
     * @param {Function} listener
     * @returns {Function} 解除関数
     */
    subscribe(listener) {
        if (typeof listener === 'function') {
            this._listeners.add(listener);
            return () => this._listeners.delete(listener);
        }
        return () => {};
    }

    _notify(event) {
        for (const listener of this._listeners) {
            try {
                listener(event);
            } catch (err) {
                console.error('[GameLifecycleManager] Listener error:', err);
            }
        }
    }

    /**
     * 状態のリセット
     */
    reset() {
        this._state = GAME_LIFECYCLE_STATE.INITIALIZING;
        this._isSaveResuming = false;
    }
}
