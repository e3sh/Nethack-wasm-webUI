/**
 * AssistHud - 最優先アシストシグナルバー (Level 2 & Level 3) & フロア設備案内 (Landmarks HUD) マネージャー
 */
export class AssistHud {
  constructor({
    elAssistSignalBar,
    elAssistSignalIcon,
    elAssistSignalText,
    elBtnAssistAction,
    elAssistActionLabel,
    elBtnAssistWhy,
    elAssistWhyTooltip,
    elFloorLandmarksHud,
    elLandmarksFloorTag,
    elLandmarksBadgesContainer,
    getCore,
    appendLog
  }) {
    this.elAssistSignalBar = elAssistSignalBar;
    this.elAssistSignalIcon = elAssistSignalIcon;
    this.elAssistSignalText = elAssistSignalText;
    this.elBtnAssistAction = elBtnAssistAction;
    this.elAssistActionLabel = elAssistActionLabel;
    this.elBtnAssistWhy = elBtnAssistWhy;
    this.elAssistWhyTooltip = elAssistWhyTooltip;

    this.elFloorLandmarksHud = elFloorLandmarksHud;
    this.elLandmarksFloorTag = elLandmarksFloorTag;
    this.elLandmarksBadgesContainer = elLandmarksBadgesContainer;

    this.getCore = getCore || (() => null);
    //this.appendLog = appendLog || (() => {});

    this.currentLanguage = 'ja';
    this.lastAssistAction = null;

    this.initAssistSignalEvents();
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
  }

  initAssistSignalEvents() {
    if (this.elBtnAssistAction) {
      this.elBtnAssistAction.onclick = async (e) => {
        e.stopPropagation();
        const core = this.getCore();
        if (!this.lastAssistAction || !this.lastAssistAction.keySequence || !core) return;
        const seq = this.lastAssistAction.keySequence;
        //this.appendLog(`[AssistAction] '${this.lastAssistAction.labelJa || this.lastAssistAction.labelEn}' を実行 (keys: ${JSON.stringify(seq)})`);

        if (core.driver && typeof core.driver.queueSequence === 'function') {
          await core.driver.queueSequence(seq);
        } else if (typeof core.sendKeySequence === 'function') {
          await core.sendKeySequence(seq);
        }
      };
    }

    if (this.elBtnAssistWhy && this.elAssistWhyTooltip) {
      this.elBtnAssistWhy.onclick = (e) => {
        e.stopPropagation();
        this.elAssistWhyTooltip.classList.toggle('hidden');
      };
    }
  }

  /**
   * 🚨 HUD 最優先アシストシグナルバー (Level 2 & Level 3) の描画
   * @param {Object} assistState 
   */
  renderAssistSignalBar(assistState) {
    if (!this.elAssistSignalBar) return;
    const isEn = this.currentLanguage === 'en';
    const signal = assistState?.primarySignal;

    if (!signal) {
      this.elAssistSignalBar.classList.add('hidden');
      this.lastAssistAction = null;
      if (this.elAssistWhyTooltip) this.elAssistWhyTooltip.classList.add('hidden');
      return;
    }

    this.elAssistSignalBar.classList.remove('hidden');

    // クラス名設定 (重要度別)
    let barClass = 'assist-signal-bar';
    if (signal.category === 'SURVIVAL' || (signal.priority && signal.priority >= 80)) {
      barClass += ' danger';
    } else if (signal.priority && signal.priority >= 60) {
      barClass += ' warning';
    } else if (signal.stance === 'CURE' || signal.category === 'TACTICAL_COMBAT') {
      barClass += ' success';
    }
    this.elAssistSignalBar.className = barClass;

    // アイコン・メッセージ
    if (this.elAssistSignalIcon) {
      this.elAssistSignalIcon.textContent = signal.icon || '🛡️';
    }
    if (this.elAssistSignalText) {
      this.elAssistSignalText.textContent = isEn
        ? (signal.shortMessageEn || signal.shortMessageJa)
        : (signal.shortMessageJa || signal.shortMessageEn);
    }

    // ワンタップ実行アクションボタン (Level 3)
    const action = assistState.primaryAction;
    if (action && action.keySequence && action.keySequence.length > 0 && this.elBtnAssistAction) {
      this.elBtnAssistAction.classList.remove('hidden');
      if (this.elAssistActionLabel) {
        this.elAssistActionLabel.textContent = isEn
          ? (action.labelEn || action.labelJa)
          : (action.labelJa || action.labelEn);
      }
      this.lastAssistAction = action;
    } else if (this.elBtnAssistAction) {
      this.elBtnAssistAction.classList.add('hidden');
      this.lastAssistAction = null;
    }

    // 理由ツールチップ (Why)
    if (this.elAssistWhyTooltip) {
      const whyText = isEn
        ? (signal.detailWhyEn || signal.detailWhyJa || '')
        : (signal.detailWhyJa || signal.detailWhyEn || '');
      this.elAssistWhyTooltip.textContent = whyText || (isEn ? 'Recommended tactical move for survival.' : '生存率を高めるための推奨アクションです。');
    }
  }

  /**
   * 🧭 フロア設備案内フローティング HUD の描画 (GKL Core の summary を利用)
   * @param {Object} landmarks 
   */
  renderFloorLandmarks(landmarks) {
    if (!this.elFloorLandmarksHud || !this.elLandmarksBadgesContainer) return;
    const isEn = this.currentLanguage === 'en';
    const summaryItems = landmarks?.summary || [];

    if (summaryItems.length === 0) {
      this.elFloorLandmarksHud.classList.add('hidden');
      return;
    }

    this.elFloorLandmarksHud.classList.remove('hidden');

    if (this.elLandmarksFloorTag) {
      this.elLandmarksFloorTag.textContent = `🗺️ ${landmarks.floorKey || 'Dlvl:1'}`;
    }

    const badgeItems = summaryItems.map(item => {
      const name = isEn ? item.nameEn : item.nameJa;
      const countSuffix = item.count > 1 ? ` <small style="color:#38bdf8; font-weight:bold;">x${item.count}</small>` : '';
      const tooltip = isEn ? item.tooltipEn : item.tooltipJa;
      return `<span class="landmark-badge-item" title="${tooltip}">${item.icon} ${name}${countSuffix}</span>`;
    }).join('');

    this.elLandmarksBadgesContainer.innerHTML = badgeItems;
  }
}
