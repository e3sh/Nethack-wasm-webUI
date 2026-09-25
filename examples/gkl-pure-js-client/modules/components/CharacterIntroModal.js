/**
 * CharacterIntroModal.js
 * NetHack ゲーム開始時の導入フロー（ASKNAME: 名前入力 ＆ ynaq: キャラクタ作成モード選択）専用モーダル
 */

const FANTASY_NAMES = [
  'Arthur', 'Lancelot', 'Galahad', 'Roland', 'Conan', 'Valeria', 
  'Lyra', 'Morgan', 'Gideon', 'Diana', 'Freya', 'Isolde', 
  'Thorin', 'Robin', 'Boris', 'Duncan', 'Merlin', 'Corwin', 
  'Elric', 'Logan', 'Astrid', 'Eowyn', 'Rhiannon', 'Sonya', 
  'Brenda', 'Athena', 'Cassandra', 'Sylvia', 'Fiona', 'Rowan', 
  'Gale', 'Raven', 'Siegfried', 'Percival', 'Alistair', 'Valerius'
];

export class CharacterIntroModal {
  /**
   * @param {Object} options
   * @param {Function} options.getCore - WebUICore インスタンス取得関数
   * @param {Object} [options.characterCreationModal] - CharacterCreationModal インスタンス
   * @param {string} [options.currentLanguage='ja'] - 現在の言語
   */
  constructor(options = {}) {
    this.getCore = options.getCore || (() => null);
    this.characterCreationModal = options.characterCreationModal || null;
    this.currentLanguage = options.currentLanguage || 'ja';

    this.activeType = null; // 'ASKNAME' | 'MODE_SELECT' | null
    this.isVisible = false;
    this.isTransitioning = false;
    this.currentData = null;

    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.initDOM();
  }

  /**
   * DOM初期化
   */
  initDOM() {
    if (typeof document === 'undefined') return;
    let el = document.getElementById('char-intro-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'char-intro-modal';
      el.className = 'char-intro-backdrop hidden';
      if (document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(el);
      }
    }
    this.elModal = el;
  }

  /**
   * 言語の更新
   * @param {string} lang
   */
  setLanguage(lang) {
    this.currentLanguage = lang;
    if (this.isVisible) {
      if (this.activeType === 'ASKNAME') {
        this.renderAskName();
      } else if (this.activeType === 'MODE_SELECT') {
        this.renderModeSelect();
      }
    }
  }

  /**
   * 現在導入モーダルが表示中かどうか
   * @returns {boolean}
   */
  isIntroActive() {
    return this.isVisible;
  }

  /**
   * キャラクタ作成モード質問（ynaq）プロンプトであるか判定
   * @param {Object} data 
   * @returns {boolean}
   */
  static isYnaqPrompt(data) {
    if (!data) return false;
    const cat = data.promptCategory || data.category || '';
    const ctx = data.context || '';
    const isYnCategory = cat === 'YN' || ctx === 'yn_function' || data.inputType === 'SINGLE_KEY' || data.type === 'yn';
    if (!isYnCategory) return false;

    const query = `${data.query || ''} ${data.question || ''} ${data.prompt || ''} ${data.rawPrompt || ''}`.toLowerCase();
    const hasYnaqTag = query.includes('[ynaq]');
    const hasPickHeroPrompt = (query.includes('shall i pick') || query.includes('pick character')) && 
                              (query.includes('race') || query.includes('role') || query.includes('gender'));
    const hasJpPickHero = query.includes('選んであげましょうか') && (query.includes('種族') || query.includes('役割') || query.includes('属性'));

    return hasYnaqTag || hasPickHeroPrompt || hasJpPickHero;
  }

  /**
   * 名前入力（ASKNAME）プロンプトの表示
   * @param {Object} data
   */
  showAskName(data) {
    this.isTransitioning = false;
    this.currentData = data;
    this.activeType = 'ASKNAME';
    this.isVisible = true;

    this.renderAskName();
    if (this.elModal) {
      this.elModal.classList.remove('hidden');
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
      window.addEventListener('keydown', this.boundKeyDownHandler);
    }
  }

  /**
   * キャラクタ作成モード選択（ynaq）の表示
   * @param {Object} data
   */
  showModeSelect(data) {
    this.isTransitioning = false;
    this.currentData = data;
    this.activeType = 'MODE_SELECT';
    this.isVisible = true;

    this.renderModeSelect();
    if (this.elModal) {
      this.elModal.classList.remove('hidden');
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
      window.addEventListener('keydown', this.boundKeyDownHandler);
    }
  }

  /**
   * モーダルの非表示化
   * @param {boolean} [force=false]
   */
  hide(force = false) {
    if (this.isTransitioning && !force) {
      return;
    }
    this.isTransitioning = false;
    this.isVisible = false;
    this.activeType = null;
    this.currentData = null;
    if (this.elModal) {
      this.elModal.classList.add('hidden');
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
    }
  }

  /**
   * リセット
   */
  reset() {
    this.hide(true);
  }

  /**
   * ASKNAME 画面のレンダリング
   */
  renderAskName() {
    const isEn = this.currentLanguage === 'en';
    const core = this.getCore();

    const initialDefault = this.currentData?.detectedName || 
                           this.currentData?.defaultName || 
                           (core && core.playerName) || 
                           'Hero';

    const title = isEn ? '👑 Name Your Adventurer' : '👑 冒険者の名前を決めてください';
    const subtitle = isEn 
      ? 'Carve your hero\'s name into the annals of the Mazes of Menace.' 
      : '危険に満ちた死の迷宮（Mazes of Menace）に挑む勇者の名を刻みましょう。';
    const placeholder = initialDefault;
    const btnRollText = isEn ? '🎲 Random' : '🎲 おまかせ生成';
    const btnSubmitText = isEn ? '⚔️ Begin Journey (Enter)' : '⚔️ 冒険を始める (Enter)';
    const btnCancelText = isEn ? 'Cancel' : 'キャンセル';

    this.elModal.innerHTML = `
      <div class="char-intro-card animate-pop-in">
        <div class="char-intro-header">
          <div class="char-step-indicator">
            <div class="char-step-node active">
              <span class="char-step-dot">1</span>
              <span>${isEn ? 'Name' : '名前決定'}</span>
            </div>
            <div class="char-step-line"></div>
            <div class="char-step-node">
              <span class="char-step-dot">2</span>
              <span>${isEn ? 'Mode' : '作成モード'}</span>
            </div>
          </div>
          <h2 class="char-intro-title">${title}</h2>
          <p class="char-intro-subtitle">${subtitle}</p>
        </div>

        <div class="char-intro-body">
          <div class="char-name-input-group">
            <span class="char-name-input-icon">👤</span>
            <input 
              type="text" 
              id="intro-name-input" 
              class="char-name-input" 
              placeholder="${placeholder}" 
              value="${initialDefault}" 
              maxlength="32" 
              autocomplete="off" 
              spellcheck="false"
            />
            <button id="btn-intro-roll-name" class="char-btn-secondary" title="${isEn ? 'Generate random name' : '名前をランダム生成'}">
              ${btnRollText}
            </button>
          </div>
          <div class="char-name-hint">
            ${isEn ? 'Letters, digits, and underscores allowed.' : '英数字・アンダースコアが使用可能です。'}
          </div>
        </div>

        <div class="char-intro-footer">
          <button id="btn-intro-cancel" class="char-btn-subtle">${btnCancelText}</button>
          <button id="btn-intro-confirm-name" class="char-btn-primary">${btnSubmitText}</button>
        </div>
      </div>
    `;

    const inputEl = document.getElementById('intro-name-input');
    const btnRoll = document.getElementById('btn-intro-roll-name');
    const btnConfirm = document.getElementById('btn-intro-confirm-name');
    const btnCancel = document.getElementById('btn-intro-cancel');

    if (inputEl) {
      inputEl.value = initialDefault;
    }

    if (btnRoll && inputEl) {
      btnRoll.onclick = () => {
        const randomIndex = Math.floor(Math.random() * FANTASY_NAMES.length);
        inputEl.value = FANTASY_NAMES[randomIndex];
        inputEl.focus();
        inputEl.select();
      };
    }

    const submitAction = () => {
      let val = inputEl ? inputEl.value.trim() : '';
      if (!val) val = initialDefault || 'Hero';
      this.confirmName(val);
    };

    if (btnConfirm) btnConfirm.onclick = submitAction;
    if (btnCancel) {
      btnCancel.onclick = () => {
        const core = this.getCore();
        this.hide();
        if (core) {
          if (typeof core.cancelPrompt === 'function') core.cancelPrompt();
          else core.respond('\x1b');
        }
      };
    }

    if (inputEl) {
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 50);
    }
  }

  /**
   * 名前決定処理
   * @param {string} finalName 
   */
  confirmName(finalName) {
    const core = this.getCore();
    if (this.characterCreationModal) {
      this.characterCreationModal.characterName = finalName;
    }
    if (core && typeof core.setPlayerName === 'function') {
      core.setPlayerName(finalName);
    }

    this.isVisible = false;
    this.isTransitioning = true;
    this.activeType = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDownHandler);
    }

    const card = this.elModal ? this.elModal.querySelector('.char-intro-card') : null;
    if (card) {
      card.classList.remove('animate-pop-in', 'animate-slide-in-right');
      card.classList.add('animate-slide-out-left');
    }

    setTimeout(() => {
      if (this.isTransitioning && !this.isVisible && this.elModal) {
        this.isTransitioning = false;
        this.elModal.classList.add('hidden');
      }
    }, 250);

    if (core) {
      core.respond(finalName);
    }
  }

  /**
   * キャラクタ作成モード選択（ynaq）画面のレンダリング
   */
  renderModeSelect() {
    const isEn = this.currentLanguage === 'en';

    const title = isEn ? '⚔️ Character Creation Mode' : '⚔️ キャラクター作成方法の選択';
    const subtitle = isEn 
      ? 'How would you like to prepare your adventurer for the dungeon?' 
      : 'ダンジョンに挑む冒険者をどのように決定しますか？';

    // 3大カード定義
    const optAuto = {
      key: 'Y',
      badge: isEn ? 'Recommended' : '推奨',
      badgeClass: 'badge-recommended',
      title: isEn ? '🎲 Automatic (Review & Start)' : '🎲 おまかせ作成 (結果を確認して開始)',
      desc: isEn 
        ? 'NetHack will automatically balance your role, race, and alignment. You can review the result before setting off.'
        : 'NetHack が職業・種族・属性をバランスよく自動選定します。生成されたキャラクターを確認してから冒険を開始します。',
      response: 'y'
    };

    const optCustom = {
      key: 'N',
      badge: isEn ? 'Custom Build' : '手動詳細設定',
      badgeClass: 'badge-custom',
      title: isEn ? '⚙️ Detailed Creation (Manual)' : '⚙️ 自分で詳細に選ぶ (手動カスタム作成)',
      desc: isEn 
        ? 'Choose your Role (13 classes), Race, Gender, and Alignment with detailed codex & advice modal.'
        : '職業（13種）・種族（5種）・性別・属性を、戦術助言や詳細ナレッジを見ながら自分好みにじっくり選定します。',
      response: 'n'
    };

    const optQuick = {
      key: 'Q',
      badge: isEn ? 'Instant' : '高速',
      badgeClass: 'badge-quick',
      title: isEn ? '⚡ Quick Start (Instant Dive)' : '⚡ クイックスタート (ランダム即開始)',
      desc: isEn 
        ? 'Skip all confirmation dialogues and immediately dive into the dungeon with a random adventurer.'
        : '確認ステップを一切挟まず、ランダムに選ばれた英雄で今すぐ死の迷宮へ突入します。',
      response: 'q'
    };

    this.elModal.innerHTML = `
      <div class="char-intro-card mode-select-card animate-slide-in-right">
        <div class="char-intro-header">
          <div class="char-step-indicator">
            <div class="char-step-node completed">
              <span class="char-step-dot">✓</span>
              <span>${isEn ? 'Name' : '名前決定'}</span>
            </div>
            <div class="char-step-line active"></div>
            <div class="char-step-node active">
              <span class="char-step-dot">2</span>
              <span>${isEn ? 'Mode' : '作成モード'}</span>
            </div>
          </div>
          <h2 class="char-intro-title">${title}</h2>
          <p class="char-intro-subtitle">${subtitle}</p>
        </div>

        <div class="char-intro-body">
          <div class="char-mode-cards-container">
            <!-- 1. おまかせ作成 -->
            <button class="char-mode-card" data-key="y">
              <div class="char-mode-card-header">
                <span class="char-mode-key-badge">[Y]</span>
                <span class="char-mode-status-badge ${optAuto.badgeClass}">${optAuto.badge}</span>
              </div>
              <div class="char-mode-card-title">${optAuto.title}</div>
              <div class="char-mode-card-desc">${optAuto.desc}</div>
            </button>

            <!-- 2. 自分で選ぶ -->
            <button class="char-mode-card featured" data-key="n">
              <div class="char-mode-card-header">
                <span class="char-mode-key-badge">[N]</span>
                <span class="char-mode-status-badge ${optCustom.badgeClass}">${optCustom.badge}</span>
              </div>
              <div class="char-mode-card-title">${optCustom.title}</div>
              <div class="char-mode-card-desc">${optCustom.desc}</div>
            </button>

            <!-- 3. クイックスタート -->
            <button class="char-mode-card" data-key="q">
              <div class="char-mode-card-header">
                <span class="char-mode-key-badge">[Q]</span>
                <span class="char-mode-status-badge ${optQuick.badgeClass}">${optQuick.badge}</span>
              </div>
              <div class="char-mode-card-title">${optQuick.title}</div>
              <div class="char-mode-card-desc">${optQuick.desc}</div>
            </button>
          </div>
        </div>

        <div class="char-intro-footer mode-select-footer">
          <div class="char-mode-footer-hint">
            ${isEn ? 'Press [Y], [N], or [Q] on your keyboard, or click a card above.' : 'キーボードの [Y] [N] [Q] キー、または上のカードをクリックして選択できます。'}
          </div>
        </div>
      </div>
    `;

    this.elModal.querySelectorAll('.char-mode-card').forEach(card => {
      card.onclick = () => {
        const key = card.dataset.key;
        this.selectMode(key);
      };
    });
  }

  /**
   * モード選択の送信
   * @param {string} responseChar 
   */
  selectMode(responseChar) {
    const core = this.getCore();
    this.hide();
    if (core) {
      core.respond(responseChar);
    }
  }

  /**
   * キーボード入力処理
   * @param {KeyboardEvent} e 
   */
  handleKeyDown(e) {
    if (!this.isVisible) return;

    if (this.activeType === 'ASKNAME') {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const inputEl = document.getElementById('intro-name-input');
        const initialDefault = this.currentData?.detectedName || this.currentData?.defaultName || 'Hero';
        let val = inputEl ? inputEl.value.trim() : '';
        if (!val) val = initialDefault;
        this.confirmName(val);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const core = this.getCore();
        this.hide();
        if (core) {
          if (typeof core.cancelPrompt === 'function') core.cancelPrompt();
          else core.respond('\x1b');
        }
      }
    } else if (this.activeType === 'MODE_SELECT') {
      const key = e.key.toLowerCase();
      if (key === 'y' || key === 'a') {
        e.preventDefault();
        e.stopPropagation();
        this.selectMode('y');
      } else if (key === 'n') {
        e.preventDefault();
        e.stopPropagation();
        this.selectMode('n');
      } else if (key === 'q') {
        e.preventDefault();
        e.stopPropagation();
        this.selectMode('q');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.selectMode('q');
      }
    }
  }
}
