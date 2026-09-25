/**
 * MessageContextResolver.js
 * Phase 5 - Stage 5.2: 状況シグナル基盤 実行時コンテキスト照合エンジン
 * 
 * Wasm から届く 1 行の生テキスト (rawText) から、客観的事象を表現する
 * 構造化コンテキスト (MessageContext) を超高速 (< 0.1ms/件) に同定する。
 */

import { MESSAGE_CONTEXT_CATALOG } from './data/MessageContextCatalog.js';

export class MessageContextResolver {
    /**
     * @param {Object} [catalog=MESSAGE_CONTEXT_CATALOG] メッセージコンテキストカタログ
     */
    constructor(catalog = MESSAGE_CONTEXT_CATALOG) {
        this.catalog = catalog;
        this.exactMap = new Map();
        this.compiledBuckets = new Map();
        this._initCatalog();
    }

    /**
     * カタログのインデックス化および正規表現のプリコンパイル
     * @private
     */
    _initCatalog() {
        if (!this.catalog) return;

        // 1. 完全一致インデックスの構築 (Map O(1))
        if (this.catalog.exact) {
            for (const [text, tuple] of Object.entries(this.catalog.exact)) {
                this.exactMap.set(text, tuple);
            }
        }

        // 2. パターン正規表現のプリコンパイルとバケット分類
        const patterns = this.catalog.patterns || [];
        const buckets = this.catalog.buckets || {};

        for (const [bucketKey, indices] of Object.entries(buckets)) {
            const compiledList = [];
            for (const idx of indices) {
                const tuple = patterns[idx];
                if (!tuple) continue;
                const regexStr = tuple[7]; // pattern (regex string)
                try {
                    const regex = new RegExp(regexStr);
                    compiledList.push({
                        tuple,
                        regex
                    });
                } catch (e) {
                    console.warn(`[MessageContextResolver] Invalid regex: ${regexStr}`, e);
                }
            }
            this.compiledBuckets.set(bucketKey, compiledList);
        }
    }

    /**
     * 生テキストから MessageContext を解決する
     * @param {string} rawText Wasm/Core から渡されたメッセージテキスト
     * @returns {Object|null} MessageContext オブジェクト (未マッチ時は null)
     */
    resolve(rawText) {
        if (typeof rawText !== 'string' || !rawText) {
            return null;
        }

        // 1. 完全一致判定 (O(1))
        const exactTuple = this.exactMap.get(rawText);
        if (exactTuple) {
            return this._hydrateExact(rawText, exactTuple);
        }

        // 2. プレフィックスバケット判定 & パターン照合
        // 該当するプレフィックスバケットを特定
        let targetBucketKey = '*';
        for (const bucketKey of this.compiledBuckets.keys()) {
            if (bucketKey !== '*' && rawText.startsWith(bucketKey)) {
                targetBucketKey = bucketKey;
                break;
            }
        }

        // まずプレフィックスバケットを走査
        if (targetBucketKey !== '*') {
            const bucket = this.compiledBuckets.get(targetBucketKey);
            if (bucket) {
                for (let i = 0; i < bucket.length; i++) {
                    const item = bucket[i];
                    const match = rawText.match(item.regex);
                    if (match) {
                        return this._hydratePattern(rawText, item.tuple, match);
                    }
                }
            }
        }

        // ワイルドカードバケット (*) を走査
        const wildcardBucket = this.compiledBuckets.get('*');
        if (wildcardBucket) {
            for (let i = 0; i < wildcardBucket.length; i++) {
                const item = wildcardBucket[i];
                const match = rawText.match(item.regex);
                if (match) {
                    return this._hydratePattern(rawText, item.tuple, match);
                }
            }
        }

        return null;
    }

    /**
     * 完全一致タプルから MessageContext オブジェクトを復元
     * tuple: [id, file, domain, calleeFunc, semanticRole, layer, meta]
     * @private
     */
    _hydrateExact(rawText, tuple) {
        const [id, file, domain, calleeFunc, semanticRole, layer, meta] = tuple;
        return {
            messageId: id,
            file: file || '',
            domain: domain || '',
            calleeFunc: calleeFunc || '',
            semanticRole: semanticRole || 'UNKNOWN',
            layer: layer || 1,
            rawText: rawText,
            placeholders: [],
            metadata: meta ? { ...meta } : {}
        };
    }

    /**
     * パターン一致タプルから MessageContext オブジェクトを復元
     * tuple: [id, file, domain, calleeFunc, semanticRole, layer, rawPattern, pattern, meta, paramTypeStr]
     * @private
     */
    _hydratePattern(rawText, tuple, match) {
        const [id, file, domain, calleeFunc, semanticRole, layer, rawPattern, pattern, meta] = tuple;
        const placeholders = match.length > 1 ? Array.from(match.slice(1)) : [];

        return {
            messageId: id,
            file: file || '',
            domain: domain || '',
            calleeFunc: calleeFunc || '',
            semanticRole: semanticRole || 'UNKNOWN',
            layer: layer || 1,
            rawText: rawText,
            placeholders: placeholders,
            metadata: meta ? { ...meta } : {}
        };
    }
}

export default MessageContextResolver;
