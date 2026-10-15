/**
 * @file DomEventBinder.js
 * @description GKL Pure JS Client の各種 DOM 要素イベント（ボタン、HUD、リサイズ、グローバルキー等）の結線
 */

export class DomEventBinder {
  /**
   * DOM イベントを GklPureJSClient インスタンスへバインド
   * @param {Object} client - GklPureJSClient インスタンス
   */
  static bind(client) {
    if (client.btnToggleView) {
      client.btnToggleView.onclick = () => {
        client.cycleViewMode();
      };
    }

    if (client.btnToggleCameraMode) {
      client.btnToggleCameraMode.onclick = () => {
        client.toggleCameraMode();
      };
    }

    if (client.btnToggleMinimap) {
      client.btnToggleMinimap.onclick = () => {
        client.minimapRenderer.toggleVisibility();
        const isEn = client.currentLanguage === 'en';
        const prefix = isEn ? '🗺️ Minimap HUD: ' : '🗺️ ミニマップ HUD: ';
        client.btnToggleMinimap.textContent = prefix + (client.minimapRenderer.isVisible ? 'ON' : 'OFF');
      };
    }

    const btnToggleDebugHud = document.getElementById('btn-toggle-debug-hud');
    if (btnToggleDebugHud) {
      btnToggleDebugHud.onclick = () => {
        if (!client.webgpuRenderer) return;
        const hud = client.webgpuRenderer.debugHudElement || document.getElementById('webgpu-debug-hud');
        if (!hud) return;
        const isCurrentlyVisible = hud.style.display !== 'none';
        hud.style.display = isCurrentlyVisible ? 'none' : 'block';
        const isEn = client.currentLanguage === 'en';
        const prefix = isEn ? '📊 HD-2D Debug HUD: ' : '📊 HD-2D デバッグHUD: ';
        btnToggleDebugHud.textContent = prefix + (!isCurrentlyVisible ? 'ON' : 'OFF');
      };
    }

    if (client.btnSettingsToggle && client.settingsDropdown) {
      client.btnSettingsToggle.onclick = (e) => {
        e.stopPropagation();
        client.settingsDropdown.classList.toggle('hidden');
      };

      // メニュー項目クリック時に自動で閉じる
      client.settingsDropdown.addEventListener('click', (e) => {
        if (e.target.closest('.btn-menu-item') || e.target.closest('.btn-preset-item')) {
          client.settingsDropdown.classList.add('hidden');
        }
      });

      // 外側クリックで閉じる
      document.addEventListener('click', (e) => {
        if (!client.settingsDropdown.classList.contains('hidden') &&
            !client.settingsDropdown.contains(e.target) &&
            e.target !== client.btnSettingsToggle) {
          client.settingsDropdown.classList.add('hidden');
        }
      });

      // Escキーで閉じる
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !client.settingsDropdown.classList.contains('hidden')) {
          client.settingsDropdown.classList.add('hidden');
        }
      });
    }

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.onclick = () => client.restartGame();

    const btnDeleteSave = document.getElementById('btn-delete-save');
    if (btnDeleteSave) btnDeleteSave.onclick = () => client.deleteSaveFile();

    const btnGameoverRestart = document.getElementById('btn-gameover-restart');
    if (btnGameoverRestart) btnGameoverRestart.onclick = () => client.restartGame();

    const elStatusBar = document.getElementById('status-bar');
    if (elStatusBar) {
      elStatusBar.addEventListener('click', (e) => {
        const spellBtn = e.target.closest('.gkl-spell-badge');
        if (spellBtn) {
          e.stopPropagation();
          const letter = spellBtn.dataset.letter;
          if (letter) client.statusView.castSpell(letter);
          return;
        }

        const skillBtn = e.target.closest('.gkl-skill-badge');
        if (skillBtn) {
          e.stopPropagation();
          const skillKey = skillBtn.dataset.skill;
          client.statusView.enhanceSkill(skillKey);
          return;
        }

        elStatusBar.classList.toggle('is-expanded');
        const isExpanded = elStatusBar.classList.contains('is-expanded');
        if (isExpanded && client.core?.gkl) {
          if (typeof client.core.gkl.syncAttributesOnDemand === 'function') {
            client.core.gkl.syncAttributesOnDemand();
          }
          if (typeof client.core.gkl.syncSkillsOnDemand === 'function') {
            client.core.gkl.syncSkillsOnDemand();
          }
        }
      });
    }

    const btnOpenPaperdoll = document.getElementById('btn-open-paperdoll');
    if (btnOpenPaperdoll) {
      btnOpenPaperdoll.onclick = () => {
        client.paperdollModal.toggle();
      };
    }

    const btnOpenCodex = document.getElementById('btn-open-codex');
    if (btnOpenCodex) {
      btnOpenCodex.onclick = () => {
        if (client.codexModal) {
          client.codexModal.open();
        }
      };
    }

    const btnRefreshInv = document.getElementById('btn-refresh-inv');
    if (btnRefreshInv) {
      btnRefreshInv.onclick = async () => {
        if (client.core && client.core.gkl && typeof client.core.gkl.syncInventorySilent === 'function') {
          btnRefreshInv.disabled = true;
          btnRefreshInv.textContent = '...';
          await client.core.gkl.syncInventorySilent();
          btnRefreshInv.disabled = false;
          btnRefreshInv.textContent = client.currentLanguage === 'en' ? '🔄 Sync' : '🔄 同期';
        }
      };
    }

    const btnCastSpellMenu = document.getElementById('btn-cast-spell-menu');
    if (btnCastSpellMenu) {
      btnCastSpellMenu.onclick = () => {
        client.statusView.castSpell();
      };
    }

    const tabBtnAdvices = document.getElementById('tab-btn-advices');
    if (tabBtnAdvices) {
      tabBtnAdvices.onclick = () => {
        client.userPreferredTab = 'advices';
        client.knowledgeView.userPreferredTab = 'advices';
        client.knowledgeView.switchBottomTab('advices');
      };
    }

    const tabBtnKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabBtnKnowledge) {
      tabBtnKnowledge.onclick = () => {
        client.userPreferredTab = 'knowledge';
        client.knowledgeView.userPreferredTab = 'knowledge';
        client.knowledgeView.switchBottomTab('knowledge', client.lastKnowledgeTarget);
      };
    }

    // 🖥️ 全画面ウィンドウリサイズ追従 (Canvas 2D / WebGPU 解像度同期)
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (client.mainViewportRenderer && typeof client.mainViewportRenderer.resize === 'function') {
        client.mainViewportRenderer.resize(w, h);
      }
      if (client.webgpuRenderer && typeof client.webgpuRenderer.resize === 'function') {
        client.webgpuRenderer.resize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    window.addEventListener('keydown', (e) => {
      if (client.isStartingUp && client.startupStep === 'READY') {
        if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) return;
        e.preventDefault();
        e.stopPropagation();
        client.completeStartup(e.code || e.key);
        return;
      }

      if (!e.ctrlKey && !e.altKey && !['Escape', 'Tab', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) {
        client.floatingMessageHud?.notifyUserAction();
      }

      client.keyHandler.handleGlobalKeyDown(e);
    });
  }
}
