<template>
  <div class="gkl-panel">
    <!-- 1. ヘッダー ＆ ステータス同期 ＆ 🚨 危機点滅バッジ -->
    <div class="gkl-header">
      <div class="gkl-title-box">
        <span class="gkl-badge">{{ isEn ? '🧠 GKL Situation Reasoning & Knowledge Assist' : '🧠 GKL 状況推論 ＆ ナレッジアシスト' }}</span>
        <span v-if="hasCriticalAdvice" class="crisis-badge" style="background:#e74c3c; color:#ffffff; font-weight:bold; font-size:11px; padding:3px 8px; border-radius:4px; animation:pulse 1s infinite;">
          🚨 {{ isEn ? 'CRITICAL CRISIS' : '危機警告' }}
        </span>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button @click="handleSyncInventory" class="btn-sync" :disabled="isSyncing">
            {{ isSyncing ? (isEn ? '...Syncing' : '...同期中') : (isEn ? '🔄 Sync Inventory' : '🔄 インベントリ同期') }}
          </button>
          <button @click="handleSyncSkills" class="btn-sync" :title="isEn ? 'Sync Skills (#enhance)' : 'スキル同期 (#enhance)'">
            {{ isEn ? '🥋 Sync Skills' : '🥋 スキル同期' }}
          </button>
          <button @click="handleSyncSpells" class="btn-sync" :title="isEn ? 'Sync Spells (+)' : '習得魔法同期 (+)'">
            {{ isEn ? '📖 Sync Spells' : '📖 魔法同期' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 🛡️ TacticalAdvisor 戦術アドバイス一覧 -->
    <div v-if="tacticalAdvices.length > 0" class="tactical-advices-box" style="background:#1c212d; border-left:4px solid #00e676; border-radius:4px; padding:8px 12px; display:flex; flex-direction:column; gap:4px;">
      <div style="font-size:11px; font-weight:bold; color:#00e676; display:flex; alignItems:center; gap:6px;">
        <span>🛡️ {{ isEn ? 'Tactical Advisor Recommendations' : '戦術アドバイザー推奨' }}</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px; font-size:11px; color:#e5e9f0;">
        <div
          v-for="(adv, idx) in tacticalAdvices"
          :key="idx"
          :style="{ color: (adv.isCritical || adv.severity === 'CRITICAL') ? '#ff6b6b' : '#e5e9f0', fontWeight: (adv.isCritical || adv.severity === 'CRITICAL') ? 'bold' : 'normal' }"
        >
          {{ (adv.isCritical || adv.severity === 'CRITICAL') ? '⚠️ ' : '💡 ' }}{{ typeof adv === 'string' ? adv : (adv.text || adv.message || adv.advice || adv.label || '') }}
        </div>
      </div>
    </div>

    <!-- 1.5 🥋 スキル・📖 魔法・🛡️ 属性耐性 総合ステータスバー -->
    <div class="gkl-status-overview-panel">
      <!-- 🛡️ 属性・固有耐性 -->
      <div class="gkl-overview-row">
        <strong class="overview-label">{{ isEn ? '🛡️ Resistances:' : '🛡️ 属性耐性:' }}</strong>
        <div v-if="activeAttributes.length > 0" class="overview-badges-list">
          <span
            v-for="attr in activeAttributes"
            :key="attr.key"
            class="gkl-attr-badge active"
            :title="`${attr.label} / ${attr.en} (有効)`"
          >
            {{ attr.displayLabel }}
          </span>
        </div>
        <span v-else class="overview-empty">{{ isEn ? 'None' : 'なし' }}</span>
      </div>

      <!-- 🥋 スキル熟練度 -->
      <div class="gkl-overview-row">
        <strong class="overview-label">{{ isEn ? '🥋 Skills:' : '🥋 スキル:' }}</strong>
        <div v-if="activeSkills.length > 0" class="overview-badges-list">
          <span
            v-for="skill in activeSkills"
            :key="skill.name"
            class="gkl-skill-badge"
            :class="[`gkl-skill-badge-${skill.rank?.key || 'basic'}`, { 'gkl-skill-badge-enhanceable': skill.canEnhance }]"
            :title="skill.rawText || skill.name"
            @click="handleEnhanceSkill(skill)"
          >
            <span v-if="skill.canEnhance" class="skill-star">⭐</span>
            <strong>{{ skill.name }}</strong> [{{ (isEn ? (skill.rank?.en || skill.rank?.label) : (skill.rank?.label || skill.rank?.en)) || (isEn ? 'Basic' : '入門') }}]
          </span>
        </div>
        <span v-else class="overview-empty">{{ isSkillsSynced ? (isEn ? 'None (Unskilled)' : 'なし (未熟)') : (isEn ? 'Not Synced' : '未同期') }}</span>
      </div>

      <!-- 📖 習得魔法 -->
      <div class="gkl-overview-row">
        <strong class="overview-label">{{ isEn ? '📖 Spells:' : '📖 習得魔法:' }}</strong>
        <div v-if="activeSpells.length > 0" class="overview-badges-list">
          <button
            v-for="sp in activeSpells"
            :key="sp.letter"
            class="gkl-spell-badge"
            :title="`Key: ${sp.letter}, Lv.${sp.level} ${sp.category} (Fail: ${sp.failRate})`"
            @click="handleCastSpell(sp.letter)"
          >
            ✨ [{{ sp.letter }}] {{ sp.name }} <small>(Lv.{{ sp.level }} {{ sp.failRate }})</small>
          </button>
        </div>
        <span v-else class="overview-empty">{{ isEn ? 'None' : 'なし' }}</span>
      </div>
    </div>

    <!-- 2. 所持品インベントリ（アイコン即時実行 ＋ フローティング解説ポップアップ） -->
    <div v-if="inventoryItems.length > 0" class="gkl-section">
      <div class="section-title">
        <span>{{ isEn ? `🎒 Inventory Guide (${inventoryItems.length} items)` : `🎒 所持品ナレッジ・ガイド (${inventoryItems.length}個)` }}</span>
        <span class="sub-hint">{{ isEn ? '※ Tap: One-tap use / Long-press or Right-click: Action Menu' : '※ タップ: 即時使用 / 長押し・右クリック: アクションメニュー' }}</span>
      </div>

      <div class="gkl-inventory-grid">
        <div
          v-for="item in inventoryItems"
          :key="item.letter"
          class="inv-item-card"
          :class="getEquipBorderClass(item)"
          style="user-select: none;"
          @pointerdown="(e) => handleItemPointerDown(item, e)"
          @pointerup="(e) => handleItemPointerUp(item, e)"
          @pointerleave="handleItemPointerLeave(item)"
          @pointercancel="handleItemPointerCancel(item)"
          @contextmenu.prevent="(e) => handleItemContextMenu(item, e)"
          @mouseenter="hoveredItem = item"
        >
          <!-- 普段の表示: レター + スプライト画像 + 装備文字バッジ + 得意武器バッジ -->
          <div class="inv-item-compact">
            <span class="inv-letter">[{{ item.letter }}]</span>
            <div
              v-if="item.glyphId !== undefined && item.glyphId >= 0"
              class="inv-glyph-icon"
              :style="getGlyphStyle(item.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 24 })"
            ></div>
            <span v-if="item.isWielded" class="equip-badge badge-wielded" :title="isEn ? 'Main weapon' : 'メイン武器'">{{ isEn ? 'Main' : '手' }}</span>
            <span v-else-if="item.isOffhand" class="equip-badge badge-offhand" :title="isEn ? 'Off-hand weapon' : '副武器'">{{ isEn ? 'Off' : '副' }}</span>
            <span v-else-if="item.isQuivered" class="equip-badge badge-quivered" :title="isEn ? 'Quiver' : '矢筒'">{{ isEn ? 'Quiv' : '筒' }}</span>
            <span v-else-if="item.isWorn" class="equip-badge badge-worn" :title="isEn ? 'Worn' : '着用中'">{{ isEn ? 'Worn' : '着' }}</span>

            <!-- 🥋 得意武器適性バッジ (+) -->
            <span
              v-if="item.skillBadge?.isProficient || item.isRecommendedWeapon"
              class="equip-badge badge-proficient"
              :title="`Proficient (${item.skillBadge?.label || '+'})`"
            >+</span>
          </div>

          <!-- 💡 フローティング解説ポップアップ -->
          <div v-if="hoveredItem?.letter === item.letter" class="inv-floating-popover">
            <div class="popover-title">{{ item.knowledge?.name || item.name || item.rawText }}</div>
            <div v-if="item.knowledge?.actionLabel || item.defaultActionLabel" class="popover-action">
              💡 {{ isEn ? 'One-Tap:' : 'ワンタップ:' }} {{ item.knowledge?.actionLabel || item.defaultActionLabel }} [{{ item.letter }}]
            </div>
            <div style="font-size:9px; color:#88c0d0; opacity:0.8;">
              🖱️ {{ isEn ? 'Long-press / Right-click: Menu' : '長押し / 右クリック: メニュー' }}
            </div>
            <div v-if="item.skillBadge?.label" class="popover-skill" style="font-size:10px; color:#22c55e; font-weight:bold;">
              🥋 {{ isEn ? 'Weapon Skill:' : '武器適性:' }} {{ item.skillBadge.label }}
            </div>
            <div v-if="item.knowledge?.effectSummary || item.knowledge?.description" class="popover-desc">
              {{ item.knowledge?.effectSummary || item.knowledge?.description }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 🧠 🎯 方向フィルター ＆ 🔍 7x7 高精細ズームビューア -->
    <div class="gkl-section">
      <div class="section-title-row">
        <span class="section-title">{{ isEn ? '🎯 Action Filters & 🔍 7x7 Zoom Camera' : '🎯 アクションフィルター ＆ 🔍 7x7 ダンジョンズームカメラ' }}</span>
        <span class="filter-status-text">{{ isEn ? 'Filter:' : '表示:' }} {{ currentFilterLabel }}</span>
      </div>

      <div class="gkl-controls-row">
        <!-- 左側: 🎯 D-Pad 8方向操作フィルター -->
        <div class="control-box dpad-box">
          <div class="box-title">{{ isEn ? '🎯 Direction Filter' : '🎯 方向フィルター' }}</div>
          <div class="dpad-grid">
            <button
              v-for="dp in dpadButtons"
              :key="dp.id"
              class="btn-dpad"
              :class="{
                active: selectedDir === dp.id,
                'has-action': getActionCountForDir(dp.id) > 0,
                'dir-center': dp.id === 'DIR_SELF',
                'dir-n': dp.id === 'DIR_N',
                'dir-s': dp.id === 'DIR_S',
                'dir-w': dp.id === 'DIR_W',
                'dir-e': dp.id === 'DIR_E',
                'dir-nw': dp.id === 'DIR_NW',
                'dir-ne': dp.id === 'DIR_NE',
                'dir-sw': dp.id === 'DIR_SW',
                'dir-se': dp.id === 'DIR_SE'
              }"
              @click="selectedDir = dp.id"
              :title="`${dp.label}`"
            >
              <span class="dpad-icon">{{ dp.icon }}</span>
              <span class="dpad-label">{{ dp.label }}</span>
              <span v-if="getActionCountForDir(dp.id) > 0" class="dpad-count-badge">
                {{ getActionCountForDir(dp.id) }}
              </span>
            </button>
          </div>
          <button
            @click="selectedDir = 'ALL'"
            class="btn-dpad-all"
            :class="{ active: selectedDir === 'ALL' }"
          >
            {{ isEn ? 'Show All (ALL)' : '全表示 (ALL)' }}
          </button>
        </div>

        <!-- 右側: 🔍 7x7 洗練ズームミニマップビューア -->
        <div class="control-box zoom-box">
          <div class="box-title">{{ isEn ? '🔍 7x7 Dungeon Zoom Camera' : '🔍 7x7 ダンジョンズームカメラ' }}</div>

          <div class="zoom-grid">
            <div
              v-for="(tile, idx) in zoomTiles"
              :key="idx"
              class="zoom-cell"
              :class="{ 'player-cell': tile.isPlayer, 'selected-cell': selectedAreaTile?.x === tile.x && selectedAreaTile?.y === tile.y }"
              @click="handleSelectZoomTile(tile)"
              @mouseenter="hoveredAreaTile = tile"
              @mouseleave="hoveredAreaTile = null"
              :title="`${tile.name || tile.nameJa} (${tile.x}, ${tile.y})`"
            >
              <div
                v-if="tile.glyphId >= 0"
                class="zoom-sprite"
                :style="getGlyphStyle(tile.glyphId, { tileImage: './pict/nethack_default_32.png', tileSize: 32, displaySize: 22 })"
              ></div>
              <span v-else class="zoom-symbol">{{ tile.symbol }}</span>
            </div>
          </div>

          <div class="zoom-status-bar">
            <span>{{ activeTileInfo }}</span>
          </div>
        </div>
      </div>

      <!-- アクションボタンリスト -->
      <div v-if="filteredActions.length > 0" class="gkl-actions">
        <button
          v-for="(act, idx) in filteredActions"
          :key="idx"
          @click="handleExecuteAction(act)"
          class="gkl-btn"
          :class="getActionClass(act)"
          :title="act.description || act.label"
        >
          <span v-if="act.key || act.verbKey || act.charStr" class="gkl-key">
            [{{ act.key || act.verbKey || act.charStr }}]
          </span>
          <span>{{ act.label }}</span>
          <span v-if="extractDirectionCode(act) !== 'NONE'" class="gkl-dir-badge">
            ({{ extractDirectionCode(act) }})
          </span>
        </button>
      </div>
      <div v-else class="gkl-empty">
        <span>{{ selectedDir === 'ALL' ? (isEn ? 'Idle (No special targets around / Can move)' : '待機中 (周りに特殊対象なし / 移動可能)') : (isEn ? `No recommended actions in ${currentFilterLabel}` : `${currentFilterLabel} 方向に推奨アクションはありません`) }}</span>
      </div>
    </div>

    <!-- 4. 💡 構造化ナレッジカード -->
    <div v-if="activeKnowledge" class="gkl-knowledge-detail">
      <div class="detail-header">
        <span class="detail-name">
          {{ activeKnowledge.name }}
          <span v-if="activeKnowledge.nameEn && activeKnowledge.nameEn !== activeKnowledge.name" class="detail-subname">
            ({{ activeKnowledge.nameEn }})
          </span>
        </span>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span v-if="getDangerBadgeInfo(activeKnowledge.dangerLevel)"
                :style="{ color: getDangerBadgeInfo(activeKnowledge.dangerLevel)!.color, background: getDangerBadgeInfo(activeKnowledge.dangerLevel)!.bg, border: `1px solid ${getDangerBadgeInfo(activeKnowledge.dangerLevel)!.border}` }"
                class="danger-level-badge">
            {{ getDangerBadgeInfo(activeKnowledge.dangerLevel)!.label }}
          </span>
          <span class="detail-cat">{{ getItemCategoryLabel(activeKnowledge.category || activeKnowledge.type) }}</span>
        </div>
      </div>
      <div class="detail-body">
        <!-- 👾 モンスター専用ステータス -->
        <div v-if="activeKnowledge.category === 'MONSTER' || activeKnowledge.type === 'MONSTER'" class="monster-stats-grid">
          <span v-if="activeKnowledge.stats?.hd !== undefined" class="stat-pill">HD: <strong>{{ activeKnowledge.stats.hd }}</strong></span>
          <span v-if="activeKnowledge.stats?.ac !== undefined" class="stat-pill">AC: <strong>{{ activeKnowledge.stats.ac }}</strong></span>
          <span v-if="activeKnowledge.stats?.speed !== undefined" class="stat-pill">Speed: <strong>{{ activeKnowledge.stats.speed }}</strong></span>
          <span v-if="activeKnowledge.stats?.mr !== undefined" class="stat-pill">MR: <strong>{{ activeKnowledge.stats.mr }}</strong></span>
        </div>

        <!-- 🎒 アイテム全カテゴリ適応型スペックバッジ (武器/防具/杖/巻物/魔法書/食料/道具/指輪/アミュレット等) -->
        <div v-else-if="adaptiveSpecs.length > 0" class="adaptive-specs-grid">
          <span
            v-for="s in adaptiveSpecs"
            :key="s.id"
            class="spec-badge"
            :class="{ 'spec-highlight': s.highlight }"
          >
            <span class="spec-label">{{ s.label }}:</span>
            <strong class="spec-value">{{ s.value }}</strong>
            <span v-if="s.skillBadge" class="spec-skill-badge">{{ s.skillBadge.label }}</span>
          </span>
        </div>

        <!-- 💡 おすすめワンタップ操作表示 -->
        <p v-if="activeKnowledge.actionLabel" class="detail-text monster-detail-row" style="color: #a3be8c !important;">
          💡 <strong>{{ isEn ? 'Recommended Action:' : 'おすすめ操作:' }}</strong> {{ activeKnowledge.actionLabel }}
        </p>

        <!-- 攻撃方法 ＆ 耐性 (モンスター) -->
        <p v-if="formatAttacks(activeKnowledge.attacks)" class="detail-text monster-detail-row">
          🗡️ <strong>{{ isEn ? 'Attacks:' : '攻撃パターン:' }}</strong> {{ formatAttacks(activeKnowledge.attacks) }}
        </p>
        <p v-if="formatResistances(activeKnowledge.resistances)" class="detail-text monster-detail-row">
          🛡️ <strong>{{ isEn ? 'Resistances:' : '固有耐性:' }}</strong> {{ formatResistances(activeKnowledge.resistances) }}
        </p>

        <!-- ⚖️ BUC効果 (アイテム) -->
        <div v-if="activeKnowledge.bucEffects" class="buc-effects-box">
          <div class="buc-title">⚖️ {{ isEn ? 'BUC Effects:' : 'BUC効果:' }}</div>
          <ul class="buc-list">
            <li v-if="activeKnowledge.bucEffects.blessed" style="color: #2ecc71;"><strong>{{ isEn ? 'Blessed:' : '祝福:' }}</strong> {{ activeKnowledge.bucEffects.blessed }}</li>
            <li v-if="activeKnowledge.bucEffects.uncursed" style="color: #cbd5e1;"><strong>{{ isEn ? 'Uncursed:' : '通常:' }}</strong> {{ activeKnowledge.bucEffects.uncursed }}</li>
            <li v-if="activeKnowledge.bucEffects.cursed" style="color: #e74c3c;"><strong>{{ isEn ? 'Cursed:' : '呪い:' }}</strong> {{ activeKnowledge.bucEffects.cursed }}</li>
          </ul>
        </div>

        <!-- 効果解説 ＆ フレーバーテキスト -->
        <p v-if="activeKnowledge.effectSummary" class="detail-text">💡 {{ activeKnowledge.effectSummary }}</p>
        <p v-if="activeKnowledge.description || activeKnowledge.flavorNote" class="detail-text" style="opacity: 0.9;">
          📖 {{ activeKnowledge.description || activeKnowledge.flavorNote }}
        </p>

        <!-- 🔍 未識別識別Tips -->
        <div v-if="activeKnowledge.unidentifiedTips && activeKnowledge.unidentifiedTips.length > 0" class="unid-tips-box">
          <div class="unid-title">🔍 {{ isEn ? 'Identification Tips:' : '識別Tips:' }}</div>
          <ul class="advice-list">
            <li v-for="(tip, idx) in activeKnowledge.unidentifiedTips" :key="idx">{{ tip }}</li>
          </ul>
        </div>

        <!-- モンスター戦術 ＆ アイテムアドバイス -->
        <div v-if="(activeKnowledge.tacticalAdvice && activeKnowledge.tacticalAdvice.length > 0) || (activeKnowledge.usageAdvice && activeKnowledge.usageAdvice.length > 0)" class="tactical-advice-box">
          <div class="advice-title">🎯 {{ isEn ? 'Guide & Advice:' : 'ガイド ＆ 活用アドバイス:' }}</div>
          <ul class="advice-list">
            <li v-for="(adv, idx) in (activeKnowledge.tacticalAdvice || activeKnowledge.usageAdvice)" :key="idx">{{ adv }}</li>
          </ul>
        </div>

        <p v-if="activeCoord" class="detail-coord">
          📍 {{ isEn ? 'Cell Coordinates:' : 'マップセル座標:' }} ({{ activeCoord.x }}, {{ activeCoord.y }})
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { storeToRefs } from 'pinia';
import { useNetHackDriver, ATTRIBUTE_DEFINITIONS } from '../composables/useNetHackDriver';

const gameStore = useGameStore();
const { gklSituation, hoveredTileKnowledge } = storeToRefs(gameStore);
const {
  extractDirectionCode,
  getGlyphStyle,
  executeAction,
  executeSequence,
  getZoomAreaTiles,
  syncInventorySilent,
  syncSkillsSilent,
  syncSpellsSilent,
  moveToCell,
  castSpell,
  enhanceSkill,
  travelTo,
  openItemActionMenu,
  getAdaptiveSpecs,
  currentLanguage,
} = useNetHackDriver();

const isEn = computed(() => currentLanguage.value === 'en');

const selectedDir = ref('ALL');
const isSyncing = ref(false);
const hoveredItem = ref<any | null>(null);
const selectedAreaTile = ref<any | null>(null);
const hoveredAreaTile = ref<any | null>(null);

// 長押しタイマー管理
const pressTimers = ref<Record<string, any>>({});
const isLongPress = ref<Record<string, boolean>>({});

function handleItemPointerDown(item: any, e: PointerEvent) {
  if (e.button !== 0) return;
  isLongPress.value[item.letter] = false;
  pressTimers.value[item.letter] = setTimeout(() => {
    isLongPress.value[item.letter] = true;
    if (navigator.vibrate) navigator.vibrate(25);
    openItemActionMenu(item.letter);
  }, 400);
}

function handleItemPointerUp(item: any, e: PointerEvent) {
  if (pressTimers.value[item.letter]) {
    clearTimeout(pressTimers.value[item.letter]);
    delete pressTimers.value[item.letter];
  }
  if (!isLongPress.value[item.letter] && e.button === 0) {
    handleOneTapItem(item);
  }
}

function handleItemPointerLeave(item: any) {
  handleItemPointerCancel(item);
  hoveredItem.value = null;
}

function handleItemPointerCancel(item: any) {
  if (pressTimers.value[item.letter]) {
    clearTimeout(pressTimers.value[item.letter]);
    delete pressTimers.value[item.letter];
  }
}

function handleItemContextMenu(item: any, e: MouseEvent) {
  e.preventDefault();
  handleItemPointerCancel(item);
  openItemActionMenu(item.letter);
}

// 🛡️ 属性・耐性一覧
const activeAttributes = computed(() => {
  const res = gklSituation.value?.attributes?.effectiveResistances || {};
  return ATTRIBUTE_DEFINITIONS.filter(item => Boolean(res[item.key])).map(item => ({
    ...item,
    displayLabel: isEn.value ? (item.en || item.label) : item.label
  }));
});

// 🥋 スキル一覧
const isSkillsSynced = computed(() => Boolean(gklSituation.value?.skills?.isSynced));
const activeSkills = computed(() => gklSituation.value?.skills?.activeItems || []);

// 📖 習得魔法一覧
const activeSpells = computed(() => gklSituation.value?.spells?.items || []);

// 🛡️ 戦術アドバイス
const tacticalAdvices = computed(() => gklSituation.value?.advices || []);
const hasCriticalAdvice = computed(() => {
  return tacticalAdvices.value.some((adv: any) => adv.isCritical || adv.severity === 'CRITICAL' || adv.level === 'CRITICAL' || adv.dangerLevel === 'LETHAL');
});

async function handleSyncSkills() {
  await syncSkillsSilent();
}

async function handleSyncSpells() {
  await syncSpellsSilent();
}

function handleCastSpell(letter: string) {
  castSpell(letter);
}

function handleEnhanceSkill(skill?: any) {
  enhanceSkill(skill);
}

const dpadButtons = computed(() => [
  { id: 'NW', label: isEn.value ? 'NW' : '北西', icon: '↖' },
  { id: 'N', label: isEn.value ? 'N' : '北', icon: '↑' },
  { id: 'NE', label: isEn.value ? 'NE' : '北東', icon: '↗' },
  { id: 'W', label: isEn.value ? 'W' : '西', icon: '←' },
  { id: 'SELF', label: isEn.value ? 'Self' : '足元', icon: '・' },
  { id: 'E', label: isEn.value ? 'E' : '東', icon: '→' },
  { id: 'SW', label: isEn.value ? 'SW' : '南西', icon: '↙' },
  { id: 'S', label: isEn.value ? 'S' : '南', icon: '↓' },
  { id: 'SE', label: isEn.value ? 'SE' : '南東', icon: '↘' },
]);

const zoomTiles = computed(() => getZoomAreaTiles(3)); // 7x7 (radius=3)

const allActions = computed(() => gklSituation.value?.actions || gklSituation.value?.recommendedActions || []);

const filteredActions = computed(() => {
  if (selectedDir.value === 'ALL') return allActions.value;
  return allActions.value.filter((act: any) => {
    const dirCode = extractDirectionCode(act);
    return dirCode === selectedDir.value;
  });
});

const inventoryItems = computed(() => gklSituation.value?.inventory?.items || []);

const activeKnowledge = computed(() => {
  if (hoveredItem.value && hoveredItem.value.knowledge) {
    return hoveredItem.value.knowledge;
  }
  if (hoveredAreaTile.value && hoveredAreaTile.value.knowledge) {
    return hoveredAreaTile.value.knowledge;
  }
  if (selectedAreaTile.value && selectedAreaTile.value.knowledge) {
    return selectedAreaTile.value.knowledge;
  }
  if (hoveredTileKnowledge.value && hoveredTileKnowledge.value.knowledge) {
    return hoveredTileKnowledge.value.knowledge;
  }
  return null;
});

const adaptiveSpecs = computed(() => {
  if (!activeKnowledge.value) return [];
  return getAdaptiveSpecs(activeKnowledge.value);
});

const activeCoord = computed(() => {
  if (hoveredAreaTile.value && hoveredAreaTile.value.x !== undefined && hoveredAreaTile.value.x >= 0) {
    return { x: hoveredAreaTile.value.x, y: hoveredAreaTile.value.y };
  }
  if (selectedAreaTile.value && selectedAreaTile.value.x !== undefined && selectedAreaTile.value.x >= 0) {
    return { x: selectedAreaTile.value.x, y: selectedAreaTile.value.y };
  }
  if (hoveredTileKnowledge.value && hoveredTileKnowledge.value.x !== undefined) {
    return { x: hoveredTileKnowledge.value.x, y: hoveredTileKnowledge.value.y };
  }
  return null;
});

const activeTileInfo = computed(() => {
  const tile = hoveredAreaTile.value || selectedAreaTile.value;
  if (!tile || tile.x < 0) return isEn.value ? '🔍 Hover/Tap tile to inspect' : '🔍 マスにホバー/タップで解説';
  return `📍 (${tile.x}, ${tile.y}): ${tile.name || tile.nameJa}`;
});

const currentFilterLabel = computed(() => {
  if (selectedDir.value === 'ALL') return isEn.value ? 'All' : '全方向';
  const found = dpadButtons.value.find(b => b.id === selectedDir.value);
  return found ? `${found.label} (${found.icon})` : selectedDir.value;
});

function getActionCountForDir(dirId: string): number {
  return allActions.value.filter((act: any) => {
    return extractDirectionCode(act) === dirId;
  }).length;
}

function getEquipBorderClass(item: any): string {
  if (item.isWielded) return 'equip-border-wielded';
  if (item.isOffhand) return 'equip-border-offhand';
  if (item.isQuivered) return 'equip-border-quivered';
  if (item.isWorn) return 'equip-border-worn';
  return '';
}

function handleSelectZoomTile(tile: any) {
  selectedAreaTile.value = tile;
  // dx, dy から方向コードを設定
  const dirMap: Record<string, string> = {
    '-1,-1': 'NW', '0,-1': 'N', '1,-1': 'NE',
    '-1,0': 'W',   '0,0': 'SELF', '1,0': 'E',
    '-1,1': 'SW',  '0,1': 'S',  '1,1': 'SE',
  };
  const key = `${tile.dx},${tile.dy}`;
  if (dirMap[key]) {
    selectedDir.value = dirMap[key];
  }
}

async function handleSyncInventory() {
  isSyncing.value = true;
  await syncInventorySilent();
  isSyncing.value = false;
}

function getItemCategoryLabel(cat: string | undefined): string {
  if (!cat) return isEn.value ? 'Knowledge' : '解説';
  const enMap: Record<string, string> = {
    WEAPON: '⚔️ Weapon', ARMOR: '🛡️ Armor', RING: '💍 Ring', AMULET: '📿 Amulet',
    WAND: '🪄 Wand', SCROLL: '📜 Scroll', POTION: '🧪 Potion', SPELLBOOK: '📖 Spellbook',
    FOOD: '🍖 Food', TOOL: '🧰 Tool', GEM: '💎 Gem', COIN: '🪙 Gold',
    CONTAINER: '🧰 Container', TERRAIN: '🗺️ Terrain', MONSTER: '👾 Monster', PET: '🐶 Pet',
    CORPSE: '🍖 Corpse', STATUE: '🗿 Statue'
  };
  const jaMap: Record<string, string> = {
    WEAPON: '⚔️ 武器', ARMOR: '🛡️ 防具', RING: '💍 指輪', AMULET: '📿 魔除け',
    WAND: '🪄 杖', SCROLL: '📜 巻物', POTION: '🧪 薬', SPELLBOOK: '📖 呪文書',
    FOOD: '🍖 食料', TOOL: '🧰 道具', GEM: '💎 宝石', COIN: '🪙 金貨',
    CONTAINER: '🧰 容器', TERRAIN: '🗺️ 地形', MONSTER: '👾 モンスター', PET: '🐶 ペット',
    CORPSE: '🍖 死体', STATUE: '🗿 石像'
  };
  const map = isEn.value ? enMap : jaMap;
  return map[cat.toUpperCase()] || cat;
}

function getDangerBadgeInfo(level: string | undefined) {
  if (!level) return null;
  const l = String(level).toUpperCase();
  if (l === 'LETHAL' || l === 'EXTREME' || l === 'VERY_HIGH') {
    return { label: isEn.value ? `☠️ Lethal (${l})` : `☠️ 致命的 (${l})`, color: '#ff0055', bg: 'rgba(255, 0, 85, 0.2)', border: '#ff0055' };
  }
  if (l === 'HIGH') {
    return { label: isEn.value ? `⚠️ Danger (HIGH)` : `⚠️ 危険 (HIGH)`, color: '#ff9f1c', bg: 'rgba(255, 159, 28, 0.2)', border: '#ff9f1c' };
  }
  if (l === 'MEDIUM') {
    return { label: isEn.value ? `⚡ Warning (MEDIUM)` : `⚡ 注意 (MEDIUM)`, color: '#ffe600', bg: 'rgba(255, 230, 0, 0.2)', border: '#ffe600' };
  }
  return { label: isEn.value ? `🟢 Safe (${l})` : `🟢 低脅威 (${l})`, color: '#2ec4b6', bg: 'rgba(46, 196, 182, 0.2)', border: '#2ec4b6' };
}

function formatResistances(res: any): string {
  if (!res || !Array.isArray(res) || res.length === 0) return '';
  if (isEn.value) return res.join(', ');
  const map: Record<string, string> = {
    fire: '火炎', cold: '冷気', sleep: '睡眠', poison: '毒', electricity: '電撃',
    acid: '酸', shock: '電撃', petrify: '石化', drain: 'ドレイン', magic: '魔法'
  };
  return res.map((r: string) => map[r.toLowerCase()] || r).join(', ');
}

function formatAttacks(attacks: any): string {
  if (!attacks || !Array.isArray(attacks) || attacks.length === 0) return '';
  return attacks.map((a: any) => {
    if (typeof a === 'string') return a;
    const type = a.type || a.name || (isEn.value ? 'Attack' : '攻撃');
    const dmg = a.damage ? `(${a.damage})` : '';
    const eff = a.effect ? ` [${a.effect}]` : '';
    return `${type}${dmg}${eff}`;
  }).join(', ');
}

function handleExecuteAction(act: any) {
  if (act.risk === 'danger' || act.isDanger) {
    const label = act.label || '操作';
    if (!confirm(`【⚠️ 危険な行動】\n"${label}" を実行しますか？`)) return;
  }
  selectedDir.value = 'ALL';
  executeAction(act);
}

function handleOneTapItem(item: any) {
  const seq = (item.defaultSequence && Array.isArray(item.defaultSequence) && item.defaultSequence.length > 0)
    ? item.defaultSequence
    : [item.letter];
  executeSequence(seq);
}

function getActionClass(act: any) {
  if (act.risk === 'danger' || act.category === 'ATTACK' || act.isDanger) return 'btn-danger';
  if (act.category === 'UNCOMMITTED' || act.category === 'ITEM') return 'btn-info';
  return 'btn-primary';
}
</script>

<style scoped>
.gkl-panel {
  background: #181b24;
  border: 1px solid #3b4252;
  border-radius: 6px;
  padding: 12px 16px;
  color: #e5e9f0;
  font-family: system-ui, -apple-system, sans-serif;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gkl-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #2e3440;
  padding-bottom: 8px;
}
.gkl-title-box {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gkl-badge {
  background: linear-gradient(135deg, #00e676, #00b0ff);
  color: #090d16;
  font-weight: bold;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
}
.btn-sync {
  background: #3b4252;
  color: #88c0d0;
  border: 1px solid #4c566a;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.gkl-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-title {
  font-size: 12px;
  font-weight: bold;
  color: #ebcb8b;
}
.sub-hint {
  font-size: 10px;
  color: #88c0d0;
  font-weight: normal;
}
.filter-status-text {
  font-size: 11px;
  color: #88c0d0;
}

.gkl-controls-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-start;
}

.control-box {
  background: #232834;
  border: 1px solid #2e3440;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.box-title {
  font-size: 11px;
  font-weight: bold;
  color: #88c0d0;
  border-bottom: 1px solid #2e3440;
  padding-bottom: 4px;
}

.dpad-box {
  min-width: 170px;
}

.zoom-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dpad-grid {
  display: grid;
  grid-template-columns: repeat(3, 46px);
  gap: 4px;
  justify-content: center;
}

.btn-dpad {
  background: #2e3440;
  color: #d8dee9;
  border: 1px solid #4c566a;
  border-radius: 4px;
  height: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  font-size: 10px;
  padding: 2px;
}
.btn-dpad.active {
  background: #88c0d0;
  color: #2e3440;
  font-weight: bold;
  border-color: #88c0d0;
}
.btn-dpad.has-action {
  border-color: #ebcb8b;
}
.dpad-icon { font-size: 11px; line-height: 1; }
.dpad-label { font-size: 8px; opacity: 0.8; }

.dpad-count-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #bf616a;
  color: #fff;
  font-size: 9px;
  border-radius: 50%;
  width: 15px;
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.btn-dpad-all {
  background: #2e3440;
  color: #d8dee9;
  border: 1px solid #4c566a;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 11px;
  cursor: pointer;
  margin-top: 4px;
}
.btn-dpad-all.active {
  background: #88c0d0;
  color: #2e3440;
  font-weight: bold;
}

/* 🔍 7x7 ズームカメラ（ミニマップビューア） */
.zoom-grid {
  display: grid;
  grid-template-columns: repeat(7, 24px);
  grid-template-rows: repeat(7, 24px);
  gap: 2px;
  background: #141720;
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #3b4252;
}

.zoom-cell {
  width: 24px;
  height: 24px;
  background: #1e222d;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.1s ease-in-out;
  border: 1px solid transparent;
}

.zoom-cell:hover {
  border-color: #88c0d0;
  background: #2e3440;
  transform: scale(1.1);
  z-index: 10;
}

.zoom-cell.player-cell {
  box-shadow: 0 0 8px #ebcb8b;
  border: 1px solid #ebcb8b;
  background: #3b3626;
}

.zoom-cell.selected-cell {
  border-color: #a3be8c;
  background: #2e3b38;
}

.zoom-sprite {
  width: 22px;
  height: 22px;
  border-radius: 2px;
}

.zoom-symbol {
  font-family: monospace;
  font-size: 14px;
  color: #d8dee9;
}

.zoom-status-bar {
  font-size: 9px;
  color: #a3be8c;
  margin-top: 4px;
  height: 14px;
  text-align: center;
}

.gkl-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.gkl-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.btn-primary { background: #88c0d0; color: #2e3440; }
.btn-info { background: #81a1c1; color: #2e3440; }
.btn-danger { background: #bf616a; color: #eceff4; }
.gkl-key { font-weight: bold; font-family: monospace; }
.gkl-dir-badge { font-size: 10px; opacity: 0.8; }
.gkl-empty {
  font-size: 11px;
  color: #4c566a;
  padding: 4px 0;
}

.gkl-inventory-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.inv-item-card {
  background: #232834;
  border: 1px solid #3b4252;
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  position: relative;
}

.inv-item-card:hover {
  background: #2e3440;
}

.equip-border-wielded {
  border: 2px solid #e9c46a !important;
  box-shadow: 0 0 6px rgba(233, 196, 106, 0.5);
}
.equip-border-offhand {
  border: 2px solid #4ea8de !important;
  box-shadow: 0 0 6px rgba(78, 168, 222, 0.5);
}
.equip-border-quivered {
  border: 2px solid #2a9d8f !important;
  box-shadow: 0 0 6px rgba(42, 157, 143, 0.5);
}
.equip-border-worn {
  border: 2px solid #9d4edd !important;
  box-shadow: 0 0 6px rgba(157, 78, 221, 0.5);
}

.inv-item-compact {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inv-letter {
  font-weight: bold;
  color: #88c0d0;
  font-family: monospace;
  font-size: 12px;
}

.inv-glyph-icon {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  flex-shrink: 0;
}

.equip-badge {
  font-size: 9px;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 3px;
  color: #1a1a2e;
}
.badge-wielded { background: #e9c46a; }
.badge-offhand { background: #4ea8de; }
.badge-quivered { background: #2a9d8f; color: #fff; }
.badge-worn { background: #9d4edd; color: #fff; }

.inv-floating-popover {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 6px;
  background: #2e3440;
  border: 1px solid #88c0d0;
  border-radius: 6px;
  padding: 8px 12px;
  z-index: 100;
  width: max-content;
  max-width: 260px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.popover-title {
  font-weight: bold;
  color: #ebcb8b;
  font-size: 11px;
}
.popover-action {
  font-size: 10px;
  color: #a3be8c;
  font-weight: bold;
}
.popover-desc {
  font-size: 10px;
  color: #e5e9f0;
  opacity: 0.9;
}

.gkl-knowledge-detail {
  background: #2e3440;
  border: 1px solid #88c0d0;
  border-radius: 4px;
  padding: 10px 14px;
  margin-top: 4px;
}
.detail-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #a3be8c; }
.detail-subname { font-size: 11px; opacity: 0.8; }
.detail-cat { font-size: 10px; color: #88c0d0; }
.detail-body { font-size: 11px; color: #e5e9f0; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.detail-text { margin: 0; }
.detail-coord { font-size: 10px; color: #d8dee9; margin: 0; opacity: 0.8; }

.danger-level-badge {
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
}

.monster-stats-grid {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.stat-pill {
  background: #232834;
  border: 1px solid #4c566a;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  color: #88c0d0;
}
.stat-pill strong {
  color: #ebcb8b;
}

/* 🎒 アイテム全カテ適応型スペックバッジ */
.adaptive-specs-grid {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 4px 0;
}
.spec-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid #334155;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
}
.spec-badge.spec-highlight {
  border-color: #38bdf8;
  background: rgba(14, 165, 233, 0.15);
}
.spec-label {
  color: #94a3b8;
  font-size: 10px;
}
.spec-badge.spec-highlight .spec-label {
  color: #38bdf8;
}
.spec-value {
  color: #f8fafc;
  font-weight: bold;
}
.spec-skill-badge {
  color: #22c55e;
  font-weight: bold;
  font-size: 10px;
  margin-left: 2px;
}

/* ⚖️ BUC効果 */
.buc-effects-box {
  background: #232834;
  border-left: 3px solid #60a5fa;
  padding: 6px 10px;
  border-radius: 0 4px 4px 0;
  margin-top: 4px;
}
.buc-title {
  font-weight: bold;
  color: #60a5fa;
  font-size: 10px;
}
.buc-list {
  margin: 4px 0 0 16px;
  padding: 0;
  font-size: 10px;
}

/* 🔍 未識別識別Tips */
.unid-tips-box {
  background: #232834;
  border-left: 3px solid #a78bfa;
  padding: 6px 10px;
  border-radius: 0 4px 4px 0;
  margin-top: 4px;
}
.unid-title {
  font-weight: bold;
  color: #a78bfa;
  font-size: 10px;
}

.monster-detail-row {
  color: #d8dee9 !important;
  font-size: 11px;
}

.tactical-advice-box {
  background: #232834;
  border-left: 3px solid #ebcb8b;
  padding: 6px 10px;
  border-radius: 0 4px 4px 0;
  margin-top: 4px;
}
.advice-title {
  font-weight: bold;
  color: #ebcb8b;
  font-size: 10px;
}
.advice-list {
  margin: 4px 0 0 16px;
  padding: 0;
  font-size: 10px;
  color: #e5e9f0;
}

/* 🥋 スキル・📖 魔法・🛡️ 属性耐性 総合ステータスバー */
.gkl-status-overview-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #232834;
  border: 1px solid #3b4252;
  border-radius: 6px;
  padding: 8px 12px;
}
.gkl-overview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.overview-label {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}
.overview-badges-list {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.overview-empty {
  font-size: 11px;
  color: #64748b;
}

/* 🛡️ 属性耐性バッジ */
.gkl-attr-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  font-size: 11px;
  border-radius: 4px;
  background: rgba(30, 41, 59, 0.7);
  color: #94a3b8;
  border: 1px solid #334155;
  white-space: nowrap;
}
.gkl-attr-badge.active {
  background: rgba(14, 165, 233, 0.15);
  border-color: #38bdf8;
  color: #7dd3fc;
  font-weight: bold;
}

/* 🥋 スキル熟練度バッジ */
.gkl-skill-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  font-size: 11px;
  border-radius: 4px;
  background: rgba(30, 41, 59, 0.7);
  color: #cbd5e1;
  border: 1px solid #334155;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}
.gkl-skill-badge:hover {
  filter: brightness(1.15);
}
.gkl-skill-badge-basic {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}
.gkl-skill-badge-skilled {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  font-weight: bold;
}
.gkl-skill-badge-expert {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.2);
  color: #c4b5fd;
  font-weight: bold;
}
.gkl-skill-badge-master,
.gkl-skill-badge-grandmaster {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
  font-weight: bold;
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
}
.gkl-skill-badge-enhanceable {
  border-color: #f59e0b !important;
  animation: pulse-skill 2s infinite ease-in-out;
}
@keyframes pulse-skill {
  0%, 100% { box-shadow: 0 0 2px rgba(245, 158, 11, 0.4); }
  50% { box-shadow: 0 0 8px rgba(245, 158, 11, 0.8); }
}
.skill-star {
  color: #f59e0b;
  font-size: 11px;
}

/* 📖 習得魔法バッジ */
.gkl-spell-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid #a78bfa;
  color: #ddd6fe;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.gkl-spell-badge:hover {
  background: rgba(139, 92, 246, 0.3);
  filter: brightness(1.15);
}
.gkl-spell-badge small {
  color: #94a3b8;
  margin-left: 4px;
}

/* 🎽 得意武器適性バッジ (+) */
.badge-proficient {
  background: #22c55e !important;
  color: #000 !important;
  font-weight: bold !important;
  left: 2px !important;
  right: auto !important;
}
</style>
