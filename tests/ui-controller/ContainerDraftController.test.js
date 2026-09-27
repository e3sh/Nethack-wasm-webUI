import { describe, it, expect } from 'vitest';
import {
  ContainerDraftController,
  TRANSFER_DIRECTION
} from '../../src/ui-controller/index.js';

describe('ContainerDraftController (Headless Container UI Controller)', () => {
  it('通常コンテナへのアイテムドラフト追加が正常に行われること', () => {
    const controller = new ContainerDraftController({ isBagOfHolding: false });

    const item = { name: 'apple', count: 5 };
    const res = controller.stageTransfer(item, TRANSFER_DIRECTION.TO_CONTAINER, 2);

    expect(res.success).toBe(true);
    expect(res.requiresWarning).toBe(false);
    expect(res.draft.count).toBe(2);
    expect(controller.getDrafts()).toHaveLength(1);
  });

  it('手品袋 (Bag of Holding) への危険アイテム投入時に警告フラグが立つこと', () => {
    const controller = new ContainerDraftController({ isBagOfHolding: true });

    // wand of cancellation (打ち消しの杖)
    const dangerousItem = {
      name: 'wand of cancellation',
      class: 'Wand',
      rawText: 'a wand of cancellation'
    };

    const res = controller.stageTransfer(dangerousItem, TRANSFER_DIRECTION.TO_CONTAINER);
    expect(res.requiresWarning).toBe(true);
    expect(res.draft.isRisk).toBe(true);
  });

  it('ドラフトのクリアが正常に動作すること', () => {
    const controller = new ContainerDraftController();
    controller.stageTransfer({ name: 'rock' }, TRANSFER_DIRECTION.TO_CONTAINER);
    expect(controller.getDrafts()).toHaveLength(1);

    controller.clearDraft();
    expect(controller.getDrafts()).toHaveLength(0);
  });
});
