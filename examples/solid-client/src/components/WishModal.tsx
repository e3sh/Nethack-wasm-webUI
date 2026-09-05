import { Component, createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { activeWishData, currentLanguage } from '../stores/gameStore';
import { driverController } from '../services/useNetHackDriver';
import { WishService, WISH_PRESETS, CATEGORY_LABELS } from '@core/knowledge/WishService.js';
import { trapFocus } from '@core/input/focusTrap.js';

const presets = WISH_PRESETS as any[];
const categoryLabels = CATEGORY_LABELS as Record<string, { ja: string; en: string }>;
const wishService = new WishService();

export const WishModal: Component = () => {
  const isEn = () => currentLanguage() === 'en';

  let modalCardRef: HTMLDivElement | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  const [searchQuery, setSearchQuery] = createSignal('');
  const [suggestions, setSuggestions] = createSignal<any[]>([]);
  const [selectedSuggestIndex, setSelectedSuggestIndex] = createSignal<number>(-1);
  const [selectedCategory, setSelectedCategory] = createSignal('');
  const [selectedItemName, setSelectedItemName] = createSignal('silver dragon scale mail');

  const [optBlessing, setOptBlessing] = createSignal<'blessed' | 'uncursed' | 'cursed'>('blessed');
  const [optEnchantment, setOptEnchantment] = createSignal('2');
  const [optErosion, setOptErosion] = createSignal('fixed');
  const [optCount, setOptCount] = createSignal(1);
  const [optGreased, setOptGreased] = createSignal(false);
  const [optPoisoned, setOptPoisoned] = createSignal(false);

  const activeWishService = createMemo(() => {
    const data = activeWishData();
    const svc = (data?.assistant?.wishService || wishService) as any;
    svc.setLanguage(currentLanguage());
    return svc;
  });

  const catalogByCategory = createMemo<Record<string, any[]>>(() => {
    return activeWishService().getCatalogByCategory() || {};
  });

  const availableItems = createMemo(() => {
    const cat = selectedCategory();
    const byCat = catalogByCategory();
    if (cat && byCat[cat]) {
      return byCat[cat];
    }
    return activeWishService().getCatalog() || [];
  });

  createEffect(() => {
    if (activeWishData()) {
      setSearchQuery('');
      setSuggestions([]);
      setSelectedSuggestIndex(-1);
      setSelectedCategory('');
      setSelectedItemName('silver dragon scale mail');
      setOptBlessing('blessed');
      setOptEnchantment('2');
      setOptErosion('fixed');
      setOptCount(1);
      setOptGreased(false);
      setOptPoisoned(false);
      setTimeout(() => {
        searchInputRef?.focus();
      }, 50);
    }
  });

  const generatedWishString = createMemo(() => {
    return activeWishService().serializeWish({
      itemName: selectedItemName(),
      blessing: optBlessing(),
      enchantment: parseInt(optEnchantment(), 10) || 0,
      erosion: optErosion() || undefined,
      count: optCount() || 1,
      isGreased: optGreased(),
      isPoisoned: optPoisoned(),
    });
  });

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    const q = val.trim();
    if (q.length === 0) {
      setSuggestions([]);
      setSelectedSuggestIndex(-1);
      return;
    }
    setSuggestions(activeWishService().suggest(q, { limit: 8 }));
    setSelectedSuggestIndex(-1);
  };

  const selectSuggestion = (item: any) => {
    setSelectedItemName(item.name);
    setSelectedCategory(item.category || '');
    setSearchQuery(isEn() ? item.name : item.nameJa);
    setSuggestions([]);
    setSelectedSuggestIndex(-1);
  };

  const applyPreset = (p: any) => {
    if (p.spec) {
      if (p.spec.itemName) setSelectedItemName(p.spec.itemName);
      if (p.spec.category) setSelectedCategory(p.spec.category);
      if (p.spec.blessing) setOptBlessing(p.spec.blessing);
      if (p.spec.enchantment !== undefined) setOptEnchantment(String(p.spec.enchantment));
      if (p.spec.erosion !== undefined) setOptErosion(p.spec.erosion);
      if (p.spec.count !== undefined) setOptCount(p.spec.count);
      if (p.spec.isGreased !== undefined) setOptGreased(p.spec.isGreased);
      if (p.spec.isPoisoned !== undefined) setOptPoisoned(p.spec.isPoisoned);
      setSearchQuery(isEn() ? p.spec.itemName : (p.labelJa || p.spec.itemName));
    }
  };

  const handleConfirm = () => {
    const wish = generatedWishString();
    driverController.sendWish(wish);
  };

  const handleCancel = () => {
    driverController.cancelWish();
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    const list = suggestions();
    if (list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestIndex((prev) => (prev + 1) % list.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestIndex((prev) => (prev - 1 + list.length) % list.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const chosen = list[selectedSuggestIndex() >= 0 ? selectedSuggestIndex() : 0];
      if (chosen) {
        selectSuggestion(chosen);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const chosen = list[selectedSuggestIndex() >= 0 ? selectedSuggestIndex() : 0];
      if (chosen) {
        selectSuggestion(chosen);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSuggestions([]);
      setSelectedSuggestIndex(-1);
    }
  };

  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeWishData()) return;
      e.stopPropagation();
      if (suggestions().length === 0 && modalCardRef && trapFocus(modalCardRef, e)) {
        return;
      }
      if (suggestions().length > 0) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
    });
  });

  return (
    <Show when={activeWishData()}>
      <div class="modal-backdrop">
        <div ref={modalCardRef} class="wish-builder-card">
          <div class="modal-header">
            <h2>✨ {isEn() ? 'Wish Builder (#wish)' : '願いの祭壇 (#wish ビルダー)'}</h2>
          </div>

          <div class="wish-modal-body">
            {/* 1. 定番・人気プリセット */}
            <div class="wish-section-title">
              ⭐ {isEn() ? 'Popular Wish Presets' : '定番の願いプリセット'}
            </div>
            <div class="wish-preset-grid">
              <For each={presets}>
                {(p: any) => (
                  <button
                    type="button"
                    class="wish-preset-btn"
                    onClick={() => applyPreset(p)}
                  >
                    <span class="preset-icon">{p.icon || '🎁'}</span>
                    <div class="preset-info">
                      <span class="preset-name">{isEn() ? p.labelEn : p.labelJa}</span>
                      <span class="preset-sub">{p.spec?.itemName}</span>
                    </div>
                  </button>
                )}
              </For>
            </div>

            {/* 2. インクリメンタル検索 */}
            <div class="wish-section-title" style={{ "margin-top": '8px' }}>
              🔍 {isEn() ? 'Item Search & Selection' : 'アイテム検索 ＆ 選択'}
            </div>
            <div class="wish-search-container">
              <input
                ref={searchInputRef}
                type="text"
                class="wish-search-input"
                placeholder={isEn() ? 'Search items (e.g. dragon mail, speed, gauntlets)...' : 'アイテム名・英名・キーワードで検索 (例: ドラゴン, speed, 手袋)...'}
                value={searchQuery()}
                onInput={(e) => handleSearchInput(e.currentTarget.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <Show when={suggestions().length > 0}>
                <div class="wish-suggest-dropdown">
                  <For each={suggestions()}>
                    {(item: any, idx) => (
                      <div
                        class={`wish-suggest-item ${idx() === selectedSuggestIndex() ? 'selected' : ''}`}
                        onClick={() => selectSuggestion(item)}
                        onMouseEnter={() => setSelectedSuggestIndex(idx())}
                      >
                        <span>{isEn() ? item.name : `${item.nameJa} (${item.name})`}</span>
                        <small>{item.category}</small>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* 3. カテゴリと個別アイテム選択 */}
            <div class="wish-flex-row">
              <div class="wish-form-group flex-1">
                <label>{isEn() ? 'Category' : 'カテゴリ'}</label>
                <select
                  class="wish-form-control"
                  value={selectedCategory()}
                  onChange={(e) => {
                    const cat = e.currentTarget.value;
                    setSelectedCategory(cat);
                    const byCat = catalogByCategory();
                    const items = cat && byCat[cat] ? byCat[cat] : (wishService as any).getCatalog() || [];
                    if (items.length > 0) {
                      setSelectedItemName(items[0].name);
                    }
                  }}
                >
                  <option value="">{isEn() ? '-- All Categories --' : '-- 全カテゴリ --'}</option>
                  <For each={Object.entries(categoryLabels)}>
                    {([catKey, labels]) => (
                      <option value={catKey}>{isEn() ? labels.en : labels.ja}</option>
                    )}
                  </For>
                </select>
              </div>

              <div class="wish-form-group flex-2">
                <label>{isEn() ? 'Target Item' : '対象アイテム'}</label>
                <select
                  class="wish-form-control"
                  value={selectedItemName()}
                  onChange={(e) => setSelectedItemName(e.currentTarget.value)}
                >
                  <For each={availableItems()}>
                    {(it: any) => (
                      <option value={it.name}>
                        {isEn() ? it.name : `${it.nameJa} (${it.name})`}
                      </option>
                    )}
                  </For>
                </select>
              </div>
            </div>

            {/* 4. オプションパラメータ */}
            <div class="wish-section-title" style={{ "margin-top": '8px' }}>
              ⚙️ {isEn() ? 'Wish Modifiers & Options' : '属性・強化値・状態設定'}
            </div>
            <div class="wish-builder-grid">
              <div class="wish-form-group">
                <label>{isEn() ? 'Blessing' : '祝福・呪い'}</label>
                <select
                  class="wish-form-control"
                  value={optBlessing()}
                  onChange={(e) => setOptBlessing(e.currentTarget.value as any)}
                >
                  <option value="blessed">✨ {isEn() ? 'Blessed' : '祝福 (blessed)'}</option>
                  <option value="uncursed">{isEn() ? 'Uncursed' : '通常 (uncursed)'}</option>
                  <option value="cursed">💀 {isEn() ? 'Cursed' : '呪い (cursed)'}</option>
                </select>
              </div>

              <div class="wish-form-group">
                <label>{isEn() ? 'Enchantment' : '強化値'}</label>
                <select
                  class="wish-form-control"
                  value={optEnchantment()}
                  onChange={(e) => setOptEnchantment(e.currentTarget.value)}
                >
                  <option value="0">+0</option>
                  <option value="1">+1</option>
                  <option value="2">+2 (Recommended)</option>
                  <option value="3">+3</option>
                </select>
              </div>

              <div class="wish-form-group">
                <label>{isEn() ? 'Erosion/Rust' : '防錆・防腐'}</label>
                <select
                  class="wish-form-control"
                  value={optErosion()}
                  onChange={(e) => setOptErosion(e.currentTarget.value)}
                >
                  <option value="fixed">🛡️ {isEn() ? 'Proof (fixed)' : '耐性付き (fixed/rustproof)'}</option>
                  <option value="">{isEn() ? 'Normal' : '標準 (なし)'}</option>
                </select>
              </div>

              <div class="wish-form-group">
                <label>{isEn() ? 'Quantity' : '数量'}</label>
                <input
                  type="number"
                  class="wish-form-control"
                  min="1"
                  max="10"
                  value={optCount()}
                  onInput={(e) => setOptCount(parseInt(e.currentTarget.value, 10) || 1)}
                />
              </div>

              <div class="wish-form-group wish-span-2 wish-flex-gap">
                <label class="wish-checkbox-group">
                  <input
                    type="checkbox"
                    checked={optGreased()}
                    onChange={(e) => setOptGreased(e.currentTarget.checked)}
                  />
                  <span>🧈 {isEn() ? 'Greased' : '油塗り (greased)'}</span>
                </label>

                <label class="wish-checkbox-group">
                  <input
                    type="checkbox"
                    checked={optPoisoned()}
                    onChange={(e) => setOptPoisoned(e.currentTarget.checked)}
                  />
                  <span>🧪 {isEn() ? 'Poisoned' : '毒塗り (poisoned)'}</span>
                </label>
              </div>
            </div>

            {/* 5. 生成プレビュー */}
            <div class="wish-preview-box">
              <div class="wish-preview-label">{isEn() ? 'Generated Wish Command:' : '送信される願いの文字列:'}</div>
              <div class="wish-preview-command">"{generatedWishString()}"</div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary btn-large" onClick={handleCancel}>
              {isEn() ? 'Cancel' : 'キャンセル'}
            </button>
            <button class="btn btn-primary btn-large" onClick={handleConfirm}>
              ✨ {isEn() ? 'Make Wish' : 'この願いを叶える'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};
