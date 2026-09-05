/**
 * ModalManager - プロンプトバー、メニュー/テキストモーダル、ローディング、ゲームオーバー、スコアボード、願いビルダーマネージャー
 */
import { WishService, WISH_PRESETS, CATEGORY_LABELS } from '../../../../src/core/knowledge/WishService.js';
import { GenocideService, GENOCIDE_PRESETS, MONSTER_CLASS_DEFINITIONS } from '../../../../src/core/knowledge/GenocideService.js';
import { PolymorphService } from '../../../../src/core/knowledge/PolymorphService.js';

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
    elGenocideModal,
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

    this.elGenocideModal = elGenocideModal || document.getElementById('genocide-modal');
    this.activeGenocideService = null;
    this.activeGenocideData = null;
    this.currentGenocideTarget = 'L';
    this.isGenocideDangerOverride = false;

    this.elPolymorphModal = document.getElementById('polymorph-modal');
    this.activePolymorphService = null;
    this.activePolymorphData = null;
    this.currentPolymorphTarget = 'silver dragon';

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
    if (this.elGenocideModal && !this.elGenocideModal.classList.contains('hidden') && this.activeGenocideData) {
      this.showGenocideModal(this.activeGenocideData);
    }
    if (this.elPolymorphModal && !this.elPolymorphModal.classList.contains('hidden') && this.activePolymorphData) {
      this.showPolymorphModal(this.activePolymorphData);
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

    // 💀 GKL 虐殺（Genocide）コンテキスト判定
    if (data.subCategory === 'GENOCIDE' || (data.assistant && data.assistant.type === 'GENOCIDE')) {
      this.showGenocideModal(data);
      return;
    }

    // 🦎 GKL 変化制御（Polymorph Control）コンテキスト判定
    if (data.subCategory === 'POLYMORPH' || (data.assistant && data.assistant.type === 'POLYMORPH')) {
      this.showPolymorphModal(data);
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
    if (this.elGenocideModal) this.elGenocideModal.classList.add('hidden');
    if (this.elPolymorphModal) this.elPolymorphModal.classList.add('hidden');
    const suggestDropdown = document.getElementById('wish-suggest-dropdown');
    if (suggestDropdown) suggestDropdown.classList.remove('active');
    const genocideSuggest = document.getElementById('genocide-suggest-dropdown');
    if (genocideSuggest) genocideSuggest.classList.remove('active');
    const polySuggest = document.getElementById('poly-suggest-dropdown');
    if (polySuggest) polySuggest.style.display = 'none';
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

  showGenocideModal(data) {
    if (!this.elGenocideModal) return;
    const core = this.getCore();
    const genocideService = data.assistant?.genocideService ||
      (core && core.gkl && typeof core.gkl.getGenocideService === 'function' ? core.gkl.getGenocideService() : null) ||
      new GenocideService({ translator: core?.translationEngine || null, language: this.currentLanguage });

    this.activeGenocideService = genocideService;
    this.activeGenocideData = data;

    const lang = this.currentLanguage || 'ja';
    genocideService.setLanguage(lang);
    const assistant = data.assistant || {};
    const mode = assistant.mode || 'CLASS';
    const playerRace = assistant.playerRace || 'human';
    const playerRole = assistant.playerRole || 'valkyrie';

    this.currentGenocideTarget = mode === 'CLASS' ? 'L' : 'master mind flayer';
    this.isGenocideDangerOverride = false;

    // UI要素
    const titleEl = document.getElementById('genocide-modal-title');
    const modeBadgeEl = document.getElementById('genocide-mode-badge');
    const conductDescEl = document.getElementById('genocide-conduct-desc');
    const btnConductNone = document.getElementById('btn-genocide-conduct-none');
    const secPresetsEl = document.getElementById('genocide-sec-presets');
    const presetContainer = document.getElementById('genocide-preset-container');
    const secSearchEl = document.getElementById('genocide-sec-search');
    const searchInput = document.getElementById('genocide-search-input');
    const suggestDropdown = document.getElementById('genocide-suggest-dropdown');
    const alertBox = document.getElementById('genocide-self-alert');
    const alertTitle = document.getElementById('genocide-alert-title');
    const alertDesc = document.getElementById('genocide-alert-desc');
    const chkOverride = document.getElementById('chk-genocide-override');
    const overrideLabel = document.getElementById('genocide-override-label');
    const previewLabel = document.getElementById('genocide-preview-label');
    const previewCmdEl = document.getElementById('genocide-preview-cmd');
    const btnCancel = document.getElementById('btn-genocide-cancel');
    const btnSubmit = document.getElementById('btn-genocide-submit');

    // 多言語テキスト設定
    if (titleEl) titleEl.textContent = lang === 'ja' ? '💀 モンスター虐殺 (Genocide)' : '💀 Genocide Assistant';
    if (modeBadgeEl) {
      if (mode === 'CLASS') {
        modeBadgeEl.textContent = 'CLASS GENOCIDE';
        modeBadgeEl.className = 'mode-badge class-mode';
      } else if (mode === 'SINGLE') {
        modeBadgeEl.textContent = 'SINGLE GENOCIDE';
        modeBadgeEl.className = 'mode-badge single-mode';
      } else {
        modeBadgeEl.textContent = 'GENOCIDE (ALL)';
        modeBadgeEl.className = 'mode-badge all-mode';
      }
    }
    if (conductDescEl) conductDescEl.textContent = lang === 'ja' ? '無虐殺コンダクト（Genocideless）を維持しますか？' : 'Preserve Genocideless conduct?';
    if (btnConductNone) btnConductNone.textContent = lang === 'ja' ? '虐殺を行わない (none)' : 'Do not genocide (none)';
    if (secPresetsEl) {
      if (mode === 'CLASS') {
        secPresetsEl.textContent = lang === 'ja' ? 'おすすめ危険モンスタークラス (Class Presets)' : 'Recommended Monster Classes';
      } else if (mode === 'SINGLE') {
        secPresetsEl.textContent = lang === 'ja' ? 'おすすめ危険モンスター (Single Monster Presets)' : 'Recommended Single Monsters';
      } else {
        secPresetsEl.textContent = lang === 'ja' ? 'おすすめ危険モンスター / クラス' : 'Recommended Targets / Classes';
      }
    }
    if (secSearchEl) secSearchEl.textContent = lang === 'ja' ? '検索・個別指定' : 'Search / Specify Target';
    if (searchInput) {
      if (mode === 'SINGLE') {
        searchInput.placeholder = lang === 'ja' ? 'モンスター名 (flayer, rust 等) を入力...' : 'Type monster name (flayer, rust, etc.)...';
      } else {
        searchInput.placeholder = lang === 'ja' ? 'クラス記号 (L, c, & 等) またはモンスター名 (lich 等) を入力...' : 'Type class symbol (L, c, &) or monster name (lich)...';
      }
    }
    if (alertTitle) alertTitle.textContent = lang === 'ja' ? '自己虐殺警告: 自身が即死します！' : '⚠️ Self-Genocide Warning: Immediate Death!';
    if (overrideLabel) overrideLabel.textContent = lang === 'ja' ? '危険を承知の上で確定を許可する（自殺プロテクト解除）' : 'I understand the danger (Release suicide safeguard)';
    if (previewLabel) previewLabel.textContent = lang === 'ja' ? 'NetHack Cコア送信文字列:' : 'Serialized NetHack Command:';
    if (btnCancel) btnCancel.textContent = lang === 'ja' ? 'キャンセル (Esc)' : 'Cancel (Esc)';
    if (btnSubmit) btnSubmit.textContent = lang === 'ja' ? '虐殺を実行する (Enter)' : 'Execute Genocide (Enter)';

    if (chkOverride) chkOverride.checked = false;

    const updateValidation = () => {
      const serialized = genocideService.serializeCommand(this.currentGenocideTarget);
      if (previewCmdEl) previewCmdEl.textContent = serialized;

      const check = genocideService.checkSelfGenocide(this.currentGenocideTarget, playerRace, playerRole);

      // 単体虐殺モードで1文字のクラス記号が入力されている場合の警告チェック
      const isSingleClassSymbol = mode === 'SINGLE' && this.currentGenocideTarget && this.currentGenocideTarget.trim().length === 1 && this.currentGenocideTarget.trim() !== '?';

      if (isSingleClassSymbol) {
        if (alertBox) alertBox.classList.add('active');
        if (alertTitle) alertTitle.textContent = lang === 'ja' ? '⚠️ 単体虐殺でのクラス指定' : '⚠️ Class Symbol in Single Genocide';
        if (alertDesc) alertDesc.textContent = lang === 'ja'
          ? '単体虐殺ではクラス記号（L, c 等）は無効です。具体的なモンスター名（例: master mind flayer）を入力またはサジェストから選択してください。'
          : 'Class symbols cannot be genocided in Single mode. Specify an individual monster name (e.g. master mind flayer).';
        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.style.backgroundColor = '#4a2222';
        }
      } else if (check.isSelf) {
        if (alertBox) alertBox.classList.add('active');
        if (alertTitle) alertTitle.textContent = lang === 'ja' ? '自己虐殺警告: 自身が即死します！' : '⚠️ Self-Genocide Warning: Immediate Death!';
        if (alertDesc) alertDesc.textContent = lang === 'ja' ? check.reasonJa : check.reasonEn;
        if (btnSubmit) {
          btnSubmit.disabled = !this.isGenocideDangerOverride;
          btnSubmit.style.backgroundColor = this.isGenocideDangerOverride ? '#dc2626' : '#4a2222';
        }
      } else {
        if (alertBox) alertBox.classList.remove('active');
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.style.backgroundColor = '';
        }
      }
    };

    const selectTarget = (target) => {
      this.currentGenocideTarget = target;
      if (searchInput) searchInput.value = target;
      if (suggestDropdown) suggestDropdown.classList.remove('active');
      this.isGenocideDangerOverride = false;
      if (chkOverride) chkOverride.checked = false;

      renderPresets();
      updateValidation();
    };

    const renderPresets = () => {
      if (!presetContainer) return;
      presetContainer.innerHTML = '';
      const targetPresetType = mode === 'CLASS' ? 'CLASS' : (mode === 'SINGLE' ? 'SINGLE' : 'ALL');
      const presets = genocideService.getPresets(targetPresetType);

      presets.forEach(p => {
        const btn = document.createElement('button');
        btn.className = `genocide-preset-btn ${this.currentGenocideTarget === p.target ? 'active' : ''}`;
        const title = lang === 'ja' ? p.labelJa : p.labelEn;
        const desc = lang === 'ja' ? p.descriptionJa : (p.descriptionEn || '');
        btn.innerHTML = `
          <span class="genocide-preset-btn-title">${title}</span>
          <span class="genocide-preset-btn-desc">${desc}</span>
        `;
        btn.onclick = () => selectTarget(p.target);
        presetContainer.appendChild(btn);
      });
    };

    // イベント設定
    if (btnConductNone) {
      btnConductNone.onclick = () => selectTarget('none');
    }

    if (chkOverride) {
      chkOverride.onchange = () => {
        this.isGenocideDangerOverride = chkOverride.checked;
        updateValidation();
      };
    }

    if (searchInput) {
        let genocideSuggestIndex = -1;
        let currentGenocideResults = [];

        const updateGenocideSelection = () => {
          const items = suggestDropdown.querySelectorAll('.genocide-suggest-item');
          items.forEach((item, idx) => {
            if (idx === genocideSuggestIndex) {
              item.style.backgroundColor = '#374151';
              item.scrollIntoView({ block: 'nearest' });
            } else {
              item.style.backgroundColor = '';
            }
          });
        };

        searchInput.oninput = () => {
          const q = searchInput.value.trim();
          this.currentGenocideTarget = q;
          updateValidation();

          if (!suggestDropdown) return;
          if (!q) {
            suggestDropdown.classList.remove('active');
            currentGenocideResults = [];
            genocideSuggestIndex = -1;
            return;
          }

          const results = genocideService.suggest(q, { limit: 8, mode, lang });
          currentGenocideResults = results;
          genocideSuggestIndex = -1;

          if (results.length === 0) {
            suggestDropdown.innerHTML = `<div style="padding: 6px 12px; color: #888;">${lang === 'ja' ? '一致なし' : 'No match'}</div>`;
            suggestDropdown.classList.add('active');
            return;
          }

          suggestDropdown.innerHTML = '';
          results.forEach(r => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'genocide-suggest-item';
            const mainName = lang === 'ja' ? r.nameJa : r.nameEn;
            const subName = lang === 'ja' ? r.nameEn : (r.nameJa !== r.nameEn ? r.nameJa : '');
            const desc = lang === 'ja' ? (r.descJa || '') : (r.descEn || '');
            itemDiv.innerHTML = `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <div>
                  <span style="font-weight: 700; color: ${r.type === 'CLASS' ? '#f59e0b' : '#fff'};">${r.symbol ? `[${r.symbol}] ` : ''}${mainName}</span>
                  ${subName ? `<span style="font-size:0.7rem; color:#888; margin-left:4px;">(${subName})</span>` : ''}
                </div>
                ${desc ? `<span style="font-size:0.68rem; color:#9ca3af;">${desc}</span>` : ''}
              </div>
              <span style="font-size:0.65rem; padding:1px 4px; border-radius:3px; background:#333; color:#aaa;">${r.type}</span>
            `;
            itemDiv.onclick = () => {
              selectTarget(r.target);
              suggestDropdown.classList.remove('active');
              genocideSuggestIndex = -1;
            };
            suggestDropdown.appendChild(itemDiv);
          });
          suggestDropdown.classList.add('active');
        };

        searchInput.onkeydown = (e) => {
          const isDropdownActive = suggestDropdown.classList.contains('active');

          if (e.key === 'ArrowDown') {
            if (isDropdownActive && currentGenocideResults.length > 0) {
              e.preventDefault();
              genocideSuggestIndex = (genocideSuggestIndex + 1) % currentGenocideResults.length;
              updateGenocideSelection();
            }
          } else if (e.key === 'ArrowUp') {
            if (isDropdownActive && currentGenocideResults.length > 0) {
              e.preventDefault();
              genocideSuggestIndex = (genocideSuggestIndex - 1 + currentGenocideResults.length) % currentGenocideResults.length;
              updateGenocideSelection();
            }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isDropdownActive && currentGenocideResults.length > 0) {
              const chosenIdx = genocideSuggestIndex >= 0 ? genocideSuggestIndex : 0;
              const chosen = currentGenocideResults[chosenIdx];
              if (chosen) {
                selectTarget(chosen.target);
                suggestDropdown.classList.remove('active');
                genocideSuggestIndex = -1;
                return;
              }
            }

            if (btnSubmit && !btnSubmit.disabled) {
              btnSubmit.click();
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            if (isDropdownActive) {
              suggestDropdown.classList.remove('active');
              genocideSuggestIndex = -1;
            } else if (btnCancel) {
              btnCancel.click();
            }
          }
        };
      }

    if (btnSubmit) {
      btnSubmit.onclick = () => {
        const finalCmd = genocideService.serializeCommand(this.currentGenocideTarget);
        this.clearAllModals();
        if (core) core.respond(finalCmd);
      };
    }

    if (btnCancel) {
      btnCancel.onclick = () => {
        this.clearAllModals();
        if (core) core.respond('');
      };
    }

    renderPresets();
    updateValidation();
    this.elGenocideModal.classList.remove('hidden');
    if (searchInput) searchInput.focus();
  }

  showPolymorphModal(data) {
    if (!this.elPolymorphModal) return;
    const core = this.getCore();
    const polymorphService = data.assistant?.polymorphService ||
      (core && core.gkl && typeof core.gkl.getPolymorphService === 'function' ? core.gkl.getPolymorphService() : null) ||
      new PolymorphService({ translationEngine: core?.translationEngine || null, language: this.currentLanguage });

    this.activePolymorphService = polymorphService;
    this.activePolymorphData = data;

    const lang = this.currentLanguage || 'ja';
    polymorphService.setLanguage(lang);
    this.currentPolymorphTarget = 'silver dragon';

    // UI要素の取得
    const titleEl = document.getElementById('polymorph-modal-title');
    const secPresetsEl = document.getElementById('poly-sec-presets');
    const presetContainer = document.getElementById('poly-preset-container');
    const btnRandom = document.getElementById('btn-poly-random');
    const btnRehuman = document.getElementById('btn-poly-rehuman');
    const secSearchEl = document.getElementById('poly-sec-search');
    const searchInput = document.getElementById('poly-search-input');
    const suggestDropdown = document.getElementById('poly-suggest-dropdown');
    const specCard = document.getElementById('poly-spec-card');
    const specSymbol = document.getElementById('poly-spec-symbol');
    const specName = document.getElementById('poly-spec-name');
    const specBadges = document.getElementById('poly-spec-badges');
    const armorAlert = document.getElementById('poly-armor-alert');
    const armorAlertText = document.getElementById('poly-armor-alert-text');
    const valSize = document.getElementById('poly-val-size');
    const valHands = document.getElementById('poly-val-hands');
    const valStats = document.getElementById('poly-val-stats');
    const valRes = document.getElementById('poly-val-res');
    const previewLabel = document.getElementById('poly-preview-label');
    const previewCmdEl = document.getElementById('poly-preview-cmd');
    const btnCancel = document.getElementById('btn-poly-cancel');
    const btnSubmit = document.getElementById('btn-poly-submit');

    // 多言語ラベル設定
    if (titleEl) titleEl.textContent = lang === 'ja' ? '🦎 変化制御 (Polymorph Control)' : '🦎 Polymorph Control Assistant';
    if (secPresetsEl) secPresetsEl.textContent = lang === 'ja' ? 'おすすめ定番モンスター' : 'Recommended Presets';
    if (btnRandom) btnRandom.textContent = lang === 'ja' ? '🎲 ランダム変身 (*)' : '🎲 Random Polymorph (*)';
    if (btnRehuman) btnRehuman.textContent = lang === 'ja' ? '👤 自種族復帰 (人型に戻る)' : '👤 Rehumanize (Return)';
    if (secSearchEl) secSearchEl.textContent = lang === 'ja' ? 'モンスター検索・指定' : 'Search / Specify Monster';
    if (searchInput) searchInput.placeholder = lang === 'ja' ? 'モンスター名またはシンボルを入力 (dragon, lich, D 等)...' : 'Type monster name or symbol (dragon, lich, D)...';
    if (previewLabel) previewLabel.textContent = lang === 'ja' ? 'NetHack Cコア送信文字列:' : 'Serialized NetHack Command:';
    if (btnCancel) btnCancel.textContent = lang === 'ja' ? 'キャンセル (Esc)' : 'Cancel (Esc)';
    if (btnSubmit) btnSubmit.textContent = lang === 'ja' ? '決定して変身 (Enter)' : 'Confirm Polymorph (Enter)';

    const tagHands = document.getElementById('poly-filter-hands');
    const tagFly = document.getElementById('poly-filter-fly');
    const tagWalls = document.getElementById('poly-filter-walls');
    const tagArmor = document.getElementById('poly-filter-armor');
    if (tagHands) tagHands.textContent = lang === 'ja' ? '✋ 手あり (装備可能)' : '✋ Has Hands';
    if (tagFly) tagFly.textContent = lang === 'ja' ? '🦅 飛行可能' : '🦅 Flying';
    if (tagWalls) tagWalls.textContent = lang === 'ja' ? '🧱 壁抜け可能' : '🧱 Phasing';
    if (tagArmor) tagArmor.textContent = lang === 'ja' ? '🛡️ 防具破壊なし' : '🛡️ Safe Armor';

    const updatePreviewAndSpec = (target) => {
      let finalTarget = target;
      if (target !== '*' && target) {
        const mon = polymorphService.findMonsterByName(target);
        if (mon) {
          finalTarget = mon.cleanName || PolymorphService.cleanMonsterName(mon.name);
        } else {
          finalTarget = PolymorphService.cleanMonsterName(target);
        }
      }

      this.currentPolymorphTarget = finalTarget;
      if (previewCmdEl) previewCmdEl.textContent = finalTarget;

      if (target === '*' || finalTarget === '*') {
        if (specSymbol) specSymbol.textContent = '*';
        if (specName) specName.textContent = lang === 'ja' ? 'ランダム変身 (*)' : 'Random Monster (*)';
        if (specBadges) specBadges.innerHTML = `<span class="badge badge-info">Random</span>`;
        if (armorAlert) armorAlert.style.display = 'none';
        if (valSize) valSize.textContent = 'RANDOM';
        if (valHands) valHands.textContent = '???';
        if (valStats) valStats.textContent = '???';
        if (valRes) valRes.textContent = '???';
        return;
      }

      const mon = polymorphService.findMonsterByName(target);
      if (!mon) {
        if (specSymbol) specSymbol.textContent = '?';
        if (specName) specName.textContent = finalTarget;
        if (specBadges) specBadges.innerHTML = '';
        if (armorAlert) armorAlert.style.display = 'none';
        if (valSize) valSize.textContent = 'UNKNOWN';
        if (valHands) valHands.textContent = '???';
        if (valStats) valStats.textContent = '???';
        if (valRes) valRes.textContent = '???';
        return;
      }

      if (specSymbol) specSymbol.textContent = mon.symbol || '?';
      if (specName) specName.textContent = `${mon.displayName} (${mon.name})`;

      if (specBadges) {
        specBadges.innerHTML = '';
        if (mon.canFly) specBadges.innerHTML += `<span class="badge badge-info">${lang === 'ja' ? '🦅 飛行' : '🦅 Flying'}</span>`;
        if (mon.passesWalls) specBadges.innerHTML += `<span class="badge badge-success">${lang === 'ja' ? '🧱 壁抜け' : '🧱 Phasing'}</span>`;
        if (mon.canSwim) specBadges.innerHTML += `<span class="badge badge-info">${lang === 'ja' ? '🏊 水泳' : '🏊 Swimming'}</span>`;
        if (mon.hasHands) specBadges.innerHTML += `<span class="badge badge-success">${lang === 'ja' ? '✋ 装備可' : '✋ Hands'}</span>`;
        else specBadges.innerHTML += `<span class="badge badge-gray">${lang === 'ja' ? '手なし' : 'No Hands'}</span>`;
      }

      // 防具破壊判定 (NetHack Cコアの breakarm / sliparm 準拠)
      const risk = mon.armorRisk || polymorphService.checkArmorRisk(mon);
      if (armorAlert && armorAlertText) {
        if (risk.willBreakArmor) {
          armorAlert.className = 'poly-armor-alert danger';
          const details = lang === 'ja' && risk.detailsJa ? risk.detailsJa.join(' ') : (risk.detailsEn ? risk.detailsEn.join(' ') : '');
          armorAlertText.textContent = `${lang === 'ja' ? risk.messageJa : risk.messageEn} ${details}`;
          armorAlert.style.display = 'flex';
        } else if (risk.willDropArmor) {
          armorAlert.className = 'poly-armor-alert warning';
          const details = lang === 'ja' && risk.detailsJa ? risk.detailsJa.join(' ') : (risk.detailsEn ? risk.detailsEn.join(' ') : '');
          armorAlertText.textContent = `${lang === 'ja' ? risk.messageJa : risk.messageEn} ${details}`;
          armorAlert.style.display = 'flex';
        } else {
          armorAlert.className = 'poly-armor-alert safe';
          armorAlertText.textContent = lang === 'ja' ? '🛡️ 防具を破壊することなく安全に変身・着用維持が可能です。' : '🛡️ Safe to polymorph and keep wearing armor.';
          armorAlert.style.display = 'flex';
        }
      }

      if (valSize) valSize.textContent = mon.size || 'MEDIUM';
      if (valHands) {
        let handDesc = '';
        if (mon.hasHands) {
          if (mon.canWearArmor) {
            handDesc = lang === 'ja' ? 'あり (武器・防具使用可)' : 'Yes (Weapons & Armor)';
          } else {
            handDesc = lang === 'ja' ? 'あり (武器可・胴体防具不可)' : 'Yes (Weapons only, No Torso Armor)';
          }
        } else {
          handDesc = lang === 'ja' ? 'なし (装備不可)' : 'No';
        }
        valHands.textContent = handDesc;
      }
      const stats = mon.stats || {};
      if (valStats) valStats.textContent = `HD ${stats.hd ?? '?'} / AC ${stats.ac ?? '?'} / SPD ${stats.speed ?? '?'}`;
      if (valRes) valRes.textContent = mon.resistances && mon.resistances.length > 0 ? mon.resistances.join(', ') : (lang === 'ja' ? 'なし' : 'None');
    };

    // プリセット描画 (コンパクトなチップ並び)
    const renderPresets = () => {
      if (!presetContainer) return;
      presetContainer.innerHTML = '';

      const presets = polymorphService.getPresets();
      presets.forEach(cat => {
        cat.items.forEach(item => {
          const card = document.createElement('div');
          const itemCleanName = item.monster ? (item.monster.cleanName || PolymorphService.cleanMonsterName(item.monster.name)) : item.nameEn;
          const isActive = this.currentPolymorphTarget === item.nameEn || this.currentPolymorphTarget === itemCleanName;
          card.className = `poly-preset-card ${isActive ? 'active' : ''}`;
          card.title = item.note;
          const mon = item.monster;
          const armorRisk = polymorphService.checkArmorRisk(mon ? mon.size : 'MEDIUM');
          const warningIcon = armorRisk.willBreakArmor ? ' ⚠️' : '';

          card.innerHTML = `
            <span style="font-size: 0.65rem; color: #a78bfa; margin-right: 4px;">[${cat.label}]</span>
            <span class="poly-card-symbol" style="color:#ffd700; font-family: monospace; font-weight: bold; margin-right: 2px;">${mon ? mon.symbol : ''}</span>
            <span style="font-size: 0.78rem; font-weight: 600;">${item.displayName}${warningIcon}</span>
          `;

          card.onclick = () => {
            if (searchInput) searchInput.value = item.displayName;
            updatePreviewAndSpec(item.nameEn);
            renderPresets();
          };

          presetContainer.appendChild(card);
        });
      });
    };

    // ショートカットボタン
    if (btnRandom) {
      btnRandom.onclick = () => {
        if (searchInput) searchInput.value = '*';
        updatePreviewAndSpec('*');
        renderPresets();
      };
    }

    if (btnRehuman) {
      btnRehuman.onclick = () => {
        let race = 'human';
        if (core && core.gkl && typeof core.gkl.getCharacterInfo === 'function') {
          const info = core.gkl.getCharacterInfo();
          if (info && info.race) race = info.race;
        }
        if (searchInput) searchInput.value = race;
        updatePreviewAndSpec(race);
        renderPresets();
      };
    }

    // フィルタタグの状態
    const activeFilters = {
      hasHands: false,
      canFly: false,
      passesWalls: false,
      safeArmor: false
    };

    const filterTagIds = {
      hasHands: 'poly-filter-hands',
      canFly: 'poly-filter-fly',
      passesWalls: 'poly-filter-walls',
      safeArmor: 'poly-filter-armor'
    };

    const setupFilterTag = (key) => {
      const el = document.getElementById(filterTagIds[key]);
      if (el) {
        el.classList.toggle('active', activeFilters[key]);
        el.onclick = () => {
          activeFilters[key] = !activeFilters[key];
          el.classList.toggle('active', activeFilters[key]);
          showSuggestions(searchInput ? searchInput.value : '');
        };
      }
    };

    Object.keys(filterTagIds).forEach(setupFilterTag);

    // サジェスト表示 ＆ キーボード選択状態
    let polySuggestIndex = -1;
    let currentPolyResults = [];

    const updatePolySuggestSelection = () => {
      const items = suggestDropdown ? suggestDropdown.querySelectorAll('.poly-suggest-item') : [];
      items.forEach((it, idx) => {
        if (idx === polySuggestIndex) {
          it.classList.add('selected');
          it.scrollIntoView({ block: 'nearest' });
        } else {
          it.classList.remove('selected');
        }
      });
    };

    const showSuggestions = (q) => {
      if (!suggestDropdown) return;
      const results = polymorphService.searchCandidates(q, activeFilters).slice(0, 10);
      currentPolyResults = results;
      polySuggestIndex = -1;

      if (results.length === 0) {
        if (q || Object.values(activeFilters).some(v => v)) {
          suggestDropdown.innerHTML = `<div style="padding: 8px 12px; color: #888; font-size: 0.8rem;">${lang === 'ja' ? '該当するモンスターがいません' : 'No matching monsters found'}</div>`;
          suggestDropdown.style.display = 'block';
        } else {
          suggestDropdown.style.display = 'none';
        }
        return;
      }

      suggestDropdown.innerHTML = '';
      results.forEach((m, idx) => {
        const item = document.createElement('div');
        item.className = 'poly-suggest-item';
        const risk = m.armorRisk || polymorphService.checkArmorRisk(m);
        const alertBadge = risk.willBreakArmor
          ? `<span class="badge badge-danger">${lang === 'ja' ? '鎧破壊' : 'Breaks Armor'}</span>`
          : (risk.willDropArmor ? `<span class="badge badge-warning">${lang === 'ja' ? '防具脱落' : 'Drops'}</span>` : '');

        item.innerHTML = `
          <span>
            <span class="poly-symbol" style="font-size:0.9rem; margin-right:6px;">${m.symbol}</span>
            <strong>${m.displayName}</strong> <span style="font-size:0.7rem; color:#9ca3af;">(${m.name})</span>
          </span>
          <span>${alertBadge}</span>
        `;

        item.onclick = () => {
          if (searchInput) searchInput.value = m.displayName;
          updatePreviewAndSpec(m.name);
          renderPresets();
          suggestDropdown.style.display = 'none';
          polySuggestIndex = -1;
        };

        suggestDropdown.appendChild(item);
      });

      suggestDropdown.style.display = 'block';
    };

    if (searchInput) {
      searchInput.value = 'silver dragon';
      searchInput.oninput = (e) => {
        const val = e.target.value;
        showSuggestions(val);
        const mon = polymorphService.findMonsterByName(val);
        if (mon) {
          updatePreviewAndSpec(mon.name);
          renderPresets();
        } else if (val.trim() === '*') {
          updatePreviewAndSpec('*');
          renderPresets();
        }
      };

      searchInput.onkeydown = (e) => {
        const isDropdownActive = suggestDropdown && suggestDropdown.style.display === 'block';

        if (e.key === 'ArrowDown') {
          if (isDropdownActive && currentPolyResults.length > 0) {
            e.preventDefault();
            polySuggestIndex = (polySuggestIndex + 1) % currentPolyResults.length;
            updatePolySuggestSelection();
            const chosen = currentPolyResults[polySuggestIndex];
            if (chosen) updatePreviewAndSpec(chosen.name);
          }
        } else if (e.key === 'ArrowUp') {
          if (isDropdownActive && currentPolyResults.length > 0) {
            e.preventDefault();
            polySuggestIndex = (polySuggestIndex - 1 + currentPolyResults.length) % currentPolyResults.length;
            updatePolySuggestSelection();
            const chosen = currentPolyResults[polySuggestIndex];
            if (chosen) updatePreviewAndSpec(chosen.name);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (isDropdownActive && currentPolyResults.length > 0 && polySuggestIndex >= 0) {
            const chosen = currentPolyResults[polySuggestIndex];
            if (chosen) {
              searchInput.value = chosen.displayName;
              updatePreviewAndSpec(chosen.name);
              renderPresets();
              suggestDropdown.style.display = 'none';
              polySuggestIndex = -1;
              return;
            }
          }
          if (btnSubmit) btnSubmit.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (isDropdownActive) {
            suggestDropdown.style.display = 'none';
            polySuggestIndex = -1;
          } else if (btnCancel) {
            btnCancel.click();
          }
        }
      };
    }

    if (btnSubmit) {
      btnSubmit.onclick = () => {
        const finalCmd = this.currentPolymorphTarget;
        this.clearAllModals();
        if (core) core.respond(finalCmd);
      };
    }

    if (btnCancel) {
      btnCancel.onclick = () => {
        this.clearAllModals();
        if (core) core.respond('');
      };
    }

    renderPresets();
    updatePreviewAndSpec('silver dragon');
    this.elPolymorphModal.classList.remove('hidden');
    if (searchInput) searchInput.focus();
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
