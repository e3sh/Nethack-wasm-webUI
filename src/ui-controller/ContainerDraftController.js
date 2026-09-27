/**
 * ContainerDraftController.js
 *
 * 二画面ファイラー型コンテナUIにおける転送ドラフト（一時選択アイテム群）、
 * 移動数量計算、手品袋（Bag of Holding）防爆ガードを管理する Headless コントローラー。
 * DOM非依存。
 */
import { ContainerSafetyGuard, DangerLevel } from '../core/container/ContainerSafetyGuard.js';

export const TRANSFER_DIRECTION = {
  TO_CONTAINER: 'to_container',   // プレイヤー所持品 ➔ コンテナ
  FROM_CONTAINER: 'from_container' // コンテナ ➔ プレイヤー所持品
};

export class ContainerDraftController {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.isBagOfHolding=false]
   * @param {ContainerSafetyGuard} [options.safetyGuard]
   */
  constructor({ isBagOfHolding = false, safetyGuard = null } = {}) {
    this.isBagOfHolding = Boolean(isBagOfHolding);
    this.safetyGuard = safetyGuard || new ContainerSafetyGuard();
    /** @type {Array<{ item: Object, count: number, direction: string, isRisk: boolean }>} */
    this.draftList = [];
  }

  /**
   * コンテナ種別と防爆フラグを設定
   * @param {boolean} isBagOfHolding
   */
  setBagOfHolding(isBagOfHolding) {
    this.isBagOfHolding = Boolean(isBagOfHolding);
  }

  /**
   * 手品袋への格納時に爆発リスクがあるアイテムか判定
   * @param {Object} item
   * @returns {boolean}
   */
  checkExplosionRisk(item) {
    if (!this.isBagOfHolding || !item) return false;
    const assessment = this.safetyGuard.assessItem(item, { isBagOfHolding: true });
    return assessment.level === DangerLevel.CRITICAL || assessment.level === DangerLevel.SUSPICIOUS;
  }

  /**
   * 移動対象としてアイテムをドラフトに追加
   * @param {Object} item
   * @param {string} direction - TRANSFER_DIRECTION
   * @param {number} [count=-1] - 移動数量 (-1 = 全量)
   * @returns {{ success: boolean, requiresWarning: boolean, draft: Object }}
   */
  stageTransfer(item, direction, count = -1) {
    if (!item) return { success: false, requiresWarning: false, draft: null };

    const totalCount = typeof item.count === 'number' ? item.count : (typeof item.quantity === 'number' ? item.quantity : 1);
    const resolvedCount = count === -1 ? totalCount : Math.min(count, totalCount);

    const isRisk = direction === TRANSFER_DIRECTION.TO_CONTAINER && this.checkExplosionRisk(item);

    const draft = {
      item,
      count: resolvedCount,
      direction,
      isRisk
    };

    this.draftList.push(draft);

    return {
      success: true,
      requiresWarning: isRisk,
      draft
    };
  }

  /**
   * ドラフトリストのクリア
   */
  clearDraft() {
    this.draftList = [];
  }

  /**
   * 現在のドラフトリストを取得
   * @returns {Array<Object>}
   */
  getDrafts() {
    return [...this.draftList];
  }
}
