/**
 * FloorTrackerModal.js
 *
 * セッション専用フロア記録・マーカー管理モーダル (FloorTrackerModal)。
 *
 * 【アーキテクチャ原則】
 * 1. Cコア絶対真値 (SSOT):
 *    全階層の踏破履歴、観測施設、および階層メモは C コア (svm.mapseenchn) を Direct Binding で直引き。
 * 2. 読み書きの分離:
 *    - 読み取り: GKL / WasmDirectBindingService (0x34 SHIM_CMD_DUMP_MAPSEEN)
 *    - 書き込み: WebUICore / IRC (InteractiveRequestController) を通じた #annotate 安全送信
 * 3. ASCII セーフ & 二重ストレージ分離:
 *    - C コアには純粋な ASCII マーカー列 (!M:154C,2248) のみを保存。
 *    - 表示時に FloorMarkerService の辞書からアイコン・日英ラベルを展開。
 * 4. 現在地ピン打ち方針:
 *    - ピン打ちは「プレイヤーが現在滞在しているフロア」の「足元座標 (u.ux, u.uy)」にのみ許可。
 */

import { FloorMarkerService } from '../../../../src/core/knowledge/services/FloorMarkerService.js';

export class FloorTrackerModal {
  static PRESET_EMOJIS = ['💎', '🧪', '🥩', '📜', '🪄', '🗡️', '🪜', '📌', '🕳️', '🚪', '🏪', '💍', '⚡', '🔥', '❄️', '🍄', '🛡️', '🗝️'];

  /**
   * @param {Object} options
   * @param {HTMLElement} [options.elModal] - モーダル外枠 DOM
   * @param {Function} options.getCore - WebUICore 取得関数
   * @param {FloorMarkerService} [options.floorMarkerService] - マーカーサービス
   * @param {string} [options.language='ja'] - 言語 ('ja' | 'en')
   */
  constructor(options = {}) {
    this.options = options;
    this.elModal = options.elModal || (typeof document !== 'undefined' ? document.getElementById('floor-tracker-modal') : null);
    this.getCore = options.getCore || (() => null);
    this.floorMarkerService = options.floorMarkerService || FloorMarkerService.getInstance();
    this.currentLanguage = options.language === 'en' ? 'en' : 'ja';

    this.isVisible = false;
    this.isSaving = false;
    this.selectedFloorKey = null; // 選択中フロアの識別子 (例: "Dlvl:3")
    this.draftMarkers = [];       // 編集中マーカーリスト
    this.draftMemo = '';          // 編集中メモテキスト
    this.isCustomEditorOpen = false; // カスタムタグ作成・編集エディタ表示フラグ
    this.editingSlotId = 6;       // 編集中のカスタムスロット番号 (6〜15)

    this._ensureDom();

    // <nh-modal> 外枠連携
    this.nhModal = (this.elModal && this.elModal.closest)
      ? this.elModal.closest('nh-modal')
      : (typeof document !== 'undefined' ? document.getElementById('nh-modal-floor-tracker') : null);

    if (this.nhModal && typeof this.nhModal.addEventListener === 'function') {
      this.nhModal.addEventListener('nh-modal-close', () => {
        if (this.isVisible) this.close();
      });
    }

    this._boundCore = null;
    this._ensureCoreEvents();
  }

  _ensureCoreEvents() {
    const core = this.getCore();
    if (!core || this._boundCore === core || typeof core.on !== 'function') return;

    this._boundCore = core;
    core.on('dungeonOverviewUpdated', () => {
      if (this.isVisible) {
        this.render();
      }
    });
  }

  _ensureDom() {
    if (typeof document === 'undefined') return;

    if (!this.elModal) {
      let modal = document.getElementById('floor-tracker-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'floor-tracker-modal';
        modal.className = 'modal-backdrop hidden';
        document.body.appendChild(modal);
      }
      this.elModal = modal;
    }

    if (this.elModal && typeof this.elModal.addEventListener === 'function') {
      this.elModal.addEventListener('click', (e) => {
        if (e.target === this.elModal) {
          this.close();
        }
      });

      // モーダル表示中のキーボード操作が背景の NetHack ゲーム Canvas / Driver に漏れるのを確実に防止
      this.elModal.addEventListener('keydown', (e) => {
        // Escape キーでモーダルを閉じる
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.close();
          return;
        }

        // Enter キー かつ メモ入力欄にいるときは保存処理を実行
        if (e.key === 'Enter' && e.target && e.target.id === 'ft-memo-input') {
          e.preventDefault();
          e.stopPropagation();
          this.saveAnnotation();
          return;
        }

        // モーダル内のキーイベント（タイピングや矢印キー等）がグローバルゲームハンドラに漏れないよう遮断
        e.stopPropagation();
      });
    }
  }

  /**
   * モーダル内の入力要素にフォーカスがあるかを判定
   * @returns {boolean}
   */
  isInputFocused() {
    if (!this.elModal || typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active) return false;
    const isInside = (typeof this.elModal.contains === 'function')
      ? this.elModal.contains(active)
      : (active === this.elModal || (active.id === 'ft-memo-input') || (active.id === 'ft-floor-select'));
    return Boolean(isInside && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
  }

  isOpen() {
    return this.isVisible;
  }

  setLanguage(lang) {
    this.currentLanguage = lang === 'en' ? 'en' : 'ja';
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * モーダルを開き、最新のダンジョン踏破データをオンデマンド同期
   */
  async open() {
    this._ensureCoreEvents();
    this.isVisible = true;
    if (this.elModal) {
      this.elModal.classList.remove('hidden');
    }

    await this.syncLatestData();
    this._initDraftForCurrentFloor();
    this.render();
  }

  show() {
    return this.open();
  }

  close() {
    this.isVisible = false;
    if (this.elModal) {
      this.elModal.classList.add('hidden');
    }
  }

  hide() {
    this.close();
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * C コアからの最新踏破データ (svm.mapseenchn) をオンデマンド再取得
   */
  async syncLatestData() {
    const core = this.getCore();
    if (core && typeof core.syncDungeonOverviewOnDemand === 'function') {
      try {
        await core.syncDungeonOverviewOnDemand();
      } catch (e) {
        console.warn('[FloorTrackerModal] syncLatestData error:', e);
      }
    }
  }

  /**
   * 現在プレイヤーがいるフロアの特定と初期選択
   */
  _initDraftForCurrentFloor() {
    const currentFloor = this._getCurrentPlayerFloor();
    const overview = this._getDungeonOverview();

    // 選択中フロアのデフォルト設定
    if (!this.selectedFloorKey || !overview.some(f => f.floorKey === this.selectedFloorKey)) {
      this.selectedFloorKey = currentFloor.floorKey;
    }

    this._syncDraftFromSelectedFloor();
  }

  _syncDraftFromSelectedFloor() {
    const overview = this._getDungeonOverview();
    const floor = overview.find(f => f.floorKey === this.selectedFloorKey);
    const annotation = floor ? (floor.annotation || '') : '';

    const parsed = this.floorMarkerService.parseAnnotation(annotation);
    this.draftMemo = parsed.memo;
    this.draftMarkers = parsed.markers.map(m => ({ ...m }));
  }

  _getDungeonOverview() {
    const current = this._getCurrentPlayerFloor();
    let list = [];
    const core = this.getCore();
    if (core && typeof core.getDungeonOverview === 'function') {
      const raw = core.getDungeonOverview();
      if (Array.isArray(raw)) {
        list = raw;
      }
    }

    // 有効な階層データ（dlevel > 0, dnum >= 0）のみを抽出
    const map = new Map();
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const dlevel = Number(item.dlevel);
      const dnum = Number(item.dnum);
      if (isNaN(dlevel) || dlevel <= 0 || isNaN(dnum) || dnum < 0) continue;
      const key = item.floorKey || ((dnum === 0) ? `Dlvl:${dlevel}` : `${item.branchId || 'dungeon'}:${dlevel}`);
      // 重複エントリは後勝ち
      map.set(key, { ...item, dlevel, dnum, floorKey: key });
    }

    // 現在プレイヤー階層が未登録の場合は補完
    if (current && current.floorKey && !map.has(current.floorKey)) {
      map.set(current.floorKey, {
        dnum: current.dnum,
        dlevel: current.dlevel,
        branchId: current.branchId,
        branchName: current.branchName,
        branchNameJa: current.branchNameJa,
        floorKey: current.floorKey,
        features: {},
        flags: {},
        annotation: ''
      });
    }

    const validList = Array.from(map.values());

    // C コア踏破の論理順（dnum 昇順、dlevel 昇順）にソート
    validList.sort((a, b) => {
      if (a.dnum !== b.dnum) return a.dnum - b.dnum;
      return a.dlevel - b.dlevel;
    });

    return validList.length > 0 ? validList : [{
      dnum: current.dnum,
      dlevel: current.dlevel,
      branchId: current.branchId,
      branchName: current.branchName,
      branchNameJa: current.branchNameJa,
      floorKey: current.floorKey,
      features: {},
      flags: {},
      annotation: ''
    }];
  }

  /**
   * 階層セレクター用の親切なラベル生成
   * @param {Object} floor
   * @param {Object} currentFloor
   * @param {boolean} isEn
   * @returns {string}
   */
  _formatFloorOptionLabel(floor, currentFloor, isEn) {
    const isCur = (floor.floorKey === currentFloor.floorKey);
    const curBadge = isCur ? (isEn ? ' 📍[Current]' : ' 📍[現在地]') : '';

    // 特徴アイコンのプレビュー集約
    const featIcons = [];
    const feats = floor.features || {};
    if (feats.shops > 0) featIcons.push('🏪');
    if (feats.altars > 0) featIcons.push('⛪');
    if (feats.fountains > 0) featIcons.push('⛲');
    if (feats.sinks > 0) featIcons.push('🚰');
    if (feats.thrones > 0) featIcons.push('👑');
    if (feats.temples > 0) featIcons.push('🏛️');
    const featBadge = featIcons.length > 0 ? ` [${featIcons.join('')}]` : '';

    // メモ内容のプレビュー（マーカー記号は除外して純粋メモのみ）
    let memoBadge = '';
    if (floor.annotation) {
      try {
        const parsed = this.floorMarkerService.parseAnnotation(floor.annotation);
        if (parsed.memo && parsed.memo.trim().length > 0) {
          const cleanMemo = parsed.memo.trim();
          memoBadge = ` - "${cleanMemo.length > 20 ? cleanMemo.substring(0, 20) + '…' : cleanMemo}"`;
        }
      } catch (_) {
        const rawTrim = floor.annotation.replace(/!M:[0-9a-fA-F,]+/g, '').trim();
        if (rawTrim) {
          memoBadge = ` - "${rawTrim.length > 20 ? rawTrim.substring(0, 20) + '…' : rawTrim}"`;
        }
      }
    }

    // 階層名フォーマット
    const dnum = floor.dnum ?? 0;
    const dlevel = floor.dlevel ?? 1;
    let name = '';
    if (dnum === 0) {
      name = isEn ? `Dungeons of Doom: Level ${dlevel} (${floor.floorKey})` : `運命の迷宮 地下${dlevel}階 (${floor.floorKey})`;
    } else {
      const bName = isEn ? (floor.branchName || 'Dungeon') : (floor.branchNameJa || floor.branchName || 'ダンジョン');
      name = isEn ? `${bName}: Level ${dlevel} (${floor.floorKey})` : `${bName} ${dlevel}階 (${floor.floorKey})`;
    }

    return `${name}${curBadge}${featBadge}${memoBadge}`;
  }

  _getCurrentPlayerFloor() {
    const core = this.getCore();
    const status = (core && typeof core.getStatus === 'function') ? core.getStatus() : null;
    const area = core?.gkl?.areaStateManager;

    const dnum = area?.currentDnum ?? 0;
    const dlevel = area?.currentDlevel ?? (status?.dlevel?.dlevel ?? 1);
    const branchId = area?.currentBranchId ?? 'dungeon';
    const branchName = area?.playerSummary?.branchName ?? 'Dungeons of Doom';
    const branchNameJa = area?.playerSummary?.branchNameJa ?? '運命の迷宮';
    const floorKey = (dnum === 0) ? `Dlvl:${dlevel}` : `${branchId}:${dlevel}`;

    const playerX = area?.playerX ?? 0;
    const playerY = area?.playerY ?? 0;

    return {
      dnum,
      dlevel,
      branchId,
      branchName,
      branchNameJa,
      floorKey,
      playerX,
      playerY
    };
  }

  /**
   * モーダル描画
   */
  render() {
    if (!this.elModal) return;

    const isEn = this.currentLanguage === 'en';
    const currentFloor = this._getCurrentPlayerFloor();
    const overview = this._getDungeonOverview();

    // 選択中フロアのデータ
    const selectedFloor = overview.find(f => f.floorKey === this.selectedFloorKey) || overview[0] || {
      floorKey: currentFloor.floorKey,
      features: {},
      flags: {},
      annotation: ''
    };

    const isCurrentFloorSelected = (selectedFloor.floorKey === currentFloor.floorKey);
    const slots = this.floorMarkerService.getAllSlots();
    const presetSlots = slots.slice(0, 6);
    const customSlots = slots.slice(6);
    const configuredCustom = customSlots.filter(s => s.isConfigured);
    const editingSlotDef = this.floorMarkerService.getSlotDefinition(this.editingSlotId);

    // C コア書き込みプレビュー計算
    const previewAnnotation = this.floorMarkerService.formatAnnotation(this.draftMemo, this.draftMarkers);
    const charCount = previewAnnotation.length;
    const isOverflow = charCount > 64;

    this.elModal.innerHTML = `
      <div class="floor-tracker-modal-card" role="dialog" aria-modal="true" aria-label="${isEn ? 'Floor Tracker & Markers' : 'フロア記録・マーカー管理'}">
        <!-- ヘッダー -->
        <div class="floor-tracker-header">
          <div class="floor-tracker-title-group">
            <h2 class="floor-tracker-title">
              <span>🗺️</span>
              <span>${isEn ? 'Floor Tracker & Markers' : 'フロア記録・マーカー管理'}</span>
            </h2>
          </div>
          <button type="button" class="floor-tracker-close-btn" id="ft-btn-close" aria-label="${isEn ? 'Close' : '閉じる'}">✕</button>
        </div>

        <!-- コンテンツボディ -->
        <div class="floor-tracker-body">
          <!-- 階層セレクター -->
          <div class="floor-selector-bar">
            <span class="floor-selector-label">${isEn ? 'Select Floor:' : '表示階層:'}</span>
            <select class="floor-selector-select" id="ft-floor-select">
              ${overview.map(f => {
                const label = this._formatFloorOptionLabel(f, currentFloor, isEn);
                return `
                  <option value="${f.floorKey}" ${f.floorKey === this.selectedFloorKey ? 'selected' : ''}>
                    ${label}
                  </option>
                `;
              }).join('')}
            </select>
            ${isCurrentFloorSelected ? `<span class="floor-current-badge">${isEn ? '📍 You are here' : '📍 現在地'}</span>` : ''}
          </div>

          <!-- 観測施設カード -->
          <div class="floor-card">
            <div class="floor-card-title">
              <span>🏛️ ${isEn ? 'Observed Features & Flags' : '観測済み施設・特徴'}</span>
              <span style="font-size: 11px; color: #94a3b8;">${selectedFloor.floorKey}</span>
            </div>
            <div class="floor-features-tags">
              ${this._renderFeatures(selectedFloor.features, selectedFloor.flags, isEn)}
            </div>
          </div>

          <!-- 現在地ピン打ちクイックタグ -->
          <div class="floor-card">
            <div class="floor-card-title">
              <span>📍 ${isEn ? 'Add Marker at Current Position' : '現在地にマーカーを追加'}</span>
              ${isCurrentFloorSelected
                ? `<span class="player-pos-badge">(X: ${currentFloor.playerX}, Y: ${currentFloor.playerY})</span>`
                : ''}
            </div>

            ${!isCurrentFloorSelected
              ? `<div class="floor-not-current-warn">⚠️ ${isEn ? 'Markers can only be pinned on your current floor.' : 'マーカーの追加・編集は現在滞在しているフロアでのみ行えます。'}</div>`
              : `
                <!-- システムプリセットタグ (ID 0 〜 5) -->
                <div class="quick-tags-section">
                  <div class="quick-tags-section-header">
                    <span class="quick-tags-section-title">${isEn ? 'System Presets (6)' : 'システムプリセット (6枠)'}</span>
                  </div>
                  <div class="quick-tags-container">
                    ${presetSlots.map(s => {
                      const label = isEn ? s.labelEn : s.labelJa;
                      return `
                        <button type="button" class="quick-tag-btn preset" data-slot-id="${s.id}" title="${label}">
                          <span class="tag-icon">${s.icon}</span>
                          <span class="tag-label">${label}</span>
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>

                <!-- カスタムタグ (ID 6 〜 15) -->
                <div class="quick-tags-section custom-section">
                  <div class="quick-tags-section-header">
                    <span class="quick-tags-section-title">${isEn ? 'Custom Tags (Slots 6-15)' : 'カスタムタグ (枠 6〜15)'}</span>
                    <button type="button" class="ft-btn-small" id="ft-btn-open-custom-editor">
                      ➕ ${isEn ? 'New / Edit Custom Tag' : 'タグ作成・編集'}
                    </button>
                  </div>
                  <div class="quick-tags-container">
                    ${configuredCustom.length === 0
                      ? `<div class="floor-features-empty" style="font-size: 11px;">${isEn ? 'No custom tags registered. Click "New / Edit Custom Tag" to create one.' : '登録済みカスタムタグはありません。「タグ作成・編集」から作成できます。'}</div>`
                      : configuredCustom.map(s => {
                          const label = isEn ? s.labelEn : s.labelJa;
                          return `
                            <div class="custom-tag-btn-wrapper">
                              <button type="button" class="quick-tag-btn custom" data-slot-id="${s.id}" title="${label}">
                                <span class="tag-icon">${s.icon}</span>
                                <span class="tag-label">${label}</span>
                              </button>
                              <button type="button" class="custom-tag-edit-icon" data-edit-slot-id="${s.id}" title="${isEn ? 'Edit this tag' : 'このタグを編集'}">✏️</button>
                            </div>
                          `;
                        }).join('')
                    }
                  </div>
                </div>

                <!-- カスタムタグ作成・編集エディタ (インライン展開) -->
                ${this.isCustomEditorOpen ? `
                  <div class="custom-tag-editor-box">
                    <div class="custom-editor-header">
                      <span class="custom-editor-title">🛠️ ${isEn ? 'Custom Tag Editor' : 'カスタムタグ設定・編集'}</span>
                      <button type="button" class="floor-tracker-close-btn" id="ft-btn-editor-cancel" aria-label="${isEn ? 'Cancel' : 'キャンセル'}">✕</button>
                    </div>
                    <div class="custom-editor-form">
                      <!-- スロット選択 -->
                      <div class="editor-form-row">
                        <label for="ft-editor-slot-select">${isEn ? 'Slot Number:' : 'スロット番号:'}</label>
                        <select id="ft-editor-slot-select" class="floor-selector-select">
                          ${customSlots.map(s => `
                            <option value="${s.id}" ${s.id === this.editingSlotId ? 'selected' : ''}>
                              #${s.id}: ${s.icon} ${isEn ? s.labelEn : s.labelJa} ${s.isConfigured ? '' : (isEn ? '(Empty)' : '(未設定)')}
                            </option>
                          `).join('')}
                        </select>
                      </div>

                      <!-- アイコン入力 & 絵文字パレット -->
                      <div class="editor-form-row">
                        <label>${isEn ? 'Icon (Emoji):' : 'アイコン (絵文字):'}</label>
                        <div class="editor-icon-group">
                          <input type="text" id="ft-editor-icon-input" class="editor-input-small" value="${editingSlotDef.isConfigured ? editingSlotDef.icon : '💎'}" maxlength="4">
                          <div class="editor-palette-container">
                            ${FloorTrackerModal.PRESET_EMOJIS.map(em => `
                              <button type="button" class="ft-palette-emoji-btn" data-emoji="${em}">${em}</button>
                            `).join('')}
                          </div>
                        </div>
                      </div>

                      <!-- 日本語ラベル -->
                      <div class="editor-form-row">
                        <label for="ft-editor-label-ja">${isEn ? 'Label (Japanese):' : '日本語ラベル:'}</label>
                        <input type="text" id="ft-editor-label-ja" class="memo-input-field" maxlength="20"
                               value="${this._escapeHtml(editingSlotDef.isConfigured ? editingSlotDef.labelJa : '')}"
                               placeholder="${isEn ? 'e.g. Gem Depot' : '例: 宝石保管場所'}">
                      </div>

                      <!-- 英語ラベル -->
                      <div class="editor-form-row">
                        <label for="ft-editor-label-en">${isEn ? 'Label (English):' : '英語ラベル:'}</label>
                        <input type="text" id="ft-editor-label-en" class="memo-input-field" maxlength="20"
                               value="${this._escapeHtml(editingSlotDef.isConfigured ? editingSlotDef.labelEn : '')}"
                               placeholder="${isEn ? 'e.g. Gem Depot' : '例: Gem Depot'}">
                      </div>

                      <!-- エディタ操作ボタン -->
                      <div class="editor-actions-row">
                        ${editingSlotDef.isConfigured ? `
                          <button type="button" class="ft-btn ft-btn-danger" id="ft-btn-editor-delete">
                            🗑️ ${isEn ? 'Delete / Reset Slot' : '削除 (初期化)'}
                          </button>
                        ` : `<div></div>`}
                        <div class="editor-actions-right">
                          <button type="button" class="ft-btn ft-btn-secondary" id="ft-btn-editor-close">
                            ${isEn ? 'Cancel' : 'キャンセル'}
                          </button>
                          <button type="button" class="ft-btn ft-btn-primary" id="ft-btn-editor-save">
                            💾 ${isEn ? 'Save Tag' : 'タグを保存'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ` : ''}
              `
            }
          </div>

          <!-- 登録済みマーカー一覧 -->
          <div class="floor-card">
            <div class="floor-card-title">
              <span>📌 ${isEn ? 'Registered Markers' : '登録済みマーカー'}</span>
              <span style="font-size: 12px; color: #94a3b8;">${this.draftMarkers.length} ${isEn ? 'markers' : '件'}</span>
            </div>
            <div class="registered-markers-list">
              ${this.draftMarkers.length === 0
                ? `<div class="floor-features-empty">${isEn ? 'No markers pinned on this floor.' : 'この階層に登録されたマーカーはありません。'}</div>`
                : this.draftMarkers.map((m, idx) => {
                    const slot = this.floorMarkerService.getSlotDefinition(m.type);
                    const label = isEn ? slot.labelEn : slot.labelJa;
                    return `
                      <div class="marker-item-row">
                        <div class="marker-item-info">
                          <span>${slot.icon}</span>
                          <span style="font-weight: 600;">${label}</span>
                          <span style="color: #94a3b8;">(x: ${m.x}, y: ${m.y})</span>
                        </div>
                        <button type="button" class="marker-delete-btn" data-marker-index="${idx}" ${!isCurrentFloorSelected ? 'disabled' : ''} title="${isEn ? 'Delete' : '削除'}">
                          🗑️ ${isEn ? 'Delete' : '削除'}
                        </button>
                      </div>
                    `;
                  }).join('')
              }
            </div>
          </div>

          <!-- 通常メモ入力 -->
          <div class="floor-card">
            <div class="floor-card-title">
              <span>📝 ${isEn ? 'Floor Note (ASCII Memo)' : '階層メモ (英数字メモ)'}</span>
            </div>
            <div class="memo-input-group">
              <input type="text" class="memo-input-field" id="ft-memo-input" maxlength="40"
                     value="${this._escapeHtml(this.draftMemo)}"
                     placeholder="${isEn ? 'e.g. Shop and altar, stash, etc.' : '例: Shop and altar, stash など'}"
                     ${!isCurrentFloorSelected ? 'disabled' : ''}>
              
              <div class="memo-preview-bar ${isOverflow ? 'overflow' : ''}">
                <span>${isEn ? 'C-Core Preview:' : 'Cコア保存形式:'} <code>${previewAnnotation || '(empty)'}</code></span>
                <span>${charCount} / 64 bytes</span>
              </div>
            </div>
          </div>
        </div>

        <!-- フッター -->
        <div class="floor-tracker-footer">
          <button type="button" class="ft-btn ft-btn-secondary" id="ft-btn-cancel">
            ${isEn ? 'Close' : '閉じる'}
          </button>
          <button type="button" class="ft-btn ft-btn-primary" id="ft-btn-save"
                  ${(!isCurrentFloorSelected || this.isSaving || isOverflow) ? 'disabled' : ''}>
            ${this.isSaving
              ? (isEn ? 'Saving...' : '保存中...')
              : (isEn ? '💾 Save Note & Markers (Enter)' : '💾 保存 (Enter)')
            }
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderFeatures(features = {}, flags = {}, isEn = false) {
    const tags = [];

    // 祭壇
    if (features.altars > 0) {
      const align = isEn ? (features.altarAlign || 'none') : (features.altarAlignJa || '不明');
      tags.push(`<span class="floor-feature-tag">⛪ ${isEn ? `Altar (${align})` : `祭壇 (${align})`}</span>`);
    }

    // 店舗
    if (features.shops > 0) {
      const shopName = isEn ? (features.shopName || 'Shop') : (features.shopNameJa || features.shopName || '店舗');
      tags.push(`<span class="floor-feature-tag">🏪 ${shopName} x${features.shops}</span>`);
    }

    // 泉
    if (features.fountains > 0) {
      tags.push(`<span class="floor-feature-tag">⛲ ${isEn ? 'Fountain' : '泉'} x${features.fountains}</span>`);
    }

    // シンク
    if (features.sinks > 0) {
      tags.push(`<span class="floor-feature-tag">🚰 ${isEn ? 'Sink' : 'シンク'} x${features.sinks}</span>`);
    }

    // 玉座
    if (features.thrones > 0) {
      tags.push(`<span class="floor-feature-tag">👑 ${isEn ? 'Throne' : '玉座'} x${features.thrones}</span>`);
    }

    // 寺院
    if (features.temples > 0) {
      tags.push(`<span class="floor-feature-tag">🏛️ ${isEn ? 'Temple' : '寺院'} x${features.temples}</span>`);
    }

    // 特殊フラグ
    if (flags.sokoSolved) {
      tags.push(`<span class="floor-feature-tag special">🧩 ${isEn ? 'Sokoban Solved' : '倉庫番 踏破済'}</span>`);
    }
    if (flags.oracle) {
      tags.push(`<span class="floor-feature-tag special">🔮 ${isEn ? 'Oracle' : '神託所'}</span>`);
    }
    if (flags.castle) {
      tags.push(`<span class="floor-feature-tag special">🏰 ${isEn ? 'Castle' : '城'}</span>`);
    }
    if (flags.bigRoom) {
      tags.push(`<span class="floor-feature-tag special">📦 ${isEn ? 'Big Room' : '大部屋'}</span>`);
    }
    if (flags.vibratingSquare) {
      tags.push(`<span class="floor-feature-tag special">✨ ${isEn ? 'Vibrating Square' : '震える四角形'}</span>`);
    }
    if (flags.valley) {
      tags.push(`<span class="floor-feature-tag special">🌫️ ${isEn ? 'Valley' : '嘆きの谷'}</span>`);
    }
    if (flags.sanctum) {
      tags.push(`<span class="floor-feature-tag special">🌟 ${isEn ? 'Sanctum' : '聖域'}</span>`);
    }

    if (tags.length === 0) {
      return `<div class="floor-features-empty">${isEn ? 'No notable features observed on this floor.' : 'この階層で目立った施設は観測されていません。'}</div>`;
    }

    return tags.join('');
  }

  _bindEvents() {
    // 閉じるボタン
    const btnClose = this.elModal.querySelector('#ft-btn-close');
    const btnCancel = this.elModal.querySelector('#ft-btn-cancel');
    if (btnClose) btnClose.addEventListener('click', () => this.close());
    if (btnCancel) btnCancel.addEventListener('click', () => this.close());

    // 階層選択切り替え
    const floorSelect = this.elModal.querySelector('#ft-floor-select');
    if (floorSelect) {
      if (!floorSelect.value && this.selectedFloorKey) {
        floorSelect.value = this.selectedFloorKey;
      }
      floorSelect.addEventListener('change', (e) => {
        this.selectedFloorKey = e.target.value;
        this._syncDraftFromSelectedFloor();
        this.render();
      });
    }

    // クイックタグクリック (現在地ピン打ち)
    const tagButtons = this.elModal.querySelectorAll('.quick-tag-btn');
    tagButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const typeId = parseInt(btn.getAttribute('data-slot-id'), 10);
        const current = this._getCurrentPlayerFloor();
        
        // 既存の同一座標・同一タイプの重複を防ぐ
        const exists = this.draftMarkers.some(m => m.type === typeId && m.x === current.playerX && m.y === current.playerY);
        if (!exists) {
          this.draftMarkers.push({
            type: typeId,
            x: current.playerX,
            y: current.playerY
          });
          this.render();
        }
      });
    });

    // カスタムタグ作成・編集エディタを開く
    const btnOpenEditor = this.elModal.querySelector('#ft-btn-open-custom-editor');
    if (btnOpenEditor) {
      btnOpenEditor.addEventListener('click', () => {
        const customSlots = this.floorMarkerService.getAllSlots().slice(6);
        const firstUnconfigured = customSlots.find(s => !s.isConfigured);
        this.editingSlotId = firstUnconfigured ? firstUnconfigured.id : 6;
        this.isCustomEditorOpen = true;
        this.render();
      });
    }

    // 各カスタムタグの個別編集ボタン (鉛筆アイコン)
    const editTagButtons = this.elModal.querySelectorAll('[data-edit-slot-id]');
    editTagButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        const slotId = parseInt(btn.getAttribute('data-edit-slot-id'), 10);
        if (!isNaN(slotId)) {
          this.editingSlotId = slotId;
          this.isCustomEditorOpen = true;
          this.render();
        }
      });
    });

    // エディタ内: スロット選択変更
    const editorSlotSelect = this.elModal.querySelector('#ft-editor-slot-select');
    if (editorSlotSelect) {
      if (!editorSlotSelect.value) {
        editorSlotSelect.value = String(this.editingSlotId);
      }
      editorSlotSelect.addEventListener('change', (e) => {
        const slotId = parseInt(e.target.value, 10);
        if (!isNaN(slotId)) {
          this.editingSlotId = slotId;
          this.render();
        }
      });
    }

    // エディタ内: 絵文字パレット選択
    const emojiButtons = this.elModal.querySelectorAll('.ft-palette-emoji-btn');
    emojiButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        const iconInput = this.elModal.querySelector('#ft-editor-icon-input');
        if (iconInput && emoji) {
          iconInput.value = emoji;
        }
      });
    });

    // エディタ内: 保存ボタン
    const btnEditorSave = this.elModal.querySelector('#ft-btn-editor-save');
    if (btnEditorSave) {
      btnEditorSave.addEventListener('click', () => {
        const icon = this.elModal.querySelector('#ft-editor-icon-input')?.value?.trim() || '📍';
        const labelJa = this.elModal.querySelector('#ft-editor-label-ja')?.value?.trim() || `カスタム #${this.editingSlotId}`;
        const labelEn = this.elModal.querySelector('#ft-editor-label-en')?.value?.trim() || `Custom #${this.editingSlotId}`;

        this.floorMarkerService.saveCustomSlot(this.editingSlotId, { icon, labelJa, labelEn });
        this.isCustomEditorOpen = false;
        this.render();

        const core = this.getCore?.();
        if (core && typeof core.emit === 'function') {
          core.emit('dungeonOverviewUpdated', core.getDungeonOverview?.() || []);
        }
      });
    }

    // エディタ内: 削除・初期化ボタン
    const btnEditorDelete = this.elModal.querySelector('#ft-btn-editor-delete');
    if (btnEditorDelete) {
      btnEditorDelete.addEventListener('click', () => {
        this.floorMarkerService.deleteCustomSlot(this.editingSlotId);
        this.isCustomEditorOpen = false;
        this.render();

        const core = this.getCore?.();
        if (core && typeof core.emit === 'function') {
          core.emit('dungeonOverviewUpdated', core.getDungeonOverview?.() || []);
        }
      });
    }

    // エディタ内: キャンセル / 閉じるボタン
    const btnEditorCancel = this.elModal.querySelector('#ft-btn-editor-cancel');
    const btnEditorClose = this.elModal.querySelector('#ft-btn-editor-close');
    if (btnEditorCancel) {
      btnEditorCancel.addEventListener('click', () => {
        this.isCustomEditorOpen = false;
        this.render();
      });
    }
    if (btnEditorClose) {
      btnEditorClose.addEventListener('click', () => {
        this.isCustomEditorOpen = false;
        this.render();
      });
    }

    // マーカー削除ボタン
    const deleteButtons = this.elModal.querySelectorAll('.marker-delete-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-marker-index'), 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.draftMarkers.length) {
          this.draftMarkers.splice(idx, 1);
          this.render();
        }
      });
    });

    // 通常メモ入力リアルタイム更新
    const memoInput = this.elModal.querySelector('#ft-memo-input');
    if (memoInput) {
      memoInput.addEventListener('input', (e) => {
        this.draftMemo = e.target.value;
        const preview = this.floorMarkerService.formatAnnotation(this.draftMemo, this.draftMarkers);
        const previewBar = this.elModal.querySelector('.memo-preview-bar');
        const saveBtn = this.elModal.querySelector('#ft-btn-save');
        if (previewBar) {
          previewBar.innerHTML = `
            <span>${this.currentLanguage === 'en' ? 'C-Core Preview:' : 'Cコア保存形式:'} <code>${preview || '(empty)'}</code></span>
            <span>${preview.length} / 64 bytes</span>
          `;
          if (preview.length > 64) {
            previewBar.classList.add('overflow');
            if (saveBtn) saveBtn.disabled = true;
          } else {
            previewBar.classList.remove('overflow');
            if (saveBtn) saveBtn.disabled = false;
          }
        }
      });

      // Enter キーで保存
      memoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.saveAnnotation();
        }
      });
    }

    // 保存ボタン
    const btnSave = this.elModal.querySelector('#ft-btn-save');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveAnnotation());
    }
  }

  /**
   * 現在階層の #annotate 注釈を WebUICore / IRC 経由で安全に書き込み
   */
  async saveAnnotation() {
    const currentFloor = this._getCurrentPlayerFloor();
    if (this.selectedFloorKey !== currentFloor.floorKey) {
      return;
    }

    const annotation = this.floorMarkerService.formatAnnotation(this.draftMemo, this.draftMarkers);
    if (annotation.length > 64) return;

    this.isSaving = true;
    this.render();

    try {
      const core = this.getCore();
      if (core && typeof core.annotateFloor === 'function') {
        await core.annotateFloor(annotation);
      } else if (core && core.interactiveController && typeof core.interactiveController.executeSequence === 'function') {
        const sequence = ['#', 'a', 'n', 'n', 'o', 't', 'a', 't', 'e', '\r', ...annotation.split(''), '\r'];
        await core.interactiveController.executeSequence(sequence, {
            isSilentSync: true,
            suppressPrompts: true
        });
        if (typeof core.syncDungeonOverviewOnDemand === 'function') {
            await core.syncDungeonOverviewOnDemand();
        }
      }
    } catch (e) {
      console.error('[FloorTrackerModal] Failed to save annotation:', e);
    } finally {
      this.isSaving = false;
      this._syncDraftFromSelectedFloor();
      this.render();
    }
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
