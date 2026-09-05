import { Component, createSignal, createMemo, Show, For } from 'solid-js';
import { gklSituation, currentLanguage, setHoveredTileKnowledge } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';

export const InventoryGrid: Component = () => {
  const [isSyncing, setIsSyncing] = createSignal(false);
  const [hoveredItem, setHoveredItem] = createSignal<any | null>(null);

  const isEn = () => currentLanguage() === 'en';

  const inventory = createMemo(() => {
    return gklSituation()?.inventory || gklSituation()?.playerState?.inventory || { items: [] };
  });

  const items = createMemo(() => {
    return inventory()?.items || [];
  });

  const slotBadges = createMemo(() => {
    return gklSituation()?.assistState?.slotBadges || {};
  });

  const getSlotBadge = (item: any) => {
    const badges = slotBadges();
    return badges ? (badges[item.letter] || badges[item.invlet]) : null;
  };

  const getItemSlotClasses = (item: any) => {
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
  };

  const getBucBadge = (item: any) => {
    const id = item.identification || (item.knowledge && item.knowledge.identification) || {};
    const isUnidentified = !!id.isUnidentified;
    const bucStatus = id.bucStatus || item.bucStatus || 'UNKNOWN';

    if (isUnidentified) {
      return { symbol: '?', className: 'badge-buc-unid', title: isEn() ? 'Unidentified' : '未識別' };
    } else if (bucStatus === 'CURSED') {
      return { symbol: '-', className: 'badge-buc-cursed', title: isEn() ? 'Cursed' : '呪い' };
    } else if (bucStatus === 'BLESSED') {
      return { symbol: '+', className: 'badge-buc-blessed', title: isEn() ? 'Blessed' : '祝福' };
    }
    return null;
  };

  const getItemSymbol = (item: any): string => {
    if (!item) return '📦';
    if (item.isPickAxe) return '⛏️';
    if (item.isDigWand) return '🪄';
    if (item.isKey) return '🗝️';
    if (item.isAxe) return '🪓';
    if (item.isFrostWand) return '❄️';
    if (item.isWielded) return '⚔️';
    if (item.isOffhand) return '🗡️';
    if (item.isQuivered) return '🏹';
    if (item.isWorn) return '🛡️';

    const cat = String(item.category || '').toUpperCase();
    if (cat === 'POTION') return '🧪';
    if (cat === 'SCROLL') return '📜';
    if (cat === 'WAND') return '🪄';
    if (cat === 'RING') return '💍';
    if (cat === 'AMULET') return '🧿';
    if (cat === 'SPELLBOOK') return '📖';
    if (cat === 'FOOD') return '🍖';
    if (cat === 'GOLD') return '💰';
    if (cat === 'WEAPON') return '⚔️';
    if (cat === 'ARMOR') return '🛡️';
    if (cat === 'TOOL') return '🔧';

    return '📦';
  };

  let pressTimer: any = null;
  let isLongPressTriggered = false;

  const handleMouseEnter = (item: any) => {
    setHoveredItem(item);
    setHoveredTileKnowledge(item.knowledge || null);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setHoveredTileKnowledge(null);
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  const handlePointerDown = (item: any, e: PointerEvent) => {
    if (e.button !== 0) return;
    isLongPressTriggered = false;
    pressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      if (navigator.vibrate) navigator.vibrate(25);
      driverController.openItemActionMenu(item.letter);
    }, 400);
  };

  const handlePointerUp = (item: any, e: PointerEvent) => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (!isLongPressTriggered && e.button === 0) {
      handleItemClick(item);
    }
  };

  const handleContextMenu = (item: any, e: MouseEvent) => {
    e.preventDefault();
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    driverController.openItemActionMenu(item.letter);
  };

  const handleItemClick = (item: any) => {
    const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
      ? item.defaultSequence
      : [item.letter];
    driverController.executeSequence(seq);
  };

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await driverController.syncInventorySilent();
    setIsSyncing(false);
  };

  const getSolidGlyphStyle = (glyphId: number) => {
    const core = driverController.getCore();
    if (!core || typeof core.getGlyphStyle !== 'function') return {};
    return core.getGlyphStyle(glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 28 }) || {};
  };

  return (
    <div class="gkl-card inventory-card">
      <div class="gkl-card-header">
        <span>🎒 {isEn() ? 'Inventory' : 'インベントリ (Inventory)'}</span>
        <div class="header-actions">
          <span class="gkl-badge">{items().length}</span>
          <button
            class="btn-small btn-sync"
            disabled={isSyncing()}
            onClick={handleSyncClick}
            title={isEn() ? 'Synchronize inventory' : 'インベントリ同期'}
          >
            {isSyncing() ? '...' : '🔄'}
          </button>
        </div>
      </div>

      <div class="gkl-inventory-grid">
        <Show
          when={items().length > 0}
          fallback={
            <div class="gkl-empty-hint">
              {isEn() ? 'Inventory is empty' : 'インベントリは空です'}
            </div>
          }
        >
          <For each={items()}>
            {(item: any) => {
              const badge = () => getSlotBadge(item);
              const buc = () => getBucBadge(item);
              const styleStr = () => (item.glyphId !== undefined && item.glyphId >= 0)
                ? driverController.getGlyphStyleString(item.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 28 })
                : '';

              return (
                <div
                  class={`gkl-item-slot ${getItemSlotClasses(item)}`}
                  onMouseEnter={() => handleMouseEnter(item)}
                  onMouseLeave={handleMouseLeave}
                  onPointerDown={(e) => handlePointerDown(item, e)}
                  onPointerUp={(e) => handlePointerUp(item, e)}
                  onContextMenu={(e) => handleContextMenu(item, e)}
                  title={`${item.rawText} (${item.letter})`}
                >
                  <span class="gkl-slot-letter">{item.letter}</span>

                  <Show
                    when={styleStr()}
                    fallback={<span class="gkl-slot-icon-text">{getItemSymbol(item)}</span>}
                  >
                    <div class="gkl-slot-icon" style={styleStr()} />
                  </Show>

                  {/* Level 1 Nano Badge */}
                  <Show when={badge()}>
                    <span class={`slot-nano-badge ${badge()?.type || 'info'}`}>
                      {isEn() ? (badge()?.labelEn || badge()?.labelJa) : (badge()?.labelJa || badge()?.labelEn)}
                    </span>
                  </Show>

                  {/* 装備状態バッジ */}
                  <Show when={item.isWielded}>
                    <span class="gkl-slot-equip-badge badge-wielded" title={isEn() ? 'Main weapon' : 'メイン武器'}>
                      {isEn() ? 'Main' : '手'}
                    </span>
                  </Show>
                  <Show when={item.isOffhand}>
                    <span class="gkl-slot-equip-badge badge-offhand" title={isEn() ? 'Off-hand weapon' : '副武器'}>
                      {isEn() ? 'Off' : '副'}
                    </span>
                  </Show>
                  <Show when={item.isQuivered}>
                    <span class="gkl-slot-equip-badge badge-quivered" title={isEn() ? 'Quiver' : '矢筒'}>
                      {isEn() ? 'Quiv' : '筒'}
                    </span>
                  </Show>
                  <Show when={item.isWorn}>
                    <span class="gkl-slot-equip-badge badge-worn" title={isEn() ? 'Worn' : '着用中'}>
                      {isEn() ? 'Worn' : '着'}
                    </span>
                  </Show>

                  {/* 熟練度バッジ */}
                  <Show when={item.skillBadge?.isProficient || item.isRecommendedWeapon}>
                    <span class="gkl-slot-equip-badge badge-proficient" title={isEn() ? 'Proficient weapon' : '得意武器'}>
                      +
                    </span>
                  </Show>

                  {/* BUC (祝福/呪い/未識別) バッジ */}
                  <Show when={buc()}>
                    <span class={`gkl-slot-buc-badge ${buc()?.className}`} title={buc()?.title}>
                      {buc()?.symbol}
                    </span>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* ホバー時のツールチップ概要 */}
      <Show when={hoveredItem()}>
        <div class="gkl-tooltip">
          <div class="title">{hoveredItem()?.rawText}</div>
          <div class="tags">
            <Show when={hoveredItem()?.isWielded}><span class="tag tag-wielded">⚔️ {isEn() ? 'Wielded' : '装備中'}</span></Show>
            <Show when={hoveredItem()?.isOffhand}><span class="tag tag-offhand">🗡️ {isEn() ? 'Off-hand' : '副武器'}</span></Show>
            <Show when={hoveredItem()?.isQuivered}><span class="tag tag-quiver">🏹 {isEn() ? 'Quivered' : '矢筒'}</span></Show>
            <Show when={hoveredItem()?.isWorn}><span class="tag tag-worn">🛡️ {isEn() ? 'Worn' : '着用中'}</span></Show>
            <Show when={hoveredItem()?.defaultActionLabel || hoveredItem()?.defaultActionLabelJa}>
              <span class="tag tag-action">
                💡 {isEn() ? 'Tap:' : 'タップ:'} {isEn() ? (hoveredItem()?.defaultActionLabel || hoveredItem()?.defaultActionLabelJa) : (hoveredItem()?.defaultActionLabelJa || hoveredItem()?.defaultActionLabel)} [{hoveredItem()?.letter}]
              </span>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};
