/**
 * ModalManager - プロンプトバー、メニュー/テキストモーダル、ローディング、ゲームオーバー、スコアボード、願いビルダーマネージャー
 */
import { WishService, WISH_PRESETS, CATEGORY_LABELS } from '../../../../src/core/knowledge/WishService.js';

export class ModalManager {
  constructor({
    elPromptBar,
    elPromptText,
    elInputControls,
    elMenuModal,
    elMenuTitle,
    elMenuItemsContainer,
    elBtnCancelMenu,
    elGameOverModal,
    elGameOverSummary,
    elScoreboardContainer,
    elLoading,
    elSpinnerBox,
    elSelectorCard,
    elSaveName,
    elWishModal,
    getCore,
    getLoadedTileImagePath,
    onRestartGame
  }) {
    this.elPromptBar = elPromptBar;
    this.elPromptText = elPromptText;
    this.elInputControls = elInputControls;

    this.elMenuModal = elMenuModal;
    this.elMenuTitle = elMenuTitle;
    this.elMenuItemsContainer = elMenuItemsContainer;
    this.elBtnCancelMenu = elBtnCancelMenu;

    this.elGameOverModal = elGameOverModal;
    this.elGameOverSummary = elGameOverSummary;
    this.elScoreboardContainer = elScoreboardContainer;

    this.elLoading = elLoading;
    this.elSpinnerBox = elSpinnerBox;
    this.elSelectorCard = elSelectorCard;
    this.elSaveName = elSaveName;

    this.elWishModal = elWishModal || document.getElementById('wish-modal');
    this.currentWishSpec = null;
    this.activeWishService = null;

    this.getCore = getCore || (() => null);
    this.getLoadedTileImagePath = getLoadedTileImagePath || (() => '../../pict/nethack_default_32.png');
    this.onRestartGame = onRestartGame || (() => {});

    this.currentLanguage = 'ja';
    this.isTextWindowMode = false;
    this.isGameExited = false;
    this.isDirectionPromptActive = false;
    this.activeMenuFocusIndex = 0;
    this.selectableMenuButtons = [];
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    if (this.elWishModal && !this.elWishModal.classList.contains('hidden') && this.activeWishService) {
      this.showWishModal({ assistant: { wishService: this.activeWishService } });
    }
  }

  reset() {
    this.isGameExited = false;
    this.isTextWindowMode = false;
    this.isDirectionPromptActive = false;
    this.activeMenuFocusIndex = 0;
    this.selectableMenuButtons = [];
    this.clearAllModals();
    if (this.elGameOverModal) this.elGameOverModal.classList.add('hidden');
    if (this.elSelectorCard) this.elSelectorCard.classList.add('hidden');
  }

  handleInputRequired(data) {
    this.clearAllModals();
    if (this.isGameExited) return;

    const category = data.category || data.promptCategory || 'OTHER';
    const rawPrompt = data.prompt || data.message || data.question || '';
    const items = data.menuItems || data.items || [];
    const textLines = data.lines || [];
    const core = this.getCore();

    // 🎯 GKL 願い（Wishing）コンテキスト判定
    if (data.subCategory === 'WISH' || (data.assistant && data.assistant.type === 'WISH')) {
      this.showWishModal(data);
      return;
    }

    if (textLines && textLines.length > 0) {
      this.isTextWindowMode = true;
      if (this.elMenuModal) this.elMenuModal.classList.remove('hidden');
      if (this.elMenuTitle) this.elMenuTitle.textContent = rawPrompt || 'Information';
      if (this.elMenuItemsContainer) {
        this.elMenuItemsContainer.innerHTML = '';
        textLines.forEach(lineText => {
          const lineDiv = document.createElement('div');
          lineDiv.className = 'text-window-line';
          lineDiv.textContent = lineText;
          this.elMenuItemsContainer.appendChild(lineDiv);
        });
      }

      if (this.elBtnCancelMenu) {
        this.elBtnCancelMenu.textContent = '閉じる / 次へ (Space)';
        this.elBtnCancelMenu.onclick = () => core && core.sendKey('Space');
      }
      return;
    }

    if (category === 'MENU' || (items && items.length > 0)) {
      this.isTextWindowMode = false;
      if (this.elMenuModal) this.elMenuModal.classList.remove('hidden');
      if (this.elMenuTitle) this.elMenuTitle.textContent = rawPrompt || 'Select Item (↑↓ / Enter)';
      if (this.elMenuItemsContainer) this.elMenuItemsContainer.innerHTML = '';
      this.selectableMenuButtons = [];
      this.activeMenuFocusIndex = 0;

      items.forEach((item) => {
        const itemText = item.str || item.text || (typeof item === 'string' ? item : '');
        if (item.isSelectable === false) {
          if (this.elMenuItemsContainer) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'menu-header-item';
            headerDiv.textContent = itemText;
            this.elMenuItemsContainer.appendChild(headerDiv);
          }
          return;
        }

        const btn = document.createElement('button');
        btn.className = 'menu-item-btn';
        const chStr = item.charStr || (item.ch ? String.fromCharCode(item.ch) : '');
        const badgeHtml = chStr ? `<strong style="color:var(--accent-gold);">${chStr})</strong>` : '';
        
        const glyphId = item.glyph !== undefined ? item.glyph : (item.glyphInfo ? item.glyphInfo.glyph : -1);
        const tileImgPath = this.getLoadedTileImagePath() || '../../assets/nethack_default_32.png';
        const glyphHtml = (glyphId >= 0 && core && typeof core.getGlyphHtml === 'function')
          ? core.getGlyphHtml(glyphId, { displaySize: 18, tileImage: tileImgPath })
          : '';

        btn.innerHTML = `${badgeHtml} ${glyphHtml} <span>${itemText}</span>`;

        btn.onclick = () => {
          const val = (item.identifier !== undefined && item.identifier !== 0) ? [{ identifier: item.identifier, count: -1 }] : (item.ch || item.accelerator || itemText);
          if (core) core.respond(val);
        };

        this.selectableMenuButtons.push(btn);
        if (this.elMenuItemsContainer) this.elMenuItemsContainer.appendChild(btn);
      });

      this.updateMenuFocus();
      if (this.elBtnCancelMenu) {
        this.elBtnCancelMenu.textContent = 'Cancel (ESC / 0)';
        this.elBtnCancelMenu.onclick = () => core && core.respond(0);
      }
      return;
    }

    const isLineText = data.inputType === 'LINE_TEXT' || 
                       category === 'TEXT' || 
                       category === 'ASKNAME' || 
                       category === 'FILE' || 
                       category === 'EXTCMD' || 
                       category === 'LINE' || 
                       data.context === 'getlin' || 
                       data.context === 'get_ext_cmd' || 
                       data.context === 'text' || 
                       data.context === 'extcmd';

    if (isLineText) {
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      const promptTitle = data.promptText || data.title || rawPrompt || 'Enter text:';
      if (this.elPromptText) this.elPromptText.textContent = promptTitle;
      if (this.elInputControls) {
        this.elInputControls.innerHTML = `
          <input type="text" id="prompt-text-input" placeholder="Type here..." />
          <button id="btn-submit-text">OK</button>
        `;

        const inputEl = document.getElementById('prompt-text-input');
        const submitBtn = document.getElementById('btn-submit-text');

        const submitAction = () => {
          const val = inputEl.value;
          if (core) core.respond(val);
        };

        if (submitBtn) submitBtn.onclick = submitAction;
        if (inputEl) {
          inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitAction();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              if (core) {
                if (typeof core.cancelPrompt === 'function') {
                  core.cancelPrompt();
                } else {
                  core.respond('\x1b');
                }
              }
            }
          };
          setTimeout(() => inputEl.focus(), 50);
        }
      }
      return;
    }

    if (data.inputType === 'DIRECTION' || category === 'DIRECTION') {
      this.isDirectionPromptActive = true;
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      const isEn = this.currentLanguage === 'en';
      const promptTitle = data.promptText || data.title || rawPrompt || (isEn ? 'In what direction?' : 'どの方向に？');
      if (this.elPromptText) this.elPromptText.textContent = promptTitle;
      if (this.elInputControls) {
        this.elInputControls.innerHTML = `
          <div class="prompt-dir-container">
            <div class="prompt-dir-grid">
              <button class="prompt-dir-btn" data-dir="DIR_NW" title="7 / y (北西)"><span style="font-size:13px; font-weight:bold;">↖</span><span style="font-size:7px; opacity:0.8;">7 / y</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_N"  title="8 / k (北)"><span style="font-size:13px; font-weight:bold;">↑</span><span style="font-size:7px; opacity:0.8;">8 / k</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_NE" title="9 / u (北東)"><span style="font-size:13px; font-weight:bold;">↗</span><span style="font-size:7px; opacity:0.8;">9 / u</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_W"  title="4 / h (西)"><span style="font-size:13px; font-weight:bold;">←</span><span style="font-size:7px; opacity:0.8;">4 / h</span></button>
              <button class="prompt-dir-btn self" data-dir="DIR_SELF" title=". (自身)"><span style="font-size:13px; font-weight:bold;">●</span><span style="font-size:7px; opacity:0.8;">. (自身)</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_E"  title="6 / l (東)"><span style="font-size:13px; font-weight:bold;">→</span><span style="font-size:7px; opacity:0.8;">6 / l</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_SW" title="1 / b (南西)"><span style="font-size:13px; font-weight:bold;">↙</span><span style="font-size:7px; opacity:0.8;">1 / b</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_S"  title="2 / j (南)"><span style="font-size:13px; font-weight:bold;">↓</span><span style="font-size:7px; opacity:0.8;">2 / j</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_SE" title="3 / n (南東)"><span style="font-size:13px; font-weight:bold;">↘</span><span style="font-size:7px; opacity:0.8;">3 / n</span></button>
            </div>
            <div class="prompt-dir-side-actions">
              <button class="prompt-dir-side-btn" data-dir="DIR_UP" title="上階 / 上方向 (<)">▲ ${isEn ? 'Up (<)' : '上方向 (<)'}</button>
              <button class="prompt-dir-side-btn" data-dir="DIR_DOWN" title="下階 / 下方向 (>)>">▼ ${isEn ? 'Down (>)' : '下方向 (>)'}</button>
              <button class="prompt-dir-side-btn cancel" id="btn-cancel-dir" title="取消 (ESC)">✖ ${isEn ? 'Cancel (ESC)' : '取消 (ESC)'}</button>
            </div>
          </div>
        `;

        this.elInputControls.querySelectorAll('button[data-dir]').forEach(btn => {
          btn.onclick = () => {
            if (core) core.respond(btn.dataset.dir);
          };
        });

        const btnCancel = document.getElementById('btn-cancel-dir');
        if (btnCancel) {
          btnCancel.onclick = () => {
            if (core) {
              if (typeof core.cancelPrompt === 'function') {
                core.cancelPrompt();
              } else {
                core.respond('\x1b');
              }
            }
          };
        }
      }

      return;
    }

    if (data.options && data.options.length > 0) {
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      if (this.elPromptText) this.elPromptText.textContent = data.promptText || data.title || rawPrompt || 'Select Option';
      if (this.elInputControls) {
        this.elInputControls.innerHTML = '';
        data.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.textContent = opt.label.includes(`(${opt.key})`) ? opt.label : `${opt.label} (${opt.key})`;
          btn.onclick = () => core && core.respond(opt.key);
          this.elInputControls.appendChild(btn);
        });
      }
      return;
    }

    if (data.inputType === 'SINGLE_KEY' || category === 'YN' || data.context === 'yn_function') {
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      const promptTitle = data.promptText || data.title || rawPrompt || 'Press key...';
      if (this.elPromptText) this.elPromptText.textContent = promptTitle;
      if (this.elInputControls) {
        this.elInputControls.innerHTML = `
          <span style="font-size:12px; color:var(--text-secondary); padding:4px 8px;">(1キー入力待機 / Press key)</span>
          <button id="btn-cancel-single-key" class="prompt-cancel-btn" style="padding:4px 10px; font-size:11px; margin-left:6px;">✖ 取消 (ESC)</button>
        `;
        const btnCancel = document.getElementById('btn-cancel-single-key');
        if (btnCancel) {
          btnCancel.onclick = () => {
            if (core) {
              if (typeof core.cancelPrompt === 'function') {
                core.cancelPrompt();
              } else {
                core.respond('\x1b');
              }
            }
          };
        }
      }
      return;
    }

    if (this.elPromptBar) this.elPromptBar.classList.add('hidden');
  }

  updateMenuFocus() {
    this.selectableMenuButtons.forEach((btn, index) => {
      if (index === this.activeMenuFocusIndex) {
        btn.classList.add('focus');
        btn.scrollIntoView({ block: 'nearest' });
      } else {
        btn.classList.remove('focus');
      }
    });
  }

  clearAllModals() {
    if (this.elPromptBar) this.elPromptBar.classList.add('hidden');
    if (this.elMenuModal) this.elMenuModal.classList.add('hidden');
    if (this.elWishModal) this.elWishModal.classList.add('hidden');
    const suggestDropdown = document.getElementById('wish-suggest-dropdown');
    if (suggestDropdown) suggestDropdown.classList.remove('active');
    this.isTextWindowMode = false;
  }

  showWishModal(data) {
    if (!this.elWishModal) return;
    const core = this.getCore();
    const wishService = data.assistant?.wishService || 
      (core && core.gkl && typeof core.gkl.getWishService === 'function' ? core.gkl.getWishService() : null) || 
      new WishService({ language: this.currentLanguage });

    this.activeWishService = wishService;
    wishService.setLanguage(this.currentLanguage);

    const catalog = wishService.getCatalog();
    const byCategory = wishService.getCatalogByCategory();

    const I18N = {
      ja: {
        modalTitle: '✨ 何をお望みですか？ (For what do you wish?)',
        secPresets: '定番プリセット (Quick Presets)',
        secSearch: 'アイテム選択 / 検索',
        searchPlaceholder: 'アイテム名を入力（日本語 / 英語 / 略称: SDSM, 虐殺 など）',
        catFilter: 'カテゴリ絞り込み:',
        allCats: '(全カテゴリ)',
        itemSelect: '選択中アイテム:',
        secOptions: 'オプション設定 (Options)',
        blessing: '祝福・呪い (Blessing):',
        bBlessed: '祝福された (blessed)',
        bUncursed: '呪われていない (uncursed)',
        bCursed: '呪われた (cursed)',
        enchantment: '強化値 (Enchantment):',
        e0: '+0 (指定なし)',
        e2: '+2 (標準おすすめ)',
        erosion: '耐性・防錆 (Proof):',
        pNone: 'なし (標準)',
        pFixed: '防錆・耐熱 (fixed)',
        pRust: '錆びない (rustproof)',
        pFire: '耐火 (fireproof)',
        pCorrode: '腐食しない (corrodeproof)',
        count: '個数 (Count):',
        greased: '油を塗る (greased)',
        poisoned: '毒を塗る (poisoned)',
        preview: '送信されるNetHackコマンド文字列:',
        noItem: '(アイテムを選択してください)',
        btnCancel: 'キャンセル (Esc)',
        btnSubmit: '決定して願う (Enter)',
        noSuggest: '該当アイテムなし'
      },
      en: {
        modalTitle: '✨ For what do you wish?',
        secPresets: 'Quick Presets',
        secSearch: 'Item Selection & Search',
        searchPlaceholder: 'Search item (e.g. SDSM, silver dragon, genocide, death)',
        catFilter: 'Filter by Category:',
        allCats: '(All Categories)',
        itemSelect: 'Selected Item:',
        secOptions: 'Options Configuration',
        blessing: 'Blessing Status:',
        bBlessed: 'blessed',
        bUncursed: 'uncursed',
        bCursed: 'cursed',
        enchantment: 'Enchantment (+N):',
        e0: '+0 (None)',
        e2: '+2 (Recommended)',
        erosion: 'Erosion Proof:',
        pNone: 'None',
        pFixed: 'fixed (rust & fireproof)',
        pRust: 'rustproof',
        pFire: 'fireproof',
        pCorrode: 'corrodeproof',
        count: 'Quantity (Count):',
        greased: 'greased',
        poisoned: 'poisoned',
        preview: 'Generated NetHack Command:',
        noItem: '(Please select an item)',
        btnCancel: 'Cancel (Esc)',
        btnSubmit: 'Confirm & Wish (Enter)',
        noSuggest: 'No matching items'
      }
    };

    const lang = this.currentLanguage === 'en' ? 'en' : 'ja';
    const t = I18N[lang];

    let currentSpec = {
      itemName: 'silver dragon scale mail',
      category: 'ARMOR',
      blessing: 'blessed',
      enchantment: 2,
      erosion: 'fixed',
      count: 1,
      isGreased: false,
      isPoisoned: false
    };

    // UIテキスト更新
    const elTitle = document.getElementById('wish-modal-title');
    if (elTitle) elTitle.textContent = t.modalTitle;
    const elSecPresets = document.getElementById('wish-sec-presets');
    if (elSecPresets) elSecPresets.textContent = t.secPresets;
    const elSecSearch = document.getElementById('wish-sec-search');
    if (elSecSearch) elSecSearch.textContent = t.secSearch;
    const elSearchInput = document.getElementById('wish-search-input');
    if (elSearchInput) elSearchInput.placeholder = t.searchPlaceholder;
    const elLblCat = document.getElementById('wish-lbl-cat-filter');
    if (elLblCat) elLblCat.textContent = t.catFilter;
    const elLblItem = document.getElementById('wish-lbl-item-select');
    if (elLblItem) elLblItem.textContent = t.itemSelect;
    const elSecOptions = document.getElementById('wish-sec-options');
    if (elSecOptions) elSecOptions.textContent = t.secOptions;
    const elLblBless = document.getElementById('wish-lbl-blessing');
    if (elLblBless) elLblBless.textContent = t.blessing;
    const elOptBBlessed = document.getElementById('wish-opt-b-blessed');
    if (elOptBBlessed) elOptBBlessed.textContent = t.bBlessed;
    const elOptBUncursed = document.getElementById('wish-opt-b-uncursed');
    if (elOptBUncursed) elOptBUncursed.textContent = t.bUncursed;
    const elOptBCursed = document.getElementById('wish-opt-b-cursed');
    if (elOptBCursed) elOptBCursed.textContent = t.bCursed;
    const elLblEnch = document.getElementById('wish-lbl-enchantment');
    if (elLblEnch) elLblEnch.textContent = t.enchantment;
    const elOptE0 = document.getElementById('wish-opt-e-0');
    if (elOptE0) elOptE0.textContent = t.e0;
    const elOptE2 = document.getElementById('wish-opt-e-2');
    if (elOptE2) elOptE2.textContent = t.e2;
    const elLblErosion = document.getElementById('wish-lbl-erosion');
    if (elLblErosion) elLblErosion.textContent = t.erosion;
    const elOptPNone = document.getElementById('wish-opt-p-none');
    if (elOptPNone) elOptPNone.textContent = t.pNone;
    const elOptPFixed = document.getElementById('wish-opt-p-fixed');
    if (elOptPFixed) elOptPFixed.textContent = t.pFixed;
    const elOptPRust = document.getElementById('wish-opt-p-rust');
    if (elOptPRust) elOptPRust.textContent = t.pRust;
    const elOptPFire = document.getElementById('wish-opt-p-fire');
    if (elOptPFire) elOptPFire.textContent = t.pFire;
    const elOptPCorrode = document.getElementById('wish-opt-p-corrode');
    if (elOptPCorrode) elOptPCorrode.textContent = t.pCorrode;
    const elLblCount = document.getElementById('wish-lbl-count');
    if (elLblCount) elLblCount.textContent = t.count;
    const elLblGreased = document.getElementById('wish-lbl-greased');
    if (elLblGreased) elLblGreased.textContent = t.greased;
    const elLblPoisoned = document.getElementById('wish-lbl-poisoned');
    if (elLblPoisoned) elLblPoisoned.textContent = t.poisoned;
    const elLblPreview = document.getElementById('wish-lbl-preview');
    if (elLblPreview) elLblPreview.textContent = t.preview;
    const elBtnCancel = document.getElementById('btn-wish-cancel');
    if (elBtnCancel) elBtnCancel.textContent = t.btnCancel;
    const elBtnSubmit = document.getElementById('btn-wish-submit');
    if (elBtnSubmit) elBtnSubmit.textContent = t.btnSubmit;

    // 1. プリセットボタン描画
    const presetContainer = document.getElementById('wish-preset-container');
    if (presetContainer) {
      presetContainer.innerHTML = '';
      const presets = (data.assistant && data.assistant.presets) || wishService.getPresets();
      presets.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'wish-preset-btn';
        const label = lang === 'ja' ? preset.labelJa : preset.labelEn;
        btn.innerHTML = label;
        btn.title = preset.labelEn;
        btn.onclick = () => {
          applySpec(preset.spec);
        };
        presetContainer.appendChild(btn);
      });
    }

    // 2. カテゴリ選択ドロップダウン
    const catFilterEl = document.getElementById('wish-cat-filter');
    const itemSelectEl = document.getElementById('wish-item-select');

    const populateCategorySelect = () => {
      if (!catFilterEl) return;
      const currentCat = catFilterEl.value;
      catFilterEl.innerHTML = `<option value="">${t.allCats}</option>`;
      Object.keys(byCategory).sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        const catLabel = CATEGORY_LABELS[cat] ? (lang === 'ja' ? CATEGORY_LABELS[cat].ja : CATEGORY_LABELS[cat].en) : cat;
        opt.textContent = `${catLabel} (${byCategory[cat].length})`;
        catFilterEl.appendChild(opt);
      });
      catFilterEl.value = currentCat;
    };

    const populateItemSelect = (selectedCategory = '') => {
      if (!itemSelectEl) return;
      itemSelectEl.innerHTML = '';
      const items = selectedCategory ? (byCategory[selectedCategory] || []) : catalog;
      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.name;
        if (lang === 'ja') {
          opt.textContent = `${item.nameJa || item.name} [${item.name}]`;
        } else {
          opt.textContent = item.name;
        }
        itemSelectEl.appendChild(opt);
      });
      if (items.length > 0) {
        itemSelectEl.value = currentSpec.itemName || items[0].name;
      }
    };

    const onItemChange = (itemName) => {
      const item = catalog.find(it => it.name === itemName);
      if (!item) return;

      currentSpec.itemName = item.name;
      currentSpec.category = item.category;

      const optEnch = document.getElementById('wish-opt-enchantment');
      const optErosion = document.getElementById('wish-opt-erosion');
      const optCount = document.getElementById('wish-opt-count');

      if (optEnch) optEnch.disabled = !item.options.allowEnchantment;
      if (optErosion) optErosion.disabled = !item.options.allowErosionProof;
      if (optCount) optCount.disabled = !item.options.allowCount;

      if (!item.options.allowEnchantment) currentSpec.enchantment = 0;
      if (!item.options.allowErosionProof) currentSpec.erosion = null;
      if (!item.options.allowCount) currentSpec.count = 1;

      updateFormInputs();
      updatePreview();
    };

    if (catFilterEl) {
      catFilterEl.onchange = () => {
        populateItemSelect(catFilterEl.value);
        if (itemSelectEl) onItemChange(itemSelectEl.value);
      };
    }

    if (itemSelectEl) {
      itemSelectEl.onchange = () => {
        onItemChange(itemSelectEl.value);
      };
    }

    // 3. インクリメンタルサジェスト
    const suggestDropdown = document.getElementById('wish-suggest-dropdown');
    if (elSearchInput && suggestDropdown) {
      elSearchInput.value = '';
      elSearchInput.oninput = () => {
        const q = elSearchInput.value.trim();
        if (!q) {
          suggestDropdown.classList.remove('active');
          return;
        }

        const results = wishService.suggest(q, { limit: 12, lang });
        if (results.length === 0) {
          suggestDropdown.innerHTML = `<div style="padding: 8px 12px; color: #888;">${t.noSuggest}</div>`;
          suggestDropdown.classList.add('active');
          return;
        }

        suggestDropdown.innerHTML = '';
        results.forEach(it => {
          const div = document.createElement('div');
          div.className = 'wish-suggest-item';
          const mainName = lang === 'ja' ? (it.nameJa || it.name) : it.name;
          const subName = lang === 'ja' ? it.name : (it.nameJa !== it.name ? it.nameJa : '');
          div.innerHTML = `
            <div>
              <span class="wish-suggest-name-main">${mainName}</span>
              ${subName ? `<span class="wish-suggest-name-sub">${subName}</span>` : ''}
            </div>
            <span class="wish-suggest-cat">${it.category}</span>
          `;
          div.onclick = () => {
            elSearchInput.value = mainName;
            suggestDropdown.classList.remove('active');
            if (catFilterEl) catFilterEl.value = it.category;
            populateItemSelect(it.category);
            if (itemSelectEl) itemSelectEl.value = it.name;
            onItemChange(it.name);
          };
          suggestDropdown.appendChild(div);
        });
        suggestDropdown.classList.add('active');
      };

      const closeSuggestHandler = (e) => {
        if (!elSearchInput.contains(e.target) && !suggestDropdown.contains(e.target)) {
          suggestDropdown.classList.remove('active');
        }
      };
      document.addEventListener('click', closeSuggestHandler);
    }

    // 4. 属性フォームバインド
    const optBless = document.getElementById('wish-opt-blessing');
    if (optBless) optBless.onchange = (e) => { currentSpec.blessing = e.target.value; updatePreview(); };
    const optEnch = document.getElementById('wish-opt-enchantment');
    if (optEnch) optEnch.onchange = (e) => { currentSpec.enchantment = parseInt(e.target.value, 10); updatePreview(); };
    const optErosion = document.getElementById('wish-opt-erosion');
    if (optErosion) optErosion.onchange = (e) => { currentSpec.erosion = e.target.value || null; updatePreview(); };
    const optCount = document.getElementById('wish-opt-count');
    if (optCount) optCount.oninput = (e) => { currentSpec.count = parseInt(e.target.value, 10) || 1; updatePreview(); };
    const optGreased = document.getElementById('wish-opt-greased');
    if (optGreased) optGreased.onchange = (e) => { currentSpec.isGreased = e.target.checked; updatePreview(); };
    const optPoisoned = document.getElementById('wish-opt-poisoned');
    if (optPoisoned) optPoisoned.onchange = (e) => { currentSpec.isPoisoned = e.target.checked; updatePreview(); };

    const applySpec = (spec) => {
      currentSpec = { ...spec };
      if (catFilterEl) catFilterEl.value = spec.category || '';
      populateItemSelect(spec.category || '');
      if (itemSelectEl) itemSelectEl.value = spec.itemName;
      onItemChange(spec.itemName);
      updateFormInputs();
      updatePreview();
    };

    const updateFormInputs = () => {
      if (optBless) optBless.value = currentSpec.blessing || 'blessed';
      if (optEnch) optEnch.value = currentSpec.enchantment !== undefined ? currentSpec.enchantment : 0;
      if (optErosion) optErosion.value = currentSpec.erosion || '';
      if (optCount) optCount.value = currentSpec.count || 1;
      if (optGreased) optGreased.checked = !!currentSpec.isGreased;
      if (optPoisoned) optPoisoned.checked = !!currentSpec.isPoisoned;
    };

    const previewCmdEl = document.getElementById('wish-preview-cmd');
    const updatePreview = () => {
      const cmd = wishService.serializeWish(currentSpec);
      if (previewCmdEl) previewCmdEl.textContent = cmd || t.noItem;
    };

    // 5. 決定 / キャンセルボタン
    if (elBtnSubmit) {
      elBtnSubmit.onclick = () => {
        const finalCmd = wishService.serializeWish(currentSpec);
        this.clearAllModals();
        if (core) core.respond(finalCmd);
      };
    }

    if (elBtnCancel) {
      elBtnCancel.onclick = () => {
        this.clearAllModals();
        if (core) core.respond('');
      };
    }

    // 初期化実行
    populateCategorySelect();
    populateItemSelect();
    applySpec(currentSpec);

    // モーダル表示
    this.elWishModal.classList.remove('hidden');
    if (elSearchInput) elSearchInput.focus();
  }

  async handleExited(result) {
    this.isGameExited = true;
    this.clearAllModals();

    if (this.elGameOverModal) this.elGameOverModal.classList.remove('hidden');
    
    const titleEl = document.getElementById('gameover-title');
    if (titleEl) {
      titleEl.textContent = 
        result.reason === 'ascended' ? '🎉 ASCENDED!' : (result.reason === 'save_and_exit' ? '💾 Game Saved' : '💀 GAME OVER');
    }

    const deathText = result.translatedDeath || result.deathMessage || result.death || 'Unknown causes';
    const scoreText = result.finalScore !== undefined ? result.finalScore : 0;
    if (this.elGameOverSummary) {
      this.elGameOverSummary.innerHTML = `
        <p><strong>Player:</strong> ${result.playerName || 'Hero'}</p>
        <p><strong>Result:</strong> ${deathText}</p>
        <p><strong>Final Score:</strong> <span style="color:var(--accent-gold); font-size:1.1em;">${scoreText}</span></p>
      `;
    }

    this.renderScoreboard(result.scoreboard || []);
  }

  renderScoreboard(scores) {
    if (!this.elScoreboardContainer) return;
    this.elScoreboardContainer.innerHTML = '';
    if (!scores || scores.length === 0) {
      this.elScoreboardContainer.innerHTML = '<p style="padding:10px; color:#888;">No high score records found.</p>';
      return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 1px solid #333; color: var(--primary-color);">
          <th style="padding:6px; text-align:left;">#</th>
          <th style="padding:6px; text-align:left;">Score</th>
          <th style="padding:6px; text-align:left;">Name</th>
          <th style="padding:6px; text-align:left;">Death Reason</th>
        </tr>
      </thead>
      <tbody>
        ${scores.map((sc, idx) => `
          <tr style="border-bottom: 1px solid #222;">
            <td style="padding:6px; color:#888;">${idx + 1}</td>
            <td style="padding:6px; color:var(--accent-gold); font-weight:bold;">${sc.points || sc.score || 0}</td>
            <td style="padding:6px;">${sc.name || 'Hero'} (${sc.role || ''})</td>
            <td style="padding:6px; color:#aaa;">${sc.death || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    this.elScoreboardContainer.appendChild(table);
  }
}
