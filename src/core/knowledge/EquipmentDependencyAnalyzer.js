/**
 * EquipmentDependencyAnalyzer.js
 * 
 * プレイヤーの装備換装における依存関係（ブロッカー・着直しスタック・所要ターン・呪いリスク）を
 * 解析・診断するドメインアナライザー。
 */

import {
    EQUIP_SLOTS,
    ARMOR_LAYERS,
    ACCESSORY_RULES,
    estimateActionTurns,
    resolveEligibleSlots,
    isTwoHandedWeapon,
    isCockatriceCorpse
} from './EquipmentRules.js';

export class EquipmentDependencyAnalyzer {

    /**
     * インベントリ情報から各スロットに現在装備されているアイテムの正規化マップを抽出
     * @param {Array<Object>|Object} inventory - items 配列または InventoryStateManager
     * @returns {Object<string, Object>} { [slotId]: item }
     */
    static extractEquippedState(inventory) {
        const items = Array.isArray(inventory)
            ? inventory
            : (inventory && Array.isArray(inventory.items) ? inventory.items : (inventory?.getItems ? inventory.getItems() : []));

        const equipped = {};

        for (const item of items) {
            if (!item) continue;
            const raw = (item.rawText || item.name || '').toLowerCase();
            const slot = this._detectEquippedSlot(item, raw);
            if (slot) {
                // 呪いステータスの明示的フラグ付与
                const isCursed = Boolean(
                    item.isCursed ||
                    item.identification?.bucStatus === 'CURSED' ||
                    item.knowledge?.bucStatus === 'CURSED' ||
                    /\bcursed\b|呪われ/.test(raw)
                );

                equipped[slot] = {
                    ...item,
                    isCursed,
                    equippedSlot: slot
                };
            }
        }

        return equipped;
    }

    /**
     * 単一アイテムがどのスロットに装備されているかを検出
     * @private
     */
    static _detectEquippedSlot(item, raw) {
        // 1. item.equipSlot の直接指定
        if (item.equipSlot) {
            switch (item.equipSlot) {
                case 'weapon': return EQUIP_SLOTS.MAIN_HAND;
                case 'offhand': return EQUIP_SLOTS.OFF_HAND;
                case 'shield': return EQUIP_SLOTS.SHIELD;
                case 'quiver': return EQUIP_SLOTS.QUIVER;
                case 'ring_left': return EQUIP_SLOTS.LEFT_RING;
                case 'ring_right': return EQUIP_SLOTS.RIGHT_RING;
                case 'amulet': return EQUIP_SLOTS.AMULET;
                case 'blindfold': return EQUIP_SLOTS.BLINDFOLD;
                case 'helm': return EQUIP_SLOTS.HELM;
                case 'cloak': return EQUIP_SLOTS.CLOAK;
                case 'suit': return EQUIP_SLOTS.SUIT;
                case 'shirt': return EQUIP_SLOTS.SHIRT;
                case 'gloves': return EQUIP_SLOTS.GLOVES;
                case 'boots': return EQUIP_SLOTS.BOOTS;
            }
        }

        // 2. フラグおよびテキスト表現による検出
        if (item.isWielded || /(?:\bweapon in (?:hands?|right hand|left hand)\b|\bwielded\b|[左右両]?手に装備中|[左右両]?手に持っている)/i.test(raw)) {
            return EQUIP_SLOTS.MAIN_HAND;
        }
        if (item.isOffhand || /\b(in off hand|in off-hand|off-hand weapon|alternate weapon)\b|副武器|逆の手に持っている/i.test(raw)) {
            return EQUIP_SLOTS.OFF_HAND;
        }
        if (item.isQuivered || /\b(in quiver|quivered|at the ready)\b|矢筒|準備完了/i.test(raw)) {
            return EQUIP_SLOTS.QUIVER;
        }

        if (item.isWorn || /\b(being worn|on left hand|on right hand|around neck|on head|on feet|on hands|embedded in shield)\b|着用|装備中|装着中/i.test(raw)) {
            if (/on left hand|on left finger|\(左手\)|\(左手に装着\)|左手/i.test(raw)) return EQUIP_SLOTS.LEFT_RING;
            if (/on right hand|on right finger|\(右手\)|\(右手に装着\)|右手/i.test(raw)) return EQUIP_SLOTS.RIGHT_RING;
            if (/around neck|首/i.test(raw)) return EQUIP_SLOTS.AMULET;
            if (/shield|盾/i.test(raw) || item.armorSlot === 'shield' || item.knowledge?.armorSlot === 'shield') return EQUIP_SLOTS.SHIELD;
            if (/cloak|mantle|cape|robe|外套|マント|ローブ/i.test(raw) || item.armorSlot === 'cloak' || item.knowledge?.armorSlot === 'cloak') return EQUIP_SLOTS.CLOAK;
            if (/suit|mail|armor|jacket|鎧|甲冑|胴着/i.test(raw) || item.armorSlot === 'suit' || item.knowledge?.armorSlot === 'suit') return EQUIP_SLOTS.SUIT;
            if (/shirt|シャツ/i.test(raw) || item.armorSlot === 'shirt' || item.knowledge?.armorSlot === 'shirt') return EQUIP_SLOTS.SHIRT;
            if (/helmet|helm|hat|cap|兜|帽子/i.test(raw) || item.armorSlot === 'helm' || item.knowledge?.armorSlot === 'helm') return EQUIP_SLOTS.HELM;
            if (/gloves|gauntlets|手袋|籠手/i.test(raw) || item.armorSlot === 'gloves' || item.knowledge?.armorSlot === 'gloves') return EQUIP_SLOTS.GLOVES;
            if (/boots|shoes|靴|ブーツ/i.test(raw) || item.armorSlot === 'boots' || item.knowledge?.armorSlot === 'boots') return EQUIP_SLOTS.BOOTS;
            if (/blindfold|towel|目隠し|タオル/i.test(raw)) return EQUIP_SLOTS.BLINDFOLD;
        }

        return null;
    }

    /**
     * 対象アイテムの装備依存関係を解析し、診断レポートを生成
     * @param {Array<Object>|Object} inventory - インベントリ情報
     * @param {Object} targetItem - 装備しようとするアイテム
     * @param {string} [requestedSlot=null] - 指定スロット（省略時は自動選択）
     * @returns {Object} EquipmentDependencyReport
     */
    static analyzeDependency(inventory, targetItem, requestedSlot = null) {
        if (!targetItem) {
            return null;
        }

        const raw = (targetItem.rawText || targetItem.name || '').toLowerCase();
        const eligibleSlots = resolveEligibleSlots(targetItem);
        const equippedState = this.extractEquippedState(inventory);

        // スロットの決定
        let targetSlot = requestedSlot;
        if (!targetSlot || !eligibleSlots.includes(targetSlot)) {
            if (eligibleSlots.includes(EQUIP_SLOTS.LEFT_RING) || eligibleSlots.includes(EQUIP_SLOTS.RIGHT_RING)) {
                // 指輪の場合：空いている指スロットを優先
                if (!equippedState[EQUIP_SLOTS.LEFT_RING]) {
                    targetSlot = EQUIP_SLOTS.LEFT_RING;
                } else if (!equippedState[EQUIP_SLOTS.RIGHT_RING]) {
                    targetSlot = EQUIP_SLOTS.RIGHT_RING;
                } else {
                    targetSlot = EQUIP_SLOTS.LEFT_RING; // 両方埋まっていれば左手をデフォルト交換対象
                }
            } else {
                targetSlot = eligibleSlots[0] || EQUIP_SLOTS.MAIN_HAND;
            }
        }

        // ブロッカー探索
        const { blockers, swapItem } = this._findBlockers(equippedState, targetSlot, targetItem);

        // 着直しスタック構築（一時的に脱いだアイテムをLIFO順で）
        const itemsToRewear = this._buildRewearStack(blockers, swapItem, targetItem, targetSlot);

        // リスク・セーフティ・所要ターン診断
        const riskReport = this._evaluateRisks(targetItem, targetSlot, equippedState, blockers, itemsToRewear);

        return {
            targetItem: {
                letter: targetItem.letter || '',
                name: targetItem.name || targetItem.rawText || '',
                rawText: targetItem.rawText || targetItem.name || '',
                targetSlot
            },
            canExecute: riskReport.canExecute,
            blockers,
            itemsToRewear,
            risks: riskReport.risks
        };
    }

    /**
     * ブロッカー（脱ぐ必要があるアイテム）の収集
     * @private
     */
    static _findBlockers(equippedState, targetSlot, targetItem) {
        const blockers = [];
        let swapItem = null;

        // 1. レイヤードアーマーのブロッカー（外側から順に脱ぐ）
        if (targetSlot === EQUIP_SLOTS.SHIRT) {
            if (equippedState[EQUIP_SLOTS.CLOAK]) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.CLOAK], EQUIP_SLOTS.CLOAK, 'take_off'));
            }
            if (equippedState[EQUIP_SLOTS.SUIT]) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.SUIT], EQUIP_SLOTS.SUIT, 'take_off'));
            }
        } else if (targetSlot === EQUIP_SLOTS.SUIT) {
            if (equippedState[EQUIP_SLOTS.CLOAK]) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.CLOAK], EQUIP_SLOTS.CLOAK, 'take_off'));
            }
        }

        // 2. 手袋ブロッカー（指輪の着脱時）
        if (targetSlot === EQUIP_SLOTS.LEFT_RING || targetSlot === EQUIP_SLOTS.RIGHT_RING) {
            if (equippedState[EQUIP_SLOTS.GLOVES]) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.GLOVES], EQUIP_SLOTS.GLOVES, 'take_off'));
            }
        }

        // 3. 武器・盾の排他ブロッカー
        if (targetSlot === EQUIP_SLOTS.SHIELD) {
            // 盾を装備しようとするとき、主手に両手武器があれば両手武器を外す必要がある
            if (equippedState[EQUIP_SLOTS.MAIN_HAND] && isTwoHandedWeapon(equippedState[EQUIP_SLOTS.MAIN_HAND])) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.MAIN_HAND], EQUIP_SLOTS.MAIN_HAND, 'unwield'));
            }
        } else if (targetSlot === EQUIP_SLOTS.MAIN_HAND && isTwoHandedWeapon(targetItem)) {
            // 両手武器を装備しようとするとき、盾または副手武器があれば外す必要がある
            if (equippedState[EQUIP_SLOTS.SHIELD]) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.SHIELD], EQUIP_SLOTS.SHIELD, 'take_off'));
            }
            if (equippedState[EQUIP_SLOTS.OFF_HAND]) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.OFF_HAND], EQUIP_SLOTS.OFF_HAND, 'unwield'));
            }
        }

        // 4. スロット交換（Swap）による既存装備の脱衣
        const currentInSlot = equippedState[targetSlot];
        if (currentInSlot && currentInSlot.letter !== targetItem.letter) {
            swapItem = currentInSlot;
            const action = (targetSlot === EQUIP_SLOTS.LEFT_RING || targetSlot === EQUIP_SLOTS.RIGHT_RING || targetSlot === EQUIP_SLOTS.AMULET || targetSlot === EQUIP_SLOTS.BLINDFOLD)
                ? 'remove'
                : (targetSlot === EQUIP_SLOTS.MAIN_HAND || targetSlot === EQUIP_SLOTS.OFF_HAND)
                    ? 'unwield'
                    : 'take_off';
            blockers.push(this._createBlockerEntry(currentInSlot, targetSlot, action));
        }

        return { blockers, swapItem };
    }

    /**
     * ブロッカーエントリを生成
     * @private
     */
    static _createBlockerEntry(item, slot, actionNeeded) {
        return {
            slot,
            letter: item.letter || '',
            name: item.name || item.rawText || '',
            rawText: item.rawText || item.name || '',
            actionNeeded,
            isCursed: Boolean(item.isCursed),
            estimatedTurns: estimateActionTurns(actionNeeded, item)
        };
    }

    /**
     * 着直しスタック（LIFO逆順）の構築
     * @private
     */
    static _buildRewearStack(blockers, swapItem, targetItem, targetSlot) {
        const itemsToRewear = [];

        // ブロッカーのうち、交換対象（swapItem）以外の「一時的に脱いだアイテム」を抽出
        // また、排他関係（両手武器と盾など）によって外されたアイテムは着直さない
        const isTwoHanded = targetItem && isTwoHandedWeapon(targetItem);
        const isEquippingShield = targetSlot === EQUIP_SLOTS.SHIELD;

        const tempRemoved = blockers.filter(b => {
            if (swapItem && b.letter === swapItem.letter) return false;
            // 盾を装備する場合、主手の両手武器は着直さない
            if (isEquippingShield && b.slot === EQUIP_SLOTS.MAIN_HAND) return false;
            // 両手武器を装備する場合、盾や副手武器は着直さない
            if (isTwoHanded && (b.slot === EQUIP_SLOTS.SHIELD || b.slot === EQUIP_SLOTS.OFF_HAND)) return false;
            return true;
        });

        // 脱いだ順と逆順（LIFO）でスタック
        for (let i = tempRemoved.length - 1; i >= 0; i--) {
            const b = tempRemoved[i];
            const actionNeeded = (b.slot === EQUIP_SLOTS.LEFT_RING || b.slot === EQUIP_SLOTS.RIGHT_RING || b.slot === EQUIP_SLOTS.AMULET || b.slot === EQUIP_SLOTS.BLINDFOLD)
                ? 'put_on'
                : (b.slot === EQUIP_SLOTS.MAIN_HAND || b.slot === EQUIP_SLOTS.OFF_HAND)
                    ? 'wield'
                    : 'wear';

            itemsToRewear.push({
                slot: b.slot,
                letter: b.letter,
                name: b.name,
                rawText: b.rawText,
                actionNeeded,
                estimatedTurns: estimateActionTurns(actionNeeded, b)
            });
        }

        return itemsToRewear;
    }

    /**
     * リスク・セーフティ・所要ターンの診断評価
     * @private
     */
    static _evaluateRisks(targetItem, targetSlot, equippedState, blockers, itemsToRewear) {
        const warnings = [];
        let canExecute = true;
        let blockingReason = null;

        // 1. 呪われたブロッカーの有無判定
        const cursedBlocker = blockers.find(b => b.isCursed);
        if (cursedBlocker) {
            canExecute = false;
            blockingReason = `${cursedBlocker.name} が呪われていて脱げないため、${targetItem.name || targetItem.rawText} を装備できません。`;
            warnings.push(blockingReason);
        }

        // 2. コカトリスの死体（Rubber chicken）セーフティ
        if (isCockatriceCorpse(targetItem)) {
            // 手袋を着用しているか
            const hasGloves = Boolean(equippedState[EQUIP_SLOTS.GLOVES]);
            // かつ、手袋がブロッカーに含まれて脱がされる予定でないか
            const isGlovesBlocked = blockers.some(b => b.slot === EQUIP_SLOTS.GLOVES);

            if (!hasGloves || isGlovesBlocked) {
                canExecute = false;
                blockingReason = '素手でコカトリスの死体に触れると石化即死します！手袋を着用してください。';
                warnings.push(blockingReason);
            }
        }

        // 3. 対象アイテム自身の BUC / 呪い判定
        const raw = (targetItem.rawText || targetItem.name || '').toLowerCase();
        let targetBucStatus = 'unknown';
        if (targetItem.isCursed || targetItem.identification?.bucStatus === 'CURSED' || /\bcursed\b|呪われ/.test(raw)) {
            targetBucStatus = 'cursed';
            warnings.push('このアイテムは呪われています。一度装備すると解呪するまで自力で外せなくなります。');
        } else if (targetItem.isBlessed || targetItem.identification?.bucStatus === 'BLESSED' || /\bblessed\b|祝福/.test(raw)) {
            targetBucStatus = 'blessed';
        } else if (targetItem.isUncursed || targetItem.identification?.bucStatus === 'UNCURSED' || /\buncursed\b/.test(raw)) {
            targetBucStatus = 'uncursed';
        } else {
            targetBucStatus = 'unknown';
            warnings.push('呪われている可能性があります（BUC未確定）。');
        }

        // 4. 所要ターン数の計算
        const blockerTurns = blockers.reduce((sum, b) => sum + (b.estimatedTurns || 1), 0);
        const equipAction = (targetSlot === EQUIP_SLOTS.LEFT_RING || targetSlot === EQUIP_SLOTS.RIGHT_RING || targetSlot === EQUIP_SLOTS.AMULET || targetSlot === EQUIP_SLOTS.BLINDFOLD)
            ? 'put_on'
            : (targetSlot === EQUIP_SLOTS.MAIN_HAND || targetSlot === EQUIP_SLOTS.OFF_HAND)
                ? 'wield'
                : 'wear';
        const targetTurns = estimateActionTurns(equipAction, targetItem);
        const rewearTurns = itemsToRewear.reduce((sum, r) => sum + (r.estimatedTurns || 1), 0);
        const totalEstimatedTurns = blockerTurns + targetTurns + rewearTurns;

        const isMultiTurn = totalEstimatedTurns > 1;
        if (isMultiTurn && canExecute) {
            warnings.push(`換装に合計約 ${totalEstimatedTurns} ターンを消費します。敵の接近に注意してください。`);
        }

        return {
            canExecute,
            risks: {
                totalEstimatedTurns,
                isMultiTurn,
                hasCursedBlocker: Boolean(cursedBlocker),
                targetBucStatus,
                warnings,
                blockingReason
            }
        };
    }
}
