import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryView } from '../../examples/gkl-pure-js-client/modules/components/InventoryView.js';
import { InventoryStateManager } from '../../src/core/knowledge/InventoryStateManager.js';

describe('InventoryView - スタック武器（複数個の短剣）のメイン装備枠とバッジ表示', () => {
  let inventoryView;
  let gridElement;
  let invCountElement;

  beforeEach(() => {
    gridElement = {
      innerHTML: '',
      querySelector: () => null
    };
    invCountElement = { textContent: '' };

    inventoryView = new InventoryView({
      elGklInventoryGrid: gridElement,
      elGklInvCount: invCountElement,
      getCore: () => null
    });
  });

  it('複数個の短剣をメイン装備にした際、is-wielded クラスとメイン武器バッジ (badge-wielded) が正しくHTMLに含まれること', () => {
    const ism = new InventoryStateManager();
    ism.updateFromLines([
      "a - 3 daggers (wielded)",
      "b - a helmet (being worn)"
    ]);

    inventoryView.renderGklInventory({ items: ism.items });

    const html = gridElement.innerHTML;
    expect(html).toContain('is-wielded');
    expect(html).toContain('badge-wielded');
    expect(html).toContain('title="メイン武器"');
  });

  it('日本語モードで複数個の短剣をメイン装備にした際、is-wielded クラスと「手」バッジが表示されること', () => {
    const ism = new InventoryStateManager();
    ism.updateFromLines([
      "a - 3本の短剣 (装備中)"
    ]);

    inventoryView.setLanguage('ja');
    inventoryView.renderGklInventory({ items: ism.items });

    const html = gridElement.innerHTML;
    expect(html).toContain('is-wielded');
    expect(html).toContain('badge-wielded');
    expect(html).toContain('>手</span>');
  });
});
