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
    this.selectedDir = 'ALL';
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

    const validDirections = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'SELF']);

    // 1. dirCode を最優先判定
    if (action.dirCode) {
      const c = String(action.dirCode).toUpperCase().replace(/^DIR_/, '');
      if (validDirections.has(c)) return c;
      if (c === 'FEET' || c === 'CURRENT' || c === 'HERE') return 'SELF';
    }

    // 2. direction オブジェクト
    if (action.direction) {
      const code = typeof action.direction === 'object' ? (action.direction.code || action.direction.key) : action.direction;
      if (code) {
        const c = String(code).toUpperCase().replace(/^DIR_/, '');
        if (validDirections.has(c)) return c;
      }
    }

    // 3. directionKey (e.g. DIR_N, DIR_SELF, k, l, j, h, etc.)
    if (action.directionKey) {
      const cleaned = String(action.directionKey).toUpperCase().replace(/^DIR_/, '');
      if (validDirections.has(cleaned)) return cleaned;
      const viKeyMap = {
        'K': 'N', 'L': 'E', 'J': 'S', 'H': 'W',
        'U': 'NE', 'Y': 'NW', 'N': 'SE', 'B': 'SW', '.': 'SELF', '5': 'SELF',
        '8': 'N', '6': 'E', '2': 'S', '4': 'W', '9': 'NE', '7': 'NW', '3': 'SE', '1': 'SW'
      };
      if (viKeyMap[cleaned]) return viKeyMap[cleaned];
    }

    // 4. keySequence (e.g. ['DIR_N'], ['a', 'b', 'DIR_SELF'])
    if (Array.isArray(action.keySequence)) {
      const dirToken = action.keySequence.find(t => typeof t === 'string' && t.startsWith('DIR_'));
      if (dirToken) {
        const c = dirToken.replace(/^DIR_/, '').toUpperCase();
        if (validDirections.has(c)) return c;
      }
    }

    // 5. target === 'feet' or non-directional
    if (action.target === 'feet' || action.isDirectional === false || action.category === 'SURVIVAL') {
      return 'SELF';
    }

    // 6. action.id 末尾からの抽出 (e.g. ACTION_ATTACK_N, ACTION_OPEN_DOOR_W)
    if (action.id) {
      const match = action.id.match(/_([NESW]|NE|NW|SE|SW|SELF|FEET)$/);
      if (match) {
        return match[1] === 'FEET' ? 'SELF' : match[1];
      }
    }

    return 'NONE';
  }

  /**
   * 方向フィルターインジケーターのイベント初期設定
   */
  initDirectionPadEvents() {
    if (this.elGklDirectionPad) {
      this.elGklDirectionPad.addEventListener('click', (e) => {
        const btn = e.target.closest('.gkl-dir-btn');
        if (!btn) return;
        const dir = btn.dataset.dir;
        this.selectedDir = (this.selectedDir === dir) ? 'ALL' : dir;
        this._lastActionHtml = null;
        this.onDirectionFiltered(this.selectedDir);
      });
    }

    if (this.elBtnDirReset) {
      this.elBtnDirReset.addEventListener('click', () => {
        this.selectedDir = 'ALL';
        this._lastActionHtml = null;
        this.onDirectionFiltered(this.selectedDir);
      });
    }
  }

  renderDirectionPad(dirCounts) {
    if (!this.elGklDirectionPad) return;
    const isEn = this.currentLanguage === 'en';

    const dirNameMapEn = {
      'ALL': 'All',
      'N': 'N', 'NE': 'NE', 'E': 'E', 'SE': 'SE',
      'S': 'S', 'SW': 'SW', 'W': 'W', 'NW': 'NW',
      'SELF': 'Self'
    };
    const dirNameMapJa = {
      'ALL': '全て',
      'N': '北 (N)', 'NE': '北東 (NE)', 'E': '東 (E)', 'SE': '南東 (SE)',
      'S': '南 (S)', 'SW': '南西 (SW)', 'W': '西 (W)', 'NW': '北西 (NW)',
      'SELF': '足元 (SELF)'
    };
    const dirNameMap = isEn ? dirNameMapEn : dirNameMapJa;

    const dirTitleMapEn = {
      'NW': 'Northwest (7 / y / ↖)',
      'N': 'North (8 / k / ↑)',
      'NE': 'Northeast (9 / u / ↗)',
      'W': 'West (4 / h / ←)',
      'SELF': 'Self / Feet (5 / . / ·)',
      'E': 'East (6 / l / →)',
      'SW': 'Southwest (1 / b / ↙)',
      'S': 'South (2 / j / ↓)',
      'SE': 'Southeast (3 / n / ↘)'
    };
    const dirTitleMapJa = {
      'NW': '北西 (7 / y / ↖)',
      'N': '北 (8 / k / ↑)',
      'NE': '北東 (9 / u / ↗)',
      'W': '西 (4 / h / ←)',
      'SELF': '足元 (5 / . / ・)',
      'E': '東 (6 / l / →)',
      'SW': '南西 (1 / b / ↙)',
      'S': '南 (2 / j / ↓)',
      'SE': '南東 (3 / n / ↘)'
    };
    const dirTitleMap = isEn ? dirTitleMapEn : dirTitleMapJa;

    // リセットボタンの状態
    if (this.elBtnDirReset) {
      this.elBtnDirReset.classList.toggle('active', this.selectedDir === 'ALL');
      this.elBtnDirReset.textContent = isEn ? 'Show All (ALL)' : '全表示 (ALL)';
      this.elBtnDirReset.title = isEn ? 'Clear Filter (Show All)' : 'フィルター解除 (すべて表示)';
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
    const filteredActions = (this.selectedDir === 'ALL')
      ? actions
      : actions.filter(action => this.extractDirectionCode(action) === this.selectedDir);

    // 件数バッジの表示 (例: 絞り込み時は 3/10、全体時は 10)
    if (this.elGklActionCount) {
      this.elGklActionCount.textContent = (this.selectedDir === 'ALL')
        ? actions.length
        : `${filteredActions.length}/${actions.length}`;
    }

    // 4. 前回のHTMLと比較し変化が無ければ書き換えない (軽量化)
    const actionKeyStr = `${this.currentLanguage}_${this.selectedDir}_${filteredActions.map(a => `${a.id}:${a.label}`).join('|')}`;
    if (this._lastActionHtml !== actionKeyStr) {
      this._lastActionHtml = actionKeyStr;

      const newHtml = filteredActions.length === 0 
        ? `<div class="gkl-empty-hint">${this.selectedDir === 'ALL' ? (isEn ? 'Recommended actions for nearby targets will be shown automatically' : '周辺環境に応じたアクションが自動表示されます') : (isEn ? 'No recommended actions in this direction' : 'この方向の推奨アクションはありません')}</div>`
        : filteredActions.map(action => `
            <button class="gkl-action-btn ${action.risk === 'danger' ? 'danger' : ''}" data-act-id="${action.id}">
              <span>${action.label}</span>
              <span class="gkl-key-badge">${action.charStr || action.key || '?'}</span>
            </button>
          `).join('');

      this.elGklActionList.innerHTML = newHtml;

      // ボタンイベント登録
      filteredActions.forEach(action => {
        const btn = this.elGklActionList.querySelector(`[data-act-id="${action.id}"]`);
        if (btn) {
          btn.onclick = () => {
            if (action.risk === 'danger') {
              const confirmMsg = isEn ? `[⚠️ Dangerous Action]\nExecute "${action.label}"?` : `【⚠️ 危険な行動】\n"${action.label}" を実行しますか？`;
              if (!confirm(confirmMsg)) return;
            }
            // アクション実行時にフィルターを 'ALL' に自動リセット
            this.selectedDir = 'ALL';
            this._lastActionHtml = null;
            if (core && typeof core.executeAction === 'function') {
              core.executeAction(action);
            }
          };
        }
      });
    }
  }
}
