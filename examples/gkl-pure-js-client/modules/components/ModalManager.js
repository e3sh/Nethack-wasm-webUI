/**
 * ModalManager - プロンプトバー、メニュー/テキストモーダル、ローディング、ゲームオーバー、スコアボードマネージャー
 */
export class ModalManager {
  constructor({
    elPromptBar,
    elPromptText,
    elInputControls,
    elMenuModal,
    elMenuTitle,
    elMenuItemsContainer,
    elBtnCancelMenu,
    elGameOverModal,
    elGameOverSummary,
    elScoreboardContainer,
    elLoading,
    elSpinnerBox,
    elSelectorCard,
    elSaveName,
    getCore,
    getLoadedTileImagePath,
    onRestartGame
  }) {
    this.elPromptBar = elPromptBar;
    this.elPromptText = elPromptText;
    this.elInputControls = elInputControls;

    this.elMenuModal = elMenuModal;
    this.elMenuTitle = elMenuTitle;
    this.elMenuItemsContainer = elMenuItemsContainer;
    this.elBtnCancelMenu = elBtnCancelMenu;

    this.elGameOverModal = elGameOverModal;
    this.elGameOverSummary = elGameOverSummary;
    this.elScoreboardContainer = elScoreboardContainer;

    this.elLoading = elLoading;
    this.elSpinnerBox = elSpinnerBox;
    this.elSelectorCard = elSelectorCard;
    this.elSaveName = elSaveName;

    this.getCore = getCore || (() => null);
    this.getLoadedTileImagePath = getLoadedTileImagePath || (() => '../../pict/nethack_default_32.png');
    this.onRestartGame = onRestartGame || (() => {});

    this.currentLanguage = 'ja';
    this.isTextWindowMode = false;
    this.isGameExited = false;
    this.isDirectionPromptActive = false;
    this.activeMenuFocusIndex = 0;
    this.selectableMenuButtons = [];
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
  }

  reset() {
    this.isGameExited = false;
    this.isTextWindowMode = false;
    this.isDirectionPromptActive = false;
    this.activeMenuFocusIndex = 0;
    this.selectableMenuButtons = [];
    this.clearAllModals();
    if (this.elGameOverModal) this.elGameOverModal.classList.add('hidden');
    if (this.elSelectorCard) this.elSelectorCard.classList.add('hidden');
  }

  handleInputRequired(data) {
    this.clearAllModals();
    if (this.isGameExited) return;

    const category = data.category || data.promptCategory || 'OTHER';
    const rawPrompt = data.prompt || data.message || data.question || '';
    const items = data.menuItems || data.items || [];
    const textLines = data.lines || [];
    const core = this.getCore();

    if (textLines && textLines.length > 0) {
      this.isTextWindowMode = true;
      if (this.elMenuModal) this.elMenuModal.classList.remove('hidden');
      if (this.elMenuTitle) this.elMenuTitle.textContent = rawPrompt || 'Information';
      if (this.elMenuItemsContainer) {
        this.elMenuItemsContainer.innerHTML = '';
        textLines.forEach(lineText => {
          const lineDiv = document.createElement('div');
          lineDiv.className = 'text-window-line';
          lineDiv.textContent = lineText;
          this.elMenuItemsContainer.appendChild(lineDiv);
        });
      }

      if (this.elBtnCancelMenu) {
        this.elBtnCancelMenu.textContent = '閉じる / 次へ (Space)';
        this.elBtnCancelMenu.onclick = () => core && core.sendKey('Space');
      }
      return;
    }

    if (category === 'MENU' || (items && items.length > 0)) {
      this.isTextWindowMode = false;
      if (this.elMenuModal) this.elMenuModal.classList.remove('hidden');
      if (this.elMenuTitle) this.elMenuTitle.textContent = rawPrompt || 'Select Item (↑↓ / Enter)';
      if (this.elMenuItemsContainer) this.elMenuItemsContainer.innerHTML = '';
      this.selectableMenuButtons = [];
      this.activeMenuFocusIndex = 0;

      items.forEach((item) => {
        const itemText = item.str || item.text || (typeof item === 'string' ? item : '');
        if (item.isSelectable === false) {
          if (this.elMenuItemsContainer) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'menu-header-item';
            headerDiv.textContent = itemText;
            this.elMenuItemsContainer.appendChild(headerDiv);
          }
          return;
        }

        const btn = document.createElement('button');
        btn.className = 'menu-item-btn';
        const chStr = item.charStr || (item.ch ? String.fromCharCode(item.ch) : '');
        const badgeHtml = chStr ? `<strong style="color:var(--accent-gold);">${chStr})</strong>` : '';
        
        const glyphId = item.glyph !== undefined ? item.glyph : (item.glyphInfo ? item.glyphInfo.glyph : -1);
        const tileImgPath = this.getLoadedTileImagePath() || '../../assets/nethack_default_32.png';
        const glyphHtml = (glyphId >= 0 && core && typeof core.getGlyphHtml === 'function')
          ? core.getGlyphHtml(glyphId, { displaySize: 18, tileImage: tileImgPath })
          : '';

        btn.innerHTML = `${badgeHtml} ${glyphHtml} <span>${itemText}</span>`;

        btn.onclick = () => {
          const val = (item.identifier !== undefined && item.identifier !== 0) ? [{ identifier: item.identifier, count: -1 }] : (item.ch || item.accelerator || itemText);
          if (core) core.respond(val);
        };

        this.selectableMenuButtons.push(btn);
        if (this.elMenuItemsContainer) this.elMenuItemsContainer.appendChild(btn);
      });

      this.updateMenuFocus();
      if (this.elBtnCancelMenu) {
        this.elBtnCancelMenu.textContent = 'Cancel (ESC / 0)';
        this.elBtnCancelMenu.onclick = () => core && core.respond(0);
      }
      return;
    }

    const isLineText = data.inputType === 'LINE_TEXT' || 
                       category === 'TEXT' || 
                       category === 'ASKNAME' || 
                       category === 'FILE' || 
                       category === 'EXTCMD' || 
                       category === 'LINE' || 
                       data.context === 'getlin' || 
                       data.context === 'get_ext_cmd' || 
                       data.context === 'text' || 
                       data.context === 'extcmd';

    if (isLineText) {
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      const promptTitle = data.promptText || data.title || rawPrompt || 'Enter text:';
      if (this.elPromptText) this.elPromptText.textContent = promptTitle;
      if (this.elInputControls) {
        this.elInputControls.innerHTML = `
          <input type="text" id="prompt-text-input" placeholder="Type here..." />
          <button id="btn-submit-text">OK</button>
        `;

        const inputEl = document.getElementById('prompt-text-input');
        const submitBtn = document.getElementById('btn-submit-text');

        const submitAction = () => {
          const val = inputEl.value;
          if (core) core.respond(val);
        };

        if (submitBtn) submitBtn.onclick = submitAction;
        if (inputEl) {
          inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitAction();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              if (core) {
                if (typeof core.cancelPrompt === 'function') {
                  core.cancelPrompt();
                } else {
                  core.respond('\x1b');
                }
              }
            }
          };
          setTimeout(() => inputEl.focus(), 50);
        }
      }
      return;
    }

    if (data.inputType === 'DIRECTION' || category === 'DIRECTION') {
      this.isDirectionPromptActive = true;
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      const isEn = this.currentLanguage === 'en';
      const promptTitle = data.promptText || data.title || rawPrompt || (isEn ? 'In what direction?' : 'どの方向に？');
      if (this.elPromptText) this.elPromptText.textContent = promptTitle;
      if (this.elInputControls) {
        this.elInputControls.innerHTML = `
          <div class="prompt-dir-container">
            <div class="prompt-dir-grid">
              <button class="prompt-dir-btn" data-dir="DIR_NW" title="7 / y (北西)"><span style="font-size:13px; font-weight:bold;">↖</span><span style="font-size:7px; opacity:0.8;">7 / y</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_N"  title="8 / k (北)"><span style="font-size:13px; font-weight:bold;">↑</span><span style="font-size:7px; opacity:0.8;">8 / k</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_NE" title="9 / u (北東)"><span style="font-size:13px; font-weight:bold;">↗</span><span style="font-size:7px; opacity:0.8;">9 / u</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_W"  title="4 / h (西)"><span style="font-size:13px; font-weight:bold;">←</span><span style="font-size:7px; opacity:0.8;">4 / h</span></button>
              <button class="prompt-dir-btn self" data-dir="DIR_SELF" title=". (自身)"><span style="font-size:13px; font-weight:bold;">●</span><span style="font-size:7px; opacity:0.8;">. (自身)</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_E"  title="6 / l (東)"><span style="font-size:13px; font-weight:bold;">→</span><span style="font-size:7px; opacity:0.8;">6 / l</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_SW" title="1 / b (南西)"><span style="font-size:13px; font-weight:bold;">↙</span><span style="font-size:7px; opacity:0.8;">1 / b</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_S"  title="2 / j (南)"><span style="font-size:13px; font-weight:bold;">↓</span><span style="font-size:7px; opacity:0.8;">2 / j</span></button>
              <button class="prompt-dir-btn" data-dir="DIR_SE" title="3 / n (南東)"><span style="font-size:13px; font-weight:bold;">↘</span><span style="font-size:7px; opacity:0.8;">3 / n</span></button>
            </div>
            <div class="prompt-dir-side-actions">
              <button class="prompt-dir-side-btn" data-dir="DIR_UP" title="上階 / 上方向 (<)">▲ ${isEn ? 'Up (<)' : '上方向 (<)'}</button>
              <button class="prompt-dir-side-btn" data-dir="DIR_DOWN" title="下階 / 下方向 (>)>">▼ ${isEn ? 'Down (>)' : '下方向 (>)'}</button>
              <button class="prompt-dir-side-btn cancel" id="btn-cancel-dir" title="取消 (ESC)">✖ ${isEn ? 'Cancel (ESC)' : '取消 (ESC)'}</button>
            </div>
          </div>
        `;

        this.elInputControls.querySelectorAll('button[data-dir]').forEach(btn => {
          btn.onclick = () => {
            if (core) core.respond(btn.dataset.dir);
          };
        });

        const btnCancel = document.getElementById('btn-cancel-dir');
        if (btnCancel) {
          btnCancel.onclick = () => {
            if (core) {
              if (typeof core.cancelPrompt === 'function') {
                core.cancelPrompt();
              } else {
                core.respond('\x1b');
              }
            }
          };
        }
      }

      return;
    }

    if (data.options && data.options.length > 0) {
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      if (this.elPromptText) this.elPromptText.textContent = data.promptText || data.title || rawPrompt || 'Select Option';
      if (this.elInputControls) {
        this.elInputControls.innerHTML = '';
        data.options.forEach(opt => {
          const btn = document.createElement('button');
          btn.textContent = opt.label.includes(`(${opt.key})`) ? opt.label : `${opt.label} (${opt.key})`;
          btn.onclick = () => core && core.respond(opt.key);
          this.elInputControls.appendChild(btn);
        });
      }
      return;
    }

    if (data.inputType === 'SINGLE_KEY' || category === 'YN' || data.context === 'yn_function') {
      if (this.elPromptBar) this.elPromptBar.classList.remove('hidden');
      const promptTitle = data.promptText || data.title || rawPrompt || 'Press key...';
      if (this.elPromptText) this.elPromptText.textContent = promptTitle;
      if (this.elInputControls) {
        this.elInputControls.innerHTML = `
          <span style="font-size:12px; color:var(--text-secondary); padding:4px 8px;">(1キー入力待機 / Press key)</span>
          <button id="btn-cancel-single-key" class="prompt-cancel-btn" style="padding:4px 10px; font-size:11px; margin-left:6px;">✖ 取消 (ESC)</button>
        `;
        const btnCancel = document.getElementById('btn-cancel-single-key');
        if (btnCancel) {
          btnCancel.onclick = () => {
            if (core) {
              if (typeof core.cancelPrompt === 'function') {
                core.cancelPrompt();
              } else {
                core.respond('\x1b');
              }
            }
          };
        }
      }
      return;
    }

    if (this.elPromptBar) this.elPromptBar.classList.add('hidden');
  }

  updateMenuFocus() {
    this.selectableMenuButtons.forEach((btn, index) => {
      if (index === this.activeMenuFocusIndex) {
        btn.classList.add('focus');
        btn.scrollIntoView({ block: 'nearest' });
      } else {
        btn.classList.remove('focus');
      }
    });
  }

  clearAllModals() {
    if (this.elPromptBar) this.elPromptBar.classList.add('hidden');
    if (this.elMenuModal) this.elMenuModal.classList.add('hidden');
    this.isTextWindowMode = false;
  }

  async handleExited(result) {
    this.isGameExited = true;
    this.clearAllModals();

    if (this.elGameOverModal) this.elGameOverModal.classList.remove('hidden');
    
    const titleEl = document.getElementById('gameover-title');
    if (titleEl) {
      titleEl.textContent = 
        result.reason === 'ascended' ? '🎉 ASCENDED!' : (result.reason === 'save_and_exit' ? '💾 Game Saved' : '💀 GAME OVER');
    }

    const deathText = result.translatedDeath || result.deathMessage || result.death || 'Unknown causes';
    const scoreText = result.finalScore !== undefined ? result.finalScore : 0;
    if (this.elGameOverSummary) {
      this.elGameOverSummary.innerHTML = `
        <p><strong>Player:</strong> ${result.playerName || 'Hero'}</p>
        <p><strong>Result:</strong> ${deathText}</p>
        <p><strong>Final Score:</strong> <span style="color:var(--accent-gold); font-size:1.1em;">${scoreText}</span></p>
      `;
    }

    this.renderScoreboard(result.scoreboard || []);
  }

  renderScoreboard(scores) {
    if (!this.elScoreboardContainer) return;
    this.elScoreboardContainer.innerHTML = '';
    if (!scores || scores.length === 0) {
      this.elScoreboardContainer.innerHTML = '<p style="padding:10px; color:#888;">No high score records found.</p>';
      return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';
    table.innerHTML = `
      <thead>
        <tr style="border-bottom: 1px solid #333; color: var(--primary-color);">
          <th style="padding:6px; text-align:left;">#</th>
          <th style="padding:6px; text-align:left;">Score</th>
          <th style="padding:6px; text-align:left;">Name</th>
          <th style="padding:6px; text-align:left;">Death Reason</th>
        </tr>
      </thead>
      <tbody>
        ${scores.map((sc, idx) => `
          <tr style="border-bottom: 1px solid #222;">
            <td style="padding:6px; color:#888;">${idx + 1}</td>
            <td style="padding:6px; color:var(--accent-gold); font-weight:bold;">${sc.points || sc.score || 0}</td>
            <td style="padding:6px;">${sc.name || 'Hero'} (${sc.role || ''})</td>
            <td style="padding:6px; color:#aaa;">${sc.death || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    this.elScoreboardContainer.appendChild(table);
  }
}
