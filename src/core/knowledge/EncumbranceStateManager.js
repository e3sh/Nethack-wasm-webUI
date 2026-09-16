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

import { OBJECT_KNOWLEDGE_MAP } from './OBJECT_KNOWLEDGE_FULL.js';

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
 * テキストからアイテム数量を抽出
 * @param {string} text 
 * @returns {number}
 */
export function parseItemCount(text) {
    if (!text || typeof text !== 'string') return 1;
    const trimmed = text.trim();
    const numMatch = trimmed.match(/^(\d+)\s+/);
    if (numMatch) {
        return parseInt(numMatch[1], 10) || 1;
    }
    const jaMatch = trimmed.match(/^(\d+)(?:個|本|枚|つ|杯|巻|着|缶|服|袋)?の?\s*/);
    if (jaMatch) {
        return parseInt(jaMatch[1], 10) || 1;
    }
    return 1;
}

/**
 * アイテム名や rawText から BUC 状態を判定
 * @param {string} text 
 * @returns {number} 1: 祝福, 0: 未呪い, -1: 呪い
 */
export function detectBucStatus(text) {
    if (!text || typeof text !== 'string') return 0;
    const lower = text.toLowerCase();
    if (lower.includes('blessed') || text.includes('祝福')) return 1;
    if (lower.includes('cursed') || text.includes('呪われ')) {
        if (lower.includes('uncursed') || text.includes('呪われていない')) return 0;
        return -1;
    }
    return 0;
}

/**
 * コンテナ種別を判定
 * @param {string} name 
 * @param {number} [onum=-1] 
 * @returns {string}
 */
export function detectContainerType(name, onum = -1) {
    if (onum >= 0) {
        const info = OBJECT_KNOWLEDGE_MAP.get(onum);
        if (info) {
            if (info.name === 'bag of holding') return 'BAG_OF_HOLDING';
            if (info.name === 'sack') return 'SACK';
            if (info.name === 'oilskin sack') return 'OILSKIN_SACK';
            if (info.name === 'chest') return 'CHEST';
            if (info.name === 'large box') return 'LARGE_BOX';
            if (info.name === 'ice box') return 'ICE_BOX';
        }
    }
    if (!name || typeof name !== 'string') return 'UNKNOWN';
    const lower = name.toLowerCase();
    if (/bag of holding/i.test(lower) || /軽量化の鞄/.test(name)) return 'BAG_OF_HOLDING';
    if (/oilskin sack/i.test(lower) || /油引きの袋/.test(name)) return 'OILSKIN_SACK';
    if (/\bsack\b/i.test(lower) || /\b袋\b/.test(name)) return 'SACK';
    if (/\bchest\b/i.test(lower) || /チェスト/.test(name)) return 'CHEST';
    if (/large box/i.test(lower) || /大箱/.test(name)) return 'LARGE_BOX';
    if (/ice box/i.test(lower) || /氷箱/.test(name)) return 'ICE_BOX';
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
     */
    constructor(options = {}) {
        this.statusAccessor = options.statusAccessor || null;
        this.inventoryStateManager = options.inventoryStateManager || null;
        this.containerContentsManager = options.containerContentsManager || null;

        /** @type {Map<string, Object>} letter -> ContainerWeightRecord */
        this.containerCache = new Map();

        this._lastCalculatedState = null;
        this._ccmHandler = null;

        if (this.containerContentsManager) {
            this.setContainerContentsManager(this.containerContentsManager);
        }
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

        // 金貨判定 (100枚ごとに重量 1)
        const isGold = item.isGold || item.letter === '$' || /(?:gold\s+pieces?|pieces?\s+of\s+gold|枚の金貨|^金貨$)/i.test(item.rawText || item.name || '');
        if (isGold) {
            const count = typeof item.count === 'number' && item.count >= 0 ? item.count : parseItemCount(item.rawText || item.name || '');
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

        // 特殊アイテム (彫像、巨岩、死体) のフォールバック重量判定
        if (unitWeight === 0) {
            const text = (item.rawText || item.name || '').toLowerCase();
            const cat = String(item.category || '').toUpperCase();
            if (item.isStatue || cat === 'STATUE' || text.includes('statue') || text.includes('彫像') || text.includes('石像') || /像(?:\s|$)/.test(text)) {
                // NetHack の像基本重量: 2500 (モンスター体重依存だが平均して極めて重い)
                unitWeight = 2500;
            } else if (text.includes('boulder') || text.includes('巨岩')) {
                // NetHack の巨岩基本重量: 6000
                unitWeight = 6000;
            } else if (item.isCorpse || text.includes('corpse') || text.includes('死体')) {
                // モンスター死体の平均重量: 200
                unitWeight = 200;
            }
        }

        // 数量の取得
        const count = typeof item.count === 'number' && item.count > 0 ? item.count : parseItemCount(item.rawText || item.name || '');

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
     * @param {number} [data.bcursed] - BUC状態
     * @param {string} [data.containerType] - コンテナ種別
     * @param {number} [data.onum] - onum
     * @param {string} [data.name] - コンテナ名
     */
    updateContainer(letter, data = {}) {
        if (!letter) return;
        const existing = this.containerCache.get(letter) || {};
        const name = data.name || existing.name || '';
        const onum = typeof data.onum === 'number' ? data.onum : (existing.onum !== undefined ? existing.onum : -1);
        const containerType = data.containerType || existing.containerType || detectContainerType(name, onum);
        const baseWeight = typeof data.baseWeight === 'number' ? data.baseWeight : (existing.baseWeight || getContainerBaseWeight(containerType, onum));
        const isKnown = data.isKnown !== undefined ? data.isKnown : (existing.isKnown !== undefined ? existing.isKnown : false);
        const bcursed = data.bcursed !== undefined ? data.bcursed : (existing.bcursed !== undefined ? existing.bcursed : detectBucStatus(name));

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
            const isCont = item.isContainer || item.isBag || item.isBox || (item.knowledge && item.knowledge.isContainer);
            if (!isCont) return;

            currentLetters.add(item.letter);

            if (!this.containerCache.has(item.letter)) {
                // 新規拾得袋: 未確認 (isKnown = false) として登録
                const cType = detectContainerType(item.rawText || item.name || '', item.onum);
                const baseWt = getContainerBaseWeight(cType, item.onum);
                const buc = detectBucStatus(item.rawText || item.name || '');

                this.containerCache.set(item.letter, {
                    letter: item.letter,
                    name: item.rawText || item.name || '',
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
                // 既存袋: BUC や名前の変化を更新
                const rec = this.containerCache.get(item.letter);
                const buc = detectBucStatus(item.rawText || item.name || '');
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
        let statusObj = null;
        if (this.statusAccessor && typeof this.statusAccessor.getStatus === 'function') {
            statusObj = this.statusAccessor.getStatus();
        }
        if (!hasGoldInInventory && statusObj && statusObj.gold && typeof statusObj.gold.amount === 'number' && statusObj.gold.amount > 0) {
            totalWeight += Math.floor(statusObj.gold.amount / 100);
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

        // ハイブリッド連動: 危険度の高い方を最終レベルとして採用
        const calcPriority = ENCUMBRANCE_PRIORITY[calculatedLevel];
        const blPriority = ENCUMBRANCE_PRIORITY[blCapLevel];
        const finalLevel = blPriority >= calcPriority ? blCapLevel : calculatedLevel;

        // 🎯 BL_CAP 公式確定レベルに基づくパーセンテージ・比率の下限保証 (同期補正)
        // Cコアが Overloaded 等と判定している場合、アイテム推定漏れがあってもバー表示と比率を整合させる
        let effectivePercentage = calculatedPercentage;
        let effectiveRawRatio = rawRatio;
        if (blCapVal > 0 && MIN_PERCENTAGE_BY_BL_CAP[blCapVal] !== undefined) {
            const minPct = MIN_PERCENTAGE_BY_BL_CAP[blCapVal];
            if (effectivePercentage < minPct) {
                effectivePercentage = minPct;
                effectiveRawRatio = Math.max(rawRatio, minPct / 100);
            }
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
