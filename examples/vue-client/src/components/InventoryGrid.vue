<template>
  <div class="gkl-card inventory-card">
    <div class="gkl-card-header">
      <span>🎒 {{ isEn ? 'Inventory (Icon Grid)' : '所持品アイテム (Icon Inventory)' }}</span>
      <div class="header-actions">
        <button
          class="btn btn-small"
          :title="isEn ? 'Sync inventory immediately' : '所持品情報を即座に最新同期'"
          :disabled="isSyncing"
          @click="handleSyncInventory"
        >
          {{ isSyncing ? '...' : '🔄 同期' }}
        </button>
        <span class="gkl-badge">{{ items.length }}</span>
      </div>
    </div>

    <div class="gkl-inventory-grid">
      <div v-if="items.length === 0" class="gkl-empty-hint">
        {{ isEn ? 'Inventory Empty' : 'インベントリ空' }}
      </div>

      <div
        v-for="item in items"
        :key="item.letter"
        class="gkl-item-slot"
        :class="getItemSlotClasses(item)"
        @mouseenter="handleMouseEnter(item, $event)"
        @mouseleave="handleMouseLeave"
        @pointerdown="(e) => handlePointerDown(item, e)"
        @pointerup="(e) => handlePointerUp(item, e)"
        @pointerleave="handlePointerLeave(item)"
        @pointercancel="handlePointerCancel(item)"
        @contextmenu.prevent="(e) => handleContextMenu(item, e)"
      >
        <!-- レター -->
        <span class="gkl-slot-letter">{{ item.letter }}</span>

        <!-- スプライトアイコン -->
        <div
          v-if="item.glyphId !== undefined && item.glyphId >= 0"
          class="gkl-slot-icon"
          :style="getGlyphStyle(item.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 28 })"
        ></div>
        <span v-else class="gkl-slot-icon-text">{{ getItemSymbol(item) }}</span>

        <!-- Level 1: Nano Badge -->
        <span
          v-if="getSlotBadge(item)"
          class="slot-nano-badge"
          :class="getSlotBadge(item)?.type || 'info'"
        >
          {{ isEn ? (getSlotBadge(item)?.labelEn || getSlotBadge(item)?.labelJa) : (getSlotBadge(item)?.labelJa || getSlotBadge(item)?.labelEn) }}
        </span>

        <!-- 装備状態バッジ -->
        <span v-if="item.isWielded" class="gkl-slot-equip-badge badge-wielded" :title="isEn ? 'Main weapon' : 'メイン武器'">{{ isEn ? 'Main' : '手' }}</span>
        <span v-else-if="item.isOffhand" class="gkl-slot-equip-badge badge-offhand" :title="isEn ? 'Off-hand weapon' : '副武器'">{{ isEn ? 'Off' : '副' }}</span>
        <span v-else-if="item.isQuivered" class="gkl-slot-equip-badge badge-quivered" :title="isEn ? 'Quiver' : '矢筒'">{{ isEn ? 'Quiv' : '筒' }}</span>
        <span v-else-if="item.isWorn" class="gkl-slot-equip-badge badge-worn" :title="isEn ? 'Worn' : '着用中'">{{ isEn ? 'Worn' : '着' }}</span>

        <!-- 得意武器適性バッジ (+) -->
        <span
          v-if="item.skillBadge?.isProficient || item.isRecommendedWeapon"
          class="gkl-slot-equip-badge badge-proficient"
          :title="isEn ? 'Proficient weapon' : '得意武器'"
        >+</span>

        <!-- BUC 状態バッジ -->
        <span
          v-if="getBucBadge(item)"
          class="gkl-slot-buc-badge"
          :class="getBucBadge(item)?.className"
          :title="getBucBadge(item)?.title"
        >
          {{ getBucBadge(item)?.symbol }}
        </span>
      </div>
    </div>

    <!-- ホバーツールチップ -->
    <div
      v-if="hoveredItem"
      class="gkl-tooltip"
      :style="tooltipStyle"
    >
      <div class="title">{{ hoveredItem.rawText || hoveredItem.name }}</div>
      <div class="tags">
        <span v-if="hoveredItem.isWielded" class="tag tag-wielded">{{ isEn ? 'Main weapon' : '手持ち武器' }}</span>
        <span v-if="hoveredItem.isOffhand" class="tag tag-offhand">{{ isEn ? 'Off-hand' : '副武器' }}</span>
        <span v-if="hoveredItem.isQuivered" class="tag tag-quiver">{{ isEn ? 'Quiver' : '矢筒' }}</span>
        <span v-if="hoveredItem.isWorn" class="tag tag-worn">{{ isEn ? 'Worn' : '着用中' }}</span>

        <span
          v-if="hoveredItem.knowledge?.actionLabel || hoveredItem.defaultActionLabel"
          class="tag tag-action"
        >
          {{ isEn ? 'One-Tap:' : 'ワンタップ:' }} {{ hoveredItem.knowledge?.actionLabel || hoveredItem.defaultActionLabel }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { storeToRefs } from 'pinia';

const gameStore = useGameStore();
const { gklSituation } = storeToRefs(gameStore);
const {
  currentLanguage,
  getGlyphStyle,
  syncInventorySilent,
  executeSequence,
  openItemActionMenu
} = useNetHackDriver();

const isSyncing = ref(false);
const hoveredItem = ref<any | null>(null);
const tooltipStyle = ref({ top: '0px', left: '0px' });

const isEn = computed(() => currentLanguage.value === 'en');

const inventory = computed(() => {
  return gklSituation.value?.inventory || gklSituation.value?.playerState?.inventory || { items: [] };
});

const items = computed(() => {
  return inventory.value?.items || [];
});

const slotBadges = computed(() => {
  return gklSituation.value?.assistState?.slotBadges || {};
});

function getSlotBadge(item: any) {
  const badges = slotBadges.value;
  return badges ? (badges[item.letter] || badges[item.invlet]) : null;
}

function getItemSlotClasses(item: any) {
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

  return classes;
}

function getBucBadge(item: any) {
  const id = item.identification || (item.knowledge && item.knowledge.identification) || {};
  const isUnidentified = !!id.isUnidentified;
  const rawLower = (item.rawText || '').toLowerCase();
  const bucStatus = id.bucStatus || (rawLower.includes('blessed') ? 'BLESSED' : rawLower.includes('cursed') ? 'CURSED' : rawLower.includes('uncursed') ? 'UNCURSED' : 'UNKNOWN');

  if (isUnidentified) {
    return { symbol: '?', className: 'badge-buc-unid', title: isEn.value ? 'Unidentified' : '未識別' };
  } else if (bucStatus === 'CURSED') {
    return { symbol: '-', className: 'badge-buc-cursed', title: isEn.value ? 'Cursed' : '呪い' };
  } else if (bucStatus === 'BLESSED') {
    return { symbol: '+', className: 'badge-buc-blessed', title: isEn.value ? 'Blessed' : '祝福' };
  }
  return null;
}

function getItemSymbol(item: any): string {
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
}

function handleMouseEnter(item: any, e: MouseEvent) {
  hoveredItem.value = item;
  gameStore.setHoveredTileKnowledge(item.knowledge || null);
}

function handleMouseLeave() {
  hoveredItem.value = null;
}

// 長押しタイマー管理
let pressTimer: any = null;
let isLongPressTriggered = false;

function handlePointerDown(item: any, e: PointerEvent) {
  if (e.button === 2) return;
  isLongPressTriggered = false;
  pressTimer = setTimeout(() => {
    isLongPressTriggered = true;
    openItemActionMenu(item.letter);
  }, 450);
}

function handlePointerUp(item: any, e: PointerEvent) {
  if (e.button === 2) return;
  clearTimeout(pressTimer);
  if (!isLongPressTriggered) {
    const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
      ? item.defaultSequence
      : [item.letter];
    executeSequence(seq);
  }
}

function handlePointerLeave(item: any) {
  clearTimeout(pressTimer);
}

function handlePointerCancel(item: any) {
  clearTimeout(pressTimer);
}

function handleContextMenu(item: any, e: MouseEvent) {
  clearTimeout(pressTimer);
  openItemActionMenu(item.letter);
}

async function handleSyncInventory() {
  isSyncing.value = true;
  try {
    await syncInventorySilent();
  } finally {
    isSyncing.value = false;
  }
}
</script>

<style scoped>
.gkl-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.gkl-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-small {
  background: #334155;
  color: #cbd5e1;
  border: 1px solid #475569;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-small:hover:not(:disabled) {
  background: #475569;
  color: #ffffff;
}

.gkl-badge {
  background: #38bdf8;
  color: #0f172a;
  font-size: 11px;
  font-weight: bold;
  padding: 1px 6px;
  border-radius: 10px;
}

.gkl-inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
  padding: 10px;
  max-height: 220px;
  overflow-y: auto;
}

.gkl-empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  color: #64748b;
  font-size: 12px;
  padding: 16px 0;
}

.gkl-item-slot {
  position: relative;
  width: 44px;
  height: 44px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  transition: transform 0.1s, border-color 0.2s, box-shadow 0.2s;
}

.gkl-item-slot:hover {
  border-color: #38bdf8;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(56, 189, 248, 0.2);
}

.gkl-item-slot.is-wielded {
  border-color: #f59e0b;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
}

.gkl-item-slot.is-worn {
  border-color: #a855f7;
}

.gkl-item-slot.is-quivered {
  border-color: #10b981;
}

.gkl-item-slot.is-offhand {
  border-color: #06b6d4;
}

.slot-highlight-gold {
  border-color: #facc15 !important;
  animation: pulse-gold 1.2s infinite;
}

.slot-highlight-danger {
  border-color: #ef4444 !important;
  animation: pulse-danger 1s infinite;
}

@keyframes pulse-gold {
  0% { box-shadow: 0 0 3px #facc15; }
  50% { box-shadow: 0 0 10px #facc15; }
  100% { box-shadow: 0 0 3px #facc15; }
}

@keyframes pulse-danger {
  0% { box-shadow: 0 0 3px #ef4444; }
  50% { box-shadow: 0 0 10px #ef4444; }
  100% { box-shadow: 0 0 3px #ef4444; }
}

.gkl-slot-letter {
  position: absolute;
  top: 2px;
  left: 3px;
  font-size: 9px;
  font-family: monospace;
  font-weight: bold;
  color: #94a3b8;
}

.gkl-slot-icon {
  width: 28px;
  height: 28px;
}

.gkl-slot-icon-text {
  font-size: 18px;
}

.slot-nano-badge {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 8px;
  font-weight: 800;
  padding: 1px 3px;
  border-radius: 3px;
  white-space: nowrap;
  z-index: 5;
}

.slot-nano-badge.danger {
  background: #dc2626;
  color: #ffffff;
}

.slot-nano-badge.warning {
  background: #d97706;
  color: #ffffff;
}

.slot-nano-badge.info {
  background: #2563eb;
  color: #ffffff;
}

.gkl-slot-equip-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 8px;
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 3px;
}

.badge-wielded { background: #f59e0b; color: #000; }
.badge-offhand { background: #06b6d4; color: #000; }
.badge-quivered { background: #10b981; color: #000; }
.badge-worn { background: #a855f7; color: #fff; }
.badge-proficient { background: #22c55e; color: #000; font-weight: bold; left: 16px; right: auto; }

.gkl-slot-buc-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 9px;
  font-weight: bold;
  width: 12px;
  height: 12px;
  line-height: 12px;
  text-align: center;
  border-radius: 50%;
}

.badge-buc-unid { background: #64748b; color: #ffffff; }
.badge-buc-cursed { background: #dc2626; color: #ffffff; }
.badge-buc-blessed { background: #10b981; color: #ffffff; }

.gkl-tooltip {
  padding: 8px 12px;
  background: #090916;
  border-top: 1px solid #334155;
  font-size: 12px;
}

.gkl-tooltip .title {
  font-weight: bold;
  color: #f1f5f9;
  margin-bottom: 4px;
}

.gkl-tooltip .tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.tag-wielded { background: #f59e0b; color: #000; }
.tag-offhand { background: #06b6d4; color: #000; }
.tag-quiver { background: #10b981; color: #000; }
.tag-worn { background: #a855f7; color: #fff; }
.tag-action { background: #2563eb; color: #fff; }
</style>
