import { ATTRIBUTE_DEFINITIONS } from '../../../../src/core/knowledge/AttributeStateManager.js';
import { RACE_KNOWLEDGE_MAP, ROLE_KNOWLEDGE_MAP } from '../../../../src/core/knowledge/CHARACTER_KNOWLEDGE_BASE.js';

/**
 * StatusView - ステータスバー & HP/MPゲージ & 属性耐性 & 呪文/スキルパネルマネージャー
 */
export class StatusView {
  constructor({
    elStatusBar,
    elBtnToggleStatusDetails,
    elStName,
    elStDlvl,
    elStHp,
    elStPw,
    elStAc,
    elStGold,
    elStCond,
    elHpBarFill,
    elMpBarFill,
    elStStr,
    elStDex,
    elStCon,
    elStInt,
    elStWis,
    elStCha,
    elStAlign,
    elStExp,
    elStTurns,
    elStScore,
    elStItemTurns,
    elStItemScore,
    getCore,
    getLoadedTileImagePath
  }) {
    this.elStatusBar = elStatusBar;
    this.elBtnToggleStatusDetails = elBtnToggleStatusDetails;
    this.elStName = elStName;
    this.elStDlvl = elStDlvl;
    this.elStHp = elStHp;
    this.elStPw = elStPw;
    this.elStAc = elStAc;
    this.elStGold = elStGold;
    this.elStCond = elStCond;
    this.elHpBarFill = elHpBarFill;
    this.elMpBarFill = elMpBarFill;
    this.elStStr = elStStr;
    this.elStDex = elStDex;
    this.elStCon = elStCon;
    this.elStInt = elStInt;
    this.elStWis = elStWis;
    this.elStCha = elStCha;
    this.elStAlign = elStAlign;
    this.elStExp = elStExp;
    this.elStTurns = elStTurns;
    this.elStScore = elStScore;
    this.elStItemTurns = elStItemTurns;
    this.elStItemScore = elStItemScore;

    this.getCore = getCore || (() => null);
    this.getLoadedTileImagePath = getLoadedTileImagePath || (() => '../../pict/nethack_default_32.png');
    this.currentLanguage = 'ja';
  }

  setLanguage(lang) {
    this.currentLanguage = lang;
  }

  updateStatus(status) {
    if (!status) return;
    if (this.elStName) this.elStName.textContent = status.title || 'Hero';
    if (this.elStDlvl) this.elStDlvl.textContent = status.dlevel ? status.dlevel.text : 'Dlvl:1';
    
    // HP ゲージ＆テキスト
    if (status.hp) {
      if (this.elStHp) this.elStHp.textContent = `HP:${status.hp.current}(${status.hp.max})`;
      const hpPct = Math.max(0, Math.min(100, Math.round((status.hp.current / Math.max(1, status.hp.max)) * 100)));
      if (this.elHpBarFill) this.elHpBarFill.style.width = `${hpPct}%`;
    } else {
      if (this.elStHp) this.elStHp.textContent = 'HP:0(0)';
      if (this.elHpBarFill) this.elHpBarFill.style.width = '0%';
    }

    // MP (Pw) ゲージ＆テキスト
    if (status.pw) {
      if (this.elStPw) this.elStPw.textContent = `Pw:${status.pw.current}(${status.pw.max})`;
      const mpPct = Math.max(0, Math.min(100, Math.round((status.pw.current / Math.max(1, status.pw.max)) * 100)));
      if (this.elMpBarFill) this.elMpBarFill.style.width = `${mpPct}%`;
    } else {
      if (this.elStPw) this.elStPw.textContent = 'Pw:0(0)';
      if (this.elMpBarFill) this.elMpBarFill.style.width = '0%';
    }

    if (this.elStAc) this.elStAc.textContent = status.ac !== undefined ? `AC:${status.ac}` : 'AC:10';
    
    // Gold
    if (status.gold && this.elStGold) {
      const tileImgPath = this.getLoadedTileImagePath() || '../../assets/nethack_default_32.png';
      const core = this.getCore();
      const goldGlyphHtml = (core && typeof core.getGlyphHtml === 'function') 
        ? core.getGlyphHtml(status.gold.glyphId || 3886, { displaySize: 14, tileImage: tileImgPath }) 
        : '💰';
      this.elStGold.innerHTML = `${goldGlyphHtml} <span>$${status.gold.amount}</span>`;
    } else if (this.elStGold) {
      this.elStGold.innerHTML = '💰 0';
    }

    const isJa = this.currentLanguage === 'ja' || this.currentLanguage === 'jp';
    const core = this.getCore();
    const translateText = (t) => {
      if (!isJa || !t) return t;
      if (core && typeof core.translate === 'function') {
        return core.translate(t);
      }
      return t;
    };

    const rawConds = (status.conditions || []).concat(status.hunger ? [status.hunger] : []);
    const conds = rawConds.map(c => translateText(c));
    if (this.elStCond) {
      if (conds.length > 0) {
        this.elStCond.classList.remove('hidden');
        this.elStCond.textContent = conds.join(', ');
      } else {
        this.elStCond.classList.add('hidden');
      }
    }

    // 展開詳細ステータス (Str, Dex, Con, Int, Wis, Cha, Align, Exp, Turns, Score)
    if (status.stats) {
      if (this.elStStr) this.elStStr.textContent = status.stats.str !== undefined ? status.stats.str : '--';
      if (this.elStDex) this.elStDex.textContent = status.stats.dex !== undefined ? status.stats.dex : '--';
      if (this.elStCon) this.elStCon.textContent = status.stats.con !== undefined ? status.stats.con : '--';
      if (this.elStInt) this.elStInt.textContent = status.stats.int !== undefined ? status.stats.int : '--';
      if (this.elStWis) this.elStWis.textContent = status.stats.wis !== undefined ? status.stats.wis : '--';
      if (this.elStCha) this.elStCha.textContent = status.stats.cha !== undefined ? status.stats.cha : '--';
    }
    if (this.elStAlign) this.elStAlign.textContent = translateText(status.align) || (isJa ? '中立' : 'Neutral');

    // 累積経験値
    if (this.elStExp) {
      const lvl = status.level !== undefined ? status.level : (status.xp !== undefined ? status.xp : 1);
      const pts = status.exp !== undefined ? status.exp : 0;
      if (status.hasExp && pts > 0) {
        this.elStExp.textContent = `${lvl}/${pts}`;
      } else {
        this.elStExp.textContent = `${lvl}`;
      }
    }

    // 経過ターン数
    if (this.elStItemTurns && this.elStTurns) {
      if (status.hasTime || status.turns > 0) {
        this.elStItemTurns.classList.remove('hidden');
        this.elStTurns.textContent = String(status.turns);
      } else {
        this.elStItemTurns.classList.add('hidden');
      }
    }

    // スコア
    if (this.elStItemScore && this.elStScore) {
      if (status.hasScore || status.score > 0) {
        this.elStItemScore.classList.remove('hidden');
        this.elStScore.textContent = String(status.score);
      } else {
        this.elStItemScore.classList.add('hidden');
      }
    }
  }

  renderGklAttributes(attrObj) {
    const elBadges = document.getElementById('status-attr-badges');
    const elDetail = document.getElementById('status-attr-detail');
    const elContainer = document.getElementById('gkl-attributes-list') || elDetail;
    const res = attrObj?.effectiveResistances || {};
    const charInfo = attrObj?.characterInfo;
    const isSynced = Boolean(attrObj?.isSynced);
    const isEn = this.currentLanguage === 'en';

    if (elBadges) {
      elBadges.innerHTML = '';
    }

    if (!elContainer) return;

    // 1. 種族・職業（ロール）タグの生成
    let charTagHtml = '';
    if (isSynced && charInfo && (charInfo.race || charInfo.role)) {
      const raceData = charInfo.race ? RACE_KNOWLEDGE_MAP[charInfo.race] : null;
      const roleData = charInfo.role ? ROLE_KNOWLEDGE_MAP[charInfo.role] : null;
      const raceName = isEn ? (raceData?.name || charInfo.race) : (raceData?.nameJa || charInfo.race);
      const isFemale = charInfo.gender === 'female';
      const roleName = isEn
        ? ((isFemale && roleData?.nameFemale) || roleData?.name || charInfo.role)
        : ((isFemale && roleData?.nameFemaleJa) || roleData?.nameJa || charInfo.role);
      const lvlStr = charInfo.level ? ` Lv.${charInfo.level}` : '';
      const tagText = `👤 [${raceName || '??'} / ${roleName || '??'}${lvlStr}]`;
      charTagHtml = `<span class="gkl-char-tag" title="${isEn ? 'Detected Race & Role' : '認識された種族・職業'}">${tagText}</span>`;
    } else {
      const tagText = isEn ? '👤 [Role/Race: Detecting...]' : '👤 [種族・職業: 検出中...]';
      charTagHtml = `<span class="gkl-char-tag detecting" title="${isEn ? 'Synchronizing with NetHack core...' : 'NetHackコアと属性同期中...'}">${tagText}</span>`;
    }

    // 2. 耐性バッジの生成
    const activeRes = ATTRIBUTE_DEFINITIONS.filter(item => Boolean(res[item.key]));
    let resHtml = '';
    if (activeRes.length === 0) {
      resHtml = `<span style="color:#64748b; font-size:11px;">${isEn ? '🛡️ Resistances: None' : '🛡️ 属性耐性: なし'}</span>`;
    } else {
      const activeHtml = activeRes.map(item => {
        const displayLabel = isEn ? (item.en || item.label) : item.label;
        return `<span class="gkl-attr-badge active" title="${item.label} / ${item.en} (有効)">${displayLabel}</span>`;
      }).join(' ');
      resHtml = `<strong style="font-size:11px; color:#94a3b8;">${isEn ? '🛡️ Resistances:' : '🛡️ 属性・能力:'}</strong> ${activeHtml}`;
    }

    elContainer.innerHTML = `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">${charTagHtml} ${resHtml}</div>`;
  }

  castSpell(letter) {
    const core = this.getCore();
    if (!core) return;
    if (letter) {
      if (core.gkl && typeof core.gkl.castSpell === 'function') {
        return core.gkl.castSpell(letter);
      }
      if (core.driver && typeof core.driver.queueSequence === 'function') {
        return core.driver.queueSequence(['Z', letter]);
      }
    }
    if (typeof core.sendKey === 'function') {
      return core.sendKey('Z', true, false, false, 'Z', true);
    }
  }

  enhanceSkill(skill) {
    const core = this.getCore();
    if (!core) return;
    if (core.gkl && typeof core.gkl.enhanceSkill === 'function') {
      return core.gkl.enhanceSkill(skill);
    }
    if (typeof core.sendKey === 'function') {
      return core.sendKey('Hash');
    }
  }

  renderGklSpells(spellsObj, slotBadges = {}) {
    const elSpellsDetail = document.getElementById('status-spells-detail');
    if (!elSpellsDetail) return;
    const isEn = this.currentLanguage === 'en';
    const spells = spellsObj?.items || [];

    if (spells.length === 0) {
      elSpellsDetail.innerHTML = `<span style="color:#64748b; font-size:11px;">${isEn ? '📖 Spells: None' : '📖 修得魔法: なし'}</span>`;
      return;
    }

    const listHtml = spells.map(sp => {
      const slotBadge = slotBadges ? (slotBadges[sp.letter] || slotBadges[sp.name]) : null;
      let badgeTag = '';
      let bgStyle = 'background:rgba(139, 92, 246, 0.15); border:1px solid #a78bfa; color:#ddd6fe;';

      if (slotBadge) {
        const badgeLabel = isEn ? (slotBadge.labelEn || slotBadge.labelJa) : (slotBadge.labelJa || slotBadge.labelEn);
        if (slotBadge.type === 'danger') {
          bgStyle = 'background:rgba(239, 68, 68, 0.2); border:1px solid #ef4444; color:#fca5a5;';
          badgeTag = ` <span style="background:#dc2626; color:#fff; font-size:9px; padding:1px 4px; border-radius:3px;">${badgeLabel}</span>`;
        } else if (slotBadge.type === 'success') {
          bgStyle = 'background:rgba(16, 185, 129, 0.2); border:1px solid #10b981; color:#6ee7b7;';
          badgeTag = ` <span style="background:#059669; color:#fff; font-size:9px; padding:1px 4px; border-radius:3px;">${badgeLabel}</span>`;
        }
      }

      const titleStr = isEn
        ? `Key: ${sp.letter}, Lv.${sp.level} ${sp.category} (Fail: ${sp.failRate}) - Click to cast`
        : `キー: ${sp.letter}, Lv.${sp.level} ${sp.category} (失敗率: ${sp.failRate}) - クリックで詠唱`;
      return `<button class="gkl-spell-badge" data-letter="${sp.letter}" style="${bgStyle} padding:2px 8px; border-radius:4px; font-size:11px; font-family:inherit; cursor:pointer;" title="${titleStr}">✨ [${sp.letter}] ${sp.name} <small style="color:#94a3b8;">(Lv.${sp.level} ${sp.failRate})</small>${badgeTag}</button>`;
    }).join(' ');

    elSpellsDetail.innerHTML = `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong style="font-size:11px; color:#94a3b8;">${isEn ? '📖 Spells:' : '📖 修得魔法:'}</strong> ${listHtml}</div>`;

    elSpellsDetail.querySelectorAll('.gkl-spell-badge').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const letter = btn.dataset.letter;
        if (letter) this.castSpell(letter);
      };
    });
  }

  renderGklSkills(skillsObj) {
    const elSkillsDetail = document.getElementById('status-skills-detail');
    if (!elSkillsDetail) return;
    const isEn = this.currentLanguage === 'en';

    const activeSkills = skillsObj ? (skillsObj.activeItems || []) : [];
    if (!skillsObj || !skillsObj.isSynced) {
      elSkillsDetail.innerHTML = `<span style="color:#64748b; font-size:11px;">${isEn ? '🥋 Skills: Not Synced' : '🥋 スキル: 未同期'}</span>`;
      return;
    }

    if (activeSkills.length === 0) {
      elSkillsDetail.innerHTML = `<span style="color:#64748b; font-size:11px;">${isEn ? '🥋 Skills: None (Unskilled)' : '🥋 スキル: なし (未熟)'}</span>`;
      return;
    }

    const listHtml = activeSkills.map(skill => {
      const rankKey = skill.rank ? skill.rank.key : 'basic';
      const rankLabel = isEn
        ? (skill.rank ? (skill.rank.en || skill.rank.label) : 'Basic')
        : (skill.rank ? (skill.rank.label || skill.rank.en) : '入門');
      const enhClass = skill.canEnhance ? 'enhanceable' : '';
      const star = skill.canEnhance ? '⭐ ' : '';
      const hint = skill.canEnhance ? (isEn ? ' (Click to enhance)' : ' (クリックで向上)') : '';
      return `<span class="gkl-skill-badge gkl-skill-badge-${rankKey} ${enhClass}" data-letter="${skill.letter || ''}" title="${skill.rawText || skill.name}${hint}">${star}<strong>${skill.name}</strong> [${rankLabel}]</span>`;
    }).join(' ');

    elSkillsDetail.innerHTML = `<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;"><strong style="font-size:11px; color:#94a3b8;">${isEn ? '🥋 Skills:' : '🥋 スキル:'}</strong> ${listHtml}</div>`;

    elSkillsDetail.querySelectorAll('.gkl-skill-badge.enhanceable').forEach(badge => {
      badge.onclick = (e) => {
        e.stopPropagation();
        this.enhanceSkill(badge.dataset.letter || undefined);
      };
    });
  }
}
