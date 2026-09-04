import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';

export const InventoryGrid: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<any | null>(null);

  const gklSituation = useGameStore((state) => state.gklSituation);
  const currentLanguage = useGameStore((state) => state.currentLanguage);
  const setHoveredTileKnowledge = useGameStore((state) => state.setHoveredTileKnowledge);

  const {
    getGlyphStyle,
    syncInventorySilent,
    executeSequence,
    openItemActionMenu,
  } = useNetHackDriver();

  const isEn = currentLanguage === 'en';

  const inventory = useMemo(() => {
    return gklSituation?.inventory || gklSituation?.playerState?.inventory || { items: [] };
  }, [gklSituation]);

  const items = useMemo(() => {
    return inventory?.items || [];
  }, [inventory]);

  const slotBadges = useMemo(() => {
    return gklSituation?.assistState?.slotBadges || {};
  }, [gklSituation]);

  const getSlotBadge = useCallback((item: any) => {
    return slotBadges ? (slotBadges[item.letter] || slotBadges[item.invlet]) : null;
  }, [slotBadges]);

  const getItemSlotClasses = useCallback((item: any) => {
    const classes: string[] = [];
    if (item.isWielded) classes.push('is-wielded');
    if (item.isOffhand) classes.push('is-offhand');
    if (item.isQuivered) classes.push('is-quivered');
    if (item.isWorn) classes.push('is-worn');

    const badge = getSlotBadge(item);
    if (badge) {
      const bType = badge.type || 'info';
      if (badge.highlightBorder || bType === 'danger') {
        classes.push(bType === 'danger' ? 'slot-highlight-danger' : 'slot-highlight-gold');
      }
    }

    return classes.join(' ');
  }, [getSlotBadge]);

  const getBucBadge = useCallback((item: any) => {
    const id = item.identification || (item.knowledge && item.knowledge.identification) || {};
    const isUnidentified = !!id.isUnidentified;
    const rawLower = (item.rawText || '').toLowerCase();
    const bucStatus = id.bucStatus || (rawLower.includes('blessed') ? 'BLESSED' : rawLower.includes('cursed') ? 'CURSED' : rawLower.includes('uncursed') ? 'UNCURSED' : 'UNKNOWN');

    if (isUnidentified) {
      return { symbol: '?', className: 'badge-buc-unid', title: isEn ? 'Unidentified' : '未識別' };
    } else if (bucStatus === 'CURSED') {
      return { symbol: '-', className: 'badge-buc-cursed', title: isEn ? 'Cursed' : '呪い' };
    } else if (bucStatus === 'BLESSED') {
      return { symbol: '+', className: 'badge-buc-blessed', title: isEn ? 'Blessed' : '祝福' };
    }
    return null;
  }, [isEn]);

  const getItemSymbol = (item: any): string => {
    if (item.isPickAxe) return '⛏️';
    if (item.isDigWand) return '🪄';
    if (item.isKey) return '🗝️';
    if (item.isAxe) return '🪓';
    if (item.isFrostWand) return '❄️';
    if (item.isWielded) return '⚔️';
    if (item.isOffhand) return '🗡️';
    if (item.isQuivered) return '🏹';
    if (item.isWorn) return '🛡️';

    const text = (item.rawText || '').toLowerCase();
    if (text.includes('potion') || text.includes('薬')) return '🧪';
    if (text.includes('scroll') || text.includes('巻物')) return '📜';
    if (text.includes('wand') || text.includes('杖')) return '🪄';
    if (text.includes('ring') || text.includes('指輪')) return '💍';
    if (text.includes('amulet') || text.includes('魔除け')) return '🧿';
    if (text.includes('spellbook') || text.includes('魔法書')) return '📖';
    if (text.includes('food') || text.includes('ration') || text.includes('corpse') || text.includes('食料') || text.includes('死体')) return '🍖';
    if (text.includes('gold') || text.includes('金貨')) return '💰';
    return '📦';
  };

  const pressTimerRef = useRef<any>(null);
  const isLongPressTriggeredRef = useRef(false);

  const handleMouseEnter = (item: any) => {
    setHoveredItem(item);
    setHoveredTileKnowledge(item.knowledge || null);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const handlePointerDown = (item: any, e: React.PointerEvent) => {
    if (e.button === 2) return;
    isLongPressTriggeredRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      openItemActionMenu(item.letter);
    }, 450);
  };

  const handlePointerUp = (item: any, e: React.PointerEvent) => {
    if (e.button === 2) return;
    clearTimeout(pressTimerRef.current);
    if (!isLongPressTriggeredRef.current) {
      const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
        ? item.defaultSequence
        : [item.letter];
      executeSequence(seq);
    }
  };

  const handlePointerLeave = () => {
    clearTimeout(pressTimerRef.current);
  };

  const handlePointerCancel = () => {
    clearTimeout(pressTimerRef.current);
  };

  const handleContextMenu = (item: any, e: React.MouseEvent) => {
    e.preventDefault();
    clearTimeout(pressTimerRef.current);
    openItemActionMenu(item.letter);
  };

  const handleSyncInventory = async () => {
    setIsSyncing(true);
    try {
      await syncInventorySilent();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="gkl-card inventory-card">
      <div className="gkl-card-header">
        <span>🎒 {isEn ? 'Inventory (Icon Grid)' : '所持品アイテム (Icon Inventory)'}</span>
        <div className="header-actions">
          <button
            className="btn btn-small"
            title={isEn ? 'Sync inventory immediately' : '所持品情報を即座に最新同期'}
            disabled={isSyncing}
            onClick={handleSyncInventory}
          >
            {isSyncing ? '...' : '🔄 同期'}
          </button>
          <span className="gkl-badge">{items.length}</span>
        </div>
      </div>

      <div className="gkl-inventory-grid">
        {items.length === 0 ? (
          <div className="gkl-empty-hint">
            {isEn ? 'Inventory Empty' : 'インベントリ空'}
          </div>
        ) : (
          items.map((item: any) => {
            const badge = getSlotBadge(item);
            const buc = getBucBadge(item);
            return (
              <div
                key={item.letter}
                className={`gkl-item-slot ${getItemSlotClasses(item)}`}
                onMouseEnter={() => handleMouseEnter(item)}
                onMouseLeave={handleMouseLeave}
                onPointerDown={(e) => handlePointerDown(item, e)}
                onPointerUp={(e) => handlePointerUp(item, e)}
                onPointerLeave={handlePointerLeave}
                onPointerCancel={handlePointerCancel}
                onContextMenu={(e) => handleContextMenu(item, e)}
              >
                {/* レター */}
                <span className="gkl-slot-letter">{item.letter}</span>

                {/* スプライトアイコン */}
                {item.glyphId !== undefined && item.glyphId >= 0 ? (
                  <div
                    className="gkl-slot-icon"
                    style={getGlyphStyle(item.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 28 }) || {}}
                  />
                ) : (
                  <span className="gkl-slot-icon-text">{getItemSymbol(item)}</span>
                )}

                {/* Level 1: Nano Badge */}
                {badge && (
                  <span className={`slot-nano-badge ${badge.type || 'info'}`}>
                    {isEn ? (badge.labelEn || badge.labelJa) : (badge.labelJa || badge.labelEn)}
                  </span>
                )}

                {/* 装備状態バッジ */}
                {item.isWielded ? (
                  <span className="gkl-slot-equip-badge badge-wielded" title={isEn ? 'Main weapon' : 'メイン武器'}>
                    {isEn ? 'Main' : '手'}
                  </span>
                ) : item.isOffhand ? (
                  <span className="gkl-slot-equip-badge badge-offhand" title={isEn ? 'Off-hand weapon' : '副武器'}>
                    {isEn ? 'Off' : '副'}
                  </span>
                ) : item.isQuivered ? (
                  <span className="gkl-slot-equip-badge badge-quivered" title={isEn ? 'Quiver' : '矢筒'}>
                    {isEn ? 'Quiv' : '筒'}
                  </span>
                ) : item.isWorn ? (
                  <span className="gkl-slot-equip-badge badge-worn" title={isEn ? 'Worn' : '着用中'}>
                    {isEn ? 'Worn' : '着'}
                  </span>
                ) : null}

                {/* 得意武器適性バッジ (+) */}
                {(item.skillBadge?.isProficient || item.isRecommendedWeapon) && (
                  <span
                    className="gkl-slot-equip-badge badge-proficient"
                    title={isEn ? 'Proficient weapon' : '得意武器'}
                  >
                    +
                  </span>
                )}

                {/* BUC 状態バッジ */}
                {buc && (
                  <span
                    className={`gkl-slot-buc-badge ${buc.className}`}
                    title={buc.title}
                  >
                    {buc.symbol}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ホバーツールチップ */}
      {hoveredItem && (
        <div className="gkl-tooltip">
          <div className="title">{hoveredItem.rawText || hoveredItem.name}</div>
          <div className="tags">
            {hoveredItem.isWielded && <span className="tag tag-wielded">{isEn ? 'Main weapon' : '手持ち武器'}</span>}
            {hoveredItem.isOffhand && <span className="tag tag-offhand">{isEn ? 'Off-hand' : '副武器'}</span>}
            {hoveredItem.isQuivered && <span className="tag tag-quiver">{isEn ? 'Quiver' : '矢筒'}</span>}
            {hoveredItem.isWorn && <span className="tag tag-worn">{isEn ? 'Worn' : '着用中'}</span>}
            {(hoveredItem.knowledge?.actionLabel || hoveredItem.defaultActionLabel) && (
              <span className="tag tag-action">
                {isEn ? 'One-Tap:' : 'ワンタップ:'} {hoveredItem.knowledge?.actionLabel || hoveredItem.defaultActionLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
