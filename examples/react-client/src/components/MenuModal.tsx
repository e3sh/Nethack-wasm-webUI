import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore, MenuItem } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';
import { getTileMapping } from '../utils/tileMapping';

export const MenuModal: React.FC = () => {
  const activeMenu = useGameStore((state) => state.activeMenu);
  const { respondMenu } = useNetHackDriver();

  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const isSubmittingRef = useRef(false);
  const tileMapTableRef = useRef<Record<number, number>>({});

  useEffect(() => {
    tileMapTableRef.current = getTileMapping();
  }, []);

  useEffect(() => {
    if (activeMenu) {
      setSelectedIndices([]);
      isSubmittingRef.current = false;
    }
  }, [activeMenu]);

  const getAccChar = (item: MenuItem): string => {
    if (item.isHeader) return '';
    const ch = item.accelerator || item.ch;
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
    } else {
      const validItem = activeMenu.items.find(
        (it: MenuItem) => !it.isHeader && it.identifier !== undefined && it.identifier !== 0
      );
      safeRespondMenu(validItem ? [validItem] : 0);
    }
  }, [activeMenu, selectedIndices, safeRespondMenu]);

  const cancelMenu = useCallback(() => {
    if (isSubmittingRef.current) return;
    safeRespondMenu(0);
  }, [safeRespondMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeMenu || isSubmittingRef.current) return;

      if (e.key === 'Escape' || e.key === ' ' || (activeMenu.how === 0 && e.key === 'Enter')) {
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
        const matchItem = activeMenu.items.find((it: MenuItem) => {
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
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeMenu, cancelMenu, confirmSelection, safeRespondMenu]);

  if (!activeMenu) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3 className="modal-title">{activeMenu.prompt || 'Select Item'}</h3>

        <div className="menu-list">
          {activeMenu.items.map((item, idx) => {
            const accChar = getAccChar(item);
            const tileStyle = getTileStyle(item);
            const isSelected = selectedIndices.includes(idx);

            return (
              <div
                key={idx}
                className={`menu-item-row ${item.isHeader ? 'menu-header' : ''} ${
                  isSelected ? 'selected' : ''
                }`}
                onClick={() => handleItemClick(idx, item)}
              >
                {/* 1. アクセラレータキー (a), b), c)...) */}
                {accChar ? <span className="item-acc">{accChar})</span> : null}

                {/* 2. 正確な CSS Sprite タイル表示 */}
                {tileStyle ? <span className="item-tile" style={tileStyle}></span> : null}

                {/* 3. アイテム文字列 */}
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
