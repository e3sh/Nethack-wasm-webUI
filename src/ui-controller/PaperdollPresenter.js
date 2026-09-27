/**
 * PaperdollPresenter.js
 *
 * 装備ペーパードールUIの部位スロット表示・候補アイテム抽出・リアルタイム差分計算を司る
 * Headless な Presenter / コントローラー。DOM非依存。
 *
 * 【アーキテクチャ境界】:
 * - ゲームルール・二刀流適性判定等は GKL (EquipmentRules / CharacterKnowledge) に完全委譲。
 * - 本 Presenter は GKL の判定結果 (YN) を受け取り、UIスロットや表示状態にマッピングする責務に純化。
 */
import {
  EQUIP_SLOTS,
  resolveEligibleSlots,
  isTwoHandedWeapon,
  isCockatriceCorpse,
  isTwoWeaponEligible
} from '../core/knowledge/equipment/EquipmentRules.js';
import { EquipmentDependencyAnalyzer } from '../core/knowledge/equipment/EquipmentDependencyAnalyzer.js';

export const SLOT_DEFINITIONS = Object.freeze({
  [EQUIP_SLOTS.HELM]:      { id: EQUIP_SLOTS.HELM, labelJa: '頭 (兜)', labelEn: 'Helm', icon: '🪖' },
  [EQUIP_SLOTS.BLINDFOLD]: { id: EQUIP_SLOTS.BLINDFOLD, labelJa: '目 (目隠し)', labelEn: 'Eyes', icon: '🕶️' },
  [EQUIP_SLOTS.AMULET]:    { id: EQUIP_SLOTS.AMULET, labelJa: '首 (アミュレット)', labelEn: 'Amulet', icon: '🧿' },
  [EQUIP_SLOTS.MAIN_HAND]: { id: EQUIP_SLOTS.MAIN_HAND, labelJa: '主手 (武器/道具)', labelEn: 'Main Hand', icon: '⚔️' },
  [EQUIP_SLOTS.OFF_HAND]:  { id: EQUIP_SLOTS.OFF_HAND, labelJa: '控え (副武器)', labelEn: 'Alt Weapon', icon: '🗡️' },
  [EQUIP_SLOTS.SHIELD]:    { id: EQUIP_SLOTS.SHIELD, labelJa: '副手 (盾)', labelEn: 'Shield / Off', icon: '🛡️' },
  [EQUIP_SLOTS.CLOAK]:     { id: EQUIP_SLOTS.CLOAK, labelJa: '外套 (クローク)', labelEn: 'Cloak (Layer 3)', icon: '🧥', layer: 3 },
  [EQUIP_SLOTS.SUIT]:      { id: EQUIP_SLOTS.SUIT, labelJa: '鎧 (甲冑)', labelEn: 'Suit (Layer 2)', icon: '🥋', layer: 2 },
  [EQUIP_SLOTS.SHIRT]:     { id: EQUIP_SLOTS.SHIRT, labelJa: '肌着 (シャツ)', labelEn: 'Shirt (Layer 1)', icon: '👕', layer: 1 },
  [EQUIP_SLOTS.GLOVES]:    { id: EQUIP_SLOTS.GLOVES, labelJa: '手 (手袋/籠手)', labelEn: 'Gloves', icon: '🧤' },
  [EQUIP_SLOTS.LEFT_RING]: { id: EQUIP_SLOTS.LEFT_RING, labelJa: '左指 (指輪)', labelEn: 'Left Ring', icon: '💍' },
  [EQUIP_SLOTS.RIGHT_RING]:{ id: EQUIP_SLOTS.RIGHT_RING, labelJa: '右指 (指輪)', labelEn: 'Right Ring', icon: '💍' },
  [EQUIP_SLOTS.QUIVER]:    { id: EQUIP_SLOTS.QUIVER, labelJa: '矢筒 (弾薬/投擲)', labelEn: 'Quiver', icon: '🏹' },
  [EQUIP_SLOTS.BOOTS]:     { id: EQUIP_SLOTS.BOOTS, labelJa: '足 (靴/ブーツ)', labelEn: 'Boots', icon: '👢' }
});

export class PaperdollPresenter {
  /**
   * @param {Object} [options]
   */
  constructor(options = {}) {
    this.slotDefinitions = options.slotDefinitions || SLOT_DEFINITIONS;
  }

  /**
   * 指定したインベントリアイテム群から、指定スロットに装備可能なアイテムを抽出
   * @param {Array<Object>} items
   * @param {string} slotId
   * @returns {Array<Object>}
   */
  getEligibleItemsForSlot(items, slotId) {
    if (!Array.isArray(items) || !slotId) return [];
    return items.filter(item => {
      const slots = resolveEligibleSlots(item);
      return Array.isArray(slots) && slots.includes(slotId);
    });
  }

  /**
   * 装備変更のリアルタイム差分プレビューを計算 (Headless)
   * @param {Object} params
   * @param {Object} params.situation - GKL Situation オブジェクト
   * @param {Object} [params.candidateItem] - 装備予定の候補アイテム (脱ぐ場合は null)
   * @param {Object} [params.currentItem] - 現在そのスロットに装備中のアイテム
   * @param {string} params.slotId - 対象スロットID
   * @returns {Object} 差分解析結果
   */
  calculatePreviewDiff({ situation, candidateItem, currentItem, slotId }) {
    if (!situation) {
      return {
        ac: { current: 10, target: 10, delta: 0, isImproved: false, isWorsened: false },
        turns: { required: candidateItem ? 1 : 1, steps: [] },
        weight: { delta: 0 },
        resistances: { gained: [], lost: [] },
        warnings: []
      };
    }

    const currentInventory = (situation && situation.inventory && Array.isArray(situation.inventory.items))
      ? situation.inventory.items
      : [];

    return EquipmentDependencyAnalyzer.calculateEquipmentDiff(
      currentInventory,
      candidateItem || null,
      slotId,
      situation
    );
  }

  /**
   * 二刀流 (Two-Weapon) の適性を判定 (GKL への問い合わせ)
   * @param {Object} situation - GKL Situation オブジェクト
   * @param {Object} [core] - WebUICore (フォールバック)
   * @returns {boolean} 二刀流が可能なら true
   */
  checkTwoWeaponEligibility(situation, core = null) {
    if (situation?.skills?.canTwoWeapon !== undefined) {
      return Boolean(situation.skills.canTwoWeapon);
    }
    return isTwoWeaponEligible(situation, core);
  }
}
