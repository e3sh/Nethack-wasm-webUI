/**
 * ScenarioDriver.js
 * シナリオ再生用疑似ドライバ (Downlink Scenario Driver)
 *
 * キャプチャされたシナリオ JSON を読み込み、本物の NetHackWasmDriver と等価な
 * イベントストリームを WebUICore へ流し込んでシステム全体の一気通貫検証を支援する。
 */

export class ScenarioDriver {
    /**
     * @param {Object} [scenarioData] - シナリオ JSON データ
     */
    constructor(scenarioData = null) {
        this.listeners = new Map();
        this.keyMode = 'numpad';
        this.scenario = null;
        this.eventCursor = 0;
        this.isInitPlayed = false;
        this.lastPromptCategory = 'POSKEY';

        if (scenarioData) {
            this.loadScenario(scenarioData);
        }
    }

    /**
     * シナリオデータをロード
     * @param {Object} scenarioData 
     */
    loadScenario(scenarioData) {
        if (!scenarioData || typeof scenarioData !== 'object') {
            throw new Error('[ScenarioDriver] Invalid scenario data.');
        }
        this.scenario = JSON.parse(JSON.stringify(scenarioData));
        this.reset();
    }

    /**
     * 再生状態を先頭に巻き戻す
     */
    reset() {
        this.eventCursor = 0;
        this.isInitPlayed = false;
        this.lastPromptCategory = 'POSKEY';
    }

    /**
     * イベントリスナー登録
     * @param {string} event 
     * @param {Function} fn 
     */
    on(event, fn) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(fn);
        return this;
    }

    /**
     * イベントリスナー解除
     * @param {string} event 
     * @param {Function} fn 
     */
    off(event, fn) {
        if (!this.listeners.has(event)) return this;
        const filtered = this.listeners.get(event).filter(l => l !== fn);
        this.listeners.set(event, filtered);
        return this;
    }

    /**
     * イベント発行
     * @param {string} event 
     * @param {Object} [payload={}] 
     */
    emit(event, payload = {}) {
        if (!this.listeners.has(event)) return false;
        const handlers = this.listeners.get(event);
        for (const fn of handlers) {
            try {
                fn(payload);
            } catch (err) {
                console.error(`[ScenarioDriver] Error in event listener for '${event}':`, err);
            }
        }
        return true;
    }

    /**
     * 現在のプロンプトカテゴリを取得
     * @returns {string}
     */
    getPromptCategory() {
        return this.lastPromptCategory || 'POSKEY';
    }

    /**
     * initialState に記録された初期イベントを emit
     */
    playInit() {
        if (!this.scenario || !this.scenario.initialState) return;
        if (this.isInitPlayed) return;
        this.isInitPlayed = true;

        const init = this.scenario.initialState;

        // 1. 初期ステータスがあれば emit
        if (init.status) {
            const entries = Object.entries(init.status);
            for (const [key, val] of entries) {
                this.emit('status_update', { [key]: val, field: key, value: val });
            }
        }

        // 2. 初期イベントストリームがあれば順次 emit
        if (Array.isArray(init.initialEvents)) {
            for (const evt of init.initialEvents) {
                this.dispatchScenarioEvent(evt);
            }
        }
    }

    /**
     * 単一シナリオイベントをディスパッチ
     * @param {Object} evt 
     */
    dispatchScenarioEvent(evt) {
        if (!evt || !evt.type) return;

        if (evt.type === 'inputRequired' && evt.data?.category) {
            this.lastPromptCategory = evt.data.category;
        }

        this.emit(evt.type, evt.data !== undefined ? evt.data : {});
    }

    /**
     * 次の POSKEY (ターン入力待ち) に達するまでイベントを順次再生
     * @returns {Promise<boolean>} イベントが残っているか
     */
    async stepNextTurn() {
        if (!this.scenario) return false;
        if (!this.isInitPlayed) {
            this.playInit();
        }

        const events = this.scenario.events || [];
        if (this.eventCursor >= events.length) {
            return false;
        }

        let reachedTurn = false;

        while (this.eventCursor < events.length) {
            const evt = events[this.eventCursor++];
            this.dispatchScenarioEvent(evt);

            if (evt.type === 'inputRequired' && evt.data?.category === 'POSKEY') {
                reachedTurn = true;
                break;
            }
        }

        return reachedTurn || (this.eventCursor < events.length);
    }

    /**
     * 指定ターン数またはシナリオ終端までイベントを全自動再生
     * @returns {Promise<void>}
     */
    async playUntilTurn() {
        if (!this.scenario) return;
        if (!this.isInitPlayed) {
            this.playInit();
        }

        const events = this.scenario.events || [];
        while (this.eventCursor < events.length) {
            const evt = events[this.eventCursor++];
            this.dispatchScenarioEvent(evt);
        }
    }

    /**
     * キューシーケンスの即答型モック
     * initialState.silentBuffers または記録されたバッファを返却
     * @param {Array<string>} tokens 
     * @param {Object} [options={}] 
     * @returns {Promise<Array<string>>}
     */
    async queueSequence(tokens, options = {}) {
        const tokenKey = Array.isArray(tokens) ? tokens[0] : String(tokens);
        const silentBuffers = this.scenario?.initialState?.silentBuffers || {};

        // 登録されたバッファがあればそれを返却
        if (silentBuffers[tokenKey]) {
            return Promise.resolve([...silentBuffers[tokenKey]]);
        }

        // デフォルト空バッファ
        return Promise.resolve([]);
    }
}
