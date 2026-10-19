/**
 * EncumbranceStateManager.js
 *
 * GKL (Gameplay Knowledge Layer) インベントリ重量・負荷状態管理コア。
 *
 * 責務:
 * 1. 手持ちアイテムの基本重量合算 (OBJECT_KNOWLEDGE_MAP 引き当て、金貨 100枚=1)。
 * 2. コンテナキャッシュ (containerCache) による袋ごとの実効重量追跡。
 * 3. 保持の袋 (Bag of Holding: BoH) の BUC (祝福 25%、未呪い 50%、呪い 200%) 軽減/増加計算。
 * 4. 中身未確認袋 (isKnown === false) の基本重量扱いと未確認バッジ判定。
 * 5. プレイヤー許容量 (Carrying Capacity) の算出 (acurrstr準拠 STR + CON)。
 * 6. C コア公式負荷ステータス (BL_CAP) とのハイブリッド連動補正。
 */

import { OBJECT_KNOWLEDGE_MAP } from "../data/OBJECT_KNOWLEDGE_FULL.js";

/**
 * 負荷段階定数
 */
export const EncumbranceLevel = {
    NORMAL: 'NORMAL',
    CAUTION: 'CAUTION',
    DANGER: 'DANGER',
    CRITICAL: 'CRITICAL',
};

/**
 * レベル優先度 (数値が大きいほど危険)
 */
export const ENCUMBRANCE_PRIORITY = {
    [EncumbranceLevel.NORMAL]: 0,
    [EncumbranceLevel.CAUTION]: 1,
    [EncumbranceLevel.DANGER]: 2,
    [EncumbranceLevel.CRITICAL]: 3,
};

/**
 * BL_CAP (0〜5) と EncumbranceLevel のマッピング
 */
export const BL_CAP_TO_LEVEL = {
    0: EncumbranceLevel.NORMAL,    // Unencumbered
    1: EncumbranceLevel.CAUTION,   // Burdened
    2: EncumbranceLevel.DANGER,    // Stressed
    3: EncumbranceLevel.DANGER,    // Strained
    4: EncumbranceLevel.CRITICAL,  // Overtaxed
    5: EncumbranceLevel.CRITICAL,  // Overloaded
};

/**
 * BL_CAP (0〜5) に対応する最低パーセンテージ下限 (バー表示と公式判定の同期保証用)
 */
export const MIN_PERCENTAGE_BY_BL_CAP = {
    0: 0,    // Unencumbered
    1: 70,   // Burdened (CAUTION)
    2: 100,  // Stressed (DANGER)
    3: 110,  // Strained
    4: 120,  // Overtaxed
    5: 134,  // Overloaded (CRITICAL)
};

/**
 * NetHack の acurrstr() に準拠して STR 値をパース
 * (18/01..18/31 -> 19, 18/32..18/81 -> 20, 18/82..18/** -> 21, 19..25 -> 19..25)
 * @param {string|number} strValue 
 * @returns {number} 3〜25 の数値
 */
export function parseAcurrStr(strValue) {
    if (strValue === undefined || strValue === null) return 10;
    if (typeof strValue === 'number') {
        return Math.max(3, Math.min(25, Math.floor(strValue)));
    }
    const str = String(strValue).trim();
    // 18/** または 18/xx の例外筋力
    const match = str.match(/^18\/(\*\*|\d+)$/);
    if (match) {
        const sub = match[1];
        if (sub === '**') return 21;
        const subNum = parseInt(sub, 10);
        if (subNum <= 31) return 19;
        if (subNum <= 81) return 20;
        return 21; // 82..100
    }
    const numMatch = str.match(/^\d+/);
    if (numMatch) {
        const val = parseInt(numMatch[0], 10);
        return Math.max(3, Math.min(25, val));
    }
    return 10;
}

/**
 * CON (耐久力) をパース
 * @param {string|number} conValue 
 * @returns {number} 3〜25 の数値
 */
export function parseCon(conValue) {
    if (typeof conValue === 'number') {
        return Math.max(3, Math.min(25, Math.floor(conValue)));
    }
    if (typeof conValue === 'string') {
        const num = parseInt(conValue, 10);
        if (!isNaN(num)) return Math.max(3, Math.min(25, num));
    }
    return 10;
}

/**
 * 運搬許容量 (Carrying Capacity) の算出
 * NetHack 5.0 (hack.c): carrcap = 25 * (ACURRSTR + ACURR(A_CON)) + 50 (MAX 1000)
 * @param {string|number} str 
 * @param {string|number} con 
 * @returns {number}
 */
export function calculateCarryingCapacity(str, con) {
    const s = parseAcurrStr(str);
    const c = parseCon(con);
    return Math.min(1000, 25 * (s + c) + 50);
}

/**
 * 構造化アイテムまたは BUC ステータスから BUC 数値を解決 (1: 祝福, 0: 未呪い, -1: 呪い)
 * ※言語設定や表示テキスト（「普通の」「呪われていない」「uncursed」等）に依存しない構造化プロパティ準拠
 * @param {Object|string|number} itemOrStatus 
 * @returns {number} 1: 祝福, 0: 未呪い, -1: 呪い
 */
export function resolveBucStatus(itemOrStatus) {
    if (itemOrStatus === null || itemOrStatus === undefined) return 0;
    if (typeof itemOrStatus === 'number') {
        return itemOrStatus > 0 ? 1 : (itemOrStatus < 0 ? -1 : 0);
    }
    if (typeof itemOrStatus === 'object') {
        if (typeof itemOrStatus.bcursed === 'number') {
            return itemOrStatus.bcursed > 0 ? 1 : (itemOrStatus.bcursed < 0 ? -1 : 0);
        }
        if (itemOrStatus.bucStatus) {
            return resolveBucStatus(itemOrStatus.bucStatus);
        }
        if (itemOrStatus.flags) {
            if (itemOrStatus.flags.blessed) return 1;
            if (itemOrStatus.flags.cursed) return -1;
            return 0;
        }
        return 0;
    }
    if (typeof itemOrStatus === 'string') {
        const upper = itemOrStatus.trim().toUpperCase();
        if (upper === 'BLESSED') return 1;
        if (upper === 'CURSED') return -1;
        if (upper === 'UNCURSED' || upper === 'UNKNOWN') return 0;
    }
    return 0;
}

/**
 * 互換用エイリアス (resolveBucStatus に委譲)
 */
export const detectBucStatus = resolveBucStatus;

/**
 * 構造化プロパティまたは onum からコンテナ種別を判定
 * ※文字列正規表現による推測を全廃し、構造化プロパティおよび OBJECT_KNOWLEDGE_MAP に一本化
 * @param {Object|number|string} itemOrOnum 
 * @param {number} [onum=-1] 
 * @returns {string}
 */
export function detectContainerType(itemOrOnum, onum = -1) {
    let resolvedOnum = onum;
    if (typeof itemOrOnum === 'number') {
        resolvedOnum = itemOrOnum;
    } else if (itemOrOnum && typeof itemOrOnum === 'object') {
        if (itemOrOnum.containerType) return itemOrOnum.containerType;
        if (itemOrOnum.isBagOfHolding) return 'BAG_OF_HOLDING';
        if (typeof itemOrOnum.onum === 'number' && itemOrOnum.onum >= 0) {
            resolvedOnum = itemOrOnum.onum;
        }
    }

    if (resolvedOnum >= 0) {
        const info = OBJECT_KNOWLEDGE_MAP.get(resolvedOnum);
        if (info) {
            if (info.name === 'bag of holding') return 'BAG_OF_HOLDING';
            if (info.name === 'sack') return 'SACK';
            if (info.name === 'oilskin sack') return 'OILSKIN_SACK';
            if (info.name === 'chest') return 'CHEST';
            if (info.name === 'large box') return 'LARGE_BOX';
            if (info.name === 'ice box') return 'ICE_BOX';
            if (info.name === 'bag of tricks') return 'BAG_OF_TRICKS';
        }
    }

    return 'UNKNOWN';
}

/**
 * コンテナの空状態の基本重量を取得
 * @param {string} containerType 
 * @param {number} [onum=-1] 
 * @returns {number}
 */
export function getContainerBaseWeight(containerType, onum = -1) {
    if (onum >= 0) {
        const info = OBJECT_KNOWLEDGE_MAP.get(onum);
        if (info && typeof info.weight === 'number' && info.weight > 0) {
            return info.weight;
        }
    }
    switch (containerType) {
        case 'BAG_OF_HOLDING':
        case 'SACK':
        case 'OILSKIN_SACK':
            return 15;
        case 'BAG_OF_TRICKS':
            return 20;
        case 'LARGE_BOX':
            return 350;
        case 'CHEST':
            return 600;
        case 'ICE_BOX':
            return 900;
        default:
            return 15;
    }
}

export class EncumbranceStateManager {
    /**
     * @param {Object} [options={}]
     * @param {Object} [options.statusAccessor]
     * @param {Object} [options.inventoryStateManager]
     * @param {Object} [options.containerContentsManager]
     * @param {Object} [options.wasmDirectBindingService]
     */
    constructor(options = {}) {
        this.statusAccessor = options.statusAccessor || null;
        this.inventoryStateManager = options.inventoryStateManager || null;
        this.containerContentsManager = options.containerContentsManager || null;
        this.wasmDirectBindingService = options.wasmDirectBindingService || null;

        /** @type {Map<string, Object>} letter -> ContainerWeightRecord */
        this.containerCache = new Map();

        this._lastCalculatedState = null;
        this._ccmHandler = null;

        if (this.containerContentsManager) {
            this.setContainerContentsManager(this.containerContentsManager);
        }
    }

    setWasmDirectBindingService(service) {
        this.wasmDirectBindingService = service;
    }

    setStatusAccessor(sa) {
        this.statusAccessor = sa;
    }

    setInventoryStateManager(ism) {
        this.inventoryStateManager = ism;
    }

    setContainerContentsManager(ccm) {
        if (this._ccmHandler && this.containerContentsManager && typeof this.containerContentsManager.off === 'function') {
            this.containerContentsManager.off('contentsConfirmed', this._ccmHandler);
            this.containerContentsManager.off('itemTransferred', this._ccmHandler);
        }

        this.containerContentsManager = ccm;

        if (ccm && typeof ccm.on === 'function') {
            this._ccmHandler = (data) => {
                this._handleContainerUpdate(data);
            };
            ccm.on('contentsConfirmed', this._ccmHandler);
            ccm.on('itemTransferred', this._ccmHandler);
        }
    }

    /**
     * ContainerContentsManager からの通知ハンドラ
     * @private
     */
    _handleContainerUpdate(data) {
        if (!data) return;
        let letter = data.letter;

        // letter が渡されていない場合のスマート解決
        if (!letter) {
            if (this.containerCache.size === 1) {
                letter = this.containerCache.keys().next().value;
            } else if (data.containerName) {
                for (const [l, rec] of this.containerCache.entries()) {
                    if (rec.name === data.containerName || (data.containerType && rec.containerType === data.containerType)) {
                        letter = l;
                        break;
                    }
                }
            }
        }

        if (letter) {
            this.updateContainer(letter, {
                name: data.containerName,
                onum: data.containerOnum,
                containerType: data.containerType,
                isKnown: true,
                items: data.items || [],
            });
        }
    }

    /**
     * キャッシュのリセット
     */
    reset() {
        this.containerCache.clear();
        this._lastCalculatedState = null;
    }

    /**
     * 単一アイテムの重量を算出
     * @param {Object} item 
     * @returns {number}
     */
    getItemWeight(item) {
        if (!item) return 0;

        // 1. Wasm 直接バインディングによる真の重量 (weight(o)) が事前設定されている場合は最優先 (SSOT)
        if (typeof item.weight === 'number' && item.weight >= 0) {
            return item.weight;
        }

        // 2. サービスから直接単体アイテム重量を取得可能な場合 (Cコア関数 weight(struct obj *) 呼び出し)
        if (this.wasmDirectBindingService && (item.rawObjPtr || item.ptr)) {
            const directObjWeight = this.wasmDirectBindingService.getObjectWeight(item.rawObjPtr || item.ptr);
            if (directObjWeight >= 0) {
                return directObjWeight;
            }
        }

        // 3. モック・テスト時等の構造化プロパティによる算出フォールバック
        // 数量の取得 (CanonicalItem: quan / count)
        const count = typeof item.count === 'number' && item.count >= 0
            ? item.count
            : (typeof item.quan === 'number' && item.quan >= 0 ? item.quan : 1);

        // 金貨判定 (100枚ごとに重量 1) - 文字列パースを撤廃し構造化プロパティのみで判定
        const isGold = Boolean(
            item.isGold ||
            item.category === 'GOLD' ||
            item.letter === '$' ||
            item.onum === 438
        );
        if (isGold) {
            return Math.floor(count / 100);
        }

        // 基本単体重量の取得
        let unitWeight = 0;
        if (typeof item.onum === 'number' && item.onum >= 0) {
            const info = OBJECT_KNOWLEDGE_MAP.get(item.onum);
            if (info && typeof info.weight === 'number') {
                unitWeight = info.weight;
            }
        }
        if (unitWeight === 0 && item.knowledge && typeof item.knowledge.weight === 'number') {
            unitWeight = item.knowledge.weight;
        }

        // 特殊アイテム (彫像、巨岩、死体) の構造化フォールバック重量判定
        if (unitWeight === 0) {
            const cat = String(item.category || '').toUpperCase();
            if (item.isStatue || cat === 'STATUE' || item.onum === 476) {
                // NetHack の像基本重量: 2500
                unitWeight = 2500;
            } else if (item.isBoulder || item.onum === 475) {
                // NetHack の巨岩基本重量: 6000
                unitWeight = 6000;
            } else if (item.isCorpse || cat === 'CORPSE' || item.onum === 265) {
                // モンスター死体の平均重量: 200
                unitWeight = 200;
            }
        }

        return unitWeight * count;
    }

    /**
     * コンテナレコードから実効重量を算出
     * @param {Object} record 
     * @returns {number}
     */
    computeContainerWeight(record) {
        if (!record) return 0;
        const baseWeight = record.baseWeight || 15;

        // 中身未確認の場合は袋自体の重さのみ
        if (!record.isKnown) {
            return baseWeight;
        }

        const rawWeight = record.contentsRawWeight || 0;

        // 保持の袋 (Bag of Holding) の特殊計算
        if (record.containerType === 'BAG_OF_HOLDING') {
            if (record.bcursed > 0) {
                // 祝福: 25% (切り上げ)
                return baseWeight + Math.ceil(rawWeight / 4);
            } else if (record.bcursed < 0) {
                // 呪い: 200%
                return baseWeight + (rawWeight * 2);
            } else {
                // 未呪い: 50% (切り上げ)
                return baseWeight + Math.ceil(rawWeight / 2);
            }
        }

        // 通常の袋・箱
        return baseWeight + rawWeight;
    }

    /**
     * コンテナの中身確定または更新
     * @param {string} letter - インベントリレター ('b' 等)
     * @param {Object} data
     * @param {Array<Object>} [data.items] - 中身アイテム
     * @param {boolean} [data.isKnown] - 確認済みか
     * @param {number} [data.bcursed] - BUC状態 (数値または文字列)
     * @param {string} [data.bucStatus] - BUCステータス ('BLESSED'等)
     * @param {string} [data.containerType] - コンテナ種別
     * @param {number} [data.onum] - onum
     * @param {string} [data.name] - コンテナ名
     */
    updateContainer(letter, data = {}) {
        if (!letter) return;
        const existing = this.containerCache.get(letter) || {};
        const name = data.name || existing.name || '';
        const onum = typeof data.onum === 'number' ? data.onum : (existing.onum !== undefined ? existing.onum : -1);
        const containerType = data.containerType || existing.containerType || detectContainerType(data, onum);
        const baseWeight = typeof data.baseWeight === 'number' ? data.baseWeight : (existing.baseWeight || getContainerBaseWeight(containerType, onum));
        const isKnown = data.isKnown !== undefined ? data.isKnown : (existing.isKnown !== undefined ? existing.isKnown : false);
        const bcursed = data.bcursed !== undefined
            ? resolveBucStatus(data.bcursed)
            : (data.bucStatus !== undefined
                ? resolveBucStatus(data.bucStatus)
                : (existing.bcursed !== undefined ? existing.bcursed : 0));

        const items = Array.isArray(data.items) ? data.items : (existing.items || []);

        // 中身の未補正合計重量を計算
        let contentsRawWeight = 0;
        items.forEach(it => {
            contentsRawWeight += this.getItemWeight(it);
        });

        const record = {
            letter,
            name,
            onum,
            containerType,
            baseWeight,
            isKnown,
            bcursed,
            items,
            contentsRawWeight,
            effectiveWeight: 0,
        };
        record.effectiveWeight = this.computeContainerWeight(record);

        this.containerCache.set(letter, record);
        this._lastCalculatedState = null;
        return record;
    }

    /**
     * コンテナをキャッシュから削除
     * @param {string} letter 
     */
    removeContainer(letter) {
        if (this.containerCache.has(letter)) {
            this.containerCache.delete(letter);
            this._lastCalculatedState = null;
        }
    }

    /**
     * インベントリのアイテム一覧とコンテナキャッシュを同期
     * (手持ちに新しく出現した袋を未確認として登録し、消失した袋をキャッシュから除外)
     * @param {Array<Object>} inventoryItems 
     */
    syncContainersFromInventory(inventoryItems) {
        if (!Array.isArray(inventoryItems)) return;

        const currentLetters = new Set();

        inventoryItems.forEach(item => {
            if (!item || !item.letter) return;
            const isCont = Boolean(
                item.isContainer ||
                item.isBag ||
                item.isBox ||
                (item.category === 'TOOL' && item.onum >= 214 && item.onum <= 220) ||
                item.knowledge?.isContainer
            );
            if (!isCont) return;

            currentLetters.add(item.letter);

            const cType = item.containerType || detectContainerType(item, item.onum);
            const baseWt = typeof item.baseWeight === 'number' ? item.baseWeight : getContainerBaseWeight(cType, item.onum);
            const buc = resolveBucStatus(item);

            if (!this.containerCache.has(item.letter)) {
                // 新規拾得袋: 未確認 (isKnown = false) として登録
                this.containerCache.set(item.letter, {
                    letter: item.letter,
                    name: item.name || item.rawText || '',
                    onum: item.onum !== undefined ? item.onum : -1,
                    containerType: cType,
                    baseWeight: baseWt,
                    isKnown: false,
                    bcursed: buc,
                    items: [],
                    contentsRawWeight: 0,
                    effectiveWeight: baseWt,
                });
            } else {
                // 既存袋: BUC や種別の変化を同期
                const rec = this.containerCache.get(item.letter);
                if (rec.bcursed !== buc) {
                    rec.bcursed = buc;
                    rec.effectiveWeight = this.computeContainerWeight(rec);
                }
            }
        });

        // 手持ちから消えた袋をキャッシュからクリーンアップ
        for (const letter of this.containerCache.keys()) {
            if (!currentLetters.has(letter)) {
                this.containerCache.delete(letter);
            }
        }
    }

    /**
     * 統合重量・負荷状態 (EncumbranceState) の取得・算出
     * @returns {Object}
     */
    getEncumbranceState() {
        const invItems = (this.inventoryStateManager && typeof this.inventoryStateManager.getItems === 'function')
            ? this.inventoryStateManager.getItems()
            : [];

        // コンテナキャッシュの整合性を同期
        this.syncContainersFromInventory(invItems);

        // 手持ち全アイテムの重量合算
        let totalWeight = 0;
        let hasGoldInInventory = false;

        let statusObj = null;
        if (this.statusAccessor && typeof this.statusAccessor.getStatus === 'function') {
            statusObj = this.statusAccessor.getStatus();
        }

        // 🎯 Wasm 直接バインディングによる公式真の重量 (_inv_weight()) の取得 (Stage 8.2)
        // Bag of Holding や金貨を含むコア完全同期値を最優先採用
        let directWeight = -1;
        if (this.wasmDirectBindingService && typeof this.wasmDirectBindingService.getInventoryWeight === 'function') {
            directWeight = this.wasmDirectBindingService.getInventoryWeight();
        }

        if (directWeight >= 0) {
            totalWeight = directWeight;
        } else {
            invItems.forEach(item => {
                if (!item) return;
                if (item.isGold || item.letter === '$') {
                    hasGoldInInventory = true;
                }

                // コンテナの場合はキャッシュの実効重量を採用
                if (item.letter && this.containerCache.has(item.letter)) {
                    const rec = this.containerCache.get(item.letter);
                    totalWeight += rec.effectiveWeight;
                } else {
                    totalWeight += this.getItemWeight(item);
                }
            });

            // 手持ちインベントリ一覧に金貨アイテムがなく、StatusAccessor に所持金がある場合の合算
            if (!hasGoldInInventory && statusObj && statusObj.gold && typeof statusObj.gold.amount === 'number' && statusObj.gold.amount > 0) {
                totalWeight += Math.floor(statusObj.gold.amount / 100);
            }
        }

        // 許容量の算出
        let strVal = 10;
        let conVal = 10;
        let blCapVal = 0;

        if (statusObj) {
            if (statusObj.stats) {
                if (statusObj.stats.str !== undefined) strVal = statusObj.stats.str;
                if (statusObj.stats.con !== undefined) conVal = statusObj.stats.con;
            }
            if (typeof statusObj.cap === 'number') {
                blCapVal = statusObj.cap;
            }
        }

        const capacity = calculateCarryingCapacity(strVal, conVal);
        const rawRatio = capacity > 0 ? (totalWeight / capacity) : 0;
        const calculatedPercentage = Math.round(rawRatio * 100);

        // 計算上のレベル (パーセンテージ目安)
        let calculatedLevel = EncumbranceLevel.NORMAL;
        if (calculatedPercentage >= 134) {
            calculatedLevel = EncumbranceLevel.CRITICAL;
        } else if (calculatedPercentage >= 100) {
            calculatedLevel = EncumbranceLevel.DANGER;
        } else if (calculatedPercentage >= 70) {
            calculatedLevel = EncumbranceLevel.CAUTION;
        }

        // BL_CAP による公式確定レベル
        const blCapLevel = BL_CAP_TO_LEVEL[blCapVal] || EncumbranceLevel.NORMAL;

        // 🎯 BL_CAP 公式確定レベルに基づく最終レベル決定 (SSOT原則)
        // Cコアから公式確定ステータス (BL_CAP > 0) が通知されている場合は公式レベル (blCapLevel) を絶対優先
        let finalLevel = calculatedLevel;
        if (blCapVal > 0) {
            finalLevel = blCapLevel;
        } else {
            // Cコアが Unencumbered (0) の場合、アイテムを拾った直後のリアルタイム反映として危険度の高い方を採用
            const calcPriority = ENCUMBRANCE_PRIORITY[calculatedLevel];
            const blPriority = ENCUMBRANCE_PRIORITY[blCapLevel];
            finalLevel = calcPriority > blPriority ? calculatedLevel : blCapLevel;
        }

        // 🎯 最終レベルとゲージパーセンテージ・比率の整合補正
        let effectivePercentage = calculatedPercentage;
        let effectiveRawRatio = rawRatio;

        if (finalLevel === EncumbranceLevel.CAUTION) {
            // 負荷 (Burdened): ゲージは 70%〜99% の範囲 (黄色) を保証し、誤って過負荷(赤)に見えるのを防ぐ
            effectivePercentage = Math.min(99, Math.max(70, calculatedPercentage));
            effectiveRawRatio = effectivePercentage / 100;
        } else if (finalLevel === EncumbranceLevel.DANGER) {
            // 重荷 (Stressed/Strained): ゲージは 100%〜133% の範囲 (橙色) を保証
            effectivePercentage = Math.min(133, Math.max(100, calculatedPercentage));
            effectiveRawRatio = effectivePercentage / 100;
        } else if (finalLevel === EncumbranceLevel.CRITICAL) {
            // 過負荷 (Overtaxed/Overloaded): ゲージは 134% 以上 (赤色・満タン)
            effectivePercentage = Math.max(134, calculatedPercentage);
            effectiveRawRatio = Math.max(1.0, effectivePercentage / 100);
        }
        const effectiveRatio = Math.min(1.0, Math.max(0, effectiveRawRatio));

        // 未確認袋の存在チェック
        let hasUninspectedContainer = false;
        for (const rec of this.containerCache.values()) {
            if (!rec.isKnown) {
                hasUninspectedContainer = true;
                break;
            }
        }

        const containers = Array.from(this.containerCache.values());

        const state = {
            totalWeight,
            capacity,
            ratio: effectiveRatio,
            rawRatio: effectiveRawRatio,
            percentage: effectivePercentage,
            calculatedPercentage,
            calculatedLevel,
            blCap: blCapVal,
            blCapLevel,
            level: finalLevel,
            hasUninspectedContainer,
            containers,
        };

        this._lastCalculatedState = state;
        return state;
    }
}
