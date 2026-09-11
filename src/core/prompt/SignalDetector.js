/**
 * SignalDetector.js - 機械用制御シグナル検知エンジン
 *
 * C コアや WebUICore から発行される各種プロンプト/メニュー/ダイアログペイロードを解析し、
 * ControlSignalCatalog の定義に基づいて機械用制御シグナル (signalId, subCategory, inputType, params)
 * を高精度に特定・抽出する。
 *
 * 【設計コンセプト: バリアント/ロケール別辞書の完全分離】
 * - Vanilla NetHack 5.0 (英語 Wasm コア) -> ControlSignalCatalog.json
 * - JNetHack (日本語 Wasm コア)          -> ControlSignalCatalog.ja.json
 * 実行する Wasm バリアントに応じて適切な辞書をロードし、パターン衝突の防止と高速マッチングを実現する。
 */

import enCatalog from './ControlSignalCatalog.js';
import jaCatalog from './ControlSignalCatalog.ja.js';
import { PROMPT_CATEGORY } from '../types.js';

export class SignalDetector {
    /**
     * @param {Object} [catalog] - 制御シグナル辞書オブジェクト (未指定時は enCatalog)
     * @param {Object} [options] - オプション設定
     */
    constructor(catalog = null, options = {}) {
        this.options = options;
        this.compiledSignals = [];
        this.loadCatalog(catalog || enCatalog);
    }

    /**
     * デフォルト (Vanilla NetHack / 英語) カタログで初期化された SignalDetector インスタンスを生成
     * @param {Object} [options]
     * @returns {SignalDetector}
     */
    static createDefault(options = {}) {
        return new SignalDetector(enCatalog, options);
    }

    /**
     * ロケールまたはバリアントに応じた SignalDetector インスタンスを生成
     * @param {'en'|'ja'|'vanilla'|'jnethack'} [localeOrVariant='en']
     * @param {Object} [options]
     * @returns {SignalDetector}
     */
    static createForLocale(localeOrVariant = 'en', options = {}) {
        const catalog = SignalDetector.getCatalog(localeOrVariant);
        return new SignalDetector(catalog, options);
    }

    /**
     * ロケールまたはバリアントに応じた組み込みカタログを取得
     * @param {'en'|'ja'|'vanilla'|'jnethack'} [localeOrVariant='en']
     * @returns {Object}
     */
    static getCatalog(localeOrVariant = 'en') {
        const key = String(localeOrVariant).toLowerCase();
        if (key === 'ja' || key === 'jnethack' || key === 'japanese') {
            return jaCatalog;
        }
        return enCatalog;
    }

    /**
     * カタログの読み込みと正規表現プリコンパイル
     * @param {Object} catalog
     */
    loadCatalog(catalog) {
        if (!catalog || !Array.isArray(catalog.signals)) {
            throw new Error('[SignalDetector] Invalid catalog format: "signals" array is required.');
        }
        this.catalog = catalog;

        // 優先度 (priority) 降順でソートしてコンパイル
        const sorted = [...catalog.signals].sort((a, b) => (b.priority || 0) - (a.priority || 0));

        this.compiledSignals = sorted.map(sig => {
            const flags = sig.flags || 'i';
            const compiledPatterns = (sig.patterns || []).map(p => {
                try {
                    return new RegExp(p, flags);
                } catch (e) {
                    console.warn(`[SignalDetector] Failed to compile pattern "${p}" for signal ${sig.id}:`, e);
                    return null;
                }
            }).filter(Boolean);

            return {
                id: sig.id,
                subCategory: sig.subCategory,
                inputType: sig.inputType,
                priority: sig.priority || 0,
                contextFilter: sig.contextFilter || {},
                patterns: compiledPatterns,
                params: sig.params || {},
                paramsMapping: sig.paramsMapping || {},
                description: sig.description || ''
            };
        });
    }

    /**
     * 現在ロードされているカタログ定義を取得
     * @returns {Object}
     */
    getCurrentCatalog() {
        return this.catalog;
    }

    /**
     * ペイロードから制御シグナルを検知
     *
     * @param {Object|string} payload - inputRequired payload またはプロンプト文字列
     * @param {Object} [contextInfo={}] - 外部から補足するコンテキスト情報 (例: { triggerCommand: '#loot' })
     * @returns {{
     *   matched: boolean,
     *   signalId: string|null,
     *   subCategory: string|null,
     *   inputType: string|null,
     *   params: Object,
     *   confidence: number,
     *   rawPrompt: string,
     *   signalDef: Object|null
     * }}
     */
    detect(payload, contextInfo = {}) {
        if (!payload) {
            return this._createEmptyResult('');
        }

        const normalizedPayload = typeof payload === 'string' ? { prompt: payload } : payload;

        // C コア生プロンプトの抽出（UI翻訳層を経由する前の純粋な生文字列）
        const rawPrompt = normalizedPayload.rawPrompt ||
                          normalizedPayload.rawMessage ||
                          normalizedPayload.query ||
                          normalizedPayload.question ||
                          contextInfo.lastMessage ||
                          contextInfo.recentText ||
                          normalizedPayload.message ||
                          normalizedPayload.prompt ||
                          '';

        const mergedContext = {
            triggerCommand: normalizedPayload.triggerCommand ||
                            normalizedPayload.command ||
                            normalizedPayload.lastCommand ||
                            contextInfo.triggerCommand ||
                            null,
            ...contextInfo
        };

        // 各コンパイル済みシグナルを優先度順に評価
        for (const sig of this.compiledSignals) {
            // 1. コンテキストフィルタの評価
            if (!this._matchesContextFilter(sig.contextFilter, normalizedPayload, mergedContext)) {
                continue;
            }

            // 1.5 inputType / category の構造的一致（DIRECTION 等の明確な制御シグナルは即座に同定）
            if (sig.id === 'SIGNAL_DIRECTION' && (
                normalizedPayload.inputType === 'DIRECTION' ||
                normalizedPayload.category === 'DIRECTION' ||
                normalizedPayload.promptCategory === 'DIRECTION'
            )) {
                return {
                    matched: true,
                    signalId: sig.id,
                    subCategory: sig.subCategory,
                    inputType: sig.inputType,
                    params: {},
                    confidence: 1.0,
                    rawPrompt: rawPrompt || normalizedPayload.prompt || '',
                    signalDef: sig
                };
            }

            // 2. パターンマッチングの評価 (C コア生プロンプトと照合)
            if (rawPrompt) {
                for (const regex of sig.patterns) {
                    const match = rawPrompt.match(regex);
                    if (match) {
                        // パラメータの抽出・マッピング
                        const params = this._extractParams(sig, match, normalizedPayload);

                        return {
                            matched: true,
                            signalId: sig.id,
                            subCategory: sig.subCategory,
                            inputType: sig.inputType,
                            params: params,
                            confidence: 1.0,
                            rawPrompt: rawPrompt,
                            signalDef: sig
                        };
                    }
                }
            }

            // 3. プロンプト文字列が空でもアイテム構造から判定可能な場合の補足 (例: コンテナメニュー)
            if (!rawPrompt && sig.subCategory === 'CONTAINER_ACTION_MENU') {
                const items = normalizedPayload.items || normalizedPayload.menuItems || [];
                const containerName = this._extractContainerNameFromItems(items);
                if (containerName) {
                    return {
                        matched: true,
                        signalId: sig.id,
                        subCategory: sig.subCategory,
                        inputType: sig.inputType,
                        params: { ...sig.params, containerName },
                        confidence: 0.9,
                        rawPrompt: rawPrompt,
                        signalDef: sig
                    };
                }
            }
        }

        return this._createEmptyResult(rawPrompt);
    }

    /**
     * 特定の signalId に合致するか判定するユーティリティ
     * @param {Object|string} payload
     * @param {string} targetSignalId
     * @param {Object} [contextInfo={}]
     * @returns {boolean}
     */
    isSignal(payload, targetSignalId, contextInfo = {}) {
        const res = this.detect(payload, contextInfo);
        return res.matched && res.signalId === targetSignalId;
    }

    // ========================================================================
    // 内部ヘルパー
    // ========================================================================

    /**
     * コンテキストフィルタの合致判定
     * @private
     */
    _matchesContextFilter(filter, payload, contextInfo) {
        if (!filter || Object.keys(filter).length === 0) {
            return true;
        }

        const category = payload.promptCategory || payload.category || '';
        const context = payload.context || '';
        const items = payload.items || payload.menuItems || [];
        const isPayloadObject = (typeof payload === 'object' && payload !== null);

        // 1. トリガコマンドチェック (指定がある場合)
        if (filter.triggerCommand) {
            const expected = filter.triggerCommand.toLowerCase();
            const actual = (contextInfo.triggerCommand || '').toLowerCase();
            if (actual !== expected) {
                return false;
            }
        }

        // 2. isTextType チェック (TEXT/ASKNAME/EXTCMD/LINE/LINE_TEXT または context: text/getlin)
        if (filter.isTextType) {
            if (isPayloadObject && (category || context || payload.inputType)) {
                const isText = (
                    category === PROMPT_CATEGORY.TEXT ||
                    category === PROMPT_CATEGORY.ASKNAME ||
                    category === PROMPT_CATEGORY.EXTCMD ||
                    category === 'TEXT' ||
                    category === 'ASKNAME' ||
                    category === 'EXTCMD' ||
                    category === 'LINE' ||
                    category === 'LINE_TEXT' ||
                    payload.inputType === 'LINE_TEXT' ||
                    context === 'text' ||
                    context === 'getlin' ||
                    context === 'extcmd' ||
                    context === 'get_ext_cmd'
                );
                if (!isText) return false;
            }
        }

        // 3. categories ホワイトリスト
        if (Array.isArray(filter.categories) && filter.categories.length > 0) {
            if (category && !filter.categories.includes(category)) {
                return false;
            }
        }

        // 4. contexts ホワイトリスト
        if (Array.isArray(filter.contexts) && filter.contexts.length > 0) {
            if (context && !filter.contexts.includes(context)) {
                return false;
            }
        }

        // 5. excludeInventoryMenu チェック (インベントリアクションメニューの場合は除外)
        if (filter.excludeInventoryMenu && Array.isArray(items) && items.length > 0) {
            if (this._isInventoryActionMenu(items)) {
                return false;
            }
        }

        return true;
    }

    /**
     * パラメータ抽出と正規化
     * @private
     */
    _extractParams(sig, match, payload) {
        const params = { ...(sig.params || {}) };
        const groups = match.groups || {};

        // 名前付きキャプチャグループを展開
        for (const [key, val] of Object.entries(groups)) {
            if (val !== undefined && val !== null) {
                params[key] = typeof val === 'string' ? val.trim() : val;
            }
        }

        // paramsMapping による宣言的マッピング変換
        if (sig.paramsMapping) {
            for (const [groupKey, mappingRules] of Object.entries(sig.paramsMapping)) {
                const matchedVal = groups[groupKey];
                if (matchedVal && mappingRules[matchedVal]) {
                    Object.assign(params, mappingRules[matchedVal]);
                }
            }
        }

        // direction のフォールバック正規化 (Take out / Put in 等)
        if (!params.direction) {
            const raw = (groups.directionAction || groups.directionActionJa || match[0] || '').toLowerCase();
            if (raw.includes('take out') || raw.includes('取り出す') || raw.includes('外に出す')) {
                params.direction = 'out';
            } else if (raw.includes('put in') || raw.includes('入れる') || raw.includes('中に入れる')) {
                params.direction = 'in';
            }
        }

        // containerName のクリーンアップ
        if (params.containerName) {
            let cName = params.containerName.trim();
            cName = cName.replace(/^the\s+/i, 'the ');
            cName = cName.replace(/(?:の中身)?$/, '').trim();
            cName = cName.replace(/[\.\!\?]+$/, '').trim();
            params.containerName = cName;
        }

        // items からのコンテナ名補完
        if (!params.containerName && sig.subCategory === 'CONTAINER_ACTION_MENU') {
            const items = payload.items || payload.menuItems || [];
            const nameFromItems = this._extractContainerNameFromItems(items);
            if (nameFromItems) {
                params.containerName = nameFromItems;
            }
        }

        return params;
    }

    /**
     * メニュー項目群から "Look inside <container>" パターンでコンテナ名を抽出
     * @private
     */
    _extractContainerNameFromItems(items) {
        if (!Array.isArray(items) || items.length === 0) return null;
        for (const item of items) {
            const text = item.rawStr || item.str || item.text || item.label || '';
            const m = text.match(/Look inside (.+)$/i);
            if (m) return m[1].trim();
            const mJa = text.match(/(.+?)の中身を見る/i);
            if (mJa) return mJa[1].trim();
        }
        return null;
    }

    /**
     * インベントリアクションメニュー判定 (drop, throw, name などの所持品メニューを除外)
     * @private
     */
    _isInventoryActionMenu(items) {
        for (const item of items) {
            if (!item) continue;
            const text = (item.rawStr || item.str || item.text || item.label || '').toLowerCase().trim();
            if (/^(?:drop|落とす|置く)(?:\s|$)/i.test(text)) return true;
            if (/^(?:name|call|名付ける|名前)(?:\s|$)/i.test(text)) return true;
            if (/^(?:throw|投げる)(?:\s|$)/i.test(text)) return true;
        }
        return false;
    }

    /**
     * 未検知時の結果オブジェクトを生成
     * @private
     */
    _createEmptyResult(rawPrompt) {
        return {
            matched: false,
            signalId: null,
            subCategory: null,
            inputType: null,
            params: {},
            confidence: 0,
            rawPrompt: rawPrompt || '',
            signalDef: null
        };
    }
}
