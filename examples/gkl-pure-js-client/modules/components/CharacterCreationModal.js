/**
 * CharacterCreationModal.js
 * NetHack キャラクター作成（Role / Race / Gender / Alignment）専用のタブ切替型モーダルコンポーネント
 */

import { 
  getRoleKnowledge, 
  getRaceKnowledge, 
  getAlignmentKnowledge, 
  getGenderKnowledge, 
  getCharacterBadges,
  resolveRoleKey,
  resolveRaceKey,
  resolveGenderKey,
  resolveAlignmentKey
} from "../../../../src/core/knowledge/data/CHARACTER_KNOWLEDGE_BASE.js";

export class CharacterCreationModal {
  /**
   * @param {Object} options
   * @param {Function} options.getCore - WebUICore インスタンス取得関数
   * @param {Function} [options.onStateChange] - 状態変更コールバック
   */
  constructor(options = {}) {
    this.getCore = options.getCore || (() => null);
    this.onStateChange = options.onStateChange || (() => {});
    this.isVisible = false;
    this.isCompleted = false; // キャラクタ作成完了フラグ（ゲームプレイ中の誤爆を完全防止）
    this.currentLanguage = 'ja';
    this.characterName = 'Hero';

    this.selectedConfig = {
      role: null,
      race: null,
      gender: null,
      align: null
    };

    this.activeTab = 'role';
    this.currentPrompt = '';
    this.currentItems = [];

    // アイコンマップ（シンボル絵文字）
    this.icons = {
      roles: {
        an_Archeologist: "🤠", a_Barbarian: "🪓", a_Caveman_Cavewoman: "🦴", a_Healer: "🩺",
        a_Knight: "🛡️", a_Monk: "🥋", a_Priest_Priestess: "✝️", a_Rogue: "🗡️",
        a_Ranger: "🏹", a_Samurai: "⚔️", a_Tourist: "📸", a_Valkyrie: "⚡", a_Wizard: "🔮"
      },
      races: {
        human: "👤", elf: "🧝", dwarf: "⛏️", gnome: "🍄", orc: "👹"
      },
      genders: {
        male: "♂️", female: "♀️"
      },
      alignments: {
        lawful: "⚖️", neutral: "☯️", chaotic: "🌀"
      }
    };

    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    this.initDOM();
  }

  /**
   * キャラクタ作成状態のリセット
   */
  reset() {
    this.isVisible = false;
    this.isCompleted = false;
    this.selectedConfig = {
      role: null,
      race: null,
      gender: null,
      align: null
    };
    this.activeTab = 'role';
    this.currentPrompt = '';
    this.currentItems = [];
    if (this.elModal) {
      this.elModal.classList.add('hidden');
    }
  }

  /**
   * DOMの初期化
   */
  initDOM() {
    let el = document.getElementById('char-create-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'char-create-modal';
      el.className = 'modal-backdrop hidden';
      document.body.appendChild(el);
    }
    this.elModal = el;

    this.elModal.innerHTML = `
      <div class="char-create-modal-container">
        <!-- 上部ヘッダー -->
        <div class="char-modal-top">
          <div class="char-title-area">
            <h2 id="cc-modal-heading">⚔️ キャラクタ作成</h2>
            <p id="cc-modal-subheading">冒険に出るキャラクターの能力と出自を決定します</p>
          </div>
          <div class="char-name-badge">
            <span class="char-name-label">NAME</span>
            <span class="char-name-val" id="cc-val-name">Hero</span>
          </div>
        </div>

        <!-- タブバー -->
        <div class="char-tabs-bar" id="cc-tabs-bar">
          <button class="char-tab-btn active" id="cc-tab-role" data-tab="role">
            <span class="tab-key">?</span>
            <span class="tab-title" id="cc-tab-title-role">役職 (Role)</span>
          </button>
          <button class="char-tab-btn" id="cc-tab-race" data-tab="race">
            <span class="tab-key">/</span>
            <span class="tab-title" id="cc-tab-title-race">種族 (Race)</span>
          </button>
          <button class="char-tab-btn" id="cc-tab-gender" data-tab="gender">
            <span class="tab-key">"</span>
            <span class="tab-title" id="cc-tab-title-gender">性別 (Gender)</span>
          </button>
          <button class="char-tab-btn" id="cc-tab-align" data-tab="align">
            <span class="tab-key">[</span>
            <span class="tab-title" id="cc-tab-title-align">陣営 (Alignment)</span>
          </button>
        </div>

        <!-- コンテンツ領域 -->
        <div class="char-modal-body" id="cc-modal-body">
          <div class="char-section-header" id="cc-section-header">
            <div class="char-section-title">
              <span id="cc-category-icon">🧙</span>
              <span id="cc-category-title">役職または職業を選択</span>
            </div>
            <div class="char-section-subtitle" id="cc-category-hint">キーボードの各キーまたはカードクリックで選択</div>
          </div>

          <!-- カード一覧 -->
          <div class="char-cards-grid" id="cc-cards-grid"></div>

          <!-- 最終確認ビュー（Step 13） -->
          <div class="char-confirm-view" id="cc-confirm-view" style="display: none;">
            <div class="char-confirm-avatar" id="cc-confirm-avatar">🤠</div>
            <div class="char-confirm-title" id="cc-confirm-title">冒険の準備が整いました！</div>
            <div class="char-confirm-summary-pill">
              <span id="cc-conf-name">Hero</span> the 
              <span id="cc-conf-align">lawful</span> 
              <span id="cc-conf-gender">male</span> 
              <span id="cc-conf-race">human</span> 
              <span id="cc-conf-role">Archeologist</span>
            </div>
            <p id="cc-confirm-subtitle" style="color: #8b92a5; font-size: 13px; max-width: 480px; margin: 0 auto;">
              この構成でダンジョンへの挑戦を開始しますか？
            </p>
          </div>
        </div>

        <!-- 下部フッター / プレビュー -->
        <div class="char-modal-footer">
          <div class="char-footer-preview">
            <div class="char-preview-label" id="cc-preview-label">CURRENT CONFIGURATION</div>
            <div class="char-preview-tags" id="cc-preview-tags">
              <div class="char-preview-tag unset" id="cc-tag-role">役職: 未選択</div>
              <div class="char-preview-tag unset" id="cc-tag-race">種族: 未選択</div>
              <div class="char-preview-tag unset" id="cc-tag-gender">性別: 未選択</div>
              <div class="char-preview-tag unset" id="cc-tag-align">陣営: 未選択</div>
            </div>
          </div>
          <div class="char-footer-actions">
            <button class="char-btn-action random-btn" id="cc-btn-left">
              <span id="cc-btn-icon-left">🎲</span>
              <span id="cc-btn-text-left">自動的に選択 (*)</span>
            </button>
            <button class="char-btn-action primary" id="cc-btn-start">
              <span>▶</span>
              <span id="cc-btn-text-start">次へ / 決定</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // タブクリックイベント
    this.elModal.querySelectorAll('.char-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        this.onTabClick(tab);
      };
    });

    // フッターボタンイベント
    const btnLeft = document.getElementById('cc-btn-left');
    if (btnLeft) {
      btnLeft.onclick = () => {
        if (this.activeTab === 'confirm') {
          this.onChooseAgain();
        } else {
          this.onPickRandom();
        }
      };
    }

    const btnStart = document.getElementById('cc-btn-start');
    if (btnStart) {
      btnStart.onclick = () => {
        if (this.activeTab === 'confirm') {
          this.onConfirmStart();
        }
      };
    }
  }

  /**
   * メニューデータがキャラクター作成のものか判定
   * @param {Object} data 
   * @returns {boolean}
   */
  isCharacterCreationMenu(data) {
    if (!data) return false;
    // 冒険開始後（キャラクタ作成完了後）は絶対に起動しない
    if (this.isCompleted) return false;

    // 0. 専用シグナル属性が存在する場合は最優先でキャラ作成メニューと判定
    if (data.subCategory === 'CHARACTER_CREATION' || data.signal?.id === 'SIGNAL_CHARACTER_CREATION') {
      return true;
    }

    const items = data.menuItems || data.items || [];
    if (!items || items.length === 0) return false;
    if (data.context === 'yn_function' || data.promptCategory === 'YN' || data.type === 'yn') return false;

    const rawPrompt = (data.rawPrompt || data.prompt || '').trim();
    const promptStr = `${data.rawPrompt || ''} ${data.prompt || ''} ${data.message || ''} ${data.question || ''}`.toLowerCase();

    // 1. メニュー項目内に公式ヘッダ行 "<role> <race>" などが含まれるか
    const hasCharHeader = items.some(item => {
      const s = item.rawStr || item.str || item.text || '';
      return s.includes('<role>') || s.includes('<race>') || s.includes('<gender>') || s.includes('<alignment>');
    });

    // 2. Step 13 (最終確認画面) の厳密判定:
    // ヘッダ行: "Name the [align] [gender] [race] [role]" (例: "home the lawful male human Archeologist")
    const hasConfirmHeader = items.some(item => {
      const s = (item.rawStr || item.str || item.text || '').trim();
      return /.+?\s+the\s+(lawful|neutral|chaotic)\s+(male|female)\s+(human|elf|dwarf|gnome|orc)\s+[a-zA-Z]+/i.test(s);
    });

    // Step 13 の選択肢構成: y=Yes; start game / n=No; choose role again
    const hasConfirmChoices = items.some(item => {
      const acc = item.accelerator || item.ch;
      const s = (item.rawStr || item.str || item.text || '').toLowerCase();
      return (acc === 'y' || acc === 'n') && (s.includes('start game') || s.includes('choose role again') || s.includes('ゲームを開始') || s.includes('選び直'));
    });

    const isConfirmStep = (hasConfirmHeader || hasConfirmChoices) && (promptStr.includes('is this ok') || promptStr.includes('ynq') || promptStr.includes('よろしいですか'));

    // 3. 通常選択プロンプト: "Pick a role or profession", "Pick a race or species" 等の明確なキャラ作成プロンプト
    const isPickPrompt = /pick a (role|race|gender|alignment|profession|species|sex|creed)/i.test(rawPrompt) ||
                         /(役職|職業|種族|性別|陣営|属性)を選択/i.test(promptStr);

    return hasCharHeader || isConfirmStep || isPickPrompt;
  }

  /**
   * モーダルの表示および更新
   * @param {Object} data 
   * @param {string} [language='ja']
   */
  show(data, language = 'ja') {
    this.currentLanguage = language;
    this.isVisible = true;
    this.currentPrompt = data.rawPrompt || data.prompt || data.message || data.question || '';
    this.translatedPrompt = data.prompt || this.currentPrompt;
    this.currentItems = data.menuItems || data.items || [];

    const core = this.getCore();
    if (core && core.playerName) {
      this.characterName = core.playerName;
    } else if (core && core.resumeSavePlayerName) {
      this.characterName = core.resumeSavePlayerName;
    } else if (data && (data.detectedName || data.playerName || data.defaultName)) {
      this.characterName = (data.detectedName || data.playerName || data.defaultName).trim();
    }

    this.parseCurrentState();
    this.render();

    if (this.elModal) {
      this.elModal.classList.remove('hidden');
    }

    window.removeEventListener('keydown', this.boundKeyDownHandler);
    window.addEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * モーダルの非表示
   */
  hide() {
    this.isVisible = false;
    if (this.elModal) {
      this.elModal.classList.add('hidden');
    }
    window.removeEventListener('keydown', this.boundKeyDownHandler);
  }

  /**
   * 現在のNetHackメニュー状態からアクティブタブと確定選択を解析
   */
  parseCurrentState() {
    const rawPrompt = (this.currentPrompt || '').toLowerCase();
    const transPrompt = (this.translatedPrompt || '').toLowerCase();
    const promptCombined = `${rawPrompt} ${transPrompt}`;

    const isConfirmChoicePresent = this.currentItems.some(i => {
      const s = (i.rawStr || i.str || '').toLowerCase();
      return s.includes('start game') || s.includes('choose role again') || s.includes('ゲームを開始') || s.includes('選び直');
    });

    if (rawPrompt.includes('is this ok') || promptCombined.includes('ynq') || transPrompt.includes('よろしいですか') || isConfirmChoicePresent) {
      this.activeTab = 'confirm';
    } else if (rawPrompt.includes('role') || rawPrompt.includes('profession') || transPrompt.includes('役職') || transPrompt.includes('職業')) {
      this.activeTab = 'role';
    } else if (rawPrompt.includes('race') || rawPrompt.includes('species') || transPrompt.includes('種族')) {
      this.activeTab = 'race';
    } else if (rawPrompt.includes('gender') || rawPrompt.includes('sex') || transPrompt.includes('性別')) {
      this.activeTab = 'gender';
    } else if (rawPrompt.includes('alignment') || rawPrompt.includes('creed') || transPrompt.includes('陣営') || transPrompt.includes('属性')) {
      this.activeTab = 'align';
    }

    // ヘッダ行から現在の構成を抽出（例: "<role> <race> <gender> lawful" や "Archeologist human <gender> lawful"）
    for (const item of this.currentItems) {
      const s = (item.rawStr || item.str || item.text || '').trim();
      if (s.startsWith('<') || s.includes('<role>') || s.includes('<race>') || s.includes('<gender>') || s.includes('<alignment>') ||
          /^(Archeologist|Barbarian|Caveman|Cavewoman|Healer|Knight|Monk|Priest|Priestess|Ranger|Rogue|Samurai|Tourist|Valkyrie|Wizard|<role>)/i.test(s)) {
        const parts = s.split(/\s+/);
        if (parts.length >= 4) {
          this.selectedConfig.role = (parts[0] !== '<role>') ? parts[0] : null;
          this.selectedConfig.race = (parts[1] !== '<race>') ? parts[1] : null;
          this.selectedConfig.gender = (parts[2] !== '<gender>') ? parts[2] : null;
          this.selectedConfig.align = (parts[3] !== '<alignment>') ? parts[3] : null;
        }
        break;
      } else if (this.activeTab === 'confirm') {
        const rawS = (item.rawStr || '').trim();
        const strS = (item.str || '').trim();
        const targetS = rawS.includes(' the ') ? rawS : (strS.includes(' the ') ? strS : '');
        if (targetS) {
          // "home the lawful male human Archeologist"
          const m = targetS.match(/(.+?)\s+the\s+(\w+)\s+(\w+)\s+(\w+)\s+(.+)/);
          if (m) {
            this.characterName = m[1].trim();
            const core = this.getCore();
            if (core && typeof core.setPlayerName === 'function') {
              core.setPlayerName(this.characterName);
            } else if (core) {
              core.playerName = this.characterName;
            }
            this.selectedConfig.align = m[2].trim();
            this.selectedConfig.gender = m[3].trim();
            this.selectedConfig.race = m[4].trim();
            this.selectedConfig.role = m[5].trim();
          }
        }
      }
    }

    // 制約行から強制決定（forces）を検出（例: "    role forces female"）
    for (const item of this.currentItems) {
      const s = (item.rawStr || item.str || item.text || '').trim();
      const forcesMatch = s.match(/forces\s+([a-zA-Z]+)/i);
      if (forcesMatch) {
        const forcedVal = forcesMatch[1].toLowerCase();
        if (['male', 'female'].includes(forcedVal)) {
          this.selectedConfig.gender = forcedVal;
        } else if (['human', 'elf', 'dwarf', 'gnome', 'orc'].includes(forcedVal)) {
          this.selectedConfig.race = forcedVal;
        } else if (['lawful', 'neutral', 'chaotic'].includes(forcedVal)) {
          this.selectedConfig.align = forcedVal;
        }
      }
    }
  }

  /**
   * メニュー項目のアクセラレータキーを正規化して取得
   * @param {Object} item 
   * @returns {string}
   */
  getItemAcc(item) {
    if (!item) return '';
    if (typeof item.accelerator === 'string' && item.accelerator.length > 0 && item.accelerator !== '\0') {
      return item.accelerator;
    }
    if (typeof item.ch === 'string' && item.ch.length > 0 && item.ch !== '\0') {
      return item.ch;
    }
    if (typeof item.ch === 'number' && item.ch > 0) {
      return String.fromCharCode(item.ch);
    }
    return '';
  }

  /**
   * 指定タブへのジャンプ用メニュー項目を検索
   * @param {string} tab - 'role' | 'race' | 'gender' | 'align'
   * @returns {Object|null}
   */
  findJumpItemForTab(tab) {
    const targetMap = {
      role: { key: '?', id: -4, regex: /Pick (another )?role first/i },
      race: { key: '/', id: -5, regex: /Pick (another )?race first/i },
      gender: { key: '"', id: -6, regex: /Pick (another )?gender first/i },
      align: { key: '[', id: -7, regex: /Pick (another )?alignment first/i }
    };

    const target = targetMap[tab];
    if (!target) return null;

    return this.currentItems.find(item => {
      const acc = this.getItemAcc(item);
      const str = item.rawStr || item.str || item.text || '';
      return (
        item.identifier === target.id ||
        target.regex.test(str) ||
        acc === target.key
      );
    }) || null;
  }

  /**
   * 翻訳ヘルパー
   */
  translate(text) {
    if (!text) return '';
    const isJa = this.currentLanguage === 'ja';
    if (!isJa) return text;

    const core = this.getCore();
    if (core && core.translator && typeof core.translator.translate === 'function') {
      const res = core.translator.translate(text);
      if (res && res !== text) return res;
    }
    if (typeof nhEntities === 'function') {
      const ents = nhEntities();
      const stripped = text.replace(/^(an?|the)\s+/i, '').trim();
      if (ents[stripped]) return ents[stripped];
      if (ents[stripped.toLowerCase()]) return ents[stripped.toLowerCase()];
    }

    // SSOT ナレッジベースによるフォールバック翻訳
    const roleK = getRoleKnowledge(text);
    if (roleK?.nameJa) return roleK.nameJa;
    const raceK = getRaceKnowledge(text);
    if (raceK?.nameJa) return raceK.nameJa;
    const alignK = getAlignmentKnowledge(text);
    if (alignK?.nameJa) return alignK.nameJa;
    const genderK = getGenderKnowledge(text);
    if (genderK?.nameJa) return genderK.nameJa;

    return text;
  }

  /**
   * 画面描画
   */
  render() {
    const isJa = this.currentLanguage === 'ja';

    // キャラ名
    const elName = document.getElementById('cc-val-name');
    if (elName) elName.textContent = this.characterName || 'Hero';

    // 見出しテキスト
    const elHeading = document.getElementById('cc-modal-heading');
    const elSubheading = document.getElementById('cc-modal-subheading');
    if (elHeading) elHeading.textContent = isJa ? '⚔️ キャラクタ作成' : '⚔️ Character Creation';
    if (elSubheading) elSubheading.textContent = isJa ? '冒険に出るキャラクターの能力と出自を決定します' : 'Choose abilities and background for your adventurer';

    // タブバーの更新
    const tabs = ['role', 'race', 'gender', 'align'];
    tabs.forEach(t => {
      const elTab = document.getElementById(`cc-tab-${t}`);
      const isActive = this.activeTab === t;
      const jumpItem = this.findJumpItemForTab(t);
      const isConfigured = !!this.selectedConfig[t];

      if (elTab) {
        elTab.classList.toggle('active', isActive);
        // 現在アクティブでなく、かつメニュー内にジャンプ項目が存在しない場合
        if (!isActive) {
          if (!jumpItem && isConfigured) {
            elTab.classList.add('locked');
            elTab.classList.remove('disabled');
          } else if (!jumpItem && !isConfigured) {
            elTab.classList.add('disabled');
            elTab.classList.remove('locked');
          } else {
            elTab.classList.remove('disabled', 'locked');
          }
        } else {
          elTab.classList.remove('disabled', 'locked');
        }
      }

      const elTitle = document.getElementById(`cc-tab-title-${t}`);
      if (elTitle) {
        const titlesJa = { role: '役職 (Role)', race: '種族 (Race)', gender: '性別 (Gender)', align: '陣営 (Alignment)' };
        const titlesEn = { role: 'Role', race: 'Race', gender: 'Gender', align: 'Alignment' };
        elTitle.textContent = isJa ? titlesJa[t] : titlesEn[t];
      }
    });

    // プレビュータグおよび CURRENT CONFIGURATION ラベルの更新
    const elPreviewLabel = document.getElementById('cc-preview-label');
    let hasCurrentPending = false;

    tabs.forEach(t => {
      const elTag = document.getElementById(`cc-tag-${t}`);
      if (!elTag) return;
      const val = this.selectedConfig[t];
      const typeLabel = isJa ? { role: '役職', race: '種族', gender: '性別', align: '陣営' }[t] : { role: 'Role', race: 'Race', gender: 'Gender', align: 'Align' }[t];

      if (val) {
        // 選択済みの項目は今の Blue のまま
        elTag.className = 'char-preview-tag filled';
        elTag.textContent = `${typeLabel}: ${isJa ? this.translate(val) : val}`;
      } else if (this.activeTab === t) {
        // 現在アクティブな画面でカード未選択（未確定・選び直し）の場合は注目色 (Amber/Gold)
        hasCurrentPending = true;
        elTag.className = 'char-preview-tag pending';
        elTag.textContent = `${typeLabel}: ${isJa ? '選択待ち' : 'Pending'}`;
      } else {
        // 未到達の未選択項目は通常の灰色破線
        elTag.className = 'char-preview-tag unset';
        elTag.textContent = `${typeLabel}: ${isJa ? '未選択' : 'None'}`;
      }
    });

    if (elPreviewLabel) {
      if (hasCurrentPending) {
        elPreviewLabel.classList.add('pending');
        elPreviewLabel.textContent = isJa ? 'CURRENT CONFIGURATION (選択待ち)' : 'CURRENT CONFIGURATION (PENDING)';
      } else {
        elPreviewLabel.classList.remove('pending');
        elPreviewLabel.textContent = 'CURRENT CONFIGURATION';
      }
    }

    // ビューの切り替え（Confirm vs 通常選択）
    const confirmView = document.getElementById('cc-confirm-view');
    const cardsGrid = document.getElementById('cc-cards-grid');
    const sectionHeader = document.getElementById('cc-section-header');

    if (this.activeTab === 'confirm') {
      if (confirmView) confirmView.style.display = 'flex';
      if (cardsGrid) cardsGrid.style.display = 'none';
      if (sectionHeader) sectionHeader.style.display = 'none';

      document.getElementById('cc-conf-name').textContent = this.characterName;
      document.getElementById('cc-conf-align').textContent = isJa ? this.translate(this.selectedConfig.align) : this.selectedConfig.align;
      document.getElementById('cc-conf-gender').textContent = isJa ? this.translate(this.selectedConfig.gender) : this.selectedConfig.gender;
      document.getElementById('cc-conf-race').textContent = isJa ? this.translate(this.selectedConfig.race) : this.selectedConfig.race;
      document.getElementById('cc-conf-role').textContent = isJa ? this.translate(this.selectedConfig.role) : this.selectedConfig.role;

      document.getElementById('cc-confirm-title').textContent = isJa ? '冒険の準備が整いました！' : 'Ready for Adventure!';
      document.getElementById('cc-confirm-subtitle').textContent = isJa ? 'この構成でダンジョンへの挑戦を開始しますか？' : 'Start your adventure with this character configuration?';

      // ボタン設定
      const btnLeft = document.getElementById('cc-btn-left');
      if (btnLeft) {
        btnLeft.className = 'char-btn-action secondary';
        document.getElementById('cc-btn-icon-left').textContent = '↺';
        document.getElementById('cc-btn-text-left').textContent = isJa ? 'やり直す (n)' : 'Choose again (n)';
      }

      const btnStart = document.getElementById('cc-btn-start');
      if (btnStart) {
        btnStart.style.display = 'inline-flex';
        btnStart.className = 'char-btn-action primary';
        document.getElementById('cc-btn-text-start').textContent = isJa ? (this.translate('Yes; start game') || 'はい；ゲームを開始 (y)') : 'Start Game (y)';
        btnStart.focus();
      }
      return;
    }

    // 通常選択画面
    if (confirmView) confirmView.style.display = 'none';
    if (cardsGrid) cardsGrid.style.display = 'grid';
    if (sectionHeader) sectionHeader.style.display = 'flex';

    // セクションタイトル
    const catIcons = { role: '🧙', race: '🧝', gender: '⚧️', align: '⚖️' };
    document.getElementById('cc-category-icon').textContent = catIcons[this.activeTab] || '⚔️';
    document.getElementById('cc-category-title').textContent = isJa ? this.translate(this.currentPrompt) : this.currentPrompt;
    document.getElementById('cc-category-hint').textContent = isJa ? 'キーボードの各キーまたはカードクリックで選択' : 'Choose by hotkey or clicking card';

    // ボタン設定
    const btnLeft = document.getElementById('cc-btn-left');
    if (btnLeft) {
      btnLeft.className = 'char-btn-action random-btn';
      document.getElementById('cc-btn-icon-left').textContent = '🎲';
      document.getElementById('cc-btn-text-left').textContent = isJa ? (this.translate('Random') + ' (*)') : 'Random (*)';
    }

    const btnStart = document.getElementById('cc-btn-start');
    if (btnStart) {
      btnStart.style.display = 'none';
    }

    // カード生成
    if (cardsGrid) {
      cardsGrid.innerHTML = '';
      this.currentItems.forEach(item => {
        // 1. identifier が正の整数でないものは除外（ヘッダ=0, Quit=-1, Random=-2, ジャンプ=-3..-8）
        if (!item.identifier || item.identifier <= 0 || item.isSelectable === false) {
          return;
        }

        const rawText = (item.rawStr || item.str || item.text || '').trim();
        const acc = this.getItemAcc(item);
        if (!acc) return;

        // 2. システムコマンドキー除外
        if (['?', '/', '"', '[', '~', '*', 'q', 'Q'].includes(acc)) {
          return;
        }

        // 3. テキストパターン除外（システム行、制約行、Quit、Random、フィルタ）
        const lower = rawText.toLowerCase();
        if (lower.startsWith('pick ') || lower.includes('forces') || lower.includes('filtering') || lower === 'quit' || lower === 'random' || lower.includes('<role>')) {
          return;
        }

        const card = document.createElement('div');
        card.className = 'char-choice-card';
        card.onclick = () => this.onCardClick(item);

        const iconMap = this.icons[this.activeTab === 'role' ? 'roles' : 
                                   this.activeTab === 'race' ? 'races' : 
                                   this.activeTab === 'gender' ? 'genders' : 'alignments'] || {};
        const cleanKey = rawText.replace(/^(an?|the)\s+/i, '').replace(/[\/\s]/g, '_').toLowerCase();
        let icon = '✨';
        for (const [k, v] of Object.entries(iconMap)) {
          if (k.toLowerCase().includes(cleanKey) || cleanKey.includes(k.toLowerCase())) {
            icon = v;
            break;
          }
        }

        const translated = isJa ? this.translate(rawText) : rawText;
        const nameMain = translated;
        const nameSub = (isJa && translated !== rawText) ? rawText : '';

        // ナレッジ・バッジ・説明文の取得
        const badges = getCharacterBadges(this.activeTab, rawText, isJa ? 'ja' : 'en');
        let knowledge = null;
        if (this.activeTab === 'role') {
          knowledge = getRoleKnowledge(rawText);
        } else if (this.activeTab === 'race') {
          knowledge = getRaceKnowledge(rawText);
        } else if (this.activeTab === 'gender') {
          knowledge = getGenderKnowledge(rawText);
        } else if (this.activeTab === 'align') {
          knowledge = getAlignmentKnowledge(rawText);
        }

        const descText = knowledge?.description ? (isJa ? knowledge.description.ja : knowledge.description.en) : '';

        // ツールチップ用テキストの構築
        const tooltipLines = [];
        if (descText) tooltipLines.push(descText);

        if (this.activeTab === 'role' && knowledge) {
          if (knowledge.allowedRaces) {
            const racesStr = knowledge.allowedRaces.map(r => this.translate(r)).join(', ');
            tooltipLines.push(isJa ? `【選択可能種族】${racesStr}` : `[Allowed Races] ${racesStr}`);
          }
          if (knowledge.allowedAlignments) {
            const alignsStr = knowledge.allowedAlignments.map(a => this.translate(a)).join(', ');
            tooltipLines.push(isJa ? `【選択可能属性】${alignsStr}` : `[Allowed Alignments] ${alignsStr}`);
          }
        } else if (this.activeTab === 'race' && knowledge) {
          if (knowledge.allowedAlignments) {
            const alignsStr = knowledge.allowedAlignments.map(a => this.translate(a)).join(', ');
            tooltipLines.push(isJa ? `【選択可能属性】${alignsStr}` : `[Allowed Alignments] ${alignsStr}`);
          }
        }

        if (tooltipLines.length > 0) {
          card.title = tooltipLines.join('\n');
        }

        // 選択中判定（部分一致による 'female'.includes('male') バグを防止）
        let isSelected = false;
        const currentConfigVal = this.selectedConfig[this.activeTab];
        if (currentConfigVal) {
          if (this.activeTab === 'gender') {
            isSelected = resolveGenderKey(rawText, '') === resolveGenderKey(currentConfigVal, '');
          } else if (this.activeTab === 'align') {
            isSelected = resolveAlignmentKey(rawText, '') === resolveAlignmentKey(currentConfigVal, '');
          } else if (this.activeTab === 'race') {
            isSelected = resolveRaceKey(rawText, '') === resolveRaceKey(currentConfigVal, '');
          } else if (this.activeTab === 'role') {
            isSelected = resolveRoleKey(rawText, '') === resolveRoleKey(currentConfigVal, '');
          }
        }

        if (isSelected) {
          card.classList.add('selected');
        }

        const badgesHtml = badges.length > 0 ? `
          <div class="char-card-badges">
            ${badges.map(b => `<span class="char-badge ${b.type}">${b.label}</span>`).join('')}
          </div>
        ` : '';

        const descHtml = descText ? `<div class="char-card-desc">${descText}</div>` : '';

        card.innerHTML = `
          <div class="char-card-header-row">
            <span class="char-card-acc">${acc}</span>
            <span class="char-card-icon">${icon}</span>
          </div>
          <div class="char-card-name-main">${nameMain}</div>
          ${nameSub ? `<div class="char-card-name-sub">${nameSub}</div>` : ''}
          ${badgesHtml}
          ${descHtml}
        `;
        cardsGrid.appendChild(card);
      });
    }
  }

  /**
   * カード選択ハンドラ
   */
  onCardClick(item) {
    const core = this.getCore();
    if (!core) return;
    if (item.identifier !== undefined && item.identifier !== 0) {
      core.respond([{ identifier: item.identifier, count: -1 }]);
    } else if (item.accelerator) {
      core.respond(item.accelerator);
    } else if (item.ch) {
      core.respond(typeof item.ch === 'number' ? String.fromCharCode(item.ch) : item.ch);
    }
  }

  /**
   * タブクリックハンドラ（動的ジャンプ解決）
   */
  onTabClick(tab) {
    if (this.activeTab === tab) return; // すでに開いている画面
    const core = this.getCore();
    if (!core) return;

    // 現在のメニュー項目の中から、目的のタブへのジャンプ項目を探す
    const jumpItem = this.findJumpItemForTab(tab);
    if (jumpItem) {
      this.onCardClick(jumpItem);
    } else {
      console.warn(`[CharacterCreationModal] No valid jump option in menu for tab: ${tab}`);
    }
  }

  /**
   * おまかせ選択 (*)
   */
  onPickRandom() {
    const core = this.getCore();
    if (core) core.respond('*');
  }

  /**
   * やり直し (n)
   */
  onChooseAgain() {
    const core = this.getCore();
    if (core) core.respond('n');
  }

  /**
   * 開始決定 (y)
   */
  onConfirmStart() {
    const core = this.getCore();
    if (core) {
      this.isCompleted = true;
      core.respond('y');
      this.hide();
    }
  }

  /**
   * キーボードイベントハンドラ
   */
  handleKeyDown(e) {
    if (!this.isVisible) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    // Step 13 (最終確認) のキーボード処理
    if (this.activeTab === 'confirm') {
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.onChooseAgain();
      } else if (e.key === 'y' || e.key === 'Y' || e.key === 'Enter') {
        e.preventDefault();
        this.onConfirmStart();
      } else if (e.key === 'q' || e.key === 'Q' || e.key === 'Escape') {
        e.preventDefault();
        const core = this.getCore();
        if (core) core.respond('q');
        this.hide();
      }
      return;
    }

    // 通常ステップのタブ切替キー
    if (e.key === '?') { e.preventDefault(); this.onTabClick('role'); }
    else if (e.key === '/') { e.preventDefault(); this.onTabClick('race'); }
    else if (e.key === '"') { e.preventDefault(); this.onTabClick('gender'); }
    else if (e.key === '[') { e.preventDefault(); this.onTabClick('align'); }
    else if (e.key === '*') { e.preventDefault(); this.onPickRandom(); }
    else {
      // 選択肢キー判定
      const matched = this.currentItems.find(i => (i.accelerator || String.fromCharCode(i.ch || 0)) === e.key);
      if (matched) {
        e.preventDefault();
        this.onCardClick(matched);
      }
    }
  }
}
