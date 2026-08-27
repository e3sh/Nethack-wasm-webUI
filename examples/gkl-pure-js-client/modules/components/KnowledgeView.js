import { getAdaptiveItemSpecs } from '../../../../src/core/knowledge/ItemSpecPresenter.js';

/**
 * KnowledgeView - 構造化ナレッジカード & 戦術アドバイス & ボトムタブ切り替えマネージャー
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

    const tabBtnKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabBtnKnowledge) {
      tabBtnKnowledge.title = isEn ? 'Show Structured Knowledge' : '直前に調査した構造化ナレッジを表示';
      tabBtnKnowledge.textContent = isEn ? '💡 Knowledge' : '💡 ナレッジ';
    }
  }

  /**
   * 💡 構造化ナレッジ ↔ 🛡️ 戦術アドバイス のボトムタブ切り替え
   * @param {'advices'|'knowledge'} tabName 
   * @param {Object} [target=null] 
   * @param {Object} [options={}] 
   */
  switchBottomTab(tabName, target = null, options = {}) {
    this.currentBottomTab = tabName;

    const tabAdvices = document.getElementById('tab-btn-advices');
    const tabKnowledge = document.getElementById('tab-btn-knowledge');

    if (tabAdvices) {
      if (tabName === 'advices') tabAdvices.classList.add('active');
      else tabAdvices.classList.remove('active');
    }
    if (tabKnowledge) {
      if (tabName === 'knowledge') tabKnowledge.classList.add('active');
      else tabKnowledge.classList.remove('active');
    }

    this.onTabChanged(tabName);

    if (tabName === 'advices') {
      this.renderSideAdvices();
    } else {
      this.renderKnowledgeCard(target || this.lastKnowledgeTarget, options);
    }
  }

  renderKnowledgeCard(target, options = {}) {
    if (!this.elGklKnowledgeContent) return;
    const isEn = this.currentLanguage === 'en';
    if (target) {
      this.lastKnowledgeTarget = target;
    }

    if (!target) {
      this.switchBottomTab('advices');
      return;
    }

    // ナレッジタブのアクティブ化
    const tabAdvices = document.getElementById('tab-btn-advices');
    const tabKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabAdvices) tabAdvices.classList.remove('active');
    if (tabKnowledge) tabKnowledge.classList.add('active');
    this.currentBottomTab = 'knowledge';

    let data = null;
    let dynamicState = options.dynamicState || target.dynamicState || null;
    let isPet = target.type === 'PET' || (target.entity && target.entity.type === 'PET');
    let isPlayer = options.isPlayer || target.isPlayer || target.type === 'PLAYER' || (dynamicState && dynamicState.isPlayer);

    const core = this.getCore();

    // 👤 1. プレイヤー自身の場合はリアルタイムステータスカードを優先採用
    if (isPlayer) {
      data = (target && target.stats && target.stats.hp) ? target : {
        name: isEn ? 'You (Player)' : '自分 (Player)',
        category: 'PLAYER',
        dangerLevel: 'NONE',
        dispositionStatus: 'PLAYER',
        stats: { hd: 'Player', ac: 'Self', speed: 'Self', mr: 0 },
        effectSummary: isEn ? 'The adventurer exploring the Mazes of Menace.' : 'ダンジョンを探索中のプレイヤー自身です。'
      };
    } else if (target && typeof target === 'object' && target.knowledge) {
      // 🎒 所持品アイテム等: すでにキャッシュされたナレッジと最新動的状態を安全に合成
      data = {
        ...target.knowledge,
        rawText: target.rawText || target.knowledge.rawText,
        identification: target.identification || target.knowledge.identification,
        bucStatus: target.bucStatus || target.knowledge.bucStatus,
        isWielded: target.isWielded,
        isOffhand: target.isOffhand,
        isQuivered: target.isQuivered,
        isWorn: target.isWorn,
        letter: target.letter
      };
    } else if (target && (target.dangerLevel || target.category || target.isUnidentified || target.effectSummary)) {
      // すでに完全な構造化カードデータである場合
      data = target;
    } else if (core && core.gkl && core.gkl.structuredKnowledge) {
      // 🎯 2. 万能統合ナレッジアクセサ getKnowledge を直接安全呼び出し
      data = core.gkl.structuredKnowledge.getKnowledge(target, { dynamicState, isPet, isPlayer, translate: true, language: this.currentLanguage });
    }

    if (!data && target && typeof target === 'object' && target.knowledge) {
      data = target.knowledge;
    }

    if (!data) {
      this.elGklKnowledgeContent.innerHTML = `<div class="gkl-empty-hint">${isEn ? 'No knowledge data available' : '該当するナレッジ情報がありません'}</div>`;
      return;
    }

    // 🎯 3. 明確な型判定: モンスター/ペット/プレイヤー vs アイテム/死体/地形
    const isMonsterType = data.dangerLevel || data.category === 'MONSTER' || data.dispositionStatus || isPet;

    if (isMonsterType) {
      const badgeClass = `kn-danger-${data.dangerLevel || 'MEDIUM'}`;
      let dispositionBadge = '';
      let dispositionNote = '';

      if (data.dispositionStatus === 'PEACEFUL') {
        dispositionBadge = `<span class="kn-status-badge kn-status-peaceful">${isEn ? '☮️ Peaceful (SAFE)' : '☮️ 平和的 (SAFE)'}</span>`;
      } else if (data.dispositionStatus === 'DEFAULT_PEACEFUL') {
        dispositionBadge = `<span class="kn-status-badge kn-status-peaceful">${isEn ? '☮️ Normally Peaceful' : '☮️ 通常平和 (SAFE)'}</span>`;
        dispositionNote = `<div style="font-size:11px; color:#a6adc8; margin-top:4px;">${isEn ? '※ Normally peaceful; becomes hostile (LETHAL) if attacked or stolen from.' : '※ 通常は平和的ですが、攻撃・泥棒を行うと敵対化 (LETHAL) します'}</div>`;
      } else if (data.dispositionStatus === 'TAMED' || isPet) {
        dispositionBadge = `<span class="kn-status-badge kn-status-tamed">${isEn ? '🐾 Pet (TAMED)' : '🐾 ペット (TAMED)'}</span>`;
      } else if (data.dispositionStatus === 'PLAYER' || isPlayer) {
        dispositionBadge = `<span class="kn-status-badge kn-status-player">${isEn ? '👤 Player' : '👤 プレイヤー'}</span>`;
      } else {
        dispositionBadge = `<span class="kn-status-badge kn-status-hostile">${isEn ? `⚔️ Hostile (${data.dangerLevel || 'LETHAL'})` : `⚔️ 敵対的 (${data.dangerLevel || 'LETHAL'})`}</span>`;
      }

      const clickBadge = options.isClickConfirmed ? `<span class="kn-status-badge kn-status-confirmed">${isEn ? '🔍 Look Inspected' : '🔍 Look確認済み'}</span>` : '';

      this.elGklKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.name}</span>
            <span class="kn-danger-badge ${badgeClass}">${data.dangerLevel || 'MEDIUM'} DANGER</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin:4px 0 6px 0;">
            ${dispositionBadge}
            ${clickBadge}
          </div>
          ${dispositionNote}
          <div class="kn-stats-row" style="margin-top:6px; flex-wrap:wrap; gap:8px;">
            <span>HD/Lv:${data.stats?.hd ?? '-'}</span>
            <span>AC:${data.stats?.ac ?? '-'}</span>
            ${data.stats?.hp ? `<span style="color:#4ade80;">HP:${data.stats.hp}</span>` : ''}
            ${data.stats?.pw ? `<span style="color:#60a5fa;">Pw:${data.stats.pw}</span>` : ''}
            ${data.stats?.gold ? `<span style="color:#facc15;">${isEn ? 'Gold:' : '金:'}${data.stats.gold}</span>` : ''}
            ${data.stats?.dlvl ? `<span>${data.stats.dlvl}</span>` : ''}
            ${data.inventoryCount !== undefined ? `<span style="color:#c084fc;">🎒${isEn ? 'Items:' : '所持品:'}${data.inventoryCount}</span>` : ''}
          </div>
          ${data.corpseInfo?.warningNote ? `<div class="kn-warning-box">⚠️ ${data.corpseInfo.warningNote}</div>` : ''}
          ${data.effectSummary ? `<div style="font-size:12px; margin-top:4px;">${data.effectSummary}</div>` : ''}
          ${data.tacticalAdvice && data.tacticalAdvice.length > 0 ? `
            <div style="margin-top:6px;">
              <div class="kn-section-label">💡 ${isEn ? 'Tactical Advice' : '実戦戦術アドバイス'}</div>
              <ul class="kn-advice-list">${data.tacticalAdvice.map(adv => `<li>• ${adv}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      // 🎒 4. アイテム / 死体 / 地形カードのレンダリング
      let statsHtml = '';
      const sm = core?.gkl?.skillStateManager || null;
      const adaptiveSpecs = getAdaptiveItemSpecs(data, { skillStateManager: sm, language: this.currentLanguage });

      if (adaptiveSpecs.length > 0) {
        statsHtml = `
          <div class="kn-stats-row" style="margin:6px 0; padding:6px 10px; background:rgba(56, 189, 248, 0.15); border:1px solid rgba(56, 189, 248, 0.3); border-radius:4px; font-size:12px; color:#38bdf8; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
            ${adaptiveSpecs.map(s => {
              const borderStyle = s.highlight ? 'border:1px solid #38bdf8; background:rgba(56,189,248,0.2);' : 'border:1px solid #475569; background:rgba(255,255,255,0.05);';
              const valColor = s.highlight ? '#f8fafc' : '#cbd5e1';
              const labelColor = s.highlight ? '#38bdf8' : '#94a3b8';
              const skillBadgeHtml = s.skillBadge ? `<span style="color:#22c55e; font-weight:bold; margin-left:4px;">${s.skillBadge.label}</span>` : '';
              return `
                <span style="${borderStyle} padding:2px 6px; border-radius:3px;">
                  <span style="color:${labelColor}; font-size:10px;">${s.label}:</span>
                  <strong style="color:${valColor};">${s.value}</strong>
                  ${skillBadgeHtml}
                </span>
              `;
            }).join('')}
          </div>
        `;
      }

      let bucHtml = '';
      if (data.bucEffects) {
        const b = data.bucEffects;
        const bParts = [];
        if (b.blessed) bParts.push(`<li style="color:#2ecc71;"><strong>${isEn ? 'Blessed:' : '祝福:'}</strong> ${b.blessed}</li>`);
        if (b.uncursed) bParts.push(`<li style="color:#bdc3c7;"><strong>${isEn ? 'Uncursed:' : '通常:'}</strong> ${b.uncursed}</li>`);
        if (b.cursed) bParts.push(`<li style="color:#e74c3c;"><strong>${isEn ? 'Cursed:' : '呪い:'}</strong> ${b.cursed}</li>`);
        if (bParts.length > 0) {
          bucHtml = `<div><div class="kn-section-label">⚖️ ${isEn ? 'BUC Effects' : 'BUC効果'}</div><ul class="kn-advice-list">${bParts.join('')}</ul></div>`;
        }
      }

      let adviceHtml = '';
      if (data.usageAdvice && data.usageAdvice.length > 0) {
        adviceHtml = `
          <div style="margin-top:6px;">
            <div class="kn-section-label">💡 ${isEn ? 'Usage & Strategy Advice' : '用途・活用アドバイス'}</div>
            <ul class="kn-advice-list">${data.usageAdvice.map(adv => `<li>• ${adv}</li>`).join('')}</ul>
          </div>
        `;
      }

      let tipsHtml = '';
      if (data.unidentifiedTips && data.unidentifiedTips.length > 0) {
        tipsHtml = `
          <div style="margin-top:6px;">
            <div class="kn-section-label">🔍 ${isEn ? 'Identification Tips' : '識別戦術テクニック'}</div>
            <ul class="kn-advice-list">${data.unidentifiedTips.map(tip => `<li>• ${tip}</li>`).join('')}</ul>
          </div>
        `;
      }

      const id = data.identification || (data.knowledge && data.knowledge.identification) || {};
      const isUnid = !!id.isUnidentified || !!data.isUnidentified;
      const canBeUnid = (data.canBeUnidentified !== undefined) ? !!data.canBeUnidentified : isUnid;
      const rawLower = (data.rawText || data.name || '').toLowerCase();
      const bucStatus = id.bucStatus || data.bucStatus || (rawLower.includes('blessed') ? 'BLESSED' : rawLower.includes('cursed') ? 'CURSED' : rawLower.includes('uncursed') ? 'UNCURSED' : 'UNKNOWN');

      const idBadges = [];
      if (canBeUnid) {
        if (isUnid) {
          idBadges.push(`<span class="kn-status-badge kn-status-unid">${isEn ? '🔍 UNIDENTIFIED' : '🔍 未識別 (UNIDENTIFIED)'}</span>`);
        } else {
          idBadges.push(`<span class="kn-status-badge kn-status-known">${isEn ? '✅ IDENTIFIED' : '✅ 識別済み (IDENTIFIED)'}</span>`);
        }
      }

      if (bucStatus === 'BLESSED') {
        idBadges.push(`<span class="kn-status-badge kn-status-blessed">${isEn ? '✨ BLESSED' : '✨ 祝福 (BLESSED)'}</span>`);
      } else if (bucStatus === 'CURSED') {
        idBadges.push(`<span class="kn-status-badge kn-status-cursed">${isEn ? '💀 CURSED' : '💀 呪い (CURSED)'}</span>`);
      } else if (bucStatus === 'UNCURSED' && canBeUnid) {
        idBadges.push(`<span class="kn-status-badge kn-status-uncursed">${isEn ? '⚪ UNCURSED' : '⚪ 通常 (UNCURSED)'}</span>`);
      }

      if (id.appearanceName) {
        idBadges.push(`<span class="kn-status-badge kn-status-named">${isEn ? `🎨 Appearance: ${id.appearanceName}` : `🎨 外見: ${id.appearanceName}`}</span>`);
      }
      if (id.calledName) {
        idBadges.push(`<span class="kn-status-badge kn-status-named">${isEn ? `🏷️ Called: ${id.calledName}` : `🏷️ 仮名: ${id.calledName}`}</span>`);
      }

      this.elGklKnowledgeContent.innerHTML = `
        <div class="kn-card">
          <div class="kn-header">
            <span class="kn-title">${data.name}</span>
            <span class="kn-category-badge">${data.category || 'ITEM'}</span>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; margin:4px 0 6px 0;">
            ${idBadges.join('')}
          </div>
          ${statsHtml}
          ${data.effectSummary ? `<div style="font-size:12px; margin-top:4px;">${data.effectSummary}</div>` : ''}
          ${data.flavorNote ? `<div style="font-style:italic; font-size:11px; color:#94a3b8; margin:4px 0;">" ${data.flavorNote} "</div>` : ''}
          ${bucHtml}
          ${tipsHtml}
          ${adviceHtml}
        </div>
      `;
    }
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

    // 3. 現在アドバイスタブが開いている場合、アドバイス一覧を自動反映
    if (this.currentBottomTab === 'advices') {
      this.renderSideAdvices();
    }
  }

  /**
   * 🛡️ 右サイド最下部カードへの戦術アドバイス一覧の描画
   */
  renderSideAdvices() {
    if (!this.elGklKnowledgeContent) return;
    const isEn = this.currentLanguage === 'en';
    const advices = this.lastAdvices || [];

    // タブのactive同期
    const tabAdvices = document.getElementById('tab-btn-advices');
    const tabKnowledge = document.getElementById('tab-btn-knowledge');
    if (tabAdvices) tabAdvices.classList.add('active');
    if (tabKnowledge) tabKnowledge.classList.remove('active');
    this.currentBottomTab = 'advices';

    if (advices.length === 0) {
      this.elGklKnowledgeContent.innerHTML = `
        <div class="gkl-empty-hint" style="padding:16px 8px;">
          <div style="font-size:18px; margin-bottom:4px;">🛡️</div>
          <div style="color:#94a3b8; font-weight:500;">${isEn ? 'Tactical Status: Normal (Safe)' : '戦術状況: 平常 (安全)'}</div>
          <div style="color:#64748b; font-size:11px; margin-top:4px;">${isEn ? 'No immediate danger detected.<br>Click a tile or item to inspect knowledge.' : '直近の危険・戦術提案はありません。<br>マップや所持品を選択するとナレッジが表示されます。'}</div>
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
