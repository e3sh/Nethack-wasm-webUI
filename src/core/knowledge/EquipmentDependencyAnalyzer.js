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
        const warningsJa = [];
        const warningsEn = [];
        let canExecute = true;
        let blockingReasonJa = null;
        let blockingReasonEn = null;

        // 1. 呪われたブロッカーの有無判定
        const cursedBlocker = blockers.find(b => b.isCursed);
        if (cursedBlocker) {
            canExecute = false;
            blockingReasonJa = `${cursedBlocker.name} が呪われていて脱げないため、${targetItem.name || targetItem.rawText} を装備できません。`;
            blockingReasonEn = `Cannot equip ${targetItem.name || targetItem.rawText} because ${cursedBlocker.name} is cursed and cannot be removed.`;
            warningsJa.push(blockingReasonJa);
            warningsEn.push(blockingReasonEn);
        }

        // 2. コカトリスの死体（Rubber chicken）セーフティ
        if (isCockatriceCorpse(targetItem)) {
            // 手袋を着用しているか
            const hasGloves = Boolean(equippedState[EQUIP_SLOTS.GLOVES]);
            // かつ、手袋がブロッカーに含まれて脱がされる予定でないか
            const isGlovesBlocked = blockers.some(b => b.slot === EQUIP_SLOTS.GLOVES);

            if (!hasGloves || isGlovesBlocked) {
                canExecute = false;
                blockingReasonJa = '素手でコカトリスの死体に触れると石化即死します！手袋を着用してください。';
                blockingReasonEn = 'Touching a cockatrice corpse with bare hands causes fatal petrification! Wear gloves first.';
                warningsJa.push(blockingReasonJa);
                warningsEn.push(blockingReasonEn);
            }
        }

        // 3. 対象アイテム自身の BUC / 呪い判定
        const raw = (targetItem.rawText || targetItem.name || '').toLowerCase();
        let targetBucStatus = 'unknown';
        if (targetItem.isCursed || targetItem.identification?.bucStatus === 'CURSED' || /\bcursed\b|呪われ/.test(raw)) {
            targetBucStatus = 'cursed';
            warningsJa.push('このアイテムは呪われています。一度装備すると解呪するまで自力で外せなくなります。');
            warningsEn.push('This item is cursed. Once equipped, it cannot be removed without uncursing.');
        } else if (targetItem.isBlessed || targetItem.identification?.bucStatus === 'BLESSED' || /\bblessed\b|祝福/.test(raw)) {
            targetBucStatus = 'blessed';
        } else if (targetItem.isUncursed || targetItem.identification?.bucStatus === 'UNCURSED' || /\buncursed\b/.test(raw)) {
            targetBucStatus = 'uncursed';
        } else {
            targetBucStatus = 'unknown';
            warningsJa.push('呪われている可能性があります（BUC未確定）。');
            warningsEn.push('Item may be cursed (BUC status unconfirmed).');
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
            warningsJa.push(`換装に合計約 ${totalEstimatedTurns} ターンを消費します。敵の接近に注意してください。`);
            warningsEn.push(`Equipping will take ~${totalEstimatedTurns} turns. Beware of nearby monsters.`);
        }

        return {
            canExecute,
            risks: {
                totalEstimatedTurns,
                isMultiTurn,
                hasCursedBlocker: Boolean(cursedBlocker),
                targetBucStatus,
                warnings: warningsJa,
                warningsJa,
                warningsEn,
                blockingReason: blockingReasonJa,
                blockingReasonJa,
                blockingReasonEn
            }
        };
    }


    /**
     * 装備中のアイテムを脱ぐ（Take off / Remove / Unwield）際の依存関係を解析
     * @param {Array<Object>|Object} inventory - インベントリ情報
     * @param {string|Object} targetSlotOrItem - スロットIDまたはアイテム
     * @returns {Object} EquipmentDependencyReport
     */
    static analyzeTakeOff(inventory, targetSlotOrItem) {
        if (!targetSlotOrItem) return null;

        const equippedState = this.extractEquippedState(inventory);
        let targetSlot = typeof targetSlotOrItem === 'string' ? targetSlotOrItem : null;
        let targetItem = null;

        if (targetSlot) {
            targetItem = equippedState[targetSlot] || null;
        } else {
            const raw = (targetSlotOrItem.rawText || targetSlotOrItem.name || '').toLowerCase();
            targetSlot = this._detectEquippedSlot(targetSlotOrItem, raw);
            targetItem = targetSlot ? equippedState[targetSlot] : null;
        }

        if (!targetItem || !targetSlot) {
            return {
                targetItem: {
                    letter: targetSlotOrItem.letter || '',
                    name: targetSlotOrItem.name || targetSlotOrItem.rawText || '',
                    rawText: targetSlotOrItem.rawText || targetSlotOrItem.name || '',
                    targetSlot: targetSlot || 'unknown',
                    isTakeOff: true
                },
                actionNeeded: 'take_off',
                canExecute: false,
                blockers: [],
                itemsToRewear: [],
                risks: {
                    totalEstimatedTurns: 0,
                    isMultiTurn: false,
                    hasCursedBlocker: false,
                    targetBucStatus: 'unknown',
                    warnings: ['装備されていません。'],
                    warningsJa: ['装備されていません。'],
                    warningsEn: ['Not currently equipped.'],
                    blockingReason: 'このアイテムは現在装備されていません。',
                    blockingReasonJa: 'このアイテムは現在装備されていません。',
                    blockingReasonEn: 'This item is not currently equipped.'
                }
            };
        }

        // 脱衣アクションの判定
        const actionNeeded = (targetSlot === EQUIP_SLOTS.LEFT_RING || targetSlot === EQUIP_SLOTS.RIGHT_RING || targetSlot === EQUIP_SLOTS.AMULET || targetSlot === EQUIP_SLOTS.BLINDFOLD)
            ? 'remove'
            : (targetSlot === EQUIP_SLOTS.MAIN_HAND || targetSlot === EQUIP_SLOTS.OFF_HAND)
                ? 'unwield'
                : 'take_off';

        // 呪い判定（対象自身が呪われている場合、脱げない）
        const isCursed = Boolean(targetItem.isCursed);
        const warningsJa = [];
        const warningsEn = [];
        let canExecute = !isCursed;
        let blockingReasonJa = isCursed ? `${targetItem.name || targetItem.rawText} は呪われているため自力で脱ぐことができません！` : null;
        let blockingReasonEn = isCursed ? `${targetItem.name || targetItem.rawText} is cursed and cannot be removed!` : null;
        if (isCursed) {
            warningsJa.push(blockingReasonJa);
            warningsEn.push(blockingReasonEn);
        }

        // ブロッカー探索（脱ぐために先に脱ぐべき外側の装備）
        const blockers = [];

        // 1. レイヤードアーマー
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

        // 2. 手袋（指輪を外す場合）
        if (targetSlot === EQUIP_SLOTS.LEFT_RING || targetSlot === EQUIP_SLOTS.RIGHT_RING) {
            if (equippedState[EQUIP_SLOTS.GLOVES]) {
                blockers.push(this._createBlockerEntry(equippedState[EQUIP_SLOTS.GLOVES], EQUIP_SLOTS.GLOVES, 'take_off'));
            }
        }

        // ブロッカーの呪い判定
        const cursedBlocker = blockers.find(b => b.isCursed);
        if (cursedBlocker) {
            canExecute = false;
            blockingReasonJa = `${cursedBlocker.name} が呪われていて脱げないため、${targetItem.name || targetItem.rawText} を脱ぐことができません。`;
            blockingReasonEn = `Cannot remove ${targetItem.name || targetItem.rawText} because ${cursedBlocker.name} is cursed and cannot be removed.`;
            warningsJa.push(blockingReasonJa);
            warningsEn.push(blockingReasonEn);
        }

        // 着直しスタック構築（一時的に脱いだブロッカーを LIFO 逆順で着直す）
        const itemsToRewear = [];
        for (let i = blockers.length - 1; i >= 0; i--) {
            const b = blockers[i];
            const rewearAction = (b.slot === EQUIP_SLOTS.LEFT_RING || b.slot === EQUIP_SLOTS.RIGHT_RING || b.slot === EQUIP_SLOTS.AMULET || b.slot === EQUIP_SLOTS.BLINDFOLD)
                ? 'put_on'
                : (b.slot === EQUIP_SLOTS.MAIN_HAND || b.slot === EQUIP_SLOTS.OFF_HAND)
                    ? 'wield'
                    : 'wear';
            itemsToRewear.push({
                slot: b.slot,
                letter: b.letter,
                name: b.name,
                rawText: b.rawText,
                actionNeeded: rewearAction,
                estimatedTurns: estimateActionTurns(rewearAction, b)
            });
        }

        // ターン計算
        const blockerTurns = blockers.reduce((sum, b) => sum + (b.estimatedTurns || 1), 0);
        const targetTurns = estimateActionTurns(actionNeeded, targetItem);
        const rewearTurns = itemsToRewear.reduce((sum, r) => sum + (r.estimatedTurns || 1), 0);
        const totalEstimatedTurns = blockerTurns + targetTurns + rewearTurns;
        const isMultiTurn = totalEstimatedTurns > 1;

        if (isMultiTurn && canExecute) {
            warningsJa.push(`脱衣に合計約 ${totalEstimatedTurns} ターンを消費します。敵の接近に注意してください。`);
            warningsEn.push(`Removing will take ~${totalEstimatedTurns} turns. Beware of nearby monsters.`);
        }

        return {
            targetItem: {
                letter: targetItem.letter || '',
                name: targetItem.name || targetItem.rawText || '',
                rawText: targetItem.rawText || targetItem.name || '',
                targetSlot,
                isTakeOff: true
            },
            actionNeeded,
            canExecute,
            blockers,
            itemsToRewear,
            risks: {
                totalEstimatedTurns,
                isMultiTurn,
                hasCursedBlocker: Boolean(cursedBlocker),
                targetBucStatus: targetItem.isCursed ? 'cursed' : (targetItem.isBlessed ? 'blessed' : (targetItem.isUncursed ? 'uncursed' : 'unknown')),
                warnings: warningsJa,
                warningsJa,
                warningsEn,
                blockingReason: blockingReasonJa,
                blockingReasonJa,
                blockingReasonEn
            }
        };
    }

    /**
     * 装備換装時のリアルタイム差分（AC、耐性・特性、重量負荷）を純粋計算
     * @param {Object} equippedState - extractEquippedState の結果
     * @param {Object|null} targetItem - 装備するアイテム（null または isTakeOff の場合は脱衣）
     * @param {string} targetSlot - 対象スロットID
     * @param {Object} [currentStatus={}] - プレイヤーの現在ステータス（{ ac: 10 } など）
     * @param {Object} [currentEncumbrance=null] - 負荷状態情報
     * @returns {Object} 差分プレビューデータ
     */
    static calculateEquipmentDiff(equippedState, targetItem, targetSlot, currentStatus = {}, currentEncumbrance = null) {
        const currentAc = typeof currentStatus?.ac === 'number' ? currentStatus.ac : 10;
        const currentItem = equippedState ? equippedState[targetSlot] : null;

        // 1. 防御力 (AC) 差分計算
        const oldAcBonus = this._getItemAcBonus(currentItem);
        const newAcBonus = targetItem ? this._getItemAcBonus(targetItem) : 0;
        const deltaAcBonus = newAcBonus - oldAcBonus; // 正: 防御力向上
        const targetAc = currentAc - deltaAcBonus; // NetHackではAC低下が防御向上

        const acDiff = {
            currentAc,
            targetAc,
            deltaBonus: deltaAcBonus,
            isImproved: deltaAcBonus > 0,
            isWorsened: deltaAcBonus < 0,
            labelJa: deltaAcBonus > 0
                ? `防御力 +${deltaAcBonus} 改善`
                : (deltaAcBonus < 0 ? `防御力 ${deltaAcBonus} 悪化` : 'AC変動なし'),
            labelEn: deltaAcBonus > 0
                ? `Defense +${deltaAcBonus} (Better)`
                : (deltaAcBonus < 0 ? `Defense ${deltaAcBonus} (Worse)` : 'No AC change')
        };

        // 2. 特性・耐性 (Properties / Resistances) 差分計算
        const oldProps = this._getItemConveyedProperties(currentItem);
        const newProps = targetItem ? this._getItemConveyedProperties(targetItem) : [];

        const addedProps = newProps.filter(p => !oldProps.some(op => op.key === p.key));
        const removedProps = oldProps.filter(p => !newProps.some(np => np.key === p.key));

        // 3. 重量 (Weight) 差分計算
        const oldWeight = this._getItemWeight(currentItem);
        const newWeight = targetItem ? this._getItemWeight(targetItem) : 0;
        const deltaWeight = newWeight - oldWeight;

        return {
            targetSlot,
            targetItem,
            currentItem,
            ac: acDiff,
            properties: {
                added: addedProps,
                removed: removedProps
            },
            weight: {
                oldWeight,
                newWeight,
                deltaWeight
            }
        };
    }

    /**
     * アイテムの AC 寄与ボーナス（AC改善量）を算出
     * @private
     */
    static _getItemAcBonus(item) {
        if (!item) return 0;
        const raw = (item.rawText || item.name || '').toLowerCase();
        const knowledge = item.knowledge || {};
        const stats = knowledge.stats || {};

        let baseBonus = 0;
        if (typeof item.acBonus === 'number') {
            baseBonus = item.acBonus;
        } else if (typeof stats.acBonus === 'number') {
            baseBonus = stats.acBonus;
        } else if (typeof item.ac === 'number') {
            baseBonus = 10 - item.ac;
        } else if (typeof stats.ac === 'number') {
            baseBonus = 10 - stats.ac;
        } else if (typeof knowledge.ac === 'number') {
            baseBonus = 10 - knowledge.ac;
        }

        // エンチャント値 (+1, +2, -1 等) の加算
        let ench = 0;
        if (typeof item.enchantment === 'number') {
            ench = item.enchantment;
        } else {
            const match = raw.match(/([+-]\d+)/);
            if (match) {
                ench = parseInt(match[1], 10);
            }
        }

        return baseBonus + ench;
    }

    /**
     * アイテムが付与する特性・耐性リストを抽出
     * @private
     */
    static _getItemConveyedProperties(item) {
        if (!item) return [];
        const props = [];
        const raw = (item.rawText || item.name || '').toLowerCase();
        const knowledge = item.knowledge || {};
        const prop = knowledge.propConveyed || knowledge.stats?.propConveyed || null;

        const propMaster = {
            FIRE_RES: { key: 'fire', labelJa: '🔥火炎耐性', labelEn: 'Fire Res' },
            COLD_RES: { key: 'cold', labelJa: '❄️冷気耐性', labelEn: 'Cold Res' },
            SHOCK_RES: { key: 'shock', labelJa: '⚡電撃耐性', labelEn: 'Shock Res' },
            DISINT_RES: { key: 'disint', labelJa: '💥分解耐性', labelEn: 'Disint Res' },
            POISON_RES: { key: 'poison', labelJa: '🧪毒耐性', labelEn: 'Poison Res' },
            SLEEP_RES: { key: 'sleep', labelJa: '💤睡眠耐性', labelEn: 'Sleep Res' },
            REFLECTING: { key: 'reflect', labelJa: '🛡️反射', labelEn: 'Reflection' },
            ANTIMAGIC: { key: 'antimagic', labelJa: '🔮耐魔', labelEn: 'Magic Res' },
            DRAIN_RES: { key: 'drain', labelJa: '🩸ドレイン耐性', labelEn: 'Drain Res' },
            FREE_ACTION: { key: 'freeAction', labelJa: '🤸自由行動', labelEn: 'Free Action' },
            STEALTH: { key: 'stealth', labelJa: '👟隠密', labelEn: 'Stealth' },
            LEVITATION: { key: 'levitation', labelJa: '🪶浮遊', labelEn: 'Levitation' },
            FAST: { key: 'fast', labelJa: '⚡倍速', labelEn: 'Speed' },
            SEE_INVIS: { key: 'seeInvis', labelJa: '👁️可視', labelEn: 'See Invis' },
            TELEPAT: { key: 'telepat', labelJa: '🧠テレパシー', labelEn: 'Telepathy' },
            WARNING: { key: 'warning', labelJa: '⚠️警戒', labelEn: 'Warning' }
        };

        if (prop && propMaster[prop]) {
            props.push(propMaster[prop]);
        }

        // テキストマッチ判定フォールバック
        if (/fire resistance|red dragon/i.test(raw) && !props.some(p => p.key === 'fire')) {
            props.push(propMaster.FIRE_RES);
        }
        if (/cold resistance|white dragon/i.test(raw) && !props.some(p => p.key === 'cold')) {
            props.push(propMaster.COLD_RES);
        }
        if (/shock resistance|blue dragon/i.test(raw) && !props.some(p => p.key === 'shock')) {
            props.push(propMaster.SHOCK_RES);
        }
        if (/disintegration|black dragon/i.test(raw) && !props.some(p => p.key === 'disint')) {
            props.push(propMaster.DISINT_RES);
        }
        if (/poison resistance/i.test(raw) && !props.some(p => p.key === 'poison')) {
            props.push(propMaster.POISON_RES);
        }
        if (/reflecting|silver dragon|shield of reflection/i.test(raw) && !props.some(p => p.key === 'reflect')) {
            props.push(propMaster.REFLECTING);
        }
        if (/magic resistance|gray dragon|cloak of magic resistance/i.test(raw) && !props.some(p => p.key === 'antimagic')) {
            props.push(propMaster.ANTIMAGIC);
        }
        if (/stealth|elven cloak|boots of stealth/i.test(raw) && !props.some(p => p.key === 'stealth')) {
            props.push(propMaster.STEALTH);
        }
        if (/speed|boots of speed/i.test(raw) && !props.some(p => p.key === 'fast')) {
            props.push(propMaster.FAST);
        }
        if (/levitation/i.test(raw) && !props.some(p => p.key === 'levitation')) {
            props.push(propMaster.LEVITATION);
        }

        return props;
    }

    /**
     * アイテムの重量を概算
     * @private
     */
    static _getItemWeight(item) {
        if (!item) return 0;
        if (typeof item.weight === 'number') return item.weight;
        if (typeof item.knowledge?.weight === 'number') return item.knowledge.weight;
        if (typeof item.knowledge?.stats?.weight === 'number') return item.knowledge.stats.weight;
        return 0;
    }
}

