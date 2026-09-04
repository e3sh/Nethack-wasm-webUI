import React, { useState, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useNetHackDriver } from '../hooks/useNetHackDriver';
import { RACE_KNOWLEDGE_MAP, ROLE_KNOWLEDGE_MAP } from '@core/knowledge/CHARACTER_KNOWLEDGE_BASE.js';

export const StatusBar: React.FC = () => {
  const [showDetails, setShowDetails] = useState(true);

  const status = useGameStore((state) => state.status);
  const gklSituation = useGameStore((state) => state.gklSituation);
  const isPlayerDead = useGameStore((state) => state.isPlayerDead);
  const engineState = useGameStore((state) => state.engineState);
  const currentLanguage = useGameStore((state) => state.currentLanguage);

  const { castSpell, enhanceSkill } = useNetHackDriver();

  const isEn = currentLanguage === 'en';

  const hpPercent = useMemo(() => {
    if (!status.hpMax || status.hpMax <= 0) return 0;
    return Math.min(100, Math.max(0, (status.hp / status.hpMax) * 100));
  }, [status.hp, status.hpMax]);

  const pwPercent = useMemo(() => {
    if (!status.pwMax || status.pwMax <= 0) return 0;
    return Math.min(100, Math.max(0, (status.pw / status.pwMax) * 100));
  }, [status.pw, status.pwMax]);

  const hpColor = useMemo(() => {
    const pct = hpPercent;
    if (pct <= 25) return '#ef4444';
    if (pct <= 50) return '#f59e0b';
    return '#10b981';
  }, [hpPercent]);

  const hasCriticalAdvice = useMemo(() => {
    if (isPlayerDead || engineState !== 'RUNNING' || status.hpMax <= 0) {
      return false;
    }
    const sit = gklSituation;
    const advices = sit?.advices || sit?.tacticalAdvices || [];
    return advices.some((adv: any) => adv.isCritical || adv.severity === 'CRITICAL');
  }, [isPlayerDead, engineState, status.hpMax, gklSituation]);

  const characterTag = useMemo(() => {
    const sit = gklSituation;
    const charInfo = sit?.attributes?.characterInfo || sit?.playerState?.attributes?.characterInfo;
    if (!charInfo || (!charInfo.race && !charInfo.role)) return '';

    const raceData = charInfo.race ? (RACE_KNOWLEDGE_MAP as any)[charInfo.race] : null;
    const roleData = charInfo.role ? (ROLE_KNOWLEDGE_MAP as any)[charInfo.role] : null;
    const raceName = isEn ? (raceData?.name || charInfo.race) : (raceData?.nameJa || charInfo.race);
    const isFemale = charInfo.gender === 'female';
    const roleName = isEn
      ? ((isFemale && roleData?.nameFemale) || roleData?.name || charInfo.role)
      : ((isFemale && roleData?.nameFemaleJa) || roleData?.nameJa || charInfo.role);
    const lvlStr = charInfo.level ? ` Lv.${charInfo.level}` : '';
    return `👤 ${raceName || '??'} / ${roleName || '??'}${lvlStr}`;
  }, [gklSituation, isEn]);

  const activeResistances = useMemo(() => {
    const sit = gklSituation;
    const attrState = sit?.attributes || sit?.playerState?.attributes || {};
    const res = attrState.effectiveResistances || {};
    const activeKeys = attrState.activeAttributes || [];

    const definitions: Record<string, { label: string; en: string }> = {
      FIRE_RES: { label: '耐火', en: 'Fire Res' },
      COLD_RES: { label: '耐冷', en: 'Cold Res' },
      SLEEP_RES: { label: '耐睡眠', en: 'Sleep Res' },
      DISINT_RES: { label: '耐分解', en: 'Disint Res' },
      SHOCK_RES: { label: '耐電', en: 'Shock Res' },
      POISON_RES: { label: '耐毒', en: 'Poison Res' },
      ACID_RES: { label: '耐酸', en: 'Acid Res' },
      STONE_RES: { label: '耐石化', en: 'Stone Res' },
      TELEPORT_CONTROL: { label: 'テレポート制御', en: 'Tele Control' },
      TELEPATHY: { label: 'テレパシー', en: 'Telepathy' },
      SEE_INVISIBLE: { label: '不可視視認', en: 'See Invisible' },
      INVISIBILITY: { label: '透明', en: 'Invisibility' },
      STEALTH: { label: '忍び', en: 'Stealth' },
      SEARCHING: { label: '自動探索', en: 'Searching' },
      FAST: { label: '俊足', en: 'Speed' },
      VERY_FAST: { label: '超俊足', en: 'Very Fast' },
      LEVITATION: { label: '浮遊', en: 'Levitation' },
    };

    const list: Array<{ key: string; label: string; en: string }> = [];

    for (const [k, val] of Object.entries(res)) {
      if (val) {
        list.push({
          key: k,
          label: definitions[k]?.label || k,
          en: definitions[k]?.en || k,
        });
      }
    }

    for (const k of activeKeys) {
      if (!list.some(item => item.key === k)) {
        list.push({
          key: k,
          label: definitions[k]?.label || k,
          en: definitions[k]?.en || k,
        });
      }
    }

    return list;
  }, [gklSituation]);

  const spellsList = useMemo(() => {
    const sit = gklSituation;
    return sit?.spells?.items || sit?.spells?.spells || sit?.playerState?.spells?.spells || [];
  }, [gklSituation]);

  const skillsList = useMemo(() => {
    const sit = gklSituation;
    return sit?.skills?.activeItems || sit?.skills?.items || sit?.skills?.skills || sit?.playerState?.skills?.skills || [];
  }, [gklSituation]);

  return (
    <div className="status-bar">
      <div className="status-main">
        <span className="st-item title">{status.title || 'Hero'}</span>
        <span className="st-item dlvl">{status.dlvl}</span>

        {/* HP ゲージバー */}
        <div className="gauge-box">
          <span className="st-item hp">HP:{status.hp}({status.hpMax})</span>
          <div className="gauge-bg">
            <div
              className="gauge-fill hp-fill"
              style={{ width: `${hpPercent}%`, background: hpColor }}
            />
          </div>
        </div>

        {/* MP ゲージバー */}
        <div className="gauge-box">
          <span className="st-item pw">Pw:{status.pw}({status.pwMax})</span>
          <div className="gauge-bg">
            <div
              className="gauge-fill mp-fill"
              style={{ width: `${pwPercent}%` }}
            />
          </div>
        </div>

        <span className="st-item ac">AC:{status.ac}</span>
        <span className="st-item gold">💰 {status.gold}</span>

        {/* 詳細ステータス展開トグルボタン */}
        <button
          className="btn-status-toggle"
          title={showDetails ? '詳細を折りたたむ' : '詳細を展開'}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '▲' : '▼'}
        </button>
      </div>

      {/* 動的バッジエリア (Hunger & Condition & 危機) */}
      <div className="status-badges">
        {/* 認識された種族・職業バッジ */}
        {characterTag && (
          <span className="badge char-badge">
            {characterTag}
          </span>
        )}

        {status.hunger && (
          <span className="badge hunger-badge">
            {status.hunger}
          </span>
        )}
        {status.condition.map((cond, idx) => (
          <span key={idx} className="badge cond-badge">
            {cond}
          </span>
        ))}
        {hasCriticalAdvice && (
          <span
            className="badge cond-badge critical-crisis"
            title="重大な危険が発生中 (右下の戦術アドバイスを確認)"
          >
            🚨 危険
          </span>
        )}
      </div>

      {/* 展開詳細行 (詳細ステータス領域) */}
      {showDetails && (
        <div className="status-details">
          {/* 6大能力値グリッド */}
          <div className="status-stats-grid">
            <span className="st-item stat"><label>St:</label>{status.stats.str || '--'}</span>
            <span className="st-item stat"><label>Dx:</label>{status.stats.dex || '--'}</span>
            <span className="st-item stat"><label>Co:</label>{status.stats.con || '--'}</span>
            <span className="st-item stat"><label>In:</label>{status.stats.int || '--'}</span>
            <span className="st-item stat"><label>Wi:</label>{status.stats.wis || '--'}</span>
            <span className="st-item stat"><label>Ch:</label>{status.stats.cha || '--'}</span>
          </div>

          <div className="status-extra-grid">
            <span className="st-item align"><label>Align:</label>{status.align || 'Neutral'}</span>
            <span className="st-item exp"><label>Exp:</label>{status.level}{status.exp > 0 ? `/${status.exp}` : ''}</span>
            <span className="st-item turns"><label>T:</label>{status.turns}</span>
            {status.score > 0 && <span className="st-item score"><label>Score:</label>{status.score}</span>}
          </div>

          {/* GKL 拡張: 属性耐性 ＆ 修得魔法 ＆ スキル熟練度の詳細行 */}
          <div className="status-gkl-extra">
            {/* 🛡️ 確定属性耐性 */}
            <div className="gkl-detail-row">
              <strong className="detail-label">🛡️ {isEn ? 'Resistances:' : '確定耐性:'}</strong>
              {activeResistances.length > 0 ? (
                <div className="detail-badges-list">
                  {activeResistances.map((attr) => (
                    <span
                      key={attr.key}
                      className="attr-badge active"
                      title={`${attr.label} (${attr.en})`}
                    >
                      {isEn ? attr.en : attr.label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="detail-empty">{isEn ? 'None' : 'なし'}</span>
              )}
            </div>

            {/* 📖 修得魔法 */}
            <div className="gkl-detail-row">
              <strong className="detail-label">📖 {isEn ? 'Spells:' : '修得魔法:'}</strong>
              {spellsList.length > 0 ? (
                <div className="detail-badges-list">
                  {spellsList.map((sp: any) => (
                    <button
                      key={sp.letter}
                      className="spell-tag-btn"
                      title={`[${sp.letter}] ${sp.name} (Lv.${sp.level} 失敗率:${sp.failRate})`}
                      onClick={() => castSpell(sp.letter)}
                    >
                      ✨ [{sp.letter}] {sp.name} <small>({sp.failRate})</small>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="detail-empty">{isEn ? 'None' : 'なし'}</span>
              )}
            </div>

            {/* 🥋 スキル熟練度 */}
            <div className="gkl-detail-row">
              <strong className="detail-label">🥋 {isEn ? 'Skills:' : 'スキル熟練度:'}</strong>
              {skillsList.length > 0 ? (
                <div className="detail-badges-list">
                  {skillsList.map((sk: any) => (
                    <span
                      key={sk.name}
                      className={`skill-tag ${sk.canEnhance ? 'can-enhance' : ''}`}
                      title={sk.rawText || sk.name}
                      onClick={() => enhanceSkill(sk)}
                    >
                      {sk.canEnhance && <span>⭐</span>}
                      {sk.name} [{isEn ? (sk.rank?.en || sk.rank?.label) : (sk.rank?.label || sk.rank?.en)}]
                    </span>
                  ))}
                </div>
              ) : (
                <span className="detail-empty">{isEn ? 'None' : 'なし'}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
