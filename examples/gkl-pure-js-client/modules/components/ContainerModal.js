/**
 * ContainerModal.js
 *
 * ビジュアル・コンテナUI（二面パネルGUI＆ドラッグ＆ドロップ操作）
 * プレイヤー所持品 ⇄ コンテナ中身の直感的・グラフィカルな相互移動と
 * Bag of Holding 防爆セーフティガードの統合ビュー。
 */

export class ContainerModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.elContainerModal] - モーダル外枠DOM
   * @param {Function} options.getCore - WebUICore インスタンス取得関数
   * @param {Function} [options.getLoadedTileImagePath] - タイル画像パス取得関数
   */
  constructor(options = {}) {
    this.options = options;
    this.elContainerModal = options.elContainerModal || document.getElementById('container-modal');
    this.getCore = options.getCore || (() => null);
    this.containerController = options.containerController || null;
    this.getLoadedTileImagePath = options.getLoadedTileImagePath || (() => '../../pict/nethack_default_32.png');

    this.currentLanguage = 'ja';
    this.isVisible = false;

    // 現在開いているコンテナの情報
    this.containerName = '';
    this.containerType = 'UNKNOWN';
    this.isBagOfHolding = false;
    this.containerItems = [];

    // 選択中アイテム
    this.selectedLeftItem = null;
    this.selectedLeftIndex = null;
    this.selectedRightItem = null;
    this.selectedRightIndex = null;

    // 数量指定 (-1 = 全量)
    this.specifiedQuantity = -1;

    // 保留中の危険アイテム投入タスク (警告モーダル用)
    this._pendingWarningAction = null;

    // トランザクション処理中フラグ (SSOT 二重操作防止)
    this.isProcessing = false;

    // 表示形式: 'list' (詳細リスト) または 'grid' (IconInventory風アイコングリッド)
    let savedViewMode = 'list';
    try {
      savedViewMode = localStorage.getItem('nethack_container_view_mode') || 'list';
    } catch (e) {
      // localStorage 非対応環境
    }
    this.viewMode = savedViewMode === 'grid' ? 'grid' : 'list';

    this._ensureDom();
  }

  /**
   * 表示モード（リスト/グリッド）の切り替え
   * @param {'list'|'grid'} mode
   */
  setViewMode(mode) {
    const validMode = mode === 'grid' ? 'grid' : 'list';
    if (this.viewMode === validMode) return;
    this.viewMode = validMode;
    try {
      localStorage.setItem('nethack_container_view_mode', validMode);
    } catch (e) {
      // ignore
    }
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * ContainerController の取得
   * @returns {Object|null}
   */
  getContainerController() {
    if (this.containerController) return this.containerController;
    if (typeof this.options?.getContainerController === 'function') {
      return this.options.getContainerController();
    }
    const core = this.getCore();
    return (core && core.containerController) || null;
  }

  setLanguage(lang) {
    this.currentLanguage = lang === 'en' ? 'en' : 'ja';
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * アイテムのカテゴリや名前から絵文字シンボルを取得 (InventoryView 準拠)
   * @param {Object} item
   * @returns {string} 絵文字
   */
  getItemSymbol(item) {
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

    const text = (item.rawText || item.rawStr || item.str || item.name || '').toLowerCase();
    if (text.includes('dagger') || text.includes('sword') || text.includes('knife') || text.includes('blade') || text.includes('axe') || text.includes('bow')) return '⚔️';
    if (text.includes('armor') || text.includes('shield') || text.includes('helmet') || text.includes('boots') || text.includes('cloak') || text.includes('gloves') || text.includes('suit') || text.includes('mail')) return '🛡️';
    if (text.includes('potion')) return '🧪';
    if (text.includes('scroll')) return '📜';
    if (text.includes('wand')) return '🪄';
    if (text.includes('ring')) return '💍';
    if (text.includes('amulet')) return '🧿';
    if (text.includes('spellbook') || text.includes('book')) return '📖';
    if (text.includes('food') || text.includes('ration') || text.includes('apple') || text.includes('corpse') || text.includes('meat') || text.includes('egg')) return '🍖';
    if (text.includes('gold') || text.includes('zorkmid')) return '💰';
    if (text.includes('sack') || text.includes('bag') || text.includes('chest') || text.includes('box')) return '📦';
    if (text.includes('key') || text.includes('lock pick')) return '🗝️';

    return '📦';
  }

  /**
   * アイテムのタイル画像または絵文字アイコンHTMLを生成
   * @param {Object} item
   * @param {number} [displaySize=20]
   * @private
   */
  _getItemIconHtml(item, displaySize = 20) {
    const core = this.getCore();
    const glyphId = item.glyphId !== undefined ? item.glyphId : (item.glyph !== undefined ? item.glyph : -1);
    if (glyphId >= 0 && core && typeof core.getGlyphHtml === 'function') {
      const tileImgPath = this.getLoadedTileImagePath();
      const glyphHtml = core.getGlyphHtml(glyphId, { tileImage: tileImgPath, displaySize });
      if (glyphHtml) {
        return `<span class="container-item-icon">${glyphHtml}</span>`;
      }
    }
    return `<span class="container-item-icon container-item-emoji">${this.getItemSymbol(item)}</span>`;
  }

  /**
   * アイテムのスタック個数を取得
   * @param {Object} item
   * @returns {number}
   * @private
   */
  _getItemCount(item) {
    if (!item) return 1;
    if (typeof item.count === 'number' && item.count > 0) return item.count;
    if (typeof item.quantity === 'number' && item.quantity > 0) return item.quantity;
    const text = item.rawText || item.rawStr || item.str || item.name || '';
    const m = text.match(/^(\d+)\s+/);
    if (m) return parseInt(m[1], 10);
    return 1;
  }

  /**
   * テキストを翻訳 (日本語設定時)
   * @private
   */
  _getTranslatedName(rawText, isEn) {
    if (isEn || !rawText) return rawText;
    const core = this.getCore();
    if (core && typeof core.translate === 'function') {
      return core.translate(rawText);
    }
    return rawText;
  }

  /**
   * DOM構造の確保（index.html に存在しない場合は自動生成）
   * @private
   */
  _ensureDom() {
    if (!this.elContainerModal) {
      this.elContainerModal = document.createElement('div');
      this.elContainerModal.id = 'container-modal';
      this.elContainerModal.className = 'modal-backdrop hidden';
      document.body.appendChild(this.elContainerModal);
    }
  }

  /**
   * コンテナモーダルを表示
   * @param {Object} data
   */
  show(data = {}) {
    this.isProcessing = false;
    this.containerName = data.containerName || 'Container';
    this.containerType = data.containerType || 'UNKNOWN';
    this.isBagOfHolding = !!data.isBagOfHolding;
    if (Array.isArray(data.contents)) {
      this.containerItems = data.contents;
    } else if (data.contents && Array.isArray(data.contents.items)) {
      this.containerItems = data.contents.items;
    } else {
      this.containerItems = [];
    }

    this.selectedLeftItem = null;
    this.selectedLeftIndex = null;
    this.selectedRightItem = null;
    this.selectedRightIndex = null;
    if (!this.isVisible) {
      this.specifiedQuantity = -1;
    }
    this._pendingWarningAction = null;
    this.isVisible = true;

    if (this.elContainerModal) {
      this.elContainerModal.classList.remove('hidden');
    }

    this.render();
  }

  /**
   * コンテナモーダルを非表示
   */
  hide() {
    this.isVisible = false;
    this.isProcessing = false;
    this._pendingWarningAction = null;
    if (this.elContainerModal) {
      this.elContainerModal.classList.add('hidden');
    }
  }

  /**
   * 閉じるボタン / ESC / 'q' 押下時の処理
   */
  close() {
    this.isProcessing = false;
    const ctrl = this.getContainerController();
    if (ctrl && typeof ctrl.closeSession === 'function') {
      ctrl.closeSession();
    } else {
      const core = this.getCore();
      if (core && typeof core.closeContainerSession === 'function') {
        core.closeContainerSession();
      }
    }
    this.hide();
  }

  /**
   * 二面パネル全体の再描画
   */
  render() {
    if (!this.elContainerModal || !this.isVisible) return;
    const isEn = this.currentLanguage === 'en';
    const core = this.getCore();
    const ctrl = this.getContainerController();

    // プレイヤー所持品リストの取得
    let playerItems = [];
    const invMgr = (core && core.gkl && core.gkl.inventoryStateManager) || (core && core.inventoryStateManager);
    if (invMgr) {
      if (typeof invMgr.getItems === 'function') {
        playerItems = [...(invMgr.getItems() || [])];
      } else if (Array.isArray(invMgr.items)) {
        playerItems = [...invMgr.items];
      }
    }

    // プレイヤー所持金 (Au / Gold) の合成表示
    let playerGoldAmount = 0;
    if (core && typeof core.getStatus === 'function') {
      const st = core.getStatus();
      if (st && st.gold && typeof st.gold.amount === 'number') {
        playerGoldAmount = st.gold.amount;
      }
    } else if (this.options && typeof this.options.goldAmount === 'number') {
      playerGoldAmount = this.options.goldAmount;
    }

    if (playerGoldAmount > 0) {
      const goldText = isEn ? `${playerGoldAmount} gold pieces` : `${playerGoldAmount}枚の金貨`;
      playerItems.unshift({
        letter: '$',
        invlet: '$',
        accelerator: '$',
        rawText: goldText,
        name: isEn ? 'gold pieces' : '金貨',
        str: goldText,
        glyphId: 3886,
        isGold: true,
        count: playerGoldAmount,
        quantity: playerGoldAmount,
        category: 'GOLD'
      });
    }

    // コンテナ中身リストの取得 (contentsManager SSOT を優先。空の場合は show() 等で渡されたアイテムを維持)
    if (ctrl && ctrl.contentsManager) {
      const currentItems = ctrl.contentsManager.getItems();
      if (Array.isArray(currentItems) && (currentItems.length > 0 || !this.containerItems || this.containerItems.length === 0)) {
        this.containerItems = currentItems;
      }
    }

    // 各アイテムの投入可否バリデーション (SSOT)
    const validationMap = new Map();
    if (ctrl && typeof ctrl.validatePutIn === 'function') {
      playerItems.forEach(item => {
        validationMap.set(item, ctrl.validatePutIn(item));
      });
    }

    // 投入先が BoH の場合、各アイテムのセーフティ評価を事前計算
    const safetyMap = new Map();
    if (this.isBagOfHolding && ctrl && typeof ctrl.checkSafety === 'function') {
      playerItems.forEach(item => {
        const assessment = ctrl.checkSafety([item]);
        const isCritical = assessment.critical ? assessment.critical.length > 0 : (assessment.criticalItems && assessment.criticalItems.length > 0);
        const isSuspicious = assessment.suspicious ? assessment.suspicious.length > 0 : (assessment.suspiciousItems && assessment.suspiciousItems.length > 0);
        if (isCritical) {
          safetyMap.set(item, 'CRITICAL');
        } else if (isSuspicious) {
          safetyMap.set(item, 'SUSPICIOUS');
        } else {
          safetyMap.set(item, 'SAFE');
        }
      });
    }

    // 防爆セーフティバッジ HTML
    let safetyBadgeHtml = '';
    if (this.isBagOfHolding) {
      safetyBadgeHtml = `
        <span class="container-safety-badge safety-active" title="${isEn ? 'Explosion Guard Active' : 'BoH防爆ガード作動中'}">
          🛡️ ${isEn ? 'Safety Guard Active' : '防爆セーフティ稼働中'}
        </span>
      `;
    }

    // コンテナ総重量 & BoH 軽減情報の算出
    const encMgr = (core && core.gkl && typeof core.gkl.getEncumbranceStateManager === 'function')
      ? core.gkl.getEncumbranceStateManager()
      : null;

    let bagWeight = 15;
    let bohEffectText = '';
    const itemsCount = this.containerItems.length;

    if (encMgr) {
      const curContainer = ctrl?.currentContainer;
      const letter = curContainer?.letter || curContainer?.invlet;
      if (letter && encMgr.containerCache.has(letter)) {
        const rec = encMgr.containerCache.get(letter);
        bagWeight = rec.effectiveWeight;
        if (rec.containerType === 'BAG_OF_HOLDING') {
          if (rec.bcursed > 0) bohEffectText = isEn ? '[ Magic: 75% reduced ]' : '[ 魔法効果: 75% 軽減中 ]';
          else if (rec.bcursed === 0) bohEffectText = isEn ? '[ Magic: 50% reduced ]' : '[ 魔法効果: 50% 軽減中 ]';
          else if (rec.bcursed < 0) bohEffectText = isEn ? '[ Cursed: 200% burden ]' : '[ 呪い: 200% 重加算 ]';
        }
      } else {
        let rawWt = 0;
        this.containerItems.forEach(it => { rawWt += encMgr.getItemWeight(it); });
        const buc = this.containerName ? (this.containerName.toLowerCase().includes('blessed') ? 1 : (this.containerName.toLowerCase().includes('cursed') && !this.containerName.toLowerCase().includes('uncursed') ? -1 : 0)) : 0;
        if (this.isBagOfHolding) {
          if (buc > 0) { bagWeight = 15 + Math.ceil(rawWt / 4); bohEffectText = isEn ? '[ Magic: 75% reduced ]' : '[ 魔法効果: 75% 軽減中 ]'; }
          else if (buc < 0) { bagWeight = 15 + rawWt * 2; bohEffectText = isEn ? '[ Cursed: 200% burden ]' : '[ 呪い: 200% 重加算 ]'; }
          else { bagWeight = 15 + Math.ceil(rawWt / 2); bohEffectText = isEn ? '[ Magic: 50% reduced ]' : '[ 魔法効果: 50% 軽減中 ]'; }
        } else {
          bagWeight = 15 + rawWt;
        }
      }
    }

    const weightBadgeHtml = `
      <span class="container-weight-badge" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; background:rgba(255,255,255,0.08); padding:3px 8px; border-radius:4px; color:#a6adc8;" title="${isEn ? `Total bag weight: ${bagWeight}` : `袋全体の総重量: ${bagWeight}`}">
        <span>⚖️</span>
        <span>${isEn ? `Weight: ${bagWeight} (${itemsCount} items)` : `重量: ${bagWeight} (${itemsCount}個)`}</span>
        ${bohEffectText ? `<span style="color:#a6e3a1; font-weight:bold; margin-left:2px;">${bohEffectText}</span>` : ''}
      </span>
    `;

    // HTML 構造の構築
    this.elContainerModal.innerHTML = `
      <div class="container-modal-card${this.isProcessing ? ' is-processing' : ''}" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="container-modal-header">
          <div class="container-modal-title-box">
            <h3 class="container-modal-title">
              📦 <span>${this._getTranslatedName(this.containerName, isEn)}</span>
              ${this.isProcessing ? `<span style="font-size: 12px; font-weight: normal; color: #f9e2af; margin-left: 8px;">⏳ ${isEn ? 'Processing...' : '処理中...'}</span>` : ''}
            </h3>
            ${safetyBadgeHtml}
            ${weightBadgeHtml}
          </div>
          <div class="container-modal-header-actions">
            <!-- ビュー切り替えトグル (リスト ⇄ アイコン) -->
            <div class="container-view-toggle" role="group" aria-label="${isEn ? 'View Mode' : '表示切替'}">
              <button class="container-toggle-btn ${this.viewMode === 'list' ? 'active' : ''}" id="btn-view-list" title="${isEn ? 'List View (Detailed)' : 'リスト表示 (詳細)'}">
                ☰ <span class="toggle-text">${isEn ? 'List' : 'リスト'}</span>
              </button>
              <button class="container-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}" id="btn-view-grid" title="${isEn ? 'Icon View (Grid)' : 'アイコン表示 (グリッド)'}">
                ⊞ <span class="toggle-text">${isEn ? 'Icons' : 'アイコン'}</span>
              </button>
            </div>
            <button class="container-close-btn" id="btn-container-close" title="${isEn ? 'Close (ESC / q)' : '閉じる (ESC / q)'}">✕</button>
          </div>
        </div>

        <!-- Main Body: Two-Pane Layout -->
        <div class="container-two-pane-body">
          <!-- Left Pane: Player Inventory -->
          <div class="container-pane" id="pane-player-inventory">
            <div class="container-pane-header">
              <span class="pane-title">🎒 ${isEn ? 'Inventory (Put In)' : '所持品 (入れる)'}</span>
              <span class="pane-badge-count" id="badge-left-count">${playerItems.length}</span>
            </div>
            <div class="container-item-list ${this.viewMode === 'grid' ? 'is-grid-view' : 'is-list-view'}" id="list-player-inventory">
              ${this.viewMode === 'grid'
                ? this._renderPlayerItemsGridHtml(playerItems, safetyMap, validationMap, isEn)
                : this._renderPlayerItemsHtml(playerItems, safetyMap, validationMap, isEn)}
            </div>
          </div>

          <!-- Middle Action Controls -->
          <div class="container-middle-controls">
            <!-- 数量指定コントロール -->
            <div class="container-quantity-box">
              <label for="input-container-qty">${isEn ? 'Qty:' : '数量'}</label>
              <input type="number" id="input-container-qty" min="1" max="999" placeholder="all" value="${this.specifiedQuantity > 0 ? this.specifiedQuantity : ''}" />
            </div>

            <button class="container-action-btn btn-put" id="btn-container-put" disabled title="${isEn ? 'Put In' : '入れる'}">
              <span class="btn-icon">▶</span>
              <span class="btn-label">${isEn ? 'Put' : '入れる'}</span>
            </button>
            <button class="container-action-btn btn-take" id="btn-container-take" disabled title="${isEn ? 'Take Out' : '出す'}">
              <span class="btn-icon">◀</span>
              <span class="btn-label">${isEn ? 'Take' : '出す'}</span>
            </button>
            <button class="container-action-btn btn-all" id="btn-container-put-all" title="${isEn ? 'Put All' : '全て入れる'}">
              <span class="btn-icon">▶▶</span>
              <span class="btn-label">${isEn ? 'All In' : '全入'}</span>
            </button>
            <button class="container-action-btn btn-all" id="btn-container-take-all" title="${isEn ? 'Take All' : '全て出す'}">
              <span class="btn-icon">◀◀</span>
              <span class="btn-label">${isEn ? 'All Out' : '全出'}</span>
            </button>
          </div>

          <!-- Right Pane: Container Contents -->
          <div class="container-pane" id="pane-container-contents">
            <div class="container-pane-header">
              <span class="pane-title">📦 ${isEn ? 'Inside Container' : '鞄・箱の中身'}</span>
              <span class="pane-badge-count" id="badge-right-count">${this.containerItems.length}</span>
            </div>
            <div class="container-item-list ${this.viewMode === 'grid' ? 'is-grid-view' : 'is-list-view'}" id="list-container-contents">
              ${this.viewMode === 'grid'
                ? this._renderContainerItemsGridHtml(this.containerItems, isEn)
                : this._renderContainerItemsHtml(this.containerItems, isEn)}
            </div>
          </div>

          <!-- Warning Sub-Modal (Hidden by default) -->
          <div class="container-warning-modal hidden" id="container-warning-modal"></div>
        </div>

        <!-- Debug / Sequence Status Panel -->
        <div class="container-debug-panel" id="container-debug-panel" style="background:#11111b; border-top:1px solid rgba(255,255,255,0.1); padding:4px 12px; font-family:monospace; font-size:11px; color:#a6adc8; display:flex; justify-content:space-between; align-items:center;">
          <div id="container-debug-text" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%;">
            ${this._renderDebugInfoHtml(core, isEn)}
          </div>
        </div>

        <!-- Footer -->
        <div class="container-modal-footer">
          <div class="container-footer-hint">
            💡 <span>${isEn ? 'Click or Drag & Drop items between panes. 1 turn used per action.' : 'クリックまたはドラッグ＆ドロップで出し入れ。1操作で1ターン消費します。'}</span>
          </div>
          <div class="container-footer-actions">
            <button class="container-footer-btn" id="btn-container-done">
              ${isEn ? 'Done (Close)' : '完了 (閉じる)'}
            </button>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(playerItems, safetyMap, validationMap);
  }

  /**
   * 左パネル（所持品）のアイテムリストHTML生成
   * @private
   */
  _renderPlayerItemsHtml(items, safetyMap, validationMap, isEn) {
    if (items.length === 0) {
      return `<div class="container-empty-hint">${isEn ? 'No items in inventory' : '所持品がありません'}</div>`;
    }

    return items.map((item, idx) => {
      const isSelected = (this.selectedLeftIndex === idx);
      const safety = safetyMap.get(item) || 'SAFE';
      const validation = validationMap ? validationMap.get(item) : null;
      const isInvalid = validation ? (validation.valid === false || validation.allowed === false) : false;
      const reason = validation ? validation.reason : null;

      const isSelfContainer = reason === 'SELF_CONTAINER';
      const isEquipped = reason === 'EQUIPPED' || item.isWielded || item.isWorn || item.worn || item.isQuivered;
      const isCritical = safety === 'CRITICAL' || reason === 'BOH_CRITICAL';
      const isSuspicious = safety === 'SUSPICIOUS' || reason === 'BOH_SUSPICIOUS';

      const rowClasses = ['container-item-row'];
      if (isSelected) rowClasses.push('selected');
      if (isInvalid) rowClasses.push('item-disabled');
      if (isSelfContainer) rowClasses.push('self-container');
      if (isCritical) rowClasses.push('boh-danger-critical');

      // 装備・コンテナ自身バッジ
      let equipBadge = '';
      if (isSelfContainer) {
        equipBadge = `<span class="badge-self-container" title="${isEn ? 'Cannot put current container into itself' : '開いているコンテナ自身です'}">🚫 ${isEn ? 'Container' : '開いている鞄'}</span>`;
      } else if (item.isWielded) {
        equipBadge = `<span class="badge-wielded">${isEn ? 'Wield' : '武器'}</span>`;
      } else if (item.isWorn || isEquipped) {
        equipBadge = `<span class="badge-worn">${isEn ? 'Worn' : '装備'}</span>`;
      }

      // 危険バッジ
      let dangerBadge = '';
      if (isCritical) {
        dangerBadge = `<span class="boh-danger-badge critical" title="${isEn ? 'Will EXPLODE Bag of Holding!' : 'Bag of Holding が爆発します！'}">⚠️ ${isEn ? 'EXPLODE' : '危険(爆発)'}</span>`;
      } else if (isSuspicious) {
        dangerBadge = `<span class="boh-danger-badge suspicious" title="${isEn ? 'Unidentified wand/bag - Caution!' : '未識別の杖/袋 - 要注意'}">❓ ${isEn ? 'Unid' : '未識別'}</span>`;
      }

      const letter = item.letter || item.invlet || '';
      const rawText = item.rawText || item.name || '';
      const displayName = this._getTranslatedName(rawText, isEn);
      const iconHtml = this._getItemIconHtml(item);
      const canDrag = !isInvalid && !isCritical && !this.isProcessing;
      const itemId = item.identifier || item.onum || item.letter || idx;

      return `
        <div class="${rowClasses.join(' ')}" 
             data-side="left" 
             data-index="${idx}"
             data-id="${itemId}"
             data-letter="${letter}"
             draggable="${canDrag}"
             tabindex="0">
          <span class="item-letter-badge">${letter ? letter + ')' : ''}</span>
          ${iconHtml}
          <span class="item-name-box" title="${displayName}">${displayName}</span>
          <div class="item-tag-badges">
            ${equipBadge}
            ${dangerBadge}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 右パネル（コンテナ中身）のアイテムリストHTML生成
   * @private
   */
  _renderContainerItemsHtml(items, isEn) {
    if (items.length === 0) {
      return `<div class="container-empty-hint">${isEn ? 'Container is empty' : 'コンテナの中身は空です'}</div>`;
    }

    return items.map((item, idx) => {
      const isSelected = (this.selectedRightIndex === idx);

      const rowClasses = ['container-item-row'];
      if (isSelected) rowClasses.push('selected');

      const letter = item.accelerator || item.letter || item.charStr || (item.ch ? String.fromCharCode(item.ch) : '');
      const rawText = item.rawStr || item.str || item.name || '';
      const displayName = this._getTranslatedName(rawText, isEn);
      const iconHtml = this._getItemIconHtml(item);
      const itemId = item.identifier || item.onum || item.letter || idx;

      return `
        <div class="${rowClasses.join(' ')}" 
             data-side="right" 
             data-index="${idx}"
             data-id="${itemId}"
             draggable="true"
             tabindex="0">
          <span class="item-letter-badge">${letter ? letter + ')' : ''}</span>
          ${iconHtml}
          <span class="item-name-box" title="${displayName}">${displayName}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * 左パネル（所持品）のアイテムグリッドHTML生成 (IconInventory風)
   * @private
   */
  _renderPlayerItemsGridHtml(items, safetyMap, validationMap, isEn) {
    if (items.length === 0) {
      return `<div class="container-empty-hint">${isEn ? 'No items in inventory' : '所持品がありません'}</div>`;
    }

    return items.map((item, idx) => {
      const isSelected = (this.selectedLeftIndex === idx);
      const safety = safetyMap.get(item) || 'SAFE';
      const validation = validationMap ? validationMap.get(item) : null;
      const isInvalid = validation ? (validation.valid === false || validation.allowed === false) : false;
      const reason = validation ? validation.reason : null;

      const isSelfContainer = reason === 'SELF_CONTAINER';
      const isEquipped = reason === 'EQUIPPED' || item.isWielded || item.isWorn || item.worn || item.isQuivered;
      const isCritical = safety === 'CRITICAL' || reason === 'BOH_CRITICAL';
      const isSuspicious = safety === 'SUSPICIOUS' || reason === 'BOH_SUSPICIOUS';

      const slotClasses = ['container-item-row', 'container-item-slot'];
      if (isSelected) slotClasses.push('selected');
      if (isInvalid) slotClasses.push('item-disabled');
      if (isSelfContainer) slotClasses.push('self-container');
      if (isCritical) slotClasses.push('boh-danger-critical');
      if (isSuspicious) slotClasses.push('boh-danger-suspicious');

      // 装備バッジ
      let equipBadge = '';
      if (isSelfContainer) {
        equipBadge = `<span class="slot-badge badge-self-container" title="${isEn ? 'Current container' : '開いている鞄'}">🚫</span>`;
      } else if (item.isWielded) {
        equipBadge = `<span class="slot-badge badge-wielded" title="${isEn ? 'Main weapon' : 'メイン武器'}">${isEn ? 'W' : '手'}</span>`;
      } else if (item.isOffhand) {
        equipBadge = `<span class="slot-badge badge-offhand" title="${isEn ? 'Off-hand weapon' : '副武器'}">${isEn ? 'O' : '副'}</span>`;
      } else if (item.isQuivered) {
        equipBadge = `<span class="slot-badge badge-quivered" title="${isEn ? 'Quiver' : '矢筒'}">${isEn ? 'Q' : '筒'}</span>`;
      } else if (item.isWorn || isEquipped) {
        equipBadge = `<span class="slot-badge badge-worn" title="${isEn ? 'Worn armor' : '着用防具'}">${isEn ? 'A' : '着'}</span>`;
      }

      // 危険バッジ
      let dangerBadge = '';
      if (isCritical) {
        dangerBadge = `<span class="slot-badge badge-danger-critical" title="${isEn ? 'Will EXPLODE Bag of Holding!' : 'Bag of Holding が爆発します！'}">⚠️</span>`;
      } else if (isSuspicious) {
        dangerBadge = `<span class="slot-badge badge-danger-suspicious" title="${isEn ? 'Unidentified wand/bag' : '未識別の杖/袋'}">❓</span>`;
      }

      // BUCバッジ
      const id = item.identification || (item.knowledge && item.knowledge.identification) || {};
      const bucStatus = id.bucStatus || item.bucStatus || 'UNKNOWN';
      let bucBadge = '';
      if (id.isUnidentified) {
        bucBadge = `<span class="slot-badge badge-buc-unid" title="${isEn ? 'Unidentified' : '未識別'}">?</span>`;
      } else if (bucStatus === 'CURSED') {
        bucBadge = `<span class="slot-badge badge-buc-cursed" title="${isEn ? 'Cursed' : '呪い'}">-</span>`;
      } else if (bucStatus === 'BLESSED') {
        bucBadge = `<span class="slot-badge badge-buc-blessed" title="${isEn ? 'Blessed' : '祝福'}">+</span>`;
      }

      const letter = item.letter || item.invlet || '';
      const rawText = item.rawText || item.name || '';
      const displayName = this._getTranslatedName(rawText, isEn);
      const iconHtml = this._getItemIconHtml(item, 32);
      const canDrag = !isInvalid && !isCritical && !this.isProcessing;
      const itemId = item.identifier || item.onum || item.letter || idx;
      const count = this._getItemCount(item);

      return `
        <div class="${slotClasses.join(' ')}" 
             data-side="left" 
             data-index="${idx}"
             data-id="${itemId}"
             data-letter="${letter}"
             draggable="${canDrag}"
             tabindex="0"
             title="${displayName}">
          <span class="slot-letter">${letter}</span>
          <div class="slot-icon-box">${iconHtml}</div>
          ${count > 1 ? `<span class="slot-count-badge">${count > 999 ? Math.floor(count / 1000) + 'k' : count}</span>` : ''}
          <div class="slot-badges-box">
            ${equipBadge}
            ${dangerBadge}
            ${bucBadge}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 右パネル（コンテナ中身）のアイテムグリッドHTML生成 (IconInventory風)
   * @private
   */
  _renderContainerItemsGridHtml(items, isEn) {
    if (items.length === 0) {
      return `<div class="container-empty-hint">${isEn ? 'Container is empty' : 'コンテナの中身は空です'}</div>`;
    }

    return items.map((item, idx) => {
      const isSelected = (this.selectedRightIndex === idx);

      const slotClasses = ['container-item-row', 'container-item-slot'];
      if (isSelected) slotClasses.push('selected');

      const letter = item.accelerator || item.letter || item.charStr || (item.ch ? String.fromCharCode(item.ch) : '');
      const rawText = item.rawStr || item.str || item.name || '';
      const displayName = this._getTranslatedName(rawText, isEn);
      const iconHtml = this._getItemIconHtml(item, 32);
      const itemId = item.identifier || item.onum || item.letter || idx;
      const count = this._getItemCount(item);

      return `
        <div class="${slotClasses.join(' ')}" 
             data-side="right" 
             data-index="${idx}"
             data-id="${itemId}"
             draggable="true"
             tabindex="0"
             title="${displayName}">
          <span class="slot-letter">${letter}</span>
          <div class="slot-icon-box">${iconHtml}</div>
          ${count > 1 ? `<span class="slot-count-badge">${count > 999 ? Math.floor(count / 1000) + 'k' : count}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * アイテム転送の共通実行 (ctrl.transferItem 優先, core.executeContainerTransfer フォールバック)
   * @private
   */
  async _transferItem(options) {
    const ctrl = this.getContainerController();
    if (ctrl && typeof ctrl.transferItem === 'function') {
      return await ctrl.transferItem(options);
    }
    const core = this.getCore();
    if (core && typeof core.executeContainerTransfer === 'function') {
      return await core.executeContainerTransfer(options);
    }
    return { success: false, error: new Error('No container transfer provider available.') };
  }

  /**
   * 直近トランザクションのデバッグ表示HTML生成
   * @private
   */
  _renderDebugInfoHtml(core, isEn) {
    const ctrl = this.getContainerController();
    const debug = (ctrl && ctrl.lastTransactionDebug) ? ctrl.lastTransactionDebug : null;
    if (!debug) {
      return `<span style="color:#6c7086;">${isEn ? 'Status: Standby at poskey' : '状態: 通常ターン待機中 (poskey)'}</span>`;
    }
    const statusColor = (debug.success || debug.status === 'SUCCESS') ? '#a6e3a1' : '#f38ba8';
    const statusText = debug.success !== undefined ? (debug.success ? 'SUCCESS' : 'ERROR') : debug.status;
    const dirText = debug.direction ? `[${debug.direction.toUpperCase()}] ` : '';
    const itemName = debug.item ? (debug.item.name || debug.item.str || debug.item.rawText || '') : '';
    const qtyText = debug.quantity !== undefined ? ` (qty: ${debug.quantity})` : '';
    const errText = debug.error ? ` | Error: ${debug.error.message || debug.error}` : '';
    return `
      <span style="color:${statusColor}; font-weight:bold;">[${statusText}]</span>
      <span style="color:#89b4fa; margin-left:6px;">${dirText}${itemName}${qtyText}</span>
      <span style="color:#cdd6f4; margin-left:6px;">${errText}</span>
    `;
  }

  /**
   * イベントリスナーのバインド
   * @private
   */
  _bindEvents(playerItems, safetyMap, validationMap) {
    const isEn = this.currentLanguage === 'en';
    const core = this.getCore();

    // 表示切り替えボタン (リスト ⇄ アイコン)
    const btnViewList = document.getElementById('btn-view-list');
    if (btnViewList) {
      btnViewList.onclick = () => this.setViewMode('list');
    }
    const btnViewGrid = document.getElementById('btn-view-grid');
    if (btnViewGrid) {
      btnViewGrid.onclick = () => this.setViewMode('grid');
    }

    // 閉じるボタン
    const btnClose = document.getElementById('btn-container-close');
    if (btnClose) btnClose.onclick = () => this.close();

    const btnDone = document.getElementById('btn-container-done');
    if (btnDone) btnDone.onclick = () => this.close();

    // 数量入力
    const inputQty = document.getElementById('input-container-qty');
    if (inputQty) {
      inputQty.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        this.specifiedQuantity = (isNaN(val) || val <= 0) ? -1 : val;
      };
    }

    // 左パネル（所持品）クリック & ダブルクリック & ドラッグ開始
    const leftRows = this.elContainerModal.querySelectorAll('#list-player-inventory .container-item-row');
    leftRows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const item = playerItems[idx];
      if (!item) return;

      const validation = validationMap ? validationMap.get(item) : null;
      const isInvalid = validation ? (validation.valid === false || validation.allowed === false) : false;

      // クリックで選択 (処理中または無効アイテムは選択不可)
      row.onclick = () => {
        if (this.isProcessing || isInvalid) return;
        this.selectedLeftItem = item;
        this.selectedLeftIndex = idx;
        this.selectedRightItem = null;
        this.selectedRightIndex = null;
        this._updateSelectionStyles();
      };

      // ダブルクリックで即座投入 (処理中または無効アイテムは不可)
      row.ondblclick = () => {
        if (this.isProcessing || isInvalid) return;
        this.selectedLeftItem = item;
        this.selectedLeftIndex = idx;
        this.executePutIn(item, this.specifiedQuantity);
      };

      // ドラッグ開始
      row.ondragstart = (e) => {
        if (this.isProcessing || isInvalid) {
          e.preventDefault();
          return;
        }
        const safety = safetyMap.get(item);
        if (safety === 'CRITICAL') {
          e.preventDefault();
          return;
        }
        row.classList.add('dragging');
        e.dataTransfer.setData('text/plain', JSON.stringify({
          side: 'left',
          index: idx,
          letter: item.letter || item.invlet,
          identifier: item.identifier,
          rawText: item.rawText,
        }));
      };

      row.ondragend = () => {
        row.classList.remove('dragging');
      };
    });

    // 右パネル（コンテナ中身）クリック & ダブルクリック & ドラッグ開始
    const rightRows = this.elContainerModal.querySelectorAll('#list-container-contents .container-item-row');
    rightRows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const item = this.containerItems[idx];
      if (!item) return;

      // クリックで選択 (処理中は不可)
      row.onclick = () => {
        if (this.isProcessing) return;
        this.selectedRightItem = item;
        this.selectedRightIndex = idx;
        this.selectedLeftItem = null;
        this.selectedLeftIndex = null;
        this._updateSelectionStyles();
      };

      // ダブルクリックで即座取り出し (処理中は不可)
      row.ondblclick = () => {
        if (this.isProcessing) return;
        this.selectedRightItem = item;
        this.selectedRightIndex = idx;
        this.executeTakeOut(item, this.specifiedQuantity);
      };

      // ドラッグ開始
      row.ondragstart = (e) => {
        if (this.isProcessing) {
          e.preventDefault();
          return;
        }
        row.classList.add('dragging');
        e.dataTransfer.setData('text/plain', JSON.stringify({
          side: 'right',
          index: idx,
          identifier: item.identifier,
          rawText: item.rawStr || item.str,
        }));
      };

      row.ondragend = () => {
        row.classList.remove('dragging');
      };
    });

    // 中央ボタン: [ ▶ 入れる ]
    const btnPut = document.getElementById('btn-container-put');
    if (btnPut) {
      btnPut.onclick = () => {
        if (!this.isProcessing && this.selectedLeftItem) {
          this.executePutIn(this.selectedLeftItem, this.specifiedQuantity);
        }
      };
    }

    // 中央ボタン: [ ◀ 出す ]
    const btnTake = document.getElementById('btn-container-take');
    if (btnTake) {
      btnTake.onclick = () => {
        if (!this.isProcessing && this.selectedRightItem) {
          this.executeTakeOut(this.selectedRightItem, this.specifiedQuantity);
        }
      };
    }

    // 中央ボタン: [ ▶▶ 全て入れる ]
    const btnPutAll = document.getElementById('btn-container-put-all');
    if (btnPutAll) {
      btnPutAll.onclick = () => {
        if (!this.isProcessing) {
          this.executePutAll(playerItems, safetyMap);
        }
      };
    }

    // 中央ボタン: [ ◀◀ 全て出す ]
    const btnTakeAll = document.getElementById('btn-container-take-all');
    if (btnTakeAll) {
      btnTakeAll.onclick = () => {
        if (!this.isProcessing) {
          this.executeTakeAll(this.containerItems);
        }
      };
    }

    // ドラッグ＆ドロップ ゾーン設定 (右パネルへドロップ = 投入)
    const paneRight = document.getElementById('pane-container-contents');
    if (paneRight) {
      paneRight.ondragover = (e) => {
        if (this.isProcessing) return;
        e.preventDefault();
        paneRight.classList.add('drag-over');
      };
      paneRight.ondragleave = () => {
        paneRight.classList.remove('drag-over');
      };
      paneRight.ondrop = (e) => {
        e.preventDefault();
        paneRight.classList.remove('drag-over');
        if (this.isProcessing) return;
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data && data.side === 'left') {
            const item = playerItems[data.index];
            if (item) {
              this.executePutIn(item, this.specifiedQuantity);
            }
          }
        } catch (err) {
          // drop error
        }
      };
    }

    // ドラッグ＆ドロップ ゾーン設定 (左パネルへドロップ = 取り出し)
    const paneLeft = document.getElementById('pane-player-inventory');
    if (paneLeft) {
      paneLeft.ondragover = (e) => {
        if (this.isProcessing) return;
        e.preventDefault();
        paneLeft.classList.add('drag-over');
      };
      paneLeft.ondragleave = () => {
        paneLeft.classList.remove('drag-over');
      };
      paneLeft.ondrop = (e) => {
        e.preventDefault();
        paneLeft.classList.remove('drag-over');
        if (this.isProcessing) return;
        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data && data.side === 'right') {
            const item = this.containerItems[data.index];
            if (item) {
              this.executeTakeOut(item, this.specifiedQuantity);
            }
          }
        } catch (err) {
          // drop error
        }
      };
    }
  }

  /**
   * アイテム選択状態のUI更新
   * @private
   */
  _updateSelectionStyles() {
    const leftRows = this.elContainerModal.querySelectorAll('#list-player-inventory .container-item-row');
    leftRows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const isSelected = (this.selectedLeftIndex !== null && this.selectedLeftIndex === idx);
      row.classList.toggle('selected', !!isSelected);
    });

    const rightRows = this.elContainerModal.querySelectorAll('#list-container-contents .container-item-row');
    rightRows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const isSelected = (this.selectedRightIndex !== null && this.selectedRightIndex === idx);
      row.classList.toggle('selected', !!isSelected);
    });

    const btnPut = document.getElementById('btn-container-put');
    if (btnPut) btnPut.disabled = !this.selectedLeftItem;

    const btnTake = document.getElementById('btn-container-take');
    if (btnTake) btnTake.disabled = !this.selectedRightItem;
  }

  /**
   * アイテム移動時の数量を解決
   * 数量指定がある場合はその数値、未指定(空欄="all")時は -1 (全量)
   * @private
   */
  _resolveItemCount(item, count = -1) {
    if (typeof count === 'number' && count > 0) {
      return count;
    }
    if (typeof this.specifiedQuantity === 'number' && this.specifiedQuantity > 0) {
      return this.specifiedQuantity;
    }
    return -1;
  }

  /**
   * アイテム投入の実行
   * @param {Object} item
   * @param {number} count
   */
  executePutIn(item, count = -1) {
    const finalCount = this._resolveItemCount(item, count);
    if (this.isProcessing) return;
    const ctrl = this.getContainerController();
    if (!ctrl) return;
    const isEn = this.currentLanguage === 'en';

    // validatePutIn による SSOT バリデーションチェックを実行
    if (typeof ctrl.validatePutIn === 'function') {
      const validation = ctrl.validatePutIn(item);
      const isBlocked = validation.valid === false || validation.allowed === false;
      if (isBlocked) {
        if (validation.reason === 'SELF_CONTAINER') {
          alert(isEn
            ? `[BLOCKED] You cannot put the container inside itself!`
            : `【投入不可】開いているコンテナ自身を中に入れることはできません！`);
          return;
        }
        if (validation.reason === 'EQUIPPED') {
          alert(isEn
            ? `[BLOCKED] Cannot put equipped or worn items into a container!`
            : `【投入不可】装備中・着用中のアイテムは直接コンテナに入れられません！`);
          return;
        }
        if (validation.reason === 'BOH_CRITICAL') {
          alert(isEn
            ? `[BLOCKED] Putting this item will EXPLODE the Bag of Holding!\n\nItem: ${item.rawText || item.name}`
            : `【投入拒絶】このアイテムを入れると Bag of Holding が魔法の爆発を起こします！\n\n対象: ${item.rawText || item.name}`);
          return;
        }
        if (validation.reason === 'BOH_SUSPICIOUS' || validation.warning === 'BOH_SUSPICIOUS') {
          this._showWarningModal({
            title: isEn ? '⚠️ Caution: Potential Danger' : '⚠️ 警告: 爆発の危険性',
            message: isEn
              ? `This unidentified wand or bag could be a Wand of Cancellation or Bag of Holding, which will EXPLODE the bag.\n\nAre you sure you want to put "${item.rawText || item.name}" inside?`
              : `この未識別の杖または袋は「打ち消しの杖」や「軽量化の鞄」の可能性があり、鞄が爆発する恐れがあります。\n\n本当に「${item.rawText || item.name}」を鞄に入れますか？`,
            onProceed: () => {
              this._hideWarningModal();
              this._doTransferIn(item, finalCount, true);
            },
            onCancel: () => {
              this._hideWarningModal();
            }
          });
          return;
        }
        return;
      }
    }

    this._doTransferIn(item, finalCount, false);
  }

  /**
   * 実際の投入API呼び出し (SSOT 準拠: ローカル配列直接更新を完全廃止)
   * @private
   */
  async _doTransferIn(item, count, allowSuspicious = false) {
    const ctrl = this.getContainerController();
    if (!ctrl && !this.getCore()) return;

    // 選択状態の確実なクリア
    this.selectedLeftItem = null;
    this.selectedLeftIndex = null;
    this.isProcessing = true;
    this.render();

    const targetCount = this._resolveItemCount(item, count);

    try {
      await this._transferItem({
        direction: 'in',
        item: item,
        count: targetCount,
        allowSuspicious
      });
    } catch (err) {
      console.error('Error during transferIn:', err);
    } finally {
      this.isProcessing = false;
      const c = this.getContainerController();
      if (c && c.contentsManager) {
        this.containerItems = [...c.contentsManager.getItems()];
      }
      this.render();
    }
  }

  /**
   * アイテム取り出しの実行 (SSOT 準拠: ローカル配列直接更新を完全廃止)
   * @param {Object} item
   * @param {number} count
   */
  async executeTakeOut(item, count = -1) {
    const finalCount = this._resolveItemCount(item, count);
    if (this.isProcessing) return;
    const ctrl = this.getContainerController();
    if (!ctrl && !this.getCore()) return;

    // 選択状態の確実なクリア
    this.selectedRightItem = null;
    this.selectedRightIndex = null;
    this.isProcessing = true;
    this.render();

    try {
      await this._transferItem({
        direction: 'out',
        item: item,
        count: finalCount
      });
    } catch (err) {
      console.error('Error during transferOut:', err);
    } finally {
      this.isProcessing = false;
      const c = this.getContainerController();
      if (c && c.contentsManager) {
        this.containerItems = [...c.contentsManager.getItems()];
      }
      this.render();
    }
  }

  /**
   * 全て入れる
   */
  async executePutAll(items, safetyMap) {
    if (this.isProcessing) return;
    const core = this.getCore();
    if (!core) return;
    const isEn = this.currentLanguage === 'en';

    // 投入先が BoH の場合、CRITICAL なアイテムは除外
    const safeItems = [];
    const criticalItems = [];
    const suspiciousItems = [];

    items.forEach(item => {
      // 開いているコンテナ自身を中に入れようとするのを防止
      if (item.rawText && this.containerName && item.rawText.includes(this.containerName)) {
        return;
      }
      if (item.name && this.containerName && item.name.includes(this.containerName)) {
        return;
      }

      // 装備中・着用中アイテムを除外
      if (item.isWielded || item.isWorn || item.worn || item.isQuivered) {
        return;
      }
      if (item.rawText && /\((?:wielded|weapon in hand|being worn|in quiver)\)/i.test(item.rawText)) {
        return;
      }

      const safety = safetyMap.get(item) || 'SAFE';
      if (safety === 'CRITICAL') {
        criticalItems.push(item);
      } else if (safety === 'SUSPICIOUS') {
        suspiciousItems.push(item);
      } else {
        safeItems.push(item);
      }
    });

    if (criticalItems.length > 0) {
      alert(isEn
        ? `[Notice] ${criticalItems.length} dangerous item(s) (e.g. Wand of Cancellation) excluded to prevent Bag of Holding explosion.`
        : `【防爆セーフティ作動】Bag of Holding 爆発を防止するため、危険アイテム ${criticalItems.length} 件（打ち消しの杖等）を除外して投入します。`
      );
    }

    const doPut = async (itemsToPut, allowSuspicious = false) => {
      this.isProcessing = true;
      this.selectedLeftItem = null;
      this.selectedLeftIndex = null;
      this.render();
      try {
        for (const item of itemsToPut) {
          await this._transferItem({
            direction: 'in',
            item: item,
            count: -1,
            allowSuspicious
          });
        }
      } catch (err) {
        console.error('Error during executePutAll:', err);
      } finally {
        this.isProcessing = false;
        const ctrl = this.getContainerController();
        if (ctrl && ctrl.contentsManager) {
          this.containerItems = [...ctrl.contentsManager.getItems()];
        }
        this.render();
      }
    };

    // 疑わしいアイテムがある場合は警告
    if (suspiciousItems.length > 0) {
      this._showWarningModal({
        title: isEn ? '⚠️ Caution: Unidentified Items' : '⚠️ 警告: 未識別アイテムが含まれています',
        message: isEn
          ? `There are ${suspiciousItems.length} unidentified wand(s)/bag(s). Include them as well?`
          : `未識別の杖・袋が ${suspiciousItems.length} 点あります。これらも含めて投入しますか？`,
        onProceed: async () => {
          this._hideWarningModal();
          const allToPut = [...safeItems, ...suspiciousItems];
          if (allToPut.length > 0) {
            await doPut(allToPut, true);
          }
        },
        onCancel: async () => {
          this._hideWarningModal();
          if (safeItems.length > 0) {
            await doPut(safeItems, false);
          }
        }
      });
      return;
    }

    if (safeItems.length > 0) {
      await doPut(safeItems, false);
    }
  }

  /**
   * 全て出す
   */
  async executeTakeAll(items) {
    if (this.isProcessing) return;
    const ctrl = this.getContainerController();
    if ((!ctrl && !this.getCore()) || !items || items.length === 0) return;

    this.isProcessing = true;
    this.selectedRightItem = null;
    this.selectedRightIndex = null;
    this.render();

    try {
      for (const item of items) {
        await this._transferItem({
          direction: 'out',
          item: item,
          count: -1
        });
      }
    } catch (err) {
      console.error('Error during executeTakeAll:', err);
    } finally {
      this.isProcessing = false;
      const c = this.getContainerController();
      if (c && c.contentsManager) {
        this.containerItems = [...c.contentsManager.getItems()];
      }
      this.render();
    }
  }

  /**
   * 警告モーダルの表示
   * @private
   */
  _showWarningModal({ title, message, onProceed, onCancel }) {
    const modal = document.getElementById('container-warning-modal');
    if (!modal) return;
    const isEn = this.currentLanguage === 'en';

    modal.innerHTML = `
      <div class="container-warning-card">
        <h4>${title}</h4>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <div class="container-warning-actions">
          <button class="btn-warning-proceed" id="btn-warn-proceed">${isEn ? 'Proceed Anyway' : 'それでも入れる'}</button>
          <button class="btn-warning-cancel" id="btn-warn-cancel">${isEn ? 'Cancel' : 'キャンセル'}</button>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');

    const btnProceed = document.getElementById('btn-warn-proceed');
    if (btnProceed) btnProceed.onclick = onProceed;

    const btnCancel = document.getElementById('btn-warn-cancel');
    if (btnCancel) btnCancel.onclick = onCancel;
  }

  /**
   * 警告モーダルの非表示
   * @private
   */
  _hideWarningModal() {
    const modal = document.getElementById('container-warning-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    }
  }
}
