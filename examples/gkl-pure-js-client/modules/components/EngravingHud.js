/**
 * EngravingHud.js - GKL 床文字・考古学的復元 HUD バナー (案A) コントローラー
 *
 * プレイヤーが床の刻み文字を踏んだ／読んだ瞬間に、ステータスバー直下に
 * スッとスライドイン出現し、原型・日本語訳・結界状態・再刻みアクションを提示する。
 */
export class EngravingHud {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.elEngravingHud
   * @param {HTMLElement} options.elEngravingHudIcon
   * @param {HTMLElement} options.elEngravingActual
   * @param {HTMLElement} options.elEngravingPristine
   * @param {HTMLElement} options.elEngravingConfidenceBadge
   * @param {HTMLElement} options.elEngravingTranslation
   * @param {HTMLElement} options.elEngravingSourceBadge
   * @param {HTMLElement} options.elBtnEngraveReapply
   * @param {HTMLElement} options.elBtnEngravingClose
   * @param {Function} options.getCore
   */
  constructor({
    elEngravingHud,
    elEngravingHudIcon,
    elEngravingActual,
    elEngravingArrow,
    elEngravingPristine,
    elEngravingConfidenceBadge,
    elEngravingTranslation,
    elEngravingSourceBadge,
    elBtnEngraveReapply,
    elBtnEngravingClose,
    getCore
  }) {
    this.elEngravingHud = elEngravingHud;
    this.elEngravingHudIcon = elEngravingHudIcon;
    this.elEngravingActual = elEngravingActual;
    this.elEngravingArrow = elEngravingArrow;
    this.elEngravingPristine = elEngravingPristine;
    this.elEngravingConfidenceBadge = elEngravingConfidenceBadge;
    this.elEngravingTranslation = elEngravingTranslation;
    this.elEngravingSourceBadge = elEngravingSourceBadge;
    this.elBtnEngraveReapply = elBtnEngraveReapply;
    this.elBtnEngravingClose = elBtnEngravingClose;

    this.getCore = getCore || (() => null);

    this.autoHideTimer = null;
    this.lastShownPosition = null;

    this.initEvents();
  }

  initEvents() {
    // 閉じるボタン
    if (this.elBtnEngravingClose) {
      this.elBtnEngravingClose.onclick = (e) => {
        e.stopPropagation();
        this.hide();
      };
    }

    // 再刻みボタン [E]
    if (this.elBtnEngraveReapply) {
      this.elBtnEngraveReapply.onclick = async (e) => {
        e.stopPropagation();
        const core = this.getCore();
        if (!core) return;

        this.hide();

        // ActionRecipeFactory が利用可能であれば Elbereth レシピを優先実行 (上書き確認・ツール選択を自動処理)
        const recipeFactory = core.ActionRecipeFactory || (typeof window !== 'undefined' && window.ActionRecipeFactory);
        const actionSequence = (recipeFactory && typeof recipeFactory.createEngraveElberethRecipe === 'function')
          ? recipeFactory.createEngraveElberethRecipe('-')
          : ['E', '-'];

        if (typeof core.executeSequence === 'function') {
          await core.executeSequence(actionSequence);
        } else if (core.driver && typeof core.driver.queueSequence === 'function') {
          await core.driver.queueSequence(actionSequence);
        } else if (typeof core.sendKeySequence === 'function') {
          await core.sendKeySequence(actionSequence);
        }
      };
    }
  }

  /**
   * SIGNAL_LORE_ENGRAVE を受信して HUD バナーを表示
   * @param {Object} data - シグナルペイロード
   */
  show(data) {
    if (!this.elEngravingHud || !data) return;
    console.log('[EngravingHud] show banner:', data);

    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }

    const actual = data.actualText || '';
    const restored = data.restored;
    const isHeadstone = Boolean(data.isHeadstone || data.engraveType === 'HEADSTONE');
    const isElb = !isHeadstone && data.isElbereth;
    const isWardActive = !isHeadstone && data.isWardActive;

    // クラスのリセット
    this.elEngravingHud.className = 'engraving-hud';

    // 1. アイコンと状態別テーマスタイル
    if (isHeadstone) {
      // 墓碑銘 (HEADSTONE): 劣化しない永久の刻み文字
      this.elEngravingHud.classList.add('headstone');
      if (this.elEngravingHudIcon) this.elEngravingHudIcon.textContent = '🪦';
      if (this.elEngravingConfidenceBadge) {
        this.elEngravingConfidenceBadge.textContent = '墓碑銘 (Headstone)';
      }
      if (this.elBtnEngraveReapply) this.elBtnEngraveReapply.classList.add('hidden');
    } else if (isElb) {
      if (isWardActive) {
        this.elEngravingHud.classList.add('ward-active');
        if (this.elEngravingHudIcon) this.elEngravingHudIcon.textContent = '🛡️';
        if (this.elEngravingConfidenceBadge) {
          this.elEngravingConfidenceBadge.textContent = '結界有効 (100%)';
        }
        if (this.elBtnEngraveReapply) this.elBtnEngraveReapply.classList.add('hidden');
      } else {
        this.elEngravingHud.classList.add('ward-degraded');
        if (this.elEngravingHudIcon) this.elEngravingHudIcon.textContent = '⚠️';
        const pct = Math.round((data.elberethIntegrity || 0) * 100);
        if (this.elEngravingConfidenceBadge) {
          this.elEngravingConfidenceBadge.textContent = `結界無効 (${pct}% 風化)`;
        }
        if (this.elBtnEngraveReapply) this.elBtnEngraveReapply.classList.remove('hidden');
      }
    } else {
      this.elEngravingHud.classList.add('lore-engrave');
      if (this.elEngravingHudIcon) this.elEngravingHudIcon.textContent = '🏛️';
      if (this.elBtnEngraveReapply) this.elBtnEngraveReapply.classList.add('hidden');

      if (restored && restored.confidence !== undefined) {
        const pct = Math.round(restored.confidence * 100);
        if (this.elEngravingConfidenceBadge) {
          this.elEngravingConfidenceBadge.textContent = `${pct}% 同定`;
        }
      } else {
        if (this.elEngravingConfidenceBadge) {
          this.elEngravingConfidenceBadge.textContent = '手書き文字';
        }
      }
    }

    // 2. 差分表示 (actual ➔ pristine) のインテリジェント制御
    const pristineText = (restored && restored.pristineText) ? restored.pristineText : (isElb ? 'Elbereth' : '');
    const hasDegradation = Boolean(!isHeadstone && pristineText && actual !== pristineText);

    if (this.elEngravingActual) {
      this.elEngravingActual.textContent = actual;
      if (hasDegradation) {
        this.elEngravingActual.classList.remove('pristine-clean');
      } else {
        this.elEngravingActual.classList.add('pristine-clean');
      }
    }

    if (this.elEngravingArrow) {
      this.elEngravingArrow.style.display = hasDegradation ? 'inline' : 'none';
    }

    if (this.elEngravingPristine) {
      if (hasDegradation) {
        this.elEngravingPristine.textContent = pristineText;
        this.elEngravingPristine.style.display = 'inline';
      } else {
        this.elEngravingPristine.textContent = '';
        this.elEngravingPristine.style.display = 'none';
      }
    }

    // 3. 日本語訳
    if (this.elEngravingTranslation) {
      if (isHeadstone) {
        this.elEngravingTranslation.textContent = (restored && restored.translation)
          ? restored.translation
          : '墓石に刻まれた銘文（風化しない永久の記録）';
        this.elEngravingTranslation.style.display = 'block';
      } else if (restored && restored.translation) {
        this.elEngravingTranslation.textContent = restored.translation;
        this.elEngravingTranslation.style.display = 'block';
      } else if (isElb) {
        this.elEngravingTranslation.textContent = isWardActive
          ? 'エルベレス（魔除けの結界文字: モンスターは近寄れません）'
          : 'エルベレス（文字が風化し、結界の魔力が失われています）';
        this.elEngravingTranslation.style.display = 'block';
      } else {
        this.elEngravingTranslation.textContent = '（手書きのメモ・未登録の落書き）';
        this.elEngravingTranslation.style.display = 'block';
      }
    }

    // 4. 出典バッジ
    if (this.elEngravingSourceBadge) {
      if (isHeadstone) {
        this.elEngravingSourceBadge.textContent = '墓碑銘 (Headstone)';
        this.elEngravingSourceBadge.style.display = 'inline-block';
      } else if (restored && restored.source) {
        this.elEngravingSourceBadge.textContent = restored.source;
        this.elEngravingSourceBadge.style.display = 'inline-block';
      } else if (isElb) {
        this.elEngravingSourceBadge.textContent = '魔除けの結界';
        this.elEngravingSourceBadge.style.display = 'inline-block';
      } else {
        this.elEngravingSourceBadge.style.display = 'none';
      }
    }

    // 表示アニメーション
    this.elEngravingHud.classList.remove('hidden');
    this.elEngravingHud.classList.remove('fading-out');

    // 現在の座標を記録 (移動検知用)
    const core = this.getCore();
    if (core && core.gkl) {
      const situation = core.gkl.getSituation();
      if (situation?.player) {
        this.lastShownPosition = { x: situation.player.x, y: situation.player.y };
      }
    }

    // 7秒後に自動フェードアウト
    this.autoHideTimer = setTimeout(() => {
      this.hide();
    }, 7000);
  }

  /**
   * HUD バナーを非表示・フェードアウト
   */
  hide() {
    if (!this.elEngravingHud || this.elEngravingHud.classList.contains('hidden')) return;

    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }

    this.elEngravingHud.classList.add('fading-out');
    setTimeout(() => {
      this.elEngravingHud.classList.add('hidden');
      this.elEngravingHud.classList.remove('fading-out');
    }, 280);
  }

  /**
   * プレイヤーが移動した時に自動フェードアウト
   * @param {number} x
   * @param {number} y
   */
  onPlayerMoved(x, y) {
    if (!this.lastShownPosition) return;
    if (this.lastShownPosition.x !== x || this.lastShownPosition.y !== y) {
      this.hide();
      this.lastShownPosition = null;
    }
  }
}
