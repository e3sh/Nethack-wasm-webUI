import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, MenuItem } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';
import { getTileMapping } from '../utils/tileMapping';
import { trapFocus } from '@core/input/focusTrap.js';

export const MenuModal: React.FC = () => {
  const activeMenu = useGameStore((state) => state.activeMenu);
  const { respondMenu } = useNetHackDriver();

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const isSubmittingRef = useRef(false);
  const tileMapTableRef = useRef<Record<number, number>>({});
  const menuListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    tileMapTableRef.current = getTileMapping();
  }, []);

  useEffect(() => {
    if (activeMenu) {
      setSelectedIndices([]);
      isSubmittingRef.current = false;
      const firstSelectable = activeMenu.items.findIndex(
        (it) => !it.isHeader && it.identifier !== undefined && it.identifier !== 0
      );
      setFocusedIndex(firstSelectable >= 0 ? firstSelectable : -1);
    }
  }, [activeMenu]);

  const getAccChar = (item: MenuItem): string => {
    if (item.isHeader) return '';
    const ch = item.accelerator !== undefined && item.accelerator !== 0 ? item.accelerator : item.ch;
    if (typeof ch === 'string' && ch !== '\x00') return ch;
    if (typeof ch === 'number' && ch > 0) return String.fromCharCode(ch);
    return '';
  };

  const getTileStyle = (item: MenuItem): React.CSSProperties | undefined => {
    if (item.isHeader) return undefined;
    const glyph = item.glyph !== undefined ? item.glyph : (item.glyphInfo?.glyph ?? -1);
    if (glyph < 0 || !tileMapTableRef.current) return undefined;

    const tileIdx = tileMapTableRef.current[glyph];
    if (tileIdx === undefined || tileIdx < 0) return undefined;

    const tilesPerRow = 40;
    const origTileSize = 32;
    const tx = (tileIdx % tilesPerRow) * origTileSize;
    const ty = Math.floor(tileIdx / tilesPerRow) * origTileSize;

    const posX = -(tx / 2);
    const posY = -(ty / 2);

    return {
      backgroundImage: 'url(./pict/nethack_default_32.png)',
      backgroundPosition: `${posX}px ${posY}px`,
      backgroundSize: '640px auto',
      width: '16px',
      height: '16px',
      minWidth: '16px',
      minHeight: '16px',
      flexShrink: 0,
      display: 'inline-block',
      imageRendering: 'pixelated',
      marginRight: '6px',
      backgroundRepeat: 'no-repeat',
      verticalAlign: 'middle',
    };
  };

  const safeRespondMenu = useCallback(
    (val: any) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      respondMenu(val);
    },
    [respondMenu]
  );

  const handleItemClick = (idx: number, item: MenuItem) => {
    if (item.isHeader || isSubmittingRef.current) return;
    setFocusedIndex(idx);
    const how = activeMenu?.how ?? 1;

    if (how === 0) {
      safeRespondMenu(0);
      return;
    }

    if (how === 1) {
      safeRespondMenu([item]);
      return;
    }

    setSelectedIndices((prev) => {
      const pos = prev.indexOf(idx);
      if (pos > -1) {
        return prev.filter((i) => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  const confirmSelection = useCallback(() => {
    if (!activeMenu || isSubmittingRef.current) return;

    if (activeMenu.how === 0) {
      safeRespondMenu(0);
      return;
    }

    if (selectedIndices.length > 0) {
      const selectedItems = selectedIndices.map((idx) => activeMenu.items[idx]);
      safeRespondMenu(selectedItems);
    } else if (focusedIndex >= 0 && !activeMenu.items[focusedIndex]?.isHeader) {
      const item = activeMenu.items[focusedIndex];
      safeRespondMenu([item]);
    } else {
      const validItem = activeMenu.items.find(
        (it: MenuItem) => !it.isHeader && it.identifier !== undefined && it.identifier !== 0
      );
      safeRespondMenu(validItem ? [validItem] : 0);
    }
  }, [activeMenu, selectedIndices, focusedIndex, safeRespondMenu]);

  const cancelMenu = useCallback(() => {
    if (isSubmittingRef.current) return;
    safeRespondMenu(0);
  }, [safeRespondMenu]);

  const moveFocus = useCallback(
    (delta: number) => {
      if (!activeMenu || activeMenu.items.length === 0) return;
      const items = activeMenu.items;

      setFocusedIndex((prev) => {
        let nextIdx = prev + delta;
        while (nextIdx >= 0 && nextIdx < items.length) {
          if (!items[nextIdx].isHeader && items[nextIdx].identifier !== 0) {
            setTimeout(() => {
              const focusedEl = menuListRef.current?.querySelector('.focused') as HTMLElement;
              if (focusedEl) focusedEl.scrollIntoView({ block: 'nearest' });
            }, 0);
            return nextIdx;
          }
          nextIdx += delta;
        }
        return prev;
      });
    },
    [activeMenu]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeMenu || isSubmittingRef.current) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(-1);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(1);
        return;
      }

      if (e.key === 'Tab') {
        if (modalContentRef.current) {
          trapFocus(modalContentRef.current, e);
          return;
        }
      }

      if (e.key === 'Escape' || (activeMenu.how === 0 && (e.key === ' ' || e.key === 'Enter'))) {
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

      if (e.key.length === 1 && activeMenu.how !== 0) {
        const pressedKey = e.key;
        const pressedCode = e.key.charCodeAt(0);

        const matchIdx = activeMenu.items.findIndex((it: MenuItem) => {
          if (it.isHeader) return false;
          const c = getAccChar(it);
          if (c && c === pressedKey) return true;
          if (c && c.toLowerCase() === pressedKey.toLowerCase()) return true;
          if (typeof it.accelerator === 'number' && it.accelerator === pressedCode) return true;
          return false;
        });

        if (matchIdx >= 0) {
          e.preventDefault();
          e.stopPropagation();
          const matchItem = activeMenu.items[matchIdx];
          const how = activeMenu.how ?? 1;
          if (how === 1) {
            safeRespondMenu([matchItem]);
          } else {
            handleItemClick(matchIdx, matchItem);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeMenu, cancelMenu, confirmSelection, moveFocus, safeRespondMenu]);

  const modalContentRef = useRef<HTMLDivElement>(null);

  if (!activeMenu) return null;

  return (
    <div className="modal-backdrop">
      <div ref={modalContentRef} className="modal-content">
        <h3 className="modal-title">{activeMenu.prompt || 'Select Item'}</h3>

        <div className="menu-list" ref={menuListRef}>
          {activeMenu.items.map((item, idx) => {
            const accChar = getAccChar(item);
            const tileStyle = getTileStyle(item);
            const isSelected = selectedIndices.includes(idx);
            const isFocused = focusedIndex === idx;

            return (
              <div
                key={idx}
                className={`menu-item-row ${item.isHeader ? 'menu-header' : ''} ${
                  isSelected ? 'selected' : ''
                } ${isFocused ? 'focused' : ''}`}
                onClick={() => handleItemClick(idx, item)}
              >
                {accChar ? <span className="item-acc">{accChar})</span> : null}
                {tileStyle ? <span className="item-tile" style={tileStyle}></span> : null}
                <span className="item-str">{item.str}</span>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          {activeMenu.how === 0 ? (
            <button onClick={cancelMenu} className="btn btn-primary">
              OK (Enter / Space / ESC)
            </button>
          ) : (
            <>
              <button onClick={confirmSelection} className="btn btn-primary">
                OK (Enter)
              </button>
              <button onClick={cancelMenu} className="btn btn-secondary">
                Cancel (ESC)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
