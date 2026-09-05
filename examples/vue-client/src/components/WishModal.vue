<template>
  <div v-if="activeWishData" class="modal-backdrop" @click="handleCancel">
    <div ref="modalCardRef" class="modal-card modal-large wish-builder-card" @click.stop>
      <div class="modal-header">
        <h2>✨ {{ isEn ? 'For what do you wish?' : '何をお望みですか？ (Wish Builder)' }}</h2>
      </div>

      <div class="wish-modal-body">
        <!-- 1. 定番プリセット -->
        <div class="wish-section-title">{{ isEn ? 'Quick Presets' : '定番プリセット (Quick Presets)' }}</div>
        <div class="wish-preset-grid">
          <button
            v-for="p in presets"
            :key="p.id"
            class="wish-preset-btn"
            @click="applyPreset(p)"
          >
            <span class="preset-icon">🎁</span>
            <div class="preset-info">
              <strong class="preset-name">{{ isEn ? p.labelEn : p.labelJa }}</strong>
              <small class="preset-sub">{{ p.spec.itemName }}</small>
            </div>
          </button>
        </div>

        <!-- 2. アイテム選択 / 検索 -->
        <div class="wish-section-title">{{ isEn ? 'Item Search & Selection' : 'アイテム選択 / 検索' }}</div>
        <div class="wish-search-container">
          <input
            ref="searchInputRef"
            type="text"
            v-model="searchQuery"
            class="wish-search-input"
            :placeholder="isEn ? 'Search item (e.g. SDSM, silver dragon, genocide, marker)' : 'アイテム名を入力（日本語 / 英語 / 略称: SDSM, 虐殺 など）'"
            @input="handleSearchInput"
            @keydown="handleSearchKeyDown"
          />
          <!-- サジェストドロップダウン -->
          <div v-if="suggestions.length > 0" class="wish-suggest-dropdown">
            <div
              v-for="(s, idx) in suggestions"
              :key="s.name"
              class="wish-suggest-item"
              :class="{ selected: idx === selectedSuggestIndex }"
              @click="selectSuggestion(s)"
              @mouseenter="selectedSuggestIndex = idx"
            >
              <strong>{{ isEn ? s.name : s.nameJa }}</strong>
              <small>{{ isEn ? s.nameJa : s.name }} ({{ s.category }})</small>
            </div>
          </div>
        </div>

        <div class="wish-flex-row">
          <div class="wish-form-group flex-1">
            <label>{{ isEn ? 'Category Filter:' : 'カテゴリ絞り込み:' }}</label>
            <select v-model="selectedCategory" class="wish-form-control" @change="handleCategoryChange">
              <option value="">{{ isEn ? '(All Categories)' : '(全カテゴリ)' }}</option>
              <option v-for="(lbl, cat) in categoryLabels" :key="cat" :value="cat">
                {{ isEn ? lbl.en : lbl.ja }}
              </option>
            </select>
          </div>

          <div class="wish-form-group flex-2">
            <label>{{ isEn ? 'Selected Item:' : '選択中アイテム:' }}</label>
            <select v-model="selectedItemName" class="wish-form-control" @change="handleItemSelect">
              <option v-for="it in availableItems" :key="it.name" :value="it.name">
                {{ isEn ? `${it.name} (${it.nameJa})` : `${it.nameJa} (${it.name})` }}
              </option>
            </select>
          </div>
        </div>

        <!-- 3. 詳細オプションビルダー -->
        <div class="wish-section-title">{{ isEn ? 'Options' : 'オプション設定 (Options)' }}</div>
        <div class="wish-builder-grid">
          <div class="wish-form-group">
            <label>{{ isEn ? 'Blessing:' : '祝福・呪い (Blessing):' }}</label>
            <select v-model="optBlessing" class="wish-form-control">
              <option value="blessed">{{ isEn ? 'Blessed' : '祝福された (blessed)' }}</option>
              <option value="uncursed">{{ isEn ? 'Uncursed' : '呪われていない (uncursed)' }}</option>
              <option value="cursed">{{ isEn ? 'Cursed' : '呪われた (cursed)' }}</option>
            </select>
          </div>

          <div class="wish-form-group">
            <label>{{ isEn ? 'Enchantment:' : '強化値 (Enchantment):' }}</label>
            <select v-model="optEnchantment" class="wish-form-control">
              <option value="0">{{ isEn ? '+0 (None)' : '+0 (指定なし)' }}</option>
              <option value="1">+1</option>
              <option value="2">{{ isEn ? '+2 (Standard Recommended)' : '+2 (標準おすすめ)' }}</option>
              <option value="3">+3</option>
              <option value="4">+4</option>
              <option value="5">+5</option>
              <option value="6">+6</option>
              <option value="7">+7</option>
              <option value="-1">-1</option>
            </select>
          </div>

          <div class="wish-form-group">
            <label>{{ isEn ? 'Proof / Erosion:' : '耐性・防錆 (Proof):' }}</label>
            <select v-model="optErosion" class="wish-form-control">
              <option value="">{{ isEn ? 'None (Standard)' : 'なし (標準)' }}</option>
              <option value="fixed">{{ isEn ? 'Fixed (Rust & Fire proof)' : '防錆・耐熱 (fixed)' }}</option>
              <option value="rustproof">{{ isEn ? 'Rustproof' : '錆びない (rustproof)' }}</option>
              <option value="fireproof">{{ isEn ? 'Fireproof' : '耐火 (fireproof)' }}</option>
              <option value="corrodeproof">{{ isEn ? 'Corrodeproof' : '腐食しない (corrodeproof)' }}</option>
            </select>
          </div>

          <div class="wish-form-group">
            <label>{{ isEn ? 'Count:' : '個数 (Count):' }}</label>
            <input v-model.number="optCount" type="number" class="wish-form-control" min="1" max="50" />
          </div>

          <div class="wish-form-group wish-span-2 wish-flex-gap">
            <label class="wish-checkbox-group">
              <input type="checkbox" v-model="optGreased" />
              <span>{{ isEn ? 'Greased' : '油を塗る (greased)' }}</span>
            </label>
            <label class="wish-checkbox-group">
              <input type="checkbox" v-model="optPoisoned" />
              <span>{{ isEn ? 'Poisoned' : '毒を塗る (poisoned)' }}</span>
            </label>
          </div>
        </div>

        <!-- 4. リアルタイム生成プレビュー -->
        <div class="wish-preview-box">
          <div class="wish-preview-label">{{ isEn ? 'NetHack command string to send:' : '送信されるNetHackコマンド文字列:' }}</div>
          <div class="wish-preview-command">{{ generatedWishString }}</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleCancel">{{ isEn ? 'Cancel (Esc)' : 'キャンセル (Esc)' }}</button>
        <button class="btn btn-primary btn-large" @click="handleSubmit">{{ isEn ? 'Confirm & Wish (Enter)' : '決定して願う (Enter)' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../composables/useNetHackDriver';
import { storeToRefs } from 'pinia';
import { WishService, WISH_PRESETS, CATEGORY_LABELS } from '@core/knowledge/WishService.js';
import { trapFocus } from '@core/input/focusTrap.js';

const gameStore = useGameStore();
const { activeWishData } = storeToRefs(gameStore);
const { currentLanguage, sendWish, cancelWish } = useNetHackDriver();

const isEn = computed(() => currentLanguage.value === 'en');
const presets = WISH_PRESETS as any[];
const categoryLabels = CATEGORY_LABELS as Record<string, { ja: string; en: string }>;

const wishService = new WishService();

const activeWishService = computed(() => {
  const svc = (activeWishData.value?.assistant?.wishService || wishService) as any;
  svc.setLanguage(currentLanguage.value);
  return svc;
});

const searchInputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const suggestions = ref<any[]>([]);
const selectedSuggestIndex = ref<number>(-1);
const selectedCategory = ref('');
const selectedItemName = ref('silver dragon scale mail');

const optBlessing = ref<'blessed' | 'uncursed' | 'cursed'>('blessed');
const optEnchantment = ref('2');
const optErosion = ref('fixed');
const optCount = ref(1);
const optGreased = ref(false);
const optPoisoned = ref(false);

const catalogByCategory = computed<Record<string, any[]>>(() => {
  return activeWishService.value.getCatalogByCategory() || {};
});

const availableItems = computed(() => {
  const cat = selectedCategory.value;
  if (cat && catalogByCategory.value[cat]) {
    return catalogByCategory.value[cat];
  }
  return activeWishService.value.getCatalog() || [];
});

watch(activeWishData, (val) => {
  if (val) {
    searchQuery.value = '';
    suggestions.value = [];
    selectedSuggestIndex.value = -1;
    selectedCategory.value = '';
    selectedItemName.value = 'silver dragon scale mail';
    optBlessing.value = 'blessed';
    optEnchantment.value = '2';
    optErosion.value = 'fixed';
    optCount.value = 1;
    optGreased.value = false;
    optPoisoned.value = false;
    setTimeout(() => {
      searchInputRef.value?.focus();
    }, 50);
  }
});

const generatedWishString = computed(() => {
  return activeWishService.value.serializeWish({
    itemName: selectedItemName.value,
    blessing: optBlessing.value,
    enchantment: parseInt(optEnchantment.value, 10) || 0,
    erosion: optErosion.value || undefined,
    count: optCount.value || 1,
    isGreased: optGreased.value,
    isPoisoned: optPoisoned.value,
  });
});

function handleSearchInput() {
  const q = searchQuery.value.trim();
  if (q.length === 0) {
    suggestions.value = [];
    selectedSuggestIndex.value = -1;
    return;
  }
  suggestions.value = activeWishService.value.suggest(q, { limit: 8 });
  selectedSuggestIndex.value = -1;
}

function selectSuggestion(item: any) {
  selectedItemName.value = item.name;
  selectedCategory.value = item.category || '';
  searchQuery.value = isEn.value ? item.name : item.nameJa;
  suggestions.value = [];
  selectedSuggestIndex.value = -1;
}

function handleCategoryChange() {
  const items = availableItems.value;
  if (items.length > 0) {
    selectedItemName.value = items[0].name;
  }
}

function handleItemSelect() {
  const item = availableItems.value.find((i: any) => i.name === selectedItemName.value);
  if (item) {
    searchQuery.value = isEn.value ? item.name : item.nameJa;
  }
}

function applyPreset(p: any) {
  if (p.spec) {
    selectedItemName.value = p.spec.itemName || selectedItemName.value;
    if (p.spec.category) selectedCategory.value = p.spec.category;
    if (p.spec.blessing) optBlessing.value = p.spec.blessing;
    if (p.spec.enchantment !== undefined) optEnchantment.value = String(p.spec.enchantment);
    if (p.spec.erosion !== undefined) optErosion.value = p.spec.erosion;
    if (p.spec.count !== undefined) optCount.value = p.spec.count;
    if (p.spec.isGreased !== undefined) optGreased.value = p.spec.isGreased;
    if (p.spec.isPoisoned !== undefined) optPoisoned.value = p.spec.isPoisoned;
  }
}

function handleSubmit() {
  const cmd = generatedWishString.value;
  sendWish(cmd);
}

function handleCancel() {
  cancelWish();
}

function handleSearchKeyDown(e: KeyboardEvent) {
  if (suggestions.value.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedSuggestIndex.value = (selectedSuggestIndex.value + 1) % suggestions.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedSuggestIndex.value = (selectedSuggestIndex.value - 1 + suggestions.value.length) % suggestions.value.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    const chosen = suggestions.value[selectedSuggestIndex.value >= 0 ? selectedSuggestIndex.value : 0];
    if (chosen) {
      selectSuggestion(chosen);
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const chosen = suggestions.value[selectedSuggestIndex.value >= 0 ? selectedSuggestIndex.value : 0];
    if (chosen) {
      selectSuggestion(chosen);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    suggestions.value = [];
    selectedSuggestIndex.value = -1;
  }
}

const modalCardRef = ref<HTMLDivElement | null>(null);

function handleKeyDown(e: KeyboardEvent) {
  if (!activeWishData.value) return;

  if (e.key === 'Tab') {
    if (suggestions.value.length === 0 && modalCardRef.value) {
      trapFocus(modalCardRef.value, e);
      return;
    }
  }

  if (suggestions.value.length > 0) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    handleCancel();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    handleSubmit();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.wish-builder-card {
  background: #0f172a;
  border: 2px solid #eab308;
  border-radius: 12px;
  width: 90%;
  max-width: 760px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(234, 179, 8, 0.2);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.modal-header {
  padding: 12px 20px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
  color: #facc15;
}

.wish-modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wish-section-title {
  font-size: 12px;
  font-weight: 700;
  color: #38bdf8;
  border-bottom: 1px solid #334155;
  padding-bottom: 4px;
}

.wish-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 6px;
}

.wish-preset-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.wish-preset-btn:hover {
  background: #334155;
  border-color: #facc15;
  transform: translateY(-1px);
}

.preset-icon {
  font-size: 16px;
}

.preset-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preset-name {
  font-size: 11px;
  color: #f8fafc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-sub {
  font-size: 9px;
  color: #94a3b8;
}

.wish-search-container {
  position: relative;
}

.wish-search-input {
  width: 100%;
  padding: 8px 12px;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 6px;
  color: #f8fafc;
  font-size: 13px;
  box-sizing: border-box;
}

.wish-search-input:focus {
  outline: none;
  border-color: #facc15;
}

.wish-suggest-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 6px;
  margin-top: 2px;
  z-index: 50;
  max-height: 180px;
  overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}

.wish-suggest-item {
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border-bottom: 1px solid #334155;
  font-size: 12px;
  color: #f1f5f9;
}

.wish-suggest-item:hover,
.wish-suggest-item.selected {
  background: #334155;
}

.wish-suggest-item small {
  color: #94a3b8;
}

.wish-flex-row {
  display: flex;
  gap: 10px;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }

.wish-form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wish-form-group label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.wish-form-control {
  padding: 6px 10px;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 6px;
  color: #f8fafc;
  font-size: 12px;
}

.wish-form-control:focus {
  outline: none;
  border-color: #facc15;
}

.wish-builder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.wish-span-2 {
  grid-column: span 2;
}

.wish-flex-gap {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}

.wish-checkbox-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #cbd5e1;
  cursor: pointer;
}

.wish-preview-box {
  background: #020617;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 4px;
}

.wish-preview-label {
  font-size: 10px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.wish-preview-command {
  font-family: monospace;
  font-size: 13px;
  font-weight: 700;
  color: #facc15;
}

.modal-footer {
  padding: 12px 20px;
  background: #1e293b;
  border-top: 1px solid #334155;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-secondary {
  background: #475569;
  color: #f8fafc;
}

.btn-secondary:hover {
  background: #64748b;
}

.btn-primary {
  background: #eab308;
  color: #020617;
}

.btn-primary:hover {
  background: #facc15;
}
</style>
