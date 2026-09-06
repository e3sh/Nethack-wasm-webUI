/**
 * ContainerSafetyGuard.js
 *
 * Bag of Holding (BoH) へのアイテム投入時に、爆発を引き起こす
 * 危険アイテムを検知しブロックするセーフティガード。
 *
 * C コアの mbag_explodes() ロジック (pickup.c L2495-L2514) に準拠:
 *   - WAN_CANCELLATION (spe > 0)
 *   - BAG_OF_HOLDING (別の BoH)
 *   - BAG_OF_TRICKS (spe > 0)
 * depth=0 では 100% 爆発するため、直接投入時はハードブロック。
 *
 * GKL の InventoryStateManager / ItemIdentificationResolver を利用して
 * アイテムの識別状態に応じた判定を行う。
 */

import { OBJECT_KNOWLEDGE_MAP } from '../knowledge/OBJECT_KNOWLEDGE_FULL.js';

/**
 * 危険度レベル定数
 */
export const DangerLevel = {
    /** 安全 — ブロック不要 */
    SAFE: 'SAFE',
    /** 確定危険 — 識別済みで爆発確定。ハードブロック */
    CRITICAL: 'CRITICAL',
    /** 疑わしい — 未識別だが危険アイテムの可能性あり。警告表示 */
    SUSPICIOUS: 'SUSPICIOUS',
    /** チャージ切れ — 識別済みだが spe <= 0 で爆発しない */
    DISCHARGED: 'DISCHARGED',
};

/**
 * 既知の危険 onum 定数
 * (NetHack 5.0 objects.h / glyphClassifier.js 互換)
 */
const DANGEROUS_ONUMS = {
    WAN_CANCELLATION: 263,  // wand of cancellation (NetHack 5.0)
    BAG_OF_HOLDING: 346,    // bag of holding
    BAG_OF_TRICKS: 345,     // bag of tricks
};

/**
 * テキストパターンによる危険アイテム検知 (フォールバック層)
 */
const DANGER_TEXT_PATTERNS = [
    { pattern: /\bwand of cancellation\b/i, onum: DANGEROUS_ONUMS.WAN_CANCELLATION, type: 'wand' },
    { pattern: /打ち消しの杖/,             onum: DANGEROUS_ONUMS.WAN_CANCELLATION, type: 'wand' },
    { pattern: /\bbag of holding\b/i,      onum: DANGEROUS_ONUMS.BAG_OF_HOLDING,   type: 'bag' },
    { pattern: /軽量化の鞄/,               onum: DANGEROUS_ONUMS.BAG_OF_HOLDING,   type: 'bag' },
    { pattern: /\bbag of tricks\b/i,       onum: DANGEROUS_ONUMS.BAG_OF_TRICKS,    type: 'bag' },
    { pattern: /いたずらの袋/,             onum: DANGEROUS_ONUMS.BAG_OF_TRICKS,    type: 'bag' },
];

/**
 * 未識別の杖の外見名パターン (NetHack 5.0)
 * これらの外見名の杖は打ち消しの杖の可能性がある
 */
const UNIDENTIFIED_WAND_PATTERN = /\bwand\b/i;

/**
 * 未識別の袋の外見名パターン
 * "bag" という外見名は bag of holding / bag of tricks の可能性がある
 */
const UNIDENTIFIED_BAG_PATTERN = /\b(bag|sack)\b/i;


export class ContainerSafetyGuard {

    /**
     * @param {Object} [options={}]
     * @param {Object} [options.inventoryStateManager] - GKL の InventoryStateManager
     */
    constructor(options = {}) {
        this.inventoryStateManager = options.inventoryStateManager || null;
    }

    /**
     * InventoryStateManager を設定/更新
     */
    setInventoryStateManager(ism) {
        this.inventoryStateManager = ism;
    }

    /**
     * 対象コンテナが Bag of Holding であるかを判定
     *
     * @param {Object} containerInfo - コンテナ情報 { name, onum, rawText }
     * @returns {boolean}
     */
    isBagOfHolding(containerInfo) {
        if (!containerInfo) return false;

        // onum による確定判定
        if (containerInfo.onum === DANGEROUS_ONUMS.BAG_OF_HOLDING) return true;

        // テキストパターンによるフォールバック判定
        const text = containerInfo.name || containerInfo.rawText || '';
        return /\bbag of holding\b/i.test(text) || /軽量化の鞄/.test(text);
    }

    /**
     * 単一アイテムの危険度を判定
     *
     * @param {Object} item - アイテム情報 { onum, rawText, identification, ... }
     * @param {Object} [containerInfo] - 投入先コンテナ情報
     * @returns {{ level: string, reason: string, item: Object }}
     */
    assessItem(item, containerInfo = null) {
        if (!item) return { level: DangerLevel.SAFE, reason: '', item };

        // コンテナが BoH でなければ全て安全
        if (containerInfo && !this.isBagOfHolding(containerInfo)) {
            return { level: DangerLevel.SAFE, reason: '', item };
        }

        const onum = typeof item.onum === 'number' ? item.onum : -1;
        const rawText = item.rawText || '';
        const identification = item.identification || {};
        const isUnidentified = identification.isUnidentified || false;

        // 【層1】onum による確定判定
        if (onum === DANGEROUS_ONUMS.WAN_CANCELLATION) {
            return this._assessWandOfCancellation(item, rawText);
        }
        if (onum === DANGEROUS_ONUMS.BAG_OF_HOLDING) {
            return {
                level: DangerLevel.CRITICAL,
                reason: 'Bag of Holding の中に別の Bag of Holding を入れると爆発します！',
                item
            };
        }
        if (onum === DANGEROUS_ONUMS.BAG_OF_TRICKS) {
            return this._assessBagOfTricks(item, rawText);
        }

        // 【層2】テキストパターンによる確定判定 (onum が不明な場合のフォールバック)
        if (onum < 0) {
            for (const dp of DANGER_TEXT_PATTERNS) {
                if (dp.pattern.test(rawText)) {
                    if (dp.onum === DANGEROUS_ONUMS.WAN_CANCELLATION) {
                        return this._assessWandOfCancellation(item, rawText);
                    }
                    if (dp.onum === DANGEROUS_ONUMS.BAG_OF_HOLDING) {
                        return {
                            level: DangerLevel.CRITICAL,
                            reason: 'Bag of Holding の中に別の Bag of Holding を入れると爆発します！',
                            item
                        };
                    }
                    if (dp.onum === DANGEROUS_ONUMS.BAG_OF_TRICKS) {
                        return this._assessBagOfTricks(item, rawText);
                    }
                }
            }
        }

        // 【層3】未識別アイテムの疑義判定
        if (isUnidentified) {
            // 未識別の杖 → 打ち消しの杖の可能性
            if (UNIDENTIFIED_WAND_PATTERN.test(rawText) && !/wand of/i.test(rawText)) {
                return {
                    level: DangerLevel.SUSPICIOUS,
                    reason: 'この杖は打ち消しの杖 (Wand of Cancellation) の可能性があります。Bag of Holding に入れると爆発する恐れがあります。',
                    item
                };
            }
            // 未識別の袋 → bag of holding / bag of tricks の可能性
            if (UNIDENTIFIED_BAG_PATTERN.test(rawText)
                && !/bag of holding|bag of tricks|oilskin sack/i.test(rawText)
                && !/軽量化の鞄|いたずらの袋|油引きの袋/i.test(rawText)) {
                return {
                    level: DangerLevel.SUSPICIOUS,
                    reason: 'この袋は Bag of Holding または Bag of Tricks の可能性があります。爆発の恐れがあります。',
                    item
                };
            }
        }

        return { level: DangerLevel.SAFE, reason: '', item };
    }

    /**
     * 複数アイテムを一括で危険度チェック
     *
     * @param {Array<Object>} items - アイテムリスト
     * @param {Object} [containerInfo] - 投入先コンテナ情報
     * @returns {{ safe: Array, critical: Array, suspicious: Array, discharged: Array, hasDanger: boolean }}
     */
    assessItems(items, containerInfo = null) {
        const result = {
            safe: [],
            critical: [],
            suspicious: [],
            discharged: [],
            hasDanger: false,
        };

        if (!Array.isArray(items)) return result;

        for (const item of items) {
            const assessment = this.assessItem(item, containerInfo);
            switch (assessment.level) {
                case DangerLevel.CRITICAL:
                    result.critical.push(assessment);
                    result.hasDanger = true;
                    break;
                case DangerLevel.SUSPICIOUS:
                    result.suspicious.push(assessment);
                    result.hasDanger = true;
                    break;
                case DangerLevel.DISCHARGED:
                    result.discharged.push(assessment);
                    break;
                default:
                    result.safe.push(assessment);
                    break;
            }
        }

        return result;
    }

    /**
     * アイテムリストから危険アイテムを除外したリストを返す
     *
     * @param {Array<Object>} items
     * @param {Object} [containerInfo]
     * @param {Object} [options]
     * @param {boolean} [options.blockSuspicious=false] - 疑わしいアイテムもブロックするか
     * @returns {{ filteredItems: Array, blockedItems: Array }}
     */
    filterDangerousItems(items, containerInfo = null, options = {}) {
        const blockSuspicious = options.blockSuspicious || false;
        const assessment = this.assessItems(items, containerInfo);

        const blockedItems = [...assessment.critical];
        if (blockSuspicious) {
            blockedItems.push(...assessment.suspicious);
        }

        const blockedSet = new Set(blockedItems.map(a => a.item));
        const filteredItems = items.filter(item => !blockedSet.has(item));

        return { filteredItems, blockedItems };
    }

    // ========================================================================
    // 内部ヘルパー
    // ========================================================================

    /**
     * 打ち消しの杖の危険度判定 (spe チェック含む)
     * @private
     */
    _assessWandOfCancellation(item, rawText) {
        // spe (charges) の解析: "(0:N)" パターンから N を抽出
        const charges = this._extractCharges(rawText);
        if (charges !== null && charges <= 0) {
            return {
                level: DangerLevel.DISCHARGED,
                reason: 'チャージ切れの打ち消しの杖は爆発しません（安全）。',
                item
            };
        }
        return {
            level: DangerLevel.CRITICAL,
            reason: '打ち消しの杖 (Wand of Cancellation) を Bag of Holding に入れると爆発します！',
            item
        };
    }

    /**
     * Bag of Tricks の危険度判定 (spe チェック含む)
     * @private
     */
    _assessBagOfTricks(item, rawText) {
        const charges = this._extractCharges(rawText);
        if (charges !== null && charges <= 0) {
            return {
                level: DangerLevel.DISCHARGED,
                reason: 'チャージ切れの Bag of Tricks は爆発しません（安全）。',
                item
            };
        }
        return {
            level: DangerLevel.CRITICAL,
            reason: 'Bag of Tricks を Bag of Holding に入れると爆発します！',
            item
        };
    }

    /**
     * rawText から杖/袋のチャージ数 (spe) を抽出
     * "(0:3)" → 3, "(0:0)" → 0, 見つからなければ null
     * @private
     */
    _extractCharges(rawText) {
        if (!rawText) return null;
        const m = rawText.match(/\(0:(\d+)\)/);
        if (m) return parseInt(m[1], 10);
        return null;
    }
}

/** 危険 onum 定数をエクスポート (テスト用) */
ContainerSafetyGuard.DANGEROUS_ONUMS = DANGEROUS_ONUMS;
