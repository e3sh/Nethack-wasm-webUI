/**
 * ContainerModal.js
 *
 * ビジュアル・コンテナUI（二面パネルGUI＆ドラッグ＆ドロップ操作）
 * プレイヤー所持品 ⇄ コンテナ中身の直感的・グラフィカルな相互移動と
 * Bag of Holding 防爆セーフティガードの統合ビュー。
 */

import { ContainerAction } from '../../../../src/core/container/ContainerPromptDetector.js';

export class ContainerModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.elContainerModal] - モーダル外枠DOM
   * @param {Function} options.getCore - WebUICore インスタンス取得関数
   * @param {Function} [options.getLoadedTileImagePath] - タイル画像パス取得関数
   */
  constructor(options = {}) {
    this.elContainerModal = options.elContainerModal || document.getElementById('container-modal');
    this.getCore = options.getCore || (() => null);
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
    this.selectedRightItem = null;

    // 数量指定 (-1 = 全量)
    this.specifiedQuantity = -1;

    // 保留中の危険アイテム投入タスク (警告モーダル用)
    this._pendingWarningAction = null;

    // トランザクション処理中フラグ (SSOT 二重操作防止)
    this.isProcessing = false;

    this._ensureDom();
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
   * @private
   */
  _getItemIconHtml(item) {
    const core = this.getCore();
    const glyphId = item.glyphId !== undefined ? item.glyphId : (item.glyph !== undefined ? item.glyph : -1);
    if (glyphId >= 0 && core && typeof core.getGlyphHtml === 'function') {
      const tileImgPath = this.getLoadedTileImagePath();
      const glyphHtml = core.getGlyphHtml(glyphId, { tileImage: tileImgPath, displaySize: 20 });
      if (glyphHtml) {
        return `<span class="container-item-icon">${glyphHtml}</span>`;
      }
    }
    return `<span class="container-item-icon container-item-emoji">${this.getItemSymbol(item)}</span>`;
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
   * 数量の決定 (指定値 > アイテム内count > quantity > 文字列パース > -1)
   * @private
   */
  _resolveItemCount(item, specifiedQty) {
    if (typeof specifiedQty === 'number' && specifiedQty > 0) return specifiedQty;
    if (typeof item.count === 'number' && item.count > 0) return item.count;
    if (typeof item.quantity === 'number' && item.quantity > 0) return item.quantity;
    const text = item.rawText || item.rawStr || item.str || item.name || '';
    const m = text.match(/^(\d+)\s+/);
    if (m) return parseInt(m[1], 10);
    return -1;
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
    this.containerItems = (data.contents && data.contents.items) ? data.contents.items : [];

    this.selectedLeftItem = null;
    this.selectedRightItem = null;
    this.specifiedQuantity = -1;
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
    const core = this.getCore();
    if (core && core.containerFSM) {
      if (typeof core.containerFSM.closeSession === 'function') {
        core.containerFSM.closeSession();
      } else if (core.containerFSM.isActive()) {
        core.containerFSM.selectAction(ContainerAction.QUIT);
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

    // プレイヤー所持品リストの取得
    let playerItems = [];
    const invMgr = (core && core.gkl && core.gkl.inventoryStateManager) || (core && core.inventoryStateManager);
    if (invMgr) {
      if (typeof invMgr.getItems === 'function') {
        playerItems = invMgr.getItems() || [];
      } else if (Array.isArray(invMgr.items)) {
        playerItems = invMgr.items;
      }
    }

    // コンテナ中身リストの取得 (FSM / contentsManager SSOT を優先)
    if (core && core.containerFSM && core.containerFSM.contentsManager) {
      const fsmItems = core.containerFSM.contentsManager.getItems();
      if (Array.isArray(fsmItems)) {
        this.containerItems = fsmItems;
      }
    }

    // 各アイテムの投入可否バリデーション (SSOT)
    const validationMap = new Map();
    if (core && core.containerFSM && typeof core.containerFSM.validatePutIn === 'function') {
      playerItems.forEach(item => {
        validationMap.set(item, core.containerFSM.validatePutIn(item));
      });
    }

    // 投入先が BoH の場合、各アイテムのセーフティ評価を事前計算
    const safetyMap = new Map();
    if (this.isBagOfHolding && core && core.containerFSM) {
      playerItems.forEach(item => {
        const assessment = core.containerFSM.checkSafety([item]);
        if (assessment.critical.length > 0) {
          safetyMap.set(item, 'CRITICAL');
        } else if (assessment.suspicious.length > 0) {
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
          </div>
          <button class="container-close-btn" id="btn-container-close" title="${isEn ? 'Close (ESC / q)' : '閉じる (ESC / q)'}">✕</button>
        </div>

        <!-- Body: Two-Pane GUI -->
        <div class="container-two-pane-body">
          <!-- Left Pane: Player Inventory -->
          <div class="container-pane" id="pane-player-inventory">
            <div class="container-pane-header">
              <span>🎒 ${isEn ? 'Player Inventory' : '所持品一覧'}</span>
              <span class="pane-badge-count" id="badge-left-count">${playerItems.length}</span>
            </div>
            <div class="container-item-list" id="list-player-inventory">
              ${this._renderPlayerItemsHtml(playerItems, safetyMap, validationMap, isEn)}
            </div>
          </div>

          <!-- Middle Controls -->
          <div class="container-middle-controls">
            <button class="container-action-btn btn-put" id="btn-container-put" ${(!this.selectedLeftItem || this.isProcessing) ? 'disabled' : ''}>
              <span>▶</span>
              <span>${isEn ? 'Put In' : '入れる'}</span>
            </button>
            <button class="container-action-btn btn-take" id="btn-container-take" ${(!this.selectedRightItem || this.isProcessing) ? 'disabled' : ''}>
              <span>◀</span>
              <span>${isEn ? 'Take Out' : '出す'}</span>
            </button>
            <!-- 個別操作優先のため、一括移動ボタンは安全のために非表示 -->
            <button class="container-action-btn btn-all" id="btn-container-put-all" style="display: none;">
              <span>▶▶</span>
              <span>${isEn ? 'Put All' : '全て入れる'}</span>
            </button>
            <button class="container-action-btn btn-all" id="btn-container-take-all" style="display: none;">
              <span>◀◀</span>
              <span>${isEn ? 'Take All' : '全て出す'}</span>
            </button>

            <div class="container-quantity-box">
              <label for="input-container-qty">${isEn ? 'Qty:' : '数量:'}</label>
              <input type="number" id="input-container-qty" min="1" placeholder="All" value="${this.specifiedQuantity > 0 ? this.specifiedQuantity : ''}" />
            </div>
          </div>

          <!-- Right Pane: Container Contents -->
          <div class="container-pane" id="pane-container-contents">
            <div class="container-pane-header">
              <span>📦 ${isEn ? 'Container Contents' : 'コンテナの中身'}</span>
              <span class="pane-badge-count" id="badge-right-count">${this.containerItems.length}</span>
            </div>
            <div class="container-item-list" id="list-container-contents">
              ${this._renderContainerItemsHtml(this.containerItems, isEn)}
            </div>
          </div>

          <!-- Warning Sub-Modal (Hidden by default) -->
          <div class="container-warning-modal hidden" id="container-warning-modal"></div>
        </div>

        <!-- Debug / Sequence Status Panel -->
        <div class="container-debug-panel" id="container-debug-panel" style="background:#11111b; border-top:1px solid rgba(255,255,255,0.1); padding:4px 12px; font-family:monospace; font-size:11px; color:#a6adc8; display:flex; justify-content:space-between; align-items:center;">
          <div id="container-debug-text" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85%;">
            ${this._renderDebugInfoHtml(core, isEn)}
          </div>
          <button type="button" id="btn-container-sync-now" style="background:#313244; color:#cdd6f4; border:1px solid rgba(255,255,255,0.15); border-radius:4px; padding:2px 8px; cursor:pointer; font-size:10px;">
            🔄 ${isEn ? 'Sync' : '再同期'}
          </button>
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
      const isSelected = this.selectedLeftItem && (
        (this.selectedLeftItem.identifier && item.identifier && this.selectedLeftItem.identifier === item.identifier) ||
        (this.selectedLeftItem.onum && item.onum && this.selectedLeftItem.onum === item.onum) ||
        (this.selectedLeftItem.letter && (this.selectedLeftItem.letter === item.letter || this.selectedLeftItem.invlet === item.letter)) ||
        (this.selectedLeftItem.rawText && item.rawText && this.selectedLeftItem.rawText === item.rawText)
      );
      const safety = safetyMap.get(item) || 'SAFE';
      const validation = validationMap ? validationMap.get(item) : null;
      const isInvalid = validation && !validation.valid;
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
      const isSelected = this.selectedRightItem && (
        (this.selectedRightItem.identifier && this.selectedRightItem.identifier === item.identifier) ||
        (this.selectedRightItem.onum && this.selectedRightItem.onum === item.onum) ||
        (this.selectedRightItem.str && this.selectedRightItem.str === item.str) ||
        (this.selectedRightItem.name && this.selectedRightItem.name === item.name)
      );

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
   * 直近トランザクションのデバッグ表示HTML生成
   * @private
   */
  _renderDebugInfoHtml(core, isEn) {
    const debug = (core && core.containerFSM && core.containerFSM.lastTransactionDebug) ? core.containerFSM.lastTransactionDebug : null;
    if (!debug) {
      return `<span style="color:#6c7086;">${isEn ? 'Status: Standby at poskey' : '状態: 通常ターン待機中 (poskey)'}</span>`;
    }
    const statusColor = debug.status === 'SUCCESS' ? '#a6e3a1' : (debug.status === 'ERROR' ? '#f38ba8' : '#f9e2af');
    const seqStr = Array.isArray(debug.sequence) ? JSON.stringify(debug.sequence) : '';
    const bufferText = Array.isArray(debug.bufferMessages) && debug.bufferMessages.length > 0
      ? ` | [C-Core] ${debug.bufferMessages.slice(-1)[0]}`
      : (debug.message ? ` | ${debug.message}` : '');
    return `
      <span style="color:${statusColor}; font-weight:bold;">[${debug.status}]</span>
      <span style="color:#89b4fa; margin-left:6px;">Seq: <code>${seqStr}</code></span>
      <span style="color:#cdd6f4; margin-left:6px;">${bufferText}</span>
    `;
  }

  /**
   * イベントリスナーのバインド
   * @private
   */
  _bindEvents(playerItems, safetyMap, validationMap) {
    const isEn = this.currentLanguage === 'en';
    const core = this.getCore();

    // 手動再同期ボタン
    const btnSync = document.getElementById('btn-container-sync-now');
    if (btnSync) {
      btnSync.onclick = async () => {
        if (this.isProcessing) return;
        this.isProcessing = true;
        btnSync.textContent = '⏳...';
        try {
          if (core && core.containerFSM && typeof core.containerFSM.syncContentsSilent === 'function') {
            await core.containerFSM.syncContentsSilent({ force: true });
          }
        } catch (e) {
          console.error('[ContainerModal] Sync error:', e);
        } finally {
          this.isProcessing = false;
          this.render();
        }
      };
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
      const isInvalid = validation && !validation.valid;

      // クリックで選択 (処理中または無効アイテムは選択不可)
      row.onclick = () => {
        if (this.isProcessing || isInvalid) return;
        this.selectedLeftItem = item;
        this.selectedRightItem = null;
        this._updateSelectionStyles();
      };

      // ダブルクリックで即座投入 (処理中または無効アイテムは不可)
      row.ondblclick = () => {
        if (this.isProcessing || isInvalid) return;
        this.selectedLeftItem = item;
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
        this.selectedLeftItem = null;
        this._updateSelectionStyles();
      };

      // ダブルクリックで即座取り出し (処理中は不可)
      row.ondblclick = () => {
        if (this.isProcessing) return;
        this.selectedRightItem = item;
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
      const letter = row.dataset.letter;
      const id = row.dataset.id;
      const isSelected = this.selectedLeftItem && (
        (this.selectedLeftItem.identifier && String(this.selectedLeftItem.identifier) === id) ||
        (this.selectedLeftItem.onum && String(this.selectedLeftItem.onum) === id) ||
        (this.selectedLeftItem.letter && (this.selectedLeftItem.letter === letter || this.selectedLeftItem.invlet === letter)) ||
        (this.selectedLeftItem.rawText && row.querySelector('.item-name-box') && row.querySelector('.item-name-box').title.includes(this.selectedLeftItem.rawText))
      );
      row.classList.toggle('selected', !!isSelected);
    });

    const rightRows = this.elContainerModal.querySelectorAll('#list-container-contents .container-item-row');
    rightRows.forEach(row => {
      const idx = parseInt(row.dataset.index, 10);
      const item = this.containerItems[idx];
      const id = row.dataset.id;
      const isSelected = this.selectedRightItem && (
        (item && this.selectedRightItem.identifier && item.identifier && this.selectedRightItem.identifier === item.identifier) ||
        (item && this.selectedRightItem.onum && item.onum && this.selectedRightItem.onum === item.onum) ||
        (id && this.selectedRightItem.identifier && String(this.selectedRightItem.identifier) === id) ||
        (item && this.selectedRightItem.str === item.str) ||
        (item && this.selectedRightItem.name === item.name)
      );
      row.classList.toggle('selected', !!isSelected);
    });

    const btnPut = document.getElementById('btn-container-put');
    if (btnPut) btnPut.disabled = !this.selectedLeftItem;

    const btnTake = document.getElementById('btn-container-take');
    if (btnTake) btnTake.disabled = !this.selectedRightItem;
  }

  /**
   * アイテム投入の実行
   * @param {Object} item
   * @param {number} count
   */
  executePutIn(item, count = -1) {
    const finalCount = count > 0 ? count : this.specifiedQuantity;
    if (this.isProcessing) return;
    const core = this.getCore();
    if (!core || !core.containerFSM) return;
    const isEn = this.currentLanguage === 'en';

    // FSM の validatePutIn が存在する場合は SSOT バリデーションチェックを実行
    if (typeof core.containerFSM.validatePutIn === 'function') {
      const validation = core.containerFSM.validatePutIn(item);
      if (!validation.valid) {
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
        if (validation.reason === 'BOH_SUSPICIOUS') {
          this._showWarningModal({
            title: isEn ? '⚠️ Caution: Potential Danger' : '⚠️ 警告: 爆発の危険性',
            message: isEn
              ? `This unidentified wand or bag could be a Wand of Cancellation or Bag of Holding, which will EXPLODE the bag.\n\nAre you sure you want to put "${item.rawText || item.name}" inside?`
              : `この未識別の杖または袋は「打ち消しの杖」や「軽量化の鞄」の可能性があり、鞄が爆発する恐れがあります。\n\n本当に「${item.rawText || item.name}」を鞄に入れますか？`,
            onProceed: () => {
              this._hideWarningModal();
              this._doTransferIn(item, count, true);
            },
            onCancel: () => {
              this._hideWarningModal();
            }
          });
          return;
        }
        return;
      }
    } else if (this.isBagOfHolding) {
      // フォールバック（validatePutIn が未提供の場合のセーフティチェック）
      const safety = core.containerFSM.checkSafety([item]);
      if (safety.critical.length > 0) {
        alert(isEn
          ? `[BLOCKED] Putting this item will EXPLODE the Bag of Holding!\n\nItem: ${item.rawText || item.name}`
          : `【投入拒絶】このアイテムを入れると Bag of Holding が魔法の爆発を起こします！\n\n対象: ${item.rawText || item.name}`);
        return;
      }
      if (safety.suspicious.length > 0) {
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
    }

    this._doTransferIn(item, finalCount, false);
  }

  /**
   * 実際の投入API呼び出し (SSOT 準拠: ローカル配列直接更新を完全廃止)
   * @private
   */
  async _doTransferIn(item, count, allowSuspicious = false) {
    const core = this.getCore();
    if (!core || !core.containerFSM) return;

    // 楽観的配列変更（push）は完全撤廃！
    this.selectedLeftItem = null;
    this.isProcessing = true;
    this.render();

    const targetCount = this._resolveItemCount(item, count);
    const transferOpts = {
      direction: 'in',
      items: [{
        letter: item.letter || item.invlet,
        identifier: item.identifier,
        count: targetCount,
        rawText: item.rawText,
        name: item.name,
      }],
    };
    if (allowSuspicious) {
      transferOpts.allowSuspicious = true;
    }

    try {
      const res = core.containerFSM.transferItems(transferOpts);
      if (res && typeof core.containerFSM.waitForCompletion === 'function') {
        await core.containerFSM.waitForCompletion(3000);
      } else if (res && typeof res.then === 'function') {
        await res;
      }
    } catch (err) {
      console.error('Error during transferIn:', err);
    } finally {
      this.isProcessing = false;
      if (core.containerFSM.contentsManager) {
        this.containerItems = [...core.containerFSM.contentsManager.getItems()];
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
    const finalCount = count > 0 ? count : this.specifiedQuantity;
    if (this.isProcessing) return;
    const core = this.getCore();
    if (!core || !core.containerFSM) return;

    // 楽観的配列変更（splice）は完全撤廃！
    this.selectedRightItem = null;
    this.isProcessing = true;
    this.render();

    const targetCount = this._resolveItemCount(item, finalCount);
    const transferOpts = {
      direction: 'out',
      items: [{
        identifier: item.identifier,
        accelerator: item.accelerator || item.letter || item.charStr || (item.ch ? String.fromCharCode(item.ch) : (item.invlet || 'a')),
        letter: item.accelerator || item.letter || item.charStr || (item.ch ? String.fromCharCode(item.ch) : (item.invlet || 'a')),
        count: targetCount,
        rawText: item.rawStr || item.str || item.rawText || item.name,
      }],
    };

    try {
      const res = core.containerFSM.transferItems(transferOpts);
      if (res && typeof core.containerFSM.waitForCompletion === 'function') {
        await core.containerFSM.waitForCompletion(3000);
      } else if (res && typeof res.then === 'function') {
        await res;
      }
    } catch (err) {
      console.error('Error during transferOut:', err);
    } finally {
      this.isProcessing = false;
      if (core.containerFSM.contentsManager) {
        this.containerItems = [...core.containerFSM.contentsManager.getItems()];
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
    if (!core || !core.containerFSM) return;
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
      this.render();
      const opts = { direction: 'in', items: itemsToPut };
      if (allowSuspicious) opts.allowSuspicious = true;
      try {
        const p = core.containerFSM.transferItems(opts);
        if (p && typeof core.containerFSM.waitForCompletion === 'function') {
          await core.containerFSM.waitForCompletion();
        } else if (p && typeof p.then === 'function') {
          await p;
        }
      } catch (err) {
        console.error('Error during executePutAll:', err);
      } finally {
        this.isProcessing = false;
        if (core.containerFSM.contentsManager) {
          this.containerItems = [...core.containerFSM.contentsManager.getItems()];
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
    const core = this.getCore();
    if (!core || !core.containerFSM || items.length === 0) return;

    this.isProcessing = true;
    this.render();

    try {
      const p = core.containerFSM.transferItems({
        direction: 'out',
        items: items.map(it => ({
          identifier: it.identifier,
          letter: it.charStr || (it.ch ? String.fromCharCode(it.ch) : null),
          count: -1,
          rawText: it.rawStr || it.str,
        })),
      });

      if (p && typeof core.containerFSM.waitForCompletion === 'function') {
        await core.containerFSM.waitForCompletion();
      } else if (p && typeof p.then === 'function') {
        await p;
      }
    } catch (err) {
      console.error('Error during executeTakeAll:', err);
    } finally {
      this.isProcessing = false;
      if (core.containerFSM.contentsManager) {
        this.containerItems = [...core.containerFSM.contentsManager.getItems()];
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
