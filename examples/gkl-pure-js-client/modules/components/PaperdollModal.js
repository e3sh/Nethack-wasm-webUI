/**
 * PaperdollModal.js
 *
 * 装備ペーパードールUI ＆ リアルタイム差分プレビューモーダル。
 * 人型部位スロット（頭・目・首・主手・控え・副手・手・左右指・足・矢筒）と
 * 胴体中央の「3層レイヤードカード表現（外套 ➔ 鎧 ➔ シャツ）」を可視化し、
 * AC・耐性・重量・所要ターンのリアルタイム差分プレビューと安全な自動換装を提供する。
 */

import {
  EQUIP_SLOTS,
  resolveEligibleSlots,
  isTwoHandedWeapon,
  isCockatriceCorpse
} from '../../../../src/core/knowledge/EquipmentRules.js';
import { EquipmentDependencyAnalyzer } from '../../../../src/core/knowledge/EquipmentDependencyAnalyzer.js';
import { EquipmentActionPlanner } from '../../../../src/core/knowledge/EquipmentActionPlanner.js';
import { OBJECT_JP_MAP } from '../../../../src/core/knowledge/OBJECT_JP_MAP.js';

export class PaperdollModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.elPaperdollModal] - モーダル外枠DOM
   * @param {Function} options.getCore - WebUICore取得関数
   * @param {Function} [options.getLoadedTileImagePath] - タイル画像パス取得関数
   * @param {Function} [options.onEquipmentChanged] - 換装完了時コールバック
   */
  constructor(options = {}) {
    this.options = options;
    this.elPaperdollModal = options.elPaperdollModal || document.getElementById('paperdoll-modal');
    this.getCore = options.getCore || (() => null);
    this.getLoadedTileImagePath = options.getLoadedTileImagePath || (() => '../../pict/nethack_default_32.png');
    this.onEquipmentChanged = options.onEquipmentChanged || (() => {});

    this.currentLanguage = 'ja';
    this.isVisible = false;
    this.isProcessing = false;

    // 選択状態
    this.selectedSlot = EQUIP_SLOTS.SUIT; // デフォルトで鎧スロットを選択
    this.selectedCandidateItem = null;
    this.hoverCandidateItem = null;

    // スロットのメタ情報定義
    this.slotDefinitions = {
      [EQUIP_SLOTS.HELM]:      { id: EQUIP_SLOTS.HELM, labelJa: '頭 (兜)', labelEn: 'Helm', icon: '🪖' },
      [EQUIP_SLOTS.BLINDFOLD]: { id: EQUIP_SLOTS.BLINDFOLD, labelJa: '目 (目隠し)', labelEn: 'Eyes', icon: '🕶️' },
      [EQUIP_SLOTS.AMULET]:    { id: EQUIP_SLOTS.AMULET, labelJa: '首 (アミュレット)', labelEn: 'Amulet', icon: '🧿' },
      [EQUIP_SLOTS.MAIN_HAND]: { id: EQUIP_SLOTS.MAIN_HAND, labelJa: '主手 (武器/道具)', labelEn: 'Main Hand', icon: '⚔️' },
      [EQUIP_SLOTS.OFF_HAND]:  { id: EQUIP_SLOTS.OFF_HAND, labelJa: '控え (副武器)', labelEn: 'Alt Weapon', icon: '🗡️' },
      [EQUIP_SLOTS.SHIELD]:    { id: EQUIP_SLOTS.SHIELD, labelJa: '副手 (盾)', labelEn: 'Shield / Off', icon: '🛡️' },
      [EQUIP_SLOTS.CLOAK]:     { id: EQUIP_SLOTS.CLOAK, labelJa: '外套 (クローク)', labelEn: 'Cloak (Layer 3)', icon: '🧥', layer: 3 },
      [EQUIP_SLOTS.SUIT]:      { id: EQUIP_SLOTS.SUIT, labelJa: '鎧 (甲冑)', labelEn: 'Suit (Layer 2)', icon: '🥋', layer: 2 },
      [EQUIP_SLOTS.SHIRT]:     { id: EQUIP_SLOTS.SHIRT, labelJa: '肌着 (シャツ)', labelEn: 'Shirt (Layer 1)', icon: '👕', layer: 1 },
      [EQUIP_SLOTS.GLOVES]:    { id: EQUIP_SLOTS.GLOVES, labelJa: '手 (手袋/籠手)', labelEn: 'Gloves', icon: '🧤' },
      [EQUIP_SLOTS.LEFT_RING]: { id: EQUIP_SLOTS.LEFT_RING, labelJa: '左指 (指輪)', labelEn: 'Left Ring', icon: '💍' },
      [EQUIP_SLOTS.RIGHT_RING]:{ id: EQUIP_SLOTS.RIGHT_RING, labelJa: '右指 (指輪)', labelEn: 'Right Ring', icon: '💍' },
      [EQUIP_SLOTS.QUIVER]:    { id: EQUIP_SLOTS.QUIVER, labelJa: '矢筒 (弾薬/投擲)', labelEn: 'Quiver', icon: '🏹' },
      [EQUIP_SLOTS.BOOTS]:     { id: EQUIP_SLOTS.BOOTS, labelJa: '足 (靴/ブーツ)', labelEn: 'Boots', icon: '👢' }
    };

    this._ensureDom();
  }

  _ensureDom() {
    if (!this.elPaperdollModal) {
      let modal = document.getElementById('paperdoll-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'paperdoll-modal';
        modal.className = 'modal-backdrop hidden';
        document.body.appendChild(modal);
      }
      this.elPaperdollModal = modal;
    }

    // 外枠クリックでモーダルを閉じる
    this.elPaperdollModal.addEventListener('click', (e) => {
      if (e.target === this.elPaperdollModal) {
        this.hide();
      }
    });
  }

  setLanguage(lang) {
    this.currentLanguage = lang === 'en' ? 'en' : 'ja';
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * アイテムの表示名を現在の言語（ja / en）に合わせて解決
   * @param {Object} item
   * @returns {string}
   */
  _getItemDisplayName(item) {
    if (!item) return '';
    const isEn = this.currentLanguage === 'en';

    // 1. 英語表示の場合
    if (isEn) {
      if (item.name) return item.name;
      return (item.rawText || '')
        .replace(/^[a-zA-Z]\s*-\s*/, '')
        .replace(/\s*[(（][^()（）]*[)）]$/, '')
        .trim();
    }

    // 2. 日本語表示の場合
    // (a) 明示的な和名プロパティがあれば最優先
    if (item.japaneseName) return item.japaneseName;
    if (item.knowledge && item.knowledge.japaneseName) return item.knowledge.japaneseName;

    // (b) core.translate または core.translator.translate による動的翻訳
    const core = this.getCore();
    const translateFn = (core && typeof core.translate === 'function')
      ? core.translate.bind(core)
      : (core && core.translator && typeof core.translator.translate === 'function'
          ? core.translator.translate.bind(core.translator)
          : null);

    if (translateFn) {
      // rawText がある場合はまず構文分解翻訳を試行
      if (item.rawText) {
        try {
          const translatedRaw = translateFn(item.rawText);
          if (translatedRaw && translatedRaw !== item.rawText) {
            return translatedRaw
              .replace(/^[a-zA-Z]\s*-\s*/, '')
              .replace(/\s*[(（][^()（）]*[)）]$/, '')
              .trim();
          }
        } catch (e) {}
      }
      // item.name の翻訳を試行
      if (item.name) {
        try {
          const translatedName = translateFn(item.name);
          if (translatedName && translatedName !== item.name) {
            return translatedName;
          }
        } catch (e) {}
      }
    }

    // (c) OBJECT_JP_MAP 辞書引き (SSOT)
    if (OBJECT_JP_MAP && OBJECT_JP_MAP.objects) {
      const cleanKey = (item.name || item.rawText || '')
        .replace(/^[a-zA-Z]\s*-\s*/, '')
        .replace(/^(a|an|the|\+\d+|-\d+)\s+/, '')
        .replace(/\s*[(（][^()（）]*[)）]$/, '')
        .trim();

      if (OBJECT_JP_MAP.objects[cleanKey]) {
        return OBJECT_JP_MAP.objects[cleanKey];
      }

      const lowerKey = cleanKey.toLowerCase();
      for (const [k, v] of Object.entries(OBJECT_JP_MAP.objects)) {
        if (k.toLowerCase() === lowerKey) {
          return v;
        }
      }
    }

    // (d) フォールバック
    return item.name || (item.rawText || '').replace(/^[a-zA-Z]\s*-\s*/, '').replace(/\s*[(（][^()（）]*[)）]$/, '').trim();
  }

  show() {
    this.isVisible = true;
    this.selectedCandidateItem = null;
    this.hoverCandidateItem = null;
    if (this.elPaperdollModal) {
      this.elPaperdollModal.classList.remove('hidden');
    }
    this.render();
  }

  hide() {
    this.isVisible = false;
    this.selectedCandidateItem = null;
    this.hoverCandidateItem = null;
    if (this.elPaperdollModal) {
      this.elPaperdollModal.classList.add('hidden');
    }
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * ペーパードールモーダルの全描画
   */
  render() {
    if (!this.isVisible || !this.elPaperdollModal) return;

    const core = this.getCore();
    const situation = (core && core.gkl && typeof core.gkl.getSituation === 'function')
      ? core.gkl.getSituation()
      : (core && typeof core.getSituation === 'function' ? core.getSituation() : null);

    const inventory = situation?.inventory || (core?.inventory?.items ? core.inventory : { items: [] });
    const status = situation?.status || core?.status || {};
    const encumbrance = situation?.encumbrance || null;

    // 現在の装備状態マップ抽出
    const equippedState = EquipmentDependencyAnalyzer.extractEquippedState(inventory);

    const isEn = this.currentLanguage === 'en';
    const currentAc = typeof status.ac === 'number' ? status.ac : 10;
    const currentWeight = encumbrance?.totalWeight ?? 0;

    // HTMLテンプレート構築
    this.elPaperdollModal.innerHTML = `
      <div class="paperdoll-modal-card" role="dialog" aria-modal="true">
        <!-- ヘッダー -->
        <div class="paperdoll-header">
          <div class="paperdoll-title-group">
            <h2 class="paperdoll-title">
              <span>🎽</span>
              <span>${isEn ? 'Equipment Paperdoll & Loadout' : '装備詳細 ＆ ペーパードール'}</span>
            </h2>
            <div class="paperdoll-status-summary">
              <span class="badge-ac">AC: ${currentAc}</span>
              <span class="badge-weight">⚖️ ${currentWeight}</span>
            </div>
          </div>
          <button class="paperdoll-close-btn" id="btn-paperdoll-close" title="閉じる (Esc)">✖</button>
        </div>

        <!-- 2ペインメインボディ -->
        <div class="paperdoll-body">
          <!-- 左ペイン: ペーパードール人型スロット -->
          <div class="paperdoll-stage">
            <div class="paperdoll-avatar-bg"></div>
            <div class="paperdoll-grid">
              <!-- 1行目: 頭・目・首 -->
              <div class="paperdoll-row">
                ${this._renderSlotHtml(EQUIP_SLOTS.HELM, equippedState)}
                ${this._renderSlotHtml(EQUIP_SLOTS.BLINDFOLD, equippedState)}
                ${this._renderSlotHtml(EQUIP_SLOTS.AMULET, equippedState)}
              </div>

              <!-- 2行目: 主手 / 胴体3層レイヤード / 副手 -->
              <div class="paperdoll-row" style="align-items: stretch;">
                <div style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
                  ${this._renderSlotHtml(EQUIP_SLOTS.MAIN_HAND, equippedState)}
                  ${this._renderSlotHtml(EQUIP_SLOTS.OFF_HAND, equippedState)}
                </div>

                <!-- 胴体3層レイヤードカード (外套 ➔ 鎧 ➔ シャツ) -->
                <div class="torso-layer-container">
                  <div class="torso-layer-title">${isEn ? 'TORSO LAYERS (OUTER ➔ INNER)' : '胴体3層レイヤー（外 ➔ 内）'}</div>
                  ${this._renderTorsoSlotHtml(EQUIP_SLOTS.CLOAK, equippedState)}
                  ${this._renderTorsoSlotHtml(EQUIP_SLOTS.SUIT, equippedState)}
                  ${this._renderTorsoSlotHtml(EQUIP_SLOTS.SHIRT, equippedState)}
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px; justify-content: center;">
                  ${this._renderSlotHtml(EQUIP_SLOTS.SHIELD, equippedState)}
                </div>
              </div>

              <!-- 3行目: 手・左指・右指 -->
              <div class="paperdoll-row">
                ${this._renderSlotHtml(EQUIP_SLOTS.GLOVES, equippedState)}
                ${this._renderSlotHtml(EQUIP_SLOTS.LEFT_RING, equippedState)}
                ${this._renderSlotHtml(EQUIP_SLOTS.RIGHT_RING, equippedState)}
              </div>

              <!-- 4行目: 矢筒・足 -->
              <div class="paperdoll-row">
                ${this._renderSlotHtml(EQUIP_SLOTS.QUIVER, equippedState)}
                ${this._renderSlotHtml(EQUIP_SLOTS.BOOTS, equippedState)}
              </div>
            </div>
          </div>

          <!-- 右ペイン: アイテムクイックセレクター ＆ 差分プレビュー -->
          <div class="paperdoll-sidebar">
            <div id="paperdoll-selector-container" class="paperdoll-selector-box">
              ${this._renderQuickSelectorHtml(inventory, equippedState)}
            </div>
            <div id="paperdoll-diff-container">
              ${this._renderDiffCardHtml(equippedState, status, encumbrance, inventory)}
            </div>
          </div>

        </div>
      </div>
    `;

    this._bindEvents(equippedState, inventory, status, encumbrance);
  }

  /**
   * 通常スロットのHTMLレンダリング
   * @private
   */
  _renderSlotHtml(slotId, equippedState) {
    const isEn = this.currentLanguage === 'en';
    const def = this.slotDefinitions[slotId] || { labelJa: slotId, labelEn: slotId, icon: '📦' };
    const item = equippedState[slotId] || null;
    const isSelected = this.selectedSlot === slotId;

    let iconHtml = def.icon;
    let bucTagHtml = '';
    let letterTagHtml = '';
    let cursedClass = '';

    if (item) {
      letterTagHtml = `<span class="slot-letter-tag">${item.letter || ''}</span>`;

      if (item.isCursed) {
        cursedClass = 'is-cursed';
        bucTagHtml = `<span class="slot-buc-tag buc-cursed">-</span>`;
      } else if (item.isBlessed) {
        bucTagHtml = `<span class="slot-buc-tag buc-blessed">+</span>`;
      } else if (item.isUncursed) {
        bucTagHtml = `<span class="slot-buc-tag buc-uncursed">u</span>`;
      }

      // タイル画像の適用
      const core = this.getCore();
      if (item.glyphId >= 0 && core && typeof core.getGlyphStyle === 'function') {
        const tileImg = this.getLoadedTileImagePath();
        const styleObj = core.getGlyphStyle(item.glyphId, { tileImage: tileImg, tileSize: 32, displaySize: 28 });
        if (styleObj && styleObj.backgroundImage) {
          const styleStr = Object.entries(styleObj).map(([k, v]) => `${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${v}`).join(';');
          iconHtml = `<div style="${styleStr}; width:28px; height:28px;"></div>`;
        }
      }
    }

    const itemName = item ? this._getItemDisplayName(item) : (isEn ? def.labelEn : def.labelJa);
    const itemShortName = itemName.length > 9 ? itemName.slice(0, 8) + '…' : itemName;

    return `
      <div class="paperdoll-slot ${isSelected ? 'is-selected' : ''} ${cursedClass}"
           data-slot="${slotId}"
           title="${itemName}">
        ${letterTagHtml}
        ${bucTagHtml}
        <div class="slot-icon-box">${iconHtml}</div>
        <div class="slot-label">${item ? itemShortName : (isEn ? def.labelEn : def.labelJa)}</div>
      </div>
    `;
  }

  /**
   * 胴体3層レイヤードスロットのHTMLレンダリング
   * @private
   */
  _renderTorsoSlotHtml(slotId, equippedState) {
    const isEn = this.currentLanguage === 'en';
    const def = this.slotDefinitions[slotId];
    const item = equippedState[slotId] || null;
    const isSelected = this.selectedSlot === slotId;

    let layerBadgeClass = 'badge-cloak';
    let layerNum = '3';
    let layerTypeClass = 'layer-cloak';
    if (slotId === EQUIP_SLOTS.SUIT) {
      layerBadgeClass = 'badge-suit';
      layerNum = '2';
      layerTypeClass = 'layer-suit';
    } else if (slotId === EQUIP_SLOTS.SHIRT) {
      layerBadgeClass = 'badge-shirt';
      layerNum = '1';
      layerTypeClass = 'layer-shirt';
    }

    let iconHtml = def.icon;
    let bucTag = '';
    let cursedClass = '';
    if (item) {
      if (item.isCursed) {
        cursedClass = 'is-cursed';
        bucTag = `<span class="slot-buc-tag buc-cursed">-</span>`;
      } else if (item.isBlessed) {
        bucTag = `<span class="slot-buc-tag buc-blessed">+</span>`;
      }
    }

    const itemName = item ? `${item.letter ? item.letter + ' - ' : ''}${this._getItemDisplayName(item)}` : (isEn ? `Empty (${def.labelEn})` : `(未着用: ${def.labelJa})`);

    return `
      <div class="torso-layer-slot ${layerTypeClass} ${isSelected ? 'is-selected' : ''} ${cursedClass}"
           data-slot="${slotId}"
           title="${itemName}">
        <span class="torso-layer-badge ${layerBadgeClass}">L${layerNum}</span>
        <div class="slot-icon-box" style="width:24px; height:24px; font-size:16px;">${iconHtml}</div>
        <div class="torso-item-info">${itemName}</div>
        ${bucTag}
      </div>
    `;
  }

  /**
   * リアルタイム差分プレビューカードのHTMLレンダリング
   * @private
   */
  _renderDiffCardHtml(equippedState, status, encumbrance, inventory) {
    const isEn = this.currentLanguage === 'en';
    const activeSlot = this.selectedSlot;
    const currentItem = equippedState[activeSlot] || null;
    const targetItem = this.hoverCandidateItem || this.selectedCandidateItem;

    // 換装先が未選択（または現在のアイテムと同じ）かつ脱衣でない場合
    const isEvaluatingItem = targetItem && (!currentItem || targetItem.letter !== currentItem.letter);
    const isEvaluatingTakeOff = !targetItem && currentItem;

    const diff = EquipmentDependencyAnalyzer.calculateEquipmentDiff(
      equippedState,
      targetItem,
      activeSlot,
      status,
      encumbrance
    );

    // 所要時間 ＆ キーストローク予測
    let turnsText = isEn ? 'Turns: ~1' : '所要時間: 約 1 ターン';
    let warnings = [];
    let canExecute = true;

    if (isEvaluatingItem) {
      const recipe = EquipmentActionPlanner.planForTarget(inventory, targetItem, activeSlot);
      if (recipe) {
        canExecute = recipe.canExecute;
        turnsText = isEn
          ? `Est. Time: ~${recipe.totalEstimatedTurns} turn(s) (${recipe.steps.length} steps)`
          : `所要時間: 約 ${recipe.totalEstimatedTurns} ターン (${recipe.steps.length} ステップ)`;
        warnings = isEn
          ? (recipe.risks?.warningsEn || recipe.risks?.warnings || [])
          : (recipe.risks?.warningsJa || recipe.risks?.warnings || []);
      }
    } else if (isEvaluatingTakeOff) {
      const recipe = EquipmentActionPlanner.planForTakeOff(inventory, activeSlot);
      if (recipe) {
        canExecute = recipe.canExecute;
        turnsText = isEn
          ? `Est. Time: ~${recipe.totalEstimatedTurns} turn(s) (${recipe.steps.length} steps)`
          : `所要時間: 約 ${recipe.totalEstimatedTurns} ターン (${recipe.steps.length} ステップ)`;
        warnings = isEn
          ? (recipe.risks?.warningsEn || recipe.risks?.warnings || [])
          : (recipe.risks?.warningsJa || recipe.risks?.warnings || []);
      }
    }

    const slotDef = this.slotDefinitions[activeSlot] || { labelJa: activeSlot, labelEn: activeSlot };
    const targetDisplayName = this._getItemDisplayName(targetItem);
    const currentDisplayName = this._getItemDisplayName(currentItem);
    const titleText = isEvaluatingItem
      ? (isEn ? `Preview Equip: ${targetDisplayName}` : `換装プレビュー: ${targetDisplayName}`)
      : (isEvaluatingTakeOff
        ? (isEn ? `Preview Take Off: ${currentDisplayName}` : `脱衣プレビュー: ${currentDisplayName}`)
        : (isEn ? `Slot: ${slotDef.labelEn}` : `スロット: ${slotDef.labelJa}`));

    // AC表示
    let acClass = 'delta-neutral';
    if (diff.ac.isImproved) acClass = 'delta-better';
    if (diff.ac.isWorsened) acClass = 'delta-worse';

    // 耐性バッジ
    let propsHtml = '';
    for (const p of diff.properties.added) {
      propsHtml += `<span class="prop-badge prop-added">+ ${isEn ? p.labelEn : p.labelJa}</span>`;
    }
    for (const p of diff.properties.removed) {
      propsHtml += `<span class="prop-badge prop-removed">- ${isEn ? p.labelEn : p.labelJa}</span>`;
    }
    if (!propsHtml) {
      propsHtml = `<span style="font-size:11px; color:#64748b;">${isEn ? 'No trait changes' : '特性変動なし'}</span>`;
    }

    // 警告バナー領域 (常時一定の高さを保つ固定スロット)
    let warningBannerHtml = '';
    if (warnings.length > 0) {
      warningBannerHtml = `
        <div class="diff-warning-slot">
          <div class="diff-warning-banner">
            <span>⚠️</span>
            <div>${warnings.join('<br>')}</div>
          </div>
        </div>
      `;
    } else {
      warningBannerHtml = `
        <div class="diff-warning-slot">
          <div class="diff-safe-hint">
            <span>✅</span>
            <span>${isEn ? 'No blockers or safety hazards detected.' : '換装の阻害要因や危険はありません。'}</span>
          </div>
        </div>
      `;
    }

    // アクションボタンバー (常時固定スロット)
    const canEquip = isEvaluatingItem && canExecute && !this.isProcessing;
    const canTakeOff = currentItem && !isEvaluatingItem && canExecute && !this.isProcessing;

    let actionBarHtml = '';
    if (isEvaluatingItem) {
      actionBarHtml = `
        <div class="diff-action-bar">
          <button class="btn-paperdoll-action btn-equip" id="btn-paperdoll-equip" ${canEquip ? '' : 'disabled'}>
            <span>✨</span>
            <span>${isEn ? 'Equip Item' : '換装を実行する'}</span>
          </button>
        </div>
      `;
    } else if (isEvaluatingTakeOff || currentItem) {
      actionBarHtml = `
        <div class="diff-action-bar">
          <button class="btn-paperdoll-action btn-takeoff" id="btn-paperdoll-takeoff" ${canTakeOff ? '' : 'disabled'}>
            <span>🔻</span>
            <span>${isEn ? 'Take Off' : '脱ぐ / 外す'}</span>
          </button>
        </div>
      `;
    } else {
      actionBarHtml = `
        <div class="diff-action-bar">
          <button class="btn-paperdoll-action btn-equip" id="btn-paperdoll-equip" disabled>
            <span>👆</span>
            <span>${isEn ? 'Select item from list above' : '上のリストからアイテムを選択'}</span>
          </button>
        </div>
      `;
    }

    return `
      <div class="paperdoll-diff-card">
        <div class="diff-header">
          <div class="diff-title">
            <span>📊</span>
            <span>${titleText}</span>
          </div>
        </div>

        <div class="diff-grid">
          <!-- AC メトリクス -->
          <div class="diff-metric-box">
            <div class="metric-label">${isEn ? 'Armor Class (AC)' : 'アーマークラス (AC)'}</div>
            <div class="metric-val-row">
              <span class="metric-val">${diff.ac.currentAc} ➔ ${diff.ac.targetAc}</span>
              <span class="metric-delta ${acClass}">(${isEn ? diff.ac.labelEn : diff.ac.labelJa})</span>
            </div>
          </div>

          <!-- 重量メトリクス -->
          <div class="diff-metric-box">
            <div class="metric-label">${isEn ? 'Weight' : 'アイテム重量'}</div>
            <div class="metric-val-row">
              <span class="metric-val">${diff.weight.newWeight}</span>
              <span class="metric-delta delta-neutral">(Δ ${diff.weight.deltaWeight >= 0 ? '+' : ''}${diff.weight.deltaWeight})</span>
            </div>
          </div>
        </div>

        <!-- 付与・喪失耐性バッジ -->
        <div class="diff-props-container">
          <div class="metric-label">${isEn ? 'Conveyed Traits / Resistances' : '付与・喪失する特性 ＆ 耐性'}</div>
          <div class="diff-props-list">${propsHtml}</div>
        </div>

        <!-- 所要時間 -->
        <div class="diff-time-box">
          <span>⏱️ ${turnsText}</span>
        </div>

        ${warningBannerHtml}

        <!-- アクションボタンバー (固定スロット) -->
        ${actionBarHtml}
      </div>
    `;

  }

  /**
   * 適合アイテム一覧（クイックセレクター）のHTMLレンダリング
   * @private
   */
  _renderQuickSelectorHtml(inventory, equippedState) {
    const isEn = this.currentLanguage === 'en';
    const activeSlot = this.selectedSlot;
    const items = inventory?.items || [];

    // 現在選択中のスロットに装備可能なアイテムを抽出
    const eligibleItems = items.filter(item => {
      const slots = resolveEligibleSlots(item);
      return slots.includes(activeSlot);
    });

    const rowsHtml = eligibleItems.length === 0
      ? `<div class="selector-empty-hint">${isEn ? 'No eligible items in inventory' : 'このスロットに装備可能なアイテムがありません'}</div>`
      : eligibleItems.map(item => {
          const isSelected = this.selectedCandidateItem && this.selectedCandidateItem.letter === item.letter;
          const isCurrentlyWorn = equippedState[activeSlot] && equippedState[activeSlot].letter === item.letter;
          const bucMark = item.isCursed ? '(-)' : (item.isBlessed ? '(+)' : '');

          return `
            <div class="selector-item-row ${isSelected ? 'is-selected' : ''} ${isCurrentlyWorn ? 'is-worn' : ''}"
                 data-letter="${item.letter}">
              <span class="selector-item-letter">${item.letter}</span>
              <span class="selector-item-name">${this._getItemDisplayName(item)} ${bucMark}</span>
              ${isCurrentlyWorn ? `<span style="font-size:10px; color:#a5b4fc;">[${isEn ? 'Equipped' : '装備中'}]</span>` : ''}
            </div>
          `;
        }).join('');

    const def = this.slotDefinitions[activeSlot] || { labelJa: activeSlot, labelEn: activeSlot };

    return `
      <div class="selector-header">
        <span>${isEn ? `Eligible Items for [${def.labelEn}]` : `[${def.labelJa}] に装備可能なアイテム`}</span>
        <span>(${eligibleItems.length})</span>
      </div>
      <div class="selector-item-list">
        ${rowsHtml}
      </div>
    `;
  }

  /**
   * 全DOMイベントのバインド
   * @private
   */
  _bindEvents(equippedState, inventory, status, encumbrance) {
    if (!this.elPaperdollModal) return;

    // 閉じるボタン
    const closeBtn = this.elPaperdollModal.querySelector('#btn-paperdoll-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    // スロットクリック & ドラッグターゲット
    const allSlots = this.elPaperdollModal.querySelectorAll('[data-slot]');
    allSlots.forEach(slotEl => {
      const slotId = slotEl.dataset.slot;

      slotEl.onclick = () => {
        this.selectedSlot = slotId;
        this.selectedCandidateItem = null;
        this.hoverCandidateItem = null;
        this.render();
      };

      // ドラッグ＆ドロップ対応
      slotEl.ondragover = (e) => {
        e.preventDefault();
        slotEl.classList.add('is-drag-over');
      };

      slotEl.ondragleave = () => {
        slotEl.classList.remove('is-drag-over');
      };

      slotEl.ondrop = async (e) => {
        e.preventDefault();
        slotEl.classList.remove('is-drag-over');
        const letter = e.dataTransfer?.getData('text/plain');
        if (!letter) return;

        const droppedItem = (inventory?.items || []).find(it => it.letter === letter);
        if (droppedItem) {
          const eligible = resolveEligibleSlots(droppedItem);
          if (eligible.includes(slotId)) {
            this.selectedSlot = slotId;
            await this.executeEquip(droppedItem, slotId);
          } else {
            alert(this.currentLanguage === 'en'
              ? `Cannot equip "${droppedItem.name || droppedItem.rawText}" in this slot.`
              : `「${droppedItem.name || droppedItem.rawText}」はこのスロットに装備できません。`);
          }
        }
      };
    });

    // クイックセレクターアイテム選択
    const itemRows = this.elPaperdollModal.querySelectorAll('.selector-item-row');
    itemRows.forEach(row => {
      const letter = row.dataset.letter;
      const item = (inventory?.items || []).find(it => it.letter === letter);

      row.onclick = () => {
        this.selectedCandidateItem = item;
        this.hoverCandidateItem = null;
        this.render();
      };

      row.onmouseenter = () => {
        this.hoverCandidateItem = item;
        const diffContainer = this.elPaperdollModal.querySelector('#paperdoll-diff-container');
        if (diffContainer) {
          diffContainer.innerHTML = this._renderDiffCardHtml(equippedState, status, encumbrance, inventory);
          this._bindActionButtons(equippedState, inventory);
        }
      };

      row.onmouseleave = () => {
        this.hoverCandidateItem = null;
        const diffContainer = this.elPaperdollModal.querySelector('#paperdoll-diff-container');
        if (diffContainer) {
          diffContainer.innerHTML = this._renderDiffCardHtml(equippedState, status, encumbrance, inventory);
          this._bindActionButtons(equippedState, inventory);
        }
      };

      // ダブルクリックで即時換装
      row.ondblclick = async () => {
        if (item) {
          await this.executeEquip(item, this.selectedSlot);
        }
      };
    });

    this._bindActionButtons(equippedState, inventory);
  }

  /**
   * アクションボタン（換装 / 脱衣）のバインド
   * @private
   */
  _bindActionButtons(equippedState, inventory) {
    const btnEquip = this.elPaperdollModal.querySelector('#btn-paperdoll-equip');
    if (btnEquip) {
      btnEquip.onclick = async () => {
        const item = this.selectedCandidateItem || this.hoverCandidateItem;
        if (item) {
          await this.executeEquip(item, this.selectedSlot);
        }
      };
    }

    const btnTakeOff = this.elPaperdollModal.querySelector('#btn-paperdoll-takeoff');
    if (btnTakeOff) {
      btnTakeOff.onclick = async () => {
        await this.executeTakeOff(this.selectedSlot);
      };
    }
  }

  /**
   * アイテム換装を実行
   * @param {Object} item
   * @param {string} slotId
   */
  async executeEquip(item, slotId) {
    if (!item || this.isProcessing) return;

    const core = this.getCore();
    if (!core) return;

    const situation = (core && core.gkl && typeof core.gkl.getSituation === 'function')
      ? core.gkl.getSituation()
      : (core && typeof core.getSituation === 'function' ? core.getSituation() : null);
    const inventory = situation?.inventory || (core?.inventory?.items ? core.inventory : { items: [] });

    const recipe = EquipmentActionPlanner.planForTarget(inventory, item, slotId);
    if (!recipe) return;

    if (!recipe.canExecute) {
      const isEn = this.currentLanguage === 'en';
      const reason = isEn ? (recipe.blockingReasonEn || recipe.blockingReason) : (recipe.blockingReasonJa || recipe.blockingReason);
      this._showAlert((isEn ? '[Equipment Safety Guard]\n' : '【装備セーフティガード】\n') + reason);
      return;
    }

    // 複数ターンまたは危険時の確認
    const hasHostileNearby = this._checkNearbyHostile(core);
    if (recipe.isMultiTurn || hasHostileNearby || recipe.risks?.targetBucStatus === 'unknown') {
      const isEn = this.currentLanguage === 'en';
      const itemName = this._getItemDisplayName(item);
      const stepLines = recipe.steps.map((s, idx) => `  ${idx + 1}. ${isEn ? s.descriptionEn : s.descriptionJa}`).join('\n');
      let msg = isEn
        ? `[Equipment Change Confirmation]\nEquip "${itemName}"?\n\nSteps:\n${stepLines}\n\nEstimated turns: ~${recipe.totalEstimatedTurns}.\n`
        : `【装備換装の確認】\n「${itemName}」を装備しますか？\n\n手順:\n${stepLines}\n\n所要ターン数: 約 ${recipe.totalEstimatedTurns} ターン\n`;

      if (hasHostileNearby) {
        msg += isEn ? `⚠️ WARNING: Hostile monster nearby!\n` : `⚠️ 警告: 近くに敵対モンスターがいます！\n`;
      }
      if (recipe.risks?.targetBucStatus === 'unknown') {
        msg += isEn ? `⚠️ Note: Item BUC status is unknown (may be cursed).\n` : `⚠️ 注意: 呪詛状態(BUC)が未確定です。\n`;
      }
      msg += isEn ? `Proceed?` : `換装を実行しますか？`;

      if (!this._showConfirm(msg)) return;
    }

    this.isProcessing = true;
    try {
      await this._executeSequence(core, recipe.sequence);
      this.selectedCandidateItem = null;
      this.hoverCandidateItem = null;
      if (typeof this.onEquipmentChanged === 'function') {
        this.onEquipmentChanged();
      }
    } finally {
      this.isProcessing = false;
      this.render();
    }
  }

  /**
   * 装備中のアイテムを脱ぐ
   * @param {string} slotId
   */
  async executeTakeOff(slotId) {
    if (this.isProcessing) return;

    const core = this.getCore();
    if (!core) return;

    const situation = (core && core.gkl && typeof core.gkl.getSituation === 'function')
      ? core.gkl.getSituation()
      : (core && typeof core.getSituation === 'function' ? core.getSituation() : null);
    const inventory = situation?.inventory || (core?.inventory?.items ? core.inventory : { items: [] });

    const recipe = EquipmentActionPlanner.planForTakeOff(inventory, slotId);
    if (!recipe) return;

    if (!recipe.canExecute) {
      const isEn = this.currentLanguage === 'en';
      const reason = isEn ? (recipe.blockingReasonEn || recipe.blockingReason) : (recipe.blockingReasonJa || recipe.blockingReason);
      this._showAlert((isEn ? '[Equipment Safety Guard]\n' : '【装備セーフティガード】\n') + reason);
      return;
    }

    const hasHostileNearby = this._checkNearbyHostile(core);
    if (recipe.isMultiTurn || hasHostileNearby) {
      const isEn = this.currentLanguage === 'en';
      const stepLines = recipe.steps.map((s, idx) => `  ${idx + 1}. ${isEn ? s.descriptionEn : s.descriptionJa}`).join('\n');
      let msg = isEn
        ? `[Equipment Removal Confirmation]\nTake off equipment?\n\nSteps:\n${stepLines}\n\nEstimated turns: ~${recipe.totalEstimatedTurns}.\n`
        : `【装備脱衣の確認】\n装備を脱ぎますか？\n\n手順:\n${stepLines}\n\n所要ターン数: 約 ${recipe.totalEstimatedTurns} ターン\n`;

      if (hasHostileNearby) {
        msg += isEn ? `⚠️ WARNING: Hostile monster nearby!\n` : `⚠️ 警告: 近くに敵対モンスターがいます！\n`;
      }
      msg += isEn ? `Proceed?` : `脱衣を実行しますか？`;

      if (!this._showConfirm(msg)) return;
    }


    this.isProcessing = true;
    try {
      await this._executeSequence(core, recipe.sequence);
      this.selectedCandidateItem = null;
      this.hoverCandidateItem = null;
      if (typeof this.onEquipmentChanged === 'function') {
        this.onEquipmentChanged();
      }
    } finally {
      this.isProcessing = false;
      this.render();
    }
  }

  /**
   * キーストローク列の実行
   * @private
   */
  async _executeSequence(core, seq) {
    if (!core || !seq || seq.length === 0) return;
    if (typeof core.executeSequence === 'function') {
      await core.executeSequence(seq);
    } else if (core.requestController && typeof core.requestController.executeSequence === 'function') {
      await core.requestController.executeSequence(seq);
    } else {
      seq.forEach(ch => core.sendKey(ch, false, false, false, ch, true));
    }
  }

  /**
   * 敵対モンスター接近チェック
   * @private
   */
  _checkNearbyHostile(core) {
    if (!core) return false;
    try {
      if (core.gkl && typeof core.gkl.getPerceivedMonstersSummary === 'function') {
        const summaries = core.gkl.getPerceivedMonstersSummary();
        if (Array.isArray(summaries) && summaries.length > 0) {
          return summaries.some(m => {
            if (m.isPet || m.isPeaceful) return false;
            const dist = typeof m.distance === 'number' ? m.distance : (typeof m.dist === 'number' ? m.dist : 999);
            return dist <= 5;
          });
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  /**
   * アラートダイアログ表示（環境セーフ）
   * @private
   */
  _showAlert(msg) {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(msg);
    } else if (typeof alert === 'function') {
      alert(msg);
    } else {
      console.warn(msg);
    }
  }

  /**
   * 確認ダイアログ表示（環境セーフ）
   * @private
   */
  _showConfirm(msg) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(msg);
    } else if (typeof confirm === 'function') {
      return confirm(msg);
    }
    return true; // テスト環境ではデフォルト許可
  }
}

