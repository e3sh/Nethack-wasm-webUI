/**
 * FloatingContextActions.js
 * 
 * マスクリック・タップ時に、対象マスの頭上に吹き出しポップアップで出現する
 * スマート ContextActions ＆ ナレッジ一体型 UI コンポーネント。
 *
 * 【アーキテクチャ方針】
 * クライアント側で独自のアクションを生成・ハードコードせず、
 * GKL (Game Knowledge Layer: ContextActionEngine) が状況評価・ルール判定した
 * コンテキストアクションを受信・抽出し、そのまま提示します。
 */

/**
 * 相対オフセット (dx, dy) から標準方向コードを算出
 * @param {number} dx
 * @param {number} dy
 * @returns {string|null} 'SELF' | 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | null
 */
export function getDirCodeFromOffset(dx, dy) {
  if (dx === 0 && dy === 0) return 'SELF';
  if (dx === 0 && dy === -1) return 'N';
  if (dx === 1 && dy === -1) return 'NE';
  if (dx === 1 && dy === 0) return 'E';
  if (dx === 1 && dy === 1) return 'SE';
  if (dx === 0 && dy === 1) return 'S';
  if (dx === -1 && dy === 1) return 'SW';
  if (dx === -1 && dy === 0) return 'W';
  if (dx === -1 && dy === -1) return 'NW';
  return null;
}

export class FloatingContextActions {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - 配置親要素 (.game-viewport など)
   * @param {Function} options.getCore - WebUICore 取得関数
   * @param {Function} [options.onNavigateKnowledge] - ナレッジ詳細遷移コールバック
   * @param {string} [options.language='ja'] - 言語 ('ja' | 'en')
   */
  constructor({
    container,
    elPopup,
    getCore,
    onNavigateKnowledge,
    onInspectDetail,
    language = 'ja'
  }) {
    this.container = container;
    this.getCore = getCore || (() => null);
    this.onNavigateKnowledge = onNavigateKnowledge || (() => {});
    this.onInspectDetail = onInspectDetail || null;
    this.currentLanguage = language;

    this.currentTarget = null;
    this.isVisible = false;
    this.elPopup = elPopup || null;

    this._boundGlobalClick = (e) => this._handleGlobalClick(e);
    this._boundKeyDown = (e) => this._handleKeyDown(e);

    if (!this.elPopup) {
      this.initDOM();
    }
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    if (this.isVisible && this.currentTarget) {
      this.render();
    }
  }

  /**
   * ポップアップ用 DOM 要素の生成および初期バインド
   */
  initDOM() {
    // 親の overflow: hidden (例: .game-viewport 288px) にクリップされないよう、
    // position: fixed ポップアップは document.body 直下に配置
    const doc = (typeof document !== 'undefined' ? document : null) || this.container?.ownerDocument;
    if (!doc) return;

    const parent = doc.body || this.container;
    if (!parent) return;

    let el = parent.querySelector ? parent.querySelector('.gkl-floating-actions') : null;
    if (!el) {
      if (typeof doc.createElement === 'function') {
        el = doc.createElement('div');
        if (el.classList && typeof el.classList.add === 'function') {
          el.classList.add('gkl-floating-actions', 'hidden');
        } else {
          el.className = 'gkl-floating-actions hidden';
        }
        parent.appendChild(el);
      }
    }
    this.elPopup = el;

    if (this.elPopup && typeof this.elPopup.addEventListener === 'function') {
      this.elPopup.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('click', this._boundGlobalClick);
      document.addEventListener('keydown', this._boundKeyDown);
    }
  }

  /**
   * GKL から受信した推奨アクション一覧から、クリック対象セルに合致するアクションを抽出
   * 該当方向のアクションが不足している場合は、GKL の core.getDefaultAction(dirCode) をフォールバックとして利用
   */
  resolveApplicableActions({ targetGx, targetGy, playerX, playerY, cardData, allActions = [] }) {
    const dx = targetGx - playerX;
    const dy = targetGy - playerY;
    const isSelf = (dx === 0 && dy === 0);
    const isAdjacent = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && !isSelf;
    const dirCode = getDirCodeFromOffset(dx, dy);

    const core = this.getCore();

    // 1. 自キャラ足元 (isSelf / 'SELF')
    if (isSelf) {
      const feetActions = allActions.filter(a => {
        const d = a.dirCode || a.directionCode;
        return d === 'SELF' || a.target === 'feet' || a.category === 'SURVIVAL';
      });

      // GKL のデフォルト待機アクションを取得して統合
      let defaultAct = null;
      if (core && typeof core.getDefaultAction === 'function') {
        defaultAct = core.getDefaultAction('SELF', { language: this.currentLanguage });
      }

      if (feetActions.length > 0) {
        if (defaultAct && !feetActions.some(a => a.id === defaultAct.id)) {
          return [...feetActions, defaultAct];
        }
        return feetActions;
      }

      return defaultAct ? [defaultAct] : [];
    }

    // 2. 隣接マス (isAdjacent && dirCode)
    if (isAdjacent && dirCode) {
      const adjActions = allActions.filter(a => {
        const d = a.dirCode || a.directionCode;
        return d === dirCode;
      });

      // GKL の該当方向デフォルトアクション（移動 / 押す）を取得
      let defaultAct = null;
      if (core && typeof core.getDefaultAction === 'function') {
        defaultAct = core.getDefaultAction(dirCode, { language: this.currentLanguage });
      }

      if (adjActions.length > 0) {
        // GKL 推奨アクションが存在する場合でも、移動アクションがなければ末尾に補完
        if (defaultAct && !adjActions.some(a => a.id === defaultAct.id)) {
          return [...adjActions, defaultAct];
        }
        return adjActions;
      }

      // GKL 推奨アクションが特にない場合（通常の床など）はデフォルト移動アクションを提示
      return defaultAct ? [defaultAct] : [];
    }

    // 3. 遠隔マス (!isAdjacent && !isSelf)
    if (!isAdjacent && !isSelf) {
      const rangedActions = allActions.filter(a => {
        return a.isRanged || a.target === 'ranged' || a.id?.startsWith('ACTION_FIRE_');
      });
      return rangedActions;
    }

    return [];
  }

  /**
   * フローティングメニューを表示
   */
  show({
    gx,
    gy,
    playerX,
    playerY,
    screenX,
    screenY,
    clientX,
    clientY,
    cardData,
    actions = [],
    canTravel = true
  }) {
    const applicableActions = this.resolveApplicableActions({
      targetGx: gx,
      targetGy: gy,
      playerX,
      playerY,
      cardData,
      allActions: actions
    });

    this.currentTarget = {
      gx,
      gy,
      playerX,
      playerY,
      screenX,
      screenY,
      clientX,
      clientY,
      cardData,
      actions: applicableActions,
      canTravel: Boolean(canTravel)
    };

    this.isVisible = true;
    this._justShown = true;
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        this._justShown = false;
      }, 150);
    }
    this.render();
  }

  /**
   * ポップアップを非表示
   */
  hide() {
    this.isVisible = false;
    this.currentTarget = null;
    if (this.elPopup) {
      this.elPopup.classList.add('hidden');
      this.elPopup.innerHTML = '';
    }
  }

  /**
   * プレイヤー移動時に自動非表示
   */
  onPlayerMoved(px, py) {
    if (this.isVisible) {
      this.hide();
    }
  }

  /**
   * ナレッジ要約 HTML の生成（GKL の inspectCellOnDemand / StructuredKnowledge 結果をそのまま表示）
   */
  _buildKnowledgeSummaryHtml(cardData, isSelf) {
    const isEn = this.currentLanguage === 'en';
    if (isSelf) {
      return `
        <div class="gkl-floating-knowledge">
          <div class="kn-row">
            <span class="kn-pill kn-self">👤 ${isEn ? 'Your Position' : '自キャラ足元'}</span>
          </div>
          <div class="kn-desc">${cardData?.name ? (isEn ? `On the floor: ${cardData.name}` : `足元: ${cardData.name}`) : (isEn ? 'Standing on floor.' : '床の上に立っています。')}</div>
        </div>
      `;
    }

    if (!cardData) return '';

    const isMonster = Boolean(cardData.category === 'MONSTER' || cardData.hasMonster);
    if (isMonster) {
      const stats = cardData.stats || {};
      const hd = stats.hd ?? (cardData.level ?? '?');
      const ac = stats.ac ?? '?';
      const spd = stats.speed ?? '?';
      const danger = cardData.dangerLevel || (cardData.isHostile ? 'MEDIUM' : 'LOW');
      const dangerClass = `kn-danger-${danger}`;

      let corpseInfo = '';
      if (cardData.corpseSafety) {
        const cs = cardData.corpseSafety;
        if (cs.petrifying) {
          corpseInfo = `<span class="kn-pill kn-lethal">⚠️ ${isEn ? 'Petrifying!' : '石化危険!'}</span>`;
        } else if (cs.poisonous) {
          corpseInfo = `<span class="kn-pill kn-poison">☠️ ${isEn ? 'Poisonous' : '毒あり'}</span>`;
        } else if (cs.isSafe) {
          corpseInfo = `<span class="kn-pill kn-safe">🍖 ${isEn ? 'Safe to eat' : '食用安全'}</span>`;
        }
      }

      const note = cardData.tacticalSummary || cardData.effectSummary || cardData.lore || '';

      return `
        <div class="gkl-floating-knowledge">
          <div class="kn-row">
            <span class="kn-pill">Lv: ${hd}</span>
            <span class="kn-pill">AC: ${ac}</span>
            <span class="kn-pill">Spd: ${spd}</span>
            <span class="kn-pill ${dangerClass}">${danger}</span>
            ${corpseInfo}
          </div>
          ${note ? `<div class="kn-desc" title="${note}">${note}</div>` : ''}
        </div>
      `;
    }

    // アイテム
    if (cardData.category === 'OBJECT' || cardData.hasItems) {
      const buc = cardData.bucStatus ? `<span class="kn-pill kn-buc-${cardData.bucStatus.toLowerCase()}">${cardData.bucStatus}</span>` : '';
      const desc = cardData.effectSummary || cardData.description || '';
      return `
        <div class="gkl-floating-knowledge">
          <div class="kn-row">
            <span class="kn-pill kn-item">📦 ${cardData.category || 'ITEM'}</span>
            ${buc}
          </div>
          ${desc ? `<div class="kn-desc" title="${desc}">${desc}</div>` : ''}
        </div>
      `;
    }

    // 扉・箱・ギミック
    const isDoor = Boolean(cardData.category === 'DOOR' || cardData.isDoor || cardData.id?.includes('door'));
    const isChest = Boolean(cardData.category === 'CONTAINER' || cardData.category === 'CHEST' || cardData.isChest);
    const isAltar = Boolean(cardData.category === 'ALTAR' || cardData.isAltar);
    const isFountain = Boolean(cardData.category === 'FOUNTAIN' || cardData.isFountain);
    const isSink = Boolean(cardData.category === 'SINK' || cardData.isSink);
    const isThrone = Boolean(cardData.category === 'THRONE' || cardData.isThrone);
    const isGrave = Boolean(cardData.category === 'GRAVE' || cardData.isGrave);
    const isStairs = Boolean(cardData.category === 'STAIRS' || cardData.isStairs || cardData.id?.includes('stairs'));
    const isTrap = Boolean(cardData.category === 'TRAP' || cardData.isTrap);

    if (isDoor || isChest || isAltar || isFountain || isSink || isThrone || isGrave || isStairs || isTrap) {
      let gName = isEn ? 'Feature' : '仕掛け/地形';
      if (isDoor) gName = isEn ? 'Door' : 'ドア';
      else if (isChest) gName = isEn ? 'Container' : 'チェスト/箱';
      else if (isAltar) gName = isEn ? 'Altar' : '祭壇';
      else if (isFountain) gName = isEn ? 'Fountain' : '泉';
      else if (isSink) gName = isEn ? 'Sink' : '流し台';
      else if (isThrone) gName = isEn ? 'Throne' : '玉座';
      else if (isGrave) gName = isEn ? 'Grave' : '墓';
      else if (isTrap) gName = isEn ? 'Trap' : '罠';
      else if (isStairs) gName = isEn ? 'Stairs' : '階段';

      return `
        <div class="gkl-floating-knowledge">
          <div class="kn-row">
            <span class="kn-pill kn-feature">🏛️ ${gName}</span>
          </div>
          <div class="kn-desc">${cardData.name || (isEn ? 'Interactable dungeon feature' : '操作可能なダンジョンの設備')}</div>
        </div>
      `;
    }

    return '';
  }

  /**
   * 描画と座標クランプ計算
   */
  render() {
    if (!this.elPopup || !this.currentTarget) return;

    const { gx, gy, playerX, playerY, cardData, actions, canTravel } = this.currentTarget;
    const isEn = this.currentLanguage === 'en';
    const isSelf = (gx === playerX && gy === playerY) || cardData?.category === 'PLAYER' || cardData?.isPlayer;

    // 1. ヘッダー情報の生成
    let headerIcon = '📍';
    let headerTitle = isEn ? `Tile (${gx}, ${gy})` : `マス (${gx}, ${gy})`;

    if (isSelf) {
      headerIcon = '👣';
      headerTitle = isEn ? 'Your Feet' : '自キャラ足元';
      if (cardData?.name && !cardData?.isPlayer) {
        headerTitle += ` : ${cardData.name}`;
      }
    } else if (cardData) {
      const isDoor = Boolean(cardData.category === 'DOOR' || cardData.isDoor || cardData.id?.includes('door'));
      const isChest = Boolean(cardData.category === 'CONTAINER' || cardData.category === 'CHEST' || cardData.isChest);
      const isAltar = Boolean(cardData.category === 'ALTAR' || cardData.isAltar);
      const isFountain = Boolean(cardData.category === 'FOUNTAIN' || cardData.isFountain);
      const isSink = Boolean(cardData.category === 'SINK' || cardData.isSink);
      const isThrone = Boolean(cardData.category === 'THRONE' || cardData.isThrone);
      const isGrave = Boolean(cardData.category === 'GRAVE' || cardData.isGrave);
      const isStairs = Boolean(cardData.category === 'STAIRS' || cardData.isStairs || cardData.id?.includes('stairs'));
      const isTrap = Boolean(cardData.category === 'TRAP' || cardData.isTrap);

      if (cardData.category === 'MONSTER' || cardData.hasMonster) {
        headerIcon = cardData.isHostile ? '👾' : (cardData.isTame ? '🐾' : '👹');
        headerTitle = cardData.name || (isEn ? 'Monster' : 'モンスター');
      } else if (isDoor) {
        headerIcon = '🚪';
        headerTitle = cardData.name || (isEn ? 'Door' : 'ドア');
      } else if (isChest) {
        headerIcon = '🧰';
        headerTitle = cardData.name || (isEn ? 'Container' : 'チェスト/箱');
      } else if (isAltar) {
        headerIcon = '⛩️';
        headerTitle = cardData.name || (isEn ? 'Altar' : '祭壇');
      } else if (isFountain) {
        headerIcon = '⛲';
        headerTitle = cardData.name || (isEn ? 'Fountain' : '泉');
      } else if (isSink) {
        headerIcon = '🚰';
        headerTitle = cardData.name || (isEn ? 'Sink' : '流し台');
      } else if (isThrone) {
        headerIcon = '👑';
        headerTitle = cardData.name || (isEn ? 'Throne' : '玉座');
      } else if (isGrave) {
        headerIcon = '🪦';
        headerTitle = cardData.name || (isEn ? 'Grave' : '墓');
      } else if (isStairs) {
        headerIcon = '🪜';
        headerTitle = cardData.name || (isEn ? 'Stairs' : '階段');
      } else if (isTrap) {
        headerIcon = '⚠️';
        headerTitle = cardData.name || (isEn ? 'Trap' : '罠');
      } else if (cardData.name) {
        headerTitle = cardData.name;
        if (cardData.category === 'OBJECT' || cardData.category === 'ITEM') headerIcon = '📦';
      }
    }

    // 2. ナレッジ要約部
    const knowledgeHtml = this._buildKnowledgeSummaryHtml(cardData, isSelf);

    // 3. アクションボタン群 HTML（GKL 推奨アクションのプロパティをそのまま描画）
    let actionsHtml = '';
    if (actions.length > 0) {
      actionsHtml = actions.map(act => {
        const label = isEn ? (act.labelEn || act.label) : (act.labelJa || act.label);
        const icon = act.icon || (act.id?.startsWith('ACTION_ATTACK') ? '⚔️' : '⚡');
        const keyBadge = act.charStr || act.key || '';
        const isDanger = act.risk === 'danger' || act.category === 'SURVIVAL';
        return `
          <button class="gkl-floating-btn ${isDanger ? 'danger' : ''}" data-action-id="${act.id}">
            <span class="btn-icon">${icon}</span>
            <span class="btn-label">${label}</span>
            ${keyBadge ? `<span class="btn-key">${keyBadge}</span>` : ''}
          </button>
        `;
      }).join('');
    } else {
      actionsHtml = `
        <div class="gkl-floating-empty">
          ${isEn ? 'No immediate context action' : '実行可能なアクションはありません'}
        </div>
      `;
    }

    // 4. サブアクション（詳細モーダル表示ボタン ＆ 離れたマスへの移動ボタン）
    const showTravelBtn = !isSelf && canTravel;
    const showInspectBtn = Boolean(cardData || isSelf);
    let subButtonsHtml = '';
    if (showInspectBtn) {
      subButtonsHtml += `
        <button class="gkl-sub-btn inspect-btn" id="btn-floating-inspect">
          <span>🔍 ${isEn ? 'Inspect' : '詳細'}</span>
        </button>
      `;
    }
    if (showTravelBtn) {
      subButtonsHtml += `
        <button class="gkl-sub-btn travel-btn" id="btn-floating-travel">
          <span>🚶 ${isEn ? 'Move Here' : 'ここへ歩く'}</span>
        </button>
      `;
    }

    const subActionsHtml = (showInspectBtn || showTravelBtn) ? `
      <div class="gkl-floating-sub-actions">
        ${subButtonsHtml}
      </div>
    ` : '';

    // 5. 全体 DOM 組み立て
    this.elPopup.innerHTML = `
      <div class="gkl-floating-header">
        <div class="header-title-box">
          <span class="header-icon">${headerIcon}</span>
          <span class="header-title" title="${headerTitle}">${headerTitle}</span>
        </div>
        <button class="btn-close-floating" id="btn-close-floating" title="閉じる [Esc]">×</button>
      </div>
      ${knowledgeHtml}
      <div class="gkl-floating-list">
        ${actionsHtml}
      </div>
      ${subActionsHtml}
      <div class="gkl-floating-caret"></div>
    `;

    // 6. イベントバインド
    const btnClose = this.elPopup.querySelector('#btn-close-floating');
    if (btnClose) {
      btnClose.onclick = (e) => {
        e.stopPropagation();
        this.hide();
      };
    }

    // 各アクションボタン
    actions.forEach(act => {
      const btn = this.elPopup.querySelector(`[data-action-id="${act.id}"]`);
      if (btn) {
        btn.onclick = (e) => {
          e.stopPropagation();
          this.executeContextAction(act);
        };
      }
    });

    // 詳細ボタン
    const btnInspect = this.elPopup.querySelector('#btn-floating-inspect');
    if (btnInspect) {
      btnInspect.onclick = (e) => {
        e.stopPropagation();
        const targetData = this.currentTarget?.cardData || {
          name: isSelf ? (isEn ? 'Player' : 'プレイヤー') : (isEn ? `Tile (${gx}, ${gy})` : `マス (${gx}, ${gy})`),
          isPlayer: isSelf,
          gx,
          gy
        };
        this.hide();
        if (typeof this.onInspectDetail === 'function') {
          this.onInspectDetail(targetData);
        } else if (typeof this.onNavigateKnowledge === 'function') {
          this.onNavigateKnowledge(targetData);
        }
      };
    }

    // 移動ボタン
    const btnTravel = this.elPopup.querySelector('#btn-floating-travel');
    if (btnTravel) {
      btnTravel.onclick = async (e) => {
        e.stopPropagation();
        this.hide();
        const core = this.getCore();
        if (core?.gkl?.travelTo) {
          await core.gkl.travelTo({ x: gx, y: gy });
        }
      };
    }

    // 7. ポジショニング＆クランプ
    this.positionPopup();

    this.elPopup.classList.remove('hidden');
  }

  /**
   * ポップアップの表示座標を計算して配置 (position: fixed 基準で画面端クランプ)
   */
  positionPopup() {
    if (!this.elPopup) return;

    let posX = 0;
    let posY = 0;

    const { screenX, screenY, clientX, clientY } = this.currentTarget || {};

    if (clientX !== undefined && clientY !== undefined) {
      posX = clientX;
      posY = clientY;
    } else if (this.container && typeof this.container.getBoundingClientRect === 'function') {
      const containerRect = this.container.getBoundingClientRect();
      posX = containerRect.left + (screenX !== undefined ? screenX : containerRect.width / 2);
      posY = containerRect.top + (screenY !== undefined ? screenY : containerRect.height / 2);
    } else {
      posX = (typeof window !== 'undefined') ? window.innerWidth / 2 : 500;
      posY = (typeof window !== 'undefined') ? window.innerHeight / 2 : 400;
    }

    const popW = this.elPopup.offsetWidth || 260;
    const popH = this.elPopup.offsetHeight || 180;
    const winW = (typeof window !== 'undefined') ? window.innerWidth : 1000;
    const winH = (typeof window !== 'undefined') ? window.innerHeight : 800;

    // 利用可能な最大高さを設定
    const maxAvailH = Math.max(140, winH - 24);
    this.elPopup.style.maxHeight = `${maxAvailH}px`;

    // 頭上（上側）に配置: 対象マスの少し上 (-14px)
    let left = posX;
    let top = posY - 14;
    let isFlipped = false;

    // 上にはみ出る場合は下側に反転
    if (top - popH < 12) {
      top = posY + 36;
      isFlipped = true;
    }

    // 上下に反転しても下にはみ出る場合の安全上下クランプ
    if (isFlipped && top + popH > winH - 12) {
      top = Math.max(12, winH - popH - 12);
    } else if (!isFlipped && top < popH + 12) {
      top = Math.max(popH + 12, top);
    }

    // 左右のクランプ (はみ出し防止)
    const padding = 12;
    const minLeft = popW / 2 + padding;
    const maxLeft = winW - (popW / 2) - padding;
    left = Math.max(minLeft, Math.min(maxLeft, left));

    this.elPopup.style.left = `${left}px`;
    this.elPopup.style.top = `${top}px`;
    this.elPopup.classList.toggle('flipped', isFlipped);

    // 吹き出し矢印 (Caret) の動的追従
    const caret = this.elPopup.querySelector('.gkl-floating-caret');
    if (caret) {
      const popLeftEdge = left - popW / 2;
      const relativeX = posX - popLeftEdge;
      const clampedCaretX = Math.max(16, Math.min(popW - 16, relativeX));
      caret.style.left = `${clampedCaretX}px`;
    }
  }

  /**
   * GKL 推奨アクションを実行（GKL の core.executeAction に委譲）
   */
  async executeContextAction(action) {
    if (!action) return;

    const isEn = this.currentLanguage === 'en';
    const label = isEn ? (action.labelEn || action.label) : (action.labelJa || action.label);

    if (action.risk === 'danger') {
      const confirmMsg = isEn 
        ? `[⚠️ Dangerous Action]\nExecute "${label}"?`
        : `【⚠️ 危険な行動】\n"${label}" を実行しますか？`;
      if (typeof window !== 'undefined' && window.confirm && !window.confirm(confirmMsg)) {
        return;
      }
    }

    this.hide();

    const core = this.getCore();
    if (!core) {
      console.warn('[FloatingContextActions] core is not available');
      return;
    }

    try {
      if (typeof core.executeAction === 'function') {
        await core.executeAction(action);
      } else if (action.actionRecipe && typeof core.executeSequence === 'function') {
        await core.executeSequence(action.actionRecipe);
      } else if (action.keySequence && typeof core.executeSequence === 'function') {
        await core.executeSequence(action.keySequence);
      } else if (action.key && typeof core.sendActionKey === 'function') {
        core.sendActionKey(action.key);
      } else if (action.key && typeof core.sendInput === 'function') {
        core.sendInput(action.key);
      }
    } catch (err) {
      console.error('[FloatingContextActions] Error executing action:', err);
    }
  }

  _handleGlobalClick(e) {
    if (!this.isVisible || this._justShown) return;
    if (this.elPopup && this.elPopup.contains(e.target)) return;
    this.hide();
  }

  _handleKeyDown(e) {
    if (!this.isVisible) return;
    if (e.key === 'Escape') {
      this.hide();
    }
  }

  destroy() {
    this.hide();
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this._boundGlobalClick);
      document.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this.elPopup && this.elPopup.parentElement) {
      this.elPopup.parentElement.removeChild(this.elPopup);
    }
  }
}
