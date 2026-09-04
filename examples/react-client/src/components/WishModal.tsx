import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';
import { WishService, WISH_PRESETS, CATEGORY_LABELS } from '@core/knowledge/WishService.js';

const presets = WISH_PRESETS as any[];
const categoryLabels = CATEGORY_LABELS as Record<string, { ja: string; en: string }>;
const wishService = new WishService();

export const WishModal: React.FC = () => {
  const activeWishData = useGameStore((state) => state.activeWishData);
  const setWishData = useGameStore((state) => state.setWishData);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  const { respondPrompt, cancelPrompt } = useNetHackDriver();

  const isEn = currentLanguage === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedItemName, setSelectedItemName] = useState('silver dragon scale mail');

  const [optBlessing, setOptBlessing] = useState<'blessed' | 'uncursed' | 'cursed'>('blessed');
  const [optEnchantment, setOptEnchantment] = useState('2');
  const [optErosion, setOptErosion] = useState('fixed');
  const [optCount, setOptCount] = useState(1);
  const [optGreased, setOptGreased] = useState(false);
  const [optPoisoned, setOptPoisoned] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const catalogByCategory = useMemo<Record<string, any[]>>(() => {
    return (wishService as any).getCatalogByCategory() || {};
  }, []);

  const availableItems = useMemo(() => {
    if (selectedCategory && catalogByCategory[selectedCategory]) {
      return catalogByCategory[selectedCategory];
    }
    return (wishService as any).getCatalog() || [];
  }, [selectedCategory, catalogByCategory]);

  useEffect(() => {
    if (activeWishData) {
      setSearchQuery('');
      setSuggestions([]);
      setSelectedCategory('');
      setSelectedItemName('silver dragon scale mail');
      setOptBlessing('blessed');
      setOptEnchantment('2');
      setOptErosion('fixed');
      setOptCount(1);
      setOptGreased(false);
      setOptPoisoned(false);
    }
  }, [activeWishData]);

  const generatedWishString = useMemo(() => {
    return (wishService as any).serializeWish({
      itemName: selectedItemName,
      blessing: optBlessing,
      enchantment: parseInt(optEnchantment, 10) || 0,
      erosion: optErosion || undefined,
      count: optCount || 1,
      isGreased: optGreased,
      isPoisoned: optPoisoned,
    });
  }, [selectedItemName, optBlessing, optEnchantment, optErosion, optCount, optGreased, optPoisoned]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    const q = val.trim();
    if (q.length === 0) {
      setSuggestions([]);
      return;
    }
    setSuggestions((wishService as any).suggest(q, { limit: 8 }));
  };

  const selectSuggestion = (item: any) => {
    setSelectedItemName(item.name);
    setSelectedCategory(item.category || '');
    setSearchQuery(isEn ? item.name : item.nameJa);
    setSuggestions([]);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cat = e.target.value;
    setSelectedCategory(cat);
    const items = cat && catalogByCategory[cat] ? catalogByCategory[cat] : (wishService as any).getCatalog() || [];
    if (items.length > 0) {
      setSelectedItemName(items[0].name);
    }
  };

  const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedItemName(val);
    const item = availableItems.find((i: any) => i.name === val);
    if (item) {
      setSearchQuery(isEn ? item.name : item.nameJa);
    }
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
    }
  };

  const handleSubmit = useCallback(() => {
    const cmd = generatedWishString;
    setWishData(null);
    respondPrompt(cmd);
  }, [generatedWishString, setWishData, respondPrompt]);

  const handleCancel = useCallback(() => {
    setWishData(null);
    cancelPrompt();
  }, [setWishData, cancelPrompt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeWishData) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeWishData, handleCancel, handleSubmit]);

  if (!activeWishData) return null;

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div className="modal-card modal-large wish-builder-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✨ {isEn ? 'For what do you wish?' : '何をお望みですか？ (Wish Builder)'}</h2>
        </div>

        <div className="wish-modal-body">
          {/* 1. 定番プリセット */}
          <div className="wish-section-title">{isEn ? 'Quick Presets' : '定番プリセット (Quick Presets)'}</div>
          <div className="wish-preset-grid">
            {presets.map((p: any) => (
              <button
                key={p.id}
                className="wish-preset-btn"
                onClick={() => applyPreset(p)}
              >
                <span className="preset-icon">🎁</span>
                <div className="preset-info">
                  <strong className="preset-name">{isEn ? p.labelEn : p.labelJa}</strong>
                  <small className="preset-sub">{p.spec.itemName}</small>
                </div>
              </button>
            ))}
          </div>

          {/* 2. アイテム選択 / 検索 */}
          <div className="wish-section-title">{isEn ? 'Item Search & Selection' : 'アイテム選択 / 検索'}</div>
          <div className="wish-search-container">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              className="wish-search-input"
              placeholder={isEn ? 'Search item (e.g. SDSM, silver dragon, genocide, marker)' : 'アイテム名を入力（日本語 / 英語 / 略称: SDSM, 虐殺 など）'}
              onChange={handleSearchInput}
            />
            {/* サジェストドロップダウン */}
            {suggestions.length > 0 && (
              <div className="wish-suggest-dropdown">
                {suggestions.map((s) => (
                  <div
                    key={s.name}
                    className="wish-suggest-item"
                    onClick={() => selectSuggestion(s)}
                  >
                    <strong>{isEn ? s.name : s.nameJa}</strong>
                    <small>{isEn ? s.nameJa : s.name} ({s.category})</small>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="wish-flex-row">
            <div className="wish-form-group flex-1">
              <label>{isEn ? 'Category Filter:' : 'カテゴリ絞り込み:'}</label>
              <select value={selectedCategory} className="wish-form-control" onChange={handleCategoryChange}>
                <option value="">{isEn ? '(All Categories)' : '(全カテゴリ)'}</option>
                {Object.entries(categoryLabels).map(([cat, lbl]) => (
                  <option key={cat} value={cat}>
                    {isEn ? lbl.en : lbl.ja}
                  </option>
                ))}
              </select>
            </div>

            <div className="wish-form-group flex-2">
              <label>{isEn ? 'Selected Item:' : '選択中アイテム:'}</label>
              <select value={selectedItemName} className="wish-form-control" onChange={handleItemSelect}>
                {availableItems.map((it: any) => (
                  <option key={it.name} value={it.name}>
                    {isEn ? `${it.name} (${it.nameJa})` : `${it.nameJa} (${it.name})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. 詳細オプションビルダー */}
          <div className="wish-section-title">{isEn ? 'Options' : 'オプション設定 (Options)'}</div>
          <div className="wish-builder-grid">
            <div className="wish-form-group">
              <label>{isEn ? 'Blessing:' : '祝福・呪い (Blessing):'}</label>
              <select
                value={optBlessing}
                className="wish-form-control"
                onChange={(e) => setOptBlessing(e.target.value as any)}
              >
                <option value="blessed">{isEn ? 'Blessed' : '祝福された (blessed)'}</option>
                <option value="uncursed">{isEn ? 'Uncursed' : '呪われていない (uncursed)'}</option>
                <option value="cursed">{isEn ? 'Cursed' : '呪われた (cursed)'}</option>
              </select>
            </div>

            <div className="wish-form-group">
              <label>{isEn ? 'Enchantment:' : '強化値 (Enchantment):'}</label>
              <select
                value={optEnchantment}
                className="wish-form-control"
                onChange={(e) => setOptEnchantment(e.target.value)}
              >
                <option value="0">{isEn ? '+0 (None)' : '+0 (指定なし)'}</option>
                <option value="1">+1</option>
                <option value="2">{isEn ? '+2 (Standard Recommended)' : '+2 (標準おすすめ)'}</option>
                <option value="3">+3</option>
                <option value="4">+4</option>
                <option value="5">+5</option>
                <option value="6">+6</option>
                <option value="7">+7</option>
                <option value="-1">-1</option>
              </select>
            </div>

            <div className="wish-form-group">
              <label>{isEn ? 'Proof / Erosion:' : '耐性・防錆 (Proof):'}</label>
              <select
                value={optErosion}
                className="wish-form-control"
                onChange={(e) => setOptErosion(e.target.value)}
              >
                <option value="">{isEn ? 'None (Standard)' : 'なし (標準)'}</option>
                <option value="fixed">{isEn ? 'Fixed (Rust & Fire proof)' : '防錆・耐熱 (fixed)'}</option>
                <option value="rustproof">{isEn ? 'Rustproof' : '錆びない (rustproof)'}</option>
                <option value="fireproof">{isEn ? 'Fireproof' : '耐火 (fireproof)'}</option>
                <option value="corrodeproof">{isEn ? 'Corrodeproof' : '腐食しない (corrodeproof)'}</option>
              </select>
            </div>

            <div className="wish-form-group">
              <label>{isEn ? 'Count:' : '個数 (Count):'}</label>
              <input
                type="number"
                value={optCount}
                className="wish-form-control"
                min="1"
                max="50"
                onChange={(e) => setOptCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <div className="wish-form-group wish-span-2 wish-flex-gap">
              <label className="wish-checkbox-group">
                <input
                  type="checkbox"
                  checked={optGreased}
                  onChange={(e) => setOptGreased(e.target.checked)}
                />
                <span>{isEn ? 'Greased' : '油を塗る (greased)'}</span>
              </label>
              <label className="wish-checkbox-group">
                <input
                  type="checkbox"
                  checked={optPoisoned}
                  onChange={(e) => setOptPoisoned(e.target.checked)}
                />
                <span>{isEn ? 'Poisoned' : '毒を塗る (poisoned)'}</span>
              </label>
            </div>
          </div>

          {/* 4. リアルタイム生成プレビュー */}
          <div className="wish-preview-box">
            <div className="wish-preview-label">{isEn ? 'NetHack command string to send:' : '送信されるNetHackコマンド文字列:'}</div>
            <div className="wish-preview-command">{generatedWishString}</div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>{isEn ? 'Cancel (Esc)' : 'キャンセル (Esc)'}</button>
          <button className="btn btn-primary btn-large" onClick={handleSubmit}>{isEn ? 'Confirm & Wish (Enter)' : '決定して願う (Enter)'}</button>
        </div>
      </div>
    </div>
  );
};
