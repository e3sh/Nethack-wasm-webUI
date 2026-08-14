/**
 * DebugInspector.js - WebUICore 開発者支援 ＆ 別ウィンドウ監視デバッグ基盤
 *
 * WebUI クライアントの画面描画やスタイルに 100% 影響を与えず、
 * BroadcastChannel 通信を利用して別タブ/別ウィンドウの独立コンソールへ
 * Wasm 通信ログ・状態遷移・GKL キャッシュの配信およびダイレクト応答注入を行う。
 */

export class DebugInspector {
    constructor(core, options = {}) {
        if (!core) {
            throw new Error("DebugInspector: core instance is required.");
        }
        this.core = core;
        this.channelName = options.channelName || 'webuicore_inspector_channel';
        this.isBroadcasting = false;
        this.channel = null;
        this.consoleWindow = null;
        this.logs = [];
        this.maxLogCount = options.maxLogCount || 500;

        if (options.autoStart !== false) {
            this.startBroadcast();
        }
    }

    /**
     * BroadcastChannel への配信を開始
     */
    startBroadcast() {
        if (this.isBroadcasting) return;

        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.channel = new BroadcastChannel(this.channelName);
                this.channel.onmessage = (event) => this._handleConsoleMessage(event);
            } catch (e) {}
        }

        this.isBroadcasting = true;
        this._bindCoreEvents();
    }

    /**
     * 別ウィンドウで監視コンソールを開く
     */
    openConsoleWindow(consoleUrl) {
        const targetUrl = consoleUrl || './inspector_console.html';
        if (typeof window !== 'undefined' && typeof window.open === 'function') {
            this.consoleWindow = window.open(
                targetUrl,
                'WebUICoreInspectorConsole',
                'width=960,height=760,resizable=yes,scrollbars=yes'
            );
        }
        return this.consoleWindow;
    }

    /**
     * ログおよび状態の送信
     */
    broadcastLog(category, data) {
        const entry = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toLocaleTimeString(),
            category: category,
            data: data
        };

        this.logs.push(entry);
        if (this.logs.length > this.maxLogCount) {
            this.logs.shift();
        }

        if (this.channel && this.isBroadcasting) {
            try {
                this.channel.postMessage({
                    type: 'INSPECTOR_LOG',
                    entry: entry
                });
            } catch (e) {}
        }
        return entry;
    }

    /**
     * GKL 内部構造を含む現在の全体状態のスナップショット送信
     */
    broadcastState() {
        const situation = (this.core.gkl && typeof this.core.gkl.getSituation === 'function')
            ? this.core.gkl.getSituation()
            : (this.core.situationCache && typeof this.core.situationCache.getSituation === 'function'
                ? this.core.situationCache.getSituation()
                : null);

        let contextActions = [];
        if (situation) {
            if (Array.isArray(situation.actions)) {
                contextActions = situation.actions;
            } else if (Array.isArray(situation.action)) {
                contextActions = situation.action;
            } else if (situation.actions && typeof situation.actions === 'object') {
                contextActions = Object.values(situation.actions);
            }
        }

        if ((!contextActions || contextActions.length === 0) && this.core.situationCache && typeof this.core.situationCache.queryAction === 'function') {
            try {
                const res = this.core.situationCache.queryAction();
                if (Array.isArray(res)) contextActions = res;
            } catch (e) {}
        }

        const inventoryItems = (situation && situation.inventory)
            ? (Array.isArray(situation.inventory) ? situation.inventory : (situation.inventory.items || []))
            : ((this.core.gkl && this.core.gkl.inventoryStateManager && Array.isArray(this.core.gkl.inventoryStateManager.items))
                ? this.core.gkl.inventoryStateManager.items
                : ((this.core.inventoryStateManager && Array.isArray(this.core.inventoryStateManager.items)) ? this.core.inventoryStateManager.items : []));

        const statusData = (situation && situation.status)
            ? situation.status
            : (typeof this.core.getStatus === 'function'
                ? this.core.getStatus()
                : (this.core.gkl && typeof this.core.gkl.getStatus === 'function' ? this.core.gkl.getStatus() : {}));

        const areaData = (situation && situation.area)
            ? situation.area
            : (this.core.gkl && this.core.gkl.areaStateManager
                ? this.core.gkl.areaStateManager.getAreaState()
                : (typeof this.core.getAreaState === 'function' ? this.core.getAreaState() : null));

        const stateSnapshot = {
            state: this.core.state,
            promptCategory: this.core.currentPromptCategory,
            promptChoices: this.core.currentPromptChoices,
            hasActiveResolver: !!this.core.activeResolver,
            status: statusData,
            areaState: areaData,
            inventoryItems: inventoryItems,
            situation: situation,
            contextActions: contextActions
        };

        if (this.channel && this.isBroadcasting) {
            try {
                this.channel.postMessage({
                    type: 'INSPECTOR_STATE_SNAPSHOT',
                    snapshot: stateSnapshot
                });
            } catch (e) {}
        }

        return stateSnapshot;
    }

    /**
     * 外部コンソールからのダイレクト注入メッセージを処理
     */
    _handleConsoleMessage(event) {
        if (!event || !event.data) return;
        const msg = event.data;

        if (msg.type === 'INJECT_RESPONSE') {
            if (typeof this.core.respond === 'function') {
                this.core.respond(msg.value);
            }
            this.broadcastLog('INJECT', `Responded with: ${JSON.stringify(msg.value)}`);
        } else if (msg.type === 'INJECT_ACTION') {
            if (typeof this.core.sendAction === 'function') {
                this.core.sendAction(msg.actionName);
            }
            this.broadcastLog('INJECT', `Action sent: ${msg.actionName}`);
        } else if (msg.type === 'REQUEST_SNAPSHOT') {
            this.broadcastState();
        }
    }

    _bindCoreEvents() {
        if (!this.core || typeof this.core.on !== 'function') return;

        // --- Core 高レベルイベントのバインド ---
        this.core.on('inputRequired', (payload) => {
            this.broadcastLog('EVENT:inputRequired', {
                inputType: payload ? payload.inputType : undefined,
                prompt: payload ? (payload.prompt || payload.rawPrompt) : undefined,
                title: payload ? payload.title : undefined,
                choicesHint: payload ? payload.choicesHint : undefined,
                optionsCount: payload && payload.options ? payload.options.length : 0
            });
            this.broadcastState();
        });

        this.core.on('textWindowModal', (payload) => {
            this.broadcastLog('EVENT:textWindowModal', {
                windowId: payload ? payload.windowId : undefined,
                title: payload ? payload.title : undefined,
                linesCount: payload && payload.lines ? payload.lines.length : 0
            });
        });

        this.core.on('message', (msg) => {
            this.broadcastLog('EVENT:message', msg);
        });

        this.core.on('statusUpdate', (statusData) => {
            this.broadcastLog('EVENT:statusUpdate', {
                field: statusData ? statusData.field : undefined,
                value: statusData ? statusData.value : undefined
            });
            this.broadcastState();
        });

        this.core.on('inventoryStateUpdated', () => {
            this.broadcastLog('EVENT:inventoryStateUpdated', {
                itemCount: (this.core.gkl && this.core.gkl.inventoryStateManager) ? this.core.gkl.inventoryStateManager.items.length : 0
            });
            this.broadcastState();
        });

        this.core.on('clear_nhwindow', (data) => {
            this.broadcastLog('EVENT:clear_nhwindow', data);
        });

        this.core.on('cursor', (data) => {
            this.broadcastLog('EVENT:cursor', data);
        });

        this.core.on('soundEffect', (effect) => {
            this.broadcastLog('EVENT:soundEffect', effect);
        });

        // --- Driver 低レベル Wasm イベントのバインド ---
        if (this.core.driver && typeof this.core.driver.on === 'function') {
            const driverEvents = ['display_nhwindow', 'display_file', 'yn_function', 'getpos', 'getch'];
            driverEvents.forEach(evt => {
                this.core.driver.on(evt, (data) => {
                    this.broadcastLog(`DRIVER:${evt}`, data ? { windowId: data.windowId, filename: data.filename, prompt: data.prompt } : {});
                });
            });
        }
    }

    stopBroadcast() {
        this.isBroadcasting = false;
        if (this.channel) {
            try {
                this.channel.close();
            } catch (e) {}
            this.channel = null;
        }
    }
}
