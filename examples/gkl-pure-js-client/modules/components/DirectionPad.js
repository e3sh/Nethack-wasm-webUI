/**
 * DirectionPad - 8方向 D-Pad 描画 & 方向フィルター & 推奨アクション一覧 (ContextActions) マネージャー
 */
export class DirectionPad {
  constructor({
    elGklDirectionPad,
    elGklFilterLabel,
    elBtnDirReset,
    elGklActionList,
    elGklActionCount,
    getCore,
    onDirectionFiltered
  }) {
    this.elGklDirectionPad = elGklDirectionPad;
    this.elGklFilterLabel = elGklFilterLabel;
    this.elBtnDirReset = elBtnDirReset;
    this.elGklActionList = elGklActionList;
    this.elGklActionCount = elGklActionCount;

    this.getCore = getCore || (() => null);
    this.onDirectionFiltered = onDirectionFiltered || (() => {});

    this.currentLanguage = 'ja';
    this.selectedDir = 'NONE';
    this._lastActionHtml = null;

    this.initDirectionPadEvents();
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this._lastActionHtml = null;
  }

  /**
   * 推奨アクションから正規の方向コード (N, NE, E, SE, S, SW, W, NW, SELF) を抽出
   * @param {Object} action - 推奨アクションオブジェクト
   * @returns {string} 方向コード
   */
  extractDirectionCode(action) {
    if (!action) return 'NONE';
    if (action.directionCode) return action.directionCode;
    if (action.dirCode) return String(action.dirCode).toUpperCase().replace(/^DIR_/, '');
    return action.isDirectional === false ? 'SELF' : 'NONE';
  }

  /**
   * 方向フィルターインジケーターのイベント初期設定
   */
  initDirectionPadEvents() {
    if (this.elGklDirectionPad) {
      let longPressTimer = null;
      let startPos = null;
      let isLongPressTriggered = false;
      let currentDir = null;
      let lastTapTime = 0;
      let lastTapDir = '';

      const clearLongPress = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        startPos = null;
        currentDir = null;
      };

      this.elGklDirectionPad.addEventListener('pointerdown', (e) => {
        const btn = e.target.closest('.gkl-dir-btn');
        if (!btn) return;
        clearLongPress();
        isLongPressTriggered = false;
        currentDir = btn.dataset.dir;
        startPos = { x: e.clientX, y: e.clientY };

        longPressTimer = setTimeout(() => {
          isLongPressTriggered = true;
          const core = this.getCore();
          if (core && typeof core.getDefaultAction === 'function') {
            const defaultAct = core.getDefaultAction(currentDir, { language: this.currentLanguage });
            if (defaultAct) {
              if (defaultAct.actionRecipe && typeof core.executeSequence === 'function') {
                core.executeSequence(defaultAct.actionRecipe);
              } else if (defaultAct.keySequence && typeof core.executeSequence === 'function') {
                core.executeSequence(defaultAct.keySequence);
              } else if (typeof core.executeAction === 'function') {
                core.executeAction(defaultAct);
              }
            }
          }
        }, 450);
      });

      this.elGklDirectionPad.addEventListener('pointermove', (e) => {
        if (startPos) {
          const dx = Math.abs(e.clientX - startPos.x);
          const dy = Math.abs(e.clientY - startPos.y);
          if (dx > 10 || dy > 10) {
            clearLongPress();
          }
        }
      });

      this.elGklDirectionPad.addEventListener('pointerup', (e) => {
        const btn = e.target.closest('.gkl-dir-btn');
        const dir = btn ? btn.dataset.dir : null;
        const triggered = isLongPressTriggered;
        clearLongPress();

        if (triggered || !dir) return;

        const now = Date.now();
        if (now - lastTapTime < 300 && lastTapDir === dir) {
          // 🏃 ダブルタップ成立: ダッシュ移動（走り）を即時実行
          lastTapTime = 0;
          lastTapDir = '';
          const core = this.getCore();
          if (core && typeof core.getDashAction === 'function') {
            const dashAct = core.getDashAction(dir, { language: this.currentLanguage });
            if (dashAct) {
              if (dashAct.actionRecipe && typeof core.executeSequence === 'function') {
                core.executeSequence(dashAct.actionRecipe);
              } else if (dashAct.keySequence && typeof core.executeSequence === 'function') {
                core.executeSequence(dashAct.keySequence);
              } else if (typeof core.executeAction === 'function') {
                core.executeAction(dashAct);
              }
              return;
            }
          }
        }

        lastTapTime = now;
        lastTapDir = dir;

        // 通常クリック時: フィルター切り替え（同一方向再クリックで NONE に戻る）
        this.selectedDir = (this.selectedDir === dir) ? 'NONE' : dir;
        this._lastActionHtml = null;
        this.onDirectionFiltered(this.selectedDir);
      });

      this.elGklDirectionPad.addEventListener('pointercancel', clearLongPress);
      this.elGklDirectionPad.addEventListener('pointerleave', clearLongPress);
    }

    if (this.elBtnDirReset) {
      this.elBtnDirReset.addEventListener('click', () => {
        // NONE のときは全表示 (ALL) へ、選択中または ALL のときは非表示 (NONE) へトグル
        this.selectedDir = (this.selectedDir === 'NONE') ? 'ALL' : 'NONE';
        this._lastActionHtml = null;
        this.onDirectionFiltered(this.selectedDir);
      });
    }
  }

  renderDirectionPad(dirCounts) {
    if (!this.elGklDirectionPad) return;
    const isEn = this.currentLanguage === 'en';

    const dirNameMapEn = {
      'NONE': 'None (Select Dir)',
      'ALL': 'All',
      'N': 'N', 'NE': 'NE', 'E': 'E', 'SE': 'SE',
      'S': 'S', 'SW': 'SW', 'W': 'W', 'NW': 'NW',
      'SELF': 'Self'
    };
    const dirNameMapJa = {
      'NONE': '未選択 (方向を選択)',
      'ALL': '全て',
      'N': '北 (N)', 'NE': '北東 (NE)', 'E': '東 (E)', 'SE': '南東 (SE)',
      'S': '南 (S)', 'SW': '南西 (SW)', 'W': '西 (W)', 'NW': '北西 (NW)',
      'SELF': '足元 (SELF)'
    };
    const dirNameMap = isEn ? dirNameMapEn : dirNameMapJa;

    const hint = isEn
      ? ' (Double-tap: Dash / Long press: 1-step)'
      : ' (ダブルタップ: ダッシュ / 長押し: 1歩移動・待機)';
    const dirTitleMapEn = {
      'NW': 'Northwest (7 / y / ↖)' + hint,
      'N': 'North (8 / k / ↑)' + hint,
      'NE': 'Northeast (9 / u / ↗)' + hint,
      'W': 'West (4 / h / ←)' + hint,
      'SELF': 'Self / Feet (5 / . / ·)' + hint,
      'E': 'East (6 / l / →)' + hint,
      'SW': 'Southwest (1 / b / ↙)' + hint,
      'S': 'South (2 / j / ↓)' + hint,
      'SE': 'Southeast (3 / n / ↘)' + hint
    };
    const dirTitleMapJa = {
      'NW': '北西 (7 / y / ↖)' + hint,
      'N': '北 (8 / k / ↑)' + hint,
      'NE': '北東 (9 / u / ↗)' + hint,
      'W': '西 (4 / h / ←)' + hint,
      'SELF': '足元 (5 / . / ・)' + hint,
      'E': '東 (6 / l / →)' + hint,
      'SW': '南西 (1 / b / ↙)' + hint,
      'S': '南 (2 / j / ↓)' + hint,
      'SE': '南東 (3 / n / ↘)' + hint
    };
    const dirTitleMap = isEn ? dirTitleMapEn : dirTitleMapJa;

    // リセットボタンの状態
    if (this.elBtnDirReset) {
      const isNone = (this.selectedDir === 'NONE');
      this.elBtnDirReset.classList.toggle('active', this.selectedDir === 'ALL');
      if (isNone) {
        this.elBtnDirReset.textContent = isEn ? 'Show All' : '全表示';
        this.elBtnDirReset.title = isEn ? 'Show all recommended actions' : 'すべてのアクションを表示';
      } else {
        this.elBtnDirReset.textContent = isEn ? 'Clear' : 'クリア';
        this.elBtnDirReset.title = isEn ? 'Hide action buttons' : 'アクションボタンを非表示に戻す';
      }
    }

    // ラベル表示
    if (this.elGklFilterLabel) {
      this.elGklFilterLabel.textContent = isEn
        ? `Filter: ${dirNameMap[this.selectedDir] || this.selectedDir}`
        : `表示: ${dirNameMap[this.selectedDir] || this.selectedDir}`;
    }

    // 各方向ボタンの表示更新
    const buttons = this.elGklDirectionPad.querySelectorAll('.gkl-dir-btn');
    buttons.forEach(btn => {
      const dir = btn.dataset.dir;
      const count = dirCounts.get(dir) || 0;
      const badge = btn.querySelector('.gkl-dir-badge');

      if (dirTitleMap[dir]) {
        btn.title = dirTitleMap[dir];
      }

      if (dir === 'SELF') {
        const textNode = btn.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          textNode.textContent = isEn ? 'Self' : '足元';
        }
      }
      if (badge) {
        badge.textContent = count > 0 ? String(count) : '';
      }

      // アクションの有無によるハイライト
      btn.classList.toggle('has-action', count > 0);
      // アクティブ選択中のハイライト
      btn.classList.toggle('active', this.selectedDir === dir);
    });
  }

  renderGklActions(actions) {
    if (!this.elGklActionList) return;
    const isEn = this.currentLanguage === 'en';
    const core = this.getCore();

    // 1. 各方向のアクション件数を算出
    const dirCounts = new Map();
    actions.forEach(action => {
      const dirCode = this.extractDirectionCode(action);
      dirCounts.set(dirCode, (dirCounts.get(dirCode) || 0) + 1);
    });

    // 2. 方向フィルターインジケーター（「囲」キーパッド）の表示更新
    this.renderDirectionPad(dirCounts);

    // 3. 選択中フィルターに応じてアクションを絞り込み
    let displayedActions = [];
    if (this.selectedDir === 'ALL') {
      displayedActions = actions;
    } else if (this.selectedDir !== 'NONE') {
      const filteredActions = actions.filter(action => this.extractDirectionCode(action) === this.selectedDir);
      displayedActions = filteredActions;
      // 方向選択時に対象アクションが 0件 または 1件 の場合、デフォルト推奨アクション（待機 または 移動/押す）を追加
      if (filteredActions.length <= 1 && core && typeof core.getDefaultAction === 'function') {
        const defaultAct = core.getDefaultAction(this.selectedDir, { language: this.currentLanguage });
        if (defaultAct && !filteredActions.some(a => a.id === defaultAct.id)) {
          displayedActions = [...filteredActions, defaultAct];
        }
      }
    }

    // 件数バッジの表示 (例: 未選択時は総数、絞り込み時は 3/10、全体時は 10)
    if (this.elGklActionCount) {
      if (this.selectedDir === 'NONE' || this.selectedDir === 'ALL') {
        this.elGklActionCount.textContent = `${actions.length}`;
      } else {
        this.elGklActionCount.textContent = `${displayedActions.length}/${actions.length}`;
      }
    }

    // 4. 前回のHTMLと比較し変化が無ければ書き換えない (軽量化)
    const actionKeyStr = `${this.currentLanguage}_${this.selectedDir}_${displayedActions.map(a => `${a.id}:${isEn ? (a.labelEn || a.label) : (a.labelJa || a.label)}`).join('|')}`;
    if (this._lastActionHtml !== actionKeyStr) {
      this._lastActionHtml = actionKeyStr;

      let newHtml = '';
      if (this.selectedDir === 'NONE') {
        newHtml = `<div class="gkl-empty-hint gkl-hint-unselected">${isEn ? 'Select a direction on the pad above to view actions' : '上のキーパッドで方向や足元を選ぶとアクションが表示されます'}</div>`;
      } else if (displayedActions.length === 0) {
        newHtml = `<div class="gkl-empty-hint">${isEn ? 'No recommended actions in this direction' : 'この方向の推奨アクションはありません'}</div>`;
      } else {
        newHtml = displayedActions.map(action => {
          const labelText = isEn ? (action.labelEn || action.label) : (action.labelJa || action.label);
          return `
            <button class="gkl-action-btn ${action.risk === 'danger' ? 'danger' : ''}" data-act-id="${action.id}">
              <span>${labelText}</span>
              <span class="gkl-key-badge">${action.charStr || action.key || '?'}</span>
            </button>
          `;
        }).join('');
      }

      this.elGklActionList.innerHTML = newHtml;

      // ボタンイベント登録
      displayedActions.forEach(action => {
        const btn = this.elGklActionList.querySelector(`[data-act-id="${action.id}"]`);

        if (btn) {
          btn.onclick = () => {
            const labelText = isEn ? (action.labelEn || action.label) : (action.labelJa || action.label);
            console.log(`[DirectionPad] 🖱️ Action button clicked: '${labelText}' (id: ${action.id})`, action);
            if (action.risk === 'danger') {
              const confirmMsg = isEn ? `[⚠️ Dangerous Action]\nExecute "${labelText}"?` : `【⚠️ 危険な行動】\n"${labelText}" を実行しますか？`;
              if (!confirm(confirmMsg)) return;
            }
            // アクション実行時にフィルターを 'NONE' (未選択) に自動リセット
            this.selectedDir = 'NONE';
            this._lastActionHtml = null;
            if (core && typeof core.executeAction === 'function') {
              const res = core.executeAction(action);
              if (res && typeof res.catch === 'function') {
                res.catch(err => console.error('[DirectionPad] Error executing action:', err));
              }
            } else {
              console.warn('[DirectionPad] core or core.executeAction is not available!', core);
            }
          };
        }
      });
    }
  }
}
