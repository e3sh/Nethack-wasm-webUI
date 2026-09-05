<script lang="ts">
  import { activeWishDataStore } from '../stores/gameStore';
  import { currentLanguageStore, driverController } from '../services/useNetHackDriver';
  import { WishService, WISH_PRESETS, CATEGORY_LABELS } from '@core/knowledge/WishService.js';

  const presets = WISH_PRESETS as any[];
  const categoryLabels = CATEGORY_LABELS as Record<string, { ja: string; en: string }>;
  const wishService = new WishService();

  let searchQuery = '';
  let suggestions: any[] = [];
  let selectedCategory = '';
  let selectedItemName = 'silver dragon scale mail';

  let optBlessing: 'blessed' | 'uncursed' | 'cursed' = 'blessed';
  let optEnchantment = '2';
  let optErosion = 'fixed';
  let optCount = 1;
  let optGreased = false;
  let optPoisoned = false;

  $: isEn = $currentLanguageStore === 'en';

  const catalogByCategory = (wishService as any).getCatalogByCategory() || {};

  $: availableItems = (() => {
    if (selectedCategory && catalogByCategory[selectedCategory]) {
      return catalogByCategory[selectedCategory];
    }
    return (wishService as any).getCatalog() || [];
  })();

  $: if ($activeWishDataStore) {
    searchQuery = '';
    suggestions = [];
    selectedCategory = '';
    selectedItemName = 'silver dragon scale mail';
    optBlessing = 'blessed';
    optEnchantment = '2';
    optErosion = 'fixed';
    optCount = 1;
    optGreased = false;
    optPoisoned = false;
  }

  $: generatedWishString = (wishService as any).serializeWish({
    itemName: selectedItemName,
    blessing: optBlessing,
    enchantment: parseInt(optEnchantment, 10) || 0,
    erosion: optErosion || undefined,
    count: optCount || 1,
    isGreased: optGreased,
    isPoisoned: optPoisoned,
  });

  const handleSearchInput = (val: string) => {
    searchQuery = val;
    const q = val.trim();
    if (q.length === 0) {
      suggestions = [];
      return;
    }
    suggestions = (wishService as any).suggest(q, { limit: 8 });
  };

  const selectSuggestion = (item: any) => {
    selectedItemName = item.name;
    selectedCategory = item.category || '';
    searchQuery = isEn ? item.name : item.nameJa;
    suggestions = [];
  };

  const applyPreset = (p: any) => {
    if (p.spec) {
      if (p.spec.itemName) selectedItemName = p.spec.itemName;
      if (p.spec.category) selectedCategory = p.spec.category;
      if (p.spec.blessing) optBlessing = p.spec.blessing;
      if (p.spec.enchantment !== undefined) optEnchantment = String(p.spec.enchantment);
      if (p.spec.erosion !== undefined) optErosion = p.spec.erosion;
      if (p.spec.count !== undefined) optCount = p.spec.count;
      if (p.spec.isGreased !== undefined) optGreased = p.spec.isGreased;
      if (p.spec.isPoisoned !== undefined) optPoisoned = p.spec.isPoisoned;
      searchQuery = isEn ? p.spec.itemName : (p.labelJa || p.spec.itemName);
    }
  };

  const handleConfirm = () => {
    driverController.sendWish(generatedWishString);
  };

  const handleCancel = () => {
    driverController.cancelWish();
  };
  const handleCategoryChange = (cat: string) => {
    selectedCategory = cat;
    const items = cat && catalogByCategory[cat] ? catalogByCategory[cat] : (wishService as any).getCatalog() || [];
    if (items.length > 0) {
      selectedItemName = items[0].name;
    }
  };
</script>

{#if $activeWishDataStore}
  <div class="modal-backdrop">
    <div class="wish-builder-card">
      <div class="modal-header">
        <h2>✨ {isEn ? 'Wish Builder (#wish)' : '願いの祭壇 (#wish ビルダー)'}</h2>
      </div>

      <div class="wish-modal-body">
        <!-- 1. 定番・人気プリセット -->
        <div class="wish-section-title">
          ⭐ {isEn ? 'Popular Wish Presets' : '定番の願いプリセット'}
        </div>
        <div class="wish-preset-grid">
          {#each presets as p}
            <button
              type="button"
              class="wish-preset-btn"
              on:click={() => applyPreset(p)}
            >
              <span class="preset-icon">{p.icon || '🎁'}</span>
              <div class="preset-info">
                <span class="preset-name">{isEn ? p.labelEn : p.labelJa}</span>
                <span class="preset-sub">{p.spec?.itemName}</span>
              </div>
            </button>
          {/each}
        </div>

        <!-- 2. インクリメンタル検索 -->
        <div class="wish-section-title" style="margin-top: 8px;">
          🔍 {isEn ? 'Item Search & Selection' : 'アイテム検索 ＆ 選択'}
        </div>
        <div class="wish-search-container">
          <input
            type="text"
            class="wish-search-input"
            placeholder={isEn ? 'Search items (e.g. dragon mail, speed, gauntlets)...' : 'アイテム名・英名・キーワードで検索 (例: ドラゴン, speed, 手袋)...'}
            value={searchQuery}
            on:input={(e) => handleSearchInput(e.currentTarget.value)}
          />
          {#if suggestions.length > 0}
            <div class="wish-suggest-dropdown">
              {#each suggestions as item}
                <div
                  class="wish-suggest-item"
                  on:click={() => selectSuggestion(item)}
                >
                  <span>{isEn ? item.name : `${item.nameJa} (${item.name})`}</span>
                  <small>{item.category}</small>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- 3. カテゴリと個別アイテム選択 -->
        <div class="wish-flex-row">
          <div class="wish-form-group flex-1">
            <label>{isEn ? 'Category' : 'カテゴリ'}</label>
            <select
              class="wish-form-control"
              bind:value={selectedCategory}
              on:change={(e) => handleCategoryChange(e.currentTarget.value)}
            >
              <option value="">{isEn ? '-- All Categories --' : '-- 全カテゴリ --'}</option>
              {#each Object.entries(categoryLabels) as [catKey, labels]}
                <option value={catKey}>{isEn ? labels.en : labels.ja}</option>
              {/each}
            </select>
          </div>

          <div class="wish-form-group flex-2">
            <label>{isEn ? 'Target Item' : '対象アイテム'}</label>
            <select
              class="wish-form-control"
              bind:value={selectedItemName}
            >
              {#each availableItems as it}
                <option value={it.name}>
                  {isEn ? it.name : `${it.nameJa} (${it.name})`}
                </option>
              {/each}
            </select>
          </div>
        </div>

        <!-- 4. オプションパラメータ -->
        <div class="wish-section-title" style="margin-top: 8px;">
          ⚙️ {isEn ? 'Wish Modifiers & Options' : '属性・強化値・状態設定'}
        </div>
        <div class="wish-builder-grid">
          <div class="wish-form-group">
            <label>{isEn ? 'Blessing' : '祝福・呪い'}</label>
            <select
              class="wish-form-control"
              bind:value={optBlessing}
            >
              <option value="blessed">✨ {isEn ? 'Blessed' : '祝福 (blessed)'}</option>
              <option value="uncursed">{isEn ? 'Uncursed' : '通常 (uncursed)'}</option>
              <option value="cursed">💀 {isEn ? 'Cursed' : '呪い (cursed)'}</option>
            </select>
          </div>

          <div class="wish-form-group">
            <label>{isEn ? 'Enchantment' : '強化値'}</label>
            <select
              class="wish-form-control"
              bind:value={optEnchantment}
            >
              <option value="0">+0</option>
              <option value="1">+1</option>
              <option value="2">+2 (Recommended)</option>
              <option value="3">+3</option>
            </select>
          </div>

          <div class="wish-form-group">
            <label>{isEn ? 'Erosion/Rust' : '防錆・防腐'}</label>
            <select
              class="wish-form-control"
              bind:value={optErosion}
            >
              <option value="fixed">🛡️ {isEn ? 'Proof (fixed)' : '耐性付き (fixed/rustproof)'}</option>
              <option value="">{isEn ? 'Normal' : '標準 (なし)'}</option>
            </select>
          </div>

          <div class="wish-form-group">
            <label>{isEn ? 'Quantity' : '数量'}</label>
            <input
              type="number"
              class="wish-form-control"
              min="1"
              max="10"
              bind:value={optCount}
            />
          </div>

          <div class="wish-form-group wish-span-2 wish-flex-gap">
            <label class="wish-checkbox-group">
              <input
                type="checkbox"
                bind:checked={optGreased}
              />
              <span>🧈 {isEn ? 'Greased' : '油塗り (greased)'}</span>
            </label>

            <label class="wish-checkbox-group">
              <input
                type="checkbox"
                bind:checked={optPoisoned}
              />
              <span>🧪 {isEn ? 'Poisoned' : '毒塗り (poisoned)'}</span>
            </label>
          </div>
        </div>

        <!-- 5. 生成プレビュー -->
        <div class="wish-preview-box">
          <div class="wish-preview-label">{isEn ? 'Generated Wish Command:' : '送信される願いの文字列:'}</div>
          <div class="wish-preview-command">"{generatedWishString}"</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary btn-large" on:click={handleCancel}>
          {isEn ? 'Cancel' : 'キャンセル'}
        </button>
        <button class="btn btn-primary btn-large" on:click={handleConfirm}>
          ✨ {isEn ? 'Make Wish' : 'この願いを叶える'}
        </button>
      </div>
    </div>
  </div>
{/if}
