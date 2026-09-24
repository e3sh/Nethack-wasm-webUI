import { getAdaptiveItemSpecs } from "../../../../src/core/knowledge/presenters/ItemSpecPresenter.js";

/**
 * KnowledgeView - 戦術アドバイス専用パネルマネージャー
 * （ナレッジ情報はマス頭上のフローティングウィンドウ内で完結するため、
 *  右パネルはプレイヤーの健康状態・戦術警告に専念します）
 */
export class KnowledgeView {
  constructor({ elGklKnowledgeContent, getCore, onTabChanged }) {
    this.elGklKnowledgeContent = elGklKnowledgeContent;
    this.getCore = getCore || (() => null);
    this.onTabChanged = onTabChanged || (() => {});

    this.currentLanguage = 'ja';
    this.currentBottomTab = 'advices';
    this.userPreferredTab = 'advices';
    this.lastKnowledgeTarget = null;
    this.lastAdvices = [];
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
    this.updateTabLabels();
    this.renderSideAdvices();
  }

  updateTabLabels() {
    const isEn = this.currentLanguage === 'en';
    const tabBtnAdvices = document.getElementById('tab-btn-advices');
    const tabAdvicesBadge = document.getElementById('tab-advices-badge');
    if (tabBtnAdvices) {
      tabBtnAdvices.title = isEn ? 'Show Tactical Advices & Danger Alerts' : '戦術アドバイス ＆ 危険警告を表示';
      const badgeCount = tabAdvicesBadge ? tabAdvicesBadge.textContent : '0';
      const isBadgeHidden = tabAdvicesBadge ? tabAdvicesBadge.classList.contains('hidden') : false;
      tabBtnAdvices.innerHTML = `🛡️ ${isEn ? 'Advices' : 'アドバイス'} <span id="tab-advices-badge" class="gkl-badge${isBadgeHidden ? ' hidden' : ''}">${badgeCount}</span>`;
    }
  }

  /**
   * 右サイドパネル最下部カード: 戦術アドバイス専用として常時表示
   */
  switchBottomTab(tabName = 'advices', target = null, options = {}) {
    this.currentBottomTab = 'advices';
    if (target) {
      this.lastKnowledgeTarget = target;
    }
    this.onTabChanged('advices');
    this.renderSideAdvices();
  }

  renderKnowledgeCard(target, options = {}) {
    if (target) {
      this.lastKnowledgeTarget = target;
    }
    // 右パネルは戦術アドバイス専用を維持
    this.renderSideAdvices();
  }

  renderGklAdvices(advices) {
    this.lastAdvices = advices || [];
    const isEn = this.currentLanguage === 'en';

    const hasCritical = this.lastAdvices.some(a => a.severity === 'CRITICAL');

    // 1. ステータスバーの緊急アラートバッジ更新 (CRITICAL 存在時のみ点灯)
    const elCritBadge = document.getElementById('st-advice-critical-badge');
    if (elCritBadge) {
      if (hasCritical) {
        elCritBadge.classList.remove('hidden');
        elCritBadge.textContent = isEn ? '🚨 Danger' : '🚨 危険';
      } else {
        elCritBadge.classList.add('hidden');
      }
    }

    // 2. 右サイドカードのアドバイスタブ・インジケータ更新
    const tabAdvicesBadge = document.getElementById('tab-advices-badge');
    const tabBtnAdvices = document.getElementById('tab-btn-advices');
    if (tabAdvicesBadge) {
      tabAdvicesBadge.textContent = `${this.lastAdvices.length}`;
      if (this.lastAdvices.length > 0) tabAdvicesBadge.classList.remove('hidden');
      else tabAdvicesBadge.classList.add('hidden');
    }
    if (tabBtnAdvices) {
      if (hasCritical) tabBtnAdvices.classList.add('has-critical');
      else tabBtnAdvices.classList.remove('has-critical');
    }

    // 3. アドバイス一覧を常時反映
    this.renderSideAdvices();
  }

  /**
   * 🛡️ 右サイド最下部カードへの戦術アドバイス一覧の描画
   */
  renderSideAdvices() {
    if (!this.elGklKnowledgeContent) return;
    const isEn = this.currentLanguage === 'en';
    const advices = this.lastAdvices || [];

    const tabAdvices = document.getElementById('tab-btn-advices');
    if (tabAdvices) tabAdvices.classList.add('active');
    this.currentBottomTab = 'advices';

    if (advices.length === 0) {
      this.elGklKnowledgeContent.innerHTML = `
        <div class="gkl-empty-hint" style="padding:16px 8px;">
          <div style="font-size:18px; margin-bottom:4px;">🛡️</div>
          <div style="color:#94a3b8; font-weight:500;">${isEn ? 'Tactical Status: Normal (Safe)' : '戦術状況: 平常 (安全)'}</div>
          <div style="color:#64748b; font-size:11px; margin-top:4px;">${isEn ? 'No immediate danger detected.' : '直近の危険・戦術提案はありません。'}</div>
        </div>`;
      return;
    }

    const cardsHtml = advices.map(adv => {
      const sev = adv.severity || 'INFO';
      const msg = adv.message || (isEn ? adv.messageEn : adv.messageJa);
      const hintKey = adv.hintCommand ? `[${adv.hintCommand}]` : (adv.hintLetters && adv.hintLetters.length > 0 ? `[${adv.hintLetters.join(',')}]` : '');
      const hintHtml = hintKey ? `<span class="gkl-advice-card-hint">${hintKey}</span>` : '';

      let tagLabel = 'INFO';
      if (sev === 'CRITICAL') tagLabel = isEn ? 'CRITICAL' : '危険';
      else if (sev === 'WARNING') tagLabel = isEn ? 'WARNING' : '警告';
      else if (adv.topic === 'EQUIPMENT') tagLabel = isEn ? 'EQUIP' : '装備';
      else if (adv.topic === 'MAGIC') tagLabel = isEn ? 'MAGIC' : '魔法';
      else if (adv.topic === 'SURVIVAL') tagLabel = isEn ? 'SURVIVE' : '生存';

      return `
        <div class="gkl-side-advice-card severity-${sev}" title="${msg} (ホバーで全文表示)">
          <div class="gkl-side-advice-header">
            <div style="display:flex; align-items:center; gap:5px;">
              <span>${sev === 'CRITICAL' ? '🚨' : (sev === 'WARNING' ? '⚠️' : '💡')}</span>
              <span class="gkl-side-advice-tag">${tagLabel}</span>
            </div>
            ${hintHtml}
          </div>
          <div class="gkl-side-advice-body">
            <div class="gkl-side-advice-text">${msg}</div>
          </div>
        </div>
      `;
    }).join('');

    this.elGklKnowledgeContent.innerHTML = `
      <div class="gkl-side-advices-container">
        ${cardsHtml}
      </div>
    `;
  }
}
