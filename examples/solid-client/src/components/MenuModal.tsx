import { Component, createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { activeMenu, MenuItem } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';
import { getTileMapping } from '../utils/tileMapping';

export const MenuModal: Component = () => {
  const [selectedIndices, setSelectedIndices] = createSignal<number[]>([]);
  let isSubmitting = false;
  let tileMapTable: Record<number, number> = {};

  createEffect(() => {
    if (activeMenu()) {
      setSelectedIndices([]);
      isSubmitting = false;
      tileMapTable = getTileMapping();
    }
  });

  const getAccChar = (item: MenuItem): string => {
    if (item.isHeader) return '';
    const ch = item.accelerator || item.ch;
    if (typeof ch === 'string' && ch !== '\x00') return ch;
    if (typeof ch === 'number' && ch > 0) return String.fromCharCode(ch);
    return '';
  };

  const getTileStyle = (item: MenuItem): string => {
    if (item.isHeader) return '';
    const glyph = item.glyph !== undefined ? item.glyph : (item.glyphInfo?.glyph ?? -1);
    if (glyph < 0 || !tileMapTable) return '';

    const tileIdx = tileMapTable[glyph];
    if (tileIdx === undefined || tileIdx < 0) return '';

    const tilesPerRow = 40;
    const origTileSize = 32;
    const tx = (tileIdx % tilesPerRow) * origTileSize;
    const ty = Math.floor(tileIdx / tilesPerRow) * origTileSize;

    const posX = -(tx / 2);
    const posY = -(ty / 2);

    return `background-image: url(./pict/nethack_default_32.png); background-position: ${posX}px ${posY}px; background-size: 640px auto; width: 16px; height: 16px; min-width: 16px; min-height: 16px; flex-shrink: 0; display: inline-block; image-rendering: pixelated; margin-right: 6px; background-repeat: no-repeat; vertical-align: middle;`;
  };

  const safeRespondMenu = (val: any) => {
    if (isSubmitting) return;
    isSubmitting = true;
    driverController.respondMenu(val);
  };

  const handleItemClick = (idx: number, item: MenuItem) => {
    const menu = activeMenu();
    if (!menu || item.isHeader || isSubmitting) return;
    const how = menu.how ?? 1;

    if (how === 0) {
      safeRespondMenu(0);
      return;
    }

    if (how === 1) {
      safeRespondMenu([item]);
      return;
    }

    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((i) => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  const confirmSelection = () => {
    const menu = activeMenu();
    if (!menu || isSubmitting) return;

    if (menu.how === 0) {
      safeRespondMenu(0);
      return;
    }

    const indices = selectedIndices();
    if (indices.length > 0) {
      const selectedItems = indices.map((idx) => menu.items[idx]);
      safeRespondMenu(selectedItems);
    } else {
      const validItem = menu.items.find(
        (it: MenuItem) => !it.isHeader && it.identifier !== undefined && it.identifier !== 0
      );
      safeRespondMenu(validItem ? [validItem] : 0);
    }
  };

  const cancelMenu = () => {
    if (isSubmitting) return;
    safeRespondMenu(0);
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const menu = activeMenu();
      if (!menu || isSubmitting) return;

      if (e.key === 'Escape' || e.key === ' ' || (menu.how === 0 && e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        cancelMenu();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        confirmSelection();
        return;
      }

      if (e.key.length === 1 && menu.how !== 0) {
        const pressedKey = e.key;
        const matchItem = menu.items.find((it: MenuItem) => {
          if (it.isHeader) return false;
          const c = getAccChar(it);
          return c === pressedKey;
        });

        if (matchItem) {
          e.preventDefault();
          e.stopPropagation();
          safeRespondMenu([matchItem]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown, true);
    });
  });

  return (
    <Show when={activeMenu()}>
      {(menu) => (
        <div class="modal-backdrop" onClick={cancelMenu}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 class="modal-title">{menu().prompt || 'Select Item'}</h3>

            <div class="menu-list">
              <For each={menu().items}>
                {(item, idx) => {
                  const accChar = getAccChar(item);
                  const tileStyle = getTileStyle(item);
                  const isSelected = () => selectedIndices().includes(idx());

                  return (
                    <Show
                      when={!item.isHeader && item.identifier !== undefined && item.identifier !== 0}
                      fallback={
                        <div class="menu-item-row menu-header">{item.str}</div>
                      }
                    >
                      <div
                        class={`menu-item-row ${isSelected() ? 'selected' : ''}`}
                        onClick={() => handleItemClick(idx(), item)}
                      >
                        <Show when={accChar}>
                          <span class="item-acc">{accChar})</span>
                        </Show>
                        <Show when={tileStyle}>
                          <span class="item-tile" style={tileStyle}></span>
                        </Show>
                        <span class="item-str">{item.str}</span>
                      </div>
                    </Show>
                  );
                }}
              </For>
            </div>

            <div class="modal-footer">
              <Show
                when={menu().how !== 0}
                fallback={
                  <button onClick={cancelMenu} class="btn btn-primary">
                    OK (Enter / Space / ESC)
                  </button>
                }
              >
                <button onClick={confirmSelection} class="btn btn-primary">
                  OK (Enter)
                </button>
                <button onClick={cancelMenu} class="btn btn-secondary">
                  Cancel (ESC)
                </button>
              </Show>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
