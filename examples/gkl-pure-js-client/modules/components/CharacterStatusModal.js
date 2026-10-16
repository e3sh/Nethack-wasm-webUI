/**
 * CharacterStatusModal.js
 *
 * オンデマンド取得型キャラクター詳細ダイアログ (On-Demand Direct Binding Sheet)。
 * Dark Glass UI（modals.css 準拠）で構築され、ダイアログを開いた瞬間に
 * NetHack C コア構造体メモリ（Direct Binding: 0x33 プロファイル、0x32 耐性、0x70 呪文、0x71 スキル）
 * および GKL StateManager から最新データを一括取得して描画する。
 */

import { ALIGNMENT_NAMES_JA, ALIGNMENT_NAMES_EN } from '../../../../src/core/knowledge/services/binding/BindingConstants.js';

export class CharacterStatusModal {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.elModal] - モーダル外枠DOM
   * @param {Function} options.getCore - WebUICore取得関数
   * @param {Function} [options.onCastSpell] - 呪文詠唱コールバック
   * @param {Function} [options.onEnhanceSkill] - スキル向上コールバック
   * @param {string} [options.language='ja'] - 言語 ('ja' | 'en')
   */
  constructor(options = {}) {
    this.options = options;
    this.elModal = options.elModal || (typeof document !== 'undefined' ? document.getElementById('character-status-modal') : null);
    this.getCore = options.getCore || (() => null);
    this.onCastSpell = options.onCastSpell || null;
    this.onEnhanceSkill = options.onEnhanceSkill || null;
    this.currentLanguage = options.language === 'en' ? 'en' : 'ja';
    this.isVisible = false;
    this.isSyncing = false;

    this._ensureDom();

    // <nh-modal> 外枠との連携 (存在する場合)
    this.nhModal = (this.elModal && this.elModal.closest)
      ? this.elModal.closest('nh-modal')
      : (typeof document !== 'undefined' ? document.getElementById('nh-modal-char-status') : null);

    if (this.nhModal && typeof this.nhModal.addEventListener === 'function') {
      this.nhModal.addEventListener('nh-modal-close', () => {
        if (this.isVisible) this.close();
      });
    }
  }

  _ensureDom() {
    if (typeof document === 'undefined') return;

    if (!this.elModal) {
      let modal = document.getElementById('character-status-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'character-status-modal';
        modal.className = 'modal-backdrop hidden';
        document.body.appendChild(modal);
      }
      this.elModal = modal;
    }

    // 外枠クリックで閉じる
    if (this.elModal && typeof this.elModal.addEventListener === 'function') {
      this.elModal.addEventListener('click', (e) => {
        if (e.target === this.elModal) {
          this.close();
        }
      });
    }
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
   * モーダルを開き、Direct Binding から最新データをオンデマンド取得
   */
  async open() {
    this.isVisible = true;
    if (this.elModal) {
      this.elModal.classList.remove('hidden');
    }

    // 開いた瞬間に不可分同期（On-Demand Direct Binding 同期）
    await this.syncLatestData();
    this.render();
  }

  show() {
    return this.open();
  }

  /**
   * モーダルを閉じる
   */
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
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Cコアおよび GKL から最新状態をオンデマンド取得
   */
  async syncLatestData() {
    const core = this.getCore();
    if (!core || !core.gkl) return;

    this.isSyncing = true;
    try {
      const gkl = core.gkl;
      const tasks = [];
      if (typeof gkl.syncAttributesOnDemand === 'function') {
        tasks.push(gkl.syncAttributesOnDemand());
      }
      if (typeof gkl.syncSkillsOnDemand === 'function') {
        tasks.push(gkl.syncSkillsOnDemand());
      }
      if (typeof gkl.syncSpellsOnDemand === 'function') {
        tasks.push(gkl.syncSpellsOnDemand());
      }
      await Promise.allSettled(tasks);
    } catch (e) {
      console.warn('[CharacterStatusModal] syncLatestData error:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * キャラクター詳細画面を描画
   */
  render() {
    if (!this.elModal) return;
    const isEn = this.currentLanguage === 'en';
    const core = this.getCore();
    const gkl = core?.gkl;

    const status = (core && typeof core.getStatus === 'function') ? core.getStatus() : (gkl?.getStatus?.() || {});
    const attrManager = gkl?.getAttributeStateManager?.();
    const spellManager = gkl?.getSpellStateManager?.();
    const skillManager = gkl?.getSkillStateManager?.();

    // 1. プロファイル情報の集約
    const summary = attrManager?.getCharacterSummary?.(this.currentLanguage) || {};
    const playerName = summary.playerName || status.title || (isEn ? 'Hero' : '勇者');
    const roleName = summary.roleName || (isEn ? 'Unknown' : '不明');
    const raceName = summary.raceName || (isEn ? 'Unknown' : '不明');
    const genderName = summary.gender === 'female' ? (isEn ? 'Female' : '女性') : (isEn ? 'Male' : '男性');
    const alignName = summary.alignName || (status.align ? (isEn ? ALIGNMENT_NAMES_EN[status.align.toLowerCase()] || status.align : ALIGNMENT_NAMES_JA[status.align.toLowerCase()] || status.align) : (isEn ? 'Neutral' : '中立'));
    const level = summary.level || status.level || 1;
    const expText = status.hasExp && status.exp ? `${level} / ${status.exp}` : `${level}`;
    const dlvlText = status.dlevel?.text || (isEn ? 'Dlvl:1' : '地下1階');
    const turnsText = status.turns !== undefined ? String(status.turns) : '0';
    const scoreText = status.score !== undefined ? String(status.score) : '0';
    const hpText = status.hp ? `${status.hp.current} / ${status.hp.max}` : '--';
    const pwText = status.pw ? `${status.pw.current} / ${status.pw.max}` : '--';
    const acText = status.ac !== undefined ? String(status.ac) : '10';
    const goldText = status.gold ? `$${status.gold.amount}` : '$0';

    // 2. 6大能力値
    const stats = status.stats || {};
    const strVal = stats.str !== undefined ? stats.str : '--';
    const dexVal = stats.dex !== undefined ? stats.dex : '--';
    const conVal = stats.con !== undefined ? stats.con : '--';
    const intVal = stats.int !== undefined ? stats.int : '--';
    const wisVal = stats.wis !== undefined ? stats.wis : '--';
    const chaVal = stats.cha !== undefined ? stats.cha : '--';

    // 3. 獲得耐性・特性 (Active Resistances)
    const activeRes = attrManager?.getActiveResistances?.(this.currentLanguage) || [];

    // 4. 修得呪文 (Spells)
    const spells = spellManager?.getSpells?.() || [];

    // 5. スキル熟練度 (Skills)
    const allSkills = skillManager?.getSkills?.() || [];
    const activeSkills = allSkills.filter(s => s && !s.isRestricted && (s.skillLevel > 0 || s.canEnhance || (s.rank && s.rank.key !== 'unskilled')));

    // HTMLの構築
    this.elModal.innerHTML = `
      <div class="char-status-modal-card">
        <!-- ヘッダー -->
        <div class="char-status-header">
          <div class="char-status-title-group">
            <h2 class="char-status-title">
              <span>👤</span>
              <span>${isEn ? 'Character Profile & Status' : 'キャラクター詳細 ＆ 属性情報'}</span>
            </h2>
            <span class="char-status-tag-badge">${summary.displayTag || `👤 ${raceName} / ${roleName} Lv.${level}`}</span>
          </div>
          <button id="btn-char-status-close" class="modal-close-btn" title="${isEn ? 'Close (Esc / q)' : '閉じる (Esc / q)'}">✕</button>
        </div>

        <!-- スクロールボディ -->
        <div class="char-status-body">
          <!-- セクション 1: 冒険者基本プロフィール -->
          <div class="char-status-section">
            <div class="char-status-section-title">
              <span>📜</span>
              <span>${isEn ? 'Adventurer Identity' : '冒険者プロフィール'}</span>
            </div>
            <div class="char-profile-grid">
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Name' : '名前'}</span>
                <span class="value">${playerName}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Role' : '職業 (Role)'}</span>
                <span class="value">${roleName}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Race' : '種族 (Race)'}</span>
                <span class="value">${raceName}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Gender' : '性別'}</span>
                <span class="value">${genderName}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Alignment' : '属性'}</span>
                <span class="value">${alignName}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Level / Exp' : 'レベル / 経験値'}</span>
                <span class="value">Lv.${expText}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Location' : '現在地'}</span>
                <span class="value">${dlvlText}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'HP' : 'ヒットポイント'}</span>
                <span class="value" style="color:#ef4444;">${hpText}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Power (MP)' : '魔力 (Pw)'}</span>
                <span class="value" style="color:#38bdf8;">${pwText}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Armor Class' : 'AC (防御力)'}</span>
                <span class="value" style="color:#c084fc;">${acText}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Gold' : '所持ゴールド'}</span>
                <span class="value" style="color:#fbbf24;">${goldText}</span>
              </div>
              <div class="char-profile-item">
                <span class="label">${isEn ? 'Turns / Score' : '経過ターン / スコア'}</span>
                <span class="value">T:${turnsText} (${scoreText}pts)</span>
              </div>
            </div>
          </div>

          <!-- セクション 2: 6大基本能力値 -->
          <div class="char-status-section">
            <div class="char-status-section-title">
              <span>💪</span>
              <span>${isEn ? 'Attributes (Base Stats)' : '6大基本能力値'}</span>
            </div>
            <div class="char-stats-grid">
              <div class="char-stat-card">
                <div class="stat-name">St (腕力)</div>
                <div class="stat-val">${strVal}</div>
              </div>
              <div class="char-stat-card">
                <div class="stat-name">Dx (敏捷)</div>
                <div class="stat-val">${dexVal}</div>
              </div>
              <div class="char-stat-card">
                <div class="stat-name">Co (体力)</div>
                <div class="stat-val">${conVal}</div>
              </div>
              <div class="char-stat-card">
                <div class="stat-name">In (知力)</div>
                <div class="stat-val">${intVal}</div>
              </div>
              <div class="char-stat-card">
                <div class="stat-name">Wi (知恵)</div>
                <div class="stat-val">${wisVal}</div>
              </div>
              <div class="char-stat-card">
                <div class="stat-name">Ch (魅力)</div>
                <div class="stat-val">${chaVal}</div>
              </div>
            </div>
          </div>

          <!-- セクション 3: 獲得耐性・特性 (Intrinsics & Extrinsics) -->
          <div class="char-status-section">
            <div class="char-status-section-title">
              <span>🛡️</span>
              <span>${isEn ? 'Acquired Resistances & Intrinsics' : '獲得耐性・特性一覧'}</span>
            </div>
            <div class="char-res-container">
              ${activeRes.length === 0
                ? `<span class="char-empty-hint">${isEn ? 'No special resistances detected.' : '現在有効な属性耐性・特性はありません。'}</span>`
                : activeRes.map(item => {
                    const src = item.source || 'intrinsic';
                    const icon = src === 'both' ? '✨' : (src === 'extrinsic' ? '🛡️' : '🧬');
                    const srcLabel = src === 'both' ? (isEn ? 'Innate + Equipped' : '内在+装備') : (src === 'extrinsic' ? (isEn ? 'Equipped' : '装備由来') : (isEn ? 'Innate' : '内在'));
                    const titleText = isEn
                      ? `${item.en || item.name} [${srcLabel}]`
                      : `${item.label || item.name} [${srcLabel}]`;
                    return `
                      <span class="char-res-badge source-${src}" title="${titleText}">
                        <span class="source-icon">${icon}</span>
                        <span>${isEn ? (item.en || item.name) : (item.label || item.name)}</span>
                      </span>
                    `;
                  }).join('')
              }
            </div>
          </div>

          <!-- セクション 4: 修得呪文 (Spells) -->
          <div class="char-status-section">
            <div class="char-status-section-title">
              <span>✨</span>
              <span>${isEn ? 'Learned Spells' : '修得呪文一覧'}</span>
            </div>
            <div class="char-spells-container">
              ${spells.length === 0
                ? `<span class="char-empty-hint">${isEn ? 'No spells memorized.' : '修得している呪文はありません。'}</span>`
                : spells.map(sp => {
                    const failRate = sp.failRate || '0%';
                    const retentionStr = sp.retention !== undefined && sp.retention !== '' ? `${isEn ? 'Know:' : '記憶:'} ${sp.retention}T` : '';
                    const spellName = isEn ? sp.name : (sp.nameJa || sp.name);
                    return `
                      <div class="char-spell-row">
                        <div class="char-spell-info">
                          <span class="char-spell-letter">[${sp.letter}]</span>
                          <span class="char-spell-name">${spellName}</span>
                          <span class="char-spell-meta">Lv.${sp.level} ${sp.category} (Fail: ${failRate}) ${retentionStr}</span>
                        </div>
                        <button class="char-spell-cast-btn" data-letter="${sp.letter}">${isEn ? 'Cast [Z]' : '詠唱 [Z]'}</button>
                      </div>
                    `;
                  }).join('')
              }
            </div>
          </div>

          <!-- セクション 5: スキル熟練度 (Skills) -->
          <div class="char-status-section">
            <div class="char-status-section-title">
              <span>🥋</span>
              <span>${isEn ? 'Weapon & Martial Skills' : '武器・武術スキル熟練度'}</span>
            </div>
            <div class="char-skills-container">
              ${activeSkills.length === 0
                ? `<span class="char-empty-hint">${isEn ? 'No trained skills.' : '習得・訓練済みのスキルはありません。'}</span>`
                : activeSkills.map(sk => {
                    const rankKey = sk.rank?.key || 'basic';
                    const rankLabel = isEn ? (sk.rank?.en || 'Basic') : (sk.rank?.label || '入門');
                    const skillName = isEn ? (sk.name || sk.nameRaw) : (sk.nameJa || sk.name);
                    const canEnhance = Boolean(sk.canEnhance);
                    return `
                      <div class="char-skill-item">
                        <span class="char-skill-name">${skillName}</span>
                        <div style="display:flex; align-items:center;">
                          <span class="char-skill-rank-badge rank-${rankKey}">${rankLabel}</span>
                          ${canEnhance ? `<button class="char-skill-enhance-btn" data-letter="${sk.letter || ''}" title="${isEn ? 'Enhance this skill' : 'スキルを向上'}">⭐ ${isEn ? 'Enhance' : '向上'}</button>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')
              }
            </div>
          </div>
        </div>
      </div>
    `;

    // 閉じるボタンのイベント
    const btnClose = this.elModal.querySelector('#btn-char-status-close');
    if (btnClose) {
      const handleClose = () => this.close();
      btnClose.onclick = handleClose;
      if (typeof btnClose.addEventListener === 'function') {
        btnClose.addEventListener('click', handleClose);
      }
    }

    // 呪文詠唱ボタンのイベント
    this.elModal.querySelectorAll('.char-spell-cast-btn').forEach(btn => {
      const handleCast = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const letter = btn.dataset.letter;
        this.close();
        if (this.onCastSpell) {
          this.onCastSpell(letter);
        } else if (core?.gkl?.castSpell) {
          core.gkl.castSpell(letter);
        } else if (core?.sendKey) {
          core.sendKey('Z');
        }
      };
      btn.onclick = handleCast;
      if (typeof btn.addEventListener === 'function') {
        btn.addEventListener('click', handleCast);
      }
    });

    // スキル向上ボタンのイベント
    this.elModal.querySelectorAll('.char-skill-enhance-btn').forEach(btn => {
      const handleEnhance = (e) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const letter = btn.dataset.letter;
        this.close();
        if (this.onEnhanceSkill) {
          this.onEnhanceSkill(letter);
        } else if (core?.gkl?.enhanceSkill) {
          core.gkl.enhanceSkill(letter);
        } else if (core?.sendKey) {
          core.sendKey('#');
        }
      };
      btn.onclick = handleEnhance;
      if (typeof btn.addEventListener === 'function') {
        btn.addEventListener('click', handleEnhance);
      }
    });
  }
}
