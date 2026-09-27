/**
 * NhContainerFiler.test.js
 *
 * <nh-container-filer> Web Component の単体テスト。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupMockDom } from './testElementHelper.js';
import { NhContainerFiler } from '../../src/components/NhContainerFiler.js';
import { TRANSFER_DIRECTION } from '../../src/ui-controller/ContainerDraftController.js';

describe('NhContainerFiler (<nh-container-filer>)', () => {
  let restoreDom;

  beforeEach(() => {
    restoreDom = setupMockDom();
  });

  afterEach(() => {
    restoreDom();
  });

  it('connectedCallback 時に二画面ファイラーの左右ペインが初期化されること', () => {
    const el = new NhContainerFiler();
    el.connectedCallback();

    const panes = el.shadowRoot.querySelectorAll('.filer-pane');
    expect(panes.length).toBe(2);
  });

  it('setPlayerInventory と setContainerContents でアイテムリストが表示されること', () => {
    const el = new NhContainerFiler();
    el.connectedCallback();

    el.setPlayerInventory([
      { id: 1, name: 'long sword', count: 1, glyph: '⚔️' },
      { id: 2, name: 'apple', count: 3, glyph: '🍎' }
    ]);

    el.setContainerContents([
      { id: 3, name: 'gold piece', count: 100, glyph: '💰' }
    ]);

    const playerList = el.shadowRoot.querySelector('.player-items-list');
    expect(playerList.children.length).toBe(2);
    expect(playerList.textContent).toContain('long sword');
    expect(playerList.textContent).toContain('apple');

    const containerList = el.shadowRoot.querySelector('.container-items-list');
    expect(containerList.children.length).toBe(1);
    expect(containerList.textContent).toContain('gold piece');
  });

  it('stageTransfer でドラフトが追加され、transfer-staged イベントが発火すること', () => {
    const el = new NhContainerFiler();
    el.connectedCallback();

    const stagedSpy = vi.fn();
    el.addEventListener('transfer-staged', stagedSpy);

    const item = { id: 1, name: 'food ration', count: 2 };
    el.stageTransfer(item, TRANSFER_DIRECTION.TO_CONTAINER, 1);

    expect(stagedSpy).toHaveBeenCalledTimes(1);
    expect(el.getDrafts().length).toBe(1);
    expect(el.getDrafts()[0].count).toBe(1);

    const draftTotal = el.shadowRoot.querySelector('.draft-total');
    expect(draftTotal.textContent).toBe('1');
  });

  it('手品袋 (Bag of Holding) に爆発危険アイテムを入れようとすると警告イベントが発火し、リスク表示されること', () => {
    const el = new NhContainerFiler();
    el.setBagOfHolding(true);
    el.connectedCallback();

    // 防爆バッジが表示されていること
    const bohBadge = el.shadowRoot.querySelector('.boh-badge');
    expect(bohBadge.textContent).toContain('防爆モード');

    const warningSpy = vi.fn();
    el.addEventListener('explosion-warning', warningSpy);

    // 手品袋に対して爆発危険な「bag of tricks」
    const riskItem = {
      id: 50,
      name: 'bag of tricks',
      isBagOfTricks: true
    };

    el.setPlayerInventory([riskItem]);

    const res = el.stageTransfer(riskItem, TRANSFER_DIRECTION.TO_CONTAINER);
    expect(res.requiresWarning).toBe(true);
    expect(warningSpy).toHaveBeenCalledTimes(1);

    const riskCard = el.shadowRoot.querySelector('.filer-item-card.risk');
    expect(riskCard).toBeDefined();
    expect(riskCard.textContent).toContain('CRITICAL 爆発');
  });
});
