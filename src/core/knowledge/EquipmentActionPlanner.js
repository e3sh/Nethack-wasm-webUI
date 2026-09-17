/**
 * EquipmentActionPlanner.js
 * 
 * 装備換装における最短・安全なキーストローク列（ActionRecipe）を生成する自動換装プランナー。
 * NetHack C-Core (do_wear.c) の脱衣可能防具数・装着指輪数の仕様に基づき、
 * ステップ進行の動的シミュレーションを行って余剰キーのない正確なシーケンスを出力する。
 */

import {
    EQUIP_SLOTS,
    estimateActionTurns
} from './EquipmentRules.js';
import { EquipmentDependencyAnalyzer } from './EquipmentDependencyAnalyzer.js';

export class EquipmentActionPlanner {

    /**
     * EquipmentDependencyReport から ActionRecipe を生成
     * @param {Object} report - EquipmentDependencyAnalyzer.analyzeDependency の結果
     * @param {Object} [options={}]
     * @param {Array<Object>|Object} [options.inventory=null] - 初期着用状態判定用のインベントリ
     * @returns {Object} ActionRecipe
     */
    static plan(report, options = {}) {
        if (!report) return null;

        // 実行不能（呪詛ブロッカーやコカトリス石化など）の場合
        if (!report.canExecute) {
            return {
                canExecute: false,
                blockingReason: report.risks?.blockingReason || '換装を実行できません。',
                steps: [],
                sequence: [],
                totalEstimatedTurns: 0,
                isMultiTurn: false,
                risks: report.risks || { warnings: [] }
            };
        }

        // 初期着用状態シミュレータの構築
        const simEquipped = this._buildInitialSimState(report, options.inventory);

        const steps = [];

        // 1. ブロッカー解除ステップ生成 (take_off, remove, unwield)
        for (const blocker of report.blockers || []) {
            const step = this._createBlockerStep(blocker, simEquipped);
            if (step) {
                steps.push(step);
            }
        }

        // 2. 目的アイテム装備ステップ生成 (wear, put_on, wield, quiver)
        if (report.targetItem && report.targetItem.letter) {
            const step = this._createEquipStep(report.targetItem, simEquipped);
            if (step) {
                steps.push(step);
            }
        }

        // 3. 着直しステップ生成 (LIFO逆順に wear, put_on, wield)
        for (const rewear of report.itemsToRewear || []) {
            const step = this._createRewearStep(rewear, simEquipped);
            if (step) {
                steps.push(step);
            }
        }

        // 全ステップのキーストロークをフラットに結合
        const sequence = steps.flatMap(s => s.sequence);
        const totalEstimatedTurns = steps.reduce((sum, s) => sum + (s.estimatedTurns || 1), 0);
        const isMultiTurn = totalEstimatedTurns > 1;

        return {
            canExecute: true,
            blockingReason: null,
            steps,
            sequence,
            totalEstimatedTurns,
            isMultiTurn,
            risks: {
                ...(report.risks || {}),
                totalEstimatedTurns,
                isMultiTurn
            }
        };
    }

    /**
     * インベントリと対象アイテムから直接 ActionRecipe を生成するショートカット
     * @param {Array<Object>|Object} inventory
     * @param {Object} targetItem
     * @param {string} [requestedSlot=null]
     * @param {Object} [options={}]
     * @returns {Object} ActionRecipe
     */
    static planForTarget(inventory, targetItem, requestedSlot = null, options = {}) {
        const report = EquipmentDependencyAnalyzer.analyzeDependency(inventory, targetItem, requestedSlot);
        return this.plan(report, { inventory, ...options });
    }

    /**
     * 初期着用状態マップの作成
     * @private
     */
    static _buildInitialSimState(report, inventory) {
        if (inventory) {
            return EquipmentDependencyAnalyzer.extractEquippedState(inventory);
        }

        // inventory が直接渡されていない場合、report の情報から推測復元
        const sim = {};
        for (const b of (report.blockers || [])) {
            sim[b.slot] = { letter: b.letter, name: b.name, slot: b.slot };
        }
        return sim;
    }

    /**
     * 脱衣可能防具数 (Narmorpieces) を算出 (NetHack C-Core do_wear.c count_worn_stuff 準拠)
     * 兜、盾、手袋、靴は各独立。胴体部位 (cloak/suit/shirt) は最外層の1点のみがカウントされる。
     * @private
     */
    static _countRemovableArmors(simEquipped) {
        let count = 0;
        if (simEquipped[EQUIP_SLOTS.HELM]) count++;
        if (simEquipped[EQUIP_SLOTS.SHIELD]) count++;
        if (simEquipped[EQUIP_SLOTS.GLOVES]) count++;
        if (simEquipped[EQUIP_SLOTS.BOOTS]) count++;

        // 胴体防具: cloak -> suit -> shirt の最外層の1点のみ
        if (simEquipped[EQUIP_SLOTS.CLOAK]) count++;
        else if (simEquipped[EQUIP_SLOTS.SUIT]) count++;
        else if (simEquipped[EQUIP_SLOTS.SHIRT]) count++;

        return count;
    }

    /**
     * 装着中の指輪数を算出
     * @private
     */
    static _countWornRings(simEquipped) {
        let count = 0;
        if (simEquipped[EQUIP_SLOTS.LEFT_RING]) count++;
        if (simEquipped[EQUIP_SLOTS.RIGHT_RING]) count++;
        return count;
    }

    /**
     * ブロッカー解除ステップの作成
     * @private
     */
    static _createBlockerStep(blocker, simEquipped) {
        const slot = blocker.slot;
        const letter = blocker.letter;
        const name = blocker.name || blocker.rawText || '';
        let sequence = [];
        let verb = 'T';
        let type = blocker.actionNeeded || 'take_off';
        let descJa = '';
        let descEn = '';

        if (type === 'unwield' || slot === EQUIP_SLOTS.MAIN_HAND || slot === EQUIP_SLOTS.OFF_HAND) {
            type = 'unwield';
            verb = 'w';
            sequence = ['w', '-'];
            descJa = `武器 (${letter}) を外す`;
            descEn = `Unwield weapon (${letter})`;
            simEquipped[slot] = null;
        } else if (type === 'remove' || slot === EQUIP_SLOTS.LEFT_RING || slot === EQUIP_SLOTS.RIGHT_RING || slot === EQUIP_SLOTS.AMULET || slot === EQUIP_SLOTS.BLINDFOLD) {
            type = 'remove';
            verb = 'R';
            if (slot === EQUIP_SLOTS.LEFT_RING || slot === EQUIP_SLOTS.RIGHT_RING) {
                const ringCount = this._countWornRings(simEquipped);
                // 指輪が1個だけ装着されている場合、R のみで外れる。2個ある時は指輪文字が必要。
                sequence = ringCount <= 1 ? ['R'] : (letter ? ['R', letter] : ['R']);
            } else {
                sequence = letter ? ['R', letter] : ['R'];
            }
            descJa = `${name || '装身具'} (${letter}) を外す`;
            descEn = `Remove ${name || 'accessory'} (${letter})`;
            simEquipped[slot] = null;
        } else {
            // 防具脱衣 (take_off)
            type = 'take_off';
            verb = 'T';
            const removableCount = this._countRemovableArmors(simEquipped);
            // 脱衣可能防具が1点だけの場合、NetHackは文字を聞かずに即座に脱ぐ
            sequence = removableCount <= 1 ? ['T'] : (letter ? ['T', letter] : ['T']);
            descJa = `${name || '防具'} (${letter}) を脱ぐ`;
            descEn = `Take off ${name || 'armor'} (${letter})`;
            simEquipped[slot] = null;
        }

        return {
            type,
            verb,
            letter,
            slot,
            name,
            sequence,
            estimatedTurns: blocker.estimatedTurns || estimateActionTurns(type, blocker),
            descriptionJa: descJa,
            descriptionEn: descEn
        };
    }

    /**
     * 目的アイテム装備ステップの作成
     * @private
     */
    static _createEquipStep(targetItem, simEquipped) {
        const slot = targetItem.targetSlot || EQUIP_SLOTS.MAIN_HAND;
        const letter = targetItem.letter;
        const name = targetItem.name || targetItem.rawText || '';
        let sequence = [];
        let verb = 'W';
        let type = 'wear';
        let descJa = '';
        let descEn = '';

        if (slot === EQUIP_SLOTS.MAIN_HAND) {
            type = 'wield';
            verb = 'w';
            sequence = ['w', letter];
            descJa = `${name} (${letter}) を手に持つ`;
            descEn = `Wield ${name} (${letter})`;
            simEquipped[slot] = targetItem;
        } else if (slot === EQUIP_SLOTS.QUIVER) {
            type = 'quiver';
            verb = 'Q';
            sequence = ['Q', letter];
            descJa = `${name} (${letter}) を矢筒に詰める`;
            descEn = `Quiver ${name} (${letter})`;
            simEquipped[slot] = targetItem;
        } else if (slot === EQUIP_SLOTS.LEFT_RING || slot === EQUIP_SLOTS.RIGHT_RING) {
            type = 'put_on';
            verb = 'P';
            const ringCount = this._countWornRings(simEquipped);
            if (ringCount === 0) {
                const finger = (slot === EQUIP_SLOTS.RIGHT_RING) ? 'r' : 'l';
                sequence = ['P', letter, finger];
            } else {
                // 既に1個装着されている場合、空いている指に自動装着されるため finger は送らない
                sequence = ['P', letter];
            }
            descJa = `${name} (${letter}) を${slot === EQUIP_SLOTS.RIGHT_RING ? '右手' : '左手'}にはめる`;
            descEn = `Put on ${name} (${letter}) on ${slot === EQUIP_SLOTS.RIGHT_RING ? 'right' : 'left'} finger`;
            simEquipped[slot] = targetItem;
        } else if (slot === EQUIP_SLOTS.AMULET || slot === EQUIP_SLOTS.BLINDFOLD) {
            type = 'put_on';
            verb = 'P';
            sequence = ['P', letter];
            descJa = `${name} (${letter}) を身につける`;
            descEn = `Put on ${name} (${letter})`;
            simEquipped[slot] = targetItem;
        } else {
            // 防具着用 (wear)
            type = 'wear';
            verb = 'W';
            sequence = ['W', letter];
            descJa = `${name} (${letter}) を着る`;
            descEn = `Wear ${name} (${letter})`;
            simEquipped[slot] = targetItem;
        }

        return {
            type,
            verb,
            letter,
            slot,
            name,
            sequence,
            estimatedTurns: estimateActionTurns(type, targetItem),
            descriptionJa: descJa,
            descriptionEn: descEn
        };
    }

    /**
     * 着直しステップの作成
     * @private
     */
    static _createRewearStep(rewear, simEquipped) {
        const slot = rewear.slot;
        const letter = rewear.letter;
        const name = rewear.name || rewear.rawText || '';
        let sequence = [];
        let verb = 'W';
        let type = rewear.actionNeeded || 'wear';
        let descJa = '';
        let descEn = '';

        if (type === 'wield' || slot === EQUIP_SLOTS.MAIN_HAND) {
            type = 'wield';
            verb = 'w';
            sequence = ['w', letter];
            descJa = `${name} (${letter}) を持ち直す`;
            descEn = `Rewield ${name} (${letter})`;
            simEquipped[slot] = rewear;
        } else if (type === 'put_on' || slot === EQUIP_SLOTS.LEFT_RING || slot === EQUIP_SLOTS.RIGHT_RING || slot === EQUIP_SLOTS.AMULET || slot === EQUIP_SLOTS.BLINDFOLD) {
            type = 'put_on';
            verb = 'P';
            if (slot === EQUIP_SLOTS.LEFT_RING || slot === EQUIP_SLOTS.RIGHT_RING) {
                const ringCount = this._countWornRings(simEquipped);
                if (ringCount === 0) {
                    const finger = (slot === EQUIP_SLOTS.RIGHT_RING) ? 'r' : 'l';
                    sequence = ['P', letter, finger];
                } else {
                    sequence = ['P', letter];
                }
            } else {
                sequence = ['P', letter];
            }
            descJa = `${name} (${letter}) をはめ直す`;
            descEn = `Put back on ${name} (${letter})`;
            simEquipped[slot] = rewear;
        } else {
            type = 'wear';
            verb = 'W';
            sequence = ['W', letter];
            descJa = `${name} (${letter}) を着直す`;
            descEn = `Rewear ${name} (${letter})`;
            simEquipped[slot] = rewear;
        }

        return {
            type,
            verb,
            letter,
            slot,
            name,
            sequence,
            estimatedTurns: rewear.estimatedTurns || estimateActionTurns(type, rewear),
            descriptionJa: descJa,
            descriptionEn: descEn
        };
    }
}
